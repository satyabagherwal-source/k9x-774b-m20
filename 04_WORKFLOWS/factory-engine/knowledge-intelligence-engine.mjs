/**
 * KNOWLEDGE INTELLIGENCE & EVIDENCE ENGINE (PHASE F)
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\knowledge-intelligence-engine.mjs
 * Purpose: Implements an evidence-aware intelligence layer determining:
 *   - What knowledge is grounded in empirical evidence vs inference vs ambiguity
 *   - Explicit evidence quality tiers and provenance validation
 *   - Independent corroboration analysis (detecting copies, forks, mirrors vs distinct sources)
 *   - Context- and version-aware contradiction handling (avoiding false conflicts)
 *   - Strict persistence integrity with atomic writes and read-back verification
 *   - Fail-closed canonical promotion gating based on empirical evidence tiers
 *
 * Security Invariants:
 * 1. External sources and evidence records are UNTRUSTED DATA by default.
 * 2. Adversarial prompt injection patterns in evidence are rejected fail-closed.
 * 3. Popularity (stars, forks) is never treated as a correctness or trust metric.
 * 4. Copied or same-entity sources are never inflated into independent corroboration.
 * 5. Atomic persistence with read-back verification and safe rollback on failure.
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
  calculateContentHash,
  readBackVerifyFile
} from './brain-learning-gateway.mjs';

import {
  detectDirectiveOpposition,
  inspectPromptInjection,
  TRUST_TIERS
} from './knowledge-acquisition-pipeline.mjs';

import { searchBrain } from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

// -------------------------------------------------------------------------
// 1. Evidence Enums & Quality Tiers
// -------------------------------------------------------------------------

export const EVIDENCE_TYPES = {
  CODE_IMPLEMENTATION: 'CODE_IMPLEMENTATION',
  OFFICIAL_DOCS: 'OFFICIAL_DOCS',
  COMMIT_DIFF: 'COMMIT_DIFF',
  USER_DIRECTIVE: 'USER_DIRECTIVE',
  SECONDARY_ARTICLE: 'SECONDARY_ARTICLE',
  PACKAGE_METADATA: 'PACKAGE_METADATA',
  REPRODUCIBLE_TEST: 'REPRODUCIBLE_TEST',
  BENCHMARK_RESULT: 'BENCHMARK_RESULT'
};

export const EVIDENCE_STATUS = {
  DIRECTLY_VERIFIED: 'DIRECTLY_VERIFIED',
  PRIMARY_SOURCE_SUPPORTED: 'PRIMARY_SOURCE_SUPPORTED',
  INDEPENDENTLY_CORROBORATED: 'INDEPENDENTLY_CORROBORATED',
  SINGLE_SOURCE_SUPPORTED: 'SINGLE_SOURCE_SUPPORTED',
  INFERRED: 'INFERRED',
  CONFLICTING: 'CONFLICTING',
  UNVERIFIED: 'UNVERIFIED',
  STALE: 'STALE',
  REJECTED: 'REJECTED'
};

export const EVIDENCE_DECISION = {
  SUPPORTED: 'SUPPORTED',
  PARTIALLY_SUPPORTED: 'PARTIALLY_SUPPORTED',
  CONFLICTING: 'CONFLICTING',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  STALE: 'STALE',
  REJECTED: 'REJECTED'
};

export const INDEPENDENCE_TIERS = {
  INDEPENDENT: 'INDEPENDENT',
  COPIED_OR_MIRRORED: 'COPIED_OR_MIRRORED',
  SAME_ENTITY: 'SAME_ENTITY',
  INDEPENDENCE_UNVERIFIED: 'INDEPENDENCE_UNVERIFIED'
};

export const VERIFICATION_METHODS = {
  STATIC_ANALYSIS: 'STATIC_ANALYSIS',
  EMPIRICAL_TEST: 'EMPIRICAL_TEST',
  DOC_DECLARATION: 'DOC_DECLARATION',
  DIFF_INSPECTION: 'DIFF_INSPECTION',
  MANUAL_AUDIT: 'MANUAL_AUDIT',
  UNVERIFIED: 'UNVERIFIED'
};

// -------------------------------------------------------------------------
// 2. Evidence Record Creation & Schema Validation
// -------------------------------------------------------------------------

/**
 * Creates and sanitizes a structured Evidence Record.
 *
 * @param {object} params - Input evidence attributes
 * @param {object} options - Options including strict mode and brainRoot
 * @returns {object} Validated, immutable evidence record
 */
export function createEvidenceRecord(params = {}, options = {}) {
  // Required provenance and linkage checks
  if (!params.claim_id || typeof params.claim_id !== 'string' || params.claim_id.trim() === '') {
    throw new Error('MISSING_CLAIM_LINKAGE: Evidence record must have a non-empty claim_id');
  }

  if (!params.source_id || typeof params.source_id !== 'string' || params.source_id.trim() === '') {
    throw new Error('MISSING_PROVENANCE: Evidence record must have a non-empty source_id');
  }

  if (!params.source_uri || typeof params.source_uri !== 'string' || params.source_uri.trim() === '') {
    throw new Error('MISSING_PROVENANCE: Evidence record must have a non-empty source_uri');
  }

  if (!params.supporting_excerpt || typeof params.supporting_excerpt !== 'string' || params.supporting_excerpt.trim() === '') {
    throw new Error('MISSING_SUPPORTING_EXCERPT: Evidence record must provide supporting_excerpt');
  }

  // Calculate actual content hash
  const computedHash = calculateContentHash(params.supporting_excerpt);

  // Tampered content hash detection
  if (params.content_hash && params.content_hash !== computedHash) {
    throw new Error(`TAMPERED_CONTENT_HASH: Provided hash "${params.content_hash}" does not match computed hash "${computedHash}"`);
  }

  // Adversarial prompt injection inspection
  const injectionCheck = inspectPromptInjection(params.supporting_excerpt);
  const isAdversarial = !injectionCheck.safe;

  // Evidence ID: deterministic from claim, source, and computed content hash
  const deterministicId = `EVID-${crypto.createHash('sha256')
    .update(`${params.claim_id}:${params.source_id}:${computedHash}`)
    .digest('hex').slice(0, 16).toUpperCase()}`;

  const evidenceId = params.evidence_id || deterministicId;

  // Determine initial verification status
  let initialStatus = params.verification_status || EVIDENCE_STATUS.UNVERIFIED;
  if (isAdversarial) {
    initialStatus = EVIDENCE_STATUS.REJECTED;
  }

  const record = {
    evidence_id: evidenceId,
    claim_id: params.claim_id.trim(),
    source_id: params.source_id.trim(),
    source_uri: params.source_uri.trim(),
    source_type: params.source_type || 'UNKNOWN',
    source_version: (params.source_version !== undefined && params.source_version !== null) ? String(params.source_version) : null,
    content_hash: computedHash,
    observed_at: params.observed_at || new Date().toISOString(),
    captured_at: params.captured_at || new Date().toISOString(),
    evidence_type: params.evidence_type || EVIDENCE_TYPES.OFFICIAL_DOCS,
    supporting_excerpt: params.supporting_excerpt,
    verification_method: params.verification_method || VERIFICATION_METHODS.UNVERIFIED,
    verification_status: initialStatus,
    limitations: params.limitations || null,
    license_status: params.license_status || 'UNKNOWN',
    related_evidence_ids: Array.isArray(params.related_evidence_ids) ? [...params.related_evidence_ids] : [],
    untrusted_boundary: true,
    is_adversarial: isAdversarial,
    rejection_reason: isAdversarial ? injectionCheck.reason : null,
    is_fork: Boolean(params.is_fork),
    is_mirror: Boolean(params.is_mirror),
    mirror_of: params.mirror_of || null,
    is_stale: Boolean(params.is_stale)
  };

  return Object.freeze(record);
}

/**
 * Validates an Evidence Record structure, hash integrity, and provenance fail-closed.
 *
 * @param {object} record - Record to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateEvidenceRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Record must be a non-null object'] };
  }

  if (!record.evidence_id || typeof record.evidence_id !== 'string') {
    errors.push('MISSING_EVIDENCE_ID');
  }

  if (!record.claim_id || typeof record.claim_id !== 'string' || record.claim_id.trim() === '') {
    errors.push('MISSING_CLAIM_ID');
  }

  if (!record.source_id || typeof record.source_id !== 'string' || record.source_id.trim() === '') {
    errors.push('MISSING_SOURCE_ID');
  }

  if (!record.source_uri || typeof record.source_uri !== 'string' || record.source_uri.trim() === '') {
    errors.push('MISSING_SOURCE_URI');
  }

  if (!record.supporting_excerpt || typeof record.supporting_excerpt !== 'string' || record.supporting_excerpt.trim() === '') {
    errors.push('MISSING_SUPPORTING_EXCERPT');
  }

  if (record.supporting_excerpt && record.content_hash) {
    const computed = calculateContentHash(record.supporting_excerpt);
    if (computed !== record.content_hash) {
      errors.push(`TAMPERED_CONTENT_HASH: Expected ${computed}, received ${record.content_hash}`);
    }
  }

  if (record.is_adversarial) {
    errors.push(`ADVERSARIAL_PROMPT_INJECTION: ${record.rejection_reason}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// -------------------------------------------------------------------------
// 3. Claims vs Evidence vs Inference vs Ambiguity Decomposition
// -------------------------------------------------------------------------

/**
 * Categorizes and decomposes a knowledge statement into distinct cognitive layers:
 * claim, empirical evidence, logical inference, and unresolved ambiguities.
 *
 * @param {object} assertion - Input knowledge assertion
 * @returns {object} Decomposed representation
 */
export function categorizeKnowledgeAssertion(assertion = {}) {
  const statement = (assertion.statement || assertion.rule || assertion.claim || '').trim();
  const rawExcerpt = (assertion.excerpt || assertion.evidence || '').trim();
  const contextNotes = (assertion.notes || assertion.context || '').trim();

  // Detect explicit inference keywords
  const inferenceIndicators = [
    /\bprobably\b/i,
    /\blikely\b/i,
    /\bpresumably\b/i,
    /\bmight\b/i,
    /\bcould\b/i,
    /\bseems\s+to\b/i,
    /\bshould\s+theoretically\b/i,
    /\bextrapolated\b/i
  ];
  const isInferential = inferenceIndicators.some(pattern => pattern.test(statement) || pattern.test(contextNotes));

  // Detect unresolved ambiguities
  const ambiguityIndicators = [
    /\bunspecified\b/i,
    /\bunclear\b/i,
    /\bdepends\s+on\b/i,
    /\bunknown\s+version\b/i,
    /\bnot\s+tested\s+on\b/i,
    /\bto\s+be\s+determined\b/i,
    /\btbd\b/i
  ];
  const hasAmbiguities = ambiguityIndicators.some(pattern => pattern.test(statement) || pattern.test(contextNotes));

  const hasEmpiricalEvidence = Boolean(rawExcerpt && rawExcerpt.length >= 20 && !isInferential);

  let confidenceTier = EVIDENCE_STATUS.UNVERIFIED;
  if (hasEmpiricalEvidence && assertion.test_passed) {
    confidenceTier = EVIDENCE_STATUS.DIRECTLY_VERIFIED;
  } else if (hasEmpiricalEvidence) {
    confidenceTier = EVIDENCE_STATUS.PRIMARY_SOURCE_SUPPORTED;
  } else if (isInferential) {
    confidenceTier = EVIDENCE_STATUS.INFERRED;
  }

  return {
    claim: statement,
    evidence: rawExcerpt || null,
    inference: isInferential ? statement : null,
    ambiguities: hasAmbiguities ? (assertion.limitations || 'Unresolved context boundaries detected') : null,
    has_empirical_evidence: hasEmpiricalEvidence,
    confidence_tier: confidenceTier
  };
}

// -------------------------------------------------------------------------
// 4. Independent Corroboration Engine
// -------------------------------------------------------------------------

/**
 * Extracts a normalized source entity (owner/organization or domain) from a URI or source ID.
 */
function extractSourceEntity(sourceId, sourceUri) {
  const combined = `${sourceId} ${sourceUri}`.toLowerCase();
  
  // GitHub repo pattern: github.com/owner/repo
  const ghMatch = combined.match(/github\.com\/([a-z0-9_-]+)\/([a-z0-9_.-]+)/i);
  if (ghMatch) {
    return {
      entity: `github:${ghMatch[1]}`,
      repo: `${ghMatch[1]}/${ghMatch[2]}`.replace(/\.git$/, '')
    };
  }

  // Domain name extraction
  const domainMatch = combined.match(/https?:\/\/([^/:]+)/i);
  if (domainMatch) {
    return {
      entity: `domain:${domainMatch[1]}`,
      repo: null
    };
  }

  return {
    entity: `raw:${sourceId.toLowerCase().trim()}`,
    repo: null
  };
}

/**
 * Evaluates whether multiple sources corroborating a claim are genuinely independent,
 * or merely copies, mirrors, forks, or same-owner publications.
 *
 * @param {string} claimId - Claim ID being corroborated
 * @param {Array<object>} evidenceList - List of evidence records
 * @param {object} options - Options
 * @returns {object} Corroboration assessment
 */
export function evaluateEvidenceCorroboration(claimId, evidenceList = [], options = {}) {
  if (!claimId) {
    throw new Error('MISSING_CLAIM_ID: Claim ID is required for corroboration assessment');
  }

  const validEvidence = evidenceList.filter(e => {
    const val = validateEvidenceRecord(e);
    return val.valid && !e.is_adversarial && !e.is_stale;
  });

  if (validEvidence.length === 0) {
    return {
      claim_id: claimId,
      total_records: evidenceList.length,
      valid_records: 0,
      effective_sources: 0,
      independence_tier: INDEPENDENCE_TIERS.INDEPENDENCE_UNVERIFIED,
      is_corroborated: false,
      copied_groups: [],
      reason: 'No valid, non-adversarial, non-stale evidence records available'
    };
  }

  if (validEvidence.length === 1) {
    return {
      claim_id: claimId,
      total_records: evidenceList.length,
      valid_records: 1,
      effective_sources: 1,
      independence_tier: INDEPENDENCE_TIERS.INDEPENDENT,
      is_corroborated: false, // Single source cannot be independently corroborated by definition
      copied_groups: [],
      reason: 'Single source supported; corroboration requires at least 2 distinct independent sources'
    };
  }

  // Analyze multi-source independence
  const contentHashMap = new Map();
  const entityMap = new Map();
  const copiedGroups = [];

  for (const rec of validEvidence) {
    // Check identical content hash
    if (!contentHashMap.has(rec.content_hash)) {
      contentHashMap.set(rec.content_hash, []);
    }
    contentHashMap.get(rec.content_hash).push(rec);

    // Check entity / repo ownership
    const { entity, repo } = extractSourceEntity(rec.source_id, rec.source_uri);
    const entityKey = repo || entity;

    if (!entityMap.has(entityKey)) {
      entityMap.set(entityKey, []);
    }
    entityMap.get(entityKey).push(rec);

    // Check explicit mirror or fork metadata
    if (rec.is_fork || rec.is_mirror || rec.mirror_of) {
      copiedGroups.push({
        evidence_id: rec.evidence_id,
        source_uri: rec.source_uri,
        type: rec.is_fork ? 'FORK' : 'MIRROR',
        parent: rec.mirror_of || 'unknown'
      });
    }
  }

  // Identify duplicate content across different URLs
  for (const [hash, records] of contentHashMap.entries()) {
    if (records.length > 1) {
      const uris = records.map(r => r.source_uri);
      const uniqueUris = new Set(uris);
      if (uniqueUris.size > 1) {
        copiedGroups.push({
          type: 'IDENTICAL_CONTENT_HASH',
          content_hash: hash,
          source_uris: Array.from(uniqueUris)
        });
      }
    }
  }

  // Calculate distinct independent origins
  // Distinct origins require: different entity/organization AND different content hash / independent tests
  const distinctEntities = new Set(entityMap.keys());
  const distinctHashes = new Set(contentHashMap.keys());

  let independenceTier = INDEPENDENCE_TIERS.INDEPENDENT;
  let effectiveSources = distinctEntities.size;

  if (distinctEntities.size === 1) {
    // All sources come from the same repo or owner
    independenceTier = INDEPENDENCE_TIERS.SAME_ENTITY;
    effectiveSources = 1;
  } else if (copiedGroups.length > 0 && distinctHashes.size === 1) {
    // Different URLs but identical content hash everywhere -> copied / mirrored
    independenceTier = INDEPENDENCE_TIERS.COPIED_OR_MIRRORED;
    effectiveSources = 1;
  } else if (distinctEntities.size >= 2 && distinctHashes.size >= 2) {
    // Genuinely distinct independent sources
    independenceTier = INDEPENDENCE_TIERS.INDEPENDENT;
    effectiveSources = distinctEntities.size;
  } else {
    independenceTier = INDEPENDENCE_TIERS.INDEPENDENCE_UNVERIFIED;
    effectiveSources = Math.min(distinctEntities.size, distinctHashes.size);
  }

  const isCorroborated = effectiveSources >= 2 && independenceTier === INDEPENDENCE_TIERS.INDEPENDENT;

  return {
    claim_id: claimId,
    total_records: evidenceList.length,
    valid_records: validEvidence.length,
    effective_sources: effectiveSources,
    independence_tier: independenceTier,
    is_corroborated: isCorroborated,
    copied_groups: copiedGroups,
    reason: isCorroborated
      ? `Corroborated by ${effectiveSources} distinct, independent sources`
      : `Cannot claim independent corroboration: status is ${independenceTier} with ${effectiveSources} effective sources`
  };
}

// -------------------------------------------------------------------------
// 5. Context- & Version-Aware Contradiction Engine
// -------------------------------------------------------------------------

/**
 * Extracts context boundaries (OS, version, architecture, use-case) from claim text.
 */
function extractContextBoundaries(text) {
  const lower = (text || '').toLowerCase();
  
  const osMatches = [];
  if (lower.includes('windows') || lower.includes('win32')) osMatches.push('windows');
  if (lower.includes('linux')) osMatches.push('linux');
  if (lower.includes('darwin') || lower.includes('macos') || lower.includes('osx')) osMatches.push('macos');
  if (lower.includes('android')) osMatches.push('android');

  const versionMatches = [];
  const vRegex = /\b(?:v|version\s+)([0-9]+(?:\.[0-9]+)?)/gi;
  let m;
  while ((m = vRegex.exec(lower)) !== null) {
    versionMatches.push(m[1]);
  }

  const archMatches = [];
  if (lower.includes('x86_64') || lower.includes('x64') || lower.includes('amd64')) archMatches.push('x86_64');
  if (lower.includes('arm64') || lower.includes('aarch64')) archMatches.push('arm64');

  return {
    os: osMatches,
    versions: versionMatches,
    architectures: archMatches,
    isQualified: osMatches.length > 0 || versionMatches.length > 0 || archMatches.length > 0
  };
}

/**
 * Evaluates whether two claims contradict each other or coexist contextually.
 *
 * @param {object|string} claimA - First claim object or string
 * @param {object|string} claimB - Second claim object or string
 * @param {object} options - Options
 * @returns {object} Contradiction assessment
 */
export function assessContextualContradiction(claimA, claimB, options = {}) {
  const textA = typeof claimA === 'string' ? claimA : (claimA.rule || claimA.statement || claimA.text || '');
  const negA = typeof claimA === 'object' ? (claimA.negative_constraint || '') : '';
  const textB = typeof claimB === 'string' ? claimB : (claimB.rule || claimB.statement || claimB.text || '');
  const negB = typeof claimB === 'object' ? (claimB.negative_constraint || '') : '';

  const ctxA = extractContextBoundaries(`${textA} ${negA}`);
  const ctxB = extractContextBoundaries(`${textB} ${negB}`);

  // Check OS context divergence
  if (ctxA.os.length > 0 && ctxB.os.length > 0) {
    const osIntersection = ctxA.os.filter(os => ctxB.os.includes(os));
    if (osIntersection.length === 0) {
      return {
        conflict: false,
        conflict_type: 'DIFFERENT_CONTEXT_OR_VERSION',
        reason: `Claims apply to disjoint Operating Systems: [${ctxA.os.join(',')}] vs [${ctxB.os.join(',')}]`
      };
    }
  }

  // Check Version context divergence
  if (ctxA.versions.length > 0 && ctxB.versions.length > 0) {
    const verIntersection = ctxA.versions.filter(v => ctxB.versions.includes(v));
    if (verIntersection.length === 0) {
      return {
        conflict: false,
        conflict_type: 'DIFFERENT_CONTEXT_OR_VERSION',
        reason: `Claims apply to disjoint versions: [${ctxA.versions.join(',')}] vs [${ctxB.versions.join(',')}]`
      };
    }
  }

  // Check Directive Opposition using the deterministic heuristic
  const oppositionRes = detectDirectiveOpposition(textA, negA, {
    title: textB,
    summary: textB,
    ruleText: textB,
    fullContent: `${textB} ${negB}`,
    rule_number: typeof claimB === 'object' ? claimB.rule_number : 'B'
  });

  if (oppositionRes.opposed) {
    return {
      conflict: true,
      conflict_type: 'CONFIRMED_DIRECT_CONFLICT',
      reason: oppositionRes.reason
    };
  }

  // Also check reverse opposition
  const revOpposition = detectDirectiveOpposition(textB, negB, {
    title: textA,
    summary: textA,
    ruleText: textA,
    fullContent: `${textA} ${negA}`,
    rule_number: typeof claimA === 'object' ? claimA.rule_number : 'A'
  });

  if (revOpposition.opposed) {
    return {
      conflict: true,
      conflict_type: 'CONFIRMED_DIRECT_CONFLICT',
      reason: revOpposition.reason
    };
  }

  return {
    conflict: false,
    conflict_type: 'COMPATIBLE_EVIDENCE',
    reason: 'No directive opposition or contextual divergence detected'
  };
}

// -------------------------------------------------------------------------
// 6. Evidence-Based Verification Decision Engine
// -------------------------------------------------------------------------

/**
 * Synthesizes evidence, corroboration, and contradiction checks into a conclusive decision.
 *
 * @param {object} claim - Claim object with id and statement
 * @param {Array<object>} evidenceList - List of evidence records
 * @param {object} options - Options including canonicalRules and maxAgeMs
 * @returns {object} Conclusive verification decision
 */
export function evaluateEvidenceDecision(claim = {}, evidenceList = [], options = {}) {
  const claimId = claim.id || claim.claim_id || 'UNKNOWN_CLAIM';
  const claimText = claim.rule || claim.statement || claim.claim || '';
  const negConstraint = claim.negative_constraint || '';

  // 1. Check for Insufficient Evidence
  if (!evidenceList || evidenceList.length === 0) {
    return {
      claim_id: claimId,
      decision: EVIDENCE_DECISION.INSUFFICIENT_EVIDENCE,
      quality_tier: EVIDENCE_STATUS.UNVERIFIED,
      corroboration_summary: null,
      contradiction_assessment: null,
      limitations: ['Zero evidence records provided'],
      can_promote_to_canonical: false,
      reason: 'No evidence records available to substantiate the claim'
    };
  }

  // 2. Filter Adversarial and Invalid Records
  const validRecords = [];
  let hasAdversarial = false;
  let adversarialReason = null;

  for (const rec of evidenceList) {
    const val = validateEvidenceRecord(rec);
    if (!val.valid) {
      if (rec.is_adversarial) {
        hasAdversarial = true;
        adversarialReason = rec.rejection_reason;
      }
      continue;
    }
    validRecords.push(rec);
  }

  if (hasAdversarial) {
    return {
      claim_id: claimId,
      decision: EVIDENCE_DECISION.REJECTED,
      quality_tier: EVIDENCE_STATUS.REJECTED,
      corroboration_summary: null,
      contradiction_assessment: null,
      limitations: ['Adversarial prompt injection detected in supporting evidence'],
      can_promote_to_canonical: false,
      reason: adversarialReason || 'Adversarial content rejected fail-closed'
    };
  }

  if (validRecords.length === 0) {
    return {
      claim_id: claimId,
      decision: EVIDENCE_DECISION.INSUFFICIENT_EVIDENCE,
      quality_tier: EVIDENCE_STATUS.UNVERIFIED,
      corroboration_summary: null,
      contradiction_assessment: null,
      limitations: ['All evidence records failed validation checks'],
      can_promote_to_canonical: false,
      reason: 'All submitted evidence records were invalid or rejected'
    };
  }

  // 3. Staleness Check
  const maxAgeMs = options.maxAgeMs || (365 * 24 * 60 * 60 * 1000); // 1 year default
  const now = Date.now();
  const allStale = validRecords.every(r => {
    if (r.is_stale) return true;
    const observedTime = new Date(r.observed_at).getTime();
    return !isNaN(observedTime) && (now - observedTime > maxAgeMs) && Boolean(options.enforceStaleness);
  });

  if (allStale) {
    return {
      claim_id: claimId,
      decision: EVIDENCE_DECISION.STALE,
      quality_tier: EVIDENCE_STATUS.STALE,
      corroboration_summary: null,
      contradiction_assessment: null,
      limitations: ['All supporting evidence exceeds staleness threshold'],
      can_promote_to_canonical: false,
      reason: 'Evidence is stale or refers to superseded versions'
    };
  }

  // 4. Contradiction Assessment against Canonical Rules
  let contradictionAssessment = { conflict: false, conflict_type: 'COMPATIBLE_EVIDENCE' };
  const canonicalRules = options.canonicalRules || [];

  for (const canRule of canonicalRules) {
    const contra = assessContextualContradiction(
      { rule: claimText, negative_constraint: negConstraint },
      canRule
    );
    if (contra.conflict && contra.conflict_type === 'CONFIRMED_DIRECT_CONFLICT') {
      contradictionAssessment = contra;
      return {
        claim_id: claimId,
        decision: EVIDENCE_DECISION.CONFLICTING,
        quality_tier: EVIDENCE_STATUS.CONFLICTING,
        corroboration_summary: null,
        contradiction_assessment: contra,
        limitations: [contra.reason],
        can_promote_to_canonical: false,
        reason: `Direct conflict with canonical Rule: ${contra.reason}`
      };
    }
  }

  // 5. Corroboration Assessment
  const corroboration = evaluateEvidenceCorroboration(claimId, validRecords, options);

  // 6. Direct Verification Check (Empirical Test Execution)
  const directlyVerifiedRec = validRecords.find(r =>
    r.evidence_type === EVIDENCE_TYPES.REPRODUCIBLE_TEST &&
    r.verification_method === VERIFICATION_METHODS.EMPIRICAL_TEST &&
    r.verification_status === EVIDENCE_STATUS.DIRECTLY_VERIFIED
  );

  if (directlyVerifiedRec) {
    return {
      claim_id: claimId,
      decision: EVIDENCE_DECISION.SUPPORTED,
      quality_tier: EVIDENCE_STATUS.DIRECTLY_VERIFIED,
      corroboration_summary: corroboration,
      contradiction_assessment: contradictionAssessment,
      limitations: directlyVerifiedRec.limitations ? [directlyVerifiedRec.limitations] : [],
      can_promote_to_canonical: true,
      reason: 'Claim directly substantiated by reproducible empirical test trace'
    };
  }

  // 7. Multi-Source Independent Corroboration Check
  if (corroboration.is_corroborated) {
    return {
      claim_id: claimId,
      decision: EVIDENCE_DECISION.SUPPORTED,
      quality_tier: EVIDENCE_STATUS.INDEPENDENTLY_CORROBORATED,
      corroboration_summary: corroboration,
      contradiction_assessment: contradictionAssessment,
      limitations: [],
      can_promote_to_canonical: true,
      reason: `Claim independently corroborated by ${corroboration.effective_sources} distinct sources`
    };
  }

  // 8. Single Source Primary vs Secondary Evaluation
  const primaryRecord = validRecords.find(r =>
    r.evidence_type === EVIDENCE_TYPES.OFFICIAL_DOCS ||
    r.evidence_type === EVIDENCE_TYPES.CODE_IMPLEMENTATION
  );

  if (primaryRecord && (corroboration.effective_sources === 1 || corroboration.independence_tier === INDEPENDENCE_TIERS.SAME_ENTITY)) {
    // If from trusted ecosystem or official repo
    const isTier2 = primaryRecord.source_id.includes('official') || primaryRecord.source_id.includes('microsoft') || primaryRecord.source_id.includes('google');
    const qualityTier = isTier2 ? EVIDENCE_STATUS.PRIMARY_SOURCE_SUPPORTED : EVIDENCE_STATUS.SINGLE_SOURCE_SUPPORTED;

    return {
      claim_id: claimId,
      decision: EVIDENCE_DECISION.SUPPORTED,
      quality_tier: qualityTier,
      corroboration_summary: corroboration,
      contradiction_assessment: contradictionAssessment,
      limitations: corroboration.independence_tier === INDEPENDENCE_TIERS.COPIED_OR_MIRRORED
        ? ['Evidence consists of mirrored or copied sources; effective independent sources is 1']
        : ['Single source supported; awaiting independent corroboration'],
      can_promote_to_canonical: qualityTier === EVIDENCE_STATUS.PRIMARY_SOURCE_SUPPORTED,
      reason: `Claim supported by ${qualityTier}`
    };
  }

  // 9. Secondary or Inferred Evidence
  const inferredRecord = validRecords.find(r => r.evidence_status === EVIDENCE_STATUS.INFERRED);
  const secondaryRecord = validRecords.find(r => r.evidence_type === EVIDENCE_TYPES.SECONDARY_ARTICLE);

  const fallbackTier = inferredRecord ? EVIDENCE_STATUS.INFERRED : EVIDENCE_STATUS.SINGLE_SOURCE_SUPPORTED;

  return {
    claim_id: claimId,
    decision: EVIDENCE_DECISION.PARTIALLY_SUPPORTED,
    quality_tier: fallbackTier,
    corroboration_summary: corroboration,
    contradiction_assessment: contradictionAssessment,
    limitations: ['Evidence is secondary or inferred; not eligible for canonical promotion'],
    can_promote_to_canonical: false,
    reason: `Claim is only partially supported (${fallbackTier})`
  };
}

// -------------------------------------------------------------------------
// 7. Durable Evidence Ledger Persistence & Read-Back Verification
// -------------------------------------------------------------------------

/**
 * Resolves the path to the evidence ledger.
 */
export function getEvidenceLedgerPath(options = {}) {
  const root = options.brainRoot || BRAIN_ROOT;
  return path.join(root, '08_VERIFICATION', 'evidence-ledger.json');
}

/**
 * Loads the existing evidence ledger from disk safely.
 */
export function loadEvidenceLedger(options = {}) {
  const ledgerPath = getEvidenceLedgerPath(options);
  if (!fs.existsSync(ledgerPath)) {
    return {
      version: '1.0.0',
      evidence: {},
      updated_at: new Date().toISOString()
    };
  }

  try {
    const raw = fs.readFileSync(ledgerPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`LEDGER_PARSE_FAILURE: Failed to parse evidence ledger at ${ledgerPath}: ${err.message}`);
  }
}

/**
 * Persists an Evidence Record to durable storage with atomic write,
 * SHA-256 read-back verification, and rollback on failure.
 *
 * @param {object} record - Validated evidence record
 * @param {object} options - Options including brainRoot, simulation flags, expectedClaimId
 * @returns {object} { persisted: boolean, duplicate: boolean, evidence_id: string, read_back_verified: boolean }
 */
export function persistEvidenceRecord(record, options = {}) {
  const validation = validateEvidenceRecord(record);
  if (!validation.valid) {
    throw new Error(`INVALID_EVIDENCE_RECORD: ${validation.errors.join(', ')}`);
  }

  // Linkage verification
  if (options.expectedClaimId && options.expectedClaimId !== record.claim_id) {
    throw new Error(`LINKAGE_MISMATCH: Record claim_id "${record.claim_id}" does not match expected claim_id "${options.expectedClaimId}"`);
  }

  const ledgerPath = getEvidenceLedgerPath(options);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });

  const existingLedger = loadEvidenceLedger(options);
  const previousRaw = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, 'utf-8') : null;

  // Idempotency check: same ID and identical content hash
  if (existingLedger.evidence[record.evidence_id]) {
    const existing = existingLedger.evidence[record.evidence_id];
    if (existing.content_hash === record.content_hash) {
      return {
        persisted: true,
        duplicate: true,
        evidence_id: record.evidence_id,
        read_back_verified: true
      };
    }
  }

  // Injected simulation failure for testing rollback safety
  if (options.simulatePersistenceFailure === true) {
    throw new Error('SIMULATED_PERSISTENCE_FAILURE: Injected persistence write barrier failure');
  }

  // Update ledger in memory
  existingLedger.evidence[record.evidence_id] = record;
  existingLedger.updated_at = new Date().toISOString();

  const payload = JSON.stringify(existingLedger, null, 2);
  const tmpPath = `${ledgerPath}.tmp`;

  try {
    // Atomic write via temporary file
    fs.writeFileSync(tmpPath, payload, 'utf-8');
    fs.renameSync(tmpPath, ledgerPath);
  } catch (err) {
    // Clean up temporary file
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    throw new Error(`PERSISTENCE_WRITE_FAILED: ${err.message}`);
  }

  // Read-back verification
  try {
    if (options.simulateReadBackFailure === true) {
      throw new Error('SIMULATED_READBACK_FAILURE: Injected read-back verification failure');
    }

    const readBackRaw = fs.readFileSync(ledgerPath, 'utf-8');
    const readBackLedger = JSON.parse(readBackRaw);
    const readBackRecord = readBackLedger.evidence[record.evidence_id];

    if (!readBackRecord) {
      throw new Error(`Read-back record ${record.evidence_id} missing in persisted ledger`);
    }

    if (readBackRecord.content_hash !== record.content_hash) {
      throw new Error(`Read-back content hash mismatch: expected ${record.content_hash}, found ${readBackRecord.content_hash}`);
    }
  } catch (readBackErr) {
    // Rollback to prior state
    if (previousRaw !== null) {
      fs.writeFileSync(ledgerPath, previousRaw, 'utf-8');
    } else if (fs.existsSync(ledgerPath)) {
      fs.unlinkSync(ledgerPath);
    }
    throw new Error(`READ_BACK_VERIFICATION_FAILED: ${readBackErr.message}`);
  }

  return {
    persisted: true,
    duplicate: false,
    evidence_id: record.evidence_id,
    read_back_verified: true
  };
}

/**
 * Persists a batch of evidence records atomically with rollback on any failure.
 */
export function persistEvidenceBatch(records = [], options = {}) {
  const ledgerPath = getEvidenceLedgerPath(options);
  const previousRaw = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, 'utf-8') : null;
  const persistedIds = [];

  try {
    for (const rec of records) {
      const res = persistEvidenceRecord(rec, options);
      persistedIds.push(res.evidence_id);
    }
    return {
      persisted_count: persistedIds.length,
      evidence_ids: persistedIds,
      all_verified: true
    };
  } catch (err) {
    // Rollback entire batch
    if (previousRaw !== null) {
      fs.writeFileSync(ledgerPath, previousRaw, 'utf-8');
    }
    throw new Error(`BATCH_PERSISTENCE_FAILED: Rolled back batch due to error: ${err.message}`);
  }
}

/**
 * Read-back verifies a persisted evidence record directly on disk.
 */
export function readBackVerifyEvidence(evidenceId, expectedHash, options = {}) {
  const ledgerPath = getEvidenceLedgerPath(options);
  if (!fs.existsSync(ledgerPath)) {
    return { verified: false, error: 'Ledger file does not exist' };
  }

  try {
    const raw = fs.readFileSync(ledgerPath, 'utf-8');
    const ledger = JSON.parse(raw);
    const rec = ledger.evidence[evidenceId];
    if (!rec) {
      return { verified: false, error: `Evidence ID ${evidenceId} not found in ledger` };
    }
    if (expectedHash && rec.content_hash !== expectedHash) {
      return { verified: false, error: `Content hash mismatch: expected ${expectedHash}, found ${rec.content_hash}` };
    }
    return { verified: true, record: rec };
  } catch (err) {
    return { verified: false, error: err.message };
  }
}

/**
 * Retrieves a single evidence record by ID.
 */
export function getEvidenceRecord(evidenceId, options = {}) {
  const ledger = loadEvidenceLedger(options);
  return ledger.evidence[evidenceId] || null;
}

/**
 * Lists all evidence records linked to a specific claim.
 */
export function listEvidenceForClaim(claimId, options = {}) {
  const ledger = loadEvidenceLedger(options);
  return Object.values(ledger.evidence).filter(e => e.claim_id === claimId);
}

// -------------------------------------------------------------------------
// 8. Lifecycle Integration & Canonical Promotion Gating
// -------------------------------------------------------------------------

/**
 * Evaluates whether a candidate rule is qualified for canonical promotion based on
 * evidence quality tiers, corroboration, and absence of contradiction.
 *
 * @param {object} candidate - Candidate rule object
 * @param {Array<object>} evidenceList - Associated evidence records
 * @param {object} options - Options
 * @returns {object} Canonical promotion gating evaluation
 */
export function evaluateCandidateForCanonicalPromotion(candidate = {}, evidenceList = [], options = {}) {
  const decision = evaluateEvidenceDecision(candidate, evidenceList, options);

  const canPromote = Boolean(decision.can_promote_to_canonical);

  return {
    allowed: canPromote,
    candidate_id: candidate.candidate_id || candidate.id || 'UNKNOWN',
    decision: decision.decision,
    quality_tier: decision.quality_tier,
    corroboration: decision.corroboration_summary,
    contradiction: decision.contradiction_assessment,
    reason: canPromote
      ? `Permitted: Evidence quality tier (${decision.quality_tier}) satisfies canonical promotion gating`
      : `Blocked: ${decision.reason || 'Evidence insufficient or conflicting'}`
  };
}

