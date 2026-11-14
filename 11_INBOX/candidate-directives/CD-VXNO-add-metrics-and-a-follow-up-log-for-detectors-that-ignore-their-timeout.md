# Candidate Directive: [CD-VXNO] Add metrics and a follow-up log for detectors that ignore their timeout

<!-- PROVENANCE_START
{
  "source_repository": "trufflesecurity/trufflehog",
  "source_url": "https://github.com/trufflesecurity/trufflehog",
  "source_version": "32e87f4f",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-14T03:10:36.324Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trufflesecurity-trufflehog",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trufflesecurity/trufflehog](https://github.com/trufflesecurity/trufflehog) (Revision: `32e87f4f`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-14T03:10:36.324Z`  
> **Learning ID**: `learn-github-trufflesecurity-trufflehog`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/engine/engine.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in trufflesecurity/trufflehog. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a4cb316c`: Add metrics and a follow-up log for detectors that ignore their timeout. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/engine/engine.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		// The callback and the deferred release below hand the worker off through fired. t.Stop() returning false
		// means the callback started, not that it finished counting, so the release waits for the channel to close
		// before it decrements the gauge. The release is deferred inside the closure that owns the FromData call,
		// so it runs on normal return and on panic unwind alike (the common.Recover at the top of detectChunk
		// catches panics) and a panic inside FromData cannot leave the gauge high. The overrun histogram and the
		// return log stay on the normal-return path only: a panicked call never returns, so it has no duration to
		// record.
		fired := make(chan struct{})
			detectorTimeoutIgnoredTotal.WithLabelValues(detectorNameStr).Inc()
			detectorWorkersOverTimeout.WithLabelValues(detectorNameStr).Inc()
			close(fired) // before the log: a slow log sink must not extend the worker hold
		var timerFired bool
		results, matchElapsed, err := func() (results []detectors.Result, matchElapsed time.Duration, err error) {
			defer func() {
				timerFired = !t.Stop()
				if timerFired {
					<-fired
					detectorWorkersOverTimeout.WithLabelValues(detectorNameStr).Dec()
				
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
		results, err := e.verificationCache.FromData(
			ctx,
			data.detector.Detector,
			data.verify,
			data.chunk.SecretID != 0,
			matchBytes)
		matchElapsed := time.Since(matchStart)
		t.Stop()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a4cb316c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T03:10:36.321Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794625836321",
    "title": "Add metrics and a follow-up log for detectors that ignore their timeout",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trufflesecurity/trufflehog",
    "source_uri": "https://github.com/trufflesecurity/trufflehog",
    "source_version": "HEAD",
    "content_hash": "1b9b9f3faebd0daa273aa5dd37111558453e8046841fc740d8d98804b4f1110e"
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
        "Harvested/verified timestamp recorded: 2026-11-14T03:10:36.321Z"
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
  "auth_token": "7737b514b5b4e4d23690a29915d174408a8ce4c39129c5a9ee85479bffc93855"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
