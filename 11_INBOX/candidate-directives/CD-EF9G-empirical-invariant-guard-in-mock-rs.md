# Candidate Directive: [CD-EF9G] Empirical Invariant Guard in mock.rs

<!-- PROVENANCE_START
{
  "source_repository": "provablehq-snarkos-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T21:40:04.310Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-provablehq-snarkos-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [provablehq-snarkos-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T21:40:04.310Z`  
> **Learning ID**: `LEARN-EVO-provablehq-snarkos-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `node/bft/ledger-service/src/mock.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aleo-labs-protocol/snarkOS. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1c341ad3`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `node/bft/ledger-service/src/mock.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// The transmission IDs for which the containment check returns an error, as a failed ledger read would.
    unreadable_transmission_ids: HashSet<TransmissionID<N>>,
        Self {
            committee,
            height_to_round_and_hash: Default::default(),
            known_transmission_ids: Default::default(),
            unreadable_transmission_ids: Default::default(),
        }
        Self { height_to_round_and_hash: Mutex::new(height_to_hash), ..Self::new(committee) }
        Self { known_transmission_ids, ..Self::new(committee) }
    }

    /// Makes the containment check fail for the given transmission IDs.
    pub fn with_unreadable_transmission_ids(
        mut self,
        unreadable_transmission_ids: impl IntoIterator<Item = TransmissionID<N>>,
    ) -> Self {
        self.unreadable_transmission_ids.extend(unreadable_transmission_ids);
        self
    /// Returns `false`, unless the mock was configured to know the transmission ID or to fail on it.
        if self.unreadable_transmission_ids.contains(transmission_id) {
            bail!("[MockLedgerService] Unable to read transmission ID {}", fmt_id(transmission_id));
        }
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        Self { committee, height_to_round_and_hash: Default::default(), known_transmission_ids: Default::default() }
        Self {
            committee,
            height_to_round_and_hash: Mutex::new(height_to_hash),
            known_transmission_ids: Default::default(),
        }
        Self { committee, height_to_round_and_hash: Default::default(), known_transmission_ids }
    /// Returns `false`, unless the mock was configured to know the transmission ID.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T21:40:04.416Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794865204416",
    "title": "Empirical Invariant Guard in mock.rs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "provablehq-snarkos-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ce8b0def28dcca53ef2f9a9b9d331a38d002e946f9efd99956fca5ca21e6161d"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T21:40:04.417Z"
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
  "auth_token": "d850458a2f1f98c7eaeb09e8975520679027e79b9db9620872e07db6c7709d03"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
