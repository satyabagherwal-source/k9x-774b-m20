# Candidate Directive: [CD-K9TA] stubbed chain links can no longer overwrite full links or crash the servi

<!-- PROVENANCE_START
{
  "source_repository": "keybase/client",
  "source_url": "https://github.com/keybase/client",
  "source_version": "0d1e3966",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-17T17:20:21.166Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-keybase-client",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [keybase/client](https://github.com/keybase/client) (Revision: `0d1e3966`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-17T17:20:21.166Z`  
> **Learning ID**: `learn-github-keybase-client`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `go/engine/identify2_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in keybase/client. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0b60c398`: libkb: stubbed chain links can no longer overwrite full links or crash the service. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `go/engine/identify2_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// A stub can land on disk in place of one of our own track links: the cleaner
// evicts the full link, then a stubbed load of our chain stores the stub.
// Identify must not crash on it, must still see the follow, and must rewrite
// the full link through its forced unstubbed reload.
func TestIdentify2WithUIDWithStubbedTrackLink(t *testing.T) {
	tc := SetupEngineTest(t, "TestIdentify2WithUIDWithStubbedTrackLink")
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	fu := CreateAndSignupFakeUser(tc, "track")
	// Only v2 links can be stubbed, and the server never stubs a chain's
	// last link, so follow bob after alice.
	trackAlice(tc, fu, libkb.KeybaseSignatureV2)
	defer untrackAlice(tc, fu, libkb.KeybaseSignatureV2)
	trackBob(tc, fu, libkb.KeybaseSignatureV2)
	defer untrackBob(tc, fu, libkb.KeybaseSignatureV2)

	// Identify loads the logged-in user with these options. Loading that way
	// here fills the UPAK cache slot identify reads, so identify gets the
	// UPAK alone and has to look the track link up in storage.
	meArg := libkb.NewLoadUserArgWithMetaContext(m).WithUID(fu.UID()).WithSelf(true).WithStubMode(libkb.StubModeUnstubbed)
	upak, _, err := tc.G.GetUPAKLoader().LoadV2(me
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0b60c398` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T17:20:21.164Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794936021164",
    "title": "stubbed chain links can no longer overwrite full links or crash the servi",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "keybase/client",
    "source_uri": "https://github.com/keybase/client",
    "source_version": "HEAD",
    "content_hash": "a6d6e5d2181c699f6bf4903bf0b921f6702dec74d883c3f929e9d646a7b2d6aa"
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
        "Harvested/verified timestamp recorded: 2026-11-17T17:20:21.164Z"
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
  "auth_token": "ef7961cc9ec3b59fa85eb722ecd7b62f5ab8f2f34f347903deebed3f8eb443c7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
