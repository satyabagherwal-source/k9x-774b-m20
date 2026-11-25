# Candidate Directive: [CD-DD4X] [MOD-20693] Stop the query pipeline on memory pressure

<!-- PROVENANCE_START
{
  "source_repository": "redisearch-redisearch-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T12:20:24.710Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-redisearch-redisearch-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [redisearch-redisearch-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T12:20:24.710Z`  
> **Learning ID**: `LEARN-EVO-redisearch-redisearch-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/aggregate/aggregate_exec.c`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RediSearch/RediSearch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7a24743f`: [MOD-20693] Stop the query pipeline on memory pressure. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/aggregate/aggregate_exec.c`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#include "query_memory.h"
  QueryError *err = AREQ_QueryProcessingCtx(req)->err;
  // A buffering stage that kept its rows past an OOM stop may hold enough of them to fill the
  // reply's limit or a pager's, so the reply ends without reading the stop's RS_RESULT_STOPPED.
  // When no later cursor read reports the stop, the reply is cut.
  const bool lastReply =
      rc == RS_RESULT_EOF || (rc == RS_RESULT_OK && !(AREQ_RequestFlags(req) & QEXEC_F_IS_CURSOR));
  // A blocked-client timeout that fired in the meantime owns the reply, as in ApplyOomStop.
  if (lastReply && req->base.reqConfig.oomPolicy != OomPolicy_Fail &&
      AREQ_QueryProcessingCtx(req)->oomCut &&
      !QueryRequestLimits_IsBlockedClientTimedOut(&req->base.limits)) {
    QueryError_SetQueryOOMWarning(err);
  }
  return ApplyOomStop(&req->base.limits, req->base.reqConfig.oomPolicy, err, rc);
        // A memory stop ends the request even when its outcome is reported as a timeout.
        return QueryRequestLimits_IsMemoryStopped(&req->base.limits);
// Memory checkpoint once the query is built, which also covers the wait for a worker. FT.EXPLAIN
// builds a plan it never runs, so it is exempt.
static int checkBuild
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  return ApplyOomStop(&req->base.limits, req->base.reqConfig.oomPolicy,
                      AREQ_QueryProcessingCtx(req)->err, rc);
        return false;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7a24743f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T12:20:24.895Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795609224895",
    "title": "[MOD-20693] Stop the query pipeline on memory pressure",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "redisearch-redisearch-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a48b1ddae987554f32f3942b4f17fd9f51823bb5efc460850fe78dd3c17ed4dc"
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
        "Harvested/verified timestamp recorded: 2026-11-25T12:20:24.896Z"
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
  "auth_token": "396844a4d7969cd8c4e165622b0691d80b2660a0b9b706785beee72114e74554"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
