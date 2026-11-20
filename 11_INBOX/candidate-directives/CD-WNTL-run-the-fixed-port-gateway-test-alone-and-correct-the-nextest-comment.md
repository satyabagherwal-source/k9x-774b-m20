# Candidate Directive: [CD-WNTL] Run the fixed-port gateway test alone, and correct the nextest comment

<!-- PROVENANCE_START
{
  "source_repository": "aleo-labs-protocol/snarkOS",
  "source_url": "https://github.com/ProvableHQ/snarkOS",
  "source_version": "cfce7f98",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T17:21:00.057Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aleo-labs-protocol-snarkos",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aleo-labs-protocol/snarkOS](https://github.com/ProvableHQ/snarkOS) (Revision: `cfce7f98`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T17:21:00.057Z`  
> **Learning ID**: `learn-github-aleo-labs-protocol-snarkos`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence (LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.config/nextest.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aleo-labs-protocol/snarkOS. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `97451873`: Run the fixed-port gateway test alone, and correct the nextest comment. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.config/nextest.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# The hosted runners have 4 vCPUs. The fleet `test` job overrides this with
# NEXTEST_TEST_THREADS; see CI.md.

# gateway_start asserts that the gateway binds 127.0.0.1:5000+dev exactly. Other
# tests bind ports in that range, and take another port if one is taken, so this
# test runs alone.
[[profile.default.overrides]]
filter = 'package(snarkos-node-bft) and test(=gateway::prop_tests::gateway_start)'
threads-required = "num-test-threads"
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
# Many tests bind sockets and start nodes, so two run at a time on the hosted
# runners. The fleet `test` job sets NEXTEST_TEST_THREADS instead; see CI.md.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `97451873` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T17:21:00.052Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence (LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path)",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.62,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 62%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=WARN, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795195260052",
    "title": "Run the fixed-port gateway test alone, and correct the nextest comment",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aleo-labs-protocol/snarkOS",
    "source_uri": "https://github.com/ProvableHQ/snarkOS",
    "source_version": "HEAD",
    "content_hash": "489f60771a21b1e29f71bd1ab68729b0ed24ac810b8353797a4567b424123578"
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
      "status": "WARN",
      "score": 0.5,
      "is_generic_pattern": false,
      "has_local_paths": true,
      "findings": [
        "LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-20T17:21:00.053Z"
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
    "Repository-specific scope; not generalized for universal construction",
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "ff6296cf0721cc4622fbae91914e2824e0dc499a8c05a23b300d72b6903d0769"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
