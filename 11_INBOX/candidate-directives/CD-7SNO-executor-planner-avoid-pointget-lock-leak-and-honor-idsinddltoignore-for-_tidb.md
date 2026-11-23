# Candidate Directive: [CD-7SNO] executor, planner: avoid PointGet lock leak and honor IDsInDDLToIgnore for _tidb

<!-- PROVENANCE_START
{
  "source_repository": "pingcap-tidb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T20:08:37.977Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pingcap-tidb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pingcap-tidb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T20:08:37.977Z`  
> **Learning ID**: `LEARN-EVO-pingcap-tidb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/executor/point_get.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pingcap/tidb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ec579a79`: executor, planner: avoid PointGet lock leak and honor IDsInDDLToIgnore for _tidb_rowid and reorg. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/executor/point_get.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
			// Under RR, avoid acquiring a pessimistic lock on a global-index key whose
			// snapshot entry already belongs to a DDL-ignored (dropping) partition.
			// Under RC, always perform the locking current read so concurrent partition
			// moves into requested partitions are not missed.
			if e.idxInfo.Global && e.lock && lockNonExistIdxKey {
				preVal, preErr := e.get(ctx, e.idxKey)
				if preErr != nil && !kv.ErrNotExist.Equal(preErr) {
					return preErr
				}
				if len(preVal) > 0 {
					pid, _, visErr := e.checkGlobalIndexPartition(preVal)
					if visErr != nil {
						return visErr
					}
					if slices.Contains(e.tblInfo.GetPartitionInfo().IDsInDDLToIgnore(), pid) {
						return nil
					}
				}
			}
				pid, visible, err := e.checkGlobalIndexPartition(e.handleVal)
				if !visible {
				tblID = pid
	} else if pi := e.tblInfo.GetPartitionInfo(); pi != nil && slices.Contains(pi.IDsInDDLToIgnore(), tblID) {
		return nil
func (e *PointGetExecutor) checkGlobalIndexPartition(handleVal []byte) (int64, bool, error) {
	_, pid, err := codec.DecodeInt(tablecodec.SplitIndexValue(handleVal).PartitionID)
	if err != nil {
		return 0, false, err
	}
	pi := e.tblInfo.GetPartitionInfo()
	if
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T20:08:38.096Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795464518095",
    "title": "executor, planner: avoid PointGet lock leak and honor IDsInDDLToIgnore for _tidb",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pingcap-tidb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0f933e6271f107717767233a0ee6ac1065bdd1a30db035f785de89f122cad619"
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
        "Harvested/verified timestamp recorded: 2026-11-23T20:08:38.096Z"
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
  "auth_token": "b3b902149355358f0b7bc1315adf524ddf3e7f2ab6341643801f84d613ac42a0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
