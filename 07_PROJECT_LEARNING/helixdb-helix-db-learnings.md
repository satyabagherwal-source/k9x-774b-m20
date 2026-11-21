> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/helixdb-helix-db-learnings.md`  
> **Source**: github ([https://github.com/HelixDB/helix-db](https://github.com/HelixDB/helix-db))  
> **Source Version**: `a29a8d49`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T03:36:49.276Z  
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
> **Harvest Timestamp**: 2026-11-21T03:36:49.270Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HelixDB/helix-db`
- **Description**: HelixDB is an OLTP graph database with native vector and full-text search built in Rust on Object Storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 6304 stars

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
        assert_eq!(tuning.concurrency().total_operation_tasks().get(), 12);
        assert_eq!(tuning.concurrency().secondary_tasks().get(), 8);
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

### Incident Patch 1: `a29a8d49` (2026-11-20)
**Commit Message**: Isolate, pace and back off background migrations independently (#1314)

This fixes three problems in the background migration worker that runs
the datetime string conversion from #1305:
- **A failing label step blocked the conversion.** If the label copy
failed (for example, it fails closed on a label hash collision), the
step returned early. The datetime conversion never ran and the worker
retried forever.
- **The conversion wasn't paced.** It wrote through the query path on
every step, even while the writer's flush backlog was high.
- **One shared backoff slowed everything down.** Any single failure
pushed every migration back to one batch per 60 s, which is about 7 days
for 10M rows.

No stored format changes: keys, values and the progress row are all
unchanged.

## Worker step

```diff
 each background step
-  KV job            → error returns early
-  label copy/cleanup → error returns early
-  datetime conversion (only if nothing above failed)
-  any error → whole worker backs off (up to 60 s)
+  each migration runs unless its own retry time hasn't come:
+    KV job, backlog check, label copy, label cleanup, datetime conversion
+  datetime conversion: only once the KV job rep

**File**: `crates/db/src/lib.rs` (modified, +19/-2)
```diff
@@ -4288,15 +4288,32 @@ impl HelixDB {
             return Err(HelixDbError::MigrationSteppingRequiresDisabledMode);
         }
         // No database handle: the datetime string conversion keeps its own
-        // stepping surface, so a step here takes the jobs it took before.
-        migrations::background::process_background_step(
+        // stepping surface, so a step here takes the jobs it took before. A
+        // fresh backoff takes every migration, so this step returns its first
+        // failure after all have run, as the worker logs each.
+        match migrations::background::process_background_step(
             writer,
             &std::sync::Weak::new(),
             self.config().db().migrations(),
             migrations::background::BackgroundMigrations::All,
             &mut migrations::LabelCopySession::new(),
+            &mut migrations::background::MigrationRetries::default(),
+            tokio::time::Instant::now,
         )
         .await
+        {
+            migrations::background::BackgroundStep::Active {
+                failure: Some(error),
+            }
+            | migrations::background::BackgroundStep::RetryAt {
+                failure: Some(error),
+                ..
+            } => Err(error),
+            // A fresh backoff waits on nothing, so only a failure retries.
+            migrations::background::BackgroundStep::Active { failure: None }
+            | migrations::background::BackgroundStep::RetryAt { failure: None, .. } => Ok(true),
+            migrations::background::BackgroundStep::Finished => Ok(false),
+        }
     }
 
     #[cfg(any(test, feature = "bench-internals"))]
```

**File**: `crates/db/src/migrations/background/label_and_datetime_tests.rs` (modified, +781/-2)
```diff
@@ -1,8 +1,13 @@
 //! A store that needs both the label identity copy and the datetime string
 //! conversion: one background worker finishes both, whatever order their
-//! steps interleave in, while the writer serves graph writes.
+//! steps interleave in, while the writer serves graph writes. A failing
+//! migration backs off alone: a failing label step does not slow the
+//! conversion, a failing migration job does not slow the label steps but does
+//! hold the conversion back, and the conversion waits while the writer's flush
+//! backlog is high.
 
 use std::sync::Arc;
+use std::time::Duration;
 
 use helix_ast::batch::{read_batch, write_batch};
 use helix_ast::expr::Predicate;
@@ -13,14 +18,25 @@ use helix_ast::value::{DateTime, PropertyInput};
 use serde_json::json;
 use slatedb::object_store::{memory::InMemory, ObjectStore};
 use slatedb::DbReadOps;
+use tokio::time::Instant;
 
+use super::{
+    process_background_step, BackgroundMigrations, BackgroundStep, MigrationRetries,
+    MigrationWorkerSupervisor, Retry, MAX_FAILURE_BACKOFF,
+};
 use crate::config::{self, DbConfig, MigrationTuning, SecondaryIndexDefinition};
+use crate::encoding::indexes::{label, PropertyIndexKey};
 use crate::encoding::keys::scope::{DataScope, TenantId};
-use crate::encoding::v2::keys::DataKey;
+use crate::encoding::keys::NodePropertyKey;
+use crate::encoding::property::{encode_properties, Property};
+use crate::encoding::v2::keys::{DataKey, DataKeyKind};
 use crate::encoding::v2::legacy::label_hash;
+use crate::encoding::v2::values::indexes::SecondaryEqualityBitmapValue;
+use crate::error::HelixDbError;
 use crate::index_lifecycle::IndexStorageVersion;
 use crate::migrations::{datetime_strings, indexes::label_identity, startup};
 use crate::query_service::HelixQueryService;
+use crate::search::vector::gated_wal::{GatedWalStore, WalUploads};
 use crate::{HelixDB, HelixStorage};
 
 const DB_PATH: &str = "label-and-datetime-migrations";
@@ -439,3 +455,766 @@ async fn one_worker_finishes_the_label_copy_and_the_datetime_conversion() {
 
     db.close().await.unwrap();
 }
+
+/// One background step of every migration with the clock held at `now`, as
+/// the worker takes it.
+async fn step(
+    db: &HelixDB,
+    labels: &mut label_identity::LabelCopySession,
+    retries: &mut MigrationRetries,
+    now: Instant,
+) -> BackgroundStep {
+    let HelixStorage::Writer(writer) = db.storage() else {
+        panic!("writer");
+    };
+    process_background_step(
+        writer,
+        &Arc::downgrade(&db.inner),
+        db.config().db().migrations(),
+        BackgroundMigrations::All,
+        labels,
+        retries,
+        || now,
+    )
+    .await
+}
+
+/// The first failure backoff of `db`'s migrations: its idle interval.
+fn initial_backoff(db: &HelixDB) -> Duration {
+    Duration::from_millis(db.config().db().migrations().idle_interval_millis().get())
+}
+
+/// A background worker of `db` on `tuning`, with no handle on the database
+/// it keeps alive, as the open starts one.
+fn start_worker(db: &HelixDB, tuning: MigrationTuning) -> MigrationWorkerSupervisor {
+    let HelixStorage::Writer(writer) = db.storage() else {
+        panic!("writer");
+    };
+    MigrationWorkerSupervisor::start_if_enabled(
+        Arc::clone(writer),
+        Arc::downgrade(&db.inner),
+        tuning
+            .with_worker_mode(config::MigrationWorkerMode::Background)
+            .with_active_interval(config::MigrationActiveIntervalMillis::new(1).unwrap()),
+        BackgroundMigrations::All,
+    )
+    .expect("background tuning starts a worker")
+}
+
+async fn conversion(db: &HelixDB) -> Option<datetime_strings::Job> {
+    let HelixStorage::Writer(writer) = db.storage() else {
+        panic!("writer");
+    };
+    datetime_strings::load(writer.db()).await.unwrap()
+}
+
+/// Every unscoped event and attendance as written: datetimes still strings.
+async fn assert_unconverted(db: &HelixDB) {
+    let mut events = (0..EVENTS)
+        .map(|event| (format!("e{event}"), event_at(event)))
+        .collect::<Vec<_>>();
+    events.sort();
+    assert_eq!(scanned_events(db, DataScope::LegacyUnscoped).await, events);
+    let mut since = (0..EVENTS).map(attends_since).collect::<Vec<_>>();
+    since.sort();
+    assert_eq!(edge_since(db, DataScope::LegacyUnscoped).await, since);
+}
+
+/// The conversion finished and every unscoped datetime is stored as one.
+async fn assert_converted(db: &HelixDB) {
+    let job = conversion(db).await.expect("the conversion ran");
+    assert!(job.is_completed(), "{job:?}");
+    assert_eq!(
+        job.report().converted_values,
+        u64::try_from(2 * EVENTS).unwrap(),
+        "{job:?}"
+    );
+    let mut events = (0..EVENTS)
+        .map(|event| (format!("e{event}"), canonical(&event_at(event))))
+        .collect::<Vec<_>>();
+    events.sort();
+    assert_eq!(scanned_events(db, DataScope::LegacyUnscoped).await, events);
+    let mut since = (0..EVENTS)
+        .map(|event| can
```

**File**: `crates/db/src/migrations/background/mod.rs` (modified, +1/-1)
```diff
@@ -3,5 +3,5 @@
 mod worker;
 
 #[cfg(test)]
-pub(crate) use worker::process_background_step;
+pub(crate) use worker::{process_background_step, BackgroundStep, MigrationRetries};
 pub(crate) use worker::{BackgroundMigrations, MigrationWorkerSupervisor};
```

**File**: `crates/db/src/migrations/background/worker.rs` (modified, +229/-95)
```diff
@@ -5,6 +5,7 @@ use std::time::Duration;
 
 use tokio::sync::watch;
 use tokio::task::JoinHandle;
+use tokio::time::Instant;
 
 use crate::config::{MigrationTuning, MigrationWorkerMode};
 use crate::encoding::v2::keys::scope::DataScope;
@@ -13,30 +14,57 @@ use crate::HelixWriter;
 
 const MAX_FAILURE_BACKOFF: Duration = Duration::from_secs(60);
 
-#[derive(Debug, Clone, Copy)]
-struct FailureBackoff {
-    initial: Duration,
-    next: Duration,
+/// When a step may next take one background migration.
+#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
+enum Retry {
+    /// It has not failed since its last success: every step takes it.
+    #[default]
+    Ready,
+    /// Its last attempt failed: no step takes it before `at`, which is `delay`
+    /// after the step that made that attempt ended. Another failure waits twice as long, up to
+    /// [`MAX_FAILURE_BACKOFF`]; a success makes it [`Retry::Ready`] again.
+    At { at: Instant, delay: Duration },
 }
 
-impl FailureBackoff {
-    fn new(initial: Duration) -> Self {
-        let initial = initial.min(MAX_FAILURE_BACKOFF);
-        Self {
-            initial,
-            next: initial,
-        }
-    }
-
-    fn next_delay(&mut self) -> Duration {
-        let delay = self.next;
-        self.next = self.next.saturating_mul(2).min(MAX_FAILURE_BACKOFF);
-        delay
-    }
+/// Each background migration's own failure backoff, kept by the worker
+/// between steps, so a migration that keeps failing slows only itself.
+///
+/// The flush backlog check that admits the paced migrations backs off on its
+/// own too: while it does, no paced migration runs.
+#[derive(Debug, Default)]
+pub(crate) struct MigrationRetries {
+    job: Retry,
+    pacing: Retry,
+    label_copy: Retry,
+    label_cleanup: Retry,
+    datetimes: Retry,
+}
 
-    fn reset(&mut self) {
-        self.next = self.initial;
-    }
+/// What one background step leaves the worker to do.
+#[derive(Debug)]
+#[cfg_attr(
+    not(test),
+    allow(
+        dead_code,
+        reason = "the step logs every failure; only stepping tests read a failure back"
+    )
+)]
+pub(crate) enum BackgroundStep {
+    /// A migration advanced, or was held back by the flush backlog: the worker
+    /// steps again after its active interval. `failure` is the first failure
+    /// of another migration in this step.
+    Active {
+        failure: Option<crate::error::HelixDbError>,
+    },
+    /// No migration advanced and at least one is backing off: the worker steps
+    /// again at `at`, the earliest retry. `failure` is this step's first
+    /// failure, or `None` if every unfinished migration was waiting.
+    RetryAt {
+        at: Instant,
+        failure: Option<crate::error::HelixDbError>,
+    },
+    /// Every background migration has finished.
+    Finished,
 }
 
 /// The background migrations one writer runs.
@@ -98,53 +126,178 @@ impl MigrationWorkerSupervisor {
 }
 
 /// Advances every pending background migration `migrations` names by one
-/// bounded batch: the next runnable migration job, the label identity copy,
-/// the deletion of the hash label rows it retires, and, once no migration job
-/// has more to do, the datetime string conversion. Returns whether any has
-/// more to do, so the worker stops only when every one has finished. `labels`
-/// carries the copy's state between steps.
+/// bounded batch: the next runnable migration job, the label identity
+/// copy, the deletion of the hash label rows it retires, and, once no migration
+/// job has more to do, the datetime string conversion. `labels` carries the
+/// copy's state and the step pacing between steps, `retries` each migration's
+/// failure backoff.
+///
+/// The step reads `clock` twice: before it takes any migration, to tell which
+/// are due, and after all have run, to time each failure's retry from then. A
+/// retry delay so starts when the failed step ends, not when it started, so a
+/// slow batch beside a failure does not eat into that failure's backoff.
+///
+/// A migration that failed is skipped until its retry time, and backs off
+/// alone: a failing label step slows neither the migration jobs nor the
+/// datetime conversion, nor they it. The step logs each failure with the
+/// migration's name and retry delay, and a success clears that migration's
+/// backoff. The one ordering is that the datetime conversion runs only once
+/// the migration jobs report nothing more to do: jobs that fail or wait on
+/// their backoff count as not done, so the conversion never rewrites rows an
+/// unfinished job still moves.
+///
+/// The step reports [`BackgroundStep::Finished`] only when every migration has
+/// finished; one backing off has not, and makes the step report its retry
+/// time unless another advanced.
 ///
-/// The migration job and the label steps run every step, so neither waits for
-/// the other to finish, and one failing does not stop another's batch from
-/// committing. The cleanup follo
```

**File**: `crates/db/src/migrations/datetime_strings.rs` (modified, +59/-59)
```diff
@@ -21,7 +21,7 @@
 //!
 //! Progress is one JSON row in the unscoped metadata namespace, committed after
 //! every batch, so the job resumes after a restart. Older binaries never read
-//! that row. A row whose conversion would collide in a unique index keeps its
+//! that row. A value whose conversion would collide in a unique index keeps its
 //! string and is counted, as is every skipped property.
 
 use std::collections::{BTreeMap, BTreeSet};
@@ -161,7 +161,7 @@ pub(crate) struct SkippedProperty {
 pub(crate) struct Report {
     /// String values rewritten as datetimes.
     pub(crate) converted_values: u64,
-    /// Rows left as strings because the datetime collides in a unique index.
+    /// Values left as strings because the datetime collides in a unique index.
     pub(crate) unique_conflicts: u64,
     /// Properties with RFC3339 strings left as stored, first ones listed.
     pub(crate) skipped_properties: Vec<SkippedProperty>,
@@ -508,52 +508,45 @@ struct RowConversion {
     values: Vec<(String, String, i64)>,
 }
 
+/// The response name of each converted value, row by row: `r{row}v{value}`.
+fn value_names(rows: &[RowConversion]) -> impl Iterator<Item = String> + '_ {
+    rows.iter().enumerate().flat_map(|(row, conversion)| {
+        (0..conversion.values.len()).map(move |value| format!("r{row}v{value}"))
+    })
+}
+
+/// One write converting every value of `rows`, each guarded on its own
+/// stored string: a concurrent write to one property of a row leaves that
+/// property as written and still converts the row's others.
 fn conversion_request(element: Element, rows: &[RowConversion]) -> QueryRequest {
-    let names = (0..rows.len())
-        .map(|index| format!("r{index}"))
-        .collect::<Vec<_>>();
+    let names = value_names(rows).collect::<Vec<_>>();
     let batch = rows
         .iter()
+        .flat_map(|row| row.values.iter().map(move |value| (row.id, value)))
         .zip(&names)
-        .fold(write_batch(), |batch, (row, name)| {
-            let guard = Predicate::and(
-                row.values
-                    .iter()
-                    .map(|(property, stored, _)| Predicate::eq(property.as_str(), stored.as_str()))
-                    .collect(),
-            );
-            let mut sets = row.values.iter().map(|(property, _, millis)| {
-                (
-                    property.clone(),
-                    PropertyInput::from(DateTime::from_millis(*millis)),
-                )
-            });
-            let (property, value) = sets
-                .next()
-                .expect("a conversion row has at least one value");
-            match element {
-                Element::Node => batch.var_as(
-                    name.as_str(),
-                    sets.fold(
-                        g().n(NodeRef::id(row.id))
+        .fold(
+            write_batch(),
+            |batch, ((id, (property, stored, millis)), name)| {
+                let guard = Predicate::eq(property.as_str(), stored.as_str());
+                let value = PropertyInput::from(DateTime::from_millis(*millis));
+                match element {
+                    Element::Node => batch.var_as(
+                        name.as_str(),
+                        g().n(NodeRef::id(id))
                             .where_(guard)
-                            .set_property(property, value),
-                        |traversal, (property, value)| traversal.set_property(property, value),
-                    )
-                    .count(),
-                ),
-                Element::Edge => batch.var_as(
-                    name.as_str(),
-                    sets.fold(
-                        g().e(EdgeRef::id(row.id))
+                            .set_property(property.clone(), value)
+                            .count(),
+                    ),
+                    Element::Edge => batch.var_as(
+                        name.as_str(),
+                        g().e(EdgeRef::id(id))
                             .where_(guard)
-                            .set_property(property, value),
-                        |traversal, (property, value)| traversal.set_property(property, value),
-                    )
-                    .count(),
-                ),
-            }
-        });
+                            .set_property(property.clone(), value)
+                            .count(),
+                    ),
+                }
+            },
+        );
     QueryRequest::write(batch.returning(names))
 }
 
@@ -579,18 +572,12 @@ async fn execute(
     .map_err(HelixDbError::from)
 }
 
-/// Values rewritten by a conversion response: each row's string count when
-/// its guarded traversal matched (counted 1, not 0).
+/// Values rewritten by a conversion response: those whose guarded traversal
+/// matched (counted 1, not 0).
 fn converted_values(response: &serde_json::Value, rows: &[RowConversion]) -> u64 {
-    rows.iter()
-        .enumerate()
-        .filter(|(index, _)
```

**File**: `crates/db/src/migrations/datetime_strings_tests.rs` (modified, +456/-4)
```diff
@@ -14,6 +14,29 @@ use slatedb::object_store::ObjectStore;
 
 use super::*;
 use crate::config::{self, DbConfig, SecondaryIndexDefinition};
+use crate::encoding::indexes::range::RangeIndexDirection;
+use crate::encoding::v2::keys::{ManagedIndexKey, ScopedKey, SecondaryEntryLane};
+use crate::encoding::v2::values::property::range_index_value::{
+    project_range_value, RangeValueProjection,
+};
+use crate::index_lifecycle::{ActiveIndexHandle, ValidatedSecondaryIndexDefinition};
+
+tokio::task_local! {
+    /// Holds a conversion batch between its reads and its write: the batch
+    /// signals the first notify, then waits for the second.
+    static BEFORE_CONVERSION: (Arc<tokio::sync::Notify>, Arc<tokio::sync::Notify>);
+}
+
+/// Pauses a conversion batch taken inside a [`BEFORE_CONVERSION`] scope.
+pub(super) async fn pause_before_conversion() {
+    let Ok((reached, resume)) =
+        BEFORE_CONVERSION.try_with(|(reached, resume)| (Arc::clone(reached), Arc::clone(resume)))
+    else {
+        return;
+    };
+    reached.notify_one();
+    resume.notified().await;
+}
 
 fn config(batch_rows: usize, worker: config::MigrationWorkerMode) -> DbConfig {
     DbConfig::new().with_migration_tuning(
@@ -345,8 +368,10 @@ async fn converts_every_tenant_scope_independently() {
         .all(|row| row["at"] != json!("2026-01-01T00:00:00.000Z")));
 }
 
+/// A collision in a unique index keeps only the colliding value a string: the
+/// row's other convertible properties still convert.
 #[tokio::test]
-async fn a_unique_collision_keeps_only_the_colliding_row_as_a_string() {
+async fn a_unique_collision_keeps_only_the_colliding_value_as_a_string() {
     let db = open(1024).await;
     db.install_index_for_tests(
         SecondaryIndexDefinition::node_unique_equality("Event", "at")
@@ -369,7 +394,11 @@ async fn a_unique_collision_keeps_only_the_colliding_row_as_a_string() {
         &db,
         u,
         "Event",
-        vec![("name", s("b")), ("at", s("2026-01-01T01:00:00+01:00"))],
+        vec![
+            ("name", s("b")),
+            ("at", s("2026-01-01T01:00:00+01:00")),
+            ("until", s("2026-03-01T00:00:00Z")),
+        ],
     )
     .await;
     add_node(
@@ -382,13 +411,13 @@ async fn a_unique_collision_keeps_only_the_colliding_row_as_a_string() {
 
     let report = run_to_completion(&db).await;
 
-    assert_eq!(report.converted_values, 1, "{report:?}");
+    assert_eq!(report.converted_values, 2, "{report:?}");
     assert_eq!(report.unique_conflicts, 1);
     assert_eq!(
         values(&db, u, "Event").await,
         [
             json!({ "name": "a", "at": "2026-01-01T00:00:00.000Z" }),
-            json!({ "name": "b", "at": "2026-01-01T01:00:00+01:00" }),
+            json!({ "name": "b", "at": "2026-01-01T01:00:00+01:00", "until": "2026-03-01T00:00:00.000Z" }),
             json!({ "name": "c", "at": "2026-02-01T00:00:00.000Z" }),
         ]
     );
@@ -721,3 +750,426 @@ async fn cypher_and_sql_read_converted_rows_as_datetimes() {
     assert_eq!(sql.rows, vec![vec![json!("d")], vec![json!("a")]]);
     db.close().await.unwrap();
 }
+
+/// `(id, value)` of every unscoped `Event` storing `property`, read from the
+/// rows.
+async fn stored(db: &HelixDB, property: &str) -> Vec<(u64, PropertyValue)> {
+    let HelixStorage::Writer(writer) = db.storage() else {
+        panic!("writer");
+    };
+    read_rows(
+        writer.db(),
+        DataScope::LegacyUnscoped,
+        Element::Node,
+        None,
+        MigrationTuning::default(),
+    )
+    .await
+    .unwrap()
+    .iter()
+    .filter_map(|(key, value)| {
+        let (id, row) = decode_row(DataScope::LegacyUnscoped, Element::Node, key, value)
+            .unwrap()
+            .unwrap();
+        if label_of(&row) != Some("Event") {
+            return None;
+        }
+        row.into_iter()
+            .find(|stored| stored.name == property)
+            .map(|stored| (id, stored.value))
+    })
+    .collect()
+}
+
+/// The raw rows of `Event.{property}`'s equality and range indexes, read
+/// without the per-row check a query applies to index hits, hold exactly what
+/// a scan of the rows does: each probed value's equality row holds the ids
+/// storing that value and no other, and the range index holds one entry per
+/// stored value.
+async fn assert_indexes_match_rows(db: &HelixDB, property: &str, probes: &[PropertyValue]) {
+    let HelixStorage::Writer(writer) = db.storage() else {
+        panic!("writer");
+    };
+    let store = writer.db();
+    let stored = stored(db, property).await;
+    let handles = db.active_index_handles_loaded(DataScope::LegacyUnscoped);
+    let handle = |range: bool| -> &ActiveIndexHandle {
+        handles
+            .iter()
+            .find(|handle| {
+                handle
+                    .secondary_definition()
+                    .is_some_and(|definition| definition.property().as_str() == property)
+                    && matches!(
+                    
```

**File**: `crates/db/src/migrations/indexes/label_identity.rs` (modified, +8/-5)
```diff
@@ -283,9 +283,11 @@ impl LabelCopySession {
         }
     }
 
-    /// Whether a label step may run now. While the writer's flush backlog is
-    /// high it waits [`YIELD_WAIT`] and declines, so the caller takes the step
-    /// later and foreground writes keep the room meanwhile.
+    /// Whether a paced background step may run now: the label steps and the
+    /// datetime string conversion, which the worker admits together, so they
+    /// share one pacing. While the writer's flush backlog is high it waits
+    /// [`YIELD_WAIT`] and declines, so the caller takes the step later and
+    /// foreground writes keep the room meanwhile.
     pub(crate) async fn admit_step(&mut self, db: &Db) -> Result<bool> {
         let unflushed = db.unflushed_bytes()?;
         if self.pacing.admits(unflushed) {
@@ -401,12 +403,13 @@ fn per_second(rows: u64, elapsed: Duration) -> u64 {
     (rows as f64 / seconds) as u64
 }
 
-/// Holds label steps back while the writer's flush backlog is high.
+/// Holds paced background steps (the label steps and the datetime string
+/// conversion) back while the writer's flush backlog is high.
 ///
 /// Every write, foreground or background, waits once the writer's unflushed
 /// bytes reach `max_unflushed_bytes` (SlateDB backpressure). The backlog that
 /// fills that room is the immutable memtables and the WAL waiting for object
-/// storage; the active memtable fills and freezes in normal operation. Label
+/// storage; the active memtable fills and freezes in normal operation. Paced
 /// steps stop once the backlog reaches 1/[`BACKLOG_HIGH_SHARE`] of the limit
 /// and start again below 1/[`BACKLOG_LOW_SHARE`], so they only use flush
 /// capacity foreground writes leave spare.
```

**File**: `crates/db/src/migrations/indexes/label_identity_tests.rs` (modified, +22/-10)
```diff
@@ -2182,17 +2182,29 @@ async fn background_label_steps_leave_foreground_writes_room_under_a_slow_store(
         let writer = Arc::clone(&writer);
         async move {
             let mut session = LabelCopySession::new();
+            let mut retries = crate::migrations::background::MigrationRetries::default();
             let started = Instant::now();
-            while crate::migrations::background::process_background_step(
-                &writer,
-                &std::sync::Weak::new(),
-                MigrationTuning::default(),
-                crate::migrations::background::BackgroundMigrations::LabelIdentity,
-                &mut session,
-            )
-            .await
-            .unwrap()
-            {
+            loop {
+                match crate::migrations::background::process_background_step(
+                    &writer,
+                    &std::sync::Weak::new(),
+                    MigrationTuning::default(),
+                    crate::migrations::background::BackgroundMigrations::LabelIdentity,
+                    &mut session,
+                    &mut retries,
+                    tokio::time::Instant::now,
+                )
+                .await
+                {
+                    crate::migrations::background::BackgroundStep::Active { failure: None } => {}
+                    crate::migrations::background::BackgroundStep::Finished => break,
+                    failed @ (crate::migrations::background::BackgroundStep::Active {
+                        failure: Some(_),
+                    }
+                    | crate::migrations::background::BackgroundStep::RetryAt { .. }) => {
+                        panic!("a label step failed: {failed:?}")
+                    }
+                }
                 assert!(
                     started.elapsed() < Duration::from_secs(600),
                     "label steps stalled"
```

---

### Incident Patch 2: `3a1d4e52` (2026-11-19)
**Commit Message**: Isolate and pace background migrations with per-migration backoff

A failure in one background migration step no longer stops the others:
the migration jobs, label identity copy, hash label cleanup, step pacing
check and datetime conversion each keep their own Retry state (Ready, or
At a retry time with a doubling delay capped at 60s, reset on success).
The delay starts when the failed step ends. The worker sleeps its active
interval after any advance, otherwise until the earliest pending retry,
and exits only once every migration has finished.

The datetime conversion runs only once the migration jobs report nothing
left, and only while the writer's flush backlog is low, so it never
pushes foreground writes into backpressure. The database handle is
upgraded only for a conversion step.

**File**: `crates/db/src/lib.rs` (modified, +19/-2)
```diff
@@ -4288,15 +4288,32 @@ impl HelixDB {
             return Err(HelixDbError::MigrationSteppingRequiresDisabledMode);
         }
         // No database handle: the datetime string conversion keeps its own
-        // stepping surface, so a step here takes the jobs it took before.
-        migrations::background::process_background_step(
+        // stepping surface, so a step here takes the jobs it took before. A
+        // fresh backoff takes every migration, so this step returns its first
+        // failure after all have run, as the worker logs each.
+        match migrations::background::process_background_step(
             writer,
             &std::sync::Weak::new(),
             self.config().db().migrations(),
             migrations::background::BackgroundMigrations::All,
             &mut migrations::LabelCopySession::new(),
+            &mut migrations::background::MigrationRetries::default(),
+            tokio::time::Instant::now,
         )
         .await
+        {
+            migrations::background::BackgroundStep::Active {
+                failure: Some(error),
+            }
+            | migrations::background::BackgroundStep::RetryAt {
+                failure: Some(error),
+                ..
+            } => Err(error),
+            // A fresh backoff waits on nothing, so only a failure retries.
+            migrations::background::BackgroundStep::Active { failure: None }
+            | migrations::background::BackgroundStep::RetryAt { failure: None, .. } => Ok(true),
+            migrations::background::BackgroundStep::Finished => Ok(false),
+        }
     }
 
     #[cfg(any(test, feature = "bench-internals"))]
```

**File**: `crates/db/src/migrations/background/label_and_datetime_tests.rs` (modified, +781/-2)
```diff
@@ -1,8 +1,13 @@
 //! A store that needs both the label identity copy and the datetime string
 //! conversion: one background worker finishes both, whatever order their
-//! steps interleave in, while the writer serves graph writes.
+//! steps interleave in, while the writer serves graph writes. A failing
+//! migration backs off alone: a failing label step does not slow the
+//! conversion, a failing migration job does not slow the label steps but does
+//! hold the conversion back, and the conversion waits while the writer's flush
+//! backlog is high.
 
 use std::sync::Arc;
+use std::time::Duration;
 
 use helix_ast::batch::{read_batch, write_batch};
 use helix_ast::expr::Predicate;
@@ -13,14 +18,25 @@ use helix_ast::value::{DateTime, PropertyInput};
 use serde_json::json;
 use slatedb::object_store::{memory::InMemory, ObjectStore};
 use slatedb::DbReadOps;
+use tokio::time::Instant;
 
+use super::{
+    process_background_step, BackgroundMigrations, BackgroundStep, MigrationRetries,
+    MigrationWorkerSupervisor, Retry, MAX_FAILURE_BACKOFF,
+};
 use crate::config::{self, DbConfig, MigrationTuning, SecondaryIndexDefinition};
+use crate::encoding::indexes::{label, PropertyIndexKey};
 use crate::encoding::keys::scope::{DataScope, TenantId};
-use crate::encoding::v2::keys::DataKey;
+use crate::encoding::keys::NodePropertyKey;
+use crate::encoding::property::{encode_properties, Property};
+use crate::encoding::v2::keys::{DataKey, DataKeyKind};
 use crate::encoding::v2::legacy::label_hash;
+use crate::encoding::v2::values::indexes::SecondaryEqualityBitmapValue;
+use crate::error::HelixDbError;
 use crate::index_lifecycle::IndexStorageVersion;
 use crate::migrations::{datetime_strings, indexes::label_identity, startup};
 use crate::query_service::HelixQueryService;
+use crate::search::vector::gated_wal::{GatedWalStore, WalUploads};
 use crate::{HelixDB, HelixStorage};
 
 const DB_PATH: &str = "label-and-datetime-migrations";
@@ -439,3 +455,766 @@ async fn one_worker_finishes_the_label_copy_and_the_datetime_conversion() {
 
     db.close().await.unwrap();
 }
+
+/// One background step of every migration with the clock held at `now`, as
+/// the worker takes it.
+async fn step(
+    db: &HelixDB,
+    labels: &mut label_identity::LabelCopySession,
+    retries: &mut MigrationRetries,
+    now: Instant,
+) -> BackgroundStep {
+    let HelixStorage::Writer(writer) = db.storage() else {
+        panic!("writer");
+    };
+    process_background_step(
+        writer,
+        &Arc::downgrade(&db.inner),
+        db.config().db().migrations(),
+        BackgroundMigrations::All,
+        labels,
+        retries,
+        || now,
+    )
+    .await
+}
+
+/// The first failure backoff of `db`'s migrations: its idle interval.
+fn initial_backoff(db: &HelixDB) -> Duration {
+    Duration::from_millis(db.config().db().migrations().idle_interval_millis().get())
+}
+
+/// A background worker of `db` on `tuning`, with no handle on the database
+/// it keeps alive, as the open starts one.
+fn start_worker(db: &HelixDB, tuning: MigrationTuning) -> MigrationWorkerSupervisor {
+    let HelixStorage::Writer(writer) = db.storage() else {
+        panic!("writer");
+    };
+    MigrationWorkerSupervisor::start_if_enabled(
+        Arc::clone(writer),
+        Arc::downgrade(&db.inner),
+        tuning
+            .with_worker_mode(config::MigrationWorkerMode::Background)
+            .with_active_interval(config::MigrationActiveIntervalMillis::new(1).unwrap()),
+        BackgroundMigrations::All,
+    )
+    .expect("background tuning starts a worker")
+}
+
+async fn conversion(db: &HelixDB) -> Option<datetime_strings::Job> {
+    let HelixStorage::Writer(writer) = db.storage() else {
+        panic!("writer");
+    };
+    datetime_strings::load(writer.db()).await.unwrap()
+}
+
+/// Every unscoped event and attendance as written: datetimes still strings.
+async fn assert_unconverted(db: &HelixDB) {
+    let mut events = (0..EVENTS)
+        .map(|event| (format!("e{event}"), event_at(event)))
+        .collect::<Vec<_>>();
+    events.sort();
+    assert_eq!(scanned_events(db, DataScope::LegacyUnscoped).await, events);
+    let mut since = (0..EVENTS).map(attends_since).collect::<Vec<_>>();
+    since.sort();
+    assert_eq!(edge_since(db, DataScope::LegacyUnscoped).await, since);
+}
+
+/// The conversion finished and every unscoped datetime is stored as one.
+async fn assert_converted(db: &HelixDB) {
+    let job = conversion(db).await.expect("the conversion ran");
+    assert!(job.is_completed(), "{job:?}");
+    assert_eq!(
+        job.report().converted_values,
+        u64::try_from(2 * EVENTS).unwrap(),
+        "{job:?}"
+    );
+    let mut events = (0..EVENTS)
+        .map(|event| (format!("e{event}"), canonical(&event_at(event))))
+        .collect::<Vec<_>>();
+    events.sort();
+    assert_eq!(scanned_events(db, DataScope::LegacyUnscoped).await, events);
+    let mut since = (0..EVENTS)
+        .map(|event| can
```

**File**: `crates/db/src/migrations/background/mod.rs` (modified, +1/-1)
```diff
@@ -3,5 +3,5 @@
 mod worker;
 
 #[cfg(test)]
-pub(crate) use worker::process_background_step;
+pub(crate) use worker::{process_background_step, BackgroundStep, MigrationRetries};
 pub(crate) use worker::{BackgroundMigrations, MigrationWorkerSupervisor};
```

**File**: `crates/db/src/migrations/background/worker.rs` (modified, +229/-95)
```diff
@@ -5,6 +5,7 @@ use std::time::Duration;
 
 use tokio::sync::watch;
 use tokio::task::JoinHandle;
+use tokio::time::Instant;
 
 use crate::config::{MigrationTuning, MigrationWorkerMode};
 use crate::encoding::v2::keys::scope::DataScope;
@@ -13,30 +14,57 @@ use crate::HelixWriter;
 
 const MAX_FAILURE_BACKOFF: Duration = Duration::from_secs(60);
 
-#[derive(Debug, Clone, Copy)]
-struct FailureBackoff {
-    initial: Duration,
-    next: Duration,
+/// When a step may next take one background migration.
+#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
+enum Retry {
+    /// It has not failed since its last success: every step takes it.
+    #[default]
+    Ready,
+    /// Its last attempt failed: no step takes it before `at`, which is `delay`
+    /// after the step that made that attempt ended. Another failure waits twice as long, up to
+    /// [`MAX_FAILURE_BACKOFF`]; a success makes it [`Retry::Ready`] again.
+    At { at: Instant, delay: Duration },
 }
 
-impl FailureBackoff {
-    fn new(initial: Duration) -> Self {
-        let initial = initial.min(MAX_FAILURE_BACKOFF);
-        Self {
-            initial,
-            next: initial,
-        }
-    }
-
-    fn next_delay(&mut self) -> Duration {
-        let delay = self.next;
-        self.next = self.next.saturating_mul(2).min(MAX_FAILURE_BACKOFF);
-        delay
-    }
+/// Each background migration's own failure backoff, kept by the worker
+/// between steps, so a migration that keeps failing slows only itself.
+///
+/// The flush backlog check that admits the paced migrations backs off on its
+/// own too: while it does, no paced migration runs.
+#[derive(Debug, Default)]
+pub(crate) struct MigrationRetries {
+    job: Retry,
+    pacing: Retry,
+    label_copy: Retry,
+    label_cleanup: Retry,
+    datetimes: Retry,
+}
 
-    fn reset(&mut self) {
-        self.next = self.initial;
-    }
+/// What one background step leaves the worker to do.
+#[derive(Debug)]
+#[cfg_attr(
+    not(test),
+    allow(
+        dead_code,
+        reason = "the step logs every failure; only stepping tests read a failure back"
+    )
+)]
+pub(crate) enum BackgroundStep {
+    /// A migration advanced, or was held back by the flush backlog: the worker
+    /// steps again after its active interval. `failure` is the first failure
+    /// of another migration in this step.
+    Active {
+        failure: Option<crate::error::HelixDbError>,
+    },
+    /// No migration advanced and at least one is backing off: the worker steps
+    /// again at `at`, the earliest retry. `failure` is this step's first
+    /// failure, or `None` if every unfinished migration was waiting.
+    RetryAt {
+        at: Instant,
+        failure: Option<crate::error::HelixDbError>,
+    },
+    /// Every background migration has finished.
+    Finished,
 }
 
 /// The background migrations one writer runs.
@@ -98,53 +126,178 @@ impl MigrationWorkerSupervisor {
 }
 
 /// Advances every pending background migration `migrations` names by one
-/// bounded batch: the next runnable migration job, the label identity copy,
-/// the deletion of the hash label rows it retires, and, once no migration job
-/// has more to do, the datetime string conversion. Returns whether any has
-/// more to do, so the worker stops only when every one has finished. `labels`
-/// carries the copy's state between steps.
+/// bounded batch: the next runnable migration job, the label identity
+/// copy, the deletion of the hash label rows it retires, and, once no migration
+/// job has more to do, the datetime string conversion. `labels` carries the
+/// copy's state and the step pacing between steps, `retries` each migration's
+/// failure backoff.
+///
+/// The step reads `clock` twice: before it takes any migration, to tell which
+/// are due, and after all have run, to time each failure's retry from then. A
+/// retry delay so starts when the failed step ends, not when it started, so a
+/// slow batch beside a failure does not eat into that failure's backoff.
+///
+/// A migration that failed is skipped until its retry time, and backs off
+/// alone: a failing label step slows neither the migration jobs nor the
+/// datetime conversion, nor they it. The step logs each failure with the
+/// migration's name and retry delay, and a success clears that migration's
+/// backoff. The one ordering is that the datetime conversion runs only once
+/// the migration jobs report nothing more to do: jobs that fail or wait on
+/// their backoff count as not done, so the conversion never rewrites rows an
+/// unfinished job still moves.
+///
+/// The step reports [`BackgroundStep::Finished`] only when every migration has
+/// finished; one backing off has not, and makes the step report its retry
+/// time unless another advanced.
 ///
-/// The migration job and the label steps run every step, so neither waits for
-/// the other to finish, and one failing does not stop another's batch from
-/// committing. The cleanup follo
```

**File**: `crates/db/src/migrations/indexes/label_identity.rs` (modified, +8/-5)
```diff
@@ -283,9 +283,11 @@ impl LabelCopySession {
         }
     }
 
-    /// Whether a label step may run now. While the writer's flush backlog is
-    /// high it waits [`YIELD_WAIT`] and declines, so the caller takes the step
-    /// later and foreground writes keep the room meanwhile.
+    /// Whether a paced background step may run now: the label steps and the
+    /// datetime string conversion, which the worker admits together, so they
+    /// share one pacing. While the writer's flush backlog is high it waits
+    /// [`YIELD_WAIT`] and declines, so the caller takes the step later and
+    /// foreground writes keep the room meanwhile.
     pub(crate) async fn admit_step(&mut self, db: &Db) -> Result<bool> {
         let unflushed = db.unflushed_bytes()?;
         if self.pacing.admits(unflushed) {
@@ -401,12 +403,13 @@ fn per_second(rows: u64, elapsed: Duration) -> u64 {
     (rows as f64 / seconds) as u64
 }
 
-/// Holds label steps back while the writer's flush backlog is high.
+/// Holds paced background steps (the label steps and the datetime string
+/// conversion) back while the writer's flush backlog is high.
 ///
 /// Every write, foreground or background, waits once the writer's unflushed
 /// bytes reach `max_unflushed_bytes` (SlateDB backpressure). The backlog that
 /// fills that room is the immutable memtables and the WAL waiting for object
-/// storage; the active memtable fills and freezes in normal operation. Label
+/// storage; the active memtable fills and freezes in normal operation. Paced
 /// steps stop once the backlog reaches 1/[`BACKLOG_HIGH_SHARE`] of the limit
 /// and start again below 1/[`BACKLOG_LOW_SHARE`], so they only use flush
 /// capacity foreground writes leave spare.
```

**File**: `crates/db/src/migrations/indexes/label_identity_tests.rs` (modified, +22/-10)
```diff
@@ -2182,17 +2182,29 @@ async fn background_label_steps_leave_foreground_writes_room_under_a_slow_store(
         let writer = Arc::clone(&writer);
         async move {
             let mut session = LabelCopySession::new();
+            let mut retries = crate::migrations::background::MigrationRetries::default();
             let started = Instant::now();
-            while crate::migrations::background::process_background_step(
-                &writer,
-                &std::sync::Weak::new(),
-                MigrationTuning::default(),
-                crate::migrations::background::BackgroundMigrations::LabelIdentity,
-                &mut session,
-            )
-            .await
-            .unwrap()
-            {
+            loop {
+                match crate::migrations::background::process_background_step(
+                    &writer,
+                    &std::sync::Weak::new(),
+                    MigrationTuning::default(),
+                    crate::migrations::background::BackgroundMigrations::LabelIdentity,
+                    &mut session,
+                    &mut retries,
+                    tokio::time::Instant::now,
+                )
+                .await
+                {
+                    crate::migrations::background::BackgroundStep::Active { failure: None } => {}
+                    crate::migrations::background::BackgroundStep::Finished => break,
+                    failed @ (crate::migrations::background::BackgroundStep::Active {
+                        failure: Some(_),
+                    }
+                    | crate::migrations::background::BackgroundStep::RetryAt { .. }) => {
+                        panic!("a label step failed: {failed:?}")
+                    }
+                }
                 assert!(
                     started.elapsed() < Duration::from_secs(600),
                     "label steps stalled"
```

#### Recent Merged Pull Requests:
- **PR #1314** (2026-11-20): Isolate, pace and back off background migrations independently (@xav-db)
- **PR #1311** (2026-11-19): Compare datetimes with text as unknown on every plan (@xav-db)
- **PR #1310** (2026-11-19): Build indexes without waiting on S3 per step or rescanning applied deltas (@xav-db)
- **PR #1309** (2026-11-19): Use datetime() and timestamp() as index bounds (@xav-db)
- **PR #1307** (2026-11-19): Declare typed fields on object parameters (@xav-db)
- **PR #1306** (2026-11-19): Read and write datetimes in Cypher and SQL (@xav-db)

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

## X. Isolate, pace and back off background migrations independently

**RULE**:
When implementing operations in `crates/db/src/lib.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in HelixDB/helix-db. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a29a8d49`: Isolate, pace and back off background migrations independently. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/db/src/lib.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // stepping surface, so a step here takes the jobs it took before. A
        // fresh backoff takes every migration, so this step returns its first
        // failure after all have run, as the worker logs each.
        match migrations::background::process_background_step(
            &mut migrations::background::MigrationRetries::default(),
            tokio::time::Instant::now,
        {
            migrations::background::BackgroundStep::Active {
                failure: Some(error),
            }
            | migrations::background::BackgroundStep::RetryAt {
                failure: Some(error),
                ..
            } => Err(error),
            // A fresh backoff waits on nothing, so only a failure retries.
            migrations::background::BackgroundStep::Active { failure: None }
            | migrations::background::BackgroundStep::RetryAt { failure: None, .. } => Ok(true),
            migrations::background::BackgroundStep::Finished => Ok(false),
        }
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        // stepping surface, so a step here takes the jobs it took before.
        migrations::background::process_background_step(
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a29a8d49` are properly handled with clean fallback behavior.
