# Candidate Directive: [CD-Q4JZ] (bug) Let an API dictation start replace a feedback banner

<!-- PROVENANCE_START
{
  "source_repository": "TypeWhisper/typewhisper-mac",
  "source_url": "https://github.com/TypeWhisper/typewhisper-mac",
  "source_version": "5162fe87",
  "license": "GPL-3.0",
  "timestamp": "2026-11-21T00:43:49.007Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-typewhisper-typewhisper-mac",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [TypeWhisper/typewhisper-mac](https://github.com/TypeWhisper/typewhisper-mac) (Revision: `5162fe87`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-21T00:43:49.007Z`  
> **Learning ID**: `learn-github-typewhisper-typewhisper-mac`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain M

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `TypeWhisper/ViewModels/DictationViewModel.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TypeWhisper/typewhisper-mac. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9e9d0620`: (bug) Let an API dictation start replace a feedback banner. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `TypeWhisper/ViewModels/DictationViewModel.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        // A queued hotkey start runs first, even after the reset has already set the state to
        // idle, so an API start cannot drop it and its workflow.
        HistoryRetranscriptionActivity.recordID == nil
            && pendingHotkeyDictationStart == nil
            && (state == .idle || canReplaceUndeliveredTranscriptOffer || canDismissActionFeedback)
        // A new API dictation replaces a passive feedback banner, such as "No speech
        // recognized", as the dictation hotkey does (#1959).
        if canReplaceUndeliveredTranscriptOffer || canDismissActionFeedback {
            if state == .inserting {
                resetDictationState()
            }
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        HistoryRetranscriptionActivity.recordID == nil && (state == .idle || canReplaceUndeliveredTranscriptOffer)
        if canReplaceUndeliveredTranscriptOffer {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9e9d0620` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:43:49.005Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795221829005",
    "title": "(bug) Let an API dictation start replace a feedback banner",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "TypeWhisper/typewhisper-mac",
    "source_uri": "https://github.com/TypeWhisper/typewhisper-mac",
    "source_version": "HEAD",
    "content_hash": "f5f2e0f8970f7f0c69db5484e2963db282a1f4aa56bcca00b0fd1524f8a39517"
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:43:49.005Z"
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
  "auth_token": "6210093e14c1d2d72a1ecb30fd0342e87a0efaff54e7cbb5bc8a4d271ad780a3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
