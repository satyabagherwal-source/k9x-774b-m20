# Candidate Directive: [CD-O0G3] support more than 512 radix blocks in partial sum index kernels

<!-- PROVENANCE_START
{
  "source_repository": "zama-ai/tfhe-rs",
  "source_url": "https://github.com/zama-ai/tfhe-rs",
  "source_version": "eaac04df",
  "license": "NOASSERTION",
  "timestamp": "2026-11-25T12:56:41.283Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zama-ai-tfhe-rs",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs) (Revision: `eaac04df`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-25T12:56:41.283Z`  
> **Learning ID**: `learn-github-zama-ai-tfhe-rs`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
      columns[idx][cnt] = ct_id;
      ++cnt;
  columns_counter[idx] = cnt;
    const uint32_t *const columns_counter, const uint32_t chunk_size) {
  const uint32_t base_id = threadIdx.x;
  const uint32_t column_len = columns_counter[base_id];

  uint32_t ct_count = 0;
  for (uint32_t i = 0; i + chunk_size <= column_len; i += chunk_size) {
    // those indexes are for message ciphertexts
    // for message ciphertexts in and out index should be same
    const uint32_t in_index = columns[base_id][i];
    new_columns[base_id][ct_count] = in_index;
    const uint32_t pbs_index = atomicAdd(&counter, 1);
    pbs_indexes_in[pbs_index] = in_index;
    pbs_indexes_out[pbs_index] = in_index;
    lut_indexes[pbs_index] = 0;
    ++ct_count;
  }
  __syncthreads();

  if (base_id > 0) {
    const uint32_t prev_base_id = base_id - 1;
    const uint32_t prev_column_len = columns_counter[prev_base_id];

    for (uint32_t i = 0; i + chunk_size <= prev_column_len; i += chunk_size) {
      // those indexes are for carry ciph
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `eaac04df` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T12:56:41.281Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795611401281",
    "title": "support more than 512 radix blocks in partial sum index kernels",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zama-ai/tfhe-rs",
    "source_uri": "https://github.com/zama-ai/tfhe-rs",
    "source_version": "HEAD",
    "content_hash": "1da2a7a58d978678c6b86e3c58d88073ef40dd8c4ea18c93b3056a5ec6a124f6"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.6,
      "tier": "TIER_3_COMMUNITY_OPEN",
      "findings": [],
      "details": [
        "Source originates from community open repository",
        "Source version unpinned (HEAD), subject to upstream drift",
        "Cryptographic SHA-256 payload integrity hash present"
      ]
    },
    "evidence_quality": {
      "status": "FAIL",
      "score": 0,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [],
      "details": [
        "Direct empirical evidence ratio: 0% (0/4)",
        "Evidence-to-claim lexical alignment: 0%"
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
        "Harvested/verified timestamp recorded: 2026-11-25T12:56:41.281Z"
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
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "4bc51eb7aca5a66f134ed437828147ce169dd465270f542bf3615e8604ea2759"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
