# Candidate Directive: [CD-NNX2] Grouped DOM Proxy Element Selection Invariant

<!-- PROVENANCE_START
{
  "source_repository": "react-hook-form/react-hook-form",
  "source_url": "https://github.com/react-hook-form/react-hook-form",
  "source_version": "66f4d72b",
  "license": "MIT",
  "timestamp": "2026-11-17T08:31:06.710Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-react-hook-form-react-hook-form",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form) (Revision: `66f4d72b`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:31:06.710Z`  
> **Learning ID**: `learn-github-react-hook-form-react-hook-form`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    }
  } else if (isFunction(rootRef.setCustomValidity)) {
    rootRef.setCustomValidity(validityMessage);
  }

  // Anchor the native validation popup to the active interactive element
  interactiveTarget.reportValidity();
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly assuming refs[0] can report validity.
// If option 0 is disabled, the browser drops reportValidity() on the floor.
// The form fails to submit, and the user receives zero visual feedback.
function badNativeValidation(refs: HTMLInputElement[], message: string) {
  refs.forEach(ref => ref.setCustomValidity(message));
  if (refs[0] && refs[0].reportValidity) {
    refs[0].reportValidity(); // FAILS silently if refs[0].disabled === true
  }
}
```

**VERIFICATION METHOD**:
Mount a radio group where index `0` has `disabled={true}` and index `1` is enabled. Trigger validation. Assert via DOM spies that `refs[1].reportValidity` was invoked once and `refs[0].reportValidity` was invoked zero times:
```typescript
const disabledRadio = screen.getByLabelText('Option A (Disabled)') as HTMLInputElement;
const enabledRadio = screen.getByLabelText('Option B') as HTMLInputElement;
const disabledSpy = jest.spyOn(disabledRadio, 'reportValidity');
const enabledSpy = jest.spyOn(enabledRadio, 'reportValidity');

fireEvent.click(screen.getByRole('button', { name: /submit/i }));

expect(disabledSpy).not.toHaveBeenCalled();
expect(enabledSpy).toHaveBeenCalledTimes(1);
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:31:06.708Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904266708",
    "title": "Grouped DOM Proxy Element Selection Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "react-hook-form/react-hook-form",
    "source_uri": "https://github.com/react-hook-form/react-hook-form",
    "source_version": "HEAD",
    "content_hash": "b9482bc49fd91c38ab0c71e65af319b649dd5e8382ade8ede1ddd0dd2511df9d"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:31:06.708Z"
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
  "auth_token": "4d8ac02f0f6ab118a4fd284b2a11868a6a127c5c28ea0ad8dd9e337c520507b9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
