# Candidate Directive: [CD-JCAZ] Attempt-Guarded Token Monotonicity for Asynchronous UI Actions

<!-- PROVENANCE_START
{
  "source_repository": "MelnixDev/seo-crawl-audit",
  "source_url": "https://github.com/MelnixDev/seo-crawl-audit",
  "source_version": "abed0505",
  "license": "MIT",
  "timestamp": "2026-11-15T08:52:24.203Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-melnixdev-seo-crawl-audit",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [MelnixDev/seo-crawl-audit](https://github.com/MelnixDev/seo-crawl-audit) (Revision: `abed0505`).  
> **License**: MIT | **Timestamp**: `2026-11-15T08:52:24.203Z`  
> **Learning ID**: `learn-github-melnixdev-seo-crawl-audit`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Any asynchronous UI feedback operation (e.g., clipboard copy, network validation, background dispatch) that mutates DOM element states and sets automatic reversal timers (e.g., `setTimeout`) MUST register a monotonically increasing integer attempt counter (`currentAttempt = ++attempt`) before awaiting the promise, and MUST guard both the success resolution and the catch block by checking `if (currentAttempt !== attempt) return;` while cancelling any active `resetTimer`.

**WHY**:
Rapid consecutive triggers (e.g., double-clicking a "Copy" button) cause multiple overlapping asynchronous execution frames. If an earlier slow promise resolves *after* a later invocation has already started, or if an older `setTimeout` fires while a newer action is active, the UI enters a race condition: text flickers, error messages overwrite success states, and the element resets prematurely.

**WHEN TO APPLY**:
Apply to all client-side UI buttons, notification banners, copy triggers, and input-validation states that feature asynchronous promises followed by timed visual resets.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
export function attachAsyncActionWithFeedback(buttonElement, statusElement, asyncWorkFn) {
  const originalLabel = buttonElement.textContent;
  let resetTimer;
  let attempt = 0;

  const resetButton = () => {
    clearTimeout(resetTimer);
    buttonElement.textContent = originalLabel;
    buttonElement.classList.remove("action-success");
  };

  buttonElement.addEventListener("click", async () => {
    const currentAttempt = ++attempt;
    resetButton();

    try {
      await asyncWorkFn();
      // Guard against stale asynchronous resolution
      if (currentAttempt !== attempt) return;

      buttonElement.textContent = "Success!";
      buttonElement.classList.add("action-success");
      statusElement.textContent = "";

      resetTimer = setTimeout(resetButton, 2500);
    } catch (err) {
      // Guard against stale error overwriting newer invocation
      if (currentAttempt !== attempt) return;

      resetButton();
      statusElement.textContent = "Operation failed. Please retry manually.";
    }
  });
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// CRITICAL ANTI-PATTERN: Unprotected async DOM mutation with unmanaged timers
button.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied!"; // Stale click will overwrite active state
    setTimeout(() => {
      button.textContent = "Copy"; // Older timer resets newer copy attempt early
    }, 2500);
  } catch {
    button.textContent = "Error";
  }
});
```

**VERIFICATION METHOD**:
Simulate double-click concurrency in headless tests (`node:test` + VM/JSDOM): dispatch two click events 50ms apart where the first clipboard promise resolves in 200ms and the second in 100ms. Assert that the button remains in the `Success!` state for exactly 2500ms after the second click, with zero label flickering or premature resets.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:52:24.202Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794732744202",
    "title": "Attempt-Guarded Token Monotonicity for Asynchronous UI Actions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "MelnixDev/seo-crawl-audit",
    "source_uri": "https://github.com/MelnixDev/seo-crawl-audit",
    "source_version": "HEAD",
    "content_hash": "0b72f7f154bc8d298a9f3648abfefae182609de4650063349c45949bfe65c128"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:52:24.202Z"
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
  "auth_token": "d8fd9fdd7369ca1e40f4f293db359dba3b9d470c280c511185bed1fb4ff11d05"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
