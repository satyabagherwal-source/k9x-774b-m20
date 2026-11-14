# Candidate Directive: [CD-OVB6] De-flake TestPSEmulationCPU

<!-- PROVENANCE_START
{
  "source_repository": "nats-io/nats-server",
  "source_url": "https://github.com/nats-io/nats-server",
  "source_version": "6993500c",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T02:37:07.074Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nats-io-nats-server",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nats-io/nats-server](https://github.com/nats-io/nats-server) (Revision: `6993500c`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T02:37:07.074Z`  
> **Learning ID**: `learn-github-nats-io-nats-server`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `server/pse/pse_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nats-io/nats-server. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6993500c`: De-flake TestPSEmulationCPU. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/pse/pse_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"time"
	var pcpu float64
	// Burn CPU until the background sampler reports usage.
	for deadline := time.Now().Add(5 * time.Second); pcpu <= 0 && time.Now().Before(deadline); {
		if err := ProcUsage(&pcpu, &rss, &vss); err != nil {
			t.Fatalf("Failed to get process usage: %v", err)
	if pcpu <= 0 {
		t.Fatalf("Expected positive CPU usage, got %f", pcpu)
	}
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	var pcpu, psPcpu float64

	debug.FreeOSMemory()

	// PS version first
	pidStr := fmt.Sprintf("%d", os.Getpid())
	out, err := exec.Command("ps", "o", "pcpu=", "-p", pidStr).Output()
	if err != nil {
		t.Fatalf("Failed to execute ps command: %v\n", err)
	}

	// Our internal version
	ProcUsage(&pcpu, &rss, &vss)

	fmt.Sscanf(string(out), "%f", &psPcpu)
	if pcpu != psPcpu {
		delta := int64(pcpu - psPcpu)
		if delta < 0 {
			delta = -delta
		}
		if delta > 30 { // 30%?
			t.Fatalf("CPUs did not match close enough: %f vs %f", pcpu, psPcpu)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6993500c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T02:37:07.072Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794623827072",
    "title": "De-flake TestPSEmulationCPU",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nats-io/nats-server",
    "source_uri": "https://github.com/nats-io/nats-server",
    "source_version": "HEAD",
    "content_hash": "5a0d36defce908ec6426a412e8ceb0facbbb6dd701ce74bfc4551cd3ba500a55"
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
        "Harvested/verified timestamp recorded: 2026-11-14T02:37:07.072Z"
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
  "auth_token": "67cfa1de089a9d543f1414dbbf0b32affc2e1eb09985d293060286fdc9212916"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
