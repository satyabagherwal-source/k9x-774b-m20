# Candidate Directive: [CD-OD45] Explain the capped tip state at the node height, and cover the quiet paths

<!-- PROVENANCE_START
{
  "source_repository": "aleo-labs-protocol-snarkos-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T04:45:24.083Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aleo-labs-protocol-snarkos-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aleo-labs-protocol-snarkos-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T04:45:24.083Z`  
> **Learning ID**: `LEARN-EVO-aleo-labs-protocol-snarkos-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `node/sync/src/block_sync.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aleo-labs-protocol/snarkOS. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `da73ee50`: Explain the capped tip state at the node height, and cover the quiet paths. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `node/sync/src/block_sync.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            // Failed requests that wait for a peer are reported by `prepare_block_requests`.
            if self.num_total_block_requests() == 0 && self.failed_requests.lock().is_empty() {
                trace!("Trying to re-issue failed block requests {start}..{end_height}");
        } else if let Some((served_tip, advertised_tip)) = tips.filter(|&(served_tip, advertised_tip)| {
            served_tip < start_height && (current_height < served_tip || served_tip < advertised_tip)
        }) {
            // Every block a peer serves is in the ledger or requested, and a peer is ahead of this
            // node, e.g. at the tip while the tip block is in flight. This check must precede
            // `find_sync_peers_inner`: no peer serves `start_height`, so it finds no sync peers, and
            // the final branch logs on every call.
                    "Every block up to {served_tip}, the latest any peer serves, is in the ledger or requested, but peers advertise blocks up to {advertised_tip}"
    /// Returns the number of log lines the enclosing `traced_test` has captured.
    macro_rules! num_log_lines {
        () => {{
        }};
    }

    /// Tests that block sync prepare
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            if self.num_total_block_requests() == 0 {
            trace!("There are {} failed requests that need to be re-issued.", failed_requests.len());

        } else if let Some((served_tip, advertised_tip)) =
            tips.filter(|&(served_tip, _)| current_height < served_tip && served_tip < start_height)
        {
            // Every block a peer serves is in the ledger or requested, e.g. at the tip while the tip
            // block is in flight. This check must precede `find_sync_peers_inner`: no peer serves
            // `start_height`, so it finds no sync peers, and the final branch logs on every call.
                    "Requested every block up to {served_tip}, the latest any peer serves, but peers advertise blocks up to {advertised_tip}"
    /// Tests that block sync prepares no requests and logs nothing once it has requested every
    /// block its peers serve.
    #[test]

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T04:45:24.197Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795495524197",
    "title": "Explain the capped tip state at the node height, and cover the quiet paths",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aleo-labs-protocol-snarkos-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ac0ccb56583dc64770f8526db39fd8d789a93eb4f634d13802da58cdc5d0766c"
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
        "Harvested/verified timestamp recorded: 2026-11-24T04:45:24.197Z"
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
  "auth_token": "0e4e3a249ffd1978751a8f4f9d22fe2deaf9ca0e409865be24a72b62952dcdd8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
