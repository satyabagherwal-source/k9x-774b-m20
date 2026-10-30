> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/slatedb-slatedb-learnings.md`  
> **Source**: github ([https://github.com/slatedb/slatedb](https://github.com/slatedb/slatedb))  
> **Source Version**: `57677801`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T00:25:52.712Z  
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
> **Harvest Timestamp**: 2026-10-30T00:25:51.843Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `slatedb/slatedb`
- **Description**: A cloud native embedded storage engine built on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3600 stars

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
use crate::incremental_progress::IncrementalProgress;
use crate::manifest::{Manifest, ManifestCore};
use crate::subcompaction::{Subcompaction, SubcompactionStatus};
use slatedb_common::DbRand;
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

    /// Returns whether this job reuses an input run as its destination.
    pub(crate) fn reuses_input_run(&self) -> bool {
        self.destination()
            .is_some_and(|id| self.sources().contains(&SourceId::SortedRun(id)))
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
    /// and promoted it; the jo
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

    /// Returns the part of `range` that this view keeps when a projection narrows its
    /// sorted run, or `None` if the view keeps nothing.
    ///
    /// `next_view` is the next view in the same sorted run. It is `None` for the last
    /// view of a run and for L0 views, which can overlap. The result covers these cases:
    /// - No next view: the view's own effective range, cut to `range`.
    /// - Next view: the keys from this view's start up to the start of the next view,
    ///   cut to `range`.
    /// - Shared boundary key: if this view also contains the first key of the next
    ///   view, the result includes that key. Two adjacent SSTs can split the versions
    ///   of one key, for example `[a, m]` followed by `[m, z]`.
    /// - Gap before the next view: the result stays inside the visible range of this
    ///   view. An incremental commit can leave a view `[a, g)` before a view that
    ///   starts at `m`, and the result must not show `[g, m)` again.
    ///
    /// TODO: If every SST records `last_entry`, this function can return
    /// `self.effective_range.intersect(range)` and no longer needs `next_view`.
    pub(crate) fn compacted_intersection(
        &self,
        next_view: Option<&SsTableView>,
        range: &BytesRange,
    ) -> Option<BytesRange> {
        if let Some(next_view) = next_view {
            let next_key = next_view.compacted_effective_start_key();
            let end = if self.effective_range.contains(next_key) {
                Included(next_key.clone())
            } else {
                Excluded(next_key.clone())
            };
            let intersection =
                BytesRange::new(self.compacted_effective_start_bound(), end).intersect(range)?;
            // A new projection must preserve gaps from earlier projections.
            match &self.visible_range {
                Some(visible) => intersection.intersect(visible),
                None => Some(intersection),
            }
        } else {
            self.effective_range.intersect(range)
        }
    }

    /// Point-key form of [`Self::intersects_range`]: equivalent to
    /// `self.intersects_range(end_bound, &BytesRange::from_slice(key..=key))`
    /// without building or cloning any range.
    ///
    /// As there, `end_bound` replaces the view's own end, so a key in the gap
    /// between this view's last key and `end_bound` still intersects.
    pub(crate) fn intersects_point(&self, end_bound: Bound<&[u8]>, key: &[u8]) -> b
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

### Incident Patch 1: `57677801` (2026-10-29)
**Commit Message**: Remove open PR contributions (#2207)

**File**: `.agents/skills/simple-english/SKILL.md` (removed, +0/-96)
```diff
@@ -1,96 +0,0 @@
----
-name: simple-english
-description: |
-  Write or rewrite text in plain, layman-readable English in the spirit of
-  ASD-STE100 Simplified Technical English: short sentences, active voice,
-  simple tenses, one word one meaning, condition before command, every
-  technical term defined at first use, no AI slop. Default mode is Plain.
-  Strict mode applies full STE vocabulary compliance when the user names
-  STE, ASD-STE100, or compliance. Use for documentation, READMEs, runbooks,
-  procedures, error messages, release notes, incident reports, API guides,
-  and explanations for readers outside the field. Also use when the user
-  says "STE", "Simplified Technical English", "ASD-STE100", "plain English",
-  "layman's terms", "explain it simply", "no jargon", "de-slop", "make this
-  readable", "write for non-native readers", or asks for docs that translate
-  well. The same rules govern the reply: answer first, five sentences or
-  fewer, prose only.
-license: MIT
-compatibility: claude-code cursor codex gemini-cli opencode
-metadata:
-  version: "2.0.1"
-  standard: ASD-STE100 Issue 9 (2025-01-15)
----
-
-# Simple English
-
-Write plain English that a smart reader outside your field understands on one read. The rules come from ASD-STE100, the controlled language aerospace uses so a tired mechanic cannot misread an instruction. Two registers exist: the document you write or rewrite, and the reply you type in chat. Each has its own short rule set below. Nothing else in this file is optional.
-
-## The Document
-
-When asked to write or rewrite documentation, apply these rules to the prose:
-
-1. **Classify each passage.** Procedural text tells the reader what to do: imperative mood, 20 words per sentence, one instruction per sentence. Descriptive text explains: simple tenses, 25 words per sentence, one topic per paragraph, six sentences per paragraph at most.
-2. **Condition before command, with a comma.** "If the build fails, read the log."
-3. **Simple tenses, active voice.** No present perfect ("has completed" → "completed"). No "-ing" verb after a comma (", making it easy" → new sentence). Name the actor: "You run the migration."
-4. **Modals: can, will, must.** Never should, would, may, might, could. A required "should" becomes "must". An optional one is deleted.
-5. **Complete grammar.** No contractions, keep articles, keep "that". Short sentences, not telegraph style.
-6. **No semicolons and no em-dashes.** Write two sentences, or name the relation.
-7. **One word, one meaning, for the whole document.** Use `make sure that` for check, verify, confirm, validate, ensure. Use `configuration` for config, settings, options. Break noun chains over three words with a preposition ("the timeout value for the connection pool").
-8. **Define a concept term at its first use**, under ten words, one per sentence. Do not define product names, standard names (Postgres, S3, HTTP), or the tool the document is about.
-9. **State the fact, not its importance.** Delete words that carry no fact: simply, seamlessly, robust, powerful, comprehensive, leverage, crucial, "in order to", "it is worth noting". No "not just X, it is Y". No decorative triplets. No "in conclusion".
-10. **Format for the eye, not for decoration.** No bold lead-ins, no bold as emphasis, no emoji, no heading over two sentences. A vertical list is for three or more parallel items or steps: colon on the lead-in, uppercase start, one instruction per item.
-11. **Warnings: command or condition first, then the risk.** "Do not run this against production. The command deletes rows."
-12. **Never touch** code, identifiers, commands, flags, file paths, quoted errors, product names, or facts. When the source gives no number or cause, keep the general statement.
-
-Use American spelling. `references/word-swaps.md` maps the overused words to plain ones.
-
-**Before (real AI output):**
-
-> **Connection timeouts.** If sqlpipe hangs or fails with `dial tcp: i/o timeout`, check that the host running sqlpipe can reach the Postgres port (usually 5432) — this is often a security group or firewall rule blocking the connection. If you're connecting to a managed database (RDS, Cloud SQL, etc.), confirm the instance allows connections from sqlpipe's IP.
-
-**After (procedural, headed, numbered):**
-
-> ## Connection timeouts
->
-> sqlpipe stops with `dial tcp: i/o timeout` when it cannot connect to the Postgres port (5432 by default).
->
-> 1. Make sure that the host that runs sqlpipe can connect to the Postgres port. A firewall or security group usually blocks it.
-> 2. If the database is managed (RDS, Cloud SQL), make sure that the instance accepts connections from the IP of sqlpipe.
-
-## The Reply
-
-Every chat reply, in every mode, follows these rules. Read them last, apply them first:
-
-1. Answer in prose. No headers, no bullet lists, no bold, no tables. A code block is legal when the reader must copy it.
-2. Five sentences maximum. Every senten
```

**File**: `.agents/skills/simple-english/references/checklist.md` (removed, +0/-56)
```diff
@@ -1,56 +0,0 @@
-# Verification checklist
-
-Run this pass on every draft before you deliver it. The checks are ordered from mechanical to judgment.
-
-## Mechanical checks (searchable)
-
-Search the draft for each pattern. Every hit outside code blocks and quoted text is a violation.
-
-| Search for | Violation | Fix |
-|---|---|---|
-| `'ll`, `'re`, `'ve`, `n't`, `it's` | Contraction (Rule 4.2) | Expand it. |
-| `has been`, `have been`, `had been` | Present/past perfect (Rule 3.4) | Simple past or simple present. |
-| `has` / `have` + past participle | Present perfect (Rule 3.4) | Simple past. |
-| `should`, `would`, `may`, `might`, `could`, `shall` | Unapproved modal (Rule 3.2) | See the modal ladder in rule-catalog.md. |
-| `is being`, `are being`, `was being` | Progressive passive (Rules 3.4, 3.5) | Active, simple tense. |
-| `, making`, `, allowing`, `, enabling`, `, ensuring` | "-ing" clause as verb (Rule 3.5) | New sentence with a real subject. |
-| `;` | Semicolon (Rule 8.1) | Two sentences. |
-| `—`, `–`, or ` - ` / ` -- ` between two statements | Dash: implied logic junction (skill check, Section 8). Not a violation: a dash that identifies a list item (Rule 4.3), a CLI flag (`--force`), a range (`5 - 10`) | Name the relation ("because", "but", "for example", "that is"), or write two sentences. |
-| `e.g.`, `i.e.`, `etc.` | Latin abbreviation (GR-6) | "for example", "that is", name the items. |
-| `simply`, `easily`, `seamlessly`, `robust` | Filler (no fact) | Delete. |
-| `delve`, `pivotal`, `crucial`, `leverage`, `showcase`, `foster` | LLM-tell words (word-swaps.md) | Use the listed replacement, or delete. |
-| ` if `, ` when ` (mid-sentence) | Trailing condition (Rule 5.4) | Move the condition to the start of the sentence, add a comma. |
-| `however`, `therefore`, `since` (= because), `now` | Recurring errors (dictionary introduction) | but / thus, as a result / because / at this time (better, delete) |
-| `need to`, `have to` | Recurring errors | Imperative in procedures; `it is necessary to` in descriptive text |
-| `perform`, `insert`, `reach`, `avoid`, `repeat`, `acceptable` | Recurring errors | do / put / get, get to / prevent / do … again / permitted |
-| `the example below`, `the section above` | "below" and "above" as adverbs are not approved | Name the target, or write `…that follows` |
-| ` is complete`, ` are complete` | "complete" as an adjective is not approved | completed (adjective), or full / all |
-
-## Countable checks
-
-1. **Sentence length.** Count words in each sentence. Procedural limit: 20. Descriptive limit: 25. Notes: 25.
-   Backticked commands, numbers with units, and identifiers count as one word each (Rule 8.6).
-   In a vertical list, the lead-in colon ends a sentence and each item that follows counts as a new sentence with its own budget (Rule 8.4).
-2. **Paragraph size.** Maximum six sentences per paragraph (Rule 6.6).
-3. **Multi-word nouns.** Any noun chain over three words → break it with prepositions (Rule 2.1).
-4. **Instructions per sentence.** One, unless the actions are simultaneous (Rule 5.2).
-5. **List mechanics.** Colon on the lead-in. Each item starts with an uppercase letter. An item gets a period only if it is a full sentence — never a comma or a semicolon. The last item gets a period. No nested lists. Instructions and facts never in the same list (Rule 4.3).
-
-## Judgment checks
-
-6. **Classification.** Is each passage cleanly procedural or descriptive? Procedures in imperative, descriptions never in imperative.
-7. **Voice.** Any passive sentence: is the agent truly unknown, and is the passage descriptive? Otherwise make it active (Rule 3.6). For an unknown agent, prefer "you" (the reader) or "we" (your company) over the passive.
-8. **Condition placement.** Every "if/when" stands before its command, with a comma (Rule 5.4).
-9. **Synonym rotation.** One term per concept across the whole document (Rules 1.11, 9.4). Scan for check/verify/confirm, config/settings, run/execute.
-10. **Warnings.** Command or condition first, risk second (Rules 7.2, 7.3). If a passage risks both injury and damage, use WARNING (Rule 7.1).
-11. **Limits with actions.** A result or limit comes directly after its action in the work step — not in a note (Rules 5.2, 5.5).
-12. **Notes test.** Delete all notes, then read the procedure. The reader must still be able to do it correctly (Rule 5.5).
-13. **Completeness.** Articles present, "that" present after "make sure", no telegraph style (Rule 4.2).
-14. **Plain words.** Each technical term has a definition at its first use. Common words replaced jargon where a common word exists.
-15. **Strict mode only.** Run the two tables in `references/strict-vocabulary.md` against the draft.
-16. **Untouchables intact.** Code, identifiers, quoted errors, UI labels, and proper nouns are unchanged.
-
-## When reporting violations (check mode)
-
-For each violation give: the rule number, the offending text, and a compliant rewrite. Ci
```

**File**: `.agents/skills/simple-english/references/rule-catalog.md` (removed, +0/-165)
```diff
@@ -1,165 +0,0 @@
-# Rule catalog: ASD-STE100 Issue 9 for software text
-
-Read this file for CHECK mode, for Strict mode, or when a rule number is in question. The core skill in `SKILL.md` names the rules that move output the most. This file holds the whole catalog.
-
-53 rules in 9 sections, paraphrased from ASD-STE100 Issue 9 with software examples. Rules marked (S) are Strict mode only (see `references/strict-vocabulary.md`). The official wording is in the free standard at asd-ste100.org.
-
-### Section 1 — Words (Rules 1.1-1.14)
-
-| Rule | Instruction |
-|---|---|
-| 1.1-1.4, 1.6 (S) | Use only approved words, as their listed part of speech, meaning, and form. |
-| 1.5 | You can use domain words as technical nouns ("webhook", "commit", "endpoint"). |
-| 1.7 | Do not use technical nouns as verbs. |
-| 1.8 | Use the technical nouns of your project or industry. |
-| 1.9 | When you pick a technical noun, pick a short and clear one. |
-| 1.10 | No regional, slang, or jargon words as technical nouns. |
-| 1.11 | One item, one name. Do not call it "config" here and "settings" there. |
-| 1.12 | You can use domain verbs as technical verbs ("deploy", "compile", "merge"). The standard names computer verbs as legal: click, type, copy, paste, delete, save, install, download, update, and more. When a common verb does the same job, prefer it: "find" instead of "detect". |
-| 1.13 | Do not use technical verbs as nouns. |
-| 1.14 | Use American English spelling. |
-
-In Plain mode, rules 1.5, 1.8, and 1.12 make your domain vocabulary legal. The ones agents break are 1.7, 1.11, and 1.13.
-
-**Before:** You can webhook the event, then do a deploy.
-**After:** Send the event to the webhook. Then deploy the service.
-
-### Section 2 — Multi-word nouns (Rules 2.1-2.2)
-
-| Rule | Instruction |
-|---|---|
-| 2.1 | Write multi-word nouns of three words or fewer. |
-| 2.2 | When a technical noun needs more than three words, write it in full once, then give a short form or hyphenate the units. |
-
-Break long noun chains with prepositions (of, on, in, for):
-
-**Before:** the connection pool timeout configuration value
-**After:** the timeout value for the connection pool
-
-### Section 3 — Verbs (Rules 3.1-3.7)
-
-| Rule | Instruction |
-|---|---|
-| 3.1 (S) | Use only the verb forms that the dictionary gives. |
-| 3.2 | Use only: infinitive, imperative, simple present, simple past, simple future, past participle as adjective. |
-| 3.3 | Use the past participle only as an adjective ("the cached response"). |
-| 3.4 | No auxiliary verbs for complex constructions. No present perfect, no "is to be installed". |
-| 3.5 | Use an "-ing" form only as a technical noun or inside one ("logging", "the mounting bracket"), never as a verb. |
-| 3.6 | Active voice. In descriptive text, passive is legal only when the agent is unknown. To repair an agentless passive, use "you" (the reader) or "we" (your company): "Indexes are not used on this table" → "We do not use indexes on this table." |
-| 3.7 | Describe an action with a verb, not a noun ("compress the file", not "perform compression of the file"). |
-
-**Approved modals: can, will, must. Banned: should, would, may, might, could.**
-The modal ladder below routes each banned modal. This matters double for agent instructions, because models read "should" as optional.
-
-### Section 4 — Sentences (Rules 4.1-4.5)
-
-| Rule | Instruction |
-|---|---|
-| 4.1 | Write short and clear sentences. |
-| 4.2 | Do not omit words or use contractions to shorten sentences. Keep articles, keep "that". |
-| 4.3 | Use a vertical list for complex text: colon on the lead-in, uppercase start, a period only on full-sentence items, no mixed instructions and facts, no nesting. |
-| 4.4 | Use connecting words between sentences on related topics ("Then", "As a result"). |
-| 4.5 | Put an article (the, a, an) or a demonstrative adjective (this, these) before nouns where applicable. Exception: no article before a noun when an identifier follows it: "Restart pod web-7f9b2". |
-
-Rule 4.2 is the anti-terseness rule. Plain English is short sentences with complete grammar, not telegraph style:
-
-**Wrong shortening:** Ensure file exists before running.
-**Plain:** Make sure that the file exists before you run the command.
-
-### Section 5 — Procedural writing (Rules 5.1-5.5)
-
-| Rule | Instruction |
-|---|---|
-| 5.1 | Maximum 20 words per sentence. Warnings and cautions included. |
-| 5.2 | One instruction per sentence, unless two actions happen at the same time. A step can add one sentence for an immediate result or limit. |
-| 5.3 | Write instructions in the imperative: "Run the migration." |
-| 5.4 | Put a required condition before the command, divided by a comma: "If the build fails, read the log." |
-| 5.5 | Notes give information, never instructions or limits. A limit belongs with its action. Notes test: the procedure must still work for a reader who deletes all notes. |
-
-**Before:** You'll want to grab the A
```

**File**: `.agents/skills/simple-english/references/strict-vocabulary.md` (removed, +0/-77)
```diff
@@ -1,77 +0,0 @@
-# Strict mode: the dictionary discipline
-
-Read this file when the user names STE, ASD-STE100, or compliance. Strict mode adds the dictionary rules to the document. It does not change the reply to the user, which stays in Plain mode.
-
-The official dictionary (about 900 approved words and 1,200 rejected words with their alternatives) is copyrighted by ASD and is not reproduced here. This file gives the rules that depend on it, the rulings that software writers meet most, and the words the standard names as recurring errors. Tell the user, one time per conversation and in one sentence, that this index is lossy and that full compliance needs the official dictionary (free at asd-ste100.org).
-
-## Rules that exist only with the dictionary
-
-| Rule | Instruction |
-|---|---|
-| 1.1 | Use only approved words, technical nouns, or technical verbs. |
-| 1.2 | Use an approved word only as its listed part of speech. |
-| 1.3 | Use an approved word only with its approved meaning. |
-| 1.4 | Use only the approved forms of verbs and adjectives. |
-| 1.6 | Use an unapproved word only when it is a technical noun or part of one. |
-| 3.1 | Use only the verb forms that the dictionary gives. |
-| 9.2 | Use each approved word correctly: approved meaning, approved part of speech. |
-| GR-5 | Avoid false friends: words that look like a word in the reader's language but mean something else. |
-| GR-8 | Use the possessive apostrophe only when you are sure that it is correct. If unsure, write "the file of the user". |
-
-Issue 9 adds a quick-reference list of approved verbs in the dictionary introduction. Check your verbs against it.
-
-## Part-of-speech rulings
-
-| Word | Ruling |
-|---|---|
-| test, check, work | Noun only. "Do a test", not "test the pump". "Check that X" becomes "make sure that X". |
-| oil | Technical noun only. For the verb, the dictionary gives "lubricate": "Lubricate the linkage with oil." |
-| help | Verb only. For the noun, the dictionary gives "aid": "with the aid of". |
-| fall (noun) | Rejected. Use "decrease" for a reduction in value. Use "fall" (verb) only for movement downward by gravity: "Make sure that the tools do not fall into the engine." |
-| follow | "To come after" only, never "obey". Write "obey the instructions". |
-| above, below | Physical positions only. For limits write "more than", "less than". |
-
-## Dictionary rulings on common software verbs
-
-The standard has already chosen. Use the approved word.
-
-| You wrote | Dictionary status | Use instead |
-|---|---|---|
-| check (verb), verify, confirm, ensure | All rejected as verbs | Route by intent: `make sure that` (a state), `examine` (look for faults: "examine the log"), `measure` (get a value), or the noun: "do a check of". |
-| validate | Not in the dictionary | Legal as a technical verb (Rule 1.12), or replace with `make sure that`. |
-| delete, drop (verb), destroy | All rejected as dictionary verbs | `erase` (data), `remove` (physical). In computer contexts `delete` is also a legal technical verb (Rule 1.12). Do not use `drop` or `destroy`. |
-| remove | Approved verb | Keep it. |
-| run, execute | Both rejected | `operate` for run, `do` for execute. |
-| invoke, launch | Not in the dictionary | Legal as technical verbs (Rule 1.12). |
-| display (verb), render, present (verb) | All rejected | `show` covers most software cases. Official alternatives: display → `show`, render → `make`, present → `give` or `show`. |
-| issue | Not in the dictionary | Use as a technical noun, or replace with `problem` (approved). |
-| failure | Rejected in general use; approved as a technical noun for performance loss | Use only for a performance error: "a failure of the pump". |
-| error, problem | Approved nouns | Keep them. |
-
-## Recurring errors the standard names
-
-The dictionary introduction lists the words that writers get wrong most often. This is the software-relevant set, as rulings only.
-
-| You wrote | STE writes |
-|---|---|
-| however | but |
-| therefore | thus, as a result |
-| since (= because) | because |
-| any | Delete it, or restructure: "if you have any questions" → "if you have questions" |
-| now | at this time. Better, delete it: "now start the service" → "start the service" |
-| need to, have to | Imperative in procedures ("install"); "it is necessary to" in descriptive text |
-| perform | do |
-| insert | put (but SQL `INSERT` stays: it is quoted text) |
-| reach | get, get to |
-| avoid | prevent |
-| repeat | do … again |
-| acceptable | permitted. Better, give the limit: "a latency of less than 200 ms" |
-| complete (adjective) | completed |
-| the example below, the section above | Name the target, or put the reference after it: "the example that follows" |
-
-## Strict self-check
-
-Add these two steps to the self-check in SKILL.md:
-
-1. Search the draft for every verb in the two tables above. Replace each hit with the approved word.
-2. Search for the phrasal verbs you built ("set up", "
```

**File**: `.agents/skills/simple-english/references/use-cases.md` (removed, +0/-64)
```diff
@@ -1,64 +0,0 @@
-# Use cases beyond documentation
-
-STE was built for aircraft maintenance manuals. The same properties — one meaning per word, short sentences, condition-first commands — transfer to any text where misreading has a cost. STE is now used far outside aerospace and defense.
-
-Each case that follows names the mode and the adaptations.
-
-## Error messages and CLI output
-
-Mode: procedural. This is the highest-value target: an error message is a 2 a.m. instruction to a stressed reader.
-
-Pattern: state what happened (past simple), state the cause if known, give the command or condition to fix it.
-
-> **Before:** Oops! Something went wrong while attempting to establish a connection. Please ensure your credentials are properly configured and try again.
-> **After:** Connection to the database failed. The password for user `app` was not correct. Set `DB_PASSWORD` and connect again.
-
-## Runbooks and standard operating procedures
-
-Mode: Plain, procedural, with the 20-word limit enforced hard. This is what STE was made for — an on-call runbook is a maintenance manual.
-
-- Every step imperative, one instruction per step, conditions first.
-- Warnings before the step, command first, risk second.
-- 20-word limit enforced hard: an operator under pager stress reads each sentence once.
-
-## Incident reports and postmortems
-
-Mode: descriptive. Simple past only — a timeline in present perfect ("we have identified...") hides when things happened.
-
-> **Before:** We have identified an issue that may have impacted some users' ability to access the service.
-> **After:** Between 14:02 and 14:31 UTC, 12% of requests failed. A deploy at 14:00 removed the cache warmup step.
-
-STE bans hedges ("may have impacted") — the report states what is known and says "unknown" for the rest. This reads more honest because it is.
-
-## Commit messages and PR descriptions
-
-Mode: descriptive body, imperative subject. Convention already matches STE: imperative subject line, plain past facts in the body. Apply the substitution table and the 25-word limit to the body. Delete "this PR aims to".
-
-## API changelogs and release notes
-
-Mode: descriptive. One entry, one change, one sentence where possible. "Breaking:" entries follow the warning pattern — command first: "Update your calls to `v2/users`. The `name` field split into `first_name` and `last_name`."
-
-## Instructions for AI agents (prompts, AGENTS.md, skills)
-
-Mode: procedural. A system prompt is a procedure executed by a reader with no ability to ask questions — the exact reader STE was designed for.
-
-- One instruction per sentence keeps rules independently quotable and hard to half-follow.
-- One word, one meaning prevents the model from treating "check", "verify", and "validate" as three different operations.
-- Condition-first ("If the build fails, stop") beats trailing conditions, which models drop.
-- No "should" — a model reads "should" as optional. Write "must" or delete the rule.
-
-## Support macros and status-page updates
-
-Mode: descriptive, 25-word limit. Non-native readers are the majority of many user bases. No "we sincerely apologize for any inconvenience this may have caused" — "The API was down for 18 minutes. Uploads made during this time were saved and will process today."
-
-## Translation and localization prep
-
-Mode: strict. STE's original purpose was making English readable for non-native maintenance crews, and it doubles as pre-editing for machine translation. One meaning per word plus complete grammar (articles, "that") removes most translation ambiguity. If your docs get localized, STE cuts the error rate and the cost.
-
-## UI copy and empty states
-
-Mode: procedural, hard length limits. Buttons and labels are technical names (exempt). Body copy follows the rules: "No projects yet. Create a project to start." Nothing else survives at this length anyway.
-
-## Where STE does not fit
-
-Marketing pages, launch posts, blog voice, brand writing. STE deletes persuasion on purpose. Write those in your own voice — then use STE for the docs the landing page links to.
```

**File**: `.agents/skills/simple-english/references/word-swaps.md` (removed, +0/-58)
```diff
@@ -1,58 +0,0 @@
-# Slop-to-simple substitutions
-
-This table is ours, not the ASD dictionary. It maps the words AI-generated docs overuse to plain replacements. If the word carries no fact, delete it instead of replacing it.
-
-| Slop | Write instead |
-|---|---|
-| leverage, utilize | use |
-| in order to | to |
-| prior to | before |
-| ensure | make sure that |
-| it is worth noting that | (delete) |
-| it's important to | (delete — state the fact) |
-| simply, just, easily, seamless, seamlessly, effortlessly | (delete) |
-| robust, powerful, comprehensive, performant | (delete, or give the measurable property) |
-| functionality | function, feature |
-| enables you to, allows you to | you can |
-| is designed to, aims to | (delete — say what it does) |
-| facilitate | help, make possible |
-| dive into, delve into | read, examine |
-| when it comes to | for |
-| in the event that | if |
-| due to the fact that | because |
-| as needed, as necessary | (state the condition) |
-| and/or | Pick one, or write "X, or Y, or both" |
-| e.g. / i.e. / etc. | for example / that is / (name the items) |
-| gracefully handles | (say what it does: "retries three times, then stops") |
-| out of the box | by default |
-| under the hood | internally |
-| blazingly fast | fast (give the number) / (delete) |
-| streamline | make simpler, make faster |
-| plethora, myriad | many |
-| addresses the issue, tackles | corrects the fault, removes the error |
-| pivotal, crucial, crucially, paramount | important |
-| tapestry, testament, synergy | (delete) |
-| interplay | interaction (or delete) |
-| intricate | complex |
-| vibrant, nuanced, multifaceted | (delete, or name the parts) |
-| realm, landscape (metaphorical) | area |
-| groundbreaking, cutting-edge, state-of-the-art, innovative, unprecedented | new (or delete) |
-| transformative, game-changer | (delete — say what changes) |
-| revolutionize | change |
-| showcase, underscore, emphasize | show |
-| foster, empower, bolster | help, support, let |
-| harness | use |
-| enhance | improve |
-| elevate | increase |
-| furthermore, moreover | also |
-| in conclusion, in summary, at the end of the day | (delete) |
-| embark, endeavor | start, try |
-| meticulous, meticulously | careful, carefully |
-| holistic | full |
-| paradigm | model |
-| navigate (metaphorical) | go to |
-| boasts | has |
-| nestled, in the heart of | (delete — give the location or the fact) |
-| bustling | busy |
-| that being said, notwithstanding | but |
-| I hope this helps, let's dive in | (delete) |
```

**File**: `.github/pull_request_template.md` (modified, +1/-15)
```diff
@@ -8,9 +8,7 @@ What is being changed and why?
 
 ## AI Assistance
 
-If you used AI for any part of this pull request, add one row for each model and effort level.
-Include code, tests, documentation, and pull request text.
-If you did not use AI, enter `N/A` in both columns.
+If you used AI for any part of this pull request, add one row for each model and effort level. Include code, tests, documentation, and pull request text. If you did not use AI, enter `N/A` in both columns.
 
 | Model | Effort |
 | --- | --- |
@@ -19,15 +17,3 @@ If you did not use AI, enter `N/A` in both columns.
 ## Notes for Reviewers
 
 Any hints on how to best review this PR? Anything you’d like reviewers to focus on? Any follow-ups planned?
-
-## Checklist
-
-- [ ] Small, scoped PR (< 500 total lines excluding tests); or opened as Draft with a plan on how to break it into smaller pieces
-- [ ] Linked related issue(s) or added context in the description
-- [ ] Self-reviewed the diff; added comments for tricky parts
-- [ ] Tests added/updated and passing locally
-- [ ] Ran `cargo fmt`, `cargo clippy --all-targets --all-features`, and `cargo nextest run --all-features`
-- [ ] Called out any breaking changes and provided migration notes
-- [ ] Considered performance impact; added notes or benchmarks if relevant
-
-Thank you for the review! 🙏
```

**File**: `AGENTS.md` (modified, +18/-13)
```diff
@@ -1,18 +1,23 @@
 # Writing instructions
 
-Use the `simple-english` skill at `.agents/skills/simple-english/SKILL.md` for all English prose that you write.
-
-This rule includes chat replies, documentation, new code comments, commit messages, and GitHub prose.
-GitHub prose includes issue text, pull request titles and summaries, review comments, and discussion replies.
-When you write a pull request description, follow `.github/pull_request_template.md`.
-
-Read the complete skill file before you write or rewrite prose.
-Apply its Plain mode unless the user requests STE, ASD-STE100, or compliance.
-If the user requests Strict mode, read `.agents/skills/simple-english/references/strict-vocabulary.md` before you write.
-If the user requests a text review, read `.agents/skills/simple-english/references/rule-catalog.md` before you report violations.
-Follow the skill rules in every chat reply.
-Do not edit an existing comment only to apply the skill.
-Apply the skill to each new comment that you add.
+All writing must use line-wrapped (100 character) ASD-STE100 Simplified Technical English: Github issues and comments, PR titles and descriptions, RFCs, review comments, commit messages, docs and code comments. Active voice, sentences under 30 words, two ideas per sentence at most, no filler.
+
+When you write a pull request description, you always follow `.github/pull_request_template.md`.
+
+## Brevity
+
+You follow the spirit of Churchill's brevity memorandum when writing prose. The memorandum is reproduced below.
+
+To do our work, we all have to read a mass of papers. Nearly all of them are far too long. This wastes time, while energy has to be spent in looking for the essential points.
+
+I ask my colleagues and their staffs to see to it that their Reports are shorter.
+
+1. The aim should be Reports which set out the main points in a series of short, crisp paragraphs.
+2. If a Report relies on detailed analysis of some complicated factors, or on statistics, these should be set out in an Appendix.
+3. Often the occasion is best met by submitting not a full-dress Report, but an Aide-memoire consisting of headings only, which can be expanded orally if needed.
+4. Let us have an end of such phrases as these: “It is also of importance to bear in mind the following considerations…”, or “Consideration should be given to the possibility of carrying into effect…”. Most of there woolly phrases are mere padding, which can be left out altogether , or replaced by a single word. Let us not shrink from using the short expressive phrase, even if it is conversational.
+
+Reports drawn up on the lines I propose may at first seem rough as compared with the flat surface of officialese jargon. But the saving in time will be great, while the discipline of setting out the real points concisely will prove an aid to clearer thinking.
 
 # API design
 
```

---

### Incident Patch 2: `86953bef` (2026-10-29)
**Commit Message**: Trim per-SST CPU on the point-lookup path (#2203)

**File**: `slatedb/src/bytes_range.rs` (modified, +0/-1)
```diff
@@ -281,7 +281,6 @@ impl BytesRange {
         !matches!(ByteRangeBounds::start_bound(self), Excluded(_))
     }
 
-    #[cfg(test)]
     pub(crate) fn non_empty(&self) -> bool {
         self.inner.non_empty()
     }
```

**File**: `slatedb/src/db_state.rs` (modified, +124/-18)
```diff
@@ -257,6 +257,28 @@ impl SsTableView {
         }
     }
 
+    /// Point-key form of [`Self::intersects_range`]: equivalent to
+    /// `self.intersects_range(end_bound, &BytesRange::from_slice(key..=key))`
+    /// without building or cloning any range.
+    ///
+    /// As there, `end_bound` replaces the view's own end, so a key in the gap
+    /// between this view's last key and `end_bound` still intersects.
+    pub(crate) fn intersects_point(&self, end_bound: Bound<&[u8]>, key: &[u8]) -> bool {
+        let after_start = match self.effective_range.start_bound() {
+            Included(start) => key >= start.as_ref(),
+            Excluded(start) => key > start.as_ref(),
+            Unbounded => true,
+        };
+        let before_end = match end_bound {
+            Included(end) => key <= end,
+            Excluded(end) => key < end,
+            Unbounded => true,
+        };
+        // An SST without a first entry has an empty effective range, which
+        // intersects nothing even though its start bound may admit `key`.
+        after_start && before_end && self.effective_range.non_empty()
+    }
+
     pub(crate) fn intersects_range(&self, end_bound: Bound<Bytes>, range: &BytesRange) -> bool {
         let sst_range =
             BytesRange::new(Unbounded, end_bound.clone()).intersect(&self.effective_range);
@@ -667,23 +689,27 @@ impl SortedRun {
     ///
     /// The bound is normally the next view's start key, but becomes inclusive
     /// when adjacent views overlap on that boundary key.
-    fn table_end_bound(&self, idx: usize) -> Bound<Bytes> {
+    fn table_end_bound(&self, idx: usize) -> Bound<&Bytes> {
         let current_sst = &self.sst_views[idx];
         if idx + 1 < self.sst_views.len() {
-            let next_sst = &self.sst_views[idx + 1];
-            if current_sst
-                .compacted_effective_range()
-                .contains(next_sst.compacted_effective_start_key())
-            {
-                Included(next_sst.compacted_effective_start_key().clone())
+            let next_start = self.sst_views[idx + 1].compacted_effective_start_key();
+            if current_sst.compacted_effective_range().contains(next_start) {
+                Included(next_start)
             } else {
-                Excluded(next_sst.compacted_effective_start_key().clone())
+                Excluded(next_start)
             }
         } else {
             Unbounded
         }
     }
 
+    /// Whether the view at `idx` can hold `key`, bounded by the next view's
+    /// start as in [`Self::table_end_bound`].
+    fn point_intersects_table(&self, idx: usize, key: &[u8]) -> bool {
+        let end_bound = self.table_end_bound(idx).map(Bytes::as_ref);
+        self.sst_views[idx].intersects_point(end_bound, key)
+    }
+
     /// Returns the contiguous range of SST view indices that can contribute to a
     /// point read for `key`.
     ///
@@ -693,16 +719,12 @@ impl SortedRun {
         let Some(max_idx) = self.find_last_sst_with_range_covering_key(key) else {
             return 0..0;
         };
-        let point_range = BytesRange::from_slice(key..=key);
-        if !self.sst_views[max_idx].intersects_range(self.table_end_bound(max_idx), &point_range) {
+        if !self.point_intersects_table(max_idx, key) {
             return 0..0;
         }
 
         let mut min_idx = max_idx;
-        while min_idx > 0
-            && self.sst_views[min_idx - 1]
-                .intersects_range(self.table_end_bound(min_idx - 1), &point_range)
-        {
+        while min_idx > 0 && self.point_intersects_table(min_idx - 1, key) {
             min_idx -= 1;
         }
 
@@ -736,7 +758,7 @@ impl SortedRun {
             Unbounded => views.len() - 1,
         };
 
-        if !views[max_idx].intersects_range(self.table_end_bound(max_idx), range) {
+        if !views[max_idx].intersects_range(self.table_end_bound(max_idx).cloned(), range) {
             return 0..0;
         }
 
@@ -751,13 +773,16 @@ impl SortedRun {
         };
 
         let mut min_idx = match start_candidate {
-            Some(idx) if views[idx].intersects_range(self.table_end_bound(idx), range) => idx,
+            Some(idx) if views[idx].intersects_range(self.table_end_bound(idx).cloned(), range) => {
+                idx
+            }
             Some(idx) => idx + 1,
             None => 0,
         };
 
         while min_idx > 0
-            && views[min_idx - 1].intersects_range(self.table_end_bound(min_idx - 1), range)
+            && views[min_idx - 1]
+                .intersects_range(self.table_end_bound(min_idx - 1).cloned(), range)
         {
             min_idx -= 1;
         }
@@ -981,7 +1006,7 @@ mod tests {
     use slatedb_common::DbRand;
     use std::collections::BTreeSet;
     use std::collections::VecDeque;
-    use std::ops::Bound::{Excluded, Included, Unbounded};
+    use std::ops::Bound::{self, Excluded, Included, Unbounded};
     use std::ops::RangeBounds;
     use std::sync::Arc;
 
@
```

**File**: `slatedb/src/filter.rs` (modified, +10/-13)
```diff
@@ -127,12 +127,8 @@ impl BloomFilter {
         if self.buffer.is_empty() {
             return false;
         }
-        for p in probes_for_key(hash, self.num_probes, self.filter_bits()) {
-            if !check_bit(p as usize, &self.buffer) {
-                return false;
-            }
-        }
-        true
+        probes_for_key(hash, self.num_probes, self.filter_bits())
+            .all(|p| check_bit(p as usize, &self.buffer))
     }
 }
 
@@ -207,21 +203,22 @@ fn filter_hash(key: &[u8]) -> u64 {
     hasher.hash(key)
 }
 
-fn probes_for_key(key_hash: u64, num_probes: u16, filter_bits: u32) -> Vec<u32> {
+fn probes_for_key(key_hash: u64, num_probes: u16, filter_bits: u32) -> impl Iterator<Item = u32> {
     // implements enhanced double hashing from:
     // https://www.khoury.northeastern.edu/~pete/pub/bloom-filters-verification.pdf
     // as suggested by the author P. Dillinger for RocksDB's legacy filters here:
     // https://github.com/facebook/rocksdb/issues/4120
-    let mut probes = vec![0u32; num_probes as usize];
+    //
+    // Lazy, so a lookup allocates nothing and stops at the first unset bit.
     let filter_bits = filter_bits as u64;
     let mut h = ((key_hash << 32) >> 32) % filter_bits; // lower 32 bits of hash
     let mut delta = (key_hash >> 32) % filter_bits; // higher 32 bits of hash
-    for i in 0..num_probes {
+    (0..num_probes).map(move |i| {
         delta = (delta + i as u64) % filter_bits;
-        probes[i as usize] = h as u32;
+        let probe = h as u32;
         h = (h + delta) % filter_bits;
-    }
-    probes
+        probe
+    })
 }
 
 fn check_bit(bit: usize, buf: &[u8]) -> bool {
@@ -319,7 +316,7 @@ mod tests {
     fn test_compute_probes() {
         // h1 = 0xDEADBEEF, h2 = 0xDF77EF56
         let hash = 0xDF77EF56DEADBEEFu64;
-        let probes = probes_for_key(hash, 7, 1000000);
+        let probes: Vec<u32> = probes_for_key(hash, 7, 1000000).collect();
         assert_eq!(
             probes,
             vec![
```

**File**: `slatedb/src/partitioned_keyspace.rs` (modified, +53/-0)
```diff
@@ -88,6 +88,32 @@ pub(crate) fn partitions_covering_range<T: RangePartitionedKeySpace>(
     keyspace: &T,
     start: Bound<&[u8]>,
     end: Bound<&[u8]>,
+) -> Range<usize> {
+    match (start, end) {
+        (Bound::Included(s), Bound::Included(e)) if s == e => partitions_covering_key(keyspace, s),
+        _ => partitions_covering_bounds(keyspace, start, end),
+    }
+}
+
+/// [`partitions_covering_range`] for the point range `[key, key]`, with one binary search
+/// instead of two.
+///
+/// The partitions whose first key equals `key` sit directly before the partition point, so
+/// stepping back over them (normally none) finds where the general path's start search lands.
+fn partitions_covering_key<T: RangePartitionedKeySpace>(keyspace: &T, key: &[u8]) -> Range<usize> {
+    let end = partition_point(keyspace, |first_key| first_key <= key);
+    let mut first_equal = end;
+    while first_equal > 0 && keyspace.partition_first_key(first_equal - 1) == key {
+        first_equal -= 1;
+    }
+    // The partition before the first one starting at `key` may still end with `key`.
+    first_equal.saturating_sub(1)..end
+}
+
+fn partitions_covering_bounds<T: RangePartitionedKeySpace>(
+    keyspace: &T,
+    start: Bound<&[u8]>,
+    end: Bound<&[u8]>,
 ) -> Range<usize> {
     let start_idx = match start {
         Bound::Included(k) | Bound::Excluded(k) => {
@@ -113,9 +139,36 @@ pub(crate) fn partitions_covering_range<T: RangePartitionedKeySpace>(
 mod tests {
     use crate::partitioned_keyspace::{
         first_partition_including_key, last_partition_including_key, partition_point,
+        partitions_covering_bounds, partitions_covering_key, partitions_covering_range,
         RangePartitionedKeySpace,
     };
+    use proptest::collection::vec;
+    use proptest::{prop_assert_eq, proptest};
     use rstest::rstest;
+    use std::ops::Bound::Included;
+
+    #[test]
+    fn test_partitions_covering_key_matches_bounds() {
+        // A two-letter alphabet and short keys make duplicate first keys, and
+        // probes equal to a first key, common. An SST index always has a
+        // block, and the general path indexes partition 0, so keyspaces are
+        // non-empty.
+        let key = || vec(0u8..2, 0..=3);
+        proptest!(|(mut first_keys in vec(key(), 1..=8), probe in key())| {
+            first_keys.sort();
+            let keyspace = TestKeyspace {
+                partitions: first_keys.iter().map(Vec::as_slice).collect(),
+            };
+            let probe = probe.as_slice();
+            let expected =
+                partitions_covering_bounds(&keyspace, Included(probe), Included(probe));
+            prop_assert_eq!(partitions_covering_key(&keyspace, probe), expected.clone());
+            prop_assert_eq!(
+                partitions_covering_range(&keyspace, Included(probe), Included(probe)),
+                expected
+            );
+        });
+    }
 
     #[test]
     fn test_partition_point() {
```

#### Recent Merged Pull Requests:
- **PR #2207** (2026-10-29): Remove open PR contributions (@criccomini)
- **PR #2203** (2026-10-29): Trim per-SST CPU on the point-lookup path (@zach-schoenberger)
- **PR #2201** (2026-10-27): Regenerate Go bindings for status subscriptions (@criccomini)
- **PR #2199** (2026-10-27): Defer SST path construction to cache-miss loaders (@zach-schoenberger)
- **PR #2198** (2026-10-27): Expose bounded status subscriptions through UniFFI (@hden)
- **PR #2194** (2026-10-27): fix(compactor): take the L0 watermark from the newest absorbed L0 (@sukanya1426)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
