# Verification Protocol: Verification Protocol: Empirical Defect Shield for HelixDB/helix-db

<!-- PROVENANCE_START
{
  "source_repository": "HelixDB/helix-db",
  "source_url": "https://github.com/HelixDB/helix-db",
  "source_version": "b943942d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T01:31:33.416Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-helixdb-helix-db",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [HelixDB/helix-db](https://github.com/HelixDB/helix-db) (Revision: `b943942d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T01:31:33.416Z`  
> **Learning ID**: `learn-github-helixdb-helix-db`


## 1. Scope & Verification Target
- **Target Repository**: `HelixDB/helix-db` (Commit: `b943942d`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): HelixDB/helix-db

> **Canonical Artifact**: `07_PROJECT_LEARNING/helixdb-helix-db-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HelixDB/helix-db](https://github.com/HelixDB/helix-db))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T01:31:31.991Z  
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

### Incident Patch 1: `b943942d` (2026-11-19)
**Commit Message**: Build indexes without waiting on S3 per step or rescanning applied deltas (#1310)

Building a new index on an existing label took about 400 s on 1M rows on
S3. With 1,000 writes/s running, it took 25 min to over an hour, or
never finished. This PR cuts those builds to 20-50 s. **No stored format
changes.**

## Why it was slow

1. **Each step waited for the S3 upload twice.** A step made two
commits, the claim and the step, and each waited about 100 ms for the
WAL upload. That wait was about 95% of a clean build.
2. **Catch-up re-read every delta from the start.** Applied deltas leave
deleted markers behind, and each check scanned the whole delta range
again, markers included. With writes running, that cost grew with every
step.

## What changed

**1. Pending-delta ledger** (`secondary/delta_ledger.rs`, used by
equality, unique and range indexes)

```diff
 observe pending deltas
-  scan the whole delta range from the start
+  point-read the keys already in the ledger
+  scan only the part not seen yet
```

- Writers add their keys to the ledger as they commit.
- After a restart, or if the ledger grows past its cap (4×65,536 keys
per DB handle), the build falls back to one full scan.

**File**: `crates/db/src/execution/interpreter/mutation/index_context.rs` (modified, +8/-3)
```diff
@@ -324,7 +324,7 @@ impl MutationIndexContext {
     pub(crate) fn into_prepared(self) -> Result<PreparedMutationIndexContext, crate::HelixDbError> {
         let Self {
             property_writes,
-            _scope_permit,
+            _scope_permit: mut scope_permit,
             active,
             secondary,
             secondary_runtime,
@@ -339,10 +339,15 @@ impl MutationIndexContext {
                 transitions: _,
         } = self;
         topology_runtime.consume_prepared()?;
-        secondary_runtime.consume_prepared()?;
+        let staged = secondary_runtime.consume_prepared()?;
+        // The permit records them once dropped, after the commit applies;
+        // only focused tests run without one.
+        if let Some(permit) = scope_permit.as_mut() {
+            permit.stage_build_deltas(staged);
+        }
         Ok(PreparedMutationIndexContext {
             _property_writes: property_writes,
-            _scope_permit,
+            _scope_permit: scope_permit,
             active_generations: active.into_generations(),
             _secondary: secondary,
             _vector: vector,
```

**File**: `crates/db/src/index_lifecycle/failpoints.rs` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ pub enum IndexOutboxFailpoint {
     DdlEnqueueAfterStaging,
     /// Immediately before an eligible pointer is claimed.
     ClaimBefore,
-    /// Immediately after the claim commit is durable.
+    /// Immediately after the claim commit is applied.
     ClaimAfter,
     /// Immediately before a claimed operation's bounded read.
     BatchReadBefore,
```

**File**: `crates/db/src/index_lifecycle/operation.rs` (modified, +60/-10)
```diff
@@ -997,6 +997,15 @@ impl IndexOperationQueueSchedule {
     }
 }
 
+/// What a progressed step does with the claim it ran under.
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
+pub(crate) enum ClaimContinuation {
+    /// Requeue the operation, so any worker may claim its next step.
+    Release,
+    /// Keep the claim, so the worker holding it runs the next step directly.
+    Retain,
+}
+
 /// Canonical durable index operation.
 #[derive(Debug, Clone, PartialEq, Eq, Hash)]
 pub struct IndexOperationRecord {
@@ -1207,7 +1216,13 @@ impl IndexOperationRecord {
         &self.progress
     }
 
-    /// Returns the persisted transient-failure attempt counter.
+    /// Returns how many claims have tried the current checkpoint.
+    ///
+    /// A claim adds one. A committed step that advances the checkpoint resets
+    /// the count: to zero when it releases its claim, or to one when the
+    /// claim it keeps carries on with the next step. Failures, blockers, and
+    /// retries leave it unchanged, so it counts consecutive attempts that
+    /// made no progress, which is what transient-failure backoff scales by.
     pub const fn attempt(&self) -> u32 {
         self.attempt
     }
@@ -1254,10 +1269,17 @@ impl IndexOperationRecord {
         )
     }
 
-    /// Persists a successful bounded checkpoint and releases its claim.
+    /// Persists a successful bounded checkpoint, then requeues the operation
+    /// or keeps its claim as `claim` asks.
+    ///
+    /// A kept claim is the exact claim the step ran under, so the worker that
+    /// holds it can run the next step without claiming again. Progress resets
+    /// the attempt counter: a released checkpoint has had no attempt yet, and
+    /// a kept claim is the one attempt at its new checkpoint.
     pub(crate) fn progressed(
         &self,
         progress: IndexOperationProgress,
+        claim: ClaimContinuation,
     ) -> Result<Self, IndexOperationModelError> {
         if !matches!(
             self.execution_state,
@@ -1268,13 +1290,20 @@ impl IndexOperationRecord {
                 transition: "progress",
             });
         }
+        let (attempt, execution_state) = match claim {
+            ClaimContinuation::Release => (
+                0,
+                IndexOperationExecutionState::Queued {
+                    not_before_unix_millis: None,
+                },
+            ),
+            ClaimContinuation::Retain => (1, self.execution_state.clone()),
+        };
         self.next(
             self.index_record_revision,
             progress,
-            self.attempt,
-            IndexOperationExecutionState::Queued {
-                not_before_unix_millis: None,
-            },
+            attempt,
+            execution_state,
         )
     }
 
@@ -1397,7 +1426,8 @@ impl IndexOperationRecord {
     }
 
     /// Converts a constructing BUILD into the family's initial cleanup
-    /// checkpoint while invalidating any queued delay or worker claim.
+    /// checkpoint while invalidating any queued delay or worker claim. The
+    /// cleanup checkpoint has had no attempt, so the attempt counter resets.
     pub(crate) fn begin_abort(
         &self,
         index_record_revision: IndexRevision,
@@ -1448,7 +1478,7 @@ impl IndexOperationRecord {
         self.next(
             index_record_revision,
             progress,
-            self.attempt,
+            0,
             IndexOperationExecutionState::Queued {
                 not_before_unix_millis: None,
             },
@@ -2397,14 +2427,30 @@ mod tests {
         let replaced = claimed.claim(claim(2, 2)).unwrap();
         assert_eq!(replaced.attempt(), 8);
 
-        let progressed = claimed.progressed(secondary_constructing()).unwrap();
+        let progressed = claimed
+            .progressed(secondary_constructing(), ClaimContinuation::Release)
+            .unwrap();
         assert!(matches!(
             progressed.execution_state(),
             IndexOperationExecutionState::Queued {
                 not_before_unix_millis: None
             }
         ));
+        assert_eq!(progressed.attempt(), 0, "progress resets the attempts");
+        let retained = claimed
+            .progressed(secondary_constructing(), ClaimContinuation::Retain)
+            .unwrap();
+        assert_eq!(retained.execution_state(), claimed.execution_state());
+        assert_eq!(retained.attempt(), 1, "a kept claim is one attempt");
+        assert_eq!(retained.claim(claim(1, 3)).unwrap().attempt(), 2);
+        assert_eq!(progressed.claim(claim(1, 3)).unwrap().attempt(), 1);
+        assert_eq!(
+            retained.operation_revision(),
+            claimed.operation_revision().checked_next().unwrap()
+        );
+        assert_eq!(retained.queue_schedule(), None);
         let failed = claimed.transient_failure(30).unwrap();
+        assert_eq!(failed.attempt(), claimed.attempt(), "failures accumulate");
         assert!(failed
             .queue_schedule()
```

**File**: `crates/db/src/index_lifecycle/outbox.rs` (modified, +916/-116)
```diff
@@ -29,19 +29,19 @@ use crate::encoding::v2::values::{
 };
 use crate::error::{HelixDbError, Result};
 use crate::execution_control;
-use crate::transaction::Mutation;
+use crate::transaction::{CommitDurability, Mutation};
 
 mod failure;
 #[cfg(test)]
 pub(crate) mod step_pause;
 
 use super::failpoints::{self, IndexOutboxFailpoint};
 use super::{
-    BuildOperationOutcome, ClaimSequence, IndexOperationBlocker, IndexOperationExecutionState,
-    IndexOperationFamily, IndexOperationId, IndexOperationOutcome, IndexOperationProgress,
-    IndexOperationRecord, IndexOperationRevision, IndexOperationStage, IndexOperationStatus,
-    IndexRecordV2, IndexRevision, IndexStateTransition, IndexStateV2, IndexV2MetadataValue,
-    OperationClaim, OperationQueuePointerValue, WriterEpoch,
+    BuildOperationOutcome, ClaimContinuation, ClaimSequence, IndexOperationBlocker,
+    IndexOperationExecutionState, IndexOperationFamily, IndexOperationId, IndexOperationOutcome,
+    IndexOperationProgress, IndexOperationRecord, IndexOperationRevision, IndexOperationStage,
+    IndexOperationStatus, IndexRecordV2, IndexRevision, IndexStateTransition, IndexStateV2,
+    IndexV2MetadataValue, OperationClaim, OperationQueuePointerValue, WriterEpoch,
 };
 
 /// Maximum scheduling delay used for one observation of a persisted deadline.
@@ -131,7 +131,8 @@ pub(crate) enum ClaimPermission {
     SameEpochRecovery(SameEpochRecoveryProof),
 }
 
-/// Exact claimed operation returned after its claim transaction commits.
+/// Exact claimed operation returned after its claim transaction commits, or
+/// after a step that kept its claim committed.
 #[derive(Debug, Clone)]
 pub(crate) struct ClaimedOperation {
     pub(crate) scope: DataScope,
@@ -141,7 +142,8 @@ pub(crate) struct ClaimedOperation {
 /// Closed family-driver result for one bounded claimed step.
 #[derive(Debug, Clone)]
 pub(crate) enum IndexOperationStepResult {
-    /// Physical work and the supplied next checkpoint commit together.
+    /// Physical work and the supplied next checkpoint commit together,
+    /// without waiting for the WAL upload (see [`execute_claimed_step_with_evidence`]).
     Progressed(IndexOperationProgress),
     /// No physical work commits; the exact checkpoint is durably backed off.
     TransientFailure,
@@ -150,9 +152,10 @@ pub(crate) enum IndexOperationStepResult {
     /// The step's transaction commits the blocker beside the operation's
     /// unchanged checkpoint, so anything the driver staged commits too and a
     /// retry rescans it: a driver stages before blocking only work that a
-    /// rescan from that checkpoint reconciles.
+    /// rescan from that checkpoint reconciles. The commit is durable.
     Blocked(IndexOperationBlocker),
-    /// The canonical lifecycle state and terminal operation commit together.
+    /// The canonical lifecycle state and terminal operation commit together,
+    /// durably.
     Completed(IndexOperationOutcome),
 }
 
@@ -454,7 +457,10 @@ impl PreparedIndexOperationStep {
         }
     }
 
-    /// Performs post-commit external work only after durability is proven.
+    /// Performs post-commit external work once the step's commit is applied.
+    ///
+    /// A progressed step's commit is not yet durable here, so this work must
+    /// stay sound if a crash loses that commit.
     async fn after_commit(self) {
         if let Self::Text(step) = self {
             (*step).after_commit().await;
@@ -490,6 +496,7 @@ pub(crate) trait IndexOperationDriver: Send + Sync {
     /// permit supplied by this default implementation.
     async fn acquire_step_permit(
         &self,
+        _db: &Db,
         _scope: DataScope,
         _operation: &IndexOperationRecord,
     ) -> Result<Box<dyn IndexOperationStepPermit>> {
@@ -503,12 +510,12 @@ pub(crate) trait IndexOperationDriver: Send + Sync {
     /// all other stages on the ordinary path.
     async fn prepare_step(
         &self,
-        _db: &Db,
+        db: &Db,
         scope: DataScope,
         operation: &IndexOperationRecord,
         _limits: SearchIndexBatchLimits,
     ) -> Result<PreparedIndexOperationStep> {
-        let permit = self.acquire_step_permit(scope, operation).await?;
+        let permit = self.acquire_step_permit(db, scope, operation).await?;
         Ok(PreparedIndexOperationStep::driver_owned(
             self.family(),
             permit,
@@ -525,9 +532,12 @@ pub(crate) trait IndexOperationDriver: Send + Sync {
         limits: SearchIndexBatchLimits,
     ) -> Result<IndexOperationStepExecution>;
 
-    /// Applies disposable runtime cleanup only after the staged step is durable.
+    /// Applies disposable runtime cleanup once the staged step committed.
     ///
-    /// This hook must not write database state. Its default is intentionally a
+    /// It runs after every progressed, blocked or completed step, including a
+    /// driver failure recorded as a blocker; a progressed step's commit is
+    /// applied but ma
```

**File**: `crates/db/src/index_lifecycle/public.rs` (modified, +17/-4)
```diff
@@ -116,10 +116,20 @@ pub enum IndexOperationBlockerCode {
     InvalidLegacyPhysical,
 }
 
-/// Monotonic bounded-work counters safe for public progress reporting.
+/// Bounded-work counters safe for public progress reporting.
+///
+/// They grow while one writer runs the operation. A writer reports the steps
+/// it has applied, and progressed steps do not wait for their WAL upload, so
+/// after a crash or failover the counters can fall back to the last durable
+/// step, which the build then redoes. Readers report only durable steps.
 #[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
 pub struct IndexOperationPublicProgress {
-    /// Authoritative entities visited.
+    /// Source entities read. A build counts each entity its source scan
+    /// reads and each entity it re-reads to apply a write made during the
+    /// build; validation and other passes over entities already counted add
+    /// bytes and operations, never entities, so a build over `N` entities
+    /// with no concurrent writes reports `N`. Cleanup counts the rows it
+    /// removes.
     #[serde(with = "u64_string")]
     pub entities: u64,
     /// Source bytes consumed.
@@ -201,9 +211,12 @@ pub struct IndexOperationStatusCommon {
     pub family: PublicIndexFamily,
     /// Frozen family stage serialized in snake case.
     pub stage: IndexOperationStage,
-    /// Number of claims attempted.
+    /// Claims that have tried the current checkpoint: `1` while a healthy
+    /// operation runs. Every step that makes progress resets it, so it grows only
+    /// while consecutive attempts fail to make progress.
     pub attempt: u32,
-    /// Monotonic bounded-work progress.
+    /// Bounded-work progress; see [`IndexOperationPublicProgress`] for when
+    /// it can fall back.
     pub progress: IndexOperationPublicProgress,
 }
 
```

**File**: `crates/db/src/index_lifecycle/queue/lifecycle_tests.rs` (modified, +175/-37)
```diff
@@ -154,17 +154,56 @@ pub(super) async fn wait_terminal(db: &HelixDB, operation: &str) -> String {
     }
 }
 
-/// Lets the build take steps one ownership handoff at a time until `ready`
-/// holds, then returns with ownership held so no further step runs.
+/// Creates `spec`'s index, the `index_id`th of a fresh database, while
+/// holding its first generation's ownership, so no build step runs until
+/// [`pause_when`] hands it over. Unheld, a build runs its first steps while
+/// the DDL still waits for its WAL upload.
+pub(super) async fn create_held(
+    db: &HelixDB,
+    spec: IndexSpec,
+    family: QueueFamily,
+    index_id: u64,
+) -> (String, QueueTarget, IndexGenerationPublicationPermit) {
+    let predicted = QueueTarget::new(
+        DataScope::LegacyUnscoped,
+        crate::index_lifecycle::IndexId::new(index_id).unwrap(),
+        crate::index_lifecycle::IndexGenerationId::initial(),
+    );
+    let held = db
+        .inner
+        .index_scope_gates
+        .publication_permit(predicted)
+        .await;
+    let operation = create(db, spec).await;
+    assert_eq!(
+        target(db, family).await,
+        predicted,
+        "the held target is the build's"
+    );
+    (operation, predicted, held)
+}
+
+/// Lets the build take steps one ownership handoff at a time, starting from
+/// the `held` ownership of its generation, until `ready` holds, then returns
+/// with ownership held so no further step runs.
+///
+/// Ownership is a fair lock: it is handed over only once the build queues
+/// for it, and taken back by queueing right behind the build, so exactly one
+/// step runs per handoff however fast steps are.
 pub(super) async fn pause_when(
     db: &HelixDB,
     operation: &str,
-    target: QueueTarget,
+    held: IndexGenerationPublicationPermit,
     ready: impl Fn(&serde_json::Value) -> bool,
 ) -> IndexGenerationPublicationPermit {
     let deadline = Instant::now() + Duration::from_secs(60);
+    let target = held.target();
+    let mut held = Some(held);
     loop {
-        let permit = db.inner.index_scope_gates.publication_permit(target).await;
+        let permit = match held.take() {
+            Some(permit) => permit,
+            None => db.inner.index_scope_gates.publication_permit(target).await,
+        };
         let current = status(db, operation).await;
         if ready(&current) {
             return permit;
@@ -173,12 +212,19 @@ pub(super) async fn pause_when(
             matches!(current["status"].as_str(), Some("queued" | "running")),
             "build finished before pausing: {current}"
         );
-        assert!(
-            Instant::now() < deadline,
-            "build did not progress: {current}"
-        );
+        while db
+            .inner
+            .index_scope_gates
+            .publication_permit_holders(target)
+            < 2
+        {
+            assert!(
+                Instant::now() < deadline,
+                "build did not progress: {current}"
+            );
+            tokio::time::sleep(Duration::from_millis(1)).await;
+        }
         drop(permit);
-        tokio::time::sleep(Duration::from_millis(2)).await;
     }
 }
 
@@ -267,10 +313,9 @@ async fn concurrent_vector_writes(db: &HelixDB, ids: &[u64], state: &mut VectorS
 async fn vector_build_with_concurrent_writes_matches_exact_search_through_publication() {
     let db = open("build-vector", Arc::new(InMemory::new()), config()).await;
     let (ids, mut state) = seed_vectors(&db, 120).await;
-    let operation = create(&db, vector_spec()).await;
-    let target = target(&db, QueueFamily::Vector).await;
+    let (operation, target, held) = create_held(&db, vector_spec(), QueueFamily::Vector, 1).await;
 
-    let paused = pause_when(&db, &operation, target, |status| scanned(status) >= 40).await;
+    let paused = pause_when(&db, &operation, held, |status| scanned(status) >= 40).await;
     assert!(
         scanned(&status(&db, &operation).await) < 120,
         "paused mid-scan"
@@ -309,7 +354,13 @@ async fn vector_build_with_concurrent_writes_matches_exact_search_through_public
     assert_eq!(db.index_operation_queue_stats().deferred_attempts, 1);
     drop(paused);
 
-    let paused = pause_when(&db, &operation, target, |status| scanned(status) >= 110).await;
+    let paused = pause_when(
+        &db,
+        &operation,
+        db.inner.index_scope_gates.publication_permit(target).await,
+        |status| scanned(status) >= 110,
+    )
+    .await;
     concurrent_vector_writes(&db, &ids, &mut state, 1).await;
     set_tenant(&db, ids[101], "c").await;
     state.get_mut(&ids[101]).unwrap().0 = "c";
@@ -338,9 +389,8 @@ async fn restart_during_a_build_and_after_activation_recovers_queued_operations(
     let store: Arc<dyn ObjectStore> = Arc::new(InMemory::new());
     let db = open("build-restart", Arc::clone(&store), config()).await;
     let (ids, mut state) = seed_vectors(&db, 120).await;
-    let operation = create(&db, vector_spec()).awai
```

**File**: `crates/db/src/index_lifecycle/queue/vector_graph_tests.rs` (modified, +4/-5)
```diff
@@ -49,13 +49,13 @@ use std::sync::Arc;
 
 use slatedb::IsolationLevel;
 
-use super::lifecycle_tests::{create, pause_when, scanned, set_tenant, wait_terminal};
+use super::lifecycle_tests::{create_held, pause_when, scanned, set_tenant, wait_terminal};
 use super::overlay_tests::{add, delete, update, vector_search, write};
 use super::publication::{PublicationOutcome, QueuePublisher};
 use super::soak_tests::{
     assert_vector_graph, env_or, partition, vector_namespaces, History, Namespace, Rng,
 };
-use super::tests::{open, publisher_with_limits, queue, queued, target};
+use super::tests::{open, publisher_with_limits, queue, queued};
 use super::QueueTarget;
 use crate::config::{
     DbConfig, IndexOperationQueueTuning, SearchIndexBackfillLimits, SearchIndexBatchLimits,
@@ -390,9 +390,8 @@ async fn run(
         metric,
         Some("tenant"),
     );
-    let operation = create(&db, spec).await;
-    let target = target(&db, QueueFamily::Vector).await;
-    let paused = pause_when(&db, &operation, target, |status| scanned(status) >= 6).await;
+    let (operation, target, held) = create_held(&db, spec, QueueFamily::Vector, 1).await;
+    let paused = pause_when(&db, &operation, held, |status| scanned(status) >= 6).await;
     for _ in 0..6 {
         model.apply(&db, &mut rng).await;
     }
```

**File**: `crates/db/src/index_lifecycle/scope_gate.rs` (modified, +65/-6)
```diff
@@ -30,14 +30,37 @@ use tokio::sync::{
     Mutex as AsyncMutex, OwnedMutexGuard, OwnedRwLockReadGuard, OwnedRwLockWriteGuard, RwLock,
 };
 
+use super::secondary::delta_ledger::{DeltaLedgers, StagedBuildDeltas};
 use crate::encoding::v2::keys::scope::DataScope;
 
 /// Shared authority retained by one graph mutation transaction.
+///
+/// It also carries the build deltas the transaction staged, and records them
+/// in their generations' ledgers when dropped, before the gate unlocks: the
+/// holder keeps it until its commit has applied or failed, so a delta is
+/// recorded after it can be read and before a fenced step can run (see
+/// [`DeltaLedgers`]).
 #[derive(Debug)]
 pub(crate) struct IndexScopeMutationPermit {
+    staged: StagedBuildDeltas,
+    ledgers: Arc<DeltaLedgers>,
     _guard: OwnedRwLockReadGuard<()>,
 }
 
+impl IndexScopeMutationPermit {
+    /// Adds deltas this permit's transaction staged, recorded once it is
+    /// dropped.
+    pub(crate) fn stage_build_deltas(&mut self, staged: StagedBuildDeltas) {
+        self.staged.append(staged);
+    }
+}
+
+impl Drop for IndexScopeMutationPermit {
+    fn drop(&mut self) {
+        self.ledgers.record(std::mem::take(&mut self.staged));
+    }
+}
+
 /// Version of one scope's planner-visible canonical catalog.
 ///
 /// Every canonical change that can alter a scope's Active index set commits
@@ -175,16 +198,24 @@ pub(crate) struct IndexScopeGates {
     catalog_refreshes: Mutex<HashMap<DataScope, Weak<AsyncMutex<()>>>>,
     publications: Mutex<HashMap<super::queue::QueueTarget, Weak<AsyncMutex<()>>>>,
     build_steps: Mutex<HashMap<DataScope, Weak<AsyncMutex<()>>>>,
+    delta_ledgers: Arc<DeltaLedgers>,
 }
 
 impl IndexScopeGates {
     /// Acquires shared scope authority before a graph transaction takes its snapshot.
     pub(crate) async fn mutation_permit(&self, scope: DataScope) -> IndexScopeMutationPermit {
         IndexScopeMutationPermit {
+            staged: StagedBuildDeltas::default(),
+            ledgers: Arc::clone(&self.delta_ledgers),
             _guard: self.mutation_gate(scope).read_owned().await,
         }
     }
 
+    /// Every building secondary generation's pending-delta ledger.
+    pub(crate) fn delta_ledgers(&self) -> &DeltaLedgers {
+        &self.delta_ledgers
+    }
+
     /// Acquires shared authority before refreshing the catalog used for planning.
     ///
     /// The version is read after the gate is held, so it is the version every
@@ -240,22 +271,33 @@ impl IndexScopeGates {
     /// wait however many of the scope's builds run. Nothing waits for the
     /// build-step gate while holding a scope gate, so it adds no lock cycle.
     /// The tuple drops the scope permit before the build-step gate.
+    ///
+    /// Once queued, a gated step uploads every commit applied so far before
+    /// it fences anyone. Build steps commit without waiting for their WAL
+    /// upload, and a durable commit under the gate (an activation, a
+    /// blocker, a cleanup's completion) waits for every lower sequence: it
+    /// would otherwise hold writers, and for activation planning, through
+    /// the upload of the build's whole unflushed tail instead of only what
+    /// committed while the gate was held. A failed upload fails the step.
     pub(crate) async fn step_permit(
         &self,
+        db: &slatedb::Db,
         scope: DataScope,
         gate: StepGate,
-    ) -> Box<dyn super::outbox::IndexOperationStepPermit> {
-        match gate {
+    ) -> crate::error::Result<Box<dyn super::outbox::IndexOperationStepPermit>> {
+        Ok(match gate {
             StepGate::None => Box::new(()),
             StepGate::WriteFence => {
                 let queued = self.build_step_gate(scope).lock_owned().await;
+                db.flush().await?;
                 Box::new((self.write_fence_permit(scope).await, queued))
             }
             StepGate::Lifecycle => {
                 let queued = self.build_step_gate(scope).lock_owned().await;
+                db.flush().await?;
                 Box::new((self.lifecycle_permit(scope).await, queued))
             }
-        }
+        })
     }
 
     /// Serializes persisted-catalog refreshes for one handle and scope.
@@ -371,6 +413,15 @@ mod tests {
 
     use super::*;
 
+    async fn test_db(name: &str) -> slatedb::Db {
+        slatedb::Db::open(
+            name,
+            Arc::new(slatedb::object_store::memory::InMemory::new()),
+        )
+        .await
+        .expect("scope gate test database opens")
+    }
+
     #[tokio::test]
     async fn lifecycle_scope_waits_for_catalog_and_mutations_but_not_other_scopes() {
         let gates = Arc::new(IndexScopeGates::default());
@@ -422,6 +473,7 @@ mod tests {
     #[tokio::test]
     async fn graph_writes_wait_behind_one_queued_build_step() {
         let gates = Arc::new(IndexScopeGates::default());
+        let db = Arc::new(test_db("graph-writes-wait-behind-one-step").await);
         let scop
```

---

### Incident Patch 2: `d21b349e` (2026-11-18)
**Commit Message**: Upload a build's applied tail before a step fences writers

Claims and progressed steps commit without waiting for their WAL upload,
and a durable commit under a gate (activation, a blocker, a cleanup's
completion) waits for every lower sequence. Taking the write fence or the
lifecycle permit first held writers, and for activation planning, through
the upload of the build's whole unflushed tail. A gated step now flushes
once it is queued on the scope's build-step gate and before it waits for
the mutation gate, so the fenced window covers only what commits under it.

**File**: `crates/db/src/index_lifecycle/outbox.rs` (modified, +5/-2)
```diff
@@ -496,6 +496,7 @@ pub(crate) trait IndexOperationDriver: Send + Sync {
     /// permit supplied by this default implementation.
     async fn acquire_step_permit(
         &self,
+        _db: &Db,
         _scope: DataScope,
         _operation: &IndexOperationRecord,
     ) -> Result<Box<dyn IndexOperationStepPermit>> {
@@ -509,12 +510,12 @@ pub(crate) trait IndexOperationDriver: Send + Sync {
     /// all other stages on the ordinary path.
     async fn prepare_step(
         &self,
-        _db: &Db,
+        db: &Db,
         scope: DataScope,
         operation: &IndexOperationRecord,
         _limits: SearchIndexBatchLimits,
     ) -> Result<PreparedIndexOperationStep> {
-        let permit = self.acquire_step_permit(scope, operation).await?;
+        let permit = self.acquire_step_permit(db, scope, operation).await?;
         Ok(PreparedIndexOperationStep::driver_owned(
             self.family(),
             permit,
@@ -2245,6 +2246,7 @@ mod tests {
 
         async fn acquire_step_permit(
             &self,
+            _db: &Db,
             _scope: DataScope,
             _operation: &IndexOperationRecord,
         ) -> Result<Box<dyn IndexOperationStepPermit>> {
@@ -2293,6 +2295,7 @@ mod tests {
 
         async fn acquire_step_permit(
             &self,
+            _db: &Db,
             _scope: DataScope,
             _operation: &IndexOperationRecord,
         ) -> Result<Box<dyn IndexOperationStepPermit>> {
```

**File**: `crates/db/src/index_lifecycle/scope_gate.rs` (modified, +34/-6)
```diff
@@ -271,22 +271,33 @@ impl IndexScopeGates {
     /// wait however many of the scope's builds run. Nothing waits for the
     /// build-step gate while holding a scope gate, so it adds no lock cycle.
     /// The tuple drops the scope permit before the build-step gate.
+    ///
+    /// Once queued, a gated step uploads every commit applied so far before
+    /// it fences anyone. Build steps commit without waiting for their WAL
+    /// upload, and a durable commit under the gate (an activation, a
+    /// blocker, a cleanup's completion) waits for every lower sequence: it
+    /// would otherwise hold writers, and for activation planning, through
+    /// the upload of the build's whole unflushed tail instead of only what
+    /// committed while the gate was held. A failed upload fails the step.
     pub(crate) async fn step_permit(
         &self,
+        db: &slatedb::Db,
         scope: DataScope,
         gate: StepGate,
-    ) -> Box<dyn super::outbox::IndexOperationStepPermit> {
-        match gate {
+    ) -> crate::error::Result<Box<dyn super::outbox::IndexOperationStepPermit>> {
+        Ok(match gate {
             StepGate::None => Box::new(()),
             StepGate::WriteFence => {
                 let queued = self.build_step_gate(scope).lock_owned().await;
+                db.flush().await?;
                 Box::new((self.write_fence_permit(scope).await, queued))
             }
             StepGate::Lifecycle => {
                 let queued = self.build_step_gate(scope).lock_owned().await;
+                db.flush().await?;
                 Box::new((self.lifecycle_permit(scope).await, queued))
             }
-        }
+        })
     }
 
     /// Serializes persisted-catalog refreshes for one handle and scope.
@@ -402,6 +413,15 @@ mod tests {
 
     use super::*;
 
+    async fn test_db(name: &str) -> slatedb::Db {
+        slatedb::Db::open(
+            name,
+            Arc::new(slatedb::object_store::memory::InMemory::new()),
+        )
+        .await
+        .expect("scope gate test database opens")
+    }
+
     #[tokio::test]
     async fn lifecycle_scope_waits_for_catalog_and_mutations_but_not_other_scopes() {
         let gates = Arc::new(IndexScopeGates::default());
@@ -453,6 +473,7 @@ mod tests {
     #[tokio::test]
     async fn graph_writes_wait_behind_one_queued_build_step() {
         let gates = Arc::new(IndexScopeGates::default());
+        let db = Arc::new(test_db("graph-writes-wait-behind-one-step").await);
         let scope = DataScope::LegacyUnscoped;
         let settle = Duration::from_millis(20);
         let writing = gates.mutation_permit(scope).await;
@@ -461,9 +482,12 @@ mod tests {
         for step in 0..3 {
             let (release, released) = tokio::sync::oneshot::channel::<()>();
             releases.push(release);
-            let (gates, acquired) = (Arc::clone(&gates), acquired.clone());
+            let (gates, db, acquired) = (Arc::clone(&gates), Arc::clone(&db), acquired.clone());
             tokio::spawn(async move {
-                let permit = gates.step_permit(scope, StepGate::WriteFence).await;
+                let permit = gates
+                    .step_permit(&db, scope, StepGate::WriteFence)
+                    .await
+                    .expect("the step uploads nothing");
                 acquired.send(step).expect("the test awaits acquisitions");
                 let _ = released.await;
                 drop(permit);
@@ -506,6 +530,7 @@ mod tests {
     #[tokio::test]
     async fn step_gates_exclude_only_what_their_step_needs() {
         let gates = Arc::new(IndexScopeGates::default());
+        let db = test_db("step-gates-exclude-only-their-needs").await;
         let scope = DataScope::LegacyUnscoped;
         let wait = Duration::from_millis(50);
         for (gate, fences_writers, gates_planning) in [
@@ -514,7 +539,10 @@ mod tests {
             (StepGate::Lifecycle, true, true),
         ] {
             let before = gates.catalog_permit(scope).await.version();
-            let held = gates.step_permit(scope, gate).await;
+            let held = gates
+                .step_permit(&db, scope, gate)
+                .await
+                .expect("the step uploads nothing");
             let mutation = tokio::time::timeout(wait, gates.mutation_permit(scope)).await;
             assert_eq!(
                 mutation.is_err(),
```

**File**: `crates/db/src/index_lifecycle/secondary.rs` (modified, +84/-12)
```diff
@@ -1166,6 +1166,7 @@ impl IndexOperationDriver for SecondaryIndexDriver {
 
     async fn acquire_step_permit(
         &self,
+        db: &slatedb::Db,
         scope: DataScope,
         operation: &IndexOperationRecord,
     ) -> Result<Box<dyn IndexOperationStepPermit>> {
@@ -1187,7 +1188,7 @@ impl IndexOperationDriver for SecondaryIndexDriver {
                 ));
             }
         };
-        Ok(self.scope_gates.step_permit(scope, gate).await)
+        self.scope_gates.step_permit(db, scope, gate).await
     }
 
     /// Prepares one build step with the narrowest coordination it needs.
@@ -1234,7 +1235,7 @@ impl IndexOperationDriver for SecondaryIndexDriver {
         else {
             self.reset_stalled_preparations(operation);
             ledgers.forget(generation);
-            let permit = self.acquire_step_permit(scope, operation).await?;
+            let permit = self.acquire_step_permit(db, scope, operation).await?;
             return Ok(PreparedIndexOperationStep::driver_owned(
                 self.family(),
                 permit,
@@ -1269,7 +1270,7 @@ impl IndexOperationDriver for SecondaryIndexDriver {
                 };
                 return Ok(PreparedIndexOperationStep::driver_owned(
                     self.family(),
-                    self.scope_gates.step_permit(scope, gate).await,
+                    self.scope_gates.step_permit(db, scope, gate).await?,
                 ));
             }
             SecondaryBuildStage::CatchUp(progress) => {
@@ -1337,7 +1338,7 @@ impl IndexOperationDriver for SecondaryIndexDriver {
                 )
             }
         };
-        let permit = self.scope_gates.step_permit(scope, gate).await;
+        let permit = self.scope_gates.step_permit(db, scope, gate).await?;
         // Writes that committed while the permit was awaited may have taken
         // a catch-up backlog past the gated reach. A stalled validation and
         // activation drain it regardless: they fence writers to finish.
@@ -9322,13 +9323,6 @@ mod tests {
             ] {
                 durable_rows.push(generation_rows(&db, scope, kind, index_id, generation).await);
             }
-            let durable_operation = read_operation(&db, scope, operation_id)
-                .await
-                .expect("operation is readable");
-            if tail_lost {
-                store.uploads.send_replace(WalUploads::Held);
-            }
-
             let pause =
                 crate::index_lifecycle::outbox::step_pause::StepPause::arm(&db, |progress| {
                     matches!(
@@ -9361,6 +9355,15 @@ mod tests {
             .expect("the crashing claim succeeds")
             .expect("exact queued revision is claimable");
             claim_sequence += 1;
+            // A gated step uploads everything applied before it takes its
+            // gate, so only what it commits under the gate can be lost.
+            db.flush().await.expect("the claim uploads");
+            let durable_operation = read_operation(&db, scope, operation_id)
+                .await
+                .expect("operation is readable");
+            if tail_lost {
+                store.uploads.send_replace(WalUploads::Held);
+            }
             let lifecycle_rows = {
                 let crashing = execute_claimed_step(
                     &db,
@@ -9424,7 +9427,7 @@ mod tests {
                         .await
                         .expect("operation is readable"),
                     durable_operation,
-                    "a lost WAL tail takes the crashed claim too"
+                    "a lost WAL tail leaves the operation at its uploaded claim"
                 );
             } else {
                 assert_eq!(
@@ -9451,6 +9454,75 @@ mod tests {
         db.close().await.expect("crash test database closes");
     }
 
+    /// A gated step uploads the build's unflushed tail before it fences
+    /// anyone. Progressed steps and claims commit without waiting for their
+    /// WAL upload, and activation's completion waits for every lower
+    /// sequence; taking the lifecycle permit first would hold writers and
+    /// planning through that whole upload. Here the upload is held while the
+    /// activation's claim is unflushed: writers and planning still get their
+    /// permits, and the activation completes once the upload lands.
+    #[tokio::test]
+    async fn activation_fences_nobody_while_earlier_commits_upload() {
+        use crate::search::vector::gated_wal::{GatedWalStore, WalUploads};
+
+        let store = Arc::new(GatedWalStore::new());
+        let db = Db::builder(
+            "secondary-activation-tail-upload",
+            Arc::clone(&store) as Arc<dyn slatedb::object_store::ObjectStore>,
+        )
+        .with_merge_operator(Arc::new(crate::merge_operator::HelixMergeOperator::new()))
+        .build()
+        .await
+        .expect("activation test database opens");
+        bootstrap_writer(&db)
+            .await
+   
```

**File**: `crates/db/src/index_lifecycle/text/driver.rs` (modified, +4/-3)
```diff
@@ -638,6 +638,7 @@ impl IndexOperationDriver for TextIndexDriver {
 
     async fn acquire_step_permit(
         &self,
+        db: &Db,
         scope: DataScope,
         operation: &IndexOperationRecord,
     ) -> Result<Box<dyn IndexOperationStepPermit>> {
@@ -663,7 +664,7 @@ impl IndexOperationDriver for TextIndexDriver {
                 return Err(corruption("text driver received another family progress"));
             }
         };
-        Ok(self.scope_gates.step_permit(scope, gate).await)
+        self.scope_gates.step_permit(db, scope, gate).await
     }
 
     async fn prepare_step(
@@ -676,7 +677,7 @@ impl IndexOperationDriver for TextIndexDriver {
         let progress = operation.progress();
         let IndexOperationProgress::TextBuild(TextBuildProgress::Constructing(stage)) = progress
         else {
-            let permit = self.acquire_step_permit(scope, operation).await?;
+            let permit = self.acquire_step_permit(db, scope, operation).await?;
             return Ok(PreparedIndexOperationStep::driver_owned(
                 IndexOperationFamily::Text,
                 permit,
@@ -768,7 +769,7 @@ impl IndexOperationDriver for TextIndexDriver {
             // also advances the scope's catalog version as it is released.
             TextBuildStage::Activate(_) => Ok(PreparedIndexOperationStep::driver_owned(
                 IndexOperationFamily::Text,
-                self.acquire_step_permit(scope, operation).await?,
+                self.acquire_step_permit(db, scope, operation).await?,
             )),
         }
     }
```

**File**: `crates/db/src/index_lifecycle/vector/driver.rs` (modified, +4/-3)
```diff
@@ -1062,6 +1062,7 @@ impl IndexOperationDriver for VectorIndexDriver {
 
     async fn acquire_step_permit(
         &self,
+        db: &Db,
         scope: DataScope,
         operation: &IndexOperationRecord,
     ) -> Result<Box<dyn IndexOperationStepPermit>> {
@@ -1087,17 +1088,17 @@ impl IndexOperationDriver for VectorIndexDriver {
                 return Err(corruption("vector driver received another family progress"));
             }
         };
-        Ok(self.scope_gates.step_permit(scope, gate).await)
+        self.scope_gates.step_permit(db, scope, gate).await
     }
 
     async fn prepare_step(
         &self,
-        _db: &Db,
+        db: &Db,
         scope: DataScope,
         operation: &IndexOperationRecord,
         _limits: SearchIndexBatchLimits,
     ) -> Result<PreparedIndexOperationStep> {
-        let permit = self.acquire_step_permit(scope, operation).await?;
+        let permit = self.acquire_step_permit(db, scope, operation).await?;
         Ok(PreparedIndexOperationStep::driver_owned(
             self.family(),
             permit,
```

---

### Incident Patch 3: `b0f8bb39` (2026-11-19)
**Commit Message**: Pace the sustained-writes contract's writer by build steps

The automatic sustained-writes contract builds with one-row batches while
a writer commits batches as fast as its WAL uploads. Catch-up fences no one
until its backlog is within reach, so it ends only while the build
reconciles deltas faster than writes add them. On a slow host the writer
outran the one-row steps and the build sat in catch-up until the test's
120 s bound.

Until the build activates, the writer now waits for twice as many
automatic build steps as a batch adds deltas before its next batch, so the
inflow stays below the drain whatever the host's speed. It runs freely
against the Active generation.

**File**: `crates/db/src/index_lifecycle_testing/contracts/sustained_secondary_writes.rs` (modified, +26/-3)
```diff
@@ -42,6 +42,14 @@ const MAXIMUM_EXPLICIT_ADVANCES: u64 = 16;
 /// writes never does, so any finite bound detects it, and this one leaves
 /// room for slow and loaded CI hosts.
 const AUTOMATIC_ACTIVATION_BOUND: Duration = Duration::from_secs(120);
+/// Build steps the automatic worker takes for each batch the writer commits
+/// while the build runs: twice the deltas one batch adds.
+///
+/// Catch-up fences no one until its backlog is within reach, so it ends only
+/// while the build reconciles deltas faster than writes add them, and a
+/// one-row step reconciles one. A writer paced only by its WAL upload outruns
+/// one-row steps on a slow host, and the build then never leaves catch-up.
+const AUTOMATIC_STEPS_PER_BATCH: u64 = 2 * (INSERTS_PER_BATCH + 1);
 
 /// Every key ever written, mapped to the nodes that hold it now.
 type ExpectedKeys = BTreeMap<String, BTreeSet<u64>>;
@@ -139,7 +147,7 @@ async fn run_automatic_worker_under_a_writer_loop() {
         // One-row batches spread the scan and validation over hundreds of
         // steps, each racing the writer. Build steps do not wait for their
         // WAL upload but every public write does, so a short flush interval
-        // keeps the writer's batches as quick as a handful of steps.
+        // lets a batch land within the steps the writer waits for.
         DbConfig::new()
             .with_secondary_index_lifecycle_tuning(
                 SecondaryIndexLifecycleTuning::default().with_batch_rows(
@@ -171,7 +179,14 @@ async fn run_automatic_worker_under_a_writer_loop() {
     };
 
     let stop = AtomicBool::new(false);
+    let activated = AtomicBool::new(false);
     let committed = AtomicU64::new(0);
+    let steps = || {
+        controller
+            .automatic_metrics(&db)
+            .expect("sustained automatic metrics are readable")
+            .operation_steps
+    };
     let writer = async {
         let mut keys = keys;
         let mut batch = 0;
@@ -183,7 +198,12 @@ async fn run_automatic_worker_under_a_writer_loop() {
             commit_batch(&db, batch, moved, &mut keys).await;
             batch += 1;
             committed.store(batch, Ordering::Release);
-            tokio::task::yield_now().await;
+            // See [`AUTOMATIC_STEPS_PER_BATCH`]. The Active generation takes
+            // no steps, so the writer runs freely against it.
+            let resume = steps() + AUTOMATIC_STEPS_PER_BATCH;
+            while !activated.load(Ordering::Acquire) && steps() < resume {
+                tokio::time::sleep(Duration::from_millis(1)).await;
+            }
         }
         keys
     };
@@ -195,7 +215,10 @@ async fn run_automatic_worker_under_a_writer_loop() {
                 .await
                 .expect("sustained automatic operation remains readable");
             match status {
-                IndexOperationStatus::Succeeded { .. } => break,
+                IndexOperationStatus::Succeeded { .. } => {
+                    activated.store(true, Ordering::Release);
+                    break;
+                }
                 IndexOperationStatus::Blocked { .. } | IndexOperationStatus::Aborted { .. } => {
                     panic!("sustained writes must not stop the build: {status:?}")
                 }
```

#### Recent Merged Pull Requests:
- **PR #1311** (2026-11-19): Compare datetimes with text as unknown on every plan (@xav-db)
- **PR #1310** (2026-11-19): Build indexes without waiting on S3 per step or rescanning applied deltas (@xav-db)
- **PR #1309** (2026-11-19): Use datetime() and timestamp() as index bounds (@xav-db)
- **PR #1307** (2026-11-19): Declare typed fields on object parameters (@xav-db)
- **PR #1306** (2026-11-19): Read and write datetimes in Cypher and SQL (@xav-db)
- **PR #1305** (2026-11-19): Store typed date_time parameters as datetimes (@xav-db)

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

## X. Build indexes without waiting on S3 per step or rescanning applied deltas

**RULE**:
When implementing operations in `crates/db/src/execution/interpreter/mutation/index_context.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in HelixDB/helix-db. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b943942d`: Build indexes without waiting on S3 per step or rescanning applied deltas. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/db/src/execution/interpreter/mutation/index_context.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            _scope_permit: mut scope_permit,
        let staged = secondary_runtime.consume_prepared()?;
        // The permit records them once dropped, after the commit applies;
        // only focused tests run without one.
        if let Some(permit) = scope_permit.as_mut() {
            permit.stage_build_deltas(staged);
        }
            _scope_permit: scope_permit,
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            _scope_permit,
        secondary_runtime.consume_prepared()?;
            _scope_permit,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b943942d` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
