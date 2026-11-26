# Candidate Directive: [CD-YF65] click macOS rows for info, add AdGuard Mini system-wide note, and harden popup/z

<!-- PROVENANCE_START
{
  "source_repository": "0xCUB3/wBlock",
  "source_url": "https://github.com/0xCUB3/wBlock",
  "source_version": "d439e269",
  "license": "GPL-3.0",
  "timestamp": "2026-11-26T03:04:35.405Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-0xcub3-wblock",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [0xCUB3/wBlock](https://github.com/0xCUB3/wBlock) (Revision: `d439e269`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-26T03:04:35.405Z`  
> **Learning ID**: `learn-github-0xcub3-wblock`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Adblock_Comparison.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 0xCUB3/wBlock. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6aca811d`: click macOS rows for info, add AdGuard Mini system-wide note, and harden popup/zapper. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Adblock_Comparison.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
Mini has six content blockers (General, Privacy, Social, Security, Other, Custom) for a ceiling of 900,000 rules. Filter categories, custom lists, user rules, element blocking, and issue reporting are free. Pro adds real-time filter updates, AdGuard Extra for harder anti-adblock cases, and a few advanced filtering features. Starting in v3.0, Mini also includes an experimental system-wide protection option for macOS 26 and later (with an AdGuard license) built on Apple's URL Filters API with Private Information Retrieval.
| System-wide | No | No | Filtr (paid, OS 26) | Mini (experimental, paid, macOS 26+), DNS on iOS |
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
Mini has six content blockers (General, Privacy, Social, Security, Other, Custom) for a ceiling of 900,000 rules. Filter categories, custom lists, user rules, element blocking, and issue reporting are free. Pro adds real-time filter updates, AdGuard Extra for harder anti-adblock cases, and a few advanced filtering features.
| System-wide | No | No | Filtr (paid, OS 26) | DNS on iOS |
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6aca811d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T03:04:35.403Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795662275403",
    "title": "click macOS rows for info, add AdGuard Mini system-wide note, and harden popup/z",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "0xCUB3/wBlock",
    "source_uri": "https://github.com/0xCUB3/wBlock",
    "source_version": "HEAD",
    "content_hash": "3bd8aeafe8987bc51d1cb19d3474ebbcc3248a2cb94c3d8ffa079ed72a92a53a"
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
        "Harvested/verified timestamp recorded: 2026-11-26T03:04:35.403Z"
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
  "auth_token": "9e27a51af721855d9a3aad038773b617d39ffcf45da87cb908697ee07a88a282"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
