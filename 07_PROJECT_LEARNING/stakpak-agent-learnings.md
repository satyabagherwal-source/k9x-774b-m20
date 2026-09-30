# Forensic Learning Record (Deep Inspection): stakpak/agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/stakpak-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/stakpak/agent](https://github.com/stakpak/agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:13:03.960Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `stakpak/agent`
- **Description**: Ship your code, on autopilot. An open source agent that lives on your machines 24/7 and keeps your apps running. 🦀
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 1805 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/src/apikey_auth.rs`
```
use crate::config::AppConfig;
use std::io::Write;
use tokio::sync::mpsc;

const CLIENT_ID: &str = "stakpak-cli";
const GENERATE_API_KEY_URL: &str = "https://stakpak.dev/generate-api-key";

fn open_browser(url: &str) -> bool {
    match open::that(url) {
        Ok(_) => {
            println!("🌐 Opening browser...");
            true
        }
        Err(_) => false,
    }
}

async fn listen_for_callback(url: &str) -> String {
    let start_time = std::time::Instant::now();
    while start_time.elapsed() < std::time::Duration::from_secs(120) {
        let client = match stakpak_shared::tls_client::create_tls_client(
            stakpak_shared::tls_client::TlsClientConfig::default(),
        ) {
            Ok(c) => c,
            Err(_) => return "ERROR".to_string(),
        };
        let response = client.get(url).send().await;

        match response {
            Ok(resp) if resp.status().is_success() => {
                let response_text = match resp.text().await {
                    Ok(text) => text,
                    Err(_) => {
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                        continue;
                    }
                };
                if response_text.contains("stkpk_api") && response_text.contains("success") {
                    let json: serde_json::Value = match serde_json::from_str(&response_text) {
                        Ok(json) => json,
                        Err(_) => {
                            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                            continue;
                        }
                    };
                    return json["key"].to_string();
                } else if response_text.contains("ERROR") {
                    return "ERROR".to_string();
                } else {
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                }
            }
            _ => {
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
        }
    }

    // 2 minutes elapsed
    "TIMEOUT".to_string()
}

fn success_message() {
    println!();
    println!("\x1b[1;36m┌──────────────────────────────────────────────────────────────┐\x1b[0m");
    println!(
        "\x1b[1;36m│\x1b[0m \x1b[1;32m                 API Key Saved Successfully!                \x1b[0m \x1b[1;36m│\x1b[0m"
    );
    println!("\x1b[1;36m└──────────────────────────────────────────────────────────────┘\x1b[0m");
    println!();
    println!("You're all set! Opening Stakpak...");
    println!();
}

fn clear_terminal() {
    print!("\x1b[2J\x1b[H");
    if let Err(e) = std::io::stdout().flush() {
        eprintln!("Failed to clear terminal: {}", e);
    }
}

async fn render_and_save_api_key(api_key: &str, config: &mut AppConfig) {
    if api_key.trim().is_empty() || !api_key.trim().starts_with("stkpk_api") {
        eprintln!("\nInvalid API key format.");
        eprintln!("API key must start with 'stkpk_api' and cannot be empty.");
        std::process::exit(1);
    }

    config.api_key = Some(api_key.trim().to_string());

    if let Err(e) = config.save() {
        eprintln!("Failed to save config: {}", e);
        std::process::exit(1);
    }

    success_message();
    // add timeout for 2 seconds
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    clear_terminal();
}

async fn start_callback_server() -> (
    u16,
    mpsc::Receiver<String>,
    tokio::task::JoinHandle<()>,
    bool,
) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;
    let mut port_error = false;
    // Simulate port binding failure for testing
    let mut port = 5269;
    let mut listener: Option<tokio::net::TcpListener> = None;

    while port < 5279 {
        match TcpListener::bind(format!("127.0.0.1:{}", port)).await {
            Ok(l) => {
                listener = Some(l);
                println!("Callback server listening on http://localhost:{}", port);
                break;
            }
            Err(_) => {
                port += 1;
            }
        }
    }

    let listener = match listener {
        Some(l) => l,
        None => {
            port_error = true;
            return (
                0,
                mpsc::channel::<String>(100).1,
                tokio::spawn(async {}),
                port_error,
            );
        }
    };

    // Create a channel for communication between server and terminal
    let (tx, rx) = mpsc::channel::<String>(100);

    // Spawn the server to run continuously
    let server_handle = tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((mut socket, _addr)) => {
                    // println!("Received connection from: {}", addr);

                    // Read the HTTP request
                    let mut buffer = [0; 2048]; // Increased buffer for POST data
                    let n = match socket.read(&mut buffer).await {
                        Ok(n) => n,
                        Err(_) => continue,
                    };

                    let request = String::from_utf8_lossy(&buffer[..n]);
                    // let first_line = request.lines().next().unwrap_or("Unknown");
                    // println!("Received request: {}", first_line);

                    // Handle POST requests to root endpoint (any data format)
                    if request.contains("POST /") || request.contains("POST / HTTP") {
                        // Extract API key from POST body (any format)
                        if let Some(api_key) = extract_api_key_from_post_body(&request) {
                            // Send API key through channel to terminal
                            let _ = tx.send(api_key.clone()).await;

                            // Send success response with CORS headers
                            let response = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, GET, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Type: text/plain\r\n\r\nOK";
                            socket.write_all(response.as_bytes()).await.ok();

                            // Server has done its job, break out of the loop
                            break;
                        } else {
                            // Send error response with CORS headers
                            let response = "HTTP/1.1 400 Bad Request\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, GET, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Type: text/plain\r\n\r\nInvalid API key";
                            socket.write_all(response.as_bytes()).await.ok();
                            println!("❌ Invalid API key format in POST data");
                        }
                    } else if request.contains("OPTIONS") {
                        // Handle CORS preflight request
                        let response = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, GET, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Length: 0\r\n\r\n";
                        socket.write_all(response.as_bytes()).await.ok();
                    } else {
                        // Unknown endpoint
                        let response = "HTTP/1.1 404 Not Found\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: text/plain\r\n\r\nNot Found";
                        socket.write_all(response.as_bytes()).await.ok();
                    }
                }
                Err(e) => {
                    eprintln!("Error accepting connection: {}", e);
                    continue;
                }
            }
        }

        // Server is shutting down
        // println!("🔄 Callback server shutting down...");
    });

    (port, rx, server_handle, port_error)
}

fn extract_api_key_from_post_body(request: &str) -> Option<String> {
    // Lo
```

### Core Architecture Module: `cli/src/code_index.rs`
```
use stakpak_api::models::{BuildCodeIndexInput, BuildCodeIndexOutput, CodeIndex, SimpleDocument};
use stakpak_api::{AgentClient, AgentClientConfig, AgentProvider, StakpakConfig};
use stakpak_shared::file_watcher::{FileWatchEvent, create_and_start_watcher};
use stakpak_shared::local_store::LocalStore;
use stakpak_shared::models::indexing::IndexingStatus;

use std::path::{Path, PathBuf};
use tokio::task::JoinHandle;
use tracing::{debug, error, info, warn};
use walkdir::WalkDir;

use chrono::Utc;
use stakpak_shared::utils::{
    self, is_supported_file, read_gitignore_patterns, should_include_entry,
};

use crate::config::AppConfig;
use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;
use tokio::sync::mpsc;
use tokio::time::{Duration, Instant, interval};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FileOperation {
    Created,
    Modified,
    Deleted,
}

impl std::fmt::Display for FileOperation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FileOperation::Created => write!(f, "created"),
            FileOperation::Modified => write!(f, "modified"),
            FileOperation::Deleted => write!(f, "deleted"),
        }
    }
}

const INDEX_FRESHNESS_MINUTES: i64 = 10;
const MAX_AUTO_INDEX_FILES: usize = 200;

const DEBOUNCE_PROCESS_INTERVAL_SECONDS: u64 = 5;
const DEBOUNCE_DURATION_SECONDS: u64 = 15;

#[derive(Debug, Clone)]
struct PendingUpdate {
    operation: FileOperation,
    file_uri: String,
    app_config: AppConfig,
    directory: Option<String>,
    last_update_time: Instant,
}

#[derive(Debug)]
enum DebounceMessage {
    ScheduleUpdate(PendingUpdate),
}

struct DebounceActor {
    receiver: mpsc::Receiver<DebounceMessage>,
    pending_updates: HashMap<String, PendingUpdate>,
}

impl DebounceActor {
    fn new() -> (Self, mpsc::Sender<DebounceMessage>) {
        let (sender, receiver) = mpsc::channel(100);
        let actor = Self {
            receiver,
            pending_updates: HashMap::new(),
        };
        (actor, sender)
    }

    async fn run(mut self) {
        let mut process_interval = interval(Duration::from_secs(DEBOUNCE_PROCESS_INTERVAL_SECONDS)); // Check every 5 seconds

        loop {
            tokio::select! {
                // Handle incoming messages
                message = self.receiver.recv() => {
                    match message {
                        Some(DebounceMessage::ScheduleUpdate(update)) => {
                            self.handle_schedule_update(update).await;
                        }
                        None => {
                            debug!("Debounce actor channel closed, shutting down");
                            break;
                        }
                    }
                }

                // Periodic processing of pending updates
                _ = process_interval.tick() => {
                    self.process_pending_updates().await;
                }
            }
        }
    }

    async fn handle_schedule_update(&mut self, update: PendingUpdate) {
        let key = format!("{}:{}", update.operation, update.file_uri);
        debug!(
            "Actor scheduling debounced update for {} operation on {}",
            update.operation, update.file_uri
        );
        self.pending_updates.insert(key, update);
    }

    async fn process_pending_updates(&mut self) {
        let now = Instant::now();
        let mut to_process = Vec::new();
        let mut to_remove = Vec::new();

        // Find updates that are ready to process
        for (key, update) in &self.pending_updates {
            if now.duration_since(update.last_update_time)
                >= Duration::from_secs(DEBOUNCE_DURATION_SECONDS)
            {
                to_process.push(update.clone());
                to_remove.push(key.clone());
            }
        }

        // Remove processed updates from pending map
        for key in to_remove {
            self.pending_updates.remove(&key);
        }

        // Process updates sequentially
        for update in to_process {
            info!(
                "Actor processing debounced update for {} operation on {}",
                update.operation, update.file_uri
            );

            if let Err(e) = execute_code_index_update(
                &update.app_config,
                &update.directory,
                update.operation,
                &update.file_uri,
            )
            .await
            {
                error!("Failed to process debounced update: {}", e);
            }
        }
    }
}

// Global actor sender
static DEBOUNCE_ACTOR_SENDER: OnceLock<mpsc::Sender<DebounceMessage>> = OnceLock::new();

fn get_debounce_actor_sender() -> &'static mpsc::Sender<DebounceMessage> {
    DEBOUNCE_ACTOR_SENDER.get_or_init(|| {
        let (actor, sender) = DebounceActor::new();

        // Spawn the actor
        tokio::spawn(async move {
            info!("Starting debounce actor");
            actor.run().await;
            info!("Debounce actor shutdown");
        });

        sender
    })
}

pub async fn get_or_build_local_code_index(
    app_config: &AppConfig,
    directory: Option<String>,
    index_big_project: bool,
) -> Result<CodeIndex, String> {
    // Set the directory to use
    let dir = directory.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });

    // First, count supported files to see if we should proceed
    let file_count = count_supported_files(&dir)?;

    if file_count > MAX_AUTO_INDEX_FILES && !index_big_project {
        // Store the indexing status
        let status = IndexingStatus {
            indexed: false,
            reason: format!(
                "Directory contains {} supported files (>{} threshold). Use --index-big-project to enable indexing.",
                file_count, MAX_AUTO_INDEX_FILES
            ),
            file_count,
            timestamp: Utc::now(),
        };
        store_indexing_status(&status)?;

        warn!("Skipping code indexing: {}", status.reason);
        return Err(status.reason);
    }

    // Try to load existing index
    match load_existing_index() {
        Ok(index) if is_index_fresh(&index) => {
            // Index exists and is fresh (less than 10 minutes old)
            let status = IndexingStatus {
                indexed: true,
                reason: "Using existing fresh index".to_string(),
                file_count,
                timestamp: index.last_updated,
            };
            store_indexing_status(&status)?;
            Ok(index)
        }
        Ok(_) => {
            // Index exists but is stale, rebuild it
            warn!("Code index is older than 10 minutes, rebuilding...");
            rebuild_and_load_index(app_config, Some(dir), file_count).await
        }
        Err(_) => {
            // No index exists or failed to load, build a new one
            rebuild_and_load_index(app_config, Some(dir), file_count).await
        }
    }
}

/// Count supported files in directory
fn count_supported_files(base_dir: &str) -> Result<usize, String> {
    let mut count = 0;
    let ignore_patterns = read_gitignore_patterns(base_dir);

    for entry in WalkDir::new(base_dir)
        .into_iter()
        .filter_entry(|e| should_include_entry(e, base_dir, &ignore_patterns))
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() && is_supported_file(entry.path()) {
            count += 1;
            // Early exit if we've already exceeded the threshold to avoid counting millions of files
            if count > MAX_AUTO_INDEX_FILES * 2 {
                break;
            }
        }
    }

    Ok(count)
}

/// Store indexing status for use by tools
fn store_indexing_status(status: &IndexingStatus) -> Result<(), String> {
    let status_json = serde_json::to_string_pretty(status)
        .map_err(|e| forma
```

### Core Architecture Module: `cli/src/commands/acp/fs_handler.rs`
```
use agent_client_protocol::{self as acp, Client as AcpClient};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};

/// Filesystem operation requests for ACP native protocol
pub enum FsOperation {
    ReadTextFile {
        session_id: acp::SessionId,
        path: std::path::PathBuf,
        line: Option<u32>,
        limit: Option<u32>,
        response_tx: oneshot::Sender<Result<String, String>>,
    },
    WriteTextFile {
        session_id: acp::SessionId,
        path: std::path::PathBuf,
        content: String,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
}

/// Helper function to resolve a path to an absolute path
fn resolve_absolute_path(path: &str) -> std::path::PathBuf {
    let path = Path::new(path);
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        // Get current working directory and join with the relative path
        std::env::current_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."))
            .join(path)
    }
}

/// Spawn a background task to handle filesystem operations via ACP connection
pub fn spawn_fs_handler(
    conn: Arc<acp::AgentSideConnection>,
    mut fs_operation_rx: mpsc::UnboundedReceiver<FsOperation>,
) {
    tokio::task::spawn_local(async move {
        while let Some(operation) = fs_operation_rx.recv().await {
            match operation {
                FsOperation::ReadTextFile {
                    session_id,
                    path,
                    line,
                    limit,
                    response_tx,
                } => {
                    log::info!("Processing ACP read_text_file: {:?}", path);
                    let request = acp::ReadTextFileRequest::new(session_id, path)
                        .line(line)
                        .limit(limit);
                    let result = match conn.read_text_file(request).await {
                        Ok(response) => Ok(response.content),
                        Err(e) => Err(format!("ACP read_text_file failed: {}", e)),
                    };
                    let _ = response_tx.send(result);
                }
                FsOperation::WriteTextFile {
                    session_id,
                    path,
                    content,
                    response_tx,
                } => {
                    log::info!("Processing ACP write_text_file: {:?}", path);
                    let request = acp::WriteTextFileRequest::new(session_id, path, content);
                    let result = match conn.write_text_file(request).await {
                        Ok(_) => Ok(()),
                        Err(e) => Err(format!("ACP write_text_file failed: {}", e)),
                    };
                    let _ = response_tx.send(result);
                }
            }
        }
    });
}

/// Execute filesystem tool using native ACP protocol via channel
pub async fn execute_acp_fs_tool(
    fs_tx: &mpsc::UnboundedSender<FsOperation>,
    tool_call: &stakpak_shared::models::integrations::openai::ToolCall,
    session_id: &acp::SessionId,
) -> Result<Option<rmcp::model::CallToolResult>, String> {
    let args: serde_json::Value = serde_json::from_str(&tool_call.function.arguments)
        .map_err(|e| format!("Failed to parse tool arguments: {}", e))?;

    use super::tool_names;
    let stripped_name = super::utils::strip_tool_name(&tool_call.function.name);
    match stripped_name {
        tool_names::VIEW => {
            let path = args
                .get("path")
                .and_then(|p| p.as_str())
                .ok_or_else(|| "Missing 'path' parameter".to_string())?;

            let line = args
                .get("view_range")
                .and_then(|r| r.as_array())
                .and_then(|arr| arr.first())
                .and_then(|v| v.as_u64())
                .map(|v| v as u32);

            let limit = args
                .get("view_range")
                .and_then(|r| r.as_array())
                .and_then(|arr| arr.get(1))
                .and_then(|v| v.as_i64())
                .and_then(|v| if v == -1 { None } else { Some(v as u32) });

            log::info!(
                "Reading file via ACP: {} (line: {:?}, limit: {:?})",
                path,
                line,
                limit
            );

            let (response_tx, response_rx) = oneshot::channel();
            let absolute_path = resolve_absolute_path(path);
            log::info!(
                "Resolved path '{}' to absolute path: {:?}",
                path,
                absolute_path
            );
            fs_tx
                .send(FsOperation::ReadTextFile {
                    session_id: session_id.clone(),
                    path: absolute_path,
                    line,
                    limit,
                    response_tx,
                })
                .map_err(|_| "Failed to send filesystem operation".to_string())?;

            let content = response_rx
                .await
                .map_err(|_| "Filesystem operation cancelled".to_string())??;

            Ok(Some(rmcp::model::CallToolResult {
                content: vec![rmcp::model::Content::text(content)],
                is_error: Some(false),
                meta: None,
                structured_content: None,
            }))
        }
        tool_names::CREATE => {
            let path = args
                .get("path")
                .and_then(|p| p.as_str())
                .ok_or_else(|| "Missing 'path' parameter".to_string())?;

            let content = args
                .get("file_text")
                .and_then(|c| c.as_str())
                .ok_or_else(|| "Missing 'file_text' parameter".to_string())?;

            log::info!("Creating file via ACP: {}", path);

            let (response_tx, response_rx) = oneshot::channel();
            let absolute_path = resolve_absolute_path(path);
            log::info!(
                "Resolved path '{}' to absolute path: {:?}",
                path,
                absolute_path
            );
            fs_tx
                .send(FsOperation::WriteTextFile {
                    session_id: session_id.clone(),
                    path: absolute_path,
                    content: content.to_string(),
                    response_tx,
                })
                .map_err(|_| "Failed to send filesystem operation".to_string())?;

            response_rx
                .await
                .map_err(|_| "Filesystem operation cancelled".to_string())??;

            Ok(Some(rmcp::model::CallToolResult {
                content: vec![rmcp::model::Content::text(format!(
                    "Successfully created file: {}",
                    path
                ))],
                is_error: Some(false),
                meta: None,
                structured_content: None,
            }))
        }
        tool_names::STR_REPLACE => {
            let path = args
                .get("path")
                .and_then(|p| p.as_str())
                .ok_or_else(|| "Missing 'path' parameter".to_string())?;

            let old_str = args
                .get("old_str")
                .and_then(|s| s.as_str())
                .ok_or_else(|| "Missing 'old_str' parameter".to_string())?;

            let new_str = args
                .get("new_str")
                .and_then(|s| s.as_str())
                .ok_or_else(|| "Missing 'new_str' parameter".to_string())?;

            let replace_all = args
                .get("replace_all")
                .and_then(|b| b.as_bool())
                .unwrap_or(false);

            log::info!("Replacing text in file via ACP: {}", path);

            // Read current content
            let (read_tx, read_rx) = oneshot::channel();
            let absolute_path = resolve_absolute_path(path);
            log::info!(
                "Resolved path '{}' to absolute path: {:?}",
                path,
                absolute_path
            );
 
```

### Core Architecture Module: `cli/src/commands/acp/mod.rs`
```
pub mod fs_handler;
pub mod server;
pub mod utils;
pub use server::StakpakAcpAgent;
pub use stakpak_mcp_server::tool_names;

```

### Core Architecture Module: `cli/src/commands/acp/server.rs`
```
use crate::commands::agent::run::helpers::{system_message, user_message};
use crate::commands::agent::run::stream::ToolCallAccumulator;
use crate::config::AppConfig;
use agent_client_protocol::{
    self as acp, Client as AcpClient, ModelInfo, SessionModelState, SessionNotification,
    SetSessionModelRequest, SetSessionModelResponse,
};
use futures_util::StreamExt;
use stakpak_api::models::ApiStreamError;
use stakpak_api::storage::CreateSessionRequest;
use stakpak_api::{AgentClient, AgentClientConfig, AgentProvider, StakpakConfig};
use stakpak_api::{Model, ModelLimit};
use stakpak_mcp_client::McpClient;
use stakpak_shared::models::integrations::mcp::CallToolResultExt;
use stakpak_shared::models::integrations::openai::{
    ChatCompletionChoice, ChatCompletionResponse, ChatCompletionStreamResponse, ChatMessage,
    FinishReason, MessageContent, Role, Tool, ToolCall, ToolCallResultProgress,
    ToolCallResultStatus,
};
use stakpak_shared::models::llm::LLMTokenUsage;
use std::cell::Cell;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};
use tokio_util::compat::{TokioAsyncReadCompatExt as _, TokioAsyncWriteCompatExt as _};
use uuid::Uuid;

pub struct StakpakAcpAgent {
    config: Arc<tokio::sync::RwLock<AppConfig>>,
    client: Arc<tokio::sync::RwLock<Arc<dyn AgentProvider>>>,
    /// Default model to use for chat completions
    model: Arc<tokio::sync::RwLock<Model>>,
    session_update_tx: mpsc::UnboundedSender<(acp::SessionNotification, oneshot::Sender<()>)>,
    next_session_id: Cell<u64>,
    mcp_client: Option<Arc<McpClient>>,
    mcp_tools: Vec<rmcp::model::Tool>,
    tools: Option<Vec<Tool>>,
    current_session_id: Cell<Option<Uuid>>,
    progress_tx: Option<mpsc::Sender<ToolCallResultProgress>>,
    // Add persistent message history for conversation context
    messages: Arc<tokio::sync::Mutex<Vec<ChatMessage>>>,
    // Add permission request channel
    permission_request_tx: Option<
        mpsc::UnboundedSender<(
            acp::RequestPermissionRequest,
            oneshot::Sender<acp::RequestPermissionResponse>,
        )>,
    >,
    // Add cancellation channels for streaming and tool calls
    stream_cancel_tx: Option<tokio::sync::broadcast::Sender<()>>,
    tool_cancel_tx: Option<tokio::sync::broadcast::Sender<()>>,
    // Track active tool calls for cancellation
    active_tool_calls: Arc<tokio::sync::Mutex<Vec<ToolCall>>>,
    // Store current streaming message for todo extraction
    current_streaming_message: Arc<tokio::sync::Mutex<String>>,
    // Buffer for handling partial XML tags during streaming
    streaming_buffer: Arc<tokio::sync::Mutex<String>>,
    // Channel for native ACP filesystem operations
    fs_operation_tx: Option<mpsc::UnboundedSender<crate::commands::acp::fs_handler::FsOperation>>,
    // Capabilities advertised by the client during initialization
    client_capabilities: Arc<tokio::sync::Mutex<acp::ClientCapabilities>>,
}

impl StakpakAcpAgent {
    /// Convert internal Model to ACP ModelInfo
    fn model_to_acp_model_info(model: &Model) -> ModelInfo {
        ModelInfo::new(model.id.clone(), model.name.clone())
            .description(format!("Provider: {}", model.provider))
    }

    /// Get available models as ACP SessionModelState
    async fn get_session_model_state(&self) -> SessionModelState {
        let client = self.client.read().await;
        let current_model = self.model.read().await;

        let available_models = client.list_models().await;
        log::debug!(
            "Available models for ACP: {} models, current: {}",
            available_models.len(),
            current_model.id
        );

        let acp_models: Vec<ModelInfo> = available_models
            .iter()
            .map(Self::model_to_acp_model_info)
            .collect();

        // Ensure currentModelId matches one of the availableModels
        // If the current model isn't in the list, use the first available model
        let current_model_id = if available_models.iter().any(|m| m.id == current_model.id) {
            current_model.id.clone()
        } else if let Some(first_model) = available_models.first() {
            log::debug!(
                "Current model '{}' not in available models, using '{}'",
                current_model.id,
                first_model.id
            );
            first_model.id.clone()
        } else {
            // Fallback if no models available
            current_model.id.clone()
        };

        SessionModelState::new(current_model_id, acp_models)
    }

    pub async fn new(
        config: AppConfig,
        session_update_tx: mpsc::UnboundedSender<(acp::SessionNotification, oneshot::Sender<()>)>,
        system_prompt: Option<String>,
    ) -> Result<Self, String> {
        // Create unified AgentClient
        let client: Arc<dyn AgentProvider> = {
            let stakpak_api_key = config.get_stakpak_api_key();
            if stakpak_api_key.is_none() {
                log::warn!("No Stakpak API key found. Running in local mode.");
            }

            // Use credential resolution with auth.toml fallback chain
            let stakpak = stakpak_api_key.map(|api_key| StakpakConfig {
                api_key,
                api_endpoint: config.api_endpoint.clone(),
            });

            let client = AgentClient::new(AgentClientConfig {
                stakpak,
                providers: config.get_llm_provider_config(),
                store_path: None,
                hook_registry: None,
            })
            .await
            .map_err(|e| format!("Failed to create agent client: {}", e))?;
            Arc::new(client)
        };

        // Get default model - use model from config or first available model
        let model = if let Some(model_str) = &config.model {
            // Parse the model string to determine provider
            let provider = if model_str.starts_with("anthropic/") || model_str.contains("claude") {
                "anthropic"
            } else if model_str.starts_with("openai/") || model_str.contains("gpt") {
                "openai"
            } else if model_str.starts_with("google/") || model_str.contains("gemini") {
                "google"
            } else {
                "stakpak"
            };
            Model::custom(model_str.clone(), provider)
        } else {
            // Use first available model from client
            let models = client.list_models().await;
            models.into_iter().next().unwrap_or_else(|| {
                // Fallback default: Claude Opus via Stakpak
                Model::new(
                    "anthropic/claude-opus-4-5",
                    "Claude Opus 4.5",
                    "stakpak",
                    true,
                    None,
                    ModelLimit::default(),
                )
            })
        };

        // Initialize MCP client and tools (optional for ACP)
        let (mcp_client, mcp_tools, tools) =
            match Self::initialize_mcp_server_and_tools(&config).await {
                Ok(result) => {
                    log::info!("MCP client initialized successfully");
                    // Hold shutdown handles to keep servers alive
                    // They'll be dropped when this agent is dropped, which is fine
                    // since new() is only called once at startup and run_stdio reinitializes
                    let _server_shutdown = result.server_shutdown_tx;
                    let _proxy_shutdown = result.proxy_shutdown_tx;
                    (Some(result.client), result.mcp_tools, result.tools)
                }
                Err(e) => {
                    log::warn!(
                        "Failed to initialize MCP client: {}, continuing without tools",
                        e
                    );
                    (None, Vec::new(), Vec::new())
                }
            };

        // Create cancellation channels
        let (stream_cancel_tx, _) = tokio::sync::broad
```

### Core Architecture Module: `cli/src/commands/acp/utils.rs`
```
use regex::Regex;

/// Strip the MCP server prefix and any trailing "()" from a tool name.
/// Example: "stakpak__run_command" -> "run_command"
/// Example: "run_command" -> "run_command"
/// Example: "str_replace()" -> "str_replace"
pub fn strip_tool_name(name: &str) -> &str {
    let mut result = name;

    // Strip the MCP server prefix (e.g., "stakpak__")
    if let Some(pos) = result.find("__")
        && pos + 2 < result.len()
    {
        result = &result[pos + 2..];
    }

    // Strip trailing "()" if present
    if result.ends_with("()") {
        result = &result[..result.len() - 2];
    }

    result
}

/// Convert XML tags to markdown headers using pattern matching.
/// Handles core context tags plus both legacy and current skill sections.
pub fn convert_xml_tags_to_markdown(text: &str) -> String {
    let mut result = text.to_string();

    let tag_patterns = [
        ("<scratchpad>", "## **Scratchpad**\n"),
        ("<todo>", "### **Todo**\n"),
        ("<local_context>", "### **Local Context**\n"),
        ("<available_skills>", "### **Skills**\n"),
        // Legacy tag kept for backward compatibility with older checkpoints.
        ("<rulebooks>", "### **Skills**\n"),
    ];

    let closing_patterns = [
        "</scratchpad>",
        "</todo>",
        "</local_context>",
        "</available_skills>",
        "</rulebooks>",
    ];

    // Convert opening tags
    for (opening_tag, markdown_header) in tag_patterns.iter() {
        result = result.replace(opening_tag, markdown_header);
    }

    // Remove closing tags
    for closing_tag in closing_patterns.iter() {
        result = result.replace(closing_tag, "");
    }

    result
}

/// Process checkpoint patterns - remove checkpoint IDs completely
pub fn remove_checkpoint_patterns(text: &str) -> String {
    let pattern = r"<checkpoint_id>([^<]*)</checkpoint_id>";
    let regex = match Regex::new(pattern) {
        Ok(r) => r,
        Err(_) => return text.to_string(),
    };

    regex.replace_all(text, "").to_string()
}

/// Process all XML patterns in sequence
pub fn process_all_xml_patterns(text: &str) -> String {
    let mut result = text.to_string();

    // First remove checkpoint patterns
    result = remove_checkpoint_patterns(&result);

    // Then convert XML tags to markdown
    result = convert_xml_tags_to_markdown(&result);

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_tool_name() {
        assert_eq!(strip_tool_name("stakpak__run_command"), "run_command");
        assert_eq!(strip_tool_name("run_command"), "run_command");
        assert_eq!(strip_tool_name("other__server__tool"), "server__tool");
        assert_eq!(strip_tool_name("prefix__"), "prefix__");
        assert_eq!(strip_tool_name("__tool"), "tool");
        assert_eq!(strip_tool_name("str_replace()"), "str_replace");
        assert_eq!(strip_tool_name("create()"), "create");
        assert_eq!(strip_tool_name("stakpak__str_replace()"), "str_replace");
    }

    #[test]
    fn test_convert_xml_tags_to_markdown() {
        let input = "<scratchpad>\n<todo>\n- Task 1\n- Task 2\n</todo>\n</scratchpad>";
        let expected = "## **Scratchpad**\n\n### **Todo**\n\n- Task 1\n- Task 2\n\n";
        let result = convert_xml_tags_to_markdown(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_convert_available_skills_tag_to_markdown() {
        let input = "<available_skills>\n- skill one\n</available_skills>";
        let expected = "### **Skills**\n\n- skill one\n";
        let result = convert_xml_tags_to_markdown(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_convert_legacy_rulebooks_tag_to_skills_markdown() {
        let input = "<rulebooks>\n- skill one\n</rulebooks>";
        let expected = "### **Skills**\n\n- skill one\n";
        let result = convert_xml_tags_to_markdown(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_remove_checkpoint_patterns() {
        let input = "Hello <checkpoint_id>123</checkpoint_id> world";
        let expected = "Hello  world";
        let result = remove_checkpoint_patterns(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_process_all_xml_patterns() {
        let input = "<checkpoint_id>abc</checkpoint_id><scratchpad>\n<todo>\n- Task\n</todo>\n</scratchpad>";
        let expected = "## **Scratchpad**\n\n### **Todo**\n\n- Task\n\n";
        let result = process_all_xml_patterns(input);
        assert_eq!(result, expected);
    }
}

```

### Core Architecture Module: `cli/src/commands/agent/mod.rs`
```
pub mod run;

```

### Core Architecture Module: `cli/src/commands/agent/run/checkpoint.rs`
```
use crate::commands::agent::run::tui::send_input_event;
use rmcp::model::CallToolResult;
use stakpak_api::AgentProvider;
use stakpak_shared::models::integrations::{
    mcp::CallToolResultExt,
    openai::{ChatMessage, MessageContent, Role, ToolCall, ToolCallResult},
};
use stakpak_tui::{InputEvent, LoadingOperation};
use uuid::Uuid;

pub async fn get_checkpoint_messages(
    client: &dyn AgentProvider,
    checkpoint_id: &str,
) -> Result<(Vec<ChatMessage>, Option<serde_json::Value>), String> {
    let checkpoint_uuid = Uuid::parse_str(checkpoint_id).map_err(|_| {
        format!(
            "Invalid checkpoint ID '{}' - must be a valid UUID",
            checkpoint_id
        )
    })?;

    let checkpoint = client
        .get_checkpoint(checkpoint_uuid)
        .await
        .map_err(|e| e.to_string())?;

    Ok((checkpoint.state.messages, checkpoint.state.metadata))
}

pub async fn extract_checkpoint_messages_and_tool_calls(
    checkpoint_id: &str,
    input_tx: &tokio::sync::mpsc::Sender<InputEvent>,
    messages: Vec<ChatMessage>,
) -> Result<(Vec<ChatMessage>, Vec<ToolCall>), String> {
    let mut checkpoint_messages = messages;
    // Append checkpoint_id to the last assistant message if present
    if let Some(last_message) = checkpoint_messages
        .iter_mut()
        .rev()
        .find(|message| message.role != Role::User && message.role != Role::Tool)
        && last_message.role == Role::Assistant
    {
        last_message.content = Some(MessageContent::String(format!(
            "{}\n<checkpoint_id>{}</checkpoint_id>",
            last_message
                .content
                .as_ref()
                .unwrap_or(&MessageContent::String(String::new())),
            checkpoint_id
        )));
    }

    for message in &checkpoint_messages {
        match message.role {
            Role::Assistant => {
                if let Some(content) = &message.content {
                    let _ = input_tx
                        .send(InputEvent::StreamAssistantMessage(
                            Uuid::new_v4(),
                            content.to_string(),
                        ))
                        .await;
                }
            }
            Role::User => {
                if let Some(content) = &message.content {
                    let _ = input_tx
                        .send(InputEvent::AddUserMessage(content.to_string()))
                        .await;
                }
            }
            Role::Tool => {
                let tool_call = checkpoint_messages
                    .iter()
                    .find(|checkpoint_message| {
                        checkpoint_message
                            .tool_calls
                            .as_ref()
                            .is_some_and(|tool_calls| {
                                message.tool_call_id.as_ref().is_some_and(|tool_call_id| {
                                    tool_calls
                                        .iter()
                                        .any(|tool_call| tool_call.id == *tool_call_id)
                                })
                            })
                    })
                    .and_then(|chat_message| {
                        chat_message.tool_calls.as_ref().and_then(|tool_calls| {
                            message.tool_call_id.as_ref().and_then(|tool_call_id| {
                                tool_calls
                                    .iter()
                                    .find(|tool_call| tool_call.id == *tool_call_id)
                            })
                        })
                    });

                if let Some(tool_call) = tool_call {
                    let _ = send_input_event(
                        input_tx,
                        InputEvent::ToolResult(ToolCallResult {
                            call: tool_call.clone(),
                            result: message
                                .content
                                .as_ref()
                                .unwrap_or(&MessageContent::String(String::new()))
                                .to_string(),
                            status: CallToolResult::get_status_from_chat_message(message),
                        }),
                    )
                    .await;
                }
            }
            _ => {}
        }
    }

    // Find the last assistant message that has tool_calls
    let tool_calls = checkpoint_messages
        .iter()
        .rev()
        .find(|msg| msg.role == Role::Assistant && msg.tool_calls.is_some())
        .and_then(|msg| msg.tool_calls.as_ref());

    // Filter out tool calls that already have results (Role::Tool messages)
    let executed_tool_ids: std::collections::HashSet<String> = checkpoint_messages
        .iter()
        .filter(|msg| msg.role == Role::Tool)
        .filter_map(|msg| msg.tool_call_id.clone())
        .collect();

    let pending_tool_calls: Vec<ToolCall> = tool_calls
        .map(|tcs| {
            tcs.iter()
                .filter(|tc| !executed_tool_ids.contains(&tc.id))
                .cloned()
                .collect()
        })
        .unwrap_or_default();

    Ok((checkpoint_messages, pending_tool_calls))
}

pub fn extract_checkpoint_id_from_messages(messages: &[ChatMessage]) -> Option<String> {
    messages
        .last()
        .and_then(|msg| msg.content.as_ref())
        .as_ref()
        .and_then(|content| match content {
            MessageContent::String(text) => {
                if let Some(start) = text.find("<checkpoint_id>") {
                    if let Some(end) = text.find("</checkpoint_id>") {
                        let start_pos = start + "<checkpoint_id>".len();
                        Some(text[start_pos..end].to_string())
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            MessageContent::Array(items) => {
                for item in items {
                    if let Some(text) = &item.text
                        && let Some(start) = text.find("<checkpoint_id>")
                        && let Some(end) = text.find("</checkpoint_id>")
                    {
                        let start_pos = start + "<checkpoint_id>".len();
                        return Some(text[start_pos..end].to_string());
                    }
                }
                None
            }
        })
}

/// Resumes a session from a checkpoint, loading messages and tool calls
pub async fn resume_session_from_checkpoint(
    client: &dyn AgentProvider,
    session_id: &str,
    input_tx: &tokio::sync::mpsc::Sender<InputEvent>,
) -> Result<
    (
        Vec<ChatMessage>,
        Vec<ToolCall>,
        Uuid,
        Option<serde_json::Value>,
    ),
    String,
> {
    let session_uuid = Uuid::parse_str(session_id).map_err(|e| e.to_string())?;

    match client.get_active_checkpoint(session_uuid).await {
        Ok(checkpoint) => {
            let metadata = checkpoint.state.metadata.clone();
            let (chat_messages, tool_calls) = extract_checkpoint_messages_and_tool_calls(
                &checkpoint.id.to_string(),
                input_tx,
                checkpoint.state.messages,
            )
            .await?;

            Ok((chat_messages, tool_calls, checkpoint.session_id, metadata))
        }
        Err(e) => {
            send_input_event(
                input_tx,
                InputEvent::EndLoadingOperation(LoadingOperation::CheckpointResume),
            )
            .await?;
            send_input_event(input_tx, InputEvent::Error(e.to_string())).await?;
            Err("Failed to get session checkpoint".to_string())
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #557** (2026-03-18): **bug: tilde (`~`) expansion in check script paths may be fragile**
  *Symptoms*: ## Summary  Check script paths in `autopilot.toml` using `~` (e.g., `~/.stakpak/checks/endpoints.sh`) work in some contexts but may fail when the autopilot runs as a systemd service under a different user or environment where `HOME` is not set.  ## Details  The config supports paths like:  ```toml [[schedules]] name = "endpoint-health" cron = "*/3 * * * *" check = "~/.stakpak/checks/endpoints.sh" ```  The code in `cli/src/commands/watch/config.rs` has an `expand_tilde()` function that handles this, but:  1. It is unclear whether this expansion is guaranteed in all execution contexts (e.g., systemd service with `User=` directive, cron jobs, Docker containers) 2. There is no documentation about whether `~` is supported or recommended 3. If expansion fails silently, the check script path becomes invalid and the schedule fails  ## Observed Behavior  During deployment, switching from `~/.stakpak/checks/endpoints.sh` to absolute paths (`/home/ec2-user/.stakpak/checks/endpoints.sh`) resolved intermittent issues.  ## Expected Behavior  Either: 1. **Document** that `~` is expanded and under what conditions, OR 2. **Always expand** `~` internally using the process owner's home directory (not relying on `$HOME` env var), OR 3. **Warn** at config load time if a path contains `~` and suggest using absolute paths  ## Key Files  - `cli/src/commands/watch/config.rs` — `expand_tilde()` function - `cli/src/commands/watch/commands/run.rs` — where check paths are resolved
  **Post-Mortem & Fix Analysis**:
  > I' ll do it.

- **Issue #556** (2026-02-16): **bug: stale run state not cleaned on autopilot crash**
  *Symptoms*: ## Summary  When the autopilot process crashes (e.g., due to SIGSEGV #552), schedule runs that were in-progress remain stuck in `running` status indefinitely in the SQLite database. This blocks new runs for the same schedule because the singleton guard in `handle_schedule_event` sees an existing running run and skips execution.  ## Steps to Reproduce  1. Start autopilot with a schedule 2. Trigger the schedule so a run starts 3. Kill the process (or let it crash via #552) 4. Restart autopilot 5. The schedule fires again but is skipped: `"Skipping: previous run still in progress"`  ## Root Cause  The singleton guard in `cli/src/commands/watch/commands/run.rs:231-252`:  ```rust match db.has_running_run(&schedule.name).await {     Ok(true) => {         info!(schedule = %schedule.name, "Skipping: previous run still in progress");         return Ok(());     }     ... } ```  When the process crashes, `update_run_finished()` is never called, so the run stays in `running` status forever.  ## Expected Behavior  On startup, the autopilot should detect and clean up stale runs from previous crashed sessions:  1. Query all runs with `status = "running"` 2. Check if the PID that started them is still alive 3. If not, mark them as `failed` with an error message like `"Autopilot process crashed during execution"`  ## Workaround  Manually run `stakpak autopilot schedule clean` to clear stale runs.  ## Key Files  - `cli/src/commands/watch/commands/run.rs` — singleton guard logic - `cli/src/comm

- **Issue #555** (2026-02-16): **bug: `autopilot channel add` missing `--target` flag**
  *Symptoms*: ## Summary  `stakpak autopilot channel add` does not support a `--target` flag, making it impossible to fully configure a channel via CLI. Combined with the config overwrite bug (#553), this creates a broken workflow.  ## Steps to Reproduce  ```bash stakpak autopilot channel add slack --bot-token xoxb-... --app-token xapp-... --target "#engineering" # Error: unexpected argument '--target' ```  ## Impact  The `target` field (which Slack channel to post to) is one of the most common config fields. Without `--target`:  1. You must manually edit the config file to add `target = "#engineering"` 2. But if you edit the file first and then run `channel add`, it overwrites your edits (#553) 3. The only working path is: run `channel add` first, then manually edit the file  This makes non-interactive/scripted setup impossible for channels with a target.  ## Expected Behavior  `--target` should be a supported flag:  ```bash stakpak autopilot channel add slack \   --bot-token xoxb-... \   --app-token xapp-... \   --target "#engineering" ```  Generating: ```toml [channels.slack] type = "slack" bot_token = "xoxb-..." app_token = "xapp-..." target = "#engineering" enabled = true ```  ## Key Files  - `cli/src/commands/autopilot.rs` — channel add command implementation

- **Issue #554** (2026-02-16): **bug: `autopilot channel add` omits `type` field in generated config**
  *Symptoms*: ## Summary  `stakpak autopilot channel add slack --bot-token ... --app-token ...` generates a config block that is missing the required `type` field. `stakpak up` then fails with a TOML parse error.  ## Steps to Reproduce  1. Run: ```bash stakpak autopilot channel add slack --bot-token xoxb-... --app-token xapp-... ```  2. Inspect `~/.stakpak/autopilot.toml` — the generated config is: ```toml [channels.slack] bot_token = "xoxb-..." app_token = "xapp-..." ```  3. Run `stakpak up` — fails with: ``` TOML parse error at line 24, column 1 missing field `type` ```  ## Expected Behavior  Since the channel type is the positional argument to `channel add`, the command should automatically include `type = "slack"` in the generated config:  ```toml [channels.slack] type = "slack" bot_token = "xoxb-..." app_token = "xapp-..." ```  ## Workaround  Manually add `type = "slack"` to the config file.  ## Key Files  - `cli/src/commands/autopilot.rs` — channel add command implementation

- **Issue #553** (2026-02-16): **bug: `autopilot channel add` overwrites entire autopilot.toml**
  *Symptoms*: ## Summary  Running `stakpak autopilot channel add slack --bot-token ... --app-token ...` replaces the **entire contents** of `~/.stakpak/autopilot.toml` with just the channel/gateway config, destroying all existing schedule definitions and other settings.  ## Steps to Reproduce  1. Create `~/.stakpak/autopilot.toml` with schedules: ```toml [[schedules]] name = "health-check" cron = "*/5 * * * *" prompt = "Check system health" enabled = true  [[schedules]] name = "backup-audit" cron = "0 8 * * *" prompt = "Check backup status" enabled = true ```  2. Run: ```bash stakpak autopilot channel add slack --bot-token xoxb-... --app-token xapp-... ```  3. Check the file — all schedule definitions are gone, replaced with only: ```toml [channels.slack] bot_token = "xoxb-..." app_token = "xapp-..." ```  ## Impact  **Data loss** — all user-configured schedules, runtime settings, and other config are silently destroyed. The user must recreate the entire config from scratch.  ## Expected Behavior  `channel add` should **merge** the channel config into the existing file, preserving all other sections (schedules, runtime, routing, etc.).  ## Key Files  - `cli/src/commands/autopilot.rs` — channel add command implementation

- **Issue #552** (2026-02-16): **bug: SIGSEGV in libsql Hrana driver during autopilot agent execution**
  *Symptoms*: ## Summary  Stakpak autopilot crashes with **SIGSEGV (signal 11)** during agent execution. The crash occurs reproducibly in `libsql::hrana::hyper::HranaStream::execute` on tokio worker threads. Every triggered schedule that invokes the agent results in a segfault within 10-40 seconds, creating an infinite crash loop under systemd.  ## Root Cause  **Known upstream bug: [tursodatabase/libsql#2132](https://github.com/tursodatabase/libsql/issues/2132)**  libsql `Connection` uses `RefCell` internally — not safe for concurrent async access. In release builds, `RefCell` borrow checks are optimized away, so instead of a clean panic (`already mutably borrowed: BorrowError`), the result is memory corruption → SIGSEGV.  The codebase wraps `Connection` in `tokio::sync::Mutex<Connection>`, but this does not help because libsql internally clones the connection via `RefCell::clone` during `prepare()` calls, and the cloned connection shares the same underlying `RefCell` state.  ### Secondary issue: `Database` dropped while `Connection` still alive  All three storage constructors drop the `Database` object at the end of `new()` while the `Connection` continues to be used:  ```rust let db = libsql::Builder::new_local(db_path).build().await?; let conn = db.connect()?; // db is dropped here! Connection outlives its Database. let storage = Self { conn: Mutex::new(conn) }; ```  ## Affected Code  All three storage types use the identical vulnerable pattern:  | Storage Type | File | Line | |--------

- **Issue #502** (2026-02-08): **fix(api): prevent duplicate and orphaned tool_result Anthropic API 400 errors**
  *Symptoms*: ## Description  Fixes two Anthropic API 400 errors that occur during interactive tool execution:  1. **`each tool_use must have a single result`** — Duplicate `tool_result` blocks for the same `tool_use_id`, caused by the cancel/retry flow pushing a result in `AcceptTool` and then again in `SendToolResult`.  2. **`unexpected tool_use_id found in tool_result blocks`** — Caused by (a) consecutive `role=user` messages when multiple `role=tool` messages are converted for Anthropic, and (b) orphaned `tool_result` blocks from checkpoint resume edge cases.  ## Changes Made  ### Three-layer defense in depth  **Layer 1 — Source prevention** (`mode_interactive.rs`, AcceptTool handler): - Skip pushing `tool_result` for cancelled tool calls when retry/shell will send the final result - Push a `TOOL_CALL_CANCELLED` placeholder only when queued tools need the `tool_use` resolved immediately  **Layer 2 — Pre-API sanitization** (`mode_interactive.rs`, `sanitize_tool_results()`): - Called before every API request - Deduplicates: keeps only the last `tool_result` per `tool_call_id` - Removes orphans: drops `tool_result` messages that don't match any assistant `tool_call`  **Layer 3 — Context manager post-processing** (`task_board_context_manager.rs`): - `merge_consecutive_same_role()`: Combines consecutive `role=tool` messages into one message with multiple `ToolResult` parts, preventing consecutive `role=user` messages after Anthropic conversion - `dedup_tool_results()`: Removes duplicate `To

- **Issue #415** (2026-01-03): **fix: tool call handling**
  *Symptoms*: - Implemented ID-based matching for tool calls in the Anthropic and OpenAI streams, allowing for better tracking and separation of tool calls with the same index. - Updated the processing logic to accumulate arguments and emit ToolCallEnd events correctly. - Added comprehensive tests to verify the correct behavior of tool calls, including scenarios with multiple calls and handling of arguments across chunks. - Improved the handling of tool call names and arguments in the StakAI client to ensure proper JSON parsing and accumulation.
  **Post-Mortem & Fix Analysis**:
  > Test works locally. that's weird

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

### Incident Patch 1: `863a27a5` (2026-06-10)
**Commit Message**: Merge pull request #752 from stakpak/fix/ak-publish-version

fix(ak): specify version for stakpak-api dependency

**File**: `libs/ak/Cargo.toml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ regex = { workspace = true }
 globset = { workspace = true }
 grep-matcher = { workspace = true }
 grep-regex = { workspace = true }
-stakpak-api = { path = "../api" }
+stakpak-api = { workspace = true }
 tokio = { workspace = true }
 
 [dev-dependencies]
```

---

### Incident Patch 2: `34a846a1` (2026-06-10)
**Commit Message**: fix(ak): specify version for stakpak-api dependency

The bare path dependency on stakpak-api had no version requirement,
which causes cargo publish to fail (crates.io requires a version for
all dependencies). Switch to the workspace dependency like every other
crate, which inherits version = "0.3.87".

**File**: `libs/ak/Cargo.toml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ regex = { workspace = true }
 globset = { workspace = true }
 grep-matcher = { workspace = true }
 grep-regex = { workspace = true }
-stakpak-api = { path = "../api" }
+stakpak-api = { workspace = true }
 tokio = { workspace = true }
 
 [dev-dependencies]
```

---

### Incident Patch 3: `24102b83` (2026-06-10)
**Commit Message**: Merge pull request #750 from stakpak/fix/mcp-proxy-large-output-artifacts

fix(mcp): artifact large tool outputs in proxy

**File**: `libs/mcp/proxy/src/client/mod.rs` (modified, +31/-0)
```diff
@@ -25,12 +25,20 @@ impl ProxyClientHandler {
     }
 }
 
+fn progress_notification_for_forwarding(
+    notification: ProgressNotificationParam,
+) -> ProgressNotificationParam {
+    notification
+}
+
 impl ClientHandler for ProxyClientHandler {
     async fn on_progress(
         &self,
         notification: ProgressNotificationParam,
         _ctx: NotificationContext<RoleClient>,
     ) {
+        let notification = progress_notification_for_forwarding(notification);
+
         // Then forward progress notification from upstream server to downstream server
         let peer = self.downstream_peer.lock().await;
         if let Some(ref peer) = *peer {
@@ -282,6 +290,7 @@ fn substitute_env_vars(s: &str) -> String {
 #[cfg(test)]
 mod tests {
     use super::*;
+    use rmcp::model::{NumberOrString, ProgressToken};
     use std::env;
     use std::sync::Mutex;
 
@@ -318,6 +327,28 @@ mod tests {
         }
     }
 
+    #[test]
+    fn progress_notification_forwarding_preserves_large_message_without_artifacting() {
+        let large_message = "progress line\n".repeat(400);
+        let notification = ProgressNotificationParam {
+            progress_token: ProgressToken(NumberOrString::Number(0)),
+            progress: 50.0,
+            total: None,
+            message: Some(large_message.clone()),
+        };
+
+        let forwarded = progress_notification_for_forwarding(notification);
+
+        assert_eq!(forwarded.message.as_deref(), Some(large_message.as_str()));
+        assert!(
+            !forwarded
+                .message
+                .as_deref()
+                .expect("message should be preserved")
+                .contains("Full output saved to ")
+        );
+    }
+
     #[test]
     fn test_substitute_no_vars() {
         assert_eq!(substitute_env_vars("hello world"), "hello world");
```

**File**: `libs/mcp/proxy/src/server/mod.rs` (modified, +183/-0)
```diff
@@ -22,6 +22,7 @@ use rmcp::transport::streamable_http_client::StreamableHttpClientTransportConfig
 use stakpak_shared::cert_utils::CertificateChain;
 use stakpak_shared::paths::stakpak_home_dir;
 use stakpak_shared::secret_manager::SecretManager;
+use stakpak_shared::utils::{LargeOutputLimits, handle_large_output_with_limits};
 use std::collections::HashMap;
 use std::future::Future;
 use std::sync::Arc;
@@ -126,6 +127,51 @@ fn restore_secrets_in_json_value(
     }
 }
 
+const PROXY_LARGE_OUTPUT_MAX_LINES: usize = 300;
+const PROXY_LARGE_OUTPUT_MAX_BYTES: usize = 64 * 1024;
+
+fn artifact_final_tool_result_text(
+    mut result: CallToolResult,
+    client_name: &str,
+    tool_name: &str,
+) -> CallToolResult {
+    let mut text_blocks = Vec::new();
+    let mut non_text_content = Vec::new();
+
+    for item in result.content {
+        if let Some(text_content) = item.raw.as_text() {
+            text_blocks.push(text_content.text.clone());
+        } else {
+            non_text_content.push(item);
+        }
+    }
+
+    if text_blocks.is_empty() {
+        result.content = non_text_content;
+        return result;
+    }
+
+    let flattened_text = text_blocks.join("\n");
+    let file_prefix = format!("tool-output.{}.{}", client_name, tool_name);
+    let processed_text = match handle_large_output_with_limits(
+        &flattened_text,
+        LargeOutputLimits {
+            file_prefix: &file_prefix,
+            max_lines: PROXY_LARGE_OUTPUT_MAX_LINES,
+            max_bytes: PROXY_LARGE_OUTPUT_MAX_BYTES,
+            show_head: false,
+        },
+    ) {
+        Ok(text) => text,
+        Err(e) => format!("FAILED_TO_HANDLE_LARGE_OUTPUT: {}", e),
+    };
+
+    result.content = std::iter::once(Content::text(processed_text))
+        .chain(non_text_content)
+        .collect();
+    result
+}
+
 #[derive(Debug, Clone)]
 struct RequestTracking {
     client_name: String,
@@ -670,6 +716,8 @@ impl ServerHandler for ProxyServer {
                 .collect();
         }
 
+        result = artifact_final_tool_result_text(result, &client_name, &tool_name);
+
         Ok(result)
     }
 
@@ -881,8 +929,40 @@ pub async fn start_proxy_server(
 #[cfg(test)]
 mod tests {
     use super::*;
+    use rmcp::model::ResourceContents;
     use serde_json::json;
 
+    fn text_content(content: &Content) -> &str {
+        content
+            .raw
+            .as_text()
+            .map(|text| text.text.as_str())
+            .expect("content should be text")
+    }
+
+    fn artifact_path_from_preview(preview: &str) -> &str {
+        preview
+            .lines()
+            .next()
+            .and_then(|line| line.split_once("Full output saved to "))
+            .map(|(_, path)| path)
+            .expect("preview should contain saved artifact path")
+    }
+
+    fn read_artifact_from_preview(preview: &str) -> String {
+        let artifact_path = artifact_path_from_preview(preview);
+        let artifact = std::fs::read_to_string(artifact_path).expect("artifact should be readable");
+        std::fs::remove_file(artifact_path).expect("artifact should be removable");
+        artifact
+    }
+
+    fn numbered_lines(prefix: &str, count: usize) -> String {
+        (1..=count)
+            .map(|line| format!("{prefix}-{line:03}"))
+            .collect::<Vec<_>>()
+            .join("\n")
+    }
+
     /// Helper: build a redaction map from pairs
     fn map(pairs: &[(&str, &str)]) -> HashMap<String, String> {
         pairs
@@ -891,6 +971,109 @@ mod tests {
             .collect()
     }
 
+    #[test]
+    fn artifact_final_tool_result_previews_large_success_text() {
+        let output = numbered_lines("success", 301);
+        let result = CallToolResult::success(vec![Content::text(output.clone())]);
+
+        let processed = artifact_final_tool_result_text(result, "stakpak", "run_command");
+
+        assert_eq!(processed.is_error, Some(false));
+        assert_eq!(processed.content.len(), 1);
+        let preview
```

**File**: `libs/mcp/server/src/local_tools.rs` (modified, +4/-42)
```diff
@@ -25,7 +25,7 @@ use stakpak_shared::models::integrations::openai::{
 use stakpak_shared::task_manager::{StartTaskOptions, TaskInfo};
 use stakpak_shared::tls_client::{TlsClientConfig, create_tls_client};
 use stakpak_shared::utils::{
-    LocalFileSystemProvider, generate_directory_tree, handle_large_output, sanitize_text_output,
+    LocalFileSystemProvider, generate_directory_tree, sanitize_text_output,
 };
 use std::fs::{self};
 use std::path::Path;
@@ -309,8 +309,6 @@ impl ToolContainer {
     #[tool(
         description = "Execute a shell command locally with full system access.
 
-If the command's output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 For remote command execution via SSH, use the run_remote_command tool instead."
     )]
     pub async fn run_command(
@@ -338,8 +336,6 @@ REMOTE EXECUTION:
   * 'user@server.com' (uses default port 22 and auto-discovered keys)
   * 'user@server.com:2222' with password authentication
 
-If the command's output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 For local command execution, use the run_command tool instead.")]
     pub async fn run_remote_command(
         &self,
@@ -702,8 +698,6 @@ This tool provides comprehensive details about a background task started with ru
 - Complete command output
 - Error information if the task failed
 
-If the task output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 Use this tool to check the progress and results of long-running background tasks."
     )]
     pub async fn get_task_details(
@@ -760,16 +754,7 @@ Use this tool to check the progress and results of long-running background tasks
                         // Subagent output - use Display impl for LLM-friendly formatting
                         manifest.to_string()
                     } else {
-                        // Regular task output - use standard handling
-                        match handle_large_output(output, "task.output", 300, false) {
-                            Ok(result) => result,
-                            Err(e) => {
-                                return Ok(CallToolResult::error(vec![
-                                    Content::text("OUTPUT_HANDLING_ERROR"),
-                                    Content::text(format!("Failed to handle task output: {}", e)),
-                                ]));
-                            }
-                        }
+                        output.clone()
                     }
                 } else {
                     "No output available".to_string()
@@ -1018,9 +1003,7 @@ SECURITY FEATURES:
 - Only allows HTTPS URLs for secure connections
 - Follows redirects safely with limits
 
-The tool fetches the HTML content from the specified URL and converts it to clean, readable markdown. This is useful for reading web articles, documentation, or any web content in a text-friendly format.
-
-The response will be truncated if it exceeds 300 lines, with the full content saved to a local file."
+The tool fetches the HTML content from the specified URL and converts it to clean, readable markdown. This is useful for reading web articles, documentation, or any web content in a text-friendly format."
     )]
     pub async fn view_web_page(
         &self,
@@ -1097,17 +1080,7 @@ The response will be truncated if it exceeds 300 lines, with the full content sa
         let markdown_content = html2md::rewrite_html(&html_content, false);
         let sanitized_content = sanitize_text_output(&markdown_content);
 
-        let result = match handle_large_output(&sanitized_content, "webpage", 300, false) {
-            Ok(result) => result,
-            Err(e) => {
-                return Ok(CallToolResult::error(vec![
-                    Content::text("OUTPUT_HANDLING_ERROR"),
-                    Content::
```

**File**: `libs/mcp/server/src/remote_tools.rs` (modified, +2/-25)
```diff
@@ -5,7 +5,7 @@ use rmcp::{
 };
 use serde::Deserialize;
 use stakpak_api::models::SearchDocsRequest as ApiSearchDocsRequest;
-use stakpak_shared::utils::{handle_large_output, sanitize_text_output};
+use stakpak_shared::utils::sanitize_text_output;
 // use stakpak_api::models::CodeIndex;
 // use stakpak_shared::local_store::LocalStore;
 // use stakpak_shared::models::indexing::IndexingStatus;
@@ -302,34 +302,11 @@ If your goal requires understanding multiple distinct topics or technologies, ma
             }
         };
 
-        const MAX_LINES: usize = 600;
-
-        let mut remaining_lines = MAX_LINES;
-        let mut remaining_items = response.len();
-
         let processed: Vec<Content> = response
             .into_iter()
             .map(|c| {
-                // Compute this element's allowance at the last possible moment
-                let allowance = if remaining_items > 0 {
-                    (remaining_lines / remaining_items).max(1)
-                } else {
-                    1
-                };
-
-                remaining_items = remaining_items.saturating_sub(1);
-
                 if let Some(RawTextContent { text, meta: None }) = c.as_text() {
-                    let sanitized = sanitize_text_output(text);
-                    match handle_large_output(&sanitized, "search", allowance, true) {
-                        Ok(final_text) => {
-                            // Estimate consumption (best-effort)
-                            let used = final_text.lines().count().min(remaining_lines);
-                            remaining_lines = remaining_lines.saturating_sub(used);
-                            Content::text(final_text)
-                        }
-                        Err(e) => Content::text(format!("FAILED_TO_HANDLE_LARGE_OUTPUT: {}", e)),
-                    }
+                    Content::text(sanitize_text_output(text))
                 } else {
                     c
                 }
```

**File**: `libs/shared/src/utils.rs` (modified, +245/-36)
```diff
@@ -3,6 +3,7 @@ use async_trait::async_trait;
 use rand::Rng;
 use std::fs;
 use std::path::{Path, PathBuf};
+use uuid::Uuid;
 use walkdir::DirEntry;
 
 /// Read .gitignore patterns from the specified base directory
@@ -250,6 +251,132 @@ pub fn truncate_chars_with_ellipsis(text: &str, max_chars: usize) -> String {
     truncated
 }
 
+pub struct LargeOutputLimits<'a> {
+    pub file_prefix: &'a str,
+    pub max_lines: usize,
+    pub max_bytes: usize,
+    pub show_head: bool,
+}
+
+fn sanitize_artifact_file_prefix(file_prefix: &str) -> String {
+    let sanitized = file_prefix
+        .chars()
+        .map(|c| {
+            if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.') {
+                c
+            } else {
+                '-'
+            }
+        })
+        .collect::<String>()
+        .trim_matches(|c| matches!(c, '-' | '_' | '.'))
+        .to_string();
+
+    if sanitized.is_empty() {
+        "output".to_string()
+    } else {
+        sanitized
+    }
+}
+
+fn write_output_artifact(file_prefix: &str, output: &str) -> Result<String, String> {
+    let output_file = format!(
+        "{}.{}.txt",
+        sanitize_artifact_file_prefix(file_prefix),
+        Uuid::new_v4().simple()
+    );
+
+    LocalStore::write_session_data(&output_file, output)
+        .map_err(|e| format!("Failed to write session data: {}", e))
+}
+
+fn line_preview(
+    output_lines: &[&str],
+    output_file_path: &str,
+    max_lines: usize,
+    show_head: bool,
+) -> String {
+    let excerpt = if show_head {
+        let head_lines: Vec<&str> = output_lines.iter().take(max_lines).copied().collect();
+        head_lines.join("\n")
+    } else {
+        let mut tail_lines: Vec<&str> =
+            output_lines.iter().rev().take(max_lines).copied().collect();
+        tail_lines.reverse();
+        tail_lines.join("\n")
+    };
+
+    let position = if show_head { "first" } else { "last" };
+    format!(
+        "Showing the {} {} / {} output lines. Full output saved to {}\n{}\n{}",
+        position,
+        max_lines,
+        output_lines.len(),
+        output_file_path,
+        if show_head { "" } else { "...\n" },
+        excerpt
+    )
+}
+
+// start/end are adjusted to valid UTF-8 character boundaries before slicing.
+#[allow(clippy::string_slice)]
+fn byte_excerpt(output: &str, max_bytes: usize, show_head: bool) -> (&str, usize) {
+    if show_head {
+        let mut end = max_bytes.min(output.len());
+        while end > 0 && !output.is_char_boundary(end) {
+            end -= 1;
+        }
+        (&output[..end], end)
+    } else {
+        let mut start = output.len().saturating_sub(max_bytes);
+        while start < output.len() && !output.is_char_boundary(start) {
+            start += 1;
+        }
+        (&output[start..], output.len() - start)
+    }
+}
+
+fn byte_preview(output: &str, output_file_path: &str, max_bytes: usize, show_head: bool) -> String {
+    let (excerpt, excerpt_bytes) = byte_excerpt(output, max_bytes, show_head);
+    let position = if show_head { "first" } else { "last" };
+
+    format!(
+        "Showing the {} {} / {} output bytes. Full output saved to {}\n{}\n{}",
+        position,
+        excerpt_bytes,
+        output.len(),
+        output_file_path,
+        if show_head { "" } else { "...\n" },
+        excerpt
+    )
+}
+
+pub fn handle_large_output_with_limits(
+    output: &str,
+    limits: LargeOutputLimits<'_>,
+) -> Result<String, String> {
+    let output_lines = output.lines().collect::<Vec<_>>();
+    if output_lines.len() >= limits.max_lines {
+        let output_file_path = write_output_artifact(limits.file_prefix, output)?;
+        Ok(line_preview(
+            &output_lines,
+            &output_file_path,
+            limits.max_lines,
+            limits.show_head,
+        ))
+    } else if output.len() > limits.max_bytes {
+        let output_file_path = write_output_artifact(limits.file_prefix, output)?;
+        Ok(byte_preview(
+         
```

---

### Incident Patch 4: `bbacb4c6` (2026-06-10)
**Commit Message**: refactor(mcp): drop mcp- prefix from proxy artifact filenames

Rename large-output artifact prefix from mcp-tool-output to tool-output
so it doesn't leak MCP protocol semantics to the model (we also proxy
internal tools). Keeps a neutral, self-describing prefix so artifacts
stay greppable in the shared session store.

Addresses review feedback on #750.

**File**: `libs/mcp/proxy/src/server/mod.rs` (modified, +1/-1)
```diff
@@ -152,7 +152,7 @@ fn artifact_final_tool_result_text(
     }
 
     let flattened_text = text_blocks.join("\n");
-    let file_prefix = format!("mcp-tool-output.{}.{}", client_name, tool_name);
+    let file_prefix = format!("tool-output.{}.{}", client_name, tool_name);
     let processed_text = match handle_large_output_with_limits(
         &flattened_text,
         LargeOutputLimits {
```

---

### Incident Patch 5: `01464938` (2026-06-05)
**Commit Message**: fix(mcp): artifact large tool outputs in proxy

**File**: `libs/mcp/proxy/src/client/mod.rs` (modified, +31/-0)
```diff
@@ -25,12 +25,20 @@ impl ProxyClientHandler {
     }
 }
 
+fn progress_notification_for_forwarding(
+    notification: ProgressNotificationParam,
+) -> ProgressNotificationParam {
+    notification
+}
+
 impl ClientHandler for ProxyClientHandler {
     async fn on_progress(
         &self,
         notification: ProgressNotificationParam,
         _ctx: NotificationContext<RoleClient>,
     ) {
+        let notification = progress_notification_for_forwarding(notification);
+
         // Then forward progress notification from upstream server to downstream server
         let peer = self.downstream_peer.lock().await;
         if let Some(ref peer) = *peer {
@@ -282,6 +290,7 @@ fn substitute_env_vars(s: &str) -> String {
 #[cfg(test)]
 mod tests {
     use super::*;
+    use rmcp::model::{NumberOrString, ProgressToken};
     use std::env;
     use std::sync::Mutex;
 
@@ -318,6 +327,28 @@ mod tests {
         }
     }
 
+    #[test]
+    fn progress_notification_forwarding_preserves_large_message_without_artifacting() {
+        let large_message = "progress line\n".repeat(400);
+        let notification = ProgressNotificationParam {
+            progress_token: ProgressToken(NumberOrString::Number(0)),
+            progress: 50.0,
+            total: None,
+            message: Some(large_message.clone()),
+        };
+
+        let forwarded = progress_notification_for_forwarding(notification);
+
+        assert_eq!(forwarded.message.as_deref(), Some(large_message.as_str()));
+        assert!(
+            !forwarded
+                .message
+                .as_deref()
+                .expect("message should be preserved")
+                .contains("Full output saved to ")
+        );
+    }
+
     #[test]
     fn test_substitute_no_vars() {
         assert_eq!(substitute_env_vars("hello world"), "hello world");
```

**File**: `libs/mcp/proxy/src/server/mod.rs` (modified, +183/-0)
```diff
@@ -22,6 +22,7 @@ use rmcp::transport::streamable_http_client::StreamableHttpClientTransportConfig
 use stakpak_shared::cert_utils::CertificateChain;
 use stakpak_shared::paths::stakpak_home_dir;
 use stakpak_shared::secret_manager::SecretManager;
+use stakpak_shared::utils::{LargeOutputLimits, handle_large_output_with_limits};
 use std::collections::HashMap;
 use std::future::Future;
 use std::sync::Arc;
@@ -126,6 +127,51 @@ fn restore_secrets_in_json_value(
     }
 }
 
+const PROXY_LARGE_OUTPUT_MAX_LINES: usize = 300;
+const PROXY_LARGE_OUTPUT_MAX_BYTES: usize = 64 * 1024;
+
+fn artifact_final_tool_result_text(
+    mut result: CallToolResult,
+    client_name: &str,
+    tool_name: &str,
+) -> CallToolResult {
+    let mut text_blocks = Vec::new();
+    let mut non_text_content = Vec::new();
+
+    for item in result.content {
+        if let Some(text_content) = item.raw.as_text() {
+            text_blocks.push(text_content.text.clone());
+        } else {
+            non_text_content.push(item);
+        }
+    }
+
+    if text_blocks.is_empty() {
+        result.content = non_text_content;
+        return result;
+    }
+
+    let flattened_text = text_blocks.join("\n");
+    let file_prefix = format!("mcp-tool-output.{}.{}", client_name, tool_name);
+    let processed_text = match handle_large_output_with_limits(
+        &flattened_text,
+        LargeOutputLimits {
+            file_prefix: &file_prefix,
+            max_lines: PROXY_LARGE_OUTPUT_MAX_LINES,
+            max_bytes: PROXY_LARGE_OUTPUT_MAX_BYTES,
+            show_head: false,
+        },
+    ) {
+        Ok(text) => text,
+        Err(e) => format!("FAILED_TO_HANDLE_LARGE_OUTPUT: {}", e),
+    };
+
+    result.content = std::iter::once(Content::text(processed_text))
+        .chain(non_text_content)
+        .collect();
+    result
+}
+
 #[derive(Debug, Clone)]
 struct RequestTracking {
     client_name: String,
@@ -670,6 +716,8 @@ impl ServerHandler for ProxyServer {
                 .collect();
         }
 
+        result = artifact_final_tool_result_text(result, &client_name, &tool_name);
+
         Ok(result)
     }
 
@@ -881,8 +929,40 @@ pub async fn start_proxy_server(
 #[cfg(test)]
 mod tests {
     use super::*;
+    use rmcp::model::ResourceContents;
     use serde_json::json;
 
+    fn text_content(content: &Content) -> &str {
+        content
+            .raw
+            .as_text()
+            .map(|text| text.text.as_str())
+            .expect("content should be text")
+    }
+
+    fn artifact_path_from_preview(preview: &str) -> &str {
+        preview
+            .lines()
+            .next()
+            .and_then(|line| line.split_once("Full output saved to "))
+            .map(|(_, path)| path)
+            .expect("preview should contain saved artifact path")
+    }
+
+    fn read_artifact_from_preview(preview: &str) -> String {
+        let artifact_path = artifact_path_from_preview(preview);
+        let artifact = std::fs::read_to_string(artifact_path).expect("artifact should be readable");
+        std::fs::remove_file(artifact_path).expect("artifact should be removable");
+        artifact
+    }
+
+    fn numbered_lines(prefix: &str, count: usize) -> String {
+        (1..=count)
+            .map(|line| format!("{prefix}-{line:03}"))
+            .collect::<Vec<_>>()
+            .join("\n")
+    }
+
     /// Helper: build a redaction map from pairs
     fn map(pairs: &[(&str, &str)]) -> HashMap<String, String> {
         pairs
@@ -891,6 +971,109 @@ mod tests {
             .collect()
     }
 
+    #[test]
+    fn artifact_final_tool_result_previews_large_success_text() {
+        let output = numbered_lines("success", 301);
+        let result = CallToolResult::success(vec![Content::text(output.clone())]);
+
+        let processed = artifact_final_tool_result_text(result, "stakpak", "run_command");
+
+        assert_eq!(processed.is_error, Some(false));
+        assert_eq!(processed.content.len(), 1);
+        let pre
```

**File**: `libs/mcp/server/src/local_tools.rs` (modified, +4/-42)
```diff
@@ -25,7 +25,7 @@ use stakpak_shared::models::integrations::openai::{
 use stakpak_shared::task_manager::{StartTaskOptions, TaskInfo};
 use stakpak_shared::tls_client::{TlsClientConfig, create_tls_client};
 use stakpak_shared::utils::{
-    LocalFileSystemProvider, generate_directory_tree, handle_large_output, sanitize_text_output,
+    LocalFileSystemProvider, generate_directory_tree, sanitize_text_output,
 };
 use std::fs::{self};
 use std::path::Path;
@@ -309,8 +309,6 @@ impl ToolContainer {
     #[tool(
         description = "Execute a shell command locally with full system access.
 
-If the command's output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 For remote command execution via SSH, use the run_remote_command tool instead."
     )]
     pub async fn run_command(
@@ -338,8 +336,6 @@ REMOTE EXECUTION:
   * 'user@server.com' (uses default port 22 and auto-discovered keys)
   * 'user@server.com:2222' with password authentication
 
-If the command's output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 For local command execution, use the run_command tool instead.")]
     pub async fn run_remote_command(
         &self,
@@ -702,8 +698,6 @@ This tool provides comprehensive details about a background task started with ru
 - Complete command output
 - Error information if the task failed
 
-If the task output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 Use this tool to check the progress and results of long-running background tasks."
     )]
     pub async fn get_task_details(
@@ -760,16 +754,7 @@ Use this tool to check the progress and results of long-running background tasks
                         // Subagent output - use Display impl for LLM-friendly formatting
                         manifest.to_string()
                     } else {
-                        // Regular task output - use standard handling
-                        match handle_large_output(output, "task.output", 300, false) {
-                            Ok(result) => result,
-                            Err(e) => {
-                                return Ok(CallToolResult::error(vec![
-                                    Content::text("OUTPUT_HANDLING_ERROR"),
-                                    Content::text(format!("Failed to handle task output: {}", e)),
-                                ]));
-                            }
-                        }
+                        output.clone()
                     }
                 } else {
                     "No output available".to_string()
@@ -1018,9 +1003,7 @@ SECURITY FEATURES:
 - Only allows HTTPS URLs for secure connections
 - Follows redirects safely with limits
 
-The tool fetches the HTML content from the specified URL and converts it to clean, readable markdown. This is useful for reading web articles, documentation, or any web content in a text-friendly format.
-
-The response will be truncated if it exceeds 300 lines, with the full content saved to a local file."
+The tool fetches the HTML content from the specified URL and converts it to clean, readable markdown. This is useful for reading web articles, documentation, or any web content in a text-friendly format."
     )]
     pub async fn view_web_page(
         &self,
@@ -1097,17 +1080,7 @@ The response will be truncated if it exceeds 300 lines, with the full content sa
         let markdown_content = html2md::rewrite_html(&html_content, false);
         let sanitized_content = sanitize_text_output(&markdown_content);
 
-        let result = match handle_large_output(&sanitized_content, "webpage", 300, false) {
-            Ok(result) => result,
-            Err(e) => {
-                return Ok(CallToolResult::error(vec![
-                    Content::text("OUTPUT_HANDLING_ERROR"),
-                    Content::
```

**File**: `libs/mcp/server/src/remote_tools.rs` (modified, +2/-25)
```diff
@@ -5,7 +5,7 @@ use rmcp::{
 };
 use serde::Deserialize;
 use stakpak_api::models::SearchDocsRequest as ApiSearchDocsRequest;
-use stakpak_shared::utils::{handle_large_output, sanitize_text_output};
+use stakpak_shared::utils::sanitize_text_output;
 // use stakpak_api::models::CodeIndex;
 // use stakpak_shared::local_store::LocalStore;
 // use stakpak_shared::models::indexing::IndexingStatus;
@@ -302,34 +302,11 @@ If your goal requires understanding multiple distinct topics or technologies, ma
             }
         };
 
-        const MAX_LINES: usize = 600;
-
-        let mut remaining_lines = MAX_LINES;
-        let mut remaining_items = response.len();
-
         let processed: Vec<Content> = response
             .into_iter()
             .map(|c| {
-                // Compute this element's allowance at the last possible moment
-                let allowance = if remaining_items > 0 {
-                    (remaining_lines / remaining_items).max(1)
-                } else {
-                    1
-                };
-
-                remaining_items = remaining_items.saturating_sub(1);
-
                 if let Some(RawTextContent { text, meta: None }) = c.as_text() {
-                    let sanitized = sanitize_text_output(text);
-                    match handle_large_output(&sanitized, "search", allowance, true) {
-                        Ok(final_text) => {
-                            // Estimate consumption (best-effort)
-                            let used = final_text.lines().count().min(remaining_lines);
-                            remaining_lines = remaining_lines.saturating_sub(used);
-                            Content::text(final_text)
-                        }
-                        Err(e) => Content::text(format!("FAILED_TO_HANDLE_LARGE_OUTPUT: {}", e)),
-                    }
+                    Content::text(sanitize_text_output(text))
                 } else {
                     c
                 }
```

**File**: `libs/shared/src/utils.rs` (modified, +245/-36)
```diff
@@ -3,6 +3,7 @@ use async_trait::async_trait;
 use rand::Rng;
 use std::fs;
 use std::path::{Path, PathBuf};
+use uuid::Uuid;
 use walkdir::DirEntry;
 
 /// Read .gitignore patterns from the specified base directory
@@ -250,6 +251,132 @@ pub fn truncate_chars_with_ellipsis(text: &str, max_chars: usize) -> String {
     truncated
 }
 
+pub struct LargeOutputLimits<'a> {
+    pub file_prefix: &'a str,
+    pub max_lines: usize,
+    pub max_bytes: usize,
+    pub show_head: bool,
+}
+
+fn sanitize_artifact_file_prefix(file_prefix: &str) -> String {
+    let sanitized = file_prefix
+        .chars()
+        .map(|c| {
+            if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.') {
+                c
+            } else {
+                '-'
+            }
+        })
+        .collect::<String>()
+        .trim_matches(|c| matches!(c, '-' | '_' | '.'))
+        .to_string();
+
+    if sanitized.is_empty() {
+        "output".to_string()
+    } else {
+        sanitized
+    }
+}
+
+fn write_output_artifact(file_prefix: &str, output: &str) -> Result<String, String> {
+    let output_file = format!(
+        "{}.{}.txt",
+        sanitize_artifact_file_prefix(file_prefix),
+        Uuid::new_v4().simple()
+    );
+
+    LocalStore::write_session_data(&output_file, output)
+        .map_err(|e| format!("Failed to write session data: {}", e))
+}
+
+fn line_preview(
+    output_lines: &[&str],
+    output_file_path: &str,
+    max_lines: usize,
+    show_head: bool,
+) -> String {
+    let excerpt = if show_head {
+        let head_lines: Vec<&str> = output_lines.iter().take(max_lines).copied().collect();
+        head_lines.join("\n")
+    } else {
+        let mut tail_lines: Vec<&str> =
+            output_lines.iter().rev().take(max_lines).copied().collect();
+        tail_lines.reverse();
+        tail_lines.join("\n")
+    };
+
+    let position = if show_head { "first" } else { "last" };
+    format!(
+        "Showing the {} {} / {} output lines. Full output saved to {}\n{}\n{}",
+        position,
+        max_lines,
+        output_lines.len(),
+        output_file_path,
+        if show_head { "" } else { "...\n" },
+        excerpt
+    )
+}
+
+// start/end are adjusted to valid UTF-8 character boundaries before slicing.
+#[allow(clippy::string_slice)]
+fn byte_excerpt(output: &str, max_bytes: usize, show_head: bool) -> (&str, usize) {
+    if show_head {
+        let mut end = max_bytes.min(output.len());
+        while end > 0 && !output.is_char_boundary(end) {
+            end -= 1;
+        }
+        (&output[..end], end)
+    } else {
+        let mut start = output.len().saturating_sub(max_bytes);
+        while start < output.len() && !output.is_char_boundary(start) {
+            start += 1;
+        }
+        (&output[start..], output.len() - start)
+    }
+}
+
+fn byte_preview(output: &str, output_file_path: &str, max_bytes: usize, show_head: bool) -> String {
+    let (excerpt, excerpt_bytes) = byte_excerpt(output, max_bytes, show_head);
+    let position = if show_head { "first" } else { "last" };
+
+    format!(
+        "Showing the {} {} / {} output bytes. Full output saved to {}\n{}\n{}",
+        position,
+        excerpt_bytes,
+        output.len(),
+        output_file_path,
+        if show_head { "" } else { "...\n" },
+        excerpt
+    )
+}
+
+pub fn handle_large_output_with_limits(
+    output: &str,
+    limits: LargeOutputLimits<'_>,
+) -> Result<String, String> {
+    let output_lines = output.lines().collect::<Vec<_>>();
+    if output_lines.len() >= limits.max_lines {
+        let output_file_path = write_output_artifact(limits.file_prefix, output)?;
+        Ok(line_preview(
+            &output_lines,
+            &output_file_path,
+            limits.max_lines,
+            limits.show_head,
+        ))
+    } else if output.len() > limits.max_bytes {
+        let output_file_path = write_output_artifact(limits.file_prefix, output)?;
+        Ok(byte_preview(
+         
```

---

### Incident Patch 6: `a6d4afd4` (2026-06-04)
**Commit Message**: fix(knowledge) fix cached_path validation

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `libs/api/src/stakpak/knowledge/cache.rs` (modified, +3/-3)
```diff
@@ -24,12 +24,12 @@ fn knowledge_cache_root(account: &str) -> Option<PathBuf> {
 
 /// Compute the absolute on-disk path for a cached knowledge file.
 ///
-/// Refuses to resolve paths that contain [`..`, absolute paths, Windows-style backslashe] and returns `None`.
+/// Refuses to resolve paths that contain `..`, absolute paths (leading `/`), or Windows-style backslashes and returns `None`.
 pub fn cached_path(account: &str, rel_path: &str) -> Option<PathBuf> {
-    if rel_path.is_empty() || rel_path.contains("..") || rel_path.contains('\\') {
+    if rel_path.is_empty() || rel_path.starts_with('/') || rel_path.contains('\\') {
         return None;
     }
-    let trimmed = rel_path.trim_start_matches('/');
+    let trimmed = rel_path;
     if trimmed.is_empty() {
         return None;
     }
```

---

### Incident Patch 7: `e3524084` (2026-06-04)
**Commit Message**: fix(knowledge) make normalize knowledge path platform independent

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `libs/api/src/stakpak/knowledge/mod.rs` (modified, +3/-3)
```diff
@@ -124,10 +124,10 @@ fn normalize_knowledge_path(path: &str) -> Result<String, KnowledgeApiError> {
         return Ok(String::new());
     }
 
-    let mut relative = PathBuf::new();
+    let mut parts: Vec<String> = Vec::new();
     for component in Path::new(path).components() {
         match component {
-            Component::Normal(part) => relative.push(part),
+            Component::Normal(part) => parts.push(part.to_string_lossy().into_owned()),
             Component::CurDir => {}
             Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                 return Err(KnowledgeApiError::BadRequest {
@@ -137,7 +137,7 @@ fn normalize_knowledge_path(path: &str) -> Result<String, KnowledgeApiError> {
         }
     }
 
-    Ok(relative.to_string_lossy().into_owned())
+    Ok(parts.join("/"))
 }
 
 impl StakpakApiClient {
```

---

### Incident Patch 8: `46bee272` (2026-06-04)
**Commit Message**: fix(knowledge) use try_current instead of current in block on operations in knowledge not to panic

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `libs/ak/src/store.rs` (modified, +4/-2)
```diff
@@ -487,9 +487,11 @@ impl RemoteBackend {
 
 impl StorageBackend for RemoteBackend {
     fn create(&self, path: &str, content: &[u8]) -> Result<(), Error> {
+        let handle = tokio::runtime::Handle::try_current().map_err(|_| {
+            Error::Parse("remote backend requires a running tokio runtime".to_string())
+        })?;
         tokio::task::block_in_place(|| {
-            tokio::runtime::Handle::current()
-                .block_on(async { self.client.create_knowledge_file(path, content).await })
+            handle.block_on(async { self.client.create_knowledge_file(path, content).await })
         })
         .map(|_| ())
         .map_err(|e| map_knowledge_err(path, e))
```

---

### Incident Patch 9: `caa1ec1c` (2026-06-04)
**Commit Message**: fix(knowledge) fix the remote-knowledge cache path

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `libs/api/src/stakpak/knowledge/mod.rs` (modified, +1/-1)
```diff
@@ -210,7 +210,7 @@ impl StakpakApiClient {
     }
 
     /// Read a knowledge file. Uses the on-disk cache at
-    /// `~/.stakpak/remote-cache/knowledge/<account>/<path>` together with the
+    /// `~/.stakpak/remote-knowledge/<account>/<path>` together with the
     /// server's `If-None-Match` support to avoid re-downloading unchanged
     /// content.
     pub async fn read_knowledge_file(&self, path: &str) -> Result<Vec<u8>, KnowledgeApiError> {
```

---

### Incident Patch 10: `65290550` (2026-06-03)
**Commit Message**: fixes

**File**: `cli/src/commands/autopilot/mod.rs` (modified, +98/-9)
```diff
@@ -570,6 +570,9 @@ fn default_enabled() -> bool {
     true
 }
 
+const MIN_SCHEDULE_MAX_TURNS: usize = 1;
+const MAX_SCHEDULE_MAX_TURNS: usize = 256;
+
 fn load_toml_root_table(path: &Path) -> Result<toml::value::Table, String> {
     if !path.exists() {
         return Ok(toml::value::Table::new());
@@ -2560,6 +2563,14 @@ fn resolve_schedule_notify_target(
     }
 }
 
+fn validate_schedule_max_turns(flag: &str, value: usize) -> Result<usize, String> {
+    if (MIN_SCHEDULE_MAX_TURNS..=MAX_SCHEDULE_MAX_TURNS).contains(&value) {
+        Ok(value)
+    } else {
+        Err(format!("{flag} must be 1-256, got {value}"))
+    }
+}
+
 fn resolve_schedule_max_turns(
     max_turns: Option<usize>,
     max_steps: Option<usize>,
@@ -2569,15 +2580,26 @@ fn resolve_schedule_max_turns(
             "Conflicting turn limit flags: --max-turns {} and deprecated --max-steps {}. Use only --max-turns.",
             turns, steps
         )),
-        (Some(turns), None) => Ok(Some(turns)),
+        (Some(turns), None) => validate_schedule_max_turns("--max-turns", turns).map(Some),
         (None, Some(steps)) => {
+            let steps = validate_schedule_max_turns("--max-steps", steps)?;
             eprintln!("Warning: --max-steps is deprecated; use --max-turns instead.");
             Ok(Some(steps))
         }
         (None, None) => Ok(None),
     }
 }
 
+fn schedule_has_notification_route(schedule: &AutopilotScheduleConfig) -> bool {
+    schedule
+        .notify_channel
+        .as_deref()
+        .is_some_and(|channel| !channel.trim().is_empty())
+        || schedule
+            .resolved_notify_target()
+            .is_some_and(|target| !target.trim().is_empty())
+}
+
 #[cfg(test)]
 fn add_schedule_in_config(
     config: &mut AutopilotConfigFile,
@@ -2680,6 +2702,10 @@ fn add_schedule_to_path(path: &Path, schedule: AutopilotScheduleConfig) -> Resul
     validate_schedule(&schedule)?;
 
     let mut root = load_toml_root_table(path)?;
+    if schedule_has_notification_route(&schedule) {
+        ensure_notification_gateway_config(&mut root);
+    }
+
     let schedules = schedule_array_mut(&mut root)?;
     if schedules
         .iter()
@@ -2887,6 +2913,17 @@ fn resolve_default_gateway_url(root: &toml::value::Table) -> String {
         .unwrap_or_else(|| "http://127.0.0.1:4096".to_string())
 }
 
+fn ensure_notification_gateway_config(root: &mut toml::value::Table) {
+    let default_gateway_url = resolve_default_gateway_url(root);
+    let notifications = ensure_toml_table(root, "notifications");
+    if !notifications.contains_key("gateway_url") {
+        notifications.insert(
+            "gateway_url".to_string(),
+            toml::Value::String(default_gateway_url),
+        );
+    }
+}
+
 fn apply_default_notification_target(
     root: &mut toml::value::Table,
     channel: &str,
@@ -2900,15 +2937,8 @@ fn apply_default_notification_target(
         return Err("Target cannot be empty".to_string());
     }
 
-    let default_gateway_url = resolve_default_gateway_url(root);
-
+    ensure_notification_gateway_config(root);
     let notifications = ensure_toml_table(root, "notifications");
-    if !notifications.contains_key("gateway_url") {
-        notifications.insert(
-            "gateway_url".to_string(),
-            toml::Value::String(default_gateway_url),
-        );
-    }
     notifications.insert(
         "channel".to_string(),
         toml::Value::String(channel.trim().to_string()),
@@ -4935,6 +4965,46 @@ target = "#default"
         let _ = std::fs::remove_file(path);
     }
 
+    #[test]
+    fn schedule_add_to_path_creates_notification_gateway_for_schedule_route() {
+        let path = temp_file_path("autopilot-schedule-add-route-gateway");
+        std::fs::write(
+            &path,
+            r##"
+[server]
+listen = "127.0.0.1:4097"
+"##,
+        )
+        .expect("write config");
+
+        let mut schedule = sample_schedule("slack-alert");
+        schedule.notify_channel = Some("slack".to_
```

**File**: `cli/tests/ak_cli.rs` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ use std::process::Command;
 
 const RETROSPECT_MARKDOWN: &str = include_str!("../../libs/ak/src/skills/retrospect.v1.md");
 
-const AUTOPILOT_ONE_LINER: &str = r#"stakpak autopilot schedule add --name retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#;
+const AUTOPILOT_ONE_LINER: &str = r#"stakpak autopilot schedule add retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#;
 
 #[test]
 fn ak_skill_retrospect_prints_bundled_prompt() {
```

**File**: `libs/ak/src/skills.rs` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ pub const SKILL_MAINTAIN: &str = include_str!("skills/maintain.v1.md");
 mod tests {
     use super::{SKILL_RETROSPECT, SKILL_USAGE};
 
-    const AUTOPILOT_ONE_LINER: &str = r#"stakpak autopilot schedule add --name retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#;
+    const AUTOPILOT_ONE_LINER: &str = r#"stakpak autopilot schedule add retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#;
 
     #[test]
     fn retrospect_skill_matches_bundled_markdown() {
@@ -26,7 +26,7 @@ mod tests {
         );
         assert!(
             SKILL_RETROSPECT.trim_end().ends_with(
-                r#"stakpak autopilot schedule add --name retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#
+                r#"stakpak autopilot schedule add retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#
             ),
             "SKILL_RETROSPECT appears to have been trimmed or mutated at its tail"
         );
```

**File**: `libs/ak/src/skills/retrospect.v1.md` (modified, +1/-1)
```diff
@@ -127,4 +127,4 @@ runs.
 
 Schedule this skill via the canonical one-liner:
 
-    stakpak autopilot schedule add --name retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)"
+    stakpak autopilot schedule add retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)"
```

#### Recent Merged Pull Requests:
- **PR #759** (2026-07-06): Update default API image for search service (@shehab299)
- **PR #758** (2026-07-04): Add third-party OSS attribution notices (@kajogo777)
- **PR #755** (2026-06-28): Add Stakpak, inc in License (@shehab299)
- **PR #752** (2026-06-10): fix(ak): specify version for stakpak-api dependency (@ahmedhesham6)
- **PR #751** (closed): Feat/ak sync (@shehab299)
- **PR #750** (2026-06-10): fix(mcp): artifact large tool outputs in proxy (@ahmedhesham6)
- **PR #749** (2026-06-04): feat(mcp): add aap as built-in remote MCP server (@kajogo777)
- **PR #746** (2026-06-04): Feat/remote knowledge (@shehab299)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
