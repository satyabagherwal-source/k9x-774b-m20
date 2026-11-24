# Candidate Directive: [CD-7Q49] hand-driven cold-GET fixture, event-joined cluster runners, #3510 doc comm

<!-- PROVENANCE_START
{
  "source_repository": "xerj-org/xerj",
  "source_url": "https://github.com/xerj-org/xerj",
  "source_version": "7ba0069e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T05:28:27.129Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-xerj-org-xerj",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xerj-org/xerj](https://github.com/xerj-org/xerj) (Revision: `7ba0069e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T05:28:27.129Z`  
> **Learning ID**: `learn-github-xerj-org-xerj`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain J

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `engine/crates/xerj-api/tests/cluster_metadata_replicates.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a7b82e8b`: test: hand-driven cold-GET fixture, event-joined cluster runners, #3510 doc comments on the right fns. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `engine/crates/xerj-api/tests/cluster_metadata_replicates.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Wait for a member's runner task to exit after its shutdown watch was set.
///
/// The runner races the shutdown watch against each step
/// (`ClusterRunner::run`), so the join is the event: it resolves on the
/// runner's next poll. It was a 5 s wall-clock join (left by #3516), which a
/// runner starved at load 100+ can miss while still stopping correctly.
/// [`RAFT_HANG_GUARD`] only catches a runner that never exits.
async fn join_runner(member: &mut Member) {
    let Some(task) = member.runner.take() else {
        return;
    };
    match tokio::time::timeout(RAFT_HANG_GUARD, task).await {
        Ok(Ok(())) => {}
        Ok(Err(join)) => panic!("{} runner task failed: {join}", member.handle.node_id()),
        Err(_) => panic!(
            "{} runner did not exit in {RAFT_HANG_GUARD:?} after shutdown",
            member.handle.node_id()
        ),
    }
}

    join_runner(&mut member).await;
        join_runner(&mut member).await;
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    if let Some(task) = member.runner.take() {
        match tokio::time::timeout(Duration::from_secs(5), task).await {
            Ok(Ok(())) => {}
            other => panic!("cluster runner did not stop: {other:?}"),
        }
    }
        if let Some(task) = member.runner.take() {
            match tokio::time::timeout(Duration::from_secs(5), task).await {
                Ok(Ok(())) => {}
                other => panic!("cluster runner did not stop: {other:?}"),
            }
        }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a7b82e8b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T05:28:27.127Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795498107127",
    "title": "hand-driven cold-GET fixture, event-joined cluster runners, #3510 doc comm",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "xerj-org/xerj",
    "source_uri": "https://github.com/xerj-org/xerj",
    "source_version": "HEAD",
    "content_hash": "1277e58044eaa5fbb566044b23e122431e55622106287e5ccdbaf5cde61620f6"
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
        "Harvested/verified timestamp recorded: 2026-11-24T05:28:27.127Z"
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
  "auth_token": "16d316a5f333c901ac9f8a52b6f9420e6dc7983c0af2a544960021c5c164306e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
