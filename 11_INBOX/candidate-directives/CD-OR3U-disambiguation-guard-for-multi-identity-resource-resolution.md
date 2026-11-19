# Candidate Directive: [CD-OR3U] Disambiguation Guard for Multi-Identity Resource Resolution

<!-- PROVENANCE_START
{
  "source_repository": "koderover/zadig",
  "source_url": "https://github.com/koderover/zadig",
  "source_version": "0b80d9e7",
  "license": "NOASSERTION",
  "timestamp": "2026-11-19T22:07:06.810Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-koderover-zadig",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [koderover/zadig](https://github.com/koderover/zadig) (Revision: `0b80d9e7`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-19T22:07:06.810Z`  
> **Learning ID**: `learn-github-koderover-zadig`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When an API exposes retrieval or manipulation of a resource by a polymorphic or non-unique identifier (e.g., resolving a service by `ServiceName` OR `ReleaseName`), the lookup **MUST NOT** stop at the first match and **MUST NOT** fallback silently. It **MUST** scan the entire candidate namespace, count total identity collisions, and immediately abort with a 400 Bad Request if the target matches multiple distinct entities.

**WHY**:
In Kubernetes/Helm management platforms, a service named `api` can coexist with a Helm chart release named `api` backing a completely different service named `chart`. If lookup returns the first match arbitrarily, an update, restart, or delete command intended for the Helm release can silently delete or restart the wrong microservice pod, causing critical production outages.

**WHEN TO APPLY**:
Any entity lookup routine where queries accept alternative identity keys (e.g., Slug vs UUID, ReleaseName vs ServiceName, DNS name vs Container ID).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// From zadig: pkg/microservice/aslan/core/environment/service/service.go
func getHelmServiceByName(env *commonmodels.Product, serviceName string, log *zap.SugaredLogger) (*commonservice.SvcResp, error) {
    var matched *commonmodels.ProductService
    for _, svc := range env.GetSvcList() {
        // Evaluate identity criteria across both namespaces
        if svc.ServiceName != serviceName && (svc.FromZadig() || svc.ReleaseName != serviceName) {
            continue
        }
        // Ambiguity guard: If already matched a previous entity, abort immediately!
        if matched != nil {
            return nil, e.ErrInvalidParam.AddDesc(fmt.Sprintf("%s matches multiple Helm services in env %s", serviceName, env.EnvName))
        }
        matched = svc
    }
    if matched == nil {
        return nil, fmt.Errorf("failed to find service %s", serviceName)
    }
    result, err := getHelmServiceRuntimeResources(env, serviceName, log)
    if err != nil {
        return nil, err
    }
    result.ReleaseName = matched.ReleaseName
    result.IsHelmChart = util.GetBoolPointer(!matched.FromZadig())
    return result, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: First-match-wins on overlapping namespaces
func GetAmbiguousService(env *Product, name string) *ProductService {
    for _, svc := range env.Services {
        if svc.ServiceName == name || svc.ReleaseName == name {
            return svc // HAZARD: Silent collision; returns wrong resource if name overlaps!
        }
    }
    return nil
}
```

**VERIFICATION METHOD**:
Table-driven unit test verifying collision handling:
```go
func TestAmbiguityRejection(t *testing.T) {
    env := &Product{
        Services: []*ProductService{
            {ServiceName: "api", Type: "helm"},
            {ServiceName: "chart", ReleaseName: "api", Type: "helmChart"},
        },
    }
    _, err := getHelmServiceByName(env, "api", zap.NewNop().Sugar())
    require.Error(t, err)
    require.Contains(t, err.Error(), "matches multiple Helm services")
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:07:06.809Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126026809",
    "title": "Disambiguation Guard for Multi-Identity Resource Resolution",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "koderover/zadig",
    "source_uri": "https://github.com/koderover/zadig",
    "source_version": "HEAD",
    "content_hash": "5d45adc0fc6e27095990d9bda7357f2ce54ea3bc02bc8fa235cbe41b8addcd04"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:07:06.809Z"
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
  "auth_token": "53a4e8d6bcb0e431f3af66b33baa97b5e635eea6941a7642f53c8971e8a49415"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
