# Candidate Directive: [CD-B3KH] sdks/rust): invoke on_disconnect when mutation is queued after disconnect

<!-- PROVENANCE_START
{
  "source_repository": "clockworklabs/SpacetimeDB",
  "source_url": "https://github.com/clockworklabs/SpacetimeDB",
  "source_version": "71fdf1c8",
  "license": "NOASSERTION",
  "timestamp": "2026-11-19T14:28:35.921Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-clockworklabs-spacetimedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [clockworklabs/SpacetimeDB](https://github.com/clockworklabs/SpacetimeDB) (Revision: `71fdf1c8`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-19T14:28:35.921Z`  
> **Learning ID**: `learn-github-clockworklabs-spacetimedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `sdks/rust/src/db_connection.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in clockworklabs/SpacetimeDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `af4b20db`: sdks/rust): invoke on_disconnect when mutation is queued after disconnect. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `sdks/rust/src/db_connection.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        while let Ok(Some(mutation)) = get_lock_sync(&self.pending_mutations_recv).try_next() {
            match self.apply_mutation(mutation) {
                Err(crate::Error::Disconnected) => {
                    return Err(self.end_connection(None));
                }
                result => result?,
            }
                        .map_err(|_| crate::Error::Disconnected)?;
                            .map_err(|_| crate::Error::Disconnected)?;
                    .map_err(|_| crate::Error::Disconnected)?;
                    .map_err(|_| crate::Error::Disconnected)?;
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        while let Ok(Some(pending_mutation)) = get_lock_sync(&self.pending_mutations_recv).try_next() {
            self.apply_mutation(pending_mutation)?;
                        .expect("Unable to send subscribe message: WS sender loop has dropped its recv channel");
                            .expect("Unable to send unsubscribe message: WS sender loop has dropped its recv channel");
                    .expect("Unable to send reducer call message: WS sender loop has dropped its recv channel");
                    .expect("Unable to send procedure call message: WS sender loop has dropped its recv channel");
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `af4b20db` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T14:28:35.919Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795098515919",
    "title": "sdks/rust): invoke on_disconnect when mutation is queued after disconnect",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "clockworklabs/SpacetimeDB",
    "source_uri": "https://github.com/clockworklabs/SpacetimeDB",
    "source_version": "HEAD",
    "content_hash": "8804d13ca4a7b9ea48263200e8c2aef08b9402480563ac61fe2c68963e3bb219"
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
        "Harvested/verified timestamp recorded: 2026-11-19T14:28:35.919Z"
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
  "auth_token": "8101e5e682426e65a34a94797afd592177e3d733b6eab169fcdfbfe27869f1ea"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
