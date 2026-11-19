# Candidate Directive: [CD-PO8F] Atomic Delta Merge Invariant for Distributed State Write-Backs

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
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When an asynchronous, long-running orchestrator (such as a Helm release manager or cloud provisioner) updates a sub-entity collection within a persistent document, it **MUST NOT** write back an in-memory snapshot of the collection taken at job invocation. The write-back operation **MUST** acquire a resource-level distributed lock, fetch the latest document state within a transactional session, calculate and apply only the *handled deltas*, and explicitly reconcile deletions.

**WHY**:
In distributed systems where updates take seconds or minutes (e.g., waiting for Kubernetes deployments or Helm chart releases), concurrent operations (such as a developer adding or editing another service) mutate the underlying collection in MongoDB. If the long-running worker finishes and overwrites the entire document or collection with its stale pre-execution snapshot, any concurrently added services or updated configurations are silently destroyed ("lost updates").

**WHEN TO APPLY**:
Apply to any long-running workflow, reconciliation loop, or orchestrator in Go/Python/Node/Java where an operation starts with a read of a composite state (e.g., microservices in an environment, nodes in a cluster) and persists mutations upon completion.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// From zadig: pkg/microservice/aslan/core/common/service/helm/helm.go
func updateEnvServices(productName, envName string, production bool, updateBy string, 
    mutate func(env *commonmodels.Product, orchestration [][]string)) error {
    
    session := mongo.Session()
    defer session.EndSession(context.TODO())

    if err := mongo.StartTransaction(session); err != nil {
        return err
    }

    productColl := commonrepo.NewProductCollWithSession(session)

    // 1. Acquire distributed lock across independent processes
    envLock := cache.NewRedisLock(fmt.Sprintf("%s:%s:%s", UpdateHelmEnvLockKey, productName, envName))
    envLock.Lock()
    defer envLock.Unlock()

    // 2. Fetch fresh orchestrator template and target environment within transaction
    templateProduct, err := template.NewProductCollWithSess(session).Find(productName)
    if err != nil {
        mongo.AbortTransaction(session)
        return errors.Wrapf(err, "failed to find template product %s", productName)
    }
    orchestration := templateProduct.Services
    if production {
        orchestration = templateProduct.ProductionServices
    }

    env, err := productColl.Find(&commonrepo.ProductFindOptions{
        Name:       productName,
        EnvName:    envName,
        Production: &production,
    })
    if err != nil {
        mongo.AbortTransaction(session)
        return errors.Wrapf(err, "failed to find environment %s/%s", productName, envName)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:07:49.742Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126069742",
    "title": "Atomic Delta Merge Invariant for Distributed State Write-Backs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "koderover-zadig-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "00fb9c696115da457ae9fdc109740ea18f632573e6570f9613273d309bbcaf49"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-19T22:07:49.742Z"
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
  "auth_token": "8b3cd8788afb258257791e3df744976dd46ebffeb3a1e5acb37a8b291c059146"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
