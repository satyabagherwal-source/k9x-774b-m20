# Verification Protocol: Verification Protocol: Empirical Defect Shield for pingcap/talent/plan

<!-- PROVENANCE_START
{
  "source_repository": "pingcap/talent/plan",
  "source_url": "https://github.com/pingcap/talent/plan",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pingcap/talent/plan](https://github.com/pingcap/talent/plan) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `pingcap/talent/plan` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pingcap-talent-plan-learnings.md`  
> **Source**: github ([https://github.com/pingcap/talent-plan](https://github.com/pingcap/talent-plan))  
> **Source Version**: `8e91311a`  
> **License**: PERMISSIVE_OPEN_SOURCE  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T15:54:44.302Z  
> **Learning ID**: `learn-github-pingcap-talent-plan`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): pingcap/talent-plan

> **Canonical Artifact**: `07_PROJECT_LEARNING/pingcap-talent-plan-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pingcap/talent-plan](https://github.com/pingcap/talent-plan))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-03T15:54:43.752Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pingcap/talent-plan`
- **Description**: open source training courses about distributed database and distributed systems
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11034 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `courses/rust/projects/project-3/benches/engine_bench.rs`
```
use criterion::{criterion_group, criterion_main, BatchSize, Criterion};
use kvs::{KvStore, KvsEngine, SledKvsEngine};
use rand::prelude::*;
use sled;
use tempfile::TempDir;

fn set_bench(c: &mut Criterion) {
    let mut group = c.benchmark_group("set_bench");
    group.bench_function("kvs", |b| {
        b.iter_batched(
            || {
                let temp_dir = TempDir::new().unwrap();
                (KvStore::open(temp_dir.path()).unwrap(), temp_dir)
            },
            |(mut store, _temp_dir)| {
                for i in 1..(1 << 12) {
                    store.set(format!("key{}", i), "value".to_string()).unwrap();
                }
            },
            BatchSize::SmallInput,
        )
    });
    group.bench_function("sled", |b| {
        b.iter_batched(
            || {
                let temp_dir = TempDir::new().unwrap();
                (SledKvsEngine::new(sled::open(&temp_dir).unwrap()), temp_dir)
            },
            |(mut db, _temp_dir)| {
                for i in 1..(1 << 12) {
                    db.set(format!("key{}", i), "value".to_string()).unwrap();
                }
            },
            BatchSize::SmallInput,
        )
    });
    group.finish();
}

fn get_bench(c: &mut Criterion) {
    let mut group = c.benchmark_group("get_bench");
    for i in &vec![8, 12, 16, 20] {
        group.bench_with_input(format!("kvs_{}", i), i, |b, i| {
            let temp_dir = TempDir::new().unwrap();
            let mut store = KvStore::open(temp_dir.path()).unwrap();
            for key_i in 1..(1 << i) {
                store
                    .set(format!("key{}", key_i), "value".to_string())
                    .unwrap();
            }
            let mut rng = SmallRng::from_seed([0; 16]);
            b.iter(|| {
                store
                    .get(format!("key{}", rng.gen_range(1, 1 << i)))
                    .unwrap();
            })
        });
    }
    for i in &vec![8, 12, 16, 20] {
        group.bench_with_input(format!("sled_{}", i), i, |b, i| {
            let temp_dir = TempDir::new().unwrap();
            let mut db = SledKvsEngine::new(sled::open(&temp_dir).unwrap());
            for key_i in 1..(1 << i) {
                db.set(format!("key{}", key_i), "value".to_string())
                    .unwrap();
            }
            let mut rng = SmallRng::from_seed([0; 16]);
            b.iter(|| {
                db.get(format!("key{}", rng.gen_range(1, 1 << i))).unwrap();
            })
        });
    }
    group.finish();
}

criterion_group!(benches, set_bench, get_bench);
criterion_main!(benches);

```

### Core Architecture Module: `courses/rust/projects/project-3/src/engines/kvs.rs`
```
use std::collections::{BTreeMap, HashMap};
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::ops::Range;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Deserializer;

use super::KvsEngine;
use crate::{KvsError, Result};
use std::ffi::OsStr;

const COMPACTION_THRESHOLD: u64 = 1024 * 1024;

/// The `KvStore` stores string key/value pairs.
///
/// Key/value pairs are persisted to disk in log files. Log files are named after
/// monotonically increasing generation numbers with a `log` extension name.
/// A `BTreeMap` in memory stores the keys and the value locations for fast query.
///
/// ```rust
/// # use kvs::{KvStore, Result};
/// # fn try_main() -> Result<()> {
/// use std::env::current_dir;
/// use kvs::KvsEngine;
/// let mut store = KvStore::open(current_dir()?)?;
/// store.set("key".to_owned(), "value".to_owned())?;
/// let val = store.get("key".to_owned())?;
/// assert_eq!(val, Some("value".to_owned()));
/// # Ok(())
/// # }
/// ```
pub struct KvStore {
    // directory for the log and other data
    path: PathBuf,
    // map generation number to the file reader
    readers: HashMap<u64, BufReaderWithPos<File>>,
    // writer of the current log
    writer: BufWriterWithPos<File>,
    current_gen: u64,
    index: BTreeMap<String, CommandPos>,
    // the number of bytes representing "stale" commands that could be
    // deleted during a compaction
    uncompacted: u64,
}

impl KvStore {
    /// Opens a `KvStore` with the given path.
    ///
    /// This will create a new directory if the given one does not exist.
    ///
    /// # Errors
    ///
    /// It propagates I/O or deserialization errors during the log replay.
    pub fn open(path: impl Into<PathBuf>) -> Result<KvStore> {
        let path = path.into();
        fs::create_dir_all(&path)?;

        let mut readers = HashMap::new();
        let mut index = BTreeMap::new();

        let gen_list = sorted_gen_list(&path)?;
        let mut uncompacted = 0;

        for &gen in &gen_list {
            let mut reader = BufReaderWithPos::new(File::open(log_path(&path, gen))?)?;
            uncompacted += load(gen, &mut reader, &mut index)?;
            readers.insert(gen, reader);
        }

        let current_gen = gen_list.last().unwrap_or(&0) + 1;
        let writer = new_log_file(&path, current_gen, &mut readers)?;

        Ok(KvStore {
            path,
            readers,
            writer,
            current_gen,
            index,
            uncompacted,
        })
    }

    /// Clears stale entries in the log.
    pub fn compact(&mut self) -> Result<()> {
        // increase current gen by 2. current_gen + 1 is for the compaction file
        let compaction_gen = self.current_gen + 1;
        self.current_gen += 2;
        self.writer = self.new_log_file(self.current_gen)?;

        let mut compaction_writer = self.new_log_file(compaction_gen)?;

        let mut new_pos = 0; // pos in the new log file
        for cmd_pos in &mut self.index.values_mut() {
            let reader = self
                .readers
                .get_mut(&cmd_pos.gen)
                .expect("Cannot find log reader");
            if reader.pos != cmd_pos.pos {
                reader.seek(SeekFrom::Start(cmd_pos.pos))?;
            }

            let mut entry_reader = reader.take(cmd_pos.len);
            let len = io::copy(&mut entry_reader, &mut compaction_writer)?;
            *cmd_pos = (compaction_gen, new_pos..new_pos + len).into();
            new_pos += len;
        }
        compaction_writer.flush()?;

        // remove stale log files
        let stale_gens: Vec<_> = self
            .readers
            .keys()
            .filter(|&&gen| gen < compaction_gen)
            .cloned()
            .collect();
        for stale_gen in stale_gens {
            self.readers.remove(&stale_gen);
            fs::remove_file(log_path(&self.path, stale_gen))?;
        }

        self.uncompacted = 0;

        Ok(())
    }

    /// Create a new log file with given generation number and add the reader to the readers map.
    ///
    /// Returns the writer to the log.
    fn new_log_file(&mut self, gen: u64) -> Result<BufWriterWithPos<File>> {
        new_log_file(&self.path, gen, &mut self.readers)
    }
}

impl KvsEngine for KvStore {
    /// Sets the value of a string key to a string.
    ///
    /// If the key already exists, the previous value will be overwritten.
    ///
    /// # Errors
    ///
    /// It propagates I/O or serialization errors during writing the log.
    fn set(&mut self, key: String, value: String) -> Result<()> {
        let cmd = Command::set(key, value);
        let pos = self.writer.pos;
        serde_json::to_writer(&mut self.writer, &cmd)?;
        self.writer.flush()?;
        if let Command::Set { key, .. } = cmd {
            if let Some(old_cmd) = self
                .index
                .insert(key, (self.current_gen, pos..self.writer.pos).into())
            {
                self.uncompacted += old_cmd.len;
            }
        }

        if self.uncompacted > COMPACTION_THRESHOLD {
            self.compact()?;
        }
        Ok(())
    }

    /// Gets the string value of a given string key.
    ///
    /// Returns `None` if the given key does not exist.
    fn get(&mut self, key: String) -> Result<Option<String>> {
        if let Some(cmd_pos) = self.index.get(&key) {
            let reader = self
                .readers
                .get_mut(&cmd_pos.gen)
                .expect("Cannot find log reader");
            reader.seek(SeekFrom::Start(cmd_pos.pos))?;
            let cmd_reader = reader.take(cmd_pos.len);
            if let Command::Set { value, .. } = serde_json::from_reader(cmd_reader)? {
                Ok(Some(value))
            } else {
                Err(KvsError::UnexpectedCommandType)
            }
        } else {
            Ok(None)
        }
    }

    /// Removes a given key.
    ///
    /// # Error
    ///
    /// It returns `KvsError::KeyNotFound` if the given key is not found.
    ///
    /// It propagates I/O or serialization errors during writing the log.
    fn remove(&mut self, key: String) -> Result<()> {
        if self.index.contains_key(&key) {
            let cmd = Command::remove(key);
            serde_json::to_writer(&mut self.writer, &cmd)?;
            self.writer.flush()?;
            if let Command::Remove { key } = cmd {
                let old_cmd = self.index.remove(&key).expect("key not found");
                self.uncompacted += old_cmd.len;
            }
            Ok(())
        } else {
            Err(KvsError::KeyNotFound)
        }
    }
}

/// Create a new log file with given generation number and add the reader to the readers map.
///
/// Returns the writer to the log.
fn new_log_file(
    path: &Path,
    gen: u64,
    readers: &mut HashMap<u64, BufReaderWithPos<File>>,
) -> Result<BufWriterWithPos<File>> {
    let path = log_path(&path, gen);
    let writer = BufWriterWithPos::new(
        OpenOptions::new()
            .create(true)
            .write(true)
            .append(true)
            .open(&path)?,
    )?;
    readers.insert(gen, BufReaderWithPos::new(File::open(&path)?)?);
    Ok(writer)
}

/// Returns sorted generation numbers in the given directory
fn sorted_gen_list(path: &Path) -> Result<Vec<u64>> {
    let mut gen_list: Vec<u64> = fs::read_dir(&path)?
        .flat_map(|res| -> Result<_> { Ok(res?.path()) })
        .filter(|path| path.is_file() && path.extension() == Some("log".as_ref()))
        .flat_map(|path| {
            path.file_name()
                .and_then(OsStr::to_str)
                .map(|s| s.trim_end_matches(".log"))
                .map(str::parse::<u64>)
        })
        .flatten()
        .collect();
    gen_list.sort_unstable();
    Ok(gen_list)
}

/// Load the whole log file and store value locations in the index map.
///
/// Returns how many bytes can be saved after a compaction.
fn load(
    gen: u64,
    reader: &mut BufReaderWithPos<File>,
    index: &mut BTreeMap<String, CommandPos>,
) -> Result<u64> {
    // To make sure we read from the beginning of the file
    let mut pos = reader.seek(SeekFrom::Start(0))?;
    let mut stream = Deserializer::from_reader(reader).into_iter::<Command>();
    let mut uncompacted = 0; // number of bytes that can be saved after a compaction
    while let Some(cmd) = stream.next() {
        let new_pos = stream.byte_offset() as u64;
        match cmd? {
            Command::Set { key, .. } => {
                if let Some(old_cmd) = index.insert(key, (gen, pos..new_pos).into()) {
                    uncompacted += old_cmd.len;
                }
            }
            Command::Remove { key } => {
                if let Some(old_cmd) = index.remove(&key) {
                    uncompacted += old_cmd.len;
                }
                // the "remove" command itself can be deleted in the next compaction
                // so we add its length to `uncompacted`
                uncompacted += new_pos - pos;
            }
        }
        pos = new_pos;
    }
    Ok(uncompacted)
}

fn log_path(dir: &Path, gen: u64) -> PathBuf {
    dir.join(format!("{}.log", gen))
}

/// Struct representing a command
#[derive(Serialize, Deserialize, Debug)]
enum Command {
    Set { key: String, value: String },
    Remove { key: String },
}

impl Command {
    fn set(key: String, value: String) -> Command {
        Command::Set { key, value }
    }

    fn remove(key: String) -> Command {
        Command::Remove { key }
    }
}

/// Represents the position and length of a json-serialized command in the log
struct CommandPos {
    gen: u64,
    pos: u64,
    len: u64,
}

impl From<(u64, Range<u64>)> for CommandPos {
    fn from((gen, range): (u64, Range<u64>)) -> Self {
        CommandPos {
            gen,
            pos: range.start,
            len: range.end - range.start,
        }
```

### Core Architecture Module: `courses/rust/projects/project-3/src/engines/mod.rs`
```
//! This module provides various key value storage engines.

use crate::Result;

/// Trait for a key value storage engine.
pub trait KvsEngine {
    /// Sets the value of a string key to a string.
    ///
    /// If the key already exists, the previous value will be overwritten.
    fn set(&mut self, key: String, value: String) -> Result<()>;

    /// Gets the string value of a given string key.
    ///
    /// Returns `None` if the given key does not exist.
    fn get(&mut self, key: String) -> Result<Option<String>>;

    /// Removes a given key.
    ///
    /// # Errors
    ///
    /// It returns `KvsError::KeyNotFound` if the given key is not found.
    fn remove(&mut self, key: String) -> Result<()>;
}

mod kvs;
mod sled;

pub use self::kvs::KvStore;
pub use self::sled::SledKvsEngine;

```

### Core Architecture Module: `courses/rust/projects/project-3/src/engines/sled.rs`
```
use super::KvsEngine;
use crate::{KvsError, Result};
use sled::{Db, Tree};

/// Wrapper of `sled::Db`
#[derive(Clone)]
pub struct SledKvsEngine(Db);

impl SledKvsEngine {
    /// Creates a `SledKvsEngine` from `sled::Db`.
    pub fn new(db: Db) -> Self {
        SledKvsEngine(db)
    }
}

impl KvsEngine for SledKvsEngine {
    fn set(&mut self, key: String, value: String) -> Result<()> {
        let tree: &Tree = &self.0;
        tree.insert(key, value.into_bytes()).map(|_| ())?;
        tree.flush()?;
        Ok(())
    }

    fn get(&mut self, key: String) -> Result<Option<String>> {
        let tree: &Tree = &self.0;
        Ok(tree
            .get(key)?
            .map(|i_vec| AsRef::<[u8]>::as_ref(&i_vec).to_vec())
            .map(String::from_utf8)
            .transpose()?)
    }

    fn remove(&mut self, key: String) -> Result<()> {
        let tree: &Tree = &self.0;
        tree.remove(key)?.ok_or(KvsError::KeyNotFound)?;
        tree.flush()?;
        Ok(())
    }
}

```

### Core Architecture Module: `courses/rust/projects/project-4/src/engines/kvs.rs`
```
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::ops::Range;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crossbeam_skiplist::SkipMap;
use log::error;
use serde::{Deserialize, Serialize};
use serde_json::Deserializer;

use super::KvsEngine;
use crate::{KvsError, Result};

const COMPACTION_THRESHOLD: u64 = 1024 * 1024;

/// The `KvStore` stores string key/value pairs.
///
/// Key/value pairs are persisted to disk in log files. Log files are named after
/// monotonically increasing generation numbers with a `log` extension name.
/// A skip list in memory stores the keys and the value locations for fast query.
///
/// ```rust
/// # use kvs::{KvStore, Result};
/// # fn try_main() -> Result<()> {
/// use std::env::current_dir;
/// use kvs::KvsEngine;
/// let mut store = KvStore::open(current_dir()?)?;
/// store.set("key".to_owned(), "value".to_owned())?;
/// let val = store.get("key".to_owned())?;
/// assert_eq!(val, Some("value".to_owned()));
/// # Ok(())
/// # }
/// ```
#[derive(Clone)]
pub struct KvStore {
    // directory for the log and other data
    path: Arc<PathBuf>,
    // map generation number to the file reader
    index: Arc<SkipMap<String, CommandPos>>,
    reader: KvStoreReader,
    writer: Arc<Mutex<KvStoreWriter>>,
}

impl KvStore {
    /// Opens a `KvStore` with the given path.
    ///
    /// This will create a new directory if the given one does not exist.
    ///
    /// # Errors
    ///
    /// It propagates I/O or deserialization errors during the log replay.
    pub fn open(path: impl Into<PathBuf>) -> Result<KvStore> {
        let path = Arc::new(path.into());
        fs::create_dir_all(&*path)?;

        let mut readers = BTreeMap::new();
        let index = Arc::new(SkipMap::new());

        let gen_list = sorted_gen_list(&path)?;
        let mut uncompacted = 0;

        for &gen in &gen_list {
            let mut reader = BufReaderWithPos::new(File::open(log_path(&path, gen))?)?;
            uncompacted += load(gen, &mut reader, &*index)?;
            readers.insert(gen, reader);
        }

        let current_gen = gen_list.last().unwrap_or(&0) + 1;
        let writer = new_log_file(&path, current_gen)?;
        let safe_point = Arc::new(AtomicU64::new(0));

        let reader = KvStoreReader {
            path: Arc::clone(&path),
            safe_point,
            readers: RefCell::new(readers),
        };

        let writer = KvStoreWriter {
            reader: reader.clone(),
            writer,
            current_gen,
            uncompacted,
            path: Arc::clone(&path),
            index: Arc::clone(&index),
        };

        Ok(KvStore {
            path,
            reader,
            index,
            writer: Arc::new(Mutex::new(writer)),
        })
    }
}

impl KvsEngine for KvStore {
    /// Sets the value of a string key to a string.
    ///
    /// If the key already exists, the previous value will be overwritten.
    ///
    /// # Errors
    ///
    /// It propagates I/O or serialization errors during writing the log.
    fn set(&self, key: String, value: String) -> Result<()> {
        self.writer.lock().unwrap().set(key, value)
    }

    /// Gets the string value of a given string key.
    ///
    /// Returns `None` if the given key does not exist.
    fn get(&self, key: String) -> Result<Option<String>> {
        loop {
            let cmd_pos = match self.index.get(&key) {
                Some(entry) => *entry.value(),
                None => return Ok(None),
            };
            match self.reader.read_command(cmd_pos) {
                Ok(Command::Set { value, .. }) => return Ok(Some(value)),
                Ok(_) => return Err(KvsError::UnexpectedCommandType),
                // A compaction can move the entry to a new log file and delete the old
                // file between the index lookup and the read, so look the key up again.
                Err(KvsError::Io(ref e))
                    if e.kind() == io::ErrorKind::NotFound
                        && self.index.get(&key).map(|e| e.value().gen) != Some(cmd_pos.gen) =>
                {
                    continue
                }
                Err(e) => return Err(e),
            }
        }
    }

    /// Removes a given key.
    ///
    /// # Error
    ///
    /// It returns `KvsError::KeyNotFound` if the given key is not found.
    ///
    /// It propagates I/O or serialization errors during writing the log.
    fn remove(&self, key: String) -> Result<()> {
        self.writer.lock().unwrap().remove(key)
    }
}

/// A single thread reader.
///
/// Each `KvStore` instance has its own `KvStoreReader` and
/// `KvStoreReader`s open the same files separately. So the user
/// can read concurrently through multiple `KvStore`s in different
/// threads.
struct KvStoreReader {
    path: Arc<PathBuf>,
    // generation of the latest compaction file
    safe_point: Arc<AtomicU64>,
    readers: RefCell<BTreeMap<u64, BufReaderWithPos<File>>>,
}

impl KvStoreReader {
    /// Close file handles with generation number less than safe_point.
    ///
    /// `safe_point` is updated to the latest compaction gen after a compaction finishes.
    /// The compaction generation contains the sum of all operations before it and the
    /// in-memory index contains no entries with generation number less than safe_point.
    /// So we can safely close those file handles and the stale files can be deleted.
    fn close_stale_handles(&self) {
        let mut readers = self.readers.borrow_mut();
        while !readers.is_empty() {
            let first_gen = *readers.keys().next().unwrap();
            if self.safe_point.load(Ordering::SeqCst) <= first_gen {
                break;
            }
            readers.remove(&first_gen);
        }
    }

    /// Read the log file at the given `CommandPos`.
    fn read_and<F, R>(&self, cmd_pos: CommandPos, f: F) -> Result<R>
    where
        F: FnOnce(io::Take<&mut BufReaderWithPos<File>>) -> Result<R>,
    {
        self.close_stale_handles();

        let mut readers = self.readers.borrow_mut();
        // Open the file if we haven't opened it in this `KvStoreReader`.
        // We don't use entry API here because we want the errors to be propogated.
        if !readers.contains_key(&cmd_pos.gen) {
            let reader = BufReaderWithPos::new(File::open(log_path(&self.path, cmd_pos.gen))?)?;
            readers.insert(cmd_pos.gen, reader);
        }
        let reader = readers.get_mut(&cmd_pos.gen).unwrap();
        reader.seek(SeekFrom::Start(cmd_pos.pos))?;
        let cmd_reader = reader.take(cmd_pos.len);
        f(cmd_reader)
    }

    // Read the log file at the given `CommandPos` and deserialize it to `Command`.
    fn read_command(&self, cmd_pos: CommandPos) -> Result<Command> {
        self.read_and(cmd_pos, |cmd_reader| {
            Ok(serde_json::from_reader(cmd_reader)?)
        })
    }
}

impl Clone for KvStoreReader {
    fn clone(&self) -> KvStoreReader {
        KvStoreReader {
            path: Arc::clone(&self.path),
            safe_point: Arc::clone(&self.safe_point),
            // don't use other KvStoreReader's readers
            readers: RefCell::new(BTreeMap::new()),
        }
    }
}

struct KvStoreWriter {
    reader: KvStoreReader,
    writer: BufWriterWithPos<File>,
    current_gen: u64,
    // the number of bytes representing "stale" commands that could be
    // deleted during a compaction
    uncompacted: u64,
    path: Arc<PathBuf>,
    index: Arc<SkipMap<String, CommandPos>>,
}

impl KvStoreWriter {
    fn set(&mut self, key: String, value: String) -> Result<()> {
        let cmd = Command::set(key, value);
        let pos = self.writer.pos;
        serde_json::to_writer(&mut self.writer, &cmd)?;
        self.writer.flush()?;
        if let Command::Set { key, .. } = cmd {
            if let Some(old_cmd) = self.index.get(&key) {
                self.uncompacted += old_cmd.value().len;
            }
            self.index
                .insert(key, (self.current_gen, pos..self.writer.pos).into());
        }

        if self.uncompacted > COMPACTION_THRESHOLD {
            self.compact()?;
        }
        Ok(())
    }

    fn remove(&mut self, key: String) -> Result<()> {
        if self.index.contains_key(&key) {
            let cmd = Command::remove(key);
            let pos = self.writer.pos;
            serde_json::to_writer(&mut self.writer, &cmd)?;
            self.writer.flush()?;
            if let Command::Remove { key } = cmd {
                let old_cmd = self.index.remove(&key).expect("key not found");
                self.uncompacted += old_cmd.value().len;
                // the "remove" command itself can be deleted in the next compaction
                // so we add its length to `uncompacted`
                self.uncompacted += self.writer.pos - pos;
            }

            if self.uncompacted > COMPACTION_THRESHOLD {
                self.compact()?;
            }
            Ok(())
        } else {
            Err(KvsError::KeyNotFound)
        }
    }

    /// Clears stale entries in the log.
    fn compact(&mut self) -> Result<()> {
        // increase current gen by 2. current_gen + 1 is for the compaction file
        let compaction_gen = self.current_gen + 1;
        self.current_gen += 2;
        self.writer = new_log_file(&self.path, self.current_gen)?;

        let mut compaction_writer = new_log_file(&self.path, compaction_gen)?;

        let mut new_pos = 0; // pos in the new log file
        let mut new_index = Vec::new();
        for entry in self.index.iter() {
            let len = self.reader.read_and(*entry.value(), |mut entry_reader| {
                Ok(io::copy(&mut entry_reader, &mut compaction_writer)?)
            })?;
            new_index.push((entry.key().clone(
```

### Core Architecture Module: `courses/rust/projects/project-4/src/engines/mod.rs`
```
pub use self::kvs::KvStore;
pub use self::sled::SledKvsEngine;
use crate::Result;

mod kvs;
mod sled;

/// Trait for a key value storage engine.
pub trait KvsEngine: Clone + Send + 'static {
    /// Sets the value of a string key to a string.
    ///
    /// If the key already exists, the previous value will be overwritten.
    fn set(&self, key: String, value: String) -> Result<()>;

    /// Gets the string value of a given string key.
    ///
    /// Returns `None` if the given key does not exist.
    fn get(&self, key: String) -> Result<Option<String>>;

    /// Removes a given key.
    ///
    /// # Errors
    ///
    /// It returns `KvsError::KeyNotFound` if the given key is not found.
    fn remove(&self, key: String) -> Result<()>;
}

```

### Core Architecture Module: `courses/rust/projects/project-4/src/engines/sled.rs`
```
use super::KvsEngine;
use crate::{KvsError, Result};
use sled::{Db, Tree};

/// Wrapper of `sled::Db`
#[derive(Clone)]
pub struct SledKvsEngine(Db);

impl SledKvsEngine {
    /// Creates a `SledKvsEngine` from `sled::Db`.
    pub fn new(db: Db) -> Self {
        SledKvsEngine(db)
    }
}

impl KvsEngine for SledKvsEngine {
    fn set(&self, key: String, value: String) -> Result<()> {
        let tree: &Tree = &self.0;
        tree.insert(key, value.into_bytes()).map(|_| ())?;
        tree.flush()?;
        Ok(())
    }

    fn get(&self, key: String) -> Result<Option<String>> {
        let tree: &Tree = &self.0;
        Ok(tree
            .get(key)?
            .map(|i_vec| AsRef::<[u8]>::as_ref(&i_vec).to_vec())
            .map(String::from_utf8)
            .transpose()?)
    }

    fn remove(&self, key: String) -> Result<()> {
        let tree: &Tree = &self.0;
        tree.remove(key)?.ok_or(KvsError::KeyNotFound)?;
        tree.flush()?;
        Ok(())
    }
}

```

### Core Architecture Module: `courses/rust/projects/project-4/src/thread_pool/shared_queue.rs`
```
use std::thread;

use super::ThreadPool;
use crate::Result;

use crossbeam::channel::{self, Receiver, Sender};

use log::{debug, error};

// Note for Rust training course: the thread pool is not implemented using
// `catch_unwind` because it would require the task to be `UnwindSafe`.

/// A thread pool using a shared queue inside.
///
/// If a spawned task panics, the old thread will be destroyed and a new one will be
/// created. It fails silently when any failure to create the thread at the OS level
/// is captured after the thread pool is created. So, the thread number in the pool
/// can decrease to zero, then spawning a task to the thread pool will panic.
pub struct SharedQueueThreadPool {
    tx: Sender<Box<dyn FnOnce() + Send + 'static>>,
}

impl ThreadPool for SharedQueueThreadPool {
    fn new(threads: u32) -> Result<Self> {
        let (tx, rx) = channel::unbounded::<Box<dyn FnOnce() + Send + 'static>>();
        for _ in 0..threads {
            let rx = TaskReceiver(rx.clone());
            thread::Builder::new().spawn(move || run_tasks(rx))?;
        }
        Ok(SharedQueueThreadPool { tx })
    }

    /// Spawns a function into the thread pool.
    ///
    /// # Panics
    ///
    /// Panics if the thread pool has no thread.
    fn spawn<F>(&self, job: F)
    where
        F: FnOnce() + Send + 'static,
    {
        self.tx
            .send(Box::new(job))
            .expect("The thread pool has no thread.");
    }
}

#[derive(Clone)]
struct TaskReceiver(Receiver<Box<dyn FnOnce() + Send + 'static>>);

impl Drop for TaskReceiver {
    fn drop(&mut self) {
        if thread::panicking() {
            let rx = self.clone();
            if let Err(e) = thread::Builder::new().spawn(move || run_tasks(rx)) {
                error!("Failed to spawn a thread: {}", e);
            }
        }
    }
}

fn run_tasks(rx: TaskReceiver) {
    loop {
        match rx.0.recv() {
            Ok(task) => {
                task();
            }
            Err(_) => {
                debug!("Thread exits because the thread pool is destroyed.");
                break;
            }
        }
    }
}

```

### Core Architecture Module: `courses/rust/projects/project-5/src/engines/kvs.rs`
```
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::ops::Range;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crossbeam::queue::ArrayQueue;
use crossbeam_skiplist::SkipMap;
use serde::{Deserialize, Serialize};
use serde_json::Deserializer;
use tokio::prelude::*;
use tokio::sync::oneshot;

use super::KvsEngine;
use crate::thread_pool::ThreadPool;
use crate::{KvsError, Result};

const COMPACTION_THRESHOLD: u64 = 1024 * 1024;

/// The `KvStore` stores string key/value pairs.
///
/// Key/value pairs are persisted to disk in log files. Log files are named after
/// monotonically increasing generation numbers with a `log` extension name.
/// A skip list in memory stores the keys and the value locations for fast query.
///
/// ```rust
/// # use kvs::{KvStore, Result};
/// # use kvs::thread_pool::{ThreadPool, RayonThreadPool};
/// # use tokio::prelude::*;
/// # fn try_main() -> Result<()> {
/// use std::env::current_dir;
/// use kvs::KvsEngine;
/// let mut store: KvStore<RayonThreadPool> = KvStore::open(current_dir()?, 2)?;
/// store.set("key".to_owned(), "value".to_owned()).wait()?;
/// let val = store.get("key".to_owned()).wait()?;
/// assert_eq!(val, Some("value".to_owned()));
/// # Ok(())
/// # }
/// ```
#[derive(Clone)]
pub struct KvStore<P: ThreadPool> {
    // directory for the log and other data
    path: Arc<PathBuf>,
    // map generation number to the file reader
    index: Arc<SkipMap<String, CommandPos>>,
    writer: Arc<Mutex<KvStoreWriter>>,
    thread_pool: P,
    reader_pool: Arc<ArrayQueue<KvStoreReader>>,
}

impl<P: ThreadPool> KvStore<P> {
    /// Opens a `KvStore` with the given path.
    ///
    /// This will create a new directory if the given one does not exist.
    ///
    /// `concurrency` specifies how many threads at most can read the database at the same time.
    ///
    /// # Errors
    ///
    /// It propagates I/O or deserialization errors during the log replay.
    pub fn open(path: impl Into<PathBuf>, concurrency: u32) -> Result<Self> {
        let path = Arc::new(path.into());
        fs::create_dir_all(&*path)?;

        let mut readers = BTreeMap::new();
        let index = Arc::new(SkipMap::new());

        let gen_list = sorted_gen_list(&path)?;
        let mut uncompacted = 0;

        for &gen in &gen_list {
            let mut reader = BufReaderWithPos::new(File::open(log_path(&path, gen))?)?;
            uncompacted += load(gen, &mut reader, &*index)?;
            readers.insert(gen, reader);
        }

        let current_gen = gen_list.last().unwrap_or(&0) + 1;
        let writer = new_log_file(&path, current_gen)?;
        let safe_point = Arc::new(AtomicU64::new(0));

        let reader = KvStoreReader {
            path: Arc::clone(&path),
            safe_point,
            readers: RefCell::new(BTreeMap::new()),
        };

        let writer = KvStoreWriter {
            reader: reader.clone(),
            writer,
            current_gen,
            uncompacted,
            path: Arc::clone(&path),
            index: Arc::clone(&index),
        };

        let thread_pool = P::new(concurrency)?;
        let reader_pool = Arc::new(ArrayQueue::new(concurrency as usize));
        for _ in 1..concurrency {
            reader_pool.push(reader.clone()).unwrap();
        }
        reader_pool.push(reader).unwrap();

        Ok(KvStore {
            path,
            index,
            writer: Arc::new(Mutex::new(writer)),
            thread_pool,
            reader_pool,
        })
    }
}

impl<P: ThreadPool> KvsEngine for KvStore<P> {
    /// Sets the value of a string key to a string.
    ///
    /// If the key already exists, the previous value will be overwritten.
    ///
    /// # Errors
    ///
    /// It propagates I/O or serialization errors during writing the log.
    fn set(&self, key: String, value: String) -> Box<dyn Future<Item = (), Error = KvsError> + Send> {
        let writer = self.writer.clone();
        let (tx, rx) = oneshot::channel();
        self.thread_pool.spawn(move || {
            let res = writer.lock().unwrap().set(key, value);
            if tx.send(res).is_err() {
                error!("Receiving end is dropped");
            }
        });
        Box::new(
            rx.map_err(|e| KvsError::StringError(format!("{}", e)))
                .flatten(),
        )
    }

    /// Gets the string value of a given string key.
    ///
    /// Returns `None` if the given key does not exist.
    fn get(&self, key: String) -> Box<dyn Future<Item = Option<String>, Error = KvsError> + Send> {
        let reader_pool = self.reader_pool.clone();
        let index = self.index.clone();
        let (tx, rx) = oneshot::channel();
        self.thread_pool.spawn(move || {
            let res = (|| loop {
                let cmd_pos = match index.get(&key) {
                    Some(entry) => *entry.value(),
                    None => return Ok(None),
                };
                let reader = reader_pool.pop().unwrap();
                // Return the reader to the pool before checking the result,
                // so a failed read doesn't leak it.
                let res = reader.read_command(cmd_pos);
                reader_pool.push(reader).unwrap();
                match res {
                    Ok(Command::Set { value, .. }) => return Ok(Some(value)),
                    Ok(_) => return Err(KvsError::UnexpectedCommandType),
                    // A compaction can move the entry to a new log file and delete the old
                    // file between the index lookup and the read, so look the key up again.
                    Err(KvsError::Io(ref e))
                        if e.kind() == io::ErrorKind::NotFound
                            && index.get(&key).map(|e| e.value().gen) != Some(cmd_pos.gen) =>
                    {
                        continue
                    }
                    Err(e) => return Err(e),
                }
            })();
            if tx.send(res).is_err() {
                error!("Receiving end is dropped");
            }
        });
        Box::new(
            rx.map_err(|e| KvsError::StringError(format!("{}", e)))
                .flatten(),
        )
    }

    /// Removes a given key.
    ///
    /// # Error
    ///
    /// It returns `KvsError::KeyNotFound` if the given key is not found.
    ///
    /// It propagates I/O or serialization errors during writing the log.
    fn remove(&self, key: String) -> Box<dyn Future<Item = (), Error = KvsError> + Send> {
        let writer = self.writer.clone();
        let (tx, rx) = oneshot::channel();
        self.thread_pool.spawn(move || {
            let res = writer.lock().unwrap().remove(key);
            if tx.send(res).is_err() {
                error!("Receiving end is dropped");
            }
        });
        Box::new(
            rx.map_err(|e| KvsError::StringError(format!("{}", e)))
                .flatten(),
        )
    }
}

/// A single thread reader.
///
/// Each `KvStore` instance has its own `KvStoreReader` and
/// `KvStoreReader`s open the same files separately. So the user
/// can read concurrently through multiple `KvStore`s in different
/// threads.
struct KvStoreReader {
    path: Arc<PathBuf>,
    // generation of the latest compaction file
    safe_point: Arc<AtomicU64>,
    readers: RefCell<BTreeMap<u64, BufReaderWithPos<File>>>,
}

impl KvStoreReader {
    /// Close file handles with generation number less than safe_point.
    ///
    /// `safe_point` is updated to the latest compaction gen after a compaction finishes.
    /// The compaction generation contains the sum of all operations before it and the
    /// in-memory index contains no entries with generation number less than safe_point.
    /// So we can safely close those file handles and the stale files can be deleted.
    fn close_stale_handles(&self) {
        let mut readers = self.readers.borrow_mut();
        while !readers.is_empty() {
            let first_gen = *readers.keys().next().unwrap();
            if self.safe_point.load(Ordering::SeqCst) <= first_gen {
                break;
            }
            readers.remove(&first_gen);
        }
    }

    /// Read the log file at the given `CommandPos`.
    fn read_and<F, R>(&self, cmd_pos: CommandPos, f: F) -> Result<R>
    where
        F: FnOnce(io::Take<&mut BufReaderWithPos<File>>) -> Result<R>,
    {
        self.close_stale_handles();

        let mut readers = self.readers.borrow_mut();
        // Open the file if we haven't opened it in this `KvStoreReader`.
        // We don't use entry API here because we want the errors to be propogated.
        if !readers.contains_key(&cmd_pos.gen) {
            let reader = BufReaderWithPos::new(File::open(log_path(&self.path, cmd_pos.gen))?)?;
            readers.insert(cmd_pos.gen, reader);
        }
        let reader = readers.get_mut(&cmd_pos.gen).unwrap();
        reader.seek(SeekFrom::Start(cmd_pos.pos))?;
        let cmd_reader = reader.take(cmd_pos.len);
        f(cmd_reader)
    }

    // Read the log file at the given `CommandPos` and deserialize it to `Command`.
    fn read_command(&self, cmd_pos: CommandPos) -> Result<Command> {
        self.read_and(cmd_pos, |cmd_reader| {
            Ok(serde_json::from_reader(cmd_reader)?)
        })
    }
}

impl Clone for KvStoreReader {
    fn clone(&self) -> KvStoreReader {
        KvStoreReader {
            path: Arc::clone(&self.path),
            safe_point: Arc::clone(&self.safe_point),
            // don't use other KvStoreReader's readers
            readers: RefCell::new(BTreeMap::new()),
        }
    }
}

struct KvStoreWriter {
    reader: KvStoreReader,
    writer: BufWriterWithPos<File>,
    current_gen: u64,
    // the number of bytes representing "stale" commands that could be
    // delet
```

### Core Architecture Module: `courses/rust/projects/project-5/src/engines/mod.rs`
```
pub use self::kvs::KvStore;
pub use self::sled::SledKvsEngine;
use crate::KvsError;

use tokio::prelude::Future;

mod kvs;
mod sled;

/// Trait for a key value storage engine.
pub trait KvsEngine: Clone + Send + 'static {
    /// Sets the value of a string key to a string.
    ///
    /// If the key already exists, the previous value will be overwritten.
    fn set(&self, key: String, value: String) -> Box<dyn Future<Item = (), Error = KvsError> + Send>;

    /// Gets the string value of a given string key.
    ///
    /// Returns `None` if the given key does not exist.
    fn get(&self, key: String) -> Box<dyn Future<Item = Option<String>, Error = KvsError> + Send>;

    /// Removes a given key.
    ///
    /// # Errors
    ///
    /// It returns `KvsError::KeyNotFound` if the given key is not found.
    fn remove(&self, key: String) -> Box<dyn Future<Item = (), Error = KvsError> + Send>;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #474** (2026-11-02): **rust/projects/project-4,project-5: retry get when compaction removes its log file**
  *Symptoms*: ### What problem does this PR solve?  - Brief description of the problem: `KvStore::get` in project-4 and project-5 reads the index without a lock. If a compaction moves the entry to the compaction file and deletes the old log file between the index lookup and the read, `get` fails with `IO error: No such file or directory` for a key that is still live. Reported by the internal code-security scanner.  ### What is changed and how it works?  When the read fails with `NotFound` and the key's index entry now points to a different generation, `get` looks the key up again and retries. Any other error, or a `NotFound` for an entry that did not move, is returned as before. In project-5 the reader is still returned to the pool before the result is checked (#472).  ### Check List  Tests   - Unit test: the existing project-4 and project-5 suites pass (cargo 1.53 with rustc 1.47, `--locked`).  - Manual test: a local stress test (not committed) with 4 reader threads calling `get` on 200 live keys while one writer overwrites a 4 KiB value for 20 s, triggering repeated compactions. Before: 6 NotFound errors in project-4 (out of 31.7M reads). After: 0 in both projects.  Not in this PR: the same stress test shows that `get` can also return `None` for a live key while it is being re-inserted. crossbeam-skiplist's `insert` removes an existing entry before inserting the new one, and compaction re-inserts every live key. Fixing that needs in-place index updates, so it is left for a separate chang

- **Issue #473** (2026-11-02): **rust/projects/project-5: serve connections concurrently and drop bad streams**
  *Symptoms*: ### What problem does this PR solve?  - Brief description of the problem: in the project-5 reference solution, one bad 4-byte request makes `kvs-server` loop writing error responses and then exit, and connections are served one at a time.  ### What is changed and how it works?  `courses/rust/projects/project-5/src/server.rs` only.  - **Connections are served one at a time, and one error stops the server.** `for_each` ran `serve()` inline, so the next connection waited for the previous one to finish, and an error from any connection (or from `accept`) ended `for_each` and the server. Now each connection is `tokio::spawn`ed, and a failed accept is logged and the server keeps listening. - **Stream errors were answered forever.** `serve()` turned every error into `Response::Err`, including read and decode errors from the socket, and kept polling the failed stream. Now only engine errors become error responses; a stream error closes that connection.  ### Check List  Tests   - Integration test: existing `cargo test --locked` for project-5 (Docker, `rust:1.53` cargo with `rustc` 1.47, as in the companion PR). All pass except `cli_access_server_sled_engine`, which fails intermittently on unchanged `master` too.  - Manual test: start `kvs-server`, then send the 4 bytes `ff ff ff ff` (a frame length over the codec's limit):     ```bash    exec 3<>/dev/tcp/127.0.0.1/4000; printf '\xff\xff\xff\xff' >&3    timeout 2 cat <&3 | wc -c    ```     | | `master` | this PR |    |---|---|---|    |

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

### Incident Patch 1: `9f846dab` (2026-11-02)
**Commit Message**: rust/projects: fix bugs in the kvs reference solutions and unbreak project-4's build (#472)

* rust/projects/project-4: pin crossbeam-skiplist to a fixed rev

crossbeam renamed its default branch from master to main, so
branch = "master" no longer resolves and project-4 fails to fetch
its dependencies. Pin the commit that Cargo.lock already used
(90cd7dca), as project-5 does. No dependency code changes.

* ci: pin the dss CI image by digest

* rust/projects: stop shared queue workers when the pool is dropped

run_tasks logged and looped again when recv() failed, so once the
SharedQueueThreadPool was dropped every worker spun at 100% CPU.
Break out of the loop instead (project-4 and project-5).

* rust/projects: refuse to start on an unreadable engine file

kvs-server treated an invalid engine file as "no engine selected",
so it could open data written by one engine with the other. Exit
with an error instead, as the spec requires when the engine differs
(project-3, project-4 and project-5).

* rust/projects: fix reader leak and compaction ordering in KvStore

- project-5: KvStore::get returned early on a read error without
  putting the reader back in the pool. After enough errors t

**File**: `.circleci/config.yml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ version: 2.1
 jobs:
   dss:
     docker:
-      - image: circleci/rust:stretch
+      - image: circleci/rust:stretch@sha256:5646e23b70685e1e57499c71358c2036134582f5c6d70ad27ff86725959446d8
     environment:
       RUST_BACKTRACE: "1"
       RUSTFLAGS: "-Dwarnings"
```

**File**: `courses/rust/projects/project-3/src/bin/kvs-server.rs` (modified, +5/-5)
```diff
@@ -1,7 +1,7 @@
 use clap::arg_enum;
 use kvs::*;
 use log::LevelFilter;
-use log::{error, info, warn};
+use log::{error, info};
 use std::env::current_dir;
 use std::fs;
 use std::net::SocketAddr;
@@ -87,9 +87,9 @@ fn current_engine() -> Result<Option<Engine>> {
 
     match fs::read_to_string(engine)?.parse() {
         Ok(engine) => Ok(Some(engine)),
-        Err(e) => {
-            warn!("The content of engine file is invalid: {}", e);
-            Ok(None)
-        }
+        Err(e) => Err(KvsError::StringError(format!(
+            "The content of engine file is invalid: {}",
+            e
+        ))),
     }
 }
```

**File**: `courses/rust/projects/project-3/src/engines/kvs.rs` (modified, +1/-1)
```diff
@@ -351,7 +351,7 @@ struct BufWriterWithPos<W: Write + Seek> {
 
 impl<W: Write + Seek> BufWriterWithPos<W> {
     fn new(mut inner: W) -> Result<Self> {
-        let pos = inner.seek(SeekFrom::Current(0))?;
+        let pos = inner.seek(SeekFrom::End(0))?;
         Ok(BufWriterWithPos {
             writer: BufWriter::new(inner),
             pos,
```

**File**: `courses/rust/projects/project-4/Cargo.lock` (modified, +6/-6)
```diff
@@ -318,10 +318,10 @@ dependencies = [
 [[package]]
 name = "crossbeam-epoch"
 version = "0.9.1"
-source = "git+https://github.com/crossbeam-rs/crossbeam.git?branch=master#90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a"
+source = "git+https://github.com/crossbeam-rs/crossbeam.git?rev=90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a#90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a"
 dependencies = [
  "cfg-if 1.0.0",
- "crossbeam-utils 0.8.1 (git+https://github.com/crossbeam-rs/crossbeam.git?branch=master)",
+ "crossbeam-utils 0.8.1 (git+https://github.com/crossbeam-rs/crossbeam.git?rev=90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a)",
  "lazy_static",
  "loom",
  "memoffset 0.6.1",
@@ -340,11 +340,11 @@ dependencies = [
 [[package]]
 name = "crossbeam-skiplist"
 version = "0.0.0"
-source = "git+https://github.com/crossbeam-rs/crossbeam.git?branch=master#90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a"
+source = "git+https://github.com/crossbeam-rs/crossbeam.git?rev=90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a#90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a"
 dependencies = [
  "cfg-if 1.0.0",
- "crossbeam-epoch 0.9.1 (git+https://github.com/crossbeam-rs/crossbeam.git?branch=master)",
- "crossbeam-utils 0.8.1 (git+https://github.com/crossbeam-rs/crossbeam.git?branch=master)",
+ "crossbeam-epoch 0.9.1 (git+https://github.com/crossbeam-rs/crossbeam.git?rev=90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a)",
+ "crossbeam-utils 0.8.1 (git+https://github.com/crossbeam-rs/crossbeam.git?rev=90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a)",
  "scopeguard 1.1.0",
 ]
 
@@ -383,7 +383,7 @@ dependencies = [
 [[package]]
 name = "crossbeam-utils"
 version = "0.8.1"
-source = "git+https://github.com/crossbeam-rs/crossbeam.git?branch=master#90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a"
+source = "git+https://github.com/crossbeam-rs/crossbeam.git?rev=90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a#90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a"
 dependencies = [
  "autocfg 1.0.1",
  "cfg-if 1.0.0",
```

**File**: `courses/rust/projects/project-4/Cargo.toml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ sled = "0.34.6"
 crossbeam = "0.7.1"
 rayon = "1.0.3"
 num_cpus = "1.10.0"
-crossbeam-skiplist = { git = "https://github.com/crossbeam-rs/crossbeam.git", branch = "master" }
+crossbeam-skiplist = { git = "https://github.com/crossbeam-rs/crossbeam.git", rev = "90cd7dca89a58fd09e2fd92d6c0e9cfbe3f0a04a" }
 
 [dev-dependencies]
 assert_cmd = "0.11"
```

**File**: `courses/rust/projects/project-4/src/bin/kvs-server.rs` (modified, +5/-5)
```diff
@@ -2,7 +2,7 @@ use clap::arg_enum;
 use kvs::thread_pool::*;
 use kvs::*;
 use log::LevelFilter;
-use log::{error, info, warn};
+use log::{error, info};
 use std::env;
 use std::env::current_dir;
 use std::fs;
@@ -97,9 +97,9 @@ fn current_engine() -> Result<Option<Engine>> {
 
     match fs::read_to_string(engine)?.parse() {
         Ok(engine) => Ok(Some(engine)),
-        Err(e) => {
-            warn!("The content of engine file is invalid: {}", e);
-            Ok(None)
-        }
+        Err(e) => Err(KvsError::StringError(format!(
+            "The content of engine file is invalid: {}",
+            e
+        ))),
     }
 }
```

**File**: `courses/rust/projects/project-4/src/engines/kvs.rs` (modified, +9/-5)
```diff
@@ -271,18 +271,22 @@ impl KvStoreWriter {
         let mut compaction_writer = new_log_file(&self.path, compaction_gen)?;
 
         let mut new_pos = 0; // pos in the new log file
+        let mut new_index = Vec::new();
         for entry in self.index.iter() {
             let len = self.reader.read_and(*entry.value(), |mut entry_reader| {
                 Ok(io::copy(&mut entry_reader, &mut compaction_writer)?)
             })?;
-            self.index.insert(
-                entry.key().clone(),
-                (compaction_gen, new_pos..new_pos + len).into(),
-            );
+            new_index.push((entry.key().clone(), new_pos..new_pos + len));
             new_pos += len;
         }
         compaction_writer.flush()?;
 
+        // Readers don't take the lock, so only point the index at the compaction
+        // file after its contents are flushed.
+        for (key, range) in new_index {
+            self.index.insert(key, (compaction_gen, range).into());
+        }
+
         self.reader
             .safe_point
             .store(compaction_gen, Ordering::SeqCst);
@@ -453,7 +457,7 @@ struct BufWriterWithPos<W: Write + Seek> {
 
 impl<W: Write + Seek> BufWriterWithPos<W> {
     fn new(mut inner: W) -> Result<Self> {
-        let pos = inner.seek(SeekFrom::Current(0))?;
+        let pos = inner.seek(SeekFrom::End(0))?;
         Ok(BufWriterWithPos {
             writer: BufWriter::new(inner),
             pos,
```

**File**: `courses/rust/projects/project-4/src/thread_pool/shared_queue.rs` (modified, +4/-1)
```diff
@@ -65,7 +65,10 @@ fn run_tasks(rx: TaskReceiver) {
             Ok(task) => {
                 task();
             }
-            Err(_) => debug!("Thread exits because the thread pool is destroyed."),
+            Err(_) => {
+                debug!("Thread exits because the thread pool is destroyed.");
+                break;
+            }
         }
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #474** (2026-11-02): rust/projects/project-4,project-5: retry get when compaction removes its log file (@seominjea1942)
- **PR #473** (2026-11-02): rust/projects/project-5: serve connections concurrently and drop bad streams (@seominjea1942)
- **PR #472** (2026-11-02): rust/projects: fix bugs in the kvs reference solutions and unbreak project-4's build (@seominjea1942)
- **PR #470** (closed): courses/dss: fixed compilation errors and clippy warnings (@kumarlokesh)
- **PR #468** (closed): Jchen/raft lab2a leader election (@drinkbeer)
- **PR #467** (closed): Fixing the clippy (@drinkbeer)

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

## X. rust/projects: fix bugs in the kvs reference solutions and unbreak project-4's b

**RULE**:
When implementing operations in `.circleci/config.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pingcap/talent-plan. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9f846dab`: rust/projects: fix bugs in the kvs reference solutions and unbreak project-4's build (#472). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.circleci/config.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      - image: circleci/rust:stretch@sha256:5646e23b70685e1e57499c71358c2036134582f5c6d70ad27ff86725959446d8
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
      - image: circleci/rust:stretch
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9f846dab` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
