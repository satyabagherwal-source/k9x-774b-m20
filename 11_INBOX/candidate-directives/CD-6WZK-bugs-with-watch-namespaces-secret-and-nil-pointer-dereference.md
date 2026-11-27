# Candidate Directive: [CD-6WZK] bugs with watch-namespaces-secret and nil pointer dereference

<!-- PROVENANCE_START
{
  "source_repository": "nginx/kubernetes-ingress",
  "source_url": "https://github.com/nginx/kubernetes-ingress",
  "source_version": "41016e77",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T01:06:53.696Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nginx-kubernetes-ingress",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nginx/kubernetes-ingress](https://github.com/nginx/kubernetes-ingress) (Revision: `41016e77`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T01:06:53.696Z`  
> **Learning ID**: `learn-github-nginx-kubernetes-ingress`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `internal/k8s/controller.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nginx/kubernetes-ingress. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `070abf91`: bugs with watch-namespaces-secret and nil pointer dereference. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/k8s/controller.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	secretInformerFactories      []informers.SharedInformerFactory
	secretLister                 secretLister
	var secretStores storesToSecretLister
	for _, secretNs := range lbc.secretNamespacesFor(ns) {
		factory := informers.NewSharedInformerFactoryWithOptions(lbc.client, lbc.resync, informers.WithNamespace(secretNs), informers.WithTweakListOptions(secretsTweakListOptionsFunc))
		store, err := nsi.addSecretHandler(factory, createSecretHandlers(lbc))
		if err != nil {
			return nil, fmt.Errorf("failed to add secret handler for namespace %s: %w", secretNs, err)
		secretStores = append(secretStores, store)
	}
	if len(secretStores) > 0 {
		nsi.isSecretsEnabledNamespace = true
		nsi.secretLister = secretStores
// secretNamespacesFor returns the namespaces whose Secrets the informer group for
// ns watches
func (lbc *LoadBalancerController) secretNamespacesFor(ns string) []string {
	switch {
	case slices.Contains(lbc.secretNamespaceList, ""), slices.Contains(lbc.secretNamespaceList, ns):
		return []string{ns}
	case ns == "":
		return slices.Compact(slices.Sorted(slices.Values(lbc.secretNamespaceList)))
	default:
		return nil
	}
}

// addSecretHandler adds the handler for the Secrets that
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	secretInformerFactory        informers.SharedInformerFactory
	secretLister                 cache.Store
	// Check if secrets informer should be created for this namespace
	for _, v := range lbc.secretNamespaceList {
		if v == "" || v == ns {
			nsi.isSecretsEnabledNamespace = true
			nsi.secretInformerFactory = informers.NewSharedInformerFactoryWithOptions(lbc.client, lbc.resync, informers.WithNamespace(ns), informers.WithTweakListOptions(secretsTweakListOptionsFunc))
			if err := nsi.addSecretHandler(createSecretHandlers(lbc)); err != nil {
				return nil, fmt.Errorf("failed to add secret handler for namespace %s: %w", ns, err)
			}
			break
// addSecretHandler adds the handler for secrets to the controller
func (nsi *namespacedInformer) addSecretHandler(handlers cache.ResourceEventHandlerFuncs) error {
	informer := nsi.secretInformerFactory.Core().V1().Secrets().Informer()
		return fmt.Errorf("failed to add Secret event handler: %w", err)
	nsi.secretLister = informer.GetStore()
	return nil
	if nsi.isSecretsEnabledNamespace {
		go nsi.secretInformerFactory.Start(nsi.stopCh)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `070abf91` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T01:06:53.694Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795741613694",
    "title": "bugs with watch-namespaces-secret and nil pointer dereference",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nginx/kubernetes-ingress",
    "source_uri": "https://github.com/nginx/kubernetes-ingress",
    "source_version": "HEAD",
    "content_hash": "f058c091d94c7eaacb1fe9c9e01bf4f252d3104aad55bf6f4a30b1209b126bd8"
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
        "Harvested/verified timestamp recorded: 2026-11-27T01:06:53.694Z"
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
  "auth_token": "9232e5b8d21fc2f24c7ebeee836e3d493fb582a3fe0d3d4b5fa86571c8a8d4d4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
