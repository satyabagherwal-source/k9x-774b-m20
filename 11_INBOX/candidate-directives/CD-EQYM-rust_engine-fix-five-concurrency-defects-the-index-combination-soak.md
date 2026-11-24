# Candidate Directive: [CD-EQYM] rust_engine: fix five concurrency defects the index-combination soak

<!-- PROVENANCE_START
{
  "source_repository": "infiniflow-infinity-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T03:41:56.214Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-infiniflow-infinity-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [infiniflow-infinity-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T03:41:56.214Z`  
> **Learning ID**: `LEARN-EVO-infiniflow-infinity-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `rust_engine/crates/catalog/src/layout.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e7db7afb`: rust_engine: fix five concurrency defects the index-combination soak. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust_engine/crates/catalog/src/layout.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    // one, so the previous layer has to go - except for the segments a
    // compaction deprecated, whose records the reference keeps until `Cleanup`
    // (the `drop|seg|` record is what makes a reader ignore them).
    //
    // It goes **after** the new records are in, not before. Deleting first
    // opened a window in which the table had a segment and no blocks at all, and
    // a query landing in it read the table as missing (`no blocks for table`)
    // even though every row was committed. Publishing first means a reader sees
    // the old layer or the new one, never neither.
    let mut stale: Vec<Vec<u8>> = Vec::new();
            stale.push(k);
    // The keys this write publishes, so the sweep below cannot delete a record
    // it just wrote.
    let mut fresh: std::collections::HashSet<Vec<u8>> = std::collections::HashSet::new();
        let segment_key =
            key::catalog_segment_key(&set.db_id, &set.table_id, seg.segment_id).into_bytes();
        store.put(&segment_key, seg.create_ts.to_string().as_bytes())?;
        fresh.insert(segment_key);
        let tag_key = key::catalog_segment_tag_key(
            &set.db_id,
            &set.table_id,
        
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    // one, so start from an empty segment layer for the table - except for the
    // segments a compaction deprecated, whose records the reference keeps until
    // `Cleanup` (the `drop|seg|` record is what makes a reader ignore them).
            store.delete(&k)?;
        store.put(
            key::catalog_segment_key(&set.db_id, &set.table_id, seg.segment_id).as_bytes(),
            seg.create_ts.to_string().as_bytes(),
        )?;
        store.put(

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T03:41:56.349Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795491716349",
    "title": "rust_engine: fix five concurrency defects the index-combination soak",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "infiniflow-infinity-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b58819f2ff8c2bd9a813136371010f2d0a587d0ae183fca1e9515f17dd3ebfa6"
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
        "Harvested/verified timestamp recorded: 2026-11-24T03:41:56.349Z"
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
  "auth_token": "2b76a44d95f75e5429357480444cf79b933e74b979f0256aea3d9912a3817371"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
