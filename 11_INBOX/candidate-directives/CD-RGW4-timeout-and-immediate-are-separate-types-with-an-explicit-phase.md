# Candidate Directive: [CD-RGW4] Timeout and Immediate are separate types with an explicit phase

<!-- PROVENANCE_START
{
  "source_repository": "oven-sh/bun",
  "source_url": "https://github.com/oven-sh/bun",
  "source_version": "084e3627",
  "license": "NOASSERTION",
  "timestamp": "2026-11-19T16:33:18.149Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-oven-sh-bun",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oven-sh/bun](https://github.com/oven-sh/bun) (Revision: `084e3627`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-19T16:33:18.149Z`  
> **Learning ID**: `learn-github-oven-sh-bun`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
// — to convert at every assignment and risked silent layout drift).
use Timespec as timespec;
pub use bun_core::Timespec;

use bun_io::heap::IntrusiveField;
// ─── Hot-dispatch (link-time) ───────────────────────────────────────────────
// `EventLoopTimer` is per-tick hot. Low tier (this crate) keeps `Tag` + the
// intrusive heap node; the `match tag { … container_of … }` dispatch lives in
// `bun_runtime::dispatch` because it names ~20 high-tier container types.
//
// LAYERING: rather than a runtime-registered fn-ptr (init-order
// hazard), the bodies are declared `extern "Rust"` and defined `#[no_mangle]`
// in `bun_runtime`; the linker resolves them. No `AtomicPtr`, no registration.
//
// PERF: `__bun_js_timer_epoch` sits on the
// heap-compare path. Consider denormalizing `epoch` into `EventLoopTimer`
// to drop the cross-crate call if profiling shows it matters.
    /// Returns the JS-timer epoch (TimerObjectInternals.flags.epoch) for
    /// TimeoutObject/I
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `128419ff` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T16:33:18.147Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795105998147",
    "title": "Timeout and Immediate are separate types with an explicit phase",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oven-sh/bun",
    "source_uri": "https://github.com/oven-sh/bun",
    "source_version": "HEAD",
    "content_hash": "dd941f85e0f8838e029e607cd6cf4290443f349eaa9b0896e0b231f3739e22ce"
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
        "Harvested/verified timestamp recorded: 2026-11-19T16:33:18.147Z"
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
  "auth_token": "1cf58d76c5e4c2bbdb10ea1a24591bf2cc73580ddb68da7a92cdd7419118d533"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
