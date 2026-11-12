/**
 * candidate-schema.mjs
 * 
 * Strict Candidate Record Validator for Stage C Persistence & Retrieval
 * Enforces domain constraints (13 domains), 16 canonical destinations,
 * required evidence status fields, provenance, and approval gate.
 */

export const VALID_DOMAINS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'
];

export const VALID_DESTINATIONS = [
  '00_START_HERE',
  '01_CORE',
  '02_AGENT_INTELLIGENCE',
  '03_SKILLS',
  '04_WORKFLOWS',
  '05_KNOWLEDGE',
  '06_PROJECT_CONTEXT',
  '07_PROJECT_LEARNING',
  '08_VERIFICATION',
  '09_SOURCES',
  '10_PROMPTS',
  '11_INBOX',
  '12_DECISIONS',
  '13_GOVERNANCE',
  '14_EVOLUTION',
  '15_METADATA'
];

export const IMPLEMENTATION_EVIDENCE_STATUSES = [
  'ORIGINAL_SOURCE_EXECUTED',
  'CONFIGURATION_CONTRACT_TESTED',
  'STATIC_EVIDENCE_ONLY',
  'BLOCKED_BY_DEPENDENCY',
  'UNVERIFIED'
];

export const KNOWLEDGE_TRANSFERABILITY_STATUSES = [
  'TRANSFERABLE_PATTERN_CANDIDATE',
  'TRANSFERABLE_PRINCIPLE_CANDIDATE',
  'REPOSITORY_SPECIFIC',
  'INSUFFICIENT_EVIDENCE',
  'CONFLICTED'
];

export const APPROVAL_STATUSES = [
  'APPROVED',
  'PENDING_APPROVAL',
  'REJECTED'
];

export const PERSISTENCE_STATUSES = [
  'NOT_PERSISTED',
  'PERSISTED',
  'FAILED'
];

export const RETRIEVAL_VERIFICATION_STATUSES = [
  'NOT_VERIFIED',
  'VERIFIED',
  'FAILED'
];

/**
 * Validates a structured candidate record against Stage C admission rules.
 * @param {object} record 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCandidateRecord(record) {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Record must be a non-null object'] };
  }

  // 1. Mandatory Core Identity Fields
  if (!record.candidate_id || typeof record.candidate_id !== 'string') {
    errors.push('Missing or invalid candidate_id (must be non-empty string)');
  }
  if (!record.title || typeof record.title !== 'string') {
    errors.push('Missing or invalid title (must be non-empty string)');
  }
  if (!record.content || typeof record.content !== 'string') {
    errors.push('Missing or invalid content (must be non-empty string)');
  }

  // 2. Implementation Evidence Status
  if (!record.implementation_evidence_status || !IMPLEMENTATION_EVIDENCE_STATUSES.includes(record.implementation_evidence_status)) {
    errors.push(`Invalid implementation_evidence_status: '${record.implementation_evidence_status}'. Must be one of: ${IMPLEMENTATION_EVIDENCE_STATUSES.join(', ')}`);
  }

  // 3. Knowledge Transferability Status
  if (!record.knowledge_transferability_status || !KNOWLEDGE_TRANSFERABILITY_STATUSES.includes(record.knowledge_transferability_status)) {
    errors.push(`Invalid knowledge_transferability_status: '${record.knowledge_transferability_status}'. Must be one of: ${KNOWLEDGE_TRANSFERABILITY_STATUSES.join(', ')}`);
  }

  // 4. Domain Classification
  if (!record.domain_classification || !VALID_DOMAINS.includes(record.domain_classification)) {
    errors.push(`Invalid domain_classification: '${record.domain_classification}'. Must be one of: ${VALID_DOMAINS.join(', ')}`);
  }

  // 5. Proposed Canonical Destination
  if (!record.proposed_canonical_destination || !VALID_DESTINATIONS.includes(record.proposed_canonical_destination)) {
    errors.push(`Invalid proposed_canonical_destination: '${record.proposed_canonical_destination}'. Must be one of: ${VALID_DESTINATIONS.join(', ')}`);
  }

  // 6. Duplicate References
  if (!Array.isArray(record.duplicate_references)) {
    errors.push('duplicate_references must be an array of strings');
  }

  // 7. Human Approval Status
  if (!record.approval_status || !APPROVAL_STATUSES.includes(record.approval_status)) {
    errors.push(`Invalid approval_status: '${record.approval_status}'. Must be one of: ${APPROVAL_STATUSES.join(', ')}`);
  }

  // 8. Provenance Validation
  if (!record.provenance || typeof record.provenance !== 'object') {
    errors.push('Missing provenance block');
  } else {
    if (!record.provenance.upstream_repository) {
      errors.push('Missing provenance.upstream_repository');
    }
    if (!record.provenance.target_source_file) {
      errors.push('Missing provenance.target_source_file');
    }
  }

  // 9. Evidence Validation
  if (!record.evidence || typeof record.evidence !== 'object') {
    errors.push('Missing evidence block');
  } else {
    if (!record.evidence.evidence_type) {
      errors.push('Missing evidence.evidence_type');
    }
    if (!record.evidence.verification_status) {
      errors.push('Missing evidence.verification_status');
    }
  }

  // 10. Specific Candidate Rigor Constraints (Section 2 rules)
  const normTitle = (record.title || '').toLowerCase();
  const normFile = (record.provenance?.target_source_file || '').toLowerCase();

  // Rule: Tokenizer Boundary must be CONFIGURATION_CONTRACT_TESTED
  if (normTitle.includes('tokenizer') && normFile.includes('tokenizer_config.json')) {
    if (record.implementation_evidence_status === 'ORIGINAL_SOURCE_EXECUTED') {
      errors.push('Tokenizer Boundary with configuration schema must be classified as CONFIGURATION_CONTRACT_TESTED, not ORIGINAL_SOURCE_EXECUTED');
    }
  }

  // Rule: GGUF Binary Header must be STATIC_EVIDENCE_ONLY unless original native C parser execution is proven
  if (normTitle.includes('binary artifact header') || normTitle.includes('gguf')) {
    if (record.implementation_evidence_status === 'ORIGINAL_SOURCE_EXECUTED') {
      errors.push('GGUF Binary Header cannot claim ORIGINAL_SOURCE_EXECUTED without native C compiler build proof');
    }
  }

  // Rule: Ternary LUT must be BLOCKED_BY_DEPENDENCY unless original CUDA kernel execution is proven
  if (normTitle.includes('ternary') || normTitle.includes('trit unpacking') || normFile.includes('.cu')) {
    if (record.implementation_evidence_status === 'ORIGINAL_SOURCE_EXECUTED') {
      errors.push('Ternary LUT cannot claim ORIGINAL_SOURCE_EXECUTED without NVIDIA GPU and nvcc compiler execution proof');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

