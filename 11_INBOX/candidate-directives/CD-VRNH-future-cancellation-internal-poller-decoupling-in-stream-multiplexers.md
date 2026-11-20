# Candidate Directive: [CD-VRNH] Future Cancellation & Internal Poller Decoupling in Stream Multiplexers

<!-- PROVENANCE_START
{
  "source_repository": "metalbear-co/mirrord",
  "source_url": "https://github.com/metalbear-co/mirrord",
  "source_version": "3a843d8d",
  "license": "MIT",
  "timestamp": "2026-11-20T01:00:31.805Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-metalbear-co-mirrord",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [metalbear-co/mirrord](https://github.com/metalbear-co/mirrord) (Revision: `3a843d8d`).  
> **License**: MIT | **Timestamp**: `2026-11-20T01:00:31.805Z`  
> **Learning ID**: `learn-github-metalbear-co-mirrord`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When creating custom `Future` implementations that monitor underlying channel or resource state (such as `tokio::sync::mpsc::Sender::closed`), the implementer **MUST NOT** poll the underlying synchronization primitive directly inside an ad-hoc manual `Future::poll` implementation when the future will be stored inside unordered collections (like `FuturesUnordered`). The implementer **MUST** instantiate and store an explicit, heap-pinned async closure (`BoxFuture<'static, T>`) inside the wrapper struct.

**WHY**:
`tokio::sync::mpsc::Sender::closed` relies on task-waker registration tied to the calling async task context. When polled inside concurrent combinators like `futures::stream::FuturesUnordered`, intermediate yields and poll passes without explicit task context binding cause wakers to be dropped, overwritten, or deadlocked without re-registration. This causes `FuturesUnordered::next()` to hang indefinitely even after the associated `Receiver` has been dropped.

**WHEN TO APPLY**:
Any Rust async subsystem polling channel status, cancellation tokens, or state change listeners concurrently inside `FuturesUnordered`, `select!`, or custom multiplexing loops.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::{
    future::Future,
    pin::Pin,
    task::{Context, Poll},
};
use futures::{future::BoxFuture, FutureExt};
use tokio::sync::mpsc;

pub type ClientId = u32;

/// A cancellation future that safely wakes across arbitrary task combinators.
pub(crate) struct ChannelClosedFuture(BoxFuture<'static, ClientId>);

impl ChannelClosedFuture {
    pub(crate) fn new<T: 'static + Send>(tx: mpsc::Sender<T>, client_id: ClientId) -> Self {
        // Enforce pinned async block to ensure internal waker is preserved
        let future = async move {
            tx.closed().await;
            client_id
        }
        .boxed();

        Self(future)
    }
}

impl Future for ChannelClosedFuture {
    type Output = ClientId;

    #[inline]
    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        self.0.as_mut().poll(cx)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER do this: Calling tx.closed() inside a raw Future::poll while held in FuturesUnordered
pub struct BrokenChannelClosedFuture<T> {
    tx: tokio::sync::mpsc::Sender<T>,
    client_id: u32,
}

impl<T> Future for BrokenChannelClosedFuture<T> {
    type Output = u32;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        // HAZARD: Polls inner channel directly. When used in FuturesUnordered,
        // the waker registration is clobbered during concurrent polling passes,
        // causing FuturesUnordered::next() to hang forever.
        let mut closed_fut = std::pin::pin!(self.tx.closed());
        if closed_fut.poll(cx).is_ready() {
            Poll::Ready(self.client_id)
        } else {
            Poll::Pending
        }
    }
}
```

**VERIFICATION METHOD**:
Verify using an automated `rstest` harness executing against a `FuturesUnordered` set:
```rust
#[tokio::test]
async fn verify_channel_closed_in_futures_unordered() {
    use futures::stream::{FuturesUnordered, StreamExt};
    let mut unordered = FuturesUnordered::new();
    let (tx, rx) = tokio::sync::mpsc::channel::<()>(1);
    
    unordered.push(ChannelClosedFuture::new(tx, 42));
    assert!(unordered.next().now_or_never().is_none());
    
    // Dropping rx MUST trigger immediate readiness on next poll
    drop(rx);
    let resolved = tokio::time::timeout(std::time::Duration::from_millis(100), unordered.next())
        .await
        .expect("Deadlock detected in FuturesUnordered")
        .expect("Stream yielded None prematurely");
        
    assert_eq!(resolved, 42);
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:00:31.803Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795136431803",
    "title": "Future Cancellation & Internal Poller Decoupling in Stream Multiplexers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "metalbear-co/mirrord",
    "source_uri": "https://github.com/metalbear-co/mirrord",
    "source_version": "HEAD",
    "content_hash": "d0619d6241d2450b6c56c80610adfd74961ce2b1e79bcc41225c09dd1cabfc31"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:00:31.803Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "8f67224dc6d2dffc2c143b324d589e2f76349edb1365e51510cb771ae3d45ffe"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
