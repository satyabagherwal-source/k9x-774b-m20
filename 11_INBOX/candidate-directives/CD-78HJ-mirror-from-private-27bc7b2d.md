# Candidate Directive: [CD-78HJ] Mirror from private (27bc7b2d)

<!-- PROVENANCE_START
{
  "source_repository": "darrylmorley-whatcable-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T18:00:33.383Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-darrylmorley-whatcable-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [darrylmorley-whatcable-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T18:00:33.383Z`  
> **Learning ID**: `LEARN-EVO-darrylmorley-whatcable-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Sources/WhatCableCore/Display/DisplayDiagnostic.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in darrylmorley/whatcable. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0a49393d`: Mirror from private (27bc7b2d). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/WhatCableCore/Display/DisplayDiagnostic.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        /// it: the top-ranked entry in the EDID's declared list (highest
        /// active pixel rate: `EDIDInfo.isHigherPriority`), or the
        /// mode's refresh with another mode's resolution: a panel's highest
        /// refresh and its largest picture are often different modes (the
        /// Samsung Odyssey G60SD runs 240 Hz only at 1920x1080 and has no
        /// 2560x1440@240 mode to label). nil exactly when
    /// chain (picture pixel rate, area, refresh, clock, then list order), admitting the
    ///    own chain (picture pixel rate, area, refresh, clock, list order) over the same
    ///    that entry unless the candidate outranks it on the same chain, so a
            if !EDIDInfo.isHigherPriority(panelTop, than: matched) { return TopMode(declared: matched) }
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        /// it: the highest-clock entry in the EDID's declared list, or the
        /// mode's refresh with another mode's resolution. `EDIDInfo.topMode`
        /// is max-by-pixel-clock, and a panel whose fastest timing is
        /// 1920x1080@240 while its preferred mode is 2560x1440 (Samsung
        /// Odyssey G60SD) has no 2560x1440@240 mode to label. nil exactly when
    /// chain (pixel clock, area, refresh, then list order), admitting the
    ///    own chain (pixel clock, area, refresh, list order) over the same
    ///    that entry when its pixel clock is at least the candidate's, so a
            if matched.pixelClockHz >= panelTop.pixelClockHz { return TopMode(declared: matched) }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0a49393d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T18:00:33.462Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795370433462",
    "title": "Mirror from private (27bc7b2d)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "darrylmorley-whatcable-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8e712ed825346e4a689e175e9e06316c7b3cc9f33a1fe803cdeead0ee5934c06"
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
        "Harvested/verified timestamp recorded: 2026-11-22T18:00:33.462Z"
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
  "auth_token": "c02898cc9572c63f553c1a7fffb447c4cbbb424bed336726961f4289a57c3130"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
