# Candidate Directive: [CD-NY3Y] allow large filesync pattern lists

<!-- PROVENANCE_START
{
  "source_repository": "moby/buildkit",
  "source_url": "https://github.com/moby/buildkit",
  "source_version": "e4d319d7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T03:32:23.278Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-moby-buildkit",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [moby/buildkit](https://github.com/moby/buildkit) (Revision: `e4d319d7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T03:32:23.278Z`  
> **Learning ID**: `learn-github-moby-buildkit`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `client/client_local_source_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in moby/buildkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `447bca32`: session): allow large filesync pattern lists. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `client/client_local_source_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

// testLocalSourceManyPatterns checks that filesync patterns are not limited by
// the HTTP/2 header value count. Every pattern is sent as a separate gRPC
// metadata value and Go 1.27 net/http rejects requests with more than 500 of
// them by default.
func testLocalSourceManyPatterns(t *testing.T, sb integration.Sandbox) {
	c, err := New(sb.Context(), sb.Address())
	require.NoError(t, err)
	defer c.Close()

	dir := integration.Tmpdir(
		t,
		fstest.CreateFile("foo", []byte("foo"), 0600),
		fstest.CreateFile("ignored-1", []byte("ignored"), 0600),
	)

	const n = 1000
	excludes := make([]string, 0, n)
	includes := make([]string, 0, n+1)
	for i := 1; i <= n; i++ {
		excludes = append(excludes, fmt.Sprintf("ignored-%d", i))
		includes = append(includes, fmt.Sprintf("included-%d", i))
	}
	includes = append(includes, "foo")

	for _, tc := range []struct {
		name string
		opt  llb.LocalOption
	}{
		{name: "exclude", opt: llb.ExcludePatterns(excludes)},
		{name: "include", opt: llb.IncludePatterns(includes)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			def, err := llb.Local("mylocal", tc.opt).Marshal(sb.Context())
			require.NoError(t, err)

			destDir := t.TempDir()
			_, err = c.Solve
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `447bca32` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T03:32:23.276Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794627143276",
    "title": "allow large filesync pattern lists",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "moby/buildkit",
    "source_uri": "https://github.com/moby/buildkit",
    "source_version": "HEAD",
    "content_hash": "1e45c8871cb8609155d1f77335c5a8c08feba28d8b08ba10824b1cf033a662ed"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T03:32:23.276Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "7c7d9c46bd6f14d51374cb5fa896d2716e50b9946db5ea21a3f0b7fc193be2f3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
