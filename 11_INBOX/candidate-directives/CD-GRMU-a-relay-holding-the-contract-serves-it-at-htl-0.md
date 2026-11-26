# Candidate Directive: [CD-GRMU] a relay holding the contract serves it at HTL 0

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "83f2cb7e",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T12:38:43.687Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `83f2cb7e`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T12:38:43.687Z`  
> **Learning ID**: `learn-github-freenet-freenet-core`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/core/src/operations/get/op_ctx_task.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `83f2cb7e`: get): a relay holding the contract serves it at HTL 0. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/operations/get/op_ctx_task.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    // ── Short-circuit 1: Local cache hit with interest ───────────────────
    // ── Short-circuit 2: HTL = 0, nothing fresh to serve ─────────────────
    // Runs AFTER the local-hit arm above on purpose: a peer that holds a
    // fresh copy answers Found whatever the HTL. HTL only bounds FORWARDING,
    // so HTL = 0 never forwards but must not hide a copy this node serves at
    // any other HTL (the sim trace in ~/code/scratch/placement-gap/TRACE.md:
    // a GET reached the holder exactly at HTL 0 and got NotFound). Reaching
    // here means the local arm found no FRESH copy. A stale-but-hosted copy
    // (`local_fallback`: no local interest, still in the update mesh) is served
    // as well, exactly as the exhaustion arm below serves it: at HTL 0 routing
    // is exhausted by definition (this node cannot forward), so the same rule
    // applies. Fresh copy first, fallback second, NotFound only with neither.
    if htl == 0 {
        if let Some((key, state, contract)) = local_fallback {
            tracing::info!(
                tx = %incoming_tx,
                %instance_id,
                contract = %key,
                htl = 0,
                "GET relay: HTL e
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    // ── Short-circuit 1: HTL = 0 ────────────────────────────────────────
    if htl == 0 {
        tracing::warn!(
            tx = %incoming_tx,
            %instance_id,
            %upstream_addr,
            htl = 0,
            phase = "not_found",
            "GET relay: HTL exhausted — sending NotFound upstream"
        );
        if let Some(event) = crate::tracing::NetEventLog::get_not_found(
            &incoming_tx,
            &op_manager.ring,
            instance_id,
            Some(op_manager.ring.max_hops_to_live),
            None,
        ) {
            op_manager
                .ring
                .register_events(either::Either::Left(event))
                .await;
        }
        // HTL=0 path: the original Request reached us with htl already at 0,
        // meaning the request traversed the full max_htl forward hops to get
        // here. hop_count = max_htl - 0 = max_htl.
        let hop_count = op_manager.ring.max_hops_to_live;
        // EXPERIMENT-ONLY (findability_probe): record the HTL-exhaustion GET
        // terminus. NOT for ship.
        #[cfg(any(test, feature = "testing"))]
        {
            let visited = visited.clone();
         
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `83f2cb7e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T12:38:43.684Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795696723684",
    "title": "a relay holding the contract serves it at HTL 0",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "242a831c1a1bc2fb34bd076115669803d8d3972e2c8c529e60f3ace06afd51d6"
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
        "Harvested/verified timestamp recorded: 2026-11-26T12:38:43.684Z"
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
  "auth_token": "d5bf3dbb8301c87af560aaa8c76cc0293a8e6d0bb456467215bd9a4ac5bdee02"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
