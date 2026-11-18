# Candidate Directive: [CD-3CJ3] Empirical Invariant Guard in group_loader.go

<!-- PROVENANCE_START
{
  "source_repository": "kubernetes-sigs-aws-load-balancer-controller-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T10:22:57.219Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kubernetes-sigs-aws-load-balancer-controller-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kubernetes-sigs-aws-load-balancer-controller-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T10:22:57.219Z`  
> **Learning ID**: `LEARN-EVO-kubernetes-sigs-aws-load-balancer-controller-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/ingress/group_loader.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kubernetes-sigs/aws-load-balancer-controller. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6de51a66`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/ingress/group_loader.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
	// An Ingress whose namespace is being deleted is in deletion state as well.
	// An Ingress no longer belongs to any IngressGroup when it, or its namespace, is being deleted.
	beingDeleted, err := isIngressBeingDeleted(ctx, m.client, ing)
	if err != nil {
		return ClassifiedIngress{}, nil, err
	}
	if beingDeleted {
// isIngressBeingDeleted checks whether the Ingress has a deletionTimestamp or its namespace is being deleted.
// For a terminating namespace, the namespace controller deletes the Ingress later. Until then, the API server
// rejects any new object in that namespace, such as a TargetGroupBinding.
func isIngressBeingDeleted(ctx context.Context, k8sClient client.Client, ing *networking.Ingress) (bool, error) {
	if !ing.DeletionTimestamp.IsZero() {
		return true, nil
	}
	return isIngressNamespaceTerminating(ctx, k8sClient, ing)
}

// isIngressNamespaceTerminating checks whether the namespace of the Ingress is being deleted.
// It uses the condition of NamespaceLifecycle admission, which rejects new objects in a namespace
// whose phase is Terminating. A namespace that is not found is treated as not terminating.
f
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	// Ingress no longer belong to any IngressGroup when it's been deleted.
	if !ing.DeletionTimestamp.IsZero() {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6de51a66` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T10:22:57.326Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794997377326",
    "title": "Empirical Invariant Guard in group_loader.go",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kubernetes-sigs-aws-load-balancer-controller-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a501a7aa68a18ec8fea95bf7e9faa91e19bbfac7ea4ecb454ab2af1247aaff1d"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T10:22:57.326Z"
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
  "auth_token": "91a04912de5bad2e38e5da3de47068b092688a9b229757cd8f0c6177dc042bde"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
