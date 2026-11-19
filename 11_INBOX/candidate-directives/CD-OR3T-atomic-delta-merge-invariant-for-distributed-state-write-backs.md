# Candidate Directive: [CD-OR3T] Atomic Delta Merge Invariant for Distributed State Write-Backs

<!-- PROVENANCE_START
{
  "source_repository": "koderover/zadig",
  "source_url": "https://github.com/koderover/zadig",
  "source_version": "0b80d9e7",
  "license": "NOASSERTION",
  "timestamp": "2026-11-19T22:07:06.809Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-koderover-zadig",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [koderover/zadig](https://github.com/koderover/zadig) (Revision: `0b80d9e7`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-19T22:07:06.809Z`  
> **Learning ID**: `learn-github-koderover-zadig`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    }

    // 3. Mutate only targeted delta records, preserving concurrent insertions
    mutate(env, orchestration)

    // 4. Commit atomic update
    if err = productColl.UpdateAllServices(productName, envName, env.Services, updateBy); err != nil {
        mongo.AbortTransaction(session)
        return fmt.Errorf("failed to update %s/%s product services, err %s", productName, envName, err)
    }

    return mongo.CommitTransaction(session)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: NEVER persist an entire stale array snapshot over a shared resource
func BuggyDeployWriteback(productName, envName string, initialSnapshot []*ProductService) error {
    // initialSnapshot was read 2 minutes ago before helm install started
    // Any service added by another user during those 2 minutes is wiped out!
    return db.Collection("products").UpdateOne(
        context.TODO(),
        bson.M{"name": productName, "env_name": envName},
        bson.M{"$set": bson.M{"services": initialSnapshot}},
    )
}
```

**VERIFICATION METHOD**:
Run a high-concurrency race integration test:
1. Initialize an environment with services `[A, B]`.
2. Trigger long-running Helm update on service `A` (artificially delayed by 2 seconds).
3. Concurrently invoke API endpoint to insert service `C`.
4. Allow update of `A` to complete.
5. Assert document contains `[A, B, C]`. An unhandled overwrite will produce `[A, B]`, failing the test.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:07:06.806Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126026806",
    "title": "Atomic Delta Merge Invariant for Distributed State Write-Backs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "koderover/zadig",
    "source_uri": "https://github.com/koderover/zadig",
    "source_version": "HEAD",
    "content_hash": "c634d629c3f8ecd289ad6218848adb86324f975c23a0a115f10d191cdbe3868b"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:07:06.806Z"
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
  "auth_token": "32838240bd45262119e61569f378be2aa1be778b4cff14f70c1414ac9456cd61"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
