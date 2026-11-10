/**
 * UNIVERSAL KNOWLEDGE EVOLUTION BRIDGE:
 * VALIDATED PROJECT LEARNING -> MASTER BRAIN PROMOTION
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\project-learning-promotion-bridge.mjs
 * Purpose: Bridges the crucial gap between child project empirical learnings
 *          (incidents, bug autopsies, performance patterns) and Master Brain canonical
 *          domain intelligence without contaminating canonical knowledge with local noise.
 * 
 * Key Invariants:
 * 1. AI THINKS. BRAIN STORES AND SUPPLIES INTELLIGENCE DATA. TOOLS EXECUTE. PRODUCTS CREATE OUTCOMES.
 * 2. Five-Stage Knowledge Lifecycle: EXTRACTED -> CANDIDATE -> VALIDATED -> CANONICAL (or CONFLICTED/REJECTED).
 * 3. 4-Pillar Validation Semantics: Execution Verification != Universal Validity.
 *    (Execution Verification, Claim Validation, Cross-Context Applicability, Canonical Promotion Approval).
 * 4. Separation of Project-Specific Facts from Universal Invariants.
 * 5. Zero Duplication & Contradiction Quarantine.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  INTELLIGENCE_DOMAINS,
  resolveDomain,
  classifyIntelligenceDomain,
  createDomainIntelligenceRecord,
  persistDomainIntelligenceRecord,
  loadDomainRegistry,
  getDomainStoragePaths
} from './domain-intelligence-engine.mjs';

import {
  HIGH_IMPACT_DOMAINS,
  verifyHumanApprovalToken
} from './human-approval-authority.mjs';

import { searchBrain } from './retrieval-engine.mjs';
import { detectDirectiveOpposition } from './knowledge-acquisition-pipeline.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const VERIFICATION_MATRIX_FILE = path.join(BRAIN_ROOT, '08_VERIFICATION', 'harvest-verification-matrix.md');
const PROVENANCE_LEDGER_FILE = path.join(BRAIN_ROOT, '09_SOURCES', 'harvest-provenance-ledger.md');

// ---------------------------------------------------------------------------
// 1. Five-Stage Knowledge Lifecycle & Validation Pillars
// ---------------------------------------------------------------------------

export const KNOWLEDGE_STAGE = Object.freeze({
  EXTRACTED: 'EXTRACTED',                       // Discovered in project learning, unvalidated
  CANDIDATE: 'CANDIDATE',                       // Classified across 13 domains with metadata
  VALIDATED: 'VALIDATED',                       // All 4 validation pillars passed
  PROJECT_LOCAL_ONLY: 'PROJECT_LOCAL_ONLY',     // Execution passed, but project-specific (not canonical)
  REJECTED_UNSOUND: 'REJECTED_UNSOUND',         // Fails claim validation or causality
  REJECTED_UNVERIFIED: 'REJECTED_UNVERIFIED',   // Failed execution verification
  STAGED_FOR_HUMAN_REVIEW: 'STAGED_FOR_HUMAN_REVIEW', // High-impact domain requires human review
  CONFLICTED: 'CONFLICTED',                     // Contradicts an existing rule (quarantined)
  CANONICAL: 'CANONICAL',                       // Formally promoted to Master Brain Domain Registry
  DUPLICATE_SKIPPED: 'DUPLICATE_SKIPPED'        // Existing hash detected, safely skipped
});

export const VALIDATION_PILLARS = Object.freeze({
  EXECUTION_VERIFICATION: 'EXECUTION_VERIFICATION',
  CLAIM_VALIDATION: 'CLAIM_VALIDATION',
  CROSS_CONTEXT_APPLICABILITY: 'CROSS_CONTEXT_APPLICABILITY',
  CANONICAL_PROMOTION_APPROVAL: 'CANONICAL_PROMOTION_APPROVAL'
});

// ---------------------------------------------------------------------------
// 2. Candidate Discovery & Extraction from Project Learning
// ---------------------------------------------------------------------------

/**
 * Discovers and extracts candidate learnings from project learning text, file, or object.
 */
export function discoverProjectLearningCandidates(sourceInput, options = {}) {
  let content = '';
  let sourcePath = 'inline-object';
  let projectName = options.projectName || 'unspecified-project';

  if (typeof sourceInput === 'string') {
    if (fs.existsSync(sourceInput)) {
      sourcePath = path.resolve(sourceInput);
      content = fs.readFileSync(sourcePath, 'utf-8');
      projectName = options.projectName || path.basename(sourcePath, '-learnings.md').replace(/\.md$/, '');
    } else {
      content = sourceInput;
    }
  } else if (typeof sourceInput === 'object' && sourceInput !== null) {
    // Structured single candidate object
    return [
      normalizeStructuredCandidate(sourceInput, options)
    ];
  }

  const candidates = [];
  const lines = content.split(/\r?\n/);

  // Pattern A: Table rows | Date | Source | Category | Lesson / Pattern | Invariant Rule |
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && !trimmed.includes('---') && !trimmed.toLowerCase().includes('| date |')) {
      const parts = trimmed.split('|').map(p => p.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (parts.length >= 4) {
        const date = parts[0] || new Date().toISOString().split('T')[0];
        const source = parts[1] || projectName;
        const category = parts[2] || 'Engineering Pattern';
        const lesson = parts[3] || '';
        const invariant = parts[4] || lesson;

        if (lesson.length > 20) {
          const candidateId = `PLCAND-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
          candidates.push({
            candidate_id: candidateId,
            stage: KNOWLEDGE_STAGE.EXTRACTED,
            project_name: projectName,
            source_file: sourcePath,
            observed_at: date,
            title: `${category}: ${invariant.slice(0, 80).replace(/[^\w\s-]/g, '')}`,
            problem_statement: lesson,
            universal_invariant: invariant,
            project_specific_facts: `Harvested from ${source} on ${date}.`,
            negative_constraint: options.negative_constraint || 'Never apply unverified workarounds.',
            raw_text: trimmed
          });
        }
      }
    }
  }

  // Pattern B: Forensic Dossier Incidents (e.g. colinhacks-zod-learnings.md)
  if (candidates.length === 0 && (content.includes('### Incident') || content.includes('BUG-'))) {
    const incidentRegex = /###\s+(?:Incident\s*\d*:\s*|BUG-[A-Z0-9-]+:\s*)([^\n]+)\n([\s\S]*?)(?=\n###|\n##\s|\n---\n|$)/gi;
    let incMatch;
    while ((incMatch = incidentRegex.exec(content)) !== null) {
      const incTitle = incMatch[1].trim();
      const incBody = incMatch[2];

      const lessonMatch = incBody.match(/- \*\*Lesson\*\*:\s*([^\n]+(?:\n(?!\s*-\s*\*)[^\n]+)*)/i);
      const rootCauseMatch = incBody.match(/- \*\*Root Cause\*\*:\s*([^\n]+(?:\n(?!\s*-\s*\*)[^\n]+)*)/i);
      const evidenceMatch = incBody.match(/- \*\*Evidence in Repo\*\*:\s*([^\n]+)/i);
      const contextMatch = incBody.match(/- \*\*Context\*\*:\s*([^\n]+)/i);

      if (lessonMatch && lessonMatch[1].trim().length > 20) {
        const candidateId = `PLCAND-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        candidates.push({
          candidate_id: candidateId,
          stage: KNOWLEDGE_STAGE.EXTRACTED,
          project_name: projectName,
          source_file: sourcePath,
          observed_at: new Date().toISOString(),
          title: incTitle,
          problem_statement: rootCauseMatch ? rootCauseMatch[1].trim() : (contextMatch ? contextMatch[1].trim() : incTitle),
          universal_invariant: lessonMatch[1].trim(),
          project_specific_facts: `${contextMatch ? contextMatch[1].trim() + '. ' : ''}${evidenceMatch ? 'Evidence: ' + evidenceMatch[1].trim() : ''}`.trim(),
          evidence_reference: evidenceMatch ? evidenceMatch[1].trim() : null,
          negative_constraint: options.negative_constraint || 'Avoid identified anti-pattern',
          raw_text: incBody.slice(0, 500)
        });
      }
    }
  }

  // Pattern C: Core Architectural Mechanisms (e.g. 11ty-eleventy-learnings.md)
  if (candidates.length === 0 && content.includes('## 2. Core Architectural Mechanisms')) {
    const parts = content.split('## 2. Core Architectural Mechanisms');
    if (parts.length > 1) {
      const mechSection = parts[1].split(/\n##\s/)[0];
      const mechRegex = /\d+\.\s+\*\*([^*]+)\*\*:\s*\n((?:\s+-\s+[^\n]+\n*)+)/g;
      let mMatch;
      while ((mMatch = mechRegex.exec(mechSection)) !== null) {
        const mechTitle = mMatch[1].trim();
        const mechBody = mMatch[2].replace(/^\s+-\s+/gm, '').trim();
        if (mechBody.length > 25) {
          const candidateId = `PLCAND-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
          candidates.push({
            candidate_id: candidateId,
            stage: KNOWLEDGE_STAGE.EXTRACTED,
            project_name: projectName,
            source_file: sourcePath,
            observed_at: new Date().toISOString(),
            title: mechTitle,
            problem_statement: `Architectural design pattern from ${projectName}`,
            universal_invariant: mechBody,
            project_specific_facts: `Derived from ${projectName} core architectural mechanisms.`,
            negative_constraint: 'Avoid non-standard architectural bloat.',
            raw_text: mechBody
          });
        }
      }
    }
  }

  // Pattern D: Generic Incident Dossier / Incident section
  if (candidates.length === 0 && content.includes('#')) {
    const titleMatch = content.match(/#\s+(.+)/);
    const rootCauseMatch = content.match(/##\s+.*?Root Cause.*?\n([\s\S]*?)(?=\n##|$)/i);
    const invariantMatch = content.match(/##\s+.*?Invariant.*?\n([\s\S]*?)(?=\n##|$)/i) || content.match(/##\s+.*?Lesson.*?\n([\s\S]*?)(?=\n##|$)/i);

    const title = titleMatch ? titleMatch[1].trim() : 'Project Incident Learning';
    const problem = rootCauseMatch ? rootCauseMatch[1].trim() : content.slice(0, 300);
    const invariant = invariantMatch ? invariantMatch[1].trim() : problem;

    const candidateId = `PLCAND-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    candidates.push({
      candidate_id: candidateId,
      stage: KNOWLEDGE_STAGE.EXTRACTED,
      project_name: projectName,
      source_file: sourcePath,
      observed_at: new Date().toISOString(),
      title,
      problem_statement: problem,
      universal_invariant: invariant,
      project_specific_facts: `Extracted from dossier ${path.basename(sourcePath)}.`,
      negative_constraint: options.negative_constraint || 'Do not repeat identified defect.',
      raw_text: content.slice(0, 500)
    });
  }

  return candidates;
}

function normalizeStructuredCandidate(obj, options = {}) {
  const candidateId = obj.candidate_id || `PLCAND-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  return {
    candidate_id: candidateId,
    stage: KNOWLEDGE_STAGE.EXTRACTED,
    project_name: obj.project_name || options.projectName || 'active-project',
    source_file: obj.source_file || 'project://learning',
    source_version: obj.source_version || '1.0.0',
    observed_at: obj.observed_at || new Date().toISOString(),
    title: String(obj.title || 'Untitled Project Learning').trim(),
    problem_statement: String(obj.problem_statement || obj.problem || '').trim(),
    universal_invariant: String(obj.universal_invariant || obj.invariant || obj.lesson || '').trim(),
    project_specific_facts: String(obj.project_specific_facts || obj.project_facts || '').trim(),
    negative_constraint: String(obj.negative_constraint || 'Avoid identified anti-pattern').trim(),
    forcedDomain: obj.forcedDomain || null
  };
}

// ---------------------------------------------------------------------------
// 3. 13-Domain Classification & Metadata Attachment
// ---------------------------------------------------------------------------

/**
 * Classifies candidate into the 13 canonical domains and attaches domain metadata.
 */
export function classifyProjectLearningCandidate(candidate, options = {}) {
  const classificationText = `${candidate.title} ${candidate.universal_invariant} ${candidate.problem_statement}`;
  const classification = classifyIntelligenceDomain(classificationText, {
    title: candidate.title,
    category: candidate.category || 'PROJECT_LEARNING',
    filePath: candidate.source_file
  });

  const forced = candidate.forcedDomain || options.forcedDomain;
  const primaryDomain = forced ? (resolveDomain(forced) || classification.primaryDomain) : classification.primaryDomain;

  return {
    ...candidate,
    stage: KNOWLEDGE_STAGE.CANDIDATE,
    primary_domain: primaryDomain,
    secondary_domains: classification.secondaryDomains,
    classification_confidence: classification.confidence
  };
}

// ---------------------------------------------------------------------------
// 4. Strict 4-Pillar Validation Barrier (Anti-Hallucination & Generalization Gate)
// ---------------------------------------------------------------------------

/**
 * Evaluates whether a candidate meets strict 4-pillar empirical validation criteria:
 * Pillar 1: Execution Verification (did code/test execute cleanly?)
 * Pillar 2: Knowledge Claim Validation (is the claim substantive and causally sound?)
 * Pillar 3: Cross-Context Applicability (is it generalizable beyond this single project?)
 * Pillar 4: Canonical Promotion Approval (is it approved for universal canonical storage?)
 */
export function validateProjectLearningCandidate(candidate, verificationProof = {}, options = {}) {
  const failures = [];
  const pillars = {
    [VALIDATION_PILLARS.EXECUTION_VERIFICATION]: { passed: false, details: '' },
    [VALIDATION_PILLARS.CLAIM_VALIDATION]: { passed: false, details: '' },
    [VALIDATION_PILLARS.CROSS_CONTEXT_APPLICABILITY]: { passed: false, details: '' },
    [VALIDATION_PILLARS.CANONICAL_PROMOTION_APPROVAL]: { passed: false, details: '' }
  };

  // -------------------------------------------------------------------------
  // Pillar 1: Execution Verification
  // -------------------------------------------------------------------------
  const isVerified = verificationProof && (verificationProof.verified === true || verificationProof.execution_verification?.passed === true);
  const exitCode = verificationProof.exit_code ?? verificationProof.execution_verification?.exit_code;
  const isExitZero = exitCode === undefined || exitCode === 0;

  if (!isVerified) {
    failures.push('MISSING_EMPIRICAL_PROOF: Candidate must have verified empirical evidence (verificationProof.verified === true).');
    pillars[VALIDATION_PILLARS.EXECUTION_VERIFICATION] = {
      passed: false,
      details: 'Missing empirical verification confirmation or proof'
    };
  } else if (!isExitZero) {
    failures.push(`FAILED_TEST_EXECUTION: Verification process exited with non-zero code (${exitCode}).`);
    pillars[VALIDATION_PILLARS.EXECUTION_VERIFICATION] = {
      passed: false,
      details: `Execution failed with exit code ${exitCode}`
    };
  } else {
    pillars[VALIDATION_PILLARS.EXECUTION_VERIFICATION] = {
      passed: true,
      details: `Execution verified with exit code 0 (${verificationProof.test_suite || 'verified_execution'})`
    };
  }

  // -------------------------------------------------------------------------
  // Pillar 2: Knowledge Claim Validation
  // -------------------------------------------------------------------------
  const invariant = String(candidate.universal_invariant || '').trim();
  let claimSound = true;
  let claimReason = 'Claim is substantive and contains causal problem-solution structure';

  if (invariant.length < 25) {
    claimSound = false;
    claimReason = 'INSUFFICIENT_SUBSTANCE: Universal invariant must be at least 25 characters long.';
    failures.push(claimReason);
  } else if (/\b(might work|probably fixes|untested idea|unconfirmed hypothesis|could potentially)\b/i.test(invariant)) {
    claimSound = false;
    claimReason = 'SPECULATIVE_CLAIM: Invariant contains speculative or ungrounded phrasing.';
    failures.push(claimReason);
  } else if (verificationProof.claim_validation && verificationProof.claim_validation.logically_sound === false) {
    claimSound = false;
    claimReason = verificationProof.claim_validation.reason || 'Claim validation explicitly evaluated as logically unsound.';
    failures.push(claimReason);
  }

  pillars[VALIDATION_PILLARS.CLAIM_VALIDATION] = {
    passed: claimSound,
    details: claimReason
  };

  // -------------------------------------------------------------------------
  // Pillar 3: Cross-Context Applicability
  // -------------------------------------------------------------------------
  let crossContextApplicable = true;
  let crossContextReason = 'Invariant is decoupled from local workstation and project specifics';

  const workstationPathRegex = /(?:[A-Za-z]:\\[Users|admin|Users\\]|\/home\/|\/Users\/)/i;
  if (workstationPathRegex.test(invariant)) {
    crossContextApplicable = false;
    crossContextReason = 'WORKSTATION_PATH_LEAK: Universal invariant contains hardcoded local workstation path. Invariant must be generic and portable.';
    failures.push(crossContextReason);
  } else if (/localhost:\d{4,5}/i.test(invariant)) {
    crossContextApplicable = false;
    crossContextReason = 'LOCAL_PORT_LEAK: Universal invariant contains hardcoded localhost port.';
    failures.push(crossContextReason);
  } else if (verificationProof.cross_context_applicability && verificationProof.cross_context_applicability.is_generalizable === false) {
    crossContextApplicable = false;
    crossContextReason = verificationProof.cross_context_applicability.reason || 'Candidate is a single-project workaround, not universally generalizable.';
    failures.push(crossContextReason);
  }

  pillars[VALIDATION_PILLARS.CROSS_CONTEXT_APPLICABILITY] = {
    passed: crossContextApplicable,
    details: crossContextReason
  };

  // -------------------------------------------------------------------------
  // Pillar 4: Canonical Promotion Approval (Governed by Policy, Not AI Autonomy)
  // -------------------------------------------------------------------------
  let promotionApproved = true;
  let approvalReason = 'Approved for canonical domain intelligence tier under autonomous policy.';
  let requiresHumanReview = false;

  const domainLetter = candidate.primary_domain?.letter || options.forcedDomain;
  const confidence = candidate.classification_confidence ?? 1.0;

  // High-Impact Domains that CANNOT be autonomously approved by an AI-generated field:
  // Domains A (Human Need), G (Architecture & Structural Boundaries), and M (Evolution/Master Brain Invariants)
  const isHighImpact = HIGH_IMPACT_DOMAINS.includes(domainLetter);
  const humanToken = verificationProof.canonical_promotion_approval?.humanApprovalToken ||
                     verificationProof.canonical_promotion_approval?.human_approval_token ||
                     verificationProof.humanApprovalToken ||
                     options.humanApprovalToken;

  if (isHighImpact) {
    if (!humanToken) {
      promotionApproved = false;
      requiresHumanReview = true;
      approvalReason = `HIGH_IMPACT_DOMAIN_STAGED: Domain ${domainLetter} governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.`;
      failures.push(approvalReason);
    } else {
      const tokenVerification = verifyHumanApprovalToken(
        candidate,
        humanToken,
        options.brainRoot || null,
        { ...(options.tokenOptions || {}), consumeNonce: false }
      );
      if (tokenVerification.valid) {
        approvalReason = `Cryptographically authorized by human operator (${tokenVerification.human_operator_id}) at ${tokenVerification.approval_timestamp}`;
      } else {
        promotionApproved = false;
        requiresHumanReview = true;
        approvalReason = `HIGH_IMPACT_AUTH_FAILED: Cryptographic human authorization verification failed (${tokenVerification.code}: ${tokenVerification.reason})`;
        failures.push(approvalReason);
      }
    }
  } else if (confidence < 0.60) {
    promotionApproved = false;
    approvalReason = `LOW_CLASSIFICATION_CONFIDENCE: Classification confidence (${confidence}) is below the required 0.60 threshold.`;
    failures.push(approvalReason);
  } else if (verificationProof.canonical_promotion_approval && verificationProof.canonical_promotion_approval.approved === false) {
    promotionApproved = false;
    approvalReason = verificationProof.canonical_promotion_approval.reason || 'Canonical promotion not approved by review policy.';
    failures.push(approvalReason);
  }

  pillars[VALIDATION_PILLARS.CANONICAL_PROMOTION_APPROVAL] = {
    passed: promotionApproved && pillars[VALIDATION_PILLARS.EXECUTION_VERIFICATION].passed && pillars[VALIDATION_PILLARS.CLAIM_VALIDATION].passed && pillars[VALIDATION_PILLARS.CROSS_CONTEXT_APPLICABILITY].passed,
    details: approvalReason
  };

  // Determine Lifecycle Stage
  let stage = KNOWLEDGE_STAGE.VALIDATED;
  if (!pillars[VALIDATION_PILLARS.EXECUTION_VERIFICATION].passed) {
    stage = KNOWLEDGE_STAGE.REJECTED_UNVERIFIED;
  } else if (!pillars[VALIDATION_PILLARS.CLAIM_VALIDATION].passed) {
    stage = KNOWLEDGE_STAGE.REJECTED_UNSOUND;
  } else if (!pillars[VALIDATION_PILLARS.CROSS_CONTEXT_APPLICABILITY].passed) {
    stage = KNOWLEDGE_STAGE.PROJECT_LOCAL_ONLY;
  } else if (!pillars[VALIDATION_PILLARS.CANONICAL_PROMOTION_APPROVAL].passed) {
    stage = requiresHumanReview ? KNOWLEDGE_STAGE.STAGED_FOR_HUMAN_REVIEW : KNOWLEDGE_STAGE.PROJECT_LOCAL_ONLY;
  }

  const valid = stage === KNOWLEDGE_STAGE.VALIDATED;

  if (!valid) {
    return {
      valid: false,
      stage,
      pillars,
      rejection_reasons: failures,
      candidate
    };
  }

  // Sanitized candidate ready for promotion
  const sanitizedCandidate = {
    ...candidate,
    stage: KNOWLEDGE_STAGE.VALIDATED,
    universal_invariant: invariant,
    pillars,
    verification_evidence: {
      evidence_type: verificationProof.evidence_type || 'EMPIRICAL_TEST_PASS',
      verification_status: 'DIRECTLY_VERIFIED',
      test_suite: verificationProof.test_suite || 'automated-regression-suite',
      exit_code: exitCode ?? 0,
      timestamp: verificationProof.timestamp || new Date().toISOString(),
      pillars
    }
  };

  return {
    valid: true,
    stage: KNOWLEDGE_STAGE.VALIDATED,
    pillars,
    sanitizedCandidate
  };
}

// ---------------------------------------------------------------------------
// 5. Duplicate Detection & Contradiction Interception
// ---------------------------------------------------------------------------

/**
 * Checks for duplicates against the domain registry and contradiction against existing rules.
 */
export function checkDuplicatesAndConflicts(candidate, customRoot = null, options = {}) {
  const contentHash = crypto.createHash('sha256').update(candidate.universal_invariant).digest('hex');
  const registry = loadDomainRegistry(customRoot);

  // 1. Content Hash Duplicate Check
  for (const record of Object.values(registry.records || {})) {
    if (record.content_hash === contentHash) {
      return {
        isDuplicate: true,
        isConflicted: false,
        stage: KNOWLEDGE_STAGE.DUPLICATE_SKIPPED,
        reason: 'DUPLICATE_CONTENT_HASH',
        existingRecordId: record.record_id
      };
    }
  }

  // 2. Canonical Domain Registry Directive Opposition Check
  for (const record of Object.values(registry.records || {})) {
    const opposition = detectDirectiveOpposition(
      candidate.universal_invariant,
      candidate.negative_constraint,
      record
    );
    if (opposition && opposition.opposed) {
      return {
        isDuplicate: false,
        isConflicted: true,
        stage: KNOWLEDGE_STAGE.CONFLICTED,
        reason: 'DIRECTIVE_OPPOSITION_DETECTED',
        opposingRuleId: record.record_id,
        opposingRuleTitle: record.title,
        oppositionDetails: opposition.reason || 'Opposing directive detected.'
      };
    }
  }

  // 3. Optional Corpus Search Check (Skipped if options.skipSearch is true to prevent V8 heap exhaustion)
  if (!options.skipSearch && !options.skipCorpusSearch) {
    try {
      const searchRes = searchBrain(candidate.title, { brainRoot: customRoot, topK: 3 });
      if (searchRes.results && searchRes.results.length > 0) {
        for (const res of searchRes.results) {
          const opposition = detectDirectiveOpposition(
            candidate.universal_invariant,
            candidate.negative_constraint,
            res
          );
          if (opposition && opposition.opposed) {
            return {
              isDuplicate: false,
              isConflicted: true,
              stage: KNOWLEDGE_STAGE.CONFLICTED,
              reason: 'DIRECTIVE_OPPOSITION_DETECTED',
              opposingRuleId: res.id,
              opposingRuleTitle: res.title,
              oppositionDetails: opposition.reason || 'Opposing directive detected.'
            };
          }
        }
      }
    } catch (err) {
      // Non-fatal search check fallback
    }
  }

  return {
    isDuplicate: false,
    isConflicted: false,
    contentHash
  };
}

// ---------------------------------------------------------------------------
// 6. Controlled Master Brain Promotion Pipeline
// ---------------------------------------------------------------------------

/**
 * Promotes a validated project learning candidate to the Master Brain Domain Registry.
 */
export function promoteProjectLearningToMasterBrain(candidateInput, verificationProof = {}, options = {}) {
  const customRoot = options.brainRoot || BRAIN_ROOT;

  // Step 1: Discover & Normalize
  const rawCandidates = discoverProjectLearningCandidates(candidateInput, options);
  if (rawCandidates.length === 0) {
    return {
      success: false,
      stage: KNOWLEDGE_STAGE.REJECTED_UNVERIFIED,
      reason: 'NO_CANDIDATE_DISCOVERED: Input contained no extractable learning candidate.'
    };
  }

  const candidate = rawCandidates[0];

  // Step 2: Classify across 13 Domains
  const classified = classifyProjectLearningCandidate(candidate, options);

  // Step 3: Strict 4-Pillar Validation Gate
  const validation = validateProjectLearningCandidate(classified, verificationProof, options);
  if (!validation.valid) {
    return {
      success: false,
      candidate_id: candidate.candidate_id,
      stage: validation.stage,
      pillars: validation.pillars,
      rejection_reasons: validation.rejection_reasons
    };
  }

  const validCandidate = validation.sanitizedCandidate;

  // Step 4: Duplicate & Contradiction Barrier
  const dupCheck = checkDuplicatesAndConflicts(validCandidate, customRoot, options);
  if (dupCheck.isDuplicate) {
    return {
      success: false,
      candidate_id: validCandidate.candidate_id,
      stage: KNOWLEDGE_STAGE.DUPLICATE_SKIPPED,
      reason: 'DUPLICATE_SKIPPED',
      existing_record_id: dupCheck.existingRecordId
    };
  }

  if (dupCheck.isConflicted) {
    return {
      success: false,
      candidate_id: validCandidate.candidate_id,
      stage: KNOWLEDGE_STAGE.CONFLICTED,
      reason: dupCheck.reason,
      opposing_rule: dupCheck.opposingRuleId,
      details: dupCheck.oppositionDetails
    };
  }

  // Step 5: Construct Canonical Domain Intelligence Record
  const domainRecord = createDomainIntelligenceRecord({
    title: validCandidate.title,
    content: validCandidate.universal_invariant,
    forcedDomain: validCandidate.primary_domain.letter,
    summary: `${validCandidate.problem_statement.slice(0, 140)} -> ${validCandidate.universal_invariant.slice(0, 140)}`,
    source_uri: `project://${validCandidate.project_name}/${path.basename(validCandidate.source_file)}`,
    source_version: validCandidate.source_version || '1.0.0',
    observed_at: validCandidate.observed_at,
    author_or_entity: `AI-Builder-Brain Project Learning (${validCandidate.project_name})`,
    license: 'Proprietary-Universal',
    evidence_type: validCandidate.verification_evidence.evidence_type,
    verification_status: validCandidate.verification_evidence.verification_status,
    verification_reference: validCandidate.verification_evidence.test_suite,
    blueprints: options.blueprints || ['universal', 'astro-tailwind-v4']
  });

  // Step 6: Atomic Disk Persistence into 05_KNOWLEDGE/domain-intelligence/
  const authContext = {
    humanApprovalToken: verificationProof.canonical_promotion_approval?.humanApprovalToken ||
                        verificationProof.canonical_promotion_approval?.human_approval_token ||
                        verificationProof.humanApprovalToken ||
                        options.humanApprovalToken,
    tokenOptions: options.tokenOptions
  };
  const persistRes = persistDomainIntelligenceRecord(domainRecord, customRoot, authContext);
  if (!persistRes.persisted) {
    return {
      success: false,
      candidate_id: validCandidate.candidate_id,
      stage: persistRes.code === 'PERSISTENCE_REJECTED_UNAUTHORIZED_DOMAIN'
        ? KNOWLEDGE_STAGE.STAGED_FOR_HUMAN_REVIEW
        : KNOWLEDGE_STAGE.DUPLICATE_SKIPPED,
      code: persistRes.code,
      reason: persistRes.reason,
      existing_record_id: persistRes.existing_record_id
    };
  }

  // Step 7: Log Provenance & Verification Matrix Audits
  try {
    const nowIso = new Date().toISOString();
    const cycleId = `CYCLE-${nowIso.split('T')[0]}-PROJ-EVOLVE`;

    // Append to 08_VERIFICATION/harvest-verification-matrix.md
    if (fs.existsSync(VERIFICATION_MATRIX_FILE)) {
      const vRow = `| \`${cycleId}\` | \`${nowIso}\` | \`${validCandidate.project_name}\` | ${validCandidate.verification_evidence.evidence_type} | \`VERIFIED\` | \`${domainRecord.record_id}\` [Domain ${domainRecord.domain_letter}] | Yes (\`${domainRecord.content_hash.slice(0, 8)}...\`) |\n`;
      fs.appendFileSync(VERIFICATION_MATRIX_FILE, vRow, 'utf-8');
    }

    // Append to 09_SOURCES/harvest-provenance-ledger.md
    if (fs.existsSync(PROVENANCE_LEDGER_FILE)) {
      const pRow = `| \`learn-${domainRecord.record_id.toLowerCase()}\` | \`project://${validCandidate.project_name}\` | \`${validCandidate.source_version || '1.0'}\` | \`${validCandidate.source_file}\` | ${nowIso} |\n`;
      fs.appendFileSync(PROVENANCE_LEDGER_FILE, pRow, 'utf-8');
    }
  } catch (auditErr) {
    // Non-fatal logging
  }

  return {
    success: true,
    candidate_id: validCandidate.candidate_id,
    record_id: domainRecord.record_id,
    stage: KNOWLEDGE_STAGE.CANONICAL,
    domain_letter: domainRecord.domain_letter,
    domain_name: domainRecord.domain_name,
    content_hash: domainRecord.content_hash,
    title: domainRecord.title,
    persisted_at: new Date().toISOString(),
    project_isolated: true,
    universal_invariant_length: validCandidate.universal_invariant.length,
    pillars: validCandidate.pillars
  };
}
