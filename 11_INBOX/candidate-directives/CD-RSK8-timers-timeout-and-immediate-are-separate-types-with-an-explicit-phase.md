# Candidate Directive: [CD-RSK8] timers: Timeout and Immediate are separate types with an explicit phase

<!-- PROVENANCE_START
{
  "source_repository": "oven-sh-bun-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T16:33:33.162Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-oven-sh-bun-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oven-sh-bun-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T16:33:33.162Z`  
> **Learning ID**: `LEARN-EVO-oven-sh-bun-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/event_loop/EventLoopTimer.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oven-sh/bun. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `128419ff`: timers: Timeout and Immediate are separate types with an explicit phase. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/event_loop/EventLoopTimer.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use bun_core::Timespec;
use bun_io::heap::{HeapNode, IntrusiveField};
    pub next: Cell<Timespec>,
    heap: IntrusiveField<EventLoopTimer>,
    /// What `next` is measured on, and so which heap links the node.
    pub clock: Cell<Clock>,
    /// Set by every insert. Orders JS timers that are due in the same millisecond.
    pub epoch: Cell<u32>,
const _: () = assert!(size_of::<EventLoopTimer>() == 48);

impl HeapNode for EventLoopTimer {

    #[inline]
    fn less(&self, other: &Self) -> bool {
        let (a, b) = (self.next.get(), other.next.get());
        if a.sec != b.sec {
            return a.sec < b.sec;
        }
        let (a_is_js, b_is_js) = (self.tag.is_js_timer(), other.tag.is_js_timer());
        let whole_ms = |nsec: i64| NS_PER_MS * (nsec / NS_PER_MS);
        let a_ns = if a_is_js { whole_ms(a.nsec) } else { a.nsec };
        let b_ns = if b_is_js { whole_ms(b.nsec) } else { b.nsec };
        if a_ns != b_ns {
            return a_ns < b_ns;
        }
        // Only a fake `setImmediate` is ever in a heap. It runs before timeouts due at the same instant.
        if (self.tag == Tag::ImmediateObject) != (other.tag == Tag::ImmediateObject) {
            return s
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// LAYERING: re-export `bun_core::Timespec` so every embedder of
// `EventLoopTimer.next` agrees on the type (was a local stub with the same
// `{sec,nsec}` layout, which forced higher tiers — `bun_runtime`, `bun_sql_jsc`

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T16:33:33.268Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795106013268",
    "title": "timers: Timeout and Immediate are separate types with an explicit phase",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oven-sh-bun-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "82141a502a70012eff5f2dbbec5a542868c598ad90747950f3ca964b3add52bb"
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
        "Harvested/verified timestamp recorded: 2026-11-19T16:33:33.268Z"
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
  "auth_token": "6a2ee401a6cb8e99cf7bb8c7c22fd28d0ba72b4832ea841d3e4ddcb099302149"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
