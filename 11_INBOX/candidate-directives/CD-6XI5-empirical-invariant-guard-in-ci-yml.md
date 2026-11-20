# Candidate Directive: [CD-6XI5] Empirical Invariant Guard in ci.yml

<!-- PROVENANCE_START
{
  "source_repository": "aleo-labs-protocol/snarkOS",
  "source_url": "https://github.com/aleo-labs-protocol/snarkOS",
  "source_version": "811fe8b4",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T05:21:09.149Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aleo-labs-protocol-snarkos",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aleo-labs-protocol/snarkOS](https://github.com/aleo-labs-protocol/snarkOS) (Revision: `811fe8b4`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T05:21:09.149Z`  
> **Learning ID**: `learn-github-aleo-labs-protocol-snarkos`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `811fe8b4` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T05:21:09.145Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795152069144",
    "title": "Empirical Invariant Guard in ci.yml",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aleo-labs-protocol/snarkOS",
    "source_uri": "https://github.com/aleo-labs-protocol/snarkOS",
    "source_version": "HEAD",
    "content_hash": "6bc778fd8c4a515cb90541597d4cb7ffc9164dc0fd8c45421d48df872e0377e8"
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
        "Harvested/verified timestamp recorded: 2026-11-20T05:21:09.145Z"
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
  "auth_token": "c680166af84ab72f9f40c9054bd9dce66e8390666f3a6b5af1feaabb954a5533"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
