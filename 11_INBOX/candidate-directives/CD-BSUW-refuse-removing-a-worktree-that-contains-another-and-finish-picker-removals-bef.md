# Candidate Directive: [CD-BSUW] refuse removing a worktree that contains another, and finish picker removals bef

<!-- PROVENANCE_START
{
  "source_repository": "max-sixty/worktrunk",
  "source_url": "https://github.com/max-sixty/worktrunk",
  "source_version": "ad139302",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T11:16:31.833Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-max-sixty-worktrunk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [max-sixty/worktrunk](https://github.com/max-sixty/worktrunk) (Revision: `ad139302`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T11:16:31.833Z`  
> **Learning ID**: `learn-github-max-sixty-worktrunk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/commands/picker/mod.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in max-sixty/worktrunk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `76f6952f`: refuse removing a worktree that contains another, and finish picker removals before exit. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/commands/picker/mod.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use worktrunk::styling::{
    eprintln, error_message, hint_message, info_message, progress_message, warning_message,
};
    join_removals();
    // `join_removals` has already finished every `alt-x` removal, so this
    // reaches only speculative work.
    if let Ok(handle) = std::thread::Builder::new()
        .spawn(move || worktrunk::shell_exec::uninterruptible(work))
    {
        REMOVALS.lock().unwrap().push(handle);
    }
}

/// Requested removals not yet joined. Returning from `main` would end them
/// midway, with the row already gone and nothing to say the worktree survived.
static REMOVALS: Mutex<Vec<std::thread::JoinHandle<()>>> = Mutex::new(Vec::new());

/// Wait for every requested removal, once skim has released the terminal.
fn join_removals() {
    let removals = std::mem::take(&mut *REMOVALS.lock().unwrap());
    if removals.iter().any(|removal| !removal.is_finished()) {
        eprintln!("{}", progress_message("Finishing worktree removal..."));
    }
    for removal in removals {
        let _ = removal.join();
    }
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use worktrunk::styling::{eprintln, error_message, hint_message, info_message, warning_message};
    // Not everything running here is discardable — an `alt-x` removal is
    // dispatched to its own thread and can still be mid-`git worktree remove`
    // if the user pressed Enter straight after. Removal threads are spawned
    // through `spawn_removal`, which marks them `uninterruptible` and lets
    // them run to completion; this reaches only speculative work.
    let _ = std::thread::Builder::new()
        .spawn(move || worktrunk::shell_exec::uninterruptible(work));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `76f6952f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T11:16:31.831Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795259791830",
    "title": "refuse removing a worktree that contains another, and finish picker removals bef",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "max-sixty/worktrunk",
    "source_uri": "https://github.com/max-sixty/worktrunk",
    "source_version": "HEAD",
    "content_hash": "7510a510d0e79748f3c1a1455ee62096c409c7b8ce48687d4504081219ec9a06"
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
        "Harvested/verified timestamp recorded: 2026-11-21T11:16:31.831Z"
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
  "auth_token": "3ea0d3f773bac21452f935ab513141e6bada76d5a35bda6772052eded0eff531"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
