# Candidate Directive: [CD-JNHO] raven): only report tunnel endpoints as v1alpha1 activeEndpoint

<!-- PROVENANCE_START
{
  "source_repository": "openyurtio-openyurt-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T00:17:28.098Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-openyurtio-openyurt-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [openyurtio-openyurt-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T00:17:28.098Z`  
> **Learning ID**: `LEARN-EVO-openyurtio-openyurt-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/apis/raven/v1alpha1/gateway_conversion.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in openyurtio/openyurt. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4840e2d1`: raven): only report tunnel endpoints as v1alpha1 activeEndpoint. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/apis/raven/v1alpha1/gateway_conversion.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// v1alpha1 only knows the tunnel gateway, so pick the first active tunnel
	// endpoint. ActiveEndpoints is sorted by node name and may also contain
	// proxy endpoints, which must not be reported as the v1alpha1 gateway.
	src.Status.ActiveEndpoint = nil
	for _, ep := range srcRawV1beta1.Status.ActiveEndpoints {
		if ep == nil || ep.Type != v1beta1.Tunnel {
			continue
		}
			NodeName: ep.NodeName,
			PublicIP: ep.PublicIP,
			UnderNAT: ep.UnderNAT,
			Config:   ep.Config,
		break
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	if srcRawV1beta1.Status.ActiveEndpoints == nil {
		klog.Infof("convert from v1beta1 to v1alpha1 for %s", src.Name)
		return nil
	}
	if len(srcRawV1beta1.Status.ActiveEndpoints) < 1 {
		src.Status.ActiveEndpoint = nil
	} else {
			NodeName: srcRawV1beta1.Status.ActiveEndpoints[0].NodeName,
			PublicIP: srcRawV1beta1.Status.ActiveEndpoints[0].PublicIP,
			UnderNAT: srcRawV1beta1.Status.ActiveEndpoints[0].UnderNAT,
			Config:   srcRawV1beta1.Status.ActiveEndpoints[0].Config,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4840e2d1` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T00:17:28.234Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795565848234",
    "title": "raven): only report tunnel endpoints as v1alpha1 activeEndpoint",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "openyurtio-openyurt-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c332b2d82c109763b7bdaaed7599817b3b228b4330e23f0c9f4f72b328f75c1a"
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
        "Harvested/verified timestamp recorded: 2026-11-25T00:17:28.234Z"
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
  "auth_token": "3e6a013df78eaa841e9dc10d71d011178b36e231f7a9573645c99b80314fcdd5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
