# Candidate Directive: [CD-XZ2B] loadbalancer: report effective LocalRedirect mappings

<!-- PROVENANCE_START
{
  "source_repository": "cilium-cilium-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T17:18:40.729Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-cilium-cilium-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cilium-cilium-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T17:18:40.729Z`  
> **Learning ID**: `LEARN-EVO-cilium-cilium-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/loadbalancer/redirectpolicy/api.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cilium/cilium. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cde31357`: loadbalancer: report effective LocalRedirect mappings. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/loadbalancer/redirectpolicy/api.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	return service.NewGetLrpOK().WithPayload(getLRPs(h.db.ReadTxn(), h.lrps, h.frontends, h.pods))
func getLRPs(txn statedb.ReadTxn, lrps statedb.Table[*LocalRedirectPolicy], frontends statedb.Table[*lb.Frontend], pods statedb.Table[k8sTables.LocalPod]) []*models.LRPSpec {
		list = append(list, lrp.getModel(txn, frontends, pods))
func (lrp *LocalRedirectPolicy) getModel(txn statedb.ReadTxn, frontends statedb.Table[*lb.Frontend], pods statedb.Table[k8sTables.LocalPod]) *models.LRPSpec {
		FrontendMappings: lrp.getFrontendMappingModels(txn, frontends, pods),
// Returns frontend mappings for a LocalRedirectPolicy using StateDB frontends and their
// associated backends.
	lrpServiceName := lrp.RedirectServiceName()
		// Only report mappings for frontends that this LRP currently owns. The
		// configured mapping alone does not mean the redirect was installed: another
		// service may own the same address.
		feMappingModelArray := make([]*models.FrontendMapping, 0, len(lrp.FrontendMappings))
			fe, _, found := frontends.Get(txn, lb.FrontendByAddress(feM.feAddr))
			if !found ||
				fe.Type != lb.SVCTypeLocalRedirect ||
				!fe.ServiceName.Equal(lrpServiceName) {
				continue
			}

```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	"strings"
	backends  statedb.Table[*lb.Backend]
	return service.NewGetLrpOK().WithPayload(getLRPs(h.db.ReadTxn(), h.lrps, h.frontends, h.backends, h.pods))
func getLRPs(txn statedb.ReadTxn, lrps statedb.Table[*LocalRedirectPolicy], frontends statedb.Table[*lb.Frontend], backends statedb.Table[*lb.Backend], pods statedb.Table[k8sTables.LocalPod]) []*models.LRPSpec {
		list = append(list, lrp.getModel(txn, frontends, backends, pods))
func (lrp *LocalRedirectPolicy) getModel(txn statedb.ReadTxn, frontends statedb.Table[*lb.Frontend], backends statedb.Table[*lb.Backend], pods statedb.Table[k8sTables.LocalPod]) *models.LRPSpec {
		FrontendMappings: lrp.getFrontendMappingModels(txn, frontends, backends, pods),
// filterBackendsByFrontendMapping narrows the backend list of a pseudo-service
// generated from an addressMatcher LRP to a subset of pods that would actually
// be mapped by the controller.
func filterBackendsByFrontendMapping(
	bes lb.BackendsSeq2,

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T17:18:40.831Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795022320831",
    "title": "loadbalancer: report effective LocalRedirect mappings",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cilium-cilium-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9d7b351abf92afe36f6267d331a87f8324e8720d6c169d787cdca24876341667"
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
        "Harvested/verified timestamp recorded: 2026-11-18T17:18:40.832Z"
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
  "auth_token": "6767296ab57918e1d5acf984dd037d1155b58cc8d9fc05d2599e6389d2bd3fdd"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
