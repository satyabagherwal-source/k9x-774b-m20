# Candidate Directive: [CD-VICJ] Dual-Barrier Staleness Detection for Distributed Reads

<!-- PROVENANCE_START
{
  "source_repository": "rqlite/rqlite",
  "source_url": "https://github.com/rqlite/rqlite",
  "source_version": "b9dc726d",
  "license": "MIT",
  "timestamp": "2026-11-17T08:09:13.123Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rqlite-rqlite",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rqlite/rqlite](https://github.com/rqlite/rqlite) (Revision: `b9dc726d`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:09:13.123Z`  
> **Learning ID**: `learn-github-rqlite-rqlite`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When serving local read requests from an elected node or replica in a consensus cluster, the node MUST NOT consider the read fresh based solely on the leader heartbeat timestamp. It MUST verify both:
1. Leader heartbeat reception is within the freshness window.
2. The current applied FSM index matches or exceeds the leader's commit index, OR the duration since the last applied FSM entry is within the freshness window.

**WHY**:
In Raft, a leader can broadcast cheap periodic empty heartbeats to maintain leadership without transmitting actual AppendEntries messages, or a follower may fall behind during heavy write ingestion while still acknowledging empty heartbeats. Relying solely on `time.Since(lastHeartbeat) < freshness` allows read-after-write violations, stale views, and reads from partitioned nodes.

**WHEN TO APPLY**:
Any distributed state machine providing tunable consistency levels (e.g., `weak`, `linearizable`, `freshness-bounded`).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// store/state.go
func IsStaleRead(
	lastHeartbeatTime time.Time,
	lastAppendEntriesTime time.Time,
	lastAppliedIndex uint64,
	leaderCommitIndex uint64,
	lastAppliedAtTime time.Time,
	freshness int64,
	strict bool,
) bool {
	if freshness == 0 {
		return false // Unbounded freshness explicitly opted into
	}

	// Barrier 1: Cluster connectivity / Leader lease boundary
	if time.Since(lastHeartbeatTime).Nanoseconds() > freshness {
		return true
	}

	if !strict {
		return false
	}

	// Barrier 2: Leader AppendEntries propagation check
	if time.Since(lastAppendEntriesTime).Nanoseconds() > freshness {
		return true
	}

	// Barrier 3: FSM catch-up evaluation
	if lastAppliedIndex >= leaderCommitIndex {
		return false // Up to date with latest known committed log
	}

	// Barrier 4: Index gap window check
	return time.Since(lastAppliedAtTime).Nanoseconds() > freshness
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER rely on heartbeats alone:
func IsReadStaleUnsafe(lastHeartbeat time.Time, freshness time.Duration) bool {
    // VIOLATION: Follower could be 5,000 commits behind the leader,
    // yet heartbeat is 2ms old, serving completely stale reads.
    return time.Since(lastHeartbeat) > freshness
}
```

**VERIFICATION METHOD**:
Implement property-based unit testing covering the matrix of `(heartbeat_delta, append_delta, applied_idx, commit_idx, applied_time)`:
```go
func Test_IsStaleRead_StrictMatrix(t *testing.T) {
    now := time.Now()
    freshness := int64(time.Second)

    // Heartbeat fresh, but append entries timed out -> MUST BE STALE
    stale := IsStaleRead(now, now.Add(-2*time.Second), 10, 10, now, freshness, true)
    if !stale {
        t.Fatal("expected read to be marked stale when append entries is delayed")
    }

    // Heartbeat & append fresh, but applied behind commit and applied time old -> MUST BE STALE
    stale = IsStaleRead(now, now, 10, 20, now.Add(-2*time.Second), freshness, true)
    if !stale {
        t.Fatal("expected read to be marked stale when FSM application lags beyond window")
    }
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:09:13.122Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794902953122",
    "title": "Dual-Barrier Staleness Detection for Distributed Reads",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rqlite/rqlite",
    "source_uri": "https://github.com/rqlite/rqlite",
    "source_version": "HEAD",
    "content_hash": "2a949295e584654974b257b60f9e1803dda19acf1820b572887ccd38fd42d7eb"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:09:13.122Z"
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
  "auth_token": "864d5ecca903c8c2af32e059be22b09c4266dbea5d40d295cca388adeda4a636"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
