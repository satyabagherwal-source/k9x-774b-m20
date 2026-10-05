# Forensic Learning Record (Deep Inspection): the-open-engine/zeroshot

> **Canonical Artifact**: `07_PROJECT_LEARNING/the-open-engine-zeroshot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/the-open-engine/zeroshot](https://github.com/the-open-engine/zeroshot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:24:36.899Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `the-open-engine/zeroshot`
- **Description**: Independent executor–verifier orchestration for software changes.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 1915 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `commitlint.config.js`
```
module.exports = {
  extends: ['@commitlint/config-conventional'],
  defaultIgnores: false,
  rules: {
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};

```

### Core Architecture Module: `crates/openengine-cluster-client/src/agent_attach.rs`
```
//! Typed in-process `agent/attach` subscription client. Wraps a [`Dispatcher`] directly since
//! NDJSON/WebSocket subscription framing is bound by a later issue. No dedup or reconnect logic
//! exists here -- `agent/attach` has no cursor to resume from.

use openengine_cluster_protocol::{AgentAttachParams, AgentAttachResult};
use openengine_cluster_server::agent_attach::{AgentAttachEventStream, AgentAttachHandle};
use openengine_cluster_server::{BackendError, ClusterBackend, Dispatcher};

/// Typed in-process `agent/attach` client. Wraps a [`Dispatcher`] directly since NDJSON/WebSocket
/// subscription framing is bound by a later issue.
pub struct AgentAttachClient<B> {
    dispatcher: Dispatcher<B>,
}

impl<B> AgentAttachClient<B>
where
    B: ClusterBackend,
{
    #[must_use]
    pub const fn new(dispatcher: Dispatcher<B>) -> Self {
        Self { dispatcher }
    }

    pub async fn agent_attach(
        &self,
        params: AgentAttachParams,
    ) -> Result<(AgentAttachResult, AgentAttachEventStream, AgentAttachHandle), BackendError> {
        self.dispatcher.agent_attach(params).await
    }
}

```

### Core Architecture Module: `crates/openengine-cluster-client/src/lib.rs`
```
//! Typed transport-neutral Cluster Protocol client.

mod multiplex;
mod ndjson_pump;
mod ndjson_subscription;

pub mod agent_attach;
pub mod logs;
pub mod native_v2;
pub mod ndjson_agent_attach;
pub mod ndjson_logs;
pub mod ndjson_watch;
pub mod watch;
pub mod websocket;
pub use agent_attach::*;
pub use logs::*;
pub use ndjson_agent_attach::*;
pub use ndjson_logs::*;
pub use ndjson_watch::*;
pub use native_v2::*;
pub use watch::*;
pub use websocket::*;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::Arc;

use parking_lot::Mutex as ParkingMutex;
use async_trait::async_trait;
use openengine_cluster_protocol::{
    ApplyParams, ApplyResult, DeleteParams, DeleteResult, GetParams, GetResult, InitializeParams,
    InitializeResult, JsonRpcError, JsonRpcErrorResponse, JsonRpcRequest, JsonRpcSuccess,
    PlanParams, PlanResult, RequestId, ResubmitParams, ResubmitResult, RetryParams, RetryResult,
    RunCheckpointsParams, RunCheckpointsResult, RunDiscardWorkspaceParams,
    RunDiscardWorkspaceResult, RunForceParams, RunForceResult, RunListParams, RunListResult,
    RunResumeParams, RunResumeResult, RunStatusParams, RunStatusResult, RunSubmitParams,
    RunSubmitResult, StopParams, StopResult, SubscriptionId, UpdateParams, UpdateResult,
    JSON_RPC_VERSION, PROTOCOL_VERSION, RUN_DISCARD_WORKSPACE_METHOD, RUN_CHECKPOINTS_METHOD,
    RUN_FORCE_METHOD, RUN_LIST_METHOD, RUN_RESUME_METHOD, RUN_STATUS_METHOD, RUN_SUBMIT_METHOD,
};
use openengine_cluster_server::{ClusterBackend, Dispatcher};
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;
use thiserror::Error;
use tokio::io::{AsyncRead, AsyncWrite, AsyncWriteExt};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio_stream::StreamExt;
use tokio_util::codec::{FramedRead, LinesCodec};

#[derive(Debug, Error)]
pub enum TransportError {
    #[error("transport I/O failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("transport protocol failed: {0}")]
    Protocol(String),
}

#[async_trait]
pub trait JsonRpcTransport: Send + Sync {
    async fn request(&self, request: String) -> Result<String, TransportError>;
}

/// Forwarding impl so one transport (e.g. an [`NdjsonTransport`]) can back a
/// [`ClusterClient`] and a subscription client (e.g. [`NdjsonWatchClient`]) at the same time,
/// each holding only a shared reference to it.
#[async_trait]
impl<T> JsonRpcTransport for &T
where
    T: JsonRpcTransport + ?Sized,
{
    async fn request(&self, request: String) -> Result<String, TransportError> {
        (**self).request(request).await
    }
}

/// Transport-neutral generic subscription framing: establishing a `watch`/`logs`/`agent/attach`
/// request, cancelling an established subscription, and best-effort cancelling any in-flight
/// unary request by id. Implemented once per wire transport ([`NdjsonTransport`],
/// [`crate::websocket::WebSocketTransport`]) so [`crate::watch::ReconnectingEventStream`]-shaped
/// subscription clients (`WatchSubscriptionClient` and the `logs`/`agent_attach` counterparts
/// generated by the private `ndjson_subscription` helper) drive either transport
/// through the exact same generic code.
#[async_trait]
pub trait SubscriptionTransport: JsonRpcTransport {
    /// Sends a subscription-establishing request and returns its response line plus, only on
    /// success, the receiver registered for its subscription's notifications.
    async fn open_subscription(
        &self,
        request: String,
        id: RequestId,
    ) -> Result<(String, Option<PumpedSubscription>), TransportError>;

    /// Sends a `subscription/cancel` notification. Fire-and-forget: cancellation has no response
    /// on the wire, so this only reports a write failure.
    async fn cancel_subscription(&self, id: SubscriptionId) -> Result<(), TransportError>;

    /// Sends a `$/cancelRequest` notification best-effort cancelling an in-flight unary request by
    /// id. Fire-and-forget, exactly like [`Self::cancel_subscription`]; the server silently
    /// no-ops an unknown or already-completed id and never claims a rollback after commit.
    async fn cancel_request(&self, id: RequestId) -> Result<(), TransportError>;

    /// Mints the next request id for a subscription-establishing request, from a counter shared by
    /// this transport's connection rather than a client-local one, so independently constructed
    /// subscription clients on one connection cannot replace each other's pending response
    /// waiters.
    fn next_watch_request_id(&self) -> RequestId;
}

pub struct InProcessTransport<B> {
    dispatcher: Dispatcher<B>,
}

impl<B> InProcessTransport<B>
where
    B: ClusterBackend,
{
    #[must_use]
    pub const fn new(dispatcher: Dispatcher<B>) -> Self {
        Self { dispatcher }
    }
}

#[async_trait]
impl<B> JsonRpcTransport for InProcessTransport<B>
where
    B: ClusterBackend,
{
    async fn request(&self, request: String) -> Result<String, TransportError> {
        Ok(self.dispatcher.dispatch(&request).await)
    }
}

/// Bounded NDJSON frame length, matching the server's `serve_ndjson` bound.
const MAX_FRAME_BYTES: usize = 1_048_576;

/// Bounded per-subscription local buffer of raw notification lines awaiting
/// [`NdjsonReconnectingEventStream::next`]. Delivery into this queue is non-blocking so one
/// abandoned subscription cannot stall the connection's sole response pump.
const SUBSCRIPTION_QUEUE_CAPACITY: usize = 1024;

/// One demultiplexed unary response: the raw response line plus, only for a successful `watch`
/// response, the freshly registered receiver for that subscription's `event`/`subscription/closed`
/// notifications.
struct PumpedResponse {
    line: String,
    subscription: Option<PumpedSubscription>,
}

/// Opaque per-subscription handle handed from [`SubscriptionTransport::open_subscription`] to a
/// subscription client: the receiver end of that subscription's forwarded notification lines,
/// plus the shared overflow flag its pump sets on a full/abandoned local queue. Its fields are
/// crate-private; only [`SubscriptionTransport`] implementors and subscription clients wire them.
pub struct PumpedSubscription {
    pub(crate) receiver: mpsc::Receiver<String>,
    pub(crate) overflowed: Arc<AtomicBool>,
}

#[derive(Clone)]
struct SubscriptionRegistration {
    sender: mpsc::Sender<String>,
    overflowed: Arc<AtomicBool>,
}

type PendingMap = Arc<ParkingMutex<HashMap<RequestId, oneshot::Sender<PumpedResponse>>>>;
type SubscriptionMap = Arc<ParkingMutex<HashMap<SubscriptionId, SubscriptionRegistration>>>;

/// Writes one line (a trailing `\n`, flushed) to a shared writer -- the [`multiplex::FrameSink`]
/// implementation backing [`NdjsonTransport`].
struct NdjsonFrameSink<W> {
    writer: Arc<Mutex<W>>,
}

#[async_trait]
impl<W> multiplex::FrameSink for NdjsonFrameSink<W>
where
    W: AsyncWrite + Send + Unpin,
{
    async fn send_frame(&self, frame: String) -> Result<(), TransportError> {
        let mut writer = self.writer.lock().await;
        writer.write_all(frame.as_bytes()).await?;
        writer.write_all(b"\n").await?;
        writer.flush().await?;
        Ok(())
    }
}

/// NDJSON stdio transport that demultiplexes unary request/response traffic and generic `watch`
/// subscription notifications sharing one connection, correlating by request id and subscription
/// id respectively. Holds one private `MultiplexedTransport`, which owns the demux state
/// (write sink, pending-request map, pump task, watch-id counter) and implements every
/// [`JsonRpcTransport`]/[`SubscriptionTransport`] method against it -- see
/// [`crate::websocket::WebSocketTransport`] for the identical WebSocket-frame binding.
pub struct NdjsonTransport<R, W> {
    inner: multiplex::MultiplexedTransport<NdjsonFrameSink<W>>,
    _reader: std::marker::PhantomData<fn() -> R>,
}

impl<R, W> NdjsonTransport<R, W>
where
    R: AsyncRead + Send + Unpin + 'static,
    W: AsyncWrite + Send + Unpin + 
```

### Core Architecture Module: `crates/openengine-cluster-client/src/logs.rs`
```
//! Typed in-process `logs` subscription client. Wraps a [`Dispatcher`] directly since NDJSON/
//! WebSocket subscription framing is bound by a later issue. No dedup or reconnect logic exists
//! here -- `logs` has no cursor to resume from.

use openengine_cluster_protocol::{LogsParams, LogsResult};
use openengine_cluster_server::logs::{LogEventStream, LogsHandle};
use openengine_cluster_server::{BackendError, ClusterBackend, Dispatcher};

/// Typed in-process `logs` client. Wraps a [`Dispatcher`] directly since NDJSON/WebSocket
/// subscription framing is bound by a later issue.
pub struct LogsClient<B> {
    dispatcher: Dispatcher<B>,
}

impl<B> LogsClient<B>
where
    B: ClusterBackend,
{
    #[must_use]
    pub const fn new(dispatcher: Dispatcher<B>) -> Self {
        Self { dispatcher }
    }

    pub async fn logs(
        &self,
        params: LogsParams,
    ) -> Result<(LogsResult, LogEventStream, LogsHandle), BackendError> {
        self.dispatcher.logs(params).await
    }
}

```

### Core Architecture Module: `crates/openengine-cluster-client/src/multiplex.rs`
```
//! Shared request/subscription demultiplexing machinery, implemented once and reused verbatim by
//! [`crate::NdjsonTransport`] (NDJSON lines) and [`crate::websocket::WebSocketTransport`]
//! (`Message::Text` frames) so both wire bindings drive this crate's [`crate::JsonRpcTransport`]/
//! [`crate::SubscriptionTransport`] methods through identical code regardless of frame shape.

use std::collections::hash_map::Entry;
use std::sync::atomic::{AtomicU64, Ordering};

use async_trait::async_trait;
use openengine_cluster_protocol::{
    CancelRequestParams, JsonRpcNotification, RequestId, SubscriptionCancelParams, SubscriptionId,
    JSON_RPC_VERSION,
};
use tokio::sync::oneshot;
use tokio::task::JoinHandle;

use crate::ndjson_pump::route_pumped_message;
use crate::{
    extract_request_id, JsonRpcTransport, PendingMap, PumpedResponse, PumpedSubscription,
    SubscriptionMap, SubscriptionTransport, TransportError,
};

/// Abstraction over "write one already-serialized JSON-RPC frame to the peer", implemented once
/// per wire transport ([`crate::NdjsonFrameSink`], [`crate::websocket::WebSocketFrameSink`]) so
/// the demultiplexing logic below is implemented exactly once regardless of the underlying frame
/// shape (NDJSON line vs. `Message::Text`).
#[async_trait]
pub(crate) trait FrameSink: Send + Sync {
    async fn send_frame(&self, frame: String) -> Result<(), TransportError>;
}

/// Registers `id` as pending, writes `request`, and awaits its demultiplexed response. Shared body
/// of `NdjsonTransport::send_request` and `WebSocketTransport::send_request`.
pub(crate) async fn send_request<F: FrameSink>(
    sink: &F,
    pending: &PendingMap,
    request: String,
    id: RequestId,
) -> Result<PumpedResponse, TransportError> {
    let (sender, receiver) = oneshot::channel();
    {
        let mut pending = pending.lock();
        match pending.entry(id.clone()) {
            Entry::Vacant(entry) => {
                entry.insert(sender);
            }
            Entry::Occupied(_) => {
                return Err(TransportError::Protocol(format!(
                    "request id is already pending: {id:?}"
                )));
            }
        }
    }
    if let Err(error) = sink.send_frame(request).await {
        pending.lock().remove(&id);
        return Err(error);
    }
    receiver.await.map_err(|_| {
        TransportError::Protocol("server closed the connection before responding".to_owned())
    })
}

/// Shared body of both transports' [`crate::JsonRpcTransport::request`] impl.
pub(crate) async fn request<F: FrameSink>(
    sink: &F,
    pending: &PendingMap,
    request: String,
) -> Result<String, TransportError> {
    let id = extract_request_id(&request)?;
    Ok(send_request(sink, pending, request, id).await?.line)
}

/// Shared body of both transports' [`crate::SubscriptionTransport::open_subscription`] impl.
pub(crate) async fn open_subscription<F: FrameSink>(
    sink: &F,
    pending: &PendingMap,
    request: String,
    id: RequestId,
) -> Result<(String, Option<PumpedSubscription>), TransportError> {
    let response = send_request(sink, pending, request, id).await?;
    Ok((response.line, response.subscription))
}

/// Shared body of both transports' [`crate::SubscriptionTransport::cancel_subscription`] impl.
pub(crate) async fn cancel_subscription<F: FrameSink>(
    sink: &F,
    subscription_id: SubscriptionId,
) -> Result<(), TransportError> {
    let notification = serde_json::to_string(&JsonRpcNotification {
        jsonrpc: JSON_RPC_VERSION.to_owned(),
        method: "subscription/cancel".to_owned(),
        params: SubscriptionCancelParams { subscription_id },
    })
    .map_err(|error| TransportError::Protocol(error.to_string()))?;
    sink.send_frame(notification).await
}

/// Shared body of both transports' [`crate::SubscriptionTransport::cancel_request`] impl.
pub(crate) async fn cancel_request<F: FrameSink>(
    sink: &F,
    id: RequestId,
) -> Result<(), TransportError> {
    let notification = serde_json::to_string(&JsonRpcNotification {
        jsonrpc: JSON_RPC_VERSION.to_owned(),
        method: "$/cancelRequest".to_owned(),
        params: CancelRequestParams { id },
    })
    .map_err(|error| TransportError::Protocol(error.to_string()))?;
    sink.send_frame(notification).await
}

/// Shared body of both transports' [`crate::SubscriptionTransport::next_watch_request_id`] impl.
pub(crate) fn next_watch_id(counter: &AtomicU64) -> RequestId {
    RequestId::String(format!("watch-{}", counter.fetch_add(1, Ordering::Relaxed)))
}

/// Routes one decoded message body via [`route_pumped_message`] and, if it named a subscription
/// whose local queue has overflowed or been abandoned, best-effort sends its cancellation --
/// shared by both transports' pump loops.
pub(crate) async fn route_and_maybe_cancel<F: FrameSink>(
    line: String,
    pending: &PendingMap,
    subscriptions: &SubscriptionMap,
    sink: &F,
) {
    if let Some(subscription_id) = route_pumped_message(line, pending, subscriptions) {
        let _ = cancel_subscription(sink, subscription_id).await;
    }
}

/// Fails every still-pending request and ends every open subscription (dropping its sender) once
/// a pump's read half ends -- shared tail of both transports' pump loops.
pub(crate) fn finish_pump(pending: &PendingMap, subscriptions: &SubscriptionMap) {
    for (_, sender) in pending.lock().drain() {
        drop(sender);
    }
    subscriptions.lock().clear();
}

/// Owns one connection's demultiplexing state -- write sink, pending-request map, read-half pump
/// task, and per-connection watch-id counter -- and implements [`crate::JsonRpcTransport`]/
/// [`crate::SubscriptionTransport`] exactly once against it. [`crate::NdjsonTransport`] and
/// [`crate::websocket::WebSocketTransport`] each hold one of these behind their public,
/// frame-shape-specific type and forward every trait method to it single-line, so the demux
/// wiring -- not just the routing logic in the free functions above -- is implemented once
/// regardless of frame shape. (A blanket `impl<F: FrameSink> JsonRpcTransport for
/// MultiplexedTransport<F>` cannot itself satisfy `NdjsonTransport`/`WebSocketTransport`'s trait
/// bounds without a wrapper: Rust's coherence rules reject a second blanket impl over an
/// unconstrained type parameter alongside the existing `impl<T: JsonRpcTransport + ?Sized>
/// JsonRpcTransport for &T` forwarding impl, since `T` could unify with `&_`.)
pub(crate) struct MultiplexedTransport<F> {
    sink: F,
    pending: PendingMap,
    pump: JoinHandle<()>,
    next_watch_id: AtomicU64,
}

impl<F: FrameSink> MultiplexedTransport<F> {
    pub(crate) fn new(sink: F, pending: PendingMap, pump: JoinHandle<()>) -> Self {
        Self {
            sink,
            pending,
            pump,
            next_watch_id: AtomicU64::new(1),
        }
    }
}

impl<F> Drop for MultiplexedTransport<F> {
    fn drop(&mut self) {
        self.pump.abort();
    }
}

#[async_trait]
impl<F: FrameSink> JsonRpcTransport for MultiplexedTransport<F> {
    async fn request(&self, req: String) -> Result<String, TransportError> {
        request(&self.sink, &self.pending, req).await
    }
}

#[async_trait]
impl<F: FrameSink> SubscriptionTransport for MultiplexedTransport<F> {
    async fn open_subscription(
        &self,
        req: String,
        id: RequestId,
    ) -> Result<(String, Option<PumpedSubscription>), TransportError> {
        open_subscription(&self.sink, &self.pending, req, id).await
    }

    async fn cancel_subscription(
        &self,
        subscription_id: SubscriptionId,
    ) -> Result<(), TransportError> {
        cancel_subscription(&self.sink, subscription_id).await
    }

    async fn cancel_request(&self, id: RequestId) -> Result<(), TransportError> {
        cancel_request(&self.sink, id).await
    }

    fn next_watch_request_id(&self) -> RequestId {
        next_watch_id(&self.next_watch_id)
    }
}

/// Generates `JsonRpcTranspo
```

### Core Architecture Module: `crates/openengine-cluster-client/src/native_v2.rs`
```
//! Transport-generic native-v2 run subscription client.

use openengine_cluster_protocol::{
    Cursor, JsonRpcNotification, RunAttachEventNotification, RunAttachParams, RunAttachResult,
    RunLogEventNotification, RunLogsParams, RunLogsResult, RunWatchEventNotification,
    RunWatchParams, RunWatchResult, SubscriptionCloseReason, SubscriptionId, RUN_ATTACH_METHOD,
    RUN_LOGS_METHOD, RUN_WATCH_METHOD,
};
use serde::de::DeserializeOwned;
use serde::Serialize;
use crate::ndjson_subscription::{
    impl_cursor_subscription_controls, open_subscription, parse_subscription_close,
    parse_subscription_notification, PumpedLine, SubscriptionClientCore, SubscriptionStreamCore,
};
use crate::{ClientError, NdjsonTransport, SubscriptionTransport};

#[derive(Clone, Debug, PartialEq)]
pub enum RunSubscriptionEvent<E> {
    Event(E),
    Closed {
        reason: SubscriptionCloseReason,
        last_delivered_cursor: Option<Cursor>,
    },
}

pub struct RunSubscriptionClient<'a, T> {
    core: SubscriptionClientCore<'a, T>,
}

pub type NdjsonRunSubscriptionClient<'a, R, W> = RunSubscriptionClient<'a, NdjsonTransport<R, W>>;

struct RunSubscriptionShape<R, E> {
    result_subscription_id: fn(&R) -> &SubscriptionId,
    event_subscription_id: fn(&E) -> &SubscriptionId,
    event_cursor: fn(&E) -> Option<&Cursor>,
}

impl<'a, T> RunSubscriptionClient<'a, T>
where
    T: SubscriptionTransport,
{
    #[must_use]
    pub const fn new(transport: &'a T) -> Self {
        Self {
            core: SubscriptionClientCore::new(transport),
        }
    }

    pub async fn run_watch(
        &self,
        params: RunWatchParams,
    ) -> Result<
        (
            RunWatchResult,
            RunSubscriptionEventStream<'a, T, RunWatchEventNotification>,
        ),
        ClientError,
    > {
        self.open(
            RUN_WATCH_METHOD,
            params,
            RunSubscriptionShape {
                result_subscription_id: watch_subscription_id,
                event_subscription_id: watch_event_subscription_id,
                event_cursor: watch_event_cursor,
            },
        )
        .await
    }

    pub async fn run_logs(
        &self,
        params: RunLogsParams,
    ) -> Result<
        (
            RunLogsResult,
            RunSubscriptionEventStream<'a, T, RunLogEventNotification>,
        ),
        ClientError,
    > {
        self.open(
            RUN_LOGS_METHOD,
            params,
            RunSubscriptionShape {
                result_subscription_id: logs_subscription_id,
                event_subscription_id: log_event_subscription_id,
                event_cursor: log_event_cursor,
            },
        )
        .await
    }

    pub async fn run_attach(
        &self,
        params: RunAttachParams,
    ) -> Result<
        (
            RunAttachResult,
            RunSubscriptionEventStream<'a, T, RunAttachEventNotification>,
        ),
        ClientError,
    > {
        self.open(
            RUN_ATTACH_METHOD,
            params,
            RunSubscriptionShape {
                result_subscription_id: attach_subscription_id,
                event_subscription_id: attach_event_subscription_id,
                event_cursor: no_event_cursor,
            },
        )
        .await
    }

    async fn open<P, R, E>(
        &self,
        method: &str,
        params: P,
        shape: RunSubscriptionShape<R, E>,
    ) -> Result<(R, RunSubscriptionEventStream<'a, T, E>), ClientError>
    where
        P: Serialize + Send,
        R: DeserializeOwned,
        E: DeserializeOwned,
    {
        let (result, subscription) =
            open_subscription(self.core.transport(), method, params).await?;
        let subscription_id = (shape.result_subscription_id)(&result).clone();
        let subscription = subscription.ok_or_else(|| {
            ClientError::InvalidResponse(
                "successful native-v2 subscription response had no notification stream".to_owned(),
            )
        })?;
        Ok((
            result,
            RunSubscriptionEventStream {
                core: SubscriptionStreamCore::new(
                    self.core.transport(),
                    subscription,
                    subscription_id,
                ),
                event_subscription_id: shape.event_subscription_id,
                event_cursor: shape.event_cursor,
                closed: false,
            },
        ))
    }
}

pub struct RunSubscriptionEventStream<'a, T, E> {
    core: SubscriptionStreamCore<'a, T>,
    event_subscription_id: fn(&E) -> &SubscriptionId,
    event_cursor: fn(&E) -> Option<&Cursor>,
    closed: bool,
}

impl<'a, T, E> RunSubscriptionEventStream<'a, T, E>
where
    T: SubscriptionTransport,
    E: DeserializeOwned,
{
    pub async fn next(&mut self) -> Option<Result<RunSubscriptionEvent<E>, ClientError>> {
        if self.closed {
            return None;
        }
        let line = match self.core.next_line().await {
            PumpedLine::Frame(line) => line,
            PumpedLine::SlowConsumer => {
                self.closed = true;
                return Some(Ok(RunSubscriptionEvent::Closed {
                    reason: SubscriptionCloseReason::SlowConsumer,
                    last_delivered_cursor: self.core.last_delivered_cursor().cloned(),
                }));
            }
            PumpedLine::End => return None,
        };
        Some(self.parse_notification(&line))
    }

    fn parse_notification(&mut self, line: &str) -> Result<RunSubscriptionEvent<E>, ClientError> {
        let (method, value) = parse_subscription_notification(line)?;
        match method.as_deref() {
            Some("event") => {
                let notification: JsonRpcNotification<E> = serde_json::from_value(value)
                    .map_err(|error| ClientError::InvalidResponse(error.to_string()))?;
                let event = notification.params;
                if (self.event_subscription_id)(&event) != self.core.subscription_id() {
                    return Err(ClientError::InvalidResponse(
                        "native-v2 event subscription id mismatch".to_owned(),
                    ));
                }
                if let Some(cursor) = (self.event_cursor)(&event) {
                    self.core.record_delivered_cursor(cursor.clone());
                }
                Ok(RunSubscriptionEvent::Event(event))
            }
            Some("subscription/closed") => {
                let (reason, observed_cursor) =
                    parse_subscription_close(value, self.core.subscription_id())?;
                let last_delivered_cursor =
                    observed_cursor.or_else(|| self.core.last_delivered_cursor().cloned());
                if let Some(cursor) = &last_delivered_cursor {
                    self.core.record_delivered_cursor(cursor.clone());
                }
                self.closed = true;
                Ok(RunSubscriptionEvent::Closed {
                    reason,
                    last_delivered_cursor,
                })
            }
            other => Err(ClientError::InvalidResponse(format!(
                "unexpected subscription notification method {other:?}"
            ))),
        }
    }

    impl_cursor_subscription_controls!();
}

fn watch_subscription_id(result: &RunWatchResult) -> &SubscriptionId {
    &result.subscription_id
}

fn logs_subscription_id(result: &RunLogsResult) -> &SubscriptionId {
    &result.subscription_id
}

fn attach_subscription_id(result: &RunAttachResult) -> &SubscriptionId {
    &result.subscription_id
}

fn watch_event_subscription_id(event: &RunWatchEventNotification) -> &SubscriptionId {
    &event.subscription_id
}

fn log_event_subscription_id(event: &RunLogEventNotification) -> &SubscriptionId {
    &event.subscription_id
}

fn attach_event_subscription_id(event: &RunAttachEventNotification) -> &SubscriptionId {
    &event.subscription_id
}

fn watch_event_cursor(event: &RunWatchEventNotification) -> Opti
```

### Core Architecture Module: `crates/openengine-cluster-client/src/ndjson_agent_attach.rs`
```
//! [`crate::SubscriptionTransport`]-generic `agent/attach` subscription client. Drives
//! `agent/attach`/`event`/`subscription/cancel`/`subscription/closed` notifications over any
//! [`crate::SubscriptionTransport`], reusing the exact same generic subscription framing
//! [`crate::ndjson_watch`]/[`crate::ndjson_logs`] use. [`NdjsonAgentAttachClient`]/
//! [`NdjsonAgentAttachEventStream`] alias this machinery to [`crate::NdjsonTransport`]. There is
//! no dedup or reconnect logic here, unlike [`crate::NdjsonReconnectingEventStream`] --
//! `agent/attach` has no cursor to resume from.

use crate::ndjson_subscription::impl_ndjson_event_subscription;

impl_ndjson_event_subscription! {
    generic_client: AgentAttachSubscriptionClient,
    generic_stream: AgentAttachSubscriptionEventStream,
    ndjson_client: NdjsonAgentAttachClient,
    ndjson_stream: NdjsonAgentAttachEventStream,
    event_or_closed: AgentAttachEventOrClosed,
    method_fn: agent_attach,
    method_name: "agent/attach",
    params: openengine_cluster_protocol::AgentAttachParams,
    result: openengine_cluster_protocol::AgentAttachResult,
    event: openengine_cluster_protocol::AgentAttachEvent,
    event_notification: openengine_cluster_protocol::AgentAttachEventNotification,
    event_field: event,
    closed_notification: openengine_cluster_protocol::AgentAttachClosedNotification,
    parse_response_fn: parse_agent_attach_response,
    parse_notification_fn: parse_agent_attach_notification,
}

```

### Core Architecture Module: `crates/openengine-cluster-client/src/ndjson_logs.rs`
```
//! [`crate::SubscriptionTransport`]-generic `logs` subscription client. Drives `logs`/`event`/
//! `subscription/cancel`/`subscription/closed` notifications over any [`crate::SubscriptionTransport`],
//! reusing the exact same generic subscription framing [`crate::ndjson_watch`] uses.
//! [`NdjsonLogsClient`]/[`NdjsonLogsEventStream`] alias this machinery to [`crate::NdjsonTransport`].
//! There is no dedup or reconnect logic here, unlike [`crate::NdjsonReconnectingEventStream`] --
//! `logs` has no cursor to resume from.

use crate::ndjson_subscription::impl_ndjson_event_subscription;

impl_ndjson_event_subscription! {
    generic_client: LogsSubscriptionClient,
    generic_stream: LogsSubscriptionEventStream,
    ndjson_client: NdjsonLogsClient,
    ndjson_stream: NdjsonLogsEventStream,
    event_or_closed: LogEventOrClosed,
    method_fn: logs,
    method_name: "logs",
    params: openengine_cluster_protocol::LogsParams,
    result: openengine_cluster_protocol::LogsResult,
    event: openengine_cluster_protocol::LogRecord,
    event_notification: openengine_cluster_protocol::LogEventNotification,
    event_field: record,
    closed_notification: openengine_cluster_protocol::LogsClosedNotification,
    parse_response_fn: parse_logs_response,
    parse_notification_fn: parse_log_notification,
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1145** (2026-09-22): **fix(target): prevent cross-run reads of ledgers and workspaces**
  *Symptoms*: A worker on a direct target can read data from another run on the same target.  `runs.sqlite3` is normally created as `0644` beneath a traversable storage root. It contains each run's graph, input, and agent output. Candidate workspace roots are `0755`, and their hashed directory names are deterministic once a run ID is known.  Keep the fix to Unix permissions:  - Before the production target opens `runs.sqlite3`, validate it as a regular, non-symlink, supervisor-owned file and create or normalize it to `0600`. Apply the same mode to existing SQLite sidecars. - Set hosted candidate workspace roots to `0700` and keep the run writer as owner. Hosted verifiers already use supervisor-created copies. Fresh, resumed, and subsequently retained workspaces must preserve this boundary. - Add a cross-UID regression test: a worker can use its own candidate but cannot read the ledger or another run's candidate. Keep verifier copies, delivery, cleanup, and workspace recovery working. - Existing persistent volumes must start without a schema change or user action; normalize the ledger when it opens.  Do not add containers, mount namespaces, a storage-format change, or a scan that rewrites dormant retained workspaces. Local execution keeps its documented same-user trust model. 
  **Post-Mortem & Fix Analysis**:
  > @zeroshot-cloud-dev run
  > Zeroshot run [`01a0ca24-19d3-7173-bb72-8ab3a524b320`](https://dev.theopenengine.com/orgs/01a0909a-a44a-7312-ac1f-e8210f092db0/runs?run=01a0ca24-19d3-7173-bb72-8ab3a524b320) has started. 🚀  <!-- zeroshot-cloud-run:01a0ca24-19d3-7173-bb72-8ab3a524b320:lifecycle -->
  > Zeroshot opened pull request #1147 for this issue.  <!-- zeroshot-delivery:zeroshot/v2-ebd84afe32c7f98d95ef -->

- **Issue #1011** (2026-08-12): **bug(delivery): custom PR body instructions are replaced with Closes #unknown**
  *Symptoms*: ## Report  A Discord user reports that recent Zeroshot releases no longer let agents populate a dynamic pull-request template. Instead, the delivery/pusher path consistently emits:  ``` Closes #unknown ```  They have used Zeroshot since approximately 6.6.0. Their custom PR instructions previously worked with Claude, apparently because Claude followed those instructions over the generated completion prompt. Codex consistently followed the generated prompt, and a recent Claude behavior change now exposes the same deterministic fallback.  ## Suspected path  The behavior appears related to `buildCompletionPrompt` and the existing completion/git-pusher prompt construction. The current behavior may always supply a fixed close line rather than carrying an explicitly configured or dynamically generated PR body into the authoritative delivery path.  ## Expected behavior  - A supported, deterministic way exists to pass a custom/dynamic PR body or PR template to the existing pusher. - Explicit PR-body input is preserved for Claude, Codex, and other providers without relying on a model ignoring Zeroshot's generated prompt. - The default body remains safe and useful when no custom body is configured. - Missing issue metadata does not produce `Closes #unknown`.  ## Investigation / acceptance criteria  - Reproduce the current behavior through the actual completion/delivery path. - Identify whether custom body configuration already exists but is dropped, or whether a bounded configuration/in
  **Post-Mortem & Fix Analysis**:
  > :tada: This issue has been resolved in version 6.39.1 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/@the-open-engine/zeroshot/v/6.39.1) - [GitHub release](https://github.com/the-open-engine/zeroshot/releases/tag/v6.39.1)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1009** (2026-08-15): **[BUG] js-yaml dependency is required at runtime**
  *Symptoms*: ## Description  A clear description of the bug.  ## Steps to Reproduce Run `zeroshot run "Add a --json flag with tests"`  ## Expected Behavior Should finish and auto-stop cluster  ## Actual Behavior ```bash   Failed to auto-stop cluster zen-spire-47: Cannot find module 'js-yaml'   Require stack:   - /home/danielsokil/.local/share/pnpm/store/v11/links/@the-open-engine/zeroshot/6.39.0/cf6f922de8de2c501e09a216d6f8820a450ddb8cc82fc6f0c6040b9c14f5a36c/node_modules/@the-open-engine/zeroshot/lib/compose-utils.js   - /home/danielsokil/.local/share/pnpm/store/v11/links/@the-open-engine/zeroshot/6.39.0/cf6f922de8de2c501e09a216d6f8820a450ddb8cc82fc6f0c6040b9c14f5a36c/node_modules/@the-open-engine/zeroshot/src/orchestrator.js   - /home/danielsokil/.local/share/pnpm/store/v11/links/@the-open-engine/zeroshot/6.39.0/cf6f922de8de2c501e09a216d6f8820a450ddb8cc82fc6f0c6040b9c14f5a36c/node_modules/@the-open-engine/zeroshot/cli/index.js ```   $ zeroshot --version 6.39.0
  **Post-Mortem & Fix Analysis**:
  > I've tested with npm, node version `v22.23.2`, same issue as with pnpm

- **Issue #939** (2026-08-12): **security(copy): enforce containment across every isolation copy sink**
  *Symptoms*: ## Problem  Follow-up to #468. The isolation copy pipeline constructs destination paths with `path.join()` but has no single enforced source/destination containment invariant.  The currently supported producer narrows the demonstrated exploit: relative names come from local `readdirSync(..., { withFileTypes: true })` traversal rather than raw archive member paths. That does not make the current shape a safe boundary. The traversal follows symlinked directories, and destination effects are split across sequential directory creation, the small synchronous copy path, and the parallel worker path. A lexical prefix check in the worker alone would leave the other sinks—and filesystem symlink escapes—untouched.  ## Required contract  - Define one source/destination containment primitive and use it before every filesystem effect in the copy pipeline. - Cover sequential directory creation, the `<100` synchronous file path, and the `>=100` worker path. - Reject absolute paths, traversal components, and any resolved source or destination outside its pinned root. - Define an explicit symlink policy. Tests must cover source symlinks escaping the source root and destination-parent symlinks escaping the destination root; lexical `path.resolve()` containment alone is insufficient. - Preserve current ignore behavior only for ordinary unreadable/broken entries. A containment violation must fail closed, not increment `skipped`. - Keep worker and non-worker behavior identical.  ## Acceptance  - 
  **Post-Mortem & Fix Analysis**:
  > :tada: This issue has been resolved in version 6.39.1 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/@the-open-engine/zeroshot/v/6.39.1) - [GitHub release](https://github.com/the-open-engine/zeroshot/releases/tag/v6.39.1)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #876** (2026-09-18): **bug(config-validator): distinguish Git prohibitions from instructions to run Git**
  *Symptoms*: ## Problem  The validator Git-safety rule rejects any validator prompt containing the raw substrings `git diff`, `git status`, `git log`, or `git show`.  Current implementation: [`validateValidatorGitUsage()`](https://github.com/the-open-engine/zeroshot/blob/c6711f6144e892f11f0c6c91d6c2664800a9b4bd/src/config-validator.js#L837-L849).  That means the rule rejects an explicit safety instruction such as:  ```text Do NOT use git diff or git status. Read files directly. ```  as if it instructed the validator to run Git. This makes the mechanical enforcement contradict the repository's own recommended prompt wording.  ## Expected behavior  Reject affirmative instructions to inspect Git state while allowing clear prohibitions of those commands.  ## Acceptance criteria  - Explicit prohibitions such as `do not use git diff`, `never run git log`, and `git status is forbidden` pass validation. - Affirmative instructions such as `run git diff` and `inspect git status` still fail. - Negation reversal remains unsafe: `do not forget to run git log` fails. - Mixed clauses are evaluated independently: `do not use git diff, but run git show` fails for `git show`. - Matching is case-insensitive. - String prompts and `prompt.system` receive identical treatment. - Failure messages identify the command/instruction and tell authors to read files directly. - Focused bidirectional tests prevent both false positives and false negatives.  ## Related  #368 proposes broader semantic config linting. This 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution and discussion!  Closing as part of the backlog cleanup following [the Rust migration in #1074](https://github.com/the-open-engine/zeroshot/pull/1074). The Node.js implementation and its associated roadmap have been retired, and this item no longer represents outstanding work for the current product.

- **Issue #875** (2026-09-18): **bug(orchestrator): cancel the conductor watchdog before ledger teardown**
  *Symptoms*: ## Problem  The conductor watchdog can outlive the cluster ledger it queries.  On current `main`, [`_registerConductorWatchdog()`](https://github.com/the-open-engine/zeroshot/blob/c6711f6144e892f11f0c6c91d6c2664800a9b4bd/src/orchestrator.js#L1653-L1715):  1. starts a 30-second timer after the conductor publishes `TASK_COMPLETED`; 2. queries `messageBus` when the timer fires; and 3. clears the timer only when `CLUSTER_OPERATIONS` is received by the handler.  If the cluster reaches another terminal path and closes its ledger during that window, the timer still fires and the query throws `The database connection is not open`. An already-completed cluster can then be reported as failed by an uncaught timer callback.  A broad `try/catch` that treats every query error as "the cluster must have finished" is also unsafe because it can hide a real ledger failure while the cluster is live. The fix should be lifecycle ownership.  ## Expected behavior  The cluster owns the watchdog. Every terminal/teardown path invalidates and clears it before closing the message bus, while a genuinely live conductor hook failure still produces `CONDUCTOR_WATCHDOG_TIMEOUT`.  ## Acceptance criteria  - The watchdog is cleared or invalidated before ledger/message-bus close on completion, failure, stop, kill, and startup rollback paths. - Receiving `CLUSTER_OPERATIONS` still clears it. - Repeated conductor completion events cannot leave an older timer armed. - Clearing is idempotent. - The timer callback can
  **Post-Mortem & Fix Analysis**:
  > I reproduced this on current main: after the conductor completes, stopping the cluster still leaves its watchdog armed, and advancing the clock emits CONDUCTOR_WATCHDOG_TIMEOUT against the stopped run; repeated completion also leaves the earlier timer active. I am working on the cluster-owned watchdog lifecycle fix with deterministic fake-timer and SQLite regressions.
  > Thanks for the contribution and discussion!  Closing as part of the backlog cleanup following [the Rust migration in #1074](https://github.com/the-open-engine/zeroshot/pull/1074). The Node.js implementation and its associated roadmap have been retired, and this item no longer represents outstanding work for the current product.

- **Issue #873** (2026-09-18): **bug(task): preserve actionable provider errors on non-zero exits**
  *Symptoms*: ## Problem  A standalone `zeroshot task run` can finish with `status: failed` and `error: null` even when the provider printed an actionable failure reason.  On current `main`:  - [`consumeStderr()`](https://github.com/the-open-engine/zeroshot/blob/c6711f6144e892f11f0c6c91d6c2664800a9b4bd/task-lib/watcher-output-runtime.js#L207-L212) writes stderr to the log but does not retain a diagnostic. - [`complete()`](https://github.com/the-open-engine/zeroshot/blob/c6711f6144e892f11f0c6c91d6c2664800a9b4bd/task-lib/watcher-output-runtime.js#L253-L280) populates `error` only for the special fatal detector, session-identity failure, or signal termination. - [`detectProviderFatalError()`](https://github.com/the-open-engine/zeroshot/blob/c6711f6144e892f11f0c6c91d6c2664800a9b4bd/src/agent-cli-provider/adapters/claude-recovery.ts#L27-L30) is Claude-only and currently recognizes one fatal text pattern. - A provider-agnostic [`classifyProviderError()`](https://github.com/the-open-engine/zeroshot/blob/c6711f6144e892f11f0c6c91d6c2664800a9b4bd/src/agent-cli-provider/adapters/index.ts#L114-L119) already exists, but the watcher terminal path does not use it.  This was observed with Gemini exiting 1 after printing `IneligibleTierError` / `UNSUPPORTED_CLIENT`: the useful cause remained buried in the log while task status exposed no error. Similar ordinary non-zero Claude exits can have the same result.  The provider rejecting a request is external. Zeroshot discarding the reason is the core bug.  ## 
  **Post-Mortem & Fix Analysis**:
  > I reproduced this on current main with a fake Gemini provider exiting 1 without a signal: SQLite persisted status=failed and exitCode=1 but error=null while the actionable IneligibleTierError / UNSUPPORTED_CLIENT diagnostic remained only in stderr. I will work on the provider-agnostic watcher fix with bounded redaction/classification and deterministic Claude, Codex, and Gemini regressions.
  > Thanks for the contribution and discussion!  Closing as part of the backlog cleanup following [the Rust migration in #1074](https://github.com/the-open-engine/zeroshot/pull/1074). The Node.js implementation and its associated roadmap have been retired, and this item no longer represents outstanding work for the current product.

- **Issue #741** (2026-07-18): **bug(attach): long HOME paths exceed Unix socket limits**
  *Symptoms*: ## Summary  After #738 made strict structured-output Codex tasks attachable, task startup can fail before provider execution when `$HOME/.zeroshot/sockets/<task>.sock` exceeds the Unix-domain socket path limit on macOS.  ## Reproduction  From exact `origin/dev` `adc2075fbf161fa17a1eeb1b7679f47d23eb4189` in `/tmp/zeroshot-release-672-dev-proof-1784387937`:  ```bash npm ci npm run test:e2e ```  Observed 5 E2E failures, including `e2e: stuck agent recovery`:  ```text listen EINVAL: invalid argument /var/folders/.../zeroshot-fake-hang-L78iVf/.zeroshot/sockets/sharp-cipher-80.sock ```  The provider never starts, so the fixture then fails reading `codex-count`.  ## Root-cause evidence  `task-lib/attachable-watcher.js` builds the socket as `join(homedir(), '.zeroshot', 'sockets', taskId + '.sock')`. E2E isolation intentionally uses a long temporary HOME. With #738, strict-output Codex and other eligible tasks now start this watcher, exposing the path-length failure.  ## Required behavior  - Socket allocation must be deterministic and shared by watcher/discovery/client code. - It must stay below platform Unix-domain path limits for long HOME/worktree/temp paths. - It must preserve per-user isolation, task uniqueness, stale-socket cleanup, permissions, registry/discovery, attach, guidance injection, and detached behavior. - Add a regression using a deliberately long HOME/path; provider execution and attach discovery must both succeed. - Rerun focused attach tests plus full E2E/slow su
  **Post-Mortem & Fix Analysis**:
  > Fixed on `dev` by PR #742, merged through the `dev` merge queue as `81c98407bba9c543d8789c379ca280c6334f8d6e` (merge-group CI run 29651544764 passed).  Independent same-reviewer re-review approved exact PR head `be73c0d13c6553720881f2811fc5927edbb6e363`. Fresh post-merge proof from a detached checkout of exact `origin/dev` SHA `81c98407bba9c543d8789c379ca280c6334f8d6e`:  - focused socket/watcher regressions: 12/12 passing - full `npm run test:e2e`: 24/24 passing - the prior macOS long-`HOME` `listen EINVAL` reproduction now passes  Closing as fixed on `dev`; this SHA is included in the 6.7.2 release candidate lane.

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

### Incident Patch 1: `d9ddeae9` (2026-09-26)
**Commit Message**: fix(delivery): respect base branch merge policy (#1164)

## Summary

Ship delivery now selects a merge method allowed by both repository
settings and the PR's base-branch policy. For example, a repository that
enables merge commits but requires linear history on `main` uses an
allowed squash or rebase method. Both branch-protection views and every
active applicable ruleset constrain the selection.

Direct merge submission reads all rule pages through a dedicated query.
PR-only delivery keeps its existing readiness contract, and merge queues
retain method selection. Fresh approval and branch-freshness checks
prevent a merge request when the PR needs to wait or update.

Permanent GitHub rejections stop with bounded, credential-redacted
diagnostics. Native CLI HTTP errors retain authentication refresh and
transient retry behavior, while merge commands retain existing
process-tree cleanup. Confirmed merges still reconcile a lost command
response. Exact-head checks and published-history guards remain
enforced.

Closes #1161.

## Validation

- Regression tests cover more than 100 applicable rules, restrictions
across pages, all repository-method combinations, protection views,
malformed 

**File**: `AGENTS.md` (modified, +8/-1)
```diff
@@ -275,7 +275,14 @@ with `npm i -g @the-open-engine-company/zeroshot` or build `zeroshot` with Cargo
   when their tree has no staged difference. Other unfinished Git operations return raw status for
   repair before staging or reconciliation. Delivery does not inspect or filter user-installed tooling.
 - GitHub delivery treats aggregate merge policy and required contexts as authority, waits through
-  merge queues/deferrals, and succeeds only after observing the exact merged result. Configured
+  merge queues/deferrals, and succeeds only after observing the exact merged result. Merge methods
+  must satisfy repository capabilities, base-ref branch protection, and every active applicable
+  ruleset returned by GitHub. Either branch-protection view can require linear history; neither
+  overrides a stricter restriction. Direct merge submission reads all rule pages with an independent
+  cursor; PR observation and queues do not require direct-method discovery. Incomplete rule reads and
+  empty method intersections stop merge submission with policy diagnostics. Merge queues choose their
+  own method. Merge commands retain contained process cleanup and use the GitHub API error boundary,
+  never Git repair; changed gates cannot mask a permanent rejection. Configured
   branch-protection contexts remain pending until they appear on the exact PR head, preventing a
   newly opened PR from looking ready before its required workflow registers. Missing or stale human
   review may satisfy PR readiness when aggregate ref-update policy positively requires approval,
```

**File**: `zeroshot/src/native_v2_delivery/github.rs` (modified, +102/-38)
```diff
@@ -247,23 +247,41 @@ impl GhCliDeliveryAuthority {
         serde_json::from_value(value).map_err(|_| GitHubAuthorityError::Rejected)
     }
 
+    async fn merge_method(
+        &self,
+        review: &GitHubReviewReceipt,
+        credential: GitHubCredential<'_>,
+        queued: bool,
+    ) -> Result<merge_policy::MergeMethod, GitHubAuthorityError> {
+        if queued {
+            return Ok(merge_policy::MergeMethod::Queue);
+        }
+        let value = self
+            .api(&merge_policy::query_arguments(review)?, credential)
+            .await?;
+        merge_policy::classify(value, review)
+    }
+
     async fn classify_rejected_merge(
         &self,
         review: &GitHubReviewReceipt,
         credential: GitHubCredential<'_>,
+        failure: &GitHubAuthorityError,
     ) -> Result<GitHubMergeRequestOutcome, GitHubAuthorityError> {
         let snapshot = self.policy_snapshot(review, credential).await?;
+        let permanent_response = !failure.retryable_operation();
         match snapshot.state {
             GitHubReviewState::Merged { .. } => Ok(GitHubMergeRequestOutcome::Accepted),
+            _ if permanent_response => Err(GitHubAuthorityError::Rejected),
             GitHubReviewState::Conflict => Ok(GitHubMergeRequestOutcome::Conflict),
             GitHubReviewState::Open { .. } if snapshot.head_update.is_some() => {
                 Ok(GitHubMergeRequestOutcome::HeadUpdateRequired)
             }
-            GitHubReviewState::Open {
-                checks: GitHubChecks::Passed | GitHubChecks::NotRequired,
-            } => Err(GitHubAuthorityError::Rejected),
-            GitHubReviewState::Open { .. } => Ok(GitHubMergeRequestOutcome::Pending),
-            GitHubReviewState::Closed => Err(GitHubAuthorityError::Rejected),
+            // A changed or pending gate cannot explain away a permanent merge rejection.
+            // Preserve the command failure unless GitHub confirms a specific reconciliation.
+            GitHubReviewState::Open { .. } | GitHubReviewState::Closed => {
+                Err(GitHubAuthorityError::Rejected)
+            }
         }
     }
 }
@@ -350,10 +368,11 @@ impl GitHubDeliveryAuthority for GhCliDeliveryAuthority {
         credential: GitHubCredential<'_>,
     ) -> Result<GitHubMergeRequestOutcome, GitHubAuthorityError> {
         let snapshot = self.policy_snapshot(review, credential).await?;
-        let merge_method = match merge_action(snapshot)? {
+        let queued = match merge_action(snapshot)? {
             MergeAction::Complete(outcome) => return Ok(outcome),
-            MergeAction::Submit(method) => method,
+            MergeAction::Submit { queued } => queued,
         };
+        let merge_method = self.merge_method(review, credential, queued).await?;
         let mut command = clean_command(&self.config, &self.config.gh_program, credential);
         command.args([
             "pr",
@@ -364,14 +383,19 @@ impl GitHubDeliveryAuthority for GhCliDeliveryAuthority {
             "--match-head-commit",
             &review.head_revision,
         ]);
-        if let Some(argument) = merge_method_argument(merge_method) {
-            command.arg(argument);
-        }
-        match bounded_status(command, self.config.api_deadline).await {
+        command.args(merge_method_argument(merge_method));
+        match api::command_status(command, self.config.api_deadline, credential).await {
             Ok(()) => Ok(GitHubMergeRequestOutcome::Accepted),
-            Err(error) => match self.classify_rejected_merge(review, credential).await {
+            Err(error) => match self
+                .classify_rejected_merge(review, credential, &error)
+                .await
+            {
                 Ok(outcome) => Ok(outcome),
-                Err(_) => Err(error),
+                Err(_) => Err(error.with_context(format!(
+                    "Merge request for {}#{} into {} using {merge_method:?} failed. \
+                     Check GitHub
```

**File**: `zeroshot/src/native_v2_delivery/github/api.rs` (modified, +51/-8)
```diff
@@ -145,6 +145,32 @@ pub(super) fn decode_response<T: serde::de::DeserializeOwned>(
     })
 }
 
+pub(super) async fn command_status(
+    mut command: Command,
+    deadline: Duration,
+    credential: GitHubCredential<'_>,
+) -> Result<(), GitHubAuthorityError> {
+    capture(&mut command, deadline)
+        .await
+        .and_then(|output| output.require_success())
+        .map(|_| ())
+        .map_err(|failure| {
+            // Capture owns the process tree; only a completed command supplies an HTTP status.
+            let response = failure
+                .exit_status
+                .filter(|_| !failure.stderr_truncated)
+                .map(|_| github_api_error(failure.stderr.as_bytes()));
+            let status = response.as_ref().and_then(GitHubAuthorityError::api_status);
+            let retryable = failure.retryable_transport()
+                || response
+                    .as_ref()
+                    .is_some_and(GitHubAuthorityError::retryable_operation)
+                || status.is_none() && github_transport_error(&failure.stderr);
+            let error = redacted_api_error(status, failure.to_string(), credential);
+            if retryable { error.temporary() } else { error }
+        })
+}
+
 async fn bounded_output(
     mut command: Command,
     deadline: Duration,
@@ -235,12 +261,7 @@ impl ApiOutput {
         let rate_limited = api_error
             .as_ref()
             .is_some_and(|error| error.api_status() == Some(403) && error.retryable_operation());
-        let transient = rate_limited
-            || api_status.is_none()
-                && stderr.lines().any(|line| {
-                    line.starts_with("error connecting to ")
-                        || line.contains(": TLS handshake timeout")
-                });
+        let transient = rate_limited || api_status.is_none() && github_transport_error(&stderr);
         let failure = redacted_api_error(
             api_status,
             format!(
@@ -328,8 +349,11 @@ fn github_api_error(output: &[u8]) -> GitHubAuthorityError {
             .and_then(Value::as_str)
             .is_some_and(github_rate_limit_message)
             || text.lines().any(|line| {
-                line.strip_prefix("gh: ")
-                    .and_then(|line| line.strip_suffix(" (HTTP 403)"))
+                line.strip_prefix("HTTP 403: ")
+                    .or_else(|| {
+                        line.strip_prefix("gh: ")
+                            .and_then(|line| line.strip_suffix(" (HTTP 403)"))
+                    })
                     .is_some_and(github_rate_limit_message)
             }));
     let failure = GitHubAuthorityError::api(status, text.into_owned());
@@ -340,6 +364,12 @@ fn github_api_error(output: &[u8]) -> GitHubAuthorityError {
     }
 }
 
+fn github_transport_error(text: &str) -> bool {
+    text.lines().any(|line| {
+        line.starts_with("error connecting to ") || line.contains(": TLS handshake timeout")
+    })
+}
+
 fn github_rate_limit_message(message: &str) -> bool {
     message.starts_with("API rate limit exceeded")
         || message.starts_with("You have exceeded a secondary rate limit")
@@ -369,6 +399,15 @@ fn github_api_status(value: &Value) -> Option<u16> {
 }
 
 fn github_api_status_from_text(text: &str) -> Option<u16> {
+    if let Some(status) = text.lines().find_map(|line| {
+        let response = line.strip_prefix("HTTP ")?;
+        let (status, _) = response
+            .split_once(": ")
+            .or_else(|| response.split_once(" ("))?;
+        status.parse().ok()
+    }) {
+        return Some(status);
+    }
     let marker = "(HTTP ";
     let start = text.rfind(marker)? + marker.len();
     let digits = text.get(start..)?.split(')').next()?;
@@ -403,3 +442,7 @@ pub(super) fn check_log_tail(output: &[u8]) -> String {
 #[cfg(test)]
 #[path = "api/tests.rs"]
 mod tests;
+
+#[cfg(all(test, unix))]
+#[path = "api/command_status_tests.rs"]
+mod command_status_tests;
```

**File**: `zeroshot/src/native_v2_delivery/github/api/command_status_tests.rs` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+use super::*;
+
+fn shell(source: &str) -> Command {
+    let mut command = Command::new("/bin/sh");
+    command
+        .env_clear()
+        .env("GH_TOKEN", "test-token")
+        .args(["-c", source]);
+    command
+}
+
+#[tokio::test]
+async fn silent_status_success_requires_no_json_response() {
+    command_status(
+        shell("exit 0"),
+        Duration::from_secs(2),
+        GitHubCredential("test-token"),
+    )
+    .await
+    .expect("silent GitHub command succeeded");
+}
+
+#[tokio::test]
+async fn failed_status_commands_keep_native_http_and_transport_semantics() {
+    for (message, status, retryable) in [
+        (
+            "HTTP 401: Bad credentials (https://api.github.com/graphql)",
+            Some(401),
+            false,
+        ),
+        (
+            "HTTP 429: Too Many Requests (https://api.github.com/graphql)",
+            Some(429),
+            true,
+        ),
+        (
+            "HTTP 503: Service Unavailable (https://api.github.com/graphql)",
+            Some(503),
+            true,
+        ),
+        (
+            "HTTP 403: You have exceeded a secondary rate limit. (https://api.github.com/graphql)",
+            Some(403),
+            true,
+        ),
+        (
+            "HTTP 403: Resource not accessible by integration (https://api.github.com/graphql)",
+            Some(403),
+            false,
+        ),
+        (
+            "GraphQL: Merge commits are not allowed on this repository. (mergePullRequest)",
+            None,
+            false,
+        ),
+        ("error connecting to api.github.com", None, true),
+        (
+            "Post https://api.github.com/graphql: TLS handshake timeout",
+            None,
+            true,
+        ),
+    ] {
+        let mut command = shell("printf '%s\n' \"$1\" \"$GH_TOKEN\" >&2; exit 1");
+        command.args(["gh-fixture", message]);
+        let error = command_status(
+            command,
+            Duration::from_secs(2),
+            GitHubCredential("test-token"),
+        )
+        .await
+        .expect_err("command failed");
+        assert!(matches!(error, GitHubAuthorityError::Api(_)));
+        assert_eq!(error.api_status(), status, "{message}");
+        assert_eq!(error.retryable_operation(), retryable, "{message}");
+        assert_eq!(
+            error.authentication_failed(),
+            status == Some(401),
+            "{message}"
+        );
+        assert!(error.to_string().contains(message));
+        assert!(error.to_string().contains("[REDACTED]"));
+        assert!(!error.to_string().contains("test-token"));
+    }
+}
+
+#[tokio::test]
+async fn timed_out_status_does_not_claim_an_incomplete_authentication_response() {
+    let command = shell("printf '%s\n' 'HTTP 401: Bad credentials' >&2; exec /bin/sleep 30");
+    let error = command_status(
+        command,
+        Duration::from_millis(100),
+        GitHubCredential("test-token"),
+    )
+    .await
+    .expect_err("command timed out");
+    assert!(matches!(error, GitHubAuthorityError::Api(_)));
+    assert_eq!(error.api_status(), None);
+    assert!(error.retryable_operation());
+    assert!(!error.authentication_failed());
+}
+
+#[tokio::test]
+async fn status_spawn_failure_stays_in_the_api_boundary() {
+    let root = tempfile::tempdir().expect("temporary command directory");
+    let command = Command::new(root.path().join("missing-test-token-gh"));
+    let error = command_status(
+        command,
+        Duration::from_secs(2),
+        GitHubCredential("test-token"),
+    )
+    .await
+    .expect_err("missing executable");
+    assert!(matches!(error, GitHubAuthorityError::Api(_)));
+    assert!(
+        error
+            .to_string()
+            .contains("could not start contained command")
+    );
+    assert!(error.to_string().contains("missing-[REDACTED]-gh"));
+    assert!(!error.retryable_operation());
+    assert!(!error.to_string().contains("test-token"));
+}
+
+#[cfg(t
```

**File**: `zeroshot/src/native_v2_delivery/github/api/tests.rs` (modified, +58/-1)
```diff
@@ -117,6 +117,20 @@ fn script(root: &std::path::Path, source: &str) -> PathBuf {
     program
 }
 
+#[cfg(unix)]
+#[tokio::test]
+async fn empty_api_output_remains_an_error() {
+    let root = TemporaryDirectory::for_test("github-empty-api");
+    let program = script(root.as_path(), "exit 0\n");
+    let error = authority(program, Duration::from_secs(1))
+        .api_output(&["graphql".to_owned()], GitHubCredential("test-token"))
+        .await
+        .err()
+        .assert_value();
+    assert!(matches!(error, GitHubAuthorityError::Api(_)));
+    assert!(!error.retryable_operation());
+}
+
 #[cfg(unix)]
 #[tokio::test]
 async fn nonexecutable_api_program_preserves_permission_error() {
@@ -352,7 +366,7 @@ exec /bin/cat "$HOME/payload"
             },
         },
         failed_job_ids: vec![91],
-        merge_method: None,
+        is_merge_queue_enabled: false,
         head_update: None,
         pull_request_ready: false,
     };
@@ -439,3 +453,46 @@ fn schema_failures_preserve_bounded_redacted_response_details() {
     assert!(diagnostic.len() < 32 * 1024);
     assert!(!error.retryable_operation());
 }
+
+#[test]
+fn native_cli_http_errors_preserve_status_and_retry_classification() {
+    for (text, status, retryable) in [
+        (
+            "HTTP 401: Bad credentials (https://api.github.com/graphql)",
+            Some(401),
+            false,
+        ),
+        (
+            "HTTP 429: Too Many Requests (https://api.github.com/graphql)",
+            Some(429),
+            true,
+        ),
+        ("HTTP 503 (https://api.github.com/graphql)", Some(503), true),
+        (
+            "HTTP 403: API rate limit exceeded for user ID 123. (https://api.github.com/graphql)",
+            Some(403),
+            true,
+        ),
+        (
+            "HTTP 403: You have exceeded a secondary rate limit. (https://api.github.com/graphql)",
+            Some(403),
+            true,
+        ),
+        (
+            "HTTP 403: Resource not accessible by integration (https://api.github.com/graphql)",
+            Some(403),
+            false,
+        ),
+        (
+            "GraphQL: Resource not accessible by integration (mergePullRequest)",
+            None,
+            false,
+        ),
+        ("HTTP unavailable", None, false),
+    ] {
+        let error = github_api_error(text.as_bytes());
+        assert_eq!(error.api_status(), status, "{text}");
+        assert_eq!(error.retryable_operation(), retryable, "{text}");
+        assert_eq!(error.authentication_failed(), status == Some(401), "{text}");
+    }
+}
```

---

### Incident Patch 2: `58ab8cc0` (2026-09-26)
**Commit Message**: fix(release): restore downloaded sidecar permissions (#1165)

## Summary

Release jobs download the pinned Restic sidecars without executable
permission. Linux and macOS then fail the required sidecar smoke test
with `EACCES`, after the Zeroshot binary has built and passed its own
smoke test. Restore mode `0755` on the selected Unix sidecar immediately
after download. Windows keeps its existing behavior; all executable and
archive checks remain required.

This changes only the canonical release workflow. It can release the
already merged, CI-verified `75ae54b6693b6ae4cedeedd37a79ce3919d9a8fa`
source without changing Cloud's pin.

## Validation

- Full canonical release dry run
[36216460215](https://github.com/the-open-engine/zeroshot/actions/runs/36216460215)
passed: all five native archives and their executable/sidecar smoke
tests, Docker image, checksum manifest, and npm consumer checks. Nothing
was published.
- Reused the actual Restic artifact from release run `36215759438`: the
canonical sidecar smoke fails at mode `0644` and passes at `0755`.
- All 65 repository tooling tests, lint, Rust formatting, and workflow
formatting passed.
- Opcore Verify has no applicable source file

**File**: `.github/workflows/release.yml` (modified, +5/-0)
```diff
@@ -308,6 +308,11 @@ jobs:
           name: zeroshot-restic-v${{ needs.plan.outputs.version }}
           path: restic-input
 
+      - name: Restore executable permission after artifact download
+        if: runner.os != 'Windows'
+        shell: bash
+        run: chmod 755 "$RESTIC_PATH"
+
       - name: Build embedded UI
         run: |
           npm --prefix ui ci --ignore-scripts
```

---

### Incident Patch 3: `75ae54b6` (2026-09-26)
**Commit Message**: fix(process): compile Unix process cleanup on macOS (#1163)

## Summary

The 10.9.0 release cannot compile on macOS because Unix process-group
cleanup calls a helper declared only for Linux. Make the ESRCH check
available on every Unix platform. Add required macOS compilation of the
product and test targets, including the embedded UI, to catch
platform-gating regressions in ordinary CI.

## Validation

- All 19 Linux Unix-process tests passed, including process-group
disappearance and cleanup fallback.
- All 65 repository tooling tests, lint, and formatting passed through
the commit hook.
- Opcore Verify found no issues. Sense found no introduced issues with
partial coverage for unsupported files.
- Native macOS compilation runs in the added CI lane; this development
host is Linux.

Co-authored-by: Michael Eichelbeck <michael@theopenengine.com>

**File**: `.github/workflows/ci.yml` (modified, +37/-1)
```diff
@@ -287,6 +287,31 @@ jobs:
           target/release/zeroshot --version
           node tests/tooling/smoke-ui.js --binary target/release/zeroshot${{ runner.os == 'Windows' && '.exe' || '' }}
 
+  macos-check:
+    name: macOS compilation
+    needs: classify
+    if: needs.classify.outputs.native == 'true'
+    runs-on: macos-14
+    steps:
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
+        with:
+          persist-credentials: false
+      - uses: dtolnay/rust-toolchain@6bed0761d98439e5a578e2877258200ad565ba87 # stable
+        with:
+          toolchain: 1.97.0
+      - uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2.9.2
+      - uses: actions/setup-node@2028fbc5c25fe9cf00d9f06a71cc4710d4507903 # v6.0.0
+        with:
+          node-version: 24
+          cache: npm
+          cache-dependency-path: ui/package-lock.json
+      - name: Build embedded UI
+        run: |
+          npm --prefix ui ci --ignore-scripts
+          npm --prefix ui run build
+      - name: Check macOS product and test compilation
+        run: cargo check --locked --workspace --all-targets --features ui
+
   python-check:
     name: Python SDK
     needs: classify
@@ -496,7 +521,16 @@ jobs:
     name: required
     if: always()
     needs:
-      [classify, tooling-check, npm-check, native-check, python-check, docs-check, target-image]
+      [
+        classify,
+        tooling-check,
+        npm-check,
+        native-check,
+        macos-check,
+        python-check,
+        docs-check,
+        target-image,
+      ]
     runs-on: ubuntu-latest
     steps:
       - name: Require every selected lane
@@ -512,6 +546,7 @@ jobs:
           NPM_RESULT: ${{ needs.npm-check.result }}
           DOCS_RESULT: ${{ needs.docs-check.result }}
           NATIVE_RESULT: ${{ needs.native-check.result }}
+          MACOS_RESULT: ${{ needs.macos-check.result }}
           PYTHON_RESULT: ${{ needs.python-check.result }}
           IMAGE_RESULT: ${{ needs.target-image.result }}
         run: |
@@ -541,5 +576,6 @@ jobs:
           require_result "$NPM_SELECTED" "$NPM_RESULT" npm-check
           require_result "$DOCS_SELECTED" "$DOCS_RESULT" docs-check
           require_result "$NATIVE_SELECTED" "$NATIVE_RESULT" native-check
+          require_result "$NATIVE_SELECTED" "$MACOS_RESULT" macos-check
           require_result "$NATIVE_SELECTED" "$IMAGE_RESULT" target-image
           require_result "$PYTHON_SELECTED" "$PYTHON_RESULT" python-check
```

**File**: `AGENTS.md` (modified, +2/-1)
```diff
@@ -636,7 +636,8 @@ python -m mkdocs build --strict
 ## Release convention
 
 - CI has native, Python, repository-tooling, npm-package, and strict-documentation lanes plus stable
-  aggregate `required`. `.github/ci-path-classifier.js` owns fail-closed path routing and cross-lane
+  aggregate `required`. Native changes also require macOS product and test compilation with the UI
+  feature. `.github/ci-path-classifier.js` owns fail-closed path routing and cross-lane
   producer/consumer dependencies. The native lane runs on Linux and Windows, including real local
   CLI subprocess tests. Windows uses
   `scripts/test-windows.ps1` to run test executables outside Cargo's restrictive Job; the CI-only
```

**File**: `zeroshot/src/execution/process/platform_unix.rs` (modified, +0/-1)
```diff
@@ -532,7 +532,6 @@ fn reap_action(target: ReapTarget, result: i32, error: Option<i32>) -> ReapActio
     }
 }
 
-#[cfg(target_os = "linux")]
 fn process_is_missing(error: &io::Error) -> bool {
     error.raw_os_error() == Some(libc::ESRCH)
 }
```

---

### Incident Patch 4: `3a36ba8c` (2026-09-26)
**Commit Message**: fix(release): recover the merged formatter update summary (#1162)

## Summary

Release 10.9.0 stops while generating notes because the already-merged
Prettier update (#1136) has Dependabot's HTML body without a Summary
section. Recover its concise summary by exact immutable commit ID,
following the existing historical-recovery convention. All other commits
still require their own nonempty Summary section.

## Validation

- All 65 repository tooling tests and lint passed through the commit
hook.
- The regression test verifies recovery for the historical object,
refusal for the same metadata under another hash, and precedence of an
explicit summary.
- Generated the complete nine-commit release range from v10.8.0 through
the environment feature merge successfully.
- Opcore Verify found no issues; Sense found no introduced issues with
partial coverage for unsupported files.

Co-authored-by: Michael Eichelbeck <michael@theopenengine.com>

**File**: `scripts/release-notes.js` (modified, +9/-0)
```diff
@@ -12,6 +12,12 @@ const RELEASE_COMMIT = /^[0-9a-f]{40}$/;
 const RELEASE_SUBJECT =
   /^(?<type>[a-z]+)(?:\((?<scope>[^()\r\n]+)\))?(?<breaking>!)?: (?<title>.+) \(#(?<pull>[1-9][0-9]*)\)$/;
 const PLAIN_SUMMARY_COMMIT_EXCEPTIONS = new Set(['78b7baa2d88dcd6a7640d8cf06d6fbce94d91f42']);
+const RECOVERED_COMMIT_SUMMARIES = new Map([
+  [
+    '0d688ae5773febd2e6c81def59790b04c9e8fd58',
+    'Update the development formatter Prettier from 3.9.6 to 3.9.8.',
+  ],
+]);
 const CATEGORIES = Object.freeze([
   ['breaking', 'Breaking changes'],
   ['feat', 'Features'],
@@ -166,6 +172,9 @@ function parseReleaseCommit(commit) {
   if (!summary && PLAIN_SUMMARY_COMMIT_EXCEPTIONS.has(commit.hash)) {
     summary = plainSummaryFromBody(commit.body);
   }
+  // This already-merged Dependabot update contains upstream HTML instead of our
+  // Summary section. Recover only this immutable object; other commits stay strict.
+  if (!summary) summary = RECOVERED_COMMIT_SUMMARIES.get(commit.hash);
   if (!summary) throw new Error(`${commit.hash} has no release summary`);
   const breakingFooter = hasBreakingFooter(commit.body);
   const category =
```

**File**: `tests/tooling/release-notes.test.js` (modified, +22/-0)
```diff
@@ -183,6 +183,28 @@ describe('release-note validation', () => {
   });
 });
 
+describe('historical release metadata recovery', () => {
+  it('recovers the immutable Dependabot update without accepting later missing summaries', () => {
+    const historical = {
+      hash: '0d688ae5773febd2e6c81def59790b04c9e8fd58',
+      subject: 'chore(deps-dev): bump prettier from 3.9.6 to 3.9.8 (#1136)',
+      body: 'Bumps the development-dependencies group with 1 update:\n[prettier].',
+    };
+    assert.equal(
+      parseReleaseCommit(historical).summary,
+      'Update the development formatter Prettier from 3.9.6 to 3.9.8.'
+    );
+    assert.throws(
+      () => parseReleaseCommit({ ...historical, hash: 'b'.repeat(40) }),
+      /has no release summary/
+    );
+    assert.equal(
+      parseReleaseCommit({ ...historical, body: '## Summary\n\nExplicit summary.' }).summary,
+      'Explicit summary.'
+    );
+  });
+});
+
 describe('release-note Git history', () => {
   it('uses the preceding canonical tag and immutable first-parent range', () => {
     const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'zeroshot-release-notes-'));
```

---

### Incident Patch 5: `affaa569` (2026-09-25)
**Commit Message**: fix(rust): account for cumulative Codex usage (#1160)

## Summary

Codex reports cumulative token usage when it resumes a conversation.
Record only the increase since the previous report so node revisits and
execution-scoped corrections do not count earlier turns again. Reset the
saved count when counters decrease or a fresh conversation starts,
including retries whose first turn has no usage report.

Addresses #1155. Collecting partial usage for timed-out or force-stopped
turns remains a separate follow-up.

## Testing

- `cargo fmt --all -- --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `CARGO_BUILD_JOBS=2 CARGO_INCREMENTAL=0 CARGO_PROFILE_TEST_DEBUG=0
cargo test --workspace --no-fail-fast -- --test-threads=4`
- Regression coverage for a failed attempt with usage but no thread ID,
a fresh retry without usage, and a later resume; also verifies that
missing usage preserves the count for an existing conversation.
- Built the pinned Restic helper using the repository script for local
CLI integration tests. Three delivery/merge tests failed at default
parallelism and passed both in isolation and with four test threads.

---------

Co-authored-by: Oscar-Williams <

**File**: `zeroshot/src/native_v2_codex.rs` (modified, +7/-2)
```diff
@@ -37,7 +37,7 @@ use command::{
     configure_provider_auth, process_environment, path_text,
 };
 use output::CodexOutput;
-use process::{ProcessOpen, exchange_turn, open_process};
+use process::{ProcessOpen, ProcessTurnContext, exchange_turn, open_process};
 use schema_file::CodexSchemaFile;
 use session::CodexSession;
 use turn::{CodexCommandInput, CodexTurnProcess, CodexTurnProcessOpen};
@@ -334,10 +334,15 @@ impl NativeV2CodexAdapter {
             provider_redactions(&turn.invocation.environment, &self.local_environment);
         redactions.extend(turn_process.native_redactions.iter().cloned());
         let redactions = redaction_values(redactions.iter().map(String::as_str));
+        let context = ProcessTurnContext {
+            control: turn.control,
+            session: turn.session,
+            resumed: execution.resume.is_some(),
+        };
         exchange_turn(
             &mut turn_process.process,
             execution.prompt,
-            turn.control,
+            &context,
             &redactions,
         )
         .await
```

**File**: `zeroshot/src/native_v2_codex/process.rs` (modified, +19/-5)
```diff
@@ -12,12 +12,19 @@ use crate::native_v2_contract::TokenUsageDelta;
 use crate::native_v2_runner::{DriverControl, LiveOutput, LiveOutputStream, NodeRunnerError};
 
 use super::output::{CodexOutput, CodexOutputDecoder};
+use super::session::CodexSession;
 
 pub(super) enum ProcessOpen {
     Ready(ProviderProcess),
     ProviderFailure(String),
 }
 
+pub(super) struct ProcessTurnContext<'a> {
+    pub(super) control: &'a DriverControl,
+    pub(super) session: &'a CodexSession,
+    pub(super) resumed: bool,
+}
+
 struct CollectedOutput {
     output: CodexOutput,
     delivery_error: Option<NodeRunnerError>,
@@ -64,19 +71,19 @@ async fn collect_output(
 pub(super) async fn exchange_turn(
     process: &mut ProviderProcess,
     prompt: &str,
-    control: &DriverControl,
+    context: &ProcessTurnContext<'_>,
     redactions: &[String],
 ) -> Result<CodexOutput, NodeRunnerError> {
     let stdout = process.detach_stdout();
-    let collected = collect_output(stdout, control, redactions);
+    let collected = collect_output(stdout, context.control, redactions);
     let exchange = exchange_process_io(process, prompt.as_bytes(), collected).await;
     let (resolved, usage) = match exchange {
         ProcessExchange::Complete(collected) => {
             let output_complete = collected.delivery_error.is_none();
             let output = retain_delivery_evidence(collected.output, collected.delivery_error);
             let completion = finish_process(process, output_complete).await;
             (
-                resolve_process_completion(output, completion, control.is_cancelled()),
+                resolve_process_completion(output, completion, context.control.is_cancelled()),
                 collected.usage,
             )
         }
@@ -87,19 +94,26 @@ pub(super) async fn exchange_turn(
         }) => {
             let output = retain_delivery_evidence(collected.output, collected.delivery_error);
             (
-                resolve_input_failure(output, input_error, completion, control.is_cancelled()),
+                resolve_input_failure(
+                    output,
+                    input_error,
+                    completion,
+                    context.control.is_cancelled(),
+                ),
                 collected.usage,
             )
         }
     };
-    let recorded = control.record_token_usage(usage).await;
+    let normalized_usage = context.session.usage_delta(usage, context.resumed).await;
+    let recorded = context.control.record_token_usage(normalized_usage).await;
     if matches!(
         &resolved,
         Err(NodeRunnerError::Cancelled | NodeRunnerError::CleanupUnconfirmed)
     ) {
         return resolved;
     }
     recorded?;
+    context.session.commit_usage(usage, context.resumed).await;
     resolved
 }
 
```

**File**: `zeroshot/src/native_v2_codex/session.rs` (modified, +73/-2)
```diff
@@ -1,11 +1,11 @@
 use std::sync::Arc;
 
 use async_trait::async_trait;
-use openengine_cluster_protocol::WorkerOutcome;
+use openengine_cluster_protocol::{TokenCount, WorkerOutcome};
 use tokio::sync::Mutex;
 
 use crate::native_v2_capsule::provider_process::{ProviderSessionCore, impl_provider_node_session};
-use crate::native_v2_contract::{NodeInvocation, NodeRuntimeBinding};
+use crate::native_v2_contract::{NodeInvocation, NodeRuntimeBinding, TokenUsageDelta};
 use crate::native_v2_runner::{
     AgentResponse, DriverControl, DriverInvocation, NodeDriver, NodeRunnerError, NodeSession,
     ResolvedEnvironment, SessionFactory,
@@ -17,13 +17,52 @@ use super::output::CodexOutput;
 pub(super) struct CodexSession {
     pub(super) core: ProviderSessionCore,
     pub(super) thread_id: Mutex<Option<String>>,
+    usage: Mutex<Option<TokenUsageDelta>>,
 }
 
 impl CodexSession {
     fn new() -> Self {
         Self {
             core: ProviderSessionCore::new(),
             thread_id: Mutex::new(None),
+            usage: Mutex::new(None),
+        }
+    }
+
+    pub(super) async fn usage_delta(
+        &self,
+        observed: Option<TokenUsageDelta>,
+        resumed: bool,
+    ) -> Option<TokenUsageDelta> {
+        let observed = observed?;
+        let previous = *self.usage.lock().await;
+        if !resumed {
+            return Some(observed);
+        }
+        Some(previous.map_or(observed, |previous| {
+            if usage_reset(previous, observed) {
+                observed
+            } else {
+                TokenUsageDelta {
+                    input_tokens: token_delta(previous.input_tokens, observed.input_tokens),
+                    output_tokens: token_delta(previous.output_tokens, observed.output_tokens),
+                    cache_read_input_tokens: optional_token_delta(
+                        previous.cache_read_input_tokens,
+                        observed.cache_read_input_tokens,
+                    ),
+                    cache_creation_input_tokens: optional_token_delta(
+                        previous.cache_creation_input_tokens,
+                        observed.cache_creation_input_tokens,
+                    ),
+                }
+            }
+        }))
+    }
+
+    pub(super) async fn commit_usage(&self, observed: Option<TokenUsageDelta>, resumed: bool) {
+        // Missing usage preserves only the baseline of the thread being resumed.
+        if !resumed || observed.is_some() {
+            *self.usage.lock().await = observed;
         }
     }
 
@@ -91,6 +130,38 @@ impl CodexSession {
     }
 }
 
+fn usage_reset(previous: TokenUsageDelta, observed: TokenUsageDelta) -> bool {
+    observed.input_tokens < previous.input_tokens
+        || observed.output_tokens < previous.output_tokens
+        || optional_counter_decreased(
+            previous.cache_read_input_tokens,
+            observed.cache_read_input_tokens,
+        )
+        || optional_counter_decreased(
+            previous.cache_creation_input_tokens,
+            observed.cache_creation_input_tokens,
+        )
+}
+
+fn optional_counter_decreased(previous: Option<TokenCount>, observed: Option<TokenCount>) -> bool {
+    matches!((previous, observed), (Some(previous), Some(observed)) if observed < previous)
+}
+
+fn token_delta(previous: TokenCount, observed: TokenCount) -> TokenCount {
+    TokenCount::new(observed.get().saturating_sub(previous.get())).unwrap_or(observed)
+}
+
+fn optional_token_delta(
+    previous: Option<TokenCount>,
+    observed: Option<TokenCount>,
+) -> Option<TokenCount> {
+    match (previous, observed) {
+        (Some(previous), Some(observed)) => Some(token_delta(previous, observed)),
+        (None, Some(observed)) => Some(observed),
+        (_, None) => None,
+    }
+}
+
 impl_provider_node_session!(CodexSession);
 
 #[async_trait]
```

**File**: `zeroshot/src/native_v2_codex/session/tests.rs` (modified, +73/-0)
```diff
@@ -1,4 +1,21 @@
 use super::*;
+use openengine_cluster_testkit::assertions::AssertValue;
+
+fn usage(
+    input_tokens: u64,
+    output_tokens: u64,
+    cache_read_input_tokens: Option<u64>,
+    cache_creation_input_tokens: Option<u64>,
+) -> TokenUsageDelta {
+    TokenUsageDelta {
+        input_tokens: TokenCount::new(input_tokens).assert_value(),
+        output_tokens: TokenCount::new(output_tokens).assert_value(),
+        cache_read_input_tokens: cache_read_input_tokens
+            .map(|value| TokenCount::new(value).assert_value()),
+        cache_creation_input_tokens: cache_creation_input_tokens
+            .map(|value| TokenCount::new(value).assert_value()),
+    }
+}
 
 #[tokio::test]
 async fn thread_ids_are_opaque_beyond_process_argv_requirements() {
@@ -45,3 +62,59 @@ async fn thread_ids_reject_only_missing_empty_nul_or_conflicting_values() {
         Err("Codex output thread ID changed across turns")
     );
 }
+
+#[tokio::test]
+async fn cumulative_usage_is_normalized_before_commit() {
+    let session = CodexSession::new();
+    let first = usage(10, 4, Some(3), Some(2));
+    assert_eq!(session.usage_delta(Some(first), false).await, Some(first));
+    session.commit_usage(Some(first), false).await;
+
+    let second = usage(16, 9, Some(5), Some(7));
+    assert_eq!(
+        session.usage_delta(Some(second), true).await,
+        Some(usage(6, 5, Some(2), Some(5)))
+    );
+    assert_eq!(session.usage_delta(None, true).await, None);
+}
+
+#[tokio::test]
+async fn resets_and_fresh_turns_start_new_usage_generations() {
+    let session = CodexSession::new();
+    session
+        .commit_usage(Some(usage(10, 4, Some(3), Some(2))), false)
+        .await;
+
+    for (resumed, observed) in [
+        (true, usage(2, 1, Some(1), Some(1))),
+        (false, usage(16, 9, Some(5), Some(7))),
+    ] {
+        assert_eq!(
+            session.usage_delta(Some(observed), resumed).await,
+            Some(observed)
+        );
+    }
+}
+
+#[tokio::test]
+async fn missing_usage_preserves_only_a_resumed_threads_baseline() {
+    for resumed in [false, true] {
+        let session = CodexSession::new();
+        session
+            .commit_usage(Some(usage(13, 5, Some(4), Some(2))), false)
+            .await;
+        assert_eq!(session.usage_delta(None, resumed).await, None);
+        session.commit_usage(None, resumed).await;
+
+        let observed = usage(20, 8, Some(7), Some(6));
+        let expected = if resumed {
+            usage(7, 3, Some(3), Some(4))
+        } else {
+            observed
+        };
+        assert_eq!(
+            session.usage_delta(Some(observed), true).await,
+            Some(expected)
+        );
+    }
+}
```

**File**: `zeroshot/src/native_v2_codex/tests.rs` (modified, +123/-2)
```diff
@@ -24,7 +24,9 @@ use std::fs;
 use std::path::Path;
 use std::sync::Arc;
 
-use openengine_cluster_protocol::{IdempotencyKey, NodeName, RunSize, RunTitle, WorkerOutcome};
+use openengine_cluster_protocol::{
+    IdempotencyKey, NodeName, RunSize, RunTitle, TokenCount, WorkerOutcome,
+};
 use openengine_cluster_testkit::assertions::AssertValue;
 use serde_json::{json, Value};
 
@@ -36,7 +38,7 @@ use crate::native_v2_candidate::test_support::{
 };
 use crate::native_v2_contract::{
     AdmittedRun, DeclaredConnections, DeclaredEnvironment, EnvironmentVariableName,
-    NodeRuntimeBinding, RunSubmission, RuntimePlan,
+    NodeRuntimeBinding, RunSubmission, RuntimePlan, TokenUsageDelta,
 };
 use crate::native_v2_runner::{
     AttachReceiveError, NativeNodeRunner, NodeHandle, NodeRunRequest, NodeRunner,
@@ -122,6 +124,29 @@ fi
   '"cache_write_input_tokens":3,"output_tokens":2}}'
 "#;
 
+const RESUMED_USAGE_SCRIPT: &str = r#"#!/bin/sh
+set -eu
+resumed=false
+for argument in "$@"; do
+  if [ "$argument" = "resume" ]; then
+    resumed=true
+  fi
+done
+/usr/bin/printf '%s\n' '{"type":"thread.started","thread_id":"thread-usage"}'
+if [ "${CORRECT_OUTPUT-false}" = true ] && [ "$resumed" = false ]; then
+  /usr/bin/printf '%s\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{\"response\":{\"answer\":\"wrong\"}}"}}'
+elif [ "$resumed" = true ]; then
+  /usr/bin/printf '%s\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{\"response\":{\"answer\":43}}"}}'
+else
+  /usr/bin/printf '%s\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{\"response\":{\"answer\":42}}"}}'
+fi
+if [ "$resumed" = true ]; then
+  /usr/bin/printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":3,"cached_input_tokens":2,"cache_write_input_tokens":4,"output_tokens":5}}'
+else
+  /usr/bin/printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":1,"cache_write_input_tokens":3,"output_tokens":2}}'
+fi
+"#;
+
 const SUCCESS_OUTPUT_SCRIPT: &str = r#"
 /usr/bin/printf '%s%s\n' \
   '{"type":"item.completed","item":{"type":"agent_message",' \
@@ -136,6 +161,22 @@ fn script_with_success(prefix: &str) -> String {
     script
 }
 
+fn token_usage(
+    input_tokens: u64,
+    output_tokens: u64,
+    cache_read_input_tokens: Option<u64>,
+    cache_creation_input_tokens: Option<u64>,
+) -> TokenUsageDelta {
+    TokenUsageDelta {
+        input_tokens: TokenCount::new(input_tokens).assert_value(),
+        output_tokens: TokenCount::new(output_tokens).assert_value(),
+        cache_read_input_tokens: cache_read_input_tokens
+            .map(|value| TokenCount::new(value).assert_value()),
+        cache_creation_input_tokens: cache_creation_input_tokens
+            .map(|value| TokenCount::new(value).assert_value()),
+    }
+}
+
 fn scripted_adapter(
     directory: &TestDirectory,
     provider: CodexProvider,
@@ -518,6 +559,86 @@ async fn verifiers_and_workers_share_permission_defaults_and_preserve_authored_p
     }
 }
 
+#[tokio::test]
+async fn node_instance_session_reports_per_turn_codex_usage_deltas() {
+    let directory = TestDirectory::new("codex-resumed-usage");
+    let (admitted, runtime) = openai_scripted_runtime(
+        &directory,
+        OpenAiScript {
+            scope: SessionScope::NodeInstance,
+            environment: &["OPENAI_API_KEY"],
+            name: "codex-resumed-usage",
+            body: RESUMED_USAGE_SCRIPT,
+        },
+    )
+    .await;
+    let values = [("OPENAI_API_KEY", "fake-openai-key".to_owned())];
+
+    let mut first_handle = start(&runtime, &admitted, 1, &values).await;
+    let mut first_output = first_handle.take_initial_output().assert_value();
+    assert!(matches!(
+        first_handle.completion().await.assert_value().outcome,
+        WorkerOutcome::Verified { output, .. } if output == json!({"answer":42})
+    ));
+    assert_eq!(
+        first_output
+            .recv_usage()
+            .await
+            .asser
```

---

### Incident Patch 6: `f6217ebc` (2026-09-25)
**Commit Message**: test: eliminate process fixture races (#1157)

## Summary

- prevent Linux `ETXTBSY` flakes with one `flock` handoff for freshly
written Unix test executables, shared by unit and integration fixtures
- give inherited lease descriptors and aborted listener tasks a bounded
scheduler window to release instead of requiring same-poll cleanup
- preserve the underlying checkpoint and GitHub transport errors in
assertion output

## Root cause

The UI suite runs enough process-heavy tests in parallel for
`Command::spawn` to fork while another test still has a newly written
executable open. The child temporarily inherits that writable descriptor
until `exec` closes it, so Linux can reject another spawn of the same
inode with `ETXTBSY`. The same inherited-descriptor window caused the
lease assertion. The listener failure was separate: aborting the server
schedules child-task destruction, so an immediate rebind can briefly see
`AddrInUse`.

## Validation

- focused duplicate-descriptor lock-handoff test, synchronized without a
wall-clock deadline
- 10 consecutive `cargo test --locked --package zeroshot --features ui
--lib` runs after the shared-helper refactor, plus final runs after the
review

**File**: `AGENTS.md` (modified, +3/-0)
```diff
@@ -583,6 +583,9 @@ with `npm i -g @the-open-engine-company/zeroshot` or build `zeroshot` with Cargo
   hooks, CI gates, other skills, or checked-in state for personal analysis tooling.
 - New Rust APIs must respect the four-parameter Clippy ceiling; use request structs rather than
   raising or bypassing the limit.
+- Unix tests that create executable fixtures use
+  `openengine_cluster_testkit::fixture::write_executable`; its lock handoff covers writable
+  descriptors inherited by concurrent process spawns.
 - `.opcore.json` owns the full-source Opcore policy. `.github/workflows/opcore.yml` runs the Fast
   and native Rust providers on every PR and main commit. Its two exact PowerShell exclusions reflect
   unsupported parsing; the Windows native CI lane still runs those scripts.
```

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -1661,6 +1661,7 @@ name = "openengine-cluster-testkit"
 version = "0.1.0"
 dependencies = [
  "async-trait",
+ "fs2",
  "futures-util",
  "getrandom 0.3.4",
  "jsonschema",
```

**File**: `crates/openengine-cluster-testkit/Cargo.toml` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ repository.workspace = true
 
 [dependencies]
 async-trait.workspace = true
+fs2.workspace = true
 getrandom.workspace = true
 openengine-cluster-client.workspace = true
 openengine-cluster-protocol.workspace = true
```

**File**: `crates/openengine-cluster-testkit/src/fixture.rs` (modified, +78/-0)
```diff
@@ -77,6 +77,84 @@ impl Drop for TemporaryDirectory {
     }
 }
 
+/// Writes a Unix executable and waits out writable descriptors inherited by concurrent forks.
+///
+/// The lock handoff closes the `fork`/`CLOEXEC` window that can otherwise make an immediate spawn
+/// fail with `ETXTBSY`.
+#[cfg(unix)]
+pub fn write_executable(path: &Path, contents: impl AsRef<[u8]>, mode: u32) -> io::Result<()> {
+    use std::io::Write as _;
+    use std::os::unix::fs::PermissionsExt as _;
+
+    let mut file = std::fs::OpenOptions::new()
+        .write(true)
+        .create(true)
+        .truncate(true)
+        .open(path)?;
+    file.write_all(contents.as_ref())?;
+    file.set_permissions(std::fs::Permissions::from_mode(mode))?;
+    finish_executable_write(file, path)
+}
+
+#[cfg(unix)]
+fn finish_executable_write(file: std::fs::File, path: &Path) -> io::Result<()> {
+    fs2::FileExt::lock_exclusive(&file)?;
+    drop(file);
+
+    let file = std::fs::File::open(path)?;
+    fs2::FileExt::lock_shared(&file)
+}
+
+#[cfg(all(test, unix))]
+mod tests {
+    use std::sync::mpsc;
+
+    use super::*;
+
+    #[test]
+    fn duplicated_writer_holds_the_lock_handoff_until_it_closes() {
+        let directory = TemporaryDirectory::for_test("executable-lock-handoff");
+        let path = directory.path("fixture");
+        let writer = std::fs::File::create(&path).expect("create executable fixture");
+        let inherited_writer = writer.try_clone().expect("duplicate executable writer");
+        let waiting_path = path.clone();
+        let (finished, result) = mpsc::channel();
+        let waiter = std::thread::spawn(move || {
+            finished
+                .send(finish_executable_write(writer, &waiting_path))
+                .expect("report lock handoff result");
+        });
+
+        let probe = std::fs::File::open(&path).expect("open lock probe");
+        loop {
+            match fs2::FileExt::try_lock_shared(&probe) {
+                Ok(()) => {
+                    fs2::FileExt::unlock(&probe).expect("unlock probe");
+                    match result.try_recv() {
+                        Ok(finished) => {
+                            panic!("lock handoff finished before taking its lock: {finished:?}")
+                        }
+                        Err(mpsc::TryRecvError::Empty) => std::thread::yield_now(),
+                        Err(mpsc::TryRecvError::Disconnected) => {
+                            panic!("lock handoff result sender disconnected")
+                        }
+                    }
+                }
+                Err(error) if error.kind() == io::ErrorKind::WouldBlock => break,
+                Err(error) => panic!("probe lock failed: {error}"),
+            }
+        }
+        assert!(matches!(result.try_recv(), Err(mpsc::TryRecvError::Empty)));
+
+        drop(inherited_writer);
+        result
+            .recv()
+            .expect("receive lock handoff result")
+            .expect("lock handoff should succeed");
+        waiter.join().expect("join lock handoff waiter");
+    }
+}
+
 pub type FixtureBackend = AdmissionCoordinator<ScriptedVerifier, InMemoryAdmissionStore>;
 pub type FixtureClient = ClusterClient<InProcessTransport<FixtureBackend>>;
 
```

**File**: `zeroshot/src/native_v2_candidate/test_support.rs` (modified, +2/-8)
```diff
@@ -1,8 +1,6 @@
 #[cfg(unix)]
 use std::collections::BTreeMap;
 use std::fs;
-#[cfg(unix)]
-use std::os::unix::fs::PermissionsExt;
 use std::path::{Path, PathBuf};
 use std::process::Command;
 use std::sync::atomic::{AtomicU64, Ordering};
@@ -67,12 +65,8 @@ impl TestDirectory {
     #[cfg(unix)]
     pub(crate) fn write_executable(&self, name: &str, contents: &str) -> PathBuf {
         let path = self.child(name);
-        fs::write(&path, contents).assert_value_with("write test executable");
-        let mut permissions = fs::metadata(&path)
-            .assert_value_with("read test executable metadata")
-            .permissions();
-        permissions.set_mode(0o755);
-        fs::set_permissions(&path, permissions).assert_value_with("make test executable");
+        openengine_cluster_testkit::fixture::write_executable(&path, contents, 0o755)
+            .assert_value_with("write test executable");
         path
     }
 }
```

---

### Incident Patch 7: `9e9ffae0` (2026-09-22)
**Commit Message**: fix(release): make Windows archives reproducible (#1150)

## Summary

- Pass MSVC `/Brepro` before linking the standalone Windows release
executable.
- Remove wall-clock PE timestamps and nondeterministic CodeView/PDB
identifiers from Windows archives.
- Guard the release workflow ordering and platform scope with repository
contract coverage.

## Validation

- Compared two `v10.7.1` release builds and isolated differences to the
PE timestamp and CodeView GUID
- `npm test` (63 passed)
- `npm run lint`
- targeted Prettier check
- `npm run distribution:check`
- staged Opcore Verify and Sense (no findings; partial parser coverage
reported)

Co-authored-by: Michael Eichelbeck <michael@theopenengine.com>

**File**: `.github/workflows/release.yml` (modified, +5/-0)
```diff
@@ -307,6 +307,11 @@ jobs:
             throw 'MSVC C toolchain required by bundled SQLite is unavailable'
           }
 
+      - name: Configure reproducible MSVC linking
+        if: runner.os == 'Windows'
+        shell: bash
+        run: echo "RUSTFLAGS=-C link-arg=/Brepro" >> "$GITHUB_ENV"
+
       - name: Stage explicit Zeroshot package version
         run: node scripts/distribution.js stage-version --tag "$RELEASE_TAG"
         shell: bash
```

**File**: `tests/tooling/release-contract.test.js` (modified, +17/-0)
```diff
@@ -179,6 +179,23 @@ describe('Embedded UI distribution', () => {
     assert.match(commands, /cargo build[^\n]+--features ui[^\n]+--target/);
   });
 
+  it('links the Windows release executable reproducibly before packaging it', () => {
+    const release = yaml.load(read('.github/workflows/release.yml'));
+    const steps = release.jobs.binaries.steps;
+    const configureIndex = steps.findIndex(
+      (step) => step.name === 'Configure reproducible MSVC linking'
+    );
+    const buildIndex = steps.findIndex(
+      (step) => step.name === 'Build standalone Zeroshot release binary'
+    );
+    const configure = steps[configureIndex];
+
+    assert.ok(configureIndex >= 0 && buildIndex > configureIndex);
+    assert.equal(configure.if, "runner.os == 'Windows'");
+    assert.equal(configure.shell, 'bash');
+    assert.match(configure.run, /RUSTFLAGS=-C link-arg=\/Brepro/);
+  });
+
   it('builds target UI assets independently of local generated files', () => {
     const dockerfile = read('docker/zeroshot-target/Dockerfile');
     const ignore = read('.dockerignore');
```

---

### Incident Patch 8: `cac003c2` (2026-09-22)
**Commit Message**: fix(release): recover legacy summary heading (#1149)

## Summary

- Recover the immutable plain `Summary` section on commit `78b7baa2`
when generating release notes.
- Scope the alternate parser to that exact Git object so every later
squash commit still requires `## Summary`.
- Add regression coverage for both the historical recovery and continued
fail-closed validation.

## Validation

- Generated complete `v10.7.1` notes from `v10.7.0..81bd58b3`
- `npm test` (62 passed)
- `npm run lint`
- targeted Prettier check
- staged Opcore Verify and Sense (no findings; partial parser coverage
reported)

Co-authored-by: Michael Eichelbeck <michael@theopenengine.com>

**File**: `scripts/release-notes.js` (modified, +18/-4)
```diff
@@ -11,6 +11,7 @@ const RELEASE_VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*
 const RELEASE_COMMIT = /^[0-9a-f]{40}$/;
 const RELEASE_SUBJECT =
   /^(?<type>[a-z]+)(?:\((?<scope>[^()\r\n]+)\))?(?<breaking>!)?: (?<title>.+) \(#(?<pull>[1-9][0-9]*)\)$/;
+const PLAIN_SUMMARY_COMMIT_EXCEPTIONS = new Set(['78b7baa2d88dcd6a7640d8cf06d6fbce94d91f42']);
 const CATEGORIES = Object.freeze([
   ['breaking', 'Breaking changes'],
   ['feat', 'Features'],
@@ -110,21 +111,29 @@ function releaseCommits(repository, previousTag, releaseCommit) {
   });
 }
 
-function summaryFromBody(body) {
+function sectionFromBody(body, headingPattern, nextHeadingPattern) {
   const lines = body.replace(/\r\n/g, '\n').split('\n');
-  const summaryHeading = lines.findIndex((line) => /^## Summary\s*$/i.test(line));
+  const summaryHeading = lines.findIndex((line) => headingPattern.test(line));
   if (summaryHeading === -1) return '';
   const start = summaryHeading + 1;
   let end = lines.length;
   for (let index = start; index < lines.length; index += 1) {
-    if (/^##\s+/.test(lines[index])) {
+    if (nextHeadingPattern.test(lines[index])) {
       end = index;
       break;
     }
   }
   return lines.slice(start, end).join('\n').trim();
 }
 
+function summaryFromBody(body) {
+  return sectionFromBody(body, /^## Summary\s*$/i, /^##\s+/);
+}
+
+function plainSummaryFromBody(body) {
+  return sectionFromBody(body, /^Summary\s*$/i, /^(?:Validation\s*$|##\s+)/i);
+}
+
 function hasBreakingFooter(body) {
   const footerToken = /^(?:BREAKING(?: CHANGE|-CHANGE)|[A-Za-z][A-Za-z0-9-]*)(?::[ \t]+| #[0-9])/;
   const blocks = body
@@ -151,7 +160,12 @@ function parseReleaseCommit(commit) {
         commit.subject
     );
   }
-  const summary = summaryFromBody(commit.body);
+  let summary = summaryFromBody(commit.body);
+  // This immutable squash commit predates enforcement of the Markdown heading.
+  // Keep the recovery exception bound to its exact object so later commits stay strict.
+  if (!summary && PLAIN_SUMMARY_COMMIT_EXCEPTIONS.has(commit.hash)) {
+    summary = plainSummaryFromBody(commit.body);
+  }
   if (!summary) throw new Error(`${commit.hash} has no release summary`);
   const breakingFooter = hasBreakingFooter(commit.body);
   const category =
```

**File**: `tests/tooling/release-notes.test.js` (modified, +24/-0)
```diff
@@ -118,6 +118,30 @@ describe('release-note validation', () => {
     );
   });
 
+  it('recovers the one immutable plain-heading summary without weakening later commits', () => {
+    const body = [
+      'Summary',
+      '- Route authority failures directly to refusal.',
+      '',
+      'Validation',
+      '- cargo test --workspace',
+    ].join('\n');
+    const historical = {
+      hash: '78b7baa2d88dcd6a7640d8cf06d6fbce94d91f42',
+      subject: 'fix(delivery): route authority failures without repair (#1141)',
+      body,
+    };
+
+    assert.equal(
+      parseReleaseCommit(historical).summary,
+      '- Route authority failures directly to refusal.'
+    );
+    assert.throws(
+      () => parseReleaseCommit({ ...historical, hash: 'a'.repeat(40) }),
+      /has no release summary/
+    );
+  });
+
   it('classifies both Conventional Commit breaking footer forms', () => {
     for (const footer of ['BREAKING CHANGE:', 'BREAKING-CHANGE:']) {
       const body = [
```

---

### Incident Patch 9: `81bd58b3` (2026-09-22)
**Commit Message**: fix(ui): retry pending run history (#1148)

## Summary

- Retry the explicit hosted `history_pending` response while run graph
data is still materializing.
- Show a clear setting-up state and replace it with the graph
automatically once history is ready.
- Keep retry policy at the HTTP adapter boundary and cover reads,
streams, cancellation, and generic sources.

## Validation

- `npm test` (346 passed)
- `npm run build`
- `opcore-zero check --repo . --staged --json`
- `opcore-zero sense --repo . --staged --json` (no findings; partial
parser coverage reported)

Co-authored-by: Michael Eichelbeck <michael@theopenengine.com>

**File**: `ui/package-lock.json` (modified, +573/-0)
```diff
@@ -17,13 +17,71 @@
         "react-dom": "^19.2.0"
       },
       "devDependencies": {
+        "@types/jsdom": "30.0.0",
         "@types/node": "^22.20.2",
         "@types/react": "^19.2.0",
         "@types/react-dom": "^19.2.0",
         "@vitejs/plugin-react": "^5.0.0",
+        "jsdom": "30.1.1",
         "tsx": "^4.20.0",
         "typescript": "^5.9.3",
         "vite": "^7.3.0"
+      },
+      "engines": {
+        "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
+      }
+    },
+    "node_modules/@asamuzakjp/css-color": {
+      "version": "7.0.1",
+      "resolved": "https://registry.npmjs.org/@asamuzakjp/css-color/-/css-color-7.0.1.tgz",
+      "integrity": "sha512-C9duntabagkBZ1LebM7FKmphR4Q1pBclLxVbZETQV0akkFjV0ooFxo8FlvAQyKj9F6l8rEnmidgcTlpyxFYizg==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "@csstools/css-calc": "^3.4.0",
+        "@csstools/css-color-parser": "^4.2.3",
+        "@csstools/css-parser-algorithms": "^4.0.0",
+        "@csstools/css-tokenizer": "^4.0.1",
+        "lru-cache": "^11.5.3"
+      },
+      "engines": {
+        "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
+      }
+    },
+    "node_modules/@asamuzakjp/css-color/node_modules/lru-cache": {
+      "version": "11.5.3",
+      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-11.5.3.tgz",
+      "integrity": "sha512-U4N8FgzmWxc8k1VH8Kr6lQg18U7Fjvby6wXHVRX/ZZ7IwWbRMgrRbP0Wrb5q5NVinryp4SQampHKdvtecItxUg==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "engines": {
+        "node": "20 || >=22"
+      }
+    },
+    "node_modules/@asamuzakjp/dom-selector": {
+      "version": "9.2.1",
+      "resolved": "https://registry.npmjs.org/@asamuzakjp/dom-selector/-/dom-selector-9.2.1.tgz",
+      "integrity": "sha512-NT4s3yZLjovPpliRpTvdsdzyPjqRqiCZj9MxnarBihbaY5MbAG7DWAJcrLlhmC7xKTNCXsTELcqB8YsqpLnUFQ==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "bidi-js": "^1.1.0",
+        "css-tree": "^3.2.1",
+        "is-potential-custom-element-name": "^1.0.1",
+        "lru-cache": "^11.5.3"
+      },
+      "engines": {
+        "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
+      }
+    },
+    "node_modules/@asamuzakjp/dom-selector/node_modules/lru-cache": {
+      "version": "11.5.3",
+      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-11.5.3.tgz",
+      "integrity": "sha512-U4N8FgzmWxc8k1VH8Kr6lQg18U7Fjvby6wXHVRX/ZZ7IwWbRMgrRbP0Wrb5q5NVinryp4SQampHKdvtecItxUg==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "engines": {
+        "node": "20 || >=22"
       }
     },
     "node_modules/@babel/code-frame": {
@@ -308,6 +366,159 @@
         "node": ">=6.9.0"
       }
     },
+    "node_modules/@bramus/specificity": {
+      "version": "2.4.2",
+      "resolved": "https://registry.npmjs.org/@bramus/specificity/-/specificity-2.4.2.tgz",
+      "integrity": "sha512-ctxtJ/eA+t+6q2++vj5j7FYX3nRu311q1wfYH3xjlLOsczhlhxAg2FWNUXhpGvAw3BWo1xBcvOV6/YLc2r5FJw==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "css-tree": "^3.0.0"
+      },
+      "bin": {
+        "specificity": "bin/cli.js"
+      }
+    },
+    "node_modules/@csstools/color-helpers": {
+      "version": "6.1.1",
+      "resolved": "https://registry.npmjs.org/@csstools/color-helpers/-/color-helpers-6.1.1.tgz",
+      "integrity": "sha512-gLNsunvwf3mCi5u5o46/Z/JcJMnhbHSaZ69rkgPzNM3J4s8hWwpPUQB6/tt0EDFyCiWzxANlx+2LJwpYj4zS1w==",
+      "dev": true,
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/csstools"
+        },
+        {
+          "type": "opencollective",
+          "url": "https://opencollective.com/csstools"
+        }
+      ],
+      "license": "MIT-0",
+      "engines": {
+        "node": ">=20.19.0"
+      }
+    },
+    "node_modules/@csstools/css-calc": {
+      "version": "3.4.0",
+      "resolved": "https://registry.npmjs.org/@csstools/css-calc/-/css-calc-3.4.0.t
```

**File**: `ui/package.json` (modified, +5/-0)
```diff
@@ -3,6 +3,9 @@
   "version": "0.0.0",
   "private": true,
   "type": "module",
+  "engines": {
+    "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
+  },
   "scripts": {
     "dev": "vite --host 127.0.0.1",
     "build": "tsc -b && vite build",
@@ -18,10 +21,12 @@
     "react-dom": "^19.2.0"
   },
   "devDependencies": {
+    "@types/jsdom": "30.0.0",
     "@types/node": "^22.20.2",
     "@types/react": "^19.2.0",
     "@types/react-dom": "^19.2.0",
     "@vitejs/plugin-react": "^5.0.0",
+    "jsdom": "30.1.1",
     "tsx": "^4.20.0",
     "typescript": "^5.9.3",
     "vite": "^7.3.0"
```

**File**: `ui/src/Inspector.test.ts` (modified, +2/-10)
```diff
@@ -2,9 +2,8 @@ import test, { type TestContext } from 'node:test';
 import assert from 'node:assert/strict';
 import { createElement } from 'react';
 import { renderToStaticMarkup } from 'react-dom/server';
-import { createServer } from 'vite';
-import { fileURLToPath } from 'node:url';
 import { findNode, type Document } from './domain';
+import { createViteTestServer } from './test-support';
 
 const record = (fields: Record<string, any>) => ({
   kind: 'record',
@@ -67,14 +66,7 @@ function fixture(): Document {
   };
 }
 async function inspector(t: TestContext) {
-  const server = await createServer({
-    root: fileURLToPath(new URL('..', import.meta.url)),
-    configFile: false,
-    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
-    appType: 'custom',
-    optimizeDeps: { noDiscovery: true },
-  });
-  t.after(() => server.close());
+  const server = await createViteTestServer(t);
   const { Inspector } = await server.ssrLoadModule('/src/Inspector.tsx');
   const { createNumericDrafts, NumericDraftProvider } =
     await server.ssrLoadModule('/src/numeric-drafts.ts');
```

**File**: `ui/src/NodeDataEditor.test.ts` (modified, +2/-10)
```diff
@@ -2,19 +2,11 @@ import test, { type TestContext } from 'node:test';
 import assert from 'node:assert/strict';
 import { createElement } from 'react';
 import { renderToStaticMarkup } from 'react-dom/server';
-import { createServer } from 'vite';
-import { fileURLToPath } from 'node:url';
 import { type Document, type GraphNode } from './domain';
+import { createViteTestServer } from './test-support';
 
 async function editor(t: TestContext) {
-  const server = await createServer({
-    root: fileURLToPath(new URL('..', import.meta.url)),
-    configFile: false,
-    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
-    appType: 'custom',
-    optimizeDeps: { noDiscovery: true },
-  });
-  t.after(() => server.close());
+  const server = await createViteTestServer(t);
   return server.ssrLoadModule('/src/NodeDataEditor.tsx');
 }
 
```

**File**: `ui/src/RunHistoryView.test.ts` (modified, +221/-14)
```diff
@@ -1,13 +1,14 @@
-import test from 'node:test';
+import test, { type TestContext } from 'node:test';
 import assert from 'node:assert/strict';
-import { createElement } from 'react';
+import { act, createElement } from 'react';
+import type { Root } from 'react-dom/client';
 import { renderToStaticMarkup } from 'react-dom/server';
-import { createServer } from 'vite';
-import { fileURLToPath } from 'node:url';
+import { JSDOM } from 'jsdom';
+import type { HistoryPage } from './run-history';
 import type { RunHistoryReader } from './run-history-source';
+import { createViteTestServer, runDetailFixture } from './test-support';
 
-test('a host can render the viewer without local navigation, a run catalog, or an HTTP adapter', async (t) => {
-  // ELK's browser worker is idle until a graph is selected. No layout belongs to this shell test.
+function stubWorker(t: TestContext) {
   const worker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
   Object.defineProperty(globalThis, 'Worker', {
     configurable: true,
@@ -20,15 +21,148 @@ test('a host can render the viewer without local navigation, a run catalog, or a
     if (worker) Object.defineProperty(globalThis, 'Worker', worker);
     else Reflect.deleteProperty(globalThis, 'Worker');
   });
-  const server = await createServer({
-    root: fileURLToPath(new URL('..', import.meta.url)),
-    configFile: false,
-    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
-    appType: 'custom',
-    optimizeDeps: { noDiscovery: true },
+}
+
+async function viewerModule(t: TestContext) {
+  const server = await createViteTestServer(t);
+  const viewer = await server.ssrLoadModule('/src/RunHistoryView.tsx');
+  return { RunHistoryView: viewer.RunHistoryView };
+}
+
+const completePage = (): HistoryPage => ({
+  events: [],
+  nextCursor: 'v2:0',
+  headCursor: 'v2:0',
+  complete: true,
+});
+
+const renderedText = (container: HTMLElement) => container.textContent ?? '';
+const browserGlobals = [
+  'window',
+  'document',
+  'navigator',
+  'Element',
+  'HTMLElement',
+  'SVGElement',
+  'Node',
+  'requestAnimationFrame',
+  'cancelAnimationFrame',
+  'ResizeObserver',
+] as const;
+
+function installBrowser(t: TestContext) {
+  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
+    pretendToBeVisual: true,
+    url: 'https://example.test/',
+  });
+  const descriptors = new Map(
+    browserGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
+  );
+  class ResizeObserverStub {
+    observe() {}
+    unobserve() {}
+    disconnect() {}
+  }
+  const globals = {
+    window: dom.window,
+    document: dom.window.document,
+    navigator: dom.window.navigator,
+    Element: dom.window.Element,
+    HTMLElement: dom.window.HTMLElement,
+    SVGElement: dom.window.SVGElement,
+    Node: dom.window.Node,
+    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
+    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
+    ResizeObserver: ResizeObserverStub,
+  };
+  for (const name of browserGlobals)
+    Object.defineProperty(globalThis, name, { configurable: true, value: globals[name] });
+  Object.defineProperty(dom.window, 'ResizeObserver', {
+    configurable: true,
+    value: ResizeObserverStub,
+  });
+  Object.defineProperties(dom.window.HTMLElement.prototype, {
+    clientWidth: { configurable: true, get: () => 800 },
+    clientHeight: { configurable: true, get: () => 600 },
+    offsetWidth: { configurable: true, get: () => 800 },
+    offsetHeight: { configurable: true, get: () => 600 },
+  });
+  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
+    x: 0,
+    y: 0,
+    top: 0,
+    right: 800,
+    bottom: 600,
+    left: 0,
+    width: 800,
+    height: 600,
+    toJSON: () => ({}),
+  });
+  const styles = dom.window.document.createElement('style');
+  styles.textContent = '.react-flow__pane { z-index: 1; }';
+  dom.window.document.head
```

---

### Incident Patch 10: `6eb9227e` (2026-09-22)
**Commit Message**: fix(target): isolate ledgers and hosted workspaces (#1147)

<!-- zeroshot-delivery:generated:v1:start -->
## Summary
- Validate the production SQLite ledger as a regular, non-symlink,
supervisor-owned file before opening it.
- Normalize the ledger and existing SQLite sidecars to `0600` without
schema or storage migration.
- Restrict hosted candidate workspace roots to writer-owned `0700` while
preserving verifier copies, cleanup, and recovery ownership transfer.
- Add regression coverage for legacy ledger normalization, unsafe ledger
files, sidecar permissions, and cross-UID isolation.

## Validation
- `cargo test -p zeroshot production_ledger`
- `cargo test -p zeroshot
production_controller_normalizes_an_existing_ledger_without_migration`
- `cargo test -p zeroshot
hosted_worker_cannot_read_the_ledger_or_another_candidate`
- `cargo test -p zeroshot native_v2_capsule::tests::filesystem`
- `cargo test -p zeroshot retained_workspace`
- `cargo fmt --all -- --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `git diff --check`

Closes #1145
<!-- zeroshot-delivery:generated:v1:end -->

Co-authored-by: Zeroshot <delivery@zeroshot.invalid>

**File**: `AGENTS.md` (modified, +2/-0)
```diff
@@ -312,6 +312,8 @@ with `npm i -g @the-open-engine-company/zeroshot` or build `zeroshot` with Cargo
   run nonterminal until replacement-controller reconciliation confirms cleanup.
 - Hosted verifiers build in disposable writable copies of the current candidate. Copies include
   dirty files and build artifacts, preserve metadata, and use reflinks or independent file copies.
+  Hosted candidate workspace roots are writer-owned `0700`; workers cannot traverse another run's
+  candidate, and the supervisor-owned production ledger and existing SQLite sidecars are `0600`.
   Source traversal pins descriptors without following symlinks so concurrent renames cannot escape
   the candidate; copying alongside writers does not provide an atomic snapshot. Verifier writes
   are never promoted to the candidate or peers. Provider scratch permits execution.
```

**File**: `zeroshot/src/native_v2_capsule.rs` (modified, +5/-4)
```diff
@@ -224,9 +224,10 @@ pub struct CapsuleFilesystem {
 
 /// Establishes the capsule's role-aware Linux filesystem boundary.
 ///
-/// Writers share the run's workspace owner identity. Distinct verifier UIDs receive read/traverse but
-/// no mutation authority. The runtime root remains root-owned and non-writable; provider-specific
-/// private homes are created beneath it by [`HostedProcessPool`] identities.
+/// Writers share the run's private workspace owner identity. Hosted verifiers receive separate
+/// supervisor-created copies instead of access to this candidate. The runtime root remains
+/// root-owned and non-writable; provider-specific private homes are created beneath it by
+/// [`HostedProcessPool`] identities.
 pub fn prepare_capsule_filesystem(
     specification: CapsuleFilesystemSpec<'_>,
 ) -> Result<CapsuleFilesystem, CapsuleFilesystemError> {
@@ -246,7 +247,7 @@ pub fn prepare_capsule_filesystem(
         .process_pool
         .identity(HostedProcessScope::Writer)
         .map_err(|_| CapsuleFilesystemError::InvalidIdentity)?;
-    set_directory_boundary(&workspace, 0o755, writer.uid(), writer.gid())?;
+    set_directory_boundary(&workspace, 0o700, writer.uid(), writer.gid())?;
     set_directory_boundary(&runtime_home, 0o711, 0, 0)?;
     Ok(CapsuleFilesystem {
         workspace,
```

**File**: `zeroshot/src/native_v2_capsule/tests/filesystem.rs` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ fn assert_prepared_metadata(
 
     let workspace_metadata = fs::metadata(&prepared.workspace).assert_value();
     assert_eq!(workspace_metadata.uid(), writer.uid());
-    assert_eq!(workspace_metadata.permissions().mode() & 0o777, 0o755);
+    assert_eq!(workspace_metadata.permissions().mode() & 0o777, 0o700);
     let runtime_metadata = fs::metadata(&prepared.runtime_home).assert_value();
     assert_eq!(runtime_metadata.uid(), 0);
     assert_eq!(runtime_metadata.permissions().mode() & 0o777, 0o711);
```

**File**: `zeroshot/src/native_v2_hosting.rs` (modified, +47/-2)
```diff
@@ -98,9 +98,10 @@ impl ProductionTargetControllerFactory {
         &self,
     ) -> Result<Arc<NativeV2CloudController>, ProductionHostingError> {
         let root = prepare_storage_root(&self.config.storage_root)?;
+        let ledger_path = root.join("runs.sqlite3");
+        prepare_production_ledger(&ledger_path)?;
         let ledger: Arc<dyn RunLedger> = Arc::new(
-            SqliteRunLedger::open(root.join("runs.sqlite3"))
-                .map_err(|_| ProductionHostingError::Ledger)?,
+            SqliteRunLedger::open(ledger_path).map_err(|_| ProductionHostingError::Ledger)?,
         );
         let allocator = Arc::new(ProductionCapsuleAllocator::new(ProductionCapsuleConfig {
             storage_root: root,
@@ -246,6 +247,50 @@ fn canonical_directory(path: &std::path::Path) -> Result<PathBuf, ProductionHost
     std::fs::canonicalize(path).map_err(|_| ProductionHostingError::Storage)
 }
 
+#[cfg(unix)]
+fn prepare_production_ledger(path: &std::path::Path) -> Result<(), ProductionHostingError> {
+    use std::ffi::OsString;
+    use std::fs::OpenOptions;
+    use std::os::unix::fs::{MetadataExt as _, OpenOptionsExt as _, PermissionsExt as _};
+
+    fn secure_file(path: &std::path::Path, create: bool) -> Result<(), ProductionHostingError> {
+        let mut options = OpenOptions::new();
+        options
+            .read(true)
+            .mode(0o600)
+            .custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW | libc::O_NONBLOCK);
+        if create {
+            options.write(true).create(true);
+        }
+        let file = match options.open(path) {
+            Ok(file) => file,
+            Err(error) if !create && error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
+            Err(_) => return Err(ProductionHostingError::Ledger),
+        };
+        let metadata = file
+            .metadata()
+            .map_err(|_| ProductionHostingError::Ledger)?;
+        if !metadata.is_file() || metadata.uid() != unsafe { libc::geteuid() } {
+            return Err(ProductionHostingError::Ledger);
+        }
+        file.set_permissions(std::fs::Permissions::from_mode(0o600))
+            .map_err(|_| ProductionHostingError::Ledger)
+    }
+
+    secure_file(path, true)?;
+    for suffix in ["-wal", "-shm", "-journal"] {
+        let mut sidecar: OsString = path.as_os_str().to_owned();
+        sidecar.push(suffix);
+        secure_file(std::path::Path::new(&sidecar), false)?;
+    }
+    Ok(())
+}
+
+#[cfg(not(unix))]
+fn prepare_production_ledger(_path: &std::path::Path) -> Result<(), ProductionHostingError> {
+    Ok(())
+}
+
 #[cfg(unix)]
 fn set_traversable_directory(path: &std::path::Path) -> Result<(), std::io::Error> {
     use std::os::unix::fs::PermissionsExt as _;
```

**File**: `zeroshot/src/native_v2_hosting/tests.rs` (modified, +140/-0)
```diff
@@ -3,7 +3,9 @@
 use std::collections::{BTreeMap, BTreeSet};
 use std::fs;
 use std::os::unix::fs::PermissionsExt as _;
+use std::os::unix::process::CommandExt as _;
 use std::path::Path;
+use std::process::{Command, Stdio};
 use std::time::Duration;
 
 use openengine_cluster_protocol::{
@@ -115,6 +117,144 @@ async fn sqlite_controllers_share_one_durable_namespace_without_a_target_wide_cl
     assert!(root.path().join("runs.sqlite3").is_file());
 }
 
+#[tokio::test]
+async fn production_controller_normalizes_an_existing_ledger_without_migration() {
+    let root = TestDirectory::new("hosting-ledger-permissions");
+    let ledger_path = root.path().join("runs.sqlite3");
+    drop(SqliteRunLedger::open(&ledger_path).assert_value_with("create existing ledger"));
+    fs::set_permissions(&ledger_path, fs::Permissions::from_mode(0o644)).assert_value();
+
+    ProductionTargetControllerFactory::new(hosting_config(root.path().to_owned()))
+        .create_controller()
+        .await
+        .assert_value_with("open existing production ledger");
+
+    assert_eq!(
+        fs::metadata(ledger_path)
+            .assert_value()
+            .permissions()
+            .mode()
+            & 0o777,
+        0o600
+    );
+}
+
+#[test]
+fn production_ledger_normalizes_existing_sqlite_sidecars() {
+    let root = TestDirectory::new("hosting-ledger-sidecars");
+    let ledger_path = root.path().join("runs.sqlite3");
+    for path in [
+        ledger_path.clone(),
+        root.path().join("runs.sqlite3-wal"),
+        root.path().join("runs.sqlite3-shm"),
+        root.path().join("runs.sqlite3-journal"),
+    ] {
+        fs::write(&path, "existing").assert_value();
+        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).assert_value();
+    }
+
+    prepare_production_ledger(&ledger_path).assert_value();
+
+    for path in [
+        ledger_path,
+        root.path().join("runs.sqlite3-wal"),
+        root.path().join("runs.sqlite3-shm"),
+        root.path().join("runs.sqlite3-journal"),
+    ] {
+        assert_eq!(
+            fs::metadata(path).assert_value().permissions().mode() & 0o777,
+            0o600
+        );
+    }
+}
+
+#[test]
+fn production_ledger_rejects_symlinks_and_foreign_owners() {
+    use std::os::unix::fs::{MetadataExt as _, chown, symlink};
+
+    let root = TestDirectory::new("hosting-ledger-validation");
+    let target = root.path().join("target");
+    fs::write(&target, "target").assert_value();
+    let ledger_path = root.path().join("runs.sqlite3");
+    symlink(&target, &ledger_path).assert_value();
+    assert_eq!(
+        prepare_production_ledger(&ledger_path),
+        Err(ProductionHostingError::Ledger)
+    );
+
+    fs::remove_file(&ledger_path).assert_value();
+    fs::write(&ledger_path, "ledger").assert_value();
+    if unsafe { libc::geteuid() } == 0 {
+        chown(&ledger_path, Some(31_002), Some(31_002)).assert_value();
+        assert_ne!(fs::metadata(&ledger_path).assert_value().uid(), 0);
+        assert_eq!(
+            prepare_production_ledger(&ledger_path),
+            Err(ProductionHostingError::Ledger)
+        );
+    }
+}
+
+#[test]
+#[cfg(target_os = "linux")]
+fn hosted_worker_cannot_read_the_ledger_or_another_candidate() {
+    use crate::execution::process::{HostedProcessPool, HostedProcessScope};
+    use crate::native_v2_capsule::{CapsuleFilesystemSpec, prepare_capsule_filesystem};
+
+    if unsafe { libc::geteuid() } != 0 {
+        eprintln!("root-only cross-UID hosted boundary test skipped");
+        return;
+    }
+    let root = TestDirectory::new("hosting-cross-run-boundary");
+    let storage = prepare_storage_root(&root.path().to_owned()).assert_value();
+    let ledger_path = storage.join("runs.sqlite3");
+    fs::write(&ledger_path, "private ledger").assert_value();
+    prepare_production_ledger(&ledger_path).assert_value();
+
+    let first_root = storage.join("runs/first");
+    let second_root = storage.join("runs/second");
+    for ru
```

#### Recent Merged Pull Requests:
- **PR #1166** (2026-09-28): docs: explain run environment setup and startup (@mkceichelbeck)
- **PR #1165** (2026-09-26): fix(release): restore downloaded sidecar permissions (@mkceichelbeck)
- **PR #1164** (2026-09-26): fix(delivery): respect base branch merge policy (@mkceichelbeck)
- **PR #1163** (2026-09-26): fix(process): compile Unix process cleanup on macOS (@mkceichelbeck)
- **PR #1162** (2026-09-26): fix(release): recover the merged formatter update summary (@mkceichelbeck)
- **PR #1160** (2026-09-25): fix(rust): account for cumulative Codex usage (@Oscar-Williams)
- **PR #1159** (2026-09-26): feat: prepare shared workspaces with run-scoped environments (@mkceichelbeck)
- **PR #1158** (2026-09-25): ci: add full-repository Opcore check and badge (@mkceichelbeck)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
