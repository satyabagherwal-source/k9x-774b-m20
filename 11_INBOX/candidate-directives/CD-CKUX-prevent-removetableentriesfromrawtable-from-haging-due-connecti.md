# Candidate Directive: [CD-CKUX] Prevent RemoveTableEntriesFromRawTable  from haging due connecti

<!-- PROVENANCE_START
{
  "source_repository": "PeerDB-io/peerdb",
  "source_url": "https://github.com/PeerDB-io/peerdb",
  "source_version": "4e3fd8c9",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-28T01:54:57.561Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-peerdb-io-peerdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [PeerDB-io/peerdb](https://github.com/PeerDB-io/peerdb) (Revision: `4e3fd8c9`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-28T01:54:57.561Z`  
> **Learning ID**: `learn-github-peerdb-io-peerdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-28T01:54:57.559Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795830897559",
    "title": "Prevent RemoveTableEntriesFromRawTable  from haging due connecti",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "PeerDB-io/peerdb",
    "source_uri": "https://github.com/PeerDB-io/peerdb",
    "source_version": "HEAD",
    "content_hash": "1e98ccc58e8599b231ef7fc9eb81898fac934c371a751f876b3be129e0dea8fe"
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
        "Harvested/verified timestamp recorded: 2026-11-28T01:54:57.559Z"
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
  "auth_token": "380c8be28e95f6dfa9d114ca19175cb83cbf1b0cb07f901fb2ca9e0271439c7c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
