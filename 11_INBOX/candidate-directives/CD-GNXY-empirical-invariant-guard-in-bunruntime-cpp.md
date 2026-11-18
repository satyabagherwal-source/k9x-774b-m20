# Candidate Directive: [CD-GNXY] Empirical Invariant Guard in BunRuntime.cpp

<!-- PROVENANCE_START
{
  "source_repository": "onejs/one",
  "source_url": "https://github.com/onejs/one",
  "source_version": "aaba81ee",
  "license": "NOASSERTION",
  "timestamp": "2026-11-18T04:57:23.254Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-onejs-one",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [onejs/one](https://github.com/onejs/one) (Revision: `aaba81ee`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-18T04:57:23.254Z`  
> **Learning ID**: `learn-github-onejs-one`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/vxrn/ios/OneBunEngine/BunRuntime.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in onejs/one. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `855a28f7`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/vxrn/ios/OneBunEngine/BunRuntime.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
#include <vector>
// JSValueUnprotect takes the JS lock, and JSC scans the stack of every thread
// that ever took it on each GC. a value dropped on the main thread registers it,
// and the main thread later runs hermes (worklets) compiles on a fiber stack
// outside its registered bounds, so the scan faults. only the JS thread unprotects.
struct Releases {
  std::atomic<bool> invalid{false};
  // the runtime is created on the JS thread
  const std::thread::id owner = std::this_thread::get_id();
  std::mutex mutex;
  std::vector<JSValueRef> pending;

  void release(JSGlobalContextRef ctx, JSValueRef value) {
    if (invalid) {
      return;
    }
    if (owner == std::this_thread::get_id()) {
      JSValueUnprotect(ctx, value);
      return;
    }
    std::lock_guard<std::mutex> lock(mutex);
    pending.push_back(value);
  }

  // runs on the JS thread outside any GC
  void drain(JSGlobalContextRef ctx) {
    std::vector<JSValueRef> values;
    {
      std::lock_guard<std::mutex> lock(mutex);
      values.swap(pending);
    }
    for (JSValueRef value : values) {
      JSValueUnprotect(ctx, value);
    }
  }
};

        Releases& releases,
        Releases& releases,
    Releases& 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
        const std::atomic<bool>& ctxInvalid,
        const std::atomic<bool>& ctxInvalid,
    const std::atomic<bool>& ctxInvalid_;
        const std::atomic<bool>& ctxInvalid,
    const std::atomic<bool>& ctxInvalid_;
  std::atomic<bool> ctxInvalid_;
    : ctx_(JSGlobalContextRetain(ctx)),
      ctxInvalid_(false)
  ctxInvalid_ = true;
    const std::atomic<bool>& ctxInvalid,
      ctxInvalid_(ctxInvalid),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `855a28f7` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T04:57:23.253Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794977843253",
    "title": "Empirical Invariant Guard in BunRuntime.cpp",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "onejs/one",
    "source_uri": "https://github.com/onejs/one",
    "source_version": "HEAD",
    "content_hash": "b54e4256d539807fc91d7983455ce46666bd2179b0fdefba8de5a007fc229486"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T04:57:23.253Z"
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
  "auth_token": "57f243b3c0bdc32bb706af8a01cd3961764f4daebaccf2d5018b781b137067ab"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
