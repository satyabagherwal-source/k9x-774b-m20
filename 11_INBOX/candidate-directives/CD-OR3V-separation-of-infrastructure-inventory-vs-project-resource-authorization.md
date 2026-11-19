# Candidate Directive: [CD-OR3V] Separation of Infrastructure Inventory vs Project Resource Authorization

<!-- PROVENANCE_START
{
  "source_repository": "koderover/zadig",
  "source_url": "https://github.com/koderover/zadig",
  "source_version": "0b80d9e7",
  "license": "NOASSERTION",
  "timestamp": "2026-11-19T22:07:06.811Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-koderover-zadig",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [koderover/zadig](https://github.com/koderover/zadig) (Revision: `0b80d9e7`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-19T22:07:06.811Z`  
> **Learning ID**: `learn-github-koderover-zadig`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    }
    assert.True(t, CanReadAllKubeResources(ctx, KubeClusterInventory))
    assert.False(t, CanReadAllKubeResources(ctx, KubeNamespaceCandidates))
    assert.False(t, CanReadAllKubeResources(ctx, KubeWorkflowCandidates))
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:07:06.810Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126026810",
    "title": "Separation of Infrastructure Inventory vs Project Resource Authorization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "koderover/zadig",
    "source_uri": "https://github.com/koderover/zadig",
    "source_version": "HEAD",
    "content_hash": "31e57f441f80ded6ab12a5f8fd696a662e375f3f6c4071fa93708775f76dbfd3"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:07:06.810Z"
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
  "auth_token": "eaacb784d85d6848aa2a7f738aaa50eaed256cd1c7058527c0800e8cbb51d93f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
