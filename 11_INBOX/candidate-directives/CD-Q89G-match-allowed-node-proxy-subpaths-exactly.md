# Candidate Directive: [CD-Q89G] match allowed node proxy subpaths exactly

<!-- PROVENANCE_START
{
  "source_repository": "loft-sh/vcluster",
  "source_url": "https://github.com/loft-sh/vcluster",
  "source_version": "92186138",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T19:44:57.173Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-loft-sh-vcluster",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [loft-sh/vcluster](https://github.com/loft-sh/vcluster) (Revision: `92186138`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T19:44:57.173Z`  
> **Learning ID**: `learn-github-loft-sh-vcluster`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
				Expect(nodes.Items).NotTo(BeEmpty())
				nodes, err := vClusterClientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
				Expect(err).To(Succeed())
				Expect(nodes.Items).NotTo(BeEmpty())
				nodes, err := vClusterClientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
				Expect(err).To(Succeed())
				Expect(nodes.Items).NotTo(BeEmpty())
			// The following two specs share a running pod, so they run sequentially in an Ordered
			// context. BeforeAll creates the pod once; both It blocks depend on it existing.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `92186138` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T19:44:57.171Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794944697171",
    "title": "match allowed node proxy subpaths exactly",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "loft-sh/vcluster",
    "source_uri": "https://github.com/loft-sh/vcluster",
    "source_version": "HEAD",
    "content_hash": "318cce17df4760fe2dd069bfe366bd022e073524e2fc3b53439b435f1d64b78c"
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
        "Harvested/verified timestamp recorded: 2026-11-17T19:44:57.171Z"
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
  "auth_token": "9d4833bb4e36c1f1b11ce29de60f764821bf6be0ba3f947c8ac3e8aa29f6a922"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
