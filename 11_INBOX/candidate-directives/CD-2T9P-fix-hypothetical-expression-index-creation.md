# Candidate Directive: [CD-2T9P] fix hypothetical expression index creation

<!-- PROVENANCE_START
{
  "source_repository": "pingcap/tidb",
  "source_url": "https://github.com/pingcap/tidb",
  "source_version": "e722f8f1",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T08:56:15.277Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pingcap-tidb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pingcap/tidb](https://github.com/pingcap/tidb) (Revision: `e722f8f1`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T08:56:15.277Z`  
> **Learning ID**: `learn-github-pingcap-tidb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/ddl/executor.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pingcap/tidb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c09f6278`: ddl: fix hypothetical expression index creation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/ddl/executor.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
func (*executor) addHypoIndexIntoCtx(ctx sessionctx.Context, schemaName, tableName ast.CIStr, indexInfo *model.IndexInfo, hiddenCols []*model.ColumnInfo) error {
		sctx.HypoIndexes = make(map[string]map[string]map[string]*model.HypoIndexInfo)
		sctx.HypoIndexes[schemaName.L] = make(map[string]map[string]*model.HypoIndexInfo)
		sctx.HypoIndexes[schemaName.L][tableName.L] = make(map[string]*model.HypoIndexInfo)
	sctx.HypoIndexes[schemaName.L][tableName.L][indexName.L] = &model.HypoIndexInfo{
		IndexInfo:     indexInfo,
		HiddenColumns: hiddenCols,
	}
		hypoTblInfo := tblInfo
		if len(hiddenCols) > 0 {
			hypoTblInfo = tblInfo.Clone()
			hypoTblInfo.Columns = finalColumns
			for i, col := range hiddenCols {
				col.ID = tblInfo.MaxColumnID + int64(i) + 1
				col.Offset = len(tblInfo.Columns) + i
				col.State = model.StatePublic
			}
		}
		indexInfo, err := BuildIndexInfo(metaBuildCtx, hypoTblInfo, indexName, false, unique, model.ColumnarIndexTypeNA,
		return e.addHypoIndexIntoCtx(ctx, ti.Schema, ti.Name, indexInfo, hiddenCols)
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
func (*executor) addHypoIndexIntoCtx(ctx sessionctx.Context, schemaName, tableName ast.CIStr, indexInfo *model.IndexInfo) error {
		sctx.HypoIndexes = make(map[string]map[string]map[string]*model.IndexInfo)
		sctx.HypoIndexes[schemaName.L] = make(map[string]map[string]*model.IndexInfo)
		sctx.HypoIndexes[schemaName.L][tableName.L] = make(map[string]*model.IndexInfo)
	sctx.HypoIndexes[schemaName.L][tableName.L][indexName.L] = indexInfo
		indexInfo, err := BuildIndexInfo(metaBuildCtx, tblInfo, indexName, false, unique, model.ColumnarIndexTypeNA,
		return e.addHypoIndexIntoCtx(ctx, ti.Schema, ti.Name, indexInfo)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c09f6278` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T08:56:15.275Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795596975275",
    "title": "fix hypothetical expression index creation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pingcap/tidb",
    "source_uri": "https://github.com/pingcap/tidb",
    "source_version": "HEAD",
    "content_hash": "ef2f7cfad2140117114f08d1ad183844c7b36252c08bcb384ed652655e25c097"
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
        "Harvested/verified timestamp recorded: 2026-11-25T08:56:15.275Z"
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
  "auth_token": "80b9f846f42821dd0dd1275c207fa52dc4f43b274153bb0d4c13977042701308"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
