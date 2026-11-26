# Candidate Directive: [CD-4KK1] bump tiberius to 0.13.0 with configurable SQL Server timeouts

<!-- PROVENANCE_START
{
  "source_repository": "risingwavelabs/risingwave",
  "source_url": "https://github.com/risingwavelabs/risingwave",
  "source_version": "151572e0",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T05:29:20.401Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-risingwavelabs-risingwave",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [risingwavelabs/risingwave](https://github.com/risingwavelabs/risingwave) (Revision: `151572e0`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T05:29:20.401Z`  
> **Learning ID**: `learn-github-risingwavelabs-risingwave`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in risingwavelabs/risingwave. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `30d05555`: connector): bump tiberius to 0.13.0 with configurable SQL Server timeouts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
 "bigdecimal",
 "bigdecimal",
 "rustls-native-certs",
 "tokio-rustls",
version = "0.7.0"
checksum = "a860072022177f903e59730004fb5dc13db9275b79bb2aef7ba8ce831956c233"
 "rustls",
 "rustls-native-certs",
 "tokio-rustls",
 "rustls",
 "bigdecimal",
 "bigdecimal",
 "rustls",
 "rustls-native-certs",
 "tokio-rustls",
 "rustls",
 "rustls-native-certs",
 "tokio-rustls",
 "rustls",
 "tokio-rustls",
 "security-framework",
 "bigdecimal",
 "rustls",
 "rustls-native-certs",
version = "0.4.2"
checksum = "9a65843dfefbafd3c879c683306959a6de478443ffe9c9adf02f5976432402d7"
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
 "bigdecimal 0.4.10",
 "bigdecimal 0.4.10",
 "rustls-native-certs 0.8.1",
 "tokio-rustls 0.26.4",
version = "0.6.2"
checksum = "4057f2c32adbb2fc158e22fb38433c8e9bbf76b75a4732c7c0cbaf695fb65568"
 "rustls 0.23.46",
 "rustls-native-certs 0.8.1",
 "tokio-rustls 0.26.4",
[[package]]
name = "bigdecimal"
version = "0.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a6773ddc0eafc0e509fb60e48dff7f450f8e674a0686ae8605e8d9901bd5eefa"
dependencies = [
 "num-bigint 0.4.6",
 "num-integer",
 "num-traits",
]

 "rustls 0.23.46",
 "bigdecimal 0.4.10",
 "bigdecimal 0.4.10",
 "rustls 0.23.46",
 "rustls-native-certs 0.8.1",
 "tokio-rustls 0.26.4",
 "rustls 0.23.46",
 "rustls-native-certs 0.8.1",
 "tokio-rustls 0.26.4",
 "rustls 0.23.46",
 "tokio-rustls 0.26.4",
 "security-framework 3.5.1",
 "bigdecimal 0.4.10",
 "rustls 0.23.46",
 "rustls-native-certs 0.8.1",
version = "0.3.0"
checksum = "c6fa0831dd7cc608c38a5e323422a0077678fa5744aa2be4ad91c4ece8eec8d5"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `30d05555` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T05:29:20.399Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795670960399",
    "title": "bump tiberius to 0.13.0 with configurable SQL Server timeouts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "risingwavelabs/risingwave",
    "source_uri": "https://github.com/risingwavelabs/risingwave",
    "source_version": "HEAD",
    "content_hash": "9917e567dfd059c863f69e798dd88d782428dc5cc5ffb84dbd2e47b39c429b17"
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
        "Harvested/verified timestamp recorded: 2026-11-26T05:29:20.399Z"
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
  "auth_token": "f439ff6418e385cdfc78336eb7df7a18e4cef7634aec6b9dcfb416d418f467b3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
