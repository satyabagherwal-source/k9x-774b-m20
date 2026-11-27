# Candidate Directive: [CD-XXYX] cilium-cli/egressgateway: fix non-egress IP host IP checks (ENI)

<!-- PROVENANCE_START
{
  "source_repository": "cilium/cilium",
  "source_url": "https://github.com/cilium/cilium",
  "source_version": "c07795fa",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T07:03:50.073Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-cilium-cilium",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cilium/cilium](https://github.com/cilium/cilium) (Revision: `c07795fa`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T07:03:50.073Z`  
> **Learning ID**: `learn-github-cilium-cilium`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cilium-cli/connectivity/tests/egressgateway.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cilium/cilium. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0bcc7103`: cilium-cli/egressgateway: fix non-egress IP host IP checks (ENI). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cilium-cli/connectivity/tests/egressgateway.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
				if ipFam == features.IPFamilyV6 && !ipv6Enabled {
					return
				}

				egressIP := egressGatewayNodeInternalIP
				if ipFam == features.IPFamilyV6 {
					egressIP = egressGatewayNodeInternalIPv6
				}

				clientNodeIP, _ := netip.ParseAddr(client.Pod.Status.HostIP)
						parsed, err := netip.ParseAddr(addr.IP)
						if err == nil && parsed.Unmap().Is6() {
							clientNodeIP = parsed
					if a.Failed() {
						return
					}

					clientIP, err := extractClientIPFromResponse(a.CmdOutput())
					if err != nil {
						a.Failf("Cannot extract client IP from response %q: %s", a.CmdOutput(), err)
						return
					}

					// If the egress IP would be the same as the client's node IP then
					// we don't know whether it was masqueraded locally due to exclusion
					// or due to egress-gateway.
					if clientNodeIP == egressIP {
						a.Logf("client node IP and egress IP are the same (%s), check to ensure connection was not masqueraded by egress-gateway IP is inconclusive", clientNodeIP)
					} else {
						if ip.CompareUnmap(clientIP, egressIP) == 0 {
							a.Failf("Excluded-CIDR traffic was masqueraded with egress gateway IP %s for pod %s/%s (actual: %s); exclusion did not take 
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
				hostIP, _ := netip.ParseAddr(client.Pod.Status.HostIP)
					if !ipv6Enabled {
						return
					}
						ip, err := netip.ParseAddr(addr.IP)
						if err == nil && ip.Unmap().Is6() {
							hostIP = ip
					validateEgressGatewayClientIP(a, hostIP)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0bcc7103` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T07:03:50.071Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795763030071",
    "title": "cilium-cli/egressgateway: fix non-egress IP host IP checks (ENI)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cilium/cilium",
    "source_uri": "https://github.com/cilium/cilium",
    "source_version": "HEAD",
    "content_hash": "ef30d441a34a00f3dda68202b240063f31d161683a4efb299ff615685eed391c"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-27T07:03:50.071Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "5d5ecb251d0ab47558aaa1e7f2f8eb610fd3c1e31f8f3ac31686e6cbd31da260"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
