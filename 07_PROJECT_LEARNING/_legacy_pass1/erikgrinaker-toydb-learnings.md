# Forensic Learning Record (Deep Inspection): erikgrinaker/toydb

> **Canonical Artifact**: `07_PROJECT_LEARNING/erikgrinaker-toydb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/erikgrinaker/toydb](https://github.com/erikgrinaker/toydb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:43:48.561Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `erikgrinaker/toydb`
- **Description**: Distributed SQL database in Rust, written as an educational project
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7286 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/bin/toydb.rs`
```
//! The toyDB server. Takes configuration from a config file (default
//! config/toydb.yaml) or corresponding TOYDB_ environment variables. Listens
//! for SQL clients (default port 9601) and Raft connections from other toyDB
//! peers (default port 9701). The Raft log and SQL database are stored at
//! data/raft and data/sql by default.
//!
//! Use the toysql command-line client to connect to the server.

#![warn(clippy::all)]

use std::collections::HashMap;
use std::path::Path;

use clap::Parser as _;
use serde::Deserialize;

use toydb::Server;
use toydb::errinput;
use toydb::error::Result;
use toydb::raft;
use toydb::sql;
use toydb::storage;

fn main() {
    if let Err(error) = Command::parse().run() {
        eprintln!("Error: {error}")
    }
}

/// The toyDB server configuration. Can be provided via config file (default
/// config/toydb.yaml) or TOYDB_ environment variables.
#[derive(Debug, Deserialize)]
struct Config {
    /// The node ID. Must be unique in the cluster.
    id: raft::NodeID,
    /// The other nodes in the cluster, and their Raft TCP addresses.
    peers: HashMap<raft::NodeID, String>,
    /// The Raft listen address.
    listen_raft: String,
    /// The SQL listen address.
    listen_sql: String,
    /// The log level.
    log_level: String,
    /// The path to this node's data directory. The Raft log is stored in
    /// the file "raft", and the SQL state machine in "sql".
    data_dir: String,
    /// The Raft storage engine: bitcask or memory.
    storage_raft: String,
    /// The SQL storage engine: bitcask or memory.
    storage_sql: String,
    /// If false, don't fsync Raft log writes to disk. Disabling this
    /// will yield much better write performance, but may lose data on
    /// host crashes which compromises Raft safety guarantees.
    fsync: bool,
    /// The garbage fraction threshold at which to trigger compaction.
    compact_threshold: f64,
    /// The minimum bytes of garbage before triggering compaction.
    compact_min_bytes: u64,
}

impl Config {
    /// Loads the configuration from the given file.
    fn load(file: &str) -> Result<Self> {
        Ok(config::Config::builder()
            .set_default("id", "1")?
            .set_default("listen_sql", "localhost:9601")?
            .set_default("listen_raft", "localhost:9701")?
            .set_default("log_level", "info")?
            .set_default("data_dir", "data")?
            .set_default("storage_raft", "bitcask")?
            .set_default("storage_sql", "bitcask")?
            .set_default("fsync", true)?
            .set_default("compact_threshold", 0.2)?
            .set_default("compact_min_bytes", 1_000_000)?
            .add_source(config::File::with_name(file))
            .add_source(config::Environment::with_prefix("TOYDB"))
            .build()?
            .try_deserialize()?)
    }
}

/// The toyDB server command.
#[derive(clap::Parser)]
#[command(about = "Starts a toyDB server.", version, propagate_version = true)]
struct Command {
    /// The configuration file path.
    #[arg(short = 'c', long, default_value = "config/toydb.yaml")]
    config: String,
}

impl Command {
    /// Runs the toyDB server.
    fn run(self) -> Result<()> {
        // Load the configuration.
        let cfg = Config::load(&self.config)?;

        // Initialize logging.
        let loglevel = cfg.log_level.parse()?;
        let mut logconfig = simplelog::ConfigBuilder::new();
        if loglevel != simplelog::LevelFilter::Debug {
            logconfig.add_filter_allow_str("toydb");
        }
        simplelog::SimpleLogger::init(loglevel, logconfig.build())?;

        // Initialize the Raft log storage engine.
        let datadir = Path::new(&cfg.data_dir);
        let mut raft_log = match cfg.storage_raft.as_str() {
            "bitcask" | "" => {
                let engine = storage::BitCask::new_maybe_compact(
                    datadir.join("raft"),
                    cfg.compact_threshold,
                    cfg.compact_min_bytes,
                )?;
                raft::Log::new(Box::new(engine))?
            }
            "memory" => raft::Log::new(Box::new(storage::Memory::new()))?,
            name => return errinput!("invalid Raft storage engine {name}"),
        };
        raft_log.enable_fsync(cfg.fsync);

        // Initialize the SQL storage engine.
        let raft_state: Box<dyn raft::State> = match cfg.storage_sql.as_str() {
            "bitcask" | "" => {
                let engine = storage::BitCask::new_maybe_compact(
                    datadir.join("sql"),
                    cfg.compact_threshold,
                    cfg.compact_min_bytes,
                )?;
                Box::new(sql::engine::Raft::new_state(engine)?)
            }
            "memory" => Box::new(sql::engine::Raft::new_state(storage::Memory::new())?),
            name => return errinput!("invalid SQL storage engine {name}"),
        };

        // Start the server.
        Server::new(cfg.id, cfg.peers, raft_log, raft_state)?
            .serve(&cfg.listen_raft, &cfg.listen_sql)
    }
}

```

### Core Architecture Module: `src/bin/toydump.rs`
```
//! toydump is a debug tool that prints a toyDB BitCask database in
//! human-readable form. It can print both the SQL database and the Raft log
//! (via --raft). It only outputs live BitCask data, not garbage entries.

#![warn(clippy::all)]

use clap::Parser as _;

use toydb::encoding::format::{self, Formatter as _};
use toydb::error::Result;
use toydb::storage::{BitCask, Engine as _};

fn main() {
    if let Err(error) = Command::parse().run() {
        eprintln!("Error: {error}")
    }
}

/// The toydump command.
#[derive(clap::Parser)]
#[command(about = "Prints toyDB file contents.", version, propagate_version = true)]
struct Command {
    /// The BitCask file to dump (SQL database unless --raft).
    file: String,
    /// The file is a Raft log, not SQL database.
    #[arg(long)]
    raft: bool,
    /// Also show raw key and value.
    #[arg(long)]
    raw: bool,
}

impl Command {
    /// Runs the command.
    fn run(self) -> Result<()> {
        let mut engine = BitCask::new(self.file.into())?;
        let mut scan = engine.scan(..);
        while let Some((key, value)) = scan.next().transpose()? {
            let mut string = match self.raft {
                true => format::Raft::<format::SQLCommand>::key_value(&key, &value),
                false => format::MVCC::<format::SQL>::key_value(&key, &value),
            };
            if self.raw {
                string = format!("{string} [{}]", format::Raw::key_value(&key, &value))
            }
            println!("{string}");
        }
        Ok(())
    }
}

```

### Core Architecture Module: `src/bin/toysql.rs`
```
//! toySQL is a command-line client for toyDB. It connects to a toyDB node
//! (default localhost:9601) and executes SQL statements against it via an
//! interactive shell interface. Command history is stored in .toysql.history.

#![warn(clippy::all)]

use std::path::PathBuf;

use clap::Parser as _;
use itertools::Itertools as _;
use rustyline::error::ReadlineError;
use rustyline::history::DefaultHistory;
use rustyline::validate::{ValidationContext, ValidationResult, Validator};
use rustyline::{Editor, Modifiers};
use rustyline_derive::{Completer, Helper, Highlighter, Hinter};

use toydb::Client;
use toydb::errinput;
use toydb::error::Result;
use toydb::sql::execution::StatementResult;
use toydb::sql::parser::{Lexer, Token};

fn main() {
    if let Err(error) = Command::parse().run() {
        eprintln!("Error: {error}");
    }
}

/// The toySQL command.
#[derive(clap::Parser)]
#[command(about = "A toyDB client.", version, propagate_version = true)]
struct Command {
    /// A SQL statement to execute, then exit.
    #[arg()]
    statement: Option<String>,
    /// Host to connect to.
    #[arg(short = 'H', long, default_value = "localhost")]
    host: String,
    /// Port number to connect to.
    #[arg(short = 'p', long, default_value = "9601")]
    port: u16,
}

impl Command {
    /// Runs the command.
    fn run(self) -> Result<()> {
        let mut shell = Shell::new(&self.host, self.port)?;
        match self.statement {
            Some(statement) => shell.execute(&statement),
            None => shell.run(),
        }
    }
}

/// An interactive toySQL shell.
struct Shell {
    /// The toyDB client.
    client: Client,
    /// The Rustyline command editor.
    editor: Editor<InputValidator, DefaultHistory>,
    /// The path to the history file, if any.
    history_path: Option<PathBuf>,
    /// If true, SELECT column headers will be displayed.
    show_headers: bool,
}

impl Shell {
    /// Creates a new shell connected to the given server.
    fn new(host: &str, port: u16) -> Result<Self> {
        let client = Client::connect((host, port))?;
        // Set up Rustyline. Make sure multiline pastes are handled normally.
        let mut editor = Editor::new()?;
        editor.set_helper(Some(InputValidator));
        editor.bind_sequence(
            rustyline::KeyEvent(rustyline::KeyCode::BracketedPasteStart, Modifiers::NONE),
            rustyline::Cmd::Noop,
        );
        let history_path =
            std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".toysql.history"));
        Ok(Self { client, editor, history_path, show_headers: false })
    }

    /// Executes a SQL statement or ! command.
    fn execute(&mut self, input: &str) -> Result<()> {
        if input.starts_with('!') {
            self.execute_command(input)
        } else if !input.is_empty() {
            self.execute_sql(input)
        } else {
            Ok(())
        }
    }

    /// Executes a toySQL ! command (e.g. !help)
    fn execute_command(&mut self, input: &str) -> Result<()> {
        let mut input = input.split_ascii_whitespace();
        let Some(command) = input.next() else {
            return errinput!("expected command");
        };
        let args = input.collect_vec();

        match (command, args.as_slice()) {
            // Toggles column headers.
            ("!headers", []) => {
                self.show_headers = !self.show_headers;
                match self.show_headers {
                    true => println!("Headers enabled"),
                    false => println!("Headers disabled"),
                }
            }
            ("!headers", _) => return errinput!("!headers takes no arguments"),

            // Displays help.
            ("!help", []) => println!(
                r#"
Enter a SQL statement terminated by a semicolon (;) to execute it, or Ctrl-D to
exit. The following commands are also available:

    !headers           Toggles column headers
    !help              This help message
    !status            Display server status
    !table NAME        Display a table schema
    !tables            List tables
"#
            ),
            ("!help", _) => return errinput!("!help takes no arguments"),

            // Displays server status.
            ("!status", []) => {
                let status = self.client.status()?;
                println!(
                    r#"
Server:       n{server} with Raft leader n{leader} in term {term} for {nodes} nodes
Raft log:     {committed} committed, {applied} applied, {raft_size} MB, {raft_garbage}% garbage ({raft_storage} engine)
Replication:  {raft_match}
SQL storage:  {sql_keys} keys, {sql_size} MB logical, {nodes}x {sql_disk_size} MB disk, {sql_garbage}% garbage ({sql_storage} engine)
Transactions: {active_txns} active, {versions} total
"#,
                    server = status.server,
                    leader = status.raft.leader,
                    term = status.raft.term,
                    nodes = status.raft.match_index.len(),
                    committed = status.raft.commit_index,
                    applied = status.raft.applied_index,
                    raft_size =
                        format_args!("{:.3}", status.raft.storage.size as f64 / 1_000_000.0),
                    raft_garbage =
                        format_args!("{:.0}", status.raft.storage.garbage_disk_percent()),
                    raft_storage = status.raft.storage.name,
                    raft_match =
                        status.raft.match_index.iter().map(|(n, m)| format!("n{n}:{m}")).join(" "),
                    sql_keys = status.mvcc.storage.keys,
                    sql_size = format_args!("{:.3}", status.mvcc.storage.size as f64 / 1_000_000.0),
                    sql_disk_size =
                        format_args!("{:.3}", status.mvcc.storage.disk_size as f64 / 1_000_000.0),
                    sql_garbage = format_args!("{:.0}", status.mvcc.storage.garbage_disk_percent()),
                    sql_storage = status.mvcc.storage.name,
                    active_txns = status.mvcc.active_txns,
                    versions = status.mvcc.versions,
                )
            }
            ("!status", _) => return errinput!("!status takes no arguments"),

            ("!table", [name]) => println!("{}", self.client.get_table(name)?),
            ("!table", _) => return errinput!("!table takes 1 argument"),

            ("!tables", []) => self.client.list_tables()?.iter().for_each(|t| println!("{t}")),
            ("!tables", _) => return errinput!("!tables takes no arguments"),

            (command, _) => return errinput!("unknown command {command}"),
        }
        Ok(())
    }

    /// Executes a SQL statement and displays the results.
    fn execute_sql(&mut self, statement: &str) -> Result<()> {
        use StatementResult::*;
        match self.client.execute(statement)? {
            Begin(state) => match state.read_only {
                true => println!("Began read-only transaction at version {}", state.version),
                false => println!("Began transaction {}", state.version),
            },
            Commit { version } => println!("Committed transaction {version}"),
            Rollback { version } => println!("Rolled back transaction {version}"),
            Insert { count } => println!("Inserted {count} rows"),
            Delete { count } => println!("Deleted {count} rows"),
            Update { count } => println!("Updated {count} rows"),
            CreateTable { name } => println!("Created table {name}"),
            DropTable { name, existed } => match existed {
                true => println!("Dropped table {name}"),
                false => println!("Table {name} does not exist"),
            },
            Explain(plan) => println!("{plan}"),
            Select { columns, rows } => {
                if self.show_headers {
                    println!("{}", columns.iter().map(|c| c.as_header()).join(", "));
                }
                for ro
```

### Core Architecture Module: `src/bin/workload.rs`
```
//! Runs toyDB workload benchmarks. By default, it assumes a running 5-node
//! cluster as launched via cluster/run.sh, but this can be modified via -H.
//! For example, a read-only workload can be run as:
//!
//! cargo run --release --bin workload -- read
//!
//! See --help for a list of available workloads and arguments.

#![warn(clippy::all)]

use std::cmp::min;
use std::collections::HashSet;
use std::io::Write as _;
use std::time::{Duration, Instant};

use clap::Parser;
use hdrhistogram::Histogram;
use itertools::Itertools as _;
use rand::SeedableRng as _;
use rand::distr::Distribution as _;
use rand::rngs::StdRng;
use rand::seq::IndexedRandom as _;

use toydb::error::Result;
use toydb::sql::types::{Row, Rows};
use toydb::{Client, StatementResult};

fn main() {
    let Command { runner, subcommand } = Command::parse();
    let result = match subcommand {
        Subcommand::Read(read) => runner.run(read),
        Subcommand::Write(write) => runner.run(write),
        Subcommand::Bank(bank) => runner.run(bank),
    };
    if let Err(error) = result {
        eprintln!("Error: {error}")
    }
}

/// Handles command-line parsing.
#[derive(clap::Parser)]
#[command(about = "Runs toyDB workload benchmarks.", version, propagate_version = true)]
struct Command {
    #[command(flatten)]
    runner: Runner,

    #[command(subcommand)]
    subcommand: Subcommand,
}

#[derive(clap::Subcommand)]
enum Subcommand {
    Read(Read),
    Write(Write),
    Bank(Bank),
}

/// Runs a workload benchmark.
#[derive(clap::Args)]
struct Runner {
    /// Hosts to connect to (optionally with port number).
    #[arg(
        short = 'H',
        long,
        value_delimiter = ',',
        default_value = "localhost:9601,localhost:9602,localhost:9603,localhost:9604,localhost:9605"
    )]
    hosts: Vec<String>,

    /// Number of concurrent workers to spawn.
    #[arg(short, long, default_value = "16")]
    concurrency: usize,

    /// Number of transactions to execute.
    #[arg(short = 'n', long, default_value = "100000")]
    count: usize,

    /// Seed to use for random number generation.
    #[arg(short, long, default_value = "16791084677885396490")]
    seed: u64,
}

impl Runner {
    /// Runs the specified workload.
    fn run<W: Workload>(self, workload: W) -> Result<()> {
        let mut rng = StdRng::seed_from_u64(self.seed);
        let mut client = Client::connect(&self.hosts[0])?;

        // Set up a histogram recording txn latencies as nanoseconds. The
        // buckets range from 0.001s to 10s.
        let mut hist = Histogram::<u32>::new_with_bounds(1_000, 10_000_000_000, 3)?.into_sync();

        // Prepare the dataset.
        print!("Preparing initial dataset... ");
        std::io::stdout().flush()?;
        let start = Instant::now();
        workload.prepare(&mut client, &mut rng)?;
        println!("done ({:.3}s)", start.elapsed().as_secs_f64());

        // Spawn workers, round robin across hosts.
        std::thread::scope(|s| -> Result<()> {
            print!("Spawning {} workers... ", self.concurrency);
            std::io::stdout().flush()?;
            let start = Instant::now();

            let (work_tx, work_rx) = crossbeam::channel::bounded(self.concurrency);
            let (done_tx, done_rx) = crossbeam::channel::bounded::<()>(0);

            for addr in self.hosts.iter().cycle().take(self.concurrency) {
                let mut client = Client::connect(addr)?;
                let mut recorder = hist.recorder();
                let work_rx = work_rx.clone();
                let done_tx = done_tx.clone();
                s.spawn(move || -> Result<()> {
                    while let Ok(item) = work_rx.recv() {
                        let start = Instant::now();
                        client.with_retry(|client| W::execute(client, &item))?;
                        recorder.record(start.elapsed().as_nanos() as u64)?;
                    }
                    drop(done_tx); // disconnects done_rx once all workers exit
                    Ok(())
                });
            }
            drop(done_tx); // drop local copy

            println!("done ({:.3}s)", start.elapsed().as_secs_f64());

            // Spawn work generator.
            {
                println!("Running workload {}...", workload);
                let generator = workload.generate(rng)?.take(self.count);
                s.spawn(move || -> Result<()> {
                    for item in generator {
                        work_tx.send(item)?;
                    }
                    Ok(())
                });
            }

            // Periodically print stats until all workers are done.
            let start = Instant::now();
            let ticker = crossbeam::channel::tick(Duration::from_secs(1));

            println!();
            println!("Time   Progress     Txns      Rate       p50       p90       p99      pMax");

            while let Err(crossbeam::channel::TryRecvError::Empty) = done_rx.try_recv() {
                crossbeam::select! {
                    recv(ticker) -> _ => {},
                    recv(done_rx) -> _ => {},
                }

                let duration = start.elapsed().as_secs_f64();
                hist.refresh_timeout(Duration::from_secs(1));

                println!(
                    "{:<8} {:>5.1}%  {:>7}  {:>6.0}/s  {:>6.1}ms  {:>6.1}ms  {:>6.1}ms  {:>6.1}ms",
                    format!("{:.1}s", duration),
                    hist.len() as f64 / self.count as f64 * 100.0,
                    hist.len(),
                    hist.len() as f64 / duration,
                    Duration::from_nanos(hist.value_at_quantile(0.5)).as_secs_f64() * 1000.0,
                    Duration::from_nanos(hist.value_at_quantile(0.9)).as_secs_f64() * 1000.0,
                    Duration::from_nanos(hist.value_at_quantile(0.99)).as_secs_f64() * 1000.0,
                    Duration::from_nanos(hist.max()).as_secs_f64() * 1000.0,
                );
            }
            Ok(())
        })?;

        // Verify the final dataset.
        println!();
        print!("Verifying dataset... ");
        std::io::stdout().flush()?;
        let start = Instant::now();
        workload.verify(&mut client, self.count)?;
        println!("done ({:.3}s)", start.elapsed().as_secs_f64());

        Ok(())
    }
}

/// A workload.
trait Workload: std::fmt::Display {
    /// A work item.
    type Item: Send;

    /// Prepares the workload by creating initial tables and data.
    fn prepare(&self, client: &mut Client, rng: &mut StdRng) -> Result<()>;

    /// Generates work items as an iterator.
    fn generate(&self, rng: StdRng) -> Result<impl Iterator<Item = Self::Item> + Send + 'static>;

    /// Executes a single work item. This will automatically be retried on
    /// certain errors, and must use a transaction where appropriate.
    fn execute(client: &mut Client, item: &Self::Item) -> Result<()>;

    /// Verifies the dataset after the workload has completed.
    fn verify(&self, _client: &mut Client, _txns: usize) -> Result<()> {
        Ok(())
    }
}

/// A read-only workload. Creates an id,value table and populates it with the
/// given row count and value size. Then runs batches of random primary key
/// lookups (SELECT * FROM read WHERE id = 1 OR id = 2 ...).
#[derive(clap::Args, Clone)]
#[command(about = "A read-only workload using primary key lookups")]
struct Read {
    /// Total number of rows in data set.
    #[arg(short, long, default_value = "1000")]
    rows: u64,

    /// Row value size (excluding primary key).
    #[arg(short, long, default_value = "64")]
    size: usize,

    /// Number of rows to fetch in a single select.
    #[arg(short, long, default_value = "1")]
    batch: usize,
}

impl std::fmt::Display for Read {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "read (rows={} size={} batch={})", self.rows, self.size, self.batch)
    }
}

impl Workload for Read {
    type Item = HashSet<u64>;

```

### Core Architecture Module: `src/client.rs`
```
use std::io::{BufReader, BufWriter, Write as _};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use rand::RngExt as _;

use crate::encoding::Value as _;
use crate::errdata;
use crate::error::{Error, Result};
use crate::server::{Request, Response, Status};
use crate::sql::execution::StatementResult;
use crate::sql::types::Table;
use crate::storage::mvcc;

/// A toyDB client. Connects to a server via TCP and submits SQL statements and
/// other requests.
pub struct Client {
    /// Inbound response stream.
    reader: BufReader<TcpStream>,
    /// Outbound request stream.
    writer: BufWriter<TcpStream>,
    /// The current transaction, if any.
    txn: Option<mvcc::TransactionState>,
}

impl Client {
    /// Connects to a toyDB server, creating a new client.
    pub fn connect(addr: impl ToSocketAddrs) -> Result<Self> {
        let socket = TcpStream::connect(addr)?;
        let reader = BufReader::new(socket.try_clone()?);
        let writer = BufWriter::new(socket);
        Ok(Self { reader, writer, txn: None })
    }

    /// Sends a request to the server, returning the response.
    fn request(&mut self, request: Request) -> Result<Response> {
        request.encode_into(&mut self.writer)?;
        self.writer.flush()?;
        Result::decode_from(&mut self.reader)?
    }

    /// Executes a SQL statement.
    pub fn execute(&mut self, statement: &str) -> Result<StatementResult> {
        let result = match self.request(Request::Execute(statement.to_string()))? {
            Response::Execute(result) => result,
            response => return errdata!("unexpected response {response:?}"),
        };
        // Update the transaction state.
        match &result {
            StatementResult::Begin(state) => self.txn = Some(state.clone()),
            StatementResult::Commit { .. } => self.txn = None,
            StatementResult::Rollback { .. } => self.txn = None,
            _ => {}
        }
        Ok(result)
    }

    /// Fetches a table schema.
    pub fn get_table(&mut self, table: &str) -> Result<Table> {
        match self.request(Request::GetTable(table.to_string()))? {
            Response::GetTable(table) => Ok(table),
            response => errdata!("unexpected response: {response:?}"),
        }
    }

    /// Lists database tables.
    pub fn list_tables(&mut self) -> Result<Vec<String>> {
        match self.request(Request::ListTables)? {
            Response::ListTables(tables) => Ok(tables),
            response => errdata!("unexpected response: {response:?}"),
        }
    }

    /// Returns server status.
    pub fn status(&mut self) -> Result<Status> {
        match self.request(Request::Status)? {
            Response::Status(status) => Ok(status),
            response => errdata!("unexpected response: {response:?}"),
        }
    }

    /// Returns the transaction state.
    pub fn txn(&self) -> Option<&mvcc::TransactionState> {
        self.txn.as_ref()
    }

    /// Runs the given closure, automatically retrying serialization and abort
    /// errors. If a transaction is open following an error, it is automatically
    /// rolled back. It is the caller's responsibility to use a transaction in
    /// the closure where appropriate (i.e. when it is not idempotent).
    pub fn with_retry<T>(&mut self, f: impl Fn(&mut Client) -> Result<T>) -> Result<T> {
        const MAX_RETRIES: u32 = 10;
        const MIN_WAIT: u64 = 10;
        const MAX_WAIT: u64 = 2_000;
        let mut retries: u32 = 0;
        loop {
            match f(self) {
                Ok(result) => return Ok(result),
                Err(Error::Serialization | Error::Abort) if retries < MAX_RETRIES => {
                    if self.txn().is_some() {
                        self.execute("ROLLBACK")?;
                    }
                    // Use exponential backoff starting at MIN_WAIT doubling up
                    // to MAX_WAIT, but randomize the wait time in this interval
                    // to reduce the chance of collisions.
                    let mut wait = MAX_WAIT.min(MIN_WAIT * 2_u64.pow(retries));
                    wait = rand::rng().random_range(MIN_WAIT..=wait);
                    std::thread::sleep(Duration::from_millis(wait));
                    retries += 1;
                }
                Err(error) => {
                    if self.txn().is_some() {
                        self.execute("ROLLBACK").ok(); // ignore rollback error
                    }
                    return Err(error);
                }
            }
        }
    }
}

```

### Core Architecture Module: `src/encoding/bincode.rs`
```
//! Bincode is used to encode values, both in key/value stores and the toyDB
//! network protocol. It is a Rust-specific encoding that depends on the
//! internal data structures being stable, but it's sufficient for toyDB. See:
//! <https://github.com/bincode-org/bincode>
//!
//! This module wraps the [`bincode`] crate and uses the standard config.

use std::io::{Read, Write};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

/// Use the standard Bincode configuration.
const CONFIG: bincode::config::Configuration = bincode::config::standard();

/// Serializes a value using Bincode.
pub fn serialize<T: Serialize>(value: &T) -> Vec<u8> {
    // Panic on failure, as this is a problem with the data structure.
    bincode::serde::encode_to_vec(value, CONFIG).expect("value must be serializable")
}

/// Deserializes a value using Bincode.
pub fn deserialize<'de, T: Deserialize<'de>>(bytes: &'de [u8]) -> Result<T> {
    Ok(bincode::serde::borrow_decode_from_slice(bytes, CONFIG)?.0)
}

/// Serializes a value to a writer using Bincode.
pub fn serialize_into<W: Write, T: Serialize>(mut writer: W, value: &T) -> Result<()> {
    bincode::serde::encode_into_std_write(value, &mut writer, CONFIG)?;
    Ok(())
}

/// Deserializes a value from a reader using Bincode.
pub fn deserialize_from<R: Read, T: DeserializeOwned>(mut reader: R) -> Result<T> {
    Ok(bincode::serde::decode_from_std_read(&mut reader, CONFIG)?)
}

/// Deserializes a value from a reader using Bincode, or returns None if the
/// reader is closed.
pub fn maybe_deserialize_from<R: Read, T: DeserializeOwned>(mut reader: R) -> Result<Option<T>> {
    match bincode::serde::decode_from_std_read(&mut reader, CONFIG) {
        Ok(t) => Ok(Some(t)),
        Err(bincode::error::DecodeError::Io { inner, .. })
            if inner.kind() == std::io::ErrorKind::UnexpectedEof
                || inner.kind() == std::io::ErrorKind::ConnectionReset =>
        {
            Ok(None)
        }
        Err(err) => Err(Error::from(err)),
    }
}

```

### Core Architecture Module: `src/encoding/format.rs`
```
//! Formats raw keys and values, recursively where necessary. Handles both both
//! Raft, MVCC, SQL, and raw binary data.

use std::collections::BTreeSet;
use std::marker::PhantomData;

use itertools::Itertools as _;
use regex::Regex;

use super::{Key as _, Value as _, bincode};
use crate::raft;
use crate::sql;
use crate::storage::mvcc;

/// Formats encoded keys and values.
pub trait Formatter {
    /// Formats a key.
    fn key(key: &[u8]) -> String;

    /// Formats a value. Also takes the key to determine the kind of value.
    fn value(key: &[u8], value: &[u8]) -> String;

    /// Formats a key/value pair.
    fn key_value(key: &[u8], value: &[u8]) -> String {
        Self::key_maybe_value(key, Some(value))
    }

    /// Formats a key/value pair, where the value may not exist.
    fn key_maybe_value(key: &[u8], value: Option<&[u8]>) -> String {
        let fmtkey = Self::key(key);
        let fmtvalue = value.map_or("None".to_string(), |v| Self::value(key, v));
        format!("{fmtkey} → {fmtvalue}")
    }
}

/// Formats raw byte slices without any decoding.
pub struct Raw;

impl Raw {
    /// Formats raw bytes as escaped ASCII strings.
    pub fn bytes(bytes: &[u8]) -> String {
        let escaped = bytes.iter().copied().flat_map(std::ascii::escape_default).collect_vec();
        format!("\"{}\"", String::from_utf8_lossy(&escaped))
    }
}

impl Formatter for Raw {
    fn key(key: &[u8]) -> String {
        Self::bytes(key)
    }

    fn value(_key: &[u8], value: &[u8]) -> String {
        Self::bytes(value)
    }
}

/// Formats Raft log entries. Dispatches to F to format each Raft command.
pub struct Raft<F: Formatter>(PhantomData<F>);

impl<F: Formatter> Raft<F> {
    /// Formats a Raft entry.
    pub fn entry(entry: &raft::Entry) -> String {
        let fmtcommand = entry.command.as_deref().map_or("None".to_string(), |c| F::value(&[], c));
        format!("{}@{} {fmtcommand}", entry.index, entry.term)
    }
}

impl<F: Formatter> Formatter for Raft<F> {
    fn key(key: &[u8]) -> String {
        let Ok(key) = raft::Key::decode(key) else {
            return Raw::key(key); // invalid key
        };
        format!("raft:{key:?}")
    }

    fn value(key: &[u8], value: &[u8]) -> String {
        let Ok(key) = raft::Key::decode(key) else {
            return Raw::value(key, value); // invalid key
        };
        match key {
            raft::Key::CommitIndex => {
                match bincode::deserialize::<(raft::Index, raft::Term)>(value) {
                    Ok((index, term)) => format!("{index}@{term}"),
                    Err(_) => Raw::bytes(value),
                }
            }
            raft::Key::TermVote => {
                match bincode::deserialize::<(raft::Term, Option<raft::NodeID>)>(value) {
                    Ok((term, vote)) => format!(
                        "term={term} vote={}",
                        vote.map_or("None".to_string(), |v| v.to_string()),
                    ),
                    Err(_) => Raw::bytes(value),
                }
            }
            raft::Key::Entry(_) => match bincode::deserialize::<raft::Entry>(value) {
                Ok(entry) => Self::entry(&entry),
                Err(_) => Raw::bytes(value),
            },
        }
    }
}

/// Formats MVCC keys/values. Dispatches to F to format the inner key/value.
pub struct MVCC<F: Formatter>(PhantomData<F>);

impl<F: Formatter> Formatter for MVCC<F> {
    fn key(key: &[u8]) -> String {
        let Ok(key) = mvcc::Key::decode(key) else {
            return Raw::key(key); // invalid key
        };
        match key {
            mvcc::Key::TxnWrite(version, innerkey) => {
                format!("mvcc:TxnWrite({version}, {})", F::key(&innerkey))
            }
            mvcc::Key::Version(innerkey, version) => {
                format!("mvcc:Version({}, {version})", F::key(&innerkey))
            }
            mvcc::Key::Unversioned(innerkey) => {
                format!("mvcc:Unversioned({})", F::key(&innerkey))
            }
            mvcc::Key::NextVersion | mvcc::Key::TxnActive(_) | mvcc::Key::TxnActiveSnapshot(_) => {
                format!("mvcc:{key:?}")
            }
        }
    }

    fn value(key: &[u8], value: &[u8]) -> String {
        let Ok(key) = mvcc::Key::decode(key) else {
            return Raw::bytes(value); // invalid key
        };
        match key {
            mvcc::Key::NextVersion => {
                let Ok(version) = bincode::deserialize::<mvcc::Version>(value) else {
                    return Raw::bytes(value);
                };
                version.to_string()
            }
            mvcc::Key::TxnActiveSnapshot(_) => {
                let Ok(active) = bincode::deserialize::<BTreeSet<u64>>(value) else {
                    return Raw::bytes(value);
                };
                format!("{{{}}}", active.iter().join(","))
            }
            mvcc::Key::TxnActive(_) | mvcc::Key::TxnWrite(_, _) => Raw::bytes(value),
            mvcc::Key::Version(userkey, _) => match bincode::deserialize(value) {
                Ok(Some(value)) => F::value(&userkey, value),
                Ok(None) => "None".to_string(),
                Err(_) => Raw::bytes(value),
            },
            mvcc::Key::Unversioned(userkey) => F::value(&userkey, value),
        }
    }
}

/// Formats SQL keys/values.
pub struct SQL;

impl SQL {
    /// Formats a list of SQL values.
    fn values(values: impl IntoIterator<Item = sql::types::Value>) -> String {
        values.into_iter().join(",")
    }

    /// Formats a table schema.
    fn schema(table: sql::types::Table) -> String {
        // Put it all on a single line.
        let re = Regex::new(r#"\n\s*"#).expect("invalid regex");
        re.replace_all(&table.to_string(), " ").into_owned()
    }
}

impl Formatter for SQL {
    fn key(key: &[u8]) -> String {
        // Special-case the Raft applied index key.
        if key == sql::engine::Raft::APPLIED_INDEX_KEY {
            return String::from_utf8_lossy(key).into_owned();
        }
        let Ok(key) = sql::engine::Key::decode(key) else {
            return Raw::key(key); // invalid key
        };
        match key {
            sql::engine::Key::Table(name) => format!("sql:Table({name})"),
            sql::engine::Key::Index(table, column, value) => {
                format!("sql:Index({table}.{column}, {value})")
            }
            sql::engine::Key::Row(table, id) => {
                format!("sql:Row({table}, {id})")
            }
        }
    }

    fn value(key: &[u8], value: &[u8]) -> String {
        // Special-case the applied_index key.
        if key == sql::engine::Raft::APPLIED_INDEX_KEY
            && let Ok(applied_index) = bincode::deserialize::<raft::Index>(value)
        {
            return applied_index.to_string();
        }

        let Ok(key) = sql::engine::Key::decode(key) else {
            return Raw::key(value);
        };
        match key {
            sql::engine::Key::Table(_) => {
                let Ok(table) = bincode::deserialize(value) else {
                    return Raw::bytes(value);
                };
                Self::schema(table)
            }
            sql::engine::Key::Row(_, _) => {
                let Ok(row) = bincode::deserialize::<sql::types::Row>(value) else {
                    return Raw::bytes(value);
                };
                Self::values(row)
            }
            sql::engine::Key::Index(_, _, _) => {
                let Ok(index) = bincode::deserialize::<BTreeSet<sql::types::Value>>(value) else {
                    return Raw::bytes(value);
                };
                Self::values(index)
            }
        }
    }
}

/// Formats SQL Raft write commands, from the Raft log.
pub struct SQLCommand;

impl Formatter for SQLCommand {
    fn key(_key: &[u8]) -> String {
        // There is no key, since these are wrapped in a Raft log entry.
        panic!("SQL commands don't have a key");
    }

    fn value(_key: &[u
```

### Core Architecture Module: `src/encoding/keycode.rs`
```
//! Keycode is a lexicographical order-preserving binary encoding for use with
//! keys in key/value stores. It is designed for simplicity, not efficiency
//! (i.e. it does not use varints or other compression methods).
//!
//! Ordering is important because it allows limited scans across specific parts
//! of the keyspace, e.g. scanning an individual table or using an index range
//! predicate like `WHERE id < 100`. It also avoids sorting in some cases where
//! the keys are already in the desired order, e.g. in the Raft log.
//!
//! The encoding is not self-describing: the caller must provide a concrete type
//! to decode into, and the binary key must conform to its structure.
//!
//! Keycode supports a subset of primitive data types, encoded as follows:
//!
//! * [`bool`]: `0x00` for `false`, `0x01` for `true`.
//! * [`u64`]: big-endian binary representation.
//! * [`i64`]: big-endian binary, sign bit flipped.
//! * [`f64`]: big-endian binary, sign bit flipped, all flipped if negative.
//! * [`Vec<u8>`]: `0x00` escaped as `0x00ff`, terminated with `0x0000`.
//! * [`String`]: like [`Vec<u8>`].
//! * Sequences: concatenation of contained elements, with no other structure.
//! * Enum: the variant's index as [`u8`], then the content sequence.
//! * [`crate::sql::types::Value`]: like any other enum.
//!
//! The canonical key representation is an enum. For example:
//!
//! ```
//! #[derive(Debug, Deserialize, Serialize)]
//! enum Key {
//!     Foo,
//!     Bar(String),
//!     Baz(bool, u64, #[serde(with = "serde_bytes")] Vec<u8>),
//! }
//! ```
//!
//! Unfortunately, byte strings such as `Vec<u8>` must be wrapped with
//! [`serde_bytes::ByteBuf`] or use the `#[serde(with="serde_bytes")]`
//! attribute. See <https://github.com/serde-rs/bytes>.

use std::ops::Bound;

use itertools::Either;
use serde::de::{
    Deserialize, DeserializeSeed, EnumAccess, IntoDeserializer as _, SeqAccess, VariantAccess,
    Visitor,
};
use serde::ser::{Impossible, Serialize, SerializeSeq, SerializeTuple, SerializeTupleVariant};

use crate::errdata;
use crate::error::{Error, Result};

/// Serializes a key to a binary Keycode representation.
///
/// In the common case, the encoded key is borrowed for a storage engine call
/// and then thrown away. We could avoid a bunch of allocations by taking a
/// reusable byte vector to encode into and return a reference to it, but we
/// keep it simple.
pub fn serialize<T: Serialize>(key: &T) -> Vec<u8> {
    let mut serializer = Serializer { output: Vec::new() };
    // Panic on failure, as this is a problem with the data structure.
    key.serialize(&mut serializer).expect("key must be serializable");
    serializer.output
}

/// Deserializes a key from a binary Keycode representation.
pub fn deserialize<'a, T: Deserialize<'a>>(input: &'a [u8]) -> Result<T> {
    let mut deserializer = Deserializer::from_bytes(input);
    let t = T::deserialize(&mut deserializer)?;
    if !deserializer.input.is_empty() {
        return errdata!(
            "unexpected trailing bytes {:x?} at end of key {input:x?}",
            deserializer.input,
        );
    }
    Ok(t)
}

/// Generates a key range for a key prefix, used e.g. for prefix scans.
///
/// The exclusive end bound is generated by adding 1 to the value of the last
/// byte. If the last byte(s) is 0xff (so adding 1 would overflow), we instead
/// find the latest non-0xff byte, increment that, and truncate the rest. If all
/// bytes are 0xff, we scan to the end of the range, since there can't be other
/// prefixes after it.
pub fn prefix_range(prefix: &[u8]) -> (Bound<Vec<u8>>, Bound<Vec<u8>>) {
    let start = Bound::Included(prefix.to_vec());
    let end = match prefix.iter().rposition(|&b| b != 0xff) {
        Some(i) => Bound::Excluded(
            prefix.iter().take(i).copied().chain(std::iter::once(prefix[i] + 1)).collect(),
        ),
        None => Bound::Unbounded,
    };
    (start, end)
}

/// Serializes keys as binary byte vectors.
struct Serializer {
    output: Vec<u8>,
}

impl serde::ser::Serializer for &mut Serializer {
    type Ok = ();
    type Error = Error;

    type SerializeSeq = Self;
    type SerializeTuple = Self;
    type SerializeTupleVariant = Self;
    type SerializeTupleStruct = Impossible<(), Error>;
    type SerializeMap = Impossible<(), Error>;
    type SerializeStruct = Impossible<(), Error>;
    type SerializeStructVariant = Impossible<(), Error>;

    /// bool simply uses 1 for true and 0 for false.
    fn serialize_bool(self, v: bool) -> Result<()> {
        self.output.push(if v { 1 } else { 0 });
        Ok(())
    }

    fn serialize_i8(self, _: i8) -> Result<()> {
        unimplemented!()
    }

    fn serialize_i16(self, _: i16) -> Result<()> {
        unimplemented!()
    }

    fn serialize_i32(self, _: i32) -> Result<()> {
        unimplemented!()
    }

    /// i64 uses the big-endian two's complement encoding, but flips the
    /// left-most sign bit such that negative numbers are ordered before
    /// positive numbers.
    ///
    /// The relative ordering of the remaining bits is already correct: -1, the
    /// largest negative integer, is encoded as 01111111...11111111, ordered
    /// after all other negative integers but before positive integers.
    fn serialize_i64(self, v: i64) -> Result<()> {
        let mut bytes = v.to_be_bytes();
        bytes[0] ^= 1 << 7; // flip sign bit
        self.output.extend(bytes);
        Ok(())
    }

    fn serialize_u8(self, _: u8) -> Result<()> {
        unimplemented!()
    }

    fn serialize_u16(self, _: u16) -> Result<()> {
        unimplemented!()
    }

    fn serialize_u32(self, _: u32) -> Result<()> {
        unimplemented!()
    }

    /// u64 simply uses the big-endian encoding.
    fn serialize_u64(self, v: u64) -> Result<()> {
        self.output.extend(v.to_be_bytes());
        Ok(())
    }

    fn serialize_f32(self, _: f32) -> Result<()> {
        unimplemented!()
    }

    /// f64 is encoded in big-endian IEEE 754 form, but it flips the sign bit to
    /// order positive numbers after negative numbers, and also flips all other
    /// bits for negative numbers to order them from smallest to largest. NaN is
    /// ordered at the end.
    fn serialize_f64(self, v: f64) -> Result<()> {
        let mut bytes = v.to_be_bytes();
        match v.is_sign_negative() {
            false => bytes[0] ^= 1 << 7, // positive, flip sign bit
            true => bytes.iter_mut().for_each(|b| *b = !*b), // negative, flip all bits
        }
        self.output.extend(bytes);
        Ok(())
    }

    fn serialize_char(self, _: char) -> Result<()> {
        unimplemented!()
    }

    // Strings are encoded like bytes.
    fn serialize_str(self, v: &str) -> Result<()> {
        self.serialize_bytes(v.as_bytes())
    }

    // Byte slices are terminated by 0x0000, escaping 0x00 as 0x00ff. This
    // ensures that we can detect the end, and that for two overlapping slices,
    // the shorter one orders before the longer one.
    //
    // We can't use e.g. length prefix encoding, since it doesn't sort correctly.
    fn serialize_bytes(self, v: &[u8]) -> Result<()> {
        let bytes = v
            .iter()
            .flat_map(|&byte| match byte {
                0x00 => Either::Left([0x00, 0xff].into_iter()),
                byte => Either::Right([byte].into_iter()),
            })
            .chain([0x00, 0x00]);
        self.output.extend(bytes);
        Ok(())
    }

    fn serialize_none(self) -> Result<()> {
        unimplemented!()
    }

    fn serialize_some<T: Serialize + ?Sized>(self, _: &T) -> Result<()> {
        unimplemented!()
    }

    fn serialize_unit(self) -> Result<()> {
        unimplemented!()
    }

    fn serialize_unit_struct(self, _: &'static str) -> Result<()> {
        unimplemented!()
    }

    /// Enum variants are serialized using their index, as a single byte.
    fn serialize_unit_variant(self, _: &'static str, index: u32, _: &'static str) -> Result<()> {
        
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #35** (2020-06-09): **Raft: wait for initial leader commit before processing queries**
  *Symptoms*: https://stackoverflow.com/questions/37207682/raft-some-questions-about-read-only-queries

- **Issue #27** (2020-04-30): **Client pool must revert any transactions on return**
  *Symptoms*: 

- **Issue #19** (2020-05-03): **Raft panic on call during startup**
  *Symptoms*: Submitting a call immediately after starting a cluster causes a panic:  ``` Error: Internal("Unexpected Raft mutate response MutateState { call_id: [250, 91, 73, 148, 245, 202, 77, 21, 184, 190, 68, 192, 45, 3, 88, 140], command: [129, 0, 129, 0, 192] }") ```  Seems like the node returns the message we submitted, or something. Probably only applies to candidates, since it works fine once the cluster settles.

- **Issue #16** (2020-04-11): **Errors should roll back automatic transactions**
  *Symptoms*: Errors in single-statement transactions currently leave the transaction open, giving serialization errors when other txns try to modify a record.

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

### Incident Patch 1: `1c7dcea9` (2026-01-13)
**Commit Message**: docs: fix typo in example

**File**: `docs/examples.md` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ To start a five-node cluster on the local machine (requires a working
 [Rust compiler](https://www.rust-lang.org/tools/install)), run:
 
 ```
-$ ./cluster/run.rs
+$ ./cluster/run.sh
 toydb2 19:06:28 [ INFO] Listening on 0.0.0.0:9602 (SQL) and 0.0.0.0:9702 (Raft)
 toydb2 19:06:28 [ERROR] Failed connecting to Raft peer 127.0.0.1:9705: Connection refused
 toydb5 19:06:28 [ INFO] Listening on 0.0.0.0:9605 (SQL) and 0.0.0.0:9705 (Raft)
```

---

### Incident Patch 2: `8f48b078` (2025-09-25)
**Commit Message**: fix(docs): update outdated Bincode specification link

**File**: `docs/architecture/encoding.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ encoding scheme for Rust. Bincode is convenient because it can easily encode any
 data type. But we could also have chosen e.g. [JSON](https://en.wikipedia.org/wiki/JSON),
 [Protobuf](https://protobuf.dev), [MessagePack](https://msgpack.org/), or any other encoding.
 
-We won't dwell on the actual binary format here, see the [Bincode specification](https://github.com/bincode-org/bincode/blob/trunk/docs/spec.md)
+We won't dwell on the actual binary format here, see the [Bincode specification](https://git.sr.ht/~stygianentity/bincode/tree/trunk/item/docs/spec.md)
 for details.
 
 To use a consistent configuration for all encoding and decoding, we provide helper functions in
```

---

### Incident Patch 3: `8f5dedd6` (2025-08-16)
**Commit Message**: cluster/run.sh: fix ctrl-c handling

**File**: `cluster/run.sh` (modified, +2/-2)
```diff
@@ -25,5 +25,5 @@ done
 
 # Wait for the background processes to exit. Kill all toyDB processes when the
 # script exits (e.g. via Ctrl-C).
-trap 'kill $(jobs -p)' EXIT
-wait < <(jobs -p)
\ No newline at end of file
+trap 'kill -TERM -- -$$ 2>/dev/null' INT TERM EXIT
+wait
\ No newline at end of file
```

---

### Incident Patch 4: `e18fe81a` (2025-06-01)
**Commit Message**: docs/crate: fix README typos

**File**: `docs/crate/README.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ features:
 
 * ACID transactions with MVCC-based snapshot isolation.
 
-* Pluggable storage engine with [BitCask][bitcask] and [in-memory][memory] backends.
+* Pluggable storage engine with BitCask and in-memory backends.
 
 * Iterator-based query engine with heuristic optimization and time-travel  support.
 
```

---

### Incident Patch 5: `6c2c1772` (2025-05-11)
**Commit Message**: README.md: fix parser link

**File**: `README.md` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ been taken where possible.
 [memory]: https://github.com/erikgrinaker/toydb/blob/main/src/storage/memory.rs
 [query]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/execution/executor.rs
 [optimizer]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/planner/optimizer.rs
-[sql]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/parser.rs
+[sql]: https://github.com/erikgrinaker/toydb/blob/main/src/sql/parser/parser.rs
 
 ## Documentation
 
```

---

### Incident Patch 6: `a73e24b7` (2025-02-09)
**Commit Message**: Revert "storage: rename test to `bank.txt` for GitHub links"

This reverts commit 2b593e79eeb125d148d8a80ec44ef815e52e742f.



---

### Incident Patch 7: `000fe3af` (2025-02-06)
**Commit Message**: storage: clean up `Memory` engine

**File**: `src/storage/memory.rs` (modified, +15/-25)
```diff
@@ -1,15 +1,14 @@
+use std::collections::btree_map::Range;
 use std::collections::BTreeMap;
 use std::ops::{Bound, RangeBounds};
 
 use super::{Engine, Status};
 use crate::error::Result;
 
-/// An in-memory key/value storage engine using the Rust standard library B-tree
-/// implementation. Data is not persisted.
+/// An in-memory key-value storage engine using the Rust standard library's
+/// B-tree implementation. Data is not persisted. Primarily for testing.
 #[derive(Default)]
-pub struct Memory {
-    data: BTreeMap<Vec<u8>, Vec<u8>>,
-}
+pub struct Memory(BTreeMap<Vec<u8>, Vec<u8>>);
 
 impl Memory {
     /// Creates a new Memory key-value storage engine.
@@ -21,21 +20,21 @@ impl Memory {
 impl Engine for Memory {
     type ScanIterator<'a> = ScanIterator<'a>;
 
-    fn flush(&mut self) -> Result<()> {
+    fn delete(&mut self, key: &[u8]) -> Result<()> {
+        self.0.remove(key);
         Ok(())
     }
 
-    fn delete(&mut self, key: &[u8]) -> Result<()> {
-        self.data.remove(key);
+    fn flush(&mut self) -> Result<()> {
         Ok(())
     }
 
     fn get(&mut self, key: &[u8]) -> Result<Option<Vec<u8>>> {
-        Ok(self.data.get(key).cloned())
+        Ok(self.0.get(key).cloned())
     }
 
     fn scan(&mut self, range: impl RangeBounds<Vec<u8>>) -> Self::ScanIterator<'_> {
-        ScanIterator { inner: self.data.range(range) }
+        ScanIterator(self.0.range(range))
     }
 
     fn scan_dyn(
@@ -46,43 +45,34 @@ impl Engine for Memory {
     }
 
     fn set(&mut self, key: &[u8], value: Vec<u8>) -> Result<()> {
-        self.data.insert(key.to_vec(), value);
+        self.0.insert(key.to_vec(), value);
         Ok(())
     }
 
     fn status(&mut self) -> Result<Status> {
         Ok(Status {
             name: "memory".to_string(),
-            keys: self.data.len() as u64,
-            size: self.data.iter().fold(0, |size, (k, v)| size + k.len() as u64 + v.len() as u64),
+            keys: self.0.len() as u64,
+            size: self.0.iter().map(|(k, v)| (k.len() + v.len()) as u64).sum(),
             disk_size: 0,
             live_disk_size: 0,
         })
     }
 }
 
-pub struct ScanIterator<'a> {
-    inner: std::collections::btree_map::Range<'a, Vec<u8>, Vec<u8>>,
-}
-
-impl ScanIterator<'_> {
-    fn map(item: (&Vec<u8>, &Vec<u8>)) -> <Self as Iterator>::Item {
-        let (key, value) = item;
-        Ok((key.clone(), value.clone()))
-    }
-}
+pub struct ScanIterator<'a>(Range<'a, Vec<u8>, Vec<u8>>);
 
 impl Iterator for ScanIterator<'_> {
     type Item = Result<(Vec<u8>, Vec<u8>)>;
 
     fn next(&mut self) -> Option<Self::Item> {
-        self.inner.next().map(Self::map)
+        self.0.next().map(|(k, v)| Ok((k.clone(), v.clone())))
     }
 }
 
 impl DoubleEndedIterator for ScanIterator<'_> {
     fn next_back(&mut self) -> Option<Self::Item> {
-        self.inner.next_back().map(Self::map)
+        self.0.next_back().map(|(k, v)| Ok((k.clone(), v.clone())))
     }
 }
 
```

---

### Incident Patch 8: `d7587631` (2024-07-21)
**Commit Message**: encoding: move `prefix_range` into `keycode` module

**File**: `src/encoding/keycode.rs` (modified, +18/-1)
```diff
@@ -76,6 +76,24 @@ pub fn deserialize<'a, T: de::Deserialize<'a>>(input: &'a [u8]) -> Result<T> {
     Ok(t)
 }
 
+/// Generates a key range for a key prefix, used e.g. for prefix scans.
+///
+/// The exclusive end bound is generated by adding 1 to the value of the last
+/// byte. If the last byte(s) is 0xff (so adding 1 would overflow), we instead
+/// find the latest non-0xff byte, increment that, and truncate the rest. If all
+/// bytes are 0xff, we scan to the end of the range, since there can't be other
+/// prefixes after it.
+pub fn prefix_range(prefix: &[u8]) -> (std::ops::Bound<Vec<u8>>, std::ops::Bound<Vec<u8>>) {
+    let start = std::ops::Bound::Included(prefix.to_vec());
+    let end = match prefix.iter().rposition(|b| *b != 0xff) {
+        Some(i) => std::ops::Bound::Excluded(
+            prefix.iter().take(i).copied().chain(std::iter::once(prefix[i] + 1)).collect(),
+        ),
+        None => std::ops::Bound::Unbounded,
+    };
+    (start, end)
+}
+
 /// Serializes keys as binary byte vectors.
 struct Serializer {
     output: Vec<u8>,
@@ -585,7 +603,6 @@ impl<'de> de::VariantAccess<'de> for &mut Deserializer<'de> {
 mod tests {
     use super::*;
     use crate::sql::types::Value;
-    use hex;
     use paste::paste;
     use serde::{Deserialize, Serialize};
     use serde_bytes::ByteBuf;
```

**File**: `src/encoding/mod.rs` (modified, +0/-18)
```diff
@@ -61,24 +61,6 @@ pub trait Value: Serialize + DeserializeOwned {
     }
 }
 
-/// Generates a key range for a key prefix, used e.g. for prefix scans.
-///
-/// The exclusive end bound is generated by adding 1 to the value of the last
-/// byte. If the last byte(s) is 0xff (so adding 1 would overflow), we instead
-/// find the latest non-0xff byte, increment that, and truncate the rest. If all
-/// bytes are 0xff, we scan to the end of the range, since there can't be other
-/// prefixes after it.
-pub fn prefix_range(prefix: &[u8]) -> (std::ops::Bound<Vec<u8>>, std::ops::Bound<Vec<u8>>) {
-    let start = std::ops::Bound::Included(prefix.to_vec());
-    let end = match prefix.iter().rposition(|b| *b != 0xff) {
-        Some(i) => std::ops::Bound::Excluded(
-            prefix.iter().take(i).copied().chain(std::iter::once(prefix[i] + 1)).collect(),
-        ),
-        None => std::ops::Bound::Unbounded,
-    };
-    (start, end)
-}
-
 /// Blanket implementations for various types wrapping a value type.
 impl<V: Value> Value for Option<V> {}
 impl<V: Value> Value for Result<V> {}
```

**File**: `src/storage/engine.rs` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-use crate::encoding;
+use crate::encoding::keycode;
 use crate::error::Result;
 
 use serde::{Deserialize, Serialize};
@@ -42,7 +42,7 @@ pub trait Engine: Send {
     where
         Self: Sized, // omit in trait objects, for object safety
     {
-        self.scan(encoding::prefix_range(prefix))
+        self.scan(keycode::prefix_range(prefix))
     }
 
     /// Sets a value for a key, replacing the existing value if any.
```

**File**: `src/storage/mvcc.rs` (modified, +2/-2)
```diff
@@ -140,7 +140,7 @@
 //! travel queries (it's a feature, not a bug!).
 
 use super::engine::{self, Engine};
-use crate::encoding::{self, bincode, Key as _, Value as _};
+use crate::encoding::{self, bincode, keycode, Key as _, Value as _};
 use crate::error::{Error, Result};
 use crate::{errdata, errinput};
 
@@ -598,7 +598,7 @@ impl<E: Engine> Transaction<E> {
         // the KeyCode byte slice terminator 0x0000 at the end.
         let mut prefix = KeyPrefix::Version(prefix.into()).encode();
         prefix.truncate(prefix.len() - 2);
-        let range = encoding::prefix_range(&prefix);
+        let range = keycode::prefix_range(&prefix);
         ScanIterator::new(self.engine.clone(), self.state().clone(), range)
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #76** (2025-09-25): fix(docs): update outdated Bincode specification link (@guuzaa)
- **PR #75** (2025-07-08): MVCC: using first() to get the range start (@Daniel-Xu)
- **PR #71** (2024-08-13): docs: tweak (@qujihan)
- **PR #68** (2024-05-03): Fix test comment for step_solicitvote_last_index_outdated. (@Light-City)
- **PR #66** (2024-04-08): fix anomaly_read_skew test (@Light-City)
- **PR #64** (closed): optimize planner inject hidden logic (@SGZW)
- **PR #62** (closed): Add Nix shell for development (@kosumic)
- **PR #59** (closed): test:to run clusters in docker (@chenas)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
