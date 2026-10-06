# Forensic Learning Record (Deep Inspection): tensorchord/pgvecto.rs

> **Canonical Artifact**: `07_PROJECT_LEARNING/tensorchord-pgvecto.rs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tensorchord/pgvecto.rs](https://github.com/tensorchord/pgvecto.rs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:42:11.035Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tensorchord/pgvecto.rs`
- **Description**: Scalable, Low-latency and Hybrid-enabled Vector Search in Postgres. Revolutionize Vector Search, not Database.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2189 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/base/src/worker.rs`
```
use crate::distance::Distance;
use crate::index::*;
use crate::search::*;
use crate::vector::*;

pub trait WorkerOperations {
    fn create(
        &self,
        handle: Handle,
        options: IndexOptions,
        alterable_options: IndexAlterableOptions,
    ) -> Result<(), CreateError>;
    fn drop(&self, handle: Handle) -> Result<(), DropError>;
    fn flush(&self, handle: Handle) -> Result<(), FlushError>;
    fn insert(
        &self,
        handle: Handle,
        vector: OwnedVector,
        pointer: Pointer,
    ) -> Result<(), InsertError>;
    fn delete(&self, handle: Handle, pointer: Pointer) -> Result<(), DeleteError>;
    fn view_vbase(&self, handle: Handle) -> Result<impl ViewVbaseOperations, VbaseError>;
    fn view_list(&self, handle: Handle) -> Result<impl ViewListOperations, ListError>;
    fn stat(&self, handle: Handle) -> Result<IndexStat, StatError>;
    fn alter(&self, handle: Handle, key: &str, value: &str) -> Result<(), AlterError>;
    fn stop(&self, handle: Handle) -> Result<(), StopError>;
    fn start(&self, handle: Handle) -> Result<(), StartError>;
}

pub trait ViewVbaseOperations {
    fn vbase<'a>(
        &'a self,
        vector: &'a OwnedVector,
        opts: &'a SearchOptions,
    ) -> Result<Box<dyn Iterator<Item = (Distance, Pointer)> + 'a>, VbaseError>;
}

pub trait ViewListOperations {
    fn list(&self) -> Result<Box<dyn Iterator<Item = Pointer> + '_>, ListError>;
}

```

### Core Architecture Module: `crates/index/src/utils/dir_ops.rs`
```
use std::fs::read_dir;
use std::io;
use std::path::Path;

pub fn dir_size(dir: impl AsRef<Path>) -> io::Result<u64> {
    let mut size = 0;
    if dir.as_ref().is_dir() {
        for entry in read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let name = path.file_name().unwrap().to_string_lossy();
            if name.starts_with('.') {
                // ignore hidden files
                continue;
            }
            if path.is_dir() {
                size += dir_size(&path)?;
            } else {
                size += entry.metadata()?.len();
            }
        }
    }
    Ok(size)
}

```

### Core Architecture Module: `crates/index/src/utils/file_wal.rs`
```
use byteorder::NativeEndian as N;
use crc32fast::hash as crc32;
use std::path::Path;

/*
+----------+-----------+---------+
| CRC (4B) | Size (4B) | Payload |
+----------+-----------+---------+
*/

pub struct FileWal {
    file: std::fs::File,
    offset: usize,
    status: WalStatus,
}

impl FileWal {
    pub fn create(path: impl AsRef<Path>) -> Self {
        use WalStatus::*;
        let file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .read(true)
            .truncate(true)
            .open(path)
            .expect("Failed to create wal.");
        Self {
            file,
            offset: 0,
            status: Write,
        }
    }
    pub fn open(path: impl AsRef<Path>) -> Self {
        use WalStatus::*;
        let file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .read(true)
            .truncate(false)
            .open(path)
            .expect("Failed to open wal.");
        Self {
            file,
            offset: 0,
            status: Read,
        }
    }
    pub fn read(&mut self) -> Option<Vec<u8>> {
        use byteorder::ReadBytesExt;
        use std::io::Read;
        use WalStatus::*;
        let Read = self.status else {
            panic!("Operation not permitted.")
        };
        macro_rules! resolve_eof {
            ($t: expr) => {
                match $t {
                    Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                        self.status = Truncate;
                        return None;
                    }
                    Err(e) => panic!("{}", e),
                    Ok(e) => e,
                }
            };
        }
        let crc = resolve_eof!(self.file.read_u32::<N>());
        let len = resolve_eof!(self.file.read_u32::<N>());
        let mut data = vec![0u8; len as usize];
        resolve_eof!(self.file.read_exact(&mut data));
        if crc32(&data) != crc {
            self.status = Truncate;
            return None;
        }
        self.offset += 4 + 4 + data.len();
        Some(data)
    }
    pub fn truncate(&mut self) {
        use WalStatus::*;
        let Truncate = self.status else {
            panic!("Operation not permitted.")
        };
        self.file
            .set_len(self.offset as _)
            .expect("Failed to truncate wal.");
        self.file.sync_all().expect("Failed to flush wal.");
        self.status = Flush;
    }
    pub fn write(&mut self, bytes: &[u8]) {
        use byteorder::WriteBytesExt;
        use std::io::Write;
        use WalStatus::*;
        let (Write | Flush) = self.status else {
            panic!("Operation not permitted.")
        };
        self.file
            .write_u32::<N>(crc32(bytes))
            .expect("Failed to write wal.");
        self.file
            .write_u32::<N>(bytes.len() as _)
            .expect("Failed to write wal.");
        self.file.write_all(bytes).expect("Failed to write wal.");
        self.offset += 4 + 4 + bytes.len();
        self.status = Write;
    }
    pub fn sync_all(&mut self) {
        use WalStatus::*;
        let (Write | Flush) = self.status else {
            panic!("Operation not permitted.")
        };
        self.file.sync_all().expect("Failed to flush wal.");
        self.status = Flush;
    }
}

#[derive(Debug, Clone, Copy)]
enum WalStatus {
    Read,
    Truncate,
    Write,
    Flush,
}

```

### Core Architecture Module: `crates/index/src/utils/mod.rs`
```
pub mod dir_ops;
pub mod file_wal;
pub mod tournament_tree;

```

### Core Architecture Module: `crates/index/src/utils/tournament_tree.rs`
```
use std::cmp::Reverse;

pub struct LoserTree<I, T> {
    // 0..n
    iterators: Vec<I>,
    // 0..m
    x: Vec<Option<Reverse<T>>>,
    // 0..m, m = (winner: 1) + (losers: 2 ^ 0 + 2 ^ 1 + 2 ^ 2 + 2 ^ 3 + ... + 2 ^ (k - 1))
    losers: Vec<usize>,
}

impl<I> LoserTree<I, I::Item>
where
    I: Iterator,
    I::Item: Ord,
{
    pub fn new(mut iterators: Vec<I>) -> Self {
        let n = iterators.len();
        let m = n.next_power_of_two();
        let mut x = Vec::new();
        x.resize_with(m, || None);
        let mut losers = vec![usize::MAX; m];
        for i in 0..n {
            x[i] = iterators[i].next().map(Reverse);
        }
        let mut winners = vec![usize::MAX; 2 * m];
        for i in 0..m {
            winners[m + i] = i;
        }
        for i in (1..m).rev() {
            let (l, r) = (winners[i << 1], winners[i << 1 | 1]);
            (losers[i], winners[i]) = if x[l] < x[r] { (l, r) } else { (r, l) };
        }
        losers[0] = winners[1];
        Self {
            iterators,
            x,
            losers,
        }
    }
}

impl<I> Iterator for LoserTree<I, I::Item>
where
    I: Iterator,
    I::Item: Ord,
{
    type Item = I::Item;

    fn next(&mut self) -> Option<Self::Item> {
        let n = self.iterators.len();
        let m = n.next_power_of_two();
        let r = self.losers[0];
        let Reverse(result) = self.x[r].take()?;
        self.x[r] = self.iterators[r].next().map(Reverse);
        let mut v = r;
        let mut i = (m + r) >> 1;
        while i != 0 {
            if self.x[v] < self.x[self.losers[i]] {
                std::mem::swap(&mut v, &mut self.losers[i]);
            }
            i >>= 1;
        }
        self.losers[0] = v;
        Some(result)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use rand::Rng;

    fn check(seqs: &[Vec<u32>]) {
        let brute_force = {
            let mut result = Vec::new();
            let mut seqs = seqs
                .iter()
                .map(|x| x.clone().into_iter().peekable())
                .collect::<Vec<_>>();
            while !seqs.is_empty() {
                let mut index = 0usize;
                let mut value = u32::MAX;
                for (i, seq) in seqs.iter_mut().enumerate() {
                    if let Some(&x) = seq.peek() {
                        if x <= value {
                            index = i;
                            value = x;
                        }
                    }
                }
                let Some(_) = seqs[index].next() else { break };
                result.push(value);
            }
            result
        };
        let loser_tree = {
            let iterators = seqs.iter().map(|x| x.iter().copied()).collect();
            LoserTree::new(iterators).collect::<Vec<_>>()
        };
        assert_eq!(brute_force, loser_tree);
    }

    #[test]
    fn test_hardcode() {
        check(&[]);
        check(&[vec![0, 2, 4], vec![1, 3, 5], vec![], vec![], vec![]]);
        check(&[vec![], vec![], vec![], vec![], vec![]]);
        check(&[vec![1, 1, 1, 1, 1, 1]]);
        check(&[vec![1, 2, 3, 4, 5, 6], vec![1, 2, 3, 4, 5, 6]]);
        check(&[vec![2, 2, 3, 3, 4, 4, 5], vec![1, 1, 5, 6, 6]]);
    }

    #[test]
    fn test_random() {
        fn vec(n: usize) -> Vec<u32> {
            let mut vec = vec![0u32; n];
            vec.fill_with(|| rand::thread_rng().gen_range(0..100_000));
            vec.sort();
            vec
        }

        fn vecs() -> Vec<Vec<u32>> {
            use rand::Rng;
            let m = rand::thread_rng().gen_range(0..100);
            let mut vecs = Vec::new();
            for _ in 0..m {
                let n = rand::thread_rng().gen_range(0..10000);
                vecs.push(vec(n));
            }
            vecs
        }

        for _ in 0..10 {
            check(&vecs());
        }
    }
}

```

### Core Architecture Module: `crates/quantization/src/utils.rs`
```
#[derive(Debug, Clone)]
pub struct InfiniteByteChunks<I, const N: usize> {
    iter: I,
}

impl<I: Iterator, const N: usize> InfiniteByteChunks<I, N> {
    pub fn new(iter: I) -> Self {
        Self { iter }
    }
}

impl<I: Iterator<Item = u8>, const N: usize> Iterator for InfiniteByteChunks<I, N> {
    type Item = [u8; N];

    fn next(&mut self) -> Option<Self::Item> {
        Some(std::array::from_fn::<u8, N, _>(|_| {
            self.iter.next().unwrap_or(0)
        }))
    }
}

pub fn merge_8([b0, b1, b2, b3, b4, b5, b6, b7]: [u8; 8]) -> u8 {
    b0 | (b1 << 1) | (b2 << 2) | (b3 << 3) | (b4 << 4) | (b5 << 5) | (b6 << 6) | (b7 << 7)
}

pub fn merge_4([b0, b1, b2, b3]: [u8; 4]) -> u8 {
    b0 | (b1 << 2) | (b2 << 4) | (b3 << 6)
}

pub fn merge_2([b0, b1]: [u8; 2]) -> u8 {
    b0 | (b1 << 4)
}

```

### Core Architecture Module: `crates/service/src/worker.rs`
```
use crate::instance::*;
use arc_swap::ArcSwap;
use base::index::*;
use base::search::*;
use base::vector::*;
use base::worker::*;
use common::clean::clean;
use common::dir_ops::sync_walk_from_dir;
use common::file_atomic::FileAtomic;
use index::OutdatedError;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Arc;

pub struct Worker {
    path: PathBuf,
    protect: Mutex<WorkerProtect>,
    view: ArcSwap<WorkerView>,
}

impl Worker {
    pub fn create(path: PathBuf) -> Arc<Self> {
        std::fs::create_dir(&path).unwrap();
        std::fs::create_dir(path.join("indexes")).unwrap();
        let startup = FileAtomic::create(path.join("startup"), WorkerStartup::new());
        let indexes = HashMap::new();
        let view = Arc::new(WorkerView {
            indexes: indexes.clone(),
        });
        let protect = WorkerProtect { startup, indexes };
        sync_walk_from_dir(&path);
        Arc::new(Worker {
            path,
            protect: Mutex::new(protect),
            view: ArcSwap::new(view),
        })
    }
    pub fn open(path: PathBuf) -> Arc<Self> {
        let startup = FileAtomic::<WorkerStartup>::open(path.join("startup"));
        clean(
            path.join("indexes"),
            startup.get().indexes.iter().map(|s| s.to_string()),
        );
        let mut indexes = HashMap::new();
        for &id in startup.get().indexes.iter() {
            let path = path.join("indexes").join(id.to_string());
            let index = Instance::open(path);
            index.start();
            indexes.insert(id, index);
        }
        let view = Arc::new(WorkerView {
            indexes: indexes.clone(),
        });
        let protect = WorkerProtect { startup, indexes };
        Arc::new(Worker {
            path,
            protect: Mutex::new(protect),
            view: ArcSwap::new(view),
        })
    }
    fn view(&self) -> Arc<WorkerView> {
        self.view.load_full()
    }
}

impl WorkerOperations for Worker {
    fn create(
        &self,
        handle: Handle,
        options: IndexOptions,
        alterable_options: IndexAlterableOptions,
    ) -> Result<(), CreateError> {
        use std::collections::hash_map::Entry;
        let mut protect = self.protect.lock();
        match protect.indexes.entry(handle) {
            Entry::Vacant(o) => {
                let index = Instance::create(
                    self.path.join("indexes").join(handle.to_string()),
                    options,
                    alterable_options,
                )?;
                index.start();
                o.insert(index);
                protect.maintain(&self.view);
                Ok(())
            }
            // reindex
            Entry::Occupied(o) => {
                {
                    let index = o.remove();
                    protect.maintain(&self.view);
                    index.stop();
                    let tracker = index.wait();
                    drop(index);
                    loop {
                        if Arc::strong_count(&tracker) == 1 {
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(100));
                    }
                    drop(tracker);
                }
                {
                    let index = Instance::create(
                        self.path.join("indexes").join(handle.to_string()),
                        options,
                        alterable_options,
                    )?;
                    index.start();
                    protect.indexes.insert(handle, index);
                    protect.maintain(&self.view);
                }
                Ok(())
            }
        }
    }
    fn drop(&self, handle: Handle) -> Result<(), DropError> {
        let mut protect = self.protect.lock();
        if let Some(index) = protect.indexes.remove(&handle) {
            protect.maintain(&self.view);
            index.stop();
            let tracker = index.wait();
            drop(index);
            loop {
                if Arc::strong_count(&tracker) == 1 {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            drop(tracker);
            Ok(())
        } else {
            Err(DropError::NotExist)
        }
    }
    fn flush(&self, handle: Handle) -> Result<(), FlushError> {
        let view = self.view();
        let instance = view.get(handle).ok_or(FlushError::NotExist)?;
        let view = instance.view();
        view.flush()?;
        Ok(())
    }
    fn insert(
        &self,
        handle: Handle,
        vector: OwnedVector,
        pointer: Pointer,
    ) -> Result<(), InsertError> {
        let view = self.view();
        let instance = view.get(handle).ok_or(InsertError::NotExist)?;
        loop {
            let view = instance.view();
            match view.insert(vector.clone(), pointer)? {
                Ok(()) => break,
                Err(OutdatedError) => {
                    instance.refresh();
                }
            }
        }
        Ok(())
    }
    fn delete(&self, handle: Handle, pointer: Pointer) -> Result<(), DeleteError> {
        let view = self.view();
        let instance = view.get(handle).ok_or(DeleteError::NotExist)?;
        instance.delete(pointer)?;
        Ok(())
    }
    fn view_vbase(&self, handle: Handle) -> Result<impl ViewVbaseOperations, VbaseError> {
        let view = self.view();
        let instance = view.get(handle).ok_or(VbaseError::NotExist)?;
        Ok(instance.view())
    }
    fn view_list(&self, handle: Handle) -> Result<impl ViewListOperations, ListError> {
        let view = self.view();
        let instance = view.get(handle).ok_or(ListError::NotExist)?;
        Ok(instance.view())
    }
    fn stat(&self, handle: Handle) -> Result<IndexStat, StatError> {
        let view = self.view();
        let instance = view.get(handle).ok_or(StatError::NotExist)?;
        let stat = instance.stat();
        Ok(stat)
    }
    fn alter(&self, handle: Handle, key: &str, value: &str) -> Result<(), AlterError> {
        let view = self.view();
        let instance = view.get(handle).ok_or(AlterError::NotExist)?;
        instance.alter(key, value)
    }
    fn stop(&self, handle: Handle) -> Result<(), StopError> {
        let view = self.view();
        let instance = view.get(handle).ok_or(StopError::NotExist)?;
        instance.stop();
        Ok(())
    }
    fn start(&self, handle: Handle) -> Result<(), StartError> {
        let view = self.view();
        let instance = view.get(handle).ok_or(StartError::NotExist)?;
        instance.start();
        Ok(())
    }
}

pub struct WorkerView {
    indexes: HashMap<Handle, Instance>,
}

impl WorkerView {
    pub fn get(&self, handle: Handle) -> Option<&Instance> {
        self.indexes.get(&handle)
    }
}

struct WorkerProtect {
    startup: FileAtomic<WorkerStartup>,
    indexes: HashMap<Handle, Instance>,
}

impl WorkerProtect {
    fn maintain(&mut self, swap: &ArcSwap<WorkerView>) {
        let indexes = self.indexes.keys().copied().collect();
        self.startup.set(WorkerStartup { indexes });
        swap.swap(Arc::new(WorkerView {
            indexes: self.indexes.clone(),
        }));
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WorkerStartup {
    indexes: HashSet<Handle>,
}

impl WorkerStartup {
    pub fn new() -> Self {
        Self {
            indexes: HashSet::new(),
        }
    }
}

```

### Core Architecture Module: `src/bgworker/mod.rs`
```
pub mod normal;

use std::sync::atomic::{AtomicBool, Ordering};

static STARTED: AtomicBool = AtomicBool::new(false);

pub unsafe fn init() {
    use service::Version;
    let path = std::path::Path::new("pg_vectors");
    if !path.try_exists().unwrap() || Version::read(path.join("VERSION")).is_ok() {
        use pgrx::bgworkers::BackgroundWorkerBuilder;
        use pgrx::bgworkers::BgWorkerStartTime;
        use std::time::Duration;
        BackgroundWorkerBuilder::new("vectors")
            .set_library("vectors")
            .set_function("_vectors_main")
            .set_argument(None)
            .enable_shmem_access(None)
            .set_start_time(BgWorkerStartTime::PostmasterStart)
            .set_restart_time(Some(Duration::from_secs(15)))
            .load();
        STARTED.store(true, Ordering::Relaxed);
    }
}

pub fn is_started() -> bool {
    STARTED.load(Ordering::Relaxed)
}

#[pgrx::pg_guard]
#[no_mangle]
extern "C" fn _vectors_main(_arg: pgrx::pg_sys::Datum) {
    // for debugging, set `RUST_LOG=trace`
    crate::logger::Logger::new(
        match std::env::var("RUST_LOG").as_ref().map(|x| x.as_str()) {
            Ok("off" | "Off" | "OFF") => log::LevelFilter::Off,
            Ok("error" | "Error" | "ERROR") => log::LevelFilter::Error,
            Ok("warn" | "Warn" | "WARN") => log::LevelFilter::Warn,
            Ok("info" | "Info" | "INFO") => log::LevelFilter::Info,
            Ok("debug" | "Debug" | "DEBUG") => log::LevelFilter::Debug,
            Ok("trace" | "Trace" | "TRACE") => log::LevelFilter::Trace,
            _ => log::LevelFilter::Info, // default level
        },
    )
    .init()
    .expect("failed to set logger");
    std::panic::set_hook(Box::new(|info| {
        let message = if let Some(s) = info.payload().downcast_ref::<&str>() {
            format!("Message: {}", s)
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            format!("Message: {}", s)
        } else {
            String::new()
        };
        let location = info
            .location()
            .map(|location| {
                format!(
                    "Location: {}:{}:{}.",
                    location.file(),
                    location.line(),
                    location.column()
                )
            })
            .unwrap_or_default();
        // for debugging, set `RUST_BACKTRACE=1`
        let backtrace = format!("Backtrace: {}", std::backtrace::Backtrace::capture());
        log::error!("Panickied. {message}; {location}; {backtrace}");
    }));
    use service::Version;
    use service::Worker;
    use std::path::Path;
    let path = Path::new("pg_vectors");
    if path.try_exists().unwrap() {
        let worker = Worker::open(path.to_owned());
        normal::normal(worker);
    } else {
        let worker = Worker::create(path.to_owned());
        Version::write(path.join("VERSION"));
        normal::normal(worker);
    }
}

```

### Core Architecture Module: `src/bgworker/normal.rs`
```
use crate::ipc::ConnectionError;
use crate::ipc::{listen_mmap, listen_unix};
use crate::ipc::{ServerRpcHandle, ServerRpcHandler};
use service::Worker;
use std::convert::Infallible;
use std::sync::Arc;

pub fn normal(worker: Arc<Worker>) {
    std::thread::scope(|scope| {
        scope.spawn({
            let worker = worker.clone();
            move || {
                for rpc_handler in listen_unix() {
                    let worker = worker.clone();
                    std::thread::spawn({
                        move || {
                            log::trace!("Session established.");
                            let _ = session(worker, rpc_handler);
                            log::trace!("Session closed.");
                        }
                    });
                }
            }
        });
        scope.spawn({
            let worker = worker.clone();
            move || {
                for rpc_handler in listen_mmap() {
                    let worker = worker.clone();
                    std::thread::spawn({
                        move || {
                            log::trace!("Session established.");
                            let _ = session(worker, rpc_handler);
                            log::trace!("Session closed.");
                        }
                    });
                }
            }
        });
        loop {
            let mut sig: i32 = 0;
            unsafe {
                let mut set: libc::sigset_t = std::mem::zeroed();
                libc::sigemptyset(&mut set);
                libc::sigaddset(&mut set, libc::SIGQUIT);
                libc::sigaddset(&mut set, libc::SIGTERM);
                libc::sigwait(&set, &mut sig);
            }
            match sig {
                libc::SIGQUIT => {
                    std::process::exit(0);
                }
                libc::SIGTERM => {
                    std::process::exit(0);
                }
                _ => (),
            }
        }
    });
}

fn session(worker: Arc<Worker>, handler: ServerRpcHandler) -> Result<Infallible, ConnectionError> {
    use base::worker::*;
    let mut handler = handler;
    loop {
        match handler.handle()? {
            // control plane
            ServerRpcHandle::Create {
                handle,
                options,
                alterable_options,
                x,
            } => {
                handler = x.leave(WorkerOperations::create(
                    worker.as_ref(),
                    handle,
                    options,
                    alterable_options,
                ))?;
            }
            ServerRpcHandle::Drop { handle, x } => {
                handler = x.leave(WorkerOperations::drop(worker.as_ref(), handle))?;
            }
            // data plane
            ServerRpcHandle::Flush { handle, x } => {
                handler = x.leave(worker.flush(handle))?;
            }
            ServerRpcHandle::Insert {
                handle,
                vector,
                pointer,
                x,
            } => {
                handler = x.leave(worker.insert(handle, vector, pointer))?;
            }
            ServerRpcHandle::Delete { handle, pointer, x } => {
                handler = x.leave(worker.delete(handle, pointer))?;
            }
            ServerRpcHandle::Stat { handle, x } => {
                handler = x.leave(worker.stat(handle))?;
            }
            ServerRpcHandle::Alter {
                handle,
                key,
                value,
                x,
            } => {
                handler = x.leave(worker.alter(handle, &key, &value))?;
            }
            ServerRpcHandle::Vbase {
                handle,
                vector,
                opts,
                x,
            } => {
                let v = match worker.view_vbase(handle) {
                    Ok(x) => x,
                    Err(e) => {
                        handler = x.error_err(e)?;
                        continue;
                    }
                };
                match v.vbase(&vector, &opts) {
                    Ok(mut iter) => {
                        use crate::ipc::ServerVbaseHandle;
                        let mut x = x.error_ok()?;
                        loop {
                            match x.handle()? {
                                ServerVbaseHandle::Next { x: y } => {
                                    x = y.leave(iter.next())?;
                                }
                                ServerVbaseHandle::Leave { x } => {
                                    handler = x;
                                    break;
                                }
                            }
                        }
                    }
                    Err(e) => handler = x.error_err(e)?,
                };
            }
            ServerRpcHandle::List { handle, x } => {
                let v = match worker.view_list(handle) {
                    Ok(x) => x,
                    Err(e) => {
                        handler = x.error_err(e)?;
                        continue;
                    }
                };
                match v.list() {
                    Ok(mut iter) => {
                        use crate::ipc::ServerListHandle;
                        let mut x = x.error_ok()?;
                        loop {
                            match x.handle()? {
                                ServerListHandle::Next { x: y } => {
                                    x = y.leave(iter.next())?;
                                }
                                ServerListHandle::Leave { x } => {
                                    handler = x;
                                    break;
                                }
                            }
                        }
                    }
                    Err(e) => handler = x.error_err(e)?,
                };
            }
            ServerRpcHandle::Stop { handle, x } => {
                handler = x.leave(worker.stop(handle))?;
            }
            ServerRpcHandle::Start { handle, x } => {
                handler = x.leave(worker.start(handle))?;
            }
        }
    }
}

```

### Core Architecture Module: `src/index/hooks.rs`
```
static mut PREV_EXECUTOR_START: pgrx::pg_sys::ExecutorStart_hook_type = None;
static mut PREV_PROCESS_UTILITY: pgrx::pg_sys::ProcessUtility_hook_type = None;
static mut NEXT_OBJECT_ACCESS_HOOK: pgrx::pg_sys::object_access_hook_type = None;

#[pgrx::pg_guard]
unsafe extern "C" fn vectors_executor_start(
    query_desc: *mut pgrx::pg_sys::QueryDesc,
    eflags: ::std::os::raw::c_int,
) {
    unsafe {
        if let Some(prev_executor_start) = PREV_EXECUTOR_START {
            prev_executor_start(query_desc, eflags);
        } else {
            pgrx::pg_sys::standard_ExecutorStart(query_desc, eflags);
        }
    }
}

#[pgrx::pg_guard]
unsafe extern "C" fn vectors_process_utility(
    pstmt: *mut pgrx::pg_sys::PlannedStmt,
    query_string: *const ::std::os::raw::c_char,
    read_only_tree: bool,
    context: pgrx::pg_sys::ProcessUtilityContext::Type,
    params: pgrx::pg_sys::ParamListInfo,
    query_env: *mut pgrx::pg_sys::QueryEnvironment,
    dest: *mut pgrx::pg_sys::DestReceiver,
    completion_tag: *mut pgrx::pg_sys::QueryCompletion,
) {
    unsafe {
        super::compatibility::on_process_utility(pstmt);
    }
    unsafe {
        if let Some(prev_process_utility) = PREV_PROCESS_UTILITY {
            prev_process_utility(
                pstmt,
                query_string,
                read_only_tree,
                context,
                params,
                query_env,
                dest,
                completion_tag,
            );
        } else {
            pgrx::pg_sys::standard_ProcessUtility(
                pstmt,
                query_string,
                read_only_tree,
                context,
                params,
                query_env,
                dest,
                completion_tag,
            );
        }
    }
}

#[pgrx::pg_guard]
unsafe extern "C" fn vectors_object_access(
    access: pgrx::pg_sys::ObjectAccessType::Type,
    class_id: pgrx::pg_sys::Oid,
    object_id: pgrx::pg_sys::Oid,
    sub_id: i32,
    arg: *mut libc::c_void,
) {
    unsafe {
        super::catalog::on_object_access(access, class_id, object_id, sub_id, arg);
        if let Some(next_object_access) = NEXT_OBJECT_ACCESS_HOOK {
            next_object_access(access, class_id, object_id, sub_id, arg);
        }
    }
}

#[pgrx::pg_guard]
unsafe extern "C" fn xact_callback(
    event: pgrx::pg_sys::XactEvent::Type,
    _data: pgrx::void_mut_ptr,
) {
    match event {
        pgrx::pg_sys::XactEvent::XACT_EVENT_PRE_COMMIT
        | pgrx::pg_sys::XactEvent::XACT_EVENT_PARALLEL_PRE_COMMIT => unsafe {
            super::catalog::on_commit();
        },
        pgrx::pg_sys::XactEvent::XACT_EVENT_ABORT
        | pgrx::pg_sys::XactEvent::XACT_EVENT_PARALLEL_ABORT => unsafe {
            super::catalog::on_abort();
        },
        _ => {}
    }
}

pub unsafe fn init() {
    unsafe {
        PREV_EXECUTOR_START = pgrx::pg_sys::ExecutorStart_hook;
        pgrx::pg_sys::ExecutorStart_hook = Some(vectors_executor_start);
        PREV_PROCESS_UTILITY = pgrx::pg_sys::ProcessUtility_hook;
        pgrx::pg_sys::ProcessUtility_hook = Some(vectors_process_utility);
        NEXT_OBJECT_ACCESS_HOOK = pgrx::pg_sys::object_access_hook;
        pgrx::pg_sys::object_access_hook = Some(vectors_object_access);
    }
    unsafe {
        pgrx::pg_sys::RegisterXactCallback(Some(xact_callback), std::ptr::null_mut());
    }
}

```

### Core Architecture Module: `src/index/utils.rs`
```
use base::search::*;

pub fn from_oid_to_handle(oid: pgrx::pg_sys::Oid) -> Handle {
    let database_id = unsafe { pgrx::pg_sys::MyDatabaseId.as_u32() };
    let index_id = oid.as_u32();
    Handle::new(database_id, index_id)
}

pub fn pointer_to_ctid(pointer: Pointer) -> pgrx::pg_sys::ItemPointerData {
    let value = pointer.as_u64();
    pgrx::pg_sys::ItemPointerData {
        ip_blkid: pgrx::pg_sys::BlockIdData {
            bi_hi: ((value >> 32) & 0xffff) as u16,
            bi_lo: ((value >> 16) & 0xffff) as u16,
        },
        ip_posid: (value & 0xffff) as u16,
    }
}

pub fn ctid_to_pointer(ctid: pgrx::pg_sys::ItemPointerData) -> Pointer {
    let mut value = 0;
    value |= (ctid.ip_blkid.bi_hi as u64) << 32;
    value |= (ctid.ip_blkid.bi_lo as u64) << 16;
    value |= ctid.ip_posid as u64;
    Pointer::new(value)
}

```

### Core Architecture Module: `src/utils/cells.rs`
```
use std::cell::{Cell, RefCell};

pub struct PgCell<T>(Cell<T>);

unsafe impl<T: Send> Send for PgCell<T> {}
unsafe impl<T: Sync> Sync for PgCell<T> {}

impl<T> PgCell<T> {
    pub const unsafe fn new(x: T) -> Self {
        Self(Cell::new(x))
    }
}

impl<T: Copy> PgCell<T> {
    pub fn get(&self) -> T {
        self.0.get()
    }
    pub fn set(&self, value: T) {
        self.0.set(value);
    }
}

pub struct PgRefCell<T>(RefCell<T>);

unsafe impl<T: Send> Send for PgRefCell<T> {}
unsafe impl<T: Sync> Sync for PgRefCell<T> {}

impl<T> PgRefCell<T> {
    pub const unsafe fn new(x: T) -> Self {
        Self(RefCell::new(x))
    }
    pub fn borrow_mut(&self) -> std::cell::RefMut<'_, T> {
        self.0.borrow_mut()
    }
    #[allow(unused)]
    pub fn borrow(&self) -> std::cell::Ref<'_, T> {
        self.0.borrow()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #653** (2025-11-25): **Public API try_pod_read_unaligned causes Out-of-Bounds read due to missing length check**
  *Symptoms*: Hello, We are working on a static analysis tool designed to detect unsoundness and safety violations in Rust projects. We discovered a soundness issue in crates/base/src/pod.rs. Location: https://github.com/tensorchord/pgvecto.rs/blob/2b290b34e8ba69104ea2f800fa53328c6ed6c236/crates/base/src/pod.rs#L51 The vulnerability is located in the public function try_pod_read_unaligned: ``` pub fn try_pod_read_unaligned<T: Pod>(bytes: &[u8]) -> T {     unsafe { (bytes.as_ptr() as *const T).read_unaligned() } } ```  Since this function is pub and located in a pub mod, it is exposed to external consumers. Description: The function attempts to read a value of type T from a byte slice &[u8] using ptr::read_unaligned. While read_unaligned handles alignment correctly, it assumes the pointer is valid for std::mem::size_of::<T>() bytes. The function fails to verify that the input slice bytes has enough data to form a T. If bytes.len() < std::mem::size_of::<T>(), calling this function results in an immediate Buffer Over-read, which is Undefined Behavior (UB). As a safe function, it must verify the bounds before performing the unsafe read. Proof of Concept (PoC): We constructed a PoC where we attempt to read a u32 (4 bytes) from a slice containing only 1 byte. ``` use std::mem;  // Mocking the Pod trait definition from the crate pub unsafe trait Pod: Copy {} unsafe impl Pod for u32 {}  // The vulnerable function from crates/base/src/pod.rs pub fn try_pod_read_unaligned<T: Pod>(bytes: &[u8]) -> T 
  **Post-Mortem & Fix Analysis**:
  > same problem for https://github.com/tensorchord/pgvecto.rs/blob/2b290b34e8ba69104ea2f800fa53328c6ed6c236/crates/base/src/pod.rs#L38  and  https://github.com/tensorchord/pgvecto.rs/blob/2b290b34e8ba69104ea2f800fa53328c6ed6c236/crates/base/src/pod.rs#L42  but these are postcondition unsoundness
  > The project is no longer maintained. Existing users are migrating to https://github.com/tensorchord/VectorChord. If you discover any unsoundness there, please open a new issue.

- **Issue #649** (2025-08-19): **Does pgvecto.rs support iterative scan when using WHERE relational filters and LIMIT?**
  *Symptoms*: Hi, I’m currently using pgvecto.rs v0.3.0 and encountered a situation where, on different environments with the same dataset, I executed the same embedding search query using a SQL WHERE relational filter (not distance-based filtering) combined with LIMIT 10.  However, in one of the environments, the query only returned 1 chunk, while in the others, it consistently returned the expected 10 chunks.  I’d like to ask if pgvecto.rs supports something similar to pgvector v0.8.0’s iterative scan feature:  > If too few results from the initial index scan match the filters, the scan will continue until enough matching results are found. (In other words, when the ANN index can’t fulfill the LIMIT, it continues iterating through the HNSW graph until enough matching rows are found.) Ref: - https://www.postgresql.org/about/news/pgvector-080-released-2952/ - https://github.com/pgvector/pgvector/issues/671 - https://github.com/pgvector/pgvector/issues/259#issuecomment-2362500744  Does pgvecto.rs currently support this behavior, or is there a recommended workaround to ensure enough filtered results are returned across environments?  Thanks for your help!
  **Post-Mortem & Fix Analysis**:
  > Increase ef_search should solve your problem, like `SET vectors.hnsw_ef_search=512;`.  We no longer maintain pgvecto.rs now, and recommend user to migrate to VectorChord. It's faster and more stable in performance.  And for iterative scan, pgvecto.rs is the first one introduce it to postgres as VBASE filtering.
  > Thanks for the quick reply! I actually tried setting vectors.hnsw_ef_search = 10000; earlier — it did help, and the number of returned chunks increased from 1 to 3.  Thanks also for clarifying the maintenance status of pgvecto.rs and recommending VectorChord. I’ll take a closer look at it.  Appreciate your help!
  > Another trick is to use other index on your filter condition columns. You can simply do this write `ORDER BY distance + 0` instead of `ORDER BY distance`

- **Issue #644** (2025-03-15): **The extension is upgraded so all index files are outdated.**
  *Symptoms*: **I know i use immich here but the issue pertains to pgvecto.rs** https://pastebin.com/MYCAVpUH I get this error from my immich server when I start it, no errors from my postgres db, I would go to the linked documentation but the documentation website is down. So I went to the upgrading section of your new docs and also tried running these commands within the db: ``` ALTER EXTENSION vectors UPDATE; SELECT pgvectors_upgrade(); ``` Context:  I was on a migration from docker to k8s, I accidentally used regular postgres at 0.15 instead of 0.14 which was what it was prior, and then i tried changing the image to pgvector, I did the wrong version of pg vector until i downgraded and found the right one  Error: https://pastebin.com/Nr4ukMk0 The error is mainly this:  ``` microservices worker error: QueryFailedError: pgvecto.rs: The extension is upgraded so all index files are outdated. ADVICE: Delete all index files. Please read `https://docs.pgvecto.rs/admin/upgrading.html`, stack: QueryFailedError: pgvecto.rs: The extension is upgraded so all index files are outdated. ADVICE: Delete all index files. Please read `https://docs.pgvecto.rs/admin/upgrading.html`     at PostgresQueryRunner.query (/usr/src/app/node_modules/typeorm/driver/postgres/PostgresQueryRunner.js:219:19)     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)     at async AddCLIPEmbeddingIndex1700713994428.up (/usr/src/app/dist/migrations/1700713994428-AddCLIPEmbeddingIndex.js:14:9)     at 
  **Post-Mortem & Fix Analysis**:
  > Nevermind, turns out a few minor fixes, mainly restarting a few of my deployments re-running those commands fixed it (alter and select)

- **Issue #642** (2025-02-26): **docs: update to ghcr in README**
  *Symptoms*: 

- **Issue #641** (2025-02-27): **rootless images still run as root?**
  *Symptoms*: I'm trying to deploy a postgresCluster using Crunchy Postgres Operator with a tensorchord/pgvecto-rs rootless image. When deploying the PostgresCluster resource to my k3s-cluster I get the error "Error: container has runAsNonRoot and image will run as root". I reckon this is due to the CSS RunAsNonRoot: true that is set on the statefulset that is created by the operator.  I've tried two different images so far, pg16-v0.2.1-rootless &  pg17-v0.4.0-rootless and I get the same error on both. Am I missing something or could it be that the rootless images do run as root?
  **Post-Mortem & Fix Analysis**:
  > Can you try https://github.com/tensorchord/cloudnative-pgvecto.rs?
  > Thank you for the tip! I tried tensorchord/cloudnative-pgvecto-rs:17-v0.4.0 and got another, though similar, error:   "Error: container has runAsNonRoot and image has non-numeric user (postgres), cannot verify user is non-root"  I tried to manually play around in the statefulset of the -instance pod, using the cloudnative image. I added "runAsUser:1000" to all places where the image was used. That took me past that initial error but then gave me another seemingly unrelated error, something about "patrini $PATH not being found".  Has any of the images (either cloudnative or pgvecto.rs) successfully been used with crunchy pgo? Tried to google it but didn't find anything.  
  > I have no idea if this helps, but I did very simple new build based on tensorchord/pgvecto.rs:pg17-v0.4.0:  FROM tensorchord/pgvecto-rs:pg17-v0.4.0 USER 999   When I use this image I don't get any of the nonroot errors, but I get the same error I got with the cloudnative-pgvecto.rs image after I tinkerd with the statefulset.  "Error: failed to create containerd task: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "patroni": executable file not found in $PATH: unknown"  I'm really not sure if this is a bug or problem with combining the image with crunchy or if I messed up somewhere. Though it would be really nice to get the pgvecto.rs image to work with the operator for sure. 

- **Issue #640** (2025-02-24): **docs: add 'migrate to vectorchord' in readme**
  *Symptoms*: 

- **Issue #639** (2025-02-24): **chore: fix ghcr release**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > @kemingy thanks for pushing now to ghcr.io too. Would it be possible to push this tag to ghcr too: `tensorchord/pgvecto-rs:pg14-v0.2.0` since this would help users with Immich.  I assume this change was made because of the upcoming rate limit change on DockerHub on 1. April 2025
  > > @kemingy thanks for pushing now to ghcr.io too. Would it be possible to push this tag to ghcr too: `tensorchord/pgvecto-rs:pg14-v0.2.0` since this would help users with Immich. >  > I assume this change was made because of the upcoming rate limit change on DockerHub on 1. April 2025  All the formal releases have been synced to ghcr.
  > @kemingy thanks, I saw that it synced about 10 minutes ago... :) Sorry for the noise and thank you!

- **Issue #638** (2025-02-24): **chore: run rust test on ubuntu 22.04**
  *Symptoms*: 

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

### Incident Patch 1: `8ebab135` (2025-02-24)
**Commit Message**: chore: fix ghcr release (#639)

* test ghcr action

Signed-off-by: Keming <[REDACTED_EMAIL]>

* fix if

Signed-off-by: Keming <[REDACTED_EMAIL]>

* fix test

Signed-off-by: Keming <[REDACTED_EMAIL]>

---------

Signed-off-by: Keming <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +0/-1)
```diff
@@ -174,7 +174,6 @@ jobs:
           username: ${{ secrets.DOCKERIO_USERNAME }}
           password: ${{ secrets.DOCKERIO_TOKEN }}
       - name: Push postgres with pgvecto.rs to Docker Registry
-        if: matrix.rootless == false
         uses: docker/build-push-action@v4
         with:
           context: .
```

---

### Incident Patch 2: `eb9fbaee` (2025-01-17)
**Commit Message**: docs: fix discord and x badge (#632)

Signed-off-by: Keming <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -3,8 +3,8 @@
 </div>
 
 <p align=center>
-<a href="https://discord.gg/KqswhpVgdU"><img alt="discord invitation link" src="https://dcbadge.vercel.app/api/server/KqswhpVgdU?style=flat"></a>
-<a href="https://twitter.com/TensorChord"><img src="https://img.shields.io/twitter/follow/tensorchord?style=social" alt="trackgit-views" /></a>
+<a href="https://discord.gg/KqswhpVgdU"><img alt="discord invitation link" src="https://img.shields.io/discord/974584200327991326?style=flat&logo=discord&cacheSeconds=60"></a>
+<a href="https://twitter.com/TensorChord"><img src="https://img.shields.io/twitter/follow/tensorchord?style=flat&logo=X&cacheSeconds=60" alt="trackgit-views" /></a>
 <a href="https://hub.docker.com/r/tensorchord/pgvecto-rs"><img src="https://img.shields.io/docker/pulls/tensorchord/pgvecto-rs" /></a>
 <a href="https://github.com/tensorchord/pgvecto.rs#contributors-"><img alt="all-contributors" src="https://img.shields.io/github/all-contributors/tensorchord/pgvecto.rs/main"></a>
 </p>
```

---

### Incident Patch 3: `ae115754` (2025-01-01)
**Commit Message**: chore: Fix links (#627)

Signed-off-by: Ce Gao <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +12/-12)
```diff
@@ -13,7 +13,7 @@ pgvecto.rs is a Postgres extension that provides vector similarity search functi
 
 ## Comparison with pgvector
 
-Checkout [pgvecto.rs vs pgvector](https://docs.pgvecto.rs/faqs/comparison-pgvector.html) for more details.
+Checkout [pgvecto.rs vs pgvector](https://docs.vectorchord.ai/faqs/comparison-pgvector.html) for more details.
 
 | Feature | pgvecto.rs | pgvector |
 | --- | --- | --- |
@@ -24,19 +24,19 @@ Checkout [pgvecto.rs vs pgvector](https://docs.pgvecto.rs/faqs/comparison-pgvect
 | Indexing | Handles the storage and memory of indexes separately from PostgreSQL | Relies on the native storage engine of PostgreSQL |
 | WAL Support | Provides Write-Ahead Logging (WAL) support for data, index support is working in progress. | Provides Write-Ahead Logging (WAL) support for index and data. |                         |
 
-## [Documentation](https://docs.pgvecto.rs/getting-started/overview.html)
+## [Documentation](https://docs.vectorchord.ai/getting-started/overview.html)
 
 - Getting Started
-  - [Overview](https://docs.pgvecto.rs/getting-started/overview.html)
-  - [Installation](https://docs.pgvecto.rs/getting-started/installation.html)
+  - [Overview](https://docs.vectorchord.ai/getting-started/overview.html)
+  - [Installation](https://docs.vectorchord.ai/getting-started/installation.html)
 - Usage
-  - [Indexing](https://docs.pgvecto.rs/usage/indexing.html)
-  - [Search](https://docs.pgvecto.rs/usage/search.html)
+  - [Indexing](https://docs.vectorchord.ai/usage/indexing.html)
+  - [Search](https://docs.vectorchord.ai/usage/search.html)
 - Administration
-  - [Configuration](https://docs.pgvecto.rs/admin/configuration.html)
-  - [Upgrading from older versions](https://docs.pgvecto.rs/admin/upgrading.html)
+  - [Configuration](https://docs.vectorchord.ai/admin/configuration.html)
+  - [Upgrading from older versions](https://docs.vectorchord.ai/admin/upgrading.html)
 - Developers
-  - [Development Tutorial](https://docs.pgvecto.rs/developers/development.html)
+  - [Development Tutorial](https://docs.vectorchord.ai/developers/development.html)
 
 ## Quick start
 
@@ -119,15 +119,15 @@ SELECT * FROM items ORDER BY embedding <-> '[3,2,1]' LIMIT 5;
 
 ### A simple Question-Answering application
 
-Please check out the [Question-Answering application](https://docs.pgvecto.rs/use-case/question-answering.html) tutorial.
+Please check out the [Question-Answering application](https://docs.vectorchord.ai/use-case/question-answering.html) tutorial.
 
 ### Half-precision floating-point
 
 `vecf16` type is the same with `vector` in anything but the scalar type. It stores 16-bit floating point numbers. If you want to reduce the memory usage to get better performance, you can try to replace `vector` type with `vecf16` type.
 
 ## Roadmap 🗂️
 
-Please check out [ROADMAP](https://docs.pgvecto.rs/community/roadmap.html). Want to jump in? Welcome discussions and contributions!
+Please check out [ROADMAP](https://docs.vectorchord.ai/community/roadmap.html). Want to jump in? Welcome discussions and contributions!
 
 - Chat with us on [💬 Discord](https://discord.gg/KqswhpVgdU)
 - Have a look at [`good first issue 💖`](https://github.com/tensorchord/pgvecto.rs/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue+%E2%9D%A4%EF%B8%8F%22) issues!
@@ -137,7 +137,7 @@ Please check out [ROADMAP](https://docs.pgvecto.rs/community/roadmap.html). Want
 We welcome all kinds of contributions from the open-source community, individuals, and partners.
 
 - Join our [discord community](https://discord.gg/KqswhpVgdU)!
-- To build from the source, please read our [contributing documentation](https://docs.pgvecto.rs/community/contributing.html) and [development tutorial](https://docs.pgvecto.rs/developers/development.html).
+- To build from the source, please read our [contributing documentation](https://docs.vectorchord.ai/community/contributing.html) and [development tutorial](https://docs.vectorchord.ai/developers/development.html).
 
 ## Contributors ✨
 
```

---

### Incident Patch 4: `06e1c768` (2024-11-21)
**Commit Message**: fix: confict typmod for _vectors_cast_array_to_vecf32 (#617)

Signed-off-by: cutecutecat <[REDACTED_EMAIL]>

**File**: `sql/upgrade/vectors--0.3.0--0.4.0.sql` (modified, +38/-14)
```diff
@@ -907,16 +907,40 @@ IMMUTABLE STRICT PARALLEL SAFE
 LANGUAGE c /* Rust */
 AS 'MODULE_PATHNAME', '_vectors_cast_bvector_to_vecf32_wrapper';
 
--- src/datatype/casts.rs:10
--- vectors::datatype::casts::_vectors_cast_array_to_vecf32
-CREATE OR REPLACE FUNCTION "_vectors_cast_array_to_vecf32"(
-    "array" real[], /* pgrx::datum::array::Array<f32> */
-    "typmod" INT, /* i32 */
-    "_explicit" bool /* bool */
-) RETURNS vector /* vectors::datatype::memory_vecf32::Vecf32Output */
-IMMUTABLE STRICT PARALLEL SAFE
-LANGUAGE c /* Rust */
-AS 'MODULE_PATHNAME', '_vectors_cast_array_to_vecf32_wrapper';
+-- There might be a conflict of `typmod` or `_typmod`
+DO $$
+DECLARE
+    func_arg_2 TEXT;
+BEGIN
+    SELECT parameter_name INTO func_arg_2
+    FROM information_schema.routines
+        LEFT JOIN information_schema.parameters ON routines.specific_name=parameters.specific_name
+    WHERE routines.specific_schema='vectors' AND routines.routine_name='_vectors_cast_array_to_vecf32' AND parameters.ordinal_position=2 
+    ORDER BY routines.routine_name, parameters.ordinal_position;
+    IF func_arg_2 = '_typmod' THEN
+        -- src/datatype/casts.rs:10
+        -- vectors::datatype::casts::_vectors_cast_array_to_vecf32
+        CREATE OR REPLACE FUNCTION "_vectors_cast_array_to_vecf32"(
+            "array" real[], /* pgrx::datum::array::Array<f32> */
+            "_typmod" INT, /* i32 */
+            "_explicit" bool /* bool */
+        ) RETURNS vector /* vectors::datatype::memory_vecf32::Vecf32Output */
+        IMMUTABLE STRICT PARALLEL SAFE
+        LANGUAGE c /* Rust */
+        AS 'MODULE_PATHNAME', '_vectors_cast_array_to_vecf32_wrapper';
+    ELSE
+        -- src/datatype/casts.rs:10
+        -- vectors::datatype::casts::_vectors_cast_array_to_vecf32
+        CREATE OR REPLACE FUNCTION "_vectors_cast_array_to_vecf32"(
+            "array" real[], /* pgrx::datum::array::Array<f32> */
+            "typmod" INT, /* i32 */
+            "_explicit" bool /* bool */
+        ) RETURNS vector /* vectors::datatype::memory_vecf32::Vecf32Output */
+        IMMUTABLE STRICT PARALLEL SAFE
+        LANGUAGE c /* Rust */
+        AS 'MODULE_PATHNAME', '_vectors_cast_array_to_vecf32_wrapper';
+    END IF;
+END $$;
 
 -- src/datatype/subscript_bvector.rs:10
 -- vectors::datatype::subscript_bvector::_vectors_bvector_subscript
@@ -1239,10 +1263,10 @@ DROP FUNCTION _vectors_bvecf32_operator_cosine;
 DO $$
 DECLARE
     depcount_veci8 INT;
-	depcount_in INT;
-	depcount_out INT;
-	depcount_recv INT;
-	depcount_send INT;
+    depcount_in INT;
+    depcount_out INT;
+    depcount_recv INT;
+    depcount_send INT;
 BEGIN
     SELECT COUNT(*) INTO depcount_veci8 FROM pg_depend d WHERE d.refobjid = 'vectors.veci8'::regtype;
     SELECT COUNT(*) INTO depcount_in FROM pg_depend d WHERE d.refobjid = 'vectors._vectors_veci8_in(cstring,oid,integer)'::regprocedure;
```

---

### Incident Patch 5: `cc4776fe` (2024-11-05)
**Commit Message**: fix dockerfile pg version error (#611)

Signed-off-by: xieydd <[REDACTED_EMAIL]>

**File**: `docker/pg-slim/Dockerfile` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ COPY --from=tianon/gosu /gosu /usr/local/bin/
 RUN set -eux; \
     echo "unix_socket_directories = '/var/run/postgresql'" >> /usr/lib/postgresql/${PG_MAJOR}/share/postgresql.conf.sample; \
 	sed -ri "s!^#?(listen_addresses)\s*=\s*\S+.*!\1 = '*'!" /usr/lib/postgresql/${PG_MAJOR}/share/postgresql.conf.sample; \
-	grep -F "listen_addresses = '*'" /usr/lib/postgresql/16/share/postgresql.conf.sample
+	grep -F "listen_addresses = '*'" /usr/lib/postgresql/${PG_MAJOR}/share/postgresql.conf.sample
 
 RUN install --verbose --directory --owner postgres --group postgres --mode 3777 /var/run/postgresql
 
```

---

### Incident Patch 6: `1b979897` (2024-11-05)
**Commit Message**: fix docker build ci context error (#610)

Signed-off-by: xieydd <[REDACTED_EMAIL]>

**File**: `.github/workflows/release_enterprise.yml` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ jobs:
       - name: Push postgres with pgvecto.rs enterprise to Docker Registry
         uses: docker/build-push-action@v4
         with:
-          context: .
+          context: ./docker/pg-cnpg
           push: true
           platforms: "linux/${{ matrix.platform }}"
           file: ./docker/pg-cnpg/Dockerfile
```

**File**: `.github/workflows/release_pg_slim.yml` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ jobs:
       - name: Push binary release to Docker Registry
         uses: docker/build-push-action@v4
         with:
-          context: .
+          context: ./docker/pg-slim
           push: true
           platforms: "linux/${{ matrix.platform }}"
           file: ./docker/pg-slim/Dockerfile
```

**File**: `docker/pg-cnpg/Dockerfile` (modified, +2/-2)
```diff
@@ -23,7 +23,7 @@ RUN if [ -z "${PGDATA}" ]; then echo "PGDATA is not set"; exit 1; fi
 
 # Install trunk
 COPY --from=builder /usr/local/cargo/bin/trunk /usr/bin/trunk
-COPY ./requirements.txt .
+COPY requirements.txt .
 
 # Install barman-cloud
 RUN set -xe; \
@@ -171,7 +171,7 @@ RUN git clone https://github.com/EnterpriseDB/pg_failover_slots.git && \
 ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH
 
 # Test trunk
-COPY ./trunk-install.sh /usr/local/bin/
+COPY trunk-install.sh /usr/local/bin/
 
 # Change the uid of postgres to 26
 RUN usermod -u 26 postgres
```

**File**: `docker/pg-slim/Dockerfile` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ RUN install --verbose --directory --owner postgres --group postgres --mode 3777
 RUN install --verbose --directory --owner postgres --group postgres --mode 1777 ${PGDATA}
 
 ENV PATH $PATH:/usr/lib/postgresql/$PG_MAJOR/bin:/usr/local/bin
-COPY ./docker-entrypoint.sh ./docker-ensure-initdb.sh /usr/local/bin/
+COPY docker-entrypoint.sh docker-ensure-initdb.sh /usr/local/bin/
 RUN ln -sT docker-ensure-initdb.sh /usr/local/bin/docker-enforce-initdb.sh
 ENTRYPOINT ["docker-entrypoint.sh"]
 
```

---

### Incident Patch 7: `60cedfa0` (2024-11-04)
**Commit Message**: change requirement fix security issue (#609)

Signed-off-by: xieydd <[REDACTED_EMAIL]>

**File**: `.github/workflows/release_pg_slim.yml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ jobs:
     strategy:
       matrix:
         version: [14, 15, 16, 17]
-        platforms: "amd64,arm64"
+        platform: ["amd64", "arm64"]
     runs-on: ubuntu-latest
     env:
       PG_MAJOR: ${{ matrix.version }}
```

**File**: `docker/pg-cnpg/Dockerfile` (modified, +1/-1)
```diff
@@ -178,4 +178,4 @@ RUN usermod -u 26 postgres
 RUN chown -R postgres:postgres /usr/lib/postgresql/${PG_MAJOR}
 RUN cp /usr/share/postgresql/${PG_MAJOR}/extension/* /usr/lib/postgresql/${PG_MAJOR}/share/extension/
 USER 26
-ENV PATH $PATH:/usr/lib/postgresql/${PG_MAJOR}/bin
\ No newline at end of file
+ENV PATH $PATH:/usr/lib/postgresql/${PG_MAJOR}/bin
```

**File**: `docker/pg-cnpg/requirements.txt` (modified, +436/-387)
```diff
@@ -1,432 +1,484 @@
 #
-# This file is autogenerated by pip-compile with Python 3.8
+# This file is autogenerated by pip-compile with Python 3.11
 # by the following command:
 #
 #    pip-compile --generate-hashes
 #
-argcomplete==3.0.8 \
-    --hash=sha256:b9ca96448e14fa459d7450a4ab5a22bbf9cee4ba7adddf03e65c398b5daeea28 \
-    --hash=sha256:e36fd646839933cbec7941c662ecb65338248667358dd3d968405a4506a60d9b
-azure-core==1.26.4 \
-    --hash=sha256:075fe06b74c3007950dd93d49440c2f3430fd9b4a5a2756ec8c79454afc989c6 \
-    --hash=sha256:d9664b4bc2675d72fba461a285ac43ae33abb2967014a955bf136d9703a2ab3c
+azure-core==1.32.0 \
+    --hash=sha256:22b3c35d6b2dae14990f6c1be2912bf23ffe50b220e708a28ab1bb92b1c730e5 \
+    --hash=sha256:eac191a0efb23bfa83fddf321b27b122b4ec847befa3091fa736a5c32c50d7b4
     # via
     #   azure-identity
     #   azure-storage-blob
-azure-identity==1.13.0 \
-    --hash=sha256:bd700cebb80cd9862098587c29d8677e819beca33c62568ced6d5a8e5e332b82 \
-    --hash=sha256:c931c27301ffa86b07b4dcf574e29da73e3deba9ab5d1fe4f445bb6a3117e260
-azure-storage-blob==12.16.0 \
-    --hash=sha256:43b45f19a518a5c6895632f263b3825ebc23574f25cc84b66e1630a6160e466f \
-    --hash=sha256:91bb192b2a97939c4259c72373bac0f41e30810bbc853d5184f0f45904eacafd
-barman[azure,cloud,google,snappy]==3.5.0 \
-    --hash=sha256:078643961d421a5f54825d3da4bbd04faa94b96a6a0f6cefe23babdc53aff83a \
-    --hash=sha256:bea6885c1efe2e140b640d4b2daec8aff03563a5cee199a73f874ae39fede051
+azure-identity==1.19.0 \
+    --hash=sha256:500144dc18197d7019b81501165d4fa92225f03778f17d7ca8a2a180129a9c83 \
+    --hash=sha256:e3f6558c181692d7509f09de10cca527c7dce426776454fb97df512a46527e81
+azure-storage-blob==12.23.1 \
+    --hash=sha256:1c2238aa841d1545f42714a5017c010366137a44a0605da2d45f770174bfc6b4 \
+    --hash=sha256:a587e54d4e39d2a27bd75109db164ffa2058fe194061e5446c5a89bca918272f
+barman[azure,cloud,google,snappy]==3.11.1 \
+    --hash=sha256:295b9b7e058e064338f66ca0d10e4892e784a2347f06e4a225164995f6114498 \
+    --hash=sha256:4f424f3327cb24fb82d6a29dc1cdf02222b950c447c78273273d6eb76d7ce8d7
     # via -r requirements.in
-boto3==1.26.139 \
-    --hash=sha256:5b61a82f0c1cd006bd109ddf27c93d9b010c4c188fc583ee257ff6f3bb89970d \
-    --hash=sha256:fe19d287bc8ede385e1b9136f135ee8f93eab81404ad1445b1a70cabfe3f7087
-botocore==1.29.139 \
-    --hash=sha256:acc62710bdf11e47f4f26fb290a9082ff00377d7e93a16e1f080f9c789898114 \
-    --hash=sha256:b164af929eb2f1507833718de9eb8811e3adc6943b464c1869e95ac87f3bab88
+boto3==1.35.54 \
+    --hash=sha256:2d5e160b614db55fbee7981001c54476cb827c441cef65b2fcb2c52a62019909 \
+    --hash=sha256:7d9c359bbbc858a60b51c86328db813353c8bd1940212cdbd0a7da835291c2e1
+botocore==1.35.54 \
+    --hash=sha256:131bb59ce59c8a939b31e8e647242d70cf11d32d4529fa4dca01feea1e891a76 \
+    --hash=sha256:9cca1811094b6cdc144c2c063a3ec2db6d7c88194b04d4277cd34fc8e3473aff
     # via
     #   boto3
     #   s3transfer
-cachetools==5.3.0 \
-    --hash=sha256:13dfddc7b8df938c21a940dfa6557ce6e94a2f1cdfa58eb90c805721d58f2c14 \
-    --hash=sha256:429e1a1e845c008ea6c85aa35d4b98b65d6a9763eeef3e37e92728a12d1de9d4
+cachetools==5.5.0 \
+    --hash=sha256:02134e8439cdc2ffb62023ce1debca2944c3f289d66bb17ead3ab3dede74b292 \
+    --hash=sha256:2cc24fb4cbe39633fb7badd9db9ca6295d766d9c2995f245725a46715d050f2a
     # via google-auth
-certifi==2023.5.7 \
-    --hash=sha256:0f0d56dc5a6ad56fd4ba36484d6cc34451e1c6548c61daad8c320169f91eddc7 \
-    --hash=sha256:c6c2e98f5c7869efca1f8916fed228dd91539f9f1b444c314c06eef02980c716
+certifi==2024.8.30 \
+    --hash=sha256:922820b53db7a7257ffbda3f597266d435245903d80737e34f8a45ff3e3230d8 \
+    --hash=sha256:bec941d2aa8195e248a60b31ff9f0558284cf01a52591ceda73ea9afffd69fd9
     # via requests
-cffi==1.15.1 \
-    --hash=sha256:00a9ed42e88df81ffae7a8ab6d9356b371399b91dbdf0c3cb1e84c03a13aceb5 \
-    --hash=sha256:03425bdae262c76aad70202debd780501fabeaca237cdfddc008987c0e0f59ef \
-    --hash=sha256:04ed324bda3cda42b9b695d51bb7d54b680b9719cfab04227cdd1e04e5de3104 \
-    --hash=sha256:0e2642fe3142e4cc4af0799748233ad6da94c62a8bec3a6648bf8ee68b1c7426 \
-    --hash=sha256:173379135477dc8cac4bc58f45db08ab45d228b3363adb7af79436135d028405 \
-    --hash=sha256:198caafb44239b60e252492445da556afafc7d1e3ab7a1fb3f0584ef6d742375 \
-    --hash=sha256:1e74c6b51a9ed6589199c787bf5f9875612ca4a8a0785fb2d4a84429badaf22a \
-    --hash=sha256:2012c72d854c2d03e45d06ae57f40d78e5770d252f195b93f581acf3ba44496e \
-    --hash=sha256:21157295583fe8943475029ed5abdcf71eb3911894724e360acff1d61c1d54bc \
-    --hash=sha256:2470043b93ff09bf8fb1d46d1cb756ce6132c54826661a32d4e4d132e1977adf \
-    --hash=sha256:285d29981935eb726a4399badae8f0ffdff4f5050eaa6d0cfc3f64b857b77185 \
-    --hash=sha256:30d78fbc8ebf9c92c9b7823ee18eb92f2e6ef79b45ac84db507f52fbe3ec4497 \
-    --hash=sha256:320dab6e7cb2eacdf0e658569d2575c4dad258c0fcc794f46215e1e39f90f2c3 \
-    --hash=sha256:33ab79603146aace82c2427da5ca6e58f2b3f2fb5da893ceac0c42218a40be35 \
-    --hash=sha256:3548db281cd7d2561c9ad9984681c95f7b0e38
```

---

### Incident Patch 8: `c6da9392` (2024-10-15)
**Commit Message**: fix: aarch64 release CI (#606)

Signed-off-by: usamoi <[REDACTED_EMAIL]>

**File**: `.github/workflows/psql.yml` (modified, +0/-7)
```diff
@@ -77,13 +77,6 @@ jobs:
             ~/.cargo/registry/cache/
             ~/.cargo/git/db/
           key: ${{ github.job }}-${{ hashFiles('./Cargo.lock') }}-${{ matrix.version }}
-      - name: Set up Clang-16
-        run: |
-          sudo sh -c 'echo "deb http://apt.llvm.org/$(lsb_release -cs)/ llvm-toolchain-$(lsb_release -cs)-16 main" >> /etc/apt/sources.list'
-          wget --quiet -O - https://apt.llvm.org/llvm-snapshot.gpg.key | sudo apt-key add -
-          sudo apt-get update
-          sudo apt-get install -y clang-16
-          sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-16 128
       - name: Build
         run: |
           export PGRX_PG_CONFIG_PATH=$(pwd)/vendor/pg${VERSION}_${ARCH}_debian/pg_config/pg_config
```

**File**: `.github/workflows/release.yml` (modified, +5/-8)
```diff
@@ -59,7 +59,11 @@ jobs:
           sudo apt-get update
           sudo apt-get install -y build-essential crossbuild-essential-arm64
           sudo apt-get install -y qemu-user-static
-          echo 'target.aarch64-unknown-linux-gnu.linker = "aarch64-linux-gnu-gcc"' | tee ~/.cargo/config.toml
+          touch ~/.cargo/config.toml
+          echo 'target.aarch64-unknown-linux-gnu.linker = "aarch64-linux-gnu-gcc"' >> ~/.cargo/config.toml
+          echo 'target.aarch64-unknown-linux-gnu.runner = ["qemu-aarch64-static", "-L", "/usr/aarch64-linux-gnu"]' >> ~/.cargo/config.toml
+          rustup target add x86_64-unknown-linux-gnu
+          rustup target add aarch64-unknown-linux-gnu
       - name: Set up Sccache
         uses: mozilla-actions/sccache-action@v0.0.4
       - name: Set up Cache
@@ -71,13 +75,6 @@ jobs:
             ~/.cargo/registry/cache/
             ~/.cargo/git/db/
           key: ${{ github.job }}-${{ hashFiles('./Cargo.lock') }}-${{ matrix.version }}-${{ matrix.arch }}
-      - name: Set up Clang-16
-        run: |
-          sudo sh -c 'echo "deb http://apt.llvm.org/$(lsb_release -cs)/ llvm-toolchain-$(lsb_release -cs)-16 main" >> /etc/apt/sources.list'
-          wget --quiet -O - https://apt.llvm.org/llvm-snapshot.gpg.key | sudo apt-key add -
-          sudo apt-get update
-          sudo apt-get install -y clang-16
-          sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-16 128
       - name: Build
         run: |
           export PGRX_PG_CONFIG_PATH=$(pwd)/vendor/pg${VERSION}_${ARCH}_debian/pg_config/pg_config
```

**File**: `.github/workflows/release_enterprise.yml` (modified, +0/-7)
```diff
@@ -73,13 +73,6 @@ jobs:
             ~/.cargo/registry/cache/
             ~/.cargo/git/db/
           key: ${{ github.job }}-${{ hashFiles('./Cargo.lock') }}-${{ matrix.version }}-${{ matrix.arch }}
-      - name: Set up Clang-16
-        run: |
-          sudo sh -c 'echo "deb http://apt.llvm.org/$(lsb_release -cs)/ llvm-toolchain-$(lsb_release -cs)-16 main" >> /etc/apt/sources.list'
-          wget --quiet -O - https://apt.llvm.org/llvm-snapshot.gpg.key | sudo apt-key add -
-          sudo apt-get update
-          sudo apt-get install -y clang-16
-          sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-16 128
       - name: Schema
         run: |
           echo -n $PGVECTORS_SCHEMA > .schema
```

**File**: `.github/workflows/rust.yml` (modified, +0/-7)
```diff
@@ -78,13 +78,6 @@ jobs:
             ~/.cargo/registry/cache/
             ~/.cargo/git/db/
           key: ${{ github.job }}-${{ hashFiles('./Cargo.lock') }}-${{ matrix.arch }}
-      - name: Set up Clang-16
-        run: |
-          sudo sh -c 'echo "deb http://apt.llvm.org/$(lsb_release -cs)/ llvm-toolchain-$(lsb_release -cs)-16 main" >> /etc/apt/sources.list'
-          wget --quiet -O - https://apt.llvm.org/llvm-snapshot.gpg.key | sudo apt-key add -
-          sudo apt-get update
-          sudo apt-get install -y clang-16
-          sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-16 128
       - name: Clippy
         run: |
           cargo clippy --workspace --exclude pgvectors --exclude pyvectors --target $ARCH-unknown-linux-gnu
```

**File**: `crates/quantization/src/quantize.rs` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ mod mul_add_round {
             // this hint is used to disable loop unrolling
             while std::hint::black_box(n) > 0 {
                 let x = a.read();
-                let v = (k * x + b).round_ties_even() as u8;
+                let v = x.mul_add(k, b).round_ties_even() as u8;
                 r.write(v);
                 n -= 1;
                 a = a.add(1);
```

---

### Incident Patch 9: `b3d32439` (2024-09-24)
**Commit Message**: feat: mark GUC prefix reserved (#599)

Signed-off-by: usamoi <[REDACTED_EMAIL]>

**File**: `src/gucs/embedding.rs` (modified, +15/-3)
```diff
@@ -1,11 +1,23 @@
-use super::guc_string_parse;
 use embedding::OpenAIOptions;
 use pgrx::guc::{GucContext, GucFlags, GucRegistry, GucSetting};
 use std::ffi::CStr;
 
 pub fn openai_options() -> OpenAIOptions {
-    let base_url = guc_string_parse(&OPENAI_BASE_URL, "vectors.openai_base_url");
-    let api_key = guc_string_parse(&OPENAI_API_KEY, "vectors.openai_api_key");
+    use crate::error::*;
+    use pgrx::guc::GucSetting;
+    use std::ffi::CStr;
+    fn parse(target: &'static GucSetting<Option<&'static CStr>>, name: &'static str) -> String {
+        let value = match target.get() {
+            Some(s) => s,
+            None => bad_guc_literal(name, "should not be `NULL`"),
+        };
+        match value.to_str() {
+            Ok(s) => s.to_string(),
+            Err(_e) => bad_guc_literal(name, "should be a valid UTF-8 string"),
+        }
+    }
+    let base_url = parse(&OPENAI_BASE_URL, "vectors.openai_base_url");
+    let api_key = parse(&OPENAI_API_KEY, "vectors.openai_api_key");
     OpenAIOptions { base_url, api_key }
 }
 
```

**File**: `src/gucs/mod.rs` (modified, +4/-18)
```diff
@@ -1,7 +1,3 @@
-use crate::error::*;
-use pgrx::guc::GucSetting;
-use std::ffi::CStr;
-
 pub mod embedding;
 pub mod executing;
 pub mod internal;
@@ -13,19 +9,9 @@ pub unsafe fn init() {
         internal::init();
         executing::init();
         embedding::init();
-    }
-}
-
-fn guc_string_parse(
-    target: &'static GucSetting<Option<&'static CStr>>,
-    name: &'static str,
-) -> String {
-    let value = match target.get() {
-        Some(s) => s,
-        None => bad_guc_literal(name, "should not be `NULL`"),
-    };
-    match value.to_str() {
-        Ok(s) => s.to_string(),
-        Err(_e) => bad_guc_literal(name, "should be a valid UTF-8 string"),
+        #[cfg(feature = "pg14")]
+        pgrx::pg_sys::EmitWarningsOnPlaceholders(c"vectors".as_ptr());
+        #[cfg(any(feature = "pg15", feature = "pg16", feature = "pg17"))]
+        pgrx::pg_sys::MarkGUCPrefixReserved(c"vectors".as_ptr());
     }
 }
```

---

### Incident Patch 10: `1d723fe2` (2024-09-23)
**Commit Message**: refactor: make SQ build & preprocess faster (#596)

* chore: rename inverted_index to sparse_inverted_index

Signed-off-by: usamoi <[REDACTED_EMAIL]>

* refactor: make scalar quantization faster

Signed-off-by: usamoi <[REDACTED_EMAIL]>

---------

Signed-off-by: usamoi <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +11/-11)
```diff
@@ -1518,9 +1518,9 @@ dependencies = [
  "base",
  "flat",
  "hnsw",
- "inverted",
  "ivf",
  "quantization",
+ "sparse_inverted_index",
  "thiserror",
 ]
 
@@ -1557,16 +1557,6 @@ dependencies = [
  "ulock-sys",
 ]
 
-[[package]]
-name = "inverted"
-version = "0.0.0"
-dependencies = [
- "base",
- "common",
- "quantization",
- "storage",
-]
-
 [[package]]
 name = "io-lifetimes"
 version = "1.0.11"
@@ -3028,6 +3018,16 @@ dependencies = [
  "windows-sys 0.52.0",
 ]
 
+[[package]]
+name = "sparse_inverted_index"
+version = "0.0.0"
+dependencies = [
+ "base",
+ "common",
+ "quantization",
+ "storage",
+]
+
 [[package]]
 name = "spin"
 version = "0.9.8"
```

**File**: `crates/base/src/index.rs` (modified, +31/-33)
```diff
@@ -104,51 +104,49 @@ pub struct IndexOptions {
 }
 
 impl IndexOptions {
-    fn validate_self_quantization(
-        &self,
-        quantization: &Option<QuantizationOptions>,
-    ) -> Result<(), ValidationError> {
-        match quantization {
-            None => Ok(()),
-            Some(
-                QuantizationOptions::Scalar(_)
-                | QuantizationOptions::Product(_)
-                | QuantizationOptions::Rabitq(_),
-            ) => {
-                if !matches!(self.vector.v, VectorKind::Vecf32 | VectorKind::Vecf16) {
-                    return Err(ValidationError::new(
-                        "quantization is not support for vectors that are not dense vectors",
-                    ));
-                }
-                Ok(())
-            }
-        }
-    }
     fn validate_self(&self) -> Result<(), ValidationError> {
         match &self.indexing {
             IndexingOptions::Flat(FlatIndexingOptions { quantization }) => {
-                self.validate_self_quantization(quantization)?;
+                if quantization.is_some()
+                    && !matches!(self.vector.v, VectorKind::Vecf32 | VectorKind::Vecf16)
+                {
+                    return Err(ValidationError::new(
+                        "quantization is only supported for dense vectors",
+                    ));
+                }
             }
             IndexingOptions::Ivf(IvfIndexingOptions { quantization, .. }) => {
                 if !matches!(self.vector.v, VectorKind::Vecf32 | VectorKind::Vecf16) {
                     return Err(ValidationError::new(
-                        "ivf is not support for vectors that are not dense vectors",
+                        "ivf is only supported for dense vectors",
+                    ));
+                }
+                if quantization.is_some()
+                    && !matches!(self.vector.v, VectorKind::Vecf32 | VectorKind::Vecf16)
+                {
+                    return Err(ValidationError::new(
+                        "quantization is only supported for dense vectors",
                     ));
                 }
-                self.validate_self_quantization(quantization)?;
             }
             IndexingOptions::Hnsw(HnswIndexingOptions { quantization, .. }) => {
-                self.validate_self_quantization(quantization)?;
-            }
-            IndexingOptions::InvertedIndex(_) => {
-                if !matches!(self.vector.d, DistanceKind::Dot) {
+                if quantization.is_some()
+                    && !matches!(self.vector.v, VectorKind::Vecf32 | VectorKind::Vecf16)
+                {
                     return Err(ValidationError::new(
-                        "inverted_index is not support for distance that is not negative dot product",
+                        "quantization is only supported for dense vectors",
                     ));
                 }
+            }
+            IndexingOptions::SparseInvertedIndex(_) => {
                 if !matches!(self.vector.v, VectorKind::SVecf32) {
                     return Err(ValidationError::new(
-                        "inverted_index is not support for vectors that are not sparse vectors",
+                        "sparse_inverted_index is only supported for sparse vectors",
+                    ));
+                }
+                if !matches!(self.vector.d, DistanceKind::Dot) {
+                    return Err(ValidationError::new(
+                        "sparse_inverted_index is only supported for dot distance",
                     ));
                 }
             }
@@ -284,7 +282,7 @@ pub enum IndexingOptions {
     Flat(FlatIndexingOptions),
     Ivf(IvfIndexingOptions),
     Hnsw(HnswIndexingOptions),
-    InvertedIndex(InvertedIndexingOptions),
+    SparseInvertedIndex(SparseInvertedIndexIndexingOptions),
 }
 
 impl IndexingOptions {
@@ -320,16 +318,16 @@ impl Validate for IndexingOptions {
             Self::Flat(x) => x.validate(),
             Self::Ivf(x) => x.validate(),
             Self::Hnsw(x) => x.validate(),
-            Self::InvertedIndex(x) => x.validate(),
+            Self::SparseInvertedIndex(x) => x.validate(),
         }
     }
 }
 
 #[derive(Debug, Clone, Serialize, Deserialize, Validate)]
 #[serde(deny_unknown_fields)]
-pub struct InvertedIndexingOptions {}
+pub struct SparseInvertedIndexIndexingOptions {}
 
-impl Default for InvertedIndexingOptions {
+impl Default for SparseInvertedIndexIndexingOptions {
     fn default() -> Self {
         Self {}
     }
```

**File**: `crates/base/src/operator/mod.rs` (modified, +0/-1)
```diff
@@ -23,5 +23,4 @@ pub trait Operator: Copy + 'static + Send + Sync {
     fn distance(lhs: Borrowed<'_, Self>, rhs: Borrowed<'_, Self>) -> Distance;
 }
 
-pub type Owned<T> = <T as Operator>::Vector;
 pub type Borrowed<'a, T> = <<T as Operator>::Vector as VectorOwned>::Borrowed<'a>;
```

**File**: `crates/flat/src/lib.rs` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@ impl<O: OperatorFlat, Q: Quantizer<O>> Flat<O, Q> {
     pub fn create(
         path: impl AsRef<Path>,
         options: IndexOptions,
-        source: &(impl Vectors<Owned<O>> + Collection + Source + Sync),
+        source: &(impl Vectors<O::Vector> + Collection + Source + Sync),
     ) -> Self {
         let remapped = RemappedCollection::from_source(source);
         from_nothing(path, options, &remapped)
@@ -83,7 +83,7 @@ impl<O: OperatorFlat, Q: Quantizer<O>> Flat<O, Q> {
 fn from_nothing<O: OperatorFlat, Q: Quantizer<O>>(
     path: impl AsRef<Path>,
     options: IndexOptions,
-    collection: &(impl Vectors<Owned<O>> + Collection + Sync),
+    collection: &(impl Vectors<O::Vector> + Collection + Sync),
 ) -> Flat<O, Q> {
     create_dir(path.as_ref()).unwrap();
     let flat_indexing_options = options.indexing.clone().unwrap_flat();
```

**File**: `crates/hnsw/src/lib.rs` (modified, +3/-3)
```diff
@@ -46,7 +46,7 @@ impl<O: OperatorHnsw, Q: Quantizer<O>> Hnsw<O, Q> {
     pub fn create(
         path: impl AsRef<Path>,
         options: IndexOptions,
-        source: &(impl Vectors<Owned<O>> + Collection + Source + Sync),
+        source: &(impl Vectors<O::Vector> + Collection + Source + Sync),
     ) -> Self {
         let remapped = RemappedCollection::from_source(source);
         if let Some(main) = source.get_main::<Self>() {
@@ -116,7 +116,7 @@ impl<O: OperatorHnsw, Q: Quantizer<O>> Hnsw<O, Q> {
 fn from_nothing<O: OperatorHnsw, Q: Quantizer<O>>(
     path: impl AsRef<Path>,
     options: IndexOptions,
-    collection: &(impl Vectors<Owned<O>> + Collection + Sync),
+    collection: &(impl Vectors<O::Vector> + Collection + Sync),
 ) -> Hnsw<O, Q> {
     create_dir(path.as_ref()).unwrap();
     let HnswIndexingOptions {
@@ -198,7 +198,7 @@ fn from_nothing<O: OperatorHnsw, Q: Quantizer<O>>(
 fn from_main<O: OperatorHnsw, Q: Quantizer<O>>(
     path: impl AsRef<Path>,
     options: IndexOptions,
-    remapped: &RemappedCollection<Owned<O>, impl Vectors<Owned<O>> + Collection + Sync>,
+    remapped: &RemappedCollection<O::Vector, impl Vectors<O::Vector> + Collection + Sync>,
     main: &Hnsw<O, Q>,
 ) -> Hnsw<O, Q> {
     create_dir(path.as_ref()).unwrap();
```

**File**: `crates/index/src/lib.rs` (modified, +2/-2)
```diff
@@ -316,7 +316,7 @@ impl<O: Op> Index<O> {
     }
     pub fn create_sealed_segment(
         &self,
-        source: &(impl Vectors<Owned<O>> + Collection + Source + Sync),
+        source: &(impl Vectors<O::Vector> + Collection + Source + Sync),
         sealed_segment_ids: &[NonZeroU128],
         growing_segment_ids: &[NonZeroU128],
     ) -> Option<Arc<SealedSegment<O>>> {
@@ -444,7 +444,7 @@ impl<O: Op> IndexView<O> {
     }
     pub fn insert(
         &self,
-        vector: Owned<O>,
+        vector: O::Vector,
         pointer: Pointer,
     ) -> Result<Result<(), OutdatedError>, InsertError> {
         if self.options.vector.dims != vector.as_borrowed().dims() {
```

**File**: `crates/index/src/optimizing/index_source.rs` (modified, +8/-8)
```diff
@@ -2,7 +2,7 @@ use crate::delete::Delete;
 use crate::Op;
 use crate::{GrowingSegment, SealedSegment};
 use base::index::IndexOptions;
-use base::operator::{Borrowed, Owned};
+use base::operator::Borrowed;
 use base::search::*;
 use std::any::Any;
 use std::fmt::Debug;
@@ -17,7 +17,7 @@ pub struct IndexSource<V, O: Op> {
     _phantom: PhantomData<fn(V) -> V>,
 }
 
-impl<O: Op> IndexSource<Owned<O>, O> {
+impl<O: Op> IndexSource<O::Vector, O> {
     pub fn new(
         options: IndexOptions,
         sealed: Option<Arc<SealedSegment<O>>>,
@@ -34,7 +34,7 @@ impl<O: Op> IndexSource<Owned<O>, O> {
     }
 }
 
-impl<O: Op> Vectors<Owned<O>> for IndexSource<Owned<O>, O> {
+impl<O: Op> Vectors<O::Vector> for IndexSource<O::Vector, O> {
     fn dims(&self) -> u32 {
         self.dims
     }
@@ -61,7 +61,7 @@ impl<O: Op> Vectors<Owned<O>> for IndexSource<Owned<O>, O> {
     }
 }
 
-impl<O: Op> Collection for IndexSource<Owned<O>, O> {
+impl<O: Op> Collection for IndexSource<O::Vector, O> {
     fn payload(&self, mut index: u32) -> Payload {
         for x in self.sealed.iter() {
             if index < x.len() {
@@ -79,7 +79,7 @@ impl<O: Op> Collection for IndexSource<Owned<O>, O> {
     }
 }
 
-impl<O: Op> Source for IndexSource<Owned<O>, O> {
+impl<O: Op> Source for IndexSource<O::Vector, O> {
     fn get_main<T: Any>(&self) -> Option<&T> {
         let x = self.sealed.as_ref()?;
         Some(
@@ -104,7 +104,7 @@ pub struct RoGrowingCollection<V, O: Op> {
     _phantom: PhantomData<fn(V) -> V>,
 }
 
-impl<O: Op> Debug for RoGrowingCollection<Owned<O>, O> {
+impl<O: Op> Debug for RoGrowingCollection<O::Vector, O> {
     fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
         f.debug_struct("RoGrowingCollection")
             .field("growing", &self.growing)
@@ -113,7 +113,7 @@ impl<O: Op> Debug for RoGrowingCollection<Owned<O>, O> {
     }
 }
 
-impl<O: Op> Vectors<Owned<O>> for RoGrowingCollection<Owned<O>, O> {
+impl<O: Op> Vectors<O::Vector> for RoGrowingCollection<O::Vector, O> {
     fn dims(&self) -> u32 {
         self.dims
     }
@@ -133,7 +133,7 @@ impl<O: Op> Vectors<Owned<O>> for RoGrowingCollection<Owned<O>, O> {
     }
 }
 
-impl<O: Op> Collection for RoGrowingCollection<Owned<O>, O> {
+impl<O: Op> Collection for RoGrowingCollection<O::Vector, O> {
     fn payload(&self, mut index: u32) -> Payload {
         for x in self.growing.iter() {
             if index < x.len() {
```

**File**: `crates/index/src/optimizing/indexing.rs` (modified, +2/-3)
```diff
@@ -1,14 +1,13 @@
 use crate::optimizing::index_source::IndexSource;
 use crate::Index;
 use crate::Op;
-use base::operator::Owned;
 use std::sync::Arc;
 
 pub fn scan<O: Op>(
     index: Arc<Index<O>>,
     capacity: u32,
     delete_threshold: f64,
-) -> Option<IndexSource<Owned<O>, O>> {
+) -> Option<IndexSource<O::Vector, O>> {
     let (sealed, growing) = 'a: {
         let protect = index.protect.lock();
         // approach 1: merge small segments to a big segment
@@ -87,7 +86,7 @@ pub fn scan<O: Op>(
     ))
 }
 
-pub fn make<O: Op>(index: Arc<Index<O>>, source: IndexSource<Owned<O>, O>) {
+pub fn make<O: Op>(index: Arc<Index<O>>, source: IndexSource<O::Vector, O>) {
     let _ = index.create_sealed_segment(
         &source,
         &source.sealed.iter().map(|x| x.id()).collect::<Vec<_>>(),
```

---

### Incident Patch 11: `22904a69` (2024-09-23)
**Commit Message**: fix: reduce length of directory name (#588)

Signed-off-by: usamoi <[REDACTED_EMAIL]>

**File**: `crates/base/src/search.rs` (modified, +2/-10)
```diff
@@ -9,17 +9,13 @@ use std::fmt::Display;
 
 #[derive(Debug, Clone, Copy, Hash, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
 pub struct Handle {
-    tenant_id: u128,
-    cluster_id: u64,
     database_id: u32,
     index_id: u32,
 }
 
 impl Handle {
-    pub fn new(tenant_id: u128, cluster_id: u64, database_id: u32, index_id: u32) -> Self {
+    pub fn new(database_id: u32, index_id: u32) -> Self {
         Self {
-            tenant_id,
-            cluster_id,
             database_id,
             index_id,
         }
@@ -28,11 +24,7 @@ impl Handle {
 
 impl Display for Handle {
     fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
-        write!(
-            f,
-            "{:032x}{:016x}{:08x}{:08x}",
-            self.tenant_id, self.cluster_id, self.database_id, self.index_id
-        )
+        write!(f, "{:08x}{:08x}", self.database_id, self.index_id)
     }
 }
 
```

**File**: `src/index/utils.rs` (modified, +1/-8)
```diff
@@ -1,16 +1,9 @@
-use crate::utils::cells::PgCell;
 use base::search::*;
 
 pub fn from_oid_to_handle(oid: pgrx::pg_sys::Oid) -> Handle {
-    static SYSTEM_IDENTIFIER: PgCell<u64> = unsafe { PgCell::new(0) };
-    if SYSTEM_IDENTIFIER.get() == 0 {
-        SYSTEM_IDENTIFIER.set(unsafe { pgrx::pg_sys::GetSystemIdentifier() });
-    }
-    let tenant_id = 0_u128;
-    let cluster_id = SYSTEM_IDENTIFIER.get();
     let database_id = unsafe { pgrx::pg_sys::MyDatabaseId.as_u32() };
     let index_id = oid.as_u32();
-    Handle::new(tenant_id, cluster_id, database_id, index_id)
+    Handle::new(database_id, index_id)
 }
 
 pub fn pointer_to_ctid(pointer: Pointer) -> pgrx::pg_sys::ItemPointerData {
```

---

### Incident Patch 12: `8abfd822` (2024-09-05)
**Commit Message**: fix: set correct svecf32 header while creating SVecf32Output (#590)

Signed-off-by: usamoi <[REDACTED_EMAIL]>

**File**: `src/datatype/memory_svecf32.rs` (modified, +2/-2)
```diff
@@ -98,10 +98,10 @@ impl SVecf32Output {
             let ptr = pgrx::pg_sys::palloc(layout.size()) as *mut SVecf32Header;
             ptr.cast::<u8>().add(layout.size() - 8).write_bytes(0, 8);
             std::ptr::addr_of_mut!((*ptr).varlena).write(SVecf32Header::varlena(layout.size()));
+            std::ptr::addr_of_mut!((*ptr).reserved).write(0);
+            std::ptr::addr_of_mut!((*ptr).magic).write(HEADER_MAGIC);
             std::ptr::addr_of_mut!((*ptr).dims).write(vector.dims());
-            std::ptr::addr_of_mut!((*ptr).magic).write(2);
             std::ptr::addr_of_mut!((*ptr).len).write(vector.len());
-            std::ptr::addr_of_mut!((*ptr).reserved).write(HEADER_MAGIC);
             let mut data_ptr = (*ptr).phantom.as_mut_ptr().cast::<u32>();
             std::ptr::copy_nonoverlapping(
                 vector.indexes().as_ptr(),
```

---

### Incident Patch 13: `2e203585` (2024-09-04)
**Commit Message**: fix: use correct intrinsics for fp16 in AVX (#589)

Signed-off-by: usamoi <[REDACTED_EMAIL]>

**File**: `crates/base/src/scalar/f16.rs` (modified, +4/-4)
```diff
@@ -382,8 +382,8 @@ mod reduce_sum_of_xy {
             let mut b = rhs.as_ptr();
             let mut xy = _mm256_setzero_ps();
             while n >= 8 {
-                let x = _mm256_cvtph_ps(_mm_loadu_epi16(a.cast()));
-                let y = _mm256_cvtph_ps(_mm_loadu_epi16(b.cast()));
+                let x = _mm256_cvtph_ps(_mm_loadu_si128(a.cast()));
+                let y = _mm256_cvtph_ps(_mm_loadu_si128(b.cast()));
                 a = a.add(8);
                 b = b.add(8);
                 n -= 8;
@@ -585,8 +585,8 @@ mod reduce_sum_of_d2 {
             let mut b = rhs.as_ptr();
             let mut d2 = _mm256_setzero_ps();
             while n >= 8 {
-                let x = _mm256_cvtph_ps(_mm_loadu_epi16(a.cast()));
-                let y = _mm256_cvtph_ps(_mm_loadu_epi16(b.cast()));
+                let x = _mm256_cvtph_ps(_mm_loadu_si128(a.cast()));
+                let y = _mm256_cvtph_ps(_mm_loadu_si128(b.cast()));
                 a = a.add(8);
                 b = b.add(8);
                 n -= 8;
```

---

### Incident Patch 14: `f72c5a82` (2024-09-02)
**Commit Message**: fix: detect simd in cli (#586)

Signed-off-by: Keming <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -638,6 +638,7 @@ version = "0.0.0"
 dependencies = [
  "argh",
  "base",
+ "detect",
  "env_logger",
  "index",
  "log",
```

**File**: `crates/cli/Cargo.toml` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ rand.workspace = true
 toml.workspace = true
 
 base = { path = "../base" }
+detect = { path = "../detect" }
 index = { path = "../index" }
 service = { path = "../service" }
 
```

**File**: `crates/cli/src/args.rs` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ pub struct BuildArguments {
     pub threads: Option<u16>,
 
     /// timeout for the building process
-    #[argh(option, default = "3600")]
+    #[argh(option, default = "10800")]
     pub timeout_seconds: u64,
 }
 
```

**File**: `crates/cli/src/main.rs` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ fn calculate_precision(truth: &[i32], res: &[i32], top: usize) -> f32 {
 }
 
 fn main() {
+    detect::init();
     let args: Arguments = argh::from_env();
     let path = PathBuf::from_str(&args.path).expect("failed to parse the path");
     let mut log_builder = env_logger::builder();
```

---

### Incident Patch 15: `897b9a32` (2024-09-02)
**Commit Message**: fix: filter zeros in creating normalized vector (#585)

Signed-off-by: usamoi <[REDACTED_EMAIL]>

**File**: `crates/base/src/scalar/f16.rs` (modified, +14/-3)
```diff
@@ -48,7 +48,18 @@ impl ScalarLike for f16 {
     }
 
     // FIXME: add manually-implemented SIMD version
-    #[inline(always)]
+    #[detect::multiversion(v4, v3, v2, neon, fallback)]
+    fn reduce_or_of_is_zero(this: &[f16]) -> bool {
+        for &x in this {
+            if x == f16::ZERO {
+                return true;
+            }
+        }
+        false
+    }
+
+    // FIXME: add manually-implemented SIMD version
+    #[detect::multiversion(v4, v3, v2, neon, fallback)]
     fn reduce_sum_of_x(this: &[f16]) -> f32 {
         let n = this.len();
         let mut x = 0.0f32;
@@ -59,7 +70,7 @@ impl ScalarLike for f16 {
     }
 
     // FIXME: add manually-implemented SIMD version
-    #[inline(always)]
+    #[detect::multiversion(v4, v3, v2, neon, fallback)]
     fn reduce_sum_of_abs_x(this: &[f16]) -> f32 {
         let n = this.len();
         let mut x = 0.0f32;
@@ -70,7 +81,7 @@ impl ScalarLike for f16 {
     }
 
     // FIXME: add manually-implemented SIMD version
-    #[inline(always)]
+    #[detect::multiversion(v4, v3, v2, neon, fallback)]
     fn reduce_sum_of_x2(this: &[f16]) -> f32 {
         let n = this.len();
         let mut x2 = 0.0f32;
```

**File**: `crates/base/src/scalar/f32.rs` (modified, +11/-0)
```diff
@@ -46,6 +46,17 @@ impl ScalarLike for f32 {
         self
     }
 
+    // FIXME: add manually-implemented SIMD version
+    #[detect::multiversion(v4, v3, v2, neon, fallback)]
+    fn reduce_or_of_is_zero(this: &[f32]) -> bool {
+        for &x in this {
+            if x == 0.0f32 {
+                return true;
+            }
+        }
+        false
+    }
+
     #[inline(always)]
     fn reduce_sum_of_x(this: &[f32]) -> f32 {
         reduce_sum_of_x::reduce_sum_of_x(this)
```

**File**: `crates/base/src/scalar/impossible.rs` (modified, +6/-2)
```diff
@@ -47,11 +47,15 @@ impl ScalarLike for Impossible {
         unimplemented!()
     }
 
-    fn reduce_sum_of_x(_lhs: &[Self]) -> f32 {
+    fn reduce_or_of_is_zero(_this: &[Self]) -> bool {
         unimplemented!()
     }
 
-    fn reduce_sum_of_abs_x(_lhs: &[Self]) -> f32 {
+    fn reduce_sum_of_x(_this: &[Self]) -> f32 {
+        unimplemented!()
+    }
+
+    fn reduce_sum_of_abs_x(_this: &[Self]) -> f32 {
         unimplemented!()
     }
 
```

**File**: `crates/base/src/scalar/mod.rs` (modified, +3/-2)
```diff
@@ -28,8 +28,9 @@ pub trait ScalarLike:
     fn from_f32(x: f32) -> Self;
     fn to_f32(self) -> f32;
 
-    fn reduce_sum_of_x(lhs: &[Self]) -> f32;
-    fn reduce_sum_of_abs_x(lhs: &[Self]) -> f32;
+    fn reduce_or_of_is_zero(this: &[Self]) -> bool;
+    fn reduce_sum_of_x(this: &[Self]) -> f32;
+    fn reduce_sum_of_abs_x(this: &[Self]) -> f32;
     fn reduce_sum_of_x2(this: &[Self]) -> f32;
     fn reduce_min_max_of_x(this: &[Self]) -> (f32, f32);
 
```

**File**: `crates/base/src/vector/svect.rs` (modified, +14/-7)
```diff
@@ -34,11 +34,8 @@ impl<S: ScalarLike> SVectOwned<S> {
         if len != 0 && !(indexes[len - 1] < dims) {
             return None;
         }
-        // FIXME: add manually-implemented SIMD version
-        for i in 0..len {
-            if values[i] == S::zero() {
-                return None;
-            }
+        if S::reduce_or_of_is_zero(&values) {
+            return None;
         }
         unsafe { Some(Self::new_unchecked(dims, indexes, values)) }
     }
@@ -206,10 +203,20 @@ impl<'a, S: ScalarLike> VectorBorrowed for SVectBorrowed<'a, S> {
     #[inline(always)]
     fn function_normalize(&self) -> SVectOwned<S> {
         let l = S::reduce_sum_of_x2(self.values).sqrt();
-        let indexes = self.indexes.to_vec();
+        let mut indexes = self.indexes.to_vec();
         let mut values = self.values.to_vec();
+        let n = indexes.len();
         S::vector_mul_scalar_inplace(&mut values, 1.0 / l);
-        // FIXME: it may panic because of zeros
+        let mut j = 0_usize;
+        for i in 0..n {
+            if values[i] != S::zero() {
+                indexes[j] = indexes[i];
+                values[j] = values[i];
+                j += 1;
+            }
+        }
+        indexes.truncate(j);
+        values.truncate(j);
         SVectOwned::new(self.dims, indexes, values)
     }
 
```

#### Recent Merged Pull Requests:
- **PR #642** (2025-02-26): docs: update to ghcr in README (@kemingy)
- **PR #640** (2025-02-24): docs: add 'migrate to vectorchord' in readme (@kemingy)
- **PR #639** (2025-02-24): chore: fix ghcr release (@kemingy)
- **PR #638** (2025-02-24): chore: run rust test on ubuntu 22.04 (@kemingy)
- **PR #632** (2025-01-17): chore: fix discord and x badge (@kemingy)
- **PR #630** (closed): feat: Update GitHub Actions to support GitHub Container Registry (@webysther)
- **PR #627** (2025-01-01): chore: Fix links (@gaocegege)
- **PR #625** (2024-12-23): fix: update dependencies (@usamoi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
