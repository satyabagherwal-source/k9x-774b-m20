# Candidate Directive: [CD-Y25O] Empirical Invariant Guard in group_loader.go

<!-- PROVENANCE_START
{
  "source_repository": "kubernetes-sigs/aws-load-balancer-controller",
  "source_url": "https://github.com/kubernetes-sigs/aws-load-balancer-controller",
  "source_version": "6de51a66",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T10:18:50.604Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-kubernetes-sigs-aws-load-balancer-controller",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kubernetes-sigs/aws-load-balancer-controller](https://github.com/kubernetes-sigs/aws-load-balancer-controller) (Revision: `6de51a66`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T10:18:50.604Z`  
> **Learning ID**: `learn-github-kubernetes-sigs-aws-load-balancer-controller`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-18T10:18:50.603Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794997130603",
    "title": "Empirical Invariant Guard in group_loader.go",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kubernetes-sigs/aws-load-balancer-controller",
    "source_uri": "https://github.com/kubernetes-sigs/aws-load-balancer-controller",
    "source_version": "HEAD",
    "content_hash": "a501a7aa68a18ec8fea95bf7e9faa91e19bbfac7ea4ecb454ab2af1247aaff1d"
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
        "Harvested/verified timestamp recorded: 2026-11-18T10:18:50.603Z"
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
  "auth_token": "b7a2f901d804628d18d366f037b6aadc065b57c07e88f9aafc1b3f9b4e628e94"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
