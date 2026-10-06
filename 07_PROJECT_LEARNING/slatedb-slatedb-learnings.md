# Forensic Learning Record (Deep Inspection): slatedb/slatedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/slatedb-slatedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/slatedb/slatedb](https://github.com/slatedb/slatedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:24:03.999Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `slatedb/slatedb`
- **Description**: A cloud native embedded storage engine built on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3463 stars

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

use rand::Rng;
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
        5..=6 => {
     
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
    ///
    /// ## Returns
    /// - A new writer seeded with dirty manifest/compactions and finished compactions trimmed.
    pub(crate) async fn new(
        manifest_store: Arc<ManifestStore>,
        compactions_store: Arc<CompactionsStore>,
        system_clock: Arc<dyn SystemClock>,
        options: &CompactorOptions,
        rand: Arc<DbRand>,
    ) -> Result<Self, SlateDBError> {
        let stored_manifest =
            StoredManifest::load(manifest_store.clone(), system_clock.clone()).await?;
        let (manifest, mut compactions) = Self::fence(
            stored_manifest,
            compactions_store,
            system_clock.clone(),
            options,
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
    ) -> Result<(FenceableManifest, FenceableCompactions), SlateDBError> {
        let fenceable_manifest = FenceableManifest::init_compactor(
            stored_manifest,
            options.manifest_update_timeout,
            system_clock.clone(),
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
        Ok(())
    }

    /// Persists the updated manifest after a compaction finishes.
    ///
    /// A checkpoint is written first to prevent GC from deleting SSTs that are about
    /// to be 
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
use rand::Rng;
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
        const FULL_VISIBLE_FRA
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
use crate::reader::ReadTrace;
use crate::tablestore::TableStore;
use bytes::{Buf, BufMut, Bytes};
use futures::FutureExt;
use log::{error, warn};
use rand::{Rng, RngCore};
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
    let dispatch = tracing::dispatcher::get_default(Clone::clone);

    if dispatch.is::<NoSubscriber>() {
        tokio::spawn(future)
    } else {
        tokio::spawn(future.with_subscriber(dispatch))
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

    // if we didn't find a mismatch yet then the prev block's key must be shorter,
    // so just use the common prefix plus the next byte in this block's key
    this_block_first_key.slice(..prev_block_last_key.len() + 1)
}

/// Trait for generating UUIDs and ULIDs from a random number generator.
pub(crate) trait IdG
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

### Core Architecture Module: `bindings/go/uniffi/slatedb.h`
```


// This file was autogenerated by some hot garbage in the `uniffi` crate.
// Trust me, you don't want to mess with it!



#include <stdbool.h>
#include <stdint.h>

// The following structs are used to implement the lowest level
// of the FFI, and thus useful to multiple uniffied crates.
// We ensure they are declared exactly once, with a header guard, UNIFFI_SHARED_H.
#ifdef UNIFFI_SHARED_H
	// We also try to prevent mixing versions of shared uniffi header structs.
	// If you add anything to the #else block, you must increment the version suffix in UNIFFI_SHARED_HEADER_V6
	#ifndef UNIFFI_SHARED_HEADER_V6
		#error Combining helper code from multiple versions of uniffi is not supported
	#endif // ndef UNIFFI_SHARED_HEADER_V6
#else
#define UNIFFI_SHARED_H
#define UNIFFI_SHARED_HEADER_V6
// ⚠️ Attention: If you change this #else block (ending in `#endif // def UNIFFI_SHARED_H`) you *must* ⚠️
// ⚠️ increment the version suffix in all instances of UNIFFI_SHARED_HEADER_V6 in this file.           ⚠️

typedef struct RustBuffer {
	uint64_t capacity;
	uint64_t len;
	uint8_t *data;
} RustBuffer;

typedef struct ForeignBytes {
	int32_t len;
	const uint8_t *data;
} ForeignBytes;

// Error definitions
typedef struct RustCallStatus {
	int8_t code;
	RustBuffer errorBuf;
} RustCallStatus;

#endif // UNIFFI_SHARED_H


#ifndef UNIFFI_FFIDEF_RUST_FUTURE_CONTINUATION_CALLBACK
#define UNIFFI_FFIDEF_RUST_FUTURE_CONTINUATION_CALLBACK
typedef void (*UniffiRustFutureContinuationCallback)(uint64_t data, int8_t poll_result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiRustFutureContinuationCallback(
				UniffiRustFutureContinuationCallback cb, uint64_t data, int8_t poll_result)
{
	return cb(data, poll_result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_DROPPED_CALLBACK
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_DROPPED_CALLBACK
typedef void (*UniffiForeignFutureDroppedCallback)(uint64_t handle);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureDroppedCallback(
				UniffiForeignFutureDroppedCallback cb, uint64_t handle)
{
	return cb(handle);
}


#endif
#ifndef UNIFFI_FFIDEF_CALLBACK_INTERFACE_FREE
#define UNIFFI_FFIDEF_CALLBACK_INTERFACE_FREE
typedef void (*UniffiCallbackInterfaceFree)(uint64_t handle);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiCallbackInterfaceFree(
				UniffiCallbackInterfaceFree cb, uint64_t handle)
{
	return cb(handle);
}


#endif
#ifndef UNIFFI_FFIDEF_CALLBACK_INTERFACE_CLONE
#define UNIFFI_FFIDEF_CALLBACK_INTERFACE_CLONE
typedef uint64_t (*UniffiCallbackInterfaceClone)(uint64_t handle);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static uint64_t call_UniffiCallbackInterfaceClone(
				UniffiCallbackInterfaceClone cb, uint64_t handle)
{
	return cb(handle);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_DROPPED_CALLBACK_STRUCT
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_DROPPED_CALLBACK_STRUCT
typedef struct UniffiForeignFutureDroppedCallbackStruct {
    uint64_t handle;
    UniffiForeignFutureDroppedCallback free;
} UniffiForeignFutureDroppedCallbackStruct;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U8
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U8
typedef struct UniffiForeignFutureResultU8 {
    uint8_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultU8;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U8
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U8
typedef void (*UniffiForeignFutureCompleteU8)(uint64_t callback_data, UniffiForeignFutureResultU8 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteU8(
				UniffiForeignFutureCompleteU8 cb, uint64_t callback_data, UniffiForeignFutureResultU8 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I8
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I8
typedef struct UniffiForeignFutureResultI8 {
    int8_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultI8;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I8
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I8
typedef void (*UniffiForeignFutureCompleteI8)(uint64_t callback_data, UniffiForeignFutureResultI8 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteI8(
				UniffiForeignFutureCompleteI8 cb, uint64_t callback_data, UniffiForeignFutureResultI8 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U16
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U16
typedef struct UniffiForeignFutureResultU16 {
    uint16_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultU16;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U16
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U16
typedef void (*UniffiForeignFutureCompleteU16)(uint64_t callback_data, UniffiForeignFutureResultU16 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteU16(
				UniffiForeignFutureCompleteU16 cb, uint64_t callback_data, UniffiForeignFutureResultU16 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I16
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I16
typedef struct UniffiForeignFutureResultI16 {
    int16_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultI16;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I16
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I16
typedef void (*UniffiForeignFutureCompleteI16)(uint64_t callback_data, UniffiForeignFutureResultI16 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteI16(
				UniffiForeignFutureCompleteI16 cb, uint64_t callback_data, UniffiForeignFutureResultI16 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U32
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U32
typedef struct UniffiForeignFutureResultU32 {
    uint32_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultU32;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U32
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U32
typedef void (*UniffiForeignFutureCompleteU32)(uint64_t callback_data, UniffiForeignFutureResultU32 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteU32(
				UniffiForeignFutureCompleteU32 cb, uint64_t callback_data, UniffiForeignFutureResultU32 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I32
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I32
typedef struct UniffiForeignFutureResultI32 {
    int32_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultI32;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I32
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I32
typedef void (*UniffiForeignFutureCompleteI32)(uint64_t callback_data, UniffiForeignFutureResultI32 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteI32(
				UniffiForeignFutureCompleteI32 cb, uint64_t callback_data, UniffiForeignFutureResultI32 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U64
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_U64
typedef struct UniffiForeignFutureResultU64 {
    uint64_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultU64;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U64
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_U64
typedef void (*UniffiForeignFutureCompleteU64)(uint64_t callback_data, UniffiForeignFutureResultU64 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteU64(
				UniffiForeignFutureCompleteU64 cb, uint64_t callback_data, UniffiForeignFutureResultU64 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I64
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_I64
typedef struct UniffiForeignFutureResultI64 {
    int64_t returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultI64;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I64
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_I64
typedef void (*UniffiForeignFutureCompleteI64)(uint64_t callback_data, UniffiForeignFutureResultI64 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteI64(
				UniffiForeignFutureCompleteI64 cb, uint64_t callback_data, UniffiForeignFutureResultI64 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_F32
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_F32
typedef struct UniffiForeignFutureResultF32 {
    float returnValue;
    RustCallStatus callStatus;
} UniffiForeignFutureResultF32;

#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_F32
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_COMPLETE_F32
typedef void (*UniffiForeignFutureCompleteF32)(uint64_t callback_data, UniffiForeignFutureResultF32 result);

// Making function static works arround:
// https://github.com/golang/go/issues/11263
static void call_UniffiForeignFutureCompleteF32(
				UniffiForeignFutureCompleteF32 cb, uint64_t callback_data, UniffiForeignFutureResultF32 result)
{
	return cb(callback_data, result);
}


#endif
#ifndef UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_F64
#define UNIFFI_FFIDEF_FOREIGN_FUTURE_RESULT_F64
typedef struct UniffiForeignFutureResultF64 {
    double returnValue;
    RustCallStatus c
```

### Core Architecture Module: `bindings/python/slatedb/__init__.py`
```
"""SlateDB Python package."""

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2086** (2026-09-09): **`foyer = "0.22.4"` floor breaks musl builds (foyer-rs/foyer#1338)**
  *Symptoms*: **Describe the bug**  SlateDB cannot be built for `*-unknown-linux-musl` targets. The workspace requires `foyer = "0.22.4"`, and `foyer-storage` 0.22.4 and 0.22.5 do not compile for musl.  This failure can be fixed either by lowering the required foyer version to 0.22.3, or by waiting for foyer upstream to fix it.  There is an open issue, foyer-rs/foyer#1338, opened 2026-09-05, but it has no PR yet.  **To Reproduce**  1. `rustup target add x86_64-unknown-linux-musl` 2. `apt-get install musl-dev` (or an equivalent musl toolchain) 3. From the SlateDB workspace root, with the default features that include `foyer`: `cargo build -p slatedb --target x86_64-unknown-linux-musl`  The same failure reaches any downstream crate that depends on SlateDB and builds for musl.  **Expected behavior**  SlateDB builds for `*-unknown-linux-musl`.  **Screenshots**  Not applicable. The compiler output is provided.  **Build**  - `uname -a`: `Darwin 25.6.0 Darwin Kernel Version 25.6.0 arm64` locally. The failing target is `x86_64-unknown-linux-musl`, built on Linux CI. - OS: Linux, building the musl target. Cross-compiling from macOS does not reach this error, because the `zstd-sys` and `lz4-sys` build scripts fail first looking for `x86_64-linux-musl-gcc`. - SlateDB Version: 0.16.0, at `4478eb907b98c0a52299f359127ccba82c2716b9` - Object Store: S3  **Additional context**  `foyer-storage/src/io/device/utils.rs` declares four ioctl request constants as `u64`. It selects a platform branch with `cfg!()` 
  **Post-Mortem & Fix Analysis**:
  > Just saw foyer fixed the issue (it was faster than I expected!), so closing this.

- **Issue #2055** (2026-08-27): **Make with_wal_object_store safe for incremental deployment**
  *Symptoms*: **Describe the bug**    `with_wal_object_store()` is unusable for incremental deployment on v0.15.0. When a writer creates a new DB with `with_wal_object_store()`, the manifest persists `wal_object_store_uri = Some("")`. Any subsequent reader opening that DB without `with_wal_object_store()` configured gets `WalStoreReconfigurationError`.   The root cause is that `FlatBufferManifestCodec::encode` writes V1 (which preserves the `wal_object_store_uri` field) unless segment state requires V2. PR #1473 dropped the field from V2, but normal databases without segments still write V1 — so the validation remains active even on 0.15.0.    **To Reproduce**    1. Create a new DB using `DbBuilder` with `with_wal_object_store()` configured   2. Open the same DB using `DbReaderBuilder` without `with_wal_object_store()`   3. Reader fails with `WalStoreReconfigurationError`    **Expected behavior**    On v0.15.0 (which includes the ManifestV2 codec from PR #1473), `wal_object_store_uri` should not block readers from opening a database — either by defaulting to V2 manifest format, or by stripping the field before persisting.    **Screenshots**    N/A    **Build**    - OS: Linux   - SlateDB Version: 0.15.0   - Object Store: S3-compatible (custom)    **Additional context**    - Discord thread: https://discord.com/channels/1232385660460204122/1542581454280851466   - The fix is to default to V2 manifest format in 0.16 (per RFC 0004's phased rollout plan: write V1 → write V2 universally → deprecat

- **Issue #2051** (2026-08-26): **`SequenceTracker` accepts an update inside the interval after deserialization**
  *Symptoms*: ## What I observed  I found a behavior difference after serializing and deserializing a `SequenceTracker`. With the default 60-second interval, a tracker accepts an update one second after its last stored timestamp only after the round trip.  ## Exact reproduction  This internal test reproduces it on current `main`:  ```rust #[test] fn deserialize_preserves_the_recording_interval() {     let mut tracker = SequenceTracker::new();     tracker.insert(TrackedSeq {         seq: 0,         ts: DateTime::from_timestamp(1_600_000_060, 0).unwrap(),     });      let mut decoded = SequenceTracker::from_bytes(&tracker.to_bytes()).unwrap();     decoded.insert(TrackedSeq {         seq: 1,         ts: DateTime::from_timestamp(1_600_000_061, 0).unwrap(),     });      assert_eq!(decoded.sequence_numbers, vec![0]); } ```  The assertion fails because `decoded.sequence_numbers` is `[0, 1]`.  Reproduced against `main` at `31656fe30064ce0d7991a578085341e21438af5e`.  ## What I expected  The decoded tracker should retain sequence `0` only, matching the configured 60-second recording interval and the behavior before serialization.  ## What happened instead  The decoded tracker records sequence `1` one second later. The current decoder restores `sequence_numbers` and `timestamps`, but `last_recorded_ts` remains unset.

- **Issue #2047** (2026-08-25): **Tolerate manifests GCed during admin.list_manifests**
  *Symptoms*: ## Summary  During down scales (union cloning) we've sporadically observed `failed to find manifest with id. id=1` errors failing the restore, appearing to be a race by GC deleting manifest 1 of the clone after `create_clone` rewritten manifest 2, and `admin.list_manifests` doing `LIST` + `GET` each  The issue can be reproduced by setting `garbage_collector_options.manifest_options.min_age` to `1s` + slow union cloning, and solved here by skipping read of manifests that couldn't be found after listed Alternatively we could retry the LIST+GET as in https://github.com/slatedb/slatedb/pull/1230  ## Changes  - Skip reading GCed manifests during admin.list_manifests + a test  ## Notes for Reviewers  Related to https://github.com/slatedb/slatedb/issues/1215  ## Checklist  - [X] Small, scoped PR (< 500 total lines excluding tests); or opened as Draft with a plan on how to break it into smaller pieces - [x] Linked related issue(s) or added context in the description - [X] Self-reviewed the diff; added comments for tricky parts - [X] Tests added/updated and passing locally - [X] Ran `cargo fmt`, `cargo clippy --all-targets --all-features`, and `cargo nextest run --all-features` - [X] Called out any breaking changes and provided migration notes - [X] Considered performance impact; added notes or benchmarks if relevant  Thank you for the review! 🙏 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/slatedb/slatedb?pullRequest=2047) <br/>All committers have signed the CLA.

- **Issue #2036** (2026-08-24): **`DbReader` ignores the SST block size, so `ScanOptions::read_ahead_bytes` over-reads N× on any DB not written with 4 KiB blocks**
  *Symptoms*:  **Describe the bug**  `ScanOptions::read_ahead_bytes` is documented as a byte budget — "The number of bytes to read ahead. The value is rounded up to the nearest block size when fetching from object storage." — but `Reader::scan_with_options` converts it into a *block count* by dividing by the block size held on its own `TableStore`'s `SsTableFormat`. `DbBuilder` sets that field from `with_sst_block_size`, whereas `DbReaderBuilder` has no equivalent knob and always falls back to the 4096 default. A `DbReader` scanning a database written with any non-default block size therefore prefetches `configured_block_size / 4096` times the bytes it was asked for, per fetch task and per open SST: 4× under `SstBlockSize::Block16Kib`, 16× under `Block64Kib`.  Nothing downstream corrects the count. `blocks_to_fetch` is consumed as a raw count of blocks, and the byte extent of each fetch is read from the SST's own index, so the count gets multiplied by that SST's real block size rather than by the 4096 assumed when the count was computed.  **To Reproduce**  1. Build a `Db` with a non-default block size and write enough rows to produce a multi-MiB L0 SST, then close it. 2. Open a `DbReader` on the same path — note there is no way to tell it the block size the data was written with. 3. Scan with a `read_ahead_bytes` well above one block. 4. Observe the size of the first prefetch, either by instrumenting the object store or by inspecting `TableStore::bytes_to_blocks`.  ```rust let db = Db::bui
  **Post-Mortem & Fix Analysis**:
  > Closing since #2307 addressed this.

- **Issue #2025** (2026-08-13): **fix(seq_tracker): widen Gorilla fallback slot to 64 bits to preserve large seqnum deltas**
  *Symptoms*: ## Summary  Fixes #2024.  `SequenceTracker`'s Gorilla encoding stored delta-of-delta values that don't fit the small buckets in a **32-bit** fallback slot (`w.push32(dod as u32, 32)`), and the decoder sign-extended those 32 bits back. Sequence numbers are arbitrary `u64`s, so any pair of tracked entries whose delta-of-delta falls outside the `i32` range — e.g. a user-supplied `WriteOptions::seqnum` jump, which the docs explicitly support ("the offset returned by your external WAL") — was silently corrupted on the manifest encode/decode round trip. Because Gorilla is a delta chain, all subsequent values in the array get corrupted too, breaking the sorted-array invariant behind `find_ts`/`find_seq` (used by time-based retention and the `Admin` seq↔ts APIs) and potentially tripping the `Sequence numbers must be monotonic` assert on a later `extend_from`.  ## Changes  - Bump the serialization format to version 2: the `0b1111` fallback slot now stores the full 64-bit delta-of-delta (`push64`). The 1/2/3-byte buckets are unchanged, so typical workloads (tiny deltas between sampled entries) see no size difference. - Keep decoding version 1 data with the old 32-bit sign-extended layout: `decode_gorilla_i64_with_length` takes a `wide_fallback` flag chosen from the version byte, so existing manifests remain readable. - Regression tests:   - Three new round-trip cases that fail on `main` (`[0, 2^31]`, `[1, 5_000_000_000]`, `[1, 5_000_000_000, 5_000_000_100]`).   - A version-1 golden-byt
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/slatedb/slatedb?pullRequest=2025) <br/>All committers have signed the CLA.
  > This change will require a read-before-write rollout. Otherwise, the writer will write a V2 encoding to the manifest and the V1 readers will fail.
  > @agavra FYI. This does increase gorilla encoding size a bit when the detla-of-delta jumps >= 2048, but I think that's OK. Seqnum jumps are much smaller than that usually, and timestamps are stored by second, so anything < 34m interval change should still be the same size.

- **Issue #2024** (2026-09-04): **SequenceTracker Gorilla encoding silently corrupts sequence numbers when delta-of-delta exceeds i32 range**
  *Symptoms*: ### Summary  `SequenceTracker`'s Gorilla encoding stores delta-of-delta values that don't fit the 1/2/3-byte buckets in a **32-bit** fallback slot:  ```rust // slatedb/src/seq_tracker.rs (encode_gorilla_i64) _ => {     w.push32(0b1111, 4);     w.push32(dod as u32, 32);   // i64 dod truncated to its low 32 bits } ```  and the decoder sign-extends those 32 bits back:  ```rust let bits = GORILLA_PREFIX_BYTES[count];  // 32 for the fallback slot let raw = reader.read32(bits)...; sign_extend(raw, bits) as i64            // can only represent [-2^31, 2^31) ```  Sequence numbers are arbitrary `u64`s (bit-cast to `i64` for encoding), so any pair of tracked entries whose delta-of-delta falls outside the `i32` range is **silently corrupted** on the encode/decode round trip. Because Gorilla is a delta chain, every subsequent value in the array is corrupted too, which breaks the sorted-array invariant that `find_ts`/`find_seq` binary searches rely on.  ### Reproduction  Add these cases to the existing `test_encode_decode_sequence_numbers` round-trip test in `slatedb/src/seq_tracker.rs` (at `e9a14cd`):  ```rust #[case::dod_at_i32_boundary(vec![0, i32::MAX as u64 + 1])] #[case::user_seqnum_jump(vec![1, 5_000_000_000])] #[case::values_after_large_jump(vec![1, 5_000_000_000, 5_000_000_100])] ```  `cargo test -p slatedb --lib seq_tracker` fails with:  ``` ---- case_12_user_seqnum_jump ---- assertion `left == right` failed   left: [1, 705032704]  right: [1, 5000000000]  ---- case_13_values_aft
  **Post-Mortem & Fix Analysis**:
  > was going through the open bugs looking for something unclaimed to pick up, and landed here.  confirmed it from the source and then ran it. in slatedb/src/seq_tracker.rs the fallback arm at line 333 is w.push32(dod as u32, 32) with no range check. the other arms all sit inside their widths, line 319 guards -63..=63 for 7 bits, then -255..=255 for 9, then -2047..=2047 for 12. so the _ arm is the only one that can be handed a value it cannot hold.  dropped a temporary test into the module and ran it against main:   gap=2147483648  in=[0, 2147483648]      out=[0, -2147483648]  lossless=false gap=4294967296  in=[0, 4294967296]      out=[0, 0]            lossless=false gap=2147483653  in=[0, 2147483653]      out=[0, -2147483643]  lossless=false steady          in=[0, 10, 4294967306]  out=[0, 10, 10]       lossless=false inrange         in=[0, 2147483647]      out=[0, 2147483647]   lossless=true test result: ok. 1 passed the boundary is exact. 2^31 - 1 survives, 2^31 comes back negative. the
  > @Cintu07 https://github.com/slatedb/slatedb/pull/2025#issuecomment-5283868927

- **Issue #2022** (2026-08-13): **test(wal_replay): write_wal helper ignores max_entries due to always-true loop condition**
  *Symptoms*: **Describe the bug**  The `write_wal` test helper in `slatedb/src/wal_replay.rs` ignores its `max_entries` argument because its loop condition is always true:  ```rust let mut next_seq = next_seq; while next_seq < next_seq + (max_entries as u64) { ```  Both sides of the comparison grow together, so for any `max_entries > 0` the condition never becomes false and the loop only stops when the shared entries iterator is exhausted. (Only `max_entries == 0` yields `false`, which is why `write_empty_wal` still works.)  As a result, `write_wals` does not do what it says ("Write a sequence of WALs with a random (bounded) number of entries"): the first call with a non-zero budget writes **all** remaining entries into a single WAL SST, while `total_wal_entries` is still incremented by the intended per-WAL count, so the remaining loop iterations emit a series of **empty** WALs until the bookkeeping catches up.  This silently weakens the replay tests that rely on entries being spread across multiple WAL files:  - `should_replay_all_entries` - `should_enforce_max_memtable_bytes` - `should_only_replay_wals_after_last_l0_flushed_wal_id` - `should_replay_wals_after_min_seq`  They all still pass, but against a "1 giant WAL + N empty WALs" fixture. Notably, since replay only splits returned tables at WAL file boundaries (see `should_apply_max_memtable_bytes_at_wal_boundaries`), `should_enforce_max_memtable_bytes` currently replays everything into one oversized table and never actually exercises

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

### Incident Patch 1: `0d9e4fbe` (2026-10-02)
**Commit Message**: fix: initialize clone retention boundaries (#2143)

**File**: `slatedb/src/compactor_executor.rs` (modified, +101/-0)
```diff
@@ -2889,6 +2889,13 @@ mod tests {
                     retention_min_seq,
                 )),
             };
+            self.run_job(compaction).await
+        }
+
+        async fn run_job(
+            self,
+            compaction: StartCompactionJobArgs,
+        ) -> Result<SortedRun, SlateDBError> {
             self.executor.start_compaction_job(compaction);
 
             tokio::time::timeout(Duration::from_secs(5), async move {
@@ -2904,6 +2911,100 @@ mod tests {
         }
     }
 
+    #[rstest]
+    #[case::union(false, false)]
+    #[case::single_source_clone(true, false)]
+    #[case::legacy_union_clone(true, true)]
+    #[tokio::test(flavor = "multi_thread")]
+    async fn test_clone_compaction_removes_deleted_merge_without_flush(
+        #[case] clone_again: bool,
+        #[case] legacy_boundary: bool,
+    ) {
+        use crate::clone::CloneSource;
+        use crate::manifest::Manifest;
+        use crate::Checkpoint;
+        use uuid::Uuid;
+
+        let ctx = TestContextBuilder::new("testdb-clone-retention")
+            .with_merge_operator(Arc::new(StringConcatMergeOperator {}))
+            .build()
+            .await;
+        let table_store = ctx.table_store.clone();
+        let live = RowEntry::new_merge(b"z-live", b"live", 890_866);
+        let entries = [
+            vec![
+                RowEntry::new_tombstone(b"a-deleted", 886_642),
+                RowEntry::new_merge(b"a-deleted", b"old", 884_364),
+            ],
+            vec![live.clone()],
+        ];
+        let mut sources = Vec::new();
+        for (index, rows) in entries.iter().enumerate() {
+            let ssts = write_sst(&table_store, rows, usize::MAX).await;
+            let mut core = ManifestCore::new();
+            core.last_l0_seq = rows.iter().map(|row| row.seq).max().unwrap();
+            Arc::make_mut(&mut core.tree).compacted.push(SortedRun::new(
+                0,
+                ssts.into_iter().map(SsTableView::identity),
+            ));
+            sources.push(CloneSource {
+                manifest: Manifest::initial(core),
+                path: Path::from(format!("source-{index}")),
+                checkpoint: Checkpoint {
+                    id: Uuid::new_v4(),
+                    manifest_id: 1,
+                    expire_time: None,
+                    create_time: DefaultSystemClock::new().now(),
+                    name: None,
+                },
+            });
+        }
+        let rand = Arc::new(DbRand::new(42));
+        let mut manifest = Manifest::cloned_from_union(sources, rand.clone()).unwrap();
+        if legacy_boundary {
+            manifest.core.recent_snapshot_min_seq = 0;
+        }
+        if clone_again {
+            manifest = Manifest::cloned(&manifest, "union".into(), Uuid::new_v4(), rand);
+        }
+        assert!(manifest.core.tree.l0.is_empty());
+
+        let retention_min_seq = Some(manifest.core.recent_snapshot_min_seq);
+        let result = ctx
+            .run_job(StartCompactionJobArgs {
+                id: Ulid::new(),
+                compaction_id: Ulid::new(),
+                segment: Bytes::new(),
+                destination: 0,
+                l0_sst_views: vec![],
+                sorted_runs: manifest.core.tree.compacted.clone(),
+                compaction_clock_tick: manifest.core.last_l0_clock_tick,
+                is_dest_last_run: true,
+                retention_min_seq,
+                ctx: Some(CompactionContext::new(
+                    vec![Subcompaction::new(BytesRange::unbounded())],
+                    retention_min_seq,
+                )),
+            })
+            .await
+            .unwrap();
+
+        let mut rows = Vec::new();
+        for sst in result.sst_views() {
+            let mut iter = SstIterator::new(
+                SstView::Borrowed(sst, BytesRange::unbounded()),
+                table_store.clone(),
+                SstIteratorOptions::default(),
+            )
+            .unwrap();
+            iter.init().await.unwrap();
+            while let Some(row) = iter.next().await.unwrap() {
+                rows.push(row);
+            }
+        }
+        assert_eq!(rows, vec![live]);
+    }
+
     #[tokio::test(flavor = "multi_thread")]
     async fn test_compaction_job_should_retain_merges_newer_than_retention_min_seq_num() {
         let ctx = TestContextBuilder::new("testdb")
```

**File**: `slatedb/src/manifest/mod.rs` (modified, +47/-5)
```diff
@@ -712,6 +712,9 @@ impl ManifestCore {
         let mut clone = self.clone();
         clone.initialized = false;
         clone.checkpoints.clear();
+        // Source snapshots do not carry into the clone. Its first snapshot starts
+        // at or above the latest persisted sequence, even before a new flush.
+        clone.recent_snapshot_min_seq = clone.last_l0_seq;
         clone
     }
 
@@ -1543,6 +1546,9 @@ impl Manifest {
                 source.manifest.core.last_l0_clock_tick,
             );
         }
+        // The union does not inherit source snapshots, so compaction can drop
+        // older versions without waiting for new writes to flush.
+        core.recent_snapshot_min_seq = core.last_l0_seq;
 
         // Coalesce borrows of the same physical ancestor, keyed on (path, sst_ids) rather than
         // source_checkpoint_id: the carried-forward checkpoint id is regenerated on every clone,
@@ -3222,16 +3228,21 @@ mod tests {
         }
     }
 
-    #[test]
-    fn test_union_propagates_last_l0_seq() {
+    #[rstest]
+    #[case(100, 200)]
+    #[case(200, 100)]
+    #[case(0, 200)]
+    #[case(0, 0)]
+    fn test_union_initializes_retention_boundary(#[case] seq1: u64, #[case] seq2: u64) {
         let mut manifest1 = build_manifest(
             &SimpleManifest {
                 l0: vec![],
                 sorted_runs: vec![vec![SstEntry::projected("sr1", "a", "a".."m")]],
             },
             |_| SsTableId::from(Ulid::new()),
         );
-        manifest1.core.last_l0_seq = 100;
+        manifest1.core.last_l0_seq = seq1;
+        manifest1.core.recent_snapshot_min_seq = seq1 / 2;
 
         let mut manifest2 = build_manifest(
             &SimpleManifest {
@@ -3240,7 +3251,8 @@ mod tests {
             },
             |_| SsTableId::from(Ulid::new()),
         );
-        manifest2.core.last_l0_seq = 200;
+        manifest2.core.last_l0_seq = seq2;
+        manifest2.core.recent_snapshot_min_seq = seq2 / 2;
 
         let union = Manifest::cloned_from_union(
             vec![
@@ -3259,7 +3271,37 @@ mod tests {
         )
         .unwrap();
 
-        assert_eq!(union.core.last_l0_seq, 200);
+        let expected = seq1.max(seq2);
+        assert_eq!(union.core.last_l0_seq, expected);
+        assert_eq!(union.core.recent_snapshot_min_seq, expected);
+        assert!(union.core.tree.l0.is_empty());
+
+        let child = Manifest::cloned(
+            &union,
+            "/tmp/union".to_string(),
+            Uuid::new_v4(),
+            Arc::new(DbRand::default()),
+        );
+        assert_eq!(child.core.recent_snapshot_min_seq, expected);
+    }
+
+    #[rstest]
+    #[case(0)]
+    #[case(42)]
+    fn test_clone_resets_source_retention_boundary(#[case] source_boundary: u64) {
+        let mut parent = Manifest::initial(ManifestCore::new());
+        parent.core.last_l0_seq = 890_866;
+        parent.core.recent_snapshot_min_seq = source_boundary;
+
+        let child = Manifest::cloned(
+            &parent,
+            "/tmp/parent".to_string(),
+            Uuid::new_v4(),
+            Arc::new(DbRand::default()),
+        );
+
+        assert_eq!(child.core.recent_snapshot_min_seq, 890_866);
+        assert_eq!(parent.core.recent_snapshot_min_seq, source_boundary);
     }
 
     #[rstest]
```

---

### Incident Patch 2: `4923bf83` (2026-10-02)
**Commit Message**: fix: prevent data loss after union clone compaction (#2132)

**File**: `slatedb/src/clone.rs` (modified, +182/-1)
```diff
@@ -346,7 +346,7 @@ async fn build_source<R: RangeBounds<Bytes> + Clone>(
     manifest_at_checkpoint = if config.is_noop() {
         manifest_at_checkpoint
     } else {
-        Manifest::projected(&manifest_at_checkpoint, &config)?
+        Manifest::projected(&manifest_at_checkpoint, &config, rand)?
     };
 
     Ok(CloneSource {
@@ -733,6 +733,187 @@ mod tests {
         .await
     }
 
+    #[rstest::rstest]
+    #[case::full(8)]
+    #[case::partial(5)]
+    #[tokio::test]
+    async fn should_preserve_union_data_after_compaction_and_reopen(#[case] max_sources: usize) {
+        use crate::config::{CompactionWorkerOptions, CompactorOptions};
+        use std::collections::{HashMap, HashSet};
+
+        let object_store: Arc<dyn ObjectStore> = Arc::new(InMemory::new());
+        let clock = Arc::new(DefaultSystemClock::new());
+        let rand = Arc::new(DbRand::new(42));
+        let fp = Arc::new(FailPointRegistry::new());
+        let settings = Settings {
+            compactor_options: None,
+            garbage_collector_options: None,
+            ..Default::default()
+        };
+        let parent = Db::builder("parent", object_store.clone())
+            .with_settings(settings.clone())
+            .build()
+            .await
+            .unwrap();
+        let mut expected = BTreeMap::new();
+        for i in 0..256u16 {
+            let key = (i * 2).to_be_bytes();
+            parent.put(key, b"parent").await.unwrap();
+            expected.insert(key.to_vec(), b"parent".to_vec());
+        }
+        parent.flush().await.unwrap();
+        parent
+            .flush_with_options(FlushOptions {
+                flush_type: FlushType::MemTable,
+            })
+            .await
+            .unwrap();
+        assert_eq!(parent.manifest().manifest.core.tree.l0.len(), 1);
+        let parent_view = parent.manifest().manifest.core.tree.l0[0].clone();
+        parent.close().await.unwrap();
+
+        let mut sources = Vec::new();
+        let mut projected_ids = HashSet::new();
+        for shard in 0..4u16 {
+            let path = Path::from(format!("child-{shard}"));
+            let start = shard * 128;
+            let end = start + 128;
+            let range = (
+                Bound::Included(Bytes::copy_from_slice(&start.to_be_bytes())),
+                Bound::Excluded(Bytes::copy_from_slice(&end.to_be_bytes())),
+            );
+            create_native_clone(
+                vec![CloneSourceSpec::new("parent")],
+                path.clone(),
+                object_store.clone(),
+                object_store.clone(),
+                fp.clone(),
+                clock.clone(),
+                rand.clone(),
+                Some(range),
+                None,
+                None,
+            )
+            .await
+            .unwrap();
+            let child = Db::builder(path.clone(), object_store.clone())
+                .with_settings(settings.clone())
+                .build()
+                .await
+                .unwrap();
+            let projected_view = child.manifest().manifest.core.tree.l0[0].clone();
+            assert_eq!(projected_view.sst, parent_view.sst);
+            assert_ne!(projected_view.id, parent_view.id);
+            assert!(projected_ids.insert(projected_view.id));
+            child.put(start.to_be_bytes(), b"updated").await.unwrap();
+            child.put((start + 1).to_be_bytes(), b"new").await.unwrap();
+            child.delete((start + 2).to_be_bytes()).await.unwrap();
+            expected.insert(start.to_be_bytes().to_vec(), b"updated".to_vec());
+            expected.insert((start + 1).to_be_bytes().to_vec(), b"new".to_vec());
+            expected.remove((start + 2).to_be_bytes().as_slice());
+            child.flush().await.unwrap();
+            child
+                .flush_with_options(FlushOptions {
+                    flush_type: FlushType::MemTable,
+                })
+                .await
+                .unwrap();
+            assert_eq!(child.manifest().manifest.core.tree.l0.len(), 2);
+            child.close().await.unwrap();
+            sources.push(CloneSourceSpec::new(path));
+        }
+        create_native_clone(
+            sources,
+            "union",
+            object_store.clone(),
+            object_store.clone(),
+            fp,
+            clock.clone(),
+            rand,
+            None::<(Bound<Bytes>, Bound<Bytes>)>,
+            None,
+            None,
+        )
+        .await
+        .unwrap();
+        let store = Arc::new(ManifestStore::new(
+            &Path::from("union"),
+            object_store.clone(),
+        ));
+        let initial = store.read_latest_manifest().await.unwrap();
+        let views = &initial.manifest.core.tree.l0;
+        assert_eq!(views.len(), 8);
+        assert_eq!(views.iter().map(|v| v.id).collect::<HashSet<_>>().len(), 8);
+        async fn assert_contents(db: &Db, expected: &BTreeMap<Vec<u8>, Vec<u8>>) {
+            let mut scan =
```

**File**: `slatedb/src/compaction_worker.rs` (modified, +1/-1)
```diff
@@ -445,7 +445,7 @@ impl CompactionWorkerHandler {
             .spec()
             .destination()
             .ok_or(SlateDBError::InvalidCompaction)?;
-        let l0_sst_views = compaction.get_l0_sst_views(db_state);
+        let l0_sst_views = compaction.get_l0_sst_views(db_state)?;
         let sorted_runs = compaction.get_sorted_runs(db_state);
 
         // Reject drain specs (workers only execute tiered compactions; drain
```

**File**: `slatedb/src/compactor.rs` (modified, +71/-11)
```diff
@@ -706,21 +706,22 @@ impl CompactorEventHandler {
     ) -> Option<u64> {
         let tree = db_state.tree_for_segment(compaction.spec().segment())?;
 
-        let views_by_id: HashMap<Ulid, &SsTableView> =
-            tree.l0.iter().map(|view| (view.id, view)).collect();
+        let l0_bytes: u64 = compaction
+            .get_l0_sst_views(db_state)
+            .ok()?
+            .iter()
+            .map(SsTableView::estimate_visible_size)
+            .sum();
         let srs_by_id: HashMap<u32, &SortedRun> =
             tree.compacted.iter().map(|sr| (sr.id, sr)).collect();
 
         compaction
             .spec()
             .sources()
             .iter()
-            .try_fold(0, |total, source| {
-                let source_bytes = match source {
-                    SourceId::SstView(id) => views_by_id.get(id)?.estimate_visible_size(),
-                    SourceId::SortedRun(id) => srs_by_id.get(id)?.estimate_visible_size(),
-                };
-                Some(total + source_bytes)
+            .filter_map(SourceId::maybe_unwrap_sorted_run)
+            .try_fold(l0_bytes, |total, id| {
+                Some(total + srs_by_id.get(&id)?.estimate_visible_size())
             })
     }
 
@@ -972,15 +973,16 @@ impl CompactorEventHandler {
             );
             return Err(SlateDBError::InvalidCompaction);
         };
-        let l0_view_ids = tree.l0.iter().map(|view| view.id).collect::<HashSet<_>>();
+        // Reject missing or ambiguous L0 sources before execution and before commit.
+        compaction.get_l0_sst_views(db_state)?;
         let sr_ids = tree
             .compacted
             .iter()
             .map(|sr| sr.id)
             .collect::<HashSet<_>>();
 
         if let Some(missing) = spec.sources().iter().find(|source| match source {
-            SourceId::SstView(id) => !l0_view_ids.contains(id),
+            SourceId::SstView(_) => false,
             SourceId::SortedRun(id) => !sr_ids.contains(id),
         }) {
             debug!("compaction source missing from db state: {:?}", missing);
@@ -3980,6 +3982,37 @@ mod tests {
         assert_eq!(actual, None);
     }
 
+    #[rstest::rstest]
+    #[case::ambiguous_view(true)]
+    #[case::repeated_source(false)]
+    fn test_calculate_estimated_source_bytes_rejects_duplicate_l0_ids(
+        #[case] duplicate_view: bool,
+    ) {
+        let view = SsTableView::identity(SsTableHandle::new(
+            SsTableId::new(Ulid::new()),
+            SST_FORMAT_VERSION_LATEST,
+            SsTableInfo {
+                index_offset: 100,
+                ..SsTableInfo::default()
+            },
+        ));
+        let mut core = ManifestCore::new();
+        let tree = Arc::make_mut(&mut core.tree);
+        tree.l0.push_back(view.clone());
+        let mut sources = vec![SourceId::SstView(view.id)];
+        if duplicate_view {
+            tree.l0.push_back(view);
+        } else {
+            sources.push(SourceId::SstView(view.id));
+        }
+        let compaction = Compaction::new(Ulid::new(), CompactionSpec::new(sources, 1));
+
+        assert_eq!(
+            CompactorEventHandler::calculate_estimated_source_bytes(&compaction, &core),
+            None
+        );
+    }
+
     #[tokio::test]
     async fn test_should_track_per_job_throughput() {
         let start_time_ms = 1000u64;
@@ -4939,7 +4972,7 @@ mod tests {
             let scheduled = self.get_scheduled_compactions().await;
             for compaction in scheduled {
                 let destination = compaction.spec().destination().expect("tiered spec");
-                let l0_sst_views = compaction.get_l0_sst_views(db_state);
+                let l0_sst_views = compaction.get_l0_sst_views(db_state).unwrap();
                 let sorted_runs = compaction.get_sorted_runs(db_state);
                 let is_dest_last_run = match db_state.tree_for_segment(compaction.spec().segment())
                 {
@@ -5919,6 +5952,33 @@ mod tests {
         assert!(matches!(err, SlateDBError::InvalidCompaction));
     }
 
+    #[tokio::test]
+    async fn test_union_duplicate_l0_source_rejected_before_execution_and_commit() {
+        let mut fixture = CompactorEventHandlerTestFixture::new().await;
+        fixture.write_l0().await;
+        fixture.handler.handle_ticker().await.unwrap();
+        let spec = fixture.build_l0_compaction().await;
+        let manifest = fixture.handler.state_mut().manifest_mut_for_test();
+        let tree = Arc::make_mut(&mut manifest.value.core.tree);
+        tree.l0.push_back(tree.l0[0].clone());
+
+        // The spec names the ID only once, but two views carry that ID.
+        for status in [CompactionStatus::Submitted, CompactionStatus::Compacted] {
+            let compaction = Compaction::new(Ulid::new(), spec.clone()).with_status(status);
+            assert!(matches!(
+                fixture.handler.validate_compaction(&compaction),
+                Err(SlateDBError::InvalidCompaction)
+            ));
+ 
```

**File**: `slatedb/src/compactor_state.rs` (modified, +45/-6)
```diff
@@ -501,29 +501,68 @@ impl Compaction {
     /// Returns all L0 SSTable sources for this compaction. Sources are looked
     /// up from the spec's target segment tree (root tree for an empty
     /// segment).
+    /// Returns an error if a source is missing, ambiguous, or repeated.
     ///
     /// ## Arguments
     /// - `db_state`: The current core DB state from the manifest.
-    pub(crate) fn get_l0_sst_views(&self, db_state: &ManifestCore) -> Vec<SsTableView> {
+    pub(crate) fn get_l0_sst_views(
+        &self,
+        db_state: &ManifestCore,
+    ) -> Result<Vec<SsTableView>, SlateDBError> {
         let Some(tree) = db_state.tree_for_segment(self.spec.segment()) else {
-            return Vec::new();
+            debug!(
+                "compaction target segment missing [compaction_id={}, segment={:?}]",
+                self.id,
+                self.spec.segment()
+            );
+            return Err(SlateDBError::InvalidCompaction);
         };
-        let sst_views_by_id: HashMap<Ulid, &SsTableView> =
-            tree.l0.iter().map(|view| (view.id, view)).collect();
+        let mut sst_views_by_id = HashMap::new();
+        for view in &tree.l0 {
+            // None marks an ID shared by multiple views.
+            sst_views_by_id
+                .entry(view.id)
+                .and_modify(|entry| *entry = None)
+                .or_insert(Some(view));
+        }
 
+        let mut sources_seen = HashSet::new();
         self.spec
             .sources()
             .iter()
             .filter_map(|s| s.maybe_unwrap_sst_view())
-            .filter_map(|ulid| sst_views_by_id.get(&ulid).map(|t| (*t).clone()))
+            .map(|id| {
+                if !sources_seen.insert(id) {
+                    debug!(
+                        "compaction L0 source repeated [compaction_id={}, view_id={}]",
+                        self.id, id
+                    );
+                    return Err(SlateDBError::InvalidCompaction);
+                }
+                match sst_views_by_id.get(&id) {
+                    Some(Some(view)) => Ok((*view).clone()),
+                    invalid => {
+                        let reason = if invalid.is_some() {
+                            "ambiguous"
+                        } else {
+                            "missing"
+                        };
+                        debug!(
+                            "compaction L0 source {} [compaction_id={}, view_id={}]",
+                            reason, self.id, id
+                        );
+                        Err(SlateDBError::InvalidCompaction)
+                    }
+                }
+            })
             .collect()
     }
 
     /// Builds the output run when all input SST views have disjoint effective
     /// key ranges. Reusing the views avoids reading or rewriting SST data.
     pub(crate) fn trivial_move_output(&self, db_state: &ManifestCore) -> Option<SortedRun> {
         let destination = self.spec.destination()?;
-        let mut sst_views = self.get_l0_sst_views(db_state);
+        let mut sst_views = self.get_l0_sst_views(db_state).ok()?;
         sst_views.extend(
             self.get_sorted_runs(db_state)
                 .iter()
```

**File**: `slatedb/src/db_state.rs` (modified, +46/-2)
```diff
@@ -5,7 +5,9 @@ use crate::manifest::{Manifest, ManifestCore};
 use crate::mem_table::{ImmutableMemtable, KVTable, WritableKVTable};
 use crate::reader::DbStateReader;
 use bytes::Bytes;
+use rand::Rng;
 use serde::Serialize;
+use slatedb_common::DbRand;
 use slatedb_txn_obj::DirtyObject;
 use std::collections::VecDeque;
 use std::fmt::{Debug, Formatter};
@@ -161,10 +163,24 @@ impl SsTableView {
     /// SST owns the range logically but holds no physical keys in it: it
     /// contributes nothing to the projection and is dropped rather than
     /// constructing a view whose physical/visible intersection is empty.
-    pub(crate) fn try_with_visible_range(&self, visible_range: BytesRange) -> Option<Self> {
+    pub(crate) fn try_with_visible_range(
+        &self,
+        visible_range: BytesRange,
+        rand: &DbRand,
+    ) -> Option<Self> {
         self.physical_range().intersect(&visible_range)?;
+        if self.visible_range.as_ref() == Some(&visible_range) {
+            return Some(self.clone());
+        }
+        // A changed range is a new view. Preserve the timestamp for GC watermarks.
+        let id = loop {
+            let id = Ulid::from_parts(self.id.timestamp_ms(), rand.rng().random::<u128>());
+            if id != self.id {
+                break id;
+            }
+        };
         Some(Self::new_projected(
-            self.id,
+            id,
             self.sst.clone(),
             Some(visible_range),
         ))
@@ -937,6 +953,7 @@ mod tests {
     use proptest::collection::vec;
     use proptest::proptest;
     use slatedb_common::clock::{DefaultSystemClock, SystemClock};
+    use slatedb_common::DbRand;
     use std::collections::BTreeSet;
     use std::collections::VecDeque;
     use std::ops::Bound::{Excluded, Included, Unbounded};
@@ -1362,6 +1379,33 @@ mod tests {
         SsTableView::identity(handle)
     }
 
+    #[test]
+    fn test_projection_assigns_new_view_ids_only_when_range_changes() {
+        let base = create_compacted_sst_view_with_size(b"a", b"z", 100);
+        let rand = DbRand::new(42);
+        let left_range = BytesRange::from_ref("a".."m");
+        let left = base
+            .try_with_visible_range(left_range.clone(), &rand)
+            .unwrap();
+        let right = base
+            .try_with_visible_range(BytesRange::from_ref("m"..="z"), &rand)
+            .unwrap();
+
+        assert_ne!(left.id, base.id);
+        assert_ne!(right.id, base.id);
+        assert_ne!(left.id, right.id);
+        for view in [&left, &right] {
+            assert_eq!(view.id.timestamp_ms(), base.id.timestamp_ms());
+            assert_eq!(view.sst, base.sst);
+        }
+        assert_eq!(left.visible_range, Some(left_range.clone()));
+        assert_eq!(left.try_with_visible_range(left_range, &rand), Some(left));
+        assert!(base
+            .try_with_visible_range(BytesRange::from_ref("zz"..), &rand)
+            .is_none());
+        assert_eq!(base.visible_range, None);
+    }
+
     #[test]
     fn estimate_size_unprojected_view_returns_raw_physical_size() {
         let view = create_compacted_sst_view_with_size(b"a", b"z", 1_000_000);
```

**File**: `slatedb/src/manifest/mod.rs` (modified, +318/-14)
```diff
@@ -12,6 +12,7 @@ use crate::seq_tracker::SequenceTracker;
 use crate::utils::IdGenerator;
 use bytes::Bytes;
 use log::{debug, warn};
+use rand::Rng;
 use serde::Serialize;
 use slatedb_common::DbRand;
 use slatedb_txn_obj::DirtyObject;
@@ -1044,6 +1045,7 @@ impl Manifest {
     pub(crate) fn projected(
         source_manifest: &Manifest,
         config: &ProjectionConfig,
+        rand: &DbRand,
     ) -> Result<Manifest, SlateDBError> {
         if config.is_noop() {
             return Ok(source_manifest.clone());
@@ -1055,7 +1057,7 @@ impl Manifest {
         match Self::resolve_segment_action(b"", config)? {
             SegmentAction::Drop => projected.core.tree = Arc::new(LsmTreeState::default()),
             SegmentAction::Project(range) => {
-                Self::project_tree_in_place(Arc::make_mut(&mut projected.core.tree), &range)
+                Self::project_tree_in_place(Arc::make_mut(&mut projected.core.tree), &range, rand)
             }
             SegmentAction::PassThrough => {}
         }
@@ -1074,7 +1076,7 @@ impl Manifest {
             match Self::resolve_segment_action(&segment.prefix, config)? {
                 SegmentAction::Drop => { /* filtered out */ }
                 SegmentAction::Project(range) => {
-                    Self::project_tree_in_place(Arc::make_mut(&mut segment.tree), &range);
+                    Self::project_tree_in_place(Arc::make_mut(&mut segment.tree), &range, rand);
                     if !segment.tree.l0.is_empty() || !segment.tree.compacted.is_empty() {
                         kept.push(segment);
                     }
@@ -1160,11 +1162,18 @@ impl Manifest {
     /// Filter `tree.l0` and `tree.compacted` views against `range` in place.
     /// Sorted runs that lose all views are removed. Watermark fields are
     /// untouched (the caller decides whether to keep them).
-    fn project_tree_in_place(tree: &mut LsmTreeState, range: &BytesRange) {
-        let l0: VecDeque<SsTableView> = Self::filter_view_handles(&tree.l0, true, range).into();
+    fn project_tree_in_place(tree: &mut LsmTreeState, range: &BytesRange, rand: &DbRand) {
+        if let Some(watermark) = tree.last_compacted_l0_sst_view_id {
+            assert!(
+                tree.l0.iter().all(|view| view.id != watermark),
+                "L0 view watermark references an active view: {watermark}"
+            );
+        }
+        let l0: VecDeque<SsTableView> =
+            Self::filter_view_handles(&tree.l0, true, range, rand).into();
         let mut sorted_runs_filtered = vec![];
         for sr in &tree.compacted {
-            let sst_views = Self::filter_view_handles(sr.sst_views().iter(), false, range);
+            let sst_views = Self::filter_view_handles(sr.sst_views().iter(), false, range, rand);
             if !sst_views.is_empty() {
                 sorted_runs_filtered.push(SortedRun::new(sr.id, sst_views));
             }
@@ -1177,6 +1186,7 @@ impl Manifest {
         views: T,
         views_overlap: bool,
         projection_range: &BytesRange,
+        rand: &DbRand,
     ) -> Vec<SsTableView>
     where
         T: IntoIterator<Item = &'a SsTableView>,
@@ -1197,7 +1207,7 @@ impl Manifest {
                 // gap beyond this SST's physical keys. `try_with_visible_range`
                 // drops the SST in that case instead of panicking on an empty
                 // physical/visible intersection.
-                if let Some(view) = current_handle.try_with_visible_range(intersection) {
+                if let Some(view) = current_handle.try_with_visible_range(intersection, rand) {
                     filtered_handles.push(view);
                 }
             }
@@ -1427,6 +1437,47 @@ impl Manifest {
         external_dbs
     }
 
+    /// Assign unique L0 view IDs when sources share IDs in a new union clone.
+    fn assign_union_l0_view_ids(core: &mut ManifestCore, rand: &DbRand) {
+        for tree in core.trees() {
+            if let Some(watermark) = tree.last_compacted_l0_sst_view_id {
+                assert!(
+                    tree.l0.iter().all(|view| view.id != watermark),
+                    "L0 view watermark references an active view: {watermark}"
+                );
+            }
+        }
+        for tree in std::iter::once(&mut core.tree)
+            .chain(core.segments.iter_mut().map(|segment| &mut segment.tree))
+        {
+            let mut used = HashSet::new();
+            let duplicates: HashSet<_> = tree
+                .l0
+                .iter()
+                .filter_map(|view| (!used.insert(view.id)).then_some(view.id))
+                .collect();
+            if duplicates.is_empty() {
+                continue;
+            }
+            used.extend(tree.last_compacted_l0_sst_view_id);
+            for view in &mut Arc::make_mut(tree).l0 {
+                if duplicates.contains(&view.id) {
+                    loop {
+                        // Keep the timestamp because GC also uses view watermarks.
+    
```

**File**: `website/src/content/docs/docs/design/clones.mdx` (modified, +3/-0)
```diff
@@ -38,3 +38,6 @@ The design is described in detail in [RFC 0004](/rfcs/0004-checkpoints).
 ## Constraints
 
 The clone path must be different from the source path. Clone creation also fails if the source database uses a separate WAL object store. Today, clones only support databases whose WAL and main data share the same object-store root.
+
+Projection assigns a new view ID when the visible range changes, and union clones assign unique L0 view IDs.
+See [union clone view IDs](/docs/operations/compatibility/#union-clone-view-ids) for the limits on existing databases.
```

**File**: `website/src/content/docs/docs/operations/compatibility.mdx` (modified, +14/-0)
```diff
@@ -12,3 +12,17 @@ Shared deployments should move one release at a time. If several processes read
 A single database can contain a mix of older and newer SST files during normal operation. Readers and compactors must understand every format already present in the bucket. SlateDB version-checks its persistent formats and fails fast when it sees a version it does not understand.
 
 Compression is part of compatibility too. A process can only read compressed SSTs for codecs that were compiled into that binary. If one deployment writes Zstd-compressed SSTs, every reader and compactor that touches that database needs the `zstd` feature enabled. [Compression](/docs/design/compression) covers the codec feature flags.
+
+## Union clone view IDs
+
+A union clone combines views from several databases into one database.
+Older builds can give several L0 views the same ID after a split and union.
+Compaction can then read one view and remove other views that it never read.
+
+The fix assigns unique view IDs during projection and union clone creation.
+The compactor rejects requests that reference duplicate IDs.
+The fix does not repair existing manifests or restore lost data.
+
+Upgrade all processes that create clones before creating new union clones.
+Writers and compactors also need the separate watermark fix to preserve unread views that share a physical SST.
+An older process can still apply the faulty compaction logic.
```

---

### Incident Patch 3: `f80b2788` (2026-10-02)
**Commit Message**: db_cache: FoyerCache::new_with_cache wraps a caller-built foyer cache (#2121)

Co-authored-by: sinbad-io <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>
Co-authored-by: Chris <[REDACTED_EMAIL]>

**File**: `slatedb/src/db_cache/foyer.rs` (modified, +178/-1)
```diff
@@ -91,6 +91,30 @@ impl FoyerCache {
             .build();
         Self { inner: cache }
     }
+
+    /// Wraps a Foyer cache configured by the caller.
+    ///
+    /// To measure capacity in bytes, use
+    /// `.with_weighter(|_, v: &CachedEntry| v.size())`. Without a custom
+    /// weigher, capacity counts entries. Keep a clone of the cache to read
+    /// `usage()` after passing it here.
+    ///
+    /// ```
+    /// use slatedb::db_cache::foyer::FoyerCache;
+    /// use slatedb::db_cache::{CachedEntry, CachedKey};
+    ///
+    /// let cache: foyer::Cache<CachedKey, CachedEntry> = foyer::CacheBuilder::new(512 << 20)
+    ///     .with_weighter(|_, v: &CachedEntry| v.size().max(1))
+    ///     .with_filter(|_, v: &CachedEntry| v.size() <= 4 << 20)
+    ///     .with_eviction_config(foyer::FifoConfig::default())
+    ///     .build();
+    /// let indexed = cache.clone();
+    /// let db_cache = FoyerCache::new_with_cache(cache);
+    /// assert_eq!(indexed.usage(), 0);
+    /// ```
+    pub fn new_with_cache(cache: foyer::Cache<CachedKey, CachedEntry>) -> Self {
+        Self { inner: cache }
+    }
 }
 
 impl Default for FoyerCache {
@@ -198,10 +222,163 @@ impl FoyerCache {
 mod tests {
     use super::*;
     use crate::db_state::SsTableId;
-    use crate::format::sst::BlockBuilder;
+    use crate::format::block::Block;
+    use crate::format::sst::{BlockBuilder, SsTableFormat};
+    use crate::sst_stats::SstStats;
     use crate::types::RowEntry;
+    use bytes::Bytes;
+    use std::sync::atomic::{AtomicUsize, Ordering};
+    use tokio::sync::watch;
     use ulid::Ulid;
 
+    fn key(id: u64) -> CachedKey {
+        CachedKey::from((SsTableId::new(Ulid::from_parts(1, 1)), id))
+    }
+
+    fn block(weight: usize) -> CachedEntry {
+        assert!(weight >= 2);
+        CachedEntry::with_block(Arc::new(Block {
+            data: Bytes::from(vec![42; weight - 2]),
+            offsets: vec![],
+        }))
+    }
+
+    /// A caller-built FIFO cache that refuses any entry heavier than a shard's share of
+    /// `capacity`. Foyer splits capacity evenly across shards and indexes an entry heavier
+    /// than its shard anyway, so a filter keyed to the whole capacity only holds the
+    /// ceiling with one shard.
+    fn bounded(capacity: usize, shards: usize) -> FoyerCache {
+        let share = capacity / shards;
+        FoyerCache::new_with_cache(
+            foyer::CacheBuilder::new(capacity)
+                .with_weighter(|_, v: &CachedEntry| v.size().max(1))
+                .with_filter(move |_, v: &CachedEntry| v.size().max(1) <= share)
+                .with_shards(shards)
+                .with_eviction_config(foyer::FifoConfig::default())
+                .build(),
+        )
+    }
+
+    async fn entries() -> [CachedEntry; 4] {
+        let format = SsTableFormat::default();
+        let mut builder = format.table_builder();
+        builder
+            .add(RowEntry::new_value(b"key", b"value", 1))
+            .await
+            .unwrap();
+        let sst = builder.build().await.unwrap();
+        let bytes = sst.remaining_as_bytes();
+        let index = format.read_index_raw(&sst.info, &bytes).await.unwrap();
+        [
+            block(32),
+            CachedEntry::with_sst_index(Arc::new(index)),
+            CachedEntry::with_filters(sst.filters),
+            CachedEntry::with_sst_stats(Arc::new(SstStats::default())),
+        ]
+    }
+
+    async fn fetch(
+        cache: &FoyerCache,
+        kind: usize,
+        key: CachedKey,
+        loader: CacheLoader,
+    ) -> Result<CachedEntry, crate::Error> {
+        let fetched = match kind {
+            0 => cache.fetch_block(key, loader).await,
+            1 => cache.fetch_index(key, loader).await,
+            2 => cache.fetch_filter(key, loader).await,
+            3 => cache.fetch_stats(key, loader).await,
+            _ => unreachable!(),
+        };
+        fetched.map(|f| f.entry)
+    }
+
+    #[tokio::test]
+    async fn new_with_cache_keeps_the_callers_admission_and_eviction() {
+        let cache = bounded(10, 1);
+        cache.insert(key(0), block(6)).await;
+        assert_eq!(cache.inner.usage(), 6);
+        assert!(cache.get_block(&key(0)).await.unwrap().is_some());
+
+        // Heavier than the cache: the filter refuses it and nothing is indexed.
+        cache.insert(key(1), block(12)).await;
+        assert!(cache.get_block(&key(1)).await.unwrap().is_none());
+        assert_eq!(cache.inner.usage(), 6);
+
+        // Fits the cache but not beside the first entry: FIFO evicts the first.
+        cache.insert(key(2), block(6)).await;
+        assert!(cache.get_block(&key(0)).await.unwrap().is_none());
+        assert!(cache.get_block(&key(2)).await.unwrap().is_some());
+        assert_eq!(cache.inner.usage(), 6);
+    }
+
+    /// Keys hash to shards, so the ceiling must hold whichever shard an entry lands in.
+    #[tokio::test]
+    async fn new_with_cache_holds_the_ceiling_across_shards() 
```

---

### Incident Patch 4: `da6ac332` (2026-10-01)
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

### Incident Patch 5: `a961e029` (2026-10-01)
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

### Incident Patch 6: `d7ea2d76` (2026-10-01)
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

---

### Incident Patch 7: `43612e89` (2026-10-01)
**Commit Message**: sst_iter: read an SST's filters for a prefix scan only when a policy can answer a prefix (#2128)

Co-authored-by: sinbad-io <[REDACTED_EMAIL]>

**File**: `slatedb/src/config.rs` (modified, +6/-2)
```diff
@@ -390,8 +390,12 @@ pub struct ScanOptions {
     /// Optional context forwarded to custom filter policies; ignored by
     /// built-in filters. See [`FilterContext`].
     ///
-    /// Consulted by `scan_prefix`, and by `scan` only when a registered
-    /// policy reports [`crate::filter_policy::FilterPolicy::supports_range_queries`].
+    /// Consulted by `scan` only when a registered policy reports
+    /// [`crate::filter_policy::FilterPolicy::supports_range_queries`], and by
+    /// `scan_prefix` only when a registered policy reports
+    /// [`crate::filter_policy::FilterPolicy::supports_prefix_queries`] or,
+    /// failing that, `supports_range_queries`, in which case the prefix's key
+    /// range is what the filters are asked about.
     pub filter_context: Option<FilterContext>,
     /// Optional caller-provided tracing settings.
     pub tracing_options: Option<TracingOptions>,
```

**File**: `slatedb/src/filter_policy.rs` (modified, +35/-0)
```diff
@@ -53,6 +53,14 @@ pub trait FilterPolicy: Send + Sync {
     fn supports_range_queries(&self) -> bool {
         false
     }
+
+    /// Whether this policy can answer a prefix query. A prefix scan reads an
+    /// SST's filters only when some registered policy answers `true`; a
+    /// policy that hashes whole keys cannot narrow a prefix, so fetching its
+    /// filter for one would cost an object read and prune nothing.
+    fn supports_prefix_queries(&self) -> bool {
+        true
+    }
 }
 
 /// Accumulator for entries during SST construction that produces a [`Filter`].
@@ -325,6 +333,10 @@ impl FilterPolicy for BloomFilterPolicy {
         let num_keys = u32::try_from(num_keys).expect("num_keys should fit in u32");
         BloomFilter::estimate_encoded_size(num_keys, self.bits_per_key)
     }
+
+    fn supports_prefix_queries(&self) -> bool {
+        self.prefix_extractor.is_some()
+    }
 }
 
 #[cfg(test)]
@@ -1026,4 +1038,27 @@ mod tests {
             other => panic!("expected Inline variant, got {:?}", other),
         }
     }
+
+    #[test]
+    fn a_whole_key_bloom_policy_answers_no_prefix_query() {
+        let whole = BloomFilterPolicy::new(10);
+        assert!(!whole.supports_prefix_queries());
+        assert!(!whole.supports_range_queries());
+        #[derive(Debug)]
+        struct Three;
+        impl PrefixExtractor for Three {
+            fn name(&self) -> &str {
+                "three"
+            }
+            fn prefix_len(&self, target: &PrefixTarget) -> Option<usize> {
+                let bytes = match target {
+                    PrefixTarget::Point(k) => k.as_ref(),
+                    PrefixTarget::Prefix(p) => p.as_ref(),
+                };
+                (bytes.len() >= 3).then_some(3)
+            }
+        }
+        let fixed = BloomFilterPolicy::new(10).with_prefix_extractor(Arc::new(Three));
+        assert!(fixed.supports_prefix_queries());
+    }
 }
```

**File**: `slatedb/src/sst_iter.rs` (modified, +112/-5)
```diff
@@ -970,10 +970,22 @@ impl<'a> SstIterator<'a> {
         let filter_context = internal.options.filter_context.clone();
         let filter_evaluator = match (point_key, prefix, range) {
             (Some(key), _, _) => Some(FilterEvaluator::new_point(key, filter_context, db_stats)),
-            (None, Some(p), _) => Some(FilterEvaluator::new_prefix(p, filter_context, db_stats)),
-            // A plain range scan reads this SST's filters only when there is
-            // a registered policy that can answer a range.
-            (None, None, (lower, upper))
+            // A prefix scan reads this SST's filters only when there is a
+            // registered policy that can answer a prefix; a whole-key bloom
+            // filter cannot, and fetching it would prune nothing.
+            (None, Some(p), _)
+                if internal
+                    .table_store()
+                    .any_filter_policy_supports_prefix_queries() =>
+            {
+                Some(FilterEvaluator::new_prefix(p, filter_context, db_stats))
+            }
+            // No policy answers a prefix, but one answers a range: a prefix
+            // scan's bounds are the prefix's key range, so the range evaluator
+            // prunes the same SSTs a range scan over those bounds would.
+            // Likewise a plain range scan reads this SST's filters only when
+            // there is a registered policy that can answer a range.
+            (None, _, (lower, upper))
                 if internal
                     .table_store()
                     .any_filter_policy_supports_range_queries() =>
@@ -985,7 +997,7 @@ impl<'a> SstIterator<'a> {
                     db_stats,
                 ))
             }
-            (None, None, _) => None,
+            (None, _, _) => None,
         };
         let delegate = match filter_evaluator {
             Some(fe) => SstIteratorDelegate::Filter(FilterIterator::new(internal, fe)),
@@ -3402,6 +3414,10 @@ mod tests {
         fn supports_range_queries(&self) -> bool {
             true
         }
+
+        fn supports_prefix_queries(&self) -> bool {
+            false
+        }
     }
 
     struct RangeCapableBuilder;
@@ -3488,4 +3504,95 @@ mod tests {
         let (positives, negatives, _) = verdicts(&recorder, crate::db_stats::FILTER_KIND_RANGE);
         assert_eq!((positives, negatives), (Some(0), Some(1)));
     }
+
+    #[tokio::test]
+    async fn should_not_read_filters_for_a_prefix_when_no_policy_supports_prefixes() {
+        // A whole-key bloom filter cannot answer a prefix or a range, so a
+        // bloom-only database must build no evaluator for a prefix scan and
+        // must not read the SST's filters.
+        for filter_context in [context(0), None] {
+            let (recorder, db_stats) = stats();
+            let table_store = bloom_filter_enabled_table_store(10);
+            let table = build_single_block_sst(&table_store, &[b"k1", b"k2"]).await;
+            let options = SstIteratorOptions {
+                prefix: Some(Bytes::from_static(b"k")),
+                filter_context,
+                ..Default::default()
+            };
+
+            let iter = SstIterator::new_owned_initialized_with_stats(
+                BytesRange::from_prefix_and_subrange(b"k", ..),
+                table,
+                table_store,
+                options,
+                None,
+                Some(db_stats),
+            )
+            .await
+            .unwrap();
+            assert!(iter.is_some(), "nothing rejected the SST");
+            for kind in [
+                crate::db_stats::FILTER_KIND_PREFIX,
+                crate::db_stats::FILTER_KIND_RANGE,
+            ] {
+                assert_eq!(
+                    verdicts(&recorder, kind),
+                    (Some(0), Some(0), Some(0)),
+                    "no evaluator should have been built"
+                );
+            }
+        }
+    }
+
+    #[tokio::test]
+    async fn should_prune_a_prefix_by_its_range_when_only_a_range_policy_exists() {
+        // No policy answers a prefix, but one answers a range: the prefix
+        // scan's bounds are the prefix's key range, so the range evaluator
+        // prunes the same SSTs a range scan over those bounds would.
+        let (recorder, db_stats) = stats();
+        let root_path = Path::from("");
+        let object_store: Arc<dyn ObjectStore> = Arc::new(InMemory::new());
+        let format = SsTableFormat {
+            min_filter_keys: 1,
+            filter_policies: vec![Arc::new(RangeCapablePolicy)],
+            ..SsTableFormat::default()
+        };
+        let table_store = Arc::new(TableStore::new(
+            object_store,
+            format,
+            root_path,
+            None,
+            TableStoreKind::Main,
+            BlockCachePolicy::default(),
+        ));
+        assert!(!table_store.any_filter_policy_supports_prefix_queries());
+        assert!(table_store.any_filter_policy_supports_
```

**File**: `slatedb/src/tablestore.rs` (modified, +8/-0)
```diff
@@ -956,6 +956,14 @@ impl TableStore {
             .any(|policy| policy.supports_range_queries())
     }
 
+    /// Whether any registered filter policy can answer a prefix query.
+    pub(crate) fn any_filter_policy_supports_prefix_queries(&self) -> bool {
+        self.sst_format
+            .filter_policies
+            .iter()
+            .any(|policy| policy.supports_prefix_queries())
+    }
+
     pub(crate) fn cache(&self) -> Option<&Arc<dyn DbCache>> {
         self.cache.as_ref()
     }
```

---

### Incident Patch 8: `951de2b0` (2026-09-30)
**Commit Message**: uniffi: with_block_transformer on the Db, reader and admin builders; Admin carries it into its compactor and worker (#2126)

Co-authored-by: sinbad-io <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -3361,6 +3361,7 @@ dependencies = [
 name = "slatedb-uniffi"
 version = "0.17.0"
 dependencies = [
+ "async-trait",
  "chrono",
  "figment",
  "log",
```

**File**: `bindings/go/uniffi/block_transformer_test.go` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+package slatedb_test
+
+import (
+	"errors"
+	"fmt"
+	"testing"
+
+	slatedb "slatedb.io/slatedb-go/uniffi"
+)
+
+func valueOf(got *[]byte) string {
+	if got == nil {
+		return "<nil>"
+	}
+	return string(*got)
+}
+
+// flip inverts every byte: its own inverse, so a block it did not write
+// decodes to bytes the block decoder refuses.
+type flip struct{}
+
+func (flip) Encode(data []byte) ([]byte, error) {
+	out := make([]byte, len(data))
+	for i, b := range data {
+		out[i] = ^b
+	}
+	return out, nil
+}
+
+func (f flip) Decode(data []byte) ([]byte, error) { return f.Encode(data) }
+
+// A database whose blocks go through a transform is readable only through
+// the same transform: a plain reader fails at its replay or its first block,
+// a reader carrying the transform reads the value back.
+func TestBlocksWrittenThroughATransformReadBackOnlyThroughIt(t *testing.T) {
+	store := newMemoryStore(t)
+	dbHandle := openTestDB(t, store, func(t *testing.T, builder *slatedb.DbBuilder) {
+		t.Helper()
+		if err := builder.WithBlockTransformer(flip{}); err != nil {
+			t.Fatalf("DbBuilder.WithBlockTransformer(): %v", err)
+		}
+	})
+	if _, err := dbHandle.db.Put([]byte("k"), []byte("v")); err != nil {
+		t.Fatalf("Put(): %v", err)
+	}
+	if err := dbHandle.db.FlushWithOptions(slatedb.FlushOptions{FlushType: slatedb.FlushTypeMemTable}); err != nil {
+		t.Fatalf("FlushWithOptions(): %v", err)
+	}
+	if got, err := dbHandle.db.Get([]byte("k")); err != nil || valueOf(got) != "v" {
+		t.Fatalf("Get() through the writer = %q, %v", valueOf(got), err)
+	}
+
+	plain := slatedb.NewDbReaderBuilder(testDBPath, store)
+	defer plain.Destroy()
+	if err := plain.WithReaderMode(slatedb.ReaderModeFollowLatest{}); err != nil {
+		t.Fatalf("WithReaderMode(): %v", err)
+	}
+	if reader, err := plain.Build(); err == nil {
+		got, err := reader.Get([]byte("k"))
+		if err == nil {
+			t.Fatalf("a reader without the transform read %q from a transformed block", valueOf(got))
+		}
+		_ = reader.Shutdown()
+		reader.Destroy()
+	} else if !errors.Is(err, slatedb.ErrErrorData) {
+		t.Fatalf("a reader without the transform failed with %v, want a data error", err)
+	}
+
+	flipped := openTestReader(t, store, func(t *testing.T, builder *slatedb.DbReaderBuilder) {
+		t.Helper()
+		if err := builder.WithReaderMode(slatedb.ReaderModeFollowLatest{}); err != nil {
+			t.Fatalf("WithReaderMode(): %v", err)
+		}
+		if err := builder.WithBlockTransformer(flip{}); err != nil {
+			t.Fatalf("DbReaderBuilder.WithBlockTransformer(): %v", err)
+		}
+	})
+	if got, err := flipped.reader.Get([]byte("k")); err != nil || valueOf(got) != "v" {
+		t.Fatalf("Get() through the transforming reader = %q, %v; want v", valueOf(got), err)
+	}
+}
+
+// wrongKey decodes nothing: it returns a plain Go error, not a
+// BlockTransformerCallbackError, as an application's decrypt failure would.
+type wrongKey struct{}
+
+func (wrongKey) Encode(data []byte) ([]byte, error) { return data, nil }
+
+func (wrongKey) Decode([]byte) ([]byte, error) {
+	return nil, fmt.Errorf("decrypt: wrong key")
+}
+
+// A transformer that fails with an arbitrary error makes the read a data
+// error; it never panics the Rust side.
+func TestATransformersArbitraryErrorIsADataError(t *testing.T) {
+	store := newMemoryStore(t)
+	dbHandle := openTestDB(t, store, nil)
+	if _, err := dbHandle.db.Put([]byte("k"), []byte("v")); err != nil {
+		t.Fatalf("Put(): %v", err)
+	}
+	if err := dbHandle.db.FlushWithOptions(slatedb.FlushOptions{FlushType: slatedb.FlushTypeMemTable}); err != nil {
+		t.Fatalf("FlushWithOptions(): %v", err)
+	}
+
+	builder := slatedb.NewDbReaderBuilder(testDBPath, store)
+	defer builder.Destroy()
+	if err := builder.WithReaderMode(slatedb.ReaderModeFollowLatest{}); err != nil {
+		t.Fatalf("WithReaderMode(): %v", err)
+	}
+	if err := builder.WithBlockTransformer(wrongKey{}); err != nil {
+		t.Fatalf("WithBlockTransformer(): %v", err)
+	}
+	reader, err := builder.Build()
+	if err == nil {
+		_, err = reader.Get([]byte("k"))
+		_ = reader.Shutdown()
+		reader.Destroy()
+	}
+	if err == nil {
+		t.Fatal("a reader whose transformer fails read a value")
+	}
+	if !errors.Is(err, slatedb.ErrErrorData) {
+		t.Fatalf("a failing transformer surfaced %v, want a data error", err)
+	}
+}
```

**File**: `bindings/go/uniffi/slatedb.go` (modified, +465/-48)
```diff
@@ -359,6 +359,7 @@ func readFloat64(reader io.Reader) float64 {
 
 func init() {
 
+	FfiConverterBlockTransformerINSTANCE.register()
 	FfiConverterCounterINSTANCE.register()
 	FfiConverterGaugeINSTANCE.register()
 	FfiConverterHistogramINSTANCE.register()
@@ -534,6 +535,24 @@ func uniffiCheckChecksums() {
 			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_admin_submit_compaction: UniFFI API checksum mismatch")
 		}
 	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_blocktransformer_encode()
+		})
+		if checksum != 55862 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_blocktransformer_encode: UniFFI API checksum mismatch")
+		}
+	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_blocktransformer_decode()
+		})
+		if checksum != 16013 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_blocktransformer_decode: UniFFI API checksum mismatch")
+		}
+	}
 	{
 		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
 			return C.uniffi_slatedb_uniffi_checksum_method_adminbuilder_build()
@@ -633,6 +652,15 @@ func uniffiCheckChecksums() {
 			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_dbbuilder_build: UniFFI API checksum mismatch")
 		}
 	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_dbbuilder_with_block_transformer()
+		})
+		if checksum != 57975 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_dbbuilder_with_block_transformer: UniFFI API checksum mismatch")
+		}
+	}
 	{
 		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
 			return C.uniffi_slatedb_uniffi_checksum_method_dbbuilder_with_db_cache()
@@ -732,6 +760,15 @@ func uniffiCheckChecksums() {
 			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_dbreaderbuilder_build: UniFFI API checksum mismatch")
 		}
 	}
+	{
+		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
+			return C.uniffi_slatedb_uniffi_checksum_method_dbreaderbuilder_with_block_transformer()
+		})
+		if checksum != 44011 {
+			// If this happens try cleaning and rebuilding your project
+			panic("slatedb: uniffi_slatedb_uniffi_checksum_method_dbreaderbuilder_with_block_transformer: UniFFI API checksum mismatch")
+		}
+	}
 	{
 		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
 			return C.uniffi_slatedb_uniffi_checksum_method_dbreaderbuilder_with_db_cache()
@@ -3072,6 +3109,284 @@ func (_ FfiDestroyerAdminBuilder) Destroy(value *AdminBuilder) {
 	value.Destroy()
 }
 
+// Application-provided reversible transform of every SST block, data,
+// index, filter and stats alike, applied after compression and before the
+// checksum. `decode` must invert `encode` for every block the database
+// wrote; the engine records no transformer identity, key id or format
+// version, so a block that needs one carries it inside its own bytes.
+//
+// The engine calls the methods from Tokio's blocking pool, one call per
+// block, so a slow transform holds no runtime worker but still delays the
+// block it transforms.
+type BlockTransformer interface {
+	Encode(data []byte) ([]byte, error)
+	Decode(data []byte) ([]byte, error)
+}
+
+// Application-provided reversible transform of every SST block, data,
+// index, filter and stats alike, applied after compression and before the
+// checksum. `decode` must invert `encode` for every block the database
+// wrote; the engine records no transformer identity, key id or format
+// version, so a block that needs one carries it inside its own bytes.
+//
+// The engine calls the methods from Tokio's blocking pool, one call per
+// block, so a slow transform holds no runtime worker but still delays the
+// block it transforms.
+type BlockTransformerImpl struct {
+	ffiObject FfiObject
+}
+
+func (_self *BlockTransformerImpl) Encode(data []byte) ([]byte, error) {
+	_pointer := _self.ffiObject.incrementPointer("BlockTransformer")
+	defer _self.ffiObject.decrementPointer()
+	_uniffiRV, _uniffiErr := rustCallWithError[*BlockTransformerCallbackError](FfiConverterBlockTransformerCallbackError{}, func(_uniffiStatus *C.RustCallStatus) RustBufferI {
+		return GoRustBuffer{
+			inner: C.uniffi_slatedb_uniffi_fn_method_blocktransformer_encode(
+				_pointer, FfiConverterBytesINSTANCE.Lower(data), _uniffiStatus),
+		}
+	})
+	if _uniffiErr != nil {
+		var _uniffiDefaultValue []byte
+		return _uniffiDefaultValue, _uniffiErr
+	} else {
+		return FfiConverterBytesINSTANCE.Lift(_uniffiRV), nil
+	}
+}
+
+func (_self *BlockTransformerImpl) Decode(data []byte) ([]byte, error) {
+	_pointer := _self.ffiObject.incrementPointer("Blo
```

**File**: `bindings/go/uniffi/slatedb.h` (modified, +101/-0)
```diff
@@ -369,6 +369,34 @@ static void call_UniffiForeignFutureCompleteVoid(
 }
 
 
+#endif
+#ifndef UNIFFI_FFIDEF_CALLBACK_INTERFACE_BLOCK_TRANSFORMER_METHOD0
+#define UNIFFI_FFIDEF_CALLBACK_INTERFACE_BLOCK_TRANSFORMER_METHOD0
+typedef void (*UniffiCallbackInterfaceBlockTransformerMethod0)(uint64_t uniffi_handle, RustBuffer data, RustBuffer* uniffi_out_return, RustCallStatus* callStatus );
+
+// Making function static works arround:
+// https://github.com/golang/go/issues/11263
+static void call_UniffiCallbackInterfaceBlockTransformerMethod0(
+				UniffiCallbackInterfaceBlockTransformerMethod0 cb, uint64_t uniffi_handle, RustBuffer data, RustBuffer* uniffi_out_return, RustCallStatus* callStatus )
+{
+	return cb(uniffi_handle, data, uniffi_out_return, callStatus );
+}
+
+
+#endif
+#ifndef UNIFFI_FFIDEF_CALLBACK_INTERFACE_BLOCK_TRANSFORMER_METHOD1
+#define UNIFFI_FFIDEF_CALLBACK_INTERFACE_BLOCK_TRANSFORMER_METHOD1
+typedef void (*UniffiCallbackInterfaceBlockTransformerMethod1)(uint64_t uniffi_handle, RustBuffer data, RustBuffer* uniffi_out_return, RustCallStatus* callStatus );
+
+// Making function static works arround:
+// https://github.com/golang/go/issues/11263
+static void call_UniffiCallbackInterfaceBlockTransformerMethod1(
+				UniffiCallbackInterfaceBlockTransformerMethod1 cb, uint64_t uniffi_handle, RustBuffer data, RustBuffer* uniffi_out_return, RustCallStatus* callStatus )
+{
+	return cb(uniffi_handle, data, uniffi_out_return, callStatus );
+}
+
+
 #endif
 #ifndef UNIFFI_FFIDEF_CALLBACK_INTERFACE_PREFIX_EXTRACTOR_METHOD0
 #define UNIFFI_FFIDEF_CALLBACK_INTERFACE_PREFIX_EXTRACTOR_METHOD0
@@ -537,6 +565,16 @@ static void call_UniffiCallbackInterfaceUpDownCounterMethod0(
 }
 
 
+#endif
+#ifndef UNIFFI_FFIDEF_V_TABLE_CALLBACK_INTERFACE_BLOCK_TRANSFORMER
+#define UNIFFI_FFIDEF_V_TABLE_CALLBACK_INTERFACE_BLOCK_TRANSFORMER
+typedef struct UniffiVTableCallbackInterfaceBlockTransformer {
+    UniffiCallbackInterfaceFree uniffiFree;
+    UniffiCallbackInterfaceClone uniffiClone;
+    UniffiCallbackInterfaceBlockTransformerMethod0 encode;
+    UniffiCallbackInterfaceBlockTransformerMethod1 decode;
+} UniffiVTableCallbackInterfaceBlockTransformer;
+
 #endif
 #ifndef UNIFFI_FFIDEF_V_TABLE_CALLBACK_INTERFACE_PREFIX_EXTRACTOR
 #define UNIFFI_FFIDEF_V_TABLE_CALLBACK_INTERFACE_PREFIX_EXTRACTOR
@@ -704,6 +742,31 @@ uint64_t uniffi_slatedb_uniffi_fn_method_admin_run_gc_once(uint64_t ptr, RustBuf
 uint64_t uniffi_slatedb_uniffi_fn_method_admin_submit_compaction(uint64_t ptr, RustBuffer spec
 );
 #endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CLONE_BLOCKTRANSFORMER
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CLONE_BLOCKTRANSFORMER
+uint64_t uniffi_slatedb_uniffi_fn_clone_blocktransformer(uint64_t handle, RustCallStatus *out_status
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_FREE_BLOCKTRANSFORMER
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_FREE_BLOCKTRANSFORMER
+void uniffi_slatedb_uniffi_fn_free_blocktransformer(uint64_t handle, RustCallStatus *out_status
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_INIT_CALLBACK_VTABLE_BLOCKTRANSFORMER
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_INIT_CALLBACK_VTABLE_BLOCKTRANSFORMER
+void uniffi_slatedb_uniffi_fn_init_callback_vtable_blocktransformer(UniffiVTableCallbackInterfaceBlockTransformer* vtable
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_BLOCKTRANSFORMER_ENCODE
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_BLOCKTRANSFORMER_ENCODE
+RustBuffer uniffi_slatedb_uniffi_fn_method_blocktransformer_encode(uint64_t ptr, RustBuffer data, RustCallStatus *out_status
+);
+#endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_BLOCKTRANSFORMER_DECODE
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_BLOCKTRANSFORMER_DECODE
+RustBuffer uniffi_slatedb_uniffi_fn_method_blocktransformer_decode(uint64_t ptr, RustBuffer data, RustCallStatus *out_status
+);
+#endif
 #ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CLONE_ADMINBUILDER
 #define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_CLONE_ADMINBUILDER
 uint64_t uniffi_slatedb_uniffi_fn_clone_adminbuilder(uint64_t handle, RustCallStatus *out_status
@@ -799,6 +862,11 @@ uint64_t uniffi_slatedb_uniffi_fn_constructor_dbbuilder_new(RustBuffer path, uin
 uint64_t uniffi_slatedb_uniffi_fn_method_dbbuilder_build(uint64_t ptr
 );
 #endif
+#ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_BLOCK_TRANSFORMER
+#define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_BLOCK_TRANSFORMER
+void uniffi_slatedb_uniffi_fn_method_dbbuilder_with_block_transformer(uint64_t ptr, uint64_t transformer, RustCallStatus *out_status
+);
+#endif
 #ifndef UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_DB_CACHE
 #define UNIFFI_FFIDEF_UNIFFI_SLATEDB_UNIFFI_FN_METHOD_DBBUILDER_WITH_DB_CACHE
 void uniffi_slatedb_uniffi_fn_method_dbbuilder_with_db_cache(uint64_t ptr, uint64_t db_cache, uint64_t db_cache_id, RustCallStatus *out_status
@@ -869,6 +937,11 @@ ui
```

**File**: `bindings/uniffi/Cargo.toml` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ doc = false
 bench = false
 
 [dependencies]
+async-trait = { workspace = true }
 chrono = { workspace = true }
 log = { workspace = true }
 parking_lot = { workspace = true }
```

**File**: `bindings/uniffi/src/block_transformer.rs` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+use std::sync::Arc;
+
+use slatedb::bytes::Bytes;
+
+use crate::error::BlockTransformerCallbackError;
+
+/// Application-provided reversible transform of every SST block, data,
+/// index, filter and stats alike, applied after compression and before the
+/// checksum. `decode` must invert `encode` for every block the database
+/// wrote; the engine records no transformer identity, key id or format
+/// version, so a block that needs one carries it inside its own bytes.
+///
+/// The engine calls the methods from Tokio's blocking pool, one call per
+/// block, so a slow transform holds no runtime worker but still delays the
+/// block it transforms.
+#[uniffi::export(with_foreign)]
+pub trait BlockTransformer: Send + Sync {
+    fn encode(&self, data: Vec<u8>) -> Result<Vec<u8>, BlockTransformerCallbackError>;
+
+    fn decode(&self, data: Vec<u8>) -> Result<Vec<u8>, BlockTransformerCallbackError>;
+}
+
+struct BlockTransformerAdapter {
+    inner: Arc<dyn BlockTransformer>,
+}
+
+#[async_trait::async_trait]
+impl slatedb::BlockTransformer for BlockTransformerAdapter {
+    async fn encode(&self, data: Bytes) -> Result<Bytes, slatedb::Error> {
+        let inner = self.inner.clone();
+        call_foreign(move || inner.encode(Vec::from(data)))
+            .await
+            .map_err(|error| slatedb::Error::data(format!("block transformer encode: {error}")))
+    }
+
+    async fn decode(&self, data: Bytes) -> Result<Bytes, slatedb::Error> {
+        let inner = self.inner.clone();
+        call_foreign(move || inner.decode(Vec::from(data)))
+            .await
+            .map_err(|error| slatedb::Error::data(format!("block transformer decode: {error}")))
+    }
+}
+
+/// Runs the synchronous foreign method on Tokio's blocking pool so the
+/// runtime worker polling the block stays free while the foreign runtime
+/// (cgo, the GIL, JNA, Node) holds the call.
+async fn call_foreign<F>(call: F) -> Result<Bytes, BlockTransformerCallbackError>
+where
+    F: FnOnce() -> Result<Vec<u8>, BlockTransformerCallbackError> + Send + 'static,
+{
+    tokio::task::spawn_blocking(call)
+        .await
+        .unwrap_or_else(|join_error| {
+            Err(BlockTransformerCallbackError::Failed {
+                message: join_error.to_string(),
+            })
+        })
+        .map(Bytes::from)
+}
+
+pub(crate) fn adapt_block_transformer(
+    inner: Arc<dyn BlockTransformer>,
+) -> Arc<dyn slatedb::BlockTransformer> {
+    Arc::new(BlockTransformerAdapter { inner })
+}
+
+#[cfg(test)]
+pub(crate) mod tests {
+    use super::*;
+
+    /// Flips every byte: its own inverse, and any block it did not write
+    /// decodes to garbage the block decoder refuses.
+    pub(crate) struct Flip;
+
+    impl BlockTransformer for Flip {
+        fn encode(&self, data: Vec<u8>) -> Result<Vec<u8>, BlockTransformerCallbackError> {
+            Ok(data.into_iter().map(|b| !b).collect())
+        }
+
+        fn decode(&self, data: Vec<u8>) -> Result<Vec<u8>, BlockTransformerCallbackError> {
+            Ok(data.into_iter().map(|b| !b).collect())
+        }
+    }
+
+    pub(crate) struct Refusing;
+
+    impl BlockTransformer for Refusing {
+        fn encode(&self, data: Vec<u8>) -> Result<Vec<u8>, BlockTransformerCallbackError> {
+            Ok(data)
+        }
+
+        fn decode(&self, _: Vec<u8>) -> Result<Vec<u8>, BlockTransformerCallbackError> {
+            Err(BlockTransformerCallbackError::Failed {
+                message: "no key".to_owned(),
+            })
+        }
+    }
+
+    #[test]
+    fn an_unknown_foreign_error_is_a_failed_callback_error() {
+        let error = <BlockTransformerCallbackError as uniffi::ConvertError<crate::UniFfiTag>>::try_convert_unexpected_callback_error(
+            uniffi::UnexpectedUniFFICallbackError::new("decrypt: wrong key"),
+        )
+        .expect("an unknown foreign error must convert instead of panicking the dispatcher");
+        assert!(
+            matches!(&error, BlockTransformerCallbackError::Failed { message } if message == "decrypt: wrong key"),
+            "{error:?}"
+        );
+        let unnamed =
+            BlockTransformerCallbackError::from(uniffi::UnexpectedUniFFICallbackError::new(""));
+        assert!(
+            matches!(&unnamed, BlockTransformerCallbackError::Failed { message } if !message.is_empty()),
+            "{unnamed:?}"
+        );
+    }
+
+    /// Holds every call until the test releases it from a task on the same
+    /// runtime; a callback that blocks the runtime's only worker never sees
+    /// the release.
+    struct Gated {
+        release: std::sync::Mutex<std::sync::mpsc::Receiver<()>>,
+    }
+
+    impl BlockTransformer for Gated {
+        fn encode(&self, data: Vec<u8>) -> Result<Vec<u8>, BlockTransformerCallbackError> {
+            self.release
+                .lock()
+                .unwrap()
+                .recv_timeout(std::time::Duration::from_secs(5))
+                .map(|()| data)
+  
```

**File**: `bindings/uniffi/src/builder.rs` (modified, +79/-0)
```diff
@@ -1,6 +1,7 @@
 use std::sync::Arc;
 
 use crate::admin::Admin;
+use crate::block_transformer::{adapt_block_transformer, BlockTransformer};
 use crate::config::{ReaderMode, ReaderOptions, SstBlockSize};
 use crate::db::Db;
 use crate::db_cache::DbCache;
@@ -80,6 +81,22 @@ impl DbBuilder {
             .map_err(Into::into)
     }
 
+    /// Transforms every SST block this database writes and reads, for
+    /// encryption at rest. A `DbReaderBuilder` of the database must carry the
+    /// same transform. The bindings run no standalone compactor or compaction
+    /// worker, so only this writer's embedded compactor rewrites the blocks;
+    /// `SlateDbWalReader` takes no transform, so it cannot read this
+    /// database's WAL.
+    pub fn with_block_transformer(
+        &self,
+        transformer: Arc<dyn BlockTransformer>,
+    ) -> Result<(), Error> {
+        self.update_builder(|builder| {
+            builder.with_block_transformer(adapt_block_transformer(transformer))
+        })
+        .map_err(Into::into)
+    }
+
     /// Sets the seed used for SlateDB's internal random number generation.
     pub fn with_seed(&self, seed: u64) -> Result<(), Error> {
         self.update_builder(|builder| builder.with_seed(seed))
@@ -212,6 +229,18 @@ impl DbReaderBuilder {
             .map_err(Into::into)
     }
 
+    /// Decodes every SST block this reader fetches with the transform the
+    /// database's writer encodes with.
+    pub fn with_block_transformer(
+        &self,
+        transformer: Arc<dyn BlockTransformer>,
+    ) -> Result<(), Error> {
+        self.update_builder(|builder| {
+            builder.with_block_transformer(adapt_block_transformer(transformer))
+        })
+        .map_err(Into::into)
+    }
+
     /// Installs an application-defined merge operator used while reading merge rows.
     pub fn with_merge_operator(&self, merge_operator: Arc<dyn MergeOperator>) -> Result<(), Error> {
         self.update_builder(|builder| {
@@ -398,3 +427,53 @@ impl CloneBuilder {
         builder.build().await.map_err(Into::into)
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::block_transformer::tests::Flip;
+    use crate::config::{FlushOptions, FlushType, ReaderMode};
+
+    #[tokio::test]
+    async fn blocks_written_through_a_transform_read_back_only_through_it() {
+        let object_store = Arc::new(ObjectStore {
+            inner: Arc::new(object_store::memory::InMemory::new()),
+        });
+        let builder = DbBuilder::new("transformed".to_owned(), object_store.clone());
+        builder.with_block_transformer(Arc::new(Flip)).unwrap();
+        let db = builder.build().await.unwrap();
+        db.put(b"k".to_vec(), b"v".to_vec()).await.unwrap();
+        db.flush_with_options(FlushOptions {
+            flush_type: FlushType::MemTable,
+        })
+        .await
+        .unwrap();
+        assert_eq!(db.get(b"k".to_vec()).await.unwrap(), Some(b"v".to_vec()));
+
+        // A reader without the transform fails at its WAL replay or at its
+        // first block read; either way it reads nothing.
+        let plain = DbReaderBuilder::new("transformed".to_owned(), object_store.clone());
+        plain.with_reader_mode(ReaderMode::FollowLatest).unwrap();
+        match plain.build().await {
+            Err(error) => assert!(matches!(error, Error::Data { .. }), "{error:?}"),
+            Ok(plain) => {
+                assert!(
+                    plain.get(b"k".to_vec()).await.is_err(),
+                    "a reader without the transform read a transformed block"
+                );
+                plain.close().await.unwrap();
+            }
+        }
+
+        let flipped = DbReaderBuilder::new("transformed".to_owned(), object_store);
+        flipped.with_reader_mode(ReaderMode::FollowLatest).unwrap();
+        flipped.with_block_transformer(Arc::new(Flip)).unwrap();
+        let flipped = flipped.build().await.unwrap();
+        assert_eq!(
+            flipped.get(b"k".to_vec()).await.unwrap(),
+            Some(b"v".to_vec())
+        );
+        flipped.close().await.unwrap();
+        db.close().await.unwrap();
+    }
+}
```

**File**: `bindings/uniffi/src/error.rs` (modified, +20/-0)
```diff
@@ -93,6 +93,26 @@ pub enum MergeOperatorCallbackError {
     Failed { message: String },
 }
 
+/// Error returned by a foreign [`crate::BlockTransformer`] implementation.
+/// Any other error or exception the foreign method raises becomes `Failed`.
+#[derive(Debug, Error, uniffi::Error)]
+pub enum BlockTransformerCallbackError {
+    /// The transform failed with an application-defined message.
+    #[error("{message}")]
+    Failed { message: String },
+}
+
+impl From<uniffi::UnexpectedUniFFICallbackError> for BlockTransformerCallbackError {
+    fn from(error: uniffi::UnexpectedUniFFICallbackError) -> Self {
+        let message = if error.reason.is_empty() {
+            "foreign transformer failed without a message".to_owned()
+        } else {
+            error.reason
+        };
+        Self::Failed { message }
+    }
+}
+
 /// Reason a database or reader reports itself as closed.
 #[derive(Clone, Copy, Debug, PartialEq, Eq, uniffi::Enum)]
 pub enum CloseReason {
```

---

### Incident Patch 9: `484d595d` (2026-09-29)
**Commit Message**: fix: preserve unread views when merging compaction watermarks (#2134)

**File**: `slatedb/src/manifest/mod.rs` (modified, +36/-3)
```diff
@@ -111,10 +111,10 @@ impl LsmTreeState {
                     .take_while(|view| {
                         // Match by view ID first (V2 manifests), then fall back
                         // to SST ID (V1).
+                        // A physical SST can have several views. Use its ID only
+                        // when the manifest has no view watermark.
                         if let Some(id) = last_compacted_view {
-                            if view.id == id {
-                                return false;
-                            }
+                            return view.id != id;
                         }
                         if let Some(id) = last_compacted_sst {
                             if view.sst.id.value() == id {
@@ -2125,6 +2125,39 @@ mod tests {
         assert_manifest_equal(&union, &expected_manifest, &sst_ids);
     }
 
+    #[rstest]
+    #[case(true)]
+    #[case(false)]
+    fn test_watermark_matches_view_not_shared_sst(#[case] watermark_present: bool) {
+        let sst = SsTableHandle::new(
+            SsTableId::from(Ulid::from_parts(1, 0)),
+            SST_FORMAT_VERSION_LATEST,
+            SsTableInfo::default(),
+        );
+        let left = SsTableView::new(Ulid::from_parts(1, 1), sst.clone());
+        let child = SsTableView::identity(SsTableHandle::new(
+            SsTableId::from(Ulid::from_parts(2, 0)),
+            SST_FORMAT_VERSION_LATEST,
+            SsTableInfo::default(),
+        ));
+        let right = SsTableView::new(Ulid::from_parts(1, 2), sst.clone());
+        let mut writer = LsmTreeState {
+            l0: VecDeque::from([left.clone(), child.clone()]),
+            ..Default::default()
+        };
+        if watermark_present {
+            writer.l0.push_back(right.clone());
+        }
+        let compactor = LsmTreeState {
+            last_compacted_l0_sst_view_id: Some(right.id),
+            last_compacted_l0_sst_id: Some(sst.id.value()),
+            ..Default::default()
+        };
+        let expected = VecDeque::from([left, child]);
+        assert_eq!(writer.merge_from_compactor(&compactor).l0, expected);
+        assert_eq!(compactor.merge_from_writer(&writer).l0, expected);
+    }
+
     #[test]
     fn test_lsm_tree_merge_invariants() {
         // Build a writer L0 with `n` views whose view IDs and SST IDs are all
```

---

### Incident Patch 10: `89341e82` (2026-09-29)
**Commit Message**: ci(python): drop s390x wheel build (#2135)

**File**: `.github/workflows/python.yaml` (modified, +4/-2)
```diff
@@ -24,8 +24,10 @@ jobs:
             target: aarch64
           - runner: ubuntu-22.04
             target: armv7
-          - runner: ubuntu-22.04
-            target: s390x
+          # No s390x: foyer depends on datasketches, which refuses to compile
+          # on big-endian targets.
+          # - runner: ubuntu-22.04
+          #   target: s390x
           - runner: ubuntu-22.04
             target: ppc64le
     steps:
```

---

### Incident Patch 11: `a644322b` (2026-09-25)
**Commit Message**: fix(clone): don't carry inherited external dbs that hold no SSTs (#2113)

Co-authored-by: sinbad-io <[REDACTED_EMAIL]>

**File**: `slatedb/src/clone.rs` (modified, +106/-0)
```diff
@@ -1016,6 +1016,112 @@ mod tests {
         reader.close().await.unwrap();
     }
 
+    // A clone lists every ancestor it inherits. Once compaction has re-localized all of an
+    // ancestor's SSTs, the detach collector releases the parent's pin on that ancestor. A
+    // clone of a checkpoint taken before the release reads nothing from the ancestor, so it
+    // must not need the pin.
+    #[tokio::test]
+    async fn should_clone_checkpoint_whose_emptied_ancestor_was_detached() {
+        let mut rng = rng::new_test_rng(None);
+        let table = sample::table(&mut rng, 1000, 10);
+
+        let object_store = Arc::new(InMemory::new());
+        let grandparent_path = Path::from("/tmp/test_grandparent");
+        let parent_path = Path::from("/tmp/test_parent");
+        let clone_path = Path::from("/tmp/test_clone");
+        let system_clock: Arc<dyn SystemClock> = Arc::new(DefaultSystemClock::new());
+        let rand = Arc::new(DbRand::default());
+
+        // The grandparent owns no SSTs, so the parent's entry for it is empty from the start,
+        // as it is once compaction has re-localized everything the parent borrowed.
+        Db::open(grandparent_path.clone(), object_store.clone())
+            .await
+            .unwrap()
+            .close()
+            .await
+            .unwrap();
+        create_clone(
+            parent_path.clone(),
+            grandparent_path.clone(),
+            object_store.clone(),
+            object_store.clone(),
+            None,
+            Arc::new(FailPointRegistry::new()),
+            system_clock.clone(),
+            rand.clone(),
+        )
+        .await
+        .unwrap();
+
+        // The parent's own collector would detach the empty entry as soon as it runs; the
+        // test releases the pin itself below, after the checkpoint that still lists it.
+        let parent_db = Db::builder(parent_path.clone(), object_store.clone())
+            .with_settings(Settings {
+                garbage_collector_options: None,
+                ..Settings::default()
+            })
+            .build()
+            .await
+            .unwrap();
+        test_utils::seed_database(&parent_db, &table, false)
+            .await
+            .unwrap();
+        parent_db
+            .flush_with_options(FlushOptions {
+                flush_type: FlushType::MemTable,
+            })
+            .await
+            .unwrap();
+        let checkpoint = parent_db
+            .create_checkpoint(CheckpointScope::All, &CheckpointOptions::default())
+            .await
+            .unwrap();
+        parent_db.close().await.unwrap();
+
+        // Release the parent's pin on the grandparent, as the detach collector does.
+        let checkpointed = ManifestStore::new(&parent_path, object_store.clone())
+            .read_manifest(checkpoint.manifest_id)
+            .await
+            .unwrap();
+        let ancestor = checkpointed
+            .external_dbs
+            .iter()
+            .find(|e| e.path == grandparent_path.to_string())
+            .expect("the checkpoint lists the grandparent");
+        assert!(ancestor.sst_ids.is_empty());
+        let mut grandparent_manifest = StoredManifest::load(
+            Arc::new(ManifestStore::new(&grandparent_path, object_store.clone())),
+            system_clock.clone(),
+        )
+        .await
+        .unwrap();
+        grandparent_manifest
+            .delete_checkpoint(ancestor.final_checkpoint_id.unwrap())
+            .await
+            .unwrap();
+
+        create_clone(
+            clone_path.clone(),
+            parent_path.clone(),
+            object_store.clone(),
+            object_store.clone(),
+            Some(checkpoint.id),
+            Arc::new(FailPointRegistry::new()),
+            system_clock.clone(),
+            rand.clone(),
+        )
+        .await
+        .unwrap();
+
+        let clone_db = Db::open(clone_path.clone(), object_store.clone())
+            .await
+            .unwrap();
+        let mut db_iter = clone_db.scan(..).await.unwrap();
+        test_utils::assert_ranged_db_scan(&table, .., IterationOrder::Ascending, &mut db_iter)
+            .await;
+        clone_db.close().await.unwrap();
+    }
+
     #[tokio::test]
     async fn should_clone_from_checkpoint_wal_enabled() {
         should_clone_from_checkpoint(Settings::default()).await
```

**File**: `slatedb/src/manifest/mod.rs` (modified, +94/-5)
```diff
@@ -997,8 +997,14 @@ impl Manifest {
     ) -> Self {
         let mut clone_external_dbs = vec![];
 
-        // Carry over each inherited external_db with a fresh final_checkpoint_id.
-        for parent_external_db in &parent_manifest.external_dbs {
+        // Carry over each inherited external_db that still holds SSTs, with a fresh
+        // final_checkpoint_id. An entry whose SSTs were all re-localized contributes nothing,
+        // and the detach collector may already have released the checkpoint it pinned.
+        for parent_external_db in parent_manifest
+            .external_dbs
+            .iter()
+            .filter(|external_db| !external_db.sst_ids.is_empty())
+        {
             clone_external_dbs.push(ExternalDb {
                 path: parent_external_db.path.clone(),
                 // don't depend on the original source_checkpoint: it was supplied by the user and
@@ -1385,14 +1391,18 @@ impl Manifest {
     }
 
     /// Build the union's `external_dbs` list. Forwards every source's
-    /// inherited `external_dbs` and adds one entry per source that owns
-    /// SSTs directly. `final_checkpoint_id` is left as `None`; it is
+    /// inherited `external_dbs` that still hold SSTs and adds one entry per
+    /// source that owns SSTs directly. `final_checkpoint_id` is left as `None`; it is
     /// regenerated after the post-loop deduplication.
     fn build_external_dbs(sources: &[&CloneSource]) -> Vec<ExternalDb> {
         let mut external_dbs = vec![];
         for source in sources {
             let manifest = &source.manifest;
-            for parent_external_db in &manifest.external_dbs {
+            for parent_external_db in manifest
+                .external_dbs
+                .iter()
+                .filter(|external_db| !external_db.sst_ids.is_empty())
+            {
                 external_dbs.push(ExternalDb {
                     path: parent_external_db.path.clone(),
                     // don't depend on the original source_checkpoint: it was supplied by the user and
@@ -1781,6 +1791,45 @@ mod tests {
         );
     }
 
+    #[test]
+    fn test_cloned_drops_emptied_ancestor() {
+        // Once compaction has re-localized every SST a parent borrowed from an ancestor, the
+        // parent's entry for it is empty, and the detach collector may release the ancestor's
+        // pin. A clone reads nothing from that ancestor, so it must not carry the entry:
+        // carrying it asks the ancestor to pin a checkpoint that may no longer exist.
+        let rand = Arc::new(DbRand::default());
+        let parent_owned_sst = SsTableId::from(Ulid::new());
+        let mut parent = build_manifest(
+            &SimpleManifest {
+                l0: vec![SstEntry::projected("parent_owned", "a", "a"..)],
+                sorted_runs: vec![],
+            },
+            |_| parent_owned_sst,
+        );
+        parent.external_dbs.push(ExternalDb {
+            path: "/tmp/grandparent".to_string(),
+            source_checkpoint_id: Uuid::new_v4(),
+            final_checkpoint_id: Some(Uuid::new_v4()),
+            sst_ids: vec![],
+        });
+
+        let cloned = Manifest::cloned(&parent, "/tmp/parent".to_string(), Uuid::new_v4(), rand);
+
+        assert!(
+            cloned
+                .external_dbs
+                .iter()
+                .all(|e| e.path != "/tmp/grandparent"),
+            "an ancestor entry with no SSTs must not be carried over"
+        );
+        let parent_entry = cloned
+            .external_dbs
+            .iter()
+            .find(|e| e.path == "/tmp/parent")
+            .expect("the immediate parent is always an entry");
+        assert_eq!(parent_entry.sst_ids, vec![parent_owned_sst]);
+    }
+
     #[tokio::test]
     async fn test_write_new_checkpoint() {
         let object_store: Arc<dyn ObjectStore> = Arc::new(InMemory::new());
@@ -2933,6 +2982,46 @@ mod tests {
         assert_eq!(union.core.last_l0_clock_tick, expected);
     }
 
+    #[test]
+    fn test_union_drops_emptied_ancestor() {
+        // As test_cloned_drops_emptied_ancestor, for a union: a source's inherited entry
+        // with no SSTs is not carried into the union.
+        let rand = Arc::new(DbRand::default());
+        let own_sst = SsTableId::from(Ulid::new());
+        let mut manifest = build_manifest(
+            &SimpleManifest {
+                l0: vec![SstEntry::projected("own", "a", "a"..)],
+                sorted_runs: vec![],
+            },
+            |_| own_sst,
+        );
+        manifest.external_dbs.push(ExternalDb {
+            path: "/tmp/grandparent".to_string(),
+            source_checkpoint_id: Uuid::new_v4(),
+            final_checkpoint_id: Some(Uuid::new_v4()),
+            sst_ids: vec![],
+        });
+
+        let union = Manifest::cloned_from_union(
+            vec![CloneSource {
+                manifest,
+                path: Path::from("/tmp/db1"),
+                checkpoint: new_checkpoint(
```

---

### Incident Patch 12: `2866a351` (2026-09-25)
**Commit Message**: Fix clock inheritance in union clones (#2107)

**File**: `slatedb/src/manifest/mod.rs` (modified, +52/-0)
```diff
@@ -1476,6 +1476,10 @@ impl Manifest {
 
         for source in &sources {
             core.last_l0_seq = max(core.last_l0_seq, source.manifest.core.last_l0_seq);
+            core.last_l0_clock_tick = max(
+                core.last_l0_clock_tick,
+                source.manifest.core.last_l0_clock_tick,
+            );
         }
 
         // Coalesce borrows of the same physical ancestor, keyed on (path, sst_ids) rather than
@@ -2881,6 +2885,54 @@ mod tests {
         assert_eq!(union.core.last_l0_seq, 200);
     }
 
+    #[rstest]
+    #[case(100, 250, 250)]
+    #[case(250, 100, 250)]
+    #[case(i64::MIN, 250, 250)]
+    #[case(i64::MIN, i64::MIN, i64::MIN)]
+    fn test_union_propagates_last_l0_clock_tick(
+        #[case] tick1: i64,
+        #[case] tick2: i64,
+        #[case] expected: i64,
+    ) {
+        let mut manifest1 = build_manifest(
+            &SimpleManifest {
+                l0: vec![],
+                sorted_runs: vec![vec![SstEntry::projected("sr1", "a", "a".."m")]],
+            },
+            |_| SsTableId::from(Ulid::new()),
+        );
+        manifest1.core.last_l0_clock_tick = tick1;
+
+        let mut manifest2 = build_manifest(
+            &SimpleManifest {
+                l0: vec![],
+                sorted_runs: vec![vec![SstEntry::projected("sr2", "m", "m"..)]],
+            },
+            |_| SsTableId::from(Ulid::new()),
+        );
+        manifest2.core.last_l0_clock_tick = tick2;
+
+        let union = Manifest::cloned_from_union(
+            vec![
+                CloneSource {
+                    manifest: manifest1,
+                    path: Path::from("/tmp/db1"),
+                    checkpoint: new_checkpoint(Uuid::new_v4()),
+                },
+                CloneSource {
+                    manifest: manifest2,
+                    path: Path::from("/tmp/db2"),
+                    checkpoint: new_checkpoint(Uuid::new_v4()),
+                },
+            ],
+            Arc::new(DbRand::default()),
+        )
+        .unwrap();
+
+        assert_eq!(union.core.last_l0_clock_tick, expected);
+    }
+
     #[test]
     fn test_union_external_dbs() {
         // manifest1 is clone-like: owns own_sst in core and inherits grandparent_sst
```

---

### Incident Patch 13: `0fb36809` (2026-09-20)
**Commit Message**: fix: refresh GC version gauges before boundary updates (#2100)

**File**: `slatedb/src/garbage_collector/compactions_gc.rs` (modified, +78/-3)
```diff
@@ -134,6 +134,8 @@ impl GcTask for CompactionsGcTask {
             })
             .collect::<Vec<_>>();
 
+        self.stats.gc_compactions_versions.set(pre_gc_count as i64);
+
         // Advance the boundary to the latest compactions file selected by the GC model. The
         // optional GC filter only gates the final deletion pass.
         if self.boundary_files_enabled {
@@ -152,8 +154,6 @@ impl GcTask for CompactionsGcTask {
             .map(|compactions_metadata| compactions_metadata.id)
             .collect::<Vec<_>>();
 
-        self.stats.gc_compactions_versions.set(pre_gc_count as i64);
-
         let deleted_count = self
             .maybe_delete_compactions(compactions_ids_to_delete)
             .await;
@@ -178,7 +178,7 @@ mod tests {
     use crate::compactions_store::{CompactionsStore, StoredCompactions};
     use async_trait::async_trait;
     use chrono::TimeDelta;
-    use object_store::{memory::InMemory, path::Path, ObjectStoreExt};
+    use object_store::{local::LocalFileSystem, memory::InMemory, path::Path, ObjectStoreExt};
     use slatedb_common::metrics::{
         lookup_metric_with_labels, DefaultMetricsRecorder, MetricsRecorderHelper,
     };
@@ -451,6 +451,81 @@ mod tests {
         );
     }
 
+    #[tokio::test]
+    async fn test_version_count_refreshes_when_boundary_advance_fails() {
+        let tempdir = tempfile::tempdir().unwrap();
+        let object_store = Arc::new(LocalFileSystem::new_with_prefix(tempdir.path()).unwrap());
+        let compactions_store = Arc::new(CompactionsStore::new(
+            &Path::from("/root"),
+            object_store.clone(),
+        ));
+        let mut stored = StoredCompactions::create(compactions_store.clone(), 0)
+            .await
+            .unwrap();
+        stored
+            .update(stored.prepare_dirty().unwrap())
+            .await
+            .unwrap();
+        stored
+            .update(stored.prepare_dirty().unwrap())
+            .await
+            .unwrap();
+        compactions_store.advance_boundary(1).await.unwrap();
+
+        let metrics = Arc::new(DefaultMetricsRecorder::new());
+        let recorder = MetricsRecorderHelper::new(metrics.clone(), Default::default());
+        let stats = Arc::new(GcStats::new(&recorder));
+        stats.gc_compactions_versions.set(-1);
+        let task = CompactionsGcTask::new(
+            compactions_store.clone(),
+            stats,
+            GarbageCollectorDirectoryOptions {
+                min_age: Duration::ZERO,
+                interval: None,
+                dry_run: false,
+            },
+            None,
+            true,
+        );
+
+        let error = task
+            .collect(Utc::now() + TimeDelta::hours(1))
+            .await
+            .unwrap_err();
+        assert!(matches!(
+            error,
+            SlateDBError::ObjectStoreError(error)
+                if matches!(error.as_ref(), object_store::Error::NotImplemented { .. })
+        ));
+
+        let raw_boundary = object_store
+            .get(&Path::from("/root/gc/compactions.boundary"))
+            .await
+            .unwrap()
+            .bytes()
+            .await
+            .unwrap();
+        assert_eq!("1", std::str::from_utf8(&raw_boundary).unwrap());
+        assert_eq!(
+            compactions_store
+                .list_compactions(..)
+                .await
+                .unwrap()
+                .iter()
+                .map(|compactions| compactions.id)
+                .collect::<Vec<_>>(),
+            vec![1, 2, 3]
+        );
+        assert_eq!(
+            lookup_metric_with_labels(
+                &metrics,
+                crate::garbage_collector::stats::VERSION_COUNT,
+                &[("resource", "compactions")]
+            ),
+            Some(3)
+        );
+    }
+
     #[tokio::test]
     async fn test_version_count_unchanged_on_dry_run() {
         let (compactions_store, mut stored) = make_compactions_store().await;
```

**File**: `slatedb/src/garbage_collector/manifest_gc.rs` (modified, +82/-3)
```diff
@@ -124,6 +124,8 @@ impl GcTask for ManifestGcTask {
             })
             .collect::<Vec<_>>();
 
+        self.stats.gc_manifest_versions.set(pre_gc_count as i64);
+
         // Advance the boundary to the latest manifest selected by the GC model. The optional GC
         // filter only gates the final deletion pass.
         if self.boundary_files_enabled {
@@ -142,8 +144,6 @@ impl GcTask for ManifestGcTask {
             .map(|manifest_metadata| manifest_metadata.id)
             .collect::<Vec<_>>();
 
-        self.stats.gc_manifest_versions.set(pre_gc_count as i64);
-
         let deleted_count = self.maybe_delete_manifests(manifest_ids_to_delete).await;
 
         if deleted_count > 0 {
@@ -169,7 +169,7 @@ mod tests {
     };
     use async_trait::async_trait;
     use chrono::TimeDelta;
-    use object_store::{memory::InMemory, path::Path, ObjectStoreExt};
+    use object_store::{local::LocalFileSystem, memory::InMemory, path::Path, ObjectStoreExt};
     use slatedb_common::clock::DefaultSystemClock;
     use slatedb_common::metrics::{
         lookup_metric_with_labels, DefaultMetricsRecorder, MetricsRecorderHelper,
@@ -447,6 +447,85 @@ mod tests {
         );
     }
 
+    #[tokio::test]
+    async fn test_version_count_refreshes_when_boundary_advance_fails() {
+        let tempdir = tempfile::tempdir().unwrap();
+        let object_store = Arc::new(LocalFileSystem::new_with_prefix(tempdir.path()).unwrap());
+        let manifest_store = Arc::new(ManifestStore::new(
+            &Path::from("/root"),
+            object_store.clone(),
+        ));
+        let mut stored = StoredManifest::create_new_db(
+            manifest_store.clone(),
+            ManifestCore::new(),
+            Arc::new(DefaultSystemClock::new()),
+        )
+        .await
+        .unwrap();
+        stored
+            .update(stored.prepare_dirty().unwrap())
+            .await
+            .unwrap();
+        stored
+            .update(stored.prepare_dirty().unwrap())
+            .await
+            .unwrap();
+        manifest_store.advance_boundary(1).await.unwrap();
+
+        let metrics = Arc::new(DefaultMetricsRecorder::new());
+        let recorder = MetricsRecorderHelper::new(metrics.clone(), Default::default());
+        let stats = Arc::new(GcStats::new(&recorder));
+        stats.gc_manifest_versions.set(-1);
+        let task = ManifestGcTask::new(
+            manifest_store.clone(),
+            stats,
+            GarbageCollectorDirectoryOptions {
+                min_age: Duration::ZERO,
+                interval: None,
+                dry_run: false,
+            },
+            None,
+            true,
+        );
+
+        let error = task
+            .collect(Utc::now() + TimeDelta::hours(1))
+            .await
+            .unwrap_err();
+        assert!(matches!(
+            error,
+            SlateDBError::ObjectStoreError(error)
+                if matches!(error.as_ref(), object_store::Error::NotImplemented { .. })
+        ));
+
+        let raw_boundary = object_store
+            .get(&Path::from("/root/gc/manifest.boundary"))
+            .await
+            .unwrap()
+            .bytes()
+            .await
+            .unwrap();
+        assert_eq!("1", std::str::from_utf8(&raw_boundary).unwrap());
+        assert_eq!(
+            manifest_store
+                .list_manifests(..)
+                .await
+                .unwrap()
+                .iter()
+                .map(|manifest| manifest.id)
+                .collect::<Vec<_>>(),
+            vec![1, 2, 3]
+        );
+        assert_eq!(
+            lookup_metric_with_labels(
+                &metrics,
+                crate::garbage_collector::stats::VERSION_COUNT,
+                &[("resource", "manifest")]
+            ),
+            Some(3)
+        );
+    }
+
     #[tokio::test]
     async fn test_version_count_unchanged_on_dry_run() {
         let (manifest_store, mut stored) = make_manifest_store().await;
```

---

### Incident Patch 14: `806c881c` (2026-09-14)
**Commit Message**: Fix descending scan behavior in the sorted run iterator (#2067)

**File**: `slatedb-dst/src/utils.rs` (modified, +5/-3)
```diff
@@ -93,9 +93,11 @@ pub fn build_reader_options(rand: &DbRand) -> DbReaderOptions {
 pub fn build_scan_options(rand: &DbRand, read_durability: DurabilityLevel) -> ScanOptions {
     let mut rng = rand.rng();
     let read_ahead_options = [1, 4 * 1024, 64 * 1024, MIB_1];
-    // Descending sorted-run iteration is currently broken.
-    // See https://github.com/slatedb/slatedb/pull/1995.
-    let order = IterationOrder::Ascending;
+    let order = if rng.random_bool(0.5) {
+        IterationOrder::Ascending
+    } else {
+        IterationOrder::Descending
+    };
 
     ScanOptions::new()
         .with_durability_filter(read_durability)
```

**File**: `slatedb/src/db.rs` (modified, +59/-0)
```diff
@@ -2599,6 +2599,39 @@ mod tests {
         kv_store.close().await.unwrap();
     }
 
+    #[tokio::test]
+    async fn test_seek_rejected_for_descending_scan() {
+        let object_store: Arc<dyn ObjectStore> = Arc::new(InMemory::new());
+        let kv_store = Db::builder("/tmp/test_seek_descending_rejected", object_store)
+            .with_settings(test_db_options(0, 1024, None))
+            .build()
+            .await
+            .unwrap();
+
+        kv_store.put(b"a", b"v0").await.unwrap();
+        kv_store.put(b"b", b"v1").await.unwrap();
+        kv_store.put(b"c", b"v2").await.unwrap();
+
+        let scan_options = ScanOptions::default().with_order(IterationOrder::Descending);
+        let mut iter = kv_store.scan_with_options(.., &scan_options).await.unwrap();
+        let err = iter.seek(b"b").await.unwrap_err();
+        assert_eq!(err.kind(), crate::ErrorKind::Invalid);
+        assert!(
+            err.to_string().contains("descending"),
+            "unexpected error: {err}"
+        );
+
+        // the scan itself still works
+        assert_eq!(iter.next().await.unwrap().unwrap().key.as_ref(), b"c");
+
+        // ascending scans still seek
+        let mut iter = kv_store.scan(..).await.unwrap();
+        iter.seek(b"b").await.unwrap();
+        assert_eq!(iter.next().await.unwrap().unwrap().key.as_ref(), b"b");
+
+        kv_store.close().await.unwrap();
+    }
+
     #[tokio::test]
     async fn test_scan_descending_bounded_range() {
         let object_store: Arc<dyn ObjectStore> = Arc::new(InMemory::new());
@@ -9465,10 +9498,23 @@ mod tests {
             .await
             .unwrap()
             .unwrap();
+        // A descending scan visits the SR's SSTs back to front, so the key's
+        // versions arrive out of sequence order unless the SR iterator
+        // reassembles them across the boundary.
+        let desc_options = ScanOptions::default().with_order(IterationOrder::Descending);
+        let data_scan_desc = db
+            .scan_with_options(b"k".as_slice().., &desc_options)
+            .await
+            .unwrap()
+            .next()
+            .await
+            .unwrap()
+            .unwrap();
         info!("data: {:?}", data);
         info!("data (scan): {:?}", data_scan.value);
         assert_eq!(data, expected);
         assert_eq!(data_scan.value, expected);
+        assert_eq!(data_scan_desc.value, expected);
     }
 
     #[cfg(feature = "wal_disable")]
@@ -9621,10 +9667,23 @@ mod tests {
             .await
             .unwrap()
             .unwrap();
+        // Same key, scanned the other way: the merge operands must still be
+        // applied newest last, which requires the SR iterator to pull the
+        // key's earlier SST before emitting anything.
+        let desc_options = ScanOptions::default().with_order(IterationOrder::Descending);
+        let data_scan_desc = db
+            .scan_with_options(b"k".as_slice().., &desc_options)
+            .await
+            .unwrap()
+            .next()
+            .await
+            .unwrap()
+            .unwrap();
         info!("data: {:?}", data);
         info!("data (scan): {:?}", data_scan.value);
         assert_eq!(data, expected);
         assert_eq!(data_scan.value, expected);
+        assert_eq!(data_scan_desc.value, expected);
     }
 
     #[tokio::test]
```

**File**: `slatedb/src/db_iter.rs` (modified, +122/-12)
```diff
@@ -49,11 +49,11 @@ impl DbIteratorRangeTracker {
     }
 }
 
-/// Sources for a point lookup, in newest-first order.
-/// The stream initializes each source before it yields the source.
-///
-/// `Mutex` makes this stream `Sync`, as [`RowEntryIterator`] requires.
-/// The code accesses `Mutex` only through `get_mut`, so it never locks.
+/// Sources for a point lookup, in newest-first order.
+/// The stream initializes each source before it yields the source.
+///
+/// `Mutex` makes this stream `Sync`, as [`RowEntryIterator`] requires.
+/// The code accesses `Mutex` only through `get_mut`, so it never locks.
 type InitializedSources =
     Mutex<BoxStream<'static, Result<Box<dyn RowEntryIterator + 'static>, SlateDBError>>>;
 
@@ -173,14 +173,18 @@ impl RowEntryIterator for GetIterator {
             let iter = self.current.as_mut().expect("source set above");
 
             if let Some(entry) = iter.next().await? {
-                // Note: The Get iterator should not advance past tombstones, which is
-                // why we filter them out here. When a tombstone is encountered, we return None
-                // so the iterator stops without advancing to the next iterator in the chain.
                 match &entry.value {
-                    ValueDeletable::Tombstone => {
-                        return Ok(None);
+                    ValueDeletable::Value(_) | ValueDeletable::Tombstone => {
+                        // Merge operands need their base, but no older entries.
+                        // Drop the remaining sources and any pending initialization.
+                        self.current = None;
+                        *self.sources.get_mut() = stream::empty().boxed();
+                        if entry.value.is_tombstone() {
+                            return Ok(None);
+                        }
+                        return Ok(Some(entry));
                     }
-                    _ => {
+                    ValueDeletable::Merge(_) => {
                         return Ok(Some(entry));
                     }
                 }
@@ -249,6 +253,7 @@ pub struct DbIterator {
     iter: Box<dyn RowEntryIterator + 'static>,
     invalidated_error: Option<SlateDBError>,
     last_key: Option<Bytes>,
+    order: IterationOrder,
     read_span: tracing::Span,
 }
 
@@ -323,6 +328,7 @@ impl DbIterator {
             iter,
             invalidated_error: None,
             last_key: None,
+            order,
             read_span,
         })
     }
@@ -395,10 +401,14 @@ impl DbIterator {
     /// After a successful seek, the iterator will return the next record
     /// with a key greater than or equal to `next_key`.
     ///
+    /// Only supported for ascending scans. Descending scans return an error
+    /// because the merge and sorted-run iterators only seek in ascending order.
+    ///
     /// # Errors
     ///
     /// Returns an invalid argument error in the following cases:
     ///
+    /// - if the scan was opened with [`IterationOrder::Descending`]
     /// - if `next_key` comes before the current iterator position
     /// - if `next_key` is beyond the upper bound specified in the original
     ///   [`crate::db::Db::scan`] parameters
@@ -408,6 +418,8 @@ impl DbIterator {
         let next_key = next_key.as_ref();
         if let Some(error) = self.invalidated_error.clone() {
             Err(error.into())
+        } else if matches!(self.order, IterationOrder::Descending) {
+            Err(SlateDBError::SeekNotSupportedForDescendingScan.into())
         } else if !self.range.contains(&next_key) {
             Err(SlateDBError::SeekKeyOutOfRange {
                 key: next_key.to_vec(),
@@ -534,12 +546,14 @@ mod tests {
     use crate::db_iter::{DbIterator, GetIterator};
     use crate::error::SlateDBError;
     use crate::iter::{EmptyIterator, IterationOrder, RowEntryIterator};
+    use crate::merge_operator::MergeOperatorType;
     use crate::reader::ReadTrace;
-    use crate::test_utils::TestIterator;
+    use crate::test_utils::{StringConcatMergeOperator, TestIterator};
     use crate::types::RowEntry;
     use async_trait::async_trait;
     use bytes::Bytes;
     use parking_lot::Mutex;
+    use rstest::rstest;
     use std::collections::VecDeque;
     use std::sync::atomic::{AtomicUsize, Ordering};
     use std::sync::Arc;
@@ -639,6 +653,8 @@ mod tests {
 
         let entry = iter.next().await.unwrap().expect("newest source holds key");
         assert_eq!(entry.value.as_bytes(), Some(Bytes::from_static(b"0")));
+        assert_eq!(iter.next().await.unwrap(), None);
+        assert_eq!(iter.next().await.unwrap(), None);
 
         // The iterator probes the newest source alone.
         // A hit in this source does not cause speculative reads.
@@ -651,6 +667,8 @@ mod tests {
         let mut iter = GetIterator::with_lookahead(Bytes::from_static(b"key"), iters, 4);
 
         iter.next().await.unwrap().expect("source 1 holds key");
+        assert_eq!(iter.next().await.un
```

**File**: `slatedb/src/error.rs` (modified, +4/-0)
```diff
@@ -210,6 +210,9 @@ pub(crate) enum SlateDBError {
     #[error("cannot seek to a key less than the last returned key")]
     SeekKeyLessThanLastReturnedKey,
 
+    #[error("seek is not supported for descending scans")]
+    SeekNotSupportedForDescendingScan,
+
     #[error(
         "parent path must be different from the clone's path. parent_path=`{0}`, clone_path=`{0}`"
     )]
@@ -669,6 +672,7 @@ impl From<SlateDBError> for Error {
             SlateDBError::CheckpointLifetimeTooShort { .. } => Error::invalid(msg),
             SlateDBError::SeekKeyOutOfRange { .. } => Error::invalid(msg),
             SlateDBError::SeekKeyLessThanLastReturnedKey => Error::invalid(msg),
+            SlateDBError::SeekNotSupportedForDescendingScan => Error::invalid(msg),
             SlateDBError::IdenticalClonePaths { .. } => Error::invalid(msg),
             SlateDBError::DuplicatedCloneSourcePath(_) => Error::invalid(msg),
             SlateDBError::InvalidCloneSourceWithWal { .. } => Error::invalid(msg),
```

**File**: `slatedb/src/segment_iterator.rs` (modified, +0/-3)
```diff
@@ -52,9 +52,6 @@ impl SegmentScanContext {
 /// the per-segment merge can preserve key-by-key ordering across both
 /// tiers. Point lookups skip this entirely and build their own flat
 /// chain via [`crate::db_iter::GetIterator::from_lsm_tree`].
-///
-/// Descending scans over sorted runs are broken until
-/// [`SortedRunIterator`] supports descending iteration.
 struct RangeTreeIterators {
     l0: VecDeque<Box<dyn RowEntryIterator>>,
     sr: VecDeque<Box<dyn RowEntryIterator>>,
```

**File**: `slatedb/src/sorted_run_iterator.rs` (modified, +398/-21)
```diff
@@ -2,7 +2,7 @@ use crate::bytes_range::BytesRange;
 use crate::db_state::{SortedRun, SsTableView};
 use crate::db_stats::DbStats;
 use crate::error::SlateDBError;
-use crate::iter::RowEntryIterator;
+use crate::iter::{IterationOrder, RowEntryIterator};
 use crate::sst_iter::{SstIterator, SstIteratorOptions, SstTracingContext, SstView};
 use crate::tablestore::TableStore;
 use crate::types::RowEntry;
@@ -22,20 +22,28 @@ enum SortedRunView<'a> {
 }
 
 impl<'a> SortedRunView<'a> {
-    /// Pops the next table, restricting the iteration range to the table's
-    /// view range. Projected tables (e.g. in cloned manifests) may have a
-    /// `visible_range` narrower than the requested range; tables whose view
-    /// range does not intersect the requested range are skipped entirely.
-    fn pop_sst(&mut self) -> Option<SstView<'a>> {
+    /// Pops the next table in iteration order, restricting the iteration range
+    /// to the table's view range. Tables are stored in ascending key order, so
+    /// a descending scan pops from the back. Projected tables (e.g. in cloned
+    /// manifests) may have a `visible_range` narrower than the requested range;
+    /// tables whose view range does not intersect the requested range are
+    /// skipped entirely.
+    fn pop_sst(&mut self, order: IterationOrder) -> Option<SstView<'a>> {
         match self {
             SortedRunView::Owned(tables, r) => loop {
-                let table = tables.pop_front()?;
+                let table = match order {
+                    IterationOrder::Ascending => tables.pop_front()?,
+                    IterationOrder::Descending => tables.pop_back()?,
+                };
                 if let Some(view_range) = table.calculate_view_range(r.clone()) {
                     return Some(SstView::Owned(Box::new(table), view_range));
                 }
             },
             SortedRunView::Borrowed(tables, r) => loop {
-                let table = tables.pop_front()?;
+                let table = match order {
+                    IterationOrder::Ascending => tables.pop_front()?,
+                    IterationOrder::Descending => tables.pop_back()?,
+                };
                 if let Some(view_range) = table.calculate_view_range(BytesRange::from_slice(*r)) {
                     return Some(SstView::Borrowed(table, view_range));
                 }
@@ -50,7 +58,8 @@ impl<'a> SortedRunView<'a> {
         sst_tracing_context: Option<SstTracingContext>,
         db_stats: Option<DbStats>,
     ) -> Result<Option<SstIterator<'a>>, SlateDBError> {
-        let next_iter = if let Some(view) = self.pop_sst() {
+        let order = sst_iterator_options.order;
+        let next_iter = if let Some(view) = self.pop_sst(order) {
             Some(SstIterator::new_with_stats(
                 view,
                 table_store,
@@ -64,21 +73,67 @@ impl<'a> SortedRunView<'a> {
         Ok(next_iter)
     }
 
-    fn peek_next_table(&self) -> Option<&SsTableView> {
+    /// The table that [`Self::pop_sst`] will consider next, without popping it.
+    fn peek_next_table(&self, order: IterationOrder) -> Option<&SsTableView> {
         match self {
-            SortedRunView::Owned(tables, _) => tables.front(),
-            SortedRunView::Borrowed(tables, _) => tables.front().copied(),
+            SortedRunView::Owned(tables, _) => match order {
+                IterationOrder::Ascending => tables.front(),
+                IterationOrder::Descending => tables.back(),
+            },
+            SortedRunView::Borrowed(tables, _) => match order {
+                IterationOrder::Ascending => tables.front().copied(),
+                IterationOrder::Descending => tables.back().copied(),
+            },
+        }
+    }
+}
+
+/// The state a descending scan needs on top of the SST chain.
+///
+/// A descending scan visits the SSTs from last to first, which inverts the
+/// sequence order of a key that spans an SST boundary: the earlier SST holds
+/// that key's higher sequence numbers but is reached last. The scan
+/// therefore gathers every entry of a key before emitting any of it. See
+/// [`SortedRunIterator::buffer_next_descending_key`].
+#[derive(Default)]
+struct DescendingIteratorState {
+    /// A complete key, in emission order, ready to be returned.
+    current_key_entries: VecDeque<RowEntry>,
+    /// The first entry of the next key, read while finding the end of the
+    /// current key.
+    next_key_first_entry: Option<RowEntry>,
+}
+
+impl DescendingIteratorState {
+    /// Adds what one table contributed to the current key. An earlier table
+    /// holds the higher sequence numbers but is read later, so each
+    /// contribution goes in front of the ones already gathered.
+    fn prepend_table_entries(&mut self, entries: Vec<RowEntry>) {
+        for entry in entries.into_iter().rev() {
+            self.current_key_entries.push_front(entry);
         }
     }
 }
 
+/// Iterates the SSTs of a sorted run in the order r
```

**File**: `slatedb/tests/scan_model.rs` (added, +227/-0)
```diff
@@ -0,0 +1,227 @@
+//! End-to-end scan tests that compare a `Db` against a `BTreeMap` model.
+//!
+//! The fixture deliberately drives compaction so that a key's versions end up
+//! split across the SSTs of a sorted run, which is the layout a descending scan
+//! has to reassemble. Both the blocks and the SSTs are tiny to have
+//! compaction split keys across multiple SSTs.
+
+#![allow(clippy::disallowed_types, clippy::disallowed_methods)]
+
+use std::collections::BTreeMap;
+use std::ops::Bound::{self, Included, Unbounded};
+use std::sync::Arc;
+use std::time::Duration;
+
+use bytes::Bytes;
+use proptest::prelude::*;
+use proptest::test_runner::{Config, TestRunner};
+use slatedb::config::{
+    CompactionWorkerOptions, CompactorOptions, ScanOptions, Settings,
+    SizeTieredCompactionSchedulerOptions,
+};
+use slatedb::object_store::{memory::InMemory, ObjectStore};
+use slatedb::size_tiered_compaction::SizeTieredCompactionSchedulerSupplier;
+use slatedb::{CompactorBuilder, Db, IterationOrder, SstBlockSize};
+use tokio::runtime::Runtime;
+
+/// The alphabet writes draw keys from. Deliberately tiny, so a short op
+/// sequence still puts many versions on each key. That is what lets compaction
+/// split one key's versions across SSTs.
+const KEY_ALPHABET: u8 = 8;
+
+/// A write applied to both the db and the model.
+#[derive(Debug, Clone)]
+enum ScanOp {
+    Put(Bytes, Bytes),
+    Delete(Bytes),
+    Flush,
+    /// Flush to L0 and compact it into a sorted run.
+    Compact,
+}
+
+fn scan_ops(max_ops: usize) -> impl Strategy<Value = Vec<ScanOp>> {
+    let key = (0..KEY_ALPHABET).prop_map(|byte| Bytes::from(vec![byte]));
+    // Padded so a handful of versions fills a 1KiB block, which is what makes
+    // the compactor roll over to a new SST partway through a key.
+    let value = proptest::collection::vec(any::<u8>(), 64..=128).prop_map(Bytes::from);
+    // Relative weights. Puts dominate so each key piles up versions, which is
+    // what gives compaction something to split across SSTs. Flush moves the
+    // memtable into L0 and Compact folds L0 into a sorted run, so a scan has to
+    // merge all three.
+    let op = prop_oneof![
+        6 => (key.clone(), value).prop_map(|(k, v)| ScanOp::Put(k, v)),
+        2 => key.prop_map(ScanOp::Delete),
+        1 => Just(ScanOp::Flush),
+        1 => Just(ScanOp::Compact),
+    ];
+    proptest::collection::vec(op, 1..=max_ops)
+}
+
+type KeyRange = (Bound<Bytes>, Bound<Bytes>);
+
+/// Ranges to scan. Mixes arbitrary bounded ranges with single-key ranges drawn
+/// from the same alphabet the writes use, so the point-range path is exercised
+/// against keys that actually exist rather than always landing in a gap.
+fn scan_range() -> impl Strategy<Value = KeyRange> {
+    // Bounds are drawn from the key alphabet (plus one past its end) rather
+    // than the whole byte space. Random 1-2 byte bounds over an 8 key space
+    // land above every key almost every time, which makes for ranges that
+    // scan nothing.
+    let bound = prop_oneof![
+        3 => (0..=KEY_ALPHABET).prop_map(|byte| Included(Bytes::from(vec![byte]))),
+        1 => Just(Unbounded),
+    ];
+    // Mostly bounded ranges, with a quarter of them single-key so the point
+    // range path is covered.
+    prop_oneof![
+        3 => (bound.clone(), bound).prop_filter_map("non-empty range", |(start, end)| {
+            match (&start, &end) {
+                (Included(s), Included(e)) if s > e => None,
+                _ => Some((start, end)),
+            }
+        }),
+        1 => (0..KEY_ALPHABET).prop_map(|byte| {
+            let key = Bytes::from(vec![byte]);
+            (Included(key.clone()), Included(key))
+        }),
+    ]
+}
+
+async fn open_db(path: &str) -> Db {
+    let object_store: Arc<dyn ObjectStore> = Arc::new(InMemory::new());
+    let settings = Settings {
+        manifest_poll_interval: Duration::from_millis(10),
+        // Load-bearing: bigger L0 SSTs mean compaction never splits a key
+        // across the sorted run's SSTs, and the spanning guard below fails.
+        l0_sst_size_bytes: 1024,
+        l0_max_ssts: 10_000,
+        l0_max_ssts_per_key: 10_000,
+        ..Settings::default()
+    };
+    let compactor_options = CompactorOptions {
+        // Every interval here defaults to seconds, which would dominate the
+        // cost of a test that compacts once per case.
+        poll_interval: Duration::from_millis(1),
+        commit_compacted_interval: Duration::from_millis(1),
+        scheduler_options: SizeTieredCompactionSchedulerOptions {
+            min_compaction_sources: 1,
+            ..Default::default()
+        }
+        .into(),
+        worker: Some(CompactionWorkerOptions {
+            // The worker polls for jobs on its own interval, which also
+            // defaults to 5 seconds.
+            compactions_poll_interval: Duration::from_millis(1),
+            max_sst_size: 64,
+            ..Default::default()
+        }
```

**File**: `website/src/content/docs/docs/operations/data-modeling.mdx` (modified, +12/-5)
```diff
@@ -65,12 +65,19 @@ keys (in sort order) are served from cache without hitting object storage.
 sort order. This is why hierarchical key designs (like `tenant:user:resource`)
 work well—related data shares prefixes and lands in the same blocks.
 
-### Forward-Only Iteration
+### Iteration Order
 
-SlateDB currently supports only forward (ascending) iteration. If your access
-pattern requires descending order (e.g., "most recent first"), you must encode
-keys to sort in reverse order. See the [Descending Order](#descending-order)
-pattern below.
+SlateDB supports both ascending and descending iteration through the
+`ScanOptions` API. Use `with_order(IterationOrder::Descending)` for
+descending scans (e.g., "most recent first").
+
+Note that the `seek` API is not yet supported for descending scans. It returns
+a `SeekNotSupportedForDescendingScan` error. If you need to reposition a
+descending iterator, you must create a new scan with an adjusted range.
+
+The [Descending Order](#descending-order) pattern below remains useful when
+you want reverse chronological ordering as the natural sort order of your
+keys, regardless of scan direction.
 
 ## Encoding Primitive Types
 
```

---

### Incident Patch 15: `114509a8` (2026-09-10)
**Commit Message**: fix clippy issues when no cache feature enabled (#2090)

**File**: `slatedb/Cargo.toml` (modified, +5/-0)
```diff
@@ -144,6 +144,7 @@ harness = false
 [[bench]]
 name = "scan_prefix_bench"
 harness = false
+required-features = ["foyer"]
 
 [[bench]]
 name = "scan_prefix_large_sorted_run_bench"
@@ -165,3 +166,7 @@ harness = false
 
 [lints]
 workspace = true
+
+[[test]]
+name = "foyer_cache_flush"
+required-features = ["foyer"]
\ No newline at end of file
```

**File**: `slatedb/src/db_cache/mod.rs` (modified, +71/-51)
```diff
@@ -5,7 +5,7 @@
 //!
 //! There are currently two built-in cache implementations:
 //! - [Foyer](crate::db_cache::foyer::FoyerCache): Requires the `foyer` feature flag. (Enabled by default)
-//! - [Moka](crate::db_cache::moka::MokaCache): Requires the `moka` feature flag. (Enabled by default)
+//! - [Moka](crate::db_cache::moka::MokaCache): Requires the `moka` feature flag.
 //!
 //! ## Usage
 //!
@@ -1290,10 +1290,18 @@ mod tests {
 
     use crate::flatbuffer_types::test_utils::assert_index_clamped;
 
+    #[cfg(feature = "foyer")]
+    use super::foyer::FoyerCache;
+    #[cfg(feature = "foyer")]
+    use super::foyer_hybrid::FoyerHybridCache;
+    #[cfg(feature = "moka")]
+    use super::moka::MokaCache;
     use crate::db_cache::test_utils::TestCache;
     use crate::format::sst::{EncodedSsTable, SsTableFormat};
     use crate::test_utils::build_test_sst;
     use crate::types::{RowEntry, ValueDeletable};
+    #[cfg(feature = "foyer")]
+    use foyer::HybridCacheBuilder;
     use rstest::{fixture, rstest};
     use slatedb_common::metrics::{
         lookup_metric_with_labels, DefaultMetricsRecorder, MetricLevel, MetricsRecorderHelper,
@@ -1413,65 +1421,77 @@ mod tests {
         }
     }
 
+    #[rstest]
+    #[case::test_cache(Arc::new(TestCache::new()), true)]
+    #[case::split_cache(Arc::new(SplitCache::new()), false)]
+    #[case::split_cache_with_delegates(
+        Arc::new(
+            SplitCache::new()
+                .with_block_cache(Some(Arc::new(TestCache::new())))
+                .with_meta_cache(Some(Arc::new(TestCache::new())))
+        ),
+        true
+    )]
+    #[cfg_attr(feature = "foyer", case::foyer(Arc::new(FoyerCache::new()), true))]
+    #[cfg_attr(
+        feature = "foyer",
+        case::foyer_hybrid(
+            Arc::new(FoyerHybridCache::new_with_cache(
+                HybridCacheBuilder::new()
+                    .memory(1024 * 1024)
+                    .with_weighter(|_, v: &CachedEntry| v.size())
+                    .storage()
+                    .build()
+                    .await
+                    .unwrap()
+            )),
+            true
+        )
+    )]
+    #[cfg_attr(feature = "moka", case::moka(Arc::new(MokaCache::new()), true))]
     #[tokio::test]
-    async fn test_fetch_lookup_outcomes() {
-        let mut caches: Vec<(Arc<dyn DbCache>, bool)> = vec![
-            (Arc::new(TestCache::new()), true),
-            (Arc::new(SplitCache::new()), false),
-            (
-                Arc::new(
-                    SplitCache::new()
-                        .with_block_cache(Some(Arc::new(TestCache::new())))
-                        .with_meta_cache(Some(Arc::new(TestCache::new()))),
-                ),
-                true,
-            ),
-        ];
-        #[cfg(feature = "foyer")]
-        caches.push((Arc::new(super::foyer::FoyerCache::new()), true));
-        #[cfg(feature = "moka")]
-        caches.push((Arc::new(super::moka::MokaCache::new()), true));
-
-        for (cache, retains_entries) in caches {
-            for (offset, method) in ["data_block", "index", "filter", "stats"]
-                .into_iter()
-                .enumerate()
-            {
-                let key = CachedKey::from((SST_ID, offset as u64));
-                let mut builder = BlockBuilder::new_latest(4096);
-                assert!(builder
-                    .add(RowEntry::new_value(b"key", b"value", 0))
-                    .unwrap());
-                let block = Arc::new(builder.build().unwrap());
-                for attempt in 0..2 {
-                    let entry = CachedEntry::with_block(block.clone());
-                    let loader: CacheLoader = Box::new(move || Box::pin(async move { Ok(entry) }));
-                    let fetch = match method {
-                        "data_block" => cache.fetch_block(key.clone(), loader).await,
-                        "index" => cache.fetch_index(key.clone(), loader).await,
-                        "filter" => cache.fetch_filter(key.clone(), loader).await,
-                        "stats" => cache.fetch_stats(key.clone(), loader).await,
-                        _ => unreachable!(),
-                    }
-                    .unwrap();
-                    assert_eq!(
-                        fetch.lookup,
-                        if attempt == 0 || !retains_entries {
-                            CacheLookup::Miss
-                        } else {
-                            CacheLookup::Hit
-                        }
-                    );
-                    assert_eq!(fetch.entry.block().unwrap().size(), block.size());
+    async fn test_fetch_lookup_outcomes(
+        #[case] cache: Arc<dyn DbCache>,
+        #[case] retains_entries: bool,
+    ) {
+        for (offset, method) in ["data_block", "index", "filter", "stats"]
+            .into_iter()
+            .enumerate()
+        {
+            let key = CachedKey::from((SST_ID, offset as u64));
+            let mut builder = BlockBuilder::n
```

#### Recent Merged Pull Requests:
- **PR #2143** (2026-10-02): fix: initialize clone retention boundaries (@geeknarrator)
- **PR #2142** (2026-10-05): move ownership of next_wal_id to manifest writer (@rodesai)
- **PR #2141** (2026-10-05): retrying_object_store: jitter retry backoff (@aramalipoor)
- **PR #2140** (2026-10-01): sst_iter: abort in-flight block fetches when an iterator is dropped (@aramalipoor)
- **PR #2138** (2026-10-01): Make Db::snapshot and Db::begin synchronous (@rockwotj)
- **PR #2137** (2026-09-30): slatedb-dst: remove unnecessary path qualifications (@criccomini)
- **PR #2135** (2026-09-29): ci(python): drop s390x wheel build (@criccomini)
- **PR #2134** (2026-09-29): fix: preserve unread views when merging compaction watermarks (@geeknarrator)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
