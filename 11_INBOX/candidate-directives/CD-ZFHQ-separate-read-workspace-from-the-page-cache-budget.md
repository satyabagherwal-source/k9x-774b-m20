# Candidate Directive: [CD-ZFHQ] separate read workspace from the page cache budget

<!-- PROVENANCE_START
{
  "source_repository": "alibaba/zvec",
  "source_url": "https://github.com/alibaba/zvec",
  "source_version": "2b1e274d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T13:36:54.062Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-alibaba-zvec",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [alibaba/zvec](https://github.com/alibaba/zvec) (Revision: `2b1e274d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T13:36:54.062Z`  
> **Learning ID**: `learn-github-alibaba-zvec`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/ailego/buffer/block_eviction_queue.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alibaba/zvec. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2b1e274d`: diskann): separate read workspace from the page cache budget. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/ailego/buffer/block_eviction_queue.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    try {
      LOG_ERROR("invalid eviction priority: %d", queue_index);
    } catch (...) {
      // A diagnostic must not interrupt the caller's queue recovery.
    }
    // Queue admission failed under memory pressure. Return that failure
    // without allocating again to log it.
    try {
      LOG_ERROR("MemoryLimitPool: failed to reserve an aligned slab");
    } catch (...) {
      // The caller must still cancel its payload reservation.
    }
  bool backing_reserved = false;
  bool attempted_backing = true;
  const auto rollback = ScopeGuard::Make([&] {
    if (buffer) return;
    if (backing_reserved) {
      cancel_buffer_reservation(buffer_size, attempted_backing);
    } else {
      release_buffer(nullptr, buffer_size);
    }
  });
  backing_reserved = true;
  attempted_backing = allocation.attempted_backing;
  if (!buffer) return false;
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    LOG_ERROR("invalid eviction priority: %d", queue_index);
    LOG_DEBUG("Eviction queue enqueue rejected under allocation pressure.");
    LOG_ERROR("MemoryLimitPool: failed to reserve an aligned slab");
      release_buffer(nullptr, buffer_size);
  if (!buffer) {
    cancel_buffer_reservation(buffer_size, allocation.attempted_backing);
    return false;
  }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2b1e274d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T13:36:54.060Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795786614060",
    "title": "separate read workspace from the page cache budget",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "alibaba/zvec",
    "source_uri": "https://github.com/alibaba/zvec",
    "source_version": "HEAD",
    "content_hash": "a95e416328572229dca3063c664566707ff63a3c07a6ffeb6bcd45de75389f12"
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
        "Harvested/verified timestamp recorded: 2026-11-27T13:36:54.060Z"
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
  "auth_token": "56bd19137e820a9d8ae878faab50da50ece13dfe502cd613dbe255c59b7beda5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
