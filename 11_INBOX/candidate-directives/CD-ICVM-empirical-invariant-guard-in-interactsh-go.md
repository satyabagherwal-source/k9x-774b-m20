# Candidate Directive: [CD-ICVM] Empirical Invariant Guard in interactsh.go

<!-- PROVENANCE_START
{
  "source_repository": "projectdiscovery/nuclei",
  "source_url": "https://github.com/projectdiscovery/nuclei",
  "source_version": "f1e6395b",
  "license": "MIT",
  "timestamp": "2026-11-16T23:35:06.418Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-projectdiscovery-nuclei",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei) (Revision: `f1e6395b`).  
> **License**: MIT | **Timestamp**: `2026-11-16T23:35:06.418Z`  
> **Learning ID**: `learn-github-projectdiscovery-nuclei`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/protocols/common/interactsh/interactsh.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in projectdiscovery/nuclei. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f1e6395b`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/protocols/common/interactsh/interactsh.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// lastExpirySweep is when dropExpiredRequests last ran, in Unix nanoseconds.
	lastExpirySweep atomic.Int64
	c.dropExpiredRequests()
// dropExpiredRequests removes the registrations past their eviction deadline,
// at most once per poll interval.
//
// The cache drops an expired entry only when its key is read again or the LRU
// needs room, and the key of a target that never calls back is never read. So
// without this, a scan keeps the event of every OOB request, response body and
// full response included, until the cache is full: CacheSize times the response
// read size. An expired entry can no longer match anyway, since the poller's
// lookup drops it unprocessed.
func (c *Client) dropExpiredRequests() {
	now := time.Now().UnixNano()
	last := c.lastExpirySweep.Load()
	if now-last < int64(c.pollDuration) || !c.lastExpirySweep.CompareAndSwap(last, now) {
		return
	}

	// The write lock keeps a registration from being replaced between its
	// expiry check and its removal.
	c.requestLifecycleMu.Lock()
	defer c.requestLifecycleMu.Unlock()

	for _, id := range c.requests.Keys(false) {
		if !c.requests.Has(id) {
			c.requests.Remove(id)
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
Automated regression test asserting that input states reproducing defect `f1e6395b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T23:35:06.416Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794872106416",
    "title": "Empirical Invariant Guard in interactsh.go",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "projectdiscovery/nuclei",
    "source_uri": "https://github.com/projectdiscovery/nuclei",
    "source_version": "HEAD",
    "content_hash": "58c9b40e86373f67279ba0f005a07a83cba4ca0495b925e08b9c1e0a2a586692"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T23:35:06.416Z"
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
  "auth_token": "83881f0b8c29b180636dea69b498314be9f304b0d64c010351e3062b5ce12c1b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
