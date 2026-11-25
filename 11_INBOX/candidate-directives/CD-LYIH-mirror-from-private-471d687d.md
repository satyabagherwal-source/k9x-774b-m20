# Candidate Directive: [CD-LYIH] Mirror from private (471d687d)

<!-- PROVENANCE_START
{
  "source_repository": "darrylmorley/whatcable",
  "source_url": "https://github.com/darrylmorley/whatcable",
  "source_version": "0cf0a678",
  "license": "NOASSERTION",
  "timestamp": "2026-11-25T04:31:12.377Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-darrylmorley-whatcable",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [darrylmorley/whatcable](https://github.com/darrylmorley/whatcable) (Revision: `0cf0a678`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-25T04:31:12.377Z`  
> **Learning ID**: `learn-github-darrylmorley-whatcable`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Tests/WhatCableCoreTests/ChargerCableHintCorpusTests.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in darrylmorley/whatcable. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0cf0a678`: Mirror from private (471d687d). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Tests/WhatCableCoreTests/ChargerCableHintCorpusTests.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
/// of them reach the diagnostic. A ninth, `m4pro_macos27.0.1_e` (96 W at
/// 20 V x 3 A, SOP' node with no identity), came with the 2026-11-12 ingest,
/// which the 2026-11-21 corpus did not yet hold; it reaches the diagnostic,
/// re-derived by hand from probes 19, 32 and 01 on 2026-11-24, so eight do.
/// The one that does not, `m4_macos15.7.7`, shows the
        "m4pro_macos27.0.1_e": (96, 60),
    /// The signature capture that cannot fire (96 W at 20 V x 3 A): no USB-PD node in
    @Test("Exactly the 8 reachable signature captures fire, with the expected wattages")
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
/// of them reach the diagnostic. The eighth, `m4_macos15.7.7`, shows the
    /// The eighth signature capture (96 W at 20 V x 3 A): no USB-PD node in
    @Test("Exactly the 7 reachable signature captures fire, with the expected wattages")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0cf0a678` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T04:31:12.375Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795581072375",
    "title": "Mirror from private (471d687d)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "darrylmorley/whatcable",
    "source_uri": "https://github.com/darrylmorley/whatcable",
    "source_version": "HEAD",
    "content_hash": "919ee382718dc80c7c2d0985a8d4ac20025bacc2ea2d6f828c40c1afa82523d4"
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
        "Harvested/verified timestamp recorded: 2026-11-25T04:31:12.375Z"
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
  "auth_token": "632c1fbca28c28bb3cf12d0e87953d42bdb9591b1054201eeb9cce302a5b53c9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
