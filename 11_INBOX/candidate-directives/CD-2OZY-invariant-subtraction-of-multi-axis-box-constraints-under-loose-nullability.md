# Candidate Directive: [CD-2OZY] Invariant Subtraction of Multi-Axis Box Constraints Under Loose Nullability

<!-- PROVENANCE_START
{
  "source_repository": "shoutem/ui",
  "source_url": "https://github.com/shoutem/ui",
  "source_version": "101f9805",
  "license": "NOASSERTION",
  "timestamp": "2026-11-18T01:02:34.510Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-shoutem-ui",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [shoutem/ui](https://github.com/shoutem/ui) (Revision: `101f9805`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-18T01:02:34.510Z`  
> **Learning ID**: `learn-github-shoutem-ui`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When resolving constrained boundary dimensions (such as `maxWidth`, `contentWidth`, or `clampedHeight`) from dynamic style contexts, you MUST extract and normalize all boundary properties against an explicit fallback object before arithmetic reduction, and you MUST subtract each bounding box component independently rather than chaining additive logic with short-circuit fallbacks (`||`).

**WHY**:
JavaScript's operator precedence evaluates addition (`+`) higher than logical OR (`||`). Chaining expressions like `style.container.paddingLeft || 0 + style.container.paddingRight || 0` leads to operator precedence bugs where zero values or undefined properties inadvertently coerce and concatenate or misapply fallback branches. Furthermore, referencing properties on nested paths like `style.container.paddingLeft` when `style.container` is undefined throws an immediate, unhandled `TypeError: Cannot read properties of undefined`.

**WHEN TO APPLY**:
Apply in all layout calculation functions, responsive container bounding computations, and CSS-in-JS style resolution transforms across React, React Native, and Web rendering engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
/**
 * Resolves maximum available inner width by subtracting all horizontal insets.
 * Guarantees zero-cost fallback when container style is absent or empty.
 *
 * @param {Object} [style] - The resolved component style container.
 * @param {Object} [style.container] - Inner container layout properties.
 * @param {number} [style.container.paddingLeft] - Left container padding.
 * @param {number} [style.container.paddingRight] - Right container padding.
 * @param {number} [style.outerPadding] - Cumulative padding of all parent ancestors.
 * @returns {number} The safe, non-negative maximum inner content width.
 */
export function resolveSafeMaxWidth(style = {}) {
  const { paddingLeft = 0, paddingRight = 0 } = style.container || {};
  const outerPadding = typeof style.outerPadding === 'number' ? style.outerPadding : 0;
  const windowWidth = Dimensions.get('window').width;

  const resolvedWidth = windowWidth - paddingLeft - paddingRight - outerPadding;
  return Math.max(0, resolvedWidth);
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Fails on precedence, crashes if style.container is undefined,
// and truncates 0 as falsy incorrectly in chained math.
export function resolveMaxWidthBroken(style) {
  const parentContainerPadding = style.outerPadding || 0;
  // Precedence bug: evaluates (0 + style.container.paddingRight) before ||
  // Crashes if style.container is null or undefined!
  const paddingValue =
    style.container.paddingLeft ||
    0 + style.container.paddingRight ||
    0 + parentContainerPadding;

  return Dimensions.get('window').width - paddingValue;
}
```

**VERIFICATION METHOD**:
Enforce deep-null property tests with Jest verifying that passing empty objects, undefined structures, and explicit zeros never results in `NaN`, negative widths, or uncaught `TypeErrors`:
```javascript
describe('resolveSafeMaxWidth Invariant Verification', () => {
  it('handles empty styles without throwing and evaluates precedence correctly', () => {
    expect(resolveSafeMaxWidth({})).toBe(Dimensions.get('window').width);
    expect(resolveSafeMaxWidth({ container: { paddingLeft: 10, paddingRight: 20 }, outerPadding: 5 }))
      .toBe(Dimensions.get('window').width - 35);
    expect(resolveSafeMaxWidth({ container: undefined, outerPadding: undefined }))
      .toBe(Dimensions.get('window').width);
  });
});
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T01:02:34.508Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794963754508",
    "title": "Invariant Subtraction of Multi-Axis Box Constraints Under Loose Nullability",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "shoutem/ui",
    "source_uri": "https://github.com/shoutem/ui",
    "source_version": "HEAD",
    "content_hash": "5f028171c428201d3cf92c0868ca378c41516ddd5b71c6df84699a93e27f05b3"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T01:02:34.508Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "abc1b0b3b23ad6e07a03c9432414f0c550c65ba4b3aa700c5ce819b4710fc8a8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
