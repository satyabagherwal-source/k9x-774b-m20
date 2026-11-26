# Candidate Directive: [CD-G3JS] planner: fix ANALYZE panic when a skipped column is needed by a generated column

<!-- PROVENANCE_START
{
  "source_repository": "pingcap-tidb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T09:22:15.031Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pingcap-tidb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pingcap-tidb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T09:22:15.031Z`  
> **Learning ID**: `LEARN-EVO-pingcap-tidb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/executor/test/analyzetest/analyze_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pingcap/tidb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `452929bd`: planner: fix ANALYZE panic when a skipped column is needed by a generated column or an index. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/executor/test/analyzetest/analyze_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// | JSON column only used by skipped columns         | ❌ No           | Excluded by tidb_analyze_skip_column_types setting |
// | Generated column depending on a skipped column   | ❌ No           | Its value needs a skipped column, at any depth     |
// | Vector column used by an expression index        | ✅ Yes          | Needed to build the expression index statistics    |
// | Expression index on the vector column            | ✅ Yes          | Index entries are stored in TiKV                   |
		skipped_data JSON,
		virtual_on_skipped INT AS (JSON_EXTRACT(skipped_data, '$.x')) VIRTUAL,
		stored_on_skipped INT AS (JSON_EXTRACT(skipped_data, '$.x')) STORED,
		virtual_on_virtual INT AS (virtual_on_skipped + 1) VIRTUAL,
		virtual_on_stored INT AS (stored_on_skipped + 1) VIRTUAL,
		stored_on_generated INT AS (virtual_on_virtual + virtual_on_stored) STORED,
		vector_col VECTOR(3),
		INDEX idx_stored (stored_col),
		INDEX idx_vector_is_null ((vector_col IS NULL))
	tk.MustExec(`INSERT INTO test_gen_cols (id, data, json_but_not_used_by_generated_column, skipped_data, vector_col) VALUES
		(1, '{"name": "user1", "status": "active"}', '{"category": "admin", "level": 1}', '{"x": 1}', '[1,2
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
		INDEX idx_stored (stored_col)
	tk.MustExec(`INSERT INTO test_gen_cols (id, data, json_but_not_used_by_generated_column) VALUES
		(1, '{"name": "user1", "status": "active"}', '{"category": "admin", "level": 1}'),
		(2, '{"name": "user2", "status": "inactive"}', '{"category": "user", "level": 2}'),
		(3, '{"name": "user3", "status": "active"}', '{"category": "user", "level": 1}')`)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `452929bd` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T09:22:15.158Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795684935158",
    "title": "planner: fix ANALYZE panic when a skipped column is needed by a generated column",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pingcap-tidb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a2acad31d0abed7a4f6141871553051468560c94967d2147e0ebcf417926eee5"
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
        "Harvested/verified timestamp recorded: 2026-11-26T09:22:15.158Z"
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
  "auth_token": "1e93707e0d42784a63fbcfb88e20636ab4e4527fa3ea3eb94e6911f169019ed7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
