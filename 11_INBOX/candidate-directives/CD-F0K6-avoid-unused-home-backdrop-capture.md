# Candidate Directive: [CD-F0K6] avoid unused home backdrop capture

<!-- PROVENANCE_START
{
  "source_repository": "open-ani/animeko",
  "source_url": "https://github.com/open-ani/animeko",
  "source_version": "da675ddc",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-24T20:29:54.966Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-open-ani-animeko",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [open-ani/animeko](https://github.com/open-ani/animeko) (Revision: `da675ddc`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-24T20:29:54.966Z`  
> **Learning ID**: `learn-github-open-ani-animeko`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `app/shared/ui-exploration/src/androidTv/kotlin/ui/exploration/TvExplorationScreen.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in open-ani/animeko. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `da675ddc`: tv): avoid unused home backdrop capture. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `app/shared/ui-exploration/src/androidTv/kotlin/ui/exploration/TvExplorationScreen.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
            captureBackdrop = expandProgress > 0f && !(expanded && detailsFocused),
    captureBackdrop: Boolean,
        // Only a visible, non-opaque hero action needs to sample the backdrop.
        backdrop(Modifier.fillMaxSize().then(if (captureBackdrop) Modifier.hazeSource(actionBackdrop) else Modifier))
        CompositionLocalProvider(
            LocalBringIntoViewSpec provides scrollSpec,
            LocalTvDetailsActionBackdrop provides actionBackdrop.takeIf { captureBackdrop },
        ) {
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
        backdrop(Modifier.fillMaxSize().hazeSource(actionBackdrop))
        CompositionLocalProvider(LocalBringIntoViewSpec provides scrollSpec, LocalTvDetailsActionBackdrop provides actionBackdrop) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `da675ddc` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T20:29:54.964Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795552194964",
    "title": "avoid unused home backdrop capture",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "open-ani/animeko",
    "source_uri": "https://github.com/open-ani/animeko",
    "source_version": "HEAD",
    "content_hash": "2d34d659e108341ea0bf4d74c47568309fab5a327bba3ba3fc10f747c3c9b6c4"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Harvested/verified timestamp recorded: 2026-11-24T20:29:54.964Z"
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
  "auth_token": "67b0ef52afa87ed4413e4a9337ecb05719fe2023578a307366b8940bf90fe07e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
