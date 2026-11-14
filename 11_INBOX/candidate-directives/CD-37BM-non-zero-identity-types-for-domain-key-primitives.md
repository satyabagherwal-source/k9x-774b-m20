# Candidate Directive: [CD-37BM] Non-Zero Identity Types for Domain Key Primitives

<!-- PROVENANCE_START
{
  "source_repository": "restatedev-restate-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T05:08:13.783Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-restatedev-restate-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [restatedev-restate-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T05:08:13.783Z`  
> **Learning ID**: `LEARN-EVO-restatedev-restate-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
All domain-specific identity handles that map to persistent storage tokens, key prefixes, or bitmasks MUST use non-zero wrappers (such as `std::num::NonZeroU32`, `NonZeroU64`) rather than raw primitive numbers. A zero value MUST be architecturally unrepresentable in active memory.

**WHY**:
Zero in numeric data types routinely conflates default uninitialized state, sentinel markers, tombstone states, and valid identifiers. Using `NonZeroU32` allows `Option<NonZeroU32>` to utilize the null-pointer optimization (`size_of::<Option<NonZeroU32>>() == size_of::<u32>()`), prevents zero-key corruption in database stores, and surfaces invalid default constructions at the API boundary rather than during storage serialization.

**WHEN TO APPLY**:
- Partition keys, job IDs, transaction identifiers, sequence tokens, and index handles.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Pattern from crates/partition-store/src/job.rs

use std::num::NonZeroU32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MigrationJobId(NonZeroU32);

impl MigrationJobId {
    pub const fn for_index(index_id: u32) -> Self {
        match NonZeroU32::new(index_id) {
            Some(id) => Self(id),
            None => panic!("index IDs are never 0"),
        }
    }

    #[inline]
    pub const fn as_u32(self) -> u32 {
        self.0.get()
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Using raw u32 allows 0 to slip into the storage engine
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MigrationJobId(pub u32); // 0 is legal, causing accidental collisions with nulls/sentinels
```

**VERIFICATION METHOD**:
Compile-time static assertions ensuring memory footprint optimizations and unit tests verifying zero rejection:
```rust
#[test]
fn test_job_id_invariants() {
    assert_eq!(
        std::mem::size_of::<Option<MigrationJobId>>(),
        std::mem::size_of::<u32>()
    );

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:08:13.905Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632893905",
    "title": "Non-Zero Identity Types for Domain Key Primitives",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "restatedev-restate-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e4466c8dbe2f6837fae69d8ac818c848433e249455a8eb6df3610b02f0bcc60b"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T05:08:13.905Z"
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
  "auth_token": "f1fd7286a1c53469740276a62216f26fb268d86b7cfbd1f84a6ac019bd8aa31e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
