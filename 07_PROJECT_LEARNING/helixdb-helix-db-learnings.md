# Forensic Learning Record (Deep Inspection): HelixDB/helix-db

> **Canonical Artifact**: `07_PROJECT_LEARNING/helixdb-helix-db-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HelixDB/helix-db](https://github.com/HelixDB/helix-db))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:08:41.214Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HelixDB/helix-db`
- **Description**: HelixDB is an OLTP graph database with native vector and full-text search built in Rust on Object Storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 6113 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/cli/src/utils.rs`
```
use eyre::Result;
use std::ffi::OsString;
use std::path::Path;

pub fn command_exists(command: &str) -> bool {
    command_exists_in_path(
        command,
        std::env::var_os("PATH"),
        std::env::var_os("PATHEXT"),
    )
}

fn command_exists_in_path(
    command: &str,
    path: Option<OsString>,
    path_ext: Option<OsString>,
) -> bool {
    let command_path = Path::new(command);
    if command_path.components().count() > 1 {
        return is_executable(command_path);
    }

    let Some(path) = path else {
        return false;
    };

    let extensions = command_extensions(command, path_ext);
    std::env::split_paths(&path).any(|dir| {
        extensions
            .iter()
            .any(|extension| is_executable(&dir.join(format!("{command}{extension}"))))
    })
}

fn command_extensions(command: &str, path_ext: Option<OsString>) -> Vec<String> {
    if cfg!(windows) && Path::new(command).extension().is_none() {
        let path_ext = path_ext
            .and_then(|value| value.into_string().ok())
            .unwrap_or_else(|| ".COM;.EXE;.BAT;.CMD".to_string());
        let mut extensions = vec![String::new()];
        extensions.extend(
            path_ext
                .split(';')
                .filter(|extension| !extension.is_empty())
                .map(|extension| {
                    if extension.starts_with('.') {
                        extension.to_string()
                    } else {
                        format!(".{extension}")
                    }
                }),
        );
        extensions
    } else {
        vec![String::new()]
    }
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;

    path.is_file()
        && path
            .metadata()
            .map(|metadata| metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
}

#[cfg(not(unix))]
fn is_executable(path: &Path) -> bool {
    path.is_file()
}

pub fn add_env_var_to_file(path: &std::path::Path, key: &str, value: &str) -> Result<()> {
    let mut content = std::fs::read_to_string(path).unwrap_or_default();
    let replacement = format!("{key}={value}");
    let mut replaced = false;

    let lines: Vec<String> = content
        .lines()
        .map(|line| {
            if line.trim_start().starts_with(&format!("{key}=")) {
                replaced = true;
                replacement.clone()
            } else {
                line.to_string()
            }
        })
        .collect();

    content = lines.join("\n");
    if !replaced {
        if !content.is_empty() && !content.ends_with('\n') {
            content.push('\n');
        }
        content.push_str(&replacement);
    }
    if !content.ends_with('\n') {
        content.push('\n');
    }

    std::fs::write(path, content)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_exists_in_path_finds_platform_executable() {
        let dir = tempfile::tempdir().unwrap();
        let command = dir
            .path()
            .join(if cfg!(windows) { "node.CMD" } else { "node" });
        std::fs::write(&command, "").unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = std::fs::metadata(&command).unwrap().permissions();
            permissions.set_mode(0o755);
            std::fs::set_permissions(&command, permissions).unwrap();
        }

        assert!(command_exists_in_path(
            "node",
            Some(dir.path().as_os_str().to_os_string()),
            Some(OsString::from(".CMD")),
        ));
    }

    #[test]
    fn command_extensions_include_windows_path_ext() {
        let extensions = command_extensions("node", Some(OsString::from(".EXE;.CMD")));

        if cfg!(windows) {
            assert_eq!(extensions, vec!["", ".EXE", ".CMD"]);
        } else {
            assert_eq!(extensions, vec![""]);
        }
    }

    #[test]
    fn command_lookup_handles_direct_missing_and_non_executable_paths() {
        let dir = tempfile::tempdir().unwrap();
        let command = dir.path().join("tool");
        std::fs::write(&command, "").unwrap();

        #[cfg(unix)]
        assert!(!command_exists_in_path(
            command.to_str().unwrap(),
            None,
            None
        ));
        #[cfg(not(unix))]
        assert!(command_exists_in_path(
            command.to_str().unwrap(),
            None,
            None
        ));

        assert!(!command_exists_in_path("missing", None, None));
        assert!(!command_exists_in_path(
            "missing",
            Some(dir.path().as_os_str().to_os_string()),
            None,
        ));
    }

    #[test]
    fn env_file_values_are_added_replaced_and_newline_terminated() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(".env");

        add_env_var_to_file(&path, "EXAMPLE_TOKEN", "first").unwrap();
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            "EXAMPLE_TOKEN=first\n"
        );

        std::fs::write(&path, "OTHER=value\n  EXAMPLE_TOKEN=old\nTAIL=value").unwrap();
        add_env_var_to_file(&path, "EXAMPLE_TOKEN", "second").unwrap();
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            "OTHER=value\nEXAMPLE_TOKEN=second\nTAIL=value\n"
        );
    }
}

```

### Core Architecture Module: `crates/db/examples/queue_acceptance_verify.rs`
```
//! Verifies a pre-queue release fixture through the normal open path.
//!
//! Usage: `queue_acceptance_verify <fixture-root>`, where the fixture was
//! produced by the pre-queue release's acceptance fixture generator (a
//! `settled` database with Active secondary/vector/text indexes, an
//! `inflight` database with interrupted vector/text builds, and
//! `manifest.json` with the expected graph state). The verifier works on the
//! directory it is given; callers pass a copy so the preserved fixture stays
//! untouched. It prints a JSON report and exits non-zero on any mismatch.
//!
//! Checks: existing graph data and physical indexes remain usable without
//! manual initialization; the absent queue loads as empty; strong and
//! eventual searches match exact oracles before and after new queued writes,
//! publication, and a restart; interrupted pre-queue builds either finish or
//! block explicitly, and a blocked build recovers through abort and recreate.

use std::collections::{BTreeMap, BTreeSet};
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use db::{HelixDB, HelixDbSource};
use helix_ast::expr::Predicate;
use helix_ast::graph::NodeRef;
use helix_ast::index::{IndexSpec, VectorDistanceMetric};
use helix_ast::query::{QueryRequest, SearchConsistency};
use helix_ast::value::{PropertyInput, PropertyValue};
use helix_ast::{batch, traversal};

/// Effective text-search result cap enforced by the server.
const TEXT_RESULT_CAP: usize = 800;

#[derive(Clone, Debug)]
struct Doc {
    key: String,
    tenant: String,
    embedding: [f32; 2],
    body: String,
}

fn docs(manifest: &serde_json::Value) -> BTreeMap<u64, Doc> {
    manifest
        .as_object()
        .unwrap()
        .iter()
        .map(|(id, doc)| {
            let embedding = doc["embedding"].as_array().unwrap();
            (
                id.parse().unwrap(),
                Doc {
                    key: doc["key"].as_str().unwrap().to_string(),
                    tenant: doc["tenant"].as_str().unwrap().to_string(),
                    embedding: [
                        embedding[0].as_f64().unwrap() as f32,
                        embedding[1].as_f64().unwrap() as f32,
                    ],
                    body: doc["body"].as_str().unwrap().to_string(),
                },
            )
        })
        .collect()
}

async fn open(root: &Path, database: &str) -> HelixDB {
    HelixDB::open(HelixDbSource::Disk {
        root: root.to_path_buf(),
        database: database.to_string(),
    })
    .await
    .unwrap_or_else(|error| panic!("{database} opens through the normal path: {error}"))
}

async fn write(db: &HelixDB, request: impl Fn() -> QueryRequest) -> serde_json::Value {
    for _ in 0..100 {
        match db.query(request()).await {
            Ok(result) => return result,
            Err(error) if error.is_transaction_conflict() || error.is_index_backpressure() => {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
            Err(error) => panic!("write failed: {error}"),
        }
    }
    panic!("write kept conflicting")
}

fn operation_id(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Object(object) => object
            .get("operation_id")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string)
            .or_else(|| object.values().find_map(operation_id)),
        serde_json::Value::Array(values) => values.iter().find_map(operation_id),
        serde_json::Value::Null
        | serde_json::Value::Bool(_)
        | serde_json::Value::Number(_)
        | serde_json::Value::String(_) => None,
    }
}

async fn status(db: &HelixDB, operation: &str) -> serde_json::Value {
    db.query(QueryRequest::read(
        batch::read_batch()
            .var_as("status", traversal::g().get_index_operation(operation))
            .returning(["status"]),
    ))
    .await
    .unwrap()["status"]
        .clone()
}

async fn wait_terminal(db: &HelixDB, operation: &str) -> serde_json::Value {
    let deadline = Instant::now() + Duration::from_secs(300);
    loop {
        let current = status(db, operation).await;
        if !matches!(current["status"].as_str(), Some("queued" | "running")) {
            return current;
        }
        assert!(Instant::now() < deadline, "operation {operation} stalled");
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

async fn ddl(
    db: &HelixDB,
    name: &str,
    traversal: traversal::Traversal<traversal::Terminal, traversal::WriteEnabled>,
) -> Option<String> {
    let receipt = write(db, || {
        QueryRequest::write(
            batch::write_batch()
                .var_as(name, traversal.clone())
                .returning([name]),
        )
    })
    .await;
    operation_id(&receipt)
}

fn vector_spec() -> IndexSpec {
    IndexSpec::node_vector(
        "Doc",
        "embedding",
        NonZeroUsize::new(2).unwrap(),
        VectorDistanceMetric::Euclidean,
        Some("tenant"),
    )
}

fn text_spec() -> IndexSpec {
    IndexSpec::node_text("Doc", "body", None::<&str>)
}

async fn wait_published(db: &HelixDB) {
    let deadline = Instant::now() + Duration::from_secs(120);
    while db.index_operation_queue_stats().pending_operations != 0 {
        assert!(
            Instant::now() < deadline,
            "queued index work did not publish"
        );
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
}

async fn vector_hits(
    db: &HelixDB,
    tenant: &str,
    query: [f32; 2],
    consistency: SearchConsistency,
) -> Vec<u64> {
    let request = QueryRequest::read(
        batch::read_batch()
            .var_as(
                "hits",
                traversal::g().vector_search_nodes(
                    "Doc",
                    "embedding",
                    query.to_vec(),
                    10,
                    Some(PropertyValue::from(tenant)),
                ),
            )
            .returning(["hits"]),
    )
    .with_search_consistency(consistency)
    .unwrap();
    let result = db.query(request).await.unwrap();
    result["hits"].as_array().map_or_else(Vec::new, |hits| {
        hits.iter()
            .map(|hit| hit["$id"].as_u64().unwrap())
            .collect()
    })
}

async fn text_hits(db: &HelixDB, term: &str, consistency: SearchConsistency) -> BTreeSet<u64> {
    let request = QueryRequest::read(
        batch::read_batch()
            .var_as(
                "hits",
                traversal::g().text_search_nodes("Doc", "body", term, 1_000, None::<PropertyValue>),
            )
            .returning(["hits"]),
    )
    .with_search_consistency(consistency)
    .unwrap();
    let result = db.query(request).await.unwrap();
    result["hits"]
        .as_array()
        .map_or_else(BTreeSet::new, |hits| {
            hits.iter()
                .map(|hit| hit["$id"].as_u64().unwrap())
                .collect()
        })
}

/// Compares vector and text searches with exact oracles over `state`.
async fn check_searches(
    db: &HelixDB,
    state: &BTreeMap<u64, Doc>,
    consistency: SearchConsistency,
    failures: &mut Vec<String>,
    phase: &str,
) {
    for tenant in ["a", "b"] {
        for query in [[3.3_f32, 2.7], [16.2, 8.1], [41.4, 1.2], [0.4, 17.6]] {
            let mut exact = state
                .iter()
                .filter(|(_, doc)| doc.tenant == tenant)
                .map(|(id, doc)| {
                    let distance = (doc.embedding[0] - query[0]).powi(2)
                        + (doc.embedding[1] - query[1]).powi(2);
                    (distance, *id)
                })
                .collect::<Vec<_>>();
            exact.sort_by(|left, right| left.partial_cmp(right).unwrap());
            let expected = exact.iter().take(10).map(|(_, id)| *id).collect::<Vec<_>>();
            let found = vector_hits(db, tenant, query, consistency).await;
            if found != expected {
                failures.push(format!(
                    "{phase}: vector {tenant} {query:?} {consistency:?}: {found:?} != {expected:?}"
                ));
            }
        }
    }
    for term in ["shared", "word3", "rewritten", "arrival"] {
        let expected = state
            .iter()
            .filter(|(_, doc)| doc.body.split(' ').any(|word| word == term))
            .map(|(id, _)| *id)
            .collect::<BTreeSet<_>>();
        let found = text_hits(db, term, consistency).await;
        // Text search returns at most 800 hits per request.
        let matches = if expected.len() > TEXT_RESULT_CAP {
            found.len() == TEXT_RESULT_CAP && found.is_subset(&expected)
        } else {
            found == expected
        };
        if !matches {
            failures.push(format!(
                "{phase}: text {term:?} {consistency:?}: {} found, {} expected",
                found.len(),
                expected.len()
            ));
        }
    }
}

async fn check_graph(db: &HelixDB, state: &BTreeMap<u64, Doc>, failures: &mut Vec<String>) {
    let result = db
        .query(QueryRequest::read(
            batch::read_batch()
                .var_as("count", traversal::g().n_with_label("Doc").count())
                .returning(["count"]),
        ))
        .await
        .unwrap();
    let count = result["count"].as_u64().unwrap_or_default();
    if count != state.len() as u64 {
        failures.push(format!(
            "graph holds {count} docs, expected {}",
            state.len()
        ));
    }
    for doc in state.values().step_by(37) {
        // The fixture reuses keys across its two seeding rounds, so a key can
        // name several documents.
        let expected = state
            .iter()
            .filter(|(_, other)| other.key == doc.key)
            .map(|(id, _)| *id)
            .collect::<Vec<_>>();
        let result = db
            .query(QueryRequest::read(
                batch::read_b
```

### Core Architecture Module: `crates/db/src/config/index_lifecycle_throughput.rs`
```
//! Runtime-only throughput policy for index lifecycle work.
//!
//! This policy controls source-scan prefetching and worker concurrency. It is
//! never serialized into lifecycle records or physical index rows.
//!
//! # Usage
//!
//! ```
//! use db::config::{
//!     DbConfig, IndexLifecycleConcurrency, IndexLifecycleScanTuning,
//!     IndexLifecycleThroughputTuning,
//! };
//!
//! let scan = IndexLifecycleScanTuning::try_new(64 * 1024, 2)?;
//! let concurrency = IndexLifecycleConcurrency::try_new(2, 2, 1, 1)?;
//! let tuning = IndexLifecycleThroughputTuning::new(scan, concurrency);
//! let config = DbConfig::new().with_index_lifecycle_throughput_tuning(tuning);
//!
//! assert_eq!(config.index_lifecycle_throughput(), tuning);
//! # Ok::<(), db::config::IndexLifecycleThroughputTuningError>(())
//! ```

use std::num::NonZeroUsize;

const DEFAULT_SCAN_READ_AHEAD_BYTES: usize = 256 * 1024;
const DEFAULT_SCAN_FETCH_TASKS: usize = 4;
const DEFAULT_TOTAL_OPERATION_TASKS: usize = 2;
const DEFAULT_SECONDARY_TASKS: usize = 2;
const DEFAULT_VECTOR_TASKS: usize = 1;
const DEFAULT_TEXT_TASKS: usize = 1;

/// Invalid runtime throughput policy rejected before lifecycle work starts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndexLifecycleThroughputTuningError {
    /// One required positive setting was zero.
    Zero { setting: &'static str },
    /// A family or lane limit exceeded the shared task ceiling.
    ExceedsGlobal {
        setting: &'static str,
        limit: usize,
        global: usize,
    },
}

impl core::fmt::Display for IndexLifecycleThroughputTuningError {
    fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::Zero { setting } => write!(formatter, "{setting} must be nonzero"),
            Self::ExceedsGlobal {
                setting,
                limit,
                global,
            } => write!(
                formatter,
                "{setting} limit {limit} exceeds global operation limit {global}"
            ),
        }
    }
}

impl std::error::Error for IndexLifecycleThroughputTuningError {}

/// Positive source-scan prefetch policy with cache admission permanently off.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct IndexLifecycleScanTuning {
    read_ahead_bytes: NonZeroUsize,
    max_fetch_tasks: NonZeroUsize,
}

impl IndexLifecycleScanTuning {
    /// Constructs scan tuning, rejecting zero read-ahead and task counts.
    pub fn try_new(
        read_ahead_bytes: usize,
        max_fetch_tasks: usize,
    ) -> Result<Self, IndexLifecycleThroughputTuningError> {
        let read_ahead_bytes = NonZeroUsize::new(read_ahead_bytes).ok_or(
            IndexLifecycleThroughputTuningError::Zero {
                setting: "scan read-ahead bytes",
            },
        )?;
        let max_fetch_tasks = NonZeroUsize::new(max_fetch_tasks).ok_or(
            IndexLifecycleThroughputTuningError::Zero {
                setting: "scan fetch tasks",
            },
        )?;
        Ok(Self {
            read_ahead_bytes,
            max_fetch_tasks,
        })
    }

    /// Returns the requested read-ahead window in bytes.
    pub const fn read_ahead_bytes(self) -> NonZeroUsize {
        self.read_ahead_bytes
    }

    /// Returns the maximum parallel block-fetch tasks per tuned scan.
    pub const fn max_fetch_tasks(self) -> NonZeroUsize {
        self.max_fetch_tasks
    }

    /// Tuned lifecycle scans never admit fetched data blocks to the shared cache.
    pub const fn cache_admission_enabled(self) -> bool {
        false
    }

    pub(crate) fn scan_options(self) -> slatedb::config::ScanOptions {
        slatedb::config::ScanOptions::default()
            .with_read_ahead_bytes(self.read_ahead_bytes.get())
            .with_cache_blocks(false)
            .with_max_fetch_tasks(self.max_fetch_tasks.get())
    }
}

impl Default for IndexLifecycleScanTuning {
    fn default() -> Self {
        Self::try_new(DEFAULT_SCAN_READ_AHEAD_BYTES, DEFAULT_SCAN_FETCH_TASKS)
            .expect("default lifecycle scan tuning is positive")
    }
}

/// Validated global and family task ceilings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct IndexLifecycleConcurrency {
    total_operation_tasks: NonZeroUsize,
    secondary_tasks: NonZeroUsize,
    vector_tasks: NonZeroUsize,
    text_tasks: NonZeroUsize,
}

impl IndexLifecycleConcurrency {
    /// Constructs concurrency limits and rejects zero or contradictory ceilings.
    pub fn try_new(
        total_operation_tasks: usize,
        secondary_tasks: usize,
        vector_tasks: usize,
        text_tasks: usize,
    ) -> Result<Self, IndexLifecycleThroughputTuningError> {
        let total_operation_tasks = positive("total operation tasks", total_operation_tasks)?;
        let secondary_tasks = positive("secondary tasks", secondary_tasks)?;
        let vector_tasks = positive("vector tasks", vector_tasks)?;
        let text_tasks = positive("text tasks", text_tasks)?;
        let global = total_operation_tasks.get();
        for (setting, limit) in [
            ("secondary tasks", secondary_tasks),
            ("vector tasks", vector_tasks),
            ("text tasks", text_tasks),
        ] {
            if limit.get() > global {
                return Err(IndexLifecycleThroughputTuningError::ExceedsGlobal {
                    setting,
                    limit: limit.get(),
                    global,
                });
            }
        }
        Ok(Self {
            total_operation_tasks,
            secondary_tasks,
            vector_tasks,
            text_tasks,
        })
    }

    pub const fn total_operation_tasks(self) -> NonZeroUsize {
        self.total_operation_tasks
    }

    pub const fn secondary_tasks(self) -> NonZeroUsize {
        self.secondary_tasks
    }

    pub const fn vector_tasks(self) -> NonZeroUsize {
        self.vector_tasks
    }

    pub const fn text_tasks(self) -> NonZeroUsize {
        self.text_tasks
    }

    /// Returns how many queue publication attempts may run at once: one per
    /// vector and per text task.
    pub(crate) const fn publication_tasks(self) -> NonZeroUsize {
        self.vector_tasks.saturating_add(self.text_tasks.get())
    }
}

impl Default for IndexLifecycleConcurrency {
    fn default() -> Self {
        Self::try_new(
            DEFAULT_TOTAL_OPERATION_TASKS,
            DEFAULT_SECONDARY_TASKS,
            DEFAULT_VECTOR_TASKS,
            DEFAULT_TEXT_TASKS,
        )
        .expect("default lifecycle concurrency is positive and globally bounded")
    }
}

/// Complete runtime-only lifecycle throughput policy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub struct IndexLifecycleThroughputTuning {
    scan: IndexLifecycleScanTuning,
    concurrency: IndexLifecycleConcurrency,
}

impl IndexLifecycleThroughputTuning {
    pub const fn new(
        scan: IndexLifecycleScanTuning,
        concurrency: IndexLifecycleConcurrency,
    ) -> Self {
        Self { scan, concurrency }
    }

    pub const fn scan(self) -> IndexLifecycleScanTuning {
        self.scan
    }

    pub const fn concurrency(self) -> IndexLifecycleConcurrency {
        self.concurrency
    }
}

fn positive(
    setting: &'static str,
    value: usize,
) -> Result<NonZeroUsize, IndexLifecycleThroughputTuningError> {
    NonZeroUsize::new(value).ok_or(IndexLifecycleThroughputTuningError::Zero { setting })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_the_runtime_throughput_contract() {
        let tuning = IndexLifecycleThroughputTuning::default();
        assert_eq!(tuning.scan().read_ahead_bytes().get(), 256 * 1024);
        assert_eq!(tuning.scan().max_fetch_tasks().get(), 4);
        assert!(!tuning.scan().cache_admission_enabled());
        assert_eq!(tuning.concurrency().total_operation_tasks().get(), 2);
        assert_eq!(tuning.concurrency().secondary_tasks().get(), 2);
        assert_eq!(tuning.concurrency().vector_tasks().get(), 1);
        assert_eq!(tuning.concurrency().text_tasks().get(), 1);
    }

    #[test]
    fn legacy_equivalent_scan_and_serial_concurrency_remain_explicit() {
        let scan = IndexLifecycleScanTuning::try_new(1, 1).unwrap();
        let concurrency = IndexLifecycleConcurrency::try_new(1, 1, 1, 1).unwrap();
        let options = scan.scan_options();
        assert_eq!(options.read_ahead_bytes, 1);
        assert_eq!(options.max_fetch_tasks, 1);
        assert!(!options.cache_blocks);
        assert_eq!(concurrency.total_operation_tasks().get(), 1);
    }

    #[test]
    fn zero_and_family_limits_above_global_are_rejected() {
        assert!(matches!(
            IndexLifecycleScanTuning::try_new(0, 1),
            Err(IndexLifecycleThroughputTuningError::Zero { .. })
        ));
        assert!(matches!(
            IndexLifecycleConcurrency::try_new(2, 2, 1, 3),
            Err(IndexLifecycleThroughputTuningError::ExceedsGlobal {
                setting: "text tasks",
                ..
            })
        ));
        for zero_position in 0..4 {
            let mut limits = [1; 4];
            limits[zero_position] = 0;
            assert!(matches!(
                IndexLifecycleConcurrency::try_new(limits[0], limits[1], limits[2], limits[3]),
                Err(IndexLifecycleThroughputTuningError::Zero { .. })
            ));
        }
    }
}

```

### Core Architecture Module: `crates/db/src/config/index_operation_queue.rs`
```
//! Runtime policy for queued asynchronous vector/text index operations.
//!
//! Admission limits apply per logical index, aggregated across its
//! generations. They are never serialized, so changing them does not alter
//! the persisted queue format.
//!
//! # Usage
//!
//! ```
//! use std::num::NonZeroU64;
//! use std::time::Duration;
//!
//! use db::config::{DbConfig, IndexOperationQueueTuning, IndexOperationQueueTuningError};
//!
//! let tuning = IndexOperationQueueTuning::default()
//!     .with_max_retained_bytes(NonZeroU64::new(64 * 1024 * 1024).unwrap())
//!     .unwrap()
//!     .with_max_members(NonZeroU64::new(10_000).unwrap())
//!     .with_recovery_sweep_interval(Duration::from_millis(250))
//!     .unwrap();
//! let config = DbConfig::new().with_index_operation_queue_tuning(tuning);
//! assert_eq!(config.index_operation_queue(), tuning);
//! assert_eq!(IndexOperationQueueTuning::default().max_members().get(), 250_000);
//!
//! // A larger retained-byte ceiling could let one queue value outgrow the
//! // longest value storage can encode.
//! let largest = IndexOperationQueueTuning::MAX_RETAINED_BYTES;
//! assert_eq!(largest, 2_437_684_127);
//! assert!(IndexOperationQueueTuning::default()
//!     .with_max_retained_bytes(NonZeroU64::new(largest).unwrap())
//!     .is_ok());
//! assert_eq!(
//!     IndexOperationQueueTuning::default()
//!         .with_max_retained_bytes(NonZeroU64::new(largest + 1).unwrap()),
//!     Err(IndexOperationQueueTuningError::RetainedBytesAboveQueueValueLimit {
//!         requested: largest + 1,
//!     })
//! );
//! ```

use std::num::NonZeroU64;
use std::time::Duration;

const DEFAULT_MAX_RETAINED_BYTES: u64 = 1_000_000_000;
const DEFAULT_MAX_MEMBERS: u64 = 250_000;
const DEFAULT_MAX_OPERAND_BYTES: u64 = 8 * 1024 * 1024;
const DEFAULT_RECOVERY_SWEEP_INTERVAL: Duration = Duration::from_secs(1);
const EVENTUAL_SEARCH_SOURCE_INPUT_BYTES: u64 = 128 * 1024 * 1024;
const _: () = assert!(DEFAULT_MAX_RETAINED_BYTES <= IndexOperationQueueTuning::MAX_RETAINED_BYTES);

/// Invalid queue policy rejected before a database opens.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndexOperationQueueTuningError {
    /// The periodic recovery sweep must run.
    ZeroRecoverySweepInterval,
    /// The retained-byte ceiling exceeds
    /// [`IndexOperationQueueTuning::MAX_RETAINED_BYTES`].
    RetainedBytesAboveQueueValueLimit {
        /// The rejected ceiling.
        requested: u64,
    },
}

impl core::fmt::Display for IndexOperationQueueTuningError {
    fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::ZeroRecoverySweepInterval => {
                formatter.write_str("index operation queue recovery sweep interval must be nonzero")
            }
            Self::RetainedBytesAboveQueueValueLimit { requested } => write!(
                formatter,
                "index operation queue max retained bytes {requested} exceed the queue value \
                 limit {}",
                IndexOperationQueueTuning::MAX_RETAINED_BYTES
            ),
        }
    }
}

impl std::error::Error for IndexOperationQueueTuningError {}

/// Storage layout of index-operation queues.
///
/// `Map` is the product layout: one merge-backed value per generation. `Rows`
/// stores one row per operation and acknowledges by deletion; it exists as the
/// baseline for queue-layout benchmarks and runs the same producer, publisher,
/// and search overlays. Only test and `async-index-benchmark` builds can
/// select it (`IndexOperationQueueTuning::with_layout`), so every product
/// handle runs `Map`.
///
/// A database must reopen with the layout that wrote its queues. Writer opens
/// fail closed on the other layout's queues. In builds that can select `Rows`,
/// reader opens also scan every tenant scope for them; that check sees only
/// the queues present at open.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum QueueLayout {
    /// One merge-backed operation map per scope, index, and generation.
    #[default]
    Map,
    /// One row per operation, acknowledged by deletion.
    Rows,
}

/// Complete runtime policy for the immutable index-operation queue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct IndexOperationQueueTuning {
    max_retained_bytes: NonZeroU64,
    max_members: NonZeroU64,
    max_operand_bytes: NonZeroU64,
    recovery_sweep_interval: Duration,
    layout: QueueLayout,
    /// Open with automatic publication paused so tests drive it explicitly.
    #[cfg(test)]
    start_paused: bool,
    /// Per-search source-input budget for eventual pending overlays.
    eventual_search_budget: u64,
}

impl Default for IndexOperationQueueTuning {
    fn default() -> Self {
        Self {
            max_retained_bytes: NonZeroU64::new(DEFAULT_MAX_RETAINED_BYTES)
                .expect("default retained-byte limit is nonzero"),
            max_members: NonZeroU64::new(DEFAULT_MAX_MEMBERS)
                .expect("default member limit is nonzero"),
            max_operand_bytes: NonZeroU64::new(DEFAULT_MAX_OPERAND_BYTES)
                .expect("default operand limit is nonzero"),
            recovery_sweep_interval: DEFAULT_RECOVERY_SWEEP_INTERVAL,
            layout: QueueLayout::Map,
            #[cfg(test)]
            start_paused: false,
            eventual_search_budget: EVENTUAL_SEARCH_SOURCE_INPUT_BYTES,
        }
    }
}

impl IndexOperationQueueTuning {
    /// Largest accepted [retained-byte ceiling](Self::max_retained_bytes),
    /// about 2.27 GiB.
    ///
    /// Storage encodes a value's length in 32 bits, and one generation's
    /// queue value can hold, besides its outstanding operations, a 16-byte
    /// acknowledgement for each operation that was outstanding before it.
    /// A larger ceiling could let such a value outgrow that length.
    pub const MAX_RETAINED_BYTES: u64 =
        crate::encoding::v2::values::indexes::operation_queue::MAX_RETAINED_BYTES;

    /// Returns the retained-operation byte ceiling per logical index.
    pub const fn max_retained_bytes(self) -> NonZeroU64 {
        self.max_retained_bytes
    }

    /// Returns the distinct pending entity/generation member ceiling per logical index.
    pub const fn max_members(self) -> NonZeroU64 {
        self.max_members
    }

    /// Returns the requested ceiling for one transaction's operand per queue key.
    ///
    /// Open further clamps it to the configured write-ahead-log entry bound.
    pub const fn max_operand_bytes(self) -> NonZeroU64 {
        self.max_operand_bytes
    }

    /// Returns the periodic recovery sweep interval.
    pub const fn recovery_sweep_interval(self) -> Duration {
        self.recovery_sweep_interval
    }

    /// Returns the queue storage layout.
    pub const fn layout(self) -> QueueLayout {
        self.layout
    }

    /// Selects the queue storage layout (benchmark baseline: `Rows`).
    ///
    /// Test and `async-index-benchmark` builds only: product builds always
    /// run [`QueueLayout::Map`], so their handles cannot disagree on layout.
    #[cfg(any(test, feature = "async-index-benchmark"))]
    pub const fn with_layout(mut self, layout: QueueLayout) -> Self {
        self.layout = layout;
        self
    }

    /// Replaces the retained-operation byte ceiling; a ceiling above
    /// [`Self::MAX_RETAINED_BYTES`] is rejected.
    pub const fn with_max_retained_bytes(
        mut self,
        bytes: NonZeroU64,
    ) -> Result<Self, IndexOperationQueueTuningError> {
        if bytes.get() > Self::MAX_RETAINED_BYTES {
            return Err(
                IndexOperationQueueTuningError::RetainedBytesAboveQueueValueLimit {
                    requested: bytes.get(),
                },
            );
        }
        self.max_retained_bytes = bytes;
        Ok(self)
    }

    /// Replaces the distinct pending member ceiling.
    pub const fn with_max_members(mut self, members: NonZeroU64) -> Self {
        self.max_members = members;
        self
    }

    /// Replaces the per-transaction operand ceiling.
    pub const fn with_max_operand_bytes(mut self, bytes: NonZeroU64) -> Self {
        self.max_operand_bytes = bytes;
        self
    }

    /// Replaces the periodic recovery sweep interval.
    pub fn with_recovery_sweep_interval(
        mut self,
        interval: Duration,
    ) -> Result<Self, IndexOperationQueueTuningError> {
        if interval.is_zero() {
            return Err(IndexOperationQueueTuningError::ZeroRecoverySweepInterval);
        }
        self.recovery_sweep_interval = interval;
        Ok(self)
    }

    /// Opens with automatic publication paused so tests drive it explicitly.
    #[cfg(test)]
    pub(crate) const fn with_publication_paused_for_tests(mut self) -> Self {
        self.start_paused = true;
        self
    }

    /// Shrinks the eventual overlay budget so tests reach its boundary cheaply.
    #[cfg(test)]
    pub(crate) const fn with_eventual_search_budget_for_tests(mut self, bytes: u64) -> Self {
        self.eventual_search_budget = bytes;
        self
    }

    /// Returns the per-search eventual overlay budget (128 MiB outside tests).
    pub(crate) const fn eventual_search_budget(self) -> u64 {
        self.eventual_search_budget
    }

    /// Returns whether automatic publication starts paused.
    #[cfg(test)]
    pub(crate) const fn starts_paused(self) -> bool {
        self.start_paused
    }

    /// Returns the operand ceiling after applying the WAL replay entry bound.
    ///
    /// SlateDB writes one merged entry per key per transaction and rejects a
    /// WAL whose decoded block cannot fit half of the replay working memory
    /// (`min(max_inflight_bytes / 4, 64 MiB) / 2`). A single-entry block needs
    /// its encoded and decoded copies, so an operand must stay below a quarter
    /// of that working memory, less a small key/framing allowance.
    pub(crate) fn effective_operand_byte
```

### Core Architecture Module: `crates/db/src/config/secondary_index_lifecycle.rs`
```
//! Validated resource and scheduling policy for secondary lifecycle work.
//!
//! [`SecondaryIndexLifecycleTuning`] is the single user-facing source for bounded
//! secondary outbox discovery, source backfill, catch-up, final drain, and
//! cleanup execution. Every count, byte cap, and interval is positive by construction;
//! [`SecondaryIndexLifecycleWorkerMode`] represents manual versus background driving
//! without a parallel boolean. The database converts this policy into internal
//! transaction contracts when it runs one worker step.
//!
//! These values are runtime policy only. They are not serialized into physical
//! rows or canonical lifecycle records, so changing them does not change any
//! on-disk format.

use std::num::{NonZeroU64, NonZeroUsize};

const DEFAULT_BATCH_ROWS: usize = 1_024;
const DEFAULT_MAX_INPUT_BYTES: u64 = 8 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_OPERATIONS: u64 = 4_096;
const DEFAULT_MAX_OUTPUT_BYTES: u64 = 8 * 1024 * 1024;
const DEFAULT_FINAL_DRAIN_ENTITIES: u64 = 1_024;
const DEFAULT_RECONCILE_INPUT_BYTES: u64 = 1024 * 1024;
const DEFAULT_CATCH_UP_TAIL_DELAY_MILLIS: u64 = 1_000;
const DEFAULT_ACTIVE_INTERVAL_MILLIS: u64 = 10;
const DEFAULT_IDLE_INTERVAL_MILLIS: u64 = 1_000;

/// Whether secondary lifecycle work is scheduled automatically.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub enum SecondaryIndexLifecycleWorkerMode {
    /// Writer open starts a task and DDL wake-ups notify it.
    #[default]
    Enabled,
    /// Work advances only through the explicit one-step API.
    Disabled,
}

/// Positive maximum source entities admitted by one transaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SecondaryIndexLifecycleBatchRows(NonZeroUsize);

impl SecondaryIndexLifecycleBatchRows {
    /// Creates a positive entity limit, returning `None` for zero.
    pub const fn new(rows: usize) -> Option<Self> {
        match NonZeroUsize::new(rows) {
            Some(rows) => Some(Self(rows)),
            None => None,
        }
    }

    /// Returns the positive entity limit.
    pub const fn get(self) -> usize {
        self.0.get()
    }
}

/// Positive delay used to coalesce a non-full secondary catch-up tail.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SecondaryIndexLifecycleCatchUpTailDelayMillis(NonZeroU64);

impl SecondaryIndexLifecycleCatchUpTailDelayMillis {
    /// Creates a positive tail delay, returning `None` for zero.
    pub const fn new(milliseconds: u64) -> Option<Self> {
        match NonZeroU64::new(milliseconds) {
            Some(milliseconds) => Some(Self(milliseconds)),
            None => None,
        }
    }

    /// Returns the positive tail delay in milliseconds.
    pub const fn get(self) -> u64 {
        self.0.get()
    }
}

/// Positive delay between passes while a runnable job was observed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SecondaryIndexLifecycleActiveIntervalMillis(NonZeroU64);

impl SecondaryIndexLifecycleActiveIntervalMillis {
    /// Creates a positive active delay, returning `None` for zero.
    pub const fn new(milliseconds: u64) -> Option<Self> {
        match NonZeroU64::new(milliseconds) {
            Some(milliseconds) => Some(Self(milliseconds)),
            None => None,
        }
    }

    /// Returns the active delay in milliseconds.
    pub const fn get(self) -> u64 {
        self.0.get()
    }
}

/// Positive polling delay after a complete job scan found no runnable work.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SecondaryIndexLifecycleIdleIntervalMillis(NonZeroU64);

impl SecondaryIndexLifecycleIdleIntervalMillis {
    /// Creates a positive idle delay, returning `None` for zero.
    pub const fn new(milliseconds: u64) -> Option<Self> {
        match NonZeroU64::new(milliseconds) {
            Some(milliseconds) => Some(Self(milliseconds)),
            None => None,
        }
    }

    /// Returns the idle delay in milliseconds.
    pub const fn get(self) -> u64 {
        self.0.get()
    }
}

/// Complete positive budgets and timing for secondary lifecycle execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SecondaryIndexLifecycleTuning {
    worker_mode: SecondaryIndexLifecycleWorkerMode,
    batch_rows: SecondaryIndexLifecycleBatchRows,
    max_input_bytes: NonZeroU64,
    max_output_operations: NonZeroU64,
    max_output_bytes: NonZeroU64,
    final_drain_entities: NonZeroU64,
    reconcile_input_bytes: NonZeroU64,
    catch_up_tail_delay_millis: SecondaryIndexLifecycleCatchUpTailDelayMillis,
    active_interval_millis: SecondaryIndexLifecycleActiveIntervalMillis,
    idle_interval_millis: SecondaryIndexLifecycleIdleIntervalMillis,
}

impl SecondaryIndexLifecycleTuning {
    /// Returns whether writer-open should start the background task.
    pub const fn worker_mode(self) -> SecondaryIndexLifecycleWorkerMode {
        self.worker_mode
    }

    /// Returns the maximum entities admitted by one batch or cleanup page.
    pub const fn batch_rows(self) -> SecondaryIndexLifecycleBatchRows {
        self.batch_rows
    }

    /// Returns the exact decoded-input cap for one executor transaction.
    pub const fn max_input_bytes(self) -> NonZeroU64 {
        self.max_input_bytes
    }

    /// Returns the maximum puts/deletes staged by one transaction.
    pub const fn max_output_operations(self) -> NonZeroU64 {
        self.max_output_operations
    }

    /// Returns the exact encoded-output cap for one transaction and entity.
    pub const fn max_output_bytes(self) -> NonZeroU64 {
        self.max_output_bytes
    }

    /// Returns the maximum delta entities admitted under the exclusive gate.
    pub const fn final_drain_entities(self) -> NonZeroU64 {
        self.final_drain_entities
    }

    /// Returns the operation and checkpoint bytes decoded by one reconciliation call.
    pub const fn reconcile_input_bytes(self) -> NonZeroU64 {
        self.reconcile_input_bytes
    }

    /// Returns the delay used to coalesce an exhausted live catch-up tail.
    pub const fn catch_up_tail_delay_millis(self) -> SecondaryIndexLifecycleCatchUpTailDelayMillis {
        self.catch_up_tail_delay_millis
    }

    /// Returns the delay between passes while a runnable job exists.
    pub const fn active_interval_millis(self) -> SecondaryIndexLifecycleActiveIntervalMillis {
        self.active_interval_millis
    }

    /// Returns the polling delay after a complete scan finds no runnable job.
    pub const fn idle_interval_millis(self) -> SecondaryIndexLifecycleIdleIntervalMillis {
        self.idle_interval_millis
    }

    /// Replaces automatic/manual scheduling mode without changing budgets.
    pub const fn with_worker_mode(mut self, mode: SecondaryIndexLifecycleWorkerMode) -> Self {
        self.worker_mode = mode;
        self
    }

    /// Replaces the positive per-transaction entity cap.
    pub const fn with_batch_rows(mut self, rows: SecondaryIndexLifecycleBatchRows) -> Self {
        self.batch_rows = rows;
        self
    }

    /// Replaces the positive decoded-input cap.
    pub const fn with_max_input_bytes(mut self, bytes: NonZeroU64) -> Self {
        self.max_input_bytes = bytes;
        self
    }

    /// Replaces the positive output-operation cap.
    pub const fn with_max_output_operations(mut self, operations: NonZeroU64) -> Self {
        self.max_output_operations = operations;
        self
    }

    /// Replaces the positive transaction and single-entity output-byte cap.
    pub const fn with_max_output_bytes(mut self, bytes: NonZeroU64) -> Self {
        self.max_output_bytes = bytes;
        self
    }

    /// Replaces the positive exclusive final-drain entity cap.
    pub const fn with_final_drain_entities(mut self, entities: NonZeroU64) -> Self {
        self.final_drain_entities = entities;
        self
    }

    /// Replaces the positive reconciliation decoded-input cap.
    pub const fn with_reconcile_input_bytes(mut self, bytes: NonZeroU64) -> Self {
        self.reconcile_input_bytes = bytes;
        self
    }

    /// Replaces the positive catch-up tail coalescing delay.
    pub const fn with_catch_up_tail_delay_millis(
        mut self,
        delay: SecondaryIndexLifecycleCatchUpTailDelayMillis,
    ) -> Self {
        self.catch_up_tail_delay_millis = delay;
        self
    }

    /// Replaces the positive delay between active passes.
    pub const fn with_active_interval_millis(
        mut self,
        interval: SecondaryIndexLifecycleActiveIntervalMillis,
    ) -> Self {
        self.active_interval_millis = interval;
        self
    }

    /// Replaces the positive delay after an exhausted scan.
    pub const fn with_idle_interval_millis(
        mut self,
        interval: SecondaryIndexLifecycleIdleIntervalMillis,
    ) -> Self {
        self.idle_interval_millis = interval;
        self
    }
}

impl Default for SecondaryIndexLifecycleTuning {
    fn default() -> Self {
        Self {
            worker_mode: SecondaryIndexLifecycleWorkerMode::Enabled,
            batch_rows: SecondaryIndexLifecycleBatchRows::new(DEFAULT_BATCH_ROWS)
                .expect("default batch rows are positive"),
            max_input_bytes: NonZeroU64::new(DEFAULT_MAX_INPUT_BYTES)
                .expect("default input bytes are positive"),
            max_output_operations: NonZeroU64::new(DEFAULT_MAX_OUTPUT_OPERATIONS)
                .expect("default output operations are positive"),
            max_output_bytes: NonZeroU64::new(DEFAULT_MAX_OUTPUT_BYTES)
                .expect("default output bytes are positive"),
            final_drain_entities: NonZeroU64::new(DEFAULT_FINAL_DRAIN_ENTITIES)
                .expect("default final drain is positive"),
            reconcile_input_bytes: NonZeroU64::new(DEFAULT_RECONCILE_INPUT_BYTES)
                .expect("default reconcile bytes are positive"),
            catch_up_tail_delay_millis: SecondaryIndexLifecycleCatchUpTailDelayMil
```

### Core Architecture Module: `crates/db/src/config/utils.rs`
```
use std::fmt;
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};

/// Configuration construction and parsing error.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigError {
    message: String,
}

impl ConfigError {
    pub(crate) fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl fmt::Display for ConfigError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for ConfigError {}

/// Result type for checked configuration construction.
pub type ConfigResult<T> = std::result::Result<T, ConfigError>;

/// Path wrapper for cache settings that must point at a concrete directory.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NonEmptyPathBuf {
    path: PathBuf,
}

impl NonEmptyPathBuf {
    /// Build a non-empty path.
    ///
    /// ```
    /// # use db::config::NonEmptyPathBuf;
    /// assert!(NonEmptyPathBuf::try_new("/tmp/cache").is_ok());
    /// assert!(NonEmptyPathBuf::try_new("").is_err());
    /// ```
    pub fn try_new(path: impl Into<PathBuf>) -> ConfigResult<Self> {
        let path = path.into();
        if path.as_os_str().is_empty() {
            Err(ConfigError::new("cache path cannot be empty"))
        } else {
            Ok(Self { path })
        }
    }

    /// Borrow the underlying path.
    pub fn as_path(&self) -> &Path {
        self.path.as_path()
    }

    /// Clone the underlying path buffer.
    pub fn to_path_buf(&self) -> PathBuf {
        self.path.clone()
    }
}

impl TryFrom<PathBuf> for NonEmptyPathBuf {
    type Error = ConfigError;

    fn try_from(path: PathBuf) -> ConfigResult<Self> {
        Self::try_new(path)
    }
}

impl From<NonEmptyPathBuf> for PathBuf {
    fn from(path: NonEmptyPathBuf) -> Self {
        path.path
    }
}

/// Disk cache backing with a required path and positive byte capacity.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiskCacheConfig {
    root: NonEmptyPathBuf,
    bytes: NonZeroUsize,
}

impl DiskCacheConfig {
    /// Build disk cache settings, rejecting empty paths and zero capacity.
    pub fn try_new(root: impl Into<PathBuf>, bytes: usize) -> ConfigResult<Self> {
        Ok(Self {
            root: NonEmptyPathBuf::try_new(root)?,
            bytes: NonZeroUsize::new(bytes)
                .ok_or_else(|| ConfigError::new("disk cache capacity must be nonzero"))?,
        })
    }

    /// Cache root directory.
    pub fn root(&self) -> &Path {
        self.root.as_path()
    }

    /// Cache capacity in bytes.
    pub const fn bytes(&self) -> usize {
        self.bytes.get()
    }
}

```

### Core Architecture Module: `crates/db/src/encoding/v2/keys/lifecycle.rs`
```
//! Scoped catalog, operation, build-delta, applied-state, and queue keys.

use crate::index_lifecycle::{
    IndexElementKind, IndexEntityId, IndexGenerationId, IndexId, IndexIdentity, IndexOperationId,
};

/// Entity identity used by build-delta and applied-state keys.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub(crate) struct IndexEntity {
    pub(crate) kind: IndexElementKind,
    pub(crate) id: IndexEntityId,
}

/// Canonical catalog-record key.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct IndexRecordKey {
    pub(crate) identity: IndexIdentity,
}

/// Scoped operation record key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) struct IndexOperationKey {
    pub(crate) operation_id: IndexOperationId,
}

/// Coalesced build delta or builder-applied state key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) struct IndexEntityStateKey {
    pub(crate) index_id: IndexId,
    pub(crate) generation: IndexGenerationId,
    pub(crate) entity: IndexEntity,
}

/// Directly addressable immutable index-operation queue for one generation.
///
/// Scope comes from the physical key envelope, so one key names exactly one
/// `(scope, logical index, generation)` queue. An absent key is an empty queue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) struct IndexOperationQueueKey {
    pub(crate) index_id: IndexId,
    pub(crate) generation: IndexGenerationId,
}

/// One immutable index operation stored as its own row.
///
/// Row-layout queues (the benchmark baseline) key each operation by a
/// writer-allocated sequence, so a generation prefix scan returns operations
/// in enqueue order. An absent row is an acknowledged operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) struct IndexOperationRowKey {
    pub(crate) index_id: IndexId,
    pub(crate) generation: IndexGenerationId,
    pub(crate) sequence: u64,
}

```

### Core Architecture Module: `crates/db/src/encoding/v2/legacy/text/live_state.rs`
```
//! Retired per-entity text live-state JSON format.

use bytes::Bytes;

use crate::search::text::TextIndexLiveState;

#[derive(Debug, thiserror::Error)]
#[error("legacy text live-state JSON failed: {0}")]
pub(crate) struct LegacyTextLiveStateError(serde_json::Error);

/// Encodes the retired row format for the retained public compatibility API.
pub(crate) fn encode_for_retained_api(
    state: &TextIndexLiveState,
) -> Result<Bytes, LegacyTextLiveStateError> {
    serde_json::to_vec(state)
        .map(Bytes::from)
        .map_err(LegacyTextLiveStateError)
}

pub(crate) fn decode(data: &[u8]) -> Result<TextIndexLiveState, LegacyTextLiveStateError> {
    serde_json::from_slice(data).map_err(LegacyTextLiveStateError)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn live_state_json_is_frozen() {
        let state = TextIndexLiveState::dead(9);
        let encoded = encode_for_retained_api(&state).unwrap();
        assert_eq!(encoded.as_ref(), br#"{"logical_version":9,"live":false}"#);
        assert_eq!(decode(&encoded).unwrap(), state);
        assert!(decode(&encoded[..encoded.len() - 1]).is_err());
        assert!(decode(&[encoded.as_ref(), b"x"].concat()).is_err());
    }
}

```

### Core Architecture Module: `crates/db/src/encoding/v2/values/indexes/operation_queue/algebra.rs`
```
//! Associative merge algebra over raw queue values.
//!
//! Each operation ID moves through a closed per-ID state machine:
//!
//! | earlier state        | later record          | composed state          |
//! |----------------------|-----------------------|-------------------------|
//! | unseen               | remove                | removed                 |
//! | unseen               | insert (mode `m`)     | insert `m`, new position|
//! | removed              | remove                | removed                 |
//! | removed              | insert (any mode)     | set, new position       |
//! | insert-if-absent     | remove                | unseen                  |
//! | set                  | remove                | removed                 |
//! | insert               | insert-if-absent      | unchanged               |
//! | insert               | set                   | set, new position       |
//!
//! A removal only ever names one ID, so acknowledging an older operation can
//! never erase a newer operation. Remove-then-insert composes to an
//! unconditional set, so an unresolved older base cannot defeat the reset.
//! Resolving against a known base drops removals and turns surviving sets
//! into ordinary retained entries.
//!
//! # Acknowledgements cancel their own enqueue
//!
//! An insert-if-absent followed by a removal of the same ID composes to
//! *unseen*: the pair leaves nothing behind, even without a base. This keeps
//! unresolved values bounded no matter how long SlateDB defers resolving
//! them against the bottom run. A removal survives a partial composition only
//! while its insert lies below it, so each one names an operation that was
//! outstanding just before the composition's oldest operand, and each live
//! insert names one still outstanding after its newest: a value holds at
//! most one removal per operation of the earlier backlog plus the later
//! backlog's records. [`super::MAX_RETAINED_BYTES`] keeps that within
//! SlateDB's value length.
//!
//! Cancelling is exact on the histories storage can present, in which each
//! operation ID is inserted by exactly one committed operand that appears
//! once in any view, and is removed at most once, after that operand:
//!
//! - producers mint a fresh random ID for every operation of every
//!   transaction attempt, and SlateDB commits a staged operand at most once;
//!   only the publication worker removes IDs, and only IDs it read from the
//!   queue, so every removal follows its insert;
//! - SlateDB applies every committed operand exactly once in every view: its
//!   merge contract requires associativity but not idempotence (additive
//!   counters are valid operators, and Helix's metadata counters already
//!   depend on that). Concretely, WAL replay in writers and readers skips
//!   every entry at or below `last_l0_seq`, a flush swaps its memtable for
//!   its L0 under one state lock, and compactions replace their sources
//!   atomically, so no view holds two copies of one committed operand.
//!
//! Under those histories a composition that holds an ID's insert holds its
//! only insert, so nothing below can resurrect it once the pair cancels, and
//! every grouping resolves to the same queue. Outside them (a re-enqueued or
//! duplicated insert below its own cancelled acknowledgement) the composition
//! stays total and deterministic but may keep the lower copy.
//!
//! Nothing weaker can bound removals: a partial merge cannot see whether
//! another copy of an insert lies below it, so forgetting a removal is exact
//! only where no copy can, and writing a resolved base instead would race the
//! blind enqueues it must not shadow.

use std::collections::{BTreeSet, HashMap};

use bytes::{BufMut, Bytes};

use crate::encoding::error::EncodingError;

use super::{
    put_header, put_varint, Cursor, QueueFamily, QueuedOperationId, F32_LEN, HEADER_LEN,
    MAX_PARTITION_LEN, MODE_LEN, OPERATION_ID_LEN, QUEUE_VALUE_KIND, QUEUE_VALUE_VERSION,
};

/// Whether an insert record is conditional on its ID being absent.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum InsertMode {
    /// Insert only when the ID is absent; a present ID keeps its bytes.
    IfAbsent = 0x01,
    /// Remove any existing entry for the ID and append this one.
    Set = 0x02,
}

/// One insert record borrowed from an encoded value.
#[derive(Debug, Clone, Copy)]
pub(super) struct RawInsert<'a> {
    pub(super) mode: InsertMode,
    pub(super) id: QueuedOperationId,
    pub(super) body: &'a [u8],
}

/// Structurally validated view over one encoded queue value.
#[derive(Debug)]
pub(super) struct RawValue<'a> {
    pub(super) family: QueueFamily,
    pub(super) removes: Vec<QueuedOperationId>,
    pub(super) inserts: Vec<RawInsert<'a>>,
}

impl<'a> RawValue<'a> {
    /// Parses and validates every record without resolving any other value.
    ///
    /// A value with no records is the composition's identity: a partial
    /// merge whose acknowledgements cancelled every insert it held.
    pub(super) fn parse(value: &'a [u8]) -> Result<Self, EncodingError> {
        let (family, mut cursor) = parse_header(value)?;

        let remove_count = bounded_count(&mut cursor, OPERATION_ID_LEN)?;
        let mut removes = Vec::with_capacity(remove_count);
        for _ in 0..remove_count {
            let id = cursor.take_operation_id()?;
            if removes.last().is_some_and(|previous| *previous >= id) {
                return Err(EncodingError::Custom(
                    "queued removals are not strictly ascending".to_string(),
                ));
            }
            removes.push(id);
        }

        let insert_count = bounded_count(&mut cursor, MODE_LEN + OPERATION_ID_LEN + 1)?;
        let mut inserts = Vec::with_capacity(insert_count);
        let mut insert_ids = std::collections::HashSet::with_capacity(insert_count);
        for _ in 0..insert_count {
            let mode = InsertMode::try_from_u8(cursor.take_u8()?)?;
            let id = cursor.take_operation_id()?;
            if removes.binary_search(&id).is_ok() {
                return Err(EncodingError::Custom(
                    "queued value both removes and inserts one operation ID".to_string(),
                ));
            }
            if !insert_ids.insert(id) {
                return Err(EncodingError::Custom(
                    "queued value inserts one operation ID twice".to_string(),
                ));
            }
            let body_len = usize::try_from(cursor.take_varint()?)
                .map_err(|_| EncodingError::Custom("queued body length overflows".to_string()))?;
            let body = cursor.take_raw(body_len)?;
            validate_body(family, body)?;
            inserts.push(RawInsert { mode, id, body });
        }
        cursor.finish("operation queue value")?;
        Ok(Self {
            family,
            removes,
            inserts,
        })
    }
}

impl InsertMode {
    pub(super) fn try_from_u8(value: u8) -> Result<Self, EncodingError> {
        match value {
            0x01 => Ok(Self::IfAbsent),
            0x02 => Ok(Self::Set),
            unknown => Err(EncodingError::Custom(format!(
                "unknown queued insert mode {unknown:#04x}"
            ))),
        }
    }
}

/// Validates the version, kind, and family header and returns the family
/// and a cursor positioned at the removal count.
pub(super) fn parse_header(value: &[u8]) -> Result<(QueueFamily, Cursor<'_>), EncodingError> {
    const VERSION_OFFSET: usize = 0;
    const KIND_OFFSET: usize = VERSION_OFFSET + core::mem::size_of::<u8>();
    const FAMILY_OFFSET: usize = KIND_OFFSET + core::mem::size_of::<u8>();
    if value.len() < HEADER_LEN {
        return Err(EncodingError::BufferTooShort {
            expected: HEADER_LEN,
            actual: value.len(),
        });
    }
    if value[VERSION_OFFSET] != QUEUE_VALUE_VERSION {
        return Err(EncodingError::Custom(format!(
            "unsupported operation queue value version {:#04x}",
            value[VERSION_OFFSET]
        )));
    }
    if value[KIND_OFFSET] != QUEUE_VALUE_KIND {
        return Err(EncodingError::UnexpectedValueKind {
            expected: QUEUE_VALUE_KIND,
            actual: value[KIND_OFFSET],
        });
    }
    let family = QueueFamily::try_from_u8(value[FAMILY_OFFSET])?;
    Ok((family, Cursor::new(&value[HEADER_LEN..])))
}

/// Reads a count and rejects one that cannot fit in the remaining bytes.
pub(super) fn bounded_count(
    cursor: &mut Cursor<'_>,
    minimum_record_len: usize,
) -> Result<usize, EncodingError> {
    let count = usize::try_from(cursor.take_varint()?)
        .map_err(|_| EncodingError::Custom("queued record count overflows".to_string()))?;
    if count > cursor.remaining_len() / minimum_record_len {
        return Err(EncodingError::BufferTooShort {
            expected: count.saturating_mul(minimum_record_len),
            actual: cursor.remaining_len(),
        });
    }
    Ok(count)
}

/// Validates one insert body without allocating its decoded payload.
fn validate_body(family: QueueFamily, body: &[u8]) -> Result<(), EncodingError> {
    let mut cursor = Cursor::new(body);
    match cursor.take_u8()? {
        0x01 | 0x02 => {}
        unknown => {
            return Err(EncodingError::Custom(format!(
                "unknown queued entity kind {unknown:#04x}"
            )));
        }
    }
    cursor.take_varint()?;
    match family {
        QueueFamily::Vector => {
            match cursor.take_u8()? {
                0x00 => {}
                tag => skip_partition_body(&mut cursor, tag)?,
            }
            match cursor.take_u8()? {
                0x00 => {}
                0x01 => {
                    let tag = cursor.take_u8()?;
                    skip_partition_body(&mut cursor, tag)?;
                    let dimension = usize::try_from(cursor.take_varint()?).map_err(|_| {
                        EncodingError::C
```

### Core Architecture Module: `crates/db/src/encoding/v2/values/indexes/operation_queue/mod.rs`
```
//! Immutable vector/text index-operation queue values.
//!
//! One SlateDB key per `(scope, logical index, generation)` holds every
//! committed-but-unpublished operation for that generation. Producers append
//! with blind [`slatedb::DbTransaction::merge_disjoint_tokens`] operands and the
//! publication worker removes exact operation IDs with acknowledgement
//! operands. Neither side reads the row to stage its operand.
//!
//! # Persisted format
//!
//! Every operand, partial merge result, and resolved value shares one
//! canonical layout:
//!
//! ```text
//! value      := version:u8(0x01) kind:u8(0x14) family:u8 removes inserts
//! family     := 0x01 vector | 0x02 text
//! removes    := count:varint operation_id{count}        (strictly ascending)
//! inserts    := count:varint insert{count}              (storage commit order)
//! insert     := mode:u8 operation_id body_len:varint body
//! mode       := 0x01 insert-if-absent | 0x02 unconditional set
//! operation_id := 16 bytes, big-endian u128 with bit 127 clear
//! body       := entity_kind:u8 entity_id:varint payload
//! payload    := vector_payload | text_payload           (selected by family)
//! vector_payload := previous:optional_partition replacement:vector_replacement
//! vector_replacement := 0x00 | 0x01 partition dimension:varint f32_be{dimension}
//! text_payload := 0x00 | 0x01 partition length:varint utf8{length}
//! optional_partition := 0x00 | partition
//! partition  := 0x01 unpartitioned | 0x02 length:varint tenant_bytes{length}
//! ```
//!
//! Varints are minimal unsigned LEB128. Each operation ID appears at most once
//! per value, and an operation ID never appears both as a removal and an
//! insert. A value resolved against a known base contains only
//! insert-if-absent records; an empty resolved queue is a SlateDB tombstone,
//! so an absent key is the empty queue. A partial merge result may hold no
//! records at all (both counts zero) when every acknowledgement it composed
//! cancelled its own enqueue; it is the identity of composition and is never
//! a resolved value.
//!
//! Relative insert order is storage commit order. Producers serialize enqueue
//! operations for one entity with a per-entity conflict token, so one
//! entity's operations appear in exactly the order their transactions
//! committed. Different entities have no global order.
//!
//! # Row layout (benchmark baseline)
//!
//! The row-per-operation layout stores each operation under its own
//! sequence-ordered key and acknowledges it by deleting that key:
//!
//! ```text
//! row := version:u8(0x01) kind:u8(0x15) family:u8 operation_id body
//! ```
//!
//! Both layouts decode into the same [`OperationQueue`], so workers and
//! overlays are identical; only storage and acknowledgement differ.

mod algebra;
#[cfg(test)]
mod tests;

use std::sync::Arc;

use bytes::{BufMut, Bytes};

use crate::encoding::error::EncodingError;
use crate::encoding::v2::keys::IndexEntity;
use crate::index_lifecycle::work::TextPartition;
use crate::index_lifecycle::{IndexElementKind, IndexEntityId};

#[cfg(test)]
pub(crate) use algebra::validate_operand;
pub(crate) use algebra::{merge_partial, merge_with_base, QueueMergeResult};

/// Frozen framing version for queue values.
const QUEUE_VALUE_VERSION: u8 = 0x01;
/// Value kind mirrors the key's `RecordKind::IndexOperationQueue` byte.
pub(crate) const QUEUE_VALUE_KIND: u8 = 0x14;
/// Row value kind mirrors the key's `RecordKind::IndexOperationRow` byte.
const ROW_VALUE_KIND: u8 = 0x15;
const VERSION_LEN: usize = core::mem::size_of::<u8>();
const KIND_LEN: usize = core::mem::size_of::<u8>();
const FAMILY_LEN: usize = core::mem::size_of::<u8>();
const MODE_LEN: usize = core::mem::size_of::<u8>();
/// Encoded operation-ID width.
pub(crate) const OPERATION_ID_LEN: usize = core::mem::size_of::<u128>();
const HEADER_LEN: usize = VERSION_LEN + KIND_LEN + FAMILY_LEN;
const F32_LEN: usize = core::mem::size_of::<f32>();
const MAX_VARINT_LEN: usize = 10;
/// Largest tenant partition accepted by canonical partitions.
const MAX_PARTITION_LEN: usize = 16 * 1024 * 1024;
const OPERATION_TOKEN_BIT: u128 = 1 << 127;
/// Smallest record an operation retains: mode, identity, a one-byte body
/// length, and a text deletion of an entity whose ID is one varint byte
/// (entity kind, ID, absent replacement). A vector deletion adds an absent
/// previous partition.
const MIN_RETAINED_RECORD_LEN: usize = MODE_LEN + OPERATION_ID_LEN + 1 + 3;
/// Upper bound on the bytes of a value that are not records: the header and
/// both counts.
const MAX_VALUE_FRAMING_LEN: usize = HEADER_LEN + 2 * MAX_VARINT_LEN;

/// Largest per-index retained-operation ceiling whose queue values SlateDB
/// can store.
///
/// SlateDB encodes a stored value's length as a `u32`, and a longer merge
/// result written by a flush or compaction is truncated, corrupting its
/// table. Admission keeps the retained bytes of a generation's outstanding
/// operations within the ceiling `R`, which bounds a resolved value. An
/// unresolved value also keeps one [`OPERATION_ID_LEN`]-byte removal per
/// operation that was outstanding before its oldest operand (see the
/// cancellation contract in `algebra`), and every operation retains at least
/// `MIN_RETAINED_RECORD_LEN` bytes, so no value exceeds
/// `MAX_VALUE_FRAMING_LEN + OPERATION_ID_LEN * (R / MIN_RETAINED_RECORD_LEN) + R`.
/// This is the largest `R` for which that fits a `u32`.
pub(crate) const MAX_RETAINED_BYTES: u64 = (u32::MAX as u64 - MAX_VALUE_FRAMING_LEN as u64)
    * MIN_RETAINED_RECORD_LEN as u64
    / (MIN_RETAINED_RECORD_LEN + OPERATION_ID_LEN) as u64;

/// Unique immutable identity of one queued operation.
///
/// Bit 127 is always clear so operation tokens and entity enqueue-order tokens
/// occupy disjoint halves of SlateDB's `u128` token space.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub(crate) struct QueuedOperationId(u128);

impl QueuedOperationId {
    /// Generates a fresh random identity that is never reused by a producer.
    pub(crate) fn generate() -> Self {
        Self(uuid::Uuid::new_v4().as_u128() & !OPERATION_TOKEN_BIT)
    }

    /// Validates a decoded identity.
    pub(crate) fn try_from_u128(value: u128) -> Result<Self, EncodingError> {
        if value & OPERATION_TOKEN_BIT != 0 {
            return Err(EncodingError::Custom(
                "queued operation ID uses the reserved entity-token bit".to_string(),
            ));
        }
        Ok(Self(value))
    }

    /// Returns the raw identity.
    pub(crate) const fn get(self) -> u128 {
        self.0
    }

    /// Returns the disjoint-merge token owned by exactly this operation.
    pub(crate) const fn token(self) -> u128 {
        self.0
    }

    fn to_be_bytes(self) -> [u8; OPERATION_ID_LEN] {
        self.0.to_be_bytes()
    }
}

/// Returns the stable per-entity enqueue-order token.
///
/// Every enqueue for the same entity carries this token, so competing
/// enqueues conflict and retry instead of committing in an ambiguous order.
/// Acknowledgements never carry it.
pub(crate) const fn entity_enqueue_token(entity: IndexEntity) -> u128 {
    OPERATION_TOKEN_BIT | ((entity.kind as u128) << 64) | entity.id.get() as u128
}

/// Index family whose payloads a queue retains.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum QueueFamily {
    /// Vector operations.
    Vector = 0x01,
    /// Text operations.
    Text = 0x02,
}

impl QueueFamily {
    fn try_from_u8(value: u8) -> Result<Self, EncodingError> {
        match value {
            0x01 => Ok(Self::Vector),
            0x02 => Ok(Self::Text),
            unknown => Err(EncodingError::Custom(format!(
                "unknown queued operation family {unknown:#04x}"
            ))),
        }
    }
}

/// Destination state of one vector operation.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct QueuedVectorReplacement {
    partition: TextPartition,
    vector: Arc<[f32]>,
}

impl QueuedVectorReplacement {
    /// Accepts a non-empty finite vector already validated by its index metric.
    pub(crate) fn try_new(
        partition: TextPartition,
        vector: Arc<[f32]>,
    ) -> Result<Self, EncodingError> {
        if vector.is_empty() {
            return Err(EncodingError::Custom(
                "queued vector replacement must not be empty".to_string(),
            ));
        }
        if let Some(index) = vector.iter().position(|value| !value.is_finite()) {
            return Err(EncodingError::Custom(format!(
                "queued vector component {index} is not finite"
            )));
        }
        Ok(Self { partition, vector })
    }

    /// Returns the destination partition.
    pub(crate) const fn partition(&self) -> &TextPartition {
        &self.partition
    }

    /// Returns the exact queued vector components.
    pub(crate) fn vector(&self) -> &[f32] {
        &self.vector
    }

    /// Shares the exact queued vector components without copying them.
    pub(crate) fn shared_vector(&self) -> Arc<[f32]> {
        Arc::clone(&self.vector)
    }
}

/// Complete vector operation: previous routing plus optional replacement.
///
/// `previous` is the partition the committed graph state was indexed under
/// immediately before this operation. `None` replacement is a deletion.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct QueuedVectorPayload {
    pub(crate) previous: Option<TextPartition>,
    pub(crate) replacement: Option<QueuedVectorReplacement>,
}

/// Destination state of one text operation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct QueuedTextReplacement {
    partition: TextPartition,
    text: Arc<str>,
}

impl QueuedTextReplacement {
    /// Accepts the exact normalized text projected by the index definition.
    pub(crate) const fn new(partition: TextPartition, text: Arc<str>) -> Self {
        Self { partition, text }
    }

    /// Returns the destination partition.
    pub(crate) c
```

### Core Architecture Module: `crates/db/src/encoding/v2/values/lifecycle/common.rs`
```
//! Shared lifecycle value discriminators.

pub(crate) const INDEX_RECORD_KIND: u8 = 0x01;
pub(crate) const OPERATION_RECORD_KIND: u8 = 0x02;
pub(crate) const BUILD_DELTA_KIND: u8 = 0x03;
pub(crate) const APPLIED_STATE_KIND: u8 = 0x04;

```

### Core Architecture Module: `crates/db/src/encoding/v2/values/lifecycle/entity_state.rs`
```
//! Lifecycle entity-state values.

//! Canonical metadata, logical index-record, and operation codecs.

use bytes::Bytes;

use crate::encoding::error::EncodingError;
use crate::index_lifecycle::work::{
    AppliedEntityStateValue, AppliedFamilyState, CoalescedBuildDeltaState, CoalescedBuildDeltaValue,
};

use super::*;

pub(crate) fn encode_build_delta(value: &CoalescedBuildDeltaValue) -> Bytes {
    let mut encoder = ValueEncoder::with_header(BUILD_DELTA_KIND);
    put_index_id(&mut encoder, value.index_id);
    put_generation(&mut encoder, value.generation);
    put_element_kind(&mut encoder, value.entity_kind);
    encoder.put_u64(value.entity_id.get());
    match &value.state {
        CoalescedBuildDeltaState::Marker => {}
        CoalescedBuildDeltaState::SecondaryBefore(previous) => {
            encoder.put_u8(0x01);
            put_option(&mut encoder, previous.as_ref(), put_secondary_value);
        }
        CoalescedBuildDeltaState::VectorBefore(previous) => {
            encoder.put_u8(0x02);
            put_option(&mut encoder, previous.as_ref(), put_partition);
        }
    }
    encoder.finish()
}

pub(crate) fn decode_build_delta(value: &[u8]) -> Result<CoalescedBuildDeltaValue, EncodingError> {
    let mut decoder = ValueDecoder::new(value)?;
    if decoder.kind() != BUILD_DELTA_KIND {
        return Err(EncodingError::UnexpectedValueKind {
            expected: BUILD_DELTA_KIND,
            actual: decoder.kind(),
        });
    }
    let index_id = take_index_id(&mut decoder)?;
    let generation = take_generation(&mut decoder)?;
    let entity_kind = take_element_kind(&mut decoder)?;
    let entity_id = crate::index_lifecycle::IndexEntityId::new(decoder.take_u64()?);
    let state = if decoder.is_finished() {
        CoalescedBuildDeltaState::Marker
    } else {
        match decoder.take_u8()? {
            0x01 => CoalescedBuildDeltaState::SecondaryBefore(
                decoder.take_option(take_secondary_value)?,
            ),
            0x02 => CoalescedBuildDeltaState::VectorBefore(decoder.take_option(take_partition)?),
            unknown => return Err(unknown_discriminant("build-delta family state", unknown)),
        }
    };
    let decoded = CoalescedBuildDeltaValue {
        index_id,
        generation,
        entity_kind,
        entity_id,
        state,
    };
    decoder.finish()?;
    Ok(decoded)
}

pub(crate) fn encode_applied_state(value: &AppliedEntityStateValue) -> Bytes {
    let mut encoder = ValueEncoder::with_header(APPLIED_STATE_KIND);
    put_index_id(&mut encoder, value.index_id);
    put_generation(&mut encoder, value.generation);
    put_element_kind(&mut encoder, value.entity_kind);
    encoder.put_u64(value.entity_id.get());
    match &value.state {
        AppliedFamilyState::Secondary(state) => {
            encoder.put_u8(0x01);
            put_option(&mut encoder, state.as_ref(), put_secondary_value);
        }
        AppliedFamilyState::Vector(state) => {
            encoder.put_u8(0x02);
            put_option(&mut encoder, state.as_ref(), put_partition);
        }
        AppliedFamilyState::Text(state) => {
            encoder.put_u8(0x03);
            put_option(&mut encoder, state.as_ref(), |encoder, state| {
                put_partition(encoder, &state.0);
                encoder.put_u64(state.1.get());
            });
        }
    }
    encoder.finish()
}

pub(crate) fn decode_applied_state(value: &[u8]) -> Result<AppliedEntityStateValue, EncodingError> {
    let mut decoder = ValueDecoder::new(value)?;
    if decoder.kind() != APPLIED_STATE_KIND {
        return Err(EncodingError::UnexpectedValueKind {
            expected: APPLIED_STATE_KIND,
            actual: decoder.kind(),
        });
    }
    let index_id = take_index_id(&mut decoder)?;
    let generation = take_generation(&mut decoder)?;
    let entity_kind = take_element_kind(&mut decoder)?;
    let entity_id = crate::index_lifecycle::IndexEntityId::new(decoder.take_u64()?);
    let state = match decoder.take_u8()? {
        0x01 => AppliedFamilyState::Secondary(decoder.take_option(take_secondary_value)?),
        0x02 => AppliedFamilyState::Vector(decoder.take_option(take_partition)?),
        0x03 => AppliedFamilyState::Text(decoder.take_option(|decoder| {
            Ok((take_partition(decoder)?, take_logical_version(decoder)?))
        })?),
        unknown => return Err(unknown_discriminant("applied-state family", unknown)),
    };
    decoder.finish()?;
    Ok(AppliedEntityStateValue {
        index_id,
        generation,
        entity_kind,
        entity_id,
        state,
    })
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #944** (2026-07-08): **[Bug]: helix update installs wrong version**
  *Symptoms*: ### What happened?  ```bash PS C:\web projects\my-helix-app> helix update    Updating 'CLI'   ✓ Checked for updates (v3.0.6 -> v3.0.7)   ⠸ Downloading and installing   ✓ Downloaded and installed  Updated 'CLI' successfully ────────────────────────────────   • Note: Please restart your terminal to use the new version PS C:\web projects\my-helix-app> helix --version Helix CLI 3.0.6 PS C:\web projects\my-helix-app> helix update    Updating 'CLI'   ✓ Checked for updates (v3.0.6 -> v3.0.7)   ⠼ Downloading and installing   ✓ Downloaded and installed  Updated 'CLI' successfully ────────────────────────────────   • Note: Please restart your terminal to use the new version PS C:\web projects\my-helix-app> helix --version Helix CLI 3.0.6 PS C:\web projects\my-helix-app>  ```  ### Steps to reproduce  1. Start helix update locally in Windows... 2. Run `helix update` 3. The version installed is still 3.06, not 3.07.  ### Version  3.06 ---> trying to upgrade  ### Environment  Self-hosted  ### Relevant log output  ```shell  ```  ### Additional context  It does look like `  ⠼ Downloading and installing` was never resolved.  _No response_
  **Post-Mortem & Fix Analysis**:
  > Ah I think this will just be the cargo package version. You will be using the 3.0.7 binary but that binary's cargo version hasn't been updated to 3.0.7 and has been left as 3.0.6 will update to 3.0.8 for the next one 
  > Ok, I think there is a `node` detection bug in 3.06...  ```bash PS C:\web projects\my-helix-app> helix --version Helix CLI 3.0.6 PS C:\web projects\my-helix-app> helix query dev -e 'readBatch().returning([])' error: Node.js is required to run TypeScript queries     = help: install Node.js 20+ to use -e/--ts/--ts-file, or pass JSON with --json/--file PS C:\web projects\my-helix-app> node -v                                                          v24.12.0 PS C:\web projects\my-helix-app>  ``` Any work arounds in the mean time?  J
  > This link has wrong version too? Anywhere to properly download `3.07`?  https://github.com/HelixDB/helix-db/releases/download/v3.0.7/helix-x86_64-pc-windows-msvc.exe  J

- **Issue #876** (2026-03-05): **[Bug]: helix init clears .gitignore**
  *Symptoms*: ### What happened?  After running `helix init`, .gitignore is wiped and overwritten when really this should be an additive procedure  ### Steps to reproduce  Run `helix init` in a folder with a non-empty `.gitignore`  ### Version  2.3.0  ### Environment  Self-hosted  ### Relevant log output  ```shell  ```  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > fixing 

- **Issue #864** (2026-03-08): **[Bug]: UpsertN ignores and overwrites default values.**
  *Symptoms*: ### What happened?  Given an example schema where the created_at property should have a default value: ``` N::EmailAddress {     UNIQUE INDEX email_address: String,     created_at: Date DEFAULT NOW, }  E::EmailAddressOneTimePassword UNIQUE {     From: EmailAddress,     To: OneTimePassword, }  N::OneTimePassword {     UNIQUE INDEX hash: String,     expires_at: Date,     created_at: Date DEFAULT NOW, } ```  And a query that upserts the email_address if it does not exist: ``` QUERY UpsertEmailOneTimePassword(email: String, hash: String, expires_at: Date) =>     existing <- N<EmailAddress>::WHERE(_::{email_address}::EQ(email))     email_address <- existing::UpsertN({email_address: email})     DROP email_address::Out<EmailAddressOneTimePassword>     one_time_password <- AddN<OneTimePassword>({         hash: hash,         expires_at: expires_at,     })     email_one_time_password <- AddE<EmailAddressOneTimePassword>::From(email_address)::To(one_time_password)     RETURN email_address, one_time_password ```  Calling this query will execute and return the response with the email_address `created_at` property, which is expected to have a default in insert, with null. ``` 2026-02-15T05:18:13.260373Z  INFO helix_db::helix_gateway::gateway: Response query=UpsertEmailOneTimePassword response={"email_address":{"email_address":"test@test.com","label":"EmailAddress","id":"1f10a1fb-9742-6d2d-9910-010203040506","created_at":null},"one_time_password":{"expires_at":"2026-02-15T05:23:12.012+00:00
  **Post-Mortem & Fix Analysis**:
  > on this!
  > found fix, implementing now

- **Issue #835** (2026-01-29): **BUG: Variable bindings and map variables not appearing in inline RETURN objects**
  *Symptoms*: # Variable bindings and map variables not appearing in inline RETURN objects  ## Summary  When returning inline objects from queries, variable bindings and map iteration variables are not included in the response, even when explicitly specified in the RETURN statement.  ## Reproduction  ### Schema ``` N::User {     INDEX username: String,     INDEX phone_number: String,     INDEX email: String,     name: String,     pfp_url: String,     is_admin: Boolean DEFAULT false,     is_verified: Boolean DEFAULT false,     is_onboarded: Boolean DEFAULT false,     created_at: Date DEFAULT NOW,     updated_at: Date DEFAULT NOW, }  E::UserToUserFollow {     From: User,     To: User,     Properties: {         since: Date DEFAULT NOW,     } } ```  ### Issue 1: Variable bindings missing from inline RETURN objects  **Query:** ```helix QUERY GetUserWithFollowers (user_id: ID) =>     user <- N<User>(user_id)     followers <- user::In<UserToUserFollow>::RANGE(0, 50)::{id, username}     follower_count <- user::In<UserToUserFollow>::COUNT     RETURN {         user: user,         follower_count: follower_count,         followers: followers     } ```  **Expected response:** ```json {   "user": { "id": "...", "username": "user_1", ... },   "follower_count": 19,   "followers": [{ "id": "...", "username": "user_2" }, ...] } ```  **Actual response:** ```json {   "user": { "id": "...", "username": "user_1", ... },   "followers": [{ "id": "...", "username": "...", "email": "...", ... }] } ```  **Problems:*

- **Issue #818** (2026-01-23): **bug (hql): rust generation failure - error[E0308]: mismatched types**
  *Symptoms*: ## Environment - Helix CLI version: 2.2.4 - OS: macos  ## Error Output ``` failed to solve: process "/bin/sh -c cargo build --features dev --package helix-container" did not complete successfully: exit code: 101  #0 building with "desktop-linux" instance using docker driver  #1 [app internal] load build definition from Dockerfile #1 transferring dockerfile: 1.54kB done #1 DONE 0.0s  #2 [app internal] load metadata for docker.io/lukemathwalker/cargo-chef:latest-rust-1.88 #2 ...  #3 [app internal] load metadata for docker.io/library/debian:bookworm-slim #3 DONE 0.8s  #2 [app internal] load metadata for docker.io/lukemathwalker/cargo-chef:latest-rust-1.88 #2 DONE 0.8s  #4 [app internal] load .dockerignore #4 transferring context: 2B done #4 DONE 0.0s  #5 [app stage-3 1/5] FROM docker.io/library/debian:bookworm-slim@sha256:56ff6d36d4eb3db13a741b342ec466f121480b5edded42e4b7ee850ce7a418ee #5 resolve docker.io/library/debian:bookworm-slim@sha256:56ff6d36d4eb3db13a741b342ec466f121480b5edded42e4b7ee850ce7a418ee 0.0s done #5 DONE 0.0s  #6 [app chef 1/5] FROM docker.io/lukemathwalker/cargo-chef:latest-rust-1.88@sha256:50ae19f263d8a4bed1769c22ac929497ac9fa1d7fbc7288c277fa2f07f0aa85c #6 resolve docker.io/lukemathwalker/cargo-chef:latest-rust-1.88@sha256:50ae19f263d8a4bed1769c22ac929497ac9fa1d7fbc7288c277fa2f07f0aa85c 0.0s done #6 DONE 0.0s  #7 [app internal] load build context #7 transferring context: 159.73kB 0.0s done #7 DONE 0.1s  #8 [app chef 2/5] WORKDIR /build #8 CACHED  #9 [app che
  **Post-Mortem & Fix Analysis**:
  > on it

- **Issue #813** (2026-01-19): **bug (hql): rust generation failure - error[E0425]: cannot find value `val` in this scope**
  *Symptoms*: ## Environment - Helix CLI version: 2.2.2 - OS: macos  ## Error Output ``` failed to solve: process "/bin/sh -c cargo build  --package helix-container" did not complete successfully: exit code: 101  #0 building with "desktop-linux" instance using docker driver  #1 [app internal] load build definition from Dockerfile #1 transferring dockerfile: 1.51kB done #1 DONE 0.0s  #2 [app internal] load metadata for docker.io/lukemathwalker/cargo-chef:latest-rust-1.88 #2 ...  #3 [app internal] load metadata for docker.io/library/debian:bookworm-slim #3 DONE 0.8s  #2 [app internal] load metadata for docker.io/lukemathwalker/cargo-chef:latest-rust-1.88 #2 DONE 0.8s  #4 [app internal] load .dockerignore #4 transferring context: 2B done #4 DONE 0.0s  #5 [app chef 1/5] FROM docker.io/lukemathwalker/cargo-chef:latest-rust-1.88@sha256:50ae19f263d8a4bed1769c22ac929497ac9fa1d7fbc7288c277fa2f07f0aa85c #5 resolve docker.io/lukemathwalker/cargo-chef:latest-rust-1.88@sha256:50ae19f263d8a4bed1769c22ac929497ac9fa1d7fbc7288c277fa2f07f0aa85c 0.0s done #5 DONE 0.0s  #6 [app stage-3 1/5] FROM docker.io/library/debian:bookworm-slim@sha256:56ff6d36d4eb3db13a741b342ec466f121480b5edded42e4b7ee850ce7a418ee #6 resolve docker.io/library/debian:bookworm-slim@sha256:56ff6d36d4eb3db13a741b342ec466f121480b5edded42e4b7ee850ce7a418ee 0.0s done #6 DONE 0.0s  #7 [app internal] load build context #7 transferring context: 151.01kB 0.0s done #7 DONE 0.0s  #8 [app chef 3/5] RUN apt-get update && apt-get install -y     pkg-co

- **Issue #804** (2026-01-14): **[Bug]: Parse error when using  ::WHERE(_.distance::GT(min_score)) after SearchV in query chain**
  *Symptoms*: ### What happened?  I basically testing this query https://docs.helix-db.com/documentation/hql/rerankers/rerank-rrf#combining-with-other-operations  and i get this error after running helix check  ```cmd > helix check [CHECK] Checking all instances [CHECK] Checking instance 'dev' [SYNTAX] Validating query syntax... Parse error: Parse error:   --> 83:18    | 83 |         ::WHERE(_.distance::GT(min_score))    |                  ^---    | ```  ### Steps to reproduce  QUERY AdvancedSearch(query_vec: [F64], min_score: F64) =>     results <- SearchV<Document>(query_vec, 200)         ::WHERE(_.distance::GT(min_score))  // Filter first         ::RerankRRF()                        // Then rerank         ::RANGE(0, 20)                       // Finally limit     RETURN results  run helix check  ### Version  2.2.1  ### Environment  Self-hosted  ### Relevant log output  ```shell  ```  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > this is because you're doing   `_.distance`  it should be  `::WHERE(_::{distance}::GT(min_score))`

- **Issue #801** (2026-01-19): **HNSW vector search returns 'no entry point found' after storing vectors**
  *Symptoms*: ## Bug Description  After storing vectors in HelixDB and attempting to perform vector similarity search, the search fails with:  ``` {"error":"Vector error: no entry point found for hnsw index","code":"GRAPH_ERROR"} ```  This occurs even after successfully storing hundreds of vectors. The HNSW index appears to not be initialized or the entry point is not being set.  ## Environment  - **Helix Version**: v2.2.0 - **OS**: Linux (Arch Linux 6.17.9) - **Docker**: Yes (local deployment via `helix push dev`) - **Python Client**: helix-py  ## Steps to Reproduce  1. Initialize fresh HelixDB instance: ```bash helix stop dev rm -rf .helix/.volumes/dev helix push dev ```  2. Define vector schema in `schema.hx`: ``` V::ChunkVector {     model_name: String,     embedding_dim: U32, } ```  3. Define search query in `queries.hx`: ``` SearchSimilar(query_vec: [F32], top_k: U64) =>     MATCH (v:ChunkVector)     WHERE v.embedding <COSINE_SIMILARITY> $query_vec     RETURN v     ORDER BY SCORE DESC     LIMIT $top_k ```  4. Store vectors via Python client (651 vectors with 1536 dimensions from OpenAI embeddings)  5. Attempt vector search: ```python from helix import Client client = Client(local=True, port=6969) results = client.run(SearchSimilar(query_vec=[...], top_k=3)) ```  ## Expected Behavior  Vector search should return the top-k most similar vectors.  ## Actual Behavior  Search fails with HTTP 500: ```json {"error":"Vector error: no entry point found for hnsw index","code":"GRAPH_ERROR"} ```
  **Post-Mortem & Fix Analysis**:
  > Looking into this now
  > this hql query is not valid? are you sure you are running this:<br><br>SearchSimilar(query_vec: \[F32\], top_k: U64) =>     MATCH (v:ChunkVector)     WHERE v.embedding <COSINE_SIMILARITY> $query_vec     RETURN v     ORDER BY SCORE DESC     LIMIT $top_k
  > Apologies, I included incorrect query syntax in my initial report. Here's the actual query from our `queries.hx`:  ```hql QUERY SearchSimilar(query_vec: [F64], top_k: U32) =>     results <- SearchV<ChunkVector>(query_vec, top_k)     RETURN results ```  And the vector type definition in `schema.hx`:  ```hql V::ChunkVector {     model_name: String,     embedding_dim: U32, } ```  The Python code calling this:  ```python from src.storage.queries import SearchSimilarChunks # ...  results = self.client.run(SearchSimilarChunks(query_vec=query_embedding, top_k=top_k)) ```  The error occurs when calling `SearchV<ChunkVector>` after storing vectors. Is there something wrong with how we're using `SearchV`?

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

### Incident Patch 1: `0390c8f1` (2026-10-05)
**Commit Message**: ci(docker-image): raise the quality job timeout to 60 minutes (#1173)

The v0.0.10 image release ([run
37354464092](https://github.com/HelixDB/helix-db/actions/runs/37354464092))
did not publish. Its `Workspace and tooling quality` job hit
`timeout-minutes: 30` partway through `Server coverage`, so `Publish
tested image` was skipped. The main push run for #1172 timed out the
same way.

| Step | Duration |
| --- | --- |
| Workspace tests | 26m31s (passed) |
| Workspace doctests | 51s (passed) |
| Server coverage | cancelled at the 30-minute limit |
| Clippy, Formatting, Shell syntax | skipped |

Before #1172's stack fix, the job failed early in
`production_contracts`, so it never reached the limit. This raises only
the quality job's timeout to 60 minutes. The image, benchmark and
publish timeouts are unchanged.

CLI 3.4.3 is already released and defaults to v0.0.10, so this blocks
fresh `helix start` until the image publishes. After merging,
re-dispatch `docker-image.yml` from main with `release_version=v0.0.10`.

<!-- greptile_comment -->

<!-- greptile_summary -->

<p><a
href="https://app.greptile.com/api/retrigger?id=75063203"><picture><source
media="(prefers-color-scheme: dark)"

**File**: `.github/workflows/docker-image.yml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ jobs:
   quality:
     name: Workspace and tooling quality
     runs-on: ubuntu-24.04
-    timeout-minutes: 30
+    timeout-minutes: 60
     steps:
       - uses: actions/checkout@v6
       - uses: actions/setup-python@v6
```

---

### Incident Patch 2: `eab93854` (2026-10-05)
**Commit Message**: ci(docker-image): raise the quality job timeout to 60 minutes

Workspace tests now take about 26.5 minutes and doctests about one more,
so the 30-minute limit cancels the job during server coverage. It
cancelled the main push run for #1172 and the v0.0.10 release dispatch,
which skipped publication. Clippy, formatting and shell syntax still
follow coverage.

**File**: `.github/workflows/docker-image.yml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ jobs:
   quality:
     name: Workspace and tooling quality
     runs-on: ubuntu-24.04
-    timeout-minutes: 30
+    timeout-minutes: 60
     steps:
       - uses: actions/checkout@v6
       - uses: actions/setup-python@v6
```

---

### Incident Patch 3: `843487d7` (2026-10-05)
**Commit Message**: fix(planner,db): count range-driven intersections with every filter (#1169)

## Bug

A native count over a range driver with bitmap filters counts the range
alone. With 300 users, `rank = uid % 60`, `tier = uid % 3` and indexes
on `rank` (range), `tier`, `uid` (unique) and `name`:

| Query | main | correct |
|---|---|---|
| `n_with_label_where(User, and[lt rank 30, eq tier 1, neq uid
1]).count()` | 149 | 49 |
| `n_with_label_where(User, or[eq uid 5, and[eq tier 1, lt rank
30]]).count()` | 150 | 51 |
| `n_with_label_where(User, and[gte rank 0, eq name
"name5"]).dedup().count()` | 300 | 30 |

The edge equivalents are wrong in the same way. `count_plan_cursor`
turned a range count plan into a cursor of its driver and dropped its
membership program.

## Fix

- **Planner:** a range count plan with bitmap filters now becomes
`ExecCountCursorPlan::Intersect` of the range driver and its filters. An
unfiltered range keeps its bare range cursor.
- **Executor:** the pull count program reads that intersection as the
row path's `OrderedIntersect`. It streams the range in index order and
tests the filters before verifying each row against its record. Two
consequences:
- A window before a later f

**File**: `crates/db/src/execution/interpreter/pull/count.rs` (modified, +93/-11)
```diff
@@ -21,6 +21,75 @@ enum Program<'a> {
     OrderedDistinct(Box<Self>),
 }
 
+/// The row path's ordered intersection of a node range `driver` with node
+/// bitmap filters, or `None` for any other intersection.
+///
+/// It streams the range in index order and tests every filter before a row is
+/// verified against its record, so a window stops early and only matching
+/// rows are read.
+fn node_ordered_intersection(
+    driver: &exec::ExecCountCursorPlan,
+    rest: &ir::AtLeast<exec::ExecCountCursorPlan, 1>,
+) -> Option<exec::ExecAccessPlan> {
+    let exec::ExecCountCursorPlan::NodeRange(range) = driver else {
+        return None;
+    };
+    let filters = rest
+        .iter()
+        .map(|child| {
+            let exec::ExecCountCursorPlan::NodeBitmap(bitmap) = child else {
+                return None;
+            };
+            Some(exec::ExecNodeSecondarySetPlan::Bitmap(bitmap.clone()))
+        })
+        .collect::<Option<Vec<_>>>()?;
+    Some(exec::ExecAccessPlan::Node(
+        exec::ExecNodeAccessPlan::SecondarySet {
+            set: exec::ExecNodeSecondarySetPlan::OrderedIntersect {
+                driver: exec::ExecNodeSecondaryRangePlan {
+                    index: range.index.clone(),
+                    key: range.key.clone(),
+                    range: range.range.clone(),
+                    iteration: ir::RangeScanIteration::Forward,
+                },
+                filters: ir::AtLeast::try_from_vec(filters)?,
+            },
+        },
+    ))
+}
+
+/// The edge counterpart of [`node_ordered_intersection`].
+fn edge_ordered_intersection(
+    driver: &exec::ExecCountCursorPlan,
+    rest: &ir::AtLeast<exec::ExecCountCursorPlan, 1>,
+) -> Option<exec::ExecAccessPlan> {
+    let exec::ExecCountCursorPlan::EdgeRange(range) = driver else {
+        return None;
+    };
+    let filters = rest
+        .iter()
+        .map(|child| {
+            let exec::ExecCountCursorPlan::EdgeBitmap(bitmap) = child else {
+                return None;
+            };
+            Some(exec::ExecEdgeSecondarySetPlan::Bitmap(bitmap.clone()))
+        })
+        .collect::<Option<Vec<_>>>()?;
+    Some(exec::ExecAccessPlan::Edge(
+        exec::ExecEdgeAccessPlan::SecondarySet {
+            set: exec::ExecEdgeSecondarySetPlan::OrderedIntersect {
+                driver: exec::ExecEdgeSecondaryRangePlan {
+                    index: range.index.clone(),
+                    key: range.key.clone(),
+                    range: range.range.clone(),
+                    iteration: ir::RangeScanIteration::Forward,
+                },
+                filters: ir::AtLeast::try_from_vec(filters)?,
+            },
+        },
+    ))
+}
+
 impl<'a> Program<'a> {
     fn new(plan: &'a exec::ExecCountCursorPlan) -> Self {
         use exec::ExecCountCursorPlan as C;
@@ -134,18 +203,31 @@ impl<'a> Program<'a> {
                 input: Box::new(Self::new(input)),
                 window,
             },
-            // A set of ID leaves of one element kind is one leaf counted on
-            // ID bitmaps; other sets combine their child rows.
-            C::Union { .. } | C::Intersect { .. } if count::id_set_keyspace(plan).is_some() => {
-                Self::Leaf(plan)
+            C::Union { driver, rest } | C::Intersect { driver, rest } => {
+                let intersect = matches!(plan, C::Intersect { .. });
+                // A range-driven intersection keeps the range's order, as the
+                // row path does, so a window over it keeps the query's rows.
+                // Otherwise a set of ID leaves of one element kind is one leaf
+                // counted on ID bitmaps, and other sets combine child rows.
+                match intersect
+                    .then(|| node_ordered_intersection(driver, rest))
+                    .flatten()
+                    .or_else(|| {
+                        intersect
+                            .then(|| edge_ordered_intersection(driver, rest))
+                            .flatten()
+                    }) {
+                    Some(access) => source(access),
+                    None if count::id_set_keyspace(plan).is_some() => Self::Leaf(plan),
+                    None => Self::Set {
+                        inputs: std::iter::once(driver.as_ref())
+                            .chain(rest.as_ref())
+                            .map(Self::new)
+                            .collect(),
+                        intersect,
+                    },
+                }
             }
-            C::Union { driver, rest } | C::Intersect { driver, rest } => Self::Set {
-                inputs: std::iter::once(driver.as_ref())
-                    .chain(rest.as_ref())
-                    .map(Self::new)
-                    .collect(),
-                intersect: matches!(plan, C::Intersect { .. }),
-            },
             C::NodeRange(plan) => source(exec::ExecAccessPlan::Node(
                 exec::ExecNodeAccessPlan::RangeIn
```

**File**: `crates/db/tests/production_contracts.rs` (modified, +218/-0)
```diff
@@ -11562,6 +11562,224 @@ async fn public_query_boundary_keeps_scan_order_and_repeats_through_index_served
     }
 }
 
+/// A count over a range-driven intersection applies every filter of the
+/// intersection, not only its range driver, alone, after `dedup`, and in a
+/// union branch, for node and edge sources. Each expected count is the
+/// brute-force count over the seeded `User` nodes and `Link` edges. A
+/// window over the intersection keeps the range's order, as its rows do.
+#[tokio::test]
+async fn counts_over_range_intersections_apply_every_filter() {
+    const USERS: i64 = 300;
+    let db = HelixDB::open(HelixDbSource::InMemory {
+        database: "production-range-intersection-counts".to_owned(),
+    })
+    .await
+    .expect("count fixture opens");
+    let properties = |n: i64, range: &'static str| {
+        vec![
+            ("uid", PropertyInput::from(n)),
+            (range, PropertyInput::from(n % 60)),
+            ("tier", PropertyInput::from(n % 3)),
+            ("name", PropertyInput::from(format!("name{}", n % 10))),
+        ]
+    };
+    let users = (0..USERS).fold(batch::write_batch(), |write, n| {
+        write.var_as(
+            &format!("u{n}"),
+            traversal::g().add_n("User", properties(n, "rank")),
+        )
+    });
+    let seed = (0..USERS).fold(users, |write, n| {
+        write.var_as(
+            &format!("l{n}"),
+            traversal::g().n(NodeRef::var(format!("u{n}"))).add_e(
+                "Link",
+                NodeRef::var(format!("u{}", (n + 1) % USERS)),
+                properties(n, "weight"),
+            ),
+        )
+    });
+    db.query(QueryRequest::write(seed.returning(Vec::<String>::new())))
+        .await
+        .expect("users and links are committed");
+    for spec in [
+        index::IndexSpec::node_range("User", "rank"),
+        index::IndexSpec::node_equality("User", "tier"),
+        index::IndexSpec::node_unique_equality("User", "uid"),
+        index::IndexSpec::node_equality("User", "name"),
+        index::IndexSpec::edge_range_desc("Link", "weight"),
+        index::IndexSpec::edge_equality("Link", "tier"),
+        index::IndexSpec::edge_equality("Link", "name"),
+    ] {
+        let receipt = db
+            .query(QueryRequest::write(
+                batch::write_batch()
+                    .var_as("operation", traversal::g().create_index_if_not_exists(spec))
+                    .returning(["operation"]),
+            ))
+            .await
+            .expect("count fixture index is accepted");
+        let Some(operation_id) = receipt["operation"]["operation_id"].as_str() else {
+            panic!("accepted count fixture index has an operation ID: {receipt}");
+        };
+        await_index_operation_success(&db, operation_id, "count fixture index").await;
+    }
+    let nodes = |predicate: Predicate| {
+        let source = || traversal::g().n_with_label_where("User", predicate.clone());
+        (source().count(), source().dedup().count())
+    };
+    let edges = |predicate: Predicate| {
+        let source = || traversal::g().e_with_label_where("Link", predicate.clone());
+        (source().count(), source().dedup().count())
+    };
+    let expected = |keep: &dyn Fn(i64) -> bool| (0..USERS).filter(|n| keep(*n)).count();
+    let (mut actual_counts, mut expected_counts) = (Vec::new(), Vec::new());
+    for (label, (count, distinct), count_expected) in [
+        (
+            "nodes: range with equality and residual filters",
+            nodes(Predicate::and(vec![
+                Predicate::lt("rank", 30),
+                Predicate::eq("tier", 1),
+                Predicate::neq("uid", 1),
+            ])),
+            expected(&|n| n % 60 < 30 && n % 3 == 1 && n != 1),
+        ),
+        (
+            "nodes: range intersection in a union branch",
+            nodes(Predicate::or(vec![
+                Predicate::eq("uid", 5),
+                Predicate::and(vec![Predicate::eq("tier", 1), Predicate::lt("rank", 30)]),
+            ])),
+            expected(&|n| n == 5 || (n % 3 == 1 && n % 60 < 30)),
+        ),
+        (
+            "nodes: unbounded range with an equality filter",
+            nodes(Predicate::and(vec![
+                Predicate::gte("rank", 0),
+                Predicate::eq("name", "name5"),
+            ])),
+            expected(&|n| n % 10 == 5),
+        ),
+        (
+            "edges: range with equality and residual filters",
+            edges(Predicate::and(vec![
+                Predicate::lt("weight", 30),
+                Predicate::eq("tier", 1),
+                Predicate::neq("name", "name1"),
+            ])),
+            expected(&|n| n % 60 < 30 && n % 3 == 1 && n % 10 != 1),
+        ),
+        (
+            "edges: range intersection in a union branch",
+            edges(Predicate::or(vec![
+                Predicate::eq("name", "name5"),
+                Predicate::and(vec![Predicate::eq("tier", 1), Predicate::lt("weight", 3
```

**File**: `crates/planner/src/rules/cardinality.rs` (modified, +108/-6)
```diff
@@ -1062,12 +1062,32 @@ fn count_plan_cursor(
             lookup: plan.lookup,
             verification: plan.verification,
         }),
-        exec::ExecCountPlan::NodeRange(plan) => {
-            Ok(exec::ExecCountCursorPlan::NodeRange(plan.driver))
-        }
-        exec::ExecCountPlan::EdgeRange(plan) => {
-            Ok(exec::ExecCountCursorPlan::EdgeRange(plan.driver))
-        }
+        // A range cursor streams only its driver, so an ordered
+        // intersection's bitmap filters join it in one intersection cursor,
+        // which the executor streams in range order; dropping them would
+        // count every range match.
+        exec::ExecCountPlan::NodeRange(plan) => Ok(match plan.membership {
+            exec::ExecNodeRangeMembershipPlan::All => {
+                exec::ExecCountCursorPlan::NodeRange(plan.driver)
+            }
+            exec::ExecNodeRangeMembershipPlan::BitmapFilters(filters) => {
+                exec::ExecCountCursorPlan::Intersect {
+                    driver: Box::new(exec::ExecCountCursorPlan::NodeRange(plan.driver)),
+                    rest: filters.map(exec::ExecCountCursorPlan::NodeBitmap),
+                }
+            }
+        }),
+        exec::ExecCountPlan::EdgeRange(plan) => Ok(match plan.membership {
+            exec::ExecEdgeRangeMembershipPlan::All => {
+                exec::ExecCountCursorPlan::EdgeRange(plan.driver)
+            }
+            exec::ExecEdgeRangeMembershipPlan::BitmapFilters(filters) => {
+                exec::ExecCountCursorPlan::Intersect {
+                    driver: Box::new(exec::ExecCountCursorPlan::EdgeRange(plan.driver)),
+                    rest: filters.map(exec::ExecCountCursorPlan::EdgeBitmap),
+                }
+            }
+        }),
         exec::ExecCountPlan::NodeAuthoritativeScan(plan) => Ok(
             exec::ExecCountCursorPlan::NodeAuthoritativeScan(plan.predicate),
         ),
@@ -4583,6 +4603,88 @@ mod tests {
         .is_err());
     }
 
+    /// A range count plan with bitmap filters becomes a cursor intersecting
+    /// the range driver with every filter, which the executor streams in range
+    /// order; an unfiltered range keeps its bare range cursor. Dropping the
+    /// filters would count every range match.
+    #[test]
+    fn filtered_range_count_cursors_keep_every_filter() {
+        let node_driver = exec::ExecNodeVerifiedRangeScanPlan {
+            index: catalog::NodeRangeIndexMeta::try_new("node-range").unwrap(),
+            key: catalog::ScopedPropertyDirectionKey::try_new(
+                "User",
+                "age",
+                RangeIndexDirection::Asc,
+            )
+            .unwrap(),
+            range: ir::IndexRange::All,
+        };
+        let node = |membership| {
+            exec::ExecCountPlan::NodeRange(exec::ExecNodeRangeCountPlan {
+                driver: node_driver.clone(),
+                membership,
+                window: exec::ExecCountWindowPlan::identity(),
+            })
+        };
+        assert_eq!(
+            count_plan_cursor(node(exec::ExecNodeRangeMembershipPlan::All)).unwrap(),
+            exec::ExecCountCursorPlan::NodeRange(node_driver.clone())
+        );
+        assert_eq!(
+            count_plan_cursor(node(exec::ExecNodeRangeMembershipPlan::BitmapFilters(
+                ir::AtLeast::try_from_vec(vec![
+                    exec_node_point("active"),
+                    exec_node_point("pending"),
+                ])
+                .unwrap(),
+            )))
+            .unwrap(),
+            exec::ExecCountCursorPlan::Intersect {
+                driver: Box::new(exec::ExecCountCursorPlan::NodeRange(node_driver)),
+                rest: ir::AtLeast::try_from_vec(vec![
+                    exec::ExecCountCursorPlan::NodeBitmap(exec_node_point("active")),
+                    exec::ExecCountCursorPlan::NodeBitmap(exec_node_point("pending")),
+                ])
+                .unwrap(),
+            }
+        );
+
+        let edge_driver = exec::ExecEdgeVerifiedRangeScanPlan {
+            index: catalog::EdgeRangeIndexMeta::try_new("edge-range").unwrap(),
+            key: catalog::ScopedPropertyDirectionKey::try_new(
+                "LIKES",
+                "age",
+                RangeIndexDirection::Desc,
+            )
+            .unwrap(),
+            range: ir::IndexRange::All,
+        };
+        let edge = |membership| {
+            exec::ExecCountPlan::EdgeRange(exec::ExecEdgeRangeCountPlan {
+                driver: edge_driver.clone(),
+                membership,
+                window: exec::ExecCountWindowPlan::identity(),
+            })
+        };
+        assert_eq!(
+            count_plan_cursor(edge(exec::ExecEdgeRangeMembershipPlan::All)).unwrap(),
+            exec::ExecCountCursorPlan::EdgeRange(edge_driver.clone())
+        );
+        assert_eq!(
+            count_plan_cursor(edge(exec::ExecEdgeRangeMembershipPlan::BitmapFilters(
+                ir::At
```

---

### Incident Patch 4: `2c365905` (2026-10-05)
**Commit Message**: fix(planner,db): count range-driven intersections with every filter

A native count over a range driver with bitmap filters counted the range
alone. With 300 users, rank = uid % 60 and tier = uid % 3,
n_with_label_where(User, and[lt rank 30, eq tier 1, neq uid 1]).count()
returned 149 instead of 49, and dedup().count(), union branches and the
edge equivalents were wrong the same way: count_plan_cursor turned the
range count plan into a cursor of its driver and dropped its membership.

The cursor now intersects the range driver with its filters, and the
count executor reads that intersection as the row path's ordered
intersection: it streams the range in index order and tests the filters
before verifying each row. A window before a later filter therefore keeps
the rows the query returns, and stops early, instead of taking IDs in
ascending order.

**File**: `crates/db/src/execution/interpreter/pull/count.rs` (modified, +93/-11)
```diff
@@ -21,6 +21,75 @@ enum Program<'a> {
     OrderedDistinct(Box<Self>),
 }
 
+/// The row path's ordered intersection of a node range `driver` with node
+/// bitmap filters, or `None` for any other intersection.
+///
+/// It streams the range in index order and tests every filter before a row is
+/// verified against its record, so a window stops early and only matching
+/// rows are read.
+fn node_ordered_intersection(
+    driver: &exec::ExecCountCursorPlan,
+    rest: &ir::AtLeast<exec::ExecCountCursorPlan, 1>,
+) -> Option<exec::ExecAccessPlan> {
+    let exec::ExecCountCursorPlan::NodeRange(range) = driver else {
+        return None;
+    };
+    let filters = rest
+        .iter()
+        .map(|child| {
+            let exec::ExecCountCursorPlan::NodeBitmap(bitmap) = child else {
+                return None;
+            };
+            Some(exec::ExecNodeSecondarySetPlan::Bitmap(bitmap.clone()))
+        })
+        .collect::<Option<Vec<_>>>()?;
+    Some(exec::ExecAccessPlan::Node(
+        exec::ExecNodeAccessPlan::SecondarySet {
+            set: exec::ExecNodeSecondarySetPlan::OrderedIntersect {
+                driver: exec::ExecNodeSecondaryRangePlan {
+                    index: range.index.clone(),
+                    key: range.key.clone(),
+                    range: range.range.clone(),
+                    iteration: ir::RangeScanIteration::Forward,
+                },
+                filters: ir::AtLeast::try_from_vec(filters)?,
+            },
+        },
+    ))
+}
+
+/// The edge counterpart of [`node_ordered_intersection`].
+fn edge_ordered_intersection(
+    driver: &exec::ExecCountCursorPlan,
+    rest: &ir::AtLeast<exec::ExecCountCursorPlan, 1>,
+) -> Option<exec::ExecAccessPlan> {
+    let exec::ExecCountCursorPlan::EdgeRange(range) = driver else {
+        return None;
+    };
+    let filters = rest
+        .iter()
+        .map(|child| {
+            let exec::ExecCountCursorPlan::EdgeBitmap(bitmap) = child else {
+                return None;
+            };
+            Some(exec::ExecEdgeSecondarySetPlan::Bitmap(bitmap.clone()))
+        })
+        .collect::<Option<Vec<_>>>()?;
+    Some(exec::ExecAccessPlan::Edge(
+        exec::ExecEdgeAccessPlan::SecondarySet {
+            set: exec::ExecEdgeSecondarySetPlan::OrderedIntersect {
+                driver: exec::ExecEdgeSecondaryRangePlan {
+                    index: range.index.clone(),
+                    key: range.key.clone(),
+                    range: range.range.clone(),
+                    iteration: ir::RangeScanIteration::Forward,
+                },
+                filters: ir::AtLeast::try_from_vec(filters)?,
+            },
+        },
+    ))
+}
+
 impl<'a> Program<'a> {
     fn new(plan: &'a exec::ExecCountCursorPlan) -> Self {
         use exec::ExecCountCursorPlan as C;
@@ -134,18 +203,31 @@ impl<'a> Program<'a> {
                 input: Box::new(Self::new(input)),
                 window,
             },
-            // A set of ID leaves of one element kind is one leaf counted on
-            // ID bitmaps; other sets combine their child rows.
-            C::Union { .. } | C::Intersect { .. } if count::id_set_keyspace(plan).is_some() => {
-                Self::Leaf(plan)
+            C::Union { driver, rest } | C::Intersect { driver, rest } => {
+                let intersect = matches!(plan, C::Intersect { .. });
+                // A range-driven intersection keeps the range's order, as the
+                // row path does, so a window over it keeps the query's rows.
+                // Otherwise a set of ID leaves of one element kind is one leaf
+                // counted on ID bitmaps, and other sets combine child rows.
+                match intersect
+                    .then(|| node_ordered_intersection(driver, rest))
+                    .flatten()
+                    .or_else(|| {
+                        intersect
+                            .then(|| edge_ordered_intersection(driver, rest))
+                            .flatten()
+                    }) {
+                    Some(access) => source(access),
+                    None if count::id_set_keyspace(plan).is_some() => Self::Leaf(plan),
+                    None => Self::Set {
+                        inputs: std::iter::once(driver.as_ref())
+                            .chain(rest.as_ref())
+                            .map(Self::new)
+                            .collect(),
+                        intersect,
+                    },
+                }
             }
-            C::Union { driver, rest } | C::Intersect { driver, rest } => Self::Set {
-                inputs: std::iter::once(driver.as_ref())
-                    .chain(rest.as_ref())
-                    .map(Self::new)
-                    .collect(),
-                intersect: matches!(plan, C::Intersect { .. }),
-            },
             C::NodeRange(plan) => source(exec::ExecAccessPlan::Node(
                 exec::ExecNodeAccessPlan::RangeIn
```

**File**: `crates/db/tests/production_contracts.rs` (modified, +218/-0)
```diff
@@ -11562,6 +11562,224 @@ async fn public_query_boundary_keeps_scan_order_and_repeats_through_index_served
     }
 }
 
+/// A count over a range-driven intersection applies every filter of the
+/// intersection, not only its range driver, alone, after `dedup`, and in a
+/// union branch, for node and edge sources. Each expected count is the
+/// brute-force count over the seeded `User` nodes and `Link` edges. A
+/// window over the intersection keeps the range's order, as its rows do.
+#[tokio::test]
+async fn counts_over_range_intersections_apply_every_filter() {
+    const USERS: i64 = 300;
+    let db = HelixDB::open(HelixDbSource::InMemory {
+        database: "production-range-intersection-counts".to_owned(),
+    })
+    .await
+    .expect("count fixture opens");
+    let properties = |n: i64, range: &'static str| {
+        vec![
+            ("uid", PropertyInput::from(n)),
+            (range, PropertyInput::from(n % 60)),
+            ("tier", PropertyInput::from(n % 3)),
+            ("name", PropertyInput::from(format!("name{}", n % 10))),
+        ]
+    };
+    let users = (0..USERS).fold(batch::write_batch(), |write, n| {
+        write.var_as(
+            &format!("u{n}"),
+            traversal::g().add_n("User", properties(n, "rank")),
+        )
+    });
+    let seed = (0..USERS).fold(users, |write, n| {
+        write.var_as(
+            &format!("l{n}"),
+            traversal::g().n(NodeRef::var(format!("u{n}"))).add_e(
+                "Link",
+                NodeRef::var(format!("u{}", (n + 1) % USERS)),
+                properties(n, "weight"),
+            ),
+        )
+    });
+    db.query(QueryRequest::write(seed.returning(Vec::<String>::new())))
+        .await
+        .expect("users and links are committed");
+    for spec in [
+        index::IndexSpec::node_range("User", "rank"),
+        index::IndexSpec::node_equality("User", "tier"),
+        index::IndexSpec::node_unique_equality("User", "uid"),
+        index::IndexSpec::node_equality("User", "name"),
+        index::IndexSpec::edge_range_desc("Link", "weight"),
+        index::IndexSpec::edge_equality("Link", "tier"),
+        index::IndexSpec::edge_equality("Link", "name"),
+    ] {
+        let receipt = db
+            .query(QueryRequest::write(
+                batch::write_batch()
+                    .var_as("operation", traversal::g().create_index_if_not_exists(spec))
+                    .returning(["operation"]),
+            ))
+            .await
+            .expect("count fixture index is accepted");
+        let Some(operation_id) = receipt["operation"]["operation_id"].as_str() else {
+            panic!("accepted count fixture index has an operation ID: {receipt}");
+        };
+        await_index_operation_success(&db, operation_id, "count fixture index").await;
+    }
+    let nodes = |predicate: Predicate| {
+        let source = || traversal::g().n_with_label_where("User", predicate.clone());
+        (source().count(), source().dedup().count())
+    };
+    let edges = |predicate: Predicate| {
+        let source = || traversal::g().e_with_label_where("Link", predicate.clone());
+        (source().count(), source().dedup().count())
+    };
+    let expected = |keep: &dyn Fn(i64) -> bool| (0..USERS).filter(|n| keep(*n)).count();
+    let (mut actual_counts, mut expected_counts) = (Vec::new(), Vec::new());
+    for (label, (count, distinct), count_expected) in [
+        (
+            "nodes: range with equality and residual filters",
+            nodes(Predicate::and(vec![
+                Predicate::lt("rank", 30),
+                Predicate::eq("tier", 1),
+                Predicate::neq("uid", 1),
+            ])),
+            expected(&|n| n % 60 < 30 && n % 3 == 1 && n != 1),
+        ),
+        (
+            "nodes: range intersection in a union branch",
+            nodes(Predicate::or(vec![
+                Predicate::eq("uid", 5),
+                Predicate::and(vec![Predicate::eq("tier", 1), Predicate::lt("rank", 30)]),
+            ])),
+            expected(&|n| n == 5 || (n % 3 == 1 && n % 60 < 30)),
+        ),
+        (
+            "nodes: unbounded range with an equality filter",
+            nodes(Predicate::and(vec![
+                Predicate::gte("rank", 0),
+                Predicate::eq("name", "name5"),
+            ])),
+            expected(&|n| n % 10 == 5),
+        ),
+        (
+            "edges: range with equality and residual filters",
+            edges(Predicate::and(vec![
+                Predicate::lt("weight", 30),
+                Predicate::eq("tier", 1),
+                Predicate::neq("name", "name1"),
+            ])),
+            expected(&|n| n % 60 < 30 && n % 3 == 1 && n % 10 != 1),
+        ),
+        (
+            "edges: range intersection in a union branch",
+            edges(Predicate::or(vec![
+                Predicate::eq("name", "name5"),
+                Predicate::and(vec![Predicate::eq("tier", 1), Predicate::lt("weight", 3
```

**File**: `crates/planner/src/rules/cardinality.rs` (modified, +108/-6)
```diff
@@ -1062,12 +1062,32 @@ fn count_plan_cursor(
             lookup: plan.lookup,
             verification: plan.verification,
         }),
-        exec::ExecCountPlan::NodeRange(plan) => {
-            Ok(exec::ExecCountCursorPlan::NodeRange(plan.driver))
-        }
-        exec::ExecCountPlan::EdgeRange(plan) => {
-            Ok(exec::ExecCountCursorPlan::EdgeRange(plan.driver))
-        }
+        // A range cursor streams only its driver, so an ordered
+        // intersection's bitmap filters join it in one intersection cursor,
+        // which the executor streams in range order; dropping them would
+        // count every range match.
+        exec::ExecCountPlan::NodeRange(plan) => Ok(match plan.membership {
+            exec::ExecNodeRangeMembershipPlan::All => {
+                exec::ExecCountCursorPlan::NodeRange(plan.driver)
+            }
+            exec::ExecNodeRangeMembershipPlan::BitmapFilters(filters) => {
+                exec::ExecCountCursorPlan::Intersect {
+                    driver: Box::new(exec::ExecCountCursorPlan::NodeRange(plan.driver)),
+                    rest: filters.map(exec::ExecCountCursorPlan::NodeBitmap),
+                }
+            }
+        }),
+        exec::ExecCountPlan::EdgeRange(plan) => Ok(match plan.membership {
+            exec::ExecEdgeRangeMembershipPlan::All => {
+                exec::ExecCountCursorPlan::EdgeRange(plan.driver)
+            }
+            exec::ExecEdgeRangeMembershipPlan::BitmapFilters(filters) => {
+                exec::ExecCountCursorPlan::Intersect {
+                    driver: Box::new(exec::ExecCountCursorPlan::EdgeRange(plan.driver)),
+                    rest: filters.map(exec::ExecCountCursorPlan::EdgeBitmap),
+                }
+            }
+        }),
         exec::ExecCountPlan::NodeAuthoritativeScan(plan) => Ok(
             exec::ExecCountCursorPlan::NodeAuthoritativeScan(plan.predicate),
         ),
@@ -4583,6 +4603,88 @@ mod tests {
         .is_err());
     }
 
+    /// A range count plan with bitmap filters becomes a cursor intersecting
+    /// the range driver with every filter, which the executor streams in range
+    /// order; an unfiltered range keeps its bare range cursor. Dropping the
+    /// filters would count every range match.
+    #[test]
+    fn filtered_range_count_cursors_keep_every_filter() {
+        let node_driver = exec::ExecNodeVerifiedRangeScanPlan {
+            index: catalog::NodeRangeIndexMeta::try_new("node-range").unwrap(),
+            key: catalog::ScopedPropertyDirectionKey::try_new(
+                "User",
+                "age",
+                RangeIndexDirection::Asc,
+            )
+            .unwrap(),
+            range: ir::IndexRange::All,
+        };
+        let node = |membership| {
+            exec::ExecCountPlan::NodeRange(exec::ExecNodeRangeCountPlan {
+                driver: node_driver.clone(),
+                membership,
+                window: exec::ExecCountWindowPlan::identity(),
+            })
+        };
+        assert_eq!(
+            count_plan_cursor(node(exec::ExecNodeRangeMembershipPlan::All)).unwrap(),
+            exec::ExecCountCursorPlan::NodeRange(node_driver.clone())
+        );
+        assert_eq!(
+            count_plan_cursor(node(exec::ExecNodeRangeMembershipPlan::BitmapFilters(
+                ir::AtLeast::try_from_vec(vec![
+                    exec_node_point("active"),
+                    exec_node_point("pending"),
+                ])
+                .unwrap(),
+            )))
+            .unwrap(),
+            exec::ExecCountCursorPlan::Intersect {
+                driver: Box::new(exec::ExecCountCursorPlan::NodeRange(node_driver)),
+                rest: ir::AtLeast::try_from_vec(vec![
+                    exec::ExecCountCursorPlan::NodeBitmap(exec_node_point("active")),
+                    exec::ExecCountCursorPlan::NodeBitmap(exec_node_point("pending")),
+                ])
+                .unwrap(),
+            }
+        );
+
+        let edge_driver = exec::ExecEdgeVerifiedRangeScanPlan {
+            index: catalog::EdgeRangeIndexMeta::try_new("edge-range").unwrap(),
+            key: catalog::ScopedPropertyDirectionKey::try_new(
+                "LIKES",
+                "age",
+                RangeIndexDirection::Desc,
+            )
+            .unwrap(),
+            range: ir::IndexRange::All,
+        };
+        let edge = |membership| {
+            exec::ExecCountPlan::EdgeRange(exec::ExecEdgeRangeCountPlan {
+                driver: edge_driver.clone(),
+                membership,
+                window: exec::ExecCountWindowPlan::identity(),
+            })
+        };
+        assert_eq!(
+            count_plan_cursor(edge(exec::ExecEdgeRangeMembershipPlan::All)).unwrap(),
+            exec::ExecCountCursorPlan::EdgeRange(edge_driver.clone())
+        );
+        assert_eq!(
+            count_plan_cursor(edge(exec::ExecEdgeRangeMembershipPlan::BitmapFilters(
+                ir::At
```

---

### Incident Patch 5: `b587d565` (2026-10-05)
**Commit Message**: fix(ts-sdk): reject negative stream-bound literals (#1163)

## Problem

`StreamBound.literal()` accepts negative values even though stream
bounds map to Rust's non-negative `usize`. It can emit an invalid
request AST, and sufficiently negative bigints can lose precision during
conversion.

## Reproduction

On current `main`, `StreamBound.literal(-1)` emits `{literal:-1}` and
`StreamBound.literal(-9007199254740993n)` emits a rounded negative
literal.

## Root cause and fix

The TypeScript literal constructor checked safe-integer overflow but not
sign. Reject negative numbers and bigints before conversion; leave
expression coercion and valid bounds unchanged.

## Regression coverage

Covers `-1`, `-1n`, a negative unsafe bigint, zero, the max-safe
boundary, and upper overflow.

## Validation

- `npm test` — pass
- `npm run lint` — pass
- `npm run build` — pass
- `npm run check` reaches the repository-wide Prettier check, which
reports 27 files; the untouched `upstream/main` version of `dsl.ts` also
fails that check.

Related history: #936 was closed without merging; #1097 changed the Go
and Python SDKs. Current TypeScript `main` still reproduces the
negative-literal behavior.

<!-- g

**File**: `sdks/typescript/src/dsl.ts` (modified, +3/-0)
```diff
@@ -684,6 +684,9 @@ export class StreamBound implements Encodable {
     readonly payload: unknown,
   ) {}
   static literal(value: number | bigint): StreamBound {
+    if ((typeof value === "number" && value < 0) || (typeof value === "bigint" && value < 0n)) {
+      throw new TypeError("stream bound literal must be non-negative");
+    }
     const safe = intToJson(value);
     if (typeof safe === "bigint") {
       if (safe > BigInt(Number.MAX_SAFE_INTEGER)) throw new TypeError(`stream bound exceeds JavaScript safe integer range: ${safe}`);
```

**File**: `sdks/typescript/test/basic.test.ts` (modified, +9/-0)
```diff
@@ -20,6 +20,7 @@ import {
   RepeatConfig,
   ShortestPathDirection,
   SourcePredicate,
+  StreamBound,
   VectorDistanceMetric,
   WhenThen,
   bytes,
@@ -118,6 +119,14 @@ for (const value of [-1, 1.5, 256, "7", true]) {
 }
 assert.deepEqual(parsed(PropertyInput.param("limit")), { expr: { param: "limit" } });
 assert.deepEqual(parsed(NodeRef.param("node_ids")), { param: "node_ids" });
+assert.deepEqual(parsed(StreamBound.literal(0)), { literal: 0 });
+assert.deepEqual(parsed(StreamBound.literal(BigInt(Number.MAX_SAFE_INTEGER))), {
+  literal: Number.MAX_SAFE_INTEGER,
+});
+for (const value of [-1, -1n, -9_007_199_254_740_993n]) {
+  assert.throws(() => StreamBound.literal(value), TypeError);
+}
+assert.throws(() => StreamBound.literal(BigInt(Number.MAX_SAFE_INTEGER) + 1n), TypeError);
 assert.deepEqual(parsed(QueryParamType.array(QueryParamType.array(QueryParamType.f64()))), { array: { array: "f64" } });
 assert.equal(Object.isFrozen(param.array(param.string())), true);
 assert.equal(Object.isFrozen(QueryParamType.array(QueryParamType.string())), true);
```

---

### Incident Patch 6: `fe3c3b82` (2026-10-05)
**Commit Message**: fix(sdks): validate signed 64-bit integer values (#1164)

## Problem

The TypeScript and Python SDKs accepted integers outside the signed
64-bit range in APIs that emit `i64` values. Those values cannot be
represented by the server AST's `PropertyValue::I64(i64)` or
`QueryValue::I64(i64)` contracts.

## Reproduction

`PropertyValue.i64(1n << 63n)` in TypeScript and `PropertyValue.i64(1 <<
63)` in Python serialized an out-of-range value as an `i64` literal. The
lower overflow boundary behaved the same way.

## Fix

Validate signed 64-bit bounds at explicit `i64` construction, array,
query-value, and typed-parameter boundaries. Keep the generic integer
serializer unchanged because other fields have separate integer
contracts.

## Regression coverage

Both SDK suites cover `i64::MIN` and `i64::MAX`, reject
one-beyond-boundary values, and exercise typed parameter serialization.

## Validation

- TypeScript: `npm test`, `npm run lint`, `npm run build` — pass.
- Python: `python -m unittest discover -s tests` (56 passed, 2 skipped),
Ruff checks on changed Python files — pass.
- `git diff --check` — pass.
- Prettier check flags both changed TypeScript files on upstream/main as
well; the ad

**File**: `sdks/python/src/helixdb/dsl.py` (modified, +17/-6)
```diff
@@ -176,6 +176,17 @@ def _int_to_json(value: int) -> int:
     return value
 
 
+_I64_MIN = -(1 << 63)
+_I64_MAX = (1 << 63) - 1
+
+
+def _i64_to_json(value: int) -> int:
+    integer = _int_to_json(value)
+    if not _I64_MIN <= integer <= _I64_MAX:
+        raise TypeError("integer outside signed 64-bit range")
+    return integer
+
+
 def _finite_float(value: float, *, name: str = "float") -> float:
     if isinstance(value, bool) or not isinstance(value, (int, float)):
         raise TypeError(f"expected {name}, got {value!r}")
@@ -270,7 +281,7 @@ class DateTimeLiteral:
 
 
 def i64(value: int) -> I64Literal:
-    return I64Literal(_int_to_json(value))
+    return I64Literal(_i64_to_json(value))
 
 
 def f32(value: float) -> F32Literal:
@@ -311,7 +322,7 @@ def bool(cls, value: bool) -> "PropertyValue":
 
     @classmethod
     def i64(cls, value: int) -> "PropertyValue":
-        return cls("I64", _int_to_json(value))
+        return cls("I64", _i64_to_json(value))
 
     @classmethod
     def date_time(cls, value: DateTime | int) -> "PropertyValue":
@@ -349,7 +360,7 @@ def bytes(cls, value: bytes | bytearray | Sequence[int]) -> "PropertyValue":
 
     @classmethod
     def i64_array(cls, values: Iterable[int]) -> "PropertyValue":
-        return cls("I64Array", [_int_to_json(value) for value in values])
+        return cls("I64Array", [_i64_to_json(value) for value in values])
 
     @classmethod
     def f64_array(cls, values: Iterable[float]) -> "PropertyValue":
@@ -3727,7 +3738,7 @@ def _convert_param_value(schema: ParamSchema, value: Any, path: str) -> JsonValu
             raise TypeError(f"parameter '{path}' must be boolean")
         return value
     if schema.kind == "I64":
-        return _int_to_json(value)
+        return _i64_to_json(value)
     if schema.kind == "F64":
         return _finite_float(value)
     if schema.kind == "F32":
@@ -3826,7 +3837,7 @@ def bool(self, value: bool) -> JsonValue:
         return bool(value)
 
     def i64(self, value: int) -> JsonValue:
-        return _int_to_json(value)
+        return _i64_to_json(value)
 
     def f64(self, value: float) -> JsonValue:
         return _finite_float(value)
@@ -3884,7 +3895,7 @@ def _normalize_typed_query_value(
             raise TypeError(f"parameter '{path}' must be boolean")
         return value
     if parameter_type.variant == "I64":
-        return _int_to_json(value)
+        return _i64_to_json(value)
     if parameter_type.variant == "F64":
         return _finite_float(value)
     if parameter_type.variant == "F32":
```

**File**: `sdks/python/tests/test_dsl.py` (modified, +22/-0)
```diff
@@ -37,6 +37,7 @@
     bytes_,
     define_params,
     g,
+    i64,
     param,
     parse_index_ddl_receipt,
     parse_index_operation_status,
@@ -264,6 +265,27 @@ def test_values_exprs_and_predicates_use_ast_shape(self) -> None:
             {"array": {"array": "f64"}},
         )
         self.assertEqual(PropertyValue.string("x").as_str(), "x")
+        i64_min = -(1 << 63)
+        i64_max = (1 << 63) - 1
+        for value in (i64_min, i64_max):
+            self.assertEqual(parsed(PropertyValue.i64(value)), {"i64": value})
+            self.assertEqual(parsed(PropertyValue.from_value(i64(value))), {"i64": value})
+            self.assertEqual(QueryValue.i64(value), value)
+        for value in (i64_min - 1, i64_max + 1):
+            with self.assertRaisesRegex(TypeError, "signed 64-bit range"):
+                i64(value)
+            with self.assertRaisesRegex(TypeError, "signed 64-bit range"):
+                PropertyValue.i64(value)
+            with self.assertRaisesRegex(TypeError, "signed 64-bit range"):
+                PropertyValue.i64_array([value])
+            with self.assertRaisesRegex(TypeError, "signed 64-bit range"):
+                QueryValue.i64(value)
+            with self.assertRaisesRegex(TypeError, "signed 64-bit range"):
+                QueryRequest.read(read_batch()).with_typed_parameter(
+                    "value", QueryParamType.i64(), value
+                )
+            with self.assertRaisesRegex(TypeError, "signed 64-bit range"):
+                read_batch().to_query_json(define_params({"value": param.i64()}), {"value": value})
         self.assertEqual(
             DateTime.parse_rfc3339("1969-12-31T23:59:59.999-00:00").to_rfc3339(),
             "1969-12-31T23:59:59.999Z",
```

**File**: `sdks/typescript/src/dsl.ts` (modified, +18/-6)
```diff
@@ -240,6 +240,18 @@ function intToJson(value: number | bigint): number | bigint {
   return value;
 }
 
+const I64_MIN = -(1n << 63n);
+const I64_MAX = (1n << 63n) - 1n;
+
+function i64ToJson(value: number | bigint): number | bigint {
+  const integer = intToJson(value);
+  const exact = typeof integer === "bigint" ? integer : BigInt(integer);
+  if (exact < I64_MIN || exact > I64_MAX) {
+    throw new RangeError("integer outside signed 64-bit range");
+  }
+  return integer;
+}
+
 export class DateTime {
   private readonly value: bigint;
 
@@ -308,7 +320,7 @@ class DateTimeLiteral {
 }
 
 export function i64(value: number | bigint): I64Literal {
-  return new I64Literal(value);
+  return new I64Literal(i64ToJson(value));
 }
 export function f32(value: number): F32Literal {
   return new F32Literal(value);
@@ -358,7 +370,7 @@ export class PropertyValue implements Encodable {
     return new PropertyValue("Bool", value);
   }
   static i64(value: number | bigint): PropertyValue {
-    return new PropertyValue("I64", intToJson(value));
+    return new PropertyValue("I64", i64ToJson(value));
   }
   static dateTime(value: DateTime | number | bigint): PropertyValue {
     return new PropertyValue("DateTime", value instanceof DateTime ? value.millis() : intToJson(value));
@@ -382,7 +394,7 @@ export class PropertyValue implements Encodable {
     return new PropertyValue("Bytes", normalized);
   }
   static i64Array(values: (number | bigint)[]): PropertyValue {
-    return new PropertyValue("I64Array", values.map(intToJson));
+    return new PropertyValue("I64Array", values.map(i64ToJson));
   }
   static f64Array(values: number[]): PropertyValue {
     return new PropertyValue("F64Array", values);
@@ -2905,7 +2917,7 @@ function convertParamValue(schema: ParamSchema, value: unknown, path: string): J
       if (typeof value !== "boolean") throw new TypeError(`parameter '${path}' must be boolean`);
       return value;
     case "I64":
-      return intToJson(value as number | bigint);
+      return i64ToJson(value as number | bigint);
     case "F64":
       if (typeof value !== "number") throw new TypeError(`parameter '${path}' must be number`);
       return finiteNumber(value, path);
@@ -2970,7 +2982,7 @@ function normalizeTypedQueryValue(type: QueryParamType, value: JsonValue, path:
       return value;
     case "I64":
       if (typeof value !== "number" && typeof value !== "bigint") throw new TypeError(`parameter '${path}' must be an integer`);
-      return intToJson(value);
+      return i64ToJson(value);
     case "F64":
       if (typeof value !== "number") throw new TypeError(`parameter '${path}' must be number`);
       return finiteNumber(value, path);
@@ -3051,7 +3063,7 @@ export type QueryValue = JsonValue;
 export const QueryValue = {
   null: (): JsonValue => null,
   bool: (value: boolean): JsonValue => value,
-  i64: (value: number | bigint): JsonValue => intToJson(value),
+  i64: (value: number | bigint): JsonValue => i64ToJson(value),
   f64: (value: number): JsonValue => finiteNumber(value, "value"),
   f32: (value: number): JsonValue => normalizeF32(value, "value"),
   string: (value: string): JsonValue => value,
```

**File**: `sdks/typescript/test/basic.test.ts` (modified, +15/-0)
```diff
@@ -25,6 +25,7 @@ import {
   bytes,
   defineParams,
   g,
+  i64,
   param,
   parseIndexDdlReceipt,
   parseIndexOperationStatus,
@@ -483,6 +484,20 @@ assert.throws(() => readBatch().toQueryJson(bytesParams, { payload: new Uint8Arr
 
 assert.equal(stringifyJson(PropertyValue.i64(9223372036854775807n)), '{"i64":9223372036854775807}');
 assert.equal(stringifyJson(QueryValue.i64(9223372036854775807n)), "9223372036854775807");
+const i64Params = defineParams({ value: param.i64() });
+for (const value of [-(1n << 63n), (1n << 63n) - 1n]) {
+  assert.doesNotThrow(() => PropertyValue.i64(value));
+  assert.doesNotThrow(() => PropertyValue.from(i64(value)));
+  assert.doesNotThrow(() => QueryValue.i64(value));
+}
+for (const value of [-(1n << 63n) - 1n, 1n << 63n]) {
+  assert.throws(() => i64(value), /signed 64-bit range/);
+  assert.throws(() => PropertyValue.i64(value), /signed 64-bit range/);
+  assert.throws(() => PropertyValue.i64Array([value]), /signed 64-bit range/);
+  assert.throws(() => QueryValue.i64(value), /signed 64-bit range/);
+  assert.throws(() => QueryRequest.read(readBatch()).withTypedParameter("value", QueryParamType.i64(), value), /signed 64-bit range/);
+  assert.throws(() => readBatch().toQueryJson(i64Params, { value }), /signed 64-bit range/);
+}
 
 assert.deepEqual(parsed(Expr.case([WhenThen(Predicate.isNotNull("email"), Expr.prop("email"))], Expr.val("missing"))), {
   case: {
```

---

### Incident Patch 7: `366372d1` (2026-10-05)
**Commit Message**: fix(db): hold back only the index entity whose publication keeps failing (#1165)

Stacked on #1156; the base branch is `async-index-queue`, and it should
be retargeted to `main` once #1156 merges. Fixes HEL-956.

## Problem
In #1156, if planning one entity's queued index operation failed the
same way every time, its whole (scope, index, generation) stopped
publishing for good. The error was retried forever, the queue filled,
writes to that index got 429, and `blocked_index_entity_count` stayed at
0.

A real trigger exists: data written by released versions (HEL-952) can
contain a self-link, and the vector insert searches never excluded the
inserting node, so planning failed every time with `ContainsOwner`.

## Fix

**1. A node is never its own neighbour.**
- Both insert searches and entry-point resolution now exclude the
inserting node.
- A self-link already in storage is dropped in memory when its row
loads, instead of failing every mutation. The row is rewritten without
it only when a mutation actually changes that row.
- Each guard has a test that fails without it, and a property test over
damaged graphs checks that no new self-link is ever created.

**2. Only the failing entity

**File**: `crates/db/src/index_lifecycle/queue/isolation_tests.rs` (added, +786/-0)
```diff
@@ -0,0 +1,786 @@
+//! Deterministic planning failures hold back only their own entity, while
+//! transient failures still retry the whole batch.
+//!
+//! Failures are injected through [`PublicationHooks::planning_failures`],
+//! keyed by the operation an entity's selection ends at, so a newer write to
+//! the entity supersedes one. A corrupt injection fails the real planner: a
+//! vector replacement of the wrong dimension, or a text effect naming the
+//! other element kind.
+//!
+//! [`PublicationHooks::planning_failures`]: super::publication::test_hooks::PublicationHooks
+
+use std::collections::HashSet;
+use std::num::NonZeroU64;
+use std::sync::atomic::Ordering;
+use std::sync::Arc;
+use std::time::{Duration, Instant};
+
+use helix_ast::{
+    batch, graph::NodeRef, query::QueryRequest, query::SearchConsistency, traversal,
+    value::PropertyInput,
+};
+use slatedb::object_store::memory::InMemory;
+use slatedb::object_store::ObjectStore;
+
+use super::overlay_tests::{text_search, vector_search, write};
+use super::publication::test_hooks::InjectedPlanningFailure;
+use super::publication::{FailureKind, NextTarget, PublicationOutcome, QueuePublisher};
+use super::publication_tests::{install_vector, publisher};
+use super::tests::{
+    add_doc, install_vector_and_text, open, publisher_with_limits, queue, queued, target,
+};
+use super::QueueTarget;
+use crate::config::{DbConfig, IndexOperationQueueTuning, TextIndexDefinition};
+use crate::encoding::v2::values::indexes::operation_queue::{QueueFamily, QueuedOperationId};
+use crate::error::HelixDbError;
+use crate::index_lifecycle::ValidatedDynamicIndexDefinition;
+use crate::HelixDB;
+
+/// Paused publication, and eventual searches that overlay no queued work, so
+/// they see exactly what is published.
+fn tuning() -> IndexOperationQueueTuning {
+    IndexOperationQueueTuning::default().with_eventual_search_budget_for_tests(0)
+}
+
+async fn install_text(db: &HelixDB) {
+    db.install_index_for_tests(
+        ValidatedDynamicIndexDefinition::try_from(
+            TextIndexDefinition::new_node("Doc", "body").unwrap(),
+        )
+        .unwrap(),
+    )
+    .await
+    .unwrap();
+}
+
+async fn set(db: &HelixDB, id: u64, property: &'static str, value: PropertyInput) {
+    write(db, || {
+        QueryRequest::write(
+            batch::write_batch().var_as(
+                "updated",
+                traversal::g()
+                    .n(NodeRef::from(id))
+                    .set_property(property, value.clone()),
+            ),
+        )
+    })
+    .await;
+}
+
+/// Entity IDs of `family`'s queued operations, in queue order.
+async fn queued_ids(db: &HelixDB, family: QueueFamily) -> Vec<u64> {
+    queue(db, family).await.map_or_else(Vec::new, |queue| {
+        queue
+            .operations()
+            .iter()
+            .map(|operation| operation.entity().id.get())
+            .collect()
+    })
+}
+
+/// The newest queued operation of entity `id` in `family`'s queue.
+async fn newest(db: &HelixDB, family: QueueFamily, id: u64) -> QueuedOperationId {
+    queue(db, family)
+        .await
+        .unwrap()
+        .operations()
+        .iter()
+        .rev()
+        .find(|operation| operation.entity().id.get() == id)
+        .unwrap()
+        .id()
+}
+
+fn inject(db: &HelixDB, operation: QueuedOperationId, failure: Option<InjectedPlanningFailure>) {
+    inject_into(publisher(db), operation, failure);
+}
+
+fn inject_into(
+    publisher: &QueuePublisher,
+    operation: QueuedOperationId,
+    failure: Option<InjectedPlanningFailure>,
+) {
+    let mut failures = publisher.hooks().planning_failures.lock();
+    match failure {
+        Some(failure) => failures.insert(operation, failure),
+        None => failures.remove(&operation),
+    };
+}
+
+/// Publishes `target` until only held-back work is left, returning every
+/// outcome.
+async fn settle(db: &HelixDB, target: QueueTarget) -> Vec<PublicationOutcome> {
+    let mut outcomes = Vec::new();
+    for _ in 0..32 {
+        let outcome = publisher(db).publish_once(target).await.unwrap();
+        outcomes.push(outcome);
+        match outcome {
+            PublicationOutcome::Stalled | PublicationOutcome::Empty => return outcomes,
+            PublicationOutcome::Published { .. }
+            | PublicationOutcome::Trimmed
+            | PublicationOutcome::Blocked => {}
+            PublicationOutcome::Discarded { .. }
+            | PublicationOutcome::Deferred
+            | PublicationOutcome::Retry => panic!("publication did not progress: {outcomes:?}"),
+        }
+    }
+    panic!("publication did not settle: {outcomes:?}")
+}
+
+/// The published entity nearest `point`.
+async fn published_nearest(db: &HelixDB, point: [f32; 2]) -> Option<u64> {
+    vector_search(db, point, 1, None, SearchConsistency::Eventual)
+        .await
+        .first()
+        .map(|(id, _)| *id)
+}
+
+async fn published_text(db: &HelixDB, term: &str) -> Vec<u64> {
+    text
```

**File**: `crates/db/src/index_lifecycle/queue/mod.rs` (modified, +26/-8)
```diff
@@ -86,10 +86,12 @@ pub struct IndexOperationQueueStats {
     /// Publication commits with an unknown outcome.
     pub uncertain_commits: u64,
     /// Attempts retried with fewer entities or operations after exceeding an
-    /// output budget.
+    /// output budget, or with fewer text entities after planning a text epoch
+    /// failed deterministically.
     pub output_retries: u64,
-    /// Attempts where one operation's effect and acknowledgement alone
-    /// exceeded an output budget, holding its entity back.
+    /// Attempts that held an entity back: one operation's effect and
+    /// acknowledgement alone exceeded an output budget, or planning the
+    /// entity failed deterministically.
     pub blocked_attempts: u64,
     /// Entities held back right now (a gauge, unlike the publication
     /// counters): see [`crate::HelixDB::blocked_index_entities`].
@@ -136,15 +138,18 @@ pub struct IndexOperationQueueStats {
     /// Attempts that must rediscover and retry: commit conflicts, uncertain
     /// commits, retryable errors, and ownership changes after classification.
     pub publication_retries: u64,
-    /// Retries caused by a retryable storage or decoding error.
+    /// Retries caused by an error: a transient one, such as storage I/O, or a
+    /// deterministic one that no single entity's planning raised.
     pub publication_error_retries: u64,
     /// Attempts deferred because a hidden build owns the generation.
     pub deferred_attempts: u64,
 }
 
 /// One entity whose queued vector/text work is held back because one of its
 /// operations alone can never fit a publication under the current limits,
-/// for example after they were lowered.
+/// for example after they were lowered, or because planning its change fails
+/// deterministically, for example on damaged index rows or a corrupt queued
+/// payload.
 ///
 /// It blocks only its own publication: the rest of its generation keeps
 /// publishing. Its operations stay queued, so strong searches keep serving
@@ -162,9 +167,20 @@ pub struct IndexOperationQueueStats {
 /// the entity within their budget can.
 ///
 /// A rewrite or delete repairs it only once one publication fits the change
-/// from its published state: removing a document published under larger
-/// limits, or relinking a deleted vector's neighbors, can exceed the lowered
-/// limits too. Raising the limits again lets it publish.
+/// from its published state and planning that change succeeds: removing a
+/// document published under larger limits, or relinking a deleted vector's
+/// neighbors, can exceed the lowered limits too. Raising the limits again
+/// lets it publish. An entity held back after its planning failed is also
+/// planned again about once a minute without a write, so it publishes on its
+/// own once what failed is repaired, for example restored metadata; a held
+/// delete is never written again, and this is what publishes it.
+///
+/// Its queued operations, and each later write to it, keep counting toward
+/// its index's retained-byte limit until it publishes, a limit the whole
+/// index shares. An entity written over and over while its planning keeps
+/// failing, for example on damaged index rows of its own, therefore fills
+/// that limit, and then writes to every entity of the index fail with
+/// `index_backpressure`. Stop writing it until it publishes.
 ///
 /// Its queued text still counts toward the pending text a strong text search
 /// may analyze in its partition (one text publication's analysis budget),
@@ -245,6 +261,8 @@ impl QueueTarget {
 #[cfg(test)]
 mod codec_storage_tests;
 #[cfg(test)]
+mod isolation_tests;
+#[cfg(test)]
 mod layout_tests;
 #[cfg(test)]
 mod lifecycle_tests;
```

**File**: `crates/db/src/index_lifecycle/queue/publication.rs` (modified, +486/-79)
```diff
@@ -25,6 +25,10 @@
 //! 6. Stage the longest prefix of entities whose exact output fits beside the
 //!    acknowledgement: vectors through the build planner
 //!    ([`crate::index_lifecycle::vector::publication`]), text as one epoch.
+//!    When planning fails, [`FailureKind`] decides: an entity whose planning
+//!    fails deterministically is held back like one that cannot fit, but is
+//!    also retried on a timer, and the rest publish from the next attempt;
+//!    anything else retries the batch.
 //! 7. Stage one acknowledgement naming exactly the published IDs.
 //! 8. Commit through the vector cache's commit fence, release accounting and
 //!    retain the rest of the queue, then retire emptied partition caches and
@@ -80,10 +84,12 @@ const MAX_BACKOFF: Duration = Duration::from_secs(5);
 /// long that work waits once it becomes publishable.
 const MAX_DEFERRED_BACKOFF: Duration = Duration::from_secs(1);
 /// Longest a [`PublicationOutcome::Stalled`] generation waits without new
-/// work. Only a new operation can give it a publishable entity, and one
-/// makes it eligible at once; this bounds how long a retirement, which only
-/// an attempt discovers, leaves its held operations charged before they are
-/// discarded.
+/// work, and how long an entity whose planning failed waits before it is
+/// planned again ([`HeldEntity::Failed`]). A new operation, or a failed
+/// entity's due retry, makes a stalled generation eligible at once; this
+/// bounds how long a retirement, which only an attempt discovers, leaves its
+/// held operations charged before they are discarded, and how soon a failed
+/// entity publishes once what failed is repaired.
 const MAX_STALLED_WAIT: Duration = Duration::from_secs(60);
 /// Most operation IDs one discard transaction acknowledges (about a 1 MiB
 /// map operand); the operand and output bounds may lower it further.
@@ -103,12 +109,16 @@ pub(crate) enum PublicationOutcome {
     Deferred,
     /// A serializable conflict or uncertain commit; rediscover and retry.
     Retry,
-    /// Exact output crossed a budget before anything fit; retry immediately
-    /// with fewer text entities, or fewer operations.
+    /// Exact output crossed a budget before anything fit, or planning a text
+    /// epoch failed deterministically; retry immediately with fewer text
+    /// entities, or fewer operations.
     Trimmed,
     /// One operation's effect and acknowledgement cannot fit an output budget,
-    /// so its entity is held back until a later operation supersedes it;
-    /// retry immediately with the generation's other entities.
+    /// or planning one entity failed deterministically, so its entity is held
+    /// back until a later operation supersedes it (or, after a failure, until
+    /// its retry is due); retry immediately with the generation's other
+    /// entities, or after backoff once two entities in a row failed to plan
+    /// without a publication between them.
     Blocked,
     /// Every queued entity is held back after blocking; nothing was attempted.
     /// The generation waits for a new operation rather than retrying on a
@@ -159,16 +169,23 @@ struct TargetSchedule {
     eligibility: Eligibility,
     /// Consecutive attempts without progress.
     failures: u32,
+    /// Entities held back after failing to plan since the generation last
+    /// published. A failure outside one entity's input, such as a partition's
+    /// missing metadata, fails every entity in turn, so from the second such
+    /// hold on, the next attempt backs off rather than holding back the whole
+    /// queue one immediate attempt at a time.
+    failed_holds: u32,
     /// Entities held back because a lone operation of theirs could not fit a
-    /// publication, or draining after their repair. Process memory only: a
-    /// restarted publisher rediscovers blocked entities by blocking again,
-    /// and publishes a draining entity's remaining operations in regular
-    /// batches (see [`HeldEntity`]).
+    /// publication or failed to plan, or draining after their repair. Process
+    /// memory only: a restarted publisher rediscovers blocked entities by
+    /// blocking again, and publishes a draining entity's remaining operations
+    /// in regular batches (see [`HeldEntity`]).
     held: HashMap<IndexEntity, HeldEntity>,
 }
 
 /// One entity held back after one of its operations could not fit a
-/// publication.
+/// publication, or failed to plan deterministically
+/// ([`QueuePublisher::isolate`]).
 ///
 /// A held entity is selected only alone, as a repair, once the rotation
 /// reaches it ahead of every entity that is not held back; a batch the
@@ -203,13 +220,27 @@ struct TargetSchedule {
 /// last one is acknowledged. Strong searches overlay every queued operation
 /// and never observe it; eventual searches that do not reach the entity
 /// within their budget can.
+///
+/// An entity whose planning failed is also repaired, at full width, once i
```

**File**: `crates/db/src/index_lifecycle/queue/publication_tests.rs` (modified, +33/-22)
```diff
@@ -1554,27 +1554,32 @@ async fn an_active_namespace_without_metadata_fails_closed_and_writes_nothing()
         )
         .await
         .unwrap();
-    add_doc(&db, vec![2.0, 2.0], "c").await.unwrap();
+    let inserted = add_doc(&db, vec![2.0, 2.0], "c").await.unwrap();
     let keys = all_keys(&db).await;
     let rows = unpartitioned_vector_rows(&db).await;
-    let errors = publisher(&db)
-        .metrics()
-        .error_retries
-        .load(Ordering::Relaxed);
 
     // Only a build creates a missing namespace, so publication never
-    // recreates it over rows search can no longer reach.
+    // recreates it over rows search can no longer reach: planning the insert
+    // fails, which holds it back.
     assert_eq!(
         publisher(&db).publish_once(target).await.unwrap(),
-        PublicationOutcome::Retry
+        PublicationOutcome::Blocked
+    );
+    assert_eq!(
+        publisher(&db)
+            .blocked_entities()
+            .into_iter()
+            .map(|(_, entity)| entity.id.get())
+            .collect::<Vec<_>>(),
+        [inserted]
     );
     assert_eq!(
         publisher(&db)
             .metrics()
             .error_retries
             .load(Ordering::Relaxed),
-        errors + 1,
-        "a missing namespace is an error, not a conflict"
+        0,
+        "a missing namespace fails planning, not storage"
     );
     assert_eq!(
         all_keys(&db).await,
@@ -1616,31 +1621,36 @@ async fn contradict_metadata(db: &HelixDB, physical_index_id: u64) {
 }
 
 /// Asserts `target`'s next attempt fails closed on the contradicting metadata
-/// of namespace `physical_index_id`: an error rather than a conflict, which
-/// writes nothing, leaves its one queued operation, and retains no planning
-/// session.
+/// of namespace `physical_index_id`: planning fails, holding back `entity`,
+/// whose one queued operation stays queued, and the attempt writes nothing
+/// and retains no planning session.
 async fn assert_contradicting_metadata_fails_closed(
     db: &HelixDB,
     target: QueueTarget,
     physical_index_id: u64,
+    entity: u64,
 ) {
     let keys = all_keys(db).await;
     let rows = physical_rows(db, physical_index_id).await;
-    let errors = publisher(db)
-        .metrics()
-        .error_retries
-        .load(Ordering::Relaxed);
     assert_eq!(
         publisher(db).publish_once(target).await.unwrap(),
-        PublicationOutcome::Retry
+        PublicationOutcome::Blocked
+    );
+    assert_eq!(
+        publisher(db)
+            .blocked_entities()
+            .into_iter()
+            .map(|(_, held)| held.id.get())
+            .collect::<Vec<_>>(),
+        [entity]
     );
     assert_eq!(
         publisher(db)
             .metrics()
             .error_retries
             .load(Ordering::Relaxed),
-        errors + 1,
-        "contradicting metadata is an error, not a conflict"
+        0,
+        "contradicting metadata fails planning, not storage"
     );
     assert_eq!(
         all_keys(db).await,
@@ -1688,12 +1698,13 @@ async fn an_upsert_into_contradicting_metadata_fails_closed_and_writes_nothing()
         PublicationOutcome::Published { .. }
     ));
     contradict_metadata(&db, physical_index_id.get()).await;
-    add_doc(&db, vec![2.0, 2.0], "c").await.unwrap();
+    let inserted = add_doc(&db, vec![2.0, 2.0], "c").await.unwrap();
     assert!(publisher(&db)
         .planning_cache()
         .retained_publication(target)
         .is_some());
-    assert_contradicting_metadata_fails_closed(&db, target, physical_index_id.get()).await;
+    assert_contradicting_metadata_fails_closed(&db, target, physical_index_id.get(), inserted)
+        .await;
     db.close().await.unwrap();
 }
 
@@ -1718,7 +1729,7 @@ async fn a_removal_from_contradicting_metadata_fails_closed_and_writes_nothing()
     // The partition keeps another entity, so only the removal reads its
     // metadata; no reclamation runs.
     super::overlay_tests::delete(&db, removed).await;
-    assert_contradicting_metadata_fails_closed(&db, target, partition).await;
+    assert_contradicting_metadata_fails_closed(&db, target, partition, removed).await;
     db.close().await.unwrap();
 }
 
```

**File**: `crates/db/src/index_lifecycle/vector.rs` (modified, +23/-20)
```diff
@@ -443,26 +443,29 @@ mod tests {
                     *generation,
                 ))
                 .await;
-            let publication::StagedEffects::Prefix { staged, .. } =
-                publication::stage_active_effects(
-                    db,
-                    transaction,
-                    &permit,
-                    handle,
-                    &effects,
-                    SearchIndexBackfillLimits::default().batch(),
-                    AcknowledgementOutput {
-                        operations: 0,
-                        bytes: 0,
-                    },
-                    &resources,
-                    cache_writes,
-                    None,
-                    std::num::NonZeroU64::MIN,
-                )
-                .await?
-            else {
-                panic!("every effect fits the default budget");
+            let staged = match publication::stage_active_effects(
+                db,
+                transaction,
+                &permit,
+                handle,
+                &effects,
+                SearchIndexBackfillLimits::default().batch(),
+                AcknowledgementOutput {
+                    operations: 0,
+                    bytes: 0,
+                },
+                &resources,
+                cache_writes,
+                None,
+                std::num::NonZeroU64::MIN,
+            )
+            .await?
+            {
+                publication::StagedEffects::Prefix { staged, .. } => staged,
+                publication::StagedEffects::NoneFits => {
+                    panic!("every effect fits the default budget")
+                }
+                publication::StagedEffects::Failed { error, .. } => return Err(error),
             };
             assert_eq!(staged, expected);
         }
```

**File**: `crates/db/src/index_lifecycle/vector/publication.rs` (modified, +24/-9)
```diff
@@ -94,6 +94,13 @@ pub(crate) enum StagedEffects {
     /// Not even the first effect fits beside the reserved output; nothing was
     /// staged.
     NoneFits,
+    /// Planning the effect at `position` failed with `error`, so the caller
+    /// can tell which entity failed. Every earlier effect is staged and the
+    /// failed one may be partly planned, so the transaction must not commit.
+    Failed {
+        position: usize,
+        error: HelixDbError,
+    },
 }
 
 /// Plans `effects` in order and stages the longest prefix that fits `limits`
@@ -106,6 +113,9 @@ pub(crate) enum StagedEffects {
 /// Planning reuses the session retained after the target's commit numbered
 /// `latest_commit` when that is still the retained one, and offers its own
 /// session for retention at `commit`, the number this attempt's commit takes.
+///
+/// An error planning one effect is [`StagedEffects::Failed`]; an error before
+/// any effect is planned is returned.
 #[allow(
     clippy::too_many_arguments,
     reason = "publication binds the exact storage, generation, budget, planner resources, cache effects, and session checkpoints"
@@ -227,21 +237,15 @@ async fn stage_with_distance<D: Distance>(
         .checkout_publication::<D>(permit, reuse.as_ref(), limits.max_input_bytes())
         .await;
     let mut staged = 0_usize;
-    for effect in effects {
+    for (position, effect) in effects.iter().enumerate() {
         let next = effect
             .replacement
             .as_ref()
             .map(|replacement| VectorIndexedDocument {
                 partition: replacement.partition().clone(),
                 vector: replacement.vector().to_vec(),
             });
-        let EntityPlanOutcome::Admitted {
-            vector_writes,
-            single_vector_output_bytes,
-            lifecycle_operations,
-            lifecycle_bytes,
-            ..
-        } = plan_and_apply::<D>(
+        let planned = match plan_and_apply::<D>(
             &planning,
             &recorder,
             transaction,
@@ -255,7 +259,18 @@ async fn stage_with_distance<D: Distance>(
             &accounting,
             &mut session,
         )
-        .await?
+        .await
+        {
+            Ok(planned) => planned,
+            Err(error) => return Ok(StagedEffects::Failed { position, error }),
+        };
+        let EntityPlanOutcome::Admitted {
+            vector_writes,
+            single_vector_output_bytes,
+            lifecycle_operations,
+            lifecycle_bytes,
+            ..
+        } = planned
         else {
             session.discard_entity();
             break;
```

**File**: `crates/db/src/lib.rs` (modified, +6/-5)
```diff
@@ -3309,11 +3309,12 @@ impl HelixDB {
     /// publisher holds back, in ascending order.
     ///
     /// Each one has an operation that alone can never fit a publication under
-    /// the current limits; see [`BlockedIndexEntity`] for what that means for
-    /// writes and searches, including strong text searches that fail with
-    /// backpressure no publication clears. The list is the publisher's
-    /// process memory: it is empty on a reader and is rebuilt after a
-    /// restart as publication blocks again.
+    /// the current limits, or one whose planning failed deterministically;
+    /// see [`BlockedIndexEntity`] for what that means for writes and
+    /// searches, including strong text searches that fail with backpressure
+    /// no publication clears. The list is the publisher's process memory: it
+    /// is empty on a reader and is rebuilt after a restart as publication
+    /// blocks again.
     pub fn blocked_index_entities(&self) -> Vec<BlockedIndexEntity> {
         let Some(publisher) = &self.inner.index_queue_publisher else {
             return Vec::new();
```

**File**: `crates/db/src/search/vector/hnsw/mutation/locator_tests.rs` (modified, +397/-12)
```diff
@@ -16,6 +16,16 @@
 //! [`links_released_versions_left_without_locators_outlive_their_target`]
 //! starts from links committed without a locator, as released versions
 //! write them, and pins that no operation here repairs them.
+//!
+//! [`a_committed_self_link_never_fails_its_node`] and
+//! [`damaged_graphs_never_gain_a_self_link`] start from rows that link their
+//! own node, as damage from released versions can leave them, and pin that
+//! every operation still plans and none links a node to itself.
+//!
+//! [`an_entry_point_naming_the_inserting_node_never_roots_its_insert`] and
+//! [`insert_traversals_never_reach_the_inserting_node`] pin each traversal
+//! guard against the inserting node, whose item an insert stages first: one
+//! through stale metadata, one per guard.
 
 use std::collections::{BTreeMap, BTreeSet};
 use std::sync::Arc;
@@ -515,6 +525,43 @@ async fn one_off_caches_at_their_bound_keep_one_locator_per_link() {
     );
 }
 
+/// Every link from a node to itself.
+fn self_links(graph: &Graph) -> BTreeSet<Link> {
+    graph
+        .links
+        .iter()
+        .filter(|(_, source, target)| source == target)
+        .copied()
+        .collect()
+}
+
+/// Commits `node`'s row at `layer` in `graph` linking `node` too, as damage
+/// from released versions can leave a row: a self-link without a locator.
+async fn commit_self_link<D: Distance>(
+    db: &slatedb::Db,
+    index: &VectorIndex<D>,
+    graph: &Graph,
+    layer: u16,
+    node: NodeId,
+) {
+    let neighbors = graph
+        .links
+        .iter()
+        .filter(|(row_layer, source, _)| (*row_layer, *source) == (layer, node))
+        .map(|(_, _, target)| *target)
+        .chain([node])
+        .collect::<Vec<_>>();
+    let txn = db.begin(IsolationLevel::Snapshot).await.unwrap();
+    let measured = MeasuredVectorTransaction::new(&txn);
+    let rows = VectorWriteRows::new(&measured, index.row_keyspace());
+    match layer {
+        0 => rows.put_layer0_neighbors(node, &neighbors),
+        layer => rows.put_upper_neighbors(layer, node, &neighbors),
+    }
+    .unwrap();
+    txn.commit().await.unwrap();
+}
+
 /// Commits `links` without their locators, as released versions left them.
 async fn commit_without_locators<D: Distance>(
     db: &slatedb::Db,
@@ -647,15 +694,15 @@ async fn released_unlocated_run<D: Distance>() {
     commit_without_locators(&db, &index, &released).await;
     let unlocated = unlocated.union(&released).copied().collect::<BTreeSet<_>>();
     // The re-embedding's delete misses each one-way source, so its insert
-    // searches through one back to the node and links the node to itself.
-    let error = re_embed(&db, &index, &moved, &mut points, target)
+    // searches through one back to the node, which it skips.
+    re_embed(&db, &index, &moved, &mut points, target)
         .await
-        .unwrap_err();
-    assert!(
-        error
-            .to_string()
-            .contains(&format!("neighbor set contains its owner {target}")),
-        "{name}: re-embedding {target}: {error}"
+        .unwrap_or_else(|error| panic!("{name}: re-embedding {target}: {error}"));
+    let re_embedded = Graph::read(&index, db.snapshot().await.unwrap().as_ref()).await;
+    assert_eq!(
+        self_links(&re_embedded),
+        BTreeSet::new(),
+        "{name}: re-embedded {target}"
     );
 
     let mut session = VectorBuildSession::<D>::new(NonZeroU64::new(1 << 20).unwrap());
@@ -716,12 +763,350 @@ async fn released_unlocated_run<D: Distance>() {
 /// value changed, so each link the insert restored kept no locator. A delete
 /// finds a link's source only through that locator or the node's own rows, so
 /// nothing here repairs such a link. Once the node stops linking back, nothing
-/// reaches the link: re-embedding the node fails, as its insert searches
-/// through the link back to the node and links the node to itself, and deleting
-/// the node leaves the link naming a node without an item, which fails searches
-/// that reach it. Every other link and locator stays exact.
+/// reaches the link: re-embedding the node searches through the link back to
+/// the node, which the insert skips rather than linking the node to itself,
+/// and deleting the node leaves the link naming a node without an item, which
+/// fails searches that reach it. Every other link and locator stays exact.
 #[tokio::test]
 async fn links_released_versions_left_without_locators_outlive_their_target() {
     released_unlocated_run::<Euclidean>().await;
     released_unlocated_run::<Cosine>().await;
 }
+
+/// Self-links in every row of a node with upper-layer rows, then an insert
+/// that searches through it, a re-embedding of it, and its delete.
+async fn self_linked_node_run<D: Distance>() {
+    let mut rng = StdRng::seed_from_u64(1);
+    let name = format!("self-linked-node-{}", D::name());
+    let (db, index) = create::<D>(&name).await;
+    let mut points = build(&db, &index, &mut rng, 60).await;
+  
```

---

### Incident Patch 8: `61240f74` (2026-10-04)
**Commit Message**: fix(db): re-read the queue after a failed-planning hold

A hold after failed planning kept the attempt's queue for the next
attempt, against the rule that a blocked outcome drops it. With enough
entities whose retries keep falling due, no attempt stalled, storage was
never read again, and newer writes, including repairs of held entities,
never published. A hold now drops the queue like a size-blocked one; a
trimmed text epoch still keeps it.

**File**: `crates/db/src/index_lifecycle/queue/isolation_tests.rs` (modified, +99/-0)
```diff
@@ -480,6 +480,105 @@ async fn consecutive_planning_failures_back_off() {
     db.close().await.unwrap();
 }
 
+/// Entities that keep failing to plan never keep publication on a queue read
+/// before newer writes. Past twelve of them, the 5 s backoffs between their
+/// holds outlast the 60 s retry wait, so each retry is due again when the
+/// rotation returns to it and no attempt stalls. Each hold reads the queue
+/// again, so new writes, and one that repairs a held entity, publish within
+/// two rotations, and every other held operation stays queued.
+#[tokio::test]
+async fn writes_publish_while_many_failed_entities_keep_retrying() {
+    let db = open(
+        "isolate-many-retrying",
+        Arc::new(InMemory::new()),
+        queued(tuning()),
+    )
+    .await;
+    install_vector(&db, None).await;
+    let mut failing = Vec::new();
+    for x in 0..16_u8 {
+        failing.push(add_doc(&db, vec![f32::from(x), 0.0], "doc").await.unwrap());
+    }
+    let target = target(&db, QueueFamily::Vector).await;
+    settle(&db, target).await;
+    for id in &failing {
+        set(&db, *id, "embedding", vec![50.0_f32, 50.0].into()).await;
+        let corrupt = newest(&db, QueueFamily::Vector, *id).await;
+        inject(&db, corrupt, Some(InjectedPlanningFailure::Corrupt));
+    }
+    let mut holds = vec![PublicationOutcome::Blocked; failing.len()];
+    holds.push(PublicationOutcome::Stalled);
+    assert_eq!(settle(&db, target).await, holds);
+    // Every retry is due whenever the rotation reaches it, from this attempt
+    // on, whose queue predates the writes below.
+    publisher(&db).make_failed_retries_due();
+    assert_eq!(
+        publisher(&db).publish_once(target).await.unwrap(),
+        PublicationOutcome::Blocked
+    );
+    let repaired = failing[8];
+    set(&db, repaired, "embedding", vec![60.0_f32, 60.0].into()).await;
+    let inserted = [
+        add_doc(&db, vec![100.0, 0.0], "doc").await.unwrap(),
+        add_doc(&db, vec![101.0, 0.0], "doc").await.unwrap(),
+    ];
+    let still_failing = failing
+        .iter()
+        .copied()
+        .filter(|id| *id != repaired)
+        .collect::<Vec<_>>();
+
+    // A publication that drains the rotation's cursor entity restarts the
+    // rotation at the queue's head, so the repair and the inserts' batch
+    // each publish within two rotations of the held entities.
+    let mut outcomes = Vec::new();
+    while queued_ids(&db, QueueFamily::Vector).await != still_failing {
+        assert!(
+            outcomes.len() < 2 * failing.len(),
+            "newer writes did not publish within two rotations: {outcomes:?}"
+        );
+        publisher(&db).make_failed_retries_due();
+        outcomes.push(publisher(&db).publish_once(target).await.unwrap());
+    }
+    assert!(
+        outcomes.iter().all(|outcome| matches!(
+            outcome,
+            PublicationOutcome::Blocked | PublicationOutcome::Published { .. }
+        )),
+        "{outcomes:?}"
+    );
+    for published in [
+        PublicationOutcome::Published {
+            operations: 2,
+            entities: 1,
+        },
+        PublicationOutcome::Published {
+            operations: 2,
+            entities: 2,
+        },
+    ] {
+        assert!(
+            outcomes.contains(&published),
+            "the repair and the inserts publish: {outcomes:?}"
+        );
+    }
+    assert_eq!(
+        held(&db).into_iter().collect::<HashSet<_>>(),
+        still_failing.iter().copied().collect::<HashSet<_>>(),
+        "every other entity stays held"
+    );
+    assert_eq!(published_nearest(&db, [60.0, 60.0]).await, Some(repaired));
+    assert_eq!(
+        published_nearest(&db, [100.0, 0.0]).await,
+        Some(inserted[0])
+    );
+    assert_eq!(
+        published_nearest(&db, [101.0, 0.0]).await,
+        Some(inserted[1])
+    );
+    db.close().await.unwrap();
+}
+
 /// A text epoch fails as a whole, so its entity ceiling halves until the
 /// failing entity publishes alone and is held back; every other entity
 /// publishes, and a newer write to it publishes it.
```

**File**: `crates/db/src/index_lifecycle/queue/publication.rs` (modified, +23/-16)
```diff
@@ -1035,10 +1035,9 @@ impl QueuePublisher {
             .collect::<std::result::Result<Vec<_>, _>>()
         {
             Ok(effects) => effects,
+            // A hold drops the queue (see `Self::isolate`).
             Err((failed, error)) => {
-                let outcome = self.isolate(target, std::slice::from_ref(failed), &error);
-                self.store.retained().retain(target, stored, &[]);
-                return Ok(outcome);
+                return Ok(self.isolate(target, std::slice::from_ref(failed), &error));
             }
         };
         #[cfg(test)]
@@ -1099,12 +1098,12 @@ impl QueuePublisher {
             Ok(StagedEffects::Failed { position, error })
                 if FailureKind::of(&error) == FailureKind::Deterministic =>
             {
-                let outcome =
-                    self.isolate(target, std::slice::from_ref(&selection[position]), &error);
-                // Nothing committed: the next selection, without the held
-                // entity, reuses the queue.
-                self.store.retained().retain(target, stored, &[]);
-                return Ok(outcome);
+                // A hold drops the queue (see `Self::isolate`).
+                return Ok(self.isolate(
+                    target,
+                    std::slice::from_ref(&selection[position]),
+                    &error,
+                ));
             }
             // Planning proved the transaction cannot commit.
             Ok(StagedEffects::Failed { error, .. }) | Err(error)
@@ -1430,12 +1429,19 @@ impl QueuePublisher {
     /// repaired. The rotation moves past it, so the rest of its generation
     /// keeps publishing; from the second entity in a row that fails without a
     /// publication between, the next attempt backs off instead (see
-    /// `TargetSchedule::failed_holds`). Nothing is acknowledged or dropped,
+    /// `TargetSchedule::failed_holds`). Nothing is acknowledged or discarded,
     /// and nothing durable records the hold: a restarted publisher plans the
     /// entity again and holds it back again if it still fails. A text epoch
     /// is planned as a whole, so its failure does not name an entity; a
     /// failed epoch of several entities halves the text entity ceiling
     /// instead, until a failing epoch is one entity.
+    ///
+    /// The caller drops its queue after a hold, as after any blocked
+    /// operation ([`super::storage::RetainedQueues`]), so the next attempt
+    /// reads storage and sees every newer write, including one that repairs a
+    /// held entity. Retaining it would let held entities whose retries keep
+    /// falling due keep every attempt on that queue, so no newer write would
+    /// ever publish.
     fn isolate(
         &self,
         target: QueueTarget,
@@ -1593,10 +1599,9 @@ impl QueuePublisher {
             .collect::<std::result::Result<Vec<_>, _>>()
         {
             Ok(effects) => effects,
+            // A hold drops the queue (see `Self::isolate`).
             Err((failed, error)) => {
-                let outcome = self.isolate(target, std::slice::from_ref(failed), &error);
-                self.store.retained().retain(target, stored, &[]);
-                return Ok(outcome);
+                return Ok(self.isolate(target, std::slice::from_ref(failed), &error));
             }
         };
         #[cfg(test)]
@@ -1647,9 +1652,11 @@ impl QueuePublisher {
             }
             Err(error) if FailureKind::of(&error) == FailureKind::Deterministic => {
                 let outcome = self.isolate(target, &selection, &error);
-                // Nothing committed: the next, narrower epoch reuses the
-                // queue.
-                self.store.retained().retain(target, stored, &[]);
+                if outcome == PublicationOutcome::Trimmed {
+                    // Nothing committed: the next, narrower epoch reuses the
+                    // queue. A hold drops it (see `Self::isolate`).
+                    self.store.retained().retain(target, stored, &[]);
+                }
                 return Ok(outcome);
             }
             Err(error) => return Err(error),
```

---

### Incident Patch 9: `3099a264` (2026-10-04)
**Commit Message**: fix(db): retry entities held back after failed planning

A failure outside an entity's own input, such as missing namespace
metadata, held back every queued entity one immediate attempt at a time,
and nothing planned them again until a write or a restart, which a held
delete never gets. A failure hold now repairs its entity again once
MAX_STALLED_WAIT passes, a stalled generation wakes at the first such
retry, and from the second hold in a row without a publication the next
attempt backs off. The docs now say a held entity's writes keep using
the index's shared queue capacity, and llms-full.txt is regenerated.

**File**: `crates/db/src/index_lifecycle/queue/isolation_tests.rs` (modified, +155/-4)
```diff
@@ -9,9 +9,11 @@
 //!
 //! [`PublicationHooks::planning_failures`]: super::publication::test_hooks::PublicationHooks
 
+use std::collections::HashSet;
 use std::num::NonZeroU64;
 use std::sync::atomic::Ordering;
 use std::sync::Arc;
+use std::time::{Duration, Instant};
 
 use helix_ast::{
     batch, graph::NodeRef, query::QueryRequest, query::SearchConsistency, traversal,
@@ -22,11 +24,13 @@ use slatedb::object_store::ObjectStore;
 
 use super::overlay_tests::{text_search, vector_search, write};
 use super::publication::test_hooks::InjectedPlanningFailure;
-use super::publication::{FailureKind, PublicationOutcome};
+use super::publication::{FailureKind, NextTarget, PublicationOutcome, QueuePublisher};
 use super::publication_tests::{install_vector, publisher};
-use super::tests::{add_doc, install_vector_and_text, open, queue, queued, target};
+use super::tests::{
+    add_doc, install_vector_and_text, open, publisher_with_limits, queue, queued, target,
+};
 use super::QueueTarget;
-use crate::config::{IndexOperationQueueTuning, TextIndexDefinition};
+use crate::config::{DbConfig, IndexOperationQueueTuning, TextIndexDefinition};
 use crate::encoding::v2::values::indexes::operation_queue::{QueueFamily, QueuedOperationId};
 use crate::error::HelixDbError;
 use crate::index_lifecycle::ValidatedDynamicIndexDefinition;
@@ -88,7 +92,15 @@ async fn newest(db: &HelixDB, family: QueueFamily, id: u64) -> QueuedOperationId
 }
 
 fn inject(db: &HelixDB, operation: QueuedOperationId, failure: Option<InjectedPlanningFailure>) {
-    let mut failures = publisher(db).hooks().planning_failures.lock();
+    inject_into(publisher(db), operation, failure);
+}
+
+fn inject_into(
+    publisher: &QueuePublisher,
+    operation: QueuedOperationId,
+    failure: Option<InjectedPlanningFailure>,
+) {
+    let mut failures = publisher.hooks().planning_failures.lock();
     match failure {
         Some(failure) => failures.insert(operation, failure),
         None => failures.remove(&operation),
@@ -329,6 +341,145 @@ async fn a_vector_entity_failing_after_planned_ones_is_the_one_held_back() {
     db.close().await.unwrap();
 }
 
+/// An entity whose planning failed is planned again once its retry is due,
+/// without a write: a stalled generation waits only until that retry, an
+/// entity that still fails is held back again, and one whose failure was
+/// repaired publishes.
+#[tokio::test]
+async fn a_failed_entity_is_planned_again_once_its_retry_is_due() {
+    let db = open("isolate-retry", Arc::new(InMemory::new()), queued(tuning())).await;
+    install_vector(&db, None).await;
+    let failing = add_doc(&db, vec![1.0, 0.0], "doc").await.unwrap();
+    let target = target(&db, QueueFamily::Vector).await;
+    settle(&db, target).await;
+    // The writer's own publisher never schedules in tests; one with the same
+    // limits does.
+    let defaults = DbConfig::new().search_index_backfill();
+    let scheduler = publisher_with_limits(&db, defaults.batch(), defaults.active_text_mutation());
+    set(&db, failing, "embedding", vec![5.0_f32, 5.0].into()).await;
+    let corrupt = newest(&db, QueueFamily::Vector, failing).await;
+    inject_into(&scheduler, corrupt, Some(InjectedPlanningFailure::Corrupt));
+    let blocked =
+        |scheduler: &QueuePublisher| scheduler.metrics().blocked_attempts.load(Ordering::Relaxed);
+    assert_eq!(
+        scheduler.publish_once(target).await.unwrap(),
+        PublicationOutcome::Blocked
+    );
+    let stalled = Instant::now();
+    assert_eq!(
+        scheduler.publish_once(target).await.unwrap(),
+        PublicationOutcome::Stalled,
+        "the retry is not due yet"
+    );
+    let none = HashSet::new();
+    let NextTarget::Delayed(deadline) = scheduler.next_target(&none, stalled) else {
+        panic!("a held entity waits for its retry");
+    };
+    assert!(
+        deadline < stalled + Duration::from_secs(60),
+        "the stall ends when the retry is due, not a full wait after the stall"
+    );
+    assert_eq!(
+        scheduler.next_target(&none, deadline),
+        NextTarget::Ready(target)
+    );
+
+    // Still failing when due: planned once more and held back again.
+    scheduler.make_failed_retries_due();
+    assert_eq!(
+        scheduler.publish_once(target).await.unwrap(),
+        PublicationOutcome::Blocked
+    );
+    assert_eq!(blocked(&scheduler), 2);
+    assert_eq!(
+        scheduler.publish_once(target).await.unwrap(),
+        PublicationOutcome::Stalled
+    );
+    assert_eq!(blocked(&scheduler), 2, "a failed retry waits for the next");
+
+    // Once what failed is repaired, the due retry publishes it.
+    inject_into(&scheduler, corrupt, None);
+    scheduler.make_failed_retries_due();
+    assert_eq!(
+        scheduler.publish_once(target).await.unwrap(),
+        PublicationOutcome::Published {
+            operations: 1,
+            entities: 1
+        }
+    );
+    assert!(scheduler.blocked_entities().is_empty());
+    assert!(queu
```

**File**: `crates/db/src/index_lifecycle/queue/mod.rs` (modified, +11/-3)
```diff
@@ -170,9 +170,17 @@ pub struct IndexOperationQueueStats {
 /// from its published state and planning that change succeeds: removing a
 /// document published under larger limits, or relinking a deleted vector's
 /// neighbors, can exceed the lowered limits too. Raising the limits again
-/// lets it publish. An entity held back after its planning failed is planned
-/// again only on a later write to it or once the writer restarts, so after
-/// repairing what failed, write it again or restart the writer.
+/// lets it publish. An entity held back after its planning failed is also
+/// planned again about once a minute without a write, so it publishes on its
+/// own once what failed is repaired, for example restored metadata; a held
+/// delete is never written again, and this is what publishes it.
+///
+/// Its queued operations, and each later write to it, keep counting toward
+/// its index's retained-byte limit until it publishes, a limit the whole
+/// index shares. An entity written over and over while its planning keeps
+/// failing, for example on damaged index rows of its own, therefore fills
+/// that limit, and then writes to every entity of the index fail with
+/// `index_backpressure`. Stop writing it until it publishes.
 ///
 /// Its queued text still counts toward the pending text a strong text search
 /// may analyze in its partition (one text publication's analysis budget),
```

**File**: `crates/db/src/index_lifecycle/queue/publication.rs` (modified, +137/-49)
```diff
@@ -26,8 +26,9 @@
 //!    acknowledgement: vectors through the build planner
 //!    ([`crate::index_lifecycle::vector::publication`]), text as one epoch.
 //!    When planning fails, [`FailureKind`] decides: an entity whose planning
-//!    fails deterministically is held back like one that cannot fit, and the
-//!    rest publish from the next attempt; anything else retries the batch.
+//!    fails deterministically is held back like one that cannot fit, but is
+//!    also retried on a timer, and the rest publish from the next attempt;
+//!    anything else retries the batch.
 //! 7. Stage one acknowledgement naming exactly the published IDs.
 //! 8. Commit through the vector cache's commit fence, release accounting and
 //!    retain the rest of the queue, then retire emptied partition caches and
@@ -83,10 +84,12 @@ const MAX_BACKOFF: Duration = Duration::from_secs(5);
 /// long that work waits once it becomes publishable.
 const MAX_DEFERRED_BACKOFF: Duration = Duration::from_secs(1);
 /// Longest a [`PublicationOutcome::Stalled`] generation waits without new
-/// work. Only a new operation can give it a publishable entity, and one
-/// makes it eligible at once; this bounds how long a retirement, which only
-/// an attempt discovers, leaves its held operations charged before they are
-/// discarded.
+/// work, and how long an entity whose planning failed waits before it is
+/// planned again ([`HeldEntity::Failed`]). A new operation, or a failed
+/// entity's due retry, makes a stalled generation eligible at once; this
+/// bounds how long a retirement, which only an attempt discovers, leaves its
+/// held operations charged before they are discarded, and how soon a failed
+/// entity publishes once what failed is repaired.
 const MAX_STALLED_WAIT: Duration = Duration::from_secs(60);
 /// Most operation IDs one discard transaction acknowledges (about a 1 MiB
 /// map operand); the operand and output bounds may lower it further.
@@ -112,8 +115,10 @@ pub(crate) enum PublicationOutcome {
     Trimmed,
     /// One operation's effect and acknowledgement cannot fit an output budget,
     /// or planning one entity failed deterministically, so its entity is held
-    /// back until a later operation supersedes it; retry immediately with the
-    /// generation's other entities.
+    /// back until a later operation supersedes it (or, after a failure, until
+    /// its retry is due); retry immediately with the generation's other
+    /// entities, or after backoff once two entities in a row failed to plan
+    /// without a publication between them.
     Blocked,
     /// Every queued entity is held back after blocking; nothing was attempted.
     /// The generation waits for a new operation rather than retrying on a
@@ -164,6 +169,12 @@ struct TargetSchedule {
     eligibility: Eligibility,
     /// Consecutive attempts without progress.
     failures: u32,
+    /// Entities held back after failing to plan since the generation last
+    /// published. A failure outside one entity's input, such as a partition's
+    /// missing metadata, fails every entity in turn, so from the second such
+    /// hold on, the next attempt backs off rather than holding back the whole
+    /// queue one immediate attempt at a time.
+    failed_holds: u32,
     /// Entities held back because a lone operation of theirs could not fit a
     /// publication or failed to plan, or draining after their repair. Process
     /// memory only: a restarted publisher rediscovers blocked entities by
@@ -209,13 +220,27 @@ struct TargetSchedule {
 /// last one is acknowledged. Strong searches overlay every queued operation
 /// and never observe it; eventual searches that do not reach the entity
 /// within their budget can.
+///
+/// An entity whose planning failed is also repaired, at full width, once its
+/// retry is due, without a newer operation: what failed may be repaired by
+/// then, for example restored metadata, and a held delete is never written
+/// again.
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 pub(crate) enum HeldEntity {
     /// Skipped until an operation newer than `through` is queued.
     Waiting {
         /// Newest operation of the entity known not to publish.
         through: QueuedOperationId,
     },
+    /// Planning failed deterministically ([`QueuePublisher::isolate`]):
+    /// skipped until an operation newer than `through` is queued, or until
+    /// `retry`.
+    Failed {
+        /// Newest operation of the entity known not to publish.
+        through: QueuedOperationId,
+        /// When the same operations are planned again.
+        retry: Instant,
+    },
     /// Published its newest selected state, but operations past the last one
     /// acknowledged, `through`, are still queued: repaired again at full
     /// width. Not blocked.
@@ -237,24 +262,26 @@ pub(crate) enum HeldEntity {
 
 impl HeldEntity {
     /// Operations the entity's next repair takes from `queued`, its queued
-    /// op
```

**File**: `crates/db/tests/production_support/queue_publication.rs` (modified, +30/-5)
```diff
@@ -555,6 +555,31 @@ async fn selection_and_collapse_boundaries() {
         )),
         [(second, 1, 0)]
     );
+    // An entity that failed to plan waits like a blocked one until its retry
+    // is due, then is repaired alone at full width without a newer operation.
+    let failed = |retry| {
+        HashMap::from([(
+            vector[0].entity(),
+            HeldEntity::Failed {
+                through: vector[1].id(),
+                retry,
+            },
+        )])
+    };
+    assert_eq!(
+        shape(&select(
+            2,
+            &failed(Instant::now() + MAX_STALLED_WAIT),
+            all,
+            all,
+            u64::MAX
+        )),
+        [(second, 1, 0)]
+    );
+    assert_eq!(
+        shape(&select(2, &failed(Instant::now()), all, all, u64::MAX)),
+        [(first, 2, 0)]
+    );
 
     assert!(matches!(
         collapse_vector(&SelectedEntity {
@@ -953,8 +978,8 @@ enum Change {
 
 /// Proves publication fails closed when a namespace's metadata disagrees with
 /// its definition or is missing, for both removals and upserts: it writes
-/// nothing and holds back only the entity it planned, which a publisher
-/// restarted after the metadata is restored publishes.
+/// nothing and holds back only the entity it planned, whose retry publishes
+/// it without another write once the metadata is restored.
 async fn inconsistent_namespace_metadata_fails_closed() {
     let db = open_explicit(
         "queue-publication-metadata",
@@ -1054,11 +1079,11 @@ async fn inconsistent_namespace_metadata_fails_closed() {
                 .await
                 .expect("a held entity waits"),
             PublicationOutcome::Stalled,
-            "only a write or a restart plans a held entity again"
+            "a held entity waits for a write or its retry"
         );
-        let restarted = publisher_with_limits(&db, publisher.limits, publisher.text.limits);
+        publisher.make_failed_retries_due();
         assert!(matches!(
-            restarted
+            publisher
                 .publish_once(target)
                 .await
                 .expect("restored metadata publishes"),
```

**File**: `docs/database/helix-db/query-guides/troubleshooting.mdx` (modified, +5/-2)
```diff
@@ -102,8 +102,11 @@ fits the lowered limits.
 The worker also holds back a single vector or text entry whose update fails the same
 way every time it is applied, for example on damaged index data, and keeps publishing
 the rest of the index. It counts under `blocked_index_entity_count` too, and the logged
-error names the entry and the failure. Writing the entry again retries it, and so does
-restarting the writer.
+error names the entry and the failure. The worker retries the entry about once a
+minute, so it publishes on its own once the cause is fixed. Until then, every write to
+that entry stays queued and counts toward the index's limit on unpublished work, so
+writing it over and over can fill the limit and return `index_backpressure` for writes
+to the whole index. Stop writing the entry until it publishes.
 
 ## Request returns HTTP 429 (Helix Cloud)
 
```

**File**: `docs/llms-full.txt` (modified, +9/-0)
```diff
@@ -5581,6 +5581,15 @@ error naming each one when it is held back. Raise the limits again. Rewriting or
 deleting a document also clears it once replacing or removing its published version
 fits the lowered limits.
 
+The worker also holds back a single vector or text entry whose update fails the same
+way every time it is applied, for example on damaged index data, and keeps publishing
+the rest of the index. It counts under `blocked_index_entity_count` too, and the logged
+error names the entry and the failure. The worker retries the entry about once a
+minute, so it publishes on its own once the cause is fixed. Until then, every write to
+that entry stays queued and counts toward the index's limit on unpublished work, so
+writing it over and over can fill the limit and return `index_backpressure` for writes
+to the whole index. Stop writing the entry until it publishes.
+
 ## Request returns HTTP 429 (Helix Cloud)
 
 `rate_limited` means the shared request bucket for the Cloud database has no
```

---

### Incident Patch 10: `bf11b6b2` (2026-10-04)
**Commit Message**: ci: shift vector coverage line anchors past the self-link fix

The self-link fix moved lines in the HNSW mutation module, so the
line-anchored vector coverage dispositions and exclusions there now
name the same source lines at their new positions.

**File**: `scripts/db-production-coverage-dispositions.json` (modified, +67/-67)
```diff
@@ -92,85 +92,85 @@
       484,
       498,
       499,
-      526,
-      533,
-      537,
-      540,
+      529,
+      536,
       541,
-      554,
-      555,
-      605,
+      544,
+      545,
+      558,
+      559,
       609,
       613,
-      665,
+      617,
       669,
       673,
-      726,
-      740,
-      780,
-      799,
-      804,
-      893,
-      929,
-      938,
-      949,
+      677,
+      730,
+      744,
+      784,
+      803,
+      808,
+      898,
+      934,
+      943,
       954,
-      966,
-      1007,
-      1015,
-      1039,
-      1043,
-      1096,
-      1099,
-      1100,
-      1115,
-      1122,
-      1126,
-      1312,
-      1349,
+      959,
+      971,
+      1018,
+      1027,
+      1051,
+      1055,
+      1113,
+      1116,
+      1117,
+      1132,
+      1139,
+      1143,
+      1329,
       1366,
-      1473,
-      1479,
-      1480,
-      1495,
-      1569,
-      1583,
-      1592,
-      1601,
+      1383,
+      1490,
+      1496,
+      1497,
+      1512,
+      1586,
+      1600,
       1609,
-      1616,
-      1623,
+      1618,
+      1626,
       1633,
-      1663,
-      1692,
-      1730,
-      1734,
-      1822,
-      1862,
-      1932,
-      2022,
-      2043,
-      2049,
-      2084,
-      2086,
-      2091,
-      2100,
-      2110,
-      2125,
-      2127,
+      1640,
+      1650,
+      1680,
+      1709,
+      1748,
+      1752,
+      1840,
+      1880,
+      1950,
+      2040,
+      2061,
+      2067,
+      2102,
+      2104,
+      2109,
+      2118,
       2128,
-      2129,
-      2130,
-      2131,
-      2134,
-      2135,
-      2142,
+      2143,
+      2145,
+      2146,
+      2147,
+      2148,
       2149,
-      2158,
+      2152,
+      2153,
+      2160,
       2167,
-      2693,
-      3691,
-      3941
+      2176,
+      2185,
+      2711,
+      3709,
+      3959
     ],
     "classification": "named-test",
     "evidence": "vector_mutation_cache_exercises_closed_state_transitions",
```

**File**: `scripts/db-production-coverage-exclusions.json` (modified, +3/-3)
```diff
@@ -601,19 +601,19 @@
   },
   {
     "path": "crates/db/src/search/vector/hnsw/mutation/mod.rs",
-    "line": 3720,
+    "line": 3738,
     "reason": "Only shrink_to evicts without a transaction, and it runs only on sessions the lifecycle driver retained. The driver retains a session only when it holds no unflushed rows, after flush_all has written every dirty neighbor for the step, so this arm cannot meet a dirty neighbor row.",
     "evidence": "vector_build_cache_reuses_only_exact_committed_checkpoints"
   },
   {
     "path": "crates/db/src/search/vector/hnsw/mutation/mod.rs",
-    "line": 3816,
+    "line": 3834,
     "reason": "This error value belongs to the platform-gated u64-to-usize payload accounting failure that cannot occur on supported 64-bit production targets.",
     "evidence": "vector_build_cache_reuses_only_exact_committed_checkpoints and db-vector-production-coverage architecture matrix"
   },
   {
     "path": "crates/db/src/search/vector/hnsw/mutation/mod.rs",
-    "line": 3819,
+    "line": 3837,
     "reason": "This closing edge belongs to the platform-gated u64-to-usize payload accounting failure that cannot occur on supported 64-bit production targets.",
     "evidence": "vector_build_cache_reuses_only_exact_committed_checkpoints and db-vector-production-coverage architecture matrix"
   },
```

---

### Incident Patch 11: `7b19fc9f` (2026-10-04)
**Commit Message**: fix(db): hold back only the entity whose index planning fails

Planning one queued operation could fail the same way on every attempt,
for example on damaged graph rows. Publication retried the whole batch
forever, so its generation stalled, the queue filled, writes failed
with backpressure, and no entity was reported as blocked.

Publication failures are now classified by FailureKind. A deterministic
failure planning one entity holds that entity back through the existing
held-entity state: the vector planner reports the failing effect's
position, and a failed text epoch halves its entity ceiling until one
entity fails alone. The rest of the generation keeps publishing, the
held operations stay queued, and a newer write to the entity, or a
restart, plans it again. Transient failures still retry the batch with
backoff, and a deterministic failure outside one entity's planning
still retries the generation. No stored format changes.

**File**: `crates/db/src/index_lifecycle/queue/isolation_tests.rs` (added, +469/-0)
```diff
@@ -0,0 +1,469 @@
+//! Deterministic planning failures hold back only their own entity, while
+//! transient failures still retry the whole batch.
+//!
+//! Failures are injected through [`PublicationHooks::planning_failures`],
+//! keyed by the operation an entity's selection ends at, so a newer write to
+//! the entity supersedes one. A corrupt injection fails the real planner: a
+//! vector replacement of the wrong dimension, or a text effect naming the
+//! other element kind.
+//!
+//! [`PublicationHooks::planning_failures`]: super::publication::test_hooks::PublicationHooks
+
+use std::num::NonZeroU64;
+use std::sync::atomic::Ordering;
+use std::sync::Arc;
+
+use helix_ast::{
+    batch, graph::NodeRef, query::QueryRequest, query::SearchConsistency, traversal,
+    value::PropertyInput,
+};
+use slatedb::object_store::memory::InMemory;
+use slatedb::object_store::ObjectStore;
+
+use super::overlay_tests::{text_search, vector_search, write};
+use super::publication::test_hooks::InjectedPlanningFailure;
+use super::publication::{FailureKind, PublicationOutcome};
+use super::publication_tests::{install_vector, publisher};
+use super::tests::{add_doc, install_vector_and_text, open, queue, queued, target};
+use super::QueueTarget;
+use crate::config::{IndexOperationQueueTuning, TextIndexDefinition};
+use crate::encoding::v2::values::indexes::operation_queue::{QueueFamily, QueuedOperationId};
+use crate::error::HelixDbError;
+use crate::index_lifecycle::ValidatedDynamicIndexDefinition;
+use crate::HelixDB;
+
+/// Paused publication, and eventual searches that overlay no queued work, so
+/// they see exactly what is published.
+fn tuning() -> IndexOperationQueueTuning {
+    IndexOperationQueueTuning::default().with_eventual_search_budget_for_tests(0)
+}
+
+async fn install_text(db: &HelixDB) {
+    db.install_index_for_tests(
+        ValidatedDynamicIndexDefinition::try_from(
+            TextIndexDefinition::new_node("Doc", "body").unwrap(),
+        )
+        .unwrap(),
+    )
+    .await
+    .unwrap();
+}
+
+async fn set(db: &HelixDB, id: u64, property: &'static str, value: PropertyInput) {
+    write(db, || {
+        QueryRequest::write(
+            batch::write_batch().var_as(
+                "updated",
+                traversal::g()
+                    .n(NodeRef::from(id))
+                    .set_property(property, value.clone()),
+            ),
+        )
+    })
+    .await;
+}
+
+/// Entity IDs of `family`'s queued operations, in queue order.
+async fn queued_ids(db: &HelixDB, family: QueueFamily) -> Vec<u64> {
+    queue(db, family).await.map_or_else(Vec::new, |queue| {
+        queue
+            .operations()
+            .iter()
+            .map(|operation| operation.entity().id.get())
+            .collect()
+    })
+}
+
+/// The newest queued operation of entity `id` in `family`'s queue.
+async fn newest(db: &HelixDB, family: QueueFamily, id: u64) -> QueuedOperationId {
+    queue(db, family)
+        .await
+        .unwrap()
+        .operations()
+        .iter()
+        .rev()
+        .find(|operation| operation.entity().id.get() == id)
+        .unwrap()
+        .id()
+}
+
+fn inject(db: &HelixDB, operation: QueuedOperationId, failure: Option<InjectedPlanningFailure>) {
+    let mut failures = publisher(db).hooks().planning_failures.lock();
+    match failure {
+        Some(failure) => failures.insert(operation, failure),
+        None => failures.remove(&operation),
+    };
+}
+
+/// Publishes `target` until only held-back work is left, returning every
+/// outcome.
+async fn settle(db: &HelixDB, target: QueueTarget) -> Vec<PublicationOutcome> {
+    let mut outcomes = Vec::new();
+    for _ in 0..32 {
+        let outcome = publisher(db).publish_once(target).await.unwrap();
+        outcomes.push(outcome);
+        match outcome {
+            PublicationOutcome::Stalled | PublicationOutcome::Empty => return outcomes,
+            PublicationOutcome::Published { .. }
+            | PublicationOutcome::Trimmed
+            | PublicationOutcome::Blocked => {}
+            PublicationOutcome::Discarded { .. }
+            | PublicationOutcome::Deferred
+            | PublicationOutcome::Retry => panic!("publication did not progress: {outcomes:?}"),
+        }
+    }
+    panic!("publication did not settle: {outcomes:?}")
+}
+
+/// The published entity nearest `point`.
+async fn published_nearest(db: &HelixDB, point: [f32; 2]) -> Option<u64> {
+    vector_search(db, point, 1, None, SearchConsistency::Eventual)
+        .await
+        .first()
+        .map(|(id, _)| *id)
+}
+
+async fn published_text(db: &HelixDB, term: &str) -> Vec<u64> {
+    text_search(db, term, 10, None, SearchConsistency::Eventual)
+        .await
+        .into_iter()
+        .map(|(id, _)| id)
+        .collect()
+}
+
+fn held(db: &HelixDB) -> Vec<u64> {
+    db.blocked_index_entities()
+        .into_iter()
+        .map(|entity| entity.id.get())
+        .collect()
+}
+
+#[test]
+fn failures_are
```

**File**: `crates/db/src/index_lifecycle/queue/mod.rs` (modified, +18/-8)
```diff
@@ -86,10 +86,12 @@ pub struct IndexOperationQueueStats {
     /// Publication commits with an unknown outcome.
     pub uncertain_commits: u64,
     /// Attempts retried with fewer entities or operations after exceeding an
-    /// output budget.
+    /// output budget, or with fewer text entities after planning a text epoch
+    /// failed deterministically.
     pub output_retries: u64,
-    /// Attempts where one operation's effect and acknowledgement alone
-    /// exceeded an output budget, holding its entity back.
+    /// Attempts that held an entity back: one operation's effect and
+    /// acknowledgement alone exceeded an output budget, or planning the
+    /// entity failed deterministically.
     pub blocked_attempts: u64,
     /// Entities held back right now (a gauge, unlike the publication
     /// counters): see [`crate::HelixDB::blocked_index_entities`].
@@ -136,15 +138,18 @@ pub struct IndexOperationQueueStats {
     /// Attempts that must rediscover and retry: commit conflicts, uncertain
     /// commits, retryable errors, and ownership changes after classification.
     pub publication_retries: u64,
-    /// Retries caused by a retryable storage or decoding error.
+    /// Retries caused by an error: a transient one, such as storage I/O, or a
+    /// deterministic one that no single entity's planning raised.
     pub publication_error_retries: u64,
     /// Attempts deferred because a hidden build owns the generation.
     pub deferred_attempts: u64,
 }
 
 /// One entity whose queued vector/text work is held back because one of its
 /// operations alone can never fit a publication under the current limits,
-/// for example after they were lowered.
+/// for example after they were lowered, or because planning its change fails
+/// deterministically, for example on damaged index rows or a corrupt queued
+/// payload.
 ///
 /// It blocks only its own publication: the rest of its generation keeps
 /// publishing. Its operations stay queued, so strong searches keep serving
@@ -162,9 +167,12 @@ pub struct IndexOperationQueueStats {
 /// the entity within their budget can.
 ///
 /// A rewrite or delete repairs it only once one publication fits the change
-/// from its published state: removing a document published under larger
-/// limits, or relinking a deleted vector's neighbors, can exceed the lowered
-/// limits too. Raising the limits again lets it publish.
+/// from its published state and planning that change succeeds: removing a
+/// document published under larger limits, or relinking a deleted vector's
+/// neighbors, can exceed the lowered limits too. Raising the limits again
+/// lets it publish. An entity held back after its planning failed is planned
+/// again only on a later write to it or once the writer restarts, so after
+/// repairing what failed, write it again or restart the writer.
 ///
 /// Its queued text still counts toward the pending text a strong text search
 /// may analyze in its partition (one text publication's analysis budget),
@@ -245,6 +253,8 @@ impl QueueTarget {
 #[cfg(test)]
 mod codec_storage_tests;
 #[cfg(test)]
+mod isolation_tests;
+#[cfg(test)]
 mod layout_tests;
 #[cfg(test)]
 mod lifecycle_tests;
```

**File**: `crates/db/src/index_lifecycle/queue/publication.rs` (modified, +361/-49)
```diff
@@ -25,6 +25,9 @@
 //! 6. Stage the longest prefix of entities whose exact output fits beside the
 //!    acknowledgement: vectors through the build planner
 //!    ([`crate::index_lifecycle::vector::publication`]), text as one epoch.
+//!    When planning fails, [`FailureKind`] decides: an entity whose planning
+//!    fails deterministically is held back like one that cannot fit, and the
+//!    rest publish from the next attempt; anything else retries the batch.
 //! 7. Stage one acknowledgement naming exactly the published IDs.
 //! 8. Commit through the vector cache's commit fence, release accounting and
 //!    retain the rest of the queue, then retire emptied partition caches and
@@ -103,12 +106,14 @@ pub(crate) enum PublicationOutcome {
     Deferred,
     /// A serializable conflict or uncertain commit; rediscover and retry.
     Retry,
-    /// Exact output crossed a budget before anything fit; retry immediately
-    /// with fewer text entities, or fewer operations.
+    /// Exact output crossed a budget before anything fit, or planning a text
+    /// epoch failed deterministically; retry immediately with fewer text
+    /// entities, or fewer operations.
     Trimmed,
     /// One operation's effect and acknowledgement cannot fit an output budget,
-    /// so its entity is held back until a later operation supersedes it;
-    /// retry immediately with the generation's other entities.
+    /// or planning one entity failed deterministically, so its entity is held
+    /// back until a later operation supersedes it; retry immediately with the
+    /// generation's other entities.
     Blocked,
     /// Every queued entity is held back after blocking; nothing was attempted.
     /// The generation waits for a new operation rather than retrying on a
@@ -160,15 +165,16 @@ struct TargetSchedule {
     /// Consecutive attempts without progress.
     failures: u32,
     /// Entities held back because a lone operation of theirs could not fit a
-    /// publication, or draining after their repair. Process memory only: a
-    /// restarted publisher rediscovers blocked entities by blocking again,
-    /// and publishes a draining entity's remaining operations in regular
-    /// batches (see [`HeldEntity`]).
+    /// publication or failed to plan, or draining after their repair. Process
+    /// memory only: a restarted publisher rediscovers blocked entities by
+    /// blocking again, and publishes a draining entity's remaining operations
+    /// in regular batches (see [`HeldEntity`]).
     held: HashMap<IndexEntity, HeldEntity>,
 }
 
 /// One entity held back after one of its operations could not fit a
-/// publication.
+/// publication, or failed to plan deterministically
+/// ([`QueuePublisher::isolate`]).
 ///
 /// A held entity is selected only alone, as a repair, once the rotation
 /// reaches it ahead of every entity that is not held back; a batch the
@@ -354,11 +360,23 @@ impl Drop for AttemptClaim<'_> {
 pub(crate) mod test_hooks {
     //! Deterministic interleaving and failure seams for publication tests.
 
+    use std::collections::HashMap;
     use std::sync::atomic::AtomicBool;
+    use std::sync::Arc;
 
     use parking_lot::Mutex;
     use tokio::sync::oneshot;
 
+    use super::SelectedEntity;
+    use crate::encoding::v2::values::indexes::operation_queue::{
+        QueuedOperationId, QueuedVectorReplacement,
+    };
+    use crate::error::{HelixDbError, Result};
+    use crate::index_lifecycle::text::active_batch::QueuedTextEffect;
+    use crate::index_lifecycle::vector::publication::QueuedVectorEffect;
+    use crate::index_lifecycle::work::TextPartition;
+    use crate::index_lifecycle::IndexElementKind;
+
     /// Test-only controls installed on one publisher.
     #[derive(Debug, Default)]
     pub(crate) struct PublicationHooks {
@@ -380,6 +398,108 @@ pub(crate) mod test_hooks {
         /// Row-batch fetch policy of the last staged vector attempt's
         /// mutation indexes.
         pub(crate) batch_reads: Mutex<Option<crate::batch_reads::BatchReads>>,
+        /// Failures injected into planning an entity whose newest selected
+        /// operation is the key, so a newer operation supersedes one.
+        pub(crate) planning_failures: Mutex<HashMap<QueuedOperationId, InjectedPlanningFailure>>,
+    }
+
+    /// A failure injected into planning one entity.
+    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
+    pub(crate) enum InjectedPlanningFailure {
+        /// The entity plans as a corrupt payload would, so planning fails the
+        /// same way on every attempt: a vector replacement of the wrong
+        /// dimension, or a text effect naming the other element kind.
+        Corrupt,
+        /// Planning the entity fails with an object-store error, as an
+        /// outage would.
+        Unavailable,
+    }
+
+    impl PublicationHooks {
+        /// The failure injected into planning each of `selection`'s
+        /// entities, in order.
+        pub(crate) 
```

**File**: `crates/db/src/index_lifecycle/queue/publication_tests.rs` (modified, +33/-22)
```diff
@@ -1554,27 +1554,32 @@ async fn an_active_namespace_without_metadata_fails_closed_and_writes_nothing()
         )
         .await
         .unwrap();
-    add_doc(&db, vec![2.0, 2.0], "c").await.unwrap();
+    let inserted = add_doc(&db, vec![2.0, 2.0], "c").await.unwrap();
     let keys = all_keys(&db).await;
     let rows = unpartitioned_vector_rows(&db).await;
-    let errors = publisher(&db)
-        .metrics()
-        .error_retries
-        .load(Ordering::Relaxed);
 
     // Only a build creates a missing namespace, so publication never
-    // recreates it over rows search can no longer reach.
+    // recreates it over rows search can no longer reach: planning the insert
+    // fails, which holds it back.
     assert_eq!(
         publisher(&db).publish_once(target).await.unwrap(),
-        PublicationOutcome::Retry
+        PublicationOutcome::Blocked
+    );
+    assert_eq!(
+        publisher(&db)
+            .blocked_entities()
+            .into_iter()
+            .map(|(_, entity)| entity.id.get())
+            .collect::<Vec<_>>(),
+        [inserted]
     );
     assert_eq!(
         publisher(&db)
             .metrics()
             .error_retries
             .load(Ordering::Relaxed),
-        errors + 1,
-        "a missing namespace is an error, not a conflict"
+        0,
+        "a missing namespace fails planning, not storage"
     );
     assert_eq!(
         all_keys(&db).await,
@@ -1616,31 +1621,36 @@ async fn contradict_metadata(db: &HelixDB, physical_index_id: u64) {
 }
 
 /// Asserts `target`'s next attempt fails closed on the contradicting metadata
-/// of namespace `physical_index_id`: an error rather than a conflict, which
-/// writes nothing, leaves its one queued operation, and retains no planning
-/// session.
+/// of namespace `physical_index_id`: planning fails, holding back `entity`,
+/// whose one queued operation stays queued, and the attempt writes nothing
+/// and retains no planning session.
 async fn assert_contradicting_metadata_fails_closed(
     db: &HelixDB,
     target: QueueTarget,
     physical_index_id: u64,
+    entity: u64,
 ) {
     let keys = all_keys(db).await;
     let rows = physical_rows(db, physical_index_id).await;
-    let errors = publisher(db)
-        .metrics()
-        .error_retries
-        .load(Ordering::Relaxed);
     assert_eq!(
         publisher(db).publish_once(target).await.unwrap(),
-        PublicationOutcome::Retry
+        PublicationOutcome::Blocked
+    );
+    assert_eq!(
+        publisher(db)
+            .blocked_entities()
+            .into_iter()
+            .map(|(_, held)| held.id.get())
+            .collect::<Vec<_>>(),
+        [entity]
     );
     assert_eq!(
         publisher(db)
             .metrics()
             .error_retries
             .load(Ordering::Relaxed),
-        errors + 1,
-        "contradicting metadata is an error, not a conflict"
+        0,
+        "contradicting metadata fails planning, not storage"
     );
     assert_eq!(
         all_keys(db).await,
@@ -1688,12 +1698,13 @@ async fn an_upsert_into_contradicting_metadata_fails_closed_and_writes_nothing()
         PublicationOutcome::Published { .. }
     ));
     contradict_metadata(&db, physical_index_id.get()).await;
-    add_doc(&db, vec![2.0, 2.0], "c").await.unwrap();
+    let inserted = add_doc(&db, vec![2.0, 2.0], "c").await.unwrap();
     assert!(publisher(&db)
         .planning_cache()
         .retained_publication(target)
         .is_some());
-    assert_contradicting_metadata_fails_closed(&db, target, physical_index_id.get()).await;
+    assert_contradicting_metadata_fails_closed(&db, target, physical_index_id.get(), inserted)
+        .await;
     db.close().await.unwrap();
 }
 
@@ -1718,7 +1729,7 @@ async fn a_removal_from_contradicting_metadata_fails_closed_and_writes_nothing()
     // The partition keeps another entity, so only the removal reads its
     // metadata; no reclamation runs.
     super::overlay_tests::delete(&db, removed).await;
-    assert_contradicting_metadata_fails_closed(&db, target, partition).await;
+    assert_contradicting_metadata_fails_closed(&db, target, partition, removed).await;
     db.close().await.unwrap();
 }
 
```

**File**: `crates/db/src/index_lifecycle/vector.rs` (modified, +23/-20)
```diff
@@ -443,26 +443,29 @@ mod tests {
                     *generation,
                 ))
                 .await;
-            let publication::StagedEffects::Prefix { staged, .. } =
-                publication::stage_active_effects(
-                    db,
-                    transaction,
-                    &permit,
-                    handle,
-                    &effects,
-                    SearchIndexBackfillLimits::default().batch(),
-                    AcknowledgementOutput {
-                        operations: 0,
-                        bytes: 0,
-                    },
-                    &resources,
-                    cache_writes,
-                    None,
-                    std::num::NonZeroU64::MIN,
-                )
-                .await?
-            else {
-                panic!("every effect fits the default budget");
+            let staged = match publication::stage_active_effects(
+                db,
+                transaction,
+                &permit,
+                handle,
+                &effects,
+                SearchIndexBackfillLimits::default().batch(),
+                AcknowledgementOutput {
+                    operations: 0,
+                    bytes: 0,
+                },
+                &resources,
+                cache_writes,
+                None,
+                std::num::NonZeroU64::MIN,
+            )
+            .await?
+            {
+                publication::StagedEffects::Prefix { staged, .. } => staged,
+                publication::StagedEffects::NoneFits => {
+                    panic!("every effect fits the default budget")
+                }
+                publication::StagedEffects::Failed { error, .. } => return Err(error),
             };
             assert_eq!(staged, expected);
         }
```

**File**: `crates/db/src/index_lifecycle/vector/publication.rs` (modified, +24/-9)
```diff
@@ -94,6 +94,13 @@ pub(crate) enum StagedEffects {
     /// Not even the first effect fits beside the reserved output; nothing was
     /// staged.
     NoneFits,
+    /// Planning the effect at `position` failed with `error`, so the caller
+    /// can tell which entity failed. Every earlier effect is staged and the
+    /// failed one may be partly planned, so the transaction must not commit.
+    Failed {
+        position: usize,
+        error: HelixDbError,
+    },
 }
 
 /// Plans `effects` in order and stages the longest prefix that fits `limits`
@@ -106,6 +113,9 @@ pub(crate) enum StagedEffects {
 /// Planning reuses the session retained after the target's commit numbered
 /// `latest_commit` when that is still the retained one, and offers its own
 /// session for retention at `commit`, the number this attempt's commit takes.
+///
+/// An error planning one effect is [`StagedEffects::Failed`]; an error before
+/// any effect is planned is returned.
 #[allow(
     clippy::too_many_arguments,
     reason = "publication binds the exact storage, generation, budget, planner resources, cache effects, and session checkpoints"
@@ -227,21 +237,15 @@ async fn stage_with_distance<D: Distance>(
         .checkout_publication::<D>(permit, reuse.as_ref(), limits.max_input_bytes())
         .await;
     let mut staged = 0_usize;
-    for effect in effects {
+    for (position, effect) in effects.iter().enumerate() {
         let next = effect
             .replacement
             .as_ref()
             .map(|replacement| VectorIndexedDocument {
                 partition: replacement.partition().clone(),
                 vector: replacement.vector().to_vec(),
             });
-        let EntityPlanOutcome::Admitted {
-            vector_writes,
-            single_vector_output_bytes,
-            lifecycle_operations,
-            lifecycle_bytes,
-            ..
-        } = plan_and_apply::<D>(
+        let planned = match plan_and_apply::<D>(
             &planning,
             &recorder,
             transaction,
@@ -255,7 +259,18 @@ async fn stage_with_distance<D: Distance>(
             &accounting,
             &mut session,
         )
-        .await?
+        .await
+        {
+            Ok(planned) => planned,
+            Err(error) => return Ok(StagedEffects::Failed { position, error }),
+        };
+        let EntityPlanOutcome::Admitted {
+            vector_writes,
+            single_vector_output_bytes,
+            lifecycle_operations,
+            lifecycle_bytes,
+            ..
+        } = planned
         else {
             session.discard_entity();
             break;
```

**File**: `crates/db/src/lib.rs` (modified, +6/-5)
```diff
@@ -3309,11 +3309,12 @@ impl HelixDB {
     /// publisher holds back, in ascending order.
     ///
     /// Each one has an operation that alone can never fit a publication under
-    /// the current limits; see [`BlockedIndexEntity`] for what that means for
-    /// writes and searches, including strong text searches that fail with
-    /// backpressure no publication clears. The list is the publisher's
-    /// process memory: it is empty on a reader and is rebuilt after a
-    /// restart as publication blocks again.
+    /// the current limits, or one whose planning failed deterministically;
+    /// see [`BlockedIndexEntity`] for what that means for writes and
+    /// searches, including strong text searches that fail with backpressure
+    /// no publication clears. The list is the publisher's process memory: it
+    /// is empty on a reader and is rebuilt after a restart as publication
+    /// blocks again.
     pub fn blocked_index_entities(&self) -> Vec<BlockedIndexEntity> {
         let Some(publisher) = &self.inner.index_queue_publisher else {
             return Vec::new();
```

**File**: `crates/db/tests/production_support/queue_publication.rs` (modified, +29/-9)
```diff
@@ -7,7 +7,7 @@
 //! fixture's indexes and is then reopened explicitly over the same store.
 //! Graph writes enqueue every operation through the production producer.
 //! Failure contracts stage one unobserved acknowledgement, corrupt one queue
-//! value, rewrite one namespace's metadata through the current codecs, hold
+//! value, rewrite or delete one namespace's metadata through the current codecs, hold
 //! the planning budget while a catalog change commits, fail WAL uploads, or
 //! fence the writer with a newer one; none introduces a row family or
 //! encoding.
@@ -951,9 +951,10 @@ enum Change {
     Insert([f32; 2]),
 }
 
-/// Proves publication fails closed, writing nothing, when a namespace's
-/// metadata disagrees with its definition or is missing, for both removals
-/// and upserts, and publishes once the metadata is restored.
+/// Proves publication fails closed when a namespace's metadata disagrees with
+/// its definition or is missing, for both removals and upserts: it writes
+/// nothing and holds back only the entity it planned, which a publisher
+/// restarted after the metadata is restored publishes.
 async fn inconsistent_namespace_metadata_fails_closed() {
     let db = open_explicit(
         "queue-publication-metadata",
@@ -1032,26 +1033,45 @@ async fn inconsistent_namespace_metadata_fails_closed() {
             publisher
                 .publish_once(target)
                 .await
-                .expect("inconsistent metadata retries"),
-            PublicationOutcome::Retry
+                .expect("inconsistent metadata holds its entity back"),
+            PublicationOutcome::Blocked
         );
         assert_eq!(
-            load(&publisher.metrics().error_retries),
+            load(&publisher.metrics().blocked_attempts),
             u64::try_from(errors + 1).expect("phase count fits u64"),
-            "inconsistent metadata is an error, not a conflict"
+            "inconsistent metadata fails planning, not storage"
         );
+        assert_eq!(load(&publisher.metrics().error_retries), 0);
+        assert_eq!(publisher.blocked_entity_count(), 1);
         assert_eq!(all_keys(&db).await, keys, "a failed attempt writes nothing");
         storage
             .put(&key, &original)
             .await
             .expect("metadata restores");
-        assert!(matches!(
+        assert_eq!(
             publisher
+                .publish_once(target)
+                .await
+                .expect("a held entity waits"),
+            PublicationOutcome::Stalled,
+            "only a write or a restart plans a held entity again"
+        );
+        let restarted = publisher_with_limits(&db, publisher.limits, publisher.text.limits);
+        assert!(matches!(
+            restarted
                 .publish_once(target)
                 .await
                 .expect("restored metadata publishes"),
             PublicationOutcome::Published { .. }
         ));
+        assert_eq!(
+            publisher
+                .publish_once(target)
+                .await
+                .expect("the drained queue reads empty"),
+            PublicationOutcome::Empty
+        );
+        assert_eq!(publisher.blocked_entity_count(), 0);
     }
     db.close().await.expect("metadata writer closes");
 }
```

---

### Incident Patch 12: `c7d1fde8` (2026-10-04)
**Commit Message**: fix(db): never plan a vector node as its own HNSW neighbor

A link that released versions left without a reverse locator outlives
its target's delete, so re-embedding that node searched back to it
through the link and selected it as its own neighbor, failing planning
with ContainsOwner on every attempt. Both mutation searches and the
beam's entry resolution now skip the inserting node.

A neighbor row that already links its own node failed every mutation
that loaded it. The deployed-row adapter now drops the self-link in
memory; a mutation that changes the row stores it self-free. No codec
or stored format changes.

**File**: `crates/db/src/search/vector/hnsw/mutation/locator_tests.rs` (modified, +257/-12)
```diff
@@ -16,6 +16,11 @@
 //! [`links_released_versions_left_without_locators_outlive_their_target`]
 //! starts from links committed without a locator, as released versions
 //! write them, and pins that no operation here repairs them.
+//!
+//! [`a_committed_self_link_never_fails_its_node`] and
+//! [`damaged_graphs_never_gain_a_self_link`] start from rows that link their
+//! own node, as damage from released versions can leave them, and pin that
+//! every operation still plans and none links a node to itself.
 
 use std::collections::{BTreeMap, BTreeSet};
 use std::sync::Arc;
@@ -515,6 +520,43 @@ async fn one_off_caches_at_their_bound_keep_one_locator_per_link() {
     );
 }
 
+/// Every link from a node to itself.
+fn self_links(graph: &Graph) -> BTreeSet<Link> {
+    graph
+        .links
+        .iter()
+        .filter(|(_, source, target)| source == target)
+        .copied()
+        .collect()
+}
+
+/// Commits `node`'s row at `layer` in `graph` linking `node` too, as damage
+/// from released versions can leave a row: a self-link without a locator.
+async fn commit_self_link<D: Distance>(
+    db: &slatedb::Db,
+    index: &VectorIndex<D>,
+    graph: &Graph,
+    layer: u16,
+    node: NodeId,
+) {
+    let neighbors = graph
+        .links
+        .iter()
+        .filter(|(row_layer, source, _)| (*row_layer, *source) == (layer, node))
+        .map(|(_, _, target)| *target)
+        .chain([node])
+        .collect::<Vec<_>>();
+    let txn = db.begin(IsolationLevel::Snapshot).await.unwrap();
+    let measured = MeasuredVectorTransaction::new(&txn);
+    let rows = VectorWriteRows::new(&measured, index.row_keyspace());
+    match layer {
+        0 => rows.put_layer0_neighbors(node, &neighbors),
+        layer => rows.put_upper_neighbors(layer, node, &neighbors),
+    }
+    .unwrap();
+    txn.commit().await.unwrap();
+}
+
 /// Commits `links` without their locators, as released versions left them.
 async fn commit_without_locators<D: Distance>(
     db: &slatedb::Db,
@@ -647,15 +689,15 @@ async fn released_unlocated_run<D: Distance>() {
     commit_without_locators(&db, &index, &released).await;
     let unlocated = unlocated.union(&released).copied().collect::<BTreeSet<_>>();
     // The re-embedding's delete misses each one-way source, so its insert
-    // searches through one back to the node and links the node to itself.
-    let error = re_embed(&db, &index, &moved, &mut points, target)
+    // searches through one back to the node, which it skips.
+    re_embed(&db, &index, &moved, &mut points, target)
         .await
-        .unwrap_err();
-    assert!(
-        error
-            .to_string()
-            .contains(&format!("neighbor set contains its owner {target}")),
-        "{name}: re-embedding {target}: {error}"
+        .unwrap_or_else(|error| panic!("{name}: re-embedding {target}: {error}"));
+    let re_embedded = Graph::read(&index, db.snapshot().await.unwrap().as_ref()).await;
+    assert_eq!(
+        self_links(&re_embedded),
+        BTreeSet::new(),
+        "{name}: re-embedded {target}"
     );
 
     let mut session = VectorBuildSession::<D>::new(NonZeroU64::new(1 << 20).unwrap());
@@ -716,12 +758,215 @@ async fn released_unlocated_run<D: Distance>() {
 /// value changed, so each link the insert restored kept no locator. A delete
 /// finds a link's source only through that locator or the node's own rows, so
 /// nothing here repairs such a link. Once the node stops linking back, nothing
-/// reaches the link: re-embedding the node fails, as its insert searches
-/// through the link back to the node and links the node to itself, and deleting
-/// the node leaves the link naming a node without an item, which fails searches
-/// that reach it. Every other link and locator stays exact.
+/// reaches the link: re-embedding the node searches through the link back to
+/// the node, which the insert skips rather than linking the node to itself,
+/// and deleting the node leaves the link naming a node without an item, which
+/// fails searches that reach it. Every other link and locator stays exact.
 #[tokio::test]
 async fn links_released_versions_left_without_locators_outlive_their_target() {
     released_unlocated_run::<Euclidean>().await;
     released_unlocated_run::<Cosine>().await;
 }
+
+/// Self-links in every row of a node with upper-layer rows, then an insert
+/// that searches through it, a re-embedding of it, and its delete.
+async fn self_linked_node_run<D: Distance>() {
+    let mut rng = StdRng::seed_from_u64(1);
+    let name = format!("self-linked-node-{}", D::name());
+    let (db, index) = create::<D>(&name).await;
+    let mut points = build(&db, &index, &mut rng, 60).await;
+    let built = Graph::read(&index, db.snapshot().await.unwrap().as_ref()).await;
+    let node = built
+        .rows
+        .iter()
+        .rev()
+        .map(|(_, node)| *node)
+        .next()
+        .unwrap();
+    let damaged = built
+        .rows
+        .iter()
+   
```

**File**: `crates/db/src/search/vector/hnsw/mutation/mod.rs` (modified, +25/-7)
```diff
@@ -511,7 +511,9 @@ impl<D: Distance> VectorIndex<D> {
     ///
     /// Missing items fall through to the writable candidate index and return an
     /// owned item, or `None` when insertion must continue with an empty candidate
-    /// set. Any candidate cleanup remains staged in the caller's measured
+    /// set. The inserting node is never a root, even when stale metadata names
+    /// it: its item is already staged, so it would be its own nearest neighbor.
+    /// Any candidate cleanup remains staged in the caller's measured
     /// transaction; this method never mutates a resident snapshot.
     pub(in crate::search::vector) async fn resolve_beam_entry_point_for_insert(
         &self,
@@ -521,9 +523,10 @@ impl<D: Distance> VectorIndex<D> {
         inserting_node_id: NodeId,
         mutation_cache: &mut MutationOpCache<D>,
     ) -> Result<Option<(NodeId, Item<'static, D>)>, HelixDbError> {
-        if let Some(item) = self
-            .get_item_for_layer_cached(txn, layer, entry_point, mutation_cache)
-            .await?
+        if entry_point != inserting_node_id
+            && let Some(item) = self
+                .get_item_for_layer_cached(txn, layer, entry_point, mutation_cache)
+                .await?
         {
             return Ok(Some((entry_point, item.as_ref().clone())));
         }
@@ -532,6 +535,7 @@ impl<D: Distance> VectorIndex<D> {
             .find_best_entry_candidate_cached(txn, mutation_cache)
             .await?
             && replacement_entry_point != entry_point
+            && replacement_entry_point != inserting_node_id
             && let Some(item) = self
                 .get_item_for_layer_cached(txn, layer, replacement_entry_point, mutation_cache)
                 .await?
@@ -888,6 +892,7 @@ impl<D: Distance> VectorIndex<D> {
                         item,
                         current_entry_point,
                         layer,
+                        node_id,
                         mutation_cache,
                     )
                     .await?;
@@ -976,6 +981,12 @@ impl<D: Distance> VectorIndex<D> {
     /// neighbor/item cache so staged rows are authoritative and speculative
     /// layer-0 reads remain bounded. Missing entry points are resolved through
     /// the write-side recovery contract before expansion begins.
+    ///
+    /// `inserting_node_id` is never a candidate. Its item is staged before the
+    /// search, and a row may still link it: a link released versions left
+    /// without a reverse locator outlives the node's delete (see
+    /// [`Self::stage_delete_with_metadata`]). Admitting it would select the
+    /// node as its own neighbor.
     #[allow(clippy::too_many_arguments)]
     pub(in crate::search::vector) async fn search_layer_beam(
         &self,
@@ -1008,6 +1019,7 @@ impl<D: Distance> VectorIndex<D> {
         else {
             return Ok(Vec::new());
         };
+        visited.insert(inserting_node_id);
         let entry_distance = D::distance(query, &entry_item);
         candidates.push(Reverse(Candidate::try_new(
             resolved_entry_point,
@@ -1081,15 +1093,20 @@ impl<D: Distance> VectorIndex<D> {
     }
 
     /// Greedily descends through reusable item and neighbor cache state.
+    ///
+    /// Like [`Self::search_layer_beam`], it never moves to
+    /// `inserting_node_id`, whose item is already staged.
     async fn search_layer_greedy_for_mutation(
         &self,
         txn: &MeasuredVectorTransaction<'_>,
         query: &Item<'_, D>,
         entry_point: NodeId,
         layer: u16,
+        inserting_node_id: NodeId,
         mutation_cache: &mut MutationOpCache<D>,
     ) -> Result<NodeId, HelixDbError> {
         let mut visited = foldhash::HashSet::default();
+        visited.insert(inserting_node_id);
         let mut current = entry_point;
         let Some(current_item) = self
             .get_item_for_layer_cached(txn, layer, current, mutation_cache)
@@ -1715,9 +1732,10 @@ impl<D: Distance> VectorIndex<D> {
     /// link's locator or the node's own rows, so a link without a locator
     /// from a source the node does not link back survives the delete. A
     /// reinsertion of the node in the same cache then searches through it
-    /// back to the node and fails; otherwise the link dangles. Released
-    /// versions v3.1.0 through v3.4.2 (Docker images through v0.0.9) left links
-    /// without locators on re-embeddings, and nothing here repairs them.
+    /// back to the node, which the search skips, and the link names the node
+    /// again; otherwise the link dangles. Released versions v3.1.0 through
+    /// v3.4.2 (Docker images through v0.0.9) left links without locators on
+    /// re-embeddings, and nothing here repairs them.
     pub(in crate::search::vector) async fn stage_delete_with_metadata(
         &self,
         txn: &MeasuredVectorTransaction<'_>,
```

**File**: `crates/db/src/search/vector/hnsw/neighbor_set.rs` (modified, +29/-7)
```diff
@@ -3,9 +3,10 @@
 //! Persisted neighbor rows retain their deployed byte codecs. The vector core
 //! converts them into [`NeighborSet`] before mutation or difference work, so a
 //! set is always sorted, unique, self-free, and within its layer degree limit.
-//! Historical upper-layer rows may be ordered by distance rather than node ID;
-//! [`NeighborSet::try_from_deployed`] sorts that decoded compatibility input in
-//! memory without rewriting the row. New core state uses the strict canonical
+//! Historical upper-layer rows may be ordered by distance rather than node ID,
+//! and damaged rows may link their own node; [`NeighborSet::try_from_deployed`]
+//! sorts that decoded compatibility input and drops the self-link in memory
+//! without rewriting the row. New core state uses the strict canonical
 //! constructor and encodes through the unchanged existing codecs.
 
 use std::num::NonZeroUsize;
@@ -112,14 +113,20 @@ impl NeighborSet {
 
     /// Adapts a decoded deployed row into canonical runtime order.
     ///
-    /// Existing upper-neighbor rows may retain distance order. Sorting here is
-    /// runtime-only and preserves restart compatibility; duplicates, self-links,
-    /// and degree violations still fail closed as corrupt graph state.
+    /// Existing upper-neighbor rows may retain distance order, and a row
+    /// damaged by a released version may link its own node. Sorting and
+    /// dropping the self-link here are runtime-only: traversal never follows
+    /// a self-link, so the row means the same without it, and a mutation that
+    /// changes the row stores it self-free. Failing instead would fail every
+    /// mutation that loads the row, including the ones that would change it.
+    /// Duplicates and degree violations still fail closed as corrupt graph
+    /// state.
     pub(crate) fn try_from_deployed(
         owner: NodeId,
         degree_limit: NeighborDegreeLimit,
         mut nodes: Vec<NodeId>,
     ) -> Result<Self, NeighborSetError> {
+        nodes.retain(|node| *node != owner);
         nodes.sort_unstable();
         Self::try_from_canonical(owner, degree_limit, nodes)
     }
@@ -270,13 +277,28 @@ mod tests {
     }
 
     #[test]
-    fn deployed_adapter_canonicalizes_order_but_not_corruption() {
+    fn deployed_adapter_canonicalizes_order_and_self_links_but_not_corruption() {
         let set = NeighborSet::try_from_deployed(9, limit(3), vec![3, 1, 2]).unwrap();
         assert_eq!(set.as_slice(), &[1, 2, 3]);
+        // A full row that also links its owner fits once the self-link drops.
+        let set = NeighborSet::try_from_deployed(9, limit(3), vec![3, 9, 1, 2]).unwrap();
+        assert_eq!(set.as_slice(), &[1, 2, 3]);
+        assert!(!set.contains(9));
+        assert_eq!(
+            NeighborSet::try_from_deployed(9, limit(3), vec![9]).unwrap(),
+            NeighborSet::empty(9, limit(3))
+        );
         assert_eq!(
             NeighborSet::try_from_deployed(9, limit(3), vec![2, 1, 2]),
             Err(NeighborSetError::Duplicate(2))
         );
+        assert_eq!(
+            NeighborSet::try_from_deployed(9, limit(3), vec![4, 3, 9, 1, 2]),
+            Err(NeighborSetError::DegreeExceeded {
+                limit: 3,
+                actual: 4
+            })
+        );
     }
 
     #[test]
```

**File**: `crates/db/tests/production_support/vector/mutation.rs` (modified, +40/-5)
```diff
@@ -444,7 +444,14 @@ async fn run_neighbor_write_contracts(db: &Db) {
     let mut mutation_cache = MutationOpCache::<Cosine>::default();
     assert_eq!(
         index
-            .search_layer_greedy_for_mutation(&measured, &item, 999_999, 0, &mut mutation_cache,)
+            .search_layer_greedy_for_mutation(
+                &measured,
+                &item,
+                999_999,
+                0,
+                600,
+                &mut mutation_cache,
+            )
             .await
             .unwrap(),
         999_999
@@ -578,18 +585,46 @@ async fn run_neighbor_write_contracts(db: &Db) {
         .await
         .unwrap();
 
+    // A stored self-link, as damage leaves one, loads without it; a row over
+    // its degree still fails closed.
     let rows = VectorWriteRows::new(&measured, index.row_keyspace());
-    rows.put_layer0_neighbors(701, &[701]).unwrap();
+    rows.put_layer0_neighbors(701, &[2, 701]).unwrap();
+    let mut self_linked = MutationOpCache::<Cosine>::with_degree_limits(8, 4).unwrap();
+    assert_eq!(
+        index
+            .load_neighbors_for_mutation(&measured, 0, 701, &mut self_linked)
+            .await
+            .unwrap(),
+        [2]
+    );
+    rows.put_layer0_neighbors(702, &[702]).unwrap();
+    assert_eq!(
+        index
+            .prefetch_layer0_neighbors_for_mutation(&measured, &[702], &mut self_linked)
+            .await
+            .unwrap(),
+        1
+    );
+    assert_eq!(
+        self_linked
+            .neighbor(MutationOpCache::<Cosine>::node_row_id(0, 702))
+            .unwrap()
+            .current(),
+        &neighbors(702, Vec::new())
+    );
+
+    let over_degree = (1..=9).collect::<Vec<NodeId>>();
+    rows.put_layer0_neighbors(704, &over_degree).unwrap();
     let mut malformed_load = MutationOpCache::<Cosine>::with_degree_limits(8, 4).unwrap();
     assert!(index
-        .load_neighbors_for_mutation(&measured, 0, 701, &mut malformed_load)
+        .load_neighbors_for_mutation(&measured, 0, 704, &mut malformed_load)
         .await
         .is_err());
 
-    rows.put_layer0_neighbors(702, &[702]).unwrap();
+    rows.put_layer0_neighbors(705, &over_degree).unwrap();
     let mut malformed_prefetch = MutationOpCache::<Cosine>::with_degree_limits(8, 4).unwrap();
     assert!(index
-        .prefetch_layer0_neighbors_for_mutation(&measured, &[702], &mut malformed_prefetch)
+        .prefetch_layer0_neighbors_for_mutation(&measured, &[705], &mut malformed_prefetch)
         .await
         .is_err());
 
```

---

### Incident Patch 13: `55532633` (2026-10-02)
**Commit Message**: fix(db): bound strong text overlays and hold back unpublishable entities

Strong text overlays analyzed every pending document of a partition with
no budget. They are now bounded by one text publication's analysis
charge: strong searches fail with retryable index_backpressure past it,
eventual searches keep the oldest prefix within it, and a write batch's
own documents past it fail with index_operation_batch_too_large.

One queued operation that could never fit a publication blocked every
later entity of its generation. It now holds its entity back in process
memory while the rest publish; a newer write repairs it in rotation from
full width, past one acknowledgement when needed, and a generation left
with only held entities waits for a write instead of polling. Queues
retained across uncommitted attempts share one writer-wide budget, and a
stalled retained queue reads storage before waiting.

The ledger wakes the index worker whenever an enqueue commit returns,
committed, uncertain, or cancelled, so a racing write never waits out
the stalled deadline. Health responses report the held-back entity
count. No stored format changes.

**File**: `crates/db/src/config/index_lifecycle_throughput.rs` (modified, +6/-0)
```diff
@@ -177,6 +177,12 @@ impl IndexLifecycleConcurrency {
     pub const fn text_tasks(self) -> NonZeroUsize {
         self.text_tasks
     }
+
+    /// Returns how many queue publication attempts may run at once: one per
+    /// vector and per text task.
+    pub(crate) const fn publication_tasks(self) -> NonZeroUsize {
+        self.vector_tasks.saturating_add(self.text_tasks.get())
+    }
 }
 
 impl Default for IndexLifecycleConcurrency {
```

**File**: `crates/db/src/encoding/v2/values/indexes/operation_queue/mod.rs` (modified, +0/-1)
```diff
@@ -509,7 +509,6 @@ impl OperationQueue {
     }
 
     /// Consumes the queue into its ordered operations.
-    #[cfg(test)]
     pub(crate) fn into_operations(self) -> Vec<QueuedOperation> {
         self.operations
     }
```

**File**: `crates/db/src/error.rs` (modified, +26/-8)
```diff
@@ -84,6 +84,11 @@ pub enum IndexBackpressureResource {
     PendingMembers,
     /// Superseded physical results one search would have to skip.
     SuppressedSearchResults,
+    /// Analysis charge of the committed but unpublished documents one text
+    /// search would analyze in its partition: the conservative charge, text
+    /// bytes plus a fixed overhead per token, that bounds one text
+    /// publication's analysis.
+    PendingTextAnalysisBytes,
 }
 
 impl core::fmt::Display for IndexBackpressureResource {
@@ -92,6 +97,7 @@ impl core::fmt::Display for IndexBackpressureResource {
             Self::RetainedBytes => "retained_bytes",
             Self::PendingMembers => "pending_members",
             Self::SuppressedSearchResults => "suppressed_search_results",
+            Self::PendingTextAnalysisBytes => "pending_text_analysis_bytes",
         })
     }
 }
@@ -109,6 +115,10 @@ pub enum IndexOperationBatchResource {
     /// Distinct entity/generation members staged, bounded by the per-index
     /// pending-member limit.
     PendingMembers,
+    /// Analysis charge of the transaction's own unpublished documents that a
+    /// text search in it would analyze in one partition, bounded by one text
+    /// publication's analysis budget.
+    PendingTextAnalysisBytes,
 }
 
 impl core::fmt::Display for IndexOperationBatchResource {
@@ -117,6 +127,7 @@ impl core::fmt::Display for IndexOperationBatchResource {
             Self::OperandBytes => "operand_bytes",
             Self::RetainedBytes => "retained_bytes",
             Self::PendingMembers => "pending_members",
+            Self::PendingTextAnalysisBytes => "pending_text_analysis_bytes",
         })
     }
 }
@@ -291,11 +302,16 @@ pub enum HelixDbError {
     ///
     /// Either a write transaction was rejected before commit, or a strong
     /// search found more results superseded by committed but unpublished work
-    /// ahead of its answer than it may skip; results superseded by a write's
-    /// own changes never count. Eventual searches never fail this way.
-    /// The whole request may be retried unchanged once the index worker
-    /// publishes outstanding work. A write that exceeds a limit on its own
-    /// fails with [`Self::IndexOperationBatchTooLarge`] instead.
+    /// ahead of its answer than it may skip, or a strong text search found
+    /// more committed but unpublished text to analyze than one text
+    /// publication's analysis budget; a write's own changes alone never
+    /// cause it. Eventual searches never fail this way. The whole request may be
+    /// retried unchanged once the index worker publishes outstanding work.
+    /// Work the worker holds back ([`crate::BlockedIndexEntity`], only after
+    /// limits were lowered) is never published, so text it alone keeps past
+    /// the bound fails strong text searches until a later write to it
+    /// publishes or the limits are raised. A write that exceeds a limit on its
+    /// own fails with [`Self::IndexOperationBatchTooLarge`] instead.
     #[error("index backpressure on {scope:?} index {index_id}: {resource} would reach {requested}, limit {limit}. Retry after outstanding index work is published.")]
     IndexBackpressure {
         /// Data scope owning the logical index.
@@ -304,7 +320,8 @@ pub enum HelixDbError {
         index_id: u64,
         /// Saturated resource.
         resource: IndexBackpressureResource,
-        /// Resource total the rejected transaction would have produced.
+        /// Resource total the rejected transaction would have produced, or
+        /// the amount a rejected search reached when it stopped.
         requested: u64,
         /// Configured ceiling.
         limit: u64,
@@ -334,8 +351,9 @@ pub enum HelixDbError {
     },
 
     /// One transaction staged more queued index work than any single
-    /// transaction may carry: an operand too large to commit, or more than a
-    /// per-index backlog limit even with no outstanding work.
+    /// transaction may carry: an operand too large to commit, more than a
+    /// per-index backlog limit even with no outstanding work, or more text of
+    /// its own than one of its text searches may analyze.
     #[error("queued index operations for index {index_id} in one transaction need {resource} {observed}, limit {limit}. This is a hard write-batch limit; split the write into smaller transactions.")]
     IndexOperationBatchTooLarge {
         /// Logical index whose ceiling the transaction exceeded.
```

**File**: `crates/db/src/execution/interpreter/access/search/dispatch.rs` (modified, +23/-20)
```diff
@@ -399,15 +399,26 @@ impl<'db> ExecutionContext<'db> {
                 .search_text_manifest_with_scope(&manifest, &query, k, scope)
                 .await;
         };
+        // An absent partition has neither physical nor pending documents.
+        let super::generation::TextSearchAuthority::Managed(handle) = generation.as_ref() else {
+            return Ok(Vec::new());
+        };
+        let analysis_limit = self.db.active_text_mutation_limits().max_input_bytes();
+        pending.yield_to_text_analysis_limit(
+            handle.partition(),
+            definition.analyzer(),
+            analysis_limit,
+        )?;
         // One logical search records one use of its splits, however often it
         // widens or reruns with a smaller selection.
         let mut demand = crate::search::text::SplitDemand::Record;
         loop {
             match self
                 .overlaid_text_hits(
                     &definition,
-                    generation.as_ref(),
+                    handle,
                     &pending,
+                    analysis_limit,
                     &query,
                     k,
                     &scope,
@@ -434,42 +445,33 @@ impl<'db> ExecutionContext<'db> {
     /// with [`settle_physical`], reporting a search past its suppression
     /// limit to the caller, which fails or reruns it with a smaller
     /// selection. Only the first physical search that `demand` allows
-    /// records a use of its splits.
+    /// records a use of its splits. The caller has already bounded the
+    /// pending text it analyzes in `handle`'s partition to `analysis_limit`
+    /// with [`PendingSelection::yield_to_text_analysis_limit`], which the
+    /// in-memory index asserts.
+    ///
+    /// [`PendingSelection::yield_to_text_analysis_limit`]: super::pending::PendingSelection::yield_to_text_analysis_limit
     #[allow(
         clippy::too_many_arguments,
-        reason = "one overlaid attempt binds its definition, generation, selection, query, and demand"
+        reason = "one overlaid attempt binds its definition, partition, selection, bound, query, and demand"
     )]
     async fn overlaid_text_hits(
         &self,
         definition: &crate::config::TextIndexDefinition,
-        generation: super::generation::TextSearchAuthority<
-            &super::generation::ResolvedTextGenerationHandle,
-        >,
+        handle: &super::generation::ResolvedTextGenerationHandle,
         pending: &super::pending::PendingSelection,
+        analysis_limit: std::num::NonZeroU64,
         query: &str,
         k: usize,
         scope: &TextSearchScope,
         demand: &mut crate::search::text::SplitDemand,
     ) -> Result<Settlement<crate::search::text::TextSearchHit>> {
-        let super::generation::TextSearchAuthority::Managed(handle) = generation else {
-            return Ok(Settlement::Settled(Vec::new()));
-        };
         let partition = handle.partition();
         let authority = handle.physical();
         let overlay = pending
             .entities
             .iter()
-            .map(|pending| {
-                let text = match &pending.latest {
-                    Some((pending_partition, super::pending::PendingValue::Text(text)))
-                        if pending_partition == partition =>
-                    {
-                        Some(&**text)
-                    }
-                    Some(_) | None => None,
-                };
-                (pending.entity, text)
-            })
+            .map(|pending| (pending.entity, pending.text_in(partition)))
             .collect::<Vec<_>>();
         let statistics = if let Some(active) = self.active_write_tx() {
             crate::index_lifecycle::text::statistics::load_overlaid_query_statistics(
@@ -525,6 +527,7 @@ impl<'db> ExecutionContext<'db> {
                 crate::search::text::search_pending_documents(
                     &definition,
                     &documents,
+                    analysis_limit,
                     &query,
                     k,
                     &statistics,
```

**File**: `crates/db/src/execution/interpreter/access/search/pending.rs` (modified, +395/-1)
```diff
@@ -19,6 +19,7 @@
 
 use std::collections::hash_map::Entry;
 use std::collections::HashMap;
+use std::num::NonZeroU64;
 use std::sync::Arc;
 
 use helix_ast::query::SearchConsistency;
@@ -51,6 +52,17 @@ pub(super) struct PendingEntity {
     pub(super) latest: Option<(TextPartition, PendingValue)>,
 }
 
+impl PendingEntity {
+    /// The latest text a text search of `partition` analyzes for the entity:
+    /// `None` when it is deleted, moved to another partition, or a vector.
+    pub(super) fn text_in(&self, partition: &TextPartition) -> Option<&str> {
+        match &self.latest {
+            Some((latest, PendingValue::Text(text))) if latest == partition => Some(text),
+            Some(_) | None => None,
+        }
+    }
+}
+
 /// Consistency a selection was made under.
 #[derive(Debug)]
 enum SelectionConsistency {
@@ -202,6 +214,119 @@ impl PendingSelection {
             ))),
         }
     }
+
+    /// Bounds the unpublished text one text search analyzes in `partition`
+    /// to `limit` analysis bytes, the analysis budget of one text
+    /// publication.
+    ///
+    /// A text overlay analyzes the latest document of every selected entity
+    /// in the searched partition, for corpus statistics and again for its
+    /// in-memory index, whether or not a traversal restricts the search. That
+    /// work grows with the committed backlog rather than with `k`, so it is
+    /// charged exactly as one publication charges the documents it analyzes
+    /// ([`crate::search::text::TextAnalysisMemoryBudget`]: text bytes plus a
+    /// fixed overhead per retained token, so dense short-token text costs
+    /// far more than its length) and bounded by that publication budget.
+    /// Charging stops at the first token past the bound, so sizing never
+    /// analyzes more than the bound either.
+    ///
+    /// The bound caps one search's analysis memory at one publication's; it
+    /// is not what one publication drains. A publication also selects at most
+    /// its batch input bytes and entities, across every partition of its
+    /// generation, so the index worker may need several publications to bring
+    /// a partition's backlog back within the bound.
+    ///
+    /// The searching write transaction's own documents are charged first: no
+    /// publication clears them, so a write whose own documents exceed the
+    /// bound fails with [`HelixDbError::IndexOperationBatchTooLarge`]. Past
+    /// the bound with committed documents, strong search fails with retryable
+    /// index backpressure rather than analyze more; within it, it stays
+    /// exact. Eventual search keeps the longest prefix of its selection
+    /// within the bound and leaves the rest to their published
+    /// representation until publication. Either error reports the charge
+    /// reached when analysis stopped.
+    ///
+    /// Text of entities the index worker holds back
+    /// ([`crate::BlockedIndexEntity`]) counts too, although no publication
+    /// drains it: only a writer knows which entities those are, and exempting
+    /// them would let analysis grow with the retained backlog again. While
+    /// held-back text alone exceeds the bound, which takes limits lowered
+    /// below documents already admitted, strong text searches of the
+    /// partition keep failing until a later write to each of those entities
+    /// publishes or the limits are raised.
+    pub(super) fn yield_to_text_analysis_limit(
+        &mut self,
+        partition: &TextPartition,
+        analyzer: crate::config::TextAnalyzerKind,
+        limit: NonZeroU64,
+    ) -> Result<()> {
+        let mut budget = crate::search::text::TextAnalysisMemoryBudget::new(limit);
+        // The charge the bound refused, or `None` once the document fits.
+        let mut refused = |text: &str| match crate::search::text::analyze_text_within_budget(
+            analyzer,
+            text,
+            &mut budget,
+        ) {
+            Ok(_) => Ok(None),
+            Err(HelixDbError::ActiveTextMutationLimitExceeded { observed, .. }) => {
+                Ok(Some(observed))
+            }
+            Err(error) => Err(error),
+        };
+        let local = self.local();
+        let is_local = |pending: &PendingEntity| {
+            local.is_some_and(|local| local.contains(pending.entity.id.get()))
+        };
+        self.entities
+            .iter()
+            .filter(|pending| is_local(pending))
+            .filter_map(|pending| pending.text_in(partition))
+            .map(&mut refused)
+            .find_map(Result::transpose)
+            .transpose()?
+            .map_or(Ok(()), |observed| {
+                Err(HelixDbError::IndexOperationBatchTooLarge {
+                    index_id: self.target.index_id.get(),
+                    resource: crate::error::IndexOperationBatchResource::PendingTextAnalysisBytes,
+                    observed,
+                    limit: limit.get(),
+                })
+         
```

**File**: `crates/db/src/index_lifecycle/queue/backlog.rs` (modified, +105/-14)
```diff
@@ -73,6 +73,7 @@ use crate::encoding::v2::keys::scope::DataScope;
 use crate::encoding::v2::keys::IndexEntity;
 use crate::encoding::v2::values::indexes::operation_queue::QueuedOperationId;
 use crate::error::{HelixDbError, IndexBackpressureResource, IndexOperationBatchResource, Result};
+use crate::index_lifecycle::worker::IndexWorkerWakeHandle;
 use crate::index_lifecycle::{IndexGenerationId, IndexId, IndexOperationId};
 
 use super::lag::PublicationLagHistogram;
@@ -177,19 +178,44 @@ struct Charge {
     state: ChargeState,
 }
 
+/// Ledger-wide order of the events that can make queued work newly readable:
+/// an operation's charge and the return of its enqueue commit.
+///
+/// A target's latest admission therefore changes when an operation is
+/// charged to it and again when that operation's enqueue commit returns,
+/// committed or uncertain. A queue read that begins after observing a
+/// target's latest admission sees every operation whose commit returned
+/// before; any other operation changes the admission later. So publication
+/// can wait for new work on a target without reading its queue, and the
+/// ledger wakes the index worker whenever a commit's return changes one.
+#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
+pub(crate) struct Admission(u64);
+
 /// Current retained work for one logical index.
 #[derive(Debug, Default)]
 struct IndexUsage {
     retained_bytes: u64,
     /// Outstanding operation references per `(generation, entity)` member.
     members: HashMap<(IndexGenerationId, IndexEntity), u32>,
-    /// Outstanding operation count per generation.
-    generations: BTreeMap<IndexGenerationId, u64>,
+    /// Outstanding work per generation; a generation is present only while
+    /// it retains an operation.
+    generations: BTreeMap<IndexGenerationId, GenerationUsage>,
+}
+
+/// Outstanding work of one generation.
+#[derive(Debug, Clone, Copy)]
+struct GenerationUsage {
+    /// Outstanding operations; never zero.
+    operations: u64,
+    /// The generation's latest [`Admission`].
+    latest: Admission,
 }
 
 #[derive(Debug, Default)]
 struct BacklogState {
     indexes: HashMap<LogicalIndex, IndexUsage>,
+    /// The latest admission issued.
+    admissions: u64,
     charges: HashMap<QueuedOperationId, Charge>,
     /// Exactly the IDs of uncertain charges, per queue target; a target is
     /// present only while it holds one.
@@ -248,14 +274,19 @@ pub(crate) struct BacklogTotals {
 pub(crate) struct IndexOperationBacklog {
     limits: BacklogLimits,
     state: Mutex<BacklogState>,
+    /// Woken whenever an enqueue commit's return changes a target's latest
+    /// [`Admission`], however the producer learned the outcome.
+    worker: IndexWorkerWakeHandle,
 }
 
 impl IndexOperationBacklog {
-    /// Creates an empty ledger; open must [`Self::load_durable`] before writes.
-    pub(crate) fn new(limits: BacklogLimits) -> Arc<Self> {
+    /// Creates an empty ledger that wakes `worker`; open must
+    /// [`Self::load_durable`] before writes.
+    pub(crate) fn new(limits: BacklogLimits, worker: IndexWorkerWakeHandle) -> Arc<Self> {
         Arc::new(Self {
             limits,
             state: Mutex::new(BacklogState::default()),
+            worker,
         })
     }
 
@@ -608,20 +639,43 @@ impl IndexOperationBacklog {
 
     /// Returns generations with outstanding charges, in a stable order.
     pub(crate) fn outstanding_targets(&self) -> Vec<QueueTarget> {
+        self.outstanding_admissions()
+            .into_iter()
+            .map(|(target, _)| target)
+            .collect()
+    }
+
+    /// Returns generations with outstanding charges, in a stable order, each
+    /// with its latest [`Admission`].
+    pub(crate) fn outstanding_admissions(&self) -> Vec<(QueueTarget, Admission)> {
         let state = self.state.lock();
         let mut targets = state
             .indexes
             .iter()
             .flat_map(|(index, usage)| {
-                usage.generations.keys().map(move |generation| {
-                    QueueTarget::new(index.scope, index.index_id, *generation)
+                usage.generations.iter().map(move |(generation, work)| {
+                    (
+                        QueueTarget::new(index.scope, index.index_id, *generation),
+                        work.latest,
+                    )
                 })
             })
             .collect::<Vec<_>>();
         targets.sort_unstable();
         targets
     }
 
+    /// Returns `target`'s latest [`Admission`], or `None` while it retains
+    /// no operation.
+    pub(crate) fn latest_admission(&self, target: QueueTarget) -> Option<Admission> {
+        self.state
+            .lock()
+            .indexes
+            .get(&target.logical_index())
+            .and_then(|usage| usage.generations.get(&target.generation))
+            .map(|work| work.latest)
+    }
+
     /// Returns usage summed across every logical index, outcome counters,

```

**File**: `crates/db/src/index_lifecycle/queue/backlog/tests.rs` (modified, +121/-4)
```diff
@@ -33,10 +33,13 @@ fn charge(target: QueueTarget, entity_id: u64, operation: u128, bytes: u64) -> O
 }
 
 fn ledger(max_retained_bytes: u64, max_members: u64) -> Arc<IndexOperationBacklog> {
-    IndexOperationBacklog::new(BacklogLimits {
-        max_retained_bytes,
-        max_members,
-    })
+    IndexOperationBacklog::new(
+        BacklogLimits {
+            max_retained_bytes,
+            max_members,
+        },
+        IndexWorkerWakeHandle::default(),
+    )
 }
 
 fn usage(backlog: &IndexOperationBacklog, index: u64) -> BacklogUsage {
@@ -154,6 +157,120 @@ fn generations_are_distinct_members_aggregated_per_logical_index() {
         .committed();
 }
 
+/// A target's latest admission changes when an operation is charged to it,
+/// however it was admitted, and again when that operation's enqueue commit
+/// returns, but never when one is released or another target is charged; a
+/// target emptied and charged again never repeats one.
+#[test]
+fn a_targets_latest_admission_changes_when_it_is_charged_or_its_enqueue_returns() {
+    let backlog = ledger(u64::MAX, u64::MAX);
+    let (first, second) = (target(1, 1), target(2, 1));
+    assert_eq!(backlog.latest_admission(first), None);
+    backlog
+        .reserve(&[charge(first, 1, 1, 10)], &[])
+        .unwrap()
+        .committed();
+    let admitted = backlog.latest_admission(first).unwrap();
+    backlog
+        .reserve(&[charge(second, 1, 2, 10)], &[])
+        .unwrap()
+        .committed();
+    backlog.acknowledge([id(2)]);
+    assert_eq!(backlog.latest_admission(first), Some(admitted));
+    // A reservation charges before its commit returns; an abort releases it
+    // without restoring the earlier admission.
+    backlog
+        .reserve(&[charge(first, 2, 3, 10)], &[])
+        .unwrap()
+        .aborted();
+    let aborted = backlog.latest_admission(first).unwrap();
+    assert!(aborted > admitted);
+    // Operations found in storage are admitted too.
+    backlog.load_durable(first, [(id(4), entity(3), 10)]);
+    let discovered = backlog.latest_admission(first).unwrap();
+    assert!(discovered > aborted);
+    assert_eq!(
+        backlog.outstanding_admissions(),
+        [(first, discovered)],
+        "an emptied target is not outstanding"
+    );
+    backlog.acknowledge([id(1), id(4)]);
+    assert_eq!(backlog.latest_admission(first), None);
+    assert!(backlog.outstanding_admissions().is_empty());
+    let reservation = backlog.reserve(&[charge(first, 1, 5, 10)], &[]).unwrap();
+    let reserved = backlog.latest_admission(first).unwrap();
+    assert!(reserved > discovered);
+    // A queue read between the charge and the commit's return misses the
+    // operation, so the return admits it again; an uncertain return may have
+    // committed too.
+    reservation.committed();
+    let committed = backlog.latest_admission(first).unwrap();
+    assert!(committed > reserved);
+    let mut reservation = backlog.reserve(&[charge(first, 2, 6, 10)], &[]).unwrap();
+    let reserved = backlog.latest_admission(first).unwrap();
+    assert!(reserved > committed);
+    reservation.begin_commit();
+    drop(reservation);
+    let uncertain = backlog.latest_admission(first).unwrap();
+    assert!(uncertain > reserved);
+    // A commit returning after publication already acknowledged its
+    // operation admits nothing.
+    let reservation = backlog.reserve(&[charge(first, 3, 7, 10)], &[]).unwrap();
+    let reserved = backlog.latest_admission(first).unwrap();
+    backlog.acknowledge([id(7)]);
+    reservation.committed();
+    assert_eq!(backlog.latest_admission(first), Some(reserved));
+    assert_eq!(backlog.latest_admission(second), None);
+}
+
+/// The ledger wakes the index worker exactly when an enqueue commit's return
+/// readmits an operation: committed, uncertain, or dropped mid-commit by a
+/// cancelled request. A charge, an abort, a reservation dropped before its
+/// commit, and a commit returning after publication acknowledged its
+/// operation make nothing newly readable and wake nothing.
+#[test]
+fn an_enqueue_commit_returning_wakes_the_index_worker() {
+    let worker = IndexWorkerWakeHandle::default();
+    let backlog = IndexOperationBacklog::new(
+        BacklogLimits {
+            max_retained_bytes: u64::MAX,
+            max_members: u64::MAX,
+        },
+        worker.clone(),
+    );
+    let reserve = |operation| {
+        backlog
+            .reserve(&[charge(target(1, 1), 1, operation, 10)], &[])
+            .unwrap()
+    };
+    let mut committed = reserve(1);
+    committed.begin_commit();
+    assert!(!worker.take_wake(), "a charge is not readable yet");
+    committed.committed();
+    assert!(worker.take_wake(), "a committed enqueue wakes the worker");
+    let mut uncertain = reserve(2);
+    uncertain.begin_commit();
+    uncertain.uncertain();
+    assert!(worker.take_wake(), "an uncertain enqueue wakes the worker");
+    let mut cancelled = reserve(3);
+    cancelled.be
```

**File**: `crates/db/src/index_lifecycle/queue/codec_storage_tests.rs` (modified, +52/-23)
```diff
@@ -988,7 +988,7 @@ async fn a_replaying_reader_drops_an_enqueue_its_new_manifest_cancelled() {
 }
 
 #[tokio::test]
-async fn retained_queues_keep_each_targets_unacknowledged_operations() {
+async fn retained_queues_share_one_budget_and_keep_only_unacknowledged_operations() {
     let db = open(
         Arc::new(InMemory::new()),
         Arc::new(HelixMergeOperator::new()),
@@ -1008,35 +1008,63 @@ async fn retained_queues_keep_each_targets_unacknowledged_operations() {
         IndexGenerationId::new(1).unwrap(),
     );
     assert_eq!(target.key(), queue_key());
-    let other = QueueTarget::new(
-        target.scope,
-        target.index_id,
-        IndexGenerationId::new(2).unwrap(),
-    );
+    let targets = (2..=5)
+        .map(|generation| {
+            QueueTarget::new(
+                target.scope,
+                target.index_id,
+                IndexGenerationId::new(generation).unwrap(),
+            )
+        })
+        .collect::<Vec<_>>();
     let one = text_operation(2, 2, Some("b")).retained_bytes();
     let both = one + text_operation(1, 1, Some("a")).retained_bytes();
-    let store = QueueStore::new(QueueLayout::Map, 1 << 20);
+    assert_eq!(both, 2 * one);
+    // Room for two whole queues across every target.
+    let store = QueueStore::new(QueueLayout::Map, 1 << 20, 2 * both);
     let retained = store.retained();
-    let stored = store.read(&db, target).await.unwrap().unwrap();
+    let stored = || async { store.read(&db, target).await.unwrap().unwrap() };
 
     // Nothing remains once every operation read is acknowledged.
-    retained.retain(target, &stored, &[id(1), id(2)]);
+    retained.retain(target, stored().await, &[id(1), id(2)]);
     assert!(retained.take(target).is_none());
-    // Every target keeps its own remainder, whatever the others hold.
-    retained.retain(target, &stored, &[]);
-    retained.retain(other, &stored, &[id(1)]);
+    assert_eq!(retained.retained_bytes(), 0);
+    // An attempt that committed nothing retains the whole queue; one that
+    // acknowledged an operation retains the rest.
+    retained.retain(target, stored().await, &[]);
+    retained.retain(targets[0], stored().await, &[id(1)]);
     assert_eq!(retained.retained_bytes(), both + one);
-    let taken = retained.take(other).expect("the remainder was retained");
+    // A queue that does not fit beside those held is dropped, and evicts
+    // none of them; one that fits exactly is held.
+    retained.retain(targets[1], stored().await, &[]);
+    assert!(retained.take(targets[1]).is_none());
+    retained.retain(targets[2], stored().await, &[id(1)]);
+    assert_eq!(retained.retained_bytes(), 2 * both);
+    retained.retain(targets[3], stored().await, &[id(2)]);
+    assert!(retained.take(targets[3]).is_none());
+    assert_eq!(retained.retained_bytes(), 2 * both);
+
+    // A take releases its bytes for the next queue.
+    let taken = retained.take(targets[0]).expect("the remainder was held");
     assert_eq!(ids_of(Some(taken.queue())), vec![2]);
     assert_eq!(
         taken.encoded_bytes(),
         0,
         "a retained queue reads no storage"
     );
-    assert!(retained.take(other).is_none(), "a take removes the queue");
-    assert_eq!(retained.retained_bytes(), both);
-    let taken = retained.take(target).expect("the whole queue was retained");
-    assert_eq!(ids_of(Some(taken.queue())), vec![1, 2]);
+    assert!(
+        retained.take(targets[0]).is_none(),
+        "a take removes the queue"
+    );
+    let whole = retained.take(target).expect("the whole queue was held");
+    assert_eq!(ids_of(Some(whole.queue())), vec![1, 2]);
+    assert_eq!(retained.retained_bytes(), one);
+    retained.retain(targets[1], stored().await, &[]);
+    assert_eq!(retained.retained_bytes(), both + one);
+    for (target, ids) in [(targets[1], vec![1, 2]), (targets[2], vec![2])] {
+        let taken = retained.take(target).expect("the queue was held");
+        assert_eq!(ids_of(Some(taken.queue())), ids);
+    }
     assert_eq!(retained.retained_bytes(), 0);
     db.close().await.unwrap();
 }
@@ -1055,10 +1083,11 @@ async fn retaining_a_queue_that_was_not_taken_is_an_invariant_violation() {
         IndexId::new(3).unwrap(),
         IndexGenerationId::new(1).unwrap(),
     );
-    let store = QueueStore::new(QueueLayout::Map, 1 << 20);
-    let stored = store.read(&db, target).await.unwrap().unwrap();
-    store.retained().retain(target, &stored, &[]);
-    store.retained().retain(target, &stored, &[]);
+    let store = QueueStore::new(QueueLayout::Map, 1 << 20, u64::MAX);
+    for _ in 0..2 {
+        let stored = store.read(&db, target).await.unwrap().unwrap();
+        store.retained().retain(target, stored, &[]);
+    }
 }
 
 #[tokio::test]
@@ -1079,7 +1108,7 @@ async fn latest_reads_of_rows_decode_only_the_operations_they_select() {
         text_operation(3, 1, Some("c")),
     ];
     let one = operations[0].retained_bytes();
-    let store = QueueStore::new(
```

---

### Incident Patch 14: `1e8afeae` (2026-10-02)
**Commit Message**: fix(db): bound queue reads and retain queues across publication commits

Queue reads followed the whole backlog:
- Acknowledgements piled up as removals in unresolved queue values. An
  acknowledgement composed with its own enqueue now cancels it inside
  partial merges, so unresolved values stay bounded by the outstanding
  backlog. Queue format 0x14 (new on this branch) accepts an empty value
  as a partial merge result.
- Eventual searches decoded every queued operation and failed on corrupt
  records their budget never selects. They now decode only the entities
  whose latest operations fit the budget, comparing entities by raw
  bytes, and show each at its latest state or not at all.
- Every publication attempt re-read the whole queue to publish one batch.
  The writer now retains each target's remainder after a successful
  commit and continues from it.

Retained-byte ceilings whose worst-case queue value outgrows SlateDB's
u32 value length are rejected. With a merge operand pending, SlateDB
still resolves the whole value; tests pin that as a known limitation.

**File**: `crates/db/src/config/index_operation_queue.rs` (modified, +54/-4)
```diff
@@ -10,16 +10,32 @@
 //! use std::num::NonZeroU64;
 //! use std::time::Duration;
 //!
-//! use db::config::{DbConfig, IndexOperationQueueTuning};
+//! use db::config::{DbConfig, IndexOperationQueueTuning, IndexOperationQueueTuningError};
 //!
 //! let tuning = IndexOperationQueueTuning::default()
 //!     .with_max_retained_bytes(NonZeroU64::new(64 * 1024 * 1024).unwrap())
+//!     .unwrap()
 //!     .with_max_members(NonZeroU64::new(10_000).unwrap())
 //!     .with_recovery_sweep_interval(Duration::from_millis(250))
 //!     .unwrap();
 //! let config = DbConfig::new().with_index_operation_queue_tuning(tuning);
 //! assert_eq!(config.index_operation_queue(), tuning);
 //! assert_eq!(IndexOperationQueueTuning::default().max_members().get(), 250_000);
+//!
+//! // A larger retained-byte ceiling could let one queue value outgrow the
+//! // longest value storage can encode.
+//! let largest = IndexOperationQueueTuning::MAX_RETAINED_BYTES;
+//! assert_eq!(largest, 2_437_684_127);
+//! assert!(IndexOperationQueueTuning::default()
+//!     .with_max_retained_bytes(NonZeroU64::new(largest).unwrap())
+//!     .is_ok());
+//! assert_eq!(
+//!     IndexOperationQueueTuning::default()
+//!         .with_max_retained_bytes(NonZeroU64::new(largest + 1).unwrap()),
+//!     Err(IndexOperationQueueTuningError::RetainedBytesAboveQueueValueLimit {
+//!         requested: largest + 1,
+//!     })
+//! );
 //! ```
 
 use std::num::NonZeroU64;
@@ -30,12 +46,19 @@ const DEFAULT_MAX_MEMBERS: u64 = 250_000;
 const DEFAULT_MAX_OPERAND_BYTES: u64 = 8 * 1024 * 1024;
 const DEFAULT_RECOVERY_SWEEP_INTERVAL: Duration = Duration::from_secs(1);
 const EVENTUAL_SEARCH_SOURCE_INPUT_BYTES: u64 = 128 * 1024 * 1024;
+const _: () = assert!(DEFAULT_MAX_RETAINED_BYTES <= IndexOperationQueueTuning::MAX_RETAINED_BYTES);
 
 /// Invalid queue policy rejected before a database opens.
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 pub enum IndexOperationQueueTuningError {
     /// The periodic recovery sweep must run.
     ZeroRecoverySweepInterval,
+    /// The retained-byte ceiling exceeds
+    /// [`IndexOperationQueueTuning::MAX_RETAINED_BYTES`].
+    RetainedBytesAboveQueueValueLimit {
+        /// The rejected ceiling.
+        requested: u64,
+    },
 }
 
 impl core::fmt::Display for IndexOperationQueueTuningError {
@@ -44,6 +67,12 @@ impl core::fmt::Display for IndexOperationQueueTuningError {
             Self::ZeroRecoverySweepInterval => {
                 formatter.write_str("index operation queue recovery sweep interval must be nonzero")
             }
+            Self::RetainedBytesAboveQueueValueLimit { requested } => write!(
+                formatter,
+                "index operation queue max retained bytes {requested} exceed the queue value \
+                 limit {}",
+                IndexOperationQueueTuning::MAX_RETAINED_BYTES
+            ),
         }
     }
 }
@@ -106,6 +135,16 @@ impl Default for IndexOperationQueueTuning {
 }
 
 impl IndexOperationQueueTuning {
+    /// Largest accepted [retained-byte ceiling](Self::max_retained_bytes),
+    /// about 2.27 GiB.
+    ///
+    /// Storage encodes a value's length in 32 bits, and one generation's
+    /// queue value can hold, besides its outstanding operations, a 16-byte
+    /// acknowledgement for each operation that was outstanding before it.
+    /// A larger ceiling could let such a value outgrow that length.
+    pub const MAX_RETAINED_BYTES: u64 =
+        crate::encoding::v2::values::indexes::operation_queue::MAX_RETAINED_BYTES;
+
     /// Returns the retained-operation byte ceiling per logical index.
     pub const fn max_retained_bytes(self) -> NonZeroU64 {
         self.max_retained_bytes
@@ -143,10 +182,21 @@ impl IndexOperationQueueTuning {
         self
     }
 
-    /// Replaces the retained-operation byte ceiling.
-    pub const fn with_max_retained_bytes(mut self, bytes: NonZeroU64) -> Self {
+    /// Replaces the retained-operation byte ceiling; a ceiling above
+    /// [`Self::MAX_RETAINED_BYTES`] is rejected.
+    pub const fn with_max_retained_bytes(
+        mut self,
+        bytes: NonZeroU64,
+    ) -> Result<Self, IndexOperationQueueTuningError> {
+        if bytes.get() > Self::MAX_RETAINED_BYTES {
+            return Err(
+                IndexOperationQueueTuningError::RetainedBytesAboveQueueValueLimit {
+                    requested: bytes.get(),
+                },
+            );
+        }
         self.max_retained_bytes = bytes;
-        self
+        Ok(self)
     }
 
     /// Replaces the distinct pending member ceiling.
```

**File**: `crates/db/src/encoding/v2/values/indexes/operation_queue/algebra.rs` (modified, +101/-50)
```diff
@@ -8,21 +8,56 @@
 //! | unseen               | insert (mode `m`)     | insert `m`, new position|
 //! | removed              | remove                | removed                 |
 //! | removed              | insert (any mode)     | set, new position       |
-//! | insert               | remove                | removed                 |
+//! | insert-if-absent     | remove                | unseen                  |
+//! | set                  | remove                | removed                 |
 //! | insert               | insert-if-absent      | unchanged               |
 //! | insert               | set                   | set, new position       |
 //!
-//! Every record is a total function on one ID's state (absent, or present with
-//! bytes and a position), and the composed representation is closed under
-//! function composition, so the algebra is associative for every grouping.
-//! Producers never reuse IDs; if bytes were ever reused, the first retained
-//! bytes win deterministically rather than failing only for some groupings.
-//!
 //! A removal only ever names one ID, so acknowledging an older operation can
 //! never erase a newer operation. Remove-then-insert composes to an
 //! unconditional set, so an unresolved older base cannot defeat the reset.
 //! Resolving against a known base drops removals and turns surviving sets
 //! into ordinary retained entries.
+//!
+//! # Acknowledgements cancel their own enqueue
+//!
+//! An insert-if-absent followed by a removal of the same ID composes to
+//! *unseen*: the pair leaves nothing behind, even without a base. This keeps
+//! unresolved values bounded no matter how long SlateDB defers resolving
+//! them against the bottom run. A removal survives a partial composition only
+//! while its insert lies below it, so each one names an operation that was
+//! outstanding just before the composition's oldest operand, and each live
+//! insert names one still outstanding after its newest: a value holds at
+//! most one removal per operation of the earlier backlog plus the later
+//! backlog's records. [`super::MAX_RETAINED_BYTES`] keeps that within
+//! SlateDB's value length.
+//!
+//! Cancelling is exact on the histories storage can present, in which each
+//! operation ID is inserted by exactly one committed operand that appears
+//! once in any view, and is removed at most once, after that operand:
+//!
+//! - producers mint a fresh random ID for every operation of every
+//!   transaction attempt, and SlateDB commits a staged operand at most once;
+//!   only the publication worker removes IDs, and only IDs it read from the
+//!   queue, so every removal follows its insert;
+//! - SlateDB applies every committed operand exactly once in every view: its
+//!   merge contract requires associativity but not idempotence (additive
+//!   counters are valid operators, and Helix's metadata counters already
+//!   depend on that). Concretely, WAL replay in writers and readers skips
+//!   every entry at or below `last_l0_seq`, a flush swaps its memtable for
+//!   its L0 under one state lock, and compactions replace their sources
+//!   atomically, so no view holds two copies of one committed operand.
+//!
+//! Under those histories a composition that holds an ID's insert holds its
+//! only insert, so nothing below can resurrect it once the pair cancels, and
+//! every grouping resolves to the same queue. Outside them (a re-enqueued or
+//! duplicated insert below its own cancelled acknowledgement) the composition
+//! stays total and deterministic but may keep the lower copy.
+//!
+//! Nothing weaker can bound removals: a partial merge cannot see whether
+//! another copy of an insert lies below it, so forgetting a removal is exact
+//! only where no copy can, and writing a resolved base instead would race the
+//! blind enqueues it must not shadow.
 
 use std::collections::{BTreeSet, HashMap};
 
@@ -63,30 +98,11 @@ pub(super) struct RawValue<'a> {
 
 impl<'a> RawValue<'a> {
     /// Parses and validates every record without resolving any other value.
+    ///
+    /// A value with no records is the composition's identity: a partial
+    /// merge whose acknowledgements cancelled every insert it held.
     pub(super) fn parse(value: &'a [u8]) -> Result<Self, EncodingError> {
-        const VERSION_OFFSET: usize = 0;
-        const KIND_OFFSET: usize = VERSION_OFFSET + core::mem::size_of::<u8>();
-        const FAMILY_OFFSET: usize = KIND_OFFSET + core::mem::size_of::<u8>();
-        if value.len() < HEADER_LEN {
-            return Err(EncodingError::BufferTooShort {
-                expected: HEADER_LEN,
-                actual: value.len(),
-            });
-        }
-        if value[VERSION_OFFSET] != QUEUE_VALUE_VERSION {
-            return Err(EncodingError::Custom(format!(
-                "unsupported operation queue value version {:#04x}",
-                value[VERSION_OFFSET]
-            )));
-        }
-        if value[KIND_OFFSET] != QUEUE
```

**File**: `crates/db/src/encoding/v2/values/indexes/operation_queue/mod.rs` (modified, +282/-40)
```diff
@@ -32,7 +32,10 @@
 //! per value, and an operation ID never appears both as a removal and an
 //! insert. A value resolved against a known base contains only
 //! insert-if-absent records; an empty resolved queue is a SlateDB tombstone,
-//! so an absent key is the empty queue.
+//! so an absent key is the empty queue. A partial merge result may hold no
+//! records at all (both counts zero) when every acknowledgement it composed
+//! cancelled its own enqueue; it is the identity of composition and is never
+//! a resolved value.
 //!
 //! Relative insert order is storage commit order. Producers serialize enqueue
 //! operations for one entity with a per-entity conflict token, so one
@@ -86,6 +89,31 @@ const MAX_VARINT_LEN: usize = 10;
 /// Largest tenant partition accepted by canonical partitions.
 const MAX_PARTITION_LEN: usize = 16 * 1024 * 1024;
 const OPERATION_TOKEN_BIT: u128 = 1 << 127;
+/// Smallest record an operation retains: mode, identity, a one-byte body
+/// length, and a text deletion of an entity whose ID is one varint byte
+/// (entity kind, ID, absent replacement). A vector deletion adds an absent
+/// previous partition.
+const MIN_RETAINED_RECORD_LEN: usize = MODE_LEN + OPERATION_ID_LEN + 1 + 3;
+/// Upper bound on the bytes of a value that are not records: the header and
+/// both counts.
+const MAX_VALUE_FRAMING_LEN: usize = HEADER_LEN + 2 * MAX_VARINT_LEN;
+
+/// Largest per-index retained-operation ceiling whose queue values SlateDB
+/// can store.
+///
+/// SlateDB encodes a stored value's length as a `u32`, and a longer merge
+/// result written by a flush or compaction is truncated, corrupting its
+/// table. Admission keeps the retained bytes of a generation's outstanding
+/// operations within the ceiling `R`, which bounds a resolved value. An
+/// unresolved value also keeps one [`OPERATION_ID_LEN`]-byte removal per
+/// operation that was outstanding before its oldest operand (see the
+/// cancellation contract in `algebra`), and every operation retains at least
+/// `MIN_RETAINED_RECORD_LEN` bytes, so no value exceeds
+/// `MAX_VALUE_FRAMING_LEN + OPERATION_ID_LEN * (R / MIN_RETAINED_RECORD_LEN) + R`.
+/// This is the largest `R` for which that fits a `u32`.
+pub(crate) const MAX_RETAINED_BYTES: u64 = (u32::MAX as u64 - MAX_VALUE_FRAMING_LEN as u64)
+    * MIN_RETAINED_RECORD_LEN as u64
+    / (MIN_RETAINED_RECORD_LEN + OPERATION_ID_LEN) as u64;
 
 /// Unique immutable identity of one queued operation.
 ///
@@ -305,9 +333,7 @@ impl QueuedOperation {
     /// Accounting charges this size: mode, identity, body length, entity, and
     /// the complete payload, including deletions.
     pub(crate) fn retained_bytes(&self) -> u64 {
-        let body_len = body_encoded_len(self);
-        u64::try_from(MODE_LEN + OPERATION_ID_LEN + varint_len(body_len as u64) + body_len)
-            .unwrap_or(u64::MAX)
+        retained_len(body_encoded_len(self))
     }
 }
 
@@ -450,33 +476,20 @@ impl OperationQueue {
     /// corruption at this boundary. Corrupt values are errors, never empty
     /// queues.
     pub(crate) fn decode(value: &[u8]) -> Result<Self, EncodingError> {
-        let raw = algebra::RawValue::parse(value)?;
-        if !raw.removes.is_empty() {
-            return Err(EncodingError::Custom(
-                "resolved operation queue retains acknowledgements".to_string(),
-            ));
-        }
-        let operations = raw
-            .inserts
-            .iter()
-            .map(|insert| {
-                if insert.mode != algebra::InsertMode::IfAbsent {
+        let (family, records) = resolved_records(value)?;
+        let mut ids = std::collections::HashSet::new();
+        let operations = records
+            .map(|record| {
+                let (id, body) = record?;
+                if !ids.insert(id) {
                     return Err(EncodingError::Custom(
-                        "resolved operation queue retains an unconditional set".to_string(),
+                        "queued value inserts one operation ID twice".to_string(),
                     ));
                 }
-                decode_body(raw.family, insert.id, insert.body)
+                decode_body(family, id, body)
             })
             .collect::<Result<Vec<_>, _>>()?;
-        if operations.is_empty() {
-            return Err(EncodingError::Custom(
-                "resolved operation queue is empty instead of absent".to_string(),
-            ));
-        }
-        Ok(Self {
-            family: raw.family,
-            operations,
-        })
+        Ok(Self { family, operations })
     }
 
     /// Assembles a queue from row-layout operations in sequence order,
@@ -502,6 +515,216 @@ impl OperationQueue {
     }
 }
 
+/// Each pending entity's latest outstanding operation, as a search reads it.
+///
+/// Holds the longest run of entities, in the order of each one's oldest
+/// outstanding operation, whose latest operations'
+/// [`QueuedOperation::retained_bytes`] fit
```

**File**: `crates/db/src/encoding/v2/values/indexes/operation_queue/tests.rs` (modified, +526/-41)
```diff
@@ -284,10 +284,6 @@ fn malformed_values_are_errors_not_empty_queues() {
     let mut trailing = valid.to_vec();
     trailing.push(0);
     cases.push(("trailing byte", trailing));
-    cases.push((
-        "no records",
-        raw_value(QueueFamily::Text, &[], &[]).to_vec(),
-    ));
     let mut mode = valid.to_vec();
     mode[HEADER_LEN + 2] = 0x03;
     cases.push(("unknown mode", mode));
@@ -571,6 +567,383 @@ fn reused_ids_keep_the_first_retained_bytes_in_every_grouping() {
     assert_eq!(ids_of(resolve(&[first.clone(), first]).as_ref()), vec![1]);
 }
 
+#[test]
+fn an_acknowledgement_cancels_its_own_enqueue_without_a_base() {
+    let enqueue = |operation: u128| {
+        QueueOperand::enqueue(&[text_operation(operation, 1, Some("x"))])
+            .unwrap()
+            .bytes()
+            .clone()
+    };
+    let ack = |ids: &[u128]| {
+        QueueOperand::acknowledge(QueueFamily::Text, ids.iter().copied().map(id))
+            .unwrap()
+            .bytes()
+            .clone()
+    };
+    // Rounds of enqueues and their acknowledgements composed with no base,
+    // as upper compactions and read batches fold them: nothing accumulates.
+    let rounds = (0..50_u128)
+        .flat_map(|round| [enqueue(round + 10), ack(&[round + 10])])
+        .collect::<Vec<_>>();
+    let partial = merge_partial(None, &rounds).unwrap();
+    assert_eq!(partial, raw_value(QueueFamily::Text, &[], &[]));
+    // An acknowledgement whose enqueue lies below keeps its removal, and a
+    // cancelled pair beside it adds nothing.
+    let below = merge_partial(None, &[enqueue(1), enqueue(2)]).unwrap();
+    let upper = merge_partial(None, &[ack(&[1]), enqueue(3), ack(&[3])]).unwrap();
+    assert_eq!(upper, raw_value(QueueFamily::Text, &[1], &[]));
+    assert_eq!(
+        ids_of(resolve(&[below.clone(), upper.clone()]).as_ref()),
+        vec![2]
+    );
+    assert_eq!(
+        ids_of(
+            resolve(&[merge_partial(Some(&below), std::slice::from_ref(&upper)).unwrap()]).as_ref()
+        ),
+        vec![2]
+    );
+    // A set also removed whatever it replaced below, so acknowledging it
+    // keeps that removal.
+    let reset = merge_partial(None, &[ack(&[1]), enqueue(1), ack(&[1])]).unwrap();
+    assert_eq!(reset, raw_value(QueueFamily::Text, &[1], &[]));
+    assert_eq!(ids_of(resolve(&[below, reset]).as_ref()), vec![2]);
+}
+
+#[test]
+fn the_retained_byte_ceiling_keeps_every_queue_value_within_a_u32_length() {
+    // A text deletion is the smallest operation; every other shape is larger.
+    assert_eq!(
+        text_operation(1, 0, None).retained_bytes(),
+        MIN_RETAINED_RECORD_LEN as u64
+    );
+    assert!(vector_operation(1, 0, None, None).retained_bytes() > MIN_RETAINED_RECORD_LEN as u64);
+    // The largest value a ceiling admits: a removal for each smallest
+    // operation of one full backlog, plus a second full backlog of records.
+    let largest_value = |ceiling: u64| {
+        MAX_VALUE_FRAMING_LEN as u64
+            + OPERATION_ID_LEN as u64 * (ceiling / MIN_RETAINED_RECORD_LEN as u64)
+            + ceiling
+    };
+    assert!(largest_value(MAX_RETAINED_BYTES) <= u64::from(u32::MAX));
+    // Exact up to one smallest operation.
+    assert!(
+        largest_value(MAX_RETAINED_BYTES + MIN_RETAINED_RECORD_LEN as u64) > u64::from(u32::MAX)
+    );
+}
+
+#[test]
+fn a_value_without_records_is_the_identity_of_composition() {
+    let empty = raw_value(QueueFamily::Text, &[], &[]);
+    let one = QueueOperand::enqueue(&[text_operation(1, 1, Some("a"))])
+        .unwrap()
+        .bytes()
+        .clone();
+    assert!(validate_operand(&empty).is_ok());
+    assert_eq!(
+        merge_with_base(None, std::slice::from_ref(&empty)).unwrap(),
+        QueueMergeResult::Empty
+    );
+    assert_eq!(
+        merge_partial(None, std::slice::from_ref(&empty)).unwrap(),
+        empty
+    );
+    for operands in [
+        vec![empty.clone(), one.clone()],
+        vec![one.clone(), empty.clone()],
+    ] {
+        assert_eq!(
+            merge_partial(None, &operands).unwrap(),
+            merge_partial(None, std::slice::from_ref(&one)).unwrap()
+        );
+        assert_eq!(ids_of(resolve(&operands).as_ref()), vec![1]);
+    }
+    let QueueMergeResult::Value(resolved) =
+        merge_with_base(Some(&one), std::slice::from_ref(&empty)).unwrap()
+    else {
+        panic!("the base operation remains");
+    };
+    assert_eq!(
+        ids_of(Some(&OperationQueue::decode(&resolved).unwrap())),
+        vec![1]
+    );
+    // A resolved empty queue is a tombstone, never a stored value.
+    assert!(OperationQueue::decode(&empty).is_err());
+    // Families still never mix through an empty value.
+    let vector = raw_value(QueueFamily::Vector, &[], &[]);
+    assert!(merge_partial(Some(&vector), std::slice::from_ref(&one)).is_err());
+}
+
+#[test]
+fn latest_decodes_select_each_entity_at_its_latest_operation_within_the_budget() {
+    // Entity 1 changes t
```

**File**: `crates/db/src/execution/interpreter/access/search/pending.rs` (modified, +60/-62)
```diff
@@ -2,9 +2,16 @@
 //!
 //! One pinned request view supplies the physical index, the outstanding
 //! operation queue, and (for text) indexed-entity statistics, so an overlay
-//! never mixes snapshots. Outstanding operations deduplicate to each entity's
-//! latest state in that view; historical payloads are never searched. Write
-//! transactions read the queue through their serializable transaction,
+//! never mixes snapshots. A search only ever sees a pending entity at its
+//! latest state in that view, never at an earlier state of its chain: a build
+//! or publication may already have written the latest state physically, and
+//! an earlier one would hide it. Strong searches select every pending entity;
+//! eventual searches select the oldest pending entities whose latest
+//! operations fit their budget and leave the rest to their physical
+//! representation. Only decoding and searching follow that budget; reading
+//! the queue still follows the backlog (see
+//! [`crate::index_lifecycle::queue::storage::QueueStore::read_latest`]).
+//! Write transactions read the queue through their serializable transaction,
 //! additionally overlay their own uncommitted changes from the write context,
 //! and always search strongly. No publication clears the physical results
 //! their own changes supersede, so those never count toward the suppression
@@ -20,10 +27,9 @@ use roaring::RoaringTreemap;
 use super::*;
 use crate::encoding::v2::keys::IndexEntity;
 use crate::encoding::v2::values::indexes::operation_queue::{
-    OperationQueue, QueueFamily, QueuedOperation, QueuedPayload,
+    LatestOperations, QueueFamily, QueuedPayload,
 };
 use crate::index_lifecycle::queue::producer::PendingEntityState;
-use crate::index_lifecycle::queue::storage::StoredQueue;
 use crate::index_lifecycle::queue::QueueTarget;
 use crate::index_lifecycle::work::TextPartition;
 use crate::index_lifecycle::IndexIdentity;
@@ -52,8 +58,9 @@ enum SelectionConsistency {
     /// write transaction changed itself, which no publication clears; it is
     /// empty for read requests.
     Strong { local: RoaringTreemap },
-    /// Complete committed entities within the eventual search budget. Only
-    /// read requests search eventually.
+    /// The oldest committed pending entities whose latest operations fit
+    /// the eventual search budget, each at that latest state. Only read
+    /// requests search eventually.
     Eventual,
 }
 
@@ -201,13 +208,23 @@ impl<'db> ExecutionContext<'db> {
     /// Selects pending entities for one index search, or `None` when none
     /// is pending or no queued publication is configured.
     ///
+    /// Every selected entity is searched at its latest state in the view.
     /// Strong search selects every pending entity. Eventual search selects
-    /// complete entities in queue order until the next would exceed the
-    /// per-search source-input budget; unselected entities keep their stale
-    /// physical representation until published. An eventual search may
-    /// shrink its selection further to stay within the suppression limit
-    /// (see [`PendingSelection::yield_to_suppression_limit`]). Write
-    /// transactions are always strong and add their own uncommitted changes.
+    /// entities in the order of their oldest pending operation until the
+    /// next one's latest operation would exceed the per-search source-input
+    /// budget; unselected entities keep their physical representation, stale
+    /// or not, until published, and an entity is never selected at an
+    /// earlier state, which could be older than that representation. The
+    /// budget bounds decoding and searching, not the queue read: the map
+    /// layout fetches its whole value, and while merge operands are pending
+    /// above its base SlateDB resolves them against all of it, validating
+    /// every record, so that read costs the backlog and fails on a corrupt
+    /// record the budget never selects (see
+    /// [`crate::index_lifecycle::queue::storage::QueueStore::read_latest`]).
+    /// An eventual search may shrink its selection further to stay within
+    /// the suppression limit (see
+    /// [`PendingSelection::yield_to_suppression_limit`]). Write transactions
+    /// are always strong and add their own uncommitted changes.
     ///
     /// A write transaction reads the queue through its serializable
     /// transaction, so the searched generation's queue becomes a read
@@ -220,7 +237,7 @@ impl<'db> ExecutionContext<'db> {
         identity: &IndexIdentity,
         family: QueueFamily,
     ) -> Result<Option<PendingSelection>> {
-        let (target, stored, consistency) = if let Some(active) = self.active_write_tx() {
+        let (target, latest, consistency) = if let Some(active) = self.active_write_tx() {
             let Some(handle) = crate::index_lifecycle::repository::load_active_handle(
                 &active.txn,
                 self.tenant_scope,
@@ -232,12 +249,12 @@ imp
```

**File**: `crates/db/src/index_lifecycle/queue/codec_storage_tests.rs` (modified, +625/-122)
```diff
@@ -1,25 +1,36 @@
 //! Queue contracts against real SlateDB transactions, flushes, and compaction.
 
-use std::sync::atomic::{AtomicUsize, Ordering};
+use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
 use std::sync::Arc;
 use std::time::Duration;
 
+use futures::stream::BoxStream;
 use slatedb::object_store::memory::InMemory;
+use slatedb::object_store::{
+    path::Path, CopyOptions, GetOptions, GetResult, ListResult, MultipartUpload, ObjectMeta,
+    ObjectStore, PutMultipartOptions, PutOptions, PutPayload, PutResult,
+    Result as ObjectStoreResult,
+};
 use slatedb::{
     compactor, config, Db, IsolationLevel, MergeOperator, MergeOperatorError, MergeResult,
 };
 
 use bytes::Bytes;
 
-use crate::encoding::v2::keys::scope::DataScope;
-use crate::encoding::v2::keys::{IndexEntity, IndexOperationQueueKey, ManagedIndexKey, ScopedKey};
+use super::storage::QueueStore;
+use super::QueueTarget;
+use crate::config::QueueLayout;
+use crate::encoding::v2::keys::scope::{DataScope, TenantId};
+use crate::encoding::v2::keys::{
+    IndexEntity, IndexOperationQueueKey, IndexOperationRowKey, ManagedIndexKey, ScopedKey,
+};
 use crate::encoding::v2::values::indexes::operation_queue::{
-    merge_partial, merge_with_base, OperationQueue, QueueFamily, QueueMergeResult, QueueOperand,
+    merge_with_base, OperationQueue, QueueFamily, QueueMergeResult, QueueOperand, QueueRow,
     QueuedOperation, QueuedOperationId, QueuedPayload, QueuedTextPayload, QueuedTextReplacement,
 };
 use crate::index_lifecycle::work::TextPartition;
 use crate::index_lifecycle::{IndexElementKind, IndexEntityId, IndexGenerationId, IndexId};
-use crate::merge_operator::HelixMergeOperator;
+use crate::merge_operator::{HelixMergeOperator, QueueMerges};
 
 fn id(value: u128) -> QueuedOperationId {
     QueuedOperationId::try_from_u128(value).expect("test operation IDs keep bit 127 clear")
@@ -54,7 +65,7 @@ const PATH: &str = "operation-queue-storage";
 
 fn queue_key() -> Bytes {
     ManagedIndexKey::Data {
-        scope: DataScope::Tenant(crate::encoding::v2::keys::scope::TenantId::from_u128(0x51)),
+        scope: DataScope::Tenant(TenantId::from_u128(0x51)),
         kind: ScopedKey::IndexOperationQueue(IndexOperationQueueKey {
             index_id: IndexId::new(3).unwrap(),
             generation: IndexGenerationId::new(1).unwrap(),
@@ -569,107 +580,338 @@ async fn sorted_runs(admin: &slatedb::admin::Admin) -> Vec<u32> {
     runs
 }
 
-/// Resolves `operands` over `base` and returns the retained IDs in order.
-fn resolved_ids(base: Option<&Bytes>, operands: &[Bytes]) -> Vec<u128> {
-    match merge_with_base(base.map(Bytes::as_ref), operands).expect("operands resolve") {
-        QueueMergeResult::Value(value) => ids_of(Some(
-            &OperationQueue::decode(&value).expect("resolved queue decodes"),
-        )),
-        QueueMergeResult::Empty => Vec::new(),
-    }
-}
-
-/// A replay keeps its sequence number, so it always composes below the
-/// acknowledgement that follows its original. Re-applying the same bytes
-/// above an acknowledgement is not a replay but an ID reuse, which the reset
-/// semantics define (`acknowledge_then_reenqueue_resets_even_above_an_unresolved_base`
-/// keeps that contract).
 #[tokio::test]
-async fn replayed_operands_never_resurrect_acknowledged_operations() {
-    let replayed_operation = || text_operation(2, 2, Some("acknowledged"));
-    let before = enqueue(&[text_operation(1, 1, Some("before"))])
-        .bytes()
-        .clone();
-    let replayed = enqueue(&[replayed_operation()]).bytes().clone();
-    let after = enqueue(&[text_operation(3, 3, Some("after"))])
-        .bytes()
-        .clone();
-    let ack = acknowledge(&[2]).bytes().clone();
-    assert_eq!(
-        enqueue(&[replayed_operation()]).bytes(),
-        &replayed,
-        "a replay carries identical operand bytes"
-    );
+async fn acknowledged_removals_stay_bounded_above_an_uncompacted_bottom_run() {
+    // Only this database counts here, so parallel tests cannot move the costs.
+    static MERGES: QueueMerges = QueueMerges::new();
+    const LIVE: u128 = 1;
+    const ROUNDS: u128 = 20;
+    const PER_ROUND: u128 = 500;
+    // Enqueued just before the midway snapshot and acknowledged after it, so
+    // that snapshot provably retains a version the upper runs superseded.
+    const SPLIT: u128 = LIVE + ROUNDS * PER_ROUND + 1;
+    let store = Arc::new(InMemory::new());
+    let db = Db::builder(PATH, store.clone())
+        .with_settings(manual_compaction_settings())
+        .with_merge_operator(Arc::new(HelixMergeOperator::with_queue_merges(&MERGES)))
+        .build()
+        .await
+        .unwrap();
+    let admin = slatedb::admin::Admin::builder(PATH, store.clone()).build();
 
-    // The enqueue and its acknowledgement compose without any base, as an
-    // upper compaction does; the output stays a valid merge input wherever
-    // it lands, even if it composes to no records at all.
-    let partial 
```

**File**: `crates/db/src/index_lifecycle/queue/lifecycle_tests.rs` (modified, +142/-2)
```diff
@@ -20,6 +20,7 @@ use slatedb::object_store::ObjectStore;
 use super::backlog::OperationCharge;
 use super::overlay_tests::{add, delete, drain, text_search, update, vector_search, write};
 use super::publication::PublicationOutcome;
+use super::publication_tests::batch_limits;
 use super::tests::{
     open, publisher_with_limits, queue, queued, release_within_operand_bound, rows, target,
 };
@@ -933,6 +934,88 @@ async fn build_then_drain_places_every_node_as_the_unskipped_run_does() {
     assert_ne!(skipped, replaced, "the full path relinked replayed nodes");
 }
 
+/// A build reads every entity at its latest state, so the chains its scan
+/// raced stay queued as replays of states no newer than the rows it wrote.
+/// Whatever the eventual budget cuts, an eventual search must show such an
+/// entity at that latest state or through its built row, never at an earlier
+/// state of its chain: here, a document updated twice ahead of the scan and
+/// one that moves to a tenant whose name makes its latest operation far
+/// larger than its first.
+#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
+async fn eventual_searches_after_a_build_never_show_a_state_older_than_its_rows() {
+    let store: Arc<dyn ObjectStore> = Arc::new(InMemory::new());
+    let db = open("build-eventual-budgets", Arc::clone(&store), config()).await;
+    let (ids, mut state, operation, pause) = hold_first_vector_scan(&db).await;
+    write_ahead_of_the_scan(&db, &ids, &mut state).await;
+    let far: &'static str = Box::leak("f".repeat(300).into_boxed_str());
+    update(&db, ids[100], [50.0, 50.0], "doc").await;
+    write(&db, || {
+        QueryRequest::write(
+            batch::write_batch().var_as(
+                "moved",
+                traversal::g()
+                    .n(NodeRef::from(ids[100]))
+                    .set_property("embedding", vec![-50.0_f32, -50.0])
+                    .set_property("tenant", PropertyInput::from(far.to_string())),
+            ),
+        )
+    })
+    .await;
+    state.insert(ids[100], (far, [-50.0, -50.0]));
+    pause.release();
+    assert_eq!(wait_terminal(&db, &operation).await, "succeeded");
+    let sizes = queue(&db, QueueFamily::Vector)
+        .await
+        .expect("the raced chains stay queued as replays")
+        .operations()
+        .iter()
+        .map(|operation| operation.retained_bytes())
+        .collect::<Vec<_>>();
+    db.close().await.unwrap();
+
+    // No budget, every budget that ends between two operations, and all.
+    let budgets = std::iter::once(0).chain(sizes.iter().scan(0, |total, size| {
+        *total += size;
+        Some(*total)
+    }));
+    for budget in budgets {
+        let base = config();
+        let tuning = base
+            .index_operation_queue()
+            .with_eventual_search_budget_for_tests(budget);
+        let reopened = base.with_index_operation_queue_tuning(tuning);
+        let db = open("build-eventual-budgets", Arc::clone(&store), reopened).await;
+        assert_eq!(
+            queue(&db, QueueFamily::Vector)
+                .await
+                .map_or(0, |queue| queue.operations().len()),
+            sizes.len(),
+            "publication stays paused"
+        );
+        for consistency in [SearchConsistency::Strong, SearchConsistency::Eventual] {
+            assert_exact_vectors(&db, &state, consistency).await;
+            let label = format!("{consistency:?} search within {budget}");
+            let moved = vector_search(&db, [-50.0, -50.0], 1, Some(far), consistency).await;
+            assert_eq!(
+                moved
+                    .iter()
+                    .map(|(id, bits)| (*id, f64::from_bits(*bits)))
+                    .collect::<Vec<_>>(),
+                [(ids[100], 0.0)],
+                "{label} finds the move"
+            );
+            assert!(
+                !vector_search(&db, [50.0, 50.0], 8, Some("a"), consistency)
+                    .await
+                    .iter()
+                    .any(|(id, _)| *id == ids[100]),
+                "{label} shows the moved document at its first update"
+            );
+        }
+        db.close().await.unwrap();
+    }
+}
+
 async fn discard_all(db: &HelixDB, target: QueueTarget) -> u64 {
     let publisher = db.index_queue_publisher().unwrap();
     let mut discarded = 0;
@@ -985,7 +1068,63 @@ async fn dropping_an_index_discards_its_queued_operations_even_after_restart() {
     assert!(db.inner_db().get(target.key()).await.unwrap().is_none());
     let stats = db.index_operation_queue_stats();
     assert_eq!(stats.discarded_operations, 5);
-    assert_eq!(stats.queue_reads, 1, "the discard read is counted");
+    assert_eq!(
+        stats.queue_reads, 2,
+        "the discard read and the read that finds the queue empty are counted"
+    );
+    db.close().await.unwrap();
+}
+
+#[tokio::test]
+async fn a_queue_retained_before_its_index_drops_is_discarded_and_never_published() {
+    let db = open("d
```

**File**: `crates/db/src/index_lifecycle/queue/mod.rs` (modified, +5/-2)
```diff
@@ -93,8 +93,11 @@ pub struct IndexOperationQueueStats {
     pub blocked_attempts: u64,
     /// Operations of retired generations acknowledged without publication.
     pub discarded_operations: u64,
-    /// Queues read and decoded by publication, including retired-generation
-    /// discards and uncertain-commit reconciliation.
+    /// Storage reads of a generation queue by publication, including reads
+    /// that find it empty, retired-generation discards, and uncertain-commit
+    /// reconciliation. An attempt that continues from the queue its target's
+    /// previous commit left reads nothing, so draining a backlog reads it
+    /// once rather than once per batch.
     pub queue_reads: u64,
     /// Stored key and value bytes those reads returned.
     pub queue_read_bytes: u64,
```

---

### Incident Patch 15: `348dcdfe` (2026-10-02)
**Commit Message**: fix(db): recover blocked builds and admit their repairs beyond queue limits

A vector Scan step that blocked behind admitted rows committed them
without advancing its cursor, so every retry after a repair failed with
invariant_violation. Such a blocker now ends the step like a full batch.

A blocked build's hidden generation publishes nothing until a retry or
abort, yet writes kept queueing there; once they filled the member or
byte limit, the repair the blocker asks for was refused with a
backpressure that never cleared. A saturated blocked build now admits
its blocker's first repair and a removal of the blocker's entity beyond
the limits, and refuses other writes with the non-retryable
index_build_blocked. Writes to entities already pending stay admitted
above the member limit; only new members are refused.

Covered in unit and production contracts, including a repair racing a
retry or abort of the build. Docs describe index_build_blocked.

**File**: `bindings/uniffi/src/error.rs` (modified, +18/-0)
```diff
@@ -73,6 +73,7 @@ impl From<HelixDbError> for HelixError {
             | HelixDbError::InvalidQueryJson(_)
             | HelixDbError::Encoding(EncodingError::InvalidTenantId(_))
             | HelixDbError::IndexBusy { .. }
+            | HelixDbError::IndexBuildBlocked { .. }
             | HelixDbError::IndexOperationNotFound { .. }
             | HelixDbError::IndexOperationNotAbortable { .. }
             | HelixDbError::ActiveTextMutationLimitExceeded { .. }
@@ -212,6 +213,23 @@ mod tests {
         ));
     }
 
+    #[test]
+    fn a_blocked_build_refusal_is_an_invalid_request_naming_its_operation() {
+        let operation_id = "0b6f4c1e-5d0a-4a43-9e57-3f2d1c0b9a87";
+        assert!(matches!(
+            HelixError::from(HelixDbError::IndexBuildBlocked {
+                scope: db::encoding::v2::keys::scope::DataScope::LegacyUnscoped,
+                index_id: 7,
+                operation_id: operation_id.to_string(),
+                resource: db::error::IndexBackpressureResource::PendingMembers,
+                requested: 2,
+                limit: 1,
+            }),
+            HelixError::InvalidRequest { error, msg }
+                if error == "index_build_blocked" && msg.contains(operation_id)
+        ));
+    }
+
     #[test]
     fn query_deadlines_do_not_expand_the_stable_binding_error_contract() {
         assert!(matches!(
```

**File**: `crates/ast/src/error_code.rs` (modified, +8/-0)
```diff
@@ -131,6 +131,12 @@ pub enum QueryErrorCode {
     /// committed but unpublished work) and is safe to retry after the index
     /// worker publishes outstanding operations.
     IndexBackpressure,
+    /// A write would saturate the queued work of a blocked hidden index
+    /// build. Its generation publishes nothing until the build activates, so
+    /// retrying the same write cannot succeed until the blocked build
+    /// operation is retried (after repairing what its blocker names) or
+    /// aborted.
+    IndexBuildBlocked,
     /// One transaction staged more queued index work than a single transaction
     /// may carry (an operand above the durable write-ahead-log entry limit, or
     /// a per-index backlog limit exceeded on its own); retrying the same write
@@ -296,6 +302,7 @@ impl QueryErrorCode {
         Self::MigrationSteppingRequiresDisabledMode,
         Self::ActiveTextMutationLimitExceeded,
         Self::IndexBackpressure,
+        Self::IndexBuildBlocked,
         Self::IndexOperationBatchTooLarge,
         Self::InvalidIndexSourceData,
         Self::InvalidIndexModel,
@@ -392,6 +399,7 @@ impl QueryErrorCode {
             }
             Self::ActiveTextMutationLimitExceeded => "active_text_mutation_limit_exceeded",
             Self::IndexBackpressure => "index_backpressure",
+            Self::IndexBuildBlocked => "index_build_blocked",
             Self::IndexOperationBatchTooLarge => "index_operation_batch_too_large",
             Self::InvalidIndexSourceData => "invalid_index_source_data",
             Self::InvalidIndexModel => "invalid_index_model",
```

**File**: `crates/db/src/error.rs` (modified, +25/-0)
```diff
@@ -310,6 +310,29 @@ pub enum HelixDbError {
         limit: u64,
     },
 
+    /// A write would saturate the queued work of a blocked index build.
+    ///
+    /// A hidden build's generation publishes its queued work only once the
+    /// build activates, so waiting cannot clear this: the write may succeed
+    /// once the blocked build operation is retried or aborted. A repair of
+    /// the entity its blocker names, as that entity's first queued write or
+    /// as its removal from the index, is admitted beyond the limits instead.
+    #[error("index build {operation_id} of {scope:?} index {index_id} is blocked: {resource} would reach {requested}, limit {limit}. Repair what the blocker names and retry the operation, or abort it.")]
+    IndexBuildBlocked {
+        /// Data scope owning the logical index.
+        scope: crate::encoding::v2::keys::scope::DataScope,
+        /// Logical index whose retained work would exceed its limit.
+        index_id: u64,
+        /// Canonical lowercase UUID of the blocked build operation.
+        operation_id: String,
+        /// Saturated resource.
+        resource: IndexBackpressureResource,
+        /// Resource total the rejected transaction would have produced.
+        requested: u64,
+        /// Configured ceiling.
+        limit: u64,
+    },
+
     /// One transaction staged more queued index work than any single
     /// transaction may carry: an operand too large to commit, or more than a
     /// per-index backlog limit even with no outstanding work.
@@ -607,6 +630,7 @@ impl HelixDbError {
                 error_code::QueryErrorCode::MigrationSteppingRequiresDisabledMode
             }
             Self::IndexBackpressure { .. } => error_code::QueryErrorCode::IndexBackpressure,
+            Self::IndexBuildBlocked { .. } => error_code::QueryErrorCode::IndexBuildBlocked,
             Self::IndexOperationBatchTooLarge { .. } => {
                 error_code::QueryErrorCode::IndexOperationBatchTooLarge
             }
@@ -696,6 +720,7 @@ impl HelixDbError {
                 | error_code::QueryErrorCode::SecondaryLifecycleSteppingRequiresDisabledMode
                 | error_code::QueryErrorCode::ActiveTextMutationLimitExceeded
                 | error_code::QueryErrorCode::IndexBackpressure
+                | error_code::QueryErrorCode::IndexBuildBlocked
                 | error_code::QueryErrorCode::IndexOperationBatchTooLarge
                 | error_code::QueryErrorCode::InvalidIndexSourceData
                 | error_code::QueryErrorCode::IndexAlreadyExists
```

**File**: `crates/db/src/execution/interpreter/mutation/tx.rs` (modified, +3/-4)
```diff
@@ -225,10 +225,9 @@ impl<'db> ExecutionContext<'db> {
         let mut reservation = if staged_queue.is_empty() {
             None
         } else {
-            let reservation = self
-                .db
-                .index_operation_backlog()
-                .reserve(staged_queue.charges)?;
+            let reservation = staged_queue
+                .reserve(self.db.index_operation_backlog(), &txn)
+                .await?;
             for staged in staged_queue.operands {
                 self.db.index_queue_store().stage_enqueue(
                     &txn,
```

**File**: `crates/db/src/index_lifecycle/outbox.rs` (modified, +5/-0)
```diff
@@ -153,6 +153,11 @@ pub(crate) enum IndexOperationStepResult {
     /// No physical work commits; the exact checkpoint is durably backed off.
     TransientFailure,
     /// No further automatic retry is legal until an explicit retry/abort.
+    ///
+    /// The step's transaction commits the blocker beside the operation's
+    /// unchanged checkpoint, so anything the driver staged commits too and a
+    /// retry rescans it: a driver stages before blocking only work that a
+    /// rescan from that checkpoint reconciles.
     Blocked(IndexOperationBlocker),
     /// The canonical lifecycle state and terminal operation commit together.
     Completed(IndexOperationOutcome),
```

**File**: `crates/db/src/index_lifecycle/queue/backlog.rs` (modified, +122/-41)
```diff
@@ -34,6 +34,33 @@
 //! Every other acknowledgement is counted as censored rather than assigned a
 //! guessed lag, including one for an operation whose acknowledgement
 //! publication committed or attempted before its producer's commit returned.
+//!
+//! # Blocked builds
+//!
+//! A hidden build's generation publishes nothing before the build activates,
+//! so once its build blocks, a saturated limit cannot clear until an operator
+//! retries or aborts the operation. Such a refusal is the non-retryable
+//! [`HelixDbError::IndexBuildBlocked`] rather than backpressure, except for a
+//! transaction whose only operation in that generation repairs the entity
+//! the blocker names. That repair is admitted beyond the limits when it is
+//! the entity's first queued operation, or when it removes the entity from
+//! the index, so every such blocker stays repairable:
+//!
+//! - An invalid source row needs only its first write. Every write queued for
+//!   a hidden build is validated against the build's own rules, so once the
+//!   entity has a queued operation its row is valid and a retry rereads it.
+//! - An oversized entity has no such check, so its first write may leave it
+//!   oversized. Deleting the entity is then still admitted, as is clearing
+//!   its indexed property, and writes to properties the index does not read
+//!   queue nothing.
+//!
+//! A transaction is refused only for a limit it grows, and a write to an
+//! entity already pending in the generation adds no member. So while repairs
+//! hold the member count above its limit, writes to pending entities are
+//! still admitted within the byte limit; only new entities are refused. A
+//! removal leaves the entity a member, so writing it back is not exempt from
+//! the byte limit: each entity a build blocks on adds at most one member and
+//! two operations (its first write and a removal) beyond the limits.
 
 use std::collections::hash_map::Entry;
 use std::collections::{BTreeMap, HashMap, HashSet};
@@ -46,7 +73,7 @@ use crate::encoding::v2::keys::scope::DataScope;
 use crate::encoding::v2::keys::IndexEntity;
 use crate::encoding::v2::values::indexes::operation_queue::QueuedOperationId;
 use crate::error::{HelixDbError, IndexBackpressureResource, IndexOperationBatchResource, Result};
-use crate::index_lifecycle::{IndexGenerationId, IndexId};
+use crate::index_lifecycle::{IndexGenerationId, IndexId, IndexOperationId};
 
 use super::lag::PublicationLagHistogram;
 use super::QueueTarget;
@@ -58,6 +85,29 @@ pub(crate) struct BacklogLimits {
     pub(crate) max_members: u64,
 }
 
+/// A hidden build stopped on a blocker, as the reserving transaction read it.
+///
+/// See "Blocked builds" in the module documentation.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub(crate) struct BlockedBuild {
+    /// The build's hidden generation.
+    pub(crate) target: QueueTarget,
+    pub(crate) operation_id: IndexOperationId,
+    /// The reserving transaction's operation on the entity the blocker names;
+    /// `None` when the blocker names no entity or the transaction does not
+    /// write it.
+    pub(crate) repair: Option<BlockerRepair>,
+}
+
+/// A reserving transaction's operation on the entity a blocker names.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub(crate) enum BlockerRepair {
+    /// Leaves the entity indexed; exempt only as its first queued operation.
+    Replace(IndexEntity),
+    /// Removes the entity from the index; always exempt.
+    Remove(IndexEntity),
+}
+
 /// One logical index across all of its generations.
 #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
 pub(crate) struct LogicalIndex {
@@ -213,22 +263,33 @@ impl IndexOperationBacklog {
     ///
     /// Either every charge is admitted or none is: limits are checked for all
     /// touched logical indexes before any state changes. Acceptance at exactly
-    /// the limit succeeds; one byte or member above it fails. A transaction
-    /// whose own charges exceed a limit could never be admitted, so it fails
-    /// with the non-retryable [`HelixDbError::IndexOperationBatchTooLarge`]
-    /// before any retryable [`HelixDbError::IndexBackpressure`] is considered.
+    /// the limit succeeds; one byte or member above it fails. Only a limit the
+    /// transaction grows can refuse it: an entity already pending in the
+    /// generation adds no member, so its writes are admitted even while the
+    /// member count is above the limit, as after a blocker repair (below) or
+    /// a reopen with a lower limit. A transaction whose own charges exceed a
+    /// limit could never be admitted, so it fails with the non-retryable
+    /// [`HelixDbError::IndexOperationBatchTooLarge`] before any retryable
+    /// [`HelixDbError::IndexBackpressure`] is considered.
     /// A transaction routes through one catalog snapshot, which holds a single
     /// generation per logical index, so charges for two generations of one
     /// index are an [`Helix
```

**File**: `crates/db/src/index_lifecycle/queue/backlog/tests.rs` (modified, +408/-83)
```diff
@@ -47,15 +47,15 @@ fn usage(backlog: &IndexOperationBacklog, index: u64) -> BacklogUsage {
 fn byte_limit_accepts_exactly_the_limit_and_rejects_one_more_byte() {
     let backlog = ledger(100, 1_000);
     backlog
-        .reserve(vec![charge(target(1, 1), 1, 1, 60)])
+        .reserve(&[charge(target(1, 1), 1, 1, 60)], &[])
         .unwrap()
         .committed();
     backlog
-        .reserve(vec![charge(target(1, 1), 2, 2, 40)])
+        .reserve(&[charge(target(1, 1), 2, 2, 40)], &[])
         .expect("reaching the limit exactly is admitted")
         .committed();
     let error = backlog
-        .reserve(vec![charge(target(1, 1), 3, 3, 1)])
+        .reserve(&[charge(target(1, 1), 3, 3, 1)], &[])
         .expect_err("one byte above the limit is rejected");
     assert!(matches!(
         error,
@@ -72,7 +72,7 @@ fn byte_limit_accepts_exactly_the_limit_and_rejects_one_more_byte() {
     backlog.acknowledge([id(1)]);
     assert_eq!(usage(&backlog, 1).retained_bytes, 40);
     backlog
-        .reserve(vec![charge(target(1, 1), 3, 3, 60)])
+        .reserve(&[charge(target(1, 1), 3, 3, 60)], &[])
         .unwrap()
         .committed();
 }
@@ -83,17 +83,17 @@ fn members_count_once_per_generation_entity_until_every_operation_is_acknowledge
     for operation in 1..=3 {
         // Repeated operations for one entity never add a member.
         backlog
-            .reserve(vec![charge(target(1, 1), 7, operation, 10)])
+            .reserve(&[charge(target(1, 1), 7, operation, 10)], &[])
             .unwrap()
             .committed();
     }
     backlog
-        .reserve(vec![charge(target(1, 1), 8, 4, 10)])
+        .reserve(&[charge(target(1, 1), 8, 4, 10)], &[])
         .expect("the second member reaches the limit exactly")
         .committed();
     assert_eq!(usage(&backlog, 1).members, 2);
     let error = backlog
-        .reserve(vec![charge(target(1, 1), 9, 5, 10)])
+        .reserve(&[charge(target(1, 1), 9, 5, 10)], &[])
         .expect_err("a third member is above the limit");
     assert!(matches!(
         error,
@@ -108,12 +108,12 @@ fn members_count_once_per_generation_entity_until_every_operation_is_acknowledge
     backlog.acknowledge([id(1), id(2)]);
     assert_eq!(usage(&backlog, 1).members, 2);
     assert!(backlog
-        .reserve(vec![charge(target(1, 1), 9, 5, 10)])
+        .reserve(&[charge(target(1, 1), 9, 5, 10)], &[])
         .is_err());
     backlog.acknowledge([id(3)]);
     assert_eq!(usage(&backlog, 1).members, 1);
     backlog
-        .reserve(vec![charge(target(1, 1), 9, 5, 10)])
+        .reserve(&[charge(target(1, 1), 9, 5, 10)], &[])
         .unwrap()
         .committed();
 }
@@ -122,20 +122,20 @@ fn members_count_once_per_generation_entity_until_every_operation_is_acknowledge
 fn generations_are_distinct_members_aggregated_per_logical_index() {
     let backlog = ledger(u64::MAX, 2);
     backlog
-        .reserve(vec![charge(target(1, 1), 7, 1, 10)])
+        .reserve(&[charge(target(1, 1), 7, 1, 10)], &[])
         .unwrap()
         .committed();
     // The same entity in another generation of the same index is a new member.
     backlog
-        .reserve(vec![charge(target(1, 2), 7, 2, 10)])
+        .reserve(&[charge(target(1, 2), 7, 2, 10)], &[])
         .unwrap()
         .committed();
     assert!(backlog
-        .reserve(vec![charge(target(1, 3), 7, 3, 10)])
+        .reserve(&[charge(target(1, 3), 7, 3, 10)], &[])
         .is_err());
     // Another logical index has its own limits.
     backlog
-        .reserve(vec![charge(target(2, 1), 7, 3, 10)])
+        .reserve(&[charge(target(2, 1), 7, 3, 10)], &[])
         .unwrap()
         .committed();
     assert_eq!(
@@ -149,7 +149,7 @@ fn generations_are_distinct_members_aggregated_per_logical_index() {
         IndexGenerationId::new(1).unwrap(),
     );
     backlog
-        .reserve(vec![charge(tenant, 7, 4, 10)])
+        .reserve(&[charge(tenant, 7, 4, 10)], &[])
         .unwrap()
         .committed();
 }
@@ -158,59 +158,371 @@ fn generations_are_distinct_members_aggregated_per_logical_index() {
 fn multi_index_reservations_are_all_or_nothing() {
     let backlog = ledger(100, 10);
     backlog
-        .reserve(vec![charge(target(2, 1), 1, 1, 95)])
+        .reserve(&[charge(target(2, 1), 1, 1, 95)], &[])
         .unwrap()
         .committed();
     let error = backlog
-        .reserve(vec![
-            charge(target(1, 1), 1, 2, 50),
-            charge(target(2, 1), 2, 3, 10),
-        ])
+        .reserve(
+            &[
+                charge(target(1, 1), 1, 2, 50),
+                charge(target(2, 1), 2, 3, 10),
+            ],
+            &[],
+        )
         .expect_err("the second index rejects the transaction");
     assert!(error.is_index_backpressure());
     assert_eq!(usage(&backlog, 1), BacklogUsage::default());
     assert_eq!(usage(&backlog, 2).retained_bytes, 95);
     // A duplicate operation ID is an invariant violation, not backpressure,
     //
```

**File**: `crates/db/src/index_lifecycle/queue/lifecycle_tests.rs` (modified, +1061/-27)
```diff
@@ -1084,15 +1084,18 @@ async fn uncertain_charges_of_a_hidden_build_reconcile_while_it_runs() {
     // one never committed.
     let mut lost = db
         .index_operation_backlog()
-        .reserve(vec![OperationCharge {
-            target,
-            entity: IndexEntity {
-                kind: IndexElementKind::Node,
-                id: IndexEntityId::new(ids[2]),
-            },
-            id: QueuedOperationId::generate(),
-            bytes: 64,
-        }])
+        .reserve(
+            &[OperationCharge {
+                target,
+                entity: IndexEntity {
+                    kind: IndexElementKind::Node,
+                    id: IndexEntityId::new(ids[2]),
+                },
+                id: QueuedOperationId::generate(),
+                bytes: 64,
+            }],
+            &[],
+        )
         .unwrap();
     lost.begin_commit();
     drop(lost);
@@ -1133,15 +1136,18 @@ async fn uncertain_charges_of_an_active_generation_reconcile_while_its_ownership
     // one never committed.
     let mut lost = db
         .index_operation_backlog()
-        .reserve(vec![OperationCharge {
-            target,
-            entity: IndexEntity {
-                kind: IndexElementKind::Node,
-                id: IndexEntityId::new(ids[2]),
-            },
-            id: QueuedOperationId::generate(),
-            bytes: 64,
-        }])
+        .reserve(
+            &[OperationCharge {
+                target,
+                entity: IndexEntity {
+                    kind: IndexElementKind::Node,
+                    id: IndexEntityId::new(ids[2]),
+                },
+                id: QueuedOperationId::generate(),
+                bytes: 64,
+            }],
+            &[],
+        )
         .unwrap();
     lost.begin_commit();
     drop(lost);
@@ -1324,13 +1330,20 @@ fn text_ids(hits: Vec<(u64, u64)>) -> Vec<u64> {
 }
 
 /// A build admits a document only when any later replacement can publish, so
-/// it blocks on an oversized source row until that row is repaired.
+/// it blocks on an oversized source row until that row is repaired. Nothing
+/// publishes the blocked build's queued work, so once writes fill its member
+/// cap, the repair is still admitted and an unrelated insert is refused
+/// without retryable backpressure.
 #[tokio::test]
 async fn text_build_blocks_on_a_document_publication_could_not_replace() {
     let db = open(
         "build-text-oversized",
         Arc::new(InMemory::new()),
-        tight_publication_config(),
+        tight_publication_config().with_index_operation_queue_tuning(
+            IndexOperationQueueTuning::default()
+                .with_max_members(NonZeroU64::new(2).unwrap())
+                .with_publication_paused_for_tests(),
+        ),
     )
     .await;
     let resident = add(&db, [0.0, 0.0], "small resident", None).await;
@@ -1341,18 +1354,48 @@ async fn text_build_blocks_on_a_document_publication_could_not_replace() {
         status(&db, &operation).await["blocker_code"],
         "oversized_entity"
     );
+    let mut fillers = Vec::new();
+    for body in ["alpha filler", "beta filler"] {
+        fillers.push(add(&db, [0.0, 0.0], body, None).await);
+    }
+    assert_eq!(db.index_operation_queue_stats().pending_members, 2);
     // The oversized row is only the previous document of the repair.
-    update(&db, wide, [0.0, 0.0], "narrow repaired").await;
+    db.query(QueryRequest::write(
+        batch::write_batch().var_as(
+            "repaired",
+            traversal::g()
+                .n(NodeRef::from(wide))
+                .set_property("body", "narrow repaired".to_string()),
+        ),
+    ))
+    .await
+    .expect("the oversized document's repair is admitted beyond the member cap");
+    assert_build_blocked(
+        db.query(QueryRequest::write(batch::write_batch().var_as(
+            "created",
+            traversal::g().add_n(
+                "Doc",
+                vec![("body", PropertyInput::from("gamma".to_string()))],
+            ),
+        )))
+        .await,
+        &operation,
+        crate::error::IndexBackpressureResource::PendingMembers,
+        "an unrelated insert",
+    );
     retry(&db, &operation).await;
     assert_eq!(wait_terminal(&db, &operation).await, "succeeded");
     let target = target(&db, QueueFamily::Text).await;
     drain(&db, target).await;
-    for (query, expected) in [("repaired", wide), ("resident", resident)] {
-        assert_eq!(
-            text_ids(text_search(&db, query, 10, None, SearchConsistency::Eventual).await),
-            vec![expected],
-            "{query}"
-        );
+    for (query, expected) in [
+        ("repaired", vec![wide]),
+        ("resident", vec![resident]),
+        ("filler", fillers),
+    ] {
+        let mut found =
+            text_ids(text_search(&db, query, 10, None, SearchConsistency::Eventual).await);
+        found.sort_unstable();
+        assert_eq!(found, expected, "{query}");
   
```

#### Recent Merged Pull Requests:
- **PR #1173** (2026-10-05): ci(docker-image): raise the quality job timeout to 60 minutes (@matthewsanetra)
- **PR #1172** (2026-10-05): Release CLI 3.4.3 and Docker v0.0.10 (@matthewsanetra)
- **PR #1169** (2026-10-05): fix(planner,db): count range-driven intersections with every filter (@matthewsanetra)
- **PR #1166** (2026-10-05): chore(deps): bump http-cache-semantics from 4.2.0 to 4.3.0 in /docs in the npm_and_yarn group across 1 directory (@dependabot[bot])
- **PR #1165** (2026-10-05): fix(db): hold back only the index entity whose publication keeps failing (@xav-db)
- **PR #1164** (2026-10-05): fix(sdks): validate signed 64-bit integer values (@DevChiniwala)
- **PR #1163** (2026-10-05): fix(ts-sdk): reject negative stream-bound literals (@DevChiniwala)
- **PR #1162** (2026-10-02): ci: refresh DB production coverage after the cold-read PRs (@xav-db)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
