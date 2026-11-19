# Candidate Directive: [CD-PO8G] Disambiguation Guard for Multi-Identity Resource Resolution

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:07:49.743Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126069743",
    "title": "Disambiguation Guard for Multi-Identity Resource Resolution",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "koderover-zadig-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ccdc90a713bfdc0b8f1f408a62b9749b12eabc1d4182e1e90f5a022135240e45"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:07:49.743Z"
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
  "auth_token": "fab8a9161790c3d3bd0ac5afab6d45eb0ebc616657c61ee764ed89c0a33a527d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
