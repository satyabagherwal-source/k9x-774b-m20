# Candidate Directive: [CD-WRV5] Cooperative Async File Locking Under Thread Pool Starvation Constraints

<!-- PROVENANCE_START
{
  "source_repository": "zed-industries-zed-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T02:12:57.923Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zed-industries-zed-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zed-industries-zed-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T02:12:57.923Z`  
> **Learning ID**: `LEARN-EVO-zed-industries-zed-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When acquiring advisory file locks inside an asynchronous runtime backed by a fixed-size blocking thread pool, the runtime MUST NOT block OS threads directly on kernel-level file lock syscalls (e.g., `flock(2)`, `fcntl(F_SETLKW)`, `LockFileEx(LOCKFILE_EXCLUSIVE_LOCK)`). Instead, it MUST execute non-blocking lock attempts (`try_lock`) interspersed with asynchronous timer-based yields with bounded exponential backoff.

**WHY**:
Blocking thread pool workers on kernel-level lock queues causes catastrophic thread starvation. If $N$ asynchronous tasks queue for an exclusive file lock, and $N \ge \text{worker\_pool\_size}$, every thread in the pool is blocked waiting on the kernel mutex. The current holder of the lock will be unable to acquire a worker thread to perform file writes, unlinking, or unlock operations, resulting in an unrecoverable, process-wide deadlock.

**WHEN TO APPLY**:
Apply to any async I/O abstraction layer (Rust `tokio`/`gpui`, Go goroutines with cgo I/O, Node.js libuv threadpool) executing cross-process file locking over shared local assets, cache directories, or database files.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Extracted and generalized from crates/fs/src/fs.rs
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use anyhow::{Context as _, Result};

const FILE_LOCK_INITIAL_RETRY_DELAY: Duration = Duration::from_millis(5);
const FILE_LOCK_MAX_RETRY_DELAY: Duration = Duration::from_millis(250);

pub enum FileLockKind {
    Shared,
    Exclusive,
}

pub struct FileLock {
    _file: Arc<std::fs::File>,
}

impl FileLock {
    pub fn new(file: Arc<std::fs::File>) -> Self {
        Self { _file: file }
    }
}

pub async fn lock_file_cooperative<E>(
    executor: &E,
    path: &Path,
    kind: FileLockKind,
) -> Result<FileLock>
where
    E: AsyncExecutor,
{
    let file = open_lock_file(executor, path).await?;
    let mut retry_delay = FILE_LOCK_INITIAL_RETRY_DELAY;

    loop {
        // Non-blocking try-lock delegated to blocking thread pool
        if try_lock_open_file(executor, &file, path, kind).await? {

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T02:12:57.999Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795227177998",
    "title": "Cooperative Async File Locking Under Thread Pool Starvation Constraints",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zed-industries-zed-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "6e831e07f027914c4661851e4f2c550d23997731a516a04ed400ede389f70e3d"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T02:12:57.999Z"
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
  "auth_token": "dd19faef9716ee7ad0b67dece5b3cccfd11f841be53c019dbb7a42e9309e6349"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
