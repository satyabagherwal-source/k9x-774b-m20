# Forensic Learning Record (Deep Inspection): Yeachan-Heo/oh-my-claudecode

> **Canonical Artifact**: `07_PROJECT_LEARNING/yeachan-heo-oh-my-claudecode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:53:03.238Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Yeachan-Heo/oh-my-claudecode`
- **Description**: Teams-first Multi-agent orchestration for Claude Code
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 39601 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/harsh-critic/fixtures/code/code-utils-clean.ts`
```
/**
 * Utility Functions
 *
 * A collection of pure, well-tested utility functions for common string,
 * date, and data transformation tasks used across the platform.
 *
 * All functions are stateless and side-effect-free unless explicitly noted.
 * All functions are fully typed and safe against null/undefined inputs.
 */

// ---------------------------------------------------------------------------
// String Utilities
// ---------------------------------------------------------------------------

/**
 * Truncate a string to a maximum length, appending an ellipsis if truncated.
 *
 * @param text     The input string to truncate
 * @param maxLen   Maximum number of characters (including the ellipsis)
 * @param ellipsis The suffix to append when truncating (default: "…")
 * @returns        The original string if within limit, or truncated version
 *
 * @example
 *   truncate("Hello, world!", 8)        // "Hello, …"
 *   truncate("Hi", 10)                  // "Hi"
 *   truncate("Hello", 5, "...")         // "He..."
 */
export function truncate(
  text: string,
  maxLen: number,
  ellipsis = '\u2026'
): string {
  if (maxLen < ellipsis.length) {
    throw new RangeError(
      `maxLen (${maxLen}) must be >= ellipsis length (${ellipsis.length})`
    );
  }
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - ellipsis.length) + ellipsis;
}

/**
 * Convert a string to slug format (URL-safe, lowercase, hyphen-separated).
 *
 * Strips diacritics, removes non-alphanumeric characters, and collapses
 * consecutive hyphens. Leading and trailing hyphens are removed.
 *
 * @param text  Input string (e.g. a page title)
 * @returns     Slug string (e.g. "my-page-title")
 *
 * @example
 *   toSlug("Hello, World!")             // "hello-world"
 *   toSlug("  Café au lait  ")         // "cafe-au-lait"
 *   toSlug("100% organic -- fresh!")   // "100-organic-fresh"
 */
export function toSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')    // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '');       // trim leading/trailing hyphens
}

/**
 * Mask a sensitive string, revealing only the last N characters.
 *
 * Useful for displaying partial email addresses or API key tails in logs
 * without exposing the full value.
 *
 * @param value     The sensitive string to mask
 * @param revealLen Number of trailing characters to reveal (default: 4)
 * @param mask      Character to use for masking (default: "*")
 * @returns         Masked string, e.g. "************abcd"
 *
 * @example
 *   maskSensitive("sk_live_abc123xyz789", 6)  // "**************xyz789"  (wait, let me recount)
 *   maskSensitive("hello@example.com")         // "****************.com" — no, 4 chars
 */
export function maskSensitive(
  value: string,
  revealLen = 4,
  mask = '*'
): string {
  if (value.length <= revealLen) return value;
  const masked = mask.repeat(value.length - revealLen);
  return masked + value.slice(value.length - revealLen);
}

// ---------------------------------------------------------------------------
// Date Utilities
// ---------------------------------------------------------------------------

/**
 * Format a Date as a human-readable relative time string ("2 hours ago",
 * "in 3 days", "just now").
 *
 * Uses the Intl.RelativeTimeFormat API with "en" locale and "long" style.
 * For durations under 60 seconds, returns "just now".
 *
 * @param date      The date to format relative to now
 * @param baseDate  The reference date (default: current time)
 * @returns         Relative time string
 *
 * @example
 *   relativeTime(new Date(Date.now() - 90_000))   // "2 minutes ago"
 *   relativeTime(new Date(Date.now() + 3_600_000)) // "in 1 hour"
 */
export function relativeTime(date: Date, baseDate: Date = new Date()): string {
  const diffMs = date.getTime() - baseDate.getTime();
  const diffSeconds = Math.round(diffMs / 1000);

  if (Math.abs(diffSeconds) < 60) return 'just now';

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'long' });

  const thresholds: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'minute'],
    [60 * 24, 'hour'],
    [24 * 7, 'day'],
    [4, 'week'],
    [12, 'month'],
    [Infinity, 'year'],
  ];

  let value = diffSeconds / 60; // start in minutes
  for (const [limit, unit] of thresholds) {
    if (Math.abs(value) < limit) {
      return rtf.format(Math.round(value), unit);
    }
    value /= limit;
  }

  // Unreachable, but satisfies TypeScript
  return rtf.format(Math.round(value), 'year');
}

/**
 * Return the start and end of the ISO calendar week containing the given date.
 *
 * ISO weeks start on Monday (day 1) and end on Sunday (day 7).
 *
 * @param date  Any date within the target week (time component is ignored)
 * @returns     Object with `start` (Monday 00:00:00) and `end` (Sunday 23:59:59.999)
 *
 * @example
 *   isoWeekBounds(new Date("2026-03-04")) // Wed → { start: Mon Mar 2, end: Sun Mar 8 }
 */
export function isoWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // ISO day of week: Mon=1 … Sun=7
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - (day - 1));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Data Transformation Utilities
// ---------------------------------------------------------------------------

/**
 * Group an array of objects by a key derived from each element.
 *
 * The key function receives each element and must return a string. Elements
 * that produce the same key are collected into the same array.
 *
 * @param items   Array of items to group
 * @param keyFn   Function that returns the group key for an item
 * @returns       A Map from group key to array of matching items
 *
 * @example
 *   groupBy(users, u => u.department)
 *   // Map { "Engineering" => [...], "Design" => [...] }
 */
export function groupBy<T>(
  items: readonly T[],
  keyFn: (item: T) => string
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = result.get(key);
    if (group) {
      group.push(item);
    } else {
      result.set(key, [item]);
    }
  }
  return result;
}

/**
 * Chunk an array into sub-arrays of at most `size` elements.
 *
 * The last chunk may be smaller than `size` if the input length is not
 * a multiple of `size`. Returns an empty array if input is empty.
 *
 * @param items  Array to chunk
 * @param size   Maximum chunk size (must be >= 1)
 * @returns      Array of chunks
 *
 * @throws {RangeError} If size < 1
 *
 * @example
 *   chunk([1, 2, 3, 4, 5], 2)  // [[1, 2], [3, 4], [5]]
 *   chunk([], 3)                // []
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) {
    throw new RangeError(`chunk size must be >= 1, got ${size}`);
  }
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size) as T[]);
  }
  return result;
}

/**
 * Deep-clone a plain JSON-serializable object.
 *
 * Uses JSON round-trip, so functions, Dates, undefined, and Symbols are
 * not preserved. For those cases, use a dedicated clone library.
 *
 * @param value  A JSON-serializable value
 * @returns      A structurally identical deep copy
 *
 * @example
 *   const original = { a: { b: 1 } };
 *   const copy = deepClone(original);
 *   copy.a.b = 99;
 *   original.a.b; // still 1
 */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

```

### Core Architecture Module: `benchmarks/harsh-critic/scoring/scorer.ts`
```
/**
 * Scorer for matching parsed agent output against ground truth and computing
 * benchmark metrics.
 */

import type {
  BenchmarkScores,
  FixtureResult,
  GroundTruth,
  GroundTruthFinding,
  ParsedAgentOutput,
  ParsedFinding,
  Severity,
} from './types.js';
import {
  ALLOW_ADJACENT_SEVERITY,
  MIN_KEYWORD_MATCHES,
  SCORING_WEIGHTS,
} from './types.js';

// ============================================================
// Types
// ============================================================

export interface MatchResult {
  /** Ground truth finding IDs that were matched */
  matchedIds: string[];
  /** Ground truth finding IDs that were missed */
  missedIds: string[];
  /** Agent finding texts that didn't match any ground truth */
  spuriousTexts: string[];
  /** Total agent findings considered */
  totalAgentFindings: number;
}

// ============================================================
// Severity adjacency helpers
// ============================================================

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'MAJOR', 'MINOR'];

function severityDistance(a: Severity, b: Severity): number {
  return Math.abs(SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b));
}

function severityMatches(agentSeverity: Severity, gtSeverity: Severity): boolean {
  const dist = severityDistance(agentSeverity, gtSeverity);
  return ALLOW_ADJACENT_SEVERITY ? dist <= 1 : dist === 0;
}

// ============================================================
// Keyword matching
// ============================================================

function normalizeTextForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[`*_#()[\]{}<>"'.,;!?|\\]/g, ' ')
    .replace(/[-/:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function keywordMatchesText(text: string, keyword: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  if (lowerText.includes(lowerKeyword)) {
    return true;
  }

  const normalizedText = normalizeTextForMatch(text);
  const normalizedKeyword = normalizeTextForMatch(keyword);
  if (!normalizedKeyword) return false;

  if (normalizedText.includes(normalizedKeyword)) {
    return true;
  }

  const keywordParts = normalizedKeyword.split(' ').filter(Boolean);
  if (keywordParts.length <= 1) return false;

  // Phrase fallback: all phrase tokens present, order-independent.
  return keywordParts.every((part) => normalizedText.includes(part));
}

function countKeywordMatches(text: string, keywords: string[]): number {
  return keywords.filter((kw) => keywordMatchesText(text, kw)).length;
}

function requiredKeywordMatches(keywords: string[]): number {
  if (keywords.length === 0) return 0;

  // Scale with keyword set size to reduce accidental matches on larger sets:
  // 4/5 keywords -> 2 required, 6 keywords -> 3 required.
  const proportional = Math.ceil(keywords.length * 0.4);
  return Math.min(
    keywords.length,
    Math.max(MIN_KEYWORD_MATCHES, proportional),
  );
}

function textMatchesGroundTruth(text: string, gt: GroundTruthFinding): boolean {
  return countKeywordMatches(text, gt.keywords) >= requiredKeywordMatches(gt.keywords);
}

// ============================================================
// Flat agent finding list
// ============================================================

interface FlatFinding {
  text: string;
  severity: Severity;
  hasEvidence: boolean;
}

function flattenAgentFindings(parsed: ParsedAgentOutput): FlatFinding[] {
  const findings: FlatFinding[] = [];

  for (const f of parsed.criticalFindings) {
    findings.push({ text: f.text, severity: f.severity, hasEvidence: f.hasEvidence });
  }
  for (const f of parsed.majorFindings) {
    findings.push({ text: f.text, severity: f.severity, hasEvidence: f.hasEvidence });
  }
  for (const f of parsed.minorFindings) {
    findings.push({ text: f.text, severity: f.severity, hasEvidence: f.hasEvidence });
  }

  // missingItems and perspective notes are plain strings; treat as MINOR evidence-less
  for (const text of parsed.missingItems) {
    findings.push({ text, severity: 'MINOR', hasEvidence: false });
  }
  for (const text of [
    ...parsed.perspectiveNotes.security,
    ...parsed.perspectiveNotes.newHire,
    ...parsed.perspectiveNotes.ops,
  ]) {
    findings.push({ text, severity: 'MINOR', hasEvidence: false });
  }

  return findings;
}

// ============================================================
// Public: matchFindings
// ============================================================

/**
 * Match agent findings to ground truth findings using keyword overlap.
 * Each ground truth finding can be matched at most once (greedy first-match).
 */
export function matchFindings(
  parsed: ParsedAgentOutput,
  groundTruth: GroundTruth,
): MatchResult {
  const agentFindings = flattenAgentFindings(parsed);
  const matchedIds = new Set<string>();
  const matchedAgentIndices = new Set<number>();

  for (const gt of groundTruth.findings) {
    for (let i = 0; i < agentFindings.length; i++) {
      if (matchedAgentIndices.has(i)) continue;
      const af = agentFindings[i];
      if (textMatchesGroundTruth(af.text, gt)) {
        matchedIds.add(gt.id);
        matchedAgentIndices.add(i);
        break; // greedy first-match; move to next GT finding
      }
    }
  }

  const missedIds = groundTruth.findings
    .filter((gt) => !matchedIds.has(gt.id))
    .map((gt) => gt.id);

  const spuriousTexts = agentFindings
    .filter((_, i) => !matchedAgentIndices.has(i))
    .map((f) => f.text);

  return {
    matchedIds: Array.from(matchedIds),
    missedIds,
    spuriousTexts,
    totalAgentFindings: agentFindings.length,
  };
}

// ============================================================
// Severity accuracy helper
// ============================================================

/**
 * For each matched ground truth finding, check whether the agent's severity
 * for its matched finding aligns (exact or adjacent).
 */
function computeSeverityAccuracy(
  parsed: ParsedAgentOutput,
  groundTruth: GroundTruth,
  matchedIds: string[],
): number {
  if (matchedIds.length === 0) return 0;

  // Build a lookup from GT id -> GT severity
  const gtSeverityMap = new Map<string, Severity>(
    groundTruth.findings.map((gt) => [gt.id, gt.severity]),
  );

  // Collect all ParsedFindings with their severity (index-tracked to avoid reuse)
  const allParsed: ParsedFinding[] = [
    ...parsed.criticalFindings,
    ...parsed.majorFindings,
    ...parsed.minorFindings,
  ];

  const usedAgentIndices = new Set<number>();
  let correct = 0;

  for (const gtId of matchedIds) {
    const gtSeverity = gtSeverityMap.get(gtId);
    if (!gtSeverity) continue;

    const gt = groundTruth.findings.find((f) => f.id === gtId);
    if (!gt) continue;

    // Find the first unused agent finding that keyword-matches this GT entry
    let matchIdx = -1;
    for (let i = 0; i < allParsed.length; i++) {
      if (usedAgentIndices.has(i)) continue;
      if (countKeywordMatches(allParsed[i].text, gt.keywords) >= requiredKeywordMatches(gt.keywords)) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx !== -1) {
      usedAgentIndices.add(matchIdx);
      if (severityMatches(allParsed[matchIdx].severity, gtSeverity)) {
        correct++;
      }
    }
  }

  return correct / matchedIds.length;
}

// ============================================================
// Subset helpers
// ============================================================

function findingsForCategory(
  groundTruth: GroundTruth,
  category: GroundTruthFinding['category'],
): GroundTruthFinding[] {
  return groundTruth.findings.filter((f) => f.category === category);
}

/**
 * Count how many of the given GT IDs overlap with the given set.
 */
function countOverlap(ids: string[], matchedIds: string[]): number {
  const matched = new Set(matchedIds);
  return ids.filter((id) => matched.has(id)).length;
}

// ============================================================
// Evidence rate
// ============================================================

function computeEvidenceRate(parsed: ParsedAgentOutput): number {
  const highSeverity: ParsedFinding[] = [
    ...parsed.criticalFindings,
    ...parsed.majorFindings,
  ];
  if (highSeverity.length === 0) return 0;
  const withEvidence = highSeverity.filter((f) => f.hasEvidence).length;
  return withEvidence / highSeverity.length;
}

// ============================================================
// Composite score
// ============================================================

function computeComposite(scores: Omit<BenchmarkScores, 'compositeScore'>): number {
  const w = SCORING_WEIGHTS;

  const processComplianceScore =
    [scores.hasPreCommitment, scores.hasMultiPerspective, scores.hasGapAnalysis].filter(
      Boolean,
    ).length / 3;

  return (
    w.truePositiveRate * scores.truePositiveRate +
    w.falseNegativeRate * (1 - scores.falseNegativeRate) +
    w.falsePositiveRate * (1 - scores.falsePositiveRate) +
    w.missingCoverage * scores.missingCoverage +
    w.perspectiveCoverage * scores.perspectiveCoverage +
    w.evidenceRate * scores.evidenceRate +
    w.processCompliance * processComplianceScore
  );
}

// ============================================================
// Public: scoreFixture
// ============================================================

/**
 * Compute all 7 benchmark metrics plus composite score for one agent/fixture pair.
 */
export function scoreFixture(
  parsed: ParsedAgentOutput,
  groundTruth: GroundTruth,
): BenchmarkScores {
  const matchResult = matchFindings(parsed, groundTruth);
  const { matchedIds, missedIds, spuriousTexts, totalAgentFindings } = matchResult;

  const totalGt = groundTruth.findings.length;

  // Core detection
  const truePositiveRate = totalGt > 0 ? matchedIds.length / totalGt : 0;
  const falseNegativeRate = totalGt > 0 ? missedIds.length / totalGt : 0;
```

### Core Architecture Module: `benchmarks/shared/scorer.ts`
```
import {
  aggregateScores as aggregateCanonicalScores,
  matchFindings as matchCanonicalFindings,
  scoreFixture as scoreCanonicalFixture,
} from "../harsh-critic/scoring/scorer.ts";
import type {
  AgentType as CanonicalAgentType,
  Domain as CanonicalDomain,
  FixtureResult as CanonicalFixtureResult,
  GroundTruth as CanonicalGroundTruth,
  HarshCriticVerdict,
} from "../harsh-critic/scoring/types.ts";
import type {
  BenchmarkScores,
  CompletedFixtureResult,
  Domain,
  FixtureResult,
  GroundTruth,
  GroundTruthFinding,
  ParsedAgentOutput,
} from "./types.ts";

const CANONICAL_DOMAIN_PROJECTION: Record<Domain, CanonicalDomain> = {
  plan: "plan",
  code: "code",
  analysis: "analysis",
  bug: "analysis",
  task: "analysis",
};

function canonicalVerdict(value: string | undefined): HarshCriticVerdict {
  return value === "REJECT" ||
    value === "REVISE" ||
    value === "ACCEPT" ||
    value === "ACCEPT-WITH-RESERVATIONS"
    ? value
    : "REJECT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDomain(value: unknown): value is Domain {
  return (
    value === "plan" ||
    value === "code" ||
    value === "analysis" ||
    value === "bug" ||
    value === "task"
  );
}

function validateFinding(value: unknown, index: number): GroundTruthFinding {
  if (!isRecord(value))
    throw new Error(`Ground truth finding ${index} must be an object`);
  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new Error(`Ground truth finding ${index} has no id`);
  }
  if (
    !Array.isArray(value.keywords) ||
    value.keywords.some((keyword) => typeof keyword !== "string")
  ) {
    throw new Error(`Ground truth finding ${index} has invalid keywords`);
  }
  if (value.keywords.length === 0) {
    throw new Error(
      `Ground truth finding ${index} must have at least one keyword`,
    );
  }
  const severity = value.severity;
  if (severity !== "CRITICAL" && severity !== "MAJOR" && severity !== "MINOR") {
    throw new Error(`Ground truth finding ${index} has invalid severity`);
  }
  const category = value.category;
  if (
    category !== "finding" &&
    category !== "missing" &&
    category !== "perspective"
  ) {
    throw new Error(`Ground truth finding ${index} has invalid category`);
  }
  const perspective = value.perspective;
  if (
    perspective !== undefined &&
    perspective !== "security" &&
    perspective !== "new-hire" &&
    perspective !== "ops"
  ) {
    throw new Error(`Ground truth finding ${index} has invalid perspective`);
  }
  if (
    typeof value.summary !== "string" ||
    typeof value.explanation !== "string"
  ) {
    throw new Error(`Ground truth finding ${index} has invalid text fields`);
  }
  if (value.location !== undefined && typeof value.location !== "string") {
    throw new Error(`Ground truth finding ${index} has invalid location`);
  }
  return {
    id: value.id,
    severity,
    category,
    perspective,
    summary: value.summary,
    keywords: value.keywords.map((keyword) => String(keyword)),
    location: value.location,
    explanation: value.explanation,
  };
}

export function validateSharedGroundTruth(value: unknown): GroundTruth {
  if (!isRecord(value)) throw new Error("Ground truth must be an object");
  if (typeof value.fixtureId !== "string" || value.fixtureId.length === 0) {
    throw new Error("Ground truth fixtureId is required");
  }
  if (typeof value.fixturePath !== "string" || value.fixturePath.length === 0) {
    throw new Error("Ground truth fixturePath is required");
  }
  if (!isDomain(value.domain))
    throw new Error(`Unsupported ground truth domain: ${String(value.domain)}`);
  if (!Array.isArray(value.findings))
    throw new Error("Ground truth findings must be an array");
  if (typeof value.isCleanBaseline !== "boolean") {
    throw new Error("Ground truth isCleanBaseline must be boolean");
  }
  const findings = value.findings.map(validateFinding);
  const findingIds = new Set<string>();
  for (const finding of findings) {
    if (findingIds.has(finding.id)) {
      throw new Error(`Duplicate ground truth finding id: ${finding.id}`);
    }
    findingIds.add(finding.id);
  }
  return {
    fixtureId: value.fixtureId,
    fixturePath: value.fixturePath,
    domain: value.domain,
    expectedVerdict:
      typeof value.expectedVerdict === "string"
        ? value.expectedVerdict
        : undefined,
    findings,
    isCleanBaseline: value.isCleanBaseline,
  };
}

export function normalizeForSharedScoring(
  groundTruth: GroundTruth,
): CanonicalGroundTruth {
  const validated = validateSharedGroundTruth(groundTruth);
  return {
    fixtureId: validated.fixtureId,
    fixturePath: validated.fixturePath,
    domain: CANONICAL_DOMAIN_PROJECTION[validated.domain],
    // The canonical scorer does not read this field. Keep non-canonical placeholders private.
    expectedVerdict: canonicalVerdict(validated.expectedVerdict),
    findings: validated.findings.map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      category: finding.category,
      perspective: finding.perspective,
      summary: finding.summary,
      keywords: [...finding.keywords],
      location: finding.location,
      explanation: finding.explanation,
    })),
    isCleanBaseline: validated.isCleanBaseline,
  };
}

export function scoreFixtureShared(
  parsedOutput: ParsedAgentOutput,
  groundTruth: GroundTruth,
): BenchmarkScores {
  return scoreCanonicalFixture(
    parsedOutput,
    normalizeForSharedScoring(groundTruth),
  );
}

export function matchFindingsShared(
  parsedOutput: ParsedAgentOutput,
  groundTruth: GroundTruth,
): { matchedIds: string[]; missedIds: string[]; spuriousTexts: string[] } {
  const result = matchCanonicalFindings(
    parsedOutput,
    normalizeForSharedScoring(groundTruth),
  );
  return {
    matchedIds: result.matchedIds,
    missedIds: result.missedIds,
    spuriousTexts: result.spuriousTexts,
  };
}

function toCanonicalResult(
  result: CompletedFixtureResult,
): CanonicalFixtureResult {
  return {
    fixtureId: result.fixtureId,
    domain: CANONICAL_DOMAIN_PROJECTION[result.domain],
    agentType: "critic" satisfies CanonicalAgentType,
    parsedOutput: result.parsedOutput,
    scores: result.scores,
    matchedFindings: [...result.matchedFindings],
    missedFindings: [...result.missedFindings],
    spuriousFindings: [...result.spuriousFindings],
  };
}

export function aggregateScoresUnknownCapable(
  results: FixtureResult[],
): BenchmarkScores | null {
  const completed = results.filter(
    (result): result is CompletedFixtureResult =>
      result.completion === "completed",
  );
  if (completed.length === 0) return null;
  return aggregateCanonicalScores(completed.map(toCanonicalResult));
}

```

### Core Architecture Module: `scripts/dev/repro-state-lock.mjs`
```
// Repro for issue #4146: mutual exclusion of the owner-file fallback in
// scripts/lib/state-lock.mjs (owner releases/exits during a reclaimer's liveness
// probe; the reclaimer must not quarantine a live replacement owner).
//
// Usage (from any cwd):  node scripts/dev/repro-state-lock.mjs [procs=8] [iterations=15]
//
// Spawns `procs` worker processes that each acquire/increment/release a shared
// counter `iterations` times. Children run with NODE_ENV=test
// OMC_TEST_FLOCK_AVAILABLE=0 to force the owner-file fallback (the same path
// taken when better-sqlite3 cannot load). Prints acquisitions vs. counter,
// overlaps, release/acquire failures, and a final RESULT line
// (OK | MUTUAL EXCLUSION VIOLATED | LOCK STRANDED).
//
// Worker mode (used internally and by tests/integration/state-lock-owner-reclaim.test.ts):
//   node scripts/dev/repro-state-lock.mjs worker <target> <iterations> <log>
import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , role, ...args] = process.argv;

if (role === 'worker') {
  const lib = await import('../lib/state-lock.mjs');
  const [target, iterations, log] = args;
  const inside = `${target}.inside`; // created O_EXCL inside the critical section
  const deadline = Date.now() + 60_000; // keep the run bounded if a lock gets stranded
  for (let i = 0; i < Number(iterations) && Date.now() < deadline; i++) {
    const lock = lib.acquireStateFileLockSync(target, 50);
    if (!lock) {
      const message = lib.getStateFileLockFailureMessage();
      appendFileSync(log, `${process.pid} acquire-failed: ${/contention/.test(message) ? 'contention' : /could not be verified/.test(message) ? 'unverifiable' : message}\n`);
      continue;
    }
    let marker = true;
    try { closeSync(openSync(inside, 'wx')); } catch { marker = false; appendFileSync(log, `${process.pid} OVERLAP: another process is inside the critical section\n`); }
    const n = Number(readFileSync(target, 'utf8'));
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5); // hold the lock ~5 ms
    writeFileSync(target, String(n + 1));
    if (marker) unlinkSync(inside);
    appendFileSync(log, `${process.pid} acquired\n`);
    if (!lib.releaseStateFileLockSync(lock)) appendFileSync(log, `${process.pid} release-failed: ${lib.getStateFileLockFailureMessage()}\n`);
  }
} else {
  const procs = Number(role || 8), iterations = Number(args[0] || 15);
  const dir = mkdtempSync(join(tmpdir(), 'omc-lock-repro-'));
  mkdirSync(join(dir, 'state'));
  const target = join(dir, 'state', 'counter.json');
  const log = join(dir, 'log.txt');
  writeFileSync(target, '0'); writeFileSync(log, '');
  // Force the owner-file fallback (same path taken when better-sqlite3 cannot load).
  const env = { ...process.env, NODE_ENV: 'test', OMC_TEST_FLOCK_AVAILABLE: '0' };
  const t0 = Date.now();
  await Promise.all(Array.from({ length: procs }, () => new Promise(resolve =>
    spawn(process.execPath, [fileURLToPath(import.meta.url), 'worker', target, String(iterations), log], { env, stdio: 'inherit' }).on('exit', resolve))));
  const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  const count = re => lines.filter(l => re.test(l)).length;
  const acquired = count(/ acquired$/), counter = Number(readFileSync(target, 'utf8'));
  console.log(`platform=${process.platform} node=${process.version} procs=${procs} iterations=${iterations} elapsed=${Date.now() - t0}ms`);
  console.log(`acquisitions=${acquired} counter=${counter} lostUpdates=${acquired - counter} overlaps=${count(/OVERLAP/)} releaseFailures=${count(/release-failed/)} acquireFailures=${count(/acquire-failed/)}`);
  const stranded = existsSync(`${target}.mutation.lock`);
  if (stranded) console.log(`lock file still present after all workers exited:${readFileSync(`${target}.mutation.lock`, 'utf8')}`);
  for (const l of [...new Set(lines.filter(l => !/ acquired$/.test(l)).map(l => l.replace(/^\d+ /, '')))].slice(0, 6)) console.log(`  ${l}`);
  const violated = acquired !== counter || count(/OVERLAP/) > 0;
  console.log(`RESULT: ${violated ? 'MUTUAL EXCLUSION VIOLATED' : stranded ? 'LOCK STRANDED' : 'OK'}`);
}

```

### Core Architecture Module: `scripts/lib/hook-command-normalizer.mjs`
```
// Hook commands use the braced `${CLAUDE_PLUGIN_ROOT}` form.
//
// Claude Code substitutes the braced placeholder itself before handing the
// command to a shell. The bare `$CLAUDE_PLUGIN_ROOT` form instead relies on the
// shell expanding an environment variable, which only holds where a POSIX shell
// actually runs the command. The Windows prefix invokes `node` directly with no
// `sh` in front of it, so there the bare form is never expanded from the
// environment and the plugin root resolves to nothing — `node` then tries to
// load `<drive>:\scripts\run.cjs` and the CJS loader fails at session start.
//
// Under `sh` both forms expand identically, so the braced form is a no-op on
// Unix/macOS and the only form that can work on native Windows.
export const WINDOWS_HOOK_PREFIX = 'node "${CLAUDE_PLUGIN_ROOT}"/scripts/run.cjs ';
export const UNIX_HOOK_PREFIX = 'sh "${CLAUDE_PLUGIN_ROOT}"/scripts/find-node.sh "${CLAUDE_PLUGIN_ROOT}"/scripts/run.cjs ';

export function hookPrefixForPlatform(platform = process.platform) {
  return platform === 'win32' ? WINDOWS_HOOK_PREFIX : UNIX_HOOK_PREFIX;
}

export function normalizeHookCommand(command, prefix = hookPrefixForPlatform()) {
  // Both the bare and braced spellings are accepted on input so that manifests
  // written by any earlier version are repaired rather than left alone; every
  // branch emits the braced form.
  const root = String.raw`(?:\$\{CLAUDE_PLUGIN_ROOT\}|\$CLAUDE_PLUGIN_ROOT)`;

  const legacyFindNodePattern = new RegExp(
    String.raw`^sh "${root}\/scripts\/find-node\.sh" "${root}\/scripts\/([^"\s]+)"?(.*)$`,
  );
  const currentFindNodePattern = new RegExp(
    String.raw`^(?:"\/bin\/sh"|sh) "${root}"\/scripts\/find-node\.sh "${root}"\/scripts\/run\.cjs "${root}"\/scripts\/([^"\s]+)"?(.*)$`,
  );
  const directRunCjsPattern = new RegExp(
    String.raw`^node\s+"${root}"\/scripts\/run\.cjs\s+"${root}"\/scripts\/([^"\s]+)"?(.*)$`,
  );
  const absoluteNodeRunCjsPattern = new RegExp(
    String.raw`^"([^"]*\/node|[A-Za-z]:\\[^"]*\\node(?:\.exe)?)"\s+"${root}"\/scripts\/run\.cjs\s+"${root}"\/scripts\/([^"\s]+)"?(.*)$`,
  );

  const match = command.match(currentFindNodePattern)
    ?? command.match(legacyFindNodePattern)
    ?? command.match(directRunCjsPattern);
  if (match) return `${prefix}"\${CLAUDE_PLUGIN_ROOT}"/scripts/${match[1]}${match[2]}`;

  const absNodeMatch = command.match(absoluteNodeRunCjsPattern);
  if (absNodeMatch) return `${prefix}"\${CLAUDE_PLUGIN_ROOT}"/scripts/${absNodeMatch[2]}${absNodeMatch[3]}`;

  return command;
}

export function normalizeHooksDataForPlatform(data, platform = process.platform) {
  const prefix = hookPrefixForPlatform(platform);
  let patched = false;

  for (const groups of Object.values(data?.hooks ?? {})) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!group || typeof group !== 'object' || !Array.isArray(group.hooks)) continue;
      for (const hook of group.hooks) {
        if (!hook || typeof hook !== 'object' || typeof hook.command !== 'string') continue;
        const nextCommand = normalizeHookCommand(hook.command, prefix);
        if (hook.command !== nextCommand) {
          hook.command = nextCommand;
          patched = true;
        }
      }
    }
  }

  return patched;
}

```

### Core Architecture Module: `scripts/lib/state-lock.mjs`
```
import { closeSync, fstatSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SQLITE_NATIVE_BINDING = 'better_sqlite3.node';
const SQLITE_NATIVE_BINDING_REMEDIATION =
  'Run `npm rebuild better-sqlite3` in the OMC plugin directory, then restart Claude Code.';
let Database = null;
let sqliteBindingLoadError = null;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function nativeBindingDiagnostic(detail) {
  const normalizedDetail = detail?.split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').trim().slice(0, 240);
  const suffix = normalizedDetail ? ` Loader error: ${normalizedDetail}` : '';
  return `better-sqlite3 native binding (${SQLITE_NATIVE_BINDING}) is unavailable. State mutation is using the file-lock fallback. ${SQLITE_NATIVE_BINDING_REMEDIATION}${suffix}`;
}

function isNativeBindingError(error) {
  return /better[_-]sqlite3(?:\.node)?|bindings(?:\.js)?|MODULE_NOT_FOUND|NODE_MODULE_VERSION|did not self-register|Could not locate the bindings file/i.test(errorMessage(error));
}

try {
  const loaded = require('better-sqlite3');
  const candidate = typeof loaded === 'function' ? loaded : loaded?.default;
  if (typeof candidate !== 'function') throw new Error('better-sqlite3 did not export a Database constructor');
  Database = candidate;
} catch (error) {
  sqliteBindingLoadError = nativeBindingDiagnostic(errorMessage(error));
}

const localLocks = new Map();
const recoveryLocks = new Map();
let ownIdentityCache = null;
let lastLockFailure = null;
let lastLockFailureDetail = null;

function ownProcessStartIdentity() {
  if (ownIdentityCache === null) ownIdentityCache = processStartIdentity(process.pid);
  return ownIdentityCache;
}

function writeAllSync(fd, content, label) {
  const bytes = Buffer.from(content, 'utf8');
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(fd, bytes, offset, bytes.length - offset);
    if (!Number.isInteger(written) || written <= 0) throw new Error(`${label} made no progress`);
    offset += written;
  }
  if (fstatSync(fd).size !== bytes.length) throw new Error(`${label} size verification failed`);
}

export function processStartIdentity(pid) {
  if (process.env.NODE_ENV === 'test' && process.env.OMC_TEST_EMERGENCY_PROCESS_START_UNKNOWN_PID === String(pid)) return null;
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  if (process.platform === 'linux') {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const end = stat.lastIndexOf(')');
      const fields = end < 0 ? [] : stat.slice(end + 2).trim().split(/\s+/);
      return fields[19] && /^\d+$/.test(fields[19]) ? fields[19] : null;
    } catch (error) {
      return error?.code === 'ENOENT' ? 'absent' : null;
    }
  }
  if (process.platform === 'darwin') {
    try {
      const result = spawnSync('ps', ['-p', String(pid), '-o', 'lstart='], {
        encoding: 'utf8', timeout: 2000, env: { ...process.env, LC_ALL: 'C' },
      });
      if (result.status === 0 && result.stdout) {
        const time = new Date(result.stdout.trim()).getTime();
        if (!Number.isNaN(time)) return String(time);
      }
    } catch {}
  }
  if (process.platform === 'win32') {
    try {
      const result = spawnSync('powershell', [
        '-NoProfile', '-NonInteractive', '-Command',
        `$p = Get-Process -Id ${pid} -ErrorAction Stop; if ($p -and $p.StartTime) { $p.StartTime.ToUniversalTime().Ticks }`,
      ], { encoding: 'utf8', timeout: 3000, windowsHide: true });
      const ticks = result.status === 0 ? result.stdout.trim().match(/^\d+$/)?.[0] : null;
      if (ticks) return `ticks:${ticks}`;
    } catch {}
  }
  try {
    process.kill(pid, 0);
    return null;
  } catch (error) {
    return error?.code === 'ESRCH' ? 'absent' : null;
  }
}

function mutationDbPath(lockPath) {
  let current = dirname(lockPath);
  while (basename(current) !== 'state') {
    const parent = dirname(current);
    if (parent === current) return join(dirname(lockPath), '.state-mutation-locks.db');
    current = parent;
  }
  return join(current, '.state-mutation-locks.db');
}

function canonicalKey(lockPath) {
  try { return resolve(realpathSync(dirname(lockPath)), basename(lockPath)); }
  catch { return resolve(lockPath); }
}

function stateFileLockingTestOverride() {
  if (process.env.NODE_ENV !== 'test') return null;
  return process.env.OMC_TEST_FLOCK_AVAILABLE === '0' || process.env.OMC_TEST_BETTER_SQLITE3_LOAD_FAILURE === '1'
    ? false
    : null;
}

function readOwner(path) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    const pid = value.pid;
    if (
      value.version !== 1 || !Number.isSafeInteger(pid) || pid <= 0 ||
      typeof value.processStart !== 'string' || !/^\S+$/.test(value.processStart) ||
      typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
      typeof value.nonce !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.nonce)
    ) return null;
    return value;
  } catch (error) {
    return error?.code === 'ENOENT' ? 'absent' : null;
  }
}

function ownerLive(owner) {
  const current = processStartIdentity(owner.pid);
  return current === null ? null : current === 'absent' ? false : current === owner.processStart;
}

function sameOwner(left, right) {
  return Boolean(left && right && left.pid === right.pid && left.processStart === right.processStart && left.nonce === right.nonce);
}

// BigInt ids: NTFS file IDs exceed 2^53 once the MFT sequence number reaches
// 32, and a Number ino rounds distinct files onto the same value.
function ownerArtifactIdentity(path) {
  try {
    const stats = statSync(path, { bigint: true });
    return stats.isFile() ? { dev: stats.dev, ino: stats.ino } : null;
  } catch {
    return null;
  }
}

/** Mirrors sameFileIdentity in src/lib/atomic-write.ts: ino always, dev unless win32 reports 0 (#4156). */
function sameArtifactIdentity(a, b) {
  if (a.ino !== b.ino) return false;
  if (process.platform === 'win32' && (a.dev === 0n || b.dev === 0n)) return true;
  return a.dev === b.dev;
}

/** Remove only the exact dead publication that was inspected. */
function reclaimDeadOwner(path, observed, identity) {
  const quarantinePath = `${path}.reclaim.${process.pid}.${randomUUID()}`;
  // The liveness verdict can be seconds old (the win32 probe spawns PowerShell),
  // and the identity alone cannot tell a replacement apart when its inode reuses
  // the old one (or when the identity was captured after the probe). Renaming a
  // live replacement into quarantine opens a window in which a third contender
  // publishes, leaving two holders. Re-verify the exact artifact, owner record
  // AND file identity, immediately before the rename. Bracketing the read with
  // two stats binds the record that was read to the identity that was checked.
  const before = ownerArtifactIdentity(path);
  const current = readOwner(path);
  const after = ownerArtifactIdentity(path);
  if (current === 'absent' || !current || !sameOwner(current, observed) ||
      !before || !after || !sameArtifactIdentity(before, identity) || !sameArtifactIdentity(after, identity)) {
    return 'changed';
  }
  try {
    renameSync(path, quarantinePath);
  } catch (error) {
    return error?.code === 'ENOENT' ? 'changed' : 'failed';
  }

  let moved = null;
  let movedIdentity = null;
  try {
    moved = readOwner(quarantinePath);
    movedIdentity = ownerArtifactIdentity(quarantinePath);
    if (moved !== 'absent' && moved && movedIdentity &&
        sameArtifactIdentity(movedIdentity, identity) &&
        sameOwner(moved, observed)) {
      try {
        unlinkSync(quarantinePath);
        return 'removed';
      } catch {}
    }
  } catch {}

  // A replacement owner must survive. Restore the moved artifact only when no
  // newer publication has already claimed the final pathname.
  try {
    linkSync(quarantinePath, path);
    try { unlinkSync(quarantinePath); } catch {}
  } catch {}
  return 'changed';
}

function publishOwner(path, owner) {
  const tempPath = `${path}.${owner.pid}.${owner.nonce}.tmp`;
  let fd;
  try {
    mkdirSync(dirname(path), { recursive: true });
    fd = openSync(tempPath, 'wx', 0o600);
    writeAllSync(fd, JSON.stringify(owner), 'lock owner publication');
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    linkSync(tempPath, path);
    try {
      unlinkSync(tempPath);
    } catch (error) {
      const code = error?.code;
      if (code !== 'EPERM' && code !== 'EBUSY') throw error;
    }
    return true;
  } catch {
    try { if (fd !== undefined) closeSync(fd); } catch {}
    try { unlinkSync(tempPath); } catch {}
    return false;
  }
}

function openMutationDb(lockPath, bypassTestOverride = false) {
  // The flock simulation describes a host without the external flock binary,
  // not a host without SQLite. A caller that explicitly opts out of the
  // simulation (the emergency recovery claim) must still get the SQLite
  // backend, otherwise it retries into an 'unverifiable' failure and recovery
  // reports false with a perfectly healthy binding.
  if ((!bypassTestOverride && stateFileLockingTestOverride() === false) || !Database) return null;
  let db = null;
  try {
    const dbPath = mutationDbPath(lockPath);
    for (const sidecar of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`]) {
      try {
        const stats = statSync(sidecar);
        if (!stats.isFile() || stats.nlink !== 1) return null;
      } catch (error) {
        if (error?.code !== 'ENOENT') return null;
      }
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 2000');
    db.exec('C
```

### Core Architecture Module: `scripts/lib/state-root.mjs`
```
// Thin delegator → src/lib/worktree-paths.ts::resolveSessionStatePaths. DO NOT reimplement here.

/**
 * State Root Resolver (ESM)
 *
 * Single authoritative entry point for resolving the .omc root directory in
 * hook scripts, respecting the OMC_STATE_DIR environment variable.
 *
 * Delegates to getOmcRoot() from dist/lib/worktree-paths.js (the canonical
 * implementation) when CLAUDE_PLUGIN_ROOT is available. Falls back to inline
 * logic when dist is not built — this should never happen in production, but
 * provides a safe fallback during development or first-run scenarios.
 *
 * Inline fallback notes:
 *   - Uses directory path as hash source (not git remote URL). Matches
 *     canonical behavior for local-only repos; may differ for remote-backed
 *     repos when dist is missing — acceptable since dist is always present
 *     in production (CLAUDE_PLUGIN_ROOT is always set).
 */

import { join, basename, dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { homedir } from 'os';
import { pathToFileURL } from 'url';

function findWorkspaceRoot(directory) {
  if (process.env.OMC_DISABLE_MULTIREPO === '1') return null;
  const home = resolve(homedir());
  let cursor = resolve(directory);
  while (true) {
    if (cursor === home) return null;
    if (existsSync(join(cursor, '.omc-workspace'))) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
}

function workspaceIdentifier(workspaceRoot) {
  try {
    const config = JSON.parse(readFileSync(join(workspaceRoot, '.omc-workspace'), 'utf8'));
    if (typeof config.id === 'string' && config.id.trim()) {
      const safeId = config.id.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      return `${safeId}-${createHash('sha256').update(safeId).digest('hex').slice(0, 16)}`;
    }
  } catch {}
  const hash = createHash('sha256').update(workspaceRoot).digest('hex').slice(0, 16);
  return `${basename(workspaceRoot).replace(/[^a-zA-Z0-9_-]/g, '_')}-${hash}`;
}

// git localizes its error messages; probeGitRoot() classifies "not a git
// repository" by matching the English stderr, so every spawn forces the C
// locale. Without it a non-English shell turns a benign non-git directory
// into a thrown error (#4033, mirrors the src/lib/worktree-paths.ts fix).
function gitEnv() { return { ...process.env, LC_ALL: 'C' }; }

function primaryGitRoot(gitRoot) {
  try {
    const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: gitRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, timeout: 5000, env: gitEnv() }).trim();
    if (basename(commonDir) === '.git' && !commonDir.includes('/.git/modules/')) return dirname(commonDir);
  } catch {}
  return gitRoot;
}

function findGitRootFs(directory) {
  // PATH-independent git-root discovery: walk up for a `.git` entry (a
  // directory for normal repos, a file for linked worktrees/submodules).
  // Mirrors `git rev-parse --show-toplevel` for every layout a hook can
  // realistically run in, without ever spawning git.
  let cursor = resolve(directory);
  while (true) {
    if (existsSync(join(cursor, '.git'))) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
}

function probeGitRoot(directory) {
  // The filesystem walk is the primary probe. The git spawn is a refinement
  // for exotic layouts only, and its failure must NEVER degrade the answer
  // to a HOME fallback: when git is absent from PATH, ENOENT used to be
  // swallowed as "not a repository" here, silently re-aiming every state
  // consumer (guardrails, watchdog, session restore) at ~/.omc.
  const fsRoot = findGitRootFs(directory);
  if (!fsRoot) return null;
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 5000, env: gitEnv() }).trim() || fsRoot;
  } catch {
    return fsRoot;
  }
}

function isSafeWorkspaceRoot(workspaceRoot) {
  const home = resolve(homedir());
  const normalized = workspaceRoot.replace(/\\/g, '/');
  let cursor = workspaceRoot;
  while (true) {
    const name = basename(cursor).toLowerCase();
    if (cursor === home || cursor === '/' || cursor === '/tmp' || name.startsWith('.') || ['.ssh', '.gnupg', '.aws', '.config', '.claude', '.codex', '.cache', '.npm', 'desktop', 'documents', 'downloads', 'pictures', 'music'].includes(name)) return false;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return normalized !== '';
}

/**
 * Resolve the .omc root directory, respecting OMC_STATE_DIR.
 *
 * @param {string} directory - Worktree root directory
 * @returns {Promise<string>} Absolute path to the .omc root
 */
export async function resolveOmcStateRoot(directory) {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    const distPath = join(pluginRoot, 'dist', 'lib', 'worktree-paths.js');
    if (existsSync(distPath)) {
      const { getOmcRoot } = await import(pathToFileURL(distPath).href);
      return getOmcRoot(directory);
    }
  }

  // Inline fallback: preserve the canonical non-git identity used by the
  // TypeScript resolver when the generated distribution is unavailable.
  const customDir = process.env.OMC_STATE_DIR;
  if (customDir) {
    const workspaceRoot = findWorkspaceRoot(directory);
    if (workspaceRoot) return join(customDir, workspaceIdentifier(workspaceRoot));
    const gitRoot = probeGitRoot(directory);
    if (!gitRoot) return join(customDir, 'non-git');
    const primaryRoot = primaryGitRoot(gitRoot);
    let source = primaryRoot;
    try { source = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: gitRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, timeout: 5000, env: gitEnv() }).trim() || primaryRoot; } catch {}
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);
    return join(customDir, `${basename(primaryRoot).replace(/[^a-zA-Z0-9_-]/g, '_')}-${hash}`);
  }
  const workspaceRoot = findWorkspaceRoot(directory);
  if (workspaceRoot && isSafeWorkspaceRoot(workspaceRoot)) return join(workspaceRoot, '.omc');
  const gitRoot = probeGitRoot(directory);
  if (gitRoot) return join(gitRoot, '.omc');
  const home = resolve(homedir());
  return join(home, '.omc');
}

/**
 * Resolve session-scoped state paths for a given directory, state name, and session ID.
 * Delegates to resolveSessionStatePaths() in dist/lib/worktree-paths.js.
 *
 * @param {string} directory - Worktree root directory
 * @param {string} stateName - State name (e.g., "ralph", "ultrawork")
 * @param {string} [sessionId] - Optional session identifier
 * @returns {Promise<{readPath: string, writePath: string}>} Unbranded path pair
 */
export async function resolveSessionStatePathsForHook(directory, stateName, sessionId) {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    try {
      const { resolveSessionStatePaths } = await import(
        pathToFileURL(join(pluginRoot, 'dist', 'lib', 'worktree-paths.js')).href
      );
      const result = resolveSessionStatePaths(stateName, sessionId, directory);
      return { readPath: result.effectiveRead, writePath: result.effectiveWrite };
    } catch {
      // dist not built or unavailable — fall through to inline fallback
    }
  }

  // Inline fallback: basic session-scoped path derivation (production always uses dist above)
  const omcRoot = await resolveOmcStateRoot(directory);
  const normalizedName = stateName.endsWith('-state') ? stateName : `${stateName}-state`;
  const legacy = join(omcRoot, 'state', `${normalizedName}.json`);
  if (!sessionId) {
    return { readPath: legacy, writePath: legacy };
  }
  const sessionScoped = join(omcRoot, 'state', 'sessions', sessionId, `${normalizedName}.json`);
  // effectiveRead probes the session-scoped file first and falls back to the
  // legacy path when it does not exist yet (mirrors resolveSessionStatePaths).
  const readPath = existsSync(sessionScoped) ? sessionScoped : legacy;
  return { readPath, writePath: sessionScoped };
}

```

### Core Architecture Module: `src/agents/utils.ts`
```
/**
 * Agent Utilities
 *
 * Shared utilities for agent creation and management.
 * Includes prompt builders and configuration helpers.
 *
 * Ported from oh-my-opencode's agent utils.
 */

import { readFileSync } from 'fs';
import { join, dirname, basename, resolve, relative, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

import type {
  AgentConfig,
  AgentPromptMetadata,
  AvailableAgent,
  AgentOverrideConfig,
  ModelType
} from './types.js';
// ============================================================
// DYNAMIC PROMPT LOADING
// ============================================================

/**
 * Build-time injected agent prompts map.
 * esbuild replaces this with a { role: "prompt content" } object during bridge builds.
 * In dev/test (unbundled), this remains undefined and we fall back to runtime file reads.
 */
declare const __AGENT_PROMPTS__: Record<string, string> | undefined;

/**
 * Get the package root directory (where agents/ folder lives).
 * Handles both ESM (import.meta.url) and CJS bundle (__dirname) contexts.
 * In CJS bundles, __dirname is always reliable and should take precedence.
 * This avoids path skew when import.meta.url is shimmed during bundling.
 */
function getPackageDir(): string {
  // __dirname is available in bundled CJS and in some test transpilation contexts.
  if (typeof __dirname !== 'undefined' && __dirname) {
    const currentDirName = basename(__dirname);
    const parentDirName = basename(dirname(__dirname));

    // Bundled CLI path: bridge/cli.cjs -> package root is one level up.
    if (currentDirName === 'bridge') {
      return join(__dirname, '..');
    }

    // Source/dist module path (src/agents or dist/agents) -> package root is two levels up.
    if (currentDirName === 'agents' && (parentDirName === 'src' || parentDirName === 'dist')) {
      return join(__dirname, '..', '..');
    }
  }

  // ESM path (works in dev via ts/dist)
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const currentDirName = basename(__dirname);
    if (currentDirName === 'bridge') {
      return join(__dirname, '..');
    }
    // From src/agents/ or dist/agents/ go up to package root
    return join(__dirname, '..', '..');
  } catch {
    // import.meta.url unavailable — last resort
  }

  // Last resort
  return process.cwd();
}

/**
 * Strip YAML frontmatter from markdown content.
 */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

/**
 * Load an agent prompt from /agents/{agentName}.md
 * Uses build-time embedded prompts when available (CJS bundles),
 * falls back to runtime file reads (dev/test environments).
 *
 * Security: Validates agent name to prevent path traversal attacks
 */
export function loadAgentPrompt(agentName: string): string {
  // Security: Validate agent name contains only safe characters (alphanumeric and hyphens)
  // This prevents path traversal attacks like "../../etc/passwd"
  if (!/^[a-z0-9-]+$/i.test(agentName)) {
    throw new Error(`Invalid agent name: contains disallowed characters`);
  }

  // Prefer build-time embedded prompts (always available in CJS bundles)
  try {
    if (typeof __AGENT_PROMPTS__ !== 'undefined' && __AGENT_PROMPTS__ !== null) {
      const prompt = __AGENT_PROMPTS__[agentName];
      if (prompt) return prompt;
    }
  } catch {
    // __AGENT_PROMPTS__ not defined — fall through to runtime file read
  }

  // Runtime fallback: read from filesystem (dev/test environments)
  try {
    const agentsDir = join(getPackageDir(), 'agents');
    const agentPath = join(agentsDir, `${agentName}.md`);

    // Security: Verify resolved path is within the agents directory
    const resolvedPath = resolve(agentPath);
    const resolvedAgentsDir = resolve(agentsDir);
    const rel = relative(resolvedAgentsDir, resolvedPath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(`Invalid agent name: path traversal detected`);
    }

    const content = readFileSync(agentPath, 'utf-8');
    return stripFrontmatter(content);
  } catch (error) {
    // Don't leak internal paths in error messages
    const message = error instanceof Error && error.message.includes('Invalid agent name')
      ? error.message
      : 'Agent prompt file not found';
    console.warn(`[loadAgentPrompt] ${message}`);
    return `Agent: ${agentName}\n\nPrompt unavailable.`;
  }
}

/**
 * Create tool restrictions configuration
 * Returns an object that can be spread into agent config to restrict tools
 */
export function createAgentToolRestrictions(
  blockedTools: string[]
): { tools: Record<string, boolean> } {
  const restrictions: Record<string, boolean> = {};
  for (const tool of blockedTools) {
    restrictions[tool.toLowerCase()] = false;
  }
  return { tools: restrictions };
}

/**
 * Merge agent configuration with overrides
 */
export function mergeAgentConfig(
  base: AgentConfig,
  override: AgentOverrideConfig
): AgentConfig {
  const { prompt_append, ...rest } = override;

  const merged: AgentConfig = {
    ...base,
    ...(rest.model && { model: rest.model as ModelType }),
    ...(rest.enabled !== undefined && { enabled: rest.enabled })
  };

  if (prompt_append && merged.prompt) {
    merged.prompt = merged.prompt + '\n\n' + prompt_append;
  }

  return merged;
}

/**
 * Build delegation table section for OMC prompt
 */
export function buildDelegationTable(availableAgents: AvailableAgent[]): string {
  if (availableAgents.length === 0) {
    return '';
  }

  const rows = availableAgents
    .filter(a => a.metadata.triggers.length > 0)
    .map(a => {
      const triggers = a.metadata.triggers
        .map(t => `${t.domain}: ${t.trigger}`)
        .join('; ');
      return `| ${a.metadata.promptAlias || a.name} | ${a.metadata.cost} | ${triggers} |`;
    });

  if (rows.length === 0) {
    return '';
  }

  return `### Agent Delegation Table

| Agent | Cost | When to Use |
|-------|------|-------------|
${rows.join('\n')}`;
}

/**
 * Build use/avoid section for an agent
 */
export function buildUseAvoidSection(metadata: AgentPromptMetadata): string {
  const sections: string[] = [];

  if (metadata.useWhen && metadata.useWhen.length > 0) {
    sections.push(`**USE when:**
${metadata.useWhen.map(u => `- ${u}`).join('\n')}`);
  }

  if (metadata.avoidWhen && metadata.avoidWhen.length > 0) {
    sections.push(`**AVOID when:**
${metadata.avoidWhen.map(a => `- ${a}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Create environment context for agents
 */
export function createEnvContext(): string {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;

  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return `
<env-context>
  Current time: ${timeStr}
  Timezone: ${timezone}
  Locale: ${locale}
</env-context>`;
}

/**
 * Get all available agents as AvailableAgent descriptors
 */
export function getAvailableAgents(
  agents: Record<string, AgentConfig>
): AvailableAgent[] {
  return Object.entries(agents)
    .filter(([_, config]) => config.metadata)
    .map(([name, config]) => ({
      name,
      description: config.description,
      metadata: config.metadata!
    }));
}

/**
 * Build key triggers section for OMC prompt
 */
export function buildKeyTriggersSection(
  availableAgents: AvailableAgent[]
): string {
  const triggers: string[] = [];

  for (const agent of availableAgents) {
    for (const trigger of agent.metadata.triggers) {
      triggers.push(`- **${trigger.domain}** → ${agent.metadata.promptAlias || agent.name}: ${trigger.trigger}`);
    }
  }

  if (triggers.length === 0) {
    return '';
  }

  return `### Key Triggers (CHECK BEFORE ACTING)

${triggers.join('\n')}`;
}

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: AgentConfig): string[] {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('Agent name is required');
  }

  if (!config.description) {
    errors.push('Agent description is required');
  }

  if (!config.prompt) {
    errors.push('Agent prompt is required');
  }

  // Note: tools is now optional - agents get all tools by default if omitted

  return errors;
}

/**
 * Parse disallowedTools from agent markdown frontmatter
 */
export function parseDisallowedTools(agentName: string): string[] | undefined {
  // Security: Validate agent name contains only safe characters (alphanumeric and hyphens)
  if (!/^[a-z0-9-]+$/i.test(agentName)) {
    return undefined;
  }

  try {
    const agentsDir = join(getPackageDir(), 'agents');
    const agentPath = join(agentsDir, `${agentName}.md`);

    // Security: Verify resolved path is within the agents directory
    const resolvedPath = resolve(agentPath);
    const resolvedAgentsDir = resolve(agentsDir);
    const rel = relative(resolvedAgentsDir, resolvedPath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return undefined;
    }

    const content = readFileSync(agentPath, 'utf-8');

    // Extract frontmatter
    const match = content.match(/^---[\s\S]*?---/);
    if (!match) return undefined;

    // Look for disallowedTools line
    const disallowedMatch = match[0].match(/^disallowedTools:\s*(.+)/m);
    if (!disallowedMatch) return undefined;

    // Parse comma-separated list
    return disallowedMatch[1].split(',').map(t => t.trim()).filter(Boolean);
  } catch {
    return undefined;
  }
}

/**
 * Standard path for open questions file
 */
export const OPEN_QUESTIONS_PATH = '.omc/plans/open-questions.md';

/**
 * Format open questions for appending to the standard open-questions.md file.
 *
 * @param topic - The plan or analysis topic name
 * @param questions - Array of { question, reason }
```

### Core Architecture Module: `src/cli/tmux-utils.ts`
```
/**
 * tmux utility functions for omc native shell launch
 * Adapted from oh-my-codex patterns for omc
 */

import {
  exec,
  execFile,
  execFileSync,
  execSync,
  spawnSync,
  type ExecFileSyncOptionsWithStringEncoding,
  type ExecSyncOptionsWithStringEncoding,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
} from 'child_process';
import { basename, isAbsolute, win32 as win32Path } from 'path';
import { promisify } from 'util';

// ── tmux environment & execution wrappers ────────────────────────────────────

export interface TmuxExecOptions {
  /** Strip TMUX env var so the command targets the default tmux server.
   *  Default: false — preserves TMUX (targets the current server).
   *  Set to true for OMC-owned background sessions and cross-session scans. */
  stripTmux?: boolean;
}

export function tmuxEnv(): NodeJS.ProcessEnv {
  // Strip both TMUX (real tmux) and PSMUX_SESSION (psmux's drop-in tmux on
  // native Windows). psmux gates `new-session -d` nesting on PSMUX_SESSION,
  // not TMUX, so dropping only TMUX leaves psmux silently no-op'ing detached
  // session creation. See issue #3265.
  const { TMUX: _, PSMUX_SESSION: __, ...env } = process.env;
  return env;
}

function resolveEnv(opts?: TmuxExecOptions): NodeJS.ProcessEnv {
  return opts?.stripTmux ? tmuxEnv() : process.env;
}

interface TmuxCommandInvocation {
  command: string;
  args: string[];
}

function isUnixLikeOnWindows(): boolean {
  if (process.platform !== 'win32') return false;
  // MSYSTEM is the discriminator exported by MSYS2 shells. SYSTEM is a
  // Windows system variable and must not make a real POSIX tmux look native.
  return Boolean(process.env.MSYSTEM?.trim() || process.env.MINGW_PREFIX?.trim());
}

export function isNativeWindowsShell(): boolean {
  return process.platform === 'win32' && !isUnixLikeOnWindows();
}

export function quoteForCmd(arg: string): string {
  assertSafeCmdValue(arg);
  if (arg.length === 0) return '""';
  if (!/[\s"%^&|<>()]/.test(arg)) return arg;
  return `"${arg.replace(/(["%])/g, '$1$1')}"`;
}

export function escapeForCmdSet(value: string): string {
  assertSafeCmdValue(value);
  // The set command is embedded in a command string which is then wrapped in
  // a second cmd /c invocation. Percent signs therefore need one escaping
  // layer here, in addition to quoteForCmd's outer layer.
  return value.replace(/%/g, '%%').replace(/"/g, '""');
}

function assertSafeCmdValue(value: string): void {
  if (/[\0\r\n]/.test(value)) {
    throw new Error('Native Windows tmux command values cannot contain NUL, CR, or LF characters');
  }
}

function resolveTmuxInvocation(args: string[]): TmuxCommandInvocation {
  const resolvedBinary = resolveTmuxBinaryPath();
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolvedBinary)) {
    const comspec = process.env.COMSPEC || 'cmd.exe';
    const commandLine = [quoteForCmd(resolvedBinary), ...args.map(quoteForCmd)].join(' ');
    return {
      command: comspec,
      args: ['/d', '/s', '/c', commandLine],
    };
  }

  return {
    command: resolvedBinary,
    args,
  };
}

export function tmuxExec(
  args: string[],
  opts?: TmuxExecOptions & Omit<ExecFileSyncOptionsWithStringEncoding, 'env' | 'encoding'> & { encoding?: BufferEncoding },
): string {
  const { stripTmux: _, ...execOpts } = opts ?? {};
  const invocation = resolveTmuxInvocation(args);
  return execFileSync(invocation.command, invocation.args, { encoding: 'utf-8', ...execOpts, env: resolveEnv(opts) });
}

export async function tmuxExecAsync(
  args: string[],
  opts?: TmuxExecOptions & { timeout?: number },
): Promise<{ stdout: string; stderr: string }> {
  const { stripTmux: _, timeout, ...rest } = opts ?? {};
  const invocation = resolveTmuxInvocation(args);
  return promisify(execFile)(invocation.command, invocation.args, {
    encoding: 'utf-8', env: resolveEnv(opts),
    ...(timeout !== undefined ? { timeout } : {}), ...rest,
  });
}

export function tmuxShell(
  command: string,
  opts?: TmuxExecOptions & Omit<ExecSyncOptionsWithStringEncoding, 'env' | 'encoding'> & { encoding?: BufferEncoding },
): string {
  const { stripTmux: _, ...execOpts } = opts ?? {};
  return execSync(`tmux ${command}`, { encoding: 'utf-8', ...execOpts, env: resolveEnv(opts) }) as string;
}

export async function tmuxShellAsync(
  command: string,
  opts?: TmuxExecOptions & { timeout?: number },
): Promise<{ stdout: string; stderr: string }> {
  const { stripTmux: _, timeout, ...rest } = opts ?? {};
  return promisify(exec)(`tmux ${command}`, {
    encoding: 'utf-8', env: resolveEnv(opts),
    ...(timeout !== undefined ? { timeout } : {}), ...rest,
  });
}

export function tmuxSpawn(
  args: string[],
  opts?: TmuxExecOptions & Omit<SpawnSyncOptionsWithStringEncoding, 'env' | 'encoding'> & { encoding?: BufferEncoding },
): SpawnSyncReturns<string> {
  const { stripTmux: _, ...spawnOpts } = opts ?? {};
  const invocation = resolveTmuxInvocation(args);
  return spawnSync(invocation.command, invocation.args, { encoding: 'utf-8', ...spawnOpts, env: resolveEnv(opts) });
}

export async function tmuxCmdAsync(
  args: string[],
  opts?: TmuxExecOptions & { timeout?: number },
): Promise<{ stdout: string; stderr: string }> {
  if (args.some(a => a.includes('#{')) && !isNativeWindowsShell()) {
    const escaped = args.map(a => "'" + a.replace(/'/g, "'\\''") + "'").join(' ');
    return tmuxShellAsync(escaped, opts);
  }
  return tmuxExecAsync(args, opts);
}

export type ClaudeLaunchPolicy = 'inside-tmux' | 'outside-tmux' | 'direct';

export interface TmuxPaneSnapshot {
  paneId: string;
  currentCommand: string;
  startCommand: string;
}

function resolveTmuxBinaryPath(): string {
  if (process.platform !== 'win32') {
    return 'tmux';
  }

  try {
    const result = spawnSync('where', ['tmux'], {
      timeout: 5000,
      encoding: 'utf8',
    });
    if (result.status !== 0) return 'tmux';

    const candidates = result.stdout
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean) ?? [];
    const first = candidates[0];
    if (first && (isAbsolute(first) || win32Path.isAbsolute(first))) {
      return first;
    }
  } catch {
    // Fall back to plain tmux lookup below.
  }

  return 'tmux';
}

/**
 * Check if tmux is available on the system
 */
export function isTmuxAvailable(): boolean {
  try {
    const resolvedBinary = resolveTmuxBinaryPath();
    if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolvedBinary)) {
      const comspec = process.env.COMSPEC || 'cmd.exe';
      const result = spawnSync(comspec, ['/d', '/s', '/c', `"${resolvedBinary}" -V`], { timeout: 5000 });
      return result.status === 0;
    }

    if (process.platform === 'win32') {
      const result = spawnSync(resolvedBinary, ['-V'], { timeout: 5000, shell: true });
      return result.status === 0;
    }

    tmuxExec(['-V'], { stripTmux: true, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if claude CLI is available on the system
 */
export function isClaudeAvailable(): boolean {
  try {
    if (process.platform === 'win32') {
      const comspec = process.env.COMSPEC || 'cmd.exe';
      const commandLine = ['claude', '--version'].map(quoteForCmd).join(' ');
      const result = spawnSync(comspec, ['/d', '/s', '/c', commandLine], {
        stdio: 'ignore',
        windowsVerbatimArguments: true,
      });
      return result.status === 0;
    } else {
      execFileSync('claude', ['--version'], {
        stdio: 'ignore',
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Options for `resolveLaunchPolicy`. `requireTmux=true` makes
 * CMUX_SURFACE_ID stop demoting to 'direct'. The caller is responsible for
 * gating on platform/flag combinations (e.g. macOS + --madmax).
 */
export interface ResolveLaunchPolicyOptions {
  requireTmux?: boolean;
}

/**
 * Resolve launch policy based on environment and args
 * - inside-tmux: Already in tmux session, split pane for HUD
 * - outside-tmux: Not in tmux, create new session
 * - direct: tmux not available, run directly
 * - direct: print mode requested so stdout can flow to parent process
 */
export function resolveLaunchPolicy(
  env: NodeJS.ProcessEnv = process.env,
  args: string[] = [],
  options: ResolveLaunchPolicyOptions = {},
): ClaudeLaunchPolicy {
  if (args.some((arg) => arg === '--print' || arg === '-p')) {
    return 'direct';
  }
  if (env.TMUX) return 'inside-tmux';
  // Terminal emulators that embed their own multiplexer (e.g. cmux, a
  // Ghostty-based terminal) set CMUX_SURFACE_ID but not TMUX. tmux
  // attach-session fails in these environments because the host PTY is
  // not directly compatible, leaving orphaned detached sessions.
  // Demote to direct unless the caller explicitly requires tmux.
  if (env.CMUX_SURFACE_ID && !options.requireTmux) return 'direct';
  if (!isTmuxAvailable()) {
    return 'direct';
  }
  return 'outside-tmux';
}

/**
 * Build tmux session name from directory, git branch, and UTC timestamp
 * Format: omc-{dir}-{branch}-{utctimestamp}
 * e.g.  omc-myproject-dev-20260221143052
 */
export function buildTmuxSessionName(cwd: string): string {
  const dirToken = sanitizeTmuxToken(basename(cwd));
  let branchToken = 'detached';

  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
    if (branch) {
      branchToken = sanitizeTmuxToken(branch);
    }
  } catch {
    // Non-git directory or git unavailable
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const utcTimestamp =
    `${now.getUTCFullYear()}` +
    `${pad(now.getUTCMonth() + 1)}` +
    `${pad(now.getUTCDate())}` +
    `${pad(now.getUTCHours())}` +
    `${pad(now.getUTCMinutes())}` +
    `${pad(now.getUTCSeconds())}`;

  const name = `omc-${dirToken}-${branchToken}-${utcTim
```

### Core Architecture Module: `src/cli/utils/formatting.ts`
```
export const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`
};

export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

```

### Core Architecture Module: `src/features/background-agent/concurrency.ts`
```
/**
 * Background Agent Concurrency Manager
 *
 * Manages concurrency limits for background tasks.
 *
 * Adapted from oh-my-opencode's background-agent feature.
 */

import type { BackgroundTaskConfig } from './types.js';

/**
 * Manages concurrency limits for background tasks.
 * Provides acquire/release semantics with queueing.
 */
export class ConcurrencyManager {
  private config?: BackgroundTaskConfig;
  private counts: Map<string, number> = new Map();
  private queues: Map<string, Array<() => void>> = new Map();

  constructor(config?: BackgroundTaskConfig) {
    this.config = config;
  }

  /**
   * Get the concurrency limit for a given key (model/agent name)
   */
  getConcurrencyLimit(key: string): number {
    // Check model-specific limit
    const modelLimit = this.config?.modelConcurrency?.[key];
    if (modelLimit !== undefined) {
      return modelLimit === 0 ? Infinity : modelLimit;
    }

    // Check provider-specific limit (first part of key before /)
    const provider = key.split('/')[0];
    const providerLimit = this.config?.providerConcurrency?.[provider];
    if (providerLimit !== undefined) {
      return providerLimit === 0 ? Infinity : providerLimit;
    }

    // Fall back to default
    const defaultLimit = this.config?.defaultConcurrency;
    if (defaultLimit !== undefined) {
      return defaultLimit === 0 ? Infinity : defaultLimit;
    }

    // Default to 5 concurrent tasks per key
    return 5;
  }

  /**
   * Acquire a slot for the given key.
   * Returns immediately if under limit, otherwise queues the request.
   */
  async acquire(key: string): Promise<void> {
    const limit = this.getConcurrencyLimit(key);
    if (limit === Infinity) {
      return;
    }

    const current = this.counts.get(key) ?? 0;
    if (current < limit) {
      this.counts.set(key, current + 1);
      return;
    }

    // Queue the request
    return new Promise<void>((resolve) => {
      const queue = this.queues.get(key) ?? [];
      queue.push(resolve);
      this.queues.set(key, queue);
    });
  }

  /**
   * Release a slot for the given key.
   * If there are queued requests, resolves the next one.
   */
  release(key: string): void {
    const limit = this.getConcurrencyLimit(key);
    if (limit === Infinity) {
      return;
    }

    const queue = this.queues.get(key);
    if (queue && queue.length > 0) {
      // Resolve next queued request
      const next = queue.shift()!;
      next();
    } else {
      // Decrement count
      const current = this.counts.get(key) ?? 0;
      if (current > 0) {
        this.counts.set(key, current - 1);
      }
    }
  }

  /**
   * Get current count for a key
   */
  getCount(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  /**
   * Get queue length for a key
   */
  getQueueLength(key: string): number {
    return this.queues.get(key)?.length ?? 0;
  }

  /**
   * Check if a key is at capacity
   */
  isAtCapacity(key: string): boolean {
    const limit = this.getConcurrencyLimit(key);
    if (limit === Infinity) return false;
    return (this.counts.get(key) ?? 0) >= limit;
  }

  /**
   * Get all active keys and their counts
   */
  getActiveCounts(): Map<string, number> {
    return new Map(this.counts);
  }

  /**
   * Clear all counts and queues
   */
  clear(): void {
    this.counts.clear();
    this.queues.clear();
  }
}

```

### Core Architecture Module: `src/features/boulder-state/constants.ts`
```
/**
 * Boulder State Constants
 *
 * Ported from oh-my-opencode's boulder-state.
 */

import { OmcPaths } from '../../lib/worktree-paths.js';

/** OMC state directory */
export const BOULDER_DIR = OmcPaths.ROOT;

/** Boulder state file name */
export const BOULDER_FILE = 'boulder.json';

/** Full path pattern for boulder state */
export const BOULDER_STATE_PATH = `${BOULDER_DIR}/${BOULDER_FILE}`;

/** Notepad directory for learnings */
export const NOTEPAD_DIR = 'notepads';

/** Full path for notepads */
export const NOTEPAD_BASE_PATH = `${BOULDER_DIR}/${NOTEPAD_DIR}`;

/** Planner plan directory */
export const PLANNER_PLANS_DIR = OmcPaths.PLANS;

/** Plan file extension */
export const PLAN_EXTENSION = '.md';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4227** (2026-10-05): **[test] team shutdown tests (#4218) hardcode linux:99999 and fail on Windows/macOS**
  *Symptoms*: ## Summary  The regression tests added for #4218 in `src/cli/__tests__/team.test.ts` hardcode the dead-owner reservation's `process_started_at` as the literal string `'linux:99999'`. On a non-Linux host this value is not a *valid* process-start identity, so the cleanup path under test never treats the owner as dead, the stale reservation is never removed, and the assertion that it is gone fails.  Reproduced on Windows (win32), node from this repo's toolchain, `npx vitest run src/cli/__tests__/team.test.ts`:  ``` Test Files  1 failed (1)      Tests  3 failed | 48 passed (51) ```  Failing titles:  - `team cli > team shutdown cleans up partial-state team (config without valid instance_id), removes reservation` - `team cli > startTeamV2 pre-reserve cleanup removes dead-owner reservation but rejects live-owner` - `team cli > cleanupStaleReservations removes dead-owner reservation but NOT live-owner reservation`  Representative assertion failure (same shape in all three):  ``` AssertionError: expected true to be false // Object.is equality - Expected + Received - false + true  ❯ src/cli/__tests__/team.test.ts:1575:41     1573|     // All state should be completely removed     1574|     expect(existsSync(teamRoot)).toBe(false);     1575|     expect(existsSync(reservationPath)).toBe(false); ```  ## Why  `isProcessIdentityDead` in `src/team/team-owner-epoch.ts` only calls a reservation's owner dead when `isValidProcessStartIdentity` accepts the *recorded* start-identity string for the
  **Post-Mortem & Fix Analysis**:
  > Fixed by #4232, merged into `dev` as `529ce340d9`.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*

- **Issue #4226** (2026-10-05): **`omc intake run --headless` fails with `error: unknown option '--headless'`**
  *Symptoms*: ## Summary  Every scheduled harbor intake sweep dies immediately with an unknown-option error, before any precondition check runs.  `intake schedule` writes a cron / Task Scheduler entry whose command line includes `--headless`:  ``` omc intake run --headless --allow-docket-only --cwd "<repo>" ```  But `intake run` never registers that flag, so commander rejects the scheduled argv outright. Reproduced on `upstream/dev` at `486b85bbb`:  ``` $ npx tsx src/cli/index.ts intake run --headless error: unknown option '--headless' ```  The flag is silently dropped from the command's own help too (`omc intake run --help` does not list `--headless`), so the mismatch is invisible until the scheduled entry actually fires.  ## Environment  - oh-my-claudecode: `upstream/dev` @ `486b85bbb` - Node: v25.1.0 - OS: Windows 11 Enterprise 10.0.26200  ## Code path  - `buildScheduledCommand` writes the `--headless` flag into the scheduled   command line:   https://github.com/Yeachan-Heo/oh-my-claudecode/blob/486b85bbb/src/cli/commands/intake.ts#L195-L197 - `intake run` registers its options without `--headless`:   https://github.com/Yeachan-Heo/oh-my-claudecode/blob/486b85bbb/src/cli/commands/intake.ts#L275-L284  ## Proposed fix  Register `--headless` as an accepted (no-op) option on `intake run`. The sweep is already always headless, so the flag changes no behavior — it only needs to exist so the scheduled entry's argv parses. A regression test (commander parses the exact scheduled argv without thr
  **Post-Mortem & Fix Analysis**:
  > Fixed by #4231, merged into `dev`.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*

- **Issue #4218** (2026-10-04): **omc team shutdown crashes with unhandled team_shutdown_instance_identity_missing; leaked reservation then blocks the team name (team_name_already_reserved)**
  *Symptoms*: ## Summary  `omc team shutdown <name>` throws an **unhandled exception** from `handleTeamShutdown` instead of exiting with a clean diagnostic. This reproduces even for a team name that has **no state at all**. In real runs (second team operating 5.6.1; crash path independently reproduced, leak scenario reported by them) the crash also skips cleanup: team state and a `team-recovery` reservation with a dead owner PID survive, and any later team with the same name fails with `team_name_already_reserved` until state directories and the lifecycle lock are removed by hand.  ## Environment  - oh-my-claude-sisyphus **5.6.1** (npm global install) - macOS arm64 (Darwin 25.5.0), node v24.18.0, tmux 3.7c, claude 2.1.267  ## Repro 1 — minimal, no team required (verified on 5.6.1)  ``` $ omc team status demo-nonexistent No team state found                      # graceful handling  $ omc team shutdown demo-nonexistent /opt/homebrew/lib/node_modules/oh-my-claude-sisyphus/bridge/cli.cjs:124334     throw new Error("team_shutdown_instance_identity_missing");           ^  Error: team_shutdown_instance_identity_missing     at handleTeamShutdown (/…/oh-my-claude-sisyphus/bridge/cli.cjs:124334:11)     at async teamCommand (/…/oh-my-claude-sisyphus/bridge/cli.cjs:124442:5)     at async _Command.<anonymous> (/…/oh-my-claude-sisyphus/bridge/cli.cjs:131475:3)  Node.js v24.18.0 ```  Expected: the same "No team state found" handling as `team status` (non-zero exit + diagnostic), not an uncaught throw.  #
  **Post-Mortem & Fix Analysis**:
  > Thanks for the precise repro. Confirmed as a real bug: `team shutdown` should fail cleanly like `team status` and must not leak reservations/locks. A fix is in progress against `dev` (base `4280efb1fa`): clean diagnostic on missing state, best-effort release on mid-shutdown errors, and auto-collection of reservations whose owner PID is dead.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*
  > Fixed by #4220, merged to `dev` as `d96de2e888` (head `f6b79243df`; 18 checks green, the only one still running at merge time was the npm pack + install test, which this PR does not touch). - `omc team shutdown <name>` with no state now prints `No team state found for <name>` instead of throwing. - Partial state left behind by a failed startup (config with no valid instance id) is removed together with its reservation and lifecycle lock, and the command exits 1 with a diagnostic if anything can't be cleaned. - On start and shutdown, a reservation whose owner process is dead is collected under the lifecycle lock, so `team_name_already_reserved` no longer needs a manual `rm -rf`. Reservations owned by a live process are left alone. Regression tests cover each case. Ships in the next release.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*

- **Issue #4215** (2026-10-04): **omc ralph verify reports a NEW  failure on every run for node:test projects (5.6.1)**
  *Symptoms*: # `omc ralph verify` reports a NEW failure on every run for node:test projects (5.6.1)  ## Summary `omc ralph verify` fingerprints every line of a feedback command's output. With node:test's default reporter, the summary line `ℹ duration_ms <n>` changes on every run and is not normalized, so the gate exits 1 ("NEW failure") with no code change at all. `ralph` is told to obey that exit code, so its gate can never go green on such a project.  ## Environment - oh-my-claudecode plugin 5.6.1, npm CLI `oh-my-claude-sisyphus` 5.6.1 - Node.js 24.13.1 (also expected on 20/22: same reporter output) - Linux (EL8)  ## Reproduction ```bash mkdir rv && cd rv && mkdir test cat > package.json <<'JSON' { "name": "rv", "private": true, "type": "module", "scripts": { "test": "node --test" } } JSON cat > test/a.test.mjs <<'JS' import { test } from "node:test"; import { strict as assert } from "node:assert"; test("ok", () => assert.ok(true)); JS git init -q && git add -A && git -c user.name=r -c user.email=r@x.invalid commit -qm init omc ralph verify --write-baseline --session repro   # exit 0 omc ralph verify --session repro                    # exit 1, no change in between # ralph verify: 1 NEW failure(s) since baseline #   new: npm run test: ℹ duration_ms 198.232411 ``` The same happens when the suite has a failing test before the change. Adding a passing test also flips the gate, because `ℹ tests N` / `ℹ pass N` change.  ## Cause `dist/hooks/ralph/feedback-baseline.js`, `signatureLines()`: - 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report and reproduction. Confirmed on current `dev` (`e3e96dea99`): in `src/hooks/ralph/feedback-baseline.ts`, `VOLATILE_PATTERNS` only normalizes the `<number><unit>` duration form, so node:test's `ℹ duration_ms <n>` line survives `signatureLines()` and becomes a fresh "NEW failure" on every run. The `ℹ tests/pass N` summary lines are kept as signatures too, so adding a passing test also trips the gate.  The fix will target `dev`: normalize the unit-first duration form, stop treating pass/total count lines from a passing command as failure signatures, and add regression tests built on real node:test reporter output. Your `--test-reporter=dot` workaround (with `FORCE_COLOR=0 NODE_NO_WARNINGS=1`) is a good stopgap until then.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*
  > Fixed by #4216, merged into `dev` as 4280efb1fa (PR head 0ff0b76b65, all CI green).  - node:test/TAP `duration_ms` values (prefix and space-separated forms) are now normalized out of the baseline signature. - pass/test/skipped summary counts no longer count as failure signatures; `# fail N` is still tracked so real regressions are caught. - Regression tests added using real node:test output samples.  The fix ships to npm with the next release. Thanks for the clear report, @kaydash9999.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*

- **Issue #4211** (2026-10-02): **[Windows] omc team always fails with tmux_server_identity_probe_unavailable: strict process identity returns null on win32 (since 5.5.0)**
  *Symptoms*: ## Summary  On native Windows (no WSL), `omc team` can never start since v5.5.0: `createTeamSession()` requires a strict process-start identity, and the strict probe is hard-wired to return `null` on `win32`. This happens with psmux as the `tmux` provider, and it would happen with any other provider too. The gate runs before the tmux server is involved.  ## Environment  - OMC 5.6.0 (Claude Code plugin + npm `oh-my-claude-sisyphus` 5.6.0) - Windows 11, `10.0.26300`, native PowerShell 7.6.6, no WSL - Node v24.18.0 - psmux 3.3.8 (`tmux -V` → `tmux 3.3.8`). It can create a detached session and report its PID.  ## Reproduce  ``` omc team 1:codex "List the files in the current directory. Do not modify anything." ```  → fails immediately with `tmux_server_identity_probe_unavailable`.  Minimal check without starting any session:  ```js // node --input-type=module const m = await import('file:///<npm root -g>/oh-my-claude-sisyphus/dist/team/team-owner-epoch.js'); console.log({   strict: m.currentStrictProcessStartIdentity(),   nonStrict: m.processStartIdentityForPlatform(process.pid), }); ```  Output on this machine:  ``` {"platform":"win32","node":"v24.18.0","strict":null,"nonStrict":"win32:639265679579943025"} ```  The non-strict probe already gets a precise creation timestamp: `Get-Process … StartTime.Ticks` has 100 ns resolution. The strict path refuses it anyway.  ## Root cause (v5.6.0, `c56fc5e`)  1. [`src/team/team-owner-epoch.ts#L130-L131`](https://github.com/Yeachan-Heo/oh-my
  **Post-Mortem & Fix Analysis**:
  > Thanks for the precise report and root-cause trace — confirmed on current `dev` (`745622902b`): the strict probe in `src/team/team-owner-epoch.ts` still returns `null` on `win32`, and `isValidStrictProcessStartIdentity()` has no `win32` form, so the team-creation gate can never pass on native Windows.  A fix is in progress on `fix/4211-win32-strict-identity` against `dev`. The direction: a real strict `win32` identity based on the precise process creation ticks (the ownership guard stays intact — no bypass), plus a matching strict-identity validator, with an explicit WSL-pointing error only as a fallback if a strict identity turns out not to be sound. We can't run native Windows here, so we'll ping you on the PR for a native Windows + psmux test.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*
  > Follow-up after testing a local patch on native Windows 11 (Node 24.18, psmux 3.3.8, `dev` @ 745622902).  ## 1. Strict win32 identity: patch works, but it only removes the first gate  Patch (local, not submitted): the strict probe reuses the existing `Get-Process … StartTime.ToUniversalTime().Ticks` query, and `isValidStrictProcessStartIdentity()` gets a `win32` branch (`^win32:[1-9]\d*$`). Rationale: the ticks are an absolute UTC FILETIME (100 ns), so unlike Linux start ticks they can't collide across reboots, and no boot id is needed.  - `team-owner-epoch.test.ts`: 16/16 pass on Windows, including the two live-process tests that are currently skipped on win32. - `tmux-session*` + `runtime-owner-busy` on Windows: 29 failures before vs. 20 after. The remaining 20 also fail without the patch, so they are pre-existing on Windows. - I noticed that `tmux-session.create-team.test.ts:699-741` asserts the win32/psmux rejection on purpose, which is why I didn't open a PR. Cost note: every stri
  > Fixed by #4212 on `dev`: native Windows now gets a strict process-start identity (`win32:<UTC StartTime ticks>`) that the strict validator accepts, so `omc team` passes the ownership gate without weakening it. PID reuse, empty/garbage probe output and failed liveness checks all fail closed. Ships in the next release after 5.6.1.  We could only test this with mocked platform/probe here — if it still fails on native Windows + psmux once you can try a `dev` build, please reopen with the output. Thanks for the excellent root-cause trace.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*

- **Issue #4208** (2026-10-02): **jev: active mode is inert in v5.6.0 — hooks discard Jev answers while docs claim Jev decides**
  *Symptoms*: ## Summary  In v5.6.0, `OMC_JEV="all:active"` (or `<point>:active`) does not change any OMC decision. The resolver supports active mode, but every integration point throws away the Jev answer and keeps the heuristic result. The docs say otherwise.  Reported by Froschi (@froschi_g) on Discord. I confirmed it against the `v5.6.0` tag. No commit on `dev` after the tag touches these files.  ## What the docs claim  - `README.md:489` — `export OMC_JEV="all:active"  # All judgment points active` - `docs/HOOKS.md:619` — active: "Jev answer is used (for blocking points, this gates behavior …)" - `docs/HOOKS.md:674` — "In active mode, Jev's yes/no answer gates behavior (e.g., ralph stops when `ralph-verdict` decides completion is met)" - `docs/HOOKS.md:721` — `export OMC_JEV="all:active"  # All points, active; Jev decides` - `docs/adr/03672-env-activated-active-mode.md` — the env `:active` suffix was added so that Jev would stop being "permanently inert".  ## What the code does  `src/hooks/jev/resolver.ts` returns `{ answer, source: 'jev', mode: 'active' }` for active points. None of the callers use that answer.  **Script hooks** (`pre-tool-enforcer.mjs`, `post-tool-verifier.mjs`, `persistent-mode.mjs`, `keyword-detector.mjs`, `code-simplifier.mjs`) all call `recordJevShadow()` in `scripts/lib/jev-shadow.mjs`, which: - spawns `jev-resolve.mjs` detached with `stdio: ['ignore', 'ignore', 'ignore']` and `child.unref()`, so the hook can never read the answer; - has an opt-in check (`isJevS
  **Post-Mortem & Fix Analysis**:
  > Taking this with **option A**: active mode will actually consume the Jev answer.  - Fix branch `fix/4208-jev-active-mode` off `dev` `c07b5fcd1d`. The PR will target `dev`. - When a point resolves `active`, its caller uses Jev's answer. Shadow and disabled stay byte-identical to today. - On degrade, timeout, cap, circuit-open, or error, the caller falls back to the heuristic twin, so the hook never blocks or crashes. - Script hooks get an awaited resolve path that is used only when the point is active. Shadow keeps the current detached spawn. The `:active` suffix is parsed by the same logic as `src/hooks/jev/config.ts`. - Tests per wired point show active ≠ shadow when Jev disagrees with the twin, plus fallback. They also cover the `pre-tool-enforcer` haiku→opus repro. - README / HOOKS.md / ADR 03672 will be corrected to the shipped behavior. Points with no caller will be listed explicitly rather than claimed.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]* 
  > Fixed by #4209 on `dev`: `:active` now consumes the Jev answer at every wired point, with heuristic fallback on degrade/timeout/cap/circuit-open; docs and ADR 03672 updated. Ships in the next release after 5.6.1. Thanks Froschi for the report.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*

- **Issue #4192** (2026-10-01): **omc team fails with tmux_server_identity_probe_unavailable on macOS: npm package ships no compiled contained-fs darwin addon**
  *Symptoms*: ## Summary On macOS, `omc team` fails immediately with `tmux_server_identity_probe_unavailable`. The npm package for **5.5.0** ships `native/contained-fs.c` but no compiled `native/contained-fs-darwin-<arch>.node`.  `createTeamSession()` requires `currentStrictProcessStartIdentity()`. On darwin, strict mode only uses `getNativeContainedFs().processStartTime()` and deliberately skips the `sysctl`/`ps` fallback. When the addon is missing, the probe always returns null.  ## Repro 1. `npm i -g oh-my-claude-sisyphus@5.5.0` on macOS arm64. 2. `ls $(npm root -g)/oh-my-claude-sisyphus/native` shows only `contained-fs.c`. 3. `omc team 1:codex "anything"` fails with `tmux_server_identity_probe_unavailable`.  ## Workaround `node scripts/build-contained-fs.mjs` inside the installed package (needs Xcode CLT) builds `contained-fs-darwin-arm64.node` and `-x64.node`. After that the probe succeeds.  ## Suggested fix - Ship prebuilt darwin binaries in the npm tarball, or build them in a `postinstall` step. - Make the error message say the addon is missing and how to build it. It currently says "probe unavailable".  Related: #3998, #3893, #4011 (same addon, graph runtime). 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report and evidence. A fix is in progress against `dev` (23b408197d); the PR will link back here.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*
  > Fixed by #4197, merged into `dev`. It will ship in the next release. Thanks for the detailed report!  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*
  > Follow-up on #4197 / v5.6.0: **the Darwin packaging failure remains in the published npm archive, and the improved team error did not reach the executable bundles either.**  The final source change adds strictIdentityUnavailableError(): if the strict Darwin identity probe fails, it retries loading contained-fs and includes the load error, binary path and build command in the team error. Darwin strict probing still has no sysctl/ps fallback. This is an error-message improvement, not an implementation of prebuilt binaries or postinstall compilation.  Archive inspection found only native/contained-fs.c, with no contained-fs-darwin-arm64.node or contained-fs-darwin-x64.node. There is no package postinstall script to build them. The published bridge/cli.cjs and bridge/runtime-cli.cjs still throw the bare tmux_server_identity_probe_unavailable from createTeamSession; their native-load message still says "before running graph commands".  The shared archive hash, publish-log evidence and relea

- **Issue #4156** (2026-09-29): **[Windows] atomic-write identity check compares fstat.dev with lstat.dev (always 0 on Windows) — every state_write fails with "state mutation lock unavailable"**
  *Symptoms*: ## Prereqs  - Searched issues/PRs for "replaced before rename", "lstat dev windows", "fstat lstat dev", "atomic write Windows dev 0" — no match. Related but different Windows bugs: #4147 (colon in temp names), #4139 (mixed path separators), #4016 (missing better-sqlite3 binding — also hit on the same install, fixed by `npm rebuild better-sqlite3`; this bug remains after that). - Installed plugin: 5.5.0 (latest). `src/lib/atomic-write.ts` on both `main` and `dev` still has the comparisons below.  ## Bug  On Windows, every atomic write through `src/lib/atomic-write.ts` fails with  ``` atomic write temporary file was replaced before rename ```  so `state_write` / `state_clear` (and cancel-signal writes) always fail, surfaced to the user as `state mutation lock unavailable`. Practical impact: `/oh-my-claudecode:cancel` cannot pause autopilot, and the Stop hook keeps re-injecting "Autopilot not complete" forever.  ## Root cause  The file-identity checks compare `dev` from `fstatSync(fd)` against `dev` from `lstatSync(path)`. On Windows, Node returns the real volume serial number from `fstat` but **`0` from `lstat`/`stat`**, so the comparison never matches even though `ino` is identical:  ```js // node v22.14.0, win32, NTFS const fd = fs.openSync(p, 'w'); fs.fstatSync(fd).dev  // 2831858368 fs.lstatSync(p).dev   // 0 fs.statSync(p).dev    // 0 fs.fstatSync(fd).ino === fs.lstatSync(p).ino  // true ```  Affected comparisons (`src/lib/atomic-write.ts` on `dev`, and the same code bundl
  **Post-Mortem & Fix Analysis**:
  > Thank you, Ranung, for reporting this critical Windows compatibility issue. The fix has been merged via PR #4159 with commit f16390090.  The root cause was that Node.js returns different dev values on Windows: - fstatSync(fd).dev returns the real volume serial - lstatSync/statSync(path).dev returns 0  This broke atomic file identity verification and state mutation operations. The fix introduces a Windows-tolerant `sameFileIdentity` helper that correctly handles this platform difference while maintaining full security on POSIX systems.  Verification: ✓ TypeScript compilation ✓ All tests passing (119 tests) ✓ Windows dev=0 handling verified ✓ POSIX dev comparison enforcement maintained  --- *[repo owner's gaebal-gajae (clawdbot) 🦞]*

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

### Incident Patch 1: `7a614e58` (2026-10-06)
**Commit Message**: fix: canonical UTC timestamp for v5.6.2 authorization entry

**File**: `.github/generated-artifact-authorizations.json` (modified, +1/-1)
```diff
@@ -21371,7 +21371,7 @@
       "mergeBaseSha": "13543f9d6fc1a13a15b68fe5c97baeb3268569e2",
       "headSha": "e56417db60662a39a3f641f5712596d7a090e620",
       "owner": "Yeachan-Heo",
-      "expiresAt": "2027-01-04T04:09:32+00:00",
+      "expiresAt": "2027-01-04T04:38:01.000Z",
       "generatedDelta": {
         "count": 618,
         "sha256": "07c0dfd367849b843aa2958c1f56add83a161ff5be91be7fc024a4c197e49d01"
```

---

### Incident Patch 2: `d3ed6027` (2026-10-01)
**Commit Message**: chore(release): stage 30 untracked runtime artifacts missing from v5.6.1 rebuild (#4202)

dist/ is gitignored; the rebuild left new modules (incl. dist/cli/commands/ralph.js,
factory.js) untracked, so the PR head still shipped without omc ralph. Staged via
scripts/plugin-shipping-surface.mjs stage; verify reports 0 awaiting.

**File**: `dist/cli/commands/factory.d.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+/**
+ * Factory command (spec: OMC 软件工厂闭环, tracker issue #9).
+ *
+ * `omc factory listen` — the resident intake daemon. Transport adapters
+ * (smee.io / cloudflared / direct) live outside the OMC boundary: the daemon
+ * only receives already-unpacked webhook events as POSTs and does the OMC-side
+ * work itself (HMAC verification, repo whitelist, intake label gate, routing
+ * through the shared pure function, headless intent session spawn).
+ *
+ * `omc factory init` — seeds the project route table (`.omc/factory-routes.json`,
+ * the single source of truth the SessionEnd chain enqueuer reads) and validates
+ * the factory prerequisites. Default seeds the narrow starter loop; --no-narrow
+ * seeds the full-pipeline widening template. Never overwrites without --force.
+ *
+ * Liveness: pid file at <omc root>/state/factory-listener.json (SessionStart
+ * supervision reads it) plus a GET /status endpoint on the listening port.
+ */
+import { Command } from 'commander';
+import { type RouteTable } from '../../hooks/session-end/routing.js';
+export declare function factoryCommand(): Command;
+/**
+ * Narrow starter route table: exactly the listener's INTAKE_ROUTE_TABLE — the
+ * single intake -> intent hop. Everything after a completed intent session
+ * halts (`no-route`) until the project deliberately widens the table.
+ */
+export declare function buildRouteTableNarrow(): RouteTable;
+/**
+ * Full-pipeline widening template: a documented example widening the starter
+ * loop into the intent -> launch -> diagnose progression. Keys are
+ * `outcome:reason` pairs (the listener's intake label event, or the ending
+ * session's outcome + hook reason); values name the next stage/skill. This is
+ * a starting point to edit per project — a missing route halts the chain, and
+ * `skill: "stop"` declares a terminal stage.
+ */
+export declare function buildRouteTableFull(): RouteTable;
+/**
+ * Factory prerequisites, checked loudly before anything is written:
+ * harbor needs the OMC state root (`.omc/state/`) and the shipyard layout
+ * needs `docs/design/`.
+ */
+export declare function validateFactoryPrerequisites(cwd: string): {
+    ok: boolean;
+    missing: string[];
+};
+export interface FactoryInitResult {
+    exitCode: number;
+    message: string;
+}
+/**
+ * `omc factory init`: seed `.omc/factory-routes.json` — narrow starter table
+ * by default, full widening template with narrow:false. Refuses loudly when
+ * prerequisites are missing and never overwrites an existing table without
+ * force (the SessionEnd chain enqueuer reads that file as the single source
+ * of truth).
+ */
+export declare function runFactoryInit(options?: {
+    narrow?: boolean;
+    cwd?: string;
+    force?: boolean;
+}): FactoryInitResult;
+//# sourceMappingURL=factory.d.ts.map
\ No newline at end of file
```

**File**: `dist/cli/commands/factory.js` (added, +190/-0)
```diff
@@ -0,0 +1,190 @@
+/**
+ * Factory command (spec: OMC 软件工厂闭环, tracker issue #9).
+ *
+ * `omc factory listen` — the resident intake daemon. Transport adapters
+ * (smee.io / cloudflared / direct) live outside the OMC boundary: the daemon
+ * only receives already-unpacked webhook events as POSTs and does the OMC-side
+ * work itself (HMAC verification, repo whitelist, intake label gate, routing
+ * through the shared pure function, headless intent session spawn).
+ *
+ * `omc factory init` — seeds the project route table (`.omc/factory-routes.json`,
+ * the single source of truth the SessionEnd chain enqueuer reads) and validates
+ * the factory prerequisites. Default seeds the narrow starter loop; --no-narrow
+ * seeds the full-pipeline widening template. Never overwrites without --force.
+ *
+ * Liveness: pid file at <omc root>/state/factory-listener.json (SessionStart
+ * supervision reads it) plus a GET /status endpoint on the listening port.
+ */
+import { Command } from 'commander';
+import chalk from 'chalk';
+import { existsSync, mkdirSync, writeFileSync } from 'fs';
+import { join, resolve } from 'path';
+import { INTAKE_ROUTE_TABLE, startListener, stopListener } from '../../factory/listener.js';
+import { readChainStatus } from '../../factory/status.js';
+import { getOmcRoot } from '../../lib/worktree-paths.js';
+function renderChainStatus(status) {
+    const lines = [];
+    lines.push(`链状态 ${status.directory}`);
+    lines.push(`路由表（.omc/factory-routes.json，单一权威）: ${status.routeKeys.length} 键${status.routeKeys.length > 0 ? ` — ${status.routeKeys.join(', ')}` : ''}`);
+    lines.push(`活跃 ledger: ${status.activeLedgers}`);
+    lines.push(`意图（${status.intents.length}）:`);
+    if (status.intents.length === 0)
+        lines.push('  （无决策记录）');
+    for (const intent of status.intents) {
+        const last = intent.lastDecision ? `${intent.lastDecision} @ ${intent.lastDecisionAt ?? '?'}` : '无';
+        const stopped = intent.stopped ? `  停链[${intent.stopped.reason}]` : '';
+        lines.push(`  ${intent.intentId}  决策 ${intent.decisionCount}  末次 ${last}${stopped}`);
+    }
+    lines.push(`停滞环（阈值 30min 未推进）: ${status.stalled.length}`);
+    for (const stall of status.stalled) {
+        lines.push(`  ${stall.intentId} stage=${stall.stage} 停滞 ${Math.round(stall.stalledForMs / 60_000)}min session=${stall.session}`);
+    }
+    return lines.join('\n');
+}
+export function factoryCommand() {
+    const cmd = new Command('factory');
+    cmd.description('Software factory automation (chain trigger + intake listener)');
+    cmd
+        .command('listen')
+        .description('Run the intake listener daemon: HMAC-verified webhook events -> intake label gate -> headless intent sessions')
+        .option('--port <n>', 'port to listen on (transport adapters forward here)', '7788')
+        .option('--host <addr>', 'host to bind to (default: 127.0.0.1 for localhost only; set to 0.0.0.0 only when transport adapter runs on another machine)', '127.0.0.1')
+        .requiredOption('--repo <names>', 'repository whitelist, comma-separated owner/name')
+        .option('--cwd <dir>', 'repository whose .omc state root the daemon writes to', process.cwd())
+        .action((options) => {
+        const secret = process.env.OMC_FACTORY_HMAC_SECRET;
+        if (!secret) {
+            console.error(chalk.red('refused: no HMAC secret. Set OMC_FACTORY_HMAC_SECRET.'));
+            process.exitCode = 1;
+            return;
+        }
+        const whitelist = options.repo.split(',').map((s) => s.trim()).filter(Boolean);
+        if (whitelist.length === 0) {
+            console.error(chalk.red('refused: --repo whitelist is empty.'));
+            process.exitCode = 1;
+            return;
+        }
+        const cwd = resolve(options.cwd);
+        void startListener({ port: Number(options.port), secret, whitelist, cwd, host: options.host }).then((server) => {
+            const addr = server.address();
+            const port = addr && typeof addr !== 'string' ? addr.port : options.port;
+            const host = addr && typeof addr !== 'string' ? addr.address : options.host;
+            console.log(chalk.green(`factory listener on ${host}:${port} — whitelist: ${whitelist.join(', ')}`));
+            console.log(chalk.gray(`liveness: GET http://${host === '::' ? '[::1]' : host}:${port}/status or check .omc/state/factory-listener.json`));
+            const stop = () => {
+                stopListener(server, cwd);
+                process.exit(0);
+            };
+            process.on('SIGINT', stop);
+            process.on('SIGTERM', stop);
+        });
+    });
+    cmd
+        .command('init')
+        .description('Seed the project route table .omc/factory-routes.json (the chain-routing source of truth) and validate factory prerequisites')
+        // Negatable option: Commander defaults `narrow` to true, so the default
+        // seed is the narrow starter loop; --no-narrow seeds the widening templa
```

**File**: `dist/cli/commands/intake.d.ts` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+/**
+ * Intake Command (P2 Part B, contract: docs/design/P2-RUN-LEDGER-AND-INTAKE-PLAN.md)
+ *
+ * Gives the harbor headless sweep its power switch:
+ *   omc intake run --headless       one sweep: preconditions -> headless session -> exit
+ *   omc intake schedule --cron ...  register the sweep with the HOST scheduler
+ *   omc intake schedule --off       remove it
+ *
+ * Doctrine (inherited from harbor and the #4113 review):
+ * - The timer belongs to the host scheduler; OMC runs no daemon.
+ * - The CLI executes preconditions and facts only; every disposition stays
+ *   inside the harbor skill (labels it may create; nothing else).
+ * - No PR, no push, no tracker posting happens from this file.
+ */
+import { Command } from 'commander';
+export interface IntakeExecResult {
+    status: number | null;
+    stdout: string;
+    stderr: string;
+}
+export type IntakeRunner = (cmd: string, args: string[], options: {
+    cwd: string;
+    env?: Record<string, string>;
+    input?: string;
+}) => IntakeExecResult;
+/** Real runner: git-style spawn with a bounded timeout and captured output. */
+export declare const defaultIntakeRunner: IntakeRunner;
+export interface PreconditionCheck {
+    ok: boolean;
+    reason?: string;
+}
+/** Tracker reachable: `gh repo view` answers in the working directory. */
+export declare function checkTrackerReachable(cwd: string, runner: IntakeRunner): PreconditionCheck;
+/** Harbor labels exist or can be created (harbor's own first-use contract). */
+export declare function checkOrCreateHarborLabels(cwd: string, runner: IntakeRunner): PreconditionCheck;
+/**
+ * Single-writer lock: one intake run per repository. The lock is stale after
+ * LOCK_STALE_MS regardless of pid liveness (crashed runners must not wedge
+ * the intake forever).
+ */
+export declare function acquireIntakeLock(cwd: string, now?: number): PreconditionCheck;
+export declare function releaseIntakeLock(cwd: string): void;
+/**
+ * Classify a cron expression into the subset the Windows Task Scheduler can
+ * express. Everything outside this subset is refused on Windows (with the
+ * crontab option noted), never silently approximated.
+ */
+export declare function parseSimpleCron(expr: string): {
+    kind: 'minutes';
+    every: number;
+} | {
+    kind: 'daily';
+    hour: number;
+    minute: number;
+} | {
+    kind: 'unsupported';
+};
+export interface SchedulePlan {
+    platform: 'cron' | 'schtasks';
+    crontabLine?: string;
+    schtaskArgs?: string[];
+}
+/** Build the host-native registration plan from the parsed cron expression. */
+export declare function buildSchedulePlan(platform: 'linux' | 'darwin' | 'win32', expr: string, runCommand: string): SchedulePlan | {
+    refused: string;
+};
+/** Keep (remove=false) or drop (remove=true) the marked crontab lines. When
+ * installing (remove=false), `installLine` is appended after the cleanup. */
+export declare function filterCrontabLines(existing: string, remove: boolean, installLine?: string): string;
+export declare function buildScheduledCommand(cwd: string): string;
+export interface HeadlessRunResult {
+    exitCode: number;
+    message: string;
+}
+/** `omc intake run --headless`: preconditions, lock, headless sweep, exit. */
+export declare function runHeadlessIntake(options: {
+    cwd?: string;
+    claudeBin?: string;
+    allowDocketOnly?: boolean;
+}, runner?: IntakeRunner): HeadlessRunResult;
+/** `omc intake schedule`: install or remove the host-native entry. */
+export declare function scheduleIntake(options: {
+    cwd?: string;
+    cron: string;
+    off?: boolean;
+}, runner?: IntakeRunner): HeadlessRunResult;
+export declare function intakeCommand(): Command;
+//# sourceMappingURL=intake.d.ts.map
\ No newline at end of file
```

**File**: `dist/cli/commands/intake.js` (added, +265/-0)
```diff
@@ -0,0 +1,265 @@
+/**
+ * Intake Command (P2 Part B, contract: docs/design/P2-RUN-LEDGER-AND-INTAKE-PLAN.md)
+ *
+ * Gives the harbor headless sweep its power switch:
+ *   omc intake run --headless       one sweep: preconditions -> headless session -> exit
+ *   omc intake schedule --cron ...  register the sweep with the HOST scheduler
+ *   omc intake schedule --off       remove it
+ *
+ * Doctrine (inherited from harbor and the #4113 review):
+ * - The timer belongs to the host scheduler; OMC runs no daemon.
+ * - The CLI executes preconditions and facts only; every disposition stays
+ *   inside the harbor skill (labels it may create; nothing else).
+ * - No PR, no push, no tracker posting happens from this file.
+ */
+import { Command } from 'commander';
+import { spawnSync } from 'child_process';
+import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
+import { join, resolve } from 'path';
+import { getOmcRoot } from '../../lib/worktree-paths.js';
+const HARBOR_LABELS = [
+    'harbor:accepted',
+    'harbor:need-decision',
+    'harbor:need-info',
+    'harbor:rejected',
+    'harbor:for-maintainer',
+    'harbor:needs-exploration',
+    'harbor:merge-ready',
+    'harbor:changes-requested',
+];
+const HARBOR_SWEEP_PROMPT = '/oh-my-claudecode:harbor sweep';
+const TASK_NAME = 'OMC Intake';
+const CRONTAB_MARKER = '# omc-intake';
+const LOCK_STALE_MS = 2 * 3600_000;
+/** Real runner: git-style spawn with a bounded timeout and captured output. */
+export const defaultIntakeRunner = (cmd, args, options) => {
+    const result = spawnSync(cmd, args, {
+        cwd: options.cwd,
+        encoding: 'utf8',
+        stdio: ['pipe', 'pipe', 'pipe'],
+        windowsHide: true,
+        timeout: 60_000,
+        input: options.input,
+        env: options.env ? { ...process.env, ...options.env } : process.env,
+    });
+    return { status: result.status ?? null, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
+};
+/** Tracker reachable: `gh repo view` answers in the working directory. */
+export function checkTrackerReachable(cwd, runner) {
+    const result = runner('gh', ['repo', 'view'], { cwd });
+    if (result.status !== 0) {
+        return { ok: false, reason: `tracker unreachable (gh repo view failed):\n${result.stderr.trim().slice(0, 400)}` };
+    }
+    return { ok: true };
+}
+/** Harbor labels exist or can be created (harbor's own first-use contract). */
+export function checkOrCreateHarborLabels(cwd, runner) {
+    const list = runner('gh', ['label', 'list', '--json', 'name'], { cwd });
+    if (list.status !== 0) {
+        return { ok: false, reason: `cannot list labels:\n${list.stderr.trim().slice(0, 400)}` };
+    }
+    let existing = [];
+    try {
+        existing = JSON.parse(list.stdout).map((l) => l.name);
+    }
+    catch {
+        return { ok: false, reason: 'cannot parse gh label list output' };
+    }
+    const missing = HARBOR_LABELS.filter((label) => !existing.includes(label));
+    for (const label of missing) {
+        const create = runner('gh', ['label', 'create', label, '--color', '7c7c7c'], { cwd });
+        if (create.status !== 0) {
+            return { ok: false, reason: `cannot create missing label ${label}:\n${create.stderr.trim().slice(0, 300)}` };
+        }
+    }
+    return { ok: true };
+}
+/**
+ * Single-writer lock: one intake run per repository. The lock is stale after
+ * LOCK_STALE_MS regardless of pid liveness (crashed runners must not wedge
+ * the intake forever).
+ */
+export function acquireIntakeLock(cwd, now = Date.now()) {
+    const lockPath = join(getOmcRoot(cwd), 'state', 'intake-lock.json');
+    try {
+        if (existsSync(lockPath)) {
+            let started = 0;
+            try {
+                started = Date.parse(JSON.parse(readFileSync(lockPath, 'utf8')).startedAt ?? '') || 0;
+            }
+            catch {
+                started = 0;
+            }
+            if (now - started < LOCK_STALE_MS) {
+                return { ok: false, reason: `another intake run appears active (lock at ${lockPath}, started ${new Date(started).toISOString()}). Remove the lock only if you are certain no sweep is running.` };
+            }
+        }
+        mkdirFor(lockPath);
+        writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date(now).toISOString() }, null, 2));
+        return { ok: true };
+    }
+    catch (error) {
+        return { ok: false, reason: `cannot write intake lock: ${error.message}` };
+    }
+}
+export function releaseIntakeLock(cwd) {
+    try {
+        const lockPath = join(getOmcRoot(cwd), 'state', 'intake-lock.json');
+        if (existsSync(lockPath))
+            writeFileSync(lockPath, '', 'utf8');
+    }
+    catch {
+        // best-effort release
+    }
+}
+function mkdirFor(path) {
+    mkdirSync(join(path, '..'), { recursive: true });
+}
+/**
+ * Classify a cron expression into the subset the Windows Task Scheduler can
+ * express. Everythin
```

**File**: `dist/cli/commands/ralph.d.ts` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+/**
+ * `omc ralph afk "<task>" [--verify "<command>"]...` — launch a headless,
+ * narrowly-permissioned ralph session and return to the prompt.
+ *
+ * Reuses the factory chain's AFK link profile (scoped allowlist +
+ * project,local settings) and its argv builder, so a ralph run spawned here
+ * obeys the same isolation contract as a chain link: no user-level hooks or
+ * settings, no general Bash — only the gh/file/WebFetch surface, the
+ * read-only git commands ralph's own stale-state detection needs, and
+ * exactly the declared `--verify` commands.
+ *
+ * Two consequences of that isolation shape the launch:
+ * - A session with `--setting-sources project,local` cannot see
+ *   plugin-bundled skills, so a `/oh-my-claudecode:ralph` prompt degrades
+ *   into a plain one-shot request. The ralph skill is materialized as a
+ *   PROJECT skill before launch (the chain-ring contract) and invoked as
+ *   `/ralph`.
+ * - The mandatory deslop pass (Step 7.5) invokes the plugin-bundled
+ *   `ai-slop-cleaner` skill, which such a session equally cannot see — the
+ *   pass could never complete and the loop would stall. The launch
+ *   therefore injects `--no-deslop`; HITL ralph runs keep the pass.
+ */
+import type { Command } from 'commander';
+import { type CommandBaseline } from '../../hooks/ralph/feedback-baseline.js';
+/**
+ * The session's own feedback gate must be runnable inside the session: the
+ * loop's continuation context (getRalphContext), the startup notice, and the
+ * skill's NON-NEGOTIABLE precondition block all call `omc ralph verify` and
+ * nothing else. Prefix-matched so `--write-baseline` / `--session <id>` /
+ * `--json` all pass.
+ *
+ * Deliberately no OMC MCP entries: a live probe of an isolated session
+ * (`--setting-sources project,local`) showed the bridge MCP server does not
+ * register there at all — trace_summary / state_write / state_read simply do
+ * not exist, so allowlist entries for them would be cargo-cult. Consequence,
+ * documented in the skill's budget rule: the token-budget stop is
+ * attended-only; headless cost control is task sizing.
+ */
+export declare const RALPH_AFK_SESSION_COMMANDS: string[];
+/**
+ * Env var carrying the launcher's declared --verify list (JSON array) into the
+ * headless session. When present, `omc ralph verify` runs exactly these
+ * commands and ignores the PRD's feedbackCommands and package.json detection:
+ * the session can edit both with its file tools, so trusting them would turn
+ * the always-granted `omc ralph verify` entry into an arbitrary-shell escape
+ * from the allowlist.
+ */
+export declare const RALPH_AFK_FEEDBACK_ENV = "OMC_RALPH_AFK_FEEDBACK";
+/** The declared --verify commands that pass the same boundary check as the allowlist. */
+export declare function afkFeedbackCommands(verifyCommands: readonly string[]): string[];
+/** Args (command excluded) for one headless AFK ralph launch. */
+export declare function ralphAfkArgv(task: string, verifyCommands?: readonly string[], sessionId?: string): string[];
+export type SkillMaterialization = {
+    status: 'created';
+    path: string;
+} | {
+    status: 'present' | 'diverged';
+    path: string;
+};
+/**
+ * Materialize the bundled ralph skill into the project's skill scope so the
+ * isolated session can load it. An existing project copy is never clobbered:
+ * identical content is a no-op, diverged content is reported so a stale copy
+ * from an older OMC install cannot silently persist across upgrades.
+ */
+export declare function materializeRalphSkill(directory: string): SkillMaterialization | null;
+export declare function ralphCommand(program: Command): Command;
+/**
+ * Feedback commands for judgment. Inside an `omc ralph afk` session only the
+ * launcher-declared list counts; otherwise the PRD's declared list, else
+ * package-script detection.
+ */
+export declare function resolveFeedbackCommands(directory: string, sessionId?: string): string[];
+/** Run one feedback command on the current tree and fingerprint its failures. */
+export declare function runFeedbackCommand(command: string, directory: string): CommandBaseline;
+/** The verify action, extracted so tests can drive it directly. Exit code is the contract. */
+export declare function ralphVerify(options: {
+    json?: boolean;
+    session?: string;
+    writeBaseline?: boolean;
+}, directory?: string, now?: Date): number;
+//# sourceMappingURL=ralph.d.ts.map
\ No newline at end of file
```

**File**: `dist/cli/commands/ralph.js` (added, +306/-0)
```diff
@@ -0,0 +1,306 @@
+/**
+ * `omc ralph afk "<task>" [--verify "<command>"]...` — launch a headless,
+ * narrowly-permissioned ralph session and return to the prompt.
+ *
+ * Reuses the factory chain's AFK link profile (scoped allowlist +
+ * project,local settings) and its argv builder, so a ralph run spawned here
+ * obeys the same isolation contract as a chain link: no user-level hooks or
+ * settings, no general Bash — only the gh/file/WebFetch surface, the
+ * read-only git commands ralph's own stale-state detection needs, and
+ * exactly the declared `--verify` commands.
+ *
+ * Two consequences of that isolation shape the launch:
+ * - A session with `--setting-sources project,local` cannot see
+ *   plugin-bundled skills, so a `/oh-my-claudecode:ralph` prompt degrades
+ *   into a plain one-shot request. The ralph skill is materialized as a
+ *   PROJECT skill before launch (the chain-ring contract) and invoked as
+ *   `/ralph`.
+ * - The mandatory deslop pass (Step 7.5) invokes the plugin-bundled
+ *   `ai-slop-cleaner` skill, which such a session equally cannot see — the
+ *   pass could never complete and the loop would stall. The launch
+ *   therefore injects `--no-deslop`; HITL ralph runs keep the pass.
+ */
+import { randomUUID } from 'crypto';
+import { spawnSync } from 'child_process';
+import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
+import { join } from 'path';
+import { getSkillsDir } from '../../features/builtin-skills/skills.js';
+import { getOmcRoot, validateSessionId } from '../../lib/worktree-paths.js';
+import { baselinePath, diffAgainstBaseline, readBaseline, signatureLines, writeBaseline, } from '../../hooks/ralph/feedback-baseline.js';
+import { readPrd } from '../../hooks/ralph/prd.js';
+import { defaultSpawnFn, factoryLinkArgv } from '../../hooks/session-end/spawn-next.js';
+import { MAX_VERIFY_COMMANDS, MAX_VERIFY_COMMAND_LENGTH, VERIFY_COMMAND_PATTERN } from '../../hooks/session-end/routing.js';
+/** Read-only git commands ralph's stale-PRD detection and gitGrep checks need. */
+const RALPH_AFK_READONLY_GIT = ['git status', 'git log', 'git diff', 'git rev-parse', 'git show', 'git merge-base'];
+/**
+ * The session's own feedback gate must be runnable inside the session: the
+ * loop's continuation context (getRalphContext), the startup notice, and the
+ * skill's NON-NEGOTIABLE precondition block all call `omc ralph verify` and
+ * nothing else. Prefix-matched so `--write-baseline` / `--session <id>` /
+ * `--json` all pass.
+ *
+ * Deliberately no OMC MCP entries: a live probe of an isolated session
+ * (`--setting-sources project,local`) showed the bridge MCP server does not
+ * register there at all — trace_summary / state_write / state_read simply do
+ * not exist, so allowlist entries for them would be cargo-cult. Consequence,
+ * documented in the skill's budget rule: the token-budget stop is
+ * attended-only; headless cost control is task sizing.
+ */
+export const RALPH_AFK_SESSION_COMMANDS = ['Bash(omc ralph verify:*)'];
+/**
+ * Env var carrying the launcher's declared --verify list (JSON array) into the
+ * headless session. When present, `omc ralph verify` runs exactly these
+ * commands and ignores the PRD's feedbackCommands and package.json detection:
+ * the session can edit both with its file tools, so trusting them would turn
+ * the always-granted `omc ralph verify` entry into an arbitrary-shell escape
+ * from the allowlist.
+ */
+export const RALPH_AFK_FEEDBACK_ENV = 'OMC_RALPH_AFK_FEEDBACK';
+/** The declared --verify commands that pass the same boundary check as the allowlist. */
+export function afkFeedbackCommands(verifyCommands) {
+    return verifyCommands
+        .filter((command) => command.length <= MAX_VERIFY_COMMAND_LENGTH && VERIFY_COMMAND_PATTERN.test(command))
+        .slice(0, MAX_VERIFY_COMMANDS);
+}
+/** Args (command excluded) for one headless AFK ralph launch. */
+export function ralphAfkArgv(task, verifyCommands = [], sessionId = randomUUID()) {
+    // ralph's read-only git set rides the fixed-entry slot so it never eats
+    // into the MAX_VERIFY_COMMANDS budget of the declared --verify list.
+    const prompt = `/ralph --no-deslop ${task}`;
+    const argv = factoryLinkArgv(prompt, sessionId, verifyCommands, RALPH_AFK_READONLY_GIT);
+    const toolsIdx = argv.indexOf('--allowedTools');
+    if (toolsIdx !== -1) {
+        argv[toolsIdx + 1] = `${argv[toolsIdx + 1]},${RALPH_AFK_SESSION_COMMANDS.join(',')}`;
+    }
+    return argv;
+}
+/**
+ * Materialize the bundled ralph skill into the project's skill scope so the
+ * isolated session can load it. An existing project copy is never clobbered:
+ * identical content is a no-op, diverged content is reported so a stale copy
+ * from an older OMC install cannot silently persist across upgrades.
+ */
+export function materializeRalphSkill(directory) {
+    const target = join(directory, '.claude', 'skills', 'ralph', 'SKILL.md');
+    const source = 
```

**File**: `dist/factory/listener.d.ts` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+/**
+ * Factory listener daemon (spec: OMC 软件工厂闭环, tracker issue #9).
+ *
+ * Resident intake daemon: transport adapters (smee/cloudflared/direct) live
+ * outside the OMC boundary — the daemon only receives already-unpacked
+ * webhook events as POSTs. It verifies the HMAC signature, enforces the repo
+ * whitelist, applies the intake label gate (tracker issues) or the completed
+ * CI failure gate (check-suite webhooks), and routes through the shared
+ * routing pure function (T1 seam). v1 processes events serially.
+ */
+import { type Server } from 'http';
+import { type ChainDirective, type RouteTable } from '../hooks/session-end/routing.js';
+import { type SpawnContext } from '../hooks/session-end/spawn-next.js';
+export declare const INTAKE_LABEL = "intake";
+export declare const INTAKE_ROUTE_TABLE: RouteTable;
+/** CI check-suite failures feed the diagnose stage of the same chain. */
+export declare const CI_ROUTE_TABLE: RouteTable;
+/** GitHub issue webhook payload subset the daemon needs. */
+export interface TrackerEvent {
+    action?: string;
+    repository?: {
+        full_name?: string;
+    };
+    label?: {
+        name?: string;
+    };
+    issue?: {
+        number?: number;
+        title?: string;
+        html_url?: string;
+        labels?: Array<{
+            name?: string;
+        }>;
+    };
+}
+/** GitHub check-run webhook payload subset the daemon needs (CI failure intake). */
+export interface CheckRunEvent {
+    action?: string;
+    check_suite?: {
+        conclusion?: string;
+        head_branch?: string;
+    };
+    repository?: {
+        full_name?: string;
+    };
+}
+export declare function verifySignature(secret: string, rawBody: string, signatureHeader: string | undefined): boolean;
+export type RouteOutcome = {
+    kind: 'routed';
+    directive: ChainDirective;
+    issueNumber?: number;
+    issueUrl?: string;
+} | {
+    kind: 'discarded';
+    reason: string;
+} | {
+    kind: 'rejected';
+    status: number;
+    reason: string;
+};
+/** Pure intake decision: whitelist -> label gate -> shared routing seam. */
+export declare function routeTrackerEvent(event: TrackerEvent, whitelist: ReadonlyArray<string>, table?: RouteTable): RouteOutcome;
+/**
+ * Pure CI intake decision: whitelist -> completed/failure gate -> shared
+ * routing seam. Same outcome shape as routeTrackerEvent so the listener
+ * dispatches both webhook kinds uniformly.
+ */
+export declare function routeCheckFailure(event: CheckRunEvent, whitelist: ReadonlyArray<string>, table?: RouteTable): RouteOutcome;
+export declare function buildIntentPrompt(directive: ChainDirective, issueNumber?: number, issueUrl?: string): string;
+export declare function buildDiagnosePrompt(directive: ChainDirective, repo: string, branch?: string): string;
+export interface ListenerConfig {
+    port: number;
+    secret: string;
+    whitelist: ReadonlyArray<string>;
+    cwd: string;
+    host?: string;
+}
+export interface ListenerDeps {
+    spawner?: (cmd: string, args: string[], ctx?: SpawnContext) => void;
+    audit?: (record: Record<string, unknown>) => void;
+    /** Test seam: overrides the one-shot stall check scheduling for spawned links. */
+    scheduleStallCheck?: (session: string) => void;
+}
+export interface EventResult {
+    status: number;
+    kind: 'accepted' | 'discarded' | 'rejected';
+    detail: string;
+}
+/** Orchestrates one tracker event: audit rejections, discard noise, spawn routed sessions. */
+export declare function processEvent(event: TrackerEvent, config: ListenerConfig, deps?: ListenerDeps): EventResult;
+/** Orchestrates one CI check-suite event: same guardrail/ledger/AFK flow, no tracker. */
+export declare function processCheckFailureEvent(event: CheckRunEvent, config: ListenerConfig, deps?: ListenerDeps): EventResult;
+export declare function startListener(config: ListenerConfig, deps?: ListenerDeps): Promise<Server>;
+export declare function stopListener(server: Server, cwd: string): void;
+export declare const MAX_BODY_BYTES: number;
+//# sourceMappingURL=listener.d.ts.map
\ No newline at end of file
```

**File**: `dist/factory/listener.js` (added, +307/-0)
```diff
@@ -0,0 +1,307 @@
+/**
+ * Factory listener daemon (spec: OMC 软件工厂闭环, tracker issue #9).
+ *
+ * Resident intake daemon: transport adapters (smee/cloudflared/direct) live
+ * outside the OMC boundary — the daemon only receives already-unpacked
+ * webhook events as POSTs. It verifies the HMAC signature, enforces the repo
+ * whitelist, applies the intake label gate (tracker issues) or the completed
+ * CI failure gate (check-suite webhooks), and routes through the shared
+ * routing pure function (T1 seam). v1 processes events serially.
+ */
+import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
+import { createServer } from 'http';
+import { appendFileSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
+import { join } from 'path';
+import { decideNextStage } from '../hooks/session-end/routing.js';
+import { acquireChainSlot, releaseChainSlot } from '../hooks/session-end/guardrails.js';
+import { defaultSpawnFn, factoryLinkArgv } from '../hooks/session-end/spawn-next.js';
+import { DEFAULT_STALL_THRESHOLD_MS, detectStalledLinks, flagStall } from './watchdog.js';
+import { getOmcRoot } from '../lib/worktree-paths.js';
+export const INTAKE_LABEL = 'intake';
+export const INTAKE_ROUTE_TABLE = { 'success:intake': { stage: 'intent', skill: 'intent' } };
+/** CI check-suite failures feed the diagnose stage of the same chain. */
+export const CI_ROUTE_TABLE = { 'failed:ci': { stage: 'diagnose', skill: 'diagnose' } };
+export function verifySignature(secret, rawBody, signatureHeader) {
+    if (!signatureHeader?.startsWith('sha256='))
+        return false;
+    const provided = signatureHeader.slice('sha256='.length);
+    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
+    if (provided.length !== expected.length)
+        return false;
+    return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
+}
+/** Pure intake decision: whitelist -> label gate -> shared routing seam. */
+export function routeTrackerEvent(event, whitelist, table = INTAKE_ROUTE_TABLE) {
+    const repo = event.repository?.full_name;
+    if (!repo || !whitelist.includes(repo)) {
+        return { kind: 'rejected', status: 403, reason: `repository outside whitelist: ${repo ?? '(missing)'}` };
+    }
+    const labels = new Set();
+    if (event.label?.name)
+        labels.add(event.label.name);
+    for (const l of event.issue?.labels ?? [])
+        if (l.name)
+            labels.add(l.name);
+    const labeled = (event.action === 'labeled' || event.action === 'opened') && labels.has(INTAKE_LABEL);
+    if (!labeled)
+        return { kind: 'discarded', reason: `no ${INTAKE_LABEL} label (action: ${event.action ?? '?'})` };
+    const directive = decideNextStage('success', 'intake', table);
+    if (!directive)
+        return { kind: 'discarded', reason: 'route table has no intake directive' };
+    return { kind: 'routed', directive, issueNumber: event.issue?.number, issueUrl: event.issue?.html_url };
+}
+/**
+ * Pure CI intake decision: whitelist -> completed/failure gate -> shared
+ * routing seam. Same outcome shape as routeTrackerEvent so the listener
+ * dispatches both webhook kinds uniformly.
+ */
+export function routeCheckFailure(event, whitelist, table = CI_ROUTE_TABLE) {
+    const repo = event.repository?.full_name;
+    if (!repo || !whitelist.includes(repo)) {
+        return { kind: 'rejected', status: 403, reason: `repository outside whitelist: ${repo ?? '(missing)'}` };
+    }
+    const failed = event.action === 'completed' && event.check_suite?.conclusion === 'failure';
+    if (!failed) {
+        return { kind: 'discarded', reason: `not a failed check run (action: ${event.action ?? '?'}, conclusion: ${event.check_suite?.conclusion ?? '?'})` };
+    }
+    const directive = decideNextStage('failed', 'ci', table);
+    if (!directive)
+        return { kind: 'discarded', reason: 'route table has no ci directive' };
+    return { kind: 'routed', directive };
+}
+export function buildIntentPrompt(directive, issueNumber, issueUrl) {
+    const target = issueUrl ?? `(issue #${issueNumber ?? '?'})`;
+    return `/${directive.skill} 处理 tracker 进货：${target}。追问以 issue 评论回贴；回写契约：docs/intents/<slug>/ = 内容，issue 评论 = 记录指针，标签转 needs-review。`;
+}
+export function buildDiagnosePrompt(directive, repo, branch) {
+    const target = branch ? `${repo}@${branch}` : repo;
+    return `/${directive.skill} 处理 CI 失败：${target}。诊断失败原因并尝试修复；无法自动修复时留下诊断结论并停住（needs-human）。`;
+}
+const ISSUE_URL_PATTERN = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/;
+function issueUrlMatchesRepo(issueUrl, repo) {
+    if (!issueUrl)
+        return true;
+    if (!ISSUE_URL_PATTERN.test(issueUrl))
+        return false;
+    return issueUrl.startsWith(`https://github.com/${repo}/issues/`);
+}
+function defaultAudit(cwd) {
+    const dir = join(getOmcRoot(cwd), 'state');
+    return (record) => {
+        try {
+            mkdirSync(dir, { recursive: true });
+          
```

---

### Incident Patch 3: `dc7ba1da` (2026-10-01)
**Commit Message**: ci: fix #4203 authorization digest (rebuilt via build-generated-artifact-authorization)

**File**: `.github/generated-artifact-authorizations.json` (modified, +1/-1)
```diff
@@ -19926,7 +19926,7 @@
       "expiresAt": "2026-12-30T13:09:58.331Z",
       "generatedDelta": {
         "count": 209,
-        "sha256": "5540befbbb0fac13830181b37e0e705fdca68e55d6ea7c1272ebba1e8953aa1a"
+        "sha256": "b61cae7b1668b47e96a4a10a6993d77647da7ca9a593e7dcea0ca0bb0d4df229"
       },
       "generatedFiles": [
         {
```

---

### Incident Patch 4: `244ee23f` (2026-10-01)
**Commit Message**: ci: authorize generated artifacts for PR #4203 v5.6.1 hotfix

**File**: `.github/generated-artifact-authorizations.json` (modified, +1268/-0)
```diff
@@ -19916,6 +19916,1274 @@
           "previousFilename": null
         }
       ]
+    },
+    {
+      "pullNumber": 4203,
+      "targetRef": "main",
+      "mergeBaseSha": "e74b22cd34e0a8b9dd5ded87d1bf0db6ce1a38dd",
+      "headSha": "ed3869a356d9b4653533269ca8cb7e56b7735169",
+      "owner": "Yeachan-Heo",
+      "expiresAt": "2026-12-30T13:09:58.331Z",
+      "generatedDelta": {
+        "count": 209,
+        "sha256": "5540befbbb0fac13830181b37e0e705fdca68e55d6ea7c1272ebba1e8953aa1a"
+      },
+      "generatedFiles": [
+        {
+          "status": "modified",
+          "filename": "bridge/claude-md-coordinator.cjs",
+          "sha": "f82e6caa47a9df082e8dd517153b9b26b90846d1",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "bridge/cli.cjs",
+          "sha": "d6d08360236d47888a1c5ec329ea5a369d6ddaef",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "bridge/mcp-server.cjs",
+          "sha": "9427acf379f8004630ebae9bf95b81d77f4e4795",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "bridge/runtime-cli.cjs",
+          "sha": "a88f92d263a200760a5afc6a1642798ac9547568",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "bridge/team-bridge.cjs",
+          "sha": "83bc943fb74544c1e6445f9e7db4ed0cdfbf0b6a",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "bridge/team-mcp.cjs",
+          "sha": "b0a24126f310541a21404d6df717d487537ce3fb",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "bridge/team.js",
+          "sha": "b8071f931e0577a9d6a05a9afb2a849af7497b54",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/consolidation-contracts.test.js",
+          "sha": "fc386b358786a419cba8624f8105eff5d4252a89",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/consolidation-contracts.test.js.map",
+          "sha": "62961b012a3059987b7e1c0984816cc942428661",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/directory-context-injector.test.js",
+          "sha": "66b47b4565300972ec3d1b2215c602a005b04f5c",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/directory-context-injector.test.js.map",
+          "sha": "8af4d71719dbf0c6080ac620412172401041da11",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/doctor-conflicts.test.js",
+          "sha": "60c8d3e9551ab28e089298aaec441b4bd4050fb7",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/doctor-conflicts.test.js.map",
+          "sha": "dd569194c336ddb543dd438ce90f794e25396ec7",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/hud/watch-mode-init.test.js",
+          "sha": "a350f07892ab1c0506fcab8505c70b3b61f5c784",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/hud/watch-mode-init.test.js.map",
+          "sha": "8dbb68cce28ad498f933a33feca7e870a1d31e59",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/preemptive-compaction-hook.test.js",
+          "sha": "6a7d6cc42217a34299cbbf176e43f51b88adb535",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/preemptive-compaction-hook.test.js.map",
+          "sha": "4049b42cba07f71c2e7ee5a75c1b57107705bd3f",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/ralph-prd-stale.test.js",
+          "sha": "16af9f662c336351c2163b0b079cc7a627799c2b",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/ralph-prd-stale.test.js.map",
+          "sha": "e8df08ed0c54326b2af732be4be8cb2a86fda27a",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/ralph-prd.test.js",
+          "sha": "7f1c15baceeb6b9569b5909d2bb20e3186c26f3c",
+          "previousFilename": null
+        },
+        {
+          "status": "modified",
+          "filename": "dist/__tests__/ralph-prd.test.js.map",
+          "s
```

---

### Incident Patch 5: `ed3869a3` (2026-10-01)
**Commit Message**: chore(release): rebuild generated artifacts (fix #4202 — restore missing dist/ and bridge/cli.cjs)

**File**: `.claude-plugin/marketplace.json` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@
     {
       "name": "oh-my-claudecode",
       "description": "Claude Code native multi-agent orchestration with intelligent model routing across agents and skills. Zero learning curve. Maximum power.",
-      "version": "5.6.0",
+      "version": "5.6.1",
       "author": {
         "name": "Yeachan Heo",
         "email": "hurrc04@gmail.com"
@@ -27,5 +27,5 @@
       ]
     }
   ],
-  "version": "5.6.0"
+  "version": "5.6.1"
 }
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "oh-my-claudecode",
-  "version": "5.6.0",
+  "version": "5.6.1",
   "description": "Multi-agent orchestration system for Claude Code",
   "author": {
     "name": "oh-my-claudecode contributors"
```

**File**: `.github/CLAUDE.md` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 <!-- OMC:START -->
-<!-- OMC:VERSION:5.6.0 -->
+<!-- OMC:VERSION:5.6.1 -->
 
 # oh-my-claudecode - Intelligent Multi-Agent Orchestration
 
```

**File**: `.github/release-body.md` (modified, +5/-108)
```diff
@@ -1,109 +1,12 @@
-# oh-my-claudecode v5.6.0: omc ralph verify, omc ralph afk, risk-ordered stories, repo
+# oh-my-claudecode v5.6.1: Maintenance Release
 
 ## Release Notes
 
-Release with **19 new features**, **47 bug fixes**, **7 other changes** across **78 merged PRs**.
-
-### Highlights
-
-- **feat(ralph): omc ralph verify — the single executor of the feedback diff** (#4188)
-- **feat(ralph): omc ralph afk — headless isolated launch + fix win32 .cmd spawn routing** (#4187)
-- **feat(ralph): risk-ordered stories, repo quality class, and a feedback baseline** (#4184)
-- **feat(session-end): let a route stage declare its AFK verify commands** (#4179)
-- **feat(session-end): daily-chain-limit env override + diff-first gate doctrine** (#4182)
-
-### New Features
-
-- **feat(ralph): omc ralph verify — the single executor of the feedback diff** (#4188)
-- **feat(ralph): omc ralph afk — headless isolated launch + fix win32 .cmd spawn routing** (#4187)
-- **feat(ralph): risk-ordered stories, repo quality class, and a feedback baseline** (#4184)
-- **feat(session-end): let a route stage declare its AFK verify commands** (#4179)
-- **feat(session-end): daily-chain-limit env override + diff-first gate doctrine** (#4182)
-- **feat(factory): enforcement layer completion - CI trigger, factory init, check evidence, diff-first, daily cap** (#4183)
-- **feat(factory): chain termination semantics + AFK hook isolation** (#4166)
-- **feat(factory): v2 headless-chain hardening — AFK profile, cwd passthrough, watchdog, enqueuer registration** (#4153)
-- **feat: software factory closed loop (SessionEnd chain trigger + tracker intake)** (#4151)
-- **feat: host-load gate for concurrent sessions** (#4150)
-- **feat(skills): unattended-run hardening - closeouts, AFK protocol, budget stop, guardrails, headless intake** (#4113)
-- **feat(cli): omc intake - the harbor headless sweep and its host-native schedule** (#4143)
-- **feat(hooks): budget-guard - enforce OMC_RUN_BUDGET_TOKENS at Stop** (#4117)
-- **feat(skills): map - the yard's skill map, one router for 47 skills** (#4116)
-- **feat(skills): close the delivery loop - tdd discipline, debugger seam findings, refit bite-proof, two-axis review** (#4112)
-- **feat(skills): add refit and pr skills, harden launch frontier execution** (#4110)
-- **feat(jev): record token usage in the shadow log and add OMC_JEV_QUIET** (#4107)
-- **feat(jev): wire slop-warning through the script-side judgment channel** (#4095)
-- **feat(jev): env-activated active mode and script-side judgment channel** (#4093)
-
-### Bug Fixes
-
-- **fix(team): make native addon error explicit for darwin** (#4197)
-- **fix(team): add OMC_TEAM_WORKER_ENV_PASSTHROUGH for custom provider credentials** (#4196)
-- **fix(team): use dynamic window index for detached sessions instead of hardcoded :0** (#4198)
-- **fix(team): use load-buffer + paste-buffer for long tmux worker commands** (#4195)
-- **fix(workflow-drift-guard): don't flag runtime-conditional test.skip as a skipped test** (#4190)
-- **fix(lsp): normalize diagnostic URI keys so Windows drive-letter encoding matches** (#4186)
-- **fix(session-end): pass model-provider auth through to action runner children** (#4178)
-- **fix(hooks): stop the directory-context walk at the real working directory** (#4177)
-- **fix(session-end): make the project route table the single source of truth** (#4176)
-- **fix(bridge): symlink-robust main-module dispatch and loud session-end forward failures** (#4171)
-- **fix(session-end): treat headless completion reason=other as success** (#4172)
-- **fix(session-end): route gh tracker spawns through cmd.exe on win32** (#4174)
-- **fix(session-end): always launch the worker once the chain is enqueued** (#4175)
-- **fix(session-end): plan chain enqueue on the plugin-path SessionEnd bootstrap** (#4170)
-- **fix(session-end): forward ANTHROPIC_* and OMC_HOOK_BRIDGE to session-end workers** (#4168)
-- **fix(team): preserve Claude worker profile env** (#4167)
-- **fix(hooks): read the XDG global config in the code-simplifier Stop hook** (#4160)
-- **fix(rules-injector): let **/ match zero directories in rule globs** (#4161)
-- **fix(installer): escape newlines in Codex MCP TOML strings** (#4158)
-- **fix(atomic-write): tolerate zero lstat dev on Windows in file identity checks** (#4159)
-- **fix(cli): launch claude via COMSPEC on Windows instead of shell:true** (#4155)
-- **fix(hooks): skip every git global option in git-guardrails** (#4152)
-- **fix: Handle non-interactive stdin in uninstall script** (#17)
-- **fix: port Windows processStart encoding to .mjs copies** (#4148)
-- **fix: state-lock owner-file fallback race condition breaks mutual exclusion** (#4149)
-- **fix(omc-setup): drop leading slash from star endpoint for Git Bash** (#4145)
-- **fix(team): give Claude startup evidence a final recheck window** (#4135)
-- **fix(team): merge unobserved worker commits at shutdown** (#4133)
-- **fix(team): recognize current Claude Code busy s
```

**File**: `CHANGELOG.md` (modified, +3/-100)
```diff
@@ -1,106 +1,9 @@
-# oh-my-claudecode v5.6.0: omc ralph verify, omc ralph afk, risk-ordered stories, repo
+# oh-my-claudecode v5.6.1: Maintenance Release
 
 ## Release Notes
 
-Release with **19 new features**, **47 bug fixes**, **7 other changes** across **78 merged PRs**.
-
-### Highlights
-
-- **feat(ralph): omc ralph verify — the single executor of the feedback diff** (#4188)
-- **feat(ralph): omc ralph afk — headless isolated launch + fix win32 .cmd spawn routing** (#4187)
-- **feat(ralph): risk-ordered stories, repo quality class, and a feedback baseline** (#4184)
-- **feat(session-end): let a route stage declare its AFK verify commands** (#4179)
-- **feat(session-end): daily-chain-limit env override + diff-first gate doctrine** (#4182)
-
-### New Features
-
-- **feat(ralph): omc ralph verify — the single executor of the feedback diff** (#4188)
-- **feat(ralph): omc ralph afk — headless isolated launch + fix win32 .cmd spawn routing** (#4187)
-- **feat(ralph): risk-ordered stories, repo quality class, and a feedback baseline** (#4184)
-- **feat(session-end): let a route stage declare its AFK verify commands** (#4179)
-- **feat(session-end): daily-chain-limit env override + diff-first gate doctrine** (#4182)
-- **feat(factory): enforcement layer completion - CI trigger, factory init, check evidence, diff-first, daily cap** (#4183)
-- **feat(factory): chain termination semantics + AFK hook isolation** (#4166)
-- **feat(factory): v2 headless-chain hardening — AFK profile, cwd passthrough, watchdog, enqueuer registration** (#4153)
-- **feat: software factory closed loop (SessionEnd chain trigger + tracker intake)** (#4151)
-- **feat: host-load gate for concurrent sessions** (#4150)
-- **feat(skills): unattended-run hardening - closeouts, AFK protocol, budget stop, guardrails, headless intake** (#4113)
-- **feat(cli): omc intake - the harbor headless sweep and its host-native schedule** (#4143)
-- **feat(hooks): budget-guard - enforce OMC_RUN_BUDGET_TOKENS at Stop** (#4117)
-- **feat(skills): map - the yard's skill map, one router for 47 skills** (#4116)
-- **feat(skills): close the delivery loop - tdd discipline, debugger seam findings, refit bite-proof, two-axis review** (#4112)
-- **feat(skills): add refit and pr skills, harden launch frontier execution** (#4110)
-- **feat(jev): record token usage in the shadow log and add OMC_JEV_QUIET** (#4107)
-- **feat(jev): wire slop-warning through the script-side judgment channel** (#4095)
-- **feat(jev): env-activated active mode and script-side judgment channel** (#4093)
-
-### Bug Fixes
-
-- **fix(team): make native addon error explicit for darwin** (#4197)
-- **fix(team): add OMC_TEAM_WORKER_ENV_PASSTHROUGH for custom provider credentials** (#4196)
-- **fix(team): use dynamic window index for detached sessions instead of hardcoded :0** (#4198)
-- **fix(team): use load-buffer + paste-buffer for long tmux worker commands** (#4195)
-- **fix(workflow-drift-guard): don't flag runtime-conditional test.skip as a skipped test** (#4190)
-- **fix(lsp): normalize diagnostic URI keys so Windows drive-letter encoding matches** (#4186)
-- **fix(session-end): pass model-provider auth through to action runner children** (#4178)
-- **fix(hooks): stop the directory-context walk at the real working directory** (#4177)
-- **fix(session-end): make the project route table the single source of truth** (#4176)
-- **fix(bridge): symlink-robust main-module dispatch and loud session-end forward failures** (#4171)
-- **fix(session-end): treat headless completion reason=other as success** (#4172)
-- **fix(session-end): route gh tracker spawns through cmd.exe on win32** (#4174)
-- **fix(session-end): always launch the worker once the chain is enqueued** (#4175)
-- **fix(session-end): plan chain enqueue on the plugin-path SessionEnd bootstrap** (#4170)
-- **fix(session-end): forward ANTHROPIC_* and OMC_HOOK_BRIDGE to session-end workers** (#4168)
-- **fix(team): preserve Claude worker profile env** (#4167)
-- **fix(hooks): read the XDG global config in the code-simplifier Stop hook** (#4160)
-- **fix(rules-injector): let **/ match zero directories in rule globs** (#4161)
-- **fix(installer): escape newlines in Codex MCP TOML strings** (#4158)
-- **fix(atomic-write): tolerate zero lstat dev on Windows in file identity checks** (#4159)
-- **fix(cli): launch claude via COMSPEC on Windows instead of shell:true** (#4155)
-- **fix(hooks): skip every git global option in git-guardrails** (#4152)
-- **fix: Handle non-interactive stdin in uninstall script** (#17)
-- **fix: port Windows processStart encoding to .mjs copies** (#4148)
-- **fix: state-lock owner-file fallback race condition breaks mutual exclusion** (#4149)
-- **fix(omc-setup): drop leading slash from star endpoint for Git Bash** (#4145)
-- **fix(team): give Claude startup evidence a final recheck window** (#4135)
-- **fix(team): merge unobserved worker commits at shutdown** (#4133)
-- **fix(team): recognize current Claude Code busy sp
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 <!-- OMC:START -->
-<!-- OMC:VERSION:5.6.0 -->
+<!-- OMC:VERSION:5.6.1 -->
 
 # oh-my-claudecode - Intelligent Multi-Agent Orchestration
 
```

**File**: `bridge/claude-md-coordinator.cjs` (modified, +2/-2)
```diff
@@ -875,8 +875,8 @@ function executeClaudeMdTransaction(request) {
 
 // src/cli/claude-md-coordinator.ts
 var CLAUDE_MD_COORDINATOR_SCHEMA_VERSION = 1;
-var COMPILED_ENGINE_VERSION = true ? "5.6.0" : "";
-var COMPILED_SOURCE_SHA256 = true ? "53d50a14fb5ba35f95d29f80341d9685b1a1fee647dc5f387d8e30979c841f91" : "";
+var COMPILED_ENGINE_VERSION = true ? "5.6.1" : "";
+var COMPILED_SOURCE_SHA256 = true ? "6eea1bd7399da015533c5df66866485e1ba9290eb2a6842fd1e5b427f3042c60" : "";
 function runClaudeMdCoordinatorHandshake() {
   if (!COMPILED_ENGINE_VERSION || !COMPILED_SOURCE_SHA256) {
     return { exitCode: 2, response: coordinatorError(2, "Coordinator build handshake is unavailable") };
```

**File**: `bridge/team-bridge.cjs` (modified, +171/-141)
```diff
@@ -1148,13 +1148,13 @@ var init_worker_canonicalization = __esm({
 });
 
 // src/team/monitor.ts
-var import_fs8, import_promises, import_path8;
+var import_fs11, import_promises2, import_path11;
 var init_monitor = __esm({
   "src/team/monitor.ts"() {
     "use strict";
-    import_fs8 = require("fs");
-    import_promises = require("fs/promises");
-    import_path8 = require("path");
+    import_fs11 = require("fs");
+    import_promises2 = require("fs/promises");
+    import_path11 = require("path");
     init_types2();
     init_contracts();
     init_state_paths();
@@ -1172,14 +1172,14 @@ __export(bridge_entry_exports, {
   validateConfigPath: () => validateConfigPath
 });
 module.exports = __toCommonJS(bridge_entry_exports);
-var import_fs18 = require("fs");
-var import_path18 = require("path");
-var import_os4 = require("os");
+var import_fs21 = require("fs");
+var import_path21 = require("path");
+var import_os6 = require("os");
 
 // src/team/mcp-team-bridge.ts
 var import_child_process5 = require("child_process");
-var import_fs17 = require("fs");
-var import_path17 = require("path");
+var import_fs20 = require("fs");
+var import_path20 = require("path");
 
 // src/team/fs-utils.ts
 var import_fs = require("fs");
@@ -1237,18 +1237,18 @@ function validateResolvedPath(resolvedPath, expectedBase) {
 init_worktree_paths();
 
 // src/team/task-file-ops.ts
-var import_fs10 = require("fs");
-var import_path10 = require("path");
+var import_fs13 = require("fs");
+var import_path13 = require("path");
 init_worktree_paths();
 init_config_dir();
 
 // src/team/tmux-session.ts
-var import_fs9 = require("fs");
-var import_crypto4 = require("crypto");
+var import_fs12 = require("fs");
+var import_crypto5 = require("crypto");
 var import_child_process4 = require("child_process");
 var import_util3 = require("util");
-var import_path9 = require("path");
-var import_os3 = require("os");
+var import_path12 = require("path");
+var import_os5 = require("os");
 
 // src/cli/tmux-utils.ts
 var import_child_process2 = require("child_process");
@@ -1258,6 +1258,7 @@ var import_util = require("util");
 // src/team/tmux-session.ts
 init_types();
 init_team_owner_epoch();
+init_native_contained_fs();
 
 // src/platform/process-utils.ts
 var import_child_process3 = require("child_process");
@@ -1435,6 +1436,35 @@ function withFileLockSync(lockPath, fn, opts) {
   }
 }
 
+// src/lib/host-load-gate.ts
+var import_os4 = require("os");
+var import_fs9 = require("fs");
+var import_path9 = require("path");
+
+// src/utils/paths.ts
+var import_path8 = require("path");
+var import_fs8 = require("fs");
+var import_os3 = require("os");
+init_config_dir();
+
+// src/utils/cache-occupancy.ts
+var import_fs7 = require("fs");
+var import_promises = require("fs/promises");
+var import_crypto3 = require("crypto");
+var import_path7 = require("path");
+init_config_dir();
+
+// src/utils/paths.ts
+var PLUGIN_ROOT_REQUIREMENTS = [
+  (0, import_path8.join)("hooks", "hooks.json"),
+  (0, import_path8.join)("scripts", "run.cjs"),
+  "scripts"
+];
+var OCCUPIED_CODES = new Set(
+  process.platform === "win32" ? ["EEXIST", "ENOTEMPTY", "ENOTDIR", "EISDIR", "EPERM", "EACCES"] : ["EEXIST", "ENOTEMPTY", "ENOTDIR", "EISDIR"]
+);
+var STALE_THRESHOLD_MS = 10 * 60 * 1e3;
+
 // src/team/worker-launch-ack.ts
 var WORKER_LAUNCH_RECOVERY_GATE_CONTAINED_ENV = "OMC_WORKER_LAUNCH_RECOVERY_GATE_CONTAINED";
 var WORKER_LAUNCH_INTERNAL_ENV_KEYS = /* @__PURE__ */ new Set([
@@ -1446,9 +1476,9 @@ var WORKER_LAUNCH_INTERNAL_ENV_KEYS = /* @__PURE__ */ new Set([
 var WINDOWS_RESERVED_ENV_KEYS = new Set([...WORKER_LAUNCH_INTERNAL_ENV_KEYS, "SystemRoot"].map((key) => key.toUpperCase()));
 
 // src/team/recovery-request-store.ts
-var import_crypto3 = require("crypto");
-var import_fs7 = require("fs");
-var import_path7 = require("path");
+var import_crypto4 = require("crypto");
+var import_fs10 = require("fs");
+var import_path10 = require("path");
 init_types();
 init_state_paths();
 init_process_identity_lock();
@@ -1482,22 +1512,22 @@ function acquireTaskLock(teamName, taskId, opts) {
   const staleLockMs = opts?.staleLockMs ?? DEFAULT_STALE_LOCK_MS2;
   const dir = canonicalTasksDir(teamName, opts?.cwd);
   ensureDirWithMode(dir);
-  const lockPath = (0, import_path10.join)(dir, `${normalizeTaskFileStem(sanitizeTaskId(taskId))}.lock`);
+  const lockPath = (0, import_path13.join)(dir, `${normalizeTaskFileStem(sanitizeTaskId(taskId))}.lock`);
   for (let attempt = 0; attempt < 2; attempt++) {
     try {
-      const fd = (0, import_fs10.openSync)(lockPath, import_fs10.constants.O_CREAT | import_fs10.constants.O_EXCL | import_fs10.constants.O_WRONLY, 384);
+      const fd = (0, import_fs13.openSync)(lockPath, import_fs13.constants.O_CREAT | import_fs13.constants.O_EXCL | import_fs13.constants.O_WRONLY, 384);
       const payload = JSON.stringify({
         pid: process.pid,
         workerName: opts?.workerName ?? "",
         timestamp: Date.now()
       });
-      (0,
```

---

### Incident Patch 6: `e74b22cd` (2026-10-01)
**Commit Message**: fix(release): append #4200 authorization after the #3537 fixture entry

The generated-artifact-authorization tests read authorizations[0] as the
#3537 fixture; prepending the v5.6.0 entry broke 4 tests on main and blocked
the v5.6.0 tag publish.

**File**: `.github/generated-artifact-authorizations.json` (modified, +20/-20)
```diff
@@ -3,26 +3,6 @@
   "repository": "Yeachan-Heo/oh-my-claudecode",
   "owner": "Yeachan-Heo",
   "authorizations": [
-    {
-      "pullNumber": 4200,
-      "targetRef": "main",
-      "mergeBaseSha": "134f4c96e2bdc0e10a0ee6bbbd413ded0d3c57b6",
-      "headSha": "624380ced75db81df273b0f9fe3584e96994d00a",
-      "owner": "Yeachan-Heo",
-      "expiresAt": "2026-12-31T23:59:59.999Z",
-      "generatedDelta": {
-        "count": 1,
-        "sha256": "b20f515d89a4bf7550cdc7994fd8b9ada0b8c6e10dba22448dbd6ce3afb65ff1"
-      },
-      "generatedFiles": [
-        {
-          "status": "modified",
-          "filename": "bridge/claude-md-coordinator.cjs",
-          "sha": "dd9babfd7e2dc721f8a712f54f12e882689381dc",
-          "previousFilename": null
-        }
-      ]
-    },
     {
       "pullNumber": 3537,
       "targetRef": "main",
@@ -19916,6 +19896,26 @@
           "previousFilename": null
         }
       ]
+    },
+    {
+      "pullNumber": 4200,
+      "targetRef": "main",
+      "mergeBaseSha": "134f4c96e2bdc0e10a0ee6bbbd413ded0d3c57b6",
+      "headSha": "624380ced75db81df273b0f9fe3584e96994d00a",
+      "owner": "Yeachan-Heo",
+      "expiresAt": "2026-12-31T23:59:59.999Z",
+      "generatedDelta": {
+        "count": 1,
+        "sha256": "b20f515d89a4bf7550cdc7994fd8b9ada0b8c6e10dba22448dbd6ce3afb65ff1"
+      },
+      "generatedFiles": [
+        {
+          "status": "modified",
+          "filename": "bridge/claude-md-coordinator.cjs",
+          "sha": "dd9babfd7e2dc721f8a712f54f12e882689381dc",
+          "previousFilename": null
+        }
+      ]
     }
   ]
 }
```

---

### Incident Patch 7: `3e572b6e` (2026-10-01)
**Commit Message**: ci: fix merge base for PR #4200 v5.6.0 authorization

**File**: `.github/generated-artifact-authorizations.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     {
       "pullNumber": 4200,
       "targetRef": "main",
-      "mergeBaseSha": "9fd35ece5d6de65b511bf43b55e42c499e4fc194",
+      "mergeBaseSha": "134f4c96e2bdc0e10a0ee6bbbd413ded0d3c57b6",
       "headSha": "624380ced75db81df273b0f9fe3584e96994d00a",
       "owner": "Yeachan-Heo",
       "expiresAt": "2026-12-31T23:59:59.999Z",
```

---

### Incident Patch 8: `207f70e1` (2026-10-01)
**Commit Message**: Merge pull request #4197 from Yeachan-Heo/fix/issue-4192

fix(team): make native addon error explicit for darwin (#4192)

**File**: `inventory/inventory-graph.json` (modified, +12/-7)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "194e4e25bbd7932d69ad4228395471409f47bf6a",
-    "sourceSha256": "8cf2e895902ba9b7d5ae0cec51bf1cf8a97ad3f796eb9ee29c85d7296722336b",
+    "head": "9cabaa0f2b19997e2eff65d4493929c28b45d664",
+    "sourceSha256": "6c3ec179bb94dbc82efad916d4441c06aae0e338ed99f67c46c3afa44f42459a",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "194e4e25bbd7932d69ad4228395471409f47bf6a",
-  "sourceSha256": "8cf2e895902ba9b7d5ae0cec51bf1cf8a97ad3f796eb9ee29c85d7296722336b",
+  "head": "9cabaa0f2b19997e2eff65d4493929c28b45d664",
+  "sourceSha256": "6c3ec179bb94dbc82efad916d4441c06aae0e338ed99f67c46c3afa44f42459a",
   "counts": {
     "public": {
       "skills": 47,
@@ -79279,6 +79279,11 @@
         "to": "src/cli/tmux-utils.ts",
         "kind": "imports"
       },
+      {
+        "from": "src/team/tmux-session.ts",
+        "to": "src/graph/runtime/native-contained-fs.ts",
+        "kind": "imports"
+      },
       {
         "from": "src/team/tmux-session.ts",
         "to": "src/team/mailbox-notification-guard.ts",
@@ -83202,11 +83207,11 @@
     ],
     "stats": {
       "nodeCount": 7136,
-      "edgeCount": 8195,
-      "importEdgeCount": 6775,
+      "edgeCount": 8196,
+      "importEdgeCount": 6776,
       "registerEdgeCount": 68
     }
   },
   "inventorySha256": "22877059424c133590a79746788b8397ed7349e005a636cd24546faea841ede0",
-  "manifestSha256": "da033fb158d7c6579d24c15da2e7068d159aa8dff56bc8773e43a5a64024bdab"
+  "manifestSha256": "a65c81a987935106a10a737fe19e2d4198ebbecab4e8589b2d4f9d30a014a225"
 }
```

**File**: `src/graph/runtime/native-contained-fs.ts` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ export function getNativeContainedFs(): NativeContainedFs {
           loaded = createRequire(import.meta.url)(binary) as NativeContainedFs;
           return loaded;
         } catch (cause) {
-          throw new Error(`The contained filesystem backend is unavailable at ${binary}. Build it with node scripts/build-contained-fs.mjs before running graph commands.`, { cause });
+          throw new Error(`The contained filesystem backend is unavailable at ${binary}. Build it with node scripts/build-contained-fs.mjs (from the installed package directory) before running graph or team commands.`, { cause });
         }
       }
     }
```

**File**: `src/team/__tests__/tmux-session.create-team.test.ts` (modified, +23/-0)
```diff
@@ -233,6 +233,7 @@ import {
   detectTeamMultiplexerContext,
   splitTeamWorkerPane,
   splitTeamWorkerPaneWithEvidence,
+  strictIdentityUnavailableError,
   TeamSessionCreationError,
 } from '../tmux-session.js';
 
@@ -892,3 +893,25 @@ describe('splitTeamWorkerPane multiplexer routing (#3267)', () => {
     });
   });
 });
+
+describe('strictIdentityUnavailableError (issue #4192)', () => {
+  it('names the missing darwin contained-fs addon and its build command', () => {
+    const missing = new Error('The contained filesystem backend is unavailable at /pkg/native/contained-fs-darwin-arm64.node. Build it with node scripts/build-contained-fs.mjs (from the installed package directory) before running graph or team commands.');
+    const error = strictIdentityUnavailableError('darwin', () => { throw missing; });
+    expect(error.message).toMatch(/^tmux_server_identity_probe_unavailable: /);
+    expect(error.message).toContain('contained-fs-darwin-arm64.node');
+    expect(error.message).toContain('scripts/build-contained-fs.mjs');
+    expect(error.cause).toBe(missing);
+  });
+
+  it('keeps the bare code when the darwin addon loads but the probe still fails', () => {
+    const error = strictIdentityUnavailableError('darwin', () => ({}));
+    expect(error.message).toBe('tmux_server_identity_probe_unavailable');
+  });
+
+  it('does not consult the addon on other platforms', () => {
+    const loadNative = vi.fn(() => { throw new Error('should not load'); });
+    expect(strictIdentityUnavailableError('win32', loadNative).message).toBe('tmux_server_identity_probe_unavailable');
+    expect(loadNative).not.toHaveBeenCalled();
+  });
+});
```

**File**: `src/team/tmux-session.ts` (modified, +22/-1)
```diff
@@ -29,6 +29,7 @@ import {
   observeProcessIdentity,
   type ProcessIdentityObservation,
 } from './team-owner-epoch.js';
+import { getNativeContainedFs } from '../graph/runtime/native-contained-fs.js';
 import { paneLineLooksLikeIdlePrompt } from './pane-readiness.js';
 import {
   awaitWorkerLaunchAcknowledgement,
@@ -1915,6 +1916,26 @@ export async function splitTeamWorkerPane(
   return (await splitTeamWorkerPaneWithEvidence(splitTarget, direction, cwd)).paneId;
 }
 
+/**
+ * Darwin strict identity comes only from the contained-fs native addon (no
+ * sysctl/ps fallback), so a missing addon is the common cause of an unavailable
+ * probe there. Name it and the build command instead of a bare error code.
+ */
+export function strictIdentityUnavailableError(
+  platform: NodeJS.Platform,
+  loadNative: () => unknown = getNativeContainedFs,
+): Error {
+  if (platform === 'darwin') {
+    try {
+      loadNative();
+    } catch (cause) {
+      const detail = cause instanceof Error ? cause.message : String(cause);
+      return new Error(`tmux_server_identity_probe_unavailable: ${detail}`, { cause });
+    }
+  }
+  return new Error('tmux_server_identity_probe_unavailable');
+}
+
 export async function createTeamSession(
   teamName: string,
   workerCount: number,
@@ -1933,7 +1954,7 @@ export async function createTeamSession(
   // an empty private server held without an ownership token. CMUX has its own
   // provider identity and is intentionally excluded.
   if (!inCmux && !currentStrictProcessStartIdentity()) {
-    throw new Error('tmux_server_identity_probe_unavailable');
+    throw strictIdentityUnavailableError(process.platform);
   }
   let tmuxServerIdentity: TmuxServerIdentity | undefined;
   let freshDetachedServerIdentity: TmuxServerIdentity | undefined;
```

---

### Incident Patch 9: `105ffb5d` (2026-10-01)
**Commit Message**: Merge remote-tracking branch 'origin/dev' into fix/issue-4192

# Conflicts:
#	inventory/inventory-graph.json

**File**: `inventory/inventory-graph.json` (modified, +5/-5)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "0196371a21f8629946b1067b9a800c6aca18ebd0",
-    "sourceSha256": "6b5de51cfc6d891a64ab93d857baa3ca6c409410f09baa98da93be8a055b46aa",
+    "head": "9cabaa0f2b19997e2eff65d4493929c28b45d664",
+    "sourceSha256": "6c3ec179bb94dbc82efad916d4441c06aae0e338ed99f67c46c3afa44f42459a",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "0196371a21f8629946b1067b9a800c6aca18ebd0",
-  "sourceSha256": "6b5de51cfc6d891a64ab93d857baa3ca6c409410f09baa98da93be8a055b46aa",
+  "head": "9cabaa0f2b19997e2eff65d4493929c28b45d664",
+  "sourceSha256": "6c3ec179bb94dbc82efad916d4441c06aae0e338ed99f67c46c3afa44f42459a",
   "counts": {
     "public": {
       "skills": 47,
@@ -83213,5 +83213,5 @@
     }
   },
   "inventorySha256": "22877059424c133590a79746788b8397ed7349e005a636cd24546faea841ede0",
-  "manifestSha256": "b614da3ca7639ef519c550b549c86d808d3cfde197d1905ec4591d4cd394a0db"
+  "manifestSha256": "a65c81a987935106a10a737fe19e2d4198ebbecab4e8589b2d4f9d30a014a225"
 }
```

**File**: `src/team/__tests__/worker-launch-ack.test.ts` (modified, +118/-0)
```diff
@@ -2932,4 +2932,122 @@ describe('worker launch acknowledgement', () => {
     await symlink(materialized.wrapperPath, materialized.bootstrapDescriptorPath);
     await expect(readAndConsumeWorkerLaunchDescriptor(materialized.bootstrapDescriptorPath)).rejects.toThrow();
   });
+
+  it('resolves env passthrough at provider exec time without persisting to bootstrap.json', async () => {
+    const sourceEnv = {
+      PATH: '/usr/bin:/bin',
+      HOME: '/home/provider',
+      CUSTOM_PROVIDER_TOKEN: 'secret-token-123',
+      ANOTHER_CUSTOM_VAR: 'another-value',
+    };
+
+    // Verify that without passthrough, custom vars are NOT in the environment
+    const runtimeEnv = buildProviderEnvironment(
+      { EXPLICIT: 'yes' },
+      sourceEnv,
+      'linux',
+    );
+    expect(runtimeEnv).toHaveProperty('EXPLICIT', 'yes');
+    expect(runtimeEnv).not.toHaveProperty('CUSTOM_PROVIDER_TOKEN');
+    expect(runtimeEnv).not.toHaveProperty('ANOTHER_CUSTOM_VAR');
+
+    // Verify that custom vars ARE included when passthrough is specified
+    const runtimeEnvWithPassthrough = buildProviderEnvironment(
+      { EXPLICIT: 'yes' },
+      sourceEnv,
+      'linux',
+      ['CUSTOM_PROVIDER_TOKEN', 'ANOTHER_CUSTOM_VAR'],
+    );
+    expect(runtimeEnvWithPassthrough).toHaveProperty('EXPLICIT', 'yes');
+    expect(runtimeEnvWithPassthrough).toHaveProperty('CUSTOM_PROVIDER_TOKEN', 'secret-token-123');
+    expect(runtimeEnvWithPassthrough).toHaveProperty('ANOTHER_CUSTOM_VAR', 'another-value');
+
+    // Passthrough vars that don't exist in sourceEnv should be silently skipped
+    const runtimeEnvMissingVar = buildProviderEnvironment(
+      { EXPLICIT: 'yes' },
+      sourceEnv,
+      'linux',
+      ['NONEXISTENT_VAR', 'CUSTOM_PROVIDER_TOKEN'],
+    );
+    expect(runtimeEnvMissingVar).toHaveProperty('CUSTOM_PROVIDER_TOKEN', 'secret-token-123');
+    expect(runtimeEnvMissingVar).not.toHaveProperty('NONEXISTENT_VAR');
+  });
+
+  it('parses OMC_TEAM_WORKER_ENV_PASSTHROUGH from source environment', () => {
+    const sourceEnv = {
+      PATH: '/usr/bin',
+      HOME: '/home/user',
+      OMC_TEAM_WORKER_ENV_PASSTHROUGH: 'CUSTOM_VAR1, CUSTOM_VAR2, CUSTOM_VAR3',
+      CUSTOM_VAR1: 'value1',
+      CUSTOM_VAR2: 'value2',
+      CUSTOM_VAR3: 'value3',
+    };
+
+    // When OMC_TEAM_WORKER_ENV_PASSTHROUGH is set, those vars should be included
+    const runtimeEnv = buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'linux',
+    );
+    expect(runtimeEnv).toHaveProperty('CUSTOM_VAR1', 'value1');
+    expect(runtimeEnv).toHaveProperty('CUSTOM_VAR2', 'value2');
+    expect(runtimeEnv).toHaveProperty('CUSTOM_VAR3', 'value3');
+    // The passthrough env var itself should NOT be in the output
+    expect(runtimeEnv).not.toHaveProperty('OMC_TEAM_WORKER_ENV_PASSTHROUGH');
+  });
+
+  it('validates passthrough env var names and rejects invalid syntax', () => {
+    const sourceEnv = {
+      PATH: '/usr/bin',
+      HOME: '/home/user',
+      VALID_NAME: 'value',
+    };
+
+    // Valid names should work
+    expect(() => buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'linux',
+      ['VALID_NAME', '_UNDERSCORE_PREFIX', 'VAR123'],
+    )).not.toThrow();
+
+    // Invalid names should be rejected
+    expect(() => buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'linux',
+      ['INVALID-NAME'],
+    )).toThrow('worker_launch_env_passthrough_key_invalid');
+
+    expect(() => buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'linux',
+      ['123INVALID'],
+    )).toThrow('worker_launch_env_passthrough_key_invalid');
+  });
+
+  it('rejects reserved and internal env var names in passthrough', () => {
+    const sourceEnv = {
+      PATH: '/usr/bin',
+      HOME: '/home/user',
+      OMC_WORKER_LAUNCH_SPEC: 'value',
+    };
+
+    // Internal keys should be rejected
+    expect(() => buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'linux',
+      ['OMC_WORKER_LAUNCH_SPEC'],
+    )).toThrow('worker_launch_env_passthrough_key_reserved');
+
+    // Windows reserved keys should be rejected on win32
+    expect(() => buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'win32',
+      ['SYSTEMROOT'],
+    )).toThrow('worker_launch_env_passthrough_key_reserved');
+  });
 });
\ No newline at end of file
```

**File**: `src/team/worker-launch-ack.ts` (modified, +18/-0)
```diff
@@ -246,10 +246,17 @@ function isValidProviderEnvironment(value: unknown, platform: NodeJS.Platform =
   try { normalizeProviderEnvironment(value as Record<string, string>, platform); return true; } catch { return false; }
 }
 
+function parseEnvPassthrough(value: string | undefined): string[] {
+  if (!value || value.trim().length === 0) return [];
+  // Split by comma and trim each key
+  return value.split(',').map(k => k.trim()).filter(k => k.length > 0);
+}
+
 export function buildProviderEnvironment(
   providerEnv: NodeJS.ProcessEnv | Record<string, string> | undefined,
   sourceEnv: NodeJS.ProcessEnv = process.env,
   platform: NodeJS.Platform = process.platform,
+  envPassthrough?: readonly string[],
 ): Record<string, string> {
   const normalized = normalizeProviderEnvironment(providerEnv, platform);
   const baseline: Record<string, string> = {};
@@ -265,6 +272,17 @@ export function buildProviderEnvironment(
   const homeKey = platform === 'win32' ? 'USERPROFILE' : 'HOME';
   const home = sourceEnv[homeKey];
   if (typeof home === 'string' && home.length > 0) baseline[homeKey] = home;
+
+  // Resolve passthrough environment variables from the source environment
+  const passthroughList = envPassthrough ?? parseEnvPassthrough(sourceEnv.OMC_TEAM_WORKER_ENV_PASSTHROUGH);
+  for (const key of passthroughList) {
+    if (!isValidEnvironmentKey(key)) throw new Error('worker_launch_env_passthrough_key_invalid');
+    if (WORKER_LAUNCH_INTERNAL_ENV_KEYS.has(key)) throw new Error('worker_launch_env_passthrough_key_reserved');
+    if (platform === 'win32' && WINDOWS_RESERVED_ENV_KEYS.has(key.toUpperCase())) throw new Error('worker_launch_env_passthrough_key_reserved');
+    const value = sourceEnv[key];
+    if (typeof value === 'string') baseline[key] = value;
+  }
+
   if (platform === 'win32') {
     for (const key of Object.keys(normalized)) {
       const baselineKey = Object.keys(baseline).find(candidate => candidate.toUpperCase() === key.toUpperCase());
```

---

### Incident Patch 10: `ebd05f86` (2026-10-01)
**Commit Message**: Merge pull request #4196 from Yeachan-Heo/fix/issue-4194

fix(team): add OMC_TEAM_WORKER_ENV_PASSTHROUGH for custom provider credentials (#4194)

**File**: `inventory/inventory-graph.json` (modified, +5/-5)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "e1f993028306aa8f72c9ef54e72c2770978cc8f6",
-    "sourceSha256": "f2f73e4bf79e74d8a348d58d5f4a8bbc83b522ca816fed202b524e12027af2ba",
+    "head": "194e4e25bbd7932d69ad4228395471409f47bf6a",
+    "sourceSha256": "8cf2e895902ba9b7d5ae0cec51bf1cf8a97ad3f796eb9ee29c85d7296722336b",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "e1f993028306aa8f72c9ef54e72c2770978cc8f6",
-  "sourceSha256": "f2f73e4bf79e74d8a348d58d5f4a8bbc83b522ca816fed202b524e12027af2ba",
+  "head": "194e4e25bbd7932d69ad4228395471409f47bf6a",
+  "sourceSha256": "8cf2e895902ba9b7d5ae0cec51bf1cf8a97ad3f796eb9ee29c85d7296722336b",
   "counts": {
     "public": {
       "skills": 47,
@@ -83208,5 +83208,5 @@
     }
   },
   "inventorySha256": "22877059424c133590a79746788b8397ed7349e005a636cd24546faea841ede0",
-  "manifestSha256": "48cac124c08ae9174d4257c06c32f59675f131c4327e797bfd59793e0867b0ea"
+  "manifestSha256": "da033fb158d7c6579d24c15da2e7068d159aa8dff56bc8773e43a5a64024bdab"
 }
```

**File**: `src/team/__tests__/worker-launch-ack.test.ts` (modified, +118/-0)
```diff
@@ -2932,4 +2932,122 @@ describe('worker launch acknowledgement', () => {
     await symlink(materialized.wrapperPath, materialized.bootstrapDescriptorPath);
     await expect(readAndConsumeWorkerLaunchDescriptor(materialized.bootstrapDescriptorPath)).rejects.toThrow();
   });
+
+  it('resolves env passthrough at provider exec time without persisting to bootstrap.json', async () => {
+    const sourceEnv = {
+      PATH: '/usr/bin:/bin',
+      HOME: '/home/provider',
+      CUSTOM_PROVIDER_TOKEN: 'secret-token-123',
+      ANOTHER_CUSTOM_VAR: 'another-value',
+    };
+
+    // Verify that without passthrough, custom vars are NOT in the environment
+    const runtimeEnv = buildProviderEnvironment(
+      { EXPLICIT: 'yes' },
+      sourceEnv,
+      'linux',
+    );
+    expect(runtimeEnv).toHaveProperty('EXPLICIT', 'yes');
+    expect(runtimeEnv).not.toHaveProperty('CUSTOM_PROVIDER_TOKEN');
+    expect(runtimeEnv).not.toHaveProperty('ANOTHER_CUSTOM_VAR');
+
+    // Verify that custom vars ARE included when passthrough is specified
+    const runtimeEnvWithPassthrough = buildProviderEnvironment(
+      { EXPLICIT: 'yes' },
+      sourceEnv,
+      'linux',
+      ['CUSTOM_PROVIDER_TOKEN', 'ANOTHER_CUSTOM_VAR'],
+    );
+    expect(runtimeEnvWithPassthrough).toHaveProperty('EXPLICIT', 'yes');
+    expect(runtimeEnvWithPassthrough).toHaveProperty('CUSTOM_PROVIDER_TOKEN', 'secret-token-123');
+    expect(runtimeEnvWithPassthrough).toHaveProperty('ANOTHER_CUSTOM_VAR', 'another-value');
+
+    // Passthrough vars that don't exist in sourceEnv should be silently skipped
+    const runtimeEnvMissingVar = buildProviderEnvironment(
+      { EXPLICIT: 'yes' },
+      sourceEnv,
+      'linux',
+      ['NONEXISTENT_VAR', 'CUSTOM_PROVIDER_TOKEN'],
+    );
+    expect(runtimeEnvMissingVar).toHaveProperty('CUSTOM_PROVIDER_TOKEN', 'secret-token-123');
+    expect(runtimeEnvMissingVar).not.toHaveProperty('NONEXISTENT_VAR');
+  });
+
+  it('parses OMC_TEAM_WORKER_ENV_PASSTHROUGH from source environment', () => {
+    const sourceEnv = {
+      PATH: '/usr/bin',
+      HOME: '/home/user',
+      OMC_TEAM_WORKER_ENV_PASSTHROUGH: 'CUSTOM_VAR1, CUSTOM_VAR2, CUSTOM_VAR3',
+      CUSTOM_VAR1: 'value1',
+      CUSTOM_VAR2: 'value2',
+      CUSTOM_VAR3: 'value3',
+    };
+
+    // When OMC_TEAM_WORKER_ENV_PASSTHROUGH is set, those vars should be included
+    const runtimeEnv = buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'linux',
+    );
+    expect(runtimeEnv).toHaveProperty('CUSTOM_VAR1', 'value1');
+    expect(runtimeEnv).toHaveProperty('CUSTOM_VAR2', 'value2');
+    expect(runtimeEnv).toHaveProperty('CUSTOM_VAR3', 'value3');
+    // The passthrough env var itself should NOT be in the output
+    expect(runtimeEnv).not.toHaveProperty('OMC_TEAM_WORKER_ENV_PASSTHROUGH');
+  });
+
+  it('validates passthrough env var names and rejects invalid syntax', () => {
+    const sourceEnv = {
+      PATH: '/usr/bin',
+      HOME: '/home/user',
+      VALID_NAME: 'value',
+    };
+
+    // Valid names should work
+    expect(() => buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'linux',
+      ['VALID_NAME', '_UNDERSCORE_PREFIX', 'VAR123'],
+    )).not.toThrow();
+
+    // Invalid names should be rejected
+    expect(() => buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'linux',
+      ['INVALID-NAME'],
+    )).toThrow('worker_launch_env_passthrough_key_invalid');
+
+    expect(() => buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'linux',
+      ['123INVALID'],
+    )).toThrow('worker_launch_env_passthrough_key_invalid');
+  });
+
+  it('rejects reserved and internal env var names in passthrough', () => {
+    const sourceEnv = {
+      PATH: '/usr/bin',
+      HOME: '/home/user',
+      OMC_WORKER_LAUNCH_SPEC: 'value',
+    };
+
+    // Internal keys should be rejected
+    expect(() => buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'linux',
+      ['OMC_WORKER_LAUNCH_SPEC'],
+    )).toThrow('worker_launch_env_passthrough_key_reserved');
+
+    // Windows reserved keys should be rejected on win32
+    expect(() => buildProviderEnvironment(
+      {},
+      sourceEnv,
+      'win32',
+      ['SYSTEMROOT'],
+    )).toThrow('worker_launch_env_passthrough_key_reserved');
+  });
 });
\ No newline at end of file
```

**File**: `src/team/worker-launch-ack.ts` (modified, +18/-0)
```diff
@@ -246,10 +246,17 @@ function isValidProviderEnvironment(value: unknown, platform: NodeJS.Platform =
   try { normalizeProviderEnvironment(value as Record<string, string>, platform); return true; } catch { return false; }
 }
 
+function parseEnvPassthrough(value: string | undefined): string[] {
+  if (!value || value.trim().length === 0) return [];
+  // Split by comma and trim each key
+  return value.split(',').map(k => k.trim()).filter(k => k.length > 0);
+}
+
 export function buildProviderEnvironment(
   providerEnv: NodeJS.ProcessEnv | Record<string, string> | undefined,
   sourceEnv: NodeJS.ProcessEnv = process.env,
   platform: NodeJS.Platform = process.platform,
+  envPassthrough?: readonly string[],
 ): Record<string, string> {
   const normalized = normalizeProviderEnvironment(providerEnv, platform);
   const baseline: Record<string, string> = {};
@@ -265,6 +272,17 @@ export function buildProviderEnvironment(
   const homeKey = platform === 'win32' ? 'USERPROFILE' : 'HOME';
   const home = sourceEnv[homeKey];
   if (typeof home === 'string' && home.length > 0) baseline[homeKey] = home;
+
+  // Resolve passthrough environment variables from the source environment
+  const passthroughList = envPassthrough ?? parseEnvPassthrough(sourceEnv.OMC_TEAM_WORKER_ENV_PASSTHROUGH);
+  for (const key of passthroughList) {
+    if (!isValidEnvironmentKey(key)) throw new Error('worker_launch_env_passthrough_key_invalid');
+    if (WORKER_LAUNCH_INTERNAL_ENV_KEYS.has(key)) throw new Error('worker_launch_env_passthrough_key_reserved');
+    if (platform === 'win32' && WINDOWS_RESERVED_ENV_KEYS.has(key.toUpperCase())) throw new Error('worker_launch_env_passthrough_key_reserved');
+    const value = sourceEnv[key];
+    if (typeof value === 'string') baseline[key] = value;
+  }
+
   if (platform === 'win32') {
     for (const key of Object.keys(normalized)) {
       const baselineKey = Object.keys(baseline).find(candidate => candidate.toUpperCase() === key.toUpperCase());
```

---

### Incident Patch 11: `9cabaa0f` (2026-10-01)
**Commit Message**: Merge remote-tracking branch 'origin/dev' into fix/issue-4192

# Conflicts:
#	inventory/inventory-graph.json

**File**: `inventory/inventory-graph.json` (modified, +5/-5)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "455deb0a6d741b7b74c9ecbca641474cd9a8bbdd",
-    "sourceSha256": "8f0944d4bbe7db171fedcf6cf7b3881c95d292492442ad36305f90d83c787e86",
+    "head": "0196371a21f8629946b1067b9a800c6aca18ebd0",
+    "sourceSha256": "6b5de51cfc6d891a64ab93d857baa3ca6c409410f09baa98da93be8a055b46aa",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "455deb0a6d741b7b74c9ecbca641474cd9a8bbdd",
-  "sourceSha256": "8f0944d4bbe7db171fedcf6cf7b3881c95d292492442ad36305f90d83c787e86",
+  "head": "0196371a21f8629946b1067b9a800c6aca18ebd0",
+  "sourceSha256": "6b5de51cfc6d891a64ab93d857baa3ca6c409410f09baa98da93be8a055b46aa",
   "counts": {
     "public": {
       "skills": 47,
@@ -83213,5 +83213,5 @@
     }
   },
   "inventorySha256": "22877059424c133590a79746788b8397ed7349e005a636cd24546faea841ede0",
-  "manifestSha256": "37a15f473832f8cf553ba436274b717baf34a051978192625376475a515a06a1"
+  "manifestSha256": "b614da3ca7639ef519c550b549c86d808d3cfde197d1905ec4591d4cd394a0db"
 }
```

**File**: `src/team/__tests__/tmux-session.test.ts` (modified, +30/-2)
```diff
@@ -79,10 +79,16 @@ describe('sessionName', () => {
 });
 
 describe('detached session target normalization', () => {
-  it('normalizes only the explicit zero-window response form', () => {
+  it('normalizes numeric window indices from new-session responses', () => {
+    // Base-index 0: new-session creates window 0
     expect(normalizeDetachedSessionTarget('worker-detached-session:0')).toBe('worker-detached-session');
-    expect(normalizeDetachedSessionTarget('worker-detached-session:1')).toBeNull();
+    // Base-index 1: new-session creates window 1
+    expect(normalizeDetachedSessionTarget('worker-detached-session:1')).toBe('worker-detached-session');
+    // Base-index with custom offset: new-session might create window 5
+    expect(normalizeDetachedSessionTarget('worker-detached-session:5')).toBe('worker-detached-session');
+    // Non-numeric suffixes are rejected
     expect(normalizeDetachedSessionTarget('worker-detached-session:workers')).toBeNull();
+    // Session name alone is accepted
     expect(normalizeDetachedSessionTarget('worker-detached-session')).toBe('worker-detached-session');
   });
 });
@@ -209,6 +215,28 @@ describe('verifyTeamTargetOwnership tmux target kinds', () => {
       .resolves.toEqual({ kind: 'unavailable' });
     expect(tmuxExec).not.toHaveBeenCalled();
   });
+
+  it('handles base-index 0: numeric windows with index 0', async () => {
+    const tmuxExec = vi.fn(async () => ({ stdout: '%9\n', stderr: '' }));
+
+    await expect(verifyTeamTargetOwnership(target('dispatch-session:0'), dependenciesFor(tmuxExec)))
+      .resolves.toMatchObject({ kind: 'owned', paneId: '%9', tmuxServerIdentity: serverIdentity });
+
+    expect(tmuxExec).toHaveBeenCalledWith([
+      '-S', serverIdentity.socket_path, 'list-panes', '-t', '=dispatch-session:0', '-F', '#{pane_id}',
+    ]);
+  });
+
+  it('handles base-index 1: numeric windows with index 1', async () => {
+    const tmuxExec = vi.fn(async () => ({ stdout: '%9\n', stderr: '' }));
+
+    await expect(verifyTeamTargetOwnership(target('dispatch-session:1'), dependenciesFor(tmuxExec)))
+      .resolves.toMatchObject({ kind: 'owned', paneId: '%9', tmuxServerIdentity: serverIdentity });
+
+    expect(tmuxExec).toHaveBeenCalledWith([
+      '-S', serverIdentity.socket_path, 'list-panes', '-t', '=dispatch-session:1', '-F', '#{pane_id}',
+    ]);
+  });
 });
 
 describe('tmux server incarnation identity', () => {
```

**File**: `src/team/tmux-session.ts` (modified, +6/-5)
```diff
@@ -2014,7 +2014,7 @@ export async function createTeamSession(
         : {}),
     });
     const detachedArgs = [
-      'new-session', '-d', '-P', '-F', '#S:0\t#{pane_id}\t#{socket_path}\t#{pid}',
+      'new-session', '-d', '-P', '-F', '#S:#{window_index}\t#{pane_id}\t#{socket_path}\t#{pid}',
       '-s', detachedSessionName,
       '-c', cwd,
       ...workerPaneShellCommand(),
@@ -3906,7 +3906,8 @@ function parseDedicatedWindowTarget(
 
 /**
  * Normalize only the response form published for a detached session.  A
- * detached `new-session -P` record is represented as `session:0`, while
+ * detached `new-session -P` record is represented as `session:<window_index>`
+ * (the real first window, which follows the user's tmux base-index), while
  * session inventory stores the native session name without a window suffix.
  * Split/dedicated-window callers must not use this normalization.
  */
@@ -3915,7 +3916,7 @@ export function normalizeDetachedSessionTarget(sessionName: string): string | nu
     ? parseDedicatedWindowTarget(sessionName)
     : null;
   const sessionTarget = detachedTarget
-    ? detachedTarget.windowIndex === '0' ? detachedTarget.sessionName : ''
+    ? detachedTarget.sessionName
     : sessionName;
   return sessionTarget && /^[^\s:]+$/.test(sessionTarget) ? sessionTarget : null;
 }
@@ -4080,8 +4081,8 @@ export async function killTeamSession(
     return await observeTmuxServerIdentity(identity!) === 'dead';
   }
 
-  // Detached creation publishes `session:0` because the creating response
-  // includes its window resource. Normalize that validated zero-window form
+  // Detached creation publishes `session:<window_index>` because the creating
+  // response includes its window resource. Normalize that validated window form
   // to the native session target before inventory resolution; never strip an
   // arbitrary suffix or fall back to a name lookup on another server.
   const sessionTarget = normalizeDetachedSessionTarget(sessionName);
```

---

### Incident Patch 12: `3f91cf2a` (2026-10-01)
**Commit Message**: Merge remote-tracking branch 'origin/dev' into fix/issue-4194

# Conflicts:
#	inventory/inventory-graph.json

**File**: `inventory/inventory-graph.json` (modified, +5/-5)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "21415bdf4ac38d8a889685bb9d868280734149a5",
-    "sourceSha256": "6f5df053e14af909a05e04e8bd3a53f8b54a0b470f5330a8df6633720e123a5c",
+    "head": "194e4e25bbd7932d69ad4228395471409f47bf6a",
+    "sourceSha256": "8cf2e895902ba9b7d5ae0cec51bf1cf8a97ad3f796eb9ee29c85d7296722336b",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "21415bdf4ac38d8a889685bb9d868280734149a5",
-  "sourceSha256": "6f5df053e14af909a05e04e8bd3a53f8b54a0b470f5330a8df6633720e123a5c",
+  "head": "194e4e25bbd7932d69ad4228395471409f47bf6a",
+  "sourceSha256": "8cf2e895902ba9b7d5ae0cec51bf1cf8a97ad3f796eb9ee29c85d7296722336b",
   "counts": {
     "public": {
       "skills": 47,
@@ -83208,5 +83208,5 @@
     }
   },
   "inventorySha256": "22877059424c133590a79746788b8397ed7349e005a636cd24546faea841ede0",
-  "manifestSha256": "bbd4e2e29e5f5fdd9039d0dfbadf0ce0efbf2a9d6dbbeafbe4ebc5d2b4a14aed"
+  "manifestSha256": "da033fb158d7c6579d24c15da2e7068d159aa8dff56bc8773e43a5a64024bdab"
 }
```

**File**: `src/team/__tests__/tmux-session.test.ts` (modified, +30/-2)
```diff
@@ -79,10 +79,16 @@ describe('sessionName', () => {
 });
 
 describe('detached session target normalization', () => {
-  it('normalizes only the explicit zero-window response form', () => {
+  it('normalizes numeric window indices from new-session responses', () => {
+    // Base-index 0: new-session creates window 0
     expect(normalizeDetachedSessionTarget('worker-detached-session:0')).toBe('worker-detached-session');
-    expect(normalizeDetachedSessionTarget('worker-detached-session:1')).toBeNull();
+    // Base-index 1: new-session creates window 1
+    expect(normalizeDetachedSessionTarget('worker-detached-session:1')).toBe('worker-detached-session');
+    // Base-index with custom offset: new-session might create window 5
+    expect(normalizeDetachedSessionTarget('worker-detached-session:5')).toBe('worker-detached-session');
+    // Non-numeric suffixes are rejected
     expect(normalizeDetachedSessionTarget('worker-detached-session:workers')).toBeNull();
+    // Session name alone is accepted
     expect(normalizeDetachedSessionTarget('worker-detached-session')).toBe('worker-detached-session');
   });
 });
@@ -209,6 +215,28 @@ describe('verifyTeamTargetOwnership tmux target kinds', () => {
       .resolves.toEqual({ kind: 'unavailable' });
     expect(tmuxExec).not.toHaveBeenCalled();
   });
+
+  it('handles base-index 0: numeric windows with index 0', async () => {
+    const tmuxExec = vi.fn(async () => ({ stdout: '%9\n', stderr: '' }));
+
+    await expect(verifyTeamTargetOwnership(target('dispatch-session:0'), dependenciesFor(tmuxExec)))
+      .resolves.toMatchObject({ kind: 'owned', paneId: '%9', tmuxServerIdentity: serverIdentity });
+
+    expect(tmuxExec).toHaveBeenCalledWith([
+      '-S', serverIdentity.socket_path, 'list-panes', '-t', '=dispatch-session:0', '-F', '#{pane_id}',
+    ]);
+  });
+
+  it('handles base-index 1: numeric windows with index 1', async () => {
+    const tmuxExec = vi.fn(async () => ({ stdout: '%9\n', stderr: '' }));
+
+    await expect(verifyTeamTargetOwnership(target('dispatch-session:1'), dependenciesFor(tmuxExec)))
+      .resolves.toMatchObject({ kind: 'owned', paneId: '%9', tmuxServerIdentity: serverIdentity });
+
+    expect(tmuxExec).toHaveBeenCalledWith([
+      '-S', serverIdentity.socket_path, 'list-panes', '-t', '=dispatch-session:1', '-F', '#{pane_id}',
+    ]);
+  });
 });
 
 describe('tmux server incarnation identity', () => {
```

**File**: `src/team/tmux-session.ts` (modified, +6/-5)
```diff
@@ -1993,7 +1993,7 @@ export async function createTeamSession(
         : {}),
     });
     const detachedArgs = [
-      'new-session', '-d', '-P', '-F', '#S:0\t#{pane_id}\t#{socket_path}\t#{pid}',
+      'new-session', '-d', '-P', '-F', '#S:#{window_index}\t#{pane_id}\t#{socket_path}\t#{pid}',
       '-s', detachedSessionName,
       '-c', cwd,
       ...workerPaneShellCommand(),
@@ -3885,7 +3885,8 @@ function parseDedicatedWindowTarget(
 
 /**
  * Normalize only the response form published for a detached session.  A
- * detached `new-session -P` record is represented as `session:0`, while
+ * detached `new-session -P` record is represented as `session:<window_index>`
+ * (the real first window, which follows the user's tmux base-index), while
  * session inventory stores the native session name without a window suffix.
  * Split/dedicated-window callers must not use this normalization.
  */
@@ -3894,7 +3895,7 @@ export function normalizeDetachedSessionTarget(sessionName: string): string | nu
     ? parseDedicatedWindowTarget(sessionName)
     : null;
   const sessionTarget = detachedTarget
-    ? detachedTarget.windowIndex === '0' ? detachedTarget.sessionName : ''
+    ? detachedTarget.sessionName
     : sessionName;
   return sessionTarget && /^[^\s:]+$/.test(sessionTarget) ? sessionTarget : null;
 }
@@ -4059,8 +4060,8 @@ export async function killTeamSession(
     return await observeTmuxServerIdentity(identity!) === 'dead';
   }
 
-  // Detached creation publishes `session:0` because the creating response
-  // includes its window resource. Normalize that validated zero-window form
+  // Detached creation publishes `session:<window_index>` because the creating
+  // response includes its window resource. Normalize that validated window form
   // to the native session target before inventory resolution; never strip an
   // arbitrary suffix or fall back to a name lookup on another server.
   const sessionTarget = normalizeDetachedSessionTarget(sessionName);
```

---

### Incident Patch 13: `b17ce3bb` (2026-10-01)
**Commit Message**: Merge pull request #4198 from Yeachan-Heo/fix/issue-4193

fix(team): use dynamic window index for detached sessions instead of hardcoded :0 (#4193)

**File**: `inventory/inventory-graph.json` (modified, +5/-5)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "23b408197d995456ea5c05ccbe704df327265d7d",
-    "sourceSha256": "a131c20591daa783f756c66ecb5a1ab38626ef44375b8f44c54c0a95fda1dfba",
+    "head": "e1f993028306aa8f72c9ef54e72c2770978cc8f6",
+    "sourceSha256": "f2f73e4bf79e74d8a348d58d5f4a8bbc83b522ca816fed202b524e12027af2ba",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "23b408197d995456ea5c05ccbe704df327265d7d",
-  "sourceSha256": "a131c20591daa783f756c66ecb5a1ab38626ef44375b8f44c54c0a95fda1dfba",
+  "head": "e1f993028306aa8f72c9ef54e72c2770978cc8f6",
+  "sourceSha256": "f2f73e4bf79e74d8a348d58d5f4a8bbc83b522ca816fed202b524e12027af2ba",
   "counts": {
     "public": {
       "skills": 47,
@@ -83208,5 +83208,5 @@
     }
   },
   "inventorySha256": "22877059424c133590a79746788b8397ed7349e005a636cd24546faea841ede0",
-  "manifestSha256": "d3aff50504506851594d55eba4c46beaf360db181283c0c0db9a00eec085b22b"
+  "manifestSha256": "48cac124c08ae9174d4257c06c32f59675f131c4327e797bfd59793e0867b0ea"
 }
```

**File**: `src/team/__tests__/tmux-session.test.ts` (modified, +30/-2)
```diff
@@ -79,10 +79,16 @@ describe('sessionName', () => {
 });
 
 describe('detached session target normalization', () => {
-  it('normalizes only the explicit zero-window response form', () => {
+  it('normalizes numeric window indices from new-session responses', () => {
+    // Base-index 0: new-session creates window 0
     expect(normalizeDetachedSessionTarget('worker-detached-session:0')).toBe('worker-detached-session');
-    expect(normalizeDetachedSessionTarget('worker-detached-session:1')).toBeNull();
+    // Base-index 1: new-session creates window 1
+    expect(normalizeDetachedSessionTarget('worker-detached-session:1')).toBe('worker-detached-session');
+    // Base-index with custom offset: new-session might create window 5
+    expect(normalizeDetachedSessionTarget('worker-detached-session:5')).toBe('worker-detached-session');
+    // Non-numeric suffixes are rejected
     expect(normalizeDetachedSessionTarget('worker-detached-session:workers')).toBeNull();
+    // Session name alone is accepted
     expect(normalizeDetachedSessionTarget('worker-detached-session')).toBe('worker-detached-session');
   });
 });
@@ -209,6 +215,28 @@ describe('verifyTeamTargetOwnership tmux target kinds', () => {
       .resolves.toEqual({ kind: 'unavailable' });
     expect(tmuxExec).not.toHaveBeenCalled();
   });
+
+  it('handles base-index 0: numeric windows with index 0', async () => {
+    const tmuxExec = vi.fn(async () => ({ stdout: '%9\n', stderr: '' }));
+
+    await expect(verifyTeamTargetOwnership(target('dispatch-session:0'), dependenciesFor(tmuxExec)))
+      .resolves.toMatchObject({ kind: 'owned', paneId: '%9', tmuxServerIdentity: serverIdentity });
+
+    expect(tmuxExec).toHaveBeenCalledWith([
+      '-S', serverIdentity.socket_path, 'list-panes', '-t', '=dispatch-session:0', '-F', '#{pane_id}',
+    ]);
+  });
+
+  it('handles base-index 1: numeric windows with index 1', async () => {
+    const tmuxExec = vi.fn(async () => ({ stdout: '%9\n', stderr: '' }));
+
+    await expect(verifyTeamTargetOwnership(target('dispatch-session:1'), dependenciesFor(tmuxExec)))
+      .resolves.toMatchObject({ kind: 'owned', paneId: '%9', tmuxServerIdentity: serverIdentity });
+
+    expect(tmuxExec).toHaveBeenCalledWith([
+      '-S', serverIdentity.socket_path, 'list-panes', '-t', '=dispatch-session:1', '-F', '#{pane_id}',
+    ]);
+  });
 });
 
 describe('tmux server incarnation identity', () => {
```

**File**: `src/team/tmux-session.ts` (modified, +6/-5)
```diff
@@ -1993,7 +1993,7 @@ export async function createTeamSession(
         : {}),
     });
     const detachedArgs = [
-      'new-session', '-d', '-P', '-F', '#S:0\t#{pane_id}\t#{socket_path}\t#{pid}',
+      'new-session', '-d', '-P', '-F', '#S:#{window_index}\t#{pane_id}\t#{socket_path}\t#{pid}',
       '-s', detachedSessionName,
       '-c', cwd,
       ...workerPaneShellCommand(),
@@ -3885,7 +3885,8 @@ function parseDedicatedWindowTarget(
 
 /**
  * Normalize only the response form published for a detached session.  A
- * detached `new-session -P` record is represented as `session:0`, while
+ * detached `new-session -P` record is represented as `session:<window_index>`
+ * (the real first window, which follows the user's tmux base-index), while
  * session inventory stores the native session name without a window suffix.
  * Split/dedicated-window callers must not use this normalization.
  */
@@ -3894,7 +3895,7 @@ export function normalizeDetachedSessionTarget(sessionName: string): string | nu
     ? parseDedicatedWindowTarget(sessionName)
     : null;
   const sessionTarget = detachedTarget
-    ? detachedTarget.windowIndex === '0' ? detachedTarget.sessionName : ''
+    ? detachedTarget.sessionName
     : sessionName;
   return sessionTarget && /^[^\s:]+$/.test(sessionTarget) ? sessionTarget : null;
 }
@@ -4059,8 +4060,8 @@ export async function killTeamSession(
     return await observeTmuxServerIdentity(identity!) === 'dead';
   }
 
-  // Detached creation publishes `session:0` because the creating response
-  // includes its window resource. Normalize that validated zero-window form
+  // Detached creation publishes `session:<window_index>` because the creating
+  // response includes its window resource. Normalize that validated window form
   // to the native session target before inventory resolution; never strip an
   // arbitrary suffix or fall back to a name lookup on another server.
   const sessionTarget = normalizeDetachedSessionTarget(sessionName);
```

---

### Incident Patch 14: `0196371a` (2026-10-01)
**Commit Message**: Merge remote-tracking branch 'origin/dev' into fix/issue-4192

# Conflicts:
#	inventory/inventory-graph.json

**File**: `inventory/inventory-graph.json` (modified, +11/-6)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "23b408197d995456ea5c05ccbe704df327265d7d",
-    "sourceSha256": "296df11184d0bbd7e9f07fbafe592346c17ea3b483b29ce4d79bf37414959b90",
+    "head": "455deb0a6d741b7b74c9ecbca641474cd9a8bbdd",
+    "sourceSha256": "8f0944d4bbe7db171fedcf6cf7b3881c95d292492442ad36305f90d83c787e86",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "23b408197d995456ea5c05ccbe704df327265d7d",
-  "sourceSha256": "296df11184d0bbd7e9f07fbafe592346c17ea3b483b29ce4d79bf37414959b90",
+  "head": "455deb0a6d741b7b74c9ecbca641474cd9a8bbdd",
+  "sourceSha256": "8f0944d4bbe7db171fedcf6cf7b3881c95d292492442ad36305f90d83c787e86",
   "counts": {
     "public": {
       "skills": 47,
@@ -76084,6 +76084,11 @@
         "to": "src/team/types.ts",
         "kind": "type-imports"
       },
+      {
+        "from": "src/team/__tests__/tmux-session.test.ts",
+        "to": "src/team/worker-launch-ack.ts",
+        "kind": "type-imports"
+      },
       {
         "from": "src/team/__tests__/unified-team.test.ts",
         "to": "external:fs",
@@ -83202,11 +83207,11 @@
     ],
     "stats": {
       "nodeCount": 7136,
-      "edgeCount": 8195,
+      "edgeCount": 8196,
       "importEdgeCount": 6776,
       "registerEdgeCount": 68
     }
   },
   "inventorySha256": "22877059424c133590a79746788b8397ed7349e005a636cd24546faea841ede0",
-  "manifestSha256": "d31068194d737b61fe66ed8051926b119f82bac70741122018fe787711cd4fb9"
+  "manifestSha256": "37a15f473832f8cf553ba436274b717baf34a051978192625376475a515a06a1"
 }
```

**File**: `src/team/__tests__/tmux-session.test.ts` (modified, +103/-0)
```diff
@@ -22,6 +22,7 @@ import {
   type WorkerPaneLiveness,
 } from '../tmux-session.js';
 import { isValidTmuxServerIdentity, type TmuxServerIdentity } from '../types.js';
+import type { WorkerLaunchAttempt } from '../worker-launch-ack.js';
 
 afterEach(() => {
   vi.unstubAllEnvs();
@@ -1195,3 +1196,105 @@ describe('sendToWorker implementation guards', () => {
   });
 });
 
+describe('buildWorkerStartCommand MAX_CANON compliance (issue #4191)', () => {
+  it('keeps supervised launch command under 1024 bytes even with long cwd paths', () => {
+    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
+    vi.stubEnv('SHELL', '/bin/bash');
+    
+    // Create a long cwd (300+ chars) to simulate real-world paths
+    const longCwd = '/home/user/projects/very/deep/nested/directory/structure/' +
+      'with/many/components/that/add/up/to/make/a/realistically/long/path/to/the/working/' +
+      'directory/where/the/team/would/be/running/from/and/this/represents/typical/monorepo/' +
+      'layouts/or/deeply/nested/project/structures/that/developers/might/encounter/in/' +
+      'their/workflows/on/their/systems/today';
+    
+    const attempt: WorkerLaunchAttempt = {
+      schema_version: 1 as const,
+      attempt_id: '11111111-1111-4111-8111-111111111111',
+      nonce: '22222222-2222-4222-8222-222222222222',
+      instance_id: '33333333-3333-4333-8333-333333333333',
+      team_name: 'test-team',
+      worker_name: 'worker-1',
+      pane_id: '%2',
+      provider: 'codex' as const,
+      created_at: '2026-01-01T00:00:00.000Z',
+      currentPath: '/tmp/current.json',
+      expectedPath: '/tmp/expected.json',
+      ackPath: '/tmp/ack.json',
+      decisionPath: '/tmp/decision.json',
+      startedPath: '/tmp/provider-started.json',
+      transportOwnerPath: '/tmp/transport-owner.json',
+      bootstrapDescriptorPath: '/tmp/bootstrap.json',
+      wrapperPath: '/tmp/launch.cmd',
+      transportCleanupCompletePath: '/tmp/transport-cleanup-complete.json',
+      runtimeCliPath: '/opt/omc/runtime-cli.cjs',
+    };
+    
+    // Simulate what runtime-v2 passes in envVars with long paths
+    const envVarsWithLongPaths = {
+      OMC_TEAM_WORKER: 'test-team/worker-1',
+      OMC_TEAM_NAME: 'test-team',
+      OMC_WORKER_AGENT_TYPE: 'codex',
+      OMC_TEAM_STATE_ROOT: `/home/user/projects/very/deep/nested/directory/structure/with/many/components/.omc/state/team/test-team`,
+      OMC_TEAM_LEADER_CWD: longCwd,
+      OMC_TEAM_WORKTREE_PATH: `/home/user/projects/very/deep/nested/directory/structure/with/many/components/worktree`,
+      OMC_TEAM_WORKER_CWD: `/home/user/projects/very/deep/nested/directory/structure/with/many/components/worker-cwd`,
+    };
+    
+    const cmd = buildWorkerStartCommand({
+      teamName: 'test-team',
+      workerName: 'worker-1',
+      envVars: envVarsWithLongPaths,
+      launchBinary: '/usr/bin/codex',
+      launchArgs: ['--full-auto'],
+      cwd: longCwd,
+      provider: 'codex',
+      launchAttempt: attempt,
+    });
+    
+    const cmdBytes = Buffer.byteLength(cmd, 'utf8');
+    
+    // Key assertion: command must stay under 1024 bytes (macOS MAX_CANON limit)
+    // to avoid truncation in terminal line discipline
+    expect(cmdBytes).toBeLessThan(1024);
+    expect(cmdBytes).toBeGreaterThan(100); // Sanity check - not too short
+    
+    // Verify supervised launch only includes OMC_WORKER_LAUNCH_SPEC_FILE
+    // NOT the long env vars that would push it over the limit
+    expect(cmd).toContain("OMC_WORKER_LAUNCH_SPEC_FILE='/tmp/bootstrap.json'");
+    expect(cmd).not.toContain('OMC_TEAM_STATE_ROOT');
+    expect(cmd).not.toContain('OMC_TEAM_LEADER_CWD');
+    expect(cmd).not.toContain('OMC_TEAM_WORKER_CWD');
+    expect(cmd).not.toContain(longCwd);
+    
+    // Verify it still invokes the runtime CLI correctly
+    expect(cmd).toContain('--worker-launch');
+    expect(cmd).toContain('/opt/omc/runtime-cli.cjs');
+  });
+  
+  it('non-supervised launches still include env vars normally', () => {
+    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
+    vi.stubEnv('SHELL', '/bin/bash');
+    
+    const cmd = buildWorkerStartCommand({
+      teamName: 'test-team',
+      workerName: 'worker-1',
+      envVars: {
+        OMC_TEAM_WORKER: 'test-team/worker-1',
+        OMC_TEAM_NAME: 'test-team',
+        OMC_TEAM_STATE_ROOT: '/tmp/state',
+      },
+      launchBinary: '/usr/bin/codex',
+      launchArgs: ['--full-auto'],
+      cwd: '/tmp',
+      provider: 'codex',
+      // No launchAttempt - non-supervised
+    });
+    
+    // Non-supervised launches should include all env vars
+    expect(cmd).toContain('OMC_TEAM_WORKER');
+    expect(cmd).toContain('OMC_TEAM_NAME');
+    expect(cmd).toContain('OMC_TEAM_STATE_ROOT');
+  });
+});
+
```

**File**: `src/team/tmux-session.ts` (modified, +3/-1)
```diff
@@ -1468,11 +1468,13 @@ export function buildWorkerStartCommand(config: WorkerPaneConfig): string {
     : providerLaunchWords;
   const envVars = config.launchAttempt
     ? {
-        ...config.envVars,
         // Supervised launches carry the attempt-owned bootstrap descriptor by
         // path (never inline): secrets stay out of the process list and tmux
         // scrollback, and the delivered command stays small. The runtime CLI
         // validates and consumes the descriptor before running the provider.
+        // Team identity (team_name, worker_name, provider, instance_id) is read
+        // from the descriptor, not from environment vars, keeping the typed
+        // command under 1024 bytes even with long cwd paths.
         OMC_WORKER_LAUNCH_SPEC_FILE: config.launchAttempt.bootstrapDescriptorPath,
       }
     : config.envVars;
```

---

### Incident Patch 15: `6249dc43` (2026-10-01)
**Commit Message**: Merge remote-tracking branch 'origin/dev' into fix/issue-4193

# Conflicts:
#	inventory/inventory-graph.json

**File**: `inventory/inventory-graph.json` (modified, +11/-6)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "f93d79dec49a5d86e03a0c4f9e55b33ea20c72ac",
-    "sourceSha256": "a211f3ef970591bb4e56dc3e694ced7ffbd3df286cd38c9aedb0325eb0d0a19b",
+    "head": "e1f993028306aa8f72c9ef54e72c2770978cc8f6",
+    "sourceSha256": "f2f73e4bf79e74d8a348d58d5f4a8bbc83b522ca816fed202b524e12027af2ba",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "f93d79dec49a5d86e03a0c4f9e55b33ea20c72ac",
-  "sourceSha256": "a211f3ef970591bb4e56dc3e694ced7ffbd3df286cd38c9aedb0325eb0d0a19b",
+  "head": "e1f993028306aa8f72c9ef54e72c2770978cc8f6",
+  "sourceSha256": "f2f73e4bf79e74d8a348d58d5f4a8bbc83b522ca816fed202b524e12027af2ba",
   "counts": {
     "public": {
       "skills": 47,
@@ -76084,6 +76084,11 @@
         "to": "src/team/types.ts",
         "kind": "type-imports"
       },
+      {
+        "from": "src/team/__tests__/tmux-session.test.ts",
+        "to": "src/team/worker-launch-ack.ts",
+        "kind": "type-imports"
+      },
       {
         "from": "src/team/__tests__/unified-team.test.ts",
         "to": "external:fs",
@@ -83197,11 +83202,11 @@
     ],
     "stats": {
       "nodeCount": 7136,
-      "edgeCount": 8194,
+      "edgeCount": 8195,
       "importEdgeCount": 6775,
       "registerEdgeCount": 68
     }
   },
   "inventorySha256": "22877059424c133590a79746788b8397ed7349e005a636cd24546faea841ede0",
-  "manifestSha256": "66cffccf04024a6e4a5a5134ac9c4336e01f3bfd832bee4d11b89c6fd908d2aa"
+  "manifestSha256": "48cac124c08ae9174d4257c06c32f59675f131c4327e797bfd59793e0867b0ea"
 }
```

**File**: `src/team/__tests__/tmux-session.test.ts` (modified, +103/-0)
```diff
@@ -22,6 +22,7 @@ import {
   type WorkerPaneLiveness,
 } from '../tmux-session.js';
 import { isValidTmuxServerIdentity, type TmuxServerIdentity } from '../types.js';
+import type { WorkerLaunchAttempt } from '../worker-launch-ack.js';
 
 afterEach(() => {
   vi.unstubAllEnvs();
@@ -1223,3 +1224,105 @@ describe('sendToWorker implementation guards', () => {
   });
 });
 
+describe('buildWorkerStartCommand MAX_CANON compliance (issue #4191)', () => {
+  it('keeps supervised launch command under 1024 bytes even with long cwd paths', () => {
+    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
+    vi.stubEnv('SHELL', '/bin/bash');
+    
+    // Create a long cwd (300+ chars) to simulate real-world paths
+    const longCwd = '/home/user/projects/very/deep/nested/directory/structure/' +
+      'with/many/components/that/add/up/to/make/a/realistically/long/path/to/the/working/' +
+      'directory/where/the/team/would/be/running/from/and/this/represents/typical/monorepo/' +
+      'layouts/or/deeply/nested/project/structures/that/developers/might/encounter/in/' +
+      'their/workflows/on/their/systems/today';
+    
+    const attempt: WorkerLaunchAttempt = {
+      schema_version: 1 as const,
+      attempt_id: '11111111-1111-4111-8111-111111111111',
+      nonce: '22222222-2222-4222-8222-222222222222',
+      instance_id: '33333333-3333-4333-8333-333333333333',
+      team_name: 'test-team',
+      worker_name: 'worker-1',
+      pane_id: '%2',
+      provider: 'codex' as const,
+      created_at: '2026-01-01T00:00:00.000Z',
+      currentPath: '/tmp/current.json',
+      expectedPath: '/tmp/expected.json',
+      ackPath: '/tmp/ack.json',
+      decisionPath: '/tmp/decision.json',
+      startedPath: '/tmp/provider-started.json',
+      transportOwnerPath: '/tmp/transport-owner.json',
+      bootstrapDescriptorPath: '/tmp/bootstrap.json',
+      wrapperPath: '/tmp/launch.cmd',
+      transportCleanupCompletePath: '/tmp/transport-cleanup-complete.json',
+      runtimeCliPath: '/opt/omc/runtime-cli.cjs',
+    };
+    
+    // Simulate what runtime-v2 passes in envVars with long paths
+    const envVarsWithLongPaths = {
+      OMC_TEAM_WORKER: 'test-team/worker-1',
+      OMC_TEAM_NAME: 'test-team',
+      OMC_WORKER_AGENT_TYPE: 'codex',
+      OMC_TEAM_STATE_ROOT: `/home/user/projects/very/deep/nested/directory/structure/with/many/components/.omc/state/team/test-team`,
+      OMC_TEAM_LEADER_CWD: longCwd,
+      OMC_TEAM_WORKTREE_PATH: `/home/user/projects/very/deep/nested/directory/structure/with/many/components/worktree`,
+      OMC_TEAM_WORKER_CWD: `/home/user/projects/very/deep/nested/directory/structure/with/many/components/worker-cwd`,
+    };
+    
+    const cmd = buildWorkerStartCommand({
+      teamName: 'test-team',
+      workerName: 'worker-1',
+      envVars: envVarsWithLongPaths,
+      launchBinary: '/usr/bin/codex',
+      launchArgs: ['--full-auto'],
+      cwd: longCwd,
+      provider: 'codex',
+      launchAttempt: attempt,
+    });
+    
+    const cmdBytes = Buffer.byteLength(cmd, 'utf8');
+    
+    // Key assertion: command must stay under 1024 bytes (macOS MAX_CANON limit)
+    // to avoid truncation in terminal line discipline
+    expect(cmdBytes).toBeLessThan(1024);
+    expect(cmdBytes).toBeGreaterThan(100); // Sanity check - not too short
+    
+    // Verify supervised launch only includes OMC_WORKER_LAUNCH_SPEC_FILE
+    // NOT the long env vars that would push it over the limit
+    expect(cmd).toContain("OMC_WORKER_LAUNCH_SPEC_FILE='/tmp/bootstrap.json'");
+    expect(cmd).not.toContain('OMC_TEAM_STATE_ROOT');
+    expect(cmd).not.toContain('OMC_TEAM_LEADER_CWD');
+    expect(cmd).not.toContain('OMC_TEAM_WORKER_CWD');
+    expect(cmd).not.toContain(longCwd);
+    
+    // Verify it still invokes the runtime CLI correctly
+    expect(cmd).toContain('--worker-launch');
+    expect(cmd).toContain('/opt/omc/runtime-cli.cjs');
+  });
+  
+  it('non-supervised launches still include env vars normally', () => {
+    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
+    vi.stubEnv('SHELL', '/bin/bash');
+    
+    const cmd = buildWorkerStartCommand({
+      teamName: 'test-team',
+      workerName: 'worker-1',
+      envVars: {
+        OMC_TEAM_WORKER: 'test-team/worker-1',
+        OMC_TEAM_NAME: 'test-team',
+        OMC_TEAM_STATE_ROOT: '/tmp/state',
+      },
+      launchBinary: '/usr/bin/codex',
+      launchArgs: ['--full-auto'],
+      cwd: '/tmp',
+      provider: 'codex',
+      // No launchAttempt - non-supervised
+    });
+    
+    // Non-supervised launches should include all env vars
+    expect(cmd).toContain('OMC_TEAM_WORKER');
+    expect(cmd).toContain('OMC_TEAM_NAME');
+    expect(cmd).toContain('OMC_TEAM_STATE_ROOT');
+  });
+});
+
```

**File**: `src/team/tmux-session.ts` (modified, +3/-1)
```diff
@@ -1467,11 +1467,13 @@ export function buildWorkerStartCommand(config: WorkerPaneConfig): string {
     : providerLaunchWords;
   const envVars = config.launchAttempt
     ? {
-        ...config.envVars,
         // Supervised launches carry the attempt-owned bootstrap descriptor by
         // path (never inline): secrets stay out of the process list and tmux
         // scrollback, and the delivered command stays small. The runtime CLI
         // validates and consumes the descriptor before running the provider.
+        // Team identity (team_name, worker_name, provider, instance_id) is read
+        // from the descriptor, not from environment vars, keeping the typed
+        // command under 1024 bytes even with long cwd paths.
         OMC_WORKER_LAUNCH_SPEC_FILE: config.launchAttempt.bootstrapDescriptorPath,
       }
     : config.envVars;
```

#### Recent Merged Pull Requests:
- **PR #4240** (2026-10-06): signoff: v5.6.2 release artifacts (@Yeachan-Heo)
- **PR #4239** (2026-10-06): chore(release): v5.6.2 (@Yeachan-Heo)
- **PR #4238** (2026-10-05): Fix #4237: Optimize HUD cache wrapper with minimum refresh age and POSIX-sh fast path (@Yeachan-Heo)
- **PR #4236** (2026-10-05): Fix #4230: keep OMC_TEAM_WORKER_ENV_PASSTHROUGH values off pane command lines (@Yeachan-Heo)
- **PR #4235** (closed): Fix #4230: keep OMC_TEAM_WORKER_ENV_PASSTHROUGH values off pane command lines (@Yeachan-Heo)
- **PR #4234** (2026-10-05): Fix #4229: state-lock file identity — BigInt ids, shared comparison in sameStateFileGeneration, owner recheck before reclaim (@RobinNorberg)
- **PR #4233** (2026-10-05): Fix #4228: make the state-lock owner-reclaim test exercise the lock (@RobinNorberg)
- **PR #4232** (2026-10-05): Fix #4227: team shutdown tests derive the dead-owner identity from the host platform (@RobinNorberg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
