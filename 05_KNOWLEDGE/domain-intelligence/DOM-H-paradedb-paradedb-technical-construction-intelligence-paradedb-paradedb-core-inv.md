# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: paradedb/paradedb Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "paradedb/paradedb",
  "source_url": "https://github.com/paradedb/paradedb",
  "source_version": "98188786",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-19T17:38:05.104Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-paradedb-paradedb",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [paradedb/paradedb](https://github.com/paradedb/paradedb) (Revision: `98188786`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-19T17:38:05.104Z`  
> **Learning ID**: `learn-github-paradedb-paradedb`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), L (Deployment & Operations Intelligence), F (Design Intelligence)
- **Confidence Rating**: 52%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from paradedb/paradedb:

# Forensic Learning Record (Deep Inspection): paradedb/paradedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/paradedb-paradedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/paradedb/paradedb](https://github.com/paradedb/paradedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T17:38:03.891Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `paradedb/paradedb`
- **Description**: One Postgres for your application data, full-text search, vector retrieval, and aggregations. Home of the pg_search extension.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9541 stars

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

    base_search_query_input: SearchQueryInput,
    search_query_input: SearchQueryInput,
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
    pub join_predicates: Option<SearchQueryInput>,

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

    pub fn set_base_search_query_input(&mut self, input: SearchQueryInput) {
        self.base_search_query_input = input;
    }

    pub fn search_query_input(&self) -> &SearchQueryInput {
        if matches!(self.search_query_input, SearchQueryInput::Uninitialized) {
            panic!("search_query_input should be initialized");
        }
        &self.search_query_input
    }

    /// Get the original base search query input before any modifications
    pub fn base_search_query_input(&self) -> &SearchQueryInput {
        &self.base_search_query_input
    }

    /// Drop the active search results (whose scorers hold bitmap cursors),
    /// keeping the selected exec method: `reset()` re-binds it to the rebuilt
    /// reader after a rescan. Replacing the method here would leave the
    /// default `UnknownScanStyle`, which panics on its next use. No reader means
    /// the scan never executed: there are no scorers, and the exec method may
    /// not even be bound yet.
    pub fn reset_exec_results(&mut self) {
        if self.search_reader.is_some() {
            self.exec_method_mut().reset(self);
       
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
    query: Box<dyn Query>,
    need_scores: bool,
    searcher: Searcher,
    weight: OnceLock<Box<dyn Weight>>,
}

impl LazyWeight {
    pub fn new(query: Box<dyn Query>, need_scores: bool, searcher: Searcher) -> Self {
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
            Box::new(BooleanQuery::new(vec![
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

/// State for projecting wrapped aggregate expressions through Postgres' own
/// `ExecBuildProjectionInfo`.
///
/// When the targetlist contains aggregates wrapped in `FuncExpr` calls, we
/// build a copy of the targetlist with each `FuncExpr`'s aggregate replaced by
/// a placeholder, and project that copy. Before each per-row projection we
/// write the live aggregate values into the placeholder columns.
pub struct WrappedAggregateProjection {
    /// Projection of the targetlist copy, built one time for the scan.
    pub projection: PlaceholderProjection,
    /// The placeholder column and its type, indexed by target entry position
    /// (0-based). `None` for entries without a placeholder.
    pub placeholders: Vec<Option<(PlaceholderColumn, pg_sys::Oid)>>,
}

#[derive(Default)]
pub struct AggregateScanState {
    pub state: ExecutionState,
    /// DataFusion backend state. When `Some`, the DataFusion path is active
    /// and the Tantivy-specific fields are unused. Declared before `source_manifests`,
    /// `bitmap_cell`, `bitmap_exec`, and `indexrel` so streams/runtime drop first.
    pub datafusion_state: Option<DataFusionAggState>,

    pub segment_pruning: SegmentPruningEstimate,
    pub visibility_stats: VisibilityStats,
    pub parallelism: Option<AggregateParallelism>,
    pub execution_rti: pg_sys::Index,
    pub aggregate_clause: AggregateCSClause,
    pub base_aggregate_clause: Option<AggregateCSClause>,
    /// Where the Tantivy path solves `aggregate_clause`; `None` when it has nothing to solve.
    /// Separate from `ps_ExprContext`, which wrapped-aggregate projection resets per row: see the
    /// rules in `solve_expr.rs`. Unused on the DataFusion path.
    pub runtime_context: Option<NonNull<pg_sys::ExprContext>>,

    /// Wrapped-aggregate projection state. `Some` only when the targetlist
    /// has aggregates inside `FuncExpr` wrappers that need per-row projection.
    pub wrapped_projection: Option<WrappedAggregateProjection>,

    /// Tantivy-only reusable tuple slot for aggregate result rows.
    /// Created once during begin_custom_scan and cleared/reused for each row
    /// to avoid per-row memory allocation and leaks
    pub scan_slot: Option<*mut pg_sys::TupleTableSlot>,

    /// Execution state for the child bitmap scan, if a bitmap intersection source was
    /// harvested at plan time.
    pub bitmap_cell: Option<BitmapCell>,
    pub bitmap_exec: Option<BitmapExec>,

    /// MPP-only: captured source manifests held by the leader. Serves two
    /// purposes (mirrors JoinScan):
    /// 1. Provides segment counts for DSM sizing in `estimate_dsm_custom_scan`
    ///    and segment readers for DSM population in `initialize_dsm_custom_scan`.
    /// 2. Keeps Tantivy buffer pins alive through `exec_custom_scan` so
    ///    background merges don't recycle the canonical segments before
    ///    workers can open them via `MvccSatisfies::ParallelWorker(ids)`.
    pub source_manifests: Vec<SearchIndexManifest>,

    pub indexrelid: pg_sys::Oid,
    pub indexrel: Option<(pg_sys::LOCKMODE, PgSearchRelation)>,

    /// A collection of things needed for result-rewriting decisions that
    /// are expensive to look up.
    precomputed_index_info: Option<AggIndexInfo>,
}

impl AggregateScanState {
    pub fn open_relations(&mut self, lockmode: pg_sys::LOCKMODE) {
        self.indexrel = Some((
            lockmode,
            PgSearchRelation::with_lock(self.indexrelid, lockmode),
        ));
        self.precomputed_index_info = Some(AggIndexInfo::from(self.indexrel()))
    }

    #[inline(always)]
    pub fn indexrel(&self) -> &PgSearchRelation {
        self.indexrel
            .as_ref()
            .map(|(_, rel)| rel)
            .expect("BaseScanState: indexrel should be initialized")
    }

    /// Returns true if the DataFusion backend is active.
    pub fn is_datafusion_backend(&self) -> bool {
        self.datafusion_state.is_some()
    }

    pub fn precomputed_index_info(&self) -> Option<&AggIndexInfo> {
        self.precomputed_index_info.as_ref()
    }
}

impl CustomScanState for AggregateScanState {
    fn init_exec_method(&mut self, _cstate: *mut pg_sys::CustomScanState) {
        // TODO: Unu
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7433** (2026-11-12): **CI: Citus 13 build fails on PostgreSQL 15.20 with a redeclared `have_createdb_privilege`**
  *Symptoms*: # What happens?  Since PostgreSQL 15.20 reached `apt.postgresql.org` on 2026-11-12, the `Build & install Citus 13 (PG 15)` step of `Test pg_search` fails.  ``` citus/src/include/pg_version_compat.h:604:1: error: static declaration of ‘have_createdb_privilege’ follows non-static declaration /usr/include/postgresql/15/server/commands/dbcommands.h:33:13: note: previous declaration of ‘have_createdb_privilege’ with type ‘_Bool(void)’ ```  PostgreSQL 15.20 exports `have_createdb_privilege` from `commands/dbcommands.h` (postgres/postgres@98ec97f673). Citus 13 has a `static inline` copy of it for PostgreSQL versions before 16 in `src/include/pg_version_compat.h`, so the two declarations collide. `v13.4.0` and `v13.5.0` have the same copy, so a newer 13.x tag doesn't help.  The last green run of this job installed `postgresql-server-dev-15` `15.19-1.pgdg26.04+2`. The red runs install `15.20-1.pgdg26.04+1`. PostgreSQL 16 to 18 aren't affected, because those jobs build Citus 14.  These runs fail at the same step.  - https://github.com/paradedb/paradedb/actions/runs/43280487148/job/131400357675 (#7430) - https://github.com/paradedb/paradedb/actions/runs/43272838607 - https://github.com/paradedb/paradedb/actions/runs/43267298415 - https://github.com/paradedb/paradedb/actions/runs/43266693756  ## To Reproduce  Run this on Ubuntu with the PGDG apt repository.  ```bash sudo apt-get install -y postgresql-15 postgresql-server-dev-15 git clone --depth 1 --branch v13.3.0 https://github.com/citu

- **Issue #7428** (2026-11-19): **Aggregate Scan with MPP misses a concurrent insert under SERIALIZABLE**
  *Symptoms*: ### What happens?  Under `SERIALIZABLE`, an Aggregate Scan that runs with MPP can miss a concurrent insert, and both transactions commit. The same steps without MPP abort one of them with 40001.  The scan pins its view of the index when the plan starts (`prepare_mpp` in `begin_custom_scan`), but takes its SIREAD lock only at the first exec. If a writer inserts and commits in between, the writer's conflict checks find no lock, and the reader reads the old view, so it never sees the new row. No conflict is recorded.  ### To Reproduce  ```sql CREATE EXTENSION IF NOT EXISTS pg_search CASCADE; CREATE TABLE authors (id int PRIMARY KEY, name text); CREATE TABLE posts (id int PRIMARY KEY, author_id int, title text); CREATE TABLE flags (id int PRIMARY KEY, v int); CREATE INDEX authors_idx ON authors USING paradedb (id, name); CREATE INDEX posts_idx ON posts USING paradedb (id, author_id, title);  -- two segments per index, so MPP can launch SET paradedb.global_mutable_segment_rows = 0; INSERT INTO authors VALUES (1, 'a1'), (2, 'a2'); INSERT INTO authors VALUES (3, 'a3'), (4, 'a4'); INSERT INTO posts VALUES (10, 1, 'rust'), (20, 2, 'rust'); INSERT INTO posts VALUES (30, 3, 'rust'), (40, 4, 'rust'); INSERT INTO flags VALUES (1, 0);  -- Session 1 (reader) SET paradedb.mpp_min_rows = 0; SET max_parallel_workers_per_gather = 3; SET parallel_setup_cost = 0; SET parallel_tuple_cost = 0; BEGIN ISOLATION LEVEL SERIALIZABLE; -- pg_sleep holds the scan between begin and exec SELECT pg_sleep(3), 

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

### Incident Patch 1: `534617a6` (2026-11-19)
**Commit Message**: fix: retry background merges without blocking the sweep or VACUUM (#7276)

## What

Retry background merges from the periodic sweep when an index exceeds
twice its target segment count, even after writes stop. Make optional
background-merge scheduling from both the sweep and VACUUM skip busy
indexes instead of waiting.

## How

- Count visible segments during the existing metadata walk and attempt
sweep merge selection only when background merging is enabled and the
count exceeds twice `target_segment_count`. Keep the existing
four-times-target foreground backpressure threshold unchanged.
- Apply the 30-second per-index sweep cooldown only when selection finds
no candidates. Busy slots, locks, temporary merge/VACUUM exclusions, and
successful launches remain retryable on the configured sweep interval.
Mutable flushing, write scheduling, and VACUUM scheduling are
unaffected.
- Give mutable flushing priority within each sweep. Schedule background
work only when there are no idle mutable segments to flush.
- Use one `MergeStyle::Background` for VACUUM cleanup and the sweep.
Conditionally acquire merge admission and the merge lock, skipping busy
indexes. Preserve required VACUUM cleanu

**File**: `index_write/src/postgres/merge.rs` (modified, +27/-8)
```diff
@@ -98,8 +98,8 @@ pub enum MergeStyle {
         current_xid: pg_sys::FullTransactionId,
         next_xid: pg_sys::FullTransactionId,
     },
-    /// VACUUM finished; only a background merge may follow.
-    Vacuum,
+    /// Only schedule a background merge; skip busy indexes.
+    Background,
 }
 
 /// Who runs a merge, which decides what happens between candidates.
@@ -326,32 +326,51 @@ fn backpressure(
 /// Kick off a merge of the index, if needed.
 ///
 /// Prefer a background worker; help with one eligible merge when workers are busy or unavailable.
-pub unsafe fn do_merge(index: &PgSearchRelation, style: MergeStyle) -> anyhow::Result<()> {
+/// Returns true only for an empty background selection with no temporary exclusions.
+pub unsafe fn do_merge(index: &PgSearchRelation, style: MergeStyle) -> anyhow::Result<bool> {
     // don't kick off merges for invalid indexes
     if !index.is_valid() {
-        return Ok(());
+        return Ok(false);
     }
 
+    if matches!(style, MergeStyle::Background)
+        && index.options().background_layer_sizes().is_empty()
+    {
+        return Ok(false);
+    }
     let layer_sizes = IndexLayerSizes::from(index);
     let target_segment_count = index.target_segment_count();
     let metadata = MetaPage::open(index);
-    let merge_pins = metadata.pin_merge();
-    let merge_lock = metadata.acquire_merge_lock();
+    let (merge_pins, merge_lock) = if matches!(style, MergeStyle::Background) {
+        if VacuumSignal::new(index.oid()).wants_cancel() {
+            return Ok(false);
+        }
+        let Some(locks) = metadata.try_pin_and_lock_merge() else {
+            return Ok(false);
+        };
+        locks
+    } else {
+        (metadata.pin_merge(), metadata.acquire_merge_lock())
+    };
     let merger = SearchIndexMerger::open(index, MvccSatisfies::Mergeable)?;
     let mut merge_policy = LayeredMergePolicy::new(layer_sizes.combined());
     #[cfg(feature = "pg_test")]
     crate::postgres::storage::coordination_test::selection_pause();
     merge_policy.set_mergeable_segment_entries(&metadata, &merge_lock, &merger);
     let (candidates, largest_layer_size, skipped) = merge_policy.simulate_supported(&merger)?;
     warn_unsupported_vector_merge(index, skipped);
+    let no_candidates = matches!(style, MergeStyle::Background)
+        && candidates.is_empty()
+        && merge_lock.merge_list().list_segment_ids().next().is_none()
+        && metadata.vacuum_list().read_list().is_empty();
     let needs_background_merge =
         layer_sizes.user_configured_background_layers() && !candidates.is_empty();
     let background_launched =
         needs_background_merge && try_launch_background_merger(index, largest_layer_size);
     // If a background merger launched successfully, exit before applying more backpressure
     // so foreground backpressure does not race with it to claim segments.
     if background_launched {
-        return Ok(());
+        return Ok(false);
     }
     if let MergeStyle::Insert {
         current_xid,
@@ -398,7 +417,7 @@ pub unsafe fn do_merge(index: &PgSearchRelation, style: MergeStyle) -> anyhow::R
             );
         }
     }
-    Ok(())
+    Ok(no_candidates)
 }
 
 /// Try to launch a background process to merge down the index.
```

**File**: `index_write/src/postgres/mutable_sweep.rs` (modified, +43/-18)
```diff
@@ -25,10 +25,11 @@ use crate::postgres::delete::VacuumSignal;
 use crate::postgres::index::free_leaf_partition_indexes;
 use crate::postgres::locks::AdvisoryLock;
 use crate::postgres::merge::{
-    MergeMode, MergeSlot, MergeSlotVariant, merge_crash_details, merge_index,
+    MergeMode, MergeSlot, MergeSlotVariant, MergeStyle, do_merge, merge_crash_details, merge_index,
     warn_unsupported_vector_merge,
 };
 use crate::postgres::ps_status::{MERGING, set_ps_display_suffix};
+use crate::postgres::storage::block::MVCCEntry;
 use crate::postgres::storage::metadata::MetaPage;
 use pgrx::bgworkers::{BackgroundWorker, BackgroundWorkerBuilder, SignalWakeFlags};
 use pgrx::{
@@ -40,6 +41,8 @@ use std::panic::AssertUnwindSafe;
 use std::time::{Duration, Instant};
 
 static INTERVAL_MS: GucSetting<i32> = GucSetting::<i32>::new(1000);
+const SWEEP_MERGE_MULTIPLIER: usize = 2;
+const BACKGROUND_MERGE_COOLDOWN: Duration = Duration::from_secs(30);
 
 // Check for missing workers and new databases independently of the sweep interval.
 const WORKER_CHECK_INTERVAL: Duration = Duration::from_secs(30);
@@ -193,12 +196,14 @@ unsafe extern "C-unwind" fn mutable_sweep_database(database: pg_sys::Datum) {
     let mut next_sweep = Instant::now();
     let mut interval = INTERVAL_MS.get();
     let mut previous_counts = HashMap::default();
+    let mut merge_retry_after = HashMap::default();
     loop {
         reload();
         if INTERVAL_MS.get() != interval {
             interval = INTERVAL_MS.get();
             next_sweep = Instant::now();
             previous_counts.clear();
+            merge_retry_after.clear();
         }
         if interval == 0 {
             return;
@@ -233,6 +238,7 @@ unsafe extern "C-unwind" fn mutable_sweep_database(database: pg_sys::Datum) {
             return;
         }
         if sweeping {
+            merge_retry_after.retain(|_, deadline| *deadline > Instant::now());
             let observed_counts = pass_context.switch_to(|_| {
                 let indexes = BackgroundWorker::transaction(|| {
                     if lookup_extension_version(c"pg_search").as_deref()
@@ -248,52 +254,68 @@ unsafe extern "C-unwind" fn mutable_sweep_database(database: pg_sys::Datum) {
                             if !(*index.rd_rel).relam.is_paradedb_am() || !index.is_valid() {
                                 return None;
                             }
-                            let mut idle_segments = HashMap::default();
+                            let mut idle_mutable_segments = HashMap::default();
+                            let mut visible_segment_count = 0;
                             MetaPage::open(&index).segment_metas().for_each(|_, entry| {
+                                if entry.visible() {
+                                    visible_segment_count += 1;
+                                }
                                 if entry.is_mutable()
                                     && entry.xmax() == pg_sys::InvalidTransactionId
                                 {
                                     let key = (index.oid(), entry.segment_id());
                                     let count = entry.num_docs();
                                     current_counts.insert(key, count);
                                     if previous_counts.get(&key) == Some(&count) {
-                                        idle_segments.insert(entry.segment_id(), count);
+                                        idle_mutable_segments.insert(entry.segment_id(), count);
                                     }
                                 }
                             });
-                            (!idle_segments.is_empty()).then_some((index.oid(), idle_segments))
+                            let needs_merge = visible_segment_count
+                                > SWEEP_MERGE_MULTIPLIER * index.target_segment_count()
+                                && !index.options().background_layer_sizes().is_empty()
+                                && !merge_retry_after.contains_key(&index.oid());
+                            (!idle_mutable_segments.is_empty() || needs_merge)
+                                .then_some((index.oid(), idle_mutable_segments))
                         })
                         .collect::<Vec<_>>();
                     Some((indexes, current_counts))
                 });
                 let (indexes, current_counts) = indexes?;
                 pg_sys::pgstat_report_appname(c"pg_search mutable sweep".as_ptr());
-                for (index, idle_segments) in indexes {
+                for (index, idle_mutable_segments) in indexes {
                     reload();
                     if INTERVAL_MS.get() == 0 {
                         break;
                     }
-                    BackgroundWorker::transaction(|| {
+                    let mut no_candidates = false;
+                    BackgroundWorker::transaction(AssertUnwindSafe(|| {
                         let Some(index) =
```

**File**: `index_write/src/postgres/vacuum.rs` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ pub unsafe extern "C-unwind" fn amvacuumcleanup(
         let next_xid = pg_sys::ReadNextFullTransactionId();
         garbage_collect_index(&index, next_xid, next_xid);
     }
-    do_merge(&index, MergeStyle::Vacuum).expect("should be able to merge");
+    do_merge(&index, MergeStyle::Background).expect("should be able to merge");
     // Names the index to a standby cloned after the build; see
     // `PgSearchRelation::blocked_after_promotion`.
     custom_rmgr::emit_init_record(&index);
```

**File**: `pg_search/tests/merge_cleanup.rs` (modified, +243/-6)
```diff
@@ -24,6 +24,12 @@ use std::time::{Duration, Instant};
 /// Keep other schedules' write transactions out of VACUUM's snapshot horizon.
 static SCHEDULE: Mutex<()> = Mutex::new(());
 
+const SWEEP_INTERVAL_MS: i32 = 1000;
+const SWEEP_MERGE_THRESHOLD: i32 = 2;
+const SWEEP_PRESSURE_SEGMENT_COUNT: i32 = SWEEP_MERGE_THRESHOLD + 1;
+const IMMUTABLE_SEGMENT_ROWS: i32 = 250;
+const WAIT_TIMEOUT: Duration = Duration::from_secs(10);
+
 fn connect() -> Client {
     let mut client = if let Ok(url) = std::env::var("PG_SEARCH_TEST_DATABASE_URL") {
         Client::connect(&url, NoTls).unwrap()
@@ -47,7 +53,7 @@ fn connect() -> Client {
 }
 
 fn wait_until(description: &str, mut condition: impl FnMut() -> bool) {
-    let deadline = Instant::now() + Duration::from_secs(10);
+    let deadline = Instant::now() + WAIT_TIMEOUT;
     while !condition() {
         assert!(
             Instant::now() < deadline,
@@ -163,12 +169,23 @@ impl Fixture {
     }
 
     fn segments_with_rows(&mut self, rows: i32) {
+        let batches = if self.mutable { 6 } else { 4 };
+        self.segments_with_batches(rows, batches);
+    }
+
+    fn segments_with_batches(&mut self, rows: i32, batches: i32) {
+        self.insert_segments(rows, batches);
+        self.controller
+            .batch_execute(&format!("DELETE FROM {} WHERE id % 2=0", self.table))
+            .unwrap();
+    }
+
+    fn insert_segments(&mut self, rows: i32, batches: i32) {
         let body = if self.mutable {
             "'alpha beta'"
         } else {
             "'alpha beta ' || md5(id::text)"
         };
-        let batches = if self.mutable { 6 } else { 4 };
         for batch in 0..batches {
             self.controller
                 .batch_execute(&format!(
@@ -179,8 +196,16 @@ impl Fixture {
                 ))
                 .unwrap();
         }
+    }
+
+    fn start_sweep(&mut self) {
         self.controller
-            .batch_execute(&format!("DELETE FROM {} WHERE id % 2=0", self.table))
+            .batch_execute(&format!(
+                "ALTER SYSTEM SET paradedb.mutable_sweep_interval = {SWEEP_INTERVAL_MS}"
+            ))
+            .unwrap();
+        self.controller
+            .simple_query("SELECT pg_reload_conf()")
             .unwrap();
     }
 
@@ -929,15 +954,220 @@ fn periodic_sweep_waits_for_unchanged_document_counts() {
         .unwrap();
 }
 
+#[test]
+fn vacuum_cleanup_skips_busy_merge_scheduling() {
+    const SCHEDULING_DEADLINE: Duration = Duration::from_secs(2);
+    const POLL_INTERVAL: Duration = Duration::from_millis(10);
+    let _schedule = SCHEDULE.lock().unwrap_or_else(|error| error.into_inner());
+    for (table, phase, function) in [
+        ("vacuum_busy_selection", "selection", "test_merge_index"),
+        (
+            "vacuum_busy_admission",
+            "merge",
+            "test_hold_cleanup_admission",
+        ),
+    ] {
+        let mut fixture = Fixture::new(table, false);
+        fixture.insert_segments(IMMUTABLE_SEGMENT_ROWS, SWEEP_PRESSURE_SEGMENT_COUNT);
+        fixture
+            .controller
+            .batch_execute(&format!(
+                "ALTER INDEX {} SET (background_layer_sizes='1mb')",
+                fixture.index,
+            ))
+            .unwrap();
+        let holder = fixture.actor(
+            phase,
+            format!("SELECT paradedb.{function}('{}')", fixture.index),
+        );
+        fixture.stage(&holder);
+        let mut vacuum = connect();
+        let query = format!("VACUUM {table}");
+        let vacuum = spawn(move || vacuum.batch_execute(&query));
+        let deadline = Instant::now() + SCHEDULING_DEADLINE;
+        while !vacuum.is_finished() && Instant::now() < deadline {
+            sleep(POLL_INTERVAL);
+        }
+        let completed_while_busy = vacuum.is_finished();
+        fixture.release(&holder);
+        holder.finish().1.unwrap();
+        vacuum.join().unwrap().unwrap();
+        assert!(completed_while_busy, "VACUUM waited for merge scheduling");
+        fixture.assert_rows(i64::from(
+            SWEEP_PRESSURE_SEGMENT_COUNT * IMMUTABLE_SEGMENT_ROWS,
+        ));
+        assert!(fixture.value::<bool>(&format!(
+            "SELECT bool_and(passed) FROM pdb.verify_index('{}', heapallindexed=>true)",
+            fixture.index,
+        )));
+    }
+}
+
+#[test]
+fn periodic_sweep_retries_background_merges_without_new_writes() {
+    let _schedule = SCHEDULE.lock().unwrap_or_else(|error| error.into_inner());
+    let mut disabled = Fixture::new("sweep_disabled", false);
+    disabled.segments_with_batches(IMMUTABLE_SEGMENT_ROWS, SWEEP_PRESSURE_SEGMENT_COUNT);
+    let mut at_threshold = Fixture::new("sweep_at_threshold", false);
+    at_threshold.segments_with_batches(IMMUTABLE_SEGMENT_ROWS, SWEEP_MERGE_THRESHOLD);
+    at_threshold
+        .controller
+        .batch_execute("ALTER INDEX sweep_at_threshold_idx SET (background_layer_sizes='1mb')")
+        .unwrap();
+    let mut fixture = Fixture::new("sweep_immuta
```

**File**: `storage/src/postgres/storage/merge.rs` (modified, +9/-0)
```diff
@@ -55,6 +55,15 @@ impl MergeLock {
         Self::from_buffer(bman, buffer)
     }
 
+    pub unsafe fn try_acquire(
+        indexrel: &PgSearchRelation,
+        block_number: pg_sys::BlockNumber,
+    ) -> Option<Self> {
+        let mut bman = BufferManager::new(indexrel);
+        let buffer = bman.get_buffer_conditional(block_number)?;
+        Some(Self::from_buffer(bman, buffer))
+    }
+
     /// Like `acquire`, but first waits for every other pin on the merge page (`LockBufferForCleanup`).
     pub unsafe fn acquire_for_cleanup(
         indexrel: &PgSearchRelation,
```

**File**: `storage/src/postgres/storage/metadata.rs` (modified, +8/-2)
```diff
@@ -307,8 +307,8 @@ impl MetaPage {
         }
     }
 
-    /// Returns `None` if VACUUM blocks merge admission, so the sweep can try other indexes.
-    pub fn try_pin_merge(&self) -> Option<MergePins> {
+    /// Returns `None` if VACUUM blocks merge admission.
+    fn try_pin_merge(&self) -> Option<MergePins> {
         unsafe {
             let relation = self.bman.buffer_access().rel().as_ptr();
             let blockno = self.cleanup_lock_blockno();
@@ -322,6 +322,12 @@ impl MetaPage {
         }
     }
 
+    pub unsafe fn try_pin_and_lock_merge(&self) -> Option<(MergePins, MergeLock)> {
+        let pins = self.try_pin_merge()?;
+        let lock = MergeLock::try_acquire(self.bman.buffer_access().rel(), self.data.merge_lock)?;
+        Some((pins, lock))
+    }
+
     pub fn vacuum_list(&self) -> VacuumList {
         assert!(block_number_is_valid(self.data.active_vacuum_list));
         VacuumList::open(
```

---

### Incident Patch 2: `08b5a731` (2026-11-19)
**Commit Message**: fix: Keep a Community standby replaying past ParadeDB index creation, and refuse replicated indexes after promotion (#7386)

# Ticket(s) Closed

- Closes #6007

## What

1. A ParadeDB Community standby no longer shuts down when it replays the
creation of a ParadeDB index.
2. On the standby, only a query that uses a ParadeDB index fails
(`0A000`); every other query on the same table works.
3. After the standby is promoted, the indexes it received through
replication refuse queries with `0A000` and a `REINDEX INDEX` hint until
rebuilt. The table, its writes and its other indexes keep working.

## Why

`ambuild` emits the custom rmgr's `INIT_INDEX` record after logging the
index pages, and `rm_redo` raised ERROR on it on a standby. The startup
process has no exception stack, so the ERROR was FATAL and the standby
shut down; every restart replayed the same record. Separately,
`amcanreturn` opened the metapage, which refuses on a standby, so
planning any query on the table failed there.

## How

- `rm_redo` no longer errors.
- On a hot standby `rel_get_bm25_index`, which the planner hooks and the
search operators all call, answers "no index", and `amcanreturn` answers
false, so PostgreS

**File**: `common/src/postgres/utils.rs` (modified, +32/-0)
```diff
@@ -1034,6 +1034,38 @@ pub fn pg_search_extension_installed() -> bool {
     unsafe { pg_sys::get_extension_oid(c"pg_search".as_ptr(), true) != pg_sys::InvalidOid }
 }
 
+/// True in a backend of a hot standby that is still replaying WAL. ParadeDB Community does not
+/// serve its indexes there: `rel_get_bm25_index` and `amcanreturn` answer "no index" so the
+/// planner never opens one for a query that does not need it, and `RelationBufferAccess::open`
+/// refuses for the statements that do.
+pub fn in_hot_standby() -> bool {
+    // `RecoveryInProgress` latches `LocalRecoveryInProgress` false on a primary without a lock.
+    unsafe { pg_sys::RecoveryInProgress() }
+}
+
+/// The error a statement that needs a ParadeDB index gets on a hot standby.
+pub fn report_hot_standby() -> ! {
+    report_community_limit(
+        "Serving reads from a standby requires write-ahead log (WAL) integration, which is supported on ParadeDB Enterprise, not ParadeDB Community".into(),
+        None,
+    )
+}
+
+/// Raises `0A000` for something ParadeDB Community does not do, with the Enterprise detail.
+pub fn report_community_limit(message: String, hint: Option<String>) -> ! {
+    let mut report = pg_sys::panic::ErrorReport::new(
+        PgSqlErrorCode::ERRCODE_FEATURE_NOT_SUPPORTED,
+        message,
+        function_name!(),
+    )
+    .set_detail("ParadeDB Enterprise is commercially licensed and included with ParadeDB Cloud. To self-host ParadeDB Enterprise, contact sales@paradedb.com.");
+    if let Some(hint) = hint {
+        report = report.set_hint(hint);
+    }
+    report.report(PgLogLevel::ERROR);
+    unreachable!("ErrorReport::report at ERROR level does not return")
+}
+
 /// RAII wrapper for `pg_sys::List` that automatically frees the list on drop.
 ///
 /// This is useful when you need to create a temporary PostgreSQL list for use with
```

**File**: `docs/concepts/guarantees.mdx` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ Physical replication refers to running ParadeDB itself in a multi-node, high-ava
 [ParadeDB Community](https://github.com/paradedb/paradedb) supports logical replication, but not physical replication:
 
 - It can act as a logical replica, ingesting changes from a Postgres primary and indexing them transactionally.
-- The ParadeDB index does not get physically replicated and won't be available on other nodes in a high availability setup.
+- The ParadeDB index does not get physically replicated and won't be available on other nodes in a high availability setup. After a failover, the promoted server needs a `REINDEX` before the index can be queried.
 
 [ParadeDB Enterprise](/operate/deploy/enterprise) supports both:
 
```

**File**: `docs/project/changelog/unreleased/7386.breaking.mdx` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+header: breaking
+title: Physical replication and failover on ParadeDB Community
+---
+
+High availability and read replicas have always been ParadeDB Enterprise features, but previously spinning up a physical standby on ParadeDB Community stopped WAL replay entirely when a ParadeDB index was created (#6007). Physical replication is now allowed to continue: non-ParadeDB queries work normally, queries that use a ParadeDB index on a read replica return an error, and if a standby fails over to become a primary (or a server is restored from a base backup taken on a standby) its replicated ParadeDB indexes emit an error and require `REINDEX INDEX`. Backups taken from the primary are unaffected.
+
+Upgrade standbys before the primary: the primary now writes a ParadeDB WAL record during `CREATE INDEX`, `VACUUM`, and `ANALYZE` on indexed tables, and a standby running an earlier release shuts down when replaying that record.
```

**File**: `index_read/src/postgres/mod.rs` (modified, +55/-8)
```diff
@@ -64,18 +64,65 @@ impl TryFrom<pg_sys::StrategyNumber> for ScanStrategy {
     }
 }
 
-/// Finds and returns the `USING paradedb` index on the specified relation, along with the heap
-/// relation. Returns [`None`] if there isn't one. [`PgSearchRelation::bm25_index`] picks the index.
+/// Outcome of looking up the usable `USING paradedb` search index on a relation.
+#[derive(Debug)]
+pub enum Bm25IndexLookup {
+    Found {
+        table: PgSearchRelation,
+        index: PgSearchRelation,
+    },
+    /// The table has no valid `USING paradedb` search index.
+    Missing,
+    /// This backend runs on a hot standby, where ParadeDB Community serves no index.
+    HotStandby,
+    /// The index reached this server through replication before it was promoted.
+    BlockedAfterPromotion(PgSearchRelation),
+}
+
+impl Bm25IndexLookup {
+    /// Returns `(table, index)` when usable, or raises the error for this outcome (`missing`
+    /// supplies the caller's message for [`Bm25IndexLookup::Missing`]).
+    pub fn unwrap_or_report(
+        self,
+        missing: impl FnOnce() -> String,
+    ) -> (PgSearchRelation, PgSearchRelation) {
+        match self {
+            Self::Found { table, index } => (table, index),
+            Self::Missing => pgrx::error!("{}", missing()),
+            Self::HotStandby => crate::postgres::utils::report_hot_standby(),
+            Self::BlockedAfterPromotion(index) => index.report_blocked_after_promotion(),
+        }
+    }
+}
+
+/// Looks up the `USING paradedb` search index on `relid`, along with its heap relation.
+/// [`PgSearchRelation::bm25_index`] picks the index.
+pub fn lookup_bm25_index(relid: pg_sys::Oid) -> Bm25IndexLookup {
+    if relid == pg_sys::Oid::INVALID {
+        return Bm25IndexLookup::Missing;
+    }
+    if crate::postgres::utils::in_hot_standby() {
+        return Bm25IndexLookup::HotStandby;
+    }
+
+    let table = PgSearchRelation::with_lock(relid, pg_sys::AccessShareLock as _);
+    match table.bm25_index() {
+        Some(index) if index.blocked_after_promotion() => {
+            Bm25IndexLookup::BlockedAfterPromotion(index)
+        }
+        Some(index) => Bm25IndexLookup::Found { table, index },
+        None => Bm25IndexLookup::Missing,
+    }
+}
+
+/// [`lookup_bm25_index`] for callers that plan without the index when there is none.
 pub fn rel_get_bm25_index(
     relid: pg_sys::Oid,
 ) -> Option<(rel::PgSearchRelation, rel::PgSearchRelation)> {
-    if relid == pg_sys::Oid::INVALID {
-        return None;
+    match lookup_bm25_index(relid) {
+        Bm25IndexLookup::Found { table, index } => Some((table, index)),
+        _ => None,
     }
-
-    let rel = PgSearchRelation::with_lock(relid, pg_sys::AccessShareLock as _);
-    let index = rel.bm25_index()?;
-    Some((rel, index))
 }
 
 // 16 bytes for segment UUID
```

**File**: `index_write/src/postgres/build.rs` (modified, +3/-3)
```diff
@@ -89,9 +89,9 @@ pub extern "C-unwind" fn ambuild(
         };
     }
 
-    if needs_wal {
-        custom_rmgr::emit_init_record();
-    }
+    // `emit_init_record` checks `need_wal`; restore the flag suppressed above.
+    index_relation.set_need_wal(needs_wal);
+    custom_rmgr::emit_init_record(&index_relation);
 
     let mut result = unsafe { PgBox::<pg_sys::IndexBuildResult>::alloc0() };
     result.heap_tuples = heap_tuples;
```

**File**: `index_write/src/postgres/vacuum.rs` (modified, +4/-0)
```diff
@@ -20,6 +20,7 @@ use pgrx::*;
 
 use crate::postgres::merge::{MergeStyle, do_merge, garbage_collect_index};
 use crate::postgres::rel::PgSearchRelation;
+use crate::postgres::storage::custom_rmgr;
 
 #[pg_guard]
 pub unsafe extern "C-unwind" fn amvacuumcleanup(
@@ -32,5 +33,8 @@ pub unsafe extern "C-unwind" fn amvacuumcleanup(
         garbage_collect_index(&index, next_xid, next_xid);
     }
     do_merge(&index, MergeStyle::Vacuum).expect("should be able to merge");
+    // Names the index to a standby cloned after the build; see
+    // `PgSearchRelation::blocked_after_promotion`.
+    custom_rmgr::emit_init_record(&index);
     stats
 }
```

**File**: `joinscan/src/postgres/customscan/aggregatescan/mod.rs` (modified, +10/-6)
```diff
@@ -120,12 +120,12 @@ use crate::postgres::customscan::{
 use crate::postgres::datetime::PostgresDateTime;
 use crate::postgres::pdb_owned_value::PdbOwnedValue;
 use crate::postgres::pgstat::count_index_scan;
-use crate::postgres::rel_get_bm25_index;
 use crate::postgres::serializable::predicate_lock_read_oid;
 use crate::postgres::types::{TantivyValue, is_datetime_type};
 use crate::postgres::utils::{
     ExprContextGuard, add_vars_to_tlist, is_unnest_func, make_text_const,
 };
+use crate::postgres::{lookup_bm25_index, rel_get_bm25_index};
 use crate::query::SearchQueryInput;
 use arrow_array::cast::AsArray;
 use arrow_array::{BooleanArray, RecordBatch};
@@ -1588,11 +1588,15 @@ impl AggregateScan {
             return Vec::new();
         };
 
-        let Some((_table, index)) = rel_get_bm25_index(heap_relid) else {
-            if has_paradedb_agg {
-                pgrx::error!("Cannot execute pdb.agg: table must have a ParadeDB index");
-            }
-            return Vec::new();
+        let (_table, index) = if has_paradedb_agg {
+            lookup_bm25_index(heap_relid).unwrap_or_report(|| {
+                "Cannot execute pdb.agg: table must have a ParadeDB index".to_string()
+            })
+        } else {
+            let Some(found) = rel_get_bm25_index(heap_relid) else {
+                return Vec::new();
+            };
+            found
         };
 
         // Such a `pdb.agg()` query comes here only when the DataFusion backend
```

**File**: `pg_search/src/postgres/index_only.rs` (modified, +35/-39)
```diff
@@ -20,8 +20,8 @@ use crate::index::fast_fields_helper::{FFHelper, WhichFastField};
 use crate::index::reader::index::SearchIndexReader;
 use crate::postgres::catalog::OidExt;
 use crate::postgres::index::is_partitioned_index;
-use crate::postgres::rel::PgSearchRelation;
-use crate::postgres::utils::{FieldSource, pg_search_extension_installed};
+use crate::postgres::rel::{AmCache, PgSearchRelation, Returnable};
+use crate::postgres::utils::{FieldSource, in_hot_standby, pg_search_extension_installed};
 use crate::schema::SearchIndexSchema;
 use pgrx::{PgList, PgMemoryContexts, PgOid, pg_guard, pg_sys};
 use std::ptr::null_mut;
@@ -40,7 +40,8 @@ pub(crate) fn register_hook() {
             if let Some(previous_hook) = PREV_HOOK {
                 previous_hook(root, rel, rti, rte);
             }
-            if !pg_sys::enable_indexonlyscan || !pg_search_extension_installed() {
+            if !pg_sys::enable_indexonlyscan || in_hot_standby() || !pg_search_extension_installed()
+            {
                 return;
             }
 
@@ -56,7 +57,10 @@ pub(crate) fn register_hook() {
                 }
                 let path = &*path.cast::<pg_sys::IndexPath>();
                 let index = &*path.indexinfo;
-                if index.hypothetical || !index.relam.is_paradedb_am() {
+                if index.hypothetical
+                    || !index.relam.is_paradedb_am()
+                    || PgSearchRelation::open(index.indexoid).blocked_after_promotion()
+                {
                     continue;
                 }
                 let Some(target) = index_only_target(root, path) else {
@@ -279,7 +283,17 @@ pub(super) extern "C-unwind" fn amcanreturn(indexrel: pg_sys::Relation, attno: i
             return false;
         }
 
-        AmCanReturnCache::get_or_init(indexrel.as_ptr()).can_return((attno - 1) as usize)
+        // Planning any query on the table asks every index this question; on a standby the
+        // schema read would refuse and fail the whole statement, and a promoted server must not
+        // offer index-only scans on a tainted index.
+        if in_hot_standby() || indexrel.blocked_after_promotion() {
+            return false;
+        }
+
+        returnable_columns(indexrel.as_ptr())
+            .get((attno - 1) as usize)
+            .copied()
+            .unwrap_or(false)
     }
 }
 
@@ -334,42 +348,24 @@ impl IndexOnlyField {
     }
 }
 
-#[repr(C)]
-struct AmCanReturnCache {
-    returnable: [bool; pg_sys::INDEX_MAX_KEYS as usize],
-}
-
-impl AmCanReturnCache {
-    unsafe fn get_or_init(indexrel: pg_sys::Relation) -> &'static Self {
-        if (*indexrel).rd_amcache.is_null() {
-            let relation = PgSearchRelation::from_pg(indexrel);
-            let mut returnable = [false; pg_sys::INDEX_MAX_KEYS as usize];
-
-            if let Ok(schema) = relation.schema() {
-                let natts = relation.tuple_desc().len();
-                for (tuple_index, can_return) in returnable.iter_mut().enumerate().take(natts) {
-                    *can_return =
-                        IndexOnlyField::from_schema(&relation, &schema, tuple_index).is_some();
-                }
-            }
-
-            // PostgreSQL may call amcanreturn once per index attribute. Keep the capability
-            // array in the relation's AM cache so those probes share one metadata read.
-            let cache = pg_sys::MemoryContextAllocZero(
-                (*indexrel).rd_indexcxt,
-                std::mem::size_of::<Self>(),
-            )
-            .cast::<Self>();
-            (*cache).returnable = returnable;
-            (*indexrel).rd_amcache = cache.cast();
-        }
-
-        &*(*indexrel).rd_amcache.cast::<Self>()
+// PostgreSQL may call amcanreturn once per index attribute. Keep the capability array in the
+// relation's AM cache so those probes share one metadata read.
+unsafe fn returnable_columns(
+    indexrel: pg_sys::Relation,
+) -> [bool; pg_sys::INDEX_MAX_KEYS as usize] {
+    if let Returnable::Known(columns) = (*AmCache::get(indexrel)).returnable {
+        return columns;
     }
-
-    fn can_return(&self, tuple_index: usize) -> bool {
-        self.returnable.get(tuple_index).copied().unwrap_or(false)
+    let relation = PgSearchRelation::from_pg(indexrel);
+    let mut columns = [false; pg_sys::INDEX_MAX_KEYS as usize];
+    if let Ok(schema) = relation.schema() {
+        let natts = relation.tuple_desc().len();
+        for (tuple_index, can_return) in columns.iter_mut().enumerate().take(natts) {
+            *can_return = IndexOnlyField::from_schema(&relation, &schema, tuple_index).is_some();
+        }
     }
+    (*AmCache::get(indexrel)).returnable = Returnable::Known(columns);
+    columns
 }
 
 pub(super) struct IndexOnlyScanState {
```

---

### Incident Patch 3: `52b48727` (2026-11-18)
**Commit Message**: fix: bound Stressgres worker I/O and shutdown (#7547)

## What

Give fault-tolerant Stressgres workers five seconds to drain after
sending native cancellation, then close any remaining in-flight
connections. The shutdown deadline also applies to workers still opening
a connection. Add an opt-in per-operation timeout and set it to 10
seconds in the Antithesis driver. Reconnecting no longer resets the
recovery clock until a workload iteration completes.

Preserve completed SQL and assertion failures, including when another
destination loses its connection. Log a lost COMMIT response as an
unknown outcome. The recurring workload can still repeat writes after
transport loss.

Follow-up to #7546. Related to #6531, which proposes injecting random
cancellation during ordinary workload execution.

## Tests

- Local PostgreSQL proxy accepted cancel requests while withholding the
original response. The previous driver exited 1 after 62.45 seconds and
this build exited 0 after 7.73 seconds.
- The proxy also verified recovery after a stalled query, a lost COMMIT
acknowledgement with the row committed once during shutdown, and a SQL
error delivered during shutdown that still failed the run.
- 2

**File**: `stressgres/src/cli.rs` (modified, +11/-1)
```diff
@@ -26,7 +26,7 @@ use std::time::Duration;
 pub struct ReconnectGraceArgs {
     /// How long (in milliseconds) to tolerate one continuous transient database fault
     /// (dropped/refused sockets, server restarting) by reconnecting before failing the
-    /// run. The window restarts after a successful reconnect. Defaults to 0, i.e. any
+    /// run. A completed workload iteration resets the window. Defaults to 0, i.e. any
     /// error fails the run immediately.
     ///
     /// Under fault injection set this longer than `--runtime`, so a connectivity fault
@@ -45,6 +45,11 @@ pub struct ReconnectGraceArgs {
     /// this from their recovery-liveness command.
     #[arg(long)]
     pub reconnect_grace_file: Option<PathBuf>,
+
+    /// Maximum time in milliseconds to wait for a database operation. On expiry,
+    /// close the connection and apply the reconnect policy. Defaults to no timeout.
+    #[arg(long)]
+    pub operation_timeout: Option<std::num::NonZeroU64>,
 }
 
 impl ReconnectGraceArgs {
@@ -56,6 +61,11 @@ impl ReconnectGraceArgs {
             None => GraceWindow::fixed(baseline),
         }
     }
+
+    pub fn operation_timeout(&self) -> Option<Duration> {
+        self.operation_timeout
+            .map(|ms| Duration::from_millis(ms.get()))
+    }
 }
 
 /// Stress testing for ParadeDB/PostgreSQL
```

**File**: `stressgres/src/fault_tolerance.rs` (modified, +27/-69)
```diff
@@ -155,11 +155,10 @@ fn message_looks_transient(msg: &str) -> bool {
 /// keys off the transport-vs-server distinction rather than string-matching each new
 /// libpq/driver phrasing (e.g. "error performing TLS handshake", which has no
 /// SQLSTATE and no `is_closed()` signal, so needle matching alone would miss it).
-fn is_transient_connection_error(e: &postgres::Error) -> bool {
+pub(crate) fn is_transient_connection_error(e: &postgres::Error) -> bool {
     match e.as_db_error() {
         Some(db) => dst::is_connection_lost_sqlstate(db.code().code()),
-        // Client-side/transport failure: no answer from the server, so it never got
-        // far enough to be a logical bug. Treat it as transient.
+        // The client did not receive a SQLSTATE. The operation's outcome can be unknown.
         None => true,
     }
 }
@@ -192,46 +191,32 @@ fn interruptible_sleep(alive: &AtomicBool, dur: Duration) {
     }
 }
 
-#[derive(Default)]
-pub(crate) struct TransientProgress {
-    recovered: bool,
-}
-
-impl TransientProgress {
-    /// Mark that this retry attempt reached the database. If the attempt later
-    /// fails with another transient error, it starts a fresh grace window.
-    pub(crate) fn mark_recovered(&mut self) {
-        self.recovered = true;
-    }
-}
-
 /// Runs `op`, tolerating transient connectivity faults for as long as `grace` allows:
 /// while `op` keeps failing with a transient error (a dropped/refused socket, server
 /// restarting, etc.) it is retried with capped backoff. A real (non-transient) error is
 /// returned immediately. The fault is only surfaced once the connection has stayed
 /// broken for the whole grace window continuously.
 ///
 /// The window is re-read on every failed attempt, and the clock restarts whenever it
-/// changes or `op` calls [`TransientProgress::mark_recovered`]. That reset is what lets
+/// changes. A completed operation ends the retry loop. The reset lets
 /// an external poke narrow the window mid-fault: it asks "can you reconnect within N
 /// seconds of now", not "were you already down N seconds ago".
 ///
-/// Reopening a dead connection is the caller's job inside `op`; re-running the whole
-/// `op` is what keeps this safe for transactional work — a lost transaction is replayed.
+/// The caller reopens dead connections. A lost response can leave the outcome of
+/// a write unknown, so another workload iteration can repeat work that committed.
 ///
 /// Returns `Ok(None)` if `alive` went false while we were waiting out a fault.
 pub(crate) fn tolerate_transient<T>(
     alive: &AtomicBool,
     grace: &GraceWindow,
-    mut op: impl FnMut(&mut TransientProgress) -> Result<T>,
+    mut op: impl FnMut() -> Result<T>,
 ) -> Result<Option<T>> {
     let mut backoff = INITIAL_RECONNECT_BACKOFF;
     let mut down_since: Option<Instant> = None;
     let mut last_grace: Option<Duration> = None;
     let mut rode_out_fault = false;
     loop {
-        let mut progress = TransientProgress::default();
-        match op(&mut progress) {
+        match op() {
             Ok(value) => {
                 dst::assert_reachable!("stressgres: completed a database operation");
                 if rode_out_fault {
@@ -267,7 +252,7 @@ pub(crate) fn tolerate_transient<T>(
                 // supervisor restoring the baseline, which happens deep in the healed quiet
                 // period with no active fault to observe it. That path is pinned by the
                 // `widening_the_window_also_restarts_the_clock` test instead.
-                if progress.recovered || last_grace.is_some_and(|last| last != grace) {
+                if last_grace.is_some_and(|last| last != grace) {
                     down_since = None;
                     backoff = INITIAL_RECONNECT_BACKOFF;
                 }
@@ -286,6 +271,9 @@ pub(crate) fn tolerate_transient<T>(
                 rode_out_fault = true;
                 eprintln!("stressgres: transient database fault, retrying: {e:#}");
                 interruptible_sleep(alive, backoff);
+                if !alive.load(Ordering::Relaxed) {
+                    return Ok(None);
+                }
                 backoff = (backoff * 2).min(MAX_RECONNECT_BACKOFF);
             }
         }
@@ -299,7 +287,7 @@ mod tests {
     use std::io;
 
     #[test]
-    fn message_matching_flags_connectivity_faults() {
+    fn string_errors_are_classified() {
         for msg in [
             "error connecting to server: Network is unreachable (os error 101)",
             "server closed the connection unexpectedly",
@@ -310,68 +298,38 @@ mod tests {
             // marks this as connectivity noise (server down/restarting mid-handshake).
             "error performing TLS handshake: unexpected EOF",
         ] {
-            assert!(message_looks_transient(msg), "should be transient: {msg}");
+            assert!(
+                is_transient_error(&anyhow!("{msg}")),
+                "should be transient: {msg}"
+            )
```

**File**: `stressgres/src/headless.rs` (modified, +1/-3)
```diff
@@ -170,9 +170,7 @@ pub fn run(
         let finished = finished.clone();
         let suite_runner = suite_runner.clone();
         std::thread::spawn(move || {
-            let errors = suite_runner
-                .wait_for_finish()
-                .expect("wait_for_finish() should not fail");
+            let errors = suite_runner.wait_for_finish();
 
             let mut reported_errors = 0;
             for error in errors {
```

**File**: `stressgres/src/main.rs` (modified, +15/-3)
```diff
@@ -64,8 +64,13 @@ fn main() -> anyhow::Result<()> {
         // When using the "ui" subcommand.
         Command::Ui(args) => {
             let suite = load_suite(&args.suite_path, args.pgversion, None)?;
-            let suite_runner =
-                SuiteRunner::new(suite, args.paused, args.grace.window(), SetupMode::Full)?;
+            let suite_runner = SuiteRunner::new(
+                suite,
+                args.paused,
+                args.grace.window(),
+                args.grace.operation_timeout(),
+                SetupMode::Full,
+            )?;
             tui::run(suite_runner)?;
         }
 
@@ -79,7 +84,13 @@ fn main() -> anyhow::Result<()> {
             } else {
                 SetupMode::Full
             };
-            let suite_runner = SuiteRunner::new(suite, false, args.grace.window(), setup_mode)?;
+            let suite_runner = SuiteRunner::new(
+                suite,
+                false,
+                args.grace.window(),
+                args.grace.operation_timeout(),
+                setup_mode,
+            )?;
             // `--setup-only` has built the schema and is done; the workload runs later in a
             // separate `--skip-setup` process.
             if setup_mode == SetupMode::SetupOnly {
@@ -111,6 +122,7 @@ fn main() -> anyhow::Result<()> {
                 suite,
                 false,
                 GraceWindow::fixed(Duration::ZERO),
+                None,
                 SetupMode::Full,
             )?;
             headless::run(
```

**File**: `stressgres/src/runner.rs` (modified, +229/-133)
```diff
@@ -15,7 +15,7 @@
 // You should have received a copy of the GNU Affero General Public License
 // along with this program. If not, see <http://www.gnu.org/licenses/>.
 
-use crate::fault_tolerance::{GraceWindow, tolerate_transient};
+use crate::fault_tolerance::{GraceWindow, is_transient_connection_error, tolerate_transient};
 use crate::sqlscanner::StatementDestination;
 use crate::suite::{Job, Server, ServerStyle, Suite};
 use anyhow::{Result, anyhow};
@@ -35,6 +35,8 @@ use sysinfo::{Pid, ProcessesToUpdate, System};
 use tokio::runtime::{Builder, Runtime};
 use tokio::task::AbortHandle;
 
+const CANCELLATION_TIMEOUT: Duration = Duration::from_secs(5);
+
 type PostgresResult<T> = std::result::Result<T, Arc<postgres::Error>>;
 
 pub type BackendPid = i32;
@@ -149,7 +151,7 @@ pub struct MultiTransaction<'a> {
     server_lookup: Arc<HashMap<String, Server>>,
     transactions: Vec<(
         tokio_postgres::Transaction<'a>,
-        &'a Runtime,
+        &'a ConnectionIo,
         &'a Server,
         BackendPid,
     )>,
@@ -189,27 +191,30 @@ impl Conn {
             .collect::<Vec<_>>()
     }
 
-    pub fn open(suite: &Suite, job: &Job) -> Result<Self> {
+    fn open(suite: &Suite, job: &Job, policy: &IoPolicy) -> Result<Self> {
         let clients = job
             .destinations()
             .iter()
             .map(|destination| match destination {
                 StatementDestination::DefaultServer => {
                     let server = suite.default_server();
-                    Ok(vec![(Conn::_open_conn(server, job)?, server.clone())])
+                    Ok(vec![(
+                        Conn::open_client(server, job, policy)?,
+                        server.clone(),
+                    )])
                 }
                 StatementDestination::SpecificServers(server_names) => server_names
                     .iter()
                     .map(|name| {
                         let server = suite
                             .server(name)
                             .ok_or_else(|| anyhow!("No such server named `{name}`"))?;
-                        Ok((Conn::_open_conn(server, job)?, server.clone()))
+                        Ok((Conn::open_client(server, job, policy)?, server.clone()))
                     })
                     .collect::<Result<Vec<_>>>(),
                 StatementDestination::AllServers => suite
                     .all_servers()
-                    .map(|server| Ok((Conn::_open_conn(server, job)?, server.clone())))
+                    .map(|server| Ok((Conn::open_client(server, job, policy)?, server.clone())))
                     .collect::<Result<Vec<_>>>(),
             })
             .collect::<Result<Vec<_>>>()?
@@ -239,19 +244,17 @@ impl Conn {
             transactions: Vec::with_capacity(self.clients.len()),
         };
         for (client, server, pid) in &mut self.clients {
-            let xact = client.runtime.block_on(client.client.transaction())?;
+            let xact = client.io.run(client.client.transaction())?;
             transaction
                 .transactions
-                .push((xact, &client.runtime, server, *pid));
+                .push((xact, &client.io, server, *pid));
         }
         Ok(transaction)
     }
 
     fn rollback_best_effort(&mut self) {
         for (client, ..) in &mut self.clients {
-            let _ = client
-                .runtime
-                .block_on(client.client.batch_execute("ROLLBACK"));
+            let _ = client.io.run(client.client.batch_execute("ROLLBACK"));
         }
     }
 
@@ -266,8 +269,8 @@ impl Conn {
         for (id, (client, server, pid)) in self.clients.iter_mut().enumerate() {
             let start = Instant::now();
             let result = client
-                .runtime
-                .block_on(client.client.query(&query, params))
+                .io
+                .run(client.client.query(&query, params))
                 .map_err(Arc::new);
             let duration = start.elapsed();
             results.push((result, duration, ConnInfo::new(id, server, *pid)));
@@ -286,17 +289,21 @@ impl Conn {
 
     #[doc(hidden)]
     pub(crate) fn _open_conn(server: &Server, job: &Job) -> Result<WorkerClient> {
+        Self::open_client(server, job, &IoPolicy::default())
+    }
+
+    fn open_client(server: &Server, job: &Job, policy: &IoPolicy) -> Result<WorkerClient> {
         let sanitized = job.title().replace(|c: char| !c.is_alphanumeric(), "_");
         let connstr = match server.style {
             // For ServerStyle::With, the connection string is expected to already
             // include the application_name if needed, so it is not appended here.
             ServerStyle::With { .. } => server.connstr(),
             _ => format!("{} application_name={}", server.connstr(), sanitized),
         };
-        let conn = WorkerClient::connect(&connstr)?;
+        let conn = WorkerClient::connect(&connstr, policy)?;
 
         for query in job.on_connect() {
- 
```

**File**: `stressgres/src/runner/shutdown_test.rs` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
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
+use super::{Conn, IoPolicy, WorkerClient};
+use std::io::{Read, Write};
+use std::net::{TcpListener, TcpStream};
+use std::sync::mpsc;
+use std::time::{Duration, Instant};
+
+const TEST_TIMEOUT: Duration = Duration::from_secs(10);
+
+fn read_packet(stream: &mut TcpStream) -> Vec<u8> {
+    stream.set_read_timeout(Some(TEST_TIMEOUT)).unwrap();
+    let mut length = [0; 4];
+    stream.read_exact(&mut length).unwrap();
+    let mut body = vec![0; u32::from_be_bytes(length) as usize - length.len()];
+    stream.read_exact(&mut body).unwrap();
+    body
+}
+
+#[test]
+fn shutdown_closes_query_socket_after_cancel_request_is_sent() {
+    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
+    let addr = listener.local_addr().unwrap();
+    let (query_seen, wait_for_query) = mpsc::channel();
+    let (cancel_seen, wait_for_cancel) = mpsc::channel();
+    let proxy = std::thread::spawn(move || {
+        let (mut query, _) = listener.accept().unwrap();
+        assert!(read_packet(&mut query).starts_with(&[0, 3, 0, 0]));
+        // AuthenticationOk, BackendKeyData (PID 42, key 99), ReadyForQuery.
+        query
+            .write_all(b"R\0\0\0\x08\0\0\0\0K\0\0\0\x0c\0\0\0\x2a\0\0\0\x63Z\0\0\0\x05I")
+            .unwrap();
+        let mut tag = [0];
+        query.read_exact(&mut tag).unwrap();
+        assert_eq!(tag, *b"Q");
+        assert_eq!(read_packet(&mut query), b"SELECT 1\0");
+        query_seen.send(()).unwrap();
+
+        // Read the complete cancellation request but keep the query socket open
+        // without sending a response, as a proxy can during a partition.
+        let (mut cancel, _) = listener.accept().unwrap();
+        assert_eq!(
+            read_packet(&mut cancel),
+            [0x04, 0xd2, 0x16, 0x2e, 0, 0, 0, 42, 0, 0, 0, 99]
+        );
+        drop(cancel);
+        cancel_seen.send(()).unwrap();
+        assert_eq!(
+            query.read(&mut tag).unwrap(),
+            0,
+            "client must close the socket"
+        );
+    });
+
+    let policy = IoPolicy {
+        interrupt_shutdown: true,
+        ..IoPolicy::default()
+    };
+    let client = WorkerClient::connect(
+        &format!(
+            "host=127.0.0.1 port={} user=test sslmode=disable",
+            addr.port()
+        ),
+        &policy,
+    )
+    .unwrap();
+    let token = client.client.cancel_token();
+    let (query_finished, wait_for_result) = mpsc::channel();
+    let worker = std::thread::spawn(move || {
+        let error = client
+            .io
+            .run(client.client.batch_execute("SELECT 1"))
+            .unwrap_err();
+        assert!(error.is_closed(), "{error}");
+        query_finished.send(()).unwrap();
+    });
+
+    wait_for_query.recv_timeout(TEST_TIMEOUT).unwrap();
+    let runtime = tokio::runtime::Builder::new_current_thread()
+        .enable_all()
+        .build()
+        .unwrap();
+    runtime.block_on(async {
+        tokio::time::timeout(TEST_TIMEOUT, token.cancel_query(Conn::tls_connector()))
+            .await
+            .unwrap()
+            .unwrap();
+    });
+    wait_for_cancel.recv_timeout(TEST_TIMEOUT).unwrap();
+    assert!(matches!(
+        wait_for_result.try_recv(),
+        Err(mpsc::TryRecvError::Empty)
+    ));
+
+    *policy.shutdown.write() = Some(Instant::now());
+    wait_for_result.recv_timeout(TEST_TIMEOUT).unwrap();
+    worker.join().unwrap();
+    proxy.join().unwrap();
+}
```

**File**: `stressgres/suites/antithesis/anytime_recovery_liveness.sh` (modified, +4/-1)
```diff
@@ -24,6 +24,9 @@ LOCK_FILE=/tmp/stressgres-recovery-liveness.lock
 # the liveness check itself becomes the flake.
 QUIET_SECONDS=90
 RECOVER_SECONDS=50
+# Keep the shorter grace in force while a worker notices the poke, finishes a
+# bounded I/O attempt, and reports expiry. The driver polls on retry boundaries.
+OBSERVE_SECONDS=30
 
 # Antithesis schedules anytime commands aggressively, and a quiet period suppresses
 # exactly the faults this test exists to inject. Fire on a small fraction of
@@ -67,7 +70,7 @@ echo "Recovery liveness: pausing faults for ${QUIET_SECONDS}s; Stressgres must r
 "${ANTITHESIS_STOP_FAULTS}" "${QUIET_SECONDS}"
 
 poke "$((RECOVER_SECONDS * 1000))"
-sleep "${RECOVER_SECONDS}"
+sleep "$((RECOVER_SECONDS + OBSERVE_SECONDS))"
 restore
 
 echo "Recovery liveness: Stressgres survived the quiet period"
```

**File**: `stressgres/suites/antithesis/singleton_driver_stressgres.sh` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ source "$(dirname "$(readlink -f "$0")")/helper_suite_setup.sh"
 # the run; the liveness assertions judge recovery.
 echo ""
 echo "Running Stressgres workload from ${WORKLOAD_LINK}..."
-"${STRESSGRES}" headless "${WORKLOAD_LINK}" --skip-setup --runtime 100000 --log-interval-ms 10000 --reconnect-grace 200000 --reconnect-grace-file /tmp/stressgres-reconnect-grace
+"${STRESSGRES}" headless "${WORKLOAD_LINK}" --skip-setup --runtime 100000 --log-interval-ms 10000 --operation-timeout 10000 --reconnect-grace 200000 --reconnect-grace-file /tmp/stressgres-reconnect-grace
 
 echo ""
 echo "Stressgres workload complete!"
```

#### Recent Merged Pull Requests:
- **PR #7572** (2026-11-19): fix: Restore Postgres.app publishing (@paradedb-github-bot[bot])
- **PR #7571** (2026-11-19): fix: Restore Postgres.app publishing (@paradedb-github-bot[bot])
- **PR #7570** (2026-11-19): fix: Restore Postgres.app publishing (@philippemnoel)
- **PR #7569** (2026-11-19): chore: Upgrade Cosign for ParadeDB Docker releases (@paradedb-github-bot[bot])
- **PR #7568** (2026-11-19): chore: Generate Dockerfiles for v0.27.0 (@paradedb-github-bot[bot])
- **PR #7567** (2026-11-19): chore: Generate Dockerfiles for v0.27.0 (@paradedb-github-bot[bot])

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

## X. retry background merges without blocking the sweep or VACUUM

**RULE**:
When implementing operations in `index_write/src/postgres/merge.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in paradedb/paradedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `534617a6`: retry background merges without blocking the sweep or VACUUM. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `index_write/src/postgres/merge.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Only schedule a background merge; skip busy indexes.
    Background,
/// Returns true only for an empty background selection with no temporary exclusions.
pub unsafe fn do_merge(index: &PgSearchRelation, style: MergeStyle) -> anyhow::Result<bool> {
        return Ok(false);
    if matches!(style, MergeStyle::Background)
        && index.options().background_layer_sizes().is_empty()
    {
        return Ok(false);
    }
    let (merge_pins, merge_lock) = if matches!(style, MergeStyle::Background) {
        if VacuumSignal::new(index.oid()).wants_cancel() {
            return Ok(false);
        }
        let Some(locks) = metadata.try_pin_and_lock_merge() else {
            return Ok(false);
        };
        locks
    } else {
        (metadata.pin_merge(), metadata.acquire_merge_lock())
    };
    let no_candidates = matches!(style, MergeStyle::Background)
        && candidates.is_empty()
        && merge_lock.merge_list().list_segment_ids().next().is_none()
        && metadata.vacuum_list().read_list().is_empty();
        return Ok(false);
    Ok(no_candidates)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    /// VACUUM finished; only a background merge may follow.
    Vacuum,
pub unsafe fn do_merge(index: &PgSearchRelation, style: MergeStyle) -> anyhow::Result<()> {
        return Ok(());
    let merge_pins = metadata.pin_merge();
    let merge_lock = metadata.acquire_merge_lock();
        return Ok(());
    Ok(())
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `534617a6` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
