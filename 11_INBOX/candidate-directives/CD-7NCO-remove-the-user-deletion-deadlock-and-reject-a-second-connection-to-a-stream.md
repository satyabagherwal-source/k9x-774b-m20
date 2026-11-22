# Candidate Directive: [CD-7NCO] remove the user deletion deadlock and reject a second connection to a stream

<!-- PROVENANCE_START
{
  "source_repository": "nezhahq/nezha",
  "source_url": "https://github.com/nezhahq/nezha",
  "source_version": "22f2184e",
  "license": "WTFPL",
  "timestamp": "2026-11-22T04:29:03.864Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nezhahq-nezha",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nezhahq/nezha](https://github.com/nezhahq/nezha) (Revision: `22f2184e`).  
> **License**: WTFPL | **Timestamp**: `2026-11-22T04:29:03.864Z`  
> **Learning ID**: `learn-github-nezhahq-nezha`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `service/rpc/io_stream_duplicate_user_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nezhahq/nezha. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c9339e68`: remove the user deletion deadlock and reject a second connection to a stream. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `service/rpc/io_stream_duplicate_user_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
package rpc

import (
	"errors"
	"testing"
)

// A second WebSocket opened with the same session ID used to replace the first
// connection and start a second pair of relay goroutines over the same buffer.
// A large Agent frame then indexed past the slice and took the whole dashboard
// process down.
func TestUserConnectedRejectsASecondConnectionToTheSameStream(t *testing.T) {
	handler := NewNezhaHandler()
	const streamID = "11111111-1111-1111-1111-111111111111"
	handler.CreateStream(streamID, 100, 0)
	first, second := newPipeReadWriter(), newPipeReadWriter()
	defer first.Close()
	defer second.Close()

	if err := handler.UserConnected(streamID, first); err != nil {
		t.Fatalf("first connection: %v", err)
	}
	err := handler.UserConnected(streamID, second)

	if !errors.Is(err, ErrUserStreamAlreadyConnected) {
		t.Fatalf("second connection err = %v, want ErrUserStreamAlreadyConnected", err)
	}
	stream, getErr := handler.GetStream(streamID)
	if getErr != nil {
		t.Fatalf("GetStream: %v", getErr)
	}
	attached, _ := handler.streamEndpoints(stream)
	if attached != first {
		t.Fatal("the second connection replaced the first one")
	}
}
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c9339e68` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T04:29:03.862Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795321743862",
    "title": "remove the user deletion deadlock and reject a second connection to a stream",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nezhahq/nezha",
    "source_uri": "https://github.com/nezhahq/nezha",
    "source_version": "HEAD",
    "content_hash": "8a644fbe173a8adb236b3dfad7a02fa7897791cda42079c06f6f1aee3539cc95"
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
        "Harvested/verified timestamp recorded: 2026-11-22T04:29:03.862Z"
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
  "auth_token": "2b6d23dd636cd798288f590eb5aff56307040d9645afe34ef9823283679fea31"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
