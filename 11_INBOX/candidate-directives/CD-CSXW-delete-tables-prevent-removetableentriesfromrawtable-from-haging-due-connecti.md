# Candidate Directive: [CD-CSXW] delete-tables): Prevent RemoveTableEntriesFromRawTable  from haging due connecti

<!-- PROVENANCE_START
{
  "source_repository": "peerdb-io-peerdb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T01:55:07.873Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-peerdb-io-peerdb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [peerdb-io-peerdb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T01:55:07.873Z`  
> **Learning ID**: `LEARN-EVO-peerdb-io-peerdb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `flow/connectors/clickhouse/cdc.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in PeerDB-io/peerdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4e3fd8c9`: delete-tables): Prevent RemoveTableEntriesFromRawTable  from haging due connection inactivity. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `flow/connectors/clickhouse/cdc.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"time"
var rawTableDeletePollIntervals = []time.Duration{5 * time.Second, 30 * time.Second, time.Minute, 2 * time.Minute}

	rawTableName := c.GetRawTableName(req.FlowJobName)
	// Return as soon as the mutation is registered
	deleteSettings := chinternal.NewCHSettingsString(c.chVersion, chinternal.SettingLightweightDeletesSync, "0")

		condition := fmt.Sprintf("_peerdb_destination_table_name IN (%s) AND _peerdb_batch_id > %d AND _peerdb_batch_id <= %d",
			strings.Join(quoted, ","), req.NormalizeBatchId, req.SyncBatchId)
		if err := c.execWithLogging(ctx, fmt.Sprintf("DELETE FROM %s WHERE %s%s", rawTableName, condition, deleteSettings)); err != nil {
		// Poll the raw table to ensure all rows matching the condition are removed.
		// This replaces lightweight_deletes_sync=2 at the lightweight delete level and waiting on the query result
		// as the connection might drop on long-running queries.
		//
		// Check https://linear.app/clickhouse/issue/DBI-1405 for more details
		probeQuery := fmt.Sprintf("SELECT 1 FROM %s WHERE %s LIMIT 1", rawTableName, condition)
		pendingRows := true
		for attempt := 0; pendingRows; attempt++ {
			interval := rawTableDeletePollIntervals[min(attempt, le
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
		if err := c.execWithLogging(ctx, fmt.Sprintf("DELETE FROM %s WHERE _peerdb_destination_table_name IN (%s)"+
			" AND _peerdb_batch_id > %d AND _peerdb_batch_id <= %d",
			c.GetRawTableName(req.FlowJobName), strings.Join(quoted, ","), req.NormalizeBatchId, req.SyncBatchId),
		); err != nil {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4e3fd8c9` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T01:55:08.034Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795830908033",
    "title": "delete-tables): Prevent RemoveTableEntriesFromRawTable  from haging due connecti",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "peerdb-io-peerdb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "2e3754846d55d691b6a86f75934d501c02ce3f8e98a5fb980b396ccc4ceb561c"
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
        "Harvested/verified timestamp recorded: 2026-11-28T01:55:08.034Z"
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
  "auth_token": "80e99e6a7736e2e54d2d2d0bfc0d58805c9444e9d2de181438b247069f7fbc51"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
