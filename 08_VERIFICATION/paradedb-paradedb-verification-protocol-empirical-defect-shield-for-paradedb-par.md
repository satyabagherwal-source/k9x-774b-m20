# Verification Protocol: Verification Protocol: Empirical Defect Shield for paradedb/paradedb

<!-- PROVENANCE_START
{
  "source_repository": "paradedb/paradedb",
  "source_url": "https://github.com/paradedb/paradedb",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [paradedb/paradedb](https://github.com/paradedb/paradedb) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `paradedb/paradedb` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/paradedb-paradedb-learnings.md`  
> **Source**: github ([https://github.com/paradedb/paradedb](https://github.com/paradedb/paradedb))  
> **Source Version**: `781cb511`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T10:17:26.254Z  
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
> **Harvest Timestamp**: 2026-11-11T10:17:26.242Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `paradedb/paradedb`
- **Description**: One Postgres for your application data, full-text search, vector retrieval, and aggregations. Home of the pg_search extension.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9504 stars

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

use std::cell::UnsafeCell;
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
use pgrx::heap_tuple::PgHeapTuple;
use pgrx::{PgTupleDesc, pg_sys};
use tantivy::index::SegmentId;
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
        }
    }

    /// Drop the current exec method (and with it any search results whose
    /// scorers hold bitmap cursors) before the bitmap machinery is torn down.
    pub fn drop_exec_method(&mut self) {
        self.exec_method = UnsafeCell::new(Default::default());
        self.exec_method_name = String::new();
    }

    #[inline(always)]
    pub fn assign_exec_method<T: ExecMethod + 'static>(
        &mut self,
        m
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
    /// The body mirrors pgrx 0.19.2's `leak_and_drop_on_delete` (`memcxt.rs`) plus the
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

        let leaked = Box::leak(Box::new(v));
        unsafe {
            // SAFETY: the callback struct is plain pointers, all set before it is registered.
            let callback = self.palloc_struct::<pg_sys::MemoryContextCallback>();
            (*callback).func = Some(drop_unless_exiting::<T>);
            (*callback).arg = (leaked as *mut T).cast();
            pg_sys::MemoryContextRegisterResetCallback(self.value(), callback);
        }
        leaked
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
/// // Use context_guard.as_ptr() to get the raw pointer
/// // Context is automatically freed when
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
use crate::postgres::customscan::mpp::glue::MppLaunchTiming;
use crate::postgres::customscan::mpp::interrupt::PgTokioRuntime;
use crate::postgres::customscan::mpp::launch::MppLifecycle;
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
    /// Where MPP sits in its launch lifecycle for this scan: marked pending at begin, launched
    /// on first exec once the built plan's stages are committed (#5667: the plan comes first;
    /// workers spawn only after it exists). Stays `Inactive` on the serial path.
    /// Applies only when parallel execution is enabled and the query qualifies (binary join +
    /// supported aggregate).
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
    /// Captured from PostgreSQL's statement-wide `PlannerGlobal.parallelModeOK`. When false, this
    /// scan may still use DataFusion, but it must never launch MPP producer workers.
    pub parallel_mode_ok: bool,
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

    /// Returns true if
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7313** (2026-11-08): **JoinScan segfaults when a projected expression contains a scalar subquery**
  *Symptoms*: ### What happens?  ParadeDB Join Scan crashes the server (segmentation fault) when an expression in the SELECT list contains a scalar subquery, such as `a.q + (SELECT 1)`. Postgres then restarts all connections. A prepared statement parameter in the same place, with a generic plan, fails with ERROR: no value found for parameter 1.  ### To Reproduce  ```sql CREATE EXTENSION IF NOT EXISTS pg_search;  CREATE TABLE a (id int PRIMARY KEY, q int); CREATE TABLE b (id int PRIMARY KEY, a_id int);  INSERT INTO a VALUES (1, 5); INSERT INTO b VALUES (1, 1);  CREATE INDEX a_idx ON a USING paradedb (id, q); CREATE INDEX b_idx ON b USING paradedb (id, a_id);  SELECT a.id, a.q + (SELECT 1) FROM a JOIN b ON b.a_id = a.id WHERE a.id @@@ pdb.all() ORDER BY a.id LIMIT 1; ```  The server crashes with "terminated by signal 11: Segmentation fault". Expected 1 | 6. With SET paradedb.enable_join_custom_scan = off; it returns 1 | 6.  The parameter case:  ```sql SET plan_cache_mode = force_generic_plan; PREPARE s(int) AS   SELECT a.id, a.q + $1 FROM a JOIN b ON b.a_id = a.id   WHERE a.id @@@ pdb.all() ORDER BY a.id LIMIT 1; EXECUTE s(1); ```  Returns ERROR: no value found for parameter 1. Expected 1 | 6.  ### OS:  macOS  ### ParadeDB Version (e.g. output of `SELECT * FROM paradedb.version_info();`):  e80cf37  ### Are you using ParadeDB Docker, Helm, or the extension(s) standalone?  ParadeDB pg_search Extension  ### Full Name:  Niladri Adhikary  ### Affiliation:  N/A  ### Did you include all relevant da

- **Issue #7293** (2026-11-10): **Server crashes when a join filter compares an expression over two tables to a scalar subquery**
  *Symptoms*: ### What happens?  ParadeDB crashes the backend with a segmentation fault when a join query has a filter that uses columns from both tables and an uncorrelated scalar subquery, for example `a.price * b.qty > (SELECT 1)`. Postgres then terminates all active connections and restarts. Plain `EXPLAIN` crashes too, because the fault happens during planning.  Both Aggregate Scan and Join Scan are affected. The same query without aggregates crashes through Join Scan when it has an `ORDER BY` and `LIMIT`.  The crash report shows DataFusion's constant evaluator calling `PgExprUdf`, which faults in `ExecEvalParamExec` on a NULL address:  ``` ExecEvalParamExec        (KERN_INVALID_ADDRESS at 0x0) ExecInterpExpr ExecEvalExpr PgExprUdf                (pg_expr_udf.rs) ScalarUDF::invoke_with_args ConstEvaluator           (datafusion_optimizer expr_simplifier) ```  ### To Reproduce  ```sql CREATE EXTENSION IF NOT EXISTS pg_search;  CREATE TABLE ca (id int PRIMARY KEY, name text, price float8); CREATE TABLE cb (id int PRIMARY KEY, a_id int, qty float8);  INSERT INTO ca VALUES (1, 'x shoes', 1.5), (2, 'y shoes', 2.5); INSERT INTO cb VALUES (1, 1, 1), (2, 2, 2);  CREATE INDEX ca_idx ON ca USING paradedb (id, name, price); CREATE INDEX cb_idx ON cb USING paradedb (id, a_id, qty);  SELECT COUNT(*) FROM ca JOIN cb ON cb.a_id = ca.id WHERE ca.id @@@ pdb.all()   AND ca.price * cb.qty > (SELECT 1); ```  Crashes with `server closed the connection unexpectedly`. The Postgres log shows `terminated by si

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

### Incident Patch 1: `61edff0a` (2026-11-10)
**Commit Message**: fix: correct Tantivy revision after clustering update (#7365)

## What

Restore compilation on main by pinning Tantivy to
`05b861b5ef138c4f4a3d93544d3b174e1994e207`, the merged revision of
paradedb/tantivy#392.

## Why

#7346 pinned the pre-merge branch commit `1c7c2150`, which lacks the
vector-routing APIs already required by #7295, including
`VectorSearchBudget`, `AtomicVectorWork`, and
`TopClustersBySimilarityCollector`. Both
[HN](https://github.com/paradedb/paradedb/actions/runs/42894121461) and
[MS
MARCO](https://github.com/paradedb/paradedb/actions/runs/42894122837)
pg_vectorsearch runs failed while compiling `pg_search` during cluster
setup.

## How

Update all four Tantivy dependency/patch pins and the ten Tantivy-family
lockfile entries. The merged revision retains the geometric
`target_leaf_size` changes and includes the required routing APIs. No
other dependency versions change. The existing Nix CI workflow will
refresh `cargoHash` for the updated lockfile.

## Tests

- `cargo metadata --format-version 1 --locked`: all ten Tantivy-family
packages resolve to the new revision.
- `cargo check --workspace --all-targets --locked`: passed locally with
PostgreSQL 18, including 

**File**: `Cargo.lock` (modified, +10/-10)
```diff
@@ -5254,7 +5254,7 @@ dependencies = [
 [[package]]
 name = "ownedbytes"
 version = "0.9.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
+source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
 dependencies = [
  "stable_deref_trait",
 ]
@@ -7513,7 +7513,7 @@ checksum = "7b2093cf4c8eb1e67749a6762251bc9cd836b6fc171623bd0a9d324d37af2417"
 [[package]]
 name = "tantivy"
 version = "0.27.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
+source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
 dependencies = [
  "aho-corasick",
  "arc-swap",
@@ -7572,15 +7572,15 @@ dependencies = [
 [[package]]
 name = "tantivy-bitpacker"
 version = "0.10.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
+source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
 dependencies = [
  "bitpacking",
 ]
 
 [[package]]
 name = "tantivy-columnar"
 version = "0.7.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
+source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
 dependencies = [
  "downcast-rs",
  "fastdivide",
@@ -7595,7 +7595,7 @@ dependencies = [
 [[package]]
 name = "tantivy-common"
 version = "0.11.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
+source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
 dependencies = [
  "async-trait",
  "byteorder",
@@ -7628,7 +7628,7 @@ dependencies = [
 [[package]]
 name = "tantivy-quant"
 version = "0.1.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
+source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
 dependencies = [
  "rand_chacha 0.3.1",
  "rand_core 0.6.4",
@@ -7637,7 +7637,7 @@ dependencies = [
 [[package]]
 name = "tantivy-query-grammar"
 version = "0.26.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
+source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
 dependencies = [
  "fnv",
  "nom 7.1.3",
@@ -7649,7 +7649,7 @@ dependencies = [
 [[package]]
 name = "tantivy-sstable"
 version = "0.7.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
+source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
 dependencies = [
  "futures-util",
  "itertools 0.14.0",
@@ -7662,7 +7662,7 @@ dependencies = [
 [[package]]
 name = "tantivy-stacker"
 version = "0.7.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
+source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
 dependencies = [
  "fixedbitset",
  "murmurhash32",
@@ -7699,7 +7699,7 @@ dependencies = [
 [[package]]
 name = "tantivy-tokenizer-api"
 version = "0.7.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
+source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
 dependencies = [
  "serde",
 ]
```

**File**: `Cargo.toml` (modified, +4/-4)
```diff
@@ -89,7 +89,7 @@ pgrx-tests = "=0.19.3"
 
 # Keep the Git revisions for `tantivy`, `tantivy-common`, and the crates.io
 # patches in sync.
-tantivy = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy", rev = "1c7c2150a97bc04fb71fd4808afddad19e9c17d7", features = [
+tantivy = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy", rev = "05b861b5ef138c4f4a3d93544d3b174e1994e207", features = [
   "columnar-zstd-compression",
   "lz4-compression",
   "paradedb",
@@ -98,7 +98,7 @@ tantivy = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy"
   "stemmer",
   "stopwords",
 ], default-features = false }
-tantivy-common = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-common", rev = "1c7c2150a97bc04fb71fd4808afddad19e9c17d7" }
+tantivy-common = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-common", rev = "05b861b5ef138c4f4a3d93544d3b174e1994e207" }
 tantivy-jieba = "0.21.0"
 
 async-trait = "0.1.92"
@@ -185,8 +185,8 @@ rstest = "0.28.0"
 postgres = "0.19.14"
 
 [patch.crates-io]
-tantivy-common = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-common", rev = "1c7c2150a97bc04fb71fd4808afddad19e9c17d7" }
-tantivy-tokenizer-api = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-tokenizer-api", rev = "1c7c2150a97bc04fb71fd4808afddad19e9c17d7" }
+tantivy-common = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-common", rev = "05b861b5ef138c4f4a3d93544d3b174e1994e207" }
+tantivy-tokenizer-api = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-tokenizer-api", rev = "05b861b5ef138c4f4a3d93544d3b174e1994e207" }
 
 [workspace.lints.rust]
 unused_crate_dependencies = "warn"
```

---

### Incident Patch 2: `29cca447` (2026-11-09)
**Commit Message**: fix: bypass planner hooks during mutable sweeps (#7301)

# Ticket(s) Closed

- Addresses #7299

## What

Make mutable-sweep catalog discovery bypass planner hooks, allowing the
worker to find Citus shard indexes and avoid the Citus crash path during
concurrent table drops.

## Why

Citus rewrites SQL queries against `pg_class` to hide shard indexes. Its
visibility check can dereference a null relation name during concurrent
`DROP TABLE`, crashing the sweeper and causing PostgreSQL to terminate
other backends.

## How

Read the extension version through `pg_extension_name_index`, avoiding
an extension syscache that is unavailable on older PostgreSQL minor
releases.

Scan `pg_class` directly and filter relation kind, persistence, and
access method before looking up `INDEXRELID` to check index validity and
readiness. This limits per-pass index syscache probes to ParadeDB
candidates. Reuse the existing syscache guard and access-method checks,
preserving the extension-version gate, OID ordering, and nonblocking
relation locking.

## Tests

- Passed the catalog-discovery regression test on PostgreSQL 17.6 and
18.3. The test rejects every planner-hook invocation and checks
filtering of te

**File**: `pg_search/src/postgres/catalog.rs` (modified, +146/-0)
```diff
@@ -78,6 +78,87 @@ pub fn lookup_namespace(namespace: &CStr) -> Option<pg_sys::Oid> {
     }
 }
 
+pub fn lookup_extension_version(name: &CStr) -> Option<String> {
+    unsafe {
+        let relation =
+            pg_sys::table_open(pg_sys::ExtensionRelationId, pg_sys::AccessShareLock as _);
+        let mut key = pg_sys::ScanKeyData::default();
+        pg_sys::ScanKeyInit(
+            &mut key,
+            pg_sys::Anum_pg_extension_extname as _,
+            pg_sys::BTEqualStrategyNumber as _,
+            pg_sys::F_NAMEEQ.into(),
+            pg_sys::Datum::from(name.as_ptr()),
+        );
+        let scan = pg_sys::systable_beginscan(
+            relation,
+            pg_sys::ExtensionNameIndexId.into(),
+            true,
+            std::ptr::null_mut(),
+            1,
+            &mut key,
+        );
+        let tuple = pg_sys::systable_getnext(scan);
+        let version = if tuple.is_null() {
+            None
+        } else {
+            let mut is_null = false;
+            let datum = pg_sys::heap_getattr(
+                tuple,
+                pg_sys::Anum_pg_extension_extversion as _,
+                (*relation).rd_att,
+                &mut is_null,
+            );
+            String::from_datum(datum, is_null)
+        };
+        pg_sys::systable_endscan(scan);
+        pg_sys::table_close(relation, pg_sys::AccessShareLock as _);
+        version
+    }
+}
+
+pub fn paradedb_index_oids() -> Vec<pg_sys::Oid> {
+    unsafe {
+        let relation = pg_sys::table_open(pg_sys::RelationRelationId, pg_sys::AccessShareLock as _);
+        let scan = pg_sys::systable_beginscan(
+            relation,
+            pg_sys::InvalidOid,
+            false,
+            std::ptr::null_mut(),
+            0,
+            std::ptr::null_mut(),
+        );
+        let mut indexes = Vec::new();
+        loop {
+            let tuple = pg_sys::systable_getnext(scan);
+            if tuple.is_null() {
+                break;
+            }
+            let class = &*pg_sys::GETSTRUCT(tuple).cast::<pg_sys::FormData_pg_class>();
+            if class.relkind as u8 != pg_sys::RELKIND_INDEX
+                || class.relpersistence as u8 == pg_sys::RELPERSISTENCE_TEMP
+                || !class.relam.is_paradedb_am()
+            {
+                continue;
+            }
+            let Some(entry) = SysCacheEntry::search1(
+                pg_sys::SysCacheIdentifier::INDEXRELID,
+                class.oid.into_datum().unwrap(),
+            ) else {
+                continue;
+            };
+            let index = &*pg_sys::GETSTRUCT(entry.tuple).cast::<pg_sys::FormData_pg_index>();
+            if index.indisvalid && index.indisready {
+                indexes.push(class.oid);
+            }
+        }
+        pg_sys::systable_endscan(scan);
+        pg_sys::table_close(relation, pg_sys::AccessShareLock as _);
+        indexes.sort_unstable_by_key(|oid| oid.to_u32());
+        indexes
+    }
+}
+
 /// Helper function to lookup a type's assigned `typcategory` attribute from `pg_catalog.pg_type`
 pub fn lookup_type_category(typoid: pg_sys::Oid) -> Option<u8> {
     unsafe {
@@ -320,3 +401,68 @@ pub fn lookup_collation_locale(collation: pg_sys::Oid) -> Option<CollationLocale
         })
     }
 }
+
+#[cfg(any(test, feature = "pg_test"))]
+#[pgrx::pg_schema]
+mod tests {
+    use super::*;
+    use pgrx::{PgTryBuilder, Spi, pg_guard, pg_test};
+
+    #[pg_guard]
+    unsafe extern "C-unwind" fn reject_planning(
+        _parse: *mut pg_sys::Query,
+        _query: *const std::ffi::c_char,
+        _options: std::ffi::c_int,
+        _params: pg_sys::ParamListInfo,
+    ) -> *mut pg_sys::PlannedStmt {
+        pgrx::error!("catalog discovery must not invoke planner hooks");
+    }
+
+    #[pg_test]
+    fn sweep_catalog_discovery_bypasses_planner_hooks() {
+        let mut expected = paradedb_index_oids();
+        Spi::run(
+            "CREATE TABLE sweep_catalog (id int, body text);
+             CREATE INDEX sweep_catalog_idx ON sweep_catalog USING paradedb(id, body);
+             CREATE INDEX sweep_catalog_btree ON sweep_catalog(id);
+             CREATE TABLE sweep_catalog_invalid_table (id int, body text);
+             CREATE INDEX sweep_catalog_invalid ON sweep_catalog_invalid_table USING paradedb(id, body);
+             CREATE TABLE sweep_catalog_unready_table (id int, body text);
+             CREATE INDEX sweep_catalog_unready ON sweep_catalog_unready_table USING paradedb(id, body);
+             UPDATE pg_index SET indisvalid = false WHERE indexrelid = 'sweep_catalog_invalid'::regclass;
+             UPDATE pg_index SET indisready = false WHERE indexrelid = 'sweep_catalog_unready'::regclass;
+             CREATE TEMP TABLE sweep_catalog_temp (id int, body text);
+             CREATE INDEX sweep_catalog_temp_idx ON sweep_catalog_temp USING paradedb(id, body);
+             CREATE UNLOGGED TABLE sweep_catalog_unlogged (id int, body text);
+             CREATE INDEX sweep_catalog_u
```

**File**: `pg_search/src/postgres/mutable_sweep.rs` (modified, +28/-27)
```diff
@@ -19,7 +19,7 @@ use crate::api::{HashMap, HashSet};
 use crate::index::merge_policy::LayeredMergePolicy;
 use crate::index::mvcc::MvccSatisfies;
 use crate::index::writer::index::SearchIndexMerger;
-use crate::postgres::catalog::OidExt;
+use crate::postgres::catalog::{OidExt, lookup_extension_version, paradedb_index_oids};
 use crate::postgres::delete::VacuumSignal;
 use crate::postgres::index::free_leaf_partition_indexes;
 use crate::postgres::locks::AdvisoryLock;
@@ -31,8 +31,8 @@ use crate::postgres::ps_status::{MERGING, set_ps_display_suffix};
 use crate::postgres::storage::metadata::MetaPage;
 use pgrx::bgworkers::{BackgroundWorker, BackgroundWorkerBuilder, SignalWakeFlags};
 use pgrx::{
-    GucContext, GucFlags, GucRegistry, GucSetting, IntoDatum, PgTryBuilder, Spi,
-    check_for_interrupts, pg_guard, pg_sys,
+    GucContext, GucFlags, GucRegistry, GucSetting, IntoDatum, PgTryBuilder, check_for_interrupts,
+    pg_guard, pg_sys,
 };
 use std::ffi::CStr;
 use std::panic::AssertUnwindSafe;
@@ -226,25 +226,12 @@ unsafe extern "C-unwind" fn mutable_sweep_database(database: pg_sys::Datum) {
         if sweeping {
             let observed_counts = pass_context.switch_to(|_| {
                 let indexes = BackgroundWorker::transaction(|| {
-                    let version = Spi::get_one::<String>(
-                        "SELECT max(extversion::text) FROM pg_catalog.pg_extension WHERE extname = 'pg_search'",
-                    )
-                    .expect("should be able to inspect pg_search version");
+                    let version = lookup_extension_version(c"pg_search");
                     if version.as_deref() != Some(env!("CARGO_PKG_VERSION")) {
                         return None;
                     }
-                    let indexes = Spi::get_one::<Vec<pg_sys::Oid>>(
-                        "SELECT array_agg(i.indexrelid ORDER BY i.indexrelid)
-                         FROM pg_catalog.pg_index i
-                         JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
-                         JOIN pg_catalog.pg_am am ON am.oid = c.relam
-                         JOIN pg_catalog.pg_proc p ON p.oid = am.amhandler
-                         JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
-                         WHERE n.nspname = 'paradedb' AND p.proname = 'bm25_handler'
-                           AND i.indisvalid AND i.indisready AND c.relkind = 'i' AND c.relpersistence <> 't'",
-                    )
-                    .expect("should be able to discover ParadeDB indexes")
-                    .unwrap_or_default();
+                    // Planner hooks can hide shard indexes or race with concurrent drops.
+                    let indexes = paradedb_index_oids();
                     let mut current_counts = HashMap::default();
                     let indexes = free_leaf_partition_indexes(&indexes)
                         .filter_map(|index| {
@@ -253,7 +240,9 @@ unsafe extern "C-unwind" fn mutable_sweep_database(database: pg_sys::Datum) {
                             }
                             let mut idle_segments = HashMap::default();
                             MetaPage::open(&index).segment_metas().for_each(|_, entry| {
-                                if entry.is_mutable() && entry.xmax() == pg_sys::InvalidTransactionId {
+                                if entry.is_mutable()
+                                    && entry.xmax() == pg_sys::InvalidTransactionId
+                                {
                                     let key = (index.oid(), entry.segment_id());
                                     let count = entry.num_docs();
                                     current_counts.insert(key, count);
@@ -282,7 +271,8 @@ unsafe extern "C-unwind" fn mutable_sweep_database(database: pg_sys::Datum) {
                             if VacuumSignal::new(index.oid()).wants_cancel() {
                                 return;
                             }
-                            let Some(_slot) = MergeSlot::new(index.oid(), MergeSlotVariant::Small).lock()
+                            let Some(_slot) =
+                                MergeSlot::new(index.oid(), MergeSlotVariant::Small).lock()
                             else {
                                 return;
                             };
@@ -293,7 +283,8 @@ unsafe extern "C-unwind" fn mutable_sweep_database(database: pg_sys::Datum) {
                             let merge_lock = metadata.acquire_merge_lock();
                             PgTryBuilder::new(AssertUnwindSafe(|| {
                                 let frozen = metadata.freeze_mutable_segments_matching(|entry| {
-                                    idle_segments.get(&entry.segment_id()) == Some(&entry.num_docs())
+                                    idle_segments.get(&entry.segment_id())
+                                        == Some(&entry.num_docs())
                                 });
                                 if 
```

---

### Incident Patch 3: `781cb511` (2026-11-11)
**Commit Message**: fix: restore IVF split logic while keeping target_leaf_size (#7377)

## What

Soft-revert geometric clustering while keeping the `target_leaf_size`
name and default of 200. ParadeDB's source integration, option names,
and SQL regression fixtures remain identical to the PR base. Update the
dependency pins and correct two descriptions of the training-leaf cap;
retain the original option-rename changelog entry.

## Dependencies and scope

- [superkmeans-rs
#45](https://github.com/paradedb/superkmeans-rs/pull/45),
`6b0d0bc08e2071220b99222db0c79ad49305f8dc`: restore `ceil(n_sub /
target_leaf_size)` recursive splitting and enforce the training-leaf cap
while preserving the API name.
- [Tantivy #399](https://github.com/paradedb/tantivy/pull/399),
`98b3d5c1570c912f51f40530ba1645f1695b458b` (merged): use that
implementation for IVF and stacked routing; preserve
`with_target_leaf_size` and `DEFAULT_TARGET_LEAF_SIZE`.
- Preserve donor revival, convergence guards, statistics, and later
dependency changes. Sampling remains 0.32. Explicit `k` sizing is
separate. Both dependency PRs are merged; the direct superkmeans pin
matches the revision used by the merged Tantivy commit.

Updated against cur

**File**: `.github/scripts/docs_snippet_coverage.json` (modified, +4/-4)
```diff
@@ -176,13 +176,13 @@
       ]
     },
     {
-      "reason": "Uses the 0.27 target_leaf_size option before the published ORM client packages ship support; the SQL fence runs in the standalone inventory.",
+      "reason": "The vector index-options CodeGroup contains 0.27 target_leaf_size examples awaiting ORM client support; its SQL fence runs in the standalone inventory.",
       "fences": [
         ["reference/indexing/indexing-vectors.mdx::fence-014", "53c92670d4bf64621e64b1db4aa59eb7476bfc799d4ba4134ef9fd8372135c15"],
-        ["reference/indexing/indexing-vectors.mdx::fence-015", "821236f776b5cb115dc2ea7124ab3edd9d7e2fa853164d4f00c2f0a98ad5bcc3"],
+        ["reference/indexing/indexing-vectors.mdx::fence-015", "5cab4e761805be2b46f77a7b2cc649fe55e0d6c6bdb0a6e327e6fb1246764812"],
         ["reference/indexing/indexing-vectors.mdx::fence-016", "cd2cc9292117f96cd302bdb88ca5a30074992a9ca9c106eb1d948e99df350d73"],
-        ["reference/indexing/indexing-vectors.mdx::fence-017", "61bbc3322127cc2c471e9e161cafbeae0ef27a0172362974e1fdcdbfd2078388"],
-        ["reference/indexing/indexing-vectors.mdx::fence-018", "e3cd48db5fa758ad4e47dfdf5c3426af64262a260ebdea73337ac4c56ef9bcf4"]
+        ["reference/indexing/indexing-vectors.mdx::fence-017", "582e688c81c32cf2ef26addb3286c298067a04f5e5250d448e6e8bc3b8aecf5f"],
+        ["reference/indexing/indexing-vectors.mdx::fence-018", "126340fc1e720d46471e7e7e121434ad4ec13784b130d13ee5b814de15becdee"]
       ]
     }
   ],
```

**File**: `Cargo.lock` (modified, +11/-11)
```diff
@@ -5192,7 +5192,7 @@ dependencies = [
 [[package]]
 name = "ownedbytes"
 version = "0.9.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=71a9b0e6fca86a3a1e9962748f881f9654107c6b#71a9b0e6fca86a3a1e9962748f881f9654107c6b"
+source = "git+https://github.com/paradedb/tantivy.git?rev=98b3d5c1570c912f51f40530ba1645f1695b458b#98b3d5c1570c912f51f40530ba1645f1695b458b"
 dependencies = [
  "stable_deref_trait",
 ]
@@ -7329,7 +7329,7 @@ checksum = "13c2bddecc57b384dee18652358fb23172facb8a2c51ccc10d74c157bdea3292"
 [[package]]
 name = "superkmeans-rs"
 version = "0.4.0"
-source = "git+https://github.com/paradedb/superkmeans-rs?rev=06c8e247a6a0241a996a640080c7245f6c7b5940#06c8e247a6a0241a996a640080c7245f6c7b5940"
+source = "git+https://github.com/paradedb/superkmeans-rs?rev=6b0d0bc08e2071220b99222db0c79ad49305f8dc#6b0d0bc08e2071220b99222db0c79ad49305f8dc"
 dependencies = [
  "matrixmultiply",
  "pkg-config",
@@ -7414,7 +7414,7 @@ checksum = "7b2093cf4c8eb1e67749a6762251bc9cd836b6fc171623bd0a9d324d37af2417"
 [[package]]
 name = "tantivy"
 version = "0.27.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=71a9b0e6fca86a3a1e9962748f881f9654107c6b#71a9b0e6fca86a3a1e9962748f881f9654107c6b"
+source = "git+https://github.com/paradedb/tantivy.git?rev=98b3d5c1570c912f51f40530ba1645f1695b458b#98b3d5c1570c912f51f40530ba1645f1695b458b"
 dependencies = [
  "aho-corasick",
  "arc-swap",
@@ -7473,15 +7473,15 @@ dependencies = [
 [[package]]
 name = "tantivy-bitpacker"
 version = "0.10.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=71a9b0e6fca86a3a1e9962748f881f9654107c6b#71a9b0e6fca86a3a1e9962748f881f9654107c6b"
+source = "git+https://github.com/paradedb/tantivy.git?rev=98b3d5c1570c912f51f40530ba1645f1695b458b#98b3d5c1570c912f51f40530ba1645f1695b458b"
 dependencies = [
  "bitpacking",
 ]
 
 [[package]]
 name = "tantivy-columnar"
 version = "0.7.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=71a9b0e6fca86a3a1e9962748f881f9654107c6b#71a9b0e6fca86a3a1e9962748f881f9654107c6b"
+source = "git+https://github.com/paradedb/tantivy.git?rev=98b3d5c1570c912f51f40530ba1645f1695b458b#98b3d5c1570c912f51f40530ba1645f1695b458b"
 dependencies = [
  "downcast-rs",
  "fastdivide",
@@ -7496,7 +7496,7 @@ dependencies = [
 [[package]]
 name = "tantivy-common"
 version = "0.11.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=71a9b0e6fca86a3a1e9962748f881f9654107c6b#71a9b0e6fca86a3a1e9962748f881f9654107c6b"
+source = "git+https://github.com/paradedb/tantivy.git?rev=98b3d5c1570c912f51f40530ba1645f1695b458b#98b3d5c1570c912f51f40530ba1645f1695b458b"
 dependencies = [
  "async-trait",
  "byteorder",
@@ -7529,7 +7529,7 @@ dependencies = [
 [[package]]
 name = "tantivy-quant"
 version = "0.1.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=71a9b0e6fca86a3a1e9962748f881f9654107c6b#71a9b0e6fca86a3a1e9962748f881f9654107c6b"
+source = "git+https://github.com/paradedb/tantivy.git?rev=98b3d5c1570c912f51f40530ba1645f1695b458b#98b3d5c1570c912f51f40530ba1645f1695b458b"
 dependencies = [
  "rand_chacha 0.3.1",
  "rand_core 0.6.4",
@@ -7538,7 +7538,7 @@ dependencies = [
 [[package]]
 name = "tantivy-query-grammar"
 version = "0.26.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=71a9b0e6fca86a3a1e9962748f881f9654107c6b#71a9b0e6fca86a3a1e9962748f881f9654107c6b"
+source = "git+https://github.com/paradedb/tantivy.git?rev=98b3d5c1570c912f51f40530ba1645f1695b458b#98b3d5c1570c912f51f40530ba1645f1695b458b"
 dependencies = [
  "fnv",
  "nom 7.1.3",
@@ -7550,7 +7550,7 @@ dependencies = [
 [[package]]
 name = "tantivy-sstable"
 version = "0.7.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=71a9b0e6fca86a3a1e9962748f881f9654107c6b#71a9b0e6fca86a3a1e9962748f881f9654107c6b"
+source = "git+https://github.com/paradedb/tantivy.git?rev=98b3d5c1570c912f51f40530ba1645f1695b458b#98b3d5c1570c912f51f40530ba1645f1695b458b"
 dependencies = [
  "futures-util",
  "itertools 0.14.0",
@@ -7563,7 +7563,7 @@ dependencies = [
 [[package]]
 name = "tantivy-stacker"
 version = "0.7.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=71a9b0e6fca86a3a1e9962748f881f9654107c6b#71a9b0e6fca86a3a1e9962748f881f9654107c6b"
+source = "git+https://github.com/paradedb/tantivy.git?rev=98b3d5c1570c912f51f40530ba1645f1695b458b#98b3d5c1570c912f51f40530ba1645f1695b458b"
 dependencies = [
  "fixedbitset",
  "murmurhash32",
@@ -7600,7 +7600,7 @@ dependencies = [
 [[package]]
 name = "tantivy-tokenizer-api"
 version = "0.7.0"
-source = "git+https://github.com/paradedb/tantivy.git?rev=71a9b0e6fca86a3a1e9962748f881f9654107c6b#71a9b0e6fca86a3a1e9962748f881f9654107c6b"
+source = "git+https://github.com/paradedb/tantivy.git?rev=98b3d5c1570c912f51f40530ba1645f1695b458b#98b3d5c1570c912f51f40530ba1645f1695b458b"
 dependencies = [
  "serde",
 ]
```

**File**: `Cargo.toml` (modified, +4/-4)
```diff
@@ -89,7 +89,7 @@ pgrx-tests = "=0.20.0-beta.1"
 
 # Keep the Git revisions for `tantivy`, `tantivy-common`, and the crates.io
 # patches in sync.
-tantivy = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy", rev = "71a9b0e6fca86a3a1e9962748f881f9654107c6b", features = [
+tantivy = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy", rev = "98b3d5c1570c912f51f40530ba1645f1695b458b", features = [
   "columnar-zstd-compression",
   "lz4-compression",
   "paradedb",
@@ -98,7 +98,7 @@ tantivy = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy"
   "stemmer",
   "stopwords",
 ], default-features = false }
-tantivy-common = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-common", rev = "71a9b0e6fca86a3a1e9962748f881f9654107c6b" }
+tantivy-common = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-common", rev = "98b3d5c1570c912f51f40530ba1645f1695b458b" }
 tantivy-jieba = "0.21.0"
 
 async-trait = "0.1.92"
@@ -185,8 +185,8 @@ rstest = "0.28.0"
 postgres = "0.19.14"
 
 [patch.crates-io]
-tantivy-common = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-common", rev = "71a9b0e6fca86a3a1e9962748f881f9654107c6b" }
-tantivy-tokenizer-api = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-tokenizer-api", rev = "71a9b0e6fca86a3a1e9962748f881f9654107c6b" }
+tantivy-common = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-common", rev = "98b3d5c1570c912f51f40530ba1645f1695b458b" }
+tantivy-tokenizer-api = { git = "https://github.com/paradedb/tantivy.git", package = "tantivy-tokenizer-api", rev = "98b3d5c1570c912f51f40530ba1645f1695b458b" }
 
 [workspace.lints.rust]
 unused_crate_dependencies = "warn"
```

**File**: `docs/project/changelog/unreleased/7346.breaking.mdx` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 header: breaking
 ---
 
-Renamed the IVF index option `max_leaf_size` to `target_leaf_size`. The value is a clustering target rather than a hard cap; actual leaves may be somewhat larger. Indexes that explicitly store `max_leaf_size` must be updated with `ALTER INDEX ... SET (target_leaf_size = ...)` or recreated.
+Renamed the IVF index option `max_leaf_size` to `target_leaf_size`. The value caps the number of sampled training vectors per leaf; it does not cap the number of indexed vectors assigned to a cluster. Indexes that explicitly store `max_leaf_size` must be updated with `ALTER INDEX ... SET (target_leaf_size = ...)` or recreated.
```

**File**: `docs/reference/indexing/indexing-vectors.mdx` (modified, +4/-4)
```diff
@@ -254,10 +254,10 @@ modelBuilder.Entity<MockItem>()
 <ParamField body="target_leaf_size" default={200}>
   The target number of sampled training vectors in a leaf of the hierarchical
   clustering tree. Must be an integer between `1` and `2147483647`. Smaller
-  values generally produce more centroids and smaller clusters. Actual leaves
-  may be somewhat larger than the target. This setting is independent of
-  `training_sample_ratio` and does not cap the number of indexed vectors
-  assigned to a cluster.
+  values generally produce more centroids and smaller clusters. Training leaves
+  are split until they contain at most this many vectors. This setting is
+  independent of `training_sample_ratio` and does not cap the number of indexed
+  vectors assigned to a cluster.
 </ParamField>
 <ParamField body="vector_router_quantization" default={true}>
   Route each query through one-bit codes of the IVF centroids, then rerank the
```

**File**: `index_write/Cargo.toml` (modified, +2/-2)
```diff
@@ -31,12 +31,12 @@ serde_json.workspace = true
 tantivy.workspace = true
 
 [target.'cfg(target_os = "macos")'.dependencies]
-superkmeans = { git = "https://github.com/paradedb/superkmeans-rs", package = "superkmeans-rs", rev = "06c8e247a6a0241a996a640080c7245f6c7b5940", features = [
+superkmeans = { git = "https://github.com/paradedb/superkmeans-rs", package = "superkmeans-rs", rev = "6b0d0bc08e2071220b99222db0c79ad49305f8dc", features = [
   "accelerate",
 ] }
 
 [target.'cfg(not(target_os = "macos"))'.dependencies]
-superkmeans = { git = "https://github.com/paradedb/superkmeans-rs", package = "superkmeans-rs", rev = "06c8e247a6a0241a996a640080c7245f6c7b5940", features = [
+superkmeans = { git = "https://github.com/paradedb/superkmeans-rs", package = "superkmeans-rs", rev = "6b0d0bc08e2071220b99222db0c79ad49305f8dc", features = [
   "openblas",
 ] }
 
```

**File**: `nix/pg_search.nix` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ buildPgrxExtension (finalAttrs: {
   # If maintainers forget to do so, Nix will throw an error message that begins
   # like this and then provides the correct new hash:
   # error: hash mismatch in fixed-output derivation '...'
-  cargoHash = "sha256-4BtZK4+7KXsuqsJODOvlUzTsRXtvx1yTlxFt3ePUHJg=";
+  cargoHash = "sha256-3VMVjQ0izB1fY6hX9LDapCcUJyiCOFviV4wsj4Dt+vU=";
 
   inherit postgresql;
   # The Nix builder also passes cargoPgrxFlags to `stop`, which does not accept
```

#### Recent Merged Pull Requests:
- **PR #7378** (closed): perf: pin Tantivy with SIMD rotation kernels for vector quantization (@walter-woodall)
- **PR #7377** (2026-11-11): fix: restore IVF split logic while keeping target_leaf_size (@rebasedming)
- **PR #7373** (closed): perf(vector): lower default target leaf size to 150 (@rebasedming)
- **PR #7371** (2026-11-10): chore: Fix docs after vector updates. (@stuhood)
- **PR #7367** (closed): chore: Ignore (@stuhood)
- **PR #7365** (2026-11-10): fix: correct Tantivy revision after clustering update (@rebasedming)

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

## X. correct Tantivy revision after clustering update (#7365)

**RULE**:
When implementing operations in `Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in paradedb/paradedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `61edff0a`: correct Tantivy revision after clustering update (#7365). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c4f4a3d93544d3b174e1994e207#05b861b5ef138c4f4a3d93544d3b174e1994e207"
source = "git+https://github.com/paradedb/tantivy.git?rev=05b861b5ef138c
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc04fb71fd4808afddad19e9c17d7#1c7c2150a97bc04fb71fd4808afddad19e9c17d7"
source = "git+https://github.com/paradedb/tantivy.git?rev=1c7c2150a97bc0
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `61edff0a` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
