# Candidate Directive: [CD-1PY8] Diagnostic Data Backward-Compatibility via Raw Encodings

<!-- PROVENANCE_START
{
  "source_repository": "restatedev/restate",
  "source_url": "https://github.com/restatedev/restate",
  "source_version": "7dd495f7",
  "license": "NOASSERTION",
  "timestamp": "2026-11-14T05:07:04.736Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-restatedev-restate",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [restatedev/restate](https://github.com/restatedev/restate) (Revision: `7dd495f7`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-14T05:07:04.736Z`  
> **Learning ID**: `learn-github-restatedev-restate`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence (UNSUPPORTED_ASSUMPTIONS: Absolute infallibility claim lacks failure boundary)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When persisting auxiliary, diagnostic, or observational metadata alongside consensus or transactional state machines, engineers MUST NOT encode state-transition reasons or diagnostic enumerations as strict, rigid protocol buffers or strict protobuf/bilrost enums. Engineers MUST persist them as raw integers (e.g., `u32`) or self-delimiting types, paired with manual, non-failing conversion helpers that map unrecognized values to a catch-all `Unknown(n)` state.

**WHY**:
Protobuf/Bilrost enum deserializers strictly reject unrecognized enum discriminants by raising decoding errors (`UnknownVariantError`). If node $N+1$ introduces a new enum variant (e.g., `DropReason::UnknownDefinition = 2`) and commits it into a shared or replicated RocksDB column family, node $N$ (running previous binaries during a rolling upgrade or partition reassignment) will fail to decode the entire parent record. This escalates a purely informational field into a cascading store initialization failure, halting the partition.

**WHEN TO APPLY**:
- In any distributed state-store schema where schemas evolve across rolling releases.
- In diagnostic logs, audit trails, and status histories written to long-term storage or Raft FSM state.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern extracted from crates/partition-store/src/registry.rs

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DropReason {
    Reset = 1,
    UnknownDefinition = 2,
}

impl DropReason {
    pub fn from_number(number: u32) -> Option<Self> {
        match number {
            1 => Some(Self::Reset),
            2 => Some(Self::UnknownDefinition),
            _ => None, // Safe degradation for future variants
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, bilrost::Message)]
pub struct IndexTimeline {
    #[bilrost(1)]
    pub registered_at: Option<u64>,
    #[bilrost(2)]
    pub registered_by: Option<restate_util_string::ReString>,
    #[bilrost(3)]
    pub ready_at: Option<u64>,
    #[bilrost(4)]
    pub dropped_at: Option<u64>,
    /// Persisted as a raw numeric discriminant, avoiding strict deserializer rejection
    #[bilrost(5)]
    pub drop_reason: u32,
}

impl IndexTimeline {
    pub fn dropped(&mut self, at: u64, reason: DropReason) {
        self.dropped_at = Some(at);
        self.drop_reason = reason as u32;
    }
}

impl std::fmt::Display for IndexTimeline {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "registered={:?} registered_by={:?} ready={:?} dropped={:?}",
            self.registered_at, self.registered_by, self.ready_at, self.dropped_at
        )?;
        match (self.drop_reason, DropReason::from_number(self.drop_reason)) {
            (0, _) => Ok(()),
            (_, Some(reason)) => write!(f, " drop_reason={reason:?}"),
            (number, None) => write!(f, " drop_reason=unknown({number})"), // Preserves future variants cleanly
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct enumeration in persistent message
#[derive(Debug, Clone, Copy, PartialEq, Eq, bilrost::Enumeration)]
pub enum DropReason {
    #[bilrost(0)]
    Unknown = 0,
    #[bilrost(1)]
    Reset = 1,
    // When v2 adds UnknownDefinition = 2, v1 fails decoding completely
}

#[derive(Debug, Clone, bilrost::Message)]
pub struct IndexTimeline {
    // If RocksDB contains a value written by v2 (variant 2), v1 fails with:
    // "Failed to decode Message: Invalid enumeration discriminant"
    #[bilrost(5)]
    pub drop_reason: DropReason, 
}
```

**VERIFICATION METHOD**:
Enforce cross-version decoding tests asserting that unknown numerical variants roundtrip without serialization failure:
```rust
#[test]
fn test_unknown_drop_reason_preservation() {
    let mut timeline = IndexTimeline::default();
    timeline.dropped(1700000000, DropReason::Reset);
    timeline.drop_reason = 999; // Future variant added by a later version

    let encoded = timeline.encode_to_vec();
    let decoded = IndexTimeline::decode(&encoded[..]).expect("decoding must never fail on unknown discriminants");
    assert_eq!(decoded.drop_reason, 999);
    assert_eq!(format!("{decoded}"), "registered=None registered_by=None ready=None dropped=None drop_reason=unknown(999)");
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:07:04.734Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence (UNSUPPORTED_ASSUMPTIONS: Absolute infallibility claim lacks failure boundary)",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.65,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 65%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=WARN, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632824734",
    "title": "Diagnostic Data Backward-Compatibility via Raw Encodings",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "restatedev/restate",
    "source_uri": "https://github.com/restatedev/restate",
    "source_version": "HEAD",
    "content_hash": "eff874e01422d8e30cb109938df4a25f3e0c5ee9d74de2f335ed0462487bfdba"
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
      "status": "WARN",
      "score": 0.85,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [
        "Absolute infallibility claim lacks failure boundary"
      ],
      "findings": [
        "UNSUPPORTED_ASSUMPTIONS: Absolute infallibility claim lacks failure boundary"
      ],
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
        "Harvested/verified timestamp recorded: 2026-11-14T05:07:04.734Z"
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
  "auth_token": "7bb0cf65d4066db2890bcc7c19ee4213879d51295cee7ca46e645f957842dd67"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
