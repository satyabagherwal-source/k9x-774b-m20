# Candidate Directive: [CD-50OZ] Invariant Subtraction of Multi-Axis Box Constraints Under Loose Nullability

<!-- PROVENANCE_START
{
  "source_repository": "shoutem-ui-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T01:04:22.874Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-shoutem-ui-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [shoutem-ui-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T01:04:22.874Z`  
> **Learning ID**: `LEARN-EVO-shoutem-ui-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T01:04:22.977Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794963862977",
    "title": "Invariant Subtraction of Multi-Axis Box Constraints Under Loose Nullability",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "shoutem-ui-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "70ea0eda511e997533ae35fb0ff87d855bb8d2e85f31d25bdbb934eaae56c815"
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
        "Harvested/verified timestamp recorded: 2026-11-18T01:04:22.977Z"
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
  "auth_token": "fa7136c6cbcbe605fb6e5ad318fa093db2c6f2bf627edba9387b62cd63428b57"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
