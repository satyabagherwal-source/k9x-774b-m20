# Candidate Directive: [CD-NONB] dispatch helper taps and keys without the global animation wait

<!-- PROVENANCE_START
{
  "source_repository": "callstack/agent-device",
  "source_url": "https://github.com/callstack/agent-device",
  "source_version": "655ede27",
  "license": "MIT",
  "timestamp": "2026-11-18T01:18:53.831Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-callstack-agent-device",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack/agent-device](https://github.com/callstack/agent-device) (Revision: `655ede27`).  
> **License**: MIT | **Timestamp**: `2026-11-18T01:18:53.831Z`  
> **Learning ID**: `learn-github-callstack-agent-device`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `android/snapshot-helper/src/main/java/com/callstack/agentdevice/snapshothelper/AutomationCommandHandler.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c0ef6b24`: android): dispatch helper taps and keys without the global animation wait. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `android/snapshot-helper/src/main/java/com/callstack/agentdevice/snapshothelper/AutomationCommandHandler.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  /**
   * The budget of a host that sends none: a provider-supplied helper can be newer than its host, and
   * an older host waits 30 s for input, less the 5 s answer margin. It never affords a retry.
   */
  private static final long OLDER_HOST_BUDGET_MS = 25_000;

  /** The framework's accessibility interaction timeout, AccessibilityInteractionClient. */
  private static final long TEXT_ENTRY_RESERVE_MS = 5_000;

  /** The command deadline left too little time for the next step, so it was not started. */
  static final class InputBudgetExhausted extends IllegalStateException {
    InputBudgetExhausted(String message) {
      super(message);
    }
  }

  /** Refuses text entry the deadline cannot fit, after a focus tap that may have used the budget. */
  static void requireTextEntryTime(long deadline, long now) {
    if (deadline - now < TEXT_ENTRY_RESERVE_MS) {
      throw new InputBudgetExhausted("Fill text was not entered: too little time left after focus");
    }
  }

    // The host's remaining time for this command bounds every retry decision.
    long deadline =
        SystemClock.uptimeMillis() + input.optLong("budgetMs", OLDER_HOST_BUDGET_MS);
        tap(automation, i
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
        tap(automation, input.getDouble("x"), input.getDouble("y"), dispatch);
        key(automation, input.getInt("keyCode"), dispatch);
        fill(automation, input.getInt("x"), input.getInt("y"), input.getString("text"), dispatch);
  private static void tap(UiAutomation automation, double x, double y, InputDispatch dispatch) {
    long down = SystemClock.uptimeMillis();
    touch(automation, down, MotionEvent.ACTION_DOWN, (float) x, (float) y, dispatch);
    touch(automation, down, MotionEvent.ACTION_UP, (float) x, (float) y, dispatch);
  private static void touch(UiAutomation automation, long down, int action, float x, float y, InputDispatch dispatch) {
    MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0);
    event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
    try {
      dispatch.attempted = true;
      if (!automation.injectInputEvent(event, true)) {
        throw new IllegalStateException("Touch injection was refused");
      }
    } finally {
      event.recycle();
  private static void key(UiAutomation automation, int code, InputDispatch dispatch) {
    if (code < 0 || code > KeyEvent.getMaxKeyCode()) throw new IllegalArgumentE
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c0ef6b24` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T01:18:53.829Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794964733829",
    "title": "dispatch helper taps and keys without the global animation wait",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "callstack/agent-device",
    "source_uri": "https://github.com/callstack/agent-device",
    "source_version": "HEAD",
    "content_hash": "fa6232b5c5631cab9713937135fb2f014f3000cc8a9a6e429f6a14d49cc3eca1"
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
        "Harvested/verified timestamp recorded: 2026-11-18T01:18:53.829Z"
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
  "auth_token": "4924eba7e0eb33fbe0103dc3562bea8867eaed94c95529f8f37a04c9ad1f0da4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
