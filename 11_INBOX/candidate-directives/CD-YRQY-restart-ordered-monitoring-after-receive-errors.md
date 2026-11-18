# Candidate Directive: [CD-YRQY] restart ordered monitoring after receive errors

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin/matrixone",
  "source_url": "https://github.com/matrixorigin/matrixone",
  "source_version": "517e1695",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T00:59:31.450Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-matrixorigin-matrixone",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin/matrixone](https://github.com/matrixorigin/matrixone) (Revision: `517e1695`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T00:59:31.450Z`  
> **Learning ID**: `learn-github-matrixorigin-matrixone`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain L

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cmd/mo-service/debug_connections.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `59bf4b8f`: conntrack): restart ordered monitoring after receive errors. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/mo-service/debug_connections.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"errors"
	connsThreshold         = 1024
	conntrackRetryInterval = 5 * time.Second
	errConntrackClose       = errors.New("conntrack socket close failed")
	// Capture the factory once; every replacement has the same owner and policy.
	dial := dialConntrack
	listener, err := listenConntrack(dial)
	// Keep the existing process lifetime. Runtime replacement only happens after
	// the worker reports a fatal error; it is then safe to join that worker.
	go runConnectionTracking(context.Background(), listener, dial)
	return nil
}
// A listener owns one socket and its queues. Replacements never share queues
// or the consumer's map, so an old generation cannot update the new one.
type conntrackListener struct {
	client conntrackClient
	events chan conntrack.Event
	errors chan error
}

func listenConntrack(dial func() (conntrackClient, error)) (*conntrackListener, error) {
	c, err := dial()
	if err != nil {
		return nil, err
	}
		if closeErr := c.Close(); closeErr != nil {
			return nil, errors.Join(err, errConntrackClose, closeErr)
		}
		return nil, err
	return &conntrackListener{client: c, events: events, errors: errorChan}, nil
}
func (l *conntrackListener) close() error {
	// conntrack.C
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	connsThreshold = 1024
	c, err := dialConntrack()
		_ = c.Close()
		return err
		defer c.Close()
		logConnTrack(context.Background(), events, errorChan)
	return nil
func logConnTrack(ctx context.Context, events chan conntrack.Event, errorChan chan error) {
			return
		case ev := <-events:
		case err := <-errorChan:
			logutil.Error("conntrack: error", zap.Error(err))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `59bf4b8f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T00:59:31.448Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794963571448",
    "title": "restart ordered monitoring after receive errors",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "matrixorigin/matrixone",
    "source_uri": "https://github.com/matrixorigin/matrixone",
    "source_version": "HEAD",
    "content_hash": "973b718d2cecaf23b90ebbcc8d9dd57f96383ca87f401450944bbbf58535e2ee"
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
        "Harvested/verified timestamp recorded: 2026-11-18T00:59:31.448Z"
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
  "auth_token": "8647ed0f501ce55dd241e8821c7987a7019d0399d836769b6064afda8d8a3049"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
