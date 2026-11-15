# Candidate Directive: [CD-M7Z4] deflake TestHTTPBandwidth on coarse-clock machines

<!-- PROVENANCE_START
{
  "source_repository": "tailscale/tailscale",
  "source_url": "https://github.com/tailscale/tailscale",
  "source_version": "daf82a50",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-15T16:50:32.032Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tailscale-tailscale",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale/tailscale](https://github.com/tailscale/tailscale) (Revision: `daf82a50`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-15T16:50:32.032Z`  
> **Learning ID**: `learn-github-tailscale-tailscale`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `prober/http_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tailscale/tailscale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `daf82a50`: prober: deflake TestHTTPBandwidth on coarse-clock machines. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `prober/http_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// /download writes exactly `size` zero bytes, pausing halfway so the
	// transfer spans more than one clock tick. A 1 MiB loopback transfer
	// takes well under a millisecond, which is below the monotonic clock's
	// granularity on the Windows CI runner, so the probe would measure a
	// transfer time of exactly 0 there.
	// See https://github.com/tailscale/tailscale/issues/21620.
		io.CopyN(w, zeroReader{}, size/2)
		w.(http.Flusher).Flush()
		time.Sleep(50 * time.Millisecond)
		io.CopyN(w, zeroReader{}, size/2)
			// full payload size, and the transfer should take a positive
			// amount of time.
			if got := transferTime(); got <= 0 {
				t.Errorf("http_bw_transfer_time_seconds_total = %v, want > 0", got)
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	// /download writes exactly `size` zero bytes.
		io.CopyN(w, zeroReader{}, size)
			// full payload size, and the transfer should take a positive,
			// finite amount of time.
			// The transfer time counter accumulates across Probe calls.
			// At 1 MiB over loopback a zero reading means the timing logic
			// is broken, but retry a few times.
			if transferTime() <= 0 {
				const retries = 3
				for range retries {
					if err := pc.Probe(ctx); err != nil {
						t.Fatalf("Probe() = %v, want nil", err)
					}
					metrics = pc.Metrics(prometheus.Labels{})
					if transferTime() > 0 {
						break
					}
				}
				if transferTime() <= 0 {
					t.Fatalf("http_bw_transfer_time_seconds_total = 0 after %d attempts, want > 0", retries+1)
				}
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `daf82a50` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T16:50:32.031Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794761432031",
    "title": "deflake TestHTTPBandwidth on coarse-clock machines",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tailscale/tailscale",
    "source_uri": "https://github.com/tailscale/tailscale",
    "source_version": "HEAD",
    "content_hash": "17c42cb303e3105da1b07e6125dfef56666c5bc753f965068fad2abe906c48b5"
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
        "Harvested/verified timestamp recorded: 2026-11-15T16:50:32.031Z"
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
  "auth_token": "279a2b4e8586bed167cd914e90987d440ea09ebbc1c07404517eb80eb4ab5b7d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
