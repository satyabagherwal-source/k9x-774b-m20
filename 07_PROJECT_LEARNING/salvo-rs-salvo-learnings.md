> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/salvo-rs-salvo-learnings.md`  
> **Source**: github ([https://github.com/salvo-rs/salvo](https://github.com/salvo-rs/salvo))  
> **Source Version**: `62a4f53b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T11:05:30.386Z  
> **Learning ID**: `learn-github-salvo-rs-salvo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): salvo-rs/salvo

> **Canonical Artifact**: `07_PROJECT_LEARNING/salvo-rs-salvo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/salvo-rs/salvo](https://github.com/salvo-rs/salvo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-23T11:05:28.675Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `salvo-rs/salvo`
- **Description**: A powerful web framework built with a simplified design.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4452 stars

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
    negative_routes(c);
}

fn negative_routes(c: &mut Criterion) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .build()
        .expect("build runtime");
    let mut group = c.benchmark_group("dispatch/negative_routes");
    group.sample_size(10);
    for count in [100, 1_000, 10_000] {
        for multi in [false, true] {
            let mut router = Router::new();
            for i in 0..count {
                let mut route = Router::with_path(format!("route-{i}")).get(hello);
                if multi {
                    route = route.post(hello).put(hello);
                }
                router = router.push(route);
            }
            let service = Service::new(router);
            for (position, path, status) in [
                (
                    "first",
                    "route-0".to_owned(),
                    StatusCode::METHOD_NOT_ALLOWED,
                ),
                (
                    "last",
                    format!("route-{}", count - 1),
                    StatusCode::METHOD_NOT_ALLOWED,
                ),
                ("missing", "missing".to_owned(), StatusCode::NOT_FOUND),
            ] {
                let url = format!("http://t.dev/{path}");
                group.bench_function(format!("{count}/{multi}/{position}"), |b| {
                    b.iter(|| {
                        let res = rt.block_on(TestClient::delete(&url).send(&service));
                        assert_eq!(res.status_code, Some(status));
                        black_box(res);
                    })
                });
            }
        }
    }
    group.finish();
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24** (2021-05-02): **master/examples/routing.rs  Compilation fails**
  *Symptoms*: - https://github.com/salvo-rs/salvo/blob/master/examples/routing.rs  **dependencies** ``` rustc 1.51.0 (2fd73fabe 2021-03-23) Deepin GNU/Linux 20.2  [dependencies] salvo = { version = "0.11", features = ["full"] } tokio = { version = "1", features = ["full"] } ```  **code** ``` use salvo::prelude::*;  #[tokio::main] async fn main() {     let debug_mode = true;     let admin_mode = true;     let router = Router::new()         .get(index)         .push(             Router::new()                 .path("users")                 .before(auth)                 .post(create_user)                 .push(Router::new().path(r"<id:num>").post(update_user).delete(delete_user)),         )         .push(             Router::new()                 .path("users")                 .get(list_users)                 .push(Router::new().path(r"<id:num>").get(show_user)),         )         .then(|router| {             if debug_mode {                 router.push(Router::new().path("debug").get(debug))             } else {                 router             }         })         .then(|router| {             if admin_mode {                 router.push(Router::new().path("admin").get(admin))             } else {                 router             }         })         ;      Server::new(router).bind(([0, 0, 0, 0], 7878)).await; }  #[fn_handler] async fn admin(res: &mut Response) {     res.render_plain_text("Admin page"); } #[fn_handler] async fn debu

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

### Incident Patch 1: `82278068` (2026-10-23)
**Commit Message**: Fix middleware boundaries and multipart upload handling (#1722)

* Respect cookie changes and partial responses in shared caches

* Preserve named optional extraction and reject missing required values

* Honor conditional response precedence and method semantics

* Preserve compression trailers and offload flushing

* Clean up rejected tus creations and report final storage metadata

* Merge multipart file and form schemas

* Document middleware and upload boundary fixes

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -8,6 +8,18 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 
 ### Fixed
 
+- Exclude pending cookie jar changes and partial responses from response caching,
+  and bypass cached representations for range requests.
+- Forward parameter names through optional extractors and reject missing required
+  header, query and cookie values before constructing their wrappers.
+- Honor ETag precedence, lists and wildcards in conditional responses, while
+  preserving write responses and non-200 statuses.
+- Preserve response trailers during compression and offload compression flushing
+  and finalization together with expensive writes.
+- Validate tus creation requests before allocating storage, remove uploads after
+  creation-time stream failures, and pass final storage metadata to completion hooks.
+- Merge multipart form and file schemas instead of overwriting earlier endpoint
+  parameters, preserving required fields and form constraints.
 - Generate `Allow` for automatic 405 responses from complete built-in route matches,
   without replaying custom callbacks or overriding middleware response policies.
   When opaque filters prevent safely inferring any supported method, routing defaults
```

**File**: `crates/cache/Cargo.toml` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ tokio = { workspace = true, features = ["sync"] }
 tracing = { workspace = true }
 
 [dev-dependencies]
-salvo_core = { workspace = true, features = ["test"] }
+salvo_core = { workspace = true, features = ["test", "cookie"] }
 tokio = { workspace = true, features = ["macros", "rt-multi-thread", "time"] }
 time = { workspace = true }
 
```

**File**: `crates/cache/src/lib.rs` (modified, +126/-7)
```diff
@@ -97,7 +97,9 @@ use std::sync::{Arc, Mutex, MutexGuard};
 
 use bytes::Bytes;
 use salvo_core::handler::Skipper;
-use salvo_core::http::header::{AUTHORIZATION, CACHE_CONTROL, COOKIE, SET_COOKIE, VARY};
+use salvo_core::http::header::{
+    AUTHORIZATION, CACHE_CONTROL, CONTENT_RANGE, COOKIE, RANGE, SET_COOKIE, VARY,
+};
 use salvo_core::http::{HeaderMap, ResBody, StatusCode};
 use salvo_core::{Depot, Error, FlowCtrl, Handler, Request, Response, async_trait, cfg_feature};
 use tokio::sync::Notify;
@@ -557,10 +559,11 @@ where
 
     /// Allow caching requests or responses that contain private-user cache signals.
     ///
-    /// By default, requests with `Authorization` or `Cookie`, and responses with `Set-Cookie`,
-    /// `Vary`, or `Cache-Control: private`, are not cached. Enabling this lifts those
-    /// privacy restrictions. `Cache-Control: no-store`/`no-cache` responses are never
-    /// cached regardless of this setting.
+    /// By default, requests with `Authorization` or `Cookie`, and responses with a
+    /// `Set-Cookie` header or `Cache-Control: private`, are not cached. Enabling this
+    /// lifts those privacy restrictions. Responses with pending cookie jar changes,
+    /// `Vary`, or `Cache-Control: no-store`/`no-cache` are never cached. Range requests
+    /// and partial responses are also excluded regardless of this setting.
     #[inline]
     #[must_use]
     pub fn cache_private(mut self, cache_private: bool) -> Self {
@@ -611,7 +614,9 @@ fn cached_response(
     headers_before: &HeaderMap,
     cache_private: bool,
 ) -> Option<CachedEntry> {
-    if res.body.is_stream() || res.body.is_error() {
+    // Cookie jar changes are serialized into headers only after middleware returns.
+    // Entries cannot replay the jar, so skip these responses even in private mode.
+    if res.body.is_stream() || res.body.is_error() || res.has_cookie_changes() {
         return None;
     }
     // Only cache successful responses. Use the *effective* status: a missing
@@ -625,7 +630,8 @@ fn cached_response(
     } else {
         StatusCode::OK
     });
-    if !effective_status.is_success() {
+    // The cache stores complete representations and does not assemble byte ranges.
+    if !effective_status.is_success() || effective_status == StatusCode::PARTIAL_CONTENT {
         return None;
     }
     // `no-store`/`no-cache` forbid storing or reusing without revalidation in
@@ -698,6 +704,7 @@ fn response_disallows_caching(headers: &HeaderMap) -> bool {
     cache_control_contains(headers, "no-store")
         || cache_control_contains(headers, "no-cache")
         || headers.contains_key(VARY)
+        || headers.contains_key(CONTENT_RANGE)
 }
 
 fn cache_control_contains(headers: &HeaderMap, directive: &str) -> bool {
@@ -729,6 +736,8 @@ where
         ctrl: &mut FlowCtrl,
     ) {
         if self.skipper.skipped(req, depot)
+            // Range is not part of the default key, and hits do not apply ranges.
+            || req.headers().contains_key(RANGE)
             || (!self.cache_private && request_has_private_cache_headers(req))
         {
             ctrl.call_next(req, depot, res).await;
@@ -1362,6 +1371,116 @@ mod tests {
         }
     }
 
+    #[tokio::test]
+    async fn cookie_jar_changes_are_not_cached() {
+        #[derive(Debug)]
+        struct CookiePage {
+            calls: Arc<AtomicUsize>,
+            remove: bool,
+        }
+        #[async_trait]
+        impl Handler for CookiePage {
+            async fn handle(
+                &self,
+                _req: &mut Request,
+                _depot: &mut Depot,
+                res: &mut Response,
+                _ctrl: &mut FlowCtrl,
+            ) {
+                let call = self.calls.fetch_add(1, Ordering::SeqCst) + 1;
+                if self.remove {
+                    res.remove_cookie("session");
+                } else {
+                    res.add_cookie(salvo_core::http::cookie::Cookie::new(
+                        "session",
+                        format!("session-{call}"),
+                    ));
+                }
+                res.render(format!("session-specific body {call}"));
+            }
+        }
+
+        for cache_private in [false, true] {
+            for remove in [false, true] {
+                let calls = Arc::new(AtomicUsize::new(0));
+                let cache = Cache::new(MokaStore::new(100), RequestIssuer::default())
+                    .cache_private(cache_private);
+                let service = Service::new(Router::new().hoop(cache).goal(CookiePage {
+                    calls: calls.clone(),
+                    remove,
+                }));
+                for call in 1..=2 {
+                    let mut res = TestClient::get("http://example.test/").send(&service).await;
+                    assert!(res.headers().contains_key(SET_COOKIE));
+                    assert_eq!(
+                        res.take_string().await.unwrap(),
+                        format!(
```

**File**: `crates/compression/src/lib.rs` (modified, +51/-0)
```diff
@@ -570,6 +570,57 @@ mod tests {
 
     use super::*;
 
+    #[cfg(feature = "gzip")]
+    #[tokio::test]
+    async fn compression_preserves_trailers_after_final_data() {
+        use std::io::Read;
+        use std::pin::Pin;
+
+        use salvo_core::http::HeaderMap;
+        use salvo_core::http::body::{Body, BytesFrame, Frame};
+
+        #[handler]
+        async fn with_trailers(res: &mut Response) {
+            res.add_header("content-type", "text/plain", true).unwrap();
+            res.add_header("trailer", "x-checksum", true).unwrap();
+            let mut trailers = HeaderMap::new();
+            trailers.insert("x-checksum", "complete".parse().unwrap());
+            let frames = vec![
+                Ok::<_, std::io::Error>(BytesFrame::data(vec![b'a'; 32 * 1024])),
+                Ok(BytesFrame(Frame::trailers(trailers))),
+            ];
+            res.stream(futures_util::stream::iter(frames));
+        }
+
+        let router = Router::with_hoop(super::Compression::new().min_length(1)).get(with_trailers);
+        let mut response = TestClient::get("http://localhost/")
+            .add_header("accept-encoding", "gzip", true)
+            .send(router)
+            .await;
+        assert_eq!(response.headers()["content-encoding"], "gzip");
+        assert_eq!(response.headers()["trailer"], "x-checksum");
+        let mut body = response.take_body();
+        let mut compressed = Vec::new();
+        let mut trailers = None;
+        while let Some(frame) =
+            futures_util::future::poll_fn(|cx| Pin::new(&mut body).poll_frame(cx)).await
+        {
+            match frame.unwrap().into_data() {
+                Ok(data) => {
+                    assert!(trailers.is_none());
+                    compressed.extend_from_slice(&data);
+                }
+                Err(frame) => trailers = Some(frame.into_trailers().unwrap()),
+            }
+        }
+        assert_eq!(trailers.unwrap()["x-checksum"], "complete");
+        let mut decoded = Vec::new();
+        flate2::read::GzDecoder::new(&compressed[..])
+            .read_to_end(&mut decoded)
+            .unwrap();
+        assert_eq!(decoded, vec![b'a'; 32 * 1024]);
+    }
+
     #[handler]
     async fn hello() -> &'static str {
         "hello"
```

**File**: `crates/compression/src/stream.rs` (modified, +268/-74)
```diff
@@ -12,15 +12,19 @@ use tokio::task::{JoinHandle, spawn_blocking};
 
 use super::{CompressionAlgo, CompressionLevel, Encoder};
 
-// Keep 8 KiB JSON chunks and similarly sized buffered chunks on the async task
-// when compression is enabled.
+// Keep small chunks at the default/fastest level on the async task. Explicit
+// compression levels can be expensive even for small inputs.
 const MAX_CHUNK_SIZE_ENCODE_IN_PLACE: usize = 16 * 1024;
 
+type Encoded = (Option<Encoder>, Bytes);
+
 pub(super) struct EncodeStream<B> {
     encoder: Option<Encoder>,
     body: B,
     eof: bool,
-    encoding: Option<JoinHandle<IoResult<Encoder>>>,
+    offload: bool,
+    trailers: Option<BytesFrame>,
+    encoding: Option<JoinHandle<IoResult<Encoded>>>,
 }
 
 impl<B> EncodeStream<B> {
@@ -29,110 +33,140 @@ impl<B> EncodeStream<B> {
         Self {
             body,
             eof: false,
+            offload: matches!(
+                level,
+                CompressionLevel::Minsize | CompressionLevel::Precise(_)
+            ),
+            trailers: None,
             encoding: None,
             encoder: Some(Encoder::new(algo, level)),
         }
     }
+
+    fn write_chunk(&mut self, chunk: Bytes) -> IoResult<Option<Bytes>> {
+        let Some(mut encoder) = self.encoder.take() else {
+            return Err(IoError::other("compression encoder is unavailable"));
+        };
+        self.offload |= chunk.len() >= MAX_CHUNK_SIZE_ENCODE_IN_PLACE;
+        if self.offload {
+            self.encoding = Some(spawn_blocking(move || {
+                encoder.write(&chunk)?;
+                // Flushing may perform most of the compression work (especially
+                // for Brotli), so keep it in the blocking task with write().
+                let chunk = encoder.take()?;
+                Ok((Some(encoder), chunk))
+            }));
+            Ok(None)
+        } else {
+            encoder.write(&chunk)?;
+            let chunk = encoder.take()?;
+            self.encoder = Some(encoder);
+            Ok(Some(chunk))
+        }
+    }
+
+    fn finish_encoding(&mut self) -> IoResult<Option<Bytes>> {
+        let Some(encoder) = self.encoder.take() else {
+            return Err(IoError::other("compression encoder is unavailable"));
+        };
+        if self.offload {
+            self.encoding = Some(spawn_blocking(move || Ok((None, encoder.finish()?))));
+            Ok(None)
+        } else {
+            self.eof = true;
+            encoder.finish().map(Some)
+        }
+    }
+
+    fn fail(&mut self, error: IoError) -> Poll<Option<IoResult<BytesFrame>>> {
+        self.eof = true;
+        self.encoder = None;
+        self.encoding = None;
+        self.trailers = None;
+        Poll::Ready(Some(Err(error)))
+    }
 }
 impl EncodeStream<BoxStream<'static, Result<Bytes, BoxedError>>> {
     #[inline]
-    fn poll_chunk(&mut self, cx: &mut Context<'_>) -> Poll<Option<IoResult<Bytes>>> {
-        Stream::poll_next(Pin::new(&mut self.body), cx).map_err(IoError::other)
+    fn poll_chunk(&mut self, cx: &mut Context<'_>) -> Poll<Option<IoResult<BytesFrame>>> {
+        Stream::poll_next(Pin::new(&mut self.body), cx)
+            .map_ok(BytesFrame::data)
+            .map_err(IoError::other)
     }
 }
 impl EncodeStream<BoxStream<'static, Result<BytesFrame, BoxedError>>> {
-    fn poll_chunk(&mut self, cx: &mut Context<'_>) -> Poll<Option<IoResult<Bytes>>> {
-        Stream::poll_next(Pin::new(&mut self.body), cx)
-            .map_ok(|f| f.into_data().unwrap_or_default())
-            .map_err(IoError::other)
+    fn poll_chunk(&mut self, cx: &mut Context<'_>) -> Poll<Option<IoResult<BytesFrame>>> {
+        Stream::poll_next(Pin::new(&mut self.body), cx).map_err(IoError::other)
     }
 }
 impl EncodeStream<HyperBody> {
-    fn poll_chunk(&mut self, cx: &mut Context<'_>) -> Poll<Option<IoResult<Bytes>>> {
-        match ready!(Body::poll_frame(Pin::new(&mut self.body), cx)) {
-            Some(Ok(frame)) => Poll::Ready(frame.into_data().map(Ok).ok()),
-            Some(Err(e)) => Poll::Ready(Some(Err(IoError::other(e)))),
-            None => Poll::Ready(None),
-        }
+    fn poll_chunk(&mut self, cx: &mut Context<'_>) -> Poll<Option<IoResult<BytesFrame>>> {
+        Body::poll_frame(Pin::new(&mut self.body), cx)
+            .map_ok(BytesFrame)
+            .map_err(IoError::other)
     }
 }
 impl EncodeStream<Option<Bytes>> {
-    fn poll_chunk(&mut self, _cx: &mut Context<'_>) -> Poll<Option<IoResult<Bytes>>> {
-        if let Some(body) = Pin::new(&mut self.body).take() {
-            Poll::Ready(Some(Ok(body)))
-        } else {
-            Poll::Ready(None)
-        }
+    fn poll_chunk(&mut self, _cx: &mut Context<'_>) -> Poll<Option<IoResult<BytesFrame>>> {
+        Poll::Ready(self.body.take().map(|chunk| Ok(BytesFrame::data(chunk))))
     }
 }
 impl EncodeStream<VecDeque<Bytes>> {
-    fn poll_chunk(&mut self, _cx: &mut Context<'_>) -> Poll<Option<IoResult<Bytes>>> {
-        if let Some
```

**File**: `crates/core/src/extract.rs` (modified, +78/-1)
```diff
@@ -130,14 +130,91 @@ where
     async fn extract(req: &'ex mut Request, depot: &'ex mut Depot) -> Result<Self, ParseError> {
         Ok(T::extract(req, depot).await.ok())
     }
+    #[allow(refining_impl_trait)]
+    fn extract_with_arg(
+        req: &'ex mut Request,
+        depot: &'ex mut Depot,
+        arg: &str,
+    ) -> impl Future<Output = Result<Self, ParseError>> + Send {
+        futures_util::FutureExt::map(T::extract_with_arg(req, depot, arg), |result| {
+            Ok(result.ok())
+        })
+    }
 }
 
 #[cfg(test)]
 mod tests {
     use serde::Deserialize;
 
+    use crate::extract::{HeaderParam, PathParam, QueryParam};
     use crate::prelude::*;
-    use crate::test::TestClient;
+    use crate::test::{ResponseExt, TestClient};
+
+    #[handler]
+    async fn optional_parameters(
+        id: Option<PathParam<u32>>,
+        page: Option<QueryParam<u32>>,
+        limit: Option<HeaderParam<u32>>,
+    ) -> String {
+        format!(
+            "{:?}/{:?}/{:?}",
+            id.map(PathParam::into_inner),
+            page.map(QueryParam::<u32>::into_inner),
+            limit.map(HeaderParam::<u32>::into_inner),
+        )
+    }
+
+    #[tokio::test]
+    async fn optional_named_parameters_preserve_argument_names() {
+        let service = Service::new(Router::with_path("{id}").get(optional_parameters));
+        let mut response = TestClient::get("http://localhost/7?page=2")
+            .add_header("limit", "5", true)
+            .send(&service)
+            .await;
+        assert_eq!(response.status_code, Some(StatusCode::OK));
+        assert_eq!(
+            response.take_string().await.unwrap(),
+            "Some(7)/Some(2)/Some(5)"
+        );
+
+        let mut response = TestClient::get("http://localhost/7").send(&service).await;
+        assert_eq!(response.take_string().await.unwrap(), "Some(7)/None/None");
+
+        let mut response = TestClient::get("http://localhost/invalid?page=invalid")
+            .add_header("limit", "invalid", true)
+            .send(&service)
+            .await;
+        assert_eq!(response.take_string().await.unwrap(), "None/None/None");
+
+        let mut response = TestClient::get("http://localhost/")
+            .send(Router::new().get(optional_parameters))
+            .await;
+        assert_eq!(response.take_string().await.unwrap(), "None/None/None");
+    }
+
+    #[cfg(feature = "cookie")]
+    #[tokio::test]
+    async fn optional_cookie_parameter_preserves_argument_name() {
+        use crate::extract::CookieParam;
+
+        #[handler]
+        async fn optional_cookie(count: Option<CookieParam<u32>>) -> String {
+            format!("{:?}", count.map(CookieParam::<u32>::into_inner))
+        }
+
+        let service = Service::new(Router::new().get(optional_cookie));
+        for (cookie, expected) in [
+            ("count=3", "Some(3)"),
+            ("count=invalid", "None"),
+            ("other=3", "None"),
+        ] {
+            let mut response = TestClient::get("http://localhost/")
+                .add_header("cookie", cookie, true)
+                .send(&service)
+                .await;
+            assert_eq!(response.take_string().await.unwrap(), expected);
+        }
+    }
 
     #[tokio::test]
     async fn test_generic_struct() {
```

**File**: `crates/core/src/extract/parameter/cookie.rs` (modified, +4/-5)
```diff
@@ -133,13 +133,13 @@ where
         let value = req
             .cookies()
             .get(arg)
-            .and_then(|v| parse_cookie_value(v.value()))
+            .and_then(|v| parse_cookie_value::<T>(v.value()))
             .ok_or_else(|| {
                 ParseError::other(format!(
                     "cookie parameter {arg} not found or convert to type failed"
                 ))
             })?;
-        Ok(Self(value))
+        Ok(Self(Some(value)))
     }
 }
 
@@ -325,15 +325,14 @@ mod tests {
     }
 
     #[tokio::test]
-    #[should_panic]
-    async fn test_required_cookie_param_extract_with_value_panic() {
+    async fn test_required_cookie_param_extract_missing_value_returns_error() {
         let req = TestClient::get("http://127.0.0.1:5801").build_hyper();
         let schema = req.uri().scheme().cloned().unwrap();
         let mut req = Request::from_hyper(req, schema);
         let mut depot = Depot::new();
         let result =
             CookieParam::<String, true>::extract_with_arg(&mut req, &mut depot, "param").await;
-        assert_eq!(result.unwrap().0.unwrap(), "param");
+        assert!(result.is_err());
     }
 
     #[test]
```

**File**: `crates/core/src/extract/parameter/header.rs` (modified, +4/-5)
```diff
@@ -111,12 +111,12 @@ where
         _depot: &'ex mut Depot,
         arg: &str,
     ) -> Result<Self, ParseError> {
-        let value = req.header(arg).ok_or_else(|| {
+        let value = req.header::<T>(arg).ok_or_else(|| {
             ParseError::other(format!(
                 "header parameter {arg} not found or convert to type failed"
             ))
         })?;
-        Ok(Self(value))
+        Ok(Self(Some(value)))
     }
 }
 
@@ -231,15 +231,14 @@ mod tests {
     }
 
     #[tokio::test]
-    #[should_panic]
-    async fn test_required_header_param_extract_with_value_panic() {
+    async fn test_required_header_param_extract_missing_value_returns_error() {
         let req = TestClient::get("http://127.0.0.1:5801").build_hyper();
         let schema = req.uri().scheme().cloned().unwrap();
         let mut req = Request::from_hyper(req, schema);
         let mut depot = Depot::new();
         let result =
             HeaderParam::<String, true>::extract_with_arg(&mut req, &mut depot, "param").await;
-        assert_eq!(result.unwrap().0.unwrap(), "param");
+        assert!(result.is_err());
     }
 
     #[test]
```

---

### Incident Patch 2: `fa8321a2` (2026-10-23)
**Commit Message**: Fix upload file lifetimes, range compression and OpenAPI inheritance (#1723)

* Share multipart file ownership and clean up interrupted writes

* Roll back failed tus writes and trim stale retry data

* Preserve partial response bytes during compression

* Inherit and intersect OpenAPI route method constraints

* Document upload lifecycle and response boundary fixes

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -8,6 +8,12 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 
 ### Fixed
 
+- Clean up interrupted multipart uploads and keep temporary files alive until
+  the last `FilePart` clone is released.
+- Roll back failed tus writes and discard uncommitted file tails before retrying.
+- Preserve byte ranges by skipping dynamic compression for partial responses.
+- Inherit ancestor HTTP method constraints when generating OpenAPI operations,
+  excluding routes whose method constraints conflict.
 - Exclude pending cookie jar changes and partial responses from response caching,
   and bypass cached representations for range requests.
 - Forward parameter names through optional extractors and reject missing required
```

**File**: `crates/compression/src/lib.rs` (modified, +160/-2)
```diff
@@ -5,6 +5,8 @@
 //!
 //! This middleware automatically compresses HTTP responses using various algorithms,
 //! reducing bandwidth usage and improving load times for clients.
+//! Responses with status `206 Partial Content` or a `Content-Range` header are
+//! preserved because their byte offsets refer to the original representation.
 //!
 //! # Supported Algorithms
 //!
@@ -72,7 +74,7 @@ use std::sync::LazyLock;
 use indexmap::IndexMap;
 use salvo_core::http::body::ResBody;
 use salvo_core::http::header::{
-    ACCEPT_ENCODING, CONTENT_ENCODING, CONTENT_LENGTH, CONTENT_TYPE, HeaderValue,
+    ACCEPT_ENCODING, CONTENT_ENCODING, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE, HeaderValue,
 };
 use salvo_core::http::headers::{ContentLength, HeaderMapExt};
 use salvo_core::http::{self, Method, Mime, StatusCode, append_vary_header, mime};
@@ -468,7 +470,14 @@ impl Handler for Compression {
         ctrl: &mut FlowCtrl,
     ) {
         ctrl.call_next(req, depot, res).await;
-        if ctrl.is_ceased() || res.headers().contains_key(CONTENT_ENCODING) {
+        // A range describes bytes of the selected representation. Re-encoding its
+        // body would invalidate those offsets, including representation headers
+        // synthesized for HEAD. Leave the body and headers together untouched.
+        if ctrl.is_ceased()
+            || res.headers().contains_key(CONTENT_ENCODING)
+            || res.headers().contains_key(CONTENT_RANGE)
+            || res.status_code == Some(StatusCode::PARTIAL_CONTENT)
+        {
             return;
         }
 
@@ -570,6 +579,155 @@ mod tests {
 
     use super::*;
 
+    #[cfg(feature = "gzip")]
+    #[tokio::test]
+    async fn named_file_ranges_preserve_representation_bytes() {
+        use salvo_core::fs::NamedFile;
+
+        #[handler]
+        async fn serve_file(req: &mut Request, res: &mut Response) {
+            let file = NamedFile::builder(concat!(env!("CARGO_MANIFEST_DIR"), "/Cargo.toml"))
+                .content_type(mime::TEXT_PLAIN)
+                .preload_threshold(req.query::<u64>("preload").unwrap())
+                .build()
+                .await
+                .unwrap();
+            if req.method() == Method::HEAD {
+                file.send_head(req.headers(), res).await;
+            } else {
+                file.send(req.headers(), res).await;
+            }
+        }
+
+        let service =
+            Service::new(Router::with_hoop(Compression::new().min_length(1)).goal(serve_file));
+        let original = include_bytes!("../Cargo.toml");
+        // Cover the preloaded and streaming NamedFile paths.
+        for preload in [0, u64::MAX] {
+            let url = format!("http://localhost/?preload={preload}");
+            for head in [false, true] {
+                let request = if head {
+                    TestClient::head(&url)
+                } else {
+                    TestClient::get(&url)
+                };
+                let mut response = request
+                    .add_header(ACCEPT_ENCODING, "gzip", true)
+                    .add_header("range", "bytes=16-79", true)
+                    .send(&service)
+                    .await;
+                assert_eq!(response.status_code, Some(StatusCode::PARTIAL_CONTENT));
+                assert_eq!(
+                    response.headers()[CONTENT_RANGE],
+                    format!("bytes 16-79/{}", original.len())
+                );
+                assert_eq!(response.headers()[CONTENT_LENGTH], "64");
+                assert!(!response.headers().contains_key(CONTENT_ENCODING));
+                let bytes = response.take_bytes(None).await.unwrap();
+                assert_eq!(&bytes[..], if head { &[][..] } else { &original[16..80] });
+            }
+
+            let mut full = TestClient::get(&url)
+                .add_header(ACCEPT_ENCODING, "gzip", true)
+                .send(&service)
+                .await;
+            assert_eq!(full.status_code, Some(StatusCode::OK));
+            assert_eq!(full.headers()[CONTENT_ENCODING], "gzip");
+            assert_eq!(full.take_string().await.unwrap().as_bytes(), original);
+        }
+    }
+
+    #[cfg(feature = "gzip")]
+    #[tokio::test]
+    async fn partial_status_or_content_range_prevents_compression() {
+        #[handler]
+        async fn partial_response(req: &mut Request, res: &mut Response) {
+            res.status_code(if req.query::<bool>("partial").unwrap() {
+                StatusCode::PARTIAL_CONTENT
+            } else {
+                StatusCode::OK
+            });
+            if req.query::<bool>("range").unwrap() {
+                res.add_header("content-range", "bytes 0-4/10", true)
+                    .unwrap();
+            }
+            res.add_header(CONTENT_TYPE, "text/plain", true).unwrap();
+            res.add_header(CONTENT_LENGTH, "5", true).unwrap();
+            res.add_header(VARY, "origin", true).unwrap();
+            if req.method() != Method::HEAD {
+           
```

**File**: `crates/core/src/http/form.rs` (modified, +223/-45)
```diff
@@ -1,6 +1,9 @@
 //! Form parse module.
 use std::ffi::OsStr;
+use std::io::Write;
 use std::path::{Path, PathBuf};
+use std::sync::Arc;
+use std::sync::atomic::{AtomicBool, Ordering};
 
 use base64::engine::Engine;
 use base64::engine::general_purpose::URL_SAFE_NO_PAD;
@@ -12,8 +15,6 @@ use multra::{Field, Multipart};
 use rand::TryRng;
 use rand::rngs::SysRng;
 use tempfile::Builder;
-use tokio::fs::File;
-use tokio::io::AsyncWriteExt;
 
 use crate::http::ParseError;
 use crate::http::header::{CONTENT_TYPE, HeaderMap};
@@ -125,8 +126,22 @@ pub struct FilePart {
     /// Optionally, the size of the file.  This is filled when multiparts are parsed, but is
     /// not necessary when they are generated.
     size: u64,
-    // The temporary directory the upload was put into, saved for the Drop trait
-    temp_dir: Option<PathBuf>,
+    // Cleanup belongs to the upload, rather than any particular FilePart clone.
+    storage: Arc<TemporaryUpload>,
+}
+
+#[derive(Debug)]
+struct TemporaryUpload {
+    path: PathBuf,
+    temp_dir: PathBuf,
+    delete_on_drop: AtomicBool,
+}
+
+// Field order closes the file before releasing the cleanup guard. Keeping both
+// in the blocking task also covers cancellation while a disk operation runs.
+struct UploadWriter {
+    file: std::fs::File,
+    storage: Arc<TemporaryUpload>,
 }
 impl FilePart {
     /// Get file name.
@@ -172,9 +187,12 @@ impl FilePart {
     }
     /// If you do not want the file on disk to be deleted when Self drops, call this
     /// function.  It will become your responsibility to clean up.
+    ///
+    /// This applies to all clones of this file part. Otherwise the file is removed
+    /// after the last clone is dropped.
     #[inline]
     pub fn do_not_delete_on_drop(&mut self) {
-        self.temp_dir = None;
+        self.storage.delete_on_drop.store(false, Ordering::Relaxed);
     }
 
     /// Create a new temporary FilePart (when created this way, the file will be
@@ -199,15 +217,16 @@ impl FilePart {
     /// fill the temporary directory's disk (denial of service), so make sure the
     /// request body is bounded before the first read.
     pub async fn create(field: &mut Field<'_>) -> Result<Self, ParseError> {
-        // Setup a file to capture the contents.
-        // Map the `JoinError` to a `ParseError` instead of panicking, so a
-        // runtime issue (e.g. shutdown) on this request path doesn't abort.
-        let mut path =
-            tokio::task::spawn_blocking(|| Builder::new().prefix("salvo_http_multipart").tempdir())
-                .await
-                .map_err(ParseError::other)??
-                .keep();
-        let temp_dir = Some(path.clone());
+        Self::create_with_directory(field, || {
+            Builder::new().prefix("salvo_http_multipart").tempdir()
+        })
+        .await
+    }
+
+    async fn create_with_directory(
+        field: &mut Field<'_>,
+        create_directory: impl FnOnce() -> std::io::Result<tempfile::TempDir> + Send + 'static,
+    ) -> Result<Self, ParseError> {
         let name = field.file_name().map(|s| {
             // Sanitize filename by removing invalid characters
             s.chars()
@@ -219,26 +238,51 @@ impl FilePart {
                 })
                 .collect::<String>()
         });
-        path.push(format!(
-            "{}.{}",
-            text_nonce(),
-            name.as_deref()
-                .and_then(|name| { Path::new(name).extension().and_then(OsStr::to_str) })
-                .unwrap_or("unknown")
-        ));
-        let mut file = File::create(&path).await?;
+        let extension = name
+            .as_deref()
+            .and_then(|name| Path::new(name).extension().and_then(OsStr::to_str))
+            .unwrap_or("unknown")
+            .to_owned();
+        let mut writer = tokio::task::spawn_blocking(move || -> std::io::Result<UploadWriter> {
+            let directory = create_directory()?;
+            let path = directory
+                .path()
+                .join(format!("{}.{}", text_nonce(), extension));
+            let storage = Arc::new(TemporaryUpload {
+                path: path.clone(),
+                temp_dir: directory.keep(),
+                delete_on_drop: AtomicBool::new(true),
+            });
+            let file = std::fs::File::create(path)?;
+            Ok(UploadWriter { file, storage })
+        })
+        .await
+        .map_err(ParseError::other)??;
         let mut size = 0;
         while let Some(chunk) = field.chunk().await? {
             size += chunk.len() as u64;
-            file.write_all(&chunk).await?;
+            writer = tokio::task::spawn_blocking(move || -> std::io::Result<UploadWriter> {
+                writer.file.write_all(&chunk)?;
+                Ok(writer)
+            })
+            .await
+            .map_err(ParseError::other)??;
         }
-        file.sync_all().await?;
+        let storage =
+            tokio::task::spawn_blocking(move || -> std::io::Resul
```

**File**: `crates/oapi/src/openapi.rs` (modified, +105/-0)
```diff
@@ -1598,6 +1598,111 @@ mod tests {
         );
     }
 
+    #[tokio::test]
+    async fn merge_router_inherits_ancestor_method_through_path_nodes() {
+        use salvo_core::routing::filters;
+        use salvo_core::test::TestClient;
+
+        #[salvo_oapi::endpoint]
+        async fn inherited() -> &'static str {
+            "ok"
+        }
+
+        let router = Router::with_path("/api")
+            .filter(filters::get())
+            .push(Router::with_path("v1").push(Router::with_path("items").goal(inherited)));
+        let doc = OpenApi::new("test api", "0.0.1").merge_router(&router);
+        let item = &doc.paths["/api/v1/items"];
+        assert_eq!(item.operations.len(), 1);
+        assert!(item.operations.contains_key(&PathItemType::Get));
+        assert!(item.additional_operations.is_empty());
+        let response = TestClient::get("http://localhost/api/v1/items")
+            .send(router)
+            .await;
+        assert_eq!(response.status_code, Some(StatusCode::OK));
+    }
+
+    #[test]
+    fn merge_router_intersects_method_constraints_instead_of_overriding_them() {
+        use salvo_core::http::Method;
+        use salvo_core::routing::filters::MethodFilter;
+
+        #[salvo_oapi::endpoint]
+        async fn endpoint() -> &'static str {
+            "ok"
+        }
+
+        let purge = Method::from_bytes(b"PURGE").unwrap();
+        for (first, second) in [
+            (Method::GET, Method::POST),
+            (Method::POST, Method::GET),
+            (Method::GET, purge.clone()),
+            (purge.clone(), Method::GET),
+        ] {
+            let same_node = Router::with_path("/conflict")
+                .filter(MethodFilter(first.clone()))
+                .filter(MethodFilter(second.clone()))
+                .goal(endpoint)
+                .push(Router::with_path("child").get(endpoint));
+            let parent_and_child = Router::with_path("/conflict")
+                .filter(MethodFilter(first))
+                .push(
+                    Router::new()
+                        .filter(MethodFilter(second))
+                        .goal(endpoint)
+                        .push(Router::with_path("child").get(endpoint)),
+                );
+            for conflict in [same_node, parent_and_child] {
+                let router = Router::new()
+                    .push(conflict)
+                    .push(Router::with_path("/valid").get(endpoint));
+                let doc = OpenApi::new("test api", "0.0.1")
+                    .openapi_version(OpenApiVersion::Version3_2)
+                    .merge_router(&router);
+                assert_eq!(doc.paths.len(), 1);
+                assert!(doc.paths.contains_key("/valid"));
+            }
+        }
+
+        let repeated = Router::with_path("/repeated")
+            .filter(MethodFilter(Method::GET))
+            .filter(MethodFilter(Method::GET))
+            .push(Router::new().get(endpoint));
+        let doc = OpenApi::new("test api", "0.0.1").merge_router(&repeated);
+        assert!(
+            doc.paths["/repeated"]
+                .operations
+                .contains_key(&PathItemType::Get)
+        );
+    }
+
+    #[test]
+    fn merge_router_inherited_extension_methods_keep_version_gating() {
+        use salvo_core::http::Method;
+        use salvo_core::routing::filters::MethodFilter;
+
+        #[salvo_oapi::endpoint]
+        async fn endpoint() -> &'static str {
+            "ok"
+        }
+
+        for method in [Method::QUERY, Method::from_bytes(b"PURGE").unwrap()] {
+            let router = Router::with_filter(MethodFilter(method.clone()))
+                .push(Router::with_path("/resource").goal(endpoint));
+            let doc = OpenApi::new("test api", "0.0.1").merge_router(&router);
+            assert!(doc.paths.is_empty());
+            let doc = OpenApi::new("test api", "0.0.1")
+                .openapi_version(OpenApiVersion::Version3_2)
+                .merge_router(&router);
+            let item = &doc.paths["/resource"];
+            if method == Method::QUERY {
+                assert!(item.operations.contains_key(&PathItemType::Query));
+            } else {
+                assert!(item.additional_operations.contains_key("PURGE"));
+            }
+        }
+    }
+
     #[test]
     fn merge_router_emits_query_operation_only_for_3_2() {
         #[salvo_oapi::endpoint]
```

**File**: `crates/oapi/src/routing.rs` (modified, +34/-27)
```diff
@@ -99,6 +99,14 @@ pub(crate) struct NormNode {
 
 impl NormNode {
     pub(crate) fn new(router: &Router, inherited_metadata: Metadata) -> Self {
+        Self::with_method(router, inherited_metadata, None)
+    }
+
+    fn with_method(
+        router: &Router,
+        inherited_metadata: Metadata,
+        mut method: Option<Method>,
+    ) -> Self {
         let mut node = Self {
             // router_id: router.id,
             metadata: inherited_metadata,
@@ -134,45 +142,44 @@ impl NormNode {
                         node.path = Some(path);
                     }
                 }
-                FilterInfo::Method(method) => {
-                    // Methods with a dedicated Path Item field map to `PathItemType`;
-                    // everything else (CONNECT and custom/extension methods) goes to
-                    // `additionalOperations`, which requires OpenAPI 3.2. Whether such a
-                    // slot is actually emitted is decided later, when the document version
-                    // is known.
-                    let item = match method {
-                        Method::GET => OperationSlot::Standard(PathItemType::Get),
-                        Method::POST => OperationSlot::Standard(PathItemType::Post),
-                        Method::PUT => OperationSlot::Standard(PathItemType::Put),
-                        Method::DELETE => OperationSlot::Standard(PathItemType::Delete),
-                        Method::HEAD => OperationSlot::Standard(PathItemType::Head),
-                        Method::OPTIONS => OperationSlot::Standard(PathItemType::Options),
-                        Method::TRACE => OperationSlot::Standard(PathItemType::Trace),
-                        Method::PATCH => OperationSlot::Standard(PathItemType::Patch),
-                        Method::QUERY => OperationSlot::Standard(PathItemType::Query),
-                        other => OperationSlot::Additional(other.as_str().to_owned()),
-                    };
-                    // A standard method never loses to a custom one, so combining a
-                    // standard method filter with a custom one does not erase the standard
-                    // mapping (the previous string-parsing path had the same behavior via
-                    // its `_ => {}` arm).
-                    if matches!(item, OperationSlot::Standard(_))
-                        || !matches!(node.method, Some(OperationSlot::Standard(_)))
-                    {
-                        node.method = Some(item);
+                FilterInfo::Method(current) => {
+                    // Router filters and all ancestor filters are conjunctive. A
+                    // different method cannot override an earlier constraint: no
+                    // request can reach this node or any of its descendants.
+                    if method.as_ref().is_some_and(|method| method != &current) {
+                        return node;
                     }
+                    method = Some(current);
                 }
                 // Other filter kinds (Scheme/Host/Port/Other) do not carry
                 // information that maps to OpenAPI path items.
                 _ => {}
             }
         }
+        // Preserve extension method spelling; version compatibility is checked
+        // when the operation is inserted into the OpenAPI document.
+        node.method = method.as_ref().map(|method| match *method {
+            Method::GET => OperationSlot::Standard(PathItemType::Get),
+            Method::POST => OperationSlot::Standard(PathItemType::Post),
+            Method::PUT => OperationSlot::Standard(PathItemType::Put),
+            Method::DELETE => OperationSlot::Standard(PathItemType::Delete),
+            Method::HEAD => OperationSlot::Standard(PathItemType::Head),
+            Method::OPTIONS => OperationSlot::Standard(PathItemType::Options),
+            Method::TRACE => OperationSlot::Standard(PathItemType::Trace),
+            Method::PATCH => OperationSlot::Standard(PathItemType::Patch),
+            Method::QUERY => OperationSlot::Standard(PathItemType::Query),
+            _ => OperationSlot::Additional(method.as_str().to_owned()),
+        });
         node.handler_type_id = router.goal.as_ref().map(|h| h.type_id());
         node.handler_type_name = router.goal.as_ref().map(|h| h.type_name());
         let routers = router.routers();
         if !routers.is_empty() {
             for router in routers {
-                node.children.push(Self::new(router, node.metadata.clone()));
+                node.children.push(Self::with_method(
+                    router,
+                    node.metadata.clone(),
+                    method.clone(),
+                ));
             }
         }
         node
```

**File**: `crates/tus/src/stores/disk.rs` (modified, +120/-29)
```diff
@@ -520,47 +520,58 @@ impl DataStore for DiskStore {
                 _ => TusError::Internal(e.to_string()),
             })?;
 
+        // Metadata is the committed boundary. A cancelled write (or an older
+        // failed write) may have left an uncommitted tail on disk. Remove it
+        // before retrying, including retries with an empty body.
+        file.set_len(offset)
+            .await
+            .map_err(|e| TusError::Internal(e.to_string()))?;
         file.seek(SeekFrom::Start(offset))
             .await
             .map_err(|e| TusError::Internal(e.to_string()))?;
 
         let original_offset = offset;
-        let mut written: u64 = 0;
         let mut stream = stream;
-        while let Some(item) = stream.next().await {
-            let chunk = match item {
-                Ok(chunk) => chunk,
-                Err(e) if is_upload_size_limit_error(&e) => {
-                    let _ = file.set_len(original_offset).await;
+        let result = async {
+            let mut written: u64 = 0;
+            while let Some(item) = stream.next().await {
+                let chunk = item.map_err(|e| {
+                    if is_upload_size_limit_error(&e) {
+                        TusError::PayloadTooLarge
+                    } else {
+                        TusError::Internal(e.to_string())
+                    }
+                })?;
+                let new_offset = written
+                    .checked_add(chunk.len() as u64)
+                    .and_then(|w| original_offset.checked_add(w))
+                    .ok_or(TusError::PayloadTooLarge)?;
+                if meta.size.is_some_and(|size| new_offset > size) {
                     return Err(TusError::PayloadTooLarge);
                 }
-                Err(e) => return Err(TusError::Internal(e.to_string())),
-            };
-            // Accumulate with overflow checks: `write` is a public `DataStore`
-            // API and, on the deferred-size path (`meta.size == None`), there is
-            // no upper bound, so an extreme starting offset could otherwise wrap.
-            let new_offset = written
-                .checked_add(chunk.len() as u64)
-                .and_then(|w| original_offset.checked_add(w));
-            let Some(new_offset) = new_offset else {
-                let _ = file.set_len(original_offset).await;
-                return Err(TusError::PayloadTooLarge);
-            };
-            if let Some(size) = meta.size
-                && new_offset > size
-            {
-                let _ = file.set_len(original_offset).await;
-                return Err(TusError::PayloadTooLarge);
+                file.write_all(&chunk)
+                    .await
+                    .map_err(|e| TusError::Internal(e.to_string()))?;
+                written += chunk.len() as u64;
             }
-            file.write_all(&chunk)
+
+            file.flush()
                 .await
                 .map_err(|e| TusError::Internal(e.to_string()))?;
-            written += chunk.len() as u64;
+            Ok(written)
         }
-
-        file.flush()
-            .await
-            .map_err(|e| TusError::Internal(e.to_string()))?;
+        .await;
+        let written = match result {
+            Ok(written) => written,
+            Err(error) => {
+                // Roll back stream and I/O failures as well as size violations.
+                // set_len waits for pending Tokio file writes before truncating.
+                if let Err(rollback_error) = file.set_len(original_offset).await {
+                    warn!(id, error = %rollback_error, "failed to roll back tus upload data");
+                }
+                return Err(error);
+            }
+        };
 
         // `original_offset + written` was validated each iteration above, so this
         // cannot overflow; `saturating_add` is a belt-and-braces guard.
@@ -1309,6 +1320,86 @@ mod tests {
         assert_eq!(info.offset, Some(13));
     }
 
+    #[tokio::test]
+    async fn interrupted_write_preserves_committed_prefix() {
+        use bytes::Bytes;
+        use futures_util::stream;
+
+        let (store, _directory) = create_test_store();
+        let id = "interrupted-write";
+        let mut upload = create_test_upload_info(id);
+        upload.size = None;
+        store.create(upload).await.unwrap();
+        store
+            .write(
+                id,
+                0,
+                Box::pin(stream::iter([Ok(Bytes::from_static(b"prefix"))])),
+            )
+            .await
+            .unwrap();
+        let result = store
+            .write(
+                id,
+                6,
+                Box::pin(stream::iter([
+                    Ok(Bytes::from_static(b"old tail")),
+                    Err(io::Error::new(io::ErrorKind::UnexpectedEof, "interrupted")),
+                ])),
+            )
+            .await;
+        assert!(matches!(result, Err(TusError::Internal(_))));
+        assert_eq!(store.read_meta
```

**File**: `crates/tus/tests/upload_finish.rs` (modified, +66/-0)
```diff
@@ -38,6 +38,72 @@ fn streamed_body(
     }
 }
 
+#[tokio::test]
+async fn interrupted_patch_can_complete_with_a_shorter_retry() {
+    use bytes::Bytes;
+    use salvo_core::hyper::body::Frame;
+
+    let directory = tempfile::tempdir().unwrap();
+    let completed = Arc::new(Mutex::new(Vec::new()));
+    let observed = completed.clone();
+    let service = Service::new(
+        Tus::new()
+            .path("/uploads")
+            .storage_root(directory.path())
+            .on_upload_finish(move |_req, upload| {
+                observed.lock().unwrap().push(upload);
+                async { Ok(UploadFinishPatch::default()) }
+            })
+            .into_router(),
+    );
+    let created = TestClient::post("http://localhost/uploads")
+        .add_header("tus-resumable", "1.0.0", true)
+        .add_header("upload-defer-length", "1", true)
+        .send(&service)
+        .await;
+    assert_eq!(created.status_code, Some(StatusCode::CREATED));
+    let url = format!(
+        "http://localhost{}",
+        created.headers()["location"].to_str().unwrap()
+    );
+    let failed = TestClient::patch(&url)
+        .add_header("tus-resumable", "1.0.0", true)
+        .add_header("content-type", "application/offset+octet-stream", true)
+        .add_header("upload-offset", "0", true)
+        .body(streamed_body(vec![
+            Ok(Frame::data(Bytes::from_static(b"old-data"))),
+            Err(std::io::Error::new(std::io::ErrorKind::UnexpectedEof, "interrupted").into()),
+        ]))
+        .send(&service)
+        .await;
+    assert_eq!(failed.status_code, Some(StatusCode::INTERNAL_SERVER_ERROR));
+    assert!(completed.lock().unwrap().is_empty());
+    let head = TestClient::head(&url)
+        .add_header("tus-resumable", "1.0.0", true)
+        .send(&service)
+        .await;
+    assert_eq!(head.headers()["upload-offset"], "0");
+    let retry = TestClient::patch(&url)
+        .add_header("tus-resumable", "1.0.0", true)
+        .add_header("content-type", "application/offset+octet-stream", true)
+        .add_header("upload-offset", "0", true)
+        .add_header("upload-length", "3", true)
+        .body("abc")
+        .send(&service)
+        .await;
+    assert_eq!(retry.status_code, Some(StatusCode::NO_CONTENT));
+    assert_eq!(retry.headers()["upload-offset"], "3");
+    let mut downloaded = TestClient::get(&url)
+        .add_header("tus-resumable", "1.0.0", true)
+        .send(&service)
+        .await;
+    assert_eq!(downloaded.take_bytes(None).await.unwrap(), "abc");
+    let uploads = completed.lock().unwrap();
+    assert_eq!(uploads.len(), 1);
+    assert_eq!(uploads[0].size, Some(3));
+    assert_eq!(uploads[0].offset, Some(3));
+}
+
 #[tokio::test]
 async fn deferred_completion_waits_for_a_valid_request_stream() {
     use bytes::Bytes;
```

---

### Incident Patch 3: `4fb27aa9` (2026-10-23)
**Commit Message**: Fix route rollback, conditional file ranges and OpenAPI paths (#1718)

* Restore path state after failed filter branches

* Honor If-Range validators in file responses

* Preserve consecutive path filters in OpenAPI routes

* Exercise core tests with matched path enabled and disabled

**File**: `.github/workflows/linux.yml` (modified, +6/-0)
```diff
@@ -161,6 +161,12 @@ jobs:
       - uses: dtolnay/rust-toolchain@stable
       - name: Check selected protocols
         run: cargo check -p salvo --no-default-features --features '${{ matrix.features }}'
+      - name: Test core without matched-path
+        if: ${{ matrix.features == 'server,http1' }}
+        run: cargo test -p salvo_core --lib --no-default-features --features server,http1,test,cookie
+      - name: Test core with matched-path
+        if: ${{ matrix.features == 'server,http1' }}
+        run: cargo test -p salvo_core --lib --no-default-features --features server,http1,test,cookie,matched-path
       - name: Verify HTTP/2 is excluded when disabled
         if: ${{ !contains(matrix.features, 'http2') }}
         shell: bash
```

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -8,6 +8,12 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 
 ### Fixed
 
+- Preserve consecutive path filters on the same router when generating OpenAPI paths.
+- Honor `If-Range` validators in file responses, returning the full representation
+  when a resumable download refers to a different version.
+- Restore path cursors, captured parameters and matched path templates after failed
+  composite filters, so alternative routes start from the original matching state.
+  Routing tests also compile when `matched-path` is disabled.
 - Enable only the requested `salvo_extra` middleware features through `salvo`,
   avoiding unrelated WebSocket, Tower and request-ID dependencies for logging-only builds.
 - Declare the Hyper dependency directly for standalone `tower-compat` builds.
```

**File**: `crates/core/src/fs/named_file.rs` (modified, +104/-2)
```diff
@@ -21,7 +21,7 @@ use tokio::io::{AsyncReadExt, AsyncSeekExt};
 use super::{ChunkedFile, ChunkedState};
 use crate::http::body::ResBody;
 use crate::http::header::{
-    CONTENT_DISPOSITION, CONTENT_ENCODING, CONTENT_TYPE, IF_NONE_MATCH, RANGE,
+    CONTENT_DISPOSITION, CONTENT_ENCODING, CONTENT_TYPE, IF_NONE_MATCH, IF_RANGE, RANGE,
     X_CONTENT_TYPE_OPTIONS,
 };
 use crate::http::mime::{detect_text_mime, fill_mime_charset_if_need, is_charset_required_mime};
@@ -847,6 +847,18 @@ impl NamedFile {
             false
         };
 
+        // If-Range uses strong entity-tag comparison or an exact HTTP-date
+        // match. A failed (or invalid) validator ignores Range, even when the
+        // requested range would otherwise be unsatisfiable.
+        let range_allowed = !req_headers.contains_key(IF_RANGE)
+            || req_headers.typed_get::<IfRange>().is_some_and(|if_range| {
+                etag.as_ref()
+                    .is_some_and(|etag| if_range == IfRange::etag(etag.clone()))
+                    || last_modified
+                        .and_then(|mtime| self.encodable_last_modified(mtime))
+                        .is_some_and(|mtime| if_range == IfRange::date(mtime))
+            });
+
         // A caller may have already chosen the response's Content-Type. Default
         // the disposition from the type the client will actually receive, not
         // necessarily the type detected for the file on disk. Treat an invalid
@@ -918,7 +930,7 @@ impl NamedFile {
         let mut is_partial = false;
 
         // check for range header
-        if let Some(range) = req_headers.get(RANGE) {
+        if let Some(range) = req_headers.get(RANGE).filter(|_| range_allowed) {
             let Ok(range) = range.to_str() else {
                 res.status_code(StatusCode::BAD_REQUEST);
                 return;
@@ -1075,6 +1087,96 @@ fn none_match(etag: Option<&ETag>, req_headers: &HeaderMap) -> bool {
 mod tests {
     use super::*;
 
+    #[tokio::test]
+    async fn if_range_requires_a_matching_validator() {
+        use crate::test::ResponseExt;
+
+        let temp_dir = tempfile::tempdir().unwrap();
+        let path = temp_dir.path().join("range.txt");
+        std::fs::write(&path, b"new-content").unwrap();
+        let file = NamedFile::open(&path).await.unwrap();
+        let etag = file.etag().unwrap();
+        let mut etag_headers = HeaderMap::new();
+        etag_headers.typed_insert(etag.clone());
+        let weak_etag = format!("W/{}", etag_headers["etag"].to_str().unwrap())
+            .parse()
+            .unwrap();
+        let modified = file.last_modified().unwrap();
+        let valid_date = IfRange::date(modified);
+        for (validator, expected_status, expected_body) in [
+            (
+                IfRange::etag("\"old-etag\"".parse().unwrap()),
+                StatusCode::OK,
+                "new-content",
+            ),
+            (
+                IfRange::etag(etag.clone()),
+                StatusCode::PARTIAL_CONTENT,
+                "content",
+            ),
+            (IfRange::etag(weak_etag), StatusCode::OK, "new-content"),
+            (
+                IfRange::date(modified - Duration::from_secs(60)),
+                StatusCode::OK,
+                "new-content",
+            ),
+            (
+                IfRange::date(modified + Duration::from_secs(60)),
+                StatusCode::OK,
+                "new-content",
+            ),
+            (valid_date, StatusCode::PARTIAL_CONTENT, "content"),
+        ] {
+            let mut headers = HeaderMap::new();
+            headers.insert(RANGE, HeaderValue::from_static("bytes=4-"));
+            headers.typed_insert(validator);
+            let mut response = Response::new();
+            NamedFile::open(&path)
+                .await
+                .unwrap()
+                .send(&headers, &mut response)
+                .await;
+            assert_eq!(response.status_code, Some(expected_status));
+            assert_eq!(response.take_string().await.unwrap(), expected_body);
+        }
+
+        // A failed validator must bypass even an unsatisfiable Range.
+        let mut headers = HeaderMap::new();
+        headers.insert(RANGE, HeaderValue::from_static("bytes=100-"));
+        headers.typed_insert(IfRange::etag("\"old-etag\"".parse().unwrap()));
+        let mut response = Response::new();
+        NamedFile::open(&path)
+            .await
+            .unwrap()
+            .send_head(&headers, &mut response)
+            .await;
+        assert_eq!(response.status_code, Some(StatusCode::OK));
+        assert!(response.body.is_none());
+
+        headers.insert(RANGE, HeaderValue::from_static("bytes=4-"));
+        headers.insert(IF_RANGE, HeaderValue::from_static("invalid-validator"));
+        let mut response = Response::new();
+        NamedFile::open(&path)
+            .await
+            .unwrap()
+            .send(&headers, &mut response)
+            .await;
+    
```

**File**: `crates/core/src/routing.rs` (modified, +1/-0)
```diff
@@ -594,6 +594,7 @@ mod tests {
         assert_eq!(access(&service, "localhost").await, "Hello World");
     }
 
+    #[cfg(feature = "matched-path")]
     #[tokio::test]
     async fn test_matched_path() {
         #[handler]
```

**File**: `crates/core/src/routing/filters.rs` (modified, +11/-0)
```diff
@@ -69,6 +69,9 @@ pub trait Filter: Debug + Send + Sync + 'static {
         FilterInfo::Other(self.type_name())
     }
     /// Create a new filter use `And` filter.
+    ///
+    /// Restores path matching state if either filter fails. Mutations to the
+    /// request itself are not rolled back.
     #[inline]
     fn and<F>(self, other: F) -> And<Self, F>
     where
@@ -82,6 +85,9 @@ pub trait Filter: Debug + Send + Sync + 'static {
     }
 
     /// Create a new filter use `Or` filter.
+    ///
+    /// Restores path matching state before trying the second alternative and
+    /// when neither alternative matches. Request mutations are not rolled back.
     #[inline]
     fn or<F>(self, other: F) -> Or<Self, F>
     where
@@ -95,6 +101,8 @@ pub trait Filter: Debug + Send + Sync + 'static {
     }
 
     /// Create a new filter use `AndThen` filter.
+    ///
+    /// Restores path matching state if the filter or callback fails.
     #[inline]
     fn and_then<F>(self, fun: F) -> AndThen<Self, F>
     where
@@ -108,6 +116,9 @@ pub trait Filter: Debug + Send + Sync + 'static {
     }
 
     /// Create a new filter use `OrElse` filter.
+    ///
+    /// The callback starts with the original path matching state after a failed
+    /// filter. A failed callback also restores that state.
     #[inline]
     fn or_else<F>(self, fun: F) -> OrElse<Self, F>
     where
```

**File**: `crates/core/src/routing/filters/opts.rs` (modified, +110/-8)
```diff
@@ -18,10 +18,17 @@ where
 {
     #[inline]
     async fn filter(&self, req: &mut Request, state: &mut PathState<'_>) -> bool {
+        let checkpoint = state.checkpoint();
         if self.first.filter(req, state).await {
             true
         } else {
-            self.second.filter(req, state).await
+            state.rollback(checkpoint);
+            if self.second.filter(req, state).await {
+                true
+            } else {
+                state.rollback(checkpoint);
+                false
+            }
         }
     }
 }
@@ -39,10 +46,17 @@ where
 {
     #[inline]
     async fn filter(&self, req: &mut Request, state: &mut PathState<'_>) -> bool {
+        let checkpoint = state.checkpoint();
         if self.filter.filter(req, state).await {
             true
         } else {
-            (self.callback)(req, state)
+            state.rollback(checkpoint);
+            if (self.callback)(req, state) {
+                true
+            } else {
+                state.rollback(checkpoint);
+                false
+            }
         }
     }
 }
@@ -67,10 +81,12 @@ where
 {
     #[inline]
     async fn filter(&self, req: &mut Request, state: &mut PathState<'_>) -> bool {
-        if !self.first.filter(req, state).await {
-            false
+        let checkpoint = state.checkpoint();
+        if self.first.filter(req, state).await && self.second.filter(req, state).await {
+            true
         } else {
-            self.second.filter(req, state).await
+            state.rollback(checkpoint);
+            false
         }
     }
 }
@@ -89,10 +105,12 @@ where
 {
     #[inline]
     async fn filter(&self, req: &mut Request, state: &mut PathState<'_>) -> bool {
-        if !self.filter.filter(req, state).await {
-            false
+        let checkpoint = state.checkpoint();
+        if self.filter.filter(req, state).await && (self.callback)(req, state) {
+            true
         } else {
-            (self.callback)(req, state)
+            state.rollback(checkpoint);
+            false
         }
     }
 }
@@ -103,3 +121,87 @@ impl<T, F> fmt::Debug for AndThen<T, F> {
         write!(f, "opt:and_then")
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use crate::routing::{Filter, PathState, filters};
+    use crate::test::TestClient;
+
+    #[tokio::test]
+    async fn or_retries_from_the_original_path() {
+        let filter = filters::path("a")
+            .and(filters::get())
+            .or(filters::path("a").and(filters::post()));
+        let mut req = TestClient::post("http://localhost/a").build();
+        let mut state = PathState::from_borrowed_path("/a");
+        assert!(filter.filter(&mut req, &mut state).await);
+        assert!(state.is_ended());
+    }
+
+    #[tokio::test]
+    async fn or_discards_failed_captures() {
+        let filter = filters::path("{leaked}/wrong").or(filters::path("{actual}/right"));
+        let mut req = TestClient::get("http://localhost/alice/right").build();
+        let mut state = PathState::from_borrowed_path("/alice/right");
+        assert!(filter.filter(&mut req, &mut state).await);
+        assert!(!state.params.contains_key("leaked"));
+        assert_eq!(state.params["actual"], "alice");
+        #[cfg(feature = "matched-path")]
+        assert_eq!(state.matched_parts, ["{actual}", "right"]);
+    }
+
+    #[tokio::test]
+    async fn or_rolls_back_failed_wildcard_captures() {
+        let filter = filters::path("{**ignored}")
+            .and(filters::post())
+            .or(filters::path("{**actual}").and(filters::get()));
+        let mut req = TestClient::get("http://localhost/some/path").build();
+        let mut state = PathState::from_borrowed_path("/some/path");
+        assert!(filter.filter(&mut req, &mut state).await);
+        assert!(!state.params.contains_key("ignored"));
+        assert_eq!(state.params.tail(), Some("some/path"));
+        assert_eq!(state.params["actual"], "some/path");
+    }
+
+    #[tokio::test]
+    async fn failed_composites_restore_ancestor_captures() {
+        let mut req = TestClient::get("http://localhost/alice/edit").build();
+        let mut state = PathState::from_borrowed_path("/alice/edit");
+        assert!(filters::path("{id}").filter(&mut req, &mut state).await);
+        let before = state.clone();
+        let filter = filters::path("{id}").and(filters::post());
+        assert!(!filter.filter(&mut req, &mut state).await);
+        assert_eq!(state, before);
+
+        let filter = filters::path("{id}").and_then(|_, _| false);
+        assert!(!filter.filter(&mut req, &mut state).await);
+        assert_eq!(state, before);
+
+        let filter = filters::path("{id}/missing")
+            .or_else(|_, state| state.pick() == Some("edit") && state.params["id"] == "alice");
+        assert!(filter.filter(&mut req, &mut state).await);
+        assert_eq!(state, before);
+    }
+
+    #[tokio::test]
+    async fn failed_alternatives_restore_the_input_state() {
+        let 
```

**File**: `crates/core/src/routing/filters/path.rs` (modified, +7/-3)
```diff
@@ -1129,16 +1129,16 @@ impl PathFilter {
     }
     /// Detect is that path is match.
     pub fn detect(&self, state: &mut PathState<'_>) -> bool {
-        let original_cursor = state.cursor;
+        let checkpoint = state.checkpoint();
         for ps in &self.path_wisps {
             let row = state.cursor.0;
             if ps.detect(state) {
                 if row == state.cursor.0 && row != state.parts_len() {
-                    state.cursor = original_cursor;
+                    state.rollback(checkpoint);
                     return false;
                 }
             } else {
-                state.cursor = original_cursor;
+                state.rollback(checkpoint);
                 return false;
             }
         }
@@ -1472,6 +1472,7 @@ mod tests {
         let mut state =
             PathState::from_borrowed_path("/users/123e4567-e89b-12d3-a456-9AC7CBDCEE52");
         assert!(filter.detect(&mut state));
+        #[cfg(feature = "matched-path")]
         assert_eq!(
             state.matched_parts,
             vec!["users".to_owned(), "{id}".to_owned()]
@@ -1482,6 +1483,7 @@ mod tests {
         let filter = PathFilter::new("/users/{id}/{**rest}");
         let mut state = PathState::from_borrowed_path("/users/12/facebook/insights/23");
         assert!(filter.detect(&mut state));
+        #[cfg(feature = "matched-path")]
         assert_eq!(
             state.matched_parts,
             vec!["users".to_owned(), "{id}".to_owned(), "{**rest}".to_owned()]
@@ -1490,6 +1492,7 @@ mod tests {
         assert!(filter.detect(&mut state));
         let mut state = PathState::from_borrowed_path("/users/12");
         assert!(filter.detect(&mut state));
+        #[cfg(feature = "matched-path")]
         assert_eq!(
             state.matched_parts,
             vec!["users".to_owned(), "{id}".to_owned(), "{**rest}".to_owned()]
@@ -1512,6 +1515,7 @@ mod tests {
         assert!(filter.detect(&mut state));
         let mut state = PathState::from_borrowed_path("/users/12/abc");
         assert!(filter.detect(&mut state));
+        #[cfg(feature = "matched-path")]
         assert_eq!(
             state.matched_parts,
             vec!["users".to_owned(), "{id}".to_owned(), "{*?rest}".to_owned()]
```

**File**: `crates/core/src/routing/path_state.rs` (modified, +30/-0)
```diff
@@ -38,6 +38,16 @@ pub struct PathState<'a> {
     pub(crate) once_ended: bool, /* Once it has ended, used to determine whether the error code
                                  * returned is 404 or 405. */
 }
+
+/// A lightweight transaction boundary for path matching.
+#[derive(Clone, Copy)]
+pub(crate) struct PathCheckpoint {
+    cursor: (usize, usize),
+    params: (usize, bool, usize),
+    end_slash: bool,
+    #[cfg(feature = "matched-path")]
+    matched_parts_len: usize,
+}
 impl<'a> Debug for PathState<'a> {
     fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
         let parts = self.parts_iter().collect::<Vec<_>>();
@@ -75,6 +85,26 @@ impl<'a, 'b> PartialEq<PathState<'b>> for PathState<'a> {
 }
 impl<'a> Eq for PathState<'a> {}
 impl<'a> PathState<'a> {
+    pub(crate) fn checkpoint(&self) -> PathCheckpoint {
+        PathCheckpoint {
+            cursor: self.cursor,
+            params: self.params.snapshot(),
+            end_slash: self.end_slash,
+            #[cfg(feature = "matched-path")]
+            matched_parts_len: self.matched_parts.len(),
+        }
+    }
+
+    pub(crate) fn rollback(&mut self, checkpoint: PathCheckpoint) {
+        self.cursor = checkpoint.cursor;
+        self.params.rollback(checkpoint.params);
+        self.end_slash = checkpoint.end_slash;
+        #[cfg(feature = "matched-path")]
+        self.matched_parts.truncate(checkpoint.matched_parts_len);
+        // `once_ended` accumulates path matches across failed router branches
+        // to distinguish 405 from 404, so it is intentionally not rolled back.
+    }
+
     /// Creates a new owned `PathState` from a borrowed path.
     #[inline]
     #[must_use]
```

#### Recent Merged Pull Requests:
- **PR #1739** (2026-10-23): Avoid quadratic cleanup when growing the TUS lock map (@chrislearn)
- **PR #1738** (2026-10-23): Discover allowed methods in one traversal for independent route filters (@chrislearn)
- **PR #1737** (2026-10-23): Select a TLS provider for standalone extra middleware tests (@chrislearn)
- **PR #1736** (2026-10-23): Surface session backend failures with configurable policy (@chrislearn)
- **PR #1734** (2026-10-23): Normalize multipart size limit failures to HTTP 413 (@chrislearn)
- **PR #1733** (2026-10-23): Clear stale representation headers when rendering status errors (@chrislearn)

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

## X. middleware boundaries and multipart upload handling (#1722)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in salvo-rs/salvo. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `82278068`: middleware boundaries and multipart upload handling (#1722). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Exclude pending cookie jar changes and partial responses from response caching,
  and bypass cached representations for range requests.
- Forward parameter names through optional extractors and reject missing required
  header, query and cookie values before constructing their wrappers.
- Honor ETag precedence, lists and wildcards in conditional responses, while
  preserving write responses and non-200 statuses.
- Preserve response trailers during compression and offload compression flushing
  and finalization together with expensive writes.
- Validate tus creation requests before allocating storage, remove uploads after
  creation-time stream failures, and pass final storage metadata to completion hooks.
- Merge multipart form and file schemas instead of overwriting earlier endpoint
  parameters, preserving required fields and form constraints.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `82278068` are properly handled with clean fallback behavior.
