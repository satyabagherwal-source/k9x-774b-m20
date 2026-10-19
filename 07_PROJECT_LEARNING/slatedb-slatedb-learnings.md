> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/slatedb-slatedb-learnings.md`  
> **Source**: github ([https://github.com/slatedb/slatedb](https://github.com/slatedb/slatedb))  
> **Source Version**: `a5c4fd22`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T01:35:01.716Z  
> **Learning ID**: `learn-github-slatedb-slatedb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): slatedb/slatedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/slatedb-slatedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/slatedb/slatedb](https://github.com/slatedb/slatedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T01:35:01.707Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `slatedb/slatedb`
- **Description**: A cloud native embedded storage engine built on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3556 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `slatedb-common/src/utils.rs`
```
use crate::clock::SystemClock;
use std::future::Future;
use std::sync::Arc;
use std::time::Duration;

/// A timeout wrapper for futures that returns the provided error if the future
/// does not complete within the specified duration.
///
/// # Arguments:
/// - `clock`: The clock to use for the timeout.
/// - `duration`: The duration to wait for the future to complete.
/// - `error_fn`: Returns the error to use when the timeout expires.
/// - `future`: The future to timeout
///
/// # Returns:
/// - `Ok(T)`: If the future completes within the specified duration.
/// - `Err(Err)`: If the future does not complete within the specified duration.
pub async fn timeout<T, Err>(
    clock: Arc<dyn SystemClock>,
    duration: Duration,
    error_fn: impl FnOnce() -> Err,
    future: impl Future<Output = Result<T, Err>> + Send,
) -> Result<T, Err> {
    tokio::select! {
        biased;
        res = future => res,
        _ = clock.sleep(duration) => Err(error_fn())
    }
}

#[cfg(all(test, feature = "test-util"))]
mod tests {
    use super::timeout;
    use crate::clock::MockSystemClock;
    use crate::clock::SystemClock;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum TestError {
        Timeout,
    }

    #[tokio::test]
    async fn test_timeout_completes_before_expiry() {
        // Given: a mock clock and a future that completes quickly
        let clock = Arc::new(MockSystemClock::new());

        // When: we execute a future with a timeout
        let completed_future = async { Ok::<_, TestError>(42) };
        let timeout_future = timeout(
            clock,
            Duration::from_millis(100),
            || TestError::Timeout,
            completed_future,
        );

        // Then: the future should complete successfully with the expected value
        let result = timeout_future.await;
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_timeout_expires() {
        // Given: a mock clock and a future that will never complete
        let clock = Arc::new(MockSystemClock::new());
        let never_completes = std::future::pending::<Result<(), TestError>>();
        let timeout_duration = Duration::from_millis(100);

        // When: we execute the future with a timeout and advance the clock past the timeout duration
        let timeout_future = timeout(
            clock.clone(),
            timeout_duration,
            || TestError::Timeout,
            never_completes,
        );
        let done = Arc::new(AtomicBool::new(false));
        let this_done = done.clone();

        tokio::spawn(async move {
            while !this_done.load(Ordering::SeqCst) {
                clock.advance(Duration::from_millis(100)).await;
                // Yield or else the scheduler keeps picking this loop, which
                // the sleep task forever.
                tokio::task::yield_now().await;
            }
        });

        // Then: the future should complete with a timeout error
        let result = timeout_future.await;
        done.store(true, Ordering::SeqCst);
        assert_eq!(result, Err(TestError::Timeout));
    }

    #[tokio::test]
    async fn test_timeout_respects_biased_select() {
        // Given: a mock clock and two futures that complete simultaneously
        let clock = Arc::new(MockSystemClock::new());
        let completes_immediately = async { Ok::<_, TestError>(42) };

        // When: we execute the future with a timeout and both are ready immediately
        let timeout_future = timeout(
            clock,
            Duration::from_millis(100),
            || TestError::Timeout,
            completes_immediately,
        );

        // Then: because of the 'biased' select, the future should complete with the value
        // rather than timing out, even though both are ready
        let result = timeout_future.await;
        assert_eq!(result.unwrap(), 42);
    }
}

```

### Core Architecture Module: `slatedb-dst/src/utils.rs`
```
use std::str::FromStr;
use std::sync::Once;
use std::time::Duration;

use rand::{Rng, RngExt};
use slatedb::config::{
    CompactionWorkerOptions, CompactorOptions, CompressionCodec, DbReaderOptions, DurabilityLevel,
    GarbageCollectorDirectoryOptions, GarbageCollectorOptions, GarbageCollectorScheduleOptions,
    ScanOptions, SizeTieredCompactionSchedulerOptions,
};
use slatedb::{DbRand, IterationOrder, Settings};
use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::EnvFilter;

use crate::{Operation, StreamDirection, Toxic, ToxicKind};

const KIB_8: usize = 8 * 1024;
const MIB_1: usize = 1024 * 1024;
const MIB_500: usize = 500 * MIB_1;
const GIB_2: usize = 2048 * MIB_1;

const COMPRESSION_CODECS: [Option<&str>; 5] = [
    Some("snappy"),
    Some("zlib"),
    Some("lz4"),
    Some("zstd"),
    None,
];

/// Builds a randomized deterministic [`Settings`] value for DST scenarios.
///
/// The returned settings are entirely derived from `rand`, except that
/// object-store caching is always disabled. The cache implementation uses
/// filesystem and blocking-task wakeups outside the seeded current-thread DST
/// runtime, which breaks logical-clock determinism for the harness-managed
/// clock.
pub async fn build_settings(rand: &DbRand) -> Settings {
    let mut rng = rand.rng();
    let flush_interval = rng.random_range(Duration::from_millis(1)..Duration::from_secs(60));
    let manifest_poll_interval = rng.random_range(Duration::from_secs(1)..Duration::from_secs(60));
    let manifest_update_timeout = rng.random_range(Duration::from_secs(1)..Duration::from_secs(60));
    let min_filter_keys = rng.random_range(100..1000);
    let l0_sst_size_bytes = rng.random_range(MIB_1..MIB_500);
    let l0_max_ssts = rng.random_range(4..8);
    let l0_max_ssts_per_key = l0_max_ssts;
    // Keep `max_unflushed_bytes` strictly greater than `l0_sst_size_bytes`.
    let max_unflushed_bytes = rng.random_range((l0_sst_size_bytes + 1)..GIB_2);
    let compression_codec_idx = rng.random_range(0..COMPRESSION_CODECS.len());
    let compression_codec =
        if let Some(compression_codec) = COMPRESSION_CODECS[compression_codec_idx] {
            CompressionCodec::from_str(compression_codec).ok()
        } else {
            None
        };
    let settings = Settings {
        flush_interval: Some(flush_interval),
        manifest_poll_interval,
        manifest_update_timeout,
        min_filter_keys,
        l0_sst_size_bytes,
        l0_max_ssts,
        l0_max_ssts_per_key,
        max_unflushed_bytes,
        compression_codec,
        compactor_options: Some(build_settings_compactor(&mut *rng)),
        garbage_collector_options: Some(build_settings_gc(&mut *rng)),
        #[cfg(feature = "wal_disable")]
        wal_enabled: rng.random_bool(0.5),
        ..Default::default()
    };
    settings
}

/// Builds randomized deterministic reader options for DST scenarios.
pub fn build_reader_options(rand: &DbRand) -> DbReaderOptions {
    let mut rng = rand.rng();
    let manifest_poll_interval =
        rng.random_range(Duration::from_millis(100)..Duration::from_secs(5));
    // Lifetime must always be greater than twice the poll interval.
    let min_checkpoint_lifetime = manifest_poll_interval * 2 + Duration::from_micros(1);
    let checkpoint_lifetime =
        rng.random_range(min_checkpoint_lifetime..Duration::from_secs(4 * 60 * 60));
    let max_memtable_bytes = rng.random_range((MIB_1 as u64)..=(MIB_500 as u64));
    DbReaderOptions {
        manifest_poll_interval,
        checkpoint_lifetime,
        max_memtable_bytes,
        ..DbReaderOptions::default()
    }
}

/// Builds randomized deterministic scan options for DST scenarios.
pub fn build_scan_options(rand: &DbRand, read_durability: DurabilityLevel) -> ScanOptions {
    let mut rng = rand.rng();
    let read_ahead_options = [1, 4 * 1024, 64 * 1024, MIB_1];
    let order = if rng.random_bool(0.5) {
        IterationOrder::Ascending
    } else {
        IterationOrder::Descending
    };

    ScanOptions::new()
        .with_durability_filter(read_durability)
        .with_read_ahead_bytes(read_ahead_options[rng.random_range(0..read_ahead_options.len())])
        .with_cache_blocks(rng.random_bool(0.5))
        .with_max_fetch_tasks(rng.random_range(1..=4))
        .with_order(order)
}

/// Builds randomized deterministic compactor options for DST scenarios.
pub fn build_settings_compactor(rng: &mut impl Rng) -> CompactorOptions {
    let min_compaction_sources = rng.random_range(2..=4);
    let max_compaction_sources = rng.random_range(min_compaction_sources..=16);

    // Draw the worker's poll interval and minimum heartbeat interval first, then derive
    // `worker_heartbeat_timeout` from them. Drawing the heartbeat timeout independently can
    // produce `timeout < interval`, which reclaims healthy jobs and livelocks compaction.
    let compactions_poll_interval =
        rng.random_range(Duration::from_millis(1)..Duration::from_secs(5));
    let heartbeat_interval = rng.random_range(Duration::from_millis(1)..Duration::from_secs(5));
    let max_worker_heartbeat = heartbeat_interval.max(compactions_poll_interval);
    let worker_heartbeat_timeout = max_worker_heartbeat * rng.random_range(3..=10);

    CompactorOptions {
        poll_interval: rng.random_range(Duration::from_millis(1)..Duration::from_secs(5)),
        manifest_update_timeout: rng
            .random_range(Duration::from_millis(100)..Duration::from_secs(60)),
        max_concurrent_compactions: rng.random_range(1..=4),
        enable_trivial_move: rng.random_bool(0.5),
        scheduler_options: SizeTieredCompactionSchedulerOptions {
            min_compaction_sources,
            max_compaction_sources,
            include_size_threshold: rng.random_range(2.0..=8.0),
            sorted_run_consolidation_threshold: 0,
        }
        .into(),
        worker: Some(CompactionWorkerOptions {
            max_concurrent_compactions: rng.random_range(1..=4),
            compactions_poll_interval,
            heartbeat_interval,
            max_sst_size: rng.random_range(KIB_8..GIB_2),
            max_fetch_tasks: rng.random_range(1..=8),
            bytes_to_fetch: rng.random_range(KIB_8..=(8 * MIB_1)),
            ..CompactionWorkerOptions::default()
        }),
        metric_level: None,
        commit_compacted_interval: rng
            .random_range(Duration::from_millis(1)..Duration::from_secs(5)),
        checkpoint_lifetime: CompactorOptions::default().checkpoint_lifetime,
        worker_heartbeat_timeout,
        object_store_max_retries: None,
    }
}

/// Builds randomized deterministic garbage collector options for DST scenarios.
pub fn build_settings_gc(rng: &mut impl Rng) -> GarbageCollectorOptions {
    GarbageCollectorOptions {
        manifest_options: Some(GarbageCollectorDirectoryOptions {
            interval: Some(rng.random_range(Duration::from_millis(1)..Duration::from_secs(600))),
            min_age: rng.random_range(Duration::from_millis(1)..Duration::from_secs(900)),
            dry_run: false,
        }),
        wal_options: Some(GarbageCollectorDirectoryOptions {
            interval: Some(rng.random_range(Duration::from_millis(1)..Duration::from_secs(600))),
            min_age: rng.random_range(Duration::from_millis(1)..Duration::from_secs(900)),
            dry_run: false,
        }),
        wal_fence_options: None,
        compacted_options: Some(GarbageCollectorDirectoryOptions {
            interval: Some(rng.random_range(Duration::from_millis(1)..Duration::from_secs(600))),
            min_age: rng.random_range(Duration::from_millis(1)..Duration::from_secs(900)),
            dry_run: false,
        }),
        compactions_options: Some(GarbageCollectorDirectoryOptions {
            interval: Some(rng.random_range(Duration::from_millis(1)..Duration::from_secs(600))),
            min_age: rng.random_range(Duration::from_millis(1)..Duration::from_secs(900)),
            dry_run: false,
        }),
        detach_options: Some(GarbageCollectorScheduleOptions {
            interval: Some(rng.random_range(Duration::from_millis(1)..Duration::from_secs(600))),
        }),
        metric_level: None,
        boundary_files_enabled: true,
        object_store_max_retries: None,
    }
}

/// Builds a deterministic randomized object-store toxic.
///
/// Generated toxics may be:
/// - `Latency`: 1 to 5 ms base latency, 0 to 15 ms jitter, and 0.35 to 0.95
///   toxicity.
/// - `Bandwidth`: 16 to 256 KiB/s bandwidth and 0.20 to 0.80 toxicity.
/// - `SlowClose`: 1 to 10 ms close delay and 0.30 to 0.90 toxicity.
/// - `ResetPeer`: connection reset failures with 0.005 to 0.035 toxicity.
///
/// ## Arguments
/// - `rand`: The deterministic RNG used to choose each toxic's kind, operation
///   filter, path filter, direction, and toxicity.
/// - `root_path`: The object-store root path used by the scenario. When non-empty,
///   generated path filters may target the root itself or one of SlateDB's standard
///   subdirectories: `wal`, `manifest`, `compacted`, or `compactions`.
/// - `index`: The index used in the generated toxic name.
///
/// ## Returns
/// Returns a generated toxic.
pub fn build_toxic(rand: &DbRand, root_path: &str, index: usize) -> Toxic {
    let mut rng = rand.rng();
    let root_path = root_path.trim_matches('/');

    let (kind_name, kind, direction, toxicity) = match rng.random_range(0..10) {
        0..=4 => {
            let direction = if rng.random_bool(0.5) {
                StreamDirection::Upstream
            } else {
                StreamDirection::Downstream
            };
            (
                "latency",
                ToxicKind::Latency {
                    latency: Duration::from_millis(rng.random_range(1_u64..=5)),
                    jitter: Duration::from_millis(rng.random_range(0_u64..=15)),
                },
                direction,
                rng.random_range(0.35..=0.95),
            )
        }
        5..=6 
```

### Core Architecture Module: `slatedb/src/compaction_worker.rs`
```
//! Distributed-compaction worker (RFC-0025).
//!
//! A [`CompactionWorker`] polls `.compactions` for `Scheduled` entries, claims
//! them via the optimistic CAS protocol described in RFC-0025, executes the
//! compaction with the same code path the in-process executor uses, and writes
//! `Compacted` (with the produced output recorded on the job's subcompaction)
//! back to `.compactions`. The coordinator separately observes those
//! `Compacted` entries and commits the manifest update (see
//! [`crate::compactor::CompactorEventHandler::commit_compacted_entries`]).
//!
//! # Deployment patterns
//!
//! Workers run in one of two modes:
//!
//! 1. **Embedded with Hybrid Optionality** a single worker is spawned inside the compaction coordinator's process. (
//!    The coordinator must have `worker: Some(CompactionWorkerOptions))` in its [`crate::config::CompactorOptions`].
//!    This is the default. Additional (non-embedded) workers may be started in addition to the embedded worker to
//!    satisfy scaling needs. This doesn't cause fencing and is an intended usage pattern.
//!
//! 2. **Standalone**: The compaction coordinator runs without an embedded worker and one or
//!    more separate worker processes each run a [`CompactionWorker`]. The coordinator must
//!    have `worker: None` in its [`crate::config::CompactorOptions`].
//!
//! # Heartbeat and failure detection
//!
//! Workers emit heartbeats to prove liveness. A heartbeat is a CAS write that
//! bumps `last_heartbeat_ms` in the worker's `.compactions` entry. Every
//! `heartbeat_interval`, the worker refreshes liveness for every active
//! job it still owns and publishes the latest compaction context reported by
//! the executor (the plan and each range's output SSTs), so a reclaiming
//! worker can resume completed ranges. The heartbeat ticker is the only path
//! that writes worker progress; executor progress reports are buffered in
//! memory until the next tick.
//!
//! The coordinator reclaims stale Running compactions whose
//! `last_heartbeat_ms` is older than
//! [`crate::config::CompactorOptions::worker_heartbeat_timeout`].
//! Reclaimed jobs resume from their last persisted state (`output_ssts`) when the
//! next worker picks them up.
//!
//! # Metrics
//!
//! Workers emit the following per-worker metrics labeled `{worker_id=<id>}`:
//!
//! | Metric | Description |
//! |---|---|
//! | `slatedb.compactor.bytes_compacted` | Bytes merged by this worker |
//! | `slatedb.compactor.running_compactions` | Jobs currently in-flight |
//! | `slatedb.compactor.ssts_written` | Output SSTs produced |
//!
//! Supply a recorder via [`CompactionWorkerBuilder::with_metrics_recorder`].
//! The coordinator emits complementary metrics (`jobs_claimed`, `jobs_reclaimed`,
//! `worker_last_heartbeat_ms`) on its own recorder.

use std::collections::BTreeMap;
use std::sync::Arc;

use async_trait::async_trait;
use fail_parallel::{fail_point, FailPointRegistry};
use futures::stream::BoxStream;
use log::{debug, error, info, warn};
use tokio::runtime::Handle;
use ulid::Ulid;

use crate::compactions_store::{CompactionsStore, StoredCompactions};
use crate::compactor::stats::{CompactionStats, WorkerStats};
use crate::compactor_executor::{
    CompactionExecutor, StartCompactionJobArgs, TokioCompactionExecutor,
    TokioCompactionExecutorOptions,
};
use crate::compactor_state::{Compaction, CompactionContext, CompactionStatus, WorkerSpec};
use crate::config::CompactionWorkerOptions;
use crate::db_state::SortedRun;
use crate::dispatcher::{MessageHandler, MessageHandlerExecutor, MessageTickerDef};
use crate::error::SlateDBError;
use crate::manifest::store::ManifestStore;
use crate::manifest::ManifestCore;
use crate::merge_operator::MergeOperatorType;
use crate::subcompaction::Subcompaction;
use crate::tablestore::TableStore;
use crate::utils::{format_bytes_si, IdGenerator};
#[cfg(feature = "compaction_filters")]
use crate::CompactionFilterSupplier;
use slatedb_common::clock::SystemClock;
use slatedb_common::metrics::MetricsRecorderHelper;
use slatedb_common::DbRand;

pub(crate) const COMPACTION_WORKER_TASK_NAME: &str = "compaction_worker";

#[derive(Debug)]
pub(crate) enum WorkerMessage {
    /// Signals that a compaction job has finished execution.
    CompactionJobFinished {
        /// Job id (distinct from the canonical compaction id).
        id: Ulid,
        /// Output SR on success, or the compaction error.
        result: Result<SortedRun, SlateDBError>,
    },
    /// Progress update from the [`CompactionExecutor`].
    CompactionJobProgress {
        /// The job id associated with this progress report.
        id: Ulid,
        /// The total number of bytes processed so far (estimate).
        bytes_processed: u64,
        /// The current compaction context, which may carry new output SSTs.
        ctx: CompactionContext,
    },
    /// Ticker-triggered message to poll `.compactions` for claimable jobs.
    PollCompactions,
    /// Ticker-triggered message to refresh liveness for all jobs this worker
    /// currently owns.
    HeartbeatOwnedJobs,
}

/// Stateless executor of compaction jobs claimed from `.compactions`.
///
/// Build one with [`CompactionWorkerBuilder`] and drive its event loop with
/// [`CompactionWorker::run`]. Call [`CompactionWorker::stop`] to gracefully
/// release any in-flight claims.
pub struct CompactionWorker {
    task_executor: Arc<MessageHandlerExecutor>,
}

impl CompactionWorker {
    pub(crate) fn new(task_executor: Arc<MessageHandlerExecutor>) -> Self {
        Self { task_executor }
    }

    /// Runs the worker until cancellation or fatal error. The worker polls
    /// `.compactions` every [`CompactionWorkerOptions::compactions_poll_interval`],
    /// claims up to [`CompactionWorkerOptions::max_concurrent_compactions`] jobs,
    /// executes them, and writes `Compacted` back to `.compactions`.
    pub async fn run(&self) -> Result<(), crate::Error> {
        self.start()?;
        self.join().await
    }

    /// Starts the worker's event loop monitor on the current runtime.
    ///
    /// Callers that interleave shutdown with a cancellation signal should call
    /// this before racing [`CompactionWorker::join`] against that signal, so the
    /// task is registered before [`CompactionWorker::stop`] can run. Otherwise a
    /// cancellation that wins the race would invoke `stop` on a worker that was
    /// never started, silently dropping the unstarted event loop. See
    /// [`crate::admin::Admin::run_compaction_worker`].
    pub(crate) fn start(&self) -> Result<(), crate::Error> {
        self.task_executor.monitor_on(&Handle::current())?;
        Ok(())
    }

    /// Waits for the worker's event loop to finish.
    pub(crate) async fn join(&self) -> Result<(), crate::Error> {
        self.task_executor
            .join_task(COMPACTION_WORKER_TASK_NAME)
            .await
            .map_err(|e| e.into())
    }

    /// Gracefully stops the worker, resetting any compactions it claimed back
    /// to `Scheduled` so other workers can pick them up immediately.
    pub async fn stop(&self) -> Result<(), crate::Error> {
        self.task_executor
            .shutdown_task(COMPACTION_WORKER_TASK_NAME)
            .await
            .map_err(|e| e.into())
    }
}

/// Total output SSTs recorded across a subcompaction progress (RFC-0028).
fn total_output_ssts(subcompactions: &[Subcompaction]) -> usize {
    subcompactions.iter().map(|s| s.output_ssts().len()).sum()
}

/// Internal `MessageHandler` for the worker's event loop.
///
/// Reuses [`CompactorMessage`] so the embedded [`TokioCompactionExecutor`] can
/// report `CompactionJobFinished` on the same channel the dispatcher polls.
pub(crate) struct CompactionWorkerHandler {
    worker_id: String,
    options: Arc<CompactionWorkerOptions>,
    compactions_store: Arc<CompactionsStore>,
    manifest_store: Arc<ManifestStore>,
    executor: Arc<dyn CompactionExecutor + Send + Sync>,
    clock: Arc<dyn SystemClock>,
    /// Lazily-initialized handle for CAS reads/writes on `.compactions`. The
    /// coordinator creates the file on first run; the worker tolerates its
    /// absence on early ticks.
    stored: Option<StoredCompactions>,
    rand: Arc<DbRand>,
    fp_registry: Arc<FailPointRegistry>,
    /// Latest compaction context reported by the executor for each active
    /// job. Entry present iff the job is active. Buffered here and published
    /// to `.compactions` with the next heartbeat tick (see
    /// [`Self::heartbeat_owned_jobs`]); progress reports themselves never
    /// write.
    job_progress: BTreeMap<Ulid, Option<CompactionContext>>,
}

impl CompactionWorkerHandler {
    pub(crate) fn new(
        worker_id: String,
        options: Arc<CompactionWorkerOptions>,
        compactions_store: Arc<CompactionsStore>,
        manifest_store: Arc<ManifestStore>,
        executor: Arc<dyn CompactionExecutor + Send + Sync>,
        clock: Arc<dyn SystemClock>,
        rand: Arc<DbRand>,
        fp_registry: Arc<FailPointRegistry>,
    ) -> Self {
        Self {
            worker_id,
            options,
            compactions_store,
            manifest_store,
            executor,
            clock,
            stored: None,
            rand,
            fp_registry,
            job_progress: BTreeMap::new(),
        }
    }

    /// Builds the worker's [`CompactionWorkerHandler`] and the receiver that
    /// the handler reads completion messages from. Shared between the
    /// standalone `run()` path and the embedded-worker path in `Compactor::run`.
    pub(crate) fn build_worker_handler(
        manifest_store: Arc<ManifestStore>,
        compactions_store: Arc<CompactionsStore>,
        table_store: Arc<TableStore>,
        options: Arc<CompactionWorkerOptions>,
        worker_runtime: Handle,
        rand: Arc<DbRand>,
        stats: Arc<CompactionStats>,
        recorder: MetricsRecorderHelper,
        system_clock: Arc<dyn SystemClock>,
        fp_registr
```

### Core Architecture Module: `slatedb/src/compactor_state.rs`
```
use std::collections::btree_map::Entry;
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::fmt::{Display, Formatter};
use std::sync::Arc;

use bytes::Bytes;
use log::{debug, error, info};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use crate::db_state::{SortedRun, SsTableHandle, SsTableView};
use crate::error::SlateDBError;
use crate::manifest::{Manifest, ManifestCore};
use crate::subcompaction::Subcompaction;
use slatedb_txn_obj::DirtyObject;

/// Identifier for a compaction input source.
///
/// A `SourceId` distinguishes between two kinds of inputs a compaction can read:
/// an existing compacted sorted run (identified by its run id), or an L0 SSTable
/// view (identified by its view ID).
#[derive(Clone, Copy, Debug, Hash, PartialEq, Eq, Serialize, Deserialize)]
pub enum SourceId {
    SortedRun(u32),
    SstView(Ulid),
}

impl Display for SourceId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                SourceId::SortedRun(id) => {
                    format!("{}", *id)
                }
                SourceId::SstView(_) => String::from("l0"),
            }
        )
    }
}

impl SourceId {
    /// Unwraps the source as a Sorted Run id, panicking if it is an L0 SST.
    ///
    /// ## Returns
    /// - The sorted run id.
    ///
    /// ## Panics
    /// - If called on `SourceId::SstView`.
    pub(crate) fn unwrap_sorted_run(&self) -> u32 {
        self.maybe_unwrap_sorted_run()
            .expect("tried to unwrap SstView as Sorted Run")
    }

    /// Returns the sorted run id if this source is a `SortedRun`, otherwise `None`.
    pub(crate) fn maybe_unwrap_sorted_run(&self) -> Option<u32> {
        match self {
            SourceId::SortedRun(id) => Some(*id),
            SourceId::SstView(_) => None,
        }
    }

    /// Returns the view ID if this source is an `SstView`, otherwise `None`.
    pub(crate) fn maybe_unwrap_sst_view(&self) -> Option<Ulid> {
        match self {
            SourceId::SortedRun(_) => None,
            SourceId::SstView(id) => Some(*id),
        }
    }
}

/// Immutable spec that describes a compaction. Two variants are supported
/// per RFC-0024:
///
/// - [`CompactionSpec::Tiered`] is the standard merge: read input sources,
///   write a single output sorted run with a destination id.
/// - [`CompactionSpec::DrainSegment`] retires a named segment without
///   merging — the compactor names the L0s and SRs it has observed, and the
///   commit advances the segment's watermark and clears its `compacted` list.
///
/// Every spec names exactly one segment (see RFC 24). For tiered specs an
/// empty `segment` targets the compatibility-encoded `prefix=""` segment
/// (root tree); a non-empty `segment` targets the named segment. Drain
/// specs require a non-empty `segment` — the empty-prefix segment cannot
/// be drained.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum CompactionSpec {
    Tiered(TieredCompactionSpec),
    DrainSegment(DrainSegmentSpec),
}

/// Tiered compaction spec: read inputs, merge into one output sorted run.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TieredCompactionSpec {
    /// Target segment prefix. Empty `Bytes` targets the `prefix=""` segment.
    segment: Bytes,
    /// Input sources for the compaction.
    sources: Vec<SourceId>,
    /// Destination sorted run id for the compaction output.
    destination: u32,
}

/// Drain-segment spec: retire a named segment as part of segment retention.
/// No merge is performed; on commit the segment's watermark advances to
/// cover the listed L0s and the listed sorted runs are removed from
/// `compacted`. The result is a "drain marker" that the writer prunes once
/// observed.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct DrainSegmentSpec {
    /// Target segment prefix. Must be non-empty — the `prefix=""` segment
    /// (root tree) cannot be drained.
    segment: Bytes,
    /// L0 SSTs and sorted runs the compactor has observed in the segment
    /// and is draining.
    sources: Vec<SourceId>,
}

impl CompactionSpec {
    /// Creates a tiered compaction spec targeting the compatibility-encoded
    /// `prefix=""` segment (the root tree). For specs that target a named
    /// segment, use [`CompactionSpec::for_segment`]. For drain operations,
    /// use [`CompactionSpec::drain_segment`].
    ///
    /// ## Arguments
    /// - `sources`: Ordered list of sources (L0 SST ULIDs and/or existing SR ids).
    /// - `destination`: Sorted Run id for the compaction output.
    pub fn new(sources: Vec<SourceId>, destination: u32) -> Self {
        Self::for_segment(Bytes::new(), sources, destination)
    }

    /// Creates a tiered compaction spec targeting the named segment with the
    /// given prefix. An empty `segment` is equivalent to [`CompactionSpec::new`]
    /// and targets the compatibility-encoded `prefix=""` segment.
    ///
    /// ## Arguments
    /// - `segment`: Target segment prefix.
    /// - `sources`: Ordered list of sources (L0 SST ULIDs and/or existing SR ids).
    /// - `destination`: Sorted Run id for the compaction output.
    pub fn for_segment(segment: Bytes, sources: Vec<SourceId>, destination: u32) -> Self {
        CompactionSpec::Tiered(TieredCompactionSpec {
            segment,
            sources,
            destination,
        })
    }

    /// Creates a drain-segment spec targeting the named (non-empty-prefix)
    /// segment. `sources` lists the L0s and SRs the compactor has observed in
    /// the segment and is draining.
    pub fn drain_segment(segment: Bytes, sources: Vec<SourceId>) -> Self {
        CompactionSpec::DrainSegment(DrainSegmentSpec { segment, sources })
    }

    /// The target segment prefix. Empty bytes mean the compatibility-encoded
    /// `prefix=""` segment (only valid for tiered specs).
    pub fn segment(&self) -> &Bytes {
        match self {
            CompactionSpec::Tiered(s) => &s.segment,
            CompactionSpec::DrainSegment(s) => &s.segment,
        }
    }

    /// The sources (input SSTs and sorted runs) for this compaction.
    pub fn sources(&self) -> &[SourceId] {
        match self {
            CompactionSpec::Tiered(s) => &s.sources,
            CompactionSpec::DrainSegment(s) => &s.sources,
        }
    }

    /// The destination sorted run id this compaction will produce, or `None`
    /// for drain specs (which produce no new SR).
    pub fn destination(&self) -> Option<u32> {
        match self {
            CompactionSpec::Tiered(s) => Some(s.destination),
            CompactionSpec::DrainSegment(_) => None,
        }
    }

    /// Returns true if this is a [`CompactionSpec::DrainSegment`] spec.
    pub fn is_drain(&self) -> bool {
        matches!(self, CompactionSpec::DrainSegment(_))
    }

    /// Returns true if any of the compaction sources are L0 SST views.
    pub fn has_l0_sources(&self) -> bool {
        self.sources()
            .iter()
            .any(|s| matches!(s, SourceId::SstView(_)))
    }

    /// Returns true if any of the compaction sources are sorted runs.
    pub fn has_sr_sources(&self) -> bool {
        self.sources()
            .iter()
            .any(|s| matches!(s, SourceId::SortedRun(_)))
    }
}

impl Display for CompactionSpec {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let displayed_sources: Vec<String> =
            self.sources().iter().map(|s| format!("{}", s)).collect();
        let segment = self.segment();
        match self {
            CompactionSpec::Tiered(spec) => {
                if segment.is_empty() {
                    write!(f, "{:?} -> SR({})", displayed_sources, spec.destination)
                } else {
                    write!(
                        f,
                        "[seg={:?}] {:?} -> SR({})",
                        segment, displayed_sources, spec.destination,
                    )
                }
            }
            CompactionSpec::DrainSegment(_) => {
                write!(f, "[seg={:?}] drain {:?}", segment, displayed_sources)
            }
        }
    }
}

/// Lifecycle status for a compaction.
///
/// State transitions:
/// ```text
/// Submitted --> Scheduled <-> Running --> Compacted --> Completed
///     |                          |           |
///     |                          v           |
///     +-----------------------> Failed <-----+
/// ```
///
/// `Completed` and `Failed` are terminal states. `Compacted` is the
/// distributed-compaction intermediate state where the worker has written its
/// final output SSTs but the coordinator has not yet committed the result to
/// the manifest. `Scheduled` is the coordinator's "ready for a worker to claim"
/// state: only the coordinator promotes `Submitted → Scheduled`, and only after
/// the spec has been validated against the current manifest. Workers exclusively
/// claim `Scheduled` entries — they never act on `Submitted` — which keeps the
/// coordinator the single gatekeeper for validation and ensures the coordinator
/// has the entry in local state before any worker can transition it onward.
/// See RFC-0025.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum CompactionStatus {
    /// The compaction has been submitted but the coordinator has not yet
    /// validated it. May originate from the internal scheduler, an admin
    /// submission, or a reload of `.compactions`.
    Submitted,
    /// The coordinator has validated the spec against the current manifest
    /// and promoted it; the job is ready to be claimed by a worker. Only the
    /// coordinator writes this state.
    Scheduled,
    /// The compaction is currently running.
    Running,
    /// The worker finished execution and wrote its output SSTs; the
    /// coordinator has not yet committed the result to the manifest.
    Compacted,
    /// The compaction finished 
```

### Core Architecture Module: `slatedb/src/compactor_state_protocols.rs`
```
//! Protocols for reading and writing compactor state safely.
//!
//! This module isolates the ordering rules for compactor state persistence:
//! - **Reads**: fetch compactions before manifests so GC sees a consistent view of
//!   in-flight/finished compactions alongside the active manifests.
//! - **Writes**: persist manifest updates before compactions so new SSTs are visible
//!   before trimming input references. Checkpoints are written first to keep inputs
//!   GC-safe during the update.
//!
//! Keeping these rules in one place makes it harder to regress GC safety or
//! compactor fencing logic elsewhere in the codebase.
use std::sync::Arc;
use std::time::Duration;

use log::{debug, info};

use crate::compactions_store::{CompactionsStore, FenceableCompactions, StoredCompactions};
use crate::compactor_state::{CompactionStatus, CompactorState, VersionedCompactions};
use crate::config::{CheckpointOptions, CompactorOptions};
use crate::error::SlateDBError;
use crate::manifest::store::{FenceableManifest, ManifestStore, StoredManifest};
use crate::manifest::VersionedManifest;
use crate::utils::IdGenerator;
use slatedb_common::clock::SystemClock;
use slatedb_common::DbRand;

/// A read-only view of compactor state suitable for consumers like GC.
///
/// This view intentionally avoids `DirtyObject` because reads should not create or mutate
/// remote state (e.g., a missing `.compactions` file on a fresh DB).
pub struct CompactorStateView {
    /// The latest compactions state if present, paired with its file version.
    pub(crate) compactions: Option<VersionedCompactions>,
    /// The latest manifest paired with its file version.
    pub(crate) manifest: VersionedManifest,
}

impl CompactorStateView {
    /// Returns a read-only view of the .compactions file if present.
    pub fn compactions(&self) -> Option<&VersionedCompactions> {
        self.compactions.as_ref()
    }

    /// Returns a read-only view of the .manifest file.
    pub fn manifest(&self) -> &VersionedManifest {
        &self.manifest
    }
}

/// Converts a full [`CompactorState`] into a read-only view.
impl From<&CompactorState> for CompactorStateView {
    fn from(state: &CompactorState) -> Self {
        CompactorStateView {
            compactions: Some(VersionedCompactions::from_compactions(
                state.compactions().id.into(),
                state.compactions().value.clone(),
            )),
            manifest: VersionedManifest::from_manifest(
                state.manifest().id.into(),
                state.manifest().value.clone(),
            ),
        }
    }
}

/// Reader that enforces compactions-first ordering when fetching state.
pub(crate) struct CompactorStateReader {
    /// Shared manifest store to read the latest manifest.
    manifest_store: Arc<ManifestStore>,
    /// Shared compactions store to fetch the latest compaction state first.
    compactions_store: Arc<CompactionsStore>,
}

impl CompactorStateReader {
    /// Creates a reader that returns a consistent view of compactions and active manifests.
    ///
    /// ## Arguments
    /// - `manifest_store`: Manifest store handle to read from.
    /// - `compactions_store`: Compactions store handle to read from.
    ///
    /// ## Returns
    /// - New reader instance that always fetches compactions before manifests.
    pub(crate) fn new(
        manifest_store: &Arc<ManifestStore>,
        compactions_store: &Arc<CompactionsStore>,
    ) -> Self {
        Self {
            manifest_store: manifest_store.clone(),
            compactions_store: compactions_store.clone(),
        }
    }

    /// Reads compactions then the latest manifest to keep consumers from observing an inconsistent view.
    pub(crate) async fn read_view(&self) -> Result<CompactorStateView, SlateDBError> {
        // Always read latest compactions before reading latest manifest.
        let compactions = self.compactions_store.try_read_latest_compactions().await?;
        let manifest = self.manifest_store.read_latest_manifest().await?;
        Ok(CompactorStateView {
            compactions,
            manifest,
        })
    }
}

/// Writer that fences and persists manifest-before-compactions with checkpointing.
pub(crate) struct CompactorStateWriter {
    /// Current in-memory compactor state (dirty manifest + compactions).
    pub(crate) state: CompactorState,
    /// Fenceable manifest handle used for refresh/update with fencing.
    manifest: FenceableManifest,
    /// Fenceable compactions handle used for refresh/update with fencing.
    compactions: FenceableCompactions,
    /// Lifetime of checkpoints that protect compaction inputs during manifest updates.
    checkpoint_lifetime: Duration,
    /// RNG for checkpoint ids.
    rand: Arc<DbRand>,
}

impl CompactorStateWriter {
    /// Initializes a fenced compactor state writer with manifest-first ordering.
    ///
    /// ## Arguments
    /// - `manifest_store`: Manifest store backing the writer.
    /// - `compactions_store`: Compactions store backing the writer.
    /// - `system_clock`: Clock for fencing/timeouts.
    /// - `options`: Compactor options containing timeouts.
    /// - `rand`: RNG for checkpoint ids.
    /// - `expected_epoch`: Previously observed compactor epoch.
    ///
    /// ## Returns
    /// - A new writer seeded with dirty manifest/compactions and finished compactions trimmed.
    pub(crate) async fn new(
        manifest_store: Arc<ManifestStore>,
        compactions_store: Arc<CompactionsStore>,
        system_clock: Arc<dyn SystemClock>,
        options: &CompactorOptions,
        rand: Arc<DbRand>,
        expected_epoch: Option<u64>,
    ) -> Result<Self, SlateDBError> {
        let stored_manifest =
            StoredManifest::load(manifest_store.clone(), system_clock.clone()).await?;
        let (manifest, mut compactions) = Self::fence(
            stored_manifest,
            compactions_store,
            system_clock.clone(),
            options,
            expected_epoch,
        )
        .await?;
        let dirty_manifest = manifest.prepare_dirty()?;
        let dirty_compactions = loop {
            let mut dirty_compactions = compactions.prepare_dirty()?;
            // Reset unclaimed scheduled compactions back to submitted on restart.
            // Scheduled compactions have no worker yet, so they always reset.
            // Stale Running compactions are left alone here: reclaim_stale_workers
            // reclaims them on the first tick (and before scheduling), so handling
            // them at startup too would just duplicate that logic.
            dirty_compactions.value.iter_mut().for_each(|c| {
                if matches!(c.status(), CompactionStatus::Scheduled) {
                    c.set_status(CompactionStatus::Submitted);
                    c.set_worker(None);
                }
            });
            dirty_compactions.value.retain_active_and_last_finished();
            match compactions.update(dirty_compactions.clone()).await {
                Ok(()) => break dirty_compactions,
                Err(err) if err.is_sequenced_write_conflict() => {
                    compactions.refresh().await?;
                }
                Err(err) => return Err(err),
            }
        };
        let state = CompactorState::new(dirty_manifest, dirty_compactions);
        Ok(Self {
            state,
            manifest,
            compactions,
            checkpoint_lifetime: options.checkpoint_lifetime,
            rand,
        })
    }

    async fn fence(
        stored_manifest: StoredManifest,
        compactions_store: Arc<CompactionsStore>,
        system_clock: Arc<dyn SystemClock>,
        options: &CompactorOptions,
        expected_epoch: Option<u64>,
    ) -> Result<(FenceableManifest, FenceableCompactions), SlateDBError> {
        let fenceable_manifest = FenceableManifest::init_compactor(
            stored_manifest,
            options.manifest_update_timeout,
            system_clock.clone(),
            expected_epoch,
        )
        .await?;
        let stored_compactions =
            match StoredCompactions::try_load(compactions_store.clone()).await? {
                Some(compactions) => compactions,
                None => {
                    info!("creating new compactions file [compactor_epoch=0]");
                    StoredCompactions::create(compactions_store.clone(), 0).await?
                }
            };
        let fenceable_compactions = FenceableCompactions::init_with_epoch(
            stored_compactions,
            options.manifest_update_timeout,
            system_clock.clone(),
            fenceable_manifest.local_epoch(),
        )
        .await?;
        Ok((fenceable_manifest, fenceable_compactions))
    }

    /// Refreshes the manifest and updates the local compactor state with any remote
    /// changes.
    ///
    /// ## Returns
    /// - `Ok(())` after state is refreshed, or `SlateDBError` on failure.
    pub(crate) async fn load_manifest(&mut self) -> Result<(), SlateDBError> {
        self.manifest.refresh().await?;
        self.state
            .merge_remote_manifest(self.manifest.prepare_dirty()?);
        Ok(())
    }

    /// Refreshes the compactions view and updates the local compactor state with any remote
    /// changes.
    ///
    /// ## Returns
    /// - `Ok(())` after compactions are refreshed, or `SlateDBError` on failure.
    pub(crate) async fn load_compactions(&mut self) -> Result<(), SlateDBError> {
        self.compactions.refresh().await?;
        self.state
            .merge_remote_compactions(self.compactions.prepare_dirty()?);
        Ok(())
    }

    /// Refreshes compactions first, then manifests, to preserve a consistent ordering.
    ///
    /// ## Returns
    /// - `Ok(())` after state is refreshed, or `SlateDBError` on failure.
    pub(crate) async fn refresh(&mut self) -> Result<(), SlateDBError> {
        self.load_compactions().await?;
        self.load_manifest().await?;
  
```

### Core Architecture Module: `slatedb/src/db_state.rs`
```
use crate::bytes_range::BytesRange;
use crate::config::CompressionCodec;
use crate::error::SlateDBError;
use crate::manifest::{Manifest, ManifestCore};
use crate::mem_table::{ImmutableMemtable, KVTable, WritableKVTable};
use crate::reader::DbStateReader;
use bytes::Bytes;
use rand::RngExt;
use serde::Serialize;
use slatedb_common::DbRand;
use slatedb_txn_obj::DirtyObject;
use std::collections::VecDeque;
use std::fmt::{Debug, Formatter};
use std::ops::Bound::{Excluded, Included, Unbounded};
use std::ops::{Bound, Range, RangeBounds};
use std::sync::Arc;
use ulid::Ulid;

/// A handle to an SSTable — the physical SST on storage.
#[derive(Clone, PartialEq, Serialize)]
pub struct SsTableHandle {
    /// The unique identifier for this compacted SSTable.
    pub id: SsTableId,

    /// The format version that this SSTable was serialized with.
    pub(crate) format_version: u16,

    /// Metadata information about this SSTable.
    pub info: SsTableInfo,
}

impl Debug for SsTableHandle {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!("SsTableHandle({:?})", self.id))
    }
}

impl SsTableHandle {
    pub(crate) fn new(id: SsTableId, format_version: u16, info: SsTableInfo) -> Self {
        SsTableHandle {
            id,
            format_version,
            info,
        }
    }

    /// Returns an estimate of the SST's on-disk size in bytes.
    ///
    /// This is a rough estimate: the index is the last thing written before
    /// the info footer, so `index_offset + index_len` approximates the file size.
    pub fn estimate_size(&self) -> u64 {
        self.info.index_offset + self.info.index_len
    }
}

impl AsRef<SsTableHandle> for SsTableHandle {
    fn as_ref(&self) -> &SsTableHandle {
        self
    }
}

/// A projected view of an SSTable, combining the physical SST handle with an
/// optional visible_range projection.
#[derive(Clone, PartialEq, Serialize)]
pub struct SsTableView {
    /// Unique identifier for this view.
    pub id: Ulid,

    /// The underlying physical SSTable handle.
    pub sst: SsTableHandle,

    /// The range of keys that are visible to the user. If non-empty, this view represents a projection
    /// over the SST file.
    pub(crate) visible_range: Option<BytesRange>,

    /// The effective range of keys that are visible to the user, which is the intersection of the
    /// physical range (first_key..unbounded) and any projection range.
    effective_range: BytesRange,
}

impl Debug for SsTableView {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!(
            "SsTableView({:?}, {:?})",
            self.sst.id, self.visible_range
        ))
    }
}

impl SsTableView {
    /// Create a view using a deterministic id derived from the SST's own identity.
    /// Use this only where no `DbRand` is available and the id is not stored in
    /// the manifest.
    pub(crate) fn identity(sst: SsTableHandle) -> Self {
        Self::new(sst.id.value(), sst)
    }

    /// Create a new view with no visible_range projection.
    pub(crate) fn new(id: Ulid, sst: SsTableHandle) -> Self {
        let effective_range = sst
            .info
            .physical_range()
            .unwrap_or_else(BytesRange::new_empty);

        SsTableView {
            id,
            sst,
            visible_range: None,
            effective_range,
        }
    }

    /// Create a new projected view with an optional visible_range.
    pub(crate) fn new_projected(
        id: Ulid,
        sst: SsTableHandle,
        visible_range: Option<BytesRange>,
    ) -> Self {
        let mut effective_range = sst
            .info
            .physical_range()
            .expect("SST always has a first entry.");
        if let Some(visible_range) = &visible_range {
            assert!(
                visible_range.is_start_bound_included_or_unbounded(),
                "Start bound of the visible range must be either Included or Unbounded."
            );
            effective_range = effective_range
                .intersect(visible_range)
                .expect("An intersection of visible and physical range must be non-empty.")
        }
        SsTableView {
            id,
            sst,
            visible_range,
            effective_range,
        }
    }

    #[cfg(test)]
    pub(crate) fn with_visible_range(&self, visible_range: BytesRange) -> Self {
        Self::new_projected(self.id, self.sst.clone(), Some(visible_range))
    }

    /// The SST's physical key range, derived from its first/last entry. This is
    /// the range that [`Self::new_projected`] intersects a visible range
    /// against.
    fn physical_range(&self) -> BytesRange {
        self.sst
            .info
            .physical_range()
            .expect("SST always has a first entry.")
    }

    /// Like [`Self::with_visible_range`], but returns `None` instead of
    /// panicking when `visible_range` does not overlap the SST's physical key
    /// range.
    ///
    /// [`Self::compacted_intersection`] bounds a sorted-run SST's logical
    /// coverage by the *next* SST's start key, which can extend past this SST's
    /// physical last key. When a projection range falls entirely into the gap
    /// between this SST's last physical key and the next SST's start key, the
    /// SST owns the range logically but holds no physical keys in it: it
    /// contributes nothing to the projection and is dropped rather than
    /// constructing a view whose physical/visible intersection is empty.
    pub(crate) fn try_with_visible_range(
        &self,
        visible_range: BytesRange,
        rand: &DbRand,
    ) -> Option<Self> {
        self.physical_range().intersect(&visible_range)?;
        if self.visible_range.as_ref() == Some(&visible_range) {
            return Some(self.clone());
        }
        // A changed range is a new view. Preserve the timestamp for GC watermarks.
        let id = loop {
            let id = Ulid::from_parts(self.id.timestamp_ms(), rand.rng().random::<u128>());
            if id != self.id {
                break id;
            }
        };
        Some(Self::new_projected(
            id,
            self.sst.clone(),
            Some(visible_range),
        ))
    }

    /// The range of keys that are visible to the user.
    ///
    /// ## Returns
    /// - `Some(BytesRange)` if there is a projection applied to this SST.
    /// - `None` if the entire SST is visible.
    pub fn visible_range(&self) -> Option<impl RangeBounds<Bytes>> {
        self.visible_range.clone()
    }

    // Compacted (non-WAL) SSTs are never empty. They are created by compaction or
    // memtable flushes, which should never produce empty SSTs. This method returns
    // the start bound after applying projections.
    pub(crate) fn compacted_effective_start_bound(&self) -> Bound<Bytes> {
        self.effective_range.start_bound().cloned()
    }

    // Compacted (non-WAL) SSTs are never empty. They are created by compaction or
    // memtable flushes, which should never produce empty SSTs. This method returns
    // the start key after applying projections.
    pub(crate) fn compacted_effective_start_key(&self) -> &Bytes {
        match self.effective_range.start_bound() {
            Included(k) => k,
            _ => unreachable!("Invalid start bound"),
        }
    }

    pub(crate) fn compacted_effective_range(&self) -> &BytesRange {
        &self.effective_range
    }

    pub(crate) fn compacted_intersection(
        &self,
        next_view: Option<&SsTableView>,
        range: &BytesRange,
    ) -> Option<BytesRange> {
        if let Some(next_view) = next_view {
            BytesRange::new(
                self.compacted_effective_start_bound(),
                Excluded(next_view.compacted_effective_start_key().clone()),
            )
            .intersect(range)
        } else {
            self.effective_range.intersect(range)
        }
    }

    pub(crate) fn intersects_range(&self, end_bound: Bound<Bytes>, range: &BytesRange) -> bool {
        let sst_range =
            BytesRange::new(Unbounded, end_bound.clone()).intersect(&self.effective_range);
        match sst_range {
            Some(sst_range) => BytesRange::new(sst_range.start_bound().cloned(), end_bound)
                .intersect(range)
                .is_some(),
            None => false,
        }
    }

    /// Calculate the view range for the given range.
    ///
    /// This method determines the effective range that can be accessed within an SST by:
    /// 1. Intersecting the requested range with the effective range
    /// 2. Returning None if the requested range does not overlap with the effective range
    pub(crate) fn calculate_view_range(&self, range: BytesRange) -> Option<BytesRange> {
        if let Some(visible_range) = &self.visible_range {
            return range.intersect(visible_range);
        }
        if self.sst.info.last_entry.is_some() {
            return range.intersect(&self.effective_range);
        }
        Some(range)
    }

    /// Returns an estimate of the underlying SST's on-disk size in bytes.
    pub fn estimate_size(&self) -> u64 {
        self.sst.estimate_size()
    }

    pub(crate) fn estimate_visible_size(&self) -> u64 {
        const MIN_ESTIMATED_SIZE_BYTES: f64 = 1.0;

        let raw_size = self.sst.estimate_size();
        if self.visible_range.is_none() {
            return raw_size;
        }
        let fraction = self.visible_fraction();
        ((raw_size as f64) * fraction)
            .round()
            .max(MIN_ESTIMATED_SIZE_BYTES) as u64
    }

    /// This function finds the size of the visible part of a file:
    /// - Compares the start and end keys of the file and the view.
    /// - Skips the bytes that are equal and reads the bytes after them.
    /// - Uses these bytes to find the fraction of the full file size.
    fn visible_fraction(&self) -> f64 {
        const FULL_VISIBLE_
```

### Core Architecture Module: `slatedb/src/utils.rs`
```
use crate::block_iterator::BlockIterator;
use crate::block_iterator_v2::BlockIteratorV2;
use crate::cached_object_store::CachedObjectStore;
use crate::config::PreloadLevel;
use crate::db_state::SortedRun;
use crate::db_state::SsTableHandle;
use crate::error::SlateDBError;
use crate::format::sst::{SST_FORMAT_VERSION, SST_FORMAT_VERSION_V2};
use crate::iter::{IterationOrder, RowEntryIterator};
use crate::manifest::ManifestCore;
use crate::paths::PathResolver;
use crate::read_trace::ReadTrace;
use crate::tablestore::TableStore;
use bytes::{Buf, BufMut, Bytes};
use futures::FutureExt;
use log::{error, warn};
use rand::{Rng, RngExt};
use slatedb_common::clock::SystemClock;
use std::any::Any;
use std::future::Future;
use std::panic::AssertUnwindSafe;
use std::sync::Arc;
use ulid::Ulid;
use uuid::Uuid;

use futures::StreamExt;
use std::collections::VecDeque;
use tracing::instrument::WithSubscriber;
use tracing::subscriber::NoSubscriber;

static EMPTY_KEY: Bytes = Bytes::new();

/// Whether the object store holds the main data path or the WAL.
#[derive(Debug, Clone, Copy)]
pub(crate) enum ObjectStoreType {
    /// The primary object store (SSTs, manifests, compacted data).
    Main,
    /// The dedicated WAL object store, when configured separately.
    Wal,
}

impl ObjectStoreType {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Main => "main",
            Self::Wal => "wal",
        }
    }
}

#[derive(Clone, Debug)]
pub(crate) struct WatchableOnceCell<T: Clone> {
    rx: tokio::sync::watch::Receiver<Option<T>>,
    tx: tokio::sync::watch::Sender<Option<T>>,
}

#[derive(Clone, Debug)]
pub(crate) struct WatchableOnceCellReader<T: Clone> {
    rx: tokio::sync::watch::Receiver<Option<T>>,
}

impl<T: Clone> WatchableOnceCell<T> {
    pub(crate) fn new() -> Self {
        let (tx, rx) = tokio::sync::watch::channel(None);
        Self { rx, tx }
    }

    /// Writes the value if not already set. Returns `true` if the value was
    /// written, `false` if a value was already present.
    pub(crate) fn write(&self, val: T) -> bool {
        self.tx.send_if_modified(|v| {
            if v.is_some() {
                return false;
            }
            v.replace(val);
            true
        })
    }

    pub(crate) fn reader(&self) -> WatchableOnceCellReader<T> {
        WatchableOnceCellReader {
            rx: self.rx.clone(),
        }
    }
}

impl<T: Clone> WatchableOnceCellReader<T> {
    pub(crate) fn read(&self) -> Option<T> {
        self.rx.borrow().clone()
    }

    pub(crate) async fn await_value(&mut self) -> T {
        self.rx
            .wait_for(|v| v.is_some())
            .await
            .expect("watch channel closed")
            .clone()
            .expect("no value found")
    }
}

/// Spawn a background tokio task. The task must return a Result<T, SlateDBError>.
/// When the task exits, the provided cleanup fn is called with a reference to the returned
/// result. If the task panics, the cleanup fn is called with Err(BackgroundTaskPanic).
pub(crate) fn spawn_bg_task<F, T, C>(
    name: String,
    handle: &tokio::runtime::Handle,
    cleanup_fn: C,
    future: F,
) -> tokio::task::JoinHandle<Result<T, SlateDBError>>
where
    F: Future<Output = Result<T, SlateDBError>> + Send + 'static,
    T: Send + 'static,
    C: FnOnce(&Result<T, SlateDBError>) + Send + 'static,
{
    // NOTE: It is critical that the future lives as long as the cleanup_fn.
    //       Otherwise, there is a gap where everything owned by the future is dropped
    //       before the cleanup_fn runs. Since our cleanup_fn's often set error states
    //       on the db, this would result in a gap where the db is not in an error state
    //       but resources such as channels have been dropped or closed. See #623 for
    //       details.
    let wrapped = AssertUnwindSafe(future).catch_unwind().map(move |outcome| {
        let result = match outcome {
            Ok(result) => result,
            Err(payload) => {
                error!(
                    "spawned task panicked. [name={}, panic={}]",
                    name,
                    panic_string(&payload)
                );
                Err(SlateDBError::BackgroundTaskPanic(name))
            }
        };
        cleanup_fn(&result);
        result
    });
    handle.spawn(wrapped)
}

/// Merge two options using the provided function.
pub(crate) fn merge_options<T>(
    current: Option<T>,
    next: Option<T>,
    f: impl Fn(T, T) -> T,
) -> Option<T> {
    match (current, next) {
        (Some(current), Some(next)) => Some(f(current, next)),
        (None, next) => next,
        (current, None) => current,
    }
}

/// Attaches the current subscriber only if a subscriber is set.
///
/// In an application using only log without a subscriber, spawning a task for a future with
/// the current subscriber attached, i.e.,
/// ```rust,no_run
/// # use tracing::instrument::WithSubscriber;
/// # let future = async {};
/// tokio::spawn(future.with_current_subscriber());
/// ```
/// sets tracing::dispatcher::has_been_set() and permanently disables tracing-to-log forwarding,
/// even with query tracing disabled. That means, logging messages with
/// ```rust
/// tracing::info!("message");
/// ```
/// does not work anymore after the spawning.
/// However, direct logging (not tracing-to-log forwarding) with
/// ```rust
/// log::info!("message");
/// ```
/// still works.
///
/// To avoid disabling tracing-to-log forwarding, this helper checks if a subscriber is set, if a
/// subscriber is set the subscriber is attached to the future, else `.with_current_subscriber()`
/// is not called.
pub(crate) fn spawn_with_optional_subscriber<F>(future: F) -> tokio::task::JoinHandle<F::Output>
where
    F: Future + Send + 'static,
    F::Output: Send + 'static,
{
    tokio::spawn(with_optional_subscriber(future))
}

/// Runs the future with the current tracing subscriber if one is set.
pub(crate) fn with_optional_subscriber<F: Future>(future: F) -> impl Future<Output = F::Output> {
    let dispatch = tracing::dispatcher::get_default(Clone::clone);

    async move {
        if dispatch.is::<NoSubscriber>() {
            future.await
        } else {
            future.with_subscriber(dispatch).await
        }
    }
}

/// Determines the last key and sequence number written by an output SST.
///
/// ## Arguments
/// - `table_store`: Table store for reading the SST index and blocks.
/// - `output_sst`: Output SST already written for a compaction being resumed.
/// - `segment`: Segment containing the output SST.
///
/// ## Returns
/// - `Ok(Some((Bytes, u64)))`: last key and sequence number from the final block.
/// - `Ok(None)`: when the SST contains no data blocks.
///
/// ## Errors
/// - `SlateDBError`: if reading the index or blocks fails.
pub(crate) async fn last_written_key_and_seq(
    table_store: Arc<TableStore>,
    output_sst: &SsTableHandle,
    segment: &Bytes,
) -> Result<Option<(Bytes, u64)>, SlateDBError> {
    let index = table_store
        .read_index(
            output_sst,
            false,
            Some(segment.clone()),
            &ReadTrace::none(),
            None,
        )
        .await?;
    let num_blocks = index.borrow().block_meta().len();
    if num_blocks == 0 {
        return Ok(None);
    }
    let last_block_idx = num_blocks - 1;
    let mut blocks = table_store
        .read_blocks_using_index(
            output_sst,
            index,
            last_block_idx..last_block_idx + 1,
            false,
            Some(segment.clone()),
            &ReadTrace::none(),
            None,
        )
        .await?;
    let Some(block) = blocks.pop_front() else {
        return Ok(None);
    };

    // Sort descending so we get the last row from the last block, which
    // should be the last written key/seq.
    let entry = match output_sst.format_version {
        SST_FORMAT_VERSION => {
            let mut block_iter = BlockIterator::new(block, IterationOrder::Descending);
            block_iter.init().await?;
            block_iter.next().await?
        }
        SST_FORMAT_VERSION_V2 => {
            let mut block_iter = BlockIteratorV2::new(block, IterationOrder::Descending);
            block_iter.init().await?;
            block_iter.next().await?
        }
        _ => {
            return Err(SlateDBError::InvalidVersion {
                format_name: "SST",
                supported_versions: vec![SST_FORMAT_VERSION, SST_FORMAT_VERSION_V2],
                actual_version: output_sst.format_version,
            });
        }
    };
    Ok(entry.map(|e| (e.key, e.seq)))
}

fn bytes_into_minimal_vec(bytes: &Bytes) -> Vec<u8> {
    let mut clamped = Vec::new();
    clamped.reserve_exact(bytes.len());
    clamped.put_slice(bytes.as_ref());
    clamped
}

pub(crate) fn clamp_allocated_size_bytes(bytes: &Bytes) -> Bytes {
    bytes_into_minimal_vec(bytes).into()
}

/// Computes the "index key" (lowest bound) for an SST index block, ie a key that's greater
/// than all keys in the previous block and less than or equal to all keys in the new block
pub(crate) fn compute_index_key(
    prev_block_last_key: Option<Bytes>,
    this_block_first_key: &Bytes,
) -> Bytes {
    if let Some(prev_key) = prev_block_last_key {
        compute_lower_bound(&prev_key, this_block_first_key)
    } else {
        EMPTY_KEY.clone()
    }
}

fn compute_lower_bound(prev_block_last_key: &Bytes, this_block_first_key: &Bytes) -> Bytes {
    assert!(!prev_block_last_key.is_empty() && !this_block_first_key.is_empty());

    for i in 0..prev_block_last_key.len() {
        if prev_block_last_key[i] != this_block_first_key[i] {
            return this_block_first_key.slice(..i + 1);
        }
    }

    // if the keys are equal, just use the full key
    if prev_block_last_key.len() == this_block_first_key.len() {
        return this_block_first_key.clone();
    }

    // if we didn't find a mismatch yet then the prev block's key 
```

### Core Architecture Module: `bindings/go/uniffi/cgo_flags.go`
```
package slatedb

/*
#cgo LDFLAGS: -lslatedb_uniffi
*/
import "C"

```

### Core Architecture Module: `bindings/go/uniffi/doc.go`
```
// Package slatedb exposes SlateDB's UniFFI-generated Go bindings.
//
// The package import path is:
//
//	import "slatedb.io/slatedb-go/uniffi"
//
// The package name is `slatedb`. The API is intentionally close to the Rust
// UniFFI surface rather than a fully idiomatic handwritten Go wrapper, so most
// types, option structs, and lifecycle methods map directly to the underlying
// SlateDB API.
//
// # Runtime Requirements
//
// This package uses cgo and links against the shared library produced by the
// repository's `slatedb-uniffi` crate. To build and run code that imports this
// package you need:
//
//   - Go 1.25 or newer
//   - `CGO_ENABLED=1`
//   - a working C toolchain
//   - the `slatedb_uniffi` shared library available to the platform loader
//
// During local development that usually means building the Rust shared library
// from the repository and adding `target/debug` or `target/release` to
// `LD_LIBRARY_PATH` on Linux or `DYLD_LIBRARY_PATH` on macOS.
//
// # Opening A Database
//
// Most programs start by constructing an [ObjectStore], then using a
// [DbBuilder] to open a writable [Db]:
//
//	store, err := slatedb.ObjectStoreResolve("memory:///")
//	if err != nil {
//		panic(err)
//	}
//	defer store.Destroy()
//
//	builder := slatedb.NewDbBuilder("example-db", store)
//	defer builder.Destroy()
//
//	db, err := builder.Build()
//	if err != nil {
//		panic(err)
//	}
//	defer db.Destroy()
//
//	if _, err := db.Put([]byte("hello"), []byte("world")); err != nil {
//		panic(err)
//	}
//
//	value, err := db.Get([]byte("hello"))
//	if err != nil {
//		panic(err)
//	}
//	if value != nil {
//		println(string(*value))
//	}
//
//	if err := db.Shutdown(); err != nil {
//		panic(err)
//	}
//
// [ObjectStoreResolve] accepts SlateDB object-store URLs such as `memory:///`.
// [ObjectStoreFromEnv] builds a store from environment-driven configuration.
//
// [DbBuilder] is the main entry point for writable databases. It can be
// customized with methods such as [DbBuilder.WithSettings],
// [DbBuilder.WithMergeOperator], [DbBuilder.WithSstBlockSize],
// [DbBuilder.WithWalObjectStore], and [DbBuilder.WithDbCacheDisabled] before
// calling [DbBuilder.Build].
//
// # Reading Data
//
// [Db], [DbReader], and [DbSnapshot] all support point reads and range scans.
// Point reads use [Db.Get], [DbReader.Get], or [DbSnapshot.Get]. When callers
// need row metadata such as sequence number or timestamps they can use the
// corresponding `GetKeyValue` variants, which return [KeyValue].
//
// Range and prefix queries use [KeyRange], [Db.Scan], [Db.ScanPrefix],
// [DbReader.Scan], [DbSnapshot.Scan], and the related `WithOptions` methods.
// These APIs return a [DbIterator]. Repeated calls to [DbIterator.Next] return
// rows in order until `nil` is returned, which signals end of iteration.
// [DbIterator.Seek] repositions an iterator to the first row at or after a key.
//
// [ReadOptions] and [ScanOptions] let callers tune visibility and performance,
// including durability filtering, dirty-read behavior, read-ahead, cache
// insertion, and scan fetch parallelism.
//
// For long-lived read-only access, open a [DbReader] with
// [NewDbReaderBuilder]. A reader's state selection can be configured with
// [DbReaderBuilder.WithReaderMode] and [ReaderMode]. It can also be configured
// with [ReaderOptions] and given a [MergeOperator] for merge-aware reads.
//
// [Db.Snapshot] creates a consistent read-only [DbSnapshot] from a writable
// database handle.
//
// # Writing Data
//
// The writable [Db] exposes single-key operations such as [Db.Put],
// [Db.Delete], and [Db.Merge], plus batch and durability controls through
// [PutOptions], [MergeOptions], [WriteOptions], and [FlushOptions].
//
// [WriteHandle] reports metadata assigned to a successful write and exposes
// [WriteHandle.AwaitDurable] for waiting until that specific write is durable.
//
// [WriteBatch] collects multiple mutations and applies them atomically through
// [Db.Write] or [Db.WriteWithOptions]. Batches are single-use once submitted.
//
// TTL behavior is configured with [Ttl] implementations such as [TtlDefault],
// [TtlNoExpiry], and [TtlExpireAfterMillis].
//
// # Transactions
//
// [Db.Begin] opens a [DbTransaction] at a chosen [IsolationLevel].
// Transactions support reads, scans, puts, deletes, merges, read marking for
// conflict detection, and either [DbTransaction.Commit] or
// [DbTransaction.Rollback]. A committed transaction returns a [WriteHandle] or
// `nil` if it performed no writes.
//
// A transaction is no longer usable after commit or rollback.
//
// # Configuration, Metrics, And Callbacks
//
// [Settings] is a mutable configuration object for [DbBuilder]. It can be
// created from defaults, environment variables, files, or JSON strings with
// [SettingsDefault], [SettingsFromEnv], [SettingsFromFile],
// [SettingsFromJsonString], and [SettingsLoad]. [Settings.Set] updates fields
// by dotted path using JSON literal values, and [Settings.ToJsonString]
// serializes the resulting configuration.
//
// A writable [Db] also exposes [Db.Status], [Db.Metrics], [Db.Flush], and
// [Db.FlushWithOptions] for health checks, instrumentation, and manual flushes.
//
// Custom merge logic is supplied through the [MergeOperator] callback
// interface. Rust-side logging can be forwarded into Go code with
// [InitLogging] and a [LogCallback].
//
// # Change Data Capture
//
// [NewSlateDbWalReader] opens a [SlateDbWalReader] for live WAL streaming.
// Call [SlateDbWalReader.Iterator] once with the first unconsumed WAL file ID,
// then keep calling [SlateDbWalIterator.Next]. The iterator waits and polls
// internally at the current tail. Persist every [WalRows.LastConsumedWalFileId],
// including empty fence batches, and resume from the following ID after a
// restart. [SlateDbWalReader.LastWalFileId] is available when a snapshot of the
// current tail is useful, but is not needed to drive the stream.
//
// # Errors
//
// Most fallible operations return a Go `error` whose concrete type unwraps to
// [Error]. Callers can use `errors.Is` with the exported sentinels
// [ErrErrorTransaction], [ErrErrorClosed], [ErrErrorUnavailable],
// [ErrErrorInvalid], [ErrErrorData], and [ErrErrorInternal] to branch on broad
// error categories.
//
// For example, invalid keys, malformed ranges, and reusing consumed objects
// typically surface as [ErrErrorInvalid]. Operations on closed handles surface
// as [ErrErrorClosed].
//
// # Resource Management
//
// Most exported handle types own a Rust-side resource and provide an explicit
// `Destroy` method, including [ObjectStore], [DbBuilder], [Db], [DbReader],
// [DbSnapshot], [DbTransaction], [DbIterator], [SlateDbWalReader],
// [SlateDbWalIterator], [Settings], and [WriteBatch].
//
// These handles install Go finalizers, but callers should not rely on garbage
// collection for timely cleanup. Prefer calling `Destroy` explicitly when a
// handle is no longer needed. For [Db] and [DbReader], call `Shutdown` first to
// close the database or reader cleanly, then call `Destroy` to release the Go
// binding handle.
//
// Builders are single-use after `Build`. [WriteBatch] is single-use after
// `Write`. Bounded iterator `Next` methods return `nil` when exhausted; the live
// [SlateDbWalIterator] instead waits at the current tail. Transaction commit
// methods may return `nil` when no write was emitted.
package slatedb

```

### Core Architecture Module: `bindings/go/uniffi/slatedb.go`
```
package slatedb

// #include <slatedb.h>
import "C"

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"reflect"
	"runtime"
	"runtime/cgo"
	"sync"
	"sync/atomic"
	"unsafe"
)

// This is needed, because as of go 1.24
// type RustBuffer C.RustBuffer cannot have methods,
// RustBuffer is treated as non-local type
type GoRustBuffer struct {
	inner C.RustBuffer
}

type RustBufferI interface {
	AsReader() *bytes.Reader
	Free()
	ToGoBytes() []byte
	Data() unsafe.Pointer
	Len() uint64
	Capacity() uint64
}

// C.RustBuffer fields exposed as an interface so they can be accessed in different Go packages.
// See https://github.com/golang/go/issues/13467
type ExternalCRustBuffer interface {
	Data() unsafe.Pointer
	Len() uint64
	Capacity() uint64
}

func RustBufferFromC(b C.RustBuffer) ExternalCRustBuffer {
	return GoRustBuffer{
		inner: b,
	}
}

func CFromRustBuffer(b ExternalCRustBuffer) C.RustBuffer {
	return C.RustBuffer{
		capacity: C.uint64_t(b.Capacity()),
		len:      C.uint64_t(b.Len()),
		data:     (*C.uchar)(b.Data()),
	}
}

func RustBufferFromExternal(b ExternalCRustBuffer) GoRustBuffer {
	return GoRustBuffer{
		inner: C.RustBuffer{
			capacity: C.uint64_t(b.Capacity()),
			len:      C.uint64_t(b.Len()),
			data:     (*C.uchar)(b.Data()),
		},
	}
}

func (cb GoRustBuffer) Capacity() uint64 {
	return uint64(cb.inner.capacity)
}

func (cb GoRustBuffer) Len() uint64 {
	return uint64(cb.inner.len)
}

func (cb GoRustBuffer) Data() unsafe.Pointer {
	return unsafe.Pointer(cb.inner.data)
}

func (cb GoRustBuffer) AsReader() *bytes.Reader {
	b := unsafe.Slice((*byte)(cb.inner.data), C.uint64_t(cb.inner.len))
	return bytes.NewReader(b)
}

func (cb GoRustBuffer) Free() {
	rustCall(func(status *C.RustCallStatus) bool {
		C.ffi_slatedb_uniffi_rustbuffer_free(cb.inner, status)
		return false
	})
}

func (cb GoRustBuffer) ToGoBytes() []byte {
	return C.GoBytes(unsafe.Pointer(cb.inner.data), C.int(cb.inner.len))
}

func stringToRustBuffer(str string) C.RustBuffer {
	return bytesToRustBuffer([]byte(str))
}

func bytesToRustBuffer(b []byte) C.RustBuffer {
	if len(b) == 0 {
		return C.RustBuffer{}
	}
	// We can pass the pointer along here, as it is pinned
	// for the duration of this call
	foreign := C.ForeignBytes{
		len:  C.int(len(b)),
		data: (*C.uchar)(unsafe.Pointer(&b[0])),
	}

	return rustCall(func(status *C.RustCallStatus) C.RustBuffer {
		return C.ffi_slatedb_uniffi_rustbuffer_from_bytes(foreign, status)
	})
}

type BufLifter[GoType any] interface {
	Lift(value RustBufferI) GoType
}

type BufLowerer[GoType any] interface {
	Lower(value GoType) C.RustBuffer
}

type BufReader[GoType any] interface {
	Read(reader io.Reader) GoType
}

type BufWriter[GoType any] interface {
	Write(writer io.Writer, value GoType)
}

func LowerIntoRustBuffer[GoType any](bufWriter BufWriter[GoType], value GoType) C.RustBuffer {
	// This might be not the most efficient way but it does not require knowing allocation size
	// beforehand
	var buffer bytes.Buffer
	bufWriter.Write(&buffer, value)

	bytes, err := io.ReadAll(&buffer)
	if err != nil {
		panic(fmt.Errorf("reading written data: %w", err))
	}
	return bytesToRustBuffer(bytes)
}

func LiftFromRustBuffer[GoType any](bufReader BufReader[GoType], rbuf RustBufferI) GoType {
	defer rbuf.Free()
	reader := rbuf.AsReader()
	item := bufReader.Read(reader)
	if reader.Len() > 0 {
		// TODO: Remove this
		leftover, _ := io.ReadAll(reader)
		panic(fmt.Errorf("Junk remaining in buffer after lifting: %s", string(leftover)))
	}
	return item
}

func rustCallWithError[E any, U any](converter BufReader[E], callback func(*C.RustCallStatus) U) (U, E) {
	var status C.RustCallStatus
	returnValue := callback(&status)
	err := checkCallStatus(converter, status)
	return returnValue, err
}

func checkCallStatus[E any](converter BufReader[E], status C.RustCallStatus) E {
	switch status.code {
	case 0:
		var zero E
		return zero
	case 1:
		return LiftFromRustBuffer(converter, GoRustBuffer{inner: status.errorBuf})
	case 2:
		// when the rust code sees a panic, it tries to construct a rustBuffer
		// with the message.  but if that code panics, then it just sends back
		// an empty buffer.
		if status.errorBuf.len > 0 {
			panic(fmt.Errorf("%s", FfiConverterStringINSTANCE.Lift(GoRustBuffer{inner: status.errorBuf})))
		} else {
			panic(fmt.Errorf("Rust panicked while handling Rust panic"))
		}
	default:
		panic(fmt.Errorf("unknown status code: %d", status.code))
	}
}

func checkCallStatusUnknown(status C.RustCallStatus) error {
	switch status.code {
	case 0:
		return nil
	case 1:
		panic(fmt.Errorf("function not returning an error returned an error"))
	case 2:
		// when the rust code sees a panic, it tries to construct a C.RustBuffer
		// with the message.  but if that code panics, then it just sends back
		// an empty buffer.
		if status.errorBuf.len > 0 {
			panic(fmt.Errorf("%s", FfiConverterStringINSTANCE.Lift(GoRustBuffer{
				inner: status.errorBuf,
			})))
		} else {
			panic(fmt.Errorf("Rust panicked while handling Rust panic"))
		}
	default:
		return fmt.Errorf("unknown status code: %d", status.code)
	}
}

func rustCall[U any](callback func(*C.RustCallStatus) U) U {
	returnValue, err := rustCallWithError[error](nil, callback)
	if err != nil {
		panic(err)
	}
	return returnValue
}

type NativeError interface {
	AsError() error
}

func writeInt8(writer io.Writer, value int8) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint8(writer io.Writer, value uint8) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeInt16(writer io.Writer, value int16) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint16(writer io.Writer, value uint16) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeInt32(writer io.Writer, value int32) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint32(writer io.Writer, value uint32) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeInt64(writer io.Writer, value int64) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint64(writer io.Writer, value uint64) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeFloat32(writer io.Writer, value float32) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeFloat64(writer io.Writer, value float64) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func readInt8(reader io.Reader) int8 {
	var result int8
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint8(reader io.Reader) uint8 {
	var result uint8
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readInt16(reader io.Reader) int16 {
	var result int16
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint16(reader io.Reader) uint16 {
	var result uint16
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readInt32(reader io.Reader) int32 {
	var result int32
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint32(reader io.Reader) uint32 {
	var result uint32
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readInt64(reader io.Reader) int64 {
	var result int64
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint64(reader io.Reader) uint64 {
	var result uint64
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readFloat32(reader io.Reader) float32 {
	var result float32
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readFloat64(reader io.Reader) float64 {
	var result float64
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func init() {

	FfiConverterBlockTransformerINSTANCE.register()
	FfiConverterCounterINSTANCE.register()
	FfiConverterGaugeINSTANCE.register()
	FfiConverterHistogramINSTANCE.register()
	FfiConverterLogCallbackINSTANCE.register()
	FfiConverterMergeOperatorINSTANCE.register()
	FfiConverterMetricsRecorderINSTANCE.register()
	FfiConverterPrefixExtractorINSTANCE.register()
	FfiConverterUpDownCounterINSTANCE.register()
	uniffiCheckChecksums()
}

func uniffiCheckChecksums() {
	// Get the bindings contract version from our ComponentInterface
	bindingsContractVersion := 30
	// Get the scaffolding contract version by calling the into the dylib
	scaffoldingContractVersion := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint32_t {
		return C.ffi_slatedb_uniffi_uniffi_contract_version()
	})
	if bindingsContractVersion != int(scaffoldingContractVersion) {
		// If this happens try cleaning and rebuilding your project
		panic("slatedb: UniFFI contract version mismatch")
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_slatedb_uniffi_checksum_func_init_logging()
		})
		if checksum != 43029 {
			// If this happens try cleaning and rebuilding your project
			panic("slatedb: uniffi_slatedb_uniffi_checksum_func_init_logging: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_slatedb_uniffi_checksum_method_admin_create_clone_builder_from_source()
		})
		if checksum != 20657 {
			// If this happens try cleaning and rebuilding your project
			panic("sla
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2086** (2026-09-09): **`foyer = "0.22.4"` floor breaks musl builds (foyer-rs/foyer#1338)**
  *Symptoms*: **Describe the bug**  SlateDB cannot be built for `*-unknown-linux-musl` targets. The workspace requires `foyer = "0.22.4"`, and `foyer-storage` 0.22.4 and 0.22.5 do not compile for musl.  This failure can be fixed either by lowering the required foyer version to 0.22.3, or by waiting for foyer upstream to fix it.  There is an open issue, foyer-rs/foyer#1338, opened 2026-09-05, but it has no PR yet.  **To Reproduce**  1. `rustup target add x86_64-unknown-linux-musl` 2. `apt-get install musl-dev` (or an equivalent musl toolchain) 3. From the SlateDB workspace root, with the default features that include `foyer`: `cargo build -p slatedb --target x86_64-unknown-linux-musl`  The same failure reaches any downstream crate that depends on SlateDB and builds for musl.  **Expected behavior**  SlateDB builds for `*-unknown-linux-musl`.  **Screenshots**  Not applicable. The compiler output is provided.  **Build**  - `uname -a`: `Darwin 25.6.0 Darwin Kernel Version 25.6.0 arm64` locally. The failing target is `x86_64-unknown-linux-musl`, built on Linux CI. - OS: Linux, building the musl target. Cross-compiling from macOS does not reach this error, because the `zstd-sys` and `lz4-sys` build scripts fail first looking for `x86_64-linux-musl-gcc`. - SlateDB Version: 0.16.0, at `4478eb907b98c0a52299f359127ccba82c2716b9` - Object Store: S3  **Additional context**  `foyer-storage/src/io/device/utils.rs` declares four ioctl request constants as `u64`. It selects a platform branch with `cfg!()` 

- **Issue #2055** (2026-08-27): **Make with_wal_object_store safe for incremental deployment**
  *Symptoms*: **Describe the bug**    `with_wal_object_store()` is unusable for incremental deployment on v0.15.0. When a writer creates a new DB with `with_wal_object_store()`, the manifest persists `wal_object_store_uri = Some("")`. Any subsequent reader opening that DB without `with_wal_object_store()` configured gets `WalStoreReconfigurationError`.   The root cause is that `FlatBufferManifestCodec::encode` writes V1 (which preserves the `wal_object_store_uri` field) unless segment state requires V2. PR #1473 dropped the field from V2, but normal databases without segments still write V1 — so the validation remains active even on 0.15.0.    **To Reproduce**    1. Create a new DB using `DbBuilder` with `with_wal_object_store()` configured   2. Open the same DB using `DbReaderBuilder` without `with_wal_object_store()`   3. Reader fails with `WalStoreReconfigurationError`    **Expected behavior**    On v0.15.0 (which includes the ManifestV2 codec from PR #1473), `wal_object_store_uri` should not block readers from opening a database — either by defaulting to V2 manifest format, or by stripping the field before persisting.    **Screenshots**    N/A    **Build**    - OS: Linux   - SlateDB Version: 0.15.0   - Object Store: S3-compatible (custom)    **Additional context**    - Discord thread: https://discord.com/channels/1232385660460204122/1542581454280851466   - The fix is to default to V2 manifest format in 0.16 (per RFC 0004's phased rollout plan: write V1 → write V2 universally → deprecat

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `da6ac332` (2026-10-01)
**Commit Message**: Fix/external compaction concurrency cap (#2110)

Co-authored-by: Chris <[REDACTED_EMAIL]>

**File**: `slatedb/src/compactor.rs` (modified, +251/-3)
```diff
@@ -1138,10 +1138,20 @@ impl CompactorEventHandler {
 
     /// Requests new compactions from the scheduler, validates them, and adds them to the
     /// state up to the the max concurrency limit. This method does not actually start
-    /// the compactions; that is done in [`CompactorEventHandler::maybe_start_compactions`].
+    /// the compactions; they become claimable in
+    /// [`CompactorEventHandler::maybe_validate_submitted_compactions`].
+    ///
+    /// The capacity subtraction saturates because the running count can exceed
+    /// the limit. An operator can lower `max_concurrent_compactions` and restart
+    /// while jobs run: restart leaves `Running` entries alone, and
+    /// `reclaim_stale_workers` only reclaims the ones whose worker stopped
+    /// heartbeating. A scheduling tick must not panic on that state.
     async fn maybe_schedule_compactions(&mut self) -> Result<(), SlateDBError> {
         let running_compaction_count = self.running_compaction_count();
-        let available_capacity = self.options.max_concurrent_compactions - running_compaction_count;
+        let available_capacity = self
+            .options
+            .max_concurrent_compactions
+            .saturating_sub(running_compaction_count);
 
         if available_capacity == 0 {
             debug!(
@@ -1234,6 +1244,26 @@ impl CompactorEventHandler {
                     .finish_compaction(compaction.id(), output_sr);
                 manifest_changed = true;
             } else {
+                // Promotion is the coordinator's last chance to apply
+                // `max_concurrent_compactions`: once an entry is `Scheduled`, any
+                // worker can claim it without consulting the coordinator. A
+                // `Scheduled` entry is therefore already spoken for and counts
+                // against the limit alongside `Running`. Leave the entry
+                // `Submitted` when the limit is full.
+                let claimed_compaction_count = self
+                    .state()
+                    .active_compactions()
+                    .filter(|c| c.scheduled() || c.running())
+                    .count();
+                if claimed_compaction_count >= self.options.max_concurrent_compactions {
+                    debug!(
+                        "skipping compaction promotion since at capacity [claimed_compactions={}, max_concurrent_compactions={}, compaction={:?}]",
+                        claimed_compaction_count,
+                        self.options.max_concurrent_compactions,
+                        compaction
+                    );
+                    continue;
+                }
                 self.state_mut().update_compaction(&compaction.id(), |c| {
                     c.clear_ctx();
                     c.set_status(CompactionStatus::Scheduled)
@@ -1298,7 +1328,7 @@ impl CompactorEventHandler {
     fn running_compaction_count(&self) -> usize {
         self.state()
             .active_compactions()
-            .filter(|c| c.status() == CompactionStatus::Running)
+            .filter(|c| c.running())
             .count()
     }
 }
@@ -5173,6 +5203,224 @@ mod tests {
         );
     }
 
+    /// Installs two committed sorted runs and submits one compaction against
+    /// each through the external path that `Admin::submit_compaction` uses. The
+    /// two specs share no source and each destination is its own source, so
+    /// neither the parallel L0 rule nor the destination overwrite rule rejects
+    /// them. Capacity is the only thing that holds the second spec back.
+    async fn submit_two_independent_external_compactions(
+        fixture: &mut CompactorEventHandlerTestFixture,
+    ) {
+        let rand = Arc::new(DbRand::default());
+        let clock: Arc<dyn SystemClock> = Arc::new(DefaultSystemClock::new());
+        for source in [1u32, 2u32] {
+            Compactor::submit(
+                CompactionSpec::new(vec![SourceId::SortedRun(source)], source),
+                fixture.compactions_store.clone(),
+                rand.clone(),
+                clock.clone(),
+            )
+            .await
+            .expect("failed to submit compaction");
+        }
+
+        fixture.handler.state_writer.refresh().await.unwrap();
+
+        let core = &mut fixture
+            .handler
+            .state_writer
+            .state
+            .manifest_mut_for_test()
+            .value
+            .core;
+        Arc::make_mut(&mut core.tree).compacted = vec![
+            SortedRun::new(1, [bounded_sst_view(1, b"a", b"b")]),
+            SortedRun::new(2, [bounded_sst_view(2, b"y", b"z")]),
+        ];
+    }
+
+    fn ids_with_status(
+        fixture: &CompactorEventHandlerTestFixture,
+        status: CompactionStatus,
+    ) -> Vec<Ulid> {
+        fixture
+            .handler
+            .state()
+            .compactions_with_status(&[status])
+            .map(|c| c.id())
+            .collect()
+    }
+
+    /// Externally submit
```

**File**: `slatedb/src/compactor_state.rs` (modified, +10/-0)
```diff
@@ -573,6 +573,16 @@ impl Compaction {
         self.status
     }
 
+    /// Returns whether a worker can claim this compaction but has not yet.
+    pub(crate) fn scheduled(&self) -> bool {
+        matches!(self.status, CompactionStatus::Scheduled)
+    }
+
+    /// Returns whether a worker has claimed this compaction and is executing it.
+    pub(crate) fn running(&self) -> bool {
+        matches!(self.status, CompactionStatus::Running)
+    }
+
     /// Returns all output SSTs produced by this compaction.
     pub fn output_ssts(&self) -> Vec<SsTableHandle> {
         self.output_ssts.clone()
```

---

### Incident Patch 2: `a961e029` (2026-10-01)
**Commit Message**: uniffi: with_system_clock on the Db, reader and admin builders (#2123)

**File**: `bindings/go/uniffi/slatedb.go` (modified, +317/-0)
```diff
@@ -571,6 +571,15 @@ func uniffiCheckChecksums() {
 			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_adminbuilder_with_seed: UniFFI API checksum mismatch")
 		}
 	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_adminbuilder_with_system_clock()
+		})
+		if checksum != 11928 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_adminbuilder_with_system_clock: UniFFI API checksum mismatch")
+		}
+	}
 	{
 		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
 			return C.uniffi_slatedb_uniffi_checksum_method_adminbuilder_with_wal_object_store()
@@ -751,6 +760,15 @@ func uniffiCheckChecksums() {
 			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_dbbuilder_with_sst_block_size: UniFFI API checksum mismatch")
 		}
 	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_dbbuilder_with_system_clock()
+		})
+		if checksum != 2584 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_dbbuilder_with_system_clock: UniFFI API checksum mismatch")
+		}
+	}
 	{
 		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
 			return C.uniffi_slatedb_uniffi_checksum_method_dbbuilder_with_wal_object_store()
@@ -850,6 +868,15 @@ func uniffiCheckChecksums() {
 			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_dbreaderbuilder_with_segment_extractor: UniFFI API checksum mismatch")
 		}
 	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_dbreaderbuilder_with_system_clock()
+		})
+		if checksum != 15259 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_dbreaderbuilder_with_system_clock: UniFFI API checksum mismatch")
+		}
+	}
 	{
 		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
 			return C.uniffi_slatedb_uniffi_checksum_method_dbreaderbuilder_with_wal_object_store()
@@ -859,6 +886,42 @@ func uniffiCheckChecksums() {
 			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_dbreaderbuilder_with_wal_object_store: UniFFI API checksum mismatch")
 		}
 	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_systemclock_advance()
+		})
+		if checksum != 53270 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_systemclock_advance: UniFFI API checksum mismatch")
+		}
+	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_systemclock_is_mock()
+		})
+		if checksum != 2441 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_systemclock_is_mock: UniFFI API checksum mismatch")
+		}
+	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_systemclock_now_millis()
+		})
+		if checksum != 3506 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_systemclock_now_millis: UniFFI API checksum mismatch")
+		}
+	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_systemclock_set()
+		})
+		if checksum != 60259 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_systemclock_set: UniFFI API checksum mismatch")
+		}
+	}
 	{
 		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
 			return C.uniffi_slatedb_uniffi_checksum_method_db_begin()
@@ -1840,6 +1903,24 @@ func uniffiCheckChecksums() {
 			panic("slatedb: uniffi_slatedb_uniffi_checksum_constructor_dbreaderbuilder_new: UniFFI API checksum mismatch")
 		}
 	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_constructor_systemclock_default_clock()
+		})
+		if checksum != 17122 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_constructor_systemclock_default_clock: UniFFI API checksum mismatch")
+		}
+	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_constructor_systemclock_mock()
+		})
+		if checksum != 18253 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_constructor_systemclock_mock: UniFFI API checksum mismatch")
+		}
+	}
 	{
 		checksum := rustCall(func(_uniffiStatus *C.RustCallSta
```

**File**: `bindings/go/uniffi/slatedb.h` (modified, +110/-0)
```diff
@@ -792,6 +792,11 @@ uint64_t uniffi_slatedb_uniffi_fn_method_adminbuilder_build(uint64_t ptr, RustCa
 void uniffi_slatedb_uniffi_fn_method_adminbuilder_with_seed(uint64_t ptr, uint64_t seed, RustCallStatus *out_status
 );
 #endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_ADMINBUILDER_WITH_SYSTEM_CLOCK
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_ADMINBUILDER_WITH_SYSTEM_CLOCK
+void uniffi_slatedb_uniffi_fn_method_adminbuilder_with_system_clock(uint64_t ptr, uint64_t clock, RustCallStatus *out_status
+);
+#endif
 #ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_ADMINBUILDER_WITH_WAL_OBJECT_STORE
 #define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_ADMINBUILDER_WITH_WAL_OBJECT_STORE
 void uniffi_slatedb_uniffi_fn_method_adminbuilder_with_wal_object_store(uint64_t ptr, uint64_t wal_object_store, RustCallStatus *out_status
@@ -917,6 +922,11 @@ void uniffi_slatedb_uniffi_fn_method_dbbuilder_with_settings(uint64_t ptr, uint6
 void uniffi_slatedb_uniffi_fn_method_dbbuilder_with_sst_block_size(uint64_t ptr, RustBuffer sst_block_size, RustCallStatus *out_status
 );
 #endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_SYSTEM_CLOCK
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_SYSTEM_CLOCK
+void uniffi_slatedb_uniffi_fn_method_dbbuilder_with_system_clock(uint64_t ptr, uint64_t clock, RustCallStatus *out_status
+);
+#endif
 #ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_WAL_OBJECT_STORE
 #define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_WAL_OBJECT_STORE
 void uniffi_slatedb_uniffi_fn_method_dbbuilder_with_wal_object_store(uint64_t ptr, uint64_t wal_object_store, RustCallStatus *out_status
@@ -987,11 +997,57 @@ void uniffi_slatedb_uniffi_fn_method_dbreaderbuilder_with_reader_mode(uint64_t p
 void uniffi_slatedb_uniffi_fn_method_dbreaderbuilder_with_segment_extractor(uint64_t ptr, uint64_t extractor, RustCallStatus *out_status
 );
 #endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBREADERBUILDER_WITH_SYSTEM_CLOCK
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBREADERBUILDER_WITH_SYSTEM_CLOCK
+void uniffi_slatedb_uniffi_fn_method_dbreaderbuilder_with_system_clock(uint64_t ptr, uint64_t clock, RustCallStatus *out_status
+);
+#endif
 #ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBREADERBUILDER_WITH_WAL_OBJECT_STORE
 #define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBREADERBUILDER_WITH_WAL_OBJECT_STORE
 void uniffi_slatedb_uniffi_fn_method_dbreaderbuilder_with_wal_object_store(uint64_t ptr, uint64_t wal_object_store, RustCallStatus *out_status
 );
 #endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CLONE_SYSTEMCLOCK
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CLONE_SYSTEMCLOCK
+uint64_t uniffi_slatedb_uniffi_fn_clone_systemclock(uint64_t handle, RustCallStatus *out_status
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_FREE_SYSTEMCLOCK
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_FREE_SYSTEMCLOCK
+void uniffi_slatedb_uniffi_fn_free_systemclock(uint64_t handle, RustCallStatus *out_status
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CONSTRUCTOR_SYSTEMCLOCK_DEFAULT_CLOCK
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CONSTRUCTOR_SYSTEMCLOCK_DEFAULT_CLOCK
+uint64_t uniffi_slatedb_uniffi_fn_constructor_systemclock_default_clock(RustCallStatus *out_status
+    
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CONSTRUCTOR_SYSTEMCLOCK_MOCK
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CONSTRUCTOR_SYSTEMCLOCK_MOCK
+uint64_t uniffi_slatedb_uniffi_fn_constructor_systemclock_mock(int64_t initial_ts_millis, RustCallStatus *out_status
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_SYSTEMCLOCK_ADVANCE
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_SYSTEMCLOCK_ADVANCE
+uint64_t uniffi_slatedb_uniffi_fn_method_systemclock_advance(uint64_t ptr, uint64_t millis
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_SYSTEMCLOCK_IS_MOCK
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_SYSTEMCLOCK_IS_MOCK
+int8_t uniffi_slatedb_uniffi_fn_method_systemclock_is_mock(uint64_t ptr, RustCallStatus *out_status
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_SYSTEMCLOCK_NOW_MILLIS
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_SYSTEMCLOCK_NOW_MILLIS
+int64_t uniffi_slatedb_uniffi_fn_method_systemclock_now_millis(uint64_t ptr, RustCallStatus *out_status
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_SYSTEMCLOCK_SET
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_SYSTEMCLOCK_SET
+void uniffi_slatedb_uniffi_fn_method_systemclock_set(uint64_t ptr, int64_t ts_millis, RustCallStatus *out_status
+);
+#endif
 #ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CLONE_DB
 #define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CLONE_DB
 uint64_t uniffi_slatedb_uniffi_fn_clone_db(uint64_t handle, RustCallStatus *out_status
@@ -2295,6 +2351,12 @@ uint16_t uniffi_slatedb_uniff
```

**File**: `bindings/go/uniffi/system_clock_test.go` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+package slatedb_test
+
+import (
+	"errors"
+	"math"
+	"testing"
+	"time"
+
+	slatedb "slatedb.io/slatedb-go/uniffi"
+)
+
+// A database built with a mock clock stamps its writes from that clock
+// alone: time moves only when the test advances it.
+func TestDbFollowsTheInstalledSystemClock(t *testing.T) {
+	store := newMemoryStore(t)
+	clock, err := slatedb.SystemClockMock(1_000_000)
+	if err != nil {
+		t.Fatalf("SystemClockMock(1_000_000): %v", err)
+	}
+	defer clock.Destroy()
+	if !clock.IsMock() || clock.NowMillis() != 1_000_000 {
+		t.Fatalf("SystemClockMock(1_000_000): IsMock=%v NowMillis=%d", clock.IsMock(), clock.NowMillis())
+	}
+
+	dbHandle := openTestDB(t, store, func(t *testing.T, builder *slatedb.DbBuilder) {
+		t.Helper()
+		if err := builder.WithSystemClock(clock); err != nil {
+			t.Fatalf("DbBuilder.WithSystemClock(): %v", err)
+		}
+	})
+
+	first, err := dbHandle.db.Put([]byte("k"), []byte("v"))
+	if err != nil {
+		t.Fatalf("Put(): %v", err)
+	}
+	defer first.Destroy()
+	if got := first.CreateTs(); got != 1_000_000 {
+		t.Fatalf("CreateTs() = %d, want the mock clock's 1000000", got)
+	}
+	time.Sleep(20 * time.Millisecond)
+	second, err := dbHandle.db.Put([]byte("k"), []byte("w"))
+	if err != nil {
+		t.Fatalf("Put(): %v", err)
+	}
+	defer second.Destroy()
+	if got := second.CreateTs(); got != 1_000_000 {
+		t.Fatalf("CreateTs() after 20 ms of wall time = %d, want 1000000: the mock clock moved on its own", got)
+	}
+	if err := clock.Advance(500); err != nil {
+		t.Fatalf("Advance(500): %v", err)
+	}
+	if got := clock.NowMillis(); got != 1_000_500 {
+		t.Fatalf("NowMillis() after Advance(500) = %d, want 1000500", got)
+	}
+	third, err := dbHandle.db.Put([]byte("k"), []byte("x"))
+	if err != nil {
+		t.Fatalf("Put(): %v", err)
+	}
+	defer third.Destroy()
+	if got := third.CreateTs(); got != 1_000_500 {
+		t.Fatalf("CreateTs() after Advance(500) = %d, want 1000500", got)
+	}
+	if err := clock.Set(1_000_000); !errors.Is(err, slatedb.ErrErrorInvalid) {
+		t.Fatalf("Set() backwards on a mock clock: got %v, want an invalid error", err)
+	}
+	if got := clock.NowMillis(); got != 1_000_500 {
+		t.Fatalf("NowMillis() after a refused Set() = %d, want 1000500", got)
+	}
+	if err := dbHandle.db.Shutdown(); err != nil {
+		t.Fatalf("Shutdown(): %v", err)
+	}
+	dbHandle.open = false
+}
+
+// A mock clock refuses a time chrono cannot represent, at construction and
+// when moved.
+func TestSystemClockMockStaysInRange(t *testing.T) {
+	if _, err := slatedb.SystemClockMock(math.MaxInt64); !errors.Is(err, slatedb.ErrErrorInvalid) {
+		t.Fatalf("SystemClockMock(MaxInt64): got %v, want an invalid error", err)
+	}
+	clock, err := slatedb.SystemClockMock(1_000)
+	if err != nil {
+		t.Fatalf("SystemClockMock(1_000): %v", err)
+	}
+	defer clock.Destroy()
+	if err := clock.Set(1 << 62); !errors.Is(err, slatedb.ErrErrorInvalid) {
+		t.Fatalf("Set(1<<62): got %v, want an invalid error", err)
+	}
+	if err := clock.Advance(math.MaxUint64); !errors.Is(err, slatedb.ErrErrorInvalid) {
+		t.Fatalf("Advance(MaxUint64): got %v, want an invalid error", err)
+	}
+	if got := clock.NowMillis(); got != 1_000 {
+		t.Fatalf("NowMillis() after refused moves = %d, want 1000", got)
+	}
+}
+
+// The default clock cannot be driven, and a consumed builder refuses a clock.
+func TestSystemClockDefaultRefusesToBeDriven(t *testing.T) {
+	clock := slatedb.SystemClockDefaultClock()
+	defer clock.Destroy()
+	if clock.IsMock() {
+		t.Fatal("SystemClockDefaultClock().IsMock() = true")
+	}
+	if err := clock.Advance(1); !errors.Is(err, slatedb.ErrErrorInvalid) {
+		t.Fatalf("Advance() on the default clock: got %v, want an invalid error", err)
+	}
+	if err := clock.Set(1); err == nil {
+		t.Fatal("Set() on the default clock succeeded")
+	}
+	before := clock.NowMillis()
+	time.Sleep(5 * time.Millisecond)
+	if clock.NowMillis() < before {
+		t.Fatal("the default clock went backwards")
+	}
+
+	store := newMemoryStore(t)
+	reader := slatedb.NewDbReaderBuilder(testDBPath, store)
+	defer reader.Destroy()
+	if err := reader.WithSystemClock(clock); err != nil {
+		t.Fatalf("DbReaderBuilder.WithSystemClock(): %v", err)
+	}
+	admin := slatedb.NewAdminBuilder(testDBPath, store)
+	defer admin.Destroy()
+	if err := admin.WithSystemClock(clock); err != nil {
+		t.Fatalf("AdminBuilder.WithSystemClock(): %v", err)
+	}
+	built, err := admin.Build()
+	if err != nil {
+		t.Fatalf("AdminBuilder.Build(): %v", err)
+	}
+	built.Destroy()
+	if err := admin.WithSystemClock(clock); err == nil {
+		t.Fatal("a consumed AdminBuilder accepted a clock")
+	}
+}
```

**File**: `bindings/uniffi/Cargo.toml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ log = { workspace = true }
 parking_lot = { workspace = true }
 object_store = { workspace = true }
 slatedb = { workspace = true, features = ["all"] }
-slatedb-common = { workspace = true }
+slatedb-common = { workspace = true, features = ["test-util"] }
 serde_json = { workspace = true }
 thiserror = { workspace = true }
 tokio = { workspace = true, features = ["macros", "rt-multi-thread", "sync"] }
```

**File**: `bindings/uniffi/src/builder.rs` (modified, +49/-0)
```diff
@@ -2,6 +2,7 @@ use std::sync::Arc;
 
 use crate::admin::Admin;
 use crate::block_transformer::{adapt_block_transformer, BlockTransformer};
+use crate::clock::SystemClock;
 use crate::config::{ReaderMode, ReaderOptions, SstBlockSize};
 use crate::db::Db;
 use crate::db_cache::DbCache;
@@ -81,6 +82,15 @@ impl DbBuilder {
             .map_err(Into::into)
     }
 
+    /// Reads wall time from `clock` instead of the process clock. Every timer
+    /// follows it: TTL expiry, flush and poll ticks, the object-store retry
+    /// backoff and the flush timeout. On a frozen mock those wait until the
+    /// test advances the clock.
+    pub fn with_system_clock(&self, clock: Arc<SystemClock>) -> Result<(), Error> {
+        self.update_builder(|builder| builder.with_system_clock(clock.inner()))
+            .map_err(Into::into)
+    }
+
     /// What the block cache keeps of the SSTs this database writes, on a
     /// memtable flush and on a compaction's output.
     pub fn with_block_cache_policy(&self, policy: BlockCachePolicy) -> Result<(), Error> {
@@ -236,6 +246,15 @@ impl DbReaderBuilder {
             .map_err(Into::into)
     }
 
+    /// Reads wall time from `clock` instead of the process clock. Every timer
+    /// follows it: checkpoint lifetimes, manifest polls, TTL visibility and
+    /// the object-store retry backoff. On a frozen mock those wait until the
+    /// test advances the clock.
+    pub fn with_system_clock(&self, clock: Arc<SystemClock>) -> Result<(), Error> {
+        self.update_builder(|builder| builder.with_system_clock(clock.inner()))
+            .map_err(Into::into)
+    }
+
     /// Decodes every SST block this reader fetches with the transform the
     /// database's writer encodes with.
     pub fn with_block_transformer(
@@ -359,6 +378,15 @@ impl AdminBuilder {
             .map_err(Into::into)
     }
 
+    /// Reads wall time from `clock` instead of the process clock. Every timer
+    /// follows it: checkpoint expiry, garbage collector and compactor schedule
+    /// ticks and the object-store retry backoff. On a frozen mock those wait
+    /// until the test advances the clock.
+    pub fn with_system_clock(&self, clock: Arc<SystemClock>) -> Result<(), Error> {
+        self.update_builder(|builder| builder.with_system_clock(clock.inner()))
+            .map_err(Into::into)
+    }
+
     /// Builds the admin handle and consumes this builder.
     pub fn build(&self) -> Result<Arc<Admin>, Error> {
         let builder = self.take_builder()?;
@@ -440,6 +468,27 @@ mod tests {
     use super::*;
     use crate::block_transformer::tests::Flip;
     use crate::config::{FlushOptions, FlushType, ReaderMode};
+    use std::time::Duration;
+
+    #[tokio::test]
+    async fn writes_are_stamped_by_the_installed_clock() {
+        let object_store = Arc::new(ObjectStore {
+            inner: Arc::new(object_store::memory::InMemory::new()),
+        });
+        let clock = SystemClock::mock(1_000_000).unwrap();
+        let builder = DbBuilder::new("clocked".to_owned(), object_store);
+        builder.with_system_clock(clock.clone()).unwrap();
+        let db = builder.build().await.unwrap();
+        let first = db.put(b"k".to_vec(), b"v".to_vec()).await.unwrap();
+        assert_eq!(first.create_ts(), 1_000_000);
+        tokio::time::sleep(Duration::from_millis(5)).await;
+        let second = db.put(b"k".to_vec(), b"w".to_vec()).await.unwrap();
+        assert_eq!(second.create_ts(), 1_000_000);
+        clock.advance(500).await.unwrap();
+        let third = db.put(b"k".to_vec(), b"x".to_vec()).await.unwrap();
+        assert_eq!(third.create_ts(), 1_000_500);
+        db.close().await.unwrap();
+    }
 
     #[tokio::test]
     async fn blocks_written_through_a_transform_read_back_only_through_it() {
```

**File**: `bindings/uniffi/src/clock.rs` (added, +167/-0)
```diff
@@ -0,0 +1,167 @@
+use std::sync::Arc;
+use std::time::Duration;
+
+use chrono::DateTime;
+use slatedb_common::clock::{DefaultSystemClock, MockSystemClock, SystemClock as Clock};
+
+use crate::error::{Error, SlateDbError};
+
+/// The clock a `Db`, `DbReader` or `Admin` reads wall time from. Every engine
+/// timer follows it: TTL expiry, checkpoint lifetimes, flush and poll ticks,
+/// the object-store retry backoff and the flush timeout.
+#[derive(uniffi::Object)]
+pub struct SystemClock {
+    inner: Inner,
+}
+
+enum Inner {
+    Default(Arc<DefaultSystemClock>),
+    Mock(Arc<MockSystemClock>),
+}
+
+#[uniffi::export]
+impl SystemClock {
+    /// The process clock.
+    #[uniffi::constructor]
+    pub fn default_clock() -> Arc<Self> {
+        Arc::new(Self {
+            inner: Inner::Default(Arc::new(DefaultSystemClock::new())),
+        })
+    }
+
+    /// A clock frozen at `initial_ts_millis` (milliseconds since the Unix
+    /// epoch) that moves only through `advance` and `set`. Refused when
+    /// `initial_ts_millis` is not a representable timestamp.
+    #[uniffi::constructor]
+    pub fn mock(initial_ts_millis: i64) -> Result<Arc<Self>, Error> {
+        check_timestamp(initial_ts_millis)?;
+        Ok(Arc::new(Self {
+            inner: Inner::Mock(Arc::new(MockSystemClock::with_time(initial_ts_millis))),
+        }))
+    }
+
+    /// The clock's current time in milliseconds since the Unix epoch.
+    pub fn now_millis(&self) -> i64 {
+        self.inner().now().timestamp_millis()
+    }
+
+    /// Moves a mock clock forward by `millis`. Engine tasks sleeping on the
+    /// clock see the new time when the runtime next polls them; `advance`
+    /// returns without waiting for that, so a test must wait for the effect it
+    /// expects (an expired key, a completed flush) rather than assert it at
+    /// once. Refused on the default clock and when the result is not a
+    /// representable timestamp.
+    pub async fn advance(&self, millis: u64) -> Result<(), Error> {
+        let mock = self.mock_clock()?;
+        let now_millis = mock.now().timestamp_millis();
+        let ts_millis =
+            i64::try_from(millis).map_or(i64::MAX, |millis| now_millis.saturating_add(millis));
+        check_timestamp(ts_millis)?;
+        mock.advance(Duration::from_millis(millis)).await;
+        Ok(())
+    }
+
+    /// Sets a mock clock to `ts_millis`. The engine's tickers require a
+    /// monotonic clock, so a time before the clock's current one is refused,
+    /// as is one that is not a representable timestamp. Refused on the default
+    /// clock.
+    pub fn set(&self, ts_millis: i64) -> Result<(), Error> {
+        let mock = self.mock_clock()?;
+        check_timestamp(ts_millis)?;
+        let now_millis = mock.now().timestamp_millis();
+        if ts_millis < now_millis {
+            return Err(SlateDbError::ClockMovedBackwards {
+                ts_millis,
+                now_millis,
+            }
+            .into());
+        }
+        mock.set(ts_millis);
+        Ok(())
+    }
+
+    pub fn is_mock(&self) -> bool {
+        matches!(self.inner, Inner::Mock(_))
+    }
+}
+
+impl SystemClock {
+    pub(crate) fn inner(&self) -> Arc<dyn Clock> {
+        match &self.inner {
+            Inner::Default(clock) => clock.clone(),
+            Inner::Mock(clock) => clock.clone(),
+        }
+    }
+
+    fn mock_clock(&self) -> Result<&Arc<MockSystemClock>, Error> {
+        match &self.inner {
+            Inner::Mock(clock) => Ok(clock),
+            Inner::Default(_) => Err(SlateDbError::ClockNotMock.into()),
+        }
+    }
+}
+
+/// `MockSystemClock::now` panics on a timestamp chrono cannot represent, so
+/// every way of choosing one is checked before the clock holds it.
+fn check_timestamp(ts_millis: i64) -> Result<(), Error> {
+    DateTime::from_timestamp_millis(ts_millis)
+        .map(|_| ())
+        .ok_or(SlateDbError::InvalidTimestampMillis { ts_millis }.into())
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[tokio::test]
+    async fn mock_moves_only_when_told() {
+        let clock = SystemClock::mock(1_000).unwrap();
+        assert!(clock.is_mock());
+        assert_eq!(clock.now_millis(), 1_000);
+        tokio::time::sleep(Duration::from_millis(5)).await;
+        assert_eq!(clock.now_millis(), 1_000);
+        clock.advance(500).await.unwrap();
+        assert_eq!(clock.now_millis(), 1_500);
+        clock.set(2_000).unwrap();
+        assert_eq!(clock.now_millis(), 2_000);
+        clock.set(2_000).unwrap();
+        assert_eq!(clock.now_millis(), 2_000);
+    }
+
+    #[tokio::test]
+    async fn mock_never_moves_backwards() {
+        let clock = SystemClock::mock(1_000).unwrap();
+        assert!(matches!(clock.set(999), Err(Error::Invalid { .. })));
+        assert_eq!(clock.now_millis(), 1_000);
+    }
+
+    #[tokio::test]
+    async fn mock_stays_inside_the_representable_range() {
+        assert!(matches!(
+            SystemClock::mock
```

**File**: `bindings/uniffi/src/error.rs` (modified, +9/-0)
```diff
@@ -36,6 +36,15 @@ pub(crate) enum SlateDbError {
     #[error("invalid timestamp seconds: {timestamp_secs}")]
     InvalidTimestampSeconds { timestamp_secs: i64 },
 
+    #[error("invalid timestamp millis: {ts_millis}")]
+    InvalidTimestampMillis { ts_millis: i64 },
+
+    #[error("mock clock cannot move backwards from {now_millis} to {ts_millis}")]
+    ClockMovedBackwards { ts_millis: i64, now_millis: i64 },
+
+    #[error("only a mock clock can be advanced or set")]
+    ClockNotMock,
+
     #[error("range start must not be greater than range end")]
     RangeStartGreaterThanEnd,
 
```

**File**: `bindings/uniffi/src/lib.rs` (modified, +2/-0)
```diff
@@ -1,6 +1,7 @@
 mod admin;
 mod block_transformer;
 mod builder;
+mod clock;
 mod config;
 mod db;
 mod db_cache;
@@ -26,6 +27,7 @@ mod write_handle;
 pub use admin::Admin;
 pub use block_transformer::BlockTransformer;
 pub use builder::{AdminBuilder, CloneBuilder, DbBuilder, DbReaderBuilder};
+pub use clock::SystemClock;
 pub use config::{
     CloseOptions, DurabilityLevel, FlushOptions, FlushType, GarbageCollectorDirectoryOptions,
     GarbageCollectorOptions, GarbageCollectorScheduleOptions, IsolationLevel, IterationOrder,
```

---

### Incident Patch 3: `d7ea2d76` (2026-10-01)
**Commit Message**: uniffi: expose DbBuilder::with_block_cache_policy (#2129)

Co-authored-by: sinbad-io <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `bindings/go/uniffi/slatedb.go` (modified, +74/-0)
```diff
@@ -652,6 +652,15 @@ func uniffiCheckChecksums() {
 			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_dbbuilder_build: UniFFI API checksum mismatch")
 		}
 	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_dbbuilder_with_block_cache_policy()
+		})
+		if checksum != 18548 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_dbbuilder_with_block_cache_policy: UniFFI API checksum mismatch")
+		}
+	}
 	{
 		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
 			return C.uniffi_slatedb_uniffi_checksum_method_dbbuilder_with_block_transformer()
@@ -4726,6 +4735,9 @@ func (_ FfiDestroyerDb) Destroy(value *Db) {
 type DbBuilderInterface interface {
 	// Opens the database and consumes this builder.
 	Build() (*Db, error)
+	// What the block cache keeps of the SSTs this database writes, on a
+	// memtable flush and on a compaction's output.
+	WithBlockCachePolicy(policy BlockCachePolicy) error
 	// Transforms every SST block this database writes and reads, for
 	// encryption at rest. A `DbReaderBuilder` of the database must carry the
 	// same transform. The bindings run no standalone compactor or compaction
@@ -4814,6 +4826,19 @@ func (_self *DbBuilder) Build() (*Db, error) {
 	return res, err
 }
 
+// What the block cache keeps of the SSTs this database writes, on a
+// memtable flush and on a compaction's output.
+func (_self *DbBuilder) WithBlockCachePolicy(policy BlockCachePolicy) error {
+	_pointer := _self.ffiObject.incrementPointer("*DbBuilder")
+	defer _self.ffiObject.decrementPointer()
+	_, _uniffiErr := rustCallWithError[*Error](FfiConverterError{}, func(_uniffiStatus *C.RustCallStatus) bool {
+		C.uniffi_slatedb_uniffi_fn_method_dbbuilder_with_block_cache_policy(
+			_pointer, FfiConverterBlockCachePolicyINSTANCE.Lower(policy), _uniffiStatus)
+		return false
+	})
+	return _uniffiErr.AsError()
+}
+
 // Transforms every SST block this database writes and reads, for
 // encryption at rest. A `DbReaderBuilder` of the database must carry the
 // same transform. The bindings run no standalone compactor or compaction
@@ -9714,6 +9739,55 @@ func (_ FfiDestroyerWriteHandle) Destroy(value *WriteHandle) {
 	value.Destroy()
 }
 
+// What the block cache keeps of the SSTs this database writes: the targets a
+// memtable flush caches and the targets a compaction's output caches. An
+// empty list caches nothing on that path. The engine's default caches every
+// data block, the index and the filters on flush, and the index and filters
+// on compaction output.
+type BlockCachePolicy struct {
+	FlushTargets            []CacheTarget
+	CompactionOutputTargets []CacheTarget
+}
+
+func (r *BlockCachePolicy) Destroy() {
+	FfiDestroyerSequenceCacheTarget{}.Destroy(r.FlushTargets)
+	FfiDestroyerSequenceCacheTarget{}.Destroy(r.CompactionOutputTargets)
+}
+
+type FfiConverterBlockCachePolicy struct{}
+
+var FfiConverterBlockCachePolicyINSTANCE = FfiConverterBlockCachePolicy{}
+
+func (c FfiConverterBlockCachePolicy) Lift(rb RustBufferI) BlockCachePolicy {
+	return LiftFromRustBuffer[BlockCachePolicy](c, rb)
+}
+
+func (c FfiConverterBlockCachePolicy) Read(reader io.Reader) BlockCachePolicy {
+	return BlockCachePolicy{
+		FfiConverterSequenceCacheTargetINSTANCE.Read(reader),
+		FfiConverterSequenceCacheTargetINSTANCE.Read(reader),
+	}
+}
+
+func (c FfiConverterBlockCachePolicy) Lower(value BlockCachePolicy) C.RustBuffer {
+	return LowerIntoRustBuffer[BlockCachePolicy](c, value)
+}
+
+func (c FfiConverterBlockCachePolicy) LowerExternal(value BlockCachePolicy) ExternalCRustBuffer {
+	return RustBufferFromC(LowerIntoRustBuffer[BlockCachePolicy](c, value))
+}
+
+func (c FfiConverterBlockCachePolicy) Write(writer io.Writer, value BlockCachePolicy) {
+	FfiConverterSequenceCacheTargetINSTANCE.Write(writer, value.FlushTargets)
+	FfiConverterSequenceCacheTargetINSTANCE.Write(writer, value.CompactionOutputTargets)
+}
+
+type FfiDestroyerBlockCachePolicy struct{}
+
+func (_ FfiDestroyerBlockCachePolicy) Destroy(value BlockCachePolicy) {
+	value.Destroy()
+}
+
 // Options controlling how a bloom filter policy is constructed.
 //
 // Pass an optional prefix extractor as a separate constructor parameter; it
```

**File**: `bindings/go/uniffi/slatedb.h` (modified, +11/-0)
```diff
@@ -862,6 +862,11 @@ uint64_t uniffi_slatedb_uniffi_fn_constructor_dbbuilder_new(RustBuffer path, uin
 uint64_t uniffi_slatedb_uniffi_fn_method_dbbuilder_build(uint64_t ptr
 );
 #endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_BLOCK_CACHE_POLICY
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_BLOCK_CACHE_POLICY
+void uniffi_slatedb_uniffi_fn_method_dbbuilder_with_block_cache_policy(uint64_t ptr, RustBuffer policy, RustCallStatus *out_status
+);
+#endif
 #ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_BLOCK_TRANSFORMER
 #define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_BLOCK_TRANSFORMER
 void uniffi_slatedb_uniffi_fn_method_dbbuilder_with_block_transformer(uint64_t ptr, uint64_t transformer, RustCallStatus *out_status
@@ -2344,6 +2349,12 @@ uint16_t uniffi_slatedb_uniffi_checksum_method_clonebuilder_with_wal_object_stor
 #define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_CHECKSUM_METHOD_DBBUILDER_BUILD
 uint16_t uniffi_slatedb_uniffi_checksum_method_dbbuilder_build(void
     
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_CHECKSUM_METHOD_DBBUILDER_WITH_BLOCK_CACHE_POLICY
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_CHECKSUM_METHOD_DBBUILDER_WITH_BLOCK_CACHE_POLICY
+uint16_t uniffi_slatedb_uniffi_checksum_method_dbbuilder_with_block_cache_policy(void
+    
 );
 #endif
 #ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_CHECKSUM_METHOD_DBBUILDER_WITH_BLOCK_TRANSFORMER
```

**File**: `bindings/uniffi/src/builder.rs` (modified, +8/-1)
```diff
@@ -15,7 +15,7 @@ use crate::metrics::adapt_metrics_recorder;
 use crate::object_store::ObjectStore;
 use crate::runtime;
 use crate::settings::Settings;
-use crate::types::{CloneSourceSpec, KeyRange};
+use crate::types::{BlockCachePolicy, CloneSourceSpec, KeyRange};
 use crate::MetricsRecorder;
 use parking_lot::Mutex;
 
@@ -81,6 +81,13 @@ impl DbBuilder {
             .map_err(Into::into)
     }
 
+    /// What the block cache keeps of the SSTs this database writes, on a
+    /// memtable flush and on a compaction's output.
+    pub fn with_block_cache_policy(&self, policy: BlockCachePolicy) -> Result<(), Error> {
+        self.update_builder(|builder| builder.with_block_cache_policy(policy.into_core()))
+            .map_err(Into::into)
+    }
+
     /// Transforms every SST block this database writes and reads, for
     /// encryption at rest. A `DbReaderBuilder` of the database must carry the
     /// same transform. The bindings run no standalone compactor or compaction
```

**File**: `bindings/uniffi/src/types.rs` (modified, +29/-0)
```diff
@@ -642,6 +642,35 @@ pub enum CacheTarget {
     Data { range: KeyRange },
 }
 
+/// What the block cache keeps of the SSTs this database writes: the targets a
+/// memtable flush caches and the targets a compaction's output caches. An
+/// empty list caches nothing on that path. The engine's default caches every
+/// data block, the index and the filters on flush, and the index and filters
+/// on compaction output.
+#[derive(Clone, Debug, PartialEq, Eq, uniffi::Record)]
+pub struct BlockCachePolicy {
+    pub flush_targets: Vec<CacheTarget>,
+    pub compaction_output_targets: Vec<CacheTarget>,
+}
+
+impl BlockCachePolicy {
+    pub(crate) fn into_core(self) -> slatedb::BlockCachePolicy {
+        let flush: Vec<_> = self
+            .flush_targets
+            .into_iter()
+            .map(CacheTarget::into_core)
+            .collect();
+        let compaction: Vec<_> = self
+            .compaction_output_targets
+            .into_iter()
+            .map(CacheTarget::into_core)
+            .collect();
+        slatedb::BlockCachePolicy::default()
+            .with_flush_targets(&flush)
+            .with_compaction_output_targets(&compaction)
+    }
+}
+
 impl CacheTarget {
     pub(crate) fn into_core(self) -> CoreCacheTarget {
         match self {
```

#### Recent Merged Pull Requests:
- **PR #2165** (2026-10-14): Upgrade rand to 0.10.3 and proptest to 1.12.0 (@criccomini)
- **PR #2163** (2026-10-14): Copy RFC images into website build (@criccomini)
- **PR #2154** (2026-10-12): Warn when GC boundary updates are unsupported (@criccomini)
- **PR #2153** (2026-10-12): Epoch checked Manifest Acquisition (simple) (@owen-d)
- **PR #2152** (closed): Policy based Manifest acquisition (@owen-d)
- **PR #2150** (2026-10-07): report manifest to status manager from manifest writer (@rodesai)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Fix/external compaction concurrency cap (#2110)

**RULE**:
When implementing operations in `slatedb/src/compactor.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in slatedb/slatedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `da6ac332`: Fix/external compaction concurrency cap (#2110). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `slatedb/src/compactor.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// the compactions; they become claimable in
    /// [`CompactorEventHandler::maybe_validate_submitted_compactions`].
    ///
    /// The capacity subtraction saturates because the running count can exceed
    /// the limit. An operator can lower `max_concurrent_compactions` and restart
    /// while jobs run: restart leaves `Running` entries alone, and
    /// `reclaim_stale_workers` only reclaims the ones whose worker stopped
    /// heartbeating. A scheduling tick must not panic on that state.
        let available_capacity = self
            .options
            .max_concurrent_compactions
            .saturating_sub(running_compaction_count);
                // Promotion is the coordinator's last chance to apply
                // `max_concurrent_compactions`: once an entry is `Scheduled`, any
                // worker can claim it without consulting the coordinator. A
                // `Scheduled` entry is therefore already spoken for and counts
                // against the limit alongside `Running`. Leave the entry
                // `Submitted` when the limit is full.
                let claimed_compaction_count = self
                    .state()
                  
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    /// the compactions; that is done in [`CompactorEventHandler::maybe_start_compactions`].
        let available_capacity = self.options.max_concurrent_compactions - running_compaction_count;
            .filter(|c| c.status() == CompactionStatus::Running)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `da6ac332` are properly handled with clean fallback behavior.
