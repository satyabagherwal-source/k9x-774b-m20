# Candidate Directive: [CD-L9FC] Dual-Counter Generational Cancellation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "xevrion-hatchzip-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T00:12:02.298Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-xevrion-hatchzip-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xevrion-hatchzip-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T00:12:02.298Z`  
> **Learning ID**: `LEARN-EVO-xevrion-hatchzip-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:12:02.423Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219922423",
    "title": "Dual-Counter Generational Cancellation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "xevrion-hatchzip-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "70bd707606e69338e874de97fc3e710fc6f74a892a302bd311cf841700eb621f"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T00:12:02.423Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "dec5adaab68a13c32d875baa471fb729a6f8da29f90f6a98e224cc81a34adb9a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
