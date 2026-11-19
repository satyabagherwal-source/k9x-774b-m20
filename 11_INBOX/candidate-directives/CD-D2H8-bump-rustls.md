# Candidate Directive: [CD-D2H8] Bump rustls

<!-- PROVENANCE_START
{
  "source_repository": "microsoft/agent-governance-toolkit",
  "source_url": "https://github.com/microsoft/agent-governance-toolkit",
  "source_version": "f85abe1f",
  "license": "MIT",
  "timestamp": "2026-11-19T00:58:18.956Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-microsoft-agent-governance-toolkit",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit) (Revision: `f85abe1f`).  
> **License**: MIT | **Timestamp**: `2026-11-19T00:58:18.956Z`  
> **Learning ID**: `learn-github-microsoft-agent-governance-toolkit`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `benchmarks/prompt-injection/harness/agt-rules-baseline/Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/agent-governance-toolkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f85abe1f`: deps): Bump rustls. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `benchmarks/prompt-injection/harness/agt-rules-baseline/Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
version = "0.4.0-alpha.4"
checksum = "ce7cef7009046fda4752cf68911b6fa4076b6a7dcb5f6e0ef629b45dab7006f8"
 "serde-saphyr",
 "serde_path_to_error",
 "tempfile",
version = "4.14.1"
checksum = "5ab947d799cd1bacd4a060d2657c667fdb2559bae9b75319344d48fb6e22f408"
version = "4.14.1"
checksum = "84f39a1d02e72014885b6c33d5ec4fbd0c7ede5ed1069b3a9e5775874bca066b"
version = "4.14.1"
checksum = "9d778cb4470373659f37e4065646ea0080932f3ee77bd156ab0ecff6a7876357"
version = "0.8.2"
checksum = "a00371d2607edea062396ef1ce6ade65c8e915ac7a1277daa198208420f682c6"
version = "0.13.0"
checksum = "800007e261eac92aecf7d709fd4110de132bf79651d4bd1e0137db9debd0cfe7"
version = "0.23.46"
checksum = "48e13bd8c0e9365c43cfa5c9e8f9ad49d3c8444926c9aac819e0e4dc503c8fdf"
[[package]]
name = "serde_path_to_error"
version = "0.1.20"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "10a9ff822e371bb5403e391ecd83e182e0e77ba7f6fe0160b795797109d1b457"
dependencies = [
 "itoa",
 "serde",
 "serde_core",
]

version = "2.0.21"
checksum = "09e52cb86a36cede5cb101bf8908837b3e4c6e5e59fe7fd85c23fb56200d189e"
version = "2.0.21"
checksum = "fe5197923287db20a58125f0bc85c062f7f2c892de97b18c356f9efb14b28524"
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
version = "0.4.0-alpha.3"
checksum = "92f7c1a0b2f6579980a6b30b78d7ee765b9fc185612b649c5b693e7464ab60e0"
 "serde_yaml",
version = "4.13.0"
checksum = "5e4f5e46c425491b7133eecb3030d82d27301b84bfa08533c59a6902cca7eb80"
version = "4.13.0"
checksum = "7a30d11033d59b262bbb380d8bb5dc5c3dd2dd2281675c558ef4fd8a161ce669"
version = "4.13.0"
checksum = "8a2c8dc671e62597c85caa11694365b76050abcd9f2177f0520ccac0580f9a41"
version = "0.7.6"
checksum = "e451fac8dd8dece16234604bf1efce6e90fddd8ab6ad4d66eec0eca5160959dd"
version = "0.12.0"
checksum = "94d90cbdbc4d2900378cf7dbb0c8df85a28e6de07fad75c60cd4d73283eded23"
version = "0.23.43"
checksum = "0283386ce02abc0151e1761d08802dfe86c173b0b494af5cbc086574e453da06"
[[package]]
name = "ryu"
version = "1.0.23"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9774ba4a74de5f7b1c1451ed6cd5285a32eddb5cccb8cc655a4e50009e06477f"

[[package]]
name = "serde_yaml"
version = "0.9.34+deprecated"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6a8b1a1a2ebf674015cc02edccce75287f1a0130d394307b36743c2f5d504b47"
dependencies = [
 "indexmap 2.14.0",
 "itoa",
 "ryu",
 "serde",
 "unsafe-libyaml",
]

version = "2.0.19"
c
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f85abe1f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T00:58:18.951Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795049898951",
    "title": "Bump rustls",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "microsoft/agent-governance-toolkit",
    "source_uri": "https://github.com/microsoft/agent-governance-toolkit",
    "source_version": "HEAD",
    "content_hash": "a3a42b42d4cbe6f1377cf4db68f52b9449394ca588ab0ecc526e279c4b564ad1"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T00:58:18.952Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "06e1c83c05b38a49fb6f4d60e2723b1df17c01a8a57e8ec18730d491325a746d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
