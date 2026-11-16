# Candidate Directive: [CD-TB1W] keep healthy BGP instances running when one fails

<!-- PROVENANCE_START
{
  "source_repository": "siderolabs/talos",
  "source_url": "https://github.com/siderolabs/talos",
  "source_version": "a5b5d7de",
  "license": "MPL-2.0",
  "timestamp": "2026-11-16T22:47:38.037Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-siderolabs-talos",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [siderolabs/talos](https://github.com/siderolabs/talos) (Revision: `a5b5d7de`).  
> **License**: MPL-2.0 | **Timestamp**: `2026-11-16T22:47:38.037Z`  
> **Learning ID**: `learn-github-siderolabs-talos`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `internal/app/machined/pkg/controllers/network/bgp.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in siderolabs/talos. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4f583972`: keep healthy BGP instances running when one fails. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/app/machined/pkg/controllers/network/bgp.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"time"
	"github.com/cenkalti/backoff/v7"
	retryBackoff := backoff.NewExponentialBackOff()

	var retryCh <-chan time.Time

		case <-retryCh:
		failed, err := ctrl.reconcile(ctx, r, logger)
		if err != nil {
		// failed instances and peers are retried here: a controller restart would also stop the healthy ones
		if failed {
			retryCh = time.After(retryBackoff.NextBackOff())
		} else {
			retryBackoff.Reset()

			retryCh = nil
		}

// reconcile reports whether an instance failed and needs a retry.
//
func (ctrl *BGPController) reconcile(ctx context.Context, r controller.Runtime, logger *zap.Logger) (bool, error) {
		return false, fmt.Errorf("error listing BGP instance configs: %w", err)
		return false, fmt.Errorf("error listing link statuses: %w", err)
		return false, fmt.Errorf("error listing address statuses: %w", err)
	var failed bool

			instanceLogger.Error("error configuring BGP instance", zap.Error(err))

			failed = true

			if !instance.Running() {
				continue
			}
			instanceLogger.Error("error originating BGP routes", zap.Error(err))

			failed = true

			continue
			logger.With(zap.String("instance", name)).Error("error resolving BGP route imports", zap.Error(importErr)
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
		if err := ctrl.reconcile(ctx, r, logger); err != nil {
func (ctrl *BGPController) reconcile(ctx context.Context, r controller.Runtime, logger *zap.Logger) error {
		return fmt.Errorf("error listing BGP instance configs: %w", err)
		return fmt.Errorf("error listing link statuses: %w", err)
		return fmt.Errorf("error listing address statuses: %w", err)
			return fmt.Errorf("error configuring BGP instance %q: %w", name, err)
			return fmt.Errorf("error originating routes for BGP instance %q: %w", name, err)
			return fmt.Errorf("error resolving route imports for BGP instance %q: %w", name, importErr)
	return ctrl.writeOutputs(ctx, r, outputs)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4f583972` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T22:47:38.035Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794869258035",
    "title": "keep healthy BGP instances running when one fails",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "siderolabs/talos",
    "source_uri": "https://github.com/siderolabs/talos",
    "source_version": "HEAD",
    "content_hash": "b2468680a38f0bea27cfd13285ac5a92208e6d5f7913e58f6e19bbb0f76cfdc5"
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
        "Harvested/verified timestamp recorded: 2026-11-16T22:47:38.035Z"
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
  "auth_token": "97b050006ccb3590a40a8564d5c8567f27ebcb94ead0b481411e001e0bf901c0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
