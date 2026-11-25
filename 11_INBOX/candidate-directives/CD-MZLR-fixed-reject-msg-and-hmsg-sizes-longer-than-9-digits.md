# Candidate Directive: [CD-MZLR] [FIXED] Reject MSG and HMSG sizes longer than 9 digits

<!-- PROVENANCE_START
{
  "source_repository": "nats-io/nats.go",
  "source_url": "https://github.com/nats-io/nats.go",
  "source_version": "c0846a17",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T11:59:54.303Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nats-io-nats-go",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nats-io/nats.go](https://github.com/nats-io/nats.go) (Revision: `c0846a17`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T11:59:54.303Z`  
> **Learning ID**: `learn-github-nats-io-nats-go`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `nats_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nats-io/nats.go. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c0846a17`: [FIXED] Reject MSG and HMSG sizes longer than 9 digits. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `nats_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
func TestParserMsgSizeLimit(t *testing.T) {
	for _, proto := range []string{
		"MSG foo 1 9223372036854775807\r\n",
		"MSG foo 1 _INBOX.bar 9223372036854775807\r\n",
		"MSG foo 1 4611686018427387904\r\n",
		"HMSG foo 1 0 9223372036854775807\r\n",
		"HMSG foo 1 _INBOX.bar 0 9223372036854775807\r\n",
		"HMSG foo 1 4611686018427387904 4611686018427387904\r\n",
	} {
		nc := &Conn{ps: &parseState{}}
		if err := nc.parse([]byte(proto)); err == nil {
			t.Errorf("Expected a parse error for %q", proto)
		}
	}

	// The server never sends sizes longer than 9 digits.
	for _, tc := range []struct {
		hdr  int
		args string
		ok   bool
	}{
		{-1, "foo 1 999999999", true},
		{-1, "foo 1 1000000000", false},
		{0, "foo 1 999999999 999999999", true},
		{0, "foo 1 1000000000 1000000000", false},
	} {
		nc := &Conn{ps: &parseState{hdr: tc.hdr}}
		err := nc.processMsgArgs([]byte(tc.args))
		if tc.ok && (err != nil || nc.ps.ma.size != 999999999) {
			t.Errorf("Expected %q to be accepted, got size %d, err %v", tc.args, nc.ps.ma.size, err)
		}
		if !tc.ok && err == nil {
			t.Errorf("Expected %q to be rejected", tc.args)
		}
	}
}

```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c0846a17` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T11:59:54.301Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795607994301",
    "title": "[FIXED] Reject MSG and HMSG sizes longer than 9 digits",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nats-io/nats.go",
    "source_uri": "https://github.com/nats-io/nats.go",
    "source_version": "HEAD",
    "content_hash": "16d88840a96a9a0b212cc0355ce2259b863967db6f6141d05f399387e263be03"
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
        "Harvested/verified timestamp recorded: 2026-11-25T11:59:54.301Z"
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
  "auth_token": "73256e0b946238e7cffc411618c4f62d425d9ec3e8bbc5d0488bf2e56acf6c28"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
