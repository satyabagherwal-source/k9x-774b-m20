# Forensic Learning Record (Deep Inspection): clidey/whodb

> **Canonical Artifact**: `07_PROJECT_LEARNING/clidey-whodb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/clidey/whodb](https://github.com/clidey/whodb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:26:57.221Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `clidey/whodb`
- **Description**: Where data access meets operational intelligence
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5030 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/hooks/changed-files.py`
```
#!/usr/bin/env python3
"""Print file paths from Claude-style file hooks or Codex apply_patch hooks."""

import json
import re
import sys


def add_path(paths: list[str], value: object) -> None:
    if not isinstance(value, str):
        return

    path = value.strip()
    if not path or "\n" in path or "\0" in path:
        return

    paths.append(path)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return 0

    paths: list[str] = []

    add_path(paths, tool_input.get("file_path"))
    add_path(paths, tool_input.get("path"))

    files = tool_input.get("files")
    if isinstance(files, list):
        for file_path in files:
            add_path(paths, file_path)

    command = tool_input.get("command")
    if isinstance(command, str):
        for pattern in (
            r"^\*\*\* (?:Add|Update|Delete) File: (.+)$",
            r"^\*\*\* Move to: (.+)$",
        ):
            for match in re.finditer(pattern, command, re.MULTILINE):
                add_path(paths, match.group(1))

    seen: set[str] = set()
    for path in paths:
        if path not in seen:
            seen.add(path)
            print(path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `.agents/skills/impeccable/scripts/detector/engines/browser/detect-url.mjs`
```
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { finding } from '../../findings.mjs';
import { profileFindingsAsync, profileStep, profileStepAsync } from '../../profile/profiler.mjs';
import { captureVisualContrastCandidate } from '../visual/screenshot-contrast.mjs';
import { checkContentHiddenAtRest } from '../../rules/checks.mjs';

// On Windows, puppeteer's bundled Chrome lives in a user-writable cache
// directory. Its GPU process can be denied (STATUS_ACCESS_DENIED) by security
// software or the GPU sandbox because it launches from an untrusted path.
// Chrome then crash-loops the GPU process, and each relaunch briefly flashes a
// compositor surface, the black window users report during `detect <url>`
// (issue #372). The system-installed Chrome runs from a trusted location with a
// healthy GPU, so channel:'chrome' avoids the crash entirely; both use hardware
// GPU, so contrast measurement is unaffected. Scope this to Windows only: other
// platforms do not have the bug, so they keep the pinned bundled build for
// consistent measurement across machines. Fall back to bundled when the switch
// fails (Chrome not installed, or channel resolution fails). If the bundled
// launch then also fails, surface the original system-Chrome error as the
// cause so the real failure is not lost.
async function launchBrowser(puppeteer, { headless = true, args = [] } = {}) {
  let channelError;
  if (process.platform === 'win32') {
    try {
      return await puppeteer.default.launch({ channel: 'chrome', headless, args });
    } catch (err) {
      // System Chrome unavailable or unlaunchable; fall through to the bundled
      // browser, but keep the error in case the fallback fails too.
      channelError = err;
    }
  }
  try {
    return await puppeteer.default.launch({ headless, args });
  } catch (err) {
    if (channelError && err && err.cause === undefined) err.cause = channelError;
    throw err;
  }
}

// Reveal sweep + invisible-text measurement for the content-hidden-at-rest
// rule. Scrolls through the document with instant jumps (bypasses CSS
// scroll-behavior: smooth) so IntersectionObserver / scroll reveal handlers
// get every chance to fire, returns to the top, lets transitions settle,
// then measures how much text still renders invisible. A healthy
// reveal-on-scroll page drops to ~0 after the sweep; a page whose reveal
// script died keeps most of its text at opacity 0.
async function measureContentHiddenAfterReveal(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.7));
    const max = Math.max(
      document.documentElement.scrollHeight || 0,
      document.body?.scrollHeight || 0,
    );
    for (let y = 0; y <= max; y += step) {
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 40)));
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    await new Promise(resolve => setTimeout(resolve, 700));
  });
  return page.evaluate(() => {
    if (typeof window.impeccableMeasureHiddenText !== 'function') return null;
    return window.impeccableMeasureHiddenText();
  });
}

function serializeDesignSystemForBrowser(designSystem) {
  if (!designSystem?.present) return null;
  return {
    present: true,
    hasFonts: designSystem.hasFonts === true,
    allowedFonts: Array.from(designSystem.allowedFonts || []),
    hasColors: designSystem.hasColors === true,
    allowedColors: Array.from(designSystem.allowedColorKeys?.values?.() || [])
      .map(entry => entry?.color)
      .filter(color => color && Number.isFinite(color.r) && Number.isFinite(color.g) && Number.isFinite(color.b))
      .map(color => ({ r: color.r, g: color.g, b: color.b })),
    hasRadii: designSystem.hasRadii === true,
    allowedRadii: (designSystem.allowedRadii || [])
      .map(entry => Number(entry?.px))
      .filter(px => Number.isFinite(px)),
    hasPillRadius: designSystem.hasPillRadius === true,
  };
}

async function runVisualContrastFallback(page, serializedGroups, options, profile, target) {
  if (options?.visualContrast === false) return [];
  const maxCandidates = Number.isFinite(options?.visualContrastMaxCandidates)
    ? options.visualContrastMaxCandidates
    : 12;
  const scrollOffscreen = options?.visualContrastScrollOffscreen !== false;
  const existingLowContrastSelectors = new Set(
    serializedGroups
      .filter(group => group.findings?.some(f => f.type === 'low-contrast'))
      .map(group => group.selector)
      .filter(Boolean)
  );

  let browserAnalyses = [];
  const findings = [];
  if (options?.visualContrastBrowser !== false) {
    const browserFindings = await profileFindingsAsync(profile, {
      engine: 'browser',
      phase: 'visual-contrast',
      ruleId: 'browser-fallback',
      target,
    }, async () => {
      browserAnalyses = await page.evaluate(async ({ maxCandidates, scrollOffscreen }) => {
        if (typeof window.impeccableAnalyzeVisualContrast !== 'function') return [];
        return window.impeccableAnalyzeVisualContrast({ maxCandidates, scrollOffscreen });
      }, { maxCandidates, scrollOffscreen });
      return browserAnalyses
        .filter(result => result.finding && !existingLowContrastSelectors.has(result.selector))
        .map(result => result.finding);
    });
    findings.push(...browserFindings);
  }

  let candidates = browserAnalyses.length > 0 ? browserAnalyses : [];
  if (candidates.length === 0) {
    candidates = await profileStepAsync(profile, {
      engine: 'browser',
      phase: 'visual-contrast',
      ruleId: 'collect-candidates',
      target,
    }, () => page.evaluate(({ maxCandidates }) => {
      if (typeof window.impeccableCollectVisualContrastCandidates !== 'function') return [];
      return window.impeccableCollectVisualContrastCandidates({ maxCandidates });
    }, { maxCandidates }));
  }

  const viewport = options?.viewport || { width: 1280, height: 800 };
  const browserResolvedSelectors = new Set(
    browserAnalyses
      .filter(result => result.status === 'fail' || result.status === 'pass')
      .map(result => result.selector)
      .filter(Boolean)
  );
  const filtered = candidates.filter(candidate =>
    !existingLowContrastSelectors.has(candidate.selector) &&
    !browserResolvedSelectors.has(candidate.selector)
  );
  if (options?.visualContrastPixel === false) return findings;
  for (const candidate of filtered) {
    const result = await profileFindingsAsync(profile, {
      engine: 'browser',
      phase: 'visual-contrast',
      ruleId: 'pixel-diff',
      target,
    }, async () => {
      const finding = await captureVisualContrastCandidate(page, candidate, viewport);
      return finding ? [finding] : [];
    });
    findings.push(...result);
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Puppeteer detection (for URLs)
// ---------------------------------------------------------------------------

async function detectUrl(url, options = {}) {
  const profile = options?.profile;
  const waitUntil = options?.waitUntil || 'networkidle0';
  const settleMs = Number.isFinite(options?.settleMs) ? options.settleMs : 0;
  const viewport = options?.viewport || { width: 1280, height: 800 };
  const externalBrowser = options?.browser || null;
  let puppeteer;
  if (!externalBrowser) {
    try {
      puppeteer = await profileStepAsync(profile, {
        engine: 'browser',
        phase: 'setup',
        ruleId: 'import-puppeteer',
        target: url,
      }, () => import('puppeteer'));
    } catch {
      throw new Error('puppeteer is required for URL scanning. Install: npm install puppeteer');
    }
  }

  // Read the browser detection script — reuse it instead of reimplementing
  const browserScriptPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'detect-antipatterns-browser.js'
  );
  let browserScript;
  try {
    browserScript = profileStep(profile, {
      engine: 'browser',
      phase: 'setup',
      ruleId: 'read-browser-script',
      target: url,
    }, () => fs.readFileSync(browserScriptPath, 'utf-8'));
  } catch {
    throw new Error(`Browser script not found at ${browserScriptPath}`);
  }

  // CI runners (GitHub Actions Ubuntu) block unprivileged user namespaces, so
  // Chrome can't initialize its sandbox there. Disable the sandbox only when
  // running in CI; local users keep the default hardened launch.
  const launchArgs = process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];
  const browser = externalBrowser || await profileStepAsync(profile, {
    engine: 'browser',
    phase: 'load',
    ruleId: 'launch-browser',
    target: url,
  }, () => launchBrowser(puppeteer, { headless: options?.headless ?? true, args: launchArgs }));
  const page = await profileStepAsync(profile, {
    engine: 'browser',
    phase: 'load',
    ruleId: 'new-page',
    target: url,
  }, () => browser.newPage());

  // Uncaught exceptions and parse errors surface as pageerror events. The
  // listener must attach before goto: a syntax error fires during the
  // initial parse, long before the load event. Dedupe by message; a single
  // broken loop can otherwise throw hundreds of identical errors.
  const pageErrors = [];
  if (options?.scriptErrors !== false) {
    page.on('pageerror', (err) => {
      const message = String(err?.message || err).split('\n')[0].trim().slice(0, 160);
      if (message && !pageErrors.includes(message)) pageErrors.push(message);
    });
  }

  let results = [];
  try {
    await profileStepAsync(profile, {
      engine: 'browser',
      phase: 'load',
      ruleId: 'set-viewport',
      target: url,
    }, () => page.setViewport(viewport));
    await profileStepAsync(profile, {
      engine: 'browser',
      phase: 'load',
      ruleId: `goto:${waitUntil}`,

```

### Core Architecture Module: `.agents/skills/impeccable/scripts/detector/engines/regex/detect-text.mjs`
```
import { GENERIC_FONTS, OVERUSED_FONTS, EM_DASH_FLOOR, EM_DASH_CHARS_PER_DASH } from '../../shared/constants.mjs';
import { isNeutralColor } from '../../shared/color.mjs';
import { extractGoogleFontFamilies } from '../../shared/fonts.mjs';
import { checkSourceDesignSystem } from '../../design-system.mjs';
import { scanCssTextForGlow, scanCssTextForGridBackground, scanCssTextForMarquee, scanCssTextForPseudoStripe, scanCssTextForRadialHalo } from '../../rules/checks.mjs';
import { isFullPage } from '../../shared/page.mjs';
import { applyInlineIgnores } from '../../shared/inline-ignores.mjs';
import { finding } from '../../findings.mjs';
import { profileFindings, profileStep } from '../../profile/profiler.mjs';

// ---------------------------------------------------------------------------
// Regex fallback (non-HTML files: CSS, JSX, TSX, etc.)
// ---------------------------------------------------------------------------

const hasRounded = (line) =>
  /\brounded(?:-\w+)?\b/.test(line.replace(/\brounded-none\b/g, ''));
const hasBorderRadius = (line) => /border-radius/i.test(line);
const isSafeElement = (line) => /<(?:blockquote|nav[\s>]|pre[\s>]|code[\s>]|a\s|input[\s>]|span[\s>])/i.test(line);


/** Strip HTML to plain text — drops script/style/comments/tags so
 *  content-text analyzers don't false-positive on code or CSS. */
function stripHtmlToText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

const PAGE_ANALYZER_EXTS = new Set(['.html', '.htm', '.astro', '.vue', '.svelte']);

function extFromFilePath(filePath) {
  return filePath ? (filePath.match(/\.\w+$/)?.[0] || '').toLowerCase() : '';
}

function shouldRunPageAnalyzers(content, filePath) {
  if (!isFullPage(content)) return false;
  const ext = extFromFilePath(filePath);
  return !ext || PAGE_ANALYZER_EXTS.has(ext);
}

const JS_SOURCE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const REGEX_PREFIX_KEYWORDS = new Set(['await', 'case', 'default', 'delete', 'do', 'else', 'in', 'instanceof', 'new', 'of', 'return', 'throw', 'typeof', 'void', 'yield']);
const BLOCK_BRACE_PREFIX_KEYWORDS = new Set(['do', 'else', 'finally', 'try']);

function isInsideOpeningJsxTag(source) {
  const tagStart = source.lastIndexOf('<');
  if (tagStart === -1 || !/^<[A-Za-z][\w.:-]*/.test(source.slice(tagStart))) return false;

  let quote = '';
  for (let cursor = tagStart + 1; cursor < source.length; cursor++) {
    const char = source[cursor];
    if (quote) {
      if (char === '\\') cursor++;
      else if (char === quote) quote = '';
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === '>') {
      return false;
    }
  }
  return true;
}

/**
 * Blank JavaScript comments without moving any following source. Regex
 * findings keep their original line numbers, while prose examples inside
 * comments cannot masquerade as rendered markup.
 */
function stripJsComments(content, options = {}) {
  let state = 'code';
  let output = '';
  let lastSignificant = '';
  let previousSignificant = '';
  let antePreviousSignificant = '';
  let currentWord = '';
  let currentWordPrefix = '';
  let wordSeparated = false;
  let regexCharClass = false;
  let jsxExpressionDepth = 0;
  let lastClosedBraceKind = '';
  const braceKinds = [];
  const templateExpressionDepths = [];

  const braceKind = (startsJsxExpression = false) => (
    !startsJsxExpression && (
      !lastSignificant ||
      lastSignificant === ')' ||
      lastSignificant === ';' ||
      lastSignificant === '}' ||
      (previousSignificant === '=' && lastSignificant === '>') ||
      BLOCK_BRACE_PREFIX_KEYWORDS.has(currentWord)
    ) ? 'block' : 'expression'
  );

  const recordSignificant = (char) => {
    if (/\s/.test(char)) {
      wordSeparated = true;
      return;
    }
    const isWordChar = /[\w$]/.test(char);
    if (isWordChar && (wordSeparated || !currentWord)) {
      currentWord = '';
      currentWordPrefix = lastSignificant;
    } else if (!isWordChar) {
      currentWordPrefix = '';
    }
    wordSeparated = false;
    antePreviousSignificant = previousSignificant;
    previousSignificant = lastSignificant;
    lastSignificant = char;
    currentWord = isWordChar ? currentWord + char : '';
  };

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (state === 'line-comment') {
      if (char === '\n') {
        output += char;
        state = 'code';
      } else {
        output += ' ';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        output += '  ';
        i++;
        state = 'code';
      } else {
        output += char === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (state === 'regex') {
      output += char;
      if (char === '\\' && next) {
        output += next;
        i++;
      } else if (char === '[') {
        regexCharClass = true;
      } else if (char === ']') {
        regexCharClass = false;
      } else if (char === '/' && !regexCharClass) {
        state = 'code';
        recordSignificant('/');
      }
      continue;
    }

    if (state === 'template' && char === '$' && next === '{') {
      output += '${';
      i++;
      recordSignificant('$');
      recordSignificant('{');
      templateExpressionDepths.push(1);
      braceKinds.push('expression');
      if (jsxExpressionDepth) jsxExpressionDepth++;
      state = 'code';
      continue;
    }

    if (state !== 'code') {
      output += char;
      if (char === '\\' && next) {
        output += next;
        i++;
      } else if (
        (state === 'single-quote' && char === "'") ||
        (state === 'double-quote' && char === '"') ||
        (state === 'template' && char === '`')
      ) {
        state = 'code';
        recordSignificant(char);
      }
      continue;
    }

    const jsxUrlSeparator = options.jsx && char === '/' && next === '/' &&
      jsxExpressionDepth === 0 &&
      (output.endsWith('http:') ||
        output.endsWith('https:') ||
        (/<[A-Za-z](?:[^>]*[^/])?>[^<]*$/.test(output.slice(output.lastIndexOf('\n') + 1)) &&
          /^[\w.-]+\.[A-Za-z]{2,}(?=[:/?#\s<]|$)/.test(content.slice(i + 2))));
    const afterPostfixUpdate = (lastSignificant === '+' || lastSignificant === '-') &&
      previousSignificant === lastSignificant &&
      antePreviousSignificant !== lastSignificant;
    if (char === '/' && next === '/' && jsxUrlSeparator) {
      output += '//';
      i++;
      recordSignificant('/');
      recordSignificant('/');
    } else if (char === '/' && next === '/') {
      output += '  ';
      i++;
      state = 'line-comment';
    } else if (char === '/' && next === '*') {
      output += '  ';
      i++;
      state = 'block-comment';
    } else if (templateExpressionDepths.length && char === '{') {
      output += char;
      templateExpressionDepths[templateExpressionDepths.length - 1]++;
      braceKinds.push(braceKind());
      if (jsxExpressionDepth) jsxExpressionDepth++;
      recordSignificant(char);
    } else if (templateExpressionDepths.length && char === '}') {
      output += char;
      const depthIndex = templateExpressionDepths.length - 1;
      templateExpressionDepths[depthIndex]--;
      lastClosedBraceKind = braceKinds.pop() || '';
      if (jsxExpressionDepth) jsxExpressionDepth--;
      recordSignificant(char);
      if (templateExpressionDepths[depthIndex] === 0) {
        templateExpressionDepths.pop();
        state = 'template';
      }
    } else if (
      char === '/' &&
      (!lastSignificant ||
        (/[=([{!?:;,&|+\-*%^~<>]/.test(lastSignificant) && !afterPostfixUpdate) ||
        (lastSignificant === '}' && lastClosedBraceKind === 'block') ||
        (previousSignificant === '=' && lastSignificant === '>') ||
        (currentWordPrefix !== '.' && REGEX_PREFIX_KEYWORDS.has(currentWord)))
    ) {
      output += char;
      state = 'regex';
      regexCharClass = false;
    } else {
      output += char;
      const startsJsxExpression = options.jsx && char === '{' && jsxExpressionDepth === 0 &&
        (/<[A-Za-z](?:[^>]*[^/])?>[^<]*$/.test(output.slice(output.lastIndexOf('\n') + 1, -1)) ||
          isInsideOpeningJsxTag(output.slice(0, -1)));
      if (char === '{') braceKinds.push(braceKind(startsJsxExpression));
      else if (char === '}') lastClosedBraceKind = braceKinds.pop() || '';
      if (char === '{' && (jsxExpressionDepth || startsJsxExpression)) jsxExpressionDepth++;
      else if (char === '}' && jsxExpressionDepth) jsxExpressionDepth--;
      recordSignificant(char);
      if (char === "'") state = 'single-quote';
      else if (char === '"') state = 'double-quote';
      else if (char === '`') state = 'template';
    }
  }

  return output;
}

function stripCssComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '));
}

function firstOverusedGoogleFont(text) {
  return extractGoogleFontFamilies(text).find(f => OVERUSED_FONTS.has(f)) || '';
}

// CSS named colors whose channels are equal (achromatic). Anything outside
// this set falls through to the format parsers, and an unrecognized spelling
// stays non-neutral so a real accent is never skipped.
const NEUTRAL_COLOR_KEYWORDS = new Set([
  'transparent', 'currentcolor',
  'black', 'white', 'gray', 'grey', 'silver',
  'dimgray', 'dimgrey', 'darkgray', 'darkgrey', 'lightgray', 'lightgrey',
  'gainsboro', 'whitesmoke',
]);

function hexChannels(color) {
  const long = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/i);
  if (long) return [parseInt(long[1], 16), parseInt(long[2], 16), parseInt(long[3], 16)];
  const short = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])(?:[0-9a-f])?$/i);
  if (short) return [1, 2, 3].map((i) => parseInt(
```

### Core Architecture Module: `.agents/skills/impeccable/scripts/detector/engines/static-html/css-cascade.mjs`
```
import fs from 'node:fs';
import path from 'node:path';

import { profileStep, recordProfileEvent } from '../../profile/profiler.mjs';
import { CSS_NAMED_COLORS, collectCssCustomProps, cssLengthToPx, parseAnyColor, resolveLengthPx, resolveVarRefs } from '../../rules/checks.mjs';

// ---------------------------------------------------------------------------
// jsdom CSS-variable border override map
// ---------------------------------------------------------------------------
//
// jsdom's CSSOM silently drops any border shorthand that contains a var()
// reference — the computed style for the element then shows empty width,
// empty style, and a default black color. That's enough to hide the most
// common real-world side-tab pattern in AI-generated pages:
//
//   :root { --brand: #87a8ff; }
//   .card { border-left: 5px solid var(--brand); border-radius: 4px; }
//
// Real browsers (and therefore the browser detector path) resolve var()
// natively, so this only affects the Node jsdom path.
//
// This pre-pass walks the stylesheets, finds any rule whose per-side or
// all-sides border property contains var(), resolves the var() against
// :root-level custom properties (read from the documentElement's computed
// style, which jsdom DOES handle correctly), and attaches the resolved
// width+color to every element that matches the rule's selector. The
// Node-side `checkElementBorders` adapter consumes that map as a fallback
// whenever jsdom's computed style came back empty.
//
// Limitations (intentional, to keep the pass simple):
//   * Only :root-level custom properties are resolved. Scoped overrides on
//     descendants are not tracked — uncommon in practice and would require
//     a per-element cascade walk.
//   * @media / @supports wrapped rules are ignored (jsdom often mishandles
//     these anyway).
//   * The fallback only fills sides that jsdom left empty, so any rule
//     whose border parses normally still wins via the computed style.

const BORDER_SHORTHAND_RE = /^(\d+(?:\.\d+)?)px\s+(solid|dashed|dotted|double|groove|ridge|inset|outset)\s+(.+)$/i;

// isNeutralColor only understands rgba()/oklch()/lch()/lab()/hsl()/hwb().
// CSS variables typically hold hex or named colors, so normalize those to
// rgb() before handing the value off to the shared check. Anything we don't
// recognise is passed through unchanged — isNeutralColor then treats it as
// non-neutral, which is the safer default (matches the oklch-era bugfix).
const NAMED_COLORS = {
  white: [255, 255, 255], black: [0, 0, 0], gray: [128, 128, 128],
  grey: [128, 128, 128], silver: [192, 192, 192], red: [255, 0, 0],
  green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0],
};

function normalizeColorForCheck(value) {
  if (!value) return value;
  const v = value.trim();
  const hex6 = v.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex6) {
    const [r, g, b] = [parseInt(hex6[1], 16), parseInt(hex6[2], 16), parseInt(hex6[3], 16)];
    return `rgb(${r}, ${g}, ${b})`;
  }
  const hex3 = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (hex3) {
    const [r, g, b] = [
      parseInt(hex3[1] + hex3[1], 16),
      parseInt(hex3[2] + hex3[2], 16),
      parseInt(hex3[3] + hex3[3], 16),
    ];
    return `rgb(${r}, ${g}, ${b})`;
  }
  const named = NAMED_COLORS[v.toLowerCase()];
  if (named) return `rgb(${named[0]}, ${named[1]}, ${named[2]})`;
  return v;
}

function buildBorderOverrideMap(document, window) {
  const map = new Map();
  const rootStyle = window.getComputedStyle(document.documentElement);

  function resolveVar(value, depth = 0) {
    if (!value || depth > 10 || !value.includes('var(')) return value;
    return value.replace(
      /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\s*\)/g,
      (_, name, fallback) => {
        const v = rootStyle.getPropertyValue(name).trim();
        if (v) return resolveVar(v, depth + 1);
        if (fallback) return resolveVar(fallback.trim(), depth + 1);
        return '';
      }
    );
  }

  function parseShorthand(text) {
    const m = text.trim().match(BORDER_SHORTHAND_RE);
    if (!m) return null;
    return { width: parseFloat(m[1]), color: normalizeColorForCheck(m[3]) };
  }

  // Read from the per-property accessors on rule.style. jsdom preserves
  // each border-* shorthand it parsed, even when the overall cssText has
  // been truncated (e.g. a `border: 1px solid var(...)` followed by a
  // `border-left: ...` loses the first declaration but keeps the second).
  const SIDE_PROPS = [
    ['borderLeft', 'Left'],
    ['borderRight', 'Right'],
    ['borderTop', 'Top'],
    ['borderBottom', 'Bottom'],
    ['borderInlineStart', 'Left'],
    ['borderInlineEnd', 'Right'],
  ];

  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules || []; } catch { continue; }
    for (const rule of rules) {
      // CSSStyleRule only; skip @media / @keyframes / @supports wrappers.
      if (rule.type !== 1 || !rule.style || !rule.selectorText) continue;

      const perSide = {};

      for (const [prop, side] of SIDE_PROPS) {
        const val = rule.style[prop];
        if (!val || !val.includes('var(')) continue;
        const parsed = parseShorthand(resolveVar(val));
        if (parsed && parsed.color) perSide[side] = parsed;
      }

      // Uniform `border: <w> <style> var(...)` applies to every side the
      // per-side map didn't already claim.
      const borderAll = rule.style.border;
      if (borderAll && borderAll.includes('var(')) {
        const parsed = parseShorthand(resolveVar(borderAll));
        if (parsed && parsed.color) {
          for (const s of ['Top', 'Right', 'Bottom', 'Left']) {
            if (!perSide[s]) perSide[s] = parsed;
          }
        }
      }

      // Longhand `border-*-color: var(...)` with width/style in separate
      // declarations. Rare in AI-generated pages, but cheap to cover.
      for (const [prop, side] of [
        ['borderLeftColor', 'Left'],
        ['borderRightColor', 'Right'],
        ['borderTopColor', 'Top'],
        ['borderBottomColor', 'Bottom'],
      ]) {
        const val = rule.style[prop];
        if (!val || !val.includes('var(')) continue;
        const resolved = resolveVar(val).trim();
        if (!resolved) continue;
        // Width may or may not come from this rule — that's fine; the
        // adapter only substitutes the color when jsdom left it as a
        // literal var() string.
        if (!perSide[side]) perSide[side] = { width: 0, color: normalizeColorForCheck(resolved) };
      }

      if (Object.keys(perSide).length === 0) continue;

      let matched;
      try { matched = document.querySelectorAll(rule.selectorText); }
      catch { continue; }

      for (const el of matched) {
        const existing = map.get(el);
        if (existing) {
          // Later rules overwrite earlier ones — approximates source-order
          // cascade for equal-specificity rules and is good enough for the
          // uncontested var()-dropped sides we're trying to recover.
          Object.assign(existing, perSide);
        } else {
          map.set(el, { ...perSide });
        }
      }
    }
  }

  return map;
}

// Strip `@layer NAME { … }` wrappers from a CSS / HTML source, leaving
// the inner rules as flat CSS. jsdom doesn't implement CSS @layer, so
// any rule inside a layer block becomes invisible to getComputedStyle.
// Tailwind v4 makes this ubiquitous: every utility class lives in
// `@layer utilities`, and Preflight lives in `@layer base`. Without
// unwrapping, every Tailwind-styled element returns empty computed
// styles. We walk the source character-by-character, balancing braces
// so we correctly handle nested style rules inside the layer block.
function unwrapCssAtLayer(source) {
  if (!source || !source.includes('@layer')) return source;
  // Find `@layer <name>? {` openers. The match starts at the @, and
  // we then balance braces from the opening { onward.
  const re = /@layer\b[^{;]*\{/g;
  let out = '';
  let lastIdx = 0;
  let m;
  while ((m = re.exec(source)) !== null) {
    const openStart = m.index;
    const openEnd = m.index + m[0].length; // position right after `{`
    let depth = 1;
    let i = openEnd;
    while (i < source.length && depth > 0) {
      const c = source.charCodeAt(i);
      if (c === 0x7b /* { */) depth++;
      else if (c === 0x7d /* } */) depth--;
      i++;
    }
    if (depth !== 0) {
      // Unbalanced — bail and return source unchanged.
      return source;
    }
    // Emit everything before the @layer, then the inner contents
    // (between the opening { and the matched closing }), then advance.
    out += source.slice(lastIdx, openStart);
    out += source.slice(openEnd, i - 1); // i-1 = position of the closing }
    lastIdx = i;
    re.lastIndex = i;
  }
  out += source.slice(lastIdx);
  return out;
}

// ---------------------------------------------------------------------------
// Static HTML/CSS detection (default for local HTML files)
// ---------------------------------------------------------------------------

const STATIC_INHERITED_PROPS = new Set([
  'color', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'fontVariant',
  'lineHeight', 'letterSpacing', 'textTransform', 'textAlign', 'hyphens',
  'webkitHyphens',
]);

const STATIC_DEFAULT_STYLE = {
  color: 'rgb(0, 0, 0)',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  backgroundImage: 'none',
  borderTopWidth: '0px',
  borderRightWidth: '0px',
  borderBottomWidth: '0px',
  borderLeftWidth: '0px',
  borderTopColor: 'rgb(0, 0, 0)',
  borderRightColor: 'rgb(0, 0, 0)',
  borderBottomColor: 'rgb(0, 0, 0)',
  borderLeftColor: 'rgb(0, 0, 0)',
  borderRadius: '0px',
  outlineWidth: '0px',
  outlineColor: 'rgb(0, 0, 0)',
  outlineStyle: 'none',
  boxShadow: 'none',
  // NOT in STATIC_INHERITED_PROPS even though text-shadow inherits in real
  // CSS: the glow check only needs to fire once, on the element that
  // declares the shadow, not on every descendant.
  
```

### Core Architecture Module: `.agents/skills/impeccable/scripts/detector/engines/static-html/detect-html.mjs`
```
import fs from 'node:fs';
import path from 'node:path';

import { GENERIC_FONTS, OVERUSED_FONTS } from '../../shared/constants.mjs';
import {
  checkSourceDesignSystem,
  collectStaticDesignSystemFindings,
  mergeDesignSystemFindings,
} from '../../design-system.mjs';
import { isFullPage } from '../../shared/page.mjs';
import { applyInlineIgnores } from '../../shared/inline-ignores.mjs';
import { finding } from '../../findings.mjs';
import { profileFindings, profileStep, profileStepAsync } from '../../profile/profiler.mjs';
import {
  checkElementBorders,
  checkElementClippedOverflow,
  checkElementColors,
  checkElementGlow,
  checkElementGptBorderShadow,
  checkElementHeroEyebrow,
  checkElementHoverContrast,
  checkElementIconTile,
  checkElementItalicSerif,
  checkElementMotion,
  checkElementOversizedH1,
  checkElementQuality,
  checkElementRadialSpotlight,
  checkCreamPalette,
  checkHtmlPatterns,
  checkKickerAboveHeadingFromDoc,
  checkNumberedSectionLabelsFromDoc,
  checkPageLayout,
  checkPageQualityFromDoc,
  checkRepeatedContainerTextFromDoc,
  resolveBackground,
  resolveBorderRadiusPx,
} from '../../rules/checks.mjs';
import { detectText, runTextContentAnalyzers } from '../regex/detect-text.mjs';
import {
  StaticDocument,
  buildStaticStyleMap,
  buildStaticWindow,
  collectStaticCssText,
} from './css-cascade.mjs';

function checkStaticPageTypography(document, window) {
  const findings = [];
  const fonts = new Set();
  const overusedFound = new Set();
  for (const el of document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, dd, blockquote, figcaption, a, button, label, span, div')) {
    const hasText = el.childNodes.some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!hasText) continue;
    const ff = window.getComputedStyle(el).fontFamily || '';
    const stack = ff.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
    const primary = stack.find(f => f && !GENERIC_FONTS.has(f));
    if (!primary) continue;
    fonts.add(primary);
    if (OVERUSED_FONTS.has(primary)) overusedFound.add(primary);
  }
  for (const font of overusedFound) {
    findings.push({ id: 'overused-font', snippet: `Primary font: ${font}` });
  }
  const sizes = new Set();
  for (const el of document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, label, button, div')) {
    const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
    if (fontSize >= 8 && fontSize < 200) sizes.add(Math.round(fontSize * 10) / 10);
  }
  if (sizes.size >= 3) {
    const sorted = [...sizes].sort((a, b) => a - b);
    const ratio = sorted[sorted.length - 1] / sorted[0];
    if (ratio < 2.0) {
      findings.push({ id: 'flat-type-hierarchy', snippet: `Sizes: ${sorted.map(s => s + 'px').join(', ')} (ratio ${ratio.toFixed(1)}:1)` });
    }
  }
  return findings;
}

function checkElementBrokenImage(el) {
  const src = (el.getAttribute && el.getAttribute('src')) ?? el.attribs?.src;
  // Missing src attribute entirely
  if (src === undefined || src === null) {
    return [{ id: 'broken-image', snippet: '<img> with no src attribute' }];
  }
  const trimmed = String(src).trim();
  // Empty or placeholder-only src values
  if (trimmed === '' || trimmed === '#') {
    return [{ id: 'broken-image', snippet: `<img src="${src}">` }];
  }
  return [];
}

const STATIC_ELEMENT_RULES = [
  { id: 'border-rules', selector: '*', run: (el, tag, style, window, customPropMap) => checkElementBorders(tag, style, null, resolveBorderRadiusPx(el, style, parseFloat(style.width) || 0, window), el) },
  { id: 'color-rules', selector: '*', run: (el, tag, style, window, customPropMap) => checkElementColors(el, style, tag, window, customPropMap, false) },
  { id: 'hover-color-rules', selector: '*', run: (el, tag, style, window) => checkElementHoverContrast(el, style, tag, window) },
  { id: 'dark-glow', selector: '*', run: (el, tag, style, window, customPropMap) => checkElementGlow(tag, style, resolveBackground(el.parentElement || el, window, customPropMap)) },
  { id: 'motion-rules', selector: '*', run: (el, tag, style) => checkElementMotion(tag, style) },
  { id: 'icon-tile-stack', selector: 'h1,h2,h3,h4,h5,h6', run: (el, tag, _style, window) => checkElementIconTile(el, tag, window) },
  { id: 'italic-serif-display', selector: 'h1,h2', run: (el, tag, style) => checkElementItalicSerif(el, style, tag) },
  { id: 'hero-eyebrow-chip', selector: 'h1', run: (el, tag, style, window, customPropMap) => checkElementHeroEyebrow(el, style, tag, window, customPropMap) },
  { id: 'broken-image', selector: 'img', run: (el) => checkElementBrokenImage(el) },
  { id: 'quality-rules', selector: '*', run: (el, tag, style, window) => checkElementQuality(el, style, tag, window) },
  { id: 'oversized-h1', selector: 'h1', run: (el, tag, style, window) => checkElementOversizedH1(el, style, tag, window) },
  { id: 'clipped-overflow-container', selector: '*', run: (el, tag, style, window) => checkElementClippedOverflow(el, style, tag, window) },
  { id: 'gpt-thin-border-wide-shadow', selector: '*', run: (el, tag, style) => checkElementGptBorderShadow(el, style) },
  { id: 'radial-spotlight-glow', selector: '*', run: (el, tag, style, window) => checkElementRadialSpotlight(el, style, tag, window) },
];

async function detectHtml(filePath, options = {}) {
  const profile = options?.profile;
  const html = profileStep(profile, {
    engine: 'static-html',
    phase: 'setup',
    ruleId: 'read-html',
    target: filePath,
  }, () => fs.readFileSync(filePath, 'utf-8'));

  let modules;
  try {
    modules = await profileStepAsync(profile, {
      engine: 'static-html',
      phase: 'setup',
      ruleId: 'import-static-parser',
      target: filePath,
    }, async () => {
      const [htmlparser2, cssSelect, csstree, domutils] = await Promise.all([
        import('htmlparser2'),
        import('css-select'),
        import('css-tree'),
        import('domutils'),
      ]);
      return {
        parseDocument: htmlparser2.parseDocument,
        selectAll: cssSelect.selectAll,
        selectOne: cssSelect.selectOne,
        is: cssSelect.is,
        csstree,
        domutils,
      };
    });
  } catch {
    return detectText(html, filePath, options);
  }

  const resolvedPath = path.resolve(filePath);
  const fileDir = path.dirname(resolvedPath);
  const root = profileStep(profile, {
    engine: 'static-html',
    phase: 'parse-html',
    ruleId: 'parse-document',
    target: filePath,
  }, () => modules.parseDocument(html, { lowerCaseAttributeNames: false, lowerCaseTags: true }));

  const cssText = collectStaticCssText(root, fileDir, profile, filePath, modules);
  const document = new StaticDocument(root, modules);
  buildStaticStyleMap(root, document, cssText, modules, profile, filePath);
  const window = buildStaticWindow(document);

  const customPropMap = null;

  const findings = [];
  const runElementCheck = (ruleId, callback) => profile
    ? profileFindings(profile, { engine: 'static-html', phase: 'element', ruleId, target: filePath }, callback)
    : callback();

  const visitedByRule = new Map();
  for (const rule of STATIC_ELEMENT_RULES) {
    const elements = document.querySelectorAll(rule.selector);
    visitedByRule.set(rule.id, elements.length);
    for (const el of elements) {
      const tag = el.tagName.toLowerCase();
      const style = window.getComputedStyle(el);
      for (const f of runElementCheck(rule.id, () => rule.run(el, tag, style, window, customPropMap))) {
        findings.push(finding(f.id, filePath, f.snippet));
      }
    }
  }

  if (options?.designSystem) {
    const sourceDesignFindings = profileFindings(profile, {
      engine: 'static-html',
      phase: 'source',
      ruleId: 'design-system',
      target: filePath,
    }, () => checkSourceDesignSystem(html, filePath, { designSystem: options.designSystem }));
    const staticDesignFindings = profileFindings(profile, {
      engine: 'static-html',
      phase: 'page',
      ruleId: 'design-system',
      target: filePath,
    }, () => collectStaticDesignSystemFindings(document, window, filePath, options.designSystem));
    findings.push(...mergeDesignSystemFindings(staticDesignFindings, sourceDesignFindings));
  }

  if (isFullPage(html)) {
    const runPageCheck = (ruleId, callback) => profile
      ? profileFindings(profile, { engine: 'static-html', phase: 'page', ruleId, target: filePath }, callback)
      : callback();
    for (const f of runPageCheck('typography-rules', () => checkStaticPageTypography(document, window))) {
      findings.push(finding(f.id, filePath, f.snippet));
    }
    for (const f of runPageCheck('kicker-above-heading', () => checkKickerAboveHeadingFromDoc(document, window))) {
      findings.push(finding(f.id, filePath, f.snippet));
    }
    for (const f of runPageCheck('numbered-section-labels', () => checkNumberedSectionLabelsFromDoc(document, window))) {
      findings.push(finding(f.id, filePath, f.snippet));
    }
    for (const f of runPageCheck('repeated-container-text', () => checkRepeatedContainerTextFromDoc(document, window))) {
      findings.push(finding(f.id, filePath, f.snippet));
    }
    for (const f of runPageCheck('layout-rules', () => checkPageLayout(document, window))) {
      findings.push(finding(f.id, filePath, f.snippet));
    }
    for (const f of runPageCheck('cream-palette', () => checkCreamPalette(document, window))) {
      findings.push(finding(f.id, filePath, f.snippet));
    }
    for (const f of runPageCheck('skipped-heading', () => checkPageQualityFromDoc(document))) {
      findings.push(finding(f.id, filePath, f.snippet));
    }
    // Scoped corpora for the pattern checks (see buildHtmlPatternCorpora in
    // rules/checks.mjs): CSS-property regexes must not fire on prose ABOUT
    // css — `<code>background-clip: text</code>` in a changelog is
    // documentation, not styling. cssText already carries the <style>
    // blocks and any linked local stylesheets; style
```

### Core Architecture Module: `.agents/skills/impeccable/scripts/detector/engines/visual/screenshot-contrast.mjs`
```
function sanitizeScreenshotClip(clip, viewport) {
  if (!clip) return null;
  const x = Math.max(0, Math.floor(clip.x || 0));
  const y = Math.max(0, Math.floor(clip.y || 0));
  const width = Math.min(
    Math.max(1, Math.ceil(clip.width || 0)),
    Math.max(1, viewport?.width || 1600),
  );
  const height = Math.min(
    Math.max(1, Math.ceil(clip.height || 0)),
    320,
  );
  if (width < 1 || height < 1) return null;
  return { x, y, width, height };
}

async function compareScreenshotContrast(page, beforeBase64, afterBase64, candidate) {
  return page.evaluate(async ({ beforeBase64, afterBase64, candidate }) => {
    const loadImage = (base64) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode contrast screenshot'));
      img.src = `data:image/png;base64,${base64}`;
    });
    const [before, after] = await Promise.all([loadImage(beforeBase64), loadImage(afterBase64)]);
    const width = Math.min(before.width, after.width);
    const height = Math.min(before.height, after.height);
    if (width < 1 || height < 1) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(before, 0, 0, width, height);
    const beforePixels = ctx.getImageData(0, 0, width, height).data;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(after, 0, 0, width, height);
    const afterPixels = ctx.getImageData(0, 0, width, height).data;

    const luminance = ({ r, g, b }) => {
      const convert = c => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b);
    };
    const ratio = (a, b) => {
      const l1 = luminance(a);
      const l2 = luminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };

    const cssTextColor = candidate.textColor && !candidate.preferRenderedForeground
      ? {
          r: candidate.textColor.r,
          g: candidate.textColor.g,
          b: candidate.textColor.b,
        }
      : null;
    const ratios = [];
    let glyphPixels = 0;
    let strongestDelta = 0;
    for (let i = 0; i < beforePixels.length; i += 4) {
      const delta = Math.abs(beforePixels[i] - afterPixels[i])
        + Math.abs(beforePixels[i + 1] - afterPixels[i + 1])
        + Math.abs(beforePixels[i + 2] - afterPixels[i + 2])
        + Math.abs(beforePixels[i + 3] - afterPixels[i + 3]);
      strongestDelta = Math.max(strongestDelta, delta);
      if (delta < 10) continue;
      glyphPixels++;
      const fg = cssTextColor || {
        r: beforePixels[i],
        g: beforePixels[i + 1],
        b: beforePixels[i + 2],
      };
      const bg = {
        r: afterPixels[i],
        g: afterPixels[i + 1],
        b: afterPixels[i + 2],
      };
      ratios.push(ratio(fg, bg));
    }

    if (ratios.length < 8) {
      return {
        glyphPixels,
        strongestDelta,
        worstRatio: null,
        p10Ratio: null,
        medianRatio: null,
      };
    }

    ratios.sort((a, b) => a - b);
    const pick = pct => ratios[Math.min(ratios.length - 1, Math.max(0, Math.floor((pct / 100) * ratios.length)))];
    return {
      glyphPixels,
      strongestDelta,
      worstRatio: ratios[0],
      p10Ratio: pick(10),
      medianRatio: pick(50),
    };
  }, { beforeBase64, afterBase64, candidate });
}

async function captureVisualContrastCandidate(page, candidate, viewport) {
  const clip = sanitizeScreenshotClip(candidate.clip, viewport);
  if (!clip) return null;

  const beforeBase64 = await page.screenshot({
    encoding: 'base64',
    clip,
    captureBeyondViewport: true,
  });
  const token = `impeccable-contrast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const applied = await page.evaluate(({ selector, token, backgroundClipText }) => {
    let el;
    try {
      el = document.querySelector(selector);
    } catch {
      return false;
    }
    if (!el) return false;
    let style = document.getElementById('impeccable-visual-contrast-hide-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'impeccable-visual-contrast-hide-style';
      style.textContent = [
        '[data-impeccable-visual-contrast-target] {',
        '  color: transparent !important;',
        '  -webkit-text-fill-color: transparent !important;',
        '  text-shadow: none !important;',
        '}',
        '[data-impeccable-visual-contrast-target][data-impeccable-bgclip-text="true"] {',
        '  background-image: none !important;',
        '}',
      ].join('\n');
      document.head.appendChild(style);
    }
    el.setAttribute('data-impeccable-visual-contrast-target', token);
    if (backgroundClipText) el.setAttribute('data-impeccable-bgclip-text', 'true');
    return true;
  }, {
    selector: candidate.selector,
    token,
    backgroundClipText: candidate.backgroundClipText,
  });
  if (!applied) return null;

  let afterBase64;
  try {
    afterBase64 = await page.screenshot({
      encoding: 'base64',
      clip,
      captureBeyondViewport: true,
    });
  } finally {
    await page.evaluate(({ selector }) => {
      try {
        const el = document.querySelector(selector);
        if (el) {
          el.removeAttribute('data-impeccable-visual-contrast-target');
          el.removeAttribute('data-impeccable-bgclip-text');
        }
      } catch {
        // Ignore invalid or stale selectors during cleanup.
      }
    }, { selector: candidate.selector }).catch(() => {});
  }

  const metrics = await compareScreenshotContrast(page, beforeBase64, afterBase64, candidate);
  if (!metrics || !Number.isFinite(metrics.p10Ratio) || metrics.glyphPixels < 8) return null;
  const measuredRatio = metrics.p10Ratio;
  if (measuredRatio >= candidate.threshold) return null;
  const textLabel = candidate.text ? ` "${candidate.text}"` : '';
  const reasonLabel = (candidate.reasons || []).slice(0, 3).join(', ') || 'visual background';
  return {
    id: 'low-contrast',
    snippet: `pixel contrast ${measuredRatio.toFixed(1)}:1 median ${metrics.medianRatio.toFixed(1)}:1 (need ${candidate.threshold}:1) on ${reasonLabel}${textLabel}`,
  };
}

export {
  sanitizeScreenshotClip,
  compareScreenshotContrast,
  captureVisualContrastCandidate,
};

```

### Core Architecture Module: `.agents/skills/impeccable/scripts/hook-admin.mjs`
```
#!/usr/bin/env node
/**
 * The Impeccable hooks command manages the design hook runtime
 * via the `hook` key and shared detector ignores via the `detector` key in
 * .impeccable/config.json / .impeccable/config.local.json.
 *
 * Usage:
 *   node hook-admin.mjs status                         # print current state
 *   node hook-admin.mjs on                             # set enabled: true
 *   node hook-admin.mjs off                            # set enabled: false
 *   node hook-admin.mjs ignore-rule <rule-id>          # append to ignoreRules
 *   node hook-admin.mjs ignore-rule overused-font --all-values
 *   node hook-admin.mjs ignore-file <glob> [--shared|--local]   # append to ignoreFiles
 *   node hook-admin.mjs ignore-value <rule> <value>    # append to shared ignoreValues
 *   node hook-admin.mjs ignore-value <rule> <value> --local
 *   node hook-admin.mjs ignore-value <rule> "*" --file <glob>   # rule off in <glob> only
 *   node hook-admin.mjs ignore-value <rule> "*"                 # refused: scope it or use ignore-rule
 *   node hook-admin.mjs reset                          # remove all config + cache
 *
 * Designed to be invoked by the LLM from the reference/hooks.md flow.
 * Output is human-readable; the harness will pass it back to the user.
 */

import fs from 'node:fs';
import path from 'node:path';
import { IMPECCABLE_COMMAND } from './lib/provider.mjs';

import {
  getConfigPath,
  getLocalConfigPath,
  getCachePath,
  getPendingPath,
  readConfig,
  DEFAULT_CONFIG,
  ensureHookGitExcludes,
  normalizeIgnoreValue,
  normalizeIgnoreValueEntries,
} from './hook-lib.mjs';

const ACTIONS = new Set(['status', 'on', 'off', 'ignore-rule', 'ignore-file', 'ignore-value', 'reset']);
const IMPECCABLE_HOOK_COMMAND_MARKERS = [
  'skills/impeccable/scripts/hook-probe.mjs',
  'skills/impeccable/scripts/hook.mjs',
  'skills/impeccable/scripts/hook-before-edit.mjs',
  'skills/impeccable/scripts/hook-after-edit.mjs',
  'skills/impeccable/scripts/hook-stop.mjs',
];
const TIMEOUT_SECONDS = 5;
const STATUS_MESSAGE = 'Checking UI changes';
// The Stop deep pass scans every UI file touched in the session with the full
// rule set, so it gets a longer budget than the per-edit pass. Only Claude
// Code and Codex dispatch a native Stop hook event, so only those manifests
// carry the entry. Keep these shapes in sync with
// scripts/lib/transformers/hooks.js in the repo.
const STOP_TIMEOUT_SECONDS = 30;
const STOP_STATUS_MESSAGE = 'Design deep pass';

function stopManifestEntry(command) {
  return {
    hooks: [
      {
        type: 'command',
        command,
        timeout: STOP_TIMEOUT_SECONDS,
        statusMessage: STOP_STATUS_MESSAGE,
      },
    ],
  };
}

const HOOK_MANIFEST_TARGETS = [
  {
    provider: '.claude',
    skillRel: '.claude/skills/impeccable',
    destRel: '.claude/settings.local.json',
    sharedDestRel: '.claude/settings.json',
    manifest: () => ({
      description: 'Impeccable design detector: immediate-tier checks after Edit/Write/MultiEdit on UI files, full-rule deep pass on Stop.',
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write|MultiEdit',
            hooks: [
              {
                type: 'command',
                command: 'node "${CLAUDE_PROJECT_DIR}/.claude/skills/impeccable/scripts/hook.mjs"',
                timeout: TIMEOUT_SECONDS,
                statusMessage: STATUS_MESSAGE,
              },
            ],
          },
        ],
        Stop: [stopManifestEntry('node "${CLAUDE_PROJECT_DIR}/.claude/skills/impeccable/scripts/hook.mjs"')],
      },
    }),
  },
  {
    provider: '.agents',
    skillRel: '.agents/skills/impeccable',
    destRel: '.codex/hooks.json',
    manifest: () => ({
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write|apply_patch',
            hooks: [
              {
                type: 'command',
                command: 'node ".agents/skills/impeccable/scripts/hook.mjs"',
                timeout: TIMEOUT_SECONDS,
                statusMessage: STATUS_MESSAGE,
              },
            ],
          },
        ],
        Stop: [stopManifestEntry('node ".agents/skills/impeccable/scripts/hook.mjs"')],
      },
    }),
  },
  {
    provider: '.cursor',
    skillRel: '.cursor/skills/impeccable',
    destRel: '.cursor/hooks.json',
    manifest: () => ({
      version: 1,
      hooks: {
        preToolUse: [
          {
            command: 'node ".cursor/skills/impeccable/scripts/hook-before-edit.mjs"',
            timeout: TIMEOUT_SECONDS,
          },
        ],
      },
    }),
  },
  {
    // GitHub Copilot reads repo-level hooks from `.github/hooks/*.json`. The same
    // manifest is honored by the CLI (once committed to the default branch) and
    // the cloud/app agent. Schema differs: lowercase `postToolUse`, flat entries,
    // `bash`/`timeoutSec`, and a `matcher` regex against the `edit`/`create` tools.
    provider: '.github',
    skillRel: '.github/skills/impeccable',
    destRel: '.github/hooks/impeccable.json',
    manifest: () => ({
      version: 1,
      hooks: {
        postToolUse: [
          {
            type: 'command',
            matcher: 'edit|create|apply_patch',
            bash: 'node "$(git rev-parse --show-toplevel)/.github/skills/impeccable/scripts/hook.mjs"',
            timeoutSec: TIMEOUT_SECONDS,
          },
        ],
      },
    }),
  },
];

function readRawConfigFile(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, malformed: false, raw: null };
  try {
    return { exists: true, malformed: false, raw: JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
  } catch {
    return { exists: true, malformed: true, raw: null };
  }
}

const DETECTOR_CONFIG_KEYS = new Set(['ignoreRules', 'ignoreFiles', 'ignoreValues', 'designSystem', 'advisoryRules']);

function hookSection(unified) {
  return unified && typeof unified === 'object' && !Array.isArray(unified) && unified.hook && typeof unified.hook === 'object' && !Array.isArray(unified.hook)
    ? unified.hook
    : null;
}

function detectorSection(unified) {
  return unified && typeof unified === 'object' && !Array.isArray(unified) && unified.detector && typeof unified.detector === 'object' && !Array.isArray(unified.detector)
    ? unified.detector
    : null;
}

function readRawHookConfig(cwd, opts = {}) {
  const unified = readRawConfigFile(opts.local ? getLocalConfigPath(cwd) : getConfigPath(cwd)).raw;
  return hookSection(unified);
}

function readRawDetectorConfig(cwd, opts = {}) {
  const unified = readRawConfigFile(opts.local ? getLocalConfigPath(cwd) : getConfigPath(cwd)).raw;
  const merged = mergeDetectorConfig(hookSection(unified));
  return mergeDetectorConfig(detectorSection(unified), merged);
}

function stripDetectorKeys(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!DETECTOR_CONFIG_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function pickDetectorKeys(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (DETECTOR_CONFIG_KEYS.has(key)) out[key] = value;
  }
  return out;
}

// Write hook runtime config under `hook`, leaving detector filters in
// `detector` and preserving sibling keys such as updateCheck.
function writeHookConfig(cwd, hookConfig, opts = {}) {
  const filePath = opts.local ? getLocalConfigPath(cwd) : getConfigPath(cwd);
  if (opts.local) ensureHookGitExcludes(cwd);
  const existingRaw = readRawConfigFile(filePath).raw;
  const existing = existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw) ? existingRaw : {};
  const existingHookSection = hookSection(existing);
  const existingHook = stripDetectorKeys(existingHookSection);
  const legacyDetector = pickDetectorKeys(existingHookSection);
  // Merge over the existing hook object so fields the merge helpers don't manage
  // (consent, quiet, auditLog) survive an Impeccable hooks edit.
  const next = { ...existing, hook: { ...existingHook, ...hookConfig } };
  if (Object.keys(legacyDetector).length > 0) {
    const existingDetector = detectorSection(existing) || {};
    next.detector = {
      ...existingDetector,
      ...mergeDetectorConfig(existingDetector, mergeDetectorConfig(legacyDetector)),
    };
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + '\n');
  return filePath;
}

function writeDetectorConfig(cwd, detectorConfig, opts = {}) {
  const filePath = opts.local ? getLocalConfigPath(cwd) : getConfigPath(cwd);
  if (opts.local) ensureHookGitExcludes(cwd);
  const existingRaw = readRawConfigFile(filePath).raw;
  const existing = existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw) ? existingRaw : {};
  const nextHook = stripDetectorKeys(hookSection(existing));
  const existingDetectorSection = detectorSection(existing) || {};
  const existingDetector = mergeDetectorConfig(existingDetectorSection);
  const next = {
    ...existing,
    detector: {
      ...existingDetectorSection,
      ...mergeDetectorConfig(detectorConfig, existingDetector),
    },
  };
  if (Object.keys(nextHook).length > 0) next.hook = nextHook;
  else delete next.hook;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + '\n');
  return filePath;
}

function mergeHookConfig(existing) {
  const base = existing && typeof existing === 'object' ? existing : {};
  return {
    enabled: base.enabled === false ? false : true,
    limits: {
      maxFindings: Number.isFinite(base?.limits?.maxFindings) ? base.limits.maxFindings : DEFAULT_CONFIG.limits.maxFindings,
      maxChars: Number.isFinite(base?.limits?.maxChars) ? base.limits.maxChars : DEFAULT_CONFIG.limits.maxChars,
    },
  };
}

function mergeDetectorConfig(exist
```

### Core Architecture Module: `.agents/skills/impeccable/scripts/hook-before-edit.mjs`
```
#!/usr/bin/env node
/**
 * Impeccable design hook — Cursor preToolUse write gate.
 *
 * Cursor's stop hook is not consistently dispatched by the headless agent, so
 * this hook checks proposed Write/Edit content before it lands. It only denies
 * writes when the real detector finds an issue in the proposed UI content.
 *
 * Contract: never break a turn accidentally. On malformed input or internal
 * errors, allow the tool and exit 0.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ALLOWED_EXTS,
  EDIT_COUNT_THRESHOLD,
  GENERATED_PATH,
  SENSITIVE_PATH,
  appendDesignSystemNote,
  designSystemOptions,
  filterFindings,
  isNativePlatform,
  isScanTargetInsideProject,
  loadDetector,
  matchConfiguredExtension,
  matchesAnyGlob,
  persistCache,
  readCache,
  readConfig,
  renderTemplate,
  resolveCacheCwd,
  resolveProjectCwd,
  resolveProjectPlatform,
  truthy,
  writeAuditLog,
} from './hook-lib.mjs';

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

function done(payload = null) {
  if (payload) process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

function allow(extra = {}, payload = {}) {
  writeAuditLog(process.env, {
    ts: new Date().toISOString(),
    event: 'preToolUse',
    ...extra,
  });
  return done({ permission: 'allow', ...payload });
}

function deny(message, audit) {
  writeAuditLog(process.env, {
    ts: new Date().toISOString(),
    event: 'preToolUse',
    blocked: true,
    ...audit,
  });
  return done({
    permission: 'deny',
    user_message: message,
    agent_message: message,
  });
}

function toolInput(event) {
  return event?.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};
}

function proposedFilePath(event, cwd) {
  const input = toolInput(event);
  const raw = input.file_path || input.path || input.target_file || event?.file_path;
  const candidate = typeof raw === 'string' && raw.trim()
    ? raw
    : shellWriteDestination(shellCommand(input));
  if (typeof candidate !== 'string' || !candidate.trim()) return '';
  return path.isAbsolute(candidate) ? candidate : path.resolve(cwd, candidate);
}

function proposedContent(event, cwd, filePath) {
  const input = toolInput(event);
  for (const key of ['content', 'streamContent', 'text']) {
    if (typeof input[key] === 'string') return input[key];
  }

  const editProjection = projectedEditContent(input, filePath, cwd);
  if (editProjection !== undefined) return editProjection;

  if (hasFragmentEditContent(input)) {
    return { skipped: 'fragment-only-edit' };
  }

  const command = shellCommand(input);
  const pythonContent = shellPythonWriteContent(command);
  if (pythonContent) return pythonContent;
  const shellContent = shellHereDocContent(command);
  if (shellContent) return shellContent;
  const copiedContent = shellCopiedFileContent(command, cwd);
  if (copiedContent) return copiedContent;
  return '';
}

function hasFragmentEditContent(input) {
  if (!input || typeof input !== 'object') return false;
  if (typeof input.new_string === 'string' || typeof input.newString === 'string' || typeof input.new_str === 'string' || typeof input.replacement === 'string') {
    return true;
  }
  return Array.isArray(input.edits) && input.edits.some((edit) => edit && typeof edit === 'object');
}

function projectedEditContent(input, filePath, cwd) {
  if (!filePath) return undefined;
  const singleOld = firstString(input, ['old_string', 'oldString', 'old_str', 'target']);
  const singleNew = firstString(input, ['new_string', 'newString', 'new_str', 'replacement']);
  if (singleOld !== undefined || singleNew !== undefined) {
    if (singleOld === undefined || singleNew === undefined) return { skipped: 'fragment-only-edit' };
    const original = readExistingProjectFile(filePath, cwd);
    if (original === null) return { skipped: 'edit-original-unreadable' };
    const projected = replaceOnce(original, singleOld, singleNew);
    return projected === null ? { skipped: 'edit-old-string-missing' } : projected;
  }

  if (!Array.isArray(input.edits)) return undefined;
  const original = readExistingProjectFile(filePath, cwd);
  if (original === null) return { skipped: 'edit-original-unreadable' };

  let projected = original;
  for (const edit of input.edits) {
    if (!edit || typeof edit !== 'object') return { skipped: 'fragment-only-edit' };
    const oldString = firstString(edit, ['old_string', 'oldString', 'old_str', 'target']);
    const newString = firstString(edit, ['new_string', 'newString', 'new_str', 'replacement']);
    if (oldString === undefined || newString === undefined) return { skipped: 'fragment-only-edit' };
    const next = replaceOnce(projected, oldString, newString);
    if (next === null) return { skipped: 'edit-old-string-missing' };
    projected = next;
  }
  return projected;
}

function firstString(obj, keys) {
  for (const key of keys) {
    if (typeof obj?.[key] === 'string') return obj[key];
  }
  return undefined;
}

function replaceOnce(original, oldString, newString) {
  if (oldString === '') return null;
  const index = original.indexOf(oldString);
  if (index === -1) return null;
  return `${original.slice(0, index)}${newString}${original.slice(index + oldString.length)}`;
}

function readExistingProjectFile(filePath, cwd) {
  if (!isScanTargetInsideProject(filePath, cwd)) return null;
  if (SENSITIVE_PATH.test(filePath) || GENERATED_PATH.test(filePath)) return null;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > 1024 * 1024) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function shellCommand(input) {
  if (typeof input.command === 'string') return input.command;
  if (input.args && typeof input.args.command === 'string') return input.args.command;
  return '';
}

function shellRedirectPath(command) {
  if (!command || typeof command !== 'string') return '';
  const match = command.match(/(?:^|[\s;&|])(?:>>?|1>>?)\s*(?:"([^"]+)"|'([^']+)'|([^<>\s]+))/);
  return (match?.[1] || match?.[2] || match?.[3] || '').trim();
}

function shellWriteDestination(command) {
  return shellRedirectPath(command) || shellTeeDestination(command) || shellCopyPaths(command)?.dest || shellPythonWriteDestination(command) || '';
}

function shellPythonWriteDestination(command) {
  if (!/\bpython(?:3)?\b/.test(command || '')) return '';
  const directPath = firstMatch(command, /(?:^|[^\w.])(?:pathlib\.)?Path\(\s*(["'])(.*?)\1\s*\)\s*\.write_text\s*\(/);
  if (directPath) return directPath;

  const pathsByVar = new Map();
  const assignmentRe = /\b([A-Za-z_]\w*)\s*=\s*(?:pathlib\.)?Path\(\s*(["'])(.*?)\2\s*\)/g;
  let assignment;
  while ((assignment = assignmentRe.exec(command))) {
    pathsByVar.set(assignment[1], assignment[3]);
  }

  const writeVarRe = /\b([A-Za-z_]\w*)\.write_text\s*\(/g;
  let writeVar;
  while ((writeVar = writeVarRe.exec(command))) {
    const candidate = pathsByVar.get(writeVar[1]);
    if (candidate) return candidate;
  }

  return firstMatch(command, /\bopen\(\s*(["'])(.*?)\1\s*,\s*(["'])[wax](?:\+)?b?\3/);
}

function firstMatch(value, re) {
  const match = String(value || '').match(re);
  return (match?.[2] || '').trim();
}

function shellTeeDestination(command) {
  const words = shellWords(command);
  const teeIndex = words.findIndex((word) => path.basename(word) === 'tee');
  if (teeIndex === -1) return '';
  for (const word of words.slice(teeIndex + 1)) {
    if (['&&', '||', ';', '|'].includes(word)) break;
    if (word === '--') continue;
    if (word.startsWith('-')) continue;
    return word;
  }
  return '';
}

function shellCopiedFileContent(command, cwd) {
  const source = shellCopyPaths(command)?.source;
  if (!source) return '';
  const sourcePath = path.isAbsolute(source) ? source : path.resolve(cwd, source);
  if (!isScanTargetInsideProject(sourcePath, cwd)) return '';
  if (SENSITIVE_PATH.test(sourcePath) || GENERATED_PATH.test(sourcePath)) return '';
  try {
    const stat = fs.statSync(sourcePath);
    if (!stat.isFile() || stat.size > 1024 * 1024) return '';
    return fs.readFileSync(sourcePath, 'utf-8');
  } catch {
    return '';
  }
}

function shellCopyPaths(command) {
  const words = shellWords(command);
  if (words.length < 3 || path.basename(words[0]) !== 'cp') return null;
  const args = [];
  for (const word of words.slice(1)) {
    if (['&&', '||', ';', '|'].includes(word)) break;
    if (word === '--') continue;
    if (word.startsWith('-')) continue;
    args.push(word);
  }
  if (args.length < 2) return null;
  return { source: args[args.length - 2], dest: args[args.length - 1] };
}

function shellWords(command) {
  if (!command || typeof command !== 'string') return [];
  const words = [];
  const re = /"((?:\\"|[^"])*)"|'((?:\\'|[^'])*)'|([^\s]+)/g;
  let match;
  while ((match = re.exec(command))) {
    words.push((match[1] ?? match[2] ?? match[3] ?? '').replace(/\\(["'])/g, '$1'));
  }
  return words;
}

function shellHereDocContent(command) {
  if (!command || typeof command !== 'string') return '';
  const markerMatch = command.match(/<<-?\s*['"]?([A-Za-z0-9_.-]+)['"]?[^\r\n]*\r?\n/);
  if (!markerMatch) return '';
  const marker = markerMatch[1];
  const start = (markerMatch.index || 0) + markerMatch[0].length;
  const rest = command.slice(start);
  const endRe = new RegExp(`\\r?\\n${escapeRegExp(marker)}(?:\\r?\\n|$)`);
  const end = rest.search(endRe);
  return end >= 0 ? rest.slice(0, end) : '';
}

function shellPythonWriteContent(command) {
  if (!/\bpython(?:3)?\b/.test(command || '')) return '';
  const script = shellHereDocContent(command) || command;
  return pythonStringArg(script, /\.write_text\s*\(\s*/g) || pythonStringArg(script, /\.write\s*\(\s*/g);
}

function pythonStringArg(script, prefixRe) {
  let prefix;
  
```

### Core Architecture Module: `.agents/skills/impeccable/scripts/hook-lib.mjs`
```
/**
 * Shared library for the Impeccable design hook.
 *
 * Pure-ish helpers split out from `hook.mjs` so unit tests can exercise
 * config parsing, finding filtering, dedup, render, and cache logic without
 * spawning a subprocess. `hook.mjs` itself is the thin stdin/stdout shim.
 *
 * Public surface (everything exported is part of the contract):
 *   ENVELOPE_PREFIX, ALLOWED_EXTS, ACK_EXTS, SENSITIVE_PATH, GENERATED_PATH, TRUTHY
 *   truthy(value)
 *   readConfig(cwd) / DEFAULT_CONFIG / getConfigPath(cwd) / getLocalConfigPath(cwd)
 *   resolveProjectPlatform(cwd) / isNativePlatform(platform)
 *   normalizeIgnoreValue(value)
 *   readCache(cwd) / persistCache(cwd, cache) / resolveCacheCwd(primaryFile, sessionCwd)
 *   bumpEditCount(cache, sessionId, filePath) -> number
 *   touchFile(cache, sessionId, filePath)
 *   suppressionNotice(filePath)
 *   filterFindings(findings, content, ext, config)
 *   ADVISORY_RULES / isAdvisoryFinding(finding)
 *   IMMEDIATE_TIER_RULES / splitFindingsByTier(findings) / perEditTieringActive(config, harness)
 *   matchConfiguredExtension(filePath, extensions)
 *   dedupeAgainstCache(findings, cache, sessionId, filePath)
 *   renderTemplate(findings, filePath, config, opts)
 *   renderCleanAck(filePath, opts) / renderPendingAck(filePath, known, opts)
 *   shouldEmitAckForFile(filePath, config?)
 *   writeAuditLog(env, entry)
 *   loadDetector() -> Promise<{ detectText, detectHtml }>
 *   matchesAnyGlob(filePath, globs)
 *   normalizeScanTargets(primaryTargets, projectCwd)
 *   runHook(deps) -> { exitCode, stdout, audit, reason? }
 *   runStopHook(deps) -> { exitCode, stdout, audit, emission? }
 *
 * Design notes:
 * - All errors are swallowed at the runHook seam. The detector throwing must
 *   never break a turn. See PRD §5 "Failure modes".
 * - Cache shape is JSON-friendly; we gc the oldest sessions when there are
 *   more than 8 to keep file size predictable across long-lived projects.
 * - The detector loader looks for `detector/detect-antipatterns.mjs` next to
 *   this file first (built skill layout) and falls back to the repo root's
 *   `cli/engine/detect-antipatterns.mjs` (running from source).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { extractPlatform, loadContext } from './context.mjs';
import { IMPECCABLE_COMMAND } from './lib/provider.mjs';
// `detector.extensions` (issue #316) is shared with Live's source search, which
// needs the same answer for `.heex` / `.blade.php` when it hunts for session
// markers. lib/template-extensions.mjs owns the shape; re-exported here because
// hook-lib has been the import site for matchConfiguredExtension since #347.
import {
  matchConfiguredExtension,
  mergeExtensions,
} from './lib/template-extensions.mjs';

export { matchConfiguredExtension };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ENVELOPE_PREFIX = '[impeccable@1]';

export const ALLOWED_EXTS = new Set([
  '.tsx', '.jsx', '.html', '.htm', '.vue', '.svelte', '.astro',
  '.css', '.scss', '.sass', '.less', '.ts', '.js',
]);

export const ACK_EXTS = new Set([
  '.tsx', '.jsx', '.html', '.htm', '.vue', '.svelte', '.astro',
  '.css', '.scss', '.sass', '.less',
]);

// Hard-skip regex for sensitive files. Cannot be turned off via config.
// Match tokenized secret/credential filenames, not UI names such as
// CredentialForm.tsx, SecretPage.jsx, or secretary-dashboard.vue.
export const SENSITIVE_PATH = new RegExp([
  String.raw`(?:^|[/\\])\.env(?:\.|$)`,
  String.raw`(?:^|[/\\])\.git(?:[/\\]|$)`,
  String.raw`(?:^|[/\\])id_rsa(?:$|[._-])[^/\\]*$`,
  String.raw`(?:^|[/\\])[^/\\]*\.pem$`,
  String.raw`(?:^|[/\\])(?:[^/\\]*[._-])?(?:secret|secrets|credential|credentials)(?=[._-])[^/\\]*\.(?:json|ya?ml|toml|ini|conf|config|env|txt|key|cert|crt|pem|js|ts)$`,
].join('|'), 'i');

// Hard-skip regex for generated, lock, minified, and build-output paths.
// `generated` is matched as a whole path segment so authored names such as
// `generated-utils.ts` or `CodeGenerator.tsx` still get scanned.
export const GENERATED_PATH = /(?:\.generated\.[a-z]+$|\.d\.ts$|\.min\.[a-z]+$|[/\\]node_modules[/\\]|[/\\]generated[/\\]|[/\\](?:dist|build|out|\.next|\.cache|coverage)[/\\]|[/\\]?[^/\\]+\.lock(?:\.json)?$)/i;

export const TRUTHY = /^(1|true|yes|on)$/i;

// ── Two-tier rule surfacing ──────────────────────────────────────────────
// The per-edit PostToolUse pass surfaces only this "immediate" tier: rules
// that are mechanical, unambiguous, and worth interrupting an edit for —
// broken output the user would see (broken images, overflow, clipped
// popovers, text on the viewport edge), objective contrast/legibility
// failures, single-property slop that is trivial to fix in place (gradient
// text, glow shadows), and design-system drift (which compounds with every
// further edit if left uncorrected). Everything else — copy-cadence rules,
// palette/typography taste, layout rhythm — is deferred to the Stop-event
// deep pass (`runStopHook`), which runs the FULL rule set over every file
// touched this session and surfaces the remainder once.
//
// Rationale (measured in the eval harness): the per-edit stream fires
// overwhelmingly on copy-level rules, and that steady nag stream makes
// models more conservative, while a single full pass at completion fixes
// contrast/padding/glow just as reliably. Restore the old full per-edit
// behavior with `.impeccable/config.json` → `hook: { "perEditRules": "all" }`.
export const IMMEDIATE_TIER_RULES = new Set([
  // Broken output.
  'broken-image',
  'text-overflow',
  'clipped-overflow-container',
  'body-text-viewport-edge',
  // Objective contrast / legibility failures.
  'low-contrast',
  'gray-on-color',
  'tiny-text',
  // Single-property mechanical slop, trivial to fix at the edit site.
  'gradient-text',
  'dark-glow',
  // Design-system drift compounds if not corrected at edit time.
  'design-system-font',
  'design-system-color',
  'design-system-radius',
  'design-system-font-size',
]);

// ── Advisory rules ────────────────────────────────────────────────────────
// Advisory rules are opt-in noise: the CLI reports them in a separate section
// and they never count as failures. The design hook skips them entirely by
// default — in both the per-edit PostToolUse pass and the Stop deep pass — so
// the agent is never nagged about a taste call a human might make on purpose.
// A project opts back in with `.impeccable/config.json`:
//   { "detector": { "advisoryRules": "include" } }
// This set is the hook's own copy of the registry's `advisory: true` rules,
// mirroring how IMMEDIATE_TIER_RULES lists rule ids inline so the hook stays
// self-contained and testable without loading the detector. Keep it in sync
// with the registry (cli/engine/registry/antipatterns.mjs).
export const ADVISORY_RULES = new Set([
  'em-dash-overuse',
]);

export function isAdvisoryFinding(finding) {
  const id = finding && normalizeIgnoreRule(finding.antipattern);
  return Boolean(id && (ADVISORY_RULES.has(id) || finding.advisory === true));
}

export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  quiet: false,
  auditLog: null,
  designSystem: { enabled: true },
  ignoreRules: [],
  ignoreFiles: [],
  ignoreValues: [],
  extensions: [],
  perEditRules: 'immediate',
  // Advisory rules are skipped unless a project sets detector.advisoryRules to
  // "include". See ADVISORY_RULES above.
  advisoryRules: 'exclude',
  // maxFileBytes: not every generated artifact lives under a path we can
  // recognize. Committed browser bundles and vendored detector copies sit
  // next to source and run 200KB+, while genuinely authored stylesheets in
  // this codebase top out under 90KB. A single file past the ceiling is a
  // bundle, and findings against a bundle are never actionable.
  limits: { maxFindings: 5, maxChars: 8000, maxFileBytes: 131072 },
});

export const HOOK_LOCAL_IGNORE_PATTERNS = Object.freeze([
  '.impeccable/hook.cache.json',
  '.impeccable/hook.pending.json',
  '.impeccable/config.local.json',
]);

const HOOK_IGNORE_MARKER_OPEN = '# impeccable-hook-ignore-start';
const HOOK_IGNORE_MARKER_CLOSE = '# impeccable-hook-ignore-end';
const CACHE_MAX_SESSIONS = 8;
export const EDIT_COUNT_THRESHOLD = 6;

export function truthy(value) {
  return typeof value === 'string' && TRUTHY.test(value);
}

function depthIsSet(value) {
  if (value === undefined || value === null) return false;
  const text = String(value).trim();
  if (!text) return false;
  if (TRUTHY.test(text)) return true;
  return /^\d+$/.test(text) && Number(text) > 0;
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function getConfigPath(cwd) {
  return path.join(cwd, '.impeccable', 'config.json');
}

export function getLocalConfigPath(cwd) {
  return path.join(cwd, '.impeccable', 'config.local.json');
}

export function getCachePath(cwd) {
  return path.join(cwd, '.impeccable', 'hook.cache.json');
}

export function getPendingPath(cwd) {
  return path.join(cwd, '.impeccable', 'hook.pending.json');
}

export function resolveProjectCwd(event, fallback = process.cwd()) {
  return event?.cwd
    || (Array.isArray(event?.workspace_roots) && event.workspace_roots[0])
    || envProjectDir(fallback)
    || fallback;
}

function looksLikeProjectRoot(dir) {
  return ['.git', 'package.json', '.impeccable'].some((marker) => {
    try { return fs.existsSync(path.join(dir, marker)); } catch { return false; }
  });
}

// Where `.impeccable/` (cache + config) lives for this event. Normally the
// session cwd, untouched. But when the agent was launched from an umbrella
// directory that is not itself a project (no .git, package.json, or
// .impeccable), key to the edited file's nearest project root instead, so a
// multi-project launch dir doe
```

### Core Architecture Module: `.agents/skills/impeccable/scripts/hook.mjs`
```
#!/usr/bin/env node
/**
 * Impeccable design hook — PostToolUse + Stop entry point.
 *
 * Reads the Claude Code / Codex / Cursor hook event from stdin and routes by
 * `hook_event_name`:
 *
 *   - PostToolUse: runs the immediate-tier detector rules against the touched
 *     file and emits a system reminder via
 *     `hookSpecificOutput.additionalContext` when findings exist.
 *   - Stop: runs the FULL detector rule set over every UI file touched this
 *     session (the deep pass), deduped against what the per-edit pass already
 *     surfaced, and emits once via the Stop additionalContext channel.
 *
 * Contract: never break a turn. Always exit 0. Clean files emit a small ack
 * unless quiet mode is enabled; a clean Stop pass is silent.
 *
 * Most logic lives in `hook-lib.mjs` so it is unit-testable without a
 * subprocess. This file is the thin stdin/stdout adapter.
 */

import { runHook, runStopHook, writeAuditLog } from './hook-lib.mjs';

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

function isStopEvent(stdinJson) {
  try {
    const event = JSON.parse(stdinJson);
    return event && typeof event === 'object' && event.hook_event_name === 'Stop';
  } catch {
    // Malformed stdin falls through to runHook, which audits the skip.
    return false;
  }
}

async function main() {
  // Snapshot the inherited env FIRST so the re-entrancy guard checks the
  // parent's value, not the value we are about to export for any child
  // processes the hook might ever spawn.
  const inheritedEnv = { ...process.env };
  process.env.IMPECCABLE_HOOK_DEPTH = process.env.IMPECCABLE_HOOK_DEPTH || '1';

  let stdinJson = '';
  try { stdinJson = await readStdin(); } catch { /* fall through */ }

  const run = isStopEvent(stdinJson) ? runStopHook : runHook;
  const result = await run({
    stdinJson,
    env: inheritedEnv,
    cwd: process.cwd(),
  });

  writeAuditLog(process.env, result.audit, process.cwd());

  if (result.stdout) process.stdout.write(result.stdout);
  process.exit(result.exitCode || 0);
}

main().catch((err) => {
  // Last-ditch: never break the agent's turn even if something we did not
  // anticipate goes wrong. Audit-log the failure if logging is enabled.
  try {
    writeAuditLog(process.env, {
      ts: new Date().toISOString(),
      event: 'hook-error',
      error: String(err && err.message ? err.message : err),
    });
  } catch { /* swallow */ }
  if (process.env.IMPECCABLE_HOOK_DEBUG) {
    process.stderr.write(`[impeccable-hook] ${err}\n`);
  }
  process.exit(0);
});

```

### Core Architecture Module: `.agents/skills/impeccable/scripts/live/frameworks/detect-utils.mjs`
```
/**
 * Small read-only probes the framework entries share.
 *
 * Every helper here is cheap and failure-tolerant: detection runs on every
 * inject, against project trees that may be half-installed, so a missing or
 * malformed file means "not this framework", never a throw.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Merged dependency names from package.json, or an empty object. */
export function readPackageDeps(cwd) {
  const file = path.join(cwd, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.peerDependencies || {}),
    };
  } catch {
    return {};
  }
}

export function hasAnyDependency(cwd, names) {
  const deps = readPackageDeps(cwd);
  return names.some((name) => Boolean(deps[name]));
}

/** First top-level file name matching `re`, or null. */
export function findConfigFile(cwd, re) {
  try {
    return fs.readdirSync(cwd, { withFileTypes: true })
      .find((entry) => entry.isFile() && re.test(entry.name))
      ?.name ?? null;
  } catch {
    return null;
  }
}

export function fileExists(cwd, rel) {
  try {
    return fs.existsSync(path.join(cwd, rel));
  } catch {
    return false;
  }
}

export function firstExistingFile(cwd, candidates) {
  for (const rel of candidates) {
    if (fileExists(cwd, rel)) return rel;
  }
  return null;
}

/**
 * Literal (non-glob) entries of `config.files` that exist on disk. Several
 * detectors read the configured injection target as a signal, which is how the
 * bare fixtures — a tree of `.astro` files with no astro.config — still resolve
 * to the framework that authored them.
 */
export function literalConfigFiles(cwd, config) {
  const files = Array.isArray(config?.files) ? config.files : [];
  const out = [];
  for (const rel of files) {
    if (typeof rel !== 'string' || rel.includes('*') || rel.includes('?')) continue;
    const normalized = rel.split(path.sep).join('/');
    if (fileExists(cwd, normalized)) out.push(normalized);
  }
  return out;
}

```

### Core Architecture Module: `.agents/skills/impeccable/scripts/live/ui-core.mjs`
```
/**
 * Framework-neutral Impeccable live chrome contract.
 *
 * The production browser bundle is intentionally plain DOM so Svelte, React,
 * Vue, and static adapters can all mount the same chrome. This module is the
 * testable contract/inventory for that bundle; live-browser.js mirrors these
 * values at runtime because it is served as a standalone script.
 */

export const LIVE_CHROME_MOUNT_CONTRACT = Object.freeze([
  'root',
  'transport',
  'state',
  'actions',
]);

export const LIVE_UI_SURFACES = Object.freeze([
  {
    key: 'global-bottom-bar',
    ids: [
      'impeccable-live-global-bar',
      'impeccable-live-global-bar-brand',
      'impeccable-live-pick-toggle',
      'impeccable-live-insert-toggle',
      'impeccable-live-detect-toggle',
      'impeccable-live-detect-badge',
      'impeccable-live-design-toggle',
      'impeccable-live-page-chat',
      'impeccable-live-page-chat-input',
      'impeccable-live-page-chat-voice',
    ],
    states: ['rest', 'hover', 'focus-visible', 'pressed', 'active', 'tooltip'],
  },
  {
    key: 'pending-copy-edit-dock',
    ids: ['impeccable-live-pending-dock'],
    states: ['closed', 'open', 'hover', 'pressed', 'loading', 'rollback', 'keep-fixing'],
  },
  {
    key: 'element-selection-chrome',
    ids: [
      'impeccable-live-highlight',
      'impeccable-live-tooltip',
      'impeccable-live-bar',
      'impeccable-live-selection-pill',
      'impeccable-live-input',
      'impeccable-live-configure-voice',
      'impeccable-live-configure-bar-tooltip',
    ],
    states: ['rest', 'hover', 'focus-visible', 'pressed', 'disabled'],
  },
  {
    key: 'action-picker',
    ids: ['impeccable-live-picker'],
    states: ['closed', 'open', 'option-hover', 'option-focus'],
  },
  {
    key: 'edit-chrome',
    ids: ['impeccable-live-edit-badge'],
    states: ['enabled', 'disabled', 'editing', 'cancel', 'save', 'edited-content'],
  },
  {
    key: 'generating-row',
    ids: ['impeccable-live-bar', 'impeccable-live-shader'],
    states: ['action-label', 'animated-dots', 'generating', 'done'],
  },
  {
    key: 'variant-cycling-row',
    ids: ['impeccable-live-bar', 'impeccable-live-params-panel'],
    states: ['variant-1', 'variant-2', 'variant-3', 'left-disabled', 'right-disabled', 'dot-click', 'accept', 'discard'],
  },
  {
    key: 'variant-params-panel',
    ids: ['impeccable-live-params-panel'],
    states: ['closed', 'open-above', 'open-below', 'range', 'steps', 'toggle'],
  },
  {
    key: 'saving-confirmed-rows',
    ids: ['impeccable-live-bar'],
    states: ['saving', 'applying-variant', 'confirmed'],
  },
  {
    key: 'insert-mode-chrome',
    ids: [
      'impeccable-live-insert-line',
      'impeccable-live-insert-placeholder',
      'impeccable-live-placeholder-resize',
      'impeccable-live-insert-input',
      'impeccable-live-insert-voice',
      'impeccable-live-insert-create',
      'impeccable-live-insert-create-tooltip',
    ],
    states: ['toggle-active', 'line', 'placeholder', 'resize', 'enabled', 'disabled', 'tooltip'],
  },
  {
    key: 'annotation-chrome',
    ids: [
      'impeccable-live-annot',
      'impeccable-live-annot-svg',
      'impeccable-live-annot-pins',
      'impeccable-live-annot-clear',
    ],
    states: ['overlay', 'drawing', 'pin', 'pin-edit', 'clear'],
  },
  {
    key: 'design-system-panel',
    ids: ['impeccable-live-design-host'],
    states: ['closed', 'open', 'tabs', 'token-tiles', 'copy'],
  },
  {
    key: 'toasts-and-errors',
    ids: ['impeccable-live-toast'],
    states: ['normal', 'error', 'no-variants-mounted'],
  },
  {
    key: 'css-isolation-boundary',
    ids: ['impeccable-live-root'],
    states: ['shadow-root', 'style-tags', 'hostile-css'],
  },
]);

export const LIVE_UI_COMPONENT_IDS = Object.freeze([
  ...new Set(LIVE_UI_SURFACES.flatMap((surface) => surface.ids)),
]);

export function resolveLiveUiRoot(env = globalThis) {
  const doc = env?.document;
  const explicit = env?.__IMPECCABLE_LIVE_UI_ROOT__
    || env?.window?.__IMPECCABLE_LIVE_UI_ROOT__;
  if (explicit && typeof explicit.appendChild === 'function') return explicit;
  return doc?.body || null;
}

export function getLiveUiElementById(id, env = globalThis) {
  const doc = env?.document;
  const root = resolveLiveUiRoot(env);
  if (!id) return null;
  if (root?.getElementById) {
    const found = root.getElementById(id);
    if (found) return found;
  }
  if (root?.querySelector) {
    const found = root.querySelector('#' + escapeCssIdent(id));
    if (found) return found;
  }
  return doc?.getElementById?.(id) || null;
}

export function appendToLiveUiRoot(el, env = globalThis) {
  const root = resolveLiveUiRoot(env);
  if (!root) throw new Error('Impeccable live UI root is not available');
  root.appendChild(el);
  return el;
}

export function appendStyleToLiveUiRoot(styleEl, env = globalThis) {
  const doc = env?.document;
  const root = resolveLiveUiRoot(env);
  if (root && root !== doc?.body) {
    root.appendChild(styleEl);
  } else {
    (doc?.head || doc?.body || root).appendChild(styleEl);
  }
  return styleEl;
}

export function activeElementDeep(doc = globalThis.document) {
  let active = doc?.activeElement || null;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

function escapeCssIdent(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(String(value));
  }
  return String(value).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1004** (2026-05-21): **[BUG] - Since version 0.106.0, it has been impossible to start the whodb application using Docker.**
  *Symptoms*: **Describe the bug** Since **WhoDB v0.107.0**, it has been impossible to start the application using Docker.  Version **0.106.0** works normally, but after upgrading to **0.107.0 or later (tested on 0.109.0)**, the container continuously restarts or exits immediately, making the application unusable.  At first, I thought this was caused by my custom Docker Compose configuration, but even when using the official Docker run command, the container still fails to stay running.  ---  **To Reproduce**  ### Method 1: Docker Compose  Use the following `docker-compose.yml`:  ```yaml networks:     1panel-network:         external: true  services:     whodb:         container_name: ${CONTAINER_NAME}         deploy:             resources:                 limits:                     cpus: ${CPUS}                     memory: ${MEMORY_LIMIT}         environment:             - WHODB_AI_GENERIC_GLM_NAME="glm"             - WHODB_AI_GENERIC_GLM_API_KEY=${PANEL_WHODB_OPENAI_API_KEY}             - WHODB_AI_GENERIC_GLM_BASE_URL=${PANEL_WHODB_OPENAI_ENDPOINT}             - WHODB_AI_GENERIC_GLM_MODELS=${PANEL_WHODB_CUSTOM_MODELS}             # - WHODB_ANTHROPIC_API_KEY=${PANEL_WHODB_ANTHROPIC_API_KEY}             # - WHODB_ANTHROPIC_ENDPOINT=${PANEL_WHODB_ANTHROPIC_ENDPOINT}             # - WHODB_OLLAMA_HOST=${PANEL_WHODB_OLLAMA_HOST}             # - WHODB_OLLAMA_PORT=${PANEL_WHODB_OLLAMA_PORT}         image: clidey/whodb:0.109.0         labels:             createdBy: Apps         networks:        
  **Post-Mortem & Fix Analysis**:
  > Hi @willow-god , are you able to try the latest version 0.110.0? I didn't have any issue with that
  > @modelorona Hello, thank you for your response and the update.  I have tested again with version 0.110.0, but the issue still persists and the application still cannot start.  After further investigation, I confirmed the following:  ### Environment  * Host OS: Linux (x86_64) * Docker image: `clidey/whodb` * Architecture: x86_64 (confirmed via `uname -m`)  ---  ### Observed behavior  When running the container:  ```bash docker run -it -p 8080:8080 clidey/whodb ```  The container immediately restarts or exits without any logs.  Inspecting the container shows that the entrypoint is:  ``` /core ```  Inside the container, `/core` exists and is executable:  ```bash -rwxr-xr-x 1 root root 18.0M /core ```  However, executing it manually results in a crash:  ```bash /core Trace/breakpoint trap (core dumped) ```  ---  ### Further investigation  The binary is detected as:  ``` ELF 64-bit LSB executable, x86-64, statically linked, stripped ```  The container uses Alpine Linux (musl libc):  ``` Alp
  > I wasn't able to replicate it on my mac or windows. I do have a linux laptop and will try there. Thank you for all of the debugging information!

- **Issue #956** (2026-05-08): **[BUG] - CLI update notice prints the wrong version comparison**
  *Symptoms*: **Describe the bug** The current update message prints `latestVersion -> update URL` instead of `currentVersion -> latestVersion`. The notice is malformed even when it is correct that an update exists.  **To Reproduce** 1. Trigger an update-available result. 2. Read the printed notice. 3. Observe that the comparison does not show the installed version.  **Expected behavior** The notice should clearly display current version, latest version, and where to upgrade.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: CLI environment  - How you're running WhoDB: CLI  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: CLI  Evidence: - `cli/cmd/root.go:94-95`  Acceptance Criteria: - Notice format is corrected. - Current and latest versions are both present. - The upgrade URL is presented separately from the version comparison. - Add a focused test if practical. 
  **Post-Mortem & Fix Analysis**:
  > Hi @modelcrona! I'd love to pick this up. I see the exact spot in `cli/cmd/root.go:94-95`.  Could you please assign this to me? I can have a PR ready shortly!
  > @krasilovalex done

- **Issue #955** (2026-05-13): **[BUG] - CLI update-check side effects still run for non-interactive and machine-readable commands**
  *Symptoms*: **Describe the bug** The global `PersistentPostRun` update check only skips trivial invocations like help/version/completion. That still allows update notices to appear on non-interactive and machine-readable commands, which is noisy for scripts and tooling.  **To Reproduce** 1. Run JSON/NDJSON/CSV-oriented commands in a scripted or non-interactive environment. 2. Hit a case where the update check runs. 3. Observe stderr output unrelated to the command result.  **Expected behavior** Automation-oriented commands should not emit update notices unless explicitly requested.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: CLI environment  - How you're running WhoDB: CLI  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: CLI  Evidence: - `cli/cmd/root.go:90-96` - `cli/cmd/root.go:197-221` - `cli/cmd/output_helpers.go:32-50`  Acceptance Criteria: - Update checks are skipped for non-interactive and machine-readable commands by default. - Existing `--no-update-check` behavior still works. - TUI users still see update prompts as before. - Suppression rules are documented and covered by a focused test. 
  **Post-Mortem & Fix Analysis**:
  > Hi @modelorona , I would like to take this issue. Could you please assign this to me?
  > @dhimanAbhi done

- **Issue #954** (2026-05-08): **[BUG] - CLI docs and help text drift on the editor clear keybinding**
  *Symptoms*: **Describe the bug** At least one documented shortcut still drifts from the implementation: the README says `Ctrl+L` clears the editor, while the root help text uses `Ctrl+L` for layout cycling and the actual editor keymap binds clear to `Alt+L`.  **To Reproduce** 1. Read the CLI README editor keybinding table. 2. Read the root command help text. 3. Compare both against the actual TUI keymap. 4. Observe that the editor clear binding is documented inconsistently.  **Expected behavior** README/help text should match the implemented keymap.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: CLI environment  - How you're running WhoDB: CLI  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: CLI  Evidence: - `cli/README.md:892-899` - `cli/cmd/root.go:45-46` - `cli/internal/tui/keymap.go:381-383`  Acceptance Criteria: - README keybinding tables match the implemented keymap. - Root command help does not advertise conflicting shortcuts. - Editor clear is documented consistently with the implementation, or the implementation is changed to match the chosen docs. - Add a lightweight doc-validation check or checklist if practical. 
  **Post-Mortem & Fix Analysis**:
  > Hi, I've observed the issue described above and confirmed that the keybind for clearing the editor is Alt+L and made a commit to update the CLI README accordingly. This clarifies how to clear the editor, and Ctrl+L for layout cycling is unchanged.  If this change is sufficient, I can make a PR. Otherwise, would be open to discuss if any other changes are required.
  > @SSSM0602 sure thing it's a small enough change please feel free to open a PR and I can review

- **Issue #953** (2026-05-13): **[BUG] - Table action shortcuts are disabled on empty result sets**
  *Symptoms*: **Describe the bug** The table keyboard handler exits early when `paginatedRows.length === 0`. That blocks table-level actions like refresh, import, and export even when those actions should still be available with an empty dataset.  **To Reproduce** 1. Open a table with zero visible rows. 2. Try refresh, import, and export shortcuts. 3. Observe that nothing happens because the handler returns before action shortcuts are checked.  **Expected behavior** Row-navigation shortcuts can be disabled on empty tables, but table-level actions should still work when they are otherwise supported.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: N/A  - How you're running WhoDB: Source-reviewed frontend issue  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: Frontend CE  Evidence: - `frontend/src/components/table.tsx:927-938` - `frontend/src/components/table.tsx:960-985`  Acceptance Criteria: - Refresh works with zero rows. - Import works with zero rows when supported. - Export behavior is explicitly defined for empty tables. - Row-navigation shortcuts remain safe no-ops when there are no rows. - Add focused component coverage for the empty-dataset path. 
  **Post-Mortem & Fix Analysis**:
  > @modelorona  hey, i have opened a PR for this.

- **Issue #952** (2026-05-08): **[BUG] - Desktop import action is documented in frontend but not wired through the Wails menu**
  *Symptoms*: **Describe the bug** The frontend listens for `menu:trigger-import`, and shortcut help documents import, but the Wails menu/event bridge never emits an import event or defines an import accelerator.  **To Reproduce** 1. Open the desktop app on a table view that supports import. 2. Open shortcut help or inspect the app menu. 3. Try to trigger import from the desktop menu layer. 4. Observe that import is not available from the Wails menu/event bridge.  **Expected behavior** Documented desktop shortcuts and menu actions should exist and should dispatch the matching frontend event.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: Desktop CE / Wails  - How you're running WhoDB: Desktop app  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: Desktop CE  Evidence: - `frontend/src/components/table.tsx:843-855` - `frontend/src/components/keyboard-shortcuts-help.tsx:123-133` - `frontend/src/utils/shortcuts.ts:25-28` - `desktop-common/app.go:373-409` - `frontend/src/hooks/useDesktop.ts:140-186`  Acceptance Criteria: - Desktop menu includes Import where it is valid to trigger it. - The desktop bridge emits `menu:trigger-import`. - Frontend shortcut docs and desktop menu accelerators stay in sync. - Add a parity test or equivalent coverage if practical. 
  **Post-Mortem & Fix Analysis**:
  > Hey! I would like to work on this issue.
  > @PMota173 assigned!

- **Issue #951** (2026-07-20): **[BUG] - JSON preview throws on invalid JSON instead of showing a local validation state**
  *Symptoms*: **Describe the bug** The editor's JSON preview path still calls `JSON.parse(value)` during render. Invalid JSON can throw and trip the top-level error boundary instead of showing a local validation message.  **To Reproduce** 1. Open a JSON editor view. 2. Enter invalid JSON. 3. Switch to preview. 4. Observe that the page can crash instead of showing an inline preview error.  **Expected behavior** Invalid JSON should show a local preview error state, not crash the app shell.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: N/A  - How you're running WhoDB: Source-reviewed frontend issue  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: Frontend CE  Evidence: - `frontend/src/components/editor.tsx:377-397`  Acceptance Criteria: - Preview mode never throws for malformed JSON. - Invalid JSON shows a readable local validation message. - The error boundary is not triggered by malformed preview input. - Valid JSON preview still renders as before. 

- **Issue #950** (2026-05-08): **[BUG] - Chat SSE parser still loses or corrupts chunk-split events**
  *Symptoms*: **Describe the bug** The chat stream parser still splits each network read on `\n` and parses `data:` lines immediately. It does not buffer incomplete lines across reads, so valid SSE frames can be split across chunks and produce parse errors or missing updates.  **To Reproduce** 1. Send a prompt that produces a long streaming response. 2. Simulate or observe network chunking where an SSE frame is split across `reader.read()` boundaries. 3. Watch for `Failed to parse SSE data` errors and compare the rendered output with the expected stream contents.  **Expected behavior** Streaming should buffer partial SSE lines across reads and reconstruct frames before parsing.  **Screenshots** N/A  **Desktop (please complete the following information):**  - OS that WhoDB is running on: N/A  - How you're running WhoDB: Source-reviewed frontend issue  - Browser: N/A  - Version: N/A  **Smartphone (please complete the following information):**  - Device: N/A  - OS: N/A  - Browser: N/A  - Version: N/A  **Additional context** Area: Frontend CE  Evidence: - `frontend/src/pages/chat/chat.tsx:493-507` - `frontend/src/pages/chat/chat.tsx:509-597`  Acceptance Criteria: - Partial SSE lines are buffered across reads. - Split `event:` and `data:` lines are handled correctly. - No parse errors occur for valid split frames. - Add focused coverage for chunk-split event delivery. 

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

### Incident Patch 1: `06bf7285` (2026-10-03)
**Commit Message**: feat(frontend): fix up icons in ce

**File**: `frontend/src/assets/whodb-icons/accordion.svg` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
+  <path d="M6.31 3.75H17.69C19.33 3.75 20.25 4.67 20.25 6.31V7.69C20.25 9.33 19.33 10.25 17.69 10.25H6.31C4.67 10.25 3.75 9.33 3.75 7.69V6.31C3.75 4.67 4.67 3.75 6.31 3.75zM6.31 13H17.69C19.33 13 20.25 13.92 20.25 15.56V17.69C20.25 19.33 19.33 20.25 17.69 20.25H6.31C4.67 20.25 3.75 19.33 3.75 17.69V15.56C3.75 13.92 4.67 13 6.31 13zM14.75 6.25l1.25 1.25 1.25-1.25"></path>
+</svg>
\ No newline at end of file
```

**File**: `frontend/src/assets/whodb-icons/account.svg` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
+  <path d="M8.25 8.25a3.75 3.75 0 1 0 7.5 0a3.75 3.75 0 1 0 -7.5 0M4.75 20c.9-3.35 3.8-5.5 7.25-5.5s6.35 2.15 7.25 5.5"></path>
+</svg>
\ No newline at end of file
```

**File**: `frontend/src/assets/whodb-icons/aggregate.svg` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
+  <path d="M5.91 12H6.59C7.49 12 8 12.51 8 13.41V18.34C8 19.24 7.49 19.75 6.59 19.75H5.91C5.01 19.75 4.5 19.24 4.5 18.34V13.41C4.5 12.51 5.01 12 5.91 12zM11.66 4.75H12.34C13.24 4.75 13.75 5.26 13.75 6.16V18.34C13.75 19.24 13.24 19.75 12.34 19.75H11.66C10.76 19.75 10.25 19.24 10.25 18.34V6.16C10.25 5.26 10.76 4.75 11.66 4.75zM17.41 9H18.09C18.99 9 19.5 9.51 19.5 10.41V18.34C19.5 19.24 18.99 19.75 18.09 19.75H17.41C16.51 19.75 16 19.24 16 18.34V10.41C16 9.51 16.51 9 17.41 9z"></path>
+</svg>
\ No newline at end of file
```

**File**: `frontend/src/assets/whodb-icons/ai.svg` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
+  <path d="M11 3.5c.4 3.9 2.6 6.1 6.5 6.5-3.9.4-6.1 2.6-6.5 6.5-.4-3.9-2.6-6.1-6.5-6.5 3.9-.4 6.1-2.6 6.5-6.5zM18.5 15.5c.15 1.4.85 2.1 2.25 2.25-1.4.15-2.1.85-2.25 2.25-.15-1.4-.85-2.1-2.25-2.25 1.4-.15 2.1-.85 2.25-2.25z"></path>
+</svg>
\ No newline at end of file
```

**File**: `frontend/src/assets/whodb-icons/alert-circle.svg` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
+  <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 7.75V13"></path>
+  <path d="M10.95 16.1a1.05 1.05 0 1 0 2.1 0a1.05 1.05 0 1 0 -2.1 0" fill="currentColor" stroke="none"></path>
+</svg>
\ No newline at end of file
```

**File**: `frontend/src/assets/whodb-icons/app.svg` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
+  <path d="M7.16 4.5H16.84C19.5 4.5 21 6 21 8.66V15.34C21 18 19.5 19.5 16.84 19.5H7.16C4.5 19.5 3 18 3 15.34V8.66C3 6 4.5 4.5 7.16 4.5zM3 9h18"></path>
+  <path d="M5.15 6.75a0.75 0.75 0 1 0 1.5 0a0.75 0.75 0 1 0 -1.5 0M7.55 6.75a0.75 0.75 0 1 0 1.5 0a0.75 0.75 0 1 0 -1.5 0M9.95 6.75a0.75 0.75 0 1 0 1.5 0a0.75 0.75 0 1 0 -1.5 0" fill="currentColor" stroke="none"></path>
+</svg>
\ No newline at end of file
```

**File**: `frontend/src/assets/whodb-icons/arrow-down-circle.svg` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
+  <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 7.75v8.5M8.25 12.75L12 16.5l3.75-3.75"></path>
+</svg>
\ No newline at end of file
```

**File**: `frontend/src/assets/whodb-icons/arrow-right-circle.svg` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
+  <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M7.75 12h8.5M12.75 8.25L16.5 12l-3.75 3.75"></path>
+</svg>
\ No newline at end of file
```

---

### Incident Patch 2: `11837b7b` (2026-10-03)
**Commit Message**: feat(frontend): fix up loading

**File**: `frontend/src/app.tsx` (modified, +3/-2)
```diff
@@ -38,6 +38,7 @@ import {ServerDownOverlay, DatabaseDownOverlay} from "./components/health/health
 import {HealthActions} from "./store/health";
 import {PageTitleUpdater} from "./hooks/use-page-title";
 import {getEdition} from "./config/edition";
+import {LoadingPage} from "./components/loading";
 
 export const App = () => {
     const [updateSettings] = useMutation(UpdateSettingsDocument);
@@ -179,9 +180,9 @@ export const App = () => {
               const scopedRoutes = getRegisteredScopedRoutes();
               if (layout && scopedRoutes.length > 0) {
                 return (
-                  <Route path={layout.pathPattern} element={<Suspense fallback={null}><layout.lazyComponent /></Suspense>}>
+                  <Route path={layout.pathPattern} element={<Suspense fallback={<LoadingPage />}><layout.lazyComponent /></Suspense>}>
                     {scopedRoutes.map(route => (
-                      <Route key={route.path} path={route.path} element={<Suspense fallback={null}><route.lazyComponent /></Suspense>} />
+                      <Route key={route.path} path={route.path} element={<Suspense fallback={<LoadingPage />}><route.lazyComponent /></Suspense>} />
                     ))}
                   </Route>
                 );
```

---

### Incident Patch 3: `f43989d2` (2026-10-02)
**Commit Message**: feat(frontend): fix up ce client to adhere to branding
feat(core): fix up ai loop

**File**: `core/baml_client/baml_source_map.go` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ var file_map = map[string]string{
 
 	"clients.baml":    "// Learn more about clients at https://docs.boundaryml.com/docs/snippets/clients/overview\n//\n// NOTE: These are fallback clients used when dynamic client creation fails.\n// Primary client configuration is done at runtime via CreateDynamicBAMLClient()\n// using user-selected providers, models, and API keys from the UI.\n\n// Default fallback client - uses OpenAI if environment variable is set\nclient<llm> DefaultClient {\n  provider openai\n  retry_policy Exponential\n  options {\n    model \"gpt-4o\"\n    api_key env.OPENAI_API_KEY\n  }\n}\n\n// Retry policies for robust API calls\nretry_policy Constant {\n  max_retries 3\n  strategy {\n    type constant_delay\n    delay_ms 200\n  }\n}\n\nretry_policy Exponential {\n  max_retries 2\n  strategy {\n    type exponential_backoff\n    delay_ms 300\n    multiplier 1.5\n    max_delay_ms 10000\n  }\n}\n",
 	"generators.baml": "// This helps use auto generate libraries you can use in the language of\n// your choice. You can have multiple generators if you use multiple languages.\n// Just ensure that the output_dir is different for each generator.\ngenerator target {\n    // Valid values: \"python/pydantic\", \"typescript\", \"ruby/sorbet\", \"rest/openapi\"\n    output_type \"go\"\n\n    // Where the generated code will be saved (relative to baml_src/)\n    output_dir \"../\"\n\n    // The version of the BAML package you have installed (e.g. same version as your baml-py or @boundaryml/baml).\n    // The BAML VSCode extension version should also match this version.\n    version \"0.222.0\"\n\n    // 'baml-cli generate' will run this after generating go code\n    // This command will be run from within $output_dir/baml_client\n    on_generate \"gofmt -w . && goimports -w .\"\n\n    // Your Go packages name as specified in go.mod\n    // We need this to generate correct imports in the generated baml_client\n    client_package_name \"github.com/clidey/whodb/core\"\n}\n",
-	"sql_chat.baml":   "// SQL Query Generation for WhoDB\n// This BAML schema defines structured SQL generation using AI models\n\n// Database operation types\nenum OperationType {\n  GET @alias(\"get\") @description(\"SELECT queries to retrieve data\")\n  INSERT @alias(\"insert\") @description(\"INSERT queries to add data\")\n  UPDATE @alias(\"update\") @description(\"UPDATE queries to modify data\")\n  DELETE @alias(\"delete\") @description(\"DELETE queries to remove data\")\n  CREATE @alias(\"create\") @description(\"CREATE TABLE, CREATE INDEX and other schema creation operations\")\n  ALTER @alias(\"alter\") @description(\"ALTER TABLE and other schema modification operations\")\n  DROP @alias(\"drop\") @description(\"DROP TABLE, DROP INDEX and other schema deletion operations\")\n  TEXT @alias(\"text\") @description(\"General text responses without SQL\")\n}\n\n// Chat message type\nenum ChatMessageType {\n  SQL @alias(\"sql\") @description(\"SQL query response\")\n  MESSAGE @alias(\"message\") @description(\"Textual response without query\")\n  ERROR @alias(\"error\") @description(\"Error response\")\n}\n\n// Chat response structure matching engine.ChatMessage\nclass ChatResponse {\n  type ChatMessageType @description(\"Type of response: sql or message\")\n  operation OperationType? @description(\"SQL operation type if applicable\")\n  text string @description(\"The SQL query or response text\")\n}\n\n// Database context for SQL generation\nclass DatabaseContext {\n  database_type string @description(\"Database type (e.g., PostgreSQL, MySQL)\")\n  schema string @description(\"Database schema name\")\n  tables_and_fields string @description(\"Available tables with their field definitions\")\n  previous_conversation string @description(\"Previous conversation history for context\")\n}\n\n// Main function to generate SQL queries from natural language\nfunction GenerateSQLQuery(\n  db_context: DatabaseContext,\n  user_query: string\n) -> ChatResponse[] {\n  client DefaultClient\n  prompt #\"\n    You are a friendly and helpful data engineer working with a {{ db_context.database_type }} database. Think of yourself as a colleague who's here to help explore and understand the data.\n\n    Database Context:\n    Schema: {{ db_context.schema }}\n\n    Available Tables and Fields:\n    {{ db_context.tables_and_fields }}\n\n    ### CRITICAL: JSON FORMAT ONLY - NO EXCEPTIONS\n\n    YOU MUST RETURN ONLY A JSON ARRAY. START YOUR RESPONSE WITH [ AND END WITH ]\n    NO PLAIN TEXT. NO EXPLANATIONS OUTSIDE JSON. ONLY THE JSON ARRAY.\n\n    EXACT FORMAT:\n    [{\"type\": \"message\", \"operation\": null, \"text\": \"your message here\"}]\n\n    For ONLY simple greetings (Hi, Hello, Hey - nothing else):\n    [{\"type\": \"message\", \"operation\": null, \"text\": \"Hi! I'm here to help you work with the {% if db_context.schema %}{{ db_context.schema }} {% endif %}database. What would you like to know?\"}]\n\n    For any other request (even i
```

**File**: `core/baml_src/sql_chat.baml` (modified, +4/-0)
```diff
@@ -73,6 +73,10 @@ function GenerateSQLQuery(
     - ONLY mention tables that ACTUALLY EXIST in the "Available Tables and Fields" section above
     - If NO tables are listed in "Available Tables and Fields", DO NOT mention any table names
     - NEVER hallucinate or make up table names, database names, or data that isn't provided in the context
+    - This chat can run SQL against the listed tables. It cannot call named tools, access ontology catalogs, create artifacts, or render charts and graphs.
+    - NEVER put a tool call or tool result (such as a JSON object with "toolName" or "artifactId") in a response item's text.
+    - If a request needs one of those unavailable actions, explain that limitation in a message and offer a SQL query against listed tables when useful.
+    - NEVER claim a query has run or a chart or graph is visible. The application runs valid SQL and displays its result after your response.
 
     ### Your Personality and Approach:
     - Be warm, conversational, and approachable - like a helpful colleague, not a robot
```

**File**: `core/graph/http_ai_stream.go` (modified, +119/-60)
```diff
@@ -20,10 +20,12 @@ package graph
 
 import (
 	stdctx "context"
+	"encoding/json"
 	"net/http"
+	"strings"
+	"time"
 
 	"github.com/clidey/whodb/core/baml_client"
-	"github.com/clidey/whodb/core/baml_client/stream_types"
 	"github.com/clidey/whodb/core/baml_client/types"
 	"github.com/clidey/whodb/core/graph/model"
 	"github.com/clidey/whodb/core/src/bamlconfig"
@@ -55,8 +57,10 @@ func ceAIChatStreamHandler(w http.ResponseWriter, r *http.Request) {
 		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
 		return
 	}
+	chatContext, cancel := stdctx.WithTimeout(r.Context(), 90*time.Second)
+	defer cancel()
 
-	spec, session, err := getSourceSessionForContext(r.Context())
+	spec, session, err := getSourceSessionForContext(chatContext)
 	if err != nil {
 		log.Debugf("AI Chat Stream: Failed to create source session: %v", err)
 		SendSSEError(w, flusher, "No source session available")
@@ -78,16 +82,18 @@ func ceAIChatStreamHandler(w http.ResponseWriter, r *http.Request) {
 		Endpoint: creds.Endpoint,
 	}
 
+	SendSSEProgress(w, flusher, "schema", "started")
 	// Build object details for the selected chat scope.
 	log.Debugf("AI Chat Stream: Building object details for ref=%+v", req.Ref)
 	resolvedRef := sourceRefFromInput(req.Ref)
-	tableDetails, err := BuildObjectDetails(r.Context(), auditScope, session, resolvedRef, spec.Contract.DefaultObjectKind)
+	tableDetails, err := BuildObjectDetails(chatContext, auditScope, session, resolvedRef, spec.Contract.DefaultObjectKind)
 	if err != nil {
 		log.Debugf("AI Chat Stream: BuildObjectDetails failed: %v", err)
 		SendSSEError(w, flusher, "Failed to get table info: "+err.Error())
 		return
 	}
 	log.Debugf("AI Chat Stream: Table details built, length=%d", len(tableDetails))
+	SendSSEProgress(w, flusher, "schema", "completed")
 
 	scope := sourceScopeForChat(spec, resolvedRef)
 
@@ -100,59 +106,130 @@ func ceAIChatStreamHandler(w http.ResponseWriter, r *http.Request) {
 	}
 	log.Debugf("AI Chat Stream: BAML context created")
 
-	// Create BAML stream
-	log.Debugf("AI Chat Stream: Setting up AI client...")
 	callOpts := bamlconfig.SetupAIClient(modelConfig)
-	log.Debugf("AI Chat Stream: Starting BAML GenerateSQLQuery stream...")
-	stream, err := baml_client.Stream.GenerateSQLQuery(stdctx.Background(), dbContext, req.Input.Query, callOpts...)
-	if err != nil {
-		log.Debugf("AI Chat Stream: GenerateSQLQuery failed: %v", err)
-		SendSSEError(w, flusher, "Failed to start stream: "+err.Error())
-		return
-	}
-	log.Debugf("AI Chat Stream: BAML stream created successfully")
-
-	// Process stream
-	log.Debugf("AI Chat Stream: Starting to process stream...")
-	processStream(r.Context(), w, flusher, stream, queryRunner)
-	log.Debugf("AI Chat Stream: Stream processing completed")
+	runChatLoop(chatContext, w, flusher, dbContext, req.Input.Query, callOpts, queryRunner)
 }
 
-func processStream(
+func runChatLoop(
 	ctx stdctx.Context,
 	w http.ResponseWriter,
 	flusher http.Flusher,
-	stream <-chan baml_client.StreamValue[[]stream_types.ChatResponse, []types.ChatResponse],
+	dbContext types.DatabaseContext,
+	userQuery string,
+	callOpts []baml_client.CallOptionFunc,
 	queryRunner source.ReadOnlyQueryRunner,
 ) {
-	for chunk := range stream {
-		if chunk.IsError {
-			SendSSEError(w, flusher, chunk.Error.Error())
+	request := userQuery
+	var lastFailedSQL, lastQueryError string
+	for attempt := 0; attempt < 2; attempt++ {
+		SendSSEProgress(w, flusher, "plan", "started")
+		stream, err := baml_client.Stream.GenerateSQLQuery(ctx, dbContext, request, callOpts...)
+		if err != nil {
+			sendModelError(w, flusher, err.Error())
 			return
 		}
-
-		if chunk.IsFinal {
-			processFinalChunk(ctx, w, flusher, chunk.Final(), queryRunner)
-			SendSSEDone(w, flusher)
+		var responses *[]types.ChatResponse
+		for chunk := range stream {
+			if chunk.IsError {
+				sendModelError(w, flusher, chunk.Error.Error())
+				return
+			}
+			if chunk.IsFinal {
+				responses = chunk.Final()
+				break
+			}
+		}
+		if err := ctx.Err(); err != nil {
+			if err == stdctx.DeadlineExceeded {
+				SendSSEError(w, flusher, "The chat request timed out. Please try again.")
+			}
+			return
+		}
+		SendSSEProgress(w, flusher, "plan", "completed")
+		if responses == nil || len(*responses) == 0 {
+			SendSSEError(w, flusher, "The model returned no answer")
 			return
 		}
 
-		if chunk.Stream() != nil {
-			for _, bamlResp := range *chunk.Stream() {
-				SendSSEChunk(w, flusher, convertStreamResponse(&bamlResp))
+		messages := make([]*model.AIChatMessage, 0, len(*responses))
+		var retryReason string
+		for _, response := range *responses {
+			if unsupportedChatTool(response.Text) {
+				retryReason = "This chat cannot invoke named tools. Answer using listed database tables or explain the limitation."
+				break
+			}
+			if response.Type == types.ChatMessageTypeSQL {
+				step := "query"
+				if sqlguard.Classify(response.Text).Mutating {
+					step = "draft"
+				}
+				SendSSEProgress(w, flu
```

**File**: `core/graph/http_ai_stream_security_test.go` (modified, +49/-1)
```diff
@@ -4,9 +4,13 @@ package graph
 
 import (
 	"context"
+	"encoding/json"
+	"net/http/httptest"
+	"strings"
+	"testing"
+
 	"github.com/clidey/whodb/core/baml_client/types"
 	"github.com/clidey/whodb/core/src/source"
-	"testing"
 )
 
 type protectedChatRecorder struct{ calls int }
@@ -32,3 +36,47 @@ func TestStreamedChatUsesSQLPolicy(t *testing.T) {
 		t.Fatal("read did not use protected executor")
 	}
 }
+
+func TestChatRejectsToolPayloadAndMissingOperation(t *testing.T) {
+	if !unsupportedChatTool(`{"toolName":"search_ontology_catalog","arguments":{}}`) {
+		t.Fatal("tool payload was accepted as chat text")
+	}
+	if unsupportedChatTool(`{"name":"ordinary result"}`) {
+		t.Fatal("ordinary JSON was mistaken for a tool action")
+	}
+	runner := &protectedChatRecorder{}
+	response := processFinalResponse(t.Context(), &types.ChatResponse{Type: types.ChatMessageTypeSQL, Text: "SELECT 1"}, runner)
+	if response.Type != "error" || runner.calls != 0 {
+		t.Fatalf("missing operation was treated as executed SQL: %#v", response)
+	}
+}
+
+func TestStreamedChatFailureMessages(t *testing.T) {
+	response := httptest.NewRecorder()
+	SendSSESQLFailure(response, response, "SELECT *\nFROM missing", "no such table: missing")
+	var message struct {
+		Type string
+		Text string
+	}
+	stream := response.Body.String()
+	if !strings.Contains(stream, "event: done") {
+		t.Fatal("SQL failure did not complete the stream")
+	}
+	line := strings.Split(strings.Split(stream, "data: ")[1], "\n")[0]
+	if err := json.Unmarshal([]byte(line), &message); err != nil {
+		t.Fatal(err)
+	}
+	var details map[string]string
+	if err := json.Unmarshal([]byte(message.Text), &details); err != nil {
+		t.Fatal(err)
+	}
+	if message.Type != "sql:error" || details["sql"] != "SELECT *\nFROM missing" || details["error"] != "no such table: missing" {
+		t.Fatalf("SQL failure lost query details: %#v", message)
+	}
+
+	response = httptest.NewRecorder()
+	sendModelError(response, response, "localhost:1234: connection refused")
+	if !strings.Contains(response.Body.String(), `"Type":"provider:error"`) || !strings.Contains(response.Body.String(), "event: done") {
+		t.Fatalf("provider failure was not shown inline: %s", response.Body.String())
+	}
+}
```

**File**: `core/graph/http_ai_stream_shared.go` (modified, +15/-5)
```diff
@@ -135,17 +135,27 @@ func SendSSEMessage(w http.ResponseWriter, flusher http.Flusher, message *model.
 	flusher.Flush()
 }
 
-// SendSSEChunk sends a streaming chunk via SSE
-func SendSSEChunk(w http.ResponseWriter, flusher http.Flusher, chunk map[string]any) {
-	data, err := json.Marshal(chunk)
+// SendSSEProgress reports a backend chat action and its current status.
+func SendSSEProgress(w http.ResponseWriter, flusher http.Flusher, step, status string) {
+	data, err := json.Marshal(map[string]string{"step": step, "status": status})
 	if err != nil {
-		log.WithError(err).Error("Failed to marshal SSE chunk")
 		return
 	}
-	fmt.Fprintf(w, "event: chunk\ndata: %s\n\n", data)
+	fmt.Fprintf(w, "event: progress\ndata: %s\n\n", data)
 	flusher.Flush()
 }
 
+// SendSSESQLFailure includes the generated query so the chat can show the failed line.
+func SendSSESQLFailure(w http.ResponseWriter, flusher http.Flusher, sql, failure string) {
+	data, err := json.Marshal(map[string]string{"sql": sql, "error": failure})
+	if err != nil {
+		SendSSEError(w, flusher, failure)
+		return
+	}
+	SendSSEMessage(w, flusher, &model.AIChatMessage{Type: "sql:error", Text: string(data)})
+	SendSSEDone(w, flusher)
+}
+
 // SendSSEError sends an error via SSE and completes the stream
 func SendSSEError(w http.ResponseWriter, flusher http.Flusher, errorMsg string) {
 	// Sanitize error message to avoid leaking technical details
```

**File**: `core/src/plugins/sqlite3/sqlite3.go` (modified, +5/-3)
```diff
@@ -555,10 +555,12 @@ func (p *Sqlite3Plugin) executeRawSQL(config *engine.PluginConfig, query string,
 				return nil, tx.Error
 			}
 			defer func() { _ = tx.Rollback().Error }()
-			if err := p.SetTransactionReadOnly(tx, true); err != nil {
-				return nil, err
+			if !IsSampleDatabase(config.Credentials.Database) {
+				if err := p.SetTransactionReadOnly(tx, true); err != nil {
+					return nil, err
+				}
+				defer func() { _ = p.SetTransactionReadOnly(tx, false) }()
 			}
-			defer func() { _ = p.SetTransactionReadOnly(tx, false) }()
 			db = tx
 		}
 
```

**File**: `core/src/plugins/sqlite3/sqlite3_runtime_test.go` (modified, +19/-0)
```diff
@@ -103,6 +103,25 @@ func TestServerSampleDatabaseIsReadOnly(t *testing.T) {
 	}
 }
 
+func TestServerSampleDatabaseProtectedRead(t *testing.T) {
+	t.Setenv("WHODB_CLI", "false")
+	t.Setenv("WHODB_DESKTOP", "false")
+
+	plugin := NewSqlite3Plugin().PluginFunctions.(*Sqlite3Plugin)
+	config := engine.NewPluginConfig(&engine.Credentials{
+		Type:     string(engine.DatabaseType_Sqlite3),
+		Database: SampleDatabaseName,
+	})
+	config.ReadOnly = true
+	rows, err := plugin.RawExecute(config, "SELECT id FROM orders LIMIT 1")
+	if err != nil {
+		t.Fatalf("protected read of sample orders failed: %v", err)
+	}
+	if len(rows.Rows) != 1 {
+		t.Fatalf("expected one sample order, got %d", len(rows.Rows))
+	}
+}
+
 func newSQLiteRuntimeTestFixture(t *testing.T, statements ...string) (*Sqlite3Plugin, *engine.PluginConfig, *gorm.DB) {
 	t.Helper()
 
```

**File**: `frontend/e2e/support/whodb/where.mjs` (modified, +14/-23)
```diff
@@ -38,32 +38,24 @@ export const whereMethods = {
 
         console.log(`Where condition mode detected: ${isSheetMode ? "sheet" : isPopoverMode ? "popover" : "unknown"}`);
 
-        for (const [key, operator, value] of fieldArray) {
+        for (const [index, [key, operator, value]] of fieldArray.entries()) {
             console.log(`Adding condition: ${key} ${operator} ${value}`);
 
             if (isSheetMode) {
-                if ((await this.page.locator('[data-testid="sheet-field-key-0"]').count()) > 0) {
-                    await this.page.locator('[data-testid="sheet-field-key-0"]').click();
-                } else if ((await this.page.locator('[data-testid="sheet-field-key"]').count()) > 0) {
-                    await this.page.locator('[data-testid="sheet-field-key"]').click();
+                if (index > 0 || (await this.page.locator('[data-testid="sheet-field-value-0"]').inputValue())) {
+                    await this.page.locator('[data-testid="add-sheet-filter-button"]').click();
                 }
+                const row = (await this.page.locator('[data-testid^="sheet-filter-row-"]').count()) - 1;
+                await this.page.locator(`[data-testid="sheet-field-key-${row}"]`).click();
                 await this.page.locator(`[data-value="${key}"]`).click();
 
-                if ((await this.page.locator('[data-testid="sheet-field-operator-0"]').count()) > 0) {
-                    await this.page.locator('[data-testid="sheet-field-operator-0"]').click();
-                } else if ((await this.page.locator('[data-testid="sheet-field-operator"]').count()) > 0) {
-                    await this.page.locator('[data-testid="sheet-field-operator"]').click();
-                }
+                await this.page.locator(`[data-testid="sheet-field-operator-${row}"]`).click();
                 await this.page.locator(`[data-value="${operator}"]`).click();
 
-                const sheetValueLocator = (await this.page.locator('[data-testid="sheet-field-value-0"]').count()) > 0
-                    ? this.page.locator('[data-testid="sheet-field-value-0"]')
-                    : this.page.locator('[data-testid="sheet-field-value"]');
+                const sheetValueLocator = this.page.locator(`[data-testid="sheet-field-value-${row}"]`);
                 await sheetValueLocator.clear();
                 await sheetValueLocator.fill(value);
                 await expect(sheetValueLocator).toHaveValue(value);
-
-                await this.page.locator('[role="dialog"] [data-testid="add-conditions-button"]').click();
             } else {
                 await this.page.locator('[data-testid="field-key"]').first().click();
                 await this.page.locator(`[data-value="${key}"]`).click();
@@ -86,11 +78,7 @@ export const whereMethods = {
         }
 
         if (isSheetMode) {
-            if ((await this.page.locator('[role="dialog"] button[aria-label="Close"]').count()) > 0) {
-                await this.page.locator('[role="dialog"] button[aria-label="Close"]').click();
-            } else {
-                await this.page.keyboard.press("Escape");
-            }
+            await this.page.locator('[data-testid="apply-filters-button"]').click();
             // Required: dialog close animation
             await this.page.waitForTimeout(100);
             await this.page.locator('[role="dialog"]').waitFor({ state: "hidden", timeout: TIMEOUT.ELEMENT });
@@ -113,6 +101,9 @@ export const whereMethods = {
      * @returns {Promise<string>}
      */
     async getWhereConditionMode() {
+        if ((await this.page.locator('[data-testid="where-button"]').getAttribute('data-sheet-only')) === 'true') {
+            return "sheet";
+        }
         const hasSheetFields = (await this.page.locator('[data-testid*="sheet-field"]').count()) > 0;
         const hasPopoverBadges = (await this.page.locator('[data-testid="where-condition-badge"]').count()) > 0;
         const hasFieldKey = (await this.page.locator('[data-testid="field-key"]').count()) > 0;
@@ -203,13 +194,13 @@ export const whereMethods = {
         } else {
             await this.page.locator('[data-testid="where-button"]').click();
 
-            const deleteBtn = this.page.locator(`[data-testid="delete-existing-filter-${index}"]`);
+            const deleteBtn = this.page.locator(`[data-testid="remove-sheet-filter-${index}"]`);
             await deleteBtn.waitFor({ state: "visible", timeout: TIMEOUT.ELEMENT });
             await deleteBtn.click();
             // Required: filter removal animation
             await this.page.waitForTimeout(200);
 
-            await this.page.keyboard.press("Escape");
+            await this.page.locator('[data-testid="apply-filters-button"]').click();
             // Required: dialog close animation
             await this.page.waitForTimeout(100);
             const dialog = this.page.locator('[role="dialog"]');
@@ -284,7 +275,7 @@ export const whereMethods = {
      * Save change
```

---

### Incident Patch 4: `84e916fe` (2026-09-30)
**Commit Message**: update buildactions

**File**: `.github/workflows/_build-docker-cli.yml` (modified, +12/-6)
```diff
@@ -1,8 +1,9 @@
 name: Build CLI Docker Images
 
 # Produces:
-# - docker-cli-image-amd64: transient scan handoff artifact.
-# - docker-cli-image-arm64: transient scan handoff artifact.
+# - docker-cli-image-amd64: OCI layout tarball with SBOM + provenance attestations.
+# - docker-cli-image-arm64: OCI layout tarball with SBOM + provenance attestations.
+# The deploy workflow pushes these tarballs as-is, so the scanned image digest is the deployed digest.
 
 on:
   workflow_call:
@@ -86,20 +87,25 @@ jobs:
           file: ./cli/Dockerfile
           platforms: ${{ matrix.platform }}
           push: false
+          sbom: true
+          provenance: mode=max
           tags: clidey/whodb-cli:${{ inputs.version }}-${{ matrix.arch }}
-          outputs: type=docker,dest=/tmp/whodb-cli-docker-${{ matrix.arch }}.tar
+          outputs: type=oci,dest=/tmp/whodb-cli-docker-${{ matrix.arch }}.tar
           cache-from: type=gha,scope=ce-cli-docker-${{ matrix.arch }}
           cache-to: type=gha,mode=max,scope=ce-cli-docker-${{ matrix.arch }}
           build-args: |
             VERSION=${{ inputs.version }}
 
-      - name: Load image for scan
-        run: docker load -i /tmp/whodb-cli-docker-${{ matrix.arch }}.tar
+      # Trivy reads OCI layouts from a directory, not from the tarball itself.
+      - name: Extract OCI layout for scan
+        run: |
+          mkdir -p /tmp/whodb-cli-oci
+          tar -xf /tmp/whodb-cli-docker-${{ matrix.arch }}.tar -C /tmp/whodb-cli-oci
 
       - name: Generate Trivy SARIF report
         uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
         with:
-          image-ref: clidey/whodb-cli:${{ inputs.version }}-${{ matrix.arch }}
+          input: /tmp/whodb-cli-oci
           format: sarif
           output: trivy-results.sarif
           exit-code: '0'
```

**File**: `.github/workflows/_deploy-docker-cli.yml` (modified, +14/-33)
```diff
@@ -27,10 +27,8 @@ jobs:
       matrix:
         include:
           - runner: ubuntu-latest
-            platform: linux/amd64
             arch: amd64
           - runner: ubuntu-24.04-arm
-            platform: linux/arm64
             arch: arm64
     steps:
       - name: Harden Runner
@@ -40,57 +38,40 @@ jobs:
           allowed-endpoints: >
             api.github.com:443
             auth.docker.io:443
-            dl-cdn.alpinelinux.org:443
-            fulcio.sigstore.dev:443
             github.com:443
             index.docker.io:443
             objects.githubusercontent.com:443
             production.cloudflare.docker.com:443
             production.cloudfront.docker.com:443
-            proxy.golang.org:443
             registry-1.docker.io:443
-            rekor.sigstore.dev:443
             release-assets.githubusercontent.com:443
-            storage.googleapis.com:443
-            sum.golang.org:443
-            timestamp.sigstore.dev:443
-            tuf-repo-cdn.sigstore.dev:443
 
-      - name: Checkout
-        uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
+      - name: Download CLI Docker image artifact
+        uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
         with:
-          submodules: false
+          name: docker-cli-image-${{ matrix.arch }}
+          path: /tmp/whodb-cli-docker
 
-      - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@d7f5e7f509e45cec5c76c4d5afdd7de93d0b3df5 # v4.1.0
+      - name: Set up crane
+        uses: imjasonh/setup-crane@feee3b6bb0d4c68370f256a4502498c9227e5c6b # v0.7
 
       - name: Login to Docker Hub
         uses: docker/login-action@650006c6eb7dba73a995cc03b0b2d7f5ca915bee # v4.2.0
         with:
           username: ${{ secrets.DOCKERHUB_USERNAME }}
           password: ${{ secrets.DOCKERHUB_TOKEN }}
 
-      - name: Stamp plugin.json version
+      # The tarball is the OCI layout produced by the build workflow, including the
+      # SBOM and provenance attestation manifest. Pushing the layout's single index
+      # entry reproduces the exact digest that Trivy scanned in the build job.
+      - name: Push scanned image with attestations
         env:
           VERSION: ${{ inputs.version }}
+          ARCH: ${{ matrix.arch }}
         run: |
-          PLUGIN_JSON="cli/external-plugin/whodb/.claude-plugin/plugin.json"
-          jq --arg v "$VERSION" '.version = $v' "$PLUGIN_JSON" > "$PLUGIN_JSON.tmp"
-          mv "$PLUGIN_JSON.tmp" "$PLUGIN_JSON"
-
-      - name: Build from cache and push with attestations
-        uses: docker/build-push-action@f9f3042f7e2789586610d6e8b85c8f03e5195baf # v7.2.0
-        with:
-          context: .
-          file: ./cli/Dockerfile
-          platforms: ${{ matrix.platform }}
-          push: true
-          sbom: true
-          provenance: mode=max
-          tags: clidey/whodb-cli:${{ inputs.version }}-${{ matrix.arch }}
-          cache-from: type=gha,scope=ce-cli-docker-${{ matrix.arch }}
-          build-args: |
-            VERSION=${{ inputs.version }}
+          mkdir -p /tmp/whodb-cli-oci
+          tar -xf "/tmp/whodb-cli-docker/whodb-cli-docker-${ARCH}.tar" -C /tmp/whodb-cli-oci
+          crane push /tmp/whodb-cli-oci "clidey/whodb-cli:${VERSION}-${ARCH}"
 
   create-manifest-cli:
     name: Create CLI manifest and sign
```

---

### Incident Patch 5: `1d22ebf3` (2026-09-30)
**Commit Message**: disable cache for some build jobs

**File**: `.github/workflows/_build-apple.yml` (modified, +1/-6)
```diff
@@ -157,12 +157,7 @@ jobs:
         uses: actions/setup-go@4a3601121dd01d1626a1e23e37211e3254c1c06c # v6.4.0
         with:
           go-version-file: 'desktop-ce/go.mod'
-          cache: true
-          cache-dependency-path: |
-            desktop-ce/go.sum
-            desktop-ce/go.mod
-            core/go.sum
-            core/go.mod
+          cache: false
 
       - name: Download frontend build artifact
         if: matrix.enabled != false
```

**File**: `.github/workflows/_build-cli.yml` (modified, +4/-24)
```diff
@@ -62,12 +62,7 @@ jobs:
         uses: actions/setup-go@4a3601121dd01d1626a1e23e37211e3254c1c06c # v6.4.0
         with:
           go-version-file: 'cli/go.mod'
-          cache: true
-          cache-dependency-path: |
-            cli/go.sum
-            cli/go.mod
-            core/go.sum
-            core/go.mod
+          cache: false
 
       - name: Stamp plugin.json version
         run: |
@@ -129,12 +124,7 @@ jobs:
         uses: actions/setup-go@4a3601121dd01d1626a1e23e37211e3254c1c06c # v6.4.0
         with:
           go-version-file: 'cli/go.mod'
-          cache: true
-          cache-dependency-path: |
-            cli/go.sum
-            cli/go.mod
-            core/go.sum
-            core/go.mod
+          cache: false
 
       - name: Install cross-compiler
         run: |
@@ -261,12 +251,7 @@ jobs:
         uses: actions/setup-go@4a3601121dd01d1626a1e23e37211e3254c1c06c # v6.4.0
         with:
           go-version-file: 'cli/go.mod'
-          cache: true
-          cache-dependency-path: |
-            cli/go.sum
-            cli/go.mod
-            core/go.sum
-            core/go.mod
+          cache: false
 
       - name: Stamp plugin.json version
         run: |
@@ -353,12 +338,7 @@ jobs:
         uses: actions/setup-go@4a3601121dd01d1626a1e23e37211e3254c1c06c # v6.4.0
         with:
           go-version-file: 'cli/go.mod'
-          cache: true
-          cache-dependency-path: |
-            cli/go.sum
-            cli/go.mod
-            core/go.sum
-            core/go.mod
+          cache: false
 
       - name: Stamp plugin.json version
         shell: pwsh
```

**File**: `.github/workflows/_build-windows.yml` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ jobs:
         uses: actions/setup-go@4a3601121dd01d1626a1e23e37211e3254c1c06c # v6.4.0
         with:
           go-version-file: 'desktop-ce/go.mod'
-          cache: true
+          cache: ${{ matrix.arch == 'amd64' }}
           cache-dependency-path: |
             desktop-ce/go.sum
             desktop-ce/go.mod
```

---

### Incident Patch 6: `b8603b82` (2026-09-30)
**Commit Message**: fix appcapture func

**File**: `cli/internal/appcapture/capture.go` (modified, +1/-1)
```diff
@@ -180,7 +180,7 @@ func Capture(parent context.Context, options Options) (*Result, error) {
 	if err := cmd.Run(); err != nil {
 		message := strings.TrimSpace(stderr.String())
 		if strings.Contains(message, "Executable doesn't exist") || strings.Contains(message, "Please run the following command") {
-			return nil, errors.New("Chromium is missing; run whodb apps setup-capture, or retry whodb apps screenshot --install")
+			return nil, errors.New("missing Chromium; run whodb apps setup-capture, or retry whodb apps screenshot --install")
 		}
 		if len(message) > 700 {
 			message = message[:700]
```

**File**: `cli/internal/appcapture/runtime.go` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ func RuntimeDir() (string, error) {
 // It is only called by an explicit CLI setup command or --install flag.
 func SetupRuntime(ctx context.Context) (string, error) {
 	if _, err := exec.LookPath("node"); err != nil {
-		return "", errors.New("Node.js is required; install Node.js, then run whodb apps setup-capture")
+		return "", errors.New("missing Node.js; install Node.js, then run whodb apps setup-capture")
 	}
 	if _, err := exec.LookPath("npm"); err != nil {
 		return "", errors.New("npm is required; install Node.js with npm, then run whodb apps setup-capture")
```

---

### Incident Patch 7: `3179940a` (2026-09-29)
**Commit Message**: feat(cli): fix up capturing screenshots

**File**: `cli/README.md` (modified, +47/-0)
```diff
@@ -754,6 +754,53 @@ whodb mcp serve --platform --read-only
 whodb mcp serve --platform --allow-write
 ```
 
+To capture an actual rendered app with its current data, use the app commands
+or the `whodb_platform_app_views` and `whodb_platform_app_screenshot` MCP tools.
+The MCP screenshot tool returns WebP image content directly to the model. Both
+paths use the selected hosted workspace and are available in read-only mode.
+
+```bash
+whodb apps views "Clidey Sales" --org clidey-erp --project erp-demo --env dev
+whodb apps screenshot "Clidey Sales" --org clidey-erp --project erp-demo \
+  --env dev --tab Catalog --output sales-catalog.webp
+whodb apps setup-capture
+# Or install the optional browser on demand when taking a screenshot:
+whodb apps screenshot "Clidey Sales" --install --org clidey-erp --project erp-demo
+```
+
+For a specific page or interactive state, list pages first, then pass `--page`.
+Use `--click` for a visible app control, or `--actions` for an ordered sequence.
+Selectors are Playwright selectors inside the app frame. `--js` evaluates a
+JavaScript expression or IIFE in that frame after the actions; `--script-file`
+reads the expression from a file. JSON output includes the screenshot path,
+visible text, browser console errors, page errors, failed requests, HTTP error
+responses, and the JavaScript result.
+An assertion in `--js` can throw an error. The command still saves the screenshot
+and JSON diagnostics, sets `checks_passed` to `false`, and exits nonzero.
+`checks_passed` confirms that actions ran and explicit `wait_for` or JavaScript
+assertions passed; a click alone does not prove the app reached an intended view.
+
+```bash
+whodb apps views "Clidey Sales" --org clidey-erp --project erp-demo --env dev
+whodb apps screenshot "Clidey Sales" --org clidey-erp --project erp-demo \
+  --env dev --page main --click 'text=Orders' \
+  --js '(() => ({ rows: document.querySelectorAll("tr").length }))()' \
+  --output sales-orders.webp --format json
+```
+
+The MCP screenshot tool accepts the same `page`, `tab`, `actions`, and `script`
+inputs, so an agent can click, fill, press, wait for a selector, or inspect DOM
+state without creating a Playwright script. For example, use an action
+`{"kind":"click","selector":"text=Orders"}` followed by a script
+`"(() => document.querySelectorAll('tr').length)()"`.
+
+App capture needs Node.js and npm. `setup-capture` installs Playwright and
+Chromium in the user's cache; `--install` does the same before capturing.
+Without them, the command and MCP tool return setup instructions. Existing
+Playwright installations in the WhoDB source checkout work without setup.
+Captures only allow hosted GraphQL reads and never upload or publish the image.
+Inspect sample data and loading states before using a capture as product media.
+
 Local or staging setup:
 
 ```bash
```

**File**: `cli/cmd/platform_apps.go` (modified, +1/-0)
```diff
@@ -86,6 +86,7 @@ func registerPlatformAppCommands() {
 	appsCloneCmd.Flags().BoolVar(&appCloneOverwrite, "overwrite", false, "update an existing target app with the same name")
 	appsCloneCmd.Flags().BoolVarP(&platformWriteYes, "yes", "y", false, "clone without first printing the plan")
 	appsCmd.AddCommand(appsListCmd, appsCloneCmd)
+	registerPlatformAppCaptureCommands()
 }
 
 func readPlatformApps(ctx context.Context, session *platformSession, projectID string) ([]platformApp, error) {
```

**File**: `cli/cmd/platform_apps_capture.go` (added, +223/-0)
```diff
@@ -0,0 +1,223 @@
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ */
+
+package cmd
+
+import (
+	"context"
+	"encoding/json"
+	"fmt"
+	"os"
+	"path/filepath"
+	"strings"
+
+	"github.com/clidey/whodb/cli/internal/appcapture"
+	"github.com/clidey/whodb/cli/internal/platform"
+	"github.com/clidey/whodb/cli/pkg/output"
+	"github.com/spf13/cobra"
+)
+
+var (
+	appCaptureEnv         string
+	appCapturePage        string
+	appCaptureTab         string
+	appCaptureOutput      string
+	appCaptureWidth       int
+	appCaptureHeight      int
+	appCaptureInstall     bool
+	appCaptureClicks      []string
+	appCaptureActionsJSON string
+	appCaptureJS          string
+	appCaptureScriptFile  string
+)
+
+var appsSetupCaptureCmd = &cobra.Command{
+	Use:           "setup-capture",
+	Short:         "Install the optional app screenshot browser in your user cache",
+	Args:          cobra.NoArgs,
+	SilenceUsage:  true,
+	SilenceErrors: true,
+	RunE: func(cmd *cobra.Command, _ []string) error {
+		packageFile, err := appcapture.SetupRuntime(cmd.Context())
+		if err != nil {
+			return err
+		}
+		_, err = fmt.Fprintf(cmd.OutOrStdout(), "App capture is ready (%s)\n", packageFile)
+		return err
+	},
+}
+
+var appsViewsCmd = &cobra.Command{
+	Use:           "views <app>",
+	Short:         "List the pages available in a hosted app",
+	Args:          cobra.ExactArgs(1),
+	SilenceUsage:  true,
+	SilenceErrors: true,
+	RunE:          runPlatformAppViews,
+}
+
+var appsScreenshotCmd = &cobra.Command{
+	Use:           "screenshot <app>",
+	Short:         "Capture the rendered hosted app as a WebP image",
+	Args:          cobra.ExactArgs(1),
+	SilenceUsage:  true,
+	SilenceErrors: true,
+	RunE:          runPlatformAppScreenshot,
+}
+
+func registerPlatformAppCaptureCommands() {
+	appsViewsCmd.Flags().StringVar(&appCaptureEnv, "env", "published", "app environment: published or dev")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureEnv, "env", "published", "app environment: published or dev")
+	appsScreenshotCmd.Flags().StringVar(&appCapturePage, "page", "", "app page from the views command")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureTab, "tab", "", "visible app tab or button label to open before capture")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureOutput, "output", "", "output WebP file (defaults to the app name and page)")
+	appsScreenshotCmd.Flags().IntVar(&appCaptureWidth, "width", 1440, "capture viewport width in pixels")
+	appsScreenshotCmd.Flags().IntVar(&appCaptureHeight, "height", 900, "capture viewport height in pixels")
+	appsScreenshotCmd.Flags().BoolVar(&appCaptureInstall, "install", false, "install the optional capture browser before screenshotting")
+	appsScreenshotCmd.Flags().StringArrayVar(&appCaptureClicks, "click", nil, "click a Playwright selector in the app; repeat for sequential clicks")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureActionsJSON, "actions", "", "ordered JSON array of click, fill, press, wait_for, or wait actions")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureJS, "js", "", "JavaScript expression or IIFE to evaluate in the app frame")
+	appsScreenshotCmd.Flags().StringVar(&appCaptureScriptFile, "script-file", "", "read JavaScript to evaluate from a local file")
+	appsCmd.AddCommand(appsViewsCmd, appsScreenshotCmd, appsSetupCaptureCmd)
+}
+
+func resolveAppCapture(ctx context.Context, appRef string) (*platformSession, appcapture.Options, string, error) {
+	session, err := loadPlatformSession(ctx, platformHost)
+	if err != nil {
+		return nil, appcapture.Options{}, "", err
+	}
+	org, project, err := resolvePlatformProject(ctx, session, platformResourceOrg, platformResourceProject)
+	if err != nil {
+		return nil, appcapture.Options{}, "", err
+	}
+	session.Client.SetWorkspaceContext(org.ID, project.ID)
+	apps, err := appcapture.ListApps(ctx, session.Client, project.ID)
+	if err != nil {
+		return nil, appcapture.Options{}, "", err
+	}
+	app, err := appcapture.FindApp(apps, appRef)
+	if err != nil {
+		return nil, appcapture.Options{}, "", err
+	}
+	return session, appcapture.Options{
+		Host: session.Host.URL, OrgSlug: org.Slug, ProjectSlug: project.Slug,
+		OrgID: org.ID, ProjectID: project.ID, AppID: app.ID, Env: appCaptureEnv,
+	}, app.Name, nil
+}
+
+func runPlatformAppViews(cmd *cobra.Command, args []string) error {
+	ctx := cmd.Context()
+	session, options, appName, err := resolveAppCapture(ctx, args[0])
+	if err != nil {
+		return err
+	}
+	views, err := appcapture.ListViews(ctx, session.Client, options)
+	if err != nil {
+		return err
+	}
+	format, err := output.ParseFormat(platformFormat)
+	if err != nil {
+		return err
+	}
+	if format == output.FormatJSON {
+		return json.NewEncoder(cmd.OutOrStdout()).Encode(map[string]any{"app": appName, "views": views})
+	}
+	for _, view := range views {
+		fmt.Fprintf(cmd.OutOrStdout(), "%s\t%s\n", view.Page, view.URL)
+	}
+	return nil
+}
+
+func runPlatformAppScreenshot(cmd *cobra
```

**File**: `cli/internal/agentmanifest/manifest.go` (modified, +2/-0)
```diff
@@ -330,6 +330,8 @@ func buildMCPTools() []MCPTool {
 	tools = append(tools,
 		MCPTool{Name: "whodb_platform_apps", Description: "List hosted ontology-powered apps in the selected project.", ReadOnly: true},
 		MCPTool{Name: "whodb_platform_app", Description: "Inspect one hosted app, including its generated definition.", ReadOnly: true},
+		MCPTool{Name: "whodb_platform_app_views", Description: "List pages available in one rendered hosted app.", ReadOnly: true},
+		MCPTool{Name: "whodb_platform_app_screenshot", Description: "Capture a rendered hosted app page after optional browser actions or JavaScript, with console and network diagnostics.", ReadOnly: true},
 		MCPTool{Name: "whodb_platform_app_files", Description: "List files belonging to one hosted app.", ReadOnly: true},
 		MCPTool{Name: "whodb_platform_app_view", Description: "Read the current hosted app view and generated files.", ReadOnly: true},
 		MCPTool{Name: "whodb_platform_app_version_view", Description: "Read a promoted hosted app version.", ReadOnly: true},
```

**File**: `cli/internal/appcapture/capture.go` (added, +245/-0)
```diff
@@ -0,0 +1,245 @@
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ */
+
+package appcapture
+
+import (
+	"bytes"
+	"context"
+	_ "embed"
+	"encoding/base64"
+	"encoding/json"
+	"errors"
+	"fmt"
+	"io"
+	"net/http"
+	"net/url"
+	"os"
+	"os/exec"
+	"strings"
+	"time"
+)
+
+//go:embed capture.mjs
+var browserScript string
+
+// App is the small part of a hosted app needed to select a capture target.
+type App struct {
+	ID          string `json:"id"`
+	Name        string `json:"name"`
+	Description string `json:"description"`
+}
+
+// View describes a page that the hosted app runtime can render.
+type View struct {
+	Page string `json:"page"`
+	URL  string `json:"url"`
+}
+
+// Action is one browser interaction performed inside the rendered app frame.
+type Action struct {
+	Kind         string `json:"kind"`
+	Selector     string `json:"selector,omitempty"`
+	Value        string `json:"value,omitempty"`
+	Milliseconds int    `json:"milliseconds,omitempty"`
+}
+
+// Diagnostics reports browser errors observed during an app capture.
+type Diagnostics struct {
+	ConsoleErrors  []string `json:"console_errors,omitempty"`
+	PageErrors     []string `json:"page_errors,omitempty"`
+	FailedRequests []string `json:"failed_requests,omitempty"`
+	HTTPResponses  []string `json:"http_error_responses,omitempty"`
+	ActionErrors   []string `json:"action_errors,omitempty"`
+	ScriptErrors   []string `json:"script_errors,omitempty"`
+}
+
+// Options select one rendered app view for a local browser capture.
+type Options struct {
+	Host        string
+	OrgSlug     string
+	ProjectSlug string
+	OrgID       string
+	ProjectID   string
+	AppID       string
+	Env         string
+	Page        string
+	Tab         string
+	Actions     []Action
+	Script      string
+	Token       string
+	Width       int
+	Height      int
+}
+
+// Result contains the screenshot and visible app content observed at capture time.
+type Result struct {
+	Image            []byte      `json:"-"`
+	MIMEType         string      `json:"mime_type"`
+	URL              string      `json:"url"`
+	Page             string      `json:"page,omitempty"`
+	Tab              string      `json:"tab,omitempty"`
+	Width            int         `json:"width"`
+	Height           int         `json:"height"`
+	Text             string      `json:"visible_text,omitempty"`
+	Diagnostics      Diagnostics `json:"diagnostics"`
+	ScriptResultJSON string      `json:"script_result_json,omitempty"`
+}
+
+// URL builds the actual end-user app route without credentials.
+func (o Options) URL() (string, error) {
+	base, err := url.Parse(o.Host)
+	if err != nil || (base.Scheme != "https" && base.Scheme != "http") || base.Host == "" {
+		return "", errors.New("valid hosted WhoDB URL is required")
+	}
+	if o.OrgSlug == "" || o.ProjectSlug == "" || o.AppID == "" {
+		return "", errors.New("organization, project, and app are required")
+	}
+	base.Path = strings.TrimRight(base.Path, "/") + "/" + url.PathEscape(o.OrgSlug) + "/" + url.PathEscape(o.ProjectSlug) + "/apps/" + url.PathEscape(o.AppID)
+	query := base.Query()
+	if o.Env != "" {
+		if o.Env != "dev" && o.Env != "published" {
+			return "", errors.New("env must be dev or published")
+		}
+		if o.Env == "dev" {
+			query.Set("env", "dev")
+		}
+	}
+	if o.Page != "" {
+		query.Set("page", o.Page)
+	}
+	base.RawQuery = query.Encode()
+	return base.String(), nil
+}
+
+type browserInput struct {
+	Options           Options        `json:"options"`
+	URL               string         `json:"url"`
+	Session           map[string]any `json:"session"`
+	PlaywrightPackage string         `json:"playwrightPackage"`
+}
+
+type browserOutput struct {
+	ImageBase64      string      `json:"imageBase64"`
+	Text             string      `json:"text"`
+	Diagnostics      Diagnostics `json:"diagnostics"`
+	ScriptResultJSON string      `json:"scriptResultJSON"`
+}
+
+// Capture renders the actual app in an isolated browser and returns WebP bytes.
+// The browser helper only permits hosted GraphQL reads and never publishes media.
+func Capture(parent context.Context, options Options) (*Result, error) {
+	appURL, err := options.URL()
+	if err != nil {
+		return nil, err
+	}
+	if options.Token == "" || options.OrgID == "" || options.ProjectID == "" {
+		return nil, errors.New("authenticated organization and project are required")
+	}
+	if options.Width == 0 {
+		options.Width = 1440
+	}
+	if options.Height == 0 {
+		options.Height = 900
+	}
+	if options.Width < 640 || options.Width > 3840 || options.Height < 400 || options.Height > 2160 {
+		return nil, errors.New("viewport must be between 640x400 and 3840x2160")
+	}
+	if len(options.Actions) > 20 || len(options.Script) > 16000 {
+		return nil, errors.New("capture allows at most 20 actions and 16000 JavaScript characters")
+	}
+	for index, action := range options.Actions {
+		if err := validateAction(action); err != nil {
+			return nil, fmt.Errorf("action %d: %w"
```

**File**: `cli/internal/appcapture/capture.mjs` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+import { createRequire } from "node:module";
+import { readFileSync } from "node:fs";
+
+const { options, url, session, playwrightPackage } = JSON.parse(
+  readFileSync(0, "utf8"),
+);
+const require = createRequire(playwrightPackage);
+const { chromium } = require("@playwright/test");
+const origin = new URL(options.Host).origin;
+
+const browser = await chromium.launch({ headless: true });
+try {
+  const context = await browser.newContext({
+    viewport: { width: options.Width, height: options.Height },
+    colorScheme: "light",
+  });
+  await context.addInitScript(
+    ({ orgId, projectId }) => {
+      if (window.top !== window) return;
+      localStorage.setItem(
+        "persist:platform",
+        JSON.stringify({
+          currentOrgId: JSON.stringify(orgId),
+          currentProjectId: JSON.stringify(projectId),
+          selectedAIProviderId: "null",
+          selectedAIModel: "null",
+          _persist: JSON.stringify({ version: -1, rehydrated: true }),
+        }),
+      );
+    },
+    { orgId: options.OrgID, projectId: options.ProjectID },
+  );
+
+  await context.route("**/*", (route) => {
+    const request = route.request();
+    const parsed = new URL(request.url());
+    if (parsed.origin === origin && parsed.pathname === "/api/auth/session") {
+      return route.fulfill({
+        status: 200,
+        contentType: "application/json",
+        body: JSON.stringify(session),
+      });
+    }
+    if (request.method() !== "GET" && request.method() !== "HEAD") {
+      let query = "";
+      try {
+        query = request.postDataJSON()?.query?.trimStart() ?? "";
+      } catch {
+        // Non-GraphQL writes are blocked below.
+      }
+      if (
+        parsed.origin !== origin ||
+        !["/api/query", "/graphql"].includes(parsed.pathname) ||
+        !/^(query\b|\{)/.test(query)
+      ) {
+        return route.abort();
+      }
+    }
+    if (parsed.origin === origin && parsed.pathname.startsWith("/api/")) {
+      return route.continue({
+        headers: {
+          ...request.headers(),
+          authorization: `Bearer ${options.Token}`,
+          "x-whodb-org-id": options.OrgID,
+          "x-whodb-project-id": options.ProjectID,
+        },
+      });
+    }
+    return route.continue();
+  });
+
+  const page = await context.newPage();
+  const diagnostics = {
+    console_errors: [],
+    page_errors: [],
+    failed_requests: [],
+    http_error_responses: [],
+    action_errors: [],
+    script_errors: [],
+  };
+  const record = (items, value) => {
+    if (items.length < 30) items.push(String(value).slice(0, 500));
+  };
+  const cleanURL = (raw) => {
+    try {
+      const parsed = new URL(raw);
+      return `${parsed.origin}${parsed.pathname}`;
+    } catch {
+      return "unknown URL";
+    }
+  };
+  page.on("console", (message) => {
+    if (message.type() === "error") {
+      record(diagnostics.console_errors, message.text());
+    }
+  });
+  page.on("pageerror", (error) => record(diagnostics.page_errors, error.message));
+  page.on("requestfailed", (request) => {
+    record(
+      diagnostics.failed_requests,
+      `${request.method()} ${cleanURL(request.url())}: ${request.failure()?.errorText ?? "failed"}`,
+    );
+  });
+  page.on("response", (response) => {
+    if (response.status() >= 400) {
+      record(
+        diagnostics.http_error_responses,
+        `${response.status()} ${cleanURL(response.url())}`,
+      );
+    }
+  });
+  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
+  await page.waitForTimeout(15000);
+  const frame = page.frames().find((item) => item.url().endsWith("/sandbox.html"));
+  if (!frame) throw new Error("App sandbox did not render");
+  const waitForContent = async () => {
+    const deadline = Date.now() + 60000;
+    while (Date.now() < deadline) {
+      const text = await frame.locator("body").innerText();
+      if (text.includes("App not available")) {
+        throw new Error("App is not available in the selected environment");
+      }
+      if (text.trim().length >= 80 && !/\bloading\b/i.test(text)) {
+        await page.waitForTimeout(1500);
+        const settled = await frame.locator("body").innerText();
+        if (!/\bloading\b/i.test(settled)) return settled;
+      }
+      await page.waitForTimeout(1000);
+    }
+    throw new Error("App content did not finish loading; screenshot was not saved");
+  };
+  await waitForContent();
+  if (options.Tab) {
+    await frame.getByText(options.Tab, { exact: true }).first().click({ timeout: 5000 });
+    await page.waitForTimeout(8000);
+  }
+  await waitForContent();
+  for (const [index, action] of (options.Actions ?? []).entries()) {
+    try {
+      const locator = action.selector ? frame.locator(action.selector) : null;
+      switch (action.kind) {
+        case "click":
+          await locator.click({ timeout: 10000 });
+          break;
+        case "fill":
+          await locator.fill(a
```

**File**: `cli/internal/appcapture/discovery.go` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ */
+
+package appcapture
+
+import (
+	"context"
+	"encoding/json"
+	"fmt"
+	"net/url"
+	"strings"
+)
+
+// QueryClient is the hosted platform read API used to discover apps and pages.
+type QueryClient interface {
+	PlatformQuery(context.Context, string, map[string]any) (any, error)
+}
+
+// ListApps returns the apps in one authorized project.
+func ListApps(ctx context.Context, client QueryClient, projectID string) ([]App, error) {
+	data, err := client.PlatformQuery(ctx, "ProjectApps", map[string]any{"projectId": projectID})
+	if err != nil {
+		return nil, err
+	}
+	var apps []App
+	if err := decode(data, &apps); err != nil {
+		return nil, fmt.Errorf("decode apps: %w", err)
+	}
+	return apps, nil
+}
+
+// FindApp selects a project app by ID or case-insensitive exact name.
+func FindApp(apps []App, ref string) (*App, error) {
+	ref = strings.TrimSpace(ref)
+	for i := range apps {
+		if apps[i].ID == ref {
+			return &apps[i], nil
+		}
+	}
+	for i := range apps {
+		if strings.EqualFold(apps[i].Name, ref) {
+			return &apps[i], nil
+		}
+	}
+	return nil, fmt.Errorf("app %q was not found in the selected project", ref)
+}
+
+// ListViews returns the pages in the actual hosted app view.
+func ListViews(ctx context.Context, client QueryClient, options Options) ([]View, error) {
+	variables := map[string]any{"projectId": options.ProjectID, "id": options.AppID}
+	if options.Env == "dev" {
+		variables["env"] = "dev"
+	}
+	data, err := client.PlatformQuery(ctx, "AppView", variables)
+	if err != nil {
+		return nil, err
+	}
+	if data == nil {
+		return nil, fmt.Errorf("app is not available in %s environment", options.Env)
+	}
+	var appView struct {
+		Pages []string `json:"pages"`
+	}
+	if err := decode(data, &appView); err != nil {
+		return nil, fmt.Errorf("decode app view: %w", err)
+	}
+	if len(appView.Pages) == 0 {
+		appView.Pages = []string{"main"}
+	}
+	views := make([]View, 0, len(appView.Pages))
+	for _, name := range appView.Pages {
+		viewOptions := options
+		viewOptions.Page = name
+		viewOptions.Tab = ""
+		viewURL, err := viewOptions.URL()
+		if err != nil {
+			return nil, err
+		}
+		views = append(views, View{Page: name, URL: viewURL})
+	}
+	return views, nil
+}
+
+func decode(value any, target any) error {
+	raw, err := json.Marshal(value)
+	if err != nil {
+		return err
+	}
+	return json.Unmarshal(raw, target)
+}
+
+// ValidateHost rejects non-HTTP origins before a browser is started.
+func ValidateHost(host string) error {
+	parsed, err := url.Parse(host)
+	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
+		return fmt.Errorf("invalid hosted WhoDB URL")
+	}
+	return nil
+}
```

**File**: `cli/internal/appcapture/runtime.go` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ */
+
+package appcapture
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"os"
+	"os/exec"
+	"path/filepath"
+	"strings"
+)
+
+const playwrightVersion = "1.62.1"
+
+// RuntimeDir returns the user-owned directory for WhoDB's optional browser runtime.
+func RuntimeDir() (string, error) {
+	if path := strings.TrimSpace(os.Getenv("WHODB_CAPTURE_RUNTIME_DIR")); path != "" {
+		return filepath.Abs(path)
+	}
+	cache, err := os.UserCacheDir()
+	if err != nil {
+		return "", fmt.Errorf("find user cache: %w", err)
+	}
+	return filepath.Join(cache, "whodb", "app-capture"), nil
+}
+
+// SetupRuntime installs the optional Playwright package and Chromium in the user cache.
+// It is only called by an explicit CLI setup command or --install flag.
+func SetupRuntime(ctx context.Context) (string, error) {
+	if _, err := exec.LookPath("node"); err != nil {
+		return "", errors.New("Node.js is required; install Node.js, then run whodb apps setup-capture")
+	}
+	if _, err := exec.LookPath("npm"); err != nil {
+		return "", errors.New("npm is required; install Node.js with npm, then run whodb apps setup-capture")
+	}
+	dir, err := RuntimeDir()
+	if err != nil {
+		return "", err
+	}
+	if err := os.MkdirAll(dir, 0o755); err != nil {
+		return "", fmt.Errorf("create capture runtime: %w", err)
+	}
+	packageFile := filepath.Join(dir, "package.json")
+	if _, err := os.Stat(packageFile); errors.Is(err, os.ErrNotExist) {
+		if err := os.WriteFile(packageFile, []byte("{\"private\":true,\"name\":\"whodb-app-capture-runtime\",\"version\":\"1.0.0\"}\n"), 0o644); err != nil {
+			return "", fmt.Errorf("create capture package: %w", err)
+		}
+	} else if err != nil {
+		return "", err
+	}
+	packageName := "@playwright/test@" + playwrightVersion
+	install := exec.CommandContext(ctx, "npm", "install", "--prefix", dir, "--no-audit", "--no-fund", "--save-exact", packageName)
+	if output, err := install.CombinedOutput(); err != nil {
+		return "", fmt.Errorf("install %s: %w: %s", packageName, err, strings.TrimSpace(string(output)))
+	}
+	browserCLI := filepath.Join(dir, "node_modules", "playwright", "cli.js")
+	browser := exec.CommandContext(ctx, "node", browserCLI, "install", "chromium")
+	browser.Env = append(os.Environ(), "PLAYWRIGHT_BROWSERS_PATH="+filepath.Join(dir, "browsers"))
+	if output, err := browser.CombinedOutput(); err != nil {
+		return "", fmt.Errorf("install Chromium: %w: %s", err, strings.TrimSpace(string(output)))
+	}
+	return packageFile, nil
+}
+
+func findPlaywrightPackage() (string, error) {
+	if path := strings.TrimSpace(os.Getenv("WHODB_CAPTURE_PLAYWRIGHT_PACKAGE")); path != "" {
+		if hasPlaywrightPackage(path) {
+			return path, nil
+		}
+		return "", fmt.Errorf("@playwright/test is not installed beside %s; run whodb apps setup-capture", path)
+	}
+	if dir, err := RuntimeDir(); err == nil {
+		path := filepath.Join(dir, "package.json")
+		if hasPlaywrightPackage(path) {
+			return path, nil
+		}
+	}
+	cwd, err := os.Getwd()
+	if err != nil {
+		return "", err
+	}
+	for _, path := range []string{
+		filepath.Join(cwd, "frontend", "package.json"),
+		filepath.Join(cwd, "..", "frontend", "package.json"),
+		filepath.Join(cwd, "..", "whodb3", "frontend", "package.json"),
+	} {
+		if hasPlaywrightPackage(path) {
+			return path, nil
+		}
+	}
+	return "", errors.New("app capture needs Playwright and Chromium; run whodb apps setup-capture, or use whodb apps screenshot --install")
+}
+
+func hasPlaywrightPackage(packageFile string) bool {
+	if _, err := os.Stat(packageFile); err != nil {
+		return false
+	}
+	packageDir := filepath.Dir(packageFile)
+	if _, err := os.Stat(filepath.Join(packageDir, "node_modules", "@playwright", "test", "package.json")); err == nil {
+		return true
+	}
+	return false
+}
+
+func managedBrowserPath(packageFile string) string {
+	dir, err := RuntimeDir()
+	if err != nil || filepath.Clean(filepath.Dir(packageFile)) != filepath.Clean(dir) {
+		return ""
+	}
+	return filepath.Join(dir, "browsers")
+}
```

---

### Incident Patch 8: `7d64b4b6` (2026-09-29)
**Commit Message**: fix for sqlite auth bypass

**File**: `core/src/auth/session_store.go` (modified, +30/-11)
```diff
@@ -19,6 +19,7 @@ package auth
 import (
 	"context"
 	"crypto/rand"
+	"crypto/subtle"
 	"encoding/base64"
 	"encoding/json"
 	"errors"
@@ -43,6 +44,8 @@ import (
 // the data directory. It is distinct from any user-configured sqlite3 data source.
 const sessionDBFileName = "whodb.db"
 
+const sessionPayloadVersion = 1
+
 // errSessionNotFound indicates no live session matched the token.
 var errSessionNotFound = errors.New("session not found")
 
@@ -63,6 +66,13 @@ type sessionRow struct {
 	UpdatedAt            time.Time
 }
 
+type sessionPayload struct {
+	Version       int                 `json:"version"`
+	SessionHash   string              `json:"sessionHash"`
+	CSRFTokenHash string              `json:"csrfTokenHash"`
+	Credentials   *source.Credentials `json:"credentials"`
+}
+
 // TableName sets the table name for sessionRow.
 func (sessionRow) TableName() string { return "sessions" }
 
@@ -213,31 +223,36 @@ func CreateSession(credentials *source.Credentials, ttl time.Duration) (token, c
 		return "", "", time.Time{}, errors.New("session store not initialized")
 	}
 
-	// Marshaling the credentials (including any AccessToken) is intentional — the
-	// result is immediately AES-256-GCM encrypted before it is ever stored.
-	plaintext, err := json.Marshal(credentials) // #nosec G117 -- plaintext is immediately AES-256-GCM encrypted before storage.
+	token, err = randomToken(48)
 	if err != nil {
 		return "", "", time.Time{}, err
 	}
-	encrypted, err := crypto.Encrypt(key, string(plaintext))
+	csrfToken, err = randomToken(32)
 	if err != nil {
 		return "", "", time.Time{}, err
 	}
 
-	token, err = randomToken(48)
+	sessionHash := hashToken(token)
+	csrfTokenHash := hashToken(csrfToken)
+	plaintext, err := json.Marshal(sessionPayload{
+		Version:       sessionPayloadVersion,
+		SessionHash:   sessionHash,
+		CSRFTokenHash: csrfTokenHash,
+		Credentials:   credentials,
+	}) // #nosec G117 -- plaintext is immediately AES-256-GCM encrypted before storage.
 	if err != nil {
 		return "", "", time.Time{}, err
 	}
-	csrfToken, err = randomToken(32)
+	encrypted, err := crypto.Encrypt(key, string(plaintext))
 	if err != nil {
 		return "", "", time.Time{}, err
 	}
 
 	expiresAt = time.Now().Add(ttl)
 	row := sessionRow{
-		SessionHash:          hashToken(token),
+		SessionHash:          sessionHash,
 		EncryptedCredentials: encrypted,
-		CSRFTokenHash:        hashToken(csrfToken),
+		CSRFTokenHash:        csrfTokenHash,
 		ExpiresAt:            expiresAt,
 	}
 	if err := db.Create(&row).Error; err != nil {
@@ -277,14 +292,18 @@ func LookupSession(token string, ttl time.Duration) (creds *source.Credentials,
 		_ = db.Where("session_hash = ?", row.SessionHash).Delete(&sessionRow{}).Error
 		return nil, "", false, errSessionInvalid
 	}
-	credentials := &source.Credentials{}
-	if err := json.Unmarshal([]byte(plaintext), credentials); err != nil {
+	payload := sessionPayload{}
+	if err := json.Unmarshal([]byte(plaintext), &payload); err != nil ||
+		payload.Version != sessionPayloadVersion ||
+		payload.Credentials == nil ||
+		subtle.ConstantTimeCompare([]byte(payload.SessionHash), []byte(row.SessionHash)) != 1 ||
+		subtle.ConstantTimeCompare([]byte(payload.CSRFTokenHash), []byte(row.CSRFTokenHash)) != 1 {
 		_ = db.Where("session_hash = ?", row.SessionHash).Delete(&sessionRow{}).Error
 		return nil, "", false, errSessionInvalid
 	}
 
 	needsRefresh = time.Until(row.ExpiresAt) < ttl/2
-	return credentials, row.CSRFTokenHash, needsRefresh, nil
+	return payload.Credentials, row.CSRFTokenHash, needsRefresh, nil
 }
 
 // RefreshSession slides the session expiry forward by ttl from now.
```

**File**: `core/src/auth/session_store_test.go` (modified, +63/-0)
```diff
@@ -17,13 +17,15 @@
 package auth
 
 import (
+	"encoding/json"
 	"errors"
 	"sync"
 	"testing"
 	"time"
 
 	sqlite3 "github.com/mattn/go-sqlite3"
 
+	"github.com/clidey/whodb/core/src/crypto"
 	"github.com/clidey/whodb/core/src/source"
 )
 
@@ -78,6 +80,67 @@ func TestCreateAndLookupSession(t *testing.T) {
 	}
 }
 
+func TestLookupRejectsCredentialsCopiedBetweenSessions(t *testing.T) {
+	newTestStore(t)
+	victimToken, _, _, err := CreateSession(testCredentials(), time.Hour)
+	if err != nil {
+		t.Fatalf("create victim session: %v", err)
+	}
+	attackerCredentials := testCredentials()
+	attackerCredentials.Values["Hostname"] = "attacker.invalid"
+	attackerToken, _, _, err := CreateSession(attackerCredentials, time.Hour)
+	if err != nil {
+		t.Fatalf("create attacker session: %v", err)
+	}
+
+	var victim sessionRow
+	if err := sessionDB.Where("session_hash = ?", hashToken(victimToken)).First(&victim).Error; err != nil {
+		t.Fatalf("load victim session: %v", err)
+	}
+	if err := sessionDB.Model(&sessionRow{}).
+		Where("session_hash = ?", hashToken(attackerToken)).
+		Update("encrypted_credentials", victim.EncryptedCredentials).Error; err != nil {
+		t.Fatalf("copy victim credentials: %v", err)
+	}
+
+	if _, _, _, err := LookupSession(attackerToken, time.Hour); !errors.Is(err, errSessionInvalid) {
+		t.Fatalf("copied credentials returned %v, want errSessionInvalid", err)
+	}
+	credentials, _, _, err := LookupSession(victimToken, time.Hour)
+	if err != nil {
+		t.Fatalf("victim session should remain valid: %v", err)
+	}
+	if credentials.Values["Password"] != "s3cr3t" {
+		t.Fatalf("victim credentials changed: %#v", credentials.Values)
+	}
+}
+
+func TestLookupRejectsLegacyUnboundSession(t *testing.T) {
+	newTestStore(t)
+	token := "legacy-session-token"
+	csrfToken := "legacy-csrf-token"
+	plaintext, err := json.Marshal(testCredentials())
+	if err != nil {
+		t.Fatal(err)
+	}
+	encrypted, err := crypto.Encrypt(storeTestKey, string(plaintext))
+	if err != nil {
+		t.Fatal(err)
+	}
+	if err := sessionDB.Create(&sessionRow{
+		SessionHash:          hashToken(token),
+		EncryptedCredentials: encrypted,
+		CSRFTokenHash:        hashToken(csrfToken),
+		ExpiresAt:            time.Now().Add(time.Hour),
+	}).Error; err != nil {
+		t.Fatalf("create legacy session: %v", err)
+	}
+
+	if _, _, _, err := LookupSession(token, time.Hour); !errors.Is(err, errSessionInvalid) {
+		t.Fatalf("legacy session returned %v, want errSessionInvalid", err)
+	}
+}
+
 func TestLookupExpiredSession(t *testing.T) {
 	newTestStore(t)
 	// Negative TTL creates an already-expired row.
```

**File**: `core/src/plugins/sqlite3/db.go` (modified, +1/-2)
```diff
@@ -23,7 +23,6 @@ import (
 	"path/filepath"
 	"strings"
 
-	"gorm.io/driver/sqlite"
 	"gorm.io/gorm"
 	"gorm.io/gorm/logger"
 
@@ -111,7 +110,7 @@ func (p *Sqlite3Plugin) DB(config *engine.PluginConfig) (*gorm.DB, error) {
 		dsn = uri.String()
 	}
 
-	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(plugins.GetGormLogConfig())})
+	db, err := gorm.Open(sourceSQLiteDialector(dsn, false), &gorm.Config{Logger: logger.Default.LogMode(plugins.GetGormLogConfig())})
 	if err != nil {
 		l.WithError(err).Error("Failed to connect to SQLite database")
 		return nil, err
```

**File**: `core/src/plugins/sqlite3/driver.go` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package sqlite3
+
+import (
+	"database/sql"
+	"strings"
+
+	sqlitedriver "github.com/mattn/go-sqlite3"
+	sqlitegorm "gorm.io/driver/sqlite"
+	"gorm.io/gorm"
+
+	"github.com/clidey/whodb/core/src/env"
+)
+
+const (
+	confinedSQLiteDriverName         = "whodb_sqlite3_confined"
+	confinedReadOnlySQLiteDriverName = "whodb_sqlite3_confined_read_only"
+)
+
+func init() {
+	sql.Register(confinedSQLiteDriverName, confinedSQLiteDriver(false))
+	sql.Register(confinedReadOnlySQLiteDriverName, confinedSQLiteDriver(true))
+}
+
+func confinedSQLiteDriver(readOnly bool) *sqlitedriver.SQLiteDriver {
+	return &sqlitedriver.SQLiteDriver{
+		ConnectHook: func(conn *sqlitedriver.SQLiteConn) error {
+			conn.RegisterAuthorizer(func(operation int, argument1, _ string, _ string) int {
+				if operation == sqlitedriver.SQLITE_ATTACH || operation == sqlitedriver.SQLITE_DETACH {
+					return sqlitedriver.SQLITE_DENY
+				}
+				if readOnly && operation == sqlitedriver.SQLITE_PRAGMA && strings.EqualFold(argument1, "query_only") {
+					return sqlitedriver.SQLITE_DENY
+				}
+				return sqlitedriver.SQLITE_OK
+			})
+			return nil
+		},
+	}
+}
+
+func sourceSQLiteDialector(dsn string, readOnly bool) gorm.Dialector {
+	if env.GetIsLocalMode() {
+		return sqlitegorm.Open(dsn)
+	}
+	driverName := confinedSQLiteDriverName
+	if readOnly {
+		driverName = confinedReadOnlySQLiteDriverName
+	}
+	return sqlitegorm.New(sqlitegorm.Config{DriverName: driverName, DSN: dsn})
+}
```

**File**: `core/src/plugins/sqlite3/sample.go` (modified, +3/-3)
```diff
@@ -20,7 +20,6 @@ import (
 	_ "embed"
 	"sync"
 
-	"gorm.io/driver/sqlite"
 	"gorm.io/gorm"
 	"gorm.io/gorm/logger"
 
@@ -36,6 +35,7 @@ var sampleSQL string
 const SampleDatabaseName = "whodb-sample"
 
 const sampleDatabaseURI = "file:" + SampleDatabaseName + "?mode=memory&cache=shared"
+const readOnlySampleDatabaseURI = sampleDatabaseURI + "&_query_only=1"
 
 var (
 	sampleDBOnce sync.Once
@@ -58,7 +58,7 @@ func GetSampleProfile() types.DatabaseCredentials {
 
 func GetSampleDatabase() (*gorm.DB, error) {
 	sampleDBOnce.Do(func() {
-		db, err := gorm.Open(sqlite.Open(sampleDatabaseURI), &gorm.Config{
+		db, err := gorm.Open(sourceSQLiteDialector(sampleDatabaseURI, false), &gorm.Config{
 			Logger: logger.Default.LogMode(plugins.GetGormLogConfig()),
 		})
 		if err != nil {
@@ -78,7 +78,7 @@ func GetSampleDatabase() (*gorm.DB, error) {
 		return nil, sampleDBErr
 	}
 
-	return gorm.Open(sqlite.Open(sampleDatabaseURI), &gorm.Config{
+	return gorm.Open(sourceSQLiteDialector(readOnlySampleDatabaseURI, true), &gorm.Config{
 		Logger: logger.Default.LogMode(plugins.GetGormLogConfig()),
 	})
 }
```

**File**: `core/src/plugins/sqlite3/sqlite3_runtime_test.go` (modified, +71/-0)
```diff
@@ -18,6 +18,8 @@ package sqlite3
 
 import (
 	"context"
+	"errors"
+	"os"
 	"path/filepath"
 	"testing"
 
@@ -32,6 +34,75 @@ import (
 	_ "github.com/clidey/whodb/core/src/sources/database"
 )
 
+func TestServerSQLiteConnectionsRejectFilesystemAttachment(t *testing.T) {
+	t.Setenv("WHODB_CLI", "false")
+	t.Setenv("WHODB_DESKTOP", "false")
+
+	db, err := gorm.Open(sourceSQLiteDialector(":memory:", false), &gorm.Config{})
+	if err != nil {
+		t.Fatalf("open confined SQLite connection: %v", err)
+	}
+	sqlDB, err := db.DB()
+	if err != nil {
+		t.Fatalf("get confined SQLite handle: %v", err)
+	}
+	t.Cleanup(func() { _ = sqlDB.Close() })
+
+	targetPath := filepath.Join(t.TempDir(), "attached.sqlite")
+	queries := []struct {
+		name  string
+		query string
+		args  []any
+	}{
+		{name: "literal", query: "ATTACH DATABASE '" + targetPath + "' AS attached"},
+		{name: "bound filename", query: "ATTACH DATABASE ? AS attached", args: []any{targetPath}},
+	}
+	for _, tt := range queries {
+		t.Run(tt.name, func(t *testing.T) {
+			if err := db.Exec(tt.query, tt.args...).Error; err == nil {
+				t.Fatal("expected filesystem attachment to be denied")
+			}
+		})
+	}
+
+	vacuumPath := filepath.Join(t.TempDir(), "vacuum.sqlite")
+	if err := db.Exec("VACUUM INTO ?", vacuumPath).Error; err == nil {
+		t.Fatal("expected VACUUM INTO to be denied")
+	}
+	if _, err := os.Stat(vacuumPath); !errors.Is(err, os.ErrNotExist) {
+		t.Fatalf("VACUUM INTO created an output file: %v", err)
+	}
+}
+
+func TestServerSampleDatabaseIsReadOnly(t *testing.T) {
+	t.Setenv("WHODB_CLI", "false")
+	t.Setenv("WHODB_DESKTOP", "false")
+
+	db, err := GetSampleDatabase()
+	if err != nil {
+		t.Fatalf("open sample database: %v", err)
+	}
+	sqlDB, err := db.DB()
+	if err != nil {
+		t.Fatalf("get sample database handle: %v", err)
+	}
+	t.Cleanup(func() { _ = sqlDB.Close() })
+
+	var count int64
+	if err := db.Table("users").Count(&count).Error; err != nil {
+		t.Fatalf("read sample data: %v", err)
+	}
+	if count == 0 {
+		t.Fatal("expected seeded sample rows")
+	}
+	if err := db.Exec("CREATE TABLE attacker_controlled (id INTEGER)").Error; err == nil {
+		t.Fatal("expected sample database write to be denied")
+	}
+	if err := db.Exec("PRAGMA query_only=OFF").Error; err == nil {
+		t.Fatal("expected disabling sample query_only to be denied")
+	}
+}
+
 func newSQLiteRuntimeTestFixture(t *testing.T, statements ...string) (*Sqlite3Plugin, *engine.PluginConfig, *gorm.DB) {
 	t.Helper()
 
```

---

### Incident Patch 9: `cf6828f1` (2026-09-29)
**Commit Message**: fix for profile login and sessions

**File**: `core/graph/resolver_mutation_test.go` (modified, +83/-0)
```diff
@@ -40,6 +40,7 @@ import (
 	"github.com/clidey/whodb/core/src/settings"
 	"github.com/clidey/whodb/core/src/source"
 	"github.com/clidey/whodb/core/src/sourcecatalog"
+	"github.com/clidey/whodb/core/src/types"
 )
 
 func TestAddRowSuccess(t *testing.T) {
@@ -383,6 +384,88 @@ func TestGraphQLAuthorizationRejectsOperationNameSpoofBeforeMutation(t *testing.
 	}
 }
 
+func TestLoginWithSourceProfileRejectsAnonymousConnectionRedirection(t *testing.T) {
+	mock := testutil.NewPluginMock(engine.DatabaseType("Postgres"))
+	connectionAttempts := 0
+	mock.IsAvailableFunc = func(context.Context, *engine.PluginConfig) bool {
+		connectionAttempts++
+		return false
+	}
+	setEngineMock(t, mock)
+	src.MainEngine.AddLoginProfile(types.DatabaseCredentials{
+		CustomId:  "production",
+		Type:      "Postgres",
+		Hostname:  "db.internal",
+		Port:      "5432",
+		Username:  "reader",
+		Password:  "server-owned-secret",
+		Database:  "app",
+		Source:    "environment",
+		IsProfile: true,
+		Advanced:  map[string]string{"SSL Mode": "verify-full"},
+	})
+
+	graphQLServer := handler.NewDefaultServer(NewExecutableSchema(Config{Resolvers: &Resolver{}}))
+	graphQLServer.AroundOperations(auth.GraphQLAuthorizationMiddleware)
+	srv := auth.AuthMiddleware(graphQLServer)
+	body := `{"operationName":"LoginWithSourceProfile","query":"mutation LoginWithSourceProfile($profile: SourceProfileLoginInput!) { LoginWithSourceProfile(profile: $profile) { Status } }","variables":{"profile":{"Id":"production","Values":[{"Key":"Hostname","Value":"attacker.example"},{"Key":"Port","Value":"443"},{"Key":"SSL Mode","Value":"disabled"}]}}}`
+	if strings.Contains(body, "server-owned-secret") {
+		t.Fatal("test request must not contain the stored password")
+	}
+	req := httptest.NewRequest(http.MethodPost, "/api/query", strings.NewReader(body))
+	req.Header.Set("Content-Type", "application/json")
+	w := httptest.NewRecorder()
+
+	srv.ServeHTTP(w, req)
+
+	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "source profile connection fields cannot be overridden") {
+		t.Fatalf("expected profile override to be rejected, got status %d body %s", w.Code, w.Body.String())
+	}
+	if connectionAttempts != 0 {
+		t.Fatalf("expected rejection before any connection attempt, got %d attempts", connectionAttempts)
+	}
+}
+
+func TestLoginSourceDoesNotReuseSessionSecretsForConnectionRedirection(t *testing.T) {
+	mock := testutil.NewPluginMock(engine.DatabaseType("Postgres"))
+	var attempted *engine.Credentials
+	mock.IsAvailableFunc = func(_ context.Context, config *engine.PluginConfig) bool {
+		attempted = config.Credentials
+		return false
+	}
+	setEngineMock(t, mock)
+	ctx := testSourceContext("Postgres", map[string]string{
+		"Hostname": "db.internal",
+		"Username": "reader",
+		"Password": "server-owned-secret",
+		"Database": "app",
+		"Port":     "5432",
+		"SSL Mode": "verify-full",
+	})
+
+	_, err := (&Resolver{}).Mutation().LoginSource(ctx, model.SourceLoginInput{
+		SourceType: "Postgres",
+		Values: []*model.RecordInput{
+			{Key: "Hostname", Value: "attacker.example"},
+			{Key: "Port", Value: "443"},
+			{Key: "SSL Mode", Value: "disabled"},
+		},
+	})
+
+	if err == nil {
+		t.Fatal("expected redirected connection without credentials to fail")
+	}
+	if attempted == nil {
+		t.Fatal("expected independent connection attempt")
+	}
+	if attempted.Password != "" || attempted.Username != "" {
+		t.Fatalf("session credentials were reused for redirected connection: %#v", attempted)
+	}
+	if attempted.Hostname != "attacker.example" {
+		t.Fatalf("expected independent request values to be retained, got %#v", attempted)
+	}
+}
+
 func TestLoginFailsWhenPluginUnavailable(t *testing.T) {
 	resolver := &Resolver{}
 	mut := resolver.Mutation()
```

**File**: `core/graph/schema.resolvers.go` (modified, +3/-3)
```diff
@@ -43,7 +43,7 @@ import (
 func (r *mutationResolver) LoginSource(ctx context.Context, credentials model.SourceLoginInput) (*model.StatusResponse, error) {
 	creds := sourceCredentialsFromInput(credentials)
 	if current := auth.GetSourceCredentials(ctx); current != nil && current.SourceType == creds.SourceType {
-		creds.Values = mergeCredentialValues(current.CloneValues(), creds.Values)
+		creds.Values = mergeCurrentSourceValues(current, creds.Values)
 	}
 	return performSourceLogin(ctx, creds, "")
 }
@@ -55,7 +55,7 @@ func (r *mutationResolver) LoginWithSourceProfile(ctx context.Context, profile m
 		return nil, errors.New("login profile does not exist or is not authorized")
 	}
 
-	values, err := auth.MergeSourceProfileValues(credentials.Values, recordInputsToMap(profile.Values))
+	values, err := auth.MergeSourceProfileValues(credentials.SourceType, credentials.Values, recordInputsToMap(profile.Values))
 	if err != nil {
 		return nil, err
 	}
@@ -1134,7 +1134,7 @@ func (r *queryResolver) SourceFieldOptions(ctx context.Context, sourceType strin
 		Values:     recordInputsToMap(values),
 	}
 	if current := auth.GetSourceCredentials(ctx); current != nil && current.SourceType == sourceType {
-		credentials.Values = mergeCredentialValues(current.CloneValues(), credentials.Values)
+		credentials.Values = mergeCurrentSourceValues(current, credentials.Values)
 	}
 
 	session, err := source.Open(ctx, spec, credentials)
```

**File**: `core/graph/source_helpers.go` (modified, +5/-5)
```diff
@@ -20,7 +20,6 @@ import (
 	"context"
 	"errors"
 	"fmt"
-	"maps"
 	"slices"
 	"strconv"
 
@@ -618,10 +617,11 @@ func scopeValueForKind(spec source.TypeSpec, ref source.ObjectRef, kind source.O
 	return ref.Path[index]
 }
 
-func mergeCredentialValues(base map[string]string, overrides map[string]string) map[string]string {
-	merged := map[string]string{}
-	maps.Copy(merged, base)
-	maps.Copy(merged, overrides)
+func mergeCurrentSourceValues(current *source.Credentials, requested map[string]string) map[string]string {
+	merged, err := auth.MergeSourceProfileValues(current.SourceType, current.Values, requested)
+	if err != nil {
+		return requested
+	}
 	return merged
 }
 
```

**File**: `core/src/auth/auth.go` (modified, +14/-9)
```diff
@@ -23,11 +23,11 @@ import (
 	"errors"
 	"maps"
 	"net/http"
+	"slices"
 	"strings"
 	"sync"
 
 	"github.com/clidey/whodb/core/src"
-	"github.com/clidey/whodb/core/src/common/ssl"
 	"github.com/clidey/whodb/core/src/log"
 	"github.com/clidey/whodb/core/src/source"
 	"github.com/clidey/whodb/core/src/sourcecatalog"
@@ -176,7 +176,7 @@ func AuthMiddleware(next http.Handler) http.Handler {
 			_, storedProfile, ok := src.FindSourceProfile(*credentials.ID)
 			if ok {
 				storedProfile.ID = credentials.ID
-				storedProfile.Values, err = MergeSourceProfileValues(storedProfile.Values, credentials.Values)
+				storedProfile.Values, err = MergeSourceProfileValues(storedProfile.SourceType, storedProfile.Values, credentials.Values)
 				if err != nil {
 					http.Error(w, err.Error(), http.StatusBadRequest)
 					return
@@ -189,7 +189,7 @@ func AuthMiddleware(next http.Handler) http.Handler {
 			if !matched {
 				if stored, err := LoadCredentials(*credentials.ID); err == nil && stored != nil {
 					stored.ID = credentials.ID
-					stored.Values, err = MergeSourceProfileValues(stored.Values, credentials.Values)
+					stored.Values, err = MergeSourceProfileValues(stored.SourceType, stored.Values, credentials.Values)
 					if err != nil {
 						http.Error(w, err.Error(), http.StatusBadRequest)
 						return
@@ -285,16 +285,21 @@ func RegisterAuthBypass(fn func(*http.Request) bool) {
 	authBypassFn = fn
 }
 
-// MergeSourceProfileValues merges client overrides while keeping server-side
-// TLS file paths under the control of the stored profile.
-func MergeSourceProfileValues(base map[string]string, overrides map[string]string) (map[string]string, error) {
-	for _, key := range []string{ssl.KeySSLCACertPath, ssl.KeySSLClientCertPath, ssl.KeySSLClientKeyPath} {
-		if value, ok := overrides[key]; ok && value != base[key] {
-			return nil, errors.New("SSL file paths cannot be overridden by clients")
+// MergeSourceProfileValues applies the database selection supported by a
+// stored profile while keeping every connection target and secret server-owned.
+func MergeSourceProfileValues(sourceType string, base map[string]string, overrides map[string]string) (map[string]string, error) {
+	for key := range overrides {
+		if key != "Database" || !sourceSupportsDatabaseSwitching(sourceType) {
+			return nil, errors.New("source profile connection fields cannot be overridden")
 		}
 	}
 	merged := map[string]string{}
 	maps.Copy(merged, base)
 	maps.Copy(merged, overrides)
 	return merged, nil
 }
+
+func sourceSupportsDatabaseSwitching(sourceType string) bool {
+	spec, ok := sourcecatalog.Find(sourceType)
+	return ok && slices.Contains(spec.Contract.BrowsePath, source.ObjectKindDatabase)
+}
```

**File**: `core/src/auth/auth_middleware_test.go` (modified, +6/-6)
```diff
@@ -189,23 +189,23 @@ func TestAuthMiddlewareResolvesIDOnlyCredentialsFromProfiles(t *testing.T) {
 	}
 }
 
-func TestAuthMiddlewareRejectsProfileSSLPathOverride(t *testing.T) {
+func TestAuthMiddlewareRejectsProfileConnectionOverride(t *testing.T) {
 	origEngine := src.MainEngine
 	src.MainEngine = &engine.Engine{}
 	t.Cleanup(func() { src.MainEngine = origEngine })
 
 	src.MainEngine.AddLoginProfile(types.DatabaseCredentials{
-		CustomId:  "profile-with-ca",
+		CustomId:  "profile-with-secret",
 		Type:      "Postgres",
 		Hostname:  "db.local",
 		IsProfile: true,
-		Advanced:  map[string]string{ssl.KeySSLCACertPath: "/trusted/ca.pem"},
+		Advanced:  map[string]string{ssl.KeySSLMode: "verify-full"},
 	})
 
-	id := "profile-with-ca"
+	id := "profile-with-secret"
 	creds := source.Credentials{
 		ID:     &id,
-		Values: map[string]string{ssl.KeySSLCACertPath: "/attacker/ca.pem"},
+		Values: map[string]string{"Hostname": "attacker.example", ssl.KeySSLMode: "disabled"},
 	}
 	payload, err := json.Marshal(&creds)
 	if err != nil {
@@ -221,7 +221,7 @@ func TestAuthMiddlewareRejectsProfileSSLPathOverride(t *testing.T) {
 	})).ServeHTTP(rr, req)
 
 	if rr.Code != http.StatusBadRequest || called {
-		t.Fatalf("expected profile path override to be rejected, got status=%d called=%v", rr.Code, called)
+		t.Fatalf("expected profile connection override to be rejected, got status=%d called=%v", rr.Code, called)
 	}
 }
 
```

**File**: `core/src/auth/auth_test.go` (modified, +23/-13)
```diff
@@ -25,7 +25,6 @@ import (
 	"strings"
 	"testing"
 
-	"github.com/clidey/whodb/core/src/common/ssl"
 	"github.com/clidey/whodb/core/src/env"
 	"github.com/clidey/whodb/core/src/source"
 )
@@ -42,23 +41,34 @@ func TestIsPublicRouteUsesOnlyTheRequestPath(t *testing.T) {
 	}
 }
 
-func TestMergeSourceProfileValuesRejectsSSLPathOverrides(t *testing.T) {
-	for _, key := range []string{ssl.KeySSLCACertPath, ssl.KeySSLClientCertPath, ssl.KeySSLClientKeyPath} {
+func TestMergeSourceProfileValuesRestrictsOverridesToDatabaseSwitching(t *testing.T) {
+	base := map[string]string{
+		"Hostname": "db.internal",
+		"Port":     "5432",
+		"Username": "reader",
+		"Password": "secret",
+		"Database": "default",
+		"SSL Mode": "verify-full",
+	}
+	for _, key := range []string{"Hostname", "Port", "Username", "Password", "SSL Mode", "URL Params"} {
 		t.Run(key, func(t *testing.T) {
-			base := map[string]string{key: "/trusted/path", "Database": "default"}
-			if _, err := MergeSourceProfileValues(base, map[string]string{key: "/attacker/path"}); err == nil {
+			if _, err := MergeSourceProfileValues("Postgres", base, map[string]string{key: base[key]}); err == nil {
 				t.Fatalf("expected %s override to be rejected", key)
 			}
-
-			merged, err := MergeSourceProfileValues(base, map[string]string{key: "/trusted/path", "Database": "override"})
-			if err != nil {
-				t.Fatalf("expected unchanged path to be accepted: %v", err)
-			}
-			if merged["Database"] != "override" {
-				t.Fatalf("expected ordinary profile override to be retained, got %#v", merged)
-			}
 		})
 	}
+
+	merged, err := MergeSourceProfileValues("Postgres", base, map[string]string{"Database": "reporting"})
+	if err != nil {
+		t.Fatalf("expected database switch to be accepted: %v", err)
+	}
+	if merged["Database"] != "reporting" || merged["Hostname"] != "db.internal" || merged["Password"] != "secret" {
+		t.Fatalf("expected only the database to change, got %#v", merged)
+	}
+
+	if _, err := MergeSourceProfileValues("Sqlite3", base, map[string]string{"Database": "/tmp/attacker.db"}); err == nil {
+		t.Fatal("expected file-backed database override to be rejected")
+	}
 }
 
 func TestAuthMiddlewareExtractsCredentialsFromBearer(t *testing.T) {
```

---

### Incident Patch 10: `d325b183` (2026-09-29)
**Commit Message**: chat fixes

**File**: `cli/pkg/mcp/tools_test.go` (modified, +10/-0)
```diff
@@ -54,6 +54,11 @@ func TestHandleQuery_ReadOnlyBlocksWrites(t *testing.T) {
 		{"CREATE blocked", "CREATE TABLE foo (id int)"},
 		{"ALTER blocked", "ALTER TABLE users ADD col int"},
 		{"TRUNCATE blocked", "TRUNCATE TABLE users"},
+		{"Postgres file read blocked", "SELECT pg_read_file('/etc/passwd', 0, 100000)"},
+		{"Postgres file export blocked", "SELECT lo_export(1, '/tmp/export')"},
+		{"MySQL file read blocked", "SELECT LOAD_FILE('/etc/passwd')"},
+		{"MySQL OUTFILE blocked", "SELECT 1 INTO\nOUTFILE '/tmp/export'"},
+		{"MySQL DUMPFILE blocked", "SELECT 1 INTO DUMPFILE '/tmp/export'"},
 	}
 
 	for _, tc := range blockedQueries {
@@ -141,6 +146,11 @@ func TestHandleQuery_ConfirmWritesMode(t *testing.T) {
 		"INSERT INTO users VALUES (1, 'test')",
 		"UPDATE users SET name='x' WHERE id=1",
 		"DELETE FROM users WHERE id=1",
+		"SELECT pg_read_file('/etc/passwd', 0, 100000)",
+		"SELECT lo_export(1, '/tmp/export')",
+		"SELECT LOAD_FILE('/etc/passwd')",
+		"SELECT 1 INTO\nOUTFILE '/tmp/export'",
+		"SELECT 1 INTO DUMPFILE '/tmp/export'",
 	}
 
 	for _, query := range writeQueries {
```

**File**: `core/src/bamlconfig/chat_baml_test.go` (modified, +7/-1)
```diff
@@ -219,7 +219,13 @@ func TestSetupAIClientAndCreateDynamicBAMLClient(t *testing.T) {
 }
 
 func TestPlannerCannotLabelWritesAsReads(t *testing.T) {
-	for _, query := range []string{"SELECT * INTO stolen FROM users", "SELECT 1; DELETE FROM users", "SELECT side_effect()"} {
+	for _, query := range []string{
+		"DELETE FROM users",
+		"DROP TABLE users",
+		"SELECT * INTO stolen FROM users",
+		"SELECT 1; DELETE FROM users",
+		"SELECT side_effect()",
+	} {
 		op := types.OperationTypeGET
 		runner := &queryExecutorStub{}
 		message := ProcessChatResponse(t.Context(), &types.ChatResponse{Type: types.ChatMessageTypeSQL, Operation: &op, Text: query}, runner)
```

**File**: `core/src/plugins/sqlite3/sqlite3_runtime_test.go` (modified, +37/-0)
```diff
@@ -17,14 +17,18 @@
 package sqlite3
 
 import (
+	"context"
 	"path/filepath"
 	"testing"
 
 	"gorm.io/driver/sqlite"
 	"gorm.io/gorm"
 
+	"github.com/clidey/whodb/core/baml_client/types"
+	"github.com/clidey/whodb/core/src/bamlconfig"
 	"github.com/clidey/whodb/core/src/engine"
 	"github.com/clidey/whodb/core/src/importer"
+	"github.com/clidey/whodb/core/src/source"
 	_ "github.com/clidey/whodb/core/src/sources/database"
 )
 
@@ -109,6 +113,39 @@ func TestSQLiteReadOnlyRawExecuteRejectsWrites(t *testing.T) {
 	}
 }
 
+func TestChatPlannerMislabelledWriteDoesNotChangeSQLiteState(t *testing.T) {
+	plugin, config, db := newSQLiteRuntimeTestFixture(t,
+		"CREATE TABLE chat_guard (id INTEGER PRIMARY KEY)",
+		"INSERT INTO chat_guard VALUES (1)",
+	)
+	operation := types.OperationTypeGET
+	executions := 0
+	executor := bamlconfig.ChatQueryExecutorFunc(func(_ context.Context, query string, params ...any) (*source.RowsResult, error) {
+		executions++
+		return plugin.RawExecute(config, query, params...)
+	})
+
+	message := bamlconfig.ProcessChatResponse(t.Context(), &types.ChatResponse{
+		Type:      types.ChatMessageTypeSQL,
+		Operation: &operation,
+		Text:      "DELETE FROM chat_guard",
+	}, executor)
+
+	if !message.RequiresConfirmation {
+		t.Fatalf("mislabelled write did not require confirmation: %#v", message)
+	}
+	if executions != 0 {
+		t.Fatalf("mislabelled write reached the executor %d times", executions)
+	}
+	var count int64
+	if err := db.Table("chat_guard").Count(&count).Error; err != nil {
+		t.Fatal(err)
+	}
+	if count != 1 {
+		t.Fatalf("mislabelled write changed database state: row count = %d", count)
+	}
+}
+
 func TestSQLiteColumnMetadataAndGeneratedColumns(t *testing.T) {
 	plugin, config, db := newSQLiteRuntimeTestFixture(t,
 		`CREATE TABLE parents (id INTEGER PRIMARY KEY, name TEXT);`,
```

**File**: `core/src/sqlguard/security_test.go` (modified, +3/-1)
```diff
@@ -5,7 +5,9 @@ import "testing"
 func TestProtectedReadsFailClosed(t *testing.T) {
 	for _, query := range []string{
 		"SELECT * INTO copy FROM users", "SELECT * FROM users INTO OUTFILE '/tmp/dump'",
-		"SELECT data FROM blobs INTO DUMPFILE '/tmp/dump'", "SELECT 1; USE other_database",
+		"SELECT data FROM blobs INTO DUMPFILE '/tmp/dump'", "SELECT 1 INTO\nOUTFILE '/tmp/dump'",
+		"SELECT pg_read_file('/etc/passwd', 0, 100000)", "SELECT lo_export(1, '/tmp/export')",
+		"SELECT LOAD_FILE('/etc/passwd')", "SELECT 1; USE other_database",
 		"SELECT 1; FLURB anything", "SELECT 1 /*! INTO OUTFILE '/tmp/dump' */",
 		"SELECT 1 /*M! INTO OUTFILE '/tmp/dump' */", "SELECT set_config('search_path', 'evil', false)",
 		"SELECT nextval('seq')", "SELECT seq.nextval FROM dual", `SELECT seq."NEXTVAL" FROM dual`, "SELECT pg_advisory_lock(1)", "SELECT readfile('/tmp/secret')",
```

---

### Incident Patch 11: `1246c8e0` (2026-09-28)
**Commit Message**: fix for mcp omiting local source path on upload

**File**: `.agents/docs/hosted-platform-cli.md` (modified, +9/-0)
```diff
@@ -247,6 +247,15 @@ the default mode. They return a confirmation token, and the write runs only
 after approval through `whodb_platform_confirm`. Use `whodb_platform_pending`
 to recover active confirmation tokens.
 
+Upload previews must show the stored absolute source path and destination across
+write plans, confirmations, and pending-action retrieval. Keep this display
+exception specific to uploads; do not relax secret detection for persisted
+workflows or send paths to telemetry. Confirmation tokens are available to the
+model and do not independently prove human approval. File contents and symlink
+targets are not snapshotted at preview time. See the CLI guide's
+[upload review and confirmation limitations](../../cli/README.md#upload-review-and-confirmation-limitations)
+for the user-facing security contract.
+
 Generic write tools are capability-backed. Before using
 `whodb_platform_create`, `whodb_platform_update`, `whodb_platform_delete`, or
 `whodb_platform_action`, agents should read `whodb://platform/schema` and use
```

**File**: `cli/README.md` (modified, +29/-0)
```diff
@@ -931,6 +931,35 @@ safe, and allow-write modes.
 
 Write operations require confirmation by default. Use `--allow-write` to disable confirmations, or `--read-only` to block writes entirely.
 
+#### Upload review and confirmation limitations
+
+For file uploads, the write plan, confirmation preview, and pending-action list
+show the full absolute source path, destination host and project, and folder ID
+(`null` means the project root). The summary quotes the path and escapes control
+characters. Relative paths are resolved against the MCP server's working
+directory when the action is prepared; confirmation uses that stored absolute
+path. A literal `~` is not expanded to the user's home directory.
+
+The CLI reads file contents only when the upload executes. The preview approves
+a path, not an immutable file snapshot: replacing the file or changing a symlink
+before execution can change the uploaded contents. This flow does not sandbox
+local file access; the CLI can read files permitted by its operating-system
+identity.
+
+**A confirmation token does not independently prove human approval.** The model
+receives the token and can call `whodb_platform_confirm`. The assistant is
+instructed to ask the user first, but an independent approval guarantee requires
+the MCP host or another trusted interaction outside the model's control to
+enforce that approval. Clear previews support informed review; they do not
+prevent a malicious or prompt-injected model from calling available tools.
+Use `--read-only` or `--safe-mode` to hide hosted write tools when writes are not
+needed. `--allow-write` executes uploads without the CLI confirmation step.
+
+Upload source paths are intentionally visible to the MCP client for review.
+They are excluded from WhoDB upload telemetry; client-side logging and retention
+are controlled by the MCP host. Other sensitive fields remain redacted, and
+persisted workflow payloads still reject local file paths.
+
 ### Transport Modes
 
 **stdio (default)** - For local CLI integration with Claude Desktop, Claude Code, etc.
```

**File**: `cli/pkg/mcp/platform_tools.go` (modified, +17/-4)
```diff
@@ -487,7 +487,7 @@ func (o PlatformPendingOutput) MarshalJSON() ([]byte, error) {
 	return json.Marshal(Alias(o))
 }
 
-// PlatformActionPreview describes a pending hosted source write without secrets.
+// PlatformActionPreview describes a hosted write with secrets redacted and upload source paths visible.
 type PlatformActionPreview struct {
 	Operation    string                `json:"operation"`
 	Resource     string                `json:"resource,omitempty"`
@@ -1527,7 +1527,7 @@ func platformActionFieldChanges(action *PendingPlatformAction) []PlatformFieldCh
 	changes := make([]PlatformFieldChange, 0, len(keys))
 	for _, key := range keys {
 		value := values[key]
-		if sensitivePlatformWriteKey(key) {
+		if sensitivePlatformWriteKey(key) && (action.Mutation != "UploadProjectFile" || key != "filePath") {
 			changes = append(changes, PlatformFieldChange{Field: key, After: map[string]any{"value": "[redacted]"}, Redacted: true})
 			continue
 		}
@@ -2175,17 +2175,29 @@ func listPendingPlatformActions() []*PendingPlatformAction {
 	return actions
 }
 
+// Preview returns the review details shared by write plans, confirmations, and pending actions.
 func (action *PendingPlatformAction) Preview() *PlatformActionPreview {
 	if action == nil {
 		return nil
 	}
 	changes := append([]string(nil), action.Changes...)
+	summary := action.Summary
+	if action.Mutation == "UploadProjectFile" {
+		// The source path is essential for approval, but stays sensitive in persisted workflows.
+		filePath, _ := action.Variables["filePath"].(string)
+		summary = fmt.Sprintf("Upload file %q", filePath)
+		for i, change := range changes {
+			if change == "filePath (redacted)" {
+				changes[i] = "filePath"
+			}
+		}
+	}
 	willAffect := platformActionWillAffect(action, changes)
 	return &PlatformActionPreview{
 		Operation:    action.Operation,
 		Resource:     action.Resource,
 		Action:       action.Action,
-		Summary:      action.Summary,
+		Summary:      summary,
 		Host:         action.Host,
 		OrgID:        action.OrgID,
 		ProjectID:    action.ProjectID,
@@ -2598,4 +2610,5 @@ Use this to recover confirmation tokens returned by hosted platform write tools.
 
 const descPlatformConfirm = `Confirm and execute a pending hosted WhoDB platform write.
 
-Use the confirmation_token returned by hosted platform write tools. Tokens expire after 5 minutes. Only call this after the user has approved the pending write preview.`
+Use the confirmation_token returned by hosted platform write tools. Tokens expire after 5 minutes. Only call this after the user has approved the pending write preview.
+The token does not independently prove human approval: the MCP host must enforce approval if that guarantee is required. For uploads, review the full local source path and destination; the file is read at execution time, not snapshotted when the preview is created.`
```

**File**: `cli/pkg/mcp/platform_tools_test.go` (modified, +6/-5)
```diff
@@ -649,7 +649,7 @@ func TestHandlePlatformGenericFolderDeleteConfirmsNestedDeletion(t *testing.T) {
 	}
 }
 
-func TestHandlePlatformGenericFileUploadConfirmWritesRedactsPreview(t *testing.T) {
+func TestHandlePlatformGenericFileUploadConfirmWritesShowsSourcePath(t *testing.T) {
 	client := &fakePlatformClient{}
 	withPlatformSessionLoader(t, func(context.Context) (*platformToolSession, error) {
 		return testPlatformSession(client), nil
@@ -669,18 +669,19 @@ func TestHandlePlatformGenericFileUploadConfirmWritesRedactsPreview(t *testing.T
 	if !output.ConfirmationRequired || output.ConfirmationToken == "" {
 		t.Fatalf("output = %#v, want confirmation token", output)
 	}
+	t.Cleanup(func() { consumePendingPlatformAction(output.ConfirmationToken) })
 	raw, err := json.Marshal(output)
 	if err != nil {
 		t.Fatalf("json.Marshal(output) error = %v", err)
 	}
-	if strings.Contains(string(raw), "/tmp/private.csv") {
-		t.Fatalf("confirmation preview leaked local file path: %s", raw)
+	if !strings.Contains(string(raw), "/tmp/private.csv") {
+		t.Fatalf("confirmation preview omitted local file path: %s", raw)
 	}
 	if output.ConfirmationPreview == nil || output.ConfirmationPreview.Resource != "file" || output.ConfirmationPreview.Action != "upload" {
 		t.Fatalf("preview = %#v, want file upload preview", output.ConfirmationPreview)
 	}
-	if output.ConfirmationPreview.Summary != "Upload file" {
-		t.Fatalf("preview summary = %q, want generic upload summary", output.ConfirmationPreview.Summary)
+	if output.ConfirmationPreview.Summary != `Upload file "/tmp/private.csv"` {
+		t.Fatalf("preview summary = %q, want upload source path", output.ConfirmationPreview.Summary)
 	}
 	if client.mutationName != "" {
 		t.Fatalf("mutation executed in confirm-writes mode: %q", client.mutationName)
```

**File**: `cli/pkg/mcp/platform_upload_test.go` (added, +250/-0)
```diff
@@ -0,0 +1,250 @@
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package mcp
+
+import (
+	"context"
+	"encoding/json"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"os"
+	"path/filepath"
+	"reflect"
+	"slices"
+	"strconv"
+	"strings"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	platformapi "github.com/clidey/whodb/cli/internal/platform"
+)
+
+func TestPlatformUploadReviewSurfaces(t *testing.T) {
+	t.Chdir(t.TempDir())
+	cwd, err := os.Getwd()
+	if err != nil {
+		t.Fatal(err)
+	}
+	for _, path := range []string{"./customers.csv", "reports/customer names.csv", "quote\"line\n\t.csv", "~/.ssh/id_rsa", filepath.Join(cwd, "absolute.csv")} {
+		t.Run(strconv.Quote(path), func(t *testing.T) {
+			client := &fakePlatformClient{}
+			session := testPlatformSession(client)
+			withPlatformSessionLoader(t, func(context.Context) (*platformToolSession, error) { return session, nil })
+			input := PlatformGenericWriteInput{Resource: "file", Action: "upload", Payload: map[string]any{"file_path": path, "folderId": "folder-1"}}
+			expectedPath := path
+			if !filepath.IsAbs(path) {
+				expectedPath = filepath.Join(cwd, path)
+			}
+			_, output, err := handlePlatformGenericWrite(context.Background(), "platform_action", input, "action", true)
+			if err != nil || output.Error != "" || !output.ConfirmationRequired {
+				t.Fatalf("prepare upload: %v, %+v", err, output)
+			}
+			t.Cleanup(func() { consumePendingPlatformAction(output.ConfirmationToken) })
+			preview := output.ConfirmationPreview
+			if preview == nil {
+				t.Fatal("missing preview")
+			}
+			if preview.Summary != "Upload file "+strconv.Quote(expectedPath) {
+				t.Fatalf("summary = %q, want quoted absolute path %q", preview.Summary, expectedPath)
+			}
+			if preview.Host != session.Host.URL || preview.OrgID != "org-1" || preview.ProjectID != "proj-1" || preview.ProjectName != "Customer" {
+				t.Fatalf("missing destination: %+v", preview)
+			}
+			fields := map[string]PlatformFieldChange{}
+			for _, field := range preview.FieldChanges {
+				fields[field.Field] = field
+			}
+			if fields["filePath"].Redacted || fields["filePath"].After["value"] != expectedPath || fields["folderId"].After["value"] != "folder-1" {
+				t.Fatalf("incorrect upload fields: %+v", fields)
+			}
+			if slices.Contains(preview.Changes, "filePath (redacted)") || !slices.Contains(preview.Changes, "filePath") {
+				t.Fatalf("inconsistent change labels: %v", preview.Changes)
+			}
+			spec, variables, err := buildPlatformGenericWrite(session, input, "action")
+			if err != nil {
+				t.Fatal(err)
+			}
+			plan := buildPlatformWritePlan(nil, session, spec, variables, "")
+			if !reflect.DeepEqual(plan.Preview, preview) || !reflect.DeepEqual(plan.PayloadKeys, preview.Changes) {
+				t.Fatalf("write plan differs from confirmation: %+v", plan)
+			}
+			_, pending, err := HandlePlatformPending(context.Background(), nil, PlatformPendingInput{})
+			if err != nil {
+				t.Fatal(err)
+			}
+			found := false
+			for _, item := range pending.Pending {
+				if item.Token == output.ConfirmationToken {
+					found = true
+					if !reflect.DeepEqual(item.Action, *preview) {
+						t.Fatalf("pending preview differs: %+v", item.Action)
+					}
+				}
+			}
+			if !found || client.mutationName != "" {
+				t.Fatalf("pending found = %v, mutation = %q", found, client.mutationName)
+			}
+		})
+	}
+}
+
+func TestPlatformUploadPreviewPreservesSensitiveFieldRules(t *testing.T) {
+	for _, mutation := range []string{"UploadProjectFile", "UpdateSource"} {
+		t.Run(mutation, func(t *testing.T) {
+			variables := map[string]any{"filePath": "/private/input.csv", "outputPath": "/private/output", "password": "password-value", "token": "token-value", "content": "private-content"}
+			action := &PendingPlatformAction{Mutation: mutation, Variables: variables, Changes: genericWriteChanges(variables)}
+			preview := action.Preview()
+			for _, field := range preview.FieldChanges {
+				if mutation == "UploadProjectFile" && field.Field == "filePath" {
+					if field.Redacted || field.After["value"] != variables[field.Field] {
+						t.Fatalf("upload source hidden: %+v", field)
+					}
+				} else if !field.Redacted || field.After["value"] != "[redacted]" {
+					t.Fatalf("sensitive field exposed: %+v", field)
+				}
+			}
+			if !slices.Contains(action.Changes, "filePath (redacted)") {
+				t.Fatal("preview mutated stored change labels")
+			}
+		})
+	}
+	for _
```

**File**: `cli/pkg/mcp/platform_workspace_tools.go` (modified, +1/-1)
```diff
@@ -1216,7 +1216,7 @@ func buildPlatformWritePlan(snapshot *platformWorkspaceSnapshot, session *platfo
 		Mutation:             spec.Mutation,
 		ConfirmationRequired: true,
 		Preview:              preview,
-		PayloadKeys:          genericWriteChanges(payload),
+		PayloadKeys:          preview.Changes,
 		SuggestedReads:       suggestedReadsForResource(spec.Resource, spec.Action),
 		Affected:             affected,
 		Warnings:             warnings,
```

**File**: `cli/pkg/mcp/platform_write_tools.go` (modified, +7/-1)
```diff
@@ -20,6 +20,7 @@ import (
 	"context"
 	"encoding/json"
 	"fmt"
+	"path/filepath"
 	"sort"
 	"strings"
 	"time"
@@ -552,7 +553,12 @@ func buildPlatformGenericWrite(session *platformToolSession, input PlatformGener
 		if strings.TrimSpace(filePath) == "" {
 			return platformapi.GenericWriteSpec{}, nil, fmt.Errorf("payload_json.file_path is required")
 		}
-		variables["filePath"] = strings.TrimSpace(filePath)
+		// Bind review and execution to the same path even if the working directory changes.
+		filePath, err = filepath.Abs(strings.TrimSpace(filePath))
+		if err != nil {
+			return platformapi.GenericWriteSpec{}, nil, fmt.Errorf("resolve upload file path: %w", err)
+		}
+		variables["filePath"] = filePath
 		variables["folderId"] = nullablePayloadString(payload, "folderId")
 	default:
 		return platformapi.GenericWriteSpec{}, nil, fmt.Errorf("unsupported write mode %q", spec.Mode)
```

---

### Incident Patch 12: `8c483193` (2026-09-25)
**Commit Message**: update ux package and improve mobile ui

**File**: `frontend/package.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "dependencies": {
     "@apollo/client": "4.2.12",
     "@clidey/connparse": "0.9.0",
-    "@clidey/ux": "1.2.4",
+    "@clidey/ux": "1.3.0",
     "@codemirror/autocomplete": "6.20.3",
     "@codemirror/lang-json": "6.0.2",
     "@codemirror/lang-markdown": "6.5.2",
```

**File**: `frontend/pnpm-lock.yaml` (modified, +11/-11)
```diff
@@ -15,8 +15,8 @@ importers:
         specifier: 0.9.0
         version: 0.9.0
       '@clidey/ux':
-        specifier: 1.2.4
-        version: 1.2.4(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react-is@19.2.7)(react@19.2.8)(redux@5.0.1)
+        specifier: 1.3.0
+        version: 1.3.0(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react-is@19.2.7)(react@19.2.8)(redux@5.0.1)
       '@codemirror/autocomplete':
         specifier: 6.20.3
         version: 6.20.3
@@ -303,8 +303,8 @@ packages:
     resolution: {integrity: sha512-RlJ0hDi+ntZBRkO7zm9BfZc8QbS2erow9h7kga3R9OoKx8e4yOYEAaOfxgKVVqkogp9R9IYIbhVv+dLDz6GFYg==}
     hasBin: true
 
-  '@clidey/ux@1.2.4':
-    resolution: {integrity: sha512-5M3acppA5N4RkzEbEoSdBVGzYCWeZGMZ+A5xSQOqUrbhfAtROEUlFb0923O4PUh469Bs5sb7iWVgHxJJMgkBJA==}
+  '@clidey/ux@1.3.0':
+    resolution: {integrity: sha512-pAPf2dB+4dTZM6/EKXSrJcbBOH+I6y9lsEz5nIGW6Gjp/UHZKlBt4pZSfrS6b0hipBY+C0vPlgkxovhJK08Bog==}
     peerDependencies:
       react: '>=18.3.0'
       react-dom: '>=18.3.0'
@@ -4856,8 +4856,8 @@ packages:
   third-party-web@0.26.7:
     resolution: {integrity: sha512-buUzX4sXC4efFX6xg2bw6/eZsCUh8qQwSavC4D9HpONMFlRbcHhD8Je5qwYdCpViR6q0qla2wPP+t91a2vgolg==}
 
-  third-party-web@0.29.2:
-    resolution: {integrity: sha512-fegtha91tq2DHphyoiBXVHjVi2YG9zFaRnboT9C28tO1en9Y3wJsfspuy40F+u5wl3hHVbw7cnd1b67kEGHb8g==}
+  third-party-web@0.30.0:
+    resolution: {integrity: sha512-p+PfyL5U0ediGzvwPzMSdD9MnC8rHW6nWJJVLIQvqN7RsSqfaZ+7n4c9GILqH36EYR0eXB9CzAeCRnKFr/9uJg==}
 
   through@2.3.8:
     resolution: {integrity: sha512-w89qg7PI8wAdvX60bMDP+bFoD5Dvhm9oLheFp5O4a2QF0cSBGsBX4qZmadPMvVqlLJBBci+WqGGOAPvcDeNSVg==}
@@ -5437,7 +5437,7 @@ snapshots:
     dependencies:
       yaml: 2.9.0
 
-  '@clidey/ux@1.2.4(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react-is@19.2.7)(react@19.2.8)(redux@5.0.1)':
+  '@clidey/ux@1.3.0(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react-is@19.2.7)(react@19.2.8)(redux@5.0.1)':
     dependencies:
       '@radix-ui/react-accordion': 1.2.17(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
       '@radix-ui/react-alert-dialog': 1.1.20(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
@@ -6552,7 +6552,7 @@ snapshots:
   '@paulirish/trace_engine@0.0.53':
     dependencies:
       legacy-javascript: 0.0.1
-      third-party-web: 0.29.2
+      third-party-web: 0.30.0
 
   '@playwright/test@1.62.1':
     dependencies:
@@ -7899,10 +7899,10 @@ snapshots:
 
   cmdk@1.1.1(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8):
     dependencies:
-      '@radix-ui/react-compose-refs': 1.1.3(@types/react@19.2.18)(react@19.2.8)
+      '@radix-ui/react-compose-refs': 1.1.5(@types/react@19.2.18)(react@19.2.8)
       '@radix-ui/react-dialog': 1.1.20(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
       '@radix-ui/react-id': 1.1.2(@types/react@19.2.18)(react@19.2.8)
-      '@radix-ui/react-primitive': 2.1.7(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
+      '@radix-ui/react-primitive': 2.1.10(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
       react: 19.2.8
       react-dom: 19.2.8(react@19.2.8)
     transitivePeerDependencies:
@@ -10512,7 +10512,7 @@ snapshots:
 
   third-party-web@0.26.7: {}
 
-  third-party-web@0.29.2: {}
+  third-party-web@0.30.0: {}
 
   through@2.3.8: {}
 
```

**File**: `frontend/src/components/page.tsx` (modified, +13/-2)
```diff
@@ -26,7 +26,7 @@ import {ConnectionContext} from "./connection-context";
 import {Loading} from "./loading";
 import {Sidebar} from "./sidebar/sidebar";
 import {useTranslation} from "@/hooks/use-translation";
-import {MagnifyingGlassIcon, QuestionMarkCircleIcon} from "./heroicons";
+import {Bars3Icon, MagnifyingGlassIcon, QuestionMarkCircleIcon} from "./heroicons";
 import {getKeyDisplay} from "@/utils/platform";
 import {useEffectiveIsMac} from "@/hooks/useEffectiveIsMac";
 import {useSourceSessionMetadata} from "@/hooks/useSourceSessionMetadata";
@@ -118,6 +118,7 @@ const KeyboardShortcutsHint: FC = () => {
 };
 
 export const InternalPage: FC<IInternalPageProps> = (props) => {
+    const { t } = useTranslation('components/page');
     const isLoggedIn = useAppSelector(state => state.auth.current != null);
     const sidebarOpen = useAppSelector(state => state.settings.sidebarOpen);
     const dispatch = useAppDispatch();
@@ -139,7 +140,17 @@ export const InternalPage: FC<IInternalPageProps> = (props) => {
             <Page wrapperClassName="p-0" {...props}>
                 <div className="flex flex-col grow py-6">
                     <div className="flex flex-col gap-1 px-8">
-                        <div className="flex w-full justify-between items-center">
+                        <div className="flex w-full justify-between items-center gap-2">
+                            <Button
+                                variant="outline"
+                                size="icon"
+                                className="md:hidden shrink-0"
+                                aria-label={t('openNavigation')}
+                                data-testid="mobile-nav-toggle"
+                                onClick={() => window.dispatchEvent(new CustomEvent('menu:toggle-sidebar'))}
+                            >
+                                <Bars3Icon className="h-4 w-4" />
+                            </Button>
                             <Breadcrumb routes={props.routes ?? []} active={props.routes?.at(-1)} />
                             <div className="flex items-center gap-2 shrink-0">
                                 <CommandPaletteTrigger />
```

**File**: `frontend/src/components/sidebar/sidebar.tsx` (modified, +3/-1)
```diff
@@ -287,7 +287,9 @@ export const Sidebar: FC = () => {
     const [logoutProfileId, setLogoutProfileId] = useState<string | null>(null);
     const [platformExplainerTrigger, setPlatformExplainerTrigger] = useState<PlatformFunnelTrigger | null>(null);
     const [backupHintDismissed, setBackupHintDismissed] = useState(() => hasDismissedBackupHint());
-    const { toggleSidebar, open } = useSidebar();
+    const { toggleSidebar, open: desktopOpen, isMobile } = useSidebar();
+    // The mobile sheet always shows the expanded layout, whatever the persisted desktop collapse state is.
+    const open = isMobile || desktopOpen;
     const isInitialMount = useRef(true);
     const { switchProfile } = useProfileSwitch({
         errorMessage: t('errorSigningIn'),
```

**File**: `frontend/src/index.css` (modified, +4/-0)
```diff
@@ -20,6 +20,10 @@
 @import '@clidey/ux/brand.css';
 @import './brand-fonts.css';
 
+/* Emit every utility the ux components use from this build, so ux's own
+   responsive classes (e.g. `hidden md:block`) get correct variant ordering. */
+@source "../node_modules/@clidey/ux/dist";
+
 @custom-variant dark (&:where(.dark, .dark *));
 @custom-variant hover (&:hover);
 
```

**File**: `frontend/src/locales/components/page.yaml` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 en_US:
   skipToContent: Skip to main content
+  openNavigation: Open navigation
 
 ar_AE:
   skipToContent: انتقل إلى المحتوى الرئيسي
```

**File**: `frontend/src/pages/auth/login.tsx` (modified, +7/-7)
```diff
@@ -1044,7 +1044,7 @@ export const LoginForm: FC<LoginFormProps> = ({
     return (
         <div className={classNames("w-fit h-fit", className, {
             "w-full h-full": advancedDirection === "vertical",
-            "flex gap-8": showSidePanel && advancedDirection === "horizontal",
+            "flex flex-col gap-8 md:flex-row": showSidePanel && advancedDirection === "horizontal",
         })} data-testid="login-form-container">
             <div className="fixed top-4 right-4 z-20" data-testid="mode-toggle-login">
                 <ModeToggle />
@@ -1069,10 +1069,10 @@ export const LoginForm: FC<LoginFormProps> = ({
                     </header>
                 )}
                 <div className={classNames("flex", {
-                    "flex-row grow": advancedDirection === "horizontal",
+                    "flex-col md:flex-row grow": advancedDirection === "horizontal",
                     "flex-col w-full gap-lg": advancedDirection === "vertical",
                 })} data-testid="login-form">
-                    <div className={classNames("flex flex-col gap-lg grow", advancedDirection === "vertical" ? "w-full" : "w-[350px]")}>
+                    <div className={classNames("flex flex-col gap-lg grow", advancedDirection === "vertical" ? "w-full" : "w-full md:w-[350px]")}>
                         <div className={cn("flex flex-col grow gap-lg", {
                             "justify-center": advancedDirection === "horizontal" && !showSidePanel,
                         })}>
@@ -1119,7 +1119,7 @@ export const LoginForm: FC<LoginFormProps> = ({
                     {
                         (showAdvanced && advancedSection.hasAdvancedSection && !databaseType.customFormRenderer) &&
                         <div className={classNames("transition-all h-full overflow-hidden flex flex-col gap-lg", {
-                            "w-[350px] ml-4": advancedDirection === "horizontal",
+                            "w-full mt-6 md:mt-0 md:w-[350px] md:ml-4": advancedDirection === "horizontal",
                             "w-full": advancedDirection === "vertical",
                         })}>
                             <SourceAdvancedFields
@@ -1235,7 +1235,7 @@ export const LoginForm: FC<LoginFormProps> = ({
             </div>
             {
                 showSidePanel && advancedDirection === "horizontal" && (
-                    <Card className="flex flex-col gap-6 p-8 w-[380px] shadow-xl" data-testid="sample-database-panel" aria-labelledby="sample-db-heading">
+                    <Card className="flex flex-col gap-6 p-8 w-full md:w-[380px] shadow-xl" data-testid="sample-database-panel" aria-labelledby="sample-db-heading">
                         <div className="flex flex-col gap-4">
                             <div className="flex items-center gap-3">
                                 <div className="h-14 w-14 rounded-2xl flex justify-center items-center bg-gradient-to-br from-brand to-brand/80 shadow-lg" aria-hidden="true">
@@ -1349,9 +1349,9 @@ export const LoginPage: FC = () => {
     const { t } = useTranslation('pages/login');
 
     return (
-        <Container className="justify-center items-center">
+        <Container className="flex-col justify-center items-center gap-6 overflow-y-auto md:flex-row md:gap-0">
             <LoginForm />
-            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-xs text-foreground/60" data-testid="login-page-version">
+            <div className="shrink-0 pb-4 text-xs text-foreground/60 md:fixed md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:pb-0" data-testid="login-page-version">
                 {t('version')}: {__APP_VERSION__}
             </div>
         </Container>
```

**File**: `frontend/src/pages/storage-unit/explore-storage-unit.tsx` (modified, +2/-2)
```diff
@@ -951,8 +951,8 @@ export const ExploreStorageUnit: FC = () => {
                 <div className="text-sm" data-testid="total-count-top"><span className="font-semibold">{t('totalCount')}</span> {totalCount}</div>
             </div>
             <div className="flex w-full relative" data-testid="explore-storage-unit-options">
-                <div className="flex justify-between items-end w-full">
-                    <div className="flex gap-2">
+                <div className="flex flex-wrap justify-between items-end gap-2 w-full">
+                    <div className="flex flex-wrap gap-2">
                         {EESearchBar != null ? (
                             <EESearchBar
                                 key={conditionKey}
```

---

### Incident Patch 13: `0ce4cc9c` (2026-09-24)
**Commit Message**: update how table names are build

**File**: `.agents/docs/data-sources.md` (modified, +10/-1)
```diff
@@ -50,7 +50,7 @@ Read the **Core Architecture** section first, then follow the path that matches
 3. **Plugin Self-Registration** — Plugins register themselves via `init()` functions. The frontend and API automatically adapt based on the plugin's declared catalog entries.
 4. **CE vs. EE Strict Boundary** — CE (Community Edition) knows *nothing* about EE (Enterprise Edition). CE code must never contain `ee/` imports, references, or `if isEE` logic. EE extends CE purely through registries at boot time. Edition is controlled by which entry point is compiled (`core/cmd/whodb/main.go` for CE, `ee/cmd/whodb/main.go` for EE), not build tags.
 5. **No Defensive Code** — Do not write fallback logic unless explicitly requested.
-6. **No SQL Injection** — Use parameterized queries or `GetPlaceholder(index)`. Never use `fmt.Sprintf` for user-supplied SQL variables.
+6. **No SQL Injection** — Parameterize values and render every raw schema/table/column component through `core/src/sqlident`. Metadata validation does not replace quoting at the SQL sink. See `.agents/docs/sql-security.md`.
 7. **Localization** — All user-facing strings must use `t()` with YAML keys. No hardcoded UI text.
 
 ---
@@ -497,6 +497,15 @@ func (p *MyPlugin) GetTableNameAndAttributes(rows *sql.Rows) (string, []engine.R
 
 **Connection lifecycle**: Always use `plugins.WithConnection(config, p.DB, func(db *gorm.DB) ...)` for all database operations. This handles connection pooling and lifecycle.
 
+**Identifier security**: Every SQL plugin must configure its identifier quote
+style with `ConfigureIdentifierQuoting`. Do not add database-specific
+`BuildFullTableName`/`BuildQuotedTableName` variants; shared SQL paths and raw
+database-specific paths must use `core/src/sqlident`. If the source contract
+exposes `ImportData`, add a runtime overwrite test with a delimiter-bearing
+table reference and an unrelated guard table, then classify the connector in
+`core/src/sourcecatalog/identifier_coverage_test.go` or the EE equivalent. The
+coverage test must fail when an import-capable connector has no declared proof.
+
 **Error handling**: Use `ErrorHandler` from `core/src/plugins/gorm/errors.go` for user-friendly error messages. Call `p.InitPlugin()` in your constructor or first method to initialize it.
 
 #### For non-SQL databases: Embed `BasePlugin`
```

**File**: `.agents/docs/sql-security.md` (modified, +40/-6)
```diff
@@ -16,16 +16,50 @@ db.Raw("SELECT * FROM users WHERE id = ?", userInput).Scan(&result)
 db.Table("users").Where("id = ?", userInput).Find(&result)
 ```
 
-## Identifier Escaping
+## Identifier Quoting
 
-For identifiers (table/column names) that can't use placeholders, use the plugin's `EscapeIdentifier()` method:
+SQL parameters protect values only. They cannot represent database object names.
+Every schema, table, and column name that reaches SQL must be rendered as an
+identifier with `core/src/sqlident`; validation through metadata APIs such as
+`StorageUnitExists` is not a substitute for quoting at the SQL sink.
+
+GORM-backed plugins must configure their database's quote style in the plugin
+constructor:
 
 ```go
-// For SQLite PRAGMA (which doesn't support placeholders):
-escapedTable := p.EscapeIdentifier(tableName)
-query := fmt.Sprintf("PRAGMA table_info(%s)", escapedTable)
+p.ConfigureIdentifierQuoting(sqlident.DoubleQuote) // PostgreSQL, SQLite, Snowflake
+p.ConfigureIdentifierQuoting(sqlident.Backtick)    // MySQL-family databases
+p.ConfigureIdentifierQuoting(sqlident.Bracket)     // SQL Server
 ```
 
+Use `sqlident.New` when database-specific code must construct a raw qualified
+name:
+
+```go
+name, err := sqlident.New(schemaName, tableName)
+if err != nil {
+    return false, err
+}
+qualifiedTable, err := name.SQL(p.IdentifierQuoteStyle())
+if err != nil {
+    return false, err
+}
+if err := db.Exec("TRUNCATE TABLE " + qualifiedTable).Error; err != nil {
+    return false, err
+}
+```
+
+`sqlident.New` receives raw components and quotes each component separately. Do
+not pass a pre-joined `schema.table` string, add connector-specific full-name
+builders, or concatenate raw identifiers. Use a strict quote style only when the
+database rejects embedded delimiter characters; strict styles must return the
+validation error instead of emitting SQL.
+
+JDBC bridge dialects declare `IdentifierQuote` with `bridge.QuoteDouble`,
+`bridge.QuoteBacktick`, or `bridge.QuoteBracket`. The shared bridge plugin then
+uses `sqlident` for qualified names and applies the same delimiter rules to
+columns.
+
 ## WithConnection Pattern
 
 Always use `plugins.WithConnection()` for database operations:
@@ -40,7 +74,7 @@ _, err := plugins.WithConnection(config, p.DB, func(db *gorm.DB) (bool, error) {
 
 ## GORM Query Patterns
 
-- Use `db.Raw()` with placeholders for complex queries
+- Use `db.Raw()` with placeholders for values in complex queries
 - Use GORM's query builder for simple operations
 - Always close rows when done:
 
```

**File**: `.agents/rules/go-backend.md` (modified, +3/-1)
```diff
@@ -13,7 +13,9 @@ cd core && ./lint.sh && go build ./cmd/whodb
 
 ## SQL Security
 - Never `fmt.Sprintf` with user input — use `db.Raw("... WHERE x = ?", val)` or GORM builder
-- For identifiers (table/column names), use `p.EscapeIdentifier(name)`
+- For identifiers, configure `GormPlugin.ConfigureIdentifierQuoting(...)` and
+  render raw schema/table/column components through `core/src/sqlident`; never
+  concatenate an identifier or rely on `StorageUnitExists` as the SQL safety boundary
 - Always close `*sql.Rows` with `defer rows.Close()`
 
 ## Plugin Patterns
```

**File**: `.agents/workflows/new-plugin.md` (modified, +13/-0)
```diff
@@ -27,6 +27,7 @@ package <name>
 import (
     "github.com/clidey/whodb/core/src/engine"
     "github.com/clidey/whodb/core/src/plugins/gorm"
+    "github.com/clidey/whodb/core/src/sqlident"
 )
 
 type <Name>Plugin struct {
@@ -35,6 +36,7 @@ type <Name>Plugin struct {
 
 func New<Name>Plugin() *engine.Plugin {
     p := &<Name>Plugin{}
+    p.ConfigureIdentifierQuoting(sqlident.DoubleQuote) // choose the database's rules
     return &engine.Plugin{
         Type:            engine.DatabaseType_<Name>,
         PluginFunctions: p,
@@ -79,6 +81,10 @@ At minimum for SQL plugins:
 - `GetSchemaTableQuery() string`
 - `GetPlaceholder(index int) string` — `$1` for Postgres-like, `?` for MySQL-like
 
+For every raw SQL path, pass values as parameters and render raw object-name
+components through `core/src/sqlident`. Do not create connector-specific
+qualified-name helpers. See `.agents/docs/sql-security.md`.
+
 ### 8. Add Frontend Icon
 In `frontend/src/icons.tsx` (or `ee/frontend/src/icons.tsx`):
 ```typescript
@@ -94,6 +100,13 @@ cd frontend && pnpm run build:ce
 ### 10. Tests
 - Add database fixture in `frontend/e2e/fixtures/databases/<name>.json`
 - Add Docker service in `dev/docker-compose.yml` with seed data
+- If the source contract exposes `ImportData`, add a runtime overwrite test that:
+  - creates a uniquely named target and unrelated guard table;
+  - uses a table name containing the database's closing identifier delimiter and an SQL suffix, or proves the database rejects that name before overwrite;
+  - calls the production `importer.Execute(..., ModeOverwrite)` path;
+  - verifies the replacement rows, verifies the guard is unchanged, and cleans up;
+  - executes against the supported database image or live service so the generated SQL is accepted by the real driver.
+- Add the plugin type and proof to `core/src/sourcecatalog/identifier_coverage_test.go` (CE) or `ee/core/src/sourcecatalog/identifier_coverage_test.go` (EE). This is required for every import-capable connector.
 - Run: `cd frontend && pnpm e2e:db:headless <name>`
 
 ## Reference
```

**File**: `core/src/plugins/clickhouse/clickhouse.go` (modified, +13/-8)
```diff
@@ -40,6 +40,7 @@ import (
 	"github.com/clidey/whodb/core/src/plugins"
 	gorm_plugin "github.com/clidey/whodb/core/src/plugins/gorm"
 	sourcecatalogspecs "github.com/clidey/whodb/core/src/sourcecatalog/specs"
+	"github.com/clidey/whodb/core/src/sqlident"
 )
 
 var (
@@ -185,12 +186,15 @@ func (p *ClickHousePlugin) RawExecute(config *engine.PluginConfig, query string,
 func (p *ClickHousePlugin) ClearTableData(config *engine.PluginConfig, schema string, storageUnit string) (bool, error) {
 	return plugins.WithConnection(config, p.DB, func(db *gorm.DB) (bool, error) {
 		builder := p.CreateSQLBuilder(db)
-		tableName := builder.BuildFullTableName(schema, storageUnit)
+		tableName, err := builder.QualifiedTableName(schema, storageUnit)
+		if err != nil {
+			return false, err
+		}
 
 		query := fmt.Sprintf("ALTER TABLE %s DELETE WHERE 1=1", tableName)
 
 		// Execute the DELETE mutation
-		err := db.Exec(query).Error
+		err = db.Exec(query).Error
 		if err != nil {
 			// ClickHouse mutations may return "driver: bad connection" when trying to read
 			// the non-existent result set. Verify the connection is still healthy.
@@ -480,18 +484,18 @@ func (p *ClickHousePlugin) NormalizeType(typeName string) string {
 // migrator.ColumnTypes() doesn't support "database.table" format - it uses
 // m.CurrentDatabase() internally and expects just the table name.
 func (p *ClickHousePlugin) GetColumnTypes(db *gorm.DB, schema, tableName string) (map[string]gorm_plugin.ColumnTypeInfo, error) {
-	migrator := gorm_plugin.NewMigratorHelper(db, p)
-	// Pass just table name - ClickHouse GORM driver handles database context
-	return migrator.GetColumnTypes(tableName)
+	migrator := gorm_plugin.NewMigratorHelper(p)
+	builder := p.CreateSQLBuilder(db)
+	return migrator.GetColumnTypes(builder.GetTableQuery("", tableName), "", tableName)
 }
 
 // GetColumnsForTable overrides the base implementation for the same reason as GetColumnTypes.
 func (p *ClickHousePlugin) GetColumnsForTable(config *engine.PluginConfig, schema string, storageUnit string) ([]engine.Column, error) {
 	return plugins.WithConnection(config, p.DB, func(db *gorm.DB) ([]engine.Column, error) {
-		migrator := gorm_plugin.NewMigratorHelper(db, p)
+		migrator := gorm_plugin.NewMigratorHelper(p)
+		builder := p.CreateSQLBuilder(db)
 
-		// Pass just table name - ClickHouse GORM driver handles database context
-		columns, err := migrator.GetOrderedColumns(storageUnit)
+		columns, err := migrator.GetOrderedColumns(builder.GetTableQuery("", storageUnit), "", storageUnit)
 		if err != nil {
 			log.WithError(err).Error(fmt.Sprintf("Failed to get columns for table %s.%s", schema, storageUnit))
 			return nil, err
@@ -557,6 +561,7 @@ func init() {
 
 func NewClickHousePlugin() *engine.Plugin {
 	clickhousePlugin := &ClickHousePlugin{}
+	clickhousePlugin.ConfigureIdentifierQuoting(sqlident.BacktickStrict)
 	clickhousePlugin.Type = engine.DatabaseType_ClickHouse
 	clickhousePlugin.PluginFunctions = clickhousePlugin
 	clickhousePlugin.GormPluginFunctions = clickhousePlugin
```

**File**: `core/src/plugins/clickhouse/export.go` (modified, +1/-3)
```diff
@@ -71,9 +71,7 @@ func (p *ClickHousePlugin) ExportData(config *engine.PluginConfig, schema string
 
 	// Use GORM query builder for export
 	builder := gorm_plugin.NewSQLBuilder(db, p)
-	fullTable := builder.BuildFullTableName(schema, storageUnit)
-
-	exportQuery := db.Table(fullTable)
+	exportQuery := builder.GetTableQuery(schema, storageUnit)
 	if len(columns) > 0 {
 		exportQuery = exportQuery.Select(columns)
 	}
```

**File**: `core/src/plugins/clickhouse/metadata.go` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+/*
+ * Copyright 2026 Clidey, Inc.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package clickhouse
+
+import (
+	"database/sql"
+	"fmt"
+	"strings"
+
+	"gorm.io/gorm"
+	"gorm.io/gorm/migrator"
+
+	gorm_plugin "github.com/clidey/whodb/core/src/plugins/gorm"
+)
+
+// QuotedColumnTypes returns complete ClickHouse metadata for identifiers that require quoting.
+func (p *ClickHousePlugin) QuotedColumnTypes(db *gorm.DB, schema, table string) ([]gorm.ColumnType, error) {
+	if schema == "" {
+		if err := db.Raw("SELECT currentDatabase()").Scan(&schema).Error; err != nil {
+			return nil, err
+		}
+	}
+	rawTypes, err := gorm_plugin.ReadSQLColumnTypes(p.CreateSQLBuilder(db).GetTableQuery(schema, table))
+	if err != nil {
+		return nil, err
+	}
+	rows, err := db.Raw(`
+		SELECT name, type, default_expression, comment, is_in_primary_key,
+		       character_octet_length, numeric_precision, numeric_scale, datetime_precision
+		FROM system.columns
+		WHERE database = ? AND table = ?
+		ORDER BY position
+	`, schema, table).Rows()
+	if err != nil {
+		return nil, err
+	}
+	defer func() { _ = rows.Close() }()
+
+	var types []gorm.ColumnType
+	for rows.Next() {
+		var (
+			name, dataType string
+			defaultValue   sql.NullString
+			comment        sql.NullString
+			isPrimary      bool
+			length         sql.NullInt64
+			precision      sql.NullInt64
+			scale          sql.NullInt64
+			datetime       sql.NullInt64
+		)
+		if err := rows.Scan(&name, &dataType, &defaultValue, &comment, &isPrimary, &length, &precision, &scale, &datetime); err != nil {
+			return nil, err
+		}
+		if defaultValue.Valid {
+			defaultValue.String = strings.Trim(defaultValue.String, "'")
+		}
+		if datetime.Valid {
+			precision = datetime
+		}
+		types = append(types, migrator.ColumnType{
+			NameValue:         sql.NullString{String: name, Valid: true},
+			DataTypeValue:     sql.NullString{String: dataType, Valid: true},
+			ColumnTypeValue:   sql.NullString{String: dataType, Valid: true},
+			PrimaryKeyValue:   sql.NullBool{Bool: isPrimary, Valid: true},
+			DefaultValueValue: defaultValue,
+			CommentValue:      comment,
+			LengthValue:       length,
+			DecimalSizeValue:  precision,
+			ScaleValue:        scale,
+			SQLColumnType:     rawTypes[name],
+		})
+	}
+	if err := rows.Err(); err != nil {
+		return nil, fmt.Errorf("read ClickHouse column metadata: %w", err)
+	}
+	return types, nil
+}
```

**File**: `core/src/plugins/clickhouse/runtime_integration_test.go` (modified, +80/-7)
```diff
@@ -139,13 +139,12 @@ func TestClickHouseMutationRuntimePaths(t *testing.T) {
 	_, _ = plugin.RawExecute(config, fmt.Sprintf("DROP TABLE IF EXISTS test_db.%s SYNC", table))
 	defer plugin.RawExecute(config, fmt.Sprintf("DROP TABLE IF EXISTS test_db.%s SYNC", table))
 
-	created, err := plugin.AddStorageUnit(config, "test_db", table, []engine.Record{
-		{Key: "id", Value: "UInt32", Extra: map[string]string{"Primary": "true", "Nullable": "false"}},
-		{Key: "tags", Value: "Array(String)", Extra: map[string]string{"Primary": "false", "Nullable": "false"}},
-		{Key: "status", Value: "String", Extra: map[string]string{"Primary": "false", "Nullable": "false"}},
-	})
-	if err != nil || !created {
-		t.Fatalf("AddStorageUnit failed: created=%t err=%v", created, err)
+	_, err := plugin.RawExecute(config, fmt.Sprintf(
+		"CREATE TABLE IF NOT EXISTS test_db.%s (id UInt32, tags Array(String), status String) ENGINE = MergeTree ORDER BY id",
+		table,
+	))
+	if err != nil {
+		t.Fatalf("failed to create clickhouse mutation table: %v", err)
 	}
 	for range 10 {
 		exists, existsErr := plugin.StorageUnitExists(config, "test_db", table)
@@ -215,3 +214,77 @@ func TestClickHouseMutationRuntimePaths(t *testing.T) {
 
 	t.Fatalf("expected clickhouse table %q to be empty after ClearTableData", table)
 }
+
+func TestClickHouseClearAndBulkInsertAcceptQuotedTableName(t *testing.T) {
+	plugin := clickHouseIntegrationPlugin(t)
+	config := clickHouseIntegrationConfig()
+	waitForClickHouseOrders(t, plugin, config)
+
+	guardTable := fmt.Sprintf("identifier_guard_%d", time.Now().UnixNano())
+	table := `identifier"; DELETE FROM test_db.` + guardTable + `;--`
+	quotedTable := "`" + table + "`"
+	_, _ = plugin.RawExecute(config, "DROP TABLE IF EXISTS test_db."+quotedTable+" SYNC")
+	_, _ = plugin.RawExecute(config, "DROP TABLE IF EXISTS test_db."+guardTable+" SYNC")
+	t.Cleanup(func() {
+		_, _ = plugin.RawExecute(config, "DROP TABLE IF EXISTS test_db."+quotedTable+" SYNC")
+		_, _ = plugin.RawExecute(config, "DROP TABLE IF EXISTS test_db."+guardTable+" SYNC")
+	})
+
+	if _, err := plugin.RawExecute(config, "CREATE TABLE IF NOT EXISTS test_db."+guardTable+" (id UInt32) ENGINE = MergeTree ORDER BY id"); err != nil {
+		t.Fatalf("failed to create clickhouse guard table: %v", err)
+	}
+	if _, err := plugin.RawExecute(config, "INSERT INTO test_db."+guardTable+" VALUES (1)"); err != nil {
+		t.Fatalf("failed to seed clickhouse guard table: %v", err)
+	}
+	if _, err := plugin.RawExecute(config, "CREATE TABLE IF NOT EXISTS test_db."+quotedTable+" (id String, name String, code FixedString(50) DEFAULT '') ENGINE = MergeTree ORDER BY id"); err != nil {
+		t.Fatalf("failed to create quoted clickhouse table: %v", err)
+	}
+	if _, err := plugin.RawExecute(config, "INSERT INTO test_db."+quotedTable+" (id, name) VALUES ('old-id', 'old')"); err != nil {
+		t.Fatalf("failed to seed quoted clickhouse table: %v", err)
+	}
+	columns, err := plugin.GetColumnsForTable(config, "test_db", table)
+	if err != nil {
+		t.Fatalf("failed to inspect quoted clickhouse table: %v", err)
+	}
+	var codeType string
+	for _, column := range columns {
+		if column.Name == "code" {
+			codeType = column.Type
+		}
+	}
+	if codeType != "FIXEDSTRING(50)" {
+		t.Fatalf("quoted clickhouse metadata lost declared type information: %#v", columns)
+	}
+	guardBefore, err := plugin.RawExecute(config, "SELECT count() FROM test_db."+guardTable)
+	if err != nil || len(guardBefore.Rows) != 1 {
+		t.Fatalf("failed to read clickhouse guard baseline: rows=%#v err=%v", guardBefore, err)
+	}
+
+	cleared, err := plugin.ClearTableData(config, "test_db", table)
+	if err != nil || !cleared {
+		t.Fatalf("clear through quoted clickhouse table failed: cleared=%t err=%v", cleared, err)
+	}
+	for range 50 {
+		count, countErr := plugin.GetRowCount(config, "test_db", table, nil)
+		if countErr != nil {
+			t.Fatalf("failed to count quoted clickhouse table: %v", countErr)
+		}
+		if count == 0 {
+			break
+		}
+		time.Sleep(100 * time.Millisecond)
+	}
+
+	added, err := plugin.BulkAddRows(config, "test_db", table, [][]engine.Record{{{Key: "id", Value: "new-id"}, {Key: "name", Value: "new"}}})
+	if err != nil || !added {
+		t.Fatalf("bulk insert through quoted clickhouse table failed: added=%t err=%v", added, err)
+	}
+	rows, err := plugin.RawExecute(config, "SELECT name FROM test_db."+quotedTable)
+	if err != nil || len(rows.Rows) != 1 || rows.Rows[0][0] != "new" {
+		t.Fatalf("unexpected clickhouse target rows: rows=%#v err=%v", rows, err)
+	}
+	guard, err := plugin.RawExecute(config, "SELECT count() FROM test_db."+guardTable)
+	if err != nil || len(guard.Rows) != 1 || guard.Rows[0][0] != guardBefore.Rows[0][0] {
+		t.Fatalf("clickhouse guard table was modified: rows=%#v err=%v", guard, err)
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #1312** (2026-09-30): release (@modelorona)
- **PR #1311** (2026-09-30): release (@modelorona)
- **PR #1310** (2026-09-30): release (@modelorona)
- **PR #1306** (2026-09-29): release (@modelorona)
- **PR #1305** (closed): Bump @types/node from 26.5.0 to 26.6.2 in /sdk (@dependabot[bot])
- **PR #1304** (closed): Bump oxlint from 1.83.0 to 1.85.0 in /sdk (@dependabot[bot])
- **PR #1301** (2026-09-28): release (@modelorona)
- **PR #1299** (closed): Bump @types/node from 26.5.0 to 26.6.1 in /sdk (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
