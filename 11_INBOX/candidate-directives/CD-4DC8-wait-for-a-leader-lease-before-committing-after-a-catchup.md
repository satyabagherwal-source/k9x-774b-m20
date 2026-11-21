# Candidate Directive: [CD-4DC8] wait for a Leader lease before committing after a catchup

<!-- PROVENANCE_START
{
  "source_repository": "GreptimeTeam/greptimedb",
  "source_url": "https://github.com/GreptimeTeam/greptimedb",
  "source_version": "87875513",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T13:30:43.208Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-greptimeteam-greptimedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb) (Revision: `87875513`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T13:30:43.208Z`  
> **Learning ID**: `learn-github-greptimeteam-greptimedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/mito2/AGENTS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5952a49e`: mito2): wait for a Leader lease before committing after a catchup. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/mito2/AGENTS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  `engine/index_build_test.rs` and `compaction/`. A background rebuild must not replace a file
  that carries extension indexes (`worker/handle_rebuild_index.rs::needs_background_indexes`).
  and `defers_background_flush()`, a flush request `is_flushable()` and `is_staging()` (`is_writable()` and
- On a node whose writes need a lease, a region that a catchup made writable waits for a
  Leader or StagingLeader lease sent after the catchup (`awaits_leader_lease`). Until then
  `ManifestContext::update_locked` refuses its commits unless they are staged or the region is
  downgrading (a close that must flush downgrades first); only a replay of tails
  (`TailsEditor::Replay`) skips the check, a discard does not, and ending staging checks it
  before `commit_staged_locked`. No flush or compaction trigger starts work for a waiting region except
  a downgrade's flush. The lease that ends the wait wakes the worker
  (`handle_leader_lease_wait_ended`) to schedule the flushes the wait deferred and, only if the
  region is then a writable leader, start a compaction, build missing indexes, re-issue the
  index build retries the wait refused and persist backfilled metadata.
  a worker's region m
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  `engine/index_build_test.rs` and `compaction/`.
  and `is_staging()`, a flush request `is_flushable()` and `is_staging()` (`is_writable()` and
  a worker's region map must also remove its record: `RegionWorkerLoop::remove_region`
  (`worker/handle_close.rs`, also used after a close-time flush), `drop_region`
  (`worker/handle_drop.rs`) and `RegionWorkerLoop::clean` (`worker.rs`).
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5952a49e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T13:30:43.206Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795267843206",
    "title": "wait for a Leader lease before committing after a catchup",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "GreptimeTeam/greptimedb",
    "source_uri": "https://github.com/GreptimeTeam/greptimedb",
    "source_version": "HEAD",
    "content_hash": "4478a93ce6a6857c4de8a49150cf3199d6732be85eff62e002db4ae59b3ca386"
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
        "Harvested/verified timestamp recorded: 2026-11-21T13:30:43.206Z"
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
  "auth_token": "725a11f236d9460a03cf88e8b9ea0cec1e1b316184d6d6f3185806aaf7583ad0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
