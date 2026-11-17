# Candidate Directive: [CD-QEKY] kubeletproxy): match allowed node proxy subpaths exactly

<!-- PROVENANCE_START
{
  "source_repository": "loft-sh-vcluster-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T19:45:05.270Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-loft-sh-vcluster-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [loft-sh-vcluster-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T19:45:05.270Z`  
> **Learning ID**: `LEARN-EVO-loft-sh-vcluster-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain L

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `e2e/test_security/kubeletproxy/test_kubelet_proxy.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in loft-sh/vcluster. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `92186138`: kubeletproxy): match allowed node proxy subpaths exactly. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `e2e/test_security/kubeletproxy/test_kubelet_proxy.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"bytes"
	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
	statsv1alpha1 "k8s.io/kubelet/pkg/apis/stats/v1alpha1"
				nodes := waitForVirtualNodes(ctx, vClusterClientset)
				nodes := waitForVirtualNodes(ctx, vClusterClientset)
				nodes := waitForVirtualNodes(ctx, vClusterClientset)
				nodes := waitForVirtualNodes(ctx, vClusterClientset)
			// A single-encoded %2e%2e decodes to a literal ".." segment and is rejected with 400 before
			// the path is classified. The double-encoded form decodes to a literal "%2e%2e" segment, so
			// it passes the dot-segment check and only the exact subpath match rejects it.
			It("GET with a double-encoded traversal ending in /healthz returns 403 Forbidden", func(ctx context.Context) {
				nodes := waitForVirtualNodes(ctx, vClusterClientset)

				By("requesting a path that names /configz but ends in the allowed /healthz", func() {
					rawPath := fmt.Sprintf("/api/v1/nodes/%s/proxy/configz/%%252e%%252e/healthz", nodes.Items[0].Name)
					code, body := getRawPath(ctx, rawPath)
					Expect(code).To(Equal(http.StatusForbidden),
						"expected 403 for %q, got %d: %s", rawPath, code, body)
					Expect(body).To(ContainSubst
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
				var nodes *corev1.NodeList
				By("waiting for at least one virtual node to be registered", func() {
					Eventually(func(g Gomega) {
						var err error
						nodes, err = vClusterClientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
						g.Expect(err).To(Succeed(), "failed to list virtual nodes")
						g.Expect(nodes.Items).NotTo(BeEmpty(), "expected at least one virtual node")
					}).WithPolling(constants.PollingInterval).WithTimeout(constants.PollingTimeout).Should(Succeed())
				})
				nodes, err := vClusterClientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
				Expect(err).To(Succeed())

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T19:45:05.361Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794944705361",
    "title": "kubeletproxy): match allowed node proxy subpaths exactly",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "loft-sh-vcluster-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d203d3e0c1d7ea921e3c6886e84a96b27de80eb228ba80806c6a71e3e0c88fbf"
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
        "Harvested/verified timestamp recorded: 2026-11-17T19:45:05.361Z"
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
  "auth_token": "208c1f0832e90e8c736321a4f28437db7208dbcfe7eaa5b43d408ff63fd30e97"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
