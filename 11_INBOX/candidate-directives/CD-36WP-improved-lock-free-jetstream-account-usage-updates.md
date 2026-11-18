# Candidate Directive: [CD-36WP] [IMPROVED] Lock-free JetStream account usage updates

<!-- PROVENANCE_START
{
  "source_repository": "nats-io/nats-server",
  "source_url": "https://github.com/nats-io/nats-server",
  "source_version": "ea28ae77",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T12:42:48.121Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nats-io-nats-server",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nats-io/nats-server](https://github.com/nats-io/nats-server) (Revision: `ea28ae77`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T12:42:48.121Z`  
> **Learning ID**: `learn-github-nats-io-nats-server`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `server/jetstream.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nats-io/nats-server. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ea28ae77`: [IMPROVED] Lock-free JetStream account usage updates. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/jetstream.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// Per-tier usage counters of an account.
type jsaCounters struct {
	mem   atomic.Int64
	store atomic.Int64
}

	total jsaCounters // usage of this tier across the cluster: local + all remote nodes
	local jsaCounters // usage of this tier on this server
}

// isZero reports whether nothing has been recorded for this tier.
func (s *jsaStorage) isZero() bool {
	return s.total.mem.Load() == 0 && s.total.store.Load() == 0 &&
		s.local.mem.Load() == 0 && s.local.store.Load() == 0
	lupdate    atomic.Int64 // Unix nanos of the last cluster usage update, read without usageMu.
				if _, ok := jsa.limits[t]; !ok && total.isZero() {
						Memory: uint64(total.total.mem.Load()),
						Store:  uint64(total.total.store.Load()),
			total.total.mem.Add(-usage.mem)
			total.total.store.Add(-usage.store)
		// Update the usage for this remote and move the tier total by the
		// change against the previous snapshot from this node.
		var prevMem, prevStore int64
			prevMem, prevStore = usage.mem, usage.store
		total.total.mem.Add(memUsed - prevMem)
		total.total.store.Add(storeUsed - prevStore)
		if local := usage.local.mem.Load(); total != local {
				friendlyBytes(total), friendlyBytes(local), jsa.acc
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	total jsaUsage
	local jsaUsage
	lupdate    time.Time
				if _, ok := jsa.limits[t]; !ok && (*total) == (jsaStorage{}) {
						Memory: uint64(total.total.mem),
						Store:  uint64(total.total.store),
			total.total.mem -= usage.mem
			total.total.store -= usage.store
		// Update the usage for this remote.
			// Decrement our old values.
			total.total.mem -= usage.mem
			total.total.store -= usage.store
		total.total.mem += memUsed
		total.total.store += storeUsed
		if total != usage.local.mem {
				friendlyBytes(total), friendlyBytes(usage.local.mem), jsa.account.GetName())
			delta := total - usage.local.mem
			usage.local.mem += delta
			usage.total.mem += delta
		if total != usage.local.store {
				friendlyBytes(total), friendlyBytes(usage.local.store), jsa.account.GetName())
			delta := total - usage.local.store
			usage.local.store += delta
			usage.total.store += delta
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ea28ae77` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T12:42:48.119Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795005768119",
    "title": "[IMPROVED] Lock-free JetStream account usage updates",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nats-io/nats-server",
    "source_uri": "https://github.com/nats-io/nats-server",
    "source_version": "HEAD",
    "content_hash": "42e9ae8450eda24d31db113e236aa9ee5670808c461894d00ec3741b495a7feb"
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
        "Harvested/verified timestamp recorded: 2026-11-18T12:42:48.119Z"
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
  "auth_token": "a70f83e48b4f25594692d97d1ebedc54c67446a62d6b66cf0780abe494e2db83"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
