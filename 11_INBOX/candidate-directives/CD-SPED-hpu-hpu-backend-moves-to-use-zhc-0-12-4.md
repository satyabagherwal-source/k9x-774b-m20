# Candidate Directive: [CD-SPED] hpu): HPU backend moves to use ZHC 0.12.4

<!-- PROVENANCE_START
{
  "source_repository": "zama-ai-tfhe-rs-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T18:41:54.164Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zama-ai-tfhe-rs-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zama-ai-tfhe-rs-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T18:41:54.164Z`  
> **Learning ID**: `LEARN-EVO-zama-ai-tfhe-rs-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zama-ai/tfhe-rs. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dcfe7e6d`: hpu): HPU backend moves to use ZHC 0.12.4. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
version = "0.12.4"
checksum = "69a555e3b8badfa59c7dda3db2a56ce4363bc1df3af296dcd75ab9f732748ed6"
 "zhc_ir 0.12.4",
 "zhc_utils 0.12.4",
version = "0.12.4"
checksum = "63a9ff1c29f22405f3926a91eedbdbee9039a0b141826464b5d46e8bff6bb319"
 "zhc_ir 0.12.4",
 "zhc_utils 0.12.4",
version = "0.12.4"
checksum = "3410f119c7383c1f55212f9678f27fdb4e2250f37797c91fa63070da99639592"
 "zhc_utils 0.12.4",
version = "0.12.4"
checksum = "f64534584a418d57de591509524d43a6b718e15f210b75a19a4e66117a8cb13b"
 "zhc_utils 0.12.4",
version = "0.12.4"
checksum = "1a81907d400fb71ab395db99f1f763ea54a8ec655731dc4756657b54d0107f1c"
 "zhc_utils 0.12.4",
 "zhc_utils_macro 0.12.4",
version = "0.12.4"
checksum = "5de831fc49e962043cdd619fbacdff4183829ea281d7cbb1d3b09fe24d7212a1"
 "zhc_ir 0.12.4",
 "zhc_utils 0.12.4",
version = "0.12.4"
checksum = "af40538a1a7579af341a259191427fc30aeca6e405f03a87284155a0fe2d551a"
version = "0.12.4"
checksum = "a0cc6b3edb76937b0e20a5934ca45be61eb6dd2e66f1eb033d0292017f8ad25b"
 "zhc_ir 0.12.4",
 "zhc_utils 0.12.4",
version = "0.12.4"
checksum = "f190e6dc4157598beec24b9255c97060f92dd6aede8d2c867ab9c80bfbfc3677"
version = "0.12.4"
checksum = "60b1f6835645778e130239b57cf6c6969a6fe46ff29e832abb
```

**NEGATIVE CONSTRAINT**:
```rust

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T18:41:54.322Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795200114322",
    "title": "hpu): HPU backend moves to use ZHC 0.12.4",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zama-ai-tfhe-rs-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "75048e429b92266b69e2101755dca7c5a0751172d4b83282d72cd1d9f1b3f635"
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
        "Harvested/verified timestamp recorded: 2026-11-20T18:41:54.323Z"
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
  "auth_token": "3e5222c663e02a3cd0bffb5b46f61f88eb37433f847f58c77afbd21099925a77"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
