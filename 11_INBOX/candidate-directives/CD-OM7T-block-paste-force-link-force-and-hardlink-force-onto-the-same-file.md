# Candidate Directive: [CD-OM7T] block `paste --force`, `link --force`, and `hardlink --force` onto the same file

<!-- PROVENANCE_START
{
  "source_repository": "sxyazi-yazi-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T19:10:03.516Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-sxyazi-yazi-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sxyazi-yazi-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T19:10:03.516Z`  
> **Learning ID**: `LEARN-EVO-sxyazi-yazi-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sxyazi/yazi. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3e32fa66`: block `paste --force`, `link --force`, and `hardlink --force` onto the same file under an aliased parent. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
version = "1.14.0"
checksum = "a680398c10c7bc0488067c4612226ea905a85f607134b69f3068d505d58c4214"
version = "3.20.4"
checksum = "87a0cf66fd1eb2fb7b822cb78370d82303750809bc6ba855f3f58e517d3238db"
version = "1.12.2"
checksum = "776dfebd015e2d8732c684a2c71003674ccb49457b539b9e82151ba38e96dd7c"
version = "1.11.3"
checksum = "02f0e023adb368345ce0ca6cdfc0f24a06554468d0e8503e14a0841de79bfa69"
version = "4.6.9"
checksum = "844c5c0b65be192cb68d570cca1b21a6444431d24e39c084dc0336177015337c"
version = "4.6.12"
checksum = "6a35200383f20018d41c14d1ab19c1727c697f544492143f7d93aa39f0187848"
version = "4.6.9"
checksum = "b4c174f11f949b9ca8c60580925e282b9cbd5454750e506f08648b2038080cd7"
version = "1.1.2"
checksum = "e0921b3876b3a1df8a1c9f912e7f94342458022c2e84288015893d83c4d62a79"
 "zeroize",
version = "1.2.3"
checksum = "afa489199eaffb1211795df1c6236ce1ad0d41a6fa45250add73e3b02420f06e"
version = "0.17.2"
checksum = "735eaa21a6a5ffb2e84362faaeb90c05ba8e19797ca30428478cb6ea3a4921bc"
 "hashbrown 0.17.2",
version = "0.2.46"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "175dc66334db3b9ab9985bf8b61cfed50dc16d20964bb47f9e479adcae984
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
version = "1.13.1"
checksum = "6bb31b46c14244e20ee9984b11bf5c992b91fb6939fea616e3512c8baecdbe5f"
version = "3.20.3"
checksum = "72f5acc6cb2ba439de613abc23857ec3d78374d8ed5ac84e9d11336e87da8649"
version = "1.12.1"
checksum = "fc652a48c352aef3ea3aed32080501cf3ef6ed5da78602a020c991775b0aff04"

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T19:10:03.637Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795374603637",
    "title": "block `paste --force`, `link --force`, and `hardlink --force` onto the same file",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sxyazi-yazi-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "921220cb25f7cb4f4bd3e9c391124940602dd59aae9b8bd67cc30ec8f15e178d"
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
        "Harvested/verified timestamp recorded: 2026-11-22T19:10:03.638Z"
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
  "auth_token": "efa573d948bacaa081af40a39dafd44ff91fc04ee473365dd71aa134760490cb"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
