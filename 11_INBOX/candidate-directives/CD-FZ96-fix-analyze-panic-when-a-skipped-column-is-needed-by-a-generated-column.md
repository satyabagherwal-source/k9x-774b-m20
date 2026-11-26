# Candidate Directive: [CD-FZ96] fix ANALYZE panic when a skipped column is needed by a generated column

<!-- PROVENANCE_START
{
  "source_repository": "pingcap/tidb",
  "source_url": "https://github.com/pingcap/tidb",
  "source_version": "adfdb353",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T09:22:09.595Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pingcap-tidb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pingcap/tidb](https://github.com/pingcap/tidb) (Revision: `adfdb353`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T09:22:09.595Z`  
> **Learning ID**: `learn-github-pingcap-tidb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-26T09:22:09.593Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795684929593",
    "title": "fix ANALYZE panic when a skipped column is needed by a generated column",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pingcap/tidb",
    "source_uri": "https://github.com/pingcap/tidb",
    "source_version": "HEAD",
    "content_hash": "d0fe811adfbd016b473ccb66606177777e7df6a4743c30deced93a4f4f202a1c"
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
        "Harvested/verified timestamp recorded: 2026-11-26T09:22:09.593Z"
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
  "auth_token": "f441c567c066f7e0ac3d70a99dd979f2a3c0740c9504c1efeda1e36abb897e2d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
