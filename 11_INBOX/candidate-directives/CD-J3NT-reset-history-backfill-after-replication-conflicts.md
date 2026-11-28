# Candidate Directive: [CD-J3NT] reset history backfill after replication conflicts

<!-- PROVENANCE_START
{
  "source_repository": "temporalio/temporal",
  "source_url": "https://github.com/temporalio/temporal",
  "source_version": "2babb62c",
  "license": "MIT",
  "timestamp": "2026-11-28T13:39:52.265Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-temporalio-temporal",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [temporalio/temporal](https://github.com/temporalio/temporal) (Revision: `2babb62c`).  
> **License**: MIT | **Timestamp**: `2026-11-28T13:39:52.265Z`  
> **Learning ID**: `learn-github-temporalio-temporal`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `service/history/ndc/workflow_state_replicator.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in temporalio/temporal. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2af2fe74`: reset history backfill after replication conflicts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `service/history/ndc/workflow_state_replicator.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// Source branch IDs can refer to a losing history locally after conflict resolution.
	// Only reuse existing batches if they belong to the source's version history.
	localHistoryMismatch := false
LocalHistoryLoop:
			for _, event := range localHistoryBatch.GetEvents() {
				version, err := versionhistory.GetVersionHistoryEventVersion(currentVersionHistory, event.GetEventId())
				if err != nil || version != event.GetVersion() {
					localHistoryMismatch = true
					break LocalHistoryLoop
				}
			}
	if localHistoryMismatch {
		// Preserve the existing branch for other runs and copy the complete source
		// history into an independent branch without source ancestors.
		backfillBranchToken, err = r.shardContext.GetExecutionManager().GetHistoryBranchUtil().NewHistoryBranch(
			namespaceID.String(), workflowID, runID, branchInfo.GetTreeId(), nil, nil,
			0, 0, 0,
		)
		if err != nil {
			return err
		}
		lastBatchNodeID = 0
	}
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	// Get the last batch node id to check if the history data is already in DB.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2af2fe74` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T13:39:52.263Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795873192263",
    "title": "reset history backfill after replication conflicts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "temporalio/temporal",
    "source_uri": "https://github.com/temporalio/temporal",
    "source_version": "HEAD",
    "content_hash": "d7766c740651c911ad01b7aa29f06ca829e8a8a721e92f3bb4337db1a86ca6cb"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T13:39:52.263Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "13c5fc7157c59c491738045f808460969472a7d0cc61d58d5dc3e14aedd42565"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
