# Candidate Directive: [CD-P751] Grouped DOM Proxy Element Selection Invariant

<!-- PROVENANCE_START
{
  "source_repository": "react-hook-form-react-hook-form-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:32:18.161Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-react-hook-form-react-hook-form-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react-hook-form-react-hook-form-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:32:18.161Z`  
> **Learning ID**: `LEARN-EVO-react-hook-form-react-hook-form-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When dispatching native DOM constraint validation APIs (`reportValidity()`, `checkValidity()`, `setCustomValidity()`) on a composite field group sharing a single registration identifier (e.g., `HTMLInputElement` groups for `type="radio"` or `type="checkbox"`), the runtime MUST NOT assume the primary ref (`refs[0]`) is eligible to anchor the native reporting bubble. The runtime MUST dynamically traverse the node collection to locate the first active element where `element.disabled === false` and `typeof element.reportValidity === 'function'`. If all members are disabled or non-functional, it MUST safely fall back to the root ref without throwing.

**WHY**:
Browsers immediately discard `reportValidity()` calls targeted at elements with the `disabled` attribute set to `true`, suppressing the browser's native error bubble. In radio groups where the first radio option is disabled by business logic (e.g., "Option 1 - Out of Stock (Disabled)"), calling `refs[0].reportValidity()` results in silent failure: native validation fails, form submission is blocked, yet no validation UI or tooltip is displayed to the user.

**WHEN TO APPLY**:
Any time a custom UI library or headless form manager wraps native HTML5 constraint validation across grouped multi-node inputs (`<input type="radio">`, `<input type="checkbox">`, custom form associations).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Safely executes native HTML5 constraint validation on single or grouped input nodes.
 * Guarantees that disabled radio/checkbox nodes do not suppress browser validity tooltips.
 */
export function executeNativeValidation(
  ref: HTMLInputElement | undefined,
  refs: HTMLInputElement[] | undefined,
  message?: string | boolean,
): void {
  const rootRef: HTMLInputElement | undefined = refs ? refs[0] : ref;
  if (!rootRef) {
    return;
  }

  // Defend against environments without standard DOM methods (e.g., SSR, JSDOM, React Native)
  const isFunction = (fn: unknown): fn is (...args: unknown[]) => unknown =>
    typeof fn === 'function';

  if (!isFunction(rootRef.reportValidity)) {
    return;
  }

  // INVARIANT: Native bubbles only anchor to enabled interactive elements.
  // Traverse grouped refs to find the first interactive target.
  const interactiveTarget =
    refs?.find(
      (node): node is HTMLInputElement =>
        !node.disabled && isFunction(node.reportValidity),
    ) || rootRef;

  const validityMessage = typeof message === 'boolean' ? '' : message || '';

  if (refs && refs.length > 0) {
    for (let i = 0; i < refs.length; i++) {
      const targetNode = refs[i];
      if (isFunction(targetNode.setCustomValidity)) {
        targetNode.setCustomValidity(validityMessage);
      }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:32:18.273Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904338273",
    "title": "Grouped DOM Proxy Element Selection Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "react-hook-form-react-hook-form-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5fcbb55ee482404e1175afe06c1fd80b4ef12c3bdb5be293ca504fe0ae2a560c"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T08:32:18.274Z"
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
  "auth_token": "f1d33fce168f88889b92880a92c98650a672f0a4517cec067c23a886256da2a7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
