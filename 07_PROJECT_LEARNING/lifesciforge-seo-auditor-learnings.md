> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lifesciforge-seo-auditor-learnings.md`  
> **Source**: github ([https://github.com/LifeSciForge/seo-auditor](https://github.com/LifeSciForge/seo-auditor))  
> **Source Version**: `cb5dbfbf`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T18:27:06.012Z  
> **Learning ID**: `learn-github-lifesciforge-seo-auditor`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): LifeSciForge/seo-auditor

> **Canonical Artifact**: `07_PROJECT_LEARNING/lifesciforge-seo-auditor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/LifeSciForge/seo-auditor](https://github.com/LifeSciForge/seo-auditor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-21T18:27:01.616Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `LifeSciForge/seo-auditor`
- **Description**: AI-powered SEO audit tool with downloadable PDF reports
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 0 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/utils/crawler.ts`
```
import axios from 'axios';
import { FetchResult } from '../types';

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^169\.254\./,
  /metadata\.google\.internal/i,
  /metadata\.aws\.internal/i,
];

const USER_AGENT =
  'Mozilla/5.0 (compatible; SEO-Auditor/1.0; +https://github.com/seo-auditor)';

export function isPrivateUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return PRIVATE_IP_PATTERNS.some((p) => p.test(hostname));
  } catch {
    return true;
  }
}

export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    return `https://${u}`;
  }
  return u;
}

export async function fetchPage(
  url: string,
  timeoutMs = 10000
): Promise<FetchResult> {
  if (isPrivateUrl(url)) {
    return {
      url,
      finalUrl: url,
      statusCode: 0,
      html: '',
      headers: {},
      redirectChain: [],
      responseTimeMs: 0,
      contentLength: 0,
      error: 'Blocked: private/internal URL',
    };
  }

  const redirectChain: Array<{ url: string; statusCode: number }> = [];
  let currentUrl = url;
  const start = Date.now();

  try {
    for (let hop = 0; hop < 10; hop++) {
      if (isPrivateUrl(currentUrl)) {
        return {
          url,
          finalUrl: currentUrl,
          statusCode: 0,
          html: '',
          headers: {},
          redirectChain,
          responseTimeMs: Date.now() - start,
          contentLength: 0,
          error: 'Blocked: redirect to private URL',
        };
      }

      const response = await axios.get<string>(currentUrl, {
        timeout: timeoutMs,
        maxRedirects: 0,
        validateStatus: () => true,
        responseType: 'text',
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      });

      const status = response.status;
      const rawHeaders = response.headers as Record<string, string | string[]>;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawHeaders)) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
      }

      if (status >= 301 && status <= 308) {
        redirectChain.push({ url: currentUrl, statusCode: status });
        const location = headers['location'];
        if (!location) break;
        try {
          currentUrl = new URL(location, currentUrl).href;
        } catch {
          break;
        }
        continue;
      }

      const html = typeof response.data === 'string' ? response.data : '';
      return {
        url,
        finalUrl: currentUrl,
        statusCode: status,
        html,
        headers,
        redirectChain,
        responseTimeMs: Date.now() - start,
        contentLength: html.length,
      };
    }

    return {
      url,
      finalUrl: currentUrl,
      statusCode: 0,
      html: '',
      headers: {},
      redirectChain,
      responseTimeMs: Date.now() - start,
      contentLength: 0,
      error: 'Too many redirects',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown fetch error';
    return {
      url,
      finalUrl: currentUrl,
      statusCode: 0,
      html: '',
      headers: {},
      redirectChain,
      responseTimeMs: Date.now() - start,
      contentLength: 0,
      error: message,
    };
  }
}

/** HEAD request for link checking; falls back to byte-range GET if HEAD is rejected. */
export async function fetchHead(
  url: string,
  timeoutMs = 5000
): Promise<{ statusCode: number; error?: string }> {
  if (isPrivateUrl(url)) {
    return { statusCode: 0, error: 'Blocked: private URL' };
  }
  try {
    const response = await axios.head(url, {
      timeout: timeoutMs,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { 'User-Agent': USER_AGENT },
    });
    return { statusCode: response.status };
  } catch {
    // Some servers reject HEAD — fall back to minimal GET
    try {
      const response = await axios.get(url, {
        timeout: timeoutMs,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-0' },
      });
      return { statusCode: response.status };
    } catch (err: unknown) {
      return {
        statusCode: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}

```

### Core Architecture Module: `src/utils/html-parser.ts`
```
import * as cheerio from 'cheerio';
import { ParsedPage, ImageData, LinkData } from '../types';

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

export function parseHtml(html: string, url: string): ParsedPage {
  const $ = cheerio.load(html);
  const baseUrl = new URL(url);

  // ── Basic metadata ─────────────────────────────────────────────────────────
  const title = $('title').first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() || null;
  const canonical =
    $('link[rel="canonical"]').attr('href')?.trim() || null;
  const robotsMeta =
    $('meta[name="robots"]').attr('content')?.trim() || null;
  const lang = $('html').attr('lang')?.trim() || null;
  const viewport =
    $('meta[name="viewport"]').attr('content')?.trim() || null;

  // ── Headings ───────────────────────────────────────────────────────────────
  const h1s: string[] = [];
  const h2s: string[] = [];
  const h3s: string[] = [];
  const h4s: string[] = [];
  const headings: Array<{ level: number; text: string }> = [];

  $('h1').each((_, el) => {
    const t = $(el).text().trim();
    h1s.push(t);
    headings.push({ level: 1, text: t });
  });
  $('h2').each((_, el) => {
    const t = $(el).text().trim();
    h2s.push(t);
    headings.push({ level: 2, text: t });
  });
  $('h3').each((_, el) => {
    const t = $(el).text().trim();
    h3s.push(t);
    headings.push({ level: 3, text: t });
  });
  $('h4').each((_, el) => {
    const t = $(el).text().trim();
    h4s.push(t);
    headings.push({ level: 4, text: t });
  });

  // ── Images ─────────────────────────────────────────────────────────────────
  const images: ImageData[] = [];
  $('img').each((_, el) => {
    images.push({
      src: $(el).attr('src') || '',
      alt: $(el).attr('alt') ?? null,
      width: $(el).attr('width') ?? null,
      height: $(el).attr('height') ?? null,
      loading: $(el).attr('loading') ?? null,
    });
  });

  // ── Links ──────────────────────────────────────────────────────────────────
  const internalLinks: LinkData[] = [];
  const externalLinks: LinkData[] = [];
  const seenHrefs = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const rel = ($(el).attr('rel') || '').split(/\s+/).filter(Boolean);

    // Skip mailto/tel/javascript/anchor-only
    if (/^(mailto:|tel:|javascript:|#)/.test(href)) return;

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, url).href;
    } catch {
      return;
    }

    if (seenHrefs.has(absoluteUrl)) return;
    seenHrefs.add(absoluteUrl);

    try {
      const linkUrl = new URL(absoluteUrl);
      const isInternal = linkUrl.hostname === baseUrl.hostname;
      const linkData: LinkData = { href: absoluteUrl, text, rel, isInternal };

      if (isInternal) {
        internalLinks.push(linkData);
      } else {
        externalLinks.push(linkData);
      }
    } catch {
      // skip invalid
    }
  });

  // ── Schema.org JSON-LD ─────────────────────────────────────────────────────
  const schema: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || '{}';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        schema.push(...parsed);
      } else {
        schema.push(parsed);
      }
    } catch {
      // invalid JSON
    }
  });

  // ── Open Graph ─────────────────────────────────────────────────────────────
  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = ($(el).attr('property') || '').replace('og:', '');
    const content = $(el).attr('content') || '';
    if (prop) openGraph[prop] = content;
  });

  // ── Dates ──────────────────────────────────────────────────────────────────
  const publishDate: string | null =
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="date"]').attr('content') ||
    $('time[itemprop="datePublished"]').attr('datetime') ||
    null;

  const modifiedDate: string | null =
    $('meta[property="article:modified_time"]').attr('content') ||
    $('meta[name="last-modified"]').attr('content') ||
    $('time[itemprop="dateModified"]').attr('datetime') ||
    null;

  // ── Forms & accessibility ──────────────────────────────────────────────────
  const hasForm = $('form').length > 0;
  let formInputsWithoutLabel = 0;

  $('input, textarea, select').each((_, el) => {
    const type = $(el).attr('type') || '';
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return;

    const id = $(el).attr('id');
    const ariaLabel = $(el).attr('aria-label');
    const ariaLabelledBy = $(el).attr('aria-labelledby');
    const hasExplicitLabel = id ? $(`label[for="${id}"]`).length > 0 : false;

    if (!ariaLabel && !ariaLabelledBy && !hasExplicitLabel) {
      formInputsWithoutLabel++;
    }
  });

  // ── ARIA landmarks ─────────────────────────────────────────────────────────
  const ariaLandmarks: string[] = [];
  if ($('[role="main"], main').length > 0) ariaLandmarks.push('main');
  if ($('[role="navigation"], nav').length > 0) ariaLandmarks.push('navigation');
  if ($('[role="banner"], header').length > 0) ariaLandmarks.push('banner');
  if ($('[role="contentinfo"], footer').length > 0) ariaLandmarks.push('contentinfo');
  if ($('[role="search"]').length > 0) ariaLandmarks.push('search');

  // ── Skip link ──────────────────────────────────────────────────────────────
  const hasSkipLink =
    $('a[href="#main"], a[href="#content"], a[href="#main-content"], a[href="#skip"]').length > 0;

  // ── Body text (stripped of nav/header/footer/scripts) ─────────────────────
  const $c = cheerio.load(html);
  $c('script, style, noscript, svg, iframe, nav, header, footer').remove();
  const bodyText = $c('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = countWords(bodyText);

  return {
    url,
    title,
    metaDescription,
    canonical,
    robotsMeta,
    h1s,
    h2s,
    h3s,
    h4s,
    headings,
    images,
    internalLinks,
    externalLinks,
    schema,
    wordCount,
    lang,
    viewport,
    openGraph,
    publishDate,
    modifiedDate,
    hasForm,
    formInputsWithoutLabel,
    ariaLandmarks,
    hasSkipLink,
    bodyText,
  };
}

```

### Core Architecture Module: `src/utils/scorer.ts`
```
import {
  CheckResult,
  CategoryScore,
  CheckCategory,
  CATEGORY_WEIGHTS,
  IndustryType,
} from '../types';
import { getIndustryWeights } from '../scoring/industry-weights';

export function calculateCategoryScores(
  checks: CheckResult[],
  industry: IndustryType = 'generic'
): CategoryScore[] {
  const categories = Object.keys(CATEGORY_WEIGHTS) as CheckCategory[];
  const weights = getIndustryWeights(industry);

  return categories.map((category) => {
    const categoryChecks = checks.filter((c) => c.category === category);

    let totalPoints = 0;
    let earnedPoints = 0;
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const check of categoryChecks) {
      const weight = check.impactScore; // weight each check by its impact
      totalPoints += weight;

      if (check.status === 'pass') {
        earnedPoints += weight;
        passed++;
      } else if (check.status === 'warning') {
        earnedPoints += weight * 0.5;
        warnings++;
      } else {
        failed++;
      }
    }

    const score =
      totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 100;

    return {
      category,
      score,
      weight: weights[category] ?? CATEGORY_WEIGHTS[category],
      checksPassed: passed,
      checksFailed: failed,
      checksWarning: warnings,
    };
  });
}

export function calculateOverallScore(categoryScores: CategoryScore[]): number {
  let totalWeight = 0;
  let weightedScore = 0;

  for (const cs of categoryScores) {
    weightedScore += cs.score * cs.weight;
    totalWeight += cs.weight;
  }

  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
}

export interface ScoreGrade {
  grade: string;
  label: string;
  color: string;
  bg: string;
}

export function getScoreGrade(score: number): ScoreGrade {
  if (score >= 90) return { grade: 'A', label: 'Excellent', color: '#16a34a', bg: '#dcfce7' };
  if (score >= 80) return { grade: 'B', label: 'Good', color: '#65a30d', bg: '#ecfccb' };
  if (score >= 70) return { grade: 'C', label: 'Fair', color: '#ca8a04', bg: '#fef9c3' };
  if (score >= 60) return { grade: 'D', label: 'Poor', color: '#ea580c', bg: '#ffedd5' };
  return { grade: 'F', label: 'Critical', color: '#dc2626', bg: '#fee2e2' };
}

export function summarize(checks: CheckResult[]) {
  return {
    high: checks.filter((c) => c.status !== 'pass' && c.severity === 'high').length,
    medium: checks.filter((c) => c.status !== 'pass' && c.severity === 'medium').length,
    low: checks.filter((c) => c.status !== 'pass' && c.severity === 'low').length,
    passed: checks.filter((c) => c.status === 'pass').length,
    warnings: checks.filter((c) => c.status === 'warning').length,
  };
}

```

### Core Architecture Module: `src/ai/ollama-client.ts`
```
import { Ollama } from 'ollama';
import { AuditReport } from '../types';

function buildPrompt(report: Omit<AuditReport, 'aiRecommendations'>): string {
  const failedChecks = report.checks
    .filter((c) => c.status !== 'pass')
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 20);

  const categoryBreakdown = report.categoryScores
    .map((cs) => `  - ${cs.category}: ${cs.score}/100 (${cs.checksFailed} failed, ${cs.checksWarning} warnings)`)
    .join('\n');

  const issuesList = failedChecks
    .map((c) => `  [${c.status.toUpperCase()}] [${c.severity.toUpperCase()}] ${c.name}: ${c.explanation}`)
    .join('\n');

  return `You are an expert SEO consultant. Analyse the following SEO audit results and provide actionable, prioritised recommendations.

AUDIT SUMMARY
=============
URL: ${report.url}
Overall SEO Score: ${report.overallScore}/100
Audit Date: ${report.auditedAt}

CATEGORY SCORES
===============
${categoryBreakdown}

TOP ISSUES FOUND
================
${issuesList}

QUICK WINS (low effort, high impact)
=====================================
${report.quickWins.map((c) => `  - ${c.name}: ${c.explanation}`).join('\n') || '  None identified'}

Please provide:
1. **Executive Summary** (2-3 sentences on overall SEO health)
2. **Top 5 Priority Fixes** (highest impact issues with specific action steps)
3. **Quick Wins** (3-5 fixes that take < 1 hour each)
4. **Content Strategy Recommendations** (based on content quality findings)
5. **Technical Health** (key technical issues to resolve)
6. **30-Day Action Plan** (prioritised list of tasks)

Be specific, actionable, and avoid generic advice. Reference actual issues found in the audit.`;
}

export async function generateRecommendations(
  report: Omit<AuditReport, 'aiRecommendations'>,
  model: string,
  host: string
): Promise<string> {
  try {
    const client = new Ollama({ host });
    const prompt = buildPrompt(report);

    const response = await client.generate({
      model,
      prompt,
      options: {
        temperature: 0.3,
        num_predict: 2048,
      },
      stream: false,
    });

    return response.response || 'No recommendations generated.';
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Ollama error';
    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      return `⚠️  Ollama not available (${message}). Start Ollama with: ollama serve\nThen run: ollama pull ${model}`;
    }
    if (message.includes('model') || message.includes('not found')) {
      return `⚠️  Model "${model}" not found. Pull it with: ollama pull ${model}`;
    }
    return `⚠️  AI recommendations unavailable: ${message}`;
  }
}

/** Test Ollama connection and model availability. */
export async function testOllamaConnection(
  model: string,
  host: string
): Promise<{ available: boolean; error?: string }> {
  try {
    const client = new Ollama({ host });
    const list = await client.list();
    const hasModel = list.models.some(
      (m: { name: string }) => m.name === model || m.name.startsWith(model.split(':')[0])
    );
    if (!hasModel) {
      return {
        available: false,
        error: `Model "${model}" not found. Available: ${list.models.map((m: { name: string }) => m.name).join(', ') || 'none'}. Run: ollama pull ${model}`,
      };
    }
    return { available: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { available: false, error: `Cannot connect to Ollama at ${host}: ${message}` };
  }
}

```

### Core Architecture Module: `src/auditor.ts`
```
import { AuditReport, AuditOptions } from './types';
import { fetchPage, normalizeUrl } from './utils/crawler';
import { parseHtml } from './utils/html-parser';
import {
  calculateCategoryScores,
  calculateOverallScore,
  summarize,
} from './utils/scorer';
import {
  runTechnicalChecks,
  runOnPageChecks,
  runContentChecks,
  runLinkChecks,
  runAccessibilityChecks,
  runPerformanceChecks,
  runAEOChecks,
  runGEOChecks,
  calculateGEOScore,
} from './checks';
import { generateRecommendations } from './ai/ollama-client';
import { generatePhasedRoadmap } from './recommendations/phased-roadmap';

export async function auditUrl(
  rawUrl: string,
  options: AuditOptions,
  onProgress?: (step: string) => void
): Promise<AuditReport> {
  const startTime = Date.now();
  const url = normalizeUrl(rawUrl);
  const industry = options.industry || 'generic';

  const progress = (msg: string) => onProgress && onProgress(msg);

  // ── 1. Fetch the page ───────────────────────────────────────────────────────
  progress('Fetching page...');
  const fetchResult = await fetchPage(url, options.timeout);

  if (fetchResult.error && !fetchResult.html) {
    const dummy: AuditReport = {
      url,
      domain: new URL(url).hostname,
      auditedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      overallScore: 0,
      aeoScore: 0,
      geoScore: null,
      industry,
      categoryScores: [],
      checks: [],
      summary: { high: 0, medium: 0, low: 0, passed: 0, warnings: 0 },
      technicalDetails: {
        statusCode: 0,
        responseTimeMs: fetchResult.responseTimeMs,
        redirectChain: fetchResult.redirectChain,
        isHttps: url.startsWith('https://'),
        pageSize: 0,
        headers: {},
      },
      aiRecommendations: '',
      topIssues: [],
      quickWins: [],
      roadmap: [],
    };
    return dummy;
  }

  // ── 2. Parse HTML ───────────────────────────────────────────────────────────
  progress('Parsing HTML...');
  const parsed = parseHtml(fetchResult.html, fetchResult.finalUrl || url);

  // ── 3. Run all checks in parallel ──────────────────────────────────────────
  progress('Running SEO checks...');
  const [
    technicalChecks,
    onPageChecks,
    contentChecks,
    accessibilityChecks,
    performanceChecks,
    aeoChecks,
    geoChecks,
  ] = await Promise.all([
    runTechnicalChecks(url, fetchResult, parsed),
    Promise.resolve(runOnPageChecks(parsed)),
    Promise.resolve(runContentChecks(parsed)),
    Promise.resolve(runAccessibilityChecks(parsed)),
    Promise.resolve(runPerformanceChecks(fetchResult, parsed)),
    Promise.resolve(runAEOChecks(url, fetchResult, parsed)),
    Promise.resolve(runGEOChecks(url, fetchResult, parsed)),
  ]);

  // ── 4. Link checks (requires HTTP requests) ─────────────────────────────────
  progress(`Checking links (up to ${options.maxLinksToCheck})...`);
  const linkChecks = await runLinkChecks(
    url, parsed, options.maxLinksToCheck, options.checkExternalLinks, options.timeout
  );

  // ── 5. Aggregate all checks ─────────────────────────────────────────────────
  const allChecks = [
    ...technicalChecks,
    ...onPageChecks,
    ...contentChecks,
    ...linkChecks,
    ...accessibilityChecks,
    ...performanceChecks,
    ...aeoChecks,
    ...geoChecks,
  ];

  // ── 6. Calculate scores ─────────────────────────────────────────────────────
  progress('Calculating scores...');
  const categoryScores = calculateCategoryScores(allChecks, industry);
  const overallScore = calculateOverallScore(categoryScores);
  const summary = summarize(allChecks);

  // AEO score (from aeo-ai-search category)
  const aeoCategory = categoryScores.find((cs) => cs.category === 'aeo-ai-search');
  const aeoScore = aeoCategory?.score ?? 0;

  // GEO score (null if not applicable)
  const geoScore = calculateGEOScore(allChecks);

  // ── 7. Top issues and quick wins ─────────────────────────────────────────────
  const failed = allChecks.filter((c) => c.status !== 'pass');
  const topIssues = [...failed]
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 10);

  const quickWins = [...failed]
    .filter((c) => c.effortScore <= 2)
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 8);

  // ── 8. Roadmap ───────────────────────────────────────────────────────────────
  progress('Generating roadmap...');
  const domain = new URL(fetchResult.finalUrl || url).hostname;
  const roadmap = generatePhasedRoadmap(allChecks);

  // ── 9. Build report skeleton ─────────────────────────────────────────────────
  const reportWithoutAI: Omit<AuditReport, 'aiRecommendations'> = {
    url: fetchResult.finalUrl || url,
    domain,
    auditedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    overallScore,
    aeoScore,
    geoScore,
    industry,
    categoryScores,
    checks: allChecks,
    summary,
    technicalDetails: {
      statusCode: fetchResult.statusCode,
      responseTimeMs: fetchResult.responseTimeMs,
      redirectChain: fetchResult.redirectChain,
      isHttps: (fetchResult.finalUrl || url).startsWith('https://'),
      pageSize: fetchResult.contentLength,
      headers: fetchResult.headers,
    },
    topIssues,
    quickWins,
    roadmap,
  };

  // ── 10. AI recommendations ──────────────────────────────────────────────────
  let aiRecommendations = '';
  if (!options.skipAI) {
    progress(`Generating AI recommendations with ${options.ollamaModel}...`);
    aiRecommendations = await generateRecommendations(
      reportWithoutAI,
      options.ollamaModel,
      options.ollamaHost
    );
  }

  return {
    ...reportWithoutAI,
    durationMs: Date.now() - startTime,
    aiRecommendations,
  };
}

```

### Core Architecture Module: `src/checks/accessibility.ts`
```
import { CheckResult, ParsedPage } from '../types';

type Cat = 'accessibility';
const CAT: Cat = 'accessibility';

function pass(id: string, name: string, expl: string, impact: number, effort: number): CheckResult {
  return { checkId: id, name, category: CAT, severity: 'low', status: 'pass',
    currentValue: null, recommendedValue: null, affectedElements: [], explanation: expl, impactScore: impact, effortScore: effort };
}
function fail(id: string, name: string, sev: CheckResult['severity'], cur: CheckResult['currentValue'],
  rec: CheckResult['recommendedValue'], aff: string[], expl: string, impact: number, effort: number): CheckResult {
  return { checkId: id, name, category: CAT, severity: sev, status: 'fail',
    currentValue: cur, recommendedValue: rec, affectedElements: aff, explanation: expl, impactScore: impact, effortScore: effort };
}
function warn(id: string, name: string, cur: CheckResult['currentValue'], rec: CheckResult['recommendedValue'],
  aff: string[], expl: string, impact: number, effort: number): CheckResult {
  return { checkId: id, name, category: CAT, severity: 'medium', status: 'warning',
    currentValue: cur, recommendedValue: rec, affectedElements: aff, explanation: expl, impactScore: impact, effortScore: effort };
}

export function runAccessibilityChecks(parsed: ParsedPage): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. HTML lang attribute (WCAG 3.1.1)
  if (parsed.lang && parsed.lang.length >= 2) {
    results.push(pass('html-lang', 'HTML Language Attribute',
      `<html lang="${parsed.lang}"> — screen readers and translation tools can identify language.`, 7, 1));
  } else if (parsed.lang === '') {
    results.push(warn('html-lang', 'HTML Language Attribute', 'Empty lang=""', 'Valid BCP 47 code (e.g. "en")',
      ['<html lang="">'],
      'HTML lang attribute is empty. Set to a valid language code (e.g., "en", "fr", "de") for WCAG 3.1.1 compliance and correct screen reader pronunciation.', 7, 1));
  } else {
    results.push(fail('html-lang', 'HTML Language Attribute', 'medium', 'Missing',
      '<html lang="en">', [],
      'No lang attribute on <html>. This is a WCAG 2.1 Level A failure. Screen readers cannot identify the page language, causing incorrect pronunciation for visually impaired users.', 7, 1));
  }

  // 2. Image alt text (from accessibility perspective)
  const missingAlt = parsed.images.filter((img) => img.alt === null || img.alt === undefined);
  if (missingAlt.length === 0) {
    results.push(pass('a11y-image-alt', 'Image Alt Text (Accessibility)',
      `All ${parsed.images.length} image(s) have alt attributes — WCAG 1.1.1 satisfied.`, 8, 1));
  } else {
    results.push(fail('a11y-image-alt', 'Image Alt Text (Accessibility)', 'high',
      `${missingAlt.length} images missing alt`, 'alt attribute on all <img>',
      missingAlt.slice(0, 5).map((img) => `<img src="${img.src}">`),
      `${missingAlt.length} image(s) lack alt text — WCAG 1.1.1 Level A failure. Decorative images should have alt="", informative images need descriptive alt text.`, 8, 1));
  }

  // 3. Form labels
  if (parsed.hasForm) {
    if (parsed.formInputsWithoutLabel === 0) {
      results.push(pass('form-labels', 'Form Input Labels',
        'All form inputs have associated labels — WCAG 1.3.1 satisfied.', 7, 2));
    } else {
      results.push(fail('form-labels', 'Form Input Labels', 'high',
        `${parsed.formInputsWithoutLabel} unlabelled input(s)`, 'All inputs have labels',
        [],
        `${parsed.formInputsWithoutLabel} form input(s) have no associated label (no <label for="">, aria-label, or aria-labelledby). This is a WCAG 1.3.1 Level A failure — screen reader users cannot identify form fields.`, 7, 2));
    }
  }

  // 4. ARIA landmarks
  const landmarks = parsed.ariaLandmarks;
  if (landmarks.includes('main') && landmarks.includes('navigation')) {
    results.push(pass('aria-landmarks', 'ARIA Landmark Regions',
      `Key landmarks present: ${landmarks.join(', ')}.`, 6, 2));
  } else {
    const missing: string[] = [];
    if (!landmarks.includes('main')) missing.push('main (or role="main")');
    if (!landmarks.includes('navigation')) missing.push('nav (or role="navigation")');

    results.push(warn('aria-landmarks', 'ARIA Landmark Regions',
      `Missing: ${missing.join(', ')}`, 'main, nav, header, footer landmarks',
      missing.map((m) => `Missing <${m}>`),
      `Key ARIA landmarks missing: ${missing.join(', ')}. Landmarks help screen reader users navigate the page structure (WCAG 1.3.6 Best Practice). Add <main>, <nav>, <header>, <footer> semantic HTML.`, 6, 2));
  }

  // 5. Skip link
  if (parsed.hasSkipLink) {
    results.push(pass('skip-link', 'Skip Navigation Link',
      'Skip navigation link found — keyboard users can bypass repetitive navigation.', 5, 2));
  } else {
    results.push(warn('skip-link', 'Skip Navigation Link',
      'Missing', 'Skip to main content link',
      [],
      'No skip-to-content link found. WCAG 2.4.1 (Level A) requires a mechanism to skip repetitive navigation. Add <a href="#main" class="skip-link">Skip to main content</a> as the first focusable element.', 5, 2));
  }

  // 6. Images with non-empty alt that are likely generic
  const genericAlts = ['image', 'photo', 'picture', 'img', 'icon', 'logo', 'banner', 'thumbnail'];
  const vagueAltImages = parsed.images.filter(
    (img) => img.alt !== null && img.alt !== '' &&
      genericAlts.some((g) => img.alt!.toLowerCase().trim() === g)
  );
  if (vagueAltImages.length > 0) {
    results.push(warn('vague-alt-text', 'Vague Image Alt Text',
      `${vagueAltImages.length} image(s) with generic alt`, 'Descriptive alt text',
      vagueAltImages.slice(0, 5).map((img) => `<img alt="${img.alt}" src="${img.src}">`),
      `${vagueAltImages.length} image(s) have generic alt text (e.g., "image", "photo"). Replace with descriptive text that conveys the image content to visually impaired users and search engines.`, 6, 2));
  } else {
    results.push(pass('vague-alt-text', 'Vague Image Alt Text',
      'No generic/placeholder alt text detected.', 6, 2));
  }

  return results;
}

```

### Core Architecture Module: `src/checks/aeo.ts`
```
/**
 * AEO (Answer Engine Optimization) Checks
 * 45 checks across 4 subcategories optimizing for AI search engines
 * (Perplexity, ChatGPT, Gemini, SGE, etc.)
 */

import * as cheerio from 'cheerio';
import { CheckResult, FetchResult, ParsedPage } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function make(
  checkId: string,
  name: string,
  status: 'pass' | 'fail' | 'warning',
  severity: 'high' | 'medium' | 'low',
  currentValue: string | number | boolean | null,
  recommendedValue: string | number | boolean | null,
  explanation: string,
  impactScore: number,
  effortScore: number,
  affectedElements: string[] = []
): CheckResult {
  return {
    checkId,
    name,
    category: 'aeo-ai-search',
    severity,
    status,
    currentValue,
    recommendedValue,
    affectedElements,
    explanation,
    impactScore,
    effortScore,
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function containsPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

// ─── Subcategory 1: Content Structure (15 checks) ────────────────────────────

function checkFAQSection(html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasFaqSchema = $('script[type="application/ld+json"]').toArray().some((el) => {
    const text = $(el).html() || '';
    return text.includes('FAQPage') || text.includes('faqPage');
  });
  const hasFaqText = /\b(faq|frequently asked|common questions)\b/i.test(html);
  const hasFaqHeading = $('h2, h3').toArray().some((el) => /faq|frequently asked/i.test($(el).text()));
  const dtCount = $('dt').length;
  const hasAccordion = $('[class*="faq"], [class*="accordion"], [id*="faq"]').length > 0;

  if (hasFaqSchema && (hasFaqText || hasFaqHeading)) {
    return make('aeo-faq-section', 'FAQ Section with Schema', 'pass', 'high', true, true,
      'FAQ section with FAQPage schema detected. AI engines can extract Q&A pairs directly.', 9, 3);
  }
  if (hasFaqText || hasFaqHeading || dtCount >= 3 || hasAccordion) {
    return make('aeo-faq-section', 'FAQ Section with Schema', 'warning', 'high', 'FAQ content present, no schema', 'Add FAQPage JSON-LD schema',
      'FAQ content detected but missing FAQPage schema markup. Add JSON-LD schema to help AI engines extract questions.', 9, 3);
  }
  return make('aeo-faq-section', 'FAQ Section with Schema', 'fail', 'high', false, 'Add FAQ section + FAQPage schema',
    'No FAQ section detected. FAQs are the highest-value AEO signal — AI engines use Q&A pairs for direct answers.', 9, 3);
}

function checkComparisonTable(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const tables = $('table').toArray();
  const hasComparisonWord = /\b(vs\.?|versus|compare|comparison|best|top \d+)\b/i.test(bodyText);
  const hasComparisonTable = tables.some((el) => {
    const tableText = $(el).text();
    return /vs|compare|best|feature|price/i.test(tableText);
  });

  if (hasComparisonTable) {
    return make('aeo-comparison-table', 'Comparison Tables', 'pass', 'medium', true, true,
      'Comparison table detected. AI engines prioritize structured comparisons for product/service queries.', 7, 4);
  }
  if (hasComparisonWord && tables.length > 0) {
    return make('aeo-comparison-table', 'Comparison Tables', 'warning', 'medium', 'Tables present, no comparison',
      'Add comparison rows (vs, pricing, features)', 'Tables present but no clear comparison structure. Format key comparisons as proper tables.', 7, 4);
  }
  return make('aeo-comparison-table', 'Comparison Tables', 'fail', 'medium', false, 'Add comparison table',
    'No comparison tables detected. "X vs Y" queries dominate AI search — structured tables win featured positions.', 7, 4);
}

function checkProsConsList(bodyText: string): CheckResult {
  const hasPros = /\b(pros?|advantages?|benefits?|strengths?)\b/i.test(bodyText);
  const hasCons = /\b(cons?|disadvantages?|drawbacks?|weaknesses?|limitations?)\b/i.test(bodyText);
  if (hasPros && hasCons) {
    return make('aeo-pros-cons', 'Pros & Cons Content', 'pass', 'medium', true, true,
      'Pros and cons content detected. Balanced analysis improves AI citation likelihood.', 7, 3);
  }
  if (hasPros || hasCons) {
    return make('aeo-pros-cons', 'Pros & Cons Content', 'warning', 'medium', 'Partial pros/cons', 'Add both pros and cons sections',
      'Only one side of pros/cons detected. Include both to give AI engines a complete analysis.', 7, 3);
  }
  return make('aeo-pros-cons', 'Pros & Cons Content', 'fail', 'low', false, 'Add pros & cons sections',
    'No pros/cons content. Adding structured pros and cons increases relevance for evaluative queries.', 7, 3);
}

function checkStepByStepInstructions(html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasHowToSchema = $('script[type="application/ld+json"]').toArray().some((el) => {
    const t = $(el).html() || '';
    return t.includes('HowTo') || t.includes('howTo');
  });
  const hasOrderedList = $('ol').length > 0 && $('ol li').length >= 3;
  const hasStepText = /\bstep \d+\b|\b(step-by-step|how to|tutorial)\b/i.test($('body').text());

  if (hasHowToSchema && hasOrderedList) {
    return make('aeo-step-by-step', 'Step-by-Step Instructions', 'pass', 'high', true, true,
      'HowTo schema + ordered list detected. Optimal for AI-extracted procedural answers.', 9, 4);
  }
  if (hasOrderedList || hasStepText) {
    return make('aeo-step-by-step', 'Step-by-Step Instructions', 'warning', 'high', 'Steps present, no HowTo schema',
      'Add HowTo JSON-LD schema', 'Ordered steps detected but missing HowTo schema. Add schema to qualify for rich results.', 9, 4);
  }
  return make('aeo-step-by-step', 'Step-by-Step Instructions', 'fail', 'medium', false, 'Add HowTo content with schema',
    'No step-by-step instructions. "How to" queries represent 30%+ of voice searches — HowTo schema captures these.', 9, 4);
}

function checkNumberedLists(html: string): CheckResult {
  const $ = cheerio.load(html);
  const olCount = $('ol').length;
  const olItems = $('ol li').length;
  const ulItems = $('ul li').length;

  if (olCount >= 2 && olItems >= 5) {
    return make('aeo-numbered-lists', 'Structured List Usage', 'pass', 'medium', `${olCount} ordered lists`, '2+ ordered lists',
      'Good use of ordered lists. AI engines extract list items for "best X" and step-based answers.', 6, 2);
  }
  if (olCount >= 1 || ulItems >= 5) {
    return make('aeo-numbered-lists', 'Structured List Usage', 'warning', 'medium', `${olCount} ordered, ${ulItems} unordered items`,
      'Add more ordered lists for procedural content', 'Lists present but could be expanded. Numbered lists boost AI extractability.', 6, 2);
  }
  return make('aeo-numbered-lists', 'Structured List Usage', 'fail', 'low', 'No structured lists', 'Add ordered/unordered lists',
    'No structured lists detected. Lists are a primary signal for AI engines when generating summaries.', 6, 2);
}

function checkDefinitionContent(bodyText: string, html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasDt = $('dl dt').length >= 2;
  const hasDefinitionPattern = /\b(is defined as|refers to|means|definition of|what is)\b/i.test(bodyText);
  const hasGlossary = /\b(glossary|terminology|key terms|definitions)\b/i.test(bodyText);

  if ((hasDt || hasGlossary) && hasDefinitionPattern) {
    return make('aeo-definition-content', 'Definition & Glossary Content', 'pass', 'medium', true, true,
      'Definition content with structured markup detected. Ideal for "what is X" AI queries.', 7, 4);
  }
  if (hasDefinitionPattern || hasDt) {
    return make('aeo-definition-content', 'Definition & Glossary Content', 'warning', 'medium', 'Definitions present, no DL markup',
      'Use <dl><dt><dd> for definitions', 'Definition patterns found but no semantic markup. Use definition lists for better AI parsing.', 7, 4);
  }
  return make('aeo-definition-content', 'Definition & Glossary Content', 'fail', 'low', false, 'Add glossary/definition sections',
    'No definition content. "What is X" queries are the most common AI search format — definitions capture them.', 7, 4);
}

function checkHowToSchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '');
  const hasHowTo = schemas.some((s) => s.includes('HowTo'));
  const hasArticle = schemas.some((s) => s.includes('Article') || s.includes('WebPage'));

  if (hasHowTo) {
    return make('aeo-howto-schema', 'HowTo Schema Markup', 'pass', 'high', 'HowTo schema present', 'HowTo schema',
      'HowTo schema implemented. Qualifies for Google rich results and AI engine procedural extraction.', 8, 3);
  }
  if (hasArticle) {
    return make('aeo-howto-schema', 'HowTo Schema Markup', 'warning', 'high', 'Article schema only', 'Add HowTo schema for instructional content',
      'Article/WebPage schema found but no HowTo. For instructional pages, HowTo schema adds significant value.', 8, 3);
  }
  return make('aeo-howto-schema', 'HowTo Schema Markup', 'fail', 'high', false, 'Add HowTo JSON-LD schema',
    'No schema markup for instructional content. HowTo schema can earn rich results and boost AI citations.', 8, 3);
}

function checkFeaturedSnippetFormat(bodyText: string, headings: Array<{ level: number; text: string }>): CheckResult {
  // Featured snippets are typically 40-60 word paragraphs that directly answer a question
  const paragraphs = bodyText.split(/\n+/).filter((p) => p.trim().length > 0);
  const snippetParagraphs = paragraphs.filter((p) => {
    const words = countWords(p);
    return words >= 40 && words <= 80;
  });
  const hasQuestionHeadings = headings.some((h) => /\?$/.test(h.text.trim()) || /^(what|how|why|when|where|which|who)\b/i.test(h.text));

  if (snippetParagraphs.length >= 2 && hasQuestionHeadings)
```

### Core Architecture Module: `src/checks/content.ts`
```
import { CheckResult, ParsedPage } from '../types';

type Cat = 'content-quality';
const CAT: Cat = 'content-quality';

function pass(id: string, name: string, expl: string, impact: number, effort: number): CheckResult {
  return { checkId: id, name, category: CAT, severity: 'low', status: 'pass',
    currentValue: null, recommendedValue: null, affectedElements: [], explanation: expl, impactScore: impact, effortScore: effort };
}
function fail(id: string, name: string, sev: CheckResult['severity'], cur: CheckResult['currentValue'],
  rec: CheckResult['recommendedValue'], aff: string[], expl: string, impact: number, effort: number): CheckResult {
  return { checkId: id, name, category: CAT, severity: sev, status: 'fail',
    currentValue: cur, recommendedValue: rec, affectedElements: aff, explanation: expl, impactScore: impact, effortScore: effort };
}
function warn(id: string, name: string, cur: CheckResult['currentValue'], rec: CheckResult['recommendedValue'],
  aff: string[], expl: string, impact: number, effort: number): CheckResult {
  return { checkId: id, name, category: CAT, severity: 'medium', status: 'warning',
    currentValue: cur, recommendedValue: rec, affectedElements: aff, explanation: expl, impactScore: impact, effortScore: effort };
}

/** Count vowel groups as a syllable approximation for Flesch-Kincaid. */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const matches = w.replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

/** Returns Flesch Reading Ease score (0-100, higher = easier). */
function fleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return 0;

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function readabilityLabel(score: number): string {
  if (score >= 80) return 'Very Easy (5th grade)';
  if (score >= 70) return 'Easy (6th grade)';
  if (score >= 60) return 'Standard (7th-8th grade)';
  if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
  if (score >= 30) return 'Difficult (college level)';
  return 'Very Difficult (professional)';
}

/** Find top N non-stop words by frequency for keyword density analysis. */
const STOP_WORDS = new Set([
  'the','and','is','in','it','of','to','a','an','that','this','was','for','on',
  'are','with','as','at','be','by','from','or','but','not','we','you','they',
  'he','she','have','had','do','did','will','would','could','should','may','can',
  'more','all','also','about','into','than','then','some','so','if','up','out',
  'its','our','your','has','been','were','their','there','which','who','when',
  'what','how','one','two','three','said','new','just','like','time','get',
]);

function keywordDensity(text: string): Array<{ word: string; count: number; density: number }> {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const total = words.length;
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (!STOP_WORDS.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .map(([word, count]) => ({ word, count, density: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function runContentChecks(parsed: ParsedPage): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. Word count
  const wc = parsed.wordCount;
  if (wc >= 600) {
    results.push(pass('word-count', 'Content Length', `${wc} words — strong content depth.`, 8, 5));
  } else if (wc >= 300) {
    results.push(warn('word-count', 'Content Length', `${wc} words`, '≥ 600 words',
      [], `Content has ${wc} words. For competitive keywords, aim for 600+ words to demonstrate topical depth and relevance.`, 8, 5));
  } else if (wc >= 100) {
    results.push(fail('word-count', 'Content Length', 'medium', `${wc} words`, '≥ 300 words minimum',
      [], `Thin content: only ${wc} words. Google's Panda algorithm targets thin content. Expand with relevant, helpful information.`, 8, 5));
  } else {
    results.push(fail('word-count', 'Content Length', 'high', `${wc} words`, '≥ 300 words minimum',
      [], `Critically thin content: only ${wc} words. This page is at risk of being considered low-quality. Add substantial, useful content.`, 8, 5));
  }

  // 2. Readability (Flesch-Kincaid)
  if (parsed.bodyText.length > 100) {
    const score = fleschReadingEase(parsed.bodyText);
    const label = readabilityLabel(score);

    if (score >= 60) {
      results.push(pass('readability', 'Content Readability', `Flesch Reading Ease: ${score}/100 — ${label}`, 6, 5));
    } else if (score >= 40) {
      results.push(warn('readability', 'Content Readability', `Score: ${score}/100 (${label})`,
        '≥ 60 (Standard readability)', [],
        `Content may be difficult to read (Flesch score: ${score}). For most web audiences, aim for a score of 60+ (7th-8th grade level). Use shorter sentences and simpler words.`, 6, 5));
    } else {
      results.push(fail('readability', 'Content Readability', 'low', `Score: ${score}/100 (${label})`,
        '≥ 60', [],
        `Very difficult content (Flesch score: ${score}). High reading difficulty increases bounce rate. Simplify language, use bullet points, and shorten paragraphs.`, 6, 5));
    }
  }

  // 3. Content freshness
  if (parsed.publishDate || parsed.modifiedDate) {
    const dateStr = parsed.modifiedDate || parsed.publishDate || '';
    const date = new Date(dateStr);
    const ageMonths = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (ageMonths < 6) {
      results.push(pass('content-freshness', 'Content Freshness',
        `Page has a recent date signal: ${dateStr}`, 6, 3));
    } else if (ageMonths < 18) {
      results.push(warn('content-freshness', 'Content Freshness',
        `Last updated: ~${Math.round(ageMonths)} months ago`, '< 6 months',
        [], `Content is ${Math.round(ageMonths)} months old. For time-sensitive topics, update content regularly to maintain freshness signals.`, 6, 3));
    } else {
      results.push(fail('content-freshness', 'Content Freshness', 'low',
        `~${Math.round(ageMonths)} months old`, '< 12 months for evergreen content',
        [], `Content appears stale (~${Math.round(ageMonths)} months old). Google favours fresh content for many query types. Review and update this page.`, 6, 3));
    }
  } else {
    results.push(warn('content-freshness', 'Content Freshness', 'No date signals found',
      'Publish/modified date in meta tags', [],
      'No date metadata detected. Add article:published_time and article:modified_time meta tags to send freshness signals to search engines.', 5, 2));
  }

  // 4. Keyword density — flag over-optimisation
  if (parsed.bodyText.length > 200) {
    const keywords = keywordDensity(parsed.bodyText);
    const overOptimised = keywords.filter((k) => k.density > 5);
    if (overOptimised.length > 0) {
      results.push(warn('keyword-density', 'Keyword Density',
        overOptimised.map((k) => `"${k.word}": ${k.density.toFixed(1)}%`).join(', '),
        '1-3% for target keyword',
        overOptimised.map((k) => `"${k.word}" used ${k.count} times (${k.density.toFixed(1)}%)`),
        `Potential keyword stuffing: ${overOptimised.map((k) => `"${k.word}" at ${k.density.toFixed(1)}%`).join(', ')}. Natural keyword density should be 1-3%. Over-use can trigger Panda penalties.`, 7, 3));
    } else {
      const topKw = keywords.slice(0, 3).map((k) => `"${k.word}" (${k.density.toFixed(1)}%)`).join(', ');
      results.push(pass('keyword-density', 'Keyword Density',
        `Natural keyword usage. Top keywords: ${topKw || 'none detected'}`, 7, 3));
    }
  }

  // 5. Duplicate title / H1 match check
  if (parsed.title && parsed.h1s.length === 1) {
    const titleNorm = parsed.title.toLowerCase().trim();
    const h1Norm = parsed.h1s[0].toLowerCase().trim();
    const similarity = titleNorm === h1Norm;
    if (similarity) {
      results.push(warn('title-h1-duplicate', 'Title vs H1 Uniqueness',
        'Title and H1 are identical', 'Distinct but related',
        [`Title: "${parsed.title}"`, `H1: "${parsed.h1s[0]}"`],
        'Title tag and H1 are identical. Consider making them distinct — the title can be more SERP-focused (with brand), and H1 more reader-focused, giving you two keyword variation opportunities.', 4, 2));
    } else {
      results.push(pass('title-h1-duplicate', 'Title vs H1 Uniqueness',
        'Title and H1 are distinct — good for keyword variation.', 4, 2));
    }
  }

  return results;
}

```

### Core Architecture Module: `src/checks/geo.ts`
```
/**
 * GEO (Geographic / Local SEO) Checks
 * 25 checks across 2 subcategories for local business optimization
 */

import * as cheerio from 'cheerio';
import { CheckResult, FetchResult, ParsedPage } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function make(
  checkId: string,
  name: string,
  status: 'pass' | 'fail' | 'warning' | 'na',
  severity: 'high' | 'medium' | 'low',
  currentValue: string | number | boolean | null,
  recommendedValue: string | number | boolean | null,
  explanation: string,
  impactScore: number,
  effortScore: number,
  affectedElements: string[] = []
): CheckResult {
  return {
    checkId,
    name,
    category: 'geo-local-seo',
    severity,
    status: status === 'na' ? 'pass' : status,  // treat N/A as pass (not applicable = no penalty)
    currentValue: status === 'na' ? 'N/A — Not applicable' : currentValue,
    recommendedValue,
    affectedElements,
    explanation,
    impactScore,
    effortScore,
  };
}

/** Detect if a site has local business indicators */
function detectLocalBusiness(html: string, bodyText: string): boolean {
  const localSignals = [
    /\b(store|shop|showroom|office|clinic|salon|restaurant|café|gym|warehouse)\b/i,
    /\b(visit us|walk in|in.store|pickup|open hours|opening hours|we are (open|located))\b/i,
    /\b(directions?|get directions|find us|our location)\b/i,
    /LocalBusiness|localBusiness|"@type"\s*:\s*"(Store|Restaurant|Hotel|Hospital|Dentist|Lawyer)/,
    /\b(near me|in [A-Z][a-z]+(,\s*[A-Z]{2})?|city|downtown|neighborhood)\b/i,
  ];
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray()
    .map((el) => $(el).html() || '').join('');

  const signalCount = localSignals.filter((p) => p.test(bodyText) || p.test(schemas)).length;
  return signalCount >= 2;
}

// ─── N/A wrapper — returns N/A result ─────────────────────────────────────────

function naResult(checkId: string, name: string): CheckResult {
  return make(checkId, name, 'na', 'low', 'N/A — No physical locations detected', 'Not applicable',
    'Not applicable — no local business signals detected. This check is for businesses with physical locations.', 0, 0);
}

// ─── Subcategory 1: Google Business Profile (15 checks) ──────────────────────

function checkLocalBusinessSchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '');
  const localTypes = ['LocalBusiness', 'Store', 'Restaurant', 'Hotel', 'Hospital', 'Dentist',
    'LegalService', 'AccountingService', 'AutomotiveBusiness', 'ChildCare'];
  const found = schemas.find((s) => localTypes.some((t) => s.includes(t)));

  if (found) {
    const type = localTypes.find((t) => found.includes(t)) || 'LocalBusiness';
    return make('geo-local-schema', 'LocalBusiness Schema Markup', 'pass', 'high', `${type} schema`, 'LocalBusiness schema',
      `${type} schema detected. Essential for Google Local Pack rankings and AI local search answers.`, 9, 3);
  }
  return make('geo-local-schema', 'LocalBusiness Schema Markup', 'fail', 'high', false, 'Add LocalBusiness JSON-LD schema',
    'No LocalBusiness schema. This is the #1 local SEO signal — without it, you won\'t appear in local AI answers.', 9, 3);
}

function checkNAPConsistency(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');

  const hasNameInSchema = schemas.includes('"name"');
  const hasAddressInSchema = schemas.includes('"address"') || schemas.includes('"streetAddress"');
  const hasPhoneInSchema = schemas.includes('"telephone"');
  const hasPhoneInBody = /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/.test(bodyText);
  const hasAddressInBody = /\d+\s+\w+\s+(street|st|avenue|ave|road|rd|blvd|drive|dr|lane|ln)\b/i.test(bodyText);

  const schemaSignals = [hasNameInSchema, hasAddressInSchema, hasPhoneInSchema].filter(Boolean).length;
  const bodySignals = [hasPhoneInBody, hasAddressInBody].filter(Boolean).length;

  if (schemaSignals >= 3 && bodySignals >= 1) {
    return make('geo-nap', 'NAP Consistency (Name/Address/Phone)', 'pass', 'high', 'NAP in schema + body', 'NAP in schema + body',
      'Name, Address, and Phone in both schema and body content. Consistent NAP is the foundation of local SEO.', 9, 4);
  }
  if (schemaSignals >= 1 || bodySignals >= 1) {
    return make('geo-nap', 'NAP Consistency (Name/Address/Phone)', 'warning', 'high',
      `${schemaSignals} schema, ${bodySignals} body signals`, 'Full NAP in schema + visible on page',
      'Partial NAP information. Ensure Name, Address, and Phone are in schema AND visible on the page.', 9, 4);
  }
  return make('geo-nap', 'NAP Consistency (Name/Address/Phone)', 'fail', 'high', false, 'Add full NAP to schema and page',
    'No NAP information detected. Name, Address, and Phone consistency is the core local SEO ranking factor.', 9, 4);
}

function checkBusinessHoursSchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasHours = schemas.includes('"openingHours"') || schemas.includes('"openingHoursSpecification"');
  const bodyText = $('body').text();
  const hasHoursInBody = /\b(mon|tue|wed|thu|fri|sat|sun|monday|hours?|open|closed)\b/i.test(bodyText) &&
    /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i.test(bodyText);

  if (hasHours) {
    return make('geo-hours-schema', 'Business Hours in Schema', 'pass', 'high', 'openingHours in schema', 'Business hours schema',
      'Business hours in schema detected. Enables "Is it open now?" answers in Google and AI engines.', 8, 3);
  }
  if (hasHoursInBody) {
    return make('geo-hours-schema', 'Business Hours in Schema', 'warning', 'high', 'Hours in body, no schema', 'Add openingHours to LocalBusiness schema',
      'Hours visible but not in schema. Add openingHoursSpecification for Google rich results.', 8, 3);
  }
  return make('geo-hours-schema', 'Business Hours in Schema', 'fail', 'high', false, 'Add openingHours to LocalBusiness schema',
    'No business hours found. Hours in schema are required for "open now" local search results.', 8, 3);
}

function checkAddressSchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasPostalAddress = schemas.includes('PostalAddress') || schemas.includes('"streetAddress"');
  if (hasPostalAddress) {
    return make('geo-address-schema', 'Structured Address (PostalAddress)', 'pass', 'high', 'PostalAddress schema', 'PostalAddress schema',
      'PostalAddress schema detected. Machine-readable addresses enable map integrations and local results.', 8, 3);
  }
  return make('geo-address-schema', 'Structured Address (PostalAddress)', 'fail', 'high', false, 'Add PostalAddress to LocalBusiness schema',
    'No PostalAddress schema. Structured address is required for Google Maps rich results.', 8, 3);
}

function checkPhoneSchema(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '').join('');
  const hasPhoneSchema = schemas.includes('"telephone"');
  const hasClickToCall = $('a[href^="tel:"]').length > 0;
  const hasPhoneInBody = /\b(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/.test(bodyText);

  if (hasPhoneSchema && hasClickToCall) {
    return make('geo-phone-schema', 'Click-to-Call Phone Number', 'pass', 'high', 'Schema + tel: link', 'Schema + click-to-call',
      'Phone in schema + click-to-call link. Mobile users can call directly — critical for local conversions.', 8, 2);
  }
  if (hasPhoneInBody || hasPhoneSchema) {
    return make('geo-phone-schema', 'Click-to-Call Phone Number', 'warning', 'high', 'Phone present, no click-to-call', 'Add tel: href + telephone schema',
      'Phone number found but missing click-to-call (tel:) link or schema. Both are needed for mobile optimization.', 8, 2);
  }
  return make('geo-phone-schema', 'Click-to-Call Phone Number', 'fail', 'high', false, 'Add tel: link + telephone in schema',
    'No phone number. Local businesses without a visible, clickable phone number lose 40%+ of mobile leads.', 8, 2);
}

function checkGoogleMapsEmbed(html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasMapEmbed = $('iframe[src*="google.com/maps"], iframe[src*="maps.google"]').length > 0;
  const hasMapLink = $('a[href*="google.com/maps"], a[href*="maps.google"]').length > 0;

  if (hasMapEmbed) {
    return make('geo-maps-embed', 'Google Maps Embed', 'pass', 'medium', 'Maps iframe embedded', 'Google Maps embed',
      'Google Maps embed detected. Maps increase local trust and reduce "how do I get there" friction.', 7, 2);
  }
  if (hasMapLink) {
    return make('geo-maps-embed', 'Google Maps Embed', 'warning', 'medium', 'Maps link present, no embed', 'Embed Google Maps iframe',
      'Link to Google Maps found but no embed. An embedded map is more trustworthy and user-friendly.', 7, 2);
  }
  return make('geo-maps-embed', 'Google Maps Embed', 'fail', 'medium', false, 'Embed Google Maps on contact/location page',
    'No Google Maps embed. Maps dramatically improve local credibility and reduce bounce from location queries.', 7, 2);
}

function checkLocationKeywords(bodyText: string, title: string | null): CheckResult {
  const cityPattern = /\b[A-Z][a-z]+(?:,\s*[A-Z]{2})?\b/;
  const locationPhrases = [/\b(in|at|near|serving|located in|based in)\s+[A-Z][a-z]+/,
    /\b[A-Z][a-z]+\s+(area|region|city|county|district|neighborhood)\b/i];
  const hasCity = cityPattern.test(bodyText) && !/(^|\s)[A-Z]{2,}(\s|$)/.test(bodyText);
  const hasPhrase = locationPhrases.some((p) => p.test(b
```

### Core Architecture Module: `src/checks/index.ts`
```
export { runTechnicalChecks } from './technical';
export { runOnPageChecks } from './on-page';
export { runContentChecks } from './content';
export { runLinkChecks } from './links';
export { runAccessibilityChecks } from './accessibility';
export { runPerformanceChecks } from './performance';
export { runAEOChecks } from './aeo';
export { runGEOChecks, calculateGEOScore } from './geo';

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

### Incident Patch 1: `cb5dbfbf` (2026-04-13)
**Commit Message**: Remove Railway deployment config

**File**: `nixpacks.toml` (removed, +0/-41)
```diff
@@ -1,41 +0,0 @@
-[phases.setup]
-nixPkgs = [
-  "nodejs_20",
-  "chromium",
-  "nss",
-  "nspr",
-  "atk",
-  "cups",
-  "libdrm",
-  "libxkbcommon",
-  "libXcomposite",
-  "libXdamage",
-  "libXfixes",
-  "libXrandr",
-  "mesa",
-  "pango",
-  "cairo",
-  "alsa-lib",
-  "expat",
-  "dbus",
-  "at-spi2-atk",
-  "at-spi2-core",
-  "glib",
-  "gtk3",
-  "xorg.libX11",
-  "xorg.libXcursor",
-  "xorg.libXext"
-]
-
-[phases.install]
-cmds = ["npm ci"]
-
-[phases.build]
-cmds = ["npm run build"]
-
-[start]
-cmd = "npm start"
-
-[variables]
-SKIP_AI = "true"
-PLAYWRIGHT_BROWSERS_PATH = "/usr/bin"
```

**File**: `package.json` (modified, +2/-5)
```diff
@@ -7,15 +7,12 @@
     "seo-audit": "dist/index.js"
   },
   "scripts": {
-    "build": "tsc && npx playwright install chromium --with-deps",
-    "start": "node dist/server.js",
+    "build": "tsc",
+    "start": "node dist/index.js",
     "dev": "ts-node src/server.ts",
     "cli": "ts-node src/index.ts",
     "audit:example": "ts-node src/index.ts --url https://example.com --skip-ai"
   },
-  "engines": {
-    "node": ">=20"
-  },
   "dependencies": {
     "@types/express": "^5.0.6",
     "axios": "^1.7.9",
```

**File**: `src/server.ts` (modified, +2/-4)
```diff
@@ -12,7 +12,7 @@ import { exportToCSV } from './export/csv-exporter';
 import { exportToHTML } from './export/html-dashboard';
 
 const app = express();
-const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
+const PORT = 3000;
 
 // ── Temp storage for reports ──────────────────────────────────────────────────
 const REPORTS_DIR = path.join(os.tmpdir(), 'seo-auditor-reports');
@@ -39,9 +39,7 @@ app.get('/', (_req: Request, res: Response) => {
 // ── SSE audit endpoint ────────────────────────────────────────────────────────
 app.get('/audit', async (req: Request, res: Response) => {
   const rawUrl  = String(req.query.url   || '').trim();
-  // On cloud deployments without Ollama, force skipAI
-  const noOllama = !process.env.OLLAMA_HOST && process.env.SKIP_AI === 'true';
-  const skipAI  = req.query.skipAI === 'true' || noOllama;
+  const skipAI  = req.query.skipAI === 'true';
   const model   = String(req.query.model || DEFAULT_OPTIONS.ollamaModel);
   const rawInd  = String(req.query.industry || 'generic');
   const industry: IndustryType = VALID_INDUSTRIES.includes(rawInd as IndustryType)
```

---

### Incident Patch 2: `7cfb748a` (2026-04-13)
**Commit Message**: Configure for Railway deployment
- PORT now reads from process.env.PORT (required by Railway)
- npm start now launches the web server (dist/server.js)
- SKIP_AI env var forces AI off when Ollama is unavailable
- nixpacks.toml: installs Chromium + system deps for Playwright PDF generation
- engines field: requires Node.js 20+

**File**: `nixpacks.toml` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+[phases.setup]
+nixPkgs = [
+  "nodejs_20",
+  "chromium",
+  "nss",
+  "nspr",
+  "atk",
+  "cups",
+  "libdrm",
+  "libxkbcommon",
+  "libXcomposite",
+  "libXdamage",
+  "libXfixes",
+  "libXrandr",
+  "mesa",
+  "pango",
+  "cairo",
+  "alsa-lib",
+  "expat",
+  "dbus",
+  "at-spi2-atk",
+  "at-spi2-core",
+  "glib",
+  "gtk3",
+  "xorg.libX11",
+  "xorg.libXcursor",
+  "xorg.libXext"
+]
+
+[phases.install]
+cmds = ["npm ci"]
+
+[phases.build]
+cmds = ["npm run build"]
+
+[start]
+cmd = "npm start"
+
+[variables]
+SKIP_AI = "true"
+PLAYWRIGHT_BROWSERS_PATH = "/usr/bin"
```

**File**: `package.json` (modified, +5/-2)
```diff
@@ -7,12 +7,15 @@
     "seo-audit": "dist/index.js"
   },
   "scripts": {
-    "build": "tsc",
-    "start": "node dist/index.js",
+    "build": "tsc && npx playwright install chromium --with-deps",
+    "start": "node dist/server.js",
     "dev": "ts-node src/server.ts",
     "cli": "ts-node src/index.ts",
     "audit:example": "ts-node src/index.ts --url https://example.com --skip-ai"
   },
+  "engines": {
+    "node": ">=20"
+  },
   "dependencies": {
     "@types/express": "^5.0.6",
     "axios": "^1.7.9",
```

**File**: `src/server.ts` (modified, +4/-2)
```diff
@@ -12,7 +12,7 @@ import { exportToCSV } from './export/csv-exporter';
 import { exportToHTML } from './export/html-dashboard';
 
 const app = express();
-const PORT = 3000;
+const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
 
 // ── Temp storage for reports ──────────────────────────────────────────────────
 const REPORTS_DIR = path.join(os.tmpdir(), 'seo-auditor-reports');
@@ -39,7 +39,9 @@ app.get('/', (_req: Request, res: Response) => {
 // ── SSE audit endpoint ────────────────────────────────────────────────────────
 app.get('/audit', async (req: Request, res: Response) => {
   const rawUrl  = String(req.query.url   || '').trim();
-  const skipAI  = req.query.skipAI === 'true';
+  // On cloud deployments without Ollama, force skipAI
+  const noOllama = !process.env.OLLAMA_HOST && process.env.SKIP_AI === 'true';
+  const skipAI  = req.query.skipAI === 'true' || noOllama;
   const model   = String(req.query.model || DEFAULT_OPTIONS.ollamaModel);
   const rawInd  = String(req.query.industry || 'generic');
   const industry: IndustryType = VALID_INDUSTRIES.includes(rawInd as IndustryType)
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
