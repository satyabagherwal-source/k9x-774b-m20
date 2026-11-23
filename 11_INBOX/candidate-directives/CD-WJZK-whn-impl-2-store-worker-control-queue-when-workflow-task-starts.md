# Candidate Directive: [CD-WJZK] WHN impl 2: store worker control queue when workflow task starts

<!-- PROVENANCE_START
{
  "source_repository": "temporalio/temporal",
  "source_url": "https://github.com/temporalio/temporal",
  "source_version": "5208234b",
  "license": "MIT",
  "timestamp": "2026-11-23T17:11:55.952Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-temporalio-temporal",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [temporalio/temporal](https://github.com/temporalio/temporal) (Revision: `5208234b`).  
> **License**: MIT | **Timestamp**: `2026-11-23T17:11:55.952Z`  
> **Learning ID**: `learn-github-temporalio-temporal`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `api/persistence/v1/executions.pb.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in temporalio/temporal. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5208234b`: WHN impl 2: store worker control queue when workflow task starts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `api/persistence/v1/executions.pb.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	WorkflowTaskWorkerControlQueue          string                           `protobuf:"bytes,119,opt,name=workflow_task_worker_control_queue,json=workflowTaskWorkerControlQueue,proto3" json:"workflow_task_worker_control_queue,omitempty"`
func (x *WorkflowExecutionInfo) GetWorkflowTaskWorkerControlQueue() string {
	if x != nil {
		return x.WorkflowTaskWorkerControlQueue
	}
	return ""
}

	"\x10\vJ\x04\b\v\x10\fJ\x04\b\f\x10\rJ\x04\b\x0e\x10\x0fJ\x04\b\x0f\x10\x10J\x04\b\x10\x10\x11\"\xb8E\n" +
	"\x1aworkflow_task_started_time\x18\x1b \x01(\v2\x1a.google.protobuf.TimestampR\x17workflowTaskStartedTime\x12J\n" +
	"\"workflow_task_worker_control_queue\x18w \x01(\tR\x1eworkflowTaskWorkerControlQueue\x12[\n" +
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	"\x10\vJ\x04\b\v\x10\fJ\x04\b\f\x10\rJ\x04\b\x0e\x10\x0fJ\x04\b\x0f\x10\x10J\x04\b\x10\x10\x11\"\xecD\n" +
	"\x1aworkflow_task_started_time\x18\x1b \x01(\v2\x1a.google.protobuf.TimestampR\x17workflowTaskStartedTime\x12[\n" +
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5208234b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T17:11:55.950Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795453915950",
    "title": "WHN impl 2: store worker control queue when workflow task starts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "temporalio/temporal",
    "source_uri": "https://github.com/temporalio/temporal",
    "source_version": "HEAD",
    "content_hash": "77f007f9120f602fe9a391cf6aea2435559d3d5b2d8bbf0647c150b1ba43c4a3"
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
        "Harvested/verified timestamp recorded: 2026-11-23T17:11:55.950Z"
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
  "auth_token": "1fa8057e6e6a8a92f492ed64d42095380f15b4cb4f74ce8f638f2f66e2ef228f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
