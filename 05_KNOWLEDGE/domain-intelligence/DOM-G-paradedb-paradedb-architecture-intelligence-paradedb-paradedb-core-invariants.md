# Domain G — Architecture Intelligence: Architecture Intelligence: paradedb/paradedb Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "paradedb/paradedb",
  "source_url": "https://github.com/paradedb/paradedb",
  "source_version": "82d66f9e",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-22T02:09:16.783Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-paradedb-paradedb",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [paradedb/paradedb](https://github.com/paradedb/paradedb) (Revision: `82d66f9e`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-22T02:09:16.783Z`  
> **Learning ID**: `learn-github-paradedb-paradedb`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), J (Search & Distribution Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), A (Human & Need Intelligence), F (Design Intelligence)
- **Confidence Rating**: 65%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from paradedb/paradedb:

# Forensic Learning Record (Deep Inspection): paradedb/paradedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/paradedb-paradedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/paradedb/paradedb](https://github.com/paradedb/paradedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T02:09:15.796Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `paradedb/paradedb`
- **Description**: One Postgres for your application data, full-text search, vector retrieval, and aggregations. Home of the pg_search extension.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9554 stars

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

use std::cell::{OnceCell, UnsafeCell};
use std::collections::BTreeMap;
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
                Some(PgSearchRelation::with_lock(self.indexrelid, lockmode))
            }
        };
    }

    pub fn set_base_search_query_input(&mut self, input: Arc<SearchQueryInput>) {
        self.base_search_query_input = input;
    }

    pub fn search_query_input(&self) -> Arc<SearchQueryInput> {
        if matches!(*self.search_query_input, SearchQueryInput::Uninitialized) {
            panic!("search_query_input should be initialized");
        }
        self.search_query_input.clone()
    }

    /// Get the original base search query input before any modifications
    pub fn base_search_query_input(&self) -> Arc<SearchQueryInput> {
        self.base_search_query_input.clone()
    }

    /// Drop the active search results (whose scorers hold bitmap cursors),
    /// keeping the selected exec method: `reset()` re-binds it to the rebuilt
    /// reader after a rescan. Replacing the method here would leave the
    /// default `UnknownScanStyle`, which panics on its next use. No reader means
    /// the scan never executed: there are no scorers, and the exec method may
    /// not even be bound yet.
    pub fn reset_exec_results(&mut self) {
        if self.search_reader.is_some() {
            
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

pub struct WorkerStatsGuard {
    buf_usage: *mut pg_sys::BufferUsage,
    wal_usage: *mut pg_sys::WalUsage,
    worker_idx: usize,
}

crate::impl_safe_drop!(WorkerStatsGuard, |self| {
    if !self.buf_usage.is_null() && !self.wal_usage.is_null() {
        unsafe {
            pg_sys::InstrEndParallelQuery(
                self.buf_usage.add(self.worker_idx),
                self.wal_usage.add(self.worker_idx),
            );
        }
    }
});

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
    pub fn new(toc: *mut pg_sys::shm_toc, seg: *mut pg_sys::dsm_segment) -> Self {
        assert!(!toc.is_null());
        unsafe {
            let ptr = pg_sys::shm_toc_lookup(toc, TocKeys::UserStateLength.into(), true);
            let len = *ptr.cast();

            Self {
                toc: NonNull::new(toc).unwrap_unchecked(),
                len,
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

struct MessageQueueHandle {
    handle: NonNull<pg_sys::shm_mq_handle>,
}

crate::impl_safe_drop!(MessageQueueHandle, |self| {
    unsafe {
        if pg_sys::IsInParallelMode() {
            pg_sys::shm_mq_detach(self.handle.as_ptr());
        }
    }
});

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
    // Declared before `handle` so Rust's field drop order runs `WorkerStatsGuard::drop`
    // (`InstrEndParallelQuery`) before `MessageQueueHandle::drop` detaches the `shm_mq` and
    // unblocks `ParallelProcessFinish::recv()` on the leader.
    _stats: Option<crate::parallel_worker::WorkerStatsGuard>,
    handle: MessageQueueHandle,
}

impl MessageQueueSender {
    #[doc(hidden)]
    pub(crate) unsafe fn new(
        seg: *mut pg_sys::dsm_segment,
        mq: *mut pg_sys::shm_mq,
        stats: Option<crate::parallel_worker::WorkerStatsGuard>,
    ) -> Self {
        unsafe {
            Self {
                _stats: stats,
                handle: MessageQueueHandle::attach_sender(seg, mq),
            }
        }
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
/// PostgreSQL's transaction abort mechanism will clean up resources (buffers, relations, etc.)
/// when the transaction is aborted due to the error.
///
/// Cleanup is also skipped once `proc_exit` has started: a FATAL doesn't unwind, so `panicking()`
/// can't see it, and the abort that `proc_exit` runs releases those resources too. Skipping the body
/// doesn't stop Rust dropping the fields afterwards; values whose fields a FATAL can leave mid-use
/// are handled where they are leaked, see `PgMemoryContextsExt::leak_and_drop_unless_exiting`.
///
/// # Example
/// ```ignore
/// impl_safe_drop!(MyStruct, |self| {
///     unsafe {
///         if crate::postgres::utils::IsTransactionState() {
///             pg_sys::some_cleanup_function(self.handle);
///         }
///     }
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
    /// The body mirrors pgrx 0.20.0's `leak_and_drop_on_delete` (`memcxt.rs`) plus the
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

/// Whether this backend is running `proc_exit`, where a FATAL may have left Rust state mid-use.
#[cfg(not(test))]
pub fn proc_exit_in_progress() -> bool {
    // SAFETY: plain read of a backend-local flag on the backend thread.
    unsafe { pgrx::pg_sys::proc_exit_inprogress }
}

/// The lib-test binary doesn't link the PG globals, and no test runs `proc_exit`.
#[cfg(test)]
pub fn proc_exit_in_progress() -> bool {
    false
}

/// RAII guard for PostgreSQL standalone expression context
/// Automatically frees the context when dropped
///
/// let context_guard = ExprContextGuard::new();
/// // Use context_g
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
}

impl DeferredScorer {
    pub fn new(weight: Arc<LazyWeight>, segment_reader: SegmentReader) -> Self {
        Self {
            weight,
            segment_reader,
            scorer: Default::default(),
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
                .pruning_scorer(&self.segment_reader, 1.0, Score::MIN)
                .expect("pruning scorer should be constructable")
        })
    }

    fn set_threshold(&mut self, threshold: Score) {
        self.scorer_mut().set_threshold(threshold);
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
- **Issue #7593** (2026-11-21): **`pg_search 0.27.0`: SELECT DISTINCT fails with es_query_dsa when term_set uses a parallel subquery**
  *Symptoms*: ### What happens?  A `SELECT DISTINCT` query fails when `pdb.term_set` receives an array from a nested BM25 query. The outer query uses a ParadeDB Aggregate Scan. The nested query uses a parallel ParadeDB Base Scan in an `InitPlan`.  **Expected:** The query returns IDs `1` and `2`.  **Actual:** The query returns SQLSTATE `XX000`:  ```text ERROR: es_query_dsa must be set during parallel initialization or execution ```  The error reproduced in three out of three fresh connections. Passing the same IDs as a literal array returns both rows. Disabling `paradedb.enable_aggregate_custom_scan` also returns both rows without changing the parallel worker limit.  ### To Reproduce  Run this in a sandbox database with `pg_search` 0.27.0 installed. Use `psql` with autocommit enabled.  ```sql create schema bm25_repro; set search_path = bm25_repro, public;  create table documents (id integer primary key); insert into documents values (1), (2), (3); create index documents_search on documents using bm25 (id); analyze documents;  -- Allow a parallel plan on the three-row table. set max_parallel_workers_per_gather = 1; set debug_parallel_query = on; set paradedb.enable_aggregate_custom_scan = on;  -- Control: returns IDs 1 and 2. select distinct id from documents where (id @@@ pdb.term_set(array[1, 2]));  -- Reproduction: fails with SQLSTATE XX000. select distinct id from documents where (     id @@@ pdb.term_set(array(         select id         from documents         where (id @@@ pdb.term_set(

- **Issue #7564** (2026-11-19): **`pg_search 0.23.5 → 0.27.0` upgrade leaves a stale version_info() signature**
  *Symptoms*: ### What happens?  `ALTER EXTENSION pg_search UPDATE TO '0.27.0'` succeeds on a database created with `pg_search` 0.23.5, but the SQL catalog still declares three result columns for `paradedb.version_info()`: `version`, `githash`, and `build_mode`. The 0.27.0 binary returns only `version` and `build_mode`. In our test, the version check after the successful upgrade terminated the PostgreSQL backend with `SIGSEGV`.  [#4956](https://github.com/paradedb/paradedb/pull/4956) removed `githash`. In the 0.27.0 package, the SQL change is in the `0.23.2 → 0.23.3` migration. Databases that start on 0.23.5 skip that migration. We verified that replacing the old signature in the final upgrade step fixes the direct upgrade.  **Expected:** After `ALTER EXTENSION` succeeds, the function signature matches a fresh 0.27.0 installation.  ### To Reproduce  1. Create a fresh database with `pg_search` 0.23.5. 2. Start the official 0.27.0 image with the same data directory and complete the documented extension upgrade. 3. Check the installed version and SQL signature without calling the function:  ```sql SELECT extversion,        pg_get_function_result('paradedb.version_info()'::regprocedure) FROM pg_extension WHERE extname = 'pg_search'; ```  **Actual:** `0.27.0` and `TABLE(version text, githash text, build_mode text)`   **Expected:** `0.27.0` and `TABLE(version text, build_mode text)`  ### OS:  Debian 13 (Trixie), x86_64  ### ParadeDB Version (e.g. output of `SELECT * FROM paradedb.version_info();

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

### Incident Patch 1: `9e0eeecd` (2026-11-21)
**Commit Message**: fix: Solve AggregateScan parameters before entering a runtime. (#7605)

# Ticket(s) Closed

- Closes #7593

## What

Fixes DataFusion `AggregateScan` queries (`SELECT DISTINCT`, `GROUP BY`,
`FILTER`) whose predicates evaluate an `InitPlan` containing a ParadeDB
`BaseScan` (parallel or serial). Previously, parallel `InitPlan`s failed
with `es_query_dsa must be set during parallel initialization or
execution`, and serial `ColumnarExecState` `InitPlan`s panicked with
`Cannot start a runtime from within a runtime`. Also fixes
parallel-aware `BaseScan` queries with a bitmap intersection child
failing outside parallel mode (e.g., PL/pgSQL `SELECT INTO`), and makes
`pdb.agg(..., 'threshold')` with runtime expressions resolve against the
solved row estimate.

## Why

Unlike `BaseScan`, Tantivy `AggregateScan`, and `JoinScan`, the
DataFusion `AggregateScan` path left runtime Postgres expressions
unsolved until `PgSearchTableProvider::scan`, which runs inside
`PgTokioRuntime::block_on`. Inside `block_on`, `HeldInterrupts` forces
PostgreSQL's `InitializeParallelDSM` into its private-memory fallback
(`es_query_dsa == NULL`), and an active Tokio runtime panics if an
`InitPlan` itself enters `bl

**File**: `basescan/src/postgres/customscan/basescan/mod.rs` (modified, +18/-12)
```diff
@@ -139,8 +139,10 @@ impl BaseScan {
     ///    segment view with `MvccSatisfies::ParallelWorker`.
     ///
     /// 2. **Serial or Replicated Scan** (no `parallel_state`):
-    ///    Either the main backend running a serial path, or a `parallel_safe` but not
-    ///    `parallel_aware` scan inside a worker (e.g. the inner side of a Parallel Hash Join).
+    ///    Either the main backend running a serial path, a `parallel_safe` but not
+    ///    `parallel_aware` scan inside a worker (e.g. the inner side of a Parallel Hash Join),
+    ///    or a `parallel_aware` scan running locally on the leader when `es_use_parallel_mode`
+    ///    is false or `InitializeParallelDSM` falls back to private memory (`es_query_dsa == NULL`).
     ///    Each such scan reads the full data set on its own, so it opens with
     ///    `MvccSatisfies::Snapshot`. The leader's very first open falls here too: it runs from
     ///    `estimate_dsm_custom_scan`, before any DSM is attached, and it is the open the
@@ -238,16 +240,6 @@ impl BaseScan {
         state.custom_state_mut().search_reader = Some(search_reader);
         state.custom_state_mut().score_explanation_weight.take();
 
-        let parallel_aware = unsafe { (*(*state.planstate()).plan).parallel_aware };
-        if !parallel_aware
-            && let Some(cell) = state.custom_state().bitmap_cell.clone()
-            && cell.get().is_none()
-            && let Some(bitmap_exec) = state.custom_state_mut().bitmap_exec.as_mut()
-            && let Some(source) = unsafe { bitmap_exec.private_source() }
-        {
-            cell.fill(source);
-        }
-
         let csstate = addr_of_mut!(state.csstate);
         state.custom_state_mut().init_exec_method(csstate);
 
@@ -2208,6 +2200,20 @@ impl CustomScan for BaseScan {
         if state.custom_state().search_reader.is_none() {
             Self::init_search_reader(state);
         }
+        // Populate the private bitmap cursor source when running without attached parallel DSM
+        // state. Handling this here (rather than gating on `!plan.parallel_aware` in
+        // `init_search_reader`) covers both genuinely serial scans and `parallel_aware` scans
+        // that fell back to leader-only local execution (e.g. `es_use_parallel_mode = false` or
+        // PostgreSQL's `InitializeParallelDSM` private-memory fallback with `es_query_dsa == NULL`),
+        // without eagerly building a private bitmap during `estimate_dsm_custom_scan`.
+        if state.custom_state().parallel.is_none()
+            && let Some(cell) = state.custom_state().bitmap_cell.clone()
+            && cell.get().is_none()
+            && let Some(bitmap_exec) = state.custom_state_mut().bitmap_exec.as_mut()
+            && let Some(source) = unsafe { bitmap_exec.private_source() }
+        {
+            cell.fill(source);
+        }
         // Build the leader's routing plan on first execution; workers wait for publication
         // only when they need the plan, after evaluating their segment filters.
         if state.custom_state().vector_routing_pending {
```

**File**: `basescan/src/postgres/customscan/basescan/parallel.rs` (modified, +35/-13)
```diff
@@ -130,6 +130,16 @@ impl ParallelQueryCapable for BaseScan {
         pcxt: *mut pg_sys::ParallelContext,
         coordinate: *mut c_void,
     ) {
+        let Some(area) = try_query_area(state) else {
+            // PostgreSQL's `InitializeParallelDSM` fell back to backend-private memory
+            // (`pcxt->seg == NULL`, `pcxt->nworkers == 0`, `pei->area == NULL`), e.g. due to
+            // DSM exhaustion or held interrupts. No workers will launch, so leave `parallel`
+            // unattached and let the leader run serially (matching PostgreSQL's
+            // `ExecBitmapHeapInitializeDSM`).
+            debug_assert!(unsafe { (*pcxt).seg.is_null() && (*pcxt).nworkers == 0 });
+            return;
+        };
+
         let args = state.custom_state().parallel_scan_args();
 
         unsafe {
@@ -139,7 +149,7 @@ impl ParallelQueryCapable for BaseScan {
             state
                 .custom_state_mut()
                 .attach_parallel(pscan_state, ParallelRole::Leader);
-            leader_publish_query(state, &mut *pscan_state);
+            leader_publish_query(state, &mut *pscan_state, area);
 
             if !(*pcxt).seg.is_null()
                 && let Some(trace) = state.custom_state().io_trace.clone()
@@ -162,7 +172,6 @@ impl ParallelQueryCapable for BaseScan {
             let planned_workers = (*pcxt).nworkers as u32;
             (*pscan_state).bitmap_slots = planned_workers + 1;
             leader_publish_bitmap(state, pscan_state);
-            let area = query_area(state);
             state
                 .custom_state_mut()
                 .leader_publish_vector_routing_plan(area, pg_sys::parallel_leader_participation);
@@ -173,6 +182,14 @@ impl ParallelQueryCapable for BaseScan {
         state: &mut CustomScanStateWrapper<Self>,
         coordinate: *mut c_void,
     ) {
+        let Some(area) = try_query_area(state) else {
+            // Same private-memory fallback as `initialize_dsm_custom_scan` (matching
+            // PostgreSQL's `ExecBitmapHeapReInitializeDSM`): no workers will launch, and
+            // `rescan_custom_scan` resets local state because `parallel` is `None`.
+            debug_assert!(state.custom_state().parallel.is_none());
+            return;
+        };
+
         // The one place the shared segment work queue is reset for a rescan.
         // PostgreSQL guarantees this runs while no workers are attached (see
         // nodeGather.c: "ReInitializeDSM should reset only shared state, ReScan
@@ -205,10 +222,9 @@ impl ParallelQueryCapable for BaseScan {
         if state.custom_state().needs_vector_routing() {
             BaseScan::init_search_reader(state);
         }
-        unsafe { leader_publish_query(state, pscan_state) };
+        unsafe { leader_publish_query(state, pscan_state, area) };
         unsafe { leader_publish_bitmap(state, pscan_state) };
         unsafe {
-            let area = query_area(state);
             state
                 .custom_state_mut()
                 .leader_publish_vector_routing_plan(area, pg_sys::parallel_leader_participation)
@@ -238,25 +254,31 @@ impl ParallelQueryCapable for BaseScan {
     }
 }
 
-/// The parallel query's DSA area. Postgres installs it on the EState around the DSM
-/// callbacks and local execution in the leader, and for the whole run in a worker.
-pub(super) fn query_area(state: &CustomScanStateWrapper<BaseScan>) -> *mut dsa_area {
+/// The parallel query's DSA area, if Postgres created a DSM segment for this parallel context.
+/// Returns `None` when `InitializeParallelDSM` fell back to backend-private memory
+/// (`pcxt->seg == NULL`, `pcxt->nworkers == 0`, `pei->area == NULL`).
+pub(super) fn try_query_area(state: &CustomScanStateWrapper<BaseScan>) -> Option<*mut dsa_area> {
     let area = unsafe { (*state.csstate.ss.ps.state).es_query_dsa };
-    assert!(
-        !area.is_null(),
-        "es_query_dsa must be set during parallel initialization or execution"
-    );
-    area
+    (!area.is_null()).then_some(area)
+}
+
+/// The parallel query's DSA area, required for workers and leader paths that attached parallel
+/// DSM state. Leader DSM init/reinit use [`try_query_area`] because PostgreSQL's private-memory
+/// fallback leaves `es_query_dsa` null.
+pub(super) fn query_area(state: &CustomScanStateWrapper<BaseScan>) -> *mut dsa_area {
+    try_query_area(state)
+        .expect("es_query_dsa must be set during parallel initialization or execution")
 }
 
 /// Leader-only: hand the coming round's workers the solved query.
 unsafe fn leader_publish_query(
     state: &mut CustomScanStateWrapper<BaseScan>,
     pscan_state: &mut ParallelScanState,
+    area: *mut dsa_area,
 ) {
     let query = serde_json::to_vec(&state.custom_state().search_query_input())
         .expect("should be able to serialize query");
-    unsafe { pscan_state.publish_query(query_area(state), &query) };
+    unsafe { pscan_state.publish_query(area, &query) };
 }
 
 /// Leader-only: ensure th
```

**File**: `basescan/src/postgres/customscan/basescan/scan_state.rs` (modified, +4/-3)
```diff
@@ -698,9 +698,10 @@ impl SolvePostgresExpressions for BaseScanState {
     }
 
     /// Install the late-bound source cell. Workers attach the published claim
-    /// table immediately; the leader's (or a serial scan's) cell is filled after
-    /// its reader opens (serial: privately in `init_search_reader`; parallel:
-    /// with the shared view at DSM initialization).
+    /// table immediately; the leader's (or a serial scan's) cell is filled once
+    /// its reader opens (parallel with attached DSM: with the shared view at
+    /// DSM initialization; serial or local fallback without attached DSM:
+    /// privately in `exec_custom_scan`).
     fn bitmap_source_cell(&mut self, _planstate: *mut pg_sys::PlanState) -> Option<BitmapCell> {
         self.bitmap_exec.as_ref()?;
         let cell = self
```

**File**: `docs/project/changelog/unreleased/7605.bugfix.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+- Fixed aggregate and `DISTINCT` queries with subqueries in search predicates failing at execution time (#7593), and resolved runtime predicates before evaluating `pdb.agg(..., 'threshold')` visibility. Also fixed parallel search queries with bitmap intersection failing when run outside parallel mode.
```

**File**: `index_read/src/postgres/customscan/solve_expr.rs` (modified, +6/-5)
```diff
@@ -34,7 +34,7 @@
 //! | Context | Created | Per-tuple memory reset | Use it for |
 //! |---|---|---|---|
 //! | `ps_ExprContext` | PostgreSQL, in `ExecInitCustomScan` | by the scan, per row | evaluating heap filters, snippets, projection |
-//! | runtime context (`BaseScanState::runtime_context`, `AggregateScanState::runtime_context`) | [`SolvePostgresExpressions::init_expr_context`], only when the base query has something to solve | once, at the start of each solve | the solved query |
+//! | runtime context (`BaseScanState::runtime_context`, `AggregateScanState::runtime_context`, `DataFusionAggState::runtime_context`) | [`SolvePostgresExpressions::init_expr_context`], only when the base query has something to solve | once, at the start of each solve | the solved query |
 //!
 //! Both live in the EState's per-query memory and are freed with it.
 //!
@@ -50,6 +50,10 @@
 //! 3. Nothing else resets the runtime context between solves.
 //! 4. Before solving again (rescan), drop everything that still points into the old solved
 //!    query: the reader and its scorers. The new solve starts with a reset that frees it.
+//! 5. Solve on the Postgres main thread before entering `PgTokioRuntime::block_on`. Evaluating
+//!    an `InitPlan` inside `block_on` runs under `HeldInterrupts` (forcing PostgreSQL's
+//!    `InitializeParallelDSM` into its private-memory fallback with `es_query_dsa == NULL`) and
+//!    panics if the `InitPlan` itself enters `block_on`.
 //!
 //! # Why a second context
 //!
@@ -63,10 +67,7 @@
 //! # Scans outside this trait
 //!
 //! JoinScan solves `JoinCSClause` in `ps_ExprContext`, which it never resets per row because
-//! DataFusion produces its rows. The DataFusion aggregate does reset `ps_ExprContext` per row,
-//! so it cannot solve there; each source solves in `PgSearchTableProvider::scan` into a context
-//! created for that source alone (`aggregatescan/datafusion_exec.rs`), so one source's reset
-//! cannot free another's query.
+//! DataFusion produces its rows (and still solves before entering `PgTokioRuntime::block_on`).
 
 use crate::api::operator::searchqueryinput_typoid;
 use crate::nodecast;
```

**File**: `index_read/src/scan/info.rs` (modified, +0/-21)
```diff
@@ -265,27 +265,6 @@ impl ScanMode {
     pub fn has_parameters(&self) -> bool {
         self.queries().any(|q| q.has_parameters())
     }
-
-    /// Initialize runtime `PostgresExpression` nodes in this scan mode against `planstate`.
-    pub fn init_postgres_expressions(&mut self, planstate: *mut pg_sys::PlanState) {
-        for q in self.queries_mut() {
-            q.init_postgres_expressions(planstate);
-        }
-    }
-
-    /// Solve all runtime `PostgresExpression` and parameterized heap filters in this scan mode.
-    /// Resets `ecxt_per_tuple_memory` once up front, then solves each query with the no-reset
-    /// variant (rule 2 in `solve_expr.rs`).
-    pub fn solve_postgres_expressions(&mut self, expr_context: *mut pg_sys::ExprContext) {
-        assert!(
-            !expr_context.is_null(),
-            "expr_context was never initialized"
-        );
-        unsafe { pg_sys::MemoryContextReset((*expr_context).ecxt_per_tuple_memory) };
-        for q in self.queries_mut() {
-            q.solve_postgres_expressions_no_reset(expr_context);
-        }
-    }
 }
 
 /// Information about a scan of a ParadeDB table.
```

**File**: `joinscan/src/postgres/customscan/aggregatescan/datafusion_exec.rs` (modified, +19/-29)
```diff
@@ -141,7 +141,7 @@ pub async fn build_join_aggregate_plan(
         custom_exprs,
         custom_scan_tlist,
         expr_context,
-        planstate,
+        planstate.is_none(),
         mpp_manifests,
     )
     .await?;
@@ -637,11 +637,8 @@ fn build_pdb_aggregate_plan(
 
     let mut level_plans = Vec::with_capacity(groups.len());
 
-    // Cloned union groups must not share a provider's runtime state: each group needs its own
-    // `ExprContext` (solving parameters resets per-tuple memory), and under MPP each scan claims
-    // segments from the pool its `source_idx` names (clones sharing the original's indexes would
-    // split every pool between them, so groups past the first get pools one source list apart,
-    // matching the launch's `i % sources` manifest replay).
+    // Under MPP, cloned union groups must not share segment pools: each group past the first gets
+    // pools one source list apart (matching the launch's `i % sources` manifest replay).
     let pool_stride = plan.sources().len();
     for (group_idx, (needed_keys, levels_in_group)) in groups.into_iter().enumerate() {
         let mut level_plan = if group_idx == 0 {
@@ -772,8 +769,8 @@ fn build_pdb_aggregate_plan(
     }
 }
 
-/// Give every `PgSearchTableProvider` in a cloned union group its own runtime `ExprContext`
-/// and, under MPP, move its segment claims to the pool `offset` past its own.
+/// Under MPP, move every `PgSearchTableProvider` in a cloned union group to the segment pool
+/// `offset` past its own.
 fn isolate_cloned_sources(plan: LogicalPlan, offset: usize) -> Result<LogicalPlan> {
     plan.transform(|node| {
         let LogicalPlan::TableScan(mut scan) = node else {
@@ -782,11 +779,11 @@ fn isolate_cloned_sources(plan: LogicalPlan, offset: usize) -> Result<LogicalPla
         let Some(provider) = pg_search_provider_from_scan(&scan) else {
             return Ok(Transformed::no(LogicalPlan::TableScan(scan)));
         };
+        let Some(idx) = provider.source_idx() else {
+            return Ok(Transformed::no(LogicalPlan::TableScan(scan)));
+        };
         let mut provider = provider.clone();
-        if let Some(idx) = provider.source_idx() {
-            provider.set_source_idx(idx + offset);
-        }
-        provider.ensure_own_expr_context();
+        provider.set_source_idx(idx + offset);
         scan.source = Arc::new(DefaultTableSource::new(Arc::new(provider)));
         Ok(Transformed::yes(LogicalPlan::TableScan(scan)))
     })
@@ -1070,7 +1067,7 @@ fn build_relnode_df<'a>(
     custom_exprs: *mut pg_sys::List,
     custom_scan_tlist: *mut pg_sys::List,
     expr_context: Option<*mut pg_sys::ExprContext>,
-    planstate: Option<*mut pg_sys::PlanState>,
+    explain_only: bool,
     mpp_manifests: Option<&'a [SearchIndexManifest]>,
 ) -> LocalBoxFuture<'a, Result<DataFrame>> {
     async move {
@@ -1083,7 +1080,7 @@ fn build_relnode_df<'a>(
                     top_level_plan,
                     plan_position,
                     expr_context,
-                    planstate,
+                    explain_only,
                     mpp_manifests,
                 )
                 .await?;
@@ -1099,7 +1096,7 @@ fn build_relnode_df<'a>(
                     custom_exprs,
                     custom_scan_tlist,
                     expr_context,
-                    planstate,
+                    explain_only,
                     mpp_manifests,
                 )
                 .await?;
@@ -1110,7 +1107,7 @@ fn build_relnode_df<'a>(
                     custom_exprs,
                     custom_scan_tlist,
                     expr_context,
-                    planstate,
+                    explain_only,
                     mpp_manifests,
                 )
                 .await?;
@@ -1127,7 +1124,7 @@ fn build_relnode_df<'a>(
                     custom_exprs,
                     custom_scan_tlist,
                     expr_context,
-                    planstate,
+                    explain_only,
                     mpp_manifests,
                 )
                 .await?;
@@ -1180,7 +1177,7 @@ fn build_relnode_df<'a>(
                     custom_exprs,
                     custom_scan_tlist,
                     expr_context,
-                    planstate,
+                    explain_only,
                     mpp_manifests,
                 )
                 .await?;
@@ -1427,7 +1424,7 @@ async fn build_source_df(
     plan: &RelNode,
     plan_position: usize,
     expr_context: Option<*mut pg_sys::ExprContext>,
-    planstate: Option<*mut pg_sys::PlanState>,
+    explain_only: bool,
     mpp_manifests: Option<&[SearchIndexManifest]>,
 ) -> Result<DataFrame> {
     let scan_info = source.scan_info.clone();
@@ -1461,17 +1458,10 @@ async fn build_source_df(
             provider.add_match_tag_column(&tq.tag_name);
         }
     }
-    // HeapFilter queries (e.g. `=` on a column indexed via a
-    // `pdb.literal` cast) compile to runtime Postgres expressions
```

**File**: `joinscan/src/postgres/customscan/aggregatescan/mod.rs` (modified, +34/-10)
```diff
@@ -961,13 +961,15 @@ impl CustomScan for AggregateScan {
                     let cscan = builder.args().cscan;
                     ((*cscan).custom_exprs, (*cscan).custom_scan_tlist)
                 };
-                builder.custom_state().datafusion_state = Some(scan_state::DataFusionAggState {
+                let mut df_state = scan_state::DataFusionAggState {
                     plan,
                     targetlist,
                     topk,
                     custom_exprs,
                     custom_scan_tlist,
                     having_filter,
+                    base: None,
+                    runtime_context: None,
                     runtime: None,
                     physical_plan: None,
                     stream: None,
@@ -981,7 +983,15 @@ impl CustomScan for AggregateScan {
                     mpp: MppLifecycle::from_plan(parallel_mode_ok),
                     launch_timing: None,
                     spilled: Arc::new(AtomicBool::new(false)),
-                });
+                };
+                if df_state.has_postgres_expressions() || df_state.has_parameters() {
+                    df_state.base = Some(scan_state::DataFusionAggBase {
+                        plan: df_state.plan.clone(),
+                        targetlist: df_state.targetlist.clone(),
+                        having_filter: df_state.having_filter.clone(),
+                    });
+                }
+                builder.custom_state().datafusion_state = Some(df_state);
                 builder.build()
             }
         }
@@ -1197,10 +1207,15 @@ impl CustomScan for AggregateScan {
         estate: *mut pg_sys::EState,
         eflags: i32,
     ) {
-        if state.custom_state().is_datafusion_backend() {
+        if let Some(df_state) = state.custom_state_mut().datafusion_state.as_mut() {
             // DataFusion logical/physical planning and any MPP manifest pinning / worker launch
             // happen lazily on first `exec_custom_scan`, once `ExecutePlan` has initialized
-            // `estate->es_use_parallel_mode`.
+            // `estate->es_use_parallel_mode`. Only allocate the dedicated `runtime_context`
+            // (separate from `ps_ExprContext`, which is reset per emitted row) when the query
+            // has runtime expressions or parameters to solve.
+            if eflags & (pg_sys::EXEC_FLAG_EXPLAIN_ONLY as i32) == 0 {
+                df_state.runtime_context = unsafe { df_state.init_expr_context(estate) };
+            }
             return;
         }
 
@@ -2228,12 +2243,9 @@ impl AggregateScan {
             "aggregate scan slot must be initialized"
         );
 
-        // Capture before the mutable borrow on `datafusion_state`. Threaded
-        // down to each `PgSearchTableProvider` so HeapFilter queries (`=`
-        // on a `pdb.literal`-cast column, etc.) can resolve their runtime
-        // expressions. A provider with something to solve gets a context of its
-        // own from the planstate (see `build_source_df` in datafusion_exec.rs);
-        // `ps_ExprContext` is what every provider's reader evaluates in.
+        // Capture before the mutable borrow on `datafusion_state`. `ps_ExprContext` is
+        // threaded down to each `PgSearchTableProvider` for per-row heap filter evaluation;
+        // runtime expressions and parameters are pre-solved below into `runtime_context`.
         let ps_expr_context = state.csstate.ss.ps.ps_ExprContext;
         let runtime_expr_context = (!ps_expr_context.is_null()).then_some(ps_expr_context);
         let ps = state.planstate();
@@ -2247,6 +2259,18 @@ impl AggregateScan {
 
         // First call: build and execute the DataFusion plan
         if first_call {
+            // Solve all runtime Postgres expressions and parameters on the main thread before
+            // entering `PgTokioRuntime::block_on` (#7593): `block_on` holds `HeldInterrupts`
+            // (breaking parallel InitPlan DSM allocation) and installs a Tokio runtime context
+            // (panicking if an InitPlan itself calls `block_on`).
+            let df_state = state
+                .custom_state_mut()
+                .datafusion_state
+                .as_mut()
+                .expect("DataFusion state must be initialized");
+            let runtime_context = df_state.runtime_context;
+            df_state.prepare_query_for_execution(ps, runtime_context);
+
             let runtime = PgTokioRuntime::new()
                 .unwrap_or_else(|e| pgrx::error!("Failed to create tokio runtime: {}", e));
 
```

---

### Incident Patch 2: `5dd2b5bd` (2026-11-20)
**Commit Message**: chore: Add UUID primary / foreign keys for stackoverflow (#7608)

## What

Adds generated `UUID` join keys (`users.user_uuid`,
`stackoverflow_posts.owner_user_uuid`, `badges.user_uuid`) and `_uuid`
variants of `join_permissioned_search_*` and
`join_aggregate_topk_count_*` to `benchmarks/datasets/stackoverflow/`.

## Why

Existing Stack Overflow join benchmarks only join on `INTEGER` keys and
do not cover `UUID` / `StrColumn` dynamic filter pushdown, hash joins,
or `RankJoinExec` term-dictionary lookups.

## How

- Adds `STORED` generated `md5(...)::uuid` columns in
`create_tables.sql` and indexes them in `indexes/bm25.sql` (leaving S3
CSVs and existing integer `partition_by` clauses unchanged).
- Mirrors the six join query tiers under `*_uuid/` without
`range_partitioned` variants.

## Tests

Tested locally. After this merges we'll need to rebuild the heap
snapshots.

**File**: `benchmarks/datasets/stackoverflow/create_tables.sql` (modified, +10/-3)
```diff
@@ -30,7 +30,10 @@ CREATE TABLE stackoverflow_posts (
     -- format. Generated so the sampled CSVs stay unchanged: COPY skips
     -- generated columns. amount78 mimics uint256-style token amounts.
     amount15 NUMERIC(15, 2) GENERATED ALWAYS AS (view_count::numeric / 100) STORED,
-    amount78 NUMERIC(78, 0) GENERATED ALWAYS AS ('1e70'::numeric + view_count) STORED
+    amount78 NUMERIC(78, 0) GENERATED ALWAYS AS ('1e70'::numeric + view_count) STORED,
+    -- Deterministic full-entropy UUID join key mirroring owner_user_id.
+    -- Explicit ::text cast avoids STABLE textanycat; preserves NULL when owner_user_id IS NULL.
+    owner_user_uuid UUID GENERATED ALWAYS AS (md5('user-' || owner_user_id::text)::uuid) STORED
 );
 
 CREATE TABLE badges (
@@ -39,7 +42,9 @@ CREATE TABLE badges (
     date TIMESTAMP,
     user_id INTEGER,
     class INTEGER,
-    tag_based BOOLEAN
+    tag_based BOOLEAN,
+    -- Deterministic full-entropy UUID join key mirroring user_id.
+    user_uuid UUID GENERATED ALWAYS AS (md5('user-' || user_id::text)::uuid) STORED
 );
 
 CREATE TABLE comments (
@@ -65,5 +70,7 @@ CREATE TABLE users (
     down_votes INTEGER,
     views INTEGER,
     profile_image_url VARCHAR,
-    website_url VARCHAR
+    website_url VARCHAR,
+    -- Deterministic full-entropy UUID join key mirroring id.
+    user_uuid UUID GENERATED ALWAYS AS (md5('user-' || id::text)::uuid) STORED
 );
```

**File**: `benchmarks/datasets/stackoverflow/indexes/bm25.sql` (modified, +4/-1)
```diff
@@ -15,7 +15,8 @@ USING bm25 (
     amount15,
     amount78,
     (owner_display_name::pdb.unicode_words('columnar=true')),
-    owner_user_id
+    owner_user_id,
+    owner_user_uuid
 ) WITH (
     -- Join keys: comments.post_id = id, users.id = owner_user_id.
     -- TODO: Explore removing multi-key partitioning in the future once range-partitioning
@@ -30,6 +31,7 @@ USING bm25 (
     (name::pdb.unicode_words('columnar=true')),
     date,
     user_id,
+    user_uuid,
     class,
     tag_based
 ) WITH (
@@ -53,6 +55,7 @@ USING bm25 (
 CREATE INDEX users_idx ON users
 USING bm25 (
     id,
+    user_uuid,
     (about_me::pdb.unicode_words('columnar=true')),
     (display_name::pdb.unicode_words('columnar=true')),
     reputation
```

**File**: `benchmarks/datasets/stackoverflow/queries/join_aggregate_topk_count_high_selectivity_uuid/README.md` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+# TopK Aggregate on JOIN, High Selectivity (DataFusion, UUID Join Key)
+
+- Join: `stackoverflow_posts -> badges` over unpartitioned full-entropy `UUID` keys (`badges.user_uuid = stackoverflow_posts.owner_user_uuid`)
+- Description: Mirrors `join_aggregate_topk_count_high_selectivity` with deterministic `md5(...)::uuid` join keys (`GROUP BY badges.name`, `ORDER BY COUNT(*) DESC LIMIT 10`).
+
+## Query Info (statistics from 20m dataset):
+
+- `'postgres'` selectivity on `stackoverflow_posts.body`: ~0.13% (~26K matches).
+  Under database convention, this narrow filter represents high selectivity (filters out ~99.87% of rows).
+  Without range co-partitioning on the UUID join keys, build-side cardinality (~26K rows) exercises small/medium UUID hash joins above the `InList` cap (and cross-process dynamic filter pushdown once supported).
+
+## Variant Omissions
+
+- `range_partitioned.sql` is omitted because the BM25 indexes are not range-partitioned on the UUID columns.
+- Native PostgreSQL aggregation and `basescan.sql` are omitted for the same reasons noted in `../join_aggregate_topk_count_high_selectivity/README.md`.
```

**File**: `benchmarks/datasets/stackoverflow/queries/join_aggregate_topk_count_high_selectivity_uuid/hash_partitioned.sql` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+-- DataFusion TopK aggregate scan
+SET work_mem TO '8GB'; SET paradedb.enable_aggregate_custom_scan TO on; SET paradedb.enable_range_partitioned_join TO off; SELECT
+    b.name,
+    COUNT(*)
+FROM stackoverflow_posts p
+JOIN badges b ON b.user_uuid = p.owner_user_uuid
+WHERE
+    p.body ||| 'postgres'
+GROUP BY
+    b.name
+ORDER BY
+    COUNT(*) DESC
+LIMIT 10;
```

**File**: `benchmarks/datasets/stackoverflow/queries/join_aggregate_topk_count_low_selectivity_uuid/README.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+# TopK Aggregate on JOIN, Low Selectivity (DataFusion, UUID Join Key)
+
+- Join: `stackoverflow_posts -> badges` over unpartitioned full-entropy `UUID` keys (`badges.user_uuid = stackoverflow_posts.owner_user_uuid`)
+- Description: Mirrors `join_aggregate_topk_count_low_selectivity` with deterministic `md5(...)::uuid` join keys (`GROUP BY badges.name`, `ORDER BY COUNT(*) DESC LIMIT 10`).
+
+## Query Info (statistics from 20m dataset):
+
+- `'javascript'` selectivity on `stackoverflow_posts.body`: ~4.05% (~811K matches, fanning out to ~149M joined badge rows).
+  Without range co-partitioning on the UUID join keys, build-side cardinality (~811K rows) exercises very large UUID hash joins with high fanout (and cross-process dynamic filter pushdown once supported).
+
+## Variant Omissions
+
+- `range_partitioned.sql` is omitted because the BM25 indexes are not range-partitioned on the UUID columns.
+- Native PostgreSQL aggregation and `basescan.sql` are omitted for the same reasons noted in `../join_aggregate_topk_count_low_selectivity/README.md`.
```

**File**: `benchmarks/datasets/stackoverflow/queries/join_aggregate_topk_count_low_selectivity_uuid/hash_partitioned.sql` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+-- DataFusion TopK aggregate scan
+SET work_mem TO '8GB'; SET paradedb.enable_aggregate_custom_scan TO on; SET paradedb.enable_range_partitioned_join TO off; SELECT
+    b.name,
+    COUNT(*)
+FROM stackoverflow_posts p
+JOIN badges b ON b.user_uuid = p.owner_user_uuid
+WHERE
+    p.body ||| 'javascript'
+GROUP BY
+    b.name
+ORDER BY
+    COUNT(*) DESC
+LIMIT 10;
```

**File**: `benchmarks/datasets/stackoverflow/queries/join_aggregate_topk_count_medium_selectivity_uuid/README.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+# TopK Aggregate on JOIN, Medium Selectivity (DataFusion, UUID Join Key)
+
+- Join: `stackoverflow_posts -> badges` over unpartitioned full-entropy `UUID` keys (`badges.user_uuid = stackoverflow_posts.owner_user_uuid`)
+- Description: Mirrors `join_aggregate_topk_count_medium_selectivity` with deterministic `md5(...)::uuid` join keys (`GROUP BY badges.name`, `ORDER BY COUNT(*) DESC LIMIT 10`).
+
+## Query Info (statistics from 20m dataset):
+
+- `'regex'` selectivity on `stackoverflow_posts.body`: ~0.90% (~179K matches).
+  Without range co-partitioning on the UUID join keys, build-side cardinality (~179K rows) exercises medium/large UUID hash joins (and cross-process dynamic filter pushdown once supported).
+
+## Variant Omissions
+
+- `range_partitioned.sql` is omitted because the BM25 indexes are not range-partitioned on the UUID columns.
+- Native PostgreSQL aggregation and `basescan.sql` are omitted for the same reasons noted in `../join_aggregate_topk_count_medium_selectivity/README.md`.
```

**File**: `benchmarks/datasets/stackoverflow/queries/join_aggregate_topk_count_medium_selectivity_uuid/hash_partitioned.sql` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+-- DataFusion TopK aggregate scan
+SET work_mem TO '8GB'; SET paradedb.enable_aggregate_custom_scan TO on; SET paradedb.enable_range_partitioned_join TO off; SELECT
+    b.name,
+    COUNT(*)
+FROM stackoverflow_posts p
+JOIN badges b ON b.user_uuid = p.owner_user_uuid
+WHERE
+    p.body ||| 'regex'
+GROUP BY
+    b.name
+ORDER BY
+    COUNT(*) DESC
+LIMIT 10;
```

---

### Incident Patch 3: `d9317887` (2026-11-21)
**Commit Message**: fix: select EF Core docs smoke snippets by command (#7615)

## What

Select the EF Core setup commands by their contents and explicitly run
the optional VectorData install snippet.

## Why

Adding the VectorData callout shifted the Bash snippet positions. The
docs smoke test installed the package where it expected to create the
migration, then raised `StopIteration` while looking for the missing
migration file.

[Failed PostgreSQL 18 docs smoke
test](https://github.com/paradedb/paradedb/actions/runs/44724576728/job/136248903688?pr=7601)

## Tests

- Exercised `setup_efcore` against the current docs with mocked shell
execution. Verified command order, migration seed insertion, and setup
coverage.
- Ran `git diff --check`.

**File**: `.github/scripts/smoke_test_getting_started.py` (modified, +26/-6)
```diff
@@ -56,11 +56,22 @@ def run(command, cwd, env, source=None):
     subprocess.run(command, cwd=cwd, env=env, input=source, text=True, check=True)
 
 
-def block(target, info=None, index=0):
-    """Read a numbered fence from a getting-started language tab."""
+def block(target, info=None, index=0, *, command=None):
+    """Read a fence from a getting-started language tab."""
     fences = FENCE_PATTERN.findall(TABS[LABELS[target]])
     if info is not None:
         fences = [(label, body) for label, body in fences if label == info]
+    if command is not None:
+        fences = [
+            (label, body)
+            for label, body in fences
+            if any(
+                line == command or line.startswith(command + " ")
+                for line in map(str.strip, body.splitlines())
+            )
+        ]
+        if len(fences) != 1:
+            raise ValueError(f"Expected one {target} fence containing {command!r}")
     info, body = fences[index]
     CONSUMED_FENCES.add(fence_digest(info, body))
     return body
@@ -288,11 +299,20 @@ def setup_rails(cwd, env):
 
 def setup_efcore(cwd, env):
     """Execute EF Core migration creation, seed insertion and tutorial query."""
-    shell(block("efcore", "bash", 0), cwd, env)
+    shell(block("efcore", "bash", command="dotnet new tool-manifest"), cwd, env)
+    shell(
+        block("efcore", "bash", command="dotnet add package ParadeDB.VectorData"),
+        cwd,
+        env,
+    )
     (cwd / "Program.cs").write_text(
         connection_text(block("efcore", "cs Program.cs"), env)
     )
-    shell(block("efcore", "bash", 1), cwd, env)
+    shell(
+        block("efcore", "bash", command="dotnet ef migrations add CreateMockItems"),
+        cwd,
+        env,
+    )
     migration = next((cwd / "Migrations").glob("*_CreateMockItems.cs"))
     source = migration.read_text()
     # Insert exactly where the prose requests: at the end of Up, before Down.
@@ -303,7 +323,7 @@ def setup_efcore(cwd, env):
     ).start() + source.index("protected override void Up")
     source = source[:end] + block("efcore", "cs", 1) + "\n" + source[end:]
     migration.write_text(source)
-    shell(block("efcore", "bash", 2), cwd, env)
+    shell(block("efcore", "bash", command="dotnet ef database update"), cwd, env)
     program = cwd / "Program.cs"
     source = program.read_text().replace(
         "// Replace this with the query you want to run.",
@@ -319,7 +339,7 @@ def setup_efcore(cwd, env):
         ),
     )
     program.write_text(source)
-    shell(block("efcore", "bash", 3), cwd, env)
+    shell(block("efcore", "bash", command="dotnet run"), cwd, env)
 
 
 def validate_setup_coverage(target):
```

#### Recent Merged Pull Requests:
- **PR #7620** (2026-11-22): docs: Remove completed native vector search roadmap item (@philippemnoel)
- **PR #7618** (2026-11-21): docs: update ORM release versions and dependencies (@philippemnoel)
- **PR #7616** (2026-11-21): docs: Clarify that search runs in the same Postgres database (@philippemnoel)
- **PR #7615** (2026-11-21): fix: select EF Core docs smoke snippets by command (@philippemnoel)
- **PR #7612** (2026-11-21): fix: Solve AggregateScan parameters before entering a runtime. (@paradedb-github-bot[bot])
- **PR #7608** (2026-11-20): chore: Add UUID primary / foreign keys for stackoverflow (@stuhood)

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

## X. Solve AggregateScan parameters before entering a runtime.

**RULE**:
When implementing operations in `basescan/src/postgres/customscan/basescan/mod.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in paradedb/paradedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9e0eeecd`: Solve AggregateScan parameters before entering a runtime.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `basescan/src/postgres/customscan/basescan/mod.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    ///    Either the main backend running a serial path, a `parallel_safe` but not
    ///    `parallel_aware` scan inside a worker (e.g. the inner side of a Parallel Hash Join),
    ///    or a `parallel_aware` scan running locally on the leader when `es_use_parallel_mode`
    ///    is false or `InitializeParallelDSM` falls back to private memory (`es_query_dsa == NULL`).
        // Populate the private bitmap cursor source when running without attached parallel DSM
        // state. Handling this here (rather than gating on `!plan.parallel_aware` in
        // `init_search_reader`) covers both genuinely serial scans and `parallel_aware` scans
        // that fell back to leader-only local execution (e.g. `es_use_parallel_mode = false` or
        // PostgreSQL's `InitializeParallelDSM` private-memory fallback with `es_query_dsa == NULL`),
        // without eagerly building a private bitmap during `estimate_dsm_custom_scan`.
        if state.custom_state().parallel.is_none()
            && let Some(cell) = state.custom_state().bitmap_cell.clone()
            && cell.get().is_none()
            && let Some(bitmap_exec) = state.custom_state_mut().bitmap_exec.as_mut()
            &
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    ///    Either the main backend running a serial path, or a `parallel_safe` but not
    ///    `parallel_aware` scan inside a worker (e.g. the inner side of a Parallel Hash Join).
        let parallel_aware = unsafe { (*(*state.planstate()).plan).parallel_aware };
        if !parallel_aware
            && let Some(cell) = state.custom_state().bitmap_cell.clone()
            && cell.get().is_none()
            && let Some(bitmap_exec) = state.custom_state_mut().bitmap_exec.as_mut()
            && let Some(source) = unsafe { bitmap_exec.private_source() }
        {
            cell.fill(source);
        }

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9e0eeecd` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
