# Candidate Directive: [CD-W0MR] Asynchronous Co-Routine Fuel and Starvation Guard

<!-- PROVENANCE_START
{
  "source_repository": "rustls-rustls-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T20:52:07.206Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rustls-rustls-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rustls-rustls-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T20:52:07.206Z`  
> **Learning ID**: `LEARN-EVO-rustls-rustls-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T20:52:07.347Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795294327347",
    "title": "Asynchronous Co-Routine Fuel and Starvation Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rustls-rustls-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "597460e82f2aeeb7929dab5edbc00f5b987637f58ef796b274c4f08cd5d5602b"
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
        "Harvested/verified timestamp recorded: 2026-11-21T20:52:07.347Z"
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
  "auth_token": "173d8d715de5fcb51ee98599373ebe7a770597bb84ba01c0bbbd8b7ab7a1bcae"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
