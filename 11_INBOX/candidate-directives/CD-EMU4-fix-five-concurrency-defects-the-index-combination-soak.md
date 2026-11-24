# Candidate Directive: [CD-EMU4] fix five concurrency defects the index-combination soak

<!-- PROVENANCE_START
{
  "source_repository": "infiniflow/infinity",
  "source_url": "https://github.com/infiniflow/infinity",
  "source_version": "e7db7afb",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T03:41:51.005Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-infiniflow-infinity",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [infiniflow/infinity](https://github.com/infiniflow/infinity) (Revision: `e7db7afb`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T03:41:51.005Z`  
> **Learning ID**: `learn-github-infiniflow-infinity`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
            key::catalog_segment_tag_key(
                &set.db_id,
                &set.table_id,
                seg.segment_id,
                "first_delete_ts",
            )
            .as_bytes(),
            seg.first_delete_ts.to_string().as_bytes(),
        )?;
            store.put(
                    .as_bytes(),
                block.commit_ts.to_string().as_bytes(),
            )?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e7db7afb` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T03:41:51.002Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795491711002",
    "title": "fix five concurrency defects the index-combination soak",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "infiniflow/infinity",
    "source_uri": "https://github.com/infiniflow/infinity",
    "source_version": "HEAD",
    "content_hash": "06964d99b6ff1c64c9ab0703792d58635c5035066cff5c2d498b6639fe4d16e0"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T03:41:51.003Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "9c67f5a76427c5b9e6cde0e1fdda9d5a8bf76e6bb797768d78f3a2447f6b387a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
