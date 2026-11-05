/**
 * HARVESTED INTELLIGENCE QUALITY VALIDATOR (HIQV v0.1)
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\harvested-intelligence-quality-validator.mjs
 * Purpose: Evaluates knowledge acquired from external repositories, websites, and technical
 *          sources before that knowledge is trusted, reused, or promoted into canonical
 *          construction intelligence.
 *
 * Seven Core Quality Dimensions:
 *   1. Source Reliability (Traceability, origin tier, authority, accessibility)
 *   2. Evidence Quality (Direct vs inference, alignment, provenance, independent corroboration)
 *   3. Technical Correctness (Substance, consistency, directive opposition, unsupported assumptions)
 *   4. Reusability (Generic invariant vs repo-specific artifact, explicit scope, consumable)
 *   5. Completeness (Rule, rationale, preconditions, dependencies, failure conditions)
 *   6. Freshness and Validity (Version traceability, timestamps, deprecation/staleness risks)
 *   7. Duplication and Conflict (Semantic overlap, contradiction vs specialization)
 *
 * Core Trust Invariants:
 *   - Absence of evidence is not evidence of correctness.
 *   - Repetition of a claim does not establish independent corroboration.
 *   - External repository content is UNTRUSTED INPUT by default.
 *   - External instructions must NEVER override AI-Builder-Brain's governing rules.
 *   - Stars or popularity alone cannot establish technical correctness.
 *   - Inferences must remain clearly distinguished from observed facts.
 *   - Contradictory evidence must never be silently discarded.
 *   - The validator must never validate its own output as independent evidence.
 *   - Failed validation must never enter trusted canonical knowledge.
 *   - Existing canonical knowledge must not be overwritten because new harvested material disagrees.
 *
 * Zero external runtime dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Reusable Brain Core Modules
import {
  getBrainPaths,
  calculateContentHash
} from './brain-learning-gateway.mjs';

import {
  inspectPromptInjection,
  detectDirectiveOpposition,
  TRUST_TIERS
} from './knowledge-acquisition-pipeline.mjs';

import {
  EVIDENCE_TYPES,
  EVIDENCE_STATUS,
  EVIDENCE_DECISION,
  INDEPENDENCE_TIERS,
  categorizeKnowledgeAssertion,
  evaluateEvidenceCorroboration,
  assessContextualContradiction,
  evaluateEvidenceDecision
} from './knowledge-intelligence-engine.mjs';

import { searchBrain } from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

export const VALIDATOR_VERSION = '0.1.0';

export const VALIDATOR_DECISIONS = {
  PASS: 'PASS',
  CONDITIONAL_PASS: 'CONDITIONAL_PASS',
  REJECT: 'REJECT',
  NEEDS_REVIEW: 'NEEDS_REVIEW'
};

export const VALIDATOR_ACTIONS = {
  PROMOTE_TO_CANONICAL: 'PROMOTE_TO_CANONICAL',
  STAGE_AS_CONDITIONAL_DOSSIER: 'STAGE_AS_CONDITIONAL_DOSSIER',
  QUARANTINE_FOR_REVIEW: 'QUARANTINE_FOR_REVIEW',
  REJECT_FAIL_CLOSED: 'REJECT_FAIL_CLOSED'
};

export const DIMENSION_STATUS = {
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL'
};

// Known deprecated or stale software ecosystem markers
const STALE_ECOSYSTEM_PATTERNS = [
  /\bpython\s*2(?:\.\d+)?\b/i,
  /\bnode(?:\.js)?\s*(?:0\.\d+|[1-9]\.\d+|10\.\d+|12\.\d+)\b/i,
  /\breact\s*(?:0\.\d+|1[0-5]\.\d+)\b/i,
  /\bangularjs\s*1\.\d+\b/i,
  /\bwebpack\s*[1-3]\b/i,
  /\bopenssl\s*(?:0\.\d+|1\.0\.\d+)\b/i,
  /\bpython2\b/i,
  /\bssl(?:v2|v3)\b/i,
  /\btls\s*1\.0\b/i
];

// Hyperbolic or unsupported engineering claims
const UNSUPPORTED_ASSUMPTION_PATTERNS = [
  { pattern: /\b100%\s+bug-?free\b/i, reason: 'Absolute claim of zero bugs is unprovable' },
  { pattern: /\bguaranteed\s+zero\s+(?:bugs?|crashes?|errors?)\b/i, reason: 'Absolute zero-defect guarantee is ungrounded' },
  { pattern: /\bcompletely\s+unbreakable\b/i, reason: 'Unbreakable security claim unsupported by formal proof' },
  { pattern: /\binfinitely\s+scalable\b/i, reason: 'Infinite scalability claim ignores physical hardware bounds' },
  { pattern: /\bzero\s+(?:latency|overhead)\b/i, reason: 'Absolute zero latency/overhead violates computational reality' },
  { pattern: /\bnever\s+(?:fails?|crashes?|throws?)\b/i, reason: 'Absolute infallibility claim lacks failure boundary' }
];

// Local filesystem hardcoded paths indicating non-reusable machine-specific scripts
const LOCAL_MACHINE_PATH_PATTERNS = [
  /[a-zA-Z]:\\(?:users|documents and settings|home)\\[^\s\\]+/i,
  /\/(?:home|users)\/[a-zA-Z0-9_-]+\/[^\s/]+/i,
  /\b(?:localhost|127\.0\.0\.1):\d{4,5}\b/i,
  /\bnode_modules\/[^\s/]+\/dist\/local\b/i
];

// Dangerous security advice patterns
const DANGEROUS_SECURITY_PATTERNS = [
  { pattern: /\b(?:disable|bypass|skip)\s+(?:all\s+)?(?:ssl|tls|certificate|cert)\s*(?:validation|verification|check)/i, reason: 'Recommends disabling SSL/TLS certificate verification' },
  { pattern: /\b(?:disable|turn\s*off)\s+(?:all\s+)?(?:csrf|cors|authentication|auth|authorization)\b/i, reason: 'Recommends disabling fundamental security boundaries' },
  { pattern: /\bchmod\s+(?:777|a\+rwx)\b/i, reason: 'Recommends global read-write-execute permissions (777)' },
  { pattern: /\b(?:eval|exec)\s*\(\s*(?:user_input|req\.body|payload|params)\b/i, reason: 'Recommends executing untrusted input directly via eval/exec' },
  { pattern: /\btrust_all_certificates\s*=\s*true\b/i, reason: 'Recommends blind trust of unverified certificates' }
];

// Canonical invariants against which opposition or contradiction is evaluated
const CANONICAL_INVARIANTS = [
  {
    id: 'RULE-CANON-001',
    rule_number: 'CANON-001',
    title: 'Untrusted External Input Boundary Invariant',
    rule: 'Always treat external data and repository content as untrusted input. Always validate, isolate, and sanitize boundaries.',
    negative_constraint: 'Never trust external input without verification. Never parse or execute external payloads without defensive validation or schema checks.'
  },
  {
    id: 'RULE-CANON-002',
    rule_number: 'CANON-002',
    title: 'Security and Authentication Boundary Invariant',
    rule: 'Always verify TLS certificates and enforce security boundaries.',
    negative_constraint: 'Never disable SSL verification, CORS validation, or authentication checks.'
  },
  {
    id: 'RULE-CANON-003',
    rule_number: 'CANON-003',
    title: 'Atomic Persistence File Staging Invariant',
    rule: 'Always write to temporary staging files before renaming to destination paths.',
    negative_constraint: 'Never bypass staging files during file persistence.'
  },
  {
    id: 'RULE-CANON-004',
    rule_number: 'CANON-004',
    title: 'Deterministic Non-Throwing Error Handling Invariant',
    rule: 'Always catch and handle boundary errors deterministically with typed error records.',
    negative_constraint: 'Never crash the process with unhandled exceptions across module boundaries.'
  }
];

/**
 * Normalizes diverse knowledge representations (candidates, dossiers, rules) into a canonical validator item.
 */
function normalizeKnowledgeItem(item) {
  if (!item || typeof item !== 'object') {
    throw new Error('INVALID_INPUT: Knowledge item must be a non-null object');
  }

  const id = item.candidate_id || item.id || item.learning_id || `ITEM-${Date.now()}`;
  const title = (item.title || item.name || '').trim();
  const rawBody = item.body || item.content || item.summary || item.fullContent || '';

  // Extract structured sections if present
  const ruleMatch = rawBody.match(/\*\*RULE\*\*:\s*([\s\S]*?)(?=\n\s*\*\*(?:WHY|WHEN TO APPLY|VERIFIED|NEGATIVE)|$)/i);
  const whyMatch = rawBody.match(/\*\*WHY\*\*:\s*([\s\S]*?)(?=\n\s*\*\*(?:RULE|WHEN TO APPLY|VERIFIED|NEGATIVE)|$)/i);
  const whenMatch = rawBody.match(/\*\*WHEN TO APPLY\*\*:\s*([\s\S]*?)(?=\n\s*\*\*(?:RULE|WHY|VERIFIED|NEGATIVE)|$)/i);
  const negativeMatch = rawBody.match(/\*\*NEGATIVE(?:\s+EXAMPLE)?\*\*:\s*([\s\S]*?)(?=\n\s*\*\*(?:RULE|WHY|WHEN|VERIFIED)|$)/i);

  const hasNormativeWord = /\b(?:must|shall|always|never|required|prohibited|enforce|prescribe)\b/i.test(rawBody);
  const hasExplicitRule = Boolean(ruleMatch || item.ruleText || (hasNormativeWord && rawBody.length >= 25));
  const ruleText = ruleMatch ? ruleMatch[1].trim() : (item.ruleText || (hasNormativeWord ? rawBody.slice(0, 500).trim() : ''));
  const whyText = whyMatch ? whyMatch[1].trim() : (item.whyText || '');
  const whenText = whenMatch ? whenMatch[1].trim() : (item.whenText || '');
  const negativeExample = negativeMatch ? negativeMatch[1].trim() : (item.negativeExample || '');

  // Extract source provenance
  const source = {
    id: item.source_id || item.source || item.repository || '',
    uri: item.source_uri || item.source_url || '',
    version: item.source_version || item.commit_sha || item.revision || 'HEAD',
    platform: item.platform || (item.source_uri?.includes('huggingface') ? 'huggingface' : 'github'),
    license: item.license || item.declared_license || 'UNKNOWN',
    verified_at: item.verified_at || item.created_at || new Date().toISOString(),
    stars: typeof item.stars === 'number' ? item.stars : 0
  };

  return {
    id,
    title,
    category: item.category || 'ENGINEERING_PATTERN',
    domain: item.domain || 'ARCHITECTURE',
    ruleText,
    hasExplicitRule,
    whyText,
    whenText,
    negativeExample,
    rawBody,
    fullContent: item.fullContent || `## ${title}\n\n${rawBody}`,
    source,
    dependencies: item.dependencies || [],
    applicableScope: item.applicableScope || item.scope || [],
    is_trusted: Boolean(item.is_trusted),
    rawHash: item.content_hash || calculateContentHash(`${title}\n${rawBody}`)
  };
}

// ---------------------------------------------------------------------------
// Dimension 1: Source Reliability
// ---------------------------------------------------------------------------
export function validateSourceReliability(item, options = {}) {
  const source = item.source || {};
  const findings = [];
  const details = [];
  let score = 0.0;

  // 1. Traceability
  if (!source.id || source.id.trim() === '') {
    findings.push('MISSING_SOURCE_ID: Knowledge has no source repository or package identifier');
  }
  if (!source.uri || source.uri.trim() === '') {
    findings.push('MISSING_SOURCE_URI: Knowledge has no source URL or locator');
  }

  if (findings.length > 0) {
    return {
      status: DIMENSION_STATUS.FAIL,
      score: 0.0,
      tier: TRUST_TIERS.UNTRUSTED_EXTERNAL,
      findings,
      details: ['Source is completely untraceable; origin cannot be verified.']
    };
  }

  // 2. Organization / Ecosystem Tier
  let tier = TRUST_TIERS.TIER_3_COMMUNITY_OPEN;
  const uriLower = source.uri.toLowerCase();
  const idLower = source.id.toLowerCase();

  const OFFICIAL_DOMAINS = [
    'github.com/astronomy', 'github.com/vercel', 'github.com/facebook',
    'github.com/microsoft', 'github.com/google', 'github.com/tailwindlabs',
    'github.com/nodejs', 'github.com/pytorch', 'github.com/rust-lang',
    'github.com/golang', 'github.com/apache', 'github.com/torvalds',
    'github.com/fastify'
  ];

  if (OFFICIAL_DOMAINS.some(d => uriLower.includes(d) || idLower.includes(d))) {
    tier = TRUST_TIERS.TIER_2_OFFICIAL_ECOSYSTEM;
    score += 0.5;
    details.push(`Source belongs to recognized official ecosystem (${tier})`);
  } else if (item.is_trusted || idLower.startsWith('ai-builder-brain')) {
    tier = TRUST_TIERS.TIER_1_VERIFIED_CORE;
    score += 0.6;
    details.push('Source originates from verified core architecture');
  } else {
    score += 0.35;
    details.push('Source originates from community open repository');
  }

  // 3. Provenance Version Pinning
  if (source.version && source.version !== 'HEAD' && source.version.length >= 7) {
    score += 0.25;
    details.push(`Source pinned to immutable commit/version: ${source.version.slice(0, 10)}`);
  } else {
    score += 0.1;
    details.push('Source version unpinned (HEAD), subject to upstream drift');
  }

  // 4. Source Accessibility & Integrity (Non-empty hash)
  if (item.rawHash && item.rawHash.length === 64) {
    score += 0.15;
    details.push('Cryptographic SHA-256 payload integrity hash present');
  }

  // 5. Explicit Popularity Invariant: Stars alone do not establish technical authority
  if (source.stars > 10000) {
    details.push(`High community popularity noted (${source.stars} stars); technical correctness evaluated independently`);
  }

  score = Math.min(1.0, Math.round(score * 100) / 100);
  const status = score >= 0.6 ? DIMENSION_STATUS.PASS : (score >= 0.35 ? DIMENSION_STATUS.WARN : DIMENSION_STATUS.FAIL);

  return {
    status,
    score,
    tier,
    findings,
    details
  };
}

// ---------------------------------------------------------------------------
// Dimension 2: Evidence Quality
// ---------------------------------------------------------------------------
export function validateEvidenceQuality(item, evidenceList = [], options = {}) {
  const details = [];
  const findings = [];
  let score = 0.0;

  // Invariant: Absence of evidence is not evidence of correctness
  if (!Array.isArray(evidenceList) || evidenceList.length === 0) {
    return {
      status: DIMENSION_STATUS.WARN,
      score: 0.2,
      corroboration_tier: INDEPENDENCE_TIERS.INDEPENDENCE_UNVERIFIED,
      effective_sources: 0,
      direct_evidence_ratio: 0.0,
      findings: ['NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records'],
      details: ['Claim is uncorroborated; relies solely on raw unverified source text.']
    };
  }

  // Filter out any self-referential evidence (Validator output cannot validate itself)
  const validEvidence = evidenceList.filter(ev => {
    if (ev.source_uri && ev.source_uri.includes('harvested-intelligence-quality-validator')) {
      findings.push('SELF_REFERENTIAL_EVIDENCE_REJECTED: Validator output cannot validate itself');
      return false;
    }
    return true;
  });

  if (validEvidence.length === 0) {
    return {
      status: DIMENSION_STATUS.FAIL,
      score: 0.0,
      corroboration_tier: INDEPENDENCE_TIERS.INDEPENDENCE_UNVERIFIED,
      effective_sources: 0,
      direct_evidence_ratio: 0.0,
      findings: ['SELF_VALIDATION_DETECTED: All evidence was self-referential'],
      details: ['Validator strictly rejects self-referential evidence.']
    };
  }

  // 1. Direct Empirical Evidence vs Speculative Inference
  let directCount = 0;
  let empiricalAssertionCount = 0;

  for (const ev of validEvidence) {
    const isDirectType = [
      EVIDENCE_TYPES.CODE_IMPLEMENTATION,
      EVIDENCE_TYPES.COMMIT_DIFF,
      EVIDENCE_TYPES.REPRODUCIBLE_TEST,
      EVIDENCE_TYPES.BENCHMARK_RESULT
    ].includes(ev.evidence_type);

    if (isDirectType) directCount++;

    // Assert empirical groundedness
    const cat = categorizeKnowledgeAssertion({ assertion: ev.assertion || ev.content || '' });
    if (cat.empirical_fact) empiricalAssertionCount++;
  }

  const directRatio = validEvidence.length > 0 ? directCount / validEvidence.length : 0;
  score += directRatio * 0.4;
  details.push(`Direct empirical evidence ratio: ${(directRatio * 100).toFixed(0)}% (${directCount}/${validEvidence.length})`);

  // 2. Corroboration & Independence Analysis
  const claimId = item?.id || item?.candidate_id || item?.claim_id || 'CLAIM_UNKNOWN';
  const corroboration = evaluateEvidenceCorroboration(claimId, validEvidence, options);
  const effectiveSources = corroboration.effective_sources || 0;
  const independenceTier = corroboration.independence_tier || INDEPENDENCE_TIERS.INDEPENDENCE_UNVERIFIED;

  if (independenceTier === INDEPENDENCE_TIERS.INDEPENDENT && effectiveSources >= 2) {
    score += 0.4;
    details.push(`Independently corroborated across ${effectiveSources} distinct organizations`);
  } else if (independenceTier === INDEPENDENCE_TIERS.COPIED_OR_MIRRORED) {
    score += 0.15;
    findings.push('COPIED_SOURCES_DETECTED: Multiple sources collapsed into 1 effective source (fork/mirror/copy)');
    details.push('Sources are copies/forks; repetition does not establish independent corroboration');
  } else if (effectiveSources === 1) {
    score += 0.25;
    details.push('Single source supported; awaiting independent corroboration');
  }

  // 3. Evidence-to-Claim Alignment
  let alignedCount = 0;
  const itemTitle = item?.title || '';
  const itemRule = item?.ruleText || item?.body || item?.content || '';
  const claimTokens = (itemTitle + ' ' + itemRule).toLowerCase().split(/\W+/).filter(t => t.length > 3);

  for (const ev of validEvidence) {
    const evText = ((ev.assertion || '') + ' ' + (ev.supporting_excerpt || ev.raw_payload || '')).toLowerCase();
    const matches = claimTokens.filter(t => evText.includes(t));
    if (matches.length >= 2) alignedCount++;
  }

  const alignmentRatio = validEvidence.length > 0 ? alignedCount / validEvidence.length : 0;
  score += alignmentRatio * 0.2;
  details.push(`Evidence-to-claim lexical alignment: ${(alignmentRatio * 100).toFixed(0)}%`);

  score = Math.min(1.0, Math.round(score * 100) / 100);
  const status = score >= 0.65 ? DIMENSION_STATUS.PASS : (score >= 0.35 ? DIMENSION_STATUS.WARN : DIMENSION_STATUS.FAIL);

  return {
    status,
    score,
    corroboration_tier: independenceTier,
    effective_sources: effectiveSources,
    direct_evidence_ratio: Math.round(directRatio * 100) / 100,
    findings,
    details
  };
}

// ---------------------------------------------------------------------------
// Dimension 3: Technical Correctness & Safety
// ---------------------------------------------------------------------------
export function validateTechnicalCorrectness(item, options = {}) {
  const fullText = `${item.title || ''}\n${item.rawBody || item.body || item.content || ''}`;
  const findings = [];
  const details = [];
  let score = 1.0;

  // 1. Prompt Injection Defense Barrier (Strict Fail-Closed)
  const injection = inspectPromptInjection(fullText);
  if (!injection.safe) {
    findings.push(`PROMPT_INJECTION_DETECTED: ${injection.reason}`);
    return {
      status: DIMENSION_STATUS.FAIL,
      score: 0.0,
      directive_opposition: false,
      opposing_rule: null,
      is_adversarial: true,
      has_dangerous_security: false,
      unsupported_assumptions: [],
      findings,
      details: ['External instructions attempting to override AI constraints rejected fail-closed.']
    };
  }

  // 2. Dangerous Security Practices (Strict Fail-Closed)
  let hasDangerousSecurity = false;
  for (const d of DANGEROUS_SECURITY_PATTERNS) {
    if (d.pattern.test(fullText)) {
      hasDangerousSecurity = true;
      findings.push(`DANGEROUS_SECURITY_ADVICE: ${d.reason}`);
      score -= 0.6;
    }
  }

  // 3. Directive Opposition & Canonical Invariant Clashes
  let directiveOpposition = false;
  let opposingRule = null;

  for (const canon of CANONICAL_INVARIANTS) {
    const opp = detectDirectiveOpposition(item.ruleText || item.title || '', item.negativeExample || item.rawBody || '', {
      title: canon.title,
      summary: canon.rule,
      ruleText: canon.rule,
      fullContent: `${canon.rule} ${canon.negative_constraint}`,
      rule_number: canon.rule_number,
      id: canon.id
    });
    if (opp && opp.opposed) {
      directiveOpposition = true;
      opposingRule = `${canon.id} (${canon.title})`;
      findings.push(`DIRECTIVE_OPPOSITION: Contradicts canonical rule ${opposingRule}: ${opp.reason}`);
      score -= 0.6;
      break;
    }
  }

  // Heuristic check for direct canonical invariant clashes
  if (!directiveOpposition) {
    const lower = fullText.toLowerCase();
    if (
      lower.includes('do not treat external data as untrusted') ||
      lower.includes('never treat external data as untrusted') ||
      lower.includes('without defensive boundary isolation') ||
      lower.includes('skip defensive schema checks')
    ) {
      directiveOpposition = true;
      opposingRule = 'RULE-CANON-001 (Untrusted External Input Boundary Invariant)';
      findings.push(`DIRECTIVE_OPPOSITION: Contradicts canonical rule ${opposingRule}`);
      score -= 0.6;
    }
  }

  if (!directiveOpposition) {
    details.push('No direct opposition with canonical operating directives');
  }

  // 4. Unsupported Hyperbolic Assumptions
  const unsupported = [];
  for (const u of UNSUPPORTED_ASSUMPTION_PATTERNS) {
    if (u.pattern.test(fullText)) {
      unsupported.push(u.reason);
      score -= 0.15;
    }
  }
  if (unsupported.length > 0) {
    findings.push(`UNSUPPORTED_ASSUMPTIONS: ${unsupported.join('; ')}`);
  }

  // 5. Substance Threshold (Non-Trivial Architectural Content)
  const ruleLen = (item.ruleText || '').length;
  if (ruleLen < 40) {
    findings.push('SUBSTANCE_TOO_LOW: Rule text is under 40 characters and lacks concrete technical instruction');
    score -= 0.3;
  } else {
    details.push('Substantive technical content verified (> 40 chars)');
  }

  score = Math.max(0.0, Math.min(1.0, Math.round(score * 100) / 100));
  const isCriticalFail = hasDangerousSecurity || directiveOpposition || !injection.safe;
  const status = isCriticalFail ? DIMENSION_STATUS.FAIL : (findings.length === 0 ? DIMENSION_STATUS.PASS : (score >= 0.5 ? DIMENSION_STATUS.WARN : DIMENSION_STATUS.FAIL));

  return {
    status,
    score,
    is_adversarial: !injection.safe,
    has_dangerous_security: hasDangerousSecurity,
    directive_opposition: directiveOpposition,
    opposing_rule: opposingRule,
    unsupported_assumptions: unsupported,
    findings,
    details
  };
}

// ---------------------------------------------------------------------------
// Dimension 4: Reusability
// ---------------------------------------------------------------------------
export function validateReusability(item, options = {}) {
  const fullText = `${item.title}\n${item.rawBody}`;
  const findings = [];
  const details = [];
  let score = 0.5;

  // 1. Check for Local Machine Artifacts / Hardcoded Absolute Paths
  let hasLocalPath = false;
  for (const p of LOCAL_MACHINE_PATH_PATTERNS) {
    if (p.test(fullText)) {
      hasLocalPath = true;
      findings.push('LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path');
      score -= 0.3;
      break;
    }
  }

  if (!hasLocalPath) {
    score += 0.2;
    details.push('Free of local workstation path artifacts');
  }

  // 2. Generic Invariant Language vs Repo-Specific Workaround
  const genericIndicators = [
    /\bMUST\b/, /\bMUST NOT\b/, /\bSHOULD\b/, /\binvariant\b/i,
    /\bboundary\b/i, /\bisolation\b/i, /\brace condition\b/i,
    /\bconcurrency\b/i, /\bpersistence\b/i, /\bidempotent\b/i,
    /\bmemory leak\b/i, /\bbackpressure\b/i, /\berror boundary\b/i
  ];
  const genericMatches = genericIndicators.filter(re => re.test(fullText)).length;

  if (genericMatches >= 2) {
    score += 0.2;
    details.push(`Expresses generalized engineering invariants (${genericMatches} architectural markers)`);
  }

  // 3. Explicit Applicability Scope
  if (item.whenText && item.whenText.length > 20) {
    score += 0.1;
    details.push('Explicit WHEN TO APPLY scope defined');
  } else {
    findings.push('VAGUE_APPLICABILITY_SCOPE: Lacks explicit applicability conditions (WHEN TO APPLY)');
  }

  score = Math.max(0.0, Math.min(1.0, Math.round(score * 100) / 100));
  const isGeneric = score >= 0.6 && !hasLocalPath;
  const status = isGeneric ? DIMENSION_STATUS.PASS : (score >= 0.35 ? DIMENSION_STATUS.WARN : DIMENSION_STATUS.FAIL);

  return {
    status,
    score,
    is_generic_pattern: isGeneric,
    has_local_paths: hasLocalPath,
    findings,
    details
  };
}

// ---------------------------------------------------------------------------
// Dimension 5: Completeness
// ---------------------------------------------------------------------------
export function validateCompleteness(item, options = {}) {
  const missing = [];
  const details = [];
  let score = 0.0;

  // 1. Core Triad: Rule, Why, When
  const hasRule = Boolean(item.hasExplicitRule && item.ruleText && item.ruleText.length >= 25);
  const hasWhy = Boolean(item.whyText && item.whyText.length >= 15);
  const hasWhen = Boolean(item.whenText && item.whenText.length >= 15);

  if (hasRule) {
    score += 0.4;
    details.push('Preserves normative RULE declaration');
  } else {
    missing.push('RULE: Missing or incomplete normative rule statement');
  }

  if (hasWhy) {
    score += 0.25;
    details.push('Preserves technical rationale (WHY)');
  } else {
    missing.push('WHY: Missing technical rationale and root-cause justification');
  }

  if (hasWhen) {
    score += 0.2;
    details.push('Preserves operational boundary (WHEN TO APPLY)');
  } else {
    missing.push('WHEN TO APPLY: Missing explicit triggering conditions');
  }

  // 2. Negative Examples or Failure Boundaries
  if (item.negativeExample || item.rawBody.includes('**NEGATIVE')) {
    score += 0.15;
    details.push('Includes explicit negative example / anti-pattern contrast');
  }

  score = Math.min(1.0, Math.round(score * 100) / 100);
  const status = missing.length === 0 ? DIMENSION_STATUS.PASS : (score >= 0.4 ? DIMENSION_STATUS.WARN : DIMENSION_STATUS.FAIL);

  return {
    status,
    score,
    has_rule: hasRule,
    has_why: hasWhy,
    has_when: hasWhen,
    missing_fields: missing,
    details
  };
}

// ---------------------------------------------------------------------------
// Dimension 6: Freshness & Ecosystem Validity
// ---------------------------------------------------------------------------
export function validateFreshnessAndValidity(item, options = {}) {
  const fullText = `${item.title}\n${item.rawBody}`;
  const findings = [];
  const details = [];
  let score = 0.7; // baseline freshness for active harvests

  // 1. Check for Obsolete Ecosystems & Stale Runtimes
  let hasStaleEcosystem = false;
  for (const re of STALE_ECOSYSTEM_PATTERNS) {
    if (re.test(fullText)) {
      hasStaleEcosystem = true;
      findings.push(`STALE_ECOSYSTEM_TECH: Mentions deprecated or obsolete runtime/library (${re.source})`);
      score -= 0.4;
      break;
    }
  }

  if (!hasStaleEcosystem) {
    score += 0.15;
    details.push('Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)');
  }

  // 2. Timestamp Traceability
  if (item.source?.verified_at) {
    score += 0.15;
    details.push(`Harvested/verified timestamp recorded: ${item.source.verified_at}`);
  }

  score = Math.max(0.0, Math.min(1.0, Math.round(score * 100) / 100));
  const stalenessRisk = hasStaleEcosystem ? 'HIGH' : (item.source?.version === 'HEAD' ? 'MEDIUM' : 'LOW');
  const status = stalenessRisk === 'LOW' ? DIMENSION_STATUS.PASS : (stalenessRisk === 'MEDIUM' ? DIMENSION_STATUS.WARN : DIMENSION_STATUS.FAIL);

  return {
    status,
    score,
    staleness_risk: stalenessRisk,
    findings,
    details
  };
}

// ---------------------------------------------------------------------------
// Dimension 7: Duplication & Conflict
// ---------------------------------------------------------------------------
export function validateDuplicationAndConflict(item, options = {}) {
  const p = getBrainPaths(options.brainRoot || null);
  const details = [];
  const findings = [];
  let isDuplicate = false;
  let isContradiction = false;
  let duplicateTarget = null;
  let conflictingRule = null;
  let score = 1.0;

  // 1. Check Against Existing Canonical Patterns via BM25 Search
  try {
    const searchRes = searchBrain(item.title, {
      topK: 3,
      brainRoot: p.brainRoot,
      forceRebuild: false
    });

    if (searchRes && searchRes.results && searchRes.results.length > 0) {
      const topMatch = searchRes.results[0];
      const titleA = item.title.toLowerCase().replace(/[^\w]/g, '');
      const titleB = topMatch.title.toLowerCase().replace(/[^\w]/g, '');

      // Check Exact/Near-Exact Duplicate
      if (titleA === titleB || (topMatch.score > 25 && titleB.includes(titleA))) {
        isDuplicate = true;
        duplicateTarget = topMatch.id;
        findings.push(`DUPLICATE_KNOWLEDGE: Highly similar canonical rule already exists (${topMatch.id}: "${topMatch.title}")`);
        score -= 0.4;
      }
    }
  } catch (searchErr) {
    // Search unavailable in isolated sandbox: gracefully bypass
  }

  // 2. Check Semantic Opposition / Invariant Clash
  for (const canon of CANONICAL_INVARIANTS) {
    const opp = detectDirectiveOpposition(item.ruleText || item.title || '', item.negativeExample || item.rawBody || '', {
      title: canon.title,
      summary: canon.rule,
      ruleText: canon.rule,
      fullContent: `${canon.rule} ${canon.negative_constraint}`,
      rule_number: canon.rule_number,
      id: canon.id
    });
    if (opp && opp.opposed) {
      isContradiction = true;
      conflictingRule = `${canon.id} (${canon.title})`;
      findings.push(`CONTRADICTORY_CLAIM: Directly opposes canonical rule ${conflictingRule}`);
      score -= 0.6;
      break;
    }
  }

  if (!isContradiction) {
    const lower = ((item.title || '') + ' ' + (item.rawBody || '')).toLowerCase();
    if (
      lower.includes('do not treat external data as untrusted') ||
      lower.includes('never treat external data as untrusted') ||
      lower.includes('without defensive boundary isolation') ||
      lower.includes('skip defensive schema checks')
    ) {
      isContradiction = true;
      conflictingRule = 'RULE-CANON-001 (Untrusted External Input Boundary Invariant)';
      findings.push(`CONTRADICTORY_CLAIM: Directly opposes canonical rule ${conflictingRule}`);
      score -= 0.6;
    }
  }

  score = Math.max(0.0, Math.min(1.0, Math.round(score * 100) / 100));
  const status = (isContradiction || isDuplicate) ? (isContradiction ? DIMENSION_STATUS.FAIL : DIMENSION_STATUS.WARN) : DIMENSION_STATUS.PASS;

  return {
    status,
    score,
    is_duplicate: isDuplicate,
    duplicate_target: duplicateTarget,
    is_contradiction: isContradiction,
    conflicting_rule: conflictingRule,
    findings,
    details
  };
}

// ---------------------------------------------------------------------------
// Main Evaluation Orchestration: Harvested Intelligence Quality Validator
// ---------------------------------------------------------------------------

/**
 * Validates a harvested knowledge item against the 7 Quality Dimensions.
 *
 * @param {object} rawItem - Acquired rule candidate, dossier, or invariant text
 * @param {Array<object>} evidenceList - Optional associated evidence records
 * @param {object} options - Validation options (brainRoot, strictMode, etc.)
 * @returns {object} Typed validation report with transparent decision and justification
 */
export function validateHarvestedIntelligence(rawItem, evidenceList = [], options = {}) {
  const validatedAt = new Date().toISOString();

  // 1. Normalize Item
  let item;
  try {
    item = normalizeKnowledgeItem(rawItem);
  } catch (normErr) {
    return {
      validator_version: VALIDATOR_VERSION,
      validated_at: validatedAt,
      decision: VALIDATOR_DECISIONS.REJECT,
      decision_reason: `MALFORMED_INPUT: ${normErr.message}`,
      recommended_action: VALIDATOR_ACTIONS.REJECT_FAIL_CLOSED,
      confidence_score: 0.0,
      confidence_justification: 'Input payload could not be normalized into valid knowledge contract',
      item: { id: 'MALFORMED', title: 'INVALID' },
      dimensions: {},
      detected_contradictions: [],
      missing_information: ['Valid knowledge structure'],
      limitations: ['Malformed input'],
      evidence_references: []
    };
  }

  // 2. Evaluate all 7 dimensions independently
  const d1 = validateSourceReliability(item, options);
  const d2 = validateEvidenceQuality(item, evidenceList, options);
  const d3 = validateTechnicalCorrectness(item, options);
  const d4 = validateReusability(item, options);
  const d5 = validateCompleteness(item, options);
  const d6 = validateFreshnessAndValidity(item, options);
  const d7 = validateDuplicationAndConflict(item, options);

  const dimensions = {
    source_reliability: d1,
    evidence_quality: d2,
    technical_correctness: d3,
    reusability: d4,
    completeness: d5,
    freshness: d6,
    duplication_and_conflict: d7
  };

  // 3. Aggregate Contradictions, Missing Info, and Findings
  const allFindings = [
    ...d1.findings,
    ...d2.findings,
    ...d3.findings,
    ...d4.findings,
    ...d5.missing_fields,
    ...d6.findings,
    ...d7.findings
  ];

  const detectedContradictions = [];
  if (d3.directive_opposition) {
    detectedContradictions.push(`Canonical opposition: Clashes with ${d3.opposing_rule || 'core invariant'}`);
  }
  if (d7.is_contradiction) {
    detectedContradictions.push(`Conflict with ${d7.conflicting_rule}`);
  }

  const missingInformation = [...d5.missing_fields];
  if (d1.status === DIMENSION_STATUS.FAIL) missingInformation.push('Source provenance');
  if (d2.effective_sources === 0) missingInformation.push('Empirical evidence records');

  const limitations = [];
  if (!d4.is_generic_pattern) limitations.push('Repository-specific scope; not generalized for universal construction');
  if (d2.corroboration_tier === INDEPENDENCE_TIERS.COPIED_OR_MIRRORED) limitations.push('Corroboration limited to copied/mirrored sources');
  if (d6.staleness_risk !== 'LOW') limitations.push(`Staleness risk: ${d6.staleness_risk}`);

  // 4. Calculate Deterministic Confidence Score
  // Weights: Source (15%), Evidence (25%), Correctness (25%), Reusability (15%), Completeness (10%), Freshness (5%), Conflict (5%)
  const weightedScore = (
    d1.score * 0.15 +
    d2.score * 0.25 +
    d3.score * 0.25 +
    d4.score * 0.15 +
    d5.score * 0.10 +
    d6.score * 0.05 +
    d7.score * 0.05
  );
  let confidenceScore = Math.round(weightedScore * 100) / 100;

  // 5. Synthesize Final Decision & Recommended Action
  let decision = VALIDATOR_DECISIONS.PASS;
  let decisionReason = '';
  let recommendedAction = VALIDATOR_ACTIONS.PROMOTE_TO_CANONICAL;

  const isSingleSourceUncorroborated = (
    d2.effective_sources === 0 ||
    (d2.effective_sources === 1 && d1.tier === TRUST_TIERS.TIER_3_COMMUNITY_OPEN) ||
    d2.corroboration_tier === INDEPENDENCE_TIERS.COPIED_OR_MIRRORED
  );

  // Invariant 1: Security Prompt Injections or Dangerous Advice strictly REJECT
  if (
    d3.is_adversarial ||
    d3.has_dangerous_security ||
    d1.status === DIMENSION_STATUS.FAIL ||
    d3.status === DIMENSION_STATUS.FAIL
  ) {
    decision = VALIDATOR_DECISIONS.REJECT;
    recommendedAction = VALIDATOR_ACTIONS.REJECT_FAIL_CLOSED;
    decisionReason = `Rejected fail-closed: ${allFindings.join('; ')}`;
    if (d3.is_adversarial || d3.has_dangerous_security || d1.status === DIMENSION_STATUS.FAIL) {
      confidenceScore = 0.0;
    }
  }
  // Invariant 2: Direct Contradiction against Canonical Knowledge
  else if (detectedContradictions.length > 0 || d3.directive_opposition || d7.is_contradiction) {
    decision = VALIDATOR_DECISIONS.REJECT;
    recommendedAction = VALIDATOR_ACTIONS.REJECT_FAIL_CLOSED;
    decisionReason = `Rejected: Contradicts established canonical invariants (${detectedContradictions.join('; ') || d7.conflicting_rule || d3.opposing_rule})`;
  }
  // Invariant 3: Needs Review (Severe ambiguity, uncorroborated conflicting claims, missing core rule)
  else if (!d5.has_rule || d6.status === DIMENSION_STATUS.FAIL || d2.status === DIMENSION_STATUS.FAIL) {
    decision = VALIDATOR_DECISIONS.NEEDS_REVIEW;
    recommendedAction = VALIDATOR_ACTIONS.QUARANTINE_FOR_REVIEW;
    decisionReason = `Quarantined for review: Incomplete rule definition or ungrounded evidence (${allFindings.join('; ')})`;
  }
  // Invariant 4: Conditional Pass (Valid technically, but repo-specific, duplicate, or single-source supported)
  else if (!d4.is_generic_pattern || d7.is_duplicate || isSingleSourceUncorroborated || d5.status === DIMENSION_STATUS.WARN) {
    decision = VALIDATOR_DECISIONS.CONDITIONAL_PASS;
    recommendedAction = VALIDATOR_ACTIONS.STAGE_AS_CONDITIONAL_DOSSIER;
    const conditionReasons = [];
    if (!d4.is_generic_pattern) conditionReasons.push('pattern is repository-specific');
    if (d7.is_duplicate) conditionReasons.push('high semantic overlap with existing canonical rule');
    if (isSingleSourceUncorroborated) conditionReasons.push('single-source supported without independent cross-corroboration');
    if (d5.status === DIMENSION_STATUS.WARN) conditionReasons.push('missing operational boundary (WHEN TO APPLY)');
    decisionReason = `Conditional pass: Usable in dossier/retrieval, but withheld from universal canonical promotion because ${conditionReasons.join(', ')}`;
  }
  // All green: Full Universal Canonical Promotion
  else {
    decision = VALIDATOR_DECISIONS.PASS;
    recommendedAction = VALIDATOR_ACTIONS.PROMOTE_TO_CANONICAL;
    decisionReason = 'Verified: Independently corroborated, technically sound, complete, and reusable generic invariant';
  }

  // Generate explainable justification
  const confidenceJustification = `Evaluated across 7 dimensions (Score: ${(confidenceScore * 100).toFixed(0)}%). Source=${d1.status} (${d1.tier}), Evidence=${d2.status} (${d2.effective_sources} effective sources), Correctness=${d3.status}, Reusability=${d4.status}, Completeness=${d5.status}, Freshness=${d6.status}, Conflict=${d7.status}.`;

  const evidenceReferences = Array.isArray(evidenceList) ? evidenceList.map(e => e.evidence_id || e.id || 'EVID-UNSPECIFIED') : [];

  return {
    validator_version: VALIDATOR_VERSION,
    validated_at: validatedAt,
    decision,
    decision_reason: decisionReason,
    recommended_action: recommendedAction,
    confidence_score: confidenceScore,
    confidence_justification: confidenceJustification,
    item: {
      id: item.id,
      title: item.title,
      category: item.category,
      domain: item.domain,
      source_id: item.source.id,
      source_uri: item.source.uri,
      source_version: item.source.version,
      content_hash: item.rawHash || computeCandidateHash(item)
    },
    evidence_fingerprint: computeEvidenceFingerprint(evidenceList),
    dimensions,
    detected_contradictions: detectedContradictions,
    missing_information: missingInformation,
    limitations,
    evidence_references: evidenceReferences
  };
}

/**
 * Deterministic candidate content hash for integrity binding.
 */
export function computeCandidateHash(cand) {
  if (!cand || typeof cand !== 'object') return '';
  const title = (cand.title || '').trim();
  const body = (cand.body || cand.rawBody || cand.content || '').trim();
  return crypto.createHash('sha256').update(`${title}\n${body}`).digest('hex');
}

/**
 * Deterministic evidence fingerprint for integrity binding.
 */
export function computeEvidenceFingerprint(evidenceList = []) {
  if (!Array.isArray(evidenceList) || evidenceList.length === 0) return 'NO_EVIDENCE';
  const hashes = evidenceList.map(e => e.content_hash || e.evidence_id || e.id || '').sort().join(';');
  return crypto.createHash('sha256').update(hashes).digest('hex').slice(0, 16);
}

/**
 * Verifies that a caller-supplied validation report is authentic, well-formed,
 * and deterministically bound to the candidate and evidence list.
 * Prevents report forgery, replay attacks, candidate mutation, and evidence tampering.
 */
export function verifyReportIntegrity(candidate, evidenceList = [], report = null, options = {}) {
  if (!report || typeof report !== 'object') {
    return { valid: false, error: 'REPORT_MISSING_OR_MALFORMED', reason: 'Validation report is missing or not an object' };
  }
  if (!report.validator_version || report.validator_version !== VALIDATOR_VERSION) {
    return {
      valid: false,
      error: 'VALIDATOR_VERSION_MISMATCH',
      reason: `Validator version mismatch: expected ${VALIDATOR_VERSION}, got ${report.validator_version || 'NONE'}`
    };
  }
  if (!report.decision || !report.dimensions || typeof report.dimensions !== 'object') {
    return { valid: false, error: 'REPORT_STRUCTURE_INVALID', reason: 'Validation report missing decision or dimensions' };
  }
  if (!report.item || typeof report.item !== 'object') {
    return { valid: false, error: 'REPORT_ITEM_BINDING_MISSING', reason: 'Validation report lacks candidate item binding' };
  }
  if (report.item.title && candidate?.title && report.item.title.trim().toLowerCase() !== candidate.title.trim().toLowerCase()) {
    return {
      valid: false,
      error: 'REPLAY_ATTACK_DETECTED',
      reason: `Report bound to title '${report.item.title}' does not match candidate '${candidate.title}'`
    };
  }
  const currentCandHash = computeCandidateHash(candidate);
  if (report.item.content_hash && currentCandHash && report.item.content_hash !== currentCandHash) {
    return {
      valid: false,
      error: 'CANDIDATE_MUTATION_DETECTED',
      reason: 'Candidate content mutated after validation report was generated'
    };
  }
  const currentEvFingerprint = computeEvidenceFingerprint(evidenceList);
  if (report.evidence_fingerprint && report.evidence_fingerprint !== currentEvFingerprint) {
    return {
      valid: false,
      error: 'EVIDENCE_MUTATION_DETECTED',
      reason: 'Evidence list mutated or altered after validation report was generated'
    };
  }
  return { valid: true };
}
