> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ntex-rs-ntex-learnings.md`  
> **Source**: github ([https://github.com/ntex-rs/ntex](https://github.com/ntex-rs/ntex))  
> **Source Version**: `4a00b916`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-02T16:18:41.212Z  
> **Learning ID**: `learn-github-ntex-rs-ntex`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): ntex-rs/ntex

> **Canonical Artifact**: `07_PROJECT_LEARNING/ntex-rs-ntex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ntex-rs/ntex](https://github.com/ntex-rs/ntex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-02T16:18:39.682Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ntex-rs/ntex`
- **Description**: framework for composable networking services 
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2548 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ntex-error/src/utils.rs`
```
use std::{borrow::Cow, cell::RefCell, convert, error::Error as StdError, fmt, io, path};

use ntex_bytes::ByteString;

use crate::{Error, ErrorDiagnostic, ResultType};

/// The retry policy of the error.
pub trait Retryable {
    /// Returns `true` if the failed operation can be retried.
    fn is_retryable(&self) -> bool;
}

impl<E: Retryable> Retryable for Error<E> {
    fn is_retryable(&self) -> bool {
        self.inner.error.is_retryable()
    }
}

impl<T, E> Retryable for Result<T, E>
where
    E: Retryable,
{
    fn is_retryable(&self) -> bool {
        match self {
            Ok(_) => false,
            Err(err) => err.is_retryable(),
        }
    }
}

/// Helper type holding a result classification signature.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct ResultSignature(pub &'static str);

impl ResultSignature {
    /// Creates a new `ResultSignature`.
    pub fn new(sig: &'static str) -> Self {
        Self(sig)
    }

    /// Returns a stable identifier for the result classification.
    pub fn signature(self) -> &'static str {
        self.0
    }
}

impl<'a, E: ErrorDiagnostic> From<&'a E> for ResultSignature {
    fn from(err: &'a E) -> Self {
        ResultSignature::new(err.signature())
    }
}

impl<'a, T, E: ErrorDiagnostic> From<&'a Result<T, E>> for ResultSignature {
    fn from(result: &'a Result<T, E>) -> Self {
        match result {
            Ok(_) => ResultSignature(ResultType::Success.as_str()),
            Err(err) => ResultSignature(err.signature()),
        }
    }
}

impl ErrorDiagnostic for convert::Infallible {
    fn signature(&self) -> &'static str {
        unreachable!()
    }
}

impl ErrorDiagnostic for io::Error {
    fn signature(&self) -> &'static str {
        match self.kind() {
            io::ErrorKind::InvalidData => "std-io-InvalidData",
            io::ErrorKind::InvalidInput => "std-io-InvalidInput",
            io::ErrorKind::Unsupported => "std-io-Unsupported",
            io::ErrorKind::UnexpectedEof => "std-io-UnexpectedEof",
            io::ErrorKind::BrokenPipe => "std-io-BrokenPipe",
            io::ErrorKind::ConnectionReset => "std-io-ConnectionReset",
            io::ErrorKind::ConnectionAborted => "std-io-ConnectionAborted",
            io::ErrorKind::NotConnected => "std-io-NotConnected",
            io::ErrorKind::TimedOut => "std-io-TimedOut",
            _ => "std-io-Error",
        }
    }
}

/// Marker diagnostic type representing a successful result.
///
/// Its signature is [`ResultType::Success`].
#[derive(Copy, Clone, PartialEq, Eq, Hash, Debug)]
pub struct Success;

impl StdError for Success {}

impl ErrorDiagnostic for Success {
    fn signature(&self) -> &'static str {
        ResultType::Success.as_str()
    }
}

impl fmt::Display for Success {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Success")
    }
}

/// Executes a future and ensures an error service is set.
///
/// If the error does not already have a service, the provided service is assigned.
pub async fn with_service<F, T, E>(svc: &'static str, fut: F) -> F::Output
where
    F: Future<Output = Result<T, Error<E>>>,
    E: ErrorDiagnostic + Clone,
{
    fut.await.map_err(|err: Error<E>| {
        if err.service().is_none() {
            err.with_service(svc)
        } else {
            err
        }
    })
}

/// Generates a Rust module path from the given source file path.
///
/// The path is resolved relative to the crate directory (the parent of `src`),
/// e.g. `/p/my-crate/src/net/io.rs` becomes `my_crate::net::io`.
pub fn module_path(file_path: &str) -> ByteString {
    module_path_ext("", "", "::", "", file_path)
}

/// Generates a Rust module path from the given source file path,
/// prepending `prefix`.
pub fn module_path_prefix(prefix: &'static str, file_path: &str) -> ByteString {
    module_path_ext(prefix, "", "::", "", file_path)
}

/// Generates a `/`-separated file path relative to the crate's parent directory.
///
/// e.g. `/p/my-crate/src/net/io.rs` becomes `my-crate/src/net/io.rs`.
pub fn module_path_fs(file_path: &str) -> ByteString {
    module_path_ext("", "/src", "/", ".rs", file_path)
}

fn module_path_ext(
    prefix: &'static str,
    mod_sep: &'static str,
    sep: &'static str,
    suffix: &'static str,
    file_path: &str,
) -> ByteString {
    type HashMap<K, V> = std::collections::HashMap<K, V, foldhash::fast::RandomState>;
    type Key = (&'static str, &'static str, &'static str, &'static str);
    thread_local! {
        static CACHE: RefCell<HashMap<Key, HashMap<String, ByteString>>> = RefCell::new(HashMap::default());
    }

    let key = (prefix, mod_sep, sep, suffix);
    let cached = CACHE.with(|cache| {
        if let Some(c) = cache.borrow().get(&key) {
            c.get(file_path).cloned()
        } else {
            None
        }
    });

    if let Some(cached) = cached {
        cached
    } else {
        let normalized_file_path = normalize_file_path(file_path);
        let (module_name, module_root) = module_root_from_file(mod_sep, &normalized_file_path);
        let module = module_path_from_file_with_root(
            prefix,
            sep,
            &normalized_file_path,
            &module_name,
            &module_root,
            suffix,
        );

        let _ = CACHE.with(|cache| {
            cache
                .borrow_mut()
                .entry(key)
                .or_default()
                .insert(file_path.to_string(), module.clone())
        });
        module
    }
}

fn normalize_file_path(file_path: &str) -> String {
    let path = path::Path::new(file_path);
    if path.is_absolute() {
        return path.to_string_lossy().into_owned();
    }

    match std::env::current_dir() {
        Ok(cwd) => cwd.join(path).to_string_lossy().into_owned(),
        Err(_) => file_path.to_string(),
    }
}

fn module_root_from_file(mod_sep: &str, file_path: &str) -> (String, path::PathBuf) {
    let normalized = file_path.replace('\\', "/");
    if let Some((root, _)) = normalized.rsplit_once("/src/") {
        let mut root = path::PathBuf::from(root);
        let mod_name = root
            .file_name()
            .map_or(Cow::Borrowed("crate"), |s| s.to_string_lossy());
        let mod_name = if mod_sep.is_empty() {
            mod_name.replace('-', "_")
        } else {
            mod_name.to_string()
        };
        root.push("src");
        return (format!("{mod_name}{mod_sep}"), root);
    }

    let path = path::Path::new(file_path)
        .parent()
        .map_or_else(|| path::PathBuf::from("."), path::Path::to_path_buf);

    let m = path
        .parent()
        .and_then(|p| p.file_name())
        .map_or_else(|| Cow::Borrowed("crate"), |p| p.to_string_lossy());

    (format!("{m}{mod_sep}"), path)
}

fn module_path_from_file(sep: &str, file_path: &str) -> String {
    let normalized = file_path.replace('\\', "/");
    let relative = normalized
        .split_once("/src/")
        .map_or(normalized.as_str(), |(_, tail)| tail);

    if relative == "lib.rs" || relative == "main.rs" {
        return relative.to_string();
    }

    let without_ext = relative.strip_suffix(".rs").unwrap_or(relative);
    if without_ext.ends_with("/mod") {
        let parent = without_ext.strip_suffix("/mod").unwrap_or(without_ext);
        let parent = parent.trim_matches('/');
        return parent.replace('/', sep);
    }

    let module = without_ext.trim_matches('/').replace('/', sep);
    if module.is_empty() {
        "crate".to_string()
    } else {
        module
    }
}

fn module_path_from_file_with_root(
    prefix: &str,
    sep: &str,
    file_path: &str,
    module_name: &str,
    module_root: &path::Path,
    suffix: &str,
) -> ByteString {
    let normalized = file_path.replace('\\', "/");
    let module_root_norm = module_root.to_string_lossy().replace('\\', "/");
    // filesystem roots (`/`, `C:/`) already end with a separator
    let module_root_norm = module_root_norm.trim_end_matches('/');

    let Some(relative) = normalized.strip_prefix(&(module_root_norm.to_string() + "/")) else {
        return format!(
            "{prefix}{module_name}{sep}{}{suffix}",
            module_path_from_file(sep, file_path)
        )
        .into();
    };
    if relative == "lib.rs" || relative == "main.rs" {
        return ByteString::from(format!("{prefix}{module_name}{sep}{relative}"));
    }

    let without_ext = relative.strip_suffix(".rs").unwrap_or(relative);
    if without_ext.ends_with("/mod") {
        let parent = without_ext.strip_suffix("/mod").unwrap_or(without_ext);
        let parent = parent.trim_matches('/');
        return format!(
            "{prefix}{module_name}{sep}{}{sep}mod{suffix}",
            parent.replace('/', sep)
        )
        .into();
    }

    let module = without_ext.trim_matches('/').replace('/', sep);
    if module.is_empty() {
        ByteString::from(format!("{prefix}{module_name}{suffix}"))
    } else {
        format!("{prefix}{module_name}{sep}{module}{suffix}").into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_paths() {
        assert_eq!(module_path("/p/my-crate/src/lib.rs"), "my_crate::lib.rs");
        assert_eq!(module_path("/p/my-crate/src/main.rs"), "my_crate::main.rs");
        assert_eq!(
            module_path("/p/my-crate/src/net/mod.rs"),
            "my_crate::net::mod"
        );
        assert_eq!(
            module_path("/p/my-crate/src/net/io.rs"),
            "my_crate::net::io"
        );
        assert_eq!(module_path("/p/my-crate/src/.rs"), "my_crate");
        assert_eq!(module_path("/p/my-crate/src/a/src/b.rs"), "a::b");
        assert_eq!(module_path("/a/b/c.rs"), "a::c");
        assert_eq!(module_path("/c.rs"), "crate::c");
        assert_eq!(module_path("src/lib.rs"), "ntex_error::lib.rs");
        assert_eq!(
            module_path("C:\\p\\my-crate\\src\\net\\io.rs"),
            "my_crate::net::io"
        );
        // cached
        a
```

### Core Architecture Module: `ntex-io/src/io/state.rs`
```
use std::task::{Context, Poll};
use std::{fmt, future::poll_fn, hash, io, ptr};

#[cfg(feature = "tracker")]
use ntex_bytes::BytesTracker;
use ntex_bytes::{BytePageSize, BytesMut};

#[cfg(feature = "tracker")]
use crate::cfg::{BufTracker, IoConfig};
use crate::filter::Filter;
use crate::metrics::IoMetrics;
use crate::ops::Id;
use crate::utils::{WriteDeadline, write_timed_out};
use crate::waiters::{TAG_WRITE, WriteGuard};

use super::{Close, IoState, RD_SHRINK_BATCHES};

impl IoState {
    pub(crate) fn id(&self) -> Id {
        self.id.get()
    }

    pub(crate) fn tag(&self) -> &'static str {
        self.cfg.tag()
    }

    /// Checks whether the `Io` that owned the filter chain has been dropped.
    pub(crate) fn is_io_dropped(&self) -> bool {
        !self.filter.is_set()
    }

    pub(crate) fn filter(&self) -> &dyn Filter {
        self.filter.get()
    }

    pub(crate) fn notify_timeout(&self) {
        if self.flags.check_dispatcher_timeout_unset() {
            self.wake_dispatch_task();
            log::trace!("{}: Timer, notify dispatcher", self.cfg.tag());
        }
    }

    /// Wakes the disconnect waiters and all public waker slots.
    pub(crate) fn notify_disconnect(&self) {
        self.extensions.wake_all();
    }

    /// Get the current I/O error.
    pub(crate) fn error(&self) -> Option<io::Error> {
        if let Some(err) = self.error.take() {
            let cloned = if let Some(code) = err.raw_os_error() {
                io::Error::from_raw_os_error(code)
            } else {
                io::Error::new(err.kind(), format!("{err}"))
            };
            self.error.set(Some(cloned));
            Some(err)
        } else {
            None
        }
    }

    /// Returns the current I/O error, or creates a `NotConnected` error.
    pub(crate) fn error_or_disconnected(&self) -> io::Error {
        self.error()
            .unwrap_or_else(|| io::Error::new(io::ErrorKind::NotConnected, "Disconnected"))
    }

    pub(crate) fn filters_stopped(&self) {
        // the shutdown deadline carries over into the transport shutdown
        // phase, so that a single `shutdown_timeout` bounds both phases
        self.flags.enter_transport_shutdown();
        self.wake_read_task();
        self.wake_write_task();
        self.wake_dispatch_task();
        self.wake_write_waiters();
    }

    fn set_error(&self, err: Option<io::Error>) {
        if let Some(err) = err {
            if let Some(current) = self.error.take() {
                self.error.set(Some(current));
            } else {
                self.error.set(Some(err));
            }
        }
    }

    pub(crate) fn set_shutdown_error(&self, err: io::Error) {
        self.set_error(Some(err));
    }

    /// Force-closes the connection, aborting it instead of closing gracefully.
    ///
    /// This is the only path that makes the transport report
    /// [`Readiness::Terminate`](crate::Readiness::Terminate). Terminations that
    /// come from a failure rather than from an explicit request go through
    /// [`terminate_connection`](Self::terminate_connection) and let the
    /// transport close the connection gracefully.
    pub(crate) fn force_close_connection(&self) {
        self.begin_terminate(None, true);
    }

    pub(crate) fn terminate_connection(&self, err: Option<io::Error>) {
        self.begin_terminate(err, false);
    }

    /// Moves the connection onto the termination path and runs the teardown
    /// work, which only the first call to get here performs.
    fn begin_terminate(&self, err: Option<io::Error>, force: bool) {
        self.set_error(err);
        if self.flags.begin_terminate(force) {
            log::trace!("{}: Terminate io", self.cfg.tag());
            // buffers held by the transport are gone with it
            self.wr_inflight.set(0);
            self.wake_read_task();
            self.wake_write_task();
            self.wake_dispatch_task();
            self.wake_write_waiters();
            self.handle.take();
        }
        if force {
            // an aborted transport does not write buffered output
            self.discard_output();
        }
    }

    pub(crate) fn stop_connection(&self, err: Option<io::Error>) {
        if !self.flags.is_closed() {
            log::trace!("{}: Stop io with error {:?}", self.cfg.tag(), err);
            self.set_error(err);
            self.flags.set_stopped();
            // nothing can deliver buffered output anymore, buffers held by
            // the transport are gone with it
            self.discard_output();
            self.wake_read_task();
            self.wake_write_task();
            self.wake_dispatch_task();
            self.wake_write_waiters();
            self.notify_disconnect();
            self.handle.take();
        }
    }

    /// Frees output that can not be delivered anymore, see
    /// [`is_output_discarded`](Self::is_output_discarded).
    fn discard_output(&self) {
        self.wr_inflight.set(0);
        // with a buffer in use, its user updates the buffered size afterwards
        if self.buffer.discard_write() {
            self.sync_write_buffered();
        }
    }

    /// Whether the transport is gone or aborts the connection, so that output
    /// can not be delivered anymore.
    pub(crate) fn is_output_discarded(&self) -> bool {
        self.flags.is_closed() || self.flags.is_force_closing()
    }

    /// Gracefully shuts down the read and write I/O tasks.
    pub(crate) fn start_shutdown(&self) {
        if self.flags.is_active() {
            log::trace!("{}: Initiate io shutdown {:?}", self.cfg.tag(), self.flags);
            self.flags.enter_filters_stopping();
            self.wake_read_task();
            self.wake_write_task();
        }
    }

    /// Acquires an empty read buffer of the connection's read page size from
    /// the thread-local page cache.
    pub(crate) fn get_read_buf(&self) -> BytesMut {
        #[cfg(feature = "tracker")]
        if let Some(t) = self.buf_tracker() {
            return BytesMut::with_page_size_in(self.rd_size.get(), t);
        }
        BytesMut::with_page_size(self.rd_size.get())
    }

    /// Returns the tracker charged with new read buffers.
    ///
    /// A shared tracker is borrowed from the config, a per-connection
    /// tracker is created on first use. The reference must not be used after
    /// [`Io::set_config`](crate::Io::set_config).
    #[cfg(feature = "tracker")]
    pub(crate) fn buf_tracker(&self) -> Option<&BytesTracker> {
        match self.cfg.buf_tracker() {
            BufTracker::Disabled => None,
            BufTracker::Shared(t) => Some(t),
            BufTracker::PerConnection => {
                let slot = self.rd_tracker.get();
                // SAFETY: the slot is written only while it is empty or by
                // `set_config`, so no reference to its value is live
                unsafe {
                    if (*slot).is_none() {
                        *slot = Some(BytesTracker::new());
                    }
                    (*slot).as_ref()
                }
            }
        }
    }

    /// Switches the read buffer tracker to the mode of `cfg`, before it
    /// replaces the current config.
    ///
    /// The read buffers held by the stack are charged to the new tracker.
    #[cfg(feature = "tracker")]
    pub(super) fn update_buf_tracker(&self, cfg: &IoConfig) {
        // SAFETY: `set_config` requires that no reference obtained from
        // `buf_tracker` is live
        let slot = unsafe { &mut *self.rd_tracker.get() };
        match cfg.buf_tracker() {
            BufTracker::Disabled => *slot = None,
            BufTracker::Shared(t) => {
                *slot = None;
                self.buffer.set_buf_tracker(t);
            }
            BufTracker::PerConnection => {
                if !matches!(self.cfg.buf_tracker(), BufTracker::PerConnection) {
                    let t = slot.insert(BytesTracker::new());
                    self.buffer.set_buf_tracker(t);
                }
            }
        }
    }

    /// Returns the page size of new read buffers.
    #[cfg(test)]
    pub(crate) fn read_size(&self) -> BytePageSize {
        self.rd_size.get()
    }

    /// Resets the read page size to the configured min.
    pub(super) fn reset_read_size(&self) {
        self.rd_size.set(self.cfg.read_size_min());
        self.rd_batch.set(0);
        self.rd_small.set(0);
    }

    /// Adapts the read page size to a transport read of `nbytes`.
    ///
    /// Reads that fill their buffer most likely leave more input behind, so
    /// they and the read that follows them form one batch. A batch larger
    /// than the page capacity grows the page size to fit it, up to the
    /// configured max. After [`RD_SHRINK_BATCHES`] batches in a row that fit
    /// in half of the next smaller page, the page size shrinks by one step,
    /// down to the configured min.
    pub(crate) fn track_read(&self, nbytes: usize, full: bool) {
        let batch = self.rd_batch.get().saturating_add(as_u32(nbytes));
        let size = self.rd_size.get();
        if full {
            self.rd_batch.set(batch);
            if batch as usize > size.capacity() {
                self.grow_read_size(batch as usize);
            }
            return;
        }

        self.rd_batch.set(0);
        let batch = batch as usize;
        if batch == 0 {
            // nothing was read since the previous batch ended
        } else if batch > size.capacity() {
            self.grow_read_size(batch);
        } else if size != self.cfg.read_size_min() && batch < size.prev().capacity() / 2 {
            let small = self.rd_small.get() + 1;
            if small < RD_SHRINK_BATCHES {
                self.rd_small.set(small);
            } else {
                let min = self.cfg.read_size_min();
                let prev = size.prev();
                self.rd_size.set(if prev.capacity() < min.capacity() {
                    min
  
```

### Core Architecture Module: `ntex-io/src/utils.rs`
```
use std::cell::Cell;
use std::io;
use std::rc::Rc;
use std::task::{Context, Poll, Waker};

use ntex_rt::LocalWaker;
use ntex_service::state::{RequestState, State};
use ntex_util::time::{Seconds, Sleep};

use crate::waiters::{WaiterEntry, Waiters};
use crate::{Filter, Io, IoBoxed, IoCallbacks};

/// Result of a single decode attempt.
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
pub struct Decoded<T> {
    /// The decoded item, or `None` when the codec needs more input.
    pub item: Option<T>,
    /// Bytes left in the application-facing read buffer after the attempt.
    pub remains: usize,
    /// Bytes consumed from the read buffer by the attempt.
    pub consumed: usize,
}

// capacity of the wake buffer kept for reuse
const MAX_SPARE_WAKERS: usize = 1024;

#[derive(Default)]
pub(crate) struct Extensions {
    // tasks waiting for io events, by tag, allocated on first registration
    waiters: Cell<Option<Box<Waiters>>>,
    // filter callbacks registered for io events
    callbacks: Cell<Option<Rc<dyn IoCallbacks>>>,
}

impl Extensions {
    /// Runs `f` with the waiters, allocating them if needed.
    ///
    /// The waiters are taken out while `f` runs, so `f` must not run user
    /// code, wakers are woken and dropped by the caller after `f`.
    fn with_waiters<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&mut Waiters) -> R,
    {
        let mut waiters = self.waiters.take().unwrap_or_default();
        let result = f(&mut waiters);
        self.waiters.set(Some(waiters));
        result
    }

    /// Runs `f` with the waiters if they are allocated, see [`Self::with_waiters`].
    fn with_waiters_opt<F, R>(&self, f: F) -> Option<R>
    where
        F: FnOnce(&mut Waiters) -> R,
    {
        let mut waiters = self.waiters.take()?;
        let result = f(&mut waiters);
        self.waiters.set(Some(waiters));
        Some(result)
    }

    /// Registers the waker of the waiter, a woken waiter gets a new entry.
    pub(super) fn register_waker(&self, waiter: &WaiterEntry, waker: &Waker) {
        let replaced = self.with_waiters(|waiters| {
            if let Some(id) = waiter.id.get()
                && let Some(replaced) = waiters.update(id, waker)
            {
                replaced
            } else {
                waiter.id.set(Some(waiters.register(waiter.tag, waker)));
                None
            }
        });
        drop(replaced);
    }

    /// Registers the waiter, or reports that its registration was woken.
    ///
    /// A reported wake clears the registration, the next poll registers again.
    pub(super) fn poll_waker(&self, waiter: &WaiterEntry, waker: &Waker) -> Poll<()> {
        let (result, replaced) = self.with_waiters(|waiters| match waiter.id.get() {
            None => {
                waiter.id.set(Some(waiters.register(waiter.tag, waker)));
                (Poll::Pending, None)
            }
            Some(id) => {
                if let Some(replaced) = waiters.update(id, waker) {
                    (Poll::Pending, replaced)
                } else {
                    waiter.id.set(None);
                    (Poll::Ready(()), None)
                }
            }
        });
        drop(replaced);
        result
    }

    /// Removes the waiter entry unless it is woken.
    pub(super) fn remove_waker(&self, waiter: &WaiterEntry) {
        if let Some(id) = waiter.id.take() {
            let waker = self.with_waiters_opt(|waiters| waiters.remove(id, waiter.tag));
            drop(waker);
        }
    }

    /// Wakes and removes all wakers of the tag.
    pub(super) fn wake(&self, tag: usize) {
        self.wake_with(|waiters, wakers| waiters.take(tag, wakers));
    }

    /// Wakes and removes all wakers.
    pub(super) fn wake_all(&self) {
        self.wake_with(Waiters::take_all);
    }

    /// Collects wakers with `f` and wakes them once the waiters are put back.
    ///
    /// The wakers are collected into a per-thread buffer that is reused
    /// across wakes, a nested wake allocates its own.
    fn wake_with<F>(&self, f: F)
    where
        F: FnOnce(&mut Waiters, &mut Vec<LocalWaker>),
    {
        thread_local! {
            // boxed, so taking and returning the buffer moves a single pointer
            #[allow(clippy::box_collection)]
            static WAKERS: Cell<Option<Box<Vec<LocalWaker>>>> = const { Cell::new(None) };
        }

        let Some(mut waiters) = self.waiters.take() else {
            return;
        };
        let mut wakers = WAKERS
            .try_with(Cell::take)
            .ok()
            .flatten()
            .unwrap_or_default();
        f(&mut waiters, &mut wakers);
        self.waiters.set(Some(waiters));

        wakers.drain(..).for_each(LocalWaker::wake);
        if wakers.capacity() <= MAX_SPARE_WAKERS {
            let _ = WAKERS.try_with(|spare| spare.set(Some(wakers)));
        }
    }

    #[cfg(test)]
    pub(super) fn wakers_len(&self) -> usize {
        self.with_waiters_opt(|waiters| waiters.len()).unwrap_or(0)
    }

    pub(super) fn register_filter_callbacks<T: IoCallbacks + 'static>(&self, cb: T) {
        drop(self.callbacks.replace(Some(Rc::new(cb))));
    }

    pub(super) fn take_callbacks(&self) -> Option<Rc<dyn IoCallbacks>> {
        self.callbacks.take()
    }

    /// Calls `f` with the registered callbacks.
    ///
    /// The callbacks stay registered while `f` runs, they may be replaced
    /// or taken by `f` and are dropped once `f` returns.
    pub(crate) fn with_callbacks<F>(&self, f: F)
    where
        F: FnOnce(&dyn IoCallbacks),
    {
        let callbacks = self.callbacks.take();
        let cb = callbacks.clone();
        self.callbacks.set(callbacks);
        if let Some(cb) = cb {
            f(cb.as_ref());
        }
    }
}

impl<F> RequestState<Io<F>> for Io<F> {
    type State = ();

    #[inline]
    fn unpack(self) -> ((), Io<F>) {
        ((), self)
    }
}

impl<F: Filter> RequestState<IoBoxed> for Io<F> {
    type State = ();

    #[inline]
    fn unpack(self) -> ((), IoBoxed) {
        ((), self.boxed())
    }
}

impl RequestState<IoBoxed> for IoBoxed {
    type State = ();

    #[inline]
    fn unpack(self) -> ((), IoBoxed) {
        ((), self)
    }
}

impl<F: Filter, St: 'static> RequestState<IoBoxed> for State<St, Io<F>> {
    type State = St;

    #[inline]
    fn unpack(self) -> (St, IoBoxed) {
        let State { req, state } = self;
        (state, req.boxed())
    }
}

/// Deadline for a wait on output, started lazily on the first wait.
pub(crate) struct WriteDeadline {
    timeout: Seconds,
    sleep: Option<Sleep>,
}

impl WriteDeadline {
    /// Creates a deadline, a zero timeout never expires.
    pub(crate) fn new(timeout: Seconds) -> Self {
        Self {
            timeout,
            sleep: None,
        }
    }

    pub(crate) fn poll_expired(&mut self, cx: &mut Context<'_>) -> bool {
        if self.timeout.is_zero() {
            false
        } else {
            let timeout = self.timeout;
            self.sleep
                .get_or_insert_with(|| Sleep::new(timeout.into()))
                .poll_elapsed(cx)
                .is_ready()
        }
    }
}

pub(crate) fn write_timed_out() -> io::Error {
    io::Error::new(io::ErrorKind::TimedOut, "Write timeout")
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, atomic::AtomicUsize, atomic::Ordering};
    use std::task::Wake;

    use ntex_bytes::BytePageSize;
    use ntex_service::cfg::SharedCfg;

    use super::*;
    use crate::{Sealed, buf::Stack, filter::NullFilter, testing::IoTest};

    #[derive(Debug)]
    struct NoopNotify;

    impl ntex_rt::Notify for NoopNotify {
        fn notify(&self) -> io::Result<()> {
            Ok(())
        }
    }

    struct Wrapped {
        inner: Waker,
        notifications: Arc<AtomicUsize>,
    }

    impl Wake for Wrapped {
        fn wake(self: Arc<Self>) {
            self.notifications.fetch_add(1, Ordering::Relaxed);
            self.inner.wake_by_ref();
        }
    }

    #[test]
    fn local_waiters_deliver_and_release_native_handles() {
        let rt = ntex_rt::Runtime::new(Box::new(NoopNotify));
        let ext = Rc::new(Extensions::default());
        let slots = [7, 7, crate::waiters::TAG_WRITE].map(|tag| Rc::new(WaiterEntry::new(tag)));
        let sources = slots.each_ref().map(|_| Rc::new(Cell::new(None)));
        let tasks: Vec<_> = slots
            .iter()
            .zip(&sources)
            .map(|(slot, source)| {
                let (ext, slot, source) = (ext.clone(), slot.clone(), source.clone());
                rt.spawn(std::future::poll_fn(move |cx| {
                    source.set(Some(cx.waker().clone()));
                    ext.poll_waker(&slot, cx.waker())
                }))
            })
            .collect();
        rt.poll();
        assert_eq!(ext.wakers_len(), 3);

        let notifications = Arc::new(AtomicUsize::new(0));
        let wrapped = Waker::from(Arc::new(Wrapped {
            inner: sources[0].take().unwrap(),
            notifications: notifications.clone(),
        }));
        ext.register_waker(&slots[0], &wrapped);
        drop(wrapped);
        ext.wake(7);
        assert_eq!(notifications.load(Ordering::Relaxed), 1);
        assert_eq!(ext.wakers_len(), 1);
        rt.poll();
        assert!(tasks[0].is_finished());
        assert!(tasks[1].is_finished());
        assert!(!tasks[2].is_finished());
        assert!(slots[0].id.get().is_none());
        assert!(slots[1].id.get().is_none());

        ext.remove_waker(&slots[2]);
        ext.wake_all();
        rt.poll();
        assert!(!tasks[2].is_finished());
        assert_eq!(ext.wakers_len(), 0);
        sources[2].take().unwrap().wake();
        rt.poll();
        assert_eq!(ext.wakers_len(), 1);

        for source in sources {
            drop(source.take());
        }
        drop(rt);
        for task in &tasks {
            assert!(task.is_finished());
        }
        drop(tasks);
      
```

### Core Architecture Module: `ntex-rt/src/rt/queue.rs`
```
//! Run queues of a runtime, shared by the runtime and the tasks.
use std::sync::atomic::{AtomicPtr, AtomicU64, Ordering};
use std::time::{Duration, Instant};
use std::{borrow::Cow, cell::Cell, fmt, future::Future, io, panic::Location, ptr, sync::Arc};

#[cfg(not(ntex_loom))]
use std::{
    sync::atomic::{AtomicBool, AtomicUsize},
    thread::yield_now,
};

#[cfg(ntex_loom)]
use loom::{
    sync::atomic::{AtomicBool, AtomicUsize},
    thread::yield_now,
};

use crate::handle::{JoinHandle, SpawnLocation};
use crate::{busy::BusyClock, driver::Notify, metrics::AtomicHistogram};

use super::task::{self, LocalQueue, Remote as RemoteTask, Runnable as Task, TaskList};
use super::wake::{self, WakeEntry, WakeQueue};
use super::{LOG_TARGET, REPORTED, RuntimeBuilder, TaskStats, ThreadId, current_thread_id};

const MAX_SELF_WAKES: u32 = task::MAX_SELF_WAKES;

/// Remote commands run per turn, besides `event_interval` overflow commands.
const REMOTE_BATCH: usize = 128;

/// The remaining bits count remote publications admitted before shutdown.
const CLOSED: usize = 1 << (usize::BITS - 1);

#[repr(C)]
pub(crate) struct RunnableQueue {
    /// Immutable owner-thread identity, also read by remote scheduling code.
    pub(crate) id: ThreadId,
    /// Never-reused identity of this queue's registered wake endpoint.
    pub(crate) runtime_id: wake::RuntimeId,
    /// Driver notifier, callable from the owner and remote producers.
    pub(super) handle: Box<dyn Notify>,
    /// Epoch for per-task self-wake streak timestamps.
    pub(super) epoch: Instant,
    /// Minimum streak duration before a possible busy loop is reported.
    self_wake_time: Duration,
    /// Local task budget per turn; also contributes to remote drain budgets.
    event_interval: usize,
    /// Minimum self-wake count to report; zero disables per-task streak tracking.
    self_wake_limit: u32,
    /// Aligns producer-written state away from the read-only fields.
    _remote: [CacheLine; 0],
    /// Coalesces remote driver notifications until the next scheduler drain.
    notified: AtomicBool,
    /// Closed bit and count of admitted remote submissions still in flight.
    admission: AtomicUsize,
    /// Submission, reference and wake commands, processed in FIFO order by the owner.
    pub(crate) wake_queue: WakeQueue,
    /// Aligns owner-written scheduling state away from producer-written fields.
    _local: [CacheLine; 0],
    /// Idle state used for driver notifications and busy-time accounting.
    pub(super) idle: Cell<bool>,
    /// Start of the current runtime turn, meaningful while the runtime is busy.
    pub(super) poll_start: Cell<Instant>,
    /// Cached `poll_start` offset from the epoch, in wrapping milliseconds.
    pub(super) self_wake_clock: Cell<Option<u32>>,
    /// Shared wall-clock busy-time totals and current-turn timing.
    pub(super) busy: BusyClock,
    /// Non-stopped scheduler polls; written by the owner and read across threads.
    pub(super) polls: AtomicU64,
    /// Scheduler polls that left queued work; written by the owner.
    pub(super) polls_again: AtomicU64,
    /// Shared histogram of scheduler poll durations.
    pub(super) poll_histogram: AtomicHistogram,
    /// Total self-wakes observed during task polls; written by the owner.
    pub(super) self_wakes: AtomicU64,
    /// Spawn location of the running task, null between tasks.
    pub(super) current: AtomicPtr<Location<'static>>,
    /// Owner-only FIFO of runnables, each holding a task reference.
    pub(super) local_queue: LocalQueue,
    /// Non-owning list of unfinished tasks whose futures shutdown must drop.
    pub(crate) tasks: TaskList,
    /// Counts task allocations without keeping the queue's allocation alive.
    #[cfg(test)]
    pub(super) task_allocations: Arc<()>,
}

/// Aligns the next field to a cache line, 128 bytes covers the adjacent line
/// prefetcher on x86 and the line size on Apple cores.
#[derive(Debug)]
#[repr(align(128))]
struct CacheLine;

unsafe impl Send for RunnableQueue {}
unsafe impl Sync for RunnableQueue {}

impl RunnableQueue {
    /// Initializes an idle queue with this thread as its owner.
    pub(super) fn new(builder: &RuntimeBuilder, handle: Box<dyn Notify>) -> Self {
        let now = Instant::now();
        Self {
            handle,
            event_interval: builder.event_interval,
            id: current_thread_id(),
            runtime_id: wake::runtime_id(),
            idle: Cell::new(true),
            poll_start: Cell::new(now),
            self_wake_clock: Cell::new(None),
            notified: AtomicBool::new(false),
            admission: AtomicUsize::new(0),
            busy: BusyClock::new(),
            polls: AtomicU64::new(0),
            polls_again: AtomicU64::new(0),
            poll_histogram: AtomicHistogram::default(),
            self_wakes: AtomicU64::new(0),
            self_wake_limit: builder.self_wake_limit,
            self_wake_time: builder.self_wake_time,
            epoch: now,
            current: AtomicPtr::new(ptr::null_mut()),
            local_queue: LocalQueue::new(),
            tasks: TaskList::new(),
            wake_queue: WakeQueue::new(),
            #[cfg(test)]
            task_allocations: Arc::new(()),
            _remote: [],
            _local: [],
        }
    }

    /// Spawns a task on this queue.
    ///
    /// # Safety
    ///
    /// The caller should ensure the captured lifetime is long enough.
    /// The caller must be on the runtime thread.
    pub(super) unsafe fn spawn<F: Future>(
        self: &Arc<Self>,
        future: F,
        location: SpawnLocation,
    ) -> JoinHandle<F::Output> {
        JoinHandle::new(unsafe { task::spawn(future, self, location) })
    }

    /// Spawns a task on this queue without a join handle.
    ///
    /// # Safety
    ///
    /// The caller should ensure the captured lifetime is long enough.
    /// If `LOCAL` is true, the caller must be on the runtime thread.
    /// Otherwise, the future must be `Send`.
    pub(super) unsafe fn spawn_detached<F: Future, const LOCAL: bool>(
        self: &Arc<Self>,
        future: F,
        location: SpawnLocation,
    ) {
        unsafe { task::spawn_detached::<_, LOCAL>(future, self, location) }
    }

    /// Enqueues a runnable on the owner thread and wakes an idle driver if needed.
    pub(crate) fn schedule_local(&self, runnable: Task) {
        self.local_queue.push(runnable);
        if self.idle.get() {
            // starts a busy period, `awake` does not reset it
            self.start_busy();
            // the poll running a task picks up tasks it schedules, a notify
            // could reenter the runtime and free the running task
            if self.current.load(Ordering::Relaxed).is_null() {
                self.notify();
            }
        }
    }

    /// Owner releases bypass the registry, including during shutdown cleanup.
    pub(crate) fn owner_entry(&self, entry: WakeEntry) {
        if self.admission.load(Ordering::Acquire) == CLOSED && self.wake_queue.is_empty() {
            drop(entry.into_runnable(self));
        } else {
            self.wake_queue.push(entry);
            if self.idle.get() && !self.is_closed() {
                self.start_busy();
                if self.current.load(Ordering::Relaxed).is_null() {
                    self.notify();
                }
            }
        }
    }

    /// Acquires remote wake publications without claiming another notification.
    pub(crate) fn acquire_wakes(&self) {
        // A later wake may have published writes behind an earlier FIFO entry.
        // Acquire the latest publication without resetting notification ownership.
        self.notified.fetch_or(false, Ordering::Acquire);
    }

    /// Notifies the driver, retrying interruptions and aborting on other failures.
    pub(super) fn notify(&self) {
        /// Aborts when a failed notification could strand queued work.
        #[cold]
        fn failed(err: &io::Error) -> ! {
            log::error!(target: LOG_TARGET, "Failed to notify runtime driver: {err}; aborting");
            std::process::abort();
        }

        // Aborts if the notifier unwinds, producers coalesced behind this
        // wakeup would never be woken.
        struct AbortOnUnwind;

        impl Drop for AbortOnUnwind {
            /// Prevents unwinding from abandoning a coalesced driver wakeup.
            fn drop(&mut self) {
                log::error!(target: LOG_TARGET, "Runtime notifier panicked; aborting");
                std::process::abort();
            }
        }

        let guard = AbortOnUnwind;
        // Keep responsibility for this wakeup: other producers may already
        // have coalesced behind it, even if no later submission arrives.
        while let Err(err) = self.handle.notify() {
            if err.kind() != io::ErrorKind::Interrupted {
                failed(&err);
            }
        }
        std::mem::forget(guard);
    }

    /// Reserves a submission or wake before publication or acquiring a task queue reference.
    /// `owned` keeps the queue alive if publication releases the caller's reference.
    pub(crate) fn admit(self: &Arc<Self>, owned: bool) -> Option<RemotePermit<'_>> {
        let mut state = self.admission.load(Ordering::Acquire);
        loop {
            if state & CLOSED != 0 {
                return None;
            }
            if state == CLOSED - 1 {
                std::process::abort();
            }
            match self.admission.compare_exchange_weak(
                state,
                state + 1,
                Ordering::Acquire,
                Ordering::Acquire,
            ) {
                Ok(_) => {
                    return Some(RemotePermit {
                        queue: Some(if owned {
                            Cow::Owned(self.clone())
                        } else {
                            Cow::Borrowed(self)
                        }),
                    });
                }
```

### Core Architecture Module: `ntex-server/src/state.rs`
```
#![allow(clippy::unused_async_trait_impl)]
use std::io;

/// Creates application state independently for each server worker.
pub trait ServerAppConfig: Sync + Send + 'static {
    /// State stored by each worker.
    type State: Clone;

    /// Creates state for one worker.
    async fn create(&self) -> io::Result<Self::State>;
}

/// Application configuration that creates unit state.
#[derive(Copy, Clone, Default, Debug)]
pub struct NoConfig;

impl ServerAppConfig for NoConfig {
    type State = ();

    async fn create(&self) -> io::Result<()> {
        Ok(())
    }
}

impl<F, Cfg> ServerAppConfig for F
where
    F: AsyncFn() -> io::Result<Cfg> + Sync + Send + 'static,
    Cfg: Clone,
{
    type State = Cfg;

    async fn create(&self) -> io::Result<Cfg> {
        (*self)().await
    }
}

```

### Core Architecture Module: `ntex-service/src/map_state.rs`
```
use crate::{Ctx, IntoService, IntoServiceFactory, Service, ServiceFactory};

/// Wraps a service with a fixed state value.
///
/// The wrapped service uses `st` instead of the state from its outer pipeline.
/// This changes the state passed to operations, not the service's readiness
/// identity. A shared binding keeps one gate across mapped state values.
pub fn map_state<S, St, Req>(st: St, s: impl IntoService<S, St, Req>) -> MapState<S, St>
where
    S: Service<St, Req>,
{
    MapState {
        st,
        s: s.into_service(),
    }
}

/// Wraps a service factory with a fixed state value.
///
/// The fixed state is used both to create services and to process their calls.
pub fn map_state_factory<Sf, St, Req>(
    st: St,
    sf: impl IntoServiceFactory<Sf, St, Req>,
) -> MapStateFactory<Sf, St>
where
    Sf: ServiceFactory<St, Req>,
    St: Clone,
{
    MapStateFactory {
        st,
        sf: sf.into_factory(),
    }
}

#[derive(Clone, Debug)]
/// A service that substitutes fixed state for the outer pipeline state.
///
/// Readiness and lifecycle subscriptions retain the wrapped service's scope.
/// Cloning follows the wrapped service: a [`crate::ReadyBinding`] clone gets
/// fresh readiness, while an explicitly shared handle keeps its existing gate.
pub struct MapState<S, St> {
    s: S,
    st: St,
}

impl<OtSt, S, St, Req> Service<OtSt, Req> for MapState<S, St>
where
    S: Service<St, Req>,
{
    type Res = S::Res;
    type Error = S::Error;

    fn bind(&self, ctx: crate::BindCtx<'_>) {
        ctx.bind::<_, St, Req>(&self.s);
    }

    #[inline]
    async fn call(&self, req: Req, ctx: Ctx<'_, Self, OtSt>) -> Result<S::Res, S::Error> {
        self.s.call(req, ctx.map_state(&self.st).cast()).await
    }

    #[inline]
    async fn ready(&self, ctx: Ctx<'_, Self, OtSt>) -> Result<(), S::Error> {
        self.s.ready(ctx.map_state(&self.st).cast()).await
    }

    #[inline]
    async fn shutdown(&self, ctx: Ctx<'_, Self, OtSt>) {
        self.s.shutdown(ctx.map_state(&self.st).cast()).await;
    }
}

#[derive(Clone, Debug)]
/// A factory that creates [`MapState`] services using fixed state.
pub struct MapStateFactory<Sf, St> {
    sf: Sf,
    st: St,
}

impl<OtSt, Sf, St, Req> ServiceFactory<OtSt, Req> for MapStateFactory<Sf, St>
where
    Sf: ServiceFactory<St, Req>,
    St: Clone,
{
    type Res = Sf::Res;
    type Error = Sf::Error;

    type Service = MapState<Sf::Service, St>;
    type InitError = Sf::InitError;

    #[inline]
    async fn create(&self, _: &OtSt) -> Result<Self::Service, Self::InitError> {
        Ok(MapState {
            s: self.sf.create(&self.st).await?,
            st: self.st.clone(),
        })
    }
}

#[cfg(test)]
#[path = "../tests/unit/map_state.rs"]
mod tests;

```

### Core Architecture Module: `ntex-service/src/pl_state.rs`
```
use std::{fmt, marker::PhantomPinned, ptr, rc::Rc, task::Context, task::Poll};

use crate::{
    BindCtx, Ctx, IntoService, ReadyCallback, ReadyLink, Service, ctx::WaitersRef, util::BoxFuture,
};

use crate::pipeline::PipelineBinding;
use crate::pl_inner::{PipelineApi, PipelineInternalApi, PipelineReadiness};
use crate::readiness::ReadyScope;

/// Execution container for a service whose state is supplied per operation.
///
/// Unlike [`crate::Pipeline`], this type does not own a state value. Callers
/// provide a state reference when checking readiness, calling, or shutting
/// down the service.
///
/// All bindings share one readiness cache and checker, including bindings with
/// different state values. Readiness may inspect state, but must describe the
/// shared pipeline-wide gate. Independent gates require separate pipelines.
pub struct PipelineState<St, Req, Res, Err> {
    api: Rc<dyn PipelineStateApi<St, Req, Res, Err>>,
}

impl<St, Req, Res, Err> PipelineState<St, Req, Res, Err>
where
    St: 'static,
    Req: 'static,
    Res: 'static,
    Err: 'static,
{
    #[inline]
    /// Creates a state-independent pipeline containing `service`.
    pub fn new<S>(service: impl IntoService<S, St, Req>) -> Self
    where
        S: Service<St, Req, Res = Res, Error = Err> + 'static,
        St: 'static,
    {
        let waiters = WaitersRef::new();
        let s = service.into_service();
        s.bind(BindCtx::new(waiters.scope()));
        PipelineState {
            api: Rc::new(PipelineInner {
                s,
                readiness: PipelineReadiness::new(waiters.scope()),
                waiters,
                _pinned: PhantomPinned,
            }),
        }
    }

    #[inline]
    /// Returns when the pipeline is ready to process requests.
    ///
    /// Successful readiness is shared and reused until a subscribed
    /// [`crate::ReadyNotifier`] invalidates it. Calls do not consume it.
    /// Reusing valid readiness does not allocate a readiness future.
    ///
    /// The first caller that finds readiness invalid runs the shared check in its
    /// own future, and other waiters wait for it. Like a held lock, a pending
    /// future must be polled or dropped: keeping it alive without polling stalls
    /// every other readiness waiter on this pipeline.
    pub async fn ready(&self, st: &St) -> Result<(), Err> {
        if self.is_ready() {
            Ok(())
        } else {
            self.api.ready(0, st).await
        }
    }

    #[inline]
    /// Returns `true` while the pipeline's shared readiness is valid.
    ///
    /// Does not run or register a readiness check. `false` means readiness is
    /// unknown or was invalidated, not that the service is not ready.
    pub fn is_ready(&self) -> bool {
        self.api.scope().is_ready()
    }

    #[inline]
    /// Waits for readiness, then calls the service with `st`.
    ///
    /// Reuses valid shared readiness without consuming it.
    pub async fn call(&self, req: Req, st: &St) -> Result<Res, Err> {
        let pl = self.binding();
        self.api.call(pl.idx, req, st).await
    }

    #[inline]
    /// Shuts down the enclosed service.
    pub async fn shutdown(&self, st: &St) {
        self.api.shutdown(0, st).await;
    }

    #[inline]
    /// Returns `Ready` when the pipeline is ready to process requests.
    ///
    /// Registers the task for readiness changes and reuses valid shared
    /// readiness. A pending check is retained by the pipeline, even if this
    /// task stops polling; other callers can continue driving it.
    /// The retained check and its wake sources run on this pipeline's thread.
    /// Its checker wakers must also be finally dropped on that thread, even
    /// after the pipeline is dropped; foreign wakes or final drops panic.
    ///
    /// # Panics
    ///
    /// Panics if `.shutdown()` has been called. Unlike [`crate::Pipeline::poll_ready`],
    /// it does not return `Ready(Ok(()))` after shutdown.
    pub fn poll_ready(&self, cx: &mut Context<'_>, st: &St) -> Poll<Result<(), Err>>
    where
        St: Clone,
    {
        self.api.poll_ready(cx, st)
    }

    fn binding(&self) -> Binding<'_, St, Req, Res, Err> {
        Binding {
            idx: self.api.reg(),
            api: self.api.as_ref(),
        }
    }

    #[inline]
    /// Creates a binding that accepts state per call.
    ///
    /// The binding can be used to call the service.
    pub fn bind(&self) -> PipelineStateBinding<St, Req, Res, Err> {
        PipelineStateBinding {
            idx: self.api.reg(),
            api: self.api.clone(),
        }
    }

    #[inline]
    /// Creates a standard pipeline binding by attaching an owned state value.
    ///
    /// The binding can be used to call the service.
    pub fn bind_state(&self, st: St) -> PipelineBinding<Req, Res, Err>
    where
        St: Clone,
    {
        let internal = PipelineInternal {
            st,
            api: self.api.clone(),
        };

        PipelineBinding::with(self.api.reg(), PipelineApi::with(internal))
    }

    #[inline]
    /// Registers a callback for notifications reaching this pipeline's scope.
    ///
    /// Registration is shared by all bindings, regardless of their state, and
    /// persists until the scope is dropped. Repeated registration of the same
    /// handle is idempotent. The callback receives `0` for this root scope.
    /// See [`ReadyCallback`] for notification semantics.
    pub fn on_notify(&self, callback: &ReadyCallback) {
        self.api.scope().on_notify(callback);
    }

    #[inline]
    /// Registers this pipeline as a readiness dependency of the enclosing service.
    ///
    /// Call from [`Service::bind`] so changes to this pipeline's readiness also
    /// invalidate the enclosing scope. Repeated registration is idempotent and
    /// does not rebind the inner service or create another runtime handle.
    pub fn bind_to(&self, ctx: &BindCtx<'_>) {
        ctx.subscribe_pipeline(&self.readiness_link());
    }

    /// Returns this pipeline's readiness endpoint, shared by all state bindings.
    ///
    /// Register with [`BindCtx::subscribe_pipeline`]. The link propagates
    /// invalidation without checking readiness or retaining the pipeline.
    pub fn readiness_link(&self) -> ReadyLink {
        self.api.scope().readiness_link()
    }
}

impl<St, Req, Res, Err> Drop for PipelineState<St, Req, Res, Err> {
    #[inline]
    fn drop(&mut self) {
        self.api.unreg(0);
    }
}

struct Binding<'a, St, Req, Res, Err> {
    idx: u32,
    api: &'a dyn PipelineStateApi<St, Req, Res, Err>,
}

impl<St, Req, Res, Err> Drop for Binding<'_, St, Req, Res, Err> {
    #[inline]
    fn drop(&mut self) {
        self.api.unreg(self.idx);
    }
}

// ========================== `PipelineStateBinding` ===========================

/// An independently registered handle to a [`PipelineState`].
pub struct PipelineStateBinding<St, Req, Res, Err> {
    idx: u32,
    api: Rc<dyn PipelineStateApi<St, Req, Res, Err>>,
}

impl<St, Req, Res, Err> Drop for PipelineStateBinding<St, Req, Res, Err> {
    #[inline]
    fn drop(&mut self) {
        self.api.unreg(self.idx);
    }
}

impl<St, Req, Res, Err> Clone for PipelineStateBinding<St, Req, Res, Err> {
    #[inline]
    fn clone(&self) -> Self {
        PipelineStateBinding {
            idx: self.api.reg(),
            api: self.api.clone(),
        }
    }
}

impl<St, Req, Res, Err> PipelineStateBinding<St, Req, Res, Err>
where
    St: 'static,
    Req: 'static,
    Res: 'static,
    Err: 'static,
{
    #[inline]
    /// Waits for readiness, then calls the service with `st`.
    ///
    /// Reuses valid shared readiness without consuming it, regardless of `st`.
    pub async fn call(&self, req: Req, st: &St) -> Result<Res, Err> {
        let pl = Binding {
            idx: self.api.reg(),
            api: self.api.as_ref(),
        };
        pl.api.call(pl.idx, req, st).await
    }

    #[inline]
    /// Registers a callback on the shared pipeline scope, independently of state.
    ///
    /// The callback receives `0` for this root scope.
    /// Dropping this binding does not remove the registration.
    /// See [`PipelineState::on_notify`] and [`ReadyCallback`] for details.
    pub fn on_notify(&self, callback: &ReadyCallback) {
        self.api.scope().on_notify(callback);
    }

    #[inline]
    /// Registers this handle's pipeline as a readiness dependency.
    ///
    /// Call from [`Service::bind`]. See [`PipelineState::bind_to`] for details.
    pub fn bind_to(&self, ctx: &BindCtx<'_>) {
        ctx.subscribe_pipeline(&self.readiness_link());
    }

    /// Returns the shared pipeline's readiness endpoint.
    ///
    /// See [`PipelineState::readiness_link`] and [`ReadyLink`].
    pub fn readiness_link(&self) -> ReadyLink {
        self.api.scope().readiness_link()
    }
}

// ========================== `PipelineApi` ===========================

struct PipelineInternal<St, Req, Res, Err> {
    st: St,
    api: Rc<dyn PipelineStateApi<St, Req, Res, Err>>,
}

impl<St, Req, Res, Err> PipelineInternalApi<Req, Res, Err> for PipelineInternal<St, Req, Res, Err> {
    fn scope(&self) -> &ReadyScope {
        self.api.scope()
    }

    fn reg(&self) -> u32 {
        self.api.reg()
    }

    fn unreg(&self, idx: u32) {
        self.api.unreg(idx);
    }

    fn ready(&self, idx: u32) -> BoxFuture<'_, Result<(), Err>> {
        self.api.ready(idx, &self.st)
    }

    fn call(&self, idx: u32, req: Req) -> BoxFuture<'_, Result<Res, Err>> {
        self.api.call(idx, req, &self.st)
    }

    fn poll_ready(&self, _: &mut Context<'_>) -> Poll<Result<(), Err>> {
        unreachable!()
    }

    fn poll_shutdown(&self, _: &mut Context<'_>) -> Poll<()> {
        unreachable!()
    }

    fn is_shutdown(&self) -> bool {
        self.api.is_shutdown()
    }
}

// ========================== `PipelineStateApi` ===========================

struct PipelineInner<S, E> {
    s: S,
    w
```

### Core Architecture Module: `ntex-service/src/state.rs`
```
//! Requests that carry state for a service call.
//!
//! [`RequestState`] splits an input into `(state, request)`. Both the named
//! [`State<St, Req>`] wrapper and the tuple `(St, Req)` implement it, allowing
//! protocol boundaries to accept either representation.
//!
//! These types package data; they do not create a pipeline or automatically
//! change its state. After unpacking, the caller can pass the state to a
//! [`crate::pipeline::PipelineState`] operation or use it to construct a
//! [`crate::Pipeline`]. A service accesses the supplied state through
//! [`crate::Ctx::st`].
//!
//! # Example
//!
//! ```
//! use ntex_service::state::{RequestState, State};
//!
//! let input = State {
//!     state: "connection-1",
//!     req: 42,
//! };
//! let (state, request) = input.unpack();
//! assert_eq!(state, "connection-1");
//! assert_eq!(request, 42);
//!
//! assert_eq!(("connection-2", 7).unpack(), ("connection-2", 7));
//! ```
//!
//! # Framework guide
//!
//! See [Carrying state with a request](https://docs.ntex.rs/3-state.html#carrying-state-with-a-request).

/// A request that carries state for a service call.
pub trait RequestState<Req> {
    /// State extracted from the request.
    type State: 'static;

    /// Splits this value into its state and request components.
    fn unpack(self) -> (Self::State, Req);
}

/// A request paired with state for the duration of a service call.
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct State<St, Req> {
    /// Request passed to the service.
    pub req: Req,
    /// State made available while processing the request.
    pub state: St,
}

impl<Req, St: 'static> RequestState<Req> for State<St, Req> {
    type State = St;

    #[inline]
    fn unpack(self) -> (St, Req) {
        let State { state, req } = self;
        (state, req)
    }
}

impl<Req, St: 'static> RequestState<Req> for (St, Req) {
    type State = St;

    #[inline]
    fn unpack(self) -> (St, Req) {
        (self.0, self.1)
    }
}

```

### Core Architecture Module: `ntex-service/src/util.rs`
```
use std::{future::Future, future::poll_fn, pin, pin::Pin, task::Poll};

use crate::{Ctx, Service};

pub(crate) type BoxFuture<'a, R> = Pin<Box<dyn Future<Output = R> + 'a>>;

pub(crate) async fn shutdown<S, St, A, B, RA, RB>(svc1: &A, svc2: &B, ctx: Ctx<'_, S, St>)
where
    A: Service<St, RA>,
    B: Service<St, RB>,
{
    let mut fut1 = pin::pin!(ctx.shutdown(svc1));
    let mut fut2 = pin::pin!(ctx.shutdown(svc2));

    let mut ready1 = false;
    let mut ready2 = false;

    poll_fn(move |cx| {
        if !ready1 && Pin::new(&mut fut1).poll(cx).is_ready() {
            ready1 = true;
        }
        if !ready2 && Pin::new(&mut fut2).poll(cx).is_ready() {
            ready2 = true;
        }
        if ready1 && ready2 {
            Poll::Ready(())
        } else {
            Poll::Pending
        }
    })
    .await;
}

pub(crate) async fn ready<S, St, A, B, RA, RB>(
    svc1: &A,
    svc2: &B,
    ctx: Ctx<'_, S, St>,
) -> Result<(), A::Error>
where
    A: Service<St, RA>,
    B: Service<St, RB, Error = A::Error>,
{
    let mut fut1 = pin::pin!(Some(ctx.ready_generation(svc1)));
    let mut fut2 = pin::pin!(Some(ctx.ready_generation(svc2)));
    let scope = ctx.scope();
    let mut generation1 = scope.generation();
    let mut generation2 = scope.generation();

    poll_fn(|cx| {
        if is_idle(&mut fut1) && !scope.is_current(generation1) {
            fut1.set(Some(ctx.ready_generation(svc1)));
        }
        if let Some(fut) = fut1.as_mut().as_pin_mut()
            && let Poll::Ready(generation) = fut.poll(cx)?
        {
            generation1 = generation;
            fut1.set(None);
        }

        if is_idle(&mut fut2) && !scope.is_current(generation2) {
            fut2.set(Some(ctx.ready_generation(svc2)));
        }
        if let Some(fut) = fut2.as_mut().as_pin_mut()
            && let Poll::Ready(generation) = fut.poll(cx)?
        {
            generation2 = generation;
            fut2.set(None);
        }

        let current1 = scope.is_current(generation1);
        let current2 = scope.is_current(generation2);
        if is_idle(&mut fut1) && is_idle(&mut fut2) && current1 && current2 {
            Poll::Ready(Ok(()))
        } else {
            // A later poll or future drop can invalidate a completed sibling.
            // Retain pending work, but schedule another check for the dirty child.
            if (is_idle(&mut fut1) && !current1) || (is_idle(&mut fut2) && !current2) {
                cx.waker().wake_by_ref();
            }
            Poll::Pending
        }
    })
    .await
}

// `Option::is_none()` would take `&Option<F>`, which retags the whole future
// and invalidates borrows it holds into itself.
fn is_idle<F>(fut: &mut Pin<&mut Option<F>>) -> bool {
    fut.as_mut().as_pin_mut().is_none()
}

#[cfg(test)]
#[path = "../tests/unit/util.rs"]
pub(crate) mod tests;

```

### Core Architecture Module: `ntex-tls/src/utils.rs`
```
//! Handshake driving, timeout mapping, and metadata normalization shared by TLS backends.
#![allow(dead_code)]
use std::{future::Future, io};

use ntex_error::Error;
use ntex_io::{Io, types::HttpProtocol};
use ntex_net::connect::ConnectError;
use ntex_service::cfg::Cfg;
use ntex_util::time::{Millis, timeout_checked};

use crate::TlsConfig;

/// Runs a handshake with a deadline, preserving its original result.
///
/// Zero disables the deadline. Expiration drops the handshake future and returns
/// `TimedOut`; no separate background handshake is left running.
pub(crate) async fn with_timeout<R>(
    timeout: Millis,
    fut: impl Future<Output = io::Result<R>>,
) -> io::Result<R> {
    timeout_checked(timeout, fut).await.unwrap_or_else(|()| {
        Err(io::Error::new(
            io::ErrorKind::TimedOut,
            "TLS Handshake timeout",
        ))
    })
}

/// Runs a client handshake with timeout and configuration-scoped diagnostics.
///
/// Maps TLS and timeout errors into `ConnectError` and attaches the TLS service
/// identity. Transport establishment must already have completed.
pub(crate) async fn connect<R>(
    cfg: &Cfg<TlsConfig>,
    host: &str,
    fut: impl Future<Output = io::Result<R>>,
) -> Result<R, Error<ConnectError>> {
    log::trace!("{}: TLS Handshake start for: {host:?}", cfg.tag());
    match with_timeout(cfg.handshake_timeout(), fut).await {
        Ok(io) => {
            log::trace!("{}: TLS Handshake success: {host:?}", cfg.tag());
            Ok(io)
        }
        Err(e) => {
            log::trace!("{}: TLS Handshake error: {e:?}", cfg.tag());
            Err(Error::from(ConnectError::from(e)).with_service(cfg.service()))
        }
    }
}

/// Drives a handshake performed by the filter.
///
/// The filter processes handshake records as they are read and written,
/// `state` returns `true` while negotiation is in progress and `false` on success.
/// The callback must release backend state borrows before returning.
///
/// Flushes pending output before checking state, and attempts a full alert flush
/// before returning a reported handshake error. A read carrying EOF gets one
/// final state check because it may also contain the last handshake flight.
/// This helper imposes neither a timeout nor a handshake-capacity limit.
pub(crate) async fn handshake<F>(
    io: &Io<F>,
    state: impl Fn() -> io::Result<bool>,
) -> io::Result<()> {
    let mut eof = false;
    loop {
        io.flush(false).await?;
        match state() {
            Ok(true) => {}
            Ok(false) => return Ok(()),
            Err(err) => {
                // make sure the alert reaches the peer before the io is dropped
                let _ = io.flush(true).await;
                return Err(err);
            }
        }
        if eof {
            return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "disconnected"));
        }
        // The read that reports eof may also carry the peer's last handshake
        // flight, so the handshake state is checked once more before the eof
        // is treated as a failure.
        eof = io.read_notify().await?.is_none();
    }
}

/// Maps exactly `h2` to HTTP/2; absent or other ALPN values fall back to HTTP/1.
pub(crate) fn http_protocol(alpn: Option<&[u8]>) -> HttpProtocol {
    if alpn == Some(b"h2") {
        HttpProtocol::Http2
    } else {
        HttpProtocol::Http1
    }
}

/// Strips the port and IPv6 brackets from a connect host.
///
/// Accepts `host`, `host:port`, `[v6]`, `[v6]:port` and a bare `v6` address.
/// This is syntactic normalization, not hostname, port, or certificate validation.
pub(crate) fn server_name(host: &str) -> &str {
    if let Some(rest) = host.strip_prefix('[') {
        rest.split_once(']').map_or(host, |(ip, _)| ip)
    } else {
        match host.split_once(':') {
            Some((name, port)) if !port.contains(':') => name,
            _ => host,
        }
    }
}

#[cfg(test)]
pub(crate) mod testing {
    use std::{
        cell::{Cell, RefCell},
        pin::pin,
        rc::Rc,
        sync::Arc,
        task::{Context, Poll, Wake, Waker},
    };

    use ntex::codec::BytesCodec;
    use ntex_bytes::Bytes;
    use ntex_io::{Filter, Handle, IoContext, IoStream, Readiness};
    use ntex_service::cfg::SharedCfg;

    use super::*;

    thread_local! {
        static TLS_BORROWS: Cell<usize> = const { Cell::new(0) };
        static ON_WAKE: RefCell<Option<Box<dyn FnOnce()>>> = RefCell::default();
    }

    /// Tracks TLS reference scopes so a regression fails before reentrant
    /// shutdown could create an aliased mutable reference.
    pub(crate) struct TlsBorrow;

    impl TlsBorrow {
        pub(crate) fn new() -> Self {
            TLS_BORROWS.set(TLS_BORROWS.get() + 1);
            Self
        }
    }

    impl Drop for TlsBorrow {
        fn drop(&mut self) {
            TLS_BORROWS.set(TLS_BORROWS.get() - 1);
        }
    }

    struct InlineWake;

    impl Wake for InlineWake {
        fn wake(self: Arc<Self>) {
            let hook = ON_WAKE.with_borrow_mut(Option::take);
            if let Some(hook) = hook {
                hook();
            }
        }
    }

    struct Transport(Rc<RefCell<Option<IoContext>>>);

    impl IoStream for Transport {
        fn start(self, ctx: IoContext) -> Box<dyn Handle> {
            self.0.replace(Some(ctx));
            Box::new(self)
        }
    }

    impl Handle for Transport {}

    pub(crate) fn io(tag: &'static str) -> (Io, Rc<IoContext>) {
        let slot = Rc::new(RefCell::new(None));
        let io = Io::new(Transport(slot.clone()), SharedCfg::new(tag));
        let ctx = Rc::new(slot.take().unwrap());
        (io, ctx)
    }

    pub(crate) fn transfer(from: &IoContext, to: &IoContext) -> usize {
        let data = from.with_write_dst(|buf| {
            let mut data = Vec::new();
            while let Some(page) = buf.take() {
                data.extend_from_slice(&page);
            }
            data
        });
        if !data.is_empty() {
            from.update_write_status(Ok(data.len()));
            to.with_read_buf(|buf| {
                buf.extend_from_slice(&data);
                Poll::Ready(Ok(data.len()))
            });
        }
        data.len()
    }

    pub(crate) fn handshake<R>(
        future: impl Future<Output = R>,
        client: &IoContext,
        server: &IoContext,
    ) -> R {
        let mut future = pin!(future);
        let mut cx = Context::from_waker(Waker::noop());
        for _ in 0..32 {
            let result = future.as_mut().poll(&mut cx);
            transfer(client, server);
            transfer(server, client);
            if let Poll::Ready(result) = result {
                return result;
            }
        }
        panic!("TLS handshake stalled");
    }

    pub(crate) async fn peer_close<F: Filter, G: Filter>(
        sender: &Io<F>,
        sender_ctx: &IoContext,
        receiver: &Io<G>,
        receiver_ctx: &Rc<IoContext>,
    ) {
        let data = Bytes::from(vec![b'x'; 32 * 1024]);
        sender.encode(data.clone(), &BytesCodec).unwrap();
        receiver
            .encode(Bytes::from_static(b"pending reply"), &BytesCodec)
            .unwrap();
        sender.close();
        let mut cx = Context::from_waker(Waker::noop());
        let _ = sender_ctx.poll_read_ready(&mut cx);

        let waker = Waker::from(Arc::new(InlineWake));
        assert!(matches!(
            receiver_ctx.poll_read_ready(&mut Context::from_waker(&waker)),
            Poll::Ready(Readiness::Ready)
        ));
        let called = Rc::new(Cell::new(false));
        let called2 = called.clone();
        let ctx = receiver_ctx.clone();
        ON_WAKE.with_borrow_mut(|hook| {
            assert!(hook.is_none());
            *hook = Some(Box::new(move || {
                assert_eq!(
                    TLS_BORROWS.get(),
                    0,
                    "shutdown woke with TLS state borrowed"
                );
                let _ = ctx.poll_read_ready(&mut Context::from_waker(Waker::noop()));
                called2.set(true);
            }));
        });
        assert!(transfer(sender_ctx, receiver_ctx) > 0);
        ON_WAKE.with_borrow_mut(Option::take);
        assert!(called.get(), "peer close did not wake the read task");
        assert_eq!(receiver.decode(&BytesCodec).unwrap(), Some(data));

        // Shutdown must flush both queued application data and close_notify.
        assert!(transfer(receiver_ctx, sender_ctx) > 0);
        let _ = sender_ctx.poll_read_ready(&mut cx);
        assert_eq!(
            sender.decode(&BytesCodec).unwrap(),
            Some(Bytes::from_static(b"pending reply"))
        );
        // Let the runtime retire deferred write notifications after the drain.
        ntex_util::time::sleep(Millis(1)).await;
        for ctx in [sender_ctx, receiver_ctx.as_ref()] {
            ctx.update_write_status(Ok(0));
            let _ = ctx.poll_read_ready(&mut cx);
            let ready = ctx.poll_write_ready(&mut cx);
            assert!(
                matches!(ready, Poll::Ready(Readiness::Close)),
                "{}: {ready:?}, {:?}",
                ctx.tag(),
                ctx.flags()
            );
            ctx.stopped(None);
        }
        assert!(matches!(
            sender.poll_status_update(&mut cx),
            Poll::Ready(ntex_io::IoStatusUpdate::PeerGone(None))
        ));
        assert!(matches!(
            receiver.poll_status_update(&mut cx),
            Poll::Ready(ntex_io::IoStatusUpdate::PeerGone(None))
        ));
    }
}

#[cfg(test)]
mod tests {
    use std::{cell::Cell, pin::pin, task::Poll};

    use ntex_util::future::lazy;

    use super::*;

    /// STATEMENT: Clean transport EOF succeeds only if the final handshake state is complete.
    ///
    /// HOW:
    /// - Poll a handshake until it waits for input, then report EOF with completed or pending state.
    /// - Check completed negotiation succeeds and incomplete negotiati
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #130** (2022-07-14): **Fix transported protocol error on ping request**
  *Symptoms*: Pong response is being encoded as a transported binary message by WS filter
  **Post-Mortem & Fix Analysis**:
  > # [Codecov](https://codecov.io/gh/ntex-rs/ntex/pull/130?src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ntex-rs) Report > Merging [#130](https://codecov.io/gh/ntex-rs/ntex/pull/130?src=pr&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ntex-rs) (2091e0f) into [master](https://codecov.io/gh/ntex-rs/ntex/commit/d808574b97b09b4ebb7e143603668ae192baaeee?el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ntex-rs) (d808574) will **increase** coverage by `0.04%`. > The diff coverage is `0.00%`.  ```diff @@            Coverage Diff             @@ ##           master     #130      +/-   ## ========================================== + Coverage   86.88%   86.92%   +0.04%      ==========================================   Files         187      187                 Lines       21404    21404               =======================================
  > thanks. i made new release

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

### Incident Patch 1: `4a00b916` (2026-11-02)
**Commit Message**: Add test cert gen utility, update tests

**File**: `.github/workflows/cov.yml` (modified, +0/-2)
```diff
@@ -4,8 +4,6 @@ on:
   push:
     branches:
       - main
-    tags:
-      - '**'
   pull_request:
 
 jobs:
```

**File**: `.github/workflows/docs.yml` (modified, +0/-2)
```diff
@@ -4,8 +4,6 @@ on:
   push:
     branches:
       - main
-    tags:
-      - '**'
   pull_request:
 
 permissions:
```

**File**: `.github/workflows/miri.yml` (modified, +0/-2)
```diff
@@ -4,8 +4,6 @@ on:
   push:
     branches:
       - main
-    tags:
-      - '**'
   pull_request:
 
 jobs:
```

**File**: `.github/workflows/windows.yml` (modified, +15/-0)
```diff
@@ -80,6 +80,21 @@ jobs:
           Get-ChildItem C:\vcpkg\installed\x64-windows\bin
           Get-ChildItem C:\vcpkg\installed\x64-windows\lib
 
+      - name: Install SymCrypt
+        shell: pwsh
+        run: |
+          $archive = Join-Path $env:RUNNER_TEMP "symcrypt.zip"
+          $symcrypt = Join-Path $env:RUNNER_TEMP "symcrypt"
+          Invoke-WebRequest -Uri "https://github.com/microsoft/SymCrypt/releases/download/v103.13.0/symcrypt-windows-amd64-release-103.13.0-286762b7.zip" -OutFile $archive
+          $expected = "90ea7631331d23a43e0abc7f7af89b44bda67cfa183a70a8b76d988d9d3036b8"
+          if ((Get-FileHash -Path $archive -Algorithm SHA256).Hash -ne $expected) {
+            throw "SymCrypt archive checksum mismatch"
+          }
+          Expand-Archive -Path $archive -DestinationPath $symcrypt
+          $lib = Join-Path $symcrypt "dll"
+          "SYMCRYPT_LIB_PATH=$lib" >> $env:GITHUB_ENV
+          $lib >> $env:GITHUB_PATH
+
       - name: Clippy (neon)
         if: matrix.version == 'stable'
         run: |
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -77,11 +77,11 @@ atoi_simd = "0.18.1"
 backtrace = "0.3.76"
 bytes = "1.11.0"
 bincode = "1.3.3"
-base64 = "0.22"
-base64-simd = "0.8"
+base64 = "0.23"
 hex = "0.4"
 symcrypt = { version = "0.5", features = ["sha1"] }
 x509-parser = "0.18"
+rcgen = { version = "0.14", default-features = false }
 zeroize = "1"
 coo-kie = { version = "0.18", package = "cookie" }
 bitflags = "2"
```

**File**: `ntex-rt/tests/unit/pool.rs` (modified, +2/-2)
```diff
@@ -192,7 +192,7 @@ fn metrics() {
 #[test]
 fn dropped_pool_releases_workers() {
     // the idle timeout is never reached, workers exit on disconnection
-    let pool = ThreadPool::new("test", 1, Duration::from_secs(60));
+    let pool = ThreadPool::new("test", 1, Duration::from_mins(1));
     let counter = pool.counter.clone();
     let (start_tx, start_rx) = std::sync::mpsc::channel();
     let (release_tx, release_rx) = std::sync::mpsc::channel::<()>();
@@ -228,7 +228,7 @@ fn result_drop_panic_keeps_worker() {
         }
     }
 
-    let pool = ThreadPool::new("test", 1, Duration::from_secs(60));
+    let pool = ThreadPool::new("test", 1, Duration::from_mins(1));
     let (start_tx, start_rx) = std::sync::mpsc::channel();
     let (release_tx, release_rx) = std::sync::mpsc::channel::<()>();
     let first = pool.execute(move || {
```

**File**: `ntex-tls/CHANGES.md` (modified, +4/-0)
```diff
@@ -14,6 +14,10 @@
   adapters. PKCS#12 uses native Windows import or requires `openssl` on Unix,
   even when rustls handles trust. Native keys remain non-exportable.
 
+* Add `testgen` feature with public `x509::testgen` test certificate generators
+  (CNG/Crypt32 on Windows, OpenSSL on Unix), and `testgen-rcgen` feature with an
+  `rcgen` backend for rustls-only builds
+
 * Rustls X.509 uses an installed crypto provider (or the explicit `rustls-ring`
   fallback), with independent SHA-1/SHA-256 thumbprint hashing. WebPKI enforces
   client-auth EKU and rejects verification times before 1970; anchor validity,
```

**File**: `ntex-tls/Cargo.toml` (modified, +11/-2)
```diff
@@ -32,6 +32,13 @@ rustls-ring = ["rustls", "tls_rustls/ring"]
 # Requires OpenSSL, rustls, or the native Windows backend.
 x509 = []
 
+# Public test certificate generators (`x509::testgen`) using the native Windows backend
+# or OpenSSL on Unix.
+testgen = ["x509"]
+
+# `rcgen` backend for `testgen`, required on Unix builds without `openssl`.
+testgen-rcgen = ["testgen", "dep:rcgen"]
+
 # Windows Schannel support (always compiled on Windows, kept for compatibility)
 schannel = []
 
@@ -57,14 +64,15 @@ tls_rustls = { workspace = true, optional = true }
 rustls-webpki = { workspace = true, optional = true }
 
 # x509
-base64-simd = { workspace = true }
+base64 = { workspace = true }
 hex = { workspace = true }
 x509-parser = { workspace = true }
 zeroize = { workspace = true }
 
 [target.'cfg(not(windows))'.dependencies]
 sha1 = { workspace = true, optional = true }
 sha2 = { workspace = true, optional = true }
+rcgen = { workspace = true, optional = true, features = ["ring"] }
 
 [target.'cfg(windows)'.dependencies]
 symcrypt = { workspace = true }
@@ -82,9 +90,10 @@ ntex = { workspace = true }
 env_logger = { workspace = true }
 rustls-pemfile = { workspace = true }
 webpki-roots = { workspace = true }
+tls_rustls = { workspace = true, features = ["ring", "std", "tls12"] }
 
 [target.'cfg(not(windows))'.dev-dependencies]
-tls_rustls = { workspace = true, features = ["ring", "std", "tls12"] }
+rcgen = { workspace = true, features = ["ring"] }
 
 [[example]]
 name = "server"
```

---

### Incident Patch 2: `84b4d782` (2026-11-02)
**Commit Message**: Add public `x509` module: certificate parsing, thumbprints, peer certificates, CA trust verification (`CaCerts`), identity loading

**File**: `Cargo.toml` (modified, +9/-1)
```diff
@@ -62,7 +62,7 @@ ntex-router = "2.1.0"
 ntex-rt = "4.5.1"
 ntex-server = "4.3.2"
 ntex-service = "5.5.0"
-ntex-tls = "4.6.0"
+ntex-tls = "4.7.0"
 ntex-util = "4.5.1"
 urly = "1.2.0"
 
@@ -78,6 +78,11 @@ backtrace = "0.3.76"
 bytes = "1.11.0"
 bincode = "1.3.3"
 base64 = "0.22"
+base64-simd = "0.8"
+hex = "0.4"
+symcrypt = { version = "0.5", features = ["sha1"] }
+x509-parser = "0.18"
+zeroize = "1"
 coo-kie = { version = "0.18", package = "cookie" }
 bitflags = "2"
 cfg-if = "1.0.0"
@@ -114,6 +119,7 @@ quote = "1.0.43"
 rand = "0.9"
 regex = { version = "1.11", default-features = false, features = ["std"] }
 rustls-pemfile = "2"
+rustls-webpki = { version = "0.103", default-features = false, features = ["std"] }
 tls_rustls = { version = "0.23", package = "rustls", default-features = false }
 scoped-tls = "1.0.1"
 serde = { version = "1", features = ["derive"] }
@@ -122,6 +128,8 @@ serde_test = "1.0"
 serde_derive = "1.0"
 serde_urlencoded = "0.7"
 signal-hook = "0.4.4"
+sha1 = "0.10"
+sha2 = "0.10"
 simdutf8 = "0.1.5"
 slab = "0.4.9"
 socket2 = "0.6.1"
```

**File**: `ntex-tls/CHANGES.md` (modified, +22/-0)
```diff
@@ -1,5 +1,27 @@
 # Changes
 
+## [4.7.0] - Unreleased
+
+* Add public `x509` module: certificate parsing, thumbprints,
+  peer certificates, CA trust verification (`CaCerts`), identity loading and
+  client identities, backed by Crypt32/CNG/SymCrypt on Windows and otherwise
+  rustls/WebPKI or OpenSSL according to enabled features
+
+* Enable `x509` automatically with either TLS backend or on Windows; explicit
+  `x509` without a backend is an error.
+
+* Add portable PEM/DER PKCS#8 identity loading, opaque signing keys and TLS
+  adapters. PKCS#12 uses native Windows import or requires `openssl` on Unix,
+  even when rustls handles trust. Native keys remain non-exportable.
+
+* Rustls X.509 uses an installed crypto provider (or the explicit `rustls-ring`
+  fallback), with independent SHA-1/SHA-256 thumbprint hashing. WebPKI enforces
+  client-auth EKU and rejects verification times before 1970; anchor validity,
+  exact leaf pinning and verified-path expiry are preserved.
+
+* `schannel` module is always compiled on Windows, the `schannel` feature is
+  kept for compatibility
+
 ## [4.6.0] - 2026-11-01
 
 * `PeerCertDer` and `PskIdentity` hold `Bytes`, `PeerCertChainDer` holds
```

**File**: `ntex-tls/Cargo.toml` (modified, +51/-9)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "ntex-tls"
-version = "4.6.0"
+version = "4.7.0"
 authors = ["ntex contributors <team@ntex.rs>"]
 description = "An implementation of SSL streams for ntex backed by OpenSSL"
 keywords = ["network", "framework", "async", "futures"]
@@ -23,14 +23,17 @@ workspace = true
 default = []
 
 # openssl
-openssl = ["tls_openssl", "openssl-sys", "foreign-types-shared"]
+openssl = ["x509", "dep:tls_openssl", "dep:openssl-sys", "dep:foreign-types-shared", "dep:libc", "ntex/openssl"]
 
 # rustls support
-rustls = ["tls_rustls", "tls_rustls/std"]
-rustls-ring = ["tls_rustls", "tls_rustls/ring", "tls_rustls/std"]
+rustls = ["x509", "dep:tls_rustls", "tls_rustls/std", "dep:rustls-webpki", "dep:sha1", "dep:sha2", "ntex/rustls"]
+rustls-ring = ["rustls", "tls_rustls/ring"]
 
-# Windows Schannel support
-schannel = ["windows-sys"]
+# Requires OpenSSL, rustls, or the native Windows backend.
+x509 = []
+
+# Windows Schannel support (always compiled on Windows, kept for compatibility)
+schannel = []
 
 [dependencies]
 ntex-bytes = { workspace = true }
@@ -47,12 +50,25 @@ thiserror = { workspace = true }
 tls_openssl = { workspace = true, optional = true }
 openssl-sys = { workspace = true, optional = true }
 foreign-types-shared = { workspace = true, optional = true }
+libc = { workspace = true, optional = true }
 
 # rustls
 tls_rustls = { workspace = true, optional = true }
+rustls-webpki = { workspace = true, optional = true }
+
+# x509
+base64-simd = { workspace = true }
+hex = { workspace = true }
+x509-parser = { workspace = true }
+zeroize = { workspace = true }
 
-# Windows Schannel
-windows-sys = { workspace = true, optional = true, features = [
+[target.'cfg(not(windows))'.dependencies]
+sha1 = { workspace = true, optional = true }
+sha2 = { workspace = true, optional = true }
+
+[target.'cfg(windows)'.dependencies]
+symcrypt = { workspace = true }
+windows-sys = { workspace = true, features = [
     "Win32_Foundation",
     "Win32_Security_Authentication_Identity",
     "Win32_Security_Credentials",
@@ -62,12 +78,38 @@ windows-sys = { workspace = true, optional = true, features = [
 ] }
 
 [dev-dependencies]
-ntex = { workspace = true, features = ["openssl", "rustls"] }
+ntex = { workspace = true }
 env_logger = { workspace = true }
 rustls-pemfile = { workspace = true }
 webpki-roots = { workspace = true }
+
+[target.'cfg(not(windows))'.dev-dependencies]
 tls_rustls = { workspace = true, features = ["ring", "std", "tls12"] }
 
+[[example]]
+name = "server"
+required-features = ["openssl"]
+
+[[example]]
+name = "simple-client"
+required-features = ["openssl"]
+
+[[example]]
+name = "webserver"
+required-features = ["openssl"]
+
+[[example]]
+name = "webclient"
+required-features = ["openssl"]
+
+[[example]]
+name = "rustls-server"
+required-features = ["rustls"]
+
+[[example]]
+name = "rustls-client"
+required-features = ["rustls"]
+
 [[example]]
 name = "schannel-client"
 required-features = ["schannel"]
```

**File**: `ntex-tls/src/lib.rs` (modified, +19/-4)
```diff
@@ -11,9 +11,15 @@
 //! - `openssl` exposes OpenSSL acceptors, connectors, and a bidirectional filter.
 //! - `rustls` exposes rustls acceptors, connectors, and client/server filters.
 //!   Supply a crypto provider through rustls configuration; `rustls-ring` enables
-//!   its ring provider and is intended to be used together with `rustls`.
-//! - `schannel` exposes Windows Schannel support on Windows. Protocols, cipher
-//!   suites, and trust defaults depend on the operating system.
+//!   its ring provider and also enables `rustls`.
+//! - `schannel` is kept for compatibility; Windows Schannel support is always
+//!   compiled on Windows (required by `x509`). Protocols, cipher suites, and
+//!   trust defaults depend on the operating system.
+//!
+//! The `x509` module (certificate parsing, trust verification, identities) is
+//! enabled by either TLS feature and always available on Windows. Windows uses
+//! Crypt32/CNG/SymCrypt; elsewhere rustls takes precedence over OpenSSL.
+//! Explicitly enabling `x509` without a backend is an error.
 //!
 //! Certificate verification, identities, and ALPN are configured through the
 //! selected backend. [`TlsConfig`] controls service handshake timeouts, while
@@ -59,9 +65,18 @@ pub mod openssl;
 #[cfg(feature = "rustls")]
 pub mod rustls;
 
-#[cfg(all(windows, feature = "schannel"))]
+#[cfg(windows)]
 pub mod schannel;
 
+#[cfg(all(
+    feature = "x509",
+    not(any(windows, feature = "openssl", feature = "rustls"))
+))]
+compile_error!("ntex-tls x509 requires the openssl or rustls feature outside Windows");
+
+#[cfg(any(windows, feature = "openssl", feature = "rustls"))]
+pub mod x509;
+
 use ntex_util::services::Counter;
 
 /// Shared timeout configuration for TLS services.
```

**File**: `ntex-tls/src/openssl/mod.rs` (modified, +30/-0)
```diff
@@ -30,6 +30,36 @@ pub use self::accept::SslAcceptor;
 mod alloc;
 pub use self::alloc::use_global_allocator;
 
+/// Configures a fresh OpenSSL context with a portable identity and ordered intermediates.
+///
+/// This does not change peer verification policy or include the self-signed root.
+///
+/// # Errors
+/// Native non-exportable keys are unsupported. Other errors report chain ordering,
+/// key/certificate decoding, or OpenSSL configuration failures.
+pub fn set_identity(
+    context: &mut ssl::SslContextBuilder,
+    identity: &crate::x509::Identity,
+) -> Result<(), crate::x509::Error> {
+    use crate::x509::Error;
+    let invalid = |e: tls_openssl::error::ErrorStack| Error::InvalidIdentity(e.to_string());
+    let key =
+        tls_openssl::pkey::PKey::private_key_from_pkcs8(identity.private_key().export_pkcs8_der()?)
+            .map_err(invalid)?;
+    let cert = X509::from_der(identity.cert().der()).map_err(invalid)?;
+    let chain = identity
+        .ordered_chain(false)?
+        .iter()
+        .map(|cert| X509::from_der(cert.der()).map_err(invalid))
+        .collect::<Result<Vec<_>, _>>()?;
+    context.set_certificate(&cert).map_err(invalid)?;
+    context.set_private_key(&key).map_err(invalid)?;
+    for cert in chain {
+        context.add_extra_chain_cert(cert).map_err(invalid)?;
+    }
+    context.check_private_key().map_err(invalid)
+}
+
 /// The peer's end-entity certificate as an owned OpenSSL reference.
 ///
 /// The query returns no value if the peer did not supply a certificate.
```

**File**: `ntex-tls/src/rustls/identity.rs` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+//! Adapters from portable identities to rustls signing keys, including opaque CNG keys.
+use tls_rustls::pki_types::CertificateDer;
+use tls_rustls::sign::CertifiedKey;
+
+use crate::x509::{ClientIdentity, Error, Identity};
+
+/// Packages an identity for a rustls client/server certificate resolver.
+///
+/// The chain is ordered and excludes the self-signed root. Native keys sign in place.
+///
+/// # Errors
+/// See [`Identity::ordered_chain`].
+pub fn certified_key(identity: &Identity) -> Result<CertifiedKey, Error> {
+    let client = ClientIdentity::from_identity(identity.clone())?;
+    Ok(client_certified_key(&client))
+}
+
+/// Packages an already ordered client identity for a rustls certificate resolver.
+///
+/// On Windows the adapter retains the native key owner; no private key is exported.
+#[must_use]
+pub fn client_certified_key(identity: &ClientIdentity) -> CertifiedKey {
+    let chain = identity
+        .chain()
+        .iter()
+        .map(|cert| CertificateDer::from(cert.der().to_vec()))
+        .collect();
+    #[cfg(not(windows))]
+    let key = identity.private_key().signing_key.clone();
+    #[cfg(windows)]
+    let key = std::sync::Arc::new(NativeKey(identity.private_key().clone()));
+    CertifiedKey::new(chain, key)
+}
+
+#[cfg(windows)]
+#[derive(Debug)]
+struct NativeKey(crate::x509::PrivateKey);
+
+#[cfg(windows)]
+impl tls_rustls::sign::SigningKey for NativeKey {
+    fn choose_scheme(
+        &self,
+        offered: &[tls_rustls::SignatureScheme],
+    ) -> Option<Box<dyn tls_rustls::sign::Signer>> {
+        use crate::x509::{HashAlg as H, KeyType as K, SignScheme as S};
+        let schemes: &[S] = match self.0.key_type()? {
+            K::Rsa => &[
+                S::RsaPss(H::Sha256),
+                S::RsaPss(H::Sha384),
+                S::RsaPss(H::Sha512),
+                S::RsaPkcs1(H::Sha256),
+                S::RsaPkcs1(H::Sha384),
+                S::RsaPkcs1(H::Sha512),
+            ],
+            K::EcP256 => &[S::Ecdsa(H::Sha256)],
+            K::EcP384 => &[S::Ecdsa(H::Sha384)],
+            K::EcP521 => &[S::Ecdsa(H::Sha512)],
+        };
+        let scheme = schemes
+            .iter()
+            .find(|scheme| offered.contains(&scheme.rustls()))?;
+        Some(Box::new(NativeSigner {
+            key: self.0.clone(),
+            scheme: *scheme,
+        }))
+    }
+
+    fn public_key(&self) -> Option<tls_rustls::pki_types::SubjectPublicKeyInfoDer<'_>> {
+        Some(self.0.public_key_der().into())
+    }
+
+    fn algorithm(&self) -> tls_rustls::SignatureAlgorithm {
+        if self.0.key_type() == Some(crate::x509::KeyType::Rsa) {
+            tls_rustls::SignatureAlgorithm::RSA
+        } else {
+            tls_rustls::SignatureAlgorithm::ECDSA
+        }
+    }
+}
+
+#[cfg(windows)]
+#[derive(Debug)]
+struct NativeSigner {
+    key: crate::x509::PrivateKey,
+    scheme: crate::x509::SignScheme,
+}
+
+#[cfg(windows)]
+impl tls_rustls::sign::Signer for NativeSigner {
+    fn sign(&self, message: &[u8]) -> Result<Vec<u8>, tls_rustls::Error> {
+        self.key
+            .sign(self.scheme, message)
+            .map_err(|e| tls_rustls::Error::General(e.to_string()))
+    }
+
+    fn scheme(&self) -> tls_rustls::SignatureScheme {
+        self.scheme.rustls()
+    }
+}
```

**File**: `ntex-tls/src/rustls/mod.rs` (modified, +2/-0)
```diff
@@ -19,12 +19,14 @@ use tls_rustls::pki_types::CertificateDer;
 mod accept;
 mod client;
 mod connect;
+mod identity;
 mod server;
 mod stream;
 
 pub use self::accept::TlsAcceptor;
 pub use self::client::TlsClientFilter;
 pub use self::connect::TlsConnector;
+pub use self::identity::{certified_key, client_certified_key};
 pub use self::server::TlsServerFilter;
 
 use self::stream::Stream;
```

**File**: `ntex-tls/src/schannel/cert.rs` (modified, +62/-3)
```diff
@@ -230,7 +230,7 @@ impl Certificate {
     /// Borrows the context pointer without transferring a Windows reference.
     ///
     /// Callers must keep an owning certificate alive while using the pointer.
-    pub(super) fn as_ptr(&self) -> *const CERT_CONTEXT {
+    pub(crate) fn as_ptr(&self) -> *const CERT_CONTEXT {
         self.0.cert
     }
 
@@ -239,6 +239,61 @@ impl Certificate {
     pub(super) fn from_context(cert: *const CERT_CONTEXT) -> Self {
         Self(Arc::new(CertContext::new(cert)))
     }
+
+    /// Imports a previously matched PKCS#8 key and leaf-first certificates for Schannel.
+    ///
+    /// The caller checks certificate/key correspondence before this creates a persisted key.
+    pub(crate) fn from_pkcs8(
+        certificates: &[crate::x509::Certificate],
+        key: &[u8],
+    ) -> io::Result<Self> {
+        use windows_sys::Win32::Security::Cryptography::{
+            CERT_STORE_ADD_ALWAYS, CERT_STORE_CREATE_NEW_FLAG, CERT_STORE_PROV_MEMORY,
+            CertAddEncodedCertificateToStore,
+        };
+        // SAFETY: the memory-store provider takes no additional parameters.
+        let store = unsafe {
+            CertOpenStore(
+                CERT_STORE_PROV_MEMORY,
+                0,
+                0,
+                CERT_STORE_CREATE_NEW_FLAG,
+                ptr::null(),
+            )
+        };
+        if store.is_null() {
+            return Err(io::Error::last_os_error());
+        }
+        let store = Store(store);
+        let mut leaf = None;
+        for cert in certificates {
+            let mut context = ptr::null_mut();
+            let len = u32::try_from(cert.der().len())
+                .map_err(|_| io::Error::other("certificate is too large"))?;
+            // SAFETY: the input is readable; the returned context owns a store reference.
+            if unsafe {
+                CertAddEncodedCertificateToStore(
+                    store.0,
+                    X509_ASN_ENCODING,
+                    cert.der().as_ptr(),
+                    len,
+                    CERT_STORE_ADD_ALWAYS,
+                    &raw mut context,
+                )
+            } == 0
+            {
+                return Err(io::Error::last_os_error());
+            }
+            let context = CertContext::new(context);
+            if leaf.is_none() {
+                leaf = Some(context);
+            }
+        }
+        let mut cert = leaf.ok_or_else(|| io::Error::other("certificate is missing"))?;
+        persist_pkcs8(cert.cert, key)?;
+        cert.temp_key = true;
+        Ok(Self(Arc::new(cert)))
+    }
 }
 
 impl fmt::Debug for Certificate {
@@ -291,7 +346,11 @@ impl Drop for CertContext {
 /// deletion of the new key is attempted before returning the original error.
 fn persist_key(cert: *const CERT_CONTEXT) -> io::Result<()> {
     let pkcs8 = export_key(cert)?;
+    persist_pkcs8(cert, &pkcs8.0)
+}
 
+/// Persists supplied PKCS#8 bytes under an isolated name and attaches the key to `cert`.
+fn persist_pkcs8(cert: *const CERT_CONTEXT, pkcs8: &[u8]) -> io::Result<()> {
     let mut id = [0u8; 16];
     let status =
         unsafe { BCryptGenRandom(0 as _, id.as_mut_ptr(), 16, BCRYPT_USE_SYSTEM_PREFERRED_RNG) };
@@ -324,8 +383,8 @@ fn persist_key(cert: *const CERT_CONTEXT) -> io::Result<()> {
             NCRYPT_PKCS8_PRIVATE_KEY_BLOB,
             &raw const params,
             &raw mut key,
-            pkcs8.0.as_ptr(),
-            u32::try_from(pkcs8.0.len()).expect("key blob fits u32"),
+            pkcs8.as_ptr(),
+            u32::try_from(pkcs8.len()).map_err(|_| io::Error::other("private key is too large"))?,
             NCRYPT_SILENT_FLAG,
         )
     })?;
```

#### Recent Merged Pull Requests:
- **PR #1171** (2026-11-02): Add public `x509` module: certificate parsing, thumbprints, peer certificates, CA trust verification (`CaCerts`), identity loading (@fafhrd91)
- **PR #1170** (2026-11-01): Add QueryItem::into_inner() to take ownership of the query result (@fafhrd91)
- **PR #1169** (2026-11-01): Update tls api docs (@fafhrd91)
- **PR #1168** (2026-11-01): Add TlsVersion and TlsCipher queries (@fafhrd91)
- **PR #1167** (2026-10-31): web: Make request-target validation and normalization opt-in (@fafhrd91)
- **PR #1166** (2026-10-31): Http readiness (@fafhrd91)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
