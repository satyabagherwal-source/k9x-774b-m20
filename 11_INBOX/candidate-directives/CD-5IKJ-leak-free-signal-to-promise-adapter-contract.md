# Candidate Directive: [CD-5IKJ] Leak-Free Signal-to-Promise Adapter Contract

<!-- PROVENANCE_START
{
  "source_repository": "dubzzz-fast-check-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:44:59.427Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dubzzz-fast-check-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dubzzz-fast-check-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:44:59.427Z`  
> **Learning ID**: `LEARN-EVO-dubzzz-fast-check-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Whenever an `AbortSignal` is adapted into a Promise (for racing or notification), the adapter MUST explicitly remove its `abort` event listener when cleared or resolved, and MUST extract the `signal.reason` directly.

**WHY**:
Attaching event listeners to long-lived `AbortSignal` instances without guaranteed unsubscription causes unbounded heap leaks. In property-based testing where thousands of predicates execute against shared or chained signals, failure to deregister listeners retains the entire execution context closure in memory, eventually exhausting the Node.js/V8 heap.

**WHEN TO APPLY**:
Apply to all promise-signal bridging, timeout races, stream cancellations, and context deadline implementations.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function signalAsPromise(signal: AbortSignal): {
  promise: Promise<{ error: unknown }>;
  clear: () => void;
} {
  let onAbort: () => void = () => {};
  const promise = new Promise<{ error: unknown }>((resolve) => {
    onAbort = () => {
      const reason = signal.reason;
      resolve({ error: reason });
      signal.removeEventListener('abort', onAbort);
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });

  return {
    promise,
    clear: () => signal.removeEventListener('abort', onAbort),
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Creating Promise without exposing unhook/clear capability
function leakySignalPromise(signal: AbortSignal) {
  return new Promise((resolve) => {
    // If signal does not abort, this closure retains outer references indefinitely
    signal.addEventListener('abort', () => resolve(signal.reason));
  });
}
```

**VERIFICATION METHOD**:
Execute 10,000 iterations of signal conversion and clearance under test; assert that the listener count on the signal remains zero (`expect(signal.listenerCount?.('abort') ?? 0).toBe(0)`).

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:44:59.587Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794905099587",
    "title": "Leak-Free Signal-to-Promise Adapter Contract",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dubzzz-fast-check-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "22d5f5a9935a388f61aa12bece81de880f2c97bf855690a16d7ffeaaea1f5a05"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:44:59.587Z"
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
  "auth_token": "6d8983e3073f4e62f6cc2a031bc14a12d1b1953467914228de325690a7f510d1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
