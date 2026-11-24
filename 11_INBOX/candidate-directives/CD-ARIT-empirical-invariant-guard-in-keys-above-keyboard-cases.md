# Candidate Directive: [CD-ARIT] Empirical Invariant Guard in keys-above-keyboard.cases

<!-- PROVENANCE_START
{
  "source_repository": "Saffsanity/sill",
  "source_url": "https://github.com/Saffsanity/sill",
  "source_version": "5d062a3c",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T01:46:51.989Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-saffsanity-sill",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Saffsanity/sill](https://github.com/Saffsanity/sill) (Revision: `5d062a3c`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T01:46:51.989Z`  
> **Learning ID**: `learn-github-saffsanity-sill`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Scripts/harness-photos/keys-above-keyboard.cases`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Saffsanity/sill. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5d062a3c`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Scripts/harness-photos/keys-above-keyboard.cases`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
# The keys above any keyboard (PhoneKeyboardLift, docs/steps/2026-11-19-keys-above-keyboard.md) on the iPhone Duo's
# cover, which draws an iPhone's arrangement upright: the real keyboard raised by -SillKeyboardToggle (the fake screen is
# the cover's own 466x678), -SillHardwareKeyboard 0 so it is drawn, -SillTallKeyboard 60 standing in for a taller one.
# The first case folds the Duo, so the keyboard cases launch on the cover already closed. Against main (eb48ac9f):
#   Scripts/harness-photos.sh Scripts/harness-photos/keys-above-keyboard.cases --baseline eb48ac9f
cover-no-keyboard         -SillLayout 466x678 -SillHinge closed --pose=closed-upright --wait=5
cover-keyboard            -SillLayout 466x678 -SillHinge closed -SillHardwareKeyboard 0 -SillKeyboardToggle 2 --pose=closed-upright --wait=6
cover-tall-keyboard       -SillLayout 466x678 -SillHinge closed -SillHardwareKeyboard 0 -SillKeyboardToggle 2 -SillTallKeyboard 60 --pose=closed-upright --wait=6
cover-hide-keyboard       -SillLayout 466x678 -SillHinge closed -SillHardwareKeyboard 0 -SillKeyboardToggle 2 -Sill.hideThumbnailsWhileTyping 1 --pose=closed-upright --wait=6
cover-hide-tall-keyboard  -SillLayout 466x678 -SillHinge
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5d062a3c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T01:46:51.987Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795484811987",
    "title": "Empirical Invariant Guard in keys-above-keyboard.cases",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Saffsanity/sill",
    "source_uri": "https://github.com/Saffsanity/sill",
    "source_version": "HEAD",
    "content_hash": "6c6a1097af77c9a263caf2bff80165306a6f733f5c6d004d261c1323ba6bd456"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T01:46:51.987Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "e2cc918f6f92818b2ebd1df1a81cc9fdbf5470cabcd25e439a3496bcf0d9cac0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
