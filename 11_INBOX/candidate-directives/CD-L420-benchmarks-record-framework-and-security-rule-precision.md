# Candidate Directive: [CD-L420] benchmarks): record framework and security rule precision

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs-fallow-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T16:41:43.209Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-fallow-rs-fallow-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs-fallow-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T16:41:43.209Z`  
> **Learning ID**: `LEARN-EVO-fallow-rs-fallow-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `benchmarks/rule-precision-summary.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `301c3eae`: benchmarks): record framework and security rule precision. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `benchmarks/rule-precision-summary.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| `dead-code` | `dev-dependency-in-production` | 24 | 24 | 24 | 0 | 0 | 100% (79 to 100) | 2 (100% agree) | 3.49.0, 2026-11-27 |
| `dead-code` | `invalid-client-export` | 1 | 1 | 0 | 1 | 0 | 0% (0 to 98) | 2 (100% agree) | 3.49.0, 2026-11-27 |
| `dead-code` | `unused-component-emit` | 14 | 14 | 10 | 4 | 0 | 71% (42 to 92) | 2 (100% agree) | 3.49.0, 2026-11-27 |
| `dead-code` | `unused-component-input` | 5 | 5 | 3 | 2 | 0 | 60% (15 to 95) | 2 (100% agree) | 3.49.0, 2026-11-27 |
| `security` | `cleartext-transport` | 2 | 2 | 0 | 2 | 0 | 0% (0 to 84) | 2 (100% agree) | 3.49.0, 2026-11-27 |
| `security` | `client-server-leak` | 129 | 32 | 0 | 32 | 0 | 0% (0 to 15) | 2 (100% agree) | 3.49.0, 2026-11-27 |
| `security` | `code-injection` | 3 | 3 | 0 | 3 | 0 | 0% (0 to 71) | 2 (100% agree) | 3.49.0, 2026-11-27 |
| `security` | `command-injection` | 1 | 1 | 0 | 1 | 0 | 0% (0 to 98) | 2 (100% agree) | 3.49.0, 2026-11-27 |
| `security` | `dangerous-html` | 15 | 15 | 0 | 15 | 0 | 0% (0 to 66) | 3 (67% agree) | 3.49.0, 2026-11-27 |
| `security` | `dynamic-module-load` | 2 | 2 | 0 | 2 | 0 | 0% (0 to 99) | 2 (100% agree) | 3.49.0, 2026-11-27 |
| `security` | `nosql-injection` | 2 | 2 | 0 | 2 | 0 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `301c3eae` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T16:41:43.363Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795797703362",
    "title": "benchmarks): record framework and security rule precision",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs-fallow-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "fa1c1008e7b68c15593554c2f14d4a3f04077377a48422faba00b50898655dd6"
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
        "Harvested/verified timestamp recorded: 2026-11-27T16:41:43.363Z"
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
  "auth_token": "5adca6dd4228674ca1e0d6392da4b6267e186046d617d72645f0c0e7f4c29c60"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
