# Forensic Learning Record (Deep Inspection): modelcontextprotocol/rust-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-rust-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/rust-sdk](https://github.com/modelcontextprotocol/rust-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:01:45.316Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/rust-sdk`
- **Description**: The official Rust SDK for the Model Context Protocol
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3979 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/rmcp/src/model/request_state.rs`
```
//! Integrity protection for SEP-2322 `requestState`.
//!
//! In the multi round-trip request (MRTR) flow, a server places an opaque
//! `requestState` string in an [`InputRequiredResult`](super::InputRequiredResult)
//! and the client echoes it back verbatim on retry. From the server's point of
//! view the echoed value is **untrusted, attacker-controlled input**: a client
//! can send back anything it likes. Per SEP-2322, a server that lets
//! `requestState` influence authorization, resource access, or business logic
//! MUST protect its integrity and reject values that fail verification.
//!
//! [`RequestStateCodec`] provides an opt-in way to do this. It seals a payload
//! into an opaque string with an HMAC-SHA256 tag and opens it again, rejecting
//! any value that was forged or tampered with.
//!
//! To follow the spec's replay-prevention guidance without hand-rolling the
//! checks, the codec supports two bindings via [`SealOptions`]:
//!
//! * **Associated data** — arbitrary context (e.g. the authenticated principal
//!   plus a digest of the originating request) that is mixed into the tag but
//!   not stored in the token. [`open_with`](RequestStateCodec::open_with) only
//!   succeeds when the caller supplies the same context, so a value cannot be
//!   replayed by a different principal or against a different request. This is
//!   *fail-closed*: forgetting to pass the context makes verification fail.
//! * **TTL** — a relative expiry stamped into the token; opening a value past
//!   its expiry fails with [`RequestStateError::Expired`].
//!
//! Single-use/nonce enforcement (for one-time redemptions) still has to be done
//! server-side, as the spec notes.
//!
//! This helper is only about *integrity*, not *confidentiality*: the sealed
//! payload is signed, not encrypted, so it is base64url-readable by anyone. Do
//! not put secrets in it.
//!
//! Using the codec is entirely optional. A server that keeps its state
//! server-side, or that does not trust `requestState` for anything security
//! sensitive, can keep building the string by hand via
//! [`InputRequiredResult::from_request_state`](super::InputRequiredResult::from_request_state).
//!
//! # Examples
//!
//! ```
//! use rmcp::model::{RequestStateCodec, SealOptions};
//! # fn main() -> Result<(), rmcp::model::RequestStateError> {
//!
//! // Derive the key from a per-process secret; keep it out of client reach.
//! let codec = RequestStateCodec::try_new(b"a-32-byte-or-longer-secret-key!!!")?;
//!
//! // Bind the state to the caller and the originating request.
//! let context = b"user:alice|tools/call:weather";
//! let sealed = codec.seal_with(
//!     b"step=2",
//!     &SealOptions::new().associated_data(context),
//! );
//!
//! // On retry the client echoes `sealed` back untouched; the server re-derives
//! // the same context and opens it.
//! let opened = codec.open_with(&sealed, context)?;
//! assert_eq!(opened, b"step=2");
//!
//! // A different principal (different context) is rejected.
//! assert!(codec.open_with(&sealed, b"user:bob|tools/call:weather").is_err());
//! # Ok(())
//! # }
//! ```

use std::{
    collections::{HashMap, hash_map::Entry},
    time::Duration,
};

use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use hmac::{Hmac, KeyInit, Mac};
use serde::{Serialize, de::DeserializeOwned};
use sha2::Sha256;
use thiserror::Error;
use zeroize::Zeroizing;

type HmacSha256 = Hmac<Sha256>;

const VERSION_V1: &str = "rs1";

const VERSION_V2: &str = "rs2";

/// Domain-separation label mixed into the HMAC so a `requestState` tag can never
/// be confused with an HMAC computed for some other purpose using the same key.
const DOMAIN_V1: &[u8] = b"rmcp/mrtr/request-state/v1";

/// Domain-separation label for keyed request-state tags.
const DOMAIN_V2: &[u8] = b"rmcp/mrtr/request-state/v2";

/// Length of the big-endian expiry prefix (unix milliseconds) stored at the
/// front of every sealed body. `0` means "no expiry".
const EXPIRY_LEN: usize = 8;

const MAX_KID_LEN: usize = 255;

/// Maximum unpadded base64url length for [`MAX_KID_LEN`] bytes.
const MAX_ENCODED_KID_LEN: usize = 340;

/// Errors returned when constructing or configuring a
/// [`RequestStateCodec`], or when processing a sealed value.
#[derive(Debug, Error)]
#[non_exhaustive]
pub enum RequestStateError {
    /// The signing key is shorter than [`RequestStateCodec::MIN_KEY_LENGTH`].
    #[error(
        "request state signing key is too short: expected at least {minimum} bytes, got {actual}"
    )]
    KeyTooShort { minimum: usize, actual: usize },

    /// The value is not a well-formed sealed request state (wrong prefix or
    /// missing sections).
    #[error("request state is malformed or uses an unsupported format")]
    MalformedFormat,

    /// A section of the value was not valid base64url.
    #[error("request state is not valid base64url")]
    InvalidEncoding,

    /// The HMAC tag did not match; the value was forged, tampered with, or
    /// opened with the wrong associated data.
    #[error("request state failed integrity verification")]
    IntegrityCheckFailed,

    /// The value carried a TTL that has already elapsed.
    #[error("request state has expired")]
    Expired,

    /// The token names (or, for rs1, requires) a key this codec does not hold.
    #[error("request state was sealed with an unknown key")]
    UnknownKeyId,

    /// The decoded rs2 key id was empty, too long, or not valid UTF-8.
    #[error("request state contains an invalid key identifier")]
    InvalidKeyId,

    /// An invalid keyring configuration; the message is diagnostic only.
    #[error("invalid keyring configuration: {0}")]
    InvalidKeyring(&'static str),

    /// The sealed payload could not be serialized to JSON.
    #[error("failed to serialize request state payload: {0}")]
    Serialization(#[source] serde_json::Error),

    /// The opened payload could not be deserialized from JSON.
    #[error("failed to deserialize request state payload: {0}")]
    Deserialization(#[source] serde_json::Error),
}

/// Options controlling how a value is sealed by [`RequestStateCodec`].
///
/// Defaults to no associated data and no expiry, which is equivalent to the
/// bare [`seal`](RequestStateCodec::seal) / [`open`](RequestStateCodec::open)
/// methods.
#[derive(Clone, Copy, Debug, Default)]
pub struct SealOptions<'a> {
    associated_data: &'a [u8],
    ttl: Option<Duration>,
}

impl<'a> SealOptions<'a> {
    /// Creates empty options (no associated data, no expiry).
    pub fn new() -> Self {
        Self::default()
    }

    /// Binds the sealed value to `associated_data`. The same bytes must be
    /// supplied to [`open_with`](RequestStateCodec::open_with); the data is
    /// authenticated but not stored in the token.
    ///
    /// Use this to bind the state to the authenticated principal and/or the
    /// originating request (e.g. method name plus a digest of its parameters).
    pub fn associated_data(mut self, associated_data: &'a [u8]) -> Self {
        self.associated_data = associated_data;
        self
    }

    /// Sets a relative time-to-live after which opening the value fails with
    /// [`RequestStateError::Expired`].
    pub fn ttl(mut self, ttl: Duration) -> Self {
        self.ttl = Some(ttl);
        self
    }
}

/// A keyed codec for integrity-protected SEP-2322 `requestState` values.
///
/// [`new`](Self::new) preserves `rs1`; [`new_with_keyring`](Self::new_with_keyring)
/// emits `rs2`.
/// Use [`with_rs1_signing`](Self::with_rs1_signing) and
/// [`with_rs1_fallback`](Self::with_rs1_fallback) for rolling migrations.
///
/// Use [`try_new`](Self::try_new) and
/// [`new_with_keyring`](Self::new_with_keyring) to require at least
/// [`MIN_KEY_LENGTH`](Self::MIN_KEY_LENGTH) bytes of high-entropy key material.
/// Configure the same keys on every replica. Stored key material is zeroized
/// when the codec is dropped.
///
/// Values are authenticated, not encrypted; key ids and payloads remain
/// readable. Retain old keys until every value they signed has expired.
///
/// # Key rotation
///
/// Rotate in stages so every replica can open states emitted by its peers:
///
/// ```
/// # use rmcp::model::{RequestStateCodec, RequestStateError};
/// # fn main() -> Result<(), RequestStateError> {
/// let old_key = b"old-request-state-key-at-least-32b".as_slice();
/// let new_key = b"new-request-state-key-at-least-32b".as_slice();
/// let keys = [("old", old_key), ("new", new_key)];
///
/// // 1. Deploy both keys, but continue emitting rs1 with the old key.
/// let transitional = RequestStateCodec::new_with_keyring("new", keys)?
///     .with_rs1_signing("old")?;
///
/// // 2. Emit rs2 with the new key, while accepting in-flight rs1 values.
/// let promoted = RequestStateCodec::new_with_keyring("new", keys)?
///     .with_rs1_fallback("old")?;
///
/// let old_state = transitional.seal(b"old state");
/// assert_eq!(promoted.open(&old_state)?, b"old state");
/// let new_state = promoted.seal(b"new state");
/// assert_eq!(transitional.open(&new_state)?, b"new state");
///
/// // 3. After old values expire, remove the old key.
/// let retired = RequestStateCodec::new_with_keyring("new", [("new", new_key)])?;
/// assert_eq!(retired.open(&new_state)?, b"new state");
/// # Ok(())
/// # }
/// ```
#[derive(Clone)]
pub struct RequestStateCodec {
    keys: Keys,
}

#[derive(Clone)]
enum Keys {
    Single(Zeroizing<Vec<u8>>),
    Ring {
        keys: HashMap<String, Zeroizing<Vec<u8>>>,
        seal_mode: SealMode,
        rs1_fallbacks: Vec<String>,
    },
}

#[derive(Clone, Debug)]
enum SealMode {
    Rs1 { key_id: String },
    Rs2 { key_id: String },
}

impl std::fmt::Debug for RequestStateCodec {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Never leak signing or verification keys through Debug output.
        match &self.keys {
            Keys::Single(_) => f
                .debug_struct("RequestStateCodec")
       
```

### Core Architecture Module: `crates/rmcp/src/transport/worker.rs`
```
use std::{
    borrow::Cow,
    collections::HashMap,
    sync::{
        Arc, Mutex, PoisonError, Weak,
        atomic::{AtomicU64, Ordering},
    },
    time::Duration,
};

use tokio_util::sync::CancellationToken;
use tracing::{Instrument, Level};

use super::{IntoTransport, Transport};
use crate::{
    model::{CancelledNotification, JsonRpcMessage, RequestId},
    service::{RxJsonRpcMessage, ServiceRole, TxJsonRpcMessage},
};

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum WorkerQuitReason<E> {
    #[error("Join error {0}")]
    Join(#[from] tokio::task::JoinError),
    #[error("Transport fatal {error}, when {context}")]
    Fatal {
        error: E,
        context: Cow<'static, str>,
    },
    #[error("Transport cancelled")]
    Cancelled,
    #[error("Transport closed")]
    TransportClosed,
    #[error("Handler terminated")]
    HandlerTerminated,
    #[error("Worker idle timeout after {}ms", _0.as_millis())]
    IdleTimeout(Duration),
}

impl<E: std::error::Error + Send + 'static> WorkerQuitReason<E> {
    pub fn fatal(error: E, context: impl Into<Cow<'static, str>>) -> Self {
        Self::Fatal {
            error,
            context: context.into(),
        }
    }
    pub fn fatal_context(context: impl Into<Cow<'static, str>>) -> impl FnOnce(E) -> Self {
        |e| Self::Fatal {
            error: e,
            context: context.into(),
        }
    }
}

pub trait Worker: Sized + Send + 'static {
    type Error: std::error::Error + Send + Sync + 'static;
    type Role: ServiceRole;
    fn err_closed() -> Self::Error;
    fn err_join(e: tokio::task::JoinError) -> Self::Error;
    fn run(
        self,
        context: WorkerContext<Self>,
    ) -> impl Future<Output = Result<(), WorkerQuitReason<Self::Error>>> + Send;
    fn config(&self) -> WorkerConfig {
        WorkerConfig::default()
    }
    /// Return true to send this message through the separate control queue.
    ///
    /// Workers that opt in must read [`WorkerContext::control_from_handler_rx`]
    /// and preserve any required ordering with ordinary messages.
    fn is_control_message(_message: &TxJsonRpcMessage<Self::Role>) -> bool {
        false
    }
    /// Return true to register outgoing requests for cancellation before they enter a queue.
    ///
    /// Workers that opt in must honor [`WorkerSendRequest::cancellation_token`].
    fn supports_request_cancellation() -> bool {
        false
    }
}

type RequestCancellations = Arc<Mutex<HashMap<RequestId, Weak<RequestCancellationRegistration>>>>;

/// Keeps a request's cancellation token registered for a chosen lifetime.
pub(crate) struct RequestCancellationRegistration {
    id: RequestId,
    lifetime: CancellationToken,
    cancellation: CancellationToken,
    pending: RequestCancellations,
}

impl RequestCancellationRegistration {
    fn new(id: RequestId, token: CancellationToken, pending: RequestCancellations) -> Arc<Self> {
        let registration = Arc::new(Self {
            id: id.clone(),
            cancellation: token.child_token(),
            lifetime: token,
            pending,
        });
        registration
            .pending
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(id, Arc::downgrade(&registration));
        registration
    }

    /// Return the token kept alive by this registration.
    pub(crate) fn token(&self) -> CancellationToken {
        self.cancellation.clone()
    }

    /// Return the token cancelled when the request lifetime ends.
    pub(crate) fn lifetime_token(&self) -> CancellationToken {
        self.lifetime.clone()
    }
}

impl Drop for RequestCancellationRegistration {
    fn drop(&mut self) {
        self.lifetime.cancel();
        let mut pending = self.pending.lock().unwrap_or_else(PoisonError::into_inner);
        if pending
            .get(&self.id)
            .is_some_and(|current| std::ptr::eq(current.as_ptr(), self))
        {
            pending.remove(&self.id);
        }
    }
}

#[non_exhaustive]
pub struct WorkerSendRequest<W: Worker> {
    pub message: TxJsonRpcMessage<W::Role>,
    pub responder: tokio::sync::oneshot::Sender<Result<(), W::Error>>,
    cancellation: Option<Arc<RequestCancellationRegistration>>,
    control_generation: u64,
}

impl<W: Worker> WorkerSendRequest<W> {
    /// Return the token registered before this request entered the send queue.
    ///
    /// This is present only for requests sent to a worker that enables
    /// [`Worker::supports_request_cancellation`]. It is not sent over the wire.
    /// Keep this request alive while its work is active. Cloning the token does
    /// not keep its cancellation registration alive.
    pub fn cancellation_token(&self) -> Option<CancellationToken> {
        self.cancellation
            .as_deref()
            .map(RequestCancellationRegistration::token)
    }

    /// Keep the same cancellation registration alive after the send completes.
    #[cfg(feature = "transport-streamable-http-client")]
    pub(crate) fn cancellation_registration(&self) -> Option<Arc<RequestCancellationRegistration>> {
        self.cancellation.clone()
    }

    /// Return the local generation captured when [`Transport::send`] created its future.
    ///
    /// This happens before polling or queue admission. The value is not sent over
    /// the wire; the worker decides whether a message from an older generation is valid.
    /// It identifies the outbound send, not the session that started an inbound handler.
    pub fn control_generation(&self) -> u64 {
        self.control_generation
    }
}

pub struct WorkerTransport<W: Worker> {
    rx: tokio::sync::mpsc::Receiver<RxJsonRpcMessage<W::Role>>,
    send_service: tokio::sync::mpsc::Sender<WorkerSendRequest<W>>,
    control_send_service: tokio::sync::mpsc::Sender<WorkerSendRequest<W>>,
    request_cancellations: RequestCancellations,
    control_generation: Arc<AtomicU64>,
    join_handle: Option<tokio::task::JoinHandle<Result<(), WorkerQuitReason<W::Error>>>>,
    _drop_guard: tokio_util::sync::DropGuard,
    ct: CancellationToken,
}

#[non_exhaustive]
pub struct WorkerConfig {
    pub name: Option<String>,
    pub channel_buffer_capacity: usize,
}

impl Default for WorkerConfig {
    fn default() -> Self {
        Self {
            name: None,
            channel_buffer_capacity: 16,
        }
    }
}
#[non_exhaustive]
pub enum WorkerAdapter {}

impl<W: Worker> IntoTransport<W::Role, W::Error, WorkerAdapter> for W {
    fn into_transport(self) -> impl Transport<W::Role, Error = W::Error> + 'static {
        WorkerTransport::spawn(self)
    }
}

impl<W: Worker> WorkerTransport<W> {
    pub fn cancel_token(&self) -> CancellationToken {
        self.ct.clone()
    }
    pub fn spawn(worker: W) -> Self {
        Self::spawn_with_ct(worker, CancellationToken::new())
    }
    pub fn spawn_with_ct(worker: W, transport_task_ct: CancellationToken) -> Self {
        let config = worker.config();
        let worker_name = config.name;
        let (to_transport_tx, from_handler_rx) =
            tokio::sync::mpsc::channel::<WorkerSendRequest<W>>(config.channel_buffer_capacity);
        let (control_to_transport_tx, control_from_handler_rx) =
            tokio::sync::mpsc::channel::<WorkerSendRequest<W>>(config.channel_buffer_capacity);
        let (to_handler_tx, from_transport_rx) =
            tokio::sync::mpsc::channel::<RxJsonRpcMessage<W::Role>>(config.channel_buffer_capacity);
        let request_cancellations = RequestCancellations::default();
        let control_generation = Arc::new(AtomicU64::new(0));
        let context = WorkerContext {
            to_handler_tx,
            from_handler_rx,
            control_from_handler_rx,
            control_generation: control_generation.clone(),
            cancellation_token: transport_task_ct.clone(),
        };

        let join_handle = tokio::spawn(async move {
            worker
                .run(context)
                .instrument(tracing::span!(
                    Level::TRACE,
                    "transport_worker",
                    name = worker_name,
                ))
                .await
                .inspect_err(|e| match e {
                    WorkerQuitReason::Cancelled
                    | WorkerQuitReason::TransportClosed
                    | WorkerQuitReason::HandlerTerminated
                    | WorkerQuitReason::IdleTimeout(_) => {
                        tracing::debug!("worker quit with reason: {:?}", e);
                    }
                    WorkerQuitReason::Join(e) => {
                        tracing::error!("worker quit with join error: {:?}", e);
                    }
                    WorkerQuitReason::Fatal { error, context } => {
                        tracing::error!("worker quit with fatal: {error}, when {context}");
                    }
                })
                .inspect(|_| {
                    tracing::debug!("worker quit");
                })
        });
        Self {
            rx: from_transport_rx,
            send_service: to_transport_tx,
            control_send_service: control_to_transport_tx,
            request_cancellations,
            control_generation,
            join_handle: Some(join_handle),
            ct: transport_task_ct.clone(),
            _drop_guard: transport_task_ct.drop_guard(),
        }
    }

    fn cancel_request_from_notification(
        &self,
        notification: &<W::Role as ServiceRole>::Not,
    ) -> Option<Arc<RequestCancellationRegistration>> {
        let cancelled: CancelledNotification = notification.clone().try_into().ok()?;
        let id = cancelled.params.request_id.as_ref()?;
        let target = {
            let pending = self
                .request_cancellations
                .lock()
                .unwrap_or_else(PoisonError::into_inner);
            pending.get(id).and_then(Weak::upgrade)
        }?;
        // Signal cancellation even if the control queue is full.
       
```

### Core Architecture Module: `conformance/src/bin/client.rs`
```
#![expect(
    deprecated,
    reason = "The conformance suite still exercises deprecated sampling scenarios"
)]

use anyhow::Context;
use oauth2::{ClientSecret, RefreshToken};
use rmcp::{
    ClientHandler, ClientLifecycleMode, ClientServiceExt, ErrorData, RoleClient, ServiceExt,
    model::*,
    service::RequestContext,
    transport::{
        AuthClient, AuthorizationManager, StreamableHttpClientTransport,
        auth::{
            AuthorizationCallback, AuthorizationRequest, ClientCredentialsConfig,
            InMemoryCredentialStore, JwtSigningAlgorithm, OAuthState, default_oauth_http_client,
            enterprise::{EmaAuthorizationServer, EmaClientAuthentication, EmaExchangeRequest},
        },
        streamable_http_client::StreamableHttpClientTransportConfig,
    },
};
use serde_json::{Value, json};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// ─── Context parsed from MCP_CONFORMANCE_CONTEXT ────────────────────────────

#[derive(Debug, Default, serde::Deserialize)]
struct ConformanceToolCall {
    name: String,
    #[serde(default)]
    arguments: Option<serde_json::Map<String, Value>>,
}

#[derive(Debug, Default, serde::Deserialize)]
struct ConformanceContext {
    #[serde(default, alias = "toolCalls")]
    tool_calls: Vec<ConformanceToolCall>,
    #[serde(default)]
    client_id: Option<String>,
    #[serde(default)]
    client_secret: Option<String>,
    // client-credentials-jwt
    #[serde(default)]
    private_key_pem: Option<String>,
    #[serde(default)]
    signing_algorithm: Option<String>,
    // enterprise-managed-authorization-refresh-token
    #[serde(default)]
    idp_client_id: Option<String>,
    #[serde(default)]
    idp_client_secret: Option<String>,
    #[serde(default)]
    idp_refresh_token: Option<String>,
    #[serde(default)]
    idp_issuer: Option<String>,
    #[serde(default)]
    idp_token_endpoint: Option<String>,
}

fn load_context() -> ConformanceContext {
    std::env::var("MCP_CONFORMANCE_CONTEXT")
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

// ─── Client handlers ────────────────────────────────────────────────────────

/// A basic client handler that does nothing special
struct BasicClientHandler;
impl ClientHandler for BasicClientHandler {}

/// A client handler that handles elicitation requests by applying schema defaults.
struct ElicitationDefaultsClientHandler;

impl ClientHandler for ElicitationDefaultsClientHandler {
    fn get_info(&self) -> ClientConfig {
        let mut info = ClientConfig::default();
        info.capabilities.elicitation = Some(
            ElicitationCapability::new()
                .with_form(FormElicitationCapability::new().with_schema_validation(true)),
        );
        info
    }

    async fn create_elicitation(
        &self,
        request: ElicitRequestParams,
        _cx: RequestContext<RoleClient>,
    ) -> Result<ElicitResult, ErrorData> {
        let content = match &request {
            ElicitRequestParams::FormElicitationParams {
                requested_schema, ..
            } => {
                let mut defaults = serde_json::Map::new();
                for (name, prop) in &requested_schema.properties {
                    match prop {
                        PrimitiveSchemaDefinition::String(s) => {
                            if let Some(d) = &s.default {
                                defaults.insert(name.clone(), Value::String(d.clone()));
                            }
                        }
                        PrimitiveSchemaDefinition::Number(n) => {
                            if let Some(d) = n.default {
                                defaults.insert(name.clone(), json!(d));
                            }
                        }
                        PrimitiveSchemaDefinition::Integer(i) => {
                            if let Some(d) = i.default {
                                defaults.insert(name.clone(), json!(d));
                            }
                        }
                        PrimitiveSchemaDefinition::Boolean(b) => {
                            if let Some(d) = b.default {
                                defaults.insert(name.clone(), Value::Bool(d));
                            }
                        }
                        PrimitiveSchemaDefinition::Enum(e) => {
                            let val = match e {
                                EnumSchema::Single(SingleSelectEnumSchema::Untitled(u)) => {
                                    u.default.as_ref().map(|d| Value::String(d.clone()))
                                }
                                EnumSchema::Single(SingleSelectEnumSchema::Titled(t)) => {
                                    t.default.as_ref().map(|d| Value::String(d.clone()))
                                }
                                EnumSchema::Multi(MultiSelectEnumSchema::Untitled(u)) => {
                                    u.default.as_ref().map(|d| {
                                        Value::Array(
                                            d.iter().map(|s| Value::String(s.clone())).collect(),
                                        )
                                    })
                                }
                                EnumSchema::Multi(MultiSelectEnumSchema::Titled(t)) => {
                                    t.default.as_ref().map(|d| {
                                        Value::Array(
                                            d.iter().map(|s| Value::String(s.clone())).collect(),
                                        )
                                    })
                                }
                                EnumSchema::Legacy(_) => None,
                                _ => None,
                            };
                            if let Some(v) = val {
                                defaults.insert(name.clone(), v);
                            }
                        }
                        _ => {}
                    }
                }
                Some(Value::Object(defaults))
            }
            _ => Some(json!({})),
        };
        let mut result = ElicitResult::new(ElicitationAction::Accept);
        if let Some(c) = content {
            result = result.with_content(c);
        }
        Ok(result)
    }
}

/// A client handler that handles both sampling and elicitation
struct FullClientHandler;

impl ClientHandler for FullClientHandler {
    fn get_info(&self) -> ClientConfig {
        let mut info = ClientConfig::default();
        info.capabilities.elicitation = Some(
            ElicitationCapability::new()
                .with_form(FormElicitationCapability::new().with_schema_validation(true)),
        );
        info
    }

    async fn create_message(
        &self,
        params: CreateMessageRequestParams,
        _cx: RequestContext<RoleClient>,
    ) -> Result<CreateMessageResult, ErrorData> {
        let prompt_text = params
            .messages
            .first()
            .and_then(|m| m.content.first())
            .and_then(|c| c.as_text())
            .map(|t| t.text.clone())
            .unwrap_or_default();
        Ok(CreateMessageResult::new(
            SamplingMessage::new(
                Role::Assistant,
                SamplingMessageContentBlock::text(format!(
                    "This is a mock LLM response to: {}",
                    prompt_text
                )),
            ),
            "mock-model".into(),
        )
        .with_stop_reason("endTurn"))
    }

    async fn create_elicitation(
        &self,
        _request: ElicitRequestParams,
        _cx: RequestContext<RoleClient>,
    ) -> Result<ElicitResult, ErrorData> {
        Ok(ElicitResult::new(ElicitationAction::Accept)
            .with_content(json!({"username": "testuser", "email": "test@example.com"})))
    }
}

// ─── OAuth helpers ──────────────────────────────────────────────────────────

const CIMD_CLIENT_METADATA_URL: &str = "https://conformance-test.local/client-metadata.json";
const REDIRECT_URI: &str = "http://localhost:3000/callback";
const SCOPE_STEP_UP_INITIAL_SCOPES: &[&str] = &["mcp:basic"];
const SCOPE_STEP_UP_ESCALATED_SCOPES: &[&str] = &["mcp:basic", "mcp:write"];

/// Attempt the real connection unauthenticated and return the server's
/// `WWW-Authenticate` challenge from the 401 — the reactive discovery
/// trigger.
///
/// `None` (server accepted the unauthenticated connection, which is then
/// closed cleanly) is a legitimate outcome, not an error: the scope-step-up
/// and scope-retry-limit mocks allow unauthenticated `initialize` and only
/// enforce authorization on tool calls.
async fn initialize_challenge(
    server_url: &str,
    lifecycle: ClientLifecycleMode,
) -> anyhow::Result<Option<String>> {
    let transport = StreamableHttpClientTransport::from_uri(server_url);
    match BasicClientHandler
        .serve_with_lifecycle(transport, lifecycle)
        .await
    {
        Ok(client) => {
            client.cancel().await.ok();
            Ok(None)
        }
        Err(error) => match error.auth_challenge() {
            Some(challenge) => Ok(Some(challenge.to_string())),
            None => Err(error.into()),
        },
    }
}

fn with_optional_challenge(
    request: AuthorizationRequest,
    challenge: Option<String>,
) -> AuthorizationRequest {
    match challenge {
        Some(challenge) => request.with_challenge(challenge),
        None => request,
    }
}

/// Perform the headless OAuth authorization-code flow, reactively:
///
/// 1. Attempt the real connection; take the 401's WWW-Authenticate challenge
/// 2. Discover from the challenge, register (or use CIMD), get auth URL
/// 3. Fetch the auth URL with redirect:manual → extract code from Location header
/// 4. Exchange code for token
/// 5. Return an `AuthClient` wrapping `reqwest::Client`
async fn perform_oauth_flow(
    server_url: &str,
    _ctx: &Conforma
```

### Core Architecture Module: `conformance/src/bin/server.rs`
```
#![allow(deprecated)]
use std::{
    collections::{HashMap, HashSet},
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
};

use rmcp::{
    ErrorData, RoleServer, ServerHandler,
    model::*,
    service::{RequestContext, SubscriptionContext, SubscriptionSink},
    task_manager::{TaskExit, TaskManager, TaskOptions},
    transport::{
        StreamableHttpServerConfig, StreamableHttpService,
        streamable_http_server::session::local::LocalSessionManager,
    },
};
use serde_json::{Value, json};
use tokio::sync::Mutex;
use tracing_subscriber::EnvFilter;

// Small base64-encoded 1x1 red PNG
const TEST_IMAGE_DATA: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
// Small base64-encoded WAV (silence)
const TEST_AUDIO_DATA: &str = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
const CACHE_TTL_MS: u64 = 60_000;

/// Helper to convert a serde_json::Value (must be an object) into a JsonObject
fn json_object(v: Value) -> JsonObject {
    match v {
        Value::Object(map) => map,
        _ => panic!("Expected JSON object"),
    }
}

fn custom_header_tool() -> Tool {
    Tool::new(
        "test_custom_header",
        "Validates SEP-2243 custom parameter headers",
        json_object(json!({
            "type": "object",
            "properties": {
                "value": { "type": "string", "x-mcp-header": "Value" }
            },
            "required": ["value"]
        })),
    )
}

/// Signing key for SEP-2322 `requestState` sealing. A fixed key is fine for a
/// conformance harness; real servers must load a secret out of clients' reach.
const REQUEST_STATE_KEY: &[u8] = b"rust-sdk-conformance-request-state-key!!";
const _: () = assert!(
    REQUEST_STATE_KEY.len() >= RequestStateCodec::MIN_KEY_LENGTH,
    "REQUEST_STATE_KEY is shorter than RequestStateCodec::MIN_KEY_LENGTH",
);

#[derive(Clone)]
struct ConformanceServer {
    legacy_resource_subscriptions: Arc<Mutex<HashSet<String>>>,
    subscriptions: Arc<Mutex<HashMap<u64, SubscriptionSink>>>,
    next_subscription: Arc<AtomicU64>,
    log_level: Arc<Mutex<LoggingLevel>>,
    request_state_codec: RequestStateCodec,
    tasks: TaskManager,
}

impl ConformanceServer {
    fn new() -> Self {
        Self {
            legacy_resource_subscriptions: Arc::new(Mutex::new(HashSet::new())),
            subscriptions: Arc::new(Mutex::new(HashMap::new())),
            next_subscription: Arc::new(AtomicU64::new(0)),
            log_level: Arc::new(Mutex::new(LoggingLevel::Debug)),
            request_state_codec: RequestStateCodec::new_unchecked(REQUEST_STATE_KEY),
            tasks: TaskManager::new(),
        }
    }
}

// ─── SEP-2663 Tasks extension fixtures ──────────────────────────────────────

/// Fixture tools required by the Tasks extension conformance scenarios.
const TASK_FIXTURE_TOOLS: &[&str] = &[
    "greet",
    "slow_compute",
    "failing_job",
    "protocol_error_job",
    "confirm_delete",
    "multi_input",
    "test_tool_with_task",
];

/// Tools that are registered as task-supporting. `greet` is deliberately
/// sync-only.
const TASK_SUPPORTING_TOOLS: &[&str] = &[
    "slow_compute",
    "failing_job",
    "protocol_error_job",
    "confirm_delete",
    "multi_input",
    "test_tool_with_task",
];

/// Tools that cannot be serviced without returning a `CreateTaskResult`:
/// calling them from a client that did not declare the tasks extension is
/// rejected with -32021 before the tool body runs (SEP-2663 §Required
/// Capabilities). `failing_job` and `test_tool_with_task` are registered
/// this way for the required-task-error and MRTR-composition scenarios;
/// `confirm_delete` and `multi_input` must park on in-task elicitation, so
/// they have no synchronous fallback either.
const TASK_REQUIRED_TOOLS: &[&str] = &[
    "failing_job",
    "test_tool_with_task",
    "confirm_delete",
    "multi_input",
];

fn task_fixture_tool(name: &str) -> Tool {
    let (description, schema) = match name {
        "greet" => (
            "Sync-only greeting fixture (SEP-2663)",
            json!({
                "type": "object",
                "properties": { "name": { "type": "string" } },
                "required": ["name"]
            }),
        ),
        "slow_compute" => (
            "Task-supporting fixture: sleeps `seconds` then returns a result (SEP-2663)",
            json!({
                "type": "object",
                "properties": {
                    "seconds": { "type": "number" },
                    "label": { "type": "string" }
                }
            }),
        ),
        "failing_job" => (
            "Task-supporting fixture (task support: required): returns a tool execution error (SEP-2663)",
            json!({ "type": "object", "properties": {} }),
        ),
        "protocol_error_job" => (
            "Task-supporting fixture: fails with a protocol-level error (SEP-2663)",
            json!({ "type": "object", "properties": {} }),
        ),
        "confirm_delete" => (
            "Task-supporting fixture: parks on a single elicitation inputRequest (SEP-2663)",
            json!({
                "type": "object",
                "properties": { "filename": { "type": "string" } }
            }),
        ),
        "multi_input" => (
            "Task-supporting fixture: parks on two parallel elicitation inputRequests (SEP-2663)",
            json!({ "type": "object", "properties": {} }),
        ),
        "test_tool_with_task" => (
            "MRTR round 1 gathers user_name, round 2 escalates to a task (SEP-2663 composition)",
            json!({ "type": "object", "properties": {} }),
        ),
        other => panic!("unknown task fixture tool: {other}"),
    };
    Tool::new(name.to_string(), description, json_object(schema))
}

// ─── SEP-2322 MRTR (InputRequiredResult) helpers ────────────────────────────

fn mrtr_elicitation_request(message: &str, properties: Value, required: Value) -> InputRequest {
    InputRequest::Elicitation(ElicitRequest::new(
        ElicitRequestParams::FormElicitationParams {
            meta: None,
            message: message.into(),
            requested_schema: serde_json::from_value(json!({
                "type": "object",
                "properties": properties,
                "required": required,
            }))
            .expect("valid elicitation schema"),
        },
    ))
}

fn mrtr_sampling_request(prompt: &str) -> InputRequest {
    InputRequest::CreateMessage(CreateMessageRequest::new(CreateMessageRequestParams::new(
        vec![SamplingMessage::user_text(prompt)],
        100,
    )))
}

fn mrtr_list_roots_request() -> InputRequest {
    InputRequest::ListRoots(ListRootsRequest::default())
}

/// An input response is usable when it is a JSON object (an `ElicitResult`,
/// `CreateMessageResult`, or `ListRootsResult` shape). Anything else (e.g. a
/// bare number) is treated as missing so the server re-requests it.
fn mrtr_response<'a>(
    responses: Option<&'a InputResponses>,
    key: &str,
) -> Option<&'a serde_json::Map<String, Value>> {
    responses
        .and_then(|r| r.get(key))
        .and_then(Value::as_object)
}

impl ConformanceServer {
    fn mrtr_tampered_state_error() -> ErrorData {
        ErrorData::invalid_params("requestState failed integrity verification", None)
    }

    /// SEP-2663 task fixture tools. The server decides per request whether to
    /// materialize a task: task-supporting tools create one when the client
    /// declared the tasks extension capability; otherwise they fall through to
    /// synchronous execution (except task-*required* tools, which reject with
    /// -32021).
    async fn call_task_fixture_tool(
        &self,
        request: CallToolRequestParams,
        cx: &RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, ErrorData> {
        let client_supports_tasks = cx
            .client_capabilities()
            .is_some_and(|caps| caps.supports_tasks());
        let name = request.name.as_ref();
        let args = request.arguments.clone().unwrap_or_default();

        if TASK_REQUIRED_TOOLS.contains(&name) && !client_supports_tasks {
            // SEP-2663 §Required Capabilities: this tool cannot be serviced
            // without returning CreateTaskResult.
            return Err(ErrorData::missing_required_client_capability(
                ClientCapabilities::builder().enable_tasks().build(),
            ));
        }

        let create_task = client_supports_tasks && TASK_SUPPORTING_TOOLS.contains(&name);

        match name {
            "greet" => {
                let who = args.get("name").and_then(Value::as_str).unwrap_or("friend");
                Ok(
                    CallToolResult::success(vec![ContentBlock::text(format!("Hello, {who}!"))])
                        .into(),
                )
            }

            "slow_compute" => {
                let seconds = args.get("seconds").and_then(Value::as_f64).unwrap_or(1.0);
                let label = args
                    .get("label")
                    .and_then(Value::as_str)
                    .unwrap_or("compute")
                    .to_string();
                if create_task {
                    // The lifecycle scenario requires slow_compute to settle
                    // to `cancelled` when tasks/cancel arrives while running;
                    // cancellation is cooperative, so honor it explicitly.
                    let task = self.tasks.spawn(TaskOptions::default(), move |ctx| {
                        Box::pin(async move {
                            tokio::select! {
                                _ = ctx.cancelled() => Err(TaskExit::Cancelled),
                                _ = tokio::time::sleep(
                                    std::time::Duration::from_secs_f64(seconds),
                                ) => Ok(CallToolResult::success(vec![ContentBlock::text(
                                
```

### Core Architecture Module: `crates/rmcp-macros/src/common.rs`
```
//! Common utilities shared between different macro implementations

use quote::quote;
use syn::{Attribute, Expr, FnArg, ImplItem, ImplItemFn, ItemImpl, Signature, Type};

/// Parse a None expression
pub fn none_expr() -> syn::Result<Expr> {
    syn::parse2::<Expr>(quote! { None })
}

/// Extract documentation from doc attributes
pub fn extract_doc_line(
    existing_docs: Option<Expr>,
    attr: &Attribute,
) -> syn::Result<Option<Expr>> {
    if !attr.path().is_ident("doc") {
        return Ok(None);
    }

    let syn::Meta::NameValue(name_value) = &attr.meta else {
        return Ok(None);
    };

    let value = &name_value.value;
    let this_expr: Option<Expr> = match value {
        // Preserve macros such as `include_str!(...)`
        syn::Expr::Macro(_) => Some(value.clone()),
        syn::Expr::Lit(syn::ExprLit {
            lit: syn::Lit::Str(lit_str),
            ..
        }) => {
            let content = lit_str.value().trim().to_string();
            if content.is_empty() {
                return Ok(existing_docs);
            }
            Some(Expr::Lit(syn::ExprLit {
                attrs: Vec::new(),
                lit: syn::Lit::Str(syn::LitStr::new(&content, lit_str.span())),
            }))
        }
        _ => return Ok(None),
    };

    match (existing_docs, this_expr) {
        (Some(existing), Some(this)) => {
            syn::parse2::<Expr>(quote! { concat!(#existing, "\n", #this) }).map(Some)
        }
        (Some(existing), None) => Ok(Some(existing)),
        (None, Some(this)) => Ok(Some(this)),
        _ => Ok(None),
    }
}

/// Find Parameters<T> type in function signature
/// Returns the full Parameters<T> type if found
pub fn find_parameters_type_in_sig(sig: &Signature) -> Option<Box<Type>> {
    sig.inputs.iter().find_map(|input| {
        if let FnArg::Typed(pat_type) = input
            && let Type::Path(type_path) = &*pat_type.ty
            && type_path
                .path
                .segments
                .last()
                .is_some_and(|type_name| type_name.ident == "Parameters")
        {
            return Some(pat_type.ty.clone());
        }
        None
    })
}

/// Find Parameters<T> type in ImplItemFn
pub fn find_parameters_type_impl(fn_item: &ImplItemFn) -> Option<Box<Type>> {
    find_parameters_type_in_sig(&fn_item.sig)
}

/// Check whether an `impl` block already contains a method with the given name.
pub fn has_method(name: &str, item_impl: &ItemImpl) -> bool {
    item_impl.items.iter().any(|item| match item {
        ImplItem::Fn(func) => func.sig.ident == name,
        _ => false,
    })
}

/// Check whether an `impl` block carries a sibling handler attribute (e.g.
/// `#[prompt_handler]` visible from within `#[tool_handler]`).
///
/// Matches both bare (`prompt_handler`) and path-qualified (`rmcp::prompt_handler`) forms.
pub fn has_sibling_handler(item_impl: &ItemImpl, handler_name: &str) -> bool {
    item_impl.attrs.iter().any(|attr| {
        attr.path()
            .segments
            .last()
            .is_some_and(|seg| seg.ident == handler_name)
    })
}

```

### Core Architecture Module: `crates/rmcp-macros/src/lib.rs`
```
#![doc = include_str!("../README.md")]

#[allow(unused_imports)]
use proc_macro::TokenStream;

mod common;
mod prompt;
mod prompt_handler;
mod prompt_router;
mod tool;
mod tool_handler;
mod tool_router;
/// # tool
///
/// This macro is used to mark a function as a tool handler.
///
/// This will generate a function that return the attribute of this tool, with type `rmcp::model::Tool`.
///
/// ## Usage
///
/// | field             | type                       | usage |
/// | :-                | :-                         | :-    |
/// | `name`            | `String`                   | The name of the tool. If not provided, it defaults to the function name. |
/// | `description`     | `Expr`                     | A description of the tool. A string literal or an expression that evaluates to a `&'static str`. The document of this function will be used if not provided. |
/// | `input_schema`    | `Expr`                     | A JSON Schema object defining the expected parameters for the tool. If not provide, if will use the json schema of its argument with type `Parameters<T>` |
/// | `annotations`     | `ToolAnnotationsAttribute` | Additional tool information. Defaults to `None`. |
///
/// ## Example
///
/// ```rust,ignore
/// #[tool(name = "my_tool", description = "This is my tool", annotations(title = "我的工具", read_only_hint = true))]
/// pub async fn my_tool(param: Parameters<MyToolParam>) {
///     // handling tool request
/// }
/// ```
#[proc_macro_attribute]
pub fn tool(attr: TokenStream, input: TokenStream) -> TokenStream {
    tool::tool(attr.into(), input.into())
        .unwrap_or_else(|err| err.to_compile_error())
        .into()
}

/// # tool_router
///
/// This macro is used to generate a tool router based on functions marked with `#[rmcp::tool]` in an implementation block.
///
/// It creates a function that returns a `ToolRouter` instance.
///
/// The generated function is used by `#[tool_handler]` by default (via `Self::tool_router()`),
/// so in most cases you do not need to store the router in a field.
///
/// ## Usage
///
/// | field            | type          | usage |
/// | :-               | :-            | :-    |
/// | `router`         | `Ident`       | The name of the router function to be generated. Defaults to `tool_router`. |
/// | `vis`            | `Visibility`  | The visibility of the generated router function. Defaults to empty. |
/// | `server_handler` | `flag`        | When set, also emits `#[::rmcp::tool_handler]` on `impl ServerHandler for Self` so you can omit a separate `#[tool_handler]` block. |
/// | `allow_empty`    | `flag`        | When set, accepts an impl block with no `#[tool]` fn. Without it, an empty router is a compile error. |
///
/// ## Example
///
/// ```rust,ignore
/// #[tool_router]
/// impl MyToolHandler {
///     #[tool]
///     pub fn my_tool() {
///
///     }
/// }
///
/// // #[tool_handler] calls Self::tool_router() automatically
/// #[tool_handler]
/// impl ServerHandler for MyToolHandler {}
/// ```
///
/// ### Eliding `#[tool_handler]`
///
/// For a tools-only server, pass `server_handler` so the `impl ServerHandler` block is not written by hand:
///
/// ```rust,ignore
/// #[tool_router(server_handler)]
/// impl MyToolHandler {
///     #[tool]
///     fn my_tool() {}
/// }
/// ```
///
/// This expands in two steps: first `#[tool_router]` emits the inherent impl plus
/// `#[::rmcp::tool_handler] impl ServerHandler for MyToolHandler {}`, then `#[tool_handler]`
/// fills in `call_tool`, `list_tools`, `get_info`, and related methods. If you combine tools with
/// prompts or tasks on the **same** `impl ServerHandler` block (stacked `#[tool_handler]` /
/// `#[prompt_handler]` attributes), keep using an explicit `#[tool_handler]` impl instead of `server_handler`.
///
/// Or specify the visibility and router name, which would be helpful when you want to combine multiple routers into one:
///
/// ```rust,ignore
/// mod a {
///     #[tool_router(router = tool_router_a, vis = "pub")]
///     impl MyToolHandler {
///         #[tool]
///         fn my_tool_a() {
///
///         }
///     }
/// }
///
/// mod b {
///     #[tool_router(router = tool_router_b, vis = "pub")]
///     impl MyToolHandler {
///         #[tool]
///         fn my_tool_b() {
///
///         }
///     }
/// }
///
/// impl MyToolHandler {
///     fn new() -> Self {
///         Self {
///             tool_router: self::tool_router_a() + self::tool_router_b(),
///         }
///     }
/// }
/// ```
///
/// ### Empty routers
///
/// Collecting tools is this attribute's whole purpose, so an impl block with no `#[tool]` fn is a
/// compile error rather than a router that silently serves nothing. Pass `allow_empty` when that
/// is what you want:
///
/// ```rust,ignore
/// #[tool_router(allow_empty)]
/// impl MyToolHandler {}
/// ```
///
/// The usual way to hit this by accident is a `macro_rules!` helper *inside* the impl block. An
/// attribute macro receives the unexpanded item, so `#[tool]` fns produced by such a helper are
/// invisible to `#[tool_router]`. Let the `macro_rules!` emit the whole annotated impl instead:
///
/// ```rust,ignore
/// macro_rules! define_tools {
///     ($($name:ident => $description:literal),* $(,)?) => {
///         #[tool_router]
///         impl MyToolHandler {
///             $(
///                 #[tool(description = $description)]
///                 async fn $name(&self) -> String { stringify!($name).to_owned() }
///             )*
///         }
///     };
/// }
///
/// define_tools!(my_tool => "what my tool does");
/// ```
#[proc_macro_attribute]
pub fn tool_router(attr: TokenStream, input: TokenStream) -> TokenStream {
    tool_router::tool_router(attr.into(), input.into())
        .unwrap_or_else(|err| err.to_compile_error())
        .into()
}

/// # tool_handler
///
/// This macro generates the `call_tool`, `list_tools`, `get_tool`, and (optionally)
/// `get_info` methods for a `ServerHandler` implementation, using a `ToolRouter`.
///
/// ## Usage
///
/// | field          | type     | usage |
/// | :-             | :-       | :-    |
/// | `router`       | `Expr`   | The expression to access the `ToolRouter` instance. Defaults to `Self::tool_router()`. |
/// | `meta`         | `Expr`   | Optional metadata for `ListToolsResult`. |
/// | `name`         | `String` | Custom server name. Defaults to `CARGO_CRATE_NAME`. |
/// | `version`      | `String` | Custom server version. Defaults to `CARGO_PKG_VERSION`. |
/// | `instructions` | `String` | Optional human-readable instructions about using this server. |
///
/// ## Minimal example (no boilerplate)
///
/// The macro automatically generates `get_info()` with tools capability enabled
/// and reads the server name/version from `Cargo.toml`:
///
/// ```rust,ignore
/// struct TimeServer;
///
/// #[tool_router]
/// impl TimeServer {
///     #[tool(description = "Get current time")]
///     async fn get_time(&self) -> String { "12:00".into() }
/// }
///
/// #[tool_handler]
/// impl ServerHandler for TimeServer {}
/// ```
///
/// ## Custom server info
///
/// ```rust,ignore
/// #[tool_handler(name = "my-server", version = "1.0.0", instructions = "A helpful server")]
/// impl ServerHandler for MyToolHandler {}
/// ```
///
/// ## Custom router expression
///
/// ```rust,ignore
/// #[tool_handler(router = self.tool_router)]
/// impl ServerHandler for MyToolHandler {
///    // ...implement other handler
/// }
/// ```
///
/// ## Manual `get_info()`
///
/// If you provide your own `get_info()`, the macro will not generate one:
///
/// ```rust,ignore
/// #[tool_handler]
/// impl ServerHandler for MyToolHandler {
///     fn get_info(&self) -> ServerConfig {
///         ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
///     }
/// }
/// ```
#[proc_macro_attribute]
pub fn tool_handler(attr: TokenStream, input: TokenStream) -> TokenStream {
    tool_handler::tool_handler(attr.into(), input.into())
        .unwrap_or_else(|err| err.to_compile_error())
        .into()
}

/// # prompt
///
/// This macro is used to mark a function as a prompt handler.
///
/// This will generate a function that returns the attribute of this prompt, with type `rmcp::model::Prompt`.
///
/// ## Usage
///
/// | field             | type     | usage |
/// | :-                | :-       | :-    |
/// | `name`            | `String` | The name of the prompt. If not provided, it defaults to the function name. |
/// | `description`     | `Expr`   | A description of the prompt. A string literal or an expression that evaluates to a `&'static str`. The document of this function will be used if not provided. |
/// | `arguments`       | `Expr`   | An expression that evaluates to `Option<Vec<PromptArgument>>` defining the prompt's arguments. If not provided, it will automatically generate arguments from the `Parameters<T>` type found in the function signature. |
///
/// ## Example
///
/// ```rust,ignore
/// #[prompt(name = "code_review", description = "Reviews code for best practices")]
/// pub async fn code_review_prompt(&self, Parameters(args): Parameters<CodeReviewArgs>) -> Result<Vec<PromptMessage>> {
///     // Generate prompt messages based on arguments
/// }
/// ```
#[proc_macro_attribute]
pub fn prompt(attr: TokenStream, input: TokenStream) -> TokenStream {
    prompt::prompt(attr.into(), input.into())
        .unwrap_or_else(|err| err.to_compile_error())
        .into()
}

/// # prompt_router
///
/// This macro generates a prompt router based on functions marked with `#[rmcp::prompt]` in an implementation block.
///
/// It creates a function that returns a `PromptRouter` instance.
///
/// ## Usage
///
/// | field     | type          | usage |
/// | :-        | :-            | :-    |
/// | `router`  | `Ident`       | The name of the router function to be generated. Defaults to `prompt_router`. |
/// | `vis`     | `Visibility`  | The visibility of the generated router function. Defaults to empty. |
///
/// ## Example
///
/// ```rust,ignore

```

### Core Architecture Module: `crates/rmcp-macros/src/prompt.rs`
```
use darling::{FromMeta, ast::NestedMeta};
use proc_macro2::TokenStream;
use quote::{format_ident, quote};
use syn::{Expr, Ident, ImplItemFn, ReturnType};

use crate::common::{extract_doc_line, none_expr};

#[derive(FromMeta, Default, Debug)]
#[darling(default)]
pub struct PromptAttribute {
    /// The name of the prompt
    pub name: Option<String>,
    /// Human readable title of prompt
    pub title: Option<String>,
    /// Optional description of what the prompt does
    pub description: Option<darling::util::PreservedStrExpr>,
    /// Arguments that can be passed to the prompt
    pub arguments: Option<Expr>,
    /// Optional icons for the prompt
    pub icons: Option<Expr>,
    /// Optional metadata for the prompt
    pub meta: Option<Expr>,
    /// When true, the generated future will not require `Send`. Useful for `!Send` handlers
    /// (e.g. single-threaded database connections). Also enabled globally by the `local` crate feature.
    pub local: bool,
}

pub struct ResolvedPromptAttribute {
    pub name: String,
    pub title: Option<String>,
    pub description: Option<Expr>,
    pub arguments: Expr,
    pub icons: Option<Expr>,
    pub meta: Option<Expr>,
}

impl ResolvedPromptAttribute {
    pub fn into_fn(self, fn_ident: Ident) -> syn::Result<ImplItemFn> {
        let Self {
            name,
            description,
            arguments,
            title,
            icons,
            meta,
        } = self;
        let description = if let Some(description) = description {
            quote! { Some::<String>(#description.into()) }
        } else {
            quote! { None::<String> }
        };
        let title_call = title
            .map(|t| quote! { .with_title(#t) })
            .unwrap_or_default();
        let icons_call = icons
            .map(|i| quote! { .with_icons(#i) })
            .unwrap_or_default();
        let meta_call = meta.map(|m| quote! { .with_meta(#m) }).unwrap_or_default();
        let tokens = quote! {
            pub fn #fn_ident() -> rmcp::model::Prompt {
                rmcp::model::Prompt::from_raw(
                    #name,
                    #description,
                    #arguments,
                )
                #title_call
                #icons_call
                #meta_call
            }
        };
        syn::parse2::<ImplItemFn>(tokens)
    }
}

pub fn prompt(attr: TokenStream, input: TokenStream) -> syn::Result<TokenStream> {
    let attribute = if attr.is_empty() {
        Default::default()
    } else {
        let attr_args = NestedMeta::parse_meta_list(attr)?;
        PromptAttribute::from_list(&attr_args)?
    };
    let mut fn_item = syn::parse2::<ImplItemFn>(input.clone())?;
    let fn_ident = &fn_item.sig.ident;
    let omit_send = cfg!(feature = "local") || attribute.local;

    let prompt_attr_fn_ident = format_ident!("{}_prompt_attr", fn_ident);

    // Try to find prompt parameters from function parameters
    let arguments_expr = if let Some(arguments) = attribute.arguments {
        arguments
    } else {
        // Look for a type named Parameters in the function signature
        let params_ty = crate::common::find_parameters_type_impl(&fn_item);

        if let Some(params_ty) = params_ty {
            // Generate arguments from the type's schema with caching
            syn::parse2::<Expr>(quote! {
                rmcp::handler::server::prompt::cached_arguments_from_schema::<#params_ty>()
            })?
        } else {
            // No arguments
            none_expr()?
        }
    };

    let name = attribute.name.unwrap_or_else(|| fn_ident.to_string());
    let description = if let Some(description) = attribute.description {
        Some(description.into())
    } else {
        fn_item.attrs.iter().try_fold(None, extract_doc_line)?
    };
    let arguments = arguments_expr;

    let resolved_prompt_attr = ResolvedPromptAttribute {
        name: name.clone(),
        description: description.clone(),
        arguments: arguments.clone(),
        title: attribute.title,
        icons: attribute.icons,
        meta: attribute.meta,
    };
    let prompt_attr_fn = resolved_prompt_attr.into_fn(prompt_attr_fn_ident.clone())?;

    // Modify the input function for async support (same as tool macro)
    if fn_item.sig.asyncness.is_some() {
        // 1. remove asyncness from sig
        // 2. make return type: `std::pin::Pin<Box<dyn std::future::Future<Output = #ReturnType> + Send + '_>>`
        //    (omit `+ Send` when the `local` crate feature is active or `#[prompt(local)]` is used)
        // 3. make body: { Box::pin(async move { #body }) }
        let new_output = syn::parse2::<ReturnType>({
            let mut lt = quote! { 'static };
            if let Some(receiver) = fn_item.sig.receiver()
                && let syn::ReceiverKind::Reference(_, receiver_lt, _) = &receiver.kind
            {
                if let Some(receiver_lt) = receiver_lt {
                    lt = quote! { #receiver_lt };
                } else {
                    lt = quote! { '_ };
                }
            }
            match &fn_item.sig.output {
                syn::ReturnType::Default => {
                    if omit_send {
                        quote! { -> ::std::pin::Pin<Box<dyn ::std::future::Future<Output = ()> + #lt>> }
                    } else {
                        quote! { -> ::std::pin::Pin<Box<dyn ::std::future::Future<Output = ()> + Send + #lt>> }
                    }
                }
                syn::ReturnType::Type(_, ty) => {
                    if omit_send {
                        quote! { -> ::std::pin::Pin<Box<dyn ::std::future::Future<Output = #ty> + #lt>> }
                    } else {
                        quote! { -> ::std::pin::Pin<Box<dyn ::std::future::Future<Output = #ty> + Send + #lt>> }
                    }
                }
            }
        })?;
        let prev_block = &fn_item.block;
        let new_block = syn::parse2::<syn::Block>(quote! {
           { Box::pin(async move #prev_block ) }
        })?;
        fn_item.sig.asyncness = None;
        fn_item.sig.output = new_output;
        fn_item.block = new_block;
    }

    Ok(quote! {
        #prompt_attr_fn
        #fn_item
    })
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_prompt_macro() -> syn::Result<()> {
        let attr = quote! {
            name = "example-prompt",
            description = "An example prompt"
        };
        let input = quote! {
            async fn example_prompt(&self, Parameters(args): Parameters<ExampleArgs>) -> Result<String> {
                Ok("Example prompt response".to_string())
            }
        };
        let result = prompt(attr, input)?;

        // Verify the output contains both the attribute function and the modified function
        let result_str = result.to_string();
        assert!(result_str.contains("example_prompt_prompt_attr"));
        assert!(
            result_str.contains("rmcp")
                && result_str.contains("model")
                && result_str.contains("Prompt")
        );

        Ok(())
    }

    #[test]
    fn test_doc_comment_description() -> syn::Result<()> {
        let attr = quote! {}; // No explicit description
        let input = quote! {
            /// This is a test prompt description
            /// with multiple lines
            fn test_prompt(&self) -> Result<String> {
                Ok("Test".to_string())
            }
        };
        let result = prompt(attr, input)?;

        // The output should contain the description from doc comments
        let result_str = result.to_string();
        assert!(result_str.contains("This is a test prompt description"));
        assert!(result_str.contains("with multiple lines"));

        Ok(())
    }

    #[test]
    fn test_doc_include_description() -> syn::Result<()> {
        let attr = quote! {}; // No explicit description
        let input = quote! {
            #[doc = include_str!("some/test/data/doc.txt")]
            fn test_prompt_included(&self) -> Result<String> {
                Ok("Test".to_string())
            }
        };
        let result = prompt(attr, input)?;

        // The generated tokens should preserve the include_str! invocation
        let result_str = result.to_string();
        assert!(result_str.contains("include_str"));

        Ok(())
    }

    #[test]
    fn test_async_prompt_default_send_behavior() -> syn::Result<()> {
        let attr = quote! {};
        let input = quote! {
            async fn test_prompt_default_send(&self) -> String {
                "ok".to_string()
            }
        };
        let result = prompt(attr, input)?;

        let result_str = result.to_string();
        if cfg!(feature = "local") {
            assert!(!result_str.contains("+ Send +"));
        } else {
            assert!(result_str.contains("+ Send +"));
        }
        Ok(())
    }

    #[test]
    fn test_async_prompt_preserves_receiver_lifetime() -> syn::Result<()> {
        let attr = quote! {};
        let input = quote! {
            async fn test_prompt_with_lifetime<'a>(&'a self) -> String {
                "ok".to_string()
            }
        };
        let result = prompt(attr, input)?;

        assert!(result.to_string().contains("+ 'a"));
        Ok(())
    }

    #[test]
    fn test_async_prompt_local_omits_send() -> syn::Result<()> {
        let attr = quote! { local };
        let input = quote! {
            async fn test_prompt_local_no_send(&self) -> String {
                "ok".to_string()
            }
        };
        let result = prompt(attr, input)?;

        let result_str = result.to_string();
        assert!(!result_str.contains("+ Send +"));
        Ok(())
    }
}

```

### Core Architecture Module: `crates/rmcp-macros/src/prompt_handler.rs`
```
use darling::FromMeta;
use proc_macro2::TokenStream;
use quote::quote;
use syn::{Expr, ImplItem, ItemImpl, parse_quote};

use crate::{
    common::{has_method, has_sibling_handler},
    tool_handler::{CallerCapability, build_get_info},
};

#[derive(FromMeta, Debug, Default)]
#[darling(default)]
pub struct PromptHandlerAttribute {
    pub router: Option<Expr>,
    pub meta: Option<Expr>,
}

pub fn prompt_handler(attr: TokenStream, input: TokenStream) -> syn::Result<TokenStream> {
    let attribute = if attr.is_empty() {
        Default::default()
    } else {
        let attr_args = darling::ast::NestedMeta::parse_meta_list(attr)?;
        PromptHandlerAttribute::from_list(&attr_args)?
    };

    let mut impl_block = syn::parse2::<ItemImpl>(input)?;

    let router_expr = attribute
        .router
        .unwrap_or_else(|| syn::parse2(quote! { Self::prompt_router() }).unwrap());

    // Add get_prompt implementation
    let get_prompt_impl: ImplItem = parse_quote! {
        async fn get_prompt(
            &self,
            request: rmcp::model::GetPromptRequestParams,
            context: rmcp::service::RequestContext<rmcp::RoleServer>,
        ) -> Result<rmcp::model::GetPromptResponse, rmcp::ErrorData> {
            let prompt_context = rmcp::handler::server::prompt::PromptContext::new(
                self,
                request.name,
                request.arguments,
                context,
            );
            #router_expr.get_prompt(prompt_context).await
        }
    };

    let meta = if let Some(meta) = attribute.meta {
        quote! { Some(#meta) }
    } else {
        quote! { None }
    };

    // Add list_prompts implementation
    let list_prompts_impl: ImplItem = parse_quote! {
        async fn list_prompts(
            &self,
            _request: Option<rmcp::model::PaginatedRequestParams>,
            context: rmcp::service::RequestContext<rmcp::RoleServer>,
        ) -> Result<rmcp::model::ListPromptsResult, rmcp::ErrorData> {
            let prompts = #router_expr.list_all();
            let supports_cache_hints = context.protocol_version().is_some_and(|version| {
                version >= rmcp::model::ProtocolVersion::V_2026_07_28
            });
            Ok(rmcp::model::ListPromptsResult {
                result_type: Some(rmcp::model::ResultType::COMPLETE),
                prompts,
                meta: #meta,
                next_cursor: None,
                ttl_ms: supports_cache_hints.then_some(0),
                cache_scope: supports_cache_hints
                    .then_some(rmcp::model::CacheScope::Public),
            })
        }
    };

    // Check if methods already exist and replace them if they do
    let mut has_get_prompt = false;
    let mut has_list_prompts = false;

    for item in &mut impl_block.items {
        if let ImplItem::Fn(fn_item) = item {
            match fn_item.sig.ident.to_string().as_str() {
                "get_prompt" => {
                    *item = get_prompt_impl.clone();
                    has_get_prompt = true;
                }
                "list_prompts" => {
                    *item = list_prompts_impl.clone();
                    has_list_prompts = true;
                }
                _ => {}
            }
        }
    }

    // Add methods if they don't exist
    if !has_get_prompt {
        impl_block.items.push(get_prompt_impl);
    }
    if !has_list_prompts {
        impl_block.items.push(list_prompts_impl);
    }

    // Auto-generate get_info() if not already provided
    if !has_method("get_info", &impl_block) {
        // Detect whether tool_handler is also present — if so, it will generate get_info
        // with both capabilities. Only generate here if tool_handler is NOT present.
        if !has_sibling_handler(&impl_block, "tool_handler") {
            let get_info_fn =
                build_get_info(&impl_block, None, None, None, CallerCapability::Prompts)?;
            impl_block.items.push(get_info_fn);
        }
    }

    Ok(quote! {
        #impl_block
    })
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_prompt_handler_macro() -> syn::Result<()> {
        let input = quote! {
            impl ServerHandler for MyPromptHandler {
                // Other handler methods...
            }
        };

        let result = prompt_handler(TokenStream::new(), input)?;
        let result_str = result.to_string();

        // Check that the required methods were generated
        assert!(result_str.contains("async fn get_prompt"));
        assert!(result_str.contains("PromptContext") && result_str.contains("new"));
        assert!(result_str.contains("async fn list_prompts"));
        assert!(result_str.contains("ListPromptsResult"));

        Ok(())
    }

    #[test]
    fn test_prompt_handler_with_custom_router() -> syn::Result<()> {
        let attr = quote! { router = self.get_prompt_router() };
        let input = quote! {
            impl ServerHandler for MyPromptHandler {
                // Other handler methods...
            }
        };

        let result = prompt_handler(attr, input)?;
        let result_str = result.to_string();

        // Check that the custom router expression is used
        assert!(
            result_str.contains("self")
                && result_str.contains("get_prompt_router")
                && result_str.contains("get_prompt")
        );
        assert!(
            result_str.contains("self")
                && result_str.contains("get_prompt_router")
                && result_str.contains("list_all")
        );

        Ok(())
    }
}

```

### Core Architecture Module: `crates/rmcp-macros/src/prompt_router.rs`
```
use darling::FromMeta;
use proc_macro2::TokenStream;
use quote::{format_ident, quote};
use syn::{ImplItem, ItemImpl, Visibility, parse_quote};

#[derive(FromMeta, Debug, Default)]
#[darling(default)]
pub struct PromptRouterAttribute {
    pub router: Option<String>,
    pub vis: Option<Visibility>,
}

pub fn prompt_router(attr: TokenStream, input: TokenStream) -> syn::Result<TokenStream> {
    let attribute = if attr.is_empty() {
        Default::default()
    } else {
        let attr_args = darling::ast::NestedMeta::parse_meta_list(attr)?;
        PromptRouterAttribute::from_list(&attr_args)?
    };

    let mut impl_block = syn::parse2::<ItemImpl>(input)?;
    let self_ty = &impl_block.self_ty;

    let router_fn_ident = attribute
        .router
        .map(|s| format_ident!("{}", s))
        .unwrap_or_else(|| format_ident!("prompt_router"));
    let vis = attribute.vis.unwrap_or(Visibility::Inherited);

    let mut prompt_route_fn_calls = Vec::new();

    for item in &mut impl_block.items {
        if let ImplItem::Fn(fn_item) = item {
            let has_prompt_attr = fn_item.attrs.iter().any(|attr| {
                attr.path()
                    .segments
                    .last()
                    .map(|seg| seg.ident == "prompt")
                    .unwrap_or(false)
            });

            if has_prompt_attr {
                let fn_ident = &fn_item.sig.ident;
                let attr_fn_ident = format_ident!("{}_prompt_attr", fn_ident);

                // Check what parameters the function takes
                let mut param_names = Vec::new();
                let mut param_types = Vec::new();

                for input in &fn_item.sig.inputs {
                    if let syn::FnArg::Typed(pat_type) = input {
                        // Extract parameter pattern and type
                        param_types.push(&*pat_type.ty);
                        param_names.push(&*pat_type.pat);
                    }
                }

                // Use the exact same pattern as tool_router
                prompt_route_fn_calls.push(quote! {
                    .with_route((Self::#attr_fn_ident(), Self::#fn_ident))
                });
            }
        }
    }

    let router_fn: ImplItem = parse_quote! {
        #vis fn #router_fn_ident() -> rmcp::handler::server::router::prompt::PromptRouter<#self_ty> {
            rmcp::handler::server::router::prompt::PromptRouter::new()
                #(#prompt_route_fn_calls)*
        }
    };

    impl_block.items.push(router_fn);

    Ok(quote! {
        #impl_block
    })
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_prompt_router_macro() -> syn::Result<()> {
        let input = quote! {
            impl MyPromptHandler {
                #[prompt]
                async fn greeting_prompt(&self) -> Result<Vec<PromptMessage>, Error> {
                    Ok(vec![])
                }

                #[prompt]
                async fn code_review_prompt(&self, Parameters(args): Parameters<CodeReviewArgs>) -> Result<Vec<PromptMessage>, Error> {
                    Ok(vec![])
                }
            }
        };

        let result = prompt_router(TokenStream::new(), input)?;
        let result_str = result.to_string();

        // Check that the prompt_router function was generated
        assert!(result_str.contains("fn prompt_router"));
        assert!(result_str.contains("PromptRouter :: new"));
        assert!(result_str.contains("greeting_prompt_prompt_attr"));
        assert!(result_str.contains("code_review_prompt_prompt_attr"));

        Ok(())
    }
}

```

### Core Architecture Module: `crates/rmcp-macros/src/tool.rs`
```
use darling::{FromMeta, ast::NestedMeta};
use proc_macro2::TokenStream;
use quote::{ToTokens, format_ident, quote};
use syn::{Expr, Ident, ImplItemFn, ReturnType, parse_quote};

use crate::common::extract_doc_line;

/// Check if a type is Json<T> and extract the inner type T
fn extract_json_inner_type(ty: &syn::Type) -> Option<&syn::Type> {
    if let syn::Type::Path(type_path) = ty
        && let Some(last_segment) = type_path.path.segments.last()
        && last_segment.ident == "Json"
        && let syn::PathArguments::AngleBracketed(args) = &last_segment.arguments
        && let Some(syn::GenericArgument::Type(inner_type)) = args.args.first()
    {
        return Some(inner_type);
    }
    None
}

/// Extract schema expression from a function's return type
/// Handles patterns like Json<T> and Result<Json<T>, E>
fn extract_schema_from_return_type(ret_type: &syn::Type) -> Option<Expr> {
    // First, try direct Json<T>
    if let Some(inner_type) = extract_json_inner_type(ret_type) {
        return syn::parse2::<Expr>(quote! {
            rmcp::handler::server::tool::schema_for_output::<#inner_type>()
        })
        .ok();
    }

    // Then, try Result<Json<T>, E>
    let type_path = match ret_type {
        syn::Type::Path(path) => path,
        _ => return None,
    };

    let last_segment = type_path.path.segments.last()?;

    if last_segment.ident != "Result" {
        return None;
    }

    let args = match &last_segment.arguments {
        syn::PathArguments::AngleBracketed(args) => args,
        _ => return None,
    };

    let ok_type = match args.args.first()? {
        syn::GenericArgument::Type(ty) => ty,
        _ => return None,
    };

    let inner_type = extract_json_inner_type(ok_type)?;

    syn::parse2::<Expr>(quote! {
        rmcp::handler::server::tool::schema_for_output::<#inner_type>()
    })
    .ok()
}
#[derive(FromMeta, Default, Debug)]
#[darling(default)]
pub struct ToolAttribute {
    /// The name of the tool
    pub name: Option<String>,
    /// Human readable title of tool
    pub title: Option<String>,
    pub description: Option<darling::util::PreservedStrExpr>,
    /// A JSON Schema object defining the expected parameters for the tool
    pub input_schema: Option<Expr>,
    /// An optional JSON Schema object defining the structure of the tool's output
    pub output_schema: Option<Expr>,
    /// Optional additional tool information.
    pub annotations: Option<ToolAnnotationsAttribute>,
    /// Optional icons for the tool
    pub icons: Option<Expr>,
    /// Optional metadata for the tool
    pub meta: Option<Expr>,
    /// When true, the generated future will not require `Send`. Useful for `!Send` handlers
    /// (e.g. single-threaded database connections). Also enabled globally by the `local` crate feature.
    pub local: bool,
}

pub struct ResolvedToolAttribute {
    pub name: String,
    pub title: Option<String>,
    pub description: Option<Expr>,
    pub input_schema: Expr,
    pub output_schema: Option<Expr>,
    pub annotations: Option<Expr>,
    pub icons: Option<Expr>,
    pub meta: Option<Expr>,
}

impl ResolvedToolAttribute {
    pub fn into_fn(self, fn_ident: Ident) -> syn::Result<ImplItemFn> {
        let Self {
            name,
            description,
            title,
            input_schema,
            output_schema,
            annotations,
            icons,
            meta,
        } = self;
        let description = if let Some(description) = description {
            quote! { Some(#description.into()) }
        } else {
            quote! { None }
        };
        let title_call = title
            .map(|t| quote! { .with_title(#t) })
            .unwrap_or_default();
        let output_schema_call = output_schema
            .map(|s| quote! { .with_raw_output_schema(#s) })
            .unwrap_or_default();
        let annotations_call = annotations
            .map(|a| quote! { .with_annotations(#a) })
            .unwrap_or_default();
        let icons_call = icons
            .map(|i| quote! { .with_icons(#i) })
            .unwrap_or_default();
        let meta_call = meta.map(|m| quote! { .with_meta(#m) }).unwrap_or_default();
        let doc_comment = format!("Generated tool metadata function for {name}");
        let doc_attr: syn::Attribute = parse_quote!(#[doc = #doc_comment]);
        let tokens = quote! {
            #doc_attr
            pub fn #fn_ident() -> rmcp::model::Tool {
                rmcp::model::Tool::new_with_raw(
                    #name,
                    #description,
                    #input_schema,
                )
                #title_call
                #output_schema_call
                #annotations_call
                #icons_call
                #meta_call
            }
        };
        syn::parse2::<ImplItemFn>(tokens)
    }
}

#[derive(FromMeta, Debug, Default)]
#[darling(default)]
pub struct ToolAnnotationsAttribute {
    /// A human-readable title for the tool.
    pub title: Option<String>,

    /// If true, the tool does not modify its environment.
    ///
    /// Default: false
    pub read_only_hint: Option<bool>,

    /// If true, the tool may perform destructive updates to its environment.
    /// If false, the tool performs only additive updates.
    ///
    /// (This property is meaningful only when `readOnlyHint == false`)
    ///
    /// Default: true
    /// A human-readable description of the tool's purpose.
    pub destructive_hint: Option<bool>,

    /// If true, calling the tool repeatedly with the same arguments
    /// will have no additional effect on the its environment.
    ///
    /// (This property is meaningful only when `readOnlyHint == false`)
    ///
    /// Default: false.
    pub idempotent_hint: Option<bool>,

    /// If true, this tool may interact with an "open world" of external
    /// entities. If false, the tool's domain of interaction is closed.
    /// For example, the world of a web search tool is open, whereas that
    /// of a memory tool is not.
    ///
    /// Default: true
    pub open_world_hint: Option<bool>,
}

pub fn tool(attr: TokenStream, input: TokenStream) -> syn::Result<TokenStream> {
    let attribute = if attr.is_empty() {
        Default::default()
    } else {
        let attr_args = NestedMeta::parse_meta_list(attr)?;
        ToolAttribute::from_list(&attr_args)?
    };
    let mut fn_item = syn::parse2::<ImplItemFn>(input.clone())?;
    let fn_ident = &fn_item.sig.ident;

    let tool_attr_fn_ident = format_ident!("{}_tool_attr", fn_ident);
    let input_schema_expr = if let Some(input_schema) = attribute.input_schema {
        input_schema
    } else {
        // try to find some parameters wrapper in the function
        let params_ty = crate::common::find_parameters_type_impl(&fn_item);
        if let Some(params_ty) = params_ty {
            // if found, use the Parameters schema
            syn::parse2::<Expr>(quote! {
                rmcp::handler::server::common::schema_for_input::<#params_ty>()
                    .unwrap_or_else(|e| {
                        panic!(
                            "Invalid input schema for `{}`: {}",
                            std::any::type_name::<#params_ty>(),
                            e
                        )
                    })
            })?
        } else {
            // if not found, use a default empty JSON schema object
            // TODO: should be updated according to the new specifications
            syn::parse2::<Expr>(quote! {
                rmcp::handler::server::common::schema_for_empty_input()
            })?
        }
    };
    let annotations_expr = if let Some(annotations) = attribute.annotations {
        let ToolAnnotationsAttribute {
            title,
            read_only_hint,
            destructive_hint,
            idempotent_hint,
            open_world_hint,
        } = annotations;
        fn wrap_option<T: ToTokens>(x: Option<T>) -> TokenStream {
            x.map(|x| quote! {Some(#x.into())})
                .unwrap_or(quote! { None })
        }
        let title = wrap_option(title);
        let read_only_hint = wrap_option(read_only_hint);
        let destructive_hint = wrap_option(destructive_hint);
        let idempotent_hint = wrap_option(idempotent_hint);
        let open_world_hint = wrap_option(open_world_hint);
        let token_stream = quote! {
            rmcp::model::ToolAnnotations::from_raw(
                #title,
                #read_only_hint,
                #destructive_hint,
                #idempotent_hint,
                #open_world_hint,
            )
        };
        Some(syn::parse2::<Expr>(token_stream)?)
    } else {
        None
    };
    // Handle output_schema - either explicit or generated from return type
    let output_schema_expr = attribute.output_schema.or_else(|| {
        // Try to generate schema from return type
        match &fn_item.sig.output {
            syn::ReturnType::Type(_, ret_type) => extract_schema_from_return_type(ret_type),
            _ => None,
        }
    });

    let description_expr = match attribute.description {
        Some(description) => Some(description.into()),
        None => fn_item.attrs.iter().try_fold(None, extract_doc_line)?,
    };
    let resolved_tool_attr = ResolvedToolAttribute {
        name: attribute.name.unwrap_or_else(|| fn_ident.to_string()),
        description: description_expr,
        input_schema: input_schema_expr,
        output_schema: output_schema_expr,
        annotations: annotations_expr,
        title: attribute.title,
        icons: attribute.icons,
        meta: attribute.meta,
    };
    let tool_attr_fn = resolved_tool_attr.into_fn(tool_attr_fn_ident)?;
    // modify the the input function
    if fn_item.sig.asyncness.is_some() {
        // 1. remove asyncness from sig
        // 2. make return type: `std::pin::Pin<Box<dyn std::future::Future<Output = #ReturnType> + Send + '_>>`
        //    (omit `+ Send` when the `local` crate 
```

### Core Architecture Module: `crates/rmcp-macros/src/tool_handler.rs`
```
use darling::{FromMeta, ast::NestedMeta};
use proc_macro2::TokenStream;
use quote::{ToTokens, quote};
use syn::{Expr, ImplItem, ItemImpl};

use crate::common::{has_method, has_sibling_handler};

#[derive(FromMeta)]
#[darling(default)]
pub struct ToolHandlerAttribute {
    pub router: Expr,
    pub meta: Option<Expr>,
    pub name: Option<String>,
    pub version: Option<String>,
    pub instructions: Option<String>,
}

impl Default for ToolHandlerAttribute {
    fn default() -> Self {
        Self {
            router: syn::parse2(quote! {
                Self::tool_router()
            })
            .unwrap(),
            meta: None,
            name: None,
            version: None,
            instructions: None,
        }
    }
}

pub fn tool_handler(attr: TokenStream, input: TokenStream) -> syn::Result<TokenStream> {
    let attr_args = NestedMeta::parse_meta_list(attr)?;
    let ToolHandlerAttribute {
        router,
        meta,
        name,
        version,
        instructions,
    } = ToolHandlerAttribute::from_list(&attr_args)?;
    let mut item_impl = syn::parse2::<ItemImpl>(input)?;

    if !has_method("call_tool", &item_impl) {
        let tool_call_fn = syn::parse2::<ImplItem>(quote! {
            async fn call_tool(
                &self,
                request: rmcp::model::CallToolRequestParams,
                context: rmcp::service::RequestContext<rmcp::RoleServer>,
            ) -> Result<rmcp::model::CallToolResponse, rmcp::ErrorData> {
                let tcc = rmcp::handler::server::tool::ToolCallContext::new(self, request, context);
                #router.call(tcc).await
            }
        })?;
        item_impl.items.push(tool_call_fn);
    }

    let result_meta = if let Some(meta) = meta {
        quote! { Some(#meta) }
    } else {
        quote! { None }
    };

    if !has_method("list_tools", &item_impl) {
        let tool_list_fn = syn::parse2::<ImplItem>(quote! {
            async fn list_tools(
                &self,
                _request: Option<rmcp::model::PaginatedRequestParams>,
                context: rmcp::service::RequestContext<rmcp::RoleServer>,
            ) -> Result<rmcp::model::ListToolsResult, rmcp::ErrorData> {
                let supports_cache_hints = context.protocol_version().is_some_and(|version| {
                    version >= rmcp::model::ProtocolVersion::V_2026_07_28
                });
                Ok(rmcp::model::ListToolsResult{
                    result_type: Some(rmcp::model::ResultType::COMPLETE),
                    tools: #router.list_all(),
                    meta: #result_meta,
                    next_cursor: None,
                    ttl_ms: supports_cache_hints.then_some(0),
                    cache_scope: supports_cache_hints
                        .then_some(rmcp::model::CacheScope::Public),
                })
            }
        })?;
        item_impl.items.push(tool_list_fn);
    }

    if !has_method("get_tool", &item_impl) {
        let get_tool_fn = syn::parse2::<ImplItem>(quote! {
            fn get_tool(&self, name: &str) -> Option<rmcp::model::Tool> {
                #router.get(name).cloned()
            }
        })?;
        item_impl.items.push(get_tool_fn);
    }

    // Auto-generate get_info() if not already provided
    if !has_method("get_info", &item_impl) {
        let get_info_fn = build_get_info(
            &item_impl,
            name,
            version,
            instructions,
            CallerCapability::Tools,
        )?;
        item_impl.items.push(get_info_fn);
    }

    Ok(item_impl.into_token_stream())
}

/// Which handler macro is generating `get_info()`.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum CallerCapability {
    Tools,
    Prompts,
}

/// Build a `get_info()` method that returns `ServerConfig` with the appropriate capabilities.
///
/// The caller declares its own capability via `caller`. Sibling handler attributes
/// (`prompt_handler`, `tool_handler`) are detected automatically
/// and their capabilities are included.
pub(crate) fn build_get_info(
    item_impl: &ItemImpl,
    name: Option<String>,
    version: Option<String>,
    instructions: Option<String>,
    caller: CallerCapability,
) -> syn::Result<ImplItem> {
    let has_tools =
        caller == CallerCapability::Tools || has_sibling_handler(item_impl, "tool_handler");
    let has_prompts =
        caller == CallerCapability::Prompts || has_sibling_handler(item_impl, "prompt_handler");

    let mut capability_calls = Vec::new();
    if has_tools {
        capability_calls.push(quote! { .enable_tools() });
    }
    if has_prompts {
        capability_calls.push(quote! { .enable_prompts() });
    }
    let server_info_expr = match (name, version) {
        (Some(n), Some(v)) => quote! { rmcp::model::Implementation::new(#n, #v) },
        (Some(n), None) => {
            quote! { rmcp::model::Implementation::new(#n, env!("CARGO_PKG_VERSION")) }
        }
        (None, Some(v)) => {
            quote! { rmcp::model::Implementation::new(env!("CARGO_CRATE_NAME"), #v) }
        }
        (None, None) => quote! { rmcp::model::Implementation::from_build_env() },
    };

    let mut builder_calls = vec![quote! { .with_server_info(#server_info_expr) }];
    if let Some(i) = instructions {
        builder_calls.push(quote! { .with_instructions(#i.to_string()) });
    }

    syn::parse2::<ImplItem>(quote! {
        fn get_info(&self) -> rmcp::model::ServerConfig {
            rmcp::model::ServerConfig::new(
                rmcp::model::ServerCapabilities::builder()
                    #(#capability_calls)*
                    .build()
            )
            #(#builder_calls)*
        }
    })
}

```

### Core Architecture Module: `crates/rmcp-macros/src/tool_router.rs`
```
//! Procedural macro implementation for `#[tool_router]` (see `lib.rs`).
//!
//! When `server_handler` is set, we emit a second `impl ServerHandler` item decorated with
//! `#[::rmcp::tool_handler]` so `tool_handler` expands in a later proc-macro pass—keeping all
//! tool dispatch and `get_info` logic in `tool_handler.rs` without duplicating it here.

use darling::{FromMeta, ast::NestedMeta};
use proc_macro2::TokenStream;
use quote::{ToTokens, format_ident, quote};
use syn::{Ident, ImplItem, ItemImpl, Visibility};

#[derive(FromMeta)]
#[darling(default)]
pub struct ToolRouterAttribute {
    pub router: Ident,
    pub vis: Option<Visibility>,
    /// When set, also emit `#[::rmcp::tool_handler]` on `impl ServerHandler for Self` so callers
    /// can skip a separate `#[tool_handler]` block (expanded in a later macro pass).
    pub server_handler: bool,
    /// When set, accept an impl block with no `#[tool]` fn instead of reporting an error.
    pub allow_empty: bool,
}

impl Default for ToolRouterAttribute {
    fn default() -> Self {
        Self {
            router: format_ident!("tool_router"),
            vis: None,
            server_handler: false,
            allow_empty: false,
        }
    }
}

pub fn tool_router(attr: TokenStream, input: TokenStream) -> syn::Result<TokenStream> {
    let attr_args = NestedMeta::parse_meta_list(attr)?;
    let ToolRouterAttribute {
        router,
        vis,
        server_handler,
        allow_empty,
    } = ToolRouterAttribute::from_list(&attr_args)?;
    let mut item_impl = syn::parse2::<ItemImpl>(input)?;
    // find all function marked with `#[rmcp::tool]`
    let tool_attr_fns: Vec<_> = item_impl
        .items
        .iter()
        .filter_map(|item| {
            if let syn::ImplItem::Fn(fn_item) = item {
                fn_item
                    .attrs
                    .iter()
                    .any(|attr| {
                        attr.path()
                            .segments
                            .last()
                            .is_some_and(|seg| seg.ident == "tool")
                    })
                    .then_some(&fn_item.sig.ident)
            } else {
                None
            }
        })
        .collect();
    if tool_attr_fns.is_empty() && !allow_empty {
        return Err(syn::Error::new_spanned(
            &item_impl.self_ty,
            format!(
                "`#[tool_router]` found no `#[tool]` fn in this impl block, so `Self::{router}()` \
                 would serve no tools\n\
                 note: a `macro_rules!` invocation inside the impl block is not expanded before \
                 this attribute runs, so any `#[tool]` fn it generates is invisible here; let the \
                 `macro_rules!` emit the whole `#[tool_router] impl` instead\n\
                 note: use `#[tool_router(allow_empty)]` if an empty router is intended"
            ),
        ));
    }
    let mut routers = Vec::with_capacity(tool_attr_fns.len());
    for handler in tool_attr_fns {
        let tool_attr_fn_ident = format_ident!("{handler}_tool_attr");
        routers.push(quote! {
            .with_route((Self::#tool_attr_fn_ident(), Self::#handler))
        })
    }
    let router_fn = syn::parse2::<ImplItem>(quote! {
        #vis fn #router() -> rmcp::handler::server::router::tool::ToolRouter<Self> {
            rmcp::handler::server::router::tool::ToolRouter::<Self>::new()
                #(#routers)*
        }
    })?;
    item_impl.items.push(router_fn);

    if !server_handler {
        return Ok(item_impl.into_token_stream());
    }

    if item_impl.trait_.is_some() {
        return Err(syn::Error::new_spanned(
            item_impl,
            "`server_handler` is only supported on inherent impl blocks (e.g. `impl MyType { ... }`)",
        ));
    }

    let self_ty = &item_impl.self_ty;
    let (impl_generics, ty_generics, where_clause) = item_impl.generics.split_for_impl();

    Ok(quote! {
        #item_impl

        #[::rmcp::tool_handler(router = Self::#router())]
        impl #impl_generics ::rmcp::ServerHandler for #self_ty #ty_generics #where_clause {}
    })
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn tool_router_attribute_parses_router_visibility_and_defaults_server_handler_off()
    -> syn::Result<()> {
        let attr = quote! {
            router = test_router,
            vis = "pub(crate)"
        };
        let attr_args = NestedMeta::parse_meta_list(attr)?;
        let ToolRouterAttribute {
            router,
            vis,
            server_handler,
            allow_empty,
        } = ToolRouterAttribute::from_list(&attr_args)?;
        assert_eq!(router.to_string(), "test_router");
        assert!(vis.is_some(), "vis = \"pub(crate)\" should parse");
        assert!(
            !server_handler,
            "server_handler should default to false when omitted"
        );
        assert!(
            !allow_empty,
            "allow_empty should default to false when omitted"
        );
        Ok(())
    }

    #[test]
    fn tool_router_attribute_parses_server_handler_flag() -> syn::Result<()> {
        let attr = quote! {
            router = custom_router,
            server_handler
        };
        let attr_args = NestedMeta::parse_meta_list(attr)?;
        let ToolRouterAttribute {
            router,
            server_handler,
            ..
        } = ToolRouterAttribute::from_list(&attr_args)?;
        assert_eq!(router.to_string(), "custom_router");
        assert!(server_handler);
        Ok(())
    }

    #[test]
    fn tool_router_rejects_an_impl_without_directly_visible_tool_fns() {
        let input = quote! {
            impl Probe {
                a_capability!(broadcast = "what a capability would own");
            }
        };
        let message = tool_router(TokenStream::new(), input)
            .expect_err("an impl with no `#[tool]` fn should not compile")
            .to_string();
        assert!(
            message.contains("`Self::tool_router()` would serve no tools"),
            "{message}"
        );
        assert!(message.contains("macro_rules!"), "{message}");
        assert!(message.contains("allow_empty"), "{message}");
    }

    #[test]
    fn tool_router_names_the_custom_router_fn_when_it_is_empty() {
        let message = tool_router(quote! { router = custom_router }, quote! { impl Probe {} })
            .expect_err("an impl with no `#[tool]` fn should not compile")
            .to_string();
        assert!(
            message.contains("`Self::custom_router()` would serve no tools"),
            "{message}"
        );
    }

    #[test]
    fn tool_router_accepts_an_impl_with_a_tool_fn() -> syn::Result<()> {
        let input = quote! {
            impl Probe {
                #[tool(description = "probe")]
                async fn probe(&self) -> String { "probed".to_owned() }
            }
        };
        let generated = tool_router(TokenStream::new(), input)?.to_string();
        assert!(generated.contains("with_route"), "{generated}");
        Ok(())
    }

    #[test]
    fn tool_router_allow_empty_generates_a_router_without_routes() -> syn::Result<()> {
        let generated = tool_router(quote! { allow_empty }, quote! { impl Probe {} })?.to_string();
        assert!(generated.contains("fn tool_router"), "{generated}");
        assert!(!generated.contains("with_route"), "{generated}");
        Ok(())
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1320** (2026-10-05): **Handler-generated invalid params errors use HTTP 400 on the modern Streamable HTTP path**
  *Symptoms*: **Describe the bug**  On the modern (`2026-07-28`) Streamable HTTP path, `jsonrpc_http_status` maps every `ErrorCode::INVALID_PARAMS` (`-32602`) response to HTTP 400. This includes ordinary application errors that the spec defines as `-32602` and that are not transport validation failures:  - `resources/read` for a resource that does not exist ([resources: Error Handling](https://modelcontextprotocol.io/specification/2026-07-28/server/resources#error-handling)) - `prompts/get` with an unknown prompt name or a missing required argument ([prompts: Error Handling](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts#error-handling)) - `tools/call` for an unknown tool ([tools: Error Handling](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#error-handling))  The 2026-07-28 spec requires HTTP 400 for `HeaderMismatch`, `UnsupportedProtocolVersionError`, `MissingRequiredClientCapabilityError`, and for a request whose `_meta` is missing a required field such as `clientCapabilities` ([`_meta`](https://modelcontextprotocol.io/specification/2026-07-28/basic/index#_meta)), and HTTP 404 for `-32601`. It does not require 400 for the handler errors above. Its [backward-compatibility rules](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#backward-compatibility) tell a client that receives HTTP 400 to inspect the body and fall back to `initialize` when it is not one of those recognized modern errors. A spec-comp

- **Issue #1317** (2026-10-05): **The rmcp lib test target does not build without the macros feature**
  *Symptoms*: `object!` is `#[macro_export]`ed and documented from `model.rs:42`, but `model.rs:60` puts it behind the `macros` feature, so it is unreachable in a `--no-default-features` build. The lib test target is where that shows on `8f9a28e`: four unit tests call the macro.  ``` $ cd /tmp/rmcp-main && cargo check -p rmcp --lib --no-default-features --profile test # rustc 1.96.1 (31fca3adb 2026-06-26), the pinned rust-toolchain.toml, on 8f9a28e error: cannot find macro `object` in this scope     --> crates/rmcp/src/model.rs:5529:17 note: `object` is imported here, but it is a function, not a macro     --> crates/rmcp/src/model.rs:4837:9 error: could not compile `rmcp` (lib test) due to 4 previous errors   # :5459 :5488 :5503 :5529  $ cargo check -p rmcp --lib --no-default-features --features macros --profile test     Finished `test` profile [unoptimized + debuginfo] target(s) in 7.63s  # same export, `#[cfg(feature = "macros")]` deleted from model.rs:60, nothing else touched $ cargo test -p rmcp --lib --no-default-features     test result: ok. 139 passed; 0 failed; 0 ignored # not run: the integration targets under crates/rmcp/tests, and any host other than Linux ```  The expansion is `serde_json::json!` around the ungated `model::object` function, `serde_json` is a plain dependency, and `macros` is `dep:rmcp-macros` + `dep:pastey`. Deleting the gate is the one-line option. Keeping it means `object(json!({ ... }))` at the four call sites, or a `#[cfg(feature = "macros")]` on the four `
  **Post-Mortem & Fix Analysis**:
  > I will take this. The test target should build with the same feature set the library claims to support; I will add the failing configuration to the check and fix it.

- **Issue #1299** (2026-09-27): **Float fields fail to deserialize when serde_json's `arbitrary_precision` is enabled elsewhere in the build**
  *Symptoms*: When any crate in a downstream build enables `serde_json/arbitrary_precision`, Cargo feature unification turns it on for rmcp as well, and every `f32`/`f64` field that rmcp reads through serde's buffered path fails on a decimal with `invalid type: map, expected f32`. Integers still parse, so only fractional values are affected. Because `ServerResult` and `ServerNotification` are untagged unions ending in a catch-all, nothing reports the error: a `tools/call` result silently becomes `CustomResult` and a fractional `notifications/progress` becomes `CustomNotification`.  This is serde's known limitation with that feature (serde-rs/json#721, serde-rs/serde#1183): serde replays a buffered decimal as serde_json's private number map, which a plain float field cannot read. rmcp cannot keep the feature out of a downstream build, and the case is real: the OpenAI Codex CLI gets it from `starlark 0.14.2` (unconditionally) and from one of its own crates, and as a result every tool call to a server that sets a fractional `annotations.priority` fails there (openai/codex#38979).  ### Reproduction  ```toml [dependencies] rmcp = { version = "=3.4.1", default-features = false, features = ["client"] } serde_json = "1"  [features] ap = ["serde_json/arbitrary_precision"] ```  ```rust use rmcp::model::{JsonRpcMessage, ServerResult}; use rmcp::service::{RoleClient, RxJsonRpcMessage};  let line = r#"{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"ok","annotations":{"priority":0.6}

- **Issue #1272** (2026-09-25): **streamable-http server: duplicate SEP-2243 headers silently resolve to the first value**
  *Symptoms*: ## Summary  SEP-2243 header validation reads each header with `HeaderMap::get`, which returns the **first** of several field lines with the same name. A request carrying two contradictory `Mcp-Method` values is validated against the first and the second is silently discarded, rather than the ambiguity being rejected.  The same applies to `Mcp-Name` and every `Mcp-Param-*` header — all three go through one helper, and there is no `get_all` anywhere in the module.  ## Current behavior  [`crates/rmcp/src/transport/common/mcp_headers.rs#L334-L336`](https://github.com/modelcontextprotocol/rust-sdk/blob/b037c0fa886158fd9b09b915df866458688967e4/crates/rmcp/src/transport/common/mcp_headers.rs#L334-L336):  ```rust fn header_str<'a>(headers: &'a http::HeaderMap, name: &str) -> Option<&'a str> {     headers.get(name).and_then(|value| value.to_str().ok()) } ```  Its three call sites cover the whole SEP-2243 surface:  ```rust 271:    let header_method = header_str(headers, HEADER_MCP_METHOD); 283:        match header_str(headers, HEADER_MCP_NAME) { 303:            let header_value = header_str(headers, &full); ```  So at `>= STANDARD_HEADERS` this passes validation:  ```http POST /mcp MCP-Protocol-Version: 2026-07-28 Mcp-Method: tools/list Mcp-Method: tools/call  {"jsonrpc":"2.0","id":1,"method":"tools/list", ...} ```  `Mcp-Method` carries one method name, not a comma-separated list, so two field lines are not a value rmcp should be picking a winner from.  ## Why this matters  The stated 

- **Issue #1271** (2026-09-24): **streamable-http server: a supplied Mcp-Method contradicting an initialize body is silently accepted**
  *Symptoms*: ## Summary  `validate_standard_headers` exempts `initialize` from SEP-2243 header validation entirely, so a **supplied** `Mcp-Method` header that contradicts an `initialize` body is silently accepted. The exemption's rationale justifies not *requiring* the headers on `initialize`, but not ignoring one the client actually sent.  `validate_header_matches_init_body`, ~250 lines earlier in the same file, already implements the behavior I'd expect here for the sibling header: tolerate absence, reject contradiction.  ## Current behavior  [`crates/rmcp/src/transport/streamable_http_server/tower.rs#L730-L752`](https://github.com/modelcontextprotocol/rust-sdk/blob/b037c0fa886158fd9b09b915df866458688967e4/crates/rmcp/src/transport/streamable_http_server/tower.rs#L730-L752):  ```rust /// The `initialize` handshake is exempt: clients emit these headers only after the /// version has been negotiated. fn validate_standard_headers(     headers: &HeaderMap,     message: &ClientJsonRpcMessage,     tool_schema: impl Fn(&str) -> Option<Arc<JsonObject>>, ) -> HttpResult<()> {     // ... version gate ...     let request_id = match message {         ClientJsonRpcMessage::Request(req) => {             if matches!(&req.request, ClientRequest::InitializeRequest(_)) {                 return Ok(());          // <-- exempt, whether or not a header was sent             }             Some(req.id.clone())         }         // ...     }; ```  So at `>= STANDARD_HEADERS`, this is accepted:  ```http POST /mcp

- **Issue #1268** (2026-09-25): **Explicit default-port Origin entries reject browser-serialized origins**
  *Symptoms*: Configuring `StreamableHttpServerConfig::allowed_origins` with `https://client.example:443` rejects `Origin: https://client.example` with HTTP 403. Supplying `Origin: https://client.example:443` succeeds. This prevents an explicit default-port entry from matching the origin’s normal browser serialization.  Reproduced with rmcp 3.3.0 through a Streamable HTTP server, using MCP Inspector CLI to call a tool with each Origin header explicitly supplied:  | Allowed entry | Request Origin | Observed | Expected | | --- | --- | --- | --- | | `https://client.example:443` | `https://client.example` | HTTP 403 | Accepted | | `https://client.example:443` | `https://client.example:443` | Accepted | Accepted | | `https://client.example:443` | `https://client.example:8443` | HTTP 403 | HTTP 403 | | `https://client.example` | `https://client.example:8443` | Accepted | Accepted |  [RFC 6454 §4](https://www.rfc-editor.org/rfc/rfc6454.html#section-4) assigns an omitted port the scheme’s default; [§6.2](https://www.rfc-editor.org/rfc/rfc6454.html#section-6.2) omits that default port when serializing an origin. The [current matcher](https://github.com/modelcontextprotocol/rust-sdk/blob/3075dc9152d4678775f20634fcb467a7b995dbab/crates/rmcp/src/transport/streamable_http_server/tower.rs#L838-L873) instead compares the incoming absent port directly against the configured explicit port.  Please compare an explicitly configured port against the incoming origin’s effective port: 443 for HTTPS and 80 for H

- **Issue #1261** (2026-09-14): **Server deadlocks when first request handler sends progress/message notifications**
  *Symptoms*: ## Bug description  When a modern-protocol (2026-07-28) rmcp server receives a non-`initialize` request as its very first message on a stdio transport, `serve_server_with_ct_inner` handles that request **inline** before `serve_inner`'s peer-drain loop is started.  During that inline handler execution:  - Server-to-client notifications (`notifications/progress`, `notifications/message`) are enqueued into the peer channel. - `Peer::send_notification()` awaits a oneshot responder that is only resolved once the message is actually written to the transport. - The peer channel is drained exclusively by `serve_inner`'s spawned task — which does not yet exist.  Result: any handler that emits a notification before returning **deadlocks forever**. The notification await blocks the handler, the handler blocks the return to `serve_inner`, and `serve_inner` never starts to drain the channel.  This affects any client using the 2026-07-28 protocol that skips `server/discover` and sends e.g. `tools/call` as its first message. The TypeScript SDK client does exactly this (it probes `server/discover` on a short-lived sibling process), so the deadlock is hit on the very first real progress test against an rmcp server.  ## Reproduction  1. Start an rmcp stdio server with a tool handler that calls `context.peer().send_notification(...)` (e.g. a progress notification) before returning its result. 2. Connect a modern-protocol client that sends `tools/call` with a `progressToken` as the **first** JSO

- **Issue #1251** (2026-09-14): **Client ignores legacy reverse-request cancellation and may cancel an unrelated outbound request**
  *Symptoms*: ## Summary  In a legacy MCP session, a server's `notifications/cancelled` does not cancel the matching server-originated request's `RequestContext.ct`. The `RoleClient` service loop removes an outbound response waiter instead of cancelling the inbound request token. If an unrelated outbound request has the same ID, its waiter can be cancelled instead.  Reproduced on current main at `302319861a4b5ab538f6aebf25befdc3c7dfe039`. The same routing is present in the released rmcp 3.2.0 source.  ## Reproduction  1. Complete an `initialize` handshake selecting protocol version `2025-11-25`. 2. Have the client's `create_elicitation` handler signal that it has started, then await `context.ct.cancelled()`. 3. Send this request from the server:  ```json {"jsonrpc":"2.0","id":"elicitation-1","method":"elicitation/create","params":{"message":"Continue?","requestedSchema":{"type":"object","properties":{}}}} ```  4. After the handler starts, send:  ```json {"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":"elicitation-1"}} ```  5. Keep the connection open. The handler's token remains active. Sending a subsequent ping confirms the service can still process traffic.  ### Runnable regression against unpatched main  The [regression file](https://github.com/aurokin/rust-sdk/blob/a389b20049bad9de1d165951366075b124793840/crates/rmcp/tests/test_cancelled_response.rs) contains a raw-peer reproduction. The following commands copy only that test file into a fresh checkout of unpa
  **Post-Mortem & Fix Analysis**:
  > Reproduces on `46db531`, eight commits after the `3023198` named in the report, with the regression file copied in and no production change applied:  ``` $ cargo test -p rmcp --test test_cancelled_response --features client,elicitation,transport-io test result: FAILED. 3 passed; 2 failed; 0 ignored; 0 measured; 0 filtered out; finished in 10.00s  failures:     cancelled_reverse_request_stays_suppressed_during_eof_drain     peer_cancels_reverse_request_without_cancelling_outbound_request ```  The two failures are the two the report names, and each fails where it says it does:  ``` peer_cancels_reverse_request_without_cancelling_outbound_request   panicked at crates/rmcp/tests/test_cancelled_response.rs:283:5:   assertion failed: matches!(outbound.rx.try_recv(),       Err(tokio::sync::oneshot::error::TryRecvError::Empty))  cancelled_reverse_request_stays_suppressed_during_eof_drain   Error: deadline has elapsed ```  The `deadline has elapsed` arrives at 10.0 seconds, before the test send
  > Thanks for the report, @aurokin! I agree with the approach. Please go ahead and open the PR.

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

### Incident Patch 1: `4a226c7c` (2026-10-05)
**Commit Message**: fix(server): keep discover lifecycle bootstrap-neutral (#1248)

* fix(server): keep discover lifecycle bootstrap-neutral

* fix(server): isolate discover peer and drop panic

---------

Co-authored-by: Faisal Shah <[REDACTED_EMAIL]>
Co-authored-by: Dale Seo <[REDACTED_EMAIL]>

**File**: `crates/rmcp/src/service/server.rs` (modified, +90/-41)
```diff
@@ -568,9 +568,14 @@ where
     let mut transport = transport.into_transport();
     let id_provider = <Arc<AtomicU32RequestIdProvider>>::default();
 
-    // Get initialize request; the MCP spec permits ping before initialize.
+    let (peer, peer_rx) = Peer::new(id_provider.clone(), None);
+
+    // Select the lifecycle only after an initialize request or the first valid
+    // non-discover request with complete inline metadata. A discover request is
+    // a bootstrap probe: respond to it, but remain open to either lifecycle.
+    // The MCP spec also permits ping before initialize.
     // See: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#initialization
-    let (request, id) = loop {
+    let (initialize_request, id) = loop {
         let msg = expect_next_message(&mut transport, "initialize request").await?;
         match msg {
             ClientJsonRpcMessage::Request(req)
@@ -589,56 +594,100 @@ where
                         )
                     })?;
             }
-            ClientJsonRpcMessage::Request(req) => break (req.request, req.id),
-            other => {
-                return Err(ServerInitializeError::ExpectedInitializeRequest(Some(
-                    other,
-                )));
-            }
-        }
-    };
-
-    let initialize_request = match request {
-        ClientRequest::InitializeRequest(request) => request,
-        request => {
-            let missing_metadata = request
-                .get_meta()
-                .missing_required_keys(&ProtocolVersion::V_2026_07_28);
-            if !missing_metadata.is_empty() {
-                transport
-                    .send(ServerJsonRpcMessage::error(
-                        missing_request_metadata_error(&missing_metadata),
-                        Some(id.clone()),
-                    ))
-                    .await
-                    .map_err(|error| {
+            ClientJsonRpcMessage::Request(req) => {
+                let id = req.id;
+                let mut request = match req.request {
+                    ClientRequest::InitializeRequest(request) => break (request, id),
+                    request => request,
+                };
+                let missing_metadata = request
+                    .get_meta()
+                    .missing_required_keys(&ProtocolVersion::V_2026_07_28);
+                let requested_version = match request.get_meta().protocol_version() {
+                    Some(version) if missing_metadata.is_empty() => version,
+                    _ => {
+                        transport
+                            .send(ServerJsonRpcMessage::error(
+                                missing_request_metadata_error(&missing_metadata),
+                                Some(id),
+                            ))
+                            .await
+                            .map_err(|error| {
+                                ServerInitializeError::transport::<T>(
+                                    error,
+                                    "sending pre-init metadata error response",
+                                )
+                            })?;
+                        continue;
+                    }
+                };
+
+                if matches!(request, ClientRequest::DiscoverRequest(_)) {
+                    // No lifecycle exists yet, so the handler gets a peer that
+                    // cannot reach the client.
+                    let (bootstrap_peer, _) = Peer::new(id_provider.clone(), None);
+                    let context = RequestContext {
+                        ct: ct.child_token(),
+                        id: id.clone(),
+                        meta: std::mem::take(request.get_meta_mut()),
+                        extensions: std::mem::take(request.extensions_mut()),
+                        peer: bootstrap_peer,
+                    };
+                    let response = match service.handle_request(request, context).await {
+                        Ok(result) => ServerJsonRpcMessage::response(result, id),
+                        Err(error) => ServerJsonRpcMessage::error(error, Some(id)),
+                    };
+                    transport.send(response).await.map_err(|error| {
                         ServerInitializeError::transport::<T>(
                             error,
-                            "sending pre-init metadata error response",
+                            "sending bootstrap request response",
                         )
                     })?;
+                    continue;
+                }
+
+                let supported_versions = service.supported_protocol_versions();
+                if !supported_versions.contains(&requested_version) {
+                    transport
+                        .send(ServerJsonRpcMessage::error(
+                            ErrorData::unsupported_protocol_version(
+                                requested_version,
+                                &supported_
```

**File**: `crates/rmcp/tests/test_server_initialization.rs` (modified, +274/-2)
```diff
@@ -2,13 +2,16 @@
 #![cfg(all(feature = "client", not(feature = "local")))]
 mod common;
 
+use std::time::Duration;
+
 use common::handlers::TestServer;
 use rmcp::{
-    ServerHandler, ServiceExt,
+    ErrorData, RoleServer, ServerHandler, ServiceExt,
     model::{
-        ClientJsonRpcMessage, ProtocolVersion, ServerCapabilities, ServerConfig,
+        ClientJsonRpcMessage, DiscoverResult, ProtocolVersion, ServerCapabilities, ServerConfig,
         ServerJsonRpcMessage, ServerResult,
     },
+    service::RequestContext,
     transport::{IntoTransport, Transport},
 };
 
@@ -51,6 +54,275 @@ fn list_tools_request(id: u64) -> ClientJsonRpcMessage {
     ))
 }
 
+fn discover_request(id: u64, version: &str, complete: bool) -> ClientJsonRpcMessage {
+    let capabilities = if complete {
+        r#", "io.modelcontextprotocol/clientCapabilities": {}"#
+    } else {
+        ""
+    };
+    msg(&format!(
+        r#"{{
+            "jsonrpc": "2.0",
+            "id": {id},
+            "method": "server/discover",
+            "params": {{
+                "_meta": {{
+                    "io.modelcontextprotocol/protocolVersion": "{version}",
+                    "io.modelcontextprotocol/clientInfo": {{
+                        "name": "test-client",
+                        "version": "0.0.1"
+                    }}{capabilities}
+                }}
+            }}
+        }}"#
+    ))
+}
+
+fn inline_list_tools_request(id: u64, version: &str) -> ClientJsonRpcMessage {
+    msg(&format!(
+        r#"{{
+            "jsonrpc": "2.0",
+            "id": {id},
+            "method": "tools/list",
+            "params": {{
+                "_meta": {{
+                    "io.modelcontextprotocol/protocolVersion": "{version}",
+                    "io.modelcontextprotocol/clientInfo": {{
+                        "name": "test-client",
+                        "version": "0.0.1"
+                    }},
+                    "io.modelcontextprotocol/clientCapabilities": {{}}
+                }}
+            }}
+        }}"#
+    ))
+}
+
+async fn expect_response(client: &mut impl Transport<rmcp::RoleClient>) -> ServerResult {
+    let response = client.receive().await.expect("expected server response");
+    let ServerJsonRpcMessage::Response(response) = response else {
+        panic!("expected successful response, got {response:?}");
+    };
+    response.result
+}
+
+#[tokio::test]
+async fn discover_probe_then_initialize_selects_classic_lifecycle() {
+    let (server_transport, client_transport) = tokio::io::duplex(4096);
+    let server_handle =
+        tokio::spawn(async move { TestServer::new().serve(server_transport).await });
+    let mut client = IntoTransport::<rmcp::RoleClient, _, _>::into_transport(client_transport);
+
+    client
+        .send(discover_request(1, "2026-07-28", true))
+        .await
+        .unwrap();
+    assert!(matches!(
+        expect_response(&mut client).await,
+        ServerResult::DiscoverResult(_)
+    ));
+    client.send(init_request()).await.unwrap();
+    assert!(matches!(
+        expect_response(&mut client).await,
+        ServerResult::InitializeResult(_)
+    ));
+    client.send(initialized_notification()).await.unwrap();
+    client.send(list_tools_request(2)).await.unwrap();
+    assert!(matches!(
+        expect_response(&mut client).await,
+        ServerResult::ListToolsResult(_)
+    ));
+
+    server_handle
+        .await
+        .unwrap()
+        .unwrap()
+        .cancel()
+        .await
+        .unwrap();
+}
+
+#[tokio::test]
+async fn repeated_discover_probes_then_inline_request_select_inline_lifecycle() {
+    let (server_transport, client_transport) = tokio::io::duplex(4096);
+    let server_handle =
+        tokio::spawn(async move { TestServer::new().serve(server_transport).await });
+    let mut client = IntoTransport::<rmcp::RoleClient, _, _>::into_transport(client_transport);
+
+    for id in 1..=2 {
+        client
+            .send(discover_request(id, "2026-07-28", true))
+            .await
+            .unwrap();
+        assert!(matches!(
+            expect_response(&mut client).await,
+            ServerResult::DiscoverResult(_)
+        ));
+    }
+    client
+        .send(inline_list_tools_request(3, "2026-07-28"))
+        .await
+        .unwrap();
+    assert!(matches!(
+        expect_response(&mut client).await,
+        ServerResult::ListToolsResult(_)
+    ));
+
+    server_handle
+        .await
+        .unwrap()
+        .unwrap()
+        .cancel()
+        .await
+        .unwrap();
+}
+
+#[tokio::test]
+async fn malformed_discover_does_not_prevent_classic_initialize() {
+    let (server_transport, client_transport) = tokio::io::duplex(4096);
+    let server_handle =
+        tokio::spawn(async move { TestServer::new().serve(server_transport).await });
+    let mut client = IntoTransport::<rmcp::RoleClient, _, _>::into_transport(client_transport);
+
+    client
+        .send(discover_request(1, "2026-07-28", fa
```

**File**: `crates/rmcp/tests/test_stateless_server_requests.rs` (modified, +50/-11)
```diff
@@ -14,7 +14,7 @@ use rmcp::{
         ProgressToken, ProtocolVersion, RequestId, RequestMetaObject, ServerJsonRpcMessage,
         ServerNotification,
     },
-    service::{MaybeSendFuture, RequestContext, RoleServer, ServerInitializeError},
+    service::{MaybeSendFuture, RequestContext, RoleServer},
     transport::{IntoTransport, Transport},
 };
 
@@ -89,12 +89,38 @@ async fn stateless_server_rejects_missing_metadata_on_every_request() {
     };
     assert_eq!(error.error.code, ErrorCode::INVALID_PARAMS);
 
-    server_task
+    let mut valid_request = list_tools_request(complete_meta());
+    if let ClientJsonRpcMessage::Request(request) = &mut valid_request {
+        request.id = RequestId::Number(3);
+    }
+    client
+        .send(valid_request)
         .await
-        .expect("server task")
-        .cancel()
+        .expect("send valid list tools");
+    assert!(matches!(
+        client.receive().await,
+        Some(ServerJsonRpcMessage::Response(_))
+    ));
+
+    let running = server_task.await.expect("server task");
+
+    client
+        .send(ClientJsonRpcMessage::request(
+            ClientRequest::ListToolsRequest(ListToolsRequest {
+                method: Default::default(),
+                params: None,
+                extensions: Default::default(),
+            }),
+            RequestId::Number(4),
+        ))
         .await
-        .expect("cancel server");
+        .expect("send list tools without metadata after inline selection");
+    let Some(ServerJsonRpcMessage::Error(error)) = client.receive().await else {
+        panic!("expected invalid params");
+    };
+    assert_eq!(error.error.code, ErrorCode::INVALID_PARAMS);
+
+    running.cancel().await.expect("cancel server");
 }
 
 #[derive(Clone)]
@@ -166,7 +192,7 @@ async fn stateless_server_uses_each_requests_client_context() {
 }
 
 #[tokio::test]
-async fn stateless_server_rejects_malformed_metadata_opener_with_error_response() {
+async fn stateless_server_rejects_malformed_metadata_without_selecting_lifecycle() {
     let (server_transport, client_transport) = tokio::io::duplex(4096);
     let server_task = tokio::spawn(async move { StatelessServer.serve(server_transport).await });
     let mut client = IntoTransport::<rmcp::RoleClient, _, _>::into_transport(client_transport);
@@ -208,13 +234,26 @@ async fn stateless_server_rejects_malformed_metadata_opener_with_error_response(
             .contains("io.modelcontextprotocol/clientCapabilities")
     );
 
-    let Err(error) = server_task.await.expect("server task") else {
-        panic!("malformed opener should not start a session");
-    };
+    let mut valid_request = list_tools_request(complete_meta());
+    if let ClientJsonRpcMessage::Request(request) = &mut valid_request {
+        request.id = RequestId::Number(2);
+    }
+    client
+        .send(valid_request)
+        .await
+        .expect("send valid list tools after malformed request");
     assert!(matches!(
-        error,
-        ServerInitializeError::ExpectedInitializeRequest(Some(_))
+        client.receive().await,
+        Some(ServerJsonRpcMessage::Response(_))
     ));
+
+    server_task
+        .await
+        .expect("server task")
+        .expect("valid inline request should start the server")
+        .cancel()
+        .await
+        .expect("cancel server");
 }
 
 #[derive(Clone)]
```

---

### Incident Patch 2: `cf1e9aa7` (2026-10-05)
**Commit Message**: fix: keep handler-generated invalid params errors in-band (#1322)

* fix: keep handler invalid params errors in-band

* fix: keep 400 for malformed request _meta

**File**: `crates/rmcp/src/transport/streamable_http_server/tower.rs` (modified, +35/-16)
```diff
@@ -643,17 +643,21 @@ fn validate_required_protocol_meta(
     .into())
 }
 
-fn jsonrpc_http_status(message: &ServerJsonRpcMessage) -> http::StatusCode {
+/// `request_meta_malformed` marks a request missing required `_meta` fields;
+/// only then is `-32602` a malformed-request 400 rather than an in-band error.
+fn jsonrpc_http_status(
+    message: &ServerJsonRpcMessage,
+    request_meta_malformed: bool,
+) -> http::StatusCode {
     let ServerJsonRpcMessage::Error(error) = message else {
         return http::StatusCode::OK;
     };
-    // Modern per-request HTTP treats invalid params as a malformed request.
     // Legacy requests bypass this mapper and retain HTTP 200 JSON-RPC errors.
     match error.error.code {
         ErrorCode::UNSUPPORTED_PROTOCOL_VERSION
         | ErrorCode::MISSING_REQUIRED_CLIENT_CAPABILITY
-        | ErrorCode::INVALID_PARAMS
         | ErrorCode::HEADER_MISMATCH => http::StatusCode::BAD_REQUEST,
+        ErrorCode::INVALID_PARAMS if request_meta_malformed => http::StatusCode::BAD_REQUEST,
         ErrorCode::METHOD_NOT_FOUND => http::StatusCode::NOT_FOUND,
         _ => http::StatusCode::OK,
     }
@@ -676,23 +680,39 @@ mod jsonrpc_http_status_tests {
     #[test]
     fn header_mismatch_maps_to_bad_request() {
         assert_eq!(
-            jsonrpc_http_status(&error_message(ErrorCode::HEADER_MISMATCH)),
+            jsonrpc_http_status(&error_message(ErrorCode::HEADER_MISMATCH), false),
             http::StatusCode::BAD_REQUEST
         );
     }
 
     #[test]
     fn method_not_found_maps_to_not_found() {
         assert_eq!(
-            jsonrpc_http_status(&error_message(ErrorCode::METHOD_NOT_FOUND)),
+            jsonrpc_http_status(&error_message(ErrorCode::METHOD_NOT_FOUND), false),
             http::StatusCode::NOT_FOUND
         );
     }
 
+    #[test]
+    fn invalid_params_for_malformed_request_meta_maps_to_bad_request() {
+        assert_eq!(
+            jsonrpc_http_status(&error_message(ErrorCode::INVALID_PARAMS), true),
+            http::StatusCode::BAD_REQUEST
+        );
+    }
+
+    #[test]
+    fn invalid_params_for_well_formed_request_meta_maps_to_ok() {
+        assert_eq!(
+            jsonrpc_http_status(&error_message(ErrorCode::INVALID_PARAMS), false),
+            http::StatusCode::OK
+        );
+    }
+
     #[test]
     fn unmapped_error_defaults_to_ok() {
         assert_eq!(
-            jsonrpc_http_status(&error_message(ErrorCode::INTERNAL_ERROR)),
+            jsonrpc_http_status(&error_message(ErrorCode::INTERNAL_ERROR), false),
             http::StatusCode::OK
         );
     }
@@ -793,13 +813,8 @@ mod standard_header_init_tests {
 
 fn jsonrpc_message_response(
     message: ServerJsonRpcMessage,
-    map_protocol_status: bool,
+    status: http::StatusCode,
 ) -> HttpResult<BoxResponse> {
-    let status = if map_protocol_status {
-        jsonrpc_http_status(&message)
-    } else {
-        http::StatusCode::OK
-    };
     let body =
         serde_json::to_vec(&message).map_err(internal_error_response("serialize json response"))?;
     Ok(Response::builder()
@@ -1520,6 +1535,11 @@ where
         mut request: crate::model::JsonRpcRequest<ClientRequest>,
         parts: http::request::Parts,
     ) -> HttpResult<BoxResponse> {
+        let request_meta_malformed = !request
+            .request
+            .get_meta()
+            .missing_required_keys(&ProtocolVersion::V_2026_07_28)
+            .is_empty();
         let peer_info = Self::peer_info_for_stateless_request(&request, &parts.headers);
         request.request.extensions_mut().insert(parts);
         let (transport, mut receiver) =
@@ -1564,17 +1584,16 @@ where
             &first,
             ServerJsonRpcMessage::Response(_) | ServerJsonRpcMessage::Error(_)
         );
-        if terminal
-            && (self.config.json_response || jsonrpc_http_status(&first) != http::StatusCode::OK)
-        {
+        let status = jsonrpc_http_status(&first, request_meta_malformed);
+        if terminal && (self.config.json_response || status != http::StatusCode::OK) {
             // This message is the whole reply, so `receiver` is dropped here and
             // anything the handler emits afterwards is undeliverable. Cancel it so
             // a still-running handler stops instead of running on unobserved: its
             // terminal `send` would otherwise fail before adding the termination
             // permit, leaving the serve loop parked forever. A no-op when the
             // handler already completed.
             request_ct.cancel();
-            return jsonrpc_message_response(first, true);
+            return jsonrpc_message_response(first, status);
         }
 
         Ok(self.stateless_sse_response(Some(first), receiver, request_ct))
```

**File**: `crates/rmcp/tests/test_streamable_http_protocol_version.rs` (modified, +53/-2)
```diff
@@ -32,10 +32,18 @@ async fn spawn_server(
 async fn spawn_server_with_manager(
     config: StreamableHttpServerConfig,
     session_manager: Arc<LocalSessionManager>,
+) -> (reqwest::Client, String, CancellationToken) {
+    spawn_handler(Calculator::new(), config, session_manager).await
+}
+
+async fn spawn_handler<S: ServerHandler + Clone>(
+    handler: S,
+    config: StreamableHttpServerConfig,
+    session_manager: Arc<LocalSessionManager>,
 ) -> (reqwest::Client, String, CancellationToken) {
     let ct = config.cancellation_token.clone();
-    let service: StreamableHttpService<Calculator, LocalSessionManager> =
-        StreamableHttpService::new(|| Ok(Calculator::new()), session_manager, config);
+    let service: StreamableHttpService<S, LocalSessionManager> =
+        StreamableHttpService::new(move || Ok(handler.clone()), session_manager, config);
 
     let router = axum::Router::new().nest_service("/mcp", service);
     let tcp_listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
@@ -450,6 +458,49 @@ async fn stateless_request_accepts_missing_optional_meta_client_info() {
     ct.cancel();
 }
 
+#[derive(Clone)]
+struct MissingResourceServer;
+
+impl ServerHandler for MissingResourceServer {
+    async fn read_resource(
+        &self,
+        request: rmcp::model::ReadResourceRequestParams,
+        _context: rmcp::service::RequestContext<rmcp::RoleServer>,
+    ) -> Result<rmcp::model::ReadResourceResponse, rmcp::ErrorData> {
+        Err(rmcp::ErrorData::resource_not_found(request.uri, None))
+    }
+}
+
+#[tokio::test]
+async fn stateless_handler_invalid_params_stays_in_band() {
+    let (client, url, ct) = spawn_handler(
+        MissingResourceServer,
+        stateless_json_config(),
+        Arc::new(LocalSessionManager::default()),
+    )
+    .await;
+
+    let response = post_modern_request(
+        &client,
+        &url,
+        "resources/read",
+        Some("ui://widget/nope"),
+        json!({
+            "uri": "ui://widget/nope",
+            "_meta": {
+                "io.modelcontextprotocol/protocolVersion": "2026-07-28",
+                "io.modelcontextprotocol/clientCapabilities": {}
+            }
+        }),
+    )
+    .await;
+
+    assert_eq!(response.status(), 200);
+    let body: Value = response.json().await.expect("response should be JSON");
+    assert_eq!(body["error"]["code"], -32602);
+    ct.cancel();
+}
+
 // ---------------------------------------------------------------------------
 // Opt-in seam: `with_stateless_protocol_metadata_required(true)`
 // ---------------------------------------------------------------------------
```

---

### Incident Patch 3: `deef9bb8` (2026-10-05)
**Commit Message**: fix(model): export object! macro without macros feature (#1318)

**File**: `.github/workflows/ci.yml` (modified, +3/-0)
```diff
@@ -267,6 +267,9 @@ jobs:
       - name: Run tests
         run: cargo test --all-features
 
+      - name: Run lib tests without default features
+        run: cargo test -p rmcp --lib --no-default-features
+
   test-no-local:
     name: Run Tests (no local feature)
     runs-on: ubuntu-latest
```

**File**: `crates/rmcp/src/model.rs` (modified, +0/-1)
```diff
@@ -57,7 +57,6 @@ pub fn object(value: serde_json::Value) -> JsonObject {
 }
 
 /// Use this macro just like [`serde_json::json!`]
-#[cfg(feature = "macros")]
 #[macro_export]
 macro_rules! object {
     ({$($tt:tt)*}) => {
```

---

### Incident Patch 4: `c0d667e0` (2026-10-05)
**Commit Message**: fix(server): default missing cache hints for 2026-07-28 peers (#1308)

* fix(server): default missing cache hints

* test(server): cover manual list_tools and list_prompts

* refactor(server): gate on protocol version

**File**: `crates/rmcp/src/handler/server.rs` (modified, +11/-12)
```diff
@@ -55,8 +55,8 @@ impl<H: ServerHandler> Service<RoleServer> for H {
     ) -> Result<<RoleServer as ServiceRole>::Resp, McpError> {
         // `context` is moved into the dispatch below, so read the negotiated version first.
         let protocol_version = context.protocol_version();
-        // SEP-2322 (`resultType` discriminator, MRTR) exists from 2026-07-28.
-        let sep_2322_supported = protocol_version
+        // ISO `YYYY-MM-DD` versions compare lexically the same as chronologically.
+        let is_2026_07_28_or_later = protocol_version
             .as_ref()
             .is_some_and(|v| v.as_str() >= ProtocolVersion::V_2026_07_28.as_str());
         let requested_version = context.meta.protocol_version();
@@ -244,28 +244,27 @@ impl<H: ServerHandler> Service<RoleServer> for H {
             }
         };
         let result = result.and_then(|mut result| {
-            if matches!(result, ServerResult::InputRequiredResult(_)) && !sep_2322_supported {
+            if matches!(result, ServerResult::InputRequiredResult(_)) && !is_2026_07_28_or_later {
                 Err(McpError::invalid_request(
                     "InputRequiredResult requires negotiated protocol version 2026-07-28 or newer",
                     None,
                 ))
             } else {
-                // Peers on protocol versions older than 2026-07-28 keep the
-                // legacy wire shape without `resultType: "complete"`.
-                if !sep_2322_supported {
+                // 2026-07-28 requires caching hints on cacheable results; older
+                // peers keep the legacy shape without `resultType: "complete"`.
+                if is_2026_07_28_or_later {
+                    result.fill_missing_cache_hints();
+                } else {
                     result.strip_result_type_for_legacy_peer();
                 }
                 Ok(result)
             }
         });
 
-        // SEP-2164: peers negotiating 2026-07-28+ get the standard INVALID_PARAMS code for
-        // resource-not-found; older peers keep RESOURCE_NOT_FOUND. ISO `YYYY-MM-DD` versions
-        // compare lexically the same as chronologically.
-        let use_invalid_params =
-            protocol_version.is_some_and(|v| v.as_str() >= ProtocolVersion::V_2026_07_28.as_str());
+        // Peers on 2026-07-28+ get the standard INVALID_PARAMS code for
+        // resource-not-found; older peers keep RESOURCE_NOT_FOUND.
         result.map_err(|mut error| {
-            if use_invalid_params && error.code == ErrorCode::RESOURCE_NOT_FOUND {
+            if is_2026_07_28_or_later && error.code == ErrorCode::RESOURCE_NOT_FOUND {
                 error.code = ErrorCode::INVALID_PARAMS;
             }
             error
```

**File**: `crates/rmcp/src/model.rs` (modified, +53/-0)
```diff
@@ -4800,6 +4800,59 @@ impl ServerResult {
         };
         result_type.take_if(|result_type| result_type.is_complete());
     }
+
+    /// Fill in the SEP-2549 caching hints a cacheable result is missing.
+    ///
+    /// Protocol version `2026-07-28` requires `ttlMs` and `cacheScope` on every
+    /// complete `tools/list`, `prompts/list`, `resources/list`,
+    /// `resources/templates/list`, and `resources/read` result. The server
+    /// handler calls this before responding to a peer on that version, so a
+    /// handler that builds its result with `Default::default()` still sends a
+    /// conformant result.
+    ///
+    /// Missing hints get the most conservative values, `ttlMs: 0` (immediately
+    /// stale) and `cacheScope: "private"`, the same values
+    /// [`DiscoverResult::new`] uses. Hints the handler set are kept.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use rmcp::model::{CacheScope, ListResourcesResult, ServerResult};
+    ///
+    /// let mut result = ServerResult::ListResourcesResult(ListResourcesResult::default());
+    /// result.fill_missing_cache_hints();
+    ///
+    /// let ServerResult::ListResourcesResult(result) = result else {
+    ///     unreachable!()
+    /// };
+    /// assert_eq!(result.ttl_ms, Some(0));
+    /// assert_eq!(result.cache_scope, Some(CacheScope::Private));
+    /// ```
+    pub fn fill_missing_cache_hints(&mut self) {
+        let (result_type, ttl_ms, cache_scope) = match self {
+            ServerResult::ListToolsResult(r) => (&r.result_type, &mut r.ttl_ms, &mut r.cache_scope),
+            ServerResult::ListPromptsResult(r) => {
+                (&r.result_type, &mut r.ttl_ms, &mut r.cache_scope)
+            }
+            ServerResult::ListResourcesResult(r) => {
+                (&r.result_type, &mut r.ttl_ms, &mut r.cache_scope)
+            }
+            ServerResult::ListResourceTemplatesResult(r) => {
+                (&r.result_type, &mut r.ttl_ms, &mut r.cache_scope)
+            }
+            ServerResult::ReadResourceResult(r) => {
+                (&r.result_type, &mut r.ttl_ms, &mut r.cache_scope)
+            }
+            _ => return,
+        };
+        // Only complete results are cacheable; the spec treats an absent
+        // `resultType` as complete.
+        if result_type.as_ref().is_some_and(|t| !t.is_complete()) {
+            return;
+        }
+        ttl_ms.get_or_insert(0);
+        cache_scope.get_or_insert(CacheScope::Private);
+    }
 }
 
 pub type ServerJsonRpcMessage = JsonRpcMessage<ServerRequest, ServerResult, ServerNotification>;
```

**File**: `crates/rmcp/tests/test_handler_cache_hints.rs` (modified, +185/-19)
```diff
@@ -2,16 +2,18 @@
 #![cfg(feature = "client")]
 
 use rmcp::{
-    ClientHandler, RoleClient, RoleServer, ServerHandler,
+    ClientHandler, ErrorData, RoleClient, RoleServer, ServerHandler,
     handler::server::router::{prompt::PromptRouter, tool::ToolRouter},
     model::{
-        CacheScope, ClientConfig, InitializeResult, ListPromptsResult, ListToolsResult,
-        ProtocolVersion,
+        CacheScope, ClientConfig, InitializeResult, ListPromptsResult, ListResourcesResult,
+        ListToolsResult, PaginatedRequestParams, ProtocolVersion, ReadResourceRequestParams,
+        ReadResourceResponse, ReadResourceResult, ResourceContents,
     },
     prompt_handler,
-    service::serve_directly,
+    service::{RequestContext, RunningService, serve_directly},
     tool_handler,
 };
+use tokio::task::JoinHandle;
 
 #[derive(Debug, Clone)]
 struct CacheHintServer {
@@ -32,6 +34,53 @@ impl CacheHintServer {
 #[prompt_handler(router = self.prompt_router)]
 impl ServerHandler for CacheHintServer {}
 
+/// Implements its handlers by hand instead of through the macros, leaving the
+/// caching hints unset.
+#[derive(Debug, Clone)]
+struct ManualServer;
+
+impl ServerHandler for ManualServer {
+    async fn list_tools(
+        &self,
+        _request: Option<PaginatedRequestParams>,
+        _context: RequestContext<RoleServer>,
+    ) -> Result<ListToolsResult, ErrorData> {
+        Ok(ListToolsResult::with_all_items(vec![]))
+    }
+
+    async fn list_prompts(
+        &self,
+        _request: Option<PaginatedRequestParams>,
+        _context: RequestContext<RoleServer>,
+    ) -> Result<ListPromptsResult, ErrorData> {
+        Ok(ListPromptsResult::with_all_items(vec![]))
+    }
+
+    async fn read_resource(
+        &self,
+        request: ReadResourceRequestParams,
+        _context: RequestContext<RoleServer>,
+    ) -> Result<ReadResourceResponse, ErrorData> {
+        Ok(ReadResourceResult::new(vec![ResourceContents::text("hello", request.uri)]).into())
+    }
+}
+
+/// Sets its own caching hints, which the server must pass through unchanged.
+#[derive(Debug, Clone)]
+struct ExplicitHintServer;
+
+impl ServerHandler for ExplicitHintServer {
+    async fn list_resources(
+        &self,
+        _request: Option<PaginatedRequestParams>,
+        _context: RequestContext<RoleServer>,
+    ) -> Result<ListResourcesResult, ErrorData> {
+        Ok(ListResourcesResult::default()
+            .with_ttl_ms(5_000)
+            .with_cache_scope(CacheScope::Public))
+    }
+}
+
 #[derive(Debug, Clone)]
 struct VersionedClient {
     protocol_version: ProtocolVersion,
@@ -45,10 +94,15 @@ impl ClientHandler for VersionedClient {
     }
 }
 
+type ServerTask = JoinHandle<anyhow::Result<()>>;
+
 /// Wires the pair up directly on `protocol_version`. `2026-07-28` removed the
 /// `initialize` handshake, so a peer on that revision is reached the way the
 /// discover lifecycle leaves one: with the version already agreed.
-async fn list_results(protocol_version: ProtocolVersion) -> (ListToolsResult, ListPromptsResult) {
+fn connect<S: ServerHandler>(
+    server: S,
+    protocol_version: ProtocolVersion,
+) -> (RunningService<RoleClient, VersionedClient>, ServerTask) {
     let (server_transport, client_transport) = tokio::io::duplex(4096);
 
     let client_handler = VersionedClient {
@@ -58,11 +112,11 @@ async fn list_results(protocol_version: ProtocolVersion) -> (ListToolsResult, Li
     server_peer_info.protocol_version = protocol_version;
 
     let server = serve_directly::<RoleServer, _, _, _, _>(
-        CacheHintServer::new(),
+        server,
         server_transport,
         Some(client_handler.get_info()),
     );
-    let server_handle = tokio::spawn(async move {
+    let server_task = tokio::spawn(async move {
         server.waiting().await?;
         anyhow::Ok(())
     });
@@ -72,23 +126,21 @@ async fn list_results(protocol_version: ProtocolVersion) -> (ListToolsResult, Li
         client_transport,
         Some(server_peer_info.into()),
     );
-    let tools = client
-        .list_tools(None)
-        .await
-        .expect("tools/list should succeed");
-    let prompts = client
-        .list_prompts(None)
-        .await
-        .expect("prompts/list should succeed");
+    (client, server_task)
+}
 
+async fn disconnect(client: RunningService<RoleClient, VersionedClient>, server_task: ServerTask) {
     client.cancel().await.expect("client should cancel");
-    server_handle.await.expect("server task").expect("server");
-    (tools, prompts)
+    server_task.await.expect("server task").expect("server");
 }
 
 #[tokio::test]
 async fn handler_macros_should_emit_required_cache_hints_for_2026_07_28() {
-    let (tools, prompts) = list_results(ProtocolVersion::V_2026_07_28).await;
+    let (client, server_task) = connect(CacheHintServer::new(), ProtocolVersion::V_2026_07_28);
+
+    let tools = client.list_tools(None).await.expect("tools/list");
+    let prompts = client.list_prompts(None).aw
```

---

### Incident Patch 5: `94c5c039` (2026-10-05)
**Commit Message**: fix: use MSRV-aware dependency resolver (#1316)

* fix: use MSRV-aware dependency resolver

* docs: explain why resolver is set explicitly

**File**: `Cargo.toml` (modified, +2/-1)
```diff
@@ -1,7 +1,8 @@
 [workspace]
 members = ["crates/rmcp", "crates/rmcp-macros", "examples/*", "conformance"]
 default-members = ["crates/rmcp", "crates/rmcp-macros"]
-resolver = "2"
+# Virtual workspaces default to resolver 1 regardless of members' edition.
+resolver = "3"
 
 [workspace.dependencies]
 rmcp = { version = "3.5.0", path = "./crates/rmcp" }
```

---

### Incident Patch 6: `8f9a28ec` (2026-10-02)
**Commit Message**: fix(examples): fix complex auth server discovery (#1309)

**File**: `examples/servers/Cargo.toml` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ reqwest = { version = "0.13.2", features = ["json"] }
 chrono = "0.4"
 uuid = { version = "1.6", features = ["v4", "serde"] }
 serde_urlencoded = "0.7"
+base64 = "0.23"
 askama = { version = "0.16" }
 tower-http = { version = "0.7", features = ["cors"] }
 hyper = { version = "1" }
```

**File**: `examples/servers/src/complex_auth_streamhttp.rs` (modified, +57/-22)
```diff
@@ -6,19 +6,19 @@ use axum::{
     Json, Router,
     body::Body,
     extract::{Form, Query, State},
-    http::{Request, StatusCode},
+    http::{HeaderMap, Request, StatusCode, header},
     middleware::{self, Next},
     response::{Html, IntoResponse, Redirect, Response},
     routing::{get, post},
 };
+use base64::{Engine, prelude::BASE64_STANDARD};
 use rand::{RngExt, distr::Alphanumeric};
 use rmcp::transport::{
     StreamableHttpServerConfig,
     auth::{AuthorizationMetadata, ClientRegistrationResponse, OAuthClientConfig},
     streamable_http_server::{session::local::LocalSessionManager, tower::StreamableHttpService},
 };
 use serde::{Deserialize, Serialize};
-use serde_json::Value;
 use tokio::sync::RwLock;
 use tower_http::cors::{Any, CorsLayer};
 use tracing::{debug, error, info, warn};
@@ -29,6 +29,8 @@ mod common;
 use common::counter::Counter;
 
 const BIND_ADDRESS: &str = "127.0.0.1:3000";
+// RFC 9728 path-suffixed location for the protected resource at `/mcp`.
+const RESOURCE_METADATA_PATH: &str = "/.well-known/oauth-protected-resource/mcp";
 const INDEX_HTML: &str = include_str!("html/mcp_oauth_index.html");
 
 // Local registration request - only uses fields needed for this demo
@@ -347,6 +349,7 @@ async fn oauth_token(
 ) -> impl IntoResponse {
     info!("Received token request");
 
+    let basic_client_id = basic_auth_client_id(request.headers());
     let bytes = match axum::body::to_bytes(request.into_body(), usize::MAX).await {
         Ok(bytes) => bytes,
         Err(e) => {
@@ -418,9 +421,10 @@ async fn oauth_token(
             .into_response();
     }
 
-    // handle empty client_id
+    // Confidential clients may authenticate with HTTP Basic instead of sending
+    // `client_id` in the body (RFC 6749 §2.3.1).
     let client_id = if token_req.client_id.is_empty() {
-        "mcp-client".to_string()
+        basic_client_id.unwrap_or_else(|| "mcp-client".to_string())
     } else {
         token_req.client_id.clone()
     };
@@ -480,6 +484,18 @@ async fn oauth_token(
     }
 }
 
+/// The client id from an HTTP Basic `Authorization` header, if present.
+fn basic_auth_client_id(headers: &HeaderMap) -> Option<String> {
+    let encoded = headers
+        .get(header::AUTHORIZATION)?
+        .to_str()
+        .ok()?
+        .strip_prefix("Basic ")?;
+    let credentials = String::from_utf8(BASE64_STANDARD.decode(encoded).ok()?).ok()?;
+    let (client_id, _client_secret) = credentials.split_once(':')?;
+    Some(client_id.to_string())
+}
+
 // Auth middleware for MCP connections
 async fn validate_token_middleware(
     State(token_store): State<Arc<McpOAuthStore>>,
@@ -495,38 +511,56 @@ async fn validate_token_middleware(
             if let Some(stripped) = header_str.strip_prefix("Bearer ") {
                 stripped.to_string()
             } else {
-                return StatusCode::UNAUTHORIZED.into_response();
+                return unauthorized();
             }
         }
         None => {
-            return StatusCode::UNAUTHORIZED.into_response();
+            return unauthorized();
         }
     };
 
     // Validate the token
     match token_store.validate_token(&token).await {
         Some(_) => next.run(request).await,
-        None => StatusCode::UNAUTHORIZED.into_response(),
+        None => unauthorized(),
     }
 }
 
+/// A 401 whose `WWW-Authenticate` challenge points clients at the protected
+/// resource metadata, so they can discover the authorization server (RFC 9728).
+fn unauthorized() -> Response {
+    let challenge = format!(
+        r#"Bearer resource_metadata="http://{}{}""#,
+        BIND_ADDRESS, RESOURCE_METADATA_PATH
+    );
+    (
+        StatusCode::UNAUTHORIZED,
+        [(header::WWW_AUTHENTICATE, challenge)],
+    )
+        .into_response()
+}
+
+// handle protected resource metadata request (RFC 9728)
+async fn oauth_protected_resource() -> impl IntoResponse {
+    Json(serde_json::json!({
+        "resource": format!("http://{}/mcp", BIND_ADDRESS),
+        "authorization_servers": [format!("http://{}", BIND_ADDRESS)],
+        "scopes_supported": ["profile", "email"],
+        "bearer_methods_supported": ["header"],
+    }))
+}
+
 // handle oauth server metadata request
 async fn oauth_authorization_server() -> impl IntoResponse {
-    let mut additional_fields = HashMap::new();
-    additional_fields.insert(
-        "response_types_supported".into(),
-        Value::Array(vec![Value::String("code".into())]),
-    );
     let mut metadata = AuthorizationMetadata::default();
     metadata.authorization_endpoint = format!("http://{}/oauth/authorize", BIND_ADDRESS);
     metadata.token_endpoint = format!("http://{}/oauth/token", BIND_ADDRESS);
     metadata.scopes_supported = Some(vec!["profile".to_string(), "email".to_string()]);
     metadata.registration_endpoint = Some(format!("http://{}/oauth/register", BIND_ADDRESS));
     metadata.response_types_supported = Some(vec!["code".to_string()]);
     metadata.code_chall
```

---

### Incident Patch 7: `e02efbfc` (2026-09-27)
**Commit Message**: fix(model): decode float fields through serde_json::Number (#1300)

* fix(model): decode float fields through serde_json::Number

When serde_json's arbitrary_precision feature is enabled anywhere in a
build, serde replays a buffered decimal as serde_json's private number
map, and a plain f32 or f64 field rejects it. Read the model's float
fields through serde_json::Number, which accepts both forms.

rmcp's dev-dependencies enable the feature, so the tests run with it.

Refs openai/codex#38979

* docs(model): shorten the json_float module comment

**File**: `crates/rmcp/Cargo.toml` (modified, +3/-0)
```diff
@@ -216,6 +216,9 @@ tracing-subscriber = { version = "0.3", features = [
 ] }
 async-trait = "0.1"
 rstest = "0.27.0"
+# Cargo unifies this feature into rmcp whenever any crate in a build enables it,
+# so the tests run with it on (see tests/test_deserialization.rs).
+serde_json = { version = "1.0", features = ["arbitrary_precision"] }
 [[test]]
 name = "test_tool_macros"
 required-features = ["server", "client"]
```

**File**: `crates/rmcp/src/model.rs` (modified, +26/-5)
```diff
@@ -1633,9 +1633,14 @@ const_string!(ProgressNotificationMethod = "notifications/progress");
 pub struct ProgressNotificationParam {
     pub progress_token: ProgressToken,
     /// The progress thus far. This should increase every time progress is made, even if the total is unknown.
+    #[serde(deserialize_with = "serde_impl::json_float::f64")]
     pub progress: f64,
     /// Total number of items to process (or total progress required), if known
-    #[serde(skip_serializing_if = "Option::is_none")]
+    #[serde(
+        default,
+        deserialize_with = "serde_impl::json_float::option_f64",
+        skip_serializing_if = "Option::is_none"
+    )]
     pub total: Option<f64>,
     /// An optional message describing the current progress.
     #[serde(skip_serializing_if = "Option::is_none")]
@@ -3036,7 +3041,11 @@ pub struct CreateMessageRequestParams {
     #[serde(skip_serializing_if = "Option::is_none")]
     pub include_context: Option<ContextInclusion>,
     /// Temperature for controlling randomness (0.0 to 1.0)
-    #[serde(skip_serializing_if = "Option::is_none")]
+    #[serde(
+        default,
+        deserialize_with = "serde_impl::json_float::option_f32",
+        skip_serializing_if = "Option::is_none"
+    )]
     pub temperature: Option<f32>,
     /// Maximum number of tokens to generate
     pub max_tokens: u32,
@@ -3225,13 +3234,25 @@ pub struct ModelPreferences {
     #[serde(skip_serializing_if = "Option::is_none")]
     pub hints: Option<Vec<ModelHint>>,
     /// Priority for cost optimization (0.0 to 1.0, higher = prefer cheaper models)
-    #[serde(skip_serializing_if = "Option::is_none")]
+    #[serde(
+        default,
+        deserialize_with = "serde_impl::json_float::option_f32",
+        skip_serializing_if = "Option::is_none"
+    )]
     pub cost_priority: Option<f32>,
     /// Priority for speed/latency (0.0 to 1.0, higher = prefer faster models)
-    #[serde(skip_serializing_if = "Option::is_none")]
+    #[serde(
+        default,
+        deserialize_with = "serde_impl::json_float::option_f32",
+        skip_serializing_if = "Option::is_none"
+    )]
     pub speed_priority: Option<f32>,
     /// Priority for intelligence/capability (0.0 to 1.0, higher = prefer more capable models)
-    #[serde(skip_serializing_if = "Option::is_none")]
+    #[serde(
+        default,
+        deserialize_with = "serde_impl::json_float::option_f32",
+        skip_serializing_if = "Option::is_none"
+    )]
     pub intelligence_priority: Option<f32>,
 }
 
```

**File**: `crates/rmcp/src/model/annotated.rs` (modified, +5/-1)
```diff
@@ -17,7 +17,11 @@ use super::Role;
 pub struct Annotations {
     #[serde(skip_serializing_if = "Option::is_none")]
     pub audience: Option<Vec<Role>>,
-    #[serde(skip_serializing_if = "Option::is_none")]
+    #[serde(
+        default,
+        deserialize_with = "super::serde_impl::json_float::option_f32",
+        skip_serializing_if = "Option::is_none"
+    )]
     pub priority: Option<f32>,
     #[serde(skip_serializing_if = "Option::is_none", rename = "lastModified")]
     pub last_modified: Option<String>,
```

**File**: `crates/rmcp/src/model/elicitation_schema.rs` (modified, +15/-3)
```diff
@@ -256,15 +256,27 @@ pub struct NumberSchema {
     pub description: Option<Cow<'static, str>>,
 
     /// Minimum value (inclusive)
-    #[serde(skip_serializing_if = "Option::is_none")]
+    #[serde(
+        default,
+        deserialize_with = "super::serde_impl::json_float::option_f64",
+        skip_serializing_if = "Option::is_none"
+    )]
     pub minimum: Option<f64>,
 
     /// Maximum value (inclusive)
-    #[serde(skip_serializing_if = "Option::is_none")]
+    #[serde(
+        default,
+        deserialize_with = "super::serde_impl::json_float::option_f64",
+        skip_serializing_if = "Option::is_none"
+    )]
     pub maximum: Option<f64>,
 
     /// Default value
-    #[serde(skip_serializing_if = "Option::is_none")]
+    #[serde(
+        default,
+        deserialize_with = "super::serde_impl::json_float::option_f64",
+        skip_serializing_if = "Option::is_none"
+    )]
     pub default: Option<f64>,
 }
 
```

**File**: `crates/rmcp/src/model/serde_impl.rs` (modified, +196/-0)
```diff
@@ -8,6 +8,41 @@ use super::{
     RequestOptionalParam,
 };
 
+/// Float deserializers that also accept the number map serde_json's
+/// `arbitrary_precision` feature produces for buffered (untagged/flattened) values.
+/// Like JSON itself, they reject NaN and infinities.
+pub(crate) mod json_float {
+    use serde::{Deserialize, Deserializer, de::Error};
+    use serde_json::Number;
+
+    fn to_f64<E: Error>(number: Number) -> Result<f64, E> {
+        // `None` only for a value beyond `f64`, which serde_json also rejects
+        // without the feature.
+        number
+            .as_f64()
+            .ok_or_else(|| E::custom(format_args!("number out of range: {number}")))
+    }
+
+    pub(crate) fn f64<'de, D: Deserializer<'de>>(deserializer: D) -> Result<f64, D::Error> {
+        to_f64(Number::deserialize(deserializer)?)
+    }
+
+    pub(crate) fn option_f64<'de, D: Deserializer<'de>>(
+        deserializer: D,
+    ) -> Result<Option<f64>, D::Error> {
+        Option::<Number>::deserialize(deserializer)?
+            .map(to_f64)
+            .transpose()
+    }
+
+    pub(crate) fn option_f32<'de, D: Deserializer<'de>>(
+        deserializer: D,
+    ) -> Result<Option<f32>, D::Error> {
+        // serde_json also reads an `f32` field as `f64` and narrows it with `as`.
+        Ok(option_f64(deserializer)?.map(|value| value as f32))
+    }
+}
+
 /// Wire-side view of `params`: the `_meta` map plus the remaining fields.
 ///
 /// All metadata types are transparent wrappers over [`JsonObject`], so the
@@ -848,4 +883,165 @@ mod test {
         let output = serde_json::to_value(&req).unwrap();
         assert_eq!(input, output);
     }
+
+    /// The float fields read through [`super::json_float`].
+    mod json_float {
+        use std::fmt::Debug;
+
+        use rstest::rstest;
+        use serde::{Deserialize, Serialize, de::DeserializeOwned};
+        use serde_json::{Value, json};
+
+        use crate::model::{
+            Annotations, CreateMessageRequestParams, ModelPreferences, NumberSchema,
+            ProgressNotificationParam,
+        };
+
+        /// Untagged, so serde buffers the input before `T` reads it, as it
+        /// does for every JSON-RPC message.
+        #[derive(Deserialize)]
+        #[serde(untagged)]
+        enum Buffered<T> {
+            Inner(T),
+        }
+
+        /// Decodes `text` directly and through serde's buffer, checks that both
+        /// agree, and that the value survives a round trip.
+        fn decode<T>(text: &str) -> T
+        where
+            T: DeserializeOwned + Serialize + PartialEq + Debug,
+        {
+            let direct: T = serde_json::from_str(text).unwrap();
+            let Buffered::Inner(buffered) = serde_json::from_str(text).unwrap();
+            assert_eq!(direct, buffered, "{text}");
+            let encoded = serde_json::to_string(&direct).unwrap();
+            assert_eq!(
+                serde_json::from_str::<T>(&encoded).unwrap(),
+                direct,
+                "{encoded}"
+            );
+            direct
+        }
+
+        fn rejects<T: DeserializeOwned>(text: &str) {
+            assert!(serde_json::from_str::<T>(text).is_err(), "{text}");
+            assert!(serde_json::from_str::<Buffered<T>>(text).is_err(), "{text}");
+        }
+
+        #[rstest]
+        #[case::decimal("0.6", 0.6)]
+        #[case::trailing_zero("0.60", 0.6)]
+        #[case::exponent("6e-1", 0.6)]
+        #[case::integer("1", 1.0)]
+        #[case::integral_decimal("1.0", 1.0)]
+        #[case::zero("0", 0.0)]
+        fn fields_read_every_spelling(#[case] n: &str, #[case] expected: f64) {
+            // An `f32` field holds the `f64` narrowed, as serde_json reads it.
+            let narrowed = Some(expected as f32);
+
+            let annotations: Annotations = decode(&format!(r#"{{"priority":{n}}}"#));
+            assert_eq!(annotations.priority, narrowed);
+
+            let progress: ProgressNotificationParam = decode(&format!(
+                r#"{{"progressToken":1,"progress":{n},"total":{n}}}"#
+            ));
+            assert_eq!(progress.progress, expected);
+            assert_eq!(progress.total, Some(expected));
+
+            let params: CreateMessageRequestParams = decode(&format!(
+                r#"{{"messages":[],"maxTokens":1,"temperature":{n}}}"#
+            ));
+            assert_eq!(params.temperature, narrowed);
+
+            let preferences: ModelPreferences = decode(&format!(
+                r#"{{"costPriority":{n},"speedPriority":{n},"intelligencePriority":{n}}}"#
+            ));
+            assert_eq!(preferences.cost_priority, narrowed);
+            assert_eq!(preferences.speed_priority, narrowed);
+            assert_eq!(preferences.intelligence_priority, narrowed);
+
+            let schema: NumberSchema = decode(&format!(
+                r#"{{"type":"number","minimum":{n},"maximum":{n},"default":{n}}}"#
+            ));
+            assert_eq!(schema.minimum, Some(expected
```

**File**: `crates/rmcp/tests/test_deserialization.rs` (modified, +126/-0)
```diff
@@ -271,3 +271,129 @@ mod untagged_server_result {
         assert!(matches!(result, ServerResult::CallToolResult(_)));
     }
 }
+
+/// Regression tests for decimal float fields under serde_json's
+/// `arbitrary_precision` feature, which rmcp's dev-dependencies enable.
+///
+/// With the feature, serde replays a decimal it buffered for an untagged enum
+/// as serde_json's private number map. A plain `f32`/`f64` field rejected that
+/// map, so each of these messages fell through to a `Custom*` variant. They are
+/// decoded from text, which is where the map comes from.
+mod arbitrary_precision {
+    use rmcp::model::{
+        ClientJsonRpcMessage, ClientNotification, ElicitRequestParams, JsonRpcMessage,
+        JsonRpcNotification, JsonRpcRequest, JsonRpcResponse, PrimitiveSchemaDefinition,
+        ServerJsonRpcMessage, ServerNotification, ServerRequest, ServerResult,
+    };
+
+    /// Decodes a server message the way a client does (`RxJsonRpcMessage<RoleClient>`).
+    fn from_server(text: &str) -> ServerJsonRpcMessage {
+        serde_json::from_str(text).unwrap()
+    }
+
+    #[test]
+    fn feature_is_enabled() {
+        // Only the feature keeps the number as written; without it this reads `0.6`.
+        let value: serde_json::Value = serde_json::from_str("0.60").unwrap();
+        assert_eq!(value.to_string(), "0.60");
+    }
+
+    #[test]
+    fn call_tool_result_with_fractional_priority() {
+        let message = from_server(
+            r#"{"jsonrpc":"2.0","id":1,"result":{"content":[
+                {"type":"text","text":"ok","annotations":{"priority":0.6}}]}}"#,
+        );
+        let JsonRpcMessage::Response(JsonRpcResponse {
+            result: ServerResult::CallToolResult(result),
+            ..
+        }) = message
+        else {
+            panic!("expected CallToolResult, got {message:?}");
+        };
+        let annotations = result.content[0].as_text().unwrap().annotations.as_ref();
+        assert_eq!(annotations.unwrap().priority, Some(0.6));
+    }
+
+    #[test]
+    fn progress_notification_with_fractional_progress() {
+        let text = r#"{"jsonrpc":"2.0","method":"notifications/progress",
+            "params":{"progressToken":"t","progress":0.5,"total":2.5}}"#;
+
+        let message = from_server(text);
+        let JsonRpcMessage::Notification(JsonRpcNotification {
+            notification: ServerNotification::ProgressNotification(notification),
+            ..
+        }) = message
+        else {
+            panic!("expected ProgressNotification, got {message:?}");
+        };
+        assert_eq!(notification.params.progress, 0.5);
+        assert_eq!(notification.params.total, Some(2.5));
+
+        let message: ClientJsonRpcMessage = serde_json::from_str(text).unwrap();
+        assert!(
+            matches!(
+                message,
+                JsonRpcMessage::Notification(JsonRpcNotification {
+                    notification: ClientNotification::ProgressNotification(_),
+                    ..
+                })
+            ),
+            "expected ProgressNotification, got {message:?}"
+        );
+    }
+
+    #[test]
+    #[expect(deprecated, reason = "sampling is deprecated by SEP-2577")]
+    fn create_message_request_with_fractional_parameters() {
+        let message = from_server(
+            r#"{"jsonrpc":"2.0","id":2,"method":"sampling/createMessage","params":{
+                "messages":[],"maxTokens":10,"temperature":0.7,"modelPreferences":{
+                "costPriority":0.2,"speedPriority":0.5,"intelligencePriority":0.9}}}"#,
+        );
+        let JsonRpcMessage::Request(JsonRpcRequest {
+            request: ServerRequest::CreateMessageRequest(request),
+            ..
+        }) = message
+        else {
+            panic!("expected CreateMessageRequest, got {message:?}");
+        };
+        assert_eq!(request.params.temperature, Some(0.7));
+        let preferences = request.params.model_preferences.unwrap();
+        assert_eq!(preferences.cost_priority, Some(0.2));
+        assert_eq!(preferences.speed_priority, Some(0.5));
+        assert_eq!(preferences.intelligence_priority, Some(0.9));
+    }
+
+    #[test]
+    fn elicit_request_with_fractional_number_schema() {
+        let message = from_server(
+            r#"{"jsonrpc":"2.0","id":3,"method":"elicitation/create","params":{
+                "mode":"form","message":"How much?","requestedSchema":{"type":"object",
+                "properties":{"amount":{"type":"number",
+                "minimum":0.5,"maximum":9.5,"default":1.5}}}}}"#,
+        );
+        let JsonRpcMessage::Request(JsonRpcRequest {
+            request: ServerRequest::ElicitRequest(request),
+            ..
+        }) = message
+        else {
+            panic!("expected ElicitRequest, got {message:?}");
+        };
+        let ElicitRequestParams::FormElicitationParams {
+            requested_schema, ..
+        } = request.params
+        else {
+            panic!("expected
```

---

### Incident Patch 8: `22ef52a2` (2026-09-25)
**Commit Message**: fix(rmcp): reject duplicate sep-2243 headers (#1274)

**File**: `crates/rmcp/src/transport/common/mcp_headers.rs` (modified, +74/-8)
```diff
@@ -268,8 +268,7 @@ pub(crate) fn validate_request_headers(
     };
     let params = request.get("params");
 
-    let header_method = header_str(headers, HEADER_MCP_METHOD);
-    match header_method {
+    match header_str(headers, HEADER_MCP_METHOD)? {
         None => return Err("missing required Mcp-Method header".to_owned()),
         Some(value) if value != method => {
             return Err(format!(
@@ -280,7 +279,7 @@ pub(crate) fn validate_request_headers(
     }
 
     if let Some(expected) = extract_name(method, params) {
-        match header_str(headers, HEADER_MCP_NAME) {
+        match header_str(headers, HEADER_MCP_NAME)? {
             None => return Err(format!("missing required Mcp-Name header for `{method}`")),
             Some(raw) => {
                 let decoded = decode_header_value(raw)
@@ -300,7 +299,7 @@ pub(crate) fn validate_request_headers(
         let arguments = params.and_then(|p| p.get("arguments"));
         for (prop, header) in param_header_annotations(schema) {
             let full = format!("{HEADER_MCP_PARAM_PREFIX}{header}");
-            let header_value = header_str(headers, &full);
+            let header_value = header_str(headers, &full)?;
             let arg = arguments.and_then(|a| a.get(&prop));
             let body_value = arg.filter(|v| !v.is_null()).and_then(primitive_to_string);
 
@@ -329,10 +328,21 @@ pub(crate) fn validate_request_headers(
     Ok(())
 }
 
-/// Case-insensitive header lookup returning the value as `&str`, if present and valid UTF-8.
+/// The sole value for `name` as `&str`, if present and valid UTF-8.
+///
+/// Errors when `name` appears more than once: these headers are singletons, and
+/// letting one through would let an intermediary that resolves duplicates
+/// differently route on a value this request never dispatches.
 #[cfg(feature = "server-side-http")]
-fn header_str<'a>(headers: &'a http::HeaderMap, name: &str) -> Option<&'a str> {
-    headers.get(name).and_then(|value| value.to_str().ok())
+fn header_str<'a>(headers: &'a http::HeaderMap, name: &str) -> Result<Option<&'a str>, String> {
+    let mut values = headers.get_all(name).iter();
+    let Some(value) = values.next() else {
+        return Ok(None);
+    };
+    if values.next().is_some() {
+        return Err(format!("duplicate {name} header"));
+    }
+    Ok(value.to_str().ok())
 }
 
 #[cfg(all(test, feature = "client-side-sse", feature = "server-side-http"))]
@@ -354,7 +364,8 @@ mod tests {
     fn header_map(pairs: &[(&str, &str)]) -> HeaderMap {
         let mut map = HeaderMap::new();
         for (name, value) in pairs {
-            map.insert(
+            // Append, not insert, so repeated names survive as duplicates.
+            map.append(
                 HeaderName::from_bytes(name.as_bytes()).unwrap(),
                 HeaderValue::from_str(value).unwrap(),
             );
@@ -621,6 +632,26 @@ mod tests {
             assert!(validate_request_headers(&headers, &tools_call_request(), None).is_err());
         }
 
+        #[test]
+        fn rejects_duplicate_method() {
+            let headers = header_map(&[
+                ("Mcp-Method", "tools/call"),
+                ("Mcp-Method", "tools/list"),
+                ("Mcp-Name", "deploy"),
+            ]);
+            assert!(validate_request_headers(&headers, &tools_call_request(), None).is_err());
+        }
+
+        #[test]
+        fn rejects_duplicate_name() {
+            let headers = header_map(&[
+                ("Mcp-Method", "tools/call"),
+                ("Mcp-Name", "deploy"),
+                ("Mcp-Name", "other"),
+            ]);
+            assert!(validate_request_headers(&headers, &tools_call_request(), None).is_err());
+        }
+
         #[test]
         fn accepts_matching_param() {
             let schema = schema_with(json!({
@@ -654,5 +685,40 @@ mod tests {
             ]);
             assert!(validate_request_headers(&headers, &request, Some(&schema)).is_err());
         }
+
+        #[test]
+        fn rejects_duplicate_param() {
+            let schema = schema_with(json!({
+                "region": { "type": "string", "x-mcp-header": "Region" },
+            }));
+            let request = json!({
+                "jsonrpc": "2.0", "id": 1, "method": "tools/call",
+                "params": { "name": "deploy", "arguments": { "region": "us-west1" } }
+            });
+            let headers = header_map(&[
+                ("Mcp-Method", "tools/call"),
+                ("Mcp-Name", "deploy"),
+                ("Mcp-Param-Region", "us-west1"),
+                ("Mcp-Param-Region", "eu-central1"),
+            ]);
+            assert!(validate_request_headers(&headers, &request, Some(&schema)).is_err());
+        }
+
+        #[test]
+        fn rejects_duplicate_param_for_absent_argument() {
+            let schema = schema_with(json!({
+                "region": { "type": "string", "x-mcp-header": "Region" },
+            }));
+            let headers =
```

---

### Incident Patch 9: `26f3b2ed` (2026-09-25)
**Commit Message**: fix(transport): match explicit default ports in Origin allowlist (#1270)

* fix(transport): match origin default ports

* feat(transport): add :* port wildcard to origins

**File**: `crates/rmcp/src/transport/streamable_http_server/tower.rs` (modified, +150/-5)
```diff
@@ -116,10 +116,18 @@ pub struct StreamableHttpServerConfig {
     /// missing-`Origin` requests still pass. Entries must include a scheme;
     /// `"null"` matches the browser's `Origin: null`.
     ///
+    /// Ports:
+    /// - `:*` matches any port.
+    /// - An explicit port matches only that port. An `Origin` without a port
+    ///   uses the scheme default (443 for `https`, 80 for `http`).
+    /// - An entry without a port currently matches any port. This is
+    ///   deprecated: a future release will match only the scheme default
+    ///   port. Use `:*` or an explicit port instead.
+    ///
     /// Call [`StreamableHttpServerConfig::enforce_origin_validation`] to enable
     /// validation with an empty list, rejecting every present Origin value.
     /// examples:
-    ///     allowed_origins = ["https://app.example.com", "http://localhost:8080"]
+    ///     allowed_origins = ["https://app.example.com:443", "http://localhost:*"]
     pub allowed_origins: Vec<String>,
     validate_empty_origin_allowlist: bool,
     /// Optional external session store for cross-instance recovery.
@@ -978,14 +986,79 @@ fn parse_origin_value(value: &str) -> Option<NormalizedOrigin> {
     })
 }
 
+/// The port a scheme implies when an origin serialization omits it (RFC 6454 §4).
+fn default_port(scheme: &str) -> Option<u16> {
+    match scheme {
+        "http" => Some(80),
+        "https" => Some(443),
+        _ => None,
+    }
+}
+
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+enum AllowedPort {
+    /// `:*`
+    Any,
+    /// No port in the entry. Matches any port until the deprecation ends.
+    Unspecified,
+    Exact(u16),
+}
+
+impl AllowedPort {
+    fn matches(self, scheme: &str, port: Option<u16>) -> bool {
+        match self {
+            AllowedPort::Any | AllowedPort::Unspecified => true,
+            // RFC 6454 §6.2 omits the default port when serializing an origin.
+            AllowedPort::Exact(allowed) => port.or_else(|| default_port(scheme)) == Some(allowed),
+        }
+    }
+}
+
+#[derive(Debug, Clone, PartialEq, Eq)]
+enum AllowedOrigin {
+    Null,
+    Tuple {
+        scheme: String,
+        host: String,
+        port: AllowedPort,
+    },
+}
+
+fn parse_allowed_origin(value: &str) -> Option<AllowedOrigin> {
+    let value = value.trim();
+    if let Some(base) = value.strip_suffix(":*") {
+        let NormalizedOrigin::Tuple {
+            scheme,
+            host,
+            port: None,
+        } = parse_origin_value(base)?
+        else {
+            return None;
+        };
+        return Some(AllowedOrigin::Tuple {
+            scheme,
+            host,
+            port: AllowedPort::Any,
+        });
+    }
+    Some(match parse_origin_value(value)? {
+        NormalizedOrigin::Null => AllowedOrigin::Null,
+        NormalizedOrigin::Tuple { scheme, host, port } => AllowedOrigin::Tuple {
+            scheme,
+            host,
+            port: port.map_or(AllowedPort::Unspecified, AllowedPort::Exact),
+        },
+    })
+}
+
 fn origin_is_allowed(origin: &NormalizedOrigin, allowed_origins: &[String]) -> bool {
     allowed_origins
         .iter()
-        .filter_map(|raw| parse_origin_value(raw))
+        .filter_map(|raw| parse_allowed_origin(raw))
         .any(|allowed| match (&allowed, origin) {
-            (NormalizedOrigin::Null, NormalizedOrigin::Null) => true,
+            (AllowedOrigin::Null, NormalizedOrigin::Null) => true,
             (
-                NormalizedOrigin::Tuple {
+                AllowedOrigin::Tuple {
                     scheme: a_scheme,
                     host: a_host,
                     port: a_port,
@@ -995,11 +1068,82 @@ fn origin_is_allowed(origin: &NormalizedOrigin, allowed_origins: &[String]) -> b
                     host: o_host,
                     port: o_port,
                 },
-            ) => a_scheme == o_scheme && a_host == o_host && (a_port.is_none() || a_port == o_port),
+            ) => a_scheme == o_scheme && a_host == o_host && a_port.matches(o_scheme, *o_port),
             _ => false,
         })
 }
 
+fn warn_on_portless_allowed_origins(allowed_origins: &[String]) {
+    for raw in allowed_origins {
+        if let Some(AllowedOrigin::Tuple {
+            port: AllowedPort::Unspecified,
+            ..
+        }) = parse_allowed_origin(raw)
+        {
+            tracing::warn!(
+                allowed_origin = raw.as_str(),
+                "allowed origin without a port matches any port; a future release will match \
+                 only the scheme default port. Use `:*` or an explicit port instead",
+            );
+        }
+    }
+}
+
+#[cfg(test)]
+mod parse_allowed_origin_tests {
+    use super::*;
+
+    fn tuple(scheme: &str, host: &str, port: AllowedPort) -> Option<AllowedOrigin> {
+        Some(AllowedOrigin::Tuple {
+            scheme: scheme.to_string(),
+            host: host.to_string(),
+            port,
+        })
+    }
+
+    #[test]
+    fn wildcard_port_parses_a
```

**File**: `crates/rmcp/tests/test_custom_headers.rs` (modified, +90/-0)
```diff
@@ -1311,4 +1311,94 @@ mod origin_validation {
         let response = service.handle(init_request(Some("null"))).await;
         assert_eq!(response.status(), http::StatusCode::FORBIDDEN);
     }
+
+    #[tokio::test]
+    async fn explicit_https_default_port_allows_port_less_origin() {
+        let service = service_with_allowed_origins(&["https://client.example:443"]);
+        let response = service
+            .handle(init_request(Some("https://client.example")))
+            .await;
+        assert_eq!(response.status(), http::StatusCode::OK);
+    }
+
+    #[tokio::test]
+    async fn explicit_http_default_port_allows_port_less_origin() {
+        let service = service_with_allowed_origins(&["http://client.example:80"]);
+        let response = service
+            .handle(init_request(Some("http://client.example")))
+            .await;
+        assert_eq!(response.status(), http::StatusCode::OK);
+    }
+
+    #[tokio::test]
+    async fn explicit_default_port_allows_matching_explicit_origin_port() {
+        let service = service_with_allowed_origins(&["https://client.example:443"]);
+        let response = service
+            .handle(init_request(Some("https://client.example:443")))
+            .await;
+        assert_eq!(response.status(), http::StatusCode::OK);
+    }
+
+    #[tokio::test]
+    async fn explicit_default_port_forbids_non_default_origin_port() {
+        let service = service_with_allowed_origins(&["https://client.example:443"]);
+        let response = service
+            .handle(init_request(Some("https://client.example:8443")))
+            .await;
+        assert_eq!(response.status(), http::StatusCode::FORBIDDEN);
+    }
+
+    #[tokio::test]
+    async fn explicit_non_default_port_forbids_port_less_origin() {
+        let service = service_with_allowed_origins(&["https://client.example:8443"]);
+        let response = service
+            .handle(init_request(Some("https://client.example")))
+            .await;
+        assert_eq!(response.status(), http::StatusCode::FORBIDDEN);
+    }
+
+    #[tokio::test]
+    async fn omitted_configured_port_allows_any_origin_port() {
+        let service = service_with_allowed_origins(&["https://client.example"]);
+        let response = service
+            .handle(init_request(Some("https://client.example:8443")))
+            .await;
+        assert_eq!(response.status(), http::StatusCode::OK);
+    }
+
+    #[tokio::test]
+    async fn wildcard_port_allows_non_default_origin_port() {
+        let service = service_with_allowed_origins(&["https://client.example:*"]);
+        let response = service
+            .handle(init_request(Some("https://client.example:8443")))
+            .await;
+        assert_eq!(response.status(), http::StatusCode::OK);
+    }
+
+    #[tokio::test]
+    async fn wildcard_port_allows_port_less_origin() {
+        let service = service_with_allowed_origins(&["https://client.example:*"]);
+        let response = service
+            .handle(init_request(Some("https://client.example")))
+            .await;
+        assert_eq!(response.status(), http::StatusCode::OK);
+    }
+
+    #[tokio::test]
+    async fn wildcard_port_forbids_other_host() {
+        let service = service_with_allowed_origins(&["https://client.example:*"]);
+        let response = service
+            .handle(init_request(Some("https://attacker.example:8443")))
+            .await;
+        assert_eq!(response.status(), http::StatusCode::FORBIDDEN);
+    }
+
+    #[tokio::test]
+    async fn wildcard_port_forbids_scheme_mismatch() {
+        let service = service_with_allowed_origins(&["https://client.example:*"]);
+        let response = service
+            .handle(init_request(Some("http://client.example:8443")))
+            .await;
+        assert_eq!(response.status(), http::StatusCode::FORBIDDEN);
+    }
 }
```

---

### Incident Patch 10: `6677eeed` (2026-09-24)
**Commit Message**: style: cargo fmt fixes on validate_standard_headers changes (#1275)

Signed-off-by: SIDDARTHA REDDY <[REDACTED_EMAIL]>

**File**: `crates/rmcp/src/transport/streamable_http_server/tower.rs` (modified, +134/-4)
```diff
@@ -39,8 +39,8 @@ use crate::{
         OneshotTransport, TransportAdapterIdentity,
         common::{
             http_header::{
-                EVENT_STREAM_MIME_TYPE, HEADER_LAST_EVENT_ID, HEADER_MCP_PROTOCOL_VERSION,
-                HEADER_SESSION_ID, JSON_MIME_TYPE,
+                EVENT_STREAM_MIME_TYPE, HEADER_LAST_EVENT_ID, HEADER_MCP_METHOD,
+                HEADER_MCP_PROTOCOL_VERSION, HEADER_SESSION_ID, JSON_MIME_TYPE,
             },
             mcp_headers,
             server_side_http::{
@@ -690,6 +690,99 @@ mod jsonrpc_http_status_tests {
     }
 }
 
+#[cfg(test)]
+mod standard_header_init_tests {
+    use super::*;
+
+    fn initialize_message() -> ClientJsonRpcMessage {
+        ClientJsonRpcMessage::request(
+            ClientRequest::InitializeRequest(InitializeRequest {
+                params: InitializeRequestParams {
+                    protocol_version: ProtocolVersion::STANDARD_HEADERS,
+                    ..Default::default()
+                },
+                ..Default::default()
+            }),
+            RequestId::Number(1),
+        )
+    }
+
+    fn headers_with(mcp_method: Option<&str>) -> HeaderMap {
+        let mut headers = HeaderMap::new();
+        headers.insert(
+            HEADER_MCP_PROTOCOL_VERSION,
+            http::HeaderValue::from_static(ProtocolVersion::STANDARD_HEADERS.as_str()),
+        );
+        if let Some(method) = mcp_method {
+            headers.insert(
+                HEADER_MCP_METHOD,
+                method.parse::<http::HeaderValue>().unwrap(),
+            );
+        }
+        headers
+    }
+
+    fn no_tool_schema(_: &str) -> Option<Arc<JsonObject>> {
+        None
+    }
+
+    /// A supplied Mcp-Method header contradicting an initialize body must be
+    /// rejected at >= STANDARD_HEADERS. Regression test for
+    /// https://github.com/modelcontextprotocol/rust-sdk/issues/1271
+    #[test]
+    fn initialize_rejects_contradicting_mcp_method_header() {
+        let headers = headers_with(Some("tools/list"));
+        assert!(
+            validate_standard_headers(&headers, &initialize_message(), no_tool_schema).is_err()
+        );
+    }
+
+    /// Absence of the Mcp-Method header on initialize stays accepted: clients
+    /// emit SEP-2243 headers only after the version has been negotiated.
+    #[test]
+    fn initialize_accepts_missing_mcp_method_header() {
+        let headers = headers_with(None);
+        assert!(validate_standard_headers(&headers, &initialize_message(), no_tool_schema).is_ok());
+    }
+
+    /// A supplied Mcp-Method header matching the initialize body is accepted.
+    #[test]
+    fn initialize_accepts_matching_mcp_method_header() {
+        let headers = headers_with(Some("initialize"));
+        assert!(validate_standard_headers(&headers, &initialize_message(), no_tool_schema).is_ok());
+    }
+
+    /// Conflicting duplicate Mcp-Method values are rejected in both orders:
+    /// only the first value used to be checked, so an appended contradictory
+    /// value passed silently. Duplicate values are rejected explicitly.
+    #[test]
+    fn initialize_rejects_conflicting_duplicates_in_both_orders() {
+        for (first, second) in [("initialize", "tools/list"), ("tools/list", "initialize")] {
+            let mut headers = headers_with(Some(first));
+            headers.append(
+                HEADER_MCP_METHOD,
+                http::HeaderValue::from_str(second).unwrap(),
+            );
+            assert!(
+                validate_standard_headers(&headers, &initialize_message(), no_tool_schema).is_err()
+            );
+        }
+    }
+
+    /// A present but non-UTF8 Mcp-Method value is rejected: it must not be
+    /// silently treated as an absent header.
+    #[test]
+    fn initialize_rejects_present_non_text_method() {
+        let mut headers = headers_with(None);
+        let value = http::HeaderValue::from_bytes(&[0xff]).unwrap();
+        assert!(value.to_str().is_err());
+        headers.insert(HEADER_MCP_METHOD, value);
+        assert!(
+            validate_standard_headers(&headers, &initialize_message(), no_tool_schema).is_err()
+        );
+    }
+}
+
 fn jsonrpc_message_response(
     message: ServerJsonRpcMessage,
     map_protocol_status: bool,
@@ -724,8 +817,11 @@ fn header_mismatch_jsonrpc_response(
 /// Validates SEP-2243 `Mcp-Method` / `Mcp-Name` / `Mcp-Param-*` headers against the body.
 ///
 /// Only enforced when the request declares a protocol version `>= STANDARD_HEADERS`.
-/// The `initialize` handshake is exempt: clients emit these headers only after the
-/// version has been negotiated. `tool_schema` supplies the called tool's input schema
+/// The `initialize` handshake is exempt from *requiring* them: clients emit these
+/// headers only after the version has been negotiated. But like
+/// `validate_header_matches_init_body`, a *supplied* `Mcp-Method` header that
+/// contradicts the body is rejected — middleboxes route on the header without
```

**File**: `crates/rmcp/tests/test_streamable_http_standard_headers.rs` (modified, +86/-0)
```diff
@@ -313,3 +313,89 @@ async fn rejects_missing_param_header_with_32020() -> anyhow::Result<()> {
     ct.cancel();
     Ok(())
 }
+
+/// Spawns the server in legacy session mode: the initialize handshake creates
+/// a real session, exercising the path where the validator used to be bypassed.
+async fn spawn_legacy_server() -> (reqwest::Client, String, CancellationToken) {
+    let config = StreamableHttpServerConfig::default()
+        .with_legacy_session_mode(true)
+        .with_json_response(true)
+        .with_sse_keep_alive(None)
+        .with_cancellation_token(CancellationToken::new());
+    let ct = config.cancellation_token.clone();
+    let service: StreamableHttpService<HeaderValidationServer, LocalSessionManager> =
+        StreamableHttpService::new(|| Ok(HeaderValidationServer), Default::default(), config);
+
+    let router = axum::Router::new().nest_service("/mcp", service);
+    let tcp_listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
+    let addr = tcp_listener.local_addr().unwrap();
+    tokio::spawn({
+        let ct = ct.clone();
+        async move {
+            let _ = axum::serve(tcp_listener, router)
+                .with_graceful_shutdown(async move { ct.cancelled_owned().await })
+                .await;
+        }
+    });
+    (reqwest::Client::new(), format!("http://{addr}/mcp"), ct)
+}
+
+/// POSTs an `initialize` request with the given protocol version and optional
+/// `Mcp-Method` header.
+async fn post_initialize(
+    client: &reqwest::Client,
+    url: &str,
+    version: &str,
+    mcp_method: Option<&str>,
+) -> reqwest::Response {
+    let body = serde_json::json!({
+        "jsonrpc": "2.0",
+        "id": 1,
+        "method": "initialize",
+        "params": {
+            "protocolVersion": version,
+            "capabilities": {},
+            "clientInfo": { "name": "test", "version": "1.0" },
+        }
+    });
+    let mut req = client
+        .post(url)
+        .header("Content-Type", "application/json")
+        .header("Accept", "application/json, text/event-stream")
+        .header("MCP-Protocol-Version", version)
+        .body(body.to_string());
+    if let Some(method) = mcp_method {
+        req = req.header("Mcp-Method", method);
+    }
+    req.send().await.expect("send initialize request")
+}
+
+#[tokio::test]
+async fn rejects_initialize_with_contradicting_mcp_method_before_session_creation()
+-> anyhow::Result<()> {
+    let (client, url, ct) = spawn_legacy_server().await;
+
+    // Regression test: in legacy session mode with no session id, an
+    // `initialize` body carrying a contradictory `Mcp-Method` header used to
+    // bypass the validator, returning HTTP 200 and creating a session.
+    let response = post_initialize(&client, &url, SEP_VERSION, Some("tools/list")).await;
+    assert_eq!(response.status(), 400);
+    let body: serde_json::Value = response.json().await?;
+    assert_eq!(body["error"]["code"], -32020);
+
+    ct.cancel();
+    Ok(())
+}
+
+#[tokio::test]
+async fn accepts_initialize_with_matching_mcp_method() -> anyhow::Result<()> {
+    let (client, url, ct) = spawn_legacy_server().await;
+
+    // A matching Mcp-Method header on initialize passes validation and the
+    // handshake completes (HTTP 200, session created).
+    let response = post_initialize(&client, &url, SEP_VERSION, Some("initialize")).await;
+    assert_eq!(response.status(), 200);
+
+    ct.cancel();
+    Ok(())
+}
```

---

### Incident Patch 11: `fbed4476` (2026-09-24)
**Commit Message**: fix(rmcp): tolerate empty cacheScope instead of silently dropping the whole result (#1281)

* fix(rmcp): tolerate empty cacheScope instead of silently dropping the whole result

ListToolsResult/ReadResourceResult.cache_scope: Option<CacheScope> had no
custom deserializer, unlike the sibling ttl_ms field, which already
tolerates out-of-range input via deserialize_ttl_ms. A server sending
cacheScope: "" (SEP-2549 only permits "public"/"private"/absent) failed
deserialization of the whole result - and because ServerResult is
#[serde(untagged)], that failure doesn't surface as an error. It falls
through variant-by-variant to CustomResult (the catch-all), so callers
silently lose typed access to .tools/.contents instead of getting a clear
error or a usable result.

Add deserialize_cache_scope, mirroring the existing deserialize_ttl_ms
normalize-don't-error pattern: "" and null are treated as absent,
everything else delegates to CacheScope's normal deserialization, so a
genuinely invalid value (e.g. "PUBLIC") still errors - it just no longer
takes the whole result down with it.

Add a regression test covering both direct ListToolsResult deserialization
and the full ServerResult untagged 

**File**: `crates/rmcp/src/model.rs` (modified, +31/-2)
```diff
@@ -1660,6 +1660,27 @@ where
     Ok(value.map(|ttl_ms| ttl_ms.max(0) as u64))
 }
 
+/// Normalize a `cacheScope` value during deserialization.
+///
+/// Per SEP-2549, `cacheScope` MUST be `"public"`, `"private"`, or absent; some
+/// servers instead send `""`. Because `ServerResult` is `#[serde(untagged)]`,
+/// letting that value hard-error here would silently fall through to
+/// `CustomResult` and drop the entire (otherwise valid) result. Treat an empty
+/// string the same as an absent field rather than erroring.
+fn deserialize_cache_scope<'de, D>(deserializer: D) -> Result<Option<CacheScope>, D::Error>
+where
+    D: serde::Deserializer<'de>,
+{
+    let value = Option::<Value>::deserialize(deserializer)?;
+    match value {
+        None | Some(Value::Null) => Ok(None),
+        Some(Value::String(s)) if s.is_empty() => Ok(None),
+        Some(value) => CacheScope::deserialize(value)
+            .map(Some)
+            .map_err(serde::de::Error::custom),
+    }
+}
+
 macro_rules! paginated_result {
     ($t:ident {
         $i_item: ident: $t_item: ty
@@ -1697,7 +1718,11 @@ macro_rules! paginated_result {
             /// Scope describing who may cache this result (SEP-2549).
             /// Required by spec version 2026-07-28, but optional here to maintain compatibility
             /// with older spec versions.
-            #[serde(default, skip_serializing_if = "Option::is_none")]
+            #[serde(
+                default,
+                deserialize_with = "deserialize_cache_scope",
+                skip_serializing_if = "Option::is_none"
+            )]
             pub cache_scope: Option<CacheScope>,
             pub $i_item: $t_item,
         }
@@ -1847,7 +1872,11 @@ pub struct ReadResourceResult {
     /// Scope describing who may cache this result (SEP-2549).
     /// Required by spec version 2026-07-28, but optional here to maintain compatibility
     /// with older spec versions.
-    #[serde(default, skip_serializing_if = "Option::is_none")]
+    #[serde(
+        default,
+        deserialize_with = "deserialize_cache_scope",
+        skip_serializing_if = "Option::is_none"
+    )]
     pub cache_scope: Option<CacheScope>,
     /// The actual content of the resource
     pub contents: Vec<ResourceContents>,
```

**File**: `crates/rmcp/tests/test_cache_hints.rs` (modified, +28/-1)
```diff
@@ -1,6 +1,33 @@
-use rmcp::model::{CacheScope, ListToolsResult, ReadResourceResult, ResourceContents};
+use rmcp::model::{
+    CacheScope, ListToolsResult, ReadResourceResult, ResourceContents, ServerResult,
+};
 use serde_json::json;
 
+#[test]
+fn repro_empty_cache_scope_drops_every_tool_via_untagged_fallthrough() {
+    let payload = json!({
+        "tools": [{ "name": "search", "inputSchema": { "type": "object" } }],
+        "cacheScope": ""
+    });
+
+    let direct = serde_json::from_value::<ListToolsResult>(payload.clone());
+    assert!(
+        direct.is_ok(),
+        "ListToolsResult itself must accept an empty cacheScope, got {direct:?}"
+    );
+    assert_eq!(direct.unwrap().tools.len(), 1);
+
+    let via_server_result: ServerResult =
+        serde_json::from_value(payload).expect("ServerResult must deserialize this payload");
+    match via_server_result {
+        ServerResult::ListToolsResult(r) => assert_eq!(r.tools.len(), 1),
+        other => panic!(
+            "expected ListToolsResult, got {other:?} \
+             (untagged fallthrough silently reinterpreted a valid tools/list result)"
+        ),
+    }
+}
+
 #[test]
 fn paginated_results_serialize_cache_hints_as_top_level_fields() {
     let result = ListToolsResult::with_all_items(Vec::new())
```

---

### Incident Patch 12: `90516bf4` (2026-09-24)
**Commit Message**: fix(model): preserve explicit null structuredContent in CallToolResult (#1295)

The MCP 2026-07-28 spec allows `structuredContent` to be any JSON value,
including `null`. Deserializing `CallToolResult` collapsed a present
`"structuredContent": null` into `None`, the same as an absent field, and
rejected `{"resultType":"complete","structuredContent":null}` because no
known non-null field was left.

Decode a present `structuredContent` as `Some(value)`, so an explicit
`null` becomes `Some(Value::Null)` and counts as a known field. An absent
field still decodes as `None`, and serialization still omits only `None`.

Signed-off-by: Jean-Marc Le Roux <[REDACTED_EMAIL]>

**File**: `crates/rmcp/src/model.rs` (modified, +15/-1)
```diff
@@ -3862,6 +3862,15 @@ pub type ElicitRequest = Request<ElicitationCreateRequestMethod, ElicitRequestPa
 // TOOL EXECUTION RESULTS
 // =============================================================================
 
+/// Deserialize a field that is present on the wire as `Some`, even when its
+/// value is `null`. Combined with `#[serde(default)]`, an absent field stays `None`.
+fn deserialize_present_value<'de, D>(deserializer: D) -> Result<Option<Value>, D::Error>
+where
+    D: serde::Deserializer<'de>,
+{
+    Value::deserialize(deserializer).map(Some)
+}
+
 /// The result of a tool call operation.
 ///
 /// Contains the content returned by the tool execution and an optional
@@ -3886,7 +3895,9 @@ pub struct CallToolResult {
     /// The content returned by the tool (text, images, etc.)
     #[serde(default)]
     pub content: Vec<ContentBlock>,
-    /// An optional JSON object that represents the structured result of the tool call
+    /// An optional JSON value that represents the structured result of the tool call.
+    /// It can be any JSON value, including `null`; an explicit `null` is kept
+    /// distinct from an absent field.
     #[serde(skip_serializing_if = "Option::is_none")]
     pub structured_content: Option<Value>,
     /// Whether this result represents an error condition
@@ -3903,6 +3914,8 @@ pub struct CallToolResult {
 //    greedily match arbitrary JSON objects when used inside `#[serde(untagged)]` enums
 //    (e.g. `ServerResult`), which would shadow `CustomResult`.
 // 3. Rejects non-`complete` result types so other `ServerResult` variants can match.
+// 4. Keeps a present `"structuredContent": null` as `Some(Value::Null)`, distinct
+//    from an absent field, since structured content can be any JSON value.
 impl<'de> Deserialize<'de> for CallToolResult {
     fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
     where
@@ -3914,6 +3927,7 @@ impl<'de> Deserialize<'de> for CallToolResult {
             #[serde(default)]
             result_type: Option<ResultType>,
             content: Option<Vec<ContentBlock>>,
+            #[serde(default, deserialize_with = "deserialize_present_value")]
             structured_content: Option<Value>,
             is_error: Option<bool>,
             #[serde(rename = "_meta")]
```

**File**: `crates/rmcp/tests/test_deserialization.rs` (modified, +35/-0)
```diff
@@ -70,6 +70,41 @@ mod untagged_server_result {
         );
     }
 
+    #[test]
+    fn call_tool_result_with_null_structured_content_deserializes_to_correct_variant() {
+        for payload in [
+            json!({
+                "resultType": "complete",
+                "content": [],
+                "structuredContent": null
+            }),
+            json!({
+                "resultType": "complete",
+                "structuredContent": null
+            }),
+            json!({ "structuredContent": null }),
+        ] {
+            let result = parse_result(wrap_response(payload.clone()));
+            let ServerResult::CallToolResult(result) = result else {
+                panic!("{payload} should deserialize as CallToolResult, got {result:?}");
+            };
+            assert_eq!(result.structured_content, Some(serde_json::Value::Null));
+        }
+    }
+
+    #[test]
+    fn null_structured_content_does_not_shadow_custom_result() {
+        // Counting a present `structuredContent: null` as a known field must not
+        // make CallToolResult swallow other objects carrying only null values.
+        let result = parse_result(wrap_response(json!({
+            "somethingElse": null
+        })));
+        assert!(
+            matches!(result, ServerResult::CustomResult(_)),
+            "expected CustomResult, got {result:?}"
+        );
+    }
+
     #[test]
     fn input_required_result_with_meta_deserializes_to_correct_variant() {
         let result = parse_result(wrap_response(json!({
```

**File**: `crates/rmcp/tests/test_message_schema/server_json_rpc_message_schema.json` (modified, +1/-1)
```diff
@@ -210,7 +210,7 @@
           ]
         },
         "structuredContent": {
-          "description": "An optional JSON object that represents the structured result of the tool call"
+          "description": "An optional JSON value that represents the structured result of the tool call.\nIt can be any JSON value, including `null`; an explicit `null` is kept\ndistinct from an absent field."
         }
       }
     },
```

**File**: `crates/rmcp/tests/test_structured_output.rs` (modified, +49/-0)
```diff
@@ -386,6 +386,55 @@ fn test_call_tool_result_deserialize_without_content() {
     assert!(result.structured_content.is_some());
 }
 
+/// Per the 2026-07-28 spec, `structuredContent` can be any JSON value,
+/// including `null`. A present `null` must stay distinct from an absent field.
+#[test]
+fn test_explicit_null_structured_content_is_preserved() {
+    let json = json!({
+        "resultType": "complete",
+        "content": [],
+        "structuredContent": null
+    });
+    let result: CallToolResult = serde_json::from_value(json).unwrap();
+    assert_eq!(result.structured_content, Some(Value::Null));
+}
+
+#[test]
+fn test_explicit_null_structured_content_without_content_deserializes() {
+    let json = json!({
+        "resultType": "complete",
+        "structuredContent": null
+    });
+    let result: CallToolResult = serde_json::from_value(json).unwrap();
+    assert!(result.content.is_empty());
+    assert_eq!(result.structured_content, Some(Value::Null));
+}
+
+#[test]
+fn test_absent_structured_content_is_none() {
+    let json = json!({
+        "resultType": "complete",
+        "content": []
+    });
+    let result: CallToolResult = serde_json::from_value(json).unwrap();
+    assert_eq!(result.structured_content, None);
+}
+
+#[test]
+fn test_null_structured_content_serialization_roundtrip() {
+    let with_null = CallToolResult::structured(Value::Null);
+    let v = serde_json::to_value(&with_null).unwrap();
+    assert_eq!(v.get("structuredContent"), Some(&Value::Null));
+    let deserialized: CallToolResult = serde_json::from_value(v).unwrap();
+    assert_eq!(deserialized, with_null);
+
+    let absent = CallToolResult::success(vec![]);
+    let v = serde_json::to_value(&absent).unwrap();
+    assert!(v.get("structuredContent").is_none());
+    let deserialized: CallToolResult = serde_json::from_value(v).unwrap();
+    assert_eq!(deserialized.structured_content, None);
+}
+
 #[tokio::test]
 async fn test_tool_with_array_output_schema() {
     let server = TestServer::new();
```

---

### Incident Patch 13: `71e30818` (2026-09-22)
**Commit Message**: fix(transport): fall back after JSON discover rejections (#1288)

Check the discover fallback before the JSON-RPC error branch, or middleware
rejections with an uncorrelated id abort the handshake instead of falling back
to legacy `initialize`.

**File**: `crates/rmcp/src/transport/common/reqwest/streamable_http_client.rs` (modified, +7/-5)
```diff
@@ -280,6 +280,13 @@ impl StreamableHttpClient for reqwest::Client {
                 .text()
                 .await
                 .unwrap_or_else(|_| "<failed to read response body>".to_owned());
+            // Must precede the JSON-RPC branch below, which would forward a
+            // discover rejection with an id the lifecycle cannot correlate.
+            if let Some(response) =
+                legacy_discover_response(&message, session_was_attached, status, &body)
+            {
+                return Ok(response);
+            }
             if content_type
                 .as_deref()
                 .is_some_and(|ct| ct.as_bytes().starts_with(JSON_MIME_TYPE.as_bytes()))
@@ -293,11 +300,6 @@ impl StreamableHttpClient for reqwest::Client {
                     ),
                 }
             }
-            if let Some(response) =
-                legacy_discover_response(&message, session_was_attached, status, &body)
-            {
-                return Ok(response);
-            }
             return Err(StreamableHttpError::UnexpectedServerResponse(Cow::Owned(
                 format!("HTTP {status}: {body}"),
             )));
```

**File**: `crates/rmcp/src/transport/streamable_http_client.rs` (modified, +15/-8)
```diff
@@ -362,11 +362,15 @@ impl StreamableHttpPostResponse {
 }
 
 /// Convert a sessionless discovery rejection into a response the lifecycle
-/// layer can classify as a legacy-server signal.
+/// layer can classify. The server's own JSON-RPC error is preserved so the
+/// lifecycle can tell a modern rejection (retry at a supported version) from a
+/// legacy one; `invalid_request` is synthesized only when the body has no error
+/// to keep, as with an empty or plain-text 4xx from middleware.
+///
+/// The id is re-correlated because such middleware rejections cannot echo it
+/// (the Python SDK sends the literal `"server-error"`); otherwise the lifecycle
+/// discards the response as uncorrelated without classifying it.
 ///
-/// Some legacy streamable-HTTP servers reject `server/discover` in middleware
-/// before it reaches JSON-RPC dispatch. Their response may be an empty or
-/// plain-text 4xx, so there is no JSON-RPC error for the client to forward.
 /// Keep authentication failures and server errors on their original paths.
 pub(super) fn legacy_discover_response(
     message: &ClientJsonRpcMessage,
@@ -388,10 +392,13 @@ pub(super) fn legacy_discover_response(
         return None;
     }
 
-    let error = ErrorData::invalid_request(
-        format!("server/discover rejected with HTTP {status}: {body}"),
-        None,
-    );
+    let error = match serde_json::from_str::<ServerJsonRpcMessage>(body) {
+        Ok(ServerJsonRpcMessage::Error(error)) => error.error,
+        _ => ErrorData::invalid_request(
+            format!("server/discover rejected with HTTP {status}: {body}"),
+            None,
+        ),
+    };
     Some(StreamableHttpPostResponse::Json(
         ServerJsonRpcMessage::error(error, Some(request.id.clone())),
         None,
```

**File**: `crates/rmcp/tests/test_discover_http_client_startup.rs` (modified, +107/-0)
```diff
@@ -236,3 +236,110 @@ async fn auto_http_client_falls_back_after_plain_text_4xx_rejection() {
     ct.cancel();
     server.await.expect("server task");
 }
+
+#[derive(Clone, Default)]
+struct VersionNegotiatingHttpState {
+    methods: Arc<Mutex<Vec<String>>>,
+}
+
+/// Rejects the first probe with a 4xx `UnsupportedProtocolVersionError` carrying
+/// an uncorrelated `id`, as a middleware rejection would. Accepts the retry.
+async fn version_negotiating_http_handler(
+    State(state): State<VersionNegotiatingHttpState>,
+    body: Bytes,
+) -> Response<Body> {
+    let request: serde_json::Value = serde_json::from_slice(&body).expect("valid JSON-RPC body");
+    let method = request["method"]
+        .as_str()
+        .expect("request method")
+        .to_owned();
+    state.methods.lock().await.push(method.clone());
+
+    if method == "server/discover" {
+        if state.methods.lock().await.len() == 1 {
+            return Response::builder()
+                .status(StatusCode::BAD_REQUEST)
+                .header("content-type", "application/json")
+                .body(Body::from(
+                    json!({
+                        "jsonrpc": "2.0",
+                        "id": "server-error",
+                        "error": {
+                            "code": -32022,
+                            "message": "Unsupported protocol version",
+                            "data": {"supported": ["2025-11-25"]}
+                        }
+                    })
+                    .to_string(),
+                ))
+                .expect("build version rejection response");
+        }
+
+        let result = DiscoverResult::new(vec![ProtocolVersion::V_2025_11_25], Default::default());
+        return Response::builder()
+            .status(StatusCode::OK)
+            .header("content-type", "application/json")
+            .body(Body::from(
+                json!({
+                    "jsonrpc": "2.0",
+                    "id": request["id"],
+                    "result": result,
+                })
+                .to_string(),
+            ))
+            .expect("build discover response");
+    }
+
+    panic!("modern server must not be asked for {method}");
+}
+
+/// A recognized modern error in a 4xx discover rejection identifies a modern
+/// server, so the client retries at a supported version instead of falling back
+/// to legacy `initialize`.
+#[tokio::test]
+async fn auto_http_client_retries_version_after_modern_4xx_rejection() {
+    let ct = CancellationToken::new();
+    let state = VersionNegotiatingHttpState::default();
+    let methods = state.methods.clone();
+    let router = Router::new()
+        .route("/mcp", post(version_negotiating_http_handler))
+        .with_state(state);
+    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
+        .await
+        .expect("listener should bind");
+    let address = listener.local_addr().expect("listener address");
+    let server = tokio::spawn({
+        let ct = ct.clone();
+        async move {
+            let _ = axum::serve(listener, router)
+                .with_graceful_shutdown(async move { ct.cancelled_owned().await })
+                .await;
+        }
+    });
+
+    let transport = StreamableHttpClientTransport::from_config(
+        StreamableHttpClientTransportConfig::with_uri(format!("http://{address}/mcp")),
+    );
+    let client = ClientConfig::default()
+        .serve_with_lifecycle(
+            transport,
+            ClientLifecycleMode::Auto {
+                preferred_versions: vec![
+                    ProtocolVersion::V_2026_07_28,
+                    ProtocolVersion::V_2025_11_25,
+                ],
+                legacy_version: Some(ProtocolVersion::V_2025_11_25),
+            },
+        )
+        .await
+        .expect("auto HTTP client should retry discover at a supported version");
+    client.cancel().await.expect("cancel client");
+
+    assert_eq!(
+        methods.lock().await.as_slice(),
+        &["server/discover", "server/discover"],
+        "expected a version-negotiation retry, not a legacy fallback"
+    );
+    ct.cancel();
+    server.await.expect("server task");
+}
```

---

### Incident Patch 14: `16d2186b` (2026-09-22)
**Commit Message**: fix(macros): accept const paths and concat! in tool/prompt descriptions (#1243)

* fix(macros): accept const paths and concat! in tool/prompt descriptions

The description field of #[tool] and #[prompt] only accepted a bare
string literal, while #[doc] on the same item accepts include_str! and
#[schemars] on the argument struct accepts const paths. Parse the field
as an expression through darling's PreservedStrExpr, which keeps a
string literal a literal, so a const path or concat! now works too.

Fixes #1175

* docs: record that tool and prompt descriptions accept non-literal exprs

The rustdoc usage tables still typed description as String after the
attribute began accepting const paths and concat!.

**File**: `crates/rmcp-macros/src/lib.rs` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@ mod tool_router;
 /// | field             | type                       | usage |
 /// | :-                | :-                         | :-    |
 /// | `name`            | `String`                   | The name of the tool. If not provided, it defaults to the function name. |
-/// | `description`     | `String`                   | A description of the tool. The document of this function will be used. |
+/// | `description`     | `Expr`                     | A description of the tool. A string literal or an expression that evaluates to a `&'static str`. The document of this function will be used if not provided. |
 /// | `input_schema`    | `Expr`                     | A JSON Schema object defining the expected parameters for the tool. If not provide, if will use the json schema of its argument with type `Parameters<T>` |
 /// | `annotations`     | `ToolAnnotationsAttribute` | Additional tool information. Defaults to `None`. |
 ///
@@ -240,7 +240,7 @@ pub fn tool_handler(attr: TokenStream, input: TokenStream) -> TokenStream {
 /// | field             | type     | usage |
 /// | :-                | :-       | :-    |
 /// | `name`            | `String` | The name of the prompt. If not provided, it defaults to the function name. |
-/// | `description`     | `String` | A description of the prompt. The document of this function will be used if not provided. |
+/// | `description`     | `Expr`   | A description of the prompt. A string literal or an expression that evaluates to a `&'static str`. The document of this function will be used if not provided. |
 /// | `arguments`       | `Expr`   | An expression that evaluates to `Option<Vec<PromptArgument>>` defining the prompt's arguments. If not provided, it will automatically generate arguments from the `Parameters<T>` type found in the function signature. |
 ///
 /// ## Example
```

**File**: `crates/rmcp-macros/src/prompt.rs` (modified, +4/-7)
```diff
@@ -1,5 +1,5 @@
 use darling::{FromMeta, ast::NestedMeta};
-use proc_macro2::{Span, TokenStream};
+use proc_macro2::TokenStream;
 use quote::{format_ident, quote};
 use syn::{Expr, Ident, ImplItemFn, ReturnType};
 
@@ -13,7 +13,7 @@ pub struct PromptAttribute {
     /// Human readable title of prompt
     pub title: Option<String>,
     /// Optional description of what the prompt does
-    pub description: Option<String>,
+    pub description: Option<darling::util::PreservedStrExpr>,
     /// Arguments that can be passed to the prompt
     pub arguments: Option<Expr>,
     /// Optional icons for the prompt
@@ -104,11 +104,8 @@ pub fn prompt(attr: TokenStream, input: TokenStream) -> syn::Result<TokenStream>
     };
 
     let name = attribute.name.unwrap_or_else(|| fn_ident.to_string());
-    let description = if let Some(s) = attribute.description {
-        Some(Expr::Lit(syn::ExprLit {
-            attrs: Vec::new(),
-            lit: syn::Lit::Str(syn::LitStr::new(&s, Span::call_site())),
-        }))
+    let description = if let Some(description) = attribute.description {
+        Some(description.into())
     } else {
         fn_item.attrs.iter().try_fold(None, extract_doc_line)?
     };
```

**File**: `crates/rmcp-macros/src/tool.rs` (modified, +6/-10)
```diff
@@ -1,7 +1,7 @@
 use darling::{FromMeta, ast::NestedMeta};
-use proc_macro2::{Span, TokenStream};
+use proc_macro2::TokenStream;
 use quote::{ToTokens, format_ident, quote};
-use syn::{Expr, Ident, ImplItemFn, LitStr, ReturnType, parse_quote};
+use syn::{Expr, Ident, ImplItemFn, ReturnType, parse_quote};
 
 use crate::common::extract_doc_line;
 
@@ -65,7 +65,7 @@ pub struct ToolAttribute {
     pub name: Option<String>,
     /// Human readable title of tool
     pub title: Option<String>,
-    pub description: Option<String>,
+    pub description: Option<darling::util::PreservedStrExpr>,
     /// A JSON Schema object defining the expected parameters for the tool
     pub input_schema: Option<Expr>,
     /// An optional JSON Schema object defining the structure of the tool's output
@@ -255,13 +255,9 @@ pub fn tool(attr: TokenStream, input: TokenStream) -> syn::Result<TokenStream> {
         }
     });
 
-    let description_expr = if let Some(s) = attribute.description {
-        Some(Expr::Lit(syn::ExprLit {
-            attrs: Vec::new(),
-            lit: syn::Lit::Str(LitStr::new(&s, Span::call_site())),
-        }))
-    } else {
-        fn_item.attrs.iter().try_fold(None, extract_doc_line)?
+    let description_expr = match attribute.description {
+        Some(description) => Some(description.into()),
+        None => fn_item.attrs.iter().try_fold(None, extract_doc_line)?,
     };
     let resolved_tool_attr = ResolvedToolAttribute {
         name: attribute.name.unwrap_or_else(|| fn_ident.to_string()),
```

**File**: `crates/rmcp/tests/test_prompt_macros.rs` (modified, +16/-0)
```diff
@@ -71,8 +71,15 @@ impl Server {
             "This is a prompt with no parameters.".to_string(),
         )]
     }
+
+    #[prompt(description = CONST_PROMPT_DESCRIPTION)]
+    async fn const_description_prompt(&self) -> Vec<PromptMessage> {
+        vec![]
+    }
 }
 
+const CONST_PROMPT_DESCRIPTION: &str = "Prompt description from a const";
+
 // define generic service trait
 pub trait DataService: Send + Sync + 'static {
     fn get_context(&self) -> String;
@@ -153,6 +160,15 @@ async fn test_prompt_macros_with_empty_param() {
     );
 }
 
+#[test]
+fn test_prompt_description_accepts_const_expr() {
+    let prompt = Server::const_description_prompt_prompt_attr();
+    assert_eq!(
+        prompt.description.as_deref(),
+        Some(CONST_PROMPT_DESCRIPTION)
+    );
+}
+
 #[tokio::test]
 async fn test_prompt_macros_with_generics() {
     let mock_service = MockDataService;
```

**File**: `crates/rmcp/tests/test_tool_macros.rs` (modified, +17/-0)
```diff
@@ -61,6 +61,23 @@ impl Server {
 
     #[tool]
     async fn empty_param(&self) {}
+
+    #[tool(description = CONST_TOOL_DESCRIPTION)]
+    async fn const_description_tool(&self) {}
+
+    #[tool(description = concat!("part-a-", "part-b"))]
+    async fn concat_description_tool(&self) {}
+}
+
+const CONST_TOOL_DESCRIPTION: &str = "Description from a const";
+
+#[test]
+fn test_description_accepts_const_and_concat_exprs() {
+    let tool = Server::const_description_tool_tool_attr();
+    assert_eq!(tool.description.as_deref(), Some(CONST_TOOL_DESCRIPTION));
+
+    let tool = Server::concat_description_tool_tool_attr();
+    assert_eq!(tool.description.as_deref(), Some("part-a-part-b"));
 }
 
 /// Generic service trait.
```

---

### Incident Patch 15: `dbd23827` (2026-09-18)
**Commit Message**: chore(deps): update rstest requirement from 0.26.1 to 0.27.0 (#1276)

Updates the requirements on [rstest](https://github.com/la10736/rstest) to permit the latest version.
- [Release notes](https://github.com/la10736/rstest/releases)
- [Changelog](https://github.com/la10736/rstest/blob/master/CHANGELOG.md)
- [Commits](https://github.com/la10736/rstest/compare/v0.26.1...v0.27.0)

---
updated-dependencies:
- dependency-name: rstest
  dependency-version: 0.27.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `crates/rmcp/Cargo.toml` (modified, +1/-1)
```diff
@@ -215,7 +215,7 @@ tracing-subscriber = { version = "0.3", features = [
   "fmt",
 ] }
 async-trait = "0.1"
-rstest = "0.26.1"
+rstest = "0.27.0"
 [[test]]
 name = "test_tool_macros"
 required-features = ["server", "client"]
```

#### Recent Merged Pull Requests:
- **PR #1324** (closed): fix(model): keep the object! macro available in every feature set (@itsmunzir)
- **PR #1322** (2026-10-05): fix: keep handler-generated invalid params errors in-band (@DaleSeo)
- **PR #1318** (2026-10-05): fix(model): export object! macro without the macros feature (@DaleSeo)
- **PR #1316** (2026-10-05): fix: use MSRV-aware dependency resolver (@DaleSeo)
- **PR #1313** (2026-10-05): chore(deps): bump the github-actions group with 6 updates (@dependabot[bot])
- **PR #1311** (closed): fix(transport): bound non-streaming HTTP response bodies (@soba334)
- **PR #1309** (2026-10-02): fix(examples): make the complex auth server discoverable by OAuth clients (@DaleSeo)
- **PR #1308** (2026-10-05): fix(server): default missing cache hints for 2026-07-28 peers (@DaleSeo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
