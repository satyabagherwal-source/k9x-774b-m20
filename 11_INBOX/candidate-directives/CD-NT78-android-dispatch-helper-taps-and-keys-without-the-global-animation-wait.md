# Candidate Directive: [CD-NT78] android): dispatch helper taps and keys without the global animation wait

<!-- PROVENANCE_START
{
  "source_repository": "callstack-agent-device-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T01:18:59.622Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-callstack-agent-device-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack-agent-device-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T01:18:59.622Z`  
> **Learning ID**: `LEARN-EVO-callstack-agent-device-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T01:18:59.728Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794964739727",
    "title": "android): dispatch helper taps and keys without the global animation wait",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "callstack-agent-device-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d256db2158be19132f6d4fedfcaa00647a0cd02522a99acb6ad372def8dc1aa8"
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
        "Harvested/verified timestamp recorded: 2026-11-18T01:18:59.728Z"
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
  "auth_token": "82f01c4084ab06a4f610e85637bc40d9c0b14c7de130c29060f9b9718df37a55"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
