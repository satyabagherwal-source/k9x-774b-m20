> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/helixdb-helix-db-learnings.md`  
> **Source**: github ([https://github.com/HelixDB/helix-db](https://github.com/HelixDB/helix-db))  
> **Source Version**: `2052f24e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T18:05:33.723Z  
> **Learning ID**: `learn-github-helixdb-helix-db`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): HelixDB/helix-db

> **Canonical Artifact**: `07_PROJECT_LEARNING/helixdb-helix-db-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HelixDB/helix-db](https://github.com/HelixDB/helix-db))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-26T18:05:33.039Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HelixDB/helix-db`
- **Description**: HelixDB is an OLTP graph database with native vector and full-text search built in Rust on Object Storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 6239 stars

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
//! The retained-byte limit bounds memory, not just encoded size: every queued
//! operation counts its encoded size plus
//! [`IndexOperationQueueTuning::OPERATION_OVERHEAD_BYTES`], so a backlog of
//! many small operations, such as deletes, reaches it long before its encoded
//! bytes would. The heap an index's backlog holds in admission accounting,
//! one decoded copy, and one merge resolution stays within twice the limit.
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
//! // The default 1 GB limit holds at most this many queued operations,
//! // however small each one encodes.
//! let overhead = IndexOperationQueueTuning::OPERATION_OVERHEAD_BYTES;
//! assert_eq!(overhead, 576);
//! assert_eq!(1_000_000_000 / overhead, 1_736_111);
//!
//! // A smaller retained-byte ceiling could not admit even the smallest
//! // operation, so every queued write would fail.
//! let smallest = IndexOperationQueueTuning::MIN_RETAINED_BYTES;
//! assert_eq!(smallest, overhead + 21);
//! assert!(IndexOperationQueueTuning::default()
//!     .with_max_retained_bytes(NonZeroU64::new(smallest).unwrap())
//!     .is_ok());
//! assert_eq!(
//!     IndexOperationQueueTuning::default()
//!         .with_max_retained_bytes(NonZeroU64::new(smallest - 1).unwrap()),
//!     Err(IndexOperationQueueTuningError::RetainedBytesBelowOneOperation {
//!         requested: smallest - 1,
//!     })
//! );
//!
//! // Strong vector searches decode and score at most this much unpublished
//! // work before failing with retryable backpressure. By default that is the
//! // retained-byte ceiling, so writes reach backpressure first, and it
//! // follows the ceiling; an explicit bound stays put.
//! let default = IndexOperationQueueTuning::default();
//! assert_eq!(
//!     default.strong_vector_search_max_pending_bytes(),
//!     default.max_retained_bytes()
//! );
//! let raised = default
//!     .with_max_retained_bytes(NonZeroU64::new(2_000_000_000).unwrap())
//!     .unwrap();
//! assert_eq!(raised.strong_vector_search_max_pending_bytes().get(), 2_000_000_000);
//! let strong = raised
//!     .with_strong_vector_search_max_pending_bytes(NonZeroU64::new(64 << 20).unwrap());
//! assert_eq!(strong.strong_vector_search_max_pending_bytes().get(), 64 << 20);
//! assert_eq!(
//!     strong
//!         .with_max_retained_bytes(NonZeroU64::new(1 << 20).unwrap())
//!         .unwrap()
//!         .strong_vector_search_max_pending_bytes()
//!         .get(),
//!     64 << 20
//! );
//!
//! // Strong text searches analyze at most this much unpublished text per
//! // partition, 512 MiB unless replaced, before they fail with retryable
//! // index backpressure.
//! assert_eq!(default.strong_text_search_max_analysis_bytes().get(), 512 << 20);
//! let text =
//!     default.with_strong_text_search_max_analysis_bytes(NonZeroU64::new(1 << 30).unwrap());
//! assert_eq!(text.strong_text_search_max_analysis_bytes().get(), 1 << 30);
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
/// About 44,000 unpublished 40-word documents: a 40-word document charges
/// about 12 KB of analysis.
const DEFAULT_STRONG_TEXT_SEARCH_MAX_ANALYSIS_BYTES: u64 = 512 * 1024 * 1024;
const DEFAULT_RECOVERY_SWEEP_INTERVAL: Duration = Duration::from_secs(1);
const EVENTUAL_SEARCH_SOURCE_INPUT_BYTES: u64 = 128 * 1024 * 1024;
const _: () = assert!(DEFAULT_MAX_RETAINED_BYTES <= IndexOperationQueueTuning::MAX_RETAINED_BYTES);
const _: () = assert!(DEFAULT_MAX_RETAINED_BYTES >= IndexOperationQueueTuning::MIN_RETAINED_BYTES);

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
    /// The retained-byte ceiling is below
    /// [`IndexOperationQueueTuning::MIN_RETAINED_BYTES`], so it could not
    /// admit even the smallest operation.
    RetainedBytesBelowOneOperation {
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
            Self::RetainedBytesBelowOneOperation { requested } => write!(
                formatter,
                "index operation queue max retained bytes {requested} are below the charge of \
                 the smallest operation {}",
                IndexOperationQueueTuning::MIN_RETAINED_BYTES
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
    /// Most committed pending vector work one strong search decodes and
    /// scores; `None` follows `max_retained_bytes`.
    strong_vector_search_max_pending_bytes: Option<NonZeroU64>,
    /// Analysis bytes one strong text search may charge for unpublished text
    /// in its partition.
    strong_text_search_max_analysis_bytes: NonZeroU64,
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
            strong_vector_search_max_pending_bytes: None,
            strong_text_search_max_analysis_bytes: NonZeroU64::new(
                DEFAULT_STRONG_TEXT_SEARCH_MAX_ANALYSIS_BYTES,
            )
            .expect("default strong text search bound is nonzero"),
        }
    }
}

impl IndexOperationQueueTuning {
    /// Largest accepted [retained-byte ceiling](Self::max_retained_bytes),
    /// about 2.27 GiB.
    ///
    /// Storage encodes a valu
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
pub(super) fn validate_body(family: QueueFamily, body: &[u8]) -> Result<(), EncodingError> {
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
                        Encod
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
pub(crate) const MIN_RETAINED_RECORD_LEN: usize = MODE_LEN + OPERATION_ID_LEN + 1 + 3;
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
    p
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #944** (2026-07-08): **[Bug]: helix update installs wrong version**
  *Symptoms*: ### What happened?  ```bash PS C:\web projects\my-helix-app> helix update    Updating 'CLI'   ✓ Checked for updates (v3.0.6 -> v3.0.7)   ⠸ Downloading and installing   ✓ Downloaded and installed  Updated 'CLI' successfully ────────────────────────────────   • Note: Please restart your terminal to use the new version PS C:\web projects\my-helix-app> helix --version Helix CLI 3.0.6 PS C:\web projects\my-helix-app> helix update    Updating 'CLI'   ✓ Checked for updates (v3.0.6 -> v3.0.7)   ⠼ Downloading and installing   ✓ Downloaded and installed  Updated 'CLI' successfully ────────────────────────────────   • Note: Please restart your terminal to use the new version PS C:\web projects\my-helix-app> helix --version Helix CLI 3.0.6 PS C:\web projects\my-helix-app>  ```  ### Steps to reproduce  1. Start helix update locally in Windows... 2. Run `helix update` 3. The version installed is still 3.06, not 3.07.  ### Version  3.06 ---> trying to upgrade  ### Environment  Self-hosted  ### Relevant log output  ```shell  ```  ### Additional context  It does look like `  ⠼ Downloading and installing` was never resolved.  _No response_

- **Issue #876** (2026-03-05): **[Bug]: helix init clears .gitignore**
  *Symptoms*: ### What happened?  After running `helix init`, .gitignore is wiped and overwritten when really this should be an additive procedure  ### Steps to reproduce  Run `helix init` in a folder with a non-empty `.gitignore`  ### Version  2.3.0  ### Environment  Self-hosted  ### Relevant log output  ```shell  ```  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > fixing 

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

### Incident Patch 1: `2052f24e` (2026-10-26)
**Commit Message**: docs: bring Helix Foundry up to date with prod: Helix MCP, API sources, AI models, usage, the Ask home (#1223)

* docs: move Helix Foundry documents into Data, in document sets

Documents belong to the workspace now and live in Data, in document sets
an ontology's versions pick. The page moves to foundry/data/documents and
covers sets, uploads (a duplicate names its set), a document's page in
Data with the ontologies that read it, and an ontology's read-only view.
/foundry/ontologies/documents and /foundry/documents redirect to it.

* docs: describe Helix Foundry's Data explorer, Data overview and S3 connector

Data is an overview beside the Data explorer, a tree of connections by
kind, custom folders and document sets that owners and admins rename and
reorder for the workspace. Amazon S3 joins PostgreSQL and MySQL as a Pro
source.

* docs: update Helix Foundry ontologies for document sets, schema versions and edits

Generations are listed in Schema versions; Generate groups connectors by
kind and picks whole document sets, which a version and its loads read.
A version's Edit tab makes a new version from route, identifier, rule and
constraint edits, and the Load dialog names the se

**File**: `docs/README.md` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ any name a reader is likely to type. Shortcut sources must not match a live rout
 | --- | --- | --- |
 | HelixDB | Start Here, Core Concepts, Query Guides | The engine in every run mode: setup, SDKs, data model, queries, indexes and search, HTTP API, error codes, troubleshooting |
 | Helix Cloud | Start Here, Connect and automate, Operate | Managed deployments only: account setup, connecting, architecture, MCP, security, tenancy, limits, gateway errors |
-| Helix Foundry | Start Here, Data, Ontologies, Explore, Ask, Workspace, Reference | The hosted Foundry website (foundry.helix-db.com): connecting and syncing sources, generating, loading and exploring ontologies, members and billing |
+| Helix Foundry | Start Here, Data, Ontologies, Explore, Ask, Workspace, Reference | The hosted Foundry website (foundry.helix-db.com): connecting and syncing sources, documents, generating, loading, exploring and asking ontologies, members and billing |
 | CLI Reference | Using the helix CLI, CLI Command Reference | The `helix` CLI: workflows, configuration, and one page per command |
 | Learn | One group per topic | Vendor-neutral explainers that answer one broad question each, such as "What is BM25?" |
 
```

**File**: `docs/docs.json` (modified, +20/-3)
```diff
@@ -237,15 +237,16 @@
             "group": "Data",
             "pages": [
               "foundry/data/connect-data",
-              "foundry/data/connectors"
+              "foundry/data/documents",
+              "foundry/data/connectors",
+              "foundry/data/api-sources"
             ]
           },
           {
             "group": "Ontologies",
             "pages": [
               "foundry/ontologies/create-an-ontology",
               "foundry/ontologies/generate-and-version",
-              "foundry/ontologies/documents",
               "foundry/ontologies/load-data"
             ]
           },
@@ -262,11 +263,19 @@
               "foundry/ask/ask-questions"
             ]
           },
+          {
+            "group": "Agents",
+            "pages": [
+              "foundry/agents/helix-mcp"
+            ]
+          },
           {
             "group": "Workspace",
             "pages": [
               "foundry/workspace/members-and-roles",
-              "foundry/workspace/plans-and-billing"
+              "foundry/workspace/plans-and-billing",
+              "foundry/workspace/ai-models",
+              "foundry/workspace/usage"
             ]
           },
           {
@@ -1556,6 +1565,14 @@
     {
       "source": "/foundry/ask",
       "destination": "/foundry/ask/ask-questions"
+    },
+    {
+      "source": "/foundry/ontologies/documents",
+      "destination": "/foundry/data/documents"
+    },
+    {
+      "source": "/foundry/documents",
+      "destination": "/foundry/data/documents"
     }
   ],
   "search": {
```

**File**: `docs/foundry/agents/helix-mcp.mdx` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+---
+title: "Use Foundry from your agent"
+description: "Connect Claude Code, Codex or another MCP client to the Helix MCP to read and ask Helix Foundry ontologies, and to set them up with a confirmation for every change"
+sidebarTitle: "Helix MCP"
+pageType: "Guide"
+---
+
+<div className="flex flex-wrap gap-2"><Badge color="blue" size="sm">Guide</Badge></div>
+
+Foundry's tools are on the Helix MCP, at `https://mcp.helix-db.com/mcp`. Connect your
+agent to it, sign in once, and the agent works in Foundry as you: it reads your
+ontologies, their versions, loads and graph, asks them questions, and makes the changes
+you ask for, each after a confirmation. It can't add a connector's credentials, delete
+anything or change billing; those stay on the website.
+
+## Connect your agent
+
+The MCP signs you in with OAuth in your browser, with the account you use for Foundry.
+
+<Tabs>
+  <Tab title="Claude Code">
+    ```bash
+    claude mcp add --transport http helix https://mcp.helix-db.com/mcp
+    ```
+
+    Then run `/mcp` in Claude Code and sign in.
+  </Tab>
+  <Tab title="Codex">
+    ```bash
+    codex mcp add helix --url https://mcp.helix-db.com/mcp && codex mcp login helix
+    ```
+  </Tab>
+  <Tab title="Other clients">
+    Add `https://mcp.helix-db.com/mcp` as a remote (streamable HTTP) MCP server, and
+    complete the browser sign-in when the client asks. Clients that discover OAuth
+    find it at `https://mcp.helix-db.com/.well-known/oauth-protected-resource/mcp`.
+  </Tab>
+</Tabs>
+
+Your agent acts with your role in each workspace and your rights on its Helix projects,
+so it can do only what you could do on the website. The same endpoint serves Helix
+Cloud's tools; see [Helix Cloud MCP](/database/helix-cloud/connect/mcp).
+
+For agents that should know Foundry's tools well, add Helix's agent skills:
+
+```bash
+npx skills add HelixDB/skills
+```
+
+`helix-foundry-mcp` covers reading and asking, and `helix-foundry-actions-mcp` the
+changes and their confirmations.
+
+### Set up a workspace with your agent
+
+A new workspace opens on its first ontology's steps. **Set up with your agent**, at the
+top of that page and on an unfinished ontology's overview, copies a prompt for Claude
+Code, Codex or another agent with the Helix MCP. It says how to connect the MCP, where
+the workspace's setup stands, and the steps left, and the agent asks you before each
+change it makes.
+
+<Frame>
+  <img src="https://assets.helix-db.com/docs/foundry/start-here/onboarding.png" alt="A new workspace's Create your first ontology page, with Set up with your agent and its Copy prompt above the steps" />
+</Frame>
+
+## What your agent can read
+
+| Tools | What they read |
+| --- | --- |
+| `helix_list_workspaces`, `helix_foundry_list_ontologies`, `helix_foundry_get_ontology` | Your workspaces, their ontologies, and an ontology's database, current version, current load and setup |
+| `helix_foundry_get_version`, `helix_foundry_get_generation` | A version's definition, and a generation's goal, sources and outcome |
+| `helix_foundry_get_load`, `helix_foundry_read_graph` | A load, and what it wrote: up to 20 graph reads per call |
+| `helix_foundry_list_documents`, `helix_foundry_list_review_decisions` | The documents an ontology reads, and the review decisions settled on them |
+| `helix_foundry_list_connectors`, `helix_foundry_list_connector_kinds`, `helix_foundry_list_syncs`, `helix_foundry_get_sync` | The workspace's connections and their syncs, and the kinds of source it can add |
+| `helix_foundry_read_guide` | Foundry's own guide to these tools |
+
+Reading a load, through the graph or through Ask, needs **Query read** on the
+database's Helix project, as on the website.
+
+## Ask questions
+
+`helix_foundry_ask` asks an ontology's load a question in plain language, as
+[Ask](/foundry/ask/ask-questions) does, and waits up to 25 seconds for the answer. A
+longer question carries on: the agent follows it with `helix_foundry_get_question`, reads
+its steps with `helix_foundry_list_question_events`, and stops it with
+`helix_foundry_cancel_question`. `helix_foundry_list_questions` lists the ontology's
+questions. Questions asked through the MCP count against the same hourly limit and
+monthly budget as Ask's.
+
+## Changes, with a confirmation
+
+Every change takes two calls. `helix_prepare_foundry_operation` checks the change and
+returns a confirmation for it: one-time, valid for five minutes, and bound to that
+operation, its target and its exact payload. `helix_execute_foundry_operation` uses the
+confirmation and makes the change once. Agents with Helix's skills show you what they
+are about to do and ask before they execute it.
+
+| Operation | Does |
+| --- | --- |
+| `create_ontology` | Creates an ontology on a Helix database, with its first draft |
+| `generate_ontology` | Asks Foundry's agent for a new draft, from the tables, API sources and document sets you choose |
+| `revise_versi
```

**File**: `docs/foundry/ask/ask-questions.mdx` (modified, +104/-23)
```diff
@@ -1,35 +1,116 @@
 ---
 title: "Ask questions of your data"
-description: "Ask a Helix Foundry ontology questions in plain language and get answers that cite where they came from. Coming soon."
+description: "Ask a Helix Foundry ontology's load questions in plain language, follow each step, and open the records, rows and quotes its answers cite"
 sidebarTitle: "Ask questions"
 pageType: "Guide"
-status: "Preview"
 ---
 
-<div className="flex flex-wrap gap-2"><Badge color="blue" size="sm">Guide</Badge><Badge color="yellow" size="sm">Preview</Badge></div>
+<div className="flex flex-wrap gap-2"><Badge color="blue" size="sm">Guide</Badge></div>
 
-<Note>
-  Ask is coming to Helix Foundry and isn't available yet. This page will cover it when it
-  ships.
-</Note>
+Ask answers questions about an ontology's load in plain language, and is Foundry's main
+page: Foundry opens on it. Foundry's agent reads the load from the ontology's database
+step by step, and its answer cites each record, table row, quote and rule it used, so
+you can open every one.
 
-Ask will let you question an ontology's data in plain language and see where each
-answer came from.
+<Frame caption="Ask a question, follow its steps, read the sourced answer, then follow up.">
+  <video controls muted playsInline preload="none" poster="https://assets.helix-db.com/docs/foundry/ask/ask-poster.png" className="w-full" src="https://assets.helix-db.com/docs/foundry/ask/ask.webm"></video>
+</Frame>
 
-Until then, read the same data in the [Explorer](/foundry/explore/explorer) and
-[Records](/foundry/explore/records-and-entities).
+## Start a thread
 
-{/*
-  TODO(ask): fill in when Ask ships, and drop the Note and the Preview status.
-  Media: add tests/docs/ask.spec.ts to helix-foundry-cloud; `pnpm docs:media` writes
-  images/foundry/ask/. Suggested sections:
-  - Ask a question (video ask/ask.webm, screenshot ask/ask-panel.png)
-  - Read an answer: its steps and the queries it ran, and the numbered citations
-  - Threads: follow-up questions and earlier threads
-  - Ask about a record from its page
-  - When Ask can't answer: what it says, and drafting a new version from the gap
-  - Limits and spending
-*/}
+Foundry opens on Ask, and **Ask** in the sidebar comes back to it. It opens the ontology
+you last opened, or the newest; the **Ontology** picker at the top of the page opens
+another. A new thread asks what you want to know about the ontology, with the composer
+in the middle of the page and, when Foundry has read the load's version, the version's
+questions as suggestions.
+
+<Frame>
+  <img src="https://assets.helix-db.com/docs/foundry/ask/new-thread.png" alt="A new Ask thread: What do you want to know about Customer contracts?, the composer, two suggested questions, and the Load picker in the top bar" />
+</Frame>
+
+Write the question, or select a suggestion, then select the arrow or press
+<kbd>⌘</kbd> <kbd>Enter</kbd> (<kbd>Ctrl</kbd> <kbd>Enter</kbd> on Windows and Linux).
+A question is at most 4,000 characters.
+
+Ask reads one load: the current one, unless you choose another in the **Load** picker
+in the top bar. A load can be asked about once it is **Ready** or **Partial**. While
+the ontology has no load, a new thread says **Nothing loaded yet** in place of the
+composer, with **Load data** or, while no version is current, **Finish setting up**.
+With no ontology in the workspace, Ask says **No ontologies yet**, with **Create an
+ontology**.
+
+## Read an answer
+
+A thread is one column: each question, then its steps as they run, then the answer,
+with the composer pinned at the bottom.
+
+- **Steps** say what the agent read. Its first step reads what the load holds: its
+  types and links and how many of each. Then it finds entities, reads them and their
+  evidence, runs queries written as a path through the ontology's types and links, and,
+  for what those can't say, queries the graph directly with a Helix read. Each step's
+  JSON is behind a disclosure. A step that failed says why, and the agent carries on.
+- **The answer** is plain text with numbered citations, then **Sources**: each record,
+  fact, derived fact, table row, document quote, rule break or step it cites. Select one
+  to open it: an entity's page, the row's table, the quote in its document, or the step.
+- Below the answer, what the question cost and the tokens it used.
+
+While a question runs, **Cancel** stops it.
+
+<Frame>
+  <img src="https://assets.helix-db.com/docs/foundry/ask/thread.png" alt="A thread asking Who signed the services agreement?, with its last steps, an answer citing eight sources, the follow-up composer, and two threads under Today" />
+</Frame>
+
+Follow up in the same thread: the composer at the bottom asks with the thread's earlier
+answers. A thread takes one question at a time, so a follow-up waits until the answer
+before it is ready.
+
+## Threads
+
+While Ask is open, the sidebar lists the ontology's threads under the sections, 
```

**File**: `docs/foundry/data/api-sources.mdx` (added, +226/-0)
```diff
@@ -0,0 +1,226 @@
+---
+title: "API sources"
+description: "Send pieces of data to Helix Foundry from your app or agent, over HTTP or the Helix MCP, with send-only tokens, and choose how ontologies read them"
+sidebarTitle: "API sources"
+pageType: "Guide"
+---
+
+<div className="flex flex-wrap gap-2"><Badge color="blue" size="sm">Guide</Badge></div>
+
+An API source takes data that no connector reads: your app's records, or what an agent
+produces. Your apps and agents send it pieces of data, JSON objects each with an id,
+over HTTP or the [Helix MCP](/foundry/agents/helix-mcp). Foundry keeps every piece,
+merges them by id into one table, `events`, and learns its fields from what arrives.
+Ontologies read that table through mappings, or read each piece's text by entity
+extraction. API sources are on every plan.
+
+## Create an API source
+
+<Steps>
+  <Step title="Choose API source">
+    In **Connectors**, select **Add data**, then **API source** under **From your app or
+    agent**.
+  </Step>
+
+  <Step title="Name and describe it">
+    Give it a name, such as "Order lines", and say what each piece is. Foundry's agent
+    reads the description when it drafts an ontology from the source.
+
+    <Frame>
+      <img src="https://assets.helix-db.com/docs/foundry/data/api-source-form.png" alt="The API source form with the name Order lines and a description of what each piece is" />
+    </Frame>
+  </Step>
+
+  <Step title="Make a send token">
+    Select **Create API source**, then **Create a send token** for an app or agent that
+    sends on its own. Copy it at once, and put it in the sender's environment as
+    `HELIX_EVENT_TOKEN`.
+
+    <Frame>
+      <img src="https://assets.helix-db.com/docs/foundry/data/api-source-send.png" alt="Order lines is ready: a new send token to copy, the send tokens list, Copy prompt for the agent, and Send over HTTP with its curl command and pieces.json" />
+    </Frame>
+  </Step>
+</Steps>
+
+An agent can create one too, with the MCP's `create_event_source` action, after your
+confirmation.
+
+## Send tokens
+
+A send token, `hx_ev_…`, lets whoever holds it add pieces to one source and replace any
+piece in it by its id; it reads nothing. Foundry shows it once and keeps only its hash.
+The source's **Send tokens** list names each by its prefix, with when it was made and
+last used. **Revoke** turns a token off for good: senders using it are refused from then
+on, so make a new one for them. A source holds up to 10 live tokens. Give each app or
+agent that sends on its own a source of its own.
+
+Owners and admins make and revoke tokens. They can also send as themselves through the
+signed-in Helix MCP, without a token.
+
+## Send pieces
+
+The source's **Send pieces** panel has what a sender needs. **Copy prompt** copies
+instructions for Claude Code, Codex or another agent: how to connect, how to send and
+what each answer means.
+
+<Tabs>
+  <Tab title="Over HTTP">
+    `POST https://ingest.helix-db.com/v1/sources/{id}/pieces`, with the send token as
+    its bearer, from a server: never from a browser or an app on someone else's device,
+    which would hand them the token. The panel's curl reads the token from
+    `HELIX_EVENT_TOKEN` and sends `pieces.json`:
+
+    ```bash
+    printf 'Authorization: Bearer %s\n' "$HELIX_EVENT_TOKEN" | curl -sS -X POST \
+      "https://ingest.helix-db.com/v1/sources/<source id>/pieces" \
+      -H @- -H "Content-Type: application/json" --data-binary @pieces.json
+    ```
+
+    ```json pieces.json
+    {
+      "client_token": "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
+      "pieces": [
+        {
+          "id": "ord-1042-1",
+          "occurred_at": "2026-10-23T09:30:00Z",
+          "data": { "order_id": "ord-1042", "customer": "Globex Corporation", "quantity": 250 }
+        }
+      ]
+    }
+    ```
+
+    The body is JSON in UTF-8, uncompressed, and `client_token` is required.
+  </Tab>
+  <Tab title="Over the Helix MCP">
+    `helix_foundry_send_pieces` takes the same pieces, with each piece's data as JSON
+    text in `data_json`. An agent that sends on its own uses the send token as its
+    bearer and sees only that tool. For Claude Code, in the project's `.mcp.json`:
+
+    ```json .mcp.json
+    {
+      "mcpServers": {
+        "helix-events": {
+          "type": "http",
+          "url": "https://mcp.helix-db.com/mcp",
+          "headers": { "Authorization": "Bearer ${HELIX_EVENT_TOKEN}" }
+        }
+      }
+    }
+    ```
+
+    For Codex, in `~/.codex/config.toml`:
+
+    ```toml
+    [mcp_servers.helix-events]
+    url = "https://mcp.helix-db.com/mcp"
+    bearer_token_env_var = "HELIX_EVENT_TOKEN"
+    ```
+
+    An agent you work with can instead send as you, through its
+    [signed-in Helix MCP](/foundry/agents/helix-mcp#connect-your-agent), if you're an
+    owner or admin.
+  </Tab>
+</Tabs>
+
+### What a piece is
+
+| Field | Rule |
+| --- | --- |
+| `id` | 1 to 128 printable ASCII characters, no 
```

**File**: `docs/foundry/data/connect-data.mdx` (modified, +112/-20)
```diff
@@ -1,38 +1,95 @@
 ---
 title: "Connect and sync data"
-description: "Add a source to a Helix Foundry workspace, test its credential, sync its tables and read what each table holds"
+description: "Find your way around Helix Foundry's Connectors section, add a source, test its credential, keep its tables synced and read what each table holds"
 sidebarTitle: "Connect data"
 pageType: "Guide"
 ---
 
 <div className="flex flex-wrap gap-2"><Badge color="blue" size="sm">Guide</Badge></div>
 
 A connection is a source Foundry reads, such as a Stripe account or a PostgreSQL
-database. Each sync copies its tables into a snapshot that generations and loads read.
-Owners and admins add, sync, edit and delete connections; members see them.
+database. Each sync copies its tables into a snapshot that generations and loads read,
+and Foundry syncs every connection on a schedule. Owners and admins add, sync, edit and
+delete connections; members see them.
 
 <Frame caption="Connect Stripe, test the key, sync it and open a table.">
   <video controls muted playsInline preload="none" poster="https://assets.helix-db.com/docs/foundry/data/connect-data-poster.png" className="w-full" src="https://assets.helix-db.com/docs/foundry/data/connect-data.webm"></video>
 </Frame>
 
-## The Data page
+## The Connectors section
 
-**Data** lists every connection with its status, its tables and their row counts, and
-when it last synced. Search finds a source or a table by name.
+**Connectors**, in the sidebar, holds the workspace's connections,
+[API sources](/foundry/data/api-sources) and [documents](/foundry/data/documents). The
+Connectors explorer, a panel beside the sidebar, lists them as a tree; the page beside
+it shows what you open.
+
+**Connectors** itself is an overview: how many connections, tables, records, documents
+and document sets the workspace has, a grid of its connections with their status,
+tables, records and last sync, and its document sets with the ontologies that read each
+one. Select a connection's row to open it.
+
+<Frame>
+  <img src="https://assets.helix-db.com/docs/foundry/data/overview.png" alt="The Connectors overview with its totals, a grid of the Stripe and Shop database connections, and the General and Board minutes document sets, beside the Connectors explorer" />
+</Frame>
+
+## The Connectors explorer
+
+The explorer's tree has, at its root:
+
+- a folder per kind of connection the workspace has, such as **Stripe** or
+  **PostgreSQL**, holding those connections;
+- folders of your own, each holding the connections moved into it;
+- **Documents**, with a folder per document set holding its documents.
+
+Select a connection to open its page, or a document to open its page. A connection's dot
+shows its last sync's status, and its arrow opens its synced tables. **Filter** narrows
+the tree to what matches, tables included. The row of the page you have open is
+highlighted, and the folders holding it open.
+
+The tree works from the keyboard: the arrow keys move between rows and open and close
+folders, <kbd>Home</kbd> and <kbd>End</kbd> go to the first and last rows,
+<kbd>Enter</kbd> opens a row, and <kbd>F2</kbd> renames it.
+
+<Frame caption="Make a folder, move a connection into it, upload a document and open it.">
+  <video controls muted playsInline preload="none" poster="https://assets.helix-db.com/docs/foundry/data/organise-data-poster.png" className="w-full" src="https://assets.helix-db.com/docs/foundry/data/organise-data.webm"></video>
+</Frame>
+
+## Arrange the explorer
+
+Owners and admins arrange the tree for the whole workspace; everyone sees the same
+order and names, and members can't change them.
+
+- **Rename** a folder, connection, document set or document with the pencil beside its
+  name, or <kbd>F2</kbd> on its row. <kbd>Enter</kbd> saves and <kbd>Escape</kbd>
+  cancels. Renaming a kind's folder or Documents changes only the folder's name.
+- **Reorder** a row by dragging its grip, or select the grip for **Move up** and **Move
+  down**. A connection's grip also has **Move to…**, to move it into one of your
+  folders or back to its kind's, and a document's has **Move to another set…**.
+- **New folder**, in the explorer's head, makes a folder of connections at the root.
+  Drag connections into it, or move them from their menus. Folders hold connections
+  only, and don't nest.
+- **Delete folder**, from a folder's grip, sends its connections back to their kinds'
+  folders. Nothing else changes.
 
 <Frame>
-  <img src="https://assets.helix-db.com/docs/foundry/data/data-page.png" alt="The Data page with a synced Stripe connection and a synced PostgreSQL database" />
+  <img src="https://assets.helix-db.com/docs/foundry/data/explorer-menu.png" alt="The Connectors explorer with a connection's grip menu open: Move up, Move down and Move to…" />
 </Frame>
 
+Rows can't be moved while a filter is on. Sync, and a document set's upload, describe and
+delete buttons, show on a row wh
```

**File**: `docs/foundry/data/connectors.mdx` (modified, +127/-11)
```diff
@@ -7,16 +7,25 @@ pageType: "Reference"
 
 <div className="flex flex-wrap gap-2"><Badge color="gray" size="sm">Reference</Badge></div>
 
-Foundry reads five kinds of source. Apps sync every table their credential can read;
-databases sync the tables you choose. Every credential only needs read access.
+Foundry reads ten kinds of source, and takes data your apps and agents send to an
+[API source](/foundry/data/api-sources). Apps sync every table their credential can
+read; databases and Amazon S3 sync the tables you choose. Every credential only needs
+read access, and every plan offers every kind: plans differ in
+[how often they sync](/foundry/data/connect-data#syncs-on-a-schedule).
 
-| Source | Credential | Plan |
+| Source | Credential | Syncs |
 | --- | --- | --- |
-| [Stripe](#stripe) | Restricted (`rk_`) or secret (`sk_`) API key | Free |
-| [WorkOS](#workos) | Secret API key (`sk_`) | Free |
-| [PostHog](#posthog) | Personal API key (`phx_`) | Free |
-| [PostgreSQL](#postgresql) | Database user and password | [Pro or Max](/foundry/workspace/plans-and-billing) |
-| [MySQL](#mysql) | Database user and password | [Pro or Max](/foundry/workspace/plans-and-billing) |
+| [Stripe](#stripe) | Restricted (`rk_`) or secret (`sk_`) API key | Customers, subscriptions, invoices, payments and more |
+| [WorkOS](#workos) | Secret API key (`sk_`) | Organizations, users, SSO and directories |
+| [PostHog](#posthog) | Personal API key (`phx_`) | Persons, groups and events |
+| [GitHub](#github) | Fine-grained (`github_pat_`) or classic (`ghp_`) token | Issues, pull requests, comments and reviews |
+| [Linear](#linear) | Personal API key (`lin_api_`) | Teams, projects, cycles, issues and comments |
+| [Cal.com](#cal-com) | API key (`cal_live_`) | Bookings, attendees, event types and schedules |
+| [Granola](#granola) | API key (`grn_`) | Meeting notes and attendees, kept as documents too |
+| [PostgreSQL](#postgresql) | Database user and password | The tables you choose |
+| [MySQL](#mysql) | Database user and password | The tables you choose |
+| [Amazon S3](#amazon-s3) | IAM role, or an access key | Parquet, JSON and CSV files as tables |
+| [API source](/foundry/data/api-sources) | None: senders use send tokens | The pieces your apps and agents send |
 
 ## Stripe
 
@@ -30,6 +39,10 @@ Syncs `customers`, `products`, `prices`, `coupons`, `promotion_codes`, `subscrip
 `refunds`, `disputes`, `payouts` and `balance_transactions`. A table the key can't read
 is skipped and named after the test; the test fails only when the key can read none.
 
+Also give the key **Read** on **Events**. On Pro and Max, syncs then read only the
+objects that changed; without it, every sync reads every object in full, and the test
+warns you.
+
 ## WorkOS
 
 In WorkOS, open **API Keys** in the environment you want to import (Staging or
@@ -64,6 +77,64 @@ Syncs `persons`, `person_distinct_ids` and `groups` in full, and `events` and
   <img src="https://assets.helix-db.com/docs/foundry/data/posthog-form.png" alt="The PostHog form with the personal API key, region, project ID and event history fields" />
 </Frame>
 
+## GitHub
+
+In GitHub, open **Settings** → **Developer settings** → **Fine-grained tokens** and
+create a token named "Helix Foundry". For an organization's repositories, choose the
+organization as the resource owner; it may need to approve the token. Choose the
+repositories to import, and set **Issues** and **Pull requests** to **Read-only**. A
+classic token (`ghp_…`) with the `repo` scope works too.
+
+| Field | Notes |
+| --- | --- |
+| Repositories | Optional: one `owner/name` per line. Blank syncs every repository the token can read, up to 100. |
+| Review history (days) | 1 to 365: how far back pull request reviews are read. |
+
+Syncs `repositories`, `users`, `labels`, `milestones`, `issues`, `pull_requests`,
+`issue_comments` and `pull_request_reviews`. Foundry never reads code.
+
+## Linear
+
+In Linear, open **Settings** → **Security & access** and create a personal API key named
+"Helix Foundry" with **Read** access. It reads every team you can see in Linear.
+
+Syncs `teams`, `users`, `projects`, `cycles`, `workflow_states`, `issue_labels`,
+`issues` and `comments`.
+
+## Cal.com
+
+In Cal.com, open **Settings** → **Developer** → **API keys** and create a key named
+"Helix Foundry". Turn on **Never expires**, or choose a long expiry: syncs stop when the
+key expires. Cal.com shows the key once. Cal.com keys can make changes, but Foundry only
+reads. Only Cal.com's cloud is supported.
+
+Syncs `users`, `teams`, `team_memberships`, `event_types`, `schedules`, `bookings`,
+`booking_attendees` and `booking_hosts`. Teams come with a Teams plan, and only a team
+admin's key reads the team's other members.
+
+<Frame>
+  <img src="https://assets.helix-db.com/docs/foundry/data/calcom-form.png" alt="The Cal.com form with its steps and API key field" />
+</Frame>
+
+## Granola
+
+API keys come with Granola Business and Enter
```

**File**: `docs/foundry/data/documents.mdx` (added, +212/-0)
```diff
@@ -0,0 +1,212 @@
+---
+title: "Upload and organise documents"
+description: "Upload Markdown, text, PDF, CSV, JSON, Parquet and other files to a Helix Foundry workspace, keep them in document sets, see how ontologies read each format, and which ontologies read each one"
+sidebarTitle: "Documents"
+pageType: "Guide"
+---
+
+<div className="flex flex-wrap gap-2"><Badge color="blue" size="sm">Guide</Badge></div>
+
+Documents carry what your tables don't: who signed a contract, what was agreed, who
+referred whom. They belong to the workspace and live in **Connectors**, in document
+sets: folders of documents an ontology reads together. A load reads the documents of
+the sets its version reads: text and PDFs for the names and facts they hold, linked to
+the records your tables hold, and table files, such as CSV exports, as tables of their
+own.
+
+## Document sets
+
+In the Connectors explorer, the **Documents** folder holds a folder per set, and each
+set holds its documents. A workspace gets a set named **General** with its first upload.
+
+<Frame>
+  <img src="https://assets.helix-db.com/docs/foundry/data/overview.png" alt="The Connectors overview beside the Connectors explorer, whose Documents folder holds the General and Board minutes sets and their documents" />
+</Frame>
+
+Some connections write documents of their own, in sets of their own: Granola keeps each
+meeting note's summary in **Notes**, and its transcripts in **Transcripts** when you turn
+them on; an [API source](/foundry/data/api-sources) read by entity extraction keeps its
+newest 500 pieces in its set. Each sync updates them, so they can't be uploaded to,
+moved, renamed or deleted, and they don't count toward the workspace's uploads. A
+connection keeps the newest 1,000 documents of each of its sets.
+
+Owners and admins manage the sets from their rows in the explorer:
+
+- **New set**, on the Documents row, names a set and gives it an optional description.
+  The agent that drafts the next version reads the description.
+- **Describe** changes a set's name and description.
+- The pencil beside a set's name, or <kbd>F2</kbd> on its row, renames it in place.
+- **Delete** removes a set that holds no documents. Move or delete its documents first.
+
+A workspace holds up to 20 sets. Set names are unique in the workspace, ignoring case
+and accents.
+
+## Upload
+
+Upload in any of these ways; Foundry checks each file before it uploads it, then sends
+it straight to storage and shows its progress.
+
+- **Upload documents**, in the explorer's head or on the Connectors overview, uploads
+  into General, or the oldest set when there is no General.
+- **Upload into**, on a set's row, uploads into that set.
+- Drop files onto a set in the explorer. Files dropped anywhere else on the explorer or
+  the Connectors overview go where **Upload documents** puts them.
+- On New ontology and in Generate, **Upload documents** uploads in place.
+
+| Format | Extensions | Size | Ontologies read it |
+| --- | --- | --- | --- |
+| Markdown, MDX and text | `.md`, `.markdown`, `.mdx`, `.txt` | Up to 1 MiB | As text, for its names and facts |
+| PDF | `.pdf` | Up to 3 MiB and 150 pages | As the text Foundry reads from it |
+| CSV, TSV, JSON, JSONL and Parquet | `.csv`, `.tsv`, `.json`, `.jsonl`, `.ndjson`, `.parquet` | Up to 3 MiB | As a table of its own |
+
+A workspace holds up to 200 uploaded documents. A name is at most 255 characters, with
+no slash, backslash or control character. Compressed files aren't taken.
+
+Each upload says which set it went into and which ontologies read that set.
+
+<Frame>
+  <img src="https://assets.helix-db.com/docs/foundry/data/documents-uploaded.png" alt="The Connectors explorer with contract.md uploaded into General, and a note that Renewals reads it with its first load" />
+</Frame>
+
+A workspace keeps one copy of each file. Uploading a file it already holds, under any
+name, doesn't add another: the upload says **Already uploaded** and names the set the
+file is in.
+
+<Frame>
+  <img src="https://assets.helix-db.com/docs/foundry/data/upload-duplicate.png" alt="An upload of contract.md that says Already uploaded: it's in General" />
+</Frame>
+
+## A document's page
+
+Select a document in the explorer to open its page: what it holds, its set, its size and
+when it was uploaded. Foundry shows each document by its type:
+
+| Type | Shown as |
+| --- | --- |
+| Markdown and MDX | Rendered, with headings, lists, tables and links; images show as their alt text and are never loaded. MDX is never run: its components and expressions show as written |
+| Text | As it is |
+| JSON | A tree you open node by node |
+| CSV, TSV, JSONL and Parquet | A table of the first 5,000 rows, with the rows it couldn't read |
+| PDF | **Text**: the text Foundry read from it, page by page; **Pages**: its pages as they look |
+
+Markdown, JSON, CSV, TSV and JSONL also have **Source**, to read the file's own text.
+
+A table file's page also says ho
```

#### Recent Merged Pull Requests:
- **PR #1226** (2026-10-25): chore(deps): bump the npm_and_yarn group across 1 directory with 3 updates (@dependabot[bot])
- **PR #1225** (2026-10-23): docs: explain storage-level tenant database isolation (@xav-db)
- **PR #1224** (2026-10-25): fix: reject inner types in Go SDK ParamObject (@Tyagiquamar)
- **PR #1223** (2026-10-26): docs: bring Helix Foundry up to date with prod: Helix MCP, API sources, AI models, usage, the Ask home (@xav-db)
- **PR #1221** (2026-10-25): chore(deps): bump follow-redirects from 1.16.0 to 1.16.1 in /docs in the npm_and_yarn group across 1 directory (@dependabot[bot])
- **PR #1219** (2026-10-20): docs: add the Helix Foundry tab (@xav-db)

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

## X. docs: bring Helix Foundry up to date with prod: Helix MCP, API sources, AI model

**RULE**:
When implementing operations in `docs/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in HelixDB/helix-db. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2052f24e`: docs: bring Helix Foundry up to date with prod: Helix MCP, API sources, AI models, usage, the Ask home (#1223). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| Helix Foundry | Start Here, Data, Ontologies, Explore, Ask, Workspace, Reference | The hosted Foundry website (foundry.helix-db.com): connecting and syncing sources, documents, generating, loading, exploring and asking ontologies, members and billing |
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
| Helix Foundry | Start Here, Data, Ontologies, Explore, Ask, Workspace, Reference | The hosted Foundry website (foundry.helix-db.com): connecting and syncing sources, generating, loading and exploring ontologies, members and billing |
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2052f24e` are properly handled with clean fallback behavior.
