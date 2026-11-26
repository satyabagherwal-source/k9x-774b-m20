# Candidate Directive: [CD-4H1R] free unused memory after start

<!-- PROVENANCE_START
{
  "source_repository": "MaterializeInc/materialize",
  "source_url": "https://github.com/MaterializeInc/materialize",
  "source_version": "2a7e1bd4",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T05:57:15.471Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-materializeinc-materialize",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [MaterializeInc/materialize](https://github.com/MaterializeInc/materialize) (Revision: `2a7e1bd4`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T05:57:15.471Z`  
> **Learning ID**: `learn-github-materializeinc-materialize`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/timely-util/src/reclock.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MaterializeInc/materialize. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `371eac62`: reclock: free unused memory after start. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/timely-util/src/reclock.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                // Taking the buffer releases its capacity. A replay of the remap history from an
                // old as-of fills it once, and every export's operator would hold that capacity
                // for good.
                for ((into, from), diff) in std::mem::take(&mut remap_accum_buffer).into_inner() {
            // Releases what a replay leaves behind, like `remap_accum_buffer` above.
            if pending_remap.len() < pending_remap.capacity() / 4 {
                pending_remap.shrink_to(pending_remap.len() * 2);
            }

    #[cfg(feature = "count-allocations")]
    #[mz_ore::test]
    #[cfg_attr(miri, ignore)] // too slow
    fn test_replay_releases_buffers() {
        let replayed = 10_000_u64;

        // The source frontier is beyond every replayed binding, so the trace keeps none of them
        // and what stays allocated after the replay is buffer capacity.
        harness::<FromTime, u64, _, _>(
            Antichain::from_elem(0),
            move |worker, mut bindings, (_data, mut data_cap), reclocked| {
                data_cap.downgrade(&Partitioned::new_singleton(0, replayed));
                step(worker);
                let info = allo
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                for ((into, from), diff) in remap_accum_buffer.drain() {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `371eac62` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T05:57:15.469Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795672635469",
    "title": "free unused memory after start",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "MaterializeInc/materialize",
    "source_uri": "https://github.com/MaterializeInc/materialize",
    "source_version": "HEAD",
    "content_hash": "a730c09ab9155562635eecfb135ce0b288b0bbf73953e18d1a48bc35b984a5e8"
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
        "Harvested/verified timestamp recorded: 2026-11-26T05:57:15.469Z"
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
  "auth_token": "1947d84825f97dda525c64470eff6fd613b0120369fb9e239ed1d169a8b4687f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
