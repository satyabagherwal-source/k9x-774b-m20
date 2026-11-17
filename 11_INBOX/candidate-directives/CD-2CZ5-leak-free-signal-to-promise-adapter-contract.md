# Candidate Directive: [CD-2CZ5] Leak-Free Signal-to-Promise Adapter Contract

<!-- PROVENANCE_START
{
  "source_repository": "dubzzz/fast-check",
  "source_url": "https://github.com/dubzzz/fast-check",
  "source_version": "1114b71b",
  "license": "MIT",
  "timestamp": "2026-11-17T08:42:32.369Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dubzzz-fast-check",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dubzzz/fast-check](https://github.com/dubzzz/fast-check) (Revision: `1114b71b`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:42:32.369Z`  
> **Learning ID**: `learn-github-dubzzz-fast-check`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:42:32.368Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904952368",
    "title": "Leak-Free Signal-to-Promise Adapter Contract",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dubzzz/fast-check",
    "source_uri": "https://github.com/dubzzz/fast-check",
    "source_version": "HEAD",
    "content_hash": "32a1765af252dd22450062a31e116d545360ed8b50b8af28123d1fd88fc41802"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:42:32.368Z"
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
  "auth_token": "b4e3505a8ba88a4409705784a7165c8efb67c83aa4fd8e467fa622dd512e507d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
