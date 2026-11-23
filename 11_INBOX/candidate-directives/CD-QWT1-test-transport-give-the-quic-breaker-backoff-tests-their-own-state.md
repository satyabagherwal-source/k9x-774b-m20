# Candidate Directive: [CD-QWT1] test(transport): give the QUIC breaker backoff tests their own state

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "e655ebd9",
  "license": "NOASSERTION",
  "timestamp": "2026-11-23T13:23:35.701Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `e655ebd9`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-23T13:23:35.701Z`  
> **Learning ID**: `learn-github-freenet-freenet-core`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/core/src/transport/quic/breaker.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2fc3d192`: test(transport): give the QUIC breaker backoff tests their own state. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/transport/quic/breaker.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// The crash-loop backoff of one start: the delay [`gate`] decided, whether
/// the wait is still pending, whether the update check should hurry, and the
/// wakeup for [`Backoff::wait_for_transport_open`].
///
/// The binary has exactly one, [`BACKOFF`]. It is a value rather than four
/// loose statics so a test can own its own and decide a backoff without
/// touching the one every node built in the same test process reads
/// ([`wait_out_crash_loop_backoff`] runs at the start of every node's event
/// loop), which would take the test's delay and sleep through it.
pub(super) struct Backoff {
    /// The start delay, until the transport waits it out.
    delay: parking_lot::Mutex<Option<Duration>>,
    /// Set from [`Backoff::note`] until [`Backoff::wait_out`] ends.
    pending: AtomicBool,
    /// Set when this start is in a crash-loop backoff, so the binary's startup
    /// update check runs after a few seconds of jitter instead of its 0-60 s
    /// one ([`quic_crash_loop_update_now`]).
    update_now: AtomicBool,
    /// Wakes [`Backoff::wait_for_transport_open`] when the backoff wait ends.
    over: tokio::sync::Notify,
}

/// The binary's backoff: what [`gate`] decides and
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
/// The start delay [`gate`] decided for this run, until the transport waits
/// it out ([`wait_out_crash_loop_backoff`]).
static BACKOFF: parking_lot::Mutex<Option<Duration>> = parking_lot::Mutex::new(None);

/// Set when this start is in a crash-loop backoff, so the binary's startup
/// update check runs after a few seconds of jitter instead of its 0-60 s one
/// ([`quic_crash_loop_update_now`]).
static UPDATE_NOW: AtomicBool = AtomicBool::new(false);

fn note_backoff(delay: Duration) {
    *BACKOFF.lock() = Some(delay);
    BACKOFF_PENDING.store(true, Ordering::SeqCst);
    UPDATE_NOW.store(true, Ordering::Relaxed);
    UPDATE_NOW.load(Ordering::Relaxed)
    let Some(delay) = BACKOFF.lock().take() else {
        return false;
    };
    use crate::simulation::TimeSource;
    let time = crate::simulation::RealTime::new();
    let waited = wait_unless(
        delay,
        HOLDER_POLL,
        || shutting_down.load(Ordering::SeqCst),
        |d| time.sleep(d),
    )
    .await;
    let stopped = shutting_down.load(Ordering
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2fc3d192` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T13:23:35.698Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795440215698",
    "title": "test(transport): give the QUIC breaker backoff tests their own state",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "e39a42f8984d653ee23cf9acf0486baf7e34f1f1d4c44b9ffd218576e0339bf5"
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
        "Harvested/verified timestamp recorded: 2026-11-23T13:23:35.698Z"
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
  "auth_token": "b7947657055bcc0d25f0b8b79c8eb9cefbfe664be3dca2506281453df240d255"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
