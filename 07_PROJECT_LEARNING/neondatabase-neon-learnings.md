# Forensic Learning Record (Deep Inspection): neondatabase/neon

> **Canonical Artifact**: `07_PROJECT_LEARNING/neondatabase-neon-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/neondatabase/neon](https://github.com/neondatabase/neon))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:38:56.543Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `neondatabase/neon`
- **Description**: Neon: Serverless Postgres. We separated storage and compute to offer autoscaling, code-like database branching, and scale to zero.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 23171 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `libs/http-utils/src/endpoint.rs`
```
use std::future::Future;
use std::io::Write as _;
use std::str::FromStr;
use std::time::Duration;

use anyhow::{Context, anyhow};
use bytes::{Bytes, BytesMut};
use hyper::header::{AUTHORIZATION, CONTENT_DISPOSITION, CONTENT_TYPE, HeaderName};
use hyper::http::HeaderValue;
use hyper::{Body, Method, Request, Response};
use jsonwebtoken::TokenData;
use metrics::{Encoder, IntCounter, TextEncoder, register_int_counter};
use once_cell::sync::Lazy;
use pprof::ProfilerGuardBuilder;
use pprof::protos::Message as _;
use routerify::ext::RequestExt;
use routerify::{Middleware, RequestInfo, Router, RouterBuilder};
use tokio::sync::{Mutex, Notify, mpsc};
use tokio_stream::wrappers::ReceiverStream;
use tokio_util::io::ReaderStream;
use tracing::{Instrument, debug, info, info_span, warn};
use utils::auth::{AuthError, Claims, SwappableJwtAuth};
use utils::metrics_collector::{METRICS_COLLECTOR, METRICS_STALE_MILLIS};

use crate::error::{ApiError, api_error_handler, route_error_handler};
use crate::request::{get_query_param, parse_query_param};

static SERVE_METRICS_COUNT: Lazy<IntCounter> = Lazy::new(|| {
    register_int_counter!(
        "libmetrics_metric_handler_requests_total",
        "Number of metric requests made"
    )
    .expect("failed to define a metric")
});

static X_REQUEST_ID_HEADER_STR: &str = "x-request-id";

static X_REQUEST_ID_HEADER: HeaderName = HeaderName::from_static(X_REQUEST_ID_HEADER_STR);
#[derive(Debug, Default, Clone)]
struct RequestId(String);

/// Adds a tracing info_span! instrumentation around the handler events,
/// logs the request start and end events for non-GET requests and non-200 responses.
///
/// Usage: Replace `my_handler` with `|r| request_span(r, my_handler)`
///
/// Use this to distinguish between logs of different HTTP requests: every request handler wrapped
/// with this will get request info logged in the wrapping span, including the unique request ID.
///
/// This also handles errors, logging them and converting them to an HTTP error response.
///
/// NB: If the client disconnects, Hyper will drop the Future, without polling it to
/// completion. In other words, the handler must be async cancellation safe! request_span
/// prints a warning to the log when that happens, so that you have some trace of it in
/// the log.
///
///
/// There could be other ways to implement similar functionality:
///
/// * procmacros placed on top of all handler methods
///   With all the drawbacks of procmacros, brings no difference implementation-wise,
///   and little code reduction compared to the existing approach.
///
/// * Another `TraitExt` with e.g. the `get_with_span`, `post_with_span` methods to do similar logic,
///   implemented for [`RouterBuilder`].
///   Could be simpler, but we don't want to depend on [`routerify`] more, targeting to use other library later.
///
/// * In theory, a span guard could've been created in a pre-request middleware and placed into a global collection, to be dropped
///   later, in a post-response middleware.
///   Due to suspendable nature of the futures, would give contradictive results which is exactly the opposite of what `tracing-futures`
///   tries to achive with its `.instrument` used in the current approach.
///
/// If needed, a declarative macro to substitute the |r| ... closure boilerplate could be introduced.
pub async fn request_span<R, H>(request: Request<Body>, handler: H) -> R::Output
where
    R: Future<Output = Result<Response<Body>, ApiError>> + Send + 'static,
    H: FnOnce(Request<Body>) -> R + Send + Sync + 'static,
{
    let request_id = request.context::<RequestId>().unwrap_or_default().0;
    let method = request.method();
    let path = request.uri().path();
    let request_span = info_span!("request", %method, %path, %request_id);

    let log_quietly = method == Method::GET;
    async move {
        let cancellation_guard = RequestCancelled::warn_when_dropped_without_responding();
        if log_quietly {
            debug!("Handling request");
        } else {
            info!("Handling request");
        }

        // No special handling for panics here. There's a `tracing_panic_hook` from another
        // module to do that globally.
        let res = handler(request).await;

        cancellation_guard.disarm();

        // Log the result if needed.
        //
        // We also convert any errors into an Ok response with HTTP error code here.
        // `make_router` sets a last-resort error handler that would do the same, but
        // we prefer to do it here, before we exit the request span, so that the error
        // is still logged with the span.
        //
        // (Because we convert errors to Ok response, we never actually return an error,
        // and we could declare the function to return the never type (`!`). However,
        // using `routerify::RouterBuilder` requires a proper error type.)
        match res {
            Ok(response) => {
                let response_status = response.status();
                if log_quietly && response_status.is_success() {
                    debug!("Request handled, status: {response_status}");
                } else {
                    info!("Request handled, status: {response_status}");
                }
                Ok(response)
            }
            Err(err) => Ok(api_error_handler(err)),
        }
    }
    .instrument(request_span)
    .await
}

/// Drop guard to WARN in case the request was dropped before completion.
struct RequestCancelled {
    warn: Option<tracing::Span>,
}

impl RequestCancelled {
    /// Create the drop guard using the [`tracing::Span::current`] as the span.
    fn warn_when_dropped_without_responding() -> Self {
        RequestCancelled {
            warn: Some(tracing::Span::current()),
        }
    }

    /// Consume the drop guard without logging anything.
    fn disarm(mut self) {
        self.warn = None;
    }
}

impl Drop for RequestCancelled {
    fn drop(&mut self) {
        if std::thread::panicking() {
            // we are unwinding due to panicking, assume we are not dropped for cancellation
        } else if let Some(span) = self.warn.take() {
            // the span has all of the info already, but the outer `.instrument(span)` has already
            // been dropped, so we need to manually re-enter it for this message.
            //
            // this is what the instrument would do before polling so it is fine.
            let _g = span.entered();
            warn!("request was dropped before completing");
        }
    }
}

/// An [`std::io::Write`] implementation on top of a channel sending [`bytes::Bytes`] chunks.
pub struct ChannelWriter {
    buffer: BytesMut,
    pub tx: mpsc::Sender<std::io::Result<Bytes>>,
    written: usize,
    /// Time spent waiting for the channel to make progress. It is not the same as time to upload a
    /// buffer because we cannot know anything about that, but this should allow us to understand
    /// the actual time taken without the time spent `std::thread::park`ed.
    wait_time: std::time::Duration,
}

impl ChannelWriter {
    pub fn new(buf_len: usize, tx: mpsc::Sender<std::io::Result<Bytes>>) -> Self {
        assert_ne!(buf_len, 0);
        ChannelWriter {
            // split about half off the buffer from the start, because we flush depending on
            // capacity. first flush will come sooner than without this, but now resizes will
            // have better chance of picking up the "other" half. not guaranteed of course.
            buffer: BytesMut::with_capacity(buf_len).split_off(buf_len / 2),
            tx,
            written: 0,
            wait_time: std::time::Duration::ZERO,
        }
    }

    pub fn flush0(&mut self) -> std::io::Result<usize> {
        let n = self.buffer.len();
        if n == 0 {
            return Ok(0);
        }

        tracing::trace!(n, "flushing");
        let ready = self.buffer.split().freeze();

        let wait_started_at = std::time::Instant::now();

        // not ideal to call from blocking code to block_on, but we are sure that this
        // operation does not spawn_blocking other tasks
        let res: Result<(), ()> = tokio::runtime::Handle::current().block_on(async {
            self.tx.send(Ok(ready)).await.map_err(|_| ())?;

            // throttle sending to allow reuse of our buffer in `write`.
            self.tx.reserve().await.map_err(|_| ())?;

            // now the response task has picked up the buffer and hopefully started
            // sending it to the client.
            Ok(())
        });

        self.wait_time += wait_started_at.elapsed();

        if res.is_err() {
            return Err(std::io::ErrorKind::BrokenPipe.into());
        }
        self.written += n;
        Ok(n)
    }

    pub fn flushed_bytes(&self) -> usize {
        self.written
    }

    pub fn wait_time(&self) -> std::time::Duration {
        self.wait_time
    }
}

impl std::io::Write for ChannelWriter {
    fn write(&mut self, mut buf: &[u8]) -> std::io::Result<usize> {
        let remaining = self.buffer.capacity() - self.buffer.len();

        let out_of_space = remaining < buf.len();

        let original_len = buf.len();

        if out_of_space {
            let can_still_fit = buf.len() - remaining;
            self.buffer.extend_from_slice(&buf[..can_still_fit]);
            buf = &buf[can_still_fit..];
            self.flush0()?;
        }

        // assume that this will often under normal operation just move the pointer back to the
        // beginning of allocation, because previous split off parts are already sent and
        // dropped.
        self.buffer.extend_from_slice(buf);
        Ok(original_len)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.flush0().map(|_| ())
    }
}

pub async fn prometheus_metrics_handler(
    req: Request<Body>,
    force_metric_collection_on_scrape: bool,
) -> Result<Response<Body>, ApiError> {
    SERVE_METRICS_COUNT.inc();

    // HADRON
    let 
```

### Core Architecture Module: `libs/http-utils/src/error.rs`
```
use std::borrow::Cow;
use std::error::Error as StdError;

use hyper::{Body, Response, StatusCode, header};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::{error, info, warn};
use utils::auth::AuthError;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("Bad request: {0:#?}")]
    BadRequest(anyhow::Error),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("NotFound: {0}")]
    NotFound(Box<dyn StdError + Send + Sync + 'static>),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Precondition failed: {0}")]
    PreconditionFailed(Box<str>),

    #[error("Resource temporarily unavailable: {0}")]
    ResourceUnavailable(Cow<'static, str>),

    #[error("Too many requests: {0}")]
    TooManyRequests(Cow<'static, str>),

    #[error("Shutting down")]
    ShuttingDown,

    #[error("Timeout")]
    Timeout(Cow<'static, str>),

    #[error("Request cancelled")]
    Cancelled,

    #[error(transparent)]
    InternalServerError(anyhow::Error),
}

impl ApiError {
    pub fn into_response(self) -> Response<Body> {
        match self {
            ApiError::BadRequest(err) => HttpErrorBody::response_from_msg_and_status(
                format!("{err:#?}"), // use debug printing so that we give the cause
                StatusCode::BAD_REQUEST,
            ),
            ApiError::Forbidden(_) => {
                HttpErrorBody::response_from_msg_and_status(self.to_string(), StatusCode::FORBIDDEN)
            }
            ApiError::Unauthorized(_) => HttpErrorBody::response_from_msg_and_status(
                self.to_string(),
                StatusCode::UNAUTHORIZED,
            ),
            ApiError::NotFound(_) => {
                HttpErrorBody::response_from_msg_and_status(self.to_string(), StatusCode::NOT_FOUND)
            }
            ApiError::Conflict(_) => {
                HttpErrorBody::response_from_msg_and_status(self.to_string(), StatusCode::CONFLICT)
            }
            ApiError::PreconditionFailed(_) => HttpErrorBody::response_from_msg_and_status(
                self.to_string(),
                StatusCode::PRECONDITION_FAILED,
            ),
            ApiError::ShuttingDown => HttpErrorBody::response_from_msg_and_status(
                "Shutting down".to_string(),
                StatusCode::SERVICE_UNAVAILABLE,
            ),
            ApiError::ResourceUnavailable(err) => HttpErrorBody::response_from_msg_and_status(
                err.to_string(),
                StatusCode::SERVICE_UNAVAILABLE,
            ),
            ApiError::TooManyRequests(err) => HttpErrorBody::response_from_msg_and_status(
                err.to_string(),
                StatusCode::TOO_MANY_REQUESTS,
            ),
            ApiError::Timeout(err) => HttpErrorBody::response_from_msg_and_status(
                err.to_string(),
                StatusCode::REQUEST_TIMEOUT,
            ),
            ApiError::Cancelled => HttpErrorBody::response_from_msg_and_status(
                self.to_string(),
                StatusCode::INTERNAL_SERVER_ERROR,
            ),
            ApiError::InternalServerError(err) => HttpErrorBody::response_from_msg_and_status(
                format!("{err:#}"), // use alternative formatting so that we give the cause without backtrace
                StatusCode::INTERNAL_SERVER_ERROR,
            ),
        }
    }
}

impl From<AuthError> for ApiError {
    fn from(_value: AuthError) -> Self {
        // Don't pass on the value of the AuthError as a precautionary measure.
        // Being intentionally vague in public error communication hurts debugability
        // but it is more secure.
        ApiError::Forbidden("JWT authentication error".to_string())
    }
}

#[derive(Serialize, Deserialize)]
pub struct HttpErrorBody {
    pub msg: String,
}

impl HttpErrorBody {
    pub fn from_msg(msg: String) -> Self {
        HttpErrorBody { msg }
    }

    pub fn response_from_msg_and_status(msg: String, status: StatusCode) -> Response<Body> {
        HttpErrorBody { msg }.to_response(status)
    }

    pub fn to_response(&self, status: StatusCode) -> Response<Body> {
        Response::builder()
            .status(status)
            .header(header::CONTENT_TYPE, "application/json")
            // we do not have nested maps with non string keys so serialization shouldn't fail
            .body(Body::from(serde_json::to_string(self).unwrap()))
            .unwrap()
    }
}

pub async fn route_error_handler(err: routerify::RouteError) -> Response<Body> {
    match err.downcast::<ApiError>() {
        Ok(api_error) => api_error_handler(*api_error),
        Err(other_error) => {
            // We expect all the request handlers to return an ApiError, so this should
            // not be reached. But just in case.
            error!("Error processing HTTP request: {other_error:?}");
            HttpErrorBody::response_from_msg_and_status(
                other_error.to_string(),
                StatusCode::INTERNAL_SERVER_ERROR,
            )
        }
    }
}

pub fn api_error_handler(api_error: ApiError) -> Response<Body> {
    // Print a stack trace for Internal Server errors

    match api_error {
        ApiError::Forbidden(_) | ApiError::Unauthorized(_) => {
            warn!("Error processing HTTP request: {api_error:#}")
        }
        ApiError::ResourceUnavailable(_) => info!("Error processing HTTP request: {api_error:#}"),
        ApiError::NotFound(_) => info!("Error processing HTTP request: {api_error:#}"),
        ApiError::InternalServerError(_) => error!("Error processing HTTP request: {api_error:?}"),
        ApiError::ShuttingDown => info!("Shut down while processing HTTP request"),
        ApiError::Timeout(_) => info!("Timeout while processing HTTP request: {api_error:#}"),
        ApiError::Cancelled => info!("Request cancelled while processing HTTP request"),
        _ => info!("Error processing HTTP request: {api_error:#}"),
    }

    api_error.into_response()
}

```

### Core Architecture Module: `libs/http-utils/src/failpoints.rs`
```
use hyper::{Body, Request, Response, StatusCode};
use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;
use utils::failpoint_support::apply_failpoint;

use crate::error::ApiError;
use crate::json::{json_request, json_response};

pub type ConfigureFailpointsRequest = Vec<FailpointConfig>;

/// Information for configuring a single fail point
#[derive(Debug, Serialize, Deserialize)]
pub struct FailpointConfig {
    /// Name of the fail point
    pub name: String,
    /// List of actions to take, using the format described in `fail::cfg`
    ///
    /// We also support `actions = "exit"` to cause the fail point to immediately exit.
    pub actions: String,
}

/// Configure failpoints through http.
pub async fn failpoints_handler(
    mut request: Request<Body>,
    _cancel: CancellationToken,
) -> Result<Response<Body>, ApiError> {
    if !fail::has_failpoints() {
        return Err(ApiError::BadRequest(anyhow::anyhow!(
            "Cannot manage failpoints because neon was compiled without failpoints support"
        )));
    }

    let failpoints: ConfigureFailpointsRequest = json_request(&mut request).await?;
    for fp in failpoints {
        tracing::info!("cfg failpoint: {} {}", fp.name, fp.actions);

        // We recognize one extra "action" that's not natively recognized
        // by the failpoints crate: exit, to immediately kill the process
        let cfg_result = apply_failpoint(&fp.name, &fp.actions);

        if let Err(err_msg) = cfg_result {
            return Err(ApiError::BadRequest(anyhow::anyhow!(
                "Failed to configure failpoints: {err_msg}"
            )));
        }
    }

    json_response(StatusCode::OK, ())
}

```

### Core Architecture Module: `libs/http-utils/src/json.rs`
```
use anyhow::Context;
use bytes::Buf;
use hyper::{Body, Request, Response, StatusCode, header};
use serde::{Deserialize, Serialize};

use super::error::ApiError;

/// Parse a json request body and deserialize it to the type `T`.
pub async fn json_request<T: for<'de> Deserialize<'de>>(
    request: &mut Request<Body>,
) -> Result<T, ApiError> {
    let body = hyper::body::aggregate(request.body_mut())
        .await
        .context("Failed to read request body")
        .map_err(ApiError::BadRequest)?;

    if body.remaining() == 0 {
        return Err(ApiError::BadRequest(anyhow::anyhow!(
            "missing request body"
        )));
    }

    let mut deser = serde_json::de::Deserializer::from_reader(body.reader());

    serde_path_to_error::deserialize(&mut deser)
        // intentionally stringify because the debug version is not helpful in python logs
        .map_err(|e| anyhow::anyhow!("Failed to parse json request: {e}"))
        .map_err(ApiError::BadRequest)
}

/// Parse a json request body and deserialize it to the type `T`. If the body is empty, return `T::default`.
pub async fn json_request_maybe<T: for<'de> Deserialize<'de> + Default>(
    request: &mut Request<Body>,
) -> Result<T, ApiError> {
    let body = hyper::body::aggregate(request.body_mut())
        .await
        .context("Failed to read request body")
        .map_err(ApiError::BadRequest)?;

    if body.remaining() == 0 {
        return Ok(T::default());
    }

    let mut deser = serde_json::de::Deserializer::from_reader(body.reader());

    serde_path_to_error::deserialize(&mut deser)
        // intentionally stringify because the debug version is not helpful in python logs
        .map_err(|e| anyhow::anyhow!("Failed to parse json request: {e}"))
        .map_err(ApiError::BadRequest)
}

pub fn json_response<T: Serialize>(
    status: StatusCode,
    data: T,
) -> Result<Response<Body>, ApiError> {
    let json = serde_json::to_string(&data)
        .context("Failed to serialize JSON response")
        .map_err(ApiError::InternalServerError)?;
    let response = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json))
        .map_err(|e| ApiError::InternalServerError(e.into()))?;
    Ok(response)
}

```

### Core Architecture Module: `libs/http-utils/src/lib.rs`
```
pub mod endpoint;
pub mod error;
pub mod failpoints;
pub mod json;
pub mod request;
pub mod server;
pub mod tls_certs;

extern crate hyper0 as hyper;

/// Current fast way to apply simple http routing in various Neon binaries.
/// Re-exported for sake of uniform approach, that could be later replaced with better alternatives, if needed.
pub use routerify::{RequestServiceBuilder, RouterBuilder, RouterService, ext::RequestExt};

```

### Core Architecture Module: `libs/http-utils/src/request.rs`
```
use core::fmt;
use std::borrow::Cow;
use std::str::FromStr;

use anyhow::anyhow;
use hyper::body::HttpBody;
use hyper::{Body, Request};
use routerify::ext::RequestExt;

use super::error::ApiError;

pub fn get_request_param<'a>(
    request: &'a Request<Body>,
    param_name: &str,
) -> Result<&'a str, ApiError> {
    match request.param(param_name) {
        Some(arg) => Ok(arg),
        None => Err(ApiError::BadRequest(anyhow!(
            "no {param_name} specified in path param",
        ))),
    }
}

pub fn parse_request_param<T: FromStr>(
    request: &Request<Body>,
    param_name: &str,
) -> Result<T, ApiError> {
    match get_request_param(request, param_name)?.parse() {
        Ok(v) => Ok(v),
        Err(_) => Err(ApiError::BadRequest(anyhow!(
            "failed to parse {param_name}",
        ))),
    }
}

pub fn get_query_param<'a>(
    request: &'a Request<Body>,
    param_name: &str,
) -> Result<Option<Cow<'a, str>>, ApiError> {
    let query = match request.uri().query() {
        Some(q) => q,
        None => return Ok(None),
    };
    let values = url::form_urlencoded::parse(query.as_bytes())
        .filter_map(|(k, v)| if k == param_name { Some(v) } else { None })
        // we call .next() twice below. If it's None the first time, .fuse() ensures it's None afterwards
        .fuse();

    // Work around an issue with Alloy's pyroscope scrape where the "seconds"
    // parameter is added several times. https://github.com/grafana/alloy/issues/3026
    // TODO: revert after Alloy is fixed.
    let value1 = values
        .map(Ok)
        .reduce(|acc, i| {
            match acc {
                Err(_) => acc,

                // It's okay to have duplicates as along as they have the same value.
                Ok(ref a) if a == &i.unwrap() => acc,

                _ => Err(ApiError::BadRequest(anyhow!(
                    "param {param_name} specified more than once"
                ))),
            }
        })
        .transpose()?;
    // if values.next().is_some() {
    //     return Err(ApiError::BadRequest(anyhow!(
    //         "param {param_name} specified more than once"
    //     )));
    // }

    Ok(value1)
}

pub fn must_get_query_param<'a>(
    request: &'a Request<Body>,
    param_name: &str,
) -> Result<Cow<'a, str>, ApiError> {
    get_query_param(request, param_name)?.ok_or_else(|| {
        ApiError::BadRequest(anyhow!("no {param_name} specified in query parameters"))
    })
}

pub fn parse_query_param<E: fmt::Display, T: FromStr<Err = E>>(
    request: &Request<Body>,
    param_name: &str,
) -> Result<Option<T>, ApiError> {
    get_query_param(request, param_name)?
        .map(|v| {
            v.parse().map_err(|e| {
                ApiError::BadRequest(anyhow!("cannot parse query param {param_name}: {e}"))
            })
        })
        .transpose()
}

pub fn must_parse_query_param<E: fmt::Display, T: FromStr<Err = E>>(
    request: &Request<Body>,
    param_name: &str,
) -> Result<T, ApiError> {
    parse_query_param(request, param_name)?.ok_or_else(|| {
        ApiError::BadRequest(anyhow!("no {param_name} specified in query parameters"))
    })
}

pub async fn ensure_no_body(request: &mut Request<Body>) -> Result<(), ApiError> {
    match request.body_mut().data().await {
        Some(_) => Err(ApiError::BadRequest(anyhow!("Unexpected request body"))),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_query_param_duplicate() {
        let req = Request::builder()
            .uri("http://localhost:12345/testuri?testparam=1")
            .body(hyper::Body::empty())
            .unwrap();
        let value = get_query_param(&req, "testparam").unwrap();
        assert_eq!(value.unwrap(), "1");

        let req = Request::builder()
            .uri("http://localhost:12345/testuri?testparam=1&testparam=1")
            .body(hyper::Body::empty())
            .unwrap();
        let value = get_query_param(&req, "testparam").unwrap();
        assert_eq!(value.unwrap(), "1");

        let req = Request::builder()
            .uri("http://localhost:12345/testuri")
            .body(hyper::Body::empty())
            .unwrap();
        let value = get_query_param(&req, "testparam").unwrap();
        assert!(value.is_none());

        let req = Request::builder()
            .uri("http://localhost:12345/testuri?testparam=1&testparam=2&testparam=3")
            .body(hyper::Body::empty())
            .unwrap();
        let value = get_query_param(&req, "testparam");
        assert!(value.is_err());
    }
}

```

### Core Architecture Module: `libs/http-utils/src/server.rs`
```
use std::{error::Error, sync::Arc};

use futures::StreamExt;
use futures::stream::FuturesUnordered;
use hyper0::Body;
use hyper0::server::conn::Http;
use metrics::{IntCounterVec, register_int_counter_vec};
use once_cell::sync::Lazy;
use routerify::{RequestService, RequestServiceBuilder};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio_rustls::TlsAcceptor;
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

use crate::error::ApiError;

/// A simple HTTP server over hyper library.
/// You may want to use it instead of [`hyper0::server::Server`] because:
/// 1. hyper0's Server was removed from hyper v1.
///    It's recommended to replace hyepr0's Server with a manual loop, which is done here.
/// 2. hyper0's Server doesn't support TLS out of the box, and there is no way
///    to support it efficiently with the Accept trait that hyper0's Server uses.
///    That's one of the reasons why it was removed from v1.
///    <https://github.com/hyperium/hyper/blob/115339d3df50f20c8717680aa35f48858e9a6205/docs/ROADMAP.md#higher-level-client-and-server-problems>
pub struct Server {
    request_service: Arc<RequestServiceBuilder<Body, ApiError>>,
    listener: tokio::net::TcpListener,
    tls_acceptor: Option<TlsAcceptor>,
}

static CONNECTION_STARTED_COUNT: Lazy<IntCounterVec> = Lazy::new(|| {
    register_int_counter_vec!(
        "http_server_connection_started_total",
        "Number of established http/https connections",
        &["scheme"]
    )
    .expect("failed to define a metric")
});

static CONNECTION_ERROR_COUNT: Lazy<IntCounterVec> = Lazy::new(|| {
    register_int_counter_vec!(
        "http_server_connection_errors_total",
        "Number of occured connection errors by type",
        &["type"]
    )
    .expect("failed to define a metric")
});

impl Server {
    pub fn new(
        request_service: Arc<RequestServiceBuilder<Body, ApiError>>,
        listener: std::net::TcpListener,
        tls_acceptor: Option<TlsAcceptor>,
    ) -> anyhow::Result<Self> {
        // Note: caller of from_std is responsible for setting nonblocking mode.
        listener.set_nonblocking(true)?;
        let listener = tokio::net::TcpListener::from_std(listener)?;

        Ok(Self {
            request_service,
            listener,
            tls_acceptor,
        })
    }

    pub async fn serve(self, cancel: CancellationToken) -> anyhow::Result<()> {
        fn suppress_io_error(err: &std::io::Error) -> bool {
            use std::io::ErrorKind::*;
            matches!(err.kind(), ConnectionReset | ConnectionAborted | BrokenPipe)
        }
        fn suppress_hyper_error(err: &hyper0::Error) -> bool {
            if err.is_incomplete_message() || err.is_closed() || err.is_timeout() {
                return true;
            }
            if let Some(inner) = err.source()
                && let Some(io) = inner.downcast_ref::<std::io::Error>()
            {
                return suppress_io_error(io);
            }
            false
        }

        let tcp_error_cnt = CONNECTION_ERROR_COUNT.with_label_values(&["tcp"]);
        let tls_error_cnt = CONNECTION_ERROR_COUNT.with_label_values(&["tls"]);
        let http_error_cnt = CONNECTION_ERROR_COUNT.with_label_values(&["http"]);
        let https_error_cnt = CONNECTION_ERROR_COUNT.with_label_values(&["https"]);
        let panic_error_cnt = CONNECTION_ERROR_COUNT.with_label_values(&["panic"]);

        let http_connection_cnt = CONNECTION_STARTED_COUNT.with_label_values(&["http"]);
        let https_connection_cnt = CONNECTION_STARTED_COUNT.with_label_values(&["https"]);

        let mut connections = FuturesUnordered::new();
        loop {
            tokio::select! {
                stream = self.listener.accept() => {
                    let (tcp_stream, remote_addr) = match stream {
                        Ok(stream) => stream,
                        Err(err) => {
                            tcp_error_cnt.inc();
                            if !suppress_io_error(&err) {
                                info!("Failed to accept TCP connection: {err:#}");
                            }
                            continue;
                        }
                    };

                    let service = self.request_service.build(remote_addr);
                    let tls_acceptor = self.tls_acceptor.clone();
                    let cancel = cancel.clone();

                    let tls_error_cnt = tls_error_cnt.clone();
                    let http_error_cnt = http_error_cnt.clone();
                    let https_error_cnt = https_error_cnt.clone();
                    let http_connection_cnt = http_connection_cnt.clone();
                    let https_connection_cnt = https_connection_cnt.clone();

                    connections.push(tokio::spawn(
                        async move {
                            match tls_acceptor {
                                Some(tls_acceptor) => {
                                    // Handle HTTPS connection.
                                    https_connection_cnt.inc();
                                    let tls_stream = tokio::select! {
                                        tls_stream = tls_acceptor.accept(tcp_stream) => tls_stream,
                                        _ = cancel.cancelled() => return,
                                    };
                                    let tls_stream = match tls_stream {
                                        Ok(tls_stream) => tls_stream,
                                        Err(err) => {
                                            tls_error_cnt.inc();
                                            if !suppress_io_error(&err) {
                                                info!(%remote_addr, "Failed to accept TLS connection: {err:#}");
                                            }
                                            return;
                                        }
                                    };
                                    if let Err(err) = Self::serve_connection(tls_stream, service, cancel).await {
                                        https_error_cnt.inc();
                                        if !suppress_hyper_error(&err) {
                                            info!(%remote_addr, "Failed to serve HTTPS connection: {err:#}");
                                        }
                                    }
                                }
                                None => {
                                    // Handle HTTP connection.
                                    http_connection_cnt.inc();
                                    if let Err(err) = Self::serve_connection(tcp_stream, service, cancel).await {
                                        http_error_cnt.inc();
                                        if !suppress_hyper_error(&err) {
                                            info!(%remote_addr, "Failed to serve HTTP connection: {err:#}");
                                        }
                                    }
                                }
                            };
                        }));
                 }
                Some(conn) = connections.next() => {
                    if let Err(err) = conn {
                        panic_error_cnt.inc();
                        error!("Connection panicked: {err:#}");
                    }
                }
                _ = cancel.cancelled() => {
                    // Wait for graceful shutdown of all connections.
                    while let Some(conn) = connections.next().await {
                        if let Err(err) = conn {
                            panic_error_cnt.inc();
                            error!("Connection panicked: {err:#}");
                        }
                    }
                    break;
                }
            }
        }
        Ok(())
    }

    /// Serves HTTP connection with graceful shutdown.
    async fn serve_connection<I>(
        io: I,
        service: RequestService<Body, ApiError>,
        cancel: CancellationToken,
    ) -> Result<(), hyper0::Error>
    where
        I: AsyncRead + AsyncWrite + Unpin + Send + 'static,
    {
        let mut conn = Http::new().serve_connection(io, service).with_upgrades();

        tokio::select! {
            res = &mut conn => res,
            _ = cancel.cancelled() => {
                Pin::new(&mut conn).graceful_shutdown();
                // Note: connection should still be awaited for graceful shutdown to complete.
                conn.await
            }
        }
    }
}

```

### Core Architecture Module: `libs/http-utils/src/tls_certs.rs`
```
use std::{sync::Arc, time::Duration};

use anyhow::Context;
use arc_swap::ArcSwap;
use camino::Utf8Path;
use metrics::{IntCounterVec, UIntGaugeVec, register_int_counter_vec, register_uint_gauge_vec};
use once_cell::sync::Lazy;
use rustls::{
    pki_types::{CertificateDer, PrivateKeyDer, UnixTime},
    server::{ClientHello, ResolvesServerCert},
    sign::CertifiedKey,
};
use x509_cert::der::Reader;

pub async fn load_cert_chain(filename: &Utf8Path) -> anyhow::Result<Vec<CertificateDer<'static>>> {
    let cert_data = tokio::fs::read(filename)
        .await
        .context(format!("failed reading certificate file {filename:?}"))?;
    let mut reader = std::io::Cursor::new(&cert_data);

    let cert_chain = rustls_pemfile::certs(&mut reader)
        .collect::<Result<Vec<_>, _>>()
        .context(format!("failed parsing certificate from file {filename:?}"))?;

    Ok(cert_chain)
}

pub async fn load_private_key(filename: &Utf8Path) -> anyhow::Result<PrivateKeyDer<'static>> {
    let key_data = tokio::fs::read(filename)
        .await
        .context(format!("failed reading private key file {filename:?}"))?;
    let mut reader = std::io::Cursor::new(&key_data);

    let key = rustls_pemfile::private_key(&mut reader)
        .context(format!("failed parsing private key from file {filename:?}"))?;

    key.ok_or(anyhow::anyhow!(
        "no private key found in {}",
        filename.as_str(),
    ))
}

pub async fn load_certified_key(
    key_filename: &Utf8Path,
    cert_filename: &Utf8Path,
) -> anyhow::Result<CertifiedKey> {
    let cert_chain = load_cert_chain(cert_filename).await?;
    let key = load_private_key(key_filename).await?;

    let key = rustls::crypto::ring::default_provider()
        .key_provider
        .load_private_key(key)?;

    let certified_key = CertifiedKey::new(cert_chain, key);
    certified_key.keys_match()?;
    Ok(certified_key)
}

/// rustls's CertifiedKey with extra parsed fields used for metrics.
struct ParsedCertifiedKey {
    certified_key: CertifiedKey,
    expiration_time: UnixTime,
}

/// Parse expiration time from an X509 certificate.
fn parse_expiration_time(cert: &CertificateDer<'_>) -> anyhow::Result<UnixTime> {
    let parsed_cert = x509_cert::der::SliceReader::new(cert)
        .context("Failed to parse cerficiate")?
        .decode::<x509_cert::Certificate>()
        .context("Failed to parse cerficiate")?;

    Ok(UnixTime::since_unix_epoch(
        parsed_cert
            .tbs_certificate
            .validity
            .not_after
            .to_unix_duration(),
    ))
}

async fn load_and_parse_certified_key(
    key_filename: &Utf8Path,
    cert_filename: &Utf8Path,
) -> anyhow::Result<ParsedCertifiedKey> {
    let certified_key = load_certified_key(key_filename, cert_filename).await?;
    let expiration_time = parse_expiration_time(certified_key.end_entity_cert()?)?;
    Ok(ParsedCertifiedKey {
        certified_key,
        expiration_time,
    })
}

static CERT_EXPIRATION_TIME: Lazy<UIntGaugeVec> = Lazy::new(|| {
    register_uint_gauge_vec!(
        "tls_certs_expiration_time_seconds",
        "Expiration time of the loaded certificate since unix epoch in seconds",
        &["resolver_name"]
    )
    .expect("failed to define a metric")
});

static CERT_RELOAD_STARTED_COUNTER: Lazy<IntCounterVec> = Lazy::new(|| {
    register_int_counter_vec!(
        "tls_certs_reload_started_total",
        "Number of certificate reload loop iterations started",
        &["resolver_name"]
    )
    .expect("failed to define a metric")
});

static CERT_RELOAD_UPDATED_COUNTER: Lazy<IntCounterVec> = Lazy::new(|| {
    register_int_counter_vec!(
        "tls_certs_reload_updated_total",
        "Number of times the certificate was updated to the new one",
        &["resolver_name"]
    )
    .expect("failed to define a metric")
});

static CERT_RELOAD_FAILED_COUNTER: Lazy<IntCounterVec> = Lazy::new(|| {
    register_int_counter_vec!(
        "tls_certs_reload_failed_total",
        "Number of times the certificate reload failed",
        &["resolver_name"]
    )
    .expect("failed to define a metric")
});

/// Implementation of [`rustls::server::ResolvesServerCert`] which reloads certificates from
/// the disk periodically.
#[derive(Debug)]
pub struct ReloadingCertificateResolver {
    certified_key: ArcSwap<CertifiedKey>,
}

impl ReloadingCertificateResolver {
    /// Creates a new Resolver by loading certificate and private key from FS and
    /// creating tokio::task to reload them with provided reload_period.
    /// resolver_name is used as metric's label.
    pub async fn new(
        resolver_name: &str,
        key_filename: &Utf8Path,
        cert_filename: &Utf8Path,
        reload_period: Duration,
    ) -> anyhow::Result<Arc<Self>> {
        // Create metrics for current resolver.
        let cert_expiration_time = CERT_EXPIRATION_TIME.with_label_values(&[resolver_name]);
        let cert_reload_started_counter =
            CERT_RELOAD_STARTED_COUNTER.with_label_values(&[resolver_name]);
        let cert_reload_updated_counter =
            CERT_RELOAD_UPDATED_COUNTER.with_label_values(&[resolver_name]);
        let cert_reload_failed_counter =
            CERT_RELOAD_FAILED_COUNTER.with_label_values(&[resolver_name]);

        let parsed_key = load_and_parse_certified_key(key_filename, cert_filename).await?;

        let this = Arc::new(Self {
            certified_key: ArcSwap::from_pointee(parsed_key.certified_key),
        });
        cert_expiration_time.set(parsed_key.expiration_time.as_secs());

        tokio::spawn({
            let weak_this = Arc::downgrade(&this);
            let key_filename = key_filename.to_owned();
            let cert_filename = cert_filename.to_owned();
            async move {
                let start = tokio::time::Instant::now() + reload_period;
                let mut interval = tokio::time::interval_at(start, reload_period);
                let mut last_reload_failed = false;
                loop {
                    interval.tick().await;
                    let this = match weak_this.upgrade() {
                        Some(this) => this,
                        None => break, // Resolver has been destroyed, exit.
                    };
                    cert_reload_started_counter.inc();

                    match load_and_parse_certified_key(&key_filename, &cert_filename).await {
                        Ok(parsed_key) => {
                            if parsed_key.certified_key.cert == this.certified_key.load().cert {
                                tracing::debug!("Certificate has not changed since last reloading");
                            } else {
                                tracing::info!("Certificate has been reloaded");
                                this.certified_key.store(Arc::new(parsed_key.certified_key));
                                cert_expiration_time.set(parsed_key.expiration_time.as_secs());
                                cert_reload_updated_counter.inc();
                            }
                            last_reload_failed = false;
                        }
                        Err(err) => {
                            cert_reload_failed_counter.inc();
                            // Note: Reloading certs may fail if it conflicts with the script updating
                            // the files at the same time. Warn only if the error is persistent.
                            if last_reload_failed {
                                tracing::warn!("Error reloading certificate: {err:#}");
                            } else {
                                tracing::info!("Error reloading certificate: {err:#}");
                            }
                            last_reload_failed = true;
                        }
                    }
                }
            }
        });

        Ok(this)
    }
}

impl ResolvesServerCert for ReloadingCertificateResolver {
    fn resolve(&self, _client_hello: ClientHello<'_>) -> Option<Arc<CertifiedKey>> {
        Some(self.certified_key.load_full())
    }
}

```

### Core Architecture Module: `libs/neon-shmem/src/hash/core.rs`
```
//! Simple hash table with chaining.

use std::hash::Hash;
use std::mem::MaybeUninit;

use crate::hash::entry::*;

/// Invalid position within the map (either within the dictionary or bucket array).
pub(crate) const INVALID_POS: u32 = u32::MAX;

/// Fundamental storage unit within the hash table. Either empty or contains a key-value pair.
/// Always part of a chain of some kind (either a freelist if empty or a hash chain if full).
pub(crate) struct Bucket<K, V> {
    /// Index of next bucket in the chain.
    pub(crate) next: u32,
    /// Key-value pair contained within bucket.
    pub(crate) inner: Option<(K, V)>,
}

/// Core hash table implementation.
pub(crate) struct CoreHashMap<'a, K, V> {
    /// Dictionary used to map hashes to bucket indices.
    pub(crate) dictionary: &'a mut [u32],
    /// Buckets containing key-value pairs.
    pub(crate) buckets: &'a mut [Bucket<K, V>],
    /// Head of the freelist.
    pub(crate) free_head: u32,
    /// Maximum index of a bucket allowed to be allocated. [`INVALID_POS`] if no limit.
    pub(crate) alloc_limit: u32,
    /// The number of currently occupied buckets.
    pub(crate) buckets_in_use: u32,
}

/// Error for when there are no empty buckets left but one is needed.
#[derive(Debug, PartialEq)]
pub struct FullError;

impl<'a, K: Clone + Hash + Eq, V> CoreHashMap<'a, K, V> {
    const FILL_FACTOR: f32 = 0.60;

    /// Estimate the size of data contained within the the hash map.
    pub fn estimate_size(num_buckets: u32) -> usize {
        let mut size = 0;

        // buckets
        size += size_of::<Bucket<K, V>>() * num_buckets as usize;

        // dictionary
        size += (f32::ceil((size_of::<u32>() * num_buckets as usize) as f32 / Self::FILL_FACTOR))
            as usize;

        size
    }

    pub fn new(
        buckets: &'a mut [MaybeUninit<Bucket<K, V>>],
        dictionary: &'a mut [MaybeUninit<u32>],
    ) -> Self {
        // Initialize the buckets
        for i in 0..buckets.len() {
            buckets[i].write(Bucket {
                next: if i < buckets.len() - 1 {
                    i as u32 + 1
                } else {
                    INVALID_POS
                },
                inner: None,
            });
        }

        // Initialize the dictionary
        for e in dictionary.iter_mut() {
            e.write(INVALID_POS);
        }

        // TODO: use std::slice::assume_init_mut() once it stabilizes
        let buckets =
            unsafe { std::slice::from_raw_parts_mut(buckets.as_mut_ptr().cast(), buckets.len()) };
        let dictionary = unsafe {
            std::slice::from_raw_parts_mut(dictionary.as_mut_ptr().cast(), dictionary.len())
        };

        Self {
            dictionary,
            buckets,
            free_head: 0,
            buckets_in_use: 0,
            alloc_limit: INVALID_POS,
        }
    }

    /// Get the value associated with a key (if it exists) given its hash.
    pub fn get_with_hash(&self, key: &K, hash: u64) -> Option<&V> {
        let mut next = self.dictionary[hash as usize % self.dictionary.len()];
        loop {
            if next == INVALID_POS {
                return None;
            }

            let bucket = &self.buckets[next as usize];
            let (bucket_key, bucket_value) = bucket.inner.as_ref().expect("entry is in use");
            if bucket_key == key {
                return Some(bucket_value);
            }
            next = bucket.next;
        }
    }

    /// Get number of buckets in map.
    pub fn get_num_buckets(&self) -> usize {
        self.buckets.len()
    }

    /// Clears all entries from the hashmap.
    ///
    /// Does not reset any allocation limits, but does clear any entries beyond them.
    pub fn clear(&mut self) {
        for i in 0..self.buckets.len() {
            self.buckets[i] = Bucket {
                next: if i < self.buckets.len() - 1 {
                    i as u32 + 1
                } else {
                    INVALID_POS
                },
                inner: None,
            }
        }
        for i in 0..self.dictionary.len() {
            self.dictionary[i] = INVALID_POS;
        }

        self.free_head = 0;
        self.buckets_in_use = 0;
    }

    /// Find the position of an unused bucket via the freelist and initialize it.
    pub(crate) fn alloc_bucket(&mut self, key: K, value: V) -> Result<u32, FullError> {
        let mut pos = self.free_head;

        // Find the first bucket we're *allowed* to use.
        let mut prev = PrevPos::First(self.free_head);
        while pos != INVALID_POS && pos >= self.alloc_limit {
            let bucket = &mut self.buckets[pos as usize];
            prev = PrevPos::Chained(pos);
            pos = bucket.next;
        }
        if pos == INVALID_POS {
            return Err(FullError);
        }

        // Repair the freelist.
        match prev {
            PrevPos::First(_) => {
                let next_pos = self.buckets[pos as usize].next;
                self.free_head = next_pos;
            }
            PrevPos::Chained(p) => {
                if p != INVALID_POS {
                    let next_pos = self.buckets[pos as usize].next;
                    self.buckets[p as usize].next = next_pos;
                }
            }
            _ => unreachable!(),
        }

        // Initialize the bucket.
        let bucket = &mut self.buckets[pos as usize];
        self.buckets_in_use += 1;
        bucket.next = INVALID_POS;
        bucket.inner = Some((key, value));

        Ok(pos)
    }
}

```

### Core Architecture Module: `libs/pageserver_api/src/models/utilization.rs`
```
use std::time::SystemTime;

use utils::serde_percent::Percent;
use utils::serde_system_time;

/// Pageserver current utilization and scoring for how good candidate the pageserver would be for
/// the next tenant.
///
/// See and maintain pageserver openapi spec for `/v1/utilization_score` as the truth.
///
/// `format: int64` fields must use `ser_saturating_u63` because openapi generated clients might
/// not handle full u64 values properly.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PageserverUtilization {
    /// Used disk space (physical, ground truth from statfs())
    #[serde(serialize_with = "ser_saturating_u63")]
    pub disk_usage_bytes: u64,
    /// Free disk space
    #[serde(serialize_with = "ser_saturating_u63")]
    pub free_space_bytes: u64,

    /// Wanted disk space, based on the tenant shards currently present on this pageserver: this
    /// is like disk_usage_bytes, but it is stable and does not change with the cache state of
    /// tenants, whereas disk_usage_bytes may reach the disk eviction `max_usage_pct` and stay
    /// there, or may be unrealistically low if the pageserver has attached tenants which haven't
    /// downloaded layers yet.
    #[serde(serialize_with = "ser_saturating_u63", default)]
    pub disk_wanted_bytes: u64,

    // What proportion of total disk space will this pageserver use before it starts evicting data?
    #[serde(default = "unity_percent")]
    pub disk_usable_pct: Percent,

    // How many shards are currently on this node?
    #[serde(default)]
    pub shard_count: u32,

    // How many shards should this node be able to handle at most?
    #[serde(default)]
    pub max_shard_count: u32,

    /// Cached result of [`Self::score`]
    pub utilization_score: Option<u64>,

    /// When was this snapshot captured, pageserver local time.
    ///
    /// Use millis to give confidence that the value is regenerated often enough.
    pub captured_at: serde_system_time::SystemTime,
}

fn unity_percent() -> Percent {
    Percent::new(0).unwrap()
}

pub type RawScore = u64;

impl PageserverUtilization {
    const UTILIZATION_FULL: u64 = 1000000;

    /// Calculate a utilization score.  The result is to be inrepreted as a fraction of
    /// Self::UTILIZATION_FULL.
    ///
    /// Lower values are more affine to scheduling more work on this node.
    /// - UTILIZATION_FULL represents an ideal node which is fully utilized but should not receive any more work.
    /// - 0.0 represents an empty node.
    /// - Negative values are forbidden
    /// - Values over UTILIZATION_FULL indicate an overloaded node, which may show degraded performance due to
    ///   layer eviction.
    pub fn score(&self) -> RawScore {
        let disk_usable_capacity = ((self.disk_usage_bytes + self.free_space_bytes)
            * self.disk_usable_pct.get() as u64)
            / 100;
        let disk_utilization_score =
            self.disk_wanted_bytes * Self::UTILIZATION_FULL / disk_usable_capacity;

        let shard_utilization_score =
            self.shard_count as u64 * Self::UTILIZATION_FULL / self.max_shard_count as u64;
        std::cmp::max(disk_utilization_score, shard_utilization_score)
    }

    pub fn cached_score(&mut self) -> RawScore {
        match self.utilization_score {
            None => {
                let s = self.score();
                self.utilization_score = Some(s);
                s
            }
            Some(s) => s,
        }
    }

    /// If a node is currently hosting more work than it can comfortably handle.  This does not indicate that
    /// it will fail, but it is a strong signal that more work should not be added unless there is no alternative.
    ///
    /// When a node is overloaded, we may override soft affinity preferences and do things like scheduling
    /// into a node in a less desirable AZ, if all the nodes in the preferred AZ are overloaded.
    pub fn is_overloaded(score: RawScore) -> bool {
        // Why the factor of two?  This is unscientific but reflects behavior of real systems:
        // - In terms of shard counts, a node's preferred max count is a soft limit intended to keep
        //   startup and housekeeping jobs nice and responsive.  We can go to double this limit if needed
        //   until some more nodes are deployed.
        // - In terms of disk space, the node's utilization heuristic assumes every tenant needs to
        //   hold its biggest timeline fully on disk, which is tends to be an over estimate when
        //   some tenants are very idle and have dropped layers from disk.  In practice going up to
        //   double is generally better than giving up and scheduling in a sub-optimal AZ.
        score >= 2 * Self::UTILIZATION_FULL
    }

    pub fn adjust_shard_count_max(&mut self, shard_count: u32) {
        if self.shard_count < shard_count {
            self.shard_count = shard_count;

            // Dirty cache: this will be calculated next time someone retrives the score
            self.utilization_score = None;
        }
    }

    /// A utilization structure that has a full utilization score: use this as a placeholder when
    /// you need a utilization but don't have real values yet.
    pub fn full() -> Self {
        Self {
            disk_usage_bytes: 1,
            free_space_bytes: 0,
            disk_wanted_bytes: 1,
            disk_usable_pct: Percent::new(100).unwrap(),
            shard_count: 1,
            max_shard_count: 1,
            utilization_score: Some(Self::UTILIZATION_FULL),
            captured_at: serde_system_time::SystemTime(SystemTime::now()),
        }
    }
}

/// Test helper
pub mod test_utilization {
    use std::time::SystemTime;

    use utils::serde_percent::Percent;
    use utils::serde_system_time::{self};

    use super::PageserverUtilization;

    // Parameters of the imaginary node used for test utilization instances
    const TEST_DISK_SIZE: u64 = 1024 * 1024 * 1024 * 1024;
    const TEST_SHARDS_MAX: u32 = 1000;

    /// Unit test helper.  Unconditionally compiled because cfg(test) doesn't carry across crates.  Do
    /// not abuse this function from non-test code.
    ///
    /// Emulates a node with a 1000 shard limit and a 1TB disk.
    pub fn simple(shard_count: u32, disk_wanted_bytes: u64) -> PageserverUtilization {
        PageserverUtilization {
            disk_usage_bytes: disk_wanted_bytes,
            free_space_bytes: TEST_DISK_SIZE - std::cmp::min(disk_wanted_bytes, TEST_DISK_SIZE),
            disk_wanted_bytes,
            disk_usable_pct: Percent::new(100).unwrap(),
            shard_count,
            max_shard_count: TEST_SHARDS_MAX,
            utilization_score: None,
            captured_at: serde_system_time::SystemTime(SystemTime::now()),
        }
    }
}

/// openapi knows only `format: int64`, so avoid outputting a non-parseable value by generated clients.
///
/// Instead of newtype, use this because a newtype would get require handling deserializing values
/// with the highest bit set which is properly parsed by serde formats, but would create a
/// conundrum on how to handle and again serialize such values at type level. It will be a few
/// years until we can use more than `i64::MAX` bytes on a disk.
fn ser_saturating_u63<S: serde::Serializer>(value: &u64, serializer: S) -> Result<S::Ok, S::Error> {
    const MAX_FORMAT_INT64: u64 = i64::MAX as u64;

    let value = (*value).min(MAX_FORMAT_INT64);

    serializer.serialize_u64(value)
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;

    #[test]
    fn u64_max_is_serialized_as_u63_max() {
        let doc = PageserverUtilization {
            disk_usage_bytes: u64::MAX,
            free_space_bytes: 0,
            disk_wanted_bytes: u64::MAX,
            utilization_score: Some(13),
            disk_usable_pct: Percent::new(90).unwrap(),
            shard_count: 100,
            max_shard_count: 200,
            captured_at: serde_system_time::SystemTime(
                std::time::SystemTime::UNIX_EPOCH + Duration::from_secs(1708509779),
            ),
        };

        let s = serde_json::to_string(&doc).unwrap();

        let expected = "{\"disk_usage_bytes\":9223372036854775807,\"free_space_bytes\":0,\"disk_wanted_bytes\":9223372036854775807,\"disk_usable_pct\":90,\"shard_count\":100,\"max_shard_count\":200,\"utilization_score\":13,\"captured_at\":\"2024-02-21T10:02:59.000Z\"}";

        assert_eq!(s, expected);
    }
}

```

### Core Architecture Module: `libs/postgres_ffi/src/controlfile_utils.rs`
```
//!
//! Utilities for reading and writing the PostgreSQL control file.
//!
//! The PostgreSQL control file is one the first things that the PostgreSQL
//! server reads when it starts up. It indicates whether the server was shut
//! down cleanly, or if it crashed or was restored from online backup so that
//! WAL recovery needs to be performed. It also contains a copy of the latest
//! checkpoint record and its location in the WAL.
//!
//! The control file also contains fields for detecting whether the
//! data directory is compatible with a postgres binary. That includes
//! a version number, configuration options that can be set at
//! compilation time like the block size, and the platform's alignment
//! and endianness information. (The PostgreSQL on-disk file format is
//! not portable across platforms.)
//!
//! The control file is stored in the PostgreSQL data directory, as
//! `global/pg_control`. The data stored in it is designed to be smaller than
//! 512 bytes, on the assumption that it can be updated atomically. The actual
//! file is larger, 8192 bytes, but the rest of it is just filled with zeros.
//!
//! See src/include/catalog/pg_control.h in the PostgreSQL sources for more
//! information. You can use PostgreSQL's pg_controldata utility to view its
//! contents.
//!
use super::bindings::{ControlFileData, PG_CONTROL_FILE_SIZE};

use anyhow::{bail, Result};
use bytes::{Bytes, BytesMut};

/// Equivalent to sizeof(ControlFileData) in C
const SIZEOF_CONTROLDATA: usize = size_of::<ControlFileData>();

impl ControlFileData {
    /// Compute the offset of the `crc` field within the `ControlFileData` struct.
    /// Equivalent to offsetof(ControlFileData, crc) in C.
    const fn pg_control_crc_offset() -> usize {
        std::mem::offset_of!(ControlFileData, crc)
    }

    ///
    /// Interpret a slice of bytes as a Postgres control file.
    ///
    pub fn decode(buf: &[u8]) -> Result<ControlFileData> {
        use utils::bin_ser::LeSer;

        // Check that the slice has the expected size. The control file is
        // padded with zeros up to a 512 byte sector size, so accept a
        // larger size too, so that the caller can just the whole file
        // contents without knowing the exact size of the struct.
        if buf.len() < SIZEOF_CONTROLDATA {
            bail!("control file is too short");
        }

        // Compute the expected CRC of the content.
        let OFFSETOF_CRC = Self::pg_control_crc_offset();
        let expectedcrc = crc32c::crc32c(&buf[0..OFFSETOF_CRC]);

        // Use serde to deserialize the input as a ControlFileData struct.
        let controlfile = ControlFileData::des_prefix(buf)?;

        // Check the CRC
        if expectedcrc != controlfile.crc {
            bail!(
                "invalid CRC in control file: expected {:08X}, was {:08X}",
                expectedcrc,
                controlfile.crc
            );
        }

        Ok(controlfile)
    }

    ///
    /// Convert a struct representing a Postgres control file into raw bytes.
    ///
    /// The CRC is recomputed to match the contents of the fields.
    pub fn encode(&self) -> Bytes {
        use utils::bin_ser::LeSer;

        // Serialize into a new buffer.
        let b = self.ser().unwrap();

        // Recompute the CRC
        let OFFSETOF_CRC = Self::pg_control_crc_offset();
        let newcrc = crc32c::crc32c(&b[0..OFFSETOF_CRC]);

        let mut buf = BytesMut::with_capacity(PG_CONTROL_FILE_SIZE as usize);
        buf.extend_from_slice(&b[0..OFFSETOF_CRC]);
        buf.extend_from_slice(&newcrc.to_ne_bytes());
        // Fill the rest of the control file with zeros.
        buf.resize(PG_CONTROL_FILE_SIZE as usize, 0);

        buf.into()
    }
}

```

### Core Architecture Module: `libs/postgres_ffi/src/nonrelfile_utils.rs`
```
//!
//! Common utilities for dealing with PostgreSQL non-relation files.
//!
use crate::pg_constants;
use crate::transaction_id_precedes;
use bytes::BytesMut;

use super::bindings::MultiXactId;

pub fn transaction_id_set_status(xid: u32, status: u8, page: &mut BytesMut) {
    tracing::trace!(
        "handle_apply_request for RM_XACT_ID-{} (1-commit, 2-abort, 3-sub_commit)",
        status
    );

    let byteno: usize =
        ((xid % pg_constants::CLOG_XACTS_PER_PAGE) / pg_constants::CLOG_XACTS_PER_BYTE) as usize;

    let bshift: u8 =
        ((xid % pg_constants::CLOG_XACTS_PER_BYTE) * pg_constants::CLOG_BITS_PER_XACT as u32) as u8;

    page[byteno] =
        (page[byteno] & !(pg_constants::CLOG_XACT_BITMASK << bshift)) | (status << bshift);
}

pub fn transaction_id_get_status(xid: u32, page: &[u8]) -> u8 {
    let byteno: usize =
        ((xid % pg_constants::CLOG_XACTS_PER_PAGE) / pg_constants::CLOG_XACTS_PER_BYTE) as usize;

    let bshift: u8 =
        ((xid % pg_constants::CLOG_XACTS_PER_BYTE) * pg_constants::CLOG_BITS_PER_XACT as u32) as u8;

    (page[byteno] >> bshift) & pg_constants::CLOG_XACT_BITMASK
}

// See CLOGPagePrecedes in clog.c
pub const fn clogpage_precedes(page1: u32, page2: u32) -> bool {
    let mut xid1 = page1 * pg_constants::CLOG_XACTS_PER_PAGE;
    xid1 += pg_constants::FIRST_NORMAL_TRANSACTION_ID + 1;
    let mut xid2 = page2 * pg_constants::CLOG_XACTS_PER_PAGE;
    xid2 += pg_constants::FIRST_NORMAL_TRANSACTION_ID + 1;

    transaction_id_precedes(xid1, xid2)
        && transaction_id_precedes(xid1, xid2 + pg_constants::CLOG_XACTS_PER_PAGE - 1)
}

// See SlruMayDeleteSegment() in slru.c
pub fn slru_may_delete_clogsegment(segpage: u32, cutoff_page: u32) -> bool {
    let seg_last_page = segpage + pg_constants::SLRU_PAGES_PER_SEGMENT - 1;

    assert_eq!(segpage % pg_constants::SLRU_PAGES_PER_SEGMENT, 0);

    clogpage_precedes(segpage, cutoff_page) && clogpage_precedes(seg_last_page, cutoff_page)
}

// Multixact utils

pub fn mx_offset_to_flags_offset(xid: MultiXactId) -> usize {
    ((xid / pg_constants::MULTIXACT_MEMBERS_PER_MEMBERGROUP as u32)
        % pg_constants::MULTIXACT_MEMBERGROUPS_PER_PAGE as u32
        * pg_constants::MULTIXACT_MEMBERGROUP_SIZE as u32) as usize
}

pub fn mx_offset_to_flags_bitshift(xid: MultiXactId) -> u16 {
    (xid as u16) % pg_constants::MULTIXACT_MEMBERS_PER_MEMBERGROUP
        * pg_constants::MXACT_MEMBER_BITS_PER_XACT
}

/* Location (byte offset within page) of TransactionId of given member */
pub fn mx_offset_to_member_offset(xid: MultiXactId) -> usize {
    mx_offset_to_flags_offset(xid)
        + (pg_constants::MULTIXACT_FLAGBYTES_PER_GROUP
            + (xid as u16 % pg_constants::MULTIXACT_MEMBERS_PER_MEMBERGROUP) * 4) as usize
}

fn mx_offset_to_member_page(xid: u32) -> u32 {
    xid / pg_constants::MULTIXACT_MEMBERS_PER_PAGE as u32
}

pub fn mx_offset_to_member_segment(xid: u32) -> i32 {
    (mx_offset_to_member_page(xid) / pg_constants::SLRU_PAGES_PER_SEGMENT) as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multixid_calc() {
        // Check that the mx_offset_* functions produce the same values as the
        // corresponding PostgreSQL C macros (MXOffsetTo*). These test values
        // were generated by calling the PostgreSQL macros with a little C
        // program.
        assert_eq!(mx_offset_to_member_segment(0), 0);
        assert_eq!(mx_offset_to_member_page(0), 0);
        assert_eq!(mx_offset_to_flags_offset(0), 0);
        assert_eq!(mx_offset_to_flags_bitshift(0), 0);
        assert_eq!(mx_offset_to_member_offset(0), 4);
        assert_eq!(mx_offset_to_member_segment(1), 0);
        assert_eq!(mx_offset_to_member_page(1), 0);
        assert_eq!(mx_offset_to_flags_offset(1), 0);
        assert_eq!(mx_offset_to_flags_bitshift(1), 8);
        assert_eq!(mx_offset_to_member_offset(1), 8);
        assert_eq!(mx_offset_to_member_segment(123456789), 2358);
        assert_eq!(mx_offset_to_member_page(123456789), 75462);
        assert_eq!(mx_offset_to_flags_offset(123456789), 4780);
        assert_eq!(mx_offset_to_flags_bitshift(123456789), 8);
        assert_eq!(mx_offset_to_member_offset(123456789), 4788);
        assert_eq!(mx_offset_to_member_segment(u32::MAX - 1), 82040);
        assert_eq!(mx_offset_to_member_page(u32::MAX - 1), 2625285);
        assert_eq!(mx_offset_to_flags_offset(u32::MAX - 1), 5160);
        assert_eq!(mx_offset_to_flags_bitshift(u32::MAX - 1), 16);
        assert_eq!(mx_offset_to_member_offset(u32::MAX - 1), 5172);
        assert_eq!(mx_offset_to_member_segment(u32::MAX), 82040);
        assert_eq!(mx_offset_to_member_page(u32::MAX), 2625285);
        assert_eq!(mx_offset_to_flags_offset(u32::MAX), 5160);
        assert_eq!(mx_offset_to_flags_bitshift(u32::MAX), 24);
        assert_eq!(mx_offset_to_member_offset(u32::MAX), 5176);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12951** (2026-09-25): **GCS backend: copy_object builds both source and destination from `to`, making every copy a self-copy**
  *Symptoms*: `GCSBucket::copy_object` (libs/remote_storage/src/gcs_bucket.rs:859) takes `from` and `to`, but `to` is used in all three places the paths are constructed:  - `copy_from_path` (~867): `self.relative_path_to_gcs_object(to)` - `copy_to_path` (~875): `self.relative_path_to_gcs_object(to)` - the request URL (~884) interpolates `copy_from_path`, itself derived from `to`  The request issued is effectively `POST /b/{bucket}/o/{to}/copyTo/b/{bucket}/o/{to}` — a self-copy returning success. `from` is threaded into the signature and never read; rustc flags it as unused.  `RemoteStorage::copy` is part of the generic backend surface (called from `libs/remote_storage/src/support.rs`), so a caller copying A to B gets `Ok(())` without B being written.  Looks like a copy-paste slip rather than intent. Noticed the unused-parameter warning while building locally.
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #12950, filed twice by mistake. Closing this one.

- **Issue #12944** (2026-09-20): **fix(compute): validate `prewarm_local_cache()` state length before header access**
  *Symptoms*: ## Problem  `neon.prewarm_local_cache()` casts its bytea argument to `FileCacheState *`, and `lfc_prewarm()` reads the header fields (`n_chunks`, `magic`, `chunk_size_log`) before verifying that the payload is at least as large as the `FileCacheState` header. Inputs shorter than `sizeof(FileCacheState)` therefore cause out-of-bounds reads before the validation added in #12648 has a chance to reject them:  ```sql postgres=# select neon.prewarm_local_cache('\xfc'); -- lfc_prewarm() reads n_chunks/magic past the end of the 5-byte datum -- (observable under valgrind/ASan) ```  ## Summary of changes  - Reject states smaller than `sizeof(FileCacheState)` up front in `lfc_prewarm()`, next to the existing magic/size validation, before any header field is accessed. - Use `VARSIZE_ANY()` for the length checks, since `PG_GETARG_BYTEA_PP()` may return a short-format (1-byte header) varlena, for which plain `VARSIZE()` would misread the length. - Add a regression test feeding truncated and malformed states to `neon.prewarm_local_cache()`, verifying they are rejected with an error and the backend stays alive. 

- **Issue #12940** (2026-08-31): **docs: fix typo proccess -> process**
  *Symptoms*: Corrects the misspelling `proccess` -> `process` in `docs/rfcs/032-shard-splitting.md`.  Documentation only, no behaviour change.

- **Issue #12920** (2026-08-12): **proxy: forward session timeout GUCs from startup packet to compute**
  *Symptoms*: ## Problem  `statement_timeout`, `lock_timeout`, and `idle_in_transaction_session_timeout` set via connection pool config are silently ignored on Neon. `SHOW statement_timeout` returns `0` even when the client configured a non-zero value. `SET lock_timeout = ...` works fine because that's SQL sent after connection — it never touches this path.  ## Summary of changes  Add the three timeout GUCs to the forwarding whitelist in `set_startup_params()` alongside `application_name`. Adds a unit test verifying they are forwarded while unknown params are still dropped.  Closes #12856
  **Post-Mortem & Fix Analysis**:
  > Closing this PR for now — I’m unable to dedicate the time needed to bring it to a mergeable state. Thanks for the review.

- **Issue #12913** (2026-06-13): **compute_ctl: add /terminate?if_idle to terminate only when idle**
  *Symptoms*: ## Problem  To suspend a compute safely, an external control plane wants to terminate it only when nothing is connected, so it does not roll back an in-flight session (`SQLSTATE 57P01`). Today that takes two calls — a probe (e.g. a SQL query counting sessions) followed by `/terminate` — with a race window in between where a new connection can arrive and then be killed by the terminate.  ## Summary  Adds an optional query parameter `if_idle` to `/terminate`. When set, a `Running` compute is terminated only if it currently has zero client sessions (excluding this connection and internal `cloud_admin` connections), zero logical walsenders, and zero autovacuum workers, checked by querying Postgres directly. If it is not idle, the compute is left running and `/terminate` returns `409 Conflict` with the counts that made it non-idle (`TerminateNotIdleResponse`).  The idle check is bounded by a 10s timeout and fails safe: if the check errors (e.g. Postgres unreachable) or times out (e.g. Postgres up but unresponsive), the request returns `503` and does **not** terminate. Non-`Running` statuses (e.g. `Empty`) have no Postgres / no sessions and fall through to normal termination.  This collapses the probe-then-terminate sequence into a single call. Note it narrows but does not fully eliminate the race: a connection arriving after the check but before Postgres shuts down still loses, so an external barrier (restricting who may connect during suspend) remains necessary for a hard guarant

- **Issue #12912** (2026-06-13): **compute_ctl: expose session/walsender/autovacuum counts in /status**
  *Symptoms*: ## Problem  `compute_ctl`'s `/status` exposes only `last_active` for activity. Internally the activity monitor folds several distinct keep-alive signals into that single field (logical walsenders, autovacuum, and logical subscriptions all just bump `last_active`). An external control plane that wants to make a *precise* suspend decision — e.g. "terminate only when there are zero client sessions" — cannot get the underlying counts from `/status` and has to run a separate SQL probe against the compute.  ## Summary  Adds three optional fields to `ComputeStatusResponse`:  - `num_client_sessions` — client backends, excluding this connection   (`pg_backend_pid()`) and internal `cloud_admin` connections (the monitor,   vm-monitor, exporters, …) — the same predicate `get_backends_state_change()`   already uses. - `num_walsenders` — logical WAL senders (`pg_stat_replication`, excluding the   physical `walproposer`). - `num_autovacuum_workers` — running autovacuum workers.  The activity monitor already issues these queries to decide suspend; it now also collects the counts (always computed, not short-circuited) and publishes them together with `last_active` in a single critical section, so a `/status` read sees a consistent snapshot. The fields are `None` ("unknown") before the first successful check and whenever the monitor cannot confirm Postgres is up — counts are reset to `None` rather than left stale, so a stale `0` never reads as "idle". They are a coarse idle-detection hint; an 

- **Issue #12911** (2026-06-13): **proxy: include client peer address in control plane requests**
  *Symptoms*: ## Problem  The control plane requests `get_endpoint_access_control` and `wake_compute` carry `session_id`, `application_name`, `endpointish` and `role`, but not the client's peer address. A control plane that wants to apply per-source-IP rate limiting or lockout has no synchronous signal to do so — the only place the client IP is currently observable to the control plane is the asynchronous parquet telemetry (`RequestData::peer_addr`), which is a batch channel to S3, unsuitable for online decisions.  ## Summary of changes  Add `peer_addr` (from `ctx.peer_addr()`, already used proxy-side for the IP allowlist check) as a query parameter on both `get_endpoint_access_control` and `wake_compute`. Backwards-compatible: an unknown query parameter is ignored by control planes that don't consume it; no config flag.  Note on semantics: both responses are cached on the proxy side (`project_info` TTL, `node_info`), so the control plane sees only a sample of client IPs here and must not vary the response by peer. `peer_addr` in these requests is therefore telemetry / an input for rate limiters, not a per-attempt signal; a per-attempt channel (authentication outcome reporting) would be a separate change. 

- **Issue #12910** (2026-06-10): **authClient.signIn.social does not pass scopes**
  *Symptoms*: I am using `authClient.signIn.social` and am attempting to pass through scopes. The resulting API calls will open a consent to approve Google login, but only basic scopes. It does not pass through the scopes specified on `authClient.signIn.social`.  ## Steps to reproduce  Specify additional scopes such as ``` export const GOOGLE_CALENDAR_SCOPES = [   "https://www.googleapis.com/auth/calendar.readonly", ] as const; ```  Set up `authClient.signIn.social` with the scope ```   const callbackURL = getAuthCallbackUrl();    const result = await authClient.signIn.social({     provider: "google",     callbackURL,     errorCallbackURL: callbackURL,     scopes: [...GOOGLE_CALENDAR_SCOPES],     disableRedirect: true,   });  ```  ## Expected result I expected the scopes to be passed through Neon and be consented.  ## Actual result Network shows `https://___/neondb/auth/get-access-token` POST with 200 OK Request Payload does not have scopes ``` {     "providerId": "google" } ``` Response ``` {     "accessToken": "redacted",     "accessTokenExpiresAt": "2026-06-09T20:15:31.624Z",     "scopes": [         "https://www.googleapis.com/auth/userinfo.email",         "https://www.googleapis.com/auth/userinfo.profile",         "openid"     ],     "idToken": "redacted" } ```  ## Environment Simple vite app from create-vite package.json ```   "dependencies": {     "@neondatabase/neon-js": "^0.6.1-beta",     "@neondatabase/serverless": "^1.1.0",     "@tailwindcss/typography": "github:tailwindcss/typog
  **Post-Mortem & Fix Analysis**:
  > Closing and opening in the neon-js repo

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

### Incident Patch 1: `fa504217` (2026-08-31)
**Commit Message**: docs: fix typo proccess -> process (#12940)

Corrects the misspelling `proccess` -> `process` in
`docs/rfcs/032-shard-splitting.md`.

Documentation only, no behaviour change.

Signed-off-by: Vaibhav Srivastava <[REDACTED_EMAIL]>

**File**: `docs/rfcs/032-shard-splitting.md` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ are described in a later section.
 There are broadly two parts to the implementation:
 
 1. The pageserver split API, which splits one shard on one pageserver
-2. The overall tenant split proccess which is coordinated by the storage controller,
+2. The overall tenant split process which is coordinated by the storage controller,
    and calls into the pageserver split API as needed.
 
 ### Pageserver Split API
```

---

### Incident Patch 2: `6a35a3e9` (2026-03-25)
**Commit Message**: HCC, resolved GCS upload permit deadlock, SK generation delete bug-fix. (#12873)

## Problem

**HCC SafeKeepers**
* Currently, the `hcc_base_url` flag is set to `None`, disabling
automatic timeline pull from other SafeKeepers on restart. We can
manually call `pull_timeline` but would prefer to use the Hadron
functionality.

**GCS Sempahore Permit Deadlock on Upload**
* GCS `upload` trait implementation's call of `put_object` is
duplicating semaphore permit acquisition, creating deadlock. Each
`upload` acquires, calls `put_object`, nothing to acquire, times out,
retries, etc.

**Storage Controller delete API for SafeKeepers Bug**
* Noticed this while doing a PITR and reusing an old Timeline ID (that
had been previously deleted).
* `DELETE` timeline endpoint in Storage Controller fails to delete the
TL due to generation number mismatch between the [Pending
Op](https://github.com/neondatabase/neon/blob/main/storage_controller/src/service/safekeeper_service.rs#L565)
(gen = `i32::MAX`) and the [Schedule
Request](https://github.com/neondatabase/neon/blob/main/storage_controller/src/service/safekeeper_service.rs#L582)
(gen = SK.generation). The extant Pending Op [blocks the
deletion](http

**File**: `libs/remote_storage/src/gcs_bucket.rs` (modified, +17/-12)
```diff
@@ -323,8 +323,14 @@ impl GCSBucket {
         cancel: &CancellationToken,
         metadata: Option<StorageMetadata>,
     ) -> anyhow::Result<()> {
+
+        // we removed the semaphore permit here which was duplicative of the outer upload() trait
+        // impl call. put_object only called by upload(), so safe to do. upload handles permit and
+        // timeout, we were getting deadlock with upload concurrency at 32, and 32 upload permits
+        // then trying to get a permit inside their put_object calls, timing out, retrying,
+        // ad-infinitum.
+        
         let kind = RequestKind::Put;
-        let _permit = self.permit(kind, cancel).await?;
         let started_at = start_measuring_requests(kind);
 
         let multipart_uri = format!(
@@ -372,21 +378,21 @@ impl GCSBucket {
             .headers(headers)
             .send();
 
-        let upload = tokio::time::timeout(self.timeout, upload);
-
         let res = tokio::select! {
             res = upload => res,
             _ = cancel.cancelled() => return Err(TimeoutOrCancel::Cancel.into()),
         };
 
-        if let Ok(inner) = &res {
-            let started_at = ScopeGuard::into_inner(started_at);
-            crate::metrics::BUCKET_METRICS
-                .req_seconds
-                .observe_elapsed(kind, inner, started_at);
-        }
+        // not if let-ing an Ok(inner), since res is not double-Result<>-wrapped with the tokio
+        // timeout, observe_elapsed's AttemptedOutcome trait obj expects
+        // &Result<reqwest::Response> which &res directly is, and it can handle the Err case.
+        let started_at = ScopeGuard::into_inner(started_at);
+        crate::metrics::BUCKET_METRICS
+            .req_seconds
+            .observe_elapsed(kind, &res, started_at);
+        
         match res {
-            Ok(Ok(res)) => {
+            Ok(res) => {
                 if !res.status().is_success() {
                     match res.status() {
                         _ => Err(anyhow::anyhow!("GCS PUT error \n\t {:?}", res)),
@@ -410,8 +416,7 @@ impl GCSBucket {
                     Ok(())
                 }
             }
-            Ok(Err(reqw)) => Err(reqw.into()),
-            Err(_timeout) => Err(TimeoutOrCancel::Timeout.into()),
+            Err(reqw) => Err(reqw.into()),
         }
     }
 
```

**File**: `safekeeper/src/bin/safekeeper.rs` (modified, +3/-1)
```diff
@@ -263,6 +263,8 @@ struct Args {
     /* BEGIN_HADRON */
     #[arg(long)]
     enable_pull_timeline_on_startup: bool,
+    #[arg(long)]
+    hcc_base_url: Option<url::Url>,
     /// How often to scan entire data-dir for total disk usage
     #[arg(long, value_parser=humantime::parse_duration, default_value = DEFAULT_GLOBAL_DISK_CHECK_INTERVAL)]
     global_disk_check_interval: Duration,
@@ -459,7 +461,7 @@ async fn main() -> anyhow::Result<()> {
         /* BEGIN_HADRON */
         advertise_pg_addr_tenant_only: None,
         enable_pull_timeline_on_startup: args.enable_pull_timeline_on_startup,
-        hcc_base_url: None,
+        hcc_base_url: args.hcc_base_url,
         global_disk_check_interval: args.global_disk_check_interval,
         max_global_disk_usage_ratio: args.max_global_disk_usage_ratio,
         /* END_HADRON */
```

**File**: `storage_controller/src/service/safekeeper_service.rs` (modified, +1/-1)
```diff
@@ -585,7 +585,7 @@ impl Service {
                     host_list: Vec::new(),
                     tenant_id,
                     timeline_id: Some(timeline_id),
-                    generation: tl.generation as u32,
+                    generation: i32::MAX as u32,
                     kind: SafekeeperTimelineOpKind::Delete,
                 };
                 locked.safekeeper_reconcilers.schedule_request(req);
```

---

### Incident Patch 3: `5e85c02f` (2025-09-30)
**Commit Message**: neon_local: fix mismatched comment about local SSL certificate generation (#12814)

## Problem
In control_plane, the local SSL certificate generation uses `ed25519`,
but the comment still remained `rsa:2048`, resulting in a mismatch.
This mismatch was introduced in #11542.

## Summary of changes
The comment has been corrected from `rsa:2048` to `ed25519` to ensure
consistency with the implementation.

**File**: `control_plane/src/local_env.rs` (modified, +2/-2)
```diff
@@ -1074,7 +1074,7 @@ fn generate_auth_keys(private_key_path: &Path, public_key_path: &Path) -> anyhow
 }
 
 fn generate_ssl_ca_cert(cert_path: &Path, key_path: &Path) -> anyhow::Result<()> {
-    // openssl req -x509 -newkey rsa:2048 -nodes -subj "/CN=Neon Local CA" -days 36500 \
+    // openssl req -x509 -newkey ed25519 -nodes -subj "/CN=Neon Local CA" -days 36500 \
     // -out rootCA.crt -keyout rootCA.key
     let keygen_output = Command::new("openssl")
         .args([
@@ -1104,7 +1104,7 @@ fn generate_ssl_cert(
     let mut csr_path = cert_path.to_path_buf();
     csr_path.set_extension(".csr");
 
-    // openssl req -new -nodes -newkey rsa:2048 -keyout server.key -out server.csr \
+    // openssl req -new -nodes -newkey ed25519 -keyout server.key -out server.csr \
     // -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
     let keygen_output = Command::new("openssl")
         .args(["req", "-new", "-nodes"])
```

---

### Incident Patch 4: `c17d3fe6` (2025-09-30)
**Commit Message**: Fix typos (#12819)

Fix typo: `Falied` -> `Failed`

Signed-off-by: Yongtao Huang <[REDACTED_EMAIL]>

**File**: `control_plane/src/pageserver.rs` (modified, +2/-2)
```diff
@@ -560,12 +560,12 @@ impl PageServerNode {
                 .remove("sampling_ratio")
                 .map(serde_json::from_str)
                 .transpose()
-                .context("Falied to parse 'sampling_ratio'")?,
+                .context("Failed to parse 'sampling_ratio'")?,
             relsize_snapshot_cache_capacity: settings
                 .remove("relsize snapshot cache capacity")
                 .map(|x| x.parse::<usize>())
                 .transpose()
-                .context("Falied to parse 'relsize_snapshot_cache_capacity' as integer")?,
+                .context("Failed to parse 'relsize_snapshot_cache_capacity' as integer")?,
             basebackup_cache_enabled: settings
                 .remove("basebackup_cache_enabled")
                 .map(|x| x.parse::<bool>())
```

---

### Incident Patch 5: `4ac447c7` (2025-09-30)
**Commit Message**: fix(control_plane): Fix incorrect file path of identity.toml in error message (#12826)

## Problem
Control_plane shows incorrect file path when identity.toml file open
fails.

## Summary of changes
In the error context, when writing identity.toml, I changed it to use
identity_file_path instead of config_file_path.

**File**: `control_plane/src/pageserver.rs` (modified, +2/-2)
```diff
@@ -233,8 +233,8 @@ impl PageServerNode {
         let mut identity_file = std::fs::OpenOptions::new()
             .create_new(true)
             .write(true)
-            .open(identity_file_path)
-            .with_context(|| format!("open identity toml for write: {config_file_path:?}"))?;
+            .open(&identity_file_path)
+            .with_context(|| format!("open identity toml for write: {identity_file_path:?}"))?;
         let identity_toml = self.pageserver_make_identity_toml(node_id);
         identity_file
             .write_all(identity_toml.to_string().as_bytes())
```

---

### Incident Patch 6: `b4a63e0a` (2025-07-31)
**Commit Message**: Fix how `neon.stripe_size` option is set in postgresql.conf file (#12776)

Commit 1dce2a9e74 changed how the `neon.pageserver_connstring` setting
is formed, but it messed up setting the `neon.stripe_size` setting so
that it was set twice. That got mixed up during development of the
patch, as commit 7fef4435c1 landed first and was merged incorrectly.

**File**: `compute_tools/src/config.rs` (modified, +14/-17)
```diff
@@ -65,14 +65,19 @@ pub fn write_postgres_conf(
         writeln!(file, "{conf}")?;
     }
 
-    // Stripe size GUC should be defined prior to connection string
-    if let Some(stripe_size) = spec.shard_stripe_size {
-        writeln!(file, "neon.stripe_size={stripe_size}")?;
-    }
     // Add options for connecting to storage
     writeln!(file, "# Neon storage settings")?;
     writeln!(file)?;
     if let Some(conninfo) = &spec.pageserver_connection_info {
+        // Stripe size GUC should be defined prior to connection string
+        if let Some(stripe_size) = conninfo.stripe_size {
+            writeln!(
+                file,
+                "# from compute spec's pageserver_connection_info.stripe_size field"
+            )?;
+            writeln!(file, "neon.stripe_size={stripe_size}")?;
+        }
+
         let mut libpq_urls: Option<Vec<String>> = Some(Vec::new());
         let num_shards = if conninfo.shard_count.0 == 0 {
             1 // unsharded, treat it as a single shard
@@ -110,7 +115,7 @@ pub fn write_postgres_conf(
         if let Some(libpq_urls) = libpq_urls {
             writeln!(
                 file,
-                "# derived from compute spec's pageserver_conninfo field"
+                "# derived from compute spec's pageserver_connection_info field"
             )?;
             writeln!(
                 file,
@@ -120,24 +125,16 @@ pub fn write_postgres_conf(
         } else {
             writeln!(file, "# no neon.pageserver_connstring")?;
         }
-
-        if let Some(stripe_size) = conninfo.stripe_size {
-            writeln!(
-                file,
-                "# from compute spec's pageserver_conninfo.stripe_size field"
-            )?;
+    } else {
+        // Stripe size GUC should be defined prior to connection string
+        if let Some(stripe_size) = spec.shard_stripe_size {
+            writeln!(file, "# from compute spec's shard_stripe_size field")?;
             writeln!(file, "neon.stripe_size={stripe_size}")?;
         }
-    } else {
         if let Some(s) = &spec.pageserver_connstring {
             writeln!(file, "# from compute spec's pageserver_connstring field")?;
             writeln!(file, "neon.pageserver_connstring={}", escape_conf_value(s))?;
         }
-
-        if let Some(stripe_size) = spec.shard_stripe_size {
-            writeln!(file, "# from compute spec's shard_stripe_size field")?;
-            writeln!(file, "neon.stripe_size={stripe_size}")?;
-        }
     }
 
     if !spec.safekeeper_connstrings.is_empty() {
```

---

### Incident Patch 7: `056056be` (2025-07-30)
**Commit Message**: fix(compute): validate `prewarm_local_cache()` input (#12648)

## Problem
```
postgres=> select neon.prewarm_local_cache('\xfcfcfcfc01000000ffffffff070000000000000000000000000000000000000000000000000000000000000000000000000000ff', 1);
WARNING:  terminating connection because of crash of another server process
DETAIL:  The postmaster has commanded this server process to roll back the current transaction and exit, because another server process exited abnormally and possibly corrupted shared memory.
HINT:  In a moment you should be able to reconnect to the database and repeat your command.
FATAL:  server conn crashed?
```

The function takes a bytea argument and casts it to a C struct, without
validating the contents.

## Summary of changes

Added validation for number of pages to be prefetched and for the chunks
as well.

**File**: `pgxn/neon/file_cache.c` (modified, +26/-3)
```diff
@@ -49,6 +49,7 @@
 #include "neon.h"
 #include "neon_lwlsncache.h"
 #include "neon_perf_counters.h"
+#include "neon_utils.h"
 #include "pagestore_client.h"
 #include "communicator.h"
 
@@ -673,8 +674,19 @@ lfc_get_state(size_t max_entries)
 			{
 				if (GET_STATE(entry, j) != UNAVAILABLE)
 				{
-					BITMAP_SET(bitmap, i*lfc_blocks_per_chunk + j);
-					n_pages += 1;
+					/* Validate the buffer tag before including it */
+					BufferTag test_tag = entry->key;
+					test_tag.blockNum += j;
+
+					if (BufferTagIsValid(&test_tag))
+					{
+						BITMAP_SET(bitmap, i*lfc_blocks_per_chunk + j);
+						n_pages += 1;
+					}
+					else
+					{
+						elog(ERROR, "LFC: Skipping invalid buffer tag during cache state capture: blockNum=%u", test_tag.blockNum);
+					}
 				}
 			}
 			if (++i == n_entries)
@@ -683,7 +695,7 @@ lfc_get_state(size_t max_entries)
 		Assert(i == n_entries);
 		fcs->n_pages = n_pages;
 		Assert(pg_popcount((char*)bitmap, ((n_entries << lfc_chunk_size_log) + 7)/8) == n_pages);
-		elog(LOG, "LFC: save state of %d chunks %d pages", (int)n_entries, (int)n_pages);
+		elog(LOG, "LFC: save state of %d chunks %d pages (validated)", (int)n_entries, (int)n_pages);
 	}
 
 	LWLockRelease(lfc_lock);
@@ -702,6 +714,7 @@ lfc_prewarm(FileCacheState* fcs, uint32 n_workers)
 	size_t n_entries;
 	size_t prewarm_batch = Min(lfc_prewarm_batch, readahead_buffer_size);
 	size_t fcs_size;
+	uint32_t max_prefetch_pages;
 	dsm_segment *seg;
 	BackgroundWorkerHandle* bgw_handle[MAX_PREWARM_WORKERS];
 
@@ -746,6 +759,11 @@ lfc_prewarm(FileCacheState* fcs, uint32 n_workers)
 	n_entries = Min(fcs->n_chunks, lfc_prewarm_limit);
 	Assert(n_entries != 0);
 
+	max_prefetch_pages = n_entries << fcs_chunk_size_log;
+	if (fcs->n_pages > max_prefetch_pages) {
+		elog(ERROR, "LFC: Number of pages in file cache state (%d) is more than the limit (%d)", fcs->n_pages, max_prefetch_pages);
+	}
+
 	LWLockAcquire(lfc_lock, LW_EXCLUSIVE);
 
 	/* Do not prewarm more entries than LFC limit */
@@ -898,6 +916,11 @@ lfc_prewarm_main(Datum main_arg)
 				{
 					tag = fcs->chunks[snd_idx >> fcs_chunk_size_log];
 					tag.blockNum += snd_idx & ((1 << fcs_chunk_size_log) - 1);
+
+					if (!BufferTagIsValid(&tag)) {
+						elog(ERROR, "LFC: Invalid buffer tag: %u", tag.blockNum);
+					}
+
 					if (!lfc_cache_contains(BufTagGetNRelFileInfo(tag), tag.forkNum, tag.blockNum))
 					{
 						(void)communicator_prefetch_register_bufferv(tag, NULL, 1, NULL);
```

**File**: `pgxn/neon/neon_utils.c` (modified, +19/-0)
```diff
@@ -183,3 +183,22 @@ alloc_curl_handle(void)
 }
 
 #endif
+
+/*
+ * Check if a BufferTag is valid by verifying all its fields are not invalid.
+ */
+bool
+BufferTagIsValid(const BufferTag *tag)
+{
+	#if PG_MAJORVERSION_NUM >= 16
+	return (tag->spcOid != InvalidOid) &&
+		(tag->relNumber != InvalidRelFileNumber) &&
+		(tag->forkNum != InvalidForkNumber) &&
+		(tag->blockNum != InvalidBlockNumber);
+	#else
+	return (tag->rnode.spcNode != InvalidOid) &&
+		(tag->rnode.relNode != InvalidOid) &&
+		(tag->forkNum != InvalidForkNumber) &&
+		(tag->blockNum != InvalidBlockNumber);
+	#endif
+}
```

**File**: `pgxn/neon/neon_utils.h` (modified, +4/-0)
```diff
@@ -2,6 +2,7 @@
 #define __NEON_UTILS_H__
 
 #include "lib/stringinfo.h"
+#include "storage/buf_internals.h"
 
 #ifndef WALPROPOSER_LIB
 #include <curl/curl.h>
@@ -16,6 +17,9 @@ void		pq_sendint32_le(StringInfo buf, uint32 i);
 void		pq_sendint64_le(StringInfo buf, uint64 i);
 void        disable_core_dump(void);
 
+/* Buffer tag validation function */
+bool		BufferTagIsValid(const BufferTag *tag);
+
 #ifndef WALPROPOSER_LIB
 
 CURL *		alloc_curl_handle(void);
```

---

### Incident Patch 8: `1bb434ab` (2025-07-29)
**Commit Message**: fix(test): test_readonly_node_gc compute needs time to acquire lease (#12747)

## Problem

Part of LKB-2368. Compute fails to obtain LSN lease in this test case.
There're many assumptions around how compute obtains the leases, and in
this particular test case, as the LSN lease length is only 8s (which is
shorter than the amount of time where pageserver can restart and compute
can reconnect in terms of force stop), it sometimes cause issues.

## Summary of changes

Add more sleeps around the test case to ensure it's stable at least. We
need to find a more reliable way to test this in the future.

---------

Signed-off-by: Alex Chi Z <[REDACTED_EMAIL]>

**File**: `test_runner/regress/test_readonly_node.py` (modified, +21/-7)
```diff
@@ -129,7 +129,10 @@ def test_readonly_node_gc(neon_env_builder: NeonEnvBuilder):
     Test static endpoint is protected from GC by acquiring and renewing lsn leases.
     """
 
-    LSN_LEASE_LENGTH = 8
+    LSN_LEASE_LENGTH = (
+        14  # This value needs to be large enough for compute_ctl to send two lease requests.
+    )
+
     neon_env_builder.num_pageservers = 2
     # GC is manual triggered.
     env = neon_env_builder.init_start(
@@ -230,6 +233,15 @@ def trigger_gc_and_select(
         log.info(f"`SELECT` query succeed after GC, {ctx=}")
         return offset
 
+    # It's not reliable to let the compute renew the lease in this test case as we have a very tight
+    # lease timeout. Therefore, the test case itself will renew the lease.
+    #
+    # This is a workaround to make the test case more deterministic.
+    def renew_lease(env: NeonEnv, lease_lsn: Lsn):
+        env.storage_controller.pageserver_api().timeline_lsn_lease(
+            env.initial_tenant, env.initial_timeline, lease_lsn
+        )
+
     # Insert some records on main branch
     with env.endpoints.create_start("main", config_lines=["shared_buffers=1MB"]) as ep_main:
         with ep_main.cursor() as cur:
@@ -242,6 +254,9 @@ def trigger_gc_and_select(
         XLOG_BLCKSZ = 8192
         lsn = Lsn((int(lsn) // XLOG_BLCKSZ) * XLOG_BLCKSZ)
 
+        # We need to mock the way cplane works: it gets a lease for a branch before starting the compute.
+        renew_lease(env, lsn)
+
         with env.endpoints.create_start(
             branch_name="main",
             endpoint_id="static",
@@ -251,9 +266,6 @@ def trigger_gc_and_select(
                 cur.execute("SELECT count(*) FROM t0")
                 assert cur.fetchone() == (ROW_COUNT,)
 
-            # Wait for static compute to renew lease at least once.
-            time.sleep(LSN_LEASE_LENGTH / 2)
-
             generate_updates_on_main(env, ep_main, 3, end=100)
 
             offset = trigger_gc_and_select(
@@ -263,10 +275,10 @@ def trigger_gc_and_select(
             # Trigger Pageserver restarts
             for ps in env.pageservers:
                 ps.stop()
-                # Static compute should have at least one lease request failure due to connection.
-                time.sleep(LSN_LEASE_LENGTH / 2)
                 ps.start()
 
+            renew_lease(env, lsn)
+
             trigger_gc_and_select(
                 env,
                 ep_static,
@@ -282,6 +294,9 @@ def trigger_gc_and_select(
             )
             env.storage_controller.reconcile_until_idle()
 
+            # Wait for static compute to renew lease on the new pageserver.
+            time.sleep(LSN_LEASE_LENGTH + 3)
+
             trigger_gc_and_select(
                 env,
                 ep_static,
@@ -292,7 +307,6 @@ def trigger_gc_and_select(
 
         # Do some update so we can increment gc_cutoff
         generate_updates_on_main(env, ep_main, i, end=100)
-
     # Wait for the existing lease to expire.
     time.sleep(LSN_LEASE_LENGTH + 1)
     # Now trigger GC again, layers should be removed.
```

---

### Incident Patch 9: `dbde37c5` (2025-07-29)
**Commit Message**: fix(safekeeper): retry if open segment fail (#12757)

## Problem

Fix LKB-2632.

The safekeeper wal read path does not seem to retry at all. This would
cause client read errors on the customer side.

## Summary of changes

- Retry on `safekeeper::wal_backup::read_object`.
- Note that this only retries on S3 HTTP connection errors. Subsequent
reads could fail, and that needs more refactors to make the retry
mechanism work across the path.

---------

Signed-off-by: Alex Chi Z <[REDACTED_EMAIL]>

**File**: `safekeeper/src/wal_backup.rs` (modified, +21/-7)
```diff
@@ -12,7 +12,7 @@ use futures::stream::{self, FuturesOrdered};
 use postgres_ffi::v14::xlog_utils::XLogSegNoOffsetToRecPtr;
 use postgres_ffi::{PG_TLI, XLogFileName, XLogSegNo};
 use remote_storage::{
-    DownloadOpts, GenericRemoteStorage, ListingMode, RemotePath, StorageMetadata,
+    DownloadError, DownloadOpts, GenericRemoteStorage, ListingMode, RemotePath, StorageMetadata,
 };
 use safekeeper_api::models::PeerInfo;
 use tokio::fs::File;
@@ -607,6 +607,9 @@ pub(crate) async fn copy_partial_segment(
     storage.copy_object(source, destination, &cancel).await
 }
 
+const WAL_READ_WARN_THRESHOLD: u32 = 2;
+const WAL_READ_MAX_RETRIES: u32 = 3;
+
 pub async fn read_object(
     storage: &GenericRemoteStorage,
     file_path: &RemotePath,
@@ -620,12 +623,23 @@ pub async fn read_object(
         byte_start: std::ops::Bound::Included(offset),
         ..Default::default()
     };
-    let download = storage
-        .download(file_path, &opts, &cancel)
-        .await
-        .with_context(|| {
-            format!("Failed to open WAL segment download stream for remote path {file_path:?}")
-        })?;
+
+    // This retry only solves the connect errors: subsequent reads can still fail as this function returns
+    // a stream.
+    let download = backoff::retry(
+        || async { storage.download(file_path, &opts, &cancel).await },
+        DownloadError::is_permanent,
+        WAL_READ_WARN_THRESHOLD,
+        WAL_READ_MAX_RETRIES,
+        "download WAL segment",
+        &cancel,
+    )
+    .await
+    .ok_or_else(|| DownloadError::Cancelled)
+    .and_then(|x| x)
+    .with_context(|| {
+        format!("Failed to open WAL segment download stream for remote path {file_path:?}")
+    })?;
 
     let reader = tokio_util::io::StreamReader::new(download.download_stream);
 
```

---

### Incident Patch 10: `61f267d8` (2025-07-29)
**Commit Message**: pageserver: only retry `WaitForActiveTimeout` during shard resolution (#12772)

## Problem

In https://github.com/neondatabase/neon/pull/12467, timeouts and retries
were added to `Cache::get` tenant shard resolution to paper over an
issue with read unavailability during shard splits. However, this
retries _all_ errors, including irrecoverable errors like `NotFound`.

This causes problems with gRPC child shard routing in #12702, which
targets specific shards with `ShardSelector::Known` and relies on prompt
`NotFound` errors to reroute requests to child shards. These retries
introduce a 1s delay for all reads during child routing.

The broader problem of read unavailability during shard splits is left
as future work, see https://databricks.atlassian.net/browse/LKB-672.

Touches #12702.
Touches [LKB-191](https://databricks.atlassian.net/browse/LKB-191).

## Summary of changes

* Change `TenantManager` to always return a concrete
`GetActiveTimelineError`.
* Only retry `WaitForActiveTimeout` errors.
* Lots of code unindentation due to the simplified error handling.

Out of caution, we do not gate the retries on `ShardSelector`, since
this can trigger other races. Improvements here are l

**File**: `pageserver/src/page_service.rs` (modified, +0/-9)
```diff
@@ -466,13 +466,6 @@ impl TimelineHandles {
         self.handles
             .get(timeline_id, shard_selector, &self.wrapper)
             .await
-            .map_err(|e| match e {
-                timeline::handle::GetError::TenantManager(e) => e,
-                timeline::handle::GetError::PerTimelineStateShutDown => {
-                    trace!("per-timeline state shut down");
-                    GetActiveTimelineError::Timeline(GetTimelineError::ShuttingDown)
-                }
-            })
     }
 
     fn tenant_id(&self) -> Option<TenantId> {
@@ -488,11 +481,9 @@ pub(crate) struct TenantManagerWrapper {
     tenant_id: once_cell::sync::OnceCell<TenantId>,
 }
 
-#[derive(Debug)]
 pub(crate) struct TenantManagerTypes;
 
 impl timeline::handle::Types for TenantManagerTypes {
-    type TenantManagerError = GetActiveTimelineError;
     type TenantManager = TenantManagerWrapper;
     type Timeline = TenantManagerCacheItem;
 }
```

**File**: `pageserver/src/tenant/mgr.rs` (modified, +6/-0)
```diff
@@ -1522,6 +1522,12 @@ impl TenantManager {
         self.resources.deletion_queue_client.flush_advisory();
 
         // Phase 2: Put the parent shard to InProgress and grab a reference to the parent Tenant
+        //
+        // TODO: keeping the parent as InProgress while spawning the children causes read
+        // unavailability, as we can't acquire a timeline handle for it. The parent should be
+        // available for reads until the children are ready -- potentially until *all* subsplits
+        // across all parent shards are complete and the compute has been notified. See:
+        // <https://databricks.atlassian.net/browse/LKB-672>.
         drop(tenant);
         let mut parent_slot_guard =
             self.tenant_map_acquire_slot(&tenant_shard_id, TenantSlotAcquireMode::Any)?;
```

**File**: `pageserver/src/tenant/timeline/handle.rs` (modified, +74/-79)
```diff
@@ -224,11 +224,11 @@ use tracing::{instrument, trace};
 use utils::id::TimelineId;
 use utils::shard::{ShardIndex, ShardNumber};
 
-use crate::tenant::mgr::ShardSelector;
+use crate::page_service::GetActiveTimelineError;
+use crate::tenant::GetTimelineError;
+use crate::tenant::mgr::{GetActiveTenantError, ShardSelector};
 
-/// The requirement for Debug is so that #[derive(Debug)] works in some places.
-pub(crate) trait Types: Sized + std::fmt::Debug {
-    type TenantManagerError: Sized + std::fmt::Debug;
+pub(crate) trait Types: Sized {
     type TenantManager: TenantManager<Self> + Sized;
     type Timeline: Timeline<Self> + Sized;
 }
@@ -307,12 +307,11 @@ impl<T: Types> Default for PerTimelineState<T> {
 /// Abstract view of [`crate::tenant::mgr`], for testability.
 pub(crate) trait TenantManager<T: Types> {
     /// Invoked by [`Cache::get`] to resolve a [`ShardTimelineId`] to a [`Types::Timeline`].
-    /// Errors are returned as [`GetError::TenantManager`].
     async fn resolve(
         &self,
         timeline_id: TimelineId,
         shard_selector: ShardSelector,
-    ) -> Result<T::Timeline, T::TenantManagerError>;
+    ) -> Result<T::Timeline, GetActiveTimelineError>;
 }
 
 /// Abstract view of an [`Arc<Timeline>`], for testability.
@@ -322,13 +321,6 @@ pub(crate) trait Timeline<T: Types> {
     fn per_timeline_state(&self) -> &PerTimelineState<T>;
 }
 
-/// Errors returned by [`Cache::get`].
-#[derive(Debug)]
-pub(crate) enum GetError<T: Types> {
-    TenantManager(T::TenantManagerError),
-    PerTimelineStateShutDown,
-}
-
 /// Internal type used in [`Cache::get`].
 enum RoutingResult<T: Types> {
     FastPath(Handle<T>),
@@ -345,7 +337,7 @@ impl<T: Types> Cache<T> {
         timeline_id: TimelineId,
         shard_selector: ShardSelector,
         tenant_manager: &T::TenantManager,
-    ) -> Result<Handle<T>, GetError<T>> {
+    ) -> Result<Handle<T>, GetActiveTimelineError> {
         const GET_MAX_RETRIES: usize = 10;
         const RETRY_BACKOFF: Duration = Duration::from_millis(100);
         let mut attempt = 0;
@@ -356,7 +348,11 @@ impl<T: Types> Cache<T> {
                 .await
             {
                 Ok(handle) => return Ok(handle),
-                Err(e) => {
+                Err(
+                    e @ GetActiveTimelineError::Tenant(GetActiveTenantError::WaitForActiveTimeout {
+                        ..
+                    }),
+                ) => {
                     // Retry on tenant manager error to handle tenant split more gracefully
                     if attempt < GET_MAX_RETRIES {
                         tokio::time::sleep(RETRY_BACKOFF).await;
@@ -370,6 +366,7 @@ impl<T: Types> Cache<T> {
                         return Err(e);
                     }
                 }
+                Err(err) => return Err(err),
             }
         }
     }
@@ -388,7 +385,7 @@ impl<T: Types> Cache<T> {
         timeline_id: TimelineId,
         shard_selector: ShardSelector,
         tenant_manager: &T::TenantManager,
-    ) -> Result<Handle<T>, GetError<T>> {
+    ) -> Result<Handle<T>, GetActiveTimelineError> {
         // terminates because when every iteration we remove an element from the map
         let miss: ShardSelector = loop {
             let routing_state = self.shard_routing(timeline_id, shard_selector);
@@ -468,60 +465,50 @@ impl<T: Types> Cache<T> {
         timeline_id: TimelineId,
         shard_selector: ShardSelector,
         tenant_manager: &T::TenantManager,
-    ) -> Result<Handle<T>, GetError<T>> {
-        match tenant_manager.resolve(timeline_id, shard_selector).await {
-            Ok(timeline) => {
-                let key = timeline.shard_timeline_id();
-                match &shard_selector {
-                    ShardSelector::Zero => assert_eq!(key.shard_index.shard_number, ShardNumber(0)),
-                    ShardSelector::Page(_) => (), // gotta trust tenant_manager
-                    ShardSelector::Known(idx) => assert_eq!(idx, &key.shard_index),
-                }
+    ) -> Result<Handle<T>, GetActiveTimelineError> {
+        let timeline = tenant_manager.resolve(timeline_id, shard_selector).await?;
+        let key = timeline.shard_timeline_id();
+        match &shard_selector {
+            ShardSelector::Zero => assert_eq!(key.shard_index.shard_number, ShardNumber(0)),
+            ShardSelector::Page(_) => (), // gotta trust tenant_manager
+            ShardSelector::Known(idx) => assert_eq!(idx, &key.shard_index),
+        }
 
-                trace!("creating new HandleInner");
-                let timeline = Arc::new(timeline);
-                let handle_inner_arc =
-                    Arc::new(Mutex::new(HandleInner::Open(Arc::clone(&timeline))));
-                let handle_weak = WeakHandle {
-                    inner: Arc::downgrade(&handle_inner_arc),
-                };
-                let handle = handle_weak
-                    .upgrade()
-                    .ok()
-                    .expect("we jus
```

---

### Incident Patch 11: `58327cbb` (2025-07-29)
**Commit Message**: storcon: wait for the migration from the drained node in the draining loop (#12754)

## Problem
We have seen some errors in staging when the shard migration was
triggered by optimizations, and it was ongoing during draining the node
it was migrating from. It happens because the node draining loop only
waits for the migrations started by the drain loop itself. The ongoing
migrations are ignored.

Closes: https://databricks.atlassian.net/browse/LKB-1625

## Summary of changes
- Wait for the shard reconciliation during the drain if it is being
migrated from the drained node.

**File**: `storage_controller/src/operation_utils.rs` (modified, +40/-6)
```diff
@@ -46,11 +46,31 @@ impl TenantShardDrain {
         &self,
         tenants: &BTreeMap<TenantShardId, TenantShard>,
         scheduler: &Scheduler,
-    ) -> Option<NodeId> {
-        let tenant_shard = tenants.get(&self.tenant_shard_id)?;
+    ) -> TenantShardDrainAction {
+        let Some(tenant_shard) = tenants.get(&self.tenant_shard_id) else {
+            return TenantShardDrainAction::Skip;
+        };
 
         if *tenant_shard.intent.get_attached() != Some(self.drained_node) {
-            return None;
+            // If the intent attached node is not the drained node, check the observed state
+            // of the shard on the drained node. If it is Attached*, it means the shard is
+            // beeing migrated from the drained node. The drain loop needs to wait for the
+            // reconciliation to complete for a smooth draining.
+
+            use pageserver_api::models::LocationConfigMode::*;
+
+            let attach_mode = tenant_shard
+                .observed
+                .locations
+                .get(&self.drained_node)
+                .and_then(|observed| observed.conf.as_ref().map(|conf| conf.mode));
+
+            return match (attach_mode, tenant_shard.intent.get_attached()) {
+                (Some(AttachedSingle | AttachedMulti | AttachedStale), Some(intent_node_id)) => {
+                    TenantShardDrainAction::Reconcile(*intent_node_id)
+                }
+                _ => TenantShardDrainAction::Skip,
+            };
         }
 
         // Only tenants with a normal (Active) scheduling policy are proactively moved
@@ -63,19 +83,19 @@ impl TenantShardDrain {
             }
             ShardSchedulingPolicy::Pause | ShardSchedulingPolicy::Stop => {
                 // If we have been asked to avoid rescheduling this shard, then do not migrate it during a drain
-                return None;
+                return TenantShardDrainAction::Skip;
             }
         }
 
         match tenant_shard.preferred_secondary(scheduler) {
-            Some(node) => Some(node),
+            Some(node) => TenantShardDrainAction::RescheduleToSecondary(node),
             None => {
                 tracing::warn!(
                     tenant_id=%self.tenant_shard_id.tenant_id, shard_id=%self.tenant_shard_id.shard_slug(),
                     "No eligible secondary while draining {}", self.drained_node
                 );
 
-                None
+                TenantShardDrainAction::Skip
             }
         }
     }
@@ -138,3 +158,17 @@ impl TenantShardDrain {
         }
     }
 }
+
+/// Action to take when draining a tenant shard.
+pub(crate) enum TenantShardDrainAction {
+    /// The tenant shard is on the draining node.
+    /// Reschedule the tenant shard to a secondary location.
+    /// Holds a destination node id to reschedule to.
+    RescheduleToSecondary(NodeId),
+    /// The tenant shard is beeing migrated from the draining node.
+    /// Wait for the reconciliation to complete.
+    /// Holds the intent attached node id.
+    Reconcile(NodeId),
+    /// The tenant shard is not eligible for drainining, skip it.
+    Skip,
+}
```

**File**: `storage_controller/src/service.rs` (modified, +22/-17)
```diff
@@ -79,7 +79,7 @@ use crate::id_lock_map::{
 use crate::leadership::Leadership;
 use crate::metrics;
 use crate::node::{AvailabilityTransition, Node};
-use crate::operation_utils::{self, TenantShardDrain};
+use crate::operation_utils::{self, TenantShardDrain, TenantShardDrainAction};
 use crate::pageserver_client::PageserverClient;
 use crate::peer_client::GlobalObservedState;
 use crate::persistence::split_state::SplitState;
@@ -1274,7 +1274,7 @@ impl Service {
                 // Always attempt autosplits. Sharding is crucial for bulk ingest performance, so we
                 // must be responsive when new projects begin ingesting and reach the threshold.
                 self.autosplit_tenants().await;
-            }
+              },
               _ = self.reconcilers_cancel.cancelled() => return
             }
         }
@@ -8876,6 +8876,9 @@ impl Service {
         for (_tenant_id, schedule_context, shards) in
             TenantShardExclusiveIterator::new(tenants, ScheduleMode::Speculative)
         {
+            if work.len() >= MAX_OPTIMIZATIONS_PLAN_PER_PASS {
+                break;
+            }
             for shard in shards {
                 if work.len() >= MAX_OPTIMIZATIONS_PLAN_PER_PASS {
                     break;
@@ -9640,16 +9643,16 @@ impl Service {
                     tenant_shard_id: tid,
                 };
 
-                let dest_node_id = {
+                let drain_action = {
                     let locked = self.inner.read().unwrap();
+                    tid_drain.tenant_shard_eligible_for_drain(&locked.tenants, &locked.scheduler)
+                };
 
-                    match tid_drain
-                        .tenant_shard_eligible_for_drain(&locked.tenants, &locked.scheduler)
-                    {
-                        Some(node_id) => node_id,
-                        None => {
-                            continue;
-                        }
+                let dest_node_id = match drain_action {
+                    TenantShardDrainAction::RescheduleToSecondary(dest_node_id) => dest_node_id,
+                    TenantShardDrainAction::Reconcile(intent_node_id) => intent_node_id,
+                    TenantShardDrainAction::Skip => {
+                        continue;
                     }
                 };
 
@@ -9684,14 +9687,16 @@ impl Service {
                 {
                     let mut locked = self.inner.write().unwrap();
                     let (nodes, tenants, scheduler) = locked.parts_mut();
-                    let rescheduled = tid_drain.reschedule_to_secondary(
-                        dest_node_id,
-                        tenants,
-                        scheduler,
-                        nodes,
-                    )?;
 
-                    if let Some(tenant_shard) = rescheduled {
+                    let tenant_shard = match drain_action {
+                        TenantShardDrainAction::RescheduleToSecondary(dest_node_id) => tid_drain
+                            .reschedule_to_secondary(dest_node_id, tenants, scheduler, nodes)?,
+                        TenantShardDrainAction::Reconcile(_) => tenants.get_mut(&tid),
+                        // Note: Unreachable, handled above.
+                        TenantShardDrainAction::Skip => None,
+                    };
+
+                    if let Some(tenant_shard) = tenant_shard {
                         let waiter = self.maybe_configured_reconcile_shard(
                             tenant_shard,
                             nodes,
```

**File**: `storage_controller/src/tenant_shard.rs` (modified, +0/-2)
```diff
@@ -812,8 +812,6 @@ impl TenantShard {
     /// if the swap is not possible and leaves the intent state in its original state.
     ///
     /// Arguments:
-    /// `attached_to`: the currently attached location matching the intent state (may be None if the
-    /// shard is not attached)
     /// `promote_to`: an optional secondary location of this tenant shard. If set to None, we ask
     /// the scheduler to recommend a node
     pub(crate) fn reschedule_to_secondary(
```

---

### Incident Patch 12: `1ed72529` (2025-07-29)
**Commit Message**: Add a workaround for the clickhouse 24.9+ problem causing an error (#12767)

## Problem
We used ClickHouse v. 24.8, which is outdated, for logical replication
testing. We could miss some problems.
## Summary of changes
The version was updated to 25.6, with a workaround using the environment
variable `PGSSLCERT`.

Co-authored-by: Alexey Masterov <[REDACTED_EMAIL]>

**File**: `.github/workflows/pg-clients.yml` (modified, +2/-1)
```diff
@@ -72,9 +72,10 @@ jobs:
       options: --init --user root
     services:
       clickhouse:
-        image: clickhouse/clickhouse-server:24.8
+        image: clickhouse/clickhouse-server:25.6
         env:
           CLICKHOUSE_PASSWORD: ${{ needs.generate-ch-tmppw.outputs.tmp_val }}
+          PGSSLCERT: /tmp/postgresql.crt
         ports:
           - 9000:9000
           - 8123:8123
```

---

### Incident Patch 13: `30b57334` (2025-07-29)
**Commit Message**: test_lsn_lease_storcon: ignore ShardSplit warning in debug builds (#12770)

## Problem

`test_lsn_lease_storcon` might fail in debug builds due to slow
ShardSplit

## Summary of changes
- Make `test_lsn_lease_storcon ` test to ignore `.*Exclusive lock by
ShardSplit was held.*` warning in debug builds

Ref: https://databricks.slack.com/archives/C09254R641L/p1753777051481029

**File**: `test_runner/regress/test_tenant_size.py` (modified, +9/-0)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import os
 from concurrent.futures import ThreadPoolExecutor
 from typing import TYPE_CHECKING
 
@@ -768,6 +769,14 @@ def test_lsn_lease_storcon(neon_env_builder: NeonEnvBuilder):
         "compaction_period": "0s",
     }
     env = neon_env_builder.init_start(initial_tenant_conf=conf)
+    # ShardSplit is slow in debug builds, so ignore the warning
+    if os.getenv("BUILD_TYPE", "debug") == "debug":
+        env.storage_controller.allowed_errors.extend(
+            [
+                ".*Exclusive lock by ShardSplit was held.*",
+            ]
+        )
+
     with env.endpoints.create_start(
         "main",
     ) as ep:
```

---

### Incident Patch 14: `6be57217` (2025-07-28)
**Commit Message**: chore: Fix nightly lints (#12746)

- Remove some unused code
- Use `is_multiple_of()` instead of '%'
- Collapse consecuative "if let" statements
- Elided lifetime fixes

It is enough just to review the code of your team

**File**: `libs/http-utils/src/endpoint.rs` (modified, +5/-5)
```diff
@@ -558,11 +558,11 @@ async fn add_request_id_header_to_response(
     mut res: Response<Body>,
     req_info: RequestInfo,
 ) -> Result<Response<Body>, ApiError> {
-    if let Some(request_id) = req_info.context::<RequestId>() {
-        if let Ok(request_header_value) = HeaderValue::from_str(&request_id.0) {
-            res.headers_mut()
-                .insert(&X_REQUEST_ID_HEADER, request_header_value);
-        };
+    if let Some(request_id) = req_info.context::<RequestId>()
+        && let Ok(request_header_value) = HeaderValue::from_str(&request_id.0)
+    {
+        res.headers_mut()
+            .insert(&X_REQUEST_ID_HEADER, request_header_value);
     };
 
     Ok(res)
```

**File**: `libs/http-utils/src/server.rs` (modified, +4/-4)
```diff
@@ -72,10 +72,10 @@ impl Server {
             if err.is_incomplete_message() || err.is_closed() || err.is_timeout() {
                 return true;
             }
-            if let Some(inner) = err.source() {
-                if let Some(io) = inner.downcast_ref::<std::io::Error>() {
-                    return suppress_io_error(io);
-                }
+            if let Some(inner) = err.source()
+                && let Some(io) = inner.downcast_ref::<std::io::Error>()
+            {
+                return suppress_io_error(io);
             }
             false
         }
```

**File**: `libs/neon-shmem/src/hash.rs` (modified, +1/-1)
```diff
@@ -363,7 +363,7 @@ where
     // TODO: An Iterator might be nicer. The communicator's clock algorithm needs to
     // _slowly_ iterate through all buckets with its clock hand,  without holding a lock.
     // If we switch to an Iterator, it must not hold the lock.
-    pub fn get_at_bucket(&self, pos: usize) -> Option<ValueReadGuard<(K, V)>> {
+    pub fn get_at_bucket(&self, pos: usize) -> Option<ValueReadGuard<'_, (K, V)>> {
         let map = unsafe { self.shared_ptr.as_ref() }.unwrap().read();
         if pos >= map.buckets.len() {
             return None;
```

**File**: `libs/tracing-utils/src/perf_span.rs` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ impl PerfSpan {
         }
     }
 
-    pub fn enter(&self) -> PerfSpanEntered {
+    pub fn enter(&self) -> PerfSpanEntered<'_> {
         if let Some(ref id) = self.inner.id() {
             self.dispatch.enter(id);
         }
```

**File**: `proxy/src/metrics.rs` (modified, +0/-8)
```diff
@@ -553,14 +553,6 @@ impl From<bool> for Bool {
     }
 }
 
-#[derive(LabelGroup)]
-#[label(set = InvalidEndpointsSet)]
-pub struct InvalidEndpointsGroup {
-    pub protocol: Protocol,
-    pub rejected: Bool,
-    pub outcome: ConnectOutcome,
-}
-
 #[derive(LabelGroup)]
 #[label(set = RetriesMetricSet)]
 pub struct RetriesMetricGroup {
```

**File**: `proxy/src/stream.rs` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ pub struct ReportedError {
 }
 
 impl ReportedError {
-    pub fn new(e: (impl UserFacingError + Into<anyhow::Error>)) -> Self {
+    pub fn new(e: impl UserFacingError + Into<anyhow::Error>) -> Self {
         let error_kind = e.get_error_kind();
         Self {
             source: e.into(),
```

---

### Incident Patch 15: `fe7a4e1a` (2025-07-28)
**Commit Message**: fix(test): wait compaction in timeline offload test (#12673)

## Problem

close LKB-753. `test_pageserver_metrics_removed_after_offload` is
unstable and it sometimes leave the metrics behind after tenant
offloading. It turns out that we triggered an image compaction before
the offload and the job was stopped after the offload request was
completed.

## Summary of changes

Wait all background tasks to finish before checking the metrics.

---------

Signed-off-by: Alex Chi Z <[REDACTED_EMAIL]>

**File**: `test_runner/regress/test_tenants.py` (modified, +31/-3)
```diff
@@ -298,15 +298,26 @@ def get_ps_metric_samples_for_tenant(tenant_id: TenantId) -> list[Sample]:
         assert post_detach_samples == set()
 
 
-def test_pageserver_metrics_removed_after_offload(neon_env_builder: NeonEnvBuilder):
+@pytest.mark.parametrize("compaction", ["compaction_enabled", "compaction_disabled"])
+def test_pageserver_metrics_removed_after_offload(
+    neon_env_builder: NeonEnvBuilder, compaction: str
+):
     """Tests that when a timeline is offloaded, the tenant specific metrics are not left behind"""
 
     neon_env_builder.enable_pageserver_remote_storage(RemoteStorageKind.MOCK_S3)
-
     neon_env_builder.num_safekeepers = 3
 
     env = neon_env_builder.init_start()
-    tenant_1, _ = env.create_tenant()
+    tenant_1, _ = env.create_tenant(
+        conf={
+            # disable background compaction and GC so that we don't have leftover tasks
+            # after offloading.
+            "gc_period": "0s",
+            "compaction_period": "0s",
+        }
+        if compaction == "compaction_disabled"
+        else None
+    )
 
     timeline_1 = env.create_timeline("test_metrics_removed_after_offload_1", tenant_id=tenant_1)
     timeline_2 = env.create_timeline("test_metrics_removed_after_offload_2", tenant_id=tenant_1)
@@ -351,6 +362,23 @@ def get_ps_metric_samples_for_timeline(
             state=TimelineArchivalState.ARCHIVED,
         )
         env.pageserver.http_client().timeline_offload(tenant_1, timeline)
+        # We need to wait until all background jobs are finished before we can check the metrics.
+        # There're many of them: compaction, GC, etc.
+        wait_until(
+            lambda: all(
+                sample.value == 0
+                for sample in env.pageserver.http_client()
+                .get_metrics()
+                .query_all("pageserver_background_loop_semaphore_waiting_tasks")
+            )
+            and all(
+                sample.value == 0
+                for sample in env.pageserver.http_client()
+                .get_metrics()
+                .query_all("pageserver_background_loop_semaphore_running_tasks")
+            )
+        )
+
         post_offload_samples = set(
             [x.name for x in get_ps_metric_samples_for_timeline(tenant_1, timeline)]
         )
```

#### Recent Merged Pull Requests:
- **PR #12944** (closed): fix(compute): validate `prewarm_local_cache()` state length before header access (@k15z)
- **PR #12940** (2026-08-31): docs: fix typo proccess -> process (@vaibhav8a)
- **PR #12920** (closed): proxy: forward session timeout GUCs from startup packet to compute (@ruchi-mish90)
- **PR #12913** (closed): compute_ctl: add /terminate?if_idle to terminate only when idle (@Sociopacific)
- **PR #12912** (closed): compute_ctl: expose session/walsender/autovacuum counts in /status (@Sociopacific)
- **PR #12911** (closed): proxy: include client peer address in control plane requests (@Sociopacific)
- **PR #12903** (closed): ci: add ActionScope GitHub Actions security exposure scan (@r12habh)
- **PR #12899** (2026-05-25): proxy: split password hack payload on first separator (@akhilesharora)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
