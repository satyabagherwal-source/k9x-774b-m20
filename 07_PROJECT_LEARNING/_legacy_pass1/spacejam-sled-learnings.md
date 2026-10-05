# Forensic Learning Record (Deep Inspection): spacejam/sled

> **Canonical Artifact**: `07_PROJECT_LEARNING/spacejam-sled-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/spacejam/sled](https://github.com/spacejam/sled))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:43:49.035Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `spacejam/sled`
- **Description**: the champagne of beta embedded databases
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9097 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/bench.rs`
```
use std::path::Path;
use std::sync::Barrier;
use std::thread::scope;
use std::time::{Duration, Instant};
use std::{fs, io};

use num_format::{Locale, ToFormattedString};

use sled::{Config, Db as SledDb};

type Db = SledDb<1024>;

const N_WRITES_PER_THREAD: u32 = 4 * 1024 * 1024;
const MAX_CONCURRENCY: u32 = 4;
const CONCURRENCY: &[usize] = &[/*1, 2, 4,*/ MAX_CONCURRENCY as _];
const BYTES_PER_ITEM: u32 = 8;

trait Databench: Clone + Send {
    type READ: AsRef<[u8]>;
    const NAME: &'static str;
    const PATH: &'static str;
    fn open() -> Self;
    fn remove_generic(&self, key: &[u8]);
    fn insert_generic(&self, key: &[u8], value: &[u8]);
    fn get_generic(&self, key: &[u8]) -> Option<Self::READ>;
    fn flush_generic(&self);
    fn print_stats(&self);
}

impl Databench for Db {
    type READ = sled::InlineArray;

    const NAME: &'static str = "sled 1.0.0-alpha";
    const PATH: &'static str = "timing_test.sled-new";

    fn open() -> Self {
        sled::Config {
            path: Self::PATH.into(),
            zstd_compression_level: 3,
            cache_capacity_bytes: 1024 * 1024 * 1024,
            entry_cache_percent: 20,
            flush_every_ms: Some(200),
            ..Config::default()
        }
        .open()
        .unwrap()
    }

    fn insert_generic(&self, key: &[u8], value: &[u8]) {
        self.insert(key, value).unwrap();
    }
    fn remove_generic(&self, key: &[u8]) {
        self.remove(key).unwrap();
    }
    fn get_generic(&self, key: &[u8]) -> Option<Self::READ> {
        self.get(key).unwrap()
    }
    fn flush_generic(&self) {
        self.flush().unwrap();
    }
    fn print_stats(&self) {
        dbg!(self.stats());
    }
}

/*
impl Databench for old_sled::Db {
    type READ = old_sled::IVec;

    const NAME: &'static str = "sled 0.34.7";
    const PATH: &'static str = "timing_test.sled-old";

    fn open() -> Self {
        old_sled::open(Self::PATH).unwrap()
    }
    fn insert_generic(&self, key: &[u8], value: &[u8]) {
        self.insert(key, value).unwrap();
    }
    fn get_generic(&self, key: &[u8]) -> Option<Self::READ> {
        self.get(key).unwrap()
    }
    fn flush_generic(&self) {
        self.flush().unwrap();
    }
}
*/

/*
impl Databench for Arc<rocksdb::DB> {
    type READ = Vec<u8>;

    const NAME: &'static str = "rocksdb 0.21.0";
    const PATH: &'static str = "timing_test.rocksdb";

    fn open() -> Self {
        Arc::new(rocksdb::DB::open_default(Self::PATH).unwrap())
    }
    fn insert_generic(&self, key: &[u8], value: &[u8]) {
        self.put(key, value).unwrap();
    }
    fn get_generic(&self, key: &[u8]) -> Option<Self::READ> {
        self.get(key).unwrap()
    }
    fn flush_generic(&self) {
        self.flush().unwrap();
    }
}
*/

/*
struct Lmdb {
    env: heed::Env,
    db: heed::Database<
        heed::types::UnalignedSlice<u8>,
        heed::types::UnalignedSlice<u8>,
    >,
}

impl Clone for Lmdb {
    fn clone(&self) -> Lmdb {
        Lmdb { env: self.env.clone(), db: self.db.clone() }
    }
}

impl Databench for Lmdb {
    type READ = Vec<u8>;

    const NAME: &'static str = "lmdb";
    const PATH: &'static str = "timing_test.lmdb";

    fn open() -> Self {
        let _ = std::fs::create_dir_all(Self::PATH);
        let env = heed::EnvOpenOptions::new()
            .map_size(1024 * 1024 * 1024)
            .open(Self::PATH)
            .unwrap();
        let db = env.create_database(None).unwrap();
        Lmdb { env, db }
    }
    fn insert_generic(&self, key: &[u8], value: &[u8]) {
        let mut wtxn = self.env.write_txn().unwrap();
        self.db.put(&mut wtxn, key, value).unwrap();
        wtxn.commit().unwrap();
    }
    fn get_generic(&self, key: &[u8]) -> Option<Self::READ> {
        let rtxn = self.env.read_txn().unwrap();
        let ret = self.db.get(&rtxn, key).unwrap().map(Vec::from);
        rtxn.commit().unwrap();
        ret
    }
    fn flush_generic(&self) {
        // NOOP
    }
}
*/

/*
struct Sqlite {
    connection: rusqlite::Connection,
}

impl Clone for Sqlite {
    fn clone(&self) -> Sqlite {
        Sqlite { connection: rusqlite::Connection::open(Self::PATH).unwrap() }
    }
}

impl Databench for Sqlite {
    type READ = Vec<u8>;

    const NAME: &'static str = "sqlite";
    const PATH: &'static str = "timing_test.sqlite";

    fn open() -> Self {
        let connection = rusqlite::Connection::open(Self::PATH).unwrap();
        connection
            .execute(
                "create table if not exists bench (
                     key integer primary key,
                     val integer not null
                 )",
                [],
            )
            .unwrap();
        Sqlite { connection }
    }
    fn insert_generic(&self, key: &[u8], value: &[u8]) {
        loop {
            let res = self.connection.execute(
                "insert or ignore into bench (key, val) values (?1, ?2)",
                [
                    format!("{}", u32::from_be_bytes(key.try_into().unwrap())),
                    format!(
                        "{}",
                        u32::from_be_bytes(value.try_into().unwrap())
                    ),
                ],
            );
            if res.is_ok() {
                break;
            }
        }
    }
    fn get_generic(&self, key: &[u8]) -> Option<Self::READ> {
        let mut stmt = self
            .connection
            .prepare("SELECT b.val from bench b WHERE key = ?1")
            .unwrap();
        let mut rows =
            stmt.query([u32::from_be_bytes(key.try_into().unwrap())]).unwrap();

        let value = rows.next().unwrap()?;
        value.get(0).ok()
    }
    fn flush_generic(&self) {
        // NOOP
    }
}
*/

fn allocated() -> usize {
    #[cfg(feature = "testing-count-allocator")]
    {
        return sled::alloc::allocated();
    }
    0
}

fn freed() -> usize {
    #[cfg(feature = "testing-count-allocator")]
    {
        return sled::alloc::freed();
    }
    0
}

fn resident() -> usize {
    #[cfg(feature = "testing-count-allocator")]
    {
        return sled::alloc::resident();
    }
    0
}

fn inserts<D: Databench>(store: &D) -> Vec<InsertStats> {
    println!("{} inserts", D::NAME);
    let mut i = 0_u32;

    let factory = move || {
        i += 1;
        (store.clone(), i - 1)
    };

    let f = |state: (D, u32)| {
        let (store, offset) = state;
        let start = N_WRITES_PER_THREAD * offset;
        let end = N_WRITES_PER_THREAD * (offset + 1);
        for i in start..end {
            let k: &[u8] = &i.to_be_bytes();
            store.insert_generic(k, k);
        }
    };

    let mut ret = vec![];

    for concurrency in CONCURRENCY {
        let insert_elapsed =
            execute_lockstep_concurrent(factory, f, *concurrency);

        let flush_timer = Instant::now();
        store.flush_generic();

        let wps = (N_WRITES_PER_THREAD * *concurrency as u32) as u64
            * 1_000_000_u64
            / u64::try_from(insert_elapsed.as_micros().max(1))
                .unwrap_or(u64::MAX);

        ret.push(InsertStats {
            thread_count: *concurrency,
            inserts_per_second: wps,
        });

        println!(
            "{} inserts/s with {concurrency} threads over {:?}, then {:?} to flush {}",
            wps.to_formatted_string(&Locale::en),
            insert_elapsed,
            flush_timer.elapsed(),
            D::NAME,
        );
    }

    ret
}

fn removes<D: Databench>(store: &D) -> Vec<RemoveStats> {
    println!("{} removals", D::NAME);
    let mut i = 0_u32;

    let factory = move || {
        i += 1;
        (store.clone(), i - 1)
    };

    let f = |state: (D, u32)| {
        let (store, offset) = state;
        let start = N_WRITES_PER_THREAD * offset;
        let end = N_WRITES_PER_THREAD * (offset + 1);
        for i in start..end {
            let k: &[u8] = &i.to_be_bytes();
            store.remove_generic(k);
        }
    };

    let mut ret = vec![];

    for concurrency in CON
```

### Core Architecture Module: `examples/bench_large.rs`
```
use std::alloc::{GlobalAlloc, Layout, System};
use std::fs;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Barrier, Mutex};
use std::thread;
use std::time::Instant;

use hdrhistogram::Histogram;

use sled::{Config, Db};

// --- Peak-memory tracking allocator ---

// Total bytes ever allocated — reported in baseline output alongside MAX_RESIDENT
static ALLOCATED: AtomicU64 = AtomicU64::new(0);
static RESIDENT: AtomicU64 = AtomicU64::new(0);
static MAX_RESIDENT: AtomicU64 = AtomicU64::new(0);

struct BenchAllocator;

unsafe impl GlobalAlloc for BenchAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let ptr = unsafe { System.alloc(layout) };
        if !ptr.is_null() {
            let size = layout.size() as u64;
            ALLOCATED.fetch_add(size, Ordering::Relaxed);
            let new_resident =
                RESIDENT.fetch_add(size, Ordering::Relaxed) + size;
            MAX_RESIDENT.fetch_max(new_resident, Ordering::Relaxed);
        }
        ptr
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        RESIDENT.fetch_sub(layout.size() as u64, Ordering::Relaxed);
        unsafe { System.dealloc(ptr, layout) }
    }
}

#[global_allocator]
static GLOBAL: BenchAllocator = BenchAllocator;

// --- Database helpers ---

const DB_PATH: &str = "profile.bench_large.sled";
const LEAF_FANOUT: usize = 3;
const N_KEYS: u64 = 10_000_000;
const N_THREADS: usize = 2;
const KEYS_PER_THREAD: u64 = N_KEYS / N_THREADS as u64;

type BenchDb = Db<LEAF_FANOUT>;

fn open_db() -> BenchDb {
    Config {
        path: DB_PATH.into(),
        cache_capacity_bytes: 512 * 1024 * 1024,
        flush_every_ms: Some(200),
        ..Config::default()
    }
    .open()
    .unwrap()
}

fn new_histogram() -> Histogram<u64> {
    // Tracks insert latency in microseconds (1us to 60s, 3 significant figures).
    // Latencies above 60,000,000us (60s) saturate silently at the max bucket.
    Histogram::<u64>::new_with_bounds(1, 60_000_000, 3).unwrap()
}

fn git_hash() -> String {
    std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".into())
}

fn os_info() -> String {
    std::process::Command::new("uname")
        .arg("-a")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".into())
}

fn cpu_info() -> String {
    // macOS
    let mac = std::process::Command::new("sysctl")
        .args(["-n", "machdep.cpu.brand_string"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    if let Some(info) = mac {
        return info;
    }

    // Linux
    std::fs::read_to_string("/proc/cpuinfo")
        .unwrap_or_default()
        .lines()
        .find(|l| l.starts_with("model name"))
        .map(|l| l.splitn(2, ':').nth(1).unwrap_or("").trim().to_string())
        .unwrap_or_else(|| "unknown".into())
}

fn write_baseline(
    write_duration: std::time::Duration,
    throughput: f64,
    hist: &Histogram<u64>,
    flush_duration: std::time::Duration,
    recovery_duration: std::time::Duration,
    max_resident_bytes: u64,
    total_allocated_bytes: u64,
) {
    use std::fmt::Write as FmtWrite;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let mut out = String::new();
    writeln!(out, "=== sled bench_large baseline ===").unwrap();
    writeln!(out, "Date (unix): {}", now).unwrap();
    writeln!(out, "Git: {}", git_hash()).unwrap();
    writeln!(out, "OS: {}", os_info()).unwrap();
    writeln!(out, "CPU: {}", cpu_info()).unwrap();
    writeln!(out).unwrap();
    writeln!(out, "Parameters:").unwrap();
    writeln!(out, "  LEAF_FANOUT:  {}", LEAF_FANOUT).unwrap();
    writeln!(out, "  N_KEYS:       {}", N_KEYS).unwrap();
    writeln!(out, "  N_THREADS:    {}", N_THREADS).unwrap();
    writeln!(out, "  Note: LEAF_FANOUT={} is a stress-test configuration (minimum allowed).", LEAF_FANOUT).unwrap();
    writeln!(out, "        Default is 1024. Lower values increase index overhead and memory pressure.").unwrap();
    writeln!(out).unwrap();
    writeln!(out, "Write throughput:").unwrap();
    writeln!(out, "  Duration:     {:.2?}", write_duration).unwrap();
    writeln!(out, "  Throughput:   {:.0} keys/sec", throughput).unwrap();
    writeln!(out).unwrap();
    writeln!(out, "Per-insert latency (microseconds):").unwrap();
    writeln!(out, "  p50:          {}", hist.value_at_quantile(0.50)).unwrap();
    writeln!(out, "  p95:          {}", hist.value_at_quantile(0.95)).unwrap();
    writeln!(out, "  p99:          {}", hist.value_at_quantile(0.99)).unwrap();
    writeln!(out, "  p99.9:        {}", hist.value_at_quantile(0.999)).unwrap();
    writeln!(out, "  max:          {}", hist.max()).unwrap();
    writeln!(out).unwrap();
    writeln!(out, "Flush:").unwrap();
    writeln!(out, "  Duration:     {:.2?}", flush_duration).unwrap();
    writeln!(out).unwrap();
    writeln!(out, "Recovery:").unwrap();
    writeln!(out, "  Duration:     {:.2?}", recovery_duration).unwrap();
    writeln!(out).unwrap();
    writeln!(out, "Memory (peak during write phase):").unwrap();
    writeln!(
        out,
        "  Peak resident: {} bytes ({:.1} MiB)",
        max_resident_bytes,
        max_resident_bytes as f64 / (1024.0 * 1024.0),
    )
    .unwrap();
    writeln!(
        out,
        "  Total allocated: {} bytes ({:.1} MiB)",
        total_allocated_bytes,
        total_allocated_bytes as f64 / (1024.0 * 1024.0),
    )
    .unwrap();

    std::fs::create_dir_all("benchmarks").unwrap();
    std::fs::write("benchmarks/baseline.txt", &out).unwrap();
    print!("{}", out);
    println!("Baseline written to benchmarks/baseline.txt");
}

fn main() {
    let _ = fs::remove_dir_all(DB_PATH);
    let db = open_db();

    let barrier = Arc::new(Barrier::new(N_THREADS + 1));
    let shared_hist = Arc::new(Mutex::new(new_histogram()));

    // Initialized with a placeholder Instant; overwritten inside thread::scope before use.
    // Uninit let bindings don't work here because the compiler can't prove initialization
    // through closure captures.
    let mut write_start = Instant::now();
    let mut write_end = Instant::now();

    thread::scope(|s| {
        let handles: Vec<_> = (0..N_THREADS)
            .map(|thread_id| {
                let db = db.clone();
                let barrier = Arc::clone(&barrier);
                let shared_hist = Arc::clone(&shared_hist);

                s.spawn(move || {
                    let start_key = thread_id as u64 * KEYS_PER_THREAD;
                    let end_key = start_key + KEYS_PER_THREAD;
                    let mut local_hist = new_histogram();

                    barrier.wait();

                    for key in start_key..end_key {
                        let key_bytes = key.to_le_bytes();
                        let value_bytes = [0u8; 8];

                        let t0 = Instant::now();
                        db.insert(key_bytes, value_bytes).unwrap();
                        let elapsed_us = t0.elapsed().as_micros() as u64;
                        local_hist.record(elapsed_us.max(1)).unwrap();
                    }

                    shared_hist.lock().unwrap().add(&local_hist).unwrap();
                })
            })
            .collect();

        write_start = Instant::now();
        barrier.wait(); // release all writer threads simultaneously

        for h in handles {
            h.join().expect("worker thread panicked");
        }
        write_end = Instant::now();
    });

    let write_duration = write_end.duration_since(write_start);
    let throughput = N_KEYS as f64 / write_dura
```

### Core Architecture Module: `fuzz/fuzz_targets/fuzz_model.rs`
```
#![no_main]
#[macro_use]
extern crate libfuzzer_sys;
extern crate arbitrary;
extern crate sled;

use arbitrary::Arbitrary;

use sled::{Config, Db as SledDb, InlineArray};

type Db = SledDb<3>;

const KEYSPACE: u64 = 128;

#[derive(Debug)]
enum Op {
    Get { key: InlineArray },
    Insert { key: InlineArray, value: InlineArray },
    Reboot,
    Remove { key: InlineArray },
    Cas { key: InlineArray, old: Option<InlineArray>, new: Option<InlineArray> },
    Range { start: InlineArray, end: InlineArray },
}

fn keygen(
    u: &mut arbitrary::Unstructured<'_>,
) -> arbitrary::Result<InlineArray> {
    let key_i: u64 = u.int_in_range(0..=KEYSPACE)?;
    Ok(key_i.to_be_bytes().as_ref().into())
}

impl<'a> Arbitrary<'a> for Op {
    fn arbitrary(
        u: &mut arbitrary::Unstructured<'a>,
    ) -> arbitrary::Result<Self> {
        Ok(if u.ratio(1, 2)? {
            Op::Insert { key: keygen(u)?, value: keygen(u)? }
        } else if u.ratio(1, 2)? {
            Op::Get { key: keygen(u)? }
        } else if u.ratio(1, 2)? {
            Op::Reboot
        } else if u.ratio(1, 2)? {
            Op::Remove { key: keygen(u)? }
        } else if u.ratio(1, 2)? {
            Op::Cas {
                key: keygen(u)?,
                old: if u.ratio(1, 2)? { Some(keygen(u)?) } else { None },
                new: if u.ratio(1, 2)? { Some(keygen(u)?) } else { None },
            }
        } else {
            let start = u.int_in_range(0..=KEYSPACE)?;
            let end = (start + 1).max(u.int_in_range(0..=KEYSPACE)?);

            Op::Range {
                start: start.to_be_bytes().as_ref().into(),
                end: end.to_be_bytes().as_ref().into(),
            }
        })
    }
}

fuzz_target!(|ops: Vec<Op>| {
    let tmp_dir = tempfile::TempDir::new().unwrap();
    let tmp_path = tmp_dir.path().to_owned();
    let config = Config::new().path(tmp_path);

    let mut tree: Db = config.open().unwrap();
    let mut model = std::collections::BTreeMap::new();

    for (_i, op) in ops.into_iter().enumerate() {
        match op {
            Op::Insert { key, value } => {
                assert_eq!(
                    tree.insert(key.clone(), value.clone()).unwrap(),
                    model.insert(key, value)
                );
            }
            Op::Get { key } => {
                assert_eq!(tree.get(&key).unwrap(), model.get(&key).cloned());
            }
            Op::Reboot => {
                drop(tree);
                tree = config.open().unwrap();
            }
            Op::Remove { key } => {
                assert_eq!(tree.remove(&key).unwrap(), model.remove(&key));
            }
            Op::Range { start, end } => {
                let mut model_iter =
                    model.range::<InlineArray, _>(&start..&end);
                let mut tree_iter = tree.range(start..end);

                for (k1, v1) in &mut model_iter {
                    let (k2, v2) = tree_iter
                        .next()
                        .expect("None returned from iter when Some expected")
                        .expect("IO issue encountered");
                    assert_eq!((k1, v1), (&k2, &v2));
                }

                assert!(tree_iter.next().is_none());
            }
            Op::Cas { key, old, new } => {
                let succ = if old == model.get(&key).cloned() {
                    if let Some(n) = &new {
                        model.insert(key.clone(), n.clone());
                    } else {
                        model.remove(&key);
                    }
                    true
                } else {
                    false
                };

                let res = tree
                    .compare_and_swap(key, old.as_ref(), new)
                    .expect("hit IO error");

                if succ {
                    assert!(res.is_ok());
                } else {
                    assert!(res.is_err());
                }
            }
        };

        for (key, value) in &model {
            assert_eq!(tree.get(key).unwrap().unwrap(), value);
        }

        for kv_res in &tree {
            let (key, value) = kv_res.unwrap();
            assert_eq!(model.get(&key), Some(&value));
        }
    }

    let mut model_iter = model.iter();
    let mut tree_iter = tree.iter();

    for (k1, v1) in &mut model_iter {
        let (k2, v2) = tree_iter.next().unwrap().unwrap();
        assert_eq!((k1, v1), (&k2, &v2));
    }

    assert!(tree_iter.next().is_none());
});

```

### Core Architecture Module: `scripts/execution_explorer.py`
```
#!/usr/bin/gdb --command

"""
a simple python GDB script for running multithreaded
programs in a way that is "deterministic enough"
to tease out and replay interesting bugs.

Tyler Neely 25 Sept 2017
t@jujit.su

references:
    https://sourceware.org/gdb/onlinedocs/gdb/All_002dStop-Mode.html
    https://sourceware.org/gdb/onlinedocs/gdb/Non_002dStop-Mode.html
    https://sourceware.org/gdb/onlinedocs/gdb/Threads-In-Python.html
    https://sourceware.org/gdb/onlinedocs/gdb/Events-In-Python.html
    https://blog.0x972.info/index.php?tag=gdb.py
"""

import gdb
import random

###############################################################################
#                                   config                                    #
###############################################################################
# set this to a number for reproducing results or None to explore randomly
seed = 156112673742  # None  # 951931004895

# set this to the number of valid threads in the program
# {2, 3} assumes a main thread that waits on 2 workers.
# {1, ... N} assumes all of the first N threads are to be explored
threads_whitelist = {2, 3}

# set this to the file of the binary to explore
filename = "target/debug/binary"

# set this to the place the threads should rendezvous before exploring
entrypoint = "src/main.rs:8"

# set this to after the threads are done
exitpoint = "src/main.rs:12"

# invariant unreachable points that should never be accessed
unreachable = [
        "panic_unwind::imp::panic"
        ]

# set this to the locations you want to test interleavings for
interesting = [
        "src/main.rs:8",
        "src/main.rs:9"
        ]

# uncomment this to output the specific commands issued to gdb
gdb.execute("set trace-commands on")

###############################################################################
###############################################################################


class UnreachableBreakpoint(gdb.Breakpoint):
    pass


class DoneBreakpoint(gdb.Breakpoint):
    pass


class InterestingBreakpoint(gdb.Breakpoint):
    pass


class DeterministicExecutor:
    def __init__(self, seed=None):
        if seed:
            print("seeding with", seed)
            self.seed = seed
            random.seed(seed)
        else:
            # pick a random new seed if not provided with one
            self.reseed()

        gdb.execute("file " + filename)

        # non-stop is necessary to provide thread-specific
        # information when breakpoints are hit.
        gdb.execute("set non-stop on")
        gdb.execute("set confirm off")

        self.ready = set()
        self.finished = set()

    def reseed(self):
        random.seed()
        self.seed = random.randrange(1e12)
        print("reseeding with", self.seed)
        random.seed(self.seed)

    def restart(self):
        # reset inner state
        self.ready = set()
        self.finished = set()

        # disconnect callbacks
        gdb.events.stop.disconnect(self.scheduler_callback)
        gdb.events.exited.disconnect(self.exit_callback)

        # nuke all breakpoints
        gdb.execute("d")

        # end execution
        gdb.execute("k")

        # pick new seed
        self.reseed()

        self.run()

    def rendezvous_callback(self, event):
        try:
            self.ready.add(event.inferior_thread.num)
            if len(self.ready) == len(threads_whitelist):
                self.run_schedule()
        except Exception as e:
            # this will be thrown if breakpoint is not a part of event,
            # like when the event was stopped for another reason.
            print(e)

    def run(self):
        gdb.execute("b " + entrypoint)

        gdb.events.stop.connect(self.rendezvous_callback)
        gdb.events.exited.connect(self.exit_callback)

        gdb.execute("r")

    def run_schedule(self):
        print("running schedule")
        gdb.execute("d")
        gdb.events.stop.disconnect(self.rendezvous_callback)
        gdb.events.stop.connect(self.scheduler_callback)

        for bp in interesting:
            InterestingBreakpoint(bp)

        for bp in unreachable:
            UnreachableBreakpoint(bp)

        DoneBreakpoint(exitpoint)

        self.pick()

    def pick(self):
        threads = self.runnable_threads()
        if not threads:
            print("restarting execution after running out of valid threads")
            self.restart()
            return

        thread = random.choice(threads)

        gdb.execute("t " + str(thread.num))
        gdb.execute("c")

    def scheduler_callback(self, event):
        if not isinstance(event, gdb.BreakpointEvent):
            print("WTF sched callback got", event.__dict__)
            return

        if isinstance(event.breakpoint, DoneBreakpoint):
            self.finished.add(event.inferior_thread.num)
        elif isinstance(event.breakpoint, UnreachableBreakpoint):
            print("!" * 80)
            print("unreachable breakpoint triggered with seed", self.seed)
            print("!" * 80)
            gdb.events.exited.disconnect(self.exit_callback)
            gdb.execute("q")
        else:
            print("thread", event.inferior_thread.num,
                  "hit breakpoint at", event.breakpoint.location)

        self.pick()

    def runnable_threads(self):
        threads = gdb.selected_inferior().threads()

        def f(it):
            return (it.is_valid() and not
                    it.is_exited() and
                    it.num in threads_whitelist and
                    it.num not in self.finished)

        good_threads = [it for it in threads if f(it)]
        good_threads.sort(key=lambda it: it.num)

        return good_threads

    def exit_callback(self, event):
        try:
            if event.exit_code != 0:
                print("!" * 80)
                print("interesting exit with seed", self.seed)
                print("!" * 80)
            else:
                print("happy exit")
                self.restart()

            gdb.execute("q")
        except Exception as e:
            pass

de = DeterministicExecutor(seed)
de.run()

```

### Core Architecture Module: `src/alloc.rs`
```
#[cfg(any(
    feature = "testing-shred-allocator",
    feature = "testing-count-allocator"
))]
pub use alloc::*;

// the memshred feature causes all allocated and deallocated
// memory to be set to a specific non-zero value of 0xa1 for
// uninitialized allocations and 0xde for deallocated memory,
// in the hope that it will cause memory errors to surface
// more quickly.

#[cfg(feature = "testing-shred-allocator")]
mod alloc {
    use std::alloc::{Layout, System};

    #[global_allocator]
    static ALLOCATOR: ShredAllocator = ShredAllocator;

    #[derive(Default, Debug, Clone, Copy)]
    struct ShredAllocator;

    unsafe impl std::alloc::GlobalAlloc for ShredAllocator {
        unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
            let ret = System.alloc(layout);
            assert_ne!(ret, std::ptr::null_mut());
            std::ptr::write_bytes(ret, 0xa1, layout.size());
            ret
        }

        unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
            std::ptr::write_bytes(ptr, 0xde, layout.size());
            System.dealloc(ptr, layout)
        }
    }
}

#[cfg(feature = "testing-count-allocator")]
mod alloc {
    use std::alloc::{Layout, System};

    #[global_allocator]
    static ALLOCATOR: CountingAllocator = CountingAllocator;

    static ALLOCATED: AtomicUsize = AtomicUsize::new(0);
    static FREED: AtomicUsize = AtomicUsize::new(0);
    static RESIDENT: AtomicUsize = AtomicUsize::new(0);

    fn allocated() -> usize {
        ALLOCATED.swap(0, Ordering::Relaxed)
    }

    fn freed() -> usize {
        FREED.swap(0, Ordering::Relaxed)
    }

    fn resident() -> usize {
        RESIDENT.load(Ordering::Relaxed)
    }

    #[derive(Default, Debug, Clone, Copy)]
    struct CountingAllocator;

    unsafe impl std::alloc::GlobalAlloc for CountingAllocator {
        unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
            let ret = System.alloc(layout);
            assert_ne!(ret, std::ptr::null_mut());
            ALLOCATED.fetch_add(layout.size(), Ordering::Relaxed);
            RESIDENT.fetch_add(layout.size(), Ordering::Relaxed);
            std::ptr::write_bytes(ret, 0xa1, layout.size());
            ret
        }

        unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
            std::ptr::write_bytes(ptr, 0xde, layout.size());
            FREED.fetch_add(layout.size(), Ordering::Relaxed);
            RESIDENT.fetch_sub(layout.size(), Ordering::Relaxed);
            System.dealloc(ptr, layout)
        }
    }
}

```

### Core Architecture Module: `src/block_checker.rs`
```
use std::collections::BTreeMap;
use std::panic::Location;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, Mutex};

static COUNTER: AtomicU64 = AtomicU64::new(0);
static CHECK_INS: LazyLock<BlockChecker> = LazyLock::new(|| {
    std::thread::spawn(move || {
        let mut last_top_10 = Default::default();
        loop {
            std::thread::sleep(std::time::Duration::from_secs(5));
            last_top_10 = CHECK_INS.report(last_top_10);
        }
    });

    BlockChecker::default()
});

type LocationMap = BTreeMap<u64, &'static Location<'static>>;

#[derive(Default)]
pub(crate) struct BlockChecker {
    state: Mutex<LocationMap>,
}

impl BlockChecker {
    fn report(&self, last_top_10: LocationMap) -> LocationMap {
        let state = self.state.lock().unwrap();
        println!("top 10 longest blocking sections:");

        let top_10: LocationMap =
            state.iter().take(10).map(|(k, v)| (*k, *v)).collect();

        for (id, location) in &top_10 {
            if last_top_10.contains_key(id) {
                println!("id: {}, location: {:?}", id, location);
            }
        }

        top_10
    }

    fn check_in(&self, location: &'static Location) -> BlockGuard {
        let next_id = COUNTER.fetch_add(1, Ordering::Relaxed);
        let mut state = self.state.lock().unwrap();
        state.insert(next_id, location);
        BlockGuard { id: next_id }
    }

    fn check_out(&self, id: u64) {
        let mut state = self.state.lock().unwrap();
        state.remove(&id);
    }
}

pub(crate) struct BlockGuard {
    id: u64,
}

impl Drop for BlockGuard {
    fn drop(&mut self) {
        CHECK_INS.check_out(self.id)
    }
}

#[track_caller]
pub(crate) fn track_blocks() -> BlockGuard {
    let caller = Location::caller();
    CHECK_INS.check_in(caller)
}

```

### Core Architecture Module: `src/config.rs`
```
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use fault_injection::{annotate, fallible};

use crate::Db;

struct TempDir(PathBuf);

impl std::fmt::Debug for TempDir {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_tuple("TempDir").field(&self.0).finish()
    }
}

impl TempDir {
    fn new(prefix: &str) -> io::Result<Self> {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(0);

        let pid = std::process::id();

        loop {
            let n = COUNTER.fetch_add(1, Ordering::SeqCst);
            let path = std::env::temp_dir()
                .join(prefix)
                .join(pid.to_string())
                .join(n.to_string());

            // create_dir_all maps to mkdir(2) for the final component,
            // which is atomic and fails with EEXIST if it already exists.
            match std::fs::create_dir_all(&path) {
                Ok(()) => return Ok(TempDir(path)),
                Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
                    // Skip ahead 999 slots to avoid crawling one-by-one
                    // through directories left by a previous process with
                    // the same PID.
                    COUNTER.fetch_add(999, Ordering::SeqCst);
                    continue;
                }
                Err(e) => return Err(e),
            }
        }
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

macro_rules! builder {
    ($(($name:ident, $t:ty, $desc:expr)),*) => {
        $(
            #[doc=$desc]
            pub fn $name(mut self, to: $t) -> Self {
                self.$name = to;
                self
            }
        )*
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    /// The base directory for storing the database.
    pub path: PathBuf,
    /// Cache size in **bytes**. Default is 512mb.
    pub cache_capacity_bytes: usize,
    /// The percentage of the cache that is dedicated to the
    /// scan-resistant entry cache.
    pub entry_cache_percent: u8,
    /// Start a background thread that flushes data to disk
    /// every few milliseconds. Defaults to every 200ms.
    pub flush_every_ms: Option<usize>,
    /// The zstd compression level to use when writing data to disk. Defaults to 3.
    pub zstd_compression_level: i32,
    /// This is only set to `Some` for objects created via
    /// `Config::tmp`, and will remove the storage directory
    /// when the final Arc drops.
    pub tempdir_deleter: Option<Arc<TempDir>>,
    /// A float between 0.0 and 1.0 that controls how much fragmentation can
    /// exist in a file before GC attempts to recompact it.
    pub target_heap_file_fill_ratio: f32,
    /// Values larger than this configurable will be stored as separate blob
    pub max_inline_value_threshold: usize,
}

impl Default for Config {
    fn default() -> Config {
        Config {
            path: "bloodstone.default".into(),
            flush_every_ms: Some(200),
            cache_capacity_bytes: 512 * 1024 * 1024,
            entry_cache_percent: 20,
            zstd_compression_level: 3,
            tempdir_deleter: None,
            target_heap_file_fill_ratio: 0.9,
            max_inline_value_threshold: 4096,
        }
    }
}

impl Config {
    /// Returns a default `Config`
    pub fn new() -> Config {
        Config::default()
    }

    /// Returns a config with the `path` initialized to a system
    /// temporary directory that will be deleted when this `Config`
    /// is dropped.
    pub fn tmp() -> io::Result<Config> {
        let tempdir = fallible!(TempDir::new("sled_tmp"));

        Ok(Config {
            path: tempdir.path().into(),
            tempdir_deleter: Some(Arc::new(tempdir)),
            ..Config::default()
        })
    }

    /// Set the path of the database (builder).
    pub fn path<P: AsRef<Path>>(mut self, path: P) -> Config {
        self.path = path.as_ref().to_path_buf();
        self
    }

    builder!(
        (flush_every_ms, Option<usize>, "Start a background thread that flushes data to disk every few milliseconds. Defaults to every 200ms."),
        (cache_capacity_bytes, usize, "Cache size in **bytes**. Default is 512mb."),
        (entry_cache_percent, u8, "The percentage of the cache that is dedicated to the scan-resistant entry cache."),
        (zstd_compression_level, i32, "The zstd compression level to use when writing data to disk. Defaults to 3."),
        (target_heap_file_fill_ratio, f32, "A float between 0.0 and 1.0 that controls how much fragmentation can exist in a file before GC attempts to recompact it."),
        (max_inline_value_threshold, usize, "Values larger than this configurable will be stored as separate blob")
    );

    pub fn open<const LEAF_FANOUT: usize>(
        &self,
    ) -> io::Result<Db<LEAF_FANOUT>> {
        if LEAF_FANOUT < 3 {
            return Err(annotate!(io::Error::new(
                io::ErrorKind::Unsupported,
                "Db's LEAF_FANOUT const generic must be 3 or greater."
            )));
        }
        Db::open_with_config(self)
    }
}

```

### Core Architecture Module: `src/db.rs`
```
use std::collections::HashMap;
use std::fmt;
use std::io;
use std::sync::{Arc, Mutex, mpsc};
use std::time::{Duration, Instant};

use crate::*;

/// sled 1.0 alpha :)
///
/// One of the main differences between this and sled 0.34 is that
/// `Db` and `Tree` now have a `LEAF_FANOUT` const generic parameter.
/// This parameter is an interesting single-knob performance tunable
/// that allows users to traverse the performance-vs-efficiency
/// trade-off spectrum. The default value of `1024` causes keys and
/// values to be more efficiently compressed when stored on disk,
/// but for larger-than-memory random workloads it may be advantageous
/// to lower `LEAF_FANOUT` to between `16` to `256`, depending on your
/// efficiency requirements. A lower value will also cause contention
/// to be reduced for frequently accessed data. This value cannot be
/// changed after creating the database.
///
/// As an alpha release, please do not expect this to be safe for
/// business-critical use cases. However, if you would like this to
/// serve your business-critical use cases over time, please give it
/// a shot in a low-risk non-production environment and report any
/// issues you encounter in a github issue.
///
/// Note that `Db` implements `Deref` for the default `Tree` (sled's
/// version of namespaces / keyspaces / buckets), but you can create
/// and use others using `Db::open_tree`.
#[derive(Clone)]
pub struct Db<const LEAF_FANOUT: usize = 1024> {
    config: Config,
    _shutdown_dropper: Arc<ShutdownDropper<LEAF_FANOUT>>,
    cache: ObjectCache<LEAF_FANOUT>,
    trees: Arc<Mutex<HashMap<CollectionId, Tree<LEAF_FANOUT>>>>,
    collection_id_allocator: Arc<Allocator>,
    collection_name_mapping: Tree<LEAF_FANOUT>,
    default_tree: Tree<LEAF_FANOUT>,
    was_recovered: bool,
}

impl<const LEAF_FANOUT: usize> std::ops::Deref for Db<LEAF_FANOUT> {
    type Target = Tree<LEAF_FANOUT>;
    fn deref(&self) -> &Tree<LEAF_FANOUT> {
        &self.default_tree
    }
}

impl<const LEAF_FANOUT: usize> IntoIterator for &Db<LEAF_FANOUT> {
    type Item = io::Result<(InlineArray, InlineArray)>;
    type IntoIter = crate::Iter<LEAF_FANOUT>;

    fn into_iter(self) -> Self::IntoIter {
        self.iter()
    }
}

impl<const LEAF_FANOUT: usize> fmt::Debug for Db<LEAF_FANOUT> {
    fn fmt(&self, w: &mut fmt::Formatter<'_>) -> fmt::Result {
        let alternate = w.alternate();

        let mut debug_struct = w.debug_struct(&format!("Db<{}>", LEAF_FANOUT));

        if alternate {
            debug_struct
                .field("global_error", &self.check_error())
                .field(
                    "data",
                    &format!("{:?}", self.iter().collect::<Vec<_>>()),
                )
                .finish()
        } else {
            debug_struct.field("global_error", &self.check_error()).finish()
        }
    }
}

fn flusher<const LEAF_FANOUT: usize>(
    cache: ObjectCache<LEAF_FANOUT>,
    shutdown_signal: mpsc::Receiver<mpsc::Sender<()>>,
    flush_every_ms: usize,
) {
    let interval = Duration::from_millis(flush_every_ms as _);
    let mut last_flush_duration = Duration::default();

    let flush = || {
        let flush_res_res = std::panic::catch_unwind(|| cache.flush());
        match flush_res_res {
            Ok(Ok(_)) => {
                // don't abort.
                return;
            }
            Ok(Err(flush_failure)) => {
                log::error!(
                    "Db flusher encountered error while flushing: {:?}",
                    flush_failure
                );
                cache.set_error(&flush_failure);
            }
            Err(panicked) => {
                log::error!(
                    "Db flusher panicked while flushing: {:?}",
                    panicked
                );
                cache.set_error(&io::Error::other(
                    "Db flusher panicked while flushing".to_string(),
                ));
            }
        }
        std::process::abort();
    };

    loop {
        let recv_timeout = interval
            .saturating_sub(last_flush_duration)
            .max(Duration::from_millis(1));
        if let Ok(shutdown_sender) = shutdown_signal.recv_timeout(recv_timeout)
        {
            flush();

            // this is probably unnecessary but it will avoid issues
            // if egregious bugs get introduced that trigger it
            cache.set_error(&io::Error::other(
                "system has been shut down".to_string(),
            ));

            assert!(cache.is_clean());

            drop(cache);

            if let Err(e) = shutdown_sender.send(()) {
                log::error!(
                    "Db flusher could not ack shutdown to requestor: {e:?}"
                );
            }
            log::debug!(
                "flush thread terminating after signalling to requestor"
            );
            return;
        }

        let before_flush = Instant::now();

        flush();

        last_flush_duration = before_flush.elapsed();
    }
}

impl<const LEAF_FANOUT: usize> Drop for Db<LEAF_FANOUT> {
    fn drop(&mut self) {
        if self.config.flush_every_ms.is_none() {
            if let Err(e) = self.flush() {
                log::error!("failed to flush Db on Drop: {e:?}");
            }
        } else {
            // otherwise, it is expected that the flusher thread will
            // flush while shutting down the final Db/Tree instance
        }
    }
}

impl<const LEAF_FANOUT: usize> Db<LEAF_FANOUT> {
    #[cfg(feature = "for-internal-testing-only")]
    fn validate(&self) -> io::Result<()> {
        // for each tree, iterate over index, read node and assert low key matches
        // and assert first time we've ever seen node ID

        let mut ever_seen = std::collections::HashSet::new();
        let before = std::time::Instant::now();

        #[cfg(feature = "for-internal-testing-only")]
        let _b0 = crate::block_checker::track_blocks();

        for (_cid, tree) in self.trees.lock().unwrap().iter() {
            let mut hi_none_count = 0;
            let mut last_hi = None;
            for (low, node) in tree.index.iter() {
                // ensure we haven't reused the object_id across Trees
                assert!(ever_seen.insert(node.object_id));

                let (read_low, node_mu, read_node) =
                    tree.page_in(&low, self.cache.current_flush_epoch())?;

                assert_eq!(read_node.object_id, node.object_id);
                assert_eq!(node_mu.leaf.as_ref().unwrap().lo, low);
                assert_eq!(read_low, low);

                if let Some(hi) = &last_hi {
                    assert_eq!(hi, &node_mu.leaf.as_ref().unwrap().lo);
                }

                if let Some(hi) = &node_mu.leaf.as_ref().unwrap().hi {
                    last_hi = Some(hi.clone());
                } else {
                    assert_eq!(hi_none_count, 0);
                    hi_none_count += 1;
                }
            }
            // each tree should have exactly one leaf with no max hi key
            assert_eq!(hi_none_count, 1);
        }

        log::debug!(
            "{} leaves looking good after {} micros",
            ever_seen.len(),
            before.elapsed().as_micros()
        );

        Ok(())
    }

    pub fn stats(&self) -> Stats {
        Stats { cache: self.cache.stats() }
    }

    pub fn size_on_disk(&self) -> io::Result<u64> {
        use std::fs::read_dir;

        fn recurse(mut dir: std::fs::ReadDir) -> io::Result<u64> {
            dir.try_fold(0, |acc, file| {
                let file = file?;
                let size = match file.metadata()? {
                    data if data.is_dir() => recurse(read_dir(file.path())?)?,
                    data => data.len(),
                };
                Ok(acc + size)
            })
        }

        recurse(read_dir(&self.cache.config.path)?)
    }

    /// Returns `true` if the database was
    /// recovered from a previous 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1419** (2022-10-02): **Sled never exits**
  *Symptoms*: I'm running sled in a test pointed at tmp, and with RUST_LOG set to trace, I get the following output:  ```  ERROR my_project                                    > Error ...  TRACE mio::poll                                     > deregistering event source from poller  TRACE want                                          > signal: Closed  TRACE mio::poll                                     > deregistering event source from poller  TRACE want                                          > signal: Closed  TRACE mio::poll                                     > deregistering event source from poller  TRACE want                                          > signal: Closed  TRACE mio::poll                                     > deregistering event source from poller  TRACE want                                          > signal: Closed  TRACE mio::poll                                     > deregistering event source from poller  TRACE sled::pagecache::iobuf                        > skipping roll_iobuf due to empty segment  TRACE sled::pagecache::iobuf                        > bumping atomic header lsn to -1  TRACE sled::pagecache::iobuf                        > skipping roll_iobuf due to empty segment  TRACE sled::pagecache::iobuf                        > skipping roll_iobuf due to empty segment  TRACE sled::pagecache::iobuf                        > skipping roll_iobuf due to empty segment  TRACE sled::pagecache::iobuf                        > skipping roll_iobuf due to empty 
  **Post-Mortem & Fix Analysis**:
  > sled does not have anything to do with mio - I recommend opening an issue with the upstream project unless you show a specific stacktrace that points to something that is causing sled to hang.

- **Issue #1413** (2022-05-18): **sled open error**
  *Symptoms*: Bug reports must include all following items:  ``` /home/larluo/my-work/my-repo/back-end-data-serv〉cat data-ops/dc-cli-rust/Cargo.toml                                                 05/18/2022 10:28:33 AM[package] name = "dc-cli-rust" version = "0.1.0" edition = "2021"  [[bin]] name = "dc-cli"  # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html  [dependencies] derivative = "2.2" serde = { version = "1.0", features = ["derive"] } serde_with = "1.13" serde_json = "1.0" dotenv = "0.15" log = "0.4" env_logger = "0.8" anyhow = "1.0" itertools = "0.10" async-trait = "0.1" async-recursion = "1.0"  regex = "1.5" uuid = { version = "1.0", features = [ "v4", "fast-rng", "macro-diagnostics" ] } parking_lot = "0.12" futures = "0.3" tokio = { version = "1.17", features = ["full"] }  base64 = "0.13" chrono = "0.4.19" percent-encoding = "2.1" urlencoding = "2.1" ring = "0.16" clap = { version = "3.1", features = ["derive"] } reqwest = { version = "0.11", features = ["json", "gzip", "cookies", "native-tls-vendored"] } cookie_store = "0.16" reqwest_cookie_store = "0.3" inventory = "0.2"  # sled = "0.34.7" sled = { git = "https://github.com/spacejam/sled.git", rev = "e95ec057" } ``` ``` #[tokio::main] async fn main() -> anyhow::Result<()> {     dotenv::dotenv().ok() ;     env_logger::init();      let db = &sled::open("db-cli.db").unwrap() ;     Ok(()) } ``` 1. expected result 1. actual resul

- **Issue #1407** (2022-04-19): **SIGSEGV on db.insert()**
  *Symptoms*: I get an `(signal: 11, SIGSEGV: invalid memory reference)` error when trying to insert into sled. I am using serde/bincode to get a `Vec<u8>` of my struct. Relevant code is:  ```rust pub fn cache_sample(&self, key: u64, sample: &Sample<Complex32>) -> Result<()> {     let data: Vec<u8> = bincode::serde::encode_to_vec(sample, self.config)?;     dbg!(data.len());     let key: &[u8; 8] = unsafe { transmute(key) };     dbg!();     self.db.insert(key, data)?;  // Segfault     dbg!();     Ok(()) } ``` Probably due to an unaligned move: ``` #0  __memmove_avx_unaligned_erms () at ../sysdeps/x86_64/multiarch/memmove-vec-unaligned-erms.S:397 ```  ### expected result Data get's inserted without segfault  ### actual result <details>   <summary>coredumpctl gdb</summary>  ``` $ coredumpctl gdb            PID: 182393 (df-6896915b79b2)            UID: 1000 (hendrik)            GID: 1000 (hendrik)         Signal: 11 (SEGV)      Timestamp: Tue 2022-04-19 07:39:17 CEST (21s ago)   Command Line: /home/hendrik/projects/DeepFilterNet/target/debug/deps/df-6896915b79b2d3b2 cached_valid --nocapture     Executable: /home/hendrik/projects/DeepFilterNet/target/debug/deps/df-6896915b79b2d3b2  Control Group: /user.slice/user-1000.slice/user@1000.service/app.slice/app-foot.slice/app-foot-174148.scope           Unit: user@1000.service      User Unit: app-foot-174148.scope          Slice: user-1000.slice      Owner UID: 1000 (hendrik)        Boot ID: 45f817c8a33e45158dc3
  **Post-Mortem & Fix Analysis**:
  > My bad, the problem was `let key: &[u8; 8] = unsafe { transmute(key) };`  Closing.

- **Issue #1384** (2026-04-07): **sled seems to have a bug in initialization when simplelog is used**
  *Symptoms*: ## Expected  I have a code that starts up sled in a function, like  ```rust         let db = sled::Config::new()             .path(path)             .use_compression(false)             .mode(sled::Mode::HighThroughput)             .open()             .expect("Error opening Key Value store");          watch!(db); ```  I tried several different options but it stops at the `watch!` line. `watch!` is a self made macro that runs `log::trace!` with the variable name.    ## Actual result  I have a test function like the following.  ```rust pub fn test_xvc_kvstore() {     use common::keyvaluestore::XvcKeyValueStore;     use common::xvcfile::XvcFileMetadata;     setup::logging(LevelFilter::Trace);     let the_dir = run_in_temp_xvc_dir();     let kvs_path = PathBuf::from("kvstore");     let xvc_root = XvcRoot::new(&the_dir).unwrap();     let kv_store = XvcKeyValueStore::from_root(&xvc_root);     // assert!(kvs_path.exists());     // assert!(the_dir.join(kvs_path).exists());     let filename = Path::new("file1.bin");     generate_random_file(&filename, &100000);     let mut count0 = 0;     for kv1 in kv_store.iter() {         count0 += 1;     }     assert!(count0 == 0); ```  The trace stops at the `watch!` line above.   ``` 18:05:37 [TRACE] (5) sled::pagecache::segment: [/home/iex/.cargo/registry/src/github.com-1ecc6299db9ec823/sled-0.34.7/src/pagecache/segment.rs:900] expected stabilization lsn -524288 to be greater than the previous value o
  **Post-Mortem & Fix Analysis**:
  > The issue here is that simplelog is deadlocking when there's a re-entrant call to the log from formatting calls it makes. I cannot reproduce this issue when using env_logger, but I can recreate the same behavior with sled out of the loop. Here's the code I reproduced it with. https://gist.github.com/divergentdave/cc05fdbb61bfd6e9238d5600937628ce
  > Thank you @divergentdave I can use another logging implementation, and report this to simplelog if you're certain that sled runs the logging as it should be.  I'm looking for a point to put "possible interactions with other crates" section in the documentation to put this info for the short term. Where do you think is a better point?  
  > I've replaced the logging implementation with fern, and the problem seems to persist. 

- **Issue #1382** (2021-10-19): **insert long key Error**
  *Symptoms*: Bug reports must include all following items:  1. expected result ``` It should insert success. ``` 2. actual result ``` Err(Io(Os { code: 2, kind: NotFound, message: "No such file or directory" })) ``` 3. sled version ``` sled = "0.34.7" ``` 4. rustc version ``` rustc 1.55.0 (c8dfcfe04 2021-09-06) ``` 5. operating system ``` Ubuntu 20.04.3 LTS (GNU/Linux 5.11.0-37-generic x86_64) ``` 6. minimal code sample that helps to reproduce the issue  ```rust #[cfg(test)] mod test{     use tempfile::TempDir;     #[test]     fn it_should_works(){         let db=sled::open(TempDir::new().unwrap().path()).unwrap();         let k=[0_u8;100000];         let v=[0_u8;100000];         let x=db.insert(k.clone(), v.to_vec());         println!("{:?}",x);         let y=db.get(k);         println!("{:?}",y);         db.flush().unwrap();     } } ``` 7. logs, panic messages, stack traces ``` stack backtrace:    0: rust_begin_unwind              at /rustc/dfc5add915e8bf4accbb7cf4de00351a7c6126a1/library/std/src/panicking.rs:517:5    1: core::panicking::panic_fmt              at /rustc/dfc5add915e8bf4accbb7cf4de00351a7c6126a1/library/core/src/panicking.rs:100:14    2: core::result::unwrap_failed              at /rustc/dfc5add915e8bf4accbb7cf4de00351a7c6126a1/library/core/src/result.rs:1616:5    3: core::result::Result<T,E>::unwrap              at /rustc/dfc5add915e8bf4accbb7cf4de00351a7c6126a1/library/core/src/result.rs:1298:23    4: mytests::test::it_
  **Post-Mortem & Fix Analysis**:
  > It's not a sled issue. Sled supports long KEY length up to [MAX_BLOB](https://github.com/spacejam/sled/blob/c840fe7e3b3ad27e7de192bde6899e34b44f0a8c/src/pagecache/constants.rs#L40) ```rust let db=sled::open(TempDir::new().unwrap().path()).unwrap(); // <- dir dropped after sled open ``` you should use: ```rust let fs = TempDir::new().unwrap(); let db = sled::open(fs.path()).unwrap();  // drop(fs); ```
  > > It's not a sled issue. Sled supports long KEY length up to [MAX_BLOB](https://github.com/spacejam/sled/blob/c840fe7e3b3ad27e7de192bde6899e34b44f0a8c/src/pagecache/constants.rs#L40) >  > ```rust > let db=sled::open(TempDir::new().unwrap().path()).unwrap(); // <- dir dropped after sled open > ``` >  > you should use: >  > ```rust > let fs = TempDir::new().unwrap(); > let db = sled::open(fs.path()).unwrap(); >  > // drop(fs); > ```  Got it! Thanx Dude!

- **Issue #1380** (2022-02-21): **A quite serious bug when use Subscribers as a Future**
  *Symptoms*: Finally I can reproduce the blocking issue. (Related issue: #1378 )  code sample:  ```toml [dependencies] sled = "0.34.7" tokio = { version = "1.12.0", features = ["macros","rt-multi-thread", "time"] } ``` ```rust #[tokio::main(flavor="multi_thread")] async fn main() {     let db = sled::Config::new().path("test.db").open().unwrap();     let tree = db.open_tree(b"tree").unwrap();      let mut subs = tree.watch_prefix("");      tokio::task::spawn(async move {         for i in 1usize..2024 {             println!("{}", i); // this can sometimes reaches 1025, then blocks             tree.insert(&i.to_le_bytes(), &i.to_le_bytes()).unwrap();             tokio::time::sleep(std::time::Duration::from_millis(100)).await;         }     });      tokio::task::spawn(async move {         println!("watch");         while let Some(event) = (&mut subs).await {             match event {                 sled::Event::Insert { key, value } => {                     println!("event: {:?} {:?}", key, value);                 }                 _ => {}             }         }     });      tokio::time::sleep(std::time::Duration::from_secs(10000)).await;  }  ```  Run at least twice  ```shell cargo run ```  1. expected result     Subscribers should work as expected. 2. actual result     Not work as expected 3. sled version    0.34.7 4. rustc version     rustc 1.57.0-nightly (97032a6df 2021-09-08) 5. operating system    NAME="Ubuntu"    VERSION="20.0
  **Post-Mortem & Fix Analysis**:
  > As the sample code shows, when the **blocking** happens,  https://github.com/spacejam/sled/blob/d81865d07f07910133877915b57abf0c52d5756b/src/subscriber.rs#L243  this sync_channel reaches to max size 1024,  then  https://github.com/spacejam/sled/blob/d81865d07f07910133877915b57abf0c52d5756b/src/subscriber.rs#L273  the .send() call blocks.  https://github.com/spacejam/sled/blob/d81865d07f07910133877915b57abf0c52d5756b/src/subscriber.rs#L158  never receives.  https://github.com/spacejam/sled/blob/d81865d07f07910133877915b57abf0c52d5756b/src/tree.rs#L186  finally, Tree.insert_inner() blocks due to the the reserve() call blocks, so the Tree.insert() call blocks.  When the insert call blocks, the memory usage of my app rises rapidly.  This leads to a serious memory leak on my ubuntu server. #1378   
  > <del>Seems like the  std::sync::mpsc::SyncSender does not work as expected.</del>
  > I think the root cause is:  send() when insert  https://github.com/spacejam/sled/blob/d81865d07f07910133877915b57abf0c52d5756b/src/tree.rs#L186  But never consume the data if the kv pair already exists.  https://github.com/spacejam/sled/blob/d81865d07f07910133877915b57abf0c52d5756b/src/tree.rs#L192

- **Issue #1358** (2022-04-19): **Sled endlessly(?) logs background work after first read of a (possibly corrupt) database**
  *Symptoms*: I have a ~60MB database created by repeating the following ~200 times  - start a process in a container with a 'container volume' to mount the directory where I want the sled db to be  - performs some processing (takes a few seconds) which inserts ~1k entries  - process exits successfully, container exits and is cleaned up  (the first iteration of this creates the db)  I then start up a webserver outside of the container that opens the db, and reads it when requests happen (no writes). Sled logs this on webserver startup on initially opening the DB: ``` [2021-08-11T13:03:22Z DEBUG sled::pagecache::logger] segment with lsn 9223372036854775807 had computed crc 3971697493, but stored crc 4294967295 [2021-08-11T13:03:22Z DEBUG sled::pagecache::logger] segment with lsn 9223372036854775807 had computed crc 3971697493, but stored crc 4294967295 [2021-08-11T13:03:22Z DEBUG sled::pagecache::iterator] ordering before clearing tears: {191889408: 30932992, 192413696: 31981568}, max_header_stable_lsn: 192396137 [2021-08-11T13:03:22Z DEBUG sled::pagecache::iterator] in clean_tail_tears, found missing item in tail: None and we'll scan segments {191889408: 30932992, 192413696: 31981568} above lowest lsn 191889408 [2021-08-11T13:03:22Z DEBUG sled::pagecache::iterator] filtering out segments after detected tear at (lsn, lid) 192618452 [2021-08-11T13:03:22Z DEBUG sled::pagecache::iterator] hit max_lsn 192618452 in iterator, stopping [2021-08-11T13:03:22Z DEBUG sled::pagecache::sn
  **Post-Mortem & Fix Analysis**:
  > Hey @aidanhs, Does this only happen in a container?
  > I only observed it happening in a container, but that's because I was using them :) - I'll try and do some experiments outside.
  > I never got time to try and reproduce this and I've moved away from sled in the meantime, so closing.

- **Issue #1357** (2021-08-06): **Concurrent `flush_async()` in multiple `tokio::runtime` causes deadlock:**
  *Symptoms*: Concurrent `flush_async()` in multiple `tokio::runtime` causes deadlock:  - 10 threads: every one creates a `tokio::runime`. - Every `tokio::runtime` spawns two insert-and-flush-async task: the runtime blocks until one of them to finish, the other one is left running. - A deadlock happens.  ### Reproduce  The minimal code to reproduce this bug is: https://github.com/drmingdrmer/sledtest/blob/main/src/main.rs  Run it by: `git clone https://github.com/drmingdrmer/sledtest.git && cd sledtest && cargo run`  ### Expected: All task done with output: ``` ... all done ```  ### Actual result It hangs with following output: ``` ... 0, insert_flush_async() done! joined 1, insert_flush_async() done! 2, insert_flush_async() done! joined joined ``` Or these output: ``` ... thread '<unnamed>' panicked at 'called `Result::unwrap()` on an `Err` value: ReportableBug("threadpool failed to complete action before shutdown")', src/main.rs:17:28 ```  1. sled version 0.34.6 1. rustc version: rustc 1.49.0-nightly (8dae8cdcc 2020-10-12) 1. operating system: MacOS 10.15.5 (19F101)     
  **Post-Mortem & Fix Analysis**:
  > It should be fixed on master  On Fri, Aug 6, 2021, 17:09 张炎泼 ***@***.***> wrote:  > Concurrent flush_async() in multiple tokio::runtime causes deadlock: > >    - 10 threads: every one creates a tokio::runime. >    - Every tokio::runtime spawns two insert-and-flush-async task: the >    runtime blocks until one of them to finish, the other one is left running. >    - A deadlock happens. > > Reproduce > > The minimal code to reproduce this bug is: > https://github.com/drmingdrmer/sledtest/blob/main/src/main.rs > > Run it by: > git clone https://github.com/drmingdrmer/sledtest.git && cd sledtest && > cargo run > Expected: > > All task done with output: > > ... > all done > > Actual result > > It hangs with following output: > > ... > 0, insert_flush_async() done! > joined > 1, insert_flush_async() done! > 2, insert_flush_async() done! > joined > joined > > Or these output: > > ... > thread '<unnamed>' panicked at 'called `Result::unwrap()` on an `Err` value: ReportableBug("threadpool faile
  > > It should be fixed on master  @0xdeafbeef  Wow... Is it already fixed on master? Would you tell me which commit fixed it? There are a lot commits from 0.34.6 to current master.
  > @drmingdrmer 61803984dc1cd8c35a3d537c2a7f5538fa659fac

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

### Incident Patch 1: `e449d171` (2026-04-04)
**Commit Message**: Add benchmark for memory and throughput of a fanout=3 data set for the baseline of optimizing the metadata subsystem

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -64,6 +64,7 @@ rand = "0.9.1"
 quickcheck = "1.0.3"
 rand_distr = "0.5"
 libc = "0.2.147"
+hdrhistogram = "7.5"
 
 [[test]]
 name = "test_crash_recovery"
```

**File**: `examples/bench_large.rs` (added, +269/-0)
```diff
@@ -0,0 +1,269 @@
+use std::alloc::{GlobalAlloc, Layout, System};
+use std::fs;
+use std::sync::atomic::{AtomicU64, Ordering};
+use std::sync::{Arc, Barrier, Mutex};
+use std::thread;
+use std::time::Instant;
+
+use hdrhistogram::Histogram;
+
+use sled::{Config, Db};
+
+// --- Peak-memory tracking allocator ---
+
+// Total bytes ever allocated — reported in baseline output alongside MAX_RESIDENT
+static ALLOCATED: AtomicU64 = AtomicU64::new(0);
+static RESIDENT: AtomicU64 = AtomicU64::new(0);
+static MAX_RESIDENT: AtomicU64 = AtomicU64::new(0);
+
+struct BenchAllocator;
+
+unsafe impl GlobalAlloc for BenchAllocator {
+    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
+        let ptr = unsafe { System.alloc(layout) };
+        if !ptr.is_null() {
+            let size = layout.size() as u64;
+            ALLOCATED.fetch_add(size, Ordering::Relaxed);
+            let new_resident =
+                RESIDENT.fetch_add(size, Ordering::Relaxed) + size;
+            MAX_RESIDENT.fetch_max(new_resident, Ordering::Relaxed);
+        }
+        ptr
+    }
+
+    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
+        RESIDENT.fetch_sub(layout.size() as u64, Ordering::Relaxed);
+        unsafe { System.dealloc(ptr, layout) }
+    }
+}
+
+#[global_allocator]
+static GLOBAL: BenchAllocator = BenchAllocator;
+
+// --- Database helpers ---
+
+const DB_PATH: &str = "profile.bench_large.sled";
+const LEAF_FANOUT: usize = 3;
+const N_KEYS: u64 = 10_000_000;
+const N_THREADS: usize = 2;
+const KEYS_PER_THREAD: u64 = N_KEYS / N_THREADS as u64;
+
+type BenchDb = Db<LEAF_FANOUT>;
+
+fn open_db() -> BenchDb {
+    Config {
+        path: DB_PATH.into(),
+        cache_capacity_bytes: 512 * 1024 * 1024,
+        flush_every_ms: Some(200),
+        ..Config::default()
+    }
+    .open()
+    .unwrap()
+}
+
+fn new_histogram() -> Histogram<u64> {
+    // Tracks insert latency in microseconds (1us to 60s, 3 significant figures).
+    // Latencies above 60,000,000us (60s) saturate silently at the max bucket.
+    Histogram::<u64>::new_with_bounds(1, 60_000_000, 3).unwrap()
+}
+
+fn git_hash() -> String {
+    std::process::Command::new("git")
+        .args(["rev-parse", "--short", "HEAD"])
+        .output()
+        .ok()
+        .and_then(|o| String::from_utf8(o.stdout).ok())
+        .map(|s| s.trim().to_string())
+        .unwrap_or_else(|| "unknown".into())
+}
+
+fn os_info() -> String {
+    std::process::Command::new("uname")
+        .arg("-a")
+        .output()
+        .ok()
+        .and_then(|o| String::from_utf8(o.stdout).ok())
+        .map(|s| s.trim().to_string())
+        .unwrap_or_else(|| "unknown".into())
+}
+
+fn cpu_info() -> String {
+    // macOS
+    let mac = std::process::Command::new("sysctl")
+        .args(["-n", "machdep.cpu.brand_string"])
+        .output()
+        .ok()
+        .and_then(|o| String::from_utf8(o.stdout).ok())
+        .map(|s| s.trim().to_string())
+        .filter(|s| !s.is_empty());
+
+    if let Some(info) = mac {
+        return info;
+    }
+
+    // Linux
+    std::fs::read_to_string("/proc/cpuinfo")
+        .unwrap_or_default()
+        .lines()
+        .find(|l| l.starts_with("model name"))
+        .map(|l| l.splitn(2, ':').nth(1).unwrap_or("").trim().to_string())
+        .unwrap_or_else(|| "unknown".into())
+}
+
+fn write_baseline(
+    write_duration: std::time::Duration,
+    throughput: f64,
+    hist: &Histogram<u64>,
+    flush_duration: std::time::Duration,
+    recovery_duration: std::time::Duration,
+    max_resident_bytes: u64,
+    total_allocated_bytes: u64,
+) {
+    use std::fmt::Write as FmtWrite;
+
+    let now = std::time::SystemTime::now()
+        .duration_since(std::time::UNIX_EPOCH)
+        .unwrap()
+        .as_secs();
+
+    let mut out = String::new();
+    writeln!(out, "=== sled bench_large baseline ===").unwrap();
+    writeln!(out, "Date (unix): {}", now).unwrap();
+    writeln!(out, "Git: {}", git_hash()).unwrap();
+    writeln!(out, "OS:
```

---

### Incident Patch 2: `11fc0dc0` (2026-04-04)
**Commit Message**: Merge pull request #1537 from cuiweixie/fix/stale-snapshot-log-message

Fix stale snapshot removal log message

**File**: `src/metadata_store.rs` (modified, +1/-1)
```diff
@@ -713,7 +713,7 @@ fn enumerate_logs_and_snapshot(
                 if let Some(snap_id) = snapshot {
                     if snap_id < id {
                         log::warn!(
-                            "removing stale snapshot {id} that is superceded by snapshot {id}"
+                            "removing stale snapshot {snap_id} that is superceded by snapshot {id}"
                         );
 
                         if let Err(e) = fs::remove_file(&file_name) {
```

---

### Incident Patch 3: `9333efc9` (2026-03-26)
**Commit Message**: Fix stale snapshot removal log message

The warning incorrectly printed the same snapshot id twice; use snap_id
for the removed stale snapshot and id for the superseding snapshot.

**File**: `src/metadata_store.rs` (modified, +1/-1)
```diff
@@ -713,7 +713,7 @@ fn enumerate_logs_and_snapshot(
                 if let Some(snap_id) = snapshot {
                     if snap_id < id {
                         log::warn!(
-                            "removing stale snapshot {id} that is superceded by snapshot {id}"
+                            "removing stale snapshot {snap_id} that is superceded by snapshot {id}"
                         );
 
                         if let Err(e) = fs::remove_file(&file_name) {
```

---

### Incident Patch 4: `92cca2de` (2025-05-16)
**Commit Message**: Merge pull request #1525 from spacejam/tyler_prefix_encoding

[bloodstone] implement prefix encoding

**File**: `src/leaf.rs` (modified, +231/-15)
```diff
@@ -5,7 +5,7 @@ pub(crate) struct Leaf<const LEAF_FANOUT: usize> {
     pub lo: InlineArray,
     pub hi: Option<InlineArray>,
     pub prefix_length: usize,
-    pub data: stack_map::StackMap<InlineArray, InlineArray, LEAF_FANOUT>,
+    data: stack_map::StackMap<InlineArray, InlineArray, LEAF_FANOUT>,
     pub in_memory_size: usize,
     pub mutation_count: u64,
     #[serde(skip)]
@@ -58,13 +58,8 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
 
     pub(crate) fn get(&self, key: &[u8]) -> Option<&InlineArray> {
         assert!(self.deleted.is_none());
-        let prefixed_key = if self.prefix_length == 0 {
-            key
-        } else {
-            let prefix = self.prefix();
-            assert!(key.starts_with(prefix));
-            &key[self.prefix_length..]
-        };
+        assert!(key.starts_with(self.prefix()));
+        let prefixed_key = &key[self.prefix_length..];
         self.data.get(prefixed_key)
     }
 
@@ -74,13 +69,8 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
         value: InlineArray,
     ) -> Option<InlineArray> {
         assert!(self.deleted.is_none());
-        let prefixed_key = if self.prefix_length == 0 {
-            key
-        } else {
-            let prefix = self.prefix();
-            assert!(key.starts_with(prefix));
-            key[self.prefix_length..].into()
-        };
+        assert!(key.starts_with(self.prefix()));
+        let prefixed_key = key[self.prefix_length..].into();
         self.data.insert(prefixed_key, value)
     }
 
@@ -91,4 +81,230 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
         let partial_key = &key[self.prefix_length..];
         self.data.remove(partial_key)
     }
+
+    pub(crate) fn merge_from(&mut self, other: &mut Self) {
+        assert!(self.is_empty());
+
+        self.hi = other.hi.clone();
+
+        let new_prefix_len = if let Some(hi) = &self.hi {
+            self.lo.iter().zip(hi.iter()).take_while(|(l, r)| l == r).count()
+        } else {
+            0
+        };
+
+        assert_eq!(self.lo[..new_prefix_len], other.lo[..new_prefix_len]);
+
+        // self.prefix_length is not read because it's expected to be
+        // initialized here.
+        self.prefix_length = new_prefix_len;
+
+        if self.prefix() == other.prefix() {
+            self.data = std::mem::take(&mut other.data);
+            return;
+        }
+
+        assert!(
+            self.prefix_length < other.prefix_length,
+            "self: {:?} other: {:?}",
+            self,
+            other
+        );
+
+        let unshifted_key_amount = other.prefix_length - self.prefix_length;
+        let unshifted_prefix = &other.lo
+            [other.prefix_length - unshifted_key_amount..other.prefix_length];
+
+        for (k, v) in other.data.iter() {
+            let mut unshifted_key =
+                Vec::with_capacity(unshifted_prefix.len() + k.len());
+            unshifted_key.extend_from_slice(unshifted_prefix);
+            unshifted_key.extend_from_slice(k);
+            self.data.insert(unshifted_key.into(), v.clone());
+        }
+
+        assert_eq!(other.data.len(), self.data.len());
+
+        #[cfg(feature = "for-internal-testing-only")]
+        assert_eq!(
+            self.iter().collect::<Vec<_>>(),
+            other.iter().collect::<Vec<_>>(),
+            "self: {:#?} \n other: {:#?}\n",
+            self,
+            other
+        );
+    }
+
+    pub(crate) fn iter(
+        &self,
+    ) -> impl Iterator<Item = (InlineArray, InlineArray)> {
+        let prefix = self.prefix();
+        self.data.iter().map(|(k, v)| {
+            let mut unshifted_key = Vec::with_capacity(prefix.len() + k.len());
+            unshifted_key.extend_from_slice(prefix);
+            unshifted_key.extend_from_slice(k);
+            (unshifted_key.into(), v.clone())
+        })
+    }
+
+    pub(crate) fn serialize(&self, zstd_compression_level: i32) -> Vec<u8> {
+        let mut ret = vec![];
+
+        let mut zstd_enc 
```

**File**: `src/lib.rs` (modified, +1/-4)
```diff
@@ -1,10 +1,6 @@
 // 1.0 blockers
 //
 // bugs
-// * tree predecessor holds lock on successor and tries to get it for predecessor. This will
-//   deadlock if used concurrently with write batches, which acquire locks lexicographically.
-//   * add merges to iterator test and assert it deadlocks
-//   * alternative is to merge right, not left
 // * page-out needs to be deferred until after any flush of the dirty epoch
 //   * need to remove max_unflushed_epoch after flushing it
 //   * can't send reliable page-out request backwards from 7->6
@@ -25,6 +21,7 @@
 //     * clean -> dirty -> {maybe coop} -> flushed
 //   * for page-out, we only care if it's stable or if we need to add it to
 //     a page-out priority queue
+// * page-out doesn't seem to happen as expected
 //
 // reliability
 // TODO make all writes wrapped in a Tearable wrapper that splits writes
```

**File**: `src/object_cache.rs` (modified, +8/-2)
```diff
@@ -396,12 +396,12 @@ impl<const LEAF_FANOUT: usize> ObjectCache<LEAF_FANOUT> {
     // this being called in the destructor.
     pub fn mark_access_and_evict(
         &self,
-        object_id: ObjectId,
+        accessed_object_id: ObjectId,
         size: usize,
         #[allow(unused)] flush_epoch: FlushEpoch,
     ) -> io::Result<()> {
         let mut ca = self.cache_advisor.borrow_mut();
-        let to_evict = ca.accessed_reuse_buffer(*object_id, size);
+        let to_evict = ca.accessed_reuse_buffer(*accessed_object_id, size);
         let mut not_found = 0;
         for (node_to_evict, _rough_size) in to_evict {
             let object_id =
@@ -411,6 +411,12 @@ impl<const LEAF_FANOUT: usize> ObjectCache<LEAF_FANOUT> {
                     unreachable!("object ID must never have been 0");
                 };
 
+            if accessed_object_id == object_id {
+                // TODO our own object was evicted, so
+                // set page out after current epoch (or just page out if clean?)
+                continue;
+            }
+
             let node = if let Some(n) = self.object_id_index.get(&object_id) {
                 if *n.object_id != *node_to_evict {
                     continue;
```

**File**: `src/tree.rs` (modified, +22/-132)
```diff
@@ -2,7 +2,7 @@ use std::collections::{BTreeMap, VecDeque};
 use std::fmt;
 use std::hint;
 use std::io;
-use std::mem::{self, ManuallyDrop};
+use std::mem::ManuallyDrop;
 use std::ops;
 use std::ops::Bound;
 use std::ops::RangeBounds;
@@ -118,6 +118,9 @@ impl<const LEAF_FANOUT: usize> LeafWriteGuard<'_, LEAF_FANOUT> {
         self.flush_epoch_guard.epoch()
     }
 
+    // Handling cache access involves acquiring a mutex to anything
+    // that is being paged-out so that it can be dropped. We call
+    // this for things that we want to perform cache
     fn handle_cache_access_and_eviction_externally(
         mut self,
     ) -> (ObjectId, usize) {
@@ -209,15 +212,19 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
 
         let mut loops: u64 = 0;
         let mut last_continue = "none";
+        let mut warned = false;
 
         loop {
             loops += 1;
 
             if loops > 10_000_000 {
-                log::warn!(
-                    "page_in spinning for a long time due to continue point {}",
-                    last_continue
-                );
+                if !warned {
+                    log::warn!(
+                        "page_in spinning for a long time due to continue point {}",
+                        last_continue
+                    );
+                    warned = true;
+                }
 
                 #[cfg(feature = "for-internal-testing-only")]
                 assert!(
@@ -412,7 +419,7 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
         let successor_leaf = successor.leaf_write.leaf.as_mut().unwrap();
 
         assert!(predecessor_leaf.deleted.is_none());
-        assert!(predecessor_leaf.data.is_empty());
+        assert!(predecessor_leaf.is_empty());
         assert!(successor_leaf.deleted.is_none());
         assert_eq!(
             predecessor_leaf.hi.as_deref(),
@@ -441,9 +448,8 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
             );
         }
 
-        predecessor_leaf.hi = successor_leaf.hi.clone();
         predecessor_leaf.set_dirty_epoch(merge_epoch);
-        predecessor_leaf.data = std::mem::take(&mut successor_leaf.data);
+        predecessor_leaf.merge_from(successor_leaf.as_mut());
 
         successor_leaf.deleted = Some(merge_epoch);
 
@@ -966,7 +972,7 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
             }
 
             if cfg!(not(feature = "monotonic-behavior"))
-                && leaf.data.is_empty()
+                && leaf.is_empty()
                 && leaf.hi.is_some()
             {
                 self.merge_leaf_into_right_sibling(leaf_guard)?;
@@ -1149,7 +1155,7 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
         }
 
         if cfg!(not(feature = "monotonic-behavior"))
-            && leaf.data.is_empty()
+            && leaf.is_empty()
             && leaf.hi.is_some()
         {
             assert!(!split_happened);
@@ -1967,7 +1973,7 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
     /// # let db: sled::Db<1024> = config.open()?;
     /// db.insert(b"a", vec![0]);
     /// db.insert(b"b", vec![1]);
-    /// assert_eq!(db.len(), 2);
+    /// assert_eq!(db.len().unwrap(), 2);
     /// # Ok(()) }
     /// ```
     pub fn len(&self) -> io::Result<usize> {
@@ -2066,8 +2072,8 @@ impl<const LEAF_FANOUT: usize> Iterator for Iter<LEAF_FANOUT> {
                 continue;
             }
 
-            for (k, v) in leaf.data.iter() {
-                if self.bounds.contains(k) && &search_key <= k {
+            for (k, v) in leaf.iter() {
+                if self.bounds.contains(&k) && search_key <= k {
                     self.prefetched.push_back((k.clone(), v.clone()));
                 }
             }
@@ -2142,11 +2148,11 @@ impl<const LEAF_FANOUT: usize> DoubleEndedIterator for Iter<LEAF_FANOUT> {
                 continue;
             }
 
-            for (k, v) in leaf.data.iter() {
-                if self.bounds.contains(k) {
+            for (k, v) in leaf.iter() {
+    
```

**File**: `tests/00_regression.rs` (modified, +38/-12)
```diff
@@ -3,7 +3,7 @@ mod tree;
 
 use std::alloc::{Layout, System};
 
-use tree::{prop_tree_matches_btreemap, Key, Op::*};
+use tree::{Key, Op::*, prop_tree_matches_btreemap};
 
 #[global_allocator]
 static ALLOCATOR: ShredAllocator = ShredAllocator;
@@ -12,18 +12,22 @@ static ALLOCATOR: ShredAllocator = ShredAllocator;
 struct ShredAllocator;
 
 unsafe impl std::alloc::GlobalAlloc for ShredAllocator {
-    unsafe fn alloc(&self, layout: Layout) -> *mut u8 { unsafe {
-        assert!(layout.size() < 1_000_000_000);
-        let ret = System.alloc(layout);
-        assert_ne!(ret, std::ptr::null_mut());
-        std::ptr::write_bytes(ret, 0xa1, layout.size());
-        ret
-    }}
+    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
+        unsafe {
+            assert!(layout.size() < 1_000_000_000);
+            let ret = System.alloc(layout);
+            assert_ne!(ret, std::ptr::null_mut());
+            std::ptr::write_bytes(ret, 0xa1, layout.size());
+            ret
+        }
+    }
 
-    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) { unsafe {
-        std::ptr::write_bytes(ptr, 0xde, layout.size());
-        System.dealloc(ptr, layout)
-    }}
+    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
+        unsafe {
+            std::ptr::write_bytes(ptr, 0xde, layout.size());
+            System.dealloc(ptr, layout)
+        }
+    }
 }
 
 #[allow(dead_code)]
@@ -1638,3 +1642,25 @@ fn tree_bug_51() {
         0,
     );
 }
+
+#[test]
+#[cfg_attr(miri, ignore)]
+fn tree_bug_52() {
+    // postmortem:
+    prop_tree_matches_btreemap(
+        vec![
+            Set(Key(vec![57; 1]), 235),
+            Set(Key(vec![229; 1]), 136),
+            Set(Key(vec![]), 74),
+            Set(Key(vec![57; 2]), 0),
+            Get(Key(vec![57; 1])),
+            GetGt(Key(vec![57; 1])),
+            Get(Key(vec![57; 2])),
+            GetLt(Key(vec![57; 2])),
+            Scan(Key(vec![]), 4),
+        ],
+        false,
+        0,
+        0,
+    );
+}
```

---

### Incident Patch 5: `f6870e08` (2025-05-16)
**Commit Message**: Fix bug with prefix encoding in merges

**File**: `src/leaf.rs` (modified, +11/-2)
```diff
@@ -112,8 +112,8 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
         );
 
         let unshifted_key_amount = other.prefix_length - self.prefix_length;
-        let unshifted_prefix =
-            &other.lo[other.prefix_length - unshifted_key_amount..];
+        let unshifted_prefix = &other.lo
+            [other.prefix_length - unshifted_key_amount..other.prefix_length];
 
         for (k, v) in other.data.iter() {
             let mut unshifted_key =
@@ -124,6 +124,15 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
         }
 
         assert_eq!(other.data.len(), self.data.len());
+
+        #[cfg(feature = "for-internal-testing-only")]
+        assert_eq!(
+            self.iter().collect::<Vec<_>>(),
+            other.iter().collect::<Vec<_>>(),
+            "self: {:#?} \n other: {:#?}\n",
+            self,
+            other
+        );
     }
 
     pub(crate) fn iter(
```

---

### Incident Patch 6: `946fc3dc` (2025-05-16)
**Commit Message**: Keep debugging prefix compression

**File**: `src/leaf.rs` (modified, +16/-6)
```diff
@@ -87,11 +87,6 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
 
         self.hi = other.hi.clone();
 
-        if self.prefix() == other.prefix() {
-            self.data = std::mem::take(&mut other.data);
-            return;
-        }
-
         let new_prefix_len = if let Some(hi) = &self.hi {
             self.lo.iter().zip(hi.iter()).take_while(|(l, r)| l == r).count()
         } else {
@@ -104,7 +99,17 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
         // initialized here.
         self.prefix_length = new_prefix_len;
 
-        assert!(self.prefix_length < other.prefix_length);
+        if self.prefix() == other.prefix() {
+            self.data = std::mem::take(&mut other.data);
+            return;
+        }
+
+        assert!(
+            self.prefix_length < other.prefix_length,
+            "self: {:?} other: {:?}",
+            self,
+            other
+        );
 
         let unshifted_key_amount = other.prefix_length - self.prefix_length;
         let unshifted_prefix =
@@ -117,6 +122,8 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
             unshifted_key.extend_from_slice(k);
             self.data.insert(unshifted_key.into(), v.clone());
         }
+
+        assert_eq!(other.data.len(), self.data.len());
     }
 
     pub(crate) fn iter(
@@ -172,6 +179,8 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
         collection_id: CollectionId,
     ) -> Option<(InlineArray, Object<LEAF_FANOUT>)> {
         if self.data.is_full() {
+            let original_len = self.data.len();
+
             let old_prefix_len = self.prefix_length;
             // split
             let split_offset = if self.lo.is_empty() {
@@ -241,6 +250,7 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
 
             assert_eq!(self.hi.as_ref().unwrap(), &split_key);
             assert_eq!(rhs.lo, &split_key);
+            assert_eq!(rhs.data.len() + self.data.len(), original_len);
 
             let rhs_node = Object {
                 object_id: rhs_id,
```

**File**: `src/object_cache.rs` (modified, +5/-1)
```diff
@@ -411,7 +411,11 @@ impl<const LEAF_FANOUT: usize> ObjectCache<LEAF_FANOUT> {
                     unreachable!("object ID must never have been 0");
                 };
 
-            assert_ne!(accessed_object_id, object_id);
+            if accessed_object_id == object_id {
+                // TODO our own object was evicted, so
+                // set page out after current epoch (or just page out if clean?)
+                continue;
+            }
 
             let node = if let Some(n) = self.object_id_index.get(&object_id) {
                 if *n.object_id != *node_to_evict {
```

**File**: `src/tree.rs` (modified, +8/-4)
```diff
@@ -212,15 +212,19 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
 
         let mut loops: u64 = 0;
         let mut last_continue = "none";
+        let mut warned = false;
 
         loop {
             loops += 1;
 
             if loops > 10_000_000 {
-                log::warn!(
-                    "page_in spinning for a long time due to continue point {}",
-                    last_continue
-                );
+                if !warned {
+                    log::warn!(
+                        "page_in spinning for a long time due to continue point {}",
+                        last_continue
+                    );
+                    warned = true;
+                }
 
                 #[cfg(feature = "for-internal-testing-only")]
                 assert!(
```

---

### Incident Patch 7: `03a48d0d` (2025-05-16)
**Commit Message**: Fix bug with prefix compression

**File**: `src/leaf.rs` (modified, +8/-3)
```diff
@@ -200,7 +200,11 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
                 .count()
                 + 1;
 
-            let split_key = InlineArray::from(&right_min[..splitpoint_length]);
+            let mut split_vec =
+                Vec::with_capacity(self.prefix_length + splitpoint_length);
+            split_vec.extend_from_slice(self.prefix());
+            split_vec.extend_from_slice(&right_min[..splitpoint_length]);
+            let split_key = InlineArray::from(split_vec);
 
             let rhs_id = allocator.allocate_object_id(new_epoch);
 
@@ -272,9 +276,10 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
 
         assert!(
             new_prefix_len > old_prefix_len,
-            "expected new prefix length of {} to be greater than the pre-split prefix length of {}",
+            "expected new prefix length of {} to be greater than the pre-split prefix length of {} for node {:?}",
             new_prefix_len,
-            old_prefix_len
+            old_prefix_len,
+            self
         );
 
         let key_shift = new_prefix_len - old_prefix_len;
```

**File**: `tests/00_regression.rs` (modified, +1/-1)
```diff
@@ -1657,7 +1657,7 @@ fn tree_bug_52() {
             GetGt(Key(vec![57; 1])),
             Get(Key(vec![57; 2])),
             GetLt(Key(vec![57; 2])),
-            //Scan(Key(vec![]), 4),
+            Scan(Key(vec![]), 4),
         ],
         false,
         0,
```

---

### Incident Patch 8: `6390980d` (2025-05-16)
**Commit Message**: Implement prefix compression on btree nodes

**File**: `src/leaf.rs` (modified, +207/-15)
```diff
@@ -5,7 +5,7 @@ pub(crate) struct Leaf<const LEAF_FANOUT: usize> {
     pub lo: InlineArray,
     pub hi: Option<InlineArray>,
     pub prefix_length: usize,
-    pub data: stack_map::StackMap<InlineArray, InlineArray, LEAF_FANOUT>,
+    data: stack_map::StackMap<InlineArray, InlineArray, LEAF_FANOUT>,
     pub in_memory_size: usize,
     pub mutation_count: u64,
     #[serde(skip)]
@@ -58,13 +58,8 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
 
     pub(crate) fn get(&self, key: &[u8]) -> Option<&InlineArray> {
         assert!(self.deleted.is_none());
-        let prefixed_key = if self.prefix_length == 0 {
-            key
-        } else {
-            let prefix = self.prefix();
-            assert!(key.starts_with(prefix));
-            &key[self.prefix_length..]
-        };
+        assert!(key.starts_with(self.prefix()));
+        let prefixed_key = &key[self.prefix_length..];
         self.data.get(prefixed_key)
     }
 
@@ -74,13 +69,8 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
         value: InlineArray,
     ) -> Option<InlineArray> {
         assert!(self.deleted.is_none());
-        let prefixed_key = if self.prefix_length == 0 {
-            key
-        } else {
-            let prefix = self.prefix();
-            assert!(key.starts_with(prefix));
-            key[self.prefix_length..].into()
-        };
+        assert!(key.starts_with(self.prefix()));
+        let prefixed_key = key[self.prefix_length..].into();
         self.data.insert(prefixed_key, value)
     }
 
@@ -91,4 +81,206 @@ impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
         let partial_key = &key[self.prefix_length..];
         self.data.remove(partial_key)
     }
+
+    pub(crate) fn merge_from(&mut self, other: &mut Self) {
+        assert!(self.is_empty());
+
+        self.hi = other.hi.clone();
+
+        if self.prefix() == other.prefix() {
+            self.data = std::mem::take(&mut other.data);
+            return;
+        }
+
+        let new_prefix_len = if let Some(hi) = &self.hi {
+            self.lo.iter().zip(hi.iter()).take_while(|(l, r)| l == r).count()
+        } else {
+            0
+        };
+
+        assert_eq!(self.lo[..new_prefix_len], other.lo[..new_prefix_len]);
+
+        // self.prefix_length is not read because it's expected to be
+        // initialized here.
+        self.prefix_length = new_prefix_len;
+
+        assert!(self.prefix_length < other.prefix_length);
+
+        let unshifted_key_amount = other.prefix_length - self.prefix_length;
+        let unshifted_prefix =
+            &other.lo[other.prefix_length - unshifted_key_amount..];
+
+        for (k, v) in other.data.iter() {
+            let mut unshifted_key =
+                Vec::with_capacity(unshifted_prefix.len() + k.len());
+            unshifted_key.extend_from_slice(unshifted_prefix);
+            unshifted_key.extend_from_slice(k);
+            self.data.insert(unshifted_key.into(), v.clone());
+        }
+    }
+
+    pub(crate) fn iter(
+        &self,
+    ) -> impl Iterator<Item = (InlineArray, InlineArray)> {
+        let prefix = self.prefix();
+        self.data.iter().map(|(k, v)| {
+            let mut unshifted_key = Vec::with_capacity(prefix.len() + k.len());
+            unshifted_key.extend_from_slice(prefix);
+            unshifted_key.extend_from_slice(k);
+            (unshifted_key.into(), v.clone())
+        })
+    }
+
+    pub(crate) fn serialize(&self, zstd_compression_level: i32) -> Vec<u8> {
+        let mut ret = vec![];
+
+        let mut zstd_enc =
+            zstd::stream::Encoder::new(&mut ret, zstd_compression_level)
+                .unwrap();
+
+        bincode::serialize_into(&mut zstd_enc, self).unwrap();
+
+        zstd_enc.finish().unwrap();
+
+        ret
+    }
+
+    pub(crate) fn deserialize(
+        buf: &[u8],
+    ) -> std::io::Result<Box<Leaf<LEAF_FANOUT>>> {
+        let zstd_decoded = zstd::stream::decode_all(buf).unwrap();
+        let mut leaf: Box<Leaf<LEAF_FANO
```

**File**: `src/lib.rs` (modified, +1/-4)
```diff
@@ -1,10 +1,6 @@
 // 1.0 blockers
 //
 // bugs
-// * tree predecessor holds lock on successor and tries to get it for predecessor. This will
-//   deadlock if used concurrently with write batches, which acquire locks lexicographically.
-//   * add merges to iterator test and assert it deadlocks
-//   * alternative is to merge right, not left
 // * page-out needs to be deferred until after any flush of the dirty epoch
 //   * need to remove max_unflushed_epoch after flushing it
 //   * can't send reliable page-out request backwards from 7->6
@@ -25,6 +21,7 @@
 //     * clean -> dirty -> {maybe coop} -> flushed
 //   * for page-out, we only care if it's stable or if we need to add it to
 //     a page-out priority queue
+// * page-out doesn't seem to happen as expected
 //
 // reliability
 // TODO make all writes wrapped in a Tearable wrapper that splits writes
```

**File**: `src/object_cache.rs` (modified, +4/-2)
```diff
@@ -396,12 +396,12 @@ impl<const LEAF_FANOUT: usize> ObjectCache<LEAF_FANOUT> {
     // this being called in the destructor.
     pub fn mark_access_and_evict(
         &self,
-        object_id: ObjectId,
+        accessed_object_id: ObjectId,
         size: usize,
         #[allow(unused)] flush_epoch: FlushEpoch,
     ) -> io::Result<()> {
         let mut ca = self.cache_advisor.borrow_mut();
-        let to_evict = ca.accessed_reuse_buffer(*object_id, size);
+        let to_evict = ca.accessed_reuse_buffer(*accessed_object_id, size);
         let mut not_found = 0;
         for (node_to_evict, _rough_size) in to_evict {
             let object_id =
@@ -411,6 +411,8 @@ impl<const LEAF_FANOUT: usize> ObjectCache<LEAF_FANOUT> {
                     unreachable!("object ID must never have been 0");
                 };
 
+            assert_ne!(accessed_object_id, object_id);
+
             let node = if let Some(n) = self.object_id_index.get(&object_id) {
                 if *n.object_id != *node_to_evict {
                     continue;
```

**File**: `src/tree.rs` (modified, +13/-127)
```diff
@@ -2,7 +2,7 @@ use std::collections::{BTreeMap, VecDeque};
 use std::fmt;
 use std::hint;
 use std::io;
-use std::mem::{self, ManuallyDrop};
+use std::mem::ManuallyDrop;
 use std::ops;
 use std::ops::Bound;
 use std::ops::RangeBounds;
@@ -118,6 +118,9 @@ impl<const LEAF_FANOUT: usize> LeafWriteGuard<'_, LEAF_FANOUT> {
         self.flush_epoch_guard.epoch()
     }
 
+    // Handling cache access involves acquiring a mutex to anything
+    // that is being paged-out so that it can be dropped. We call
+    // this for things that we want to perform cache
     fn handle_cache_access_and_eviction_externally(
         mut self,
     ) -> (ObjectId, usize) {
@@ -412,7 +415,7 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
         let successor_leaf = successor.leaf_write.leaf.as_mut().unwrap();
 
         assert!(predecessor_leaf.deleted.is_none());
-        assert!(predecessor_leaf.data.is_empty());
+        assert!(predecessor_leaf.is_empty());
         assert!(successor_leaf.deleted.is_none());
         assert_eq!(
             predecessor_leaf.hi.as_deref(),
@@ -441,9 +444,8 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
             );
         }
 
-        predecessor_leaf.hi = successor_leaf.hi.clone();
         predecessor_leaf.set_dirty_epoch(merge_epoch);
-        predecessor_leaf.data = std::mem::take(&mut successor_leaf.data);
+        predecessor_leaf.merge_from(successor_leaf.as_mut());
 
         successor_leaf.deleted = Some(merge_epoch);
 
@@ -966,7 +968,7 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
             }
 
             if cfg!(not(feature = "monotonic-behavior"))
-                && leaf.data.is_empty()
+                && leaf.is_empty()
                 && leaf.hi.is_some()
             {
                 self.merge_leaf_into_right_sibling(leaf_guard)?;
@@ -1149,7 +1151,7 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
         }
 
         if cfg!(not(feature = "monotonic-behavior"))
-            && leaf.data.is_empty()
+            && leaf.is_empty()
             && leaf.hi.is_some()
         {
             assert!(!split_happened);
@@ -2066,8 +2068,8 @@ impl<const LEAF_FANOUT: usize> Iterator for Iter<LEAF_FANOUT> {
                 continue;
             }
 
-            for (k, v) in leaf.data.iter() {
-                if self.bounds.contains(k) && &search_key <= k {
+            for (k, v) in leaf.iter() {
+                if self.bounds.contains(&k) && search_key <= k {
                     self.prefetched.push_back((k.clone(), v.clone()));
                 }
             }
@@ -2142,11 +2144,11 @@ impl<const LEAF_FANOUT: usize> DoubleEndedIterator for Iter<LEAF_FANOUT> {
                 continue;
             }
 
-            for (k, v) in leaf.data.iter() {
-                if self.bounds.contains(k) {
+            for (k, v) in leaf.iter() {
+                if self.bounds.contains(&k) {
                     let beneath_last_lo =
                         if let Some(last_lo) = &self.next_back_last_lo {
-                            k < last_lo
+                            &k < last_lo
                         } else {
                             true
                         };
@@ -2242,119 +2244,3 @@ impl Batch {
         Some(inner.as_ref())
     }
 }
-
-impl<const LEAF_FANOUT: usize> Leaf<LEAF_FANOUT> {
-    pub fn serialize(&self, zstd_compression_level: i32) -> Vec<u8> {
-        let mut ret = vec![];
-
-        let mut zstd_enc =
-            zstd::stream::Encoder::new(&mut ret, zstd_compression_level)
-                .unwrap();
-
-        bincode::serialize_into(&mut zstd_enc, self).unwrap();
-
-        zstd_enc.finish().unwrap();
-
-        ret
-    }
-
-    fn deserialize(buf: &[u8]) -> io::Result<Box<Leaf<LEAF_FANOUT>>> {
-        let zstd_decoded = zstd::stream::decode_all(buf).unwrap();
-        let mut leaf: Box<Leaf<LEAF_FANOUT>> =
-            bincode::deserialize(&zstd_decoded).unwrap();
-
-        // use decompressed buffer length as a cheap prox
```

**File**: `tests/00_regression.rs` (modified, +38/-12)
```diff
@@ -3,7 +3,7 @@ mod tree;
 
 use std::alloc::{Layout, System};
 
-use tree::{prop_tree_matches_btreemap, Key, Op::*};
+use tree::{Key, Op::*, prop_tree_matches_btreemap};
 
 #[global_allocator]
 static ALLOCATOR: ShredAllocator = ShredAllocator;
@@ -12,18 +12,22 @@ static ALLOCATOR: ShredAllocator = ShredAllocator;
 struct ShredAllocator;
 
 unsafe impl std::alloc::GlobalAlloc for ShredAllocator {
-    unsafe fn alloc(&self, layout: Layout) -> *mut u8 { unsafe {
-        assert!(layout.size() < 1_000_000_000);
-        let ret = System.alloc(layout);
-        assert_ne!(ret, std::ptr::null_mut());
-        std::ptr::write_bytes(ret, 0xa1, layout.size());
-        ret
-    }}
+    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
+        unsafe {
+            assert!(layout.size() < 1_000_000_000);
+            let ret = System.alloc(layout);
+            assert_ne!(ret, std::ptr::null_mut());
+            std::ptr::write_bytes(ret, 0xa1, layout.size());
+            ret
+        }
+    }
 
-    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) { unsafe {
-        std::ptr::write_bytes(ptr, 0xde, layout.size());
-        System.dealloc(ptr, layout)
-    }}
+    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
+        unsafe {
+            std::ptr::write_bytes(ptr, 0xde, layout.size());
+            System.dealloc(ptr, layout)
+        }
+    }
 }
 
 #[allow(dead_code)]
@@ -1638,3 +1642,25 @@ fn tree_bug_51() {
         0,
     );
 }
+
+#[test]
+#[cfg_attr(miri, ignore)]
+fn tree_bug_52() {
+    // postmortem:
+    prop_tree_matches_btreemap(
+        vec![
+            Set(Key(vec![57; 1]), 235),
+            Set(Key(vec![229; 1]), 136),
+            Set(Key(vec![]), 74),
+            Set(Key(vec![57; 2]), 0),
+            Get(Key(vec![57; 1])),
+            GetGt(Key(vec![57; 1])),
+            Get(Key(vec![57; 2])),
+            GetLt(Key(vec![57; 2])),
+            //Scan(Key(vec![]), 4),
+        ],
+        false,
+        0,
+        0,
+    );
+}
```

---

### Incident Patch 9: `86cc5a09` (2025-05-13)
**Commit Message**: Fix tests

**File**: `src/tree.rs` (modified, +1/-1)
```diff
@@ -1967,7 +1967,7 @@ impl<const LEAF_FANOUT: usize> Tree<LEAF_FANOUT> {
     /// # let db: sled::Db<1024> = config.open()?;
     /// db.insert(b"a", vec![0]);
     /// db.insert(b"b", vec![1]);
-    /// assert_eq!(db.len(), 2);
+    /// assert_eq!(db.len().unwrap(), 2);
     /// # Ok(()) }
     /// ```
     pub fn len(&self) -> io::Result<usize> {
```

**File**: `tests/test_tree_failpoints.rs` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-#![cfg(feature = "for-internal-testing-only")]
+#![cfg(feature = "failpoints")]
 mod common;
 
 use std::collections::BTreeMap;
```

---

### Incident Patch 10: `869009aa` (2025-05-12)
**Commit Message**: Fix tests

**File**: `tests/test_tree.rs` (modified, +3/-3)
```diff
@@ -104,7 +104,7 @@ fn fixed_stride_inserts() {
         count += 1;
     }
     assert_eq!(count, 4096, "tree: {:?}", db);
-    assert_eq!(db.len(), 4096);
+    assert_eq!(db.len().unwrap(), 4096);
 
     let count = db.iter().rev().count();
     assert_eq!(count, 4096);
@@ -118,7 +118,7 @@ fn fixed_stride_inserts() {
 
     let count = db.iter().rev().count();
     assert_eq!(count, 4096);
-    assert_eq!(db.len(), 4096);
+    assert_eq!(db.len().unwrap(), 4096);
 
     for k in 0..4096_u16 {
         db.remove(&k.to_be_bytes()).unwrap();
@@ -129,7 +129,7 @@ fn fixed_stride_inserts() {
 
     let count = db.iter().rev().count();
     assert_eq!(count, 0);
-    assert_eq!(db.len(), 0);
+    assert_eq!(db.len().unwrap(), 0);
     assert!(db.is_empty().unwrap());
 }
 
```

#### Recent Merged Pull Requests:
- **PR #1537** (2026-04-04): Fix stale snapshot removal log message (@cuiweixie)
- **PR #1535** (2025-11-04): Update README.md (@spacejam)
- **PR #1525** (2025-05-16): [bloodstone] implement prefix encoding (@spacejam)
- **PR #1523** (2025-05-11): [bloodstone] merge empty leaf with right sibling, consuming right sibling (@spacejam)
- **PR #1516** (closed): Fix indentation in markdown list (@TannerRogalsky)
- **PR #1499** (closed): Remove implicit `Sized` bound on `Tree::range` and others (@Rafferty97)
- **PR #1495** (closed): tempdir is deprecated, use tempfile instead (@freedit-dev)
- **PR #1492** (closed): Lossy signature for Tree::set_merge_operator (@RuofengX)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
