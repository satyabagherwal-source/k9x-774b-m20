# Forensic Learning Record (Deep Inspection): databendlabs/databend

> **Canonical Artifact**: `07_PROJECT_LEARNING/databendlabs-databend-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/databendlabs/databend](https://github.com/databendlabs/databend))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:23.744Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `databendlabs/databend`
- **Description**: Data Agent Ready Warehouse : One for  Analytics, Search, AI, Python Sandbox.  — rebuilt from scratch. Unified architecture on your S3.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 9456 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmark/benchmark_cloud_load.py`
```
#!/usr/bin/env python3
"""Databend Cloud load benchmark runner backed by bendsql."""

import json
import logging
import os
import shutil
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


@dataclass
class BenchmarkConfig:
    benchmark_id: str
    dataset: str
    size: str
    cache_size: str
    version: str
    database: str
    tries: int
    user: str
    password: str
    gateway: str
    warehouse: str
    source: str
    source_id: str
    sha: str


@dataclass
class ResultRecord:
    date: str
    dataset: str
    database: str
    version: str
    warehouse: str
    machine: str
    tags: List[str]
    result: List[List[float]]
    values: Dict[str, List[float]]
    run_id: str
    size: str
    tries: int
    storage: str
    cache_size: str
    load_time: Optional[float] = None
    data_size: Optional[int] = None
    system: Optional[str] = None
    comment: Optional[str] = None


class BendSQLRunner:
    def __init__(self) -> None:
        self._env = os.environ.copy()

    def set_dsn(self, dsn: str) -> None:
        self._env["BENDSQL_DSN"] = dsn
        logger.debug("Using DSN: %s", dsn)

    def run(
        self,
        args: Optional[List[str]] = None,
        *,
        sql: Optional[str] = None,
        capture_output: bool = False,
    ) -> subprocess.CompletedProcess:
        command = ["bendsql"] + (args or [])
        logger.debug("Running command: %s", " ".join(command))
        try:
            result = subprocess.run(
                command,
                input=sql,
                text=True,
                env=self._env,
                capture_output=True,  # Always capture output
                check=True,
            )
            # If not capturing output, print it to stdout/stderr
            if not capture_output:
                if result.stdout:
                    print(result.stdout, end="", file=sys.stdout, flush=True)
                if result.stderr:
                    print(result.stderr, end="", file=sys.stderr, flush=True)
            return result
        except subprocess.CalledProcessError as exc:  # pragma: no cover - passthrough
            stdout = exc.stdout.strip() if exc.stdout else ""
            stderr = exc.stderr.strip() if exc.stderr else ""
            logger.error("bendsql failed: %s", stderr or stdout)
            raise


def load_config() -> BenchmarkConfig:
    benchmark_id = os.environ.get("BENCHMARK_ID", str(int(time.time())))
    dataset = os.environ.get("BENCHMARK_DATASET", "load")
    size = os.environ.get("BENCHMARK_SIZE", "Small")
    raw_cache_size = os.environ.get("BENCHMARK_CACHE_SIZE", "")
    cache_size = raw_cache_size.strip() or "0"
    version = os.environ.get("BENCHMARK_VERSION", "")
    database = os.environ.get("BENCHMARK_DATABASE", "default")
    tries_raw = os.environ.get("BENCHMARK_TRIES", "3")
    source = os.environ.get("BENCHMARK_SOURCE", "")
    source_id = os.environ.get("BENCHMARK_SOURCE_ID", "")
    sha = os.environ.get("BENCHMARK_SHA", "")

    if dataset != "load":
        logger.error("benchmark_cloud_load.py only supports BENCHMARK_DATASET=load")
        sys.exit(1)
    if not version:
        logger.error("Please set BENCHMARK_VERSION to run the benchmark.")
        sys.exit(1)

    try:
        tries = int(tries_raw)
    except ValueError:
        logger.error("BENCHMARK_TRIES must be an integer, got %s", tries_raw)
        sys.exit(1)

    if not 1 <= tries <= 3:
        logger.error("BENCHMARK_TRIES must be between 1 and 3, got %s", tries)
        sys.exit(1)

    user = os.environ.get("CLOUD_USER", "")
    password = os.environ.get("CLOUD_PASSWORD", "")
    gateway = os.environ.get("CLOUD_GATEWAY", "")
    warehouse = os.environ.get("CLOUD_WAREHOUSE", f"benchmark-{benchmark_id}")

    if not user or not password or not gateway:
        logger.error(
            "Please set CLOUD_USER, CLOUD_PASSWORD and CLOUD_GATEWAY to run the benchmark.",
        )
        sys.exit(1)

    return BenchmarkConfig(
        benchmark_id=benchmark_id,
        dataset=dataset,
        size=size,
        cache_size=cache_size,
        version=version,
        database=database,
        tries=tries,
        user=user,
        password=password,
        gateway=gateway,
        warehouse=warehouse,
        source=source,
        source_id=source_id,
        sha=sha,
    )


def ensure_dependencies() -> None:
    if not shutil.which("bendsql"):
        logger.error("bendsql is required but was not found in PATH.")
        sys.exit(1)
    logger.info("Checking script dependencies...")
    logger.info("bendsql version: %s", subprocess.check_output(["bendsql", "--version"]).decode().strip())


SIZE_MAPPING: Dict[str, str] = {
    "Small": "Small",
    "Large": "Large",
}


def build_dsn(
    config: BenchmarkConfig,
    *,
    database: Optional[str] = None,
    warehouse: Optional[str] = None,
    login_disable: bool = False,
) -> str:
    params = []
    if login_disable:
        params.append("login=disable")
    if warehouse:
        params.append(f"warehouse={warehouse}")
    query = f"?{'&'.join(params)}" if params else ""
    db_path = f"/{database}" if database else ""
    return f"databend://{config.user}:{config.password}@{config.gateway}:443{db_path}{query}"


def quote_literal(value: str) -> str:
    return value.replace("'", "''")


def wait_for_warehouse(runner: BendSQLRunner, warehouse: str, retries: int = 20, delay: int = 10) -> None:
    logger.info("Waiting for warehouse %s to be ready...", warehouse)
    for attempt in range(retries + 1):
        completed = runner.run(
            ["--output", "csv"],
            sql=f"SHOW WAREHOUSES LIKE '{quote_literal(warehouse)}'",
            capture_output=True,
        )
        output = completed.stdout.strip()
        if output and "Running" in output:
            logger.info("Warehouse %s is running.", warehouse)
            return
        logger.info("Warehouse not ready yet. Sleeping %s seconds...", delay)
        time.sleep(delay)
    logger.error("Failed to start warehouse %s in time.", warehouse)
    sys.exit(1)


def execute_sql_file(runner: BendSQLRunner, path: Path) -> None:
    sql = path.read_text()
    if sql.strip():
        runner.run(sql=sql)


def parse_time_output(raw_value: str) -> Optional[float]:
    # --time=server outputs only the time value (e.g., "0.014")
    value = raw_value.strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def run_timed_query(runner: BendSQLRunner, sql: str) -> Optional[float]:
    completed = runner.run(["--time=server"], sql=sql, capture_output=True)
    output = completed.stdout.strip()
    return parse_time_output(output)


def pad_attempts(values: List[float], target_size: int) -> None:
    if not values:
        return
    while len(values) < target_size:
        values.append(values[-1])


def write_result_files(script_dir: Path, record: ResultRecord) -> None:
    result_path = script_dir / "result.json"
    cache_suffix = f"-cache-{record.cache_size}" if record.cache_size else ""
    final_result_path = script_dir / f"result-{record.dataset}-cloud-{record.size}{cache_suffix}.json"
    ndjson_name = (
        f"result-{record.dataset}-cloud-{record.size}{cache_suffix}"
        f"-{record.run_id}.ndjson"
    )
    ndjson_path = script_dir / ndjson_name
    payload = {key: value for key, value in asdict(record).items() if value is not None}

    result_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    final_result_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    ndjson_path.write_text(json.dumps(payload) + "\n", encoding="utf-8")

    logger.info("Wrote JSON results to %s and %s", result_path, f
```

### Core Architecture Module: `benchmark/src/bin/benchmark_cloud.rs`
```
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::time::Duration;
use std::time::Instant;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;

use anyhow::anyhow;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use chrono::Utc;
use databend_driver::Client;
use databend_driver::Connection;
use databend_driver::RowWithStats;
use databend_driver::ServerStats;
use serde::Serialize;
use tokio::sync::mpsc;
use tokio::sync::oneshot;
use tokio::task::JoinHandle;
use tokio_stream::StreamExt;

#[derive(Debug)]
struct BenchmarkConfig {
    benchmark_id: String,
    dataset: String,
    size: String,
    cache_size: String,
    version: String,
    database: String,
    tries: usize,
    user: String,
    password: String,
    gateway: String,
    warehouse: String,
    source: String,
    source_id: String,
    sha: String,
}

#[derive(Serialize)]
struct ResultRecord {
    date: String,
    dataset: String,
    database: String,
    version: String,
    warehouse: String,
    machine: String,
    tags: Vec<String>,
    result: Vec<Vec<f64>>,
    values: BTreeMap<String, Vec<f64>>,
    run_id: String,
    size: String,
    tries: usize,
    storage: String,
    cache_size: String,
    runner: String,
    timing_source: String,
    detail_sources: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    load_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    data_size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    comment: Option<String>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    query_details: BTreeMap<String, Vec<QueryAttempt>>,
}

#[derive(Clone, Serialize)]
struct ServerStatsRecord {
    total_rows: usize,
    total_bytes: usize,
    read_rows: usize,
    read_bytes: usize,
    write_rows: usize,
    write_bytes: usize,
    running_time_ms: f64,
    spill_file_nums: usize,
    spill_bytes: usize,
}

#[derive(Serialize)]
struct SystemHistoryRecord {
    #[serde(skip_serializing_if = "Option::is_none")]
    query_history: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    profile_history: Vec<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    profile_statistics_desc: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct QueryAttempt {
    attempt: usize,
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    elapsed_seconds: Option<f64>,
    client_wall_ms: u128,
    #[serde(skip_serializing_if = "Option::is_none")]
    query_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    server_stats: Option<ServerStatsRecord>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    stats_samples: Vec<ServerStatsRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system_history: Option<SystemHistoryRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

struct QueryAttemptWithHistory {
    attempt: QueryAttempt,
    history_receiver: Option<oneshot::Receiver<SystemHistoryRecord>>,
}

struct HistoryRequest {
    query_id: String,
    response: oneshot::Sender<SystemHistoryRecord>,
}

struct HistoryCollector {
    sender: mpsc::UnboundedSender<HistoryRequest>,
    worker: JoinHandle<()>,
}

fn env_or_default(name: &str, default: &str) -> String {
    env::var(name).unwrap_or_else(|_| default.to_string())
}

fn load_config() -> Result<BenchmarkConfig> {
    let benchmark_id = env::var("BENCHMARK_ID").unwrap_or_else(|_| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            .to_string()
    });
    let dataset = env_or_default("BENCHMARK_DATASET", "hits");
    let size = env_or_default("BENCHMARK_SIZE", "Small");
    let cache_size = env::var("BENCHMARK_CACHE_SIZE")
        .unwrap_or_default()
        .trim()
        .to_string();
    let cache_size = if cache_size.is_empty() {
        "0".to_string()
    } else {
        cache_size
    };
    let version = env_or_default("BENCHMARK_VERSION", "");
    let database = env_or_default("BENCHMARK_DATABASE", "default");
    let tries_raw = env_or_default("BENCHMARK_TRIES", "3");
    let source = env_or_default("BENCHMARK_SOURCE", "");
    let source_id = env_or_default("BENCHMARK_SOURCE_ID", "");
    let sha = env_or_default("BENCHMARK_SHA", "");

    if version.is_empty() {
        bail!("Please set BENCHMARK_VERSION to run the benchmark.");
    }
    if dataset == "load" {
        bail!("BENCHMARK_DATASET=load is not supported by benchmark-cloud");
    }

    let tries: usize = tries_raw
        .parse()
        .with_context(|| format!("BENCHMARK_TRIES must be an integer, got {tries_raw}"))?;
    if !(1..=3).contains(&tries) {
        bail!("BENCHMARK_TRIES must be between 1 and 3, got {tries}");
    }

    let user = env_or_default("CLOUD_USER", "");
    let password = env_or_default("CLOUD_PASSWORD", "");
    let gateway = env_or_default("CLOUD_GATEWAY", "");
    let warehouse =
        env::var("CLOUD_WAREHOUSE").unwrap_or_else(|_| format!("benchmark-{benchmark_id}"));

    if user.is_empty() || password.is_empty() || gateway.is_empty() {
        bail!("Please set CLOUD_USER, CLOUD_PASSWORD and CLOUD_GATEWAY to run the benchmark.");
    }

    Ok(BenchmarkConfig {
        benchmark_id,
        dataset,
        size,
        cache_size,
        version,
        database,
        tries,
        user,
        password,
        gateway,
        warehouse,
        source,
        source_id,
        sha,
    })
}

fn build_dsn(
    config: &BenchmarkConfig,
    database: Option<&str>,
    warehouse: Option<&str>,
    login_disable: bool,
) -> String {
    let mut params = Vec::new();
    if login_disable {
        params.push("login=disable".to_string());
    }
    if let Some(warehouse) = warehouse {
        params.push(format!("warehouse={warehouse}"));
    }
    let query = if params.is_empty() {
        String::new()
    } else {
        format!("?{}", params.join("&"))
    };
    let db_path = database.map(|db| format!("/{db}")).unwrap_or_default();
    format!(
        "databend://{}:{}@{}:443{}{}",
        config.user, config.password, config.gateway, db_path, query
    )
}

fn quote_literal(value: &str) -> String {
    value.replace('\'', "''")
}

fn resolve_sql_dataset(dataset: &str) -> &str {
    let trimmed = dataset.trim_end_matches(|ch: char| ch.is_ascii_digit());
    if trimmed.is_empty() {
        dataset
    } else {
        trimmed
    }
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

fn machine_for_size(size: &str) -> Result<&'static str> {
    match size {
        "Small" => Ok("Small"),
        "Large" => Ok("Large"),
        _ => bail!("Unsupported benchmark size: {size}"),
    }
}

fn stats_record(stats: &ServerStats) -> ServerStatsRecord {
    ServerStatsRecord {
        total_rows: stats.total_rows,
        total_bytes: stats.total_bytes,
        read_rows: stats.read_rows,
        read_bytes: stats.read_bytes,
        write_rows: stats.write_rows,
        write_bytes: stats.write_bytes,
        running_time_ms: stats.running_time_ms,
        spill_file_nums: stats.spill_file_nums,
        spill_bytes: stats.spill_bytes,
    }
}

async fn connect(dsn: String) -> Result<Connection> {
    Client::new(dsn)
        .with_name("databend-benchmark-cloud/0.1".to_string())
        .get_conn()
        .await
        .context("failed to connect Databend")
}

async fn execute_sql(conn: &Connection, sql: &str) -> Result<()> {
    for statement in split_sql_statements(sql) {
        let mut rows = conn.query_iter_ext(&statement).await?;
        while let Some(item) = rows.next().await {
            item?;
        }
    }
    Ok(())
}


```

### Core Architecture Module: `benchmark/update_results.py`
```
#!/usr/bin/env python3
# coding: utf-8


import json
import glob
import logging
import argparse
import base64
import gzip

from jinja2 import Environment, FileSystemLoader

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
TEMPLATE_FILE = "index.jinja"


def update_results(dataset, title, url):
    queries = []
    for query_file in sorted(glob.glob(f"{dataset}/queries/*.sql")):
        with open(query_file, "r") as f:
            queries.append(f.read())
    results = []
    for result_file in glob.glob(f"results/{dataset}/**/*.json", recursive=True):
        logger.info(f"reading result: {result_file}...")
        with open(result_file, "r") as f:
            results.append(json.load(f))

    results_json = json.dumps(results, ensure_ascii=False, separators=(",", ":"))
    results_gzip_base64 = base64.b64encode(
        gzip.compress(results_json.encode("utf-8"), mtime=0)
    ).decode("ascii")

    logger.info("loading report template %s ...", TEMPLATE_FILE)
    templateLoader = FileSystemLoader(searchpath="./")
    templateEnv = Environment(loader=templateLoader)
    template = templateEnv.get_template(TEMPLATE_FILE)
    logger.info("rendering result with args: %s ...", args)
    outputText = template.render(
        dataset=dataset,
        title=title,
        url=url,
        queries=queries,
        results_gzip_base64=results_gzip_base64,
    )
    with open(f"results/{dataset}.html", "w") as f:
        f.write(outputText)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="generate html results")
    parser.add_argument("--dataset", required=True, help="dataset name")
    parser.add_argument("--pr", help="benchmark pull request number")
    parser.add_argument("--release", help="benchmark release tag")
    args = parser.parse_args()

    title = f"ClickBench - {args.dataset} - "
    url = "https://github.com/datafuselabs/databend/"
    if args.pr:
        title += f"PR #{args.pr}"
        url += f"pull/{args.pr}"
    elif args.release:
        title += f"Release {args.release}"
        url += f"releases/tag/{args.release}"
    else:
        raise Exception("either --pr or --release is required")
    update_results(args.dataset, title, url)

```

### Core Architecture Module: `benchmark/wait_tcp.py`
```
#!/usr/bin/env python3
# coding: utf-8

import socket
import argparse
import time
import sys


def tcp_ping(port, timeout):
    now = time.time()
    while time.time() - now < timeout:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.connect(("0.0.0.0", port))
                print(f"OK :{port} is listening")
                sys.stdout.flush()
                return
        except Exception:
            print(f"... connecting to :{port}")
            sys.stdout.flush()
            time.sleep(1)
    raise Exception(f"failed connecting to :{port}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="block until successfully connected to a local tcp port"
    )
    parser.add_argument("-p", "--port", type=int, help="local tcp port")
    parser.add_argument("-t", "--timeout", type=int, default=10, help="time to wait.")
    args = parser.parse_args()
    tcp_ping(args.port, args.timeout)

```

### Core Architecture Module: `scripts/bench_common/__init__.py`
```
#!/usr/bin/env python3
"""Shared benchmark utilities for Databend benchmark scripts."""

from scripts.bench_common.bendsql import BendSQL
from scripts.bench_common.bendsql import QueryResult
from scripts.bench_common.bendsql import csv_records
from scripts.bench_common.bendsql import kv_map
from scripts.bench_common.runner import CONFIG_DIR
from scripts.bench_common.runner import ROOT
from scripts.bench_common.runner import find_meta_bin
from scripts.bench_common.runner import start_process
from scripts.bench_common.runner import start_services
from scripts.bench_common.runner import stop_existing
from scripts.bench_common.runner import terminate
from scripts.bench_common.runner import wait_tcp

__all__ = [
    "BendSQL",
    "QueryResult",
    "csv_records",
    "kv_map",
    "CONFIG_DIR",
    "ROOT",
    "find_meta_bin",
    "start_process",
    "start_services",
    "stop_existing",
    "terminate",
    "wait_tcp",
]

```

### Core Architecture Module: `scripts/bench_common/bendsql.py`
```
#!/usr/bin/env python3
"""Common benchmark utilities shared across benchmark scripts."""

from __future__ import annotations

import csv
import shlex
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Any


@dataclass
class QueryResult:
    label: str
    sql: str
    elapsed_sec: float
    stdout: str
    stderr: str


class BendSQL:
    def __init__(self, binary: str, dsn: str | None, dry_run: bool) -> None:
        self.binary = binary
        self.dsn = dsn
        self.dry_run = dry_run

    def run(
        self, sql: str, label: str, output: str = "csv", echo_stdout: bool = True
    ) -> QueryResult:
        cmd = [self.binary, "--output", output, f"--query={sql}"]
        if self.dsn:
            cmd[1:1] = ["--dsn", self.dsn]

        printable = " ".join(shlex.quote(part) for part in cmd)
        print(f"\n[{label}] {printable}", flush=True)
        start = time.monotonic()
        if self.dry_run:
            return QueryResult(label, sql, 0.0, "", "")

        proc = subprocess.run(cmd, text=True, capture_output=True)
        elapsed = time.monotonic() - start
        if proc.returncode != 0:
            print(proc.stdout, end="", file=sys.stdout)
            print(proc.stderr, end="", file=sys.stderr)
            raise RuntimeError(f"bendsql failed for {label}, exit={proc.returncode}")
        if echo_stdout and proc.stdout.strip():
            print(proc.stdout.strip(), flush=True)
        if proc.stderr.strip():
            print(proc.stderr.strip(), file=sys.stderr, flush=True)
        return QueryResult(label, sql, elapsed, proc.stdout, proc.stderr)

    def try_run(
        self, sql: str, label: str, output: str = "csv", echo_stdout: bool = True
    ) -> QueryResult:
        try:
            return self.run(sql, label, output, echo_stdout)
        except RuntimeError as err:
            print(f"[{label}] skipped: {err}", file=sys.stderr, flush=True)
            return QueryResult(label, sql, 0.0, "", str(err))

    def run_time_server(self, sql: str, label: str) -> float | None:
        """Run query with --time=server, return server-side duration in seconds."""
        cmd = [self.binary, "--time=server", f"--query={sql}"]
        if self.dsn:
            cmd[1:1] = ["--dsn", self.dsn]
        if self.dry_run:
            return None
        proc = subprocess.run(cmd, text=True, capture_output=True)
        if proc.returncode != 0:
            return None
        try:
            return float(proc.stdout.strip())
        except ValueError:
            return None


def csv_records(stdout: str) -> list[list[str]]:
    text = stdout.strip()
    if not text:
        return []
    return list(csv.reader(text.splitlines()))


def kv_map(stdout: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for row in csv_records(stdout):
        if len(row) >= 2:
            out[row[0]] = row[1]
    return out

```

### Core Architecture Module: `scripts/bench_common/runner.py`
```
#!/usr/bin/env python3
"""Common runner utilities for starting/stopping Databend services."""

from __future__ import annotations

import signal
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = ROOT / "scripts/ci/deploy/config"


def find_meta_bin() -> Path:
    for path in (ROOT / "target/release/databend-meta", ROOT / "target/debug/databend-meta"):
        if path.exists():
            return path
    raise FileNotFoundError("databend-meta not found in target/release or target/debug")


def wait_tcp(port: int, timeout: int = 60) -> None:
    subprocess.run(
        [sys.executable, str(ROOT / "scripts/ci/wait_tcp.py"), "--timeout", str(timeout), "--port", str(port)],
        check=True,
    )


def stop_existing() -> None:
    subprocess.run(["killall", "databend-query"], check=False)
    subprocess.run(["killall", "databend-meta"], check=False)
    time.sleep(1)
    subprocess.run(["killall", "-9", "databend-query"], check=False)
    subprocess.run(["killall", "-9", "databend-meta"], check=False)
    time.sleep(1)


def start_process(cmd: list[str], log: Path) -> subprocess.Popen[str]:
    log.parent.mkdir(parents=True, exist_ok=True)
    fd = log.open("w", encoding="utf-8")
    return subprocess.Popen(cmd, cwd=ROOT, stdout=fd, stderr=subprocess.STDOUT, text=True)


def terminate(proc: subprocess.Popen[str] | None) -> None:
    if proc is None or proc.poll() is not None:
        return
    proc.send_signal(signal.SIGTERM)
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=10)


def start_services(
    query_bin: Path,
    meta_bin: Path,
    work_dir: Path,
) -> tuple[subprocess.Popen[str], subprocess.Popen[str]]:
    """Start meta + query services, return (meta_proc, query_proc)."""
    import shutil

    logs = work_dir / "logs"
    data = work_dir / "data"

    stop_existing()
    if work_dir.exists():
        shutil.rmtree(work_dir)
    logs.mkdir(parents=True, exist_ok=True)
    data.mkdir(parents=True, exist_ok=True)

    meta_proc = start_process(
        [
            str(meta_bin),
            "-c", str(CONFIG_DIR / "databend-meta-node-1.toml"),
            "--raft-dir", str(data / "meta"),
            "--log-dir", str(logs / "meta"),
        ],
        logs / "meta.out",
    )
    wait_tcp(9191)

    query_proc = start_process(
        [
            str(query_bin),
            "-c", str(CONFIG_DIR / "databend-query-node-1.toml"),
            "--internal-enable-sandbox-tenant",
        ],
        logs / "query.out",
    )
    wait_tcp(8000)

    return meta_proc, query_proc

```

### Core Architecture Module: `scripts/benchmark/analyze_frequency_stats_bench.py`
```
#!/usr/bin/env python3
"""
Local benchmark for ANALYZE TABLE frequency statistics.

The script creates a synthetic FUSE table with uniform, single-hot skewed, and
wide-hot columns, runs ANALYZE with TopN and count-min sketch disabled/enabled
in isolation and together, samples databend-query RSS while ANALYZE is running,
and compares optimizer EXPLAIN cardinality estimates with exact counts by
q-error.

It is intended for local experiments and is not part of the CI test suite.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shlex
import subprocess
import sys
import time
from collections.abc import Callable
from dataclasses import asdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.bench_common.bendsql import BendSQL
from scripts.benchmark.analyze_histogram_bench import AccuracyResult
from scripts.benchmark.analyze_histogram_bench import AnalyzeResult
from scripts.benchmark.analyze_histogram_bench import DEFAULT_LOCAL_DSN
from scripts.benchmark.analyze_histogram_bench import Probe
from scripts.benchmark.analyze_histogram_bench import build_bendsql_cmd
from scripts.benchmark.analyze_histogram_bench import cardinality_q_error
from scripts.benchmark.analyze_histogram_bench import discover_query_pids
from scripts.benchmark.analyze_histogram_bench import exact_counts
from scripts.benchmark.analyze_histogram_bench import fq_table
from scripts.benchmark.analyze_histogram_bench import probe_distribution
from scripts.benchmark.analyze_histogram_bench import quote_ident
from scripts.benchmark.analyze_histogram_bench import run_measured_sql
from scripts.benchmark.analyze_histogram_bench import run_sql
from scripts.benchmark.analyze_histogram_bench import safe_label
from scripts.benchmark.analyze_histogram_bench import summarize_accuracy
from scripts.benchmark.analyze_histogram_bench import summarize_accuracy_by_distribution
from scripts.benchmark.analyze_histogram_bench import summarize_accuracy_by_distribution_and_kind
from scripts.benchmark.analyze_histogram_bench import summarize_accuracy_by_kind
from scripts.benchmark.analyze_histogram_bench import tail_file

ESTIMATED_ROWS_RE = re.compile(r"estimated rows:\s*(?P<rows>[-+0-9.eE]+)")


@dataclass(frozen=True)
class VariantSpec:
    label: str
    collect_top_n: bool
    collect_count_min_sketch: bool


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare ANALYZE frequency-stat cost and optimizer estimate accuracy."
    )
    parser.add_argument("--dsn", default=os.getenv("BENDSQL_DSN"), help="bendsql DSN")
    parser.add_argument("--bendsql", default=os.getenv("BENDSQL", "bendsql"))
    parser.add_argument("--database", default="tmp_analyze_frequency_stats_bench")
    parser.add_argument("--table", default="t")
    parser.add_argument("--rows", type=int, default=5_000_000)
    parser.add_argument("--batch-rows", type=int, default=500_000)
    parser.add_argument("--domain", type=int, default=100_000)
    parser.add_argument(
        "--skew-percent",
        type=int,
        default=80,
        help="Percent of rows forced to skew_key = 0.",
    )
    parser.add_argument(
        "--wide-hot-values",
        type=int,
        default=200,
        help=(
            "Number of hot values in wide_hot_key. Half of the rows are spread "
            "across these values, so TopN may not retain every hot value."
        ),
    )
    parser.add_argument("--max-threads", type=int, default=8)
    parser.add_argument(
        "--stat-columns",
        default="uniform_key,skew_key,wide_hot_key",
        help="Columns listed in analyze_frequency_columns for every benchmark variant.",
    )
    parser.add_argument("--top-n-size", type=int, default=50)
    parser.add_argument(
        "--cms-error-rate",
        type=float,
        default=0.001,
        help=(
            "Value for analyze_count_min_sketch_error_rate when CMS is enabled. "
            "The option is set to 0 for variants without CMS."
        ),
    )
    parser.add_argument(
        "--variants",
        default="none,topn,cms,topn_cms",
        help="Comma-separated variants to run: none,topn,cms,topn_cms.",
    )
    parser.add_argument("--repeat", type=int, default=1)
    parser.add_argument("--sample-interval-sec", type=float, default=0.05)
    parser.add_argument(
        "--run-mode",
        choices=("sequential", "isolated-query"),
        default="sequential",
        help=(
            "sequential reuses the current query process; isolated-query starts a fresh "
            "databend-query process for setup and for each measured ANALYZE run."
        ),
    )
    parser.add_argument(
        "--query-bin",
        default="target/debug/databend-query",
        help="databend-query binary used by --run-mode=isolated-query.",
    )
    parser.add_argument(
        "--query-config",
        default="_data/local/databend-query.toml",
        help="databend-query config used by --run-mode=isolated-query.",
    )
    parser.add_argument("--query-ready-timeout-sec", type=float, default=60.0)
    parser.add_argument("--query-shutdown-timeout-sec", type=float, default=10.0)
    parser.add_argument("--query-log-dir", default="target/bench-results")
    parser.add_argument("--query-pid", action="append", type=int, default=[])
    parser.add_argument("--query-process-substring", default="databend-query")
    parser.add_argument("--reuse-table", action="store_true")
    parser.add_argument("--keep", action="store_true", help="Do not drop database after run.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--output", default=None, help="Write JSON result to this path.")
    return parser.parse_args()


def build_client(args: argparse.Namespace) -> BendSQL:
    if args.run_mode == "isolated-query" and not args.dsn:
        args.dsn = DEFAULT_LOCAL_DSN
    return BendSQL(args.bendsql, args.dsn, args.dry_run)


def session_sql(args: argparse.Namespace, sql: str) -> str:
    return "\n".join(
        [
            "SET enable_table_snapshot_stats = 1;",
            "SET enable_analyze_histogram = 0;",
            f"SET max_threads = {args.max_threads};",
            sql,
        ]
    )


def prepare_table(client: BendSQL, args: argparse.Namespace) -> None:
    table = fq_table(args.database, args.table)
    if not args.reuse_table:
        run_sql(client, f"DROP DATABASE IF EXISTS {quote_ident(args.database)}", "drop database")
        run_sql(client, f"CREATE DATABASE {quote_ident(args.database)}", "create database")
        run_sql(
            client,
            f"""
            CREATE TABLE {table} (
                id UInt64,
                uniform_key UInt64,
                skew_key UInt64,
                wide_hot_key UInt64,
                payload String
            )
            """,
            "create table",
        )

        inserted = 0
        while inserted < args.rows:
            batch_rows = min(args.batch_rows, args.rows - inserted)
            insert_sql = f"""
                INSERT INTO {table}
                SELECT
                    number + {inserted} AS id,
                    (number + {inserted}) % {args.domain} AS uniform_key,
                    IF(((number + {inserted}) % 100) < {args.skew_percent},
                        0,
                        (number + {inserted}) % {args.domain}) AS skew_key,
                    IF(((number + {inserted}) % 2) = 0,
                        ((number + {inserted}) DIV 2) % {args.wide_hot_values},
                        {args.wide_hot_values}
                            + (((number + {inserted}) DIV 2)
                                % {args.domain - args.wide_hot_values})) AS wide_hot_key,
                    concat('payload_', to_string((number + {inserted}) % {args.domain})) AS payload
                FROM numbers({batch_
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20599** (2026-09-30): **fix(planner): keep rank limit off eager aggregates below joins**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  - fixes: #20591  With `GROUP BY ... ORDER BY <group keys> LIMIT n`, `RulePushDownRankLimitAggregate` sets `rank_limit` on the aggregate, which is correct because it sits right under the ORDER BY/LIMIT. `RuleEagerAggregation` then builds a pre-aggregate below the join by cloning the final aggregate (`..self.final_agg.clone()` in `pruned_aggregate_for_side`). That copied `rank_limit` down too.  Below the join, the limit keeps the first n groups of one join input, not of the join output. In the issue, the pre-aggregate on `part_l` kept only rows 1..3, all of which have `c0boolean = false` in `part_r`, so the query returned no rows.  LATERAL and the MEMORY engine are not required. MEMORY tables have no stats, so the cost model picks eager aggregation. With FUSE tables, a plain inner join reproduces the bug once `force_eager_aggregate = 1` is set. The `partitions total: 0` in the issue's EXPLAIN is normal for MEMORY tables and unrelated.  The fix sets `rank_limit: None` on the aggregates built below the join. The final aggregate above the join keeps its rank limit, so the TopN optimization still applies. `flatten_plan.rs` already clears `rank_limit` in the same way when it copies an aggregate during decorrelation.  ## Tests  - [ ] Unit Test - [x] Logic Test - [ ] Benchmark Test - [ ] No Test - _Explain why_  - `query/join/eager_aggregation_strategy.test`: the issue's query

- **Issue #20593** (2026-09-30): **feat(query): distribute data rewrite of ALTER TABLE MODIFY COLUMN**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  - fixes: #20575  When `ALTER TABLE ... MODIFY COLUMN` has to rewrite a Fuse table, the rewrite plan placed `DistributedInsertSelect` above the top `Merge` exchange. Only the scan ran on every node. The schema conversion (`TransformCastSchema`), block building and `append_data` all ran on the coordinator, so every row was shipped to one node, which converted and wrote the whole table by itself.  This PR builds the rewrite plan with `build_insert_select_physical_plan`, the builder used by `INSERT ... SELECT`. When the table supports distributed insert (Fuse does) and the select plan has a top `Merge`, it pushes `DistributedInsertSelect` below the `Merge`:  ``` before                            after DistributedInsertSelect           Exchange(Merge) └── Exchange(Merge)               └── DistributedInsertSelect     └── TableScan                     └── TableScan ```  Each node now converts and writes its own blocks. Only the writer metas are merged back to the coordinator.  What is unchanged:  - The commit still runs once on the coordinator through `commit_insertion`, with `overwrite = true` and `prev_snapshot_id` for conflict detection. The table lock in `execute2` is untouched. - Remote writers build the table from the new schema carried in the plan's `table_info`, the same way distributed `INSERT` does. - Single-node execution and metadata-only ALTERs behave as before.

- **Issue #20592** (2026-09-30): **fix(query): keep scalar eager aggregates out of inner/cross joins**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  - fixes: #20483  `RuleEagerAggregation` could push a **scalar** aggregate (one that keeps no `GROUP BY` column of its own) below an inner or cross join. A scalar aggregate emits exactly one row even when its input is empty, so moving one below the join turned an empty build side into a one-row build side and made the join emit probe rows the original plan had already filtered out.  In the reported plan the never-TRUE `WHERE` predicate on `t1` was folded into an empty scan, `COUNT(t1.v)` was hoisted above the `CROSS JOIN` as a scalar aggregate over `t1`, and `t0` was re-scanned as the probe side. Since the folded `COUNT` had no `GROUP BY` column, it produced one row for an empty `t1`, so the `CROSS JOIN` behaved as though `t1` had contributed all its rows and the whole `t0` content survived.  The fix requires a side to retain at least one `GROUP BY` column before the rewrite replaces it with an eager aggregate. A grouped aggregate over an empty input produces zero rows, so it preserves the join's cardinality. The check is applied to every side each rewrite variant touches, so `SingleCount` and `SingleDouble` are gated on the opposite side as well. The existing `expand_analyses` body is also collapsed onto a local `analysis` closure while the guard is threaded through, since each variant previously repeated the same seven-field struct literal.  ## Tests  - [x] Unit Test

- **Issue #20591** (2026-09-30): **bug: Multi-table LATERAL JOIN reconstructed query returns empty result while single-table query returns 3 rows**
  *Symptoms*: ### Search before asking  - [x] I had searched in the [issues](https://github.com/databendlabs/databend/issues) and found no similar issues.   ### Version  - Databend version: v1.2.925-patch-11-ebcd374c34 - Build toolchain: rust-1.94.0-nightly-2026-08-26  ### What's Wrong?  The single-table query returns 3 rows, but the multi-table reconstructed query using `JOIN LATERAL` returns an empty result. The single-table query plan directly scans the `source` table and filters on `c0boolean`, returning 3 rows. In the multi-table query plan, `part_l` is a MEMORY table with 9 actual rows, but the plan shows `partitions total: 0, partitions scanned: 0`, causing the probe side to receive no input and ultimately return 0 rows.  ### How to Reproduce?  1. Start the Databend query service and connect using a MySQL client. 2. Execute the following SQL script:  ```sql DROP DATABASE IF EXISTS repro_databend912_db7_min; CREATE DATABASE repro_databend912_db7_min; USE repro_databend912_db7_min;  CREATE TABLE source (     vp_rowid BIGINT NOT NULL,     c0boolean BOOLEAN,     c1int BIGINT ) ENGINE=FUSE;  INSERT INTO source VALUES (1, false, -1), (2, false, -2), (3, false, -3), (4, true,  -4), (5, true,  -5), (6, true,  -6), (7, true,  -7), (8, true,  -8), (9, true,  -9);  CREATE TABLE part_l (     vp_rowid BIGINT NOT NULL,     c1int BIGINT ) ENGINE=MEMORY;  CREATE TABLE part_r (     vp_rowid BIGINT NOT NULL,     c0boolean BOOLEAN ) ENGINE=FUSE;  INSERT INTO part_l SELECT vp_rowid, c1int FROM source; 

- **Issue #20590** (2026-09-29): **fix(storage): read Iceberg tables on Azure (abfs[s])**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Iceberg tables on Azure (`abfs[s]://`) can't be read. Every table load fails:  ``` Iceberg catalog load failed: FeatureUnsupported => Constructing file io from scheme: azdls not supported now ```  The REST catalog attaches and lists namespaces; only table IO fails. Two causes:  1. **`storage-azdls` is not enabled on `iceberg`.** In iceberg-rust, `storage-all` means memory, fs, s3 and gcs only, so the Azdls storage is compiled out. `opendal/services-azdls` is already on in the workspace, so `Cargo.lock` doesn't change. 2. **`IcebergFileIO::build_operator` cuts the path short for `abfss://<filesystem>@<host>/<path>`.** It computes the relative-path offset as `scheme://host/`, which ignores the `<filesystem>@` userinfo, so every data-file path starts inside the filesystem name. It now starts after the whole authority, which is unchanged for `s3://bucket/…`. For Azdls it also sets opendal's `filesystem` and `endpoint` from the location, as iceberg-rust's own Azdls storage does, and maps `adls.tenant-id` / `adls.client-id` / `adls.client-secret` / `adls.authority-host` next to the existing `adls.sas-token` / `adls.account-*` keys.  ## Tests  - [x] Unit Test: `iceberg_file_io_azdls_path_skips_filesystem_in_authority` covers `*.dfs.core.windows.net` and `onelake.dfs.fabric.microsoft.com`. The three existing `iceberg_file_io_*` tests still pass, and `cargo fmt --all --check` 
  **Post-Mortem & Fix Analysis**:
  > thanks @sundy-li 

- **Issue #20589** (2026-09-29): **fix(storage): read Iceberg tables on Azure (abfs[s])**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Iceberg tables on Azure (`abfs[s]://`) can't be read. Every table load fails:  ``` Iceberg catalog load failed: FeatureUnsupported => Constructing file io from scheme: azdls not supported now ```  The REST catalog attaches and lists namespaces; only table IO fails. Two causes:  1. **`storage-azdls` is not enabled on `iceberg`.** In iceberg-rust, `storage-all` means memory, fs, s3 and gcs only, so the Azdls storage is compiled out. `opendal/services-azdls` is already on in the workspace, so `Cargo.lock` doesn't change. 2. **`IcebergFileIO::build_operator` cuts the path short for `abfss://<filesystem>@<host>/<path>`.** It computes the relative-path offset as `scheme://host/`, which ignores the `<filesystem>@` userinfo, so every data-file path starts inside the filesystem name. It now starts after the whole authority, which is unchanged for `s3://bucket/…`. For Azdls it also sets opendal's `filesystem` and `endpoint` from the location, as iceberg-rust's own Azdls storage does, and maps `adls.tenant-id` / `adls.client-id` / `adls.client-secret` / `adls.authority-host` next to the existing `adls.sas-token` / `adls.account-*` keys.  ## Tests  - [x] Unit Test: `iceberg_file_io_azdls_path_skips_filesystem_in_authority` covers `*.dfs.core.windows.net` and `onelake.dfs.fabric.microsoft.com`. The three existing `iceberg_file_io_*` tests still pass, and `cargo fmt --all --check` 
  **Post-Mortem & Fix Analysis**:
  > The `## AI assistance` section is incomplete. Review is blocked until it is filled in. @djouallah please update it 🙏.  - the checkbox "The responsible human has read every line of this diff and can explain each change" is not checked exactly as written  Required format (see [AI_POLICY.md](https://github.com/databendlabs/databend/blob/main/AI_POLICY.md)):  ``` ## AI assistance  - AI usage: An AI coding agent drafted the patch; I reviewed and added logic tests (or "None") - Responsible human: @actual-github-id - [x] The responsible human has read every line of this diff and can explain each change ```  The responsible human is the author-side owner — the person who has read the diff, can explain each change, and will answer questions during review. <!-- pr-assistant-ai-assistance -->

- **Issue #20586** (2026-09-29): **fix(parser): accept and ignore LIMIT in VACUUM DROP TABLE**
  *Symptoms*:   I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  Older clients and internal tasks still send `VACUUM DROP TABLE [FROM db] LIMIT n`, which was rejected after the vacuum syntax unification. Parse the LIMIT for compatibility and ignore it.  ## Tests  - [x] Unit Test - [ ] Logic Test - [ ] Benchmark Test - [ ] No Test - _Explain why_  ## Type of change  - [ ] Bug Fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] Breaking Change (fix or feature that could cause existing functionality not to work as expected) - [ ] Documentation Update - [x] Refactoring - [ ] Performance Improvement - [ ] Other (please describe):  ## AI assistance  <!-- See AI_POLICY.md. Agent-opened PRs are welcome; a responsible human on the author side must own the change. The responsible human is NOT the reviewer — it is the submitter-side owner who has read the diff, can explain each change, and will answer questions during review. Write "None" for AI usage if no AI was involved. -->  - AI usage: AI generate the code I review it. - Responsible human: @TCeason - [x] The responsible human has read every line of this diff and can explain each change  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/databendlabs/databend/2

- **Issue #20585** (2026-09-29): **fix(query): preserve time in string date arithmetic**
  *Symptoms*: I hereby agree to the terms of the CLA available at: https://docs.databend.com/dev/policies/cla/  ## Summary  `add_hours` / `add_minutes` / `add_seconds` / `subtract_hours` / `subtract_minutes` / `subtract_seconds` silently dropped the time component   when the first argument was a string:  ```sql SELECT subtract_minutes('2026-09-26 08:34:00', 5); -- before: 2026-09-25 23:55:00   (parsed as Date, time lost) -- after:  2026-09-26 08:29:00 ```  **Root cause**. Each of these functions registers a Date overload before its Timestamp overload. Both String -> Date and String -> Timestamp are in the general auto-cast rules, so both overloads are viable for a string argument. check_function tries candidates in registration order and, with equal scores, keeps the first one that type-checks — the Date overload — so the string is cast to Date and the time part is discarded.   date_add(minute, ...) / date_sub(minute, ...) are rewritten to these functions and were affected the same way.  **Fix**. Register additional cast rules for these six functions that are the default rules minus String -> Date, so string arguments can only resolve to the Timestamp overload. Since these functions return Timestamp regardless of input type, the only observable change is that the time component is preserved.  **Scope**. Day-based arithmetic (add_days, add_months, add_years, add_quarters, add_weeks, date_add(day, ...) etc.) is intentionally unchanged: its Date overload returns Date, and wh

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

### Incident Patch 1: `99d0f9da` (2026-09-30)
**Commit Message**: fix(planner): keep rank limit off eager aggregates below joins (#20599)

* fix(planner): keep rank limit off eager aggregates below joins

RuleEagerAggregation cloned the final aggregate, including a rank limit pushed down by ORDER BY ... LIMIT, into the pre-aggregate below the join. The limit then kept the first N groups of one join input instead of the join output, so queries could return too few or no rows.

Fixes #20591

* test(planner): check eager aggregate rank limit with explain

Replace the optimizer unit test with a standalone EXPLAIN case that pins the plan shape: the rank limit stays on the aggregate above the join and is absent from the eager aggregate below it.

* test(planner): ignore pruning cost in eager rank limit explain

* test(planner): record eager aggregation rule candidates in golden

Port the rule-level test harness from the late-split branch onto the
current rule. Each case now records the plan fed to
RuleEagerAggregation (after the default rewrites and SplitAggregate),
the number of candidates, and every candidate plan, instead of only the
final optimized plan, which does not go through CBO here and rarely
picks an eager aggregate.

Add the Q0-Q11 cases f

**File**: `src/query/sql/src/planner/optimizer/optimizers/rule/agg_rules/rule_eager_aggregation.rs` (modified, +3/-0)
```diff
@@ -1103,6 +1103,9 @@ impl EagerAnalysis {
                 })
                 .cloned()
                 .collect(),
+            // A rank limit on the final aggregate only holds for the groups that survive
+            // the join. Applying it below the join could drop groups that would match.
+            rank_limit: None,
             ..self.final_agg.clone()
         }
     }
```

**File**: `src/query/sql/tests/it/optimizer/eager_aggregation.rs` (modified, +363/-30)
```diff
@@ -15,12 +15,20 @@
 use databend_common_catalog::table_context::TableContextSettings;
 use databend_common_exception::Result;
 use databend_common_sql::optimizer::OptimizerContext;
+use databend_common_sql::optimizer::ir::SExpr;
+use databend_common_sql::optimizer::ir::SExprVisitor;
 use databend_common_sql::optimizer::ir::StatContext;
+use databend_common_sql::optimizer::ir::VisitAction;
+use databend_common_sql::optimizer::optimizers::operator::PullUpFilterOptimizer;
+use databend_common_sql::optimizer::optimizers::operator::RuleNormalizeAggregateOptimizer;
+use databend_common_sql::optimizer::optimizers::operator::RuleStatsAggregateOptimizer;
 use databend_common_sql::optimizer::optimizers::recursive::RecursiveRuleOptimizer;
+use databend_common_sql::optimizer::optimizers::rule::DEFAULT_REWRITE_RULES;
 use databend_common_sql::optimizer::optimizers::rule::Rule;
 use databend_common_sql::optimizer::optimizers::rule::RuleEagerAggregation;
 use databend_common_sql::optimizer::optimizers::rule::RuleID;
 use databend_common_sql::optimizer::optimizers::rule::TransformResult;
+use databend_common_sql::plans::AggregateMode;
 use databend_common_sql::plans::Plan;
 
 use crate::framework::LiteTableContext;
@@ -29,60 +37,235 @@ use crate::framework::golden::open_golden_file;
 use crate::framework::golden::setup_context;
 use crate::framework::golden::write_case_header;
 
-async fn write_optimized_case(file: &mut impl std::io::Write, case: &SqlTestCase) -> Result<()> {
+async fn write_rule_results(file: &mut impl std::io::Write, case: &SqlTestCase) -> Result<()> {
     let ctx = setup_context(case).await?;
-    let raw_plan = ctx.bind_sql(case.sql).await?;
-    let optimized_plan = ctx.optimize_plan(raw_plan.clone()).await?;
+    let plan = ctx.bind_sql(case.sql).await?;
+    let Plan::Query {
+        s_expr, metadata, ..
+    } = &plan
+    else {
+        unreachable!("test query should bind to Plan::Query")
+    };
+
+    let settings = ctx.get_settings();
+    let opt_ctx = OptimizerContext::new(ctx.clone(), metadata.clone(), ctx.get_function_context()?)
+        .with_settings(&settings)?;
+    let before_expr = optimize_before(opt_ctx.clone(), s_expr).await?;
+    let before_plan = plan.replace_query_s_expr(before_expr.clone());
 
     write_case_header(file, case)?;
-    writeln!(file, "raw_plan:")?;
+    writeln!(file, "before_plan:")?;
     writeln!(
         file,
         "{}",
-        raw_plan.format_indent(Default::default(), &StatContext::default())?
+        before_plan.format_indent(Default::default(), &StatContext::default())?
     )?;
-    writeln!(file, "optimized_plan:")?;
+    // The logical plan format does not show rank limits, so record their positions.
+    let before_rank_limits = rank_limit_positions(&before_expr);
+    if before_rank_limits != (0, 0) {
+        write_rank_limit_positions(file, before_rank_limits)?;
+    }
+
+    let mut extractor = Extractor {
+        rule: RuleEagerAggregation::new(metadata.clone()),
+        results: TransformResult::new(),
+    };
+    before_expr.accept(&mut extractor)?;
+    let results = extractor.results.results();
+    for (result_index, result) in results.iter().enumerate() {
+        assert_no_initial_aggregate(result)?;
+        result.validate_types(metadata)?;
+        result.validate_column_scope(metadata)?;
+        writeln!(file, "apply_plan_{result_index}:")?;
+        let rewritten = plan.replace_query_s_expr(result.clone());
+        writeln!(
+            file,
+            "{}",
+            rewritten.format_indent(Default::default(), &StatContext::default())?
+        )?;
+        // A rank limit below the join keeps the first groups of one join input, which
+        // may all be filtered out by the join (#20591).
+        if before_rank_limits != (0, 0) {
+            write_rank_limit_positions(file, rank_limit_positions(result))?;
+        }
+    }
+    writeln!(file)?;
+
+    Ok(())
+}
+
+/// Counts rank-limited aggregates above and below the fi
```

**File**: `tests/sqllogictests/suites/mode/standalone/explain/aggregate.test` (modified, +117/-0)
```diff
@@ -545,3 +545,120 @@ DROP TABLE IF EXISTS t;
 
 statement ok
 DROP TABLE IF EXISTS explain_agg_t1;
+
+# https://github.com/databendlabs/databend/issues/20591
+# The rank limit pushed down by ORDER BY ... LIMIT stays on the aggregate above the join.
+# The eager aggregate below the join must not carry it.
+statement ok
+set force_eager_aggregate = 1;
+
+statement ok
+CREATE OR REPLACE TABLE explain_agg_rank_l (k BIGINT NOT NULL, v BIGINT);
+
+statement ok
+CREATE OR REPLACE TABLE explain_agg_rank_r (k BIGINT NOT NULL, flag BOOLEAN);
+
+statement ok
+INSERT INTO explain_agg_rank_l VALUES (1, -1), (2, -2), (3, -3), (4, -4), (5, -5), (6, -6), (7, -7), (8, -8), (9, -9);
+
+statement ok
+INSERT INTO explain_agg_rank_r VALUES (1, false), (2, false), (3, false), (4, true), (5, true), (6, true), (7, true), (8, true), (9, true);
+
+query T
+EXPLAIN SELECT sum(l.v), l.k, l.v
+FROM explain_agg_rank_l l JOIN explain_agg_rank_r r ON r.k = l.k
+WHERE r.flag
+GROUP BY l.k, l.v
+ORDER BY l.k, l.v
+LIMIT 3;
+----
+TopN(Final)
+├── output columns: [l.k (#0), l.v (#1), sum(l.v) (#4)]
+├── sort keys: [k ASC NULLS LAST, v ASC NULLS LAST]
+├── limit: 3
+├── offset: 0
+├── estimated rows: 3.00
+└── TopN(Partial)
+    ├── output columns: [l.k (#0), l.v (#1), sum(l.v) (#4), #_order_col]
+    ├── sort keys: [k ASC NULLS LAST, v ASC NULLS LAST]
+    ├── limit: 3
+    ├── offset: 0
+    ├── estimated rows: 3.00
+    └── EvalScalar
+        ├── output columns: [l.k (#0), l.v (#1), sum(l.v) (#4)]
+        ├── expressions: [sum(l.v) (#16)]
+        ├── estimated rows: 4.50
+        └── AggregateFinal
+            ├── output columns: [_eager_final_sum (#16), l.k (#0), l.v (#1)]
+            ├── group by: [k, v]
+            ├── aggregate functions: [sum(sum(l.v) * _eager_count)]
+            ├── estimated rows: 4.50
+            └── AggregatePartial
+                ├── group by: [k, v]
+                ├── aggregate functions: [sum(sum(l.v) * _eager_count)]
+                ├── estimated rows: 4.50
+                ├── rank limit: 3
+                └── EvalScalar
+                    ├── output columns: [l.k (#0), l.v (#1), sum(l.v) * _eager_count (#18)]
+                    ├── expressions: [_eager (#4) * CAST(_eager_count (#17) AS UInt64 NULL)]
+                    ├── estimated rows: 4.50
+                    └── HashJoin
+                        ├── output columns: [sum(l.v) (#4), l.k (#0), l.v (#1), count(*) (#17)]
+                        ├── join type: INNER
+                        ├── build keys: [r.k (#2)]
+                        ├── probe keys: [l.k (#0)]
+                        ├── keys is null equal: [false]
+                        ├── filters: []
+                        ├── build join filters:
+                        │   └── filter id:0, build key:r.k (#2), probe targets:[l.k (#0)@scan0], filter type:bloom,inlist,min_max
+                        ├── estimated rows: 4.50
+                        ├── AggregateFinal(Build)
+                        │   ├── output columns: [count(*) (#17), r.k (#2)]
+                        │   ├── group by: [k]
+                        │   ├── aggregate functions: [count()]
+                        │   ├── estimated rows: 4.50
+                        │   └── AggregatePartial
+                        │       ├── group by: [k]
+                        │       ├── aggregate functions: [count()]
+                        │       ├── estimated rows: 4.50
+                        │       └── TableScan
+                        │           ├── table: default.default.explain_agg_rank_r
+                        │           ├── scan id: 1
+                        │           ├── output columns: [k (#2)]
+                        │           ├── read rows: 9
+                        │           ├── read size: < 1 KiB
+                        │           ├── partitions total: 1
+                        │           ├── partitions scanned: 1
+                        │           ├── pruning stats: [segments: <read cost: <slt
```

**File**: `tests/sqllogictests/suites/query/join/eager_aggregation_strategy.test` (modified, +56/-0)
```diff
@@ -45,3 +45,59 @@ DROP TABLE eager_strategy_left;
 
 statement ok
 DROP TABLE eager_strategy_right;
+
+# https://github.com/databendlabs/databend/issues/20591
+# A pushed-down rank limit must not be copied into an eager aggregate below the join:
+# the first groups of one join input may all be filtered out by the join.
+# force_eager_aggregate makes the plan independent of table statistics.
+statement ok
+set force_eager_aggregate = 1;
+
+statement ok
+CREATE TABLE eager_rank_limit_l (k BIGINT NOT NULL, v BIGINT);
+
+statement ok
+CREATE TABLE eager_rank_limit_r (k BIGINT NOT NULL, flag BOOLEAN);
+
+statement ok
+INSERT INTO eager_rank_limit_l VALUES (1, -1), (2, -2), (3, -3), (4, -4), (5, -5), (6, -6), (7, -7), (8, -8), (9, -9);
+
+statement ok
+INSERT INTO eager_rank_limit_r VALUES (1, false), (2, false), (3, false), (4, true), (5, true), (6, true), (7, true), (8, true), (9, true);
+
+query III
+SELECT sum(l.v), l.k, l.v
+FROM eager_rank_limit_l l JOIN eager_rank_limit_r r ON r.k = l.k
+WHERE r.flag
+GROUP BY l.k, l.v
+ORDER BY l.k, l.v
+LIMIT 3;
+----
+-4 4 -4
+-5 5 -5
+-6 6 -6
+
+query III
+SELECT sum(s.v), s.k, s.v
+FROM (
+    SELECT l.k, r.flag, l.v
+    FROM eager_rank_limit_l l
+    JOIN LATERAL (SELECT * FROM eager_rank_limit_r rr WHERE rr.k = l.k) r ON TRUE
+) s
+WHERE s.flag
+GROUP BY s.k, s.v
+ORDER BY s.k, s.v
+LIMIT 3;
+----
+-4 4 -4
+-5 5 -5
+-6 6 -6
+
+statement ok
+DROP TABLE eager_rank_limit_l;
+
+statement ok
+DROP TABLE eager_rank_limit_r;
+
+statement ok
+unset force_eager_aggregate;
```

---

### Incident Patch 2: `cb9170e5` (2026-09-30)
**Commit Message**: fix(query): keep scalar eager aggregates out of inner/cross joins (#20592)

* fix(query): keep scalar eager aggregates out of inner/cross joins

The eager-aggregation rewrite could push a scalar aggregate below an
inner or cross join. A scalar aggregate is one that keeps no GROUP BY
column of its own, so it emits exactly one row even when its input is
empty. Moving one below the join therefore turned an empty build side
into a one-row build side, and the join emitted probe rows that the
original plan had already filtered out.

The reported plan folded the never-TRUE WHERE predicate on t1 into a
ConstantTableScan, hoisted the COUNT(t1.v) above the CROSS join as a
scalar aggregate over t1, and then re-scanned t0. Because the folded
COUNT had no GROUP BY column of its own, it produced one row for an
empty t1, so the CROSS JOIN behaved as if t1 had contributed all its
rows and the whole t0 content survived.

Require a side to retain at least one GROUP BY column before the rewrite
replaces it with an eager aggregate: a grouped aggregate over an empty
input produces zero rows, so it preserves the join's cardinality. The
check is applied to every side each rewrite variant touches, so
Sing

**File**: `src/query/sql/src/planner/optimizer/optimizers/rule/agg_rules/rule_eager_aggregation.rs` (modified, +44/-47)
```diff
@@ -348,6 +348,19 @@ impl<'a> EagerInput<'a> {
             return Ok(vec![]);
         }
 
+        // An eager aggregate that keeps no group column on its side is a scalar
+        // aggregate: it emits exactly one row even when its input is empty. For an
+        // inner/cross join that turns an empty build side into a one-row build side,
+        // so the join emits probe rows the original plan filtered out (see #20483).
+        // Only sides that retain at least one group column preserve emptiness, because
+        // a grouped aggregate over an empty input produces zero rows.
+        let keeps_empty_side = Pair::new_with(|side| {
+            final_agg
+                .group_items
+                .iter()
+                .any(|item| join_columns[side].contains(&item.index))
+        });
+
         let eager_aggregation_variants = eager_candidates.assignments();
         Ok(eager_aggregation_variants
             .into_iter()
@@ -358,6 +371,7 @@ impl<'a> EagerInput<'a> {
                     &join_columns,
                     &eager_extra_eval_scalar_expr,
                     &can_eager,
+                    &keeps_empty_side,
                     assignment,
                 )
             })
@@ -401,33 +415,34 @@ impl<'a> EagerInput<'a> {
         join_columns: &Pair<ColumnSet>,
         eager_extra_eval_scalar_expr: &Pair<EvalScalar>,
         can_eager: &Pair<bool>,
+        keeps_empty_side: &Pair<bool>,
         assignment: EagerAssignment,
     ) -> Vec<EagerAnalysis> {
+        let analysis = |rewrite_kind| EagerAnalysis {
+            final_agg: final_agg.clone(),
+            original_group_items_len,
+            join_columns: join_columns.clone(),
+            eager_extra_eval_scalar_expr: eager_extra_eval_scalar_expr.clone(),
+            eager_aggregations: assignment.eager_aggregations.clone(),
+            can_eager: can_eager.clone(),
+            rewrite_kind,
+        };
+
         let can_push_down = Pair {
             left: !assignment.eager_aggregations[Side::Left].is_empty() && can_eager[Side::Left],
             right: !assignment.eager_aggregations[Side::Right].is_empty() && can_eager[Side::Right],
         };
 
-        if can_push_down[Side::Left] && can_push_down[Side::Right] {
+        // `keeps_empty_side` must hold for every side this rewrite replaces with an
+        // eager aggregate, otherwise the join would gain rows the input never had.
+        if can_push_down[Side::Left]
+            && can_push_down[Side::Right]
+            && keeps_empty_side[Side::Left]
+            && keeps_empty_side[Side::Right]
+        {
             return vec![
-                EagerAnalysis {
-                    final_agg: final_agg.clone(),
-                    original_group_items_len,
-                    join_columns: join_columns.clone(),
-                    eager_extra_eval_scalar_expr: eager_extra_eval_scalar_expr.clone(),
-                    eager_aggregations: assignment.eager_aggregations.clone(),
-                    can_eager: can_eager.clone(),
-                    rewrite_kind: EagerRewriteKind::DoubleGroupByCount(Side::Left),
-                },
-                EagerAnalysis {
-                    final_agg: final_agg.clone(),
-                    original_group_items_len,
-                    join_columns: join_columns.clone(),
-                    eager_extra_eval_scalar_expr: eager_extra_eval_scalar_expr.clone(),
-                    eager_aggregations: assignment.eager_aggregations.clone(),
-                    can_eager: can_eager.clone(),
-                    rewrite_kind: EagerRewriteKind::DoubleSplit(Side::Left),
-                },
+                analysis(EagerRewriteKind::DoubleGroupByCount(Side::Left)),
+                analysis(EagerRewriteKind::DoubleSplit(Side::Left)),
             ];
         }
 
@@ -443,40 +458,22 @@ impl<'a> EagerInput<'a> {
             return vec![];
         }
 
-        let mut analyses = vec![EagerAnalysis {
-            final_agg: fin
```

**File**: `src/query/sql/tests/it/optimizer/eager_aggregation.rs` (modified, +35/-1)
```diff
@@ -153,8 +153,11 @@ async fn test_eager_aggregation_keeps_decimal_product_types_in_sync() -> Result<
         name: "decimal_sum_multiplied_by_eager_count",
         description: "",
         setup_sqls: &[DECIMAL_SALES_TABLE, DATE_DIM_TABLE],
+        // An equi-join keeps a group column on both sides, so the `sum * eager_count`
+        // rewrite (`SingleCount`) stays eligible. A CROSS JOIN would leave `date_dim`
+        // without a group column and the rule would skip that rewrite (#20483).
         sql: "SELECT ss_store_sk, sum(ss_ext_sales_price)
-FROM store_sales CROSS JOIN date_dim
+FROM store_sales JOIN date_dim ON ss_store_sk = d_date_sk
 GROUP BY ss_store_sk",
     };
     let ctx = setup_context(&case).await?;
@@ -217,6 +220,37 @@ GROUP BY ss_store_sk"
     Ok(())
 }
 
+// Regression for #20483: an eager aggregate on a side without any GROUP BY column is
+// a scalar aggregate and emits one row for an empty input. Pushing it below a CROSS
+// JOIN would make the join emit rows from the other side, so no candidate is legal.
+#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
+async fn test_eager_aggregation_skips_side_without_group_column() -> Result<()> {
+    for aggregate in ["sum", "count", "min", "max"] {
+        let sql = format!(
+            "SELECT ss_store_sk, {aggregate}(d_date_sk)
+FROM store_sales CROSS JOIN date_dim
+GROUP BY ss_store_sk"
+        );
+        let ctx = LiteTableContext::create().await?;
+        ctx.register_setup_sql(DECIMAL_SALES_TABLE).await?;
+        ctx.register_setup_sql(DATE_DIM_TABLE).await?;
+        let Plan::Query {
+            s_expr, metadata, ..
+        } = ctx.bind_sql(&sql).await?
+        else {
+            unreachable!("test query should bind to Plan::Query")
+        };
+        let opt_ctx =
+            OptimizerContext::new(ctx.clone(), metadata.clone(), ctx.get_function_context()?);
+        let split = RecursiveRuleOptimizer::new(opt_ctx, &[RuleID::SplitAggregate])
+            .optimize_sync(*s_expr)?;
+        let mut results = TransformResult::new();
+        RuleEagerAggregation::new(metadata.clone()).apply(&split, &mut results)?;
+        assert!(results.results().is_empty(), "{aggregate}");
+    }
+    Ok(())
+}
+
 const ORDERS_TABLE: &str = "CREATE TABLE orders
 (
     o_orderkey       BIGINT not null,
```

**File**: `tests/sqllogictests/suites/mode/standalone/explain/subquery.test` (modified, +55/-55)
```diff
@@ -1089,67 +1089,67 @@ HashJoin
 │   │       ├── aggregate functions: [max(v)]
 │   │       ├── estimated rows: 1.00
 │   │       └── HashJoin
-│   │           ├── output columns: [k (#7), nullable_scalar_exchange_payload.v (#4)]
+│   │           ├── output columns: [nullable_scalar_exchange_payload.v (#4), k (#7)]
 │   │           ├── join type: CROSS
 │   │           ├── build keys: []
 │   │           ├── probe keys: []
 │   │           ├── keys is null equal: []
 │   │           ├── filters: []
 │   │           ├── estimated rows: 1.00
-│   │           ├── TableScan(Build)
-│   │           │   ├── table: default.default.nullable_scalar_exchange_payload
-│   │           │   ├── scan id: 2
-│   │           │   ├── output columns: [v (#4)]
-│   │           │   ├── read rows: 1
-│   │           │   ├── read size: < 1 KiB
-│   │           │   ├── partitions total: 1
-│   │           │   ├── partitions scanned: 1
-│   │           │   ├── pruning stats: [segments: <read cost: <slt:ignore>, decompress cost: <slt:ignore>, range pruning: 1 to 1 cost: <slt:ignore>>, blocks: <range pruning: 1 to 1 cost: <slt:ignore>>]
-│   │           │   ├── push downs: [filters: [], limit: NONE]
-│   │           │   └── estimated rows: 1.00
-│   │           └── AggregateFinal(Probe)
-│   │               ├── output columns: [k (#7)]
-│   │               ├── group by: [k]
-│   │               ├── aggregate functions: []
-│   │               ├── estimated rows: 1.00
-│   │               └── AggregatePartial
-│   │                   ├── group by: [k]
-│   │                   ├── aggregate functions: []
-│   │                   ├── estimated rows: 1.00
-│   │                   └── HashJoin
-│   │                       ├── output columns: [k (#7)]
-│   │                       ├── join type: INNER
-│   │                       ├── build keys: [o.id (#6)]
-│   │                       ├── probe keys: [j.id (#9)]
-│   │                       ├── keys is null equal: [false]
-│   │                       ├── filters: []
-│   │                       ├── estimated rows: 1.80
-│   │                       ├── Filter(Build)
-│   │                       │   ├── output columns: [id (#6), k (#7)]
-│   │                       │   ├── filters: [NOT is_not_null(outer.k (#7))]
-│   │                       │   ├── estimated rows: 0.60
-│   │                       │   └── TableScan
-│   │                       │       ├── table: default.default.nullable_scalar_exchange_outer
-│   │                       │       ├── scan id: 3
-│   │                       │       ├── output columns: [id (#6), k (#7)]
-│   │                       │       ├── read rows: 3
-│   │                       │       ├── read size: < 1 KiB
-│   │                       │       ├── partitions total: 1
-│   │                       │       ├── partitions scanned: 1
-│   │                       │       ├── pruning stats: [segments: <read cost: <slt:ignore>, decompress cost: <slt:ignore>, range pruning: 1 to 1 cost: <slt:ignore>>, blocks: <range pruning: 1 to 1 cost: <slt:ignore>>]
-│   │                       │       ├── push downs: [filters: [true], limit: NONE]
-│   │                       │       └── estimated rows: 3.00
-│   │                       └── TableScan(Probe)
-│   │                           ├── table: default.default.nullable_scalar_exchange_join
-│   │                           ├── scan id: 4
-│   │                           ├── output columns: [id (#9)]
-│   │                           ├── read rows: 3
-│   │                           ├── read size: < 1 KiB
-│   │                           ├── partitions total: 1
-│   │                           ├── partitions scanned: 1
-│   │                           ├── pruning stats: [segments: <read cost: <slt:ignore>, decompress cost: <slt:ignore>, range pruning: 1 to 1 cost: <slt:ignore>>, blocks: <range pruning: 1 to 1 cost: <slt:ignore>>]
-│   │                           ├── push downs: [filters: [], limit: NONE]
-│   │                           └──
```

**File**: `tests/sqllogictests/suites/query/issues/issue_20483.test` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+# GitHub issue: https://github.com/databendlabs/databend/issues/20483
+#
+# The eager-aggregation rewrite used to move a scalar aggregate (an aggregate
+# that keeps no GROUP BY column of its own) below a CROSS join. A scalar
+# aggregate emits exactly one row even when its input is empty, so the rewritten
+# join gained a one-row build side and emitted probe rows that the zero-match
+# WHERE predicate had removed.
+
+statement ok
+DROP TABLE IF EXISTS issue_20483_t0
+
+statement ok
+DROP TABLE IF EXISTS issue_20483_t1
+
+statement ok
+CREATE TABLE issue_20483_t0(d DATE NOT NULL)
+
+statement ok
+CREATE TABLE issue_20483_t1(v VARCHAR NOT NULL)
+
+statement ok
+INSERT INTO issue_20483_t0 VALUES (DATE '1969-12-27'), (DATE '1969-12-31')
+
+# LENGTH(REGEXP_SUBSTR(v, '[0-9]{3}')) is 3 for a three-digit match and NULL for
+# no match, so `< 2` is never TRUE for any row.
+statement ok
+INSERT INTO issue_20483_t1 VALUES ('a'),('b'),('c'),('d'),('e'),('f'),('g'),('h'),('i')
+
+# The zero-match WHERE predicate must survive the constant-true HAVING branch.
+query I
+SELECT t0.d FROM issue_20483_t0 AS t0, issue_20483_t1 AS t1
+WHERE LENGTH(REGEXP_SUBSTR(t1.v, '[0-9]{3}')) < 2
+GROUP BY t0.d
+HAVING (1=1) OR (COUNT(t1.v) != COUNT(t0.d));
+----
+
+# The same query with the HAVING predicate relocated into a derived table is the
+# reference result.
+query I
+SELECT ref0 FROM (
+  SELECT t0.d AS ref0, ((1=1) OR (COUNT(t1.v) != COUNT(t0.d))) AS ref1
+  FROM issue_20483_t0 AS t0, issue_20483_t1 AS t1
+  WHERE LENGTH(REGEXP_SUBSTR(t1.v, '[0-9]{3}')) < 2
+  GROUP BY t0.d
+) s WHERE ref1;
+----
+
+# The aggregate over the join must agree with the aggregate over a derived empty
+# table: the cross join produces no rows, so there are no groups at all.
+query II
+SELECT t0.d, COUNT(t1.v) FROM issue_20483_t0 AS t0, issue_20483_t1 AS t1
+WHERE LENGTH(REGEXP_SUBSTR(t1.v, '[0-9]{3}')) < 2
+GROUP BY t0.d
+ORDER BY t0.d;
+----
+
+query II
+SELECT t0.d, COUNT(t1.v) FROM issue_20483_t0 AS t0,
+  (SELECT v FROM issue_20483_t1 WHERE 1=0) AS t1
+GROUP BY t0.d
+ORDER BY t0.d;
+----
+
+# Without the WHERE predicate the rewrite is still valid and the count is the
+# full right-hand row count.
+query II
+SELECT t0.d, COUNT(t1.v) FROM issue_20483_t0 AS t0, issue_20483_t1 AS t1
+GROUP BY t0.d
+ORDER BY t0.d;
+----
+1969-12-27	9
+1969-12-31	9
+
+statement ok
+DROP TABLE issue_20483_t0
+
+statement ok
+DROP TABLE issue_20483_t1
```

---

### Incident Patch 3: `f30229ee` (2026-09-29)
**Commit Message**: fix(storage): read Iceberg tables on Azure (abfs[s]) (#20590)

- enable iceberg-rust's storage-azdls: its storage-all covers memory, fs,
  s3 and gcs only, so every abfs[s]:// table failed to load with
  "Constructing file io from scheme: azdls not supported now"
- IcebergFileIO: start the relative path after the whole authority. For
  abfss://<filesystem>@<host>/... it skipped only scheme://host/, cutting
  the path inside the filesystem name
- IcebergFileIO: set Azdls filesystem and endpoint from the location, and
  map the adls.tenant-id/client-id/client-secret/authority-host keys

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `Cargo.toml` (modified, +2/-0)
```diff
@@ -291,6 +291,8 @@ quote = "1.0"
 ## Arrow 58 compatible variant metadata support.
 iceberg = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", rev = "9e6116a67bd34790bb73da62beff6a8086d6d012", features = [
     "storage-all",
+    # Not in iceberg-rust's `storage-all`: without it every abfs[s]:// table fails to load.
+    "storage-azdls",
 ] }
 iceberg-catalog-glue = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", rev = "9e6116a67bd34790bb73da62beff6a8086d6d012" }
 iceberg-catalog-hms = { version = "0.8.0", git = "https://github.com/databendlabs/iceberg-rust", rev = "9e6116a67bd34790bb73da62beff6a8086d6d012" }
```

**File**: `src/common/storage/src/operator.rs` (modified, +51/-6)
```diff
@@ -786,12 +786,12 @@ impl IcebergFileIO {
             let bucket = url
                 .host_str()
                 .ok_or_else(|| Error::new(ErrorKind::InvalidInput, "missing bucket in URL"))?;
-            let prefix = format!("{}://{}/", scheme, bucket);
-            let relative_path_pos = if location.starts_with(&prefix) {
-                prefix.len()
-            } else {
-                url.scheme().len() + 3 + bucket.len() + 1
-            };
+            // The relative path starts after the authority, which can carry userinfo:
+            // abfss://<filesystem>@<account>.dfs.core.windows.net/<path>.
+            let authority_start = scheme.len() + 3;
+            let relative_path_pos = location[authority_start..]
+                .find('/')
+                .map_or(location.len(), |i| authority_start + i + 1);
             (Some(bucket), relative_path_pos)
         };
 
@@ -871,6 +871,10 @@ impl IcebergFileIO {
                 "adls.account-name" | "azure.account-name" => Some("account_name"),
                 "adls.account-key" | "azure.account-key" => Some("account_key"),
                 "adls.sas-token" | "azure.sas-token" => Some("sas_token"),
+                "adls.tenant-id" => Some("tenant_id"),
+                "adls.client-id" => Some("client_id"),
+                "adls.client-secret" => Some("client_secret"),
+                "adls.authority-host" => Some("authority_host"),
                 _ => {
                     opendal_config.insert(key.clone(), value.clone());
                     None
@@ -882,6 +886,26 @@ impl IcebergFileIO {
             }
         }
 
+        // Azdls names the container `filesystem` and needs the account endpoint; both are in
+        // the location (`abfss://<filesystem>@<host>/...`), as iceberg-rust's own Azdls
+        // storage reads them.
+        if matches!(scheme, "abfs" | "abfss" | "wasb" | "wasbs") {
+            if !url.username().is_empty() {
+                opendal_config
+                    .entry("filesystem".to_string())
+                    .or_insert_with(|| url.username().to_string());
+            }
+            if let Some(host) = url.host_str() {
+                let http = match scheme {
+                    "abfs" | "wasb" => "http",
+                    _ => "https",
+                };
+                opendal_config
+                    .entry("endpoint".to_string())
+                    .or_insert_with(|| format!("{http}://{host}"));
+            }
+        }
+
         let opendal_scheme = match self.scheme.as_str() {
             "s3" | "s3a" => opendal::Scheme::S3,
             "gs" | "gcs" => opendal::Scheme::Gcs,
@@ -945,6 +969,27 @@ mod tests {
         assert_eq!(path_pos, "s3://bucket/".len());
     }
 
+    #[test]
+    fn iceberg_file_io_azdls_path_skips_filesystem_in_authority() {
+        let file_io = IcebergFileIO {
+            scheme: "abfss".to_string(),
+            props: HashMap::from([("adls.sas-token".to_string(), "sv=token".to_string())]),
+        };
+
+        for prefix in [
+            "abfss://myfs@myaccount.dfs.core.windows.net/",
+            "abfss://myfs@onelake.dfs.fabric.microsoft.com/",
+        ] {
+            let location = format!("{prefix}lakehouse/Tables/ns/t/data/file.parquet");
+            let res = file_io.build_operator(&location);
+
+            assert!(res.is_ok(), "operator build failed: {:?}", res.err());
+            let (op, path_pos) = res.unwrap();
+            assert_eq!(path_pos, prefix.len());
+            assert_eq!(op.info().name(), "myfs");
+        }
+    }
+
     #[test]
     fn iceberg_file_io_rejects_partial_explicit_s3_credentials() {
         let file_io = IcebergFileIO {
```

---

### Incident Patch 4: `7d6d8c14` (2026-09-29)
**Commit Message**: fix(parser): accept and ignore LIMIT in VACUUM DROP TABLE (#20586)

Older clients and internal tasks still send
`VACUUM DROP TABLE [FROM db] LIMIT n`, which was rejected after the
vacuum syntax unification. Parse the LIMIT for compatibility and ignore it.

**File**: `src/query/ast/src/parser/statement.rs` (modified, +4/-2)
```diff
@@ -1470,9 +1470,11 @@ pub fn statement_body(i: Input) -> IResult<Statement> {
     let vacuum_all = value(Statement::VacuumAll(VacuumAllStmt), rule! { VACUUM ~ ALL });
     let vacuum_drop_table = map(
         rule! {
-            VACUUM ~ DROP ~ TABLE ~ (FROM ~ ^#ident)?
+            VACUUM ~ DROP ~ TABLE ~ (FROM ~ ^#ident)? ~ (LIMIT ~ #literal_u64)?
         },
-        |(_, _, _, database_option)| {
+        // `LIMIT` is accepted for compatibility with clients that still send the
+        // legacy `VACUUM DROP TABLE [FROM db] LIMIT n` syntax; the value is ignored.
+        |(_, _, _, database_option, _limit)| {
             Statement::VacuumDropTable(VacuumDropTableStmt {
                 database: database_option.map(|(_, database)| database),
             })
```

**File**: `src/query/ast/tests/it/parser.rs` (modified, +18/-1)
```diff
@@ -1445,7 +1445,6 @@ fn test_removed_vacuum_syntax() {
         "VACUUM ALL LIMIT 10",
         "VACUUM DROP TABLE DRY RUN",
         "VACUUM DROP TABLE DRY RUN SUMMARY",
-        "VACUUM DROP TABLE FROM db LIMIT 10",
         "VACUUM DROP TABLE FROM catalog.db",
         "VACUUM DROPPED OBJECTS FROM db LIMIT 10",
         "VACUUM DROPPED OBJECTS FROM catalog.db",
@@ -1465,6 +1464,24 @@ fn test_removed_vacuum_syntax() {
     }
 }
 
+#[test]
+fn test_vacuum_drop_table_legacy_limit_ignored() {
+    let cases = [
+        ("VACUUM DROP TABLE LIMIT 1000", "VACUUM DROP TABLE"),
+        (
+            "VACUUM DROP TABLE FROM db LIMIT 10",
+            "VACUUM DROP TABLE FROM db",
+        ),
+    ];
+
+    for (sql, expected) in cases {
+        let tokens = tokenize_sql(sql).unwrap();
+        let (stmt, _) = parse_sql(&tokens, Dialect::PostgreSQL).unwrap();
+        assert!(matches!(stmt, Statement::VacuumDropTable(_)), "{sql}");
+        assert_eq!(stmt.to_string(), expected, "{sql}");
+    }
+}
+
 #[test]
 fn test_file_format_trim_space_option() {
     let sql = r#"
```

---

### Incident Patch 5: `a5909393` (2026-09-29)
**Commit Message**: fix(query): match nullable lateral correlation keys (#20583)

**File**: `src/query/sql/src/planner/binder/bind_table_reference/bind_join.rs` (modified, +13/-4)
```diff
@@ -420,11 +420,20 @@ impl Binder {
                 &mut right_conditions,
                 &mut left_conditions,
             )?;
+            // These conditions reconnect the flattened lateral subquery to the outer row. They
+            // are internal correlation keys rather than user-written equality predicates, so
+            // NULL correlation groups must match each other.
             if build_side_cache_info.is_some() {
-                let num_conditions = left_conditions.len();
-                for i in original_num_conditions..num_conditions {
-                    is_null_equal.push(i);
-                }
+                is_null_equal.extend(original_num_conditions..left_conditions.len());
+            } else {
+                is_null_equal.extend(
+                    SubqueryDecorrelatorOptimizer::nullable_condition_indexes(
+                        &left_conditions[original_num_conditions..],
+                        &right_conditions[original_num_conditions..],
+                    )
+                    .into_iter()
+                    .map(|index| index + original_num_conditions),
+                );
             }
             if join_type == JoinType::Cross {
                 join_type = JoinType::Inner;
```

**File**: `tests/sqllogictests/suites/query/lateral.test` (modified, +94/-0)
```diff
@@ -331,5 +331,99 @@ a e r2021 NULL
 a e r2022 NULL
 a e r2023 NULL
 
+# NULL correlation values must reconnect the flattened lateral subquery to the outer row.
+statement ok
+create or replace table nullable_lateral_outer(id int, k int null)
+
+statement ok
+insert into nullable_lateral_outer values (1, 1), (2, NULL), (3, 5)
+
+statement ok
+create or replace table nullable_lateral_inner(k int null, v int)
+
+statement ok
+insert into nullable_lateral_inner values (1, 10), (NULL, 20), (NULL, 30)
+
+statement ok
+set enable_experimental_new_join = 0
+
+query II
+select o.id, t.x from nullable_lateral_outer o, lateral (select o.k as x) t order by o.id
+----
+1 1
+2 NULL
+3 5
+
+query II
+select o.id, t.v from nullable_lateral_outer o, lateral (select v from nullable_lateral_inner i where o.k is null) t order by o.id, t.v
+----
+2 10
+2 20
+2 30
+
+query II
+select o.id, t.v from nullable_lateral_outer o, lateral (select v from nullable_lateral_inner i where i.v > o.k or o.k is null) t order by o.id, t.v
+----
+1 10
+1 20
+1 30
+2 10
+2 20
+2 30
+3 10
+3 20
+3 30
+
+query II
+select o.id, t.v from nullable_lateral_outer o left join lateral (select v from nullable_lateral_inner i where o.k is null) t on true order by o.id, t.v
+----
+1 NULL
+2 10
+2 20
+2 30
+3 NULL
+
+statement ok
+set enable_experimental_new_join = 1
+
+query II
+select o.id, t.x from nullable_lateral_outer o, lateral (select o.k as x) t order by o.id
+----
+1 1
+2 NULL
+3 5
+
+query II
+select o.id, t.v from nullable_lateral_outer o, lateral (select v from nullable_lateral_inner i where o.k is null) t order by o.id, t.v
+----
+2 10
+2 20
+2 30
+
+query II
+select o.id, t.v from nullable_lateral_outer o, lateral (select v from nullable_lateral_inner i where i.v > o.k or o.k is null) t order by o.id, t.v
+----
+1 10
+1 20
+1 30
+2 10
+2 20
+2 30
+3 10
+3 20
+3 30
+
+query II
+select o.id, t.v from nullable_lateral_outer o left join lateral (select v from nullable_lateral_inner i where o.k is null) t on true order by o.id, t.v
+----
+1 NULL
+2 10
+2 20
+2 30
+3 NULL
+
+statement ok
+unset enable_experimental_new_join
+
 statement ok
 drop database test_lateral
```

---

### Incident Patch 6: `1e44fe75` (2026-09-29)
**Commit Message**: fix(query): preserve time in string date arithmetic (#20585)

* fix(query): preserve time in string date arithmetic

* test(query): add golden tests for string inputs to time arithmetic functions

**File**: `src/query/functions/src/cast_rules.rs` (modified, +19/-0)
```diff
@@ -57,6 +57,25 @@ pub fn register(registry: &mut FunctionRegistry) {
     registry.register_default_cast_rules(CAST_FROM_VARIANT_RULES());
     registry.register_auto_try_cast_rules(CAST_FROM_VARIANT_RULES());
 
+    // Time arithmetic returns a Timestamp even for Date inputs. Prefer parsing strings as
+    // Timestamp so that a time component is not silently discarded by the Date overload.
+    let time_arith_cast_rules = registry
+        .default_cast_rules
+        .iter()
+        .filter(|(src, dest)| !matches!((src, dest), (DataType::String, DataType::Date)))
+        .cloned()
+        .collect::<Vec<_>>();
+    for func_name in [
+        "add_hours",
+        "add_minutes",
+        "add_seconds",
+        "subtract_hours",
+        "subtract_minutes",
+        "subtract_seconds",
+    ] {
+        registry.register_additional_cast_rules(func_name, time_arith_cast_rules.iter().cloned());
+    }
+
     for func_name in ["and", "or", "not", "xor", "and_filters", "or_filters"] {
         for data_type in ALL_INTEGER_TYPES {
             registry.register_additional_cast_rules(func_name, [(
```

**File**: `src/query/functions/tests/it/scalars/datetime.rs` (modified, +29/-0)
```diff
@@ -49,6 +49,7 @@ fn test_datetime() {
     test_to_date(file);
     test_date_add_subtract(file);
     test_timestamp_add_subtract(file);
+    test_string_time_add_subtract(file);
     test_date_date_add_sub(file);
     test_timestamp_date_add_sub(file);
     test_date_arith(file);
@@ -300,6 +301,34 @@ fn test_timestamp_add_subtract(file: &mut impl Write) {
     ]);
 }
 
+// String inputs for hour/minute/second arithmetic must resolve to the Timestamp
+// overload so the time component is preserved. Day-based arithmetic keeps the
+// Date overload, since its semantics are whole days.
+fn test_string_time_add_subtract(file: &mut impl Write) {
+    run_ast(file, "add_hours('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "add_minutes('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "add_seconds('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "subtract_hours('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "subtract_minutes('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "subtract_seconds('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "subtract_minutes('2026-09-26', 5)", &[]);
+    run_ast(file, "add_days('2026-09-26 08:34:00', 1)", &[]);
+    run_ast(file, "add_hours(a, b)", &[
+        (
+            "a",
+            StringType::from_data(vec!["2026-09-26 08:34:00", "2026-09-26"]),
+        ),
+        ("b", Int32Type::from_data(vec![1, 2])),
+    ]);
+    run_ast(file, "subtract_seconds(a, b)", &[
+        (
+            "a",
+            StringType::from_data(vec!["2026-09-26 08:34:00", "2026-09-26"]),
+        ),
+        ("b", Int32Type::from_data(vec![1, 2])),
+    ]);
+}
+
 fn test_date_date_add_sub(file: &mut impl Write) {
     run_ast(file, "date_add(year, 10000, to_date(0))", &[]); // failed
     run_ast(file, "date_add(year, 100, to_date(0))", &[]);
```

**File**: `src/query/functions/tests/it/scalars/testdata/datetime.txt` (modified, +116/-0)
```diff
@@ -1099,6 +1099,122 @@ evaluation (internal):
 +--------+-------------------------------------------+
 
 
+ast            : add_hours('2026-09-26 08:34:00', 1)
+raw expr       : add_hours('2026-09-26 08:34:00', 1)
+checked expr   : add_hours<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790415240000000
+output type    : Timestamp
+output domain  : {1790415240000000..=1790415240000000}
+output         : '2026-09-26 09:34:00.000000'
+
+
+ast            : add_minutes('2026-09-26 08:34:00', 1)
+raw expr       : add_minutes('2026-09-26 08:34:00', 1)
+checked expr   : add_minutes<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790411700000000
+output type    : Timestamp
+output domain  : {1790411700000000..=1790411700000000}
+output         : '2026-09-26 08:35:00.000000'
+
+
+ast            : add_seconds('2026-09-26 08:34:00', 1)
+raw expr       : add_seconds('2026-09-26 08:34:00', 1)
+checked expr   : add_seconds<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790411641000000
+output type    : Timestamp
+output domain  : {1790411641000000..=1790411641000000}
+output         : '2026-09-26 08:34:01.000000'
+
+
+ast            : subtract_hours('2026-09-26 08:34:00', 1)
+raw expr       : subtract_hours('2026-09-26 08:34:00', 1)
+checked expr   : subtract_hours<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790408040000000
+output type    : Timestamp
+output domain  : {1790408040000000..=1790408040000000}
+output         : '2026-09-26 07:34:00.000000'
+
+
+ast            : subtract_minutes('2026-09-26 08:34:00', 1)
+raw expr       : subtract_minutes('2026-09-26 08:34:00', 1)
+checked expr   : subtract_minutes<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790411580000000
+output type    : Timestamp
+output domain  : {1790411580000000..=1790411580000000}
+output         : '2026-09-26 08:33:00.000000'
+
+
+ast            : subtract_seconds('2026-09-26 08:34:00', 1)
+raw expr       : subtract_seconds('2026-09-26 08:34:00', 1)
+checked expr   : subtract_seconds<Timestamp, Int64>(CAST<String>("2026-09-26 08:34:00" AS Timestamp), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 1790411639000000
+output type    : Timestamp
+output domain  : {1790411639000000..=1790411639000000}
+output         : '2026-09-26 08:33:59.000000'
+
+
+ast            : subtract_minutes('2026-09-26', 5)
+raw expr       : subtract_minutes('2026-09-26', 5)
+checked expr   : subtract_minutes<Timestamp, Int64>(CAST<String>("2026-09-26" AS Timestamp), CAST<UInt8>(5_u8 AS Int64))
+optimized expr : 1790380500000000
+output type    : Timestamp
+output domain  : {1790380500000000..=1790380500000000}
+output         : '2026-09-25 23:55:00.000000'
+
+
+ast            : add_days('2026-09-26 08:34:00', 1)
+raw expr       : add_days('2026-09-26 08:34:00', 1)
+checked expr   : add_days<Date, Int64>(CAST<String>("2026-09-26 08:34:00" AS Date), CAST<UInt8>(1_u8 AS Int64))
+optimized expr : 20723
+output type    : Date
+output domain  : {20723..=20723}
+output         : '2026-09-27'
+
+
+ast            : add_hours(a, b)
+raw expr       : add_hours(a::String, b::Int32)
+checked expr   : add_hours<Timestamp, Int64>(CAST<String>(a AS Timestamp), CAST<Int32>(b AS Int64))
+evaluation:
++--------+----------------------------------------+---------+------------------------------+
+|        | a                                      | b       | Output                       |
++--------+----------------------------------------+---------+------------------------------+
+| Type   | String                                 | Int32   | Timestamp                    |
+| Domain | {"2026-09-26"..="2026-09-26 08:34:00"} | {1..=2} | Unknown                      |
+| Row 0  | '2
```

**File**: `tests/sqllogictests/suites/query/functions/02_0012_function_datetimes.test` (modified, +47/-0)
```diff
@@ -862,6 +862,53 @@ select add_hours(to_datetime('9999-12-29 23:59:59'), 1)
 ----
 9999-12-30 00:59:59.000000
 
+# String inputs to time arithmetic must retain the time component.
+query T
+select subtract_minutes('2026-09-26 08:34:00', 5)
+----
+2026-09-26 08:29:00.000000
+
+query IIIIII
+select
+    add_hours('2026-09-26 08:34:00', 1) = add_hours(to_timestamp('2026-09-26 08:34:00'), 1),
+    add_minutes('2026-09-26 08:34:00', 1) = add_minutes(to_timestamp('2026-09-26 08:34:00'), 1),
+    add_seconds('2026-09-26 08:34:00', 1) = add_seconds(to_timestamp('2026-09-26 08:34:00'), 1),
+    subtract_hours('2026-09-26 08:34:00', 1) = subtract_hours(to_timestamp('2026-09-26 08:34:00'), 1),
+    subtract_minutes('2026-09-26 08:34:00', 1) = subtract_minutes(to_timestamp('2026-09-26 08:34:00'), 1),
+    subtract_seconds('2026-09-26 08:34:00', 1) = subtract_seconds(to_timestamp('2026-09-26 08:34:00'), 1)
+----
+1 1 1 1 1 1
+
+query T
+select date_sub(minute, 5, '2026-09-26 08:34:00')
+----
+2026-09-26 08:29:00.000000
+
+query T
+select date_add(minute, 5, '2026-09-26 08:34:00')
+----
+2026-09-26 08:39:00.000000
+
+query T
+select date_sub(minute, 5, to_date('2026-09-26'))
+----
+2026-09-25 23:55:00.000000
+
+query T
+select date_add(minute, 5, to_date('2026-09-26'))
+----
+2026-09-26 00:05:00.000000
+
+query T
+select subtract_minutes('2026-09-26', 5)
+----
+2026-09-25 23:55:00.000000
+
+query T
+select subtract_minutes(to_date('2026-09-26'), 5)
+----
+2026-09-25 23:55:00.000000
+
 # 2020-2-29T10:00:00 - 1 minutes
 query ?
 select subtract_minutes(to_datetime(1582970400000000), cast(1, INT32))
```

---

### Incident Patch 7: `dc0acaa3` (2026-09-28)
**Commit Message**: fix(meta): keep in-progress CTAS staging table from vacuum (#20581)

**File**: `src/meta/api/src/api_impl/auto_increment_api_test_suite.rs` (modified, +3/-1)
```diff
@@ -108,7 +108,9 @@ impl AutoIncrementApiTestSuite {
             drop_on: Some(created_on),
             ..TableMeta::default()
         };
-        let created_on = Utc::now();
+        // CTAS staging tables are protected from vacuum for the default retention
+        // period (1 day), so create it as if it were dropped 2 days ago.
+        let created_on = Utc::now() - chrono::Duration::days(2);
 
         // verify the auto increment will be vacuum
         {
```

**File**: `src/meta/api/src/api_impl/garbage_collection_api.rs` (modified, +31/-0)
```diff
@@ -77,6 +77,7 @@ use log::error;
 use log::info;
 use log::warn;
 
+use super::data_retention_util::is_drop_time_retainable;
 use super::index_api::IndexApi;
 use crate::kv_app_error::KVAppError;
 use crate::kv_pb_api::KVPbApi;
@@ -176,6 +177,14 @@ where
 
 pub const ORPHAN_POSTFIX: &str = "orphan";
 
+/// Returns true if `table_name` is the history name of a CTAS staging table,
+/// i.e. `orphan@<ts>`, created by `create_table` with `as_dropped = true`.
+fn is_orphan_table_name(table_name: &str) -> bool {
+    table_name
+        .strip_prefix(ORPHAN_POSTFIX)
+        .is_some_and(|rest| rest.starts_with('@'))
+}
+
 /// Remove copied files for a dropped table.
 ///
 /// Dropped table can not be accessed by any query,
@@ -253,6 +262,10 @@ async fn remove_copied_files_for_dropped_table(
 /// Lists all dropped and non-dropped tables belonging to a Database,
 /// returns those tables that are eligible for garbage collection,
 /// i.e., whose dropped time is in the specified range.
+///
+/// CTAS staging tables (`orphan@<ts>`) whose `drop_on` is within the default
+/// retention period are always skipped, to protect an in-progress CTAS from
+/// being vacuumed concurrently.
 #[logcall::logcall(input = "")]
 #[fastrace::trace]
 pub async fn get_history_tables_for_gc(
@@ -307,6 +320,7 @@ pub async fn get_history_tables_for_gc(
     let mut filter_tb_infos = vec![];
     const BATCH_SIZE: usize = 1000;
 
+    let now = Utc::now();
     let args_len = args.len();
     let mut num_out_of_time_range = 0;
     let mut num_processed = 0;
@@ -365,6 +379,23 @@ pub async fn get_history_tables_for_gc(
                     num_out_of_time_range += 1;
                     continue;
                 }
+
+                // A CTAS staging table (`orphan@<ts>`) is created with `drop_on = now` and is
+                // only turned into a visible table by `commit_table_meta` after all data is
+                // written. A vacuum with a short retention (e.g. 0 days) must not collect it
+                // while the CTAS may still be running, otherwise the files written afterward
+                // are left without any metadata. Keep such tables for at least the default
+                // retention period, regardless of the requested retention.
+                if is_orphan_table_name(table_name)
+                    && is_drop_time_retainable(seq_meta.drop_on, now)
+                {
+                    info!(
+                        "get_history_tables_for_gc: skip CTAS staging table {} {:?}, drop_on {:?} is within the minimum retention period",
+                        table_name, table_id, seq_meta.drop_on
+                    );
+                    num_out_of_time_range += 1;
+                    continue;
+                }
             }
 
             filter_tb_infos.push(TableNIV::new(
```

**File**: `src/meta/schema-api-test-suite/src/schema_api_test_suite.rs` (modified, +89/-1)
```diff
@@ -318,6 +318,8 @@ impl SchemaApiTestSuite {
             + 'static,
     {
         self.table_commit_table_meta(&b.build().await).await?;
+        self.vacuum_skips_recent_ctas_orphan(&b.build().await)
+            .await?;
         self.table_commit_after_drop_different_engine(&b.build().await)
             .await?;
         self.table_commit_table_meta_engine_mismatch(&b.build().await)
@@ -6649,6 +6651,10 @@ impl SchemaApiTestSuite {
             let db_id = orphan_util.db_id();
             let tenant = orphan_util.tenant();
 
+            // CTAS staging tables are protected from vacuum for the default retention
+            // period (1 day), so create it as if it were dropped 2 days ago.
+            let orphan_created_on = Utc::now() - Duration::days(2);
+
             let create_table_req = CreateTableReq {
                 create_option: CreateOption::CreateOrReplace,
                 catalog_name: Some("default".to_string()),
@@ -6657,7 +6663,7 @@ impl SchemaApiTestSuite {
                     db_name: db_name.to_string(),
                     table_name: tbl_name.to_string(),
                 },
-                table_meta: drop_table_meta(created_on),
+                table_meta: drop_table_meta(orphan_created_on),
                 source_table_option: None,
                 as_dropped: true,
                 materialized_view: None,
@@ -6709,6 +6715,88 @@ impl SchemaApiTestSuite {
         Ok(())
     }
 
+    /// A vacuum with retention 0 must not collect the staging table of an in-progress CTAS,
+    /// otherwise its data is removed while the CTAS is still writing.
+    async fn vacuum_skips_recent_ctas_orphan<
+        MT: kvapi::KVApi<Error = MetaError> + DatabaseApi + TableApi + GarbageCollectionApi,
+    >(
+        &self,
+        mt: &MT,
+    ) -> anyhow::Result<()> {
+        let tenant_name = "vacuum_skips_recent_ctas_orphan_tenant";
+        let db_name = "db1";
+        let tbl_name = "t1";
+
+        let mut util = DbTableHarness::new(mt, tenant_name, db_name, tbl_name, "");
+        util.create_db().await?;
+        let tenant = util.tenant();
+
+        let staging_table_req = |drop_on: DateTime<Utc>| CreateTableReq {
+            create_option: CreateOption::CreateOrReplace,
+            catalog_name: Some("default".to_string()),
+            name_ident: TableNameIdent {
+                tenant: tenant.clone(),
+                db_name: db_name.to_string(),
+                table_name: tbl_name.to_string(),
+            },
+            table_meta: TableMeta {
+                schema: Arc::new(TableSchema::new(vec![TableField::new(
+                    "number",
+                    TableDataType::Number(NumberDataType::UInt64),
+                )])),
+                engine: "JSON".to_string(),
+                created_on: drop_on,
+                drop_on: Some(drop_on),
+                ..TableMeta::default()
+            },
+            source_table_option: None,
+            as_dropped: true,
+            materialized_view: None,
+            table_properties: None,
+            table_partition: None,
+        };
+
+        let dropped_table_ids = |drop_ids: &[DroppedId]| -> Vec<u64> {
+            drop_ids
+                .iter()
+                .filter_map(|id| match id {
+                    DroppedId::Table { id, .. } => Some(id.table_id),
+                    DroppedId::Db { .. } => None,
+                })
+                .collect()
+        };
+
+        info!("--- a just created CTAS staging table is not collected with retention 0");
+        {
+            let req = staging_table_req(Utc::now());
+            let resp = mt.create_table(req.clone()).await?;
+
+            let list_req =
+                ListDroppedTableReq::new4(&tenant, None::<String>, Some(Utc::now()), None);
+            let list_resp = mt.get_drop_table_infos(list_req).await?;
+            assert!(
+                !dropped_table_ids(&list_resp.drop_ids).contains(&resp.table_id),
+                "in-progre
```

**File**: `tests/sqllogictests/suites/ee/03_ee_vacuum/03_0000_vacuum_ctas.test` (modified, +10/-10)
```diff
@@ -12,7 +12,8 @@
 ## See the License for the specific language governing permissions and
 ## limitations under the License.
 
-# test orphan data created by failed CTAS could be vacuumed
+# test orphan data created by CTAS is not vacuumed within the minimum retention period (1 day),
+# even if data_retention_time_in_days = 0, since the CTAS may still be running concurrently.
 statement ok
 drop database if exists ctas_test;
 
@@ -35,7 +36,7 @@ select count() from system.tables_with_history where database = 'ctas_test' and
 ----
 0
 
-# verify the orphan files could be vacuumed
+# vacuum with retention 0 must not touch the CTAS staging data
 
 statement ok
 set data_retention_time_in_days = 0;
@@ -44,7 +45,7 @@ statement ok
 vacuum drop table from ctas_test;
 
 
-# the dropped table ctas_test.t should be vacuumed
+# there is still no visible table ctas_test.t
 query I
 select count() from system.tables_with_history where database = 'ctas_test' and name = 't';
 ----
@@ -55,15 +56,14 @@ statement ok
 create stage ctas_stage url='fs:///tmp/ctas/';
 
 
-# The data of the dropped table should be purged:
-# Listing the stage should return an empty result set,
-# except for the verification key '_v_d77aa11285c22e0e1d4593a035c98c0d',
-# which is 1 byte in size.
+# The data of the CTAS staging table should be kept:
+# besides the verification key '_v_d77aa11285c22e0e1d4593a035c98c0d',
+# the data files written by the CTAS are still there.
 
-query TI
-SELECT name, size FROM LIST_STAGE(location => '@ctas_stage')
+query B
+SELECT count() > 1 FROM LIST_STAGE(location => '@ctas_stage')
 ----
-_v_d77aa11285c22e0e1d4593a035c98c0d 1
+1
 
 statement ok
 drop database ctas_test;
```

---

### Incident Patch 8: `8d51739c` (2026-09-28)
**Commit Message**: fix(query): prune unused source columns before window buffering (#20572)

* fix(query): prune wide sources after materializing operator keys

* fix(query): preserve key bindings and runtime filter lineage

* fix(query): limit wide input pruning to windows

* refactor(query): record window input columns during binding

* fix(query): hash window partitions on evaluated keys

The window sort input already evaluates its partition items, so shuffle
on those columns instead of re-evaluating the expressions over source
columns. Wide source columns are then dropped before the exchange, and
WindowPartition no longer needs its own pre-projection.

Drop the join and range-join logic tests that covered the removed
pre-projection and runtime filter paths.

**File**: `src/query/service/src/physical_plans/physical_window.rs` (modified, +20/-17)
```diff
@@ -38,7 +38,6 @@ use databend_common_pipeline_transforms::MemorySettings;
 use databend_common_sql::ColumnSet;
 use databend_common_sql::ScalarExpr;
 use databend_common_sql::Symbol;
-use databend_common_sql::TypeCheck;
 use databend_common_sql::binder::wrap_cast;
 use databend_common_sql::executor::physical_plans::AggregateFunctionDesc;
 use databend_common_sql::executor::physical_plans::AggregateFunctionSignature;
@@ -525,32 +524,38 @@ impl PhysicalPlanBuilder {
             required.remove(&window.index);
         }
         for item in &window_group.scalar_items {
-            item.scalar.collect_used_columns(&mut required);
             required.insert(item.index);
         }
         for window in &window_group.windows {
             for item in &window.arguments {
-                item.scalar.collect_used_columns(&mut required);
                 required.insert(item.index);
             }
             for item in &window.partition_by {
-                item.scalar.collect_used_columns(&mut required);
                 required.insert(item.index);
             }
             for item in &window.order_by {
-                item.order_by_item
-                    .scalar
-                    .collect_used_columns(&mut required);
                 required.insert(item.order_by_item.index);
             }
         }
 
         let child = s_expr.child(0)?;
-        let input = self.build(child, required.clone()).await?;
+        // Sources are needed to evaluate the window inputs, but only the
+        // resulting columns and the parent's outputs need to survive the sort.
+        let mut input_required = required.clone();
+        for item in &window_group.scalar_items {
+            input_required.remove(&item.index);
+        }
+        for item in &window_group.scalar_items {
+            item.scalar.collect_used_columns(&mut input_required);
+        }
+        let input = self.build(child, input_required).await?;
         let input = if window_group.scalar_items.is_empty() {
             input
         } else {
-            let mut projections = required.iter().copied().collect::<Vec<_>>();
+            let mut projections = required
+                .union(self.metadata.read().get_retained_column())
+                .copied()
+                .collect::<Vec<_>>();
             for item in &window_group.scalar_items {
                 projections.push(item.index);
             }
@@ -617,20 +622,15 @@ impl PhysicalPlanBuilder {
         // left join ( select dense_rank() over(order by t1.a desc) as rk
         // from (select 'a2' as a) t1 )s2 on s1.rk=s2.rk;
 
-        // The scalar items in window function is not replaced yet.
-        // The will be replaced in physical plan builder.
+        // The child EvalScalar has already evaluated these expressions. Keep
+        // their results across the sort/window, not their source columns.
         window.arguments.iter().for_each(|item| {
-            item.scalar.collect_used_columns(&mut required);
             required.insert(item.index);
         });
         window.partition_by.iter().for_each(|item| {
-            item.scalar.collect_used_columns(&mut required);
             required.insert(item.index);
         });
         window.order_by.iter().for_each(|item| {
-            item.order_by_item
-                .scalar
-                .collect_used_columns(&mut required);
             required.insert(item.order_by_item.index);
         });
 
@@ -660,6 +660,10 @@ impl PhysicalPlanBuilder {
         let mut w = window.clone();
 
         if w.frame.units.is_range() && w.order_by.len() == 1 {
+            let mut common_ty = input_schema
+                .field_with_name(&w.order_by[0].order_by_item.index.to_string())?
+                .data_type()
+                .clone();
             let order_by = &mut w.order_by[0].order_by_item.scalar;
 
             let mut start = match &mut w.frame.start_bound {
@@ -673,7 +677,6 @@ impl PhysicalPlanBuilder {
             
```

**File**: `src/query/service/tests/it/sql/exec/window.rs` (modified, +142/-0)
```diff
@@ -12,10 +12,152 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+use std::sync::Arc;
+
+use databend_common_catalog::cluster_info::Cluster;
 use databend_common_exception::Result;
+use databend_common_expression::types::DataType;
+use databend_common_sql::Planner;
+use databend_common_sql::plans::Plan;
+use databend_meta_client::types::NodeInfo;
+use databend_query::clusters::ClusterHelper;
+use databend_query::physical_plans::PhysicalPlan;
+use databend_query::physical_plans::PhysicalPlanBuilder;
+use databend_query::physical_plans::Window;
+use databend_query::physical_plans::WindowGroup;
+use databend_query::physical_plans::WindowPartition;
+use databend_query::sessions::TableContextCluster;
+use databend_query::sessions::TableContextSettings;
 use databend_query::test_kits::TestFixture;
 use databend_query::test_kits::expects_ok;
 
+#[tokio::test(flavor = "multi_thread")]
+async fn test_window_inputs_prune_json_after_evaluation() -> Result<()> {
+    let fixture = TestFixture::setup().await?;
+    fixture
+        .execute_command("CREATE TABLE window_json_inputs (d VARIANT)")
+        .await?;
+
+    let cases = [
+        // The original SELECT/QUALIFY shape must reuse the window key columns.
+        (
+            "SELECT try_cast(d:id AS BIGINT) AS id, try_cast(d:ts AS BIGINT) AS ts \
+          FROM window_json_inputs \
+          QUALIFY row_number() OVER (PARTITION BY id ORDER BY ts DESC) = 1",
+            false,
+        ),
+        // Reuse also applies to a subexpression and a QUALIFY predicate.
+        (
+            "SELECT try_cast(d:id AS BIGINT) + 1 FROM window_json_inputs \
+          QUALIFY row_number() OVER (PARTITION BY try_cast(d:id AS BIGINT) \
+          ORDER BY try_cast(d:ts AS BIGINT)) = 1 AND try_cast(d:id AS BIGINT) > 0",
+            false,
+        ),
+        // Multiple windows canonicalize their partition/order input IDs.
+        (
+            "SELECT try_cast(d:id AS BIGINT) AS id, \
+          row_number() OVER (PARTITION BY id ORDER BY try_cast(d:ts AS BIGINT)) AS rn, \
+          rank() OVER (PARTITION BY id ORDER BY try_cast(d:ts AS BIGINT) DESC) AS r \
+          FROM window_json_inputs",
+            false,
+        ),
+        // A filter cannot move below the group that produces its reused key.
+        (
+            "SELECT try_cast(d:id AS BIGINT) AS id, \
+          row_number() OVER (PARTITION BY id ORDER BY try_cast(d:ts AS BIGINT)) AS rn, \
+          rank() OVER (PARTITION BY id ORDER BY try_cast(d:ts AS BIGINT) DESC) AS r \
+          FROM window_json_inputs QUALIFY id > 0",
+            false,
+        ),
+        // RANGE planning must use the evaluated order column's type.
+        (
+            "SELECT try_cast(d:ts AS BIGINT) AS ts, \
+          sum(try_cast(d:id AS BIGINT)) OVER (ORDER BY ts \
+          RANGE BETWEEN 1 PRECEDING AND CURRENT ROW) FROM window_json_inputs",
+            false,
+        ),
+        // The parent still needs the original JSON in these cases.
+        (
+            "SELECT d FROM window_json_inputs QUALIFY row_number() OVER \
+          (PARTITION BY try_cast(d:id AS BIGINT) ORDER BY try_cast(d:ts AS BIGINT)) = 1",
+            true,
+        ),
+        (
+            "SELECT d:payload FROM window_json_inputs QUALIFY row_number() OVER \
+          (PARTITION BY try_cast(d:id AS BIGINT) ORDER BY try_cast(d:ts AS BIGINT)) = 1",
+            true,
+        ),
+    ];
+
+    for nodes in [1, 3] {
+        for (sql, keep_json) in cases {
+            let ctx = fixture.new_query_ctx().await?;
+            ctx.get_settings()
+                .set_setting("enable_planner_cache".to_string(), "0".to_string())?;
+            if nodes == 3 {
+                let members = (0..nodes)
+                    .map(|id| {
+                        let mut node = NodeInfo::create(
+                            id.to_string(),
+                            String::new(),
+                 
```

**File**: `src/query/sql/src/planner/binder/bind_query/bind_select.rs` (modified, +12/-3)
```diff
@@ -62,7 +62,9 @@ use crate::planner::binder::select::SelectAliasCatalog;
 use crate::planner::binder::select::SelectClauseFact;
 use crate::planner::binder::select::SelectList;
 use crate::planner::binder::sort::OrderItems;
+use crate::planner::binder::window::WindowInputColumns;
 use crate::plans::ScalarExpr;
+use crate::plans::VisitorMut as _;
 
 #[derive(Clone, Default)]
 struct SelectClauseFacts {
@@ -448,18 +450,25 @@ impl Binder {
 
         // bind window
         // window run after the HAVING clause but before the ORDER BY clause.
+        let mut window_inputs = WindowInputColumns::default();
         if !from_context.windows.window_functions.is_empty() {
-            let window_functions = from_context.windows.window_functions.clone();
-            s_expr = self.bind_window_functions(&window_functions, s_expr)?;
+            (s_expr, window_inputs) =
+                self.bind_window_functions(&from_context.windows.window_functions, s_expr)?;
+            for item in select_info.projection_scalars.values_mut() {
+                window_inputs.visit(&mut item.scalar)?;
+            }
         }
 
         // Bind lazy Set-returning functions after aggregate plan.
         if !from_context.srf_info.lazy_srf_set.is_empty() {
             s_expr = self.bind_project_set(&mut from_context, s_expr, true)?;
+            // Preserve the existing reuse boundary: extending QUALIFY reuse
+            // across ProjectSet row expansion is outside this refactor's scope.
+            window_inputs = WindowInputColumns::default();
         }
 
         if let Some(qualify) = qualify {
-            s_expr = self.bind_qualify(&mut from_context, qualify, s_expr)?;
+            s_expr = self.bind_qualify(&mut from_context, qualify, s_expr, &mut window_inputs)?;
         }
 
         if stmt.distinct {
```

**File**: `src/query/sql/src/planner/binder/qualify.rs` (modified, +4/-1)
```diff
@@ -24,6 +24,7 @@ use crate::binder::ExprContext;
 use crate::binder::ScalarBinder;
 use crate::binder::aggregate::AggregateRewriter;
 use crate::binder::into_conjunctions;
+use crate::binder::window::WindowInputColumns;
 use crate::binder::window::WindowRewriter;
 use crate::binder::window::find_replaced_window_function;
 use crate::optimizer::ir::SExpr;
@@ -66,11 +67,12 @@ impl Binder {
         Ok(scalar)
     }
 
-    pub fn bind_qualify(
+    pub(super) fn bind_qualify(
         &mut self,
         bind_context: &mut BindContext,
         qualify: ScalarExpr,
         child: SExpr,
+        window_inputs: &mut WindowInputColumns,
     ) -> Result<SExpr> {
         bind_context.expr_context = ExprContext::QualifyClause;
 
@@ -87,6 +89,7 @@ impl Binder {
                 let mut qualify_checker = QualifyChecker::new(bind_context);
                 qualify_checker.visit(&mut qualify)?;
             }
+            window_inputs.visit(&mut qualify)?;
             qualify
         };
 
```

**File**: `src/query/sql/src/planner/binder/window.rs` (modified, +74/-8)
```diff
@@ -55,12 +55,59 @@ use crate::plans::WindowOrderBy;
 use crate::plans::WindowPartition;
 use crate::plans::walk_expr_mut;
 
+/// Deterministic window inputs available to consumers in the same query block.
+/// Record the final column IDs after WindowGroup input canonicalization.
+#[derive(Default)]
+pub(super) struct WindowInputColumns {
+    scalars: HashMap<ScalarExpr, ScalarExpr>,
+}
+
+impl WindowInputColumns {
+    fn extend<'a>(&mut self, items: impl IntoIterator<Item = &'a ScalarItem>) -> Result<()> {
+        for item in items {
+            if matches!(
+                item.scalar,
+                ScalarExpr::FunctionCall(_) | ScalarExpr::CastExpr(_)
+            ) && item.scalar.is_deterministic()
+            {
+                self.scalars
+                    .entry(item.scalar.clone())
+                    .or_insert(item.bound_column_expr("window_input".to_string())?);
+            }
+        }
+        Ok(())
+    }
+}
+
+impl VisitorMut<'_> for WindowInputColumns {
+    fn visit(&mut self, expr: &mut ScalarExpr) -> Result<()> {
+        if let Some(column) = self.scalars.get(expr)
+            && column.data_type().as_ref() == expr.data_type().as_ref()
+        {
+            *expr = column.clone();
+            return Ok(());
+        }
+        // Only rewrite row-local consumers in this query block. Lambdas,
+        // subqueries, aggregates and window functions have separate scopes.
+        match expr {
+            ScalarExpr::FunctionCall(func) => {
+                for argument in &mut func.arguments {
+                    self.visit(argument)?;
+                }
+            }
+            ScalarExpr::CastExpr(cast) => self.visit(&mut cast.argument)?,
+            _ => {}
+        }
+        Ok(())
+    }
+}
+
 impl Binder {
     pub(super) fn bind_window_functions(
         &mut self,
         window_infos: &[WindowFunctionInfo],
         child: SExpr,
-    ) -> Result<SExpr> {
+    ) -> Result<(SExpr, WindowInputColumns)> {
         bind_window_function_infos(&self.ctx, window_infos, child)
     }
 
@@ -690,17 +737,30 @@ pub fn bind_window_function_info(
     ))
 }
 
-pub fn bind_window_function_infos(
+fn bind_window_function_infos(
     ctx: &Arc<dyn TableContext>,
     window_infos: &[WindowFunctionInfo],
     child: SExpr,
-) -> Result<SExpr> {
+) -> Result<(SExpr, WindowInputColumns)> {
+    let mut inputs = WindowInputColumns::default();
     if window_infos.is_empty() {
-        return Ok(child);
+        return Ok((child, inputs));
     }
 
-    if window_infos.len() == 1 {
-        return bind_window_function_info(ctx, &window_infos[0], child);
+    if let [window] = window_infos {
+        inputs.extend(
+            window
+                .arguments
+                .iter()
+                .chain(&window.partition_by_items)
+                .chain(
+                    window
+                        .order_by_items
+                        .iter()
+                        .map(|order| &order.order_by_item),
+                ),
+        )?;
+        return Ok((bind_window_function_info(ctx, window, child)?, inputs));
     }
 
     let mut groups = Vec::new();
@@ -777,9 +837,15 @@ pub fn bind_window_function_infos(
             .is_none_or(|window| window.partition_by.is_empty())
     });
 
-    Ok(groups.into_iter().fold(child, |child, window_group| {
+    // Prefer the outermost group's result when several groups evaluate the
+    // same expression, so consumers do not retain an earlier duplicate column.
+    for group in groups.iter().rev() {
+        inputs.extend(&group.scalar_items)?;
+    }
+    let child = groups.into_iter().fold(child, |child, window_group| {
         SExpr::create_unary(Arc::new(window_group.into()), Arc::new(child))
-    }))
+    });
+    Ok((child, inputs))
 }
 
 #[derive(Clone, Debug, PartialEq, Eq)]
```

---

### Incident Patch 9: `8266d4a7` (2026-09-28)
**Commit Message**: fix(query): align name-filtered table history with list results (#20567)

**File**: `src/query/storages/system/src/tables_table.rs` (modified, +27/-3)
```diff
@@ -935,11 +935,35 @@ where TablesTable<WITH_HISTORY, WITHOUT_VIEW>: HistoryAware
                             }
                         }
                     } else if WITH_HISTORY {
-                        // Only can call get_table
-                        let mut tables = Vec::new();
+                        // Match the list path: include current tables and dropped history,
+                        // but exclude old table versions superseded by REPLACE with no drop_on.
+                        let mut tables = if default_catalog {
+                            let names: Vec<_> = tables_names.iter().cloned().collect();
+                            match ctl.mget_tables(&tenant, db_name, &names).await {
+                                Ok(t) => t,
+                                Err(err) => {
+                                    let msg = format!(
+                                        "Failed to get current tables in database: {}.{}, {}",
+                                        ctl.name(),
+                                        db_name,
+                                        err
+                                    );
+                                    warn!("{}", msg);
+                                    ctx.push_warning(msg);
+                                    continue;
+                                }
+                            }
+                        } else {
+                            Vec::new()
+                        };
                         for table_name in &tables_names {
                             match ctl.get_table_history(&tenant, db_name, table_name).await {
-                                Ok(t) => tables.extend(t),
+                                Ok(history) => {
+                                    tables.extend(history.into_iter().filter(|table| {
+                                        !default_catalog
+                                            || table.get_table_info().meta.drop_on.is_some()
+                                    }));
+                                }
                                 Err(err) => {
                                     let msg = format!(
                                         "Failed to get_table_history tables in database: {}.{}, {}",
```

**File**: `tests/sqllogictests/suites/base/12_time_travel/12_0007_history_name_filter.test` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+# CTAS REPLACE leaves the old table with drop_on = NULL. A name-filtered
+# history lookup must exclude it, just like the database-wide scan does.
+statement ok
+CREATE DATABASE db_12_0007_history
+
+statement ok
+CREATE TABLE db_12_0007_history.history_name_filter_120007 (id INT)
+
+# Preserve the original ID so the ID-only lookup can be checked after REPLACE.
+statement ok
+SET VARIABLE history_name_filter_old_id = (SELECT table_id FROM system.tables
+WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007')
+
+statement ok
+CREATE OR REPLACE TABLE db_12_0007_history.history_name_filter_120007 AS SELECT 1 AS id
+
+statement ok
+SET VARIABLE history_name_filter_new_id = (SELECT table_id FROM system.tables
+WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007')
+
+query B
+SELECT count(*) = 1 AND max(table_id) = (
+    SELECT table_id FROM system.tables
+    WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007'
+) FROM system.tables_with_history
+WHERE name = 'history_name_filter_120007'
+----
+1
+
+query B
+SELECT count(*) = 1 FROM system.tables_with_history
+WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007'
+----
+1
+
+# Check the actual rows as well as the counts above. A superseded ID
+# must return no rows, while the new ID still resolves to the current table.
+query I
+SELECT table_id FROM system.tables_with_history
+WHERE table_id = $history_name_filter_old_id
+----
+
+query B
+SELECT table_id = $history_name_filter_new_id FROM system.tables_with_history
+WHERE table_id = $history_name_filter_new_id
+----
+1
+
+query B
+SELECT table_id = $history_name_filter_new_id FROM system.tables_with_history
+WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007'
+ORDER BY table_id
+----
+1
+
+# A dropped table is still visible when there is no current table.
+statement ok
+DROP TABLE db_12_0007_history.history_name_filter_120007
+
+query B
+SELECT count(*) = 1 FROM system.tables_with_history
+WHERE database = 'db_12_0007_history' AND name = 'history_name_filter_120007'
+  AND dropped_on IS NOT NULL
+----
+1
+
+statement ok
+UNSET VARIABLE (history_name_filter_old_id, history_name_filter_new_id)
+
+statement ok
+DROP DATABASE db_12_0007_history
```

---

### Incident Patch 10: `683c564e` (2026-09-24)
**Commit Message**: fix(query): release table locks before analyze and rebase statistics (#20551)

* fix(query): release the mutation table lock before the analyze hook

* fix(storage): rebase analyze statistics on concurrent appends

Collect segment summaries during the existing ANALYZE pass instead of
reading every segment again immediately before the metadata CAS. This
shortens the commit window from a full-table metadata scan to a normal
snapshot commit while preserving progress reporting.

Extract the per-segment collection into SegmentAnalyzer, shared by the
collect sources and the sink, with the reuse-or-scan decision isolated
in a pure CollectPolicy::plan. When the snapshot advances through
append-only commits before the statistics are committed, the sink feeds
the appended segments through the same analyzer, so HLL, column
statistics, Top-N, count-min sketches and KLL sketches all cover the
latest snapshot. KLL sketches and collectors are kept until commit so
the histogram buckets are derived after the rebase; window histograms
have no mergeable form and keep describing the base snapshot, which is
how they are consumed between two ANALYZE runs anyway.

Schema changes, cluster-key changes and 

**File**: `src/query/service/src/interpreters/hook/analyze_hook.rs` (modified, +21/-30)
```diff
@@ -23,12 +23,10 @@ use databend_common_exception::Result;
 use databend_common_pipeline::core::ExecutionInfo;
 use databend_common_pipeline::core::Pipeline;
 use databend_common_storages_fuse::FuseTable;
-use databend_common_storages_fuse::operations::AnalyzeHistogramInfo;
-use databend_storages_common_table_meta::table::OPT_KEY_ANALYZE_FREQUENCY_COLUMNS;
+use databend_common_storages_fuse::operations::AnalyzeOptions;
 use log::info;
+use log::warn;
 
-use crate::interpreters::common::table_option_validation::analyze_count_min_sketch_error_rate_from_options;
-use crate::interpreters::common::table_option_validation::analyze_top_n_size_from_options;
 use crate::interpreters::hook::resolve_current_table_name_by_id;
 use crate::interpreters::hook::table_id_matches_target;
 use crate::pipelines::executor::ExecutorSettings;
@@ -76,7 +74,7 @@ pub(crate) async fn execute_analyze_hook(ctx: Arc<QueryContext>, desc: AnalyzeDe
             info!("Analyze job completed successfully");
         }
         Err(e) => {
-            info!("Analyze job failed: {:?}", e);
+            warn!("Analyze job failed (code {}): {}", e.code(), e);
         }
     }
 
@@ -107,35 +105,28 @@ pub(crate) async fn do_analyze(ctx: Arc<QueryContext>, desc: AnalyzeDesc) -> Res
         return Ok(());
     }
     let fuse_table = FuseTable::try_from_table(table.as_ref())?;
-    let table_options = fuse_table.get_table_info().options();
-    let top_n_size = analyze_top_n_size_from_options(table_options)?;
-    let count_min_sketch_error_rate =
-        analyze_count_min_sketch_error_rate_from_options(table_options)?;
-    let frequency_columns = table_options
-        .get(OPT_KEY_ANALYZE_FREQUENCY_COLUMNS)
-        .cloned();
-    let mut pipeline = Pipeline::create();
-    let Some(table_snapshot) = fuse_table.read_table_snapshot().await? else {
+    let options =
+        AnalyzeOptions::from_table_options(fuse_table.get_table_info().options())?.no_scan();
+    execute_analyze(ctx, fuse_table, options).await
+}
+
+/// Run ANALYZE over the table's current snapshot to completion. A table without a
+/// snapshot has nothing to analyze.
+pub(crate) async fn execute_analyze(
+    ctx: Arc<QueryContext>,
+    table: &FuseTable,
+    options: AnalyzeOptions,
+) -> Result<()> {
+    let Some(snapshot) = table.read_table_snapshot().await? else {
         return Ok(());
     };
-    fuse_table.do_analyze(
-        ctx.clone(),
-        table_snapshot,
-        &mut pipeline,
-        AnalyzeHistogramInfo::None,
-        top_n_size,
-        frequency_columns,
-        count_min_sketch_error_rate,
-        true,
-        false,
-    )?;
+    let mut pipeline = Pipeline::create();
+    table.do_analyze(ctx.clone(), snapshot, &mut pipeline, options)?;
     pipeline.set_max_threads(ctx.get_settings().get_max_threads()? as usize);
     let executor_settings = ExecutorSettings::try_create(ctx.clone())?;
-    let pipelines = vec![pipeline];
-    let complete_executor = PipelineCompleteExecutor::from_pipelines(pipelines, executor_settings)?;
-    ctx.set_executor(complete_executor.get_inner())?;
-    complete_executor.execute().await?;
-    Ok(())
+    let executor = PipelineCompleteExecutor::from_pipelines(vec![pipeline], executor_settings)?;
+    ctx.set_executor(executor.get_inner())?;
+    executor.execute().await
 }
 
 async fn resolve_analyze_desc(
```

**File**: `src/query/service/src/interpreters/hook/hook.rs` (modified, +155/-0)
```diff
@@ -21,6 +21,8 @@ use std::time::Instant;
 use databend_common_catalog::lock::LockTableOption;
 use databend_common_pipeline::core::ExecutionInfo;
 use databend_common_pipeline::core::Pipeline;
+use databend_common_pipeline::core::SharedLockGuard;
+use databend_common_pipeline::core::always_callback;
 use databend_common_sql::executor::physical_plans::MutationKind;
 use log::warn;
 
@@ -38,6 +40,26 @@ use crate::interpreters::hook::table_hook_scheduler::TableHookTaskSettings;
 use crate::sessions::QueryContext;
 use crate::sessions::TableContextTableAccess;
 
+/// Register the release point of a handed-over table lock on the finished-callback chain.
+///
+/// The release is a normal callback so it runs in chain order: callbacks registered before it
+/// still run under the lock, callbacks registered after it run without the lock. An always
+/// callback is added as a safety net in case an earlier callback failed and interrupted the
+/// normal chain. Both are no-ops once the guard has been taken.
+pub(crate) fn register_lock_release(pipeline: &mut Pipeline, lock_guard: &SharedLockGuard) {
+    let guard = lock_guard.clone();
+    pipeline.set_on_finished(move |_info: &ExecutionInfo| {
+        drop(guard.try_take());
+        Ok(())
+    });
+
+    let guard = lock_guard.clone();
+    pipeline.set_on_finished(always_callback(move |_info: &ExecutionInfo| {
+        drop(guard.try_take());
+        Ok(())
+    }));
+}
+
 /// Hook operator.
 pub struct HookOperator {
     ctx: Arc<QueryContext>,
@@ -46,6 +68,12 @@ pub struct HookOperator {
     table: String,
     mutation_kind: MutationKind,
     lock_opt: LockTableOption,
+    /// The table lock acquired by the main operation, if any.
+    ///
+    /// The main pipeline and the compact/refresh hooks run under this lock. It is released
+    /// before the analyze hook, which only reads snapshots and commits statistics through a
+    /// sequence CAS, so it must not extend the lock hold time.
+    lock_guard: Option<SharedLockGuard>,
 }
 
 impl HookOperator {
@@ -64,9 +92,21 @@ impl HookOperator {
             table,
             mutation_kind,
             lock_opt,
+            lock_guard: None,
         }
     }
 
+    /// Hand the main operation's table lock over to the hook chain.
+    ///
+    /// The caller must not also register the guard on the pipeline; the hook chain owns its
+    /// release point. Callers that hand over a lock should pass `LockTableOption::NoLock` as
+    /// `lock_opt`, otherwise the compact hook would queue a second lock revision behind the
+    /// one it already holds.
+    pub fn with_lock_guard(mut self, lock_guard: Option<SharedLockGuard>) -> Self {
+        self.lock_guard = lock_guard;
+        self
+    }
+
     /// Execute the hook operator.
     /// The hook operator will:
     /// 1. Compact if needed.
@@ -82,12 +122,25 @@ impl HookOperator {
 
         self.execute_compact(pipeline).await;
         self.execute_refresh(pipeline).await;
+        // Compaction and reclustering mutate the table and rely on the main operation's lock.
+        // Analyze only reads snapshots and commits statistics with a sequence CAS, so the lock
+        // is released here to keep other maintenance jobs from waiting on it.
+        self.release_lock_guard(pipeline);
         self.execute_analyze(pipeline).await;
     }
 
+    fn release_lock_guard(&self, pipeline: &mut Pipeline) {
+        if let Some(lock_guard) = &self.lock_guard {
+            register_lock_release(pipeline, lock_guard);
+        }
+    }
+
     #[fastrace::trace]
     #[async_backtrace::framed]
     pub async fn execute_async(&self, pipeline: &mut Pipeline) {
+        // Async hooks acquire their own lock with retry, so the main operation's lock is
+        // released as soon as the main pipeline finishes.
+        self.release_lock_guard(pipeline);
         if pipeline.is_empty() {
             return;
         }
@@ -194,3 +247,105 @@ impl HookOperator {
         hook_analyze(self.ct
```

**File**: `src/query/service/src/interpreters/interpreter_mutation.rs` (modified, +5/-8)
```diff
@@ -140,15 +140,11 @@ impl Interpreter for MutationInterpreter {
                     .add_sink(|input| Ok(ProcessorPtr::create(EmptySink::create(input))))?;
             }
 
-            // Execute hook.
+            // Execute hook. The table lock acquired by the binder is handed over to the hook
+            // chain, which keeps it for the main pipeline and the compact hook and releases it
+            // before analyze.
             self.execute_hook(&mutation, &mut build_res).await;
 
-            let lock_guard = mutation
-                .lock_guard
-                .as_ref()
-                .and_then(|holder| holder.try_take());
-            build_res.main_pipeline.add_lock_guard(lock_guard);
-
             Ok(build_res)
         })
     }
@@ -187,7 +183,8 @@ impl MutationInterpreter {
             mutation.table_name.clone(),
             mutation_kind,
             hook_lock_opt,
-        );
+        )
+        .with_lock_guard(mutation.lock_guard.clone());
         hook_operator.execute(&mut build_res.main_pipeline).await;
     }
 
```

**File**: `src/query/service/src/interpreters/interpreter_replace.rs` (modified, +5/-8)
```diff
@@ -105,12 +105,6 @@ impl Interpreter for ReplaceInterpreter {
             let (physical_plan, purge_info) = self.build_physical_plan().await?;
             let mut pipeline =
                 build_query_pipeline_without_render_result_set(&self.ctx, &physical_plan).await?;
-            let lock_guard = self
-                .plan
-                .lock_guard
-                .as_ref()
-                .and_then(|holder| holder.try_take());
-            pipeline.main_pipeline.add_lock_guard(lock_guard);
 
             // purge
             if let Some((files, stage_info, options)) = purge_info {
@@ -123,7 +117,9 @@ impl Interpreter for ReplaceInterpreter {
                 )?;
             }
 
-            // Execute hook.
+            // Execute hook. The table lock acquired by the binder is handed over to the hook
+            // chain, which keeps it for the main pipeline and the compact hook and releases it
+            // before analyze.
             {
                 let hook_operator = HookOperator::create(
                     self.ctx.clone(),
@@ -132,7 +128,8 @@ impl Interpreter for ReplaceInterpreter {
                     self.plan.table.clone(),
                     MutationKind::Replace,
                     LockTableOption::NoLock,
-                );
+                )
+                .with_lock_guard(self.plan.lock_guard.clone());
                 hook_operator.execute(&mut pipeline.main_pipeline).await;
             }
 
```

**File**: `src/query/service/src/interpreters/interpreter_table_analyze.rs` (modified, +11/-24)
```diff
@@ -30,17 +30,15 @@ use databend_common_statistics::DEFAULT_HISTOGRAM_BUCKETS;
 use databend_common_storages_factory::Table;
 use databend_common_storages_fuse::FuseTable;
 use databend_common_storages_fuse::operations::AnalyzeHistogramInfo;
+use databend_common_storages_fuse::operations::AnalyzeOptions;
 use databend_common_storages_fuse::operations::HistogramInfoSink;
 use databend_storages_common_index::Index;
 use databend_storages_common_index::RangeIndex;
-use databend_storages_common_table_meta::table::OPT_KEY_ANALYZE_FREQUENCY_COLUMNS;
 use databend_storages_common_table_meta::table::OPT_KEY_ANALYZE_HISTOGRAM_ALGORITHM;
 use databend_storages_common_table_meta::table::OPT_KEY_ANALYZE_HISTOGRAM_KLL_RELATIVE_ERROR;
 use log::info;
 
 use crate::interpreters::Interpreter;
-use crate::interpreters::common::table_option_validation::analyze_count_min_sketch_error_rate_from_options;
-use crate::interpreters::common::table_option_validation::analyze_top_n_size_from_options;
 use crate::physical_plans::PhysicalPlan;
 use crate::physical_plans::PhysicalPlanBuilder;
 use crate::pipelines::PipelineBuildResult;
@@ -203,12 +201,7 @@ impl Interpreter for AnalyzeTableInterpreter {
             let collect_histogram = plan.histogram_requested
                 || has_table_histogram_policy(table_options)
                 || self.ctx.get_settings().get_enable_analyze_histogram()?;
-            let top_n_size = analyze_top_n_size_from_options(table_options)?;
-            let count_min_sketch_error_rate =
-                analyze_count_min_sketch_error_rate_from_options(table_options)?;
-            let frequency_columns = table_options
-                .get(OPT_KEY_ANALYZE_FREQUENCY_COLUMNS)
-                .cloned();
+            let mut options = AnalyzeOptions::from_table_options(table_options)?;
             if collect_histogram {
                 if self.plan.no_scan {
                     return Err(ErrorCode::BadArguments(
@@ -291,26 +284,20 @@ impl Interpreter for AnalyzeTableInterpreter {
                     }
                 }
             }
-            if self.plan.no_scan
-                && (top_n_size.is_some() || count_min_sketch_error_rate.is_some())
-                && frequency_columns
-                    .as_ref()
-                    .is_some_and(|columns| !columns.trim().is_empty())
-            {
-                return Err(ErrorCode::BadArguments(
-                    "ANALYZE TABLE NOSCAN cannot be used with frequency statistics collection because frequency statistics collection must scan table data",
-                ));
+            if self.plan.no_scan {
+                if options.frequency.is_some() {
+                    return Err(ErrorCode::BadArguments(
+                        "ANALYZE TABLE NOSCAN cannot be used with frequency statistics collection because frequency statistics collection must scan table data",
+                    ));
+                }
+                options = options.no_scan();
             }
+            options = options.with_histogram(histogram_info);
             table.do_analyze(
                 self.ctx.clone(),
                 snapshot,
                 &mut build_res.main_pipeline,
-                histogram_info,
-                top_n_size,
-                frequency_columns,
-                count_min_sketch_error_rate,
-                self.plan.no_scan,
-                true,
+                options,
             )?;
             Ok(build_res)
         })
```

#### Recent Merged Pull Requests:
- **PR #20599** (2026-09-30): fix(planner): keep rank limit off eager aggregates below joins (@youngsofun)
- **PR #20593** (2026-09-30): feat(query): distribute data rewrite of ALTER TABLE MODIFY COLUMN (@SkyFan2002)
- **PR #20592** (2026-09-30): fix(query): keep scalar eager aggregates out of inner/cross joins (@sundy-li)
- **PR #20590** (2026-09-29): fix(storage): read Iceberg tables on Azure (abfs[s]) (@djouallah)
- **PR #20589** (closed): fix(storage): read Iceberg tables on Azure (abfs[s]) (@djouallah)
- **PR #20586** (2026-09-29): fix(parser): accept and ignore LIMIT in VACUUM DROP TABLE (@TCeason)
- **PR #20585** (2026-09-29): fix(query): preserve time in string date arithmetic (@TCeason)
- **PR #20583** (2026-09-29): fix(query): match nullable lateral correlation keys (@youngsofun)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
