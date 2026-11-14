# Candidate Directive: [CD-GISX] Block modal, Files and inbox loader fixes from the e2e gates; harness hardening

<!-- PROVENANCE_START
{
  "source_repository": "keybase/client",
  "source_url": "https://github.com/keybase/client",
  "source_version": "c241b403",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-14T04:50:35.697Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-keybase-client",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [keybase/client](https://github.com/keybase/client) (Revision: `c241b403`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-14T04:50:35.697Z`  
> **Learning ID**: `learn-github-keybase-client`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `go/chat/logout_stop_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in keybase/client. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `44ab4afa`: Block modal, Files and inbox loader fixes from the e2e gates; harness hardening. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `go/chat/logout_stop_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

// A Start right after a Stop, before the stop's wait on the work group has returned, must wait for
// it: starting the work group again while it is being waited on panics ("WaitGroup is reused
// before previous Wait has returned"). Back-to-back account switches do exactly this.
func TestUIInboxLoaderStartWaitsForPreviousStop(t *testing.T) {
	tc, g, _ := setupLogoutStopTest(t, "TestUIInboxLoaderStartWaitsForPreviousStop")
	defer tc.Cleanup()

	ctx := context.TODO()
	loader := NewUIInboxLoader(g)
	release, stopped := holdUIInboxLoaderStop(ctx, loader)

	started := make(chan struct{})
	go func() {
		loader.Start(ctx, gregor1.UID([]byte("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")))
		close(started)
	}()
	select {
	case <-started:
		t.Fatal("Start returned while the previous Stop was still waiting on the work group")
	case <-time.After(200 * time.Millisecond):
	}

	release()
	<-stopped
	requireDone(t, started, "Start did not return once the previous Stop finished")
	<-loader.Stop(ctx)
}

// Holds the loader's previous stop pending: the returned func lets it finish.
func holdUIInboxLoaderStop(ctx context.Context, loader *UIInboxLoader) (release func(), stopped chan struct{}) {
	loader.Start(c
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `44ab4afa` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T04:50:35.695Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794631835695",
    "title": "Block modal, Files and inbox loader fixes from the e2e gates; harness hardening",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "keybase/client",
    "source_uri": "https://github.com/keybase/client",
    "source_version": "HEAD",
    "content_hash": "dc42904d241da8d85a2fc41a1268764ff550ab53ab32377a05faf4b1ed3b754a"
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
        "Harvested/verified timestamp recorded: 2026-11-14T04:50:35.695Z"
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
  "auth_token": "8edd035df76f628c19ccae5640b1e2a26c1cefbf6fb6dca42d2bf8a0a8a71d24"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
