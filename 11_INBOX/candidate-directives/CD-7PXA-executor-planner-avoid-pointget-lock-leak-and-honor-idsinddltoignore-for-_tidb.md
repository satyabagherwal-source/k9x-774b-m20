# Candidate Directive: [CD-7PXA] executor, planner: avoid PointGet lock leak and honor IDsInDDLToIgnore for _tidb

<!-- PROVENANCE_START
{
  "source_repository": "pingcap/tidb",
  "source_url": "https://github.com/pingcap/tidb",
  "source_version": "6775607e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T20:08:34.558Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pingcap-tidb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pingcap/tidb](https://github.com/pingcap/tidb) (Revision: `6775607e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T20:08:34.558Z`  
> **Learning ID**: `learn-github-pingcap-tidb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
				_, pid, err := codec.DecodeInt(tablecodec.SplitIndexValue(e.handleVal).PartitionID)
				tblID = pid
				pi := e.tblInfo.GetPartitionInfo()
				if !matchPartitionNames(tblID, e.partitionNames, pi) {
					return nil
				}
				if slices.Contains(pi.IDsInDDLToIgnore(), pid) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ec579a79` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T20:08:34.556Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795464514556",
    "title": "executor, planner: avoid PointGet lock leak and honor IDsInDDLToIgnore for _tidb",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pingcap/tidb",
    "source_uri": "https://github.com/pingcap/tidb",
    "source_version": "HEAD",
    "content_hash": "93d3eebc7e6274ceb1635b1b044fa1209e075d24c602198ae4ae7b2382457be8"
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
        "Harvested/verified timestamp recorded: 2026-11-23T20:08:34.556Z"
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
  "auth_token": "e8fc1d6690b48ff2fe76f3a72cd02d94de4837da8a2706c34cb836e31e4548c9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
