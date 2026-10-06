# Forensic Learning Record (Deep Inspection): the-open-engine/zeroshot

> **Canonical Artifact**: `07_PROJECT_LEARNING/the-open-engine-zeroshot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/the-open-engine/zeroshot](https://github.com/the-open-engine/zeroshot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:11:33.499Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `the-open-engine/zeroshot`
- **Description**: Runs coding agents as a graph: one agent implements, independent agents review, failures go to repair, and nothing ships until the checks pass. Works with Codex, Claude Code and Copilot.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 1922 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
    W: AsyncWrite + Send + Unpin + 'static,
{
    #[must_use]
    pub fn new(reader: R, writer: W) -> Self {
        let pending: PendingMap = Arc::new(ParkingMutex::new(HashMap::new()));
        let subscriptions: SubscriptionMap = Arc::new(ParkingMutex::new(HashMap::new()));
        let sink = NdjsonFrameSink {
            writer: Arc::new(Mutex::new(writer)),
        };
        let pump = tokio::spawn(run_pump(
            reader,
            Arc::clone(&pending),
            subscriptions,
            NdjsonFrameSink {
                writer: Arc::clone(&sink.writer),
            },
        ));
        Self {
            inner: multiplex::MultiplexedTransport::new(sink, pending, pump),
            _reader: std::marker::PhantomData,
        }
    }
}

multiplex::impl_multiplexed_transport!(
    NdjsonTransport<R, W> where
    R: AsyncRead + Send + Unpin + 'static,
    W: AsyncWrite + Send + Unpin + 'static
);

/// Extracts the `id` from an outgoing request this crate serialized itself.
fn extract_request_id(request: &str) -> Result<RequestId, TransportError> {
    serde_json::from_str::<JsonRpcRequest<Value>>(request)
        .map(|request| request.id)
        .map_err(|error| TransportError::Protocol(error.to_string()))
}

/// Drives the read half: decodes bounded NDJSON lines and routes each one via
/// [`multiplex::route_and_maybe_cancel`] -- shared verbatim with
/// [`crate::websocket::WebSocketTransport`]'s pump, which routes the exact same decoded JSON
/// bodies sourced from `Message::Text` frames instead of NDJSON lines. On stream end every pending
/// request fails and every open subscription ends (dropping its sender).
async fn run_pump<R, W>(
    reader: R,
    pending: PendingMap,
    subscriptions: SubscriptionMap,
    sink: NdjsonFrameSink<W>,
) where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin + Send,
{
    let mut lines = FramedRead::new(reader, LinesCodec::new_with_max_length(MAX_FRAME_BYTES));
    while let Some(Ok(line)) = lines.next().await {
        multiplex::route_an
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

/// Generates `JsonRpcTransport`/`SubscriptionTransport` for a wire-transport wrapper type holding
/// an `inner: MultiplexedTransport<_>` field, forwarding every method to it. Written once here (as
/// a macro, not a blanket impl -- see [`MultiplexedTransport`]'s doc comment for why a blanket impl
/// does not typecheck) so [`crate::NdjsonTransport`] and [`crate::websocket::WebSocketTransport`]
/// each get one macro invocation instead of hand-writing the same forwarding source twice.
macro_rules! impl_multiplexed_transport {
    ($ty:ident < $($generic:ident),+ > where $($bound:tt)+) => {
        #[async_trait::async_trait]
        impl<$($generic),+> crate::JsonRpcTransport for $ty<$($generic),+>
        where
            $($bound)+
        {
            async fn request(&self, request: String) -> Result<String, crate::TransportError> {
                self.inner.request(request).await
            }
        }

        #[async_trait::async_trait]
        impl<$($generic),+> crate::SubscriptionTransport for $ty<$($generic),+>
        where
            $($bound)+
        {
            /// Establishment can legitimately fail with a JSON-RPC error (for example
            /// `agent/attach` rejecting an unknown or inactive `ExecutionRef`) -- that case
            /// carries no `subscriptionId` but is not a transport fault, so it is left for the
            /// caller's response parser to surface as a typed `ClientError::Rpc` rather than
            /// being collapsed into a generic `TransportError` here.
            async fn open_subscription(
                &self,
                request: String,
                id: openengine_cluster_protocol::RequestId,
            ) -> Result<(String, Option<crate::PumpedSubscription>), crate::TransportError> {
                self.inner.open_subscription(request, id).await
            }

            async fn cancel_subscription(
                &self,
                subscription_id: openengine_cluster_protocol::SubscriptionId,
            ) -> Result<(),
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

fn watch_event_cursor(event: &RunWatchEventNotification) -> Option<&Cursor> {
    Some(&event.cursor)
}

fn log_event_cursor(event: &RunLogEventNotification) -> Option<&Cursor> {
    Some(&event.cursor)
}

fn no_event_cursor(_event: &RunAttachEventNotification) -> Option<&Cursor> {
    None
}

#[cfg(test)]
#[path = "native_v2/tests.rs"]
mod tests;

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

### Core Architecture Module: `crates/openengine-cluster-client/src/ndjson_pump.rs`
```
//! Non-blocking pumped-message routing shared by every transport's response pump
//! ([`NdjsonTransport`](crate::NdjsonTransport)'s NDJSON-line pump and
//! [`WebSocketTransport`](crate::websocket::WebSocketTransport)'s `Message::Text`-frame pump):
//! resolving a unary response's pending oneshot (registering a freshly minted subscription's
//! channel first, so no `event` racing the response can be missed), or forwarding a `watch`/
//! `logs`/`agent_attach` notification to its already-registered subscription channel.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use openengine_cluster_protocol::{RequestId, SubscriptionId};
use serde_json::Value;
use tokio::sync::mpsc;

use super::{
    PendingMap, PumpedResponse, PumpedSubscription, SubscriptionMap, SubscriptionRegistration,
    SUBSCRIPTION_QUEUE_CAPACITY,
};

/// Decodes and routes one pumped line: a notification is forwarded live (see
/// [`forward_notification`]); a unary response resolves its pending oneshot, registering a
/// freshly minted subscription's channel first when the response is a successful `watch`-shaped
/// result carrying `result.subscriptionId`. Malformed JSON, a notification/response with no
/// resolvable identity, or an unknown/already-resolved request id are silently dropped -- the
/// same permissive handling `run_pump` always applied inline before this was extracted. Returns
/// the subscription id the caller must write a `subscription/cancel` for, exactly like
/// [`forward_notification`], when a live notification could not be delivered.
pub(super) fn route_pumped_message(
    line: String,
    pending: &PendingMap,
    subscriptions: &SubscriptionMap,
) -> Option<SubscriptionId> {
    route_with_capacity(line, pending, subscriptions, SUBSCRIPTION_QUEUE_CAPACITY)
}

fn route_with_capacity(
    line: String,
    pending: &PendingMap,
    subscriptions: &SubscriptionMap,
    capacity: usize,
) -> Option<SubscriptionId> {
    let Ok(value) = serde_json::from_str::<Value>(&line) else {
        return None;
    };
    if value.get("method").is_some() {
        return forward_notification(&value, line, subscriptions);
    }
    let id = value.get("id").and_then(RequestId::from_json_value)?;
    let sender = pending.lock().remove(&id)?;
    let subscription = value
        .get("result")
        .and_then(|result| result.get("subscriptionId"))
        .and_then(Value::as_str)
        .map(|subscription_id| {
            let (sender, receiver) = mpsc::channel(capacity);
            let overflowed = Arc::new(AtomicBool::new(false));
            subscriptions.lock().insert(
                SubscriptionId::new(subscription_id),
                SubscriptionRegistration {
                    sender,
                    overflowed: Arc::clone(&overflowed),
                },
            );
            PumpedSubscription {
                receiver,
                overflowed,
            }
        });
    let _ = sender.send(PumpedResponse { line, subscription });
    None
}

/// Forwards one `event`/`subscription/closed` notification without waiting on a consumer.
/// Returns the subscription id when the local receiver is full or gone and the server must be
/// cancelled. A full receiver retains its buffered events; once drained, the stream emits one
/// local `SLOW_CONSUMER` close from its exact last caller-delivered cursor.
pub(super) fn forward_notification(
    value: &Value,
    line: String,
    subscriptions: &SubscriptionMap,
) -> Option<SubscriptionId> {
    let subscription_id = value
        .get("params")
        .and_then(|params| params.get("subscriptionId"))
        .and_then(Value::as_str)?;
    let subscription_id = SubscriptionId::new(subscription_id);
    let terminal = value.get("method").and_then(Value::as_str) == Some("subscription/closed");
    let registration = subscriptions.lock().get(&subscription_id).cloned()?;

    match registration.sender.try_send(line) {
        Ok(()) => {
            if terminal {
                subscriptions.lock().remove(&subscription_id);
            }
            None
        }
        Err(mpsc::error::TrySendError::Full(_)) => {
            registration.overflowed.store(true, Ordering::Release);
            subscriptions.lock().remove(&subscription_id);
            (!terminal).then_some(subscription_id)
        }
        Err(mpsc::error::TrySendError::Closed(_)) => {
            subscriptions.lock().remove(&subscription_id);
            (!terminal).then_some(subscription_id)
        }
    }
}

/// Dedicated replay connections wait for their bounded receiver instead of discarding history.
/// No map lock is held across the wait. Dropping the receiver releases a blocked pump.
pub(super) async fn route_backpressured_message(
    line: String,
    pending: &PendingMap,
    subscriptions: &SubscriptionMap,
) -> Option<SubscriptionId> {
    let value: Value = serde_json::from_str(&line).ok()?;
    if value.get("method").is_none() {
        return route_with_capacity(line, pending, subscriptions, 8);
    }
    let subscription_id =
        SubscriptionId::new(value.get("params")?.get("subscriptionId")?.as_str()?);
    let terminal = value.get("method").and_then(Value::as_str) == Some("subscription/closed");
    let registration = subscriptions.lock().get(&subscription_id).cloned()?;
    let abandoned = registration.sender.send(line).await.is_err();
    if terminal || abandoned {
        subscriptions.lock().remove(&subscription_id);
    }
    (abandoned && !terminal).then_some(subscription_id)
}

```

### Core Architecture Module: `crates/openengine-cluster-client/src/ndjson_subscription.rs`
```
//! Shared [`crate::SubscriptionTransport`]-generic "one unary response, then live `event`/
//! `subscription/closed` notifications with no dedup or reconnect" client machinery for
//! future-only subscription capabilities (`logs`, `agent_attach`). Generated once per capability
//! via [`impl_ndjson_event_subscription`] rather than hand-copied, so the request/parse/`next`/
//! `cancel` logic exists exactly once and is driven identically by [`crate::NdjsonTransport`] and
//! [`crate::websocket::WebSocketTransport`] alike. `watch` has different (dedup + reconnect)
//! semantics and is not implemented via this macro.

pub(crate) enum PumpedLine {
    Frame(String),
    SlowConsumer,
    End,
}

pub(crate) struct SubscriptionClientCore<'a, T> {
    transport: &'a T,
}

impl<'a, T> SubscriptionClientCore<'a, T> {
    pub(crate) const fn new(transport: &'a T) -> Self {
        Self { transport }
    }

    pub(crate) const fn transport(&self) -> &'a T {
        self.transport
    }
}

pub(crate) struct SubscriptionStreamCore<'a, T> {
    transport: &'a T,
    receiver: tokio::sync::mpsc::Receiver<String>,
    overflowed: std::sync::Arc<std::sync::atomic::AtomicBool>,
    subscription_id: openengine_cluster_protocol::SubscriptionId,
    last_delivered_cursor: Option<openengine_cluster_protocol::Cursor>,
}

impl<'a, T> SubscriptionStreamCore<'a, T>
where
    T: crate::SubscriptionTransport,
{
    pub(crate) fn new(
        transport: &'a T,
        subscription: crate::PumpedSubscription,
        subscription_id: openengine_cluster_protocol::SubscriptionId,
    ) -> Self {
        Self {
            transport,
            receiver: subscription.receiver,
            overflowed: subscription.overflowed,
            subscription_id,
            last_delivered_cursor: None,
        }
    }

    pub(crate) fn with_last_delivered_cursor(
        mut self,
        cursor: Option<openengine_cluster_protocol::Cursor>,
    ) -> Self {
        self.last_delivered_cursor = cursor;
        self
    }

    pub(crate) async fn next_line(&mut self) -> PumpedLine {
        next_pumped_line(&mut self.receiver, self.overflowed.as_ref()).await
    }

    pub(crate) async fn cancel(&self) -> Result<(), crate::ClientError> {
        cancel_subscription(self.transport, self.subscription_id.clone()).await
    }

    pub(crate) const fn transport(&self) -> &'a T {
        self.transport
    }

    pub(crate) const fn subscription_id(&self) -> &openengine_cluster_protocol::SubscriptionId {
        &self.subscription_id
    }

    pub(crate) const fn last_delivered_cursor(
        &self,
    ) -> Option<&openengine_cluster_protocol::Cursor> {
        self.last_delivered_cursor.as_ref()
    }

    pub(crate) fn last_delivered_cursor_mut(
        &mut self,
    ) -> &mut Option<openengine_cluster_protocol::Cursor> {
        &mut self.last_delivered_cursor
    }

    pub(crate) fn record_delivered_cursor(&mut self, cursor: openengine_cluster_protocol::Cursor) {
        self.last_delivered_cursor = Some(cursor);
    }
}

macro_rules! impl_cursor_subscription_controls {
    () => {
        /// Sends `subscription/cancel` for this subscription. Idempotent from the caller's
        /// perspective: the server drops an unknown subscription id silently.
        pub async fn cancel(&self) -> Result<(), crate::ClientError> {
            self.core.cancel().await
        }

        #[must_use]
        pub fn last_delivered_cursor(&self) -> Option<&openengine_cluster_protocol::Cursor> {
            self.core.last_delivered_cursor()
        }
    };
}

pub(crate) use impl_cursor_subscription_controls;

pub(crate) async fn next_pumped_line(
    receiver: &mut tokio::sync::mpsc::Receiver<String>,
    overflowed: &std::sync::atomic::AtomicBool,
) -> PumpedLine {
    match receiver.recv().await {
        Some(line) => PumpedLine::Frame(line),
        None if overflowed.swap(false, std::sync::atomic::Ordering::AcqRel) => {
            PumpedLine::SlowConsumer
        }
        None => PumpedLine::End,
    }
}

pub(crate) fn parse_subscription_response<R>(
    line: &str,
    expected_id: &openengine_cluster_protocol::RequestId,
) -> Result<R, crate::ClientError>
where
    R: serde::de::DeserializeOwned,
{
    let value: serde_json::Value = serde_json::from_str(line)
        .map_err(|error| crate::ClientError::InvalidResponse(error.to_string()))?;
    if value.get("error").is_some() {
        let response: openengine_cluster_protocol::JsonRpcErrorResponse =
            serde_json::from_value(value)
                .map_err(|error| crate::ClientError::InvalidResponse(error.to_string()))?;
        crate::validate_response_identity(&response.jsonrpc, response.id.as_ref(), expected_id)?;
        return Err(crate::ClientError::Rpc(response.error));
    }
    let response: openengine_cluster_protocol::JsonRpcSuccess<R> = serde_json::from_value(value)
        .map_err(|error| crate::ClientError::InvalidResponse(error.to_string()))?;
    crate::validate_response_identity(&response.jsonrpc, Some(&response.id), expected_id)?;
    Ok(response.result)
}

pub(crate) fn parse_subscription_close(
    value: serde_json::Value,
    expected_id: &openengine_cluster_protocol::SubscriptionId,
) -> Result<
    (
        openengine_cluster_protocol::SubscriptionCloseReason,
        Option<openengine_cluster_protocol::Cursor>,
    ),
    crate::ClientError,
> {
    let notification: openengine_cluster_protocol::JsonRpcNotification<
        openengine_cluster_protocol::SubscriptionClosedNotification,
    > = serde_json::from_value(value)
        .map_err(|error| crate::ClientError::InvalidResponse(error.to_string()))?;
    if &notification.params.subscription_id != expected_id {
        return Err(crate::ClientError::InvalidResponse(
            "close notification subscription id mismatch".to_owned(),
        ));
    }
    Ok((
        notification.params.reason,
        notification.params.last_delivered_cursor,
    ))
}

pub(crate) fn parse_subscription_notification(
    line: &str,
) -> Result<(Option<String>, serde_json::Value), crate::ClientError> {
    let value: serde_json::Value = serde_json::from_str(line)
        .map_err(|error| crate::ClientError::InvalidResponse(error.to_string()))?;
    let method = value
        .get("method")
        .and_then(serde_json::Value::as_str)
        .map(str::to_owned);
    Ok((method, value))
}

pub(crate) async fn cancel_subscription<T>(
    transport: &T,
    id: openengine_cluster_protocol::SubscriptionId,
) -> Result<(), crate::ClientError>
where
    T: crate::SubscriptionTransport,
{
    transport.cancel_subscription(id).await?;
    Ok(())
}

pub(crate) async fn open_subscription<T, P, R>(
    transport: &T,
    method: &str,
    params: P,
) -> Result<(R, Option<crate::PumpedSubscription>), crate::ClientError>
where
    T: crate::SubscriptionTransport,
    P: serde::Serialize + Send,
    R: serde::de::DeserializeOwned,
{
    let id = transport.next_watch_request_id();
    let request = serde_json::to_string(&openengine_cluster_protocol::JsonRpcRequest {
        jsonrpc: openengine_cluster_protocol::JSON_RPC_VERSION.to_owned(),
        id: id.clone(),
        method: method.to_owned(),
        params,
    })?;
    let (line, subscription) = transport.open_subscription(request, id.clone()).await?;
    let result = parse_subscription_response(&line, &id)?;
    Ok((result, subscription))
}

macro_rules! impl_ndjson_event_subscription {
    (
        generic_client: $client:ident,
        generic_stream: $stream:ident,
        ndjson_client: $ndjson_client:ident,
        ndjson_stream: $ndjson_stream:ident,
        event_or_closed: $event_or_closed:ident,
        method_fn: $method_fn:ident,
        method_name: $method_name:literal,
        params: $params_ty:ty,
        result: $result_ty:ty,
        event: $event_ty:ty,
        event_notification: $event_notification_ty:ty,
        event_field: $event_field:ident,
        closed_notification: $closed_notification_ty:ty,
        parse_response_fn: $parse_response_fn:ident,
        parse_notification_fn: $parse_notification_fn:ident,
    ) => {
        #[derive(Clone, Debug, PartialEq)]
        pub enum $event_or_closed {
            Event($event_ty),
            Closed {
                reason: openengine_cluster_protocol::SubscriptionCloseReason,
            },
        }

        pub struct $client<'a, T> {
            transport: &'a T,
        }

        #[doc = concat!("[`", stringify!($client), "`] bound to [`crate::NdjsonTransport`].")]
        pub type $ndjson_client<'a, R, W> = $client<'a, crate::NdjsonTransport<R, W>>;

        impl<'a, T> $client<'a, T>
        where
            T: crate::SubscriptionTransport,
        {
            #[must_use]
            pub const fn new(transport: &'a T) -> Self {
                Self { transport }
            }

            pub async fn $method_fn(
                &self,
                params: $params_ty,
            ) -> Result<($result_ty, $stream<'a, T>), crate::ClientError> {
                let id = self.transport.next_watch_request_id();
                let request =
                    serde_json::to_string(&openengine_cluster_protocol::JsonRpcRequest {
                        jsonrpc: openengine_cluster_protocol::JSON_RPC_VERSION.to_owned(),
                        id: id.clone(),
                        method: $method_name.to_owned(),
                        params,
                    })?;
                let (line, subscription) = self
                    .transport
                    .open_subscription(request, id.clone())
                    .await?;
                let result = $parse_response_fn(&line, &id)?;
                let subscription = subscription.ok_or_else(|| {
                    crate::ClientError::InvalidResponse(
                        concat!(
                            "a successful ",
                            $method_name,
                            " response must carry a subscriptionId"
          
```

### Core Architecture Module: `crates/openengine-cluster-client/src/ndjson_watch.rs`
```
//! [`SubscriptionTransport`]-generic watch subscription client. Mirrors
//! [`crate::watch::ReconnectingEventStream`]'s `(runId, cursor)` dedup and
//! reconnect-from-last-delivered-cursor semantics, but drives them over any
//! [`SubscriptionTransport`]'s wire-framed `watch`/`event`/`subscription/cancel`/
//! `subscription/closed` notifications instead of the in-process
//! [`openengine_cluster_server::Dispatcher`] passthrough.
//! [`NdjsonWatchClient`]/[`NdjsonReconnectingEventStream`] alias this machinery to
//! [`crate::NdjsonTransport`]; [`crate::websocket::WebSocketTransport`] reuses it unchanged.

use std::collections::HashSet;
use openengine_cluster_protocol::{
    Cursor, EventNotification, JsonRpcNotification, RunId, SubscriptionCloseReason, WatchParams,
    WatchResult,
};
use openengine_cluster_server::watch::PublicEventRecord;

use crate::watch::admit_event;
use crate::ndjson_subscription::{
    impl_cursor_subscription_controls, open_subscription, parse_subscription_close,
    parse_subscription_notification, PumpedLine, SubscriptionClientCore, SubscriptionStreamCore,
};
use crate::{ClientError, EventOrClosed, NdjsonTransport, SubscriptionTransport};

/// Typed watch client generic over any [`SubscriptionTransport`]. Request ids come from the
/// shared transport rather than a client-local counter, so independently constructed watch
/// clients on one connection cannot replace each other's pending response waiters.
pub struct WatchSubscriptionClient<'a, T> {
    core: SubscriptionClientCore<'a, T>,
}

/// [`WatchSubscriptionClient`] bound to [`NdjsonTransport`].
pub type NdjsonWatchClient<'a, R, W> = WatchSubscriptionClient<'a, NdjsonTransport<R, W>>;

impl<'a, T> WatchSubscriptionClient<'a, T>
where
    T: SubscriptionTransport,
{
    #[must_use]
    pub const fn new(transport: &'a T) -> Self {
        Self {
            core: SubscriptionClientCore::new(transport),
        }
    }

    pub async fn watch(
        &self,
        params: WatchParams,
    ) -> Result<(WatchResult, WatchSubscriptionEventStream<'a, T>), ClientError> {
        let (result, subscription): (WatchResult, _) =
            open_subscription(self.core.transport(), "watch", params.clone()).await?;
        let subscription = subscription.ok_or_else(|| {
            ClientError::InvalidResponse(
                "a successful watch response must carry a subscriptionId".to_owned(),
            )
        })?;
        let stream = WatchSubscriptionEventStream {
            core: SubscriptionStreamCore::new(
                self.core.transport(),
                subscription,
                result.subscription_id.clone(),
            )
            .with_last_delivered_cursor(params.from_cursor),
            seen: HashSet::new(),
            run_id: result.run_id.clone(),
            closed: false,
        };
        Ok((result, stream))
    }
}

/// Deduplicates durable events by `(runId, cursor)` across legal at-least-once physical
/// redelivery and across reconnect, exactly like [`crate::watch::ReconnectingEventStream`] but
/// sourced from wire notifications forwarded by a [`SubscriptionTransport`]'s pump.
pub struct WatchSubscriptionEventStream<'a, T> {
    core: SubscriptionStreamCore<'a, T>,
    seen: HashSet<(RunId, Cursor)>,
    run_id: Option<RunId>,
    closed: bool,
}

/// [`WatchSubscriptionEventStream`] bound to [`NdjsonTransport`].
pub type NdjsonReconnectingEventStream<'a, R, W> =
    WatchSubscriptionEventStream<'a, NdjsonTransport<R, W>>;

impl<'a, T> WatchSubscriptionEventStream<'a, T>
where
    T: SubscriptionTransport,
{
    /// Returns the next logically new event, transparently dropping legal duplicate physical
    /// deliveries, or a terminal close. Returns `None` once the subscription's channel ends
    /// (cancelled locally, or the transport's connection ended).
    pub async fn next(&mut self) -> Option<EventOrClosed> {
        self.try_next().await?.ok()
    }

    /// Fallible counterpart to [`Self::next`] for callers that need malformed peer frames
    /// distinguished from an ordinary end of stream.
    pub async fn try_next(&mut self) -> Option<Result<EventOrClosed, ClientError>> {
        if self.closed {
            return None;
        }
        loop {
            let line = match self.core.next_line().await {
                PumpedLine::Frame(line) => line,
                PumpedLine::SlowConsumer => {
                    self.closed = true;
                    return Some(Ok(EventOrClosed::Closed {
                        reason: SubscriptionCloseReason::SlowConsumer,
                        last_delivered_cursor: self.core.last_delivered_cursor().cloned(),
                    }));
                }
                PumpedLine::End => {
                    self.closed = true;
                    return None;
                }
            };
            match self.parse_notification(&line) {
                Ok(Some(event)) => return Some(Ok(event)),
                Ok(None) => {}
                Err(error) => {
                    self.closed = true;
                    return Some(Err(error));
                }
            }
        }
    }

    fn parse_notification(&mut self, line: &str) -> Result<Option<EventOrClosed>, ClientError> {
        let (method, value) = parse_subscription_notification(line)?;
        match method.as_deref() {
            Some("event") => {
                let notification: JsonRpcNotification<EventNotification> =
                    serde_json::from_value(value)
                        .map_err(|error| ClientError::InvalidResponse(error.to_string()))?;
                let record = PublicEventRecord {
                    run_id: notification.params.run_id,
                    cursor: notification.params.cursor,
                    event: notification.params.event,
                };
                self.run_id.get_or_insert_with(|| record.run_id.clone());
                if !admit_event(
                    &mut self.seen,
                    self.core.last_delivered_cursor_mut(),
                    &record,
                ) {
                    return Ok(None);
                }
                Ok(Some(EventOrClosed::Event(record)))
            }
            Some("subscription/closed") => {
                let (reason, last_delivered_cursor) =
                    parse_subscription_close(value, self.core.subscription_id())?;
                if let Some(cursor) = &last_delivered_cursor {
                    self.core.record_delivered_cursor(cursor.clone());
                }
                self.closed = true;
                Ok(Some(EventOrClosed::Closed {
                    reason,
                    last_delivered_cursor,
                }))
            }
            other => Err(ClientError::InvalidResponse(format!(
                "unexpected subscription notification method {other:?}"
            ))),
        }
    }

    impl_cursor_subscription_controls!();

    /// Re-establishes a subscription from this stream's last delivered cursor, on the same run it
    /// had attached to (or still parked, if it never attached). The dedup set survives the
    /// reconnect so a duplicate delivered before and after reconnect is still suppressed once.
    pub async fn reconnect(
        self,
    ) -> Result<(WatchResult, WatchSubscriptionEventStream<'a, T>), ClientError> {
        let watch_client = WatchSubscriptionClient::new(self.core.transport());
        let params = WatchParams {
            run_id: self.run_id,
            from_cursor: self.core.last_delivered_cursor().cloned(),
        };
        let (result, mut stream) = watch_client.watch(params).await?;
        stream.seen = self.seen;
        Ok((result, stream))
    }
}

```

### Core Architecture Module: `crates/openengine-cluster-client/src/watch.rs`
```
//! Typed in-process watch subscription client with client-side `(runId, cursor)` dedup and
//! reconnect-from-last-delivered-cursor. NDJSON/WebSocket subscription binding is out of scope
//! for this slice, so this wraps the transport-neutral [`Dispatcher::watch`] passthrough
//! directly rather than [`crate::JsonRpcTransport`].

use std::collections::HashSet;

use openengine_cluster_protocol::{Cursor, RunId, SubscriptionCloseReason, WatchParams, WatchResult};
use openengine_cluster_server::watch::{
    PublicEventRecord, WatchEventStream, WatchHandle, WatchStreamItem,
};
use openengine_cluster_server::{BackendError, ClusterBackend, Dispatcher};

/// Admits a durable event into a `(runId, cursor)` de-dup set, returning `true` the first time
/// this pair is seen (updating `last_delivered`) or `false` for a legal at-least-once physical
/// duplicate redelivery the caller must drop. Shared by [`ReconnectingEventStream::next`]
/// (in-process) and [`crate::NdjsonReconnectingEventStream::next`] (NDJSON), which otherwise
/// source events from entirely different transports.
pub(crate) fn admit_event(
    seen: &mut HashSet<(RunId, Cursor)>,
    last_delivered: &mut Option<Cursor>,
    record: &PublicEventRecord,
) -> bool {
    let key = (record.run_id.clone(), record.cursor.clone());
    if !seen.insert(key) {
        return false;
    }
    *last_delivered = Some(record.cursor.clone());
    true
}

/// One item observed by [`ReconnectingEventStream`]: a durable public event not yet seen by this
/// stream, or a terminal close.
#[derive(Clone, Debug, PartialEq)]
pub enum EventOrClosed {
    Event(PublicEventRecord),
    Closed {
        reason: SubscriptionCloseReason,
        last_delivered_cursor: Option<Cursor>,
    },
}

/// Typed in-process watch client. Wraps a [`Dispatcher`] directly since NDJSON/WebSocket
/// subscription framing is bound by a later issue.
pub struct WatchClient<B> {
    dispatcher: Dispatcher<B>,
}

impl<B> WatchClient<B>
where
    B: ClusterBackend,
{
    #[must_use]
    pub const fn new(dispatcher: Dispatcher<B>) -> Self {
        Self { dispatcher }
    }

    pub async fn watch(
        &self,
        params: WatchParams,
    ) -> Result<(WatchResult, ReconnectingEventStream, WatchHandle), BackendError> {
        let (result, stream, handle) = self.dispatcher.watch(params.clone()).await?;
        let reconnecting = ReconnectingEventStream {
            stream,
            seen: HashSet::new(),
            last_delivered: params.from_cursor,
            subscription_params: WatchParams {
                run_id: result.run_id.clone(),
                from_cursor: None,
            },
        };
        Ok((result, reconnecting, handle))
    }

    /// Re-establishes a subscription from `stream`'s last delivered cursor, on the same run it
    /// had attached to (or still parked, if it never attached). The dedup set survives the
    /// reconnect so a duplicate delivered before and after reconnect is still suppressed once.
    pub async fn reconnect(
        &self,
        stream: ReconnectingEventStream,
    ) -> Result<(WatchResult, ReconnectingEventStream, WatchHandle), BackendError> {
        let params = WatchParams {
            run_id: stream.subscription_params.run_id.clone(),
            from_cursor: stream.last_delivered.clone(),
        };
        let (result, next_stream, handle) = self.dispatcher.watch(params).await?;
        let reconnecting = ReconnectingEventStream {
            stream: next_stream,
            seen: stream.seen,
            last_delivered: stream.last_delivered,
            subscription_params: WatchParams {
                run_id: result.run_id.clone(),
                from_cursor: None,
            },
        };
        Ok((result, reconnecting, handle))
    }
}

/// Deduplicates durable events by `(runId, cursor)` across legal at-least-once physical
/// redelivery and across reconnect.
pub struct ReconnectingEventStream {
    stream: WatchEventStream,
    seen: HashSet<(RunId, Cursor)>,
    last_delivered: Option<Cursor>,
    subscription_params: WatchParams,
}

impl ReconnectingEventStream {
    /// Returns the next logically new event, transparently dropping legal duplicate physical
    /// deliveries, or a terminal close. Returns `None` once the subscription is cancelled or
    /// otherwise permanently done.
    pub async fn next(&mut self) -> Option<EventOrClosed> {
        loop {
            match self.stream.next().await? {
                WatchStreamItem::Record(record) => {
                    self.subscription_params
                        .run_id
                        .get_or_insert_with(|| record.run_id.clone());
                    if !admit_event(&mut self.seen, &mut self.last_delivered, &record) {
                        continue;
                    }
                    return Some(EventOrClosed::Event(record));
                }
                WatchStreamItem::Closed {
                    reason,
                    last_delivered_cursor,
                } => {
                    if last_delivered_cursor.is_some() {
                        self.last_delivered = last_delivered_cursor.clone();
                    }
                    return Some(EventOrClosed::Closed {
                        reason,
                        last_delivered_cursor,
                    });
                }
            }
        }
    }

    #[must_use]
    pub fn last_delivered_cursor(&self) -> Option<&Cursor> {
        self.last_delivered.as_ref()
    }
}

```

### Core Architecture Module: `crates/openengine-cluster-client/src/websocket.rs`
```
//! Production WebSocket transport for the typed Cluster Protocol client: demultiplexes unary
//! request/response traffic and generic `watch`/`logs`/`agent_attach` subscription notifications
//! sharing one WebSocket connection, correlating by request id and subscription id respectively.
//! A private WebSocket frame sink backs the shared transport core, and [`WebSocketTransport`]
//! holds one private multiplexed transport built from it -- the exact same demux state and
//! [`crate::JsonRpcTransport`]/[`crate::SubscriptionTransport`] wiring [`crate::NdjsonTransport`]
//! holds -- so only the underlying frame shape (NDJSON line vs.
//! `Message::Text`) differs between the two transports.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use parking_lot::Mutex as ParkingMutex;
use rustls::pki_types::CertificateDer;
use rustls::{ClientConfig, RootCertStore};
use thiserror::Error;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::http::{StatusCode, Uri};
use tokio_tungstenite::tungstenite::Error as TungsteniteError;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{Connector, MaybeTlsStream, WebSocketStream};
use tokio_tungstenite::connect_async_tls_with_config;

use crate::multiplex;
use crate::{PendingMap, SubscriptionMap, TransportError};

/// Options applied to one outbound WebSocket connection.
///
/// System trust roots are always loaded for `wss://`. Additional roots augment that store; they
/// never replace system roots. Plaintext is denied unless [`Self::allow_plaintext`] is called with
/// `true` for this connection.
#[derive(Debug, Default)]
pub struct WebSocketDialOptions {
    allow_plaintext: bool,
    additional_root_certificates: Vec<CertificateDer<'static>>,
}

impl WebSocketDialOptions {
    /// Explicitly opts this connection into or out of plaintext `ws://`.
    #[must_use]
    pub fn allow_plaintext(mut self, allow: bool) -> Self {
        self.allow_plaintext = allow;
        self
    }

    /// Adds a DER-encoded trust anchor for a private or local certificate authority.
    #[must_use]
    pub fn with_additional_root_certificate(
        mut self,
        certificate: CertificateDer<'static>,
    ) -> Self {
        self.additional_root_certificates.push(certificate);
        self
    }
}

/// A WebSocket transport returned by [`dial_websocket`].
pub type DialedWebSocketTransport = WebSocketTransport<MaybeTlsStream<TcpStream>>;

/// A syntactic or policy failure found before any network I/O.
#[derive(Debug, Error)]
pub enum WebSocketEndpointError {
    #[error("WebSocket endpoint is not a valid URI: {0}")]
    InvalidUri(#[from] tokio_tungstenite::tungstenite::http::uri::InvalidUri),
    #[error("WebSocket endpoint scheme must be exactly `ws` or `wss`, not `{0}`")]
    UnsupportedScheme(String),
    #[error("WebSocket endpoint must include a host")]
    MissingHost,
    #[error("WebSocket endpoint must not contain userinfo")]
    UserInfo,
    #[error("WebSocket endpoint must not contain a query")]
    Query,
    #[error("WebSocket endpoint must not contain a fragment")]
    Fragment,
}

/// Failure to establish an outbound WebSocket connection.
#[derive(Debug, Error)]
pub enum WebSocketDialError {
    #[error(transparent)]
    Endpoint(#[from] WebSocketEndpointError),
    #[error(
        "plaintext `ws://` is disabled; set `WebSocketDialOptions::allow_plaintext(true)` for this connection"
    )]
    PlaintextNotAllowed,
    #[error(
        "failed to load platform/system TLS trust roots (the `bundled-roots` feature is augmentation, not a fallback): {details}"
    )]
    SystemTrustRoots { details: String },
    #[error("a certificate loaded from the platform/system TLS trust store is invalid: {0}")]
    InvalidSystemTrustCertificate(#[source] rustls::Error),
    #[error("a configured TLS trust certificate is invalid: {0}")]
    InvalidTrustCertificate(#[source] rustls::Error),
    #[error("WebSocket redirect response {status} rejected; redirects are never followed")]
    RedirectRejected { status: StatusCode },
    #[error("WebSocket connection failed: {0}")]
    Connection(#[source] Box<TungsteniteError>),
}

/// Dials exactly the validated caller-supplied endpoint.
///
/// The endpoint is rejected before network I/O unless it has a `ws` or `wss` scheme, a host, and
/// no userinfo, query, or fragment. Redirect handshake responses are returned as errors and their
/// targets are never opened.
pub async fn dial_websocket(
    endpoint: &str,
    options: WebSocketDialOptions,
) -> Result<DialedWebSocketTransport, WebSocketDialError> {
    let (endpoint, secure) = validate_endpoint(endpoint)?;
    if !secure && !options.allow_plaintext {
        return Err(WebSocketDialError::PlaintextNotAllowed);
    }

    let connector = if secure {
        Some(build_tls_connector(options.additional_root_certificates)?)
    } else {
        None
    };
    let result = connect_async_tls_with_config(endpoint, None, false, connector).await;
    match result {
        Ok((stream, _response)) => Ok(WebSocketTransport::new(stream)),
        Err(TungsteniteError::Http(response)) if response.status().is_redirection() => {
            Err(WebSocketDialError::RedirectRejected {
                status: response.status(),
            })
        }
        Err(error) => Err(WebSocketDialError::Connection(Box::new(error))),
    }
}

fn validate_endpoint(endpoint: &str) -> Result<(Uri, bool), WebSocketEndpointError> {
    if endpoint.contains('#') {
        return Err(WebSocketEndpointError::Fragment);
    }
    let endpoint: Uri = endpoint.parse()?;
    if endpoint.query().is_some() {
        return Err(WebSocketEndpointError::Query);
    }
    let authority = endpoint
        .authority()
        .ok_or(WebSocketEndpointError::MissingHost)?;
    if authority.as_str().contains('@') {
        return Err(WebSocketEndpointError::UserInfo);
    }
    if authority.host().is_empty() {
        return Err(WebSocketEndpointError::MissingHost);
    }
    match endpoint.scheme_str() {
        Some("ws") => Ok((endpoint, false)),
        Some("wss") => Ok((endpoint, true)),
        Some(scheme) => Err(WebSocketEndpointError::UnsupportedScheme(scheme.to_owned())),
        None => Err(WebSocketEndpointError::UnsupportedScheme(
            "<missing>".to_owned(),
        )),
    }
}

fn build_tls_connector(
    additional_root_certificates: Vec<CertificateDer<'static>>,
) -> Result<Connector, WebSocketDialError> {
    let native = rustls_native_certs::load_native_certs();
    build_tls_connector_from_native(
        native.certs,
        native
            .errors
            .into_iter()
            .map(|error| error.to_string())
            .collect(),
        additional_root_certificates,
    )
}

fn build_tls_connector_from_native(
    native_certificates: Vec<CertificateDer<'static>>,
    native_errors: Vec<String>,
    additional_root_certificates: Vec<CertificateDer<'static>>,
) -> Result<Connector, WebSocketDialError> {
    if !native_errors.is_empty() {
        return Err(WebSocketDialError::SystemTrustRoots {
            details: native_errors.join("; "),
        });
    }
    if native_certificates.is_empty() {
        return Err(WebSocketDialError::SystemTrustRoots {
            details: "the platform/system trust store contained no certificates".to_owned(),
        });
    }

    let mut roots = RootCertStore::empty();
    for certificate in native_certificates {
        roots
            .add(certificate)
            .map_err(WebSocketDialError::InvalidSystemTrustCertificate)?;
    }
    #[cfg(feature = "bundled-roots")]
    roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    for certificate in additional_root_certificates {
        roots
            .add(certificate)
            .map_err(WebSocketDialError::InvalidTrustCertificate)?;
    }

    let config = ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth();
    Ok(Connector::Rustls(Arc::new(config)))
}

/// Sends one already-serialized JSON-RPC frame as a `Message::Text` -- the
/// [`multiplex::FrameSink`] implementation backing [`WebSocketTransport`].
struct WebSocketFrameSink<S> {
    sink: Arc<Mutex<SplitSink<WebSocketStream<S>, Message>>>,
}

#[async_trait]
impl<S> multiplex::FrameSink for WebSocketFrameSink<S>
where
    S: AsyncRead + AsyncWrite + Send + Unpin + 'static,
{
    async fn send_frame(&self, frame: String) -> Result<(), TransportError> {
        let mut sink = self.sink.lock().await;
        sink.send(Message::text(frame))
            .await
            .map_err(|error| TransportError::Protocol(error.to_string()))
    }
}

/// WebSocket transport that demultiplexes unary request/response traffic and generic `watch`
/// subscription notifications sharing one connection. Holds one
/// private multiplexed transport, which owns the demux state (write sink, pending-request map,
/// pump task, watch-id counter) and implements every [`crate::JsonRpcTransport`]/
/// [`crate::SubscriptionTransport`] method against it.
pub struct WebSocketTransport<S> {
    inner: multiplex::MultiplexedTransport<WebSocketFrameSink<S>>,
}

impl<S> WebSocketTransport<S>
where
    S: AsyncRead + AsyncWrite + Send + Unpin + 'static,
{
    #[must_use]
    pub fn new(ws: WebSocketStream<S>) -> Self {
        Self::with_delivery(ws, false)
    }

    /// Creates a dedicated bulk replay connection with an eight-frame receive queue.
    /// Pausing a subscriber backpressures the entire connection; use separate connections for
    /// control requests and other observers. Messages above one MiB end the connection before entering the queue.
    /// Configure the WebSocket frame/message limits when dialing to bound wire allocation too.
    #[must_use]
    pub fn with_subscription_backpressure(ws: WebSocketSt
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

### Incident Patch 1: `3781f1bc` (2026-10-06)
**Commit Message**: fix(claude): preserve local USER for macOS Keychain login (#1195)

## Summary

Preserve the invoking shell's `USER` in local Claude processes so macOS
Keychain login works without a wrapper. Hosted processes continue to
ignore native context, and explicitly declared connection values take
precedence.

Clarify that safe mode applies only to permission inspection; local
worker and reviewer turns load native Claude customizations.

## Validation

- All 83 Claude adapter tests passed, including local username
forwarding, hosted isolation, unset values, and connection precedence.
- Workspace Clippy, formatting, and Opcore Zero checks passed.
- Strict documentation build passed.

Co-authored-by: Michael Eichelbeck <[REDACTED_EMAIL]>

**File**: `docs/concepts/runtimes-and-connections.md` (modified, +6/-0)
```diff
@@ -78,6 +78,12 @@ access and Claude's supported auth-token variables for contained Anthropic acces
 keep the authored runtime unchanged; applying one to a target derives the contained requirements at
 submission time. Profiles stored on a target derive those requirements when they are stored.
 
+Local Claude workers and reviewers preserve the invoking shell's `USER` for macOS Keychain login
+and reuse native CLAUDE.md, plugins, and MCP configuration. Claude's `--safe-mode` applies only to
+the permission-settings probe before a model turn. Hosted runs use private homes and do not inherit
+the caller's `USER` or user configuration. Declare additional environment fields needed by MCP
+servers through runtime connections.
+
 Store a local static connection by prompting for its fields:
 
 ```console
```

**File**: `zeroshot/src/native_v2_capsule/provider_process/environment.rs` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ pub(crate) const CODEX_LOCAL_ENVIRONMENT: &[&str] = &[
 ];
 
 pub(crate) const CLAUDE_LOCAL_ENVIRONMENT: &[&str] = &[
+    // Claude's macOS Keychain login uses the invoking user's account name.
+    "USER",
     "ANTHROPIC_API_KEY",
     "ANTHROPIC_AUTH_TOKEN",
     "CLAUDE_CODE_OAUTH_TOKEN",
```

**File**: `zeroshot/src/native_v2_claude/tests/local_identity.rs` (modified, +47/-0)
```diff
@@ -15,6 +15,53 @@ fn local_anthropic_config(directory: &TestDirectory) -> ClaudeAdapterConfig {
     }
 }
 
+#[test]
+fn local_claude_preserves_keychain_user_without_hosted_inheritance() {
+    let directory = TestDirectory::new("claude-keychain-user");
+    let configuration = || {
+        let mut configuration = local_anthropic_config(&directory);
+        configuration.native_environment = LocalHarnessEnvironment::new(BTreeMap::from([(
+            "USER".to_owned(),
+            "keychain-user".to_owned(),
+        )]));
+        configuration
+    };
+    let binding = agent_binding("claude-sonnet-5", None, SessionScope::Execution, &[]);
+    let resolved = ResolvedEnvironment::exact(&binding, BTreeMap::new()).assert_value();
+    let home = Path::new("/private/session");
+    let local = ClaudeAdapter::new_local(configuration()).assert_value();
+    assert_eq!(
+        local.process_environment(&resolved, home).assert_value()["USER"],
+        "keychain-user"
+    );
+
+    let hosted = ClaudeAdapter::new(configuration()).assert_value();
+    assert!(
+        !hosted
+            .process_environment(&resolved, home)
+            .assert_value()
+            .contains_key("USER")
+    );
+    let unset = ClaudeAdapter::new_local(local_anthropic_config(&directory)).assert_value();
+    assert!(
+        !unset
+            .process_environment(&resolved, home)
+            .assert_value()
+            .contains_key("USER")
+    );
+
+    let binding = agent_binding("claude-sonnet-5", None, SessionScope::Execution, &["USER"]);
+    let declared = ResolvedEnvironment::exact(
+        &binding,
+        BTreeMap::from([(environment_name("USER"), "declared-user".to_owned())]),
+    )
+    .assert_value();
+    assert_eq!(
+        local.process_environment(&declared, home).assert_value()["USER"],
+        "declared-user"
+    );
+}
+
 #[test]
 fn local_claude_user_reuses_home_without_moving_session_state() {
     let directory = TestDirectory::new("claude-local-user");
```

---

### Incident Patch 2: `9159e915` (2026-10-06)
**Commit Message**: fix(release): recover immutable README summaries (#1196)

## Summary

Unblock release-note generation across the two immutable README commits
from PRs #1191 and #1192 that lack a Summary heading. Recover their
summaries through the existing exact-commit table; every other commit
still requires its authored Summary section.

## Validation

- All 66 repository tooling tests and lint passed.
- Opcore Zero checks passed.
- Release preflight generated notes for all 18 merged PRs since
v10.10.0.

Co-authored-by: Michael Eichelbeck <[REDACTED_EMAIL]>

**File**: `scripts/release-notes.js` (modified, +9/-2)
```diff
@@ -17,6 +17,14 @@ const RECOVERED_COMMIT_SUMMARIES = new Map([
     '0d688ae5773febd2e6c81def59790b04c9e8fd58',
     'Update the development formatter Prettier from 3.9.6 to 3.9.8.',
   ],
+  [
+    '6da880abae8fd454c60f80d2b23d94939c194859',
+    "Clarify that Zeroshot runs the user's existing coding agent as workers and reviewers.",
+  ],
+  [
+    '101ec9d9f50d6f7a5d871e5bc655dc03bfc54a99',
+    "Clarify that the README's custom bugfinder/E2E topology is an example and only the review loop is built in.",
+  ],
 ]);
 const CATEGORIES = Object.freeze([
   ['breaking', 'Breaking changes'],
@@ -172,8 +180,7 @@ function parseReleaseCommit(commit) {
   if (!summary && PLAIN_SUMMARY_COMMIT_EXCEPTIONS.has(commit.hash)) {
     summary = plainSummaryFromBody(commit.body);
   }
-  // This already-merged Dependabot update contains upstream HTML instead of our
-  // Summary section. Recover only this immutable object; other commits stay strict.
+  // Recover summaries only for the recorded immutable objects; other commits stay strict.
   if (!summary) summary = RECOVERED_COMMIT_SUMMARIES.get(commit.hash);
   if (!summary) throw new Error(`${commit.hash} has no release summary`);
   const breakingFooter = hasBreakingFooter(commit.body);
```

**File**: `tests/tooling/release-notes.test.js` (modified, +28/-0)
```diff
@@ -184,6 +184,34 @@ describe('release-note validation', () => {
 });
 
 describe('historical release metadata recovery', () => {
+  it('recovers only the recorded README summaries', () => {
+    for (const historical of [
+      {
+        hash: '6da880abae8fd454c60f80d2b23d94939c194859',
+        subject: "docs: say Zeroshot runs the user's existing coding agent (#1191)",
+        summary:
+          "Clarify that Zeroshot runs the user's existing coding agent as workers and reviewers.",
+      },
+      {
+        hash: '101ec9d9f50d6f7a5d871e5bc655dc03bfc54a99',
+        subject: 'docs: label the custom topology as an example (#1192)',
+        summary:
+          "Clarify that the README's custom bugfinder/E2E topology is an example and only the review loop is built in.",
+      },
+    ]) {
+      const input = { ...historical, body: 'README change without a Summary heading.' };
+      assert.equal(parseReleaseCommit(input).summary, historical.summary);
+      assert.throws(
+        () => parseReleaseCommit({ ...input, hash: 'b'.repeat(40) }),
+        /has no release summary/
+      );
+      assert.equal(
+        parseReleaseCommit({ ...input, body: '## Summary\n\nExplicit summary.' }).summary,
+        'Explicit summary.'
+      );
+    }
+  });
+
   it('recovers the immutable Dependabot update without accepting later missing summaries', () => {
     const historical = {
       hash: '0d688ae5773febd2e6c81def59790b04c9e8fd58',
```

---

### Incident Patch 3: `be185676` (2026-10-05)
**Commit Message**: docs: add RuntimePlan reference and review-loop guide (#1188)

## Summary

- New **RuntimePlan reference** (`docs/reference/runtime-plan.md`):
document fields, harness/provider grammar, `agent` and `git_delivery`
bindings (including which delivery workers accept `pullRequestFeedback:
ignore`), session-scope semantics, coverage rules, connection limits,
uniform runtime expansion, and how `--push`/`--pr`/`--ship` add
template-owned delivery bindings (and the agent nodes an exact plan must
then bind, such as `delivery_repair`). Links the generated `schema.json`
as the machine-readable contract.
- New **Build a review loop** guide (`docs/guides/review-loop.md`): a
worker plus two parallel reviewers in a bounded loop, local by default,
with a one-line note on targets. The complete graph, runtime plan, and
input ship as downloadable files under `docs/assets/review-loop/` and
are included into the page with `pymdownx.snippets`, so the page shows
exactly the validated files.
- **Direct target** (`docs/concepts/targets.md`): new "Image tags and
remote hosts" subsection: `linux/amd64` only, version/`sha-` tags vs
moving `latest`, SSH tunnel to a loopback-published target, no caller
authentic

**File**: `docs/assets/review-loop/input.json` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+{
+  "task": "Add a health-check endpoint that returns HTTP 200. Add focused tests and keep the change scoped."
+}
```

**File**: `docs/assets/review-loop/review-loop.graph.json` (added, +382/-0)
```diff
@@ -0,0 +1,382 @@
+{
+  "profile": "openengine.graph.full/v1",
+  "initialInput": {
+    "kind": "record",
+    "fields": {
+      "task": {
+        "type": {
+          "kind": "string"
+        },
+        "required": true
+      }
+    }
+  },
+  "policy": {
+    "policy": "policy.native-v2@1",
+    "default": "deny"
+  },
+  "root": {
+    "kind": "seq",
+    "name": "run",
+    "state": {
+      "kind": "record",
+      "fields": {
+        "acceptanceFeedback": {
+          "type": {
+            "kind": "string"
+          },
+          "required": true
+        },
+        "codeFeedback": {
+          "type": {
+            "kind": "string"
+          },
+          "required": true
+        },
+        "task": {
+          "type": {
+            "kind": "string"
+          },
+          "required": true
+        }
+      }
+    },
+    "children": [
+      {
+        "kind": "loop",
+        "name": "review_loop",
+        "state": {
+          "kind": "record",
+          "fields": {
+            "acceptanceFeedback": {
+              "type": {
+                "kind": "string"
+              },
+              "required": true
+            },
+            "codeFeedback": {
+              "type": {
+                "kind": "string"
+              },
+              "required": true
+            },
+            "task": {
+              "type": {
+                "kind": "string"
+              },
+              "required": true
+            }
+          }
+        },
+        "body": {
+          "kind": "seq",
+          "name": "review_iteration",
+          "state": {
+            "kind": "record",
+            "fields": {
+              "acceptanceFeedback": {
+                "type": {
+                  "kind": "string"
+                },
+                "required": true
+              },
+              "codeFeedback": {
+                "type": {
+                  "kind": "string"
+                },
+                "required": true
+              },
+              "task": {
+                "type": {
+                  "kind": "string"
+                },
+                "required": true
+              }
+            }
+          },
+          "children": [
+            {
+              "kind": "step",
+              "name": "worker",
+              "worker": "builtin.agent.software-worker@1",
+              "instructions": "Implement the requested change. If reviewer feedback is present, address both diagnostics before returning. Work in the shared repository and run focused checks.",
+              "input": {
+                "kind": "record",
+                "fields": {
+                  "acceptanceFeedback": {
+                    "type": {
+                      "kind": "string"
+                    },
+                    "required": true
+                  },
+                  "codeFeedback": {
+                    "type": {
+                      "kind": "string"
+                    },
+                    "required": true
+                  },
+                  "task": {
+                    "type": {
+                      "kind": "string"
+                    },
+                    "required": true
+                  }
+                }
+              },
+              "output": {
+                "kind": "null"
+              },
+              "inputBindings": [
+                {
+                  "target": ["task"],
+                  "value": {
+                    "source": "state",
+                    "path": ["task"]
+                  }
+                },
+                {
+                  "target": ["acceptanceFeedback"],
+                  "value": {
+                    "source": "state",
+                    "path": ["acceptanceFeedback"]
+                  }
+                },
+                {
+                  "target": ["codeFeedback"],
+                  "value": {
+                    "source": "state",
+                    "path": ["codeFeedback"]
+                  }
+                }
+              ],
+              "writeBindings": [],
+              "attempts": 1
+            },
+            {
+              "kind": "par",
+              "name": "reviews",
+              "state": {
+                "kind": "record",
+                "fields": {
+                  "acceptanceFeedback": {
+                    "type": {
+                      "kind": "string"
+                    },
+                    "required": true
+                  },
+                  "codeFeedback": {
+                    "type": {
+                      "kind": "string"
+                    },
+                    "required": true
+                  },
+                  "task": {
+                    "type": {
+                      "kind": "string"
+                    },
+                    "required": true
+                  }
+                }
+              },
+              "branches": [
+                {
+                  "kind": "verifier",
+        
```

**File**: `docs/assets/review-loop/review-loop.runtime.json` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+{
+  "harness": "codex",
+  "provider": "openai",
+  "size": "medium",
+  "nodes": {
+    "worker": {
+      "kind": "agent",
+      "model": "YOUR_MODEL_ID",
+      "sessionScope": "node_instance"
+    },
+    "acceptance": {
+      "kind": "agent",
+      "model": "YOUR_MODEL_ID",
+      "sessionScope": "execution"
+    },
+    "code": {
+      "kind": "agent",
+      "model": "YOUR_MODEL_ID",
+      "sessionScope": "execution"
+    }
+  }
+}
```

**File**: `docs/concepts/execution.md` (modified, +5/-4)
```diff
@@ -35,7 +35,8 @@ Executable nodes are `step` and `verifier`. Groups compose them:
 
 Selectors, guards, and bindings are structured data. They are not snippets of JavaScript, JSONPath,
 shell code, or prompt text. Full field rules live in the
-[graph contract](../reference/cluster/graph.md).
+[graph contract](../reference/cluster/graph.md), and [Build a review loop](../guides/review-loop.md)
+builds a custom graph step by step.
 
 ## Concurrent workspace changes
 
@@ -108,6 +109,6 @@ metadata from the finalized ledger, then the graph revisits its single Git deliv
 iteration rather than only at graph completion. Manifest failures, delivery repair requests, and
 failed or rejected receipt audits stop the run instead of publishing an unreviewed repair.
 
-PR and merge delivery consider feedback by default. Use `--no-pr-feedback`, or set
-`pullRequestFeedback` to `ignore` on the delivery runtime binding, when the run should ignore PR
-discussion. CI, conflict, freshness, and merge-policy checks remain active.
+PR and merge delivery consider feedback by default. Use `--no-pr-feedback` to ignore PR discussion;
+the [`git_delivery` binding](../reference/runtime-plan.md#git_delivery) describes the runtime
+setting.
```

**File**: `docs/concepts/runtimes-and-connections.md` (modified, +7/-12)
```diff
@@ -4,6 +4,9 @@ A graph defines the work and its control flow; the runtime plan supplies executi
 executable node. Since the two documents are separate, local, self-hosted, and managed targets can
 run the same graph.
 
+The [RuntimePlan reference](../reference/runtime-plan.md) lists every field, limit, and admission
+rule.
+
 ## Four explicit choices
 
 Each agent binding names:
@@ -13,15 +16,8 @@ Each agent binding names:
 3. an opaque provider-owned **model** identifier;
 4. zero or more named **connections**, each declaring exact environment field names.
 
-Zeroshot accepts these harness/provider pairs:
-
-| Harness   | Providers                                       |
-| --------- | ----------------------------------------------- |
-| `codex`   | `openai`, `openrouter`, `bedrock`, `gateway`    |
-| `claude`  | `anthropic`, `openrouter`, `bedrock`, `gateway` |
-| `copilot` | `github`                                        |
-
-Admission rejects known-incompatible pairs, such as `codex` with `anthropic` and `claude` with
+The [RuntimePlan reference](../reference/runtime-plan.md#harness-and-provider) lists the accepted
+harness/provider pairs. Admission rejects known-incompatible pairs, such as `codex` with `anthropic` and `claude` with
 `openai`. Zeroshot does not check current provider availability, and model names remain
 provider-owned.
 
@@ -45,9 +41,8 @@ built-in template configuration short:
 when reviewers and workers need different models, effort, sessions, or connections. Inspect node
 names first with `zeroshot template show TEMPLATE`.
 
-Session scope is either `execution` or `node_instance`. An `execution` scope opens a fresh provider
-session for each execution; `node_instance` reuses a live session when the same graph node instance
-runs again, such as across loop iterations.
+Session scope decides whether a node that runs again, such as in a loop, continues its provider
+session; see [session scope](../reference/runtime-plan.md#agent).
 
 ## Runtime configuration contains names, not secret values
 
```

**File**: `docs/concepts/targets.md` (modified, +20/-0)
```diff
@@ -133,6 +133,26 @@ worktree must have exactly one GitHub remote. `--repository` and `--branch` over
 and `--revision` selects an exact commit instead of resolving the current remote branch tip.
 Detached worktrees require explicit repository and branch values.
 
+### Image tags and remote hosts
+
+The image is published for `linux/amd64` only. Each release publishes a version tag such as
+`ghcr.io/the-open-engine/zeroshot-target:X.Y.Z` and a `sha-COMMIT` tag. `latest` moves to each newer
+release, so pin a version tag or an image digest when a host must keep the same image.
+
+To use a target on another machine, keep the published port on that host's loopback interface, as in
+the command above, and open an SSH tunnel from your workstation:
+
+```console
+ssh -N -L 8080:127.0.0.1:8080 USER@HOST
+zeroshot target add remote-target --url http://127.0.0.1:8080 --direct
+```
+
+Keep the tunnel open while you use the target. If a local target already uses port 8080, forward
+another local port and start the remote target with `--public-origin` set to that local origin,
+such as `http://127.0.0.1:18080`; the target advertises its endpoint from that origin. The
+[target image README](https://github.com/the-open-engine/zeroshot/blob/main/docker/zeroshot-target/README.md)
+covers reverse proxies, Docker access for runs, and building the image.
+
 ## Hosted target
 
 A hosted target adds discovery and user authentication around the same native contracts:
```

**File**: `docs/guides/review-loop.md` (added, +228/-0)
```diff
@@ -0,0 +1,228 @@
+# Build a review loop
+
+This guide builds a custom graph that sends one coding task through a worker and two independent
+reviewers. When either reviewer rejects the change, the loop runs the same worker again with both
+reviewers' feedback. The run succeeds when both accept, and fails after four passes.
+
+The built-in `software-change` template already does this with more recovery paths. Build the loop
+yourself when you want to change the reviewers, their instructions, or the bounds.
+
+## Before you start
+
+This guide assumes you have completed [Run a first task](../getting-started/first-run.md): Zeroshot
+is installed, the Codex CLI is signed in, and you have a Git repository with an HTTP service to
+change.
+
+!!! warning "The worker edits the current worktree"
+
+    Commit or stash work you want to protect, and run the commands from the repository you intend to
+    change.
+
+## Files
+
+The example has three files. Download them or copy them from the sections below, and keep them
+outside the repository you are changing, for example in `~/review-loop/`, so they stay out of the
+change.
+
+| File                                                                         | Purpose                                       |
+| ---------------------------------------------------------------------------- | --------------------------------------------- |
+| [`input.json`](../assets/review-loop/input.json)                             | The task                                      |
+| [`review-loop.graph.json`](../assets/review-loop/review-loop.graph.json)     | Worker, reviewers, loop, and terminal result  |
+| [`review-loop.runtime.json`](../assets/review-loop/review-loop.runtime.json) | Harness, provider, models, and session scopes |
+
+The graph controls order and data flow. The runtime plan binds only the three nodes that run agents.
+
+The excerpts in steps 1 to 4 leave out fields; the complete graph is in step 5.
+
+## 1. Define input and state
+
+A graph starts with a profile, an initial input type, and a policy. The caller supplies only the
+task:
+
+```json
+"initialInput": {
+  "kind": "record",
+  "fields": {
+    "task": { "type": { "kind": "string" }, "required": true }
+  }
+}
+```
+
+The root `seq` declares a state record with `task` plus one feedback field per reviewer,
+`acceptanceFeedback` and `codeFeedback`. The root may add required fields that have an implicit
+empty value, so both feedback strings start as `""` without appearing in `input.json`.
+
+Every structural node (`seq`, `loop`, `par`, `choice`) declares its own state type, so the graph
+repeats this record. Input bindings copy state into an agent's input. Promoted state paths copy
+updated state from a group back to the group that encloses it.
+
+## 2. Add the worker
+
+The worker is a `step`. It reads the task and both feedback fields:
+
+```json
+{
+  "kind": "step",
+  "name": "worker",
+  "worker": "builtin.agent.software-worker@1",
+  "instructions": "Implement the requested change. If reviewer feedback is present, address both diagnostics before returning. Work in the shared repository and run focused checks.",
+  "output": { "kind": "null" },
+  "writeBindings": [],
+  "attempts": 1
+}
+```
+
+The full node also declares an `input` record and three `inputBindings`, one per field. Its output
+is `null` because the worker changes files in the shared workspace rather than returning data.
+
+The `worker` value is a label local to this graph. The `builtin.` names only mirror the built-in
+template; they add no behavior. Admission derives each worker's contract from the node's declared
+input, output, signals, and diagnostic, so a label used on several nodes must keep the same
+declaration and binding kind. Every agent node needs authored `instructions`.
+
+## 3. Run two reviewers in parallel
+
+A `par` group named `reviews` runs two verifiers against the same workspace. Each verifier returns
+a `verdict` signal and a diagnostic, and writes the diagnostic message into its feedback field:
+
+```json
+{
+  "kind": "verifier",
+  "name": "acceptance",
+  "worker": "builtin.agent.acceptance-verifier@1",
+  "signals": { "verdict": ["accepted", "rejected"] },
+  "writeBindings": [
+    {
+      "value": { "node": "acceptance", "channel": "diagnostic", "path": ["message"] },
+      "target": ["acceptanceFeedback"]
+    }
+  ]
+}
+```
+
+The `code` verifier has the same shape and writes `codeFeedback`. Zeroshot tells verifiers not to
+edit the material under review; that is an instruction, not a filesystem boundary.
+
+The `all` join waits for both reviewers. `reviews` promotes both feedback paths into the iteration
+state, and the iteration promotes them into the loop state, so the next worker pass can read them.
+
+## 4. Stop on two acceptances
+
+The loop body is a `seq` of the worker and `reviews`. Loops are do-while: `until` is checked after
+each pass, so the worker always runs at least once.
+
+```json
+"unt
```

**File**: `docs/index.md` (modified, +3/-2)
```diff
@@ -77,9 +77,10 @@ charter, use `auto-research`; custom graphs follow the same protocol contracts.
 [Runtimes and connections](concepts/runtimes-and-connections.md) before choosing models or supplying
 credentials; [Observe and control runs](guides/observe-and-control.md) covers failed-run recovery,
 durable status, and log streams. [Use a local graph as an ACP agent](guides/acp.md) covers the
-experimental stdio endpoint.
+experimental stdio endpoint. [Build a review loop](guides/review-loop.md) builds a custom graph and
+runtime plan step by step.
 
-The reference section is built from product-owned definitions:
+These reference pages are generated from product-owned definitions:
 
 - [CLI reference](zeroshot-cli.md), generated from the Clap command tree;
 - [Python API](reference/python.md), generated from the SDK's public objects and docstrings;
```

---

### Incident Patch 4: `8ac13b3a` (2026-10-04)
**Commit Message**: docs: explain why we built Zeroshot (#1179)

## Summary

Add the founder's reason for building Zeroshot beneath the README's
independent-review headline: “We built Zeroshot because we were tired of
being gaslit by agents telling us broken code was ready.”

Validation: repository commit and push hooks passed, including Rust
formatting, ESLint and all 65 tooling tests. Opcore pre-commit passed.

Co-authored-by: Eivind Meyer <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@
 
 **The agent that writes the code should not be the one that decides it works.**
 
+We built Zeroshot because we were tired of being gaslit by agents telling us broken code was ready.
+
 Zeroshot turns a software goal into an explicit multi-agent graph: one agent implements, independent
 agents review, failures go back to a bounded repair loop, and nothing is delivered until the graph's
 checks pass. The implementing agent never approves its own work.
```

---

### Incident Patch 5: `735e349b` (2026-10-03)
**Commit Message**: docs: fix the expired Discord invite and add a Community section (#1174)

## Summary

The README badge and the docs-site footer linked `discord.gg/9Tnxd7XWa`,
which Discord reports as expired, so nobody could join from them. Both
now use `discord.gg/fZyzf2Cut9`, a non-expiring invite to the same
server.

Discord was also only an icon in the badge row. This adds a text link
under the intro, a **Community** section (Discord, GitHub Discussions,
Issues), and both links in `llms.txt` so agents can point users there.

Checks: `npm test` (65 pass), Prettier, `mkdocs build --strict`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-authored-by: Eivind <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +9/-1)
```diff
@@ -10,7 +10,7 @@
 <a href="https://theopenengine.com"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/social/website-dark.png"><img alt="Website" src="docs/brand/social/website-light.png" height="30"></picture></a>
 <a href="https://x.com/OpenEngineHQ"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/social/x-dark.png"><img alt="X · @OpenEngineHQ" src="docs/brand/social/x-light.png" height="30"></picture></a>
 <a href="https://www.linkedin.com/company/the-open-engine-company"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/social/linkedin-dark.png"><img alt="LinkedIn" src="docs/brand/social/linkedin-light.png" height="30"></picture></a>
-<a href="https://discord.gg/9Tnxd7XWa"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/social/discord-dark.png"><img alt="Discord" src="docs/brand/social/discord-light.png" height="30"></picture></a>
+<a href="https://discord.gg/fZyzf2Cut9"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/social/discord-dark.png"><img alt="Discord" src="docs/brand/social/discord-light.png" height="30"></picture></a>
 
 [![Release](https://img.shields.io/github/v/release/the-open-engine/zeroshot?style=flat&label=release&labelColor=171411&color=171411)](https://github.com/the-open-engine/zeroshot/releases/latest)
 [![npm](https://img.shields.io/npm/v/%40the-open-engine-company%2Fzeroshot?style=flat&labelColor=171411&color=171411)](https://www.npmjs.com/package/@the-open-engine-company/zeroshot)
@@ -36,6 +36,8 @@ the setup as a profile for the next task.
 [Opcore](https://github.com/the-open-engine/opcore) works alongside it: Opcore checks each edit while
 an agent writes code, and Zeroshot has independent agents review the whole change before it lands.
 
+Questions, ideas, or a run worth showing? Join the [Zeroshot community on Discord](https://discord.gg/fZyzf2Cut9).
+
 ## When to use it
 
 Zeroshot fits when:
@@ -284,6 +286,12 @@ zeroshot template show auto-research
 
 See [Execution](docs/concepts/execution.md) for the research workflow's decision and evidence rules.
 
+## Community
+
+- [Discord](https://discord.gg/fZyzf2Cut9): ask questions, share runs and graphs, and talk to the team.
+- [GitHub Discussions](https://github.com/the-open-engine/zeroshot/discussions): longer-form questions and show-and-tell.
+- [GitHub Issues](https://github.com/the-open-engine/zeroshot/issues): reproducible bugs and feature requests.
+
 ## Reference
 
 - [Versioned documentation](https://the-open-engine.github.io/zeroshot/)
```

**File**: `docs/llms.txt` (modified, +2/-0)
```diff
@@ -55,3 +55,5 @@ The installer needs Node.js 18+ and installs a verified native binary plus a Zer
 - [ACP agent preview](https://the-open-engine.github.io/zeroshot/current/guides/acp/)
 - [Python SDK](https://the-open-engine.github.io/zeroshot/current/guides/python-sdk/)
 - [Source](https://github.com/the-open-engine/zeroshot)
+- [Discord community](https://discord.gg/fZyzf2Cut9)
+- [GitHub Discussions](https://github.com/the-open-engine/zeroshot/discussions)
```

**File**: `mkdocs.yml` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ extra:
     - icon: fontawesome/brands/github
       link: https://github.com/the-open-engine/zeroshot
     - icon: fontawesome/brands/discord
-      link: https://discord.gg/9Tnxd7XWa
+      link: https://discord.gg/fZyzf2Cut9
     - icon: fontawesome/brands/linkedin
       link: https://www.linkedin.com/company/the-open-engine-company
     - icon: fontawesome/brands/x-twitter
```

---

### Incident Patch 6: `d9ddeae9` (2026-09-26)
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
+                     Check GitHub's rejection and base-branch policy before retrying delivery.",
+                    review.repository, review.review_id, review.target_branch,
+                ))),
             },
         }
     }
@@ -433,42 +457,52 @@ fn job_log_excerpt(
 
 enum MergeAction {
     Complete(GitHubMergeRequestOutcome),
-    Submit(policy::MergeMethod),
+    Submit { queued: bool },
 }
 
 fn merge_action(snapshot: PolicySnapshot) -> Result<MergeAction, GitHubAuthorityError> {
-    match snapshot.state {
-        GitHubReviewState::Merged { .. } => {
-            Ok(MergeAction::Complete(GitHubMergeRequestOutcome::Accepted))
-        }
-        GitHubReviewState::Conflict => {
-            Ok(MergeAction::Complete(GitHubMergeRequestOutcome::Conflict))
-        }
-        GitHubReviewState::Open {
-            checks:
-                crate::native_v2_delivery::GitHubChecks::NotRequired
-                | crate::native_v2_delivery::GitHubChecks::Passed,
-        } => snapshot
-            .merge_method

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
+#[cfg(target_os = "linux")]
+fn helper_command(marker: &std::path::Path, ending: &str) -> Command {
+    let mut command = shell(&format!(
+        "/bin/sleep 30 >/dev/null 2>&1 & printf '%s' $! > \"$1\"; {ending}"
+    ));
+    command.arg("gh-helper").arg(marker);
+    command
+}
+
+#[cfg(target_os = "linux")]
+async fn wait_for_helper_state(ready: impl Fn() -> bool) {
+    tokio::time::timeout(Duration::from_secs(2), async {
+        let mut ticks = tokio::time::interval(Duration::from_millis(5));
+        while !ready() {
+            ticks.tick().await;
+        }
+    })
+    .await
+    .expect("helper reached the expected state");
+}
+
+#[cfg(target_os = "linux")]
+async fn assert_helper_stopped(marker: &std::path::Path) {
+    let pid = std::fs::read_to_string(marker).expect("helper PID");
+    wait_for_helper_state(|| {
+        std::fs::read_to_string(format!("/proc/{pid}/stat"))
+            .map_or(true, |text| text.split_whitespace().nth(2) == Some("Z"))
+    })
+    .await;
+}
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

**File**: `zeroshot/src/native_v2_delivery/github/merge_policy.rs` (added, +328/-0)
```diff
@@ -0,0 +1,328 @@
+use std::collections::BTreeSet;
+
+use serde::Deserialize;
+use serde_json::Value;
+
+use super::{GitHubAuthorityError, GitHubReviewReceipt};
+
+const MERGE_POLICY_QUERY: &str = r#"
+query MergePolicy($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
+  repository(owner: $owner, name: $name) {
+    nameWithOwner
+    mergeCommitAllowed
+    squashMergeAllowed
+    rebaseMergeAllowed
+    pullRequest(number: $number) {
+      id
+      number
+      baseRefName
+      headRefName
+      headRefOid
+      isMergeQueueEnabled
+      baseRef {
+        name
+        branchProtectionRule { requiresLinearHistory }
+        refUpdateRule { requiresLinearHistory }
+        rules(first: 100, after: $endCursor) {
+          totalCount
+          pageInfo { hasNextPage endCursor }
+          nodes {
+            id
+            type
+            parameters { ... on PullRequestParameters { allowedMergeMethods } }
+          }
+        }
+      }
+    }
+  }
+}
+"#;
+
+#[derive(Clone, Copy, Debug, Eq, PartialEq)]
+pub(super) enum MergeMethod {
+    Queue,
+    Merge,
+    Squash,
+    Rebase,
+}
+
+#[derive(Deserialize)]
+struct QueryPage {
+    data: QueryData,
+}
+
+#[derive(Deserialize)]
+struct QueryData {
+    repository: Repository,
+}
+
+#[derive(Deserialize)]
+#[serde(rename_all = "camelCase")]
+struct Repository {
+    name_with_owner: String,
+    merge_commit_allowed: bool,
+    squash_merge_allowed: bool,
+    rebase_merge_allowed: bool,
+    pull_request: PullRequest,
+}
+
+#[derive(Deserialize)]
+#[serde(rename_all = "camelCase")]
+struct PullRequest {
+    id: String,
+    number: u64,
+    base_ref_name: String,
+    head_ref_name: String,
+    head_ref_oid: String,
+    is_merge_queue_enabled: bool,
+    base_ref: BaseRef,
+}
+
+#[derive(Deserialize)]
+#[serde(rename_all = "camelCase")]
+struct BaseRef {
+    name: String,
+    #[serde(deserialize_with = "Option::deserialize")]
+    branch_protection_rule: Option<LinearHistory>,
+    #[serde(deserialize_with = "Option::deserialize")]
+    ref_update_rule: Option<LinearHistory>,
+    #[serde(deserialize_with = "Option::deserialize")]
+    rules: Option<Rules>,
+}
+
+#[derive(Deserialize, Eq, PartialEq)]
+#[serde(rename_all = "camelCase")]
+struct LinearHistory {
+    requires_linear_history: bool,
+}
+
+#[derive(Deserialize)]
+#[serde(rename_all = "camelCase")]
+struct Rules {
+    total_count: usize,
+    page_info: PageInfo,
+    nodes: Vec<Rule>,
+}
+
+#[derive(Deserialize)]
+#[serde(rename_all = "camelCase")]
+struct PageInfo {
+    has_next_page: bool,
+    #[serde(deserialize_with = "Option::deserialize")]
+    end_cursor: Option<String>,
+}
+
+#[derive(Deserialize)]
+struct Rule {
+    id: String,
+    #[serde(flatten)]
+    restriction: Restriction,
+}
+
+#[derive(Deserialize)]
+#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
+enum Restriction {
+    RequiredLinearHistory,
+    PullRequest {
+        parameters: PullRequestParameters,
+    },
+    #[serde(other)]
+    Other,
+}
+
+#[derive(Deserialize)]
+#[serde(rename_all = "camelCase")]
+struct PullRequestParameters {
+    #[serde(deserialize_with = "Option::deserialize")]
+    allowed_merge_methods: Option<Vec<String>>,
+}
+
+pub(super) fn query_arguments(
+    review: &GitHubReviewReceipt,
+) -> Result<Vec<String>, GitHubAuthorityError> {
+    super::review_query_arguments(review, MERGE_POLICY_QUERY)
+}
+
+pub(super) fn classify(
+    value: Value,
+    review: &GitHubReviewReceipt,
+) -> Result<MergeMethod, GitHubAuthorityError> {
+    let pages: Vec<QueryPage> = serde_json::from_value(value)
+        .map_err(|error| invalid(format!("invalid response: {error}")))?;
+    let first = validate_identity_and_policy(&pages, review)?;
+    if first.pull_request.is_merge_queue_enabled {
+        return Ok(MergeMethod::Queue);
+    }
+
+    let base = &first.pull_request.base_ref;
+    let linear = base
+        .branch_protection_rule
+        .as_ref()
+        .is_some_and(|rule| rule.requires_linear_history)
+        || base
+            .ref_update_rule
+            .as_ref()
+            .is_some_and(|rule| rule.requires_linear_history);
+    let mut allowed = [
+        first.merge_commit_allowed && !linear,
+        first.squash_merge_allowed,
+        first.rebase_merge_allowed,
+    ];
+    apply_rules(&pages, rules(first)?.total_count, &mut allowed)?;
+
+    // GitHub matches active rules, including organization rulesets. Every rule must allow
+    // the selected method; delivery does not infer or exercise actor bypass privileges.
+    allowed
+        .into_iter()
+        .zip([MergeMethod::Merge, MergeMethod::Squash, MergeMethod::Rebase])
+        .find_map(|(enabled, method)| enabled.then_some(method))
+        .ok_or_else(|| {
+            GitHubAuthorityError::api(
+                None,
+                "No merge method is allowed by both repository settings and base-branch protection/rulesets. \
+                 Enable a compati
```

**File**: `zeroshot/src/native_v2_delivery/github/merge_policy_tests.rs` (added, +348/-0)
```diff
@@ -0,0 +1,348 @@
+use openengine_cluster_testkit::assertions::{AssertError, AssertValue};
+use serde_json::json;
+
+use super::*;
+
+use super::super::unit::review;
+
+fn pages(rule_pages: Vec<Vec<Value>>) -> Value {
+    let total: usize = rule_pages.iter().map(Vec::len).sum();
+    let page_count = rule_pages.len();
+    let mut rule_id = 0;
+    Value::Array(
+        rule_pages
+            .into_iter()
+            .enumerate()
+            .map(|(index, mut nodes)| {
+                for node in &mut nodes {
+                    node["id"] = json!(format!("RULE_{rule_id}"));
+                    rule_id += 1;
+                }
+                json!({
+                    "data": {
+                        "repository": {
+                            "nameWithOwner": "acme/project",
+                            "mergeCommitAllowed": true,
+                            "squashMergeAllowed": true,
+                            "rebaseMergeAllowed": true,
+                            "pullRequest": {
+                                "id": "PR_node_17",
+                                "number": 17,
+                                "baseRefName": "main",
+                                "headRefName": "zeroshot/v2-run",
+                                "headRefOid": review().head_revision,
+                                "isMergeQueueEnabled": false,
+                                "baseRef": {
+                                    "name": "main",
+                                    "branchProtectionRule": null,
+                                    "refUpdateRule": null,
+                                    "rules": {
+                                        "totalCount": total,
+                                        "pageInfo": {
+                                            "hasNextPage": index + 1 < page_count,
+                                            "endCursor": format!("page_{index}"),
+                                        },
+                                        "nodes": nodes,
+                                    },
+                                },
+                            },
+                        },
+                    },
+                })
+            })
+            .collect(),
+    )
+}
+
+fn base_ref(page: &mut Value) -> &mut Value {
+    &mut page["data"]["repository"]["pullRequest"]["baseRef"]
+}
+
+fn method_rule(methods: Value) -> Value {
+    json!({"type": "PULL_REQUEST", "parameters": {"allowedMergeMethods": methods}})
+}
+
+fn assert_permanent(error: &GitHubAuthorityError) {
+    assert!(matches!(error, GitHubAuthorityError::Api(_)), "{error}");
+    assert!(!error.retryable_operation(), "{error}");
+}
+
+#[test]
+fn merge_policy_has_one_complete_rules_paginator() {
+    let args = query_arguments(&review()).assert_value();
+    assert_eq!(&args[..3], ["graphql", "--paginate", "--slurp"]);
+    let query = &args[4];
+    assert!(query.contains("query MergePolicy"));
+    assert!(query.contains("rules(first: 100, after: $endCursor)"));
+    assert_eq!(query.matches("pageInfo").count(), 1);
+    assert!(query.contains("branchProtectionRule { requiresLinearHistory }"));
+    assert!(query.contains("refUpdateRule { requiresLinearHistory }"));
+    assert!(query.contains("allowedMergeMethods"));
+}
+
+#[test]
+fn every_repository_method_combination_respects_all_linear_history_sources() {
+    for mask in 0..8 {
+        for source in ["none", "classic", "viewer", "ruleset"] {
+            let mut input = pages(vec![if source == "ruleset" {
+                vec![json!({"type": "REQUIRED_LINEAR_HISTORY"})]
+            } else {
+                vec![]
+            }]);
+            let repository = &mut input[0]["data"]["repository"];
+            repository["mergeCommitAllowed"] = json!(mask & 1 != 0);
+            repository["squashMergeAllowed"] = json!(mask & 2 != 0);
+            repository["rebaseMergeAllowed"] = json!(mask & 4 != 0);
+            if source == "classic" || source == "viewer" {
+                let field = if source == "classic" {
+                    "branchProtectionRule"
+                } else {
+                    "refUpdateRule"
+                };
+                base_ref(&mut input[0])[field] = json!({"requiresLinearHistory": true});
+            }
+            let expected = [
+                (mask & 1 != 0 && source == "none", MergeMethod::Merge),
+                (mask & 2 != 0, MergeMethod::Squash),
+                (mask & 4 != 0, MergeMethod::Rebase),
+            ]
+            .into_iter()
+            .find_map(|(enabled, method)| enabled.then_some(method));
+            let result = classify(input, &review());
+            if let Some(expected) = expected {
+                assert_eq!(result.assert_value(), expected, "{mask} {source}");
+            } else {
+                assert_permanent(&result.assert_error());
+            }
+        }
+    }
+}
+
+#[test]
+fn paginates_more_than_one_hundred_rules_and_intersects_every
```

**File**: `zeroshot/src/native_v2_delivery/github/merge_tests.rs` (added, +288/-0)
```diff
@@ -0,0 +1,288 @@
+use super::*;
+
+fn base_ref(page: &mut Value) -> &mut Value {
+    page.pointer_mut("/data/repository/pullRequest/baseRef")
+        .assert_value()
+}
+
+fn set_rules(page: &mut Value, rules: Vec<Value>) {
+    let rules = rules
+        .into_iter()
+        .enumerate()
+        .map(|(index, mut rule)| {
+            rule["id"] = json!(format!("RULE_{index}"));
+            rule
+        })
+        .collect::<Vec<_>>();
+    base_ref(page)["rules"] = json!({
+        "totalCount": rules.len(),
+        "nodes": rules,
+        "pageInfo": {"hasNextPage": false, "endCursor": null},
+    });
+}
+
+fn method_rule(methods: Value) -> Value {
+    json!({"type": "PULL_REQUEST", "parameters": {"allowedMergeMethods": methods}})
+}
+
+fn assert_policy_error(error: &GitHubAuthorityError) {
+    assert!(matches!(error, GitHubAuthorityError::Api(_)), "{error}");
+    assert!(!error.retryable_operation(), "{error}");
+    assert!(!error.authentication_failed(), "{error}");
+}
+
+#[cfg(unix)]
+fn merge_authority(
+    root: &std::path::Path,
+    before: &Value,
+    after: &Value,
+    action: &str,
+) -> GhCliDeliveryAuthority {
+    let program = root.join("gh-merge-fixture");
+    write_executable(
+        &program,
+        format!(
+            "#!/bin/sh\ncase \"$2\" in\n\
+         graphql) if [ -f \"$HOME/merge-args\" ]; then printf '%s\\n' {}; else printf '%s\\n' {}; fi ;;\n\
+         merge) printf '%s\\n' \"$@\" >> \"$HOME/merge-args\"; {action} ;;\n\
+         *) exit 19 ;;\nesac\n",
+            shell_literal(&json!([after]).to_string()),
+            shell_literal(&json!([before]).to_string()),
+        ),
+    );
+    authority(program, root)
+}
+
+#[cfg(unix)]
+#[tokio::test]
+async fn merge_commands_use_the_selected_method_and_exact_head_without_bypass() {
+    for (method, flag) in [
+        ("MERGE", Some("--merge")),
+        ("SQUASH", Some("--squash")),
+        ("REBASE", Some("--rebase")),
+        ("QUEUE", None),
+    ] {
+        let root = tempfile::tempdir().assert_value();
+        let mut page = policy_page_with_merge_capabilities(true, true, true);
+        set_rules(&mut page, vec![method_rule(json!([method]))]);
+        page["data"]["repository"]["pullRequest"]["isMergeQueueEnabled"] = json!(method == "QUEUE");
+        let outcome = merge_authority(root.path(), &page, &page, "exit 0")
+            .request_merge(&review(), GitHubCredential("test-token"))
+            .await
+            .assert_value();
+        assert_eq!(outcome, GitHubMergeRequestOutcome::Accepted);
+        let args = std::fs::read_to_string(root.path().join("merge-args")).assert_value();
+        assert!(args.contains(&format!(
+            "--match-head-commit\n{}\n",
+            review().head_revision
+        )));
+        assert!(!args.contains("--admin"));
+        for possible in ["--merge", "--squash", "--rebase"] {
+            assert_eq!(
+                args.lines().any(|arg| arg == possible),
+                flag == Some(possible)
+            );
+        }
+    }
+}
+
+#[cfg(unix)]
+#[tokio::test]
+async fn unavailable_method_or_changed_head_never_invokes_merge() {
+    let unavailable = policy_page_with_merge_capabilities(false, false, false);
+    let mut changed = policy_page_with_merge_capabilities(true, true, true);
+    changed["data"]["repository"]["pullRequest"]["headRefOid"] =
+        json!("cccccccccccccccccccccccccccccccccccccccc");
+    for page in [unavailable, changed] {
+        let root = tempfile::tempdir().assert_value();
+        merge_authority(root.path(), &page, &page, "exit 0")
+            .request_merge(&review(), GitHubCredential("test-token"))
+            .await
+            .assert_error();
+        assert!(!root.path().join("merge-args").exists());
+    }
+}
+
+#[cfg(unix)]
+#[tokio::test]
+async fn merge_submission_rechecks_terminal_approval_queue_and_freshness_state() {
+    let mut queued = policy_page_with_merge_capabilities(false, false, false);
+    queued["data"]["repository"]["pullRequest"]["isMergeQueueEnabled"] = json!(true);
+    queued["data"]["repository"]["pullRequest"]["isInMergeQueue"] = json!(true);
+    let mut merged = queued.clone();
+    set_review_state(&mut merged, "MERGED", true);
+    merged["data"]["repository"]["pullRequest"]["mergeCommit"] =
+        json!({"oid": "cccccccccccccccccccccccccccccccccccccccc"});
+    base_ref(&mut merged)["rules"] = Value::Null;
+    let mut review_required = policy_page_with_merge_capabilities(false, false, false);
+    review_required["data"]["repository"]["pullRequest"]["mergeStateStatus"] = json!("BLOCKED");
+    review_required["data"]["repository"]["pullRequest"]["reviewDecision"] =
+        json!("REVIEW_REQUIRED");
+    base_ref(&mut review_required)["refUpdateRule"]["requiredApprovingReviewCount"] = json!(1);
+    base_ref(&mut review_required)["rules"] = Value::Null;
+    let mut behind = policy_page("MERGEABLE", "BEHIND", None, (false, None));
+    base_ref(&mut behind)["r
```

---

### Incident Patch 7: `58ab8cc0` (2026-09-26)
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

### Incident Patch 8: `75ae54b6` (2026-09-26)
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

Co-authored-by: Michael Eichelbeck <[REDACTED_EMAIL]>

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

### Incident Patch 9: `3a36ba8c` (2026-09-26)
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

Co-authored-by: Michael Eichelbeck <[REDACTED_EMAIL]>

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

### Incident Patch 10: `affaa569` (2026-09-25)
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
+            .assert_value()
+            .assert_value(),
+        token_usage(1, 2, Some(1), Some(3))
+    );
+
+    let mut second_handle = start(&runtime, &admitted, 2, &values).await;
+    let mut second_output = second_handle.take_initial_output().assert_value();
+    assert!(matches!(
+        second_handle.completion().await.assert_value().outcome,
+        WorkerOutcome::Verified { output, .. } if output == json!({"answer":43})
+    ));
+    assert_eq!(
+        second_output
+            .recv_usage()
+            .await
+            .assert_value()
+            .assert_value(),
+        token_usage(2, 3, Some(1), Some(1))
+    );
+}
+
+#[tokio::test]
+async fn execution_session_normalizes_usage_for_correction_resume() {
+    let directory = TestDirectory::new("codex-correction-usage");
+    let (admitted, runtime) = openai_scripted_runtime(
+        &directory,
+        OpenAiScript {
+            scope: SessionScope::Execution,
+            environment: &["CORRECT_OUTPUT", "OPENAI_API_KEY"],

```

**File**: `zeroshot/src/native_v2_codex/tests/process_start.rs` (modified, +10/-7)
```diff
@@ -165,13 +165,16 @@ printf '%s%s\n' \
     assert_actionable_retry(&error, &logs);
     assert!(logs.contains("Codex output contained conflicting thread IDs"));
     assert_eq!(usages.len(), 2);
-    for usage in usages {
-        let usage = usage.assert_value();
-        assert_eq!(usage.input_tokens.get(), 43);
-        assert_eq!(usage.output_tokens.get(), 19);
-        assert_eq!(usage.cache_read_input_tokens.assert_value().get(), 13);
-        assert_eq!(usage.cache_creation_input_tokens.assert_value().get(), 5);
-    }
+    let first = usages.first().copied().flatten().assert_value();
+    assert_eq!(first.input_tokens.get(), 43);
+    assert_eq!(first.output_tokens.get(), 19);
+    assert_eq!(first.cache_read_input_tokens.assert_value().get(), 13);
+    assert_eq!(first.cache_creation_input_tokens.assert_value().get(), 5);
+    let second = usages.get(1).copied().flatten().assert_value();
+    assert_eq!(second.input_tokens.get(), 0);
+    assert_eq!(second.output_tokens.get(), 0);
+    assert_eq!(second.cache_read_input_tokens.assert_value().get(), 0);
+    assert_eq!(second.cache_creation_input_tokens.assert_value().get(), 0);
 }
 
 #[tokio::test]
```

**File**: `zeroshot/src/native_v2_codex/tests/retry.rs` (modified, +67/-0)
```diff
@@ -168,6 +168,73 @@ async fn terminal_failure_usage_is_recorded_before_the_retry() {
     ));
 }
 
+#[tokio::test]
+async fn new_thread_without_usage_drops_the_previous_attempt_baseline() {
+    const SCRIPT: &str = r#"#!/bin/sh
+set -eu
+/usr/bin/cat >/dev/null
+resumed=false
+for argument in "$@"; do
+  if [ "$argument" = resume ]; then resumed=true; fi
+done
+if [ ! -e "$STATE_PATH" ]; then
+  : > "$STATE_PATH"
+  printf '%s%s\n' \
+    '{"type":"turn.failed","usage":{"input_tokens":13,"output_tokens":5},' \
+    '"error":{"message":"failed without a resumable thread ID"}}'
+  exit 1
+fi
+printf '%s\n' '{"type":"thread.started","thread_id":"new-thread"}'
+printf '%s%s\n' \
+  '{"type":"item.completed","item":{"type":"agent_message",' \
+  '"text":"{\"response\":{\"answer\":42}}"}}'
+if [ "$resumed" = true ]; then
+  printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":20,"output_tokens":8}}'
+else
+  printf '%s\n' '{"type":"turn.completed"}'
+fi
+"#;
+    let directory = TestDirectory::new("codex-new-thread-usage");
+    let state = directory.child("state");
+    let (admitted, runtime) = openai_scripted_runtime(
+        &directory,
+        OpenAiScript {
+            scope: SessionScope::NodeInstance,
+            environment: &["OPENAI_API_KEY", "STATE_PATH"],
+            name: "new-thread-usage",
+            body: SCRIPT,
+        },
+    )
+    .await;
+    let values = [
+        ("OPENAI_API_KEY", "fake-openai-key".to_owned()),
+        ("STATE_PATH", state.display().to_string()),
+    ];
+    let mut first = start(&runtime, &admitted, 1, &values).await;
+    let mut first_output = first.take_initial_output().assert_value();
+    assert!(matches!(
+        first.completion().await.assert_value().outcome,
+        WorkerOutcome::Verified { .. }
+    ));
+    assert_eq!(
+        first_output.recv_usage().await.assert_value(),
+        Some(token_usage(13, 5, None, None))
+    );
+    assert_eq!(first_output.recv_usage().await.assert_value(), None);
+
+    let mut second = start(&runtime, &admitted, 2, &values).await;
+    let mut second_output = second.take_initial_output().assert_value();
+    assert!(matches!(
+        second.completion().await.assert_value().outcome,
+        WorkerOutcome::Verified { .. }
+    ));
+    assert_eq!(
+        second_output.recv_usage().await.assert_value(),
+        Some(token_usage(20, 8, None, None)),
+        "a new thread's cumulative usage must not subtract the failed attempt's usage"
+    );
+}
+
 #[tokio::test]
 async fn no_session_retries_the_original_prompt_once() {
     let directory = TestDirectory::new("codex-provider-retry-no-session");
```

---

### Incident Patch 11: `f6217ebc` (2026-09-25)
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

**File**: `zeroshot/src/native_v2_checkpoints/filesystem/tests.rs` (modified, +6/-2)
```diff
@@ -505,7 +505,9 @@ fn nested_self_contained_repository_restores_inside_a_non_git_workspace() {
     let nested = fixture.workspace.join("vendor/library");
     initialize_git(&nested);
     fs::write(nested.join("ignored-artifact"), "artifact").assert_value();
-    let id = capture(&fixture.workspace, &fixture.snapshots, &()).assert_value();
+    let captured = capture(&fixture.workspace, &fixture.snapshots, &());
+    assert!(captured.is_ok(), "nested Git capture failed: {captured:?}");
+    let id = captured.assert_value();
     fs::write(nested.join("tracked"), "later").assert_value();
     git(&nested, &["commit", "-am", "later"]);
     restore(&fixture.snapshots, &id, &fixture.workspace).assert_value();
@@ -580,7 +582,9 @@ fn recursive_submodules_restore_as_self_contained_repositories_with_valid_status
 fn stale_private_git_locks_are_captured_and_replaced_without_blocking_repair() {
     let fixture = Fixture::new();
     fixture.initialize_git();
-    let clean = capture(&fixture.workspace, &fixture.snapshots, &()).assert_value();
+    let clean = capture(&fixture.workspace, &fixture.snapshots, &());
+    assert!(clean.is_ok(), "initial clean capture failed: {clean:?}");
+    let clean = clean.assert_value();
     let administrative = fixture.workspace.join(".git");
     for name in [
         "HEAD.lock",
```

**File**: `zeroshot/src/native_v2_checkpoints/restic/tests.rs` (modified, +3/-6)
```diff
@@ -3,9 +3,6 @@ use tokio::io::AsyncWriteExt;
 
 use super::*;
 
-#[cfg(unix)]
-use std::os::unix::fs::PermissionsExt;
-
 #[cfg(unix)]
 const DISCOVERY_PROBE_MODE: &str = "ZEROSHOT_RESTIC_TEST_DISCOVERY";
 #[cfg(unix)]
@@ -14,12 +11,12 @@ const DISCOVERY_PROBE_SENTINEL: &str = "zeroshot-restic-discovery-probe-ran";
 #[cfg(unix)]
 fn failing_restic(root: &Path) -> PathBuf {
     let executable = root.join("restic");
-    std::fs::write(
+    openengine_cluster_testkit::fixture::write_executable(
         &executable,
         "#!/bin/sh\nprintf '%s' 'private child diagnostic' >&2\nexit 19\n",
+        0o700,
     )
-    .assert_value();
-    std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o700)).assert_value();
+    .assert_value_with("write failing Restic fixture");
     executable
 }
 
```

**File**: `zeroshot/src/native_v2_cli/update/tests.rs` (modified, +8/-9)
```diff
@@ -543,31 +543,30 @@ fn assert_update_process_boundaries_fail_before_replacement() {
 
     #[cfg(unix)]
     {
-        use std::os::unix::fs::PermissionsExt as _;
-
+        let write_executable = |path: &Path, contents: &[u8]| {
+            openengine_cluster_testkit::fixture::write_executable(path, contents, 0o755)
+                .assert_value()
+        };
         let directory = tempfile::tempdir().assert_value();
         let candidate = directory.path().join("zeroshot");
-        fs::write(&candidate, b"#!/bin/sh\nprintf 'zeroshot 8.2.1\\n'\n").assert_value();
-        fs::set_permissions(&candidate, fs::Permissions::from_mode(0o755)).assert_value();
+        write_executable(&candidate, b"#!/bin/sh\nprintf 'zeroshot 8.2.1\\n'\n");
         smoke(&candidate, version).assert_value();
         assert!(smoke(&candidate, ReleaseVersion([8, 2, 2])).is_err());
         let missing = directory.path().join("missing");
         assert!(make_executable(&missing).is_err());
         assert!(smoke(&missing, version).is_err());
 
         let restic = directory.path().join("restic");
-        fs::write(
+        write_executable(
             &restic,
             b"#!/bin/sh\nprintf 'restic 0.19.1 compiled with go1.25\\n'\n",
-        )
-        .assert_value();
-        fs::set_permissions(&restic, fs::Permissions::from_mode(0o755)).assert_value();
+        );
         smoke_restic(&restic).assert_value();
         for invalid in [
             b"#!/bin/sh\nprintf 'restic 0.19.0 compiled with go1.25\\n'\n".as_slice(),
             b"#!/bin/sh\nexit 1\n".as_slice(),
         ] {
-            fs::write(&restic, invalid).assert_value();
+            write_executable(&restic, invalid);
             assert!(smoke_restic(&restic).is_err());
         }
         assert!(smoke_restic(&missing).is_err());
```

---

### Incident Patch 12: `9690e0fe` (2026-09-23)
**Commit Message**: feat(ui): read history from configured targets (#1152)

## Summary

- let one local Zeroshot UI read canonical run history from a configured
direct or hosted target
- expose one target-neutral history contract with shared validation and
response bounds for targets, Cloud, and the UI BFF
- keep hosted refresh rotation authority-owned across browser
cancellation and strip unbounded accumulated snapshots while accepting
legacy archives

## Testing

- cargo test --locked -p zeroshot --features ui
- cargo clippy --workspace --all-targets --all-features -- -D warnings
- cargo fmt --all -- --check
- npm --prefix ui test
- npm --prefix ui run build
- opcore-zero Verify and Sense gates
- local UI against a Docker target with a completed run

**File**: `AGENTS.md` (modified, +14/-4)
```diff
@@ -456,9 +456,14 @@ with `npm i -g @the-open-engine-company/zeroshot` or build `zeroshot` with Cargo
   Cargo's optional `ui` feature.
   Releases and target images embed it. Build, development, and feature checks: [ui/README.md](ui/README.md).
 - `zeroshot ui` serves local CLI profiles and ledgers at `http://127.0.0.1:4173/ui/` by default;
-  `--listen` accepts loopback only. Direct `target serve` mounts `/ui/` on its existing listener,
-  uses `--storage` for profiles/history, and initializes its single controller before UI reads.
-  Private/hosted targets reject this standalone mount. Opening the UI never starts a run.
+  `--listen` accepts loopback only. `zeroshot ui --target NAME` keeps profiles and authoring local
+  while its server discovers the target's `zeroshot.run-history/v1` bounded list/detail/page
+  routes; target coordinates and hosted credentials never enter the browser. The browser continues
+  to use only the local `/ui/api/runs` BFF. Hosted reads reuse the named target's OAuth authority
+  and refresh-token custody. Direct `target serve` mounts `/ui/` on its existing listener, uses
+  `--storage` for profiles/history, and advertises run history only with that UI mount. It
+  initializes its single controller before UI reads. Private/hosted targets reject this standalone
+  mount; their host may advertise the authenticated capability. Opening the UI never starts a run.
 - Browser access requires the configured public origin, exact Host, and valid Fetch-Site;
   forwarded headers cannot broaden authority. UI keepalive requests cannot reach target control
   endpoints. Keep JSON writes, request bounds, and connection-owned SSE readers/timers.
@@ -504,7 +509,12 @@ with `npm i -g @the-open-engine-company/zeroshot` or build `zeroshot` with Cargo
   `workspace`. Git delivery keeps its fixed contracts and explicit pull-request/merge modes. Model suggestions are non-authoritative;
   identifiers remain opaque. Missing harness/provider links to runtime settings. JSON stays lossless.
 - `native_v2_observability::history` owns admitted definitions, bounded native pages and canonical
-  control records without the `ui` feature. Observer clones share its bounded projection cache.
+  control records without the `ui` feature. Its exported semantic validators are the single host
+  boundary for definition identity/version, canonical contiguous cursors, page/control coherence,
+  and the reserved `runtime_failed`/`runtime_lost` failure metadata; UI and Cloud readers must reuse
+  them after wire decoding. Definitions contain bounded admission and terminal facts, never the
+  accumulated execution snapshot; readers accept that legacy field only to strip it. Observer clones
+  share its bounded projection cache.
   `profile_ui/runs.rs` supplies local filesystem/list/SSE adapters; observation never creates, repairs
   or recovers a ledger or controller. Preserve ordered execution cursors, explicit gaps and string
   u64 IDs. SSE resumes after `Last-Event-ID` and drains through the terminal cursor before closing.
```

**File**: `README.md` (modified, +3/-1)
```diff
@@ -108,7 +108,9 @@ zeroshot run \
 
 Run `zeroshot ui` to edit profiles and inspect live or completed runs in your browser.
 Open `http://127.0.0.1:4173/ui/`. It shares the CLI's saved profiles and history;
-Ctrl-C stops the UI server while runs continue. See [UI setup](docs/getting-started/install.md#open-the-workspace-ui).
+Ctrl-C stops the UI server while runs continue. Pass `--target NAME` to read history from a
+configured direct or hosted target while keeping profiles local. See
+[UI setup](docs/getting-started/install.md#open-the-workspace-ui).
 
 Experimental: expose a saved local profile as an ACP agent. Each prompt runs the graph as a
 durable local run while the ACP session keeps the workspace and node sessions alive:
```

**File**: `crates/openengine-cluster-protocol/src/native_v2_target.rs` (modified, +56/-0)
```diff
@@ -30,6 +30,7 @@ pub const TARGET_OPERATOR_DIAGNOSTICS_PATH_PREFIX: &str = "/native-v2/operator-d
 pub const TARGET_DISCOVERY_KIND: &str = "zeroshot.native-v2-target/v2";
 pub const TARGET_CONTROLLER_AUDIENCE: &str = "controller";
 pub const HOSTED_RUNS_KIND: &str = "zeroshot.hosted-runs/v1";
+pub const RUN_HISTORY_KIND: &str = "zeroshot.run-history/v1";
 pub const CONNECTIONS_KIND: &str = "zeroshot.connections/v1";
 pub const STATIC_CONNECTION_KIND: &str = "static";
 /// A GitHub App installation whose repository-scoped token is minted by the hosted target.
@@ -374,6 +375,24 @@ pub struct TargetHostedRunsDiscovery {
     pub route_templates: TargetHostedRunRoutes,
 }
 
+/// Read-only routes for the bounded native run-history projection.
+#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
+#[serde(deny_unknown_fields, rename_all = "camelCase")]
+pub struct TargetRunHistoryRoutes {
+    pub list: String,
+    pub detail: String,
+    pub page: String,
+}
+
+/// One same-origin native run-history capability advertised by a target host.
+#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
+#[serde(deny_unknown_fields, rename_all = "camelCase")]
+pub struct TargetRunHistoryDiscovery {
+    pub kind: String,
+    pub base_url: String,
+    pub route_templates: TargetRunHistoryRoutes,
+}
+
 #[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
 #[serde(deny_unknown_fields)]
 pub struct TargetConnectionRoutes {
@@ -407,6 +426,8 @@ pub struct TargetDiscoveryExtensions {
     #[serde(skip_serializing_if = "Option::is_none")]
     pub hosted_runs: Option<TargetHostedRunsDiscovery>,
     #[serde(skip_serializing_if = "Option::is_none")]
+    pub run_history: Option<TargetRunHistoryDiscovery>,
+    #[serde(skip_serializing_if = "Option::is_none")]
     pub merge_plans: Option<crate::TargetMergePlansDiscovery>,
     #[serde(skip_serializing_if = "Option::is_none")]
     pub connections: Option<TargetConnectionsDiscovery>,
@@ -440,6 +461,7 @@ impl TargetDiscoveryExtensions {
     #[must_use]
     pub const fn is_empty(&self) -> bool {
         self.hosted_runs.is_none()
+            && self.run_history.is_none()
             && self.merge_plans.is_none()
             && self.connections.is_none()
             && self.run_profiles.is_none()
@@ -478,6 +500,13 @@ impl TargetDiscoveryDocument {
         }
         self
     }
+
+    /// Adds a read-only run-history extension to a target that mounted those routes.
+    #[must_use]
+    pub fn with_run_history(mut self, capability: TargetRunHistoryDiscovery) -> Self {
+        self.extensions.run_history = Some(capability);
+        self
+    }
 }
 
 /// Validates the canonical lower-case UUIDv7 spelling required at the target HTTP boundary.
@@ -543,6 +572,33 @@ mod tests {
         );
     }
 
+    #[test]
+    fn run_history_discovery_uses_the_versioned_camel_case_wire_shape() {
+        let document = TargetDiscoveryDocument::direct(TargetAuthentication::None)
+            .with_run_history(TargetRunHistoryDiscovery {
+                kind: RUN_HISTORY_KIND.to_owned(),
+                base_url: "http://127.0.0.1:8080".to_owned(),
+                route_templates: TargetRunHistoryRoutes {
+                    list: "/native-v2/run-history{?after}".to_owned(),
+                    detail: "/native-v2/run-history/{run_id}".to_owned(),
+                    page: "/native-v2/run-history/{run_id}/page{?after}".to_owned(),
+                },
+            });
+        let value = serde_json::to_value(document).assert_value();
+        assert_eq!(
+            value["extensions"]["run_history"],
+            serde_json::json!({
+                "kind": "zeroshot.run-history/v1",
+                "baseUrl": "http://127.0.0.1:8080",
+                "routeTemplates": {
+                    "list": "/native-v2/run-history{?after}",
+                    "detail": "/native-v2/run-history/{run_id}",
+                    "page": "/native-v2/run-history/{run_id}/page{?after}"
+                }
+            })
+        );
+    }
+
     #[test]
     fn uuid_v7_validation_is_canonical_and_versioned() {
         assert!(is_canonical_uuid_v7(&RunId::new(
```

**File**: `docs/getting-started/install.md` (modified, +10/-2)
```diff
@@ -60,9 +60,17 @@ Open `http://127.0.0.1:4173/ui/` to edit profiles and inspect live or completed
 Use `--listen 127.0.0.1:4185` to choose another loopback port. Ctrl-C stops the UI server;
 active runs continue. Restart the command to reconnect.
 
+To inspect runs on a configured target while keeping profiles in the local CLI store:
+
+```console
+zeroshot ui --target docker
+```
+
+Use `--target cloud` after signing in to inspect Cloud runs through the same local UI.
+
 **Profiles** edits graphs and runtime settings; the info icon explains authoring defaults.
-Saved profiles share the CLI's configuration store (`ZEROSHOT_CONFIG_DIR`); run history uses
-`ZEROSHOT_STATE_DIR`. Start a saved local profile from the CLI:
+Saved profiles share the CLI's configuration store (`ZEROSHOT_CONFIG_DIR`); without `--target`,
+run history uses `ZEROSHOT_STATE_DIR`. Start a saved local profile from the CLI:
 
 ```console
 zeroshot run --title "My task" --profile local:my-profile --input input.json
```

**File**: `docs/zeroshot-cli.html` (modified, +4/-1)
```diff
@@ -115,7 +115,7 @@ <h1>zeroshot CLI reference</h1>
 <section id="zeroshot-ui"><h3><code>zeroshot ui</code></h3>
 <pre><code>Serve the local profile editor and live or recorded run history.
 
-Open the printed /ui/ URL. Uses the CLI&#39;s saved profiles and local run history. Ctrl-C stops the UI server; active runs continue.
+Open the printed /ui/ URL. Profiles always use the CLI&#39;s local store. Run history uses the local controller unless --target selects a configured target. Ctrl-C stops the UI server; active runs continue.
 
 Usage: zeroshot ui [OPTIONS]
 
@@ -125,6 +125,9 @@ <h1>zeroshot CLI reference</h1>
 
           [default: 127.0.0.1:4173]
 
+      --target &lt;NAME&gt;
+          Read run history from this configured target. Profiles remain local
+
   -h, --help
           Print help (see a summary with &#39;-h&#39;)</code></pre></section>
 <section id="zeroshot-target"><h3><code>zeroshot target</code></h3>
```

**File**: `docs/zeroshot-cli.md` (modified, +4/-1)
```diff
@@ -64,7 +64,7 @@ Options:
 ```text
 Serve the local profile editor and live or recorded run history.
 
-Open the printed /ui/ URL. Uses the CLI's saved profiles and local run history. Ctrl-C stops the UI server; active runs continue.
+Open the printed /ui/ URL. Profiles always use the CLI's local store. Run history uses the local controller unless --target selects a configured target. Ctrl-C stops the UI server; active runs continue.
 
 Usage: zeroshot ui [OPTIONS]
 
@@ -74,6 +74,9 @@ Options:
 
           [default: 127.0.0.1:4173]
 
+      --target <NAME>
+          Read run history from this configured target. Profiles remain local
+
   -h, --help
           Print help (see a summary with '-h')
 ```
```

**File**: `ui/README.md` (modified, +8/-1)
```diff
@@ -15,11 +15,15 @@ cargo run -p zeroshot --features ui -- ui
 ```
 
 Open `http://127.0.0.1:4173/ui/`; use `--listen 127.0.0.1:PORT` for another loopback port.
+Run this loopback server only on a trusted single-user host. It is not an isolation boundary from
+other OS users or local processes.
 The optional Cargo `ui` feature embeds `ui/dist`. Release binaries and target images enable it;
 Node is needed only at build time. Rebuild the frontend before Rust after UI edits.
 
 Local profiles share the CLI store (`ZEROSHOT_CONFIG_DIR`); ledgers use `ZEROSHOT_STATE_DIR`.
-Use temporary absolute directories for isolated tests. Ctrl-C stops the UI while detached runs continue.
+Pass `--target NAME` to keep those profiles local while reading history from a configured direct or
+hosted target. Hosted credentials stay in the local UI server and never enter the browser. Use
+temporary absolute directories for isolated tests. Ctrl-C stops the UI while detached runs continue.
 Direct `target serve` mounts `/ui/` on its existing listener, stores profiles/history under
 `--storage`, and requires the browser's exact `--public-origin`. Private/hosted targets exclude
 this mount. See the [target image guide](../docker/zeroshot-target/README.md) for persistence and restart behavior.
@@ -54,6 +58,9 @@ history retained. Observation never starts or recovers a controller.
 
 The history endpoints are `GET /ui/api/runs`, `GET /ui/api/runs/{id}`,
 `GET /ui/api/runs/{id}/history?after=CURSOR`, and `GET /ui/api/runs/{id}/events?after=CURSOR`.
+These are the local browser BFF routes. A selected target is read server-side through its discovered
+`zeroshot.run-history/v1` list/detail/page templates; target URLs and authorization are not browser
+contracts.
 Omit `after` to begin. SSE resumes from `Last-Event-ID` and closes after the terminal cursor drains.
 
 ## Cloud integration
```

**File**: `ui/src/history-contract.ts` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ export function readRuntimeFailure(value: unknown, head: unknown): RuntimeFailur
   const failure = value as Partial<RuntimeFailure> | null;
   try {
     if (
-      failure?.reason !== 'runtime_failed' ||
+      (failure?.reason !== 'runtime_failed' && failure?.reason !== 'runtime_lost') ||
       historyCursorSequence(failure.atCursor) > historyCursorSequence(head)
     )
       throw invalidRuntimeFailure();
```

---

### Incident Patch 13: `9e9ffae0` (2026-09-22)
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

Co-authored-by: Michael Eichelbeck <[REDACTED_EMAIL]>

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

### Incident Patch 14: `cac003c2` (2026-09-22)
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

Co-authored-by: Michael Eichelbeck <[REDACTED_EMAIL]>

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

### Incident Patch 15: `81bd58b3` (2026-09-22)
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

Co-authored-by: Michael Eichelbeck <[REDACTED_EMAIL]>

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
+      "resolved": "https://registry.npmjs.org/@csstools/css-calc/-/css-calc-3.4.0.tgz",
+      "integrity": "sha512-XQKj5B7QiZcHiegCOCAzcAOJdhGgWOHbbu62h5e5mkHnn8lWcfiJhllkqWmxu5zWR9jucPHuo1iTB56P033hcg==",
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
+      "license": "MIT",
+      "engines": {
+        "node": ">=20.19.0"
+      },
+      "peerDependencies": {
+        "@csstools/css-parser-algorithms": "^4.0.0",
+        "@csstools/css-tokenizer": "^4.0.0"
+      }
+    },
+    "node_modules/@csstools/css-color-parser": {
+      "version": "4.2.3",
+      "resolved": "https://registry.npmjs.org/@csstools/css-color-parser/-/css-color-parser-4.2.3.tgz",
+      "integrity": "sha512-y4LpL+lmpuyKDiEFq2PnZUVFdAjsoB/qQJod79yLNokXyW7jewi+/WJ69EfItj8A2unWtxXnGjw6LYXgXu5ZjA==",
+      "dev": true,
+      "funding": [
+        {
+          "type": "g
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
+  dom.window.document.head.append(styles);
+  const actGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
+  const actEnvironment = actGlobal.IS_REACT_ACT_ENVIRONMENT;
+  actGlobal.IS_REACT_ACT_ENVIRONMENT = true;
+  t.after(() => {
+    actGlobal.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
+    for (const name of browserGlobals) {
+      const descriptor = descriptors.get(name);
+      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
+      else Reflect.deleteProperty(globalThis, name);
+    }
+    dom.window.close();
+  });
+}
+
+async function flushEffects() {
+  await act(async () => {
+    await new Promise<void>((resolve) => setImmediate(resolve));
+  });
+}
+
+function installHistoryRetryTimers(t: TestContext) {
+  const originalSetTimeout = globalThis.setTimeout;
+  const originalClearTimeout = globalThis.clearTimeout;
+  const retryTimers = new Map<ReturnType<typeof setTimeout>, () => void>();
+  let timerId = 0;
+  globalThis.setTimeout = ((
+    call
```

**File**: `ui/src/RunHistoryView.tsx` (modified, +38/-6)
```diff
@@ -40,6 +40,7 @@ import {
   type RunDetail,
 } from './run-history';
 import { canFollowHistory, observationEnded } from './history-contract';
+import { readHistoryWhenReady } from './history-readiness';
 import './run-history.css';
 
 const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
@@ -82,6 +83,7 @@ export function RunHistoryView({
   const [positions, setPositions] = useState<Positions>({}),
     [focus, setFocus] = useState<{ name: string; tick: number }>();
   const [loading, setLoading] = useState(false),
+    [historyPending, setHistoryPending] = useState(false),
     [error, setError] = useState('');
   const loadGeneration = useRef(0),
     loadAbort = useRef<AbortController | undefined>(undefined);
@@ -128,6 +130,7 @@ export function RunHistoryView({
     const controller = new AbortController();
     loadAbort.current = controller;
     setLoading(true);
+    setHistoryPending(false);
     setPlaying(false);
     setPlaybackNode(undefined);
     setError('');
@@ -148,8 +151,18 @@ export function RunHistoryView({
       pageCursor.current = 'v2:0';
     }
     try {
-      const detail = await dataSource.detail(id, controller.signal);
+      const pending = () => {
+        if (!controller.signal.aborted && generation === loadGeneration.current)
+          setHistoryPending(true);
+      };
+      const detail = await readHistoryWhenReady(
+        () => dataSource.detail(id, controller.signal),
+        controller.signal,
+        dataSource.retryDelay,
+        pending
+      );
       if (controller.signal.aborted || generation !== loadGeneration.current) return;
+      setHistoryPending(false);
       setRun(detail);
       if (reset) {
         setSelected(detail.graph.root.name);
@@ -161,8 +174,14 @@ export function RunHistoryView({
         bytes = 0,
         complete = false;
       while (!complete && count < 5000 && bytes < 8 * 1024 * 1024) {
-        const page = await dataSource.page(id, pageCursor.current, controller.signal);
+        const page = await readHistoryWhenReady(
+          () => dataSource.page(id, pageCursor.current, controller.signal),
+          controller.signal,
+          dataSource.retryDelay,
+          pending
+        );
         if (controller.signal.aborted || generation !== loadGeneration.current) return;
+        setHistoryPending(false);
         if (!page.complete && (!page.events.length || page.nextCursor === pageCursor.current))
           throw new Error('History stopped advancing. Reload to try again.');
         collected = appendHistory(collected, page);
@@ -179,8 +198,10 @@ export function RunHistoryView({
         if (page.complete && page.finished) finishRun(id, collected, page);
       }
     } catch (error) {
-      if (!controller.signal.aborted && generation === loadGeneration.current)
+      if (!controller.signal.aborted && generation === loadGeneration.current) {
+        setHistoryPending(false);
         setError(message(error));
+      }
     } finally {
       if (!controller.signal.aborted && generation === loadGeneration.current) setLoading(false);
     }
@@ -196,6 +217,7 @@ export function RunHistoryView({
       setControlError('');
       setPlaying(false);
       setLoading(false);
+      setHistoryPending(false);
       setError('');
     }
     return () => {
@@ -743,7 +765,11 @@ export function RunHistoryView({
                 <ChevronsRight size={18} />
               </button>
             </div>
-            {loading ? (
+            {historyPending ? (
+              <div className="history-load-state" role="status">
+                <Loader2 size={13} className="spin" /> Run history is still setting up
+              </div>
+            ) : loading ? (
               <div className="history-load-state">
                 <Loader2 size={13} className="spin" /> Loading history · {events.length} events
               </div>
@@ -761,8 +787,14 @@ export function RunHistoryView({
           </footer>
         </>
       ) : (
-        <div className="history-empty">
-          {loading ? (
+        <div className="history-empty" role={historyPending ? 'status' : undefined}>
+          {historyPending ? (
+            <>
+              <Loader2 size={23} className="spin" />
+              <h1>Run view is still setting up</h1>
+              <p>The graph will appear here automatically when it’s ready.</p>
+            </>
+          ) : loading ? (
             <>
               <Loader2 size={23} className="spin" />
               <h1>Loading run</h1>
```

**File**: `ui/src/history-readiness.test.ts` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { readHistoryWhenReady, waitForHistoryRetry } from './history-readiness';
+
+const pending = new Error('The source is not ready.');
+const RETRY_MS = 37;
+const retryDelay = (error: unknown) => (error === pending ? RETRY_MS : undefined);
+
+test('pending history retries sequentially until the read succeeds', async () => {
+  const controller = new AbortController();
+  const delays: number[] = [];
+  let reads = 0,
+    active = 0,
+    maximumActive = 0,
+    pendingSignals = 0;
+  const value = await readHistoryWhenReady(
+    async () => {
+      reads++;
+      active++;
+      maximumActive = Math.max(maximumActive, active);
+      try {
+        if (reads < 3) throw pending;
+        return 'ready';
+      } finally {
+        active--;
+      }
+    },
+    controller.signal,
+    retryDelay,
+    () => pendingSignals++,
+    async (signal, delayMs) => {
+      assert.equal(signal.aborted, false);
+      delays.push(delayMs);
+    }
+  );
+  assert.equal(value, 'ready');
+  assert.equal(reads, 3);
+  assert.equal(maximumActive, 1);
+  assert.equal(pendingSignals, 2);
+  assert.deepEqual(delays, [RETRY_MS, RETRY_MS]);
+});
+
+test('non-pending history errors are returned without polling', async () => {
+  const expected = new Error('The source rejected the read.');
+  let waits = 0;
+  await assert.rejects(
+    readHistoryWhenReady(
+      async () => {
+        throw expected;
+      },
+      new AbortController().signal,
+      retryDelay,
+      undefined,
+      async () => {
+        waits++;
+      }
+    ),
+    (error) => error === expected
+  );
+  assert.equal(waits, 0);
+});
+
+test('aborting a pending read clears its retry and prevents another request', async () => {
+  const controller = new AbortController();
+  let reads = 0,
+    announce!: () => void;
+  const announced = new Promise<void>((resolve) => {
+    announce = resolve;
+  });
+  const reading = readHistoryWhenReady(
+    async () => {
+      reads++;
+      throw pending;
+    },
+    controller.signal,
+    retryDelay,
+    announce,
+    waitForHistoryRetry
+  );
+  await announced;
+  controller.abort();
+  await assert.rejects(reading, { name: 'AbortError' });
+  await new Promise((resolve) => setTimeout(resolve, 20));
+  assert.equal(reads, 1);
+});
```

**File**: `ui/src/history-readiness.ts` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+export type HistoryRetryDelay = (error: unknown) => number | undefined;
+export type HistoryRetryWait = (signal: AbortSignal, delayMs: number) => Promise<void>;
+
+function abortError(signal: AbortSignal): Error {
+  return signal.reason instanceof Error
+    ? signal.reason
+    : new DOMException('The operation was aborted.', 'AbortError');
+}
+
+export function waitForHistoryRetry(signal: AbortSignal, delayMs: number): Promise<void> {
+  if (signal.aborted) return Promise.reject(abortError(signal));
+  return new Promise((resolve, reject) => {
+    const finish = () => {
+      signal.removeEventListener('abort', abort);
+      resolve();
+    };
+    const abort = () => {
+      clearTimeout(timer);
+      signal.removeEventListener('abort', abort);
+      reject(abortError(signal));
+    };
+    const timer = setTimeout(finish, delayMs);
+    signal.addEventListener('abort', abort, { once: true });
+  });
+}
+
+export async function readHistoryWhenReady<T>(
+  read: () => Promise<T>,
+  signal: AbortSignal,
+  retryDelay: HistoryRetryDelay | undefined,
+  onRetry: () => void = () => {},
+  wait: HistoryRetryWait = waitForHistoryRetry
+): Promise<T> {
+  while (!signal.aborted) {
+    try {
+      const value = await read();
+      if (signal.aborted) throw abortError(signal);
+      return value;
+    } catch (error) {
+      if (signal.aborted) throw abortError(signal);
+      const delayMs = retryDelay?.(error);
+      if (delayMs === undefined) throw error;
+      onRetry();
+      await wait(signal, delayMs);
+    }
+  }
+  throw abortError(signal);
+}
```

#### Recent Merged Pull Requests:
- **PR #1196** (2026-10-06): fix(release): recover immutable README summaries (@mkceichelbeck)
- **PR #1195** (2026-10-06): fix(claude): preserve local USER for macOS Keychain login (@mkceichelbeck)
- **PR #1192** (2026-10-05): docs: label the custom topology as an example (@EivMeyer)
- **PR #1191** (2026-10-05): docs: say Zeroshot runs the user's existing coding agent (@EivMeyer)
- **PR #1190** (2026-10-05): docs: show per-step models and mark the custom topology as an example (@EivMeyer)
- **PR #1188** (2026-10-05): docs: add RuntimePlan reference and review-loop guide (@EivMeyer)
- **PR #1187** (2026-10-05): docs: link the Zeroshot Cloud docs and stop pointing at dev (@EivMeyer)
- **PR #1186** (2026-10-05): docs: link zeroshot.sh from the README, npm package, and docs site (@EivMeyer)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
