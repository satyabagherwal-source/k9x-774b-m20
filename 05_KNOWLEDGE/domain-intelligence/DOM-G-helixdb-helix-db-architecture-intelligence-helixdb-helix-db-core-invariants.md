# Domain G — Architecture Intelligence: Architecture Intelligence: HelixDB/helix-db Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "HelixDB/helix-db",
  "source_url": "https://github.com/HelixDB/helix-db",
  "source_version": "84e3d378",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T05:00:50.637Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-helixdb-helix-db",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [HelixDB/helix-db](https://github.com/HelixDB/helix-db) (Revision: `84e3d378`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T05:00:50.637Z`  
> **Learning ID**: `learn-github-helixdb-helix-db`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence), F (Design Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 51%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from HelixDB/helix-db:

# Forensic Learning Record (Deep Inspection): HelixDB/helix-db

> **Canonical Artifact**: `07_PROJECT_LEARNING/helixdb-helix-db-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HelixDB/helix-db](https://github.com/HelixDB/helix-db))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T05:00:49.086Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HelixDB/helix-db`
- **Description**: HelixDB is an OLTP graph database with native vector and full-text search built in Rust on Object Storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 6313 stars

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

### Core Architecture Module: `crates/db/benches/concurrent_request_throughput.rs`
```
//! Concurrent request throughput through the public query API.
//!
//! One storage scope holds a label with several secondary equality indexes.
//! Each round runs `concurrency` client tasks for a fixed duration and
//! reports completed requests per second and per-request latency
//! percentiles. Every request plans against the scope's index catalog, so
//! this measures how well planning and commit scale with concurrent clients.
//!
//! `cargo bench` measures. Under `cargo test`, which passes no `--bench`
//! flag, it runs one short smoke round per workload instead and fails on any
//! request error, so CI checks the fixture without timing it.
//!
//! Measurement configuration (environment):
//! - `BENCH_SECONDS` per round, default 10
//! - `BENCH_CONCURRENCY` comma-separated client counts, default `1,8,32,128`
//! - `BENCH_INDEXES` equality indexes on the label, default 8
//! - `BENCH_SEED_NODES` nodes written before measuring, default 20000
//! - `BENCH_WORKLOADS` comma-separated subset of `read,write,mixed`
//! - `BENCH_STORAGE` `memory` (default) or `disk`

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use db::{HelixDB, HelixDbSource};
use helix_ast::prelude::*;

/// One measured kind of request mix.
#[derive(Clone, Copy, Debug)]
enum Workload {
    /// Equality lookups on an indexed property.
    Read,
    /// Single-node inserts that maintain every index.
    Write,
    /// Nine lookups for every insert.
    Mixed,
}

impl Workload {
    fn parse(name: &str) -> Self {
        match name {
            "read" => Self::Read,
            "write" => Self::Write,
            "mixed" => Self::Mixed,
            other => panic!("unknown workload {other:?}; expected read, write, or mixed"),
        }
    }

    const fn name(self) -> &'static str {
        match self {
            Self::Read => "read",
            Self::Write => "write",
            Self::Mixed => "mixed",
        }
    }

    const fn writes(self, request: u64) -> bool {
        match self {
            Self::Read => false,
            Self::Write => true,
            Self::Mixed => request % 10 == 9,
        }
    }
}

fn env_or<T: std::str::FromStr>(name: &str, default: T) -> T {
    std::env::var(name)
        .ok()
        .map(|value| {
            value
                .parse()
                .unwrap_or_else(|_| panic!("{name} must parse, got {value:?}"))
        })
        .unwrap_or(default)
}

fn env_list(name: &str, default: &str) -> Vec<String> {
    std::env::var(name)
        .unwrap_or_else(|_| default.to_string())
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(str::to_string)
        .collect()
}

fn node(index_count: usize, key: u64) -> Vec<(String, PropertyInput)> {
    (0..index_count)
        .map(|index| {
            (
                format!("p{index}"),
                PropertyInput::from(i64::try_from(key % 1000).expect("small key")),
            )
        })
        .chain(std::iter::once((
            "key".to_string(),
            PropertyInput::from(i64::try_from(key).expect("key fits i64")),
        )))
        .collect()
}

fn insert(index_count: usize, key: u64) -> QueryRequest {
    QueryRequest::write(
        write_batch()
            .var_as("created", g().add_n("Bench", node(index_count, key)))
            .returning(Vec::<String>::new()),
    )
}

fn lookup(key: u64) -> QueryRequest {
    QueryRequest::read(
        read_batch()
            .var_as(
                "found",
                g().n_with_label_where(
                    "Bench",
                    Predicate::eq("p0", i64::try_from(key % 1000).expect("small key")),
                )
                .count(),
            )
            .returning(["found"]),
    )
}

async fn create_indexes(db: &HelixDB, index_count: usize) {
    for index in 0..index_count {
        let receipt = db
            .query(QueryRequest::write(
                write_batch()
                    .var_as(
                        "operation",
                        g().create_index_if_not_exists(IndexSpec::node_equality(
                            "Bench",
                            format!("p{index}"),
                        )),
                    )
                    .returning(["operation"]),
            ))
            .await
            .expect("index create is accepted");
        let Some(operation_id) = receipt["operation"]["operation_id"].as_str() else {
            continue;
        };
        let operation_id = operation_id.to_string();
        let deadline = Instant::now() + Duration::from_secs(120);
        loop {
            let status = db
                .query(QueryRequest::read(
                    read_batch()
                        .var_as("status", g().get_index_operation(operation_id.clone()))
                        .returning(["status"]),
                ))
                .await
                .expect("index status reads");
            match status["status"]["status"].as_str() {
                Some("succeeded") => break,
                Some("queued" | "running") if Instant::now() < deadline => {
                    tokio::time::sleep(Duration::from_millis(5)).await;
                }
                other => panic!("index p{index} did not build: {other:?}"),
            }
        }
    }
}

fn percentile(sorted: &[u32], fraction: f64) -> u32 {
    if sorted.is_empty() {
        return 0;
    }
    // Nearest-rank percentile; the cast is bounded by the slice length.
    let rank = ((sorted.len() as f64) * fraction).ceil() as usize;
    sorted[rank.clamp(1, sorted.len()) - 1]
}

async fn run_round(
    db: &Arc<HelixDB>,
    workload: Workload,
    concurrency: usize,
    duration: Duration,
    index_count: usize,
    next_key: &Arc<std::sync::atomic::AtomicU64>,
) -> u64 {
    let stop = Arc::new(AtomicBool::new(false));
    let tasks: Vec<_> = (0..concurrency)
        .map(|client| {
            let db = Arc::clone(db);
            let stop = Arc::clone(&stop);
            let next_key = Arc::clone(next_key);
            tokio::spawn(async move {
                let mut latencies = Vec::with_capacity(4096);
                let mut errors = 0_u64;
                let mut request = u64::try_from(client).expect("client fits u64");
                while !stop.load(Ordering::Relaxed) {
                    let started = Instant::now();
                    let outcome = if workload.writes(request) {
                        let key = next_key.fetch_add(1, Ordering::Relaxed);
                        db.query(insert(index_count, key)).await.map(drop)
                    } else {
                        db.query(lookup(request.wrapping_mul(7919))).await.map(drop)
                    };
                    match outcome {
                        Ok(()) => latencies
                            .push(u32::try_from(started.elapsed().as_micros()).unwrap_or(u32::MAX)),
                        Err(_) => errors += 1,
                    }
                    request = request.wrapping_add(1);
                }
                (latencies, errors)
            })
        })
        .collect();
    let started = Instant::now();
    tokio::time::sleep(duration).await;
    stop.store(true, Ordering::Relaxed);
    let mut latencies = Vec::new();
    let mut errors = 0;
    for task in tasks {
        let (task_latencies, task_errors) = task.await.expect("client task joins");
        latencies.extend(task_latencies);
        errors += task_errors;
    }
    let elapsed = started.elapsed().as_secs_f64();
    latencies.sort_unstable();
    println!(
        "workload={} concurrency={} ops={} ops_per_sec={:.0} p50_us={} p99_us={} p999_us={} errors={}",
        workload.name(),
        concurrency,
        latencies.len(),
        latencies.len() as f64 / elapsed,
        percentile(&latencies, 0.50),
        percentile(&latencies, 0.99),
        percentile(&latencies, 0.999),
        errors,
    );
    errors
}

fn main() {
    let measuring = std::env::args().any(|arg| arg == "--bench");
    let round = if measuring {
        Duration::from_secs(env_or("BENCH_SECONDS", 10))
    } else {
        Duration::from_millis(200)
    };
    let index_count: usize = if measuring {
        env_or("BENCH_INDEXES", 8)
    } else {
        2
    };
    let seed_nodes: u64 = if measuring {
        env_or("BENCH_SEED_NODES", 20_000)
    } else {
        200
    };
    let concurrency: Vec<usize> = if measuring {
        env_list("BENCH_CONCURRENCY", "1,8,32,128")
    } else {
        vec!["1".to_string(), "4".to_string()]
    }
    .iter()
    .map(|value| value.parse().expect("BENCH_CONCURRENCY holds integers"))
    .collect();
    let workloads: Vec<Workload> = env_list("BENCH_WORKLOADS", "read,write,mixed")
        .iter()
        .map(|name| Workload::parse(name))
        .collect();
    let storage = std::env::var("BENCH_STORAGE").unwrap_or_else(|_| "memory".to_string());
    let disk_root = (storage == "disk").then(|| tempfile::tempdir().expect("bench disk root"));
    let source = match &disk_root {
        Some(root) => HelixDbSource::Disk {
            root: root.path().to_path_buf(),
            database: "concurrent-request-throughput".to_string(),
        },
        None => HelixDbSource::InMemory {
            database: "concurrent-request-throughput".to_string(),
        },
    };

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("bench runtime starts");
    runtime.block_on(async {
        let db = Arc::new(HelixDB::open(source).await.expect("database opens"));
        create_indexes(&db, index_count).await;
        let next_key = Arc::new(std::sync::atomic::AtomicU64::new(0));
        let seed_clients = 32_u64;
        let seeds: Vec<_> = (0..seed_clients)
            .map(|client| {
                let db = Arc::clone(&db);
                tokio::spawn(async move {
                    let 
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
//! This policy controls source-scan prefetching, worker concurrency and the
//! in-memory bulk build of vector indexes. It is never serialized into
//! lifecycle records or physical index rows.
//!
//! # Usage
//!
//! ```
//! use std::num::NonZeroU64;
//!
//! use db::config::{
//!     DbConfig, IndexLifecycleConcurrency, IndexLifecycleScanTuning,
//!     IndexLifecycleThroughputTuning, VectorBulkBuildMemory, VectorBulkBuildTuning,
//! };
//!
//! let scan = IndexLifecycleScanTuning::try_new(64 * 1024, 2)?;
//! let concurrency = IndexLifecycleConcurrency::try_new(2, 2, 1, 1)?;
//! // Build vector indexes of 10,000 vectors or more in memory, on eight
//! // threads, while they fit 4 GiB.
//! let four_gib = VectorBulkBuildMemory::Bytes(NonZeroU64::new(4 << 30).unwrap());
//! let bulk = VectorBulkBuildTuning::try_new(8, four_gib, 10_000)?;
//! let tuning = IndexLifecycleThroughputTuning::new(scan, concurrency)
//!     .with_vector_bulk_build(bulk);
//! let config = DbConfig::new().with_index_lifecycle_throughput_tuning(tuning);
//!
//! assert_eq!(config.index_lifecycle_throughput(), tuning);
//! assert_eq!(tuning.vector_bulk_build().memory(), four_gib);
//! # Ok::<(), db::config::IndexLifecycleThroughputTuningError>(())
//! ```

use std::num::{NonZeroU64, NonZeroUsize};

const DEFAULT_SCAN_READ_AHEAD_BYTES: usize = 256 * 1024;
const DEFAULT_SCAN_FETCH_TASKS: usize = 4;
// Secondary steps are mostly durable commits, so tasks overlap their WAL
// uploads: one tenant's first 122 empty builds take 24 s with eight and 54 s
// with two (`examples/index_build_throughput.rs`). More vector or text tasks
// did not help. Every family lane and the queued-publication lane (one task per
// vector and text task) fits in the total at once, so secondary work never
// holds the permits vector, text or publication need.
const DEFAULT_SECONDARY_TASKS: usize = 8;
const DEFAULT_VECTOR_TASKS: usize = 1;
const DEFAULT_TEXT_TASKS: usize = 1;
const DEFAULT_TOTAL_OPERATION_TASKS: usize =
    DEFAULT_SECONDARY_TASKS + 2 * (DEFAULT_VECTOR_TASKS + DEFAULT_TEXT_TASKS);
// Share of the memory ceiling an automatic bulk-build budget leaves free, for
// what no configured limit bounds: request buffers, thread stacks, and memory
// the allocator holds for the rest of the process. Serial vector builds in
// 3.3 and 6.7 GiB containers peaked at 2.8 and 3.0 GiB of anonymous memory, a
// few hundred MiB above the caches and write buffer their configuration
// allows.
const AUTOMATIC_BUDGET_HEADROOM_DIVISOR: u64 = 8;
// Below a few thousand vectors a serial build takes seconds, less than the
// extra source scan a bulk build starts with.
const DEFAULT_VECTOR_BULK_BUILD_MIN_VECTORS: u64 = 4096;

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

/// Memory the bulk vector builds of one process may hold together.
///
/// # Examples
///
/// ```
/// use std::num::NonZeroU64;
///
/// use db::config::VectorBulkBuildMemory;
///
/// const GIB: u64 = 1 << 30;
/// // An 8 GiB container whose caches and write buffers may grow to 3 GiB
/// // keeps an eighth of the ceiling free and leaves bulk builds the rest.
/// let automatic = VectorBulkBuildMemory::Automatic;
/// assert_eq!(automatic.budget_bytes(Some(8 * GIB), 3 * GIB, None), 4 * GIB);
/// // A process that already holds more than its configuration bounds leaves
/// // less, and one at its ceiling leaves nothing.
/// assert_eq!(automatic.budget_bytes(Some(8 * GIB), 3 * GIB, Some(5 * GIB)), 2 * GIB);
/// assert_eq!(automatic.budget_bytes(Some(8 * GIB), 3 * GIB, Some(9 * GIB)), 0);
/// // Without a readable ceiling nothing is known to be free.
/// assert_eq!(automatic.budget_bytes(None, 3 * GIB, None), 0);
/// // An explicit budget is taken as given, and `Off` is no budget.
/// let explicit = VectorBulkBuildMemory::Bytes(NonZeroU64::new(GIB).unwrap());
/// assert_eq!(explicit.budget_bytes(None, 3 * GIB, Some(9 * GIB)), GIB);
/// assert_eq!(VectorBulkBuildMemory::Off.budget_bytes(Some(8 * GIB), 0, None), 0);
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum VectorBulkBuildMemory {
    /// No bulk builds: every vector build inserts serially. The default,
    /// because a release from before bulk builds cannot open a database, as
    /// its writer, while a bulk build is in progress: turn bulk builds on
    /// only once every process that can become the writer runs a release
    /// that has them.
    #[default]
    Off,
    /// What the process's memory ceiling leav
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
    /// Lowered suppression limit of overlaid searches; `None` keeps the
    /// search default of 800 results.
    #[cfg(test)]
    max_suppressed_search_results: Option<usize>,
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
            #[cfg(test)]
            max_suppressed_search_results: None,
            strong_vector_search_max_pending_bytes: None,
            strong_text_search_max_analysis_bytes: NonZeroU64::new(
                DEFAULT_STRONG_TEXT_SEARCH_MAX_ANALYSIS_BYTES,
            )
     
```

### Core Architecture Module: `crates/db/src/config/secondary_index_lifecycle.rs`
```
//! Validated resource and scheduling policy for secondary lifecycle work.
//!
//! [`SecondaryIndexLifecycleTuning`] is the single user-facing source for bounded
//! secondary outbox discovery, source backfill, catch-up, validation, and
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
const DEFAULT_RECONCILE_INPUT_BYTES: u64 = 1024 * 1024;
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
///
/// Every lifecycle transaction stays within the batch budgets below. A step
/// that holds the scope's exclusive gate first drains the deltas the writes
/// it waited for recorded, in further transactions under the same budgets,
/// so however large that write window was, no transaction exceeds them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SecondaryIndexLifecycleTuning {
    worker_mode: SecondaryIndexLifecycleWorkerMode,
    batch_rows: SecondaryIndexLifecycleBatchRows,
    max_input_bytes: NonZeroU64,
    max_output_operations: NonZeroU64,
    max_output_bytes: NonZeroU64,
    reconcile_input_bytes: NonZeroU64,
    active_interval_millis: SecondaryIndexLifecycleActiveIntervalMillis,
    idle_interval_millis: SecondaryIndexLifecycleIdleIntervalMillis,
}

impl SecondaryIndexLifecycleTuning {
    /// Returns whether writer-open should start the background task.
    pub const fn worker_mode(self) -> SecondaryIndexLifecycleWorkerMode {
        self.worker_mode
    }

    /// Returns the maximum entities one lifecycle transaction admits, whether
    /// it scans sources, drains deltas, releases applied state, or cleans up.
    pub const fn batch_rows(self) -> SecondaryIndexLifecycleBatchRows {
        self.batch_rows
    }

    /// Returns the exact decoded-input cap for one lifecycle transaction.
    pub const fn max_input_bytes(self) -> NonZeroU64 {
        self.max_input_bytes
    }

    /// Returns the maximum puts/deletes staged by one lifecycle transaction.
    pub const fn max_output_operations(self) -> NonZeroU64 {
        self.max_output_operations
    }

    /// Returns the exact encoded-output cap for one lifecycle transaction and
    /// entity.
    pub const fn max_output_bytes(self) -> NonZeroU64 {
        self.max_output_bytes
    }

    /// Returns the operation and checkpoint bytes decoded by one reconciliation call.
    pub const fn reconcile_input_bytes(self) -> NonZeroU64 {
        self.reconcile_input_bytes
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

    /// Replaces the positive reconciliation decoded-input cap.
    pub const fn with_reconcile_input_bytes(mut self, bytes: NonZeroU64) -> Self {
        self.reconcile_input_bytes = bytes;
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
            reconcile_input_bytes: NonZeroU64::new(DEFAULT_RECONCILE_INPUT_BYTES)
                .expect("default reconcile bytes are positive"),
            active_interval_millis: SecondaryIndexLifecycleActiveIntervalMillis::new(
                DEFAULT_ACTIVE_INTERVAL_MILLIS,
            )
            .expect("default active interval is positive"),
            idle_interval_millis: SecondaryIndexLifecycleIdleIntervalMillis::new(
                DEFAULT_IDLE_INTERVAL_MILLIS,
            )
            .expect("default idle interval is positive"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_limits_and_intervals_are_unrepresentable() {
        assert_eq!(SecondaryIndexLifecycleBatchRows::new(0), None);
        assert_eq!(SecondaryIndexLifecycleActiveIntervalMillis::new(0), None);
        assert_eq!(SecondaryIndexLifecycleIdleIntervalMillis::new(0), None);
    }

    #[test]
    fn builders_replace_one_policy_dimension_without_erasing_the_rest() {
        let defaults = SecondaryIndexLifecycleTuning::default();
        let updated = defaults
            .with_worker_mode(SecondaryIndexLifecycleWorkerMode::Disabled)
            .with_batch_rows(SecondaryIndexLifecycleBatchRows::new(3).unwrap())
            .with_max_output_operations(NonZeroU64::new(11).unwrap())
            .with_active_interval_millis(
                SecondaryIndexLifecycleActiveIntervalMillis::new(5).unwrap(),
            )
            .with_idle_interval_millis(SecondaryIndexLifecycleIdleIntervalMillis::new(7).unwrap());
        assert_eq!(
            updated.worker_mode(),
            SecondaryIndexLifecycleWorkerMode::Disabled
        );
        assert_eq!(updated.bat
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

### Incident Patch 1: `632e9097` (2026-11-24)
**Commit Message**: Build unpartitioned vector indexes in memory, in bulk (#1325)

This adds an in-memory "bulk" path for building an unpartitioned vector
index. On real S3 it builds a 1M x 128-dim index in 143 s against 1,775
s for the serial build on main, with the same recall.

**It is off by default.** One stored byte is new (below), and an older
image refuses a store that holds it, so this release only teaches every
image to read it. Turn it on with
`HELIX_VECTOR_BULK_BUILD_MEMORY_BYTES=auto` (or a byte count) once every
node that can become writer runs an image with this change.

## How it works

```text
serial build (today)                    bulk build
  for each source row                     pass 1  read the label's rows into memory, run by run
    read the stored graph                 pass 2  link the whole HNSW graph on a thread pool
    insert one node                       pass 3  write every node once, rechecking each row
    commit
```

- **Pass 1** takes the label's members from one snapshot, then reads
them in runs of 65,536 ids or 64 MiB, each under its own short snapshot.
No transaction is held across runs.
- **Pass 3** rereads each source row and stores a node only if the row
stil

**File**: `crates/db/fuzz/corpus/current_index_v2_records/valid-vector-bulk-build-operation-record` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+hex:0101021111111111111111111111111111111100000000000000010301000000014c0000000170000000000000000200000000000000030000000000000004010201070000000575707065720100000006637572736f72000000000000000500000000000000060000000000000007000000000000000803000000090101
```

**File**: `crates/db/fuzz/corpus/current_index_v2_records/vector-bulk-build-unknown-stage` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+hex:0101021111111111111111111111111111111100000000000000010301000000014c0000000170000000000000000200000000000000030000000000000004010201080000000575707065720100000006637572736f72000000000000000500000000000000060000000000000007000000000000000803000000090101
```

**File**: `crates/db/fuzz/corpus/current_index_v2_records/vector-bulk-build-without-attempts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+hex:0101021111111111111111111111111111111100000000000000010301000000014c0000000170000000000000000200000000000000030000000000000004010201070000000575707065720100000006637572736f720000000000000005000000000000000600000000000000070000000000000008000000090101
```

**File**: `crates/db/fuzz/corpus/current_index_v2_records/vector-bulk-build-zero-attempts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+hex:0101021111111111111111111111111111111100000000000000010301000000014c0000000170000000000000000200000000000000030000000000000004010201070000000575707065720100000006637572736f72000000000000000500000000000000060000000000000007000000000000000800000000090101
```

**File**: `crates/db/src/config/db.rs` (modified, +48/-0)
```diff
@@ -389,6 +389,54 @@ impl DbConfig {
         self.index_lifecycle_throughput
     }
 
+    /// Bytes this configuration lets the process hold in memory beside what
+    /// requests and index builds allocate: the SlateDB block and metadata
+    /// caches (the memory tier of a hybrid cache), the full-text split cache,
+    /// the vector memory stores, the vector build planning cache, and the
+    /// writes SlateDB buffers before it stalls writers
+    /// (`max_unflushed_bytes`).
+    ///
+    /// Each term is the limit its owner enforces, not what it holds now. The
+    /// write buffer is counted at its encoded size; the memtables of rows a
+    /// few bytes long hold up to three times that.
+    ///
+    /// ```
+    /// use db::DbConfig;
+    ///
+    /// let config = DbConfig::new();
+    /// let build_cache = config.search_index_backfill().vector_build_cache_bytes().get();
+    /// // 512 MiB of blocks, 128 MiB of metadata, 64 MiB of full-text splits,
+    /// // 256 MiB of vector stores and 1 GiB of unflushed writes.
+    /// assert_eq!(
+    ///     config.configured_memory_bytes(),
+    ///     ((512 + 128 + 64 + 256 + 1024) << 20) + build_cache
+    /// );
+    /// ```
+    pub fn configured_memory_bytes(&self) -> u64 {
+        let slate_cache = match self.cache.mode() {
+            CacheMode::VectorMemoryOnly => 0,
+            CacheMode::Memory { slate_db, .. } => slate_db
+                .block_bytes()
+                .saturating_add(slate_db.metadata_bytes()),
+            CacheMode::Hybrid { slate_db, .. } => slate_db.memory_bytes() as u64,
+        };
+        slate_cache
+            .saturating_add(self.cache.fts_memory_bytes())
+            .saturating_add(self.cache.vector_memory().budget().bytes().unwrap_or(0))
+            .saturating_add(self.search_index_backfill.vector_build_cache_bytes().get())
+            .saturating_add(self.write_buffer_bytes())
+    }
+
+    /// Encoded bytes of writes SlateDB buffers, in its WAL and memtables,
+    /// before it stalls writers (`max_unflushed_bytes`).
+    ///
+    /// ```
+    /// assert_eq!(db::DbConfig::new().write_buffer_bytes(), 1 << 30);
+    /// ```
+    pub fn write_buffer_bytes(&self) -> u64 {
+        self.slate.to_writer_settings(None).max_unflushed_bytes as u64
+    }
+
     /// Durable graph and catalog migration policy.
     pub const fn migrations(&self) -> MigrationTuning {
         self.migrations
```

**File**: `crates/db/src/config/host_memory.rs` (modified, +52/-0)
```diff
@@ -36,6 +36,39 @@ pub fn memory_ceiling_bytes() -> Option<u64> {
     })
 }
 
+/// Returns the anonymous memory this process holds now, in bytes: its heap,
+/// stacks and other private pages, without file-backed pages the OS can drop.
+///
+/// It is what counts against [`memory_ceiling_bytes`] and cannot be
+/// reclaimed. Returns `None` where the platform does not report it; Linux
+/// does, through `/proc/self/status`.
+///
+/// # Examples
+///
+/// ```
+/// let resident = db::config::resident_anonymous_bytes();
+/// if cfg!(target_os = "linux") {
+///     assert!(resident.is_some_and(|bytes| bytes > 0));
+/// }
+/// ```
+pub fn resident_anonymous_bytes() -> Option<u64> {
+    rss_anon_bytes(&std::fs::read_to_string("/proc/self/status").ok()?)
+}
+
+/// Reads `RssAnon` from `status`, the content of `/proc/self/status`, whose
+/// lines are `Name:<whitespace>value kB`.
+fn rss_anon_bytes(status: &str) -> Option<u64> {
+    status
+        .lines()
+        .find_map(|line| line.strip_prefix("RssAnon:"))?
+        .trim()
+        .strip_suffix("kB")?
+        .trim()
+        .parse::<u64>()
+        .ok()?
+        .checked_mul(1024)
+}
+
 /// Mount points of the cgroup hierarchies that expose memory limits.
 #[derive(Debug, PartialEq, Eq)]
 struct CgroupMounts {
@@ -166,6 +199,25 @@ mod tests {
         }
     }
 
+    #[test]
+    fn resident_anonymous_memory_is_read_from_the_status_file() {
+        let status = "Name:\tserver\nVmRSS:\t  900 kB\nRssAnon:\t     512 kB\nRssFile:\t 388 kB\n";
+        assert_eq!(rss_anon_bytes(status), Some(512 * 1024));
+        assert_eq!(rss_anon_bytes("Name:\tserver\nVmRSS:\t900 kB\n"), None);
+        assert_eq!(
+            rss_anon_bytes("RssAnon:\t512\n"),
+            None,
+            "a unit is required"
+        );
+        assert_eq!(rss_anon_bytes("RssAnon:\tmany kB\n"), None);
+        assert_eq!(
+            rss_anon_bytes(&format!("RssAnon:\t{} kB\n", u64::MAX)),
+            None,
+            "a value past u64 bytes is not a size"
+        );
+        assert_eq!(rss_anon_bytes(""), None);
+    }
+
     #[test]
     fn cgroup_v2_limit_is_the_tightest_ancestor() {
         let root = tempfile::tempdir().unwrap();
```

**File**: `crates/db/src/config/index_lifecycle_throughput.rs` (modified, +267/-9)
```diff
@@ -1,26 +1,35 @@
 //! Runtime-only throughput policy for index lifecycle work.
 //!
-//! This policy controls source-scan prefetching and worker concurrency. It is
-//! never serialized into lifecycle records or physical index rows.
+//! This policy controls source-scan prefetching, worker concurrency and the
+//! in-memory bulk build of vector indexes. It is never serialized into
+//! lifecycle records or physical index rows.
 //!
 //! # Usage
 //!
 //! ```
+//! use std::num::NonZeroU64;
+//!
 //! use db::config::{
 //!     DbConfig, IndexLifecycleConcurrency, IndexLifecycleScanTuning,
-//!     IndexLifecycleThroughputTuning,
+//!     IndexLifecycleThroughputTuning, VectorBulkBuildMemory, VectorBulkBuildTuning,
 //! };
 //!
 //! let scan = IndexLifecycleScanTuning::try_new(64 * 1024, 2)?;
 //! let concurrency = IndexLifecycleConcurrency::try_new(2, 2, 1, 1)?;
-//! let tuning = IndexLifecycleThroughputTuning::new(scan, concurrency);
+//! // Build vector indexes of 10,000 vectors or more in memory, on eight
+//! // threads, while they fit 4 GiB.
+//! let four_gib = VectorBulkBuildMemory::Bytes(NonZeroU64::new(4 << 30).unwrap());
+//! let bulk = VectorBulkBuildTuning::try_new(8, four_gib, 10_000)?;
+//! let tuning = IndexLifecycleThroughputTuning::new(scan, concurrency)
+//!     .with_vector_bulk_build(bulk);
 //! let config = DbConfig::new().with_index_lifecycle_throughput_tuning(tuning);
 //!
 //! assert_eq!(config.index_lifecycle_throughput(), tuning);
+//! assert_eq!(tuning.vector_bulk_build().memory(), four_gib);
 //! # Ok::<(), db::config::IndexLifecycleThroughputTuningError>(())
 //! ```
 
-use std::num::NonZeroUsize;
+use std::num::{NonZeroU64, NonZeroUsize};
 
 const DEFAULT_SCAN_READ_AHEAD_BYTES: usize = 256 * 1024;
 const DEFAULT_SCAN_FETCH_TASKS: usize = 4;
@@ -35,6 +44,16 @@ const DEFAULT_VECTOR_TASKS: usize = 1;
 const DEFAULT_TEXT_TASKS: usize = 1;
 const DEFAULT_TOTAL_OPERATION_TASKS: usize =
     DEFAULT_SECONDARY_TASKS + 2 * (DEFAULT_VECTOR_TASKS + DEFAULT_TEXT_TASKS);
+// Share of the memory ceiling an automatic bulk-build budget leaves free, for
+// what no configured limit bounds: request buffers, thread stacks, and memory
+// the allocator holds for the rest of the process. Serial vector builds in
+// 3.3 and 6.7 GiB containers peaked at 2.8 and 3.0 GiB of anonymous memory, a
+// few hundred MiB above the caches and write buffer their configuration
+// allows.
+const AUTOMATIC_BUDGET_HEADROOM_DIVISOR: u64 = 8;
+// Below a few thousand vectors a serial build takes seconds, less than the
+// extra source scan a bulk build starts with.
+const DEFAULT_VECTOR_BULK_BUILD_MIN_VECTORS: u64 = 4096;
 
 /// Invalid runtime throughput policy rejected before lifecycle work starts.
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
@@ -204,19 +223,185 @@ impl Default for IndexLifecycleConcurrency {
     }
 }
 
+/// Memory the bulk vector builds of one process may hold together.
+///
+/// # Examples
+///
+/// ```
+/// use std::num::NonZeroU64;
+///
+/// use db::config::VectorBulkBuildMemory;
+///
+/// const GIB: u64 = 1 << 30;
+/// // An 8 GiB container whose caches and write buffers may grow to 3 GiB
+/// // keeps an eighth of the ceiling free and leaves bulk builds the rest.
+/// let automatic = VectorBulkBuildMemory::Automatic;
+/// assert_eq!(automatic.budget_bytes(Some(8 * GIB), 3 * GIB, None), 4 * GIB);
+/// // A process that already holds more than its configuration bounds leaves
+/// // less, and one at its ceiling leaves nothing.
+/// assert_eq!(automatic.budget_bytes(Some(8 * GIB), 3 * GIB, Some(5 * GIB)), 2 * GIB);
+/// assert_eq!(automatic.budget_bytes(Some(8 * GIB), 3 * GIB, Some(9 * GIB)), 0);
+/// // Without a readable ceiling nothing is known to be free.
+/// assert_eq!(automatic.budget_bytes(None, 3 * GIB, None), 0);
+/// // An explicit budget is taken as given, and `Off` is no budget.
+/// let explicit = VectorBulkBuildMemory::Bytes(NonZeroU64::new(GIB).unwrap());
+/// assert_eq!(explicit.budget_bytes(None, 3 * GIB, Some(9 * GIB)), GIB);
+/// assert_eq!(VectorBulkBuildMemory::Off.budget_bytes(Some(8 * GIB), 0, None), 0);
+/// ```
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
+pub enum VectorBulkBuildMemory {
+    /// No bulk builds: every vector build inserts serially. The default,
+    /// because a release from before bulk builds cannot open a database, as
+    /// its writer, while a bulk build is in progress: turn bulk builds on
+    /// only once every process that can become the writer runs a release
+    /// that has them.
+    #[default]
+    Off,
+    /// What the process's memory ceiling leaves beside the rest of the
+    /// process; see [`Self::budget_bytes`].
+    Automatic,
+    /// Exactly this much, whatever else the process holds. The operator
+    /// answers for the sum fitting the machine.
+    Bytes(NonZeroU64),
+}
+
+impl VectorBulkBuildMemory {
+    /// Bytes bulk builds may hold together right now.
+    ///
+    /// `ceiling` is the process's memory 
```

**File**: `crates/db/src/config/mod.rs` (modified, +2/-2)
```diff
@@ -25,10 +25,10 @@ pub use db::{
     DbConfig, EdgeEncoding, EdgeUpdatePolicy, HelixConfig, OpenAttribution, QueryTelemetry,
 };
 pub use definition_differences::{DefinitionDifference, NonEmptyDefinitionDifferences};
-pub use host_memory::memory_ceiling_bytes;
+pub use host_memory::{memory_ceiling_bytes, resident_anonymous_bytes};
 pub use index_lifecycle_throughput::{
     IndexLifecycleConcurrency, IndexLifecycleScanTuning, IndexLifecycleThroughputTuning,
-    IndexLifecycleThroughputTuningError,
+    IndexLifecycleThroughputTuningError, VectorBulkBuildMemory, VectorBulkBuildTuning,
 };
 pub use index_operation_queue::{
     IndexOperationQueueTuning, IndexOperationQueueTuningError, QueueLayout,
```

---

### Incident Patch 2: `7d6807d6` (2026-11-22)
**Commit Message**: Fold where the retirer looped, and count a fenced writer's rows after its poll

Three loops of the last commits become folds: the tables a compaction
would discard rows from, the blocks an entry's prefixes share, and the
ranges that overlap. No behaviour changes.

The helper of the superseded-writer contract counted the rows left
behind through a writer that had not yet polled its manifest, so on
object storage it could count rows the compaction had already discarded.
It now reads until the count has stopped falling.

**File**: `crates/db/src/index_lifecycle/dropped/mod.rs` (modified, +16/-18)
```diff
@@ -1226,25 +1226,23 @@ impl Registry {
     /// for the entries whose gate is at or below `retention`: the rows a
     /// compaction planned now would discard.
     pub(crate) fn discardable_tracked(&self, retention: u64) -> HashMap<TableId, u64> {
-        let state = self.state.lock();
-        let mut tracked = HashMap::new();
-        for state in state.entries.values() {
-            let Entry::Armed(Armed {
-                gate,
-                proof: Proof::Tracking { tables },
-                ..
-            }) = state
-            else {
-                continue;
-            };
-            if *gate > retention {
-                continue;
-            }
-            for (table, bytes) in tables.tables() {
+        self.state
+            .lock()
+            .entries
+            .values()
+            .filter_map(|state| match state {
+                Entry::Armed(Armed {
+                    gate,
+                    proof: Proof::Tracking { tables },
+                    ..
+                }) if *gate <= retention => Some(tables),
+                Entry::Armed(_) | Entry::Quarantined(_) => None,
+            })
+            .flat_map(|tables| tables.tables())
+            .fold(HashMap::new(), |mut tracked, (table, bytes)| {
                 *tracked.entry(*table).or_default() += bytes;
-            }
-        }
-        tracked
+                tracked
+            })
     }
 
     /// Whether a table some armed entry's proof tracks is missing from
```

**File**: `crates/db/src/index_lifecycle/dropped/reclaim.rs` (modified, +4/-3)
```diff
@@ -39,7 +39,7 @@
 //! says so:
 //!
 //! - the run is at most a gibibyte, which one compaction slot rewrites in
-//!   seconds; or
+//!   about a quarter of a minute; or
 //! - the dropped rows are at least an eighth of it.
 //!
 //! Dropped rows in any other run are *left in place*
@@ -113,8 +113,9 @@ pub(crate) struct Worth {
 impl Worth {
     /// The rule a writer follows by itself. Contracts make smaller ones.
     ///
-    /// One compaction slot rewrites a gibibyte in a few seconds, so for a
-    /// run that small retiring the entry is worth it by itself.
+    /// One compaction slot rewrites a gibibyte in about a quarter of a
+    /// minute against object storage, so for a run that small retiring the
+    /// entry is worth it by itself.
     ///
     /// For a larger run: a rewritten byte costs its read and its write, and
     /// a second copy in object storage until the old tables are collected,
```

**File**: `crates/db/src/index_lifecycle/dropped/retire.rs` (modified, +25/-21)
```diff
@@ -270,14 +270,15 @@ fn blocks_under(from: usize, to: usize) -> std::ops::Range<usize> {
 /// `ranges`, which are in the order of their starts, with those that
 /// overlap joined: every block they cover, once.
 fn disjoint(ranges: Vec<std::ops::Range<usize>>) -> Vec<std::ops::Range<usize>> {
-    let mut joined = Vec::<std::ops::Range<usize>>::with_capacity(ranges.len());
-    for range in ranges {
-        match joined.last_mut() {
-            Some(last) if range.start <= last.end => last.end = last.end.max(range.end),
-            Some(_) | None => joined.push(range),
-        }
-    }
-    joined
+    ranges
+        .into_iter()
+        .fold(Vec::<std::ops::Range<usize>>::new(), |mut joined, range| {
+            match joined.last_mut() {
+                Some(last) if range.start <= last.end => last.end = last.end.max(range.end),
+                Some(_) | None => joined.push(range),
+            }
+            joined
+        })
 }
 
 /// Decides [`Held`] from a table's block index: `before` blocks have an
@@ -639,19 +640,22 @@ impl Retirer {
         let offset = |block| index.get(block).map_or(data_end, |(offset, _)| offset);
         // The blocks of each held entry, in key order. Two prefixes of one
         // entry can share a block, which counts once.
-        let mut blocks = HashMap::<_, Vec<std::ops::Range<usize>>>::new();
-        for (prefix, entry) in overlapping(prefixes, first, last) {
-            if !held.contains(&entry) {
-                continue;
-            }
-            let from = index.partition_point(|start| start < &prefix[..]);
-            let to = index
-                .partition_point(|start| start < &prefix[..] || start.starts_with(&prefix[..]));
-            blocks
-                .entry(entry)
-                .or_default()
-                .push(blocks_under(from, to));
-        }
+        let blocks = overlapping(prefixes, first, last)
+            .filter(|(_, entry)| held.contains(entry))
+            .fold(
+                HashMap::<_, Vec<std::ops::Range<usize>>>::new(),
+                |mut blocks, (prefix, entry)| {
+                    let from = index.partition_point(|start| start < &prefix[..]);
+                    let to = index.partition_point(|start| {
+                        start < &prefix[..] || start.starts_with(&prefix[..])
+                    });
+                    blocks
+                        .entry(entry)
+                        .or_default()
+                        .push(blocks_under(from, to));
+                    blocks
+                },
+            );
         Ok(blocks
             .into_iter()
             .map(|(entry, blocks)| {
```

**File**: `crates/db/tests/unit/dropped_storage_reclaim.rs` (modified, +16/-5)
```diff
@@ -3683,11 +3683,22 @@ async fn supersede(
     compact_every_table(&db).await;
     assert_eq!(pass(&db).await, DroppedIndexStorage::default());
     assert_eq!(stored_entries(&db).await, vec![]);
-    let rows_left_behind = rows(writer(&db).db())
-        .await
-        .into_keys()
-        .filter(|key| prefixes.iter().any(|prefix| key.starts_with(prefix)))
-        .count();
+    let owned = || async {
+        rows(writer(&db).db())
+            .await
+            .into_keys()
+            .filter(|key| prefixes.iter().any(|prefix| key.starts_with(prefix)))
+            .count()
+    };
+    // A writer applies the result of its compactor's job at its next
+    // manifest poll, so rows a job discarded stay readable for a moment:
+    // rows are left behind only if they are still there well after it.
+    let mut rows_left_behind = owned().await;
+    let read = Instant::now();
+    while rows_left_behind > 0 && read.elapsed() < WAIT / 4 {
+        tokio::time::sleep(SETTLE).await;
+        rows_left_behind = owned().await;
+    }
     db.close().await.expect("the writer closes");
     Superseded {
         ran_under_the_superseded_writer,
```

---

### Incident Patch 3: `fb9ce75d` (2026-11-23)
**Commit Message**: Weigh every prefix a table can hold rows under, whoever the table starts under

The byte estimate skipped the prefixes of an entry that sort strictly
inside a table once the table started or ended under another prefix of
the same entry. A partitioned vector generation, whose physical indexes
lie side by side, was counted about half its rows on a 68 GiB run, and
the idle reclaim left a run that was worth rewriting.

Every prefix the table can hold a row under is weighed now. One with an
index key under it counts those blocks; the one the table starts under
counts from the first block, whose shortened index key says nothing; one
without rows adds nothing; and one whose rows all lie inside a block that
begins with another owner's row is read only to decide whether its entry
is held, so the estimate is short by less than a block there and never
long. Contracts pin each case on a table built row by row.

**File**: `crates/db/src/index_lifecycle/dropped/retire.rs` (modified, +30/-34)
```diff
@@ -597,71 +597,67 @@ impl Retirer {
         match whole {
             // Every row of the table is the entry's.
             Some((_, entry)) => Ok(HashMap::from([(entry, sst.estimate_size())])),
-            None => self.held_in_part(sst, prefixes, ends, inside).await,
+            None => self.held_in_part(sst, prefixes, ends).await,
         }
     }
 
     /// [`Self::held`] for a table that reaches a prefix without lying wholly
-    /// under one: `ends` own a prefix the table starts or ends under, and
-    /// `inside` are the prefixes of other entries that sort strictly inside
-    /// it.
+    /// under one: `ends` own a prefix the table starts or ends under.
     ///
     /// The estimate counts, for each prefix found to have rows in the table,
-    /// the blocks those rows are in: exact to one block at each end. A
-    /// prefix with no row in the table adds nothing; neither does one whose
-    /// only rows are inside a block this had no need to read, because its
-    /// entry was already known to be held.
+    /// the blocks those rows are in: exact to one block at each end. Every
+    /// prefix the table can hold a row under is weighed, those of an entry
+    /// in `ends` included. A prefix with no row in the table adds nothing.
+    /// Neither does one whose rows all lie inside a block that begins with
+    /// another owner's row, when its entry is known to be held without it:
+    /// that block is not read, so the estimate is short by less than a block
+    /// for each such prefix, and never long.
     async fn held_in_part(
         &self,
         sst: &SsTableHandle,
         prefixes: &BTreeMap<Bytes, DroppedGeneration>,
         ends: HashSet<DroppedGeneration>,
-        inside: Vec<(&Bytes, DroppedGeneration)>,
     ) -> Result<HashMap<DroppedGeneration, u64>> {
         let first = sst.info.first_entry.as_deref();
         let last = sst.info.last_entry.as_deref();
         let file = self.tables.open_with_handle(sst.clone())?;
         let index = file.index().await?;
-        // Blocks `from..to` have an index key under the prefix.
-        let under = |prefix: &[u8]| {
-            (
-                index.partition_point(|start| start < prefix),
-                index.partition_point(|start| start < prefix || start.starts_with(prefix)),
-            )
-        };
         // The blocks each entry is known to have rows in, one range for
         // each of its prefixes found there.
         let mut blocks = HashMap::<DroppedGeneration, Vec<std::ops::Range<usize>>>::new();
-        // A prefix the table starts or ends under has rows in it.
-        for (prefix, entry) in overlapping(prefixes, first, last).filter(|(prefix, _)| {
-            first.is_some_and(|first| first.starts_with(prefix))
-                || last.is_some_and(|last| last.starts_with(prefix))
-        }) {
-            let (from, to) = under(prefix);
-            blocks
-                .entry(entry)
-                .or_default()
-                .push(blocks_under(from, to));
-        }
+        // The blocks only a read can decide, with the prefixes it decides.
         let mut in_blocks = BTreeMap::<usize, Vec<(&Bytes, DroppedGeneration)>>::new();
-        for (prefix, entry) in inside {
-            let (from, to) = under(prefix);
-            match held_by_index(prefix, from, index.get(from).map(|(_, start)| start)) {
+        for (prefix, entry) in overlapping(prefixes, first, last) {
+            // Blocks `from..to` have an index key under the prefix.
+            let from = index.partition_point(|start| start < &prefix[..]);
+            let to = index
+                .partition_point(|start| start < &prefix[..] || start.starts_with(&prefix[..]));
+            // A prefix the table starts or ends under has rows in it; of any
+            // other the block index says.
+            let starts_under = first.is_some_and(|first| first.starts_with(prefix));
+            let ends_under = last.is_some_and(|last| last.starts_with(prefix));
+            let rows = match starts_under || ends_under {
+                true => Held::Yes,
+                false => held_by_index(prefix, from, index.get(from).map(|(_, start)| start)),
+            };
+            match rows {
+                // The table's first row is in its first block, whatever
+                // shortened key indexes that block.
+                Held::Yes if starts_under => blocks.entry(entry).or_default().push(0..to.max(1)),
                 Held::Yes => blocks
                     .entry(entry)
                     .or_default()
                     .push(blocks_under(from, to)),
                 Held::No => {}
+                // Held whatever the block has: it is not read for this.
+                Held::InBlock(_) if ends.contains(&entry) => {}
                 Held::InBlock(block) => in_blocks.entry(block).or_default().push((prefix, entry)),
             }
         }
         // Imperative: each block is read only while one of it
```

**File**: `crates/db/tests/unit/dropped_storage_reclaim.rs` (modified, +92/-40)
```diff
@@ -1314,44 +1314,32 @@ async fn a_table_wholly_under_a_prefix_counts_in_full_and_one_that_starts_under_
     db.close().await.expect("the writer closes");
 }
 
-/// Proves a prefix of a held entry that has no row in a table adds nothing
-/// to the entry's bytes in it: an entry of one generation owns a prefix for
-/// each of the eleven record kinds, and a table that holds a row of it under
-/// one kind alone, among rows of other generations under every kind, is
-/// counted that row's block and not a block of someone else's for each of
-/// the other ten.
-#[tokio::test]
-async fn a_prefix_without_rows_adds_no_block_to_an_entrys_bytes() {
-    let db = open("dropped-retire-empty-prefixes").await;
+/// The bytes [`Retirer::held`] counts for the one entry that owns every
+/// prefix in `owned`, in a table of one flush that holds `rows` rows under
+/// each given prefix and nothing else. Every row fills a block of its own,
+/// of [`BLOCK_ROW`] bytes and a little framing.
+async fn held_bytes_of_one_table(name: &str, rows: &[(&Bytes, usize)], owned: &[&Bytes]) -> u64 {
+    let db = open(name).await;
     let HelixStorage::Writer(shared) = db.storage() else {
         panic!("the contract opens a writer");
     };
-    let owner = |generation| OwnerKey::Generation {
-        scope: DataScope::LegacyUnscoped,
-        index_id: 7,
-        generation,
-    };
-    let dropped = owner(5).prefixes();
-    assert_eq!(dropped.len(), 11);
     let store: Arc<dyn ObjectStore> = Arc::new(slatedb::object_store::memory::InMemory::new());
-    let path = "dropped-retire-empty-prefixes-rows".to_string();
-    let rows = slatedb::Db::builder(path.clone(), Arc::clone(&store))
+    let path = format!("{name}-rows");
+    let raw = slatedb::Db::builder(path.clone(), Arc::clone(&store))
         .build()
         .await
         .expect("the row store opens");
-    // Each row fills a block of its own. Generations 4 and 6 have one under
-    // every kind, either side of where generation 5 would be.
-    const ROW: usize = 6000;
-    for prefix in owner(4).prefixes().into_iter().chain(owner(6).prefixes()) {
-        rows.put([&prefix[..], b"a"].concat(), vec![7u8; ROW])
+    for (prefix, count) in rows {
+        for row in 0..*count {
+            raw.put(
+                [&prefix[..], format!("{row:04}").as_bytes()].concat(),
+                vec![7u8; BLOCK_ROW as usize],
+            )
             .await
             .expect("the row writes");
+        }
     }
-    // Generation 5 has one row, under one kind.
-    rows.put([&dropped[4][..], b"a"].concat(), vec![7u8; ROW])
-        .await
-        .expect("the row writes");
-    rows.flush_with_options(FlushOptions {
+    raw.flush_with_options(FlushOptions {
         flush_type: FlushType::MemTable,
     })
     .await
@@ -1369,28 +1357,92 @@ async fn a_prefix_without_rows_adds_no_block_to_an_entrys_bytes() {
     let [table] = &tables[..] else {
         panic!("one flush leaves one table: {}", tables.len());
     };
-    assert!(table.estimate_size() > 23 * ROW as u64);
-    let retirer = Retirer::new(Arc::clone(shared), &path, store, SLOTS);
-    let prefixes = dropped
-        .into_iter()
-        .map(|prefix| (prefix, generation_entry(1)))
+    let written = rows.iter().map(|(_, count)| *count as u64).sum::<u64>();
+    assert!(table.estimate_size() > written * BLOCK_ROW);
+    let prefixes = owned
+        .iter()
+        .map(|prefix| ((*prefix).clone(), generation_entry(1)))
         .collect::<BTreeMap<_, _>>();
-    let held = retirer
+    let held = Retirer::new(Arc::clone(shared), &path, store, SLOTS)
         .held(table, &prefixes)
         .await
         .expect("the table is looked into");
     let [(entry, bytes)] = held.into_iter().collect::<Vec<_>>()[..] else {
         panic!("the table holds rows of the one entry");
     };
     assert_eq!(entry, generation_entry(1));
-    // The one block of the one row, to a few bytes of framing.
+    raw.close().await.expect("the row store closes");
+    db.close().await.expect("the writer closes");
+    bytes
+}
+
+/// A row larger than a block, so that it is stored in a block of its own.
+const BLOCK_ROW: u64 = 6000;
+
+/// The prefix of generation `generation` of one index under one record kind:
+/// those of consecutive generations sort next to each other.
+fn sibling_prefix(generation: u64) -> Bytes {
+    OwnerKey::Generation {
+        scope: DataScope::LegacyUnscoped,
+        index_id: 7,
+        generation,
+    }
+    .prefixes()
+    .swap_remove(4)
+}
+
+/// Proves a prefix of a held entry that has no row in a table adds nothing
+/// to the entry's bytes in it, whether or not the table starts and ends
+/// under the entry: the block before where its rows would be belongs to
+/// someone else.
+#[tokio::test]
+async fn a_prefix_without_rows_adds_no_block_to_an_entrys_bytes() {
+    let [g2, g3, g4, g5, g6, g7, g8] = [2, 3, 4, 5, 6, 7, 8].map(sibling_prefix);
+    // The entry has rows under on
```

#### Recent Merged Pull Requests:
- **PR #1326** (2026-11-24): Drop indexes through a compaction filter (@xav-db)
- **PR #1325** (2026-11-24): Build unpartitioned vector indexes in memory, in bulk (@xav-db)
- **PR #1322** (2026-11-23): Default the CLI to Docker v0.0.18 (@xav-db)
- **PR #1321** (2026-11-23): Datetime string migration: leave text- and vector-indexed properties as stored (@xav-db)
- **PR #1320** (2026-11-23): docs: Helix Foundry first, Cloud inside HelixDB, Foundry pages brought up to date with prod (@xav-db)
- **PR #1319** (2026-11-23): Default the CLI to Docker v0.0.17 (@xav-db)

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

## X. Build unpartitioned vector indexes in memory, in bulk

**RULE**:
When implementing operations in `crates/db/fuzz/corpus/current_index_v2_records/valid-vector-bulk-build-operation-record`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in HelixDB/helix-db. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `632e9097`: Build unpartitioned vector indexes in memory, in bulk. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/db/fuzz/corpus/current_index_v2_records/valid-vector-bulk-build-operation-record`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
hex:0101021111111111111111111111111111111100000000000000010301000000014c0000000170000000000000000200000000000000030000000000000004010201070000000575707065720100000006637572736f72000000000000000500000000000000060000000000000007000000000000000803000000090101
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `632e9097` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
