# Candidate Directive: [CD-WLLA] iOS): follow the gesture in interactive fade and fade_from_bottom pops

<!-- PROVENANCE_START
{
  "source_repository": "software-mansion-react-native-screens-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T03:58:07.349Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-software-mansion-react-native-screens-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [software-mansion-react-native-screens-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T03:58:07.349Z`  
> **Learning ID**: `LEARN-EVO-software-mansion-react-native-screens-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `ios/legacy/RNSScreenStackAnimator.mm`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in software-mansion/react-native-screens. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `54c55f6c`: iOS): follow the gesture in interactive fade and fade_from_bottom pops. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `ios/legacy/RNSScreenStackAnimator.mm`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:

    void (^animationBlock)(void) = ^{
      fromViewController.view.alpha = 0.0;
    };
    void (^completionBlock)(UIViewAnimatingPosition) = ^(UIViewAnimatingPosition finalPosition) {
    };

    if (!transitionContext.isInteractive) {
      auto animator = [[UIViewPropertyAnimator alloc] initWithDuration:[self transitionDuration:transitionContext]
                                                                 curve:UIViewAnimationCurveEaseInOut
                                                            animations:animationBlock];
      [animator addCompletion:completionBlock];
      _inFlightAnimator = animator;
      [animator startAnimation];
    } else {
      auto animator = [[UIViewPropertyAnimator alloc] initWithDuration:[self transitionDuration:transitionContext]
                                                                 curve:UIViewAnimationCurveLinear
                                                            animations:animationBlock];
      [animator addCompletion:completionBlock];
      _inFlightAnimator = animator;
    }
    void (^slideAnimationBlock)(void) = ^{
      toViewController.view.transform = CGAffineTransformIdentity;
      fromViewController.v
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    auto animator = [[UIViewPropertyAnimator alloc] initWithDuration:[self transitionDuration:transitionContext]
                                                               curve:UIViewAnimationCurveEaseInOut
                                                          animations:^{
                                                            fromViewController.view.alpha = 0.0;
                                                          }];
    [animator addCompletion:^(UIViewAnimatingPosition finalPosition) {
    }];

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:58:07.437Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794887887437",
    "title": "iOS): follow the gesture in interactive fade and fade_from_bottom pops",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "software-mansion-react-native-screens-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "dac7ab1fbc3dd940c26bbdbea9ba90ddee3df41bb37116061c40a7044eb48018"
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:58:07.437Z"
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
  "auth_token": "3a9e9c978c76814d0c7071c943256fda7dd5dbf235589418fea92d2c721c3a37"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
