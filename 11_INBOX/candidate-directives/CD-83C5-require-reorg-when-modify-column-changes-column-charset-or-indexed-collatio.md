# Candidate Directive: [CD-83C5] require reorg when MODIFY COLUMN changes column charset or indexed collatio

<!-- PROVENANCE_START
{
  "source_repository": "pingcap/tidb",
  "source_url": "https://github.com/pingcap/tidb",
  "source_version": "0103aff4",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T15:44:35.814Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pingcap-tidb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pingcap/tidb](https://github.com/pingcap/tidb) (Revision: `0103aff4`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T15:44:35.814Z`  
> **Learning ID**: `learn-github-pingcap-tidb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/ddl/column_modify_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pingcap/tidb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a935aa47`: ddl: require reorg when MODIFY COLUMN changes column charset or indexed collation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/ddl/column_modify_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

func TestModifyColumnCrossCharsetRequiresReorg(t *testing.T) {
	store := testkit.CreateMockStoreWithSchemaLease(t, columnModifyLease)
	tk := testkit.NewTestKit(t, store)
	tk.MustExec("use test")

	// BINARY(2) -> VARCHAR(10) utf8mb4 with invalid UTF-8 bytes must reorg and fail.
	tk.MustExec("create table t0 (id int primary key, c binary(2))")
	tk.MustExec("insert into t0 values (1, x'FFFE')")
	tk.MustGetErrCode("alter table t0 modify column c varchar(10) character set utf8mb4 collate utf8mb4_general_ci", errno.ErrTruncatedWrongValueForField)

	// CHAR(4) utf8mb4 -> VARCHAR(10) ascii with non-ASCII character must reorg and fail.
	tk.MustExec("create table t2 (id int primary key, c char(4) character set utf8mb4)")
	tk.MustExec("insert into t2 values (1, 'é')")
	tk.MustGetErrCode("alter table t2 modify column c varchar(10) character set ascii", errno.ErrTruncatedWrongValueForField)

	// CHAR(4) utf8mb4 -> VARBINARY(4) with 8-byte UTF-8 value must reorg and fail with truncation.
	tk.MustExec("create table t3 (id int primary key, c char(4) character set utf8mb4)")
	tk.MustExec("insert into t3 values (1, 'éééé')")
	tk.MustGetErrCode("alter table t3 modify column c varbinary(4)", errno.W
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a935aa47` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T15:44:35.812Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795535075812",
    "title": "require reorg when MODIFY COLUMN changes column charset or indexed collatio",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pingcap/tidb",
    "source_uri": "https://github.com/pingcap/tidb",
    "source_version": "HEAD",
    "content_hash": "9746f1fcb0552c82049c8e5d324a954dcbccc17586194c31bceff59461b6b28d"
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
        "Harvested/verified timestamp recorded: 2026-11-24T15:44:35.812Z"
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
  "auth_token": "8e8300eb3df4e598dece8636d7ee1b60cfd22f459fa5391c4a4a9a46e8c69a37"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
