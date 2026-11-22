# Candidate Directive: [CD-7Z3K] Solve AggregateScan parameters before entering a runtime.

<!-- PROVENANCE_START
{
  "source_repository": "paradedb-paradedb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T02:09:20.928Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-paradedb-paradedb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [paradedb-paradedb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T02:09:20.928Z`  
> **Learning ID**: `LEARN-EVO-paradedb-paradedb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `basescan/src/postgres/customscan/basescan/mod.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in paradedb/paradedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9e0eeecd`: Solve AggregateScan parameters before entering a runtime.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `basescan/src/postgres/customscan/basescan/mod.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    ///    Either the main backend running a serial path, a `parallel_safe` but not
    ///    `parallel_aware` scan inside a worker (e.g. the inner side of a Parallel Hash Join),
    ///    or a `parallel_aware` scan running locally on the leader when `es_use_parallel_mode`
    ///    is false or `InitializeParallelDSM` falls back to private memory (`es_query_dsa == NULL`).
        // Populate the private bitmap cursor source when running without attached parallel DSM
        // state. Handling this here (rather than gating on `!plan.parallel_aware` in
        // `init_search_reader`) covers both genuinely serial scans and `parallel_aware` scans
        // that fell back to leader-only local execution (e.g. `es_use_parallel_mode = false` or
        // PostgreSQL's `InitializeParallelDSM` private-memory fallback with `es_query_dsa == NULL`),
        // without eagerly building a private bitmap during `estimate_dsm_custom_scan`.
        if state.custom_state().parallel.is_none()
            && let Some(cell) = state.custom_state().bitmap_cell.clone()
            && cell.get().is_none()
            && let Some(bitmap_exec) = state.custom_state_mut().bitmap_exec.as_mut()
            &
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    ///    Either the main backend running a serial path, or a `parallel_safe` but not
    ///    `parallel_aware` scan inside a worker (e.g. the inner side of a Parallel Hash Join).
        let parallel_aware = unsafe { (*(*state.planstate()).plan).parallel_aware };
        if !parallel_aware
            && let Some(cell) = state.custom_state().bitmap_cell.clone()
            && cell.get().is_none()
            && let Some(bitmap_exec) = state.custom_state_mut().bitmap_exec.as_mut()
            && let Some(source) = unsafe { bitmap_exec.private_source() }
        {
            cell.fill(source);
        }

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9e0eeecd` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T02:09:21.007Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795313361007",
    "title": "Solve AggregateScan parameters before entering a runtime.",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "paradedb-paradedb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "92cb23e85bbe296079a6181a2ee1dc7a243e4d10474b8f4744a72b3d13ec4e6c"
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
        "Harvested/verified timestamp recorded: 2026-11-22T02:09:21.007Z"
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
  "auth_token": "e4faef4b80236668a62728ec82182925b850000985428571c8a56b70de698c1f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
