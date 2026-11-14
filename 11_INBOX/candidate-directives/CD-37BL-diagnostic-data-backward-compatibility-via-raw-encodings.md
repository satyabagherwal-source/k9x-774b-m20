# Candidate Directive: [CD-37BL] Diagnostic Data Backward-Compatibility via Raw Encodings

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:08:13.901Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632893901",
    "title": "Diagnostic Data Backward-Compatibility via Raw Encodings",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "restatedev-restate-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d37db104d64f4cc0dcd04e66e00eda1bec351f0700bfb038672db58b50b3001f"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-14T05:08:13.902Z"
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
  "auth_token": "f32af537ff31866907b9a1290dd501ea0677e99d664b63b9a84d903190f657bc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
