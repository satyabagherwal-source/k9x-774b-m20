# Forensic Learning Record (Deep Inspection): Manavarya09/design-extract

> **Canonical Artifact**: `07_PROJECT_LEARNING/manavarya09-design-extract-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Manavarya09/design-extract](https://github.com/Manavarya09/design-extract))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:30:29.169Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Manavarya09/design-extract`
- **Description**: Extract any website's complete design system with one command. DTCG tokens, semantic+primitive+composite, MCP server for Claude Code/Cursor/Windsurf, multi-platform emitters (iOS SwiftUI, Android Compose, Flutter, WordPress), Tailwind v4, Figma variables, shadcn/ui, CSS health audit, WCAG remediation, Chrome extension. MIT, Playwright, Node 20+.
- **Primary Language / Ecosystem**: HTML
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4150 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bench/evidence.mjs`
```
#!/usr/bin/env node
// Evidence for bench/sites.json that doesn't lean on either extractor's
// heuristics: the family that actually renders body copy (the first family in
// its font stack with a loaded font file), and how close the page's painted
// colours come to each claimed brand colour.
//
//   node bench/evidence.mjs stripe.com=#533afd linear.app=#5e6ad2,#e4f222

import { launchChromium } from '../src/browser.js';
import { toHex, deltaE } from './score.js';

function inPage() {
  const body = document.querySelector('main p, article p, p') || document.body;
  const stack = getComputedStyle(body).fontFamily.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''));
  const loaded = new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/^["']|["']$/g, '')));
  const rendered = stack.find((f) => loaded.has(f)) || null;

  const painted = {};
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const add = (value, weight) => {
      if (!value || value === 'transparent' || value.startsWith('rgba(0, 0, 0, 0)')) return;
      painted[value] = (painted[value] || 0) + weight;
    };
    add(cs.backgroundColor, r.width * r.height);
    add(cs.color, 100);
    add(cs.borderTopColor, cs.borderTopWidth !== '0px' ? r.width : 0);
  }
  return { bodyFontStack: stack, bodyFontRendered: rendered, painted };
}

const targets = process.argv.slice(2).map((a) => {
  const [site, claims = ''] = a.split('=');
  return { site, claims: claims.split(',').filter(Boolean) };
});

const browser = await launchChromium({ headless: true });
try {
  for (const { site, claims } of targets) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.goto(`https://${site}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      const { bodyFontStack, bodyFontRendered, painted } = await page.evaluate(inPage);
      const colors = Object.entries(painted)
        .map(([value, weight]) => ({ hex: toHex(value), weight }))
        .filter((c) => c.hex);
      const closest = claims.map((claim) => {
        const best = colors
          .map((c) => ({ hex: c.hex, deltaE: +deltaE(toHex(claim), c.hex).toFixed(1), weight: Math.round(c.weight) }))
          .sort((a, b) => a.deltaE - b.deltaE)[0];
        return { claim, closest: best || null };
      });
      console.log(JSON.stringify({ site, bodyFontRendered, bodyFontStack: bodyFontStack.slice(0, 4), claims: closest }));
    } catch (err) {
      console.log(JSON.stringify({ site, error: err.message.split('\n')[0] }));
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

```

### Core Architecture Module: `bench/run.mjs`
```
#!/usr/bin/env node
// Head-to-head extraction benchmark: designlang (this checkout) vs a pinned
// dembrandt, on a fixed site list with hand-checked ground truth.
//
//   node bench/run.mjs [--sites bench/sites.json] [--only stripe.com,linear.app]
//
// Fairness: both tools run with their default settings, one at a time on the
// same machine, alternating which goes first per site. Every result is written
// to bench/results/<date>.{json,md}, losses included.

import { spawn, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { basename, dirname, join, resolve } from 'path';
import { scoreSite, summarize, readDesignlang, readDembrandt, COLOR_TOLERANCE } from './score.js';

const DEMBRANDT_VERSION = '0.33.0';
const TIMEOUT_MS = Number(process.env.BENCH_TIMEOUT_MS) || 180_000;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

// Runs in a throwaway directory so neither tool writes into the repo. macOS has
// no `timeout`, so the kill timer lives here.
function runTool(cmd, args) {
  return new Promise((done) => {
    const cwd = mkdtempSync(join(tmpdir(), 'designlang-bench-'));
    const started = Date.now();
    // detached: the tool gets its own process group, so the timeout can kill
    // it. Playwright starts Chromium in a group of its own, though, and a live
    // browser kept a "180s" run going to 363s (3029s once, through npx). So:
    // each run gets its own TMPDIR, which is where the browser profile lands,
    // the timeout also kills anything whose command line names that directory,
    // and the result is recorded without waiting for the pipes to close.
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, TMPDIR: cwd },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      // Time the run, not the cleanup: removing a browser profile can take seconds.
      const seconds = (Date.now() - started) / 1000;
      clearTimeout(timer);
      rmSync(cwd, { recursive: true, force: true });
      done({ ...result, stdout, stderr, seconds });
    };
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
      spawnSync('pkill', ['-KILL', '-f', cwd]);
      finish({ code: null, signal: 'SIGKILL', timedOut: true });
    }, TIMEOUT_MS);
    child.on('close', (code, signal) => finish({ code, signal, timedOut: false }));
  });
}

// A dropped connection says nothing about either tool, so a run that fails
// with a network-level error is retried once, for both tools alike.
const NETWORK_ERROR_RE = /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_RESET/;
async function extractOnce(tool, site) {
  const first = await tool.extract(site);
  if (first.code === 0 || first.timedOut || !NETWORK_ERROR_RE.test(first.stdout + first.stderr)) return first;
  return { ...(await tool.extract(site)), retried: true };
}

function parseJson(stdout) {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  return JSON.parse(stdout.slice(start, end + 1));
}

const TOOLS = {
  designlang: {
    version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')).version,
    extract: (site) => runTool(process.execPath, [join(root, 'bin/design-extract.js'), `https://${site}`, '--json', '--no-history']),
    read: readDesignlang,
  },
  dembrandt: {
    version: DEMBRANDT_VERSION,
    extract: (site) => runTool('npx', ['-y', `dembrandt@${DEMBRANDT_VERSION}`, site, '--json-only']),
    read: readDembrandt,
  },
};

const sitesFile = resolve(arg('sites', join(root, 'bench/sites.json')));
const set = basename(sitesFile, '.json');
const only = arg('only')?.split(',');
const truths = JSON.parse(readFileSync(sitesFile, 'utf-8')).sites.filter((s) => !only || only.includes(s.site));

console.log(`designlang ${TOOLS.designlang.version} vs dembrandt ${DEMBRANDT_VERSION} on ${truths.length} sites\n`);
await runTool('npx', ['-y', `dembrandt@${DEMBRANDT_VERSION}`, 'install-browser']);

const rows = { designlang: [], dembrandt: [] };
for (const [i, truth] of truths.entries()) {
  const order = i % 2 ? ['dembrandt', 'designlang'] : ['designlang', 'dembrandt'];
  for (const name of order) {
    const r = await extractOnce(TOOLS[name], truth.site);
    let predicted = null;
    try { predicted = TOOLS[name].read(parseJson(r.stdout)); } catch { /* recorded as a failure */ }
    const ok = r.code === 0 && predicted != null;
    const row = {
      site: truth.site,
      ok,
      seconds: +r.seconds.toFixed(1),
      predicted,
      score: scoreSite(truth, ok ? predicted : null),
    };
    if (r.retried) row.retried = true;
    if (!ok) {
      const why = r.timedOut ? `timed out after ${TIMEOUT_MS / 1000}s` : r.signal ? `killed (${r.signal})` : `exit ${r.code}`;
      row.error = `${why}: ${(r.stderr.trim().split('\n').pop() || '').slice(0, 160)}`;
    }
    rows[name].push(row);
    const mark = (hit) => (hit === null ? '–' : hit ? '✓' : '✗');
    console.log(`${truth.site.padEnd(24)} ${name.padEnd(10)} ${ok ? `colour ${mark(row.score.color)} font ${mark(row.score.font)}` : row.error} ${row.seconds}s`);
  }
}

const summary = Object.fromEntries(Object.entries(rows).map(([name, r]) => [name, summarize(r)]));
const date = new Date().toISOString().slice(0, 10);
const report = {
  date,
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  tools: { designlang: TOOLS.designlang.version, dembrandt: DEMBRANDT_VERSION },
  colorTolerance: COLOR_TOLERANCE,
  summary,
  sites: truths.map((truth, i) => ({ ...truth, designlang: rows.designlang[i], dembrandt: rows.dembrandt[i] })),
};

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const ratio = (hits, total) => `${hits}/${total} (${pct(hits, total)})`;
const cell = (row, key) => {
  if (row.score[key] === null) return 'n/a';
  if (!row.ok) return '❌ failed';
  return `${row.score[key] ? '✅' : '❌'} ${row.predicted[key === 'color' ? 'primary' : 'font'] ?? '—'}`;
};
const truthText = (s) => `${s.primary?.length ? s.primary.join(' / ') : 'n/a'} · ${s.font?.length ? s.font.join(' / ') : 'n/a'}`;
const md = [
  `# Extraction benchmark — ${date}`,
  '',
  `designlang ${TOOLS.designlang.version} vs dembrandt ${DEMBRANDT_VERSION}, default settings, ${truths.length} sites, ${report.platform}, Node ${process.version}.`,
  `A colour counts when it is within ΔE ${COLOR_TOLERANCE} (CIE76) of the site's brand colour; a font counts when it names the body-text family.`,
  `Each run is capped at ${TIMEOUT_MS / 1000}s. A run that failed with a network-level error was retried once, for either tool (${[...rows.designlang, ...rows.dembrandt].filter((r) => r.retried).length} retries).`,
  '',
  '| | designlang | dembrandt |',
  '|---|---|---|',
  `| Primary colour correct | ${ratio(summary.designlang.colorHits, summary.designlang.colorSites)} | ${ratio(summary.dembrandt.colorHits, summary.dembrandt.colorSites)} |`,
  `| Body font correct | ${ratio(summary.designlang.fontHits, summary.designlang.fontSites)} | ${ratio(summary.dembrandt.fontHits, summary.dembrandt.fontSites)} |`,
  `| Failed runs | ${summary.designlang.failures} | ${summary.dembrandt.failures} |`,
  `| Median time | ${summary.designlang.medianSeconds?.toFixed(1) ?? '—'}s | ${summary.dembrandt.medianSeconds?.toFixed(1) ?? '—'}s |`,
  '',
  '| Site | Truth | designlang colour | dembrandt colour | designlang font | dembrandt font |',
  '|---|---|---|---|---|---|',
  
```

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

### Core Architecture Module: `bin/design-extract.js`
```
#!/usr/bin/env node

import { Command } from 'commander';
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_VERSION = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8')).version;
import chalk from 'chalk';
import ora from 'ora';
import { extractDesignLanguage } from '../src/index.js';
import { refineWithSmart } from '../src/classifiers/smart.js';
import { crawlCanonicalPages } from '../src/multipage.js';
import { crawlSite } from '../src/site.js';
import { formatSiteCoverage, formatSiteConsistency } from '../src/formatters/site-system.js';
import { extractLogo } from '../src/extractors/logo.js';
import { captureComponentScreenshotsV10 } from '../src/extractors/component-screenshots.js';
import { pairDarkMode } from '../src/extractors/dark-mode-pair.js';
import { deriveBrandEssence } from '../src/extractors/brand-essence.js';
import { captureResponsiveScreenshots } from '../src/extractors/responsive-screenshots.js';
import { captureCoreWebVitals, extractFontLoading } from '../src/extractors/perf.js';
import { buildPromptPack } from '../src/formatters/prompt-pack.js';
import { formatMarkdown } from '../src/formatters/markdown.js';
import { formatTokens } from '../src/formatters/tokens.js';
import { formatDtcgTokens } from '../src/formatters/dtcg-tokens.js';
import { formatTailwind } from '../src/formatters/tailwind.js';
import { formatTailwindV4 } from '../src/formatters/tailwind-v4.js';
import { formatTsDefs } from '../src/formatters/ts-defs.js';
import { formatCssReset } from '../src/formatters/css-reset.js';
import { formatGradientsCss, formatGradientsJson } from '../src/formatters/gradients.js';
import { formatAgentPrompt } from '../src/formatters/agent-prompt.js';
import { formatMotionLab } from '../src/formatters/motion-lab.js';
import { formatFramerMotion } from '../src/formatters/framer-motion.js';
import { formatMotionOne } from '../src/formatters/motion-one.js';
import { formatMotionCss } from '../src/formatters/motion-css.js';
import { formatMotionTailwind } from '../src/formatters/motion-tailwind.js';
import { formatMotionGsap } from '../src/formatters/motion-gsap.js';
import { formatMotionWaapi } from '../src/formatters/motion-waapi.js';
import { formatCssVars } from '../src/formatters/css-vars.js';
import { formatPreview } from '../src/formatters/preview.js';
import { formatFigma } from '../src/formatters/figma.js';
import { formatReactTheme, formatShadcnTheme } from '../src/formatters/theme.js';
import { formatWordPress, formatWordPressTheme } from '../src/formatters/wordpress.js';
import { formatIosSwiftUI } from '../src/formatters/ios-swiftui.js';
import { formatAndroidCompose } from '../src/formatters/android-compose.js';
import { formatFlutterDart } from '../src/formatters/flutter-dart.js';
import { formatVueTheme } from '../src/formatters/vue-theme.js';
import { formatSvelteTheme } from '../src/formatters/svelte-theme.js';
import { formatAgentRules } from '../src/formatters/agent-rules.js';
import { reconcileRoutes, formatRoutesReport } from '../src/formatters/routes-reconciliation.js';
import { loadConfig, mergeConfig } from '../src/config.js';
import { diffDesigns, formatDiffMarkdown, formatDiffHtml } from '../src/diff.js';
import { saveSnapshot, getHistory, formatHistoryMarkdown } from '../src/history.js';
import { captureResponsive } from '../src/extractors/responsive.js';
import { captureInteractions } from '../src/extractors/interactions.js';
import { syncDesign } from '../src/sync.js';
import { compareBrands, formatBrandMatrix, formatBrandMatrixHtml } from '../src/multibrand.js';
import { generateClone } from '../src/clone.js';
import { watchSite } from '../src/watch.js';
import { applyDesign } from '../src/apply.js';
import { formatGrade, formatGradeMarkdown } from '../src/formatters/grade.js';
import { formatBattle, formatBattleMarkdown } from '../src/formatters/battle.js';
import { formatScoreBadge } from '../src/formatters/badge.js';
import { formatRemix } from '../src/formatters/remix.js';
import { VOCABULARIES, getVocabulary, listVocabularies } from '../src/vocabularies/index.js';
import { buildPack } from '../src/pack.js';
import { recolorDesign } from '../src/recolor.js';
import { formatThemeSwap, formatThemeSwapMarkdown } from '../src/formatters/theme-swap.js';
import { formatBrandBook, formatBrandBookMarkdown } from '../src/formatters/brand-book.js';
import { htmlToPdf } from '../src/pdf.js';
import { fuseDesigns, AXES } from '../src/fuse.js';
import { formatPair, formatPairMarkdown } from '../src/formatters/pair.js';
import { nameFromUrl } from '../src/utils.js';

function validateUrl(url) {
  try { new URL(url); } catch {
    console.error(chalk.red(`\n  Invalid URL: ${url}\n`));
    console.error(chalk.gray('  Example: designlang https://example.com\n'));
    process.exit(1);
  }
}

// The root command also owns -o/--out and greedily consumes it before a
// subcommand sees it, so a sub-level default masks any override. Resolve the
// out dir robustly: an explicit sub value wins; else the root's value *only if
// it was actually passed on the CLI* (not its own default); else the fallback.
function resolveOut(opts, command, fallback) {
  if (opts.out) return resolve(opts.out);
  const parent = command?.parent;
  if (parent?.getOptionValueSource?.('out') === 'cli') return resolve(parent.opts().out);
  return resolve(fallback);
}

const program = new Command();

program
  .name('designlang')
  .description('Extract the complete design language from any website')
  // Without this, options typed after a subcommand (`designlang dna <url> -o
  // <dir>`) are claimed by the root command, whose own `-o` shadows every
  // subcommand's — so `-o`, `-n` and friends were silently ignored on every
  // subcommand and output always landed in the default directory.
  .enablePositionalOptions()
  .version(PKG_VERSION);

// ── Main command: extract ──────────────────────────────────────
program
  .argument('<url>', 'URL to extract design language from')
  .option('-o, --out <dir>', 'output directory', './design-extract-output')
  .option('-n, --name <name>', 'output file prefix (default: derived from URL)')
  .option('-w, --width <px>', 'viewport width', parseInt, 1280)
  .option('--height <px>', 'viewport height', parseInt, 800)
  .option('--wait <ms>', 'wait after page load (ms)', parseInt, 0)
  .option('--dark', 'also extract dark mode styles')
  .option('--depth <n>', 'number of internal pages to also crawl', parseInt, 0)
  .option('--screenshots', 'capture component screenshots')
  .option('--framework <type>', 'generate framework theme (react, shadcn, vue, svelte)')
  .option('--responsive', 'capture design at multiple breakpoints')
  .option('--interactions', 'capture hover/focus/active states')
  .option('--deep-interact', 'auto-interact pass: scroll, open menus/modals/accordions, hover CTAs (implies --interactions)')
  .option('--motion-runtime', 'capture motion at runtime via document.getAnimations() — real durations, choreography/stagger, scroll recipes (Motion v3)')
  .option('--full', 'enable all extra captures (screenshots, responsive, interactions, deep-interact)')
  .option('--cookie <cookies...>', 'cookies for authenticated pages (name=value)')
  .option('--cookie-file <path>', 'load cookies from JSON, Playwright storageState, or Netscape cookies.txt')
  .option('--header <headers...>', 'custom headers (name:value)')
  .option('--user-agent <ua>', 'override the browser User-Agent string')
  .option('--insecure', 'ignore HTTPS/SSL certificate errors (self-signed, dev, proxies)')
  .option('--ignore <selectors...>', 'CSS selectors to remove before extraction')
  .option('--ignore-widgets', 'Also ignore a curated list of third-party widgets (Intercom, Drift, HubSpot chat, cookie banners, reCAPTCHA, etc.)  See `designlan
```

### Core Architecture Module: `chrome-extension/popup.js`
```
// designlang Chrome extension popup script.
// On open, reads the active tab's URL, shows it, and wires the Extract button
// to hand off to designlang.manavaryasingh.com with the URL prefilled.

const SITE = 'https://designlang.manavaryasingh.com/';

function isExtractable(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function getActiveTabUrl() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.url || '';
}

function render(tabUrl) {
  const display = document.getElementById('url-display');
  const btn = document.getElementById('extract-btn');
  const copy = document.getElementById('copy-cli');

  if (!isExtractable(tabUrl)) {
    display.textContent = '(open a regular https:// page to extract)';
    btn.disabled = true;
    btn.style.opacity = '0.55';
    btn.style.cursor = 'not-allowed';
    copy.setAttribute('aria-disabled', 'true');
    copy.style.pointerEvents = 'none';
    copy.style.opacity = '0.55';
    return;
  }

  display.textContent = tabUrl;

  btn.addEventListener('click', () => {
    const target = `${SITE}?url=${encodeURIComponent(tabUrl)}&source=chrome`;
    chrome.tabs.create({ url: target });
    window.close();
  });

  copy.addEventListener('click', async (e) => {
    e.preventDefault();
    const line = `npx designlang ${tabUrl}`;
    try {
      await navigator.clipboard.writeText(line);
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy CLI'; }, 1200);
    } catch {
      copy.textContent = 'Clipboard denied';
    }
  });
}

getActiveTabUrl().then(render);

```

### Core Architecture Module: `figma-plugin/code.js`
```
// designlang Figma plugin — imports a `*-figma-variables.json` payload
// (produced by `designlang <url>`) into Figma Variables.
//
// Payload shape (compatible with src/formatters/figma.js):
//   { collections: [{ name, modes: [{ name, variables: [{ name, type, value }] }] }] }
// — or any superset. Unknown keys are ignored.

figma.showUI(__html__, { width: 420, height: 440, themeColors: true });

figma.ui.onmessage = async (msg) => {
  if (msg.type === "cancel") {
    figma.closePlugin();
    return;
  }
  if (msg.type !== "import") return;

  try {
    const data = msg.data;
    const collections = Array.isArray(data?.collections) ? data.collections : [];
    if (collections.length === 0) throw new Error("No `collections` array found in payload.");

    let varCount = 0;
    let colCount = 0;

    for (const c of collections) {
      const collection = figma.variables.createVariableCollection(c.name || "designlang");
      colCount++;
      const modes = Array.isArray(c.modes) && c.modes.length > 0 ? c.modes : [{ name: "Default", variables: c.variables || [] }];

      // First mode: rename the default one Figma auto-creates.
      const primaryMode = modes[0];
      collection.renameMode(collection.modes[0].modeId, primaryMode.name || "Default");

      const modeIds = [collection.modes[0].modeId];
      for (let i = 1; i < modes.length; i++) {
        modeIds.push(collection.addMode(modes[i].name || `Mode ${i + 1}`));
      }

      // Create variables from the first mode, then layer in subsequent modes.
      const byName = new Map();
      for (let m = 0; m < modes.length; m++) {
        const mode = modes[m];
        const vars = Array.isArray(mode.variables) ? mode.variables : [];
        for (const v of vars) {
          if (!v || !v.name) continue;
          let variable = byName.get(v.name);
          if (!variable) {
            const type = figmaVarType(v.type);
            variable = figma.variables.createVariable(v.name, collection, type);
            byName.set(v.name, variable);
            varCount++;
          }
          const value = coerceValue(v.type, v.value);
          if (value !== undefined) variable.setValueForMode(modeIds[m], value);
        }
      }
    }

    figma.ui.postMessage({ type: "done", variableCount: varCount, collectionCount: colCount });
    figma.notify(`designlang: imported ${varCount} variables across ${colCount} collections.`);
  } catch (err) {
    figma.ui.postMessage({ type: "error", message: err.message });
  }
};

function figmaVarType(t) {
  switch ((t || "").toLowerCase()) {
    case "color":    return "COLOR";
    case "number":
    case "float":
    case "size":
    case "spacing":
    case "radius":   return "FLOAT";
    case "string":
    case "fontfamily": return "STRING";
    case "boolean": return "BOOLEAN";
    default: return "STRING";
  }
}

function coerceValue(type, v) {
  if (v === undefined || v === null) return undefined;
  const t = (type || "").toLowerCase();
  if (t === "color") {
    if (typeof v === "string") return hexToFigmaColor(v);
    if (typeof v === "object" && "r" in v) {
      return {
        r: normChan(v.r),
        g: normChan(v.g),
        b: normChan(v.b),
        a: typeof v.a === "number" ? (v.a > 1 ? v.a / 255 : v.a) : 1,
      };
    }
  }
  if (t === "number" || t === "float" || t === "size" || t === "spacing" || t === "radius") {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return typeof n === "number" && !Number.isNaN(n) ? n : undefined;
  }
  if (t === "boolean") return Boolean(v);
  return String(v);
}

function normChan(c) {
  if (typeof c !== "number") return 0;
  return c > 1 ? c / 255 : c;
}

function hexToFigmaColor(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

```

### Core Architecture Module: `raycast-extension/src/copy-cli.tsx`
```
import { Clipboard, LaunchProps, showHUD, showToast, Toast } from "@raycast/api";

export default async function Command(props: LaunchProps<{ arguments: { url?: string } }>) {
  const rawUrl = (props.arguments?.url || "").trim();
  if (!rawUrl) {
    await showToast({ style: Toast.Style.Failure, title: "No URL provided" });
    return;
  }
  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  await Clipboard.copy(`npx designlang ${url}`);
  await showHUD("Copied `npx designlang …` to clipboard");
}

```

### Core Architecture Module: `raycast-extension/src/extract.tsx`
```
import {
  Action,
  ActionPanel,
  Form,
  Toast,
  getPreferenceValues,
  open,
  showToast,
} from "@raycast/api";
import { execFile } from "child_process";
import { homedir } from "os";
import { useState } from "react";

function resolveOutputDir(raw?: string) {
  const v = (raw || "~/designlang-output").trim();
  return v.startsWith("~") ? v.replace(/^~/, homedir()) : v;
}

function normalizeUrl(u: string) {
  const t = u.trim();
  return t.startsWith("http") ? t : `https://${t}`;
}

export default function Command() {
  const prefs = getPreferenceValues<Preferences.Extract>();
  const [url, setUrl] = useState("");
  const [full, setFull] = useState(false);

  async function run(values: { url: string; full: boolean }) {
    const outDir = resolveOutputDir(prefs.outputDir);
    const args = [
      "-y",
      "designlang",
      normalizeUrl(values.url),
      "--out",
      outDir,
    ];
    if (values.full) args.push("--full");

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "designlang: extracting...",
    });

    execFile("npx", args, { maxBuffer: 50 * 1024 * 1024 }, async (err, stdout, stderr) => {
      if (err) {
        toast.style = Toast.Style.Failure;
        toast.title = "Extraction failed";
        toast.message = (stderr || err.message).slice(0, 200);
        return;
      }
      toast.style = Toast.Style.Success;
      toast.title = "Done";
      toast.message = outDir;
      toast.primaryAction = { title: "Open folder", onAction: () => open(outDir) };
      await open(outDir);
    });
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Extract Design" onSubmit={run} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="URL"
        placeholder="https://stripe.com"
        value={url}
        onChange={setUrl}
      />
      <Form.Checkbox id="full" label="Full extraction (screenshots + responsive + interactions)" value={full} onChange={setFull} />
      <Form.Description text="Runs `npx designlang <url>` and opens the output folder when it finishes." />
    </Form>
  );
}

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
@@ -85,7 +115,11 @@ for (c
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
