# Forensic Learning Record (Deep Inspection): typedb/typedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/typedb-typedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/typedb/typedb](https://github.com/typedb/typedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:15:13.823Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `typedb/typedb`
- **Description**: TypeDB: Built for systems, not records
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4476 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `common/bytes/util.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::{
    borrow::Cow,
    fmt::{self, Write},
};

use base64::Engine;

use crate::byte_array::ByteArray;

// TODO: this needs to be optimised using bigger strides than a single byte!
///
/// Performs a big-endian +1 operation that errors on overflow
///
pub fn increment(bytes: &mut [u8]) -> Result<(), BytesError> {
    for byte in bytes.iter_mut().rev() {
        let (val, overflow) = byte.overflowing_add(1);
        *byte = val;
        if !overflow {
            return Ok(());
        }
    }
    Err(BytesError { kind: BytesErrorKind::IncrementOverflow {} })
}

///
/// Performs a 'const' big-endian +1 operation that panics on overflow
///
pub const fn increment_fixed<const SIZE: usize>(mut bytes: [u8; SIZE]) -> [u8; SIZE] {
    let mut index = SIZE;
    while index > 0 {
        let (val, overflow) = bytes[index - 1].overflowing_add(1);
        bytes[index - 1] = val;
        if overflow {
            panic!("Overflow while incrementing array")
        }
        index -= 1;
    }
    bytes
}

#[derive(Debug)]
pub struct BytesError {
    pub kind: BytesErrorKind,
}

#[derive(Debug)]
pub enum BytesErrorKind {
    IncrementOverflow {},
}

impl fmt::Display for BytesError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.kind {
            BytesErrorKind::IncrementOverflow {} => {
                write!(f, "BytesError::IncrementOverflow")
            }
        }
    }
}

pub fn concat_bytes<'a, I, const SIZE: usize>(key_items: I) -> ByteArray<SIZE>
where
    I: Iterator<Item = &'a [u8]> + Clone,
{
    let total_len = key_items.clone().map(|item| item.len()).sum();
    let mut bytes = ByteArray::zeros(total_len);
    let mut start = 0;
    for item in key_items {
        let end = start + item.len();
        bytes[start..end].copy_from_slice(item);
        start = end;
    }
    bytes
}

#[derive(Clone)]
pub struct HexBytesFormatter<'a>(Cow<'a, [u8]>);

impl<'a> HexBytesFormatter<'a> {
    pub fn owned(bytes: Vec<u8>) -> Self {
        Self(Cow::Owned(bytes))
    }

    pub fn borrowed(bytes: &'a [u8]) -> Self {
        Self(Cow::Borrowed(bytes))
    }

    pub fn into_owned(self) -> HexBytesFormatter<'static> {
        HexBytesFormatter::owned(self.0.into_owned())
    }

    pub fn format_iid(&self) -> String {
        const PREFIX: &'static str = "0x";
        let mut result = String::with_capacity(PREFIX.len() + self.0.len() * 2);
        result.push_str(PREFIX);
        self.0.iter().for_each(|byte| write!(result, "{byte:02x}").expect("Expected IID formatting"));
        result
    }
}

impl fmt::Display for HexBytesFormatter<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(self, f)
    }
}

impl fmt::Debug for HexBytesFormatter<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        const GROUP: usize = 2;
        const BREAK: usize = 16;
        f.write_str("[")?;
        if f.alternate() {
            f.write_str("\n    ")?;
        }
        for (i, byte) in self.0.iter().enumerate() {
            write!(f, "{:02X}", byte)?;
            if i + 1 < self.0.len() {
                if f.alternate() && (i + 1) % BREAK == 0 {
                    f.write_str("\n    ")?;
                } else if (i + 1) % GROUP == 0 {
                    f.write_char(' ')?;
                }
            }
        }
        if f.alternate() {
            f.write_char('\n')?;
        }
        f.write_char(']')?;
        Ok(())
    }
}

#[derive(Clone)]
pub struct Base64Formatter<'a>(Cow<'a, [u8]>);

impl<'a> Base64Formatter<'a> {
    pub fn owned(bytes: Vec<u8>) -> Self {
        Self(Cow::Owned(bytes))
    }

    pub fn borrowed(bytes: &'a [u8]) -> Self {
        Self(Cow::Borrowed(bytes))
    }

    pub fn format(&self) -> String {
        base64::engine::general_purpose::STANDARD.encode(&self.0)
    }
}

impl fmt::Display for Base64Formatter<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(self, f)
    }
}

impl fmt::Debug for Base64Formatter<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.format())
    }
}

```

### Core Architecture Module: `common/concurrency/concurrency.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

pub use crate::{
    interval_runner::IntervalRunner,
    tokio_task::{IntervalTaskParameters, TokioTaskSpawner, TokioTaskTracker},
};

mod interval_runner;
mod tokio_task;

```

### Core Architecture Module: `common/concurrency/interval_runner.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::{
    sync::mpsc::{RecvTimeoutError, SyncSender, sync_channel},
    thread,
    time::Duration,
};

#[derive(Debug)]
pub struct IntervalRunner {
    shutdown_sink: SyncSender<SyncSender<()>>,
}

impl IntervalRunner {
    const ZERO_DURATION: Duration = Duration::from_secs(0);

    pub fn new(action: impl FnMut() + Send + 'static, interval: Duration) -> Self {
        Self::new_with_initial_delay(action, interval, Self::ZERO_DURATION)
    }

    pub fn new_with_initial_delay(
        mut action: impl FnMut() + Send + 'static,
        interval: Duration,
        initial_delay: Duration,
    ) -> Self {
        let (shutdown_sender, shutdown_receiver) = sync_channel::<SyncSender<()>>(1);
        thread::spawn(move || {
            match shutdown_receiver.recv_timeout(initial_delay) {
                Ok(done_sender) => {
                    drop(action);
                    done_sender.send(()).unwrap();
                    return;
                }
                Err(RecvTimeoutError::Timeout) => (),
                Err(RecvTimeoutError::Disconnected) => return, // TODO log?
            }

            loop {
                action();
                match shutdown_receiver.recv_timeout(interval) {
                    Ok(done_sender) => {
                        drop(action);
                        done_sender.send(()).unwrap();
                        break;
                    }
                    Err(RecvTimeoutError::Timeout) => (),
                    Err(RecvTimeoutError::Disconnected) => break, // TODO log?
                }
            }
        });
        Self { shutdown_sink: shutdown_sender }
    }
}

impl Drop for IntervalRunner {
    fn drop(&mut self) {
        let (done_sender, done_receiver) = sync_channel(1);
        self.shutdown_sink.send(done_sender).expect("Expected interval runner shutdown signal sending");
        done_receiver.recv().expect("Expected interval runner shutdown finishing")
    }
}

```

### Core Architecture Module: `common/concurrency/tokio_task.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::future::Future;

use tokio::{
    sync::{oneshot, watch},
    task::JoinHandle,
    time::{self, Duration},
};
use tokio_util::task::task_tracker::TaskTracker;

/// Manages background tasks that should finish gracefully on shutdown.
///
/// # Design
/// - A cloneable [`TokioTaskSpawner`] is handed to lower-level components to spawn tasks.
/// - The tracker listens to a global `watch::Receiver<()>` shutdown signal.
/// - When shutdown is observed, the tracker:
///   1. `close()`s to stop accepting new tasks;
///   2. `wait()`s until all tracked tasks finish.
///
/// # Guarantees
/// - Tasks spawned through the spawner are kept alive by the Tokio runtime as usual.
/// - **To guarantee** that long-running tasks (e.g., intervals) complete their final
///   work on shutdown (like “act_on_shutdown”), the owner **must call** [`TokioTaskTracker::join`]
///   before letting the runtime drop.
///
/// This avoids blocking in `Drop` (which can deadlock a Tokio worker) while still
/// giving you a single place to wait for all background work to finish.
/// For more information, see https://tokio.rs/tokio/topics/shutdown.
#[derive(Debug)]
pub struct TokioTaskTracker {
    tracker: TaskTracker,
    shutdown_receiver: watch::Receiver<()>,
    done_receiver: oneshot::Receiver<()>,
    shutdown_task: JoinHandle<()>,
}

impl TokioTaskTracker {
    /// Create a new `TokioTaskTracker` wired to the provided shutdown receiver.
    pub fn new(shutdown_receiver: watch::Receiver<()>) -> Self {
        let tracker = TaskTracker::new();
        let (done_sender, done_receiver) = oneshot::channel();

        let mut shutdown_receiver_clone = shutdown_receiver.clone();
        let tracker_clone = tracker.clone();
        let shutdown_task = tokio::spawn(async move {
            let _ = shutdown_receiver_clone.changed().await;

            tracker_clone.close();
            tracker_clone.wait().await;
            let _ = done_sender.send(());
        });

        Self { tracker, done_receiver, shutdown_receiver, shutdown_task }
    }

    /// Get a cloneable spawner tied to this tracker and shutdown stream.
    pub fn get_spawner(&self) -> TokioTaskSpawner {
        TokioTaskSpawner { tracker: self.tracker.clone(), shutdown_receiver: self.shutdown_receiver.clone() }
    }

    /// Wait for the shutdown supervisor to complete and for **all** tracked tasks to finish.
    ///
    /// Call this near the end of your application's workflow, **before** the Tokio
    /// runtime is dropped, to guarantee that finalizers have completed.
    pub async fn join(self) {
        let _ = self.shutdown_task.await;
        let _ = self.done_receiver.await;
    }
}

/// Cloneable spawner for background tasks. Tasks are tracked in the parent
/// [`TokioTaskTracker`], and can react to the same shutdown receiver.
#[derive(Debug, Clone)]
pub struct TokioTaskSpawner {
    tracker: TaskTracker,
    shutdown_receiver: watch::Receiver<()>,
}

impl TokioTaskSpawner {
    /// Spawn an arbitrary background task and track it. The return handle can be used to await this
    /// single task's completion, but also can be ignored.
    pub fn spawn<F>(&self, task: F) -> JoinHandle<F::Output>
    where
        F: Future<Output = ()> + Send + 'static,
    {
        self.tracker.spawn(task)
    }

    /// Spawn a periodic task that runs `action()` every `interval` until a shutdown signal is received.
    /// The return handle can be used to await this single task's completion (only on shutdown), but also can be ignored.
    pub fn spawn_interval<F>(
        &self,
        mut action: impl 'static + Send + FnMut() -> F,
        IntervalTaskParameters { interval, initial_delay, act_on_shutdown }: IntervalTaskParameters,
    ) -> JoinHandle<F::Output>
    where
        F: Future<Output = ()> + Send + 'static,
    {
        let mut shutdown_receiver = self.shutdown_receiver.clone();

        self.spawn(async move {
            if !initial_delay.is_zero() {
                tokio::select! {
                    _ = tokio::time::sleep(initial_delay) => (),
                    _ = shutdown_receiver.changed() => {
                        drop(action);
                        return;
                    }
                }
            }
            let mut interval_timer = time::interval(interval);
            loop {
                tokio::select! {
                    _ = interval_timer.tick() => {
                        action().await;
                    }
                    _ = shutdown_receiver.changed() => {
                        if act_on_shutdown {
                            action().await;
                        }
                        drop(action);
                        break;
                    }
                }
            }
        })
    }
}

#[derive(Debug, Copy, Clone)]
pub struct IntervalTaskParameters {
    /// The interval between consecutive executions of the `action()`.
    pub interval: Duration,

    /// The initial delay before the first execution of the `action()` after spawning.
    ///
    /// If the shutdown signal is received during this delay, the task is cancelled
    /// immediately and **will not** execute the first action (or the shutdown action).
    pub initial_delay: Duration,

    /// Whether to run the `action()` **one final time** when a shutdown signal is received.
    ///
    /// This is useful for performing final cleanup or state flushes before exit.
    pub act_on_shutdown: bool,
}

impl IntervalTaskParameters {
    pub fn new_no_delay(interval: Duration, act_on_shutdown: bool) -> Self {
        Self::new_with_delay(interval, Duration::ZERO, act_on_shutdown)
    }

    pub fn new_with_delay(interval: Duration, initial_delay: Duration, act_on_shutdown: bool) -> Self {
        Self { interval, act_on_shutdown, initial_delay }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };

    use tokio::{
        sync::watch,
        time::{self, Duration, advance},
    };

    use super::*;

    fn setup() -> (TokioTaskTracker, TokioTaskSpawner, watch::Sender<()>) {
        let (tx, rx) = watch::channel(());
        let tracker = TokioTaskTracker::new(rx);
        let spawner = tracker.get_spawner();
        (tracker, spawner, tx)
    }

    #[tokio::test(start_paused = true)]
    async fn spawn_returns_handle_and_is_tracked() {
        let (tracker, spawner, tx) = setup();

        let flag = Arc::new(AtomicUsize::new(0));
        let flag_clone = flag.clone();
        let h = spawner.spawn(async move {
            time::sleep(Duration::from_secs(2)).await;
            flag_clone.store(1, Ordering::SeqCst);
        });

        // Awaiting the handle should complete the task
        advance(Duration::from_secs(2)).await;
        h.await.unwrap();
        assert_eq!(flag.load(Ordering::SeqCst), 1);

        // Shutdown and ensure tracker join still finishes
        let _ = tx.send(());
        tracker.join().await;

        assert_eq!(flag.load(Ordering::SeqCst), 1);
    }

    #[tokio::test(start_paused = true)]
    async fn tracked_even_if_handle_dropped() {
        let (tracker, spawner, tx) = setup();

        let flag = Arc::new(AtomicUsize::new(0));
        let flag_clone = flag.clone();

        let h = spawner.spawn(async move {
            time::sleep(Duration::from_secs(1)).await;
            flag_clone.store(7, Ordering::SeqCst);
        });
        // Drop the handle intentionally
        drop(h);

        advance(Duration::from_secs(1)).await;
        let _ = tx.send(());
        tracker.join().await;

        assert_eq!(flag.load(Ordering::SeqCst), 7);
    }

    #[tokio::test(start_paused = true)]
    async fn aborting_handle_cancels_task_and_tracker_still_completes() {
        let (tracker, spawner, tx) = setup();

        let flag = Arc::new(AtomicUsize::new(0));
        let flag_clone = flag.clone();

        let h = spawner.spawn(async move {
            time::sleep(Duration::from_secs(5)).await;
            flag_clone.store(999, Ordering::SeqCst);
        });

        // Abort before flag's update
        advance(Duration::from_secs(2)).await;
        h.abort();
        assert!(h.await.is_err());

        let _ = tx.send(());
        tracker.join().await;

        assert_eq!(flag.load(Ordering::SeqCst), 0);
    }

    #[tokio::test(start_paused = true)]
    async fn interval_shutdown_action_runs_on_shutdown() {
        let (tracker, spawner, tx) = setup();

        let count = Arc::new(AtomicUsize::new(0));
        let count_clone = count.clone();

        let _h = spawner.spawn_interval(
            move || {
                let count = count_clone.clone();
                async move {
                    count.fetch_add(1, Ordering::SeqCst);
                }
            },
            IntervalTaskParameters::new_no_delay(Duration::from_secs(1), /*act_on_shutdown=*/ true),
        );

        advance(Duration::from_secs(3)).await;
        let before = count.load(Ordering::SeqCst);

        let _ = tx.send(());
        tracker.join().await;

        let after = count.load(Ordering::SeqCst);
        assert!(after >= before + 1, "Expected at least one final call on shutdown (before={before}, after={after})");
    }

    #[tokio::test(start_paused = true)]
    async fn initial_delay_ignores_shutdown_action() {
        let (tracker, spawner, tx) = setup();

        let count = Arc::new(AtomicUsize::new(0));
        let count_clone = count.clone();

        let _h = spawner.spawn_interval(
            move || {
                let count = count_clone.clone();
                async move {
                    count.fetch_add(1, Ordering::SeqCst);
                }
            },
            IntervalTaskParameters::new_with_delay(
                Durat
```

### Core Architecture Module: `diagnostics/metrics/core_metrics.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, RwLock, RwLockReadGuard, RwLockWriteGuard},
};

use serde_json::Value as JSONValue;

use crate::{
    DatabaseHash, DatabaseHashOpt, DatabaseId, MonitoringSection, hash_string_consistently,
    metrics::{
        ALL_CLIENT_ENDPOINTS, ActionMetrics, ClientEndpoint, DatabaseHistograms, DatabaseHistogramsSnapshot,
        ErrorMetrics, LoadMetrics, ServerMetrics, ServerProperties, client_endpoints_map,
    },
    reports::{json_monitoring::to_monitoring_json, prometheus_monitoring::to_monitoring_prometheus},
};

#[derive(Debug)]
pub struct CoreMetrics {
    pub(crate) server_properties: ServerProperties,
    pub(crate) server_metrics: ServerMetrics,
    load_metrics: RwLock<HashMap<DatabaseHash, LoadMetrics>>,
    action_metrics: HashMap<ClientEndpoint, RwLock<HashMap<DatabaseHashOpt, ActionMetrics>>>,
    error_metrics: HashMap<ClientEndpoint, RwLock<HashMap<DatabaseHashOpt, ErrorMetrics>>>,
    histogram_metrics: RwLock<HashMap<DatabaseHash, DatabaseHistograms>>,
}

impl CoreMetrics {
    pub(crate) fn new(
        deployment_id: String,
        server_id: String,
        distribution: String,
        version: String,
        data_directory: PathBuf,
        is_reporting_enabled: bool,
    ) -> Self {
        Self {
            server_properties: ServerProperties::new(deployment_id, server_id, distribution, is_reporting_enabled),
            server_metrics: ServerMetrics::new(version, data_directory),
            load_metrics: RwLock::new(HashMap::new()),
            action_metrics: client_endpoints_map!(RwLock::new(HashMap::new())),
            error_metrics: client_endpoints_map!(RwLock::new(HashMap::new())),
            histogram_metrics: RwLock::new(HashMap::new()),
        }
    }

    pub(crate) fn lock_load_metrics_read_for_database(
        &self,
        database_name: &str,
    ) -> RwLockReadGuard<'_, HashMap<DatabaseHash, LoadMetrics>> {
        let database_hash = hash_string_consistently(database_name);
        if let Some(lock) = self.try_lock_load_metrics_read_for_database(database_hash) {
            return lock;
        }
        self.add_database_to_load_metrics(DatabaseId::new(database_name));
        self.try_lock_load_metrics_read_for_database(database_hash)
            .expect("Expected metrics lock acquisition for database after adding")
    }

    fn try_lock_load_metrics_read_for_database(
        &self,
        database_hash: DatabaseHash,
    ) -> Option<RwLockReadGuard<'_, HashMap<DatabaseHash, LoadMetrics>>> {
        let read_lock = self.lock_load_metrics_read();
        match read_lock.contains_key(&database_hash) {
            true => Some(read_lock),
            false => None,
        }
    }

    fn add_database_to_load_metrics(&self, id: Arc<DatabaseId>) {
        let mut write_lock = self.lock_load_metrics_write();
        let database_hash = id.hash_value();
        if !write_lock.contains_key(&database_hash) {
            write_lock.insert(database_hash, LoadMetrics::new(id));
        }
    }

    pub(crate) fn lock_load_metrics_read(&self) -> RwLockReadGuard<'_, HashMap<DatabaseHash, LoadMetrics>> {
        self.load_metrics.read().expect("Expected read lock acquisition")
    }

    pub(crate) fn lock_load_metrics_write(&self) -> RwLockWriteGuard<'_, HashMap<DatabaseHash, LoadMetrics>> {
        self.load_metrics.write().expect("Expected write lock acquisition")
    }

    pub(crate) fn lock_histogram_metrics_read_for_database(
        &self,
        database_name: &str,
    ) -> RwLockReadGuard<'_, HashMap<DatabaseHash, DatabaseHistograms>> {
        let database_hash = hash_string_consistently(database_name);
        if let Some(lock) = self.try_lock_histogram_metrics_read_for_database(database_hash) {
            return lock;
        }
        self.add_database_to_histogram_metrics(DatabaseId::new(database_name));
        self.try_lock_histogram_metrics_read_for_database(database_hash)
            .expect("Expected metrics lock acquisition for database after adding")
    }

    fn try_lock_histogram_metrics_read_for_database(
        &self,
        database_hash: DatabaseHash,
    ) -> Option<RwLockReadGuard<'_, HashMap<DatabaseHash, DatabaseHistograms>>> {
        let read_lock = self.lock_histogram_metrics_read();
        match read_lock.contains_key(&database_hash) {
            true => Some(read_lock),
            false => None,
        }
    }

    fn add_database_to_histogram_metrics(&self, id: Arc<DatabaseId>) {
        let mut write_lock = self.lock_histogram_metrics_write();
        let database_hash = id.hash_value();
        if !write_lock.contains_key(&database_hash) {
            write_lock.insert(database_hash, DatabaseHistograms::new(id));
        }
    }

    pub(crate) fn lock_histogram_metrics_read(&self) -> RwLockReadGuard<'_, HashMap<DatabaseHash, DatabaseHistograms>> {
        self.histogram_metrics.read().expect("Expected read lock acquisition")
    }

    fn lock_histogram_metrics_write(&self) -> RwLockWriteGuard<'_, HashMap<DatabaseHash, DatabaseHistograms>> {
        self.histogram_metrics.write().expect("Expected write lock acquisition")
    }

    pub(crate) fn lock_action_metrics_read_for_database(
        &self,
        client: ClientEndpoint,
        database_name: Option<&str>,
        database_hash: DatabaseHashOpt,
    ) -> RwLockReadGuard<'_, HashMap<DatabaseHashOpt, ActionMetrics>> {
        if let Some(lock) = self.try_lock_action_metrics_read_for_database(client, database_hash) {
            return lock;
        }
        self.add_database_to_action_metrics(client, database_name);
        self.try_lock_action_metrics_read_for_database(client, database_hash)
            .expect("Expected metrics lock acquisition for database after adding")
    }

    fn try_lock_action_metrics_read_for_database(
        &self,
        client: ClientEndpoint,
        database_hash: DatabaseHashOpt,
    ) -> Option<RwLockReadGuard<'_, HashMap<DatabaseHashOpt, ActionMetrics>>> {
        let read_lock = self.lock_action_metrics_read(client);
        match read_lock.contains_key(&database_hash) {
            true => Some(read_lock),
            false => None,
        }
    }

    fn add_database_to_action_metrics(&self, client: ClientEndpoint, database_name: Option<&str>) {
        let id = database_name.map(DatabaseId::new);
        let database_hash = id.as_ref().map(|id| id.hash_value());
        let mut write_lock = self.lock_action_metrics_write(client);
        if !write_lock.contains_key(&database_hash) {
            write_lock.insert(database_hash, ActionMetrics::new(id));
        }
    }

    pub(crate) fn lock_action_metrics_read(
        &self,
        client: ClientEndpoint,
    ) -> RwLockReadGuard<'_, HashMap<DatabaseHashOpt, ActionMetrics>> {
        self.action_metrics
            .get(&client)
            .expect("Expected client {client}")
            .read()
            .expect("Expected read lock acquisition")
    }

    pub(crate) fn lock_action_metrics_write(
        &self,
        client: ClientEndpoint,
    ) -> RwLockWriteGuard<'_, HashMap<DatabaseHashOpt, ActionMetrics>> {
        self.action_metrics
            .get(&client)
            .expect("Expected client {client}")
            .write()
            .expect("Expected write lock acquisition")
    }

    pub(crate) fn lock_error_metrics_read_for_database(
        &self,
        client: ClientEndpoint,
        database_name: Option<&str>,
        database_hash: DatabaseHashOpt,
    ) -> RwLockReadGuard<'_, HashMap<DatabaseHashOpt, ErrorMetrics>> {
        if let Some(lock) = self.try_lock_error_metrics_read_for_database(client, database_hash) {
            return lock;
        }
        self.add_database_to_error_metrics(client, database_name);
        self.try_lock_error_metrics_read_for_database(client, database_hash)
            .expect("Expected metrics lock acquisition for database after adding")
    }

    fn try_lock_error_metrics_read_for_database(
        &self,
        client: ClientEndpoint,
        database_hash: DatabaseHashOpt,
    ) -> Option<RwLockReadGuard<'_, HashMap<DatabaseHashOpt, ErrorMetrics>>> {
        let read_lock = self.lock_error_metrics_read(client);
        match read_lock.contains_key(&database_hash) {
            true => Some(read_lock),
            false => None,
        }
    }

    fn add_database_to_error_metrics(&self, client: ClientEndpoint, database_name: Option<&str>) {
        let id = database_name.map(DatabaseId::new);
        let database_hash = id.as_ref().map(|id| id.hash_value());
        let mut write_lock = self.lock_error_metrics_write(client);
        if !write_lock.contains_key(&database_hash) {
            write_lock.insert(database_hash, ErrorMetrics::new(id));
        }
    }

    pub(crate) fn lock_error_metrics_read(
        &self,
        client: ClientEndpoint,
    ) -> RwLockReadGuard<'_, HashMap<DatabaseHashOpt, ErrorMetrics>> {
        self.error_metrics
            .get(&client)
            .expect("Expected client {client}")
            .read()
            .expect("Expected read lock acquisition")
    }

    pub(crate) fn lock_error_metrics_write(
        &self,
        client: ClientEndpoint,
    ) -> RwLockWriteGuard<'_, HashMap<DatabaseHashOpt, ErrorMetrics>> {
        self.error_metrics
            .get(&client)
            .expect("Expected client {client}")
            .write()
            .expect("Expected write lock acquisition")
    }

    pub(crate) fn histogram_snapshots(&self) -> Vec<(Arc<DatabaseId>, DatabaseHistogramsSnapshot)> {
        self.lock_histogram_metrics_read().values().map(|db| (db.database_id().clone(), db.snapshot())).collect()
    }
}

impl MonitoringSection for CoreMetrics {
    fn name(&self) -> &str {

```

### Core Architecture Module: `server/state/database_operator.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::{collections::HashMap, fmt::Debug, sync::Arc};

use async_trait::async_trait;
use concurrency::TokioTaskSpawner;
use database::{
    Database, DatabaseDeleteError, DatabaseOpenError,
    database::DatabaseCreateError,
    database_manager::DatabaseManager,
    migration::{
        database_import_handler::{
            DatabaseImportHandler, ImportHandlerError, open_import_schema_transaction, open_import_write_transaction,
        },
        database_importer::DatabaseImporter,
    },
    transaction::{
        CommitIntent, DataCommitIntent, SchemaCommitIntent, TransactionError, TransactionRead, TransactionSchema,
        TransactionWrite,
    },
};
use durability::DurabilitySequenceNumber;
use executor::ExecutionInterrupt;
use futures::future::join_all;
use resource::{constants::server::MAX_CONCURRENT_IMPORTS, profile::CommitProfile};
use storage::{
    durability_client::{DurabilityClient, WALClient},
    snapshot::snapshot_id::SnapshotId,
};
use tokio::{
    sync::{RwLock, Semaphore, mpsc::Sender},
    task::JoinHandle,
};

use crate::{
    error::{ArcServerStateError, LocalServerStateError, arc_server_state_err},
    service::grpc::migration::import_service::DatabaseImportService,
};

#[async_trait]
pub trait DatabaseOperator: Debug + Send + Sync {
    async fn all(&self) -> Result<Vec<String>, ArcServerStateError>;

    async fn contains(&self, name: &str) -> Result<bool, ArcServerStateError>;

    async fn get(&self, name: &str) -> Result<Option<Arc<Database<WALClient>>>, ArcServerStateError>;

    async fn get_unrestricted(&self, name: &str) -> Result<Option<Arc<Database<WALClient>>>, ArcServerStateError>;

    async fn create(&self, name: &str) -> Result<(), ArcServerStateError>;

    async fn create_unrestricted(&self, name: &str) -> Result<(), ArcServerStateError>;

    async fn spawn_import_service(&self, service: DatabaseImportService)
    -> Result<JoinHandle<()>, ArcServerStateError>;

    async fn import_prepare(
        &self,
        name: &str,
        close_sender: Sender<()>,
        interrupt: ExecutionInterrupt,
    ) -> Result<DatabaseImporter, ArcServerStateError>;

    async fn import_discard(&self, name: &str) -> Result<(), ArcServerStateError>;

    async fn schema(&self, name: &str) -> Result<String, ArcServerStateError>;

    async fn type_schema(&self, name: &str) -> Result<String, ArcServerStateError>;

    async fn schema_commit(
        &self,
        commit_intent: SchemaCommitIntent<WALClient>,
        commit_profile: CommitProfile,
    ) -> (CommitProfile, Result<(), ArcServerStateError>);

    async fn data_commit(
        &self,
        commit_intent: DataCommitIntent<WALClient>,
        commit_profile: CommitProfile,
    ) -> (CommitProfile, Result<(), ArcServerStateError>);

    async fn commit_record_exists(
        &self,
        name: &str,
        open_sequence_number: DurabilitySequenceNumber,
        snapshot_id: SnapshotId,
    ) -> Result<bool, ArcServerStateError>;

    async fn delete(&self, name: &str) -> Result<(), ArcServerStateError>;

    async fn prepare_for_writes(&self) -> Result<(), Box<DatabaseOpenError>>;
}

#[derive(Debug)]
pub(crate) struct ImportInfo {
    close_sender: Sender<()>,
}

#[derive(Debug)]
struct LocalDatabaseImportHandler {
    database_manager: Arc<DatabaseManager>,
    staged_database: Arc<Database<WALClient>>,
}

fn import_commit<I: CommitIntent>(
    intent: I,
    map_err: impl FnOnce(I::Error) -> LocalServerStateError,
) -> Result<(), ImportHandlerError> {
    let mut commit_profile = CommitProfile::disabled();
    intent.commit(&mut commit_profile).map_err(|typedb_source| Arc::new(map_err(typedb_source)) as _)
}

impl DatabaseImportHandler for LocalDatabaseImportHandler {
    fn database_name(&self) -> &str {
        self.staged_database.name()
    }

    fn open_schema(&self) -> Result<TransactionSchema<WALClient>, TransactionError> {
        open_import_schema_transaction(&self.staged_database)
    }

    fn open_write(&self) -> Result<TransactionWrite<WALClient>, TransactionError> {
        open_import_write_transaction(&self.staged_database)
    }

    fn commit_schema(&self, intent: SchemaCommitIntent<WALClient>) -> Result<(), ImportHandlerError> {
        import_commit(intent, |typedb_source| LocalServerStateError::DatabaseSchemaCommitFailed { typedb_source })
    }

    fn commit_data(&self, intent: DataCommitIntent<WALClient>) -> Result<(), ImportHandlerError> {
        import_commit(intent, |typedb_source| LocalServerStateError::DatabaseDataCommitFailed { typedb_source })
    }

    fn finalise(self: Box<Self>) -> Result<(), ImportHandlerError> {
        let Self { database_manager, staged_database } = *self;
        let name = staged_database.name().to_owned();
        drop(staged_database);
        database_manager.finalise_imported_database(&name).map_err(|typedb_source| {
            Arc::new(LocalServerStateError::DatabaseImportFinaliseFailed { typedb_source: *typedb_source }) as _
        })
    }
}

#[derive(Debug)]
pub struct LocalDatabaseOperator {
    database_manager: Arc<DatabaseManager>,
    background_task_spawner: TokioTaskSpawner,
    import_permits: Arc<Semaphore>,
    active_imports: Arc<RwLock<HashMap<String, ImportInfo>>>,
}

impl LocalDatabaseOperator {
    pub fn new(database_manager: Arc<DatabaseManager>, background_task_spawner: TokioTaskSpawner) -> Self {
        Self {
            database_manager,
            background_task_spawner,
            import_permits: Arc::new(Semaphore::new(MAX_CONCURRENT_IMPORTS)),
            active_imports: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn record_import(&self, name: String, close_sender: Sender<()>) -> Result<(), DatabaseCreateError> {
        let mut imports = self.active_imports.write().await;
        match imports.get(&name) {
            Some(live) if !live.close_sender.is_closed() => {
                return Err(DatabaseCreateError::IsBeingImported { name });
            }
            _ => imports.insert(name.clone(), ImportInfo { close_sender: close_sender.clone() }),
        };
        drop(imports);

        let imports_for_cleanup = self.active_imports.clone();
        self.background_task_spawner.spawn(async move {
            close_sender.closed().await;
            let mut imports = imports_for_cleanup.write().await;
            if let Some(info) = imports.get(&name) {
                if info.close_sender.same_channel(&close_sender) {
                    imports.remove(&name);
                }
            }
        });
        Ok(())
    }

    pub async fn close_all_imports(&self) {
        let close_senders: Vec<Sender<()>> =
            self.active_imports.read().await.values().map(|info| info.close_sender.clone()).collect();
        join_all(close_senders.iter().map(|sender| async move {
            let _ = sender.send(()).await;
            sender.closed().await;
        }))
        .await;
    }

    pub fn new_importer(
        &self,
        handler: Box<dyn DatabaseImportHandler>,
        interrupt: ExecutionInterrupt,
    ) -> DatabaseImporter {
        DatabaseImporter::new(handler, self.database_manager.import_directory().to_owned(), interrupt)
    }

    pub fn prepare_imported_database(&self, name: String) -> Result<Arc<Database<WALClient>>, ArcServerStateError> {
        self.database_manager.prepare_imported_database(name).map_err(|typedb_source| {
            arc_server_state_err(LocalServerStateError::DatabaseImportPrepareFailed { typedb_source: *typedb_source })
        })
    }

    pub fn imported_database(&self, name: &str) -> Option<Arc<Database<WALClient>>> {
        self.database_manager.imported_database(name)
    }

    pub fn imported_database_names(&self) -> Vec<String> {
        self.database_manager.imported_database_names()
    }

    pub fn is_abandoned_import(&self, name: &str) -> bool {
        self.database_manager.is_abandoned_import(name)
    }

    pub fn finalise_imported_database(&self, name: &str) -> Result<(), ArcServerStateError> {
        self.database_manager.finalise_imported_database(name).map_err(|typedb_source| {
            arc_server_state_err(LocalServerStateError::DatabaseImportFinaliseFailed { typedb_source: *typedb_source })
        })
    }
}

pub fn get_database_schema<D: DurabilityClient>(
    database: Arc<Database<D>>,
) -> Result<String, Box<LocalServerStateError>> {
    let transaction = TransactionRead::open(database, options::TransactionOptions::default())
        .map_err(|typedb_source| LocalServerStateError::FailedToOpenPrerequisiteTransaction { typedb_source })?;
    let schema =
        transaction.schema().map_err(|error| LocalServerStateError::DatabaseExport { typedb_source: error.into() })?;
    Ok(schema)
}

pub fn get_database_type_schema<D: DurabilityClient>(
    database: Arc<Database<D>>,
) -> Result<String, Box<LocalServerStateError>> {
    let transaction = TransactionRead::open(database, options::TransactionOptions::default())
        .map_err(|typedb_source| LocalServerStateError::FailedToOpenPrerequisiteTransaction { typedb_source })?;
    let type_schema = transaction
        .type_schema()
        .map_err(|error| LocalServerStateError::DatabaseExport { typedb_source: error.into() })?;
    Ok(type_schema)
}

#[async_trait]
impl DatabaseOperator for LocalDatabaseOperator {
    async fn all(&self) -> Result<Vec<String>, ArcServerStateError> {
        Ok(self.database_manager.database_names())
    }

    async fn contains(&self, name: &str) -> Result<bool, ArcServerStateError> {
        Ok(self.database_manager.database(name).is_some())
    }

    async fn get(&self, name: &str) -> Result<Option<Arc<Database<WALClient>>>, ArcServerStateError> {
        Ok(self.database_manager.database(name))
    }

    async fn
```

### Core Architecture Module: `server/state/mod.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

pub mod database_operator;
pub mod server_operator;
pub mod transaction_operator;
pub mod user_operator;

use std::{collections::HashSet, net::SocketAddr, path::PathBuf, sync::Arc};

use concurrency::{IntervalRunner, TokioTaskSpawner};
use database::database_manager::{DatabaseManager, ImportOwnership};
use diagnostics::{Diagnostics, diagnostics_manager::DiagnosticsManager};
use options::MvccCleanupStrategy;
use resource::{constants::server::DATABASE_METRICS_UPDATE_INTERVAL, distribution_info::DistributionInfo};
use tokio::{net::lookup_host, sync::watch::Receiver};

pub use self::{
    database_operator::{DatabaseOperator, LocalDatabaseOperator, get_database_schema},
    server_operator::{LocalServerOperator, ServerOperator},
    transaction_operator::{LocalTransactionOperator, TransactionOperator},
    user_operator::{LocalUserOperator, UserOperator},
};
use crate::{
    authentication::token_manager::TokenManager,
    error::{ArcServerStateError, ServerOpenError},
    parameters::config::{Config, DiagnosticsConfig},
    service::admin::transport::AdminPath,
    status::{LocalServerStatus, PrivateEndpointAddress, PublicEndpointAddress, ServerStatus},
};

pub type BoxServerStatus = Box<dyn ServerStatus + Send + Sync>;

struct ResolvedEndpoints {
    grpc_listen_address: SocketAddr,
    http_listen_address: Option<SocketAddr>,
    admin_endpoint: Option<AdminPath>,
    server_status: LocalServerStatus,
}

#[derive(Debug)]
pub struct ServerState {
    distribution_info: DistributionInfo,
    grpc_listen_address: SocketAddr,
    http_listen_address: Option<SocketAddr>,
    admin_endpoint: Option<AdminPath>,
    diagnostics_manager: Arc<DiagnosticsManager>,
    shutdown_receiver: Receiver<()>,
    background_task_spawner: TokioTaskSpawner,
    _database_diagnostics_updater: IntervalRunner,

    server_operator: Arc<dyn ServerOperator>,
    database_operator: Arc<dyn DatabaseOperator>,
    transaction_operator: Arc<dyn TransactionOperator>,
    user_operator: Arc<dyn UserOperator>,
}

impl ServerState {
    pub async fn new(
        distribution_info: DistributionInfo,
        config: Config,
        server_id: String,
        deployment_id: Option<String>,
        import_ownership: ImportOwnership,
        shutdown_receiver: Receiver<()>,
        background_task_spawner: TokioTaskSpawner,
    ) -> Result<ServerStateBuilder, ServerOpenError> {
        let token_manager = Arc::new(
            TokenManager::new(config.server.authentication.token_expiration, background_task_spawner.clone())
                .map_err(|typedb_source| ServerOpenError::TokenConfiguration { typedb_source })?,
        );

        let deployment_id = deployment_id.unwrap_or(server_id.clone());
        let diagnostics_manager = Arc::new(
            Self::initialise_diagnostics(
                deployment_id.clone(),
                server_id.clone(),
                distribution_info,
                &config.diagnostics,
                config.storage.data_directory.clone(),
                config.development_mode.enabled,
                background_task_spawner.clone(),
            )
            .await,
        );
        let database_manager = DatabaseManager::new(
            &config.storage.data_directory,
            diagnostics_manager.clone(),
            config.storage.rocksdb.cache_size,
            config.storage.rocksdb.write_buffers_limit,
            import_ownership,
            config.storage.mvcc.cleanup.clone().map(Into::into).unwrap_or(MvccCleanupStrategy::Disabled),
        )
        .map_err(|typedb_source| ServerOpenError::DatabaseOpen { typedb_source: *typedb_source })?;
        let database_diagnostics_updater = IntervalRunner::new(
            {
                let diagnostics_manager = diagnostics_manager.clone();
                let database_manager = database_manager.clone();
                move || ServerState::synchronize_database_metrics(diagnostics_manager.clone(), database_manager.clone())
            },
            DATABASE_METRICS_UPDATE_INTERVAL,
        );

        let ResolvedEndpoints { grpc_listen_address, http_listen_address, admin_endpoint, server_status } =
            Self::resolve_endpoints(&config).await?;

        Ok(ServerStateBuilder {
            distribution_info,
            grpc_listen_address,
            http_listen_address,
            admin_endpoint,
            server_status,
            database_manager,
            token_manager,
            diagnostics_manager,
            database_diagnostics_updater,
            shutdown_receiver,
            background_task_spawner,
            server_operator_override: None,
            database_operator_override: None,
            transaction_operator_override: None,
            user_operator_override: None,
        })
    }

    pub fn distribution_info(&self) -> DistributionInfo {
        self.distribution_info
    }

    pub fn grpc_listen_address(&self) -> SocketAddr {
        self.grpc_listen_address
    }

    pub fn http_listen_address(&self) -> Option<SocketAddr> {
        self.http_listen_address
    }

    pub fn admin_endpoint(&self) -> Option<&AdminPath> {
        self.admin_endpoint.as_ref()
    }

    pub fn servers(&self) -> &dyn ServerOperator {
        &*self.server_operator
    }

    pub fn databases(&self) -> &dyn DatabaseOperator {
        &*self.database_operator
    }

    pub fn transactions(&self) -> &dyn TransactionOperator {
        &*self.transaction_operator
    }

    pub fn users(&self) -> &dyn UserOperator {
        &*self.user_operator
    }

    pub fn diagnostics_manager(&self) -> Arc<DiagnosticsManager> {
        self.diagnostics_manager.clone()
    }

    pub fn shutdown_receiver(&self) -> Receiver<()> {
        self.shutdown_receiver.clone()
    }

    pub fn background_task_spawner(&self) -> TokioTaskSpawner {
        self.background_task_spawner.clone()
    }

    pub fn is_initialised(&self) -> bool {
        // Other operators don't require initialization
        self.user_operator.is_initialised()
    }

    pub async fn initialise(&self) -> Result<(), ArcServerStateError> {
        if self.is_initialised() {
            return Ok(());
        }

        // Initialize self for user_operator
        crate::system_init::initialise_system_database(self).await?;
        crate::system_init::initialise_system_database_schema(self).await?;
        crate::system_init::initialise_default_user(self).await?;

        Ok(())
    }

    async fn initialise_diagnostics(
        deployment_id: String,
        server_id: String,
        distribution_info: DistributionInfo,
        config: &DiagnosticsConfig,
        storage_directory: PathBuf,
        is_development_mode: bool,
        background_tasks: TokioTaskSpawner,
    ) -> DiagnosticsManager {
        let metrics_enabled = config.monitoring.enabled || config.reporting.report_metrics;
        let diagnostics = Diagnostics::new(
            deployment_id,
            server_id,
            distribution_info.distribution.to_owned(),
            distribution_info.version.to_owned(),
            storage_directory,
            config.reporting.report_metrics,
            metrics_enabled,
        );
        let diagnostics_manager = DiagnosticsManager::new(
            diagnostics,
            config.monitoring.port,
            config.monitoring.enabled,
            is_development_mode,
            background_tasks,
        );
        diagnostics_manager.may_start_monitoring().await;
        diagnostics_manager.may_start_reporting().await;
        diagnostics_manager
    }

    fn synchronize_database_metrics(
        diagnostics_manager: Arc<DiagnosticsManager>,
        database_manager: Arc<DatabaseManager>,
    ) {
        let snapshots = database_manager
            .map_user_databases(|database| (database.name_arc(), database.get_metrics()))
            .into_iter()
            .collect();
        diagnostics_manager.submit_database_metrics(snapshots);
    }

    pub async fn resolve_address(address: &str) -> Result<SocketAddr, ServerOpenError> {
        lookup_host(address)
            .await
            .map_err(|source| ServerOpenError::AddressResolutionFailed {
                address: address.to_string(),
                source: Arc::new(source),
            })?
            .next()
            .ok_or_else(|| ServerOpenError::AddressResolutionEmpty { address: address.to_string() })
    }

    async fn resolve_endpoints(config: &Config) -> Result<ResolvedEndpoints, ServerOpenError> {
        let server = &config.server;
        let monitoring = &config.diagnostics.monitoring;
        let grpc_listen_address = Self::resolve_address(&server.listen_address).await?;
        let grpc_advertise_address = server.advertise_address.clone();

        let http_listen_address =
            if server.http.enabled { Some(Self::resolve_address(&server.http.listen_address).await?) } else { None };
        let http_advertise_address = server.http.advertise_address.clone();

        let monitoring_address =
            monitoring.enabled.then(|| SocketAddr::from((std::net::Ipv4Addr::LOCALHOST, monitoring.port)));

        let mut reserved = HashSet::from([grpc_listen_address]);
        if let Some(address) = http_listen_address {
            if !reserved.insert(address) {
                return Err(ServerOpenError::HttpConflictingAddress { address });
            }
        }
        if let Some(address) = monitoring_address {
            if !reserved.insert(address) {
                return Err(ServerOpenError::MonitoringConflictingAddress { address });
            }
        }

        let admin_endpoint =
            server.admin.enabled.then(|| server.admin.resolve_endpoint(&config.storage.data_directory));

        let server_status = LocalServerStatus::new(
        
```

### Core Architecture Module: `server/state/server_operator.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::fmt::Debug;

use async_trait::async_trait;

use super::BoxServerStatus;
use crate::{error::ArcServerStateError, status::LocalServerStatus};

#[async_trait]
pub trait ServerOperator: Debug + Send + Sync {
    async fn status(&self) -> Result<BoxServerStatus, ArcServerStateError>;
    async fn statuses(&self) -> Result<Vec<BoxServerStatus>, ArcServerStateError>;
}

#[derive(Debug)]
pub struct LocalServerOperator {
    server_status: LocalServerStatus,
}

impl LocalServerOperator {
    pub fn new(server_status: LocalServerStatus) -> Self {
        Self { server_status }
    }
}

#[async_trait]
impl ServerOperator for LocalServerOperator {
    async fn status(&self) -> Result<BoxServerStatus, ArcServerStateError> {
        Ok(Box::new(self.server_status.clone()))
    }

    async fn statuses(&self) -> Result<Vec<BoxServerStatus>, ArcServerStateError> {
        self.status().await.map(|status| vec![status])
    }
}

```

### Core Architecture Module: `server/state/transaction_operator.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::{
    collections::{HashMap, HashSet},
    fmt::Debug,
    sync::Arc,
};

use async_trait::async_trait;
use concurrency::TokioTaskSpawner;
use database::{database_manager::DatabaseManager, transaction::TransactionId};
use futures::future::join_all;
use options::TransactionOptions;
use tokio::sync::{RwLock, mpsc::Sender};

use crate::{
    error::{ArcServerStateError, LocalServerStateError, arc_server_state_err},
    service::TransactionType,
    transaction::{Transaction, open_transaction_blocking},
};

#[derive(Debug)]
pub(crate) struct TransactionInfo {
    transaction_type: TransactionType,
    database_name: String,
    owner: String,
    close_sender: Sender<()>,
}

#[async_trait]
pub trait TransactionOperator: Debug + Send + Sync {
    async fn open(
        &self,
        database_name: &str,
        owner: String,
        transaction_type: TransactionType,
        options: TransactionOptions,
        close_sender: Sender<()>,
    ) -> Result<Transaction, ArcServerStateError>;

    async fn has_by_database(&self, database_name: &str) -> bool;

    async fn close_by_types(&self, types: &HashSet<TransactionType>);

    async fn close_by_owner(&self, username: &str);

    async fn close_by_database(&self, database_name: &str);
}

#[derive(Debug)]
pub struct LocalTransactionOperator {
    database_manager: Arc<DatabaseManager>,
    transactions: Arc<RwLock<HashMap<TransactionId, TransactionInfo>>>,
    background_task_spawner: TokioTaskSpawner,
}

impl LocalTransactionOperator {
    pub fn new(database_manager: Arc<DatabaseManager>, background_task_spawner: TokioTaskSpawner) -> Self {
        Self { database_manager, transactions: Arc::new(RwLock::new(HashMap::new())), background_task_spawner }
    }

    pub async fn record(
        &self,
        transaction_id: TransactionId,
        database_name: String,
        owner: String,
        transaction_type: TransactionType,
        close_sender: Sender<()>,
    ) {
        let close_sender_for_cleanup = close_sender.clone();
        let transactions_for_cleanup = self.transactions.clone();
        let mut transactions = self.transactions.write().await;
        transactions.insert(transaction_id, TransactionInfo { transaction_type, database_name, owner, close_sender });
        self.background_task_spawner.spawn(async move {
            close_sender_for_cleanup.closed().await;
            transactions_for_cleanup.write().await.remove(&transaction_id);
        });
    }

    async fn close_matching(&self, matches: impl Fn(&TransactionInfo) -> bool) {
        let close_senders: Vec<Sender<()>> = self
            .transactions
            .write()
            .await
            .extract_if(|_, info| matches(info))
            .map(|(_, info)| info.close_sender)
            .collect();
        join_all(close_senders.iter().map(|sender| async move {
            let _ = sender.send(()).await;
            sender.closed().await;
        }))
        .await;
    }
}

#[async_trait]
impl TransactionOperator for LocalTransactionOperator {
    async fn open(
        &self,
        database_name: &str,
        owner: String,
        transaction_type: TransactionType,
        options: TransactionOptions,
        close_sender: Sender<()>,
    ) -> Result<Transaction, ArcServerStateError> {
        let database = self.database_manager.database(database_name).ok_or_else(|| {
            arc_server_state_err(LocalServerStateError::DatabaseNotFound { name: database_name.to_string() })
        })?;
        let transaction =
            open_transaction_blocking(database, transaction_type, options).await.map_err(|typedb_source| {
                arc_server_state_err(LocalServerStateError::TransactionOpenFailed { typedb_source })
            })?;
        self.record(transaction.id(), database_name.to_owned(), owner, transaction_type, close_sender).await;
        Ok(transaction)
    }

    async fn has_by_database(&self, database_name: &str) -> bool {
        let transactions = self.transactions.read().await;
        transactions.values().any(|info| info.database_name == database_name)
    }

    async fn close_by_types(&self, types: &HashSet<TransactionType>) {
        self.close_matching(|info| types.contains(&info.transaction_type)).await
    }

    async fn close_by_owner(&self, username: &str) {
        self.close_matching(|info| info.owner == username).await
    }

    async fn close_by_database(&self, database_name: &str) {
        self.close_matching(|info| info.database_name == database_name).await
    }
}

```

### Core Architecture Module: `server/state/user_operator.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::{
    fmt::Debug,
    sync::{Arc, RwLock as StdRwLock},
};

use async_trait::async_trait;
use database::database_manager::DatabaseManager;
use resource::constants::server::DEFAULT_USER_NAME;
use system::concepts::{Credential, User};
use user::{permission_manager::PermissionManager, user_manager::UserManager};
use uuid::Uuid;

use super::TransactionOperator;
use crate::{
    authentication::{Accessor, credential_verifier::CredentialVerifier, token_manager::TokenManager},
    error::{ArcServerStateError, LocalServerStateError, arc_server_state_err},
    system_init::SYSTEM_DB,
};

#[async_trait]
pub trait UserOperator: Debug + Send + Sync {
    async fn all(&self, accessor: Accessor) -> Result<Vec<User>, ArcServerStateError>;

    async fn contains(&self, accessor: Accessor, name: &str) -> Result<bool, ArcServerStateError>;

    async fn get(&self, accessor: Accessor, name: &str) -> Result<User, ArcServerStateError>;

    async fn create(
        &self,
        accessor: Accessor,
        user: User,
        credential: Credential,
        user_uuid: Option<Uuid>,
        credential_uuid: Option<Uuid>,
    ) -> Result<(), ArcServerStateError>;

    async fn update(
        &self,
        accessor: Accessor,
        username: &str,
        user_update: Option<User>,
        credential_update: Option<Credential>,
    ) -> Result<(), ArcServerStateError>;

    async fn delete(&self, accessor: Accessor, username: &str) -> Result<(), ArcServerStateError>;

    async fn verify_password(&self, username: &str, password: &str) -> Result<(), ArcServerStateError>;

    async fn token_create(&self, username: String, password: String) -> Result<String, ArcServerStateError>;

    async fn token_get_owner(&self, token: &str) -> Option<String>;

    fn is_initialised(&self) -> bool;
}

#[derive(Debug)]
pub struct LocalUserOperator {
    database_manager: Arc<DatabaseManager>,
    token_manager: Arc<TokenManager>,
    user_manager: StdRwLock<Option<Arc<UserManager>>>,
    credential_verifier: StdRwLock<Option<Arc<CredentialVerifier>>>,
    transaction_operator: Arc<dyn TransactionOperator>,
}

impl LocalUserOperator {
    pub fn new(
        database_manager: Arc<DatabaseManager>,
        token_manager: Arc<TokenManager>,
        transaction_operator: Arc<dyn TransactionOperator>,
    ) -> Self {
        Self {
            database_manager,
            token_manager,
            user_manager: StdRwLock::new(None),
            credential_verifier: StdRwLock::new(None),
            transaction_operator,
        }
    }

    fn try_load_system_managers(&self) {
        if let Some(system_db) = self.database_manager.database_unrestricted(SYSTEM_DB) {
            let user_manager = Arc::new(UserManager::new(system_db));
            let credential_verifier = Arc::new(CredentialVerifier::new(user_manager.clone()));
            *self.user_manager.write().unwrap() = Some(user_manager);
            *self.credential_verifier.write().unwrap() = Some(credential_verifier);
        }
    }

    fn get_user_manager(&self) -> Result<Arc<UserManager>, LocalServerStateError> {
        if let Some(um) = self.user_manager.read().unwrap().clone() {
            return Ok(um);
        }
        self.try_load_system_managers();
        self.user_manager.read().unwrap().clone().ok_or(LocalServerStateError::NotInitialised {})
    }

    fn get_credential_verifier(&self) -> Result<Arc<CredentialVerifier>, LocalServerStateError> {
        if let Some(cv) = self.credential_verifier.read().unwrap().clone() {
            return Ok(cv);
        }
        self.try_load_system_managers();
        self.credential_verifier.read().unwrap().clone().ok_or(LocalServerStateError::NotInitialised {})
    }
}

#[async_trait]
impl UserOperator for LocalUserOperator {
    async fn all(&self, accessor: Accessor) -> Result<Vec<User>, ArcServerStateError> {
        if !PermissionManager::exec_user_all_permitted(accessor.as_str()) {
            return Err(Arc::new(LocalServerStateError::OperationNotPermitted {}));
        }

        match self.get_user_manager() {
            Ok(user_manager) => Ok(user_manager.all()),
            Err(err) => Err(Arc::new(err)),
        }
    }

    async fn contains(&self, accessor: Accessor, name: &str) -> Result<bool, ArcServerStateError> {
        if !PermissionManager::exec_user_get_permitted(accessor.as_str(), name) {
            return Err(Arc::new(LocalServerStateError::OperationNotPermitted {}));
        }

        match self.get_user_manager() {
            Ok(user_manager) => match user_manager.contains(name) {
                Ok(bool) => Ok(bool),
                Err(typedb_source) => Err(Arc::new(LocalServerStateError::UserCannotBeRetrieved { typedb_source })),
            },
            Err(err) => Err(Arc::new(err)),
        }
    }

    async fn get(&self, accessor: Accessor, name: &str) -> Result<User, ArcServerStateError> {
        if !PermissionManager::exec_user_get_permitted(accessor.as_str(), name) {
            return Err(Arc::new(LocalServerStateError::OperationNotPermitted {}));
        }

        match self.get_user_manager() {
            Ok(user_manager) => match user_manager.get(name) {
                Ok(get) => match get {
                    Some((user, _)) => Ok(user),
                    None => Err(Arc::new(LocalServerStateError::UserNotFound {})),
                },
                Err(typedb_source) => Err(Arc::new(LocalServerStateError::UserCannotBeRetrieved { typedb_source })),
            },
            Err(err) => Err(Arc::new(err)),
        }
    }

    async fn create(
        &self,
        accessor: Accessor,
        user: User,
        credential: Credential,
        user_uuid: Option<Uuid>,
        credential_uuid: Option<Uuid>,
    ) -> Result<(), ArcServerStateError> {
        if !PermissionManager::exec_user_create_permitted(accessor.as_str()) {
            return Err(Arc::new(LocalServerStateError::OperationNotPermitted {}));
        }

        let user_manager = self.get_user_manager().map_err(arc_server_state_err)?;
        let user_uuid = user_uuid.unwrap_or_else(Uuid::new_v4);
        let credential_uuid = credential_uuid.unwrap_or_else(Uuid::new_v4);
        user_manager
            .create(&user, &credential, user_uuid, credential_uuid)
            .map_err(|typedb_source| arc_server_state_err(LocalServerStateError::UserCannotBeCreated { typedb_source }))
    }

    async fn update(
        &self,
        accessor: Accessor,
        username: &str,
        user_update: Option<User>,
        credential_update: Option<Credential>,
    ) -> Result<(), ArcServerStateError> {
        if !PermissionManager::exec_user_update_permitted(accessor.as_str(), username) {
            return Err(Arc::new(LocalServerStateError::OperationNotPermitted {}));
        }

        let user_manager = self.get_user_manager().map_err(arc_server_state_err)?;
        user_manager.update(username, &user_update, &credential_update).map_err(|typedb_source| {
            arc_server_state_err(LocalServerStateError::UserCannotBeUpdated { typedb_source })
        })?;

        self.token_manager.invalidate_user(username).await;
        self.transaction_operator.close_by_owner(username).await;
        Ok(())
    }

    async fn delete(&self, accessor: Accessor, username: &str) -> Result<(), ArcServerStateError> {
        if !PermissionManager::exec_user_delete_allowed(accessor.as_str(), username) {
            return Err(Arc::new(LocalServerStateError::OperationNotPermitted {}));
        }

        let user_manager = self.get_user_manager().map_err(arc_server_state_err)?;
        user_manager.delete(username).map_err(|typedb_source| {
            arc_server_state_err(LocalServerStateError::UserCannotBeDeleted { typedb_source })
        })?;

        self.token_manager.invalidate_user(username).await;
        self.transaction_operator.close_by_owner(username).await;
        Ok(())
    }

    async fn verify_password(&self, username: &str, password: &str) -> Result<(), ArcServerStateError> {
        if !self.is_initialised() {
            return Err(Arc::new(LocalServerStateError::NotInitialised {}));
        }
        match self.get_credential_verifier() {
            Ok(credential_verifier) => match credential_verifier.verify_password(username, password) {
                Ok(()) => Ok(()),
                Err(typedb_source) => Err(Arc::new(LocalServerStateError::AuthenticationError { typedb_source })),
            },
            Err(err) => Err(Arc::new(err)),
        }
    }

    async fn token_create(&self, username: String, password: String) -> Result<String, ArcServerStateError> {
        self.verify_password(&username, &password).await?;
        Ok(self.token_manager.new_token(username).await)
    }

    async fn token_get_owner(&self, token: &str) -> Option<String> {
        self.token_manager.get_valid_token_owner(token).await
    }

    fn is_initialised(&self) -> bool {
        let Some(system_db) = self.database_manager.database_unrestricted(SYSTEM_DB) else {
            return false;
        };
        let user_manager = UserManager::new(system_db);
        user_manager.contains(DEFAULT_USER_NAME).unwrap_or(false)
    }
}

```

### Core Architecture Module: `system/util.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

pub mod transaction_util {
    use std::sync::Arc;

    use concept::{thing::thing_manager::ThingManager, type_::type_manager::TypeManager};
    use database::{
        Database,
        transaction::{
            CommitIntent, DataCommitError, SchemaCommitError, SchemaCommitIntent, TransactionRead, TransactionSchema,
            TransactionWrite,
        },
    };
    use function::function_manager::FunctionManager;
    use options::TransactionOptions;
    use query::query_manager::QueryManager;
    use resource::profile::TransactionProfile;
    use storage::{
        durability_client::WALClient,
        snapshot::{SchemaSnapshot, WriteSnapshot},
    };

    #[derive(Debug)]
    pub struct TransactionUtil {
        database: Arc<Database<WALClient>>,
    }

    impl TransactionUtil {
        pub fn new(database: Arc<Database<WALClient>>) -> Self {
            TransactionUtil { database }
        }

        pub fn schema_transaction<T>(
            &self,
            fn_: impl Fn(&mut SchemaSnapshot<WALClient>, &TypeManager, &ThingManager, &FunctionManager, &QueryManager) -> T,
        ) -> (TransactionProfile, Result<SchemaCommitIntent<WALClient>, SchemaCommitError>) {
            let TransactionSchema {
                snapshot,
                type_manager,
                thing_manager,
                function_manager,
                query_manager,
                database,
                transaction_options,
                profile,
            } = TransactionSchema::open(self.database.clone(), TransactionOptions::default()).unwrap(); // TODO
            let mut snapshot: SchemaSnapshot<WALClient> =
                Arc::try_unwrap(snapshot).unwrap_or_else(|_| panic!("Expected unique ownership of snapshot"));
            let _result = fn_(&mut snapshot, &type_manager, &thing_manager, &function_manager, &query_manager);
            let tx = TransactionSchema::from_parts(
                Arc::new(snapshot),
                type_manager,
                thing_manager,
                function_manager,
                query_manager,
                database,
                transaction_options,
                profile,
            );
            let (profile, result) = tx.finalise();
            (profile, result)
        }

        pub fn read_transaction<T>(&self, fn_: impl Fn(TransactionRead<WALClient>) -> T) -> T {
            let tx: TransactionRead<WALClient> =
                TransactionRead::open(self.database.clone(), TransactionOptions::default()).unwrap(); // TODO
            fn_(tx)
        }

        pub fn write_transaction<T>(
            &self,
            fn_: impl Fn(
                WriteSnapshot<WALClient>,
                Arc<TypeManager>,
                Arc<ThingManager>,
                Arc<FunctionManager>,
                Arc<QueryManager>,
                Arc<Database<WALClient>>,
                TransactionOptions,
            ) -> (T, Arc<WriteSnapshot<WALClient>>),
        ) -> (TransactionProfile, Result<T, DataCommitError>) {
            let TransactionWrite {
                snapshot,
                type_manager,
                thing_manager,
                function_manager,
                query_manager,
                database,
                transaction_options,
                profile,
            } = TransactionWrite::open(self.database.clone(), TransactionOptions::default()).unwrap();
            let (rows, snapshot) = fn_(
                Arc::try_unwrap(snapshot).unwrap_or_else(|_| panic!("Expected unique ownership of snapshot")),
                type_manager.clone(),
                thing_manager.clone(),
                function_manager.clone(),
                query_manager.clone(),
                database.clone(),
                transaction_options,
            );
            let tx = TransactionWrite::from_parts(
                snapshot,
                type_manager,
                thing_manager,
                function_manager,
                query_manager,
                database,
                TransactionOptions::default(),
                profile,
            );
            let (mut profile, finalise_result) = tx.finalise();
            let commit_result = finalise_result.and_then(|intent| intent.commit(profile.commit_profile()));
            profile.commit_profile().end();
            (profile, commit_result.map(|()| rows))
        }
    }
}

pub mod query_util {
    use std::{collections::HashMap, sync::Arc};

    use answer::variable_value::VariableValue;
    use concept::{thing::thing_manager::ThingManager, type_::type_manager::TypeManager};
    use database::transaction::TransactionRead;
    use executor::{
        ExecutionInterrupt,
        pipeline::stage::{ExecutionContext, StageIterator},
    };
    use function::function_manager::FunctionManager;
    use query::{error::QueryError, given_rows::GivenRowsSimple, query_manager::QueryManager};
    use storage::{durability_client::WALClient, snapshot::WriteSnapshot};
    use typeql::query::Pipeline;

    use crate::util::answer_util::collect_answer;

    pub fn execute_read_pipeline(
        tx: TransactionRead<WALClient>,
        pipeline: Pipeline,
        source_query: &str,
    ) -> (TransactionRead<WALClient>, Result<Vec<HashMap<String, VariableValue<'static>>>, Box<QueryError>>) {
        let prepared_pipeline = match tx.query_manager.prepare_read_pipeline(
            tx.snapshot.clone(),
            &tx.type_manager,
            tx.thing_manager.clone(),
            tx.function_manager.clone(),
            &pipeline,
            None::<GivenRowsSimple>,
            source_query,
        ) {
            Ok(pipeline) => pipeline,
            Err(err) => return (tx, Err(err)),
        };

        let named_outputs = prepared_pipeline.rows_positions().unwrap().clone();

        let result_as_batch = match prepared_pipeline.into_rows_iterator(ExecutionInterrupt::new_uninterruptible()) {
            Ok((iterator, _)) => iterator.collect_owned(),
            Err((typedb_source, _)) => {
                return (
                    tx,
                    Err(Box::new(QueryError::ReadPipelineExecution {
                        source_query: source_query.to_string(),
                        typedb_source,
                    })),
                );
            }
        };

        match result_as_batch {
            Ok(batch) => (tx, Ok(collect_answer(batch, named_outputs))),
            Err(typedb_source) => (
                tx,
                Err(Box::new(QueryError::ReadPipelineExecution {
                    source_query: source_query.to_string(),
                    typedb_source,
                })),
            ),
        }
    }

    pub fn execute_write_pipeline(
        snapshot: WriteSnapshot<WALClient>,
        type_manager: &TypeManager,
        thing_manager: Arc<ThingManager>,
        function_manager: Arc<FunctionManager>,
        query_manager: &QueryManager,
        pipeline: Pipeline,
        source_query: &str,
    ) -> (Result<Vec<HashMap<String, VariableValue<'static>>>, Box<QueryError>>, Arc<WriteSnapshot<WALClient>>) {
        let prepared_pipeline = match query_manager.prepare_write_pipeline(
            snapshot,
            type_manager,
            thing_manager,
            function_manager,
            &pipeline,
            None::<GivenRowsSimple>,
            source_query,
        ) {
            Ok(pipeline) => pipeline,
            Err((snapshot, err)) => return (Err(err), Arc::new(snapshot)),
        };

        let named_outputs = prepared_pipeline.rows_positions().unwrap().clone();

        let (result_as_batch, snapshot) =
            match prepared_pipeline.into_rows_iterator(ExecutionInterrupt::new_uninterruptible()) {
                Ok((iterator, ExecutionContext { snapshot, .. })) => (iterator.collect_owned(), snapshot),
                Err((typedb_source, ExecutionContext { snapshot, .. })) => {
                    return (
                        Err(Box::new(QueryError::WritePipelineExecution {
                            source_query: source_query.to_string(),
                            typedb_source,
                        })),
                        snapshot,
                    );
                }
            };

        match result_as_batch {
            Ok(batch) => (Ok(collect_answer(batch, named_outputs)), snapshot),
            Err(typedb_source) => (
                Err(Box::new(QueryError::WritePipelineExecution {
                    source_query: source_query.to_string(),
                    typedb_source,
                })),
                snapshot,
            ),
        }
    }
}

pub mod answer_util {
    use std::collections::HashMap;

    use answer::variable_value::VariableValue;
    use compiler::VariablePosition;
    use database::transaction::TransactionRead;
    use executor::batch::Batch;
    use lending_iterator::LendingIterator;
    use resource::profile::StorageCounters;
    use storage::durability_client::WALClient;

    pub fn collect_answer(
        batch: Batch,
        selected_outputs: HashMap<String, VariablePosition>,
    ) -> Vec<HashMap<String, VariableValue<'static>>> {
        batch
            .into_iterator_mut()
            .map_static(move |row| {
                let answer_map: HashMap<String, VariableValue<'static>> = selected_outputs
                    .iter()
                    .map(|(v, p)| (v.clone().to_owned(), row.get(*p).clone().into_owned()))
                    .collect::<HashMap<_, _>>();
                answer_map
            })
            .collect::<Vec<HashMap<String, VariableValue<'static>>>>()
    }

    pub fn get_string(tx: &TransactionRead<WALClient>, row: &HashMap<String, VariableValue>, var: &str) -> String {
        let var_ = row.get(var).unwrap();
        le
```

### Core Architecture Module: `util/project/project.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::{ops::Deref, sync::RwLockReadGuard};

pub struct RwLockReadGuardProject<'a, T: ?Sized + 'a, U: ?Sized + 'a> {
    projection: &'a U,
    guard: RwLockReadGuard<'a, T>,
}

impl<'a, T: ?Sized + 'a, U: ?Sized + 'a> RwLockReadGuardProject<'a, T, U> {
    /// # Safety
    /// TODO
    pub unsafe fn new(projection: &'a U, _guard: RwLockReadGuard<'a, T>) -> Self {
        Self { projection, guard: _guard }
    }
}

impl<'a, T: ?Sized + 'a, U: ?Sized + 'a> Deref for RwLockReadGuardProject<'a, T, U> {
    type Target = U;
    fn deref(&self) -> &Self::Target {
        self.projection
    }
}

pub trait ReadGuardWrap<'a, T: ?Sized + 'a> {
    fn into_guard(self) -> RwLockReadGuard<'a, T>;
}

impl<'a, T: ?Sized + 'a> ReadGuardWrap<'a, T> for RwLockReadGuard<'a, T> {
    fn into_guard(self) -> RwLockReadGuard<'a, T> {
        self
    }
}

impl<'a, T: ?Sized + 'a, U: ?Sized + 'a> ReadGuardWrap<'a, T> for RwLockReadGuardProject<'a, T, U> {
    fn into_guard(self) -> RwLockReadGuard<'a, T> {
        self.guard
    }
}

pub trait ReadGuard<'a, T: ?Sized + 'a>: Deref<Target = T> {}
impl<'a, T: ?Sized + 'a> ReadGuard<'a, T> for RwLockReadGuard<'a, T> {}
impl<'a, T: ?Sized + 'a, U: ?Sized + 'a> ReadGuard<'a, U> for RwLockReadGuardProject<'a, T, U> {}

#[macro_export]
macro_rules! read_guard_project {
    ($guard:expr => $field:ident) => {{
        let guard = $guard;
        unsafe {
            // SAFETY: this fn takes in a ref and ensures the pointer is aligned and safe to turn back into ref
            // addr_of!() does not provide that guarantee
            fn as_ptr<T>(t: &T) -> *const T {
                t as *const T
            }
            $crate::RwLockReadGuardProject::new(
                as_ptr(&guard.$field).as_ref().unwrap(),
                $crate::ReadGuardWrap::into_guard(guard),
            )
        }
    }};
    ($guard:ident => $projection:expr) => {{
        let ptr = std::ptr::addr_of!(*$projection);
        let guard = $guard;
        unsafe {
            // SAFETY: $projection is already a reference and is therefore properly aligned
            $crate::RwLockReadGuardProject::new(ptr.as_ref().unwrap(), $crate::ReadGuardWrap::into_guard(guard))
        }
    }};
}

#[cfg(test)]
mod test {
    use std::sync::{RwLock, RwLockReadGuard};

    use super::RwLockReadGuardProject;

    #[test]
    fn field_projection_test() {
        struct Test {
            foo: u8,
            bar: u8,
        }

        let rwlock = RwLock::new(Test { foo: 0xDE, bar: 0xAD });
        let foo = read_guard_project!(rwlock.read().unwrap() => foo);
        assert_eq!(*foo, 0xDE);
        assert!(rwlock.try_write().is_err());

        let bar = read_guard_project!(rwlock.read().unwrap() => bar);
        assert_eq!(*bar, 0xAD);
        assert!(rwlock.try_write().is_err());

        drop(foo);
        assert!(rwlock.try_write().is_err()); // bar is still holding a read lock

        drop(bar);
        assert!(rwlock.try_write().is_ok());
    }

    #[test]
    fn enum_projection_test() {
        #[allow(unused)]
        enum Test {
            Foo(u8),
            Bar(u8, u16),
        }

        fn project(guard: RwLockReadGuard<'_, Test>) -> RwLockReadGuardProject<'_, Test, u8> {
            read_guard_project!(guard => {
                match &*guard {
                    Test::Foo(a) => a,
                    Test::Bar(a, _) => a,
                }
            })
        }

        let rwlock = RwLock::new(Test::Foo(0xAB));
        let foo = project(rwlock.read().unwrap());
        assert_eq!(*foo, 0xAB);
        assert!(rwlock.try_write().is_err());

        drop(foo);
        assert!(rwlock.try_write().is_ok());

        let rwlock = RwLock::new(Test::Bar(0x07, 0xF00D));
        let bar = project(rwlock.read().unwrap());
        assert_eq!(*bar, 0x07);
        assert!(rwlock.try_write().is_err());

        drop(bar);
        assert!(rwlock.try_write().is_ok());
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8004** (2026-10-02): **Avoid blocking the transaction reservation queue on lock timeouts**
  *Symptoms*: ## Product change and motivation  Fix a bug where a timed-out schema transaction opening request could get stuck in the queue, blocking new schema and write transactions from opening.   ## Implementation  1. Reservation requests carry an id, so a request that times out withdraws itself from the queue. 2. The fulfillment of awaiting requests now stops while a schema transaction holds exclusivity. Without the check, withdrawing could hand a write transaction the lock while a schema transaction was running (with the updated code). 3. `Database::reset` reserved schema exclusivity and released it on one path out of six, leaving the database unable to open any write or schema transaction. Fixed with a small refactor. 4. Refactor the tuples and enums holding the state so we can work with them more easily. 

- **Issue #8003** (2026-10-01): **Stop copying the write buffer and optimize relation index qualification**
  *Symptoms*: ## Product change and motivation  Iteration over storage writes on finalisation cloned every buffered write into a `Vec`, then used the copy for two unrelated jobs. Each entry's copy doubled the footprint, and it grew without bound with commit size. Now, the iterators were redesigned to avoid cloning.  Additionally, with each `links` write forcing a relation index regeneration check, a relatively expensive recalculation of indexing qualification for its type was performed. A cache in `TypeManager` was introduced to accelerate the decision making.  ## Implementation  `ReadableSnapshot::iterate_writes` now borrows out of the buffer instead of cloning it, and the callers can copy out the needed keys themselves once.   Commit locks are only ever keyed on a `has` or a `links` edge, so they are created by visiting those two prefixes with the chunked `visit_writes_in_range` that the cleanup passes in the same file already use, which bounds how much is cloned at once. However, we still need to iterate fully for cleanup records collections, so the massive cloning was replaced by this potential "second iteration pass" in the algorithm -- which plays out to be more efficient for almost any size and structure of data.  Relation index qualification is saved per relation type on the type cache. Using `OnceLock` for the first time in the cache, since it's not just a simple read from storage -- it's a derivation from other parts which must be 100% finished on construction before 

- **Issue #8002** (2026-10-01): **Optimise Match stage executor to take a FixedBatch instead of a row as input**
  *Symptoms*: ## Implementation MatchStageExecutor takes a FixedBatch instead of a single input row, saving on allocations and getting the benefits of batching in multi-stage pipelines.

- **Issue #8001** (2026-10-03): **Fix attribute equality regression**
  *Symptoms*: ## Product change and motivation  Equality lookups on long strings, such as `match $n isa name; $n == "fixed_prefix_with_unique_tail_1234"` were tweaked to do scan rather than point lookup in #7869.  Strings longer than 16 bytes are stored under a hash rather than inline, scanning the entire bucket even when looking for a specific value rather than a range. Equality now uses the value's exact key again, while range comparisons keep using the order-preserving prefix-based search.  While fixing this, value comparisons on attribute variables were reworked so that all comparisons on a variable are combined before the storage lookup, which fixed several related bugs:  - **Missed answers when seeking with a bound of another value type.** When several `has` constraints were joined on an owner, the seek used the comparison bound in its own value type. A bound of a different type, such as a double against an integer attribute, could skip valid answers: `$p has age $a; $p has name $n; $a > 10.5;` could drop `age 11`. The same seek could skip long strings that sort after a bound, and datetime-tz values at the same instant in another time zone. - **Double bounds on decimal attributes** were converted incorrectly, so `match $x isa cost; $x == 10.5;` missed `10.5dec`. - **Sorting by values that have no ordering** (duration, struct) panicked at runtime. It is now a compile-time error, `UnorderedValueTypeForSortVariable`, for both attribute and computed value variables. - **Comparis

- **Issue #7998** (2026-09-30): **Reduce storage lookups and heap allocations for @card validations**
  *Symptoms*: ## Product change and motivation  Optimize the throughput of commit operations with new objects and changed types (operations affecting multiple interface instances) by reducing the number of type and constraint reads and collections.   ## Implementation  Before, for each new object, we used to get all its capabilities by interface types and collect their constraints. Over and over again. Now, we cache these checked constraints in method-local caches, using the object type as the key. This way, 100 objects of the same type collect the capabilities only once. Same for inf objects.

- **Issue #7997** (2026-09-28): **Don't clean up new, independent relations without players**
  *Symptoms*: ## Product change and motivation  Relations marked internally as 'independent' should survive at commit even without any linked players. The existing check at commit only looks at relations that lost a player in this transaction, not for newly written relations that never had one. A newly inserted relation may still get cleaned up at commit time. However, these relations' existence may be relied on, specifically by the database importer, in some cases.  ## Implementation  Check for relation independence for newly inserted relations as well. 

- **Issue #7996** (2026-09-29): **Introduce BTreeMapIntersectionIterator to use in isolation validation**
  *Symptoms*: ## Product change and motivation Introduce `BTreeMapIntersectionIterator`, which iterates through the shared keys of two BTreeMaps, and their corresponding values. Replaces the iterate-and-check approach to checking dependency between two commits. 

- **Issue #7994** (2026-09-30): **Upgrade Write::Put known_to_exist to 3 values, use when putting edges**
  *Symptoms*: ## Product change and motivation We extend the `known_to_exist` field in `Write::Put` to be a three-value enum `KnownToExist` (`Exists`, `NonExistent`, `Unknown`). By setting the edges connected of newly inserted vertices as `KnownToExist::NonExistent`, we can optimise the commit-time `set_initial_put_status` step to avoid hitting RocksDB. This step could be a significant chunk of the commit (20%-40%).

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

### Incident Patch 1: `f48fc4ca` (2026-10-03)
**Commit Message**: Fix attribute equality regression (#8001)

## Product change and motivation

Equality lookups on long strings, such as `match $n isa name; $n ==
"fixed_prefix_with_unique_tail_1234"` were tweaked to do scan rather
than point lookup in #7869. Strings longer than 16 bytes are stored
under a hash rather than inline, scanning the entire bucket even when
looking for a specific value rather than a range. Equality now uses the
value's exact key again, while range comparisons keep using the
order-preserving prefix-based search.

While fixing this, value comparisons on attribute variables were
reworked so that all comparisons on a variable are combined before the
storage lookup, which fixed several related bugs:

- **Missed answers when seeking with a bound of another value type.**
When several `has` constraints were joined on an owner, the seek used
the comparison bound in its own value type. A bound of a different type,
such as a double against an integer attribute, could skip valid answers:
`$p has age $a; $p has name $n; $a > 10.5;` could drop `age 11`. The
same seek could skip long strings that sort after a bound, and
datetime-tz values at the same instant in another time zone.
- **Dou

**File**: `MODULE.bazel` (modified, +1/-1)
```diff
@@ -193,7 +193,7 @@ bazel_dep(name = "typedb_behaviour", version = "0.0.0")
 git_override(
     module_name = "typedb_behaviour",
     remote = "https://github.com/typedb/typedb-behaviour",
-    commit = "5af278ec4585f1efc73d2dddf01aed3dadbdea12",
+    commit = "9dc71dcee4183b21caad2b78ecabd4eb702cc0c1",
 )
 
 http_file = use_repo_rule("@bazel_tools//tools/build_defs/repo:http.bzl", "http_file")
```

**File**: `compiler/annotation/inference/type_seeder.rs` (modified, +3/-3)
```diff
@@ -16,7 +16,7 @@ use concept::{
     error::ConceptReadError,
     type_::{OwnerAPI, PlayerAPI, TypeAPI, object_type::ObjectType, type_manager::TypeManager},
 };
-use encoding::value::value_type::{ValueType, ValueTypeCategory};
+use encoding::value::value_type::ValueType;
 use ir::{
     pattern::{
         Pattern, Vertex,
@@ -1336,7 +1336,7 @@ impl BinaryConstraint for Comparison<Variable> {
                 _ => None,
             };
             if let Some(value_type) = left_value_type {
-                let comparable_types = ValueTypeCategory::comparable_categories(value_type.category());
+                let comparable_types = self.comparator().comparable_categories(value_type.category());
                 for subattr in allowed_right_types {
                     if let Some(subvaluetype) = subattr
                         .as_attribute_type()
@@ -1376,7 +1376,7 @@ impl BinaryConstraint for Comparison<Variable> {
                 _ => None,
             };
             if let Some(value_type) = right_value_type {
-                let comparable_types = ValueTypeCategory::comparable_categories(value_type.category());
+                let comparable_types = self.comparator().comparable_categories(value_type.category());
                 for subattr in allowed_left_types {
                     if let Some(subvaluetype) = subattr
                         .as_attribute_type()
```

**File**: `compiler/annotation/mod.rs` (modified, +7/-0)
```diff
@@ -136,6 +136,13 @@ typedb_error!(
             actual: ExpressionValueType,
             source_span: Option<Span>,
         ),
+        UnorderedValueTypeForSortVariable(
+            20,
+            "The sort variable '{variable}' uses values of value-type '{value_type}', which have no ordering.",
+            variable: String,
+            value_type: ValueTypeCategory,
+            source_span: Option<Span>,
+        ),
         Internal(100, "Internal error: {message}", message: String),
     }
 );
```

**File**: `compiler/annotation/pipeline.rs` (modified, +25/-6)
```diff
@@ -46,9 +46,8 @@ use crate::{
         },
         fetch::{AnnotatedFetch, annotate_fetch},
         function::{
-            AnnotatedFunctionSignatures, AnnotatedFunctionSignaturesImpl, AnnotatedPreambleFunctions,
-            AnnotatedSchemaFunctions, FunctionParameterAnnotation, annotate_preamble_functions,
-            get_annotations_from_labels_vec,
+            AnnotatedFunctionSignaturesImpl, AnnotatedPreambleFunctions, AnnotatedSchemaFunctions,
+            FunctionParameterAnnotation, annotate_preamble_functions, get_annotations_from_labels_vec,
         },
         inference::match_inference::infer_types_for_block,
         type_annotations::{BlockAnnotations, ConstraintTypeAnnotations, TypeAnnotations},
@@ -435,8 +434,16 @@ pub fn validate_sort_variables_comparable(
     input_annotations: &RunningVariableAnnotations,
 ) -> Result<(), AnnotationError> {
     for sort_var in &sort.variables {
-        if input_annotations.values.contains_key(&sort_var.variable()) {
-            continue; // Expressions always return the same type.
+        if let Some(expression_value_type) = input_annotations.values.get(&sort_var.variable()) {
+            let category = expression_value_type.value_type().category();
+            if !category.is_order_comparable() {
+                let variable_name = ctx.name_for_error(sort_var.variable());
+                return Err(AnnotationError::UnorderedValueTypeForSortVariable {
+                    variable: variable_name,
+                    value_type: category,
+                    source_span: sort.source_span(),
+                });
+            }
         } else if let Some(types) = input_annotations.concepts.get(&sort_var.variable()) {
             let value_types = resolve_value_types(&(**types), ctx.snapshot, ctx.type_manager)
                 .map_err(|typedb_source| AnnotationError::TypeInference { typedb_source })?;
@@ -447,8 +454,20 @@ pub fn validate_sort_variables_comparable(
                     source_span: sort.source_span(),
                 });
             }
+            if let Some(unordered) = value_types
+                .iter()
+                .map(|value_type| value_type.category())
+                .find(|category| !category.is_order_comparable())
+            {
+                let variable_name = ctx.name_for_error(sort_var.variable());
+                return Err(AnnotationError::UnorderedValueTypeForSortVariable {
+                    variable: variable_name,
+                    value_type: unordered,
+                    source_span: sort.source_span(),
+                });
+            }
             let first_category = value_types.iter().next().unwrap().category();
-            let allowed_categories = ValueTypeCategory::comparable_categories(first_category);
+            let allowed_categories = first_category.order_comparable_categories();
             for other_type in value_types.iter().map(|v| v.category()) {
                 // Don't need to do pairwise if comparable is transitive
                 if !allowed_categories.contains(&other_type) {
```

**File**: `concept/tests/test_thing.rs` (modified, +14/-8)
```diff
@@ -32,7 +32,7 @@ use encoding::{
     graph::definition::definition_key::DefinitionKey,
     value::{
         label::Label,
-        value::Value,
+        value::{Value, ValueRestriction},
         value_struct::StructValue,
         value_type::{ValueType, ValueTypeCategory},
     },
@@ -401,7 +401,7 @@ fn get_has_reverse_in_range() {
             .get_has_reverse_in_range(
                 &snapshot,
                 age_type,
-                &(Bound::Included(Value::Integer(age_value_10)), Bound::Unbounded),
+                &ValueRestriction::new_range(Bound::Included(Value::Integer(age_value_10)), Bound::Unbounded),
                 &(Bound::Included(ObjectType::Entity(person_type)), Bound::Unbounded),
                 StorageCounters::DISABLED,
             )
@@ -412,7 +412,7 @@ fn get_has_reverse_in_range() {
             .get_has_reverse_in_range(
                 &snapshot,
                 age_type,
-                &(Bound::Excluded(Value::Integer(age_value_10)), Bound::Unbounded),
+                &ValueRestriction::new_range(Bound::Excluded(Value::Integer(age_value_10)), Bound::Unbounded),
                 &(Bound::Included(ObjectType::Entity(person_type)), Bound::Unbounded),
                 StorageCounters::DISABLED,
             )
@@ -423,7 +423,10 @@ fn get_has_reverse_in_range() {
             .get_has_reverse_in_range(
                 &snapshot,
                 age_type,
-                &(Bound::Included(Value::Integer(age_value_10)), Bound::Excluded(Value::Integer(age_value_11))),
+                &ValueRestriction::new_range(
+                    Bound::Included(Value::Integer(age_value_10)),
+                    Bound::Excluded(Value::Integer(age_value_11)),
+                ),
                 &(Bound::Included(ObjectType::Entity(person_type)), Bound::Unbounded),
                 StorageCounters::DISABLED,
             )
@@ -434,7 +437,10 @@ fn get_has_reverse_in_range() {
             .get_has_reverse_in_range(
                 &snapshot,
                 age_type,
-                &(Bound::Excluded(Value::Integer(age_value_10)), Bound::Excluded(Value::Integer(age_value_11))),
+                &ValueRestriction::new_range(
+                    Bound::Excluded(Value::Integer(age_value_10)),
+                    Bound::Excluded(Value::Integer(age_value_11)),
+                ),
                 &(Bound::Included(ObjectType::Entity(person_type)), Bound::Unbounded),
                 StorageCounters::DISABLED,
             )
@@ -445,7 +451,7 @@ fn get_has_reverse_in_range() {
             .get_has_reverse_in_range(
                 &snapshot,
                 age_type,
-                &(Bound::Included(Value::Integer(age_value_10)), Bound::Unbounded),
+                &ValueRestriction::new_range(Bound::Included(Value::Integer(age_value_10)), Bound::Unbounded),
                 &(Bound::Excluded(ObjectType::Entity(person_type)), Bound::Unbounded),
                 StorageCounters::DISABLED,
             )
@@ -457,7 +463,7 @@ fn get_has_reverse_in_range() {
             .get_has_reverse_in_range(
                 &snapshot,
                 age_type,
-                &(Bound::Excluded(Value::Integer(age_value_10)), Bound::Unbounded),
+                &ValueRestriction::new_range(Bound::Excluded(Value::Integer(age_value_10)), Bound::Unbounded),
                 &(Bound::Excluded(ObjectType::Entity(person_type)), Bound::Unbounded),
                 StorageCounters::DISABLED,
             )
@@ -469,7 +475,7 @@ fn get_has_reverse_in_range() {
             .get_has_reverse_in_range(
                 &snapshot,
                 age_type,
-                &(Bound::Unbounded, Bound::Included(Value::Integer(age_value_11))),
+                &ValueRestriction::new_range(Bound::Unbounded, Bound::Included(Value::Integer(age_value_11))),
                 &(Bound::Excluded(ObjectType::Entity(person_type)), Bound::Excluded(ObjectType::Entity(company_type))),
                 StorageCounters::DISABLED,
             )
```

**File**: `concept/thing/object.rs` (modified, +11/-7)
```diff
@@ -19,7 +19,11 @@ use encoding::{
         vertex_object::ObjectVertex,
     },
     layout::prefix::Prefix,
-    value::{decode_value_u64, value::Value, value_type::ValueTypeCategory},
+    value::{
+        decode_value_u64,
+        value::{Value, ValueRestriction},
+        value_type::ValueTypeCategory,
+    },
 };
 use lending_iterator::higher_order::Hkt;
 use resource::{
@@ -184,12 +188,12 @@ pub trait ObjectAPI: ThingAPI<Vertex = ObjectVertex> + Copy + fmt::Debug {
         self.get_has_types_range_unordered(snapshot, thing_manager, storage_counters)
     }
 
-    fn get_has_type_unordered<'a>(
+    fn get_has_type_unordered(
         self,
         snapshot: &impl ReadableSnapshot,
         thing_manager: &ThingManager,
         attribute_type: AttributeType,
-        value_range: &'a impl RangeBounds<Value<'a>>,
+        value_restriction: &ValueRestriction<'_>,
         storage_counters: StorageCounters,
     ) -> Result<
         Map<
@@ -202,7 +206,7 @@ pub trait ObjectAPI: ThingAPI<Vertex = ObjectVertex> + Copy + fmt::Debug {
             snapshot,
             self,
             attribute_type,
-            value_range,
+            value_restriction,
             storage_counters,
         )
     }
@@ -226,21 +230,21 @@ pub trait ObjectAPI: ThingAPI<Vertex = ObjectVertex> + Copy + fmt::Debug {
         thing_manager.owner_get_has_unordered_all(snapshot, self, storage_counters)
     }
 
-    fn get_has_types_range_unordered_in_value_types<'a>(
+    fn get_has_types_range_unordered_in_value_types(
         self,
         snapshot: &impl ReadableSnapshot,
         thing_manager: &ThingManager,
         attribute_type_range: &impl RangeBounds<AttributeType>,
         ordered_value_categories: &[ValueTypeCategory],
-        value_range: &'a impl RangeBounds<Value<'a>>,
+        value_restriction: &ValueRestriction<'_>,
         storage_counters: StorageCounters,
     ) -> Result<HasIterator, Box<ConceptReadError>> {
         thing_manager.owner_get_has_unordered_in_value_type(
             snapshot,
             self,
             attribute_type_range,
             ordered_value_categories,
-            value_range,
+            value_restriction,
             storage_counters,
         )
     }
```

**File**: `concept/thing/thing_manager.rs` (modified, +382/-274)
```diff
@@ -48,7 +48,7 @@ use encoding::{
         primitive_encoding::{decode_u64, encode_u64},
         string_bytes::StringBytes,
         struct_bytes::StructBytes,
-        value::Value,
+        value::{Value, ValueRestriction},
         value_struct::{StructIndexEntry, StructValue},
         value_type::{ValueType, ValueTypeCategory},
     },
@@ -524,48 +524,78 @@ impl ThingManager {
         Ok(Some(attribute))
     }
 
-    pub fn get_attributes_in_range<'a>(
+    pub fn get_attributes_in_range(
         &self,
         snapshot: &impl ReadableSnapshot,
         attribute_type: AttributeType,
-        value_range: &'a impl RangeBounds<Value<'a>>,
+        value_restriction: &ValueRestriction<'_>,
         storage_counters: StorageCounters,
     ) -> Result<AttributeIterator<InstanceIterator<Attribute>>, Box<ConceptReadError>> {
-        if matches!(value_range.start_bound(), Bound::Unbounded) && matches!(value_range.end_bound(), Bound::Unbounded)
-        {
-            return self.get_attributes_in(snapshot, attribute_type, storage_counters);
-        }
         let Some(attribute_value_type) = attribute_type.get_value_type_without_source(snapshot, self.type_manager())?
         else {
             return Ok(AttributeIterator::new_empty());
         };
+        let value_type_category = attribute_value_type.category();
+        match AttributeValueLookup::new(value_restriction, &[value_type_category]) {
+            AttributeValueLookup::All => self.get_attributes_in(snapshot, attribute_type, storage_counters),
+            AttributeValueLookup::Exact(value) => {
+                let attribute_key = self
+                    .get_attribute_vertex_prefix_for_equality(attribute_type.vertex().type_id_(), value.as_reference());
+                let has_reverse_prefix = ThingEdgeHasReverse::prefix_from_attribute_vertex_prefix(
+                    value_type_category,
+                    attribute_key.bytes(),
+                );
+                let attributes_iterator = InstanceIterator::new(
+                    snapshot.iterate_range(&KeyRange::new_within(attribute_key, false), storage_counters.clone()),
+                );
+                let has_reverse_range = KeyRange::new_within(has_reverse_prefix, false);
+                let has_reverse_iterator =
+                    HasReverseIterator::new(snapshot.iterate_range(&has_reverse_range, storage_counters));
+                Ok(AttributeIterator::new(
+                    attributes_iterator,
+                    has_reverse_iterator,
+                    self.type_manager().get_independent_attribute_types(snapshot)?,
+                ))
+            }
+            AttributeValueLookup::Range(lower, upper) => self.get_attributes_in_value_range(
+                snapshot,
+                attribute_type,
+                value_type_category,
+                &(lower, upper),
+                storage_counters,
+            ),
+            AttributeValueLookup::Empty => Ok(AttributeIterator::new_empty()),
+        }
+    }
 
-        let Some((value_lower_bound, value_upper_bound)) =
-            Self::get_value_range(attribute_value_type.category(), value_range)
-        else {
+    fn get_attributes_in_value_range<'a>(
+        &self,
+        snapshot: &impl ReadableSnapshot,
+        attribute_type: AttributeType,
+        value_type_category: ValueTypeCategory,
+        value_range: &'a impl RangeBounds<Value<'a>>,
+        storage_counters: StorageCounters,
+    ) -> Result<AttributeIterator<InstanceIterator<Attribute>>, Box<ConceptReadError>> {
+        let Some((lower, upper)) = Self::get_value_range(value_type_category, value_range) else {
             return Ok(AttributeIterator::new_empty());
         };
+
         let start_attribute_vertex_bound = self.get_attribute_vertex_prefix_lower_bound(
             attribute_type.vertex().type_id_(),
-            attribute_value_type.category(),
-            value_lower_bound,
+            value_type_category,
+            lower,
         );
         let end_attribute_vertex_bound = self.get_attribute_vertex_prefix_upper_bound(
             attribute_type.vertex().type_id_(),
-            attribute_value_type.category(),
-            value_upper_bound,
+            value_type_category,
+            upper,
         );
 
-        let has_reverse_start_prefix = start_attribute_vertex_bound.map(|start| {
-            ThingEdgeHasReverse::prefix_from_attribute_vertex_prefix(attribute_value_type.category(), start.bytes())
-        });
+        let has_reverse_start_prefix = start_attribute_vertex_bound
+            .map(|start| ThingEdgeHasReverse::prefix_from_attribute_vertex_prefix(value_type_category, start.bytes()));
         let has_reverse_end_prefix = end_attribute_vertex_bound.map(|end| {
-            ThingEdgeHasReverse::prefix_from_attribute_vertex_prefix(
-                attribute_value_type.category(),
-                end.as_reference().bytes(),
-            )
+            ThingEdgeHasReverse::
```

**File**: `concept/type_/type_manager/validation/operation_time_validation.rs` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@ use encoding::{
         definition::definition_key::DefinitionKey,
         type_::{CapabilityKind, Kind},
     },
-    value::{label::Label, value_type::ValueType},
+    value::{label::Label, value::ValueRestriction, value_type::ValueType},
 };
 use itertools::Itertools;
 use primitive::maybe_owns::MaybeOwns;
@@ -2790,7 +2790,7 @@ impl OperationTimeValidation {
                 snapshot,
                 thing_manager,
                 attribute_type,
-                &..,
+                &ValueRestriction::None,
                 storage_counters.clone(),
             )?;
 
```

---

### Incident Patch 2: `3df61c2d` (2026-10-02)
**Commit Message**: Avoid blocking the transaction reservation queue on lock timeouts (#8004)

## Product change and motivation

Fix a bug where a timed-out schema transaction opening request could get
stuck in the queue, blocking new schema and write transactions from
opening.

## Implementation

1. Reservation requests carry an id, so a request that times out
withdraws itself from the queue.
2. The fulfillment of awaiting requests now stops while a schema
transaction holds exclusivity. Without the check, withdrawing could hand
a write transaction the lock while a schema transaction was running
(with the updated code).
3. `Database::reset` reserved schema exclusivity and released it on one
path out of six, leaving the database unable to open any write or schema
transaction. Fixed with a small refactor.
4. Refactor the tuples and enums holding the state so we can work with
them more easily.

**File**: `database/database.rs` (modified, +122/-89)
```diff
@@ -11,7 +11,7 @@ use std::{
     path::{Path, PathBuf},
     sync::{
         Arc, Mutex, MutexGuard, RwLock, TryLockError,
-        mpsc::{SyncSender, sync_channel},
+        mpsc::{Receiver, SyncSender, sync_channel},
     },
     time::{Duration, Instant},
 };
@@ -77,11 +77,75 @@ pub(super) struct Schema {
     pub(super) function_cache: Arc<FunctionCache>,
 }
 
-type SchemaWriteTransactionState = (bool, usize, VecDeque<TransactionReservationRequest>);
+type ReservationRequestId = u64;
 
-enum TransactionReservationRequest {
-    Write(SyncSender<()>),
-    Schema(SyncSender<()>),
+#[derive(Clone, Copy, PartialEq, Eq)]
+enum TransactionReservationKind {
+    Write,
+    Schema,
+}
+
+struct TransactionReservationRequest {
+    id: ReservationRequestId,
+    kind: TransactionReservationKind,
+    notifier: SyncSender<()>,
+}
+
+struct SchemaWriteTransactionState {
+    has_schema_transaction: bool,
+    running_write_transactions: usize,
+    queue: VecDeque<TransactionReservationRequest>,
+    next_request_id: ReservationRequestId,
+}
+
+impl SchemaWriteTransactionState {
+    fn new() -> Self {
+        Self {
+            has_schema_transaction: false,
+            running_write_transactions: 0,
+            queue: VecDeque::with_capacity(100),
+            next_request_id: 0,
+        }
+    }
+
+    fn enqueue(&mut self, kind: TransactionReservationKind) -> (Receiver<()>, ReservationRequestId) {
+        let id = self.next_request_id;
+        self.next_request_id += 1;
+        let (notifier, receiver) = sync_channel::<()>(0);
+        self.queue.push_back(TransactionReservationRequest { id, kind, notifier });
+        (receiver, id)
+    }
+
+    fn is_blocked(&self, kind: TransactionReservationKind) -> bool {
+        self.has_schema_transaction
+            || (kind == TransactionReservationKind::Schema && self.running_write_transactions > 0)
+    }
+
+    fn admit(&mut self, kind: TransactionReservationKind) {
+        match kind {
+            TransactionReservationKind::Schema => self.has_schema_transaction = true,
+            TransactionReservationKind::Write => self.running_write_transactions += 1,
+        }
+    }
+
+    fn release(&mut self, kind: TransactionReservationKind) {
+        match kind {
+            TransactionReservationKind::Schema => self.has_schema_transaction = false,
+            TransactionReservationKind::Write => self.running_write_transactions -= 1,
+        }
+    }
+
+    fn fulfill_requests_until_blocked(&mut self) {
+        while let Some(kind) = self.queue.front().map(|request| request.kind) {
+            if self.is_blocked(kind) {
+                break;
+            }
+            let request = self.queue.pop_front().expect("Expected the peeked request");
+            if request.notifier.send(()).is_ok() {
+                self.admit(kind);
+            }
+        }
+    }
 }
 
 pub struct Database<D> {
@@ -125,58 +189,63 @@ impl<D> Database<D> {
         self.thing_vertex_generator.sync_from_storage(self.storage.clone())
     }
 
-    pub(super) fn reserve_write_transaction(&self, timeout_millis: u64) -> Result<(), TransactionError> {
-        let (mut guard, timeout_left) =
-            self.try_acquire_schema_write_transaction_lock(Duration::from_millis(timeout_millis))?;
-        let (has_schema_transaction, running_write_transactions, ref mut notify_queue) = *guard;
-
-        if has_schema_transaction || !notify_queue.is_empty() {
-            let (sender, receiver) = sync_channel::<()>(0);
-            notify_queue.push_back(TransactionReservationRequest::Write(sender));
-            drop(guard);
-            receiver.recv_timeout(timeout_left).map_err(|source| TransactionError::Timeout { source })?;
-        } else {
-            guard.1 = running_write_transactions + 1;
-            drop(guard);
-        }
-        Ok(())
+    pub(super) fn reserve_write_transaction(&self, timeout: Duration) -> Result<(), TransactionError> {
+        self.reserve_transaction(TransactionReservationKind::Write, timeout)
     }
 
-    pub(super) fn reserve_schema_transaction(&self, timeout_millis: u64) -> Result<(), TransactionError> {
-        let (mut guard, timeout_left) =
-            self.try_acquire_schema_write_transaction_lock(Duration::from_millis(timeout_millis))?;
-        let (has_schema_transaction, running_write_transactions, ref mut notify_queue) = *guard;
+    pub(super) fn reserve_schema_transaction(&self, timeout: Duration) -> Result<(), TransactionError> {
+        self.reserve_transaction(TransactionReservationKind::Schema, timeout)
+    }
 
-        if has_schema_transaction || running_write_transactions > 0 || !notify_queue.is_empty() {
-            let (sender, receiver) = sync_channel::<()>(0);
-            notify_queue.push_back(TransactionReservationRequest::Schema(sender));
-            drop(guard);
-            receiver.recv_timeout(timeout_left).map_err(|source| TransactionError::Timeout { source })?;
-        } else {
-            guard.
```

**File**: `database/tests/transaction.rs` (modified, +117/-0)
```diff
@@ -657,6 +657,28 @@ fn write_transaction_does_not_block_concurrent_write_transactions() {
         .unwrap();
 }
 
+#[test]
+fn timed_out_schema_request_does_not_block_concurrent_write_transactions() {
+    init_logging();
+    let databases_path = create_tmp_storage_dir();
+    let database = create_database(&databases_path);
+
+    let _tx_write_1 = open_write(database.clone());
+
+    let options = TransactionOptions { schema_lock_acquire_timeout_millis: 100, ..Default::default() };
+    let tx_schema_error = TransactionSchema::open(database.clone(), options).unwrap_err();
+    assert_transaction_timeout!(tx_schema_error);
+
+    let open_started = Instant::now();
+    let open_result = TransactionWrite::open(database, TransactionOptions::default());
+    assert_ok!(open_result);
+    assert!(
+        open_started.elapsed() < Duration::from_secs(1),
+        "Opening a write transaction waited for {:?}",
+        open_started.elapsed()
+    );
+}
+
 #[test]
 fn write_transaction_does_not_block_concurrent_read_transactions() {
     init_logging();
@@ -931,3 +953,98 @@ fn blocked_schema_and_write_transactions_can_progress_in_different_orders() {
         })
         .unwrap();
 }
+
+#[test]
+fn timed_out_request_does_not_let_a_write_transaction_past_a_schema_transaction() {
+    init_logging();
+    let databases_path = create_tmp_storage_dir();
+    let database = create_database(&databases_path);
+
+    let _tx_schema = open_schema(database.clone());
+
+    let runtime = Runtime::new().expect("Expected runtime");
+    runtime.block_on(async move {
+        let database_clone = database.clone();
+        let task_waiting = tokio::task::spawn_blocking(move || {
+            let options = TransactionOptions { schema_lock_acquire_timeout_millis: 1500, ..Default::default() };
+            TransactionWrite::open(database_clone, options).err()
+        });
+        sleep(Duration::from_millis(100)).await;
+        let task_giving_up = tokio::task::spawn_blocking(move || {
+            let options = TransactionOptions { schema_lock_acquire_timeout_millis: 200, ..Default::default() };
+            TransactionWrite::open(database, options).err()
+        });
+
+        let (giving_up, waiting) = tokio::try_join!(task_giving_up, task_waiting).unwrap();
+        let giving_up_error = giving_up.expect("Expected the early request to time out");
+        assert_transaction_timeout!(giving_up_error);
+        let waiting_error = waiting.expect("A write transaction was opened while a schema transaction was open");
+        assert_transaction_timeout!(waiting_error);
+    });
+}
+
+#[test]
+fn withdrawing_a_timed_out_request_admits_the_write_transactions_behind_it() {
+    init_logging();
+    let databases_path = create_tmp_storage_dir();
+    let database = create_database(&databases_path);
+
+    // Held for the whole test: the write request below is admitted while it is still open.
+    let _tx_write_1 = open_write(database.clone());
+
+    let runtime = Runtime::new().expect("Expected runtime");
+    runtime.block_on(async move {
+        let database_clone = database.clone();
+        let task_giving_up = tokio::task::spawn_blocking(move || {
+            let options = TransactionOptions { schema_lock_acquire_timeout_millis: 500, ..Default::default() };
+            TransactionSchema::open(database, options).err()
+        });
+        let task_queued_behind = tokio::task::spawn_blocking(move || {
+            std::thread::sleep(Duration::from_millis(100)); // queue behind the schema request
+            let open_started = Instant::now();
+            (TransactionWrite::open(database_clone, TransactionOptions::default()), open_started.elapsed())
+        });
+
+        let (giving_up, queued_behind) = tokio::try_join!(task_giving_up, task_queued_behind).unwrap();
+        let giving_up_error = giving_up.expect("Expected the schema request to time out");
+        assert_transaction_timeout!(giving_up_error);
+
+        // Withdrawing the schema request must admit this one, rather than leave it waiting for
+        // _tx_write_1, which is never released.
+        let (open_result, open_elapsed) = queued_behind;
+        assert_ok!(open_result);
+        assert!(open_elapsed < Duration::from_secs(5), "Opening a write transaction waited for {open_elapsed:?}");
+    });
+}
+
+#[test]
+fn a_queued_schema_request_is_not_jumped_by_later_write_transactions() {
+    init_logging();
+    let databases_path = create_tmp_storage_dir();
+    let database = create_database(&databases_path);
+
+    let tx_write_1 = open_write(database.clone());
+
+    let runtime = Runtime::new().expect("Expected runtime");
+    runtime.block_on(async move {
+        let database_clone = database.clone();
+        let task_schema = tokio::task::spawn_blocking(move || {
+            // Released as soon as it is admitted, so the write queued behind it can proceed.
+            TransactionSchema::open(database, TransactionOptions::default()).map(Tr
```

**File**: `database/transaction.rs` (modified, +6/-2)
```diff
@@ -7,6 +7,7 @@ use std::{
     fmt::Formatter,
     ops::Deref,
     sync::{Arc, mpsc::RecvTimeoutError},
+    time::Duration,
 };
 
 pub use concept::thing::cleanup::{CleanupIntervals, CleanupRecord};
@@ -136,7 +137,8 @@ pub struct TransactionWrite<D> {
 
 impl<D: DurabilityClient> TransactionWrite<D> {
     pub fn open(database: Arc<Database<D>>, transaction_options: TransactionOptions) -> Result<Self, TransactionError> {
-        database.reserve_write_transaction(transaction_options.schema_lock_acquire_timeout_millis)?;
+        database
+            .reserve_write_transaction(Duration::from_millis(transaction_options.schema_lock_acquire_timeout_millis))?;
 
         let schema = database.schema.read().unwrap();
         let snapshot: WriteSnapshot<D> = database.storage.clone().open_snapshot_write();
@@ -251,7 +253,9 @@ pub struct TransactionSchema<D> {
 
 impl<D: DurabilityClient> TransactionSchema<D> {
     pub fn open(database: Arc<Database<D>>, transaction_options: TransactionOptions) -> Result<Self, TransactionError> {
-        database.reserve_schema_transaction(transaction_options.schema_lock_acquire_timeout_millis)?;
+        database.reserve_schema_transaction(Duration::from_millis(
+            transaction_options.schema_lock_acquire_timeout_millis,
+        ))?;
 
         let snapshot: SchemaSnapshot<D> = database.storage.clone().open_snapshot_schema();
         let type_manager = Arc::new(TypeManager::new(
```

---

### Incident Patch 3: `5e8eadf3` (2026-10-01)
**Commit Message**: Optimise Match stage executor to take a FixedBatch instead of a row as input (#8002)

## Implementation
MatchStageExecutor takes a FixedBatch instead of a single input row, saving on allocations and getting the benefits of batching in multi-stage pipelines.

**File**: `executor/match_executor.rs` (modified, +4/-4)
```diff
@@ -27,7 +27,7 @@ use crate::{
 
 pub struct MatchExecutor {
     entry: PatternExecutor,
-    input: Option<MaybeOwnedRow<'static>>,
+    input: Option<FixedBatch>,
     tabled_functions: TabledFunctions,
 }
 
@@ -36,7 +36,7 @@ impl MatchExecutor {
         conjunction_executable: &ConjunctionExecutable,
         snapshot: &Arc<impl ReadableSnapshot + 'static>,
         thing_manager: &Arc<ThingManager>,
-        input: MaybeOwnedRow<'_>,
+        input_batch: FixedBatch,
         function_registry: Arc<ExecutableFunctionRegistry>,
         profile: &QueryProfile,
     ) -> Result<Self, Box<ConceptReadError>> {
@@ -50,7 +50,7 @@ impl MatchExecutor {
                 stage_profile,
             )?,
             tabled_functions: TabledFunctions::new(function_registry),
-            input: Some(input.into_owned()),
+            input: Some(input_batch),
         })
     }
 
@@ -70,7 +70,7 @@ impl MatchExecutor {
         interrupt: &mut ExecutionInterrupt,
     ) -> Result<Option<FixedBatch>, Box<ReadExecutionError>> {
         if let Some(input) = self.input.take() {
-            self.entry.prepare(FixedBatch::from(input.into_owned()));
+            self.entry.prepare(input);
         }
         self.entry.compute_next_batch(context, interrupt, &mut self.tabled_functions).map_err(|err| Box::new(err))
     }
```

**File**: `executor/pipeline/given.rs` (modified, +2/-0)
```diff
@@ -91,6 +91,7 @@ where
         self.row_counter += 1;
         Some(self.source_iterator.next()?.and_then(|row| {
             debug_assert!(row.row().len() == expected_types.len());
+            let start_timer = self.profile.start_measurement();
             row.iter().enumerate().try_for_each(|(column_index, entry)| {
                 if !row_entry_satisfies_optionality(optionality[column_index], entry) {
                     Err(Box::new(PipelineExecutionError::GivenValueDidNotSatisfyDeclaredOptionality {
@@ -108,6 +109,7 @@ where
                     Ok(())
                 }
             })?;
+            start_timer.end(&self.profile, 0, 1);
             Ok(row)
         }))
     }
```

**File**: `executor/pipeline/match_.rs` (modified, +15/-3)
```diff
@@ -15,6 +15,7 @@ use storage::snapshot::ReadableSnapshot;
 
 use crate::{
     ExecutionInterrupt,
+    batch::FixedBatch,
     error::ReadExecutionError,
     match_executor::{MatchExecutor, PatternIterator},
     pipeline::{
@@ -93,16 +94,27 @@ where
         while !self.current_iterator.as_mut().is_some_and(|iter| iter.peek().is_some()) {
             let ExecutionContext { snapshot, thing_manager, profile, .. } = &self.context;
 
-            let input_row = match self.source_iterator.next()? {
-                Ok(row) => row,
+            let input_batch = match self.source_iterator.next()? {
+                Ok(row) => {
+                    let mut batch = FixedBatch::new(row.len() as u32);
+                    batch.append(|mut appended| appended.copy_from_row(row));
+                    while !batch.is_full() {
+                        match self.source_iterator.next() {
+                            Some(Ok(row)) => batch.append(|mut appended| appended.copy_from_row(row)),
+                            Some(Err(err)) => return Some(Err(err)),
+                            None => break,
+                        }
+                    }
+                    batch
+                }
                 Err(err) => return Some(Err(err)),
             };
 
             let executor = MatchExecutor::new(
                 &self.executable,
                 snapshot,
                 thing_manager,
-                input_row,
+                input_batch,
                 self.function_registry.clone(),
                 profile,
             )
```

**File**: `executor/pipeline/put.rs` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@ use storage::snapshot::{ReadableSnapshot, WritableSnapshot};
 
 use crate::{
     ExecutionInterrupt,
-    batch::Batch,
+    batch::{Batch, FixedBatch},
     error::ReadExecutionError,
     match_executor::MatchExecutor,
     pipeline::{
@@ -126,7 +126,7 @@ fn match_iterator_for_row<Snapshot: ReadableSnapshot + 'static>(
         &put_executable.match_,
         &context.snapshot,
         &context.thing_manager,
-        input_row,
+        FixedBatch::from(input_row),
         function_registry,
         &context.profile,
     )
```

**File**: `executor/tests/compile_execute.rs` (modified, +13/-12)
```diff
@@ -24,7 +24,8 @@ use concept::{
 };
 use encoding::graph::definition::definition_key_generator::DefinitionKeyGenerator;
 use executor::{
-    ExecutionInterrupt, match_executor::MatchExecutor, pipeline::stage::ExecutionContext, row::MaybeOwnedRow,
+    ExecutionInterrupt, batch::FixedBatch, match_executor::MatchExecutor, pipeline::stage::ExecutionContext,
+    row::MaybeOwnedRow,
 };
 use function::function_manager::FunctionManager;
 use ir::{
@@ -154,7 +155,7 @@ fn test_has_planning_traversal() {
         &conjunction_executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -253,7 +254,7 @@ fn test_expression_planning_traversal() {
         &conjunction_executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -340,7 +341,7 @@ fn test_links_planning_traversal() {
         &conjunction_executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -434,7 +435,7 @@ fn test_links_intersection() {
         &conjunction_executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -519,7 +520,7 @@ fn test_negation_planning_traversal() {
         &conjunction_executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -626,7 +627,7 @@ fn test_forall_planning_traversal() {
         &conjunction_executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -718,7 +719,7 @@ fn test_named_var_select() {
         &conjunction_executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -810,7 +811,7 @@ fn test_disjunction_planning_traversal() {
         &conjunction_executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -906,7 +907,7 @@ fn test_disjunction_planning_nested_negations() {
         &conjunction_executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -965,7 +966,7 @@ fn test_mismatched_input_types() {
             &conjunction_executable,
             &snapshot,
             &thing_manager,
-            MaybeOwnedRow::empty(),
+            FixedBatch::from(MaybeOwnedRow::empty()),
             Arc::new(ExecutableFunctionRegistry::empty()),
             &QueryProfile::new(false),
         )
@@ -1000,7 +1001,7 @@ fn test_mismatched_input_types() {
             &conjunction_executable,
             &snapshot,
             &thing_manager,
-            MaybeOwnedRow::empty(),
+            FixedBatch::from(MaybeOwnedRow::empty()),
             Arc::new(ExecutableFunctionRegistry::empty()),
             &QueryProfile::new(false),
         )
```

**File**: `executor/tests/efficiency.rs` (modified, +3/-3)
```diff
@@ -43,8 +43,8 @@ use concept::{
 };
 use encoding::value::{label::Label, value::Value, value_type::ValueType};
 use executor::{
-    ExecutionInterrupt, error::ReadExecutionError, match_executor::MatchExecutor, pipeline::stage::ExecutionContext,
-    row::MaybeOwnedRow,
+    ExecutionInterrupt, batch::FixedBatch, error::ReadExecutionError, match_executor::MatchExecutor,
+    pipeline::stage::ExecutionContext, row::MaybeOwnedRow,
 };
 use ir::{
     pattern::{
@@ -459,7 +459,7 @@ fn execute_steps(
         &executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         profile,
     )
```

**File**: `executor/tests/execute_comparison_check.rs` (modified, +3/-3)
```diff
@@ -32,8 +32,8 @@ use compiler::{
 use concept::type_::{annotation::AnnotationIndependent, attribute_type::AttributeTypeAnnotation};
 use encoding::value::{label::Label, value::Value, value_type::ValueType};
 use executor::{
-    ExecutionInterrupt, error::ReadExecutionError, match_executor::MatchExecutor, pipeline::stage::ExecutionContext,
-    row::MaybeOwnedRow,
+    ExecutionInterrupt, batch::FixedBatch, error::ReadExecutionError, match_executor::MatchExecutor,
+    pipeline::stage::ExecutionContext, row::MaybeOwnedRow,
 };
 use ir::{
     pattern::constraint::{Comparator, IsaKind},
@@ -183,7 +183,7 @@ fn attribute_equality() {
         &executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
```

**File**: `executor/tests/execute_has.rs` (modified, +7/-7)
```diff
@@ -38,8 +38,8 @@ use concept::{
 };
 use encoding::value::{label::Label, value::Value, value_type::ValueType};
 use executor::{
-    ExecutionInterrupt, error::ReadExecutionError, match_executor::MatchExecutor, pipeline::stage::ExecutionContext,
-    row::MaybeOwnedRow,
+    ExecutionInterrupt, batch::FixedBatch, error::ReadExecutionError, match_executor::MatchExecutor,
+    pipeline::stage::ExecutionContext, row::MaybeOwnedRow,
 };
 use ir::{
     pattern::constraint::IsaKind,
@@ -221,7 +221,7 @@ fn traverse_has_unbounded_sorted_from() {
         &executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -328,7 +328,7 @@ fn traverse_has_bounded_sorted_from_chain_intersect() {
         &executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -423,7 +423,7 @@ fn traverse_has_unbounded_sorted_from_intersect() {
         &executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -506,7 +506,7 @@ fn traverse_has_unbounded_sorted_to_merged() {
         &executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
@@ -605,7 +605,7 @@ fn traverse_has_reverse_unbounded_sorted_from() {
         &executable,
         &snapshot,
         &thing_manager,
-        MaybeOwnedRow::empty(),
+        FixedBatch::from(MaybeOwnedRow::empty()),
         Arc::new(ExecutableFunctionRegistry::empty()),
         &QueryProfile::new(false),
     )
```

---

### Incident Patch 4: `27aade0c` (2026-09-28)
**Commit Message**: fix: correct "occured" to "occurred" in error messages (#7979)

## Product change and motivation

Fixes a misspelling in five user-facing error messages: `occured` ->
`occurred`.

## Implementation

Pure string literals; no control flow, types, or error codes change.

| File | Lines | Message |
| --- | --- | --- |
| `encoding/value/decimal_value.rs` | 390, 393 | integer / fractional
decimal parse failure |
| `query/error.rs` | 44 | `ErrorDecodingGivenRowEntry` |
| `query/given_rows.rs` | 102, 103 | `ParsingValueFailedForGivenEntry`,
`TranslatingValueFailedForGivenEntry` |

Verification performed locally on `78d7124`:

- `cargo check -p encoding -p query` — passes, no new warnings.
- `rustfmt --edition 2024 --config-path rustfmt.toml --check` on all
three files — clean.
- `git grep occured` — no remaining occurrences.
- `git grep` over `tests/` — nothing asserts on these strings, so no
test expectation
  is coupled to the old spelling.

No tests were added because the change is a literal-only correction with
no behaviour
change to cover.

**File**: `encoding/value/decimal_value.rs` (modified, +2/-2)
```diff
@@ -387,10 +387,10 @@ impl fmt::Debug for DecimalParseError {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         match self {
             Self::ParseIntegerPart { value, .. } => {
-                write!(f, "An error occured while parsing the integer part of the decimal '{value}'")
+                write!(f, "An error occurred while parsing the integer part of the decimal '{value}'")
             }
             Self::ParseFractionalPart { value, .. } => {
-                write!(f, "An error occured while parsing the fractional part of the decimal '{value}'")
+                write!(f, "An error occurred while parsing the fractional part of the decimal '{value}'")
             }
             Self::PrecisionExceeded { value, .. } => {
                 write!(f, "The provided decimal '{value}' cannot be parsed without a loss of precision ")
```

**File**: `query/error.rs` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ typedb_error! {
         GivenRowsMissingRequiredVariable(23, "The given rows are missing the required variable '{variable}'.", variable: String),
         ErrorDecodingGivenRowEntry(
             24,
-            "An error occured while decoding the given rows.",
+            "An error occurred while decoding the given rows.",
             typedb_source: Box<GivenRowDecodeError>,
         ),
     }
```

**File**: `query/given_rows.rs` (modified, +2/-2)
```diff
@@ -99,8 +99,8 @@ typedb_error! {
     pub GivenRowDecodeError(component = "Decoding given rows", prefix = "GVN") {
         ConceptDecode(1, "An error occurred while decoding the provided concept.", typedb_source: Box<ConceptDecodeError>),
         InvalidIIDFormatForGivenEntry(2, "The provided iid string '{iid}' was invalid.", iid: String),
-        ParsingValueFailedForGivenEntry(3, "An error occured while parsing the provided value '{value}'.", value: String, typedb_source: typeql::Error),
-        TranslatingValueFailedForGivenEntry(4, "An error occured while translating the provided value '{value}'.", value: String, typedb_source: LiteralParseError),
+        ParsingValueFailedForGivenEntry(3, "An error occurred while parsing the provided value '{value}'.", value: String, typedb_source: typeql::Error),
+        TranslatingValueFailedForGivenEntry(4, "An error occurred while translating the provided value '{value}'.", value: String, typedb_source: LiteralParseError),
         GivenRowsVariableWasNotDeclared(5, "The variable '{variable}' was not declared in the query.", variable: String),
         ExpectedInstanceReceivedValue(6, "A value was provided where a concept instance was expected."),
         ValueTypeMismatch(7, "The provided value '{value}' has type '{actual_type}' and could not be decoded as the value type '{expected_type}'.", expected_type: ValueType, actual_type: String, value: String),
```

---

### Incident Patch 5: `88f02dbc` (2026-09-28)
**Commit Message**: Fix max and min object type prefixes (#7993)

## Product change and motivation

Fix `max_object_type_prefix` and `min_object_type_prefix` results, used
for building `has` iterators in `ThingManager`. This was a latent bug in
the usage paths with no current callers (for unbounded searches).

## Implementation

Swap the values and convert the functions into constant members with a
const assert to reduce the room for logical errors.

Found accidentally, didn't verify with extra tests.

**File**: `concept/thing/thing_manager.rs` (modified, +2/-2)
```diff
@@ -1269,7 +1269,7 @@ impl ThingManager {
             ),
             Bound::Unbounded => RangeStart::Inclusive(ThingEdgeHasReverse::prefix_from_attribute_to_type_parts(
                 attribute.vertex(),
-                Prefix::min_object_type_prefix(),
+                Prefix::MIN_OBJECT_TYPE_PREFIX,
                 TypeID::MIN,
             )),
         };
@@ -1282,7 +1282,7 @@ impl ThingManager {
             ),
             Bound::Unbounded => RangeEnd::EndPrefixInclusive(ThingEdgeHasReverse::prefix_from_attribute_to_type_parts(
                 attribute.vertex(),
-                Prefix::max_object_type_prefix(),
+                Prefix::MAX_OBJECT_TYPE_PREFIX,
                 TypeID::MAX,
             )),
         };
```

**File**: `encoding/layout/prefix.rs` (modified, +5/-15)
```diff
@@ -88,22 +88,12 @@ enum Domain {
     Data,
 }
 
-impl Prefix {
-    pub fn max_object_type_prefix() -> Prefix {
-        if Prefix::VertexEntityType.prefix_id().byte < Prefix::VertexRelationType.prefix_id().byte {
-            Prefix::VertexEntityType
-        } else {
-            Prefix::VertexRelationType
-        }
-    }
+const _: () =
+    assert!(Prefix::MIN_OBJECT_TYPE_PREFIX.prefix_id().byte < Prefix::MAX_OBJECT_TYPE_PREFIX.prefix_id().byte);
 
-    pub fn min_object_type_prefix() -> Prefix {
-        if Prefix::VertexEntityType.prefix_id().byte < Prefix::VertexRelationType.prefix_id().byte {
-            Prefix::VertexRelationType
-        } else {
-            Prefix::VertexEntityType
-        }
-    }
+impl Prefix {
+    pub const MIN_OBJECT_TYPE_PREFIX: Prefix = Prefix::VertexEntityType;
+    pub const MAX_OBJECT_TYPE_PREFIX: Prefix = Prefix::VertexRelationType;
 
     pub fn schema_byte_ranges() -> Vec<RangeInclusive<u8>> {
         let mut ranges: Vec<RangeInclusive<u8>> = Vec::new();
```

---

### Incident Patch 6: `4ec90214` (2026-09-23)
**Commit Message**: Remove excessive memory consumption and fix bugs of uniqueness constraint checks (#7982)

## Product change and motivation

Optimise memory usage of schema transactions' operation-time validation
for `@unique` annotations, triggered by type hierarchy, annotations, and
ownership changes. While the previous algorithm stored all affected
objects in RAM, uncontrolled (potentially gigabytes of data for huge
datasets), the new approach uses the same pattern as write transactions'
checks, depending only on a set of `has` edges for a single attribute at
a time.

Additionally, resolve a discovered bug in the shared operation-time
suitability check: when an attribute (or role) type is moved under a new
supertype, constraints declared above the new supertype were not applied
to the moved subtree's existing instances, so any constraint violation
could be committed through a set supertype. Covered by
https://github.com/typedb/typedb-behaviour/pull/455.

Solves #7138 

## Implementation

### Optimisation 

Reuse `ThingManager`'s validation for unique constraints in
operation-time validation for `TypeManager`.

Before, the algorithm was:
1. Iterate over objects
2. For each `has` in this object, i

**File**: `MODULE.bazel` (modified, +1/-1)
```diff
@@ -193,7 +193,7 @@ bazel_dep(name = "typedb_behaviour", version = "0.0.0")
 git_override(
     module_name = "typedb_behaviour",
     remote = "https://github.com/typedb/typedb-behaviour",
-    commit = "25bac4ce17fcd7d4a1ff7cf2e58d95722de7cbbf",
+    commit = "5af278ec4585f1efc73d2dddf01aed3dadbdea12",
 )
 
 http_file = use_repo_rule("@bazel_tools//tools/build_defs/repo:http.bzl", "http_file")
```

**File**: `concept/thing/thing_manager/validation/operation_time_validation.rs` (modified, +11/-39)
```diff
@@ -4,11 +4,10 @@
  * file, You can obtain one at https://mozilla.org/MPL/2.0/.
  */
 
-use std::collections::{BTreeMap, Bound, HashMap, HashSet};
+use std::collections::{BTreeMap, HashMap, HashSet};
 
 use bytes::util::HexBytesFormatter;
 use encoding::value::{value::Value, value_type::ValueType};
-use iterator::minmax_or;
 use resource::profile::StorageCounters;
 use storage::snapshot::ReadableSnapshot;
 
@@ -421,19 +420,13 @@ impl OperationTimeValidation {
             .get_owned_attribute_type_constraint_unique(snapshot, thing_manager.type_manager(), attribute_type)
             .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?
         {
-            let owner = owner.into_object();
             let root_owner_type = constraint.source().owner();
             let root_owner_subtypes =
                 root_owner_type
                     .get_subtypes_transitive(snapshot, thing_manager.type_manager())
                     .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?;
             let owner_and_subtypes: HashSet<ObjectType> =
                 TypeAPI::chain_types(root_owner_type, root_owner_subtypes.into_iter().cloned()).collect();
-            let (owner_type_min, owner_type_max) = minmax_or!(
-                TypeAPI::chain_types(root_owner_type, root_owner_subtypes.into_iter().cloned()),
-                unreachable!("Expected at least one object type")
-            );
-            let owner_type_range = (Bound::Included(owner_type_min), Bound::Included(owner_type_max));
 
             let root_attribute_type = constraint.source().attribute();
             let root_attribute_subtypes = root_attribute_type
@@ -442,37 +435,16 @@ impl OperationTimeValidation {
             let attribute_and_subtypes =
                 TypeAPI::chain_types(root_attribute_type, root_attribute_subtypes.into_iter().cloned());
 
-            for attribute_type in attribute_and_subtypes {
-                if let Some(attribute) = thing_manager
-                    .get_attribute_with_value(snapshot, attribute_type, value.clone(), storage_counters.clone())
-                    .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?
-                {
-                    let mut has_iterator = thing_manager.get_has_reverse_by_attribute_and_owner_type_range(
-                        snapshot,
-                        &attribute,
-                        &owner_type_range,
-                        storage_counters.clone(),
-                    );
-
-                    while let Some((has, _)) = has_iterator
-                        .next()
-                        .transpose()
-                        .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?
-                    {
-                        // Iterator can return types outside the list based on the storage specifics
-                        if has.owner() != owner && owner_and_subtypes.contains(&has.owner().type_()) {
-                            return Err(DataValidation::create_data_validation_uniqueness_error(
-                                snapshot,
-                                thing_manager.type_manager(),
-                                &constraint,
-                                owner.into_object(),
-                                attribute_type,
-                                value,
-                            ));
-                        }
-                    }
-                }
-            }
+            DataValidation::validate_owns_unique_constraint(
+                snapshot,
+                thing_manager,
+                &constraint,
+                owner.into_object(),
+                &owner_and_subtypes,
+                attribute_and_subtypes,
+                value,
+                storage_counters,
+            )?;
         }
 
         Ok(())
```

**File**: `concept/thing/thing_manager/validation/validation.rs` (modified, +60/-3)
```diff
@@ -4,20 +4,28 @@
  * file, You can obtain one at https://mozilla.org/MPL/2.0/.
  */
 
+use std::collections::{Bound, HashSet};
+
 use bytes::util::HexBytesFormatter;
 use encoding::value::{label::Label, value::Value};
+use iterator::minmax_or;
+use resource::profile::StorageCounters;
 use storage::snapshot::ReadableSnapshot;
 
 use crate::{
     thing::{
-        ThingAPI, attribute::Attribute, object::Object, relation::Relation,
-        thing_manager::validation::DataValidationError,
+        ThingAPI,
+        attribute::Attribute,
+        object::Object,
+        relation::Relation,
+        thing_manager::{ThingManager, validation::DataValidationError},
     },
     type_::{
         Capability, TypeAPI,
         attribute_type::AttributeType,
         constraint::{CapabilityConstraint, Constraint, ConstraintError, TypeConstraint},
         entity_type::EntityType,
+        object_type::ObjectType,
         owns::Owns,
         plays::Plays,
         relates::Relates,
@@ -35,7 +43,7 @@ pub(crate) fn get_label_or_data_err(
     type_
         .get_label(snapshot, type_manager)
         .map(|label| label.clone())
-        .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))
+        .map_err(|typedb_source| Box::new(DataValidationError::ConceptRead { typedb_source }))
 }
 
 macro_rules! create_data_validation_type_abstractness_error_methods {
@@ -321,6 +329,55 @@ impl DataValidation {
         fn create_data_validation_relates_abstractness_error(Relates, Relation) -> RelatesConstraintViolated = relation_iid + relation_type + role_type;
     }
 
+    pub(crate) fn validate_owns_unique_constraint(
+        snapshot: &impl ReadableSnapshot,
+        thing_manager: &ThingManager,
+        constraint: &CapabilityConstraint<Owns>,
+        owner: Object,
+        owner_types: &HashSet<ObjectType>,
+        attribute_types: impl IntoIterator<Item = AttributeType>,
+        value: Value<'_>,
+        storage_counters: StorageCounters,
+    ) -> Result<(), Box<DataValidationError>> {
+        let (owner_type_min, owner_type_max) =
+            minmax_or!(owner_types.iter().copied(), unreachable!("Expected at least one object type"));
+        let owner_type_range = (Bound::Included(owner_type_min), Bound::Included(owner_type_max));
+        for attribute_type in attribute_types {
+            let Some(attribute) = thing_manager
+                .get_attribute_with_value(snapshot, attribute_type, value.clone(), storage_counters.clone())
+                .map_err(|typedb_source| Box::new(DataValidationError::ConceptRead { typedb_source }))?
+            else {
+                continue;
+            };
+
+            let mut has_iterator = thing_manager.get_has_reverse_by_attribute_and_owner_type_range(
+                snapshot,
+                &attribute,
+                &owner_type_range,
+                storage_counters.clone(),
+            );
+
+            while let Some((has, _)) = has_iterator
+                .next()
+                .transpose()
+                .map_err(|typedb_source| Box::new(DataValidationError::ConceptRead { typedb_source }))?
+            {
+                // The type range can hold owner types outside the hierarchy -> check owner_types
+                if has.owner() != owner && owner_types.contains(&has.owner().type_()) {
+                    return Err(Self::create_data_validation_uniqueness_error(
+                        snapshot,
+                        thing_manager.type_manager(),
+                        constraint,
+                        owner,
+                        attribute_type,
+                        value,
+                    ));
+                }
+            }
+        }
+        Ok(())
+    }
+
     pub(crate) fn create_data_validation_uniqueness_error(
         snapshot: &impl ReadableSnapshot,
         type_manager: &TypeManager,
```

**File**: `concept/type_/type_manager/validation/operation_time_validation.rs` (modified, +70/-44)
```diff
@@ -3085,25 +3085,38 @@ impl OperationTimeValidation {
             | ConstraintScope::AllInstancesOfTypeOrSubtypes => (),
         }
 
-        let source_interface_type = constraint.source().interface();
-
-        if source_interface_type == interface_type {
-            return Ok(true);
-        }
+        Self::is_interface_type_under_constraint_source(
+            snapshot,
+            type_manager,
+            constraint,
+            interface_type,
+            new_interface_supertypes,
+        )
+    }
 
-        for (subtype, supertype) in new_interface_supertypes {
-            if interface_type.is_subtype_transitive_of_or_same(snapshot, type_manager, *subtype)? {
-                return Ok(match supertype {
-                    None => false,
-                    Some(supertype) => {
-                        source_interface_type.is_subtype_transitive_of_or_same(snapshot, type_manager, *supertype)?
-                    }
-                });
+    fn is_interface_type_under_constraint_source<CAP: Capability>(
+        snapshot: &impl ReadableSnapshot,
+        type_manager: &TypeManager,
+        constraint: &CapabilityConstraint<CAP>,
+        interface_type: CAP::InterfaceType,
+        new_interface_supertypes: &HashMap<CAP::InterfaceType, Option<CAP::InterfaceType>>,
+    ) -> Result<bool, Box<ConceptReadError>> {
+        let source_interface_type = constraint.source().interface();
+        let mut visited = HashSet::new();
+        let mut current = Some(interface_type);
+        while let Some(type_) = current {
+            if type_ == source_interface_type {
+                return Ok(true);
             }
+            if !visited.insert(type_) {
+                return Ok(false);
+            }
+            current = match new_interface_supertypes.get(&type_) {
+                Some(new_supertype) => *new_supertype,
+                None => type_.get_supertype(snapshot, type_manager)?,
+            };
         }
-
-        // Not affected by new_interface_supertypes, can use storage
-        interface_type.is_subtype_transitive_of_or_same(snapshot, type_manager, source_interface_type)
+        Ok(false)
     }
 
     fn validate_owns_instances_against_constraints(
@@ -3164,8 +3177,36 @@ impl OperationTimeValidation {
             "At least one constraint should exist otherwise we don't need to iterate"
         );
 
-        // TODO #7138: It is EXCEPTIONALLY memory-greedy and should be optimized / removed from RAM!
-        let mut unique_values = HashMap::new();
+        let mut unique_attribute_types: HashSet<AttributeType> = HashSet::new();
+        let mut unique_owner_types: HashSet<ObjectType> = HashSet::new();
+        if let Some(unique_constraint) = &unique_constraint {
+            debug_assert_eq!(
+                unique_constraint.scope(),
+                ConstraintScope::AllInstancesOfTypeOrSubtypes,
+                "Reconsider the algorithm if constraint scope is changed!"
+            );
+            for attribute_type in attribute_types {
+                if Self::is_interface_type_under_constraint_source(
+                    snapshot,
+                    type_manager,
+                    unique_constraint,
+                    *attribute_type,
+                    new_attribute_supertypes,
+                )
+                .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?
+                {
+                    unique_attribute_types.insert(*attribute_type);
+                }
+            }
+
+            let root_owner_type = unique_constraint.source().owner();
+            let root_owner_subtypes = root_owner_type
+                .get_subtypes_transitive(snapshot, type_manager)
+                .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?;
+            unique_owner_types = TypeAPI::chain_types(root_owner_type, root_owner_subtypes.into_iter().cloned())
+                .chain(object_types.iter().copied())
+                .collect();
+        }
 
         for object_type in object_types {
             let mut object_iterator = thing_manager.get_objects_in(snapshot, *object_type, storage_counters.clone());
@@ -3270,32 +3311,17 @@ impl OperationTimeValidation {
                         .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?;
 
                     if let Some(unique_constraint) = &unique_constraint {
-                        debug_assert_eq!(
-                            unique_constraint.scope(),
-                            ConstraintScope::AllInstancesOfTypeOrSubtypes,
-                            "Reconsider the algorithm if constraint scope is changed!"
-                        );
-                        if Self::is_suitable_capability_constraint(
-                            snapshot,
-                            type_manager,
-                            unique_constraint,
-                            owns,
-        
```

---

### Incident Patch 7: `78d71246` (2026-09-18)
**Commit Message**: Fix function calls copying row where input row is narrower output row (#7952)

## Product change and motivation
This can happen when a function call is the first instruction after a stage that may narrow a row, such as select or delete. fixes #7930

**File**: `compiler/executable/match_/planner/mod.rs` (modified, +9/-14)
```diff
@@ -161,7 +161,6 @@ struct FunctionCallBuilder {
     function_id: FunctionID,
     arguments: Vec<VariablePosition>,
     assigned: Vec<Option<VariablePosition>>,
-    output_width: u32,
 }
 
 #[derive(Debug)]
@@ -283,19 +282,15 @@ impl StepBuilder {
                 ))
             }
 
-            StepInstructionsBuilder::FunctionCall(FunctionCallBuilder {
-                function_id,
-                arguments,
-                assigned,
-                output_width,
-                ..
-            }) => ExecutionStep::FunctionCall(FunctionCallStep {
-                function_id,
-                arguments,
-                assigned,
-                selected_variables,
-                output_width,
-            }),
+            StepInstructionsBuilder::FunctionCall(FunctionCallBuilder { function_id, arguments, assigned, .. }) => {
+                ExecutionStep::FunctionCall(FunctionCallStep {
+                    function_id,
+                    arguments,
+                    assigned,
+                    selected_variables,
+                    output_width,
+                })
+            }
         }
     }
 }
```

**File**: `compiler/executable/match_/planner/plan.rs` (modified, +0/-2)
```diff
@@ -1472,7 +1472,6 @@ impl ConjunctionPlan<'_> {
                         function_id: call_binding.function_call().function_id(),
                         arguments,
                         assigned,
-                        output_width: conjunction_builder.next_output.position,
                     });
                     conjunction_builder.push_step(&HashMap::new(), step_builder.into())
                 }
@@ -1510,7 +1509,6 @@ impl ConjunctionPlan<'_> {
                     function_id: call_binding.function_call().function_id(),
                     arguments,
                     assigned,
-                    output_width: conjunction_builder.next_output.position,
                 });
                 conjunction_builder.push_step(&HashMap::new(), step_builder.into());
             }
```

**File**: `executor/read/immediate_executor.rs` (modified, +20/-3)
```diff
@@ -941,7 +941,7 @@ impl CheckExecutor {
                 .map_err(|err| ReadExecutionError::ConceptRead { typedb_source: err })?
             {
                 output.append(|mut row| {
-                    row.copy_mapped(input_row, self.selected_variables.iter().map(|pos| (*pos, *pos)));
+                    row.merge_selected(&self.selected_variables, input_row, [], 1);
                 })
             }
         }
@@ -954,6 +954,7 @@ pub(crate) struct BuiltinCallExecutor {
     builtin_id: BuiltinConceptFunctionID,
     argument_positions: Vec<VariablePosition>,
     assignment_positions: Vec<Option<VariablePosition>>,
+    selected_variables: Vec<VariablePosition>,
     output_width: u32,
     input: Option<FixedBatch>,
     profile: Arc<StepProfile>,
@@ -970,10 +971,19 @@ impl BuiltinCallExecutor {
         builtin_id: BuiltinConceptFunctionID,
         argument_positions: Vec<VariablePosition>,
         assignment_positions: Vec<Option<VariablePosition>>,
+        selected_variables: Vec<VariablePosition>,
         output_width: u32,
         profile: Arc<StepProfile>,
     ) -> Self {
-        Self { builtin_id, argument_positions, assignment_positions, output_width, input: None, profile }
+        Self {
+            builtin_id,
+            argument_positions,
+            assignment_positions,
+            selected_variables,
+            output_width,
+            input: None,
+            profile,
+        }
     }
 
     pub(crate) fn output_width(&self) -> u32 {
@@ -1024,7 +1034,14 @@ impl BuiltinCallExecutor {
     ) -> Result<(), Box<ConceptReadError>> {
         macro_rules! execute {
             ($id:ident) => {
-                builtin_function::$id(&self.assignment_positions, &self.argument_positions, context, input_row, output)
+                builtin_function::$id(
+                    &self.assignment_positions,
+                    &self.argument_positions,
+                    &self.selected_variables,
+                    context,
+                    input_row,
+                    output,
+                )
             };
         }
 
```

**File**: `executor/read/immediate_executor/builtin_function.rs` (modified, +174/-146)
```diff
@@ -27,309 +27,322 @@ use ir::translation::function::FunctionAnnotation;
 use itertools::Itertools;
 use storage::snapshot::ReadableSnapshot;
 
-use crate::{Provenance, batch::FixedBatch, pipeline::stage::ExecutionContext, row::MaybeOwnedRow};
+use crate::{batch::FixedBatch, pipeline::stage::ExecutionContext, row::MaybeOwnedRow};
 
 pub(crate) fn iid(
     assignment_positions: &[Option<VariablePosition>],
     argument_positions: &[VariablePosition],
+    selected_variables: &[VariablePosition],
     _context: &ExecutionContext<impl ReadableSnapshot>,
     input_row: &MaybeOwnedRow<'_>,
     output: &mut FixedBatch,
 ) -> Result<(), Box<ConceptReadError>> {
     let Some(return_position) = assignment_positions[0] else {
-        output.append(|mut row| row.copy_from_row(input_row.as_reference()));
+        output.append(|mut row| row.merge_selected(selected_variables, input_row.as_reference(), [], 1));
         return Ok(()); // all concepts have IIDs
     };
-    let (mut row, multiplicity, provenance) = row_into_parts_widened(input_row, return_position);
     let iid = input_row[argument_positions[0].as_usize()].as_thing().iid();
-    row[return_position.as_usize()] = VariableValue::Value(Value::String(Cow::Owned(format!("{iid:x}"))));
-    let output_row = MaybeOwnedRow::new_owned(row, multiplicity, provenance);
-    output.append(|mut row| row.copy_from_row(output_row));
+    let iid_value = VariableValue::Value(Value::String(Cow::Owned(format!("{iid:x}"))));
+    output.append(|mut row| {
+        row.merge_selected(selected_variables, input_row.as_reference(), [(return_position, iid_value)], 1);
+    });
     Ok(())
 }
 
 pub(crate) fn label(
     assignment_positions: &[Option<VariablePosition>],
     argument_positions: &[VariablePosition],
+    selected_variables: &[VariablePosition],
     context: &ExecutionContext<impl ReadableSnapshot>,
     input_row: &MaybeOwnedRow<'_>,
     output: &mut FixedBatch,
 ) -> Result<(), Box<ConceptReadError>> {
     let Some(return_position) = assignment_positions[0] else {
-        output.append(|mut row| row.copy_from_row(input_row.as_reference()));
+        output.append(|mut row| row.merge_selected(selected_variables, input_row.as_reference(), [], 1));
         return Ok(()); // all types have labels
     };
-    let (mut row, multiplicity, provenance) = row_into_parts_widened(input_row, return_position);
     let ty = input_row[argument_positions[0].as_usize()].as_type();
     let label = ty.get_label(&**context.snapshot(), context.type_manager())?;
-    row[return_position.as_usize()] = VariableValue::Value(Value::String(Cow::Owned(label.to_string())));
-    let output_row = MaybeOwnedRow::new_owned(row, multiplicity, provenance);
-    output.append(|mut row| row.copy_from_row(output_row));
+    let label_value = VariableValue::Value(Value::String(Cow::Owned(label.to_string())));
+    output.append(|mut row| {
+        row.merge_selected(selected_variables, input_row.as_reference(), [(return_position, label_value)], 1);
+    });
     Ok(())
 }
 
 pub(crate) fn get_doc(
     assignment_positions: &[Option<VariablePosition>],
     argument_positions: &[VariablePosition],
+    selected_variables: &[VariablePosition],
     context: &ExecutionContext<impl ReadableSnapshot>,
     input_row: &MaybeOwnedRow<'_>,
     output: &mut FixedBatch,
 ) -> Result<(), Box<ConceptReadError>> {
     let Some(return_position) = assignment_positions[0] else {
-        output.append(|mut row| row.copy_from_row(input_row.as_reference()));
+        output.append(|mut row| row.merge_selected(selected_variables, input_row.as_reference(), [], 1));
         return Ok(()); // a missing doc is equivalent to @doc("")
     };
-    let (mut row, multiplicity, provenance) = row_into_parts_widened(input_row, return_position);
-    row[return_position.as_usize()] = get_type_doc(context, &input_row[argument_positions[0].as_usize()])?;
-    let output_row = MaybeOwnedRow::new_owned(row, multiplicity, provenance);
-    output.append(|mut row| row.copy_from_row(output_row));
+    let doc_value = get_type_doc(context, &input_row[argument_positions[0].as_usize()])?;
+    output.append(|mut row| {
+        row.merge_selected(selected_variables, input_row.as_reference(), [(return_position, doc_value)], 1);
+    });
     Ok(())
 }
 
 pub(crate) fn get_owns_doc(
     assignment_positions: &[Option<VariablePosition>],
     argument_positions: &[VariablePosition],
+    selected_variables: &[VariablePosition],
     context: &ExecutionContext<impl ReadableSnapshot>,
     input_row: &MaybeOwnedRow<'_>,
     output: &mut FixedBatch,
 ) -> Result<(), Box<ConceptReadError>> {
-    let Some(return_position) = assignment_positions[0] else {
-        output.append(|mut row| row.copy_from_row(input_row.as_reference()));
-        return Ok(()); // a missing doc is equivalent to @doc("")
-    };
-    let (mut row, multiplicity, provenance) = row_into_parts_widened(input_row, return_position);
     let owner = &input_
```

**File**: `executor/read/nested_pattern_executor.rs` (modified, +14/-13)
```diff
@@ -47,7 +47,7 @@ impl DisjunctionExecutor {
         let mut uniform_batch = FixedBatch::new(self.output_width);
         unmapped.into_iter().for_each(|row| {
             uniform_batch.append(|mut output_row| {
-                output_row.copy_mapped(row, self.selected_variables.iter().map(|&pos| (pos, pos)));
+                output_row.merge_selected(&self.selected_variables, row, [], 1);
                 output_row.set_branch_id_in_provenance(self.branch_ids[*source_branch_index]);
             })
         });
@@ -95,9 +95,7 @@ impl OptionalExecutor {
     pub(crate) fn map_as_failed_output(&self, unmapped_input: MaybeOwnedRow<'_>) -> FixedBatch {
         let mut output = FixedBatch::new(self.output_width);
         output.append(|mut output_row| {
-            output_row
-                .copy_mapped(unmapped_input.as_reference(), self.selected_variables.iter().map(|&pos| (pos, pos)));
-            output_row.set_provenance(unmapped_input.provenance()); // Pass through old provenance
+            output_row.merge_selected(&self.selected_variables, unmapped_input.as_reference(), [], 1);
         });
         output
     }
@@ -127,6 +125,7 @@ pub struct InlinedCallExecutor {
     pub inner: PatternExecutor,
     pub arg_mapping: Vec<VariablePosition>,
     pub assignment_positions: Vec<Option<VariablePosition>>,
+    pub selected_variables: Vec<VariablePosition>,
     pub output_width: u32,
     pub parameter_registry: Arc<ParameterRegistry>,
 }
@@ -141,6 +140,7 @@ impl InlinedCallExecutor {
             inner,
             arg_mapping: function_call.arguments.clone(),
             assignment_positions: function_call.assigned.clone(),
+            selected_variables: function_call.selected_variables.clone(),
             output_width: function_call.output_width,
             parameter_registry,
         }
@@ -167,16 +167,17 @@ impl InlinedCallExecutor {
             let returned_row = batch.get_row(return_index);
             if check_indices.iter().all(|(src, dst)| returned_row.get(*src) == input.get(*dst)) {
                 output_batch.append(|mut output_row| {
-                    output_row.copy_from_row(input.as_reference());
-                    output_row.copy_mapped(
-                        returned_row.as_reference(),
-                        self.assignment_positions
-                            .iter()
-                            .enumerate()
-                            .filter_map(|(src, &dst)| Some((VariablePosition::new(src as u32), dst?))),
+                    let extension = self
+                        .assignment_positions
+                        .iter()
+                        .enumerate()
+                        .filter_map(|(index, &dst)| Some((dst?, returned_row[index].clone())));
+                    output_row.merge_selected(
+                        &self.selected_variables,
+                        input.as_reference(),
+                        extension,
+                        returned_row.multiplicity(),
                     );
-                    // Fix provenance:
-                    output_row.set_provenance(input.provenance());
                 });
             }
         }
```

**File**: `executor/read/step_executor.rs` (modified, +2/-0)
```diff
@@ -204,6 +204,7 @@ pub(crate) fn create_executors_for_conjunction(
                         builtin_id,
                         function_call.arguments.clone(),
                         function_call.assigned.clone(),
+                        function_call.selected_variables.clone(),
                         function_call.output_width,
                         builtin_profile,
                     );
@@ -217,6 +218,7 @@ pub(crate) fn create_executors_for_conjunction(
                             function_call.function_id.clone(),
                             function_call.arguments.clone(),
                             function_call.assigned.clone(),
+                            function_call.selected_variables.clone(),
                             function_call.output_width,
                         );
                         steps.push(StepExecutors::TabledCall(executor))
```

**File**: `executor/read/tabled_call_executor.rs` (modified, +20/-10)
```diff
@@ -28,6 +28,7 @@ pub(crate) struct TabledCallExecutor {
     argument_positions: Vec<VariablePosition>,
     assignment_positions: Vec<Option<VariablePosition>>,
     output_width: u32,
+    selected_variables: Vec<VariablePosition>,
     active_executor: Option<TabledCallExecutorState>,
 }
 
@@ -54,9 +55,17 @@ impl TabledCallExecutor {
         function_id: FunctionID,
         argument_positions: Vec<VariablePosition>,
         assignment_positions: Vec<Option<VariablePosition>>,
+        selected_variables: Vec<VariablePosition>,
         output_width: u32,
     ) -> Self {
-        Self { function_id, argument_positions, assignment_positions, output_width, active_executor: None }
+        Self {
+            function_id,
+            argument_positions,
+            assignment_positions,
+            output_width,
+            selected_variables,
+            active_executor: None,
+        }
     }
 
     pub(crate) fn output_width(&self) -> u32 {
@@ -94,21 +103,22 @@ impl TabledCallExecutor {
             .filter_map(|(src, &dst)| Some((VariablePosition::new(src as u32), dst?)))
             .filter(|(_, dst)| dst.as_usize() < input.len() && input.get(*dst) != &VariableValue::None)
             .collect(); // TODO: Can we move this to compilation?
-
         for return_index in 0..returned_batch.len() {
             // TODO: Deduplicate?
             let returned_row = returned_batch.get_row(return_index);
             if check_indices.iter().all(|(src, dst)| returned_row.get(*src) == input.get(*dst)) {
                 output_batch.append(|mut output_row| {
-                    output_row.copy_from_row(input.as_reference());
-                    output_row.copy_mapped(
-                        returned_row,
-                        self.assignment_positions
-                            .iter()
-                            .enumerate()
-                            .filter_map(|(src, &dst)| Some((VariablePosition::new(src as u32), dst?))),
+                    let assignments = self
+                        .assignment_positions
+                        .iter()
+                        .enumerate()
+                        .filter_map(|(index, &dst)| Some((dst?, returned_row[index].clone())));
+                    output_row.merge_selected(
+                        &self.selected_variables,
+                        input.as_reference(),
+                        assignments,
+                        returned_row.multiplicity(),
                     );
-                    output_row.set_provenance(input.provenance())
                 });
             }
         }
```

**File**: `executor/row.rs` (modified, +14/-5)
```diff
@@ -59,11 +59,20 @@ impl<'a> Row<'a> {
         *self.provenance = row.provenance()
     }
 
-    pub(crate) fn copy_from(&mut self, row: &[VariableValue<'static>], multiplicity: u64, provenance: Provenance) {
-        debug_assert!(self.len() == row.len());
-        self.row.clone_from_slice(row);
-        *self.multiplicity = multiplicity;
-        *self.provenance = provenance
+    pub(crate) fn merge_selected(
+        &mut self,
+        selected: &[VariablePosition],
+        input: MaybeOwnedRow<'_>,
+        extension: impl IntoIterator<Item = (VariablePosition, VariableValue<'static>)>,
+        extension_multiplicity: u64,
+    ) {
+        self.copy_mapped(input, selected.iter().map(|&pos| (pos, pos)));
+        for (pos, value) in extension {
+            if selected.contains(&pos) {
+                self.set(pos, value);
+            }
+        }
+        *self.multiplicity *= extension_multiplicity;
     }
 
     pub(crate) fn copy_mapped(
```

---

### Incident Patch 8: `f5e1d028` (2026-09-17)
**Commit Message**: Lower commit validation memory consumption (#7973)

## Product change and motivation

Introduce a series of changes to lower the RAM consumption of a TypeDB
server during different schema validation operations.

### Database import excessive relaxation
Relaxation of cardinality constraints only affects annotations that are
set to non-zero lower bounds. Previously, the rule was to relax any
non-`0..` cardinality, which is too wide. Now, all capabilities with
default cardinalities and many other user-defined cases are untouched,
which makes the finalisation step much faster in many cases (it skips
the whole data cardinality verification -- one of the heaviest
operations in the process).

### Cardinality validation
Cardinality validation is used to collect all the affected instances in
RAM to combine changes from different sources: various schema changes
and instance inserts and deletions. This is too greedy for small
machines or huge datasets, so the algorithm was refactored.

Now, only types (a logically limited number) and a small portion of
instances are kept in memory at a time, processed in batches. With this,
the uncapped memory consumption (up to tens of GB) went to about a
hu

**File**: `Cargo.lock` (modified, +27/-27)
```diff
@@ -952,7 +952,7 @@ dependencies = [
  "paste",
  "pprof",
  "primitive",
- "rand 0.8.7",
+ "rand 0.8.8",
  "regex",
  "resource",
  "sentry",
@@ -1432,7 +1432,7 @@ dependencies = [
  "itertools 0.14.0",
  "logger",
  "lz4",
- "rand 0.8.7",
+ "rand 0.8.8",
  "resource",
  "serde",
  "tempdir",
@@ -1482,7 +1482,7 @@ dependencies = [
  "lending_iterator",
  "logger",
  "primitive",
- "rand 0.8.7",
+ "rand 0.8.8",
  "resource",
  "rocksdb",
  "seahash",
@@ -1630,7 +1630,7 @@ name = "fail_point"
 version = "0.0.0"
 dependencies = [
  "itertools 0.14.0",
- "rand 0.8.7",
+ "rand 0.8.8",
  "tracing",
 ]
 
@@ -1737,7 +1737,7 @@ dependencies = [
  "itertools 0.14.0",
  "logger",
  "primitive",
- "rand 0.8.7",
+ "rand 0.8.8",
  "resource",
  "storage",
  "test_utils",
@@ -3606,7 +3606,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "3c80231409c20246a13fddb31776fb942c38553c51e871f8cbd687a4cfb5843d"
 dependencies = [
  "phf_shared",
- "rand 0.8.7",
+ "rand 0.8.8",
 ]
 
 [[package]]
@@ -3879,7 +3879,7 @@ dependencies = [
  "byteorder",
  "hmac",
  "md-5",
- "rand 0.8.7",
+ "rand 0.8.8",
  "sha-1",
  "sha2",
 ]
@@ -3904,7 +3904,7 @@ dependencies = [
  "moka",
  "paste",
  "pprof",
- "rand 0.8.7",
+ "rand 0.8.8",
  "resource",
  "serde",
  "storage",
@@ -4021,16 +4021,16 @@ checksum = "552840b97013b1a26992c11eac34bdd778e464601a4c2054b5f0bff7c6761293"
 dependencies = [
  "fuchsia-cprng",
  "libc",
- "rand_core 0.3.1",
+ "rand_core 0.3.2",
  "rdrand",
  "winapi",
 ]
 
 [[package]]
 name = "rand"
-version = "0.8.7"
+version = "0.8.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "22f6172bdec972074665ed81ed53b71da00bfc44b65a753cfde883ec4c702a1a"
+checksum = "e058c7de0b26af77780c769414d6257830bb240f3c38477dbc2c16e5f54d6d4c"
 dependencies = [
  "libc",
  "rand_chacha",
@@ -4060,9 +4060,9 @@ dependencies = [
 
 [[package]]
 name = "rand_core"
-version = "0.3.1"
+version = "0.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7a6fdeb83b075e8266dcc8762c22776f6877a63111121f5f8c7411e5be7eed4b"
+checksum = "96f815e01bbd9678b50d927f79aa1cf3ffdfdb1b9787317c1284dadb894ad0e8"
 dependencies = [
  "rand_core 0.4.2",
 ]
@@ -4123,7 +4123,7 @@ version = "0.4.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "678054eb77286b51581ba43620cc911abf02758c91f93f479767aed0f90458b2"
 dependencies = [
- "rand_core 0.3.1",
+ "rand_core 0.3.2",
 ]
 
 [[package]]
@@ -4670,7 +4670,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "653942e6141f16651273159f4b8b1eaeedf37a7554c00cd798953e64b8a9bf72"
 dependencies = [
  "once_cell",
- "rand 0.8.7",
+ "rand 0.8.8",
  "sentry-types",
  "serde",
  "serde_json",
@@ -4706,7 +4706,7 @@ checksum = "2d4203359e60724aa05cf2385aaf5d4f147e837185d7dd2b9ccf1ee77f4420c8"
 dependencies = [
  "debugid",
  "hex",
- "rand 0.8.7",
+ "rand 0.8.8",
  "serde",
  "serde_json",
  "thiserror 1.0.69",
@@ -4862,7 +4862,7 @@ dependencies = [
  "prost",
  "pwhash",
  "query",
- "rand 0.8.7",
+ "rand 0.8.8",
  "regex",
  "resource",
  "rustls-pemfile",
@@ -4995,9 +4995,9 @@ checksum = "0c790de23124f9ab44544d7ac05d60440adc586479ce501c1d6d7da3cd8c9cf5"
 
 [[package]]
 name = "smallvec"
-version = "1.15.2"
+version = "1.16.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8ed6a63f02c8539c91a8685a86f4099661ba3da017932f6ebbea6de3f0fa7c90"
+checksum = "ba467056f1b547ed52077911161fc86985becbc60e8e1857c8a144dab0def891"
 
 [[package]]
 name = "smart-default"
@@ -5129,8 +5129,8 @@ dependencies = [
  "options",
  "pprof",
  "primitive",
- "rand 0.8.7",
- "rand_core 0.3.1",
+ "rand 0.8.8",
+ "rand_core 0.3.2",
  "resource",
  "rocksdb",
  "same-file",
@@ -5373,7 +5373,7 @@ name = "test_utils"
 version = "0.0.0"
 dependencies = [
  "logger",
- "rand 0.8.7",
+ "rand 0.8.8",
  "tracing",
 ]
 
@@ -5705,7 +5705,7 @@ dependencies = [
  "indexmap 1.9.3",
  "pin-project",
  "pin-project-lite",
- "rand 0.8.7",
+ "rand 0.8.8",
  "slab",
  "tokio",
  "tokio-util",
@@ -5853,7 +5853,7 @@ dependencies = [
  "http 1.5.0",
  "httparse",
  "log",
- "rand 0.8.7",
+ "rand 0.8.8",
  "sha1",
  "thiserror 1.0.69",
  "utf-8",
@@ -5925,8 +5925,8 @@ dependencies = [
  "logger",
  "options",
  "query",
- "rand 0.8.7",
- "rand_core 0.3.1",
+ "rand 0.8.8",
+ "rand_core 0.3.2",
  "resource",
  "sentry",
  "server",
@@ -6575,7 +6575,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "98b02842236d16708a11946c7df1b93769c053bc83257fdafdb7639dfb2490f3"
 dependencies = [
  "byteorder",
- "rand_core 0.3.1",
+ "rand_core 0.3.2",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +20/-20)
```diff
@@ -177,12 +177,12 @@ features = {}
 
 		[workspace.dependencies.rpassword]
 			features = []
-			version = "7.5.3"
+			version = "7.5.4"
 			default-features = false
 
 		[workspace.dependencies.rand]
 			features = ["alloc", "default", "getrandom", "libc", "rand_chacha", "small_rng", "std", "std_rng"]
-			version = "0.8.6"
+			version = "0.8.8"
 			default-features = false
 
 		[workspace.dependencies.tokio-test]
@@ -212,7 +212,7 @@ features = {}
 
 		[workspace.dependencies.xxhash-rust]
 			features = ["xxh3"]
-			version = "0.8.15"
+			version = "0.8.18"
 			default-features = false
 
 		[workspace.dependencies.options]
@@ -248,7 +248,7 @@ features = {}
 
 		[workspace.dependencies.regex]
 			features = ["default", "perf", "perf-backtrack", "perf-cache", "perf-dfa", "perf-inline", "perf-literal", "perf-onepass", "std", "unicode", "unicode-age", "unicode-bool", "unicode-case", "unicode-gencat", "unicode-perl", "unicode-script", "unicode-segment"]
-			version = "1.12.3"
+			version = "1.13.1"
 			default-features = false
 
 		[workspace.dependencies.system]
@@ -308,7 +308,7 @@ features = {}
 
 		[workspace.dependencies.moka]
 			features = ["default", "sync"]
-			version = "0.12.15"
+			version = "0.12.16"
 			default-features = false
 
 		[workspace.dependencies.server_admin_proto]
@@ -318,7 +318,7 @@ features = {}
 
 		[workspace.dependencies.async-trait]
 			features = []
-			version = "0.1.89"
+			version = "0.1.92"
 			default-features = false
 
 		[workspace.dependencies.typedb-admin]
@@ -337,8 +337,8 @@ features = {}
 			default-features = false
 
 		[workspace.dependencies.tokio-util]
-			features = ["codec", "default", "futures-util", "io", "rt"]
-			version = "0.7.18"
+			features = ["codec", "default", "futures-util", "io", "libc", "rt"]
+			version = "0.7.19"
 			default-features = false
 
 		[workspace.dependencies.tower-http]
@@ -348,7 +348,7 @@ features = {}
 
 		[workspace.dependencies.serde]
 			features = ["alloc", "default", "derive", "rc", "serde_derive", "std"]
-			version = "1.0.228"
+			version = "1.0.229"
 			default-features = false
 
 		[workspace.dependencies.lz4]
@@ -383,7 +383,7 @@ features = {}
 
 		[workspace.dependencies.clap]
 			features = ["color", "default", "derive", "error-context", "help", "std", "suggestions", "usage", "wrap_help"]
-			version = "4.6.1"
+			version = "4.6.6"
 			default-features = false
 
 		[workspace.dependencies.async-std]
@@ -398,12 +398,12 @@ features = {}
 
 		[workspace.dependencies.chrono]
 			features = ["alloc", "clock", "default", "iana-time-zone", "js-sys", "now", "oldtime", "std", "wasm-bindgen", "wasmbind", "winapi", "windows-link"]
-			version = "0.4.44"
+			version = "0.4.45"
 			default-features = false
 
 		[workspace.dependencies.serde_json]
 			features = ["default", "raw_value", "std"]
-			version = "1.0.150"
+			version = "1.0.151"
 			default-features = false
 
 		[workspace.dependencies.xoshiro]
@@ -473,7 +473,7 @@ features = {}
 
 		[workspace.dependencies.serde_with]
 			features = ["alloc", "default", "macros", "std"]
-			version = "3.20.0"
+			version = "3.22.0"
 			default-features = false
 
 		[workspace.dependencies.hyper]
@@ -514,7 +514,7 @@ features = {}
 
 		[workspace.dependencies.macro_rules_attribute]
 			features = ["default"]
-			version = "0.2.2"
+			version = "0.2.3"
 			default-features = false
 
 		[workspace.dependencies.encoding]
@@ -534,7 +534,7 @@ features = {}
 
 		[workspace.dependencies.http]
 			features = ["default", "std"]
-			version = "1.4.1"
+			version = "1.5.0"
 			default-features = false
 
 		[workspace.dependencies.hyper-rustls]
@@ -544,7 +544,7 @@ features = {}
 
 		[workspace.dependencies.rand_core]
 			features = ["default", "std"]
-			version = "0.3.1"
+			version = "0.3.2"
 			default-features = false
 
 		[workspace.dependencies.lending_iterator]
@@ -624,7 +624,7 @@ features = {}
 
 		[workspace.dependencies.tokio]
 			features = ["bytes", "default", "fs", "io-std", "io-util", "libc", "macros", "mio", "net", "rt", "rt-multi-thread", "signal", "signal-hook-registry", "socket2", "sync", "test-util", "time", "tokio-macros"]
-			version = "1.52.3"
+			version = "1.53.1"
 			default-features = false
 
 		[workspace.dependencies.structural_equality]
@@ -634,12 +634,12 @@ features = {}
 
 		[workspace.dependencies.tokio-stream]
 			features = ["default", "net", "time"]
-			version = "0.1.18"
+			version = "0.1.19"
 			default-features = false
 
 		[workspace.dependencies.futures]
 			features = ["alloc", "async-await", "default", "executor", "futures-executor", "std", "thread-pool"]
-			version = "0.3.32"
+			version = "0.3.34"
 			default-features = false
 
 		[workspace.dependencies.home]
@@ -659,7 +659,7 @@ features = {}
 
 		[workspace.dependencies.smallvec]
 			features = ["const_generics", "const_new"]
-			version = "1.15.1"
+			version = "1.16.0"
 			default-features = false
 
 		[workspace.dependencies.bytes]
```

**File**: `MODULE.bazel` (modified, +1/-1)
```diff
@@ -193,7 +193,7 @@ bazel_dep(name = "typedb_behaviour", version = "0.0.0")
 git_override(
     module_name = "typedb_behaviour",
     remote = "https://github.com/typedb/typedb-behaviour",
-    commit = "7d35851bffeabd642b7288dea82eb63852f3c191",
+    commit = "25bac4ce17fcd7d4a1ff7cf2e58d95722de7cbbf",
 )
 
 http_file = use_repo_rule("@bazel_tools//tools/build_defs/repo:http.bzl", "http_file")
```

**File**: `concept/thing/thing_manager.rs` (modified, +336/-91)
```diff
@@ -87,7 +87,7 @@ use crate::{
         r#struct::StructIndexForAttributeTypeIterator,
         thing_manager::validation::{
             DataValidationError,
-            cardinality_validation::{CardinalityChangeTracker, CardinalityValidation, collect_errors},
+            cardinality_validation::{CardinalityValidation, ModifiedCapabilityTypes},
             operation_time_validation::OperationTimeValidation,
         },
     },
@@ -106,6 +106,31 @@ use crate::{
 
 pub mod validation;
 
+pub(crate) struct ModifiedOwnerHas {
+    pub owner: Object,
+    pub status: ConceptStatus,
+    pub modified_attribute_types: HashSet<AttributeType>,
+}
+
+pub(crate) struct ModifiedRelationLinks {
+    pub relation: Relation,
+    pub status: ConceptStatus,
+    pub modified_role_types: HashSet<RoleType>,
+    pub removed_role_players: HashSet<(Object, RoleType)>,
+}
+
+pub(crate) struct ModifiedPlayerLinks {
+    pub player: Object,
+    pub status: ConceptStatus,
+    pub modified_role_types: HashSet<RoleType>,
+}
+
+#[derive(Clone, Copy)]
+struct RelationIndexQualification {
+    qualified_before: bool,
+    qualified_now: bool,
+}
+
 #[derive(Debug)]
 pub struct ThingManager {
     vertex_generator: Arc<ThingVertexGenerator>,
@@ -1651,6 +1676,127 @@ impl ThingManager {
             })
     }
 
+    pub(crate) fn for_each_new_object<Snapshot: ReadableSnapshot, E>(
+        &self,
+        snapshot: &mut Snapshot,
+        mut visit: impl FnMut(&mut Snapshot, Object) -> Result<(), E>,
+    ) -> Result<(), E> {
+        let objects = KeyRange::new(
+            RangeStart::Inclusive(ObjectVertex::MIN.into_storage_key()),
+            RangeEnd::EndPrefixInclusive(ObjectVertex::MAX.into_storage_key()),
+            ObjectVertex::FIXED_WIDTH_ENCODING,
+        );
+        snapshot.visit_writes_in_range(&objects, |snapshot, key, write| match write {
+            Write::Insert { .. } => visit(snapshot, Object::new(ObjectVertex::decode(key.bytes()))),
+            Write::Delete => Ok(()),
+            Write::Put { .. } => unreachable!("Encountered a Put for an object"),
+        })
+    }
+
+    pub(crate) fn for_each_owner_with_modified_has<Snapshot: ReadableSnapshot, E>(
+        &self,
+        snapshot: &mut Snapshot,
+        storage_counters: StorageCounters,
+        read_error: impl Fn(Box<ConceptReadError>) -> E,
+        mut visit: impl FnMut(&mut Snapshot, ModifiedOwnerHas) -> Result<(), E>,
+    ) -> Result<(), E> {
+        let mut group: Option<ModifiedOwnerHas> = None;
+        let mut flush = |snapshot: &mut Snapshot, group: Option<ModifiedOwnerHas>| match group {
+            Some(modified) => visit(snapshot, modified),
+            None => Ok(()),
+        };
+        snapshot.visit_writes_in_range(
+            &KeyRange::new_within(ThingEdgeHas::prefix(), ThingEdgeHas::FIXED_WIDTH_ENCODING),
+            |snapshot, key, _| {
+                let edge = ThingEdgeHas::decode(Bytes::Reference(key.byte_array()));
+                let owner = Object::new(edge.from());
+                if !group.as_ref().is_some_and(|modified| modified.owner == owner) {
+                    flush(snapshot, group.take())?;
+                    let status = self
+                        .get_status(snapshot, owner.vertex().into_storage_key(), storage_counters.clone())
+                        .map_err(&read_error)?;
+                    group = Some(ModifiedOwnerHas { owner, status, modified_attribute_types: HashSet::new() });
+                }
+                group.as_mut().unwrap().modified_attribute_types.insert(Attribute::new(edge.to()).type_());
+                Ok(())
+            },
+        )?;
+        flush(snapshot, group.take())
+    }
+
+    pub(crate) fn for_each_relation_with_modified_links<Snapshot: ReadableSnapshot, E>(
+        &self,
+        snapshot: &mut Snapshot,
+        storage_counters: StorageCounters,
+        read_error: impl Fn(Box<ConceptReadError>) -> E,
+        mut visit: impl FnMut(&mut Snapshot, ModifiedRelationLinks) -> Result<(), E>,
+    ) -> Result<(), E> {
+        let mut group: Option<ModifiedRelationLinks> = None;
+        let mut flush = |snapshot: &mut Snapshot, group: Option<ModifiedRelationLinks>| match group {
+            Some(modified) => visit(snapshot, modified),
+            None => Ok(()),
+        };
+        snapshot.visit_writes_in_range(
+            &KeyRange::new_within(ThingEdgeLinks::prefix(), ThingEdgeLinks::FIXED_WIDTH_ENCODING),
+            |snapshot, key, write| {
+                let edge = ThingEdgeLinks::decode(Bytes::reference(key.bytes()));
+                let relation = Relation::new(edge.relation());
+                if !group.as_ref().is_some_and(|modified| modified.relation == relation) {
+                    flush(snapshot, group.take())?;
+                    let status = self
+                        .get_status(snapshot, relation.vertex().into_storage_key(), storage_counters.clone())
+                        .map_err(&read_error)?;
+             
```

**File**: `concept/thing/thing_manager/validation/cardinality_validation.rs` (modified, +291/-373)
```diff
@@ -4,7 +4,7 @@
  * file, You can obtain one at https://mozilla.org/MPL/2.0/.
  */
 
-use std::collections::{Bound, HashMap, HashSet};
+use std::collections::{HashMap, HashSet};
 
 use bytes::Bytes;
 use resource::profile::StorageCounters;
@@ -45,28 +45,15 @@ macro_rules! collect_errors {
     };
 }
 
-pub(crate) use collect_errors;
 use encoding::{
     Prefixed,
-    graph::{
-        thing::{
-            ThingVertex,
-            edge::{ThingEdgeHas, ThingEdgeLinks},
-            vertex_object::ObjectVertex,
-        },
-        type_::{edge::TypeEdge, property::TypeEdgeProperty, vertex::PrefixedTypeVertexEncoding},
-    },
+    graph::type_::{edge::TypeEdge, property::TypeEdgeProperty},
     layout::{infix::Infix, prefix::Prefix},
 };
-use iterator::minmax_or;
-use storage::{
-    key_range::{KeyRange, RangeEnd, RangeStart},
-    key_value::StorageKey,
-    snapshot::write::Write,
-};
+use storage::{key_range::KeyRange, snapshot::write::Write};
 
 use crate::{
-    thing::{ThingAPI, attribute::Attribute},
+    ConceptStatus,
     type_::{object_type::ObjectType, relation_type::RelationType, type_manager::TypeManager},
 };
 
@@ -128,10 +115,10 @@ macro_rules! validate_capability_cardinality_constraint {
 
 /*
 The cardinalities validation flow is the following:
-1. Collect instances affected by cardinalities changes (separately for 3 capabilities: owns, plays, relates)
+1. Find instances affected by cardinalities changes (separately for 3 capabilities: owns, plays, relates): instance writes are visited straight from the write buffer, grouped by its key order; a capability cardinality change is recorded per type and every instance of the type is visited.
 2. Validate only the affected instances to avoid rescanning the whole system (see validate_capability_cardinality_constraint). For each object,
-  2a. Count every capability instance it has (every has, every played role, every roleplayer)
-  2b. Collect cardinality constraints (declared and inherited) of all marked capabilities without duplications (if a subtype and its supertype are affected, the supertype's constraint is checked once)
+  2a. Count every capability instance it has (every has, every played role, every roleplayer).
+  2b. Collect cardinality constraints (declared and inherited) of all marked capabilities without duplications (if a subtype and its supertype are affected, the supertype's constraint is checked once).
   2c. Validate each constraint separately using the counts prepared in 2a. To validate a constraint, take its source type (where this constraint is declared), and count all instances of the source type and its subtypes.
 
 Let's consider the following example:
@@ -144,7 +131,7 @@ A query is being run:
   define person owns surname @card(1..10);
 
 It will be processed like:
-1. All instances of persons will be collected, the only surname attribute type saved as modified.
+1. person is recorded with surname as the only modified attribute type, and every instance of person is visited.
 2. For each instance of persons:
   2a. All names, surnames, and changed-surnames are counted (based on instances' explicit types).
   2b. surname's constraints will be taken: @card(1..) from name and @card(1..10) from surname.
@@ -163,315 +150,334 @@ We could potentially use the old version of storage (ignoring the snapshot), but
 Please keep these complexities in mind when modifying the collection stage in the following methods.
 */
 
-pub(crate) struct CardinalityChangeTracker {
-    // TODO #7138: It is EXCEPTIONALLY memory-greedy and should be optimized / removed from RAM!
-    modified_objects_attribute_types: HashMap<Object, HashSet<AttributeType>>,
-    has_modified_owns: bool,
-    modified_objects_role_types: HashMap<Object, HashSet<RoleType>>,
-    has_modified_plays: bool,
-    modified_relations_role_types: HashMap<Relation, HashSet<RoleType>>,
-    has_modified_relates: bool,
-    players_in_deleted_relations: HashMap<Relation, HashSet<Object>>,
-}
+pub(crate) struct CardinalityValidation {}
 
-impl CardinalityChangeTracker {
-    pub(crate) fn build(
-        snapshot: &impl ReadableSnapshot,
-        type_manager: &TypeManager,
+impl CardinalityValidation {
+    pub(crate) fn validate_commit<Snapshot: ReadableSnapshot>(
+        snapshot: &mut Snapshot,
         thing_manager: &ThingManager,
+        modified_types: &ModifiedCapabilityTypes,
+        out_errors: &mut Vec<DataValidationError>,
         storage_counters: StorageCounters,
-    ) -> Result<Self, Box<ConceptReadError>> {
-        let mut modified_objects_attribute_types: HashMap<Object, HashSet<AttributeType>> = HashMap::new();
-        let mut has_modified_owns = false;
-        let mut modified_objects_role_types: HashMap<Object, HashSet<RoleType>> = HashMap::new();
-        let mut has_modified_plays = false;
-        let mut modified_relations_role_types: HashMap<Relation, HashSet<RoleType>> = HashMap::new();
-        let mut players_in_deleted_relations: HashMap<Re
```

**File**: `concept/type_/mod.rs` (modified, +25/-1)
```diff
@@ -4,7 +4,14 @@
  * file, You can obtain one at https://mozilla.org/MPL/2.0/.
  */
 
-use std::{collections::HashSet, fmt, fmt::Write, hash::Hash, iter, sync::Arc};
+use std::{
+    collections::{Bound, HashSet},
+    fmt,
+    fmt::Write,
+    hash::Hash,
+    iter,
+    sync::Arc,
+};
 
 use bytes::Bytes;
 use encoding::{
@@ -20,6 +27,7 @@ use encoding::{
     layout::infix::Infix,
     value::{label::Label, value_type::ValueType},
 };
+use iterator::minmax_or;
 use itertools::Itertools;
 use primitive::maybe_owns::MaybeOwns;
 use resource::{
@@ -183,6 +191,22 @@ pub trait TypeAPI: ConceptAPI + TypeVertexEncoding + Copy + Sized + Hash + Eq {
         iter::once(first).chain(others)
     }
 
+    fn range_with_subtypes_transitive(
+        &self,
+        snapshot: &impl ReadableSnapshot,
+        type_manager: &TypeManager,
+    ) -> Result<(Bound<Self>, Bound<Self>), Box<ConceptReadError>>
+    where
+        Self: PartialOrd,
+    {
+        let subtypes = self.get_subtypes_transitive(snapshot, type_manager)?;
+        let (min, max) = minmax_or!(
+            Self::chain_types(*self, subtypes.into_iter().cloned()),
+            unreachable!("Expected at least one type")
+        );
+        Ok((Bound::Included(min), Bound::Included(max)))
+    }
+
     fn next_possible(&self) -> Option<Self>;
 
     fn previous_possible(&self) -> Option<Self>;
```

**File**: `database/migration/database_importer.rs` (modified, +81/-83)
```diff
@@ -815,38 +815,38 @@ impl DatabaseImporter {
                 let original_cardinality = owns
                     .get_cardinality(snapshot, type_manager)
                     .map_err(|typedb_source| DatabaseImportError::ConceptRead { typedb_source })?;
-                if original_cardinality != AnnotationCardinality::unchecked() {
-                    match owns
-                        .get_annotations_declared(snapshot, type_manager)
-                        .map_err(|typedb_source| DatabaseImportError::ConceptRead { typedb_source })?
-                        .iter()
-                        .find(|annotation| {
-                            matches!(annotation, OwnsAnnotation::Cardinality(_))
-                                || matches!(annotation, OwnsAnnotation::Key(_))
-                        }) {
-                        Some(annotation) => match annotation {
-                            OwnsAnnotation::Cardinality(cardinality) => {
-                                schema_info.original_cardinalities_owns.insert(*owns, Some(*cardinality));
-                            }
-                            OwnsAnnotation::Key(_) => {
-                                owns.unset_annotation(snapshot, type_manager, thing_manager, AnnotationCategory::Key)
-                                    .map_err(|typedb_source| DatabaseImportError::ConceptWrite { typedb_source })?;
-                                schema_info.original_keys.insert(*owns);
-                            }
-                            _ => unreachable!("Expected a key or a cardinality annotation"),
-                        },
-                        None => {
-                            schema_info.original_cardinalities_owns.insert(*owns, None);
-                        }
+                if original_cardinality.start() == 0 {
+                    continue;
+                }
+                match owns
+                    .get_annotations_declared(snapshot, type_manager)
+                    .map_err(|typedb_source| DatabaseImportError::ConceptRead { typedb_source })?
+                    .iter()
+                    .find(|annotation| {
+                        matches!(annotation, OwnsAnnotation::Cardinality(_))
+                            || matches!(annotation, OwnsAnnotation::Key(_))
+                    }) {
+                    Some(OwnsAnnotation::Cardinality(cardinality)) => {
+                        schema_info.original_cardinalities_owns.insert(*owns, Some(*cardinality));
+                    }
+                    Some(OwnsAnnotation::Key(_)) => {
+                        owns.unset_annotation(snapshot, type_manager, thing_manager, AnnotationCategory::Key)
+                            .map_err(|typedb_source| DatabaseImportError::ConceptWrite { typedb_source })?;
+                        schema_info.original_keys.insert(*owns);
+                        continue;
+                    }
+                    Some(_) => unreachable!("Expected a key or a cardinality annotation"),
+                    None => {
+                        schema_info.original_cardinalities_owns.insert(*owns, None);
                     }
-                    owns.set_annotation(
-                        snapshot,
-                        type_manager,
-                        thing_manager,
-                        OwnsAnnotation::Cardinality(AnnotationCardinality::unchecked()),
-                    )
-                    .map_err(|typedb_source| DatabaseImportError::ConceptWrite { typedb_source })?;
                 }
+                owns.set_annotation(
+                    snapshot,
+                    type_manager,
+                    thing_manager,
+                    OwnsAnnotation::Cardinality(Self::relaxed(original_cardinality)),
+                )
+                .map_err(|typedb_source| DatabaseImportError::ConceptWrite { typedb_source })?;
             }
 
             let all_plays = object_type
@@ -868,74 +868,68 @@ impl DatabaseImporter {
                 let original_cardinality = plays
                     .get_cardinality(snapshot, type_manager)
                     .map_err(|typedb_source| DatabaseImportError::ConceptRead { typedb_source })?;
-                if original_cardinality != AnnotationCardinality::unchecked() {
-                    match plays
-                        .get_annotations_declared(snapshot, type_manager)
-                        .map_err(|typedb_source| DatabaseImportError::ConceptRead { typedb_source })?
-                        .iter()
-                        .find(|annotation| matches!(annotation, PlaysAnnotation::Cardinality(_)))
-                    {
-                        Some(annotation) => match annotation {
-                            PlaysAnnotation::Cardinality(cardinality) => {
-                                schema_info.original_cardinalities_plays.insert(*plays, Some(*cardinality));
-                            }
-                            _ => unreachable!("Expected a cardinality 
```

**File**: `encoding/graph/thing/vertex_object.rs` (modified, +4/-0)
```diff
@@ -33,6 +33,9 @@ impl ObjectVertex {
     pub const MIN: Self = Self::MIN_ENTITY;
     pub const MIN_ENTITY: Self = Self::build_entity(TypeID::MIN, ObjectID::MIN);
     pub const MIN_RELATION: Self = Self::build_relation(TypeID::MIN, ObjectID::MIN);
+    pub const MAX: Self = Self::MAX_RELATION;
+    pub const MAX_ENTITY: Self = Self::build_entity(TypeID::MAX, ObjectID::MAX);
+    pub const MAX_RELATION: Self = Self::build_relation(TypeID::MAX, ObjectID::MAX);
 
     pub const fn build_entity(type_id: TypeID, object_id: ObjectID) -> Self {
         Self { prefix: Prefix::VertexEntity, type_id, object_id }
@@ -144,6 +147,7 @@ pub struct ObjectID {
 impl ObjectID {
     pub(crate) const LENGTH: usize = 8;
     pub const MIN: Self = Self::new_const(0);
+    pub const MAX: Self = Self::new_const(u64::MAX);
 
     pub fn new(id: u64) -> Self {
         // TODO: mem::size_of_val isn't const yet
```

---

### Incident Patch 9: `7cb72682` (2026-09-09)
**Commit Message**: Reduce memory pressure and accelerate database import  (#7955)

## Product change and motivation
  
Importing or migrating a large database no longer grows memory without
bound. Previously, the importer held every reference to a
not-yet-imported instance in memory and, when a heavily shared concept
finally arrived, wrote all of its capabilities in a single commit. On a
multi-GB database, that was tens of millions of parked references plus a
hundreds-of-MB commit, so the server's memory climbed with the dataset.

Import memory is now flat regardless of dataset size (max a few GB), and
a single hot attribute no longer produces an oversized commit.
  
## Implementation
  
- Export attributes first. `DatabaseExporter` now streams attributes,
then entities, then relations (was entities -> relations -> attributes).
Because an owner arrives after its attributes and a relation after its
entity players, an import in stream order defers nothing except role
players that are relations themselves.
- Deferred references spill to disk and drain after the stream. The
remaining "awaiters" are saved to `SpilloverCache`-backed logs instead
of in-memory maps, and applied once the stream ends via a new

**File**: `common/cache/cache.rs` (modified, +120/-2)
```diff
@@ -33,6 +33,17 @@ impl<T: Serialize + DeserializeOwned + Clone> SpilloverCache<T> {
         SpilloverCache { memory_storage: HashMap::new(), disk_storage_path, disk_storage: None, memory_size_limit }
     }
 
+    pub fn into_chunks(mut self, chunk_size: usize) -> SpilloverCacheChunks<T> {
+        assert!(chunk_size > 0, "SpilloverCache chunks must be non-empty");
+        SpilloverCacheChunks {
+            memory: std::mem::take(&mut self.memory_storage).into_iter(),
+            disk_storage: self.disk_storage.take(),
+            disk_storage_path: std::mem::take(&mut self.disk_storage_path),
+            disk_cursor: None,
+            chunk_size,
+        }
+    }
+
     pub fn insert(&mut self, key: String, value: T) -> Result<(), CacheError> {
         self.remove(&key)?;
         match self.memory_storage.len() < self.memory_size_limit {
@@ -68,10 +79,16 @@ impl<T: Serialize + DeserializeOwned + Clone> SpilloverCache<T> {
         self.disk_storage
             .as_mut()
             .unwrap()
-            .put(key, serialized)
+            .put_opt(key, serialized, &Self::write_options())
             .map_err(|source| CacheError::DiskStorageAccess { source })
     }
 
+    fn write_options() -> rocksdb::WriteOptions {
+        let mut options = rocksdb::WriteOptions::default();
+        options.disable_wal(true);
+        options
+    }
+
     fn disk_storage_get(&self, key: &str) -> Result<Option<T>, CacheError> {
         if let Some(disk_storage) = &self.disk_storage {
             if let Some(bytes) = disk_storage.get(key).map_err(|source| CacheError::DiskStorageAccess { source })? {
@@ -99,7 +116,71 @@ impl<T: Serialize + DeserializeOwned + Clone> SpilloverCache<T> {
 
 impl<T: Serialize + DeserializeOwned + Clone> Drop for SpilloverCache<T> {
     fn drop(&mut self) {
-        drop(std::mem::take(&mut self.disk_storage)); // release its files
+        if self.disk_storage_path.as_os_str().is_empty() {
+            return; // consumed by into_chunks: the chunks iterator owns the cleanup
+        }
+        self.disk_storage = None; // release its files before removing the directory
+        if let Err(e) = std::fs::remove_dir_all(&self.disk_storage_path) {
+            // Can be cleaned up by the cache's user
+            event!(Level::TRACE, "Failed to delete a temporary DB directory {:?}: {e}", self.disk_storage_path);
+        }
+    }
+}
+
+pub struct SpilloverCacheChunks<T: Serialize + DeserializeOwned + Clone> {
+    memory: std::collections::hash_map::IntoIter<String, T>,
+    disk_storage: Option<rocksdb::DB>,
+    disk_storage_path: PathBuf,
+    disk_cursor: Option<Vec<u8>>,
+    chunk_size: usize,
+}
+
+impl<T: Serialize + DeserializeOwned + Clone> Iterator for SpilloverCacheChunks<T> {
+    type Item = Result<Vec<(String, T)>, CacheError>;
+
+    fn next(&mut self) -> Option<Self::Item> {
+        let mut chunk = Vec::new();
+
+        while chunk.len() < self.chunk_size {
+            match self.memory.next() {
+                Some(entry) => chunk.push(entry),
+                None => break,
+            }
+        }
+
+        if let Some(disk_storage) = self.disk_storage.as_ref().filter(|_| chunk.len() < self.chunk_size) {
+            let mut iterator = disk_storage.raw_iterator();
+            match &self.disk_cursor {
+                None => iterator.seek_to_first(),
+                Some(cursor) => {
+                    iterator.seek(cursor);
+                    if iterator.valid() && iterator.key() == Some(cursor.as_slice()) {
+                        iterator.next();
+                    }
+                }
+            }
+            while chunk.len() < self.chunk_size && iterator.valid() {
+                let (key, bytes) = (iterator.key().unwrap(), iterator.value().unwrap());
+                let value = match bincode::deserialize(bytes) {
+                    Ok(value) => value,
+                    Err(_) => return Some(Err(CacheError::DiskStorageDeserialization {})),
+                };
+                self.disk_cursor = Some(key.to_vec());
+                chunk.push((String::from_utf8_lossy(key).into_owned(), value));
+                iterator.next();
+            }
+            if let Err(source) = iterator.status() {
+                return Some(Err(CacheError::DiskStorageAccess { source }));
+            }
+        }
+
+        (!chunk.is_empty()).then(|| Ok(chunk))
+    }
+}
+
+impl<T: Serialize + DeserializeOwned + Clone> Drop for SpilloverCacheChunks<T> {
+    fn drop(&mut self) {
+        self.disk_storage = None; // release its files
         if let Err(e) = std::fs::remove_dir_all(&self.disk_storage_path) {
             // Can be cleaned up by the cache's user
             event!(Level::TRACE, "Failed to delete a temporary DB directory {:?}: {e}", self.disk_storage_path);
@@ -185,4 +266,41 @@ pub mod tests {
         cache.remove("key2").unwrap();
         assert_eq!(get!(cache, "key2"), None);
     }
+
+    fn collect_chunks(cache: SpilloverCa
```

**File**: `compiler/annotation/inference/type_seeder.rs` (modified, +1/-1)
```diff
@@ -532,7 +532,7 @@ impl<'this, Snapshot: ReadableSnapshot> TypeGraphSeedingContext<'this, Snapshot>
                 Constraint::Owns(owns) => edges.push(self.seed_edge(constraint, owns, vertices)?),
                 Constraint::Relates(relates) => edges.push(self.seed_edge(constraint, relates, vertices)?),
                 Constraint::Plays(plays) => edges.push(self.seed_edge(constraint, plays, vertices)?),
-                | Constraint::Iid(_)
+                Constraint::Iid(_)
                 | Constraint::RoleName(_)
                 | Constraint::Label(_)
                 | Constraint::Kind(_)
```

**File**: `compiler/executable/function/executable.rs` (modified, +2/-2)
```diff
@@ -133,8 +133,8 @@ fn compile_return_operation(
         AnnotatedFunctionReturn::Single { selector, variables, .. } => {
             Ok(ExecutableReturn::Single(selector, variables.iter().map(|var| variable_positions[var]).collect()))
         }
-        | AnnotatedFunctionReturn::ReduceCheck {} => Ok(ExecutableReturn::Check),
-        | AnnotatedFunctionReturn::ReduceReducer { instructions } => {
+        AnnotatedFunctionReturn::ReduceCheck {} => Ok(ExecutableReturn::Check),
+        AnnotatedFunctionReturn::ReduceReducer { instructions } => {
             let reductions = instructions.into_iter().map(|reducer| reducer.map(&variable_positions)).collect();
             Ok(ExecutableReturn::Reduce(Arc::new(ReduceRowsExecutable {
                 reductions,
```

**File**: `compiler/executable/match_/instructions/mod.rs` (modified, +2/-2)
```diff
@@ -256,7 +256,7 @@ impl<ID: IrID> ConstraintInstruction<ID> {
         match self {
             Self::Iid(_) => (),
             Self::TypeList(_) => (),
-            | Self::Is(IsInstruction { inputs, .. })
+            Self::Is(IsInstruction { inputs, .. })
             | Self::Sub(type_::SubInstruction { inputs, .. })
             | Self::SubReverse(type_::SubReverseInstruction { inputs, .. })
             | Self::Owns(type_::OwnsInstruction { inputs, .. })
@@ -273,7 +273,7 @@ impl<ID: IrID> ConstraintInstruction<ID> {
             | Self::LinksReverse(thing::LinksReverseInstruction { inputs, .. }) => {
                 inputs.iter().cloned().for_each(apply)
             }
-            | Self::IndexedRelation(thing::IndexedRelationInstruction { inputs, .. }) => {
+            Self::IndexedRelation(thing::IndexedRelationInstruction { inputs, .. }) => {
                 inputs.iter().cloned().for_each(apply)
             }
         }
```

**File**: `compiler/executable/match_/planner/plan.rs` (modified, +1/-1)
```diff
@@ -321,7 +321,7 @@ impl<'a> ConjunctionPlanBuilder<'a> {
             }
             let category = variable_registry.get_variable_category(variable).unwrap();
             match category {
-                | VariableCategory::Type
+                VariableCategory::Type
                 | VariableCategory::ThingType
                 | VariableCategory::AttributeType
                 | VariableCategory::RoleType => self.register_type_var(variable),
```

**File**: `compiler/executable/reduce.rs` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ impl<ID: IrID> ReduceInstruction<ID> {
         match *self {
             Self::Count => None,
 
-            | ReduceInstruction::CountVar(id)
+            ReduceInstruction::CountVar(id)
             | ReduceInstruction::SumInteger(id)
             | ReduceInstruction::MaxInteger(id)
             | ReduceInstruction::MinInteger(id)
```

**File**: `compiler/query_structure.rs` (modified, +5/-5)
```diff
@@ -137,7 +137,7 @@ pub fn extract_pipeline_structure_from(
             AnnotatedStage::Match { block, .. } => {
                 Some(block.conjunction().named_visible_referenced_variables().collect::<Vec<_>>())
             }
-            | AnnotatedStage::Insert { block, .. }
+            AnnotatedStage::Insert { block, .. }
             | AnnotatedStage::Update { block, .. }
             | AnnotatedStage::Put { block, .. } => {
                 Some(block.conjunction().named_visible_referenced_variables().collect::<Vec<_>>())
@@ -152,10 +152,10 @@ pub fn extract_pipeline_structure_from(
             AnnotatedStage::Select(select) => Some(select.variables.iter().cloned().collect::<Vec<_>>()),
             AnnotatedStage::Reduce(reduce, _) => Some(reduce.variables().collect::<Vec<_>>()),
             AnnotatedStage::Sort(_) => None,
-            | AnnotatedStage::Offset(_) => None,
-            | AnnotatedStage::Limit(_) => None,
-            | AnnotatedStage::Require(_) => None,
-            | AnnotatedStage::Distinct(_) => None,
+            AnnotatedStage::Offset(_) => None,
+            AnnotatedStage::Limit(_) => None,
+            AnnotatedStage::Require(_) => None,
+            AnnotatedStage::Distinct(_) => None,
         })
         .next()
         .unwrap_or_default();
```

**File**: `concept/thing/thing_manager.rs` (modified, +1/-1)
```diff
@@ -442,7 +442,7 @@ impl ThingManager {
         }
 
         let attribute = match value_type {
-            | ValueType::Boolean
+            ValueType::Boolean
             | ValueType::Integer
             | ValueType::Double
             | ValueType::Decimal
```

---

### Incident Patch 10: `2faef80c` (2026-09-09)
**Commit Message**: Support fully qualified names for builtin functions to emulate namespacing (#7948)

## Product change and motivation
Support using fully qualified function names to invoke built-in functions (e.g. `let $rounded = std::math::round(1.5);`).
Using the name directly is still supported for existing functions, but most future functions will need to be invoked using fully qualified names till namespacing is fully supported.

## Implementation
Looks up fully qualified names as if they were normal names.
Older names are redirected to use the implementation of the namespaced functions.

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -5953,7 +5953,7 @@ checksum = "b6f5e870be6c3b371b77fe0ee0bafb859fa4964b4404c27de1d380043c4dda20"
 [[package]]
 name = "typeql"
 version = "0.0.0"
-source = "git+https://github.com/typedb/typeql?tag=3.13.0#19f95d347288a9158e28603e4f9cc85181833109"
+source = "git+https://github.com/typedb/typeql?rev=5485e04a51c79ad1d29477db7532003c84983751#5485e04a51c79ad1d29477db7532003c84983751"
 dependencies = [
  "chrono",
  "itertools 0.14.0",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -222,8 +222,8 @@ features = {}
 
 		[workspace.dependencies.typeql]
 			features = []
+			rev = "5485e04a51c79ad1d29477db7532003c84983751"
 			git = "https://github.com/typedb/typeql"
-			tag = "3.13.0"
 			default-features = false
 
 		[workspace.dependencies.cache]
```

**File**: `MODULE.bazel` (modified, +4/-4)
```diff
@@ -110,11 +110,11 @@ workspace_refs(
     name = "typedb_workspace_refs",
     workspace_commit_dict = {
 #        "typedb_protocol+": "3a39f0b94fd7ea316ba5a4f74d44d5afc454cedf",
-#        "typeql+": "9bd7d56a907e8bf60ac5a5a7ca609131bf1b24f3",
+        "typeql+": "5485e04a51c79ad1d29477db7532003c84983751",
     },
     workspace_tag_dict = {
         "typedb_protocol+": "3.12.0",
-        "typeql+": "3.13.0",
+#        "typeql+": "3.13.0",
     },
 )
 
@@ -179,7 +179,7 @@ bazel_dep(name = "typeql", version = "0.0.0")
 git_override(
     module_name = "typeql",
     remote = "https://github.com/typedb/typeql",
-    tag = "3.13.0",
+    commit = "5485e04a51c79ad1d29477db7532003c84983751",
 )
 
 bazel_dep(name = "typedb_protocol", version = "0.0.0")
@@ -193,7 +193,7 @@ bazel_dep(name = "typedb_behaviour", version = "0.0.0")
 git_override(
     module_name = "typedb_behaviour",
     remote = "https://github.com/typedb/typedb-behaviour",
-    commit = "888359942ccd234e64809215c0ff7c74343ff7ee",
+    commit = "a428985711011ee5b9164bad65238a591f23e3ca",
 )
 
 http_file = use_repo_rule("@bazel_tools//tools/build_defs/repo:http.bzl", "http_file")
```

**File**: `compiler/annotation/expression/builtin_resolution.rs` (modified, +9/-8)
```diff
@@ -18,7 +18,7 @@ use crate::annotation::expression::{
         },
         unary::{
             LenString, MathAbsDecimal, MathAbsDouble, MathAbsInteger, MathCeilDecimal, MathCeilDouble,
-            MathFloorDecimal, MathFloorDouble, MathRoundDecimal, MathRoundDouble,
+            MathFloorDecimal, MathFloorDouble, MathLog10Double, MathLog10Integer, MathRoundDecimal, MathRoundDouble,
         },
     },
 };
@@ -102,14 +102,15 @@ impl BinaryValueFunctionResolver for $fid {
     };
 }
 unary_builtin! {
-    Abs = MathAbs [ Integer, Double, Decimal, ]
-    Ceil = MathCeil [ Double, Decimal, ]
-    Floor = MathFloor [ Double, Decimal, ]
-    Round = MathRound [ Double, Decimal, ]
-    Len = Len [ String, ]
+    MathAbs = MathAbs [ Integer, Double, Decimal, ]
+    MathCeil = MathCeil [ Double, Decimal, ]
+    MathFloor = MathFloor [ Double, Decimal, ]
+    MathRound = MathRound [ Double, Decimal, ]
+    StringLen = Len [ String, ]
+    MathLog10 = MathLog10 [ Integer, Double, ]
 }
 
 binary_builtin! {
-    Max:true = MathMax [ (Integer, Integer), (Double, Double), (Decimal, Decimal), ]
-    Min:true = MathMin [ (Integer, Integer), (Double, Double), (Decimal, Decimal), ]
+    MathMax:true = MathMax [ (Integer, Integer), (Double, Double), (Decimal, Decimal), ]
+    MathMin:true = MathMin [ (Integer, Integer), (Double, Double), (Decimal, Decimal), ]
 }
```

**File**: `compiler/annotation/expression/expression_compiler.rs` (modified, +22/-14)
```diff
@@ -31,6 +31,11 @@ use crate::annotation::expression::{
         ExpressionInstruction, list_operations,
         load::{LoadConstant, LoadVariable},
         op_codes::ExpressionOpCode,
+        operators,
+        unary::{
+            LenString, MathAbsDecimal, MathAbsDouble, MathAbsInteger, MathCeilDecimal, MathCeilDouble,
+            MathFloorDecimal, MathFloorDouble, MathLog10Double, MathLog10Integer, MathRoundDecimal, MathRoundDouble,
+        },
     },
     operation_resolution,
 };
@@ -197,26 +202,29 @@ impl<'this> ExpressionCompilationContext<'this> {
 
     fn compile_value_builtin(&mut self, builtin: &BuiltinValueFunctionCall) -> Result<(), Box<ExpressionCompileError>> {
         match builtin.function_id() {
-            BuiltinValueFunctionID::Abs => {
-                UnaryValueFunctionResolverImpl::<builtin_resolution::Abs>::resolve_validate_append(builtin, self)
+            BuiltinValueFunctionID::MathAbs => {
+                UnaryValueFunctionResolverImpl::<builtin_resolution::MathAbs>::resolve_validate_append(builtin, self)
+            }
+            BuiltinValueFunctionID::MathCeil => {
+                UnaryValueFunctionResolverImpl::<builtin_resolution::MathCeil>::resolve_validate_append(builtin, self)
             }
-            BuiltinValueFunctionID::Ceil => {
-                UnaryValueFunctionResolverImpl::<builtin_resolution::Ceil>::resolve_validate_append(builtin, self)
+            BuiltinValueFunctionID::MathFloor => {
+                UnaryValueFunctionResolverImpl::<builtin_resolution::MathFloor>::resolve_validate_append(builtin, self)
             }
-            BuiltinValueFunctionID::Floor => {
-                UnaryValueFunctionResolverImpl::<builtin_resolution::Floor>::resolve_validate_append(builtin, self)
+            BuiltinValueFunctionID::MathRound => {
+                UnaryValueFunctionResolverImpl::<builtin_resolution::MathRound>::resolve_validate_append(builtin, self)
             }
-            BuiltinValueFunctionID::Round => {
-                UnaryValueFunctionResolverImpl::<builtin_resolution::Round>::resolve_validate_append(builtin, self)
+            BuiltinValueFunctionID::MathMin => {
+                BinaryValueFunctionResolverImpl::<builtin_resolution::MathMin>::resolve_validate_append(builtin, self)
             }
-            BuiltinValueFunctionID::Min => {
-                BinaryValueFunctionResolverImpl::<builtin_resolution::Min>::resolve_validate_append(builtin, self)
+            BuiltinValueFunctionID::MathMax => {
+                BinaryValueFunctionResolverImpl::<builtin_resolution::MathMax>::resolve_validate_append(builtin, self)
             }
-            BuiltinValueFunctionID::Max => {
-                BinaryValueFunctionResolverImpl::<builtin_resolution::Max>::resolve_validate_append(builtin, self)
+            BuiltinValueFunctionID::StringLen => {
+                UnaryValueFunctionResolverImpl::<builtin_resolution::StringLen>::resolve_validate_append(builtin, self)
             }
-            BuiltinValueFunctionID::Len => {
-                UnaryValueFunctionResolverImpl::<builtin_resolution::Len>::resolve_validate_append(builtin, self)
+            BuiltinValueFunctionID::MathLog10 => {
+                UnaryValueFunctionResolverImpl::<builtin_resolution::MathLog10>::resolve_validate_append(builtin, self)
             }
         }
     }
```

**File**: `compiler/annotation/expression/instructions/op_codes.rs` (modified, +5/-2)
```diff
@@ -64,8 +64,6 @@ macro_rules! for_each_opcode {
             MathAbsDecimal,
             MathAbsInteger,
 
-            MathRemainderInteger,
-
             MathRoundDouble,
             MathCeilDouble,
             MathFloorDouble,
@@ -82,6 +80,11 @@ macro_rules! for_each_opcode {
             MathMaxDoubleDouble,
             MathMaxDecimalDecimal,
 
+            MathRemainderInteger,
+
+            MathLog10Integer,
+            MathLog10Double,
+
             LenString,
         }
     };
```

**File**: `compiler/annotation/expression/instructions/unary.rs` (modified, +3/-0)
```diff
@@ -80,4 +80,7 @@ unary_instruction! { 'a
         let len = a1.chars().count();
         len.try_into().map_err(|_| ExpressionEvaluationError::OverlongString { len })
     }
+
+    MathLog10Integer(a1: i64) -> f64 { Ok((a1 as f64).log10()) }
+    MathLog10Double(a1: f64) -> f64 { Ok(a1.log10()) }
 }
```

**File**: `executor/read/expression_executor.rs` (modified, +2/-1)
```diff
@@ -35,7 +35,8 @@ use compiler::{
             },
             unary::{
                 LenString, MathAbsDecimal, MathAbsDouble, MathAbsInteger, MathCeilDecimal, MathCeilDouble,
-                MathFloorDecimal, MathFloorDouble, MathRoundDecimal, MathRoundDouble, Unary, UnaryExpression,
+                MathFloorDecimal, MathFloorDouble, MathLog10Double, MathLog10Integer, MathRoundDecimal,
+                MathRoundDouble, Unary, UnaryExpression,
             },
         },
     },
```

---

### Incident Patch 11: `4cf6a29d` (2026-08-27)
**Commit Message**: Bump amazonlinux-ci image for clang dependency & rules python (#7932)

## Implementation
Bumps our amazon linux image to a new one that has clang & llvm installed.
Bumps rules python to a version that doesn't have a silly print statement that breaks our deploy scripts on certain pythoon versions.

**File**: `.circleci/config.yml` (modified, +2/-2)
```diff
@@ -11,14 +11,14 @@ orbs:
 executors:
   linux-arm64-amazonlinux-2:
     docker:
-      - image: typedb/amazonlinux2-ci:3.12.0-arm64
+      - image: typedb/amazonlinux2-ci:3.13.0-arm64
     resource_class: arm.large
     working_directory: ~/typedb
 
   # All builds go on amazon-linux.
   linux-x86_64-amazonlinux-2:
     docker:
-      - image: typedb/amazonlinux2-ci:3.12.0-amd64
+      - image: typedb/amazonlinux2-ci:3.13.0-amd64
     resource_class: large
     working_directory: ~/typedb
 
```

**File**: `MODULE.bazel` (modified, +3/-3)
```diff
@@ -53,7 +53,7 @@ bazel_dep(name = "rules_kotlin", version = "2.0.0")
 register_toolchains("@rules_kotlin//kotlin/internal:default_toolchain")
 
 # Python
-bazel_dep(name = "rules_python", version = "1.0.0")
+bazel_dep(name = "rules_python", version = "2.3.2")
 python = use_extension("@rules_python//python/extensions:python.bzl", "python")
 python.toolchain(is_default = True, python_version = "3.11", ignore_root_user_error = True)
 
@@ -162,14 +162,14 @@ bazel_dep(name = "typedb_bazel_distribution", version = "0.0.0")
 git_override(
     module_name = "typedb_bazel_distribution",
     remote = "https://github.com/typedb/bazel-distribution",
-    commit = "ab5bfc90274e2d34569d5bc22558314b551cdecd",
+    commit = "c98429250c448e7bd940062584c3ebd6a2368faf",
 )
 
 bazel_dep(name = "typedb_dependencies", version = "0.0.0")
 git_override(
     module_name = "typedb_dependencies",
     remote = "https://github.com/typedb/dependencies",
-    commit = "a5c51254088f343fb8b6a9668eaf99b35503dad4",
+    commit = "b137ccdae216d144bb5efc07a0bb42a662f17116",
 )
 
 bazel_dep(name = "typeql", version = "0.0.0")
```

---

### Incident Patch 12: `df38617c` (2026-08-21)
**Commit Message**: Fix build-breaking formatting (#7925)

## Product change and motivation


## Implementation

**File**: `resource/constants.rs` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ pub mod server {
     pub const GRPC_MAX_MESSAGE_SIZE: usize = GB as usize;
 
     pub const HTTP_MAX_MESSAGE_SIZE: usize = GB as usize;
-  
+
     pub const MAX_CONCURRENT_IMPORTS: usize = 8;
 
     // TODO: Maybe we start moving these options to separate crates?
```

---

### Incident Patch 13: `d3c2c6d7` (2026-08-13)
**Commit Message**: Fix database import blockers on inherited constraints (#7912)

## Product change and motivation

In specific situations, database import could be incorrectly rejected
while relaxing or recovering the schema due to coincidental combinations
of inherited constraints. We fix these cases completely.

### Independent sub attributes

Independent sub attributes could lead to rejects on schema relaxation.
At this stage, every attribute type must become independent so as not to
lose data. However, double redeclarations of such annotations are
prohibited, and an incorrectly working algorithm could produce a schema
like `define attribute name @independent, value string; attribute
surname @independent, sub name;`.

### Ownerships and roleplaying specializations

A similar problem with `owns` and `plays` specializations using the same
interface types (e.g., `define superperson owns name @card(0..); define
person sub superperson, owns name @card(1..);`.

While the algorithm correctly avoided conflicts in declared
cardinalities, it could still have rare conflicts with other
annotations, which, with the change of cardinality-based constraints,
could lead to identical `owns`/`plays` declarations (w

**File**: `database/migration/database_importer.rs` (modified, +38/-36)
```diff
@@ -25,10 +25,8 @@ use concept::{
         thing_manager::ThingManager,
     },
     type_::{
-        Capability, Ordering, OwnerAPI, PlayerAPI,
-        annotation::{
-            AnnotationCardinality, AnnotationCategory, AnnotationIndependent, AnnotationKey, HasAnnotationCategory,
-        },
+        Capability, KindAPI, Ordering, OwnerAPI, PlayerAPI, TypeAPI,
+        annotation::{AnnotationCardinality, AnnotationCategory, AnnotationIndependent, AnnotationKey},
         attribute_type::{AttributeType, AttributeTypeAnnotation},
         constraint::Constraint,
         object_type::ObjectType,
@@ -68,7 +66,7 @@ use crate::{
     with_transaction_parts,
 };
 
-macro_rules! is_specializing_with_only_cardinality_specializations_fn {
+macro_rules! is_specializing_fn {
     (
         $fn_name:ident,
         $capability_ty:ty,
@@ -84,24 +82,13 @@ macro_rules! is_specializing_with_only_cardinality_specializations_fn {
             let cardinalities = object_type
                 .$get_cardinality_method(snapshot, type_manager, interface_type)
                 .map_err(|typedb_source| DatabaseImportError::ConceptRead { typedb_source })?;
+            // If this capability is affected by multiple cardinality constraints from the same interface type, then
+            // the object type has multiple ownerships of this interface type: some inherited and one declared (specializing)
             let same_interface_type_count = cardinalities
                 .into_iter()
                 .filter(|constraint| constraint.source().interface() == interface_type)
                 .count();
-
-            // If this capability is affected by multiple cardinality constraints from the same interface type, then
-            // the object type has multiple ownerships of this interface type: some inherited and one declared (specializing)
-            if same_interface_type_count > 1 {
-                let non_cardinality_count = capability
-                    .get_annotations_declared(snapshot, type_manager)
-                    .map_err(|typedb_source| DatabaseImportError::ConceptRead { typedb_source })?
-                    .into_iter()
-                    .filter(|annotation| !annotation.has_category(&AnnotationCategory::Cardinality))
-                    .count();
-                Ok(non_cardinality_count == 0)
-            } else {
-                Ok(false)
-            }
+            Ok(same_interface_type_count > 1)
         }
     };
 }
@@ -131,6 +118,7 @@ macro_rules! for_item_in_write_transaction {
 #[derive(Debug)]
 struct SchemaInfo {
     temporarily_independent_attribute_types: HashSet<AttributeType>,
+    temporarily_non_independent_attribute_types: HashSet<AttributeType>,
     temporarily_independent_relation_types: HashSet<RelationType>,
     original_keys: HashSet<Owns>,
     original_cardinalities_owns: HashMap<Owns, Option<AnnotationCardinality>>,
@@ -144,6 +132,7 @@ impl SchemaInfo {
     fn new() -> Self {
         Self {
             temporarily_independent_attribute_types: HashSet::new(),
+            temporarily_non_independent_attribute_types: HashSet::new(),
             temporarily_independent_relation_types: HashSet::new(),
             original_keys: HashSet::new(),
             original_cardinalities_owns: HashMap::new(),
@@ -599,7 +588,7 @@ impl DatabaseImporter {
             TransactionSchema,
             transaction,
             |inner_snapshot, type_manager, thing_manager, _fm, _qm| {
-                self.restore_independent_attribute_types(&mut inner_snapshot, &type_manager)?;
+                self.restore_independent_attribute_types(&mut inner_snapshot, &type_manager, &thing_manager)?;
                 self.restore_independent_relation_types(&mut inner_snapshot, &type_manager)?;
                 self.restore_capabilities_and_cardinalities(&mut inner_snapshot, &type_manager, &thing_manager)?;
             }
@@ -610,6 +599,10 @@ impl DatabaseImporter {
             .map_err(|typedb_source| DatabaseImportError::FinalizationSchemaCommitFailed { typedb_source })
     }
 
+    // The @independent constraint is inherited by all subtypes, and a subtype cannot redeclare
+    // an inherited constraint. To make every attribute type independent, the annotation is
+    // declared on root types only, and existing subtype declarations are temporarily undeclared
+    // so they do not become redundant
     fn make_attribute_types_independent(
         &mut self,
         snapshot: &mut impl WritableSnapshot,
@@ -620,15 +613,25 @@ impl DatabaseImporter {
             .get_attribute_types(snapshot)
             .map_err(|typedb_source| DatabaseImportError::ConceptRead { typedb_source })?;
         for attribute_type in attribute_types {
-            if !attribute_type
-                .is_independent(snapshot, type_manager)
+            let is_root = attribute_type
+                .get_supertype(snapshot, type_manager)
+                .map_err(|typedb_source| DatabaseImportError::ConceptRead { t
```

---

### Incident Patch 14: `fb8a70c0` (2026-08-12)
**Commit Message**: Fix add_or_intersect change condition (#7910)

## Product change and motivation
Fixes the condition that determines whether add_or_intersect changed the type annotations of the vertex

**File**: `compiler/annotation/inference/match_inference.rs` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ impl VertexAnnotations {
         if let Some(existing_annotations) = self.get_mut(vertex) {
             let size_before = existing_annotations.len();
             existing_annotations.retain(|x| new_annotations.contains(x));
-            existing_annotations.len() == size_before
+            existing_annotations.len() != size_before
         } else {
             self.insert(vertex.clone(), new_annotations.into_owned());
             true
```

---

### Incident Patch 15: `378983cc` (2026-08-05)
**Commit Message**: DefinitionKey holds Prefix & DefinitionID instead of raw bytes (#7896)

## Implementation
Refactor `DefinitionKey` struct to hold Prefix & DefinitionID instead of raw bytes, in line with other stored objects.

**File**: `compiler/annotation/type_inference.rs` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ pub mod tests {
         let (with_no_cache, with_local_cache, _with_schema_cache) = [
             FunctionID::Preamble(0),
             FunctionID::Preamble(0),
-            FunctionID::Schema(DefinitionKey::build(Prefix::DefinitionFunction, DefinitionID::build(0))),
+            FunctionID::Schema(DefinitionKey::new(Prefix::DefinitionFunction, DefinitionID::new(0))),
         ]
         .iter()
         .map(|function_id| {
```

**File**: `concept/type_/type_manager/type_reader.rs` (modified, +2/-2)
```diff
@@ -109,7 +109,7 @@ impl TypeReader {
         let bytes = snapshot
             .get(index_key.into_storage_key().as_reference(), StorageCounters::DISABLED)
             .map_err(|source| Box::new(ConceptReadError::SnapshotGet { source }))?;
-        Ok(bytes.map(|value| DefinitionKey::new(Bytes::Array(value))))
+        Ok(bytes.map(|value| DefinitionKey::decode(Bytes::Array(value))))
     }
 
     pub(crate) fn get_struct_definition(
@@ -137,7 +137,7 @@ impl TypeReader {
                 StorageCounters::DISABLED,
             )
             .collect_cloned_hashmap(|key, value| {
-                (DefinitionKey::new(Bytes::Array(key.bytes().into())), StructDefinition::from_bytes(value))
+                (DefinitionKey::decode(Bytes::Array(key.bytes().into())), StructDefinition::from_bytes(value))
             })
             .map_err(|source| Box::new(ConceptReadError::SnapshotIterate { source }))
     }
```

**File**: `concept/type_/type_manager/type_writer.rs` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ impl<Snapshot: WritableSnapshot> TypeWriter<Snapshot> {
         struct_definition: StructDefinition,
     ) {
         let index_key = NameToStructDefinitionIndex::build(struct_definition.name.as_str());
-        snapshot.put_val(index_key.into_storage_key().into_owned_array(), ByteArray::copy(definition_key.bytes()));
+        snapshot.put_val(index_key.into_storage_key().into_owned_array(), ByteArray::copy(&definition_key.bytes()));
         snapshot.insert_val(
             definition_key.into_storage_key().into_owned_array(),
             struct_definition.into_bytes().unwrap().into_array(),
```

**File**: `encoding/graph/common/schema_id_allocator.rs` (modified, +2/-2)
```diff
@@ -140,11 +140,11 @@ impl SchemaID for DefinitionKey {
 
     fn object_from_id(prefix: Prefix, id: u64) -> Self {
         debug_assert!((Self::MIN_ID..=Self::MAX_ID).contains(&id));
-        DefinitionKey::build(prefix, DefinitionID::build(id as DefinitionIDUInt))
+        DefinitionKey::new(prefix, DefinitionID::new(id as DefinitionIDUInt))
     }
 
     fn id_from_key(key: StorageKey<'_, BUFFER_KEY_INLINE>) -> u64 {
-        DefinitionKey::new(Bytes::reference(key.bytes())).definition_id().as_uint() as u64
+        DefinitionKey::decode(Bytes::reference(key.bytes())).definition_id().as_uint() as u64
     }
 
     fn ids_exhausted_error(prefix: Prefix) -> EncodingError {
```

**File**: `encoding/graph/definition/definition_key.rs` (modified, +30/-31)
```diff
@@ -6,7 +6,7 @@
 
 use std::{fmt, ops::Range};
 
-use bytes::{Bytes, byte_array::ByteArray};
+use bytes::{Bytes, byte_array::ByteArray, util::HexBytesFormatter};
 use resource::constants::{encoding::DefinitionIDUInt, snapshot::BUFFER_KEY_INLINE};
 use serde::{
     Deserialize, Deserializer, Serialize, Serializer,
@@ -21,7 +21,8 @@ use crate::{
 
 #[derive(Clone, Debug, PartialEq, Eq, Hash, Ord, PartialOrd)]
 pub struct DefinitionKey {
-    bytes: ByteArray<BUFFER_KEY_INLINE>,
+    prefix: Prefix,
+    definition_id: DefinitionID,
 }
 
 impl DefinitionKey {
@@ -33,20 +34,20 @@ impl DefinitionKey {
     pub(crate) const RANGE_DEFINITION_ID: Range<usize> =
         Self::INDEX_PREFIX + 1..Self::INDEX_PREFIX + 1 + DefinitionID::LENGTH;
 
-    pub fn new(bytes: Bytes<'_, BUFFER_KEY_INLINE>) -> Self {
-        debug_assert_eq!(bytes.length(), Self::LENGTH);
-        Self { bytes: ByteArray::copy(&bytes) }
+    pub fn new(prefix: Prefix, definition_id: DefinitionID) -> Self {
+        Self { prefix, definition_id }
     }
 
-    pub fn definition_id(&self) -> DefinitionID {
-        DefinitionID::new(self.bytes[Self::RANGE_DEFINITION_ID].try_into().unwrap())
+    pub fn decode(bytes: Bytes<'_, BUFFER_KEY_INLINE>) -> Self {
+        debug_assert_eq!(bytes.length(), Self::LENGTH);
+        Self {
+            prefix: Prefix::from_prefix_id(PrefixID::new(bytes[Self::INDEX_PREFIX])).unwrap(),
+            definition_id: DefinitionID::decode(bytes[Self::RANGE_DEFINITION_ID].try_into().unwrap()),
+        }
     }
 
-    pub fn build(prefix: Prefix, definition_id: DefinitionID) -> Self {
-        let mut array = ByteArray::zeros(Self::LENGTH);
-        array[Self::INDEX_PREFIX] = prefix.prefix_id().byte;
-        array[Self::RANGE_DEFINITION_ID].copy_from_slice(&definition_id.bytes());
-        Self { bytes: array }
+    pub fn definition_id(&self) -> DefinitionID {
+        self.definition_id
     }
 
     pub fn build_prefix(prefix: Prefix) -> StorageKey<'static, { DefinitionKey::LENGTH_PREFIX }> {
@@ -57,14 +58,17 @@ impl DefinitionKey {
         )
     }
 
-    pub fn bytes(&self) -> &[u8] {
-        &self.bytes
+    pub fn bytes(&self) -> [u8; Self::LENGTH] {
+        let mut array = [0; 3];
+        array[Self::INDEX_PREFIX] = self.prefix.prefix_id().byte;
+        array[Self::RANGE_DEFINITION_ID].copy_from_slice(&self.definition_id.bytes());
+        array
     }
 }
 
 impl AsBytes<BUFFER_KEY_INLINE> for DefinitionKey {
     fn to_bytes(self) -> Bytes<'static, BUFFER_KEY_INLINE> {
-        Bytes::Array(self.bytes)
+        Bytes::Array(ByteArray::copy(&self.bytes()))
     }
 }
 
@@ -78,38 +82,33 @@ impl Prefixed<BUFFER_KEY_INLINE> for DefinitionKey {}
 
 impl fmt::Display for DefinitionKey {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
-        // we'll just arbitrarily write it out as an u64 in Big Endian
-        debug_assert!(self.bytes.len() < (u64::BITS / 8) as usize);
-        let mut bytes = [0u8; (u64::BITS / 8) as usize];
-        bytes[0..self.bytes.len()].copy_from_slice(&self.bytes);
-        let as_u64 = u64::from_be_bytes(bytes);
-        write!(f, "{}", as_u64)
+        write!(f, "{:?}", &HexBytesFormatter::borrowed(&self.bytes()))
     }
 }
 
-#[derive(Debug, Copy, Clone, PartialEq, Eq)]
+#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Ord, PartialOrd)]
 pub struct DefinitionID {
-    bytes: [u8; DefinitionID::LENGTH],
+    id: u16,
 }
 
 impl DefinitionID {
     pub(crate) const LENGTH: usize = std::mem::size_of::<DefinitionIDUInt>();
 
-    pub fn new(bytes: [u8; DefinitionID::LENGTH]) -> DefinitionID {
-        DefinitionID { bytes }
+    pub fn decode(bytes: [u8; Self::LENGTH]) -> DefinitionID {
+        DefinitionID { id: DefinitionIDUInt::from_be_bytes(bytes) }
     }
 
-    pub fn build(id: DefinitionIDUInt) -> Self {
+    pub fn new(id: DefinitionIDUInt) -> Self {
         debug_assert_eq!(std::mem::size_of_val(&id), DefinitionID::LENGTH);
-        DefinitionID { bytes: id.to_be_bytes() }
+        DefinitionID { id }
     }
 
     pub fn as_uint(&self) -> DefinitionIDUInt {
-        DefinitionIDUInt::from_be_bytes(self.bytes)
+        self.id
     }
 
     pub fn bytes(&self) -> [u8; DefinitionID::LENGTH] {
-        self.bytes
+        self.id.to_be_bytes()
     }
 }
 
@@ -118,7 +117,7 @@ impl Serialize for DefinitionKey {
     where
         S: Serializer,
     {
-        serializer.serialize_bytes(&self.bytes)
+        serializer.serialize_bytes(&self.bytes())
     }
 }
 
@@ -139,7 +138,7 @@ impl<'de> Deserialize<'de> for DefinitionKey {
             where
                 E: Error,
             {
-                Ok(DefinitionKey { bytes: ByteArray::copy(v) })
+                Ok(DefinitionKey::decode(Bytes::Reference(v)))
             }
         }
 
```

**File**: `encoding/graph/type_/property.rs` (modified, +1/-1)
```diff
@@ -276,7 +276,7 @@ impl FunctionProperty {
     pub fn decode(bytes: Bytes<'_, BUFFER_KEY_INLINE>) -> Self {
         debug_assert!(bytes.length() >= Self::LENGTH_NO_SUFFIX);
         debug_assert_eq!(bytes[Self::INDEX_PREFIX], Self::PREFIX.prefix_id().byte);
-        let function_id = DefinitionKey::new(bytes.clone().into_range(Self::range_function_id()));
+        let function_id = DefinitionKey::decode(bytes.clone().into_range(Self::range_function_id()));
         let infix = Infix::from_infix_id(InfixID::new((&bytes[Self::range_infix()]).try_into().unwrap()));
         let suffix = ByteArray::copy(&bytes[Self::LENGTH_NO_SUFFIX..]);
         Self { function_id, infix, suffix }
```

**File**: `encoding/tests/test_definitions.rs` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ fn define_struct<Snapshot: WritableSnapshot>(
 fn get_struct_key(snapshot: &impl ReadableSnapshot, name: String) -> Option<DefinitionKey> {
     let index_key = NameToStructDefinitionIndex::build(name.as_str());
     let bytes = snapshot.get(index_key.into_storage_key().as_reference(), StorageCounters::DISABLED).unwrap();
-    bytes.map(|value| DefinitionKey::new(Bytes::Array(value)))
+    bytes.map(|value| DefinitionKey::decode(Bytes::Array(value)))
 }
 
 fn get_struct_definition(snapshot: &impl ReadableSnapshot, definition_key: &DefinitionKey) -> StructDefinition {
```

**File**: `encoding/value/struct_bytes.rs` (modified, +4/-5)
```diff
@@ -130,9 +130,8 @@ fn append_length_as_vle(len: usize, buf: &mut Vec<u8>) -> Result<(), EncodingErr
 
 // Decode
 fn decode_struct_increment_offset(offset: &mut usize, buf: &[u8]) -> Result<StructValue<'static>, EncodingError> {
-    let definition_id_u16 =
-        DefinitionID::build(u16::from_be_bytes(read_bytes_increment_offset::<{ DefinitionID::LENGTH }>(offset, buf)?));
-    let definition_key = DefinitionKey::build(StructDefinition::PREFIX, definition_id_u16);
+    let definition_id = DefinitionID::decode(read_bytes_increment_offset::<{ DefinitionID::LENGTH }>(offset, buf)?);
+    let definition_key = DefinitionKey::new(StructDefinition::PREFIX, definition_id);
     let n_fields = read_vle_increment_offset(offset, buf)?;
     let mut fields: HashMap<StructFieldIDUInt, Value<'static>> = HashMap::new();
     for _ in 0..n_fields {
@@ -285,11 +284,11 @@ pub mod test {
             (Value::String(Cow::Owned(String::from_utf8(vec![b'X'; 512]).unwrap())), Value::Integer(0xf00d)), // Bigger than 256 characters
         ];
         for (string_value, integer_value) in test_values {
-            let nested_key = DefinitionKey::build(StructDefinition::PREFIX, DefinitionID::build(0));
+            let nested_key = DefinitionKey::new(StructDefinition::PREFIX, DefinitionID::new(0));
             let nested_fields = HashMap::from([(0, string_value), (1, integer_value)]);
             let nested_struct = StructValue::new(nested_key, nested_fields);
 
-            let struct_key = DefinitionKey::build(StructDefinition::PREFIX, DefinitionID::build(0));
+            let struct_key = DefinitionKey::new(StructDefinition::PREFIX, DefinitionID::new(0));
             let struct_fields = HashMap::from([(0, Value::Struct(Cow::Owned(nested_struct.clone())))]);
             let struct_value = StructValue::new(struct_key, struct_fields);
 
```

#### Recent Merged Pull Requests:
- **PR #8004** (2026-10-02): Avoid blocking the transaction reservation queue on lock timeouts (@farost)
- **PR #8003** (2026-10-01): Stop copying the write buffer and optimize relation index qualification (@farost)
- **PR #8002** (2026-10-01): Optimise Match stage executor to take a FixedBatch instead of a row as input (@krishnangovindraj)
- **PR #8001** (2026-10-03): Fix attribute equality regression (@flyingsilverfin)
- **PR #7998** (2026-09-30): Reduce storage lookups and heap allocations for @card validations (@farost)
- **PR #7997** (2026-09-28): Don't clean up new, independent relations without players (@flyingsilverfin)
- **PR #7996** (2026-09-29): Introduce BTreeMapIntersectionIterator to use in isolation validation (@krishnangovindraj)
- **PR #7994** (2026-09-30): Upgrade Write::Put known_to_exist to 3 values, use when putting edges (@krishnangovindraj)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
