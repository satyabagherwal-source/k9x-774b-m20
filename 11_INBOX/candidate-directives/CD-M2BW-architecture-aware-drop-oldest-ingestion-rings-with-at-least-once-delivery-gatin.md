# Candidate Directive: [CD-M2BW] Architecture-Aware Drop-Oldest Ingestion Rings with At-Least-Once Delivery Gating

<!-- PROVENANCE_START
{
  "source_repository": "matthart1983/netwatch",
  "source_url": "https://github.com/matthart1983/netwatch",
  "source_version": "e11c8c49",
  "license": "MIT",
  "timestamp": "2026-11-16T03:06:16.268Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-matthart1983-netwatch",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matthart1983/netwatch](https://github.com/matthart1983/netwatch) (Revision: `e11c8c49`).  
> **License**: MIT | **Timestamp**: `2026-11-16T03:06:16.268Z`  
> **Learning ID**: `learn-github-matthart1983-netwatch`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Telemetry snapshot queues MUST retain items until positive downstream acknowledgment (peek-batch then ack-remove) and MUST evict the oldest uncommitted frame on capacity exhaustion while updating an overflow counter. The overflow counter MUST NOT exceed target-platform native atomic word sizes (e.g., using `AtomicU32` instead of `AtomicU64` to maintain lock-free execution on 32-bit platforms like `armv5te`).

**WHY**:
1. Transient network partitions cause telemetry queues to fill. Dropping newest telemetry loses real-time incident notifications in favor of obsolete historical data. Evicting oldest ensures diagnostic engines observe current failure states.
2. Silent drops mask fleet-wide telemetry degradations; reporting the eviction counter within outgoing envelopes enables backends to detect backpressure instantly.
3. Using `AtomicU64` on 32-bit architectures that lack native 64-bit atomics generates compiler errors or pulls in software-locked emulation (`libatomic`), introducing deadlock risks inside critical real-time loop hooks.

**WHEN TO APPLY**:
- Ingest agents, metrics aggregators, logging daemons, and IoT devices running under resource-constrained memory envelopes or cross-compilation targets.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern derived from src/remote/queue.rs (SnapshotQueue)
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Mutex, MutexGuard};

pub struct SnapshotQueue<T> {
    inner: Mutex<VecDeque<T>>,
    cap: usize,
    // AtomicU32 chosen over AtomicU64 to guarantee lock-free compilation
    // across armv5te, mips, and 32-bit RISC-V targets.
    dropped: AtomicU32,
}

impl<T: Clone> SnapshotQueue<T> {
    pub fn new(cap: usize) -> Self {
        Self {
            inner: Mutex::new(VecDeque::with_capacity(cap.min(1024))),
            cap: cap.max(1),
            dropped: AtomicU32::new(0),
        }
    }

    pub fn push(&self, item: T) {
        let mut q = self.safe_lock();
        while q.len() >= self.cap {
            q.pop_front();
            self.dropped.fetch_add(1, Ordering::Relaxed);
        }
        q.push_back(item);
    }

    /// Read without removing. Items remain durable across network dropouts.
    pub fn peek_batch(&self, max: usize) -> Vec<T> {
        let q = self.safe_lock();
        q.iter().take(max).cloned().collect()
    }

    /// Destructive pop executed ONLY upon confirmed receiver ACK.
    pub fn remove_acked(&self, count: usize) {
        let mut q = self.safe_lock();
        for _ in 0..count.min(q.len()) {
            q.pop_front();
        }
    }

    pub fn dropped_count(&self) -> u32 {
        self.dropped.load(Ordering::Relaxed)
    }

    fn safe_lock(&self) -> MutexGuard<'_, VecDeque<T>> {
        // Poisoned lock recovery: if a previous thread panicked mid-read,
        // recover the data structure rather than crashing the background sender.
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL DEFECT: Fire-and-forget pop before delivery confirmation
pub fn bad_dispatch<T>(queue: &Mutex<VecDeque<T>>, sender: &impl Fn(T) -> Result<(), ()>) {
    let mut q = queue.lock().unwrap();
    if let Some(item) = q.pop_front() {
        // VIOLATION: Telemetry is permanently destroyed if `sender` fails
        let _ = sender(item);
    }
}
```

**VERIFICATION METHOD**:
Configure an end-to-end integration test pushing `N + K` records into a queue of capacity `N`. Validate that:
1. Queue length equals `N`.
2. `dropped_count()` equals `K`.
3. Oldest `K` records were cleanly evicted.
4. Calling `peek_batch()` followed by a mock network error retains all `N` records.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:06:16.267Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794798376267",
    "title": "Architecture-Aware Drop-Oldest Ingestion Rings with At-Least-Once Delivery Gating",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "matthart1983/netwatch",
    "source_uri": "https://github.com/matthart1983/netwatch",
    "source_version": "HEAD",
    "content_hash": "e163fb3bd7ad54cc9a8304748bc82dfd90c47cdddf6d5b54f9d00ed21ef93e95"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:06:16.267Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "5c556525d100cc85ad293d9737e26c51c3986e67689b121f8d5e736c687c2a64"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
