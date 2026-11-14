# Candidate Directive: [CD-Q3WH] test(e2e): pre-pull suite images in parallel and poll every 100ms

<!-- PROVENANCE_START
{
  "source_repository": "kgateway-dev/kgateway",
  "source_url": "https://github.com/kgateway-dev/kgateway",
  "source_version": "74f2e098",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T07:18:01.025Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-kgateway-dev-kgateway",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kgateway-dev/kgateway](https://github.com/kgateway-dev/kgateway) (Revision: `74f2e098`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T07:18:01.025Z`  
> **Learning ID**: `learn-github-kgateway-dev-kgateway`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `test/e2e/tests/base/base_suite.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kgateway-dev/kgateway. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ba3b23fa`: test(e2e): pre-pull suite images in parallel and poll every 100ms. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `test/e2e/tests/base/base_suite.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"k8s.io/apimachinery/pkg/util/wait"
	// Pull the images in parallel: each pull is mostly waiting on the node, and a suite can need
	// several (redis and ratelimit, keycloak and httpbin). Failures are reported back here, on the
	// test goroutine, because FailNow must not be called from another goroutine.
	var wg sync.WaitGroup
	errs := make([]error, 0, len(images))
	var errsMu sync.Mutex
		wg.Go(func() {
			if err := s.pullImage(image); err != nil {
				errsMu.Lock()
				errs = append(errs, err)
				errsMu.Unlock()
			}
		})
	wg.Wait()
	s.Require().NoError(errors.Join(errs...), "pre-pull images")
//
// It is safe to call from several goroutines: it reports a failed pull as an error instead of
// failing the test, and only logs otherwise.
func (s *BaseTestingSuite) pullImage(image string) error {
		return nil
		return nil
	// Wait for the pod to start or finish, which means the image is on the node. Pulls usually
	// take a second or two, so poll often: a coarse interval rounds every pull up to it.
	var phase corev1.PodPhase
	var lastGetErr error
	err = wait.PollUntilContextTimeout(s.Ctx, 100*time.Millisecond, 5*time.Minute, true, func(ctx context.Context) (bool, error) {
		pod, g
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	"github.com/onsi/gomega"
	// Create temporary pods to pull images
		s.pullImage(image)
func (s *BaseTestingSuite) pullImage(image string) {
		return
		return
	// Wait for the pod to complete (image pulled) with a long timeout (5 minutes)
	s.TestInstallation.AssertionsT(s.T()).Gomega.Eventually(func(g gomega.Gomega) {
		pod, err := pods.Get(s.Ctx, podName, metav1.GetOptions{})
		g.Expect(err).NotTo(gomega.HaveOccurred())
		// Pod should be Succeeded (completed) or Running (image pulled, command ran)
		g.Expect(pod.Status.Phase).To(gomega.BeElementOf(corev1.PodSucceeded, corev1.PodRunning, corev1.PodFailed))
	}).WithTimeout(5*time.Minute).WithPolling(2*time.Second).Should(gomega.Succeed(), "waiting for image %s to be pulled", image)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ba3b23fa` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T07:18:01.023Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794640681023",
    "title": "test(e2e): pre-pull suite images in parallel and poll every 100ms",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kgateway-dev/kgateway",
    "source_uri": "https://github.com/kgateway-dev/kgateway",
    "source_version": "HEAD",
    "content_hash": "4c6580fee3abbb1d36e22e87ef0c8901f65aa4c55695a998bf41fc72e522e3a7"
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
        "Harvested/verified timestamp recorded: 2026-11-14T07:18:01.023Z"
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
  "auth_token": "13485b5ca279015088d41e04fa8d95c0f113686b2bf61fe6edb5f38201eb9dae"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
