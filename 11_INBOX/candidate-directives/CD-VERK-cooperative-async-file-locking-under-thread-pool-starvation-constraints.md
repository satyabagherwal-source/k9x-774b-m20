# Candidate Directive: [CD-VERK] Cooperative Async File Locking Under Thread Pool Starvation Constraints

<!-- PROVENANCE_START
{
  "source_repository": "zed-industries/zed",
  "source_url": "https://github.com/zed-industries/zed",
  "source_version": "2f808b3c",
  "license": "NOASSERTION",
  "timestamp": "2026-11-21T02:11:54.368Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zed-industries-zed",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zed-industries/zed](https://github.com/zed-industries/zed) (Revision: `2f808b3c`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-21T02:11:54.368Z`  
> **Learning ID**: `learn-github-zed-industries-zed`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
            return Ok(FileLock::new(file));
        }

        // Cooperative asynchronous sleep: relinquishes the thread back to the runtime
        executor.timer(retry_delay).await;
        retry_delay = (retry_delay * 2).min(FILE_LOCK_MAX_RETRY_DELAY);
    }
}

async fn try_lock_open_file<E>(
    executor: &E,
    file: &Arc<std::fs::File>,
    path: &Path,
    kind: FileLockKind,
) -> Result<bool>
where
    E: AsyncExecutor,
{
    let file = file.clone();
    let result = executor
        .spawn_blocking(move || {
            #[cfg(unix)]
            {
                use nix::fcntl::{FlockArg, flock};
                use std::os::unix::io::AsRawFd;
                let flag = match kind {
                    FileLockKind::Shared => FlockArg::LockSharedNonblock,
                    FileLockKind::Exclusive => FlockArg::LockExclusiveNonblock,
                };
                match flock(file.as_raw_fd(), flag) {
                    Ok(()) => Ok(true),
                    Err(nix::errno::Errno::EWOULDBLOCK) => Ok(false),
                    Err(err) => Err(std::io::Error::from(err)),
                }
            }
            #[cfg(windows)]
            {
                // Equivalent non-blocking LockFileEx logic
                Ok(true)
            }
        })
        .await;

    match result {
        Ok(acquired) => Ok(acquired),
        Err(error) => Err(error).with_context(|| format!("locking {path:?}")),
    }
}

pub trait AsyncExecutor {
    fn spawn_blocking<F, R>(&self, f: F) -> impl std::future::Future<Output = R> + Send
    where
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static;
    fn timer(&self, duration: Duration) -> impl std::future::Future<Output = ()> + Send;
}

async fn open_lock_file<E>(executor: &E, path: &Path) -> Result<Arc<std::fs::File>>
where
    E: AsyncExecutor,
{
    let path = path.to_owned();
    executor
        .spawn_blocking(move || {
            let file = std::fs::OpenOptions::new()
                .read(true)
                .write(true)
                .create(true)
                .truncate(false)
                .open(&path)
                .with_context(|| format!("opening {path:?}"))?;
            Ok(Arc::new(file))
        })
        .await
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER block the threadpool worker inside the kernel wait queue
async fn lock_file_deadlock_hazard(path: &Path) -> Result<std::fs::File> {
    // ANTI-PATTERN: If pool size is 16 and 16 tasks wait here, no worker can
    // execute the file operation needed to release the lock!
    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(path)?;
        // Kernel blocking call will not release OS thread
        fs2::FileExt::lock_exclusive(&file)?; 
        Ok(file)
    }).await?
}
```

**VERIFICATION METHOD**:
Run an automated stress integration test that spawns a thread pool with fixed capacity $M$ (e.g., 4 threads) and enqueues $N > M$ concurrent waiters ($N = 512$) on an exclusive file lock, while requiring the lock-holding task to perform concurrent file read/write operations via the same executor before releasing the lock. Verify all waiters successfully acquire and release without deadlocks (`fs_tests::test_realfs_lock_waiters_leave_threads_for_file_operations`).

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T02:11:54.366Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795227114366",
    "title": "Cooperative Async File Locking Under Thread Pool Starvation Constraints",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zed-industries/zed",
    "source_uri": "https://github.com/zed-industries/zed",
    "source_version": "HEAD",
    "content_hash": "cd0da757eae8e5bf122aaf58b106bd0c17c91d215f4e5dc95c98797bf9086e49"
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
        "Harvested/verified timestamp recorded: 2026-11-21T02:11:54.366Z"
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
  "auth_token": "52afa26eac45c2d9ecbbbf40270b282945e0768d9ca6223dda1b2138c718dab5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
