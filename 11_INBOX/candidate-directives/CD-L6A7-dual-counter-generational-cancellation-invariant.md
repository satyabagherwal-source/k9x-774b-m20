# Candidate Directive: [CD-L6A7] Dual-Counter Generational Cancellation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "xevrion/hatchzip",
  "source_url": "https://github.com/xevrion/hatchzip",
  "source_version": "2489b928",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T00:11:58.351Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-xevrion-hatchzip",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xevrion/hatchzip](https://github.com/xevrion/hatchzip) (Revision: `2489b928`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T00:11:58.351Z`  
> **Learning ID**: `learn-github-xevrion-hatchzip`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
In asynchronous event-driven GUIs handling concurrent disk discovery, space calculation, and background workers, stateful UI controllers **MUST NOT** share a single monotonically increasing generation ID between content-loading requests and dependent sub-queries (such as space-planning or parameter recalculations). The system **MUST** maintain isolated generation counters: one for the primary asset lifecycle (`generation`) and one for secondary analytical queries (`plan_generation`).

**WHY**:
If a single generational counter is shared between long-running archive load operations and rapid UI-driven parameter updates (e.g., the user toggling "Keep Archive" or adjusting "Reserved Space"), a space-planning request triggered mid-load will increment the global generation counter. When the primary archive loader eventually completes, its stored generation counter will appear stale, causing the GUI to drop the valid archive content entirely or enter an unrecoverable loading freeze.

**WHEN TO APPLY**:
Apply to any client-side architecture (Rust/Slint, React, Swift, Flutter) where asynchronous background operations depend on an active primary data context but can trigger secondary asynchronous calculations before the primary context settles.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::cell::Cell;
use std::rc::Rc;

pub struct AsyncUiController {
    // Primary lifecycle: bumped ONLY when the active target asset changes
    asset_generation: Cell<u64>,
    // Sub-query lifecycle: bumped when calculation parameters change
    query_generation: Cell<u64>,
}

impl AsyncUiController {
    pub fn open_asset(&self, path: &str) {
        let current_asset_gen = self.asset_generation.get().wrapping_add(1);
        self.asset_generation.set(current_asset_gen);

        // Reset query generation on primary context switch
        self.query_generation.set(0);

        // Spawn background loader
        let loader_token = current_asset_gen;
        spawn_worker(move || {
            let data = load_heavy_archive(path);
            dispatch_to_main(move |controller| {
                // Drop if user opened another file while this was loading
                if controller.asset_generation.get() != loader_token {
                    return;
                }
                controller.apply_asset(data);
            });
        });
    }

    pub fn recalculate_space_plan(&self, reserved_bytes: u64) {
        // Increment ONLY query generation. Does NOT invalidate in-flight asset loading!
        let current_query_gen = self.query_generation.get().wrapping_add(1);
        self.query_generation.set(current_query_gen);

        let query_token = current_query_gen;
        let asset_token = self.asset_generation.get();
        spawn_worker(move || {
            let plan = compute_space(reserved_bytes);
            dispatch_to_main(move |controller| {
                // Invariant: MUST match both asset and query generation
                if controller.asset_generation.get() != asset_token 
                    || controller.query_generation.get() != query_token {
                    return;
                }
                controller.apply_space_plan(plan);
            });
        });
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER share a single generation counter across different conceptual lifecycles
pub struct BadController {
    generation: Cell<u64>,
}
impl BadController {
    pub fn update_setting(&self) {
        // BUG: Toggling a UI setting bumps the generation ID, 
        // silently aborting the concurrent open_asset background thread!
        self.generation.set(self.generation.get() + 1);
        self.recompute();
    }
}
```

**VERIFICATION METHOD**:
Implement a property test with artificial thread latency:
1. Trigger `open_asset("large_archive.zip")` with a simulated 200 ms background delay.
2. At 50 ms, fire 10 consecutive `recalculate_space_plan()` calls simulating UI slider movements.
3. Assert that the archive finishes loading successfully and displays the final recalculation result without being discarded.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:11:58.350Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219918350",
    "title": "Dual-Counter Generational Cancellation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "xevrion/hatchzip",
    "source_uri": "https://github.com/xevrion/hatchzip",
    "source_version": "HEAD",
    "content_hash": "edef526e839698da63d523896f3e98fa2164afe08431b0aacbc3443a08920fdb"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:11:58.350Z"
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
  "auth_token": "85f83407a27773b1777cce233d759eac1bd7fc75ddaeab396d277d0731568de3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
