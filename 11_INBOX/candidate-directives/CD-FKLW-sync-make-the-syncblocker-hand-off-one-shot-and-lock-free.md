# Candidate Directive: [CD-FKLW] sync): make the SyncBlocker hand-off one-shot and lock-free

<!-- PROVENANCE_START
{
  "source_repository": "xudong-huang-may-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T11:40:46.374Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-xudong-huang-may-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xudong-huang-may-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T11:40:46.374Z`  
> **Learning ID**: `LEARN-EVO-xudong-huang-may-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/sync/blocking.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Xudong-Huang/may. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2e43c632`: sync): make the SyncBlocker hand-off one-shot and lock-free. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/sync/blocking.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use std::sync::atomic::{AtomicUsize, Ordering};
const UNPARKED: usize = 1;
const CANCELLED: usize = 2;

/// The decision is a single compare-exchange on `status`, so exactly one side
/// wins without a lock:
/// * `0`: no decision yet — the wait is in progress;
/// * `UNPARKED`: a producer claimed the hand-off; the waiter is (or is about
///   to be) woken and must take the resource as its own;
/// * `CANCELLED`: the waiter left without the resource, so a producer that
///   pops this blocker must forward the resource to the next waiter.
/// 1. A producer calls [`try_hand_off`], which CASes `0` -> `UNPARKED`. It
///    returns `true` if the waiter took the resource (and has been unparked)
///    and `false` if the waiter had already left — then the caller must
///    forward the resource to the next waiter.
/// 2. A waiter whose `park` returned an error calls [`leave_wait`], which
///    CASes `0` -> `CANCELLED`. It returns `false` if the waiter left first
///    and `true` if a producer had already claimed the hand-off — then the
///    caller must forward the resource, because the waiter is unwinding and
///    can no longer use it.
/// A `SyncBlocker` is used for a single wait o
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use std::sync::atomic::{AtomicBool, Ordering};
/// Both halves of that handshake run under `spin_lock`, so the decision is
/// made with mutual exclusion:
/// 1. `park` returns `Err`, so the waiter calls [`leave_wait`];
/// 2. `leave_wait` returns `true` if the resource arrived anyway and the
///    caller must forward it;
/// 3. a producer calls [`try_hand_off`], which returns `false` if the waiter
///    had already left and the caller must forward to the next waiter.
/// A lock-free version of this handshake cannot work here: it would require
/// both sides to publish their own flag before reading the other's, but the

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T11:40:46.480Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794915646479",
    "title": "sync): make the SyncBlocker hand-off one-shot and lock-free",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "xudong-huang-may-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8e7abbf9ab13d6a408fef4a386aab65414011265d8afc734cb73cc3107d7cd81"
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
        "Harvested/verified timestamp recorded: 2026-11-17T11:40:46.480Z"
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
  "auth_token": "957a7895456bc3d4dc91d2d4e0517bc069a6802bcd6b48dc396c8f7cb1b3a079"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
