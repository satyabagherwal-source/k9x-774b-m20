# Forensic Learning Record (Deep Inspection): paradedb/paradedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/paradedb-paradedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/paradedb/paradedb](https://github.com/paradedb/paradedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:30.055Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `paradedb/paradedb`
- **Description**: One Postgres for your application data, full-text search, vector retrieval, and aggregations. Home of the pg_search extension.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9317 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/src/backrest.rs`
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
use clap::{ArgAction, Parser};
use serde_json::Value;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Parser)]
pub struct SnapshotHeapArgs {
    #[command(flatten)]
    options: PgBackRestOptions,
}

#[derive(Parser)]
pub struct RestoreHeapArgs {
    #[command(flatten)]
    options: PgBackRestOptions,

    /// Restore without pgBackRest's --delta option.
    #[arg(long = "no-delta", action = ArgAction::SetFalse, default_value_t = true)]
    delta: bool,
}

#[derive(Parser)]
struct PgBackRestOptions {
    /// Benchmark dataset name.
    #[arg(long, default_value = "stackoverflow")]
    dataset: String,

    /// Size label for the snapshot, e.g. "100k", "1m", or "20m".
    #[arg(long)]
    size: String,

    /// PostgreSQL data directory to snapshot or restore. Defaults to PGDATA when set.
    #[arg(long, env = "PGDATA")]
    pgdata: Option<PathBuf>,

    /// Existing pgBackRest config. When set, repo and pgdata options are ignored.
    /// The stanza must still be provided with --stanza.
    #[arg(long)]
    config: Option<PathBuf>,

    /// pgBackRest stanza name.
    #[arg(long)]
    stanza: Option<String>,

    /// S3 bucket for generated pgBackRest configs.
    #[arg(long)]
    repo_bucket: Option<String>,

    /// Path prefix inside the S3 bucket. The dataset and size are appended.
    #[arg(long)]
    repo_path_prefix: Option<String>,

    /// S3 region for generated pgBackRest configs.
    #[arg(long)]
    repo_region: Option<String>,

    /// S3 endpoint for generated pgBackRest configs.
    #[arg(long)]
    repo_endpoint: Option<String>,

    /// S3 credential mode for generated pgBackRest configs.
    #[arg(long, value_parser = ["shared", "auto", "web-id"])]
    repo_s3_key_type: Option<String>,

    /// Max pgBackRest worker processes. Defaults to available CPUs.
    #[arg(long)]
    process_max: Option<usize>,
}

struct PreparedConfig {
    path: PathBuf,
    stanza: String,
    generated: bool,
}

impl Drop for PreparedConfig {
    fn drop(&mut self) {
        if self.generated {
            let _ = fs::remove_file(&self.path);
        }
    }
}

struct AwsCredentials {
    access_key_id: String,
    secret_access_key: String,
    session_token: Option<String>,
}

struct GeneratedConfig<'a> {
    pgdata: &'a Path,
    repo_bucket: &'a str,
    repo_endpoint: &'a str,
    repo_path: String,
    repo_region: &'a str,
    repo_s3_key_type: &'a str,
    stanza: &'a str,
    log_path: PathBuf,
    spool_path: PathBuf,
    process_max: usize,
    credentials: Option<AwsCredentials>,
}

pub fn run_snapshot_heap(args: SnapshotHeapArgs) -> Result<()> {
    let config = prepare_config(&args.options)?;
    run_pgbackrest(&config, &["--no-online", "stanza-create"])?;
    run_pgbackrest(&config, &["--type=full", "--no-online", "backup"])?;
    run_pgbackrest(&config, &["info"])?;
    Ok(())
}

pub fn run_restore_heap(args: RestoreHeapArgs) -> Result<()> {
    let config = prepare_config(&args.options)?;
    let backup_count = backup_count(&config)?;
    if backup_count == 0 {
        bail!(
            "No pgBackRest snapshot found for '{}' ({})",
            args.options.dataset,
            args.options.size
        );
    }
    println!(
        "Found {backup_count} snapshot backup(s) for '{}' ({}).",
        args.options.dataset, args.options.size
    );

    let mut restore_args = Vec::new();
    if args.delta {
        restore_args.push("--delta");
    }
    restore_args.push("restore");
    run_pgbackrest(&config, &restore_args)?;
    Ok(())
}

fn prepare_config(options: &PgBackRestOptions) -> Result<PreparedConfig> {
    let stanza = options
        .stanza
        .as_deref()
        .with_context(|| "Provide --stanza")?;
    if let Some(config) = &options.config {
        return Ok(PreparedConfig {
            path: config.clone(),
            stanza: stanza.to_string(),
            generated: false,
        });
    }

    let pgdata = options
        .pgdata
        .as_deref()
        .with_context(|| "Provide --pgdata, set PGDATA, or pass --config")?;
    let temp_dir = env::temp_dir();
    let log_path = temp_dir.join("pgbackrest-log");
    let spool_path = temp_dir.join("pgbackrest-spool");
    fs::create_dir_all(&log_path)
        .with_context(|| format!("Failed to create '{}'", log_path.display()))?;
    fs::create_dir_all(&spool_path)
        .with_context(|| format!("Failed to create '{}'", spool_path.display()))?;

    let config_path = temp_dir.join(format!(
        "pgbackrest-{}-{}-{}.conf",
        safe_path_component(&options.dataset),
        safe_path_component(&options.size),
        std::process::id()
    ));
    let repo_bucket = options
        .repo_bucket
        .as_deref()
        .with_context(|| "Provide --repo-bucket or pass --config")?;
    let repo_path_prefix = options
        .repo_path_prefix
        .as_deref()
        .with_context(|| "Provide --repo-path-prefix or pass --config")?;
    let repo_region = options
        .repo_region
        .as_deref()
        .with_context(|| "Provide --repo-region or pass --config")?;
    let repo_endpoint = options
        .repo_endpoint
        .as_deref()
        .with_context(|| "Provide --repo-endpoint or pass --config")?;
    let repo_s3_key_type = options
        .repo_s3_key_type
        .as_deref()
        .with_context(|| "Provide --repo-s3-key-type or pass --config")?;
    let repo_path = repo_path(repo_path_prefix, &options.dataset, &options.size);
    let credentials = match repo_s3_key_type {
        "shared" => Some(load_aws_credentials()?),
        "auto" | "web-id" => None,
        _ => unreachable!("clap validates repo_s3_key_type"),
    };
    let process_max = options.process_max.unwrap_or_else(|| {
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1)
    });

    let config = render_config(&GeneratedConfig {
        pgdata,
        repo_bucket,
        repo_endpoint,
        repo_path,
        repo_region,
        repo_s3_key_type,
        stanza,
        log_path,
        spool_path,
        process_max,
        credentials,
    });
    write_private_config(&config_path, config.as_bytes())
        .with_context(|| format!("Failed to write '{}'", config_path.display()))?;

    Ok(PreparedConfig {
        path: config_path,
        stanza: stanza.to_string(),
        generated: true,
    })
}

fn write_private_config(path: &Path, contents: &[u8]) -> Result<()> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path)?;
    file.write_all(contents)?;
    Ok(())
}

fn load_aws_credentials() -> Result<AwsCredentials> {
    let access_key_id = env::var("AWS_ACCESS_KEY_ID")
        .with_context(|| "Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or pass --config")?;
    let secret_access_key = env::var("AWS_SECRET_ACCESS_KEY")
        .with_context(|| "Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or pass --config")?;
    let session_token = env::var("A
```

### Core Architecture Module: `benchmarks/src/config.rs`
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
use serde::Deserialize;
use std::collections::{HashMap, HashSet};

#[derive(Deserialize, Default, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LoadFormat {
    #[default]
    Csv,
    Parquet,
}

impl LoadFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            LoadFormat::Csv => "csv",
            LoadFormat::Parquet => "parquet",
        }
    }
}

#[derive(Deserialize)]
pub struct DatasetConfig {
    pub root_table: RootTableConfig,
    pub sampling_seed: u64,
    pub tables: Vec<TableConfig>,
    #[serde(default)]
    pub s3_base_path: Option<String>,
    /// Storage format LoadHeap reads from `sampled/{size}/{load_format}/`. Defaults to CSV.
    #[serde(default)]
    pub load_format: LoadFormat,
    /// Named index parameters. Each value is an expression (evaluated as a SQL scalar) over
    /// recognized variables such as `dataset_size`, e.g. `lists = "{{ dataset_size }} / 100"`.
    /// Index SQL references them with `{{ name }}`.
    #[serde(default)]
    pub params: HashMap<String, String>,
    /// Operating-point sweeps, keyed `[sweeps.{index}.{query}]` where `query` is a query file
    /// stem. Rather than hand-tuning a param to land on a recall target, the benchmark measures
    /// recall at each swept value and reports the point that reaches each target.
    #[serde(default)]
    pub sweeps: HashMap<String, HashMap<String, SweepConfig>>,
}

/// A recall sweep for one (index, query) pair.
///
/// Keyed by index as well as query because indexes share query stems: each of `queries/{hnsw,
/// ivfflat, vchord, pg_search}/` has its own `knn_top10_10pct.sql`, sweeping a different knob.
#[derive(Deserialize)]
pub struct SweepConfig {
    /// The name this sweep varies. The query file must reference it as `{{ param }}`; it is
    /// supplied by the sweep, so it needs no `[params]` entry.
    pub param: String,
    /// Operating points to try, ordered cheapest first. Stop at the highest recall target or
    /// after three consecutive larger values fail to improve the best measured recall.
    /// Each is a SQL scalar expression, like any other param value.
    pub values: Vec<String>,
}

impl DatasetConfig {
    /// Returns an iterator containing the root table name, then all of the other table names
    pub(crate) fn all_table_names(&self) -> impl Iterator<Item = &str> {
        let tables_iter = self.tables.iter().map(|t| t.name.as_str());
        let root_iter = std::iter::once(self.root_table.name.as_str());
        root_iter.chain(tables_iter)
    }

    /// The sweep declared for `index`'s `query` (a query file stem), if any.
    pub fn sweep_for(&self, index: &str, query: &str) -> Option<&SweepConfig> {
        self.sweeps.get(index)?.get(query)
    }
}

#[derive(Deserialize)]
pub struct RootTableConfig {
    pub name: String,
    /// For deterministic sampling, `primary_key` must reference a column with unique, non-null values for all rows
    pub primary_key: String,
}

#[derive(Deserialize)]
pub struct TableConfig {
    pub name: String,
    pub parent: String,
    pub parent_join_col: String,
    pub join_col: String,
}

/// Returns the dataset config, and the topological order for the non-root tables
pub fn load_dataset_config(path: &str) -> Result<(DatasetConfig, Vec<usize>)> {
    let content =
        std::fs::read_to_string(path).with_context(|| format!("Failed to read config '{path}'"))?;
    let config: DatasetConfig =
        toml::from_str(&content).with_context(|| format!("Failed to parse config '{path}'"))?;
    let order = validate_config_and_table_order(&config)
        .with_context(|| format!("Invalid config '{path}'"))?;
    Ok((config, order))
}

fn validate_config_and_table_order(config: &DatasetConfig) -> Result<Vec<usize>> {
    let mut seen_names: HashSet<&str> = HashSet::new();
    seen_names.insert(config.root_table.name.as_str());
    for table in &config.tables {
        if !seen_names.insert(table.name.as_str()) {
            bail!("Duplicate table name '{}'", table.name);
        }
    }
    let order = topological_order(config)?;
    Ok(order)
}

/// Returns table indices in topological order (children only, excludes root).
fn topological_order(config: &DatasetConfig) -> Result<Vec<usize>> {
    let mut order = Vec::with_capacity(config.tables.len());
    let mut processed: HashSet<&str> = HashSet::new();

    // Start with the root table.
    processed.insert(&config.root_table.name);

    // Iteratively add tables whose parent has been processed. Repeat until no progress is made
    let mut progress = true;
    while progress {
        progress = false;
        for (i, table) in config.tables.iter().enumerate() {
            if processed.contains(table.name.as_str()) {
                continue;
            }
            if processed.contains(table.parent.as_str()) {
                order.push(i);
                processed.insert(&table.name);
                progress = true;
            }
        }
    }

    // Check for unprocessed tables (cycle or missing parent).
    for table in &config.tables {
        if !processed.contains(table.name.as_str()) {
            bail!(
                "Table '{}' could not be processed. Its parent '{}' is not the root table '{}', or is not in the config, or there is a cycle.",
                table.name,
                config.root_table.name,
                table.parent,
            );
        }
    }

    Ok(order)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_table(name: &str, parent: &str) -> TableConfig {
        TableConfig {
            name: name.to_string(),
            parent: parent.to_string(),
            parent_join_col: "parent_id".to_string(),
            join_col: "id".to_string(),
        }
    }

    fn make_config(root_table: &str, tables: Vec<TableConfig>) -> DatasetConfig {
        DatasetConfig {
            root_table: RootTableConfig {
                name: root_table.to_string(),
                primary_key: format!("{root_table}_pk"),
            },
            sampling_seed: 42,
            tables,
            s3_base_path: None,
            load_format: LoadFormat::default(),
            params: HashMap::new(),
            sweeps: HashMap::new(),
        }
    }

    #[test]
    fn sweeps_parse_and_resolve_per_index() {
        let config: DatasetConfig = toml::from_str(
            r#"
            sampling_seed = 1
            tables = []
            [root_table]
            name = "t"
            primary_key = "id"
            [params]
            eps = "0.2"
            [sweeps.pg_search.knn_top10_1pct]
            param = "eps"
            values = ["0.1", "0.2", "0.4"]
            "#,
        )
        .unwrap();

        let sweep = config.sweep_for("pg_search", "knn_top10_1pct").unwrap();
        assert_eq!(sweep.param, "eps");
        assert_eq!(sweep.values, vec!["0.1", "0.2", "0.4"]);
        // Sweeps are per (index, query): another index sharing the query file has none.
        assert!(config.sweep_for("hnsw", "knn_top10_1pct").is_none());
        assert!(config.sweep_for("pg_search", "knn_top10_10pct").is_none());
    }

    #[test]
    fn single_root_
```

### Core Architecture Module: `benchmarks/src/convert.rs`
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
use clap::Parser;

use crate::utils::{open_duckdb_conn, validate_input, validate_output};

#[derive(Parser)]
pub struct ConvertArgs {
    /// Input S3 path to the dataset (e.g. s3://bucket/path/to/dataset).
    /// Each table is a subdirectory containing partitioned parquet files.
    #[arg(long)]
    pub input: String,

    /// Output S3 path for the converted CSV files (e.g. s3://bucket/path/to/output).
    /// CSV files will be written to subdirectories matching the table names.
    #[arg(long)]
    pub output: String,

    /// Comma-separated list of table names to convert.
    /// Each table name corresponds to a subdirectory under the input path.
    #[arg(long, required = true, value_delimiter = ',')]
    pub tables: Vec<String>,

    /// Validate inputs and list files that would be converted, without performing conversion.
    #[arg(long, default_value_t = false)]
    pub dry_run: bool,
}

pub fn run_convert(args: ConvertArgs) -> Result<()> {
    let conn = open_duckdb_conn()?;

    let input = args.input.trim_end_matches('/');
    let output = args.output.trim_end_matches('/');

    let tables_iter = args.tables.iter().map(|t| t.as_ref());
    validate_input(tables_iter.clone(), &conn, input)?;

    if args.dry_run {
        println!("\nDry run: counting planned conversions...");
        for table in &args.tables {
            let glob_pattern = format!("{input}/{table}/*.parquet");
            let count: usize = conn
                .query_row(
                    &format!("SELECT count(*) FROM glob('{glob_pattern}')"),
                    [],
                    |row| row.get(0),
                )
                .with_context(|| {
                    format!("Failed to execute query to count parquet files for table '{table}'")
                })?;
            println!("  Table '{table}' ({count} file(s)):");
        }
        println!("\nDry run complete. No files were converted.");
        return Ok(());
    }

    validate_output(tables_iter, &conn, output)?;

    // Conversion phase: one COPY per table, DuckDB handles parallelism internally.
    println!("\nConverting parquet to CSV...");
    for table in &args.tables {
        println!("  Converting table '{table}'...");
        let sql = format!(
            "COPY (SELECT * FROM read_parquet('{input}/{table}/*.parquet')) \
             TO '{output}/{table}' (FORMAT CSV, HEADER true, PER_THREAD_OUTPUT true);"
        );

        conn.execute_batch(&sql)
            .with_context(|| format!("Failed to convert table '{table}'"))?;

        println!("  {table}: done");
    }

    println!("\nVerifying input and output table row counts...");
    for table in &args.tables {
        println!("  Checking table '{table}'...");

        let parquet_count: usize = conn
            .query_row(
                &format!("SELECT count(*) FROM read_parquet('{input}/{table}/*.parquet')",),
                [],
                |row| row.get(0),
            )
            .with_context(|| format!("Failed to query parquet row count for {table}"))?;

        let csv_count: usize = conn
            .query_row(&format!(
                "SELECT count(*) FROM read_csv('{output}/{table}/*.csv', parallel=false, header=true)",
            ), [], |row| row.get(0))
            .with_context(|| format!("Failed to query csv row count for {table}"))?;

        println!("  {parquet_count} -> {csv_count}");
        if parquet_count != csv_count {
            bail!(
                "{parquet_count} rows for {table} exist in the source, but only {csv_count} were found in the output"
            );
        }
    }

    println!("\nConversion complete.");
    Ok(())
}

```

### Core Architecture Module: `benchmarks/src/lib.rs`
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

use std::collections::VecDeque;

pub struct Window {
    capacity: usize,
    contents: VecDeque<f64>,
}
impl Window {
    pub fn new(capacity: usize) -> Self {
        Window {
            capacity,
            contents: VecDeque::with_capacity(capacity),
        }
    }

    pub fn push(&mut self, el: f64) {
        if self.contents.len() == self.capacity {
            self.contents.pop_front();
        }
        self.contents.push_back(el);
    }

    /// Returns the variance of the window contents as a percent of the mean
    /// Requires self to be mutable so that self.contents can be made contiguous
    pub fn variance_over_mean(&mut self) -> Option<f64> {
        if self.contents.is_empty() {
            None
        } else {
            self.contents.make_contiguous();
            let contents = self.contents.as_slices().0;
            let var_over_mean = variance(contents) / mean(contents);
            Some(var_over_mean)
        }
    }

    pub fn is_full(&self) -> bool {
        self.contents.len() == self.capacity
    }
}

pub fn mean(data: &[f64]) -> f64 {
    assert!(!data.is_empty());
    data.iter().sum::<f64>() / data.len() as f64
}

/// Returns the half-width of the confidence interval for the provided confidence level
///
/// The math for this comes from single-level version of what is shown in this paper:
/// <https://dl.acm.org/doi/10.1145/2555670.2464160>.
pub fn confidence_interval_half_width(data: &[f64], confidence_level: f64) -> f64 {
    assert!(!data.is_empty());
    assert!(confidence_level > 0.0);
    assert!(confidence_level < 1.0);

    let sample_count = data.len() as f64;
    let variance = variance(data);

    let half_alpha = (1.0 - confidence_level) / 2.0;
    let t = distrs::StudentsT::ppf(1.0 - half_alpha, sample_count - 1.0);

    t * ((variance / sample_count).sqrt())
}

/// Returns the `p`th percentile (0.0..=1.0) of `data`, by linear interpolation between the two
/// closest ranks.
///
/// Interpolating rather than picking a nearest rank matters at the sample counts here: with one
/// timing per held-out query vector, a nearest-rank p95 of 100 samples is just the 95th value,
/// which moves in visible jumps between runs.
pub fn percentile(data: &[f64], p: f64) -> f64 {
    assert!(!data.is_empty());
    assert!((0.0..=1.0).contains(&p));

    let mut sorted = data.to_vec();
    sorted.sort_by(f64::total_cmp);
    if sorted.len() == 1 {
        return sorted[0];
    }

    let rank = p * (sorted.len() - 1) as f64;
    let lo = rank.floor() as usize;
    let hi = rank.ceil() as usize;
    if lo == hi {
        return sorted[lo];
    }
    sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo as f64)
}

/// Returns the `[lo, hi]` order-statistic confidence interval for the `p`th percentile of `data`.
///
/// A mean's t-interval describes the mean, not a quantile, so [`confidence_interval_half_width`]
/// cannot be reused here. This is the distribution-free alternative: the bounds are the samples at
/// ranks `np ± z*sqrt(np(1-p))`, clamped to the data.
///
/// The interval is asymmetric about the percentile, and wide in the tail: with one timing per
/// held-out query vector (~100 samples), p99 is bounded by only the few slowest vectors.
pub fn percentile_confidence_interval(data: &[f64], p: f64, confidence_level: f64) -> (f64, f64) {
    assert!(!data.is_empty());
    assert!((0.0..=1.0).contains(&p));
    assert!(confidence_level > 0.0);
    assert!(confidence_level < 1.0);

    let mut sorted = data.to_vec();
    sorted.sort_by(f64::total_cmp);

    let n = sorted.len() as f64;
    let half_alpha = (1.0 - confidence_level) / 2.0;
    let z = distrs::Normal::ppf(1.0 - half_alpha, 0.0, 1.0);
    let spread = z * (n * p * (1.0 - p)).sqrt();

    // The ranks the formula produces are 1-based, hence the shift onto a 0-based index.
    let index = |rank: f64| (rank.max(1.0).min(n) as usize) - 1;
    let lo = index((n * p - spread).floor());
    let hi = index((n * p + spread).ceil());

    (sorted[lo], sorted[hi])
}

/// FNV-1a over the strings in order. Stable across platforms and Rust versions, unlike
/// `DefaultHasher`, so hashes published in one benchmark run stay comparable in later ones.
pub fn fnv1a(strings: &[String]) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for s in strings {
        for byte in s.as_bytes() {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
        }
    }
    hash
}

/// Returns the variance of the slice contents
fn variance(data: &[f64]) -> f64 {
    assert!(!data.is_empty());

    let mean: f64 = mean(data);
    let sample_count = data.len() as f64;

    (1.0 / (sample_count - 1.0)) * (data.iter().map(|v| (v - mean).powi(2)).sum::<f64>())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::*;

    use approx::assert_relative_eq;

    // Mavro and lottery datasets, along with their expected variance and half-widths
    // are taken from NIST reference datasets

    const DATA_MAVRO: [f64; 50] = [
        2.00180, 2.00170, 2.00180, 2.00190, 2.00180, 2.00170, 2.00150, 2.00140, 2.00150, 2.00150,
        2.00170, 2.00180, 2.00180, 2.00190, 2.00190, 2.00210, 2.00200, 2.00160, 2.00140, 2.00130,
        2.00130, 2.00150, 2.00150, 2.00160, 2.00150, 2.00140, 2.00130, 2.00140, 2.00150, 2.00140,
        2.00150, 2.00160, 2.00150, 2.00160, 2.00190, 2.00200, 2.00200, 2.00210, 2.00220, 2.00230,
        2.00240, 2.00250, 2.00270, 2.00260, 2.00260, 2.00260, 2.00270, 2.00260, 2.00250, 2.00240,
    ];
    const VARIANCE_MAVRO: f64 = 1.8414693877551e-07;
    const HALF_WIDTH_95_MAVRO: f64 = 1.21955536247e-04;

    const DATA_LOTTERY: [f64; 218] = [
        162.0, 671.0, 933.0, 414.0, 788.0, 730.0, 817.0, 33.0, 536.0, 875.0, 670.0, 236.0, 473.0,
        167.0, 877.0, 980.0, 316.0, 950.0, 456.0, 92.0, 517.0, 557.0, 956.0, 954.0, 104.0, 178.0,
        794.0, 278.0, 147.0, 773.0, 437.0, 435.0, 502.0, 610.0, 582.0, 780.0, 689.0, 562.0, 964.0,
        791.0, 28.0, 97.0, 848.0, 281.0, 858.0, 538.0, 660.0, 972.0, 671.0, 613.0, 867.0, 448.0,
        738.0, 966.0, 139.0, 636.0, 847.0, 659.0, 754.0, 243.0, 122.0, 455.0, 195.0, 968.0, 793.0,
        59.0, 730.0, 361.0, 574.0, 522.0, 97.0, 762.0, 431.0, 158.0, 429.0, 414.0, 22.0, 629.0,
        788.0, 999.0, 187.0, 215.0, 810.0, 782.0, 47.0, 34.0, 108.0, 986.0, 25.0, 644.0, 829.0,
        630.0, 315.0, 567.0, 919.0, 331.0, 207.0, 412.0, 242.0, 607.0, 668.0, 944.0, 749.0, 168.0,
        864.0, 442.0, 533.0, 805.0, 372.0, 63.0, 458.0, 777.0, 416.0, 340.0, 436.0, 140.0, 919.0,
        350.0, 510.0, 572.0, 905.0, 900.0, 85.0, 389.0, 473.0, 758.0, 444.0, 169.0, 625.0, 692.0,
        140.0, 897.0, 672.0, 288.0, 312.0, 860.0, 724.0, 226.0, 884.0, 508.0, 976.0, 741.0, 476.0,
        417.0, 831.0, 15.0, 318.0, 432.0, 241.0, 114.0, 799.0, 955.0, 833.0, 358.0, 935.0, 146.0,
        630.0, 830.0, 440.0, 642.0, 356.0, 373.0, 271.0, 715.0, 367.0, 393.0, 190.0, 669.0, 8.0,
        861.0, 108.0, 795.0, 269.0, 590.0, 326.0, 866.0, 64.0, 523.0, 862.0, 840.0, 219.0, 382.0,
        998.0, 4.0, 628.0, 305.0, 747.0, 247.0, 34.0, 747.0, 729.0, 645.0, 856.0, 974.0, 24.0,
        568.0, 24.0, 694.0, 608.0, 480.0, 410.0, 729.0, 947.0, 293.0, 53.0
```

### Core Architecture Module: `benchmarks/src/main.rs`
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

use anyhow::{Context, bail};
use clap::{Parser, Subcommand};
use paradedb::{
    Window, confidence_interval_half_width, fnv1a, mean, percentile, percentile_confidence_interval,
};
use sqlx::{AssertSqlSafe, Connection, PgConnection, Row};
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::process::Command;
use std::time::Instant;

mod backrest;
mod config;
mod convert;
mod sample;
mod utils;

use config::{DatasetConfig, LoadFormat, SweepConfig, load_dataset_config};

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

fn parse_positive_usize(value: &str) -> Result<usize, String> {
    let value = value
        .parse::<usize>()
        .map_err(|err| format!("invalid positive integer: {err}"))?;
    if value == 0 {
        Err("value must be at least 1".to_string())
    } else {
        Ok(value)
    }
}

#[derive(Subcommand)]
enum Commands {
    /// Run benchmarks against a ParadeDB instance.
    Benchmark(BenchmarkArgs),
    /// Measure recall@k of a built vector index against a held-out query set (cohere).
    Recall(RecallArgs),
    /// Convert parquet datasets in S3 to CSV format using DuckDB.
    Convert(convert::ConvertArgs),
    /// Sample a Parquet dataset to a target row count, preserving table relationships.
    Sample(sample::SampleArgs),
    /// Load a dataset's heap without building the index or running queries, so the resulting
    /// cluster can be captured as a snapshot (e.g. by pgBackRest).
    LoadHeap(LoadHeapArgs),
    /// Capture a loaded heap as a pgBackRest snapshot.
    SnapshotHeap(backrest::SnapshotHeapArgs),
    /// Restore a heap snapshot with pgBackRest.
    RestoreHeap(backrest::RestoreHeapArgs),
}

#[derive(Parser)]
struct BenchmarkArgs {
    /// Postgres URL.
    #[arg(long)]
    url: String,

    /// Dataset to use.
    #[arg(long, default_value = "stackoverflow")]
    dataset: String,

    /// Which index variant to build and benchmark (e.g. "bm25", "hnsw", "ivfflat"). Required;
    /// resolves to `datasets/{dataset}/indexes/{index}.sql`.
    #[arg(long)]
    index: String,

    /// Dataset size label (e.g. "1m", "10m"). Used to scale size-dependent index parameters such as
    /// ivfflat's `lists`; only required for indexes that reference it.
    #[arg(long)]
    size: Option<String>,

    /// Whether to pre-warm the dataset using `pg_prewarm`.
    #[arg(long, default_value_t = true, num_args = 1)]
    prewarm: bool,

    /// Whether to run `VACUUM FULL ANALYZE`, then `VACUUM ANALYZE`, before executing queries.
    #[arg(long, default_value_t = true, num_args = 1)]
    vacuum: bool,

    /// Whether to run dirty MVCC variants for queries marked sensitive.
    #[arg(long, default_value_t = true, num_args = 1)]
    dirty: bool,

    /// Fraction of data to dirty (e.g. 0.005 for 0.5% dirty / 99.5% visible).
    #[arg(long, default_value_t = 0.005)]
    dirty_fraction: f64,

    /// Skip index creation (and the after-create-index hook). Assumes the index already exists;
    /// useful for iterating on queries against an already-indexed database.
    #[arg(long, default_value_t = false)]
    skip_index: bool,

    /// Number of runs to execute for each query.
    #[arg(long, default_value = "3", value_parser = parse_positive_usize)]
    runs: usize,

    /// Output format.
    #[arg(long, value_parser = ["md", "csv", "json"], default_value = "md")]
    output: String,

    /// Whether to fail on query errors. Set to false for backfills against older versions
    /// that may not support all query syntax.
    #[arg(long, default_value_t = true, num_args = 1)]
    fail_on_error: bool,

    /// Whether to clear the OS page cache and Postgres buffer cache before each query.
    #[arg(long, default_value_t = true, num_args = 1)]
    clear_caches: bool,
}

#[derive(Parser)]
struct LoadHeapArgs {
    /// Postgres URL.
    #[arg(long)]
    url: String,

    /// Dataset to load.
    #[arg(long, default_value = "stackoverflow")]
    dataset: String,

    /// Size label for the pre-sampled dataset (e.g. "10k", "100k", "1m").
    #[arg(long)]
    size: String,

    /// Base path to external CSV data source (S3 or local). Overrides s3_base_path in
    /// config.toml. CSVs are loaded from `{data_source}/sampled/{size}/csv/{table}/`.
    #[arg(long)]
    data_source: Option<String>,
}

#[derive(Parser)]
struct RecallArgs {
    /// Postgres URL. The corpus and its vector index are assumed to already exist (built by a prior
    /// `benchmark` run), so recall measures that exact index.
    #[arg(long)]
    url: String,

    /// Dataset to measure recall for.
    #[arg(long, default_value = "cohere")]
    dataset: String,

    /// Dataset size label (e.g. "1m", "10m"). Selects the precomputed ground-truth parquet
    /// (`{data_source}/queries/ground_truth_{query}_{size}.parquet`), which is query- and
    /// corpus-size-specific.
    #[arg(long)]
    size: String,

    /// Base path to the held-out query + ground-truth parquets (S3 or local). Overrides s3_base_path
    /// in config.toml; files load from `{data_source}/queries/`.
    #[arg(long)]
    data_source: Option<String>,

    /// Query file (stem of `queries/{query}.sql`) to measure recall for, run for each held-out
    /// vector. May include an index subdirectory (e.g. `foo/knn_top10_1pct`).
    #[arg(long, default_value = "knn_top10_unfiltered")]
    query: String,

    /// Ground-truth stem, selecting `ground_truth_{ground_truth}_{size}.parquet`. The exact top-10
    /// depends only on filter selectivity, so query files with the same filter share one ground
    /// truth. Defaults to `--query` with any index subdirectory stripped.
    #[arg(long)]
    ground_truth: Option<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    match cli.command {
        // The dataset's heap is assumed to already be present, restored from a snapshot before this
        // run (e.g. by the CI workflow, before Postgres started). The index is (re)built by
        // run_sql_benchmarks, gated on `--skip-index`.
        Commands::Benchmark(args) => run_sql_benchmarks(&args).await,
        Commands::Recall(args) => run_recall(&args).await,
        Commands::Convert(args) => convert::run_convert(args),
        Commands::Sample(args) => sample::run_sample(args),
        // Load the heap without building the index or running queries, leaving a heap-only cluster
        // ready to be captured as a snapshot. The benchmark job rebuilds the index after restore.
        Commands::LoadHeap(args) => load_external_data(
            &args.url,
            &args.dataset,
            &args.size,
            args.data_source.as_deref(),
        ),
        Commands::SnapshotHeap(args) => backrest::run_snapshot_heap(args),
        Commands::RestoreHeap(args) => backrest::run_restore_heap(args),
    }
}

async fn run_sql_benchmarks(args: &BenchmarkArgs) -> anyhow::Result<()> {
    match args.output.as_str() {
        "md" => generate_markdown_output(args).await,
        "csv" => generate_csv_output(args).await,
        "json" => generate_json_output(arg
```

### Core Architecture Module: `benchmarks/src/sample.rs`
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
use clap::Parser;
use duckdb::Connection;
use std::time::Instant;

use crate::config::load_dataset_config;
use crate::utils::{open_duckdb_conn, validate_input, validate_output};

#[derive(Parser)]
pub struct SampleArgs {
    /// Input path to the dataset (S3 or local).
    /// Each table is a subdirectory containing parquet files.
    #[arg(long)]
    pub input: String,

    /// Output path for the sampled parquet files (S3 or local).
    /// Parquet files will be written to subdirectories matching the table names.
    #[arg(long)]
    pub output: String,

    /// Path to the TOML config file describing table relationships.
    #[arg(long)]
    pub config: String,

    /// Target number of rows for the root table.
    #[arg(long)]
    pub rows: u64,

    /// Validate and report planned row counts without writing.
    #[arg(long, default_value_t = false)]
    pub dry_run: bool,
}

fn parquet_glob_pattern(base: &str, table_name: &str) -> String {
    format!("{base}/{table_name}/*.parquet")
}

fn count_rows(conn: &Connection, glob: &str) -> Result<u64> {
    let sql = format!("SELECT count(*) FROM read_parquet('{glob}')");
    let count: u64 = conn
        .query_row(&sql, [], |row| row.get(0))
        .with_context(|| format!("Failed to count rows for '{glob}'"))?;
    Ok(count)
}

pub fn run_sample(args: SampleArgs) -> Result<()> {
    let (config, order) = load_dataset_config(&args.config)?;

    let conn = open_duckdb_conn()?;

    let input = args.input.trim_end_matches('/');
    let output = args.output.trim_end_matches('/');

    validate_input(config.all_table_names(), &conn, input)?;
    if !args.dry_run {
        validate_output(config.all_table_names(), &conn, output)?;
    }

    // Determine processing order.

    // Sample the root table.
    let root = &config.root_table;
    let root_glob = parquet_glob_pattern(input, &root.name);
    let total_rows = count_rows(&conn, &root_glob)?;

    if total_rows == 0 {
        bail!("Root table '{}' has no rows", root.name);
    }

    let target = args.rows;
    if target > total_rows {
        bail!(
            "Target rows ({target}) exceeds total rows ({total_rows}) in root table '{}'",
            root.name
        );
    }

    let local_root_data_path = format!("/tmp/local_source/{}", root.name);
    let local_glob = format!("{local_root_data_path}/*.parquet");

    // copy root table locally to speed up sampling.
    std::fs::create_dir_all(&local_root_data_path)
        .with_context(|| "Failed to make root table data directory")?;
    println!("Copying root table data to local disk...");
    let sql = format!(
        "COPY (SELECT * FROM read_parquet('{}')) \
         TO '{}' (FORMAT PARQUET, OVERWRITE true, PER_THREAD_OUTPUT true)",
        root_glob, local_root_data_path
    );
    conn.execute_batch(&sql)
        .with_context(|| "Failed to copy root table data locally")?;

    // disable multi-threading, required for deterministic output
    // See: https://duckdb.org/docs/current/sql/samples#syntax
    conn.execute("SET threads = 1;", [])
        .with_context(|| "Failed to set thread count")?;

    let percentage = (target as f64 / total_rows as f64) * 100.0;

    // We use reservoir for small sample sizes, since it allows us to be exact. However, it
    // requires materializing the entire sample in memory, so we use the system method for larger
    // counts, which gives us an approximate count (usually within 3-5%).
    let sample_arg = if target <= 100_000 {
        format!("reservoir({target} ROWS)")
    } else {
        format!("system({percentage:.5} PERCENT)")
    };
    let sql = format!(
        "CREATE TABLE sampled_{name} AS \
        WITH ordered AS (SELECT * FROM  read_parquet('{local_path}') ORDER BY \"{pk}\") \
        SELECT * FROM ordered USING SAMPLE {sample_arg} REPEATABLE({seed})",
        name = root.name,
        local_path = local_glob,
        pk = root.primary_key,
        sample_arg = sample_arg,
        seed = config.sampling_seed,
    );

    println!(
        "Sampling root table {} for ~{} rows ({:.5} percent of the input)...",
        root.name, target, percentage
    );
    let start_time = Instant::now();
    conn.execute_batch(&sql)
        .with_context(|| format!("Failed to sample root table '{}'", root.name))?;
    println!("Sampling took: {:?}", start_time.elapsed());

    println!("Removing root table data from local disk...");
    std::fs::remove_dir_all(&local_root_data_path)
        .with_context(|| format!("Failed to remove dir: '{}'", local_root_data_path))?;

    // re-enable multi-threading
    conn.execute("RESET threads;", [])
        .with_context(|| "Failed to reset thread count to default")?;

    let sampled_root_count: u64 = conn
        .query_row(
            &format!("SELECT count(*) FROM sampled_{}", root.name),
            [],
            |row| row.get(0),
        )
        .context("Failed to count sampled root rows")?;
    println!("  {} sampled: {sampled_root_count} rows", root.name);

    // Sample child tables by joining against their sampled parent.
    for &idx in &order {
        let table = &config.tables[idx];
        let glob = parquet_glob_pattern(input, &table.name);

        println!(
            "Sampling child table '{}' (parent: '{}')...",
            table.name, table.parent,
        );

        let sql = format!(
            "CREATE TABLE sampled_{name} AS \
             SELECT DISTINCT c.* \
             FROM read_parquet('{glob}') c \
             WHERE c.\"{child_col}\" IN 
                (SELECT {parent_col} from sampled_{parent})",
            name = table.name,
            parent = table.parent,
            child_col = table.join_col,
            parent_col = table.parent_join_col,
        );
        conn.execute_batch(&sql)
            .with_context(|| format!("Failed to sample child table '{}'", table.name))?;

        let child_count: u64 = conn
            .query_row(
                &format!("SELECT count(*) FROM sampled_{}", table.name),
                [],
                |row| row.get(0),
            )
            .with_context(|| format!("Failed to count sampled rows for '{}'", table.name))?;
        println!("  {} sampled: {child_count} rows", table.name);
    }

    if args.dry_run {
        println!("\nDry run complete. No files were written.");
        return Ok(());
    }

    // Write output.
    println!("\nWriting sampled parquet files...");
    for table_name in config.all_table_names() {
        write_sample_table(&conn, table_name, output)?;
    }
    println!("\nSampling complete.");
    Ok(())
}

fn write_sample_table(conn: &duckdb::Connection, table_name: &str, output: &str) -> Result<()> {
    println!("  Writing '{}'...", table_name);
    let sql = format!(
        "COPY sampled_{name} TO '{output}/{name}' (FORMAT PARQUET, PER_THREAD_OUTPUT true)",
        name = table_name,
        output = output,
    );
    conn.execute_batch(&sql)
        .with_context(|| format!("Failed to write sampled table '{}'", table_name))?;
    println!("  {}: done", table_name);
    Ok(())
}

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

### Core Architecture Module: `dst/src/lib.rs`
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

//! Deterministic-simulation-testing (DST) hooks — the one place that talks to the Antithesis
//! Rust SDK.
//!
//! Three build configurations, selected automatically:
//!
//! * **`enabled`** — macros forward to `antithesis_sdk`; used for Antithesis runs
//!   (`pg_search --features dst`).
//! * **`enabled` off, `debug_assertions` on** — the always/unreachable asserts lower to
//!   `debug_assert!` and `GhostState`/`observe!` run, so invariants are also checked in normal
//!   testing; `assert_sometimes!`/`assert_reachable!` need a whole run, so they only type-check.
//! * **neither** (release) — compiles to nothing.
//!
//! The assertion wrappers mirror the SDK's signatures (`$message` must be a string literal) and
//! are macros, not functions, so each assertion's location is captured at the real call site.
//!
//! `observe!` and `GhostState` are ported from `precept` (orbitinghail/precept): `observe!` runs
//! a read-only property block whose `Fn` bound makes the compiler reject any code that mutates
//! the observed system, and `GhostState<T>` is auxiliary property-only state erased from
//! non-instrumented builds. Here they sit on top of the official SDK rather than precept.

// Re-export the SDK so the `#[macro_export]` wrappers below can reach it from a consumer crate
// that does not depend on `antithesis_sdk` directly.
#[cfg(feature = "enabled")]
#[doc(hidden)]
pub use antithesis_sdk;

// `as _` keeps the linker from dropping the coverage shim.
#[cfg(feature = "enabled")]
use antithesis_instrumentation as _;

/// Register the Antithesis assertion catalog for this process. Required once per process that
/// emits assertions; without it a never-hit `assert_unreachable!` would pass vacuously instead
/// of being reported. `antithesis_init` is idempotent, so it is safe to call from every process
/// / forked worker. A no-op unless `enabled`.
#[cfg(feature = "enabled")]
pub fn init() {
    antithesis_sdk::antithesis_init();
}

/// See the [`enabled` definition](init).
#[cfg(not(feature = "enabled"))]
pub fn init() {}

/// Whether a Postgres SQLSTATE means the connection is gone and reconnecting is the right
/// response: class 08 (connection exception), operator/crash shutdown, "cannot connect now"
/// (server starting up or shutting down), and idle-session timeout. Shared by the stressgres and
/// qgen workloads so their transient-fault classifications cannot drift. (stressgres additionally
/// keeps a stringified-needle fallback in `fault_tolerance::TRANSIENT_ERROR_NEEDLES`, which must
/// mirror this list.)
pub fn is_connection_lost_sqlstate(code: &str) -> bool {
    code.starts_with("08") || matches!(code, "57P01" | "57P02" | "57P03" | "57P05")
}

#[cfg(test)]
mod sqlstate_tests {
    use super::is_connection_lost_sqlstate;

    #[test]
    fn connection_class_and_shutdown_codes_are_lost() {
        for code in [
            "08000", "08006", "08P01", "57P01", "57P02", "57P03", "57P05",
        ] {
            assert!(is_connection_lost_sqlstate(code), "{code}");
        }
    }

    #[test]
    fn query_and_data_errors_are_not_lost() {
        for code in ["57014", "40001", "40P01", "23505", "42601", ""] {
            assert!(!is_connection_lost_sqlstate(code), "{code}");
        }
    }
}

// The leading `debug_assert` / `type_only` keyword selects the SDK-off lowering (see crate docs).
// `$d` is bound to `$` so a generated macro can name its own metavariables (the escape for a macro
// that defines a macro).

// Type-check-only expansion for a compiled-out assertion: evaluates nothing.
#[doc(hidden)]
#[macro_export]
macro_rules! __dst_typecheck_cond {
    ($condition:expr, $message:literal $(, $details:expr)?) => {
        if false {
            let _: bool = $condition;
            let _: &str = $message;
            $(let _ = &$details;)?
        }
    };
}

#[doc(hidden)]
#[macro_export]
macro_rules! __dst_typecheck_msg {
    ($message:literal $(, $details:expr)?) => {
        if false {
            let _: &str = $message;
            $(let _ = &$details;)?
        }
    };
}

/// Generate a condition-style wrapper: `name!(condition, "message" [, &details])`.
// rustfmt cannot format a `macro_rules!` that defines a `macro_rules!` idempotently — each pass
// re-indents the nested arms further — so pin this generator's formatting by hand.
#[rustfmt::skip]
macro_rules! define_condition_assert {
    (debug_assert $d:tt $name:ident, $doc:literal) => {
        #[doc = $doc]
        #[cfg(feature = "enabled")]
        #[macro_export]
        macro_rules! $name {
            ($d condition:expr, $d message:literal $d(, $d details:expr)?) => {
                $crate::antithesis_sdk::$name!($d condition, $d message $d(, $d details)?)
            };
        }

        // `details` folds into the panic message.
        #[doc = $doc]
        #[cfg(all(not(feature = "enabled"), debug_assertions))]
        #[macro_export]
        macro_rules! $name {
            ($d condition:expr, $d message:literal, $d details:expr) => {
                ::core::debug_assert!($d condition, "{}: {}", $d message, $d details)
            };
            ($d condition:expr, $d message:literal) => {
                ::core::debug_assert!($d condition, "{}", $d message)
            };
        }

        #[doc = $doc]
        #[cfg(all(not(feature = "enabled"), not(debug_assertions)))]
        #[macro_export]
        macro_rules! $name {
            ($d condition:expr, $d message:literal $d(, $d details:expr)?) => {
                $crate::__dst_typecheck_cond!($d condition, $d message $d(, $d details)?)
            };
        }
    };

    (type_only $d:tt $name:ident, $doc:literal) => {
        #[doc = $doc]
        #[cfg(feature = "enabled")]
        #[macro_export]
        macro_rules! $name {
            ($d condition:expr, $d message:literal $d(, $d details:expr)?) => {
                $crate::antithesis_sdk::$name!($d condition, $d message $d(, $d details)?)
            };
        }

        #[doc = $doc]
        #[cfg(not(feature = "enabled"))]
        #[macro_export]
        macro_rules! $name {
            ($d condition:expr, $d message:literal $d(, $d details:expr)?) => {
                $crate::__dst_typecheck_cond!($d condition, $d message $d(, $d details)?)
            };
        }
    };
}

/// Generate a message-only wrapper: `name!("message" [, &details])`.
#[rustfmt::skip]
macro_rules! define_message_assert {
    (debug_assert $d:tt $name:ident, $doc:literal) => {
        #[doc = $doc]
        #[cfg(feature = "enabled")]
        #[macro_export]
        macro_rules! $name {
            ($d message:literal $d(, $d details:expr)?) => {
                $crate::antithesis_sdk::$name!($d message $d(, $d details)?)
            };
        }

        // Reaching this site is the violation, so panic.
        #[doc = $doc]
        #[cfg(all(not(feature = "enabled"), debug_assertions))]
        #[macro_export]
        macro_rules! $name {
            ($d message:literal, $d details:expr) => {
                ::core::debug_assert!(false, "{}: {}", $d message, $d details)
            };
            ($d message:literal) => {
                ::core::debug_assert!(false, "{}", $d message)
            };
 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6489** (2026-09-30): **Backend hangs forever on exit when terminated while loading a tokenizer typmod**
  *Symptoms*: ### What happens?  A backend terminated while loading a tokenizer typmod can hang forever instead of exiting. It logs `FATAL: terminating connection due to administrator command`, then stays `active` in `pg_stat_activity` and keeps its locks. Another `pg_terminate_backend` doesn't help; only `kill -9` does, which resets the cluster.  `load_typmod` (`pg_search/src/api/tokenizers/typmod/mod.rs:500`) holds the `CACHE` mutex (line 508) across its SPI lookup (line 514), and each cache miss registers an `Abort` callback that locks the same mutex (line 539). A FATAL inside that SPI call on a later miss exits without unwinding, so the guard is never dropped. `proc_exit` -> `ShutdownPostgres` -> `AbortTransaction` then runs the earlier miss's callback, which waits on a lock held by a frame that will never return:  ``` parking_lot::raw_mutex::RawMutex::lock_slow pg_search::api::tokenizers::typmod::load_typmod::{closure}   <- Abort callback pgrx::callbacks::register_xact_callback::callback AbortTransaction AbortOutOfAnyTransaction ShutdownPostgres shmem_exit proc_exit ```  `save_typmod` (line 547) has the same pattern (lock 558, SPI 565/593, callback 596); reproduced with two new typmods in one statement.  Any bm25 index with more than one typmod field is exposed: a new backend's first query loads each typmod through SPI. ERROR (cancel, statement_timeout) is not affected because it unwinds and drops the guard; parallel workers are not affected because they fire `XACT_EVENT_PARALLEL_ABOR
  **Post-Mortem & Fix Analysis**:
  > /take

- **Issue #6385** (2026-09-25): **string_agg(..., NULL) uses a comma in DataFusion AggregateScan**
  *Symptoms*: ### What happens?  PostgreSQL and DataFusion both concatenate non-NULL values without a separator when the `STRING_AGG` delimiter is a NULL literal.  ParadeDB's DataFusion AggregateScan instead replaces the NULL delimiterwith a comma. For two `tech` values, it returns `tech,tech` instead of`techtech`. Disabling `paradedb.enable_aggregate_custom_scan` returns the expected `techtech`.  ### To Reproduce  ```SQL CREATE TABLE string_agg_products (     id integer PRIMARY KEY,     description text NOT NULL );  CREATE TABLE string_agg_tags (     id integer PRIMARY KEY,     product_id integer NOT NULL,     tag_name text NOT NULL );  INSERT INTO string_agg_products VALUES (1, 'Laptop with fast processor');  INSERT INTO string_agg_tags VALUES (1, 1, 'tech'), (2, 1, 'tech');  CREATE INDEX string_agg_products_idx ON string_agg_products USING paradedb (id, description);  CREATE INDEX string_agg_tags_idx ON string_agg_tags USING paradedb (id, product_id, tag_name) WITH (     text_fields = '{"tag_name":{"fast":true}}' );  SET paradedb.enable_aggregate_custom_scan = off;  SELECT string_agg(t.tag_name, NULL) FROM string_agg_products p JOIN string_agg_tags t ON p.id = t.product_id WHERE p.description @@@ 'laptop'; -- techtech  SET paradedb.enable_aggregate_custom_scan = on;  EXPLAIN (COSTS OFF) SELECT string_agg(t.tag_name, NULL) FROM string_agg_products p JOIN string_agg_tags t ON p.id = t.product_id WHERE p.description @@@ 'laptop';  SELECT string_agg(t.tag_name, NULL) FROM string_agg_product

- **Issue #6364** (2026-09-16): **Join scan planning aborts the backend on a partitioned index with parallel workers**
  *Symptoms*: ### What happens?  Planning a two-table join over a partitioned index aborts the backend when the join scan is enabled and parallel workers are allowed. The abort is a Rust misaligned-pointer check inside `walk_path_restrictinfo` (`aggregatescan/datafusion_build.rs`), reached from `JoinScan::try_build_join_custom_path` while the upper-paths hook inspects the lower join path. The check only exists in debug builds; a release build performs the same read on a bad pointer and continues.  The whole server restarts, so every other connection is dropped:  ``` thread caused non-unwinding panic. aborting. LOG:  server process (PID 14199) was terminated by signal 6: Abort trap: 6 DETAIL:  Failed process was running: EXPLAIN SELECT users.name FROM users JOIN products ... ```  Required together: a `partition_by` index with more than one segment on the join's driving table, `paradedb.enable_join_custom_scan = on`, `max_parallel_workers_per_gather >= 1`, and an `ORDER BY` whose keys span both tables. With `max_parallel_workers_per_gather = 0`, or the join scan off, or the same index built without `partition_by`, the statement plans normally. `EXPLAIN` alone is enough; no rows are read.  ### To Reproduce  ```sql CREATE TABLE users (id serial8 PRIMARY KEY, name text, color text, age integer); CREATE TABLE products (id serial8 PRIMARY KEY, color text); INSERT INTO users (name, color, age) SELECT 'bob', 'blue', g FROM generate_series(1, 10) g; INSERT INTO products (color) SELECT 'blue' FROM ge

- **Issue #6363** (2026-09-18): **Join scan panics on a JSON path when a segment has no column for it**
  *Symptoms*: ### What happens?  When a join scan has to evaluate a predicate itself instead of pushing it into Tantivy, it reads the projected columns through the fast-field helper. For a JSON path such as `metadata->>'brand'` the helper looks up the column `metadata.brand` in each segment, and JSON sub-columns exist only in segments where at least one document has that key. A segment whose documents all lack the key has no such column, and the lookup panics with:  ``` ERROR:  `metadata.brand` is missing or is not configured as columnar ```  PostgreSQL returns NULL for the missing key. The plain aggregate scan already treats an absent JSON column as all-missing, so the same query without the join succeeds.  The easiest way to get such a segment is a row inserted after `CREATE INDEX`: the build writes the existing rows into sealed segments, and the later insert opens a new segment with that single row in it.  ### To Reproduce  ```sql SET paradedb.enable_custom_scan TO true; SET paradedb.enable_custom_scan_without_operator TO true; SET paradedb.enable_join_custom_scan TO true; SET paradedb.enable_aggregate_custom_scan TO true;  CREATE TABLE ju (id serial8 PRIMARY KEY, name text, metadata jsonb); CREATE TABLE jp (id serial8 PRIMARY KEY, name text); INSERT INTO ju (name, metadata) SELECT 'bob', '{"brand": "apple"}' FROM generate_series(1, 20); INSERT INTO jp (name) SELECT 'bob' FROM generate_series(1, 21); CREATE INDEX ju_idx ON ju USING paradedb (id, (name::pdb.literal), (metadata::pdb.simpl
  **Post-Mortem & Fix Analysis**:
  > The qgen churn proptests hit the same error through the aggregate scan. After a few rounds of "delete some rows, insert as many random ones" on the qgen tables (some of the new rows have `metadata` NULL or `{}`), this fails:  ```sql SELECT COUNT(*), users.age, users.metadata->'brand' FROM users FULL JOIN products ON users.id = products.id            FULL JOIN orders ON products.age = orders.age AND products.id <> orders.id WHERE (users.name @@@ 'bob') OR ((users.name IS NULL) AND (users.name @@@ 'bob')) GROUP BY users.age, users.metadata->'brand'; -- ERROR:  `metadata.brand` is missing or is not configured as columnar ```  with `enable_custom_scan`, `enable_custom_scan_without_operator`, `enable_join_custom_scan` and `enable_aggregate_custom_scan` on. A single-session script that replays it (schema, the churn, the query): https://gist.github.com/mdashti/c86a8af28a4eed33fee11ce3d291f2c1 

- **Issue #6353** (2026-09-18): **Aggregate scan truncates a fractional COALESCE default on integer and JSON-path columns**
  *Symptoms*: ### What happens?  The aggregate scan pushes `AGG(COALESCE(field, default))` down as a Tantivy aggregation with `missing = default`. Tantivy converts `missing` into the column's own numeric type before aggregating, so on an integer-typed column a fractional default is truncated: `1.5` becomes `1`. PostgreSQL promotes `COALESCE(int, 1.5)` to `numeric`, so the two disagree.  Three column shapes hit it:  1. A declared integer column. Since the `COALESCE` pushdown in v0.19.0 (#3195). 2. A JSON path whose values in a segment are integers, so its on-demand column is `I64`. Via `pdb.agg` with an explicit `missing` since v0.20.0; via plain SQL since #6201 (v0.26.0-rc.1). 3. A JSON path with no values in a segment. No column exists, Tantivy fabricates an empty `U64` one, and the default is truncated the same way. A single row inserted after `CREATE INDEX` lands alone in a segment and triggers this.  `double precision` columns are unaffected. `SUM`, `MIN` and `MAX` share the path with `AVG`.  ### To Reproduce  ```sql SET paradedb.enable_aggregate_custom_scan TO true;  -- 1. declared integer column: expected 2.75, gets 2.5 CREATE TABLE int_col (id serial8 PRIMARY KEY, n integer); INSERT INTO int_col (n) VALUES (4), (NULL); CREATE INDEX int_col_idx ON int_col USING paradedb (id, n); SELECT AVG(COALESCE(n, 1.5)) FROM int_col;                          -- 2.75 SELECT AVG(COALESCE(n, 1.5)) FROM int_col WHERE id @@@ pdb.all();   -- 2.5  -- 2. JSON path with integer values: expected 2.75, gets

- **Issue #6337** (2026-09-15): **JoinScan UUID scalar filter fails with Unsupported OID for Utf8 Arrow type**
  *Symptoms*: A scalar UUID predicate inside a cross-table `NOT` fails during ParadeDB Join Scan execution. PostgreSQL returns the expected rows when the join custom scan is disabled.  Reproduced on PostgreSQL 18.3 / macOS arm64, with main through `3d46f86b8` (test-syntax PR #6336, no backend changes for this rewrite).  ## Reproduction  Run in a fresh database:  ```sql CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_search; CREATE TABLE scalar_uuid_users (id bigint, name text); CREATE TABLE scalar_uuid_products (id bigint, uuid uuid); CREATE TABLE scalar_uuid_orders (id bigint); INSERT INTO scalar_uuid_users SELECT i, 'bob' FROM generate_series(1,4) i; INSERT INTO scalar_uuid_products SELECT i, '00000000-0000-0000-0000-000000000001'::uuid FROM generate_series(1,4) i; INSERT INTO scalar_uuid_orders SELECT i FROM generate_series(1,4) i; CREATE INDEX ON scalar_uuid_users USING paradedb (id, (name::pdb.literal)); CREATE INDEX ON scalar_uuid_products USING paradedb (id, uuid); CREATE INDEX ON scalar_uuid_orders USING paradedb (id); SET paradedb.enable_custom_scan = false; SET paradedb.enable_custom_scan_without_operator = false; SET paradedb.enable_filter_pushdown = true; SET paradedb.enable_join_custom_scan = true; SET max_parallel_workers_per_gather = 0; EXPLAIN (COSTS OFF) SELECT u.id, u.name FROM scalar_uuid_users u JOIN scalar_uuid_products p ON u.id=p.id JOIN scalar_uuid_orders o ON p.id=o.id WHERE NOT (u.id=4 AND p.uuid='550e8400-e29b-41d4-a716-446655440000'::uui

- **Issue #6245** (2026-09-11): **JoinScan sorts null-extended rows by the first document's text value**
  *Symptoms*: # What happens?  When a `LIMIT` query sorts on a text fast field of the nullable side of an outer join, the join scan returns the wrong rows. The null-extended rows sort as if they carried the first document's value, so they push real rows out of the Top-K.  `generated_joins_small` hits this on `main` in the nightly `Test pg_search on PostgreSQL 15 (system - arm64)` job, two nights in a row:  - `f4b1f65e2`, seed `10849321932737051440`: https://github.com/paradedb/paradedb/actions/runs/33951955783/job/101268305586. Postgres returns `(1, bob)`, the join scan returns `(NULL, NULL)`. - `c807edea8`, seed `7653169537050439852`: https://github.com/paradedb/paradedb/actions/runs/34018598791/job/101446894296. Postgres returns `(NULL), (3, brisket), (5, sally), (8, sally)`, the join scan returns `(NULL), (NULL), (NULL), (5, sally)`.  Both queries are a `RIGHT JOIN` (the second is a `FULL JOIN` that the planner reduces to one) with `ORDER BY upper(users.category), ...` and `users` on the nullable side. In both plans `SegmentedTopKExec` sorts on `category` below the node that decodes it.  #6242 traced it to the encoding. A deferred string column is a dense `UnionArray` of doc addresses or term ordinals, and a dense union has no validity bitmap. DataFusion null-extends the nullable side of an outer join with arrow's `take`, which for a NULL index copies row 0 instead of writing a NULL. So every null-extended row reaches the Top-K with the first build row's ordinal. A batch of only unmatch
  **Post-Mortem & Fix Analysis**:
  > Reopening. The guard in #6236 makes the decoded value NULL. `SegmentedTopKExec` runs below `TantivyFetchExec` and `TantivyDecodeExec`, so it still ranks the null-extended rows on the ordinal they borrow from the first build row.  On 350dbfbcf the repro above returns `oj_dim` row 1, then twenty null-extended rows, then rows 2 to 5. Postgres returns rows 1 to 20 and then five null-extended ones. `0.25.x` is the same through #6249.  #6247 keeps the nulls in the column itself, so every reader sees them.

- **Issue #6220** (2026-09-07): **`generated_pdb_agg_join` fails when the generated aggregate outgrows `work_mem`**
  *Symptoms*: # What?  `generated_pdb_agg_join` in `tests/tests/qgen.rs` fails on CI when the query it generates needs more than `work_mem` for its final hash aggregate:  ``` DataFusion aggregate execution failed: Final hash aggregate cannot spill because temporary files are not enabled in the DiskManager ```  Two hits in two runs of one PR, on different Postgres versions and with different seeds, so it's close to reliable on current `main`:  - PG 18 (pgrx), `PARADEDB_QGEN_SEED: 4706007971346825089`: https://github.com/paradedb/paradedb/actions/runs/33902730871/job/101120476529 - PG 17 (system), `PARADEDB_QGEN_SEED: 777977062730713946`: https://github.com/paradedb/paradedb/actions/runs/33934053363/job/101218398200  ## Why?  The error is by design. `build_runtime_env` in `pg_search/src/postgres/customscan/datafusion/memory.rs` gives the aggregate and join scans a `work_mem`-sized pool and a disabled disk manager, because spilling isn't wired to Postgres temp files yet. A plan that outgrows the pool errors instead of writing untracked files.  The oracle doesn't know that. It compares `pdb.agg()` against a plain `GROUP BY`, and the plain side has no such budget, so a resource error on the `pdb.agg()` side counts as a mismatch. Any PR that lands after #6210 and #6212 now rolls this dice on every push.  ## How?  Three options, from smallest to largest:  1. Treat the pool-exhausted error as an accepted outcome in `compare_outcome_retrying` for this case, the way `translator.rs` treats an unnorma
  **Post-Mortem & Fix Analysis**:
  > Hey @mdashti @philippemnoel — took a look at this and opened a fix in [#6230](https://github.com/paradedb/paradedb/pull/6230)  generated_pdb_agg_join was treating DataFusion’s intentional work_mem / DiskManager-disabled spill error as an oracle mismatch against unbounded Postgres GROUP BY.  The PR follows the options from the issue:  1. Accept that pool-exhaustion error as a capability miss in the qgen compare path (same idea as declining an unnormalized list in the translator). 2. Raise work_mem to 16MB for generated_pdb_agg_join, matching generated_joinscan, so typical cases still compare results.  Left wiring DiskManager spilling out of scope, as suggested. Happy to adjust if you’d rather take a different route.
  > @aryanpatel-ctrl Apologies and thanks for taking a look. This is already fixed/merged in https://github.com/paradedb/paradedb/pull/6235

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

### Incident Patch 1: `ad275852` (2026-09-30)
**Commit Message**: fix: don't hold the typmod caches across SPI (#6554)

# Ticket(s) Closed

- Closes #6489

## What

Prevent backend hangs when loading or saving tokenizer settings is
interrupted by `pg_terminate_backend`, or reentered through SQL executed
by SPI. Report missing stored tokenizer settings explicitly.

## Why

The typmod caches were locked across SPI calls. A FATAL during SPI exits
without unwinding, leaving the mutex locked. An abort callback
registered by an earlier lookup then waits on that mutex forever, so the
terminated backend stays active and retains its locks.

The cached prepared statements also had mutexes held across execution. A
row-security policy on `paradedb._typmod_cache` can call back into the
same typmod function, causing the nested lookup to wait on the outer
lookup's lock.

## How

- Check each typmod cache under its mutex, release the guard before SPI,
then reacquire it to insert the result. Preserve the existing
transaction-abort callbacks.
- Keep the prepared lookup statements in `OnceLock<StmtHolder>` without
an execution mutex. Prepared-statement reuse is retained.
- Distinguish an empty lookup result from an SPI failure. Propagate
lookup errors and report mi

**File**: `docs/project/changelog/unreleased/6554.stability.mdx` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+header: stability
+---
+
+A backend terminated, for example with `pg_terminate_backend`, while it was loading or saving tokenizer settings no longer hangs. It used to stay active and keep its locks until it was killed with `SIGKILL`, which restarts the cluster. A new connection loads these settings in its first query against an index with more than one tokenizer-configured field.
+
+Loading tokenizer settings no longer hangs when a row security policy or trigger on `paradedb._typmod_cache` calls back into a tokenizer function. Settings missing from that table now raise `stored tokenizer options could not be found` instead of an internal SPI error.
```

**File**: `pg_search/src/api/operator.rs` (modified, +1/-2)
```diff
@@ -860,8 +860,7 @@ pub unsafe fn field_name_from_node(
     if let Some(relabel) = nodecast!(RelabelType, T_RelabelType, node)
         && type_is_alias((*relabel).resulttype)
     {
-        let typmod =
-            AliasTypmod::try_from((*relabel).resulttypmod).unwrap_or_else(|e| panic!("{e}"));
+        let typmod = AliasTypmod::try_from((*relabel).resulttypmod).unwrap_or_else(|e| e.report());
         if let Some(alias) = typmod.alias() {
             return Some(FieldName::from(alias));
         }
```

**File**: `pg_search/src/api/tokenizers/definitions.rs` (modified, +2/-3)
```diff
@@ -971,7 +971,7 @@ fn literal_typmod_in<'a>(typmod_parts: Array<'a, &'a CStr>) -> i32 {
     let parsed_typmod = ParsedTypmod::try_from(&typmod_parts).unwrap();
     if parsed_typmod.len() == 1 && matches!(parsed_typmod[0].key(), Some("alias")) {
         drop(parsed_typmod);
-        return save_typmod(typmod_parts.iter()).expect("should not fail to save typmod");
+        return save_typmod(typmod_parts.iter()).unwrap_or_else(|e| e.report());
     }
 
     ErrorReport::new(
@@ -1016,8 +1016,7 @@ fn alias_typmod_in<'a>(typmod_parts: Array<'a, &'a CStr>) -> i32 {
         CString::new(format!("alias={raw}")).unwrap()
     };
 
-    save_typmod(std::iter::once(Some(normalized.as_c_str())))
-        .expect("should not fail to save typmod")
+    save_typmod(std::iter::once(Some(normalized.as_c_str()))).unwrap_or_else(|e| e.report())
 }
 
 extension_sql!(
```

**File**: `pg_search/src/api/tokenizers/mod.rs` (modified, +19/-33)
```diff
@@ -72,9 +72,13 @@ pub fn type_can_be_tokenized(oid: pg_sys::Oid) -> bool {
 #[inline]
 pub fn try_get_alias(oid: pg_sys::Oid, typmod: Typmod) -> Option<String> {
     if type_is_alias(oid) {
-        AliasTypmod::try_from(typmod).ok()?.alias()
+        AliasTypmod::try_from(typmod)
+            .unwrap_or_else(|e| e.report())
+            .alias()
     } else if type_is_tokenizer(oid) {
-        UncheckedTypmod::try_from(typmod).ok()?.alias()
+        UncheckedTypmod::try_from(typmod)
+            .unwrap_or_else(|e| e.report())
+            .alias()
     } else {
         None
     }
@@ -318,7 +322,7 @@ pub fn search_field_config_from_type(
 
     let normalizer = tokenizer.normalizer().unwrap_or_default();
 
-    let parsed_typmod = typmod::load_typmod(typmod).unwrap_or_default();
+    let parsed_typmod = typmod::load_typmod(typmod).unwrap_or_else(|e| e.report());
 
     let parsed_fieldnorms = parsed_typmod.get("fieldnorms").and_then(|p| p.as_bool());
     let pnorms = parsed_typmod
@@ -399,9 +403,7 @@ pub fn apply_typmod(tokenizer: &mut SearchTokenizer, typmod: Typmod) {
             positions,
             filters,
         } => {
-            let ngram_typmod = NgramTypmod::try_from(typmod).unwrap_or_else(|e| {
-                panic!("{}", e);
-            });
+            let ngram_typmod = NgramTypmod::try_from(typmod).unwrap_or_else(|e| e.report());
             *min_gram = ngram_typmod.min_gram;
             *max_gram = ngram_typmod.max_gram;
             *prefix_only = ngram_typmod.prefix_only;
@@ -414,26 +416,21 @@ pub fn apply_typmod(tokenizer: &mut SearchTokenizer, typmod: Typmod) {
             token_chars,
             filters,
         } => {
-            let edge_ngram_typmod = EdgeNgramTypmod::try_from(typmod).unwrap_or_else(|e| {
-                panic!("{}", e);
-            });
+            let edge_ngram_typmod =
+                EdgeNgramTypmod::try_from(typmod).unwrap_or_else(|e| e.report());
             *min_gram = edge_ngram_typmod.min_gram;
             *max_gram = edge_ngram_typmod.max_gram;
             *token_chars = edge_ngram_typmod.token_chars;
             *filters = edge_ngram_typmod.filters;
         }
         SearchTokenizer::RegexTokenizer { pattern, filters } => {
-            let regex_typmod = RegexTypmod::try_from(typmod).unwrap_or_else(|e| {
-                panic!("{}", e);
-            });
+            let regex_typmod = RegexTypmod::try_from(typmod).unwrap_or_else(|e| e.report());
             *pattern = regex_typmod.pattern.to_string();
             *filters = regex_typmod.filters;
         }
 
         SearchTokenizer::LinderaDeprecated(style, filters) => {
-            let lindera_typmod = LinderaTypmod::try_from(typmod).unwrap_or_else(|e| {
-                panic!("{}", e);
-            });
+            let lindera_typmod = LinderaTypmod::try_from(typmod).unwrap_or_else(|e| e.report());
             *style = lindera_typmod.language;
             *filters = lindera_typmod.filters;
         }
@@ -444,9 +441,7 @@ pub fn apply_typmod(tokenizer: &mut SearchTokenizer, typmod: Typmod) {
             nfkc,
             reading_form,
         } => {
-            let lindera_typmod = LinderaTypmod::try_from(typmod).unwrap_or_else(|e| {
-                panic!("{}", e);
-            });
+            let lindera_typmod = LinderaTypmod::try_from(typmod).unwrap_or_else(|e| e.report());
             *language = lindera_typmod.language;
             *filters = lindera_typmod.filters;
             *keep_whitespace = lindera_typmod.keep_whitespace;
@@ -466,9 +461,7 @@ pub fn apply_typmod(tokenizer: &mut SearchTokenizer, typmod: Typmod) {
             filters,
             keep_whitespace,
         } => {
-            let lindera_typmod = LinderaTypmod::try_from(typmod).unwrap_or_else(|e| {
-                panic!("{}", e);
-            });
+            let lindera_typmod = LinderaTypmod::try_from(typmod).unwrap_or_else(|e| e.report());
             *filters = lindera_typmod.filters;
       
```

**File**: `pg_search/src/api/tokenizers/typmod/mod.rs` (modified, +106/-89)
```diff
@@ -21,12 +21,12 @@ mod validation;
 use parking_lot::Mutex;
 use pgrx::datum::DatumWithOid;
 use pgrx::pg_sys::BuiltinOid;
+use pgrx::pg_sys::panic::ErrorReport;
 use pgrx::spi::{OwnedPreparedStatement, Query};
 use pgrx::{
-    Array, PgOid, PgXactCallbackEvent, Spi, extension_sql, pg_extern, pg_sys,
-    register_xact_callback,
+    Array, PgLogLevel, PgOid, PgSqlErrorCode, PgXactCallbackEvent, Spi, extension_sql,
+    function_name, pg_extern, pg_sys, register_xact_callback,
 };
-use std::collections::hash_map::Entry;
 use std::ffi::{CStr, CString};
 use std::fmt::Display;
 use std::ops::Index;
@@ -42,12 +42,12 @@ use tokenizers::SearchNormalizer;
 
 #[pg_extern(immutable, parallel_safe)]
 fn generic_typmod_in(typmod_parts: Array<&CStr>) -> i32 {
-    save_typmod(typmod_parts.iter()).expect("should not fail to save typmod")
+    save_typmod(typmod_parts.iter()).unwrap_or_else(|e| e.report())
 }
 
 #[pg_extern(immutable, parallel_safe)]
 pub fn generic_typmod_out(typmod: i32) -> CString {
-    let parsed = load_typmod(typmod).expect("should not fail to load typmod");
+    let parsed = load_typmod(typmod).unwrap_or_else(|e| e.report());
 
     // make sure the typmods are string-quoted literals
     let mut parts = Vec::with_capacity(parsed.len());
@@ -103,6 +103,23 @@ impl From<ValidationError> for Error {
     }
 }
 
+impl Error {
+    /// Raises this error as a Postgres `ERROR`, worded for the user who hit it.
+    pub(crate) fn report(self) -> ! {
+        let Error::TypmodNotFound(id) = self else {
+            pgrx::error!("{self}");
+        };
+        ErrorReport::new(
+            PgSqlErrorCode::ERRCODE_INTERNAL_ERROR,
+            "stored tokenizer options could not be found",
+            function_name!(),
+        )
+        .set_detail(format!("paradedb._typmod_cache has no entry with id {id}."))
+        .report(PgLogLevel::ERROR);
+        unreachable!("an ERROR report does not return")
+    }
+}
+
 pub type Result<T> = std::result::Result<T, Error>;
 
 pub type PropertyKey = Option<String>;
@@ -490,6 +507,10 @@ impl ParsedTypmod {
     }
 }
 
+/// A prepared statement kept for the life of the backend.
+///
+/// It has no lock around it: the SQL it runs can call back into the same function, and a lock
+/// held while the statement executes would make that inner call wait on itself forever.
 #[repr(transparent)]
 struct StmtHolder(OwnedPreparedStatement);
 
@@ -504,44 +525,44 @@ pub fn load_typmod(typmod: i32) -> Result<ParsedTypmod> {
         return Ok(ParsedTypmod::new());
     }
 
+    // Don't hold `CACHE` across SPI: a FATAL in there exits without unwinding, so the guard
+    // would never drop, and the Abort callback below would block on it forever during exit.
     let cache = CACHE.get_or_init(Default::default);
-    let mut locked = cache.lock();
-
-    match locked.entry(typmod) {
-        Entry::Occupied(e) => Ok(e.get().clone()),
-        Entry::Vacant(e) => {
-            let parsed_typmod = ParsedTypmod::try_from(
-                Spi::connect(|client| {
-                    static STMT: OnceLock<Mutex<StmtHolder>> = OnceLock::new();
-
-                    let prepared = STMT.get_or_init(|| {
-                        Mutex::new(StmtHolder(
-                            client
-                                .prepare(
-                                    "SELECT typmod FROM paradedb._typmod_cache WHERE id = $1",
-                                    &[PgOid::BuiltIn(BuiltinOid::INT4OID)],
-                                )
-                                .expect("failed to prepare statement")
-                                .keep(),
-                        ))
-                    });
-
-                    let datum = unsafe { [DatumWithOid::new(typmod, pg_sys::INT4OID)] };
-                    (&prepared.lock().0)
-                        .execute(client, None, &datum)?
-                        .first()
-                        .get::<Vec<String>>(1)
-                })?
-                .ok
```

---

### Incident Patch 2: `beb9046f` (2026-09-30)
**Commit Message**: chore: Increase benchmarker memory limit (#6561)

Increase memory limit, and ensure that logs are captured.

First green run:
https://github.com/paradedb/paradedb/actions/runs/36656410331

**File**: `.github/patches/benchmarker.patch` (modified, +23/-4)
```diff
@@ -1,8 +1,18 @@
 diff --git a/benchmarks/Makefile.common b/benchmarks/Makefile.common
-index 3e1e7c5..8849afb 100644
+index 3e1e7c5..918ef18 100644
 --- a/benchmarks/Makefile.common
 +++ b/benchmarks/Makefile.common
-@@ -49,8 +49,16 @@ MAX_PARALLEL_WORKERS ?= 8
+@@ -40,17 +40,25 @@ CPUS ?= 8
+ # Explicit MEMORY overrides apply to every target; only create defaults to 64g.
+ ifeq ($(origin MEMORY),undefined)
+ MEMORY := 32g
+-create _create_backend: MEMORY := 64g
++create _create_backend index _index_backend: MEMORY := 64g
+ endif
+ SHARED_BUFFERS ?= 24GB
+ MAINTENANCE_WORK_MEM ?= 24GB
+ MAX_PARALLEL_MAINTENANCE_WORKERS ?= 8
+ MAX_PARALLEL_WORKERS ?= 8
  POSTGRES_SHM_SIZE ?= 16g
  WORKERS ?= 1
  BATCH_SIZE ?= 10000
@@ -108,7 +118,7 @@ index 3e1e7c5..8849afb 100644
 +	state="$$STORAGE_STATE_DIR/$$backend"
 +	log="$$STORAGE_STATE_DIR/logs/$$(date -u +%Y%m%dT%H%M%S)-$$backend-index.log"
 +	{
-+	  trap '$(COMPOSE) stop "$$backend"' EXIT
++	  trap 'rc=$$?; if [[ $$rc -ne 0 ]]; then echo "$$backend: abnormal exit (code $$rc); dumping logs:"; $(COMPOSE) logs --tail 200 "$$backend" || true; fi; $(COMPOSE) stop -t 10 "$$backend" || $(COMPOSE) kill "$$backend"' EXIT
 +	  trap 'exit 130' INT
 +	  trap 'exit 143' TERM
 +	  echo "$$backend: starting for indexing (log: $$log)"
@@ -131,9 +141,18 @@ index 3e1e7c5..8849afb 100644
  	@source "$$CONFIG_DIR/volumes.sh"
  	mkdir -p "$$STORAGE_STATE_DIR" "$$OUT_DIR"
 diff --git a/benchmarks/compose.yml b/benchmarks/compose.yml
-index fb0f057..e7f3546 100644
+index fb0f057..3524b07 100644
 --- a/benchmarks/compose.yml
 +++ b/benchmarks/compose.yml
+@@ -22,7 +22,7 @@ x-postgres: &postgres
+       "-c",
+       "max_parallel_workers_per_gather=2",
+     ]
+-  stop_grace_period: 10m
++  stop_grace_period: ${STOP_GRACE_PERIOD:-30s}
+   healthcheck:
+     test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U postgres -d benchmark"]
+     interval: 2s
 @@ -30,9 +30,10 @@ x-postgres: &postgres
      retries: 150
 
```

**File**: `.github/workflows/benchmark-pg_search-benchmarker.yml` (modified, +18/-5)
```diff
@@ -162,8 +162,14 @@ jobs:
           done
 
       - name: Dump database logs on failure
-        if: failure()
-        run: docker logs paradedb || true
+        if: failure() || cancelled()
+        run: |
+          echo "== Docker containers =="
+          docker ps -a || true
+          echo "== ParadeDB container logs =="
+          docker logs --tail 200 $(docker ps -aq --filter "name=paradedb") || true
+          echo "== Kernel dmesg (OOM / Segfault) =="
+          sudo dmesg -T | grep -i -E 'killed process|oom|segfault|out of memory' | tail -n 50 || true
 
       - name: Publish Benchmarker Results
         if: success()
@@ -274,7 +280,8 @@ jobs:
           make -f Makefile.${DATASET} index \
             BACKENDS=paradedb \
             PARADEDB_IMAGE="${IMAGE_TAG}" \
-            VOLUME_ROOT="${VOLUME_ROOT}"
+            VOLUME_ROOT="${VOLUME_ROOT}" \
+            MEMORY=64g
 
       - name: Run benchmark
         working-directory: benchmarker
@@ -313,8 +320,14 @@ jobs:
             VOLUME_ROOT="${VOLUME_ROOT}"
 
       - name: Dump database logs on failure
-        if: failure()
-        run: docker ps -a && docker logs --tail 200 $(docker ps -aq --filter "name=paradedb") || true
+        if: failure() || cancelled()
+        run: |
+          echo "== Docker containers =="
+          docker ps -a || true
+          echo "== ParadeDB container logs =="
+          docker logs --tail 200 $(docker ps -aq --filter "name=paradedb") || true
+          echo "== Kernel dmesg (OOM / Segfault) =="
+          sudo dmesg -T | grep -i -E 'killed process|oom|segfault|out of memory' | tail -n 50 || true
 
       - name: Publish Benchmarker Results
         if: success()
```

---

### Incident Patch 3: `166039dc` (2026-09-30)
**Commit Message**: fix: keep the Join Scan's ORDER BY when LIMIT is a parameter (#6555)

# Ticket(s) Closed

- Closes #5574

## What

`VisibilityFilterExec` now declares that it keeps its input's row order,
so DataFusion no longer removes a `Sort` below it.

## Why

On a generic plan with a parameterized `LIMIT`, the Join Scan advertises
its `ORDER BY` as pathkeys, so Postgres adds no Sort above it, and the
`LIMIT` is only injected into the DataFusion plan at execution time. At
planning time the plan therefore has a plain `Sort` with no fetch, and
`VisibilityFilterOptimizerRule` does not treat a plain sort as a
barrier, so it places the visibility check for `p` above it.

`VisibilityFilterExec` copies its input's equivalence properties, so it
claims the input's ordering, but it did not override
`maintains_input_order`, which defaults to `false`. `EnforceSorting`
goes by the latter: a `SortExec` whose parent does not keep its order
cannot affect the output, so it is removed as unnecessary. The runtime
`Limit` then takes the first rows in hash-join probe order.

With a literal `LIMIT` the plan has `SortExec: TopK(fetch=5)`, which the
visibility rule treats as a barrier and `EnforceSorting` cannot drop,

**File**: `docs/project/changelog/unreleased/6555.stability.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+A prepared statement whose `LIMIT` is a parameter no longer gets rows out of `ORDER BY` order from the join scan. Once Postgres switched the statement to a generic plan, the join scan could return the first rows in join order instead of the sorted ones.
```

**File**: `pg_search/src/postgres/customscan/joinscan/visibility_filter.rs` (modified, +7/-0)
```diff
@@ -1245,6 +1245,13 @@ impl ExecutionPlan for VisibilityFilterExec {
         vec![&self.input]
     }
 
+    // Invisible rows are dropped batch by batch and the rest keep their order, as the
+    // equivalence properties copied from the input already claim. Without this, a `SortExec`
+    // below this node looks unnecessary to `EnforceSorting` and is removed.
+    fn maintains_input_order(&self) -> Vec<bool> {
+        vec![true]
+    }
+
     fn apply_expressions(
         &self,
         _f: &mut dyn FnMut(
```

**File**: `pg_search/tests/pg_regress/expected/issue_5574.out` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+-- Issue #5574: a Join Scan whose LIMIT is a parameter advertises sorted output, but on a
+-- generic plan the ORDER BY vanished from its DataFusion plan, so the scan returned rows in
+-- join probe order.
+CREATE EXTENSION IF NOT EXISTS pg_search;
+CREATE TABLE issue_5574_parent (id int PRIMARY KEY, kind text);
+CREATE TABLE issue_5574_child (id bigint PRIMARY KEY, parent_id bigint);
+-- Two thirds of the parents are 'manga', and every parent 1..1000 has two children, g and
+-- g + 1000, so the correct order repeats each parent id.
+INSERT INTO issue_5574_parent
+SELECT g, CASE WHEN g % 3 = 0 THEN 'novel' ELSE 'manga' END
+FROM generate_series(1, 2000) g;
+INSERT INTO issue_5574_child
+SELECT g, ((g - 1) % 1000) + 1
+FROM generate_series(1, 2000) g;
+CREATE INDEX issue_5574_parent_idx ON issue_5574_parent USING bm25 (id, kind) WITH (key_field = 'id');
+WARNING:  key_field is deprecated as of 0.26.0 and is a no-op; it no longer needs to be provided
+CREATE INDEX issue_5574_child_idx ON issue_5574_child USING bm25 (id, parent_id) WITH (key_field = 'id');
+WARNING:  key_field is deprecated as of 0.26.0 and is a no-op; it no longer needs to be provided
+ANALYZE issue_5574_parent;
+ANALYZE issue_5574_child;
+-- Steer the planner to the Join Scan
+SET enable_hashjoin = off;
+SET enable_mergejoin = off;
+SET enable_nestloop = off;
+SET max_parallel_workers_per_gather = 0;
+SET plan_cache_mode = force_generic_plan;
+PREPARE issue_5574_page AS
+SELECT p.id
+FROM issue_5574_parent p JOIN issue_5574_child c ON c.parent_id = p.id
+WHERE p.kind @@@ pdb.term('manga') AND c.id @@@ pdb.all()
+ORDER BY p.id
+LIMIT $1;
+-- The DataFusion plan must keep a SortExec for the ORDER BY
+EXPLAIN (FORMAT TEXT, COSTS OFF, TIMING OFF) EXECUTE issue_5574_page(5);
+                                                          QUERY PLAN                                                           
+-------------------------------------------------------------------------------------------------------------------------------
+ Custom Scan (ParadeDB Join Scan)
+   Relation Tree: p INNER c
+   Join Cond: c.parent_id = p.id
+   Limit: $1
+   Order By: c.parent_id asc
+   DataFusion Physical Plan: 
+     : VisibilityFilterExec: tables=[p]
+     :   ProjectionExec: expr=[id@0 as col_1, ctid_0@1 as ctid_0]
+     :     VisibilityFilterExec: tables=[c], pruned=[c]
+     :       SortExec: expr=[id@1 ASC NULLS LAST], preserve_partitioning=[false]
+     :         HashJoinExec: mode=CollectLeft, join_type=Inner, on=[(id@1, parent_id@0)]
+     :           CooperativeExec
+     :             PgSearchScan: table=p, segments=1, query={"with_index":{"query":{"term":{"field":"kind","value":"manga"}}}}
+     :           CooperativeExec
+     :             PgSearchScan: table=c, segments=1, dynamic_filters=1, query={"with_index":{"query":{"all":{"field":"id"}}}}
+(15 rows)
+
+EXECUTE issue_5574_page(5);
+ id 
+----
+  1
+  1
+  2
+  2
+  4
+(5 rows)
+
+-- Same rows as with a literal LIMIT
+SELECT p.id
+FROM issue_5574_parent p JOIN issue_5574_child c ON c.parent_id = p.id
+WHERE p.kind @@@ pdb.term('manga') AND c.id @@@ pdb.all()
+ORDER BY p.id
+LIMIT 5;
+ id 
+----
+  1
+  1
+  2
+  2
+  4
+(5 rows)
+
+-- A parameterized OFFSET is resolved on the same path
+PREPARE issue_5574_page_offset AS
+SELECT p.id
+FROM issue_5574_parent p JOIN issue_5574_child c ON c.parent_id = p.id
+WHERE p.kind @@@ pdb.term('manga') AND c.id @@@ pdb.all()
+ORDER BY p.id
+LIMIT $1 OFFSET $2;
+EXECUTE issue_5574_page_offset(4, 3);
+ id 
+----
+  2
+  4
+  4
+  5
+(4 rows)
+
+SELECT p.id
+FROM issue_5574_parent p JOIN issue_5574_child c ON c.parent_id = p.id
+WHERE p.kind @@@ pdb.term('manga') AND c.id @@@ pdb.all()
+ORDER BY p.id
+LIMIT 4 OFFSET 3;
+ id 
+----
+  2
+  4
+  4
+  5
+(4 rows)
+
+DEALLOCATE issue_5574_page;
+DEALLOCATE issue_5574_page_offset;
+RESET plan_cache_mode;
+RESET max_parallel_workers_per_gather;
+RESET enable_nestloop;
+RESET enable_mergejoin;
+RESET enable_hashjoin
```

**File**: `pg_search/tests/pg_regress/sql/issue_5574.sql` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+-- Issue #5574: a Join Scan whose LIMIT is a parameter advertises sorted output, but on a
+-- generic plan the ORDER BY vanished from its DataFusion plan, so the scan returned rows in
+-- join probe order.
+
+CREATE EXTENSION IF NOT EXISTS pg_search;
+
+CREATE TABLE issue_5574_parent (id int PRIMARY KEY, kind text);
+CREATE TABLE issue_5574_child (id bigint PRIMARY KEY, parent_id bigint);
+
+-- Two thirds of the parents are 'manga', and every parent 1..1000 has two children, g and
+-- g + 1000, so the correct order repeats each parent id.
+INSERT INTO issue_5574_parent
+SELECT g, CASE WHEN g % 3 = 0 THEN 'novel' ELSE 'manga' END
+FROM generate_series(1, 2000) g;
+INSERT INTO issue_5574_child
+SELECT g, ((g - 1) % 1000) + 1
+FROM generate_series(1, 2000) g;
+
+CREATE INDEX issue_5574_parent_idx ON issue_5574_parent USING bm25 (id, kind) WITH (key_field = 'id');
+CREATE INDEX issue_5574_child_idx ON issue_5574_child USING bm25 (id, parent_id) WITH (key_field = 'id');
+ANALYZE issue_5574_parent;
+ANALYZE issue_5574_child;
+
+-- Steer the planner to the Join Scan
+SET enable_hashjoin = off;
+SET enable_mergejoin = off;
+SET enable_nestloop = off;
+SET max_parallel_workers_per_gather = 0;
+SET plan_cache_mode = force_generic_plan;
+
+PREPARE issue_5574_page AS
+SELECT p.id
+FROM issue_5574_parent p JOIN issue_5574_child c ON c.parent_id = p.id
+WHERE p.kind @@@ pdb.term('manga') AND c.id @@@ pdb.all()
+ORDER BY p.id
+LIMIT $1;
+
+-- The DataFusion plan must keep a SortExec for the ORDER BY
+EXPLAIN (FORMAT TEXT, COSTS OFF, TIMING OFF) EXECUTE issue_5574_page(5);
+EXECUTE issue_5574_page(5);
+
+-- Same rows as with a literal LIMIT
+SELECT p.id
+FROM issue_5574_parent p JOIN issue_5574_child c ON c.parent_id = p.id
+WHERE p.kind @@@ pdb.term('manga') AND c.id @@@ pdb.all()
+ORDER BY p.id
+LIMIT 5;
+
+-- A parameterized OFFSET is resolved on the same path
+PREPARE issue_5574_page_offset AS
+SELECT p.id
+FROM issue_5574_parent p JOIN issue_5574_child c ON c.parent_id = p.id
+WHERE p.kind @@@ pdb.term('manga') AND c.id @@@ pdb.all()
+ORDER BY p.id
+LIMIT $1 OFFSET $2;
+
+EXECUTE issue_5574_page_offset(4, 3);
+
+SELECT p.id
+FROM issue_5574_parent p JOIN issue_5574_child c ON c.parent_id = p.id
+WHERE p.kind @@@ pdb.term('manga') AND c.id @@@ pdb.all()
+ORDER BY p.id
+LIMIT 4 OFFSET 3;
+
+DEALLOCATE issue_5574_page;
+DEALLOCATE issue_5574_page_offset;
+RESET plan_cache_mode;
+RESET max_parallel_workers_per_gather;
+RESET enable_nestloop;
+RESET enable_mergejoin;
+RESET enable_hashjoin;
+
+DROP TABLE issue_5574_child, issue_5574_parent;
```

---

### Incident Patch 4: `4917fb13` (2026-09-29)
**Commit Message**: fix: Fix a crash when a search scan is cancelled or terminated (#6479)

## What

Terminating a backend in the middle of a search (`pg_terminate_backend`,
or the SIGTERM a parallel query's leader sends its workers on cancel)
can crash the server, or leave buffer pins and table locks held until it
restarts. This skips dropping pg_search's scan state once `proc_exit`
has started.

## Why it happens

A FATAL doesn't unwind. `proc_exit` runs right where
`CHECK_FOR_INTERRUPTS()` fired, which can be deep inside a Rust call.
The abort then frees the query's memory, and pgrx's callback drops the
scan state while that call is still using it:
- a `OnceLock` whose initializer never finished panics (`invalid Once
state`);
- the tokio runtime whose `block_on` never returned panics (`Oh no! We
never placed the Core back`);
- a DataFusion stream dropped mid-poll corrupts memory.

The panic becomes a second FATAL that skips the rest of the abort, so
buffer pins and locks are never released. Memory corruption kills the
backend and restarts the cluster.

## The fix

`leak_and_drop_unless_exiting` (@mdashti's approach) is pgrx's
`leak_and_drop_on_delete` with one check in its callback: once
`proc_exit

**File**: `docs/project/changelog/unreleased/6479.stability.mdx` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+header: stability
+---
+
+Terminating a backend while it runs a search (for example with `pg_terminate_backend`) no longer crashes the server, or leaves pinned buffers held until the server restarts and table locks that block `ALTER TABLE`, `DROP` and `VACUUM FULL`. The backend, and the workers of a cancelled parallel search, no longer log `Oh no! We never placed the Core back` or `invalid Once state`.
```

**File**: `pg_search/src/postgres/customscan/builders/custom_state.rs` (modified, +4/-2)
```diff
@@ -16,6 +16,7 @@
 // along with this program. If not, see <http://www.gnu.org/licenses/>.
 
 use crate::postgres::customscan::CustomScan;
+use crate::postgres::utils::PgMemoryContextsExt;
 use pgrx::{PgList, PgMemoryContexts, pg_sys};
 use std::fmt::{Debug, Formatter};
 use std::ptr::addr_of_mut;
@@ -113,7 +114,7 @@ impl<CS: CustomScan, P: From<*mut pg_sys::List>> CustomScanStateBuilder<CS, P> {
 
     pub fn build(self) -> *mut CustomScanStateWrapper<CS> {
         let flags = unsafe { (*self.args.cscan).flags };
-        PgMemoryContexts::CurrentMemoryContext.leak_and_drop_on_delete(CustomScanStateWrapper {
+        let wrapper = CustomScanStateWrapper {
             csstate: pg_sys::CustomScanState {
                 ss: pg_sys::ScanState {
                     ps: pg_sys::PlanState {
@@ -131,6 +132,7 @@ impl<CS: CustomScan, P: From<*mut pg_sys::List>> CustomScanStateBuilder<CS, P> {
             },
             custom_state: self.custom_state,
             runtime_context: std::ptr::null_mut(),
-        })
+        };
+        PgMemoryContexts::CurrentMemoryContext.leak_and_drop_unless_exiting(wrapper)
     }
 }
```

**File**: `pg_search/src/postgres/scan.rs` (modified, +2/-1)
```diff
@@ -22,6 +22,7 @@ use crate::index::reader::index::{MultiSegmentSearchResults, SearchIndexReader};
 use crate::postgres::index_only::IndexOnlyScanState;
 use crate::postgres::rel::PgSearchRelation;
 use crate::postgres::storage::metadata::MetaPage;
+use crate::postgres::utils::PgMemoryContextsExt;
 use crate::postgres::{ParallelScanState, ScanStrategy, parallel};
 use crate::query::SearchQueryInput;
 
@@ -252,7 +253,7 @@ pub extern "C-unwind" fn amrescan(
     };
 
     scan.opaque = PgMemoryContexts::CurrentMemoryContext
-        .leak_and_drop_on_delete(Some(scan_state))
+        .leak_and_drop_unless_exiting(Some(scan_state))
         .cast();
 }
 
```

**File**: `pg_search/src/postgres/utils.rs` (modified, +80/-2)
```diff
@@ -52,7 +52,7 @@ unsafe extern "C-unwind" {
     pub fn IsTransactionState() -> bool;
 }
 
-/// Implements Drop that skips cleanup during panic unwinding.
+/// Implements Drop that skips cleanup during panic unwinding or process exit.
 ///
 /// Because panics are used to propagate PostgreSQL errors via pgrx, it is almost never
 /// safe to interact with PostgreSQL APIs during Drop - doing so can cause a double-panic
@@ -61,6 +61,11 @@ unsafe extern "C-unwind" {
 /// PostgreSQL's transaction abort mechanism will clean up resources (buffers, relations, etc.)
 /// when the transaction is aborted due to the error.
 ///
+/// Cleanup is also skipped once `proc_exit` has started: a FATAL doesn't unwind, so `panicking()`
+/// can't see it, and the abort that `proc_exit` runs releases those resources too. Skipping the body
+/// doesn't stop Rust dropping the fields afterwards; values whose fields a FATAL can leave mid-use
+/// are handled where they are leaked, see `PgMemoryContextsExt::leak_and_drop_unless_exiting`.
+///
 /// # Example
 /// ```ignore
 /// impl_safe_drop!(MyStruct, |self| {
@@ -76,7 +81,7 @@ macro_rules! impl_safe_drop {
     ($ty:ty, |$self:ident| $body:block) => {
         impl Drop for $ty {
             fn drop(&mut $self) {
-                if std::thread::panicking() {
+                if std::thread::panicking() || $crate::postgres::utils::proc_exit_in_progress() {
                     return;
                 }
                 $body
@@ -85,6 +90,79 @@ macro_rules! impl_safe_drop {
     };
 }
 
+/// Adds `leak_and_drop_unless_exiting` to pgrx's `PgMemoryContexts`.
+pub(crate) trait PgMemoryContextsExt {
+    /// pgrx's `leak_and_drop_on_delete`, except the drop is skipped once `proc_exit` has started.
+    ///
+    /// For the scan states that go with a query's memory: each custom scan's
+    /// (`CustomScanStateWrapper`) and the index AM's (`IndexScanDesc::opaque`). A FATAL can stop
+    /// any call into them, and a `Drop` on the state can't cover that: it skips only its own body, and
+    /// Rust still drops the fields:
+    ///
+    /// 1. A FATAL (e.g. from `pg_terminate_backend`) is raised at a `CHECK_FOR_INTERRUPTS()`, which
+    ///    can be deep inside a Rust call. Postgres calls `proc_exit` right there instead of
+    ///    unwinding, so that call never returns and `panicking()` is false.
+    /// 2. `proc_exit` aborts the transaction, which frees the query's memory. The callback on that
+    ///    memory drops the scan state, including values the interrupted call was still using.
+    /// 3. A value left mid-use panics when dropped: std's `OnceLock` while `get_or_init` is
+    ///    running (the readers hold many, in `FFHelper`, `LinkedBytesList`, `DeferredScorer` and
+    ///    tantivy's `SegmentReader`), tokio's `Runtime` while `block_on` holds its core, and the
+    ///    columnar scan's DataFusion stream mid-poll, which frees memory it doesn't own. A Rust
+    ///    panic can't pass through the C callback, so pgrx raises it as a Postgres ERROR.
+    /// 4. Postgres turns an ERROR raised during `proc_exit` into a FATAL, which calls `proc_exit`
+    ///    again. That nested exit skips the rest of the first abort, so the process exits still
+    ///    holding its buffer pins and locks.
+    ///
+    /// Skipping the drop lets the abort finish and release them. Nothing is lost: the abort also
+    /// releases the snapshots and temp files the state holds, and the `Box` goes with the process.
+    /// After a plain ERROR the drop still runs, since the backend keeps going and the state would
+    /// otherwise leak.
+    ///
+    /// TODO(#6530): we don't know which of the values inside the state need `impl_safe_drop!`, so
+    /// the whole state is skipped. Revisit this skip once #6530 has found and marked them.
+    ///
+    /// The body mirrors pgrx 0.19.2's `leak_and_drop_on_delete` (`memcxt.rs`) plus the
+    /// `proc_exit` check; keep it in sync when bumping pgrx.
+    fn leak_and_d
```

**File**: `tests/tests/basescan_cancel.rs` (added, +305/-0)
```diff
@@ -0,0 +1,305 @@
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
+//! A die (`pg_terminate_backend`, or the SIGTERM a parallel query's leader sends its workers on
+//! cancel) acted on in the middle of a Rust call runs exit cleanup without unwinding, so that
+//! cleanup must not drop scan state the call is still using: a tokio runtime inside `block_on`, a
+//! scorer still being built. Dropping it panics into a second FATAL, and an assert-enabled server
+//! aborts and resets the cluster. This test signals running scans from another connection and
+//! checks that a witness connection open throughout survives.
+
+use anyhow::Result;
+use rstest::*;
+use sqlx::{AssertSqlSafe, Executor, PgConnection};
+use std::time::{Duration, Instant};
+use tests::fixtures::*;
+use tokio::time::sleep;
+
+// Many small segments and selective queries, so a signal usually lands mid-scan.
+const SEGMENTS: usize = 100;
+
+const SETUP_SQL: &str = r#"
+CREATE EXTENSION IF NOT EXISTS pg_search CASCADE;
+CREATE TABLE bs_cancel (id bigserial primary key, body text, grp int, extra int);
+CREATE INDEX bs_cancel_idx ON bs_cancel USING paradedb (id, body, grp);
+-- A heap-filter predicate that checks for interrupts itself, like any function calling pg_sleep.
+CREATE FUNCTION bs_cancel_sleepy(x int) RETURNS bool LANGUAGE plpgsql IMMUTABLE AS
+$$ BEGIN PERFORM pg_sleep(0); RETURN x = -1; END $$;
+"#;
+
+const INSERT_SEGMENT: &str = r#"
+INSERT INTO bs_cancel (body, grp, extra)
+SELECT md5(random()::text) || ' ' || md5(random()::text), g % 10, g
+FROM generate_series(1, 2000) AS g
+"#;
+
+const PARALLEL_GUCS: &str = r#"
+SET max_parallel_workers_per_gather TO 2;
+SET max_parallel_workers TO 8;
+SET parallel_setup_cost TO 0;
+SET parallel_tuple_cost TO 0;
+SET paradedb.min_rows_per_worker TO 0;
+"#;
+
+// Plans the serial cases as NormalScan (Aggregate Scan off), which runs no tokio runtime.
+const SERIAL_GUCS: &str = r#"
+SET max_parallel_workers_per_gather TO 0;
+SET paradedb.enable_aggregate_custom_scan TO off;
+"#;
+
+struct Case {
+    name: &'static str,
+    gucs: &'static str,
+    query: &'static str,
+    /// Every line must appear in the query's EXPLAIN, so the case runs the scan it's meant to.
+    plan_contains: &'static [&'static str],
+}
+
+// Each query matches nothing, so every segment is walked: md5 bodies are hex, and `extra` is
+// never negative. `extra` is not indexed, so it is evaluated per doc as a heap filter. In the last
+// case the heap filter's own `pg_sleep` acts on the die while the scorer is still being built.
+static CASES: [Case; 4] = [
+    Case {
+        name: "regex",
+        gucs: PARALLEL_GUCS,
+        query: "SELECT grp FROM bs_cancel WHERE id @@@ paradedb.regex('body', '.*q.*z.*') AND grp = 1",
+        plan_contains: &[
+            "Parallel Custom Scan (ParadeDB Base Scan)",
+            "ColumnarExecState",
+            "regex",
+        ],
+    },
+    Case {
+        name: "heapfilter",
+        gucs: PARALLEL_GUCS,
+        query: "SELECT grp FROM bs_cancel WHERE id @@@ paradedb.all() AND extra = -1",
+        plan_contains: &[
+            "Parallel Custom Scan (ParadeDB Base Scan)",
+            "ColumnarExecState",
+            "heap_filter",
+        ],
+    },
+    Ca
```

---

### Incident Patch 5: `d696e1f2` (2026-09-29)
**Commit Message**: fix: preserve PostgreSQL errors during temp-file cleanup (#6473)

## What

Preserve PostgreSQL errors when a `PgTempFile` write fails, instead of
aborting the backend during cleanup.

## Why

Exceeding `temp_file_limit` unwinds through `PgTempFile::drop`.
`BufFileClose` flushes the failed write again, raising a second error
during unwinding and terminating the backend with SIGABRT.

## How

Reuse `BufFileReleaseGuard` and `create_temp_buffile`, as the existing
spill-file code does. PostgreSQL handles cleanup when Rust is unwinding
or the resource owner has already released the file.

## Tests

Added a regression test that writes two buffers with `temp_file_limit =
'1kB'` and expects the original PostgreSQL error. On unmodified main,
this reproduces SIGABRT and a closed client connection. The fixed
PostgreSQL 18 release run passes (1 passed, 0 failed), returning the
expected error without aborting the backend. Formatting and diff checks
also pass.

**File**: `pg_search/src/index/directory/mvcc.rs` (modified, +19/-4)
```diff
@@ -19,6 +19,7 @@ use super::utils::{load_metas, save_new_metas, save_schema, save_settings};
 use crate::api::{HashMap, HashSet};
 use crate::index::reader::segment_component::SegmentComponentReader;
 use crate::index::writer::segment_component::SegmentComponentWriter;
+use crate::postgres::buffile::{BufFileReleaseGuard, create_temp_buffile};
 use crate::postgres::heap::{ExpressionState, HeapFetchState};
 use crate::postgres::rel::PgSearchRelation;
 use crate::postgres::storage::MAX_BUFFERS_TO_EXTEND_BY;
@@ -64,13 +65,17 @@ pub const BUFWRITER_CAPACITY: usize = bm25_max_free_space() * MAX_BUFFERS_TO_EXT
 /// immutable segment-component map.
 struct PgTempFile {
     file: *mut pg_sys::BufFile,
+    release_guard: Arc<BufFileReleaseGuard>,
 }
 
 impl PgTempFile {
     fn create() -> Self {
-        let file = unsafe { pg_sys::BufFileCreateTemp(false) };
-        assert!(!file.is_null(), "BufFileCreateTemp returned null");
-        Self { file }
+        let release_guard = BufFileReleaseGuard::register();
+        let file = unsafe { create_temp_buffile() };
+        Self {
+            file,
+            release_guard,
+        }
     }
 }
 
@@ -120,7 +125,9 @@ impl Seek for PgTempFile {
 
 impl Drop for PgTempFile {
     fn drop(&mut self) {
-        unsafe { pg_sys::BufFileClose(self.file) }
+        if self.release_guard.may_close() {
+            unsafe { pg_sys::BufFileClose(self.file) }
+        }
     }
 }
 
@@ -1136,6 +1143,14 @@ mod tests {
 
     use pgrx::prelude::*;
 
+    #[pg_test]
+    #[should_panic(expected = "temporary file size exceeds")]
+    fn test_temp_file_drop_preserves_write_error() {
+        Spi::run("SET LOCAL temp_file_limit = '1kB'").unwrap();
+        let mut file = PgTempFile::create();
+        file.write_all(&[0u8; pg_sys::BLCKSZ as usize * 2]).unwrap();
+    }
+
     #[pg_test]
     unsafe fn test_list_meta_entries() {
         Spi::run("CREATE TABLE t (id SERIAL, data TEXT);").unwrap();
```

---

### Incident Patch 6: `235d1b6b` (2026-09-27)
**Commit Message**: fix: Don't ask Postgres for a dropped buffer's block in block_tracker (#6491)

## What

`block_tracker` no longer asks Postgres for a buffer's block number when
the buffer is dropped, and no longer leaves an entry behind when a pin
or a cleanup-lock wait errors out.

## Why

With `block_tracker` on, catching an error from a search crashes the
server:

```sql
DO $$ BEGIN
  PERFORM id, 10 / (n - n) FROM t WHERE id @@@ paradedb.all();
EXCEPTION WHEN division_by_zero THEN NULL;
END $$;
```
```
TRAP: failed Assert("BufferIsPinned(buffer)"), File: "bufmgr.c"
```

A subtransaction abort releases its buffer pins before it frees the
executor state that holds our `Buffer`s, and their `Drop` then called
`BufferGetBlockNumber` on a buffer that is no longer pinned. The same
thing crashes `spilling_buffile_mpp`'s `spill_to_disk = off` case.

A cancelled `VACUUM` also left a stale entry: `get_buffer_for_cleanup`
tracks the block before `LockBufferForCleanup`, so cancelling that wait
and running `VACUUM` again in the same session failed with `blockno
Cleanup(N) already opened`.

Both bugs only affect builds with `block_tracker`. CI's integration
tests use it; `cargo pgrx regress` does not.

## How

**File**: `pg_search/src/postgres/storage/buffer.rs` (modified, +59/-14)
```diff
@@ -88,7 +88,9 @@ mod block_tracker {
     > = OnceLock::new();
 
     macro_rules! track {
-        ($style:ident, $blockno:expr) => {
+        // `{{ }}` makes the body a block: without it the tracker's lock guard would stay held
+        // until the end of the caller's scope.
+        ($style:ident, $blockno:expr) => {{
             use std::collections::hash_map::Entry;
 
             let blockno = block_tracker::TrackedBlock::$style($blockno);
@@ -155,15 +157,15 @@ mod block_tracker {
                     slot.insert(Some(std::backtrace::Backtrace::force_capture()));
                 }
             }
-        };
+        }};
     }
 
     macro_rules! forget {
-        ($blockno:expr) => {
+        ($blockno:expr) => {{
             let map = block_tracker::BLOCK_TRACKER.get_or_init(|| Default::default());
             let mut lock = map.lock();
             lock.remove(&block_tracker::TrackedBlock::Drop($blockno));
-        };
+        }};
     }
 
     pub(super) use forget;
@@ -190,6 +192,10 @@ mod block_tracker {
 #[derive(Debug)]
 pub struct Buffer {
     pub(super) pg_buffer: pg_sys::Buffer,
+    /// Read while the buffer is pinned, so `Drop` never asks Postgres for it: after an abort
+    /// releases the pin, `BufferGetBlockNumber` fails `Assert(BufferIsPinned)`.
+    #[cfg(feature = "block_tracker")]
+    blockno: pg_sys::BlockNumber,
 }
 
 // NOTE: We intentionally do NOT use `impl_safe_drop!` here because `block_tracker::forget!`
@@ -200,7 +206,7 @@ impl Drop for Buffer {
         unsafe {
             if self.pg_buffer != pg_sys::InvalidBuffer as pg_sys::Buffer {
                 // block_tracker bookkeeping must run unconditionally
-                block_tracker::forget!(pg_sys::BufferGetBlockNumber(self.pg_buffer));
+                block_tracker::forget!(self.blockno);
 
                 // Skip PostgreSQL cleanup during panic unwinding to prevent double-panics.
                 // InterruptHoldoffCount check is a PostgreSQL-level indicator of error handling.
@@ -233,7 +239,11 @@ impl Buffer {
             "buffer cannot be allocated outside of a transaction"
         );
         assert!(pg_buffer != pg_sys::InvalidBuffer as pg_sys::Buffer);
-        Self { pg_buffer }
+        Self {
+            pg_buffer,
+            #[cfg(feature = "block_tracker")]
+            blockno: unsafe { pg_sys::BufferGetBlockNumber(pg_buffer) },
+        }
     }
 
     pub fn page(&self) -> Page<'_> {
@@ -254,7 +264,7 @@ impl Buffer {
         pg_sys::LockBuffer(self.pg_buffer, pg_sys::BUFFER_LOCK_UNLOCK as _);
         let pg_buffer =
             std::mem::replace(&mut self.pg_buffer, pg_sys::InvalidBuffer as pg_sys::Buffer);
-        block_tracker::forget!(pg_sys::BufferGetBlockNumber(pg_buffer));
+        block_tracker::forget!(self.blockno);
         ImmutablePage {
             pinned_buffer: PinnedBuffer::new(pg_buffer),
         }
@@ -386,6 +396,8 @@ impl BufferMut {
             &mut self.inner,
             Buffer {
                 pg_buffer: pg_sys::InvalidBuffer as pg_sys::Buffer,
+                #[cfg(feature = "block_tracker")]
+                blockno: pg_sys::InvalidBlockNumber,
             },
         );
         unsafe { inner.into_immutable_page() }
@@ -427,6 +439,9 @@ impl BufferMut {
 #[derive(Debug)]
 pub struct PinnedBuffer {
     pg_buffer: pg_sys::Buffer,
+    /// See [`Buffer`]'s field of the same name.
+    #[cfg(feature = "block_tracker")]
+    blockno: pg_sys::BlockNumber,
 }
 
 // NOTE: We intentionally do NOT use `impl_safe_drop!` here because `block_tracker::forget!`
@@ -436,7 +451,7 @@ impl Drop for PinnedBuffer {
     fn drop(&mut self) {
         unsafe {
             // block_tracker bookkeeping must run unconditionally
-            block_tracker::forget!(pg_sys::BufferGetBlockNumber(self.pg_buffer));
+            block_tracker::forget!(self.blockno);
 
             // Skip PostgreSQL cleanup during panic unwinding to prevent double-panics
             if crate::postgres::utils::IsTran
```

**File**: `tests/tests/aborted_xact.rs` (modified, +73/-1)
```diff
@@ -16,7 +16,7 @@
 // along with this program. If not, see <http://www.gnu.org/licenses/>.
 
 use rstest::*;
-use sqlx::PgConnection;
+use sqlx::{Executor, PgConnection};
 use tests::fixtures::*;
 
 #[rstest]
@@ -60,3 +60,75 @@ fn aborted_segments_not_visible(mut conn: PgConnection) {
         .fetch_one::<(i64,)>(&mut conn);
     assert_eq!(count, 1);
 }
+
+#[rstest]
+fn search_error_caught_in_subtransaction(mut conn: PgConnection) {
+    r#"
+        DROP TABLE IF EXISTS subxact_table;
+        CREATE TABLE subxact_table (id INT PRIMARY KEY, body TEXT, n INT);
+        INSERT INTO subxact_table SELECT g, 'hello world', g % 7 FROM generate_series(1, 1000) g;
+        CREATE INDEX subxact_idx ON subxact_table USING paradedb (id, body, n);
+    "#
+    .execute(&mut conn);
+
+    // A subtransaction abort releases the scan's buffer pins before it frees the scan, so the
+    // scan's buffers are dropped after their pins are gone.
+    "BEGIN".execute(&mut conn);
+    r#"
+        DO $$
+        BEGIN
+            PERFORM id, 10 / (n - n) FROM subxact_table WHERE id @@@ paradedb.all();
+        EXCEPTION WHEN division_by_zero THEN NULL;
+        END $$
+    "#
+    .execute(&mut conn);
+
+    let (count,) = "SELECT count(*) FROM subxact_table WHERE id @@@ paradedb.all()"
+        .fetch_one::<(i64,)>(&mut conn);
+    assert_eq!(count, 1000);
+    "COMMIT".execute(&mut conn);
+}
+
+#[rstest]
+#[tokio::test]
+async fn cleanup_lock_wait_cancelled_then_retried(database: Db) -> anyhow::Result<()> {
+    let mut reader = database.connection().await;
+    let mut vacuum = database.connection().await;
+    reader
+        .execute(
+            r#"
+            CREATE EXTENSION IF NOT EXISTS pg_search CASCADE;
+            DROP TABLE IF EXISTS cleanup_wait;
+            CREATE TABLE cleanup_wait (id INT PRIMARY KEY, body TEXT);
+            INSERT INTO cleanup_wait SELECT g, 'hello world' FROM generate_series(1, 5000) g;
+            CREATE INDEX cleanup_wait_idx ON cleanup_wait USING paradedb (id, body);
+            DELETE FROM cleanup_wait WHERE id <= 100;
+            "#,
+        )
+        .await?;
+
+    // An open search pins the index's cleanup-lock page, so VACUUM's ambulkdelete waits in
+    // LockBufferForCleanup and the timeout cancels it there.
+    reader.execute("BEGIN").await?;
+    reader
+        .execute("DECLARE c CURSOR FOR SELECT id FROM cleanup_wait WHERE id @@@ paradedb.all()")
+        .await?;
+    reader.execute("FETCH 1 FROM c").await?;
+
+    vacuum.execute("SET statement_timeout = '1s'").await?;
+    let err = vacuum
+        .execute("VACUUM cleanup_wait")
+        .await
+        .expect_err("VACUUM should wait for the cleanup lock and time out");
+    let code = err.as_database_error().and_then(|e| e.code());
+    assert_eq!(code.as_deref(), Some("57014"), "{err}");
+
+    // The same backend takes the cleanup lock again once the search is gone.
+    reader.execute("COMMIT").await?;
+    vacuum.execute("RESET statement_timeout").await?;
+    vacuum
+        .execute("DELETE FROM cleanup_wait WHERE id <= 200")
+        .await?;
+    vacuum.execute("VACUUM cleanup_wait").await?;
+    Ok(())
+}
```

---

### Incident Patch 7: `11dee4de` (2026-09-27)
**Commit Message**: fix: record visibility stats when shortcuts are disabled (#6523)

## What

Record visibility statistics when
`paradedb.enable_visibility_map_shortcuts` is disabled. Treat disabled
shortcuts as a failed all-visible proof so execution still reaches
segment accounting and records the segment as requiring checks.

## Why

#6484 moved segment accounting into `is_segment_all_visible`, but its
disabled-shortcut early return bypassed that accounting. `EXPLAIN
ANALYZE` then reported zero checked segments, failing the existing
`visibility_explain` regression test in its dirty, visible, and mixed
phases.

Reproduced by CI in both
[upstream](https://github.com/paradedb/paradedb/actions/runs/36278139031)
and
[Enterprise](https://github.com/paradedb/paradedb-enterprise/actions/runs/36270298289/job/108487581963).

## Tests

The existing `visibility_explain` test already exercises shortcuts
enabled and disabled with serial and parallel execution, and checks
segment counts and required heap blocks. Its assertions and expected
output are unchanged.

`git diff --check` passes. Rust/pgrx is unavailable locally, so runtime
validation is pending GitHub CI.

**File**: `pg_search/src/postgres/heap.rs` (modified, +3/-5)
```diff
@@ -423,9 +423,6 @@ impl VisibilityChecker {
         &mut self,
         segment_ord: SegmentOrdinal,
     ) -> tantivy::Result<bool> {
-        if !enable_visibility_map_shortcuts() {
-            return Ok(false);
-        }
         if let Some(&visible) = self.segment_visibility.get(&segment_ord) {
             return Ok(visible);
         }
@@ -435,9 +432,10 @@ impl VisibilityChecker {
         let Some(segment) = ffhelper.immutable_segment_reader(segment_ord) else {
             return Ok(false);
         };
-        // prove segment is all visible
+        // Disabled shortcuts still record the segment as requiring visibility checks.
         let visible = 'proof: {
-            if self.snapshot.is_null()
+            if !enable_visibility_map_shortcuts()
+                || self.snapshot.is_null()
                 || unsafe { (*self.snapshot).snapshot_type != pg_sys::SnapshotType::SNAPSHOT_MVCC }
                 || segment.num_docs() == 0
             {
```

---

### Incident Patch 8: `8b299d3b` (2026-09-26)
**Commit Message**: chore: Fix merge collision between #6484 and #6508. (#6518)

**File**: `pg_search/src/aggregate/count_all_collector.rs` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ impl Collector for CountAllCollector {
         segment: &SegmentReader,
     ) -> tantivy::Result<<Self::Child as SegmentCollector>::Fruit> {
         pgrx::check_for_interrupts!();
-        if VisibilityChecker::for_segment(&self.checker, segment)?.is_none() {
+        if VisibilityChecker::for_segment_arc(&self.checker, ord)?.is_none() {
             let mut result = IntermediateAggregationResults::default();
             result.push(
                 "0".to_string(),
```

---

### Incident Patch 9: `c111c746` (2026-09-26)
**Commit Message**: fix: include composite actions in source archives (#6514)

## What

Keep `.github/actions` in source archives by narrowing `.github
export-ignore` to `.github/workflows export-ignore`.

## Why

The shared upstream rebase workflow downloads `setup-git-signing` from
this repository at a pinned commit. Excluding all of `.github` removes
the action from that archive, so Enterprise sync fails during job setup.
Workflows remain excluded from PGXN release archives.

## Tests

Verified with `git archive HEAD .github` that the signing action is
present and `.github/workflows` is absent. `git diff --check` passes.

**File**: `.gitattributes` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 .dockerignore export-ignore
 .gitignore export-ignore
 .gitattributes export-ignore
-.github export-ignore
+.github/workflows export-ignore
 .hadolint.yaml export-ignore
 .markdownlint.yaml export-ignore
 .pre-commit-config.yaml export-ignore
```

---

### Incident Patch 10: `b8a127d1` (2026-09-25)
**Commit Message**: fix: prevent workflow shell injection (#6500)

SOC 2

Release inputs, PR branch names, labels, and action outputs were
interpolated into shell scripts before execution. Pass these values
through environment variables and quote their shell expansions across
release, benchmark, upgrade-test, and supporting workflows. Read
benchmark-backfill inputs and issue commenters as JavaScript data
instead of interpolating them into source.

Validation: YAML parsing, Bash syntax, workflow-structure comparison,
and git diff --check passed. Actionlint passed for the changed
workflows. Mocked-command regression checks confirmed hostile inputs
remain literal data. Prettier passed.

**File**: `.github/actions/benchmark-queries/action.yml` (modified, +7/-4)
```diff
@@ -129,11 +129,14 @@ runs:
       if: inputs.alert_strategy == 'paired-bootstrap'
       id: paired_bootstrap
       shell: bash
+      env:
+        INPUTS_DATASET: ${{ inputs.dataset }}
+        INPUTS_INDEX: ${{ inputs.index }}
       run: |
-        python3 "${{ github.action_path }}/compare_baseline.py" \
+        python3 "${GITHUB_ACTION_PATH}/compare_baseline.py" \
           --results benchmarks/results.json \
           --data-js benchmark-data-repository/benchmarks/data.js \
-          --suite "pg_search '${{ inputs.dataset }} (${{ inputs.index }})' (${{ env.ROWS_LABEL }} rows)" \
+          --suite "pg_search '${INPUTS_DATASET} (${INPUTS_INDEX})' (${{ env.ROWS_LABEL }} rows)" \
           --out benchmark-alert.md
 
     - name: Comment on Alert (Paired Bootstrap)
@@ -142,8 +145,8 @@ runs:
       env:
         GH_TOKEN: ${{ inputs.github_token }}
       run: |
-        printf '\ncc @%s\n' "${{ github.actor }}" >> benchmark-alert.md
-        gh api "repos/${{ github.repository }}/commits/${{ github.sha }}/comments" \
+        printf '\ncc @%s\n' "${GITHUB_ACTOR}" >> benchmark-alert.md
+        gh api "repos/${GITHUB_REPOSITORY}/commits/${GITHUB_SHA}/comments" \
           -F body=@benchmark-alert.md
 
     - name: Upload Benchmark Results to Slack (push only)
```

**File**: `.github/actions/benchmark-stressgres/action.yml` (modified, +12/-4)
```diff
@@ -65,17 +65,22 @@ runs:
       env:
         DURATION: ${{ inputs.duration }}
         TEST_FILE: ${{ inputs.test_file }}
+        STEP_SANITIZE_INPUTS_JOBNAME: ${{ steps.sanitize-inputs.outputs.jobname }}
+        STEP_RESOLVE_REF_SHA: ${{ steps.resolve_ref.outputs.sha }}
       run: |
         sudo chmod a+rwx /var/run/postgresql/
         stressgres headless \
           "stressgres/suites/${TEST_FILE}" \
-          --log-file stressgres-${{ steps.sanitize-inputs.outputs.jobname }}-${{ steps.resolve_ref.outputs.sha }}.log \
+          --log-file "stressgres-${STEP_SANITIZE_INPUTS_JOBNAME}-""${STEP_RESOLVE_REF_SHA}".log \
           --pgversion pg18 \
           --runtime "${DURATION}"
 
     - name: Generate CSV
       shell: bash
-      run: stressgres csv stressgres-${{ steps.sanitize-inputs.outputs.jobname }}-${{ steps.resolve_ref.outputs.sha }}.log output.csv
+      env:
+        STEP_SANITIZE_INPUTS_JOBNAME: ${{ steps.sanitize-inputs.outputs.jobname }}
+        STEP_RESOLVE_REF_SHA: ${{ steps.resolve_ref.outputs.sha }}
+      run: stressgres csv "stressgres-${STEP_SANITIZE_INPUTS_JOBNAME}-""${STEP_RESOLVE_REF_SHA}".log output.csv
 
       # This is where we can configure how the different runs are aggregated
       # into multiple JSON files for plotting in our continuous benchmarks.
@@ -120,7 +125,7 @@ runs:
         auth="Authorization: Basic $(printf 'x-access-token:%s' "$APP_TOKEN" | base64 -w0)"
         for attempt in $(seq 1 10); do
           if git -c http.extraheader="$auth" ls-remote \
-              "https://github.com/${{ github.repository }}.git" HEAD >/dev/null 2>&1; then
+              "https://github.com/${GITHUB_REPOSITORY}.git" HEAD >/dev/null 2>&1; then
             echo "App token usable after ${attempt} attempt(s)"
             exit 0
           fi
@@ -176,7 +181,10 @@ runs:
 
     - name: Create Stressgres Graph
       shell: bash
-      run: stressgres graph "stressgres-${{ steps.sanitize-inputs.outputs.jobname }}-${{ steps.resolve_ref.outputs.sha }}.log" "stressgres-${{ steps.sanitize-inputs.outputs.jobname }}-${{ steps.resolve_ref.outputs.sha }}.png"
+      env:
+        STEP_SANITIZE_INPUTS_JOBNAME: ${{ steps.sanitize-inputs.outputs.jobname }}
+        STEP_RESOLVE_REF_SHA: ${{ steps.resolve_ref.outputs.sha }}
+      run: stressgres graph "stressgres-${STEP_SANITIZE_INPUTS_JOBNAME}-${STEP_RESOLVE_REF_SHA}.log" "stressgres-${STEP_SANITIZE_INPUTS_JOBNAME}-${STEP_RESOLVE_REF_SHA}.png"
 
     - name: Upload Stressgres Results to Slack (push only)
       if: github.event_name != 'pull_request'
```

**File**: `.github/actions/setup-benchmark-cluster/action.yml` (modified, +48/-31)
```diff
@@ -37,66 +37,81 @@ runs:
 
     - name: Compile and Install pg_search
       shell: bash
+      env:
+        INPUTS_PG_VERSION: ${{ inputs.pg_version }}
       run: >-
         cargo pgrx install -p pg_search --sudo --release
-        --pg-config "/usr/lib/postgresql/${{ inputs.pg_version }}/bin/pg_config"
-        --features=pg${{ inputs.pg_version }} --no-default-features
+        --pg-config "/usr/lib/postgresql/${INPUTS_PG_VERSION}/bin/pg_config"
+        "--features=pg${INPUTS_PG_VERSION}" --no-default-features
 
     - name: Start PostgreSQL
       shell: bash
       working-directory: pg_search/
-      run: cargo pgrx start pg${{ inputs.pg_version }}
+      env:
+        INPUTS_PG_VERSION: ${{ inputs.pg_version }}
+      run: cargo pgrx start "pg${INPUTS_PG_VERSION}"
 
     - name: Configure PostgreSQL settings and machine settings
       shell: bash
       working-directory: /home/runner/.pgrx/data-${{ inputs.pg_version }}/
+      env:
+        INPUTS_PG_VERSION: ${{ inputs.pg_version }}
       run: |
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM RESET ALL;"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET shared_preload_libraries = pg_search,pg_stat_statements;"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET maintenance_work_mem = '12GB';"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET shared_buffers = '12GB';"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET max_parallel_workers = 8;"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET max_worker_processes = 8;"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET max_parallel_maintenance_workers = 8;"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET max_parallel_workers_per_gather = 8;"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET autovacuum = off;"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET max_wal_size = '100GB';"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET jit = off;"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET bgwriter_lru_maxpages = 0;"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET max_wal_senders = 0;"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET wal_level = minimal;"
-        psql postgresql://localhost:288${{ inputs.pg_version }}/postgres -c "ALTER SYSTEM SET huge_pages = on;"
+        psql "postgresql://localhost:288${INPUTS_PG_VERSION}/postgres" -c "ALTER SYSTEM RESET ALL;"
+        psql "postgresql://localhost:288${INPUTS_PG_VERSION}/postgres" -c "ALTER SYSTEM SET shared_preload_libraries = pg_search,pg_stat_statements;"
+        psql "postgresql://localhost:288${INPUTS_PG_VERSION}/postgres" -c "ALTER SYSTEM SET maintenance_work_mem = '12GB';"
+        psql "postgresql://localhost:288${INPUTS_PG_VERSION}/postgres" -c "ALTER SYSTEM SET shared_buffers = '12GB';"
+        psql "postgresql://localhost:288${INPUTS_PG_VERSION}/postgres" -c "ALTER SYSTEM SET max_parallel_workers = 8;"
+        psql "postgresql://localhost:288${INPUTS_PG_VERSION}/postgres" -c "ALTER SYSTEM SET max_worker_processes = 8;"
+        psql "postgresql://localhost:288${INPUTS_PG_VERSION}/postgres" -c "ALTER SYSTEM SET max_parallel_maintenance_workers = 8;"
+        psql "postgresql://localhost:288${INPUTS_PG_VERSION}/postgres" -c "ALTER SYSTEM SET max_parallel_workers_per_gather = 8;"
+        psql "postgresql://localhost:288${INPUTS_PG_VERSION}/postgres" -c "ALTER SYSTEM SET autovacuum = off;"
+        psql "postgresql://localhos
```

**File**: `.github/actions/setup-pg-search-build-environment/action.yml` (modified, +3/-1)
```diff
@@ -42,4 +42,6 @@ runs:
 
     - name: Initialize pgrx Environment
       shell: bash
-      run: cargo pgrx init "--pg${{ inputs.pg_version }}=/usr/lib/postgresql/${{ inputs.pg_version }}/bin/pg_config"
+      env:
+        INPUTS_PG_VERSION: ${{ inputs.pg_version }}
+      run: cargo pgrx init "--pg${INPUTS_PG_VERSION}=/usr/lib/postgresql/${INPUTS_PG_VERSION}/bin/pg_config"
```

**File**: `.github/actions/setup-pg-search-toolchain/action.yml` (modified, +3/-1)
```diff
@@ -74,8 +74,10 @@ runs:
     - name: Install cargo-pgrx ${{ steps.versions.outputs.pgrx }}
       if: inputs.install_cargo_pgrx == 'true'
       shell: bash
+      env:
+        STEP_VERSIONS_PGRX: ${{ steps.versions.outputs.pgrx }}
       run: |
-        version="${{ steps.versions.outputs.pgrx }}"
+        version="${STEP_VERSIONS_PGRX}"
         installed="$(cargo pgrx --version 2>/dev/null || true)"
         if [ "${installed}" = "cargo-pgrx ${version}" ]; then
           echo "cargo-pgrx ${version} restored from rust-cache"
```

#### Recent Merged Pull Requests:
- **PR #6570** (2026-09-30): ci: remove routine benchmark Slack notifications (@philippemnoel)
- **PR #6567** (2026-09-30): chore: Stabilize `Index Scan` vs `Index Only Scan` plans in stressgres (@stuhood)
- **PR #6564** (2026-09-30): chore: Run benchmarker on pushes to `main`. (@stuhood)
- **PR #6561** (2026-09-30): chore: Increase benchmarker memory limit (@stuhood)
- **PR #6558** (2026-09-30): docs: update customer case study URLs (@philippemnoel)
- **PR #6557** (closed): docs: Refine Cloud deployment and documentation navigation (@paradedb-github-bot[bot])
- **PR #6555** (2026-09-30): fix: keep the Join Scan's ORDER BY when LIMIT is a parameter (@IamYipi)
- **PR #6554** (2026-09-30): fix: don't hold the typmod caches across SPI (@IamYipi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
