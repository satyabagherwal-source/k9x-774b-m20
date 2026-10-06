# Forensic Learning Record (Deep Inspection): salvo-rs/salvo

> **Canonical Artifact**: `07_PROJECT_LEARNING/salvo-rs-salvo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/salvo-rs/salvo](https://github.com/salvo-rs/salvo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:42:47.492Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `salvo-rs/salvo`
- **Description**: A powerful web framework built with a simplified design.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4438 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/core/benches/router_detect.rs`
```
#![allow(missing_docs)]
//! Benchmarks for the routing hot path: `Router::detect`.
//!
//! Scenarios cover the shapes that stress different parts of the matcher:
//! flat static routes, dynamic params, deep nesting, wide sibling fan-out
//! (worst case for the linear scan), and wildcard tails. Run with
//! `cargo bench -p salvo_core --bench router_detect`.

use std::hint::black_box;

use criterion::{Criterion, criterion_group, criterion_main};
use salvo_core::routing::PathState;
use salvo_core::test::TestClient;
use salvo_core::{Router, handler};

#[handler]
async fn goal() -> &'static str {
    "ok"
}

fn bench_detect(c: &mut Criterion, name: &str, router: &Router, url: &str) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .build()
        .expect("build runtime");
    let mut req = TestClient::get(url).build();
    let path = req.uri().path().to_owned();
    c.bench_function(name, |b| {
        b.iter(|| {
            let mut state = PathState::from_borrowed_path(&path);
            let matched = rt.block_on(router.detect(&mut req, &mut state));
            assert!(matched.is_some(), "route must match in benchmark");
            black_box(state);
        });
    });
}

fn static_shallow(c: &mut Criterion) {
    let router = Router::new()
        .push(Router::with_path("users").goal(goal))
        .push(Router::with_path("articles").goal(goal))
        .push(Router::with_path("health").goal(goal));
    bench_detect(c, "detect/static_shallow", &router, "http://t.dev/health");
}

fn dynamic_params(c: &mut Criterion) {
    let router = Router::new().push(
        Router::with_path("users").push(
            Router::with_path("{id}")
                .push(Router::with_path("articles").push(Router::with_path("{aid}").goal(goal))),
        ),
    );
    bench_detect(
        c,
        "detect/dynamic_params",
        &router,
        "http://t.dev/users/12345/articles/67890",
    );
}

fn deep_tree(c: &mut Criterion) {
    // Eight nested levels alternating static and param segments.
    let mut leaf = Router::with_path("leaf").goal(goal);
    for level in (0..8).rev() {
        let seg = if level % 2 == 0 {
            format!("level{level}")
        } else {
            format!("{{p{level}}}")
        };
        leaf = Router::with_path(seg).push(leaf);
    }
    let router = Router::new().push(leaf);
    bench_detect(
        c,
        "detect/deep_tree",
        &router,
        "http://t.dev/level0/v1/level2/v3/level4/v5/level6/v7/leaf",
    );
}

fn wide_siblings(c: &mut Criterion) {
    // 100 sibling routes under one parent; the request matches the last one,
    // which is the worst case for the linear sibling scan.
    let mut parent = Router::with_path("api");
    for i in 0..100 {
        parent = parent.push(Router::with_path(format!("res{i:03}")).goal(goal));
    }
    let router = Router::new().push(parent);
    bench_detect(
        c,
        "detect/wide_siblings_last",
        &router,
        "http://t.dev/api/res099",
    );
}

fn wildcard_tail(c: &mut Criterion) {
    let router = Router::new().push(Router::with_path("assets/{**rest}").goal(goal));
    bench_detect(
        c,
        "detect/wildcard_tail",
        &router,
        "http://t.dev/assets/css/site/theme/main.css",
    );
}

fn sibling_param_backtrack(c: &mut Criterion) {
    // Earlier siblings capture params and then fail on a deeper segment,
    // exercising the snapshot/rollback path before the last sibling matches.
    let router = Router::new().push(
        Router::with_path("users")
            .push(Router::with_path("{id}/profile").goal(goal))
            .push(Router::with_path("{id}/settings").goal(goal))
            .push(Router::with_path("{name}").goal(goal)),
    );
    bench_detect(
        c,
        "detect/sibling_param_backtrack",
        &router,
        "http://t.dev/users/alice",
    );
}

fn benches(c: &mut Criterion) {
    static_shallow(c);
    dynamic_params(c);
    deep_tree(c);
    wide_siblings(c);
    wildcard_tail(c);
    sibling_param_backtrack(c);
}

criterion_group!(router_detect, benches);
criterion_main!(router_detect);

```

### Core Architecture Module: `crates/core/benches/service_dispatch.rs`
```
#![allow(missing_docs)]
//! Benchmarks for full request dispatch through `Service`.
//!
//! Unlike `router_detect`, these cover the whole per-request pipeline:
//! routing, hoop-chain assembly, `FlowCtrl` execution, and response
//! rendering. Run with `cargo bench -p salvo_core --bench service_dispatch`.

use std::hint::black_box;

use criterion::{Criterion, criterion_group, criterion_main};
use salvo_core::prelude::*;
use salvo_core::test::TestClient;

#[handler]
async fn hello() -> &'static str {
    "hello"
}

#[handler]
async fn noop_hoop() {}

fn bench_dispatch(c: &mut Criterion, name: &str, service: &Service, url: &str) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .build()
        .expect("build runtime");
    c.bench_function(name, |b| {
        b.iter(|| {
            let res = rt.block_on(async { TestClient::get(url).send(service).await });
            assert_eq!(res.status_code, Some(StatusCode::OK));
            black_box(res);
        });
    });
}

fn plain(c: &mut Criterion) {
    let service = Service::new(Router::new().push(Router::with_path("hello").get(hello)));
    bench_dispatch(c, "dispatch/plain", &service, "http://t.dev/hello");
}

fn hoop_chain(c: &mut Criterion) {
    // Eight no-op middleware on the matched branch: measures hoop-chain
    // assembly and FlowCtrl traversal overhead.
    let mut router = Router::with_path("hello");
    for _ in 0..8 {
        router = router.hoop(noop_hoop);
    }
    let service = Service::new(Router::new().push(router.get(hello)));
    bench_dispatch(c, "dispatch/hoops8", &service, "http://t.dev/hello");
}

fn dynamic_path(c: &mut Criterion) {
    let service =
        Service::new(Router::new().push(
            Router::with_path("users").push(
                Router::with_path("{id}").push(
                    Router::with_path("articles").push(Router::with_path("{aid}").get(hello)),
                ),
            ),
        ));
    bench_dispatch(
        c,
        "dispatch/dynamic_path",
        &service,
        "http://t.dev/users/12345/articles/67890",
    );
}

fn benches(c: &mut Criterion) {
    plain(c);
    hoop_chain(c);
    dynamic_path(c);
}

criterion_group!(service_dispatch, benches);
criterion_main!(service_dispatch);

```

### Core Architecture Module: `crates/core/src/catcher.rs`
```
//! Error catching and custom error page handling.
//!
//! When a [`Response`] has an error status code (4xx or 5xx) and an empty body,
//! Salvo uses a `Catcher` to generate a user-friendly error page.
//!
//! # Overview
//!
//! The catcher system provides:
//!
//! - **Default error pages** in multiple formats (HTML, JSON, XML, Plain text)
//! - **Custom error handlers** for specific status codes or error types
//! - **Middleware-style chaining** of error handlers
//! - **Content negotiation** based on the `Accept` header
//!
//! # Basic Usage
//!
//! Add a default catcher to your service:
//!
//! ```no_run
//! use salvo_core::catcher::Catcher;
//! use salvo_core::prelude::*;
//!
//! #[handler]
//! async fn hello() -> &'static str {
//!     "hello"
//! }
//!
//! let router = Router::new().get(hello);
//! let _service = Service::new(router).catcher(Catcher::default());
//! ```
//!
//! # Custom Error Handlers
//!
//! Create custom handlers for specific errors:
//!
//! ```
//! use salvo_core::catcher::Catcher;
//! use salvo_core::prelude::*;
//!
//! #[handler]
//! async fn handle404(res: &mut Response, ctrl: &mut FlowCtrl) {
//!     if let Some(StatusCode::NOT_FOUND) = res.status_code {
//!         res.render("custom 404 error page");
//!         ctrl.skip_rest();
//!     }
//! }
//!
//! let _service = Service::new(Router::new()).catcher(Catcher::default().hoop(handle404));
//! ```
//!
//! # Multiple Error Handlers
//!
//! Chain multiple handlers for different error types:
//!
//! ```
//! use salvo_core::catcher::Catcher;
//! use salvo_core::prelude::*;
//!
//! #[handler]
//! async fn handle404(_res: &mut Response) {}
//!
//! #[handler]
//! async fn handle500(_res: &mut Response) {}
//!
//! #[handler]
//! async fn handle_api_errors(_res: &mut Response) {}
//!
//! let catcher = Catcher::default()
//!     .hoop(handle404)
//!     .hoop(handle500)
//!     .hoop(handle_api_errors);
//! let _ = catcher;
//! ```
//!
//! Handlers are called in order. Use [`FlowCtrl::skip_rest()`] to stop processing.
//!
//! # Response Formats
//!
//! The default [`Catcher`] supports sending error pages in multiple formats
//! based on the request's `Accept` header:
//!
//! | Accept Header | Response Format |
//! |---------------|-----------------|
//! | `text/html` | HTML page with styling |
//! | `application/json` | JSON object |
//! | `application/xml` | XML document |
//! | `text/plain` | Plain text |
//!
//! # Environment Variables
//!
//! Control error detail visibility with `SALVO_STATUS_ERROR`:
//!
//! ```sh
//! # Show full details (not recommended for production)
//! SALVO_STATUS_ERROR=force_detail,force_cause
//!
//! # Show details only in debug builds
//! SALVO_STATUS_ERROR=debug_detail,debug_cause
//!
//! # Never show details (secure default)
//! SALVO_STATUS_ERROR=never_detail,never_cause
//! ```
//!
//! Options:
//! - `force_detail` / `debug_detail` / `never_detail`: Control error detail visibility
//! - `force_cause` / `debug_cause` / `never_cause`: Control error cause visibility

use std::borrow::Cow;
use std::collections::HashSet;
use std::env;
use std::fmt::{self, Debug, Formatter};
use std::sync::{Arc, LazyLock};

use async_trait::async_trait;
use bytes::Bytes;
use mime::Mime;
use serde::Serialize;

use crate::handler::{Handler, WhenHoop};
use crate::http::mime::guess_accept_mime;
use crate::http::{Request, ResBody, Response, StatusCode, StatusError, header};
use crate::{Depot, FlowCtrl};

static SUPPORTED_FORMATS: LazyLock<Vec<mime::Name>> =
    LazyLock::new(|| vec![mime::JSON, mime::HTML, mime::XML, mime::PLAIN]);
static STATUS_ERROR_SETS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    HashSet::from([
        "force_detail",
        "debug_detail",
        "never_detail",
        "force_cause",
        "debug_cause",
        "never_cause",
    ])
});

/// Cached parsed `SALVO_STATUS_ERROR` environment variable options.
static PARSED_ENV_SETS: LazyLock<HashSet<String>> = LazyLock::new(|| {
    env::var("SALVO_STATUS_ERROR")
        .unwrap_or_default()
        .split(',')
        .filter_map(|s| {
            let s = s.trim().to_lowercase();
            if STATUS_ERROR_SETS.contains(s.as_str()) {
                Some(s)
            } else if s.is_empty() {
                None
            } else {
                tracing::warn!("unknown SALVO_STATUS_ERROR option: {}", s);
                None
            }
        })
        .collect::<HashSet<_>>()
});
const SALVO_LINK: &str = r#"<a href="https://salvo.rs" target="_blank">salvo</a>"#;

/// `Catcher` is used to catch errors.
///
/// View [module level documentation](index.html) for more details.
pub struct Catcher {
    goal: Arc<dyn Handler>,
    hoops: Vec<Arc<dyn Handler>>,
}
impl Default for Catcher {
    /// Creates a new `Catcher` with [`DefaultGoal`] as its handler.
    fn default() -> Self {
        Self {
            goal: Arc::new(DefaultGoal::new()),
            hoops: vec![],
        }
    }
}
impl Debug for Catcher {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("Catcher").finish()
    }
}
impl Catcher {
    /// Creates a new `Catcher`.
    pub fn new<H: Handler>(goal: H) -> Self {
        Self {
            goal: Arc::new(goal),
            hoops: vec![],
        }
    }

    /// Get current catcher's middlewares reference.
    #[inline]
    #[must_use]
    pub fn hoops(&self) -> &Vec<Arc<dyn Handler>> {
        &self.hoops
    }
    /// Get current catcher's middlewares mutable reference.
    #[inline]
    pub fn hoops_mut(&mut self) -> &mut Vec<Arc<dyn Handler>> {
        &mut self.hoops
    }

    /// Add a handler as middleware, it will run the handler when error caught.
    #[inline]
    #[must_use]
    pub fn hoop<H: Handler>(mut self, hoop: H) -> Self {
        self.hoops.push(Arc::new(hoop));
        self
    }

    /// Add a handler as middleware. It runs the handler when an error is caught,
    /// but only when the filter returns `true`.
    #[inline]
    #[must_use]
    pub fn hoop_when<H, F>(mut self, hoop: H, filter: F) -> Self
    where
        H: Handler,
        F: Fn(&Request, &Depot) -> bool + Send + Sync + 'static,
    {
        self.hoops.push(Arc::new(WhenHoop {
            inner: hoop,
            filter,
        }));
        self
    }

    /// Catch error and send error page.
    pub async fn catch(
        &self,
        req: &mut Request,
        depot: &mut Depot,
        res: &mut Response,
        conn: crate::ConnCtrl,
    ) {
        let mut ctrl = FlowCtrl::with_conn(
            self.hoops.iter().chain([&self.goal]).cloned().collect(),
            conn,
        );
        ctrl.call_next(req, depot, res).await;
    }
}

/// Default [`Handler`] used as goal for [`Catcher`].
///
/// If the HTTP status is an error, and no custom handler catches it or writes a body,
/// `DefaultGoal` is used to handle it.
///
/// `DefaultGoal` supports sending error pages in `XML`, `JSON`, `HTML`, `Text` formats.
#[derive(Default, Debug)]
pub struct DefaultGoal {
    footer: Option<Cow<'static, str>>,
}
impl DefaultGoal {
    /// Creates a new `DefaultGoal`.
    #[must_use]
    pub fn new() -> Self {
        Self { footer: None }
    }
    /// Creates a new `DefaultGoal` with a custom footer.
    #[inline]
    #[must_use]
    pub fn with_footer(footer: impl Into<Cow<'static, str>>) -> Self {
        Self::new().footer(footer)
    }

    /// Set custom footer which is only used in html error page.
    ///
    /// If footer is `None`, then use default footer.
    /// Default footer is `<a href="https://salvo.rs" target="_blank">salvo</a>`.
    #[must_use]
    pub fn footer(mut self, footer: impl Into<Cow<'static, str>>) -> Self {
        self.footer = Some(footer.into());
        self
    }
}
#[async_trait]
impl Handler for DefaultGoal {
    async fn handle(
        &self,
        req: &mut Request,
        _depot: &mut Depot,
        res: &mut Response,
        _ctrl: &mut FlowCtrl,
    ) {
        let status = res.status_code.unwrap_or(StatusCode::NOT_FOUND);
        if (status.is_server_error() || status.is_client_error())
            && (res.body.is_none() || res.body.is_error())
        {
            write_error_default(req, res, self.footer.as_deref());
        }
    }
}

cfg_feature! {
    #![feature = "rfc9457"]
    /// A [`Catcher`] goal that renders errors as RFC 9457 [`Problem`](crate::http::Problem)
    /// details.
    ///
    /// Unlike [`DefaultGoal`], this goal always produces an
    /// `application/problem+json` response and does not perform content negotiation.
    ///
    /// # Example
    ///
    /// ```
    /// use salvo_core::catcher::{Catcher, ProblemGoal};
    ///
    /// let catcher = Catcher::new(ProblemGoal::new());
    /// # let _ = catcher;
    /// ```
    #[derive(Default, Debug)]
    pub struct ProblemGoal;

    impl ProblemGoal {
        /// Creates a new RFC 9457 problem details catcher goal.
        #[must_use]
        pub fn new() -> Self {
            Self
        }
    }

    #[async_trait]
    impl Handler for ProblemGoal {
        async fn handle(
            &self,
            _req: &mut Request,
            _depot: &mut Depot,
            res: &mut Response,
            _ctrl: &mut FlowCtrl,
        ) {
            let status = res.status_code.unwrap_or(StatusCode::NOT_FOUND);
            if (status.is_server_error() || status.is_client_error())
                && (res.body.is_none() || res.body.is_error())
            {
                let problem = if let ResBody::Error(error) = &res.body {
                    crate::http::Problem::from(error)
                } else {
                    crate::http::Problem::new(status)
                };
                res.render(problem);
            }
        }
    }
}

/// Escapes text interpolated into the HTML error page so that request-derived
/// content (e.g. via `StatusError::brief`/`detail`/`cause`) cannot inject markup
/// (reflected XSS).
fn html_escape(input: &str) -> String {
    let mut out = String::w
```

### Core Architecture Module: `crates/core/src/cfg.rs`
```
#[macro_export]
#[doc(hidden)]
macro_rules! cfg_feature {
    (
        #![$meta:meta]
        $($item:item)*
    ) => {
        $(
            #[cfg($meta)]
            #[cfg_attr(docsrs, doc(cfg($meta)))]
            $item
        )*
    }
}

```

### Core Architecture Module: `crates/core/src/conn.rs`
```
//! Connection and listener implementations for handling HTTP connections.
//!
//! This module provides the foundational types and traits for accepting and managing
//! network connections in Salvo. It includes:
//!
//! - **Listeners**: Types that bind to addresses and produce acceptors
//! - **Acceptors**: Types that accept incoming connections and produce streams
//! - **TLS Support**: Implementations for [`rustls`], [`native_tls`], and [`openssl`]
//! - **Protocol Support**: HTTP/1, HTTP/2, and HTTP/3 (QUIC) via the [`quinn`] module
//! - **Unix Sockets**: Support for Unix domain sockets on Unix platforms
//!
//! # Architecture
//!
//! The connection system follows a layered architecture:
//!
//! 1. [`Listener`] - Binds to an address and creates an [`Acceptor`]
//! 2. [`Acceptor`] - Accepts incoming connections and returns [`Accepted`] structs
//! 3. [`Coupler`] - Couples the stream with HTTP protocol handling
//!
//! # Basic Usage
//!
//! ```no_run
//! use salvo_core::conn::TcpListener;
//! use salvo_core::prelude::*;
//!
//! #[tokio::main]
//! async fn main() {
//!     let acceptor = TcpListener::new("127.0.0.1:7878").bind().await;
//!     // Use acceptor with Server
//! }
//! ```
//!
//! # TLS Support
//!
//! Multiple TLS backends are available through feature flags:
//!
//! - `rustls` - Pure Rust TLS implementation via [`RustlsListener`]
//! - `native-tls` - Platform-native TLS via [`NativeTlsListener`]
//! - `openssl` - OpenSSL bindings via [`OpensslListener`]
//!
//! # Joining Listeners
//!
//! Multiple listeners can be joined together using the [`JoinedListener`]:
//!
//! ```ignore
//! use salvo_core::conn::{TcpListener, JoinedListener};
//!
//! let listener = TcpListener::new("0.0.0.0:80")
//!     .join(TcpListener::new("0.0.0.0:443"));
//! ```
use std::fmt::{self, Debug, Display, Formatter};
use std::io::Result as IoResult;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};

use futures_util::future::{BoxFuture, FutureExt};
use http::uri::Scheme;
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio_util::sync::CancellationToken;

use crate::fuse::{ArcFusePolicy, FuseConfig};
use crate::http::Version;
use crate::service::HyperHandler;

mod proto;
pub use proto::HttpBuilder;
mod ctrl;
pub use ctrl::ConnCtrl;
mod stream;
pub use stream::*;

cfg_feature! {
    #![feature = "native-tls"]
    pub mod native_tls;
    pub use self::native_tls::NativeTlsListener;
}
cfg_feature! {
    #![feature = "rustls"]
    pub mod rustls;
    pub use rustls::RustlsListener;
}
cfg_feature! {
    #![feature = "openssl"]
    pub mod openssl;
    pub use self::openssl::OpensslListener;
}
cfg_feature! {
    #![feature = "http1"]
    pub use hyper::server::conn::http1;
}
cfg_feature! {
    #![feature = "http2"]
    pub use hyper::server::conn::http2;
}
cfg_feature! {
    #![feature = "quinn"]
    pub mod quinn;
    pub use self::quinn::{QuinnListener, QuinnConnection};
}
cfg_feature! {
    #![all(feature = "unix", unix)]
    pub mod unix;
}
pub mod addr;
pub use addr::SocketAddr;

pub mod tcp;
pub use tcp::TcpListener;

mod joined;
pub use joined::{JoinedAcceptor, JoinedListener};

cfg_feature! {
    #![all(feature = "unix", unix)]
    pub use unix::UnixListener;
}

#[cfg(any(feature = "rustls", feature = "native-tls", feature = "openssl"))]
/// A type that can convert into a TLS configuration stream.
///
/// This trait enables dynamic TLS configuration updates at runtime.
/// Implementations can provide a stream of configuration values that
/// will be consumed by a background reload task and applied to subsequent
/// connections without waiting for new traffic to drive the stream forward.
///
/// # Use Cases
///
/// - Hot-reloading TLS certificates without server restart
/// - Rotating certificates on a schedule
/// - Loading certificates from external sources (e.g., HashiCorp Vault)
///
/// The first item yielded by the stream is used as the initial TLS config
/// during bind. Later items replace the active config only after they are
/// successfully converted into the backend-specific TLS acceptor state.
///
/// # Example
///
/// A simple implementation might wrap a static configuration:
///
/// ```ignore
/// use futures_util::stream::{self, StreamExt};
///
/// impl IntoConfigStream<ServerConfig> for MyConfig {
///     type Stream = stream::Once<futures_util::future::Ready<ServerConfig>>;
///
///     fn into_stream(self) -> Self::Stream {
///         stream::once(futures_util::future::ready(self.into_server_config()))
///     }
/// }
/// ```
pub trait IntoConfigStream<C> {
    /// The stream type that yields TLS configurations.
    type Stream: futures_util::Stream<Item = C> + Send + 'static;

    /// Consumes this value and returns a stream of TLS configurations.
    fn into_stream(self) -> Self::Stream;
}

/// Represents an accepted connection from an [`Acceptor`].
///
/// This struct contains all the information needed to handle an incoming connection,
/// including the stream itself, addressing information, and protocol metadata.
///
/// # Type Parameters
///
/// - `C`: The [`Coupler`] type that will handle HTTP protocol negotiation
/// - `S`: The underlying stream type (must be `Send + 'static`)
///
/// # Fields
///
/// The struct provides access to:
/// - The raw connection stream for reading/writing data
/// - Local and remote socket addresses for logging and access control
/// - HTTP scheme (http/https) for proper URL construction
/// - Optional fuse_config for connection lifecycle management
pub struct Accepted<C, S>
where
    C: Coupler<Stream = S>,
    S: Send + 'static,
{
    /// The coupler responsible for coupling the stream with HTTP handling.
    ///
    /// The coupler manages the HTTP protocol negotiation and connection lifecycle.
    pub coupler: C,
    /// The underlying I/O stream for this connection.
    ///
    /// This is the raw stream that will be used for reading requests and writing responses.
    pub stream: S,
    /// Optional fuse_config for connection protection and monitoring.
    ///
    /// When set, this allows the connection to be monitored for slow HTTP attacks
    /// and other malicious behavior patterns.
    pub fuse_config: Option<FuseConfig>,
    /// Lifecycle control for this connection.
    ///
    /// Created when the connection is accepted and shared with its stream, protocol driver,
    /// and handlers so any of them can abort, gracefully shut down, or relax the fuse timers.
    pub conn_ctrl: ConnCtrl,
    /// The local address this connection was accepted on.
    ///
    /// Useful for multi-homed servers or logging purposes.
    pub local_addr: SocketAddr,
    /// The remote address of the connecting client.
    ///
    /// Can be used for access control, logging, or rate limiting.
    pub remote_addr: SocketAddr,
    /// The HTTP scheme for this connection (http or https).
    ///
    /// Used to construct proper URLs and determine if the connection is secure.
    pub http_scheme: Scheme,
}
impl<C, S> Debug for Accepted<C, S>
where
    C: Coupler<Stream = S>,
    S: Send + 'static,
{
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("Accepted")
            .field("local_addr", &self.local_addr)
            .field("remote_addr", &self.remote_addr)
            .field("http_scheme", &self.http_scheme)
            .finish()
    }
}

impl<C, S> Accepted<C, S>
where
    C: Coupler<Stream = S>,
    S: Send + 'static,
{
    #[inline]
    #[doc(hidden)]
    pub fn map_into<TC, TS>(
        self,
        coupler_fn: impl FnOnce(C) -> TC,
        stream_fn: impl FnOnce(S) -> TS,
    ) -> Accepted<TC, TS>
    where
        TC: Coupler<Stream = TS>,
        TS: Send + 'static,
    {
        let Self {
            coupler,
            stream,
            fuse_config,
            conn_ctrl,
            local_addr,
            remote_addr,
            http_scheme,
        } = self;
        Accepted {
            coupler: coupler_fn(coupler),
            stream: stream_fn(stream),
            fuse_config,
            conn_ctrl,
            local_addr,
            remote_addr,
            http_scheme,
        }
    }
}

/// A trait for types that can accept incoming network connections.
///
/// Acceptors are created by [`Listener::bind()`] and are responsible for
/// accepting new connections and returning them as [`Accepted`] structs.
///
/// # Associated Types
///
/// - `Coupler`: The type that handles HTTP protocol negotiation for accepted connections
/// - `Stream`: The underlying I/O stream type for connections
///
/// # Implementation Notes
///
/// Implementations should handle connection acceptance asynchronously and
/// return proper I/O errors when connections fail.
///
/// # Example
///
/// Using an acceptor with a server:
///
/// ```ignore
/// use salvo_core::conn::{TcpListener, Listener, Acceptor};
///
/// let mut acceptor = TcpListener::new("127.0.0.1:8080").bind().await;
///
/// // Get information about bound addresses
/// for holding in acceptor.holdings() {
///     println!("Listening on {}", holding);
/// }
/// ```
pub trait Acceptor: Send {
    /// The coupler type used for HTTP protocol handling.
    type Coupler: Coupler<Stream = Self::Stream> + Unpin + Send + 'static;
    /// The underlying stream type for accepted connections.
    type Stream: Unpin + Send + 'static;

    /// Returns the holding information for all addresses this acceptor is bound to.
    ///
    /// The returned slice contains [`Holding`] structs with information about
    /// each bound address, supported HTTP versions, and scheme.
    fn holdings(&self) -> &[Holding];

    /// Accepts the next incoming connection.
    ///
    /// This method waits for a new connection and returns an [`Accepted`] struct
    /// containing the connection stream and metadata.
    ///
    /// # Parameters
    ///
    /// - `fuse_policy`: Optional factory for creating fuse_configs to protect against slow HTTP
    ///   attacks and other malicious patterns
    /
```

### Core Architecture Module: `crates/core/src/conn/addr.rs`
```
//! Socket Address module.
use std::fmt::{self, Display, Formatter};
#[cfg(unix)]
use std::sync::Arc;

/// Network socket address
#[derive(Clone, Debug)]
#[non_exhaustive]
pub enum SocketAddr {
    /// Unknown address
    Unknown,
    /// IPv4 socket address
    IPv4(std::net::SocketAddrV4),
    /// IPv6 socket address
    IPv6(std::net::SocketAddrV6),
    /// Unix socket address
    #[cfg(unix)]
    #[cfg_attr(docsrs, doc(cfg(unix)))]
    Unix(Arc<tokio::net::unix::SocketAddr>),
}
impl From<std::net::SocketAddr> for SocketAddr {
    #[inline]
    fn from(addr: std::net::SocketAddr) -> Self {
        match addr {
            std::net::SocketAddr::V4(val) => Self::IPv4(val),
            std::net::SocketAddr::V6(val) => Self::IPv6(val),
        }
    }
}
impl From<std::net::SocketAddrV4> for SocketAddr {
    #[inline]
    fn from(addr: std::net::SocketAddrV4) -> Self {
        Self::IPv4(addr)
    }
}
impl From<std::net::SocketAddrV6> for SocketAddr {
    #[inline]
    fn from(addr: std::net::SocketAddrV6) -> Self {
        Self::IPv6(addr)
    }
}

#[cfg(unix)]
impl From<tokio::net::unix::SocketAddr> for SocketAddr {
    #[inline]
    fn from(addr: tokio::net::unix::SocketAddr) -> Self {
        Self::Unix(addr.into())
    }
}
#[cfg(unix)]
impl From<Arc<tokio::net::unix::SocketAddr>> for SocketAddr {
    #[inline]
    fn from(addr: Arc<tokio::net::unix::SocketAddr>) -> Self {
        Self::Unix(addr)
    }
}
impl SocketAddr {
    /// Returns if it is an IPv4 socket address.
    #[inline]
    #[must_use]
    pub fn is_ipv4(&self) -> bool {
        matches!(*self, Self::IPv4(_))
    }
    /// Returns if it is an IPv6 socket address.
    #[inline]
    #[must_use]
    pub fn is_ipv6(&self) -> bool {
        matches!(*self, Self::IPv6(_))
    }

    /// Returns the IP address associated with this socket address.
    ///
    /// Returns `None` if this address is not an IP-based socket address.
    #[inline]
    #[must_use]
    pub fn ip(&self) -> Option<std::net::IpAddr> {
        match self {
            Self::IPv4(a) => Some(std::net::IpAddr::V4(*a.ip())),
            Self::IPv6(a) => Some(std::net::IpAddr::V6(*a.ip())),
            _ => None,
        }
    }

    /// Returns the port number associated with this socket address.
    ///
    /// Returns `None` if this address is not an IP-based socket address.
    #[must_use]
    #[inline]
    pub fn port(&self) -> Option<u16> {
        match self {
            Self::IPv4(a) => Some(a.port()),
            Self::IPv6(a) => Some(a.port()),
            _ => None,
        }
    }

    /// Convert to [`std::net::SocketAddr`].
    #[inline]
    #[must_use]
    pub fn into_std(self) -> Option<std::net::SocketAddr> {
        match self {
            Self::IPv4(addr) => Some(addr.into()),
            Self::IPv6(addr) => Some(addr.into()),
            _ => None,
        }
    }

    cfg_feature! {
        #![all(feature = "unix", unix)]
        /// Returns if it is a Unix socket address.
        #[inline]
        #[must_use] pub fn is_unix(&self) -> bool {
            matches!(*self, Self::Unix(_))
        }
    }

    /// Returns IPv6 socket address.
    #[inline]
    #[must_use]
    pub fn as_ipv6(&self) -> Option<&std::net::SocketAddrV6> {
        match self {
            Self::IPv6(addr) => Some(addr),
            _ => None,
        }
    }
    /// Returns IPv4 socket address.
    #[inline]
    #[must_use]
    pub fn as_ipv4(&self) -> Option<&std::net::SocketAddrV4> {
        match self {
            Self::IPv4(addr) => Some(addr),
            _ => None,
        }
    }

    cfg_feature! {
        #![all(feature = "unix", unix)]
        /// Returns Unix socket address.
        #[inline]
        #[must_use] pub fn as_unix(&self) -> Option<&tokio::net::unix::SocketAddr> {
            match self {
                Self::Unix(addr) => Some(addr),
                _ => None,
            }
        }
    }
}

impl Display for SocketAddr {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unknown => write!(f, "unknown"),
            Self::IPv4(addr) => write!(f, "socket://{addr}"),
            Self::IPv6(addr) => write!(f, "socket://{addr}"),
            #[cfg(unix)]
            Self::Unix(addr) => match addr.as_pathname() {
                Some(path) => write!(f, "unix://{}", path.display()),
                None => f.write_str("unix://unknown"),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_addr_ipv4() {
        let ipv4: std::net::SocketAddr = "127.0.0.1:8080".parse().unwrap();
        let ipv4: SocketAddr = ipv4.into();
        assert!(ipv4.is_ipv4());
        assert!(!ipv4.is_ipv6());
        #[cfg(all(feature = "unix", unix))]
        assert!(!ipv4.is_unix());
        assert_eq!(ipv4.as_ipv4().unwrap().to_string(), "127.0.0.1:8080");
        assert!(ipv4.as_ipv6().is_none());
        #[cfg(all(feature = "unix", unix))]
        assert!(ipv4.as_unix().is_none());
    }

    #[tokio::test]
    async fn test_addr_ipv6() {
        let ipv6 = std::net::SocketAddr::new(
            std::net::IpAddr::V6(std::net::Ipv6Addr::new(0, 0, 0, 0, 0, 65535, 0, 1)),
            8080,
        );
        let ipv6: SocketAddr = ipv6.into();
        assert!(!ipv6.is_ipv4());
        assert!(ipv6.is_ipv6());
        #[cfg(all(feature = "unix", unix))]
        assert!(!ipv6.is_unix());
        assert!(ipv6.as_ipv4().is_none());
        assert_eq!(ipv6.as_ipv6().unwrap().to_string(), "[::ffff:0.0.0.1]:8080");
        #[cfg(all(feature = "unix", unix))]
        assert!(ipv6.as_unix().is_none());
    }
}

```

### Core Architecture Module: `crates/core/src/conn/ctrl.rs`
```
use std::fmt::{self, Debug, Formatter};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};

use tokio::sync::Notify;

const RUNNING: u8 = 0;
const GRACEFUL_SHUTDOWN: u8 = 1;
const ABORT: u8 = 2;

/// Controls the lifetime of the transport connection serving a request.
///
/// A control is shared by every request multiplexed over the same connection.
/// Shutting down an HTTP/2 or HTTP/3 connection therefore also affects its
/// other in-flight request streams.
#[derive(Clone)]
pub struct ConnCtrl {
    inner: Arc<Inner>,
}

struct Inner {
    state: AtomicU8,
    notify: Notify,
    relax: AtomicBool,
}

impl Default for ConnCtrl {
    fn default() -> Self {
        Self::new()
    }
}

impl Debug for ConnCtrl {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("ConnCtrl")
            .field("state", &self.state())
            .finish()
    }
}

impl ConnCtrl {
    /// Creates a connection control in the running state.
    #[must_use]
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Inner {
                state: AtomicU8::new(RUNNING),
                notify: Notify::new(),
                relax: AtomicBool::new(false),
            }),
        }
    }

    /// Stops accepting new requests and lets accepted requests finish.
    ///
    /// A later call to [`abort`](Self::abort) escalates graceful shutdown to an
    /// immediate abort.
    pub fn graceful_shutdown(&self) {
        if self
            .inner
            .state
            .compare_exchange(
                RUNNING,
                GRACEFUL_SHUTDOWN,
                Ordering::AcqRel,
                Ordering::Acquire,
            )
            .is_ok()
        {
            self.inner.notify.notify_waiters();
        }
    }

    /// Immediately aborts the underlying transport connection.
    ///
    /// The server will abruptly close the connection without sending any response.
    /// This causes clients to encounter errors such as `curl: (52) Empty reply from server`.
    ///
    /// Aborting the connection immediately frees up system resources allocated to the
    /// request flow. This forceful teardown should **only** be used in critical scenarios,
    /// such as mitigating active attacks, where maintaining the connection poses a security risk.
    pub fn abort(&self) {
        if self.inner.state.swap(ABORT, Ordering::AcqRel) != ABORT {
            self.inner.notify.notify_waiters();
        }
    }

    /// Returns `true` after graceful shutdown has been requested.
    #[must_use]
    pub fn is_graceful_shutdown(&self) -> bool {
        self.inner.state.load(Ordering::Acquire) == GRACEFUL_SHUTDOWN
    }

    /// Returns `true` after immediate abort has been requested.
    #[must_use]
    pub fn is_aborted(&self) -> bool {
        self.inner.state.load(Ordering::Acquire) == ABORT
    }

    /// Suspends the transport idle and write-stall fuse timeouts for this
    /// connection.
    ///
    /// The fuse [`connection_idle_timeout`](crate::fuse::FuseConfig::connection_idle_timeout)
    /// and [`write_stall_timeout`](crate::fuse::FuseConfig::write_stall_timeout) exist to
    /// close connections that stall mid-request. Long-lived protocols built on top of an HTTP
    /// upgrade — WebSocket, or a hand-rolled tunnel — legitimately spend long stretches with no
    /// transport activity and would otherwise trip those timers. A handler that hands the
    /// connection off to such a protocol should call this to keep the transport open.
    ///
    /// This does not affect [`graceful_shutdown`](Self::graceful_shutdown) or
    /// [`abort`](Self::abort); an aborted connection is still torn down.
    pub fn relax_timeouts(&self) {
        // A standalone flag with no other memory to order against; relaxed is enough,
        // and it is read on the transport poll path where we avoid needless fences.
        self.inner.relax.store(true, Ordering::Relaxed);
    }

    /// Returns `true` once [`relax_timeouts`](Self::relax_timeouts) has been called.
    #[must_use]
    pub fn is_relaxed(&self) -> bool {
        self.inner.relax.load(Ordering::Relaxed)
    }

    pub(crate) fn state(&self) -> ConnState {
        match self.inner.state.load(Ordering::Acquire) {
            GRACEFUL_SHUTDOWN => ConnState::GracefulShutdown,
            ABORT => ConnState::Abort,
            _ => ConnState::Running,
        }
    }

    #[cfg(any(feature = "http1", feature = "http2", feature = "quinn", test))]
    pub(crate) async fn notified(&self) -> ConnState {
        self.wait_for_state(false).await
    }

    #[cfg(any(feature = "http1", feature = "http2", feature = "quinn", test))]
    pub(crate) async fn aborted(&self) -> ConnState {
        self.wait_for_state(true).await
    }

    #[cfg(any(feature = "http1", feature = "http2", feature = "quinn", test))]
    async fn wait_for_state(&self, abort_only: bool) -> ConnState {
        loop {
            // Register this waiter before reading the state. This closes the
            // race where a transition could otherwise occur between the state
            // check and waiter registration. `Notify` keeps every registered
            // waiter and `notify_waiters` broadcasts to all of them.
            let notified = self.inner.notify.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();

            let state = self.state();
            if state == ConnState::Abort || (!abort_only && state == ConnState::GracefulShutdown) {
                return state;
            }
            notified.await;
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ConnState {
    Running,
    GracefulShutdown,
    Abort,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn abort_wakes_waiter() {
        let ctrl = ConnCtrl::new();
        let signal = ctrl.clone();
        let waiter = tokio::spawn(async move { signal.notified().await });
        ctrl.abort();
        assert_eq!(waiter.await.unwrap(), ConnState::Abort);
    }

    #[test]
    fn abort_escalates_graceful_shutdown() {
        let ctrl = ConnCtrl::new();
        ctrl.graceful_shutdown();
        assert!(ctrl.is_graceful_shutdown());
        ctrl.abort();
        assert!(ctrl.is_aborted());
    }

    #[tokio::test]
    async fn abort_waiter_ignores_graceful_shutdown() {
        let ctrl = ConnCtrl::new();
        ctrl.graceful_shutdown();
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(10), ctrl.aborted())
                .await
                .is_err()
        );
        ctrl.abort();
        assert_eq!(ctrl.aborted().await, ConnState::Abort);
    }

    #[tokio::test]
    async fn abort_wakes_every_waiter() {
        let ctrl = ConnCtrl::new();
        let connection_ctrl = ctrl.clone();
        let connection_waiter = tokio::spawn(async move { connection_ctrl.notified().await });
        let request_ctrl_a = ctrl.clone();
        let request_waiter_a = tokio::spawn(async move { request_ctrl_a.aborted().await });
        let request_ctrl_b = ctrl.clone();
        let request_waiter_b = tokio::spawn(async move { request_ctrl_b.aborted().await });

        // Give every future a chance to subscribe before broadcasting abort.
        tokio::task::yield_now().await;
        ctrl.abort();

        let all_waiters = async {
            assert_eq!(connection_waiter.await.unwrap(), ConnState::Abort);
            assert_eq!(request_waiter_a.await.unwrap(), ConnState::Abort);
            assert_eq!(request_waiter_b.await.unwrap(), ConnState::Abort);
        };
        tokio::time::timeout(std::time::Duration::from_secs(1), all_waiters)
            .await
            .expect("abort must wake every registered waiter");
    }
}

```

### Core Architecture Module: `crates/core/src/conn/joined.rs`
```
//! JoinListener and its implementations.
use std::fmt::{self, Debug, Formatter};
use std::io::Result as IoResult;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};

use futures_util::future::{BoxFuture, FutureExt};
use pin_project::pin_project;
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio_util::sync::CancellationToken;

use super::{Accepted, Acceptor, Listener};
use crate::conn::{Coupler, Holding, HttpBuilder};
use crate::fuse::ArcFusePolicy;
use crate::service::HyperHandler;

/// An Coupler for JoinedListener.
pub enum JoinedCoupler<A, B> {
    #[allow(missing_docs)]
    A(A),
    #[allow(missing_docs)]
    B(B),
}

impl<A, B> Coupler for JoinedCoupler<A, B>
where
    A: Coupler + Unpin + 'static,
    B: Coupler + Unpin + 'static,
{
    type Stream = JoinedStream<A::Stream, B::Stream>;

    fn couple(
        &self,
        stream: Self::Stream,
        handler: HyperHandler,
        builder: Arc<HttpBuilder>,
        graceful_stop_token: Option<CancellationToken>,
    ) -> BoxFuture<'static, IoResult<()>> {
        match (self, stream) {
            (Self::A(a), JoinedStream::A(stream)) => a
                .couple(stream, handler, builder, graceful_stop_token)
                .boxed(),
            (Self::B(b), JoinedStream::B(stream)) => b
                .couple(stream, handler, builder, graceful_stop_token)
                .boxed(),
            _ => unreachable!(),
        }
    }
}

impl<A, B> Debug for JoinedCoupler<A, B> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("JoinedCoupler").finish()
    }
}

/// An I/O stream for JoinedListener.
pub enum JoinedStream<A, B> {
    #[allow(missing_docs)]
    A(A),
    #[allow(missing_docs)]
    B(B),
}

impl<A, B> Debug for JoinedStream<A, B> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("JoinedStream").finish()
    }
}

impl<A, B> AsyncRead for JoinedStream<A, B>
where
    A: AsyncRead + Send + Unpin + 'static,
    B: AsyncRead + Send + Unpin + 'static,
{
    #[inline]
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<IoResult<()>> {
        match &mut self.get_mut() {
            Self::A(a) => Pin::new(a).poll_read(cx, buf),
            Self::B(b) => Pin::new(b).poll_read(cx, buf),
        }
    }
}

impl<A, B> AsyncWrite for JoinedStream<A, B>
where
    A: AsyncWrite + Send + Unpin + 'static,
    B: AsyncWrite + Send + Unpin + 'static,
{
    #[inline]
    fn poll_write(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &[u8]) -> Poll<IoResult<usize>> {
        match &mut self.get_mut() {
            Self::A(a) => Pin::new(a).poll_write(cx, buf),
            Self::B(b) => Pin::new(b).poll_write(cx, buf),
        }
    }

    #[inline]
    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<IoResult<()>> {
        match &mut self.get_mut() {
            Self::A(a) => Pin::new(a).poll_flush(cx),
            Self::B(b) => Pin::new(b).poll_flush(cx),
        }
    }

    #[inline]
    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<IoResult<()>> {
        match &mut self.get_mut() {
            Self::A(a) => Pin::new(a).poll_shutdown(cx),
            Self::B(b) => Pin::new(b).poll_shutdown(cx),
        }
    }
}

/// `JoinedListener` is a listener that can join two listeners.
#[pin_project]
pub struct JoinedListener<A, B> {
    #[pin]
    a: A,
    #[pin]
    b: B,
}

impl<A: Debug, B: Debug> Debug for JoinedListener<A, B> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("JoinedListener")
            .field("a", &self.a)
            .field("b", &self.b)
            .finish()
    }
}

impl<A, B> JoinedListener<A, B> {
    /// Create a new `JoinedListener`.
    #[inline]
    pub fn new(a: A, b: B) -> Self {
        Self { a, b }
    }
}
impl<A, B> Listener for JoinedListener<A, B>
where
    A: Listener + Send + Unpin + 'static,
    B: Listener + Send + Unpin + 'static,
    A::Acceptor: Acceptor + Send + Unpin + 'static,
    B::Acceptor: Acceptor + Send + Unpin + 'static,
{
    type Acceptor = JoinedAcceptor<A::Acceptor, B::Acceptor>;

    async fn try_bind(self) -> crate::Result<Self::Acceptor> {
        let a = self.a.try_bind().await?;
        let b = self.b.try_bind().await?;
        let holdings = a
            .holdings()
            .iter()
            .chain(b.holdings().iter())
            .cloned()
            .collect();
        Ok(JoinedAcceptor { a, b, holdings })
    }
}

/// `JoinedAcceptor` is an acceptor that can accept connections from two different acceptors.
pub struct JoinedAcceptor<A, B> {
    a: A,
    b: B,
    holdings: Vec<Holding>,
}

impl<A: Debug, B: Debug> Debug for JoinedAcceptor<A, B> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("JoinedAcceptor")
            .field("a", &self.a)
            .field("b", &self.b)
            .field("holdings", &self.holdings)
            .finish()
    }
}

impl<A, B> JoinedAcceptor<A, B>
where
    A: Acceptor,
    B: Acceptor,
{
    /// Create a new `JoinedAcceptor`.
    pub fn new(a: A, b: B) -> Self {
        let holdings = a
            .holdings()
            .iter()
            .chain(b.holdings().iter())
            .cloned()
            .collect();
        Self { a, b, holdings }
    }
}

impl<A, B> Acceptor for JoinedAcceptor<A, B>
where
    A: Acceptor + Send + Unpin + 'static,
    B: Acceptor + Send + Unpin + 'static,
    A::Coupler: Coupler<Stream = A::Stream> + Unpin + 'static,
    B::Coupler: Coupler<Stream = B::Stream> + Unpin + 'static,
    A::Stream: Unpin + Send + 'static,
    B::Stream: Unpin + Send + 'static,
{
    type Coupler = JoinedCoupler<A::Coupler, B::Coupler>;
    type Stream = JoinedStream<A::Stream, B::Stream>;

    #[inline]
    fn holdings(&self) -> &[Holding] {
        &self.holdings
    }

    #[inline]
    async fn accept(
        &mut self,
        fuse_policy: Option<ArcFusePolicy>,
    ) -> IoResult<Accepted<Self::Coupler, Self::Stream>> {
        tokio::select! {
            accepted = self.a.accept(fuse_policy.clone()) => {
                Ok(accepted?.map_into(JoinedCoupler::A, JoinedStream::A))
            }
            accepted = self.b.accept(fuse_policy) => {
                Ok(accepted?.map_into(JoinedCoupler::B, JoinedStream::B))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;

    use super::*;
    use crate::conn::TcpListener;

    #[tokio::test]
    async fn test_joined_listener() {
        let addr1 = std::net::SocketAddr::from(([127, 0, 0, 1], 6978));
        let addr2 = std::net::SocketAddr::from(([127, 0, 0, 1], 6979));

        let mut acceptor = TcpListener::new(addr1)
            .join(TcpListener::new(addr2))
            .bind()
            .await;
        tokio::spawn(async move {
            let mut stream = TcpStream::connect(addr1).await.unwrap();
            stream.write_i32(50).await.unwrap();

            let mut stream = TcpStream::connect(addr2).await.unwrap();
            stream.write_i32(100).await.unwrap();
        });
        let Accepted { mut stream, .. } = acceptor.accept(None).await.unwrap();
        let first = stream.read_i32().await.unwrap();
        let Accepted { mut stream, .. } = acceptor.accept(None).await.unwrap();
        let second = stream.read_i32().await.unwrap();
        assert_eq!(first + second, 150);
    }
}

```

### Core Architecture Module: `crates/core/src/conn/native_tls.rs`
```
//! `NativeTlsListener` and utilities.
pub mod listener;
pub use listener::NativeTlsListener;

mod config;
pub use config::{Identity, NativeTlsConfig};

#[cfg(test)]
mod tests {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;

    use super::*;
    use crate::conn::{Accepted, Acceptor, Listener, TcpListener};

    #[tokio::test]
    async fn test_native_tls_listener() {
        let identity = if cfg!(target_os = "macos") {
            include_bytes!("../../certs/identity-legacy.p12").to_vec()
        } else {
            include_bytes!("../../certs/identity.p12").to_vec()
        };

        let mut acceptor = TcpListener::new("127.0.0.1:0")
            .native_tls(NativeTlsConfig::new().pkcs12(identity).password("mypass"))
            .bind()
            .await;
        let addr = acceptor.holdings()[0].local_addr.clone().into_std().unwrap();

        tokio::spawn(async move {
            let connector = tokio_native_tls::TlsConnector::from(
                tokio_native_tls::native_tls::TlsConnector::builder()
                    .danger_accept_invalid_certs(true)
                    .build()
                    .unwrap(),
            );
            let stream = TcpStream::connect(addr).await.unwrap();
            let mut stream = connector.connect("127.0.0.1", stream).await.unwrap();
            stream.write_i32(10).await.unwrap();
        });

        let Accepted { mut stream, .. } = acceptor.accept(None).await.unwrap();
        assert_eq!(stream.read_i32().await.unwrap(), 10);
    }
}

```

### Core Architecture Module: `crates/core/src/conn/native_tls/config.rs`
```
//! native_tls module
use std::fmt::{self, Debug, Formatter};
use std::fs::File;
use std::io::{Error as IoError, Result as IoResult, Read};
use std::path::{Path, PathBuf};
use std::future::{ready, Ready};

use futures_util::stream::{once, Once, Stream};

pub use tokio_native_tls::native_tls::Identity;

use crate::conn::IntoConfigStream;

/// Builder to set the configuration for the TLS server.
#[non_exhaustive]
pub struct NativeTlsConfig {
    pkcs12_path: Option<PathBuf>,
    /// The pkcs12 data.
    pub pkcs12: Vec<u8>,
    /// The password for the pkcs12 data.
    pub password: String,
}

impl Debug for NativeTlsConfig {
    #[inline]
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        f.debug_struct("NativeTlsConfig").finish()
    }
}

impl Default for NativeTlsConfig {
    #[inline]
    fn default() -> Self {
        Self::new()
    }
}
impl NativeTlsConfig {
    /// Creates a new `NativeTlsConfig`.
    #[inline]
    #[must_use]
    pub fn new() -> Self {
        Self {
            pkcs12_path: None,
            pkcs12: vec![],
            password: String::new(),
        }
    }

    /// Sets the pkcs12 via File Path, returns [`std::io::Error`] if the file cannot be opened
    #[inline]
    #[must_use]
    pub fn pkcs12_path(mut self, path: impl AsRef<Path>) -> Self {
        self.pkcs12_path = Some(path.as_ref().into());
        self
    }

    /// Sets the pkcs12 via bytes slice
    #[inline]
    #[must_use]
    pub fn pkcs12(mut self, pkcs12: impl Into<Vec<u8>>) -> Self {
        self.pkcs12 = pkcs12.into();
        self
    }
    /// Sets the password
    #[inline]
    #[must_use]
    pub fn password(mut self, password: impl Into<String>) -> Self {
        self.password = password.into();
        self
    }

    /// Build identity
    pub fn build_identity(mut self) -> IoResult<Identity> {
        if self.pkcs12.is_empty()
            && let Some(path) = &self.pkcs12_path
        {
            let mut file = File::open(path)?;
            file.read_to_end(&mut self.pkcs12)?;
        }
        Identity::from_pkcs12(&self.pkcs12, &self.password).map_err(IoError::other)
    }
}

impl TryInto<Identity> for NativeTlsConfig {
    type Error = IoError;

    fn try_into(self) -> IoResult<Identity> {
        self.build_identity()
    }
}

impl IntoConfigStream<Self> for NativeTlsConfig {
    type Stream = Once<Ready<Self>>;

    fn into_stream(self) -> Self::Stream {
        once(ready(self))
    }
}
impl<T> IntoConfigStream<NativeTlsConfig> for T
where
    T: Stream<Item = NativeTlsConfig> + Send + 'static,
{
    type Stream = T;

    fn into_stream(self) -> Self {
        self
    }
}

impl<T> IntoConfigStream<Identity> for T
where
    T: Stream<Item = Identity> + Send + 'static,
{
    type Stream = T;

    fn into_stream(self) -> Self {
        self
    }
}

```

### Core Architecture Module: `crates/core/src/conn/native_tls/listener.rs`
```
//! native_tls module
use std::error::Error as StdError;
use std::fmt::{self, Debug, Formatter};
use std::io::{Error as IoError, Result as IoResult};
use std::sync::Arc;

use arc_swap::ArcSwapOption;
use futures_util::stream::{BoxStream, StreamExt};
use http::uri::Scheme;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio_native_tls::TlsStream;
use tokio_util::sync::CancellationToken;

use super::Identity;
use crate::Error;
use crate::conn::tcp::{DynTcpAcceptor, TcpCoupler, ToDynTcpAcceptor};
use crate::conn::{Accepted, Acceptor, HandshakeStream, Holding, IntoConfigStream, Listener};
use crate::fuse::ArcFusePolicy;

/// NativeTlsListener
pub struct NativeTlsListener<S, C, T, E> {
    config_stream: S,
    inner: T,
    _phantom: std::marker::PhantomData<(C, E)>,
}
impl<S, C, T: Debug, E> Debug for NativeTlsListener<S, C, T, E> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("NativeTlsListener")
            .field("inner", &self.inner)
            .finish()
    }
}
impl<S, C, T, E> NativeTlsListener<S, C, T, E>
where
    S: IntoConfigStream<C> + Send + 'static,
    C: TryInto<Identity, Error = E> + Send + 'static,
    T: Listener + Send,
    E: StdError + Send,
{
    /// Create a new `NativeTlsListener`.
    #[inline]
    pub fn new(config_stream: S, inner: T) -> Self {
        Self {
            config_stream,
            inner,
            _phantom: std::marker::PhantomData,
        }
    }
}

impl<S, C, T, E> Listener for NativeTlsListener<S, C, T, E>
where
    S: IntoConfigStream<C> + Send + 'static,
    C: TryInto<Identity, Error = E> + Send + 'static,
    T: Listener + Send + 'static,
    T::Acceptor: Send + 'static,
    <T::Acceptor as Acceptor>::Stream: AsyncRead + AsyncWrite + Unpin + Send + 'static,
    E: StdError + Send + 'static,
{
    type Acceptor = NativeTlsAcceptor<T::Acceptor>;

    async fn try_bind(self) -> crate::Result<Self::Acceptor> {
        let mut config_stream = self.config_stream.into_stream().boxed();
        let initial = config_stream.next().await.ok_or_else(|| {
            Error::other("native_tls: config stream ended before yielding an initial tls config")
        })?;
        let identity = initial
            .try_into()
            .map_err(|err| IoError::other(err.to_string()))?;
        let acceptor = tokio_native_tls::native_tls::TlsAcceptor::new(identity)
            .map_err(|err| IoError::other(err.to_string()))?;
        let current_acceptor = Arc::new(ArcSwapOption::from(Some(Arc::new(
            tokio_native_tls::TlsAcceptor::from(acceptor),
        ))));
        let inner = self.inner.try_bind().await?;
        let cancel_reload = CancellationToken::new();

        tracing::info!("tls config loaded");
        tokio::spawn(reload_configs(
            config_stream,
            Arc::clone(&current_acceptor),
            cancel_reload.clone(),
        ));

        Ok(NativeTlsAcceptor::new(
            inner,
            current_acceptor,
            cancel_reload,
        ))
    }
}

async fn reload_configs<C, E>(
    mut config_stream: BoxStream<'static, C>,
    current_acceptor: Arc<ArcSwapOption<tokio_native_tls::TlsAcceptor>>,
    cancel_reload: CancellationToken,
) where
    C: TryInto<Identity, Error = E> + Send + 'static,
    E: StdError + Send + 'static,
{
    loop {
        tokio::select! {
            _ = cancel_reload.cancelled() => break,
            next = config_stream.next() => {
                let Some(config) = next else {
                    break;
                };
                match config.try_into() {
                    Ok(identity) => match tokio_native_tls::native_tls::TlsAcceptor::new(identity) {
                        Ok(acceptor) => {
                            current_acceptor.store(Some(Arc::new(tokio_native_tls::TlsAcceptor::from(
                                acceptor,
                            ))));
                            tracing::info!("tls config changed");
                        }
                        Err(err) => {
                            tracing::error!(error = ?err, "native_tls: invalid tls config, keeping previous config");
                        }
                    },
                    Err(err) => {
                        tracing::error!(error = ?err, "native_tls: invalid tls config, keeping previous config");
                    }
                }
            }
        }
    }
}

/// NativeTlsAcceptor
pub struct NativeTlsAcceptor<T> {
    inner: T,
    holdings: Vec<Holding>,
    current_acceptor: Arc<ArcSwapOption<tokio_native_tls::TlsAcceptor>>,
    cancel_reload: CancellationToken,
}
impl<T: Debug> Debug for NativeTlsAcceptor<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("NativeTlsAcceptor")
            .field("inner", &self.inner)
            .finish()
    }
}
impl<T> NativeTlsAcceptor<T>
where
    T: Acceptor + Send + 'static,
    <T as Acceptor>::Stream: AsyncRead + AsyncWrite + Unpin + Send,
{
    /// Create a new `NativeTlsAcceptor`.
    pub fn new(
        inner: T,
        current_acceptor: Arc<ArcSwapOption<tokio_native_tls::TlsAcceptor>>,
        cancel_reload: CancellationToken,
    ) -> Self {
        let holdings = inner
            .holdings()
            .iter()
            .map(|h| {
                #[allow(unused_mut)]
                let mut versions = h.http_versions.clone();
                #[cfg(feature = "http1")]
                if !versions.contains(&crate::http::Version::HTTP_11) {
                    versions.push(crate::http::Version::HTTP_11);
                }
                #[cfg(feature = "http2")]
                if !versions.contains(&crate::http::Version::HTTP_2) {
                    versions.push(crate::http::Version::HTTP_2);
                }
                Holding {
                    local_addr: h.local_addr.clone(),
                    http_versions: versions,
                    http_scheme: Scheme::HTTPS,
                }
            })
            .collect();
        Self {
            inner,
            holdings,
            current_acceptor,
            cancel_reload,
        }
    }

    /// Get the inner `Acceptor`.
    pub fn inner(&self) -> &T {
        &self.inner
    }

    /// Convert this `NativeTlsAcceptor` into a boxed `DynTcpAcceptor`.
    pub fn into_boxed(self) -> Box<dyn DynTcpAcceptor> {
        Box::new(ToDynTcpAcceptor(self))
    }
}

impl<T> Drop for NativeTlsAcceptor<T> {
    fn drop(&mut self) {
        self.cancel_reload.cancel();
    }
}

impl<T> Acceptor for NativeTlsAcceptor<T>
where
    T: Acceptor + Send + 'static,
    <T as Acceptor>::Stream: AsyncRead + AsyncWrite + Unpin + Send,
{
    type Coupler = TcpCoupler<Self::Stream>;
    type Stream = HandshakeStream<TlsStream<T::Stream>>;

    #[inline]
    fn holdings(&self) -> &[Holding] {
        &self.holdings
    }

    #[inline]
    async fn accept(
        &mut self,
        fuse_policy: Option<ArcFusePolicy>,
    ) -> IoResult<Accepted<Self::Coupler, Self::Stream>> {
        let Accepted {
            coupler: _,
            stream,
            fuse_config,
            conn_ctrl,
            local_addr,
            remote_addr,
            ..
        } = self.inner.accept(fuse_policy).await?;
        let Some(tls_acceptor) = self.current_acceptor.load_full() else {
            return Err(IoError::other("native_tls: no active tls config"));
        };
        let conn = async move { tls_acceptor.accept(stream).await.map_err(IoError::other) };
        Ok(Accepted {
            coupler: TcpCoupler::new(),
            stream: HandshakeStream::new(conn, fuse_config),
            fuse_config,
            conn_ctrl,
            local_addr,
            remote_addr,
            http_scheme: Scheme::HTTPS,
        })
    }
}

```

### Core Architecture Module: `crates/core/src/conn/openssl.rs`
```
//! OpensslListener and utils.
mod config;
pub use config::{Keycert, OpensslConfig, SslAcceptorBuilder};

mod listener;
pub use listener::{OpensslAcceptor, OpensslListener};

#[cfg(test)]
mod tests {
    use std::pin::Pin;

    use openssl::ssl::{SslConnector, SslMethod};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;
    use tokio_openssl::SslStream;

    use super::*;
    use crate::conn::{Accepted, Acceptor, Listener, TcpListener};

    #[tokio::test]
    async fn test_openssl_listener() {
        let mut acceptor = TcpListener::new("127.0.0.1:0")
            .openssl(OpensslConfig::new(
                Keycert::new()
                    .key_from_path("certs/key.pem")
                    .unwrap()
                    .cert_from_path("certs/cert.pem")
                    .unwrap(),
            ))
            .bind()
            .await;
        let addr = acceptor.holdings()[0].local_addr.clone().into_std().unwrap();

        tokio::spawn(async move {
            let mut connector = SslConnector::builder(SslMethod::tls()).unwrap();
            connector.set_ca_file("certs/chain.pem").unwrap();

            let ssl = connector
                .build()
                .configure()
                .unwrap()
                .into_ssl("testserver.com")
                .unwrap();

            let stream = TcpStream::connect(addr).await.unwrap();
            let mut tls_stream = SslStream::new(ssl, stream).unwrap();
            Pin::new(&mut tls_stream).connect().await.unwrap();

            tls_stream.write_i32(518).await.unwrap();
        });

        let Accepted { mut stream, .. } = acceptor.accept(None).await.unwrap();
        assert_eq!(stream.read_i32().await.unwrap(), 518);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24** (2021-05-02): **master/examples/routing.rs  Compilation fails**
  *Symptoms*: - https://github.com/salvo-rs/salvo/blob/master/examples/routing.rs  **dependencies** ``` rustc 1.51.0 (2fd73fabe 2021-03-23) Deepin GNU/Linux 20.2  [dependencies] salvo = { version = "0.11", features = ["full"] } tokio = { version = "1", features = ["full"] } ```  **code** ``` use salvo::prelude::*;  #[tokio::main] async fn main() {     let debug_mode = true;     let admin_mode = true;     let router = Router::new()         .get(index)         .push(             Router::new()                 .path("users")                 .before(auth)                 .post(create_user)                 .push(Router::new().path(r"<id:num>").post(update_user).delete(delete_user)),         )         .push(             Router::new()                 .path("users")                 .get(list_users)                 .push(Router::new().path(r"<id:num>").get(show_user)),         )         .then(|router| {             if debug_mode {                 router.push(Router::new().path("debug").get(debug))             } else {                 router             }         })         .then(|router| {             if admin_mode {                 router.push(Router::new().path("admin").get(admin))             } else {                 router             }         })         ;      Server::new(router).bind(([0, 0, 0, 0], 7878)).await; }  #[fn_handler] async fn admin(res: &mut Response) {     res.render_plain_text("Admin page"); } #[fn_handler] async fn debu
  **Post-Mortem & Fix Analysis**:
  > Thank you for your report, this is a bug, I have submitted the corresponding fix, hope it will help you 
  > @driftluo Thanks for your PR.  @dollarkillerx You can use latest version 0.11.2. 

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

### Incident Patch 1: `9c36d16b` (2026-10-04)
**Commit Message**: fix(quinn): finish QUIC handshakes on the connection task (#1711)

* fix(quinn): finish QUIC handshakes on the connection task

QuinnAcceptor::accept awaited the whole QUIC handshake. That await sits
inside JoinedListener's select!, so a TCP connection accepted mid-handshake
dropped the future and lost the QUIC connection. And because the server
accepts one connection at a time, each QUIC handshake held up every other
QUIC accept for a round trip, or for tls_handshake_timeout if the client
never finished.

accept now hands over the QuinnConnection as soon as quinn accepts the
connection (Connecting::into_0rtt), carrying a future for the handshake.
serve_connection awaits it on the connection's own task, still bounded by
tls_handshake_timeout, before starting HTTP/3. The public types are
unchanged.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(quinn): cancel pending handshakes on graceful shutdown

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Co-authored-by: Chris Young <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -8,6 +8,10 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 
 ### Fixed
 
+- A QUIC connection was dropped when a joined listener, such as the TCP side of a combined
+  HTTP/1.1, HTTP/2 and HTTP/3 server, accepted a connection during its handshake. A client that
+  never finished its handshake also stalled all new QUIC connections for up to
+  `tls_handshake_timeout`.
 - Honor the `http1` and `http2` feature flags when enabling Hyper protocols. HTTP/1-only
   builds, including WebSocket support, no longer compile `h2` unless another dependency
   enables HTTP/2. Default protocol support is unchanged.
```

**File**: `crates/core/Cargo.toml` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ fastrand = { workspace = true }
 # Both backends on purpose: this makes rustls unable to pick a provider from crate features,
 # which is exactly the situation that used to panic. See `conn::rustls::default_crypto_provider`.
 rustls = { workspace = true, features = ["aws-lc-rs", "ring"] }
-tokio = { workspace = true, features = ["macros", "rt"] }
+tokio = { workspace = true, features = ["macros", "rt", "test-util"] }
 
 [lints]
 workspace = true
```

**File**: `crates/core/src/conn/quinn.rs` (modified, +14/-1)
```diff
@@ -4,6 +4,7 @@ use std::future::{Ready, ready};
 use std::io::Result as IoResult;
 use std::ops::{Deref, DerefMut};
 use std::sync::Arc;
+use std::time::Duration;
 
 use futures_util::future::{BoxFuture, FutureExt};
 use futures_util::stream::{Once, once};
@@ -20,16 +21,28 @@ mod listener;
 pub use listener::{QuinnAcceptor, QuinnListener};
 
 /// HTTP/3 connection.
+///
+/// Its QUIC handshake may still be in progress; [`Builder::serve_connection`] waits for it.
 #[allow(dead_code)]
 pub struct QuinnConnection {
     inner: http3_quinn::Connection,
     raw: quinn::Connection,
+    /// Resolves once the QUIC handshake has completed (`true`) or timed out (`false`).
+    handshake: BoxFuture<'static, bool>,
 }
 impl QuinnConnection {
-    pub(crate) fn new(raw: quinn::Connection) -> Self {
+    /// `handshake_done` also resolves if the connection closes before the handshake completes.
+    pub(crate) fn new(
+        raw: quinn::Connection,
+        handshake_done: quinn::ZeroRttAccepted,
+        handshake_timeout: Option<Duration>,
+    ) -> Self {
+        let timeout = handshake_timeout.unwrap_or(Duration::MAX);
+        let handshake = tokio::time::timeout(timeout, handshake_done).map(|done| done.is_ok());
         Self {
             inner: http3_quinn::Connection::new(raw.clone()),
             raw,
+            handshake: handshake.boxed(),
         }
     }
     /// Get inner quinn connection.
```

**File**: `crates/core/src/conn/quinn/builder.rs` (modified, +25/-2)
```diff
@@ -106,10 +106,33 @@ impl Builder {
         graceful_stop_token: Option<CancellationToken>,
     ) -> IoResult<()> {
         let conn_ctrl = hyper_handler.conn_ctrl.clone();
-        let raw_conn = conn.quinn().clone();
+        let crate::conn::quinn::QuinnConnection {
+            inner,
+            raw: raw_conn,
+            handshake,
+        } = conn;
+        // A connection without a completed handshake has no requests to drain. Close it
+        // promptly on graceful stop instead of keeping the server alive until it times out.
+        let handshake_completed = tokio::select! {
+            completed = handshake => completed,
+            _ = async {
+                if let Some(token) = &graceful_stop_token {
+                    token.cancelled().await;
+                } else {
+                    pending::<()>().await;
+                }
+            } => {
+                raw_conn.close(0u32.into(), b"server shutting down");
+                return Ok(());
+            }
+        };
+        if !handshake_completed {
+            raw_conn.close(0u32.into(), b"handshake timed out");
+            return Ok(());
+        }
         let mut conn = self
             .inner
-            .build::<salvo_http3::quinn::Connection, bytes::Bytes>(conn.into_inner())
+            .build::<salvo_http3::quinn::Connection, bytes::Bytes>(inner)
             .await
             .map_err(|e| IoError::other(format!("invalid connection: {e}")))?;
 
```

**File**: `crates/core/src/conn/quinn/listener.rs` (modified, +22/-27)
```diff
@@ -209,37 +209,32 @@ impl Acceptor for QuinnAcceptor {
                 },
                 None => None,
             };
-            // Admission passed: take the incoming back to complete the handshake below.
-            //
-            // NOTE: the handshake await that follows is not itself cancellation-safe — if this
-            // future is dropped mid-handshake the connection is lost. Parking a mid-flight
-            // handshake future is materially more involved; only the admission phase is parked
-            // here, which closes the gap the async `FusePolicy` introduced.
+            // Admission passed. Hand the connection over without awaiting its handshake, which
+            // `serve_connection` awaits on the connection's own task. Awaiting it here would stall
+            // every other accept, TCP included via `JoinedListener`, and would lose the
+            // connection whenever this future is dropped mid-handshake.
             let new_conn = self.pending.take().expect("incoming parked above");
-            // Of the fuse timeouts, QUIC enforces the handshake timeout here and the
-            // request-body timeout via the H3 body. The transport idle and write-stall
+            // Of the fuse timeouts, QUIC enforces the handshake timeout in `serve_connection` and
+            // the request-body timeout via the H3 body. The transport idle and write-stall
             // timeouts are TCP/byte-stream concepts handled by `StraightStream`; QUIC relies on
             // quinn's own `max_idle_timeout` and per-stream flow control instead (see the
             // `FuseConfig` field docs).
-            let connected = match fuse_config.and_then(|config| config.tls_handshake_timeout) {
-                Some(timeout) => match tokio::time::timeout(timeout, new_conn).await {
-                    Ok(result) => result,
-                    Err(_) => continue,
-                },
-                None => new_conn.await,
-            };
-            return match connected {
-                Ok(conn) => Ok(Accepted {
-                    coupler: QuinnCoupler,
-                    stream: QuinnConnection::new(conn),
-                    fuse_config,
-                    conn_ctrl: crate::conn::ConnCtrl::new(),
-                    local_addr: self.holdings[0].local_addr.clone(),
-                    remote_addr: remote_addr.into(),
-                    http_scheme: self.holdings[0].http_scheme.clone(),
-                }),
-                Err(e) => Err(IoError::other(e.to_string())),
-            };
+            let handshake_timeout = fuse_config.and_then(|config| config.tls_handshake_timeout);
+            let connecting = new_conn
+                .accept()
+                .map_err(|e| IoError::other(e.to_string()))?;
+            let (conn, handshake_done) = connecting
+                .into_0rtt()
+                .map_err(|_| IoError::other("quinn refused 0.5-RTT on a server connection"))?;
+            return Ok(Accepted {
+                coupler: QuinnCoupler,
+                stream: QuinnConnection::new(conn, handshake_done, handshake_timeout),
+                fuse_config,
+                conn_ctrl: crate::conn::ConnCtrl::new(),
+                local_addr: self.holdings[0].local_addr.clone(),
+                remote_addr: remote_addr.into(),
+                http_scheme: self.holdings[0].http_scheme.clone(),
+            });
         }
     }
 }
```

**File**: `crates/core/src/test.rs` (modified, +2/-0)
```diff
@@ -43,6 +43,8 @@
 mod client;
 mod request;
 mod response;
+#[cfg(all(test, feature = "server", feature = "quinn"))]
+mod quinn_accept;
 pub use client::TestClient;
 pub use request::{RequestBuilder, SendTarget};
 pub use response::ResponseExt;
```

**File**: `crates/core/src/test/quinn_accept.rs` (added, +235/-0)
```diff
@@ -0,0 +1,235 @@
+//! Regression tests for accepting QUIC connections. Endpoints talk over an in-memory network, with
+//! tokio's clock paused so that delays are exact. The client pads its ClientHello to span two
+//! datagrams, as browsers' post-quantum ClientHellos do.
+use std::collections::HashMap;
+use std::io::{self, IoSliceMut};
+use std::net::SocketAddr;
+use std::pin::Pin;
+use std::sync::atomic::{AtomicUsize, Ordering};
+use std::sync::{Arc, Mutex};
+use std::task::{Context, Poll, ready};
+use std::time::Duration;
+
+use tokio::sync::mpsc;
+use tokio::time::{Instant, sleep, sleep_until, timeout};
+use tokio_util::sync::CancellationToken;
+
+use crate::conn::JoinedAcceptor;
+use crate::conn::quinn::QuinnAcceptor;
+use crate::conn::rustls::{Keycert, RustlsConfig, default_crypto_provider, read_trust_anchor};
+use crate::proto::quinn::udp::{RecvMeta, Transmit};
+use crate::proto::quinn::{
+    self, AsyncUdpSocket, ClientConfig, Endpoint, EndpointConfig, TokioRuntime, UdpPoller,
+};
+use crate::{Router, Server};
+
+const ONE_WAY: Duration = Duration::from_millis(100);
+const SHORT: Duration = Duration::from_millis(10);
+
+/// Decides when the `n`th datagram a socket sends arrives, counting from 0; `None` drops it.
+type Fate = fn(usize) -> Option<Duration>;
+
+type Datagram = (SocketAddr, Vec<u8>);
+
+/// In-memory UDP: the inboxes of all sockets, by address.
+#[derive(Clone, Debug, Default)]
+struct Network(Arc<Mutex<HashMap<SocketAddr, mpsc::UnboundedSender<Datagram>>>>);
+
+#[derive(Debug)]
+struct Socket {
+    addr: SocketAddr,
+    fate: Fate,
+    sent: AtomicUsize,
+    outbox: mpsc::UnboundedSender<(Instant, Datagram)>,
+    inbox: Mutex<mpsc::UnboundedReceiver<Datagram>>,
+}
+
+impl Network {
+    fn socket(&self, port: u16, fate: Fate) -> Arc<Socket> {
+        let addr = SocketAddr::from(([127, 0, 0, 1], port));
+        let (inbox_tx, inbox) = mpsc::unbounded_channel();
+        self.0.lock().unwrap().insert(addr, inbox_tx);
+        // Deliver in the order sent: quinn drops packets that arrive before their keys.
+        let (outbox, mut queue) = mpsc::unbounded_channel::<(Instant, Datagram)>();
+        let network = self.clone();
+        tokio::spawn(async move {
+            while let Some((due, (to, datagram))) = queue.recv().await {
+                sleep_until(due).await;
+                if let Some(inbox) = network.0.lock().unwrap().get(&to) {
+                    let _ = inbox.send((addr, datagram));
+                }
+            }
+        });
+        Arc::new(Socket {
+            addr,
+            fate,
+            sent: AtomicUsize::new(0),
+            outbox,
+            inbox: Mutex::new(inbox),
+        })
+    }
+}
+
+impl AsyncUdpSocket for Socket {
+    fn create_io_poller(self: Arc<Self>) -> Pin<Box<dyn UdpPoller>> {
+        Box::pin(AlwaysWritable)
+    }
+
+    fn try_send(&self, transmit: &Transmit<'_>) -> io::Result<()> {
+        let n = self.sent.fetch_add(1, Ordering::SeqCst);
+        if let Some(delay) = (self.fate)(n) {
+            let datagram = (transmit.destination, transmit.contents.to_vec());
+            let _ = self.outbox.send((Instant::now() + delay, datagram));
+        }
+        Ok(())
+    }
+
+    fn poll_recv(
+        &self,
+        cx: &mut Context<'_>,
+        bufs: &mut [IoSliceMut<'_>],
+        meta: &mut [RecvMeta],
+    ) -> Poll<io::Result<usize>> {
+        let Some((from, datagram)) = ready!(self.inbox.lock().unwrap().poll_recv(cx)) else {
+            return Poll::Pending;
+        };
+        bufs[0][..datagram.len()].copy_from_slice(&datagram);
+        meta[0] = RecvMeta {
+            addr: from,
+            len: datagram.len(),
+            stride: datagram.len(),
+            ..RecvMeta::default()
+        };
+        Poll::Ready(Ok(1))
+    }
+
+    fn local_addr(&self) -> io::Result<SocketAddr> {
+        Ok(self.addr)
+    }
+}
+
+#[derive(Debug)]
+struct AlwaysWritable;
+impl UdpPoller for AlwaysWritable {
+    fn poll_writable(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<io::Result<()>> {
+        Poll::Ready(Ok(()))
+    }
+}
+
+fn endpoint(socket: Arc<Socket>, server: Option<quinn::ServerConfig>) -> Endpoint {
+    let runtime = Arc::new(TokioRuntime);
+    Endpoint::new_with_abstract_socket(EndpointConfig::default(), server, socket, runtime).unwrap()
+}
+
+fn acceptor(network: &Network, port: u16, fate: Fate) -> QuinnAcceptor {
+    let cert = include_bytes!("../../certs/cert.pem").as_slice();
+    let key = include_bytes!("../../certs/key.pem").as_slice();
+    let config = RustlsConfig::new(Keycert::new().cert(cert).key(key));
+    let socket = network.socket(port, fate);
+    let endpoint = endpoint(socket.clone(), Some(config.try_into().unwrap()));
+    QuinnAcceptor::new(endpoint, socket.addr, CancellationToken::new())
+}
+
+fn client(network: &Network, port: u16, fate: Fate) -> Endpoint {
+    let roots = read_trust_anchor(include_bytes!("../../certs/chain.pem")).unwrap();
+    let mut tls =
```

---

### Incident Patch 2: `331d1de6` (2026-10-04)
**Commit Message**: fix(core): honor HTTP protocol feature flags (#1713)

**File**: `.github/workflows/linux.yml` (modified, +27/-0)
```diff
@@ -120,3 +120,30 @@ jobs:
 
       - name: check --feature-powerset
         run: cargo hack check --feature-powerset --depth 1 -Z avoid-dev-deps --exclude-features server --at-least-one-of aws-lc-rs,ring --exclude-no-default-features
+
+  protocols:
+    name: Protocol features (${{ matrix.features }})
+    runs-on: ubuntu-latest
+    strategy:
+      fail-fast: false
+      matrix:
+        features:
+          - ''
+          - 'server,http1'
+          - 'server,http2'
+          - 'server,http1,http2'
+          - 'server,http1,websocket'
+    steps:
+      - uses: actions/checkout@v6
+      - uses: dtolnay/rust-toolchain@stable
+      - name: Check selected protocols
+        run: cargo check -p salvo --no-default-features --features '${{ matrix.features }}'
+      - name: Verify HTTP/2 is excluded when disabled
+        if: ${{ !contains(matrix.features, 'http2') }}
+        shell: bash
+        run: |
+          tree=$(cargo tree -p salvo --no-default-features --features '${{ matrix.features }}' --edges normal,build --prefix none)
+          if grep -q '^h2 v' <<< "$tree"; then
+            echo 'HTTP/2 was enabled unexpectedly'
+            exit 1
+          fi
```

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -6,6 +6,12 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 
 ## [Unreleased]
 
+### Fixed
+
+- Honor the `http1` and `http2` feature flags when enabling Hyper protocols. HTTP/1-only
+  builds, including WebSocket support, no longer compile `h2` unless another dependency
+  enables HTTP/2. Default protocol support is unchanged.
+
 ## [1.0.0] - 2026-09-24
 
 ### Security
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ http-body-util = "0.1"
 hmac = "0.13"
 hex = "0.4"
 hostname-validator = "1"
-hyper = { version = "1", features = ["full"] }
+hyper = { version = "1", default-features = false }
 hyper-rustls = { version = "0.27", default-features = false }
 hyper-util = { version = "0.1", default-features = true }
 indexmap = "2"
```

**File**: `crates/core/Cargo.toml` (modified, +2/-2)
```diff
@@ -54,7 +54,7 @@ aws-lc-rs = ["tokio-rustls?/aws-lc-rs", "quinn?/rustls-aws-lc-rs"]
 ring = ["tokio-rustls?/ring", "quinn?/rustls-ring"]
 server = []
 server-handle = []
-http1 = []
+http1 = ["hyper/http1"]
 http2 = ["hyper/http2"]
 http2-cleartext = ["http2"]
 quinn = ["dep:salvo-http3", "dep:quinn", "dep:h3-datagram", "rustls"]
@@ -99,7 +99,7 @@ h3-datagram = { workspace = true, optional = true }
 headers = { workspace = true }
 http = { workspace = true }
 http-body-util = { workspace = true }
-hyper = { workspace = true, features = ["http1", "client", "server"] }
+hyper = { workspace = true, features = ["client", "server"] }
 indexmap = { workspace = true }
 mime = { workspace = true }
 mime-infer = { workspace = true }
```

**File**: `crates/core/src/lib.rs` (modified, +4/-0)
```diff
@@ -23,6 +23,10 @@
 //! | `anyhow` | Integrate with the [`anyhow`](https://crates.io/crates/anyhow) crate | ❌ |
 //! | `eyre` | Integrate with the [`eyre`](https://crates.io/crates/eyre) crate | ❌ |
 //! | `rfc9457` | RFC 9457 Problem Details responses | ❌ |
+//!
+//! To build an HTTP/1-only server, disable default features and enable `server`
+//! and `http1`. Other dependencies can still enable Hyper's HTTP/2 support through
+//! Cargo feature unification.
 #![doc(html_favicon_url = "https://salvo.rs/favicon-32x32.png")]
 #![doc(html_logo_url = "https://salvo.rs/images/logo.svg")]
 #![cfg_attr(docsrs, feature(doc_cfg))]
```

**File**: `crates/extra/Cargo.toml` (modified, +0/-1)
```diff
@@ -75,7 +75,6 @@ http-body-util = { workspace = true, optional = true }
 hyper = { workspace = true, features = [
     "server",
     "http1",
-    "http2",
     "client",
 ], optional = true }
 pin-project = { workspace = true, optional = true }
```

**File**: `crates/salvo/src/lib.rs` (modified, +11/-0)
```diff
@@ -63,6 +63,17 @@
 //! cryptography providers. Enable only one in normal builds. If Cargo feature
 //! unification enables both, call `jwt_auth::install_crypto_provider()` before
 //! any JWT operation.
+//!
+//! To build an HTTP/1-only server without compiling the `h2` dependency:
+//!
+//! ```toml
+//! [dependencies]
+//! salvo = { version = "1", default-features = false, features = ["server", "http1"] }
+//! ```
+//!
+//! Add other features as needed. Cargo features are additive: `full`, `http2`,
+//! `http2-cleartext`, or dependencies that enable Hyper's HTTP/2 support (such as
+//! `proxy`, `acme`, and the OIDC client in `jwt-auth`) will compile `h2` again.
 #![doc(html_favicon_url = "https://salvo.rs/favicon-32x32.png")]
 #![doc(html_logo_url = "https://salvo.rs/images/logo.svg")]
 #![cfg_attr(docsrs, feature(doc_cfg))]
```

---

### Incident Patch 3: `e011f4d2` (2026-09-24)
**Commit Message**: fix(examples): align OpenTelemetry examples with 0.33 (#1710)

**File**: `examples/Cargo.toml` (modified, +1/-2)
```diff
@@ -42,9 +42,8 @@ futures = "0.3.31"
 opentelemetry = "0.33"
 opentelemetry-appender-tracing = "0.33"
 opentelemetry-http = "0.33"
-opentelemetry-otlp = "0.33"
+opentelemetry-otlp = { version = "0.33", default-features = false }
 opentelemetry_sdk = "0.33"
-opentelemetry-semantic-conventions = "0.33"
 
 argon2 = "0.5.3"
 dotenvy = "0.15.6"
```

**File**: `examples/logging-otlp/Cargo.toml` (modified, +1/-3)
```diff
@@ -11,9 +11,7 @@ salvo = { workspace = true, features = ["logging"] }
 tokio = { workspace = true, features = ["macros"] }
 tracing.workspace = true
 tracing-subscriber = { workspace = true, features = ["env-filter"] }
-opentelemetry = { workspace = true }
 opentelemetry-appender-tracing = { workspace = true }
-opentelemetry-otlp = { workspace = true, features = ["grpc-tonic"] }
+opentelemetry-otlp = { workspace = true, features = ["grpc-tonic", "logs"] }
 opentelemetry_sdk = { workspace = true, features = ["rt-tokio"] }
-opentelemetry-semantic-conventions = { workspace = true }
 tracing-appender = { workspace = true }
```

**File**: `examples/otel-jaeger/Cargo.toml` (modified, +2/-7)
```diff
@@ -22,13 +22,8 @@ salvo = { workspace = true, features = ["affix-state", "otel"] }
 tokio = { workspace = true, features = ["macros"] }
 tracing.workspace = true
 tracing-subscriber.workspace = true
-opentelemetry = { workspace = true, features = ["metrics"] }
+opentelemetry = { workspace = true, features = ["trace"] }
 reqwest = { workspace = true }
 opentelemetry-http.workspace = true
 opentelemetry_sdk = { workspace = true, features = ["rt-tokio"] }
-opentelemetry-otlp = { workspace = true, features = [
-    "http-proto",
-    "tonic",
-    "trace",
-    "reqwest",
-] }
+opentelemetry-otlp = { workspace = true, features = ["grpc-tonic", "trace"] }
```

**File**: `examples/otel-jaeger/README.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 First make sure you have a running version of the Jaeger instance you want to send data to:
 
 ```shell
-docker run -d -e COLLECTOR_OTLP_ENABLED=true -p6831:6831/udp -p6832:6832/udp -p16686:16686 -p14268:14268 jaegertracing/all-in-one:latest
+docker run -d -e COLLECTOR_OTLP_ENABLED=true -p16686:16686 -p4317:4317 jaegertracing/all-in-one:latest
 ```
 
 Launch the servers:
```

**File**: `examples/otel-jaeger/src/client.rs` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ fn init_tracer_provider() -> SdkTracerProvider {
     global::set_text_map_propagator(TraceContextPropagator::new());
     let exporter = opentelemetry_otlp::SpanExporter::builder()
         .with_tonic()
-        .with_endpoint("http://localhost:14268/api/traces")
+        .with_endpoint("http://localhost:4317")
         .build()
         .expect("failed to create exporter");
     SdkTracerProvider::builder()
```

---

### Incident Patch 4: `fcff5db2` (2026-09-24)
**Commit Message**: build(deps): upgrade OpenTelemetry crates to 0.33 together (#1709)

**File**: `Cargo.toml` (modified, +4/-4)
```diff
@@ -96,10 +96,10 @@ multimap = "0.10"
 native-tls = "0.2"
 nix = { version = "0.31", default-features = false }
 openssl = { version = "0.10" }
-opentelemetry = { version = "0.32", default-features = false }
-opentelemetry-http = { version = "0.32", default-features = false }
-opentelemetry-semantic-conventions = { version = "0.32", default-features = false }
-opentelemetry_sdk = { version = "0.32", default-features = false }
+opentelemetry = { version = "0.33", default-features = false }
+opentelemetry-http = { version = "0.33", default-features = false }
+opentelemetry-semantic-conventions = { version = "0.33", default-features = false }
+opentelemetry_sdk = { version = "0.33", default-features = false }
 parking_lot = "0.12"
 path-slash = "0.2"
 percent-encoding = "2"
```

**File**: `crates/otel/Cargo.toml` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ opentelemetry-http = { workspace = true }
 opentelemetry-semantic-conventions = { workspace = true, features = [
     "semconv_experimental",
 ] }
-opentelemetry = { workspace = true, features = ["metrics"] }
+opentelemetry = { workspace = true, features = ["metrics", "trace"] }
 percent-encoding = { workspace = true }
 salvo_core = { workspace = true, default-features = false }
 tracing = { workspace = true }
```

**File**: `examples/Cargo.toml` (modified, +7/-7)
```diff
@@ -39,12 +39,12 @@ eyre = "0.6.12"
 tera = "1.20.1"
 futures = "0.3.31"
 
-opentelemetry = "0.32"
-opentelemetry-appender-tracing = "0.32"
-opentelemetry-http = "0.32"
-opentelemetry-otlp = "0.32"
-opentelemetry_sdk = "0.32"
-opentelemetry-semantic-conventions = "0.32"
+opentelemetry = "0.33"
+opentelemetry-appender-tracing = "0.33"
+opentelemetry-http = "0.33"
+opentelemetry-otlp = "0.33"
+opentelemetry_sdk = "0.33"
+opentelemetry-semantic-conventions = "0.33"
 
 argon2 = "0.5.3"
 dotenvy = "0.15.6"
@@ -80,4 +80,4 @@ salvo-oapi = { path = "../crates/oapi" }
 rand_core = "0.9.3"
 
 toasty = { version = "0.8.0", default-features = false }
-jiff = "0.2.23"
\ No newline at end of file
+jiff = "0.2.23"
```

---

### Incident Patch 5: `6aec86a8` (2026-09-24)
**Commit Message**: fix(serve-static): block paths beneath dot directories (#1708)

**File**: `crates/serve-static/src/dir.rs` (modified, +2/-6)
```diff
@@ -501,14 +501,10 @@ impl Handler for StaticDir {
         let rel_path = normalize_url_path(rel_path);
         let mut files: HashMap<String, Metadata> = HashMap::new();
         let mut dirs: HashMap<String, Metadata> = HashMap::new();
-        let is_dot_file = Path::new(&rel_path)
-            .file_name()
-            .and_then(|s| s.to_str())
-            .map(|s| s.starts_with('.'))
-            .unwrap_or(false);
+        let has_dot_segment = rel_path.split('/').any(|part| part.starts_with('.'));
         let mut abs_path = None;
         let roots = self.canonical_roots().await;
-        if self.include_dot_files || !is_dot_file {
+        if self.include_dot_files || !has_dot_segment {
             for root in &roots {
                 // Use a single async symlink_metadata call for file type checks, then verify
                 // the canonical target stays under the canonical root before serving it.
```

**File**: `crates/serve-static/src/lib.rs` (modified, +55/-0)
```diff
@@ -160,6 +160,61 @@ mod tests {
         assert_eq!(content, "copy3");
     }
 
+    #[tokio::test]
+    async fn test_static_dir_rejects_dot_directory_ancestors() {
+        let root = tempfile::TempDir::new().unwrap();
+        fs::create_dir_all(root.path().join(".git/objects")).unwrap();
+        fs::write(root.path().join(".git/config"), "token = secret").unwrap();
+        fs::write(root.path().join(".git/objects/data"), "object data").unwrap();
+        fs::write(root.path().join(".env"), "top-level secret").unwrap();
+        fs::write(root.path().join("public.txt"), "public data").unwrap();
+
+        let service = Service::new(
+            Router::with_path("{*path}")
+                .get(StaticDir::new(root.path().to_path_buf()).auto_list(true)),
+        );
+
+        for path in [
+            "/.env",
+            "/.git/config",
+            "/.git/objects/data",
+            "/.git/objects/",
+        ] {
+            let response = TestClient::get(format!("http://127.0.0.1:5801{path}"))
+                .send(&service)
+                .await;
+            assert_eq!(response.status_code, Some(StatusCode::NOT_FOUND), "{path}");
+        }
+
+        let mut response = TestClient::get("http://127.0.0.1:5801/public.txt")
+            .send(&service)
+            .await;
+        assert_eq!(response.status_code, Some(StatusCode::OK));
+        assert_eq!(response.take_string().await.unwrap(), "public data");
+
+        let mut response = TestClient::get("http://127.0.0.1:5801/")
+            .add_header("accept", "application/json", true)
+            .send(&service)
+            .await;
+        let listing = response.take_string().await.unwrap();
+        assert!(listing.contains("public.txt"));
+        assert!(!listing.contains(".git"));
+        assert!(!listing.contains(".env"));
+
+        let included_service = Service::new(
+            Router::with_path("{*path}").get(
+                StaticDir::new(root.path().to_path_buf())
+                    .auto_list(true)
+                    .include_dot_files(true),
+            ),
+        );
+        let mut response = TestClient::get("http://127.0.0.1:5801/.git/config")
+            .send(&included_service)
+            .await;
+        assert_eq!(response.status_code, Some(StatusCode::OK));
+        assert_eq!(response.take_string().await.unwrap(), "token = secret");
+    }
+
     #[tokio::test]
     async fn test_static_dir_rejects_symlinked_directory_escape() {
         let public = tempfile::TempDir::new().unwrap();
```

---

### Incident Patch 6: `9beb091f` (2026-09-08)
**Commit Message**: build(deps): update zstd requirement from 0.13 to 0.14 (#1703)

Updates the requirements on [zstd](https://github.com/gyscos/zstd-rs) to permit the latest version.
- [Release notes](https://github.com/gyscos/zstd-rs/releases)
- [Commits](https://github.com/gyscos/zstd-rs/compare/v0.13.0...v0.14.0)

---
updated-dependencies:
- dependency-name: zstd
  dependency-version: 0.14.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -152,7 +152,7 @@ x509-parser = "0.18"
 # Compress
 brotli = { version = "9", default-features = false }
 flate2 = { version = "1", default-features = false }
-zstd = { version = "0.13", default-features = false }
+zstd = { version = "0.14", default-features = false }
 
 [workspace.lints.rust]
 missing_debug_implementations = "warn"
```

---

### Incident Patch 7: `51be2933` (2026-09-07)
**Commit Message**: build(deps): update brotli requirement from 8 to 9 (#1701)

Updates the requirements on [brotli](https://github.com/dropbox/rust-brotli) to permit the latest version.
- [Release notes](https://github.com/dropbox/rust-brotli/releases)
- [Commits](https://github.com/dropbox/rust-brotli/compare/8.0.0...9.0.0)

---
updated-dependencies:
- dependency-name: brotli
  dependency-version: 9.0.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -149,7 +149,7 @@ uuid = "1"
 x509-parser = "0.18"
 
 # Compress
-brotli = { version = "8", default-features = false }
+brotli = { version = "9", default-features = false }
 flate2 = { version = "1", default-features = false }
 zstd = { version = "0.13", default-features = false }
 
```

---

### Incident Patch 8: `8f5d643f` (2026-09-03)
**Commit Message**: fix(tls): pass the rustls CryptoProvider explicitly instead of relying on crate features (#1699)

* fix(tls): pass the rustls CryptoProvider explicitly

rustls can only choose a cryptographic backend on its own when exactly one of its
`aws-lc-rs` and `ring` features is enabled across the whole dependency graph. As
soon as another crate pulls in the other backend, cargo feature unification makes
the choice ambiguous and rustls panics with "Could not automatically determine the
process-level CryptoProvider from Rustls crate features". That took down
`RustlsListener`, `QuinnListener`, `AcmeListener` and the proxy's default
`HyperClient`.

Select the provider from Salvo's own features and hand it to rustls explicitly,
following the pattern `jwt-auth`'s OIDC client already uses:

- an application that installed a process level provider keeps it, because
  `default_crypto_provider()` returns that one;
- otherwise a provider is built from the crate features and passed to
  `builder_with_provider` without being installed, so the application stays free
  to install whatever it wants, whenever it wants.

Salvo no longer writes the process level default anywhere on these paths. This
also make

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -63,6 +63,9 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 - `examples/oapi-3-2` demonstrates emitting a 3.2 document with a `QUERY` route.
 - `salvo_core::fs::extension_content_encoding`, which reports the content coding a file
   extension implies, so a handler choosing a file to serve can tell that it already carries one.
+- `salvo_core::conn::rustls::default_crypto_provider`, which reports the rustls `CryptoProvider`
+  Salvo builds its TLS configurations with. Pass it to other rustls based libraries so the whole
+  application agrees on one backend.
 
 ### Changed
 
@@ -96,6 +99,15 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 
 ### Fixed
 
+- TLS setup no longer panics with *"Could not automatically determine the process-level
+  `CryptoProvider` from Rustls crate features"*. rustls can only pick a backend by itself when
+  exactly one of its `aws-lc-rs` and `ring` features is enabled across the whole dependency
+  graph, so pulling in any crate that enables the other one made `RustlsListener`,
+  `QuinnListener`, `AcmeListener` and the proxy's default `HyperClient` panic. Salvo now selects
+  the provider from its own features and passes it to rustls explicitly. An application that
+  installed a process level provider through `CryptoProvider::install_default` still has that
+  one used; Salvo itself never installs one, so applications keep full control over the
+  process level default.
 - `StaticDir` names a download after the file that was requested rather than the precompressed
   sidecar it was served from, so a request for `logo.svg` answered out of `logo.svg.br` no
   longer offers `Content-Disposition: attachment; filename="logo.svg.br"`.
```

**File**: `crates/acme/src/listener.rs` (modified, +25/-1)
```diff
@@ -17,6 +17,7 @@ use salvo_core::http::uri::Scheme;
 use salvo_core::{Result as CoreResult, Router, cfg_feature};
 use tokio::io::{AsyncRead, AsyncWrite};
 use tokio_rustls::TlsAcceptor;
+use tokio_rustls::rustls::crypto::CryptoProvider;
 use tokio_rustls::rustls::server::ServerConfig;
 use tokio_rustls::server::TlsStream;
 
@@ -33,6 +34,27 @@ cfg_feature! {
 /// ACME TLS-ALPN-01 protocol name.
 const ACME_TLS_ALPN_NAME: &[u8] = b"acme-tls/1";
 
+/// Returns the [`CryptoProvider`] used to build the ACME `ServerConfig`.
+///
+/// Reuses the process level provider when the application installed one, otherwise builds one
+/// from this crate's `aws-lc-rs` / `ring` features without installing it globally. Passing the
+/// provider explicitly keeps rustls from panicking when feature unification makes both backends
+/// available at once. `ring` wins when both are on, matching this crate's default.
+fn default_crypto_provider() -> Arc<CryptoProvider> {
+    if let Some(provider) = CryptoProvider::get_default() {
+        return Arc::clone(provider);
+    }
+
+    #[cfg(any(feature = "ring", not(feature = "aws-lc-rs")))]
+    {
+        Arc::new(tokio_rustls::rustls::crypto::ring::default_provider())
+    }
+    #[cfg(all(not(feature = "ring"), feature = "aws-lc-rs"))]
+    {
+        Arc::new(tokio_rustls::rustls::crypto::aws_lc_rs::default_provider())
+    }
+}
+
 /// A wrapper around an underlying listener which implements ACME.
 pub struct AcmeListenerBuilder<T> {
     inner: T,
@@ -367,7 +389,9 @@ impl<T> AcmeListenerBuilder<T> {
         };
         let cert_resolver = Arc::new(cert_resolver);
 
-        let mut server_config = ServerConfig::builder()
+        let mut server_config = ServerConfig::builder_with_provider(default_crypto_provider())
+            .with_safe_default_protocol_versions()
+            .map_err(salvo_core::Error::other)?
             .with_no_client_auth()
             .with_cert_resolver(cert_resolver.clone());
 
```

**File**: `crates/core/Cargo.toml` (modified, +3/-1)
```diff
@@ -152,7 +152,9 @@ nix = { workspace = true, optional = true, features = ["fs", "user"] }
 [dev-dependencies]
 criterion = { workspace = true }
 fastrand = { workspace = true }
-rustls = { workspace = true, features = ["aws-lc-rs"] }
+# Both backends on purpose: this makes rustls unable to pick a provider from crate features,
+# which is exactly the situation that used to panic. See `conn::rustls::default_crypto_provider`.
+rustls = { workspace = true, features = ["aws-lc-rs", "ring"] }
 tokio = { workspace = true, features = ["macros", "rt"] }
 
 [lints]
```

**File**: `crates/core/src/conn/rustls.rs` (modified, +45/-2)
```diff
@@ -1,7 +1,9 @@
 //! `RustlsListener` and utils.
 use std::io::{Error as IoError, Result as IoResult};
+use std::sync::Arc;
 
 use tokio_rustls::rustls::RootCertStore;
+use tokio_rustls::rustls::crypto::CryptoProvider;
 use tokio_rustls::rustls::pki_types::{CertificateDer, pem::PemObject};
 
 pub(crate) mod config;
@@ -10,6 +12,44 @@ pub use config::{Keycert, RustlsConfig, ServerConfig};
 mod listener;
 pub use listener::{RustlsAcceptor, RustlsListener};
 
+/// Returns the [`CryptoProvider`] used to build rustls configurations.
+///
+/// rustls needs to know which cryptographic backend to use. It can pick one on its own only
+/// when exactly one of its `aws-lc-rs` and `ring` features is enabled in the whole dependency
+/// graph. As soon as another crate pulls in the other backend, cargo feature unification makes
+/// the choice ambiguous and rustls panics with *"Could not automatically determine the
+/// process-level `CryptoProvider` from Rustls crate features"*.
+///
+/// To stay panic free, Salvo never relies on that automatic selection:
+///
+/// - If the application already installed a process level provider through
+///   [`CryptoProvider::install_default`] (a FIPS or HSM backed one, for instance), it is reused
+///   as is.
+/// - Otherwise a provider is built from Salvo's own `aws-lc-rs` / `ring` features and passed
+///   explicitly to rustls. It is **not** installed as the process default, so the application
+///   remains free to install whichever provider it wants, whenever it wants.
+///
+/// `aws-lc-rs` wins when both features are on, matching Salvo's own default and the backend the
+/// certified keys are already signed with in [`RustlsConfig`].
+///
+/// This is also the provider to pass to other rustls based libraries used alongside Salvo, so
+/// that the whole application agrees on a single backend.
+#[must_use]
+pub fn default_crypto_provider() -> Arc<CryptoProvider> {
+    if let Some(provider) = CryptoProvider::get_default() {
+        return Arc::clone(provider);
+    }
+
+    #[cfg(any(feature = "aws-lc-rs", not(feature = "ring")))]
+    {
+        Arc::new(tokio_rustls::rustls::crypto::aws_lc_rs::default_provider())
+    }
+    #[cfg(all(not(feature = "aws-lc-rs"), feature = "ring"))]
+    {
+        Arc::new(tokio_rustls::rustls::crypto::ring::default_provider())
+    }
+}
+
 pub(crate) fn read_trust_anchor(trust_anchor: &[u8]) -> IoResult<RootCertStore> {
     let certs = CertificateDer::pem_slice_iter(trust_anchor)
         .collect::<Result<Vec<_>, _>>()
@@ -37,7 +77,8 @@ mod tests {
 
     #[tokio::test]
     async fn test_rustls_listener() {
-        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
+        // No `CryptoProvider::install_default()` call here on purpose: both the listener and the
+        // client below must work without a process level provider being installed.
         let mut acceptor = TcpListener::new("127.0.0.1:0")
             .rustls(RustlsConfig::new(
                 Keycert::new()
@@ -57,7 +98,9 @@ mod tests {
         tokio::spawn(async move {
             let stream = TcpStream::connect(addr).await.unwrap();
             let trust_anchor = include_bytes!("../../certs/chain.pem");
-            let client_config = ClientConfig::builder()
+            let client_config = ClientConfig::builder_with_provider(default_crypto_provider())
+                .with_safe_default_protocol_versions()
+                .unwrap()
                 .with_root_certificates(read_trust_anchor(trust_anchor.as_slice()).unwrap())
                 .with_no_client_auth();
             let connector = TlsConnector::from(Arc::new(client_config));
```

**File**: `crates/core/src/conn/rustls/config.rs` (modified, +4/-2)
```diff
@@ -21,7 +21,7 @@ pub use tokio_rustls::rustls::server::ServerConfig;
 
 use crate::{IntoVecString, conn::IntoConfigStream};
 
-use super::read_trust_anchor;
+use super::{default_crypto_provider, read_trust_anchor};
 
 /// Private key and certificate
 #[derive(Clone, Debug)]
@@ -291,7 +291,9 @@ impl RustlsConfig {
             }
         };
 
-        let mut config = ServerConfig::builder_with_protocol_versions(self.tls_versions)
+        let mut config = ServerConfig::builder_with_provider(default_crypto_provider())
+            .with_protocol_versions(self.tls_versions)
+            .map_err(|e| IoError::other(format!("failed to build server config: {e}")))?
             .with_client_cert_verifier(client_auth)
             .with_cert_resolver(Arc::new(CertResolver {
                 literal_certified_keys,
```

**File**: `crates/proxy/Cargo.toml` (modified, +4/-2)
```diff
@@ -22,7 +22,7 @@ rustdoc-args = ["--cfg", "docsrs"]
 [features]
 default = ["aws-lc-rs", "hyper-client", "unix-sock-client"]
 full = ["aws-lc-rs", "hyper-client", "reqwest-client", "unix-sock-client"]
-aws-lc-rs = ["hyper-rustls?/aws-lc-rs", "reqwest?/rustls"]
+aws-lc-rs = ["hyper-rustls?/aws-lc-rs", "reqwest?/rustls", "rustls", "rustls/aws-lc-rs"]
 ring = ["hyper-rustls?/ring", "reqwest?/rustls-no-provider", "rustls", "rustls/ring"]
 hyper-client = ["dep:hyper-util", "dep:hyper-rustls"]
 reqwest-client = ["dep:reqwest"]
@@ -58,7 +58,9 @@ tracing = { workspace = true }
 [dev-dependencies]
 futures-util = { workspace = true, features = ["sink"] }
 salvo_core = { workspace = true, features = ["http1", "server", "test"] }
-rustls ={ workspace = true, features = ["aws-lc-rs"]}
+# Both backends on purpose: this makes rustls unable to pick a provider from crate features,
+# which is exactly the situation that used to panic when building the default HTTPS connector.
+rustls = { workspace = true, features = ["aws-lc-rs", "ring"] }
 salvo_extra = { workspace = true, features = ["websocket"] }
 tokio-tungstenite = { workspace = true }
 
```

**File**: `crates/proxy/src/hyper_client.rs` (modified, +46/-23)
```diff
@@ -1,10 +1,12 @@
 use std::io;
+use std::sync::Arc;
 
 use hyper::upgrade::OnUpgrade;
 use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
 use hyper_util::client::legacy::Client as HyperUtilClient;
 use hyper_util::client::legacy::connect::{Connect, HttpConnector};
 use hyper_util::rt::TokioExecutor;
+use rustls::crypto::CryptoProvider;
 use salvo_core::Error;
 use salvo_core::http::{ReqBody, ResBody, StatusCode};
 use salvo_core::rt::tokio::TokioIo;
@@ -21,12 +23,40 @@ pub struct HyperClient<C> {
     inner: HyperUtilClient<C, ReqBody>,
 }
 
+/// Returns the [`CryptoProvider`] used to build the default HTTPS connector.
+///
+/// Reuses the process level provider when the application installed one, otherwise builds one
+/// from this crate's `aws-lc-rs` / `ring` features without installing it globally. Passing the
+/// provider explicitly keeps rustls from panicking when feature unification makes both backends
+/// available at once.
+///
+/// `ring` wins when both features are on. `aws-lc-rs` is what `default` and `full` select, and
+/// the `salvo` crate always pulls this one in through `salvo-proxy/full`, so `ring` can only be
+/// there because it was asked for. It also keeps this in step with `ReqwestClient::default`,
+/// which still has to install ring as the process default for `reqwest`'s sake: were the two to
+/// disagree, which provider this function returns would depend on whether a `ReqwestClient` had
+/// been built first.
+fn default_crypto_provider() -> Arc<CryptoProvider> {
+    if let Some(provider) = CryptoProvider::get_default() {
+        return Arc::clone(provider);
+    }
+
+    #[cfg(feature = "ring")]
+    {
+        Arc::new(rustls::crypto::ring::default_provider())
+    }
+    #[cfg(not(feature = "ring"))]
+    {
+        Arc::new(rustls::crypto::aws_lc_rs::default_provider())
+    }
+}
+
 fn build_default_https_connector_with(
     native_roots: impl FnOnce() -> io::Result<HttpsConnector<HttpConnector>>,
-    webpki_roots: impl FnOnce() -> HttpsConnector<HttpConnector>,
-) -> HttpsConnector<HttpConnector> {
+    webpki_roots: impl FnOnce() -> io::Result<HttpsConnector<HttpConnector>>,
+) -> io::Result<HttpsConnector<HttpConnector>> {
     match native_roots() {
-        Ok(connector) => connector,
+        Ok(connector) => Ok(connector),
         Err(error) => {
             tracing::warn!(
                 error = ?error,
@@ -39,24 +69,24 @@ fn build_default_https_connector_with(
 
 impl Default for HyperClient<HttpsConnector<HttpConnector>> {
     fn default() -> Self {
-        #[cfg(feature = "ring")]
-        let _ = rustls::crypto::ring::default_provider().install_default();
         let https = build_default_https_connector_with(
             || {
                 Ok(HttpsConnectorBuilder::new()
-                    .with_native_roots()?
+                    .with_provider_and_native_roots(default_crypto_provider())?
                     .https_or_http()
                     .enable_all_versions()
                     .build())
             },
             || {
-                HttpsConnectorBuilder::new()
-                    .with_webpki_roots()
+                Ok(HttpsConnectorBuilder::new()
+                    .with_provider_and_webpki_roots(default_crypto_provider())
+                    .map_err(io::Error::other)?
                     .https_or_http()
                     .enable_all_versions()
-                    .build()
+                    .build())
             },
-        );
+        )
+        .expect("failed to build the default https connector for proxy hyper client");
         Self {
             inner: HyperUtilClient::builder(TokioExecutor::new()).build(https),
         }
@@ -154,27 +184,24 @@ mod tests {
 
     #[test]
     fn test_default_connector_falls_back_to_webpki_roots() {
-        let _ = rustls::crypto::aws_lc_rs::default_provider()
-            .install_default();
-
         let connector = build_default_https_connector_with(
             || Err(io::Error::other("missing native roots")),
             || {
-                HttpsConnectorBuilder::new()
-                    .with_webpki_roots()
+                Ok(HttpsConnectorBuilder::new()
+                    .with_provider_and_webpki_roots(default_crypto_provider())
+                    .map_err(io::Error::other)?
                     .https_or_http()
                     .enable_all_versions()
-                    .build()
+                    .build())
             },
-        );
+        )
+        .expect("webpki roots fallback should succeed");
 
         let _client = HyperClient::new(HyperUtilClient::builder(TokioExecutor::new()).build(connector));
     }
 
     #[tokio::test]
     async fn test_upstreams_elect() {
-        let _ = rustls::crypto::aws_lc_rs::default_provider()
-            .install_default();
         let upstreams = vec!["https://www.example.com", "https://www.example2.com"];
         let proxy = Proxy::new(upstreams.clone(), HyperClient::default());
    
```

**File**: `crates/proxy/src/lib.rs` (modified, +0/-4)
```diff
@@ -888,7 +888,6 @@ mod tests {
 
     #[test]
     fn test_host_header_handling() {
-        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
         let uri = Uri::from_str("http://host.tld/test").unwrap();
         let mut req = Request::new();
         let depot = Depot::new();
@@ -937,7 +936,6 @@ mod tests {
 
     #[test]
     fn test_proxy_default_host_header_getter_includes_port() {
-        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
         // `Proxy::new` now defaults to the standards-compliant getter, which keeps
         // a non-default upstream port in the forwarded `Host`.
         let proxy = Proxy::new(vec!["http://host.tld:8080"], HyperClient::default());
@@ -1107,8 +1105,6 @@ mod tests {
 
     #[tokio::test]
     async fn test_proxy_websocket_connection_with_split_connection_headers() {
-        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
-
         let upstream_router = Router::with_path("ws").goal(websocket_echo);
         let (upstream_addr, upstream_server) = spawn_server(upstream_router).await;
 
```

---

### Incident Patch 9: `d2773533` (2026-08-25)
**Commit Message**: fix(webtransport): generate short-lived certificate at startup (#1698)

* fix(webtransport): generate short-lived certificate at startup

Generate a P-256 development certificate when the example starts and provide its SHA-256 hash to same-origin WebTransport clients.

Remove the checked-in certificate, private key, and expired origin trial token. Reuse the existing AWS-LC backend for certificate generation.

Fixes #1226

* fix(webtransport): resolve relative client URLs

Resolve WebTransport targets against the page URL before checking their origin so relative paths such as /counter continue to work.

**File**: `examples/webtransport/Cargo.toml` (modified, +3/-0)
```diff
@@ -15,3 +15,6 @@ tracing-subscriber.workspace = true
 serde = "1"
 serde_json = "1"
 bytes = "1"
+rcgen = { version = "0.14", default-features = false, features = ["aws_lc_rs", "pem"] }
+sha2 = "0.11"
+time.workspace = true
```

**File**: `examples/webtransport/certs/cert.pem` (removed, +0/-24)
```diff
@@ -1,24 +0,0 @@
------BEGIN CERTIFICATE-----
-MIIEDDCCAnSgAwIBAgIQLu2TV80hCgYgZe18ovEhmzANBgkqhkiG9w0BAQsFADBZ
-MR4wHAYDVQQKExVta2NlcnQgZGV2ZWxvcG1lbnQgQ0ExFzAVBgNVBAsMDmh1eXV1
-bWlAcmlyaWthMR4wHAYDVQQDDBVta2NlcnQgaHV5dXVtaUByaXJpa2EwHhcNMTkw
-NjAxMDAwMDAwWhcNMzAwNTE5MDM0MjI2WjBCMScwJQYDVQQKEx5ta2NlcnQgZGV2
-ZWxvcG1lbnQgY2VydGlmaWNhdGUxFzAVBgNVBAsMDmh1eXV1bWlAcmlyaWthMIIB
-IjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5fRUIbEv2DjBmK7+syGVvh3I
-FWDlVjU9N7ypxauQbXPHAzpATzghLnpm5CqQFoTnJwA4//A85775djcVlsAUqen2
-ZYi+4jTYeuRLrAJ0dkrUS8/7+T0fGzGZ8obCsII5iSE2BMS7AxbqlQtClDdkNwcK
-rCuzrmIyMA8Bc2V231xIgcWFJ7en8OaZJRlYYK7kp2cJ8g0PbPnVq+9TAfFYcKEy
-FWqJsYYY36bLbWyqYXGMOtAh2bhy+YGYL3Jhk+cw7iMCjye4FbDAIQzt9cH1KGGM
-2VWZFiwn6VJquX1Z+n9KAhfzxuzYQHSrlJ+Rt++gezpTtNw8q15Ko78oiu7CLQID
-AQABo2cwZTAOBgNVHQ8BAf8EBAMCBaAwEwYDVR0lBAwwCgYIKwYBBQUHAwEwDAYD
-VR0TAQH/BAIwADAfBgNVHSMEGDAWgBSljCjB0QNrBG+8BV3nFnUyBn54jjAPBgNV
-HREECDAGhwR/AAABMA0GCSqGSIb3DQEBCwUAA4IBgQAsUrfA8deCaHYy7wB1jEVK
-pNZKRNcDKxqr/PXJQlfwwlq1qZTBzloMNTzfVBRkn/I7y+Bj/b1uYFmjQoQ3qG9s
-tIXFCYOop1cLltmWXC479/UtbEmhz0t+mzK0MFkLhxtbKqwvMGbcGGDFI/2/MGZN
-XFZXL1bclFieZxO5ePEkZSDkPcWvh9uYWCp8r7H6aAd/iwH4lDxfajyhDneRmd/v
-Mq0PgqTZhVHOP7JdVNA+6cewROyPL7ElLs66ujE9hsRvs6eXLjgLZrHOZShnoQxK
-JJv8UfoE90FX1uDt9w9i3raig/O3oePNkU263kJlR+J1rdVdYV+pCCb7L4Vk+1l3
-S4VFVGVHN8x35dISCJwZrtnqPlfpCiLjtEJOu1zJUEY2Q0n7Km3z3zQcs6iCeOQi
-O9MVJ4aiALdNvyCG7lL4+AJ/kWbwHFM6wOAKSrkpZ20msMuEgIlhCOi8PgYlKb+b
-V/lV6IJPVrAOOclgcvtfZ/LdsTxn15yLIieqgR0Lf/s=
------END CERTIFICATE-----
```

**File**: `examples/webtransport/certs/key.pem` (removed, +0/-28)
```diff
@@ -1,28 +0,0 @@
------BEGIN PRIVATE KEY-----
-MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDl9FQhsS/YOMGY
-rv6zIZW+HcgVYOVWNT03vKnFq5Btc8cDOkBPOCEuembkKpAWhOcnADj/8Dznvvl2
-NxWWwBSp6fZliL7iNNh65EusAnR2StRLz/v5PR8bMZnyhsKwgjmJITYExLsDFuqV
-C0KUN2Q3BwqsK7OuYjIwDwFzZXbfXEiBxYUnt6fw5pklGVhgruSnZwnyDQ9s+dWr
-71MB8VhwoTIVaomxhhjfpsttbKphcYw60CHZuHL5gZgvcmGT5zDuIwKPJ7gVsMAh
-DO31wfUoYYzZVZkWLCfpUmq5fVn6f0oCF/PG7NhAdKuUn5G376B7OlO03DyrXkqj
-vyiK7sItAgMBAAECggEBAIabZmAukz4zwwe4cDm1kC0wy73P8Y9sLMCivJKMYkff
-vQBjqd91kN7fIbmwPJYiCBlpZPRU0aIqxWZwyj9rgu0Pmn9G884AdzRAzRcMfNX9
-6ZXTUsFMCRhnCaHRRsgCAuIFwdQ6wOoHERxb8gZHAm+/vHyaPFz4+D3vmr7NBy+p
-fgpdDCGwkltKI73efk6H4oAeyztDwNev/TZ3Y+O3UKuAUfVReBX0us/lYgEf/KXV
-USd7envxACy+PDcqmn/HL6IUnbrc1zB92dmSSUUtLjOz//z1zM05ME/E2keMQwsW
-7LDen0Lm0Nh6AcOCxmnN4u0lJ3nWzU7PsHJKY/LznPUCgYEA5kQq/AG6LlL9Iu1E
-Y55AB1rkvseof41liaqXVccB5tr55IF75d0wPd6jF04W+x6LwmL6EUYPRGkkOdHE
-raz9CDE3a7hWbAghxIwLrI1s+faT5aaHG9o6mTeDyfgEEoBg8X2nQHQJPayDJZcW
-kiXQyHEtj/G4m/Y+WDFXastZz8MCgYEA/6c8+cI3Slvg3CZLG9f6rdAlrOSIQynF
-muXyVeUaxrU0OPC9H3WEwWv7n4adQU2g0L6TBTdlOOiv5SPIsOPQVN2JZVdxwg0V
-n5+7/WRrI9rAXnmu1x0q1e/TZ9Msggmrn5SdHaEfuug4DnHv4nct356joDwYB2i3
-xYl+yCSMd08CgYEAqduvOaasiG9/e7w6rqGV6dcK1hDCIxVSyXKloAjlRj5SCFXb
-53x6kakh9ZcNLMEjp4kLnqJnsLc+mcg7pUHuhZSIpVWdqqN1BV+pXOgWc22JO+bT
-05/vigaBmQLzPhKlcH6YWds+1dfkBl6lr7llgfa6/Wv6GlJTOwtqyMSow7ECgYEA
-zGQ8j8ICymRihh/ndL9cH5KGTI/5kRjYb1rgQGQG4E8HDW8LBRfDp5BZf9Tz7L3P
-kJSMnmMHflQqLJxLW4EHkpH7wxYCUQ589z2R4qhiMCw4GFBYxIsBMEGpVxyyPNTW
-baM3afTjlV8LUiEtlHWMK3h9gSIKZAIIytl+jy0JUGkCgYA3wrpcG3wgXeuEtoie
-ve/kFS5JRaOeV/9OLE2JGaGaumPlN0L14kCVvb6uqLa/P88BwBUxvGQ7FDBdh4sk
-ypuSe9ZPCNDgnsbnfM8QgFqIW6MDdizLtj7no1SKeaUU3JWWc0kH2KWMw/sYZ7ec
-0tcEInxEd7FbssGfMqF9fQtnNw==
------END PRIVATE KEY-----
```

**File**: `examples/webtransport/src/main.rs` (modified, +65/-4)
```diff
@@ -2,9 +2,12 @@ use std::time::Duration;
 
 use anyhow::{Context, Result};
 use bytes::Bytes;
+use rcgen::{CertificateParams, KeyPair};
 use salvo::conn::rustls::{Keycert, RustlsConfig};
 use salvo::prelude::*;
 use salvo::proto::webtransport;
+use sha2::{Digest, Sha256};
+use time::{Duration as TimeDuration, OffsetDateTime};
 use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
 use tokio::pin;
 
@@ -15,6 +18,41 @@ macro_rules! log_result {
         }
     };
 }
+
+#[derive(Debug)]
+struct CertificateHash([u8; 32]);
+
+#[handler]
+impl CertificateHash {
+    async fn handle(&self) -> Json<[u8; 32]> {
+        Json(self.0)
+    }
+}
+
+fn certificate_params(now: OffsetDateTime) -> Result<CertificateParams> {
+    let mut params = CertificateParams::new(vec!["localhost".to_owned(), "127.0.0.1".to_owned()])?;
+    // WebTransport permits certificate hashes only for short-lived certificates. Backdating by
+    // one minute tolerates small clock differences while keeping the total lifetime under 14 days.
+    params.not_before = now - TimeDuration::minutes(1);
+    params.not_after = now + TimeDuration::days(13);
+    Ok(params)
+}
+
+fn generate_certificate() -> Result<(RustlsConfig, CertificateHash)> {
+    let params = certificate_params(OffsetDateTime::now_utc())?;
+    let signing_key = KeyPair::generate()?;
+    let certificate = params.self_signed(&signing_key)?;
+    let certificate_hash = Sha256::digest(certificate.der().as_ref()).into();
+    let keycert = Keycert::new()
+        .cert(certificate.pem().into_bytes())
+        .key(signing_key.serialize_pem().into_bytes());
+
+    Ok((
+        RustlsConfig::new(keycert),
+        CertificateHash(certificate_hash),
+    ))
+}
+
 async fn echo_stream<T, R>(send: T, recv: R) -> anyhow::Result<()>
 where
     T: AsyncWrite,
@@ -116,20 +154,19 @@ where
 }
 
 #[tokio::main]
-async fn main() {
+async fn main() -> Result<()> {
     tracing_subscriber::fmt().init();
 
-    let cert = include_bytes!("../certs/cert.pem").to_vec();
-    let key = include_bytes!("../certs/key.pem").to_vec();
+    let (config, certificate_hash) = generate_certificate()?;
 
     let router = Router::new()
         .push(Router::with_path("counter").goal(connect))
+        .push(Router::with_path("certificate-hash").get(certificate_hash))
         .push(
             Router::with_path("{*path}")
                 .get(StaticDir::new(["webtransport/static", "./static"]).defaults("client.html")),
         );
 
-    let config = RustlsConfig::new(Keycert::new().cert(cert.as_slice()).key(key.as_slice()));
     let listener = TcpListener::new(("0.0.0.0", 8698)).rustls(config.clone());
 
     let acceptor = QuinnListener::new(config, ("0.0.0.0", 8698))
@@ -138,4 +175,28 @@ async fn main() {
         .await;
 
     Server::new(acceptor).serve(router).await;
+    Ok(())
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn certificate_parameters_meet_webtransport_requirements() {
+        let now = OffsetDateTime::now_utc();
+        let params = certificate_params(now).unwrap();
+
+        assert!(params.not_before <= now);
+        assert!(params.not_after >= now);
+        assert!(params.not_after - params.not_before < TimeDuration::days(14));
+    }
+
+    #[test]
+    fn generated_certificate_builds_a_quinn_config() {
+        let (config, certificate_hash) = generate_certificate().unwrap();
+
+        assert_ne!(certificate_hash.0, [0; 32]);
+        config.build_quinn_config().unwrap();
+    }
 }
```

**File**: `examples/webtransport/static/client.html` (modified, +4/-3)
```diff
@@ -2,15 +2,16 @@
 <html lang="en">
   <title>WebTransport over HTTP/3 client</title>
   <meta charset="utf-8">
-  <!-- WebTransport origin trial token. See https://developer.chrome.com/origintrials/#/view_trial/793759434324049921 -->
-  <meta http-equiv="origin-trial" content="AkSQvBVsfMTgBtlakApX94hWGyBPQJXerRc2Aq8g/sKTMF+yG62+bFUB2yIxaK1furrNH3KNNeJV00UZSZHicw4AAABceyJvcmlnaW4iOiJodHRwczovL2dvb2dsZWNocm9tZS5naXRodWIuaW86NDQzIiwiZmVhdHVyZSI6IldlYlRyYW5zcG9ydCIsImV4cGlyeSI6MTY0Mzc1OTk5OX0=">
   <script src="client.js"></script>
   <link rel="stylesheet" href="client.css">
   <meta name="viewport" content="width=device-width, initial-scale=1">
   <body>
   <div id="top">
     <div id="explanation">
       This tool can be used to connect to an arbitrary WebTransport server.
+      The example generates a short-lived development certificate at startup and
+      automatically supplies its hash to the browser. You may need to accept the
+      HTTPS warning for this page before connecting.
       It has several limitations:
       <ul>
         <li>It can only send an entirety of a stream at once.  Once the stream
@@ -63,4 +64,4 @@ <h2>Event log</h2>
     </div>
   </div>
   </body>
-</html>
\ No newline at end of file
+</html>
```

**File**: `examples/webtransport/static/client.js` (modified, +24/-2)
```diff
@@ -4,11 +4,33 @@
 
 let currentTransport, streamNumber, currentTransportDatagramWriter;
 
+async function getCertificateHash() {
+  const response = await fetch('/certificate-hash', {cache: 'no-store'});
+  if (!response.ok) {
+    throw new Error(`failed to load certificate hash: HTTP ${response.status}`);
+  }
+
+  const bytes = await response.json();
+  if (!Array.isArray(bytes) || bytes.length !== 32) {
+    throw new Error('server returned an invalid SHA-256 certificate hash');
+  }
+  return new Uint8Array(bytes);
+}
+
 // "Connect" button handler.
 async function connect() {
   const url = document.getElementById('url').value;
   try {
-    var transport = new WebTransport(url);
+    const targetUrl = new URL(url, window.location.href);
+    const options = {};
+    if (targetUrl.origin === window.location.origin) {
+      const certificateHash = await getCertificateHash();
+      options.serverCertificateHashes = [{
+        algorithm: 'sha-256',
+        value: certificateHash,
+      }];
+    }
+    var transport = new WebTransport(targetUrl.href, options);
     addToEventLog('Initiating connection...');
   } catch (e) {
     addToEventLog('Failed to create connection object. ' + e, 'error');
@@ -171,4 +193,4 @@ window.addEventListener("load", (event) => {
   const url = window.location;
   const counterUrl = `${url.protocol}//${url.host}/counter`;
   document.getElementById("url").value = counterUrl;
-});
\ No newline at end of file
+});
```

---

### Incident Patch 10: `d02d3ba1` (2026-08-10)
**Commit Message**: docs: add Seelen UI and Terraphim AI to ecosystem

Signed-off-by: Chrislearn Young <[REDACTED_EMAIL]>

**File**: `ECOSYSTEM.md` (modified, +4/-0)
```diff
@@ -12,6 +12,9 @@ If your project isn't listed here and you would like it to be, please feel free
 - [salvo-casbin](https://github.com/casbin-rs/salvo-casbin): Casbin access control hoop for salvo framework.
 
 ## Project showcase
+
+- [Seelen UI](https://github.com/eythaann/Seelen-UI): A fully customizable desktop environment for Windows 10/11, powered in part by Salvo.
+- [Terraphim AI](https://github.com/terraphim/terraphim-ai): A privacy-first, deterministic AI assistant with a Salvo-based GitHub Actions runner server.
 - [Savhub](https://github.com/savhub-ai/savhub): Easily manage your AI skills.
 - [palpo](https://github.com/palpo-matrix-server/palpo): A Rust Matrix Server Implementation.
 - [AI00 RWKV Server](https://github.com/Ai00-X/ai00_server): AI00 RWKV Server is an inference API server based on the RWKV model.
@@ -41,6 +44,7 @@ If your project isn't listed here and you would like it to be, please feel free
 - [chia gaming](https://github.com/Chia-Network/chia-gaming) - chia-gaming Traits and Structs.
 
 ## Tutorials
+
 - [Rust Salvo零基础教程](https://www.bilibili.com/video/BV1FS421N71D/): Rust Salvo零基础入门教程.
 - [使用Tera和Salvo构建单词本](https://www.bilibili.com/video/BV1Kg411b75s): 使用Tera和Salvo构建一个简单的单词本Web应用.
 - [is salvo really the simplest rust web framework?](https://www.youtube.com/watch?v=tf9x97eTcpk)
```

---

### Incident Patch 11: `1f59eff0` (2026-08-10)
**Commit Message**: Fix closed problem extension schemas (#1692)

**File**: `crates/oapi/src/lib.rs` (modified, +46/-21)
```diff
@@ -801,6 +801,37 @@ fn problem_base_schema(components: &mut Components) -> RefOr<schema::Schema> {
         .into()
 }
 
+#[cfg(feature = "rfc9457")]
+fn problem_schema_with_extensions(
+    components: &Components,
+    base: RefOr<schema::Schema>,
+    extensions: RefOr<schema::Schema>,
+) -> RefOr<schema::Schema> {
+    let extension_schema = match &extensions {
+        RefOr::Type(schema) => Some(schema),
+        RefOr::Ref(reference) => reference
+            .ref_location
+            .strip_prefix("#/components/schemas/")
+            .and_then(|name| components.schemas.get(name))
+            .and_then(|schema| match schema {
+                RefOr::Type(schema) => Some(schema),
+                RefOr::Ref(_) => None,
+            }),
+    };
+
+    if let Some(schema::Schema::Object(extension)) = extension_schema {
+        let RefOr::Type(schema::Schema::Object(base)) = base else {
+            unreachable!("problem base schema must be an object")
+        };
+        let mut extension = extension.clone();
+        extension.properties.extend(base.properties);
+        extension.required.extend(base.required);
+        return RefOr::Type(schema::Schema::Object(extension));
+    }
+
+    schema::AllOf::new().item(base).item(extensions).into()
+}
+
 #[cfg(feature = "rfc9457")]
 impl ToSchema for NoExtensions {
     fn to_schema(_components: &mut Components) -> RefOr<schema::Schema> {
@@ -836,10 +867,9 @@ where
             let schema = if TypeId::of::<Extensions>() == TypeId::of::<NoExtensions>() {
                 problem_base_schema(components)
             } else {
-                schema::AllOf::new()
-                    .item(problem_base_schema(components))
-                    .item(Extensions::to_schema(components))
-                    .into()
+                let extensions = Extensions::to_schema(components);
+                let base = problem_base_schema(components);
+                problem_schema_with_extensions(components, base, extensions)
             };
             components.schemas.insert(name, schema);
         }
@@ -864,7 +894,7 @@ where
                 .first()
                 .cloned()
                 .unwrap_or_else(|| Extensions::compose(components, vec![]));
-            schema::AllOf::new().item(base).item(extensions).into()
+            problem_schema_with_extensions(components, base, extensions)
         }
     }
 }
@@ -1314,7 +1344,8 @@ mod tests {
     #[cfg(feature = "rfc9457")]
     #[test]
     fn test_problem_schema_composes_typed_extensions() {
-        #[derive(ToSchema)]
+        #[derive(serde::Serialize, ToSchema)]
+        #[serde(deny_unknown_fields)]
         #[allow(dead_code)]
         struct ValidationExtensions {
             errors: Vec<String>,
@@ -1336,21 +1367,15 @@ mod tests {
             .expect("typed problem component should exist");
         let schema = serde_json::to_value(schema).expect("schema should serialize");
 
-        assert_eq!(schema["allOf"].as_array().map(Vec::len), Some(2));
-        let extension_ref = schema["allOf"][1]["$ref"]
-            .as_str()
-            .expect("extension schema should use a component reference");
-        let extension_name = extension_ref
-            .rsplit('/')
-            .next()
-            .expect("extension reference should have a name");
-        let extension_schema = components
-            .schemas
-            .get(extension_name)
-            .expect("extension component should exist");
-        let extension_schema =
-            serde_json::to_value(extension_schema).expect("extension schema should serialize");
-        assert_eq!(extension_schema["properties"]["errors"]["type"], "array");
+        assert!(schema.get("allOf").is_none());
+        assert_eq!(schema["type"], "object");
+        assert_eq!(schema["additionalProperties"], false);
+        assert_eq!(schema["properties"]["errors"]["type"], "array");
+        assert_eq!(schema["properties"]["status"]["type"], "integer");
+        assert_eq!(
+            schema["required"],
+            json!(["errors", "type", "title", "status"])
+        );
     }
 
     #[test]
```

---

### Incident Patch 12: `2552db30` (2026-08-06)
**Commit Message**: docs: fix doubled words in oapi endpoint and operation docs (#1689)

**File**: `crates/oapi/docs/endpoint.md` (modified, +4/-4)
```diff
@@ -177,19 +177,19 @@ _**Example request body definitions.**_
 
 * `operation_ref = ...` Define a relative or absolute URI reference to an OAS operation. This field is
   mutually exclusive of the _`operation_id`_ field, and **must** point to an [Operation Object][operation].
-  Value can be be [`str`] or an expression such as [`include_str!`][include_str] or static
+  Value can be [`str`] or an expression such as [`include_str!`][include_str] or static
   [`const`][const] reference.
 
 * `operation_id = ...` Define the name of an existing, resolvable OAS operation, as defined with a unique
   _`operation_id`_. This field is mutually exclusive of the _`operation_ref`_ field.
-  Value can be be [`str`] or an expression such as [`include_str!`][include_str] or static
+  Value can be [`str`] or an expression such as [`include_str!`][include_str] or static
   [`const`][const] reference.
 
 * `parameters(...)` A map representing parameters to pass to an operation as specified with _`operation_id`_
   or identified by _`operation_ref`_. The key is parameter name to be used and value can
   be any value supported by JSON or an [expression][expression] e.g. `$path.id`
     * `name = ...` Define name for the parameter.
-      Value can be be [`str`] or an expression such as [`include_str!`][include_str] or static
+      Value can be [`str`] or an expression such as [`include_str!`][include_str] or static
       [`const`][const] reference.
     * `value` = Any value that can be supported by JSON or an [expression][expression].
 
@@ -204,7 +204,7 @@ _**Example request body definitions.**_
 * `request_body = ...` Define a literal value or an [expression][expression] to be used as request body when
   operation is called
 
-* `description = ...` Define description of the link. Value supports Markdown syntax.Value can be be [`str`] or
+* `description = ...` Define description of the link. Value supports Markdown syntax.Value can be [`str`] or
   an expression such as [`include_str!`][include_str] or static [`const`][const] reference.
 
 * `server(...)` Define [Server][server] object to be used by the target operation.
```

**File**: `crates/oapi/src/openapi/operation.rs` (modified, +1/-1)
```diff
@@ -159,7 +159,7 @@ pub struct Operation {
     #[serde(skip_serializing_if = "Option::is_none")]
     pub deprecated: Option<Deprecated>,
 
-    /// Declaration which security mechanisms can be used for for the operation. Only one
+    /// Declaration which security mechanisms can be used for the operation. Only one
     /// [`SecurityRequirement`] must be met.
     ///
     /// Security for the [`Operation`] can be set to optional by adding empty security with
```

---

### Incident Patch 13: `48c9ca24` (2026-07-29)
**Commit Message**: chore(oapi): update Swagger UI to v5.32.11 (#1681)

**File**: `crates/oapi/src/swagger_ui.rs` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ use serde::Serialize;
 use crate::html::{description_meta, escape_html, keywords_meta, script_safe_json};
 
 #[derive(RustEmbed)]
-#[folder = "src/swagger_ui/v5.32.8"]
+#[folder = "src/swagger_ui/v5.32.11"]
 struct SwaggerUiDist;
 
 const INDEX_TMPL: &str = r#"
```

---

### Incident Patch 14: `3577a1df` (2026-07-29)
**Commit Message**: build(deps): update syn requirement from 2 to 3 (#1676)

* build(deps): update syn requirement from 2 to 3

Updates the requirements on [syn](https://github.com/dtolnay/syn) to permit the latest version.
- [Release notes](https://github.com/dtolnay/syn/releases)
- [Commits](https://github.com/dtolnay/syn/compare/2.0.0...3.0.2)

---
updated-dependencies:
- dependency-name: syn
  dependency-version: 3.0.2
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* fix macros for syn 3

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Chrislearn Young <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +1/-2)
```diff
@@ -104,7 +104,6 @@ path-slash = "0.2"
 percent-encoding = "2"
 pin-project = "1"
 proc-macro-crate = { version = ">= 2, <= 4" }
-proc-macro2-diagnostics = { version = "0.10", default-features = true }
 proc-macro2 = "1"
 quinn = { version = "0.11", default-features = false }
 quote = "1"
@@ -128,7 +127,7 @@ sha2 = "0.11"
 smallvec = "1"
 socket2 = "0.6"
 subtle = "2"
-syn = "2"
+syn = "3"
 sync_wrapper = "1"
 tempfile = ">= 3.20"
 thiserror = "2"
```

**File**: `crates/craft-macros/src/craft.rs` (modified, +11/-6)
```diff
@@ -98,12 +98,13 @@ impl FnReceiver {
         let Some(recv) = method.sig.receiver() else {
             return Ok(Self::None);
         };
-        let ty = recv.ty.to_token_stream().to_string().replace(" ", "");
-        match ty.as_str() {
-            "&Self" => Ok(Self::Ref),
-            "Arc<Self>" | "&Arc<Self>" => Ok(Self::Arc),
-            _ => {
-                if ty.ends_with("::Arc<Self>") {
+        match &recv.kind {
+            syn::ReceiverKind::Reference(_, _, None) if recv.mutability.is_none() => Ok(Self::Ref),
+            syn::ReceiverKind::Typed(_, ty) => {
+                let ty = ty.to_token_stream().to_string().replace(' ', "");
+                if ty == "&Self" {
+                    Ok(Self::Ref)
+                } else if ty == "Arc<Self>" || ty == "&Arc<Self>" || ty.ends_with("::Arc<Self>") {
                     Ok(Self::Arc)
                 } else {
                     Err(syn::Error::new_spanned(
@@ -112,6 +113,10 @@ impl FnReceiver {
                     ))
                 }
             }
+            _ => Err(syn::Error::new_spanned(
+                method,
+                "#[craft] method receiver must be '&self', 'Arc<Self>' or '&Arc<Self>'",
+            )),
         }
     }
 }
```

**File**: `crates/oapi-macros/Cargo.toml` (modified, +0/-1)
```diff
@@ -38,7 +38,6 @@ compact_str = []
 proc-macro2 = { workspace = true }
 quote = { workspace = true }
 proc-macro-crate = { workspace = true }
-proc-macro2-diagnostics = { workspace = true }
 salvo-serde-util = { workspace = true }
 syn = { workspace = true, features = ["full", "extra-traits", "visit-mut"] }
 salvo_core = { workspace = true }
```

**File**: `crates/oapi-macros/src/bound.rs` (modified, +4/-3)
```diff
@@ -13,7 +13,6 @@ pub(crate) fn without_defaults(generics: &syn::Generics) -> syn::Generics {
             .iter()
             .map(|param| match param {
                 syn::GenericParam::Type(param) => syn::GenericParam::Type(syn::TypeParam {
-                    eq_token: None,
                     default: None,
                     ..param.clone()
                 }),
@@ -109,7 +108,7 @@ pub(crate) fn with_bound(
         fn visit_type(&mut self, ty: &'ast syn::Type) {
             match ty {
                 syn::Type::Array(ty) => self.visit_type(&ty.elem),
-                syn::Type::BareFn(ty) => {
+                syn::Type::FnPtr(ty) => {
                     for arg in &ty.inputs {
                         self.visit_type(&arg.ty);
                     }
@@ -169,7 +168,7 @@ pub(crate) fn with_bound(
                 }
                 syn::PathArguments::Parenthesized(arguments) => {
                     for argument in &arguments.inputs {
-                        self.visit_type(argument);
+                        self.visit_type(&argument.ty);
                     }
                     self.visit_return_type(&arguments.output);
                 }
@@ -233,12 +232,14 @@ pub(crate) fn with_bound(
         .map(|param| param.ident.clone())
         .filter(|id| relevant_type_params.contains(id))
         .map(|id| syn::TypePath {
+            attrs: Vec::new(),
             qself: None,
             path: id.into(),
         })
         .chain(associated_type_usage.into_iter().cloned())
         .map(|bounded_ty| {
             syn::WherePredicate::Type(syn::PredicateType {
+                attrs: Vec::new(),
                 lifetimes: None,
                 bounded_ty: syn::Type::Path(bounded_ty),
                 colon_token: <Token![:]>::default(),
```

**File**: `crates/oapi-macros/src/diagnostic.rs` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+use proc_macro2::{Span, TokenStream};
+use quote::{quote, quote_spanned};
+
+/// Diagnostic levels used by the macro implementation.
+///
+/// All diagnostics currently produced by this crate are errors. Help and note
+/// messages are attached through [`Diagnostic::help`] and [`Diagnostic::note`].
+#[derive(Clone, Copy, Debug)]
+pub(crate) enum Level {
+    Error,
+}
+
+#[derive(Debug)]
+pub(crate) struct Diagnostic {
+    inner: Inner,
+}
+
+#[derive(Debug)]
+enum Inner {
+    Syn(syn::Error),
+    Message {
+        span: Span,
+        message: String,
+        children: Vec<Child>,
+    },
+}
+
+#[derive(Debug)]
+struct Child {
+    level: &'static str,
+    message: String,
+}
+
+impl Diagnostic {
+    pub(crate) fn new(message_level: Level, message: impl Into<String>) -> Self {
+        Self::spanned(Span::call_site(), message_level, message)
+    }
+
+    pub(crate) fn spanned(span: Span, _level: Level, message: impl Into<String>) -> Self {
+        Self {
+            inner: Inner::Message {
+                span,
+                message: message.into(),
+                children: Vec::new(),
+            },
+        }
+    }
+
+    pub(crate) fn help(self, message: impl Into<String>) -> Self {
+        self.child("help", message)
+    }
+
+    pub(crate) fn note(self, message: impl Into<String>) -> Self {
+        self.child("note", message)
+    }
+
+    fn child(mut self, level: &'static str, message: impl Into<String>) -> Self {
+        let message = message.into();
+        match &mut self.inner {
+            Inner::Message { children, .. } => children.push(Child { level, message }),
+            Inner::Syn(error) => {
+                error.combine(syn::Error::new(error.span(), format!("{level}: {message}")));
+            }
+        }
+        self
+    }
+
+    pub(crate) fn emit_as_item_tokens(self) -> TokenStream {
+        let error: syn::Error = self.into();
+        error.to_compile_error()
+    }
+
+    pub(crate) fn emit_as_expr_tokens(self) -> TokenStream {
+        let error: syn::Error = self.into();
+        let compile_errors = error.into_iter().map(|error| {
+            let span = error.span();
+            let compile_error = error.to_compile_error();
+            quote_spanned!(span => #compile_error;)
+        });
+        quote!({ #(#compile_errors)* })
+    }
+}
+
+impl From<syn::Error> for Diagnostic {
+    fn from(error: syn::Error) -> Self {
+        Self {
+            inner: Inner::Syn(error),
+        }
+    }
+}
+
+impl From<Diagnostic> for syn::Error {
+    fn from(diagnostic: Diagnostic) -> Self {
+        match diagnostic.inner {
+            Inner::Syn(error) => error,
+            Inner::Message {
+                span,
+                mut message,
+                children,
+            } => {
+                for child in children {
+                    message.push('\n');
+                    message.push_str(child.level);
+                    message.push_str(": ");
+                    message.push_str(&child.message);
+                }
+                syn::Error::new(span, message)
+            }
+        }
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::{Diagnostic, Level};
+
+    #[test]
+    fn preserves_help_and_note_messages() {
+        let diagnostic = Diagnostic::new(Level::Error, "invalid attribute")
+            .help("remove the attribute")
+            .note("only supported on structs");
+        let error: syn::Error = diagnostic.into();
+
+        assert_eq!(
+            error.to_string(),
+            "invalid attribute\nhelp: remove the attribute\nnote: only supported on structs"
+        );
+    }
+
+    #[test]
+    fn preserves_syn_errors() {
+        let diagnostic = Diagnostic::from(syn::Error::new(
+            proc_macro2::Span::call_site(),
+            "parse failed",
+        ));
+        let error: syn::Error = diagnostic.into();
+
+        assert_eq!(error.to_string(), "parse failed");
+    }
+}
```

**File**: `crates/oapi-macros/src/lib.rs` (modified, +2/-1)
```diff
@@ -21,6 +21,7 @@ use syn::{Ident, Item, Token, bracketed, parse_macro_input};
 mod attribute;
 pub(crate) mod bound;
 mod component;
+mod diagnostic;
 mod doc_comment;
 mod endpoint;
 pub(crate) mod feature;
@@ -35,10 +36,10 @@ mod server;
 mod shared;
 mod type_tree;
 
-pub(crate) use proc_macro2_diagnostics::{Diagnostic, Level as DiagLevel};
 pub(crate) use salvo_serde_util::{self as serde_util, RenameRule, SerdeContainer, SerdeValue};
 
 pub(crate) use self::component::{ComponentSchema, ComponentSchemaProps};
+pub(crate) use self::diagnostic::{Diagnostic, Level as DiagLevel};
 pub(crate) use self::endpoint::EndpointAttr;
 pub(crate) use self::feature::Feature;
 pub(crate) use self::operation::Operation;
```

**File**: `crates/oapi-macros/src/parameter/derive.rs` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ impl TryToTokens for ToParameters {
         let (impl_generics, ty_generics, where_clause) = self.generics.split_for_impl();
 
         let ex_life = &Lifetime::new("'__macro_gen_ex", Span::call_site());
-        let ex_lifetime: GenericParam = LifetimeParam::new(ex_life.clone()).into();
+        let ex_lifetime = GenericParam::Lifetime(LifetimeParam::new(ex_life.clone()));
         let mut ex_generics = self.generics.clone();
         ex_generics.params.insert(0, ex_lifetime);
         let ex_impl_generics = ex_generics.split_for_impl().0;
```

**File**: `crates/oapi-macros/src/response/derive.rs` (modified, +5/-1)
```diff
@@ -203,7 +203,11 @@ impl TryToTokens for ToResponses<'_> {
 trait Response {
     fn to_type(ident: &Ident) -> Type {
         let path = Path::from(ident.clone());
-        let type_path = TypePath { path, qself: None };
+        let type_path = TypePath {
+            attrs: Vec::new(),
+            path,
+            qself: None,
+        };
         Type::Path(type_path)
     }
 
```

---

### Incident Patch 15: `8051ab51` (2026-07-29)
**Commit Message**: build(deps): update serial_test requirement from 3 to 4 (#1680)

Updates the requirements on [serial_test](https://github.com/palfrey/serial_test) to permit the latest version.
- [Release notes](https://github.com/palfrey/serial_test/releases)
- [Commits](https://github.com/palfrey/serial_test/compare/v3.0.0...v4.0.1)

---
updated-dependencies:
- dependency-name: serial_test
  dependency-version: 4.0.1
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `crates/oapi/Cargo.toml` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ all-features = true
 rustdoc-args = ["--cfg", "docsrs"]
 
 [dev-dependencies]
-serial_test = "3"
+serial_test = "4"
 assert-json-diff = { workspace = true }
 salvo_core = { workspace = true, default-features = false, features = [
     "cookie",
```

#### Recent Merged Pull Requests:
- **PR #1713** (2026-10-04): Allow HTTP/1-only builds without h2 (@chrislearn)
- **PR #1711** (2026-10-04): fix(quinn): finish QUIC handshakes on the connection task (@reinerp)
- **PR #1710** (2026-09-24): fix(examples): align OpenTelemetry examples with 0.33 (@chrislearn)
- **PR #1709** (2026-09-24): build(deps): upgrade OpenTelemetry crates to 0.33 together (@chrislearn)
- **PR #1708** (2026-09-24): Fix StaticDir access to files beneath dot directories (@chrislearn)
- **PR #1707** (closed): build(deps): update opentelemetry requirement from 0.32 to 0.33 (@dependabot[bot])
- **PR #1706** (closed): build(deps): update opentelemetry_sdk requirement from 0.32 to 0.33 (@dependabot[bot])
- **PR #1705** (closed): build(deps): update opentelemetry-semantic-conventions requirement from 0.32 to 0.33 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
