# Candidate Directive: [CD-V3QN] Asynchronous Co-Routine Fuel and Starvation Guard

<!-- PROVENANCE_START
{
  "source_repository": "rustls/rustls",
  "source_url": "https://github.com/rustls/rustls",
  "source_version": "10bb7f9c",
  "license": "NOASSERTION",
  "timestamp": "2026-11-21T20:51:24.719Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rustls-rustls",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rustls/rustls](https://github.com/rustls/rustls) (Revision: `10bb7f9c`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-21T20:51:24.719Z`  
> **Learning ID**: `learn-github-rustls-rustls`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When running manual, lock-stepped, or cooperative polling of interdependent co-routines/futures without a global async runtime (e.g., benchmark loops, single-threaded co-routine drivers, lock-free pipelines), you MUST bound loop iterations with a strictly decrementing, non-replenishing **Fuel Counter**. If the fuel reaches zero before futures reach terminal status, you MUST terminate immediately with a deterministic panic or timeout error.

**WHY**:
When two futures interact over an in-memory queue or loopback pipe (e.g., client handshake driver and server handshake driver), any latent defect—such as an unhandled short read, an unnotified closure, or an alert generated without consumer notification—causes both futures to alternate yielding `Poll::Pending`. Without an explicit cycle cap, this causes an infinite CPU busy-loop that saturates the thread and hangs continuous integration runners indefinitely without a stack trace.

**WHEN TO APPLY**:
Apply to test runners, simulated event loops, single-threaded executor shims, deterministic trace replay harnesses, and actor message schedulers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use core::future::Future;
use core::pin::pin;
use core::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};
use core::ptr;

pub fn execute_cooperative_turn_bounded<F1, F2>(
    f1: F1,
    f2: F2,
    max_turns: usize,
) -> Result<(F1::Output, F2::Output), &'static str>
where
    F1: Future,
    F2: Future,
{
    let mut f1 = pin!(f1);
    let mut f2 = pin!(f2);

    let waker = noop_waker();
    let mut ctx = Context::from_waker(&waker);

    let mut out1 = None;
    let mut out2 = None;
    let mut fuel = max_turns;

    loop {
        if out1.is_some() && out2.is_some() {
            break;
        }
        if fuel == 0 {
            return Err("Execution starvation guard tripped: co-routines deadlocked in Poll::Pending loop");
        }
        fuel -= 1;

        if out1.is_none() {
            if let Poll::Ready(res) = f1.as_mut().poll(&mut ctx) {
                out1 = Some(res);
            }
        }

        if out2.is_none() {
            if let Poll::Ready(res) = f2.as_mut().poll(&mut ctx) {
                out2 = Some(res);
            }
        }
    }

    Ok((out1.unwrap(), out2.unwrap()))
}

fn noop_waker() -> Waker {
    const VTABLE: RawWakerVTable = RawWakerVTable::new(|_| RAW, |_| {}, |_| {}, |_| {});
    const RAW: RawWaker = RawWaker::new(ptr::null(), &VTABLE);
    unsafe { Waker::from_raw(RAW) }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Unbounded busy-wait loop polling interdependent futures.
// If future X waits on Y, but Y entered an error state and yielded Pending,
// the CPU spins at 100% until the entire CI job times out (e.g., 6 hours).
pub fn unsafe_block_on_concurrent<F1: Future, F2: Future>(f1: F1, f2: F2) -> (F1::Output, F2::Output) {
    let mut f1 = pin!(f1);
    let mut f2 = pin!(f2);
    let waker = noop_waker();
    let mut ctx = Context::from_waker(&waker);
    let mut o1 = None;
    let mut o2 = None;

    loop { // FATAL: No fuel or iteration budget!
        if let (Some(r1), Some(r2)) = (o1.take(), o2.take()) {
            return (r1, r2);
        }
        if o1.is_none() {
            if let Poll::Ready(val) = f1.as_mut().poll(&mut ctx) { o1 = Some(val); }
        }
        if o2.is_none() {
            if let Poll::Ready(val) = f2.as_mut().poll(&mut ctx) { o2 = Some(val); }
        }
    }
}
```

**VERIFICATION METHOD**:
```rust
#[test]
fn test_deadlocked_futures_terminate_via_fuel_guard() {
    let pending_fut1 = core::future::pending::<()>();
    let pending_fut2 = core::future::pending::<()>();

    let res = execute_cooperative_turn_bounded(pending_fut1, pending_fut2, 50);
    assert_eq!(res, Err("Execution starvation guard tripped: co-routines deadlocked in Poll::Pending loop"));
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T20:51:24.718Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795294284718",
    "title": "Asynchronous Co-Routine Fuel and Starvation Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rustls/rustls",
    "source_uri": "https://github.com/rustls/rustls",
    "source_version": "HEAD",
    "content_hash": "6cfd1e197dd1c55df5eb7a9e3effd5fc83275780abeb67fedc8a66701980e9ea"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-21T20:51:24.718Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "8a89ed63466554105a8f084172202f37d262b846662e9e4e95d52b87df83143a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
