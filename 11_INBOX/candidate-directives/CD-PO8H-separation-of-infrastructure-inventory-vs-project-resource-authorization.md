# Candidate Directive: [CD-PO8H] Separation of Infrastructure Inventory vs Project Resource Authorization

<!-- PROVENANCE_START
{
  "source_repository": "koderover-zadig-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T22:07:49.628Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-koderover-zadig-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [koderover-zadig-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T22:07:49.628Z`  
> **Learning ID**: `LEARN-EVO-koderover-zadig-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
Cluster infrastructure inventory permissions (e.g., viewing connected Kubernetes clusters) **MUST NOT** be automatically treated as authorization to view or select cluster namespaces and workload candidates for CI/CD pipelines. Workload and namespace access **MUST** be verified against explicitly assigned project-level scopes (`ProjectActions.Env` or `ProjectActions.Workflow`).

**WHY**:
In enterprise multi-tenant platforms, infrastructure administrators register clusters globally. Developers or pipeline operators granted read-only visibility into cluster health or names must not inherit the ability to read namespaces, list active deployments, or deploy pipelines into namespaces belonging to unrelated tenants or business units sharing that physical cluster.

**WHEN TO APPLY**:
Multi-cluster Kubernetes management, multi-tenant cloud consoles, and any access-control system bridging infrastructure-level nodes with project-level runtime assets.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// From zadig: pkg/microservice/aslan/core/multicluster/service/kube_authorization.go
func CanReadAllKubeResources(resources *user.AuthorizedResources, permission KubeResourcePermission) bool {
    actions := resources.SystemActions
    if actions == nil {
        return false
    }
    // Cluster visibility alone ONLY grants inventory list access, NOT workflow/namespace inspection.
    if permission == KubeClusterInventory &&
        actions.ClusterManagement != nil && actions.ClusterManagement.View {
        return true
    }
    // Workflow template operations require explicit template system-level authorisations.
    return permission == KubeWorkflowCandidates &&
        actions.Template != nil && (actions.Template.Create || actions.Template.Edit)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Leaking infrastructure-wide resources because user has cluster view access
func CanSelectNamespaces(user *User) bool {
    // BROKEN: Anyone with basic cluster view can now enumerate all enterprise namespaces
    if user.HasSystemPermission("ClusterManagement.View") {
        return true
    }
    return user.HasProjectPermission(...)
}
```

**VERIFICATION METHOD**:
Automated RBAC suite testing identity permutation:
```go
func TestClusterViewerDeniedNamespaceSelector(t *testing.T) {
    ctx := &user.AuthorizedResources{
        SystemActions: &user.SystemActions{
            ClusterManagement: &user.ClusterManagementActions{View: true},
        },

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:07:49.744Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126069744",
    "title": "Separation of Infrastructure Inventory vs Project Resource Authorization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "koderover-zadig-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "2664441b73684c4a03bf71403bf74abfe2d2b8d1789f55cfa8a3399e76950801"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:07:49.744Z"
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
  "auth_token": "dfd6c47840a395dc46f6943ed45bd31d72780914277995aaf686502d17dbe4d5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
