# Candidate Directive: [CD-1PYC] Non-Zero Identity Types for Domain Key Primitives

<!-- PROVENANCE_START
{
  "source_repository": "restatedev/restate",
  "source_url": "https://github.com/restatedev/restate",
  "source_version": "7dd495f7",
  "license": "NOASSERTION",
  "timestamp": "2026-11-14T05:07:04.740Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-restatedev-restate",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [restatedev/restate](https://github.com/restatedev/restate) (Revision: `7dd495f7`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-14T05:07:04.740Z`  
> **Learning ID**: `learn-github-restatedev-restate`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    assert!(std::panic::catch_unwind(|| MigrationJobId::for_index(0)).is_err());
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:07:04.737Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632824737",
    "title": "Non-Zero Identity Types for Domain Key Primitives",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "restatedev/restate",
    "source_uri": "https://github.com/restatedev/restate",
    "source_version": "HEAD",
    "content_hash": "6d281f144d11d4f4478862c9040f5862ed1775be919ac1768ad87faf8107d919"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
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
        "Direct empirical evidence ratio: 0% (0/5)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T05:07:04.737Z"
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
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "f4d34edb24dc7ae01e50bc5429e7c42d09c61de9197780d7f64e2ff2dd6a66fb"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
