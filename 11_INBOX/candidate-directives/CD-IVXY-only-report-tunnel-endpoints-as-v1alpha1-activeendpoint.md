# Candidate Directive: [CD-IVXY] only report tunnel endpoints as v1alpha1 activeEndpoint

<!-- PROVENANCE_START
{
  "source_repository": "openyurtio/openyurt",
  "source_url": "https://github.com/openyurtio/openyurt",
  "source_version": "4840e2d1",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T00:16:52.534Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-openyurtio-openyurt",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [openyurtio/openyurt](https://github.com/openyurtio/openyurt) (Revision: `4840e2d1`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T00:16:52.534Z`  
> **Learning ID**: `learn-github-openyurtio-openyurt`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-25T00:16:52.532Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795565812532",
    "title": "only report tunnel endpoints as v1alpha1 activeEndpoint",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "openyurtio/openyurt",
    "source_uri": "https://github.com/openyurtio/openyurt",
    "source_version": "HEAD",
    "content_hash": "f0f1f07c91fd796410428c0b7baeb3a274996b3136633e75e89a77f527c42aa2"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-25T00:16:52.532Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "53b7bf565a523c32191cb96f1f68aae70bee2f5e133b2d56069f69817dc90876"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
