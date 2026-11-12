/**
 * Phase E.2: Rejected Candidate Evidence Recovery Engine
 * 
 * Analyzes and classifies all 394 rejected candidate records:
 * 1. Categorizes by specific gateway rejection reason.
 * 2. Traces provenance to 07_PROJECT_LEARNING dossiers and upstream repositories.
 * 3. Assesses missing evidence components (negative constraints, why rationale, when-to-apply, substance).
 * 4. Synthesizes recovery potential and assigns strictly evidence-backed dispositions.
 * 
 * INVARIANT: If evidence is missing or ambiguous, marks UNVERIFIED_QUARANTINED.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

export const REJECTION_CATEGORIES = {
  MISSING_NEGATIVE_CONSTRAINT: 'MISSING_NEGATIVE_CONSTRAINT',
  GENERIC_HEADER_TITLE: 'GENERIC_HEADER_TITLE',
  SUBSTANCE_THRESHOLD_FAILED: 'SUBSTANCE_THRESHOLD_FAILED',
  MISSING_WHY_RATIONALE: 'MISSING_WHY_RATIONALE',
  MISSING_WHEN_TO_APPLY: 'MISSING_WHEN_TO_APPLY',
  MISSING_VERIFICATION_METHOD: 'MISSING_VERIFICATION_METHOD',
  MISSING_IMPLEMENTATION_PATTERN: 'MISSING_IMPLEMENTATION_PATTERN',
  INVALID_OR_MISSING_TITLE: 'INVALID_OR_MISSING_TITLE',
  LOCAL_PR_OR_ISSUE_TITLE: 'LOCAL_PR_OR_ISSUE_TITLE'
};

export const DISPOSITION_TYPES = {
  RECOVERABLE_WITH_SYNTHESIS: 'RECOVERABLE_WITH_SYNTHESIS',
  UNVERIFIED_QUARANTINED: 'UNVERIFIED_QUARANTINED',
  REJECT_PERMANENTLY_MALFORMED: 'REJECT_PERMANENTLY_MALFORMED',
  SUPERSEDED_BY_DOSSIER: 'SUPERSEDED_BY_DOSSIER'
};

export function classifyRejectionReason(rawReason = '') {
  if (rawReason.includes('NEGATIVE CONSTRAINT')) return REJECTION_CATEGORIES.MISSING_NEGATIVE_CONSTRAINT;
  if (rawReason.includes('Generic header title')) return REJECTION_CATEGORIES.GENERIC_HEADER_TITLE;
  if (rawReason.includes('substance threshold')) return REJECTION_CATEGORIES.SUBSTANCE_THRESHOLD_FAILED;
  if (rawReason.includes('WHY')) return REJECTION_CATEGORIES.MISSING_WHY_RATIONALE;
  if (rawReason.includes('WHEN TO APPLY')) return REJECTION_CATEGORIES.MISSING_WHEN_TO_APPLY;
  if (rawReason.includes('VERIFICATION METHOD')) return REJECTION_CATEGORIES.MISSING_VERIFICATION_METHOD;
  if (rawReason.includes('VERIFIED IMPLEMENTATION PATTERN')) return REJECTION_CATEGORIES.MISSING_IMPLEMENTATION_PATTERN;
  if (rawReason.includes('Invalid or missing rule title')) return REJECTION_CATEGORIES.INVALID_OR_MISSING_TITLE;
  if (rawReason.includes('repository-specific PR/issue')) return REJECTION_CATEGORIES.LOCAL_PR_OR_ISSUE_TITLE;
  return 'OTHER_REJECTION';
}

export function recoverRejectedCandidates() {
  const candPath = path.join(BRAIN_ROOT, '11_INBOX', 'candidate-directives-registry.json');
  const candData = JSON.parse(fs.readFileSync(candPath, 'utf8'));
  const directives = candData.directives || [];

  const dossiersDir = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING');
  const availableDossiers = fs.existsSync(dossiersDir) ? fs.readdirSync(dossiersDir) : [];

  const rejected = directives.filter(d => Boolean(d.reason));

  const reasonCensus = {};
  Object.values(REJECTION_CATEGORIES).forEach(c => { reasonCensus[c] = 0; });

  const dispositionCounts = {
    RECOVERABLE_WITH_SYNTHESIS: 0,
    UNVERIFIED_QUARANTINED: 0,
    REJECT_PERMANENTLY_MALFORMED: 0,
    SUPERSEDED_BY_DOSSIER: 0
  };

  const recoveredRecords = [];

  rejected.forEach(cand => {
    const reasonCat = classifyRejectionReason(cand.reason);
    reasonCensus[reasonCat] = (reasonCensus[reasonCat] || 0) + 1;

    // Provenance resolution
    let matchedDossier = null;
    if (cand.learning_id) {
      matchedDossier = availableDossiers.find(f => {
        const slug = f.replace('-learnings.md', '');
        return cand.learning_id.includes(slug) || (cand.source_repo && f.includes(cand.source_repo.split('/')[1]?.toLowerCase()));
      }) || null;
    }

    const title = cand.directive_title || cand.title || 'Untitled Candidate';
    const isGeneric = reasonCat === REJECTION_CATEGORIES.GENERIC_HEADER_TITLE || reasonCat === REJECTION_CATEGORIES.INVALID_OR_MISSING_TITLE;
    const hasDossier = Boolean(matchedDossier);

    let disposition;
    let confidence;
    let missingEvidence;

    if (isGeneric) {
      disposition = DISPOSITION_TYPES.REJECT_PERMANENTLY_MALFORMED;
      confidence = 0.10;
      missingEvidence = 'Universal engineering title; contains only section header or issue tag without principle statement.';
    } else if (hasDossier && reasonCat === REJECTION_CATEGORIES.MISSING_NEGATIVE_CONSTRAINT) {
      disposition = DISPOSITION_TYPES.RECOVERABLE_WITH_SYNTHESIS;
      confidence = 0.85;
      missingEvidence = 'Explicit negative anti-pattern constraint (recoverable from parent dossier code diff).';
    } else if (hasDossier && reasonCat === REJECTION_CATEGORIES.MISSING_WHY_RATIONALE) {
      disposition = DISPOSITION_TYPES.RECOVERABLE_WITH_SYNTHESIS;
      confidence = 0.80;
      missingEvidence = 'Technical root-cause justification (recoverable from parent dossier forensic autopsy).';
    } else if (reasonCat === REJECTION_CATEGORIES.SUBSTANCE_THRESHOLD_FAILED) {
      disposition = hasDossier ? DISPOSITION_TYPES.SUPERSEDED_BY_DOSSIER : DISPOSITION_TYPES.UNVERIFIED_QUARANTINED;
      confidence = hasDossier ? 0.65 : 0.25;
      missingEvidence = 'Substantive body text meeting 200-character threshold.';
    } else {
      disposition = DISPOSITION_TYPES.UNVERIFIED_QUARANTINED;
      confidence = 0.35;
      missingEvidence = `Missing mandatory structure: ${cand.reason}`;
    }

    dispositionCounts[disposition]++;

    recoveredRecords.push({
      id: cand.id,
      originalClaim: title,
      sourceProvenance: {
        sourceRepo: cand.source_repo || 'unknown',
        sourceCommit: cand.source_commit || 'unknown',
        learningId: cand.learning_id || null,
        dossierPath: matchedDossier ? `07_PROJECT_LEARNING/${matchedDossier}` : null
      },
      gatewayRejectionReason: cand.reason,
      rejectionCategory: reasonCat,
      missingEvidence,
      applicability: hasDossier ? `Derived from ${cand.source_repo} architecture execution context` : 'Unspecified',
      technicalRationale: hasDossier ? `Forensic autopsy recorded in 07_PROJECT_LEARNING/${matchedDossier}` : 'Unverified',
      negativeConstraints: reasonCat === REJECTION_CATEGORIES.MISSING_NEGATIVE_CONSTRAINT ? 'Requires explicit anti-pattern synthesis' : 'None specified',
      verificationMethod: 'Independent static analysis and sandbox read-back parity test',
      confidence,
      recommendedDisposition: disposition
    });
  });

  return {
    timestamp: new Date().toISOString(),
    totalRejected: rejected.length,
    reasonCensus,
    dispositionCounts,
    dossierBackingRate: {
      matchedWithDossier: recoveredRecords.filter(r => Boolean(r.sourceProvenance.dossierPath)).length,
      unmatched: recoveredRecords.filter(r => !r.sourceProvenance.dossierPath).length
    },
    sampleRecoveredRecords: recoveredRecords.slice(0, 15),
    recoveredRecords
  };
}

