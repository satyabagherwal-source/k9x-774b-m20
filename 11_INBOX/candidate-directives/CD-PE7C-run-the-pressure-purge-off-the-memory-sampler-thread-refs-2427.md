# Candidate Directive: [CD-PE7C] run the pressure purge off the memory sampler thread (Refs #2427)

<!-- PROVENANCE_START
{
  "source_repository": "xerj-org/xerj",
  "source_url": "https://github.com/xerj-org/xerj",
  "source_version": "98e7681c",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T06:22:30.696Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-xerj-org-xerj",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xerj-org/xerj](https://github.com/xerj-org/xerj) (Revision: `98e7681c`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T06:22:30.696Z`  
> **Learning ID**: `learn-github-xerj-org-xerj`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `engine/crates/xerj-engine/src/engine.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a8dfd181`: governor: run the pressure purge off the memory sampler thread (Refs #2427). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `engine/crates/xerj-engine/src/engine.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Runs the sampler's pressure purge on a thread of its own (#2427).
///
/// A purge hands every freed allocator page back to the kernel, and the
/// call takes about as long as the bytes it returns, roughly 125-200 ms per
/// GiB: about three quarters of it is `madvise(MADV_DONTNEED)` over many
/// small extents (median 16-32 KiB, ~2,300 calls per purge), and the stats
/// epoch is ~5%. Skipping calls with nothing to free would save little:
/// such a call costs ~2 ms. Run on the sampler thread, each call held back
/// the next RSS sample, so the breaker read an RSS figure up to 389 ms old
/// (1,722 ms once) during exactly the bursts the purge is there for. The
/// sampler now only asks. The channel is a rendezvous channel, so a
/// request lands only when the worker is idle; one that arrives mid-purge
/// is dropped and the next due tick asks again. Same
/// shape as ClickHouse's `MemoryWorker`, whose RSS thread flags a separate
/// purge thread (`src/Common/MemoryWorker.cpp:924-962`, `:1154-1230`,
/// Apache-2.0), written fresh here. Without a worker (the spawn failed)
/// the purge runs inline, as before.
struct PressurePurgeWorker {
    purge: Arc<dyn Fn() + Send + Sync + 's
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a8dfd181` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T06:22:30.695Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795414950695",
    "title": "run the pressure purge off the memory sampler thread (Refs #2427)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "xerj-org/xerj",
    "source_uri": "https://github.com/xerj-org/xerj",
    "source_version": "HEAD",
    "content_hash": "b278ffd2886f90c80af264736dc7176d9ffcd5406059aafb2c845a0a5ede5623"
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
        "Harvested/verified timestamp recorded: 2026-11-23T06:22:30.695Z"
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
  "auth_token": "9d96e147c05da5f6b682720a9dca773737ccf9a4b8c95b7694cebf5a12fae885"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
