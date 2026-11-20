# Candidate Directive: [CD-724E] Empirical Invariant Guard in ci.yml

<!-- PROVENANCE_START
{
  "source_repository": "aleo-labs-protocol-snarkos-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T05:21:15.027Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aleo-labs-protocol-snarkos-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aleo-labs-protocol-snarkos-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T05:21:15.027Z`  
> **Learning ID**: `LEARN-EVO-aleo-labs-protocol-snarkos-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aleo-labs-protocol/snarkOS. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `811fe8b4`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      # The fuzzing harness builds these two alone with `test-helpers`, which
      - run: cargo check -p snarkos-node-router-messages --features test-helpers
      - run: cargo check -p snarkos-node-bft-events --features test-helpers
  # `snarkos-node-router/test-helpers`, `snarkos-node-network/test-helpers` and
  # none of these on any crate. Other helper features, such as `mock` and the
  # other crates' `test-helpers`, can still be unified.
            runs: |
              nextest run -p snarkos-node-consensus -p snarkos-cli
              nextest run -p snarkos-node-rest
          # One line for both would turn on `test-helpers` in
          # `snarkos-node-sync` for its own tests. The two lines build the same
          # snarkvm crates.
  # The release binary must compile in no test-only code. `test-helpers` in the
  # event and message crates turns on proptest and snarkVM's `test-helpers`, and
  # feature unification would carry them into the binary if any crate on its
  # path ever enabled it.
          hits=$(grep -E '^[a-z0-9_-]+ feature "(test-helpers|test)"$|^proptest ' graph.txt | sort -u || true)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
      # The fuzzing harness builds these two alone with `fuzz-helpers`, which
      - run: cargo check -p snarkos-node-router-messages --features fuzz-helpers
      - run: cargo check -p snarkos-node-bft-events --features fuzz-helpers
  # `snarkos-node-router/test`, `snarkos-node-network/test` and
  # none of these on any crate. Helper features such as `test-helpers` and
  # `mock` can still be unified.
            runs: nextest run -p snarkos-node-consensus -p snarkos-node-rest -p snarkos-cli
          # One line for both would turn on `test` in `snarkos-node-sync` for
          # its own tests. The two lines build the same snarkvm crates.
  # The release binary must compile in no test-only code. `fuzz-helpers` turns on
  # proptest and snarkVM's `test-helpers`, and feature unification would carry
  # them into the binary if any crate on its path ever enabled it.
          hits=$(grep -E '^[a-z0-9_-]+ feature "(fuzz-helpers|test-helpers|test)"$|^proptest ' graph.txt | sort -u || true)
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T05:21:15.131Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795152075130",
    "title": "Empirical Invariant Guard in ci.yml",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aleo-labs-protocol-snarkos-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "fc244e4d6a91905450a0fbb3f027fe0d2b0c444f4a046ce3a662d092ec2798cb"
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
        "Harvested/verified timestamp recorded: 2026-11-20T05:21:15.131Z"
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
  "auth_token": "0dd886bdae2dfbeaeb5ef33f591108ba9e632167a13ae82bacff5277ff9864a0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
