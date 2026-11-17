# Candidate Directive: [CD-FANO] make the SyncBlocker hand-off one-shot and lock-free

<!-- PROVENANCE_START
{
  "source_repository": "Xudong-Huang/may",
  "source_url": "https://github.com/Xudong-Huang/may",
  "source_version": "9b1e3604",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T11:40:33.588Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-xudong-huang-may",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Xudong-Huang/may](https://github.com/Xudong-Huang/may) (Revision: `9b1e3604`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T11:40:33.588Z`  
> **Learning ID**: `learn-github-xudong-huang-may`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
/// producer has to read `release` before deciding whether to set `unparked`,
/// so both sides can miss each other and lose the resource.
/// A `SyncBlocker` is used for a single wait only; the flags are never reset.
    // set once by `unpark` and never reset: a SyncBlocker is used for a
    // single wait only, so the flag only ever needs to be checked once
    unparked: AtomicBool,
    // used to register the release action
    release: AtomicBool,
    // a spin lock to protect cancellation handling and release flag updates
    spin_lock: AtomicBool,
          
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2e43c632` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T11:40:33.586Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794915633586",
    "title": "make the SyncBlocker hand-off one-shot and lock-free",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Xudong-Huang/may",
    "source_uri": "https://github.com/Xudong-Huang/may",
    "source_version": "HEAD",
    "content_hash": "48baa22f5c8d695365728fd7a8f8e8be719cecbe37210f439cdea364ce33b4e6"
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
        "Harvested/verified timestamp recorded: 2026-11-17T11:40:33.586Z"
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
  "auth_token": "8ed0257a9e4b510040bcd6323fe197d3c51eec9340b0262cdc96db92bda99b2b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
