# Candidate Directive: [CD-W4OT] Dual-Barrier Staleness Detection for Distributed Reads

<!-- PROVENANCE_START
{
  "source_repository": "rqlite-rqlite-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:09:41.981Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rqlite-rqlite-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rqlite-rqlite-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:09:41.981Z`  
> **Learning ID**: `LEARN-EVO-rqlite-rqlite-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:09:42.077Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794902982077",
    "title": "Dual-Barrier Staleness Detection for Distributed Reads",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rqlite-rqlite-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e2175506385bf838b3b69d30fa9496d995c7d88429b83b74085dadcbff54705d"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T08:09:42.077Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "3ef1dc65d8ae54551551c611fccc24ba1e533e64087ed808f36a7cf39f7e74f9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
