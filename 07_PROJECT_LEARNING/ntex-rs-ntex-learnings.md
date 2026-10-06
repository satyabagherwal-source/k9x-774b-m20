# Forensic Learning Record (Deep Inspection): ntex-rs/ntex

> **Canonical Artifact**: `07_PROJECT_LEARNING/ntex-rs-ntex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ntex-rs/ntex](https://github.com/ntex-rs/ntex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:58:37.409Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ntex-rs/ntex`
- **Description**: framework for composable networking services 
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2540 stars

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

### Core Architecture Module: `ntex-io/src/utils.rs`
```
use std::cell::Cell;
use std::io;
use std::task::{Context, Poll, Waker};

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

pub(crate) struct Extensions(Cell<Option<Box<ExtensionsInner>>>);

#[derive(Default)]
pub(crate) struct ExtensionsInner {
    // tasks waiting for io events, by tag
    waiters: Waiters,
    // filter callbacks registered for io events
    pub(crate) callbacks: Option<Box<dyn IoCallbacks>>,
}

impl Default for Extensions {
    fn default() -> Extensions {
        Extensions(Cell::new(None))
    }
}

impl Extensions {
    fn with<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&mut ExtensionsInner) -> R,
    {
        let mut inner = if let Some(inner) = self.0.take() {
            inner
        } else {
            Box::new(ExtensionsInner::default())
        };
        let result = f(&mut inner);
        self.0.set(Some(inner));
        result
    }

    fn with_opt<F>(&self, f: F)
    where
        F: FnOnce(&mut ExtensionsInner),
    {
        if let Some(mut inner) = self.0.take() {
            f(&mut inner);
            self.0.set(Some(inner));
        }
    }

    /// Registers the waker of the waiter, a woken waiter gets a new entry.
    pub(super) fn register_waker(&self, waiter: &WaiterEntry, waker: &Waker) {
        self.with(|inner| {
            let waiters = &mut inner.waiters;
            if !waiter.id.get().is_some_and(|id| waiters.update(id, waker)) {
                waiter.id.set(Some(waiters.register(waiter.tag, waker)));
            }
        });
    }

    /// Registers the waiter, or reports that its registration was woken.
    ///
    /// A reported wake clears the registration, the next poll registers again.
    pub(super) fn poll_waker(&self, waiter: &WaiterEntry, waker: &Waker) -> Poll<()> {
        self.with(|inner| {
            let waiters = &mut inner.waiters;
            match waiter.id.get() {
                None => {
                    waiter.id.set(Some(waiters.register(waiter.tag, waker)));
                    Poll::Pending
                }
                Some(id) if waiters.update(id, waker) => Poll::Pending,
                Some(_) => {
                    waiter.id.set(None);
                    Poll::Ready(())
                }
            }
        })
    }

    /// Removes the waiter entry unless it is woken.
    pub(super) fn remove_waker(&self, waiter: &WaiterEntry) {
        if let Some(id) = waiter.id.take() {
            self.with_opt(|inner| inner.waiters.remove(id, waiter.tag));
        }
    }

    /// Wakes and removes all wakers of the tag.
    pub(super) fn wake(&self, tag: usize) {
        self.with_opt(|inner| inner.waiters.wake(tag));
    }

    /// Wakes and removes all wakers.
    pub(super) fn wake_all(&self) {
        self.with_opt(|inner| inner.waiters.wake_all());
    }

    #[cfg(test)]
    pub(super) fn wakers_len(&self) -> usize {
        let mut len = 0;
        self.with_opt(|inner| len = inner.waiters.len());
        len
    }

    pub(super) fn register_filter_callbacks<T: IoCallbacks + 'static>(&self, cb: T) {
        self.with(|inner| {
            inner.callbacks = Some(Box::new(cb));
        });
    }

    pub(super) fn take_callbacks(&self) -> Option<Box<dyn IoCallbacks>> {
        let mut callbacks = None;
        self.with_opt(|inner| callbacks = inner.callbacks.take());
        callbacks
    }

    pub(crate) fn with_callbacks<F>(&self, f: F)
    where
        F: FnOnce(&dyn IoCallbacks),
    {
        self.with_opt(|inner| {
            if let Some(ref cb) = inner.callbacks {
                f(cb.as_ref());
            }
        });
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
    use ntex_bytes::BytePageSize;
    use ntex_service::cfg::SharedCfg;

    use super::*;
    use crate::{Sealed, buf::Stack, filter::NullFilter, testing::IoTest};

    #[ntex::test]
    async fn test_null_filter() {
        let (_, server) = IoTest::create();
        let io = Io::new(server, SharedCfg::default());
        let ioref = io.get_ref();
        let stack = Stack::new(BytePageSize::Size16);
        assert!(NullFilter.query(std::any::TypeId::of::<()>()).is_none());
        assert!(
            stack
                .with_filter(&ioref, |ctx| NullFilter.shutdown(ctx))
                .unwrap()
                .is_ready()
        );
        // The chain is gone, so the transport closes the connection
        // gracefully. `IoContext` escalates to `Terminate` when the connection
        // was force-closed; `NullFilter` itself cannot see that state.
        assert_eq!(
            std::future::poll_fn(|cx| NullFilter.poll_read_ready(cx)).await,
            crate::Readiness::Close
        );
        assert_eq!(
            std::future::poll_fn(|cx| NullFilter.poll_write_ready(cx)).await,
            crate::Readiness::Close
        );
        assert!(
            stack
                .with_filter(&ioref, |ctx| NullFilter.process_write_buf(ctx))
                .is_ok()
        );
        assert_eq!(
            stack.with_filter(&ioref, |ctx| NullFilter.process_read_buf(ctx).unwrap()),
            ()
        );
    }

    #[ntex::test]
    async fn request_state_unpack() {
        use ntex_service::state::{RequestState, State};

        let (_, server) = IoTest::create();
        let io = Io::from(server);
        let id = io.id();

        let ((), io) = <Io as RequestState<Io>>::unpack(io);
        assert_eq!(io.id(), id);
        let ((), io) = <Io as RequestState<IoBoxed>>::unpack(io);
        assert_eq!(io.id(), id);
        let ((), mut io) = <IoBoxed as RequestState<IoBoxed>>::unpack(io);
        assert_eq!(io.id(), id);

        let st = State {
            req: Io::<Sealed>::from(io.take()),
            state: 10u32,
        };
        let (state, io) = <_ as RequestState<IoBoxed>>::unpack(st);
        assert_eq!(state, 10);
        assert_eq!(io.id(), id);
    }
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

    #[inline]
    async fn call(&self, req: Req, ctx: Ctx<'_, Self, OtSt>) -> Result<S::Res, S::Error> {
        ctx.map_state(&self.st).call(&self.s, req).await
    }

    #[inline]
    async fn ready(&self, ctx: Ctx<'_, Self, OtSt>) -> Result<(), S::Error> {
        ctx.map_state(&self.st).ready(&self.s).await
    }

    #[inline]
    async fn shutdown(&self, ctx: Ctx<'_, Self, OtSt>) {
        ctx.map_state(&self.st).shutdown(&self.s).await;
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
mod tests {
    use crate::{Pipeline, ServiceFactory, fn_service_st, map_state, map_state_factory};

    #[ntex::test]
    async fn test_map_state() {
        let svc = map_state(
            100,
            fn_service_st(|_: &usize, item: usize| async move { Ok::<_, ()>(item) }),
        )
        .clone();
        let _ = format!("{svc:?}");

        let svc = Pipeline::new((), svc);
        assert_eq!(svc.call(1).await.unwrap(), 1);
        assert!(!svc.is_shutdown());
        svc.shutdown().await;
        assert!(svc.is_shutdown());

        let factory = map_state_factory(
            100,
            fn_service_st(|_: &usize, item: usize| async move { Ok::<_, ()>(item) }),
        )
        .clone();
        let _ = format!("{factory:?}");

        let svc = Pipeline::new((), factory.create(&1).await.unwrap());
        assert_eq!(svc.call(1).await.unwrap(), 1);
    }
}

```

### Core Architecture Module: `ntex-service/src/pl_state.rs`
```
use std::{cell, fmt, future, pin::Pin, ptr, rc::Rc, task::Context, task::Poll};

use crate::{Ctx, IntoService, Service, ctx::WaitersRef, util::BoxFuture};

use crate::pipeline::PipelineBinding;
use crate::pl_inner::{PipelineApi, PipelineInternalApi};

/// Execution container for a service whose state is supplied per operation.
///
/// Unlike [`crate::Pipeline`], this type does not own a state value. Callers
/// provide a state reference when checking readiness, calling, or shutting
/// down the service.
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
        PipelineState {
            api: Rc::new(PipelineInner {
                s: service.into_service(),
                waiters: WaitersRef::new(),
                st_runtime: cell::UnsafeCell::new(RuntimeState::New),
            }),
        }
    }

    #[inline]
    /// Returns when the pipeline is ready to process requests.
    pub async fn ready(&self, st: &St) -> Result<(), Err> {
        self.api.ready(0, st).await
    }

    #[inline]
    /// Waits for readiness, then calls the service with `st`.
    pub async fn call(&self, req: Req, st: &St) -> Result<Res, Err> {
        let pl = self.binding();
        self.api.call(pl.idx, req, st, true).await
    }

    #[inline]
    /// Calls the service with `st` without checking readiness.
    ///
    /// The caller must ensure the pipeline is ready before calling this method.
    pub async fn call_nowait(&self, req: Req, st: &St) -> Result<Res, Err> {
        let pl = self.binding();
        pl.api.call(pl.idx, req, st, false).await
    }

    #[inline]
    /// Shuts down the enclosed service.
    pub async fn shutdown(&self, st: &St) {
        self.api.shutdown(0, st).await;
    }

    #[inline]
    /// Returns `Ready` when the pipeline is ready to process requests.
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
    pub async fn call(&self, req: Req, st: &St) -> Result<Res, Err> {
        let pl = Binding {
            idx: self.api.reg(),
            api: self.api.as_ref(),
        };
        pl.api.call(pl.idx, req, st, true).await
    }

    #[inline]
    /// Calls the service with `st` without checking readiness.
    ///
    /// The caller must ensure the pipeline is ready before calling this method.
    pub async fn call_nowait(&self, req: Req, st: &St) -> Result<Res, Err> {
        let pl = Binding {
            idx: self.api.reg(),
            api: self.api.as_ref(),
        };
        pl.api.call(pl.idx, req, st, false).await
    }
}

// ========================== `PipelineApi` ===========================

struct PipelineInternal<St, Req, Res, Err> {
    st: St,
    api: Rc<dyn PipelineStateApi<St, Req, Res, Err>>,
}

impl<St, Req, Res, Err> PipelineInternalApi<Req, Res, Err> for PipelineInternal<St, Req, Res, Err> {
    fn reg(&self) -> u32 {
        self.api.reg()
    }

    fn unreg(&self, idx: u32) {
        self.api.unreg(idx);
    }

    fn ready(&self, idx: u32) -> BoxFuture<'_, Result<(), Err>> {
        self.api.ready(idx, &self.st)
    }

    fn call(&self, idx: u32, req: Req, ready: bool) -> BoxFuture<'_, Result<Res, Err>> {
        self.api.call(idx, req, &self.st, ready)
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

struct PipelineInner<S, St, E> {
    s: S,
    waiters: WaitersRef,
    st_runtime: cell::UnsafeCell<RuntimeState<St, E>>,
}

impl<S, St, E> Drop for PipelineInner<S, St, E> {
    fn drop(&mut self) {
        // The readiness future borrows `s` and `waiters`, so it must be dropped
        // before the fields it references
        *self.st_runtime.get_mut() = RuntimeState::New;
    }
}

enum RuntimeState<St, E> {
    New,
    Readiness(Box<dyn CheckReadiness<St, E>>),
    Shutdown,
}

trait PipelineStateApi<St, Req, Res, Err> {
    fn reg(&self) -> u32;
    fn unreg(&self, idx: u32);

    fn call<'a>(
        &'a self,
        idx: u32,
        req: Req,
        st: &'a St,
        ready: bool,
    ) -> BoxFuture<'a, Result<Res, Err>>
    where
        Req: 'a;

    fn ready<'a>(&'a self, idx: u32, st: &'a St) -> BoxFuture<'a, Result<(), Err>>
    where
        Req: 'a;

    fn poll_ready(&self, cx: &mut Context<'_>, st: &St) -> Poll<Result<(), Err>>
    where
        St: Clone;

    fn shutdown<'a>(&'a self, idx: u32, st: &'a St) -> BoxFuture<'a, ()>;

    fn is_shutdown(&self) -> bool;
}

impl<S, St, Req, E> PipelineStateApi<St, Req, S::Res, S::Error> for PipelineInner<S, St, E>
where
    S: Service<St, Req, Error = E> + 'static,
    St: 'static,
    Req: 'static,
    E: 'static,
{
    fn reg(&self) -> u32 {
        self.waiters.insert()
    }

    fn unreg(&self, idx: u32) {
        self.waiters.remove(idx);
    }

    fn ready<'a>(&'a self, idx: u32, st: &'a St) -> BoxFuture<'a, Result<(), S::Error>>
    where
        Req: 'a,
    {
        Box::pin(async move {
            Ctx::<'_, S, St>::new(idx, &self.waiters, st)
                .ready(&self.s)
                .await
        })
    }

    fn shutdown<'a>(&'a self, idx: u32, st: &'a St) -> BoxFuture<'a, ()> {
        Box::pin(async move {
            let pl_state = unsafe { &mut *self.st_runtime.get() };
            *pl_state = RuntimeState::Shutdown;

            Ctx::<'_, S, St>::new(idx, &self.waiters, st)
                .shutdown(&self.s)
                .await;
        })
    }

    fn call<'a>(
        &'a self,
        idx: u32,
        req: Req,
        st: &'a St,
        ready: bool,
    ) -> BoxFuture<'a, Result<S::Res, S::Error>>
    where
        Req: 'a,
    {
        Box::pin(async move {
            if ready {
                Ctx::<'_, S, St>::new(idx, &self.waiters, st)
                    .call(&self.s, req)
                    .await
            } else {
                Ctx::<'_, S, St>::new(idx, &self.waiters, st)
                    .call_nowait(&self.s, req)
                    .await
            }
        })
    }

    fn poll_ready(&self, cx: &mut Context<'_>, st: &St) -> Poll<Result<(), S::Error>>
    where
        St: Clone,
    {
        let pl_state = unsafe { &mut *self.st_runtime.get() };
        match pl_state {
            RuntimeState::New => {
                // SAFETY: `self` is heap allocated (`Rc<PipelineInner>`) and never moves.
                // `fut` is stored in `self.st_runtime`, which is reset before other
                // fields are dropped (see `Drop for PipelineInner`), so `pl` outlives `fut`.
                let pl = unsafe { &*(ptr::from_ref(self)) };
                let fut = Box::new(CheckReadinessFut {
                    pl,
                    f: ready,
                    st: st.clone(),
                    fut: None,
                });
                *pl_state = RuntimeState::Readiness(fut);
                self.poll_ready(cx, st)
            }
            RuntimeSt
```

### Core Architecture Module: `ntex-service/src/state.rs`
```
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
    let mut fut1 = pin::pin!(ctx.ready(svc1));
    let mut fut2 = pin::pin!(ctx.ready(svc2));

    let mut ready1 = false;
    let mut ready2 = false;

    poll_fn(move |cx| {
        if !ready1 && Pin::new(&mut fut1).poll(cx)?.is_ready() {
            ready1 = true;
        }
        if !ready2 && Pin::new(&mut fut2).poll(cx)?.is_ready() {
            ready2 = true;
        }
        if ready1 && ready2 {
            Poll::Ready(Ok(()))
        } else {
            Poll::Pending
        }
    })
    .await
}

```

### Core Architecture Module: `ntex-tls/src/utils.rs`
```
//! Helpers shared by the tls filters.
#![allow(dead_code)]
use std::{future::Future, io};

use ntex_error::Error;
use ntex_io::{Io, types::HttpProtocol};
use ntex_net::connect::ConnectError;
use ntex_service::cfg::Cfg;
use ntex_util::time::{Millis, timeout_checked};

use crate::TlsConfig;

/// Runs a handshake with timeout, zero timeout disables it.
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

/// Runs a client handshake with the configured timeout.
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
/// `state` reports whether the handshake is still in progress.
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

/// Http protocol of the negotiated alpn protocol.
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
mod tests {
    use super::*;

    #[test]
    fn test_http_protocol() {
        assert_eq!(http_protocol(Some(b"h2")), HttpProtocol::Http2);
        assert_eq!(http_protocol(Some(b"http/1.1")), HttpProtocol::Http1);
        assert_eq!(http_protocol(Some(b"h2c")), HttpProtocol::Http1);
        assert_eq!(http_protocol(None), HttpProtocol::Http1);
    }

    #[test]
    fn test_server_name() {
        assert_eq!(server_name("example.com"), "example.com");
        assert_eq!(server_name("example.com:443"), "example.com");
        assert_eq!(server_name("127.0.0.1:8080"), "127.0.0.1");
        assert_eq!(server_name("[::1]"), "::1");
        assert_eq!(server_name("[::1]:443"), "::1");
        assert_eq!(server_name("[fe80::1%25eth0]:443"), "fe80::1%25eth0");
        assert_eq!(server_name("::1"), "::1");
        assert_eq!(server_name("2001:db8::1"), "2001:db8::1");
        assert_eq!(server_name(""), "");
    }
}

```

### Core Architecture Module: `ntex-util/src/channel/bstream.rs`
```
//! A buffered stream of byte chunks.
use std::cell::{Cell, RefCell};
use std::task::{Context, Poll};
use std::{collections::VecDeque, fmt, future::poll_fn, pin::Pin, rc::Rc, rc::Weak};

use ntex_bytes::Bytes;

use crate::{Stream, task::LocalWaker};

/// Default high watermark, 32 KiB
const HIGH_WATERMARK: u32 = 32_768;
/// Default low watermark, 16 KiB
const LOW_WATERMARK: u32 = HIGH_WATERMARK / 2;

/// Indicates the current status of a byte stream.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Status {
    /// End of stream reached.
    Eof,
    /// Stream is ready to accept more bytes.
    Ready,
    /// The receiver side has been dropped.
    Dropped,
}

/// Creates a byte stream and returns its sender and receiver.
pub fn channel<E>() -> (Sender<E>, Receiver<E>) {
    let inner = Rc::new(Inner::new(false));

    (
        Sender {
            inner: Rc::downgrade(&inner),
        },
        Receiver { inner },
    )
}

/// Creates a byte stream that starts at EOF.
///
/// Data may still be added through the returned sender. The receiver yields
/// that buffered data first and then completes.
pub fn eof<E>() -> (Sender<E>, Receiver<E>) {
    let inner = Rc::new(Inner::new(true));

    (
        Sender {
            inner: Rc::downgrade(&inner),
        },
        Receiver { inner },
    )
}

/// Creates a receiver that contains optional data and is already at EOF.
pub fn empty<E>(data: Option<Bytes>) -> Receiver<E> {
    let rx = Receiver {
        inner: Rc::new(Inner::new(true)),
    };
    if let Some(data) = data {
        rx.put(data);
    }
    rx
}

/// A buffered stream of byte chunks.
///
/// The receiver yields chunks in insertion order. Its configured buffer size
/// is a cooperative backpressure threshold for the sender, not a hard memory
/// limit.
#[derive(Debug)]
pub struct Receiver<E> {
    inner: Rc<Inner<E>>,
}

impl<E> Receiver<E> {
    /// Sets the sender backpressure watermarks.
    ///
    /// Once buffered data reaches `high` bytes, [`Sender::poll_ready`] stops
    /// reporting [`Status::Ready`] until the receiver drains the buffer to
    /// `low` bytes or less, so the sender is not woken for every consumed
    /// chunk. `low` is capped below `high`.
    ///
    /// Sending does not enforce the watermarks, so producers must cooperate
    /// by waiting for readiness. Changing the watermarks immediately updates
    /// and, when needed, wakes sender readiness: the sender is ready if
    /// buffered data is below `high`. The defaults are 32 KiB and 16 KiB.
    #[inline]
    pub fn set_watermarks(&self, high: u32, low: u32) {
        self.inner.set_watermarks(high, low);
    }

    /// Sets the sender backpressure threshold.
    ///
    /// Sets the high watermark to `size` and the low watermark to half of it.
    #[inline]
    #[deprecated(since = "4.2.0", note = "Use `Receiver::set_watermarks()` instead")]
    pub fn max_buffer_size(&self, size: usize) {
        let size = u32::try_from(size).unwrap_or(u32::MAX);
        self.inner.set_watermarks(size, size / 2);
    }

    /// Puts previously read data back at the front of the stream.
    ///
    /// This may grow the buffer past its readiness threshold.
    #[inline]
    pub fn put(&self, data: Bytes) {
        self.inner.unread_data(data);
    }

    #[inline]
    /// Returns `true` once EOF has been marked.
    ///
    /// Buffered chunks may still be available after this returns `true`.
    pub fn is_eof(&self) -> bool {
        self.inner.flags.get().contains(Flags::EOF)
    }

    #[inline]
    /// Waits for and returns the next chunk, stream error, or EOF.
    pub async fn read(&self) -> Option<Result<Bytes, E>> {
        poll_fn(|cx| self.poll_read(cx)).await
    }

    #[inline]
    /// Polls for the next chunk, stream error, or EOF.
    pub fn poll_read(&self, cx: &mut Context<'_>) -> Poll<Option<Result<Bytes, E>>> {
        if let Some(data) = self.inner.get_data() {
            Poll::Ready(Some(Ok(data)))
        } else if let Some(err) = self.inner.err.take() {
            self.inner.insert_flag(Flags::EOF);
            Poll::Ready(Some(Err(err)))
        } else if self.inner.flags.get().intersects(Flags::EOF | Flags::ERROR) {
            Poll::Ready(None)
        } else {
            self.inner.recv_task.register(cx.waker());
            Poll::Pending
        }
    }
}

impl<E> Stream for Receiver<E> {
    type Item = Result<Bytes, E>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.poll_read(cx)
    }
}

impl<E> Drop for Receiver<E> {
    fn drop(&mut self) {
        self.inner.send_task.wake();
    }
}

/// Sender side of the byte stream.
///
/// Clones share one readiness registration. If several clones poll readiness,
/// the most recently registered task is the one that will be woken.
#[derive(Debug)]
pub struct Sender<E> {
    inner: Weak<Inner<E>>,
}

impl<E> Clone for Sender<E> {
    fn clone(&self) -> Self {
        Self {
            inner: self.inner.clone(),
        }
    }
}

impl<E> Drop for Sender<E> {
    fn drop(&mut self) {
        if self.inner.weak_count() == 1
            && let Some(shared) = self.inner.upgrade()
        {
            shared.insert_flag(Flags::EOF | Flags::SENDER_GONE);
            // a pending read completes with EOF
            shared.recv_task.wake();
        }
    }
}

impl<E> Sender<E> {
    /// Returns `true` if the receiver has been dropped.
    pub fn is_closed(&self) -> bool {
        self.inner.strong_count() == 0
    }

    /// Stores a terminal stream error and wakes both sides.
    pub fn set_error(&self, err: E) {
        if let Some(shared) = self.inner.upgrade() {
            shared.set_error(err);
        }
    }

    /// Marks the stream as EOF and wakes both sides.
    pub fn feed_eof(&self) {
        if let Some(shared) = self.inner.upgrade() {
            shared.feed_eof();
        }
    }

    /// Adds a chunk to the stream.
    ///
    /// This method does not enforce the configured backpressure threshold.
    pub fn feed_data(&self, data: Bytes) {
        if let Some(shared) = self.inner.upgrade() {
            shared.feed_data(data);
        }
    }

    /// Waits until the stream needs more data or reaches a terminal state.
    pub async fn ready(&self) -> Status {
        poll_fn(|cx| self.poll_ready(cx)).await
    }

    /// Polls until the stream needs more data or reaches a terminal state.
    ///
    /// Terminal states take precedence: [`Status::Dropped`] is returned once
    /// the receiver is gone or an error was set, [`Status::Eof`] after EOF.
    pub fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Status> {
        if let Some(shared) = self.inner.upgrade() {
            let flags = shared.flags.get();
            if flags.intersects(Flags::SENDER_GONE | Flags::ERROR) {
                Poll::Ready(Status::Dropped)
            } else if flags.contains(Flags::EOF) {
                Poll::Ready(Status::Eof)
            } else if flags.contains(Flags::NEED_READ) {
                Poll::Ready(Status::Ready)
            } else {
                shared.send_task.register(cx.waker());
                Poll::Pending
            }
        } else {
            // receiver is gone
            Poll::Ready(Status::Dropped)
        }
    }
}

bitflags::bitflags! {
    #[derive(Copy, Clone, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
    struct Flags: u8 {
        const EOF         = 0b0000_0001;
        const ERROR       = 0b0000_0010;
        const NEED_READ   = 0b0000_0100;
        const SENDER_GONE = 0b0000_1000;
    }
}

struct Inner<E> {
    len: Cell<usize>,
    flags: Cell<Flags>,
    err: Cell<Option<E>>,
    items: RefCell<VecDeque<Bytes>>,
    recv_task: LocalWaker,
    send_task: LocalWaker,
    high_watermark: Cell<u32>,
    low_watermark: Cell<u32>,
}

impl<E> Inner<E> {
    fn new(eof: bool) -> Self {
        let flags = if eof { Flags::EOF } else { Flags::NEED_READ };
        Inner {
            flags: Cell::new(flags),
            len: Cell::new(0),
            err: Cell::new(None),
            items: RefCell::new(VecDeque::new()),
            recv_task: LocalWaker::new(),
            send_task: LocalWaker::new(),
            high_watermark: Cell::new(HIGH_WATERMARK),
            low_watermark: Cell::new(LOW_WATERMARK),
        }
    }

    fn insert_flag(&self, f: Flags) {
        let mut flags = self.flags.get();
        flags.insert(f);
        self.flags.set(flags);
    }

    fn remove_flag(&self, f: Flags) {
        let mut flags = self.flags.get();
        flags.remove(f);
        self.flags.set(flags);
    }

    fn set_watermarks(&self, high: u32, low: u32) {
        self.high_watermark.set(high);
        self.low_watermark.set(low.min(high.saturating_sub(1)));

        let flags = self.flags.get();
        if flags.intersects(Flags::EOF | Flags::ERROR | Flags::SENDER_GONE) {
            return;
        }

        if self.len.get() < high as usize {
            if !flags.contains(Flags::NEED_READ) {
                self.insert_flag(Flags::NEED_READ);
                self.send_task.wake();
            }
        } else {
            self.remove_flag(Flags::NEED_READ);
        }
    }

    fn set_error(&self, err: E) {
        self.err.set(Some(err));
        self.insert_flag(Flags::ERROR);
        self.recv_task.wake();
        self.send_task.wake();
    }

    fn feed_eof(&self) {
        self.insert_flag(Flags::EOF);
        self.recv_task.wake();
        self.send_task.wake();
    }

    fn feed_data(&self, data: Bytes) {
        let len = self.len.get() + data.len();
        self.len.set(len);
        self.items.borrow_mut().push_back(data);
        self.recv_task.wake();

        if len >= self.high_watermark.get() as usize {
            self.remove_flag(Flags::NEED_READ);
        }
    }

    fn get_data(&self) -> Option<Bytes> {
        self.items.borrow_mut().pop_front().inspect(|data| {
            let len = self.len.get() - data.len();

            // wak
```

### Core Architecture Module: `ntex-util/src/channel/cell.rs`
```
use std::{cell::UnsafeCell, fmt, rc::Rc};

pub(super) struct Cell<T> {
    inner: Rc<UnsafeCell<T>>,
}

impl<T> Clone for Cell<T> {
    fn clone(&self) -> Self {
        Self {
            inner: self.inner.clone(),
        }
    }
}

impl<T: fmt::Debug> fmt::Debug for Cell<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.inner.fmt(f)
    }
}

impl<T> Cell<T> {
    pub(super) fn new(inner: T) -> Self {
        Self {
            inner: Rc::new(UnsafeCell::new(inner)),
        }
    }

    pub(super) fn strong_count(&self) -> usize {
        Rc::strong_count(&self.inner)
    }

    pub(super) fn get_ref(&self) -> &T {
        unsafe { &*self.inner.as_ref().get() }
    }

    #[allow(clippy::mut_from_ref)]
    pub(super) fn get_mut(&self) -> &mut T {
        unsafe { &mut *self.inner.as_ref().get() }
    }
}

```

### Core Architecture Module: `ntex-util/src/channel/condition.rs`
```
use std::{cell, fmt, future::Future, future::poll_fn, pin::Pin, task::Context, task::Poll};

use slab::Slab;

use super::cell::Cell;
use crate::task::LocalWaker;

#[derive(Clone, Debug, PartialEq, Eq)]
/// Result produced by a [`Condition`] waiter.
pub enum ConditionResult<T> {
    /// The condition delivered a value.
    Value(T),
    /// The condition has been locked and will not deliver more values.
    Locked,
    /// The last handle to the condition was dropped.
    Dropped,
}

#[derive(Copy, Clone, PartialEq, Eq, Debug)]
enum State {
    Normal,
    Locked,
    Dropped,
}

/// A condition that can wake several waiting tasks at once.
///
/// Notifications are not queued. A waiter must have been polled and registered
/// its waker before [`notify`](Self::notify) is called, otherwise it misses that
/// value. Use [`notify_and_lock`](Self::notify_and_lock) when no later
/// notifications should be accepted.
pub struct Condition<T = ()> {
    inner: Cell<Inner<T>>,
}

/// A task waiting for a [`Condition`] notification.
pub struct Waiter<T = ()> {
    token: usize,
    inner: Cell<Inner<T>>,
}

struct Inner<T> {
    data: Slab<Option<Item<T>>>,
    count: usize,
    state: State,
}

struct Item<T> {
    val: cell::Cell<ConditionResult<T>>,
    waker: LocalWaker,
}

impl Default for Condition<()> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T> Clone for Condition<T> {
    fn clone(&self) -> Self {
        let inner = self.inner.clone();
        inner.get_mut().count += 1;
        Self { inner }
    }
}

impl<T> fmt::Debug for Condition<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Condition")
            .field("state", &self.inner.get_ref().state)
            .finish()
    }
}

impl<T> Condition<T> {
    /// Creates an unlocked condition with no waiters.
    pub fn new() -> Condition<T> {
        Condition {
            inner: Cell::new(Inner {
                data: Slab::new(),
                count: 1,
                state: State::Normal,
            }),
        }
    }
}

impl<T: Clone> Condition<T> {
    /// Creates a new waiter.
    ///
    /// The waiter starts listening when it is first polled, not when this
    /// method returns.
    pub fn wait(&self) -> Waiter<T> {
        let token = self.inner.get_mut().data.insert(None);
        Waiter {
            token,
            inner: self.inner.clone(),
        }
    }

    /// Sends `val` to every waiter that is currently being polled.
    ///
    /// The value is cloned for each registered waiter. Unpolled waiters do not
    /// receive it, and the value is not retained for future waiters.
    pub fn notify(&self, val: T) {
        let inner = self.inner.get_ref();
        if inner.state != State::Normal {
            return;
        }
        for (_, item) in &inner.data {
            if let Some(item) = item
                && item.waker.wake_checked()
            {
                item.val.set(ConditionResult::Value(val.clone()));
            }
        }
    }

    /// Notifies the current waiters and permanently locks the condition.
    ///
    /// Registered waiters receive `val`. Later readiness checks return
    /// [`ConditionResult::Locked`], and later calls to [`notify`](Self::notify)
    /// do not deliver another value.
    pub fn notify_and_lock(&self, val: T) {
        self.notify(val);
        self.inner.get_mut().state = State::Locked;
    }
}

impl<T: Default> Condition<T> {
    /// Sends `T::default()` to every waiter that is currently being polled.
    pub fn notify_default(&self) {
        let inner = self.inner.get_ref();
        if inner.state != State::Normal {
            return;
        }
        for (_, item) in &inner.data {
            if let Some(item) = item
                && item.waker.wake_checked()
            {
                item.val.set(ConditionResult::Value(T::default()));
            }
        }
    }
}

impl<T> Drop for Condition<T> {
    fn drop(&mut self) {
        let inner = self.inner.get_mut();
        inner.count -= 1;
        if inner.count == 0 {
            inner.state = State::Dropped;
            for (_, item) in &inner.data {
                if let Some(item) = item
                    && item.waker.wake_checked()
                {
                    item.val.set(ConditionResult::Dropped);
                }
            }
        }
    }
}

impl<T> Waiter<T> {
    /// Waits for the next condition result.
    pub async fn ready(&self) -> ConditionResult<T> {
        poll_fn(|cx| self.poll_ready(cx)).await
    }

    /// Polls for the next condition result.
    ///
    /// The first poll registers this waiter. While the condition remains
    /// unlocked, later notifications wake the registered task.
    pub fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<ConditionResult<T>> {
        let parent = self.inner.get_mut();
        let inner = unsafe { parent.data.get_unchecked_mut(self.token) };

        if inner.is_none() {
            if parent.state == State::Normal {
                let waker = LocalWaker::default();
                waker.register(cx.waker());
                *inner = Some(Item {
                    waker,
                    val: cell::Cell::new(ConditionResult::Locked),
                });
                return Poll::Pending;
            }
        } else {
            let item = inner.as_mut().unwrap();
            if !item.waker.register(cx.waker()) {
                return Poll::Ready(item.val.replace(ConditionResult::Locked));
            }
        }

        match parent.state {
            State::Normal => Poll::Pending,
            State::Locked => Poll::Ready(ConditionResult::Locked),
            State::Dropped => Poll::Ready(ConditionResult::Dropped),
        }
    }
}

impl<T> Clone for Waiter<T> {
    fn clone(&self) -> Self {
        let token = self.inner.get_mut().data.insert(None);
        Waiter {
            token,
            inner: self.inner.clone(),
        }
    }
}

impl<T> Future for Waiter<T> {
    type Output = ConditionResult<T>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        self.get_mut().poll_ready(cx)
    }
}

impl<T> fmt::Debug for Waiter<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Waiter").finish()
    }
}

impl<T> Drop for Waiter<T> {
    fn drop(&mut self) {
        self.inner.get_mut().data.remove(self.token);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::future::lazy;

    #[ntex::test]
    #[allow(clippy::unit_cmp)]
    async fn test_condition() {
        let cond = Condition::<()>::new();
        let mut waiter = cond.wait();
        assert_eq!(
            lazy(|cx| Pin::new(&mut waiter).poll(cx)).await,
            Poll::Pending
        );
        cond.notify_default();
        assert!(format!("{cond:?}").contains("Condition"));
        assert!(format!("{waiter:?}").contains("Waiter"));
        assert_eq!(waiter.await, ConditionResult::Value(()));

        let mut waiter = cond.wait();
        assert_eq!(
            lazy(|cx| Pin::new(&mut waiter).poll(cx)).await,
            Poll::Pending
        );
        let mut waiter2 = waiter.clone();
        assert_eq!(
            lazy(|cx| Pin::new(&mut waiter2).poll(cx)).await,
            Poll::Pending
        );

        drop(cond);
        assert_eq!(waiter.await, ConditionResult::Dropped);
        assert_eq!(waiter2.await, ConditionResult::Dropped);
    }

    #[ntex::test]
    async fn test_condition_poll() {
        let cond = Condition::default().clone();
        let waiter = cond.wait();
        assert_eq!(lazy(|cx| waiter.poll_ready(cx)).await, Poll::Pending);
        cond.notify_default();
        waiter.ready().await;

        let waiter2 = waiter.clone();
        assert_eq!(lazy(|cx| waiter.poll_ready(cx)).await, Poll::Pending);
        assert_eq!(lazy(|cx| waiter.poll_ready(cx)).await, Poll::Pending);
        assert_eq!(lazy(|cx| waiter2.poll_ready(cx)).await, Poll::Pending);
        assert_eq!(lazy(|cx| waiter2.poll_ready(cx)).await, Poll::Pending);

        drop(cond);
        assert_eq!(
            lazy(|cx| waiter.poll_ready(cx)).await,
            Poll::Ready(ConditionResult::Dropped)
        );
        assert_eq!(
            lazy(|cx| waiter.poll_ready(cx)).await,
            Poll::Ready(ConditionResult::Dropped)
        );
        assert_eq!(
            lazy(|cx| waiter2.poll_ready(cx)).await,
            Poll::Ready(ConditionResult::Dropped)
        );
        assert_eq!(
            lazy(|cx| waiter2.poll_ready(cx)).await,
            Poll::Ready(ConditionResult::Dropped)
        );
    }

    #[ntex::test]
    async fn test_condition_with() {
        let cond = Condition::<String>::new();
        let waiter = cond.wait();
        assert_eq!(lazy(|cx| waiter.poll_ready(cx)).await, Poll::Pending);
        cond.notify("TEST".into());
        assert_eq!(
            waiter.ready().await,
            ConditionResult::Value("TEST".to_string())
        );

        let waiter2 = waiter.clone();
        assert_eq!(lazy(|cx| waiter.poll_ready(cx)).await, Poll::Pending);
        assert_eq!(lazy(|cx| waiter.poll_ready(cx)).await, Poll::Pending);
        assert_eq!(lazy(|cx| waiter2.poll_ready(cx)).await, Poll::Pending);
        assert_eq!(lazy(|cx| waiter2.poll_ready(cx)).await, Poll::Pending);

        drop(cond);
        assert_eq!(
            lazy(|cx| waiter.poll_ready(cx)).await,
            Poll::Ready(ConditionResult::Dropped)
        );
        assert_eq!(
            lazy(|cx| waiter.poll_ready(cx)).await,
            Poll::Ready(ConditionResult::Dropped)
        );
        assert_eq!(
            lazy(|cx| waiter2.poll_ready(cx)).await,
            Poll::Ready(ConditionResult::Dropped)
        );
        assert_eq!(
            lazy(|cx| waiter2.poll_ready(cx)).await,
            Poll::Ready(ConditionResult::Dropped)
        );
    }

    #[ntex::test]
    async fn waiter_future_does_not_require
```

### Core Architecture Module: `ntex-util/src/channel/inplace.rs`
```
//! A futures-aware bounded(1) channel.
use std::{cell::Cell, fmt, future::poll_fn, task::Context, task::Poll};

use crate::task::LocalWaker;

/// Creates a new futures-aware bounded(1) channel.
pub fn channel<T>() -> Inplace<T> {
    Inplace {
        value: Cell::new(None),
        rx_task: LocalWaker::new(),
    }
}

/// A futures-aware bounded(1) channel.
pub struct Inplace<T> {
    value: Cell<Option<T>>,
    rx_task: LocalWaker,
}

// The channels do not ever project Pin to the inner T
impl<T> Unpin for Inplace<T> {}

impl<T> fmt::Debug for Inplace<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Inplace<T>")
    }
}

impl<T> Inplace<T> {
    /// Set a successful result.
    ///
    /// If the value is successfully enqueued to be received, then `Ok(())` is
    /// returned. If the previous value has not been consumed yet, then `Err` is
    /// returned with the value provided.
    pub fn send(&self, val: T) -> Result<(), T> {
        if let Some(v) = self.value.take() {
            self.value.set(Some(v));
            Err(val)
        } else {
            self.value.set(Some(val));
            self.rx_task.wake();
            Ok(())
        }
    }

    /// Waits until a value has been sent and takes it.
    pub async fn recv(&self) -> T {
        poll_fn(|cx| self.poll_recv(cx)).await
    }

    /// Polls for a sent value and takes it.
    pub fn poll_recv(&self, cx: &mut Context<'_>) -> Poll<T> {
        // If we've got a value, then skip the logic below as we're done.
        if let Some(val) = self.value.take() {
            return Poll::Ready(val);
        }

        // Check if sender is dropped and return error if it is.
        self.rx_task.register(cx.waker());
        Poll::Pending
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::future::lazy;

    #[ntex::test]
    async fn test_inplace() {
        let ch = channel();
        assert_eq!(lazy(|cx| ch.poll_recv(cx)).await, Poll::Pending);

        assert!(ch.send(1).is_ok());
        assert_eq!(ch.send(2), Err(2));
        assert_eq!(lazy(|cx| ch.poll_recv(cx)).await, Poll::Ready(1));

        assert!(ch.send(1).is_ok());
        assert_eq!(ch.recv().await, 1);
        assert!(format!("{ch:?}").contains("Inplace"));
    }
}

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

### Incident Patch 1: `59c95399` (2026-10-05)
**Commit Message**: Keep memory of up to 64 completed call futures

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ ntex-net = "4.2.0"
 ntex-router = "2.1.0"
 ntex-rt = "4.1.0"
 ntex-server = "4.2.0"
-ntex-service = "5.1.0"
+ntex-service = "5.2.0"
 ntex-tls = "4.2.0"
 ntex-util = "4.2.1"
 urly = "1.0.1"
```

**File**: `ntex-service/CHANGES.md` (modified, +3/-1)
```diff
@@ -1,9 +1,11 @@
 # Changes
 
-## [Unreleased]
+## [5.2.0] - 2026-10-05
 
 * Reuse pipeline call future memory instead of allocating it for every call
 
+* Keep memory of up to 64 completed call futures, concurrent pipeline calls reuse it as well
+
 ## [5.1.0] - 2026-09-30
 
 * Fix use-after-free when a pipeline is dropped with pending readiness or shutdown future
```

**File**: `ntex-service/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "ntex-service"
-version = "5.1.0"
+version = "5.2.0"
 authors = ["ntex contributors <team@ntex.rs>"]
 description = "ntex service"
 keywords = ["network", "framework", "async", "futures"]
```

**File**: `ntex-service/src/pl_inner.rs` (modified, +132/-23)
```diff
@@ -321,49 +321,104 @@ impl<R> Future for CallFuture<'_, R> {
     }
 }
 
-/// Keeps memory of the last completed call future.
-#[derive(Default)]
-pub(crate) struct CallCache(cell::Cell<Option<(NonNull<u8>, Layout)>>);
+/// Max number of call future blocks kept by a [`CallCache`].
+const CALL_CACHE_MAX_BLOCKS: usize = 64;
+
+/// Max total size of call future blocks kept by a [`CallCache`].
+const CALL_CACHE_MAX_BYTES: usize = 256 * 1024;
+
+/// Keeps memory of completed call futures.
+///
+/// Free blocks form a LIFO list, each block stores a pointer to the next one.
+/// All blocks share the same layout.
+pub(crate) struct CallCache {
+    head: cell::Cell<Option<NonNull<u8>>>,
+    layout: cell::Cell<Layout>,
+    len: cell::Cell<usize>,
+}
+
+impl Default for CallCache {
+    fn default() -> Self {
+        Self {
+            head: cell::Cell::new(None),
+            layout: cell::Cell::new(Layout::new::<()>()),
+            len: cell::Cell::new(0),
+        }
+    }
+}
 
 impl CallCache {
     fn alloc(&self, layout: Layout) -> NonNull<u8> {
-        match self.0.take() {
-            Some((ptr, l)) if l == layout => ptr,
-            cached => {
-                if let Some((ptr, l)) = cached {
-                    // SAFETY: `ptr` was allocated with layout `l`
-                    unsafe { dealloc(ptr.as_ptr(), l) };
-                }
-                // SAFETY: `layout` has non-zero size
-                NonNull::new(unsafe { alloc(layout) }).unwrap_or_else(|| handle_alloc_error(layout))
-            }
+        if layout == self.layout.get()
+            && let Some(ptr) = self.head.get()
+        {
+            // SAFETY: cached blocks start with a pointer to the next free block
+            let next = unsafe { ptr.cast::<Option<NonNull<u8>>>().as_ptr().read_unaligned() };
+            self.head.set(next);
+            self.len.set(self.len.get() - 1);
+            ptr
+        } else {
+            // SAFETY: `layout` has non-zero size
+            NonNull::new(unsafe { alloc(layout) }).unwrap_or_else(|| handle_alloc_error(layout))
         }
     }
 
     /// # Safety
     ///
     /// `ptr` must be allocated with `layout` by the global allocator and must not be used afterwards
     unsafe fn release(&self, ptr: NonNull<u8>, layout: Layout) {
-        if let Some((ptr, l)) = self.0.replace(Some((ptr, layout))) {
-            // SAFETY: `ptr` was allocated with layout `l`
-            unsafe { dealloc(ptr.as_ptr(), l) };
+        if layout != self.layout.get() {
+            self.clear();
+            self.layout.set(layout);
+        }
+
+        let len = self.len.get();
+        if layout.size() >= size_of::<Option<NonNull<u8>>>()
+            && len < CALL_CACHE_MAX_BLOCKS
+            && (len + 1) * layout.size() <= CALL_CACHE_MAX_BYTES
+        {
+            // SAFETY: the block is not used anymore and is large enough for a pointer
+            unsafe {
+                ptr.cast::<Option<NonNull<u8>>>()
+                    .as_ptr()
+                    .write_unaligned(self.head.get());
+            }
+            self.head.set(Some(ptr));
+            self.len.set(len + 1);
+        } else {
+            // SAFETY: `ptr` was allocated with `layout`
+            unsafe { dealloc(ptr.as_ptr(), layout) };
         }
     }
 
+    fn clear(&self) {
+        let layout = self.layout.get();
+        while let Some(ptr) = self.head.get() {
+            // SAFETY: cached blocks start with a pointer to the next free block
+            // and were allocated with `layout`
+            unsafe {
+                self.head
+                    .set(ptr.cast::<Option<NonNull<u8>>>().as_ptr().read_unaligned());
+                dealloc(ptr.as_ptr(), layout);
+            }
+        }
+        self.len.set(0);
+    }
+
     #[cfg(test)]
     fn cached(&self) -> Option<NonNull<u8>> {
-        let item = self.0.take();
-        self.0.set(item);
-        item.map(|(ptr, _)| ptr)
+        self.head.get()
+    }
+
+    #[cfg(test)]
+    fn len(&self) -> usize {
+        self.len.get()
     }
 }
 
 impl Drop for CallCache {
     fn drop(&mut self) {
-        if let Some((ptr, l)) = self.0.take() {
-            // SAFETY: `ptr` was allocated with layout `l`
-            unsafe { dealloc(ptr.as_ptr(), l) };
-        }
+        self.clear();
     }
 }
 
@@ -481,9 +536,63 @@ mod tests {
         assert_eq!(pl.calls.cached(), Some(b1));
         drop(fut2);
         assert_eq!(pl.calls.cached(), Some(b2));
+        assert_eq!(pl.calls.len(), 2);
 
         let fut = pl.call(0, Rc::new(4), false);
         assert_eq!(block(&fut), b2);
+        let fut2 = pl.call(0, Rc::new(5), false);
+        assert_eq!(block(&fut2), b1);
+        assert_eq!(pl.calls.len(), 0);
+    }
+
+    #[test]
+    fn miri_call_future_reuses_concurrent_memory() {
+        let mut cx = Context::from_waker(Waker::noop());
+        let pl = echo();
+
+        let futs: Vec<_> = (0..4).map(|i| pl.call(0, Rc::new(i), false)).collect();
+       
```

**File**: `urly/CHANGES.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Changes
 
-## [1.0.1] - Unreleased
+## [1.0.1] - 2026-10-05
 
 * Add `const fn Url::new()`, same as `Url::default()`
 
```

---

### Incident Patch 2: `ccb84bd4` (2026-10-04)
**Commit Message**: Build absolute-form and CONNECT request urls without an intermediate String

**File**: `ntex/CHANGES.md` (modified, +5/-0)
```diff
@@ -23,6 +23,11 @@
 * http/2: Response headers are sent from the pooled response head, the header map is
   not reallocated per response
 
+* http/2: Build absolute-form and CONNECT request urls without an intermediate `String`
+
+* Pooled request heads and web requests release the request uri and headers, so they
+  do not keep the connection read buffer alive
+
 * http/1: Request heads are not decoded during write back-pressure, request payload is
   still read
 
```

**File**: `ntex/src/http/h2/service.rs` (modified, +65/-10)
```diff
@@ -14,7 +14,7 @@ use crate::http::{DateService, Method, Request, Response, StatusCode, Version};
 use crate::io::{Filter, Io, IoBoxed, IoRef, types};
 use crate::service::pipeline::{Pipeline, PipelineBinding, PipelineFactory};
 use crate::service::{Ctx, IntoServiceFactory, RequestState, Service, ServiceFactory};
-use crate::util::{Bytes, HashMap};
+use crate::util::{Bytes, BytesMut, HashMap};
 
 use super::{DefaultControlService, payload::Payload, payload::PayloadSender};
 
@@ -597,19 +597,12 @@ fn request_uri(pseudo: &h2::frame::PseudoHeaders) -> Option<(Method, Url)> {
             if authority.host().is_empty() || authority.userinfo().is_some() {
                 return None;
             }
-            Url::try_from(format!("//{authority}")).ok()?
+            Url::try_from(concat(&["//", authority.as_str()])).ok()?
         }
         (_, Some("*")) if method == Method::OPTIONS => Url::from_static("*"),
         (Some(authority), Some(path)) if path.starts_with('/') => {
             let scheme = Scheme::new(pseudo.scheme.as_ref()?.as_str()).ok()?;
-            let mut uri = String::with_capacity(
-                scheme.as_str().len() + 3 + authority.as_str().len() + path.len(),
-            );
-            uri.push_str(scheme.as_str());
-            uri.push_str("://");
-            uri.push_str(authority.as_str());
-            uri.push_str(path);
-            Url::try_from(uri).ok()?
+            Url::try_from(concat(&[scheme.as_str(), "://", authority.as_str(), path])).ok()?
         }
         (None, Some(path)) if path.starts_with('/') => {
             let uri = if path.starts_with("//") {
@@ -629,6 +622,29 @@ fn request_uri(pseudo: &h2::frame::PseudoHeaders) -> Option<(Method, Url)> {
     Some((method, uri))
 }
 
+/// Concatenates `pieces` into a buffer that `Url` reuses if the result is
+/// normalized, short strings are stored inline without allocation.
+fn concat(pieces: &[&str]) -> Bytes {
+    const INLINE: usize = 23;
+
+    let len = pieces.iter().map(|p| p.len()).sum::<usize>();
+    if len <= INLINE {
+        let mut buf = [0u8; INLINE];
+        let mut pos = 0;
+        for p in pieces {
+            buf[pos..pos + p.len()].copy_from_slice(p.as_bytes());
+            pos += p.len();
+        }
+        Bytes::copy_from_slice(&buf[..len])
+    } else {
+        let mut buf = BytesMut::with_capacity(len);
+        for p in pieces {
+            buf.extend_from_slice(p.as_bytes());
+        }
+        buf.freeze()
+    }
+}
+
 /// Checks the case-insensitive `100-continue` expectation, see RFC 9110 section 10.1.1
 fn expect_continue(headers: &HeaderMap) -> bool {
     headers.get_all(header::EXPECT).any(|value| {
@@ -692,6 +708,14 @@ mod tests {
         pseudo.authority = Some("bad authority".into());
         assert!(request_uri(&pseudo).is_none());
 
+        // inline and heap buffers
+        for authority in ["a.io:1", "very-long-host-name.example.com:8443"] {
+            pseudo.authority = Some(authority.into());
+            let (_, uri) = request_uri(&pseudo).unwrap();
+            assert_eq!(uri.authority().unwrap(), authority);
+            assert_eq!(uri.to_string(), format!("//{authority}"));
+        }
+
         // absolute form requires the scheme
         pseudo.method = Some(Method::GET);
         pseudo.authority = Some("example.com".into());
@@ -701,6 +725,27 @@ mod tests {
         let (_, uri) = request_uri(&pseudo).unwrap();
         assert_eq!(uri.to_string(), "https://example.com/path");
 
+        // 23 bytes are stored inline, 24 bytes on the heap
+        for path in ["/123", "/1234", "/api/v1/users/1?fields=name,email"] {
+            pseudo.path = Some(path.into());
+            let (_, uri) = request_uri(&pseudo).unwrap();
+            assert_eq!(uri.to_string(), format!("https://example.com{path}"));
+        }
+        // the buffer is normalized if needed
+        pseudo.scheme = Some("HTTPS".into());
+        pseudo.authority = Some("Example.COM".into());
+        pseudo.path = Some("/a/./b/../c".into());
+        let (_, uri) = request_uri(&pseudo).unwrap();
+        assert_eq!(uri.to_string(), "https://example.com/a/c");
+        pseudo.path = Some("/a/./b/../c/long-enough-for-the-heap".into());
+        let (_, uri) = request_uri(&pseudo).unwrap();
+        assert_eq!(
+            uri.to_string(),
+            "https://example.com/a/c/long-enough-for-the-heap"
+        );
+        pseudo.authority = Some("example.com".into());
+        pseudo.path = Some("/path".into());
+
         pseudo.scheme = Some("ht/tp".into());
         assert!(request_uri(&pseudo).is_none());
         pseudo.scheme = Some("https".into());
@@ -736,4 +781,14 @@ mod tests {
         let (_, uri) = request_uri(&pseudo).unwrap();
         assert_eq!(uri.path(), "*");
     }
+
+    #[test]
+    fn test_concat() {
+        assert_eq!(concat(&[]), "");
+        assert_eq!(concat(&["//", "a.io"]), "//a.io");
+        let inline = "x".repeat(23);
+        assert_eq!(concat(&[&i
```

**File**: `ntex/src/http/message.rs` (modified, +11/-1)
```diff
@@ -103,7 +103,7 @@ impl Default for RequestHead {
         RequestHead {
             id: 0,
             io: CurrentIo::None,
-            uri: Url::default(),
+            uri: Url::new(),
             method: Method::default(),
             version: Version::HTTP_11,
             headers: HeaderMap::with_capacity(16),
@@ -117,6 +117,9 @@ impl Default for RequestHead {
 impl Head for RequestHead {
     fn clear(&mut self) {
         self.io = CurrentIo::None;
+        // the uri and headers may share the connection read buffer, a pooled
+        // head must not keep it alive
+        self.uri = Url::new();
         self.flags = Flags::empty();
         self.version = Version::HTTP_11;
         self.headers.clear();
@@ -446,6 +449,13 @@ impl<T: Head> Message<T> {
             .unwrap_or_else(|| Rc::new(T::default()));
         Message { head }
     }
+
+    /// Clears the head, so a cached message does not hold request data.
+    pub(crate) fn clear(&mut self) {
+        if let Some(head) = Rc::get_mut(&mut self.head) {
+            head.clear();
+        }
+    }
 }
 
 impl Message<ResponseHead> {
```

**File**: `ntex/src/http/test.rs` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ impl TestRequest {
     pub fn builder() -> TestRequest {
         TestRequest(Some(Inner {
             method: Method::GET,
-            uri: Url::default(),
+            uri: Url::new(),
             version: Version::HTTP_11,
             headers: HeaderMap::new(),
             #[cfg(feature = "cookie")]
```

**File**: `ntex/src/web/config.rs` (modified, +6/-2)
```diff
@@ -1,5 +1,7 @@
 use std::{any::Any, any::TypeId, cell::UnsafeCell, net::SocketAddr, rc::Rc};
 
+use urly::Url;
+
 use crate::service::cfg::{CfgContext, Configuration};
 use crate::{router::ResourceDef, util::ByteString, util::HashMap};
 
@@ -153,8 +155,10 @@ pub(crate) fn put_request(id: usize, pool_size: usize, req: &mut Rc<HttpRequestI
             if cache.len() < pool_size
                 && let Some(inner) = Rc::get_mut(req)
             {
-                inner.head.remove_io();
-                inner.head.extensions.borrow_mut().clear();
+                // the head and the path may share the connection read buffer,
+                // a pooled request must not keep it alive
+                inner.head.clear();
+                inner.path.set(Url::new());
                 cache.push(req.clone());
             }
         });
```

**File**: `ntex/src/web/test.rs` (modified, +1/-1)
```diff
@@ -365,7 +365,7 @@ impl Default for TestRequest {
         TestRequest {
             req: HttpTestRequest::default(),
             rmap: ResourceMap::new(ResourceDef::new("")),
-            path: Path::new(Url::default()),
+            path: Path::new(Url::new()),
             peer_addr: None,
             state: (),
             config: WebAppConfig::new(),
```

**File**: `ntex/src/ws/client.rs` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ impl WsClient<Base> {
                 };
                 (uri, err)
             }
-            Err(err) => (Url::default(), Some(WsConfigError::from(err))),
+            Err(err) => (Url::new(), Some(WsConfigError::from(err))),
         };
 
         let cfg = cfg.into();
```

---

### Incident Patch 3: `a9e6ae60` (2026-10-03)
**Commit Message**: Dropping an Io while its filter chain is in use panics

**File**: `ntex-io/CHANGES.md` (modified, +3/-0)
```diff
@@ -5,6 +5,9 @@
 * `Io::take()` is unsafe, the filter and `IoRef` borrowed from the `Io` were freed with
   the returned `Io`
 
+* Dropping an `Io` while its filter chain is in use panics, the connection is closed and
+  the filter is leaked; previously the filter was freed while in use
+
 * Filter chain buffers are stored inline, a connection without a filter layer no longer
   allocates a buffer list, write buffers are accessed without moving them out
 
```

**File**: `ntex-io/src/filterptr.rs` (modified, +88/-9)
```diff
@@ -134,6 +134,15 @@ impl FilterPtr {
         }
     }
 
+    /// Replaces the filter with `NullFilter` without dropping it.
+    ///
+    /// The filter is neither read nor moved, so it may be in use.
+    pub(crate) fn leak(&self) {
+        // SAFETY: the old value is overwritten without being read, a `Box`
+        // holding the filter is not touched while the filter is borrowed
+        unsafe { ptr::write(self.0.get(), Repr::default()) }
+    }
+
     pub(crate) fn drop_filter<F>(&self) {
         if let Repr::Filter(ptr, _) = self.as_ref() {
             if !ptr.is_null() {
@@ -399,10 +408,16 @@ mod tests {
         AddFilter,
         MapFilter,
         Seal,
+        Drop,
     }
 
     impl Change {
-        const ALL: [Change; 3] = [Change::AddFilter, Change::MapFilter, Change::Seal];
+        const ALL: [Change; 4] = [
+            Change::AddFilter,
+            Change::MapFilter,
+            Change::Seal,
+            Change::Drop,
+        ];
 
         /// The result is leaked: without the check it would be dropped while
         /// the filter is in use.
@@ -414,6 +429,15 @@ mod tests {
                 })),
                 Change::MapFilter => mem::forget(io.map_filter(|f| f)),
                 Change::Seal => mem::forget(io.seal()),
+                Change::Drop => drop(io),
+            }
+        }
+
+        fn message(self) -> &'static str {
+            if let Change::Drop = self {
+                "Io is dropped while its filter is in use"
+            } else {
+                "filter chain is changed while it is in use"
             }
         }
     }
@@ -429,18 +453,15 @@ mod tests {
             }));
             if let Err(e) = &res {
                 let msg = e.downcast_ref::<String>().unwrap();
-                assert!(
-                    msg.contains("filter chain is changed while it is in use"),
-                    "{msg}"
-                );
+                assert!(msg.contains(change.message()), "{msg}");
             }
             result.set(Some(res.is_err()));
         }));
         panicked
     }
 
-    /// The filter chain cannot be changed from code run by the connection
-    /// while it holds references into the chain.
+    /// The filter chain cannot be changed, nor its `Io` dropped, from code run
+    /// by the connection while it holds references into the chain.
     #[test]
     fn change_while_lent_panics() {
         type Enter = fn(&crate::IoRef, &Hook);
@@ -472,12 +493,15 @@ mod tests {
                 let panicked = arm(io, change, &slot);
                 enter(&ioref, &slot);
                 assert_eq!(panicked.get(), Some(true), "{change:?} from {name}");
+                if let Change::Drop = change {
+                    assert!(!ioref.is_active(), "{name}");
+                }
             }
         }
     }
 
-    /// The filter chain cannot be changed from the filters while they
-    /// process input or output, or report readiness.
+    /// The filter chain cannot be changed, nor its `Io` dropped, from the
+    /// filters while they process input or output, or report readiness.
     #[ntex::test]
     async fn change_from_filter_panics() {
         for change in Change::ALL {
@@ -519,10 +543,65 @@ mod tests {
                     ntex_util::time::sleep(ntex_util::time::Millis(10)).await;
                 }
                 assert_eq!(panicked.get(), Some(true), "{change:?} from {trigger}");
+                if let Change::Drop = change {
+                    assert!(!ioref.is_active(), "{trigger}");
+                }
             }
         }
     }
 
+    /// An `Io` dropped while its filter is in use leaks the filter, the
+    /// connection is closed and the filter chain no longer runs.
+    #[test]
+    fn drop_while_lent_leaks_filter() {
+        let p = Rc::new(Cell::new(0));
+        let slot = Hook::default();
+        let io = Io::from(IoTestWrapper)
+            .add_filter(HookFilter {
+                hook: slot.clone(),
+                at: At::Any,
+            })
+            .add_filter(DropFilter { p: p.clone() });
+        let ioref = io.get_ref();
+        let panicked = arm(io, Change::Drop, &slot);
+        assert!(ioref.query::<u8>().get().is_none());
+        assert_eq!(panicked.get(), Some(true));
+        assert!(!ioref.is_active());
+        assert_eq!(p.get(), 0);
+
+        let ran = Rc::new(Cell::new(false));
+        let r = ran.clone();
+        *slot.borrow_mut() = Some(Box::new(move || r.set(true)));
+        assert!(ioref.query::<u8>().get().is_none());
+        assert!(!ran.get());
+
+        drop(ioref);
+        assert_eq!(p.get(), 0);
+    }
+
+    /// An `Io` dropped while unwinding from its filter does not panic again,
+    /// that would abort.
+    #[test]
+    fn drop_while_lent_unwinding() {
+        let slot = Hook::default();
+        let io = Io::from(IoTestWrapper).add_filter(HookFilter {
+            hook: slot.clone(),
+            at: At::Any,
+        });
+        let ioref = 
```

**File**: `ntex-io/src/io.rs` (modified, +33/-17)
```diff
@@ -1203,26 +1203,35 @@ impl<F> Drop for Io<F> {
         let st = self.st();
         self.stop_timer();
 
-        if st.filter.is_set() {
-            // filter is unsafe and must be dropped explicitly,
-            // and won't be dropped without special attention
-            if !st.flags.is_closed() {
-                log::trace!("{}: Io is dropped, terminate connection", st.tag());
-            }
+        // code run by the filter chain dropped the `Io`, the filter is in use
+        let in_use = st.filter.is_set() && st.buffer.is_borrowed();
 
-            if st.write_outstanding() == 0 {
-                // Everything the application wrote has reached the transport,
-                // so the connection can end with a normal FIN and the peer
-                // sees a clean end of stream.
-                st.terminate_connection(None);
-            } else {
-                // Output is still buffered and the filter chain is about to go
-                // away, so it can never be delivered. Abort instead, so that
-                // the peer cannot mistake a truncated stream for a complete
-                // one.
+        if st.filter.is_set() {
+            if in_use {
+                // the filter cannot be dropped, it is leaked
                 st.force_close_connection();
+                st.filter.leak();
+            } else {
+                // filter is unsafe and must be dropped explicitly,
+                // and won't be dropped without special attention
+                if !st.flags.is_closed() {
+                    log::trace!("{}: Io is dropped, terminate connection", st.tag());
+                }
+
+                if st.write_outstanding() == 0 {
+                    // Everything the application wrote has reached the transport,
+                    // so the connection can end with a normal FIN and the peer
+                    // sees a clean end of stream.
+                    st.terminate_connection(None);
+                } else {
+                    // Output is still buffered and the filter chain is about to go
+                    // away, so it can never be delivered. Abort instead, so that
+                    // the peer cannot mistake a truncated stream for a complete
+                    // one.
+                    st.force_close_connection();
+                }
+                st.filter.drop_filter::<F>();
             }
-            st.filter.drop_filter::<F>();
 
             // Nothing can consume buffered input or deliver buffered output
             // anymore, but the state may outlive the `Io` for a while, held by
@@ -1236,6 +1245,13 @@ impl<F> Drop for Io<F> {
         }
 
         IoManager::unregister(self.io_ref());
+
+        // a panic while unwinding would abort
+        assert!(
+            !in_use || std::thread::panicking(),
+            "{}: Io is dropped while its filter is in use",
+            st.tag()
+        );
     }
 }
 
```

---

### Incident Patch 4: `19f4719f` (2026-10-03)
**Commit Message**: Fix test_listen_rustls test on windows

**File**: `ntex/tests/web_httpserver.rs` (modified, +1/-5)
```diff
@@ -474,11 +474,7 @@ async fn test_listen_rustls() {
     let (srv, sys) = rx.recv().unwrap();
 
     let client = client().await;
-    let response = client
-        .get(format!("https://localhost:{}", addr.port()))
-        .send()
-        .await
-        .unwrap();
+    let response = client.get(format!("https://{addr}")).send().await.unwrap();
     assert!(response.status().is_success());
 
     srv.stop(false).await;
```

---

### Incident Patch 5: `763a8bd6` (2026-10-03)
**Commit Message**: Reuse pipeline call future memory instead of allocating it for every call

**File**: `ntex-service/CHANGES.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # Changes
 
+## [Unreleased]
+
+* Reuse pipeline call future memory instead of allocating it for every call
+
 ## [5.1.0] - 2026-09-30
 
 * Fix use-after-free when a pipeline is dropped with pending readiness or shutdown future
```

**File**: `ntex-service/src/pipeline.rs` (modified, +3/-3)
```diff
@@ -1,7 +1,7 @@
 use std::{fmt, future, pin::Pin, task::Context, task::Poll};
 
-use crate::pl_inner::PipelineApi;
-use crate::{IntoService, Service, ServiceCaller, util::BoxFuture};
+use crate::pl_inner::{CallFuture, PipelineApi};
+use crate::{IntoService, Service, ServiceCaller};
 
 pub use crate::pl_factory::PipelineFactory;
 pub use crate::pl_state::{PipelineState, PipelineStateBinding};
@@ -199,7 +199,7 @@ impl<Req, Res, Err> Clone for PipelineBinding<Req, Res, Err> {
 /// the request is passed to the service as usual.
 pub struct PipelineCall<Req, Res, Err> {
     // `fut` borrows from `pl`, so it must be declared (and dropped) first
-    fut: BoxFuture<'static, Result<Res, Err>>,
+    fut: CallFuture<'static, Result<Res, Err>>,
     #[allow(dead_code)]
     pl: PipelineBinding<Req, Res, Err>,
 }
```

**File**: `ntex-service/src/pl_inner.rs` (modified, +210/-5)
```diff
@@ -1,4 +1,5 @@
-use std::{cell, future::Future, pin::Pin, ptr, rc::Rc, task::Context, task::Poll};
+use std::alloc::{Layout, alloc, dealloc, handle_alloc_error};
+use std::{cell, future::Future, pin::Pin, ptr, ptr::NonNull, rc::Rc, task::Context, task::Poll};
 
 use crate::{Ctx, Service, ctx::WaitersRef, util::BoxFuture};
 
@@ -18,6 +19,7 @@ impl<Req, Res, Err> PipelineApi<Req, Res, Err> {
             st,
             waiters: WaitersRef::new(),
             st_runtime: cell::UnsafeCell::new(RuntimeState::New),
+            calls: CallCache::default(),
         }))
     }
 
@@ -39,7 +41,7 @@ impl<Req, Res, Err> PipelineApi<Req, Res, Err> {
         self.0.ready(idx)
     }
 
-    pub(crate) fn call(&self, idx: u32, req: Req, ready: bool) -> BoxFuture<'_, Result<Res, Err>> {
+    pub(crate) fn call(&self, idx: u32, req: Req, ready: bool) -> CallFuture<'_, Result<Res, Err>> {
         self.0.call(idx, req, ready)
     }
 
@@ -69,6 +71,7 @@ struct PipelineInner<S: Service<St, Req>, St, Req> {
     st: St,
     st_runtime: cell::UnsafeCell<RuntimeState<S::Error>>,
     waiters: WaitersRef,
+    calls: CallCache,
 }
 
 impl<S: Service<St, Req>, St, Req> Drop for PipelineInner<S, St, Req> {
@@ -95,7 +98,7 @@ pub(crate) trait PipelineInternalApi<Req, Res, Err> {
 
     fn ready(&self, idx: u32) -> BoxFuture<'_, Result<(), Err>>;
 
-    fn call(&self, idx: u32, req: Req, ready: bool) -> BoxFuture<'_, Result<Res, Err>>;
+    fn call(&self, idx: u32, req: Req, ready: bool) -> CallFuture<'_, Result<Res, Err>>;
 
     fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Err>>;
 
@@ -126,8 +129,8 @@ where
         })
     }
 
-    fn call(&self, idx: u32, req: Req, ready: bool) -> BoxFuture<'_, Result<S::Res, S::Error>> {
-        Box::pin(async move {
+    fn call(&self, idx: u32, req: Req, ready: bool) -> CallFuture<'_, Result<S::Res, S::Error>> {
+        CallFuture::new_in(&self.calls, async move {
             if ready {
                 Ctx::<'_, S, St>::new(idx, &self.waiters, &self.st)
                     .call(&self.s, req)
@@ -253,6 +256,117 @@ where
     }
 }
 
+// ======================== CallFuture ============================
+
+/// Heap allocated service call future.
+///
+/// Futures created with [`CallFuture::new_in`] return their memory to a
+/// [`CallCache`] on drop, so subsequent calls can reuse it.
+pub(crate) struct CallFuture<'a, R> {
+    fut: NonNull<dyn Future<Output = R> + 'a>,
+    cache: Option<&'a CallCache>,
+}
+
+impl<'a, R> CallFuture<'a, R> {
+    fn new_in<F>(cache: &'a CallCache, fut: F) -> Self
+    where
+        F: Future<Output = R> + 'a,
+    {
+        if size_of::<F>() == 0 {
+            return Self::boxed(Box::pin(fut));
+        }
+        let ptr = cache.alloc(Layout::new::<F>()).cast::<F>();
+        // SAFETY: `ptr` is valid for writes of `F`
+        unsafe { ptr.as_ptr().write(fut) };
+        Self {
+            fut: ptr,
+            cache: Some(cache),
+        }
+    }
+
+    pub(crate) fn boxed(fut: BoxFuture<'a, R>) -> Self {
+        // SAFETY: the future is not moved out of its allocation, it is
+        // polled pinned and dropped in place
+        let fut = Box::into_raw(unsafe { Pin::into_inner_unchecked(fut) });
+        Self {
+            // SAFETY: `Box::into_raw` never returns null
+            fut: unsafe { NonNull::new_unchecked(fut) },
+            cache: None,
+        }
+    }
+}
+
+impl<R> Drop for CallFuture<'_, R> {
+    fn drop(&mut self) {
+        // SAFETY: `fut` points to a valid future that is owned by `self`
+        unsafe {
+            if let Some(cache) = self.cache {
+                let layout = Layout::for_value(self.fut.as_ref());
+                ptr::drop_in_place(self.fut.as_ptr());
+                cache.release(self.fut.cast(), layout);
+            } else {
+                drop(Box::from_raw(self.fut.as_ptr()));
+            }
+        }
+    }
+}
+
+impl<R> Future for CallFuture<'_, R> {
+    type Output = R;
+
+    #[inline]
+    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<R> {
+        // SAFETY: the future is heap allocated and never moves until it is dropped
+        unsafe { Pin::new_unchecked(&mut *self.fut.as_ptr()) }.poll(cx)
+    }
+}
+
+/// Keeps memory of the last completed call future.
+#[derive(Default)]
+pub(crate) struct CallCache(cell::Cell<Option<(NonNull<u8>, Layout)>>);
+
+impl CallCache {
+    fn alloc(&self, layout: Layout) -> NonNull<u8> {
+        match self.0.take() {
+            Some((ptr, l)) if l == layout => ptr,
+            cached => {
+                if let Some((ptr, l)) = cached {
+                    // SAFETY: `ptr` was allocated with layout `l`
+                    unsafe { dealloc(ptr.as_ptr(), l) };
+                }
+                // SAFETY: `layout` has non-zero size
+                NonNull::new(unsafe { alloc(layout) }).unwrap_or_else(|| handle_alloc_error(layout))
+            }
+        }
+    }
+
+    /// # Safety
+    ///
+    /// `ptr` must be
```

**File**: `ntex-service/src/pl_state.rs` (modified, +3/-3)
```diff
@@ -3,7 +3,7 @@ use std::{cell, fmt, future, pin::Pin, ptr, rc::Rc, task::Context, task::Poll};
 use crate::{Ctx, IntoService, Service, ctx::WaitersRef, util::BoxFuture};
 
 use crate::pipeline::PipelineBinding;
-use crate::pl_inner::{PipelineApi, PipelineInternalApi};
+use crate::pl_inner::{CallFuture, PipelineApi, PipelineInternalApi};
 
 /// Execution container for a service whose state is supplied per operation.
 ///
@@ -208,8 +208,8 @@ impl<St, Req, Res, Err> PipelineInternalApi<Req, Res, Err> for PipelineInternal<
         self.api.ready(idx, &self.st)
     }
 
-    fn call(&self, idx: u32, req: Req, ready: bool) -> BoxFuture<'_, Result<Res, Err>> {
-        self.api.call(idx, req, &self.st, ready)
+    fn call(&self, idx: u32, req: Req, ready: bool) -> CallFuture<'_, Result<Res, Err>> {
+        CallFuture::boxed(self.api.call(idx, req, &self.st, ready))
     }
 
     fn poll_ready(&self, _: &mut Context<'_>) -> Poll<Result<(), Err>> {
```

---

### Incident Patch 6: `5c695596` (2026-10-02)
**Commit Message**: Io::poll_recv_decode() reports a dispatcher timeout and write back-pressure before decoding

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ urly = { path = "urly" }
 ntex = "4.0.0-beta.15"
 ntex-bytes = "1.10.0"
 ntex-codec = "2.0.0"
-ntex-dispatcher = "4.1.0"
+ntex-dispatcher = "4.2.0"
 ntex-error = "3.0.0"
 ntex-h2 = "4.1.0"
 ntex-http = "1.3.0"
```

**File**: `ntex-dispatcher/CHANGES.md` (modified, +4/-1)
```diff
@@ -1,10 +1,13 @@
 # Changes
 
-## [4.1.1] - 2026-10-02
+## [4.2.0] - Unreleased
 
 * Keep the keep-alive timer armed while a frame is read or handled instead of
   registering it again for every frame
 
+* Decode input received together with a read timer expiry before handling the timeout, the
+  frame is dispatched and frame read progress is counted
+
 ## [4.1.0] - 2026-10-01
 
 * Add `Dispatcher::max_inflight()`, limits concurrent service calls
```

**File**: `ntex-dispatcher/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "ntex-dispatcher"
-version = "4.1.0"
+version = "4.2.0"
 authors = ["ntex contributors <team@ntex.rs>"]
 description = "Utilities for abstracting io streams dispatcher"
 keywords = ["network", "framework", "async", "futures"]
```

**File**: `ntex-dispatcher/src/lib.rs` (modified, +44/-2)
```diff
@@ -278,6 +278,37 @@ where
                                         return Poll::Pending;
                                     }
                                 }
+                                Err(RecvError::Timeout) if inner.timers.active != Timer::Write => {
+                                    // input received together with a read timer wins over
+                                    // its expiry, the buffered input is decoded first
+                                    match inner.shared.io.decode_item(&inner.shared.codec) {
+                                        Ok(decoded) => {
+                                            let timer = inner.timers.active;
+                                            inner.update_timer(&decoded);
+                                            if let Some(el) = decoded.item {
+                                                (DispatchItem::Item(el), true)
+                                            } else {
+                                                // a timer armed for the received input has
+                                                // not expired
+                                                if inner.timers.active == timer
+                                                    && let Err(ctl) = inner.handle_timeout()
+                                                {
+                                                    inner.st = inner.stop(ctl);
+                                                }
+                                                continue;
+                                            }
+                                        }
+                                        Err(err) => {
+                                            log::trace!(
+                                                "{}: Decoder error, stopping dispatcher: {:?}",
+                                                inner.shared.io.tag(),
+                                                err
+                                            );
+                                            inner.st = inner.stop(Reason::Decoder(err));
+                                            continue;
+                                        }
+                                    }
+                                }
                                 Err(RecvError::Timeout) => {
                                     if let Err(ctl) = inner.handle_timeout() {
                                         inner.st = inner.stop(ctl);
@@ -2165,10 +2196,21 @@ mod tests {
         delay: Millis,
         data: Arc<Mutex<RefCell<Vec<usize>>>>,
     ) -> Dispatcher<BCodec, ()> {
-        let io = Io::new(
+        keepalive_io_dispatcher(keepalive_io(server), delay, data)
+    }
+
+    fn keepalive_io(server: IoTest) -> Io {
+        Io::new(
             server,
             SharedCfg::new("TEST").add(IoConfig::new().set_keepalive_timeout(Seconds(1))),
-        );
+        )
+    }
+
+    fn keepalive_io_dispatcher(
+        io: Io,
+        delay: Millis,
+        data: Arc<Mutex<RefCell<Vec<usize>>>>,
+    ) -> Dispatcher<BCodec, ()> {
         Dispatcher::new(
             io,
             BCodec(8),
```

**File**: `ntex-io/CHANGES.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Changes
 
+## [Unreleased]
+
+* `Io::poll_recv_decode()` reports a dispatcher timeout and write back-pressure before
+  decoding, the decode result was dropped with the error. Neither is reported once the
+  connection is closing, buffered input is decoded before `PeerGone`
+
 ## [4.1.0] - 2026-10-01
 
 * The read buffer cache checks only the most recently released buffer instead of
```

**File**: `ntex-io/src/io.rs` (modified, +87/-7)
```diff
@@ -925,9 +925,14 @@ impl<F> Io<F> {
     /// returns `Ok` with `item` set to `None` after arranging for `cx` to be
     /// woken when progress is possible.
     ///
-    /// An error return does not register the waker. A successfully decoded item
-    /// takes precedence over timeout, backpressure, and peer-disconnect status
-    /// observed during the same poll.
+    /// An error return does not register the waker. While the connection is
+    /// open, an expired dispatcher timer and then active write backpressure are
+    /// reported before the read buffer is decoded, so an error never follows a
+    /// decode attempt and `Decoded` is never lost. The caller decides whether
+    /// input received together with a timeout is decoded first, see
+    /// [`IoRef::decode_item`](crate::IoRef::decode_item). Once the connection
+    /// is closing neither is reported, the buffered input is decoded and
+    /// `RecvError::PeerGone` is returned when no item is left.
     ///
     /// When the codec needs more input this goes through
     /// [`poll_read_more`](Self::poll_read_more), which releases read
@@ -943,6 +948,15 @@ impl<F> Io<F> {
         let st = self.st();
         st.flags.unset_read_ready();
 
+        let closed = st.flags.is_stopping() || st.flags.is_terminating();
+        if !closed {
+            if st.flags.check_dispatcher_timeout() {
+                return Err(RecvError::Timeout);
+            } else if st.flags.is_wr_backpressure() {
+                return Err(RecvError::WriteBackpressure);
+            }
+        }
+
         let decoded = self
             .decode_item(codec)
             .map_err(|err| RecvError::Decoder(err))?;
@@ -951,10 +965,6 @@ impl<F> Io<F> {
             Ok(decoded)
         } else if st.flags.is_stopping() || st.flags.is_terminating() {
             Err(RecvError::PeerGone(st.error()))
-        } else if st.flags.check_dispatcher_timeout() {
-            Err(RecvError::Timeout)
-        } else if st.flags.is_wr_backpressure() {
-            Err(RecvError::WriteBackpressure)
         } else {
             match self.poll_read_more(cx) {
                 Poll::Pending | Poll::Ready(Ok(Some(()))) => {
@@ -4135,6 +4145,76 @@ mod tests {
         assert_eq!(err, "invalid frame");
     }
 
+    /// An expired timer is reported before decoding, the buffered input is
+    /// left for the next attempt.
+    #[ntex::test]
+    async fn poll_recv_decode_reports_timeout_before_decoding() {
+        let (client, server) = IoTest::create();
+        client.remote_buffer_cap(1024);
+        let io = Io::new(server, SharedCfg::new("SRV"));
+
+        client.write("data");
+        sleep(Millis(25)).await;
+        io.st().notify_timeout();
+
+        let res = lazy(|cx| io.poll_recv_decode(&BytesCodec, cx)).await;
+        assert!(matches!(res, Err(RecvError::Timeout)));
+        assert_eq!(io.st().buffer.read_dst_size(), 4);
+
+        let decoded = lazy(|cx| io.poll_recv_decode(&BytesCodec, cx))
+            .await
+            .unwrap();
+        assert_eq!(decoded.item.unwrap(), "data");
+        assert_eq!((decoded.consumed, decoded.remains), (4, 0));
+    }
+
+    /// Write backpressure is reported before decoding, the buffered input is
+    /// left for the next attempt.
+    #[ntex::test]
+    async fn poll_recv_decode_reports_write_backpressure_before_decoding() {
+        let (client, server) = IoTest::create();
+        client.remote_buffer_cap(1024);
+        let io = Io::new(server, SharedCfg::new("SRV"));
+
+        client.write("data");
+        sleep(Millis(25)).await;
+        io.st().flags.set_wr_backpressure();
+
+        let res = lazy(|cx| io.poll_recv_decode(&BytesCodec, cx)).await;
+        assert!(matches!(res, Err(RecvError::WriteBackpressure)));
+        assert_eq!(io.st().buffer.read_dst_size(), 4);
+
+        io.flush(false).await.unwrap();
+        let decoded = lazy(|cx| io.poll_recv_decode(&BytesCodec, cx))
+            .await
+            .unwrap();
+        assert_eq!(decoded.item.unwrap(), "data");
+    }
+
+    /// A closing connection reports neither an expired timer nor write
+    /// backpressure, the buffered input is decoded before the disconnect.
+    #[ntex::test]
+    async fn poll_recv_decode_closing_decodes_buffered_input() {
+        let (client, server) = IoTest::create();
+        client.remote_buffer_cap(1024);
+        let io = Io::new(server, SharedCfg::new("SRV"));
+
+        client.write("data");
+        sleep(Millis(25)).await;
+        io.close();
+        sleep(Millis(25)).await;
+        io.st().notify_timeout();
+        io.st().flags.set_wr_backpressure();
+
+        let decoded = lazy(|cx| io.poll_recv_decode(&BytesCodec, cx))
+            .await
+            .unwrap();
+        assert_eq!(decoded.item.unwrap(), "data");
+
+        let res = lazy(|cx| io.poll_recv_decode(&BytesCodec, cx)).await;
+        assert!(matches!(res, Err(RecvError::PeerGone(None))));
+    }
+
     #[ntex::test]
     async fn poll_flush
```

**File**: `ntex/CHANGES.md` (modified, +8/-0)
```diff
@@ -1,5 +1,13 @@
 # Changes
 
+## [Unreleased]
+
+* http/1: Request heads are not decoded during write back-pressure, request payload is
+  still read
+
+* http/1: Fix headers read rate undercounting bytes consumed by a partial request head
+  decode
+
 ## [4.0.0-beta.14] - 2026-10-01
 
 * Migrate to `ntex-service` 5 and its typed service state model. Service
```

**File**: `ntex/src/http/h1/dispatcher.rs` (modified, +182/-33)
```diff
@@ -238,11 +238,30 @@ where
             log::trace!("{}: Trying to read http message", self.io.tag());
             self.release_write_timer();
 
-            let buffered = self.io.with_read_dst(|buf| buf.len()) as u32;
-            self.timers.headers_buffered(buffered);
+            let (result, timeout) = match self.io.poll_recv_decode(&self.codec, cx) {
+                // a request head received together with a read timer wins over
+                // its expiry, the buffered input is decoded first
+                Err(RecvError::Timeout)
+                    if !self.timers.active.is_write() && self.timers.active != Timer::Idle =>
+                {
+                    let result = self.io.decode_item(&self.codec);
+                    (result.map_err(RecvError::Decoder), true)
+                }
+                result => (result, false),
+            };
 
-            let result = match self.io.poll_recv_decode(&self.codec, cx) {
+            let result = match result {
                 Ok(decoded) => {
+                    self.timers.headers_decoded(
+                        (decoded.consumed + decoded.remains) as u32,
+                        decoded.remains as u32,
+                    );
+                    if timeout && decoded.item.is_none() {
+                        match self.headers_timeout(&decoded) {
+                            Ok(()) => continue,
+                            Err(st) => return Poll::Ready(st),
+                        }
+                    }
                     if let Some(st) = self.update_hdrs_timer(&decoded) {
                         return Poll::Ready(st);
                     }
@@ -306,30 +325,10 @@ where
                         } else {
                             continue;
                         }
-                    } else if self.timers.active == Timer::Idle {
+                    } else {
                         // expiry of the keep-alive timer left armed for the
                         // previous request
                         continue;
-                    } else if self.timers.active == Timer::Headers {
-                        if let Err(err) = self.handle_timeout() {
-                            log::trace!("{}: Slow request timeout", self.io.tag());
-                            self.ctl_proto_err(err)
-                        } else {
-                            continue;
-                        }
-                    } else if self.start_headers_timer(
-                        self.codec.is_reading_hdrs(),
-                        buffered,
-                        self.io.with_read_dst(|buf| buf.len()) as u32,
-                    ) {
-                        // a partial request head wins over keep-alive or client timeout
-                        continue;
-                    } else if self.timers.active == Timer::ClientTimeout {
-                        log::trace!("{}: Client timeout, no request", self.io.tag());
-                        self.ctl_proto_err(ProtocolError::SlowRequestTimeout)
-                    } else {
-                        log::trace!("{}: Keep-alive timeout, close connection", self.io.tag());
-                        self.ctl_keepalive(true)
                     }
                 }
             };
@@ -560,14 +559,38 @@ where
             Poll::Ready(bstream::Status::Ready) => {
                 // read request payload
                 let mut updated = false;
+                let mut pending = None;
                 self.release_write_timer();
-                loop {
-                    let buffered = self.io.with_read_dst(|buf| buf.len());
-                    let Some((payload_codec, sender)) = self.payload.as_mut() else {
-                        break;
+                while let Some((payload_codec, sender)) = self.payload.as_mut() {
+                    let result = if pending.is_some() {
+                        self.io
+                            .decode_item(payload_codec)
+                            .map_err(RecvError::Decoder)
+                    } else {
+                        self.io.poll_recv_decode(payload_codec, cx)
+                    };
+                    let result = match result {
+                        // the request payload is read regardless of write
+                        // backpressure, and payload received together with a
+                        // read timer wins over its expiry, the buffered input
+                        // is decoded first
+                        Err(err @ RecvError::WriteBackpressure) => {
+                            pending = Some(err);
+                            continue;
+                        }
+                        Err(err @ RecvError::Timeout) if !self.timers.active.is_write() => {
+                            pending = Some(err);
+                            continue;
+                        }
+                        Ok(decoded) if decoded.item.is_none() && pending.is_some() => {
+                            // the decode att
```

---

### Incident Patch 7: `d00a4948` (2026-10-02)
**Commit Message**: Fix compatibility (#1072)

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -55,7 +55,7 @@ ntex-h2 = "4.1.0"
 ntex-http = "1.3.0"
 ntex-io = "4.1.0"
 ntex-macros = "4.0.0"
-ntex-net = "4.1.0"
+ntex-net = "4.1.1"
 ntex-router = "2.0.0"
 ntex-rt = "4.1.0"
 ntex-server = "4.2.0"
@@ -65,7 +65,7 @@ ntex-util = "4.2.0"
 
 ntex-io-uring = "0.8.7150"
 ntex-httparse = "2.2.0"
-ntex-polling = "3.11.2"
+ntex-polling = "4.0.0"
 
 async-channel = "2"
 async-task = "4.5.0"
```

**File**: `ntex-net/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "ntex-net"
-version = "4.1.0"
+version = "4.1.1"
 authors = ["ntex contributors <team@ntex.rs>"]
 description = "ntexwork utils for ntex framework"
 keywords = ["network", "framework", "async", "futures"]
```

---

### Incident Patch 8: `8f219cda` (2026-09-30)
**Commit Message**: More fixes (#1063)

* Reading pauses while output a filter produced during read processing
* HTTP/1 server keeps reading the request payload after the response is sent until the payload completes
* HTTP/1 '101 Switching Protocols' response body is sent without framing
* openssl: reading does not report already buffered output as output produced by reading
* read_more and read_notify should lift the new pause
* HTTP/1 dispatcher observes a connection failure while the response body is pending
* openssl: do not drop application data when a write reports WANT_READ during a handshake
* HTTP/1 server rejects an asterisk-form request target
* polling: shut the socket down inline
* Output a filter holds back
* HTTP/1 server rejects an authority-form request target for methods
* HTTP/1 server accepts an authority-form request target
* HTTP/1 dispatcher drops an idle streaming response body and closes the connection when the client half-closes it
* Bytes, String, Json and Form extractors return a single-chunk body without copying
* Compress::default() negotiates only encodings the encoder supports
* Response body encoder stops after the end of the body stream
* Update migration guide
* Io::

**File**: `.github/workflows/checks.yml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ jobs:
         with:
           toolchain: stable
       - run:
-          cargo check --tests --all --no-default-features --features="ntex/neon,ntex/cookie,ntex/url,ntex/compress,ntex/openssl,ntex/rustls,ntex/ws"
+          cargo check --tests --all --no-default-features --features="ntex/cookie,ntex/url,ntex/compress,ntex/openssl,ntex/rustls,ntex/ws"
 
   clippy-polling:
     name: Clippy (neon)
```

**File**: `.github/workflows/cov.yml` (modified, +3/-7)
```diff
@@ -42,19 +42,15 @@ jobs:
         run: cargo +nightly llvm-cov nextest --no-report --retries=3 --all --no-default-features --features="ntex/neon-uring,ntex/cookie,ntex/url,ntex/compress,ntex/openssl,ntex/rustls,ntex/ws"
 
       - name: Code coverage (tokio)
-        uses: nick-fields/retry@v3
-        with:
-          timeout_minutes: 10
-          max_attempts: 3
-          retry_on: error
-          command: cargo +nightly llvm-cov test --no-report --doctests --all --no-default-features --features="ntex/tokio,ntex/cookie,ntex/url,ntex/compress,ntex/openssl,ntex/rustls,ntex/ws"
+        timeout-minutes: 10
+        run: cargo +nightly llvm-cov nextest --no-report --retries=3 --all --no-default-features --features="ntex/tokio,ntex/cookie,ntex/url,ntex/compress,ntex/openssl,ntex/rustls,ntex/ws"
 
       - name: Code coverage (compio)
         timeout-minutes: 10
         run: cargo +nightly llvm-cov nextest --no-report --retries=3 --all --no-default-features --features="ntex/compio,ntex/cookie,ntex/url,ntex/compress,ntex/openssl,ntex/rustls,ntex/ws"
 
       - name: Generate coverage report
-        run: cargo +nightly llvm-cov report --doctests --lcov --output-path lcov.info
+        run: cargo +nightly llvm-cov report --lcov --output-path lcov.info
 
       - name: Upload coverage to Codecov
         uses: codecov/codecov-action@v5
```

**File**: `.github/workflows/miri.yml` (modified, +7/-0)
```diff
@@ -33,12 +33,19 @@ jobs:
         run: cargo miri test -p ntex-bytes
 
       - name: Run Miri (bytes, big-endian)
+        continue-on-error: true
         run: cargo miri test -p ntex-bytes --target s390x-unknown-linux-gnu
 
       - name: Run Miri (ntex-service::cfg)
         # Run all of your tests inside of Miri interpreter
         run: cargo miri test -p ntex-service -- --test "cfg::tests::"
 
+      - name: Run Miri (ntex-service::pipeline)
+        # Pipelines are self-referential, which Stacked Borrows rejects
+        env:
+          MIRIFLAGS: -Zmiri-disable-stacked-borrows
+        run: cargo miri test -p ntex-service -- --test "miri_"
+
       - name: Run Miri (ntex-io)
         # Run all of your tests inside of Miri interpreter
         run: cargo miri test -p ntex-io -- --test "miri_"
```

**File**: `.github/workflows/windows.yml` (modified, +4/-4)
```diff
@@ -74,15 +74,15 @@ jobs:
           Get-ChildItem C:\vcpkg\installed\x64-windows\bin
           Get-ChildItem C:\vcpkg\installed\x64-windows\lib
 
-      - name: Clippy (neon-iocp)
+      - name: Clippy (neon)
         if: matrix.version == 'stable'
         run: |
-          cargo clippy --all --no-default-features --features="ntex/neon-iocp,ntex/cookie,ntex/url,ntex/compress,ntex/openssl,ntex/rustls,ntex/ws"
+          cargo clippy --all --no-default-features --features="ntex/cookie,ntex/url,ntex/compress,ntex/openssl,ntex/rustls,ntex/ws"
 
-      - name: Run tests (neon-iocp)
+      - name: Run tests (neon)
         timeout-minutes: 10
         run: |
-          cargo nextest run --retries=3 --all --no-default-features --no-fail-fast --features="ntex/neon-iocp,ntex/cookie,ntex/url,ntex/compress,ntex/openssl,ntex/rustls,ntex/ws"
+          cargo nextest run --retries=3 --all --no-default-features --no-fail-fast --features="ntex/cookie,ntex/url,ntex/compress,ntex/openssl,ntex/rustls,ntex/ws"
 
       - name: Run tests (tokio)
         timeout-minutes: 10
```

**File**: `Cargo.toml` (modified, +3/-16)
```diff
@@ -18,14 +18,6 @@ members = [
   "ntex-util",
 ]
 
-[workspace.package]
-authors = ["ntex contributors <team@ntex.rs>"]
-repository = "https://github.com/ntex-rs/ntex"
-documentation = "https://docs.rs/ntex/"
-license = "MIT OR Apache-2.0"
-edition = "2024"
-rust-version = "1.97"
-
 [workspace.lints.rust]
 async_fn_in_trait = { level = "allow", priority = -1 }
 unknown_lints = { level = "allow", priority = -1 }
@@ -54,14 +46,14 @@ ntex-macros = { path = "ntex-macros" }
 ntex-util = { path = "ntex-util" }
 
 #ntex-h2 = { path = "../dev/ntex-h2" }
-ntex-h2 = { git = "https://github.com/ntex-rs/ntex-h2.git", branch = "refine-api" }
+ntex-h2 = { git = "https://github.com/ntex-rs/ntex-h2.git" }
 
 [workspace.dependencies]
 ntex = "4.0.0-beta.14"
 ntex-bytes = "1.10.0"
 ntex-codec = "2.0.0"
 ntex-dispatcher = "4.1.0"
-ntex-error = "2.7.0"
+ntex-error = "3.0.0"
 ntex-h2 = "4.1.0"
 ntex-http = "1.2.0"
 ntex-io = "4.1.0"
@@ -70,7 +62,7 @@ ntex-net = "4.1.0"
 ntex-router = "2.0.0"
 ntex-rt = "4.0.0"
 ntex-server = "4.2.0"
-ntex-service = "5.0.1"
+ntex-service = "5.1.0"
 ntex-tls = "4.1.0"
 ntex-util = "4.2.0"
 
@@ -85,11 +77,9 @@ backtrace = "0.3.76"
 bytes = "1.11.0"
 bincode = "1.3.3"
 base64 = "0.22"
-cookie = "0.18"
 coo-kie = { version = "0.18", package = "cookie" }
 core_affinity = "0.8"
 bitflags = "2"
-cfg_aliases = "0.2.1"
 cfg-if = "1.0.0"
 crossbeam-channel = "0.5.8"
 crossbeam-queue = "0.3.8"
@@ -113,7 +103,6 @@ log = "0.4"
 mime = "0.3"
 nix = "0.31.3"
 oneshot = { version = "0.2.1", features = ["std", "async"] }
-openssl = "0.10"
 tls_openssl = { version = "0.10", package = "openssl" }
 openssl-sys = "0.9"
 foreign-types-shared = "0.1"
@@ -127,7 +116,6 @@ rand = "0.9"
 regex = { version = "1.11", default-features = false, features = ["std"] }
 rustls-pemfile = "2"
 tls_rustls = { version = "0.23", package = "rustls", default-features = false }
-nohash-hasher = "0.2.0"
 nanorand = { version = "0.8", default-features = false, features = [
     "std",
     "wyrand",
@@ -152,7 +140,6 @@ time = "0.3.54"
 thiserror = "2"
 tok-io = { version = "1", package = "tokio", default-features = false }
 webpki-roots = "1.0"
-url = "2.5.2"
 url-pkg = { version = "2.5.2", package = "url" }
 uuid = { version = "1.19", features = ["v7"] }
 
```

**File**: `README.md` (modified, +1/-2)
```diff
@@ -66,9 +66,8 @@ Alternative runtimes and native reactors can be selected with Cargo features:
 | --- | --- |
 | `tokio` | Tokio local runtime and I/O driver |
 | `compio` | Compio runtime and completion-based I/O |
-| `neon-polling` | Native runtime with the polling reactor |
+| `neon-polling` | Native runtime with the polling reactor on Unix |
 | `neon-uring` | Native runtime with `io_uring` on Linux |
-| `neon-iocp` | Native runtime with IOCP on Windows |
 
 Enable at most one runtime or native-reactor selection feature. For example:
 
```

**File**: `docs/3-state.md` (modified, +2/-1)
```diff
@@ -182,7 +182,8 @@ async fn main() {
 Use `Pipeline` when one state value should remain attached to the service. Use
 `PipelineState` when the same service and readiness machinery must operate with
 a state selected by each caller. `PipelineState::bind_state()` can attach an
-owned state value and produce a normal `PipelineBinding`.
+owned state value and produce a normal `PipelineBinding`, the state type must
+implement `Clone`.
 
 ## Carrying state with a request
 
```

**File**: `docs/4-runtime.md` (modified, +7/-4)
```diff
@@ -66,11 +66,11 @@ selects an I/O reactor based on the current platform:
 
 You can select a specific native reactor through a Cargo feature:
 
-- `neon-polling` selects the polling reactor.
-- `neon-uring` selects the `io_uring` reactor on Linux.
-- `neon-iocp` selects the IOCP reactor on Windows.
+- `neon-polling` selects the polling reactor on Unix platforms.
+- `neon-uring` selects the `io_uring` reactor. It is available only on Linux.
 
-The reactor-selection features are intended to be mutually exclusive.
+The reactor-selection features are intended to be mutually exclusive. Windows
+always uses IOCP and has no reactor-selection feature.
 
 For example, to use the polling reactor:
 
@@ -174,6 +174,9 @@ You can customize how the system's root future is driven by implementing the
 [`Runner`](https://docs.rs/ntex-rt/latest/ntex_rt/trait.Runner.html) trait:
 
 ```rust
+use std::any::Any;
+use ntex::rt::BlockFuture;
+
 trait Runner: Send + Sync + 'static {
     fn block_on(&self, fut: BlockFuture) -> Result<(), Box<dyn Any + Send>>;
 }
```

---

### Incident Patch 9: `7e8e49c8` (2026-09-15)
**Commit Message**: Update names and fix InternalError impl (#1028)

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -54,8 +54,7 @@ ntex-macros = { path = "ntex-macros" }
 ntex-util = { path = "ntex-util" }
 
 [workspace.dependencies]
-ntex = "4.0.0-beta.12"
-ntex-macros = "4.0.0-beta.6"
+ntex = "4.0.0-beta.13"
 
 ntex-bytes = "1.9.0"
 ntex-codec = "1.2.1"
@@ -64,10 +63,11 @@ ntex-error = "2.6.0"
 ntex-h2 = "4.0.0"
 ntex-http = "1.2.0"
 ntex-io = "4.0.0"
+ntex-macros = "4.0.0"
 ntex-net = "4.0.0"
 ntex-router = "1.1.0"
 ntex-rt = "3.17.1"
-ntex-server = "4.0.0"
+ntex-server = "4.1.0"
 ntex-service = "5.0.0"
 ntex-tls = "4.0.0"
 ntex-util = "4.0.0"
```

**File**: `ntex-macros/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "ntex-macros"
-version = "4.0.0-beta.6"
+version = "4.0.0"
 description = "ntex proc macros"
 readme = "README.md"
 authors = ["ntex contributors <team@ntex.rs>"]
```

**File**: `ntex-server/CHANGES.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Changes
 
+## [4.1.0] - 2026-09-14
+
+* Move ServerAppConfig to root
+
+* Rename `build_with_config()` helper
+
 ## [4.0.0] - 2026-09-14
 
 * Refactor server state creation process
```

**File**: `ntex-server/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "ntex-server"
-version = "4.0.0"
+version = "4.1.0"
 authors = ["ntex contributors <team@ntex.rs>"]
 description = "Server for ntex framework"
 keywords = ["network", "framework", "async", "futures"]
```

**File**: `ntex-server/src/lib.rs` (modified, +2/-0)
```diff
@@ -15,10 +15,12 @@ mod manager;
 pub mod net;
 mod pool;
 mod server;
+mod state;
 mod wrk;
 
 pub use self::pool::WorkerPool;
 pub use self::server::Server;
+pub use self::state::{NoConfig, ServerAppConfig};
 pub use self::wrk::{Worker, WorkerStatus, WorkerStop};
 
 /// Worker id
```

**File**: `ntex-server/src/net/builder.rs` (modified, +1/-2)
```diff
@@ -6,12 +6,11 @@ use ntex_service::{IntoService, Service, cfg::SharedCfg};
 use ntex_util::time::Millis;
 use socket2::{Domain, SockAddr, Socket, Type};
 
-use crate::{Server, WorkerPool};
+use crate::{NoConfig, Server, ServerAppConfig, WorkerPool};
 
 use super::accept::AcceptLoop;
 use super::config::ServiceConfig;
 use super::factory::{self, FactoryServiceType};
-use super::state::{NoConfig, ServerAppConfig};
 use super::{Connection, ServerStatus, StreamServer, Token, socket::Listener};
 
 /// Streaming service builder
```

**File**: `ntex-server/src/net/mod.rs` (modified, +4/-4)
```diff
@@ -9,15 +9,15 @@ mod config;
 mod factory;
 mod service;
 mod socket;
-mod state;
 mod test;
 
+pub use crate::{NoConfig, ServerAppConfig};
+
 pub use self::accept::{AcceptLoop, AcceptNotify, AcceptorCommand};
 pub use self::builder::{ServerBuilder, bind_addr, create_tcp_listener};
 pub use self::config::{ServiceConfig, ServiceRuntime};
 pub use self::service::StreamServer;
 pub use self::socket::{Connection, Stream};
-pub use self::state::{NoConfig, ServerAppConfig};
 pub use self::test::{TestServer, TestServerBuilder, build_test_server, test_server};
 
 pub type Server = crate::Server<Connection>;
@@ -50,8 +50,8 @@ pub fn build() -> ServerBuilder {
     ServerBuilder::default()
 }
 
-/// Start server with state building process
-pub fn build_with_cfg<Cfg>(state: Cfg) -> ServerBuilder<Cfg>
+/// Start server with configuration
+pub fn build_with_config<Cfg>(state: Cfg) -> ServerBuilder<Cfg>
 where
     Cfg: ServerAppConfig,
 {
```

**File**: `ntex-server/src/net/service.rs` (modified, +1/-2)
```diff
@@ -3,11 +3,10 @@ use std::{fmt, io, sync::Arc};
 use ntex_service::{Ctx, Service, cfg::SharedCfg};
 use ntex_util::{HashMap, future::join_all, services::Counter};
 
-use crate::ServerConfiguration;
+use crate::{ServerAppConfig, ServerConfiguration};
 
 use super::accept::{AcceptNotify, AcceptorCommand};
 use super::factory::{FactoryServiceType, NetService};
-use super::state::ServerAppConfig;
 use super::{MAX_CONNS_COUNTER, Token, socket::Connection};
 
 /// Net streaming server
```

#### Recent Merged Pull Requests:
- **PR #1084** (2026-10-05): Update test (@fafhrd91)
- **PR #1083** (2026-10-05): Urly parse (@fafhrd91)
- **PR #1082** (2026-10-05): Handle filter readiness (@fafhrd91)
- **PR #1081** (2026-10-05): Prepare release (@fafhrd91)
- **PR #1080** (2026-10-05): Various http optimizations (@fafhrd91)
- **PR #1079** (2026-10-04): Prepera net release (@fafhrd91)
- **PR #1078** (2026-10-04): Prepare releases (@fafhrd91)
- **PR #1077** (2026-10-04): Replace http::Uri with urly::Url (@fafhrd91)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
