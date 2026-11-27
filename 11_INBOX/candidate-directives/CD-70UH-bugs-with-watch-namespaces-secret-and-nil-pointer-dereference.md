# Candidate Directive: [CD-70UH] bugs with watch-namespaces-secret and nil pointer dereference

<!-- PROVENANCE_START
{
  "source_repository": "nginx-kubernetes-ingress-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T01:06:58.596Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nginx-kubernetes-ingress-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nginx-kubernetes-ingress-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T01:06:58.596Z`  
> **Learning ID**: `LEARN-EVO-nginx-kubernetes-ingress-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T01:06:58.695Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795741618695",
    "title": "bugs with watch-namespaces-secret and nil pointer dereference",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nginx-kubernetes-ingress-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "710d4c7ad035aa061719c55f7c994f4ef21aa10e17c73f366759f5592fc756d6"
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
        "Harvested/verified timestamp recorded: 2026-11-27T01:06:58.695Z"
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
  "auth_token": "318e3f4340855df023757719eb626f2da085263550ba268c550e6e82ee50cc9d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
