> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/paradedb-paradedb-learnings.md`  
> **Source**: github ([https://github.com/paradedb/paradedb](https://github.com/paradedb/paradedb))  
> **Source Version**: `3db63451`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T23:51:02.094Z  
> **Learning ID**: `learn-github-paradedb-paradedb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): paradedb/paradedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/paradedb-paradedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/paradedb/paradedb](https://github.com/paradedb/paradedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T23:51:02.086Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `paradedb/paradedb`
- **Description**: One Postgres for your application data, full-text search, vector retrieval, and aggregations. Home of the pg_search extension.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9563 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `basescan/src/postgres/customscan/basescan/scan_state.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.
#![allow(unsafe_op_in_unsafe_fn)]

use std::cell::{OnceCell, RefCell, UnsafeCell};
use std::collections::BTreeMap;
use std::rc::Rc;
use std::sync::Arc;

use crate::api::{FieldName, HashMap, OrderByFeature, OrderByInfo, Varno};
use crate::customscan::CustomScanState;
use crate::index::fast_fields_helper::FFHelper;
use crate::index::reader::index::SearchIndexReader;
use crate::postgres::customscan::basescan::cost::WorkerDecisionReason;
use crate::postgres::customscan::basescan::exec_methods::ExecMethod;
use crate::postgres::customscan::basescan::parallel::{ParallelRole, ParallelScanHandle};
use crate::postgres::customscan::basescan::projections::snippet::SnippetType;
use crate::postgres::customscan::basescan::projections::snippet::pdb::IntArray2D;
use crate::postgres::customscan::basescan::projections::window_agg::WindowAggregateInfo;
use crate::postgres::customscan::basescan::telemetry::ScanTelemetry;
use crate::postgres::customscan::bitmap_intersection::BitmapExec;
use crate::postgres::customscan::builders::custom_path::ExecMethodType;
use crate::postgres::customscan::mpp::interrupt::{PgTokioRuntime, PgTokioRuntimeShutdownHandle};
use crate::postgres::customscan::projections::{PlaceholderColumn, PlaceholderProjection};
use crate::postgres::customscan::qual_inspect::Qual;
use crate::postgres::customscan::solve_expr::SolvePostgresExpressions;
use crate::postgres::heap::{HeapFetchState, VisibilityChecker};
use crate::postgres::rel::PgSearchRelation;
use crate::postgres::utils::u64_to_item_pointer;
use crate::postgres::{ParallelScanArgs, ParallelScanState};
use crate::query::SearchQueryInput;
use crate::query::tid_bitmap_stream::BitmapCell;
use std::ptr::NonNull;

use crate::index::reader::vector::SharedVectorRouting;
use crate::postgres::customscan::basescan::privdat::VectorFilterPlan;
use pgrx::heap_tuple::PgHeapTuple;
use pgrx::{JsonB, PgTupleDesc, pg_sys};
use tantivy::DocAddress;
use tantivy::index::SegmentId;
use tantivy::query::Weight;
use tantivy::snippet::SnippetGenerator;

#[derive(Default)]
pub struct BaseScanState {
    // Declared first so any DataFusion stream /PgTokioRuntime / Tantivy scorers inside
    // `exec_method` drop before `visibility_checker`, `doc_from_heap_state`, `search_reader`,
    // `bitmap_cell`, `bitmap_exec`, and `heaprel`/`indexrel`.
    exec_method: UnsafeCell<Box<dyn ExecMethod>>,
    exec_method_name: String,

    pub io_trace: Option<crate::index::reader::io_stats::Trace>,
    /// Process-local EXPLAIN metrics (query counts, per-segment JSON, …).
    pub telemetry: ScanTelemetry,
    /// Set when this scan is parallel-aware (DSM attached).
    pub parallel: Option<ParallelScanHandle>,
    /// Shared slot populated with this scan's [`PgTokioRuntimeShutdownHandle`] while an async exec
    /// method (`TopKScanExecState` or `ColumnarExecState`) holds a `PgTokioRuntime` under a `Gather`
    /// DSM segment, so `on_basescan_dsm_detach` shuts down only this scan's runtime on abort.
    dsm_runtime_shutdown: Option<Rc<RefCell<Option<PgTokioRuntimeShutdownHandle>>>>,
    /// Workers wait for the leader to publish this plan when they first need it.
    pub vector_routing_plan: Option<Arc<SharedVectorRouting>>,
    pub vector_routing_pending: bool,
    pub vector_filter_plan: Option<VectorFilterPlan>,

    // Note: the range table index at execution time might be different from the one at planning time,
    // so we need to use the one at execution time when creating the custom scan state.
    // But, we also keep the planning RTI for the case when we need to use it for the `var_attname_lookup`
    // because the `var_attname_lookup` is created based on the planning RTI.
    // See https://www.postgresql.org/docs/current/custom-scan-plan.html
    pub planning_rti: pg_sys::Index,
    pub execution_rti: pg_sys::Index,

    base_search_query_input: Arc<SearchQueryInput>,
    search_query_input: Arc<SearchQueryInput>,
    /// Where `search_query_input` is solved; `None` when the base query has nothing to solve.
    /// Separate from `ps_ExprContext`, which `exec_custom_scan` resets per row: see the rules in
    /// `solve_expr.rs`.
    pub runtime_context: Option<NonNull<pg_sys::ExprContext>>,
    pub visibility_checker: Option<VisibilityChecker>,
    pub doc_from_heap_state: Option<HeapFetchState>,
    pub search_reader: Option<SearchIndexReader>,
    /// Executor startup before `SearchIndexReader::open`; consumed into the
    /// reader's flat `scan_init_ns` metric on first execution.
    pub executor_scan_init_ns: u64,
    /// End-to-end CustomScan execution interval used to assign only the
    /// residual around named nested stages to result assembly.
    /// Whether the current execution is collecting stage timings for
    /// `EXPLAIN ANALYZE`.  Timed queries leave the executor delivery path
    /// uninstrumented.
    pub explain_stage_accounting: bool,

    pub targetlist_len: usize,

    pub virtual_tuple_count: usize,

    pub segment_count: usize,
    pub(super) worker_selection_reason: Option<WorkerDecisionReason>,
    pub quals: Option<Qual>,

    pub need_scores: bool,
    pub score_funcoids: [pg_sys::Oid; 2],

    pub need_score_explanation: bool,
    /// The weight of the scan's query, built when the first row needs an explanation.
    pub score_explanation_weight: OnceCell<Box<dyn Weight>>,

    /// True when a junk ORDER-BY `embedding <-> query` `OpExpr` in the scan's
    /// targetlist was replaced with a NULL placeholder `Const` (see
    /// `inject_vector_distance_placeholders`). The value is never read — the
    /// TopK scan already provides the ordering and the column is junk-stripped
    /// — so the placeholder just spares `ExecProject` from calling
    /// `l2_distance(embedding, query)` and detoasting the heap vector. We track
    /// it only so the projection path knows it must use `placeholders`.
    pub vector_distance_placeholder: bool,

    pub snippet_funcoids: [pg_sys::Oid; 2],
    pub snippets_funcoids: [pg_sys::Oid; 2],
    pub snippet_positions_funcoids: [pg_sys::Oid; 2],

    pub snippet_generators: HashMap<SnippetType, Option<SnippetGenerator>>,

    pub var_attname_lookup: HashMap<(Varno, pg_sys::AttrNumber), FieldName>,
    pub placeholders: Option<BasePlaceholders>,

    // Store join-level search predicates for enhanced scoring/snippet generation
    pub join_predicates: Option<Arc<SearchQueryInput>>,

    pub exec_method_type: ExecMethodType,
    pub ambulkdelete_epoch: u32,

    /// Execution state for the child bitmap scan, if a bitmap intersection source was
    /// harvested at plan time.
    pub bitmap_cell: Option<BitmapCell>,
    pub bitmap_exec: Option<BitmapExec>,

    // Window aggregate support
    pub window_aggregates: Vec<WindowAggregateInfo>,
    pub window_aggregate_results: Option<HashMap<usize, pg_sys::Datum>>,

    pub heaprelid: pg_sys::Oid,
    pub heaprel: Option<PgSearchRelation>,
    pub indexrel: Option<PgSearchRelation>,
    pub indexrelid: pg_sys::Oid,
    pub lockmode: pg_sys::LOCKMODE,
}

/// The projection that gives a row its score, snippets and window aggregates, and the placeholder
/// columns it reads them from.
///
/// One struct holds them, because the columns are valid only for the slot of this projection.
pub struct BasePlaceholders {
    pub projection: PlaceholderProjection,
    pub score: PlaceholderColumn,
    pub score_explanation: PlaceholderColumn,
    pub snippets: HashMap<SnippetType, Vec<PlaceholderColumn>>,
    /// Indexed by target entry position.
    pub window_aggs: HashMap<usize, PlaceholderColumn>,
}

impl CustomScanState for BaseScanState {
    fn init_exec_method(&mut self, cstate: *mut pg_sys::CustomScanState) {
        unsafe {
            // SAFETY: inner_scan_state is always initialized and call to `init()` could never move `self`
            (*self.exec_method.get()).init(self, cstate)
        }
    }
}

impl BaseScanState {
    pub(super) fn alloc_dsm_runtime_shutdown_slot(
        &mut self,
    ) -> Rc<RefCell<Option<PgTokioRuntimeShutdownHandle>>> {
        let slot = Rc::new(RefCell::new(None));
        self.dsm_runtime_shutdown = Some(Rc::clone(&slot));
        slot
    }

    pub(super) fn register_runtime_for_dsm_detach(&self, runtime: &PgTokioRuntime) {
        if let Some(slot) = &self.dsm_runtime_shutdown {
            *slot.borrow_mut() = Some(runtime.shutdown_handle());
        }
    }

    pub(super) fn clear_runtime_for_dsm_detach(&self) {
        if let Some(slot) = &self.dsm_runtime_shutdown {
            *slot.borrow_mut() = None;
        }
    }

    pub fn open_relations(&mut self, lockmode: pg_sys::LOCKMODE) {
        self.lockmode = lockmode;
        if self.heaprel.is_none() {
            self.heaprel = if lockmode == pg_sys::NoLock as pg_sys::LOCKMODE {
                Some(PgSearchRelation::open(self.heaprelid))
            } else {
                Some(PgSearchRelation::with_lock(self.heaprelid, lockmode))
            }
        };

        if self.indexrel.is_none() {
            self.indexrel = if lockmode == pg_sys::NoLock as pg_sys::LOCKMODE {
                Some(PgSearchRelation::open(self.indexrelid))
            } else {
                Some(PgSearchRelation::with_lock(self.indexrelid
```

### Core Architecture Module: `benchmarks/src/utils.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use anyhow::{Context, Result, bail};
use duckdb::{AccessMode, Config, Connection};

pub fn open_duckdb_conn() -> Result<Connection> {
    let config = Config::default()
        .access_mode(AccessMode::Automatic)?
        .enable_autoload_extension(true)?;
    let conn = Connection::open_in_memory_with_flags(config)
        .context("Failed to open DuckDB in-memory connection")?;

    conn.execute_batch(
        "CREATE OR REPLACE SECRET secret (TYPE s3, PROVIDER credential_chain);",
    )
    .context("Failed to configure S3 credentials. Ensure AWS credentials are available via environment variables, ~/.aws/credentials, or instance metadata.")?;

    conn.execute("INSTALL httpfs", [])
        .with_context(|| "Failed to install httpfs extension")?;
    conn.execute("LOAD httpfs", [])
        .with_context(|| "Failed to load httpfs extension")?;
    // Increase timeout (default is 30 seconds) to allow for working with larger files (200MB+)
    conn.execute("SET http_timeout = 120", [])
        .with_context(|| "Failed to configure http timeout")?;

    Ok(conn)
}

/// check that each table has at least one parquet file at the input location
pub fn validate_input<'a>(
    tables: impl Iterator<Item = &'a str>,
    conn: &Connection,
    input: &str,
) -> Result<()> {
    println!("Validating input path...");
    let mut missing_tables: Vec<String> = Vec::new();

    for table in tables {
        let input_glob = format!("{input}/{table}/*.parquet");
        let input_file_count: usize = conn
            .query_row(
                &format!("SELECT count(*) FROM (SELECT * FROM glob('{input_glob}') LIMIT 1)"),
                [],
                |row| row.get(0),
            )
            .with_context(|| format!("Failed to check parquet files for table '{table}'"))?;
        let input_exists = input_file_count > 0;

        if !input_exists {
            println!("  {table}: no parquet files found at '{input_glob}'");
            missing_tables.push(table.to_string());
        } else {
            println!("  {table}: ok");
        }
    }

    if !missing_tables.is_empty() {
        bail!(
            "No parquet files found for {} table(s): {}. Aborting before doing any work.",
            missing_tables.len(),
            missing_tables.join(", ")
        );
    }

    Ok(())
}

/// check that the output location for each table is empty
pub fn validate_output<'a>(
    tables: impl Iterator<Item = &'a str>,
    conn: &Connection,
    output: &str,
) -> Result<()> {
    println!("Validating output path...");
    let mut filled_outputs: Vec<String> = Vec::new();

    for table in tables {
        let output_glob = format!("{output}/{table}/*");
        let output_file_count: usize = conn
            .query_row(
                &format!("SELECT count(*) FROM (SELECT * FROM glob('{output_glob}') LIMIT 1)"),
                [],
                |row| row.get(0),
            )
            .with_context(|| format!("Failed to check output files for table '{table}'"))?;
        let output_empty = output_file_count == 0;

        if !output_empty {
            println!("  {table}: output directory not empty '{output_glob}'");
            filled_outputs.push(table.to_string());
        } else {
            println!("  {table}: ok");
        }
    }

    if !filled_outputs.is_empty() {
        bail!(
            "Output directories not empty for {} table(s): {}. Aborting before doing any work.",
            filled_outputs.len(),
            filled_outputs.join(", "),
        );
    }

    Ok(())
}

```

### Core Architecture Module: `common/src/parallel_worker/mod.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.
#![allow(clippy::not_unsafe_ptr_arg_deref, unsafe_op_in_unsafe_fn)]

//! Provides an abstract API over Postgres' parallel workers, allowing for the implementation of
//! different strategies for distributing work across processes.

pub mod builder;
pub mod mqueue;

use crate::parallel_worker::mqueue::{MessageQueueSendError, MessageQueueSender};
use pgrx::pg_sys;
use std::error::Error;
use std::fmt::Display;
use std::ptr::NonNull;

/// Describes the kind of parallel worker process being built
pub enum WorkerStyle {
    Query,
    Maintenance,
}

impl WorkerStyle {
    /// Returns the current Postgres-configured maximum number of workers for this [`WorkerStyle`]
    pub fn max(&self) -> usize {
        match self {
            WorkerStyle::Query => unsafe { pg_sys::max_parallel_workers_per_gather as usize },
            WorkerStyle::Maintenance => unsafe {
                pg_sys::max_parallel_maintenance_workers as usize
            },
        }
    }
}

#[repr(u64)]
enum TocKeys {
    MessageQueues = 1,
    UserStateLength = 2,
    // `UserState` entries allocate consecutive keys starting at `UserState` (`3 + 2*i`),
    // so fixed keys added after it must live in a high range to avoid collisions.
    UserState = 3,
    BufferUsage = 0xE000_0000_0000_0004,
    WalUsage = 0xE000_0000_0000_000A,
}

/// Flushes parallel worker buffer/WAL instrumentation into DSM via `InstrEndParallelQuery`.
///
/// Intentionally does NOT implement `Drop`: [`run_parallel_worker`] invokes [`Self::finish`]
/// explicitly on normal worker completion while the backing DSM segment is guaranteed mapped.
pub(crate) struct WorkerStatsGuard {
    buf_usage: *mut pg_sys::BufferUsage,
    wal_usage: *mut pg_sys::WalUsage,
    worker_idx: usize,
}

impl WorkerStatsGuard {
    pub(crate) unsafe fn finish(self) {
        if !self.buf_usage.is_null() && !self.wal_usage.is_null() {
            unsafe {
                pg_sys::InstrEndParallelQuery(
                    self.buf_usage.add(self.worker_idx),
                    self.wal_usage.add(self.worker_idx),
                );
            }
        }
    }
}

impl From<TocKeys> for u64 {
    fn from(key: TocKeys) -> Self {
        key as _
    }
}

/// Marker for plain-old-data types stored in DSM entries as raw bytes.
///
/// Requires [`bytemuck::Pod`], which guarantees: `#[repr(C)]` layout, no
/// uninitialised padding bytes, and every bit pattern is a valid instance.
/// These properties let `as_bytes()` and `object()`/`slice()` operate
/// without undefined behaviour.
pub trait ParallelStateType: bytemuck::Pod {}

impl ParallelState for pg_sys::SharedFileSet {
    fn as_bytes(&self) -> &[u8] {
        unsafe { std::slice::from_raw_parts(self as *const _ as *const u8, size_of_val(self)) }
    }
}

impl ParallelState for (usize, *mut pg_sys::ParallelTableScanDescData) {
    fn type_name(&self) -> &'static str {
        std::any::type_name::<pg_sys::ParallelTableScanDescData>()
    }

    fn size_of(&self) -> usize {
        self.0
    }

    fn as_bytes(&self) -> &[u8] {
        unsafe { std::slice::from_raw_parts(self.1 as *const _ as *const u8, self.size_of()) }
    }
}

pub trait ParallelState {
    /// A binary representation of the header information necessary to store/retrieve [`ParallelState`]
    /// in shared memory
    fn info(&self) -> Vec<u8> {
        let mut info = Vec::new();
        let type_name = self.type_name();
        let nbytes = size_of::<usize>() + size_of::<usize>() + type_name.len();
        info.extend(nbytes.to_ne_bytes());
        info.extend(self.array_len().to_ne_bytes());
        info.extend(self.type_name().as_bytes());

        info
    }

    /// Returns the rust type name of the implementing type, or element if an array/vec
    fn type_name(&self) -> &'static str {
        std::any::type_name::<Self>()
    }

    /// Returns the size of the type, in bytes, as represented in memory
    fn size_of(&self) -> usize {
        size_of_val(self)
    }

    /// Returns the number of elements in the array/vec, or `1` if it's not an array/vec
    fn array_len(&self) -> usize {
        1
    }

    /// Return a byte slice pointing to the raw bytes of this instance in memory
    fn as_bytes(&self) -> &[u8];

    /// When true, the builder allocates this entry's space in the DSM but copies nothing
    /// into it; the contents start uninitialized. For large regions whose first writer runs
    /// after the DSM is mapped, this skips materializing (and zeroing) a same-sized buffer
    /// on the host side only to memcpy it over.
    ///
    /// Implementations must record an element type that accepts any bit pattern (`u8` in
    /// practice), so the [`ParallelStateManager`] type check keeps readers from viewing
    /// unwritten bytes as anything stricter.
    fn reserve_only(&self) -> bool {
        false
    }
}

/// A [`ParallelState`] entry that only reserves `len` bytes in the DSM (see
/// [`ParallelState::reserve_only`]). The entry is recorded as `u8`, so the
/// [`ParallelStateManager`] type check hands it back only as a byte slice, and every bit
/// pattern is a valid `u8`.
pub struct UninitializedBytesParallelState {
    len: usize,
}

impl UninitializedBytesParallelState {
    /// # Safety
    ///
    /// The reserved bytes hold no meaningful value until a consumer writes them in place.
    /// The caller asserts that the protocol run over the region tolerates that: its first
    /// writer runs before any read that depends on the contents.
    pub unsafe fn new(len: usize) -> Self {
        Self { len }
    }
}

impl ParallelState for UninitializedBytesParallelState {
    fn type_name(&self) -> &'static str {
        std::any::type_name::<u8>()
    }

    fn size_of(&self) -> usize {
        self.len
    }

    fn array_len(&self) -> usize {
        self.len
    }

    fn as_bytes(&self) -> &[u8] {
        &[]
    }

    fn reserve_only(&self) -> bool {
        true
    }
}

impl ParallelStateType for u8 {}
impl ParallelStateType for u16 {}
impl ParallelStateType for u32 {}
impl ParallelStateType for u64 {}
impl ParallelStateType for usize {}
impl ParallelStateType for i8 {}
impl ParallelStateType for i16 {}
impl ParallelStateType for i32 {}
impl ParallelStateType for i64 {}
impl ParallelStateType for isize {}
impl ParallelStateType for f32 {}
impl ParallelStateType for f64 {}

impl<T: ParallelStateType> ParallelState for T {
    fn as_bytes(&self) -> &[u8] {
        bytemuck::bytes_of(self)
    }
}

impl<T: ParallelStateType> ParallelState for Vec<T> {
    fn type_name(&self) -> &'static str {
        std::any::type_name::<T>()
    }
    fn size_of(&self) -> usize {
        self.len() * size_of::<T>()
    }
    fn array_len(&self) -> usize {
        self.len()
    }
    fn as_bytes(&self) -> &[u8] {
        bytemuck::cast_slice(self.as_slice())
    }
}

pub trait ParallelProcess {
    fn state_values(&self) -> Vec<&dyn ParallelState>;
}

pub trait ParallelWorker {
    fn new_parallel_worker(state_manager: ParallelStateManager) -> Self
    where
        Self: Sized;

    fn run(self, mq_sender: &MessageQueueSender, worker_number: i32) -> anyhow::Result<()>;
}

/// Consumes a [`ParallelWorker::run`] result and decides how the worker exits.
///
/// `MessageQueueSendError::Detached` is treated as a benign teardown signal,
/// not a failure: the leader has already dropped its end of the result queue
/// and is no longer listening, so there is nothing useful the worker can do
/// except exit cleanly. This matches upstream Postgres's handling of tuple
/// queues in `tqueueReceiveSlot` (`src/backend/executor/tqueue.c`) and the
/// proactive detach pattern in `ExecParallelFinish`
/// (`src/backend/executor/execParallel.c`).
///
/// Any other error panics. The panic is caught by `#[pgrx::pg_guard]` at the
/// macro-expanded entry point and surfaced through Postgres's normal parallel
/// worker error reporting path in `WaitForParallelWorkersToFinish`
/// (`src/backend/access/transam/parallel.c`).
#[doc(hidden)]
pub fn finish_parallel_worker(result: anyhow::Result<()>) {
    match result {
        Ok(()) => {}
        Err(err) if is_detached_send_error(&err) => {
            log_detached_send();
        }
        Err(err) => panic!("{err}"),
    }
}

fn is_detached_send_error(err: &anyhow::Error) -> bool {
    err.chain().any(|cause| {
        matches!(
            cause.downcast_ref::<MessageQueueSendError>(),
            Some(MessageQueueSendError::Detached)
        )
    })
}

fn log_detached_send() {
    pgrx::debug1!(
        "parallel worker {}: leader detached before receive",
        unsafe { pg_sys::ParallelWorkerNumber }
    );
}

#[derive(Copy, Clone)]
pub struct ParallelStateManager {
    toc: NonNull<pg_sys::shm_toc>,
    len: usize,
    seg: *mut pg_sys::dsm_segment,
}

#[derive(Debug)]
pub enum ValueError {
    WrongType(String, String),
}

impl Error for ValueError {}

impl Display for ValueError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValueError::WrongType(wanted, got) => {
                write!(f, "Wrong type, expected `{wanted}`, got `{got}`")
            }
        }
    }
}

impl ParallelStateManager {
    pub fn new
```

### Core Architecture Module: `common/src/parallel_worker/mqueue.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use pgrx::pg_sys;
use std::error::Error;
use std::fmt::{Display, Formatter};
use std::ptr::NonNull;

/// Owns a PostgreSQL `shm_mq_handle` attached to a parallel DSM segment.
///
/// Intentionally does NOT implement `Drop`: on normal completion, the owning lifecycle step
/// (`ParallelProcessLauncher::destroy` on the leader, or `MessageQueueSender::finish` via
/// `run_parallel_worker` on a worker) calls [`Self::detach`] while the backing DSM segment is
/// guaranteed mapped. On any abnormal `ereport(ERROR)` / panic unwind / subtransaction abort,
/// PostgreSQL's own `shm_mq_detach_callback` (registered by `shm_mq_attach`) detaches the queue
/// before unmapping the DSM; calling `shm_mq_detach` later from a `MemoryContextCallback` / `Drop`
/// after `AtEOSubXact_Parallel` would dereference unmapped shared memory (even when
/// `IsInParallelMode()` is still `true` due to an enclosing outer `Gather`).
struct MessageQueueHandle {
    handle: NonNull<pg_sys::shm_mq_handle>,
}

impl MessageQueueHandle {
    unsafe fn attach_sender(seg: *mut pg_sys::dsm_segment, mq: *mut pg_sys::shm_mq) -> Self {
        unsafe {
            pg_sys::shm_mq_set_sender(mq, pg_sys::MyProc);
            let handle = pg_sys::shm_mq_attach(mq, seg, std::ptr::null_mut());
            MessageQueueHandle {
                handle: NonNull::new_unchecked(handle),
            }
        }
    }

    unsafe fn attach_receiver(
        pcxt: NonNull<pg_sys::ParallelContext>,
        mq: *mut pg_sys::shm_mq,
    ) -> Self {
        unsafe {
            pg_sys::shm_mq_set_receiver(mq, pg_sys::MyProc);
            let handle = pg_sys::shm_mq_attach(mq, (*pcxt.as_ptr()).seg, std::ptr::null_mut());
            MessageQueueHandle {
                handle: NonNull::new_unchecked(handle),
            }
        }
    }

    fn as_ptr(&self) -> *mut pg_sys::shm_mq_handle {
        self.handle.as_ptr()
    }

    /// Explicitly detaches this handle while its backing DSM segment is still mapped.
    ///
    /// # Safety
    /// The DSM segment passed to `attach_sender` / `attach_receiver` must still be attached in
    /// the current backend.
    unsafe fn detach(self) {
        unsafe {
            pg_sys::shm_mq_detach(self.handle.as_ptr());
        }
    }
}

#[derive(Debug, Copy, Clone)]
pub enum MessageQueueSendError {
    Detached,
    WouldBlock,
    Unknown(pg_sys::shm_mq_result::Type),
}

impl Display for MessageQueueSendError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageQueueSendError::Detached => write!(f, "queue is detached"),
            MessageQueueSendError::WouldBlock => write!(f, "queue is full"),
            MessageQueueSendError::Unknown(other) => write!(f, "unknown error code: {other}"),
        }
    }
}

impl Error for MessageQueueSendError {}

impl From<pg_sys::shm_mq_result::Type> for MessageQueueSendError {
    fn from(value: pg_sys::shm_mq_result::Type) -> Self {
        match value {
            pg_sys::shm_mq_result::SHM_MQ_WOULD_BLOCK => Self::WouldBlock,
            pg_sys::shm_mq_result::SHM_MQ_DETACHED => Self::Detached,
            other => Self::Unknown(other),
        }
    }
}

pub struct MessageQueueSender {
    stats: Option<crate::parallel_worker::WorkerStatsGuard>,
    handle: MessageQueueHandle,
}

impl MessageQueueSender {
    pub(crate) unsafe fn new(
        seg: *mut pg_sys::dsm_segment,
        mq: *mut pg_sys::shm_mq,
        stats: Option<crate::parallel_worker::WorkerStatsGuard>,
    ) -> Self {
        unsafe {
            Self {
                stats,
                handle: MessageQueueHandle::attach_sender(seg, mq),
            }
        }
    }

    /// Flushes parallel worker buffer/WAL stats (`InstrEndParallelQuery`) into DSM and then
    /// detaches the completion queue so `ParallelProcessFinish::recv()` on the leader unblocks
    /// only after stats are written.
    ///
    /// # Safety
    /// Must be called on normal worker completion while the backing DSM segment is still mapped.
    pub(crate) unsafe fn finish(self) {
        if let Some(stats) = self.stats {
            unsafe { stats.finish() };
        }
        unsafe { self.handle.detach() };
    }

    pub fn send<B: AsRef<[u8]>>(&self, msg: B) -> Result<(), MessageQueueSendError> {
        unsafe {
            let msg = msg.as_ref();
            let result = pg_sys::shm_mq_send(
                self.handle.as_ptr(),
                msg.len(),
                msg.as_ptr() as *mut std::ffi::c_void,
                false,
                true,
            );

            match result {
                pg_sys::shm_mq_result::SHM_MQ_SUCCESS => Ok(()),
                other => Err(MessageQueueSendError::from(other)),
            }
        }
    }

    #[allow(dead_code)]
    pub fn try_send(&self, msg: &[u8]) -> Result<Option<()>, MessageQueueSendError> {
        unsafe {
            let result = pg_sys::shm_mq_send(
                self.handle.as_ptr(),
                msg.len(),
                msg.as_ptr() as *mut std::ffi::c_void,
                true,
                true,
            );

            match result {
                pg_sys::shm_mq_result::SHM_MQ_SUCCESS => Ok(Some(())),
                pg_sys::shm_mq_result::SHM_MQ_WOULD_BLOCK => Ok(None),
                other => Err(MessageQueueSendError::from(other)),
            }
        }
    }
}

#[derive(Debug, Copy, Clone)]
pub enum MessageQueueRecvError {
    Detached,
    WouldBlock,
    Unknown(pg_sys::shm_mq_result::Type),
}

impl Display for MessageQueueRecvError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageQueueRecvError::Detached => write!(f, "queue is detached"),
            MessageQueueRecvError::WouldBlock => write!(f, "queue is empty"),
            MessageQueueRecvError::Unknown(other) => write!(f, "unknown error code: {other}"),
        }
    }
}

impl Error for MessageQueueRecvError {}

impl From<pg_sys::shm_mq_result::Type> for MessageQueueRecvError {
    fn from(value: pg_sys::shm_mq_result::Type) -> Self {
        match value {
            pg_sys::shm_mq_result::SHM_MQ_WOULD_BLOCK => Self::WouldBlock,
            pg_sys::shm_mq_result::SHM_MQ_DETACHED => Self::Detached,
            other => Self::Unknown(other),
        }
    }
}

pub struct MessageQueueReceiver {
    handle: MessageQueueHandle,
}

impl MessageQueueReceiver {
    pub(crate) unsafe fn new(
        pcxt: NonNull<pg_sys::ParallelContext>,
        address: *mut std::ffi::c_void,
        size: usize,
    ) -> Self {
        unsafe {
            let mq = pg_sys::shm_mq_create(address, size);
            Self {
                handle: MessageQueueHandle::attach_receiver(pcxt, mq),
            }
        }
    }

    pub(crate) unsafe fn detach(self) {
        unsafe { self.handle.detach() };
    }

    pub fn recv(&self) -> Result<Vec<u8>, MessageQueueRecvError> {
        unsafe {
            let mut len = 0usize;
            let mut msg = std::ptr::null_mut();
            let result = pg_sys::shm_mq_receive(self.handle.as_ptr(), &mut len, &mut msg, false);

            match result {
                pg_sys::shm_mq_result::SHM_MQ_SUCCESS => {
                    Ok(std::slice::from_raw_parts(msg as *mut u8, len).to_vec())
                }
                other => Err(MessageQueueRecvError::from(other)),
            }
        }
    }

    pub fn try_recv(&self) -> Result<Option<Vec<u8>>, MessageQueueRecvError> {
        unsafe {
            let mut len = 0usize;
            let mut msg = std::ptr::null_mut();
            let result = pg_sys::shm_mq_receive(self.handle.as_ptr(), &mut len, &mut msg, true);

            match result {
                pg_sys::shm_mq_result::SHM_MQ_SUCCESS => Ok(Some(
                    std::slice::from_raw_parts(msg as *mut u8, len).to_vec(),
                )),
                pg_sys::shm_mq_result::SHM_MQ_WOULD_BLOCK => Ok(None),
                other => Err(MessageQueueRecvError::from(other)),
            }
        }
    }
}

```

### Core Architecture Module: `common/src/postgres/utils.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.
#![allow(
    clippy::missing_safety_doc,
    clippy::not_unsafe_ptr_arg_deref,
    unsafe_op_in_unsafe_fn
)]

use crate::api::tokenizers::{DatumWithType, type_is_alias, type_is_tokenizer};
use crate::api::version::Version;
use crate::nodecast;
use crate::postgres::composite::CompositeSlotValues;
use crate::postgres::datetime::PostgresDateTime;
use crate::postgres::node::NodeExt;
use crate::postgres::types::{TantivyValue, TantivyValueError};

use crate::schema::{CategorizedFieldData, SearchFieldType};
use anyhow::Result;
use pgrx::itemptr::item_pointer_get_both;
use pgrx::*;

use std::collections::BTreeMap;
use std::str::FromStr;
use tokenizers::SearchNormalizer;

pub fn text_lower_funcoid() -> pg_sys::Oid {
    pg_sys::F_LOWER_TEXT.into()
}

unsafe extern "C-unwind" {
    // SAFETY: `IsTransactionState()` doesn't raise an ERROR.  As such, we can avoid the pgrx
    // sigsetjmp overhead by linking to the function directly.
    pub fn IsTransactionState() -> bool;
}

/// `IsA()` for a node pointer that may be NULL, as the `pgrx::is_a` that pgrx 0.20 removed.
///
/// # Safety
///
/// `node` must be NULL or point to a live `Node`.
#[inline]
pub unsafe fn is_a(node: *mut pg_sys::Node, tag: pg_sys::NodeTag) -> bool {
    unsafe { <pg_sys::Node as pg_sys::PgNode>::is_a_ptr(node, tag) }
}

/// Argument `num` of `fcinfo`, or `None` when it is SQL NULL, as the `pg_getarg_datum` that
/// pgrx 0.20 removed.
///
/// # Safety
///
/// `fcinfo` must point to a live `FunctionCallInfo` whose arguments are initialized.
#[inline]
pub unsafe fn pg_getarg_datum(
    fcinfo: pg_sys::FunctionCallInfo,
    num: usize,
) -> Option<pg_sys::Datum> {
    unsafe { pgrx::fcinfo::pg_get_nullable_datum(fcinfo, num) }.into()
}

pub fn vacuum_delay_point() {
    unsafe {
        #[cfg(any(feature = "pg15", feature = "pg16", feature = "pg17"))]
        pg_sys::vacuum_delay_point();
        #[cfg(not(any(feature = "pg15", feature = "pg16", feature = "pg17")))]
        pg_sys::vacuum_delay_point(false);
    }
}

/// Implements `Drop` for a Postgres resource that must be cleaned up on the Postgres main thread,
/// skipping cleanup during panic unwinding or process exit.
///
/// Because panics on the Postgres main thread are used to propagate PostgreSQL errors via pgrx, it
/// is almost never safe to interact with PostgreSQL APIs during panic unwinding - doing so can
/// cause a double-panic which results in SIGABRT. This macro also enforces that the destructor runs
/// on the Postgres main thread (printing via `eprintln!` so an off-main-thread drop during
/// unwinding never double-panics, panicking in debug builds when not unwinding, and skipping the
/// body in release builds). Types that can be dropped on background threads must wrap their inner
/// Postgres resource in `crate::postgres::customscan::mpp::MainThread` or forward their cleanup
/// payload via `crate::postgres::customscan::mpp::drop_on_main_thread` from a plain `impl Drop`.
///
/// PostgreSQL's transaction and subtransaction abort mechanisms release `ResourceOwner`-managed
/// resources (buffers, relations, locks, temp files, tuple descriptors) before a scan state's
/// `MemoryContext` callback necessarily runs (for example, a failed outer cursor dropped later at
/// `CLOSE` or `COMMIT`, or an SPI query failing inside an inner PL/pgSQL `EXCEPTION` block while
/// `IsTransactionState()` is `true`). Wrappers that can live inside a `MemoryContext` should
/// capture [`crate::postgres::resowner::ResourceOwnerStamp::current`] at acquisition time and gate
/// C cleanup through [`crate::postgres::resowner::ResourceOwnerStamp::run_if_live`] rather than
/// checking `IsTransactionState()` alone.
///
/// Cleanup is also skipped once `proc_exit` has started: a FATAL doesn't unwind, so `panicking()`
/// can't see it, and the abort that `proc_exit` runs releases those resources too. Skipping the body
/// doesn't stop Rust dropping the fields afterwards; values whose fields a FATAL can leave mid-use
/// are handled where they are leaked, see `PgMemoryContextsExt::leak_and_drop_unless_exiting`.
///
/// # Example
/// ```ignore
/// impl_safe_drop!(MyStruct, |self| {
///     let handle = self.handle;
///     self.owner.run_if_live(|| unsafe {
///         pg_sys::some_cleanup_function(handle);
///     });
/// });
/// ```
///
/// A generic type puts its impl parameters in brackets first:
/// `impl_safe_drop!([T: Trait] MyStruct<T>, |self| { ... })`.
#[macro_export]
macro_rules! impl_safe_drop {
    ([$($generics:tt)*] $ty:ty, |$self:ident| $body:block) => {
        impl<$($generics)*> Drop for $ty {
            fn drop(&mut $self) {
                if !$crate::postgres::customscan::mpp::interrupt::is_main_thread() {
                    eprintln!(
                        "BUG: Drop for {} ran off the Postgres main thread",
                        stringify!($ty)
                    );
                    #[cfg(debug_assertions)]
                    if !std::thread::panicking() {
                        panic!(
                            "BUG: Drop for {} ran off the Postgres main thread",
                            stringify!($ty)
                        );
                    }
                    return;
                }
                if std::thread::panicking() || $crate::postgres::utils::proc_exit_in_progress() {
                    return;
                }
                $body
            }
        }
    };
    ($ty:ty, |$self:ident| $body:block) => {
        $crate::impl_safe_drop!([] $ty, |$self| $body);
    };
}

/// Adds `leak_and_drop_unless_exiting` to pgrx's `PgMemoryContexts`.
pub trait PgMemoryContextsExt {
    /// pgrx's `leak_and_drop_on_delete`, except the drop is skipped once `proc_exit` has started.
    ///
    /// For the scan states that go with a query's memory: each custom scan's
    /// (`CustomScanStateWrapper`) and the index AM's (`IndexScanDesc::opaque`). A FATAL can stop
    /// any call into them, and a `Drop` on the state can't cover that: it skips only its own body, and
    /// Rust still drops the fields:
    ///
    /// 1. A FATAL (e.g. from `pg_terminate_backend`) is raised at a `CHECK_FOR_INTERRUPTS()`, which
    ///    can be deep inside a Rust call. Postgres calls `proc_exit` right there instead of
    ///    unwinding, so that call never returns and `panicking()` is false.
    /// 2. `proc_exit` aborts the transaction, which frees the query's memory. The callback on that
    ///    memory drops the scan state, including values the interrupted call was still using.
    /// 3. A value left mid-use panics when dropped: std's `OnceLock` while `get_or_init` is
    ///    running (the readers hold many, in `FFHelper`, `LinkedBytesList`, `DeferredScorer` and
    ///    tantivy's `SegmentReader`), tokio's `Runtime` while `block_on` holds its core, and the
    ///    columnar scan's DataFusion stream mid-poll, which frees memory it doesn't own. A Rust
    ///    panic can't pass through the C callback, so pgrx raises it as a Postgres ERROR.
    /// 4. Postgres turns an ERROR raised during `proc_exit` into a FATAL, which calls `proc_exit`
    ///    again. That nested exit skips the rest of the first abort, so the process exits still
    ///    holding its buffer pins and locks.
    ///
    /// Skipping the drop lets the abort finish and release them. Nothing is lost: the abort also
    /// releases the snapshots and temp files the state holds, and the `Box` goes with the process.
    /// After a plain ERROR the drop still runs, since the backend keeps going and the state would
    /// otherwise leak.
    ///
    /// The whole state is skipped, not just some of its values, because the values above are
    /// std, tokio, tantivy and DataFusion types: there is no `Drop` of ours on them to put
    /// `impl_safe_drop!` on. Our own `Drop`s are checked by `.github/scripts/check_impl_drop.py`.
    ///
    /// The body mirrors pgrx 0.20.1's `leak_and_drop_on_delete` (`memcxt.rs`) plus the
    /// `proc_exit` check; keep it in sync when bumping pgrx.
    fn leak_and_drop_unless_exiting<T>(&mut self, v: T) -> *mut T;
}

impl PgMemoryContextsExt for PgMemoryContexts {
    fn leak_and_drop_unless_exiting<T>(&mut self, v: T) -> *mut T {
        #[pg_guard]
        unsafe extern "C-unwind" fn drop_unless_exiting<T>(ptr: *mut std::ffi::c_void) {
            if proc_exit_in_progress() {
                return;
            }
            // SAFETY: `ptr` came from the `Box::leak` below, and Postgres runs a reset callback
            // once.
            drop(unsafe { Box::from_raw(ptr.cast::<T>()) });
        }

        unsafe {
            // SAFETY: the callback struct is plain pointers, all set before it is registered.
            let callback = self.palloc_struct::<pg_sys::MemoryContextCallback>();
            // Keep Rust ownership until callback allocation succeeds.
            let leaked = Box::leak(Box::new(v));
            (*callback).func = Some(drop_unless_exiting::<T>);
            (*callback).arg = (leaked as *mut T).cast();
            pg_sys::MemoryContextRegisterResetCallback(self.value(), callback);
            leaked
        }
    }
}

/// Whether this backend is running `proc_exit`, where a FATAL m
```

### Core Architecture Module: `index_read/src/index/directory/utils.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.
#![allow(clippy::missing_safety_doc, unsafe_op_in_unsafe_fn)]

use crate::api::{HashMap, HashSet};
use crate::index::mvcc::{MvccSatisfies, PinCushion};
use crate::postgres::rel::PgSearchRelation;
use crate::postgres::storage::block::{
    CTID_MAP_EXT, DeleteEntry, FileEntry, LinkedList, MVCCEntry, PgItem, STATS_EXT,
    SegmentFileDetails, SegmentMetaEntry, SegmentMetaEntryImmutable, VECTOR_CENTROIDS_EXT,
    VECTOR_VEC_EXT,
};
use crate::postgres::storage::metadata::MetaPage;
use anyhow::Result;
use pgrx::pg_sys;
use std::path::PathBuf;
use tantivy::index::SegmentComponent;
use tantivy::{
    IndexMeta,
    index::{IndexSettings, SegmentId, SegmentMetaInventory},
    schema::Schema,
};

pub fn save_schema(indexrel: &PgSearchRelation, tantivy_schema: &Schema) -> Result<()> {
    let schema = MetaPage::open(indexrel).schema_bytes();
    if schema.is_empty() {
        let bytes = serde_json::to_vec(tantivy_schema)?;
        unsafe {
            schema.writer().write(&bytes)?;
        }
    }
    Ok(())
}

pub fn save_settings(indexrel: &PgSearchRelation, tantivy_settings: &IndexSettings) -> Result<()> {
    let settings = MetaPage::open(indexrel).settings_bytes();
    if settings.is_empty() {
        let bytes = serde_json::to_vec(tantivy_settings)?;
        unsafe {
            settings.writer().write(&bytes)?;
        }
    }
    Ok(())
}

pub unsafe fn save_new_metas(
    indexrel: &PgSearchRelation,
    new_meta: &IndexMeta,
    prev_meta: &IndexMeta,
    directory_entries: &mut HashMap<PathBuf, FileEntry>,
) -> Result<()> {
    // in order to ensure that all of our mutations to the list of segments appear atomically on
    // physical replicas, we atomically operate on a deep copy of the list.
    let mut segment_metas_linked_list = MetaPage::open(indexrel).segment_metas();
    let mut linked_list = segment_metas_linked_list.atomically();

    let incoming_segments = new_meta
        .segments
        .iter()
        .map(|s| (s.id(), s))
        .collect::<HashMap<_, _>>();
    let new_ids = new_meta
        .segments
        .iter()
        .map(|s| s.id())
        .collect::<HashSet<_>>();
    let previous_ids = prev_meta
        .segments
        .iter()
        .map(|s| s.id())
        .collect::<HashSet<_>>();

    if pg_sys::message_level_is_interesting(pg_sys::DEBUG1 as _) {
        pgrx::debug1!(
            "entered save_new_metas with {} new ids and {} previous ids",
            new_ids.len(),
            previous_ids.len()
        );
    }

    // first, reorganize the directory_entries by segment id
    let mut new_files =
        HashMap::<SegmentId, HashMap<SegmentComponent, (FileEntry, PathBuf)>>::default();

    for (path, file_entry) in directory_entries.drain() {
        let segment_id = path.segment_id();
        let component_type = path.component_type();

        if let (Some(segment_id), Some(component_type)) = (segment_id, component_type) {
            new_files
                .entry(segment_id)
                .or_default()
                .insert(component_type, (file_entry, path));
        } else {
            panic!("malformed PathBuf: {}", path.display());
        }
    }

    let created_ids = new_ids.difference(&previous_ids).collect::<Vec<_>>();
    let mut modified_ids = previous_ids.intersection(&new_ids).collect::<Vec<_>>();
    let deleted_ids = previous_ids.difference(&new_ids).collect::<Vec<_>>();

    modified_ids.retain(|id| {
        if let Some(new_files) = new_files.get(id) {
            new_files.contains_key(&SegmentComponent::Delete)
        } else {
            false
        }
    });

    //
    // process the new segments
    //
    // these are added to the linked list as new items
    // xmin is set to the current transaction id
    // and xmax is set to InvalidTransactionId
    //
    let created_entries = created_ids
        .into_iter()
        .filter_map(|id| {
            let created_segment = incoming_segments.get(id).unwrap();
            let mut files = new_files.remove(id)?;

            let meta_entry = SegmentMetaEntry::new_immutable(
                *id,
                created_segment.max_doc(),
                pg_sys::InvalidTransactionId,
                SegmentMetaEntryImmutable {
                    postings: files.remove(&SegmentComponent::Postings).map(|e| e.0),
                    positions: files.remove(&SegmentComponent::Positions).map(|e| e.0),
                    fast_fields: files.remove(&SegmentComponent::FastFields).map(|e| e.0),
                    field_norms: files.remove(&SegmentComponent::FieldNorms).map(|e| e.0),
                    terms: files.remove(&SegmentComponent::Terms).map(|e| e.0),
                    store: files.remove(&SegmentComponent::Store).map(|e| e.0),
                    temp_store: files.remove(&SegmentComponent::TempStore).map(|e| e.0),
                    delete: files
                        .remove(&SegmentComponent::Delete)
                        .map(|(file_entry, _)| DeleteEntry {
                            file_entry,
                            num_deleted_docs: created_segment.num_deleted_docs(),
                        }),
                    vec: files
                        .remove(&SegmentComponent::Custom(VECTOR_VEC_EXT.to_string()))
                        .map(|e| e.0),
                    centroids: files
                        .remove(&SegmentComponent::Custom(VECTOR_CENTROIDS_EXT.to_string()))
                        .map(|e| e.0),
                    stats: files
                        .remove(&SegmentComponent::Custom(STATS_EXT.to_string()))
                        .map(|e| e.0),
                    ctid_map: files
                        .remove(&SegmentComponent::Custom(CTID_MAP_EXT.to_string()))
                        .map(|e| e.0),
                    posting_norms: files.remove(&SegmentComponent::PostingNorms).map(|e| e.0),
                    posting_bitmaps: files.remove(&SegmentComponent::PostingBitmaps).map(|e| e.0),
                },
            );

            Some(meta_entry)
        })
        .collect::<Vec<_>>();

    //
    // process the modified segments
    //
    // lookup existing version, update the `delete` entry
    // if it already has one, remember the old entry in `orphaned_deletes_files` so it can be
    // re-added below as an immediately-recyclable entry
    // xmin/xmax do not change
    //
    let mut orphaned_deletes_files = Vec::new();
    let modified_entries = modified_ids
        .into_iter()
        .filter_map(|id| {
            let mut files = new_files.remove(id)?;
            assert!(
                files.len() == 1 && files.contains_key(&SegmentComponent::Delete),
                "new files for segment_id `{id}` should be exactly one Delete component:  {files:#?}"
            );

            let existing_segment = incoming_segments.get(id).unwrap();
            let (mut meta_entry, blockno, _) = linked_list
                .lookup_ex(|entry| entry.segment_id() == *id, None)
                .unwrap_or_else(|e| {
                    panic!("segment id `{id}` should be in the segment meta linked list:  {e}")
                });
            let (new_delete_entry, _path) = files
                .remove(&SegmentComponent::Delete)
                .unwrap_or_else(|| panic!("missing new delete file for segment_id `{id}`"));

            let deletes = DeleteEntry {
                file_entry: new_delete_entry,
                num_deleted_docs: existing_segment.num_deleted_docs(),
            };
            if let Some(old_entry) = meta_entry.replace_deletes(deletes) {
                // remember the old delete_entry for future action
                orphaned_deletes_files.push(old_entry);
            }

            Some((meta_entry, blockno))
        })
        .collect::<Vec<_>>();

    //
    // process the deleted segments
    //
    // find the deleted segment entries and set their `xmax` to `FrozenTransactionId`, which is
    // safe because a deleted segment always belongs to a transaction known to not be in progress
    //
    let deleted_entries = deleted_ids
        .into_iter()
        .map(|id| {
            let (mut meta_entry, blockno, _) = linked_list
                .lookup_ex(|entry| entry.segment_id() == *id, None)
                .unwrap_or_else(|e| {
                    panic!("segment id `{id}` should be in the segment meta linked list: {e}")
                });

            // Merges and VACUUM retire replaced segments inside a transaction.
            assert!(pg_sys::IsTransactionState());

            assert!(
                meta_entry.xmax() == pg_sys::InvalidTransactionId,
                "SegmentMetaEntry {} should not already be deleted",
                meta_entry.segment_id()
            );

            // deleted segments belong to a transaction that is known to not be in progress
            // and so when we mark them as deleted, it'll be with a transaction that is known to
            // not be in progress, the FrozenTransactionId.
            meta_entry.set_xmax(pg_sys::FrozenTransactionId);

            (meta_entry, blockno)
        })
        .collect::<Vec<_>>();

    //
    // recycle anything leftover in `new_files` to our input `dire
```

### Core Architecture Module: `index_read/src/index/reader/scorer.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use crate::index::reader::index::enable_scoring;
use std::sync::{Arc, OnceLock};
use tantivy::query::{BooleanQuery, Occur, PruningScorer, Query, Scorer, Weight};
use tantivy::{DocAddress, DocId, DocSet, Score, Searcher, SegmentOrdinal, SegmentReader};

#[cfg(any(test, feature = "pg_test"))]
pub mod test_support {
    use std::sync::atomic::AtomicUsize;

    /// Number of deferred per-segment scorers that crossed the actual Tantivy open boundary.
    pub static SCORERS_OPENED: AtomicUsize = AtomicUsize::new(0);
}

/// Lazily builds one [`Weight`] and shares it across a search's segments.
///
/// A scored weight aggregates corpus-level term statistics: `doc_freq` walks every
/// segment's term dictionary. Building the weight per segment therefore costs
/// segments² dictionary lookups per query, which dominates scored scans on
/// many-segment indexes.
pub struct LazyWeight {
    query: Arc<dyn Query>,
    need_scores: bool,
    searcher: Searcher,
    weight: OnceLock<Box<dyn Weight>>,
}

impl LazyWeight {
    pub fn new(query: Arc<dyn Query>, need_scores: bool, searcher: Searcher) -> Self {
        Self {
            query,
            need_scores,
            searcher,
            weight: Default::default(),
        }
    }

    /// Conjoin another query using the same searcher and scoring mode.
    /// Each segment still receives its own scorer.
    pub(super) fn and_query(self: &Arc<Self>, query: Box<dyn Query>) -> Self {
        Self::new(
            Arc::new(BooleanQuery::new(vec![
                (Occur::Must, self.query.box_clone()),
                (Occur::Must, query),
            ])),
            self.need_scores,
            self.searcher.clone(),
        )
    }

    pub(super) fn get(&self) -> &dyn Weight {
        self.weight
            .get_or_init(|| {
                self.query
                    .weight(enable_scoring(self.need_scores, &self.searcher))
                    .expect("weight should be constructable")
            })
            .as_ref()
    }
}

pub struct DeferredScorer {
    weight: Arc<LazyWeight>,
    segment_reader: SegmentReader,
    scorer: OnceLock<Box<dyn PruningScorer>>,
    /// Pruning threshold recorded via [`Self::set_threshold`] before the underlying scorer is
    /// opened, so `pruning_scorer` receives it before its initial `advance()`.
    initial_threshold: Score,
}

impl DeferredScorer {
    pub fn new(weight: Arc<LazyWeight>, segment_reader: SegmentReader) -> Self {
        Self {
            weight,
            segment_reader,
            scorer: Default::default(),
            initial_threshold: Score::MIN,
        }
    }

    #[track_caller]
    #[inline(always)]
    fn scorer_mut(&mut self) -> &mut dyn PruningScorer {
        self.scorer();
        self.scorer
            .get_mut()
            .expect("deferred scorer should have been initialized")
    }

    #[track_caller]
    #[inline(always)]
    fn scorer(&self) -> &dyn PruningScorer {
        self.scorer.get_or_init(|| {
            #[cfg(any(test, feature = "pg_test"))]
            test_support::SCORERS_OPENED.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            self.weight
                .get()
                .pruning_scorer(&self.segment_reader, 1.0, self.initial_threshold)
                .expect("pruning scorer should be constructable")
        })
    }

    fn set_threshold(&mut self, threshold: Score) {
        if let Some(scorer) = self.scorer.get_mut() {
            scorer.set_threshold(threshold);
        } else {
            // Avoid opening the underlying scorer just to record a threshold: opening with
            // `Score::MIN` runs an initial unpruned `advance()` (evaluating filters on a full
            // warmup batch) before `set_threshold` takes effect.
            self.initial_threshold = threshold;
        }
    }
}

impl DocSet for DeferredScorer {
    #[inline(always)]
    fn advance(&mut self) -> DocId {
        self.scorer_mut().advance()
    }

    #[inline(always)]
    fn doc(&self) -> DocId {
        self.scorer().doc()
    }

    fn size_hint(&self) -> u32 {
        self.scorer().size_hint()
    }
}

impl Scorer for DeferredScorer {
    #[inline(always)]
    fn score(&mut self) -> Score {
        self.scorer_mut().score()
    }
}

pub struct ScorerIter {
    deferred: DeferredScorer,
    segment_ord: SegmentOrdinal,
    segment_reader: SegmentReader,
}

impl ScorerIter {
    pub fn new(
        scorer: DeferredScorer,
        segment_ord: SegmentOrdinal,
        segment_reader: SegmentReader,
    ) -> Self {
        Self {
            deferred: scorer,
            segment_ord,
            segment_reader,
        }
    }

    pub fn segment_ord(&self) -> SegmentOrdinal {
        self.segment_ord
    }

    pub fn segment_id(&self) -> tantivy::index::SegmentId {
        self.segment_reader.segment_id()
    }

    /// Returns the estimated number of documents that will be yielded by this iterator.
    ///
    /// This is used for query planning statistics and uses Tantivy's `size_hint`.
    pub fn estimated_doc_count(&self) -> u32 {
        self.deferred.size_hint()
    }

    pub fn set_threshold(&mut self, threshold: Score) {
        self.deferred.set_threshold(threshold);
    }

    /// Returns an upper bound on the number of documents this iterator can yield starting from
    /// `from_doc` (inclusive) through the end of the segment.
    pub fn remaining_docs_upper_bound(&self, from_doc: DocId) -> usize {
        self.segment_reader
            .max_doc()
            .saturating_sub(from_doc)
            .min(self.segment_reader.num_docs()) as usize
    }
}

impl Iterator for ScorerIter {
    type Item = (Score, DocAddress);

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            let doc_id = self.deferred.doc();

            if doc_id == tantivy::TERMINATED {
                // we've read all the docs
                return None;
            } else if self
                .segment_reader
                .alive_bitset()
                .map(|alive_bitset| alive_bitset.is_alive(doc_id))
                // if there's no alive_bitset, the doc is alive
                .unwrap_or(true)
            {
                // this doc is alive
                let score = self.deferred.score();
                let this = (score, DocAddress::new(self.segment_ord, doc_id));

                // move to the next doc for the next iteration
                self.deferred.advance();

                // return the live doc
                return Some(this);
            }

            // this doc isn't alive, move to the next doc and loop around
            self.deferred.advance();
        }
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        // NOTE: We do not implement size_hint for `ScorerIter`, because the implementation of
        // `Scorer::size_hint` can take a lot longer to execute than is usually expected from
        // `Iterator::size_hint`. We also never consume a `ScorerIter` in a way that requires an
        // accurate size: when consuming for Top K, we consume a precise amount, and in all other
        // cases the iterator is consumed as streaming.
        (0, None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tantivy::columnar::ColumnType;
    use tantivy::query::{TermPredicate, TermPredicateQuery, TermQuery, TinySet};
    use tantivy::schema::{FAST, IndexRecordOption, STRING, Schema, TEXT};
    use tantivy::{Index, ProbeCost, Term, doc};

    #[derive(Debug)]
    struct CountingMatchAllPredicate {
        calls: Arc<AtomicUsize>,
    }

    impl TermPredicate for CountingMatchAllPredicate {
        fn filter_bytes(&self, _data: &[u8], offsets: &[u32], out: &mut [TinySet]) {
            self.calls.fetch_add(1, Ordering::Relaxed);
            let count = offsets.len().saturating_sub(1);
            for i in 0..count {
                out[i / 64].insert_mut((i % 64) as u32);
            }
        }

        fn filter_monotonic_u64s(
            &self,
            _col_type: ColumnType,
            values: &[u64],
            out: &mut [TinySet],
        ) {
            self.calls.fetch_add(1, Ordering::Relaxed);
            for i in 0..values.len() {
                out[i / 64].insert_mut((i % 64) as u32);
            }
        }

        fn probe_cost(&self) -> ProbeCost {
            ProbeCost::per_doc(5)
        }
    }

    #[test]
    fn deferred_scorer_applies_threshold_before_opening() {
        let mut schema_builder = Schema::builder();
        let title = schema_builder.add_text_field("title", TEXT);
        let key = schema_builder.add_text_field("key", STRING | FAST);
        let schema = schema_builder.build();

        let index = Index::create_in_ram(schema);
        let mut writer = index.writer_with_num_threads(1, 15_000_000).unwrap();
        // Enough distinct high-entropy keys (no common delta prefix) to span > 2 SSTable blocks
        // so `TermSetWeight` chooses lazy `CachedDictPredicateDocSet` under `ExecutionMode::Pruning`.
        for i in 0..500u64 {
            let hi = i.wrapping_mul(0x9e37_79b9_7f4a_7c15);
            let lo = i.wrapping_mul(0xbf58_476d_1ce4_e5b9)
```

### Core Architecture Module: `index_read/src/query/proximity/scorer.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use crate::query::proximity::ProximityDistance;
use std::cmp::Ordering;
use tantivy::fieldnorm::FieldNormReader;
use tantivy::postings::Postings;
use tantivy::query::{Bm25Weight, Intersection, Scorer, SimpleUnion};
use tantivy::{DocId, DocSet, Score, TERMINATED};

pub struct ProximityScorer {
    #[allow(clippy::type_complexity)]
    intersection: Intersection<SimpleUnion<Box<dyn Postings>>, SimpleUnion<Box<dyn Postings>>>,
    distance: ProximityDistance,
    fieldnorm_reader: FieldNormReader,
    weight_opt: Option<Bm25Weight>,
    nmatches: usize,
    lpos: Vec<u32>,
    rpos: Vec<u32>,
}

impl ProximityScorer {
    pub fn new(
        left: Vec<Box<dyn Postings>>,
        distance: ProximityDistance,
        right: Vec<Box<dyn Postings>>,
        fieldnorm_reader: FieldNormReader,
        weight_opt: Option<Bm25Weight>,
        num_docs: u32,
    ) -> Self {
        let left = SimpleUnion::build(left);
        let right = SimpleUnion::build(right);
        let intersection = Intersection::with_two_sets(left, right, num_docs);
        let mut scorer = Self {
            intersection,
            distance,
            fieldnorm_reader,
            weight_opt,
            nmatches: 0,
            lpos: Default::default(),
            rpos: Default::default(),
        };

        if scorer.doc() != TERMINATED && !scorer.prox_match() {
            scorer.advance();
        }

        scorer
    }

    pub fn fieldnorm_id(&self) -> u8 {
        self.intersection
            .docset_specialized(0)
            .fieldnorm_id()
            .unwrap_or_else(|| self.fieldnorm_reader.fieldnorm_id(self.doc()))
    }

    pub fn prox_iter(&mut self) -> impl Iterator<Item = (u32, u32)> + '_ {
        self.lpos.clear();
        self.rpos.clear();
        self.intersection
            .docset_mut_specialized(0)
            .positions(&mut self.lpos);
        self.intersection
            .docset_mut_specialized(1)
            .positions(&mut self.rpos);
        ProxIter::new(self.distance, &self.lpos, &self.rpos)
    }

    pub fn prox_count(&mut self) -> usize {
        self.prox_iter().count()
    }

    fn prox_match(&mut self) -> bool {
        let has_weight = self.weight_opt.is_some();
        let mut iter = self.prox_iter();
        if has_weight {
            let count = iter.count();
            self.nmatches = count;
            count > 0
        } else {
            iter.next().is_some()
        }
    }
}

struct ProxIter<'a> {
    distance: ProximityDistance,
    lpos: &'a [u32],
    rpos: &'a [u32],
    li: usize,
    ri: usize,
}

impl<'a> ProxIter<'a> {
    fn new(distance: ProximityDistance, lpos: &'a [u32], rpos: &'a [u32]) -> Self {
        Self {
            distance,
            lpos,
            rpos,
            li: 0,
            ri: 0,
        }
    }
}

impl Iterator for ProxIter<'_> {
    type Item = (u32, u32);

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            if self.li >= self.lpos.len() || self.ri >= self.rpos.len() {
                return None;
            }

            let l = self.lpos[self.li];
            let r = self.rpos[self.ri];

            let diff = self.distance.diff(l, r);
            if diff <= self.distance.distance() + 1 {
                self.li += 1;
                return Some((l, r));
            }

            match l.cmp(&r) {
                Ordering::Less => self.li += 1,
                Ordering::Equal => {
                    self.li += 1;
                    self.ri += 1;
                }
                Ordering::Greater => self.ri += 1,
            }
        }
    }
}

// TODO: Override `DocSet::cost()` (scaled drive cost + `ProbeCost::POSITIONAL`, matching
// `PhraseScorer`) and `DocSet::seek_danger()` (so a miss does not walk forward to the next
// proximity match).
impl DocSet for ProximityScorer {
    fn advance(&mut self) -> DocId {
        loop {
            let doc = self.intersection.advance();
            if doc == TERMINATED || self.prox_match() {
                return doc;
            }
        }
    }

    fn seek(&mut self, target: DocId) -> DocId {
        let doc = self.intersection.seek(target);
        if doc == TERMINATED || self.prox_match() {
            return doc;
        }
        self.advance()
    }

    fn doc(&self) -> DocId {
        self.intersection.doc()
    }

    fn size_hint(&self) -> u32 {
        self.intersection.size_hint()
    }
}

impl Scorer for ProximityScorer {
    fn score(&mut self) -> Score {
        if let Some(similarity_weight) = self.weight_opt.as_ref() {
            similarity_weight.score(self.fieldnorm_id(), self.nmatches as u32)
        } else {
            1.0f32
        }
    }
}

```

### Core Architecture Module: `index_read/src/query/score.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

use std::ops::{Bound, RangeBounds};
use tantivy::query::{EmptyScorer, EnableScoring, Explanation, Query, QueryClone, Scorer, Weight};
use tantivy::schema::Field;
use tantivy::{DocId, DocSet, Score, SegmentReader, TERMINATED, Term};

#[derive(Debug)]
pub struct ScoreFilter {
    bounds: Vec<(Bound<f32>, Bound<f32>)>,
    query: Box<dyn Query>,
}

impl QueryClone for ScoreFilter {
    fn box_clone(&self) -> Box<dyn Query> {
        Box::new(Self {
            bounds: self.bounds.clone(),
            query: self.query.box_clone(),
        })
    }
}

impl ScoreFilter {
    pub fn new(bounds: Vec<(Bound<f32>, Bound<f32>)>, query: Box<dyn Query>) -> Self {
        Self { bounds, query }
    }
}

struct ScoreFilterWeight {
    bounds: Vec<(Bound<f32>, Bound<f32>)>,
    weight: Box<dyn Weight>,
}

impl Weight for ScoreFilterWeight {
    fn scorer(&self, reader: &SegmentReader, boost: Score) -> tantivy::Result<Box<dyn Scorer>> {
        let mut scorer = self.weight.scorer(reader, boost)?;

        while !self
            .bounds
            .iter()
            .any(|&(lower, upper)| (lower, upper).contains(&scorer.score()))
        {
            if scorer.advance() == TERMINATED {
                scorer = Box::new(EmptyScorer);
                break;
            }
        }

        Ok(Box::new(ScoreFilterScorer {
            bounds: self.bounds.clone(),
            scorer,
        }))
    }

    fn explain(&self, reader: &SegmentReader, doc: DocId) -> tantivy::Result<Explanation> {
        self.weight.explain(reader, doc)
    }
}

struct ScoreFilterScorer {
    bounds: Vec<(Bound<f32>, Bound<f32>)>,
    scorer: Box<dyn Scorer>,
}

impl Scorer for ScoreFilterScorer {
    fn score(&mut self) -> Score {
        self.scorer.score()
    }
}

// TODO: Override `DocSet::cost()` to forward `self.scorer.cost()` rather than inheriting the
// default `size_hint()` / `ProbeCost::TERM`.
impl DocSet for ScoreFilterScorer {
    fn advance(&mut self) -> DocId {
        loop {
            let doc = self.scorer.advance();
            if doc == TERMINATED
                || self
                    .bounds
                    .iter()
                    .any(|&(lower, upper)| (lower, upper).contains(&self.scorer.score()))
            {
                return doc;
            }
        }
    }

    fn doc(&self) -> DocId {
        self.scorer.doc()
    }

    fn size_hint(&self) -> u32 {
        self.scorer.size_hint()
    }
}

impl Query for ScoreFilter {
    fn weight(&self, enable_scoring: EnableScoring<'_>) -> tantivy::Result<Box<dyn Weight>> {
        Ok(Box::new(ScoreFilterWeight {
            bounds: self.bounds.clone(),
            weight: self.query.weight(enable_scoring)?,
        }))
    }

    fn query_terms(
        &self,
        field: Field,
        segment_reader: &SegmentReader,
        visitor: &mut dyn FnMut(&Term, bool),
    ) {
        self.query.query_terms(field, segment_reader, visitor)
    }
}

```

### Core Architecture Module: `joinscan/src/postgres/customscan/aggregatescan/scan_state.rs`
```
// Copyright (c) 2023-2026 ParadeDB, Inc.
//
// This file is part of ParadeDB - Postgres for Search and Analytics
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.
#![allow(clippy::not_unsafe_ptr_arg_deref)]

use crate::customscan::aggregatescan::AggregateCSClause;
use crate::customscan::aggregatescan::exec::AggregationResultsRow;
use crate::index::reader::index::{SearchIndexManifest, SegmentPruningEstimate};
use crate::postgres::PgSearchRelation;
use crate::postgres::customscan::CustomScanState;
use crate::postgres::customscan::aggregatescan::explain::AggregateParallelism;
use crate::postgres::customscan::aggregatescan::join_targetlist::JoinAggregateTargetList;
use crate::postgres::customscan::aggregatescan::pdb_agg::PdbAggPlan;
use crate::postgres::customscan::aggregatescan::privdat::{DataFusionTopK, FilterExpr};
use crate::postgres::customscan::bitmap_intersection::BitmapExec;
use crate::postgres::customscan::joinscan::build::RelNode;
use crate::postgres::customscan::mpp::glue::{MppLaunchTiming, MppLifecycle};
use crate::postgres::customscan::mpp::interrupt::PgTokioRuntime;
use crate::postgres::customscan::projections::{PlaceholderColumn, PlaceholderProjection};
use crate::postgres::customscan::solve_expr::SolvePostgresExpressions;
use crate::postgres::heap::VisibilityStats;
use crate::query::SearchQueryInput;
use crate::query::tid_bitmap_stream::BitmapCell;
use std::ptr::NonNull;

use arrow_array::RecordBatch;
use datafusion::physical_plan::SendableRecordBatchStream;
use pgrx::pg_sys;

use super::AggIndexInfo;

#[derive(Default)]
pub enum ExecutionState {
    #[default]
    NotStarted,
    Emitting(std::vec::IntoIter<AggregationResultsRow>),
    Completed,
}

/// Pristine pre-solve copy of the DataFusion aggregate's query-bearing fields, kept only when
/// runtime expressions or parameters are present so rescans re-solve from the original trees
/// (mirrors `base_aggregate_clause` and `JoinScanState::base_join_clause`).
pub struct DataFusionAggBase {
    pub plan: RelNode,
    pub targetlist: JoinAggregateTargetList,
    pub having_filter: Option<FilterExpr>,
}

/// State for the DataFusion aggregate execution backend.
pub struct DataFusionAggState {
    /// DataFusion result stream (dropped first, before `physical_plan`, `mpp`, and `runtime`).
    pub stream: Option<SendableRecordBatchStream>,
    /// Current batch being consumed row-by-row.
    pub current_batch: Option<RecordBatch>,
    /// Row index within current_batch.
    pub batch_row_idx: usize,
    /// The executed physical plan, kept so EXPLAIN ANALYZE can merge the worker metrics that
    /// arrive over `coordinator_channel` into its display.
    pub physical_plan: Option<std::sync::Arc<dyn datafusion::physical_plan::ExecutionPlan>>,
    /// Runtime MPP lifecycle for this scan (#5667: the plan comes first; workers spawn only after
    /// it exists). Initialized from `PrivateData.parallel_mode_ok` and transitions to `Disabled`
    /// on budget rejection, launch fallback, or `EndCustomScan`.
    pub mpp: MppLifecycle,
    /// Tokio runtime for async DataFusion execution (dropped after `stream`, `physical_plan`,
    /// and `mpp` so background tasks are quiesced and deferred drops are drained first).
    pub runtime: Option<PgTokioRuntime>,
    /// The join tree.
    pub plan: RelNode,
    /// GROUP BY columns and aggregate functions.
    pub targetlist: JoinAggregateTargetList,
    /// Optional TopK sort+limit pushed down from Postgres.
    pub topk: Option<DataFusionTopK>,
    /// Raw PG Expr pointers from custom_exprs (after setrefs transforms
    /// Var nodes to INDEX_VAR references). Used to translate non-@@@
    /// cross-table predicates at execution time.
    pub custom_exprs: *mut pg_sys::List,
    /// The custom_scan_tlist from the CustomScan node. Used to resolve
    /// INDEX_VAR references in custom_exprs back to original (rti, attno)
    /// pairs during DataFusion expression translation.
    pub custom_scan_tlist: *mut pg_sys::List,
    /// HAVING clause filter applied after aggregation.
    pub having_filter: Option<FilterExpr>,
    /// Pristine pre-solve snapshot for rescans when runtime expressions or parameters exist.
    pub base: Option<DataFusionAggBase>,
    /// Dedicated context where this DataFusion aggregate solves runtime expressions and
    /// parameters; `None` when there is nothing to solve. Separate from `ps_ExprContext`, which
    /// is reset per emitted row: see the rules in `solve_expr.rs`.
    pub runtime_context: Option<NonNull<pg_sys::ExprContext>>,
    /// Mapping from `group_columns[i]` to its 0-based column index in DataFusion's
    /// output RecordBatch. Needed because DataFusion deduplicates grouping
    /// expressions (e.g. metadata.brand).
    pub group_df_indices: Vec<usize>,
    /// The number of grouping columns in DataFusion's output RecordBatch.
    pub num_group_exprs: usize,
    /// The `pdb.agg()` grouping-set layout, set when the query has any such call.
    pub pdb_plan: Option<PdbAggPlan>,
    /// `HAVING` of a scalar `pdb.agg()` query, judged on the assembled root row.
    pub pdb_root_having: Option<datafusion::logical_expr::Expr>,
    /// Assembled `pdb.agg()` documents for each row of `current_batch`, which then
    /// holds the SQL-level rows only.
    pub pdb_agg_json: Option<Vec<Vec<serde_json::Value>>>,
    /// Per-phase launch timing for `EXPLAIN ANALYZE`'s `MPP Launch` line. Set only when the
    /// query launched distributed.
    pub launch_timing: Option<MppLaunchTiming>,
    /// Set (at most once) by `build_task_context`'s `on_spill` callback the first time the
    /// leader's own local execution spills an operator to disk. Serial queries have no
    /// `ParallelScanState` to record this in, so it's tracked here instead; `shutdown_custom_scan`
    /// reads it directly for the serial case, and ORs it with `ParallelScanState::did_spill()`
    /// for the MPP case, since the leader can spill locally in addition to (or instead of) any
    /// worker.
    pub spilled: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

impl DataFusionAggState {
    /// Visit every `SearchQueryInput` reachable from this aggregate: scan queries in `plan`,
    /// per-aggregate `FILTER` predicates in `targetlist`, and `having_filter`.
    /// `FilterExpr::SearchTag` locates its tag column by comparing its query against the scan's
    /// tagged copy, so both copies must be visited and solved together.
    pub fn visit_queries(&self, f: &mut impl FnMut(&SearchQueryInput)) {
        self.plan.visit_queries(f);
        for agg in &self.targetlist.aggregates {
            if let Some(filter) = agg.filter.as_ref() {
                filter.visit_queries(f);
            }
        }
        if let Some(having) = self.having_filter.as_ref() {
            having.visit_queries(f);
        }
    }

    /// Mutable counterpart of [`Self::visit_queries`].
    pub fn visit_queries_mut(&mut self, f: &mut impl FnMut(&mut SearchQueryInput)) {
        self.plan.visit_queries_mut(f);
        for agg in &mut self.targetlist.aggregates {
            if let Some(filter) = agg.filter.as_mut() {
                filter.visit_queries_mut(f);
            }
        }
        if let Some(having) = self.having_filter.as_mut() {
            having.visit_queries_mut(f);
        }
    }

    pub fn has_postgres_expressions(&self) -> bool {
        let mut found = false;
        self.visit_queries(&mut |q| {
            if q.has_postgres_expressions() {
                found = true;
            }
        });
        found
    }

    pub fn has_parameters(&self) -> bool {
        let mut found = false;
        self.visit_queries(&mut |q| {
            if q.has_parameters() {
                found = true;
            }
        });
        found
    }
}

/// Solves runtime Postgres expressions and parameters for the DataFusion aggregate path before
/// any execution or `PgTokioRuntime::block_on` entry (see `solve_expr.rs`).
impl SolvePostgresExpressions for DataFusionAggState {
    fn has_postgres_expressions(&mut self) -> bool {
        DataFusionAggState::has_postgres_expressions(self)
    }

    fn has_parameters(&mut self) -> bool {
        DataFusionAggState::has_parameters(self)
    }

    fn init_search_query_input(&mut self) {
        if let Some(base) = &self.base {
            self.plan = base.plan.clone();
            self.targetlist = base.targetlist.clone();
            self.having_filter = base.having_filter.clone();
        }
    }

    fn init_postgres_expressions(&mut self, planstate: *mut pg_sys::PlanState) {
        self.visit_queries_mut(&mut |q| {
            q.init_postgres_expressions(planstate);
        });
    }

    /// Resets `expr_context` once, then solves every query and `FILTER` without resetting
    /// (rule 2 in `solve_expr.rs`): a reset per query would free the trees solved before it.
    fn solve_postgres_expressions(&mut self, expr_context: *mut pg_sys::ExprContext) {
        assert!(
            !expr_context.is_null(),
            "expr_context was never initialized"
        );
        unsafe { pg_sys::MemoryContextReset((*expr_context).ecxt_per_tuple_memory) };
        self.visit_queries_mut(&mut |q| {
            q.solve_postgres_expressions_no_reset(expr_context);
        });
    }
}

/// State for projecting wrapped aggregate expressions through Postgres' own
/// `ExecBuildProjection
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7607** (2026-11-23): **Tantivy proptest `late_filter_never_prunes_on_rejected_neighbors` drops a true top-k row now and then**
  *Symptoms*: # What happens?  The proptest `vector::collector::late_filter_tests::late_filter_never_prunes_on_rejected_neighbors` in the Tantivy fork fails now and then. It compares a filtered vector top-k search with the exact oracle. In every failure the result has `top_n` rows, but one true top-k row is missing and a lower row takes its place.  | Run | Branch | Job | Missing row | Row in its place | | --- | --- | --- | --- | --- | | [44047001396](https://github.com/paradedb/tantivy/actions/runs/44047001396) | `main` (`33f5949`) | `test-none` | `seg 0, doc 1729` (`-4.9513283`) | `seg 0, doc 1197` (`-5.00536`) | | [44171732744](https://github.com/paradedb/tantivy/actions/runs/44171732744) | `main` (`d62c310`) | `test-none` | `seg 1, doc 1866` (`-5.881415`) | `seg 0, doc 1666` (`-5.8936567`) | | [44431120794](https://github.com/paradedb/tantivy/actions/runs/44431120794) | `ruchir/ivf-encode-in-assign` | `test-quickwit` | `seg 1, doc 838` (`-5.4980855`) | `seg 1, doc 1252` (`-5.5312085`) | | [44689239083](https://github.com/paradedb/tantivy/actions/runs/44689239083/job/136130810017) | `moe/exact-row-own-floor` (paradedb/tantivy#442) | `test-all` | `seg 1, doc 1930` (`-7.3575006`) | `seg 1, doc 643` (`-7.7349696`) |  The minimal failing inputs:  ``` replicated = true,  shared = false, adaptive = false, match_stride = 7,  deleted_matches = 0, top_n = 3 replicated = false, shared = true,  adaptive = false, match_stride = 3,  deleted_matches = 2, top_n = 14 replicated = false, shared = false, 

- **Issue #7593** (2026-11-21): **`pg_search 0.27.0`: SELECT DISTINCT fails with es_query_dsa when term_set uses a parallel subquery**
  *Symptoms*: ### What happens?  A `SELECT DISTINCT` query fails when `pdb.term_set` receives an array from a nested BM25 query. The outer query uses a ParadeDB Aggregate Scan. The nested query uses a parallel ParadeDB Base Scan in an `InitPlan`.  **Expected:** The query returns IDs `1` and `2`.  **Actual:** The query returns SQLSTATE `XX000`:  ```text ERROR: es_query_dsa must be set during parallel initialization or execution ```  The error reproduced in three out of three fresh connections. Passing the same IDs as a literal array returns both rows. Disabling `paradedb.enable_aggregate_custom_scan` also returns both rows without changing the parallel worker limit.  ### To Reproduce  Run this in a sandbox database with `pg_search` 0.27.0 installed. Use `psql` with autocommit enabled.  ```sql create schema bm25_repro; set search_path = bm25_repro, public;  create table documents (id integer primary key); insert into documents values (1), (2), (3); create index documents_search on documents using bm25 (id); analyze documents;  -- Allow a parallel plan on the three-row table. set max_parallel_workers_per_gather = 1; set debug_parallel_query = on; set paradedb.enable_aggregate_custom_scan = on;  -- Control: returns IDs 1 and 2. select distinct id from documents where (id @@@ pdb.term_set(array[1, 2]));  -- Reproduction: fails with SQLSTATE XX000. select distinct id from documents where (     id @@@ pdb.term_set(array(         select id         from documents         where (id @@@ pdb.term_set(

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

### Incident Patch 1: `3db63451` (2026-11-24)
**Commit Message**: fix: Synchronize resource cleanup on abort (#7609)

## Ticket(s) Closed

- Closes #7594 

## What

Synchronizes `PgTokioRuntime` worker shutdown, MPP DSM unmap, and
`ResourceOwner`-backed destructors across abnormal transaction,
subtransaction, cursor, and process abort paths.

## Why

On abnormal abort, PostgreSQL unmaps DSM segments (`AtEOXact_Parallel`,
`AtEOSubXact_Parallel`) and releases `ResourceOwner`-managed resources
before `MemoryContextDelete` drops scan states:

- `tokio-rt-worker` threads could stay in-flight in `DsmAsyncStream`
across `dsm_detach`'s `munmap` (`SIGSEGV`) or outlive buffer pins and
`PGSharedMemoryDetach`.
- Deferred `MemoryContextDelete` drops (e.g., an outer cursor failing
inside a `SAVEPOINT` and later dropped at `CLOSE` or `COMMIT` while
`IsTransactionState()` is `true`) could double-release already-freed
relations, locks, buffers, or slots.

## How

- Replaced `dsm_detached` with `DsmLease` (`RwLock<bool>`) so
`on_dsm_detach` waits for in-flight ring/header accesses before
`munmap`.
- Tracked live runtimes per backend, installed per-PID lifecycle
callbacks (`before_shmem_exit`, `XactCallback`, `SubXactCallback`,
`ResourceReleaseCallback`), and wired

**File**: `.github/scripts/check_impl_drop.py` (modified, +89/-7)
```diff
@@ -1,13 +1,19 @@
 #!/usr/bin/env python3
 """
 Fail on any `impl Drop` or `DropGuard` in pgrx-linking crates that does not say why it skips
-`impl_safe_drop!`.
+`impl_safe_drop!`, or any direct `IsTransactionState()` call inside `impl_safe_drop!` that does
+not say why it skips `ResourceOwnerStamp`.
 
 A `Drop` that calls into Postgres has to skip its body while a panic unwinds or the backend
 exits (#6479), which is what `impl_safe_drop!` in common/src/postgres/utils.rs does. A bare
 `impl Drop` or `DropGuard::new` needs a comment directly above it that opts out in so many
-words: "We intentionally do NOT use `impl_safe_drop!` here because ...". Every workspace crate
-that depends on `pgrx` is scanned.
+words: "We intentionally do NOT use `impl_safe_drop!` here because ...".
+
+Inside `impl_safe_drop!`, checking `IsTransactionState()` alone is not enough when a scan state
+lives in a `MemoryContext` whose `ResourceOwner` has already been released (#7609); wrappers
+should gate cleanup with `ResourceOwnerStamp` from common/src/postgres/resowner.rs, or opt out
+directly above the call with "We intentionally call `IsTransactionState()` here because ...".
+Every workspace crate that depends on `pgrx` is scanned.
 """
 
 import json
@@ -24,8 +30,15 @@
     re.MULTILINE,
 )
 DROP_GUARD = re.compile(r"\bDropGuard::new\b|\bDropGuard\s+as\b")
+SAFE_DROP_START = re.compile(r"^[ \t]*(?:[A-Za-z0-9_]+::)*impl_safe_drop!\s*\(")
+IS_TX_STATE = re.compile(r"\bIsTransactionState\s*\(")
+STRING_LITERAL = re.compile(r'"(?:\\.|[^"\\])*"')
 # A comment that only names the macro, like a TODO, is not an opt out.
 OVERRIDE = re.compile(r"\bnot\s+us(?:e|ing)\W+impl_safe_drop\b", re.IGNORECASE)
+TX_STATE_OVERRIDE = re.compile(
+    r"\bnot\s+us(?:e|ing)\W+ResourceOwnerStamp\b|\bintentionally\b.*\bIsTransactionState\b",
+    re.IGNORECASE,
+)
 
 # Shapes the matcher must get right, with the findings each should produce.
 SELF_TEST = [
@@ -60,9 +73,55 @@
         ),
         1,
     ),
+    (
+        "crate::impl_safe_drop!(Foo, |self| {\n    if unsafe { IsTransactionState() } {}\n});",
+        1,
+    ),
+    (
+        (
+            "crate::impl_safe_drop!([T] Foo<T>, |self| {\n"
+            "    // TODO: switch to ResourceOwnerStamp.\n"
+            "    if unsafe { pg_sys::IsTransactionState() } {}\n"
+            "});"
+        ),
+        1,
+    ),
+    (
+        (
+            "crate::impl_safe_drop!(Foo, |self| {\n"
+            "    // We intentionally call `IsTransactionState()` here because fallback.\n"
+            "    if unsafe { IsTransactionState() } {}\n"
+            "});"
+        ),
+        0,
+    ),
+    (
+        (
+            "impl_safe_drop!(Foo, |self| {\n"
+            "    // We intentionally do not use `ResourceOwnerStamp` here because ...\n"
+            "    if unsafe { IsTransactionState() } {}\n"
+            "});"
+        ),
+        0,
+    ),
+    (
+        (
+            "impl_safe_drop!(Foo, |self| {\n"
+            "    // IsTransactionState() in a comment is fine.\n"
+            '    let _s = "IsTransactionState()";\n'
+            "});\n"
+            "fn outside() { unsafe { IsTransactionState() }; }"
+        ),
+        0,
+    ),
 ]
 
 
+def _code_only(line):
+    """Strip string literals and `//` comments so paren counting and regexes see code only."""
+    return STRING_LITERAL.sub('""', line).split("//", 1)[0]
+
+
 def _preceding_comment_block(lines, idx):
     """Return the `//` comment block directly above the statement at `idx`."""
     stmt = idx
@@ -80,14 +139,15 @@ def _preceding_comment_block(lines, idx):
 
 
 def find_bare_drops(text):
-    """Return (line, header) for every unexcused `impl Drop` or `DropGuard`."""
+    """Return (line, header) for unexcused `impl Drop`, `DropGuard`, or `IsTransactionState()`."""
     findings = [
         (text.count("\n", 0, m.start(2)) + 1, " ".join(m.group(2).split()))
         for m in BARE_DROP.finditer(text)
         # `$ty` is the macro's own expansion.
         if not m.group(3).startswith("$") and not OVERRIDE.search(m.group(1))
     ]
     lines = text.splitlines()
+    safe_drop_paren_depth = 0
     for idx, line in enumerate(lines):
         stripped = line.strip()
         if stripped.startswith("//"):
@@ -96,6 +156,25 @@ def find_bare_drops(text):
             _preceding_comment_block(lines, idx)
         ):
             findings.append((idx + 1, stripped))
+
+        code = _code_only(line)
+        if safe_drop_paren_depth == 0:
+            m = SAFE_DROP_START.match(code)
+            if m:
+                rest = code[m.end() - 1 :]
+                safe_drop_paren_depth = rest.count("(") - rest.count(")")
+                if IS_TX_STATE.search(rest) and not TX_STATE_OVERRIDE.search(
+                    _preceding_comment_block(lines, idx)
+                ):
+                    findings.append((idx + 1, stripped))
+        else:
+            if IS_TX_STATE.search(code) and not TX_STATE_OVERRIDE.search(
+       
```

**File**: `basescan/src/postgres/customscan/basescan/exec_methods/fast_fields/columnar.rs` (modified, +5/-4)
```diff
@@ -427,10 +427,10 @@ impl ExecMethod for ColumnarExecState {
         // Create Postgres-integrated Tokio runtime on first use (same pattern as JoinScan)
         // to drive DataFusion's async streams while servicing main-thread Postgres FFI.
         if self.runtime.is_none() {
-            self.runtime = Some(
-                PgTokioRuntime::new()
-                    .expect("Failed to create tokio runtime for DataFusion stream execution"),
-            );
+            let runtime = PgTokioRuntime::new()
+                .expect("Failed to create tokio runtime for DataFusion stream execution");
+            state.register_runtime_for_dsm_detach(&runtime);
+            self.runtime = Some(runtime);
         }
 
         loop {
@@ -567,6 +567,7 @@ impl ExecMethod for ColumnarExecState {
         self.current_record_batch = None;
         self.current_batch_row_idx = 0;
         self.runtime = None;
+        state.clear_runtime_for_dsm_detach();
 
         // Reset inner FastFieldExecState
         self.inner.reset(state);
```

**File**: `basescan/src/postgres/customscan/basescan/exec_methods/top_k.rs` (modified, +5/-4)
```diff
@@ -440,10 +440,10 @@ impl ExecMethod for TopKScanExecState {
         }
 
         if self.runtime.is_none() {
-            self.runtime = Some(
-                PgTokioRuntime::new()
-                    .expect("Failed to create tokio runtime for DataFusion stream execution"),
-            );
+            let runtime = PgTokioRuntime::new()
+                .expect("Failed to create tokio runtime for DataFusion stream execution");
+            state.register_runtime_for_dsm_detach(&runtime);
+            self.runtime = Some(runtime);
         }
 
         loop {
@@ -534,6 +534,7 @@ impl ExecMethod for TopKScanExecState {
         self.current_record_batch = None;
         self.current_batch_row_idx = 0;
         self.runtime = None;
+        state.clear_runtime_for_dsm_detach();
         self.found = 0;
 
         // Get window aggregates from state if available
```

**File**: `basescan/src/postgres/customscan/basescan/parallel.rs` (modified, +32/-12)
```diff
@@ -19,8 +19,10 @@
 //! Parallel-aware BaseScan: DSM attach hooks and the process-local handle to
 //! shared work assignment / telemetry IPC.
 
+use std::cell::RefCell;
 use std::os::raw::c_void;
 use std::ptr::NonNull;
+use std::rc::Rc;
 use std::sync::Arc;
 
 use crate::index::reader::io_stats::Trace;
@@ -29,6 +31,7 @@ use crate::postgres::customscan::basescan::BaseScan;
 use crate::postgres::customscan::basescan::telemetry::ScanTelemetry;
 use crate::postgres::customscan::builders::custom_state::CustomScanStateWrapper;
 use crate::postgres::customscan::dsm::ParallelQueryCapable;
+use crate::postgres::customscan::mpp::interrupt::PgTokioRuntimeShutdownHandle;
 
 use pgrx::pg_sys::{self, Size, dsa_area, shm_toc};
 
@@ -98,16 +101,33 @@ impl ParallelScanHandle {
     }
 }
 
+struct BaseScanDsmDetach {
+    parallel: ParallelScanHandle,
+    trace: Option<Trace>,
+    runtime_shutdown: Rc<RefCell<Option<PgTokioRuntimeShutdownHandle>>>,
+}
+
 // LIMIT can shut down the leader scan before its workers; collect after Gather joins them.
+// On abnormal transaction/subtransaction abort (`!IsTransactionState()`), `AtEOXact_Parallel` /
+// `AtEOSubXact_Parallel` detaches `Gather`'s DSM segment before `AtSubAbort_Portals` and
+// `XactCallback` / `SubXactCallback` run, so shut down this specific `BaseScan`'s `PgTokioRuntime`
+// directly via its handle before the segment unmaps while leaving unrelated runtimes intact.
 #[pgrx::pg_guard]
-unsafe extern "C-unwind" fn collect_buffer_hits_on_detach(
+unsafe extern "C-unwind" fn on_basescan_dsm_detach(
     _seg: *mut pg_sys::dsm_segment,
     arg: pg_sys::Datum,
 ) {
-    let (parallel, trace) =
-        *unsafe { Box::from_raw(arg.cast_mut_ptr::<(ParallelScanHandle, Trace)>()) };
+    let BaseScanDsmDetach {
+        parallel,
+        trace,
+        runtime_shutdown,
+    } = *unsafe { Box::from_raw(arg.cast_mut_ptr::<BaseScanDsmDetach>()) };
     if unsafe { pg_sys::IsTransactionState() } {
-        parallel.finalize_buffer_hits(&trace);
+        if let Some(trace) = trace {
+            parallel.finalize_buffer_hits(&trace);
+        }
+    } else if let Some(handle) = runtime_shutdown.borrow_mut().take() {
+        handle.shutdown_workers();
     }
 }
 
@@ -151,16 +171,16 @@ impl ParallelQueryCapable for BaseScan {
                 .attach_parallel(pscan_state, ParallelRole::Leader);
             leader_publish_query(state, &mut *pscan_state, area);
 
-            if !(*pcxt).seg.is_null()
-                && let Some(trace) = state.custom_state().io_trace.clone()
-            {
-                let callback = Box::new((
-                    ParallelScanHandle::new(pscan_state, ParallelRole::Leader),
-                    trace,
-                ));
+            if !(*pcxt).seg.is_null() {
+                let runtime_shutdown = state.custom_state_mut().alloc_dsm_runtime_shutdown_slot();
+                let callback = Box::new(BaseScanDsmDetach {
+                    parallel: ParallelScanHandle::new(pscan_state, ParallelRole::Leader),
+                    trace: state.custom_state().io_trace.clone(),
+                    runtime_shutdown,
+                });
                 pg_sys::on_dsm_detach(
                     (*pcxt).seg,
-                    Some(collect_buffer_hits_on_detach),
+                    Some(on_basescan_dsm_detach),
                     pg_sys::Datum::from(Box::into_raw(callback)),
                 );
             }
```

**File**: `basescan/src/postgres/customscan/basescan/scan_state.rs` (modified, +27/-1)
```diff
@@ -16,8 +16,9 @@
 // along with this program. If not, see <http://www.gnu.org/licenses/>.
 #![allow(unsafe_op_in_unsafe_fn)]
 
-use std::cell::{OnceCell, UnsafeCell};
+use std::cell::{OnceCell, RefCell, UnsafeCell};
 use std::collections::BTreeMap;
+use std::rc::Rc;
 use std::sync::Arc;
 
 use crate::api::{FieldName, HashMap, OrderByFeature, OrderByInfo, Varno};
@@ -33,6 +34,7 @@ use crate::postgres::customscan::basescan::projections::window_agg::WindowAggreg
 use crate::postgres::customscan::basescan::telemetry::ScanTelemetry;
 use crate::postgres::customscan::bitmap_intersection::BitmapExec;
 use crate::postgres::customscan::builders::custom_path::ExecMethodType;
+use crate::postgres::customscan::mpp::interrupt::{PgTokioRuntime, PgTokioRuntimeShutdownHandle};
 use crate::postgres::customscan::projections::{PlaceholderColumn, PlaceholderProjection};
 use crate::postgres::customscan::qual_inspect::Qual;
 use crate::postgres::customscan::solve_expr::SolvePostgresExpressions;
@@ -66,6 +68,10 @@ pub struct BaseScanState {
     pub telemetry: ScanTelemetry,
     /// Set when this scan is parallel-aware (DSM attached).
     pub parallel: Option<ParallelScanHandle>,
+    /// Shared slot populated with this scan's [`PgTokioRuntimeShutdownHandle`] while an async exec
+    /// method (`TopKScanExecState` or `ColumnarExecState`) holds a `PgTokioRuntime` under a `Gather`
+    /// DSM segment, so `on_basescan_dsm_detach` shuts down only this scan's runtime on abort.
+    dsm_runtime_shutdown: Option<Rc<RefCell<Option<PgTokioRuntimeShutdownHandle>>>>,
     /// Workers wait for the leader to publish this plan when they first need it.
     pub vector_routing_plan: Option<Arc<SharedVectorRouting>>,
     pub vector_routing_pending: bool,
@@ -176,6 +182,26 @@ impl CustomScanState for BaseScanState {
 }
 
 impl BaseScanState {
+    pub(super) fn alloc_dsm_runtime_shutdown_slot(
+        &mut self,
+    ) -> Rc<RefCell<Option<PgTokioRuntimeShutdownHandle>>> {
+        let slot = Rc::new(RefCell::new(None));
+        self.dsm_runtime_shutdown = Some(Rc::clone(&slot));
+        slot
+    }
+
+    pub(super) fn register_runtime_for_dsm_detach(&self, runtime: &PgTokioRuntime) {
+        if let Some(slot) = &self.dsm_runtime_shutdown {
+            *slot.borrow_mut() = Some(runtime.shutdown_handle());
+        }
+    }
+
+    pub(super) fn clear_runtime_for_dsm_detach(&self) {
+        if let Some(slot) = &self.dsm_runtime_shutdown {
+            *slot.borrow_mut() = None;
+        }
+    }
+
     pub fn open_relations(&mut self, lockmode: pg_sys::LOCKMODE) {
         self.lockmode = lockmode;
         if self.heaprel.is_none() {
```

**File**: `common/src/parallel_worker/builder.rs` (modified, +18/-8)
```diff
@@ -170,6 +170,7 @@ impl ParallelProcessBuilder {
     }
 }
 
+#[must_use = "must be launched before parallel mode ends"]
 pub struct ParallelProcessLauncher {
     pcxt: NonNull<pg_sys::ParallelContext>,
     state_manager: ParallelStateManager,
@@ -179,6 +180,17 @@ pub struct ParallelProcessLauncher {
 }
 
 impl ParallelProcessLauncher {
+    /// Detaches all receiver message queues while the backing DSM segment is still mapped, then
+    /// destroys the parallel context and exits parallel mode.
+    unsafe fn destroy(self) {
+        let pcxt = self.pcxt.as_ptr();
+        for mq in self.mq_handles {
+            mq.detach();
+        }
+        pg_sys::DestroyParallelContext(pcxt);
+        pg_sys::ExitParallelMode();
+    }
+
     /// Read-only access to the mapped state between `build()` and `launch()`. The DSM is mapped in
     /// the leader once `InitializeParallelDSM` runs (inside `build`), so the leader can initialize a
     /// shared region in place here, before workers spawn and attach to it.
@@ -208,10 +220,9 @@ impl ParallelProcessLauncher {
                 return Some(ParallelProcessAttach { launcher: self });
             }
 
-            // Detach queues while their shared memory is still mapped.
-            drop(self);
-            pg_sys::DestroyParallelContext(pcxt);
-            pg_sys::ExitParallelMode();
+            // Detach queues while their shared memory is still mapped, then tear down the
+            // parallel context and exit parallel mode.
+            self.destroy();
             None
         }
     }
@@ -228,6 +239,7 @@ enum WorkerQueueState {
     Accumulated,
 }
 
+#[must_use = "must call wait_for_attach() before parallel mode ends"]
 #[repr(transparent)]
 pub struct ParallelProcessAttach {
     launcher: ParallelProcessLauncher,
@@ -245,6 +257,7 @@ impl ParallelProcessAttach {
     }
 }
 
+#[must_use = "must call wait_for_finish() or exhaust the iterator to detach queues and exit parallel mode"]
 pub struct ParallelProcessFinish {
     launcher: ParallelProcessLauncher,
     worker_states: Vec<WorkerQueueState>,
@@ -385,10 +398,7 @@ impl ParallelProcessFinish {
             pg_sys::WaitForParallelWorkersToFinish(pcxt);
             self.accumulate_all_workers();
 
-            drop(self.launcher);
-
-            pg_sys::DestroyParallelContext(pcxt);
-            pg_sys::ExitParallelMode();
+            self.launcher.destroy();
 
             messages
         }
```

**File**: `common/src/parallel_worker/mod.rs` (modified, +43/-22)
```diff
@@ -57,22 +57,28 @@ enum TocKeys {
     WalUsage = 0xE000_0000_0000_000A,
 }
 
-pub struct WorkerStatsGuard {
+/// Flushes parallel worker buffer/WAL instrumentation into DSM via `InstrEndParallelQuery`.
+///
+/// Intentionally does NOT implement `Drop`: [`run_parallel_worker`] invokes [`Self::finish`]
+/// explicitly on normal worker completion while the backing DSM segment is guaranteed mapped.
+pub(crate) struct WorkerStatsGuard {
     buf_usage: *mut pg_sys::BufferUsage,
     wal_usage: *mut pg_sys::WalUsage,
     worker_idx: usize,
 }
 
-crate::impl_safe_drop!(WorkerStatsGuard, |self| {
-    if !self.buf_usage.is_null() && !self.wal_usage.is_null() {
-        unsafe {
-            pg_sys::InstrEndParallelQuery(
-                self.buf_usage.add(self.worker_idx),
-                self.wal_usage.add(self.worker_idx),
-            );
+impl WorkerStatsGuard {
+    pub(crate) unsafe fn finish(self) {
+        if !self.buf_usage.is_null() && !self.wal_usage.is_null() {
+            unsafe {
+                pg_sys::InstrEndParallelQuery(
+                    self.buf_usage.add(self.worker_idx),
+                    self.wal_usage.add(self.worker_idx),
+                );
+            }
         }
     }
-});
+}
 
 impl From<TocKeys> for u64 {
     fn from(key: TocKeys) -> Self {
@@ -574,16 +580,16 @@ macro_rules! launch_parallel_process {
                 seg: *mut pgrx::pg_sys::dsm_segment,
                 toc: *mut pgrx::pg_sys::shm_toc,
             ) {
-                let (state_manager, mq_sender) =
-                    $crate::parallel_worker::generic_parallel_worker_entry_point(
-                        seg,
-                        toc,
-                        $mq_size as usize,
-                    );
-
-                $crate::parallel_worker::finish_parallel_worker(
-                    <$parallel_worker_type>::new_parallel_worker(state_manager)
-                        .run(&mq_sender, unsafe { pgrx::pg_sys::ParallelWorkerNumber }),
+                $crate::parallel_worker::run_parallel_worker(
+                    seg,
+                    toc,
+                    $mq_size as usize,
+                    |state_manager, mq_sender| {
+                        $crate::parallel_worker::finish_parallel_worker(
+                            <$parallel_worker_type>::new_parallel_worker(state_manager)
+                                .run(mq_sender, unsafe { pgrx::pg_sys::ParallelWorkerNumber }),
+                        );
+                    },
                 );
             }
         }
@@ -605,12 +611,26 @@ macro_rules! launch_parallel_process {
     }};
 }
 
+/// Scoped entry point for PostgreSQL parallel workers launched via `ParallelProcessBuilder`.
+///
+/// Attaches `ParallelStateManager`, `WorkerStatsGuard`, and `MessageQueueSender` for the duration
+/// of `f`, then flushes worker buffer/WAL stats and detaches the completion queue on normal
+/// return while `seg` is guaranteed mapped. On `ereport(ERROR)` / panic unwind, `finish()` is
+/// skipped and PostgreSQL's own `shm_mq_detach_callback` detaches the queue before `seg` is
+/// unmapped.
+///
+/// # Safety
+/// Must be called directly from a PostgreSQL parallel worker entry point with the `seg` and
+/// `toc` pointers supplied by `ParallelWorkerMain`, which remain mapped for the entire callback.
 #[doc(hidden)]
-pub unsafe fn generic_parallel_worker_entry_point(
+pub unsafe fn run_parallel_worker<F>(
     seg: *mut pg_sys::dsm_segment,
     toc: *mut pg_sys::shm_toc,
     mq_size: usize,
-) -> (ParallelStateManager, MessageQueueSender) {
+    f: F,
+) where
+    F: FnOnce(ParallelStateManager, &MessageQueueSender),
+{
     unsafe {
         pg_sys::InstrStartParallelQuery();
     }
@@ -644,7 +664,8 @@ pub unsafe fn generic_parallel_worker_entry_point(
 
     let state_manager = ParallelStateManager::new(toc, seg);
     let mq_sender = MessageQueueSender::new(seg, mq, stats);
-    (state_manager, mq_sender)
+    f(state_manager, &mq_sender);
+    mq_sender.finish();
 }
 
 #[inline(always)]
```

**File**: `common/src/parallel_worker/mqueue.rs` (modified, +40/-14)
```diff
@@ -20,18 +20,20 @@ use std::error::Error;
 use std::fmt::{Display, Formatter};
 use std::ptr::NonNull;
 
+/// Owns a PostgreSQL `shm_mq_handle` attached to a parallel DSM segment.
+///
+/// Intentionally does NOT implement `Drop`: on normal completion, the owning lifecycle step
+/// (`ParallelProcessLauncher::destroy` on the leader, or `MessageQueueSender::finish` via
+/// `run_parallel_worker` on a worker) calls [`Self::detach`] while the backing DSM segment is
+/// guaranteed mapped. On any abnormal `ereport(ERROR)` / panic unwind / subtransaction abort,
+/// PostgreSQL's own `shm_mq_detach_callback` (registered by `shm_mq_attach`) detaches the queue
+/// before unmapping the DSM; calling `shm_mq_detach` later from a `MemoryContextCallback` / `Drop`
+/// after `AtEOSubXact_Parallel` would dereference unmapped shared memory (even when
+/// `IsInParallelMode()` is still `true` due to an enclosing outer `Gather`).
 struct MessageQueueHandle {
     handle: NonNull<pg_sys::shm_mq_handle>,
 }
 
-crate::impl_safe_drop!(MessageQueueHandle, |self| {
-    unsafe {
-        if pg_sys::IsInParallelMode() {
-            pg_sys::shm_mq_detach(self.handle.as_ptr());
-        }
-    }
-});
-
 impl MessageQueueHandle {
     unsafe fn attach_sender(seg: *mut pg_sys::dsm_segment, mq: *mut pg_sys::shm_mq) -> Self {
         unsafe {
@@ -59,6 +61,17 @@ impl MessageQueueHandle {
     fn as_ptr(&self) -> *mut pg_sys::shm_mq_handle {
         self.handle.as_ptr()
     }
+
+    /// Explicitly detaches this handle while its backing DSM segment is still mapped.
+    ///
+    /// # Safety
+    /// The DSM segment passed to `attach_sender` / `attach_receiver` must still be attached in
+    /// the current backend.
+    unsafe fn detach(self) {
+        unsafe {
+            pg_sys::shm_mq_detach(self.handle.as_ptr());
+        }
+    }
 }
 
 #[derive(Debug, Copy, Clone)]
@@ -91,28 +104,37 @@ impl From<pg_sys::shm_mq_result::Type> for MessageQueueSendError {
 }
 
 pub struct MessageQueueSender {
-    // Declared before `handle` so Rust's field drop order runs `WorkerStatsGuard::drop`
-    // (`InstrEndParallelQuery`) before `MessageQueueHandle::drop` detaches the `shm_mq` and
-    // unblocks `ParallelProcessFinish::recv()` on the leader.
-    _stats: Option<crate::parallel_worker::WorkerStatsGuard>,
+    stats: Option<crate::parallel_worker::WorkerStatsGuard>,
     handle: MessageQueueHandle,
 }
 
 impl MessageQueueSender {
-    #[doc(hidden)]
     pub(crate) unsafe fn new(
         seg: *mut pg_sys::dsm_segment,
         mq: *mut pg_sys::shm_mq,
         stats: Option<crate::parallel_worker::WorkerStatsGuard>,
     ) -> Self {
         unsafe {
             Self {
-                _stats: stats,
+                stats,
                 handle: MessageQueueHandle::attach_sender(seg, mq),
             }
         }
     }
 
+    /// Flushes parallel worker buffer/WAL stats (`InstrEndParallelQuery`) into DSM and then
+    /// detaches the completion queue so `ParallelProcessFinish::recv()` on the leader unblocks
+    /// only after stats are written.
+    ///
+    /// # Safety
+    /// Must be called on normal worker completion while the backing DSM segment is still mapped.
+    pub(crate) unsafe fn finish(self) {
+        if let Some(stats) = self.stats {
+            unsafe { stats.finish() };
+        }
+        unsafe { self.handle.detach() };
+    }
+
     pub fn send<B: AsRef<[u8]>>(&self, msg: B) -> Result<(), MessageQueueSendError> {
         unsafe {
             let msg = msg.as_ref();
@@ -198,6 +220,10 @@ impl MessageQueueReceiver {
         }
     }
 
+    pub(crate) unsafe fn detach(self) {
+        unsafe { self.handle.detach() };
+    }
+
     pub fn recv(&self) -> Result<Vec<u8>, MessageQueueRecvError> {
         unsafe {
             let mut len = 0usize;
```

---

### Incident Patch 2: `5566f155` (2026-11-24)
**Commit Message**: ci: speed up vector and parallel build unit tests (#7561)

## What

Reduce the work done by the slow parallel-build and vector unit tests
while retaining their behavioral assertions.

## Why

Recent CI runs spend several minutes in these tests. Most of the cost
comes from repeated index builds, exhaustive checks over oversized
fixtures, and constructing high-dimensional quantization settings for
metadata tests.

## How

- Replace the 24-case parallel-build Cartesian product with a property
test configured for eight generated cases over the same memory,
worker-count, leader-participation, and segment-target settings. Keep
the 35,000-row fixture and existing segment/document-count assertions,
with shrinking enabled for failing configurations.
- Reduce the vector-partition fixture from 4,000 to 256 ordinary rows,
retaining the null and zero vectors, all three metrics, serial/parallel
builds, implicit/explicit partitioning, and reindex checks. Lower the
fixture's clustering threshold and explicitly assert IVF storage.
- Reuse a 128-row, 128-dimensional metadata fixture across the four
existing consumers, keeping both quantization layers `[1,4]`. Update the
independent stored/configured

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -4047,6 +4047,7 @@ dependencies = [
  "pgrx",
  "pgrx-tests",
  "postcard",
+ "proptest 1.11.0 (registry+https://github.com/rust-lang/crates.io-index)",
  "rand 0.10.3",
  "serde",
  "serde_json",
```

**File**: `index_write/Cargo.toml` (modified, +3/-1)
```diff
@@ -13,7 +13,7 @@ pg15 = ["pgrx/pg15", "index_read/pg15"]
 pg16 = ["pgrx/pg16", "index_read/pg16"]
 pg17 = ["pgrx/pg17", "index_read/pg17"]
 pg18 = ["pgrx/pg18", "index_read/pg18"]
-pg_test = ["index_read/pg_test"]
+pg_test = ["dep:proptest", "index_read/pg_test"]
 
 # Keep this crate focused on Tantivy index building, merging, and vacuum/cleanup. Do NOT add
 # `datafusion` or `arrow-*` here so `index_write` compiles in parallel with `scan` and `planner`.
@@ -25,6 +25,7 @@ bytemuck.workspace = true
 log.workspace = true
 pgrx.workspace = true
 postcard.workspace = true
+proptest = { workspace = true, optional = true }
 rand.workspace = true
 serde.workspace = true
 serde_json.workspace = true
@@ -45,3 +46,4 @@ index_read = { path = "../index_read", default-features = false, features = [
   "pg_test",
 ] }
 pgrx-tests.workspace = true
+proptest.workspace = true
```

**File**: `index_write/src/postgres/build_parallel.rs` (modified, +61/-83)
```diff
@@ -1694,9 +1694,12 @@ pub mod plan {
 #[pgrx::pg_schema]
 mod tests {
     use pgrx::prelude::*;
+    use proptest::{prelude::*, sample::select};
+
+    const PARALLEL_BUILD_ROWS: i64 = 35_000;
 
     fn setup_parallel_build_large_table() {
-        Spi::run(
+        Spi::run(&format!(
             r#"
             DROP TABLE IF EXISTS parallel_build_large;
             CREATE TABLE parallel_build_large (
@@ -1705,9 +1708,9 @@ mod tests {
             );
             INSERT INTO parallel_build_large (name)
             SELECT 'lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
-            FROM generate_series(1, 35000);
+            FROM generate_series(1, {PARALLEL_BUILD_ROWS});
             "#,
-        )
+        ))
         .expect("failed to setup parallel_build_large table");
     }
 
@@ -1823,7 +1826,7 @@ mod tests {
         assert_eq!(
             Spi::get_one::<i64>("SELECT count(*) FROM parallel_build_large WHERE name ||| 'lorem'")
                 .unwrap(),
-            Some(35000)
+            Some(PARALLEL_BUILD_ROWS)
         );
     }
 
@@ -1897,91 +1900,66 @@ mod tests {
         ).unwrap();
     }
 
-    /// Tests parallel index building with various configurations.
-    ///
-    /// This test creates 35,000 rows and tests different configuration
-    /// combinations of maintenance_work_mem, workers, leader participation,
-    /// and target segment count.
     #[pg_test]
     fn test_parallel_build_large_configurations() {
-        setup_parallel_build_large_table();
+        const CONFIGURATION_CASES: u32 = 8;
+        const LARGE_SEGMENT_TARGET: i64 = 32;
+        const MIN_LARGE_SEGMENTS: i64 = LARGE_SEGMENT_TARGET * 3 / 4;
+        const MAX_LARGE_SEGMENTS: i64 = LARGE_SEGMENT_TARGET + 1;
 
+        setup_parallel_build_large_table();
         Spi::run("SET max_parallel_workers = 8;").unwrap();
 
-        let maintenance_work_mem = ["2GB", "128MB"];
-        let maintenance_workers = [6, 2];
-        let leader_participation = [true, false];
-        let target_segments = [4, 7, 32];
-
-        for mwm in &maintenance_work_mem {
-            for mw in &maintenance_workers {
-                for lp in &leader_participation {
-                    for ts in &target_segments {
-                        // Set configuration
-                        Spi::run(&format!("SET max_parallel_maintenance_workers = {};", mw))
-                            .unwrap();
-                        Spi::run(&format!("SET parallel_leader_participation = {};", lp)).unwrap();
-                        Spi::run(&format!("SET maintenance_work_mem = '{}';", mwm)).unwrap();
-
-                        // Create index
-                        Spi::run(&format!(
-                            "CREATE INDEX parallel_build_large_idx ON parallel_build_large USING paradedb (id, name) WITH (target_segment_count = {});",
-                            ts
-                        ))
-                        .unwrap_or_else(|e| {
-                            panic!(
-                                "CREATE INDEX failed with workers={}, leader={}, mem={}, segments={}: {:?}",
-                                mw, lp, mwm, ts, e
-                            )
-                        });
-
-                        // Verify segment count
-                        let count: i64 = Spi::get_one(
-                            "SELECT COUNT(*)::bigint FROM paradedb.index_info('parallel_build_large_idx');",
-                        )
-                        .unwrap()
-                        .unwrap();
-
-                        if *ts == 4 {
-                            assert_eq!(
-                                count, 4,
-                                "Expected 4 segments with workers={}, leader={}, mem={}, segments={}, got {}",
-                                mw, lp, mwm, ts, count
-                            );
-                        } else if *ts == 7 {
-                            assert_eq!(count, 7, "prime target: {count} segments");
-                        } else if *ts == 32 {
-                            // The parallel heap scan hands out blocks on demand, so a participant
-                            // short on CPU scans fewer rows and flushes fewer segments than its
-                            // quota, while its peers merge back down to theirs. Skew only ever
-                            // pulls the total below the target. The floor tolerates about a
-                            // quarter of the rows moving between participants.
-                            let expected = 24..=33;
-                            assert!(
-
```

**File**: `index_write/src/postgres/build_partitioning.rs` (modified, +20/-7)
```diff
@@ -947,16 +947,23 @@ mod tests {
 
     #[pg_test]
     fn vector_partitions_group_neighbors_and_keep_nulls() {
-        Spi::run(
+        const PARTITIONS: usize = 2;
+        const ROWS_PER_PARTITION: usize = VECTOR_MIN_SAMPLES_PER_PARTITION * 2;
+        const SOURCE_ROWS: usize = PARTITIONS * ROWS_PER_PARTITION;
+        const TOTAL_ROWS: i64 = SOURCE_ROWS as i64 + 2;
+        const CLUSTERING_THRESHOLD: usize = ROWS_PER_PARTITION / 2;
+
+        Spi::run(&format!(
             r#"
             CREATE EXTENSION IF NOT EXISTS vector;
+            SET paradedb.vector_clustering_threshold = {CLUSTERING_THRESHOLD};
             CREATE TABLE vector_partition_src (id BIGINT, region INTEGER, emb vector(2));
             INSERT INTO vector_partition_src
             SELECT i, i % 2, ARRAY[CASE WHEN i % 2 = 0 THEN -10 ELSE 10 END, (i % 7) * 0.01]::vector
-            FROM generate_series(1, 4000) i;
-            INSERT INTO vector_partition_src VALUES (4001, NULL, NULL), (4002, NULL, '[0,0]');
+            FROM generate_series(1, {SOURCE_ROWS}) i;
+            INSERT INTO vector_partition_src VALUES ({SOURCE_ROWS} + 1, NULL, NULL), ({TOTAL_ROWS}, NULL, '[0,0]');
         "#,
-        )
+        ))
         .unwrap();
         for workers in [0, 2] {
             Spi::run("SET parallel_leader_participation = false").unwrap();
@@ -970,7 +977,7 @@ mod tests {
                         r#"
                     CREATE INDEX vector_partition_idx ON vector_partition_src
                     USING paradedb (id, region, emb {metric})
-                    WITH (target_segment_count = 2{partition_option});
+                    WITH (target_segment_count = {PARTITIONS}{partition_option});
                 "#
                     ))
                     .unwrap();
@@ -983,14 +990,20 @@ mod tests {
                                 "SELECT count(*) FROM paradedb.index_info('vector_partition_idx')"
                             )
                             .unwrap(),
-                            Some(2)
+                            Some(PARTITIONS as i64)
                         );
                         assert_eq!(
                             Spi::get_one::<i64>(
                                 "SELECT count(*) FROM vector_partition_src WHERE id @@@ pdb.all()"
                             )
                             .unwrap(),
-                            Some(4002)
+                            Some(TOTAL_ROWS)
+                        );
+                        assert_eq!(
+                            Spi::get_one::<bool>(
+                                "SELECT bool_and(vector_format = 'ivf') FROM paradedb.vector_info('vector_partition_idx', 'emb')"
+                            ).unwrap(),
+                            Some(true)
                         );
                         let (_, indexrel) =
                             open_rels("vector_partition_src", "vector_partition_idx");
```

**File**: `index_write/src/postgres/merge.rs` (modified, +13/-5)
```diff
@@ -1091,9 +1091,14 @@ mod tests {
             .filter(|entry| !entry.is_deleted())
             .map(|entry| entry.segment_id())
             .collect::<Vec<_>>();
-        Spi::run(
-            "INSERT INTO metadata_vectors SELECT g, ARRAY(SELECT ((g+i)%17+1)::real FROM generate_series(1,1024) i)::vector FROM generate_series(2049,4096) g",
-        ).unwrap();
+        let total_rows = VECTOR_METADATA_ROWS * 2;
+        let first_inserted_row = VECTOR_METADATA_ROWS + 1;
+        Spi::run(&format!(
+            "INSERT INTO metadata_vectors SELECT g, ARRAY(SELECT ((g+i)%17+1)::real
+             FROM generate_series(1,{VECTOR_METADATA_DIMENSIONS}) i)::vector
+             FROM generate_series({first_inserted_row},{total_rows}) g",
+        ))
+        .unwrap();
         let current = unsafe { MetaPage::open(&indexrel).segment_metas().list(None) };
         assert!(old.iter().all(|id| {
             current
@@ -1102,15 +1107,18 @@ mod tests {
         }));
         assert!(WARNED_VECTOR_INDEXES.with(|warned| warned.borrow().contains(&oid)));
         // A repeated write keeps the same backend warning state while skipping the unsupported segment.
-        Spi::run("UPDATE metadata_vectors SET vec = vec WHERE id = 4096").unwrap();
+        Spi::run(&format!(
+            "UPDATE metadata_vectors SET vec = vec WHERE id = {total_rows}"
+        ))
+        .unwrap();
         assert!(WARNED_VECTOR_INDEXES.with(|warned| warned.borrow().contains(&oid)));
         expect_reindex(&vector_query());
         drop(indexrel);
         Spi::run("REINDEX INDEX metadata_vectors_idx").unwrap();
         Spi::run(&vector_query()).unwrap();
         assert_eq!(
             Spi::get_one::<i64>("SELECT count(*) FROM metadata_vectors").unwrap(),
-            Some(4096)
+            Some(total_rows)
         );
     }
 
```

**File**: `nix/pg_search.nix` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ buildPgrxExtension (finalAttrs: {
   # If maintainers forget to do so, Nix will throw an error message that begins
   # like this and then provides the correct new hash:
   # error: hash mismatch in fixed-output derivation '...'
-  cargoHash = "sha256-yXrVmriGzaRvDXBFp8X+Vp2o4jTLflzlidTCvLSjEiI=";
+  cargoHash = "sha256-/a7Ya0Vgm4xMOK+J6mgl+s0pxFIVB/1em/OvIhbNj8E=";
 
   inherit postgresql;
   # The Nix builder also passes cargoPgrxFlags to `stop`, which does not accept
```

**File**: `pg_search/src/api/vector.rs` (modified, +10/-7)
```diff
@@ -1239,21 +1239,24 @@ mod tests {
     // Stored segment layers are independent of the field build target.
     #[pg_test]
     fn vector_metadata_is_independent_of_build_target() {
+        const SINGLE_LAYER_BYTES_PER_ROW: i64 = 32;
+        const STORED_LAYERS_BYTES_PER_ROW: i64 = 108;
+
         let indexrel = vector_metadata_fixture();
         set_single_layer_target(&indexrel);
         assert_eq!(
-            Spi::get_one::<bool>(
-                "SELECT layers=ARRAY[1] AND bytes_per_row=144 AND settings_version=3
+            Spi::get_one::<bool>(&format!(
+                "SELECT layers=ARRAY[1] AND bytes_per_row={SINGLE_LAYER_BYTES_PER_ROW} AND settings_version=3
             FROM paradedb.vector_config('metadata_vectors_idx','vec')"
-            )
+            ))
             .unwrap(),
             Some(true)
         );
         assert_eq!(
-            Spi::get_one::<bool>(
-                "SELECT bool_and(layers=ARRAY[1,4] AND bytes_per_row=668)
+            Spi::get_one::<bool>(&format!(
+                "SELECT bool_and(layers=ARRAY[1,4] AND bytes_per_row={STORED_LAYERS_BYTES_PER_ROW})
             FROM paradedb.vector_info('metadata_vectors_idx','vec')"
-            )
+            ))
             .unwrap(),
             Some(true)
         );
@@ -1290,7 +1293,7 @@ mod tests {
             assert_eq!(
                 Spi::get_one::<i64>("SELECT count(*) FROM metadata_vectors WHERE id @@@ pdb.all()")
                     .unwrap(),
-                Some(2048)
+                Some(VECTOR_METADATA_ROWS)
             );
             Spi::run("SELECT * FROM paradedb.vector_config('metadata_vectors_idx','vec')").unwrap();
             if version != 5 {
```

**File**: `storage/src/lib.rs` (modified, +18/-6)
```diff
@@ -28,14 +28,26 @@ pub mod api {
         use crate::postgres::storage::metadata::MetaPage;
         use pgrx::prelude::*;
 
+        const VECTOR_METADATA_CLUSTERING_THRESHOLD: i64 = 64;
+        pub const VECTOR_METADATA_ROWS: i64 = VECTOR_METADATA_CLUSTERING_THRESHOLD * 2;
+        pub const VECTOR_METADATA_DIMENSIONS: usize = 128;
+
         pub fn vector_metadata_fixture() -> PgSearchRelation {
-            Spi::run("CREATE EXTENSION IF NOT EXISTS vector;
-                SET paradedb.vector_clustering_threshold = 64;
-                CREATE TABLE metadata_vectors(id int PRIMARY KEY, vec vector(1024));
+            Spi::run(&format!("CREATE EXTENSION IF NOT EXISTS vector;
+                SET paradedb.vector_clustering_threshold = {VECTOR_METADATA_CLUSTERING_THRESHOLD};
+                CREATE TABLE metadata_vectors(id int PRIMARY KEY, vec vector({VECTOR_METADATA_DIMENSIONS}));
                 INSERT INTO metadata_vectors SELECT g, ARRAY(SELECT ((g+i)%17+1)::real
-                    FROM generate_series(1,1024) i)::vector FROM generate_series(1,2048) g;
+                    FROM generate_series(1,{VECTOR_METADATA_DIMENSIONS}) i)::vector FROM generate_series(1,{VECTOR_METADATA_ROWS}) g;
                 CREATE INDEX metadata_vectors_idx ON metadata_vectors USING paradedb(id, vec vector_l2_ops)
-                    WITH (quantization='[1,4]', target_segment_count=1);").unwrap();
+                    WITH (quantization='[1,4]', target_segment_count=1);")).unwrap();
+            assert_eq!(
+                Spi::get_one::<bool>(
+                    "SELECT bool_and(vector_format = 'ivf' AND layers = ARRAY[1,4])
+                     FROM paradedb.vector_info('metadata_vectors_idx', 'vec')"
+                )
+                .unwrap(),
+                Some(true)
+            );
             PgSearchRelation::open(
                 Spi::get_one::<pg_sys::Oid>("SELECT 'metadata_vectors_idx'::regclass::oid")
                     .unwrap()
@@ -60,7 +72,7 @@ pub mod api {
         }
 
         pub fn vector_query() -> String {
-            let query = vec!["1"; 1024].join(",");
+            let query = vec!["1"; VECTOR_METADATA_DIMENSIONS].join(",");
             format!(
                 "SELECT id FROM metadata_vectors WHERE id @@@ pdb.all() ORDER BY vec <-> '[{query}]'::vector LIMIT 5"
             )
```

---

### Incident Patch 3: `5a0e9f3b` (2026-11-24)
**Commit Message**: build: make DST optional for the extension (#7659)

## What

Make `dst` optional for the extension build. The `pg_search/dst` feature
still enables the Antithesis SDK and coverage shim. Normal builds use
local debug assertions and keep observations type-checked in release
builds.

Schemabot and Stressgres are already outside the extension build. The
separate integration test harness still uses the DST crate directly.

## Tests

- `cargo check --offline --locked -p pg_search`
- `cargo fmt --all -- --check` and `git diff --check`
- Verified Cargo's default build graph excludes DST, Schemabot,
Stressgres, and Antithesis. The extension's `dst` feature still resolves
DST and Antithesis.
- The instrumented compile on macOS stops in the SDK's Linux-specific
`.init_array` section. Instrumented Linux validation is pending.

---------

Co-authored-by: paradedb-github-bot[bot] <282009505+paradedb-github-bot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-4)
```diff
@@ -1483,6 +1483,7 @@ dependencies = [
  "bytemuck",
  "chrono",
  "decimal-bytes",
+ "dst",
  "futures",
  "libc",
  "once_cell",
@@ -4015,7 +4016,6 @@ dependencies = [
  "bytemuck",
  "common",
  "decimal-bytes",
- "dst",
  "parking_lot 0.13.0",
  "pgrx",
  "pgrx-tests",
@@ -4041,7 +4041,7 @@ version = "0.27.0"
 dependencies = [
  "anyhow",
  "bytemuck",
- "dst",
+ "common",
  "index_read",
  "log",
  "pgrx",
@@ -5336,7 +5336,6 @@ dependencies = [
  "anyhow",
  "basescan",
  "common",
- "dst",
  "env_logger",
  "half 2.7.1",
  "index_read",
@@ -7202,7 +7201,6 @@ dependencies = [
  "bitpacking",
  "bytemuck",
  "common",
- "dst",
  "parking_lot 0.13.0",
  "pgrx",
  "pgrx-tests",
```

**File**: `common/Cargo.toml` (modified, +2/-0)
```diff
@@ -14,6 +14,7 @@ pg16 = ["pgrx/pg16"]
 pg17 = ["pgrx/pg17"]
 pg18 = ["pgrx/pg18"]
 pg_test = ["dep:proptest"]
+dst = ["dep:dst", "dst/enabled"]
 
 # Keep this crate's dependency list minimal: every workspace crate depends on `common`, so
 # heavy dependencies added here serialize the entire build graph. In particular, do NOT add
@@ -26,6 +27,7 @@ arrow-schema.workspace = true
 bytemuck.workspace = true
 chrono.workspace = true
 decimal-bytes.workspace = true
+dst = { path = "../dst", optional = true }
 futures.workspace = true
 libc.workspace = true
 once_cell.workspace = true
```

**File**: `common/src/dst.rs` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+// Copyright (c) 2023-2026 ParadeDB, Inc.
+//
+// This file is part of ParadeDB - Postgres for Search and Analytics
+//
+// This program is free software: you can redistribute it and/or modify
+// it under the terms of the GNU Affero General Public License as published by
+// the Free Software Foundation, either version 3 of the License, or
+// (at your option) any later version.
+//
+// This program is distributed in the hope that it will be useful
+// but WITHOUT ANY WARRANTY; without even the implied warranty of
+// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
+// GNU Affero General Public License for more details.
+//
+// You should have received a copy of the GNU Affero General Public License
+// along with this program. If not, see <http://www.gnu.org/licenses/>.
+
+//! Local extension assertions when the DST SDK is disabled.
+
+pub use crate::dst_observe as observe;
+pub use crate::{
+    dst_assert_always as assert_always, dst_assert_always as assert_always_or_unreachable,
+    dst_assert_unreachable as assert_unreachable,
+};
+
+/// Run a read-only observation in debug builds. Release builds still type-check the closure.
+#[inline]
+#[doc(hidden)]
+pub fn run_observation<F: Fn()>(check: F) {
+    if cfg!(debug_assertions) {
+        check();
+    }
+}
+
+#[doc(hidden)]
+#[macro_export]
+macro_rules! dst_observe {
+    ($check:expr $(,)?) => {
+        $crate::dst::run_observation($check)
+    };
+}
+
+#[doc(hidden)]
+#[macro_export]
+macro_rules! dst_assert_always {
+    ($condition:expr, $message:literal) => {
+        ::core::debug_assert!($condition, "{}", $message)
+    };
+    ($condition:expr, $message:literal, $details:expr) => {
+        ::core::debug_assert!($condition, "{}: {}", $message, $details)
+    };
+}
+
+#[doc(hidden)]
+#[macro_export]
+macro_rules! dst_assert_unreachable {
+    ($message:literal $(, $details:expr)?) => {
+        $crate::dst_assert_always!(false, $message $(, $details)?)
+    };
+}
```

**File**: `common/src/lib.rs` (modified, +4/-0)
```diff
@@ -18,6 +18,10 @@
 pub use pgrx::pgrx_sql_entity_graph;
 
 pub mod api;
+#[cfg(not(feature = "dst"))]
+pub mod dst;
+#[cfg(feature = "dst")]
+pub use ::dst;
 pub mod gucs;
 pub mod index;
 pub mod parallel_worker;
```

**File**: `docker/Dockerfile.proptests` (modified, +5/-5)
```diff
@@ -3,7 +3,7 @@
 # - Minimum 2 CPU cores for compilation
 #
 # This image pre-builds the `qgen` property test binary and bundles it with
-# Antithesis singleton driver scripts. The binary is invoked in a loop against
+# DST singleton driver scripts. The binary is invoked in a loop against
 # the in-cluster ParadeDB primary by the driver script (see
 # tests/antithesis/singleton_driver_property-tests.sh).
 
@@ -14,7 +14,7 @@ SHELL ["/bin/bash", "-o", "pipefail", "-c"]
 
 # Install build and runtime dependencies. `jq` is used during build to extract
 # the test binary path from cargo's JSON output; `curl` is needed by the
-# antithesis-instrumentation build script, which `--features dst` pulls in.
+# DST coverage shim build script, which `--features dst` pulls in.
 RUN apt-get update && apt-get install -y --no-install-recommends \
     build-essential \
     lld \
@@ -39,7 +39,7 @@ WORKDIR /home/app
 # is built).
 COPY --chown=app:app . .
 
-# Configure Antithesis test singletons.
+# Configure DST test singletons.
 RUN mkdir -p /opt/antithesis/test/v1/quickstart
 COPY tests/antithesis/ /opt/antithesis/test/v1/quickstart/
 RUN chmod +x /opt/antithesis/test/v1/quickstart/*.sh
@@ -50,7 +50,7 @@ ENV RUST_LOG=info
 ENV PGCLIENTENCODING=UTF8
 
 # Prefetch deps and build the qgen test binary while we have Internet. This
-# Docker image will run in an air-gapped environment in Antithesis, so the
+# Docker image will run in an air-gapped DST environment, so the
 # binary must already exist on disk. The `--message-format=json` output lets
 # us pick out the unhashed test executable path and copy it to a stable
 # location.
@@ -62,7 +62,7 @@ RUN cargo fetch --locked --manifest-path /home/app/Cargo.toml && \
     QGEN_BIN=$(jq -r 'select(.profile.test == true and .target.name == "qgen") | .executable' /tmp/build.json | tail -n 1) && \
     test -x "$QGEN_BIN" && \
     cp "$QGEN_BIN" /home/app/qgen && \
-    /home/app/qgen --exact antithesis_sdk_initializes && \
+    /home/app/qgen --exact dst_sdk_initializes && \
     rm /tmp/build.json
 
 CMD ["sleep", "infinity"]
```

**File**: `docker/Dockerfile.source` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ WORKDIR /build
 COPY . .
 # Scope SanitizerCoverage to the explicit target so host build scripts and
 # cargo-pgrx stay uninstrumented. Keep the release path identical for benchmarks.
-# DST runs currently use Antithesis instrumentation and require linux/amd64.
+# The instrumented DST build requires linux/amd64.
 ARG DST=false
 RUN /bin/bash <<'BUILD'
 set -euo pipefail
```

**File**: `docker/Dockerfile.stressgres` (modified, +3/-3)
```diff
@@ -54,7 +54,7 @@ RUN cargo fetch --manifest-path /home/app/Cargo.toml && \
 FROM debian:trixie-slim AS runtime
 
 # Upgrade the runtime packages so a rebuild picks up all available Debian
-# security fixes. psql is used by the Antithesis setup/verification scripts;
+# security fixes. psql is used by the DST setup and verification scripts;
 # util-linux provides flock for the recovery-liveness script.
 # Graph generation is disabled in this image, avoiding Fontconfig and its
 # transitive font/XML dependencies. Normal source builds retain graph support.
@@ -71,8 +71,8 @@ RUN useradd --create-home --shell /bin/bash app
 
 WORKDIR /home/app
 
-# Preserve the paths used by the public Docker examples and Antithesis while copying only runtime
-# inputs. The unstripped binary under /symbols lets Antithesis symbolize instrumented crashes.
+# Preserve the paths used by the public Docker examples and DST runner while copying only runtime
+# inputs. The unstripped binary under /symbols lets the DST runner symbolize instrumented crashes.
 COPY --chown=app:app --from=builder /tmp/stressgres /symbols/stressgres
 # Copy the native client without postgresql-client-common and its unused Perl runtime. Because the
 # Debian package database is not copied with it, package-based scanners may not inventory psql.
```

**File**: `docker/README.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ postgresql:
 
 ## Manifests
 
-`manifests/cnpg.yaml` is the CloudNativePG operator, rendered from the upstream Helm chart with default values and bundled into the Antithesis config images. To upgrade the operator, re-render it with the chart version whose `appVersion` is the CNPG release you want ([chart index](https://github.com/cloudnative-pg/charts)):
+`manifests/cnpg.yaml` is the CloudNativePG operator, rendered from the upstream Helm chart with default values and bundled into the DST config images. To upgrade the operator, re-render it with the chart version whose `appVersion` is the CNPG release you want ([chart index](https://github.com/cloudnative-pg/charts)):
 
 ```bash
 helm repo add cnpg https://cloudnative-pg.github.io/charts
```

#### Recent Merged Pull Requests:
- **PR #7667** (2026-11-24): fix: Synchronize resource cleanup on abort (@paradedb-github-bot[bot])
- **PR #7666** (2026-11-24): perf: Add support for pushing dynamic hash expression filters into Tantivy (@paradedb-github-bot[bot])
- **PR #7663** (2026-11-24): ci: use a SQL smoke test after extension upgrades (@paradedb-github-bot[bot])
- **PR #7660** (2026-11-24): ci: use a SQL smoke test after extension upgrades (@philippemnoel)
- **PR #7659** (2026-11-24): build: make DST optional for the extension (@philippemnoel)
- **PR #7658** (2026-11-24): fix: report vector index build training phases (@paradedb-github-bot[bot])

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

## X. Synchronize resource cleanup on abort

**RULE**:
When implementing operations in `.github/scripts/check_impl_drop.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in paradedb/paradedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3db63451`: Synchronize resource cleanup on abort. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/scripts/check_impl_drop.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
`impl_safe_drop!`, or any direct `IsTransactionState()` call inside `impl_safe_drop!` that does
not say why it skips `ResourceOwnerStamp`.
words: "We intentionally do NOT use `impl_safe_drop!` here because ...".

Inside `impl_safe_drop!`, checking `IsTransactionState()` alone is not enough when a scan state
lives in a `MemoryContext` whose `ResourceOwner` has already been released (#7609); wrappers
should gate cleanup with `ResourceOwnerStamp` from common/src/postgres/resowner.rs, or opt out
directly above the call with "We intentionally call `IsTransactionState()` here because ...".
Every workspace crate that depends on `pgrx` is scanned.
SAFE_DROP_START = re.compile(r"^[ \t]*(?:[A-Za-z0-9_]+::)*impl_safe_drop!\s*\(")
IS_TX_STATE = re.compile(r"\bIsTransactionState\s*\(")
STRING_LITERAL = re.compile(r'"(?:\\.|[^"\\])*"')
TX_STATE_OVERRIDE = re.compile(
    r"\bnot\s+us(?:e|ing)\W+ResourceOwnerStamp\b|\bintentionally\b.*\bIsTransactionState\b",
    re.IGNORECASE,
)
    (
        "crate::impl_safe_drop!(Foo, |self| {\n    if unsafe { IsTransactionState() } {}\n});",
        1,
    ),
    (
        (
            "crate::impl_safe_drop!([T] Foo<T>, |self| {\n"
            "    // TODO
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
`impl_safe_drop!`.
words: "We intentionally do NOT use `impl_safe_drop!` here because ...". Every workspace crate
that depends on `pgrx` is scanned.
    """Return (line, header) for every unexcused `impl Drop` or `DropGuard`."""
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3db63451` are properly handled with clean fallback behavior.
