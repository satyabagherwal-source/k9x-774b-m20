# Candidate Directive: [CD-5BE2] Merge pull request #4603 from aleo-labs-protocol/fix/propose-drain-skip

<!-- PROVENANCE_START
{
  "source_repository": "aleo-labs-protocol/snarkOS",
  "source_url": "https://github.com/ProvableHQ/snarkOS",
  "source_version": "1637f0cc",
  "license": "Apache-2.0",
  "timestamp": "2026-11-13T18:26:01.322Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aleo-labs-protocol-snarkos",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aleo-labs-protocol/snarkOS](https://github.com/ProvableHQ/snarkOS) (Revision: `1637f0cc`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-13T18:26:01.322Z`  
> **Learning ID**: `learn-github-aleo-labs-protocol-snarkos`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `node/bft/src/primary.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aleo-labs-protocol/snarkOS. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e3b97728`: Merge pull request #4603 from aleo-labs-protocol/fix/propose-drain-skip. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `node/bft/src/primary.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // Fetch the current block height and consensus version.
        let current_block_height = self.ledger.latest_block_height();
        let consensus_version = N::CONSENSUS_VERSION(current_block_height)?;
        // Compute the batch proposal spend limit.
        let proposal_spend_limit = BatchHeader::<N>::batch_spend_limit(current_block_height)
            .saturating_mul(self.proposal_spent_limit_multiplier);

        // Note: a drained transmission is held only in `transmissions` or the local variables below,
        // so an early return (e.g. `?`) in this loop drops every transmission drained so far.
                        // Deserialize the transaction. If it is oversized or malformed, skip it.
                        let transaction = match spawn_blocking!(deserialize_transaction_strict(transaction)) {
                            Ok(transaction) => transaction,
                            Err(e) => {
                                debug!(
                                    "Proposing - Skipping and discarding transaction '{}' - Unable to deserialize transaction - {e}",
                                    fmt_id(transaction_id)
                                );
  
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
                        // Deserialize the transaction. If the transaction exceeds the maximum size, then return an error.
                        let transaction = spawn_blocking!(deserialize_transaction_strict(transaction))?;

                        // Fetch the current block height and consensus version.
                        let current_block_height = self.ledger.latest_block_height();
                        let consensus_version = N::CONSENSUS_VERSION(current_block_height)?;
                        let batch_spend_limit = BatchHeader::<N>::batch_spend_limit(current_block_height);
                        let proposal_spend_limit =
                            batch_spend_limit.saturating_mul(self.proposal_spent_limit_multiplier);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e3b97728` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T18:26:01.320Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0.51,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 51%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1794594361320",
    "title": "Merge pull request #4603 from aleo-labs-protocol/fix/propose-drain-skip",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aleo-labs-protocol/snarkOS",
    "source_uri": "https://github.com/ProvableHQ/snarkOS",
    "source_version": "HEAD",
    "content_hash": "e0d4d25f9416ec3bfbb66140a8b7079b1edd3a6bec0df5d7f3dbfefb6cf5c9c9"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
        "Evidence-to-claim lexical alignment: 0%"
      ]
    },
    "technical_correctness": {
      "status": "FAIL",
      "score": 0.4,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": true,
      "opposing_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "unsupported_assumptions": [],
      "findings": [
        "DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write')"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-13T18:26:01.320Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "FAIL",
      "score": 0.4,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": true,
      "conflicting_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "findings": [
        "CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
      ],
      "details": []
    }
  },
  "detected_contradictions": [
    "Canonical opposition: Clashes with RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
    "Conflict with RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
  ],
  "missing_information": [
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "af4d72a8b3c5f9e27185b42e072c58e8138caba347f6f65228553269c14baef7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
