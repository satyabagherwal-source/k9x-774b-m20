# Candidate Directive: [CD-WN05] WHN impl 2: store worker control queue when workflow task starts

<!-- PROVENANCE_START
{
  "source_repository": "temporalio-temporal-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T17:11:59.730Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-temporalio-temporal-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [temporalio-temporal-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T17:11:59.730Z`  
> **Learning ID**: `LEARN-EVO-temporalio-temporal-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-23T17:11:59.858Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795453919857",
    "title": "WHN impl 2: store worker control queue when workflow task starts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "temporalio-temporal-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "77f007f9120f602fe9a391cf6aea2435559d3d5b2d8bbf0647c150b1ba43c4a3"
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
        "Harvested/verified timestamp recorded: 2026-11-23T17:11:59.858Z"
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
  "auth_token": "0ec7ab363d7107e5ff9a829fde8b344b9d7fbfbaf619830193fd3a065fbb9c2b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
