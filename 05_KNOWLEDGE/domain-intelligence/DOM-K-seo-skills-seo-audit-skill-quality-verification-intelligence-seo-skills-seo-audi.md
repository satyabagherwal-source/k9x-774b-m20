# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: seo-skills/seo-audit-skill Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "seo-skills/seo-audit-skill",
  "source_url": "https://github.com/seo-skills/seo-audit-skill",
  "source_version": "f43ba12d",
  "license": "MIT",
  "timestamp": "2026-11-19T22:27:38.690Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-seo-skills-seo-audit-skill",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [seo-skills/seo-audit-skill](https://github.com/seo-skills/seo-audit-skill) (Revision: `f43ba12d`).  
> **License**: MIT | **Timestamp**: `2026-11-19T22:27:38.690Z`  
> **Learning ID**: `learn-github-seo-skills-seo-audit-skill`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: J (Search & Distribution Intelligence), I (Content & Information Intelligence), F (Design Intelligence), H (Technical Construction Intelligence), G (Architecture Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), E (Creative Intelligence), B (Product Intelligence)
- **Confidence Rating**: 60%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from seo-skills/seo-audit-skill:

# Forensic Learning Record (Deep Inspection): seo-skills/seo-audit-skill

> **Canonical Artifact**: `07_PROJECT_LEARNING/seo-skills-seo-audit-skill-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/seo-skills/seo-audit-skill](https://github.com/seo-skills/seo-audit-skill))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T22:27:37.588Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `seo-skills/seo-audit-skill`
- **Description**: A comprehensive SEO audit command-line tool with 332 audit rules across 20 categories. Analyze any website for SEO best practices, Core Web Vitals, security headers, structured data, accessibility, and more.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 783 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/browser-render.ts`
```
/**
 * Decide which browser work an audit does, from what the caller asked for.
 *
 * The browser render (headless Chrome, for Core Web Vitals, the rendered DOM
 * and the page's sub-resources) is the slow part of an audit: 8.6s with a cold
 * browser and 1.3s warm on a local page that audits in 0.4s without it, and
 * once per page under `--crawl`. So it runs only when asked for.
 *
 * The CLI (`--cwv`, `--mobile`, `--simulate-interaction`) and the dashboard's
 * run API both resolve their flags here. They used to decide separately, and
 * disagreed: the CLI rendered by default while the run form did not.
 */

/** What the caller asked for */
export interface BrowserRenderRequest {
  /**
   * Three states on purpose: `true` is `--cwv`, `false` is `--no-cwv`, and
   * `undefined` means the caller said nothing either way.
   */
  cwv?: boolean;
  /** `--mobile`: also render at a mobile viewport for the parity rules */
  mobile?: boolean;
  /** `--simulate-interaction`: click and scroll so INP can be measured */
  simulateInteraction?: boolean;
}

/** What the audit will actually do */
export interface BrowserRender {
  /** Render the page in a browser and measure Core Web Vitals */
  measureCwv: boolean;
  /** Render a second time at a mobile viewport. Never true without measureCwv. */
  mobile: boolean;
  /** Drive a synthetic interaction during the render. Never true without measureCwv. */
  simulateInteraction: boolean;
}

export function resolveBrowserRender(request: BrowserRenderRequest): BrowserRender {
  // `--mobile` and `--simulate-interaction` only mean something inside a render,
  // so asking for either asks for the render too. That keeps `audit --mobile`
  // doing what it did through 7.0.0. An explicit `--no-cwv` still wins.
  const wantsRenderedCheck = request.mobile === true || request.simulateInteraction === true;
  const measureCwv = request.cwv ?? wantsRenderedCheck;
  return {
    measureCwv,
    mobile: measureCwv && request.mobile === true,
    simulateInteraction: measureCwv && request.simulateInteraction === true,
  };
}

```

### Core Architecture Module: `src/render/axe.ts`
```
import type { RenderProbe } from './probes.js';

/** One axe rule that found problems on the page */
export interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  /** WCAG tags, such as wcag2aa or wcag143 */
  tags: string[];
  help: string;
  helpUrl: string;
  /** Elements affected */
  nodes: number;
  /** CSS selectors of the first few */
  targets: string[];
}

export interface AxeResult {
  version: string;
  violations: AxeViolation[];
}

let source: string | undefined;

/**
 * Runs axe-core in the rendered page: every rule except experimental and
 * deprecated ones, reporting violations only. "Needs review" results are
 * left out; they are noise as findings.
 */
export const AXE_PROBE: RenderProbe = {
  id: 'axe',
  family: 'accessibilityEngine',
  timeoutMs: 15_000,
  script: async () => {
    // Loaded on the first render only: 1.4 MB of script a static run never needs
    if (source === undefined) {
      // CommonJS: wrapped in `default` under ESM, bare under a CJS bundle
      const loaded = (await import('axe-core')) as unknown as { default?: { source: string }; source?: string };
      source = loaded.default?.source ?? loaded.source ?? '';
    }
    return `${source};
(async () => {
  const ids = axe.getRules()
    .filter((rule) => !rule.tags.includes('experimental') && !rule.tags.includes('deprecated'))
    .map((rule) => rule.ruleId);
  const result = await axe.run(document, { runOnly: { type: 'rule', values: ids }, resultTypes: ['violations'] });
  return {
    version: axe.version,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact || null,
      tags: v.tags.filter((tag) => /^wcag/.test(tag)),
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((node) => [].concat(node.target).join(' ')),
    })),
  };
})()`;
  },
};

```

### Core Architecture Module: `src/render/coverage.ts`
```
/**
 * How much of each script and stylesheet a page used during load.
 *
 * Read from Chromium's coverage through Playwright. Only the per-resource
 * totals travel on: a page's script sources are large and nothing downstream
 * needs them.
 */

export interface ResourceCoverage {
  url: string;
  /** Characters in the resource, a close stand-in for its uncompressed bytes */
  totalBytes: number;
  unusedBytes: number;
}

export interface CodeCoverage {
  js: ResourceCoverage[];
  css: ResourceCoverage[];
}

interface V8Range {
  startOffset: number;
  endOffset: number;
  count: number;
}

/**
 * Unused characters in a script from V8 block coverage.
 *
 * Ranges nest: a function's range holds its blocks' ranges, and a character's
 * state is the count of the innermost range around it. Sorted outer-first, a
 * stack of open ranges walks the script once.
 */
export function unusedFromBlockCoverage(functions: Array<{ ranges: V8Range[] }>): number {
  const ranges = functions
    .flatMap((f) => f.ranges)
    .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  let unused = 0;
  let position = 0;
  const open: V8Range[] = [];
  const credit = (range: V8Range, from: number, to: number) => {
    if (range.count === 0 && to > from) unused += to - from;
  };
  for (const range of ranges) {
    while (open.length > 0 && open[open.length - 1].endOffset <= range.startOffset) {
      const done = open.pop()!;
      credit(done, position, done.endOffset);
      position = Math.max(position, done.endOffset);
    }
    if (open.length > 0) credit(open[open.length - 1], position, range.startOffset);
    position = Math.max(position, range.startOffset);
    open.push(range);
  }
  while (open.length > 0) {
    const done = open.pop()!;
    credit(done, position, done.endOffset);
    position = Math.max(position, done.endOffset);
  }
  return unused;
}

/** Characters of a stylesheet no rule on the page matched */
export function unusedFromCssRanges(text: string, ranges: Array<{ start: number; end: number }>): number {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let used = 0;
  let reached = 0;
  for (const range of sorted) {
    const start = Math.max(range.start, reached);
    if (range.end > start) used += range.end - start;
    reached = Math.max(reached, range.end);
  }
  return Math.max(0, text.length - used);
}

```

### Core Architecture Module: `src/render/image-sizing.ts`
```
import type { RenderProbe } from './probes.js';

/** One rendered image: its natural pixels and the box it is shown in */
export interface ImageSizingEntry {
  /** `currentSrc`: the resource the browser chose, srcset included */
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  /** Displayed box, CSS pixels */
  width: number;
  height: number;
}

/**
 * Reads every loaded, displayed <img>. Images not loaded yet (naturalWidth 0)
 * and those with no box are left out: there is nothing to compare.
 */
export const IMAGE_SIZING_PROBE: RenderProbe = {
  id: 'imageSizing',
  family: 'imageSizing',
  timeoutMs: 5000,
  script: `(() => {
    const out = [];
    for (const img of Array.from(document.images)) {
      if (!img.naturalWidth || !img.naturalHeight) continue;
      const box = img.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      const style = getComputedStyle(img);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      out.push({
        src: img.currentSrc || img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        width: Math.round(box.width),
        height: Math.round(box.height),
      });
      if (out.length >= 500) break;
    }
    return out;
  })()`,
};

```

### Core Architecture Module: `src/render/probes.ts`
```
/**
 * Render probes: scripts run inside the rendered page that return JSON.
 *
 * Some checks need what only a browser knows: an image's displayed size, the
 * accessibility tree. A probe is a script string, so the CLI (Playwright's
 * `page.evaluate`) and the desktop app (`webContents.executeJavaScript`) run
 * the same code. Each result lands on `context.probes[id]`; a missing result
 * means the rule is not measured.
 */

import { IMAGE_SIZING_PROBE } from './image-sizing.js';
import { AXE_PROBE } from './axe.js';

/** What a fetcher can measure in the page; the web and desktop run pages show these */
export type ProbeFamily = 'imageSizing' | 'accessibilityEngine';

export interface RenderProbe {
  id: string;
  family: ProbeFamily;
  /**
   * JavaScript evaluated in the page; its value (a Promise is awaited) is the
   * result. A function supplies it lazily, for a script too large to build
   * when no render runs.
   */
  script: string | (() => Promise<string>);
  timeoutMs: number;
}

/** Every probe a render runs, in order */
export const RENDER_PROBES: RenderProbe[] = [IMAGE_SIZING_PROBE, AXE_PROBE];

/** Results by probe id; a probe that threw or timed out is absent */
export type ProbeResults = Record<string, unknown>;

/**
 * Run each probe through `evaluate`, one at a time, each within its timeout.
 * A failure leaves that probe's result out and the others still run.
 */
export async function runProbes(
  evaluate: (script: string) => Promise<unknown>,
  probes: RenderProbe[] = RENDER_PROBES
): Promise<ProbeResults> {
  const results: ProbeResults = {};
  for (const probe of probes) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const script = typeof probe.script === 'function' ? await probe.script() : probe.script;
      const value = await Promise.race([
        evaluate(script),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`probe ${probe.id} timed out`)), probe.timeoutMs);
        }),
      ]);
      // Plain JSON only: what a rule reads must survive storage and IPC
      results[probe.id] = JSON.parse(JSON.stringify(value ?? null));
    } catch {
      // Absent: the rules that need it report not measured
    } finally {
      clearTimeout(timer);
    }
  }
  return results;
}

```

### Core Architecture Module: `src/rules/content/unrendered-markup.ts`
```
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { collectVisibleText } from './utils/visible-text.js';

/** Markdown that reached the reader as characters instead of formatting. */
const MARKDOWN = [
  /\*\*[^*\n]{1,120}\*\*/,
  /__[^_\n]{1,120}__/,
  /\[[^\]\n]{1,120}\]\((?:https?:\/\/|\/)[^)\s]+\)/,
  /!\[[^\]]*\]\([^)\s]+\)/,
];

const SAMPLE_LIMIT = 3;

/**
 * Rule: Unrendered Markdown in visible text
 *
 * A CMS that prints a Markdown field as text leaves **bold** and
 * [label](url) on the page. Text inside code and pre is ignored.
 */
export const unrenderedMarkupRule = defineRule({
  id: 'content-unrendered-markup',
  name: 'Unrendered Markup',
  description: 'Checks visible text for Markdown that was printed instead of rendered',
  category: 'content',
  weight: 6,
  run: (context: AuditContext) => {
    const samples: string[] = [];

    for (const chunk of collectVisibleText(context.$)) {
      const match = MARKDOWN.map((pattern) => chunk.match(pattern)?.[0]).find(Boolean);
      if (!match) continue;
      samples.push(match);
      if (samples.length >= SAMPLE_LIMIT) break;
    }

    if (samples.length === 0) {
      return pass('content-unrendered-markup', 'No unrendered Markdown in visible text', {
        samples: [],
      });
    }

    return warn(
      'content-unrendered-markup',
      `Visible text contains unrendered Markdown: ${samples.join('; ')}`,
      {
        samples,
        recommendation:
          'Render the field as HTML before publishing, or stop storing Markdown in a plain-text slot.',
      }
    );
  },
});

```

### Core Architecture Module: `src/rules/content/utils/pixel-width.ts`
```
/**
 * Approximate pixel width of text at standard SERP font size (~16px Arial)
 * Based on average character width measurements
 */
export function estimatePixelWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    if (char === ' ') {
      width += 4;
    } else if (char >= 'A' && char <= 'Z') {
      width += 9.5;
    } else if (char >= 'a' && char <= 'z') {
      width += 7.5;
    } else if (char >= '0' && char <= '9') {
      width += 7.5;
    } else if (
      char === '.' ||
      char === ',' ||
      char === ':' ||
      char === ';' ||
      char === '!' ||
      char === '|' ||
      char === 'i' ||
      char === 'l' ||
      char === '1'
    ) {
      width += 4;
    } else if (
      char === 'm' ||
      char === 'w' ||
      char === 'M' ||
      char === 'W'
    ) {
      width += 11;
    } else {
      width += 7.5;
    }
  }
  return Math.round(width);
}

```

### Core Architecture Module: `src/rules/content/utils/stopwords.ts`
```
/**
 * Common English stopwords to exclude from keyword analysis
 * These words are too common to indicate keyword stuffing
 */
export const STOPWORDS = new Set([
  // Articles
  'a',
  'an',
  'the',
  // Conjunctions
  'and',
  'or',
  'but',
  'nor',
  'so',
  'yet',
  'for',
  // Prepositions
  'in',
  'on',
  'at',
  'to',
  'of',
  'with',
  'by',
  'from',
  'as',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'under',
  'over',
  'out',
  'up',
  'down',
  'about',
  'against',
  'among',
  'around',
  // Pronouns
  'i',
  'me',
  'my',
  'myself',
  'we',
  'our',
  'ours',
  'ourselves',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
  'he',
  'him',
  'his',
  'himself',
  'she',
  'her',
  'hers',
  'herself',
  'it',
  'its',
  'itself',
  'they',
  'them',
  'their',
  'theirs',
  'themselves',
  'what',
  'which',
  'who',
  'whom',
  'this',
  'that',
  'these',
  'those',
  // Common verbs
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'having',
  'do',
  'does',
  'did',
  'doing',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
  'shall',
  // Other common words
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'not',
  'only',
  'own',
  'same',
  'than',
  'too',
  'very',
  'just',
  'also',
  'now',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'any',
  'if',
  'then',
  'because',
  'while',
  'although',
  'though',
  'once',
  'until',
  'unless',
  'however',
  'therefore',
  // Numbers and misc
  'one',
  'two',
  'three',
  'first',
  'second',
  'new',
  'get',
  'make',
  'like',
  'even',
  'still',
  'well',
  'back',
  'way',
  'much',
  'many',
]);

/**
 * Interface chrome and technical tokens that leak into extracted body text.
 *
 * These are not prose and must never count as keywords. Sources include icon
 * font ligatures (`<i class="material-icons">settings</i>` renders its glyph
 * name as a text node), navigation labels, and file extensions.
 *
 * Deliberately excludes ambiguous words that are genuine topics for some sites
 * ("image", "search", "content", "video") — those are handled by the topical
 * term allowance in the keyword stuffing rule, not by filtering.
 */
export const WEB_BOILERPLATE = new Set([
  // URL and file fragments
  'com', 'www', 'http', 'https', 'html', 'htm', 'php', 'aspx',
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf',
  // Icon font ligatures and markup leftovers
  'icon', 'icons', 'logo', 'img', 'div', 'span', 'href', 'src',
  // Navigation and control chrome
  'menu', 'nav', 'navbar', 'navigation', 'sidebar', 'breadcrumb',
  'toggle', 'dropdown', 'modal', 'popup', 'overlay', 'widget',
  'login', 'logout', 'signin', 'signup', 'register', 'submit',
  'button', 'close', 'expand', 'collapse', 'skip',
  // Boilerplate footer and consent text
  'cookie', 'cookies', 'copyright', 'reserved', 'disclaimer',
  'newsletter', 'subscribe', 'unsubscribe',
]);

/**
 * Check if a word is a stopword
 */
export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase());
}

/**
 * Filter words down to those eligible for keyword frequency analysis.
 *
 * Stricter than getContentWords: also drops interface chrome and enforces a
 * minimum length, since 1-2 character tokens are almost always markup noise.
 */
export function getKeywordWords(words: string[], minLength = 3): string[] {
  return words.filter((word) => {
    const w = word.toLowerCase();
    return w.length >= minLength && !STOPWORDS.has(w) && !WEB_BOILERPLATE.has(w);
  });
}

/**
 * Remove stopwords from an array of words
 */
export function removeStopwords(words: string[]): string[] {
  return words.filter((word) => !isStopword(word));
}

/**
 * Filter words to only include content words (non-stopwords)
 * Also filters out very short words (< 2 chars)
 */
export function getContentWords(words: string[]): string[] {
  return words.filter((word) => word.length >= 2 && !isStopword(word));
}

```

### Core Architecture Module: `src/rules/content/utils/syllable-counter.ts`
```
/**
 * Count syllables in a word using simplified English rules
 * Based on CMU pronunciation dictionary heuristics
 */
export function countSyllables(word: string): number {
  word = word.toLowerCase().trim();

  // Handle empty or very short words
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;

  // Remove trailing 'e' (silent e)
  let processed = word;
  if (processed.endsWith('e') && !processed.endsWith('le')) {
    processed = processed.slice(0, -1);
  }

  // Handle -le endings (e.g., "table" has 2 syllables)
  if (word.endsWith('le') && word.length > 2) {
    const charBeforeLe = word[word.length - 3];
    if (!/[aeiouy]/.test(charBeforeLe)) {
      // consonant + le = extra syllable
      processed = word.slice(0, -2);
    }
  }

  // Handle -ed endings
  if (word.endsWith('ed') && word.length > 3) {
    const charBeforeEd = word[word.length - 3];
    // -ted, -ded add a syllable; others are silent
    if (charBeforeEd !== 't' && charBeforeEd !== 'd') {
      processed = word.slice(0, -2);
    }
  }

  // Count vowel groups
  const vowelGroups = processed.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Adjust for le ending we handled earlier
  if (word.endsWith('le') && word.length > 2) {
    const charBeforeLe = word[word.length - 3];
    if (!/[aeiouy]/.test(charBeforeLe)) {
      count++;
    }
  }

  // Minimum 1 syllable per word
  return Math.max(1, count);
}

/**
 * Calculate Flesch-Kincaid Reading Ease score
 * Score = 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
 *
 * Score interpretation:
 * - 90-100: Very Easy (5th grade)
 * - 80-90: Easy (6th grade)
 * - 70-80: Fairly Easy (7th grade)
 * - 60-70: Standard (8th-9th grade) - TARGET
 * - 50-60: Fairly Difficult (10th-12th grade)
 * - 30-50: Difficult (college)
 * - 0-30: Very Difficult (college graduate)
 */
export function calculateFleschKincaid(
  words: string[],
  sentenceCount: number
): number {
  if (words.length === 0 || sentenceCount === 0) return 0;

  const totalSyllables = words.reduce(
    (sum, word) => sum + countSyllables(word),
    0
  );

  const avgSentenceLength = words.length / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / words.length;

  const score =
    206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, score));
}

/**
 * Get reading level description based on Flesch-Kincaid score
 */
export function getReadingLevelDescription(score: number): string {
  if (score >= 90) return 'Very Easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly Easy (7th grade)';
  if (score >= 60) return 'Standard (8th-9th grade)';
  if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
  if (score >= 30) return 'Difficult (college level)';
  return 'Very Difficult (college graduate)';
}

```

### Core Architecture Module: `src/rules/content/utils/text-extractor.ts`
```
import type { CheerioAPI } from 'cheerio';

/** Elements that are not the page's main content: code, chrome, hidden copy */
export const NON_CONTENT_SELECTOR =
  'script, style, noscript, nav, footer, header, aside, ' +
  '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
  '[aria-hidden="true"], .nav, .navigation, .footer, .header, .sidebar';

/**
 * Extract readable text content from page body
 * Excludes: scripts, styles, navigation, headers, footers
 */
export function extractMainContent($: CheerioAPI): string {
  // Clone to avoid modifying original
  const body = $('body').clone();

  // Remove non-content elements
  body.find(NON_CONTENT_SELECTOR).remove();

  return body.text().trim();
}

/**
 * Matches URLs, bare domains and email addresses.
 *
 * Tokenizing these produces meaningless fragments: "dailyadvent.com" becomes
 * ["dailyadvent", "com"], which inflates "com" into a top keyword on any page
 * that prints its own domain a few times.
 */
const URL_PATTERN =
  /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|co|ai|app|dev|tv|me|info|biz|edu|gov|mil|int|eu|uk|de|fr|es|it|nl|ru|jp|cn|br|in|au|ca|ch|se|no|fi|dk|pl|tr)\b(?:\/\S*)?/gi;

const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/gi;

/**
 * Remove URLs, bare domains and emails from text.
 *
 * Only used for keyword frequency analysis — word counts and readability
 * scores still count URLs as text, which is the correct behaviour there.
 */
export function stripUrls(text: string): string {
  return text.replace(EMAIL_PATTERN, ' ').replace(URL_PATTERN, ' ');
}

/**
 * Tokenize text into words
 * Removes punctuation and splits on whitespace
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return tokenize(text).length;
}

/**
 * Count sentences in text
 * Splits on sentence-ending punctuation
 */
export function countSentences(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return Math.max(1, sentences.length);
}

/**
 * Calculate word frequency map
 * Returns map of word -> count
 */
export function getWordFrequency(words: string[]): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const word of words) {
    const count = frequency.get(word) || 0;
    frequency.set(word, count + 1);
  }
  return frequency;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #16** (2026-11-19): **fix: resolve dashboard and fix queue QA findings**
  *Symptoms*: ## Summary  - honor rule overrides in dashboard, desktop, and HTML fix queues while preserving score totals - apply the default per-host crawl limit and return an empty comparison for a first audit - forward the development proxy token and origin, and fix mobile overflow and command spacing - update regression coverage and documentation for the corrected behavior  ## Verification  - `npm run typecheck` - `npm run test:run` — 180 files, 2,605 passed, 2 skipped - `npm run build` - `npm run electron:build` - `npm run check:docs && npm run check:tokens` - Real example.com audit: 398 rules, score 87 - Live dashboard crawl peaked at two requests per host - Development and production browser QA passed at 375px with no console or API errors

- **Issue #15** (2026-11-18): **v8.0.0 Audits you can gate CI and agents on: polite crawls, real broken-link checks, internal link strength and your own checks, in the new SEOmator look**
  *Symptoms*: SEOmator 8.0 gives you a score you can gate CI and AI agents on: a crawl that respects the site, broken-link answers you can trust, internal link strength, your own checks, and an MCP server, all in the new SEOmator look. It serves the README's goal of an audit that runs on your machine and tells the truth about what it measured.  ## Summary  People ran SEOmator in CI and in agents and hit the same wall. They got a score they could not trust as a gate. A crawl that hit a rate limit counted every 429 as a broken page. External links that blocked bots read as broken. Checks that could not run (no browser, no crawl) failed at full weight. A config typo silently did nothing.  8.0 fixes the measurement first:  - **Polite crawling.** 429 and 503 are retried with backoff and `Retry-After`, `Crawl-delay` is honoured (capped at 10 s), per-host concurrency applies, a failing host is given up on, and `--max-duration` bounds a run. A crawl says how many pages it measured; `--min-coverage` gates on it. - **Trustworthy verdicts.** Soft-404 and duplicate detection compare the whole crawl. External links count as broken only when the target is gone; 401, 403, 429 and 999 read "could not verify". A check that cannot run says why (needs a render, needs a crawl, did not apply) and never moves the score. 25 new checks ship advisory until their verdicts are proven on real sites. - **New measurements.** Internal Link Score (PageRank over your own links), axe-core accessibility groups, unused JS an

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

### Incident Patch 1: `e8cc2473` (2026-11-18)
**Commit Message**: feat(design): the report opens on its score, then goes straight to the fix queue

In the dashboard, the desktop app and the HTML report the score leads and one
fix queue follows from 01, with no fix featured above the rest. The agent
introduces the queue with one sentence the numbers support ("The first five
return 2.4 of the 8.8 points this page is missing"); while a score cap holds,
the score names it and the fix that lifts it. The lead-fix block
(LeadFix.tsx) is gone, and DESIGN.md and the CHANGELOG say the same.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +11/-11)
```diff
@@ -9,12 +9,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 
-- **The report opens on what to fix first.** In the dashboard, the desktop app
-  and the HTML report, the largest thing on an audit is now the first fix,
+- **The report opens on its score, then goes straight to what to fix.** In
+  the dashboard, the desktop app and the HTML report, the score leads and one
+  fix queue follows from 01, with no fix featured above the rest. Each fix is
   written as an instruction ("Reduce DOM size") with what the check saw, the
   score points it returns, and a brief to copy for a developer. The SEOmator
-  agent sits over it with one sentence the numbers support ("The first five
-  fixes return 2.4 of the 8.8 points this page is missing").
+  agent introduces the queue with one sentence the numbers support ("The
+  first five return 2.4 of the 8.8 points this page is missing"); while a
+  score cap holds, the score names it and the fix that lifts it.
 - **Score points per fix.** Every failing or warning check carries `points`:
   what the score gains if it passes, from the same weights that make the score
   (`src/rules/points.ts`). All of an audit's points add up to what its score is
@@ -27,8 +29,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   column to filter the fix queue; the same numbers are one click away as a
   table.
 - **The agent in the product.** The emblem appears as a character: crawling
-  while a run is live (the only animation that loops), focused on the lead
-  fix, and reacting once when a run hands over to its report. Reduced motion
+  while a run is live (the only animation that loops), focused over the fix
+  queue, and reacting once when a run hands over to its report. Reduced motion
   shows still poses.
 - `DESIGN.md`: the design system ("The Fix Brief") the three surfaces follow.
 
@@ -47,8 +49,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   half-filled one warns, an open one passes, a dashed one was not measured and
   a circle is advisory.
 - The audit page has no category sidebar or score ring: the score is a plain
-  number beside the lead fix, with what it is missing, what it did not count,
-  and what changed since the last run. Export formats sit in one menu and
+  number at the top, with what it is missing, what it did not count, and what
+  changed since the last run beside it. Export formats sit in one menu and
   Delete in the ⋯ menu.
 - **All checks reads like the rest of the report.** Each category is one white
   surface with hairline rows (it was faint grey boxes on the grey page), the
@@ -67,9 +69,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   apply where there is a hovering pointer, menus grow from their trigger and
   take arrow keys, Home and End, the strip's tooltip appears after a moment and
   then follows the pointer instantly, fix-queue rows show a chevron and open
-  on a click anywhere, "Show evidence" opens under the lead fix instead of
-  jumping to the end of the page, and the report shows its own shape while it
-  loads.
+  on a click anywhere, and the report shows its own shape while it loads.
 - **The run form offers every option a run takes.** Core Web Vitals with its
   mobile render and interaction run, crawl with pages, pages at once, a time
   limit and ignoring the site's crawl-delay, staging, the categories to run
```

**File**: `DESIGN.md` (modified, +35/-52)
```diff
@@ -25,14 +25,14 @@ colors:
   fail: "#BE1212"               # 6.4:1; on the status shape and on scores under 70
   warn: "#92400E"               # 7.1:1; on the status shape and on scores 70-79
   improved: "#167A34"           # 5.4:1; ONLY for change since the last run (fixed, up)
-  agent: "#FE5000"              # the emblem, its progress line, the lead-fix flag, the one primary action
+  agent: "#FE5000"              # the emblem, its progress line, the one primary action
   agent-hover: "#E64800"
   agent-text: "#B83800"         # the agent speaking, 5.8:1 on surface
   on-agent: "#FFFFFF"           # text on an orange fill: white, as seomator.com; 3.3:1, AA large only (owner call)
   strip: "#E5E5E5"              # the kept part of a points-strip column
 
 typography:
-  lead-fix:                     # the first fix on a report; the live phase on the run screen
+  phase:                        # the live phase on the run screen, and its form heading
     fontFamily: Geist
     fontWeight: 600
     fontSize: 2.5rem            # 40px; 32px under 900px
@@ -44,7 +44,7 @@ typography:
     fontSize: 1.25rem
     lineHeight: 1.75rem
     letterSpacing: "-0.01em"
-  page-title:                   # the audited host; smaller than the lead fix on purpose
+  page-title:                   # the audited host; smaller than the score on purpose
     fontFamily: Geist
     fontWeight: 600
     fontSize: 1.25rem
@@ -83,12 +83,6 @@ typography:
     lineHeight: 3.5rem
     letterSpacing: "-0.03em"
     fontFeature: tnum
-  points:                       # the lead fix's "+0.6"
-    fontFamily: Geist Mono
-    fontWeight: 500
-    fontSize: 1.75rem
-    lineHeight: 2rem
-    fontFeature: tnum
   agent-voice:
     fontFamily: Geist Mono
     fontWeight: 400
@@ -146,9 +140,6 @@ components:
     backgroundColor: "{colors.surface}"
     borderColor: "{colors.line}"
     rounded: "{rounded.panel}"
-  lead-flag:
-    backgroundColor: "{colors.agent}"
-    width: 2px
 ---
 
 # SEOmator audit
@@ -157,9 +148,10 @@ components:
 
 **Creative North Star:** *It told me exactly what to fix first.* A zero-chroma
 measurement console (the seomator.com v3 "clean console, living agent" system,
-applied to a working tool) where the first fix owns the headline, the queue is
-ranked by score points the engine can prove, and colour marks only what is
-wrong, what got better, and where the agent is pointing.
+applied to a working tool) that opens on a plain score and goes straight into
+one queue of fixes, ranked by score points the engine can prove, with no fix
+singled out above it; colour marks only what is wrong, what got better, and
+where the agent is pointing.
 
 **Product context:** `@seomator/seo-audit`, a local SEO audit engine (398 rules,
 20 weighted categories). Readers are SEO practitioners, technical marketers and
@@ -186,9 +178,9 @@ design there (mono deltas, states by shape, the agent docked with one sentence,
 a 2px flag on the row that matters, "where every number comes from").
 
 **Key characteristics (first five seconds):**
-- The biggest words on a report are a verb: "Reduce DOM size".
-- One orange stripe, one orange agent, one orange button. Nothing else is orange.
-- The score is a plain number in the corner, with what's missing written under it.
+- The report opens on the score: a plain number, a meter with its grade notches, and what the next grade takes.
+- One orange agent, one orange button. Nothing else is orange.
+- No fix is featured: the queue starts at 01, and its order is the advice.
 - Problems are red or amber shapes. Fine is quiet. Green means "better than last time".
 - A single table of fixes, already in order, each with what it is worth.
 
@@ -204,8 +196,7 @@ a code editor, so neither theme is a costume; light is canonical because the
 HTML report is emailed and printed.
 
 **Who may be orange (the whole budget):** the agent emblem; its 2px progress
-line while a run is live; the 2px flag on the lead fix, once per screen; the one
-primary action on a screen ("Run again", "Run audit"); the agent's sentence, as
+line while a run is live; the one primary action on a screen ("Run again", "Run audit"); the agent's sentence, as
 `agent-text`. Selection, focus, links, checkboxes and the active filter are ink.
 
 **Colour only where it's wrong:**
@@ -255,10 +246,10 @@ unconfirmed, and the HTML report could not carry it either way. One face on all
 three hosts beats the brand face on two. Degular stays in the wordmark, which
 ships as outlines. Geist is normally an overused display voice; it is justified
 here because this is an Operate/Read surface with no marketing moment, and the
-largest type on the page is a fix, not a slogan.
+largest type on the page is the score, not a slogan.
 
 **Scale:** 11 label · 13 small · 14 body · 16 reading · 20 section and page title ·
-28 points · 40 lead fix · 56 score. Levels differ by size, not just weight.
+40 run phase · 56 score. Levels differ by size, not just weight.
 L
```

**File**: `src/reporters/fix-brief.ts` (modified, +10/-9)
```diff
@@ -49,7 +49,7 @@ export function tied(a: PointedFix | undefined, b: PointedFix | undefined): bool
   return Boolean(a && b && formatPoints(a.points) === formatPoints(b.points));
 }
 
-/** The fix that lifts a page-level cap, as the lead headline */
+/** The fix that lifts a page-level cap, said where the score names the cap */
 const CAP_HEADLINES: Record<string, string> = {
   noindex: 'Remove the noindex directive',
   'robots-disallowed': 'Let Googlebot fetch this page',
@@ -63,29 +63,30 @@ export function capHeadline(capId: string): string {
 }
 
 /**
- * The agent's one sentence over the lead fix.
+ * The agent's one sentence over the fix queue.
  *
- * It may only say what the numbers support: "more than the next four
- * together" is printed when it is true and never as a slogan.
+ * It speaks about the queue as a whole, never as a pitch for one fix, and may
+ * only say what the numbers support: "more than the next four together" is
+ * printed when it is true and never as a slogan.
  */
 export function agentLine(fixes: readonly PointedFix[], result: FixBriefAudit): string {
   const where = result.crawledPages > 1 ? 'this site' : 'this page';
-  if (result.scoreCap) return 'Start here. Nothing else moves the score until this is fixed.';
+  if (result.scoreCap) return 'Lift the score cap first. Nothing in this queue moves the score until it is gone.';
   if (fixes.length === 0) return 'Nothing to fix in what we measured.';
 
   const missing = missingPoints(fixes).toFixed(1);
   const [lead, ...rest] = fixes;
   const nextFour = rest.slice(0, 4).reduce((sum, fix) => sum + fix.points, 0);
   if (rest.length >= 4 && lead!.points > nextFour) {
-    return `Start here. This one returns more than the next four together, of the ${missing} points ${where} is missing.`;
+    return `Work from the top. 01 alone returns more than the next four together, of the ${missing} points ${where} is missing.`;
   }
   if (fixes.length <= 5) {
     return fixes.length === 1
-      ? `Start here. This is the one fix left, worth all ${missing} missing points.`
-      : `Start here. These ${fixes.length} fixes return all ${missing} points ${where} is missing.`;
+      ? `One fix left, worth all ${missing} missing points.`
+      : `These ${fixes.length} fixes return all ${missing} points ${where} is missing.`;
   }
   const topFive = fixes.slice(0, 5).reduce((sum, fix) => sum + fix.points, 0).toFixed(1);
-  return `Start here. The first five fixes return ${topFive} of the ${missing} points ${where} is missing.`;
+  return `Work from the top. The first five return ${topFive} of the ${missing} points ${where} is missing.`;
 }
 
 /** Where a grade starts; the verdict reads the rounded score (`verdict.ts`) */
```

**File**: `src/reporters/html-reporter.ts` (modified, +12/-58)
```diff
@@ -13,7 +13,7 @@ import { toCss as tokensToCss } from '../design/tokens.js';
 import { getCategoryById } from '../categories/index.js';
 import { getFixSuggestion } from './fix-suggestions.js';
 import { pointsByRule } from '../rules/points.js';
-import { agentLine, capHeadline, formatPoints, nextGradeLine, splitFix, tied } from './fix-brief.js';
+import { agentLine, formatPoints, nextGradeLine, splitFix } from './fix-brief.js';
 import { REPORT_FONT_FACES } from '../design/fonts.js';
 import { getRuleById } from '../rules/registry.js';
 import { isNotMeasured } from '../rules/define-rule.js';
@@ -142,44 +142,19 @@ const AGENT_EMBLEM = `<svg viewBox="0 0 150 150" role="img" aria-label="SEOmator
 </svg>`;
 
 /**
- * The first fix as the report's headline (DESIGN.md, R1), with the agent's one
- * sentence over it — the same wording the dashboard prints (`fix-brief.ts`).
- * A capped score leads with lifting the cap; nothing to fix prints nothing.
+ * The agent's one sentence over the fix queue, in the same wording the
+ * dashboard prints (`fix-brief.ts`). The queue starts at 01 with no fix
+ * featured above it; the score leads the report.
  */
-function leadFixHtml(
+function queueIntroHtml(
   ranked: AggregatedIssue[],
   pointsOf: (issue: AggregatedIssue) => number,
   result: AuditResult
 ): string {
   // One entry per rule: a live crawl can list a rule as a failure and a warning
   const seen = new Set<string>();
   const fixes = ranked.filter((issue) => !seen.has(issue.ruleId) && seen.add(issue.ruleId)).map((issue) => ({ issue, points: pointsOf(issue) }));
-  const line = escapeHtml(agentLine(fixes, result));
-  const cap = result.scoreCap?.caps[0];
-  if (cap && result.scoreCap) {
-    const lift = Math.max(result.scoreCap.uncappedScore - result.overallScore, 0);
-    return `<section class="fb-lead" aria-label="What to fix first">
-      <div class="fb-dock">${AGENT_EMBLEM}<span class="fb-say">${line}</span></div>
-      <div class="fb-kick">${statusHtml('fail')}<span class="fb-label">Score cap</span></div>
-      <h2 class="fb-headline">${escapeHtml(capHeadline(cap.id))}</h2>
-      <p class="fb-saw">${escapeHtml(cap.reason)}</p>
-      <div class="fb-acts"><div class="fb-points"><div class="fb-points-n">+${lift}</div><div class="fb-label">lifts the cap</div></div></div>
-    </section>`;
-  }
-  const lead = fixes[0];
-  if (!lead) return '';
-  const { headline, rest } = splitFix(getFixSuggestion(lead.issue.ruleId));
-  const saw = `${lead.issue.message.replace(/\.$/, '')}.${rest ? ` ${rest}.` : ''}`;
-  return `<section class="fb-lead" aria-label="What to fix first">
-      <div class="fb-dock">${AGENT_EMBLEM}<span class="fb-say">${line}</span></div>
-      <div class="fb-kick"><span class="fb-rank">01</span>${statusHtml(lead.issue.status)}<span class="fb-label">${escapeHtml(lead.issue.categoryName)}</span></div>
-      <h2 class="fb-headline">${escapeHtml(headline)}</h2>
-      <p class="fb-saw">${escapeHtml(saw)}</p>
-      <div class="fb-acts">
-        <a class="fb-btn" href="#" data-jump-rule="${escapeHtml(lead.issue.ruleId)}">Show evidence</a>
-        <div class="fb-points"><div class="fb-points-n">${formatPoints(lead.points)}</div><div class="fb-label">score points${tied(lead, fixes[1]) ? ' · tied with 02' : ''}</div></div>
-      </div>
-    </section>`;
+  return `<div class="fb-dock">${AGENT_EMBLEM}<span class="fb-say">${escapeHtml(agentLine(fixes, result))}</span></div>`;
 }
 
 /**
@@ -1783,25 +1758,15 @@ ${REPORT_FONT_FACES}
     }
 
     /* ========================================
-       The Fix Brief (DESIGN.md): the first fix is the headline, the score
-       is a plain number, status is a shape with its word, and colour only
-       marks what is wrong.
+       The Fix Brief (DESIGN.md): the score is a plain number and leads,
+       the fixes follow in points order from 01, status is a shape with its
+       word, and colour only marks what is wrong.
        ======================================== */
     .fb-label { font-family: var(--font-mono); font-size: 11px; font-weight: 500; line-height: 16px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-muted); }
-    .fb-lead { position: relative; padding: 4px 0 4px 26px; margin: 8px 0 32px; }
-    .fb-lead::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--color-agent); }
-    .fb-dock { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
+    .issues-summary-header { flex-wrap: wrap; }
+    .fb-dock { display: flex; align-items: center; gap: 10px; flex-basis: 100%; margin-top: 10px; }
     .fb-dock svg { width: 28px; height: 28px; flex: none; }
     .fb-say { font-family: var(--font-mono); font-size: 13px; line-height: 18px; color: var(--color-agent-text); }
-    .fb-kick { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 10px; }
-    .fb-rank { font-family: var(--font-mono); color: var(--color-text-mut
```

**File**: `src/reporters/report-shape.test.ts` (modified, +7/-5)
```diff
@@ -86,12 +86,14 @@ describe('report ordering', () => {
     expect(rows[1]).toContain('+9.1');
   });
 
-  it('leads with the first fix as the headline, above the queue', () => {
+  it('features no fix above the queue: the agent introduces it and 01 is its first row', () => {
     const html = render([category('perf', [rule('perf-render-blocking', 'warn')])]);
-    const lead = html.slice(html.indexOf('<section class="fb-lead"'), html.indexOf('<div class="issues-summary"'));
-    expect(lead).toContain('class="fb-headline"');
-    expect(lead).toContain('Start here.');
-    expect(lead).toContain('data-jump-rule="perf-render-blocking"');
+    expect(html).not.toContain('class="fb-lead"');
+    expect(html).not.toContain('data-jump-rule');
+    const queue = html.slice(html.indexOf('<div class="issues-summary"'), html.indexOf('<!-- Filter Tabs -->'));
+    expect(queue).toContain('class="fb-say"');
+    expect(queue).toContain('One fix left');
+    expect(queue.split('<tr class="issue-row"').slice(1)[0]).toContain('data-rule-id="perf-render-blocking"');
   });
 });
 
```

**File**: `ui/components/FixQueue.tsx` (modified, +112/-38)
```diff
@@ -1,16 +1,20 @@
 /**
- * Every fix after the first, already in order (DESIGN.md, R2).
+ * Every fix, already in order (DESIGN.md, R2).
  *
  * One queue ranked by the score points each fix returns, failures and
- * warnings together; the status shape still says which is which. A row opens
- * in place to its evidence. Pages appear only on a crawl — a single-page audit
- * printed "/" in that column on every row.
+ * warnings together; the status shape still says which is which. It starts at
+ * 01 with no fix singled out, and the agent's one sentence introduces it. A
+ * row opens in place to its evidence, with a brief to copy for a developer.
+ * Pages appear only on a crawl — a single-page audit printed "/" in that
+ * column on every row.
  */
 
-import { Fragment, useState } from 'react';
+import { Fragment, useEffect, useState } from 'react';
+import type { AuditResult } from '../../src/types.js';
+import { Agent } from './Logo.js';
 import { Status } from './Status.js';
 import { FixText } from './FixText.js';
-import { formatPoints, type Fix } from '../lib/fixes.js';
+import { agentLine, formatPoints, type Fix } from '../lib/fixes.js';
 
 /** Rows shown before "Show N more" */
 const VISIBLE = 8;
@@ -19,6 +23,8 @@ type StatusFilter = 'all' | 'fail' | 'warn';
 
 interface FixQueueProps {
   fixes: Fix[];
+  /** For the agent's sentence, and the page a copied brief names */
+  result: AuditResult;
   crawl: boolean;
   /** Points only count once a binding cap is lifted */
   capped: boolean;
@@ -27,18 +33,18 @@ interface FixQueueProps {
   onClearCategory: () => void;
   /** Jump to the rule's full result in "All checks" */
   onReveal: (fix: Fix) => void;
+  /** Straight from a run: the agent reacts once, then settles */
+  greet?: 'alert' | 'delighted';
 }
 
-export function FixQueue({ fixes, crawl, capped, category, onClearCategory, onReveal }: FixQueueProps) {
+export function FixQueue({ fixes, result, crawl, capped, category, onClearCategory, onReveal, greet }: FixQueueProps) {
   const [filter, setFilter] = useState<StatusFilter>('all');
   const [open, setOpen] = useState<string | null>(null);
   const [showAll, setShowAll] = useState(false);
 
   const ranked = fixes.map((fix, index) => ({ fix, rank: index + 1 }));
-  const filtered = filter !== 'all' || category !== null;
   const rows = ranked.filter(
-    ({ fix, rank }) =>
-      (filtered || rank > 1) &&
+    ({ fix }) =>
       (filter === 'all' || fix.status === filter) &&
       (category === null || fix.categoryId === category.id)
   );
@@ -55,25 +61,33 @@ export function FixQueue({ fixes, crawl, capped, category, onClearCategory, onRe
           {fixes.length} fix{fixes.length === 1 ? '' : 'es'} · ranked by score points returned, fails and warnings together
           {capped && ' · points count once the cap is lifted'}
         </span>
-        <div className="segmented ml-auto" role="group" aria-label="Filter fixes">
-          {([
-            ['all', `All ${fixes.length}`],
-            ['fail', `Fails ${fails}`],
-            ['warn', `Warnings ${warns}`],
-          ] as const).map(([key, text]) => (
-            <button
-              key={key}
-              type="button"
-              aria-pressed={filter === key}
-              className={`segment ${filter === key ? 'segment-active' : ''}`}
-              onClick={() => setFilter(key)}
-            >
-              {text}
-            </button>
-          ))}
-        </div>
+        {fixes.length > 0 && (
+          <div className="segmented ml-auto" role="group" aria-label="Filter fixes">
+            {([
+              ['all', `All ${fixes.length}`],
+              ['fail', `Fails ${fails}`],
+              ['warn', `Warnings ${warns}`],
+            ] as const).map(([key, text]) => (
+              <button
+                key={key}
+                type="button"
+                aria-pressed={filter === key}
+                className={`segment ${filter === key ? 'segment-active' : ''}`}
+                onClick={() => setFilter(key)}
+              >
+                {text}
+              </button>
+            ))}
+          </div>
+        )}
       </div>
 
+      <Dock
+        state={result.scoreCap ? 'alert' : fixes.length === 0 ? 'idle' : 'focused'}
+        greet={greet}
+        line={agentLine(fixes, result)}
+      />
+
       {category && (
         <p className="mb-3 text-[13px] text-[var(--color-text-secondary)]">
           Showing {category.name} only.{' '}
@@ -83,10 +97,8 @@ export function FixQueue({ fixes, crawl, capped, category, onClearCategory, onRe
         </p>
       )}
 
-      {rows.length === 0 ? (
-        <p className="tbl p-4 text-[13px] text-[var(--color-text-secondary)]">
-          {fixes.length <= 1 && !filtered ? 'The fix above is the only one.' : 'No fixes match this filter.'}
-        </p>
+      {fixes.length === 0 ? null : rows.length === 0 ? (
+        <p className="tbl p-4 text-[13px] text-[var(--color-text-secondary)]">No f
```

**File**: `ui/components/LeadFix.tsx` (removed, +0/-174)
```diff
@@ -1,174 +0,0 @@
-/**
- * The first fix, as the largest thing on the report (DESIGN.md, R1).
- *
- * The one 2px orange flag on the screen sits on its left edge, the agent is
- * docked above it saying one sentence the numbers support, and the fix text
- * itself is the headline. A capped score leads with lifting the cap instead,
- * because nothing else moves the score until then; an audit with nothing to fix
- * says so rather than showing an empty block.
- */
-
-import { useEffect, useState } from 'react';
-import type { AuditResult } from '../../src/types.js';
-import { Agent } from './Logo.js';
-import { Status } from './Status.js';
-import { FixText } from './FixText.js';
-import { agentLine, capHeadline, formatPoints, tied, type Fix } from '../lib/fixes.js';
-import { Chevron, Evidence } from './FixQueue.js';
-
-interface LeadFixProps {
-  fixes: Fix[];
-  result: AuditResult;
-  /** Checks that took no reading, for the zero-fix state */
-  notMeasured: number;
-  onShowEvidence: (fix: Fix) => void;
-  /** Straight from a run: the agent reacts once, then settles */
-  greet?: 'alert' | 'delighted';
-}
-
-/** A plain-text brief a developer can act on without opening the report */
-function brief(fix: Fix, url: string): string {
-  return [
-    fix.headline,
-    `What we saw: ${fix.message}`,
-    `How to fix: ${fix.headline}${fix.rest ? `. ${fix.rest}` : ''}.`,
-    `Check: ${fix.ruleId} (${fix.categoryName}) · ${formatPoints(fix.points)} score points`,
-    `Page: ${url}`,
-  ].join('\n');
-}
-
-export function LeadFix({ fixes, result, notMeasured, onShowEvidence, greet }: LeadFixProps) {
-  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
-  // The evidence opens here, under the fix, rather than jumping to the end of
-  // the report: the reader asked about this fix and should not lose it.
-  const [open, setOpen] = useState(false);
-  const lead = fixes[0];
-  const cap = result.scoreCap?.caps[0];
-  const crawl = result.crawledPages > 1;
-
-  const copy = async (text: string) => {
-    try {
-      await navigator.clipboard.writeText(text);
-      setCopied('done');
-    } catch {
-      setCopied('failed');
-    }
-    window.setTimeout(() => setCopied('idle'), 1500);
-  };
-
-  if (cap && result.scoreCap) {
-    const lift = Math.max(result.scoreCap.uncappedScore - result.overallScore, 0);
-    return (
-      <div className="lead-fix pl-[26px] pr-6 lg:pr-12">
-        <Dock state="alert" line={agentLine(fixes, result)} />
-        <div className="flex items-center gap-3 mb-2.5">
-          <Status status="fail" word="Holds the score" />
-          <span className="label">Score cap</span>
-        </div>
-        <h2 className="text-[32px] leading-[36px] lg:text-[40px] lg:leading-[44px] font-semibold tracking-[-0.02em] max-w-[22ch]">
-          <FixText text={capHeadline(cap.id)} />
-        </h2>
-        <p className="mt-4 text-base leading-6 max-w-[60ch] text-[var(--color-text-secondary)]">{cap.reason}</p>
-        <div className="mt-6 flex flex-wrap items-center gap-2">
-          <CopyButton state={copied} onCopy={() => void copy(`${capHeadline(cap.id)}\n${cap.reason}\nPage: ${result.url}`)} />
-          <Points value={`+${lift}`} label="lifts the cap" />
-        </div>
-      </div>
-    );
-  }
-
-  if (!lead) {
-    return (
-      <div className="lead-fix pl-[26px] pr-6 lg:pr-12">
-        <Dock state="idle" line={agentLine(fixes, result)} />
-        <h2 className="text-[32px] leading-[36px] font-semibold tracking-[-0.02em]">Nothing to fix in what we measured</h2>
-        {notMeasured > 0 && (
-          <p className="mt-4 text-base leading-6 text-[var(--color-text-secondary)]">
-            {notMeasured} check{notMeasured === 1 ? '' : 's'} took no reading. <a href="#gaps" className="underline underline-offset-[3px]">What we could not measure</a>
-          </p>
-        )}
-      </div>
-    );
-  }
-
-  return (
-    <div className="lead-fix pl-[26px] pr-6 lg:pr-12">
-      <Dock state="focused" greet={greet} line={agentLine(fixes, result)} />
-      <div className="flex flex-wrap items-center gap-3 mb-2.5">
-        <span className="figure text-[var(--color-text-muted)]">01</span>
-        <Status status={lead.status} />
-        <span className="label">{lead.categoryName}</span>
-      </div>
-      <h2 className="text-[32px] leading-[36px] lg:text-[40px] lg:leading-[44px] font-semibold tracking-[-0.02em] max-w-[22ch] [overflow-wrap:anywhere]">
-        <FixText text={lead.headline} />
-      </h2>
-      <p className="mt-4 text-base leading-6 max-w-[60ch] text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">
-        {lead.message.replace(/\.$/, '')}.{lead.rest && <> <FixText text={lead.rest} />.</>}
-      </p>
-      <p className="mt-2.5 figure text-xs text-[var(--color-text-muted)] [overflow-wrap:anywhere]">
-        {lead.ruleId}
-        {crawl && ` · ${lead.affectedPages.toLocaleString()} of ${lead.measuredPages.toLocaleString()} pages`
```

**File**: `ui/components/ScorePanel.tsx` (modified, +68/-47)
```diff
@@ -1,18 +1,23 @@
 /**
- * The score, in the corner it belongs in once the fix owns the headline.
+ * The score, as the first thing on the report.
  *
  * A plain number, no ring (DESIGN.md, R3): ink at 80 and above, amber below,
- * red under 70, with the grade word always in ink. Under it, what the score is
- * missing and what it did not count, then what changed since the last run —
- * the only place green appears on the report, because green means "better".
+ * red under 70, with the grade word always in ink. The meter and the next
+ * grade sit under it, and a binding cap is named here, with what lifts it,
+ * because nothing in the fix queue moves the score until it is gone. Beside
+ * it: what the score is missing, what it did not count, and what changed since
+ * the last run — the only place green appears, because green means "better".
+ * No single fix is featured; the queue below starts at 01.
  */
 
 import { Link } from 'react-router-dom';
 import type { AuditResult } from '../../src/types.js';
 import type { StoredComparison } from '../../src/dashboard/contract.js';
 import { getScoreColor, getScoreLabel } from '../lib/format.js';
 import { ScoreMeter } from './ScoreMeter.js';
-import { nextGradeLine, type Fix } from '../lib/fixes.js';
+import { Status } from './Status.js';
+import { FixText } from './FixText.js';
+import { capHeadline, nextGradeLine, type Fix } from '../lib/fixes.js';
 
 interface ScorePanelProps {
   result: AuditResult;
@@ -44,55 +49,71 @@ function when(iso: string, reference: string): string {
 export function ScorePanel(props: ScorePanelProps) {
   const { result, auditId, missing, scored, notMeasured, advisory, comparison, completion, hint, fixes, arriving } = props;
   const cap = result.scoreCap;
+  const binding = cap?.caps[0];
   // The bar shows the exact score; under a cap it shows the score that holds
   const exact = cap ? result.overallScore : 100 - missing;
 
   return (
-    <aside aria-label="Score" className="px-6 lg:pl-8 lg:pr-0 py-7">
-      <div className="label">Score</div>
-      <div className="mt-2 flex items-baseline gap-1">
-        <span className="figure text-[56px] leading-[56px] font-medium tracking-[-0.03em]" style={{ color: getScoreColor(result.overallScore) }}>
-          {result.overallScore}
-        </span>
-        <span className="figure text-lg text-[var(--color-text-muted)]">/100</span>
-      </div>
-      <div className="mt-2 font-medium">{getScoreLabel(result.overallScore)}</div>
-      <div className="mt-4">
-        <ScoreMeter value={exact} score={result.overallScore} size="lg" animate={arriving} />
+    <section aria-label="Score" className="grid lg:grid-cols-[8fr_4fr] border-b border-[var(--color-border)]">
+      <div className="py-7 lg:pr-12 min-w-0">
+        <div className="label">Score</div>
+        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
+          <span className="flex items-baseline gap-1">
+            <span className="figure text-[56px] leading-[56px] font-medium tracking-[-0.03em]" style={{ color: getScoreColor(result.overallScore) }}>
+              {result.overallScore}
+            </span>
+            <span className="figure text-lg text-[var(--color-text-muted)]">/100</span>
+          </span>
+          <span className="text-xl leading-7 font-semibold">{getScoreLabel(result.overallScore)}</span>
+        </div>
+        <div className="mt-5 max-w-[560px]">
+          <ScoreMeter value={exact} score={result.overallScore} size="lg" animate={arriving} />
+        </div>
+        {!cap && <p className="mt-3 text-base leading-6 text-[var(--color-text-secondary)] max-w-[60ch]">{nextGradeLine(exact, fixes)}</p>}
+        {cap && binding && (
+          <div className="mt-5 max-w-[60ch]">
+            <div className="flex flex-wrap items-center gap-3">
+              <Status status="fail" word="Holds the score" />
+              <span className="label">
+                Capped at {binding.ceiling} · <span className="figure">{cap.uncappedScore}</span> without it
+              </span>
+            </div>
+            <p className="mt-2 text-base leading-6 font-semibold">
+              <FixText text={capHeadline(binding.id)} />
+            </p>
+            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">{binding.reason}</p>
+          </div>
+        )}
       </div>
-      {!cap && <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">{nextGradeLine(exact, fixes)}</p>}
-      {cap && (
-        <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
-          Capped at {cap.caps[0]?.ceiling}. <span className="figure">{cap.uncappedScore}</span> without the cap.
-        </p>
-      )}
 
-      <dl className="mt-5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13px]">
-        <dt className="text-[var(--color-text-secondary)]">Missing</dt>
-        <dd className="figure text-right">{missing.toFixed(1)} pts</dd>
-    
```

---

### Incident Patch 2: `3e761afc` (2026-11-18)
**Commit Message**: fix(qa): ISSUE-002 — cross-page checks say they need a crawl, and a gate on one cannot pass unmeasured

On a single-page audit, 40 checks that compare pages (duplicates, orphans,
canonical and hreflang chains, inbound links, entity graphs, sitemap
cross-checks) returned not-measured with no reason, or with "not-applicable".
MCP and the dashboard then reported them as "could not verify", and a fail_ci
gate on a duplicate check treated a missing crawl as "nothing to find", so a
single-page run passed it without measuring anything.

They now carry a new reason, needs-crawl. It counts as "could not look", so a
gated cross-page check exits 1 on a single-page run and names --crawl. The
terminal counts them on one line ("N checks need a crawl: rerun with --crawl"),
the UI labels the group "needs a crawl", and MCP's notMeasuredByReason groups
them under needs-crawl. Eleven other rules that gave no reason now say
not-applicable, could-not-verify or needs-render, whichever is true.

Docs: the reason lists in the JSON, storage and architecture references, and a
second case plus a troubleshooting row in the CI gate guide.

CHANGELOG: needs-crawl in the 8.0.0 reason list, and Fixed entries for 

**File**: `CHANGELOG.md` (modified, +17/-2)
```diff
@@ -44,10 +44,12 @@ what can break a script or CI job, why scores move, and what to change.
   `advisory: true` and each category counts them in `advisoryCount`, outside
   pass/warn/fail.
 - **Why a check was not measured.** A `not-measured` result now carries
-  `reason`: `not-applicable`, `not-compared`, `needs-render`,
+  `reason`: `not-applicable`, `not-compared`, `needs-render`, `needs-crawl`,
   `could-not-verify`, `probe-failed`, `disabled`, `unsupported` or
   `rule-error`. A `fail_ci` gate reads it: "nothing to find on this page"
-  satisfies the gate, "could not look" on any page exits 1.
+  satisfies the gate, "could not look" on any page exits 1. A cross-page check
+  (duplicates, orphans, canonical chains) on a single-page run is "could not
+  look": it needs a crawl.
 - **`seomator mcp`, an MCP server for AI agents.** Registered as
   `seomator-audit`, it serves `audit_url`, `audit_status`, `cancel_run`,
   `list_audits`, `get_audit`, `get_findings`, `compare_audits`, `list_rules`
@@ -431,6 +433,19 @@ what can break a script or CI job, why scores move, and what to change.
   running page to finish, and stop only when the queue is empty and nothing
   is in flight. Crawls with `concurrency` above 1 are faster, and may reach
   pages in a different order.
+- **The CLI no longer hangs in a terminal that reports 0 columns.** Some
+  embedded terminals and CI shells report a width of 0. The category spinner
+  divided by it and tried to erase an endless number of lines, so `audit`
+  never finished. It now prints plain lines there.
+- **A crawl whose start page cannot be reached exits 2.** The crawler recorded
+  the failure as one more broken page, so a dead site, a typo in the host or a
+  refused connection did not stop the run: `audit --crawl` scored zero pages
+  and exited 1, and `seomator crawl` printed "Crawl complete!" and exited 0.
+  Both now stop with the same message and hint as a single-page audit.
+- **The LLM report counts every page a rule was measured on.** In a live
+  crawl, `pages="N" of="M"` counted M from the failing pages only, so it
+  always read "3 of 3" even when the rule passed on a fourth page. It now
+  counts every page with a reading, as stored audits already did.
 
 ## [7.0.0] - 2026-10-15
 
```

**File**: `docs/STORAGE-ARCHITECTURE.md` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ One row per rule per page. A single-page audit writes one row per rule that ran.
 | `details_json` | TEXT | | The result's `details` object as JSON, including the `pageUrl` the engine adds to every result. |
 | `executed_at` | TEXT | DEFAULT `datetime('now')` | When the row was inserted. |
 | `weight` | INTEGER | | The rule's weight for this result. `0` marks a result that took no reading. NULL on rows written before 3.4.0, which readers treat as weight 1. |
-| `reason` | TEXT | | Why a `not-measured` result took no reading: `not-applicable`, `not-compared`, `needs-render`, `could-not-verify`, `probe-failed`, `disabled`, `unsupported` or `rule-error`. NULL for measured results, for an unmeasured result whose rule gave no reason, and on rows written before 8.0. |
+| `reason` | TEXT | | Why a `not-measured` result took no reading: `not-applicable`, `not-compared`, `needs-render`, `needs-crawl`, `could-not-verify`, `probe-failed`, `disabled`, `unsupported` or `rule-error`. NULL for measured results, for an unmeasured result whose rule gave no reason, and on rows written before 8.0. |
 | `advisory` | INTEGER | | `1` when the result came from an advisory rule, which is reported and never counted in a score. NULL otherwise and on rows written before 8.0. |
 
 A row counts as unmeasured when `weight = 0 OR status = 'not-measured'` (`NOT_MEASURED_SQL` in `src/storage/audits-db/results.ts`). Three encodings exist in stored data:
```

**File**: `docs/ai-agent-integration.md` (modified, +2/-2)
```diff
@@ -227,7 +227,7 @@ All 7 checks passed. Ready to audit!
 ### Troubleshooting
 
 - **`cwv-*` and `js-rendered-*` checks are in `<not-measured>` although you passed `--cwv`.** No browser could start, and the audit carried on without one. Run `seomator self doctor`.
-- **Checks you need are in `<not-measured>`.** They need a flag. `--crawl` measures the link graph and cross-page checks, such as `links-depth`, `links-orphan-pages`, `core-title-unique`, `content-duplicate-exact` and `crawl-sitemap-orphan-urls`. `--mobile`, which implies `--cwv`, measures `mobile-parity-*`. `--cwv` measures `cwv-*`, `js-rendered-*`, `js-console-errors`, `js-failed-requests`, and the probes that run in the rendered page: `a11y-axe-*`, `perf-unused-js`, `perf-unused-css` and `images-oversized-delivery`. In `--format json`, every check a render would measure has `"reason": "needs-render"`. `cwv-inp` is always unmeasured, because INP needs a real user's interaction; `--simulate-interaction` only adds an indicative lab value to its message.
+- **Checks you need are in `<not-measured>`.** They need a flag. `--crawl` measures the link graph and cross-page checks, such as `links-depth`, `links-orphan-pages`, `core-title-unique`, `content-duplicate-exact` and `crawl-sitemap-orphan-urls`. `--mobile`, which implies `--cwv`, measures `mobile-parity-*`. `--cwv` measures `cwv-*`, `js-rendered-*`, `js-console-errors`, `js-failed-requests`, and the probes that run in the rendered page: `a11y-axe-*`, `perf-unused-js`, `perf-unused-css` and `images-oversized-delivery`. In `--format json`, every check a render would measure has `"reason": "needs-render"`, and every check a crawl would measure has `"reason": "needs-crawl"`. `cwv-inp` is always unmeasured, because INP needs a real user's interaction; `--simulate-interaction` only adds an indicative lab value to its message.
 - **A crawl stops at 10 pages although `seomator.toml` sets `max_pages`.** The file you edited may not be the one in use: `seomator config path` names it. A typed `-m` also wins over the file.
 - **`<issues>` has an `omitted` attribute.** The report kept the 150 highest-impact issues. Fix those and audit again, or use `--format json`, which carries every result (see [JSON output](#json-output-schema-4)).
 - **The score is 20 on a site you expect to rank.** The page, or a crawl's start page, is noindex or blocked by robots.txt, and `<score-cap>` says which. On a staging site, add `--staging`.
@@ -567,7 +567,7 @@ Each entry of `categoryResults[].results[]` is one rule's result on one page:
 | `details` | Rule-specific data. `details.pageUrl` names the page. |
 | `score` | 100 for `pass`, 50 for `warn`, 0 for `fail`. A `not-measured` result also carries 50; read `status`, not `score`. |
 | `weight` | The rule's weight in its category. Treat a result with `weight` 0 as not measured, whatever its `status`. |
-| `reason` | On many `not-measured` results, why. `not-applicable` and `not-compared` mean there was nothing to find. `needs-render` (rerun with `--cwv`), `could-not-verify`, `probe-failed`, `disabled`, `unsupported` and `rule-error` mean the check could not look, and a `fail_ci` gate treats them as unevaluated. |
+| `reason` | On many `not-measured` results, why. `not-applicable` and `not-compared` mean there was nothing to find. `needs-render` (rerun with `--cwv`), `needs-crawl` (rerun with `--crawl`), `could-not-verify`, `probe-failed`, `disabled`, `unsupported` and `rule-error` mean the check could not look, and a `fail_ci` gate treats them as unevaluated. |
 | `advisory` | `true` on results from advisory rules. They are reported but do not count toward the score, and a reading is counted in `advisoryCount`, not in `passCount`, `warnCount` or `failCount`. |
 | `overridden` | Set when `[rules.override]` names the rule: `{ "priority": … }`, `{ "failCi": true }` or both. It changes ranking and CI gating, never `status` or `score`. A result with `"priority": "ignore"` stays in the JSON; the other formats leave it out of their findings and name it under "Ignored by config" (`<ignored-by-config>` in the LLM report). |
 
```

**File**: `docs/ci-gates.md` (modified, +8/-1)
```diff
@@ -146,7 +146,13 @@ What counts:
   ```
 
   Add `--render` (and install the browser, see [the example job](#example-github-actions)),
-  or drop `fail_ci` for that rule.
+  or drop `fail_ci` for that rule. A check that compares pages (duplicates,
+  orphans, canonical chains, inbound links) needs `--crawl` the same way;
+  gated on a single-page run, it exits 1:
+
+  ```
+  Exit 1: fail_ci rule content-duplicate-exact was not measured (Duplicate content detection needs other pages to compare against - run with --crawl); fix what stopped it or drop fail_ci; score 88 passed fail-under 70
+  ```
 
 - A gated rule that the run would never execute is a config error, reported
   before the first request with exit 2. That covers a rule removed by
@@ -464,6 +470,7 @@ seo:
 |---|---|
 | Exit 1 while the score passed | Read the `Exit 1:` line, or `gate.reason` in JSON. It names the rule, custom search or coverage gate that failed. |
 | `fail_ci rule <id> was not measured (Needs a browser render: rerun with --render)` | Add `--render` and install Chromium on the runner, or drop `fail_ci` for that rule. |
+| `fail_ci rule <id> was not measured (... run with --crawl)` | The rule compares pages. Add `--crawl`, or drop `fail_ci` for that rule. |
 | Exit 2, `Invalid configuration ... so its gate can never run` | A `fail_ci` rule is removed by `[rules] enable`/`disable` or by `--categories`. Keep its category in the run, or drop the gate. |
 | Exit 2, `unknown rule id "..."` | The id in `[rules.override]` is not a rule. Use the id the "Did you mean" names, or `seomator explain --list`. |
 | `Exit 1: measured 4 of 5 pages; min-coverage 90` | The site rate-limited or dropped pages. Space requests out with the `crawler.per_host_delay_ms` value the warning suggests, lower `--concurrency`, or lower the gate. |
```

**File**: `docs/technical-architecture.md` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ The desktop app renders pages in an Electron `BrowserWindow` (`electron/main/ele
 
 **Running the rules.** Each receives the page's `AuditContext`. Categories run in order; the rules of one category run together, since rules read the context and never write it, and their results keep the rules' order. The auditor adds the rule's weight and the page URL to each result. A rule that throws becomes a `not-measured` result with reason `rule-error`: it took no reading, so it stays visible in every report without marking the site down for a bug in SEOmator. A category whose rules are all filtered out by `[rules]` is dropped from the result rather than scored 0, so a narrower audit is not reported as a disastrous one.
 
-**The exit code is a set of gates.** `evaluateGate()` in `src/gate.ts` reads per-page results, never an aggregate, so a `fail_ci` rule that fails on one page of fifty fails the run at any score. A gated rule that could not take a reading on some page (it needed a render, a resource could not be verified, the check crashed) also exits 1, because a gate that cannot run must not pass silently; a page with nothing to find (`not-applicable`, `not-compared`) satisfies it. A `fail_ci` rule that `[rules]` or `--categories` leaves out could never run, so `findFilteredGates()` reports it as a config error before the first request, and the run exits 2. The verdict travels on the result as `gate`, so every format carries it, and a run that exits 1 names every reason on its last stderr line. Overrides re-rank findings; they never change the score. [CI gates](./ci-gates.md) shows how to use them in a pipeline.
+**The exit code is a set of gates.** `evaluateGate()` in `src/gate.ts` reads per-page results, never an aggregate, so a `fail_ci` rule that fails on one page of fifty fails the run at any score. A gated rule that could not take a reading on some page (it needed a render or a crawl, a resource could not be verified, the check crashed) also exits 1, because a gate that cannot run must not pass silently; a page with nothing to find (`not-applicable`, `not-compared`) satisfies it. A `fail_ci` rule that `[rules]` or `--categories` leaves out could never run, so `findFilteredGates()` reports it as a config error before the first request, and the run exits 2. The verdict travels on the result as `gate`, so every format carries it, and a run that exits 1 names every reason on its last stderr line. Overrides re-rank findings; they never change the score. [CI gates](./ci-gates.md) shows how to use them in a pipeline.
 
 ## The network guard
 
```

**File**: `src/reporters/terminal.ts` (modified, +9/-5)
```diff
@@ -526,14 +526,18 @@ export function renderTerminalReport(unsafeResult: AuditResult): void {
     console.log();
   }
 
-  // Checks that only a browser render can answer, counted once per rule
-  const needsRender = new Set(
-    result.categoryResults.flatMap((c) => c.results).filter((r) => r.reason === 'needs-render').map((r) => r.ruleId)
-  ).size;
+  // Checks that only a browser render, or a crawl, can answer, counted once per rule
+  const needing = (reason: string) =>
+    new Set(result.categoryResults.flatMap((c) => c.results).filter((r) => r.reason === reason).map((r) => r.ruleId)).size;
+  const needsRender = needing('needs-render');
+  const needsCrawl = needing('needs-crawl');
   if (needsRender > 0) {
     console.log(chalk.gray(`${needsRender} check${needsRender === 1 ? '' : 's'} need a browser render: rerun with --render`));
-    console.log();
   }
+  if (needsCrawl > 0) {
+    console.log(chalk.gray(`${needsCrawl} check${needsCrawl === 1 ? '' : 's'} need a crawl: rerun with --crawl`));
+  }
+  if (needsRender + needsCrawl > 0) console.log();
 
   // Summary footer. Carries the not-measured count too: without it the closing
   // line read "217 passed • 34 warnings • 24 failed" for a 332-rule audit, and
```

**File**: `src/rules/a11y/color-contrast.ts` (modified, +3/-1)
```diff
@@ -43,7 +43,9 @@ export const colorContrastRule = defineRule({
     if (examined === 0) {
       return notMeasured(
         'a11y-color-contrast',
-        'No inline colours to check; contrast set in stylesheets needs a rendered check'
+        'No inline colours to check; contrast set in stylesheets needs a rendered check',
+        undefined,
+        'needs-render'
       );
     }
 
```

**File**: `src/rules/content/duplicate-description.ts` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ export const duplicateDescriptionRule = defineRule({
         'content-duplicate-description',
         'Description uniqueness needs other pages to compare against - run with --crawl',
         undefined,
-        'not-applicable'
+        'needs-crawl'
       );
     }
 
```

---

### Incident Patch 3: `59ff8c53` (2026-11-19)
**Commit Message**: fix(rules): rewrite rule text in original wording

Rewrite 42 rule descriptions, the fix and impact messages around them,
and the intro, examples, flag table and troubleshooting sections of
SKILL.md. This text matched another audit tool's public docs and agent
skill, taken in January 2026. A re-scan of the tree finds no rule
description identical to theirs and no 8-word run shared with their
skill.

Rule IDs, checks and scoring are unchanged; only the wording differs.
The non-http(s) URL error in `seomator mcp` and the dashboard now reads
"Cannot audit a <scheme> URL: only http and https are supported".

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -7,6 +7,17 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Changed
+
+- **Rule text is now written in our own words throughout.** 42 rule
+  descriptions, a set of fix and impact messages, and the opening, examples
+  and troubleshooting sections of `SKILL.md` had matched wording from another
+  audit tool's public docs and agent skill, taken in January 2026. All of it
+  is rewritten, and a re-scan finds no shared sentence left. Rule IDs, checks and
+  scoring are unchanged; only the wording you read differs.
+- The error for a non-http(s) URL in `seomator mcp` and the dashboard now
+  reads "Cannot audit a file: URL: only http and https are supported".
+
 ## [8.0.0] - 2026-11-19
 
 Upgrading from 7.x: see [docs/upgrading-to-8.md](docs/upgrading-to-8.md) for
```

**File**: `README.md` (modified, +3/-3)
```diff
@@ -157,7 +157,7 @@ seomator audit https://example.com --format json
 seomator audit https://example.com --format html -o report.html
 
 # LLM-optimized output (pipe to Claude)
-seomator audit https://example.com --format llm | claude "analyze and prioritize fixes"
+seomator audit https://example.com --format llm | claude "rank these issues by impact and fix the top ones"
 
 # Crawl multiple pages
 seomator audit https://example.com --crawl --max-pages 20
@@ -612,7 +612,7 @@ the launch checklist.
 | `schema-faq` | Validates FAQPage schema structure |
 | `schema-local-business` | Validates LocalBusiness for local SEO |
 | `schema-organization` | Validates Organization schema |
-| `schema-product` | Validates Product schema for e-commerce |
+| `schema-product` | Checks Product markup for shopping rich results |
 | `schema-review` | Validates Review/AggregateRating schema |
 | `schema-video` | Validates VideoObject schema |
 | `schema-website-search` | Checks WebSite sitelinks searchbox |
@@ -885,7 +885,7 @@ Create a `seomator.toml` config file with `seomator init`:
 
 ```toml
 [project]
-name = "my-website"
+name = "marketing-site"
 domains = ["example.com", "www.example.com"]
 
 [crawler]
```

**File**: `SKILL.md` (modified, +31/-40)
```diff
@@ -1,6 +1,6 @@
 ---
 name: seo-audit
-description: Audit websites for SEO, technical, content, security, JS rendering, and AI readiness using SEOmator CLI. Returns LLM-optimized reports with health scores across 398 rules and 20 categories, and can diff two audits to show what a deploy changed. Use when analyzing websites, debugging SEO issues, checking site health, or comparing a site before and after a change.
+description: Run the SEOmator CLI on a site and score it against 398 rules across 20 categories (SEO, technical, content, security, JS rendering, AI readiness), with reports an LLM can act on. It can also diff two audits to show what a deploy changed. Reach for it to find out why a site underperforms in search, to review a site's health, or to check a release before and after.
 license: MIT
 compatibility: Requires Node.js 20.18.1+ and npm. Chrome/Chromium optional for Core Web Vitals and JS rendering.
 metadata:
@@ -11,21 +11,17 @@ allowed-tools: Bash(seomator:*)
 
 # SEO Audit Skill
 
-Audit websites for SEO, technical, content, performance, security, JavaScript rendering, and AI readiness using the SEOmator CLI.
-
-SEOmator provides comprehensive website auditing by analyzing website structure and content against **398 rules** across **20 categories**.
-
-It provides a list of issues with severity levels, affected URLs, and actionable fix suggestions.
+SEOmator is a command-line auditor. Point it at a URL and it fetches the page (or crawls the site), checks it against **398 rules** across **20 categories**, and prints every problem it finds with a severity, the URLs involved, and a fix.
 
 ## Links
 
 * SEOmator npm package: [npmjs.com/package/@seomator/seo-audit](https://www.npmjs.com/package/@seomator/seo-audit)
 * GitHub repository: [github.com/seo-skills/seo-audit-skill](https://github.com/seo-skills/seo-audit-skill)
 * Web UI: [seomator.com/free-seo-audit-tool](https://seomator.com/free-seo-audit-tool)
 
-## What This Skill Does
+## Coverage
 
-This skill enables AI agents to audit websites for **398 rules** in **20 categories**, including:
+The CLI runs **398 rules** in **20 categories**:
 
 - **Core SEO** (27 rules): Canonical URLs, indexing directives, title uniqueness, canonical conflicts/loops
 - **Performance** (30 rules): LCP, CLS, FCP, TTFB, INP, compression, caching, minification, HTTP/2
@@ -48,16 +44,16 @@ This skill enables AI agents to audit websites for **398 rules** in **20 categor
 - **AI/GEO Readiness** (13 rules): Semantic HTML, AI bot access, llms.txt, schema drift
 - **Legal Compliance** (1 rule): Cookie consent
 
-The audit crawls the website, analyzes each page against audit rules, and returns a comprehensive report with:
-- Overall health score (0-100) with letter grade (A-F)
-- Category breakdowns with pass/warn/fail counts
-- Specific issues with affected URLs grouped by rule
-- Actionable fix recommendations
+A report contains:
+- A score out of 100 and a letter grade (A-F) for the whole site
+- Pass, warn and fail counts for each category
+- Every issue, grouped by rule, with the URLs it affects
+- A concrete fix for each issue
 
-## When to Use
+## Typical Requests
 
-Use this skill when you need to:
-- Analyze a website's SEO health
+Load this skill for requests such as:
+- A general SEO health check of a site
 - Debug technical SEO issues
 - Check for broken links and redirect chains
 - Validate meta tags, canonical URLs, and structured data
@@ -139,13 +135,12 @@ When auditing:
 
 ### Website Discovery
 
-If the user doesn't provide a website to audit:
-1. Check for local dev server configurations (package.json scripts, .env files)
-2. Look for Vercel/Netlify project links
-3. Check environment variables for deployment URLs
-4. Ask the user which URL to audit
+No URL in the request? Work one out before asking:
+1. Read the project for a deployed address: `package.json` homepage, `.env` files, hosting config
+2. Read the project for a dev server: the `dev` or `start` script and its port
+3. Only then ask which URL to audit
 
-If you have both local and live websites available, **suggest auditing the live site** for accurate results.
+When both a deployed site and a local dev server exist, **prefer the deployed site**: only there do real headers, redirects, CDN caching and TLS show up.
 
 ### Basic Workflow
 
@@ -231,9 +226,9 @@ refused), `playwright-missing`, `no-pages`, `config`, `aborted` or `unknown`.
 
 ## Command Reference
 
-### Audit Command Options
+### `audit` Flags
 
-| Option | Alias | Description | Default |
+| Flag | Short | What it does | Default |
 |--------|-------|-------------|---------|
 | `--format <fmt>` | `-f` | Output format: console, json, html, markdown, llm | console |
 | `--max-pages <n>` | `-m` | Maximum pages to crawl | 10 |
@@ -314,24 +309,24 @@ The `--format llm` output is a compact XML format optimized for token efficiency
 
 ## Examples
 
-### Example 1: Quick Audit with LLM Output
+### Example 1: One page, report for the agent
 
```

**File**: `docs/SEO-AUDIT-RULES.md` (modified, +10/-10)
```diff
@@ -509,16 +509,16 @@ Validates HTTPS, security headers, mixed content, SSL, and leaked secrets.
 | `security-x-frame-options` | X-Frame-Options | 5 | warn/fail | Checks X-Frame-Options header |
 | `security-x-content-type-options` | X-Content-Type-Options | 4 | fail | Checks X-Content-Type-Options: nosniff |
 | `security-external-links` | External Link Security | 3 | warn | Checks target="_blank" has noopener/noreferrer |
-| `security-form-https` | Form HTTPS | 5 | warn/fail | Checks form actions use HTTPS |
-| `security-mixed-content` | Mixed Content | 8 | warn/fail | Checks for HTTP resources on HTTPS pages |
+| `security-form-https` | Form HTTPS | 5 | warn/fail | Flags forms that submit to an insecure http:// URL |
+| `security-mixed-content` | Mixed Content | 8 | warn/fail | Flags http:// subresources loaded by an HTTPS page |
 | `security-permissions-policy` | Permissions-Policy | 2 | warn | Checks for Permissions-Policy header |
-| `security-referrer-policy` | Referrer-Policy | 2 | warn | Checks for Referrer-Policy header |
+| `security-referrer-policy` | Referrer-Policy | 2 | warn | Checks that a Referrer-Policy is set by header or meta tag |
 | `security-coop` | Cross-Origin-Opener-Policy | 3 | warn | Isolates the page from windows that open it |
 | `security-csp-xss` | CSP Strength Against XSS | 6 | warn/fail | Grades whether the CSP actually constrains script execution |
 | `security-info-disclosure` | Software Version Disclosure | 3 | warn | Headers do not advertise server software and version |
 | `security-paste-blocking` | Inputs Allow Pasting | 2 | fail | Input fields do not prevent pasting |
 | `security-trusted-types` | Trusted Types | 2 | warn | CSP requires Trusted Types for DOM XSS sinks |
-| `security-leaked-secrets` | Leaked Secrets | 10 | fail | Detects exposed API keys, credentials in HTML/JS |
+| `security-leaked-secrets` | Leaked Secrets | 10 | fail | Scans HTML and inline scripts for API keys, tokens and passwords left in public view |
 | `security-password-http` | Password Input on HTTP | 10 | fail | Detects password fields on non-HTTPS pages |
 | `security-protocol-relative` | Protocol-Relative URLs | 6 | warn | Detects `//example.com` URLs |
 | `security-cookie-flags` | Cookie Security Flags | 10 | warn/fail | Checks Set-Cookie for Secure, HttpOnly and SameSite |
@@ -731,7 +731,7 @@ The cross-page rules (`crawl-sitemap-orphan-urls`, `crawl-pagination-isolated`,
 
 #### crawl-indexability-conflict
 - **What it checks:** The page against Googlebot's group in robots.txt (the `*` group when no group names Googlebot). A disallowed page warns either way: with noindex, Googlebot never fetches the page to read the directive; without it, the URL can still be indexed from links. Noindex comes from the `robots` or `googlebot` meta tag or the X-Robots-Tag header. Passes when no robots.txt can be read
-- **Fix:** To keep a page out of the index, allow it in robots.txt and add noindex. A Disallow on its own still warns.
+- **Fix:** To keep a page out of the index, let crawlers fetch it and serve noindex; a robots.txt Disallow by itself still warns.
 
 #### crawl-canonical-redirect
 - **Fix:** Update canonical to point directly to the final destination URL. Avoid redirect chains.
@@ -934,7 +934,7 @@ Analyzes text quality, readability, headings, and duplicate content.
 - **Fix:** Use shorter sentences, simpler vocabulary, bullet points.
 
 #### content-keyword-stuffing
-- **Fix:** Write naturally for users. Use synonyms and related terms instead of repeating keywords.
+- **Fix:** Write for the reader and vary the wording rather than repeating one keyword.
 
 #### content-heading-hierarchy
 - **Valid:** H1 -> H2 -> H3. **Invalid:** H1 -> H3 (skips H2).
@@ -1071,7 +1071,7 @@ Checks for WCAG compliance, screen reader support, and keyboard navigation.
 |---------|------|-------:|----------|-------------|
 | `a11y-aria-labels` | ARIA Labels | 10 | warn/fail | Interactive elements have accessible names |
 | `a11y-color-contrast` | Color Contrast | 8 | warn/fail | With `--cwv`, axe-core's measured contrast (serious violations fail). Without, a heuristic check of inline-style colours that warns; not measured when no element has an inline colour |
-| `a11y-focus-visible` | Focus Visible | 8 | warn/fail | Checks for focus indicator styles |
+| `a11y-focus-visible` | Focus Visible | 8 | warn/fail | Flags CSS that removes or hides the keyboard focus outline |
 | `a11y-form-labels` | Form Labels | 10 | warn/fail | Form inputs have associated labels |
 | `a11y-heading-order` | Heading Order | 8 | warn/fail | Heading levels don't skip |
 | `a11y-landmark-regions` | Landmark Regions | 6 | warn | Page has main, nav, header and footer landmarks; several `<main>` elements or unlabelled `<nav>`s also warn |
@@ -1158,7 +1158,7 @@ Checks for WCAG compliance, screen reader support, and keyboard navigation.
 - **Fix:** Add `<track kind="captions">` to video elements or provide a transcript link nearby.
 
 #### a11y-
```

**File**: `docs/quickstart.md` (modified, +3/-3)
```diff
@@ -106,13 +106,13 @@ Auditing: example.com
 
 ──────────────────────────────────────────────────
 SEOMATOR REPORT
-example.com • 1 page • 87/100 (B)
+example.com • 1 page • 84/100 (B)
 ──────────────────────────────────────────────────
 
-Health Score: 87/100 (B)
+Health Score: 84/100 (B)
 ```
 
-That is your first result: example.com scores 87 out of 100, a B. Your numbers
+That is your first result: example.com scores 84 out of 100, a B. Your numbers
 may differ, because some checks time the page on every run and the page itself
 can change.
 
```

**File**: `skill/SKILL.md` (modified, +31/-40)
```diff
@@ -1,6 +1,6 @@
 ---
 name: seo-audit
-description: Audit websites for SEO, technical, content, security, JS rendering, and AI readiness using SEOmator CLI. Returns LLM-optimized reports with health scores across 398 rules and 20 categories, and can diff two audits to show what a deploy changed. Use when analyzing websites, debugging SEO issues, checking site health, or comparing a site before and after a change.
+description: Run the SEOmator CLI on a site and score it against 398 rules across 20 categories (SEO, technical, content, security, JS rendering, AI readiness), with reports an LLM can act on. It can also diff two audits to show what a deploy changed. Reach for it to find out why a site underperforms in search, to review a site's health, or to check a release before and after.
 license: MIT
 compatibility: Requires Node.js 20.18.1+ and npm. Chrome/Chromium optional for Core Web Vitals and JS rendering.
 metadata:
@@ -11,21 +11,17 @@ allowed-tools: Bash(seomator:*)
 
 # SEO Audit Skill
 
-Audit websites for SEO, technical, content, performance, security, JavaScript rendering, and AI readiness using the SEOmator CLI.
-
-SEOmator provides comprehensive website auditing by analyzing website structure and content against **398 rules** across **20 categories**.
-
-It provides a list of issues with severity levels, affected URLs, and actionable fix suggestions.
+SEOmator is a command-line auditor. Point it at a URL and it fetches the page (or crawls the site), checks it against **398 rules** across **20 categories**, and prints every problem it finds with a severity, the URLs involved, and a fix.
 
 ## Links
 
 * SEOmator npm package: [npmjs.com/package/@seomator/seo-audit](https://www.npmjs.com/package/@seomator/seo-audit)
 * GitHub repository: [github.com/seo-skills/seo-audit-skill](https://github.com/seo-skills/seo-audit-skill)
 * Web UI: [seomator.com/free-seo-audit-tool](https://seomator.com/free-seo-audit-tool)
 
-## What This Skill Does
+## Coverage
 
-This skill enables AI agents to audit websites for **398 rules** in **20 categories**, including:
+The CLI runs **398 rules** in **20 categories**:
 
 - **Core SEO** (27 rules): Canonical URLs, indexing directives, title uniqueness, canonical conflicts/loops
 - **Performance** (30 rules): LCP, CLS, FCP, TTFB, INP, compression, caching, minification, HTTP/2
@@ -48,16 +44,16 @@ This skill enables AI agents to audit websites for **398 rules** in **20 categor
 - **AI/GEO Readiness** (13 rules): Semantic HTML, AI bot access, llms.txt, schema drift
 - **Legal Compliance** (1 rule): Cookie consent
 
-The audit crawls the website, analyzes each page against audit rules, and returns a comprehensive report with:
-- Overall health score (0-100) with letter grade (A-F)
-- Category breakdowns with pass/warn/fail counts
-- Specific issues with affected URLs grouped by rule
-- Actionable fix recommendations
+A report contains:
+- A score out of 100 and a letter grade (A-F) for the whole site
+- Pass, warn and fail counts for each category
+- Every issue, grouped by rule, with the URLs it affects
+- A concrete fix for each issue
 
-## When to Use
+## Typical Requests
 
-Use this skill when you need to:
-- Analyze a website's SEO health
+Load this skill for requests such as:
+- A general SEO health check of a site
 - Debug technical SEO issues
 - Check for broken links and redirect chains
 - Validate meta tags, canonical URLs, and structured data
@@ -139,13 +135,12 @@ When auditing:
 
 ### Website Discovery
 
-If the user doesn't provide a website to audit:
-1. Check for local dev server configurations (package.json scripts, .env files)
-2. Look for Vercel/Netlify project links
-3. Check environment variables for deployment URLs
-4. Ask the user which URL to audit
+No URL in the request? Work one out before asking:
+1. Read the project for a deployed address: `package.json` homepage, `.env` files, hosting config
+2. Read the project for a dev server: the `dev` or `start` script and its port
+3. Only then ask which URL to audit
 
-If you have both local and live websites available, **suggest auditing the live site** for accurate results.
+When both a deployed site and a local dev server exist, **prefer the deployed site**: only there do real headers, redirects, CDN caching and TLS show up.
 
 ### Basic Workflow
 
@@ -231,9 +226,9 @@ refused), `playwright-missing`, `no-pages`, `config`, `aborted` or `unknown`.
 
 ## Command Reference
 
-### Audit Command Options
+### `audit` Flags
 
-| Option | Alias | Description | Default |
+| Flag | Short | What it does | Default |
 |--------|-------|-------------|---------|
 | `--format <fmt>` | `-f` | Output format: console, json, html, markdown, llm | console |
 | `--max-pages <n>` | `-m` | Maximum pages to crawl | 10 |
@@ -314,24 +309,24 @@ The `--format llm` output is a compact XML format optimized for token efficiency
 
 ## Examples
 
-### Example 1: Quick Audit with LLM Output
+### Example 1: One page, report for the agent
 
```

**File**: `src/dashboard/audit-session.ts` (modified, +1/-1)
```diff
@@ -249,7 +249,7 @@ export function normalizeRunArgs(args: AuditRunArgs, capabilities: Capabilities)
     throw new Error(`Not a valid URL: ${args.url}`);
   }
   if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
-    throw new Error(`Only http and https URLs can be audited, got ${parsed.protocol}`);
+    throw new Error(`Cannot audit a ${parsed.protocol} URL: only http and https are supported`);
   }
 
   const known = new Set(categoryDefinitions.map((c) => c.id));
```

**File**: `src/mcp/server.ts` (modified, +1/-1)
```diff
@@ -278,7 +278,7 @@ export function createMcpServer(options: McpServerOptions): McpServer {
           return failure({ code: 'usage', message: `Not a valid URL: ${url}`, hint: 'Pass an absolute http(s) URL.' });
         }
         if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
-          return failure({ code: 'usage', message: `Only http and https URLs can be audited, got ${parsed.protocol}` });
+          return failure({ code: 'usage', message: `Cannot audit a ${parsed.protocol} URL: only http and https are supported` });
         }
 
         if (render && !options.allowPrivate) {
```

#### Recent Merged Pull Requests:
- **PR #16** (2026-11-19): fix: resolve dashboard and fix queue QA findings (@aeelbeyoglu)
- **PR #15** (2026-11-18): v8.0.0 Audits you can gate CI and agents on: polite crawls, real broken-link checks, internal link strength and your own checks, in the new SEOmator look (@aeelbeyoglu)
- **PR #13** (2026-09-04): chore(release): 4.0.0 (@aeelbeyoglu)
- **PR #12** (2026-09-04): docs: document the dashboard in CLAUDE.md, correct where ui/ lives (@aeelbeyoglu)
- **PR #11** (2026-09-04): Release 2: the visual pass, and six defects it uncovered (@aeelbeyoglu)
- **PR #10** (2026-09-04): Release 1: one verdict, one ordering (@aeelbeyoglu)

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

## X. design): the report opens on its score, then goes straight to the fix queue

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in seo-skills/seo-audit-skill. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e8cc2473`: design): the report opens on its score, then goes straight to the fix queue. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- **The report opens on its score, then goes straight to what to fix.** In
  the dashboard, the desktop app and the HTML report, the score leads and one
  fix queue follows from 01, with no fix featured above the rest. Each fix is
  agent introduces the queue with one sentence the numbers support ("The
  first five return 2.4 of the 8.8 points this page is missing"); while a
  score cap holds, the score names it and the fix that lifts it.
  while a run is live (the only animation that loops), focused over the fix
  queue, and reacting once when a run hands over to its report. Reduced motion
  number at the top, with what it is missing, what it did not count, and what
  changed since the last run beside it. Export formats sit in one menu and
  on a click anywhere, and the report shows its own shape while it loads.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
- **The report opens on what to fix first.** In the dashboard, the desktop app
  and the HTML report, the largest thing on an audit is now the first fix,
  agent sits over it with one sentence the numbers support ("The first five
  fixes return 2.4 of the 8.8 points this page is missing").
  while a run is live (the only animation that loops), focused on the lead
  fix, and reacting once when a run hands over to its report. Reduced motion
  number beside the lead fix, with what it is missing, what it did not count,
  and what changed since the last run. Export formats sit in one menu and
  on a click anywhere, "Show evidence" opens under the lead fix instead of
  jumping to the end of the page, and the report shows its own shape while it
  loads.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e8cc2473` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
