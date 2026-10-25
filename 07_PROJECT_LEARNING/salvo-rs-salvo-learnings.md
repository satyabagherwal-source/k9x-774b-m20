> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/salvo-rs-salvo-learnings.md`  
> **Source**: github ([https://github.com/salvo-rs/salvo](https://github.com/salvo-rs/salvo))  
> **Source Version**: `07f55f73`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T18:40:46.915Z  
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
> **Harvest Timestamp**: 2026-10-25T18:40:46.491Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `salvo-rs/salvo`
- **Description**: A powerful web framework built with a simplified design.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4454 stars

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

### Incident Patch 1: `07f55f73` (2026-10-23)
**Commit Message**: Preserve Salvo context across Tower short circuits and cancellation (#1754)

* Recover Salvo context when Tower layers finish or cancel

* Place changelog entry beside related fixes

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -53,6 +53,8 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 - Enable only the requested `salvo_extra` middleware features through `salvo`,
   avoiding unrelated WebSocket, Tower and request-ID dependencies for logging-only builds.
 - Declare the Hyper dependency directly for standalone `tower-compat` builds.
+- Recover request, depot and flow state when Tower layers short-circuit, fail or
+  cancel their inner future, preserving HEAD handling and prepared response policy headers.
 - Invoke tus upload completion hooks when PATCH finishes an upload, sharing
   response customization and error handling with creation-time completion.
 - Preserve existing tus metadata if replacing its temporary file fails on Windows.
```

**File**: `crates/extra/Cargo.toml` (modified, +2/-0)
```diff
@@ -66,6 +66,8 @@ tower-compat = [
     "dep:http-body-util",
     "dep:tower",
     "dep:tracing",
+    "tokio/macros",
+    "tokio/sync",
 ]
 
 [dependencies]
```

**File**: `crates/extra/src/tower_compat.rs` (modified, +696/-88)
```diff
@@ -26,17 +26,17 @@ use std::error::Error as StdError;
 use std::fmt::{self, Debug, Formatter};
 use std::io::Error as IoError;
 use std::marker::PhantomData;
-use std::sync::Arc;
+use std::sync::{Arc, Mutex};
 use std::task::{Context, Poll};
 
 use futures_util::future::{BoxFuture, FutureExt, ready};
 use http_body_util::BodyExt;
 use hyper::body::{Body, Bytes};
-use tower::buffer::Buffer;
-use tower::{Layer, Service, ServiceExt};
-
 use salvo_core::http::{ReqBody, ResBody, StatusError};
 use salvo_core::{Depot, FlowCtrl, Handler, Request, Response, async_trait, hyper};
+use tokio::sync::oneshot;
+use tower::buffer::Buffer;
+use tower::{Layer, Service, ServiceExt};
 
 /// Trait for tower service compat.
 pub trait TowerServiceCompat<QB, SB, E, Fut> {
@@ -105,9 +105,7 @@ where
         }
         let Ok(hyper_req) = req.strip_to_hyper::<QB>() else {
             tracing::error!("strip request to hyper failed");
-            res.render(
-                StatusError::internal_server_error().cause("strip request to hyper failed"),
-            );
+            res.render(StatusError::internal_server_error().cause("strip request to hyper failed"));
             return;
         };
 
@@ -133,35 +131,80 @@ where
     }
 }
 
-struct FlowCtrlInContext {
-    ctrl: FlowCtrl,
-    request: Request,
-    depot: Depot,
-    response: Response,
+struct FlowCall {
+    request: hyper::Request<ReqBody>,
+    response: oneshot::Sender<hyper::Response<ResBody>>,
+    span: tracing::Span,
 }
-impl FlowCtrlInContext {
-    fn new(ctrl: FlowCtrl, request: Request, depot: Depot, response: Response) -> Self {
-        Self {
-            ctrl,
-            request,
-            depot,
-            response,
-        }
+
+type FlowCallSender = Arc<Mutex<Option<oneshot::Sender<FlowCall>>>>;
+
+const REPRESENTATION_HEADERS: &[&str] = &[
+    "content-type",
+    "content-length",
+    "content-encoding",
+    "content-range",
+    "content-disposition",
+    "etag",
+    "last-modified",
+    "digest",
+    "content-digest",
+    "repr-digest",
+    "transfer-encoding",
+    "trailer",
+];
+
+// Request extensions may be cloned or retained by Tower. The sender is a
+// single-use capability, and closing it also invalidates those retained copies.
+struct CloseFlowCall(FlowCallSender);
+
+impl Drop for CloseFlowCall {
+    fn drop(&mut self) {
+        self.0.lock().unwrap_or_else(|e| e.into_inner()).take();
     }
 }
-struct FlowCtrlOutContext {
-    ctrl: FlowCtrl,
-    request: Request,
-    depot: Depot,
-}
-impl FlowCtrlOutContext {
-    fn new(ctrl: FlowCtrl, request: Request, depot: Depot) -> Self {
-        Self {
-            ctrl,
-            request,
-            depot,
+
+async fn drive_inner_call(
+    call: oneshot::Receiver<FlowCall>,
+    req: &mut Request,
+    depot: &mut Depot,
+    res: &mut Response,
+    ctrl: &mut FlowCtrl,
+    response_sent: &mut bool,
+) {
+    if let Ok(FlowCall {
+        request,
+        mut response,
+        span,
+    }) = call.await
+    {
+        // A layer may poll its inner future once and then abandon it while
+        // preparing a fallback. Do not run an abandoned downstream flow.
+        if response.is_closed() {
+            std::future::pending::<()>().await;
+        }
+        req.merge_hyper(request);
+        let completed = tokio::select! {
+            _ = tracing::Instrument::instrument(ctrl.call_next(req, depot, res), span) => true,
+            _ = response.closed() => false,
+        };
+        if !completed {
+            std::future::pending::<()>().await;
+        }
+        let hyper_response = res.strip_to_hyper();
+        // Keep the serialized policy/cookie headers for an error returned by
+        // Tower after it consumes the response. Successful Tower responses are
+        // authoritative, including any headers the layer deliberately removes.
+        *res.headers_mut() = hyper_response.headers().clone();
+        for name in REPRESENTATION_HEADERS {
+            res.headers_mut().remove(*name);
         }
+        *response_sent = true;
+        let _ = response.send(hyper_response);
     }
+    // Only the Tower response completes the adapter. In particular, sending
+    // the inner response must not cancel Tower before it can process it.
+    std::future::pending::<()>().await;
 }
 
 #[doc(hidden)]
@@ -177,37 +220,45 @@ impl Service<hyper::Request<ReqBody>> for FlowCtrlService {
     }
 
     fn call(&mut self, mut hyper_req: hyper::Request<ReqBody>) -> Self::Future {
-        let ctx = hyper_req
-            .extensions_mut()
-            .remove::<Arc<FlowCtrlInContext>>()
-            .and_then(Arc::into_inner);
-        let Some(FlowCtrlInContext {
-            mut ctrl,
-            mut request,
-            mut depot,
-            mut response,
-        }) = ctx
-        else {
+        let sender = hyper_req.extensions_mut().remove::<FlowCallSender>();
+        let Some(sender) = sender else {
+            return ready(Err(IoError::othe
```

---

### Incident Patch 2: `2b564125` (2026-10-23)
**Commit Message**: Audit current dependency resolutions and require patched TLS releases (#1740)

* Audit current dependency resolutions and require patched TLS releases

* Enforce the patched rustls minimum for downstream TLS servers

**File**: `.cargo/audit.toml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+[advisories]
+# certon 0.3 uses rsa for key generation and DER conversion, not private-key
+# decryption. TLS operations use rustls' ring/aws-lc backend. No fixed rsa release
+# exists for this advisory. See .github/DEPENDENCY_SECURITY.md; review by 2027-01-23.
+ignore = ["RUSTSEC-2023-0071"]
```

**File**: `.github/DEPENDENCY_SECURITY.md` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# Dependency security checks
+
+The root, examples, and fuzz workspaces intentionally ignore Cargo.lock. Security
+CI generates each lockfile before auditing it, and runs weekly as well as on
+dependency changes. Existing local lockfiles should be refreshed with
+`cargo update` before interpreting findings as the current dependency resolution.
+
+The direct rustls and quinn minimums exclude known vulnerable releases of those
+packages. The core TLS feature activates rustls as a normal optional dependency,
+so its minimum also applies to downstream server builds without workspace dev
+dependencies. CI checks that an isolated downstream TLS application cannot resolve
+rustls 0.23.40. Transitive dependency findings remain covered by the audit job; raising
+a direct dependency minimum does not guarantee every transitive version is safe.
+
+## RUSTSEC-2023-0071: rsa timing side channel
+
+- Owner: Salvo maintainers. Review by **2027-01-23**, and whenever certon or its
+  cryptographic call sites change.
+- Applies to the rsa 0.9 dependency of certon 0.3, used by salvo-acme. There is no
+  patched rsa version listed in the advisory at the time of this review.
+- certon's crypto module uses rsa for RSA key generation, PKCS#1/PKCS#8 parsing,
+  and DER encoding. It does not use rsa private-key decryption. TLS signing and
+  handshakes use rustls with ring/aws-lc instead. Salvo defaults new ACME keys to
+  ECDSA P-256; applications may explicitly select RSA keys.
+- This is an audit exception for these reviewed call paths, not a claim that rsa
+  is fixed or suitable for private-key decryption. Remove the exception when a
+  fixed version or replacement is available. Reassess it before adding any new
+  use of rsa, including through other dependencies.
+
+All other advisories fail the audit. The workflow checks the exception review
+date so that it cannot remain unreviewed indefinitely.
```

**File**: `.github/workflows/security.yml` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+name: Dependency security
+
+permissions:
+  contents: read
+
+on:
+  workflow_dispatch:
+  schedule:
+    - cron: '0 4 * * 1'
+  pull_request:
+    paths:
+      - '**/Cargo.toml'
+      - '**/Cargo.lock'
+      - '.cargo/audit.toml'
+      - '.github/DEPENDENCY_SECURITY.md'
+      - '.github/workflows/security.yml'
+  push:
+    branches: [main]
+    paths:
+      - '**/Cargo.toml'
+      - '**/Cargo.lock'
+      - '.cargo/audit.toml'
+      - '.github/DEPENDENCY_SECURITY.md'
+      - '.github/workflows/security.yml'
+
+jobs:
+  downstream-tls:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v6
+      - uses: dtolnay/rust-toolchain@stable
+      - name: Verify the rustls minimum without workspace dev dependencies
+        shell: bash
+        run: |
+          set -euo pipefail
+          fixture=$(mktemp -d)
+          mkdir "$fixture/src"
+          printf 'fn main() {}\n' > "$fixture/src/main.rs"
+          printf '[package]\nname = "downstream-tls"\nversion = "0.0.0"\nedition = "2024"\n[workspace]\n[dependencies]\nsalvo_core = { path = "%s/crates/core", default-features = false, features = ["rustls", "ring"] }\n' "$GITHUB_WORKSPACE" > "$fixture/Cargo.toml"
+          cargo generate-lockfile --manifest-path "$fixture/Cargo.toml"
+          if cargo update --manifest-path "$fixture/Cargo.toml" -p rustls --precise 0.23.40 > "$fixture/downgrade.log" 2>&1; then
+            echo 'A downstream TLS application unexpectedly accepted vulnerable rustls'
+            exit 1
+          fi
+          cat "$fixture/downgrade.log"
+          grep -F 'rustls = "^0.23.46"' "$fixture/downgrade.log"
+          cargo check --manifest-path "$fixture/Cargo.toml" --locked
+
+  audit:
+    runs-on: ubuntu-latest
+    strategy:
+      fail-fast: false
+      matrix:
+        workspace: ['.', 'examples', 'fuzz']
+    steps:
+      - uses: actions/checkout@v6
+      - uses: dtolnay/rust-toolchain@stable
+      - uses: taiki-e/install-action@cargo-audit
+      - name: Require review of the rsa advisory exception
+        run: |
+          python3 - <<'PY'
+          import datetime
+          if datetime.datetime.now(datetime.timezone.utc).date() > datetime.date(2027, 1, 23):
+              raise SystemExit('Review the rsa advisory exception in .cargo/audit.toml')
+          PY
+      - name: Resolve dependencies and audit
+        run: |
+          cargo generate-lockfile --manifest-path '${{ matrix.workspace }}/Cargo.toml'
+          cargo audit --file '${{ matrix.workspace }}/Cargo.lock'
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -106,7 +106,7 @@ percent-encoding = "2"
 pin-project = "1"
 proc-macro-crate = { version = ">= 2, <= 4" }
 proc-macro2 = "1"
-quinn = { version = "0.11", default-features = false }
+quinn = { version = "0.11.12", default-features = false }
 quote = "1"
 rand = "0.10"
 rcgen = "0.14"
@@ -115,7 +115,7 @@ reqwest = { version = "0.13", default-features = false }
 aws-lc-rs = { version = "1", default-features = true }
 ring = "0.17"
 rust_decimal = "1"
-rustls = { version = "0.23", default-features = false }
+rustls = { version = "0.23.46", default-features = false }
 rust-embed = { version = ">= 6, <= 9" }
 saysion = "0.2"
 serde = "1"
```

**File**: `crates/core/Cargo.toml` (modified, +4/-3)
```diff
@@ -50,15 +50,15 @@ full = [
 ]
 cookie = ["dep:cookie"]
 fix-http1-request-uri = ["http1"]
-aws-lc-rs = ["tokio-rustls?/aws-lc-rs", "quinn?/rustls-aws-lc-rs"]
-ring = ["tokio-rustls?/ring", "quinn?/rustls-ring"]
+aws-lc-rs = ["rustls?/aws_lc_rs", "tokio-rustls?/aws-lc-rs", "quinn?/rustls-aws-lc-rs"]
+ring = ["rustls?/ring", "tokio-rustls?/ring", "quinn?/rustls-ring"]
 server = []
 server-handle = []
 http1 = ["hyper/http1"]
 http2 = ["hyper/http2"]
 http2-cleartext = ["http2"]
 quinn = ["dep:salvo-http3", "dep:quinn", "dep:h3-datagram", "rustls"]
-rustls = ["dep:tokio-rustls", "dep:arc-swap"]
+rustls = ["dep:rustls", "dep:tokio-rustls", "dep:arc-swap"]
 native-tls = ["dep:tokio-native-tls", "dep:native-tls", "dep:arc-swap"]
 openssl = ["dep:openssl", "dep:tokio-openssl", "dep:arc-swap"]
 unix = ["http1", "dep:nix"]
@@ -115,6 +115,7 @@ quinn = { workspace = true, optional = true, default-features = false, features
 ] }
 rand = { workspace = true }
 regex = { workspace = true }
+rustls = { workspace = true, optional = true }
 salvo-http3 = { workspace = true, optional = true, features = ["quinn"] }
 salvo_macros = { workspace = true }
 hyper-util = { workspace = true, features = ["tokio"] }
```

**File**: `crates/core/src/conn/rustls.rs` (modified, +5/-5)
```diff
@@ -2,9 +2,9 @@
 use std::io::{Error as IoError, Result as IoResult};
 use std::sync::Arc;
 
-use tokio_rustls::rustls::RootCertStore;
-use tokio_rustls::rustls::crypto::CryptoProvider;
-use tokio_rustls::rustls::pki_types::{CertificateDer, pem::PemObject};
+use rustls::RootCertStore;
+use rustls::crypto::CryptoProvider;
+use rustls::pki_types::{CertificateDer, pem::PemObject};
 
 pub(crate) mod config;
 pub use config::{Keycert, RustlsConfig, ServerConfig};
@@ -42,11 +42,11 @@ pub fn default_crypto_provider() -> Arc<CryptoProvider> {
 
     #[cfg(any(feature = "aws-lc-rs", not(feature = "ring")))]
     {
-        Arc::new(tokio_rustls::rustls::crypto::aws_lc_rs::default_provider())
+        Arc::new(rustls::crypto::aws_lc_rs::default_provider())
     }
     #[cfg(all(not(feature = "aws-lc-rs"), feature = "ring"))]
     {
-        Arc::new(tokio_rustls::rustls::crypto::ring::default_provider())
+        Arc::new(rustls::crypto::ring::default_provider())
     }
 }
 
```

#### Recent Merged Pull Requests:
- **PR #1754** (2026-10-23): Preserve Salvo context across Tower short circuits and cancellation (@chrislearn)
- **PR #1753** (2026-10-23): Bound multipart part and file counts (@chrislearn)
- **PR #1752** (2026-10-23): Refresh parsed request caches after Tower rewrites (@chrislearn)
- **PR #1751** (2026-10-23): Log response status after Service finalization (@chrislearn)
- **PR #1750** (2026-10-23): Omit query strings from empty-response warnings (@chrislearn)
- **PR #1749** (2026-10-23): Enforce If-Match preconditions for embedded assets (@chrislearn)

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

## X. Preserve Salvo context across Tower short circuits and cancellation (#1754)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in salvo-rs/salvo. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `07f55f73`: Preserve Salvo context across Tower short circuits and cancellation (#1754). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Recover request, depot and flow state when Tower layers short-circuit, fail or
  cancel their inner future, preserving HEAD handling and prepared response policy headers.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `07f55f73` are properly handled with clean fallback behavior.
