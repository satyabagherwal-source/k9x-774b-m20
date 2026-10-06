# Forensic Learning Record (Deep Inspection): SilasMarvin/lsp-ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/silasmarvin-lsp-ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SilasMarvin/lsp-ai](https://github.com/SilasMarvin/lsp-ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:20:32.003Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SilasMarvin/lsp-ai`
- **Description**: LSP-AI is an open-source language server that serves as a backend for AI-powered functionality, designed to assist and empower software engineers, not replace them.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3207 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/lsp-ai/src/memory_worker.rs`
```
use std::sync::Arc;

use lsp_types::{
    DidChangeTextDocumentParams, DidOpenTextDocumentParams, Range, RenameFilesParams,
    TextDocumentIdentifier, TextDocumentPositionParams,
};
use serde_json::Value;
use tracing::error;

use crate::{
    memory_backends::{MemoryBackend, Prompt, PromptType},
    utils::TOKIO_RUNTIME,
};

#[derive(Debug)]
pub(crate) struct PromptRequest {
    position: TextDocumentPositionParams,
    prompt_type: PromptType,
    params: Value,
    tx: tokio::sync::oneshot::Sender<Prompt>,
}

impl PromptRequest {
    pub(crate) fn new(
        position: TextDocumentPositionParams,
        prompt_type: PromptType,
        params: Value,
        tx: tokio::sync::oneshot::Sender<Prompt>,
    ) -> Self {
        Self {
            position,
            prompt_type,
            params,
            tx,
        }
    }
}

#[derive(Debug)]
pub(crate) struct FilterRequest {
    position: TextDocumentPositionParams,
    tx: tokio::sync::oneshot::Sender<String>,
}

impl FilterRequest {
    pub(crate) fn new(
        position: TextDocumentPositionParams,
        tx: tokio::sync::oneshot::Sender<String>,
    ) -> Self {
        Self { position, tx }
    }
}

#[derive(Debug)]
pub(crate) struct CodeActionRequest {
    text_document_identifier: TextDocumentIdentifier,
    range: Range,
    trigger: String,
    tx: tokio::sync::oneshot::Sender<bool>,
}

impl CodeActionRequest {
    pub(crate) fn new(
        text_document_identifier: TextDocumentIdentifier,
        range: Range,
        trigger: String,
        tx: tokio::sync::oneshot::Sender<bool>,
    ) -> Self {
        Self {
            text_document_identifier,
            range,
            trigger,
            tx,
        }
    }
}

#[derive(Debug)]
pub(crate) struct FileRequest {
    text_document_identifier: TextDocumentIdentifier,
    tx: tokio::sync::oneshot::Sender<String>,
}

impl FileRequest {
    pub(crate) fn new(
        text_document_identifier: TextDocumentIdentifier,
        tx: tokio::sync::oneshot::Sender<String>,
    ) -> Self {
        Self {
            text_document_identifier,
            tx,
        }
    }
}

pub(crate) enum WorkerRequest {
    Shutdown,
    FilterText(FilterRequest),
    File(FileRequest),
    Prompt(PromptRequest),
    CodeActionRequest(CodeActionRequest),
    DidOpenTextDocument(DidOpenTextDocumentParams),
    DidChangeTextDocument(DidChangeTextDocumentParams),
    DidRenameFiles(RenameFilesParams),
}

async fn do_build_prompt(
    params: PromptRequest,
    memory_backend: Arc<Box<dyn MemoryBackend + Send + Sync>>,
) -> anyhow::Result<()> {
    let prompt = memory_backend
        .build_prompt(&params.position, params.prompt_type, &params.params)
        .await?;
    params
        .tx
        .send(prompt)
        .map_err(|_| anyhow::anyhow!("sending on channel failed"))
}

fn do_task(
    request: WorkerRequest,
    memory_backend: Arc<Box<dyn MemoryBackend + Send + Sync>>,
) -> anyhow::Result<()> {
    match request {
        WorkerRequest::FilterText(params) => {
            let filter_text = memory_backend.get_filter_text(&params.position)?;
            params
                .tx
                .send(filter_text)
                .map_err(|_| anyhow::anyhow!("sending on channel failed"))?;
        }
        WorkerRequest::Prompt(params) => {
            TOKIO_RUNTIME.spawn(async move {
                if let Err(e) = do_build_prompt(params, memory_backend).await {
                    error!("error in memory worker building prompt: {e}")
                }
            });
        }
        WorkerRequest::CodeActionRequest(params) => {
            let res = memory_backend.code_action_request(
                &params.text_document_identifier,
                &params.range,
                &params.trigger,
            )?;
            params
                .tx
                .send(res)
                .map_err(|_| anyhow::anyhow!("sending on channel failed"))?;
        }
        WorkerRequest::File(params) => {
            let res = memory_backend.file_request(&params.text_document_identifier)?;
            params
                .tx
                .send(res)
                .map_err(|_| anyhow::anyhow!("sending on channel failed"))?;
        }
        WorkerRequest::DidOpenTextDocument(params) => {
            memory_backend.opened_text_document(params)?;
        }
        WorkerRequest::DidChangeTextDocument(params) => {
            memory_backend.changed_text_document(params)?;
        }
        WorkerRequest::DidRenameFiles(params) => memory_backend.renamed_files(params)?,
        WorkerRequest::Shutdown => unreachable!(),
    }
    anyhow::Ok(())
}

fn do_run(
    memory_backend: Box<dyn MemoryBackend + Send + Sync>,
    rx: std::sync::mpsc::Receiver<WorkerRequest>,
) -> anyhow::Result<()> {
    let memory_backend = Arc::new(memory_backend);
    loop {
        let request = rx.recv()?;
        match &request {
            WorkerRequest::Shutdown => {
                return Ok(());
            }
            _ => {
                if let Err(e) = do_task(request, memory_backend.clone()) {
                    error!("error in memory worker task: {e}")
                }
            }
        }
    }
}

pub(crate) fn run(
    memory_backend: Box<dyn MemoryBackend + Send + Sync>,
    rx: std::sync::mpsc::Receiver<WorkerRequest>,
) {
    if let Err(e) = do_run(memory_backend, rx) {
        error!("error in memory worker: {e}")
    }
}

```

### Core Architecture Module: `crates/lsp-ai/src/transformer_worker.rs`
```
use anyhow::Context;
use lsp_server::{Connection, Message, RequestId, Response};
use lsp_types::{
    CodeAction, CodeActionParams, CompletionItem, CompletionItemKind, CompletionList,
    CompletionParams, CompletionResponse, Position, Range, TextDocumentIdentifier,
    TextDocumentPositionParams, TextEdit, WorkspaceEdit,
};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{mpsc::RecvTimeoutError, Arc},
    time::{Duration, SystemTime},
};
use tokio::sync::oneshot;
use tracing::{error, info, instrument};

use crate::config::{self, Config};
use crate::custom_requests::generation::{GenerateResult, GenerationParams};
use crate::custom_requests::generation_stream::GenerationStreamParams;
use crate::memory_backends::Prompt;
use crate::memory_worker::{self, FileRequest, FilterRequest, PromptRequest};
use crate::transformer_backends::TransformerBackend;
use crate::utils::{ToResponseError, TOKIO_RUNTIME};

static RE: Lazy<Mutex<HashMap<String, Regex>>> = Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Clone, Debug)]
pub(crate) struct CompletionRequest {
    id: RequestId,
    params: CompletionParams,
}

impl CompletionRequest {
    pub(crate) fn new(id: RequestId, params: CompletionParams) -> Self {
        Self { id, params }
    }
}

#[derive(Clone, Debug)]
pub(crate) struct GenerationRequest {
    id: RequestId,
    params: GenerationParams,
}

impl GenerationRequest {
    pub(crate) fn new(id: RequestId, params: GenerationParams) -> Self {
        Self { id, params }
    }
}

// The generate stream is not yet ready but we don't want to remove it
#[allow(dead_code)]
#[derive(Clone, Debug)]
pub(crate) struct GenerationStreamRequest {
    id: RequestId,
    params: GenerationStreamParams,
}

impl GenerationStreamRequest {
    pub(crate) fn new(id: RequestId, params: GenerationStreamParams) -> Self {
        Self { id, params }
    }
}

#[derive(Clone, Debug)]
pub(crate) struct CodeActionRequest {
    id: RequestId,
    params: CodeActionParams,
}

impl CodeActionRequest {
    pub(crate) fn new(id: RequestId, params: CodeActionParams) -> Self {
        Self { id, params }
    }
}

#[derive(Clone, Debug)]
pub(crate) struct CodeActionResolveRequest {
    id: RequestId,
    params: CodeAction,
}

impl CodeActionResolveRequest {
    pub(crate) fn new(id: RequestId, params: CodeAction) -> Self {
        Self { id, params }
    }
}

#[derive(Clone, Debug)]
pub(crate) enum WorkerRequest {
    Shutdown,
    Completion(CompletionRequest),
    Generation(GenerationRequest),
    GenerationStream(GenerationStreamRequest),
    CodeActionRequest(CodeActionRequest),
    CodeActionResolveRequest(CodeActionResolveRequest),
}

impl WorkerRequest {
    fn get_id(&self) -> RequestId {
        match self {
            WorkerRequest::Shutdown => unreachable!(),
            WorkerRequest::Completion(r) => r.id.clone(),
            WorkerRequest::Generation(r) => r.id.clone(),
            WorkerRequest::GenerationStream(r) => r.id.clone(),
            WorkerRequest::CodeActionRequest(r) => r.id.clone(),
            WorkerRequest::CodeActionResolveRequest(r) => r.id.clone(),
        }
    }
}

pub(crate) struct DoCompletionResponse {
    pub(crate) insert_text: String,
}

pub(crate) struct DoGenerationResponse {
    pub(crate) generated_text: String,
}

#[allow(dead_code)]
pub(crate) struct DoGenerationStreamResponse {
    pub(crate) generated_text: String,
}

fn post_process_start(response: String, front: &str) -> String {
    let response_chars: Vec<char> = response.chars().collect();
    let front_chars: Vec<char> = front.chars().collect();

    let mut front_match = response_chars.len();
    loop {
        if response_chars.is_empty() || front_chars.ends_with(&response_chars[..front_match]) {
            break;
        } else {
            front_match = front_match.saturating_sub(1);
        }
    }

    if front_match > 0 {
        response_chars[front_match..].iter().collect()
    } else {
        response
    }
}

fn post_process_end(response: String, back: &str) -> String {
    let response_chars: Vec<char> = response.chars().collect();
    let back_chars: Vec<char> = back.chars().collect();

    let mut back_match = 0;
    loop {
        if back_match == response_chars.len()
            || back_chars.starts_with(&response_chars[back_match..])
        {
            break;
        } else {
            back_match += 1;
        }
    }

    if back_match > 0 {
        response_chars[..back_match].iter().collect()
    } else {
        response
    }
}

// Some basic post processing that will clean up duplicate characters at the front and back
fn post_process_response(
    response: String,
    prompt: &Prompt,
    config: &config::PostProcess,
) -> String {
    match prompt {
        Prompt::ContextAndCode(context_and_code) => {
            // First we need to extract
            let response = if let Some(extractor) = &config.extractor {
                let mut re_map = RE.lock();
                let re = match re_map.get(extractor) {
                    Some(re) => re,
                    None => {
                        let re = Regex::new(extractor).unwrap();
                        re_map.insert(extractor.to_owned(), re);
                        re_map.get(extractor).unwrap()
                    }
                };
                let response = re
                    .captures(&response)
                    .and_then(|cap| cap.get(1))
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default();
                info!("response text after extracting:\n{}", response);
                response
            } else {
                response
            };
            if context_and_code.code.contains("<CURSOR>") {
                let mut split = context_and_code.code.split("<CURSOR>");
                let response = if config.remove_duplicate_start {
                    post_process_start(response, split.next().unwrap())
                } else {
                    response
                };
                if config.remove_duplicate_end {
                    post_process_end(response, split.next().unwrap())
                } else {
                    response
                }
            } else if config.remove_duplicate_start {
                post_process_start(response, &context_and_code.code)
            } else {
                response
            }
        }
        Prompt::FIM(fim) => {
            let response = if config.remove_duplicate_start {
                post_process_start(response, &fim.prompt)
            } else {
                response
            };
            if config.remove_duplicate_end {
                post_process_end(response, &fim.suffix)
            } else {
                response
            }
        }
    }
}

pub(crate) fn run(
    transformer_backends: HashMap<String, Box<dyn TransformerBackend + Send + Sync>>,
    memory_tx: std::sync::mpsc::Sender<memory_worker::WorkerRequest>,
    transformer_rx: std::sync::mpsc::Receiver<WorkerRequest>,
    connection: Arc<Connection>,
    config: Config,
) {
    if let Err(e) = do_run(
        transformer_backends,
        memory_tx,
        transformer_rx,
        connection,
        config,
    ) {
        error!("error in transformer worker: {e:?}")
    }
}

fn do_run(
    transformer_backends: HashMap<String, Box<dyn TransformerBackend + Send + Sync>>,
    memory_backend_tx: std::sync::mpsc::Sender<memory_worker::WorkerRequest>,
    transformer_rx: std::sync::mpsc::Receiver<WorkerRequest>,
    connection: Arc<Connection>,
    config: Config,
) -> anyhow::Result<()> {
    let transformer_backends = Arc::new(transformer_backends);

    // If this errors completion is disabled
    let max_requests_per_second = config.get_completion_transformer_max_requests_per_second();
    let mut last_completion_request_time = SystemTime::now();
    let mut last_completion_request = None;

    let run_dispatch_request = |request| {
        let task_connection = connection.clone();
        let task_transformer_backends = transformer_backends.clone();
        let task_memory_backend_tx = memory_backend_tx.clone();
        let task_config = config.clone();
        TOKIO_RUNTIME.spawn(async move {
            dispatch_request(
                request,
                task_connection,
                task_transformer_backends,
                task_memory_backend_tx,
                task_config,
            )
            .await;
        });
    };

    loop {
        // We want to rate limit completions without dropping the last rate limited request
        let request = transformer_rx.recv_timeout(Duration::from_millis(5));

        match request {
            Ok(request) => match &request {
                WorkerRequest::Shutdown => {
                    return Ok(());
                }
                WorkerRequest::Completion(completion_request) => {
                    if max_requests_per_second.is_ok() {
                        last_completion_request = Some(request);
                    } else {
                        // If completion is disabled return an empty response
                        let completion_list = CompletionList {
                            is_incomplete: false,
                            items: vec![],
                        };
                        let result = Some(CompletionResponse::List(completion_list));
                        let result = serde_json::to_value(result).unwrap();
                        if let Err(e) = connection.sender.send(Message::Response(Response {
                            id: completion_request.id.clone(),
                            result: Some(result),
                            error: None,
                        })) {
                            error!("sending empty response for completion request: {e:?}");
                        }
                    }
       
```

### Core Architecture Module: `crates/lsp-ai/src/utils.rs`
```
use std::path::PathBuf;

use anyhow::{anyhow, Context};
use lsp_server::ResponseError;
use once_cell::sync::Lazy;
use serde_json::Value;
use tokio::runtime;
use tree_sitter::Tree;

use crate::{config::ChatMessage, memory_backends::ContextAndCodePrompt, splitters::Chunk};

pub(crate) static TOKIO_RUNTIME: Lazy<runtime::Runtime> = Lazy::new(|| {
    runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .enable_all()
        .build()
        .expect("Error building tokio runtime")
});

pub(crate) trait ToResponseError {
    fn to_response_error(&self, code: i32) -> ResponseError;
}

impl ToResponseError for anyhow::Error {
    fn to_response_error(&self, code: i32) -> ResponseError {
        ResponseError {
            code,
            message: self.to_string(),
            data: None,
        }
    }
}

pub(crate) fn tokens_to_estimated_characters(tokens: usize) -> usize {
    tokens * 4
}

pub(crate) fn format_chat_messages(
    messages: &[ChatMessage],
    prompt: &ContextAndCodePrompt,
) -> Vec<ChatMessage> {
    messages
        .iter()
        .map(|m| ChatMessage::new(m.role.to_owned(), format_prompt_in_str(&m.content, &prompt)))
        .collect()
}

pub(crate) fn format_prompt_in_str(s: &str, prompt: &ContextAndCodePrompt) -> String {
    s.replace("{CONTEXT}", &prompt.context)
        .replace("{CODE}", &prompt.code)
        .replace(
            "{SELECTED_TEXT}",
            prompt
                .selected_text
                .as_ref()
                .map(|x| x.as_str())
                .unwrap_or_default(),
        )
}

pub(crate) fn format_prompt(prompt: &ContextAndCodePrompt) -> String {
    format!("{}\n\n{}", &prompt.context, &prompt.code)
}

pub(crate) fn chunk_to_id(uri: &str, chunk: &Chunk) -> String {
    format!("{uri}#{}-{}", chunk.range.start_byte, chunk.range.end_byte)
}

pub(crate) fn parse_tree(
    uri: &str,
    contents: &str,
    old_tree: Option<&Tree>,
) -> anyhow::Result<Tree> {
    let path = std::path::Path::new(uri);
    let extension = path.extension().map(|x| x.to_string_lossy());
    let extension = extension.as_deref().unwrap_or("");
    let mut parser = utils_tree_sitter::get_parser_for_extension(extension)?;
    parser
        .parse(contents, old_tree)
        .with_context(|| format!("parsing tree failed for {uri}"))
}

pub(crate) fn format_file_chunk(uri: &str, excerpt: &str, root_uri: Option<&str>) -> String {
    let path = match root_uri {
        Some(root_uri) => {
            if uri.starts_with(root_uri) {
                &uri[root_uri.chars().count()..]
            } else {
                uri
            }
        }
        None => uri,
    };
    format!(
        r#"--{path}--
{excerpt}"#,
    )
}

pub(crate) fn validate_file_exists(path: &str) -> anyhow::Result<PathBuf> {
    let path = PathBuf::from(path);
    if path.is_file() {
        Ok(path)
    } else {
        Err(anyhow!("File doesn't exist: {}", path.display()))
    }
}

pub(crate) fn merge_json(a: &mut Value, b: &Value) {
    match (a, b) {
        (&mut Value::Object(ref mut a), &Value::Object(ref b)) => {
            for (k, v) in b {
                merge_json(a.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
        (&mut Value::Array(ref mut a), &Value::Array(ref b)) => {
            a.extend(b.clone());
        }
        (a, b) => {
            *a = b.clone();
        }
    }
}

```

### Core Architecture Module: `crates/utils-tree-sitter/src/lib.rs`
```
use thiserror::Error;
use tree_sitter::{LanguageError, Parser};

#[derive(Error, Debug)]
pub enum GetParserError {
    #[error("no parser found for extension")]
    NoParserFoundForExtension(String),
    #[error("no parser found for extension")]
    NoLanguageFoundForExtension(String),
    #[error("loading grammer")]
    LoadingGrammer(#[from] LanguageError),
}

fn get_extension_for_language(extension: &str) -> Result<String, GetParserError> {
    Ok(match extension {
        "py" => "Python",
        "rs" => "Rust",
        // "zig" => "Zig",
        "sh" => "Bash",
        "c" => "C",
        "cpp" => "C++",
        "cs" => "C#",
        "css" => "CSS",
        "ex" => "Elixir",
        "erl" => "Erlang",
        "go" => "Go",
        "html" => "HTML",
        "java" => "Java",
        "js" => "JavaScript",
        "json" => "JSON",
        "hs" => "Haskell",
        "lua" => "Lua",
        "ml" => "OCaml",
        _ => {
            return Err(GetParserError::NoLanguageFoundForExtension(
                extension.to_string(),
            ))
        }
    }
    .to_string())
}

pub fn get_parser_for_extension(extension: &str) -> Result<Parser, GetParserError> {
    let language = get_extension_for_language(extension)?;
    let mut parser = Parser::new();
    match language.as_str() {
        #[cfg(any(feature = "all", feature = "python"))]
        "Python" => parser.set_language(&tree_sitter_python::language())?,
        #[cfg(any(feature = "all", feature = "rust"))]
        "Rust" => parser.set_language(&tree_sitter_rust::language())?,
        // #[cfg(any(feature = "all", feature = "zig"))]
        // "Zig" => parser.set_language(&tree_sitter_zig::language())?,
        #[cfg(any(feature = "all", feature = "bash"))]
        "Bash" => parser.set_language(&tree_sitter_bash::language())?,
        #[cfg(any(feature = "all", feature = "c"))]
        "C" => parser.set_language(&tree_sitter_c::language())?,
        #[cfg(any(feature = "all", feature = "cpp"))]
        "C++" => parser.set_language(&tree_sitter_cpp::language())?,
        #[cfg(any(feature = "all", feature = "csharp"))]
        "C#" => parser.set_language(&tree_sitter_c_sharp::language())?,
        #[cfg(any(feature = "all", feature = "css"))]
        "CSS" => parser.set_language(&tree_sitter_css::language())?,
        #[cfg(any(feature = "all", feature = "elixir"))]
        "Elixir" => parser.set_language(&tree_sitter_elixir::language())?,
        #[cfg(any(feature = "all", feature = "erlang"))]
        "Erlang" => parser.set_language(&tree_sitter_erlang::language())?,
        #[cfg(any(feature = "all", feature = "go"))]
        "Go" => parser.set_language(&tree_sitter_go::language())?,
        #[cfg(any(feature = "all", feature = "html"))]
        "HTML" => parser.set_language(&tree_sitter_html::language())?,
        #[cfg(any(feature = "all", feature = "java"))]
        "Java" => parser.set_language(&tree_sitter_java::language())?,
        #[cfg(any(feature = "all", feature = "javascript"))]
        "JavaScript" => parser.set_language(&tree_sitter_javascript::language())?,
        #[cfg(any(feature = "all", feature = "json"))]
        "JSON" => parser.set_language(&tree_sitter_json::language())?,
        #[cfg(any(feature = "all", feature = "haskell"))]
        "Haskell" => parser.set_language(&tree_sitter_haskell::language())?,
        #[cfg(any(feature = "all", feature = "lua"))]
        "Lua" => parser.set_language(&tree_sitter_lua::language())?,
        #[cfg(any(feature = "all", feature = "ocaml"))]
        "OCaml" => parser.set_language(&tree_sitter_ocaml::language_ocaml())?,
        _ => {
            return Err(GetParserError::NoParserFoundForExtension(
                language.to_string(),
            ))
        }
    }
    Ok(parser)
}

```

### Core Architecture Module: `crates/lsp-ai/src/config.rs`
```
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

pub(crate) type Kwargs = HashMap<String, Value>;

const fn max_requests_per_second_default() -> f32 {
    1.
}

const fn true_default() -> bool {
    true
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(crate) struct PostProcess {
    pub(crate) extractor: Option<String>,
    #[serde(default = "true_default")]
    pub(crate) remove_duplicate_start: bool,
    #[serde(default = "true_default")]
    pub(crate) remove_duplicate_end: bool,
}

impl Default for PostProcess {
    fn default() -> Self {
        Self {
            extractor: None,
            remove_duplicate_start: true,
            remove_duplicate_end: true,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub(crate) enum ValidSplitter {
    #[serde(rename = "tree_sitter")]
    TreeSitter(TreeSitter),
    #[serde(rename = "text_splitter")]
    TextSplitter(TextSplitter),
}

impl Default for ValidSplitter {
    fn default() -> Self {
        ValidSplitter::TreeSitter(TreeSitter::default())
    }
}

const fn chunk_size_default() -> usize {
    1500
}

const fn chunk_overlap_default() -> usize {
    0
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct TreeSitter {
    #[serde(default = "chunk_size_default")]
    pub(crate) chunk_size: usize,
    #[serde(default = "chunk_overlap_default")]
    pub(crate) chunk_overlap: usize,
}

impl Default for TreeSitter {
    fn default() -> Self {
        Self {
            chunk_size: 1500,
            chunk_overlap: 0,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct TextSplitter {
    #[serde(default = "chunk_size_default")]
    pub(crate) chunk_size: usize,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub(crate) struct EmbeddingPrefix {
    #[serde(default)]
    pub(crate) storage: String,
    #[serde(default)]
    pub(crate) retrieval: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct OllamaEmbeddingModel {
    // The generate endpoint, default: 'http://localhost:11434/api/embeddings'
    pub(crate) endpoint: Option<String>,
    // The model name
    pub(crate) model: String,
    // The prefix to apply to the embeddings
    #[serde(default)]
    pub(crate) prefix: EmbeddingPrefix,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub(crate) enum ValidEmbeddingModel {
    #[serde(rename = "ollama")]
    Ollama(OllamaEmbeddingModel),
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub(crate) enum VectorDataType {
    #[serde(rename = "f32")]
    F32,
    #[serde(rename = "binary")]
    Binary,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct VectorStore {
    pub(crate) crawl: Option<Crawl>,
    #[serde(default)]
    pub(crate) splitter: ValidSplitter,
    pub(crate) embedding_model: ValidEmbeddingModel,
    pub(crate) data_type: VectorDataType,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) enum ValidMemoryBackend {
    #[serde(rename = "file_store")]
    FileStore(FileStore),
    #[serde(rename = "vector_store")]
    VectorStore(VectorStore),
    #[serde(rename = "postgresml")]
    PostgresML(PostgresML),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub(crate) enum ValidModel {
    #[cfg(feature = "llama_cpp")]
    #[serde(rename = "llama_cpp")]
    LLaMACPP(LLaMACPP),
    #[serde(rename = "open_ai")]
    OpenAI(OpenAI),
    #[serde(rename = "anthropic")]
    Anthropic(Anthropic),
    #[serde(rename = "mistral_fim")]
    MistralFIM(MistralFIM),
    #[serde(rename = "ollama")]
    Ollama(Ollama),
    #[serde(rename = "gemini")]
    Gemini(Gemini),
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ChatMessage {
    pub(crate) role: String,
    pub(crate) content: String,
}

impl ChatMessage {
    pub(crate) fn new(role: String, content: String) -> Self {
        Self {
            role,
            content,
            // tool_calls: None,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[allow(clippy::upper_case_acronyms)]
#[serde(deny_unknown_fields)]
pub(crate) struct FIM {
    pub(crate) start: String,
    pub(crate) middle: String,
    pub(crate) end: String,
}

const fn max_crawl_memory_default() -> u64 {
    100_000_000
}

const fn max_crawl_file_size_default() -> u64 {
    10_000_000
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Crawl {
    #[serde(default = "max_crawl_file_size_default")]
    pub(crate) max_file_size: u64,
    #[serde(default = "max_crawl_memory_default")]
    pub(crate) max_crawl_memory: u64,
    #[serde(default)]
    pub(crate) all_files: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct PostgresMLEmbeddingModel {
    pub(crate) model: String,
    pub(crate) embed_parameters: Option<Value>,
    pub(crate) query_parameters: Option<Value>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct PostgresML {
    pub(crate) database_url: Option<String>,
    pub(crate) crawl: Option<Crawl>,
    #[serde(default)]
    pub(crate) splitter: ValidSplitter,
    pub(crate) embedding_model: Option<PostgresMLEmbeddingModel>,
}

#[derive(Clone, Debug, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub(crate) struct FileStore {
    pub(crate) crawl: Option<Crawl>,
}

impl FileStore {
    pub(crate) fn new_without_crawl() -> Self {
        Self { crawl: None }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Ollama {
    // The generate endpoint, default: 'http://localhost:11434/api/generate'
    pub(crate) generate_endpoint: Option<String>,
    // The chat endpoint, default: 'http://localhost:11434/api/chat'
    pub(crate) chat_endpoint: Option<String>,
    // The model name
    pub(crate) model: String,
    // The maximum requests per second
    #[serde(default = "max_requests_per_second_default")]
    pub(crate) max_requests_per_second: f32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct MistralFIM {
    // The auth token env var name
    pub(crate) auth_token_env_var_name: Option<String>,
    pub(crate) auth_token: Option<String>,
    // The fim endpoint
    pub(crate) fim_endpoint: Option<String>,
    // The model name
    pub(crate) model: String,
    // The maximum requests per second
    #[serde(default = "max_requests_per_second_default")]
    pub(crate) max_requests_per_second: f32,
}

#[cfg(feature = "llama_cpp")]
const fn n_gpu_layers_default() -> u32 {
    1000
}

#[cfg(feature = "llama_cpp")]
const fn n_ctx_default() -> u32 {
    1000
}

#[cfg(feature = "llama_cpp")]
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct LLaMACPP {
    // Which model to use
    pub(crate) repository: Option<String>,
    pub(crate) name: Option<String>,
    pub(crate) file_path: Option<String>,
    // The layers to put on the GPU
    #[serde(default = "n_gpu_layers_default")]
    pub(crate) n_gpu_layers: u32,
    // The context size
    #[serde(default = "n_ctx_default")]
    pub(crate) n_ctx: u32,
    // The maximum requests per second
    #[serde(default = "max_requests_per_second_default")]
    pub(crate) max_requests_per_second: f32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct OpenAI {
    // The auth token env var name
    pub(crate) auth_token_env_var_name: Option<String>,
    // The auth token
    pub(crate) auth_token: Option<String>,
    // The completions endpoint
    pub(crate) completions_endpoint: Option<String>,
    // The chat endpoint
    pub(crate) chat_endpoint: Option<String>,
    // The maximum requests per second
    #[serde(default = "max_requests_per_second_default")]
    pub(crate) max_requests_per_second: f32,
    // The model name
    pub(crate) model: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Gemini {
    // The auth token env var name
    pub(crate) auth_token_env_var_name: Option<String>,
    // The auth token
    pub(crate) auth_token: Option<String>,
    // The completions endpoint
    #[allow(dead_code)]
    pub(crate) completions_endpoint: Option<String>,
    // The chat endpoint
    pub(crate) chat_endpoint: Option<String>,
    // The maximum requests per second
    #[serde(default = "max_requests_per_second_default")]
    pub(crate) max_requests_per_second: f32,
    // The model name
    pub(crate) model: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Anthropic {
    // The auth token env var name
    pub(crate) auth_token_env_var_name: Option<String>,
    pub(crate) auth_token: Option<String>,
    // The completions endpoint
    #[allow(dead_code)]
    pub(crate) completions_endpoint: Option<String>,
    // The chat endpoint
    pub(crate) chat_endpoint: Option<String>,
    // The maximum requests per second
    #[serde(default = "max_requests_per_second_default")]
    pub(crate) max_requests_per_second: f32,
    // The model name
    pub(crate) model: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct Completion {
    // The model key to use
    pub(crate) model: String,
    // Args are deserialized by the backend using them
    #[serde(default)]
    pub(crate) parameters: Kwargs,
    // Parameters for post processing
    #[serde(default)]
    pub(crate) post_process: PostProcess,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct Chat {
    // The trigger text
    pub(crate) trigger: String,
    // The name to display in the editor
    pub(crate) action_display_name: String,
    // The model key to use
    pub(crate) model: String,
    // Args are deserialized by the backend using them
    #[serde(default)]
    pub(crate) parameters: Kwargs,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct Action {
    // The name to display in the editor
    pub(crate) action_display_name: String,
 
```

### Core Architecture Module: `crates/lsp-ai/src/crawl.rs`
```
use ignore::WalkBuilder;
use std::collections::HashSet;
use tracing::{error, instrument};

use crate::config::{self, Config};

pub(crate) struct Crawl {
    crawl_config: config::Crawl,
    config: Config,
    crawled_file_types: HashSet<String>,
    crawled_all: bool,
}

impl Crawl {
    pub(crate) fn new(crawl_config: config::Crawl, config: Config) -> Self {
        Self {
            crawl_config,
            config,
            crawled_file_types: HashSet::new(),
            crawled_all: false,
        }
    }

    #[instrument(skip(self, f))]
    pub(crate) fn maybe_do_crawl(
        &mut self,
        triggered_file: Option<String>,
        mut f: impl FnMut(&config::Crawl, &str) -> anyhow::Result<bool>,
    ) -> anyhow::Result<()> {
        if self.crawled_all {
            return Ok(());
        }

        if let Some(root_uri) = &self.config.client_params.root_uri {
            if !root_uri.starts_with("file://") {
                anyhow::bail!("Skipping crawling as root_uri does not begin with file://")
            }

            let extension_to_match = triggered_file
                .and_then(|tf| {
                    let path = std::path::Path::new(&tf);
                    path.extension().map(|f| f.to_str().map(|f| f.to_owned()))
                })
                .flatten();

            if let Some(extension_to_match) = &extension_to_match {
                if self.crawled_file_types.contains(extension_to_match) {
                    return Ok(());
                }
            }

            if !self.crawl_config.all_files && extension_to_match.is_none() {
                return Ok(());
            }

            for result in WalkBuilder::new(&root_uri[7..]).build() {
                let result = result?;
                let path = result.path();
                if !path.is_dir() {
                    if let Some(path_str) = path.to_str() {
                        if self.crawl_config.all_files {
                            match f(&self.crawl_config, path_str) {
                                Ok(c) => {
                                    if !c {
                                        break;
                                    }
                                }
                                Err(e) => error!("{e:?}"),
                            }
                        } else {
                            match (
                                path.extension().and_then(|pe| pe.to_str()),
                                &extension_to_match,
                            ) {
                                (Some(path_extension), Some(extension_to_match)) => {
                                    if path_extension == extension_to_match {
                                        match f(&self.crawl_config, path_str) {
                                            Ok(c) => {
                                                if !c {
                                                    break;
                                                }
                                            }
                                            Err(e) => error!("{e:?}"),
                                        }
                                    }
                                }
                                _ => continue,
                            }
                        }
                    }
                }
            }

            if let Some(extension_to_match) = extension_to_match {
                self.crawled_file_types.insert(extension_to_match);
            } else {
                self.crawled_all = true
            }
        }
        Ok(())
    }
}

```

### Core Architecture Module: `crates/lsp-ai/src/custom_requests/generation.rs`
```
use lsp_types::TextDocumentPositionParams;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::config;

pub(crate) enum Generation {}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GenerationParams {
    // This field was "mixed-in" from TextDocumentPositionParams
    #[serde(flatten)]
    pub(crate) text_document_position: TextDocumentPositionParams,
    // The model key to use
    pub(crate) model: String,
    #[serde(default)]
    // Args are deserialized by the backend using them
    pub(crate) parameters: Value,
    // Parameters for post processing
    #[serde(default)]
    pub(crate) post_process: config::PostProcess,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GenerateResult {
    pub(crate) generated_text: String,
}

impl lsp_types::request::Request for Generation {
    type Params = GenerationParams;
    type Result = GenerateResult;
    const METHOD: &'static str = "textDocument/generation";
}

```

### Core Architecture Module: `crates/lsp-ai/src/custom_requests/generation_stream.rs`
```
use lsp_types::{ProgressToken, TextDocumentPositionParams};
use serde::{Deserialize, Serialize};

pub(crate) enum GenerationStream {}

#[derive(Debug, PartialEq, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GenerationStreamParams {
    pub(crate) partial_result_token: ProgressToken,

    // This field was "mixed-in" from TextDocumentPositionParams
    #[serde(flatten)]
    pub(crate) text_document_position: TextDocumentPositionParams,
}

#[derive(Debug, PartialEq, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GenerationStreamResult {
    pub(crate) generated_text: String,
    pub(crate) partial_result_token: ProgressToken,
}

impl lsp_types::request::Request for GenerationStream {
    type Params = GenerationStreamParams;
    type Result = GenerationStreamResult;
    const METHOD: &'static str = "textDocument/generationStream";
}

```

### Core Architecture Module: `crates/lsp-ai/src/custom_requests/mod.rs`
```
pub(crate) mod generation;
pub(crate) mod generation_stream;

```

### Core Architecture Module: `crates/lsp-ai/src/embedding_models/mod.rs`
```
use crate::config::ValidEmbeddingModel;

mod ollama;

fn normalize(mut vector: Vec<f32>) -> Vec<f32> {
    let magnitude = (vector.iter().map(|&x| x * x).sum::<f32>()).sqrt();

    if magnitude != 0.0 {
        for element in &mut vector {
            *element /= magnitude;
        }
    }

    vector
}

#[derive(Clone, Copy)]
pub(crate) enum EmbeddingPurpose {
    Storage,
    Retrieval,
}

#[async_trait::async_trait]
pub(crate) trait EmbeddingModel {
    async fn embed(
        &self,
        batch: Vec<&str>,
        purpose: EmbeddingPurpose,
    ) -> anyhow::Result<Vec<Vec<f32>>>;
}

impl TryFrom<ValidEmbeddingModel> for Box<dyn EmbeddingModel + Send + Sync> {
    type Error = anyhow::Error;

    fn try_from(value: ValidEmbeddingModel) -> Result<Self, Self::Error> {
        match value {
            ValidEmbeddingModel::Ollama(config) => Ok(Box::new(ollama::Ollama::new(config))),
        }
    }
}

```

### Core Architecture Module: `crates/lsp-ai/src/embedding_models/ollama.rs`
```
use std::collections::HashMap;

use serde::Deserialize;
use serde_json::{json, Value};

use crate::config;

use super::{normalize, EmbeddingModel, EmbeddingPurpose};

#[derive(Deserialize)]
pub(crate) struct Embed {
    embedding: Vec<f32>,
}

#[derive(Deserialize)]
pub(crate) struct EmbedError {
    error: Value,
}

#[derive(Deserialize)]
#[serde(untagged)]
pub(crate) enum EmbedResponse {
    Success(Embed),
    Error(EmbedError),
    Other(HashMap<String, Value>),
}

pub(crate) struct Ollama {
    config: config::OllamaEmbeddingModel,
}

impl Ollama {
    pub(crate) fn new(config: config::OllamaEmbeddingModel) -> Self {
        Self { config }
    }
}

#[async_trait::async_trait]
impl EmbeddingModel for Ollama {
    async fn embed(
        &self,
        batch: Vec<&str>,
        purpose: EmbeddingPurpose,
    ) -> anyhow::Result<Vec<Vec<f32>>> {
        let mut results = vec![];
        let prefix = match purpose {
            EmbeddingPurpose::Storage => &self.config.prefix.storage,
            EmbeddingPurpose::Retrieval => &self.config.prefix.retrieval,
        };
        let client = reqwest::Client::new();
        for item in batch {
            let prompt = format!("{prefix}{item}");
            let res: EmbedResponse = client
                .post(
                    self.config
                        .endpoint
                        .as_deref()
                        .unwrap_or("http://localhost:11434/api/embeddings"),
                )
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .json(&json!({
                    "model": self.config.model,
                    "prompt": prompt
                }))
                .send()
                .await?
                .json()
                .await?;
            match res {
                EmbedResponse::Success(embedding) => results.push(normalize(embedding.embedding)),
                EmbedResponse::Error(error) => anyhow::bail!("{:?}", error.error.to_string()),
                EmbedResponse::Other(other) => {
                    anyhow::bail!("Unknown error while making request to Ollama: {:?}", other)
                }
            }
        }
        Ok(results)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[tokio::test]
    async fn ollama_embeding() -> anyhow::Result<()> {
        let configuration: config::OllamaEmbeddingModel = serde_json::from_value(json!({
            "model": "nomic-embed-text",
            "prefix": {
                "retrieval": "search_query",
                "storage": "search_document"
            }
        }))?;

        let ollama = Ollama::new(configuration);
        let results = ollama
            .embed(
                vec!["Hello world!", "How are you?"],
                EmbeddingPurpose::Retrieval,
            )
            .await?;
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].len(), 768);

        Ok(())
    }
}

```

### Core Architecture Module: `crates/lsp-ai/src/main.rs`
```
use anyhow::Result;
use clap::Parser;
use directories::BaseDirs;
use lsp_server::{Connection, ExtractError, Message, Notification, Request, RequestId};
use lsp_types::{
    request::{CodeActionRequest, CodeActionResolveRequest, Completion, Shutdown},
    CodeActionOptions, CompletionOptions, DidChangeTextDocumentParams, DidOpenTextDocumentParams,
    RenameFilesParams, ServerCapabilities, TextDocumentSyncKind,
};
use std::sync::Mutex;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{mpsc, Arc},
    thread,
};
use tracing::{error, info};
use tracing_subscriber::{EnvFilter, FmtSubscriber};

mod config;
mod crawl;
mod custom_requests;
mod embedding_models;
mod memory_backends;
mod memory_worker;
mod splitters;
#[cfg(feature = "llama_cpp")]
mod template;
mod transformer_backends;
mod transformer_worker;
mod utils;

use config::Config;
use custom_requests::generation::Generation;
use memory_backends::MemoryBackend;
use transformer_backends::TransformerBackend;
use transformer_worker::{CompletionRequest, GenerationRequest, WorkerRequest};

use crate::{
    custom_requests::generation_stream::GenerationStream,
    transformer_worker::GenerationStreamRequest,
};

fn notification_is<N: lsp_types::notification::Notification>(notification: &Notification) -> bool {
    notification.method == N::METHOD
}

fn request_is<R: lsp_types::request::Request>(request: &Request) -> bool {
    request.method == R::METHOD
}

fn cast<R>(req: Request) -> Result<(RequestId, R::Params), ExtractError<Request>>
where
    R: lsp_types::request::Request,
    R::Params: serde::de::DeserializeOwned,
{
    req.extract(R::METHOD)
}

// LSP-AI parameters
#[derive(Parser)]
#[command(version)]
struct Args {
    // Whether to use a custom log file
    #[arg(long, default_value_t = false)]
    use_seperate_log_file: bool,
    // A dummy argument for now
    #[arg(long, default_value_t = true)]
    stdio: bool,
    // JSON configuration file location
    #[arg(long, value_parser = utils::validate_file_exists, required = false)]
    config: Option<PathBuf>,
}

fn create_log_file(base_path: &Path) -> anyhow::Result<fs::File> {
    let dir_path = base_path.join("lsp-ai");
    fs::create_dir_all(&dir_path)?;
    let file_path = dir_path.join("lsp-ai.log");
    Ok(fs::File::create(file_path)?)
}

// Builds a tracing subscriber from the `LSP_AI_LOG` environment variable
// If the variables value is malformed or missing, sets the default log level to ERROR
fn init_logger(args: &Args) {
    let builder = FmtSubscriber::builder().with_env_filter(EnvFilter::from_env("LSP_AI_LOG"));
    let base_dirs = BaseDirs::new();

    if args.use_seperate_log_file && base_dirs.is_some() {
        let base_dirs = base_dirs.unwrap();
        let cache_dir = base_dirs.cache_dir();
        // Linux:   /home/alice/.cache
        // Windows: C:\Users\Alice\AppData\Local
        // macOS:   /Users/Alice/Library/Caches
        match create_log_file(&cache_dir) {
            Ok(log_file) => builder.with_writer(Mutex::new(log_file)).init(),
            Err(e) => {
                eprintln!("creating log file: {e:?} - falling back to stderr");
                builder
                    .with_writer(std::io::stderr)
                    .without_time()
                    .with_ansi(false)
                    .init()
            }
        }
    } else {
        builder
            .with_writer(std::io::stderr)
            .without_time()
            .with_ansi(false)
            .init()
    }
}

fn load_config(args: &Args, init_args: serde_json::Value) -> anyhow::Result<serde_json::Value> {
    if let Some(config_path) = &args.config {
        let config_data = fs::read_to_string(config_path)?;
        let mut config = serde_json::from_str(&config_data)?;
        utils::merge_json(&mut config, &init_args);
        Ok(config)
    } else {
        Ok(init_args)
    }
}

fn main() -> Result<()> {
    let args = Args::parse();
    init_logger(&args);
    info!("lsp-ai logger initialized starting server");

    let (connection, io_threads) = Connection::stdio();
    let server_capabilities = serde_json::to_value(ServerCapabilities {
        completion_provider: Some(CompletionOptions::default()),
        text_document_sync: Some(lsp_types::TextDocumentSyncCapability::Kind(
            TextDocumentSyncKind::INCREMENTAL,
        )),
        code_action_provider: Some(lsp_types::CodeActionProviderCapability::Options(
            CodeActionOptions {
                resolve_provider: Some(true),
                ..Default::default()
            },
        )),
        ..Default::default()
    })?;
    let initialization_args = connection.initialize(server_capabilities)?;

    if let Err(e) = main_loop(connection, load_config(&args, initialization_args)?) {
        error!("{e:?}");
    }

    io_threads.join()?;
    Ok(())
}

fn main_loop(connection: Connection, args: serde_json::Value) -> Result<()> {
    // Build our configuration
    let config = Config::new(args)?;

    // Wrap the connection for sharing between threads
    let connection = Arc::new(connection);

    // Our channel we use to communicate with our transformer worker
    let (transformer_tx, transformer_rx) = mpsc::channel();

    // The channel we use to communicate with our memory worker
    let (memory_tx, memory_rx) = mpsc::channel();

    // Setup the transformer worker
    let memory_backend: Box<dyn MemoryBackend + Send + Sync> = config.clone().try_into()?;
    let memory_worker_thread = thread::spawn(move || memory_worker::run(memory_backend, memory_rx));

    // Setup our transformer worker
    let transformer_backends: HashMap<String, Box<dyn TransformerBackend + Send + Sync>> = config
        .config
        .models
        .clone()
        .into_iter()
        .map(|(key, value)| Ok((key, value.try_into()?)))
        .collect::<anyhow::Result<HashMap<String, Box<dyn TransformerBackend + Send + Sync>>>>()?;
    let thread_connection = connection.clone();
    let thread_memory_tx = memory_tx.clone();
    let thread_config = config.clone();
    let transformer_worker_thread = thread::spawn(move || {
        transformer_worker::run(
            transformer_backends,
            thread_memory_tx,
            transformer_rx,
            thread_connection,
            thread_config,
        )
    });

    for msg in &connection.receiver {
        match msg {
            Message::Request(req) => {
                if request_is::<Shutdown>(&req) {
                    memory_tx.send(memory_worker::WorkerRequest::Shutdown)?;
                    if let Err(e) = memory_worker_thread.join() {
                        std::panic::resume_unwind(e)
                    }
                    transformer_tx.send(WorkerRequest::Shutdown)?;
                    if let Err(e) = transformer_worker_thread.join() {
                        std::panic::resume_unwind(e)
                    }
                    connection.handle_shutdown(&req)?;
                    return Ok(());
                } else if request_is::<Completion>(&req) {
                    match cast::<Completion>(req) {
                        Ok((id, params)) => {
                            let completion_request = CompletionRequest::new(id, params);
                            transformer_tx.send(WorkerRequest::Completion(completion_request))?;
                        }
                        Err(err) => error!("{err:?}"),
                    }
                } else if request_is::<Generation>(&req) {
                    match cast::<Generation>(req) {
                        Ok((id, params)) => {
                            let generation_request = GenerationRequest::new(id, params);
                            transformer_tx.send(WorkerRequest::Generation(generation_request))?;
                        }
                        Err(err) => error!("{err:?}"),
                    }
                } else if request_is::<GenerationStream>(&req) {
                    match cast::<GenerationStream>(req) {
                        Ok((id, params)) => {
                            let generation_stream_request =
                                GenerationStreamRequest::new(id, params);
                            transformer_tx
                                .send(WorkerRequest::GenerationStream(generation_stream_request))?;
                        }
                        Err(err) => error!("{err:?}"),
                    }
                } else if request_is::<CodeActionRequest>(&req) {
                    match cast::<CodeActionRequest>(req) {
                        Ok((id, params)) => {
                            let code_action_request =
                                transformer_worker::CodeActionRequest::new(id, params);
                            transformer_tx
                                .send(WorkerRequest::CodeActionRequest(code_action_request))?;
                        }
                        Err(err) => error!("{err:?}"),
                    }
                } else if request_is::<CodeActionResolveRequest>(&req) {
                    match cast::<CodeActionResolveRequest>(req) {
                        Ok((id, params)) => {
                            let code_action_request =
                                transformer_worker::CodeActionResolveRequest::new(id, params);
                            transformer_tx.send(WorkerRequest::CodeActionResolveRequest(
                                code_action_request,
                            ))?;
                        }
                        Err(err) => error!("{err:?}"),
                    }
                } else {
                    error!("Unsupported command - see the wiki for a list of supported commands: {req:?}")
                }
            }
            Message::Notification(not) => {
                if notification_is::<lsp_types::notification::DidOpenTextDocument>(&not) {
                    let params: DidOpenTextDocumentParams = serde_json::from_value(not.
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #56** (2024-08-13): **crash on helix**
  *Symptoms*: Hello,  Thank you for your initiative. I've tried to configure helix as mentioned in the examples directory with :   ```toml [language-server.lsp-ai.config.models.model1]   type = "llama_cpp"   repository = "stabilityai/stable-code-3b"   name = "stable-code-3b-Q5_K_M.gguf"   n_ctx = 2048  [language-server.lsp-ai.config.completion]   model = "model1"  [language-server.lsp-ai.config.completion.parameters]   max_tokens = 32   max_context = 1024  [language-server.lsp-ai.config.completion.parameters.fim]   start = "<fim_prefix>"   middle = "<fim_suffix>"   end = "<fim_middle>"  ```  When I try to use it, I get the following error:   ``` 2024-08-08T19:46:48.116 helix_lsp::transport [ERROR] Exiting lsp-ai after unexpected error: Parse(Error("data did not match any variant of untagged enum ServerMessage", line: 0, column: 0)) 2024-08-08T19:46:50.389 helix_lsp::transport [ERROR] lsp-ai err <- "ERROR lsp_ai::transformer_worker: sending response: \"SendError(..)\"\n" ```  Any idea ?
  **Post-Mortem & Fix Analysis**:
  > Oh that is interesting. I don't know if I have seen that error before.    Try enabling logging as seen in the wiki here: https://github.com/SilasMarvin/lsp-ai/wiki/Debugging ``` export LSP_AI_LOG=DEBUG ```  Before opening Helix, can you clear the log file: ``` rm ~/.cache/helix/helix.log ```  After opening it can you share the log file here.   Thanks!
  > Hi @SilasMarvin ,   Sorry for delayed response, after set log in DEBUG, it seems worked now on the same project (which have a little bit evolved since my last try). Very strange.  I'll keep you posted if I succeed to reproduce.
  > Glad to hear its working. I'm going to close this but feel free to submit a new issue if something goes wrong. You can also jump into the Discord if you have questions.

- **Issue #50** (2024-08-08): **Panic when seeing unicode**
  *Symptoms*: lsp-ai seems to panic when there is unicode in the source code.   ``` thread 'tokio-runtime-worker' panicked at /home/user/.cargo/registry/src/index.crates.io-6f17d22bba15001f/lsp-ai-0.4.0/src/transformer_worker.rs:122:60: byte index 25 is not a char boundary; it is inside 'μ' (bytes 24..26) of `plt.xlabel('Wavelength (μm)')` ``` ## Version: lsp-ai v0.4.0 Opensuse Linux 6.10.2-1-default rustc 1.79.0  ## Config:  ```json "initializationOptions": {     "models": {         "model1": {             "type": "open_ai",             "chat_endpoint": "https://api.groq.com/openai/v1/chat/completions",             "model": "llama3-70b-8192",             "auth_token": "<HIDDEN>"         }     },      "completion": {         "model": "model1",         "parameters": {             "max_context": 2048,             "max_tokens": 128,              "messages": [{                "role": "system",                "content": "You are a programming completion tool. Replace <CURSOR> with the correct code."             },{                 "role": "user",                 "content": "{CODE}"             }]         }     },      "memory": {         "file_store": {}     } } ```
  **Post-Mortem & Fix Analysis**:
  > ``` stack backtrace:    0:     0x55c5f6c09e70 - ::fmt::h708de712029cb15f    1:     0x55c5f6c4210b - core::fmt::write::h1c4353b51cccb3ea    2:     0x55c5f6c2daf9 - std::io::Write::write_fmt::hcc8780934fe9031f    3:     0x55c5f6c09c2e - std::sys_common::backtrace::print::hc2ff0f9eb8716380    4:     0x55c5f6c1b6fa - std::panicking::default_hook::{{closure}}::h2608c1692f29128d    5:     0x55c5f6c1b3e9 - std::panicking::default_hook::hb19e8d974208f968    6:     0x55c5f6c1bb89 - std::panicking::rust_panic_with_hook::hed421d2c4566430f    7:     0x55c5f6c0a244 - std::panicking::begin_panic_handler::{{closure}}::h02e89190bc8024e5    8:     0x55c5f6c0a089 - std::sys_common::backtrace::__rust_end_short_backtrace::h2501369998c7775f    9:     0x55c5f6c1b887 - rust_begin_unwind   10:     0x55c5f5f0c573 - core::panicking::panic_fmt::h02e8faf7efcfa656   11:     0x55c5f6c47a1a - core::str::slice_error_fail_rt::hcbad84ada2c98528   12:     0x55c5f5f0c99a - core::str::slice_error_fail::hca52
  > I'll look into this thank you!
  > Closed with: https://github.com/SilasMarvin/lsp-ai/commit/e3b7aa8186d8bcb7c6f6feaf6c24d9fef7ea0947

- **Issue #44** (2024-08-17): **Pull Ollama Models**
  *Symptoms*: When running Ollama models we need to pull them first in case the user hasn't already or they will get an error saying they need to pull.
  **Post-Mortem & Fix Analysis**:
  > This is actually a bad idea as that assumes they are running locally. I think this is something they should handle themselves

- **Issue #40** (2024-07-20): **bug: lsp_ai::transformer_worker: generating response: specify `completions_endpoint` to use completions. Wanted to use `chat` instead?**
  *Symptoms*: My Os is MacOS, M2.   The config of vscode is: ``` {   "lsp-ai.serverConfiguration": {     "memory": {       "file_store": {}     },     "models": {       "model1": {         "type": "open_ai",         "chat_endpoint": "https://api.openai.com/v1/chat/completions",         "model": "gpt-4o",         "auth_token": "sk-codefB2"       }     }   },   "lsp-ai.generationConfiguration": {     "model": "model1",     "parameters": {       "max_tokens": 128,       "max_context": 1024,       "messages": [         {           "role": "system",           "content": "You are a programming completion tool. Replace <CURSOR> with the correct code."         },         {           "role": "user",           "content": "{CODE}"         }       ]     }   },   "lsp-ai.inlineCompletionConfiguration": {     "maxCompletionsPerSecond": 1   } }   ``` The error I got is:  ERROR lsp_ai::memory_worker: error in memory worker task: Error file not found ERROR dispatch_request{request=Generation(GenerationRequest { id: RequestId(I32(124)), params: GenerationParams { text_document_position: TextDocumentPositionParams { text_document: TextDocumentIdentifier { uri: Url { scheme: "file", cannot_be_a_base: false, username: "", password: None, host: None, port: None, path: "/Users/mme/repos/fib.py", query: None, fragment: None } }, position: Position { line: 1, character: 14 } }, model: "model1", parameters: Object {"max_context": Number(2048), "max_tokens": Number(128)},
  **Post-Mortem & Fix Analysis**:
  > You config looks ok. I'm not sure why you are getting that error. Does it happen every time? Is it random?   Its also worth double checking that you didn't post a real key here? If that is your auth token please remove it or someone may use it.  I was able to verify that the VS Code extension works with the latest version of LSP-AI. My entire VS Code config: ``` {   "workbench.colorTheme": "Gruvbox Dark Hard",   "vim.cursorStylePerMode.normal": "block",   "editor.quickSuggestions": {     "other": "inline"   },   "extensions.ignoreRecommendations": true,   "editor.quickSuggestionsDelay": 50,   "lsp-ai.serverConfiguration": {     "memory": {       "file_store": {}     },     "models": {       "model1": {         "type": "open_ai",         "chat_endpoint": "https://api.openai.com/v1/chat/completions",         "model": "gpt-4o",         "auth_token_env_var_name": "OPENAI_API_KEY"       }     }   },   "lsp-ai.generationConfiguration": {     "model": "model1",   
  > yeah, I found the cause. I have another extension which got the same functionality as lsp-ai. When I disabled it, it returned. So I close this issue.   But I got some insteresting and I would like to share. I opened a rust project then I create a python file in the same vscode. When I play the example code, I would expect fib function. But I got some unexpected rust code part of which definitely is from the rust project. BTW, the rust project is lsp-ai. You can find the result as the screenshot below:  ![Screenshot 2024-07-20 at 6 22 53 PM](https://github.com/user-attachments/assets/f3ffaa69-1b2b-4a0c-a0cb-bd44d265f100)  and this one: ![Screenshot 2024-07-20 at 6 38 29 PM](https://github.com/user-attachments/assets/87cc7d74-ac90-4dbe-9d6d-427f7d0e43b2)  The file is a python file. But when I just tell explicitly in the comment using python. Then the result is fine.   ![Screenshot 2024-07-20 at 6 40 49 PM](https://github.com/user-attachments/assets/c799c24b-1a79-4543-9068-a
  > The api key is fake though. Thanks for the remind.

- **Issue #33** (2024-08-08): **Issues with special characters, such as `π`**
  *Symptoms*: Hi, thanks for this awesome project! I've been using it successfully with an ollama instance hosted on a remote machine, and an anthropic api key.  I have many equations in my code, and the LLMs frequently try to use symbols such as π, Γ, or others. However, in these cases the `lsp-ai` program crashes, with stacktraces such as ``` thread 'tokio-runtime-worker' panicked at /home/romeo/.cargo/registry/src/index.crates.io-6f17d22bba15001f/lsp-ai-0.3.0/src/transformer_worker.rs:92:60: byte index 333 is not a char boundary; it is inside 'π' (bytes 332..334) of `Here's a Julia function to compute the integral over an ellipsoid:  ```julia # Computes the integral over an ellipsoid function ellipsoid_integral(a::Float64, b::Float64, c::Float64)     # a, b, c are the semi-axes of the ellipsoid          # The volume of`[...] note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace ```  Hope we can fix that, it's making it rather difficult for me to work, as the same problem happens when existing symbols from my files are parsed by the program.  
  **Post-Mortem & Fix Analysis**:
  > Glad you like it! Thanks for flagging this. I'll test this locally and get a fix for it in the next release!
  > Fixed with: https://github.com/SilasMarvin/lsp-ai/commit/e3b7aa8186d8bcb7c6f6feaf6c24d9fef7ea0947

- **Issue #16** (2024-06-13): **Support remote endpoint for Ollama?**
  *Symptoms*: Thanks for this project  ### Is there an existing issue for this?    I have searched the existing issues  ### Feature request    Support remote endpoint for Ollama  ### Context    ollama is not fast enough using onboard hardware if run on laptops locally, we can utilize exising cloud GPUs to speed it up  Possible implementation   I have provided a possible implementation at https://github.com/SilasMarvin/lsp-ai/pull/15
  **Post-Mortem & Fix Analysis**:
  > This is great! I added it yesterday and honestly didn't even think about a remote api. I added a few comments in the PR, but otherwise it looks really awesome!
  > resolved by #15 

- **Issue #4** (2024-06-11): **Using Anthropic API renders some issues**
  *Symptoms*: Thanks for this project, I'd love to use this with helix.  Doing some attempts I ran into two issues, the first I was able to track down.  ``` 2024-06-08T21:55:06.687 helix_lsp::transport [ERROR] lsp-ai <- InternalError: "{\"message\":\"messages.0.tool_calls: Extra inputs are not permitted\",\"type\":\"invalid_request_error\"}" ```  I made a fork and removed both references to tool_calls in config.rs; this fixed that issue. I'm no Rustacean, so not sure how to implement that nicely, but I hope it points you in some useful direction.  ---  The second issue I'm not sure how to tackle… I get results from the Anthropic-API, but they are cut off at (I believe…) about 155 tokens.  For example, if I enter  ```ts const monthNames = <CURSOR> ```  …it returns a (cut-off) list of monthNames.  The following, however, works fine.  ```ts const monthNamesAbbreviated = <CURSOR> ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for checking it out! I think we needed that tool call reference for Mistral FIM, I'm not 100% sure I will double check it tomorrow and get back to you here with a fix.  Can you share your config for Anthropic? You probably need to increase the `max_tokens` parameter.  It's also worth noting that these LLMs are not deterministic and do have some strange behaviour. We may also need to adjust the prompt you are using. 
  > Fixed the Anthropic tool errors, thank you for catching those! https://github.com/SilasMarvin/lsp-ai/pull/7
  > Ah, you're right about the max_tokens… I wasn't sure as I followed the recommended config. Could've tried though.  Anyway… it's now at 4096 and this fixes the aforementioned issue.

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

### Incident Patch 1: `f2a68f96` (2024-09-24)
**Commit Message**: Fix tag issue / bump version

**File**: `crates/lsp-ai/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "lsp-ai"
-version = "0.7.0"
+version = "0.7.1"
 
 description.workspace = true
 repository.workspace = true
```

---

### Incident Patch 2: `60c8e80f` (2024-08-17)
**Commit Message**: Custom actions, server shutdown fixes and a bunch of small things

**File**: `Cargo.lock` (modified, +3/-2)
```diff
@@ -1590,6 +1590,7 @@ dependencies = [
  "pgml",
  "rand",
  "rayon",
+ "regex",
  "reqwest",
  "ropey",
  "serde",
@@ -2265,9 +2266,9 @@ dependencies = [
 
 [[package]]
 name = "regex"
-version = "1.10.5"
+version = "1.10.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b91213439dad192326a0d7c6ee3955910425f441d7038e0d6933b0aec5c4517f"
+checksum = "4219d74c6b67a3654a9fbebc4b419e22126d13d2f3c4a07ee0cb61ff79a79619"
 dependencies = [
  "aho-corasick",
  "memchr",
```

**File**: `crates/lsp-ai/Cargo.toml` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ fxhash = "0.2.1"
 ordered-float = "4.2.1"
 futures = "0.3"
 clap = { version = "4.5.14", features = ["derive"] }
+regex = "1.10.6"
 
 [build-dependencies]
 cc="1"
```

**File**: `crates/lsp-ai/src/config.rs` (modified, +37/-5)
```diff
@@ -9,15 +9,23 @@ const fn max_requests_per_second_default() -> f32 {
     1.
 }
 
+const fn true_default() -> bool {
+    true
+}
+
 #[derive(Clone, Debug, Deserialize, Serialize)]
 pub struct PostProcess {
+    pub extractor: Option<String>,
+    #[serde(default = "true_default")]
     pub remove_duplicate_start: bool,
+    #[serde(default = "true_default")]
     pub remove_duplicate_end: bool,
 }
 
 impl Default for PostProcess {
     fn default() -> Self {
         Self {
+            extractor: None,
             remove_duplicate_start: true,
             remove_duplicate_end: true,
         }
@@ -353,13 +361,31 @@ pub struct Chat {
     pub(crate) parameters: Kwargs,
 }
 
+#[derive(Clone, Debug, Deserialize)]
+pub struct Action {
+    // The name to display in the editor
+    pub(crate) action_display_name: String,
+    // The model key to use
+    pub(crate) model: String,
+    // Args are deserialized by the backend using them
+    #[serde(default)]
+    pub(crate) parameters: Kwargs,
+    // Parameters for post processing
+    #[serde(default)]
+    pub(crate) post_process: PostProcess,
+}
+
 #[derive(Clone, Debug, Deserialize)]
 #[serde(deny_unknown_fields)]
 pub(crate) struct ValidConfig {
     pub(crate) memory: ValidMemoryBackend,
     pub(crate) models: HashMap<String, ValidModel>,
     pub(crate) completion: Option<Completion>,
-    pub(crate) chat: Option<Vec<Chat>>,
+    #[serde(default)]
+    pub(crate) actions: Vec<Action>,
+    #[serde(default)]
+    #[serde(alias = "chat")] // Legacy from when it was called chat, remove soon
+    pub(crate) chats: Vec<Chat>,
 }
 
 #[derive(Clone, Debug, Deserialize, Default)]
@@ -396,8 +422,12 @@ impl Config {
     // Helpers for the backends ///////////
     ///////////////////////////////////////
 
-    pub fn get_chat(&self) -> Option<&Vec<Chat>> {
-        self.config.chat.as_ref()
+    pub fn get_chats(&self) -> &Vec<Chat> {
+        &self.config.chats
+    }
+
+    pub fn get_actions(&self) -> &Vec<Action> {
+        &self.config.actions
     }
 
     pub fn is_completions_enabled(&self) -> bool {
@@ -446,7 +476,8 @@ impl Config {
                 memory: ValidMemoryBackend::FileStore(FileStore { crawl: None }),
                 models: HashMap::new(),
                 completion: None,
-                chat: None,
+                actions: vec![],
+                chats: vec![],
             },
             client_params: ValidClientParams { root_uri: None },
         }
@@ -458,7 +489,8 @@ impl Config {
                 memory: ValidMemoryBackend::VectorStore(vector_store),
                 models: HashMap::new(),
                 completion: None,
-                chat: None,
+                actions: vec![],
+                chats: vec![],
             },
             client_params: ValidClientParams { root_uri: None },
         }
```

**File**: `crates/lsp-ai/src/main.rs` (modified, +19/-8)
```diff
@@ -3,7 +3,7 @@ use clap::Parser;
 use directories::BaseDirs;
 use lsp_server::{Connection, ExtractError, Message, Notification, Request, RequestId};
 use lsp_types::{
-    request::{CodeActionRequest, CodeActionResolveRequest, Completion},
+    request::{CodeActionRequest, CodeActionResolveRequest, Completion, Shutdown},
     CodeActionOptions, CompletionOptions, DidChangeTextDocumentParams, DidOpenTextDocumentParams,
     RenameFilesParams, ServerCapabilities, TextDocumentSyncKind,
 };
@@ -127,7 +127,10 @@ fn main() -> Result<()> {
     })?;
     let initialization_args = connection.initialize(server_capabilities)?;
 
-    main_loop(connection, initialization_args)?;
+    if let Err(e) = main_loop(connection, initialization_args) {
+        error!("{e:?}");
+    }
+
     io_threads.join()?;
     Ok(())
 }
@@ -147,7 +150,7 @@ fn main_loop(connection: Connection, args: serde_json::Value) -> Result<()> {
 
     // Setup the transformer worker
     let memory_backend: Box<dyn MemoryBackend + Send + Sync> = config.clone().try_into()?;
-    thread::spawn(move || memory_worker::run(memory_backend, memory_rx));
+    let memory_worker_thread = thread::spawn(move || memory_worker::run(memory_backend, memory_rx));
 
     // Setup our transformer worker
     let transformer_backends: HashMap<String, Box<dyn TransformerBackend + Send + Sync>> = config
@@ -160,7 +163,7 @@ fn main_loop(connection: Connection, args: serde_json::Value) -> Result<()> {
     let thread_connection = connection.clone();
     let thread_memory_tx = memory_tx.clone();
     let thread_config = config.clone();
-    thread::spawn(move || {
+    let transformer_worker_thread = thread::spawn(move || {
         transformer_worker::run(
             transformer_backends,
             thread_memory_tx,
@@ -173,10 +176,18 @@ fn main_loop(connection: Connection, args: serde_json::Value) -> Result<()> {
     for msg in &connection.receiver {
         match msg {
             Message::Request(req) => {
-                if connection.handle_shutdown(&req)? {
+                if request_is::<Shutdown>(&req) {
+                    memory_tx.send(memory_worker::WorkerRequest::Shutdown)?;
+                    if let Err(e) = memory_worker_thread.join() {
+                        std::panic::resume_unwind(e)
+                    }
+                    transformer_tx.send(WorkerRequest::Shutdown)?;
+                    if let Err(e) = transformer_worker_thread.join() {
+                        std::panic::resume_unwind(e)
+                    }
+                    connection.handle_shutdown(&req)?;
                     return Ok(());
-                }
-                if request_is::<Completion>(&req) {
+                } else if request_is::<Completion>(&req) {
                     match cast::<Completion>(req) {
                         Ok((id, params)) => {
                             let completion_request = CompletionRequest::new(id, params);
@@ -224,7 +235,7 @@ fn main_loop(connection: Connection, args: serde_json::Value) -> Result<()> {
                         Err(err) => error!("{err:?}"),
                     }
                 } else {
-                    error!("Unsupported command - see the wiki for a list of supported commands")
+                    error!("Unsupported command - see the wiki for a list of supported commands: {req:?}")
                 }
             }
             Message::Notification(not) => {
```

**File**: `crates/lsp-ai/src/memory_backends/file_store.rs` (modified, +14/-11)
```diff
@@ -240,20 +240,22 @@ impl FileStore {
                     let rope_slice = rope
                         .get_slice(start..end + "<CURSOR>".chars().count())
                         .context("Error getting rope slice")?;
-                    Prompt::ContextAndCode(ContextAndCodePrompt::new(
-                        "".to_string(),
-                        rope_slice.to_string(),
-                    ))
+                    Prompt::ContextAndCode(ContextAndCodePrompt {
+                        context: "".to_string(),
+                        code: rope_slice.to_string(),
+                        selected_text: None,
+                    })
                 } else {
                     let start = cursor_index
                         .saturating_sub(tokens_to_estimated_characters(params.max_context));
                     let rope_slice = rope
                         .get_slice(start..cursor_index)
                         .context("Error getting rope slice")?;
-                    Prompt::ContextAndCode(ContextAndCodePrompt::new(
-                        "".to_string(),
-                        rope_slice.to_string(),
-                    ))
+                    Prompt::ContextAndCode(ContextAndCodePrompt {
+                        context: "".to_string(),
+                        code: rope_slice.to_string(),
+                        selected_text: None,
+                    })
                 }
             }
             PromptType::FIM => {
@@ -268,7 +270,10 @@ impl FileStore {
                 let suffix = rope
                     .get_slice(cursor_index..end)
                     .context("Error getting rope slice")?;
-                Prompt::FIM(FIMPrompt::new(prefix.to_string(), suffix.to_string()))
+                Prompt::FIM(FIMPrompt {
+                    prompt: prefix.to_string(),
+                    suffix: suffix.to_string(),
+                })
             }
         })
     }
@@ -837,8 +842,6 @@ mod tests {
 
     #[test]
     fn test_file_store_tree_sitter() -> anyhow::Result<()> {
-        crate::init_logger();
-
         let config = Config::default_with_file_store_without_models();
         let file_store_config = if let config::ValidMemoryBackend::FileStore(file_store_config) =
             config.config.memory.clone()
```

**File**: `crates/lsp-ai/src/memory_backends/mod.rs` (modified, +15/-27)
```diff
@@ -36,12 +36,7 @@ impl From<&Value> for MemoryRunParams {
 pub struct ContextAndCodePrompt {
     pub context: String,
     pub code: String,
-}
-
-impl ContextAndCodePrompt {
-    pub fn new(context: String, code: String) -> Self {
-        Self { context, code }
-    }
+    pub selected_text: Option<String>,
 }
 
 #[derive(Debug)]
@@ -50,15 +45,6 @@ pub struct FIMPrompt {
     pub suffix: String,
 }
 
-impl FIMPrompt {
-    pub fn new(prefix: String, suffix: String) -> Self {
-        Self {
-            prompt: prefix,
-            suffix,
-        }
-    }
-}
-
 #[derive(Debug)]
 pub enum Prompt {
     FIM(FIMPrompt),
@@ -159,23 +145,25 @@ impl TryFrom<Config> for Box<dyn MemoryBackend + Send + Sync> {
 #[cfg(test)]
 impl Prompt {
     pub fn default_with_cursor() -> Self {
-        Self::ContextAndCode(ContextAndCodePrompt::new(
-            r#"def test_context():\n    pass"#.to_string(),
-            r#"def test_code():\n    <CURSOR>"#.to_string(),
-        ))
+        Self::ContextAndCode(ContextAndCodePrompt {
+            context: r#"def test_context():\n    pass"#.to_string(),
+            code: r#"def test_code():\n    <CURSOR>"#.to_string(),
+            selected_text: None,
+        })
     }
 
     pub fn default_fim() -> Self {
-        Self::FIM(FIMPrompt::new(
-            r#"def test_context():\n    pass"#.to_string(),
-            r#"def test_code():\n    "#.to_string(),
-        ))
+        Self::FIM(FIMPrompt {
+            prompt: r#"def test_context():\n    pass"#.to_string(),
+            suffix: r#"def test_code():\n    "#.to_string(),
+        })
     }
 
     pub fn default_without_cursor() -> Self {
-        Self::ContextAndCode(ContextAndCodePrompt::new(
-            r#"def test_context():\n    pass"#.to_string(),
-            r#"def test_code():\n    "#.to_string(),
-        ))
+        Self::ContextAndCode(ContextAndCodePrompt {
+            context: r#"def test_context():\n    pass"#.to_string(),
+            code: r#"def test_code():\n    "#.to_string(),
+            selected_text: None,
+        })
     }
 }
```

**File**: `crates/lsp-ai/src/memory_backends/postgresml/mod.rs` (modified, +9/-8)
```diff
@@ -589,19 +589,20 @@ impl MemoryBackend for PostgresML {
         // Reconstruct the Prompts
         Ok(match code {
             Prompt::ContextAndCode(context_and_code) => {
-                Prompt::ContextAndCode(ContextAndCodePrompt::new(
-                    context.to_owned(),
-                    format_file_chunk(
+                Prompt::ContextAndCode(ContextAndCodePrompt {
+                    context: context.to_owned(),
+                    code: format_file_chunk(
                         position.text_document.uri.as_ref(),
                         &context_and_code.code,
                         self.config.client_params.root_uri.as_deref(),
                     ),
-                ))
+                    selected_text: None,
+                })
             }
-            Prompt::FIM(fim) => Prompt::FIM(FIMPrompt::new(
-                format!("{context}\n\n{}", fim.prompt),
-                fim.suffix,
-            )),
+            Prompt::FIM(fim) => Prompt::FIM(FIMPrompt {
+                prompt: format!("{context}\n\n{}", fim.prompt),
+                suffix: fim.suffix,
+            }),
         })
     }
 
```

**File**: `crates/lsp-ai/src/memory_backends/vector_store.rs` (modified, +9/-9)
```diff
@@ -726,19 +726,20 @@ impl MemoryBackend for VectorStore {
         // Reconstruct the prompts
         Ok(match code {
             Prompt::ContextAndCode(context_and_code) => {
-                Prompt::ContextAndCode(ContextAndCodePrompt::new(
-                    context.to_owned(),
-                    format_file_chunk(
+                Prompt::ContextAndCode(ContextAndCodePrompt {
+                    context: context.to_owned(),
+                    code: format_file_chunk(
                         position.text_document.uri.as_ref(),
                         &context_and_code.code,
                         self.config.client_params.root_uri.as_deref(),
                     ),
-                ))
+                    selected_text: None,
+                })
             }
-            Prompt::FIM(fim) => Prompt::FIM(FIMPrompt::new(
-                format!("{context}\n\n{}", fim.prompt),
-                fim.suffix,
-            )),
+            Prompt::FIM(fim) => Prompt::FIM(FIMPrompt {
+                prompt: format!("{context}\n\n{}", fim.prompt),
+                suffix: fim.suffix,
+            }),
         })
     }
 }
@@ -935,7 +936,6 @@ assert multiply_two_numbers(2, 3) == 6
 
     #[tokio::test]
     async fn can_build_prompt() -> anyhow::Result<()> {
-        crate::init_logger();
         let text_document1 = generate_filler_text_document(None, None);
         let params = lsp_types::DidOpenTextDocumentParams {
             text_document: text_document1.clone(),
```

---

### Incident Patch 3: `5ae6ca04` (2024-08-08)
**Commit Message**: Fix indexing on character boundaries

**File**: `crates/lsp-ai/src/transformer_worker.rs` (modified, +16/-6)
```diff
@@ -117,32 +117,42 @@ pub struct DoGenerationStreamResponse {
 }
 
 fn post_process_start(response: String, front: &str) -> String {
-    let mut front_match = response.len();
+    let response_chars: Vec<char> = response.chars().collect();
+    let front_chars: Vec<char> = front.chars().collect();
+
+    let mut front_match = response_chars.len();
     loop {
-        if response.is_empty() || front.ends_with(&response[..front_match]) {
+        if response_chars.is_empty() || front_chars.ends_with(&response_chars[..front_match]) {
             break;
         } else {
-            front_match -= 1;
+            front_match = front_match.saturating_sub(1);
         }
     }
+
     if front_match > 0 {
-        response[front_match..].to_owned()
+        response_chars[front_match..].iter().collect()
     } else {
         response
     }
 }
 
 fn post_process_end(response: String, back: &str) -> String {
+    let response_chars: Vec<char> = response.chars().collect();
+    let back_chars: Vec<char> = back.chars().collect();
+
     let mut back_match = 0;
     loop {
-        if back_match == response.len() || back.starts_with(&response[back_match..]) {
+        if back_match == response_chars.len()
+            || back_chars.starts_with(&response_chars[back_match..])
+        {
             break;
         } else {
             back_match += 1;
         }
     }
+
     if back_match > 0 {
-        response[..back_match].to_owned()
+        response_chars[..back_match].iter().collect()
     } else {
         response
     }
```

---

### Incident Patch 4: `220fb102` (2024-08-06)
**Commit Message**: Update README and fix bug

**File**: `README.md` (modified, +33/-13)
```diff
@@ -1,16 +1,24 @@
-<picture>
+<div align="center">
+   <picture>
   <source media="(prefers-color-scheme: dark)" srcset="/logos/logo-white-no-background-1024x1024.png">
   <source media="(prefers-color-scheme: light)" srcset="/logos/logo-white-black-background-1024x1024.png">
   <img alt="Logo" src="/logos/logo-white-black-background-1024x1024.png" width="128em">
-</picture>
+   </picture>
+</div>
 
-# LSP-AI
+<p align="center">
+   <p align="center"><b>Empowering not replacing programmers.</b></p>
+</p>
 
-[![Discord](https://img.shields.io/badge/Discord-%235865F2.svg?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/vKxfuAxA6Z)
+<p align="center">
+| <a href="https://github.com/SilasMarvin/lsp-ai/wiki"><b>Documentation</b></a> | <a href="https://silasmarvin.dev"><b>Blog</b></a> | <a href="https://discord.gg/vKxfuAxA6Z"><b>Discord</b></a> |
+</p>
 
-LSP-AI is an open source [language server](https://microsoft.github.io/language-server-protocol/) that serves as a backend for performing completion with large language models and soon other AI powered functionality. Because it is a language server, it works with any editor that has LSP support.
+---
 
-**The goal of LSP-AI is to assist and empower software engineers by integrating with the tools they already know and love not replace software engineers.**
+LSP-AI is an open source [language server](https://microsoft.github.io/language-server-protocol/) that serves as a backend for AI-powered functionality in your favorite code editors. It offers features like in-editor chatting with LLMs and code completions. Because it is a language server, it works with any editor that has LSP support.
+
+**The goal of LSP-AI is to assist and empower software engineers by integrating with the tools they already know and love, not replace software engineers.**
 
 A short list of a few of the editors it works with:
 - VS Code
@@ -21,13 +29,15 @@ A short list of a few of the editors it works with:
 
 It works with many many many more editors.
 
-See the wiki for instructions on:
-- [Getting Started](https://github.com/SilasMarvin/lsp-ai/wiki)
-- [Installation](https://github.com/SilasMarvin/lsp-ai/wiki/Installation)
-- [Configuration](https://github.com/SilasMarvin/lsp-ai/wiki/Configuration)
-- [Plugins](https://github.com/SilasMarvin/lsp-ai/wiki/Plugins)
-- [Server Capabilities](https://github.com/SilasMarvin/lsp-ai/wiki/Server-Capabilities-and-Functions)
-- [and more](https://github.com/SilasMarvin/lsp-ai/wiki)
+# Features
+
+## In-Editor Chatting
+
+Chat directly in your codebase with your favorite local or hosted models.
+
+*Chatting with Claude Sonnet in Helix*
+
+## Code Completions
 
 LSP-AI can work as an alternative to Github Copilot.
 
@@ -37,6 +47,16 @@ https://github.com/SilasMarvin/lsp-ai/assets/19626586/59430558-da23-4991-939d-57
 
 **Note that speed for completions is entirely dependent on the backend being used. For the fastest completions we recommend using either a small local model or Groq.**
 
+# Documentation
+
+See the wiki for instructions on:
+- [Getting Started](https://github.com/SilasMarvin/lsp-ai/wiki)
+- [Installation](https://github.com/SilasMarvin/lsp-ai/wiki/Installation)
+- [Configuration](https://github.com/SilasMarvin/lsp-ai/wiki/Configuration)
+- [Plugins](https://github.com/SilasMarvin/lsp-ai/wiki/Plugins)
+- [Server Capabilities](https://github.com/SilasMarvin/lsp-ai/wiki/Server-Capabilities-and-Functions)
+- [and more](https://github.com/SilasMarvin/lsp-ai/wiki)
+
 # The Case for LSP-AI
 
 **tl;dr LSP-AI abstracts complex implementation details from editor specific plugin authors, centralizing open-source development work into one shareable backend.**
```

**File**: `crates/lsp-ai/src/transformer_worker.rs` (modified, +4/-1)
```diff
@@ -423,7 +423,10 @@ async fn do_code_action_resolve(
         let messages_text = split
             .next()
             .context("trigger not found when resolving chat code action")?;
-        (messages_text, text_edit_line + 2)
+        (
+            messages_text,
+            text_edit_line + messages_text.lines().count() + 1,
+        )
     };
 
     // Parse into messages
```

---

### Incident Patch 5: `e6027792` (2024-08-06)
**Commit Message**: Fix some bugs and remove the need for a trigger

**File**: `Cargo.lock` (modified, +10/-0)
```diff
@@ -980,6 +980,15 @@ dependencies = [
  "slab",
 ]
 
+[[package]]
+name = "fxhash"
+version = "0.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c31b6d751ae2c7f11320402d34e41349dd1016f8d5d45e48c4312bc8625af50c"
+dependencies = [
+ "byteorder",
+]
+
 [[package]]
 name = "generic-array"
 version = "0.14.7"
@@ -1565,6 +1574,7 @@ dependencies = [
  "cc",
  "directories",
  "futures",
+ "fxhash",
  "hf-hub",
  "ignore",
  "indexmap 2.2.5",
```

**File**: `crates/lsp-ai/src/transformer_worker.rs` (modified, +17/-9)
```diff
@@ -410,12 +410,20 @@ async fn do_code_action_resolve(
     )))?;
     let file_text = rx.await?;
 
-    let messages_text = file_text
-        .split(&chat.trigger)
-        .last()
-        .context("trigger not found when resolving chat code action")?;
-    let text_edit_line = messages_text.lines().count();
-    let text_edit_character = messages_text.lines().nth(text_edit_line - 1).unwrap().len();
+    let (messages_text, text_edit_line) = if chat.trigger == "" {
+        (file_text.as_str(), file_text.lines().count() + 1)
+    } else {
+        let mut split = file_text.split(&chat.trigger);
+        let text_edit_line = split
+            .next()
+            .context("trigger not found when resolving chat code action")?
+            .lines()
+            .count();
+        let messages_text = split
+            .next()
+            .context("trigger not found when resolving chat code action")?;
+        (messages_text, text_edit_line + 2)
+    };
 
     // Parse into messages
     // NOTE: We are making some asumptions about the parameters the endpoint takes
@@ -489,12 +497,12 @@ async fn do_code_action_resolve(
 
     // Get the response
     let mut response = transformer_backend.do_completion(&prompt, params).await?;
-    response.insert_text = format!("\n<|assistant|>\n{}\n\n<|user|>\n", response.insert_text);
+    response.insert_text = format!("\n\n<|assistant|>\n{}\n\n<|user|>\n", response.insert_text);
 
     let edit = TextEdit::new(
         Range::new(
-            Position::new(text_edit_line as u32, text_edit_character as u32),
-            Position::new(text_edit_line as u32, text_edit_character as u32),
+            Position::new(text_edit_line as u32, 0),
+            Position::new(text_edit_line as u32, 0),
         ),
         response.insert_text.clone(),
     );
```

**File**: `lsp-ai-chat.md` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+!C How to get the line and character number of a substring in a Rust String
+
+<|assistant|>
+To get the line and character number of a substring in a Rust String, you can follow these steps:
+
+1. Split the string into lines
+2. Iterate through the lines
+3. Find the substring in each line
+4. Calculate the line and character number
+
+Here's a function that does this:
+
+```rust
+fn find_substring_position(text: &str, substring: &str) -> Option<(usize, usize)> {
+    for (line_number, line) in text.lines().enumerate() {
+        if let Some(char_number) = line.find(substring) {
+            return Some((line_number + 1, char_number + 1));
+        }
+    }
+    None
+}
+```
+
+Usage example:
+
+```rust
+fn main() {
+    let text = "Hello, world!\nThis is a test.\nFind me here.";
+    let substring = "test";
+    
+    match find_substring_position(text, substring) {
+        Some((line, char)) => println!("Found at line {}, character {}", line, char),
+        None => println!("Substring not found"),
+    }
+}
+```
+
+This function returns `Option<(usize, usize)>`, where the first `usize` is the line number and the second is the character number. Both are 1-indexed for readability. If the substring isn't found, it returns `None`.
+
+<|user|>
```

---

### Incident Patch 6: `551e3f01` (2024-06-26)
**Commit Message**: fix(ci): set `contents: write` permissions

**File**: `.github/workflows/release.yml` (modified, +2/-0)
```diff
@@ -125,6 +125,8 @@ jobs:
     name: publish
     runs-on: ubuntu-latest
     needs: ["dist", "dist-x86_64-unknown-linux-musl"]
+    permissions:
+      contents: write
     steps:
       - name: Checkout repository
         uses: actions/checkout@v4
```

---

### Incident Patch 7: `2554a4db` (2024-06-26)
**Commit Message**: fix(ci): `LLM_LS_TARGET` -> `LSP_AI_TARGET`

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -89,7 +89,7 @@ jobs:
     name: dist (x86_64-unknown-linux-musl)
     runs-on: ubuntu-latest
     env:
-      LLM_LS_TARGET: x86_64-unknown-linux-musl
+      LSP_AI_TARGET: x86_64-unknown-linux-musl
       # For some reason `-crt-static` is not working for clang without lld
       RUSTFLAGS: "-C link-arg=-fuse-ld=lld -C target-feature=-crt-static"
     container:
@@ -99,7 +99,7 @@ jobs:
 
     steps:
       - name: Install dependencies
-        run: apk add --no-cache git clang clang-dev lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl make linux-headers gcc
+        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl make linux-headers
 
       - name: Checkout repository
         uses: actions/checkout@v4
```

---

### Incident Patch 8: `5411b72f` (2024-06-26)
**Commit Message**: fix(ci): install `gcc` in musl build

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ jobs:
 
     steps:
       - name: Install dependencies
-        run: apk add --no-cache git clang clang-dev lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl make linux-headers
+        run: apk add --no-cache git clang clang-dev lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl make linux-headers gcc
 
       - name: Checkout repository
         uses: actions/checkout@v4
```

---

### Incident Patch 9: `4aa05140` (2024-06-26)
**Commit Message**: fix(ci): remove inexistent package & add  in musl build

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ jobs:
 
     steps:
       - name: Install dependencies
-        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl make linux-headers x86_64-linux-gnu-g++
+        run: apk add --no-cache git clang clang-dev lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl make linux-headers
 
       - name: Checkout repository
         uses: actions/checkout@v4
```

---

### Incident Patch 10: `5210076a` (2024-06-26)
**Commit Message**: fix(ci): install `x86_64-linux-gnu-g++` in musl build

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ jobs:
 
     steps:
       - name: Install dependencies
-        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl make linux-headers
+        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl make linux-headers x86_64-linux-gnu-g++
 
       - name: Checkout repository
         uses: actions/checkout@v4
```

---

### Incident Patch 11: `6077aa60` (2024-06-26)
**Commit Message**: fix(ci): install `linux-headers` in musl build

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ jobs:
 
     steps:
       - name: Install dependencies
-        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl make
+        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl make linux-headers
 
       - name: Checkout repository
         uses: actions/checkout@v4
```

---

### Incident Patch 12: `0afe8d67` (2024-06-26)
**Commit Message**: fix(ci): install `make` in musl build

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ jobs:
 
     steps:
       - name: Install dependencies
-        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl
+        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl make
 
       - name: Checkout repository
         uses: actions/checkout@v4
```

---

### Incident Patch 13: `201d6d3c` (2024-06-26)
**Commit Message**: fix(ci): install `perl` in musl build

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ jobs:
 
     steps:
       - name: Install dependencies
-        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev
+        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev perl
 
       - name: Checkout repository
         uses: actions/checkout@v4
```

---

### Incident Patch 14: `f5b94f90` (2024-06-26)
**Commit Message**: fix(ci): install `openssl-dev` in musl build

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ jobs:
 
     steps:
       - name: Install dependencies
-        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++
+        run: apk add --no-cache git clang lld musl-dev nodejs npm openssl-dev pkgconfig g++ openssl-dev
 
       - name: Checkout repository
         uses: actions/checkout@v4
```

---

### Incident Patch 15: `bb5d54f2` (2024-06-26)
**Commit Message**: fix: update visibilty

**File**: `crates/lsp-ai/src/config.rs` (modified, +47/-46)
```diff
@@ -70,7 +70,7 @@ pub struct TextSplitter {
 }
 
 #[derive(Debug, Clone, Deserialize)]
-pub enum ValidMemoryBackend {
+pub(crate) enum ValidMemoryBackend {
     #[serde(rename = "file_store")]
     FileStore(FileStore),
     #[serde(rename = "postgresml")]
@@ -141,10 +141,10 @@ pub(crate) struct Crawl {
 }
 
 #[derive(Clone, Debug, Deserialize)]
-pub struct PostgresMLEmbeddingModel {
-    pub model: String,
-    pub embed_parameters: Option<Value>,
-    pub query_parameters: Option<Value>,
+pub(crate) struct PostgresMLEmbeddingModel {
+    pub(crate) model: String,
+    pub(crate) embed_parameters: Option<Value>,
+    pub(crate) query_parameters: Option<Value>,
 }
 
 #[derive(Clone, Debug, Deserialize)]
@@ -164,38 +164,38 @@ pub(crate) struct FileStore {
 }
 
 impl FileStore {
-    pub fn new_without_crawl() -> Self {
+    pub(crate) fn new_without_crawl() -> Self {
         Self { crawl: None }
     }
 }
 
 #[derive(Clone, Debug, Deserialize)]
 #[serde(deny_unknown_fields)]
-pub struct Ollama {
+pub(crate) struct Ollama {
     // The generate endpoint, default: 'http://localhost:11434/api/generate'
-    pub generate_endpoint: Option<String>,
+    pub(crate) generate_endpoint: Option<String>,
     // The chat endpoint, default: 'http://localhost:11434/api/chat'
-    pub chat_endpoint: Option<String>,
+    pub(crate) chat_endpoint: Option<String>,
     // The model name
-    pub model: String,
+    pub(crate) model: String,
     // The maximum requests per second
     #[serde(default = "max_requests_per_second_default")]
-    pub max_requests_per_second: f32,
+    pub(crate) max_requests_per_second: f32,
 }
 
 #[derive(Clone, Debug, Deserialize)]
 #[serde(deny_unknown_fields)]
-pub struct MistralFIM {
+pub(crate) struct MistralFIM {
     // The auth token env var name
-    pub auth_token_env_var_name: Option<String>,
-    pub auth_token: Option<String>,
+    pub(crate) auth_token_env_var_name: Option<String>,
+    pub(crate) auth_token: Option<String>,
     // The fim endpoint
-    pub fim_endpoint: Option<String>,
+    pub(crate) fim_endpoint: Option<String>,
     // The model name
-    pub model: String,
+    pub(crate) model: String,
     // The maximum requests per second
     #[serde(default = "max_requests_per_second_default")]
-    pub max_requests_per_second: f32,
+    pub(crate) max_requests_per_second: f32,
 }
 
 #[cfg(feature = "llama_cpp")]
@@ -229,82 +229,83 @@ pub struct LLaMACPP {
 
 #[derive(Clone, Debug, Deserialize)]
 #[serde(deny_unknown_fields)]
-pub struct OpenAI {
+pub(crate) struct OpenAI {
     // The auth token env var name
-    pub auth_token_env_var_name: Option<String>,
+    pub(crate) auth_token_env_var_name: Option<String>,
     // The auth token
-    pub auth_token: Option<String>,
+    pub(crate) auth_token: Option<String>,
     // The completions endpoint
-    pub completions_endpoint: Option<String>,
+    pub(crate) completions_endpoint: Option<String>,
     // The chat endpoint
-    pub chat_endpoint: Option<String>,
+    pub(crate) chat_endpoint: Option<String>,
     // The maximum requests per second
     #[serde(default = "max_requests_per_second_default")]
-    pub max_requests_per_second: f32,
+    pub(crate) max_requests_per_second: f32,
     // The model name
-    pub model: String,
+    pub(crate) model: String,
 }
 
 #[derive(Clone, Debug, Deserialize)]
 #[serde(deny_unknown_fields)]
-pub struct Gemini {
+pub(crate) struct Gemini {
     // The auth token env var name
-    pub auth_token_env_var_name: Option<String>,
+    pub(crate) auth_token_env_var_name: Option<String>,
     // The auth token
-    pub auth_token: Option<String>,
+    pub(crate) auth_token: Option<String>,
     // The completions endpoint
-    pub completions_endpoint: Option<String>,
+    #[allow(dead_code)]
+    pub(crate) completions_endpoint: Option<String>,
     // The chat endpoint
-    pub chat_endpoint: Option<String>,
+    pub(crate) chat_endpoint: Option<String>,
     // The maximum requests per second
     #[serde(default = "max_requests_per_second_default")]
-    pub max_requests_per_second: f32,
+    pub(crate) max_requests_per_second: f32,
     // The model name
-    pub model: String,
+    pub(crate) model: String,
 }
 
 #[derive(Clone, Debug, Deserialize)]
 #[serde(deny_unknown_fields)]
 pub(crate) struct Anthropic {
     // The auth token env var name
-    pub auth_token_env_var_name: Option<String>,
-    pub auth_token: Option<String>,
+    pub(crate) auth_token_env_var_name: Option<String>,
+    pub(crate) auth_token: Option<String>,
     // The completions endpoint
     #[allow(dead_code)]
-    pub completions_endpoint: Option<String>,
+    pub(crate) completions_endpoint: Option<String>,
     // The chat endpoint
-    pub chat_endpoint: Option<String>,
+    pub(crate) chat_endpoint: Option<String>,
     // The maximum requests per second
     #[serde(default = "max_requests_per_second_default")]
-    pub max_requests_per_second: f32,
+    pub(crate) max_requests_per_second: f3
```

**File**: `crates/lsp-ai/src/crawl.rs` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ use tracing::{error, instrument};
 
 use crate::config::{self, Config};
 
-pub struct Crawl {
+pub(crate) struct Crawl {
     crawl_config: config::Crawl,
     config: Config,
     crawled_file_types: HashSet<String>,
```

**File**: `crates/lsp-ai/src/splitters/text_splitter.rs` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ use crate::{config, memory_backends::file_store::File};
 
 use super::{ByteRange, Chunk, Splitter};
 
-pub struct TextSplitter {
+pub(crate) struct TextSplitter {
     chunk_size: usize,
     splitter: text_splitter::TextSplitter<text_splitter::Characters>,
 }
```

**File**: `crates/lsp-ai/src/transformer_backends/anthropic.rs` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ pub(crate) struct AnthropicRunParams {
     pub(crate) temperature: f32,
 }
 
-pub struct Anthropic {
+pub(crate) struct Anthropic {
     config: config::Anthropic,
 }
 
```

**File**: `crates/lsp-ai/src/transformer_backends/gemini.rs` (modified, +11/-15)
```diff
@@ -55,37 +55,33 @@ impl GeminiContent {
 }
 
 #[derive(Debug, Deserialize, Serialize, Clone)]
+#[serde(rename = "camelCase")]
 #[serde(deny_unknown_fields)]
-pub struct GeminiGenerationConfig {
-    #[serde(rename = "stopSequences")]
+pub(crate) struct GeminiGenerationConfig {
     #[serde(default)]
-    pub stop_sequences: Vec<String>,
-    #[serde(rename = "maxOutputTokens")]
+    pub(crate) stop_sequences: Vec<String>,
     #[serde(default = "max_tokens_default")]
-    pub max_output_tokens: usize,
-    pub temperature: Option<f32>,
-    #[serde(rename = "topP")]
-    pub top_p: Option<f32>,
-    #[serde(rename = "topK")]
-    pub top_k: Option<f32>,
+    pub(crate) max_output_tokens: usize,
+    pub(crate) temperature: Option<f32>,
+    pub(crate) top_p: Option<f32>,
+    pub(crate) top_k: Option<f32>,
 }
 
 // NOTE: We cannot deny unknown fields as the provided parameters may contain other fields relevant to other processes
 #[derive(Debug, Deserialize, Serialize, Clone)]
-pub struct GeminiRunParams {
+#[serde(rename = "camelCase")]
+pub(crate) struct GeminiRunParams {
     contents: Vec<GeminiContent>,
-    #[serde(rename = "systemInstruction")]
     system_instruction: GeminiContent,
-    #[serde(rename = "generationConfig")]
     generation_config: Option<GeminiGenerationConfig>,
 }
 
-pub struct Gemini {
+pub(crate) struct Gemini {
     configuration: config::Gemini,
 }
 
 impl Gemini {
-    pub fn new(configuration: config::Gemini) -> Self {
+    pub(crate) fn new(configuration: config::Gemini) -> Self {
         Self { configuration }
     }
 
```

**File**: `crates/lsp-ai/src/transformer_backends/mistral_fim.rs` (modified, +9/-9)
```diff
@@ -26,25 +26,25 @@ const fn temperature_default() -> f32 {
 
 // NOTE: We cannot deny unknown fields as the provided parameters may contain other fields relevant to other processes
 #[derive(Debug, Deserialize)]
-pub struct MistralFIMRunParams {
+pub(crate) struct MistralFIMRunParams {
     #[serde(default = "max_tokens_default")]
-    pub max_tokens: usize,
+    pub(crate) max_tokens: usize,
     #[serde(default = "top_p_default")]
-    pub top_p: f32,
+    pub(crate) top_p: f32,
     #[serde(default = "temperature_default")]
-    pub temperature: f32,
-    pub min_tokens: Option<u64>,
-    pub random_seed: Option<u64>,
+    pub(crate) temperature: f32,
+    pub(crate) min_tokens: Option<u64>,
+    pub(crate) random_seed: Option<u64>,
     #[serde(default)]
-    pub stop: Vec<String>,
+    pub(crate) stop: Vec<String>,
 }
 
-pub struct MistralFIM {
+pub(crate) struct MistralFIM {
     config: config::MistralFIM,
 }
 
 impl MistralFIM {
-    pub fn new(config: config::MistralFIM) -> Self {
+    pub(crate) fn new(config: config::MistralFIM) -> Self {
         Self { config }
     }
 
```

**File**: `crates/lsp-ai/src/transformer_backends/ollama.rs` (modified, +3/-3)
```diff
@@ -16,8 +16,8 @@ use super::TransformerBackend;
 
 // NOTE: We cannot deny unknown fields as the provided parameters may contain other fields relevant to other processes
 #[derive(Debug, Deserialize)]
-pub struct OllamaRunParams {
-    pub fim: Option<FIM>,
+pub(crate) struct OllamaRunParams {
+    pub(crate) fim: Option<FIM>,
     messages: Option<Vec<ChatMessage>>,
     #[serde(default)]
     options: HashMap<String, Value>,
@@ -26,7 +26,7 @@ pub struct OllamaRunParams {
     keep_alive: Option<String>,
 }
 
-pub struct Ollama {
+pub(crate) struct Ollama {
     configuration: config::Ollama,
 }
 
```

**File**: `crates/lsp-ai/src/transformer_backends/open_ai/mod.rs` (modified, +18/-18)
```diff
@@ -38,22 +38,22 @@ const fn temperature_default() -> f32 {
 
 // NOTE: We cannot deny unknown fields as the provided parameters may contain other fields relevant to other processes
 #[derive(Debug, Deserialize)]
-pub struct OpenAIRunParams {
-    pub fim: Option<FIM>,
+pub(crate) struct OpenAIRunParams {
+    pub(crate) fim: Option<FIM>,
     messages: Option<Vec<ChatMessage>>,
     #[serde(default = "max_tokens_default")]
-    pub max_tokens: usize,
+    pub(crate) max_tokens: usize,
     #[serde(default = "top_p_default")]
-    pub top_p: f32,
+    pub(crate) top_p: f32,
     #[serde(default = "presence_penalty_default")]
-    pub presence_penalty: f32,
+    pub(crate) presence_penalty: f32,
     #[serde(default = "frequency_penalty_default")]
-    pub frequency_penalty: f32,
+    pub(crate) frequency_penalty: f32,
     #[serde(default = "temperature_default")]
-    pub temperature: f32,
+    pub(crate) temperature: f32,
 }
 
-pub struct OpenAI {
+pub(crate) struct OpenAI {
     configuration: config::OpenAI,
 }
 
@@ -68,27 +68,27 @@ struct OpenAICompletionsResponse {
     error: Option<Value>,
     #[serde(default)]
     #[serde(flatten)]
-    pub other: HashMap<String, Value>,
+    pub(crate) other: HashMap<String, Value>,
 }
 
 #[derive(Debug, Deserialize, Serialize)]
-pub struct OpenAIChatMessage {
-    pub role: String,
-    pub content: String,
+pub(crate) struct OpenAIChatMessage {
+    pub(crate) role: String,
+    pub(crate) content: String,
 }
 
 #[derive(Deserialize)]
-pub struct OpenAIChatChoices {
-    pub message: OpenAIChatMessage,
+pub(crate) struct OpenAIChatChoices {
+    pub(crate) message: OpenAIChatMessage,
 }
 
 #[derive(Deserialize)]
-pub struct OpenAIChatResponse {
-    pub choices: Option<Vec<OpenAIChatChoices>>,
-    pub error: Option<Value>,
+pub(crate) struct OpenAIChatResponse {
+    pub(crate) choices: Option<Vec<OpenAIChatChoices>>,
+    pub(crate) error: Option<Value>,
     #[serde(default)]
     #[serde(flatten)]
-    pub other: HashMap<String, Value>,
+    pub(crate) other: HashMap<String, Value>,
 }
 
 impl OpenAI {
```

#### Recent Merged Pull Requests:
- **PR #91** (2025-01-07): Delete crates/utils-tree-sitter/lsp-ai-chat.md (@SilasMarvin)
- **PR #89** (2024-12-18): Update README.md (@SilasMarvin)
- **PR #79** (2024-09-24): Fix tag issue / bump version (@SilasMarvin)
- **PR #76** (2024-09-20): Release/v0.7.0 (@SilasMarvin)
- **PR #75** (2024-09-20): Update Cargo.lock (@ProjectInitiative)
- **PR #70** (2024-09-05): Bump version (@SilasMarvin)
- **PR #69** (2024-09-05): Add support for external JSON config file (@zaytsev)
- **PR #66** (2024-08-27): Release/v0.6.2 (@SilasMarvin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
