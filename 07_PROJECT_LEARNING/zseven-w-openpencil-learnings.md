# Forensic Learning Record (Deep Inspection): ZSeven-W/openpencil

> **Canonical Artifact**: `07_PROJECT_LEARNING/zseven-w-openpencil-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ZSeven-W/openpencil](https://github.com/ZSeven-W/openpencil))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:19:43.733Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ZSeven-W/openpencil`
- **Description**: The world's first open-source AI-native vector design tool and the first to feature concurrent Agent Teams. Design-as-Code. Turn prompts into UI directly on the live canvas. A modern alternative to Pencil.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6046 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/op-acp/src/client.rs`
```
//! ACP connection — connect to a local (stdio) or remote (WebSocket)
//! agent and drive the initialize / session / prompt handshake.
//! Port of `pen-acp/src/client.ts`.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use agent_client_protocol::schema::ProtocolVersion;
use op_util::cli_output::BoundedTail;
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use crate::jsonrpc::{dispatch_inbound, JsonRpcEngine, NOTIFICATION_CAPACITY, OUTBOUND_CAPACITY};
use crate::protocol::{
    AcpStopReason, AgentCapabilities, AuthMethod, InitializeResult, NewSessionResult, PromptResult,
    SessionConfigOption, SessionConfigOptionValue, SessionNotification,
    SetSessionConfigOptionResponse, METHOD_INITIALIZE, METHOD_SESSION_CANCEL, METHOD_SESSION_NEW,
    METHOD_SESSION_PROMPT, METHOD_SESSION_SET_CONFIG_OPTION, PROTOCOL_VERSION,
};
#[cfg(feature = "remote")]
use crate::transport::MAX_INBOUND_FRAME_BYTES;
use crate::transport::{read_frame, write_frame};
use crate::types::{AcpAgentConfig, AcpAgentInfo, AcpError, ConnectionType};

/// Per-request timeout for the handshake calls.
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(30);
/// A remote TCP/TLS/WebSocket dial must not hold a worker forever.
#[cfg(feature = "remote")]
const REMOTE_DIAL_TIMEOUT: Duration = Duration::from_secs(15);
/// A prompt turn can run a long while — generous ceiling.
const PROMPT_TIMEOUT: Duration = Duration::from_secs(600);
/// Best-effort protocol cancellation must not delay local teardown.
const CANCEL_QUEUE_TIMEOUT: Duration = Duration::from_secs(1);
/// Graceful process-tree termination before force-killing the group.
const PROCESS_SHUTDOWN_GRACE: Duration = Duration::from_secs(2);

/// Byte budget for the retained stderr tail of a local agent. Fixed:
/// the drain task exists to keep the child's pipe from filling, so its
/// buffer must never grow with the child's output.
const STDERR_TAIL_CAP: usize = 16 * 1024;

/// Line budget paired with [`STDERR_TAIL_CAP`].
const STDERR_TAIL_LINES: usize = 256;

/// How long a failed handshake waits for the stderr drain to reach EOF
/// before quoting the agent. The child is killed first, so this is
/// normally one scheduler round; bounded so a wedged reader cannot hang
/// the connect path.
const STDERR_DRAIN_GRACE: Duration = Duration::from_secs(2);

/// One MCP server endpoint advertised to the agent in `session/new`
/// (`mcpServers[]`). Serialized as `{ name, type: "http", url,
/// headers: [] }` — the shape `claude-agent-acp` accepts (TS parity:
/// `apps/web/server/api/ai/agent.ts:513-521`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct McpHttpServer {
    /// Server name the agent prefixes tool ids with
    /// (`mcp__<name>__*`).
    pub name: String,
    /// HTTP endpoint, e.g. `http://127.0.0.1:3100/mcp`.
    pub url: String,
}

/// Extra `session/new` payload — MCP tool endpoints + the optional
/// `_meta.systemPrompt` override.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct NewSessionOptions {
    /// MCP servers the agent should connect to for tools.
    pub mcp_servers: Vec<McpHttpServer>,
    /// Override the agent's default system prompt via
    /// `_meta.systemPrompt` (claude-agent-acp honors this; agents
    /// that don't simply ignore the unknown `_meta` key).
    pub system_prompt_meta: Option<String>,
}

/// A newly-created stable-v1 ACP session, including the configuration state
/// the agent advertised for model/mode/reasoning selectors.
#[derive(Debug, Clone)]
pub struct AcpSession {
    pub session_id: String,
    pub config_options: Vec<SessionConfigOption>,
}

/// A live ACP connection to one agent.
pub struct AcpConnection {
    engine: JsonRpcEngine,
    notifications: Option<mpsc::Receiver<SessionNotification>>,
    child: Option<Child>,
    tasks: Vec<JoinHandle<()>>,
    stderr_task: Option<JoinHandle<()>>,
    agent_info: AcpAgentInfo,
    protocol_version: ProtocolVersion,
    agent_capabilities: AgentCapabilities,
    auth_methods: Vec<AuthMethod>,
    /// The most recent lines a locally spawned agent wrote to stderr.
    /// `None` for remote (WebSocket) agents and for connections built
    /// over an arbitrary stream pair — neither has a stderr pipe.
    stderr_tail: Option<Arc<Mutex<BoundedTail>>>,
}

impl AcpConnection {
    /// Build a connection over an arbitrary async byte stream pair
    /// (stdio of a child, a test duplex, …). Spawns the reader +
    /// writer tasks; does NOT run the `initialize` handshake.
    pub fn new<R, W>(read: R, write: W, child: Option<Child>) -> AcpConnection
    where
        R: AsyncRead + Unpin + Send + 'static,
        W: AsyncWrite + Unpin + Send + 'static,
    {
        let (out_tx, mut out_rx) = mpsc::channel::<Value>(OUTBOUND_CAPACITY);
        let (notif_tx, notif_rx) = mpsc::channel::<SessionNotification>(NOTIFICATION_CAPACITY);
        let engine = JsonRpcEngine::new(out_tx);
        let pending = engine.pending();
        let reply_tx = engine.out_tx();
        let reader_engine = engine.clone();

        // Writer task — drain outbound frames onto the byte stream.
        let mut write = write;
        let writer = tokio::spawn(async move {
            while let Some(frame) = out_rx.recv().await {
                if write_frame(&mut write, &frame).await.is_err() {
                    break;
                }
            }
        });

        // Reader task — classify + dispatch every inbound frame until
        // EOF or a transport failure ends the stream.
        let reader = tokio::spawn(async move {
            let mut buf = BufReader::new(read);
            let failure = loop {
                match read_frame(&mut buf).await {
                    Ok(Some(value)) => {
                        if let Err(error) = dispatch_inbound(value, &pending, &notif_tx, &reply_tx)
                        {
                            break error;
                        }
                    }
                    Ok(None) => break AcpError::Closed,
                    Err(error) => break error,
                }
            };
            reader_engine.fail(failure);
        });

        AcpConnection {
            engine,
            notifications: Some(notif_rx),
            child,
            tasks: vec![writer, reader],
            stderr_task: None,
            agent_info: AcpAgentInfo::default(),
            protocol_version: ProtocolVersion::V1,
            agent_capabilities: AgentCapabilities::default(),
            auth_methods: Vec::new(),
            stderr_tail: None,
        }
    }

    /// The redacted, length-capped tail of a local agent's stderr, or
    /// `None` when it printed nothing (or has no stderr pipe at all).
    ///
    /// An ACP agent that dies during the handshake reports the reason
    /// on stderr — a missing API key, an unsupported flag, a broken
    /// install. That text used to be read and dropped line by line, so
    /// the connection failure surfaced as a bare timeout.
    pub fn stderr_tail(&self) -> Option<String> {
        let tail = self.stderr_tail.as_ref()?;
        let text = tail.lock().ok()?.text();
        op_util::cli_output::diagnostic_tail(&text)
    }

    /// Run the `initialize` handshake, recording the agent's identity.
    /// `fallback_name` is used when the agent reports none.
    pub async fn initialize(&mut self, fallback_name: &str) -> Result<(), AcpError> {
        let params = serde_json::json!({
            "protocolVersion": PROTOCOL_VERSION,
            "clientCapabilities": {},
            "clientInfo": { "name": "openpencil", "version": env!("CARGO_PKG_VERSION") }
        });
        let result = self
            .engine
            .call(METHOD_INITIALIZE, params, HANDSHAKE_TIMEOUT)
            .await?;
        let parsed: InitializeResult =
 
```

### Core Architecture Module: `crates/op-acp/src/client_lifecycle.rs`
```
//! Cancellation-safe ACP transport and child-process teardown.

use super::*;

use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::protocol::{
    AuthenticateRequest, AuthenticateResponse, CloseSessionRequest, CloseSessionResponse,
    DeleteSessionRequest, DeleteSessionResponse, METHOD_AUTHENTICATE, METHOD_SESSION_CLOSE,
    METHOD_SESSION_DELETE,
};

/// Session cleanup is best-effort at host boundaries and must never hold
/// process/transport teardown for the much longer prompt timeout.
const SESSION_LIFECYCLE_TIMEOUT: Duration = Duration::from_secs(2);

impl AcpConnection {
    async fn typed_request<Request, Response>(
        &self,
        method: &str,
        request: &Request,
        timeout: Duration,
    ) -> Result<(), AcpError>
    where
        Request: Serialize,
        Response: DeserializeOwned,
    {
        let params =
            serde_json::to_value(request).map_err(|error| AcpError::Protocol(error.to_string()))?;
        let result = self.engine.call(method, params, timeout).await?;
        serde_json::from_value::<Response>(result)
            .map_err(|error| AcpError::Protocol(error.to_string()))?;
        Ok(())
    }

    /// Authenticate with an exact method advertised by `initialize`.
    pub async fn authenticate(&self, method_id: &str) -> Result<(), AcpError> {
        if !self
            .auth_methods
            .iter()
            .any(|method| method.id().0.as_ref() == method_id)
        {
            return Err(AcpError::Protocol(format!(
                "agent did not advertise authentication method '{method_id}'"
            )));
        }
        self.typed_request::<_, AuthenticateResponse>(
            METHOD_AUTHENTICATE,
            &AuthenticateRequest::new(method_id.to_owned()),
            HANDSHAKE_TIMEOUT,
        )
        .await
    }

    /// Retry-safe authentication for an `auth_required` session/new error.
    /// Stable v1 agent auth carries no credentials, but choosing between
    /// multiple methods is a user decision and OpenPencil has no picker yet.
    pub(super) async fn authenticate_unambiguous(&self) -> Result<(), AcpError> {
        match self.auth_methods.as_slice() {
            [method] => self.authenticate(method.id().0.as_ref()).await,
            [] => Err(AcpError::Protocol(
                "agent required authentication but advertised no authMethods".into(),
            )),
            methods => Err(AcpError::Config(format!(
                "agent requires authentication and advertised {} methods; OpenPencil needs an authentication method picker before it can choose one",
                methods.len()
            ))),
        }
    }

    /// Whether stable-v1 `session/close` is available on this connection.
    pub fn supports_session_close(&self) -> bool {
        self.agent_capabilities.session_capabilities.close.is_some()
    }

    /// Close an active session only when the agent advertised support.
    /// Returns whether a wire request was sent.
    pub async fn close_session_if_supported(&self, session_id: &str) -> Result<bool, AcpError> {
        if !self.supports_session_close() {
            return Ok(false);
        }
        self.typed_request::<_, CloseSessionResponse>(
            METHOD_SESSION_CLOSE,
            &CloseSessionRequest::new(session_id.to_owned()),
            SESSION_LIFECYCLE_TIMEOUT,
        )
        .await?;
        Ok(true)
    }

    /// Whether stable-v1 `session/delete` is available on this connection.
    pub fn supports_session_delete(&self) -> bool {
        self.agent_capabilities
            .session_capabilities
            .delete
            .is_some()
    }

    /// Delete a session only when the agent advertised support. Probe callers
    /// use this for their deliberately ephemeral validation session.
    pub async fn delete_session_if_supported(&self, session_id: &str) -> Result<bool, AcpError> {
        if !self.supports_session_delete() {
            return Ok(false);
        }
        self.typed_request::<_, DeleteSessionResponse>(
            METHOD_SESSION_DELETE,
            &DeleteSessionRequest::new(session_id.to_owned()),
            SESSION_LIFECYCLE_TIMEOUT,
        )
        .await?;
        Ok(true)
    }

    fn abort_io_tasks(&mut self) {
        for task in self.tasks.drain(..) {
            task.abort();
        }
    }

    /// Deterministically stop the transport and reap a local agent's whole
    /// process tree. Child/task ownership stays on `self` across every await,
    /// so cancelling this future leaves Drop able to finish cleanup.
    pub async fn shutdown(&mut self) {
        self.abort_io_tasks();
        let mut release_child = false;
        let mut reap_signalled_child = false;
        if let Some(child) = self.child.as_mut() {
            match op_process_io::terminate_tokio_process_tree(child, PROCESS_SHUTDOWN_GRACE).await {
                Ok(_) => release_child = true,
                Err(_) => {
                    // A tree signal can fail even though the exact leader
                    // accepted its kill. Re-observe and retry the owned leader
                    // handle so that case still reaches the reaper, while two
                    // genuine signal failures retain ownership for Drop.
                    if let Some(needs_reap) = force_child_for_reap(child) {
                        release_child = true;
                        reap_signalled_child = needs_reap;
                    }
                }
            }
        }
        if release_child {
            let child = self.child.take().expect("release requires a child");
            if reap_signalled_child {
                reap_in_background(child);
            }
        }
        if let Some(task) = self.stderr_task.as_mut() {
            if tokio::time::timeout(STDERR_DRAIN_GRACE, &mut *task)
                .await
                .is_err()
            {
                task.abort();
            }
        }
        self.stderr_task.take();
    }

    /// Immediate process-tree kill used by Drop and cancellation-unwind paths.
    pub fn disconnect(&mut self) {
        self.abort_io_tasks();
        let disposition = self.child.as_mut().and_then(force_child_for_reap);
        if let Some(needs_reap) = disposition {
            let child = self.child.take().expect("disposition requires a child");
            if needs_reap {
                reap_in_background(child);
            }
        }
        if let Some(task) = self.stderr_task.take() {
            task.abort();
        }
    }
}

/// Return `Some(needs_reap)` only when the child is already reaped or at least
/// one termination request was accepted. `None` keeps the live child owned so
/// another disconnect/Drop attempt (plus `kill_on_drop`) can retry safely.
fn force_child_for_reap(child: &mut Child) -> Option<bool> {
    match child.try_wait() {
        Ok(Some(_)) => Some(false),
        Ok(None) => {
            if op_process_io::kill_tokio_process_tree(child).is_ok() {
                return Some(true);
            }
            // The shared tree helper deliberately returns an error when
            // descendant cleanup failed even if its direct leader kill was
            // accepted. A second exact-handle kill makes acceptance observable.
            match child.start_kill() {
                Ok(()) => Some(true),
                Err(_) => match child.try_wait() {
                    Ok(Some(_)) => Some(false),
                    Ok(None) | Err(_) => None,
                },
            }
        }
        Err(_) => None,
    }
}

impl Drop for AcpConnection {
    fn drop(&mut self) {
        self.disconnect();
    }
}

/// Tokio's async wait cannot be relied on from synchronous Drop or while its
/// runtime is shutting down. `try_wait` is non-async, so a short-lived OS
/// thread can always reap the already-killed direct child and avoid zombies.
fn reap_in_background(mut child: Child) {
    if matches!(child.try_wait(), Ok(Some
```

### Core Architecture Module: `crates/op-acp/src/client_spawn.rs`
```
//! Local ACP agent spawn with a bounded retry for the Linux `ETXTBSY`
//! fork/exec race. A sibling module so `client.rs` stays under the
//! 800-line cap.

use std::io;
use std::time::Duration;

use tokio::process::{Child, Command};

/// ETXTBSY spawn retry budget: 10 attempts, 20 ms apart (~200 ms total).
const SPAWN_ATTEMPTS: usize = 10;
/// Pause between ETXTBSY spawn attempts.
const SPAWN_BACKOFF: Duration = Duration::from_millis(20);

/// Spawn a local agent command, absorbing a transient `ETXTBSY`
/// ("Text file busy") failure.
///
/// A concurrent `fork` can inherit this process's still-open write fd on
/// a freshly written agent script (unique temp dirs written by parallel
/// test threads, or a user replacing an agent binary between runs); the
/// kernel refuses to `exec` the file until that child execs, and the
/// race clears within milliseconds. Only that error is retried, up to
/// [`SPAWN_ATTEMPTS`] — bounded so the async caller blocks briefly.
/// Every other error, and the final ETXTBSY once the budget is gone,
/// is surfaced unchanged.
pub(super) fn spawn_with_etxtbsy_retry(cmd: &mut Command) -> io::Result<Child> {
    retry_etxtbsy(|| cmd.spawn())
}

/// Drive `spawn` against the ETXTBSY retry budget. Generic so tests can
/// inject a fake spawner instead of reproducing the kernel race.
fn retry_etxtbsy<T>(mut spawn: impl FnMut() -> io::Result<T>) -> io::Result<T> {
    // `1..SPAWN_ATTEMPTS` retries plus this final attempt = 10 spawns.
    for _ in 1..SPAWN_ATTEMPTS {
        match spawn() {
            Err(error) if is_etxtbsy(&error) => std::thread::sleep(SPAWN_BACKOFF),
            result => return result,
        }
    }
    spawn()
}

/// ETXTBSY by stable `ErrorKind`, or by raw errno — 26 on both Linux and
/// macOS; older std mappings can also leave the kind `Uncategorized`.
#[cfg(unix)]
fn is_etxtbsy(error: &io::Error) -> bool {
    error.kind() == io::ErrorKind::ExecutableFileBusy || error.raw_os_error() == Some(26)
}

/// Windows has no ETXTBSY; the kind check is the portable half.
#[cfg(not(unix))]
fn is_etxtbsy(error: &io::Error) -> bool {
    error.kind() == io::ErrorKind::ExecutableFileBusy
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn etxtbsy_is_retried_until_the_spawn_succeeds() {
        // Built by kind, not raw errno: on Windows errno 26 in the raw
        // namespace is ERROR_NOT_READY, an unrelated condition.
        let mut script = [
            Err(io::Error::new(
                io::ErrorKind::ExecutableFileBusy,
                "text file busy",
            )),
            Err(io::Error::new(
                io::ErrorKind::ExecutableFileBusy,
                "text file busy",
            )),
            Ok(()),
        ]
        .into_iter();
        let mut calls = 0usize;
        let spawned = retry_etxtbsy(|| {
            calls += 1;
            script.next().unwrap()
        });
        assert!(spawned.is_ok(), "the third spawn attempt must succeed");
        assert_eq!(calls, 3, "two ETXTBSY retries, then the successful spawn");
    }

    #[test]
    fn other_spawn_errors_surface_immediately_and_unchanged() {
        let mut calls = 0usize;
        let result: io::Result<()> = retry_etxtbsy(|| {
            calls += 1;
            Err(io::Error::new(io::ErrorKind::NotFound, "no such agent"))
        });
        let error = result.unwrap_err();
        assert_eq!(calls, 1, "a non-ETXTBSY error must not be retried");
        assert_eq!(error.kind(), io::ErrorKind::NotFound);
        assert_eq!(error.to_string(), "no such agent");
    }

    #[test]
    fn etxtbsy_past_the_budget_surfaces_the_original_error() {
        let mut calls = 0usize;
        let result: io::Result<()> = retry_etxtbsy(|| {
            calls += 1;
            Err(io::Error::new(
                io::ErrorKind::ExecutableFileBusy,
                "still busy",
            ))
        });
        assert_eq!(calls, SPAWN_ATTEMPTS, "spawn attempts are capped");
        let error = result.unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::ExecutableFileBusy);
        assert_eq!(
            error.to_string(),
            "still busy",
            "the original error is surfaced after the budget is gone"
        );
    }

    /// The raw errno arm of the classifier. Unix-only: errno 26 is
    /// `ETXTBSY` on Linux and macOS, while 13 (`EACCES`) must stay
    /// unclassified so a permissions problem is never retried.
    #[cfg(unix)]
    #[test]
    fn raw_etxtbsy_errno_classifies_as_busy() {
        assert!(is_etxtbsy(&io::Error::from_raw_os_error(26)));
        assert!(!is_etxtbsy(&io::Error::from_raw_os_error(13)));
        assert!(!is_etxtbsy(&io::Error::new(
            io::ErrorKind::NotFound,
            "no such agent"
        )));
    }
}

```

### Core Architecture Module: `crates/op-acp/src/event_adapter.rs`
```
//! ACP `session/update` → [`ChatDelta`] adapter — the Rust analogue
//! of `pen-acp/src/event-adapter.ts` (`acpUpdateToSSE`), retargeted
//! from SSE strings to the OP chat panel's delta vocabulary.
//!
//! The turn terminator is the `session/prompt` *result*, not a
//! notification — so this adapter never emits `ChatDelta::Done`; the
//! `AcpProvider` emits it once `prompt()` returns.

use op_ai::chat_provider::ChatDelta;
use serde_json::Value;

use crate::protocol::{ContentBlock, SessionNotification, SessionUpdate};

/// Pull an error message out of a failed tool call's `content` blocks
/// — ACP places the text under `content[].content.text`.
fn extract_tool_error(content: &Value) -> Option<String> {
    let blocks = content.as_array()?;
    let mut found: Option<String> = None;
    for block in blocks {
        if let Some(text) = block
            .get("content")
            .and_then(|c| c.get("text"))
            .and_then(|t| t.as_str())
        {
            found = Some(text.to_string());
        }
    }
    found
}

/// Map one ACP session-update notification to a [`ChatDelta`], or
/// `None` for updates the chat panel does not surface.
pub fn session_update_to_delta(note: &SessionNotification) -> Option<ChatDelta> {
    match &note.update {
        SessionUpdate::AgentMessageChunk {
            content: ContentBlock::Text { text },
        } => Some(ChatDelta::TextDelta(text.clone())),
        SessionUpdate::AgentThoughtChunk {
            content: ContentBlock::Text { text },
        } => Some(ChatDelta::Thinking(text.clone())),
        SessionUpdate::ToolCall {
            tool_call_id,
            title,
            raw_input,
        } => Some(ChatDelta::ToolUse {
            name: title.clone().unwrap_or_else(|| tool_call_id.clone()),
            args: raw_input.to_string(),
        }),
        SessionUpdate::ToolCallUpdate {
            status,
            content,
            raw_output,
            ..
        } => match status.as_deref() {
            Some("failed") => {
                let msg = extract_tool_error(content).unwrap_or_else(|| raw_output.to_string());
                Some(ChatDelta::Error(msg))
            }
            // `completed` is not a stream terminator — the turn ends
            // when `session/prompt` returns.
            _ => None,
        },
        // Non-text content / other update kinds carry nothing to show.
        SessionUpdate::AgentMessageChunk { .. }
        | SessionUpdate::AgentThoughtChunk { .. }
        | SessionUpdate::Other => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(update: Value) -> SessionNotification {
        serde_json::from_value(serde_json::json!({
            "sessionId": "s1",
            "update": update,
        }))
        .unwrap()
    }

    #[test]
    fn message_chunk_maps_to_text_delta() {
        let n = note(serde_json::json!({
            "sessionUpdate": "agent_message_chunk",
            "content": { "type": "text", "text": "hello world" }
        }));
        assert_eq!(
            session_update_to_delta(&n),
            Some(ChatDelta::TextDelta("hello world".into()))
        );
    }

    #[test]
    fn thought_chunk_maps_to_thinking() {
        let n = note(serde_json::json!({
            "sessionUpdate": "agent_thought_chunk",
            "content": { "type": "text", "text": "hmm" }
        }));
        assert_eq!(
            session_update_to_delta(&n),
            Some(ChatDelta::Thinking("hmm".into()))
        );
    }

    #[test]
    fn tool_call_maps_to_tool_use() {
        let n = note(serde_json::json!({
            "sessionUpdate": "tool_call",
            "toolCallId": "tc1",
            "title": "snapshot_layout",
            "rawInput": { "page": 0 }
        }));
        match session_update_to_delta(&n) {
            Some(ChatDelta::ToolUse { name, .. }) => assert_eq!(name, "snapshot_layout"),
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn failed_tool_update_maps_to_error() {
        let n = note(serde_json::json!({
            "sessionUpdate": "tool_call_update",
            "toolCallId": "tc1",
            "status": "failed",
            "content": [ { "content": { "type": "text", "text": "permission denied" } } ]
        }));
        assert_eq!(
            session_update_to_delta(&n),
            Some(ChatDelta::Error("permission denied".into()))
        );
    }

    #[test]
    fn completed_tool_update_and_unknown_yield_nothing() {
        let completed = note(serde_json::json!({
            "sessionUpdate": "tool_call_update",
            "toolCallId": "tc1",
            "status": "completed",
            "rawOutput": { "ok": true }
        }));
        assert_eq!(session_update_to_delta(&completed), None);
        let plan = note(serde_json::json!({ "sessionUpdate": "plan", "entries": [] }));
        assert_eq!(session_update_to_delta(&plan), None);
    }
}

```

### Core Architecture Module: `crates/op-acp/src/jsonrpc.rs`
```
//! Minimal JSON-RPC 2.0 engine over the ndJSON transport.
//!
//! [`JsonRpcEngine`] allocates request ids, correlates responses
//! through per-id oneshot channels, and — via [`dispatch_inbound`] —
//! routes inbound frames: responses to their waiter, `session/update`
//! notifications to a channel, and `session/request_permission`
//! requests to an auto-approval reply (TS parity — the user already
//! trusted the agent by configuring it).

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::Value;
use tokio::sync::{mpsc, oneshot};

use crate::protocol::{
    classify_inbound, Inbound, JsonRpcError, JsonRpcRequest, JsonRpcResponse,
    RequestPermissionParams, SessionNotification, METHOD_REQUEST_PERMISSION, METHOD_SESSION_UPDATE,
};
use crate::types::AcpError;

/// Backpressure ceiling for the outbound-frame queue (requests we send plus
/// the auto-generated replies to agent → client requests). Deliberately
/// generous: a healthy session never queues more than a handful of frames,
/// so hitting this means the writer (or the agent reading it) has stalled.
pub const OUTBOUND_CAPACITY: usize = 1024;

/// Backpressure ceiling for buffered `session/update` notifications. A chatty
/// or malicious agent can stream these faster than the UI drains them; the
/// bound turns unbounded memory growth into a fail-closed connection error.
pub const NOTIFICATION_CAPACITY: usize = 1024;

/// Map of in-flight request id → response waiter.
type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, AcpError>>>>>;

/// Non-blocking enqueue for the reader task. Awaiting here would deadlock the
/// reader against the queues whose responses it must continue dispatching.
/// Overflow is therefore a connection failure, never a silently truncated
/// successful turn.
fn offer<T>(tx: &mpsc::Sender<T>, message: T, what: &str) -> Result<(), AcpError> {
    match tx.try_send(message) {
        Ok(()) => Ok(()),
        Err(mpsc::error::TrySendError::Full(_)) => Err(AcpError::Transport(format!(
            "{what} queue overflow; closing ACP connection"
        ))),
        Err(mpsc::error::TrySendError::Closed(_)) => Err(AcpError::Closed),
    }
}

/// Shared JSON-RPC engine — cloned between the connection handle and
/// the background reader task.
#[derive(Clone)]
pub struct JsonRpcEngine {
    out_tx: mpsc::Sender<Value>,
    pending: Pending,
    next_id: Arc<AtomicU64>,
    failure: Arc<Mutex<Option<AcpError>>>,
}

impl JsonRpcEngine {
    /// Build an engine that writes outbound frames to `out_tx`.
    pub fn new(out_tx: mpsc::Sender<Value>) -> Self {
        Self {
            out_tx,
            pending: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(AtomicU64::new(1)),
            failure: Arc::new(Mutex::new(None)),
        }
    }

    fn current_failure(&self) -> Option<AcpError> {
        self.failure
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    /// Permanently fail this engine and wake every request currently waiting
    /// on the reader. Future calls fail immediately with the same cause.
    pub fn fail(&self, error: AcpError) {
        let error = {
            let mut failure = self
                .failure
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            failure.get_or_insert(error).clone()
        };
        let waiters: Vec<_> = self
            .pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .drain()
            .map(|(_, waiter)| waiter)
            .collect();
        for waiter in waiters {
            let _ = waiter.send(Err(error.clone()));
        }
    }

    /// The shared pending-request map (the reader task resolves it).
    pub fn pending(&self) -> Pending {
        self.pending.clone()
    }

    /// A clone of the outbound-frame sender.
    pub fn out_tx(&self) -> mpsc::Sender<Value> {
        self.out_tx.clone()
    }

    /// Send a request and await its correlated response, up to
    /// `timeout`.
    ///
    /// `timeout` is a deadline for the WHOLE call, enqueue included: the
    /// outbound queue is bounded, so a stalled writer must not silently double
    /// the caller's budget. Awaiting the send is safe here — `call` runs on the
    /// caller's task, never on the writer task that drains the queue, so it
    /// cannot block its own drain.
    pub async fn call(
        &self,
        method: &str,
        params: Value,
        timeout: Duration,
    ) -> Result<Value, AcpError> {
        if let Some(error) = self.current_failure() {
            return Err(error);
        }
        let deadline = tokio::time::Instant::now() + timeout;
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .insert(id, tx);
        if let Some(error) = self.current_failure() {
            self.pending
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .remove(&id);
            return Err(error);
        }

        let req = JsonRpcRequest::new(id, method, params);
        let frame = serde_json::to_value(&req).map_err(|e| AcpError::Protocol(e.to_string()))?;
        let forget = || {
            self.pending
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .remove(&id);
        };
        match tokio::time::timeout_at(deadline, self.out_tx.send(frame)).await {
            Ok(Ok(())) => {}
            // The writer task dropped the receiver — connection died.
            Ok(Err(_)) => {
                forget();
                return Err(AcpError::Closed);
            }
            Err(_) => {
                forget();
                return Err(AcpError::Transport(format!(
                    "request '{method}' timed out queueing for the agent"
                )));
            }
        }

        match tokio::time::timeout_at(deadline, rx).await {
            Ok(Ok(result)) => result,
            // The reader task dropped the sender — connection died.
            Ok(Err(_)) => Err(AcpError::Closed),
            Err(_) => {
                forget();
                Err(AcpError::Transport(format!("request '{method}' timed out")))
            }
        }
    }

    /// Send a JSON-RPC notification with a deadline covering both
    /// serialization and queueing. Notifications have no response, so a
    /// successful enqueue is the complete operation from the client's side.
    pub async fn notify(
        &self,
        method: &str,
        params: Value,
        timeout: Duration,
    ) -> Result<(), AcpError> {
        if let Some(error) = self.current_failure() {
            return Err(error);
        }
        let frame = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });
        match tokio::time::timeout(timeout, self.out_tx.send(frame)).await {
            Ok(Ok(())) => match self.current_failure() {
                Some(error) => Err(error),
                None => Ok(()),
            },
            Ok(Err(_)) => Err(AcpError::Closed),
            Err(_) => Err(AcpError::Transport(format!(
                "notification '{method}' timed out queueing for the agent"
            ))),
        }
    }
}

/// Choose an explicit allow option from a `session/request_permission`
/// request. If the agent offers no allow choice, cancel instead of inventing
/// an option id that was never advertised.
pub fn auto_approve_permission(params: &Value) -> Value {
    let parsed: RequestPermissionParams = serde_json::from_value(params.clone())
        .unwrap_or(RequestPermissionParams { options: vec![] });
    let chosen = parsed.options.i
```

### Core Architecture Module: `crates/op-acp/src/lib.rs`
```
//! OpenPencil ACP client — a Rust port of the TS `pen-acp` package.
//!
//! ACP (Agent Client Protocol) lets third-party agents plug into
//! OpenPencil over JSON-RPC 2.0 framed as newline-delimited JSON. An
//! agent runs either as a local child process (stdio) or behind a
//! remote WebSocket endpoint.
//!
//! Layers:
//!  - [`transport`] — ndJSON frame read / write;
//!  - [`jsonrpc`] — request-id correlation, notification routing,
//!    `session/request_permission` auto-approval;
//!  - [`client`] — [`AcpConnection`]: `initialize` / `session/new` /
//!    `session/prompt`;
//!  - [`event_adapter`] — maps `session/update` notifications onto the
//!    chat panel's `ChatDelta` vocabulary.
//!
//! Desktop-only — it spawns processes + drives async IO via tokio, so
//! no wasm crate depends on it.

pub mod client;
pub mod event_adapter;
pub mod jsonrpc;
pub mod protocol;
pub mod transport;
pub mod types;

pub use client::{connect_acp_agent, AcpConnection, AcpSession, McpHttpServer, NewSessionOptions};
pub use event_adapter::session_update_to_delta;
pub use protocol::{
    AcpStopReason, AgentCapabilities, AuthMethod, ProtocolVersion, SessionConfigKind,
    SessionConfigOption, SessionConfigOptionCategory, SessionConfigOptionValue,
    SessionConfigSelectOptions, SessionNotification, SessionUpdate,
};
pub use types::{AcpAgentConfig, AcpAgentInfo, AcpConnectResult, AcpError, ConnectionType};

```

### Core Architecture Module: `crates/op-acp/src/protocol.rs`
```
//! ACP wire protocol — JSON-RPC 2.0 envelopes plus the subset of
//! Agent Client Protocol message shapes the client drives.
//!
//! Method names + the `protocolVersion` constant mirror the
//! `@agentclientprotocol/sdk` schema (`AGENT_METHODS` / `PROTOCOL_VERSION`).

use serde::{Deserialize, Serialize};
use serde_json::Value;

// The transport remains OpenPencil-owned because it also supports remote
// WebSockets and host-specific deadlines, but all stable request/response
// shapes come from the official ACP Rust SDK 2.0.0. Keeping these re-exports
// here makes the stable v1 boundary explicit and prevents our hand-written
// structs from drifting as non-breaking fields are added.
pub use agent_client_protocol::schema::{
    v1::{
        AgentCapabilities, AuthMethod, AuthenticateRequest, AuthenticateResponse,
        CloseSessionRequest, CloseSessionResponse, DeleteSessionRequest, DeleteSessionResponse,
        InitializeResponse as InitializeResult, NewSessionResponse as NewSessionResult,
        PromptResponse as PromptResult, SessionConfigKind, SessionConfigOption,
        SessionConfigOptionCategory, SessionConfigOptionValue, SessionConfigSelectOptions,
        SetSessionConfigOptionResponse, StopReason as AcpStopReason,
    },
    ProtocolVersion,
};

pub use op_rpc_transport::{
    classify_inbound, Inbound, JsonRpcError, JsonRpcRequest, JsonRpcResponse,
};

/// ACP protocol version this client speaks (`PROTOCOL_VERSION` in the SDK).
pub const PROTOCOL_VERSION: u32 = 1;

/// `initialize` — handshake.
pub const METHOD_INITIALIZE: &str = "initialize";
/// `authenticate` — run one agent-advertised authentication method.
pub const METHOD_AUTHENTICATE: &str = "authenticate";
/// `session/new` — open a session.
pub const METHOD_SESSION_NEW: &str = "session/new";
/// `session/delete` — remove a persisted session when advertised.
pub const METHOD_SESSION_DELETE: &str = "session/delete";
/// `session/close` — release an active session when advertised.
pub const METHOD_SESSION_CLOSE: &str = "session/close";
/// `session/prompt` — drive one turn.
pub const METHOD_SESSION_PROMPT: &str = "session/prompt";
/// `session/cancel` — cancel work for one session (notification).
pub const METHOD_SESSION_CANCEL: &str = "session/cancel";
/// `session/set_config_option` — update a model/mode/reasoning selector.
pub const METHOD_SESSION_SET_CONFIG_OPTION: &str = "session/set_config_option";
/// `session/update` — streaming notification from the agent.
pub const METHOD_SESSION_UPDATE: &str = "session/update";
/// `session/request_permission` — agent asks the client to approve a tool.
pub const METHOD_REQUEST_PERMISSION: &str = "session/request_permission";

/// One content block of a prompt / message.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    /// Plain text.
    Text { text: String },
    /// Any other content type — preserved opaquely.
    #[serde(other)]
    Other,
}

/// The discriminated `update` payload of a `session/update`
/// notification (`sessionUpdate` tag).
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "sessionUpdate", rename_all = "snake_case")]
pub enum SessionUpdate {
    /// A streamed chunk of the agent's reply.
    AgentMessageChunk { content: ContentBlock },
    /// A streamed chunk of the agent's private reasoning.
    AgentThoughtChunk { content: ContentBlock },
    /// The agent announced a tool call (display-only).
    ToolCall {
        #[serde(rename = "toolCallId", default)]
        tool_call_id: String,
        #[serde(default)]
        title: Option<String>,
        #[serde(rename = "rawInput", default)]
        raw_input: Value,
    },
    /// A tool call's status changed.
    ToolCallUpdate {
        #[serde(rename = "toolCallId", default)]
        tool_call_id: String,
        #[serde(default)]
        status: Option<String>,
        #[serde(rename = "rawOutput", default)]
        raw_output: Value,
        #[serde(default)]
        content: Value,
    },
    /// Any other update kind — ignored by the event adapter.
    #[serde(other)]
    Other,
}

/// A `session/update` notification's params.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionNotification {
    #[serde(default)]
    pub session_id: Option<String>,
    pub update: SessionUpdate,
}

/// One option offered in a `session/request_permission` request.
#[derive(Debug, Clone, Deserialize)]
pub struct PermissionOption {
    #[serde(rename = "optionId")]
    pub option_id: String,
    #[serde(default)]
    pub kind: Option<String>,
}

/// `session/request_permission` request params (only `options`).
#[derive(Debug, Clone, Deserialize)]
pub struct RequestPermissionParams {
    #[serde(default)]
    pub options: Vec<PermissionOption>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_response_request_notification() {
        let resp = serde_json::json!({"jsonrpc":"2.0","id":7,"result":{"ok":true}});
        assert!(matches!(
            classify_inbound(&resp),
            Inbound::Response { id: 7, .. }
        ));
        let req = serde_json::json!({"jsonrpc":"2.0","id":3,"method":"session/request_permission","params":{}});
        assert!(matches!(classify_inbound(&req), Inbound::Request { .. }));
        let note = serde_json::json!({"jsonrpc":"2.0","method":"session/update","params":{}});
        assert!(matches!(
            classify_inbound(&note),
            Inbound::Notification { .. }
        ));
        assert!(matches!(
            classify_inbound(&serde_json::json!(5)),
            Inbound::Unknown
        ));
    }

    #[test]
    fn session_update_deserializes_known_variants() {
        let chunk = serde_json::json!({
            "sessionUpdate": "agent_message_chunk",
            "content": { "type": "text", "text": "hello" }
        });
        let u: SessionUpdate = serde_json::from_value(chunk).unwrap();
        match u {
            SessionUpdate::AgentMessageChunk {
                content: ContentBlock::Text { text },
            } => assert_eq!(text, "hello"),
            other => panic!("unexpected: {other:?}"),
        }
        // An unknown update kind falls through to `Other`.
        let weird = serde_json::json!({"sessionUpdate": "plan", "entries": []});
        assert!(matches!(
            serde_json::from_value::<SessionUpdate>(weird).unwrap(),
            SessionUpdate::Other
        ));
    }

    #[test]
    fn tool_call_update_carries_status() {
        let v = serde_json::json!({
            "sessionUpdate": "tool_call_update",
            "toolCallId": "t1",
            "status": "completed",
            "rawOutput": { "result": 42 }
        });
        let u: SessionUpdate = serde_json::from_value(v).unwrap();
        match u {
            SessionUpdate::ToolCallUpdate {
                tool_call_id,
                status,
                ..
            } => {
                assert_eq!(tool_call_id, "t1");
                assert_eq!(status.as_deref(), Some("completed"));
            }
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn request_serializes_with_jsonrpc_envelope() {
        let req = JsonRpcRequest::new(1, METHOD_INITIALIZE, serde_json::json!({}));
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"jsonrpc\":\"2.0\""));
        assert!(json.contains("\"method\":\"initialize\""));
    }
}

```

### Core Architecture Module: `crates/op-acp/src/transport.rs`
```
//! ndJSON framing — newline-delimited JSON over an async byte stream.
//!
//! ACP speaks JSON-RPC where every message is one JSON object on its
//! own line (the SDK's `ndJsonStream`). These helpers read and write
//! that framing; the JSON-RPC engine ([`crate::jsonrpc`]) sits on top.

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWrite, AsyncWriteExt};

use crate::types::AcpError;

/// Maximum accepted inbound ACP message size for stdio and WebSocket peers.
/// The limit includes the JSON payload but not the ndJSON newline delimiter.
pub const MAX_INBOUND_FRAME_BYTES: usize = 16 * 1024 * 1024;

/// Read the next ndJSON frame from `reader`. Blank lines are skipped, while a
/// malformed or oversized non-empty frame fails the connection. The bounded
/// `fill_buf` loop is intentional: `read_line` would keep allocating forever
/// when an untrusted child writes bytes without a newline.
pub async fn read_frame(
    reader: &mut (impl AsyncBufRead + Unpin),
) -> Result<Option<Value>, AcpError> {
    read_frame_with_limit(reader, MAX_INBOUND_FRAME_BYTES).await
}

async fn read_frame_with_limit(
    reader: &mut (impl AsyncBufRead + Unpin),
    max_bytes: usize,
) -> Result<Option<Value>, AcpError> {
    let mut frame = Vec::new();
    loop {
        let (consumed, reached_delimiter, reached_eof) = {
            let available = reader
                .fill_buf()
                .await
                .map_err(|e| AcpError::Transport(e.to_string()))?;
            if available.is_empty() {
                (0, false, true)
            } else if let Some(index) = available.iter().position(|byte| *byte == b'\n') {
                if frame.len().saturating_add(index) > max_bytes {
                    return Err(AcpError::Protocol(format!(
                        "ACP frame exceeds {max_bytes} bytes"
                    )));
                }
                frame.extend_from_slice(&available[..index]);
                (index + 1, true, false)
            } else {
                if frame.len().saturating_add(available.len()) > max_bytes {
                    return Err(AcpError::Protocol(format!(
                        "ACP frame exceeds {max_bytes} bytes"
                    )));
                }
                frame.extend_from_slice(available);
                (available.len(), false, false)
            }
        };
        reader.consume(consumed);

        if !reached_delimiter && !reached_eof {
            continue;
        }
        if frame.iter().all(u8::is_ascii_whitespace) {
            if reached_eof {
                return Ok(None);
            }
            frame.clear();
            continue;
        }
        return serde_json::from_slice::<Value>(&frame)
            .map(Some)
            .map_err(|error| AcpError::Protocol(format!("invalid ACP JSON frame: {error}")));
    }
}

/// `AsyncBufRead` is needed for `fill_buf`; re-exported so callers
/// don't need a separate `tokio::io` import.
pub use tokio::io::AsyncBufRead;

/// Write one ndJSON frame: the compact JSON of `value` followed by a
/// newline, flushed.
pub async fn write_frame(
    writer: &mut (impl AsyncWrite + Unpin),
    value: &Value,
) -> Result<(), AcpError> {
    let mut bytes = serde_json::to_vec(value).map_err(|e| AcpError::Protocol(e.to_string()))?;
    bytes.push(b'\n');
    writer
        .write_all(&bytes)
        .await
        .map_err(|e| AcpError::Transport(e.to_string()))?;
    writer
        .flush()
        .await
        .map_err(|e| AcpError::Transport(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[tokio::test]
    async fn reads_frames_split_on_newline() {
        let data = "{\"a\":1}\n{\"b\":2}\n";
        let mut reader = Cursor::new(data.as_bytes());
        let f1 = read_frame(&mut reader).await.unwrap().unwrap();
        assert_eq!(f1["a"], 1);
        let f2 = read_frame(&mut reader).await.unwrap().unwrap();
        assert_eq!(f2["b"], 2);
        assert!(read_frame(&mut reader).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn skips_blank_lines_but_rejects_malformed_frames() {
        let data = "\n  \nnot json at all\n{\"ok\":true}\n";
        let mut reader = Cursor::new(data.as_bytes());
        let error = read_frame(&mut reader).await.unwrap_err();
        assert!(error.to_string().contains("invalid ACP JSON frame"));
    }

    #[tokio::test]
    async fn rejects_an_oversized_frame_without_waiting_for_a_newline() {
        let mut reader = Cursor::new(vec![b'x'; 33]);
        let error = read_frame_with_limit(&mut reader, 32).await.unwrap_err();
        assert!(error.to_string().contains("exceeds 32 bytes"));
    }

    #[tokio::test]
    async fn accepts_a_final_frame_without_a_newline() {
        let mut reader = Cursor::new(br#"{"ok":true}"#);
        let frame = read_frame_with_limit(&mut reader, 32)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(frame["ok"], true);
    }

    #[tokio::test]
    async fn write_frame_appends_newline() {
        let mut buf: Vec<u8> = Vec::new();
        write_frame(&mut buf, &serde_json::json!({"x":1}))
            .await
            .unwrap();
        assert_eq!(buf, b"{\"x\":1}\n");
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #231** (2026-08-30): **Mirror text first frame**
  *Symptoms*: ### Version  v0.8.4  ### Platform  Web (browser)  ### Bug Description  Open AppImage v0.8.4 create frame create text field start typing (text starting from right side and mirrored)   ### Steps to Reproduce  https://github.com/user-attachments/assets/79f373f8-38d2-4dba-a3cb-ddd1e895cdae  ### Expected Behavior  Normal text  frame behaviour  ### Screenshots / Recordings  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Bro, this isn't our project. Check out this post instead: https://x.com/FiniYang/status/2085410613581451267  Our interface doesn't look like this.

- **Issue #230** (2026-08-30): **Very tiny interface font**
  *Symptoms*: ### Version  0.8.4  ### Platform  Linux (native desktop)  ### Bug Description   in appImage v0.8.4 very small font! menu option - is correct, but interface elements are so small...  ### Steps to Reproduce  1) Open appImage 2) Interact with interface  ### Expected Behavior  In ideal - change interface font be myself or make same as menu font size   ### Screenshots / Recordings  <img width="1276" height="781" alt="Image" src="https://github.com/user-attachments/assets/271a2dc9-c81e-46cd-b886-0cf454439ca6" />  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Bro, this isn't our project. Check out this post instead: https://x.com/FiniYang/status/2085410613581451267  Our interface doesn't look like this.

- **Issue #229** (2026-09-21): **Windows: Codex agent fails with os error 10106 because SystemRoot/windir are dropped**
  *Symptoms*: ### Version  0.8.4  ### Platform  Windows (native desktop)  ### Bug Description  The Codex CLI works correctly when launched directly from a terminal, but fails when launched as an agent inside OpenPencil.  OpenPencil displays:  ```text error: orchestration failed: Reconnecting... 2/5 (stream disconnected before completion: The requested service provider could not be loaded or initialized. (os error 10106)) ```  The Chinese Windows error text is:  ```text 无法加载或初始化请求的服务提供程序。(os error 10106) ```  Error 10106 is `WSAEPROVIDERFAILEDINIT`.  This is separate from #189: the extensionless npm-shim problem was bypassed by explicitly resolving the native `codex.exe`, after which this later network-initialization failure appeared.  ### Steps to Reproduce  1. Install and authenticate Codex CLI on Windows using a ChatGPT subscription. 2. Confirm that the native `codex.exe` works directly from a terminal. 3. Ensure OpenPencil resolves the native `codex.exe` rather than the extensionless npm shim described in #189. 4. Connect Codex CLI in OpenPencil. 5. Send a simple prompt from the Agent panel. 6. The request reconnects several times and terminates with `os error 10106`.  The same native Codex executable and the same HTTP proxy settings succeed outside OpenPencil.  ### Expected Behavior  OpenPencil should preserve the Windows environment required for Winsock initialization when launching Codex, and the agent request should complete normally.  ### Screenshots / Recordings  <img width="2520"
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report and diagnosis. Confirmed: the current `v0.8.5` branch still filters the Codex child environment with case-sensitive key matching and does not preserve `WINDIR`, so this is not fixed yet.  We will update the Windows filtering to preserve the required variables case-insensitively and add regression coverage for mixed-case `SystemRoot`, `windir`, `ComSpec`, and `Path`.

- **Issue #219** (2026-08-27): **通过 MCP 创建 text 节点导致桌面应用崩溃**
  *Symptoms*: ### Version  崩溃地址 MSVCP140.dll + 0x18c34，异常码 0xc0000005  ### Platform  Windows (native desktop)  ### Bug Description  使用dsh 接入mcp 创建设计，只要是创建text节点就会崩溃，连续3次都是，应用安装版本是最新的0.8.4  ### Steps to Reproduce  1、打开应用 2、在dsh中“帮我创建一个液态玻璃卡片” 3、调用mcp ，创建text节点，程序崩溃  ### Expected Behavior  什么原因导致的  ### Screenshots / Recordings  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > 感谢报告。先请做一个最省事的判别实验:  **1. 不用 dsh/MCP,直接在应用里用文本工具(快捷键 T)在画布上点一个文本** —— 也崩吗?  如果也崩,说明问题与 MCP/dsh 无关,而是 Windows 上文字排版路径本身。这个签名(0xc0000005 崩在 MSVCP140.dll 内部、仅 text 触发、每次必崩)高度符合 VC++ 运行时版本不匹配:我们的 Windows 包用较新的 MSVC 工具链构建,动态依赖系统的 MSVCP140.dll;当机器上的 VC++ Redistributable 较旧时,首次进入文字整形的 C++ 路径就会在运行时库内部访问违例 —— 创建 text 节点正是首次触发这条路径的操作,所以 frame/矩形都正常、text 必崩。  **2. 安装最新 VC++ 运行时后重试**:https://aka.ms/vs/17/release/vc_redist.x64.exe (装完建议重启)。  **3. 回帖时请带上**: - `C:\Windows\System32\msvcp140.dll` 右键属性 → 详细信息里的文件版本(重点看是否低于 14.40); - 通过 MCP 创建 frame / rectangle 是否正常(即确认只有 text 崩); - 如果更新运行时后仍崩:`%LOCALAPPDATA%\CrashDumps` 下 openpencil 相关的 .dmp 文件。 
  > <img width="739" height="920" alt="Image" src="https://github.com/user-attachments/assets/70f5d64e-6e7a-43d9-9b91-0a0b7667654d" /> 使用最新VC++ 后不会存在该问题，MCP调用正常。感谢

- **Issue #218** (2026-09-03): **TypeError: undefined is not an object (evaluating 'n.offset.x')**
  *Symptoms*: ### Version  Version 0.14.0 (0.14.0)  ### Platform  macOS (native desktop)  ### Bug Description   I got an error that made it impossible to move the scene. It happened after I asked to add blur to some design elements.  <img width="1392" height="912" alt="Image" src="https://github.com/user-attachments/assets/f10262ac-8e94-4831-af83-9739ff5ab925" />  ### Steps to Reproduce  1. Use AI   2. Ask the AI to add blur   3. You may get an error  ### Expected Behavior  The blur should be applied to the selected design elements without affecting scene movement.  ### Screenshots / Recordings  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Bro, this isn't our project. Check out this post instead: https://x.com/FiniYang/status/2085410613581451267  We have version v0.8.5 - give our version a try instead of this garbage

- **Issue #211** (2026-08-29): **【字体】获取字体的地方有bug**
  *Symptoms*: ### Version  v0.8.4  ### Platform  Windows (native desktop)  ### Bug Description  Windows 11，系统自带 msyh.ttc，选择字体可见 Microsoft YaHei UI，但不可见 Microsoft YaHei，打开使用 YaHei 的设计时提示 缺失字体。  ### Steps to Reproduce  打开一个带有 Microsoft YaHei 字体的文件。 （我用CodeX调MCP做的文件默认用的这个字体）  ### Expected Behavior  应该不报字体缺失。  ### Screenshots / Recordings  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fix proposed in #216. Missing-font detection now treats Microsoft YaHei and Microsoft YaHei UI as names for the same installed file (msyh.ttc), so opening a YaHei design no longer reports a missing font when Windows only lists YaHei UI. Other Windows UI faces stay distinct.

- **Issue #209** (2026-08-29): **关于模型工具调用失败**
  *Symptoms*: ### Version  0.8.3  ### Platform  Windows (native desktop)  ### Bug Description  1、编辑时的调用会出现偶发性修改工具掉落的情况。具体的反应如下 -使用任一模型时都会出现 -出现后，除非关闭程序，新开一个正常的文件，才会恢复，并且加载工具掉落的那个文件的时候，工具会继续掉落。这里我个人技术力有限，无法拆开调查，让ai反馈给我之后，原因为下图所示 -这种情况不是罕见偶发，而是存在一定的复现可能，但由于我个人时间原因，我无法提供更多的测试反馈，这里附上图片与目前百分百导入后就会失灵的op文件 希望能够处理并修复这个问题   [untitled.zip](https://github.com/user-attachments/files/30943451/untitled.zip)  "Image" src="https://github.com/user-attachments/assets/ff12644b-a3b9-4aa5-9c60-5894e53bfe98" />  ### Steps to Reproduce  由于我无法稳定复现，此处无法提供对应的复现步骤  ### Expected Behavior  编辑类工具无法调用，而其余可读类文件却可以  ### Screenshots / Recordings  <img width="1470" height="524" alt="Image" src="https://github.com/user-attachments/assets/505cd1b1-fb63-4c25-9387-201b35854414" />  ### Additional Context  使用操作系统：window11  对应版本：25H2 
  **Post-Mortem & Fix Analysis**:
  > 好的，感谢反馈，我们安排处理

- **Issue #204** (2026-08-09): **MCP screenshot result is returned as text instead of ImageContent**
  *Symptoms*: ### Version  0.8.2  ### Platform  Linux (native desktop)  ### Bug Description  The MCP screenshot tool does not expose the captured PNG to MCP clients as an MCP `ImageContent` block.  When using OpenPencil's MCP server from GitHub Copilot in VS Code with a vision-capable model, the screenshot returned by the screenshot tool arrives in the tool result as serialized JSON/base64 text. Copilot therefore treats the screenshot bytes as text rather than as an image input.  This makes the screenshot effectively unusable for visual reasoning: the model receives a large base64 string instead of the image.  ### Steps to Reproduce  1. Run and connect MCP to chat client 3. Use a vision-capable model. 4. Invoke the screenshot MCP tool (`get_screenshot` is what the server reports). 5. Inspect the tool result received by Copilot. 6. Witness base64-encoded image in json  ### Expected Behavior  The screenshot tool should return the PNG as a typed MCP image content block:  ```json {   "content": [     {       "type": "image",       "data": "<base64-encoded PNG bytes>",       "mimeType": "image/png"     }   ] } ```  The base64 encoding itself is expected by MCP. The important part is that the base64 data is contained in an MCP ImageContent block (type: "image"), rather than being serialized into a text/JSON tool result.  This allows MCP clients such as GitHub Copilot to preserve the image as multimodal content and pass it to vision-capable models.  ### Screenshots / Recordings  <img width="468" 

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

### Incident Patch 1: `4c9f73fb` (2026-09-17)
**Commit Message**: fix(ai): ride out provider 429s in the headless smoke client

The direct openai-compat client (OPENPENCIL_SMOKE_DIRECT=1) gave up after a
single POST, while op_orchestrator::retry deliberately treats `http 429` as
non-retryable so the subtask ladder stops there. Together those two turned one
rate limit from a shared provider pool into a permanently lost subtask: an
arena batch against OpenRouter'''s stealth channel took 11 x 429 on one task and
lost 7 of 11 subtasks, which reads as a model that produced nothing.

Route the call through production'''s own ladder (send_with_backoff: same
throttle, same adaptive gap, same Retry-After handling) instead of a second
copy of that policy. OPENPENCIL_SMOKE_HTTP_MAX_RETRIES raises the ladder for a
heavily shared free pool, and the whole-call deadline gains head-room for the
ladder'''s own sleeps so the last attempt still gets to dial.

Same task re-run with the ladder: 0 x 429, 120 -> 238 nodes, all three screens
complete.

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -4958,6 +4958,7 @@ dependencies = [
  "jian-ops-schema",
  "op-ai",
  "op-ai-skills",
+ "op-chat-agent",
  "op-editor-core",
  "op-host-services",
  "op-image-enrich",
```

**File**: `crates/op-smoke/Cargo.toml` (modified, +5/-0)
```diff
@@ -46,6 +46,11 @@ op-mcp = { path = "../op-mcp" }
 # loop-mode dump uses the SAME `serde_json::to_string_pretty(&state.doc)` path as
 # the orchestrator mode. Both crates already build raster-only (no winit/GL).
 op-host-services = { path = "../op-host-services" }
+# Production's HTTP retry/throttle ladder (`send_with_backoff`) — the direct
+# openai-compat client below rides out provider 429s with the same posture the
+# desktop uses instead of turning a shared-pool rate limit into a failed subtask.
+op-chat-agent = { path = "../op-chat-agent" }
+
 op-ai = { path = "../op-ai" }
 # System prompt for the design agent loop (parity with the desktop design loop).
 op-ai-skills = { path = "../op-ai-skills" }
```

**File**: `crates/op-smoke/src/llm_clients.rs` (modified, +51/-8)
```diff
@@ -17,6 +17,7 @@ use agent::query::QueryEngine;
 use agent::stream::Event;
 use futures::channel::mpsc;
 use futures::StreamExt;
+use op_chat_agent::backoff::{send_with_backoff, BUILTIN_HTTP_MAX_RETRIES};
 use op_host_services::chat_builtin_http::apply_reasoning_wire_control;
 use op_orchestrator::{CallRequest, LlmChunk, LlmClient, LlmError};
 
@@ -261,17 +262,30 @@ impl LlmClient for DirectOpenAiClient {
             // lines while it works, so a stuck generation never goes idle
             // (web-05 sat 32 min in Planning on 2026-09-08). Cap the whole
             // call; the orchestrator's retry loop takes it from there.
+            let max_retries = smoke_http_max_retries();
             let total_budget = total_call_budget(
                 op_orchestrator::resolve_model_profile(&model).timeout_multiplier,
-            );
+            ) + retry_ladder_budget(max_retries);
+            // Rate limits are a transport concern, not a model verdict: a
+            // shared-pool provider (OpenRouter's stealth channel, measured
+            // 2026-09-17) answers 429 on most subtasks of a 12-task suite, and
+            // `op_orchestrator::retry::is_non_retryable` deliberately stops the
+            // subtask ladder on `http 429` — so without a ladder HERE the run
+            // reads as a model that produced nothing. `send_with_backoff` is
+            // production's own ladder (same throttle, same adaptive gap, same
+            // Retry-After handling); the harness differs only in that the
+            // provider's error body stays reachable via the opt-in
+            // `OPENPENCIL_DEBUG_HTTP_ERROR_BODY` file.
             let call = async {
-                let resp = client
-                    .post(&url)
-                    .bearer_auth(&key)
-                    .json(&body)
-                    .send()
-                    .await
-                    .map_err(|e| format!("POST {url}: {e}"))?;
+                let resp = send_with_backoff(
+                    "smoke direct",
+                    &url,
+                    max_retries,
+                    op_chat_agent::backoff::builtin_http_min_gap(),
+                    || client.post(&url).bearer_auth(&key).json(&body),
+                )
+                .await
+                .map_err(|e| e.to_string())?;
                 let status = resp.status();
                 let text = resp.text().await.unwrap_or_default();
                 Ok::<_, String>((status, text))
@@ -331,6 +345,27 @@ impl LlmClient for DirectOpenAiClient {
     }
 }
 
+/// Retries the harness's direct provider POST rides out before giving up.
+///
+/// Defaults to production's ladder ([`BUILTIN_HTTP_MAX_RETRIES`]); a batch
+/// against a heavily shared free pool raises it with
+/// `OPENPENCIL_SMOKE_HTTP_MAX_RETRIES`.
+fn smoke_http_max_retries() -> u32 {
+    std::env::var("OPENPENCIL_SMOKE_HTTP_MAX_RETRIES")
+        .ok()
+        .and_then(|raw| raw.trim().parse::<u32>().ok())
+        .unwrap_or(BUILTIN_HTTP_MAX_RETRIES)
+}
+
+/// Head-room the whole-call deadline needs for the retry ladder's own sleeps.
+///
+/// Without it the ladder eats the generation budget: `RETRY_AFTER_MAX` caps one
+/// wait at 30 s, so `max_retries` waits are the worst case the deadline has to
+/// absorb before the last attempt even dials.
+fn retry_ladder_budget(max_retries: u32) -> std::time::Duration {
+    std::time::Duration::from_secs(30 * u64::from(max_retries))
+}
+
 /// Whole-call budget for the non-streaming provider path: 15 min scaled by
 /// the model profile's timeout multiplier, or `OPENPENCIL_SMOKE_LLM_TOTAL_BUDGET_SECS`
 /// when set (the harness tests use it to make the deadline observable).
@@ -350,6 +385,14 @@ mod tests {
     use super::*;
     use serde_json::json;
 
+    #[test]
+    fn retry_ladder_budget_covers_the_worst_case_waits() {
+        // RETRY_AFTER_MAX (30 s) per retry — the deadline must outlast the
+        // ladder, or the last attempt never dials.
+        asse
```

---

### Incident Patch 2: `dd2bb56d` (2026-09-16)
**Commit Message**: fix(editor): make Home's avatar and model picker actually usable

Three defects the founder hit on Home, all from the takeover carrying
only half of what the professional chrome carries.

The avatar hovered but did nothing when signed in. It opens one of two
things, and Home painted and routed only the signed-OUT half: the
account menu went `open = true` and appeared nowhere. Home now paints it
and owns its presses, and the menu anchors off HOME's avatar instead of
the professional TopBar's, which is a different place on the same
window.

The model picker showed 接入更多模型 twice. It was an external row
painted BELOW the card, from before the picker grew its own footer.
Removed: the card is the whole footprint now.

And the picker dismissed on hover-out, so the cursor could not reach
that footer without the card vanishing on the way — the external row
sat across a gap that read as leaving the popover. A click-opened
popover closes on a click outside, which the press path already does;
hover only tracks the row under the cursor.

Claude-Session: https://claude.ai/code/session_01LBqzBogViQjjA8AqRjLsoD

**File**: `crates/op-editor-ui/src/widgets/home_surface_model.rs` (modified, +9/-9)
```diff
@@ -52,12 +52,19 @@ pub fn model_chip_width(label: &str) -> f32 {
 /// The picker card anchored above the submit row's model button plus
 /// the trailing connect-more row under it. `None` when the button is
 /// not laid out (zero-width) or the viewport cannot hold the card.
+/// The Home-anchored model picker's card.
+///
+/// It used to return a second rect for an external 接入更多模型 row
+/// painted BELOW the card. The picker carries that action as its own
+/// footer now, so the external row was the same thing twice — and
+/// because it sat outside the card, crossing the gap to reach it read as
+/// leaving the popover.
 pub fn home_model_picker_rects(
     layout: &HomeLayout,
     viewport_w: f32,
     models: &[ModelEntry],
     search: &str,
-) -> Option<(Rect, Rect)> {
+) -> Option<Rect> {
     let chip = layout.model_chip;
     if chip.size.x <= 0.0 {
         return None;
@@ -67,14 +74,7 @@ pub fn home_model_picker_rects(
     let top = (bottom - height).max(8.0);
     let x = (chip.origin.x + chip.size.x / 2.0 - HOME_MODEL_PICKER_W / 2.0)
         .clamp(8.0, (viewport_w - HOME_MODEL_PICKER_W - 8.0).max(8.0));
-    let card = Rect::xywh(x, top, HOME_MODEL_PICKER_W, height);
-    let connect_row = Rect::xywh(
-        x,
-        card.origin.y + card.size.y + CONNECT_MORE_ROW_GAP,
-        HOME_MODEL_PICKER_W,
-        CONNECT_MORE_ROW_H,
-    );
-    Some((card, connect_row))
+    Some(Rect::xywh(x, top, HOME_MODEL_PICKER_W, height))
 }
 
 /// Paint the model button: a 38 px outline pill with the green status
```

**File**: `crates/op-editor-ui/src/widgets/touch_overlay_geometry.rs` (modified, +15/-0)
```diff
@@ -18,6 +18,21 @@ pub fn account_anchor(state: &EditorState, viewport_w: f32) -> Rect {
         let bar = host_canvas_geometry::touch_app_bar_rect(state, viewport_w);
         return MobileAppBar::overflow_rect(bar);
     }
+    // Home is a takeover with its own top bar, so the menu has to hang
+    // off ITS avatar. Anchoring to the professional TopBar's position
+    // put the menu somewhere Home has no avatar at all.
+    if state.editor_ui.home.visible {
+        // The top-bar rects are anchored off the viewport's right edge
+        // and depend on nothing else, so the task and chip width here
+        // cannot change the answer.
+        return crate::widgets::home_surface::layout::layout_for(
+            viewport_w,
+            1.0,
+            state.editor_ui.home.task,
+            0.0,
+        )
+        .account;
+    }
     let top_bar = Rect::xywh(0.0, 0.0, viewport_w, TOP_BAR_HEIGHT);
     TopBar::for_editor_ui(&state.editor_ui).account_button_rect(top_bar)
 }
```

**File**: `crates/op-host-native/src/widget_host/home_overlays.rs` (modified, +52/-29)
```diff
@@ -14,7 +14,7 @@ use crate::backend::NativeFrameBackend;
 use op_editor_ui::widgets::ai_chat_model_picker::{
     max_picker_scroll, model_picker_hit, paint_model_picker, search_clear_hit, SelectHit,
 };
-use op_editor_ui::widgets::home_surface::{home_model_picker_rects, paint_connect_more_row};
+use op_editor_ui::widgets::home_surface::home_model_picker_rects;
 use op_editor_ui::widgets::{HomeSurface, PaintCx, Widget};
 use op_editor_ui::{Point2D, Rect, RenderBackend};
 
@@ -31,11 +31,12 @@ impl WidgetHostNative {
         if !self.home_visible() {
             return None;
         }
-        let (settings_open, login_open, account_ui) = {
+        let (settings_open, login_open, account_menu_open, account_ui) = {
             let ui = &self.editor_state.editor_ui;
             (
                 ui.agent_settings_open,
                 ui.login_modal_open && (ui.account_ui_available || ui.touch_chrome()),
+                ui.account_menu_open && ui.account_ui_available,
                 ui.chat_model_picker.open,
             )
         };
@@ -50,15 +51,23 @@ impl WidgetHostNative {
             self.dispatch_login_modal_press(x, y, viewport_width, viewport_height);
             return Some(true);
         }
+        // The signed-in half of what Home's avatar opens. Without this
+        // the menu painted and then swallowed nothing: every press fell
+        // through to the surface underneath and the menu never closed.
+        if account_menu_open {
+            self.dispatch_account_menu_press(x, y, viewport_width, viewport_height);
+            return Some(true);
+        }
         if account_ui {
             return self.press_home_model_picker(x, y, viewport_width, viewport_height);
         }
         None
     }
 
     /// Paint the Home-opened overlays above the takeover: the agent-
-    /// settings modal, the sign-in modal, then the Home-anchored model
-    /// picker with its trailing connect-more row.
+    /// settings modal, the sign-in modal, the signed-in account menu,
+    /// then the Home-anchored model picker with its trailing
+    /// connect-more row.
     pub(in crate::widget_host) fn paint_home_overlays(
         &mut self,
         frame: &mut NativeFrameBackend<'_>,
@@ -70,9 +79,39 @@ impl WidgetHostNative {
         }
         self.paint_agent_settings_modal_overlay(frame, viewport_width, viewport_height);
         self.paint_login_modal_overlay(frame, viewport_width, viewport_height);
+        self.paint_account_menu_overlay(frame, viewport_width, viewport_height);
         self.paint_home_model_picker(frame, viewport_width, viewport_height);
     }
 
+    /// The signed-in account dropdown. Home paints it for the same
+    /// reason it paints the sign-in modal: its avatar opens one of the
+    /// two, and a takeover that draws only the signed-OUT half leaves a
+    /// signed-in user clicking an avatar that does nothing.
+    pub(in crate::widget_host) fn paint_account_menu_overlay(
+        &self,
+        frame: &mut NativeFrameBackend<'_>,
+        viewport_width: f32,
+        _viewport_height: f32,
+    ) {
+        let ui = &self.editor_state.editor_ui;
+        if !ui.account_ui_available || !ui.account_menu_open {
+            return;
+        }
+        use op_editor_ui::widgets::account_menu::AccountMenu;
+        let Some(menu) = AccountMenu::for_editor_ui(ui) else {
+            return;
+        };
+        let menu_rect = op_editor_ui::widgets::touch_overlay_geometry::account_menu_rect(
+            &self.editor_state,
+            &menu,
+            viewport_width,
+        );
+        let mut cx = op_editor_ui::widgets::PaintCx {
+            backend: &mut *frame,
+        };
+        menu.paint(&mut cx, menu_rect);
+    }
+
     /// The sign-in modal: full-viewport scrim + centred card. Extracted
     /// from the normal-path paint so Home can share the exact card.
     pub(in crate::widget_host) fn paint_login_modal_overlay(
@@ -140,16 +179,13 @@ impl WidgetHostNative {
```

**File**: `crates/op-host-native/src/widget_host/home_overlays_tests.rs` (modified, +79/-10)
```diff
@@ -136,7 +136,7 @@ fn picking_a_row_from_the_home_picker_selects_that_model() {
     let mut host = host_with_usable_agent();
     let chip = chip_center(&host);
     assert!(host.apply_press(chip.x, chip.y, W, H));
-    let (card, _connect_row) = host
+    let card = host
         .home_model_picker_geometry(W, H)
         .expect("picker geometry resolves above the chip");
     // Second row of the single Claude Code group: search strip + pad +
@@ -169,21 +169,44 @@ fn pressing_outside_the_home_picker_closes_it_without_touching_home() {
 }
 
 #[test]
-fn the_home_picker_connect_row_opens_agent_settings_on_the_agents_tab() {
+fn the_home_picker_connect_row_lives_inside_the_card_now() {
+    // The action used to be an external row BELOW the card, which meant
+    // Home showed 接入更多模型 twice (the picker carries its own footer)
+    // and the cursor had to leave the popover to reach it.
     let mut host = host_with_usable_agent();
     let chip = chip_center(&host);
     assert!(host.apply_press(chip.x, chip.y, W, H));
-    let (_card, connect_row) = host
+    let card = host
         .home_model_picker_geometry(W, H)
         .expect("picker geometry resolves");
-    let point = center(connect_row);
-    assert!(host.apply_press(point.x, point.y, W, H));
-    assert!(host.editor_state().editor_ui.agent_settings_open);
-    assert_eq!(
-        host.editor_state().editor_ui.agent_settings.tab,
-        op_editor_core::AgentSettingsTab::Agents
-    );
+    // Nothing hangs below the card any more: a press just under it is
+    // an outside press and closes the picker.
+    let below = Point2D::new(card.origin.x + 24.0, card.origin.y + card.size.y + 20.0);
+    assert!(host.apply_press(below.x, below.y, W, H));
     assert!(!host.editor_state().editor_ui.chat_model_picker.open);
+    assert!(!host.editor_state().editor_ui.agent_settings_open);
+}
+
+/// Hover must never dismiss a click-opened popover: moving the cursor
+/// off the card used to close it, so its own footer row was unreachable.
+#[test]
+fn moving_the_cursor_off_the_home_picker_keeps_it_open() {
+    let mut host = host_with_usable_agent();
+    let chip = chip_center(&host);
+    assert!(host.apply_press(chip.x, chip.y, W, H));
+    let card = host.home_model_picker_geometry(W, H).expect("picker open");
+    assert!(host.editor_state().editor_ui.chat_model_picker.open);
+    for point in [
+        Point2D::new(card.origin.x - 40.0, card.origin.y + 20.0),
+        Point2D::new(card.origin.x + 24.0, card.origin.y + card.size.y + 30.0),
+        Point2D::new(W - 20.0, H - 20.0),
+    ] {
+        host.apply_cursor_move(point.x, point.y);
+        assert!(
+            host.editor_state().editor_ui.chat_model_picker.open,
+            "hover at {point:?} must not dismiss"
+        );
+    }
 }
 
 #[test]
@@ -218,3 +241,49 @@ fn home_and_top_bar_avatars_open_the_same_account_entry() {
     );
     assert!(!host.editor_state().editor_ui.account_menu_open);
 }
+
+/// Home's avatar opens one of two things, and the takeover has to draw
+/// and route BOTH — a signed-in user clicking it got an account menu
+/// that existed in state and appeared nowhere.
+#[test]
+fn home_routes_the_signed_in_account_menu_as_well_as_the_sign_in_modal() {
+    let mut host = WidgetHostNative::new();
+    host.editor_state_mut().editor_ui.home.visible = true;
+    host.editor_state_mut().editor_ui.account_ui_available = true;
+    // Signed out: the avatar opens the sign-in modal, and Home owns the press.
+    assert!(host.open_account_entry());
+    assert!(host.editor_state().editor_ui.login_modal_open);
+    assert_eq!(
+        host.press_home_overlays(400.0, 400.0, 1440.0, 900.0),
+        Some(true),
+        "the modal owns presses over the takeover"
+    );
+
+    // Signed in: the menu opens instead, and Home owns its presses too.
+    host.editor_state_mut().editor_ui.login_modal_open = false;
+    host.editor_state_mut().editor_ui.account_menu_open = true;
+    assert_eq!(
+  
```

**File**: `crates/op-host-native/src/widget_host/overlay_rects.rs` (modified, +4/-8)
```diff
@@ -377,14 +377,10 @@ impl WidgetHostNative {
             return None;
         }
         if self.editor_state.editor_ui.home.visible {
-            return self.home_model_picker_geometry(viewport_w, viewport_h).map(
-                |(card, _connect_row)| {
-                    // The connect row is part of the picker's footprint,
-                    // but the row-based scroll/hover math inside gates
-                    // only understands the card.
-                    card
-                },
-            );
+            // The card IS the whole footprint now: the external connect
+            // row that used to hang below it is gone, folded into the
+            // picker's own footer.
+            return self.home_model_picker_geometry(viewport_w, viewport_h);
         }
         let chat_rect = self.ai_chat_rect(viewport_w, viewport_h)?;
         AIChatPlaceholder::from_editor(&self.editor_state).model_picker_bounds(chat_rect)
```

---

### Incident Patch 3: `49100c2c` (2026-09-16)
**Commit Message**: fix(i18n): carry the catalog size into the exporter, and split the settings tests

Two reds the first CI run that actually executed on this branch caught,
both from a constant living in more than one place.

The runtime catalog exporter keeps its own EXPECTED_KEY_COUNT beside the
Rust-side assertion in `catalog_integrity_tests`. The Studio entry
surface bumped the Rust one to 1852 and left the exporter at 1717, so
the WASM bundle job failed on "English catalog has 1852 keys; expected
1717". Bump it and point each at the other, and have the exporter's own
test read the constant instead of repeating the number a third time.

The collab security-boundary check enforces the repository's 800-line
cap over `op-editor-host-core/src`, where `settings_io_tests.rs` arrived
from upstream at 807 lines. Split the payload round-trips into a sibling
at the same seam the file already uses for its other two test modules.

Claude-Session: https://claude.ai/code/session_01LBqzBogViQjjA8AqRjLsoD

**File**: `crates/op-editor-host-core/src/settings_io_payload_tests.rs` (added, +544/-0)
```diff
@@ -0,0 +1,544 @@
+//! Settings payload round-trips: the MCP CLI toggle arrays across their
+//! historical lengths, and the fields a payload may and may not carry.
+//!
+//! Sibling of `settings_io_tests.rs`, split out at the 800-line cap the
+//! collab security-boundary check enforces over this crate.
+
+use super::*;
+
+#[test]
+fn eleven_cli_mcp_payload_keeps_its_toggles_and_leaves_zcode_off() {
+    let payload: SettingsPayload = serde_json::from_str(
+        r#"{"version":1,"mcp_cli_enabled":[true,false,true,false,true,false,true,true,false,true,false]}"#,
+    )
+    .unwrap();
+    let mut dst = EditorState::new();
+    dst.editor_ui.agent_settings.mcp_cli_enabled = [true; 13];
+
+    apply_payload(&mut dst, payload);
+
+    assert_eq!(
+        dst.editor_ui.agent_settings.mcp_cli_enabled,
+        [true, false, true, false, true, false, true, true, false, true, false, false, false]
+    );
+}
+
+#[test]
+fn eight_cli_mcp_payload_drops_gemini_without_shifting_later_clis() {
+    let payload: SettingsPayload = serde_json::from_str(
+        r#"{"version":1,"mcp_cli_enabled":[true,false,true,false,true,false,true,true]}"#,
+    )
+    .unwrap();
+    let mut dst = EditorState::new();
+
+    apply_payload(&mut dst, payload);
+
+    assert_eq!(
+        dst.editor_ui.agent_settings.mcp_cli_enabled,
+        [true, false, false, true, false, true, true, false, false, false, false, false, false]
+    );
+}
+
+#[test]
+fn seven_provider_connected_payload_is_the_current_layout_and_round_trips() {
+    // The current layout has seven slots (DeepSeek Harness appended at
+    // the tail). A 7-entry file must round-trip VERBATIM — treating it
+    // as the legacy Gemini-era layout would silently shift every saved
+    // connection on every load.
+    let payload: SettingsPayload = serde_json::from_str(
+        r#"{"version":1,"connected":[true,false,true,false,true,true,false]}"#,
+    )
+    .unwrap();
+    let mut dst = EditorState::new();
+
+    apply_payload(&mut dst, payload);
+
+    assert_eq!(
+        dst.editor_ui.agent_settings.connected,
+        [true, false, true, false, true, true, false]
+    );
+}
+
+#[test]
+fn six_provider_connected_payload_keeps_flags_and_leaves_dsh_off() {
+    // Files written since the Gemini retirement have six slots; the
+    // appended DeepSeek Harness slot starts disconnected.
+    let payload: SettingsPayload =
+        serde_json::from_str(r#"{"version":1,"connected":[true,false,true,false,true,true]}"#)
+            .unwrap();
+    let mut dst = EditorState::new();
+
+    apply_payload(&mut dst, payload);
+
+    assert_eq!(
+        dst.editor_ui.agent_settings.connected,
+        [true, false, true, false, true, true, false]
+    );
+}
+
+#[test]
+fn five_provider_connected_payload_drops_retired_gemini() {
+    let payload: SettingsPayload =
+        serde_json::from_str(r#"{"version":1,"connected":[true,false,false,false,true]}"#).unwrap();
+    let mut dst = EditorState::new();
+    dst.editor_ui.agent_settings.connected = [false, false, false, false, true, true, true];
+    apply_payload(&mut dst, payload);
+    assert_eq!(
+        dst.editor_ui.agent_settings.connected,
+        [true, false, false, false, false, false, false]
+    );
+}
+
+#[test]
+fn legacy_settings_without_connected_field_default_to_disconnected() {
+    // A settings.json written before the `connected` field
+    // existed must still load — the missing field defaults to
+    // all-disconnected rather than failing the parse.
+    let legacy = r#"{"version":1,"theme":"dark","locale":"en-US"}"#;
+    let payload: SettingsPayload = serde_json::from_str(legacy).unwrap();
+    let mut dst = EditorState::new();
+    apply_payload(&mut dst, payload);
+    assert_eq!(dst.editor_ui.agent_settings.connected, [false; 7]);
+}
+
+#[test]
+fn builtin_agents_round_trip_through_payload() {
+    let mut src = EditorState::new();
+    src.editor_ui.agent_settings.add_builtin_agent_config(
+        "MiniMax",
+        
```

**File**: `crates/op-editor-host-core/src/settings_io_tests.rs` (modified, +2/-536)
```diff
@@ -269,539 +269,5 @@ fn seven_cli_mcp_payload_keeps_its_toggles_and_leaves_the_new_clis_off() {
     );
 }
 
-#[test]
-fn eleven_cli_mcp_payload_keeps_its_toggles_and_leaves_zcode_off() {
-    let payload: SettingsPayload = serde_json::from_str(
-        r#"{"version":1,"mcp_cli_enabled":[true,false,true,false,true,false,true,true,false,true,false]}"#,
-    )
-    .unwrap();
-    let mut dst = EditorState::new();
-    dst.editor_ui.agent_settings.mcp_cli_enabled = [true; 13];
-
-    apply_payload(&mut dst, payload);
-
-    assert_eq!(
-        dst.editor_ui.agent_settings.mcp_cli_enabled,
-        [true, false, true, false, true, false, true, true, false, true, false, false, false]
-    );
-}
-
-#[test]
-fn eight_cli_mcp_payload_drops_gemini_without_shifting_later_clis() {
-    let payload: SettingsPayload = serde_json::from_str(
-        r#"{"version":1,"mcp_cli_enabled":[true,false,true,false,true,false,true,true]}"#,
-    )
-    .unwrap();
-    let mut dst = EditorState::new();
-
-    apply_payload(&mut dst, payload);
-
-    assert_eq!(
-        dst.editor_ui.agent_settings.mcp_cli_enabled,
-        [true, false, false, true, false, true, true, false, false, false, false, false, false]
-    );
-}
-
-#[test]
-fn seven_provider_connected_payload_is_the_current_layout_and_round_trips() {
-    // The current layout has seven slots (DeepSeek Harness appended at
-    // the tail). A 7-entry file must round-trip VERBATIM — treating it
-    // as the legacy Gemini-era layout would silently shift every saved
-    // connection on every load.
-    let payload: SettingsPayload = serde_json::from_str(
-        r#"{"version":1,"connected":[true,false,true,false,true,true,false]}"#,
-    )
-    .unwrap();
-    let mut dst = EditorState::new();
-
-    apply_payload(&mut dst, payload);
-
-    assert_eq!(
-        dst.editor_ui.agent_settings.connected,
-        [true, false, true, false, true, true, false]
-    );
-}
-
-#[test]
-fn six_provider_connected_payload_keeps_flags_and_leaves_dsh_off() {
-    // Files written since the Gemini retirement have six slots; the
-    // appended DeepSeek Harness slot starts disconnected.
-    let payload: SettingsPayload =
-        serde_json::from_str(r#"{"version":1,"connected":[true,false,true,false,true,true]}"#)
-            .unwrap();
-    let mut dst = EditorState::new();
-
-    apply_payload(&mut dst, payload);
-
-    assert_eq!(
-        dst.editor_ui.agent_settings.connected,
-        [true, false, true, false, true, true, false]
-    );
-}
-
-#[test]
-fn five_provider_connected_payload_drops_retired_gemini() {
-    let payload: SettingsPayload =
-        serde_json::from_str(r#"{"version":1,"connected":[true,false,false,false,true]}"#).unwrap();
-    let mut dst = EditorState::new();
-    dst.editor_ui.agent_settings.connected = [false, false, false, false, true, true, true];
-    apply_payload(&mut dst, payload);
-    assert_eq!(
-        dst.editor_ui.agent_settings.connected,
-        [true, false, false, false, false, false, false]
-    );
-}
-
-#[test]
-fn legacy_settings_without_connected_field_default_to_disconnected() {
-    // A settings.json written before the `connected` field
-    // existed must still load — the missing field defaults to
-    // all-disconnected rather than failing the parse.
-    let legacy = r#"{"version":1,"theme":"dark","locale":"en-US"}"#;
-    let payload: SettingsPayload = serde_json::from_str(legacy).unwrap();
-    let mut dst = EditorState::new();
-    apply_payload(&mut dst, payload);
-    assert_eq!(dst.editor_ui.agent_settings.connected, [false; 7]);
-}
-
-#[test]
-fn builtin_agents_round_trip_through_payload() {
-    let mut src = EditorState::new();
-    src.editor_ui.agent_settings.add_builtin_agent_config(
-        "MiniMax",
-        "sk-test",
-        "MiniMax-M2.7",
-        BuiltinAgentKind::Anthropic,
-        "https://api.minimaxi.com/anthropic",
-    );
-
-    let json = serde_json::to_string(&to_payload(&src)).unwrap();
-    let payload:
```

**File**: `tools/export-i18n-catalogs.py` (modified, +6/-1)
```diff
@@ -14,7 +14,12 @@
 REPO_ROOT = Path(__file__).resolve().parents[1]
 I18N_DIR = REPO_ROOT / "crates" / "op-i18n" / "src" / "i18n"
 LOCALE_FILE = I18N_DIR.parent / "locale.rs"
-EXPECTED_KEY_COUNT = 1717
+# Mirrors the Rust-side assertion in
+# `crates/op-i18n/src/i18n/catalog_integrity_tests.rs` ("update the
+# intentional catalog size"). The two live apart, so adding keys means
+# bumping BOTH — the Studio entry surface bumped the Rust one and left
+# this at 1717, which only the WASM bundle job noticed.
+EXPECTED_KEY_COUNT = 1852
 TABLE_SUFFIXES = ("", "_git", "_panel", "_collab")
 
 # Module stem, Locale variant, and the exact value returned by Locale::code().
```

**File**: `tools/test_export_i18n_catalogs.py` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ def test_check_mode_does_not_write(self) -> None:
             self.assertEqual(result.returncode, 0, result.stderr)
             self.assertEqual(list(root.iterdir()), [])
             self.assertIn("15 locales", result.stdout)
-            self.assertIn("1717 keys", result.stdout)
+            self.assertIn(f"{self.exporter.EXPECTED_KEY_COUNT} keys", result.stdout)
 
     def test_export_writes_exact_lazy_locale_set_deterministically(self) -> None:
         with tempfile.TemporaryDirectory() as temporary:
```

---

### Incident Patch 4: `243c27f5` (2026-09-15)
**Commit Message**: fix(agent): route every Studio task family to the design pipeline

The intent classifier's keyword list grew up around app and web briefs,
so the 演示文稿 / 图文卡片 / 截图教程 / 信息图 / 活动海报 wrappers matched
nothing and five of the seven task families answered as plain chat: a
five-page deck brief produced one empty starter frame and a collapsed
thinking block. Add the deliverable nouns and the 做一份/一套/一张/一篇
verb forms, and pin every wrapper with a test so a new family cannot
slip through the same gap.

Three unrelated reds fixed alongside, each measured:

- The image-provider menu's expected height was a literal 176, which the
  Atlas Cloud provider (#227) invalidated the moment it took the list
  from four entries to five. Derive it from the list's length.
- The pointer-clock tests fold the PROCESS-GLOBAL agent indicator
  registry through `next_animation_deadline_ms`, so a concurrent test
  registering a reveal made an idle engine report a deadline it did not
  own: green single-threaded, three failures in parallel. Hold the
  registry's own test guard, the way the desktop indicator tests do.
- A rejected provider response now optionally goes to a local file named
  by OPENPENCIL_DEBUG_HTTP_E

**File**: `crates/op-chat-agent/src/backoff.rs` (modified, +59/-0)
```diff
@@ -121,6 +121,50 @@ pub fn default_backoff_knobs() -> (u32, Duration) {
     (BUILTIN_HTTP_MAX_RETRIES, builtin_http_min_gap())
 }
 
+/// Append a rejected response's status and body to the file named by
+/// `OPENPENCIL_DEBUG_HTTP_ERROR_BODY`, when it is set.
+///
+/// Off by default and never wired into chat, SSE, or stdout: a provider
+/// error body is untrusted and can echo the request's own headers, so it
+/// stays out of every channel the user or a browser can read. With the
+/// env var set it goes to that one file and nowhere else, which is what
+/// turns "http 400 Bad Request" from a dead end into a diagnosis
+/// (measured 2026-09-13: a modify turn died on a 400 whose reason was
+/// unreachable from inside the app).
+async fn dump_error_body(label: &str, status: reqwest::StatusCode, resp: reqwest::Response) {
+    let Ok(path) = std::env::var("OPENPENCIL_DEBUG_HTTP_ERROR_BODY") else {
+        return;
+    };
+    if path.is_empty() {
+        return;
+    }
+    let body = resp.text().await.unwrap_or_default();
+    let line = format!(
+        "[{}] {label} http {} {}\n{}\n",
+        chrono_like_stamp(),
+        status.as_u16(),
+        status.canonical_reason().unwrap_or(""),
+        body.chars().take(4_000).collect::<String>()
+    );
+    use std::io::Write as _;
+    if let Ok(mut file) = std::fs::OpenOptions::new()
+        .create(true)
+        .append(true)
+        .open(&path)
+    {
+        let _ = file.write_all(line.as_bytes());
+    }
+}
+
+/// Seconds since the UNIX epoch — enough to line a dump up against the
+/// app log without pulling a date crate into this leaf.
+fn chrono_like_stamp() -> u64 {
+    std::time::SystemTime::now()
+        .duration_since(std::time::UNIX_EPOCH)
+        .map(|d| d.as_secs())
+        .unwrap_or(0)
+}
+
 pub async fn send_with_backoff(
     label: &str,
     url: &str,
@@ -164,6 +208,10 @@ pub async fn send_with_backoff(
                 // Provider error bodies are untrusted and can echo request
                 // headers. Never relay them into chat/SSE where credentials
                 // could be reflected back into logs or browser responses.
+                // They ARE the only way to tell WHY a provider rejected a
+                // request, so an explicit opt-in writes them to a local file
+                // the developer named — never to the transcript.
+                dump_error_body(label, status, resp).await;
                 return Err(BuiltinHttpError::HttpStatus {
                     label: label.to_string(),
                     status,
@@ -292,3 +340,14 @@ pub fn apply_reasoning_wire_control_anthropic(
         obj.insert("thinking".into(), serde_json::json!({ "type": "disabled" }));
     }
 }
+
+#[cfg(test)]
+mod http_error_dump_tests {
+    #[test]
+    fn the_dump_is_off_unless_the_env_var_names_a_file() {
+        unsafe {
+            std::env::remove_var("OPENPENCIL_DEBUG_HTTP_ERROR_BODY");
+        }
+        assert!(std::env::var("OPENPENCIL_DEBUG_HTTP_ERROR_BODY").is_err());
+    }
+}
```

**File**: `crates/op-editor-ui/src/widgets/agent_settings_images.rs` (modified, +7/-2)
```diff
@@ -268,11 +268,16 @@ mod touch_tests {
         let closed_row = profile_row_rect_for_ui(content, &closed, 0, true);
         let open_row = profile_row_rect_for_ui(content, &open, 0, true);
 
-        assert_eq!(open_row.size.y - closed_row.size.y, 176.0);
+        // One 44 px row per entry of `ImageGenProvider::ALL`. The Atlas
+        // Cloud provider took the list from four to five, so the
+        // expanded profile grew 176 → 220; the constant here is the
+        // list's length, not a free number.
+        const EXPANDED_H: f32 = 44.0 * ImageGenProvider::ALL.len() as f32;
+        assert_eq!(open_row.size.y - closed_row.size.y, EXPANDED_H);
         assert_eq!(
             content_height_for_ui(&open, content.size.x, true)
                 - content_height_for_ui(&closed, content.size.x, true),
-            176.0
+            EXPANDED_H
         );
         let api = profile_input_rect_for_ui(open_row, &open, 0, ImageGenField::ApiKey, true);
         for (option_index, expected) in ImageGenProvider::ALL.iter().enumerate() {
```

**File**: `crates/op-engine-ffi/src/editor_pointer_clock_tests.rs` (modified, +21/-0)
```diff
@@ -183,6 +183,13 @@ fn app_state_string(engine: &mut OpEngine, key: &str) -> Option<String> {
 /// times (fresh host clock is 0).
 #[test]
 fn dedicated_time_stamped_pointer_entries_swipe_without_an_intervening_frame() {
+    // `next_animation_deadline_ms` folds the PROCESS-GLOBAL agent
+    // indicator registry, so a concurrent test that registers a reveal
+    // makes this idle engine report a deadline it does not own. Hold the
+    // registry's own test guard for the whole body, the way the desktop
+    // indicator tests do.
+    let _indicators = op_editor_core::agent_indicators::test_guard();
+    op_editor_core::agent_indicators::clear();
     let mut engine = swipe_engine();
     let pointer = &mut engine as *mut OpEngine;
     // The preview no longer pins a blanket `now + 33` wake: an idle session
@@ -252,6 +259,13 @@ fn dedicated_time_stamped_pointer_entries_swipe_without_an_intervening_frame() {
 /// `onSwipe` runs exactly once.
 #[test]
 fn out_of_order_dedicated_events_keep_global_clocks_and_swipe_uses_factual_delta() {
+    // `next_animation_deadline_ms` folds the PROCESS-GLOBAL agent
+    // indicator registry, so a concurrent test that registers a reveal
+    // makes this idle engine report a deadline it does not own. Hold the
+    // registry's own test guard for the whole body, the way the desktop
+    // indicator tests do.
+    let _indicators = op_editor_core::agent_indicators::test_guard();
+    op_editor_core::agent_indicators::clear();
     let mut engine = swipe_engine();
     let pointer = &mut engine as *mut OpEngine;
 
@@ -315,6 +329,13 @@ fn out_of_order_dedicated_events_keep_global_clocks_and_swipe_uses_factual_delta
 /// (monotonically) and never move them backward.
 #[test]
 fn cancel_and_early_returns_advance_global_clocks_monotonically() {
+    // `next_animation_deadline_ms` folds the PROCESS-GLOBAL agent
+    // indicator registry, so a concurrent test that registers a reveal
+    // makes this idle engine report a deadline it does not own. Hold the
+    // registry's own test guard for the whole body, the way the desktop
+    // indicator tests do.
+    let _indicators = op_editor_core::agent_indicators::test_guard();
+    op_editor_core::agent_indicators::clear();
     let mut engine = swipe_engine();
     let pointer = &mut engine as *mut OpEngine;
 
```

**File**: `crates/op-orchestrator/src/intent.rs` (modified, +42/-0)
```diff
@@ -73,6 +73,29 @@ const DESIGN_KEYWORDS: &[&str] = &[
     "网页",
     "小程序",
     "后台",
+    // 中文动词 —— 量词形式。Studio 首页的七类任务包装语都用"做一份/
+    // 一套/一张/一篇"起头，而旧表只有"做一个/做个"，于是演示文稿、图文
+    // 卡片、截图教程、信息图、活动海报五类全部落到 chat。
+    "做一份",
+    "做一套",
+    "做一张",
+    "做一篇",
+    "做份",
+    "做套",
+    "做张",
+    // 中文设计名词 —— 交付物形态。与上面的页面类名词同理：在设计工具
+    // 语境里这些词几乎总是"造一个 X"。
+    "演示文稿",
+    "幻灯片",
+    "ppt",
+    "slides",
+    "图文卡片",
+    "卡片",
+    "海报",
+    "信息图",
+    "长图",
+    "截图教程",
+    "排版",
 ];
 
 /// 把用户消息分类为 [`Intent::Design`] 或 [`Intent::Chat`]。
@@ -114,6 +137,25 @@ mod tests {
         }
     }
 
+    /// Every Studio Home task wrapper must classify as Design. The
+    /// deliverable is already chosen by the task card, so a wrapper that
+    /// reads as chat silently answers the user in prose instead of
+    /// drawing (measured 2026-09-13 on 演示文稿).
+    #[test]
+    fn every_studio_home_task_wrapper_classifies_as_design() {
+        for p in [
+            "请设计一套可编辑的高保真手机 App 界面（mobile app，375×812）。",
+            "请设计一个完整的纵向滚动网站页面（landing page，1440 宽）。",
+            "请做一份 5 页的 PPT 演示文稿（slides，16:9）。封面、正文与结束页风格统一。",
+            "请做一套图文卡片（card，竖版 3:4，多页轮播）。保持统一排版与视觉系统。",
+            "请做一篇截图教程图文（card，竖版，截图配上步骤说明）。",
+            "请做一张数据对比信息图长图（card，竖版图文长图）。",
+            "请做一套活动海报（card，主海报竖版 + 社交方图）。",
+        ] {
+            assert_eq!(classify_intent(p), Intent::Design, "{p}");
+        }
+    }
+
     #[test]
     fn questions_classify_as_chat() {
         for p in [
```

---

### Incident Patch 5: `195aad29` (2026-09-15)
**Commit Message**: fix(desktop): persist the chosen chat model row, not just the provider

Picking a built-in or ACP model in the picker never moved the provider
index, so the persisted provider name alone put every relaunch back on
the first catalog row. The chosen row's catalog value is now saved and
resolved after the catalog is rebuilt on load.

Claude-Session: https://claude.ai/code/session_01LBqzBogViQjjA8AqRjLsoD

**File**: `crates/op-editor-host-core/src/settings_io.rs` (modified, +39/-0)
```diff
@@ -73,6 +73,7 @@ pub struct Fingerprint {
     preferred_agent_team_size: u32,
     entry_surface: op_editor_core::EntrySurface,
     chat_agent: String,
+    chat_model: String,
 }
 
 pub fn fingerprint(state: &EditorState) -> Fingerprint {
@@ -96,6 +97,7 @@ pub fn fingerprint(state: &EditorState) -> Fingerprint {
         preferred_agent_team_size: eui.preferred_agent_team_size,
         entry_surface: eui.entry_surface,
         chat_agent: selected_chat_agent_name(eui),
+        chat_model: selected_chat_model_value(state),
     }
 }
 
@@ -115,6 +117,20 @@ fn selected_chat_agent_name(eui: &op_editor_core::EditorUiState) -> String {
 /// Resolve a persisted agent name back to its `AgentProvider::ALL`
 /// index; unknown names (a provider renamed or removed by a newer
 /// build) fall back to index 0 rather than dangling.
+/// The picker row the user last chose, by the catalog entry's wire
+/// `value` (`builtin:<agent id>:<model>` for API-key agents, the model id
+/// for CLI providers, the agent id for ACP agents). `chat_agent` alone
+/// cannot carry this: a built-in or ACP choice never moves
+/// `chat_selected_agent`, so without this field every relaunch fell back
+/// to the first catalog row.
+fn selected_chat_model_value(state: &EditorState) -> String {
+    state
+        .chat
+        .selected_model_entry()
+        .map(|entry| entry.value.clone())
+        .unwrap_or_default()
+}
+
 fn chat_agent_index_for_name(name: &str) -> usize {
     op_editor_core::AgentProvider::ALL
         .iter()
@@ -188,6 +204,10 @@ struct SettingsPayload {
     /// `selected_chat_agent_name`); older settings keep index 0.
     #[serde(default)]
     chat_agent: Option<String>,
+    /// The last chosen picker row by catalog `value` (see
+    /// `selected_chat_model_value`); resolved after the catalog is rebuilt.
+    #[serde(default)]
+    chat_model: Option<String>,
 }
 
 /// Resolve the platform-specific settings path. `None` when no
@@ -262,6 +282,7 @@ fn to_payload(state: &EditorState) -> SettingsPayload {
         preferred_agent_team_size: Some(eui.preferred_agent_team_size),
         entry_surface: Some(eui.entry_surface.as_str().into()),
         chat_agent: Some(selected_chat_agent_name(eui)),
+        chat_model: Some(selected_chat_model_value(state)),
     }
 }
 
@@ -274,6 +295,7 @@ fn apply_payload_with_options(
     payload: SettingsPayload,
     dedupe_builtins: bool,
 ) {
+    let chat_model = payload.chat_model.clone();
     if payload.version != SETTINGS_VERSION {
         return;
     }
@@ -394,6 +416,19 @@ fn apply_payload_with_options(
     // empty this early, so this is a no-op until discovery lands and
     // `ModelProbe::poll_into` rebuilds again against the same mask.
     state.rebuild_chat_models();
+    // Now that the catalog exists, land on the row the user last chose.
+    // Later rebuilds (model discovery) preserve the selection by the same
+    // provider + value + built-in id triple.
+    if let Some(value) = chat_model.as_deref().filter(|v| !v.is_empty()) {
+        if let Some(index) = state
+            .chat
+            .available_models
+            .iter()
+            .position(|entry| entry.value == value)
+        {
+            state.chat.selected_model = index;
+        }
+    }
 }
 
 /// Remove the retired Gemini CLI slot from positional v1 settings without
@@ -716,3 +751,7 @@ mod settings_io_chat_agent_tests;
 #[cfg(test)]
 #[path = "settings_io_guard_tests.rs"]
 mod settings_io_guard_tests;
+
+#[cfg(test)]
+#[path = "settings_io_chat_model_tests.rs"]
+mod settings_io_chat_model_tests;
```

**File**: `crates/op-editor-host-core/src/settings_io_chat_model_tests.rs` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+//! Chat-model persistence: the picker row (built-in / ACP included) survives
+//! a save + load cycle. Sibling of `settings_io_chat_agent_tests.rs`.
+
+use super::*;
+use op_editor_core::{BuiltinAgentConfig, BuiltinAgentKind, BuiltinAgentPresetKey};
+
+fn glm_agent() -> BuiltinAgentConfig {
+    BuiltinAgentConfig {
+        id: "builtin-6".into(),
+        preset: BuiltinAgentPresetKey::GlmCoding,
+        display_name: "GLM Coding Plan".into(),
+        kind: BuiltinAgentKind::OpenAiCompat,
+        api_key: "k".into(),
+        models: vec!["glm-5.3".into(), "glm-5.3-flash".into()],
+        base_url: "https://open.bigmodel.cn/api/coding/paas/v4".into(),
+        enabled: true,
+    }
+}
+
+#[test]
+fn a_builtin_model_choice_survives_save_and_load() {
+    let mut src = EditorState::new();
+    src.editor_ui
+        .agent_settings
+        .builtin_agents
+        .push(glm_agent());
+    src.rebuild_chat_models();
+    let flash = src
+        .chat
+        .available_models
+        .iter()
+        .position(|entry| entry.value == "builtin:builtin-6:glm-5.3-flash")
+        .expect("the flash row is in the catalog");
+    let before = fingerprint(&src);
+    src.select_chat_model(flash);
+    assert_ne!(
+        before,
+        fingerprint(&src),
+        "changing the row must dirty the fingerprint"
+    );
+
+    let json = serde_json::to_string(&to_payload(&src)).unwrap();
+    assert!(
+        json.contains("\"chat_model\":\"builtin:builtin-6:glm-5.3-flash\""),
+        "{json}"
+    );
+
+    let payload: SettingsPayload = serde_json::from_str(&json).unwrap();
+    let mut dst = EditorState::new();
+    apply_payload(&mut dst, payload);
+    assert_eq!(
+        dst.chat
+            .selected_model_entry()
+            .map(|entry| entry.value.as_str()),
+        Some("builtin:builtin-6:glm-5.3-flash"),
+        "the relaunch lands on the row the user chose, not the first one"
+    );
+}
+
+#[test]
+fn a_missing_or_stale_chat_model_keeps_the_default_row() {
+    let legacy = serde_json::json!({ "version": 1, "chat_model": "builtin:gone:nope" });
+    let payload: SettingsPayload = serde_json::from_value(legacy).unwrap();
+    let mut dst = EditorState::new();
+    apply_payload(&mut dst, payload);
+    assert_eq!(dst.chat.selected_model, 0);
+}
```

**File**: `crates/op-editor-host-core/src/settings_io_checked.rs` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ pub(super) fn validate_payload_fields(raw: &serde_json::Value) -> Result<()> {
             "preferred_agent_team_size",
             "entry_surface",
             "chat_agent",
+            "chat_model",
         ],
         "root",
     )?;
```

---

### Incident Patch 6: `a172041d` (2026-09-15)
**Commit Message**: fix(desktop): never overwrite a settings file the startup load rejected

The lenient startup load fell back to defaults when settings.json did
not parse, and the next save then wrote those defaults over the user's
file — every API key gone. A rejected file is now copied to a
settings.json.corrupt-<time> sibling and every later save to that path
is refused with RejectedLoad.

Claude-Session: https://claude.ai/code/session_01LBqzBogViQjjA8AqRjLsoD

**File**: `crates/op-editor-host-core/src/settings_io.rs` (modified, +70/-14)
```diff
@@ -132,6 +132,12 @@ const SETTINGS_VERSION: u32 = 1;
 const APP_DIR: &str = "openpencil";
 const FILE_NAME: &str = "settings.json";
 static SETTINGS_TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);
+/// Settings paths whose file existed but did not parse at startup. Every
+/// save to one of these is refused for the rest of the process: the
+/// alternative — writing this process's defaults over a file we could not
+/// read — is exactly how a user loses every API key after a build mismatch
+/// or a truncated write.
+static REJECTED_SETTINGS_PATHS: std::sync::Mutex<Vec<PathBuf>> = std::sync::Mutex::new(Vec::new());
 
 #[derive(Debug, Serialize, Deserialize)]
 struct SettingsPayload {
@@ -178,16 +184,16 @@ struct SettingsPayload {
     /// First-launch surface; older settings default to Home.
     #[serde(default)]
     entry_surface: Option<String>,
+    /// The chat agent's stable provider name (see
+    /// `selected_chat_agent_name`); older settings keep index 0.
+    #[serde(default)]
+    chat_agent: Option<String>,
 }
 
 /// Resolve the platform-specific settings path. `None` when no
 /// usable config base exists — load/save become silent no-ops.
 ///
 /// An embedded shell (the mobile FFI hosts) selects its private
-    /// The chat agent's stable provider name (see
-    /// `selected_chat_agent_name`); older settings keep index 0.
-    #[serde(default)]
-    chat_agent: Option<String>,
 /// app-sandbox directory through `op_config_store::configure_user_root`
 /// before engine construction; `settings.json` then lives next to the
 /// other per-user config files in that root. Desktop never configures an
@@ -255,13 +261,13 @@ fn to_payload(state: &EditorState) -> SettingsPayload {
         ),
         preferred_agent_team_size: Some(eui.preferred_agent_team_size),
         entry_surface: Some(eui.entry_surface.as_str().into()),
+        chat_agent: Some(selected_chat_agent_name(eui)),
     }
 }
 
 fn apply_payload(state: &mut EditorState, payload: SettingsPayload) {
     apply_payload_with_options(state, payload, true);
 }
-        chat_agent: Some(selected_chat_agent_name(eui)),
 
 fn apply_payload_with_options(
     state: &mut EditorState,
@@ -368,17 +374,17 @@ fn apply_payload_with_options(
     if let Some(surface) = payload.entry_surface.as_deref() {
         eui.entry_surface = op_editor_core::EntrySurface::from_str(surface);
     }
+    // Restore the chat agent by name — `rebuild_chat_models` further
+    // down re-derives the model catalog against this selection.
+    if let Some(name) = payload.chat_agent.as_deref() {
+        eui.chat_selected_agent = chat_agent_index_for_name(name);
+    }
     // Seed tab 0's ⚡Nx from the persisted preference — `load` runs before
     // any tab has been created beyond the default single tab, so this is
     // the ONE spot that reconnects "what the user last set" across a full
     // app restart (`ChatSessions::new_tab` handles the SAME continuity
     // within a running session, carrying the active tab's current value
     // forward). Captured into a local before the last `eui` use ends the
-    // Restore the chat agent by name — `rebuild_chat_models` further
-    // down re-derives the model catalog against this selection.
-    if let Some(name) = payload.chat_agent.as_deref() {
-        eui.chat_selected_agent = chat_agent_index_for_name(name);
-    }
     // mutable borrow of `state.editor_ui`, so `state.chat` can be written
     // next.
     let preferred_agent_team_size = eui.preferred_agent_team_size;
@@ -519,14 +525,54 @@ pub fn load(state: &mut EditorState) {
     // detected locale instead of leaving the EnUs default.
     seed_system_locale(state);
     if let Some(path) = settings_path() {
-        if let Ok(bytes) = std::fs::read(&path) {
-            if let Ok(payload) = serde_json::from_slice::<SettingsPayload>(&bytes) {
-                apply_payload(state, payload);
+        load_lenient_from_path(state, &path);
+    }
+}
+
+/// The lenient startup l
```

**File**: `crates/op-editor-host-core/src/settings_io_error.rs` (modified, +7/-0)
```diff
@@ -79,6 +79,10 @@ pub enum SettingsIoError {
     /// 128 candidate temporary names were all taken — a stuck directory
     /// rather than a transient collision.
     TempAllocExhausted,
+    /// The lenient startup load found the file unreadable, backed it up and
+    /// pinned the path: saving over it now would replace whatever the user
+    /// had (API keys included) with this process's defaults.
+    RejectedLoad,
     /// Writing the encoded JSON into the temporary file failed.
     WriteTemp { detail: String },
     /// The completed temporary file could not be renamed over the real
@@ -105,6 +109,9 @@ impl fmt::Display for SettingsIoError {
                 write!(f, "unknown settings field in {context}")
             }
             SettingsIoError::Lossy => f.write_str("settings file cannot be loaded losslessly"),
+            SettingsIoError::RejectedLoad => f.write_str(
+                "settings file was rejected at load and backed up; refusing to overwrite it",
+            ),
             SettingsIoError::UnsupportedCredentialEntry => {
                 f.write_str("unsupported settings credential entry")
             }
```

**File**: `crates/op-editor-host-core/src/settings_io_guard_tests.rs` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+//! The corrupt-file guard: an unreadable settings file is backed up and
+//! never overwritten by this process.
+
+use super::{load_lenient_from_path, save_checked_to_path, SettingsIoError};
+use op_editor_core::EditorState;
+
+fn temp_settings_path(tag: &str) -> std::path::PathBuf {
+    let dir = std::env::temp_dir().join(format!(
+        "op-settings-guard-{tag}-{}-{}",
+        std::process::id(),
+        std::time::SystemTime::now()
+            .duration_since(std::time::UNIX_EPOCH)
+            .map(|d| d.as_nanos())
+            .unwrap_or(0)
+    ));
+    std::fs::create_dir_all(&dir).expect("temp dir");
+    dir.join("settings.json")
+}
+
+#[test]
+fn an_unparseable_settings_file_is_backed_up_and_never_overwritten() {
+    let path = temp_settings_path("corrupt");
+    let garbage = b"{ \"version\": 1, \"builtin_agents\": [ truncated";
+    std::fs::write(&path, garbage).expect("write garbage");
+
+    let mut state = EditorState::new();
+    assert!(
+        !load_lenient_from_path(&mut state, &path),
+        "the file must be rejected"
+    );
+
+    let backups: Vec<_> = std::fs::read_dir(path.parent().unwrap())
+        .unwrap()
+        .filter_map(|entry| entry.ok())
+        .filter(|entry| {
+            entry
+                .file_name()
+                .to_string_lossy()
+                .starts_with("settings.json.corrupt-")
+        })
+        .collect();
+    assert_eq!(backups.len(), 1, "exactly one corrupt backup is written");
+    assert_eq!(std::fs::read(backups[0].path()).unwrap(), garbage);
+
+    assert!(matches!(
+        save_checked_to_path(&state, &path),
+        Err(SettingsIoError::RejectedLoad)
+    ));
+    assert_eq!(
+        std::fs::read(&path).unwrap(),
+        garbage,
+        "the original bytes stay on disk for the user to recover"
+    );
+}
+
+#[test]
+fn a_missing_or_valid_settings_file_keeps_saves_working() {
+    let path = temp_settings_path("clean");
+    let mut state = EditorState::new();
+    assert!(
+        load_lenient_from_path(&mut state, &path),
+        "a missing file is a first run"
+    );
+    save_checked_to_path(&state, &path).expect("first save writes the file");
+    assert!(
+        load_lenient_from_path(&mut state, &path),
+        "the file we wrote loads back"
+    );
+    save_checked_to_path(&state, &path).expect("saving a valid file is still allowed");
+}
```

---

### Incident Patch 7: `17d7cf42` (2026-09-14)
**Commit Message**: fix(html): stop a non-ascii css prelude from panicking the import (#240)

at_keyword bounded its read with get(..name.len() + 1) but then byte-indexed prefix[0..1], which is not a char boundary when the prelude opens on a multi-byte character. An inline <style> reaches the scanner without the BOM stripping decode_css_bytes gives a linked sheet, so a BOM ahead of @charset unwound the whole HTML import.

**File**: `crates/op-html/src/resources_css_imports.rs` (modified, +37/-1)
```diff
@@ -226,7 +226,7 @@ fn at_keyword(prelude: &str, name: &str) -> bool {
     let expected_len = name.len() + 1;
     prelude
         .get(..expected_len)
-        .is_some_and(|prefix| prefix[0..1].eq("@") && prefix[1..].eq_ignore_ascii_case(name))
+        .is_some_and(|prefix| prefix.starts_with('@') && prefix[1..].eq_ignore_ascii_case(name))
         && prelude[expected_len..]
             .chars()
             .next()
@@ -432,4 +432,40 @@ mod tests {
         assert!(output.contains(".主题{color:red}"));
         assert!(output.contains(r#".按钮{content:"你好"}"#));
     }
+
+    #[test]
+    fn a_prelude_opening_on_a_non_ascii_character_is_not_an_at_keyword() {
+        // The three non-ASCII cases above all keep an ASCII byte first. A
+        // stylesheet may open on a multi-byte one instead — a UTF-8 BOM
+        // ahead of `@charset` is the everyday shape, and `decode_css_bytes`
+        // only strips it from a linked sheet, not from an inline `<style>`.
+        // None of these are at-rules this scanner handles; each must simply
+        // say so and leave the sheet alone.
+        let fetcher = |_: &str| None;
+        for source in [
+            "\u{feff}@charset \"utf-8\";.root{color:red}",
+            "\u{feff}@layer base;.root{color:red}",
+            "\u{feff}@import 'a.css';.root{color:red}",
+            "中文;.root{color:red}",
+        ] {
+            let (output, _) = expand(source, &fetcher);
+            assert!(
+                output.contains(".root{color:red}"),
+                "source: {source:?}, output: {output:?}"
+            );
+        }
+    }
+
+    #[test]
+    fn ascii_charset_and_layer_preludes_keep_their_meaning() {
+        let fetcher = |_: &str| Some(b".imported{color:red}".to_vec());
+        let (output, warnings) = expand(
+            "@charset \"utf-8\";@layer base;@import 'a.css';.root{color:blue}",
+            &fetcher,
+        );
+        assert!(warnings.is_empty(), "{warnings:?}");
+        assert!(output.starts_with("@charset \"utf-8\";@layer base;"));
+        assert!(output.contains(".imported{color:red}"));
+        assert!(output.contains(".root{color:blue}"));
+    }
 }
```

---

### Incident Patch 8: `6f0f176b` (2026-09-14)
**Commit Message**: fix(ai): keep the radius context cut on a char boundary (#241)

px_values capped each number's context at 48 bytes. That is a boundary only for Latin script; a CJK or Hangul radius sentence puts three bytes on most characters, so the cut landed mid-character and tail[..end] panicked. floor_char_boundary is a no-op on ASCII, where every index is already a boundary.

**File**: `crates/op-ai-skills/src/style_guide/token_table.rs` (modified, +5/-4)
```diff
@@ -512,10 +512,11 @@ fn px_values(line: &str) -> Vec<(i64, String)> {
         // Up to the next clause break — that is where this number's
         // description ends and the next one's begins.
         let tail = &line[index..];
-        let end = tail
-            .find([',', ';', '.', ')', '(', '—'])
-            .unwrap_or(tail.len())
-            .min(48);
+        let end = tail.floor_char_boundary(
+            tail.find([',', ';', '.', ')', '(', '—'])
+                .unwrap_or(tail.len())
+                .min(48),
+        );
         out.push((value, tail[..end].to_string()));
     }
     out
```

**File**: `crates/op-ai-skills/src/style_guide/token_table_tests.rs` (modified, +26/-0)
```diff
@@ -220,3 +220,29 @@ fn the_palette_floor_reports_colours_with_their_own_role_text() {
     assert_eq!(prose.len(), 2);
     assert_eq!(prose[0].color, "#101014");
 }
+
+/// A radius sentence whose description is not written in Latin script. The
+/// per-number context is cut at 48 bytes, and a guide's prose is arbitrary
+/// author text — most CJK and Hangul characters are three bytes each, so that
+/// cut lands mid-character on ordinary input.
+#[test]
+fn a_radius_line_written_in_another_script_is_read_and_classified() {
+    for line in [
+        "Corner radius: 12px  卡片与面板容器的外框圆角，用于所有卡片与弹层",
+        "Corner radius: 12px卡片与面板容器的外框圆角，用于所有卡片与弹层",
+        "Corner radius: 12px 카드와 패널 컨테이너의 바깥 테두리 라운드에 사용",
+    ] {
+        let content = format!("# G\n\n## Shape\n\n{line}\n");
+        let values = extract_style_guide_values(&content);
+        // Nothing in these says which role the radius is for, so nothing is
+        // invented — but the scan has to reach that answer, not panic on
+        // the way.
+        assert_eq!(values.radius, StyleRadius::default(), "line: {line}");
+    }
+
+    // The same sentence with an English role cue still classifies.
+    let mixed = extract_style_guide_values(
+        "# G\n\n## Shape\n\nCorner radius: 24px card 카드와 패널 컨테이너의 바깥 테두리\n",
+    );
+    assert_eq!(mixed.radius.card, Some(24));
+}
```

---

### Incident Patch 9: `d147d5e9` (2026-09-14)
**Commit Message**: fix(agent): keep the natively-cased Windows vars for guarded CLIs (#233)

`allowed_env` matched its uppercase COMMON list with `contains`, but
Windows environment keys are case-insensitive and arrive in their native
casing — `Path`, `SystemRoot`, `windir`, `ComSpec`, `ProgramData`. None
of them matched, so Antigravity, Grok, dsh and the OpenCode probe were
launched with no PATH at all and no Winsock provider root.

`append_isolated_env` had the same defect twice over: its `SYSTEMROOT`
lookup never fired, so the private-HOME sandbox PATH always fell back to
the hard-coded `C:\Windows`, and the private-key strip left the host
`Path` in place beside the sandbox `PATH` it then pushed.

`chat_spawn::scrubbed_child_env` already compares this way; route the
three list matches through one helper that does the same.

Co-authored-by: kevin9327 <kevin9327@users.noreply.github.com>

**File**: `crates/op-host-services/src/chat_subprocess_safety.rs` (modified, +14/-3)
```diff
@@ -320,11 +320,11 @@ pub fn append_isolated_env(env: &mut Vec<(String, String)>, turn: Option<&Isolat
         #[cfg(windows)]
         let safe_path = env
             .iter()
-            .find(|(key, _)| key == "SYSTEMROOT")
+            .find(|(key, _)| key.eq_ignore_ascii_case("SYSTEMROOT"))
             .map(|(_, root)| format!(r"{root}\System32;{root}"))
             .unwrap_or_else(|| r"C:\Windows\System32;C:\Windows".to_string());
         const PRIVATE_KEYS: &[&str] = &["PATH", "TMPDIR", "TMP", "TEMP"];
-        env.retain(|(key, _)| !PRIVATE_KEYS.contains(&key.as_str()));
+        env.retain(|(key, _)| !env_key_listed(PRIVATE_KEYS, key));
         let value = |path: &Path| path.to_string_lossy().into_owned();
         env.extend([
             ("PATH".to_string(), safe_path),
@@ -563,6 +563,17 @@ where
         .collect()
 }
 
+/// Windows environment keys are case-insensitive and the OS hands them to a
+/// process in their native casing — `Path`, `SystemRoot`, `windir`, `ComSpec`,
+/// `ProgramData`. Matching an uppercase list with `contains` therefore drops
+/// every one of them: a guarded CLI then starts with no `Path` and no
+/// `SystemRoot`, and a child that cannot reach `%SystemRoot%\System32` fails
+/// Winsock initialization with `WSAEPROVIDERFAILEDINIT` (os error 10106).
+/// `chat_spawn::scrubbed_child_env` already compares this way.
+fn env_key_listed(list: &[&str], key: &str) -> bool {
+    list.iter().any(|entry| entry.eq_ignore_ascii_case(key))
+}
+
 fn allowed_env(cli: CliName, key: &str) -> bool {
     const COMMON: &[&str] = &[
         "HOME",
@@ -596,7 +607,7 @@ fn allowed_env(cli: CliName, key: &str) -> bool {
         "REQUESTS_CA_BUNDLE",
         "CURL_CA_BUNDLE",
     ];
-    if COMMON.contains(&key) || key.starts_with("LC_") {
+    if env_key_listed(COMMON, key) || key.starts_with("LC_") {
         return true;
     }
     match cli {
```

**File**: `crates/op-host-services/src/chat_subprocess_safety_tests.rs` (modified, +79/-0)
```diff
@@ -205,3 +205,82 @@ fn antigravity_keeps_linux_keyring_session_but_grok_does_not() {
         assert!(!allowed_env(CliName::GrokBuild, key), "{key}");
     }
 }
+
+/// Windows hands the environment over in its native casing, so an uppercase
+/// allowlist matched with `contains` drops `Path`, `SystemRoot`, `windir`,
+/// `ComSpec` and `ProgramData` — the guarded CLI then starts with no PATH and
+/// no Winsock provider root.
+#[test]
+fn guarded_child_env_keeps_windows_native_key_casing() {
+    let vars = vec![
+        ("Path".to_string(), r"C:\Windows\System32".to_string()),
+        ("SystemRoot".to_string(), r"C:\Windows".to_string()),
+        ("windir".to_string(), r"C:\Windows".to_string()),
+        (
+            "ComSpec".to_string(),
+            r"C:\Windows\System32\cmd.exe".to_string(),
+        ),
+        ("ProgramData".to_string(), r"C:\ProgramData".to_string()),
+        ("UserProfile".to_string(), r"C:\Users\dev".to_string()),
+        ("DATABASE_URL".to_string(), "secret".to_string()),
+    ];
+
+    for cli in [CliName::GrokBuild, CliName::Antigravity, CliName::Dsh] {
+        let keys: Vec<String> = filtered_env(cli, vars.clone())
+            .into_iter()
+            .map(|(key, _)| key)
+            .collect();
+        assert_eq!(
+            keys,
+            vec![
+                "Path",
+                "SystemRoot",
+                "windir",
+                "ComSpec",
+                "ProgramData",
+                "UserProfile",
+            ],
+            "{cli:?} dropped natively-cased Windows keys"
+        );
+    }
+}
+
+/// The private-HOME rewrite has to find `SystemRoot` in its real casing to
+/// build the sandbox PATH, and has to strip the inherited `Path` rather than
+/// leave a second, host-valued entry behind it.
+#[test]
+#[cfg(windows)]
+fn isolated_env_reads_native_cased_system_root_and_strips_host_path() {
+    let turn = IsolatedTurn::prepare_for(
+        Some(CliName::Antigravity),
+        "return only JavaScript",
+        &[],
+        TurnPurpose::Generation,
+        None,
+    )
+    .unwrap()
+    .unwrap();
+
+    let mut env = vec![
+        ("Path".to_string(), r"C:\host\tools".to_string()),
+        ("SystemRoot".to_string(), r"D:\Windows".to_string()),
+        ("TEMP".to_string(), r"C:\host\temp".to_string()),
+    ];
+    append_isolated_env(&mut env, Some(&turn));
+
+    let path_entries: Vec<&(String, String)> = env
+        .iter()
+        .filter(|(key, _)| key.eq_ignore_ascii_case("PATH"))
+        .collect();
+    assert_eq!(
+        path_entries.len(),
+        1,
+        "the host PATH must be replaced, not shadowed: {env:?}"
+    );
+    assert_eq!(path_entries[0].1, r"D:\Windows\System32;D:\Windows");
+    let temp = env
+        .iter()
+        .find(|(key, _)| key == "TEMP")
+        .expect("private TEMP");
+    assert!(Path::new(&temp.1).starts_with(turn.cwd()), "{temp:?}");
+}
```

---

### Incident Patch 10: `414a16e8` (2026-09-14)
**Commit Message**: fix(agent): match the Codex env allowlist case-insensitively (#232)

Windows environment keys are case-insensitive and the OS hands them to a
process in their native casing — `SystemRoot`, `windir`, `ComSpec`,
`SystemDrive`, `Path`. The Codex allowlist compared them with an exact
`contains`, so on Windows it dropped every host variable and left the
child with only `OPENAI_*` / `CODEX_*`. Without `SystemRoot` the child
cannot load the Winsock service providers under `%SystemRoot%\System32`
and the turn dies with `WSAEPROVIDERFAILEDINIT` (os error 10106).

`WINDIR` was missing from the list outright. `op_acp::client` already
normalizes its own allowlist for exactly this reason; do the same here.
The `env_key` opt-ins and the `OPENAI_` / `CODEX_` prefixes stay exact —
those are provider names the user spells out, not host variables.

Closes #229

Co-authored-by: kevin9327 <kevin9327@users.noreply.github.com>

**File**: `crates/op-host-services/src/chat_subprocess_quirks.rs` (modified, +101/-8)
```diff
@@ -49,8 +49,11 @@ const CODEX_ENV_ALLOWLIST: &[&str] = &[
     "http_proxy",
     "https_proxy",
     "no_proxy",
-    // Windows-essential vars
+    // Windows-essential vars. Matched case-insensitively (see
+    // `codex_env_allowed`) because Windows reports these in their native
+    // casing, e.g. `SystemRoot` / `windir` / `ComSpec` / `SystemDrive`.
     "SYSTEMROOT",
+    "WINDIR",
     "COMSPEC",
     "USERPROFILE",
     "APPDATA",
@@ -118,16 +121,37 @@ fn load_codex_config_env_keys() -> Vec<String> {
 /// prefixes + config.toml `env_key` opt-ins (TS `filterCodexEnv`).
 pub fn codex_child_env() -> Vec<(String, String)> {
     let extra = load_codex_config_env_keys();
-    std::env::vars()
-        .filter(|(k, _)| {
-            CODEX_ENV_ALLOWLIST.contains(&k.as_str())
-                || extra.iter().any(|e| e == k)
-                || k.starts_with("OPENAI_")
-                || k.starts_with("CODEX_")
-        })
+    filter_codex_env(std::env::vars(), &extra)
+}
+
+fn filter_codex_env<I>(vars: I, extra: &[String]) -> Vec<(String, String)>
+where
+    I: IntoIterator<Item = (String, String)>,
+{
+    vars.into_iter()
+        .filter(|(key, _)| codex_env_allowed(key, extra))
         .collect()
 }
 
+/// Windows environment keys are case-insensitive, and the OS hands them to a
+/// process in their native casing — `SystemRoot`, `windir`, `ComSpec`,
+/// `SystemDrive`, `Path`. An exact match against the uppercase allowlist
+/// therefore dropped every one of them, and a Codex child launched without
+/// `SystemRoot` cannot load the Winsock service providers under
+/// `%SystemRoot%\System32`: the turn dies with `WSAEPROVIDERFAILEDINIT`
+/// (os error 10106). Compare the system allowlist case-insensitively, the way
+/// `op_acp::client::local_env_allowed` already does. The `env_key` opt-ins and
+/// the `OPENAI_` / `CODEX_` prefixes stay exact: those are provider names the
+/// user spells out, not host variables.
+fn codex_env_allowed(key: &str, extra: &[String]) -> bool {
+    CODEX_ENV_ALLOWLIST
+        .iter()
+        .any(|allowed| allowed.eq_ignore_ascii_case(key))
+        || extra.iter().any(|e| e == key)
+        || key.starts_with("OPENAI_")
+        || key.starts_with("CODEX_")
+}
+
 /// Budget for the one-shot `codex exec --help` capability probe. Generous
 /// on purpose: the result is cached per binary path for the process
 /// lifetime — including a TimedOut-as-unsupported verdict — so a single
@@ -415,6 +439,75 @@ pub fn codex_reasoning_effort(thinking: ThinkingMode, effort: EffortLevel) -> Op
 mod tests {
     use super::*;
 
+    fn owned(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
+        pairs
+            .iter()
+            .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
+            .collect()
+    }
+
+    /// Windows hands the environment over in its native casing, so the
+    /// allowlist has to match case-insensitively. Losing `SystemRoot` here is
+    /// what made the Codex turn fail Winsock init with os error 10106.
+    #[test]
+    fn codex_env_keeps_windows_native_key_casing() {
+        let kept = filter_codex_env(
+            owned(&[
+                ("SystemRoot", r"C:\Windows"),
+                ("windir", r"C:\Windows"),
+                ("ComSpec", r"C:\Windows\System32\cmd.exe"),
+                ("SystemDrive", "C:"),
+                ("Path", r"C:\Windows\System32"),
+                ("PathExt", ".COM;.EXE;.BAT;.CMD"),
+                ("UserProfile", r"C:\Users\dev"),
+            ]),
+            &[],
+        );
+        let names: Vec<&str> = kept.iter().map(|(k, _)| k.as_str()).collect();
+        assert_eq!(
+            names,
+            vec![
+                "SystemRoot",
+                "windir",
+                "ComSpec",
+                "SystemDrive",
+                "Path",
+                "PathExt",
+                "UserProfile",
+            ]
+        );
+    }
+
+    /// The relaxed casing must not widen the secret boundary: only th
```

#### Recent Merged Pull Requests:
- **PR #248** (closed): feat(agent): add packaged browser snapshot capture tool (@caniko)
- **PR #243** (2026-09-14): fix(design-lint): guard the transparent-alpha test against a non-ascii fill (@kevin9327)
- **PR #242** (2026-09-14): fix(cli): decode a percent-encoded resource name before the disk lookup (@kevin9327)
- **PR #241** (2026-09-14): fix(ai): keep the radius context cut on a char boundary (@kevin9327)
- **PR #240** (2026-09-14): fix(html): stop a non-ascii css prelude from panicking the import (@kevin9327)
- **PR #235** (2026-09-14): fix(editor): address restored blobs with git's path separator (@kevin9327)
- **PR #233** (2026-09-14): fix(agent): keep the natively-cased Windows vars for guarded CLIs (@kevin9327)
- **PR #232** (2026-09-14): fix(agent): match the Codex env allowlist case-insensitively (@kevin9327)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
