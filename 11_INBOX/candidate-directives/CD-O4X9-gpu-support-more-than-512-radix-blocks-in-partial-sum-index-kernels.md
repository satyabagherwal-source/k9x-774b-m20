# Candidate Directive: [CD-O4X9] gpu): support more than 512 radix blocks in partial sum index kernels

<!-- PROVENANCE_START
{
  "source_repository": "zama-ai-tfhe-rs-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T12:56:46.954Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zama-ai-tfhe-rs-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zama-ai-tfhe-rs-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T12:56:46.954Z`  
> **Learning ID**: `LEARN-EVO-zama-ai-tfhe-rs-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `backends/tfhe-cuda-backend/cuda/src/integer/multiplication.cuh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zama-ai/tfhe-rs. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `eaac04df`: gpu): support more than 512 radix blocks in partial sum index kernels. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `backends/tfhe-cuda-backend/cuda/src/integer/multiplication.cuh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  const uint32_t idx = blockIdx.x * blockDim.x + threadIdx.x;
  if (idx < num_radix_blocks) {
    size_t cnt = 0;
    for (int i = 0; i < num_radix_in_vec; i++) {
      size_t ct_id = i * num_radix_blocks + idx;
      if (degrees[ct_id] != 0) {
        columns[idx][cnt] = ct_id;
        ++cnt;
      }
    columns_counter[idx] = cnt;
// Runs in a single CUDA block: all message PBS indexes must be assigned
// (through the shared counter) before the carry ones. Each thread handles the
// columns threadIdx.x, threadIdx.x + blockDim.x, ... so that more than 1024
// columns are supported.
    const uint32_t *const columns_counter, const uint32_t chunk_size,
    const uint32_t num_radix_blocks) {
  for (uint32_t base_id = threadIdx.x; base_id < num_radix_blocks;
       base_id += blockDim.x) {
    const uint32_t column_len = columns_counter[base_id];
    uint32_t ct_count = 0;
    for (uint32_t i = 0; i + chunk_size <= column_len; i += chunk_size) {
      // those indexes are for message ciphertexts
      // for message ciphertexts in and out index should be same
      const uint32_t in_index = columns[base_id][i];
      new_columns[base_id][ct_count] = in_index;
      pbs_indexes_out[pbs
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  const uint32_t idx = threadIdx.x;
  size_t cnt = 0;
  for (int i = 0; i < num_radix_in_vec; i++) {
    size_t ct_id = i * num_radix_blocks + idx;
    if (degrees[ct_id] != 0) {

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T12:56:47.083Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795611407083",
    "title": "gpu): support more than 512 radix blocks in partial sum index kernels",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zama-ai-tfhe-rs-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "06f4030f8c8e365a82d19a66ca329537d06d9e48264e2efa22cb22c05b724408"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
      ]
    },
    "technical_correctness": {
      "status": "PASS",
      "score": 1,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [],
      "findings": [],
      "details": [
        "No direct opposition with canonical operating directives",
        "Substantive technical content verified (> 40 chars)"
      ]
    },
    "reusability": {
      "status": "PASS",
      "score": 1,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Expresses generalized engineering invariants (4 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 1,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)",
        "Includes explicit negative example / anti-pattern contrast"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-25T12:56:47.084Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "PASS",
      "score": 1,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": false,
      "conflicting_rule": null,
      "findings": [],
      "details": []
    }
  },
  "detected_contradictions": [],
  "missing_information": [
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "ea09562fa83194092ffefe368ae3ad66b5f6891e505c1fdff0acb8788b025efb"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
