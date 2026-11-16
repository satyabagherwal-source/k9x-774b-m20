# Candidate Directive: [CD-MXR1] Architecture-Aware Drop-Oldest Ingestion Rings with At-Least-Once Delivery Gating

<!-- PROVENANCE_START
{
  "source_repository": "matthart1983-netwatch-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T03:06:56.870Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-matthart1983-netwatch-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matthart1983-netwatch-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T03:06:56.870Z`  
> **Learning ID**: `LEARN-EVO-matthart1983-netwatch-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:06:56.988Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794798416988",
    "title": "Architecture-Aware Drop-Oldest Ingestion Rings with At-Least-Once Delivery Gating",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "matthart1983-netwatch-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1f6cfe8e5a303b00c055858e70acb4d648416dbba47af312d560476a9a1d4fa6"
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:06:56.988Z"
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
  "auth_token": "a4a69ec0fa365c999d06e07448b318bb2eb89255c467d5a326d6b627e7d823bc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
