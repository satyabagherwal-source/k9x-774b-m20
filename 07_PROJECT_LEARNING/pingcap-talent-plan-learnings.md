# Forensic Learning Record (Deep Inspection): pingcap/talent-plan

> **Canonical Artifact**: `07_PROJECT_LEARNING/pingcap-talent-plan-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pingcap/talent-plan](https://github.com/pingcap/talent-plan))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:14:13.310Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pingcap/talent-plan`
- **Description**: open source training courses about distributed database and distributed systems
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11015 stars

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
        if let Some(cmd_pos) = self.index.get(&key) {
            if let Command::Set { value, .. } = self.reader.read_command(*cmd_pos.value())? {
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
        for entry in self.index.iter() {
            let len = self.reader.read_and(*entry.value(), |mut entry_reader| {
                Ok(io::copy(&mut entry_reader, &mut compaction_writer)?)
            })?;
            self.index.insert(
                entry.key().clone(),
                (compaction_gen, new_pos..new_pos + len).into(),
            );
            new_pos += len;
        }
        compaction_writer.flush()?;

        self.reader
            .safe_point
            .store(compaction_gen, Ordering::SeqCst);
        self.reader.close_stale_handles();

        // remove stale log files
        // Note that actually these files are not deleted immediately because `KvStoreReader`s
        // still keep open file handles. When `KvStoreReader` is used next time, it will clear
        // its stale file handles. On Unix, the files 
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
            Err(_) => debug!("Thread exits because the thread pool is destroyed."),
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
            let res = (|| {
                if let Some(cmd_pos) = index.get(&key) {
                    let reader = reader_pool.pop().unwrap();
                    let res = if let Command::Set { value, .. } =
                        reader.read_command(*cmd_pos.value())?
                    {
                        Ok(Some(value))
                    } else {
                        Err(KvsError::UnexpectedCommandType)
                    };
                    reader_pool.push(reader).unwrap();
                    res
                } else {
                    Ok(None)
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
                .insert(key, (sel
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

### Core Architecture Module: `courses/rust/projects/project-5/src/engines/sled.rs`
```
use crate::thread_pool::ThreadPool;
use crate::{KvsEngine, KvsError, Result};
use sled::Db;
use tokio::prelude::*;
use tokio::sync::oneshot;

/// Wrapper of `sled::Db`
#[derive(Clone)]
pub struct SledKvsEngine<P: ThreadPool> {
    pool: P,
    db: Db,
}

impl<P: ThreadPool> SledKvsEngine<P> {
    /// Creates a `SledKvsEngine` from `sled::Db`.
    ///
    /// Operations are run in the given thread pool. `concurrency` specifies the number of
    /// threads in the thread pool.
    pub fn new(db: Db, concurrency: u32) -> Result<Self> {
        let pool = P::new(concurrency)?;
        Ok(SledKvsEngine { pool, db })
    }
}

impl<P: ThreadPool> KvsEngine for SledKvsEngine<P> {
    fn set(&self, key: String, value: String) -> Box<dyn Future<Item = (), Error = KvsError> + Send> {
        let db = self.db.clone();
        let (tx, rx) = oneshot::channel();
        self.pool.spawn(move || {
            let res = db
                .set(key, value.into_bytes())
                .and_then(|_| db.flush())
                .map(|_| ())
                .map_err(KvsError::from);
            if tx.send(res).is_err() {
                error!("Receiving end is dropped");
            }
        });
        Box::new(
            rx.map_err(|e| KvsError::StringError(format!("{}", e)))
                .flatten(),
        )
    }

    fn get(&self, key: String) -> Box<dyn Future<Item = Option<String>, Error = KvsError> + Send> {
        let db = self.db.clone();
        let (tx, rx) = oneshot::channel();
        self.pool.spawn(move || {
            let res = (move || {
                Ok(db
                    .get(key)?
                    .map(|i_vec| AsRef::<[u8]>::as_ref(&i_vec).to_vec())
                    .map(String::from_utf8)
                    .transpose()?)
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

    fn remove(&self, key: String) -> Box<dyn Future<Item = (), Error = KvsError> + Send> {
        let db = self.db.clone();
        let (tx, rx) = oneshot::channel();
        self.pool.spawn(move || {
            let res = (|| {
                db.del(key)?.ok_or(KvsError::KeyNotFound)?;
                db.flush()?;
                Ok(())
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
}

```

### Core Architecture Module: `courses/rust/projects/project-5/src/thread_pool/shared_queue.rs`
```
use std::thread;

use super::ThreadPool;
use crate::Result;

use crossbeam::channel::{self, Receiver, Sender};

// Note for Rust training course: the thread pool is not implemented using
// `catch_unwind` because it would require the task to be `UnwindSafe`.

/// A thread pool using a shared queue inside.
///
/// If a spawned task panics, the old thread will be destroyed and a new one will be
/// created. It fails silently when any failure to create the thread at the OS level
/// is captured after the thread pool is created. So, the thread number in the pool
/// can decrease to zero, then spawning a task to the thread pool will panic.
#[derive(Clone)]
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
            Err(_) => debug!("Thread exits because the thread pool is destroyed."),
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #470** (2026-07-11): **courses/dss: fixed compilation errors and clippy warnings**
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  - Fixed compilation errors and resolved clippy warnings that were appearing while running `make test_others`

- **Issue #468** (2024-12-16): **Jchen/raft lab2a leader election**
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  - Issue number: close #xxx <!-- remove this line if no issue to close --> - Breif description of the problem:  ### What is changed and how it works?  ### Check List <!--REMOVE the items that are not applicable-->  Tests <!-- At least one of them must be included. -->   - Unit test  - Integration test  - Manual test (add detailed scripts or steps below)  - No code  Side effects   - Possible performance regression  - Increased code complexity  Related changes   - Need to update the documentation 

- **Issue #467** (2024-12-16): **Fixing the clippy**
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  - Issue number: close #xxx <!-- remove this line if no issue to close --> - Breif description of the problem:  ### What is changed and how it works?  ### Check List <!--REMOVE the items that are not applicable-->  Tests <!-- At least one of them must be included. -->   - Unit test  - Integration test  - Manual test (add detailed scripts or steps below)  - No code  Side effects   - Possible performance regression  - Increased code complexity  Related changes   - Need to update the documentation 

- **Issue #460** (2023-09-18): **Mine**
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  - Issue number: close #xxx <!-- remove this line if no issue to close --> - Breif description of the problem:  ### What is changed and how it works?  ### Check List <!--REMOVE the items that are not applicable-->  Tests <!-- At least one of them must be included. -->   - Unit test  - Integration test  - Manual test (add detailed scripts or steps below)  - No code  Side effects   - Possible performance regression  - Increased code complexity  Related changes   - Need to update the documentation 

- **Issue #458** (2026-04-05): **Project 3: Sled db reopen could fail on `could not acquire lock on ....` on Linux**
  *Symptoms*: Should we add some timeouts after we kill the server process?  ``` let handle = thread::spawn(move || {     let _ = receiver.recv(); // wait for main thread to finish     child.kill().expect("server exited before killed"); }); ```  When we kill the child process in which server is running, if open the sled db immediately before `LOCK_UN` takes effect, we probably will get this error.  Maybe adding some timeouts like 50ms or so in between can make the test `cli_access_server_sled_engine` more reliable. 
  **Post-Mortem & Fix Analysis**:
  > Also see the issue for sled here: https://github.com/spacejam/sled/issues/1234

- **Issue #457** (2023-02-26): **Update tp102-how-to-use-git-github.md**
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  - Breif description of the problem: the learning course uri is invalid  ### What is changed and how it works?  ### Check List <!--REMOVE the items that are not applicable-->  Tests <!-- At least one of them must be included. -->   - No code   Related changes   - Need to update the documentation 

- **Issue #456** (2023-01-26): **(WIP) raft with rust**
  *Symptoms*: 

- **Issue #455** (2024-03-14): **rust project-3 tests/cli.rs: revise mistyped "get", **
  *Symptoms*: <!-- Thank you for contributing to talent-plan!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve?  In rust project-3 tests/cli.rs `cli_invalid_set` function, the fifth command should test "set" command, while testing "get".  ### What is changed and how it works?  Replace "get" with "set".  ### Tests I suppose this PR do not need further tests.

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

### Incident Patch 1: `a41b846b` (2022-04-06)
**Commit Message**: README.md: fix the link error (#410)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ We love our community and take great care to ensure it is fun, safe and rewardin
 
 ## We're here to help
 
-If you have questions about building (or taking) courses, you can ask in the channel **#wg-talent-plan-courses** of the [tidbcommunity](https://pingcap.com/tidbslack/) slack workspace.
+If you have questions about building (or taking) courses, you can ask in the channel **#wg-talent-plan-courses** of the [tidbcommunity](https://tidbcommunity.slack.com/join/shared_invite/enQtNzc0MzI4ODExMDc4LWYwYmIzMjZkYzJiNDUxMmZlN2FiMGJkZjAyMzQ5NGU0NGY0NzI3NTYwMjAyNGQ1N2I2ZjAxNzc1OGUwYWM0NzE#/shared-invite/email) slack workspace.
 
 ## License
 
```

---

### Incident Patch 2: `e37ab243` (2021-08-26)
**Commit Message**: Fix bug: remove unnecessary nested match from clippy (#387)

When compiling with rustc 1.50.0, clippy issues the error: `Unnecessary nested match` for the file raft/src/raft/tests.rs:693:17.



---

### Incident Patch 3: `ecdfbf4b` (2020-06-23)
**Commit Message**: dss: fix redundant closure (#360)

Signed-off-by: Neil Shen <[REDACTED_EMAIL]>

**File**: `courses/dss/linearizability/src/models.rs` (modified, +3/-3)
```diff
@@ -35,7 +35,7 @@ impl Model for KvModel {
     ) -> Vec<Operations<Self::Input, Self::Output>> {
         let mut map = HashMap::new();
         for op in history {
-            let v = map.entry(op.input.key.clone()).or_insert_with(|| vec![]);
+            let v = map.entry(op.input.key.clone()).or_insert_with(Vec::new);
             (*v).push(op);
         }
         let mut ret = vec![];
@@ -56,11 +56,11 @@ impl Model for KvModel {
                 EventKind::CallEvent => {
                     let key = event.value.input().key.clone();
                     matched.insert(event.id, key.clone());
-                    m.entry(key).or_insert_with(|| vec![]).push(event);
+                    m.entry(key).or_insert_with(Vec::new).push(event);
                 }
                 EventKind::ReturnEvent => {
                     let key = matched[&event.id].clone();
-                    m.entry(key).or_insert_with(|| vec![]).push(event);
+                    m.entry(key).or_insert_with(Vec::new).push(event);
                 }
             }
         }
```

---

### Incident Patch 4: `0f69bac0` (2020-05-10)
**Commit Message**: fix course number (#349)

**File**: `README.md` (modified, +2/-2)
```diff
@@ -30,8 +30,8 @@ Two courses are included in this series, which are:
 
 Two courses are included in this series, which are:
 
-- [TP 301: TinyKV, a distributed key value database in Go](https://github.com/pingcap-incubator/tinykv) 
-- [TP 302: TinySQL, a distributed relational database in Go](https://github.com/pingcap-incubator/tinysql)
+- [TP 301: TinySQL, a distributed relational database in Go](https://github.com/pingcap-incubator/tinysql)
+- [TP 302: TinyKV, a distributed key value database in Go](https://github.com/pingcap-incubator/tinykv) 
 
 ### Series 4: Deep Dive into TiDB Ecosystems 
 
```

**File**: `courses/README.md` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ Here we list all public courses of Talent Plan, including:
 - [TP 103: Build a welcoming community](tp103-open-source-community.md)
 - [TP 201: Practical Networked Applications in Rust](rust/README.md)
 - [TP 202: Distributed Systems in Rust](dss/README.md)
-- [TP 301: TinyKV, a distributed key value database in Go](https://github.com/pingcap-incubator/tinykv) 
-- [TP 302: TinySQL, a distributed relational database in Go](https://github.com/pingcap-incubator/tinysql)
+- [TP 301: TinySQL, a distributed relational database in Go](https://github.com/pingcap-incubator/tinysql)
+- [TP 302: TinyKV, a distributed key value database in Go](https://github.com/pingcap-incubator/tinykv) 
 - TP 401: Deep Dive into TiDB(WIP)
 - TP 402: Deep Dive into TiKV(WIP)
```

---

### Incident Patch 5: `dabc935a` (2020-05-08)
**Commit Message**: fix typo (#345)

**File**: `talent-plan-1.0/1.0-lp-tikv.md` (modified, +5/-5)
```diff
@@ -7,7 +7,7 @@
 
 ## 课程内容
 
-### Setion 1 熟悉 Rust 语言基础知识
+### Section 1 熟悉 Rust 语言基础知识
 
 **学习资料：**
 
@@ -18,7 +18,7 @@
 
 * 完成  [Practical Networked Applications in Rust](https://github.com/pingcap/talent-plan/tree/master/rust) 中 Project 1、2（给该课程提出改进意见并帮助改进，根据意见及改进情况会有额外加分哦~）
 
-### Setion 1 熟悉 Rust 语言基础知识
+### Section 2 熟悉 Rust 语言基础知识
 
 **学习资料：**
 
@@ -29,7 +29,7 @@
 
 * 完成  [Practical Networked Applications in Rust](https://github.com/pingcap/talent-plan/tree/master/rust) 中 Project 3、4（给该课程提出改进意见并帮助改进，根据意见及改进情况会有额外加分哦~）
 
-### Setion 3 分布式存储基础知识
+### Section 3 分布式存储基础知识
 
 **学习资料：**
 
@@ -39,7 +39,7 @@
 
 * 使用 Rust 语言 完成 6.824 Lab 2 [raft 作业](https://github.com/pingcap/talent-plan/tree/master/dss)
 
-### Setion 4 分布式系统基础知识
+### Section 4 分布式系统基础知识
 
 **学习资料：**
 
@@ -49,7 +49,7 @@
 
 * 使用 Rust 语言 完成 6.824 Lab 3 [kvraft 作业](https://github.com/pingcap/talent-plan/tree/master/dss)
 
-### Setion 5  阅读 TiKV 源码
+### Section 5  阅读 TiKV 源码
 
 **学习资料：**
 
```

---

### Incident Patch 6: `2e03a033` (2020-03-04)
**Commit Message**: fix typo in description (#299)

Co-authored-by: Brian Anderson <[REDACTED_EMAIL]>

**File**: `rust/projects/project-1/README.md` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ curl https://sh.rustup.rs -sSf | sh
 
 (If you are running Windows then follow the instructions on rustup.rs. Note
 though that you will face more challenges than others during this course, as it
-was developed on Unix. In general, Rust development on Windows is as less
+was developed on Unix. In general, Rust development on Windows is a less
 polished experience than on Unix).
 
 Verify that the toolchain works by typing `rustc -V`. If that doesn't work, log
```

---

### Incident Patch 7: `02098e79` (2020-03-03)
**Commit Message**: dss: Update toolchain and fix clippy error (#308)

* dss: Update toolchain and fix clippy error

- There were some redundant_clone https://rust-lang.github.io/rust-clippy/master/#redundant_clone

* dss: Fix single component path imports

- https://rust-lang.github.io/rust-clippy/master/index.html#single_component_path_imports

**File**: `dss/labrpc/src/lib.rs` (modified, +1/-1)
```diff
@@ -1000,7 +1000,7 @@ mod tests {
     fn junk_suit() -> (Network, Server, JunkService) {
         let net = Network::new();
         let server_name = "test_server".to_owned();
-        let mut builder = ServerBuilder::new(server_name.clone());
+        let mut builder = ServerBuilder::new(server_name);
         let junk_server = JunkService::new();
         add_service(junk_server.clone(), &mut builder).unwrap();
         let server = builder.build();
```

**File**: `dss/percolator/src/tests.rs` (modified, +2/-2)
```diff
@@ -58,8 +58,8 @@ fn init(num_clinet: usize) -> (Network, Vec<Client>, Arc<CommitHooks>) {
     add_transaction_service(store, &mut server_builder).unwrap();
     let tso_server = tso_server_builder.build();
     let server = server_builder.build();
-    rn.add_server(tso_server.clone());
-    rn.add_server(server.clone());
+    rn.add_server(tso_server);
+    rn.add_server(server);
     let hook = Arc::new(CommitHooks {
         drop_req: AtomicBool::new(false),
         drop_resp: AtomicBool::new(false),
```

**File**: `dss/raft/src/kvraft/config.rs` (modified, +0/-2)
```diff
@@ -3,8 +3,6 @@ use std::sync::atomic::{AtomicUsize, Ordering};
 use std::sync::{Arc, Mutex};
 use std::time::{Duration, Instant};
 
-use labrpc;
-
 use crate::kvraft::errors::{Error, Result};
 use crate::kvraft::{client, server};
 use crate::proto::kvraftpb::*;
```

**File**: `dss/raft/src/raft/config.rs` (modified, +1/-2)
```diff
@@ -5,7 +5,6 @@ use std::thread;
 use std::time::{Duration, Instant};
 
 use futures::{sync::mpsc::unbounded, Future, Stream};
-use labrpc;
 
 use crate::proto::raftpb::*;
 use crate::raft;
@@ -422,7 +421,7 @@ impl Config {
         let mut builder = labrpc::ServerBuilder::new(format!("{}", i));
         raft::add_raft_service(node, &mut builder).unwrap();
         let srv = builder.build();
-        self.net.add_server(srv.clone());
+        self.net.add_server(srv);
     }
 
     /// shut down a Raft server but save its persistent state.
```

**File**: `dss/raft/src/raft/errors.rs` (modified, +0/-2)
```diff
@@ -1,7 +1,5 @@
 use std::{error, fmt, result};
 
-use labcodec;
-
 #[derive(Clone, Debug, PartialEq, Eq)]
 pub enum Error {
     Encode(labcodec::EncodeError),
```

**File**: `dss/rust-toolchain` (modified, +1/-1)
```diff
@@ -1 +1 @@
-nightly-2019-09-03
+nightly-2020-03-01
```

---

### Incident Patch 8: `3fe597c8` (2020-02-29)
**Commit Message**: rust/building-blocks: change BB3's exercise helping link on serd… (#306)

**File**: `rust/building-blocks/bb-3.md` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ Read all the readings and perform all the exercises.
 
 - **Exercise: Write a Redis ping-pong client and server with serialized
   messages**. Same as above, but this time define the protocol with types and
-  use [`serde` custom serialization][cs] to indirectly read and write messages
+  write a [`serde` data format][df] to indirectly read and write messages
   through serialization.
 
 - **[Reading: Statistically Rigorous Java Performance Evaluation][pe]**.
@@ -46,7 +46,7 @@ Read all the readings and perform all the exercises.
 <!-- TODO: something about traits? -->
 
 [pe]: https://dri.es/files/oopsla07-georges.pdf
-[cs]: https://serde.rs/custom-serialization.html
+[df]: https://serde.rs/data-format.html
 [`std::io`]: https://doc.rust-lang.org/std/io/
 [PING]: https://redis.io/commands/ping
 [commands]: https://redis.io/commands
```

#### Recent Merged Pull Requests:
- **PR #470** (closed): courses/dss: fixed compilation errors and clippy warnings (@kumarlokesh)
- **PR #468** (closed): Jchen/raft lab2a leader election (@drinkbeer)
- **PR #467** (closed): Fixing the clippy (@drinkbeer)
- **PR #460** (closed): Mine (@joema-m)
- **PR #457** (closed): Update tp102-how-to-use-git-github.md (@RTCFoundation)
- **PR #456** (closed): (WIP) raft with rust (@WenyXu)
- **PR #455** (closed): rust project-3 tests/cli.rs: revise mistyped "get",  (@Adamska1008)
- **PR #450** (closed): Update README.md (@Binlogo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
