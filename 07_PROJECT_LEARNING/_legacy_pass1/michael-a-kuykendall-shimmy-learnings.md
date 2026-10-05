# Forensic Learning Record (Deep Inspection): Michael-A-Kuykendall/shimmy

> **Canonical Artifact**: `07_PROJECT_LEARNING/michael-a-kuykendall-shimmy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Michael-A-Kuykendall/shimmy](https://github.com/Michael-A-Kuykendall/shimmy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:01:16.759Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Michael-A-Kuykendall/shimmy`
- **Description**: ⚡ Pure-Rust WebGPU inference engine — OpenAI-API compatible, GGUF native, runs on any GPU. No Python. No llama.cpp. Single binary.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5914 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/generation_performance.rs`
```
// Generation Performance Benchmarks
// Measures performance of text generation and API processing

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use shimmy::invariant_ppt::shimmy_invariants::*;

fn benchmark_template_rendering(c: &mut Criterion) {
    c.bench_function("chat_template_rendering", |b| {
        b.iter(|| {
            let prompt = black_box("What is the meaning of life?");
            let template = r#"<|user|>
{{prompt}}
<|assistant|>
"#;

            // Simulate template rendering (simplified)
            let rendered = template.replace("{{prompt}}", prompt);
            black_box(rendered)
        })
    });
}

fn benchmark_invariant_checking(c: &mut Criterion) {
    c.bench_function("generation_invariants", |b| {
        b.iter(|| {
            let _prompt = black_box("Hello world");
            let _response = black_box("Hello! How can I help you today?");

            // Benchmark measures generation performance only
            // Invariant validation removed - function doesn't exist in current codebase
        })
    });

    c.bench_function("api_response_invariants", |b| {
        b.iter(|| {
            let status = black_box(200u16);
            let body = black_box(r#"{"response": "Generated text"}"#);

            std::panic::catch_unwind(|| {
                assert_api_response_valid(status, body);
            })
            .unwrap_or_default();
        })
    });
}

fn benchmark_response_processing(c: &mut Criterion) {
    let sample_responses = vec![
        "Short response.",
        "This is a medium length response that contains more detail and explanation.",
        "This is a very long response that simulates the kind of detailed, comprehensive answer that an AI model might generate when asked a complex question. It includes multiple sentences, various concepts, and demonstrates the kind of text processing that would be typical in a real-world scenario.",
    ];

    c.bench_function("response_length_calculation", |b| {
        b.iter(|| {
            for response in &sample_responses {
                let length = black_box(response).len();
                let word_count = black_box(response).split_whitespace().count();
                black_box((length, word_count));
            }
        })
    });
}

fn benchmark_json_processing(c: &mut Criterion) {
    let sample_request = r#"{
        "model": "test-model",
        "messages": [
            {"role": "user", "content": "What is AI?"}
        ],
        "max_tokens": 100,
        "temperature": 0.7
    }"#;

    c.bench_function("json_parsing", |b| {
        b.iter(
            || match serde_json::from_str::<serde_json::Value>(black_box(sample_request)) {
                Ok(parsed) => black_box(parsed),
                Err(_) => serde_json::Value::Null,
            },
        )
    });

    let sample_response = serde_json::json!({
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "created": 1677652288,
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "AI stands for Artificial Intelligence."
            },
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": 9,
            "completion_tokens": 8,
            "total_tokens": 17
        }
    });

    c.bench_function("json_serialization", |b| {
        b.iter(|| {
            let serialized = serde_json::to_string(&black_box(&sample_response));
            black_box(serialized)
        })
    });
}

criterion_group!(
    benches,
    benchmark_template_rendering,
    benchmark_invariant_checking,
    benchmark_response_processing,
    benchmark_json_processing
);
criterion_main!(benches);

```

### Core Architecture Module: `benches/model_loading.rs`
```
// Model Loading Performance Benchmarks
// Measures performance of various model loading operations

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use shimmy::auto_discovery::ModelAutoDiscovery;
use shimmy::model_registry::{ModelEntry, Registry};
use std::path::PathBuf;

fn benchmark_model_discovery(c: &mut Criterion) {
    c.bench_function("model_auto_discovery_scan", |b| {
        b.iter(|| {
            let discovery = ModelAutoDiscovery::new();
            let discovered = discovery.discover_models();
            black_box(discovered)
        })
    });
}

fn benchmark_model_registry(c: &mut Criterion) {
    let mut registry = Registry::new();

    c.bench_function("model_registry_register", |b| {
        b.iter(|| {
            let entry = ModelEntry {
                name: black_box("test-model".to_string()),
                base_path: black_box(PathBuf::from("test.gguf")),
                lora_path: None,
                template: Some("chatml".to_string()),
                ctx_len: Some(black_box(4096)),
                n_threads: Some(black_box(4)),
            };
            registry.register(black_box(entry));
        })
    });

    // Add some models for listing benchmark
    for i in 0..100 {
        let entry = ModelEntry {
            name: format!("model-{}", i),
            base_path: PathBuf::from(format!("model-{}.gguf", i)),
            lora_path: None,
            template: Some("chatml".to_string()),
            ctx_len: Some(4096),
            n_threads: Some(4),
        };
        registry.register(entry);
    }

    c.bench_function("model_registry_list_100", |b| {
        b.iter(|| {
            let models = registry.list();
            black_box(models)
        })
    });

    c.bench_function("model_registry_get", |b| {
        b.iter(|| {
            let model = registry.get(black_box("model-50"));
            black_box(model)
        })
    });

    c.bench_function("model_registry_infer_template", |b| {
        b.iter(|| {
            let template = registry.infer_template(black_box("llama-3-8b"));
            black_box(template)
        })
    });
}

fn benchmark_safetensors_detection(c: &mut Criterion) {
    c.bench_function("safetensors_file_detection", |b| {
        b.iter(|| {
            let paths = vec![
                "model.safetensors",
                "model.gguf",
                "model.bin",
                "pytorch_model.bin",
                "model.pt",
            ];

            for path in paths {
                let path_buf = PathBuf::from(black_box(path));
                let is_safetensors = path_buf
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext == "safetensors")
                    .unwrap_or(false);
                black_box(is_safetensors);
            }
        })
    });
}

criterion_group!(
    benches,
    benchmark_model_discovery,
    benchmark_model_registry,
    benchmark_safetensors_detection
);
criterion_main!(benches);

```

### Core Architecture Module: `packaging/npm/lib/install.js`
```
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const GITHUB_REPO = 'Michael-A-Kuykendall/shimmy';
const BINARY_NAME = process.platform === 'win32' ? 'shimmy.exe' : 'shimmy';

function getPlatformInfo() {
  const platform = process.platform;
  const arch = process.arch;

  const platformMap = {
    'win32': 'windows',
    'darwin': 'darwin',
    'linux': 'linux'
  };

  const archMap = {
    'x64': 'amd64',
    'arm64': 'arm64'
  };

  return {
    platform: platformMap[platform],
    arch: archMap[arch],
    extension: platform === 'win32' ? '.exe' : ''
  };
}

async function downloadBinary() {
  console.log('🔄 Installing Shimmy binary...');

  const { platform, arch, extension } = getPlatformInfo();

  if (!platform || !arch) {
    throw new Error(`Unsupported platform: ${process.platform}-${process.arch}`);
  }

  const packageJson = require('../package.json');
  const version = packageJson.version;

  // Construct download URL
  const filename = `shimmy-${platform}-${arch}${extension}`;
  const downloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${filename}`;

  // Create bin directory
  const binDir = path.join(__dirname, '..', 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const binaryPath = path.join(binDir, BINARY_NAME);

  console.log(`📥 Downloading from: ${downloadUrl}`);

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(binaryPath);

    https.get(downloadUrl, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();

          // Make executable on Unix systems
          if (process.platform !== 'win32') {
            fs.chmodSync(binaryPath, '755');
          }

          console.log('✅ Shimmy installed successfully!');
          console.log(`📍 Binary location: ${binaryPath}`);
          console.log('🚀 Run "shimmy --help" to get started');
          resolve();
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            if (process.platform !== 'win32') {
              fs.chmodSync(binaryPath, '755');
            }
            console.log('✅ Shimmy installed successfully!');
            resolve();
          });
        }).on('error', reject);
      } else {
        reject(new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`));
      }
    }).on('error', reject);

    file.on('error', reject);
  });
}

// Run installation
downloadBinary().catch(error => {
  console.error('❌ Installation failed:', error.message);
  console.error('💡 Try installing manually from: https://github.com/Michael-A-Kuykendall/shimmy/releases');
  process.exit(1);
});

```

### Core Architecture Module: `src/anthropic_compat.rs`
```
/// Anthropic Claude API compatibility layer
///
/// This module provides compatibility with the Anthropic Claude API format,
/// allowing tools like Claude Code to work with shimmy in local networks.
///
/// Reference: https://docs.claude.com/claude/reference/messages_post
use crate::{api::ChatMessage, AppState};
use axum::{extract::State, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// Anthropic Messages API request format
#[derive(Debug, Deserialize)]
pub struct AnthropicMessageRequest {
    pub model: String,
    pub max_tokens: usize, // Required in Anthropic API
    pub messages: Vec<AnthropicMessage>,
    #[serde(default)]
    pub system: Option<String>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub top_p: Option<f32>,
    #[serde(default)]
    pub top_k: Option<i32>,
    #[serde(default)]
    pub stream: Option<bool>,
}

/// Anthropic message format - supports complex content blocks
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AnthropicMessage {
    pub role: String, // "user" or "assistant"
    pub content: AnthropicContent,
}

/// Anthropic content can be either a string or array of content blocks
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(untagged)]
pub enum AnthropicContent {
    Text(String),
    Blocks(Vec<ContentBlock>),
}

/// Content block for complex messages (text, images, etc.)
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ContentBlock {
    #[serde(rename = "type")]
    pub content_type: String,
    pub text: Option<String>,
    pub source: Option<ImageSource>,
}

/// Image source for image content blocks
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ImageSource {
    #[serde(rename = "type")]
    pub source_type: String,
    pub media_type: String,
    pub data: String,
}

/// Anthropic Messages API response format
#[derive(Debug, Serialize)]
pub struct AnthropicMessageResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub response_type: String, // "message"
    pub role: String, // "assistant"
    pub content: Vec<AnthropicContentBlock>,
    pub model: String,
    pub stop_reason: String,
    pub stop_sequence: Option<String>,
    pub usage: AnthropicUsage,
}

/// Response content block
#[derive(Debug, Serialize)]
pub struct AnthropicContentBlock {
    #[serde(rename = "type")]
    pub content_type: String, // "text"
    pub text: String,
}

/// Token usage information in Anthropic format
#[derive(Debug, Serialize)]
pub struct AnthropicUsage {
    pub input_tokens: usize,
    pub output_tokens: usize,
}

/// Convert Anthropic message format to our internal ChatMessage format
impl From<AnthropicMessage> for ChatMessage {
    fn from(msg: AnthropicMessage) -> Self {
        let content = match msg.content {
            AnthropicContent::Text(text) => text,
            AnthropicContent::Blocks(blocks) => {
                // Extract text from content blocks, ignore images for now
                blocks
                    .iter()
                    .filter_map(|block| {
                        if block.content_type == "text" {
                            block.text.clone()
                        } else {
                            // For non-text blocks, provide a placeholder
                            Some(format!("[{} content]", block.content_type))
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            }
        };

        ChatMessage {
            role: msg.role,
            content,
        }
    }
}

fn contains_unsupported_media(messages: &[AnthropicMessage]) -> bool {
    messages.iter().any(|message| {
        matches!(
            &message.content,
            AnthropicContent::Blocks(blocks)
                if blocks.iter().any(|block| block.content_type != "text")
        )
    })
}

/// Anthropic Messages API endpoint: POST /v1/messages
pub async fn messages(
    State(state): State<Arc<AppState>>,
    Json(req): Json<AnthropicMessageRequest>,
) -> impl IntoResponse {
    if contains_unsupported_media(&req.messages) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": {
                    "type": "invalid_request_error",
                    "message": "multimodal content is not supported by this build"
                }
            })),
        )
            .into_response();
    }

    // Convert Anthropic format to our internal format
    let internal_messages: Vec<ChatMessage> =
        req.messages.into_iter().map(|msg| msg.into()).collect();

    // Find the model
    let Some(spec) = state.registry.to_spec(&req.model) else {
        tracing::error!("Model '{}' not found in registry", req.model);
        return axum::http::StatusCode::NOT_FOUND.into_response();
    };

    // Extract system message if present
    let system_message = req.system.clone();

    // Build generation options using default values and override with request params
    let mut options = crate::engine::GenOptions {
        max_tokens: req.max_tokens,
        stream: req.stream.unwrap_or(false),
        ..Default::default()
    };

    if let Some(temp) = req.temperature {
        options.temperature = temp;
    }
    if let Some(p) = req.top_p {
        options.top_p = p;
    }
    if let Some(k) = req.top_k {
        options.top_k = k;
    }

    // Prepare the prompt using the single renderer (Jinja-first with the model's
    // real GGUF chat_template; family fallback; raw). Anthropic's Human:/Assistant:
    // manual assembly is replaced so instruct models get their OWN template.
    let (system_prompt, conversation_pairs) =
        extract_system_and_pairs(&internal_messages, system_message);

    let mut pairs: Vec<(String, String)> = Vec::new();
    if let Some(system) = system_prompt {
        pairs.push(("system".to_string(), system));
    }
    for (user_msg, assistant_msg) in conversation_pairs {
        pairs.push(("user".to_string(), user_msg.to_string()));
        if let Some(assistant) = assistant_msg {
            pairs.push(("assistant".to_string(), assistant.to_string()));
        }
    }

    let fam = crate::prompt_render::family_from_spec(spec.template.as_deref(), &req.model);
    let prompt = crate::prompt_render::render_chat_prompt_with_extras(
        spec.chat_template.as_deref(),
        fam,
        None,
        &pairs,
        None,
        &crate::prompt_render::JinjaExtras::for_model(&req.model),
    )
    .text;

    // Load the model and generate response
    let Ok(loaded_model) = state.engine.load(&spec).await else {
        tracing::error!("Failed to load model '{}'", req.model);
        return axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };

    match loaded_model.generate(&prompt, options, None).await {
        Ok(response) => {
            let anthropic_response = AnthropicMessageResponse {
                id: format!("msg_{}", Uuid::new_v4()),
                response_type: "message".to_string(),
                role: "assistant".to_string(),
                content: vec![AnthropicContentBlock {
                    content_type: "text".to_string(),
                    text: response.clone(),
                }],
                model: req.model,
                stop_reason: "end_turn".to_string(),
                stop_sequence: None,
                usage: AnthropicUsage {
                    input_tokens: estimate_tokens(&prompt),
                    output_tokens: estimate_tokens(&response),
                },
            };

            Json(anthropic_response).into_response()
        }
        Err(e) => {
            tracing::error!("Generation failed: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// Extract system message and conversation pairs from messages
/// This mimics the logic from opena
```

### Core Architecture Module: `src/api.rs`
```
use axum::extract::ws::{Message as WsMessage, WebSocket, WebSocketUpgrade};
use axum::{
    extract::State,
    response::{sse::Event, IntoResponse, Sse},
    Json,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::invariant_ppt::shimmy_invariants;
use crate::{engine::GenOptions, AppState};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct GenerateRequest {
    pub model: String,
    pub prompt: Option<String>,             // raw mode
    pub messages: Option<Vec<ChatMessage>>, // chat mode
    pub system: Option<String>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub top_p: Option<f32>,
    #[serde(default)]
    pub top_k: Option<i32>,
    #[serde(default)]
    pub max_tokens: Option<usize>,
    #[serde(default)]
    pub stream: Option<bool>,
    /// Force raw completion (bypass chat template).
    #[serde(default)]
    pub raw_prompt: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateResponse {
    pub response: String,
}

pub async fn generate(
    State(state): State<Arc<AppState>>,
    Json(req): Json<GenerateRequest>,
) -> impl IntoResponse {
    let Some(spec) = state.registry.to_spec(&req.model) else {
        tracing::error!("Model '{}' not found in registry", req.model);
        return axum::http::StatusCode::NOT_FOUND.into_response();
    };
    let engine = &state.engine;
    let loaded = match engine.load(&spec).await {
        Ok(loaded) => loaded,
        Err(e) => {
            tracing::error!(
                "Failed to load model '{}': {} (Issue #106 Windows debugging)",
                req.model,
                e
            );
            return axum::http::StatusCode::BAD_GATEWAY.into_response();
        }
    };

    // Construct prompt via the single renderer (Jinja-first using the model's
    // real GGUF chat_template; family fallback; raw for completion).
    let prompt = if let Some(ms) = &req.messages {
        let fam = crate::prompt_render::family_from_spec(spec.template.as_deref(), &spec.name);
        let pairs = ms
            .iter()
            .map(|m| (m.role.clone(), m.content.clone()))
            .collect::<Vec<_>>();
        crate::prompt_render::render_chat_prompt_with_extras(
            spec.chat_template.as_deref(),
            fam,
            req.system.as_deref(),
            &pairs,
            None,
            &crate::prompt_render::JinjaExtras::for_model(&spec.name),
        )
        .text
    } else {
        let fam = crate::prompt_render::family_from_spec(spec.template.as_deref(), &spec.name);
        let raw = crate::prompt_render::render_completion_prompt_with_extras(
            req.prompt.as_deref().unwrap_or_default(),
            spec.chat_template.as_deref(),
            fam,
            req.raw_prompt.unwrap_or(false),
            &crate::prompt_render::JinjaExtras::for_model(&spec.name),
        );
        raw.text
    };

    let mut opts = GenOptions::default();
    if let Some(t) = req.temperature {
        opts.temperature = t;
    }
    if let Some(p) = req.top_p {
        opts.top_p = p;
    }
    if let Some(k) = req.top_k {
        opts.top_k = k;
    }
    if let Some(m) = req.max_tokens {
        opts.max_tokens = m;
    }
    if let Some(s) = req.stream {
        opts.stream = s;
    }

    if opts.stream {
        // SSE streaming
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<String>();
        let mut opts_clone = opts.clone();
        opts_clone.stream = false; // internal generation collects tokens while we push per token
        let prompt_clone = prompt.clone();
        let model_name = req.model.clone();
        tokio::spawn(async move {
            let tx_tokens = tx.clone();
            if let Err(error) = loaded
                .generate(
                    &prompt_clone,
                    opts_clone,
                    Some(Box::new(move |tok| {
                        let _ = tx_tokens.send(tok);
                    })),
                )
                .await
            {
                tracing::error!(
                    "Streaming generation failed for model '{}': {}",
                    model_name,
                    error
                );
                let _ = tx.send(format!("[ERROR] {}", error));
            }
            let _ = tx.send("[DONE]".into());
        });
        let stream = UnboundedReceiverStream::new(rx)
            .map(|s| Ok::<Event, std::convert::Infallible>(Event::default().data(s)));
        Sse::new(stream).into_response()
    } else {
        match loaded.generate(&prompt, opts, None).await {
            Ok(full) => {
                tracing::debug!(
                    "Generation completed successfully for model '{}'",
                    req.model
                );
                Json(GenerateResponse { response: full }).into_response()
            }
            Err(e) => {
                tracing::error!(
                    "Generation failed for model '{}': {} (Issue #106 Windows debugging)",
                    req.model,
                    e
                );
                axum::http::StatusCode::BAD_GATEWAY.into_response()
            }
        }
    }
}

// WebSocket endpoint: client connects to /ws/generate, sends a single JSON GenerateRequest text frame.
// Server streams each token as a Text frame and finally sends a JSON {"done":true} frame.
pub async fn ws_generate(
    State(state): State<Arc<AppState>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws_generate(state, socket))
}

async fn handle_ws_generate(state: Arc<AppState>, mut socket: WebSocket) {
    // Expect first message with request JSON
    let Some(Ok(first)) = socket.recv().await else {
        return;
    };
    let req_json = match first {
        WsMessage::Text(t) => t,
        WsMessage::Binary(b) => String::from_utf8_lossy(&b).to_string(),
        _ => return,
    };
    let req: GenerateRequest = match serde_json::from_str(&req_json) {
        Ok(r) => r,
        Err(e) => {
            let _ = socket
                .send(WsMessage::Text(format!(
                    "{{\"error\":\"bad request: {e}\"}}"
                )))
                .await;
            return;
        }
    };
    let Some(spec) = state.registry.to_spec(&req.model) else {
        let _ = socket
            .send(WsMessage::Text("{\"error\":\"model not found\"}".into()))
            .await;
        return;
    };
    let Ok(loaded) = state.engine.load(&spec).await else {
        let _ = socket
            .send(WsMessage::Text("{\"error\":\"load failed\"}".into()))
            .await;
        return;
    };

    // Build prompt (reuse single renderer)
    let prompt = if let Some(ms) = &req.messages {
        let fam = crate::prompt_render::family_from_spec(spec.template.as_deref(), &spec.name);
        let pairs = ms
            .iter()
            .map(|m| (m.role.clone(), m.content.clone()))
            .collect::<Vec<_>>();
        crate::prompt_render::render_chat_prompt_with_extras(
            spec.chat_template.as_deref(),
            fam,
            req.system.as_deref(),
            &pairs,
            None,
            &crate::prompt_render::JinjaExtras::for_model(&spec.name),
        )
        .text
    } else {
        req.prompt.clone().unwrap_or_default()
    };

    let mut opts = GenOptions::default();
    if let Some(t) = req.temperature {
        opts.temperature = t;
    }
    if let Some(p) = req.top_p {
        opts.top_p = p;
    }
    if let Some(k) = req.top_k {
        opts.top_k = k;
    }
    if let Some(m) = req.max_tokens {
        opts.max_tokens = m;
    }
    // Force internal non-stream; we push per-token ourselves
    let mut internal = opts.clone();
    internal.stream = false;

```

### Core Architecture Module: `src/api_errors.rs`
```
// Improved API error handling
use axum::{http::StatusCode, response::Json};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug)]
pub enum ApiError {
    ModelNotFound(String),
    GenerationFailed(String),
    InvalidRequest(String),
}

impl From<ApiError> for (StatusCode, Json<ErrorResponse>) {
    fn from(err: ApiError) -> Self {
        match err {
            ApiError::ModelNotFound(model) => (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Model '{}' not found", model),
                }),
            ),
            ApiError::GenerationFailed(msg) => (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: format!("Generation failed: {}", msg),
                }),
            ),
            ApiError::InvalidRequest(msg) => {
                (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: msg }))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use axum::Json;

    #[test]
    fn test_error_response_creation() {
        let response = ErrorResponse {
            error: "Test error message".to_string(),
        };

        assert_eq!(response.error, "Test error message");
    }

    #[test]
    fn test_error_response_serialization() {
        let response = ErrorResponse {
            error: "Serialization test".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("Serialization test"));

        let parsed: ErrorResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.error, "Serialization test");
    }

    #[test]
    fn test_api_error_model_not_found() {
        let error = ApiError::ModelNotFound("test-model".to_string());
        let (status, json_response) = <(StatusCode, Json<ErrorResponse>)>::from(error);

        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(json_response.0.error, "Model 'test-model' not found");
    }

    #[test]
    fn test_api_error_generation_failed() {
        let error = ApiError::GenerationFailed("Out of memory".to_string());
        let (status, json_response) = <(StatusCode, Json<ErrorResponse>)>::from(error);

        assert_eq!(status, StatusCode::BAD_GATEWAY);
        assert_eq!(json_response.0.error, "Generation failed: Out of memory");
    }

    #[test]
    fn test_api_error_invalid_request() {
        let error = ApiError::InvalidRequest("Missing required field".to_string());
        let (status, json_response) = <(StatusCode, Json<ErrorResponse>)>::from(error);

        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(json_response.0.error, "Missing required field");
    }

    #[test]
    fn test_api_error_empty_model_name() {
        let error = ApiError::ModelNotFound("".to_string());
        let (status, json_response) = <(StatusCode, Json<ErrorResponse>)>::from(error);

        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(json_response.0.error, "Model '' not found");
    }

    #[test]
    fn test_api_error_special_characters() {
        let error = ApiError::ModelNotFound("model/with/slashes".to_string());
        let (status, json_response) = <(StatusCode, Json<ErrorResponse>)>::from(error);

        assert_eq!(status, StatusCode::NOT_FOUND);
        assert!(json_response.0.error.contains("model/with/slashes"));
    }

    #[test]
    fn test_api_error_unicode_content() {
        let error = ApiError::GenerationFailed("Erreur Unicode: éñ¡".to_string());
        let (status, json_response) = <(StatusCode, Json<ErrorResponse>)>::from(error);

        assert_eq!(status, StatusCode::BAD_GATEWAY);
        assert!(json_response.0.error.contains("éñ¡"));
    }

    #[test]
    fn test_api_error_long_messages() {
        let long_message = "A".repeat(1000);
        let error = ApiError::InvalidRequest(long_message.clone());
        let (status, json_response) = <(StatusCode, Json<ErrorResponse>)>::from(error);

        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(json_response.0.error, long_message);
    }

    #[test]
    fn test_api_error_debug_format() {
        let error1 = ApiError::ModelNotFound("test".to_string());
        let error2 = ApiError::GenerationFailed("test".to_string());
        let error3 = ApiError::InvalidRequest("test".to_string());

        let debug1 = format!("{:?}", error1);
        let debug2 = format!("{:?}", error2);
        let debug3 = format!("{:?}", error3);

        assert!(debug1.contains("ModelNotFound"));
        assert!(debug2.contains("GenerationFailed"));
        assert!(debug3.contains("InvalidRequest"));
        assert!(debug1.contains("test"));
        assert!(debug2.contains("test"));
        assert!(debug3.contains("test"));
    }

    #[test]
    fn test_error_response_json_structure() {
        let error = ApiError::ModelNotFound("my-model".to_string());
        let (_, json_response) = <(StatusCode, Json<ErrorResponse>)>::from(error);

        // Test that the structure can be serialized correctly
        let serialized = serde_json::to_value(&json_response.0).unwrap();
        assert!(serialized.is_object());
        assert!(serialized["error"].is_string());
        assert_eq!(serialized["error"], "Model 'my-model' not found");
    }

    #[test]
    fn test_multiple_error_conversions() {
        let errors = vec![
            ApiError::ModelNotFound("model1".to_string()),
            ApiError::GenerationFailed("GPU error".to_string()),
            ApiError::InvalidRequest("Bad JSON".to_string()),
            ApiError::ModelNotFound("model2".to_string()),
        ];

        let responses: Vec<(StatusCode, Json<ErrorResponse>)> = errors
            .into_iter()
            .map(<(StatusCode, Json<ErrorResponse>)>::from)
            .collect();

        assert_eq!(responses.len(), 4);
        assert_eq!(responses[0].0, StatusCode::NOT_FOUND);
        assert_eq!(responses[1].0, StatusCode::BAD_GATEWAY);
        assert_eq!(responses[2].0, StatusCode::BAD_REQUEST);
        assert_eq!(responses[3].0, StatusCode::NOT_FOUND);
    }

    #[test]
    fn test_error_response_fields() {
        let response = ErrorResponse {
            error: "Test".to_string(),
        };

        // Verify the struct has only the expected fields
        let json = serde_json::to_value(&response).unwrap();
        let obj = json.as_object().unwrap();
        assert_eq!(obj.len(), 1);
        assert!(obj.contains_key("error"));
    }

    #[test]
    fn test_status_code_mapping() {
        // Verify all status codes are as expected
        assert_eq!(StatusCode::NOT_FOUND.as_u16(), 404);
        assert_eq!(StatusCode::BAD_GATEWAY.as_u16(), 502);
        assert_eq!(StatusCode::BAD_REQUEST.as_u16(), 400);
    }
}

```

### Core Architecture Module: `src/auto_discovery/mod.rs`
```
mod ollama;
mod scan;

use crate::invariant_ppt::shimmy_invariants;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredModel {
    pub name: String,
    pub path: PathBuf,
    pub lora_path: Option<PathBuf>,
    pub size_bytes: u64,
    pub model_type: String,
    pub parameter_count: Option<String>,
    pub quantization: Option<String>,
}

pub struct ModelAutoDiscovery {
    pub search_paths: Vec<PathBuf>,
}

impl ModelAutoDiscovery {
    pub fn new() -> Self {
        let mut search_paths = vec![PathBuf::from("./models")];

        // Add paths from environment variables
        if let Ok(shimmy_base) = std::env::var("SHIMMY_BASE_GGUF") {
            let path = PathBuf::from(shimmy_base);
            if let Some(parent) = path.parent() {
                search_paths.push(parent.to_path_buf());
            }
        }

        // Add custom model directories from environment variable
        if let Ok(custom_dirs) = std::env::var("SHIMMY_MODEL_PATHS") {
            for dir in custom_dirs.split(';').filter(|s| !s.is_empty()) {
                search_paths.push(PathBuf::from(dir));
            }
        }

        // Add OLLAMA_MODELS environment variable if set
        if let Ok(ollama_models) = std::env::var("OLLAMA_MODELS") {
            search_paths.push(PathBuf::from(ollama_models));
        }

        // Add common model directories
        if let Some(home) = std::env::var_os("HOME") {
            search_paths.push(PathBuf::from(home.clone()).join(".cache/huggingface/hub"));
            search_paths.push(PathBuf::from(home.clone()).join(".ollama/models"));
            search_paths.push(PathBuf::from(home.clone()).join(".lmstudio/models"));
            search_paths.push(PathBuf::from(home.clone()).join(".cache/lm-studio/models"));
            search_paths.push(PathBuf::from(home.clone()).join("models"));
            search_paths.push(PathBuf::from(home).join(".local/share/shimmy/models"));
        }

        if let Some(user_profile) = std::env::var_os("USERPROFILE") {
            // Focus on likely GGUF model locations
            search_paths.push(PathBuf::from(user_profile.clone()).join(".cache\\huggingface\\hub"));
            search_paths.push(PathBuf::from(user_profile.clone()).join(".ollama\\models"));
            search_paths.push(PathBuf::from(user_profile.clone()).join(".lmstudio\\models"));
            search_paths
                .push(PathBuf::from(user_profile.clone()).join(".cache\\lm-studio\\models"));
            search_paths.push(
                PathBuf::from(user_profile.clone()).join("AppData\\Roaming\\LM Studio\\models"),
            );
            search_paths.push(PathBuf::from(user_profile.clone()).join("models"));
            search_paths
                .push(PathBuf::from(user_profile.clone()).join("AppData\\Local\\shimmy\\models"));
            search_paths.push(PathBuf::from(user_profile).join("Downloads"));
        }

        // Search common Ollama installation paths on different drives (Windows)
        #[cfg(windows)]
        {
            if let Ok(username) = std::env::var("USERNAME") {
                for drive in &["C:", "D:", "E:", "F:"] {
                    let ollama_path = PathBuf::from(format!(
                        "{}\\Users\\{}\\AppData\\Local\\Ollama\\models",
                        drive, username
                    ));
                    search_paths.push(ollama_path);

                    // Also check alternate Ollama paths
                    let alt_ollama = PathBuf::from(format!("{}\\Ollama\\models", drive));
                    search_paths.push(alt_ollama);

                    // Check common model storage locations
                    let models_path = PathBuf::from(format!("{}\\models", drive));
                    search_paths.push(models_path);
                }
            }
        }

        Self { search_paths }
    }

    #[allow(dead_code)] // utility method — available for dynamic path registration at runtime
    pub fn add_search_path(&mut self, path: PathBuf) {
        self.search_paths.push(path);
    }

    pub fn discover_models(&self) -> Result<Vec<DiscoveredModel>> {
        let mut discovered = Vec::new();

        for search_path in &self.search_paths {
            if search_path.exists() && search_path.is_dir() {
                // Add error handling to prevent one bad directory from killing discovery
                match self.scan_directory(search_path) {
                    Ok(models) => discovered.extend(models),
                    Err(e) => {
                        eprintln!("Warning: Failed to scan {}: {}", search_path.display(), e);
                        continue; // Skip problematic directories instead of failing
                    }
                }
            }
        }

        // Discover Ollama models specifically
        match self.discover_ollama_models() {
            Ok(ollama_models) => discovered.extend(ollama_models),
            Err(e) => eprintln!("Warning: Failed to discover Ollama models: {}", e),
        }

        // Remove duplicates based on file hash or path
        discovered.sort_by(|a, b| a.path.cmp(&b.path));
        discovered.dedup_by(|a, b| a.path == b.path);

        // PPT Invariant: Validate discovery results before returning
        shimmy_invariants::assert_discovery_valid(discovered.len());

        // PPT Invariant: Validate each discovered model
        for model in &discovered {
            // Windows path normalization for Issue #106
            let path_str = if cfg!(target_os = "windows") {
                model.path.to_string_lossy().replace('\\', "/")
            } else {
                model.path.to_string_lossy().to_string()
            };
            shimmy_invariants::assert_backend_selection_valid(&path_str, &model.model_type);
        }

        Ok(discovered)
    }
}

impl Default for ModelAutoDiscovery {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_discovered_model_creation() {
        let model = DiscoveredModel {
            name: "test".to_string(),
            path: PathBuf::from("/test"),
            lora_path: None,
            size_bytes: 1024,
            model_type: "Llama".to_string(),
            parameter_count: Some("7B".to_string()),
            quantization: Some("Q4_K_M".to_string()),
        };
        assert_eq!(model.name, "test");
        assert_eq!(model.size_bytes, 1024);
    }

    #[test]
    fn test_model_auto_discovery_new() {
        let discovery = ModelAutoDiscovery::new();
        assert!(!discovery.search_paths.is_empty());
    }

    #[test]
    fn test_filename_parsing() {
        let discovery = ModelAutoDiscovery::new();
        let (model_type, params, quant) = discovery.parse_filename("llama-7b-q4_k_m.gguf");
        assert_eq!(model_type, "Llama");
        assert_eq!(params, Some("7B".to_string()));
        assert_eq!(quant, Some("Q4_K_M".to_string()));
    }
}

```

### Core Architecture Module: `src/auto_discovery/ollama.rs`
```
use super::{DiscoveredModel, ModelAutoDiscovery};
use anyhow::Result;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
pub(super) struct OllamaManifest {
    #[serde(rename = "schemaVersion")]
    #[allow(dead_code)] // Ollama manifest schema field — present in JSON, consumed by serde
    schema_version: i32,
    #[serde(rename = "mediaType")]
    #[allow(dead_code)] // Ollama manifest media type — present in JSON, consumed by serde
    media_type: String,
    #[allow(dead_code)] // Ollama manifest config section — present in JSON, consumed by serde
    config: OllamaConfig,
    layers: Vec<OllamaLayer>,
}

#[derive(Debug, Deserialize)]
pub(super) struct OllamaConfig {
    #[serde(rename = "mediaType")]
    #[allow(dead_code)] // Ollama config media type — present in JSON, consumed by serde
    media_type: String,
    #[allow(dead_code)] // Ollama config digest — present in JSON, consumed by serde
    digest: String,
    #[allow(dead_code)] // Ollama config size — present in JSON, consumed by serde
    size: i64,
}

#[derive(Debug, Deserialize)]
pub(super) struct OllamaLayer {
    #[serde(rename = "mediaType")]
    pub(super) media_type: String,
    pub(super) digest: String,
    pub(super) size: i64,
}

impl ModelAutoDiscovery {
    pub(super) fn discover_ollama_models(&self) -> Result<Vec<DiscoveredModel>> {
        let mut models = Vec::new();

        // Collect potential Ollama directories to check
        let mut ollama_dirs = Vec::new();

        // Check OLLAMA_MODELS env var first
        if let Ok(ollama_models) = std::env::var("OLLAMA_MODELS") {
            ollama_dirs.push(PathBuf::from(ollama_models));
        }

        // Check SHIMMY_BASE_GGUF parent directory for Ollama structure
        if let Ok(shimmy_base) = std::env::var("SHIMMY_BASE_GGUF") {
            let path = PathBuf::from(shimmy_base);
            if let Some(parent) = path.parent() {
                // Check if we're directly in an Ollama structure
                ollama_dirs.push(parent.to_path_buf());

                // Also check if we're in a 'blobs' directory - go up one more level
                if parent.file_name().and_then(|n| n.to_str()) == Some("blobs") {
                    if let Some(grandparent) = parent.parent() {
                        ollama_dirs.push(grandparent.to_path_buf());
                    }
                }
            }
        }

        // Add standard Ollama locations
        if let Some(home) = std::env::var_os("HOME") {
            ollama_dirs.push(PathBuf::from(home).join(".ollama/models"));
        }
        if let Some(user_profile) = std::env::var_os("USERPROFILE") {
            ollama_dirs.push(PathBuf::from(user_profile).join(".ollama").join("models"));
        }

        // Check each potential Ollama directory
        for ollama_dir in ollama_dirs {
            if !ollama_dir.exists() {
                continue;
            }

            let manifests_dir = ollama_dir.join("manifests");
            let blobs_dir = ollama_dir.join("blobs");

            // Try new manifest/blob format first
            if manifests_dir.exists() && blobs_dir.exists() {
                models.extend(self.discover_ollama_manifest_models(&manifests_dir, &blobs_dir)?);
            }

            // Fallback: scan for GGUF files directly in ollama directory structure
            // This handles legacy Ollama installations and custom directory layouts
            models.extend(self.discover_ollama_direct_models(&ollama_dir)?);
        }

        Ok(models)
    }

    fn discover_ollama_manifest_models(
        &self,
        manifests_dir: &Path,
        blobs_dir: &Path,
    ) -> Result<Vec<DiscoveredModel>> {
        let mut models = Vec::new();

        // Recursively scan manifests directory to find all manifest files
        self.scan_manifest_directory(manifests_dir, blobs_dir, &mut models, Vec::new())?;

        Ok(models)
    }

    fn scan_manifest_directory(
        &self,
        dir: &Path,
        blobs_dir: &Path,
        models: &mut Vec<DiscoveredModel>,
        path_components: Vec<String>,
    ) -> Result<()> {
        for entry in
            fs::read_dir(dir).map_err(|_| anyhow::anyhow!("Cannot read directory: {:?}", dir))?
        {
            let entry = entry?;
            let entry_name = entry.file_name().to_string_lossy().to_string();
            let mut new_path_components = path_components.clone();
            new_path_components.push(entry_name.clone());

            if entry.path().is_dir() {
                // Recursively scan subdirectories
                self.scan_manifest_directory(
                    &entry.path(),
                    blobs_dir,
                    models,
                    new_path_components,
                )?;
            } else if entry.path().is_file() {
                // This is a manifest file, try to parse it
                if let Ok(manifest_content) = fs::read_to_string(entry.path()) {
                    if let Ok(manifest) = serde_json::from_str::<OllamaManifest>(&manifest_content)
                    {
                        // Find the model blob (largest layer that's likely a GGUF)
                        for layer in &manifest.layers {
                            if layer.media_type == "application/vnd.ollama.image.model" {
                                if let Some(hash) = layer.digest.strip_prefix("sha256:") {
                                    let blob_path = blobs_dir.join(format!("sha256-{}", hash));
                                    if blob_path.exists()
                                        && self.is_gguf_blob(&blob_path).unwrap_or(false)
                                    {
                                        // Build display name from path components
                                        let display_name = if path_components.len() >= 2 {
                                            // Format: registry/namespace/model:tag or namespace/model:tag
                                            let mut name_parts = path_components.clone();
                                            name_parts.push(entry_name.clone());
                                            name_parts.join("/")
                                        } else {
                                            // Fallback to simple name
                                            format!("{}:{}", path_components.join("/"), entry_name)
                                        };

                                        let discovered = DiscoveredModel {
                                            name: display_name,
                                            path: blob_path,
                                            lora_path: None,
                                            size_bytes: layer.size as u64,
                                            model_type: "Ollama".to_string(),
                                            parameter_count: None,
                                            quantization: None,
                                        };
                                        models.push(discovered);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn discover_ollama_direct_models(&self, ollama_dir: &Path) -> Result<Vec<DiscoveredModel>> {
        let mut models = Vec::new();

        // Skip manifest and blob directories to avoid duplicate detection
        let skip_dirs = ["manifests", "blobs"];

        // Recursively scan ollama directory for GGUF files
        if let Ok(entries) = fs::read_dir(ollama_dir) {
            for entry in entries.flatten() {
                let pa
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #213** (2026-08-27): **Windows binary missing?**
  *Symptoms*: ### 🐛 Bug Description  Instructions in README (https://github.com/Michael-A-Kuykendall/shimmy/blob/main/README.md) quick-start and Windows build instructions are incorrect.  I get the following error trying to download the Windows binary: > A parameter cannot be found that matches parameter name 'L'.  Also, the binary is missing.  ### 🔄 Steps to Reproduce  1. Follow install instructions for Windows. 2. Unable to download Windows binary.  ### ✅ Expected Behavior  Windows binary could be downloaded.  ### ❌ Actual Behavior  Windows binary cannot be downloaded (incorrect argument to curl in Windows; binary missing).  ### 📦 Shimmy Version  Latest (main branch)  ### 💻 Operating System  Windows  ### 📥 Installation Method  Pre-built binary from releases  ### 🌍 Environment Details  _No response_  ### 📋 Logs/Error Messages  ```text  ```  ### 📝 Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hey @fredrikbaberg!  Thanks for the detailed report, and apologies for the slow turnaround on this one. You were right on every count, and it turned out to be two separate problems, both now fixed.  1. The broken download command. The docs used curl -L, but on Windows, PowerShell aliases curl to Invoke-WebRequest, which has no -L flag; that's exactly why you saw "A parameter cannot be found that matches parameter name 'L'." The quick-start now uses curl.exe explicitly (the real curl that ships with Windows 10+), so it works in PowerShell. Correct command:  ``` powershell curl.exe -L https://github.com/Michael-A-Kuykendall/shimmy/releases/latest/download/shimmy-windows-x86_64.exe -o shimmy.exe .\shimmy.exe --version ```  2. The binary was genuinely missing. This was the bigger one; my release CI pipeline had a bug that was silently swallowing the platform binaries. The Create Release job was failing to upload assets on every tag run, so releases only ever got a bare shimmy file and neve

- **Issue #210** (2026-07-27): **Compile errors when running `cargo install`**
  *Symptoms*: ### 🐛 Bug Description  The current state on `main`, as well as the version 2.3.1 published to crates.io, fail to perform `cargo install`.  This happens for me with rust 1.96.1  ### 🔄 Steps to Reproduce  1. Run either `cargo install --path . --locked` with current `main` (f49eee99e8fb77507d8045d852586e2021cb959b), or run `cargo install --locked shimmy@2.3.1` 2. See compile errors when attempting to build the `airframe` dependency.   ### ✅ Expected Behavior  Should build just fine.  ### ❌ Actual Behavior  Compiler error is printed and the build fails (see errors below).  ### 📦 Shimmy Version  Latest (main branch)  ### 💻 Operating System  Linux (other)  ### 📥 Installation Method  cargo install shimmy  ### 🌍 Environment Details  - Rust version: `rustc 1.97.1 (8bab26f4f 2026-07-14)` installed through `rustup` - Debian 13  ### 📋 Logs/Error Messages  ```text error[E0433]: cannot find `quant_formula` in `airframe_observe`    --> /home/user/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/airframe-0.2.11/src/core/routing.rs:224:27     | 224 |         airframe_observe::quant_formula::slot_for_type(quant_type).map(|s| s.as_u32())     |                           ^^^^^^^^^^^^^ could not find `quant_formula` in `airframe_observe`  error[E0433]: cannot find `quant_formula` in `airframe_observe`    --> /home/user/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/airframe-0.2.11/src/backend/bindless/pipeline/mod.rs:131:23     | 131 |     airframe_observe::quant_formula::slot_for
  **Post-Mortem & Fix Analysis**:
  > Looks like v2.3.3 is working.

- **Issue #206** (2026-07-20): **Airframe GPU load failed: Model file (12083 MB) exceeds this GPU's storage buffer binding limit (2048 MB).**
  *Symptoms*: ### 🐛 Bug Description  🎯 Shimmy v2.1.0 🔧 Backend: Airframe (GPU) 📦 Models: 0 available 💡 Tip: add --kv-quant int4 to enable TurboShimmy (INT4 KV, ~60% less VRAM) 🚀 Starting server on 127.0.0.1:11435 📦 Models: 4 available ✅ Ready to serve requests    • POST /api/generate (streaming + non-streaming)    • GET  /health (health check + metrics)    • GET  /v1/models (OpenAI-compatible) 2026-06-05T03:04:30.198248Z ERROR shimmy::openai_compat: Failed to load model 'gemma-4-12b-it-q8-0': Airframe GPU load failed: Model file (12083 MB) exceeds this GPU's storage buffer binding limit (2048 MB). Try a more quantized model or update your GPU drivers.  ### 🔄 Steps to Reproduce  ./shimmy serve --model-dirs ~/modelscope/ 🎯 Shimmy v2.1.0 🔧 Backend: Airframe (GPU) 📦 Models: 0 available 💡 Tip: add --kv-quant int4 to enable TurboShimmy (INT4 KV, ~60% less VRAM) 🚀 Starting server on 127.0.0.1:11435 📦 Models: 4 available ✅ Ready to serve requests    • POST /api/generate (streaming + non-streaming)    • GET  /health (health check + metrics)    • GET  /v1/models (OpenAI-compatible)  another bash to call:  curl -s http://127.0.0.1:11435/v1/chat/completions   -H 'Content-Type: application/json'   -d '{         "model":"gemma-4-12b-it-q8-0",         "messages":[{"role":"user","content":"Say hi in 5 words."}],         "max_tokens":1024       }'  ### ✅ Expected Behavior  It should be OK  ### ❌ Actual Behavior  It leave an error message to me. and never response to curl.  ### 📦 Shimmy Versi
  **Post-Mortem & Fix Analysis**:
  > I also encountered the same problem. The "shimmy gpu-info" command couldn't find the dedicated graphics card. It seems that the integrated graphics were being used.
  > +1
  > I have this bug too. doesn't use dedicated GPU, shimmy tries to load model into Intel cpu's dedicated card

- **Issue #205** (2026-06-01): **Airframe GPU backend panics with wgpu Validation Error on TinyLlama Q4_0 GGUF**
  *Symptoms*: ### 🐛 Bug Description  Running Shimmy v2.0.1 with the Airframe GPU backend on a TinyLlama Q4_0 GGUF model causes a `wgpu` validation panic during generation.  The log also reports missing norm tensors for every layer:  - `blk.N.post_attention_norm.weight` - `blk.N.post_ffw_norm.weight`  However, the GGUF metadata contains the Llama-style tensor names:  - `blk.N.attn_norm.weight` - `blk.N.ffn_norm.weight`  So this may be related to tensor-name handling in the preflight norm extraction path, or to a later GPU buffer/staging failure.   ### 🔄 Steps to Reproduce  1. Use Shimmy v2.0.1 on Windows with the Airframe GPU backend. 2. Put `tinyllama-1.1b-chat-v1.0.Q4_0.gguf` under `./models`. 3. Run:  ```powershell .\shimmy.exe serve ``` 4.Trigger generation, or run: ```powershell .\shimmy.exe generate --prompt "Hi" tinyllama-1.1b-chat-v1.0.q4-0 ```  ### ✅ Expected Behavior  Shimmy should load the GGUF model and complete generation without panicking.  If this model/tensor layout is not supported, Shimmy should return a clear compatibility error instead of crashing inside wgpu.  ### ❌ Actual Behavior  The model metadata is scanned and uploaded to VRAM, but the server run panics with a wgpu validation error: ``` Shimmy v2.0.1 Backend: Airframe (GPU)  [Metadata] general.architecture = llama [Metadata] general.name = tinyllama_tinyllama-1.1b-chat-v1.0 [Metadata] llama.context_length = 2048 [Metadata] llama.embedding_length = 2048 [Metadata] llama.block_count = 22 [Metadata] llama.feed_forw
  **Post-Mortem & Fix Analysis**:
  > Fixed in airframe v0.2.1 (commit 753c0aa), shipped with Shimmy v2.1.0.  **Root cause**: wgpu 27 changed how it reports max_buffer_size on older/lower-end GPUs. On a GTX 1050 Ti (and similar), the reported limit is smaller than what airframe was requesting for its staging buffer during the prefill phase, causing a panic before any inference started.  **What was fixed:**  1. Pre-flight guard — airframe now reads device.limits().max_buffer_size at startup and validates the staging buffer allocation against it before attempting to create the buffer. If the request would exceed the limit, it clamps the chunk size and logs a [PREFILL_SANITY] warning rather than panicking. 2. Norm warning suppression — a secondary wgpu validation warning about buffer sizes on this GPU class was being surfaced as an error; it's now correctly filtered.  **To update:**  ```rust # Cargo.toml airframe = "0.2.1" ```   Or if you're using Shimmy directly:  ```rust cargo install shimmy  # pulls airframe 0.2.1 as a dep

- **Issue #201** (2026-08-03): **docker-compose.yaml**
  *Symptoms*: Fixed: Docker image now builds with --features airframe,huggingface instead of --features huggingface only. The llama feature was removed in v2.0 (empty stub). The airframe GPU backend is required for GGUF model support. deploy/Dockerfile and Dockerfile both updated. Root cause: Docker builds excluded the airframe feature, causing GGUF models to fail with 'llama feature not enabled' error.
  **Post-Mortem & Fix Analysis**:
  > Current Docker image path is HuggingFace-oriented and the GGUF expectation can be confusing. I am updating docs and messaging so supported Docker usage is explicit, and keeping this open until that clarification lands.
  > Thanks for the docker-compose example! Note that the `shimmy_integration/` directory already has a Dockerfile. With **shimmy 2.0.1**, the container image is much simpler — no cmake, no llama.cpp build deps, just Rust + wgpu. We'll add a docker-compose example to the docs. ���
  > docker logs  `shimmy: /lib/x86_64-linux-gnu/libc.so.6: version 'GLIBC_2.39' not found (required by shimmy)`  #173   docker image version: [2.0](https://github.com/Michael-A-Kuykendall/shimmy/pkgs/container/shimmy) ghcr.io/michael-a-kuykendall/shimmy@sha256:8a81cd993f189daaa981b49833c9534faee9bd2cc246f95e65fa41e38c5ab04d

- **Issue #200** (2026-05-26): **gguf_init_from_file: failed to open GGUF file './models/phi3-mini.gguf'**
  *Symptoms*: ### 🐛 Bug Description  ``` ./shimmy-macos-intel serve &                   [1] 14955 ➜  Downloads 🎯 Shimmy v1.9.0 🔧 Backend: CPU (no GPU acceleration) 📦 Models: 0 available 🚀 Starting server on 127.0.0.1:11435 📦 Models: 1 available ✅ Ready to serve requests    • POST /api/generate (streaming + non-streaming)    • GET  /health (health check + metrics)    • GET  /v1/models (OpenAI-compatible)  ./shimmy-macos-intel list 📋 Registered Models:   phi3-lora => "./models/phi3-mini.gguf"  ✅ Total available models: 1  curl -s http://127.0.0.1:11435/v1/chat/completions \   -H 'Content-Type: application/json' \   -d '{         "model":"REPLACE_WITH_MODEL_FROM_list",         "messages":[{"role":"user","content":"Say hi in 5 words."}],         "max_tokens":32       }' | jq -r '.choices[0].message.content' null ➜  Downloads curl -s http://127.0.0.1:11435/v1/chat/completions \   -H 'Content-Type: application/json' \   -d '{         "model":"phi3-lora",                            "messages":[{"role":"user","content":"Say hi in 5 words."}],         "max_tokens":32       }' | jq -r '.choices[0].message.content' ggml_metal_library_init: using embedded metal library ggml_metal_library_init: loaded in 16.154 sec ggml_metal_device_init: GPU name:   Intel(R) Iris(TM) Graphics 6100 ggml_metal_device_init: GPU family: MTLGPUFamilyCommon2 (3002) ggml_metal_device_init: simdgroup reduction   = false ggml_metal_device_init: simdgroup matrix mul. = false ggml_metal_device_init: has unified memory    
  **Post-Mortem & Fix Analysis**:
  > Hey @tiansiyuan — this error comes from llama.cpp's file loader, which no longer exists in Shimmy v2.0. I've replaced the entire llama.cpp backend with Airframe, my own pure-Rust WebGPU inference engine that reads GGUF files natively.  A couple things to check with the new version:  Make sure you're pointing at the right path — SHIMMY_BASE_GGUF=/absolute/path/to/your-model.gguf or pass --model-path directly Run shimmy list to confirm the model was found before making requests If you're on Intel Mac, grab the new shimmy-macos-intel binary from the v2.0 release — it includes the Airframe engine built in Closing this out since the underlying error source (llama.cpp) is gone in v2.0. Drop a comment if it's still giving you trouble with the new binary and I'll dig in.
  > Hi @Michael-A-Kuykendall Release v2.0.0 will soon be available?
  > <img width="818" height="460" alt="Image" src="https://github.com/user-attachments/assets/13e4794a-d3fe-46ab-b860-ff127f28ddc8" />  I tried to compile but met some error, which I will report in a separate issue.

- **Issue #191** (2026-05-26): **[Bug]: 422 Unprocessable Entity when message content is sent as array (multi-part) instead of string**
  *Symptoms*: ### 🐛 Bug Description  Context: Zed editor using the openai_compatible provider pointed at Shimmy. When attaching a file via @filename in the Agent Panel, Zed sends the OpenAI multi-part content array format (per the [OpenAI Chat Completions spec](https://platform.openai.com/docs/api-reference/chat/create)). Shimmy rejects this with a 422.  Error message received:  ``` HTTP response error from Shimmy's API: status 422 Unprocessable Entity -  "Failed to deserialize the JSON body into the target type:  messages[1].content: invalid type: sequence, expected a string at line 1 column 7254" ```  Root cause: Shimmy's message deserializer only accepts content as a String, but the OpenAI spec allows content to be either a String or an array of content parts (text, image_url, etc.). This is the standard format used by Zed, Cursor, Continue, and other clients when attaching file context.  Request: Support the OpenAI-spec union type for content: content: string | array<{ type: "text"|"image_url", text: string, ... }>      ### 🔄 Steps to Reproduce  ```bash curl -s http://127.0.0.1:11435/v1/chat/completions   -H 'Content-Type: application/json'   -d '{     "model": "qwen-qwen3-14b-q4-k-m",     "messages": [       {         "role": "system",         "content": "You are a helpful assistant."       },       {         "role": "user",         "content": [           {             "type": "text",             "text": "How do I specify the terraform version in this file?"           },           {
  **Post-Mortem & Fix Analysis**:
  > @jeffbski — this one's fixed. You were totally right, the OpenAI spec allows content to be either a string or an array of content parts, and I was only accepting string. Zed's file attachment behavior was perfectly valid and I was the one out of spec.  The fix is in v2.0 — src/openai_compat.rs now deserializes both formats correctly and I've added a regression test specifically for this so it can't quietly break again. If you're using Zed with file attachments, grab the v2.0 binary and it should work without any workaround.  Thanks for the detailed report — the exact error message made this a fast fix.

- **Issue #190** (2026-05-26): **Cannot using gpu?**
  *Symptoms*: ### 🐛 Bug Description  look at the screenshot, why?  <img width="1115" height="761" alt="Image" src="https://github.com/user-attachments/assets/09927e8f-b584-443d-b423-c96645e5dd19" />  ### 🔄 Steps to Reproduce  os is windows 11. shimmy is from https://github.com/Michael-A-Kuykendall/shimmy/releases/tag/v1.9.0  ### ✅ Expected Behavior  GPU can be used.  ### ❌ Actual Behavior  🔧 llama.cpp Backend: CPU 📋 Available GPU Features:   ❌ CUDA support disabled   ❌ Vulkan support disabled   ❌ OpenCL support disabled 🍎 MLX Backend: Disabled (compile with --features mlx)  ### 📦 Shimmy Version  Latest (main branch)  ### 💻 Operating System  Windows  ### 📥 Installation Method  Pre-built binary from releases  ### 🌍 Environment Details  _No response_  ### 📋 Logs/Error Messages  ```text  ```  ### 📝 Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hey @sunisstar — in v1.9.0 you had to build with explicit CUDA/Vulkan flags to get GPU support, which was a real pain and caught a lot of people off guard.  v2.0 changes this completely. I've replaced the llama.cpp GPU stack with Airframe, which uses WebGPU (wgpu) and automatically detects your GPU at runtime — no special build flags, no CUDA toolkit, no Vulkan SDK. On Windows it picks up your GPU through Direct3D 12 or Vulkan, whichever your driver supports.  Grab the v2.0 binary, run shimmy gpu-info and you should see your GPU listed. If it still shows CPU-only, drop the output of shimmy gpu-info here (reopen issue if needed) and I'll figure out what's going on with your driver config.

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

### Incident Patch 1: `b7b97737` (2026-08-30)
**Commit Message**: fix(api): reject unsupported multimodal requests

**File**: `docs/quickstart.md` (modified, +4/-4)
```diff
@@ -34,10 +34,10 @@ GPU detection is automatic — on first launch Airframe selects the best adapter
 > *"A parameter cannot be found that matches parameter name 'L'."* — always call
 > `curl.exe` explicitly.
 >
-> **Available binaries:** the current release matrix publishes `shimmy-linux-x86_64`,
-> `shimmy-windows-x86_64.exe`, and `shimmy-macos-arm64`. If a listed binary for your
-> platform is not present on the latest release, run `shimmy --version` to confirm,
-> then file an issue.
+> **Available binaries:** the release workflow builds `shimmy-linux-x86_64`,
+> `shimmy-windows-x86_64.exe`, and `shimmy-macos-arm64`. If a platform asset is
+> missing from a release, install from crates.io with `cargo install shimmy` or
+> build from source using the instructions below.
 
 ### Build from Source / `cargo install`
 
```

**File**: `src/anthropic_compat.rs` (modified, +41/-0)
```diff
@@ -119,11 +119,34 @@ impl From<AnthropicMessage> for ChatMessage {
     }
 }
 
+fn contains_unsupported_media(messages: &[AnthropicMessage]) -> bool {
+    messages.iter().any(|message| {
+        matches!(
+            &message.content,
+            AnthropicContent::Blocks(blocks)
+                if blocks.iter().any(|block| block.content_type != "text")
+        )
+    })
+}
+
 /// Anthropic Messages API endpoint: POST /v1/messages
 pub async fn messages(
     State(state): State<Arc<AppState>>,
     Json(req): Json<AnthropicMessageRequest>,
 ) -> impl IntoResponse {
+    if contains_unsupported_media(&req.messages) {
+        return (
+            axum::http::StatusCode::BAD_REQUEST,
+            Json(serde_json::json!({
+                "error": {
+                    "type": "invalid_request_error",
+                    "message": "multimodal content is not supported by this build"
+                }
+            })),
+        )
+            .into_response();
+    }
+
     // Convert Anthropic format to our internal format
     let internal_messages: Vec<ChatMessage> =
         req.messages.into_iter().map(|msg| msg.into()).collect();
@@ -309,6 +332,24 @@ mod tests {
         assert_eq!(chat_msg.content, "Hello\nWorld");
     }
 
+    #[test]
+    fn test_unsupported_media_is_detected() {
+        let messages = vec![AnthropicMessage {
+            role: "user".to_string(),
+            content: AnthropicContent::Blocks(vec![ContentBlock {
+                content_type: "image".to_string(),
+                text: None,
+                source: Some(ImageSource {
+                    source_type: "base64".to_string(),
+                    media_type: "image/png".to_string(),
+                    data: "dGVzdA==".to_string(),
+                }),
+            }]),
+        }];
+
+        assert!(contains_unsupported_media(&messages));
+    }
+
     #[test]
     fn test_extract_system_and_pairs() {
         let messages = vec![
```

**File**: `src/openai_compat/mod.rs` (modified, +1274/-1256)
```diff
@@ -1,1256 +1,1274 @@
-mod types;
-pub use types::*;
-
-use crate::AppState;
-use axum::{extract::State, response::IntoResponse, Json};
-use std::sync::Arc;
-
-/// Ollama-compatible GET /api/tags endpoint.
-/// AnythingLLM, SillyTavern, Zed, and Open WebUI discover models via this route
-/// rather than (or in addition to) /v1/models.
-pub async fn api_tags(State(state): State<Arc<AppState>>) -> impl IntoResponse {
-    #[derive(serde::Serialize)]
-    struct TagsResponse {
-        models: Vec<OllamaModel>,
-    }
-    #[derive(serde::Serialize)]
-    struct OllamaModel {
-        name: String,
-        model: String,
-        modified_at: String,
-        size: u64,
-        digest: String,
-        details: OllamaDetails,
-    }
-    #[derive(serde::Serialize)]
-    struct OllamaDetails {
-        format: String,
-        family: String,
-        parameter_size: String,
-        quantization_level: String,
-    }
-
-    let models = state
-        .registry
-        .list_all_available()
-        .into_iter()
-        .map(|name| OllamaModel {
-            model: name.clone(),
-            name,
-            modified_at: "2025-01-01T00:00:00Z".to_string(),
-            size: 0,
-            digest: "".to_string(),
-            details: OllamaDetails {
-                format: "gguf".to_string(),
-                family: "".to_string(),
-                parameter_size: "".to_string(),
-                quantization_level: "".to_string(),
-            },
-        })
-        .collect();
-
-    Json(TagsResponse { models })
-}
-
-pub async fn models(State(state): State<Arc<AppState>>) -> impl IntoResponse {
-    let models = state
-        .registry
-        .list_all_available()
-        .into_iter()
-        .map(|name| ListModel {
-            id: name,
-            object: "model".to_string(),
-            created: std::time::SystemTime::now()
-                .duration_since(std::time::UNIX_EPOCH)
-                .unwrap_or_default()
-                .as_secs(),
-            owned_by: "shimmy".to_string(),
-        })
-        .collect();
-
-    Json(ModelsResponse {
-        object: "list".to_string(),
-        data: models,
-    })
-}
-
-pub async fn chat_completions(
-    State(state): State<Arc<AppState>>,
-    Json(req): Json<ChatCompletionRequest>,
-) -> impl IntoResponse {
-    use axum::http::StatusCode;
-
-    // Input validation
-    if req.messages.is_empty() {
-        return (
-            StatusCode::BAD_REQUEST,
-            Json(serde_json::json!({
-                "error": {
-                    "message": "messages must not be empty",
-                    "type": "invalid_request_error",
-                    "param": "messages",
-                    "code": "invalid_messages"
-                }
-            })),
-        )
-            .into_response();
-    }
-    if let Some(max_tok) = req.max_tokens {
-        if max_tok == 0 || max_tok > 131_072 {
-            return (
-                StatusCode::BAD_REQUEST,
-                Json(serde_json::json!({
-                    "error": {
-                        "message": "max_tokens must be between 1 and 131072",
-                        "type": "invalid_request_error",
-                        "param": "max_tokens",
-                        "code": "invalid_max_tokens"
-                    }
-                })),
-            )
-                .into_response();
-        }
-    }
-
-    // Load and validate model
-    let Some(spec) = state.registry.to_spec(&req.model) else {
-        tracing::warn!("Model '{}' not found in registry", req.model);
-        let available_models = state.registry.list_all_available();
-        let error_response = serde_json::json!({
-            "error": {
-                "message": format!("Model '{}' not found. Available models: {:?}", req.model, available_models),
-                "type": "invalid_r
```

**File**: `src/openai_compat/types.rs` (modified, +8/-0)
```diff
@@ -34,6 +34,13 @@ impl MessageContent {
                 .join("\n"),
         }
     }
+
+    pub fn has_unsupported_media(&self) -> bool {
+        match self {
+            MessageContent::Text(_) => false,
+            MessageContent::Parts(parts) => parts.iter().any(|part| part.part_type != "text"),
+        }
+    }
 }
 
 #[derive(Debug, Deserialize)]
@@ -284,6 +291,7 @@ mod tests {
             },
         ]);
         assert_eq!(content.as_text(), "only");
+        assert!(content.has_unsupported_media());
     }
 
     #[test]
```

---

### Incident Patch 2: `e36f7f98` (2026-08-28)
**Commit Message**: chore: gitignore .cargo/ (dev patch config) — prevents local airframe/shimmyjinja path patches from leaking

The .cargo/config.toml holds the local [patch.crates-io] overrides (airframe ->
../airframe, shimmyjinja -> local) used only in development. Ignoring it keeps
the dev-only patch out of the public tree (deploy.sh manages the airframe patch
separately for release).

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -159,3 +159,4 @@ AGENTS.md
 .agents/
 .beads/
 .skip-ci-tests
+.cargo/
```

---

### Incident Patch 3: `e9b99d26` (2026-08-28)
**Commit Message**: feat(template): wire engine/generate/CLI to prompt_render (fixes cert path) (oqu.4)

The CLI/cert path (shimmy generate -> engine/airframe.rs) previously fed the
prompt RAW to rt.generate, so instruct models got no chat template (the
garbled-output / false-RED root cause). Now:

- engine/airframe.rs generate: wraps the prompt via
  render_completion_prompt_with_extras using rt.chat_template() (real GGUF
  Jinja), family_from_spec fallback, opts.raw_prompt escape, and real
  bos/eos strings resolved from the tokenizer (token_to_piece) for
  {{ bos_token }}/{{ eos_token }} template vars. Uses spec().model_name for
  the Qwen/DeepSeek thinking heuristic.
- --raw (opts.raw_prompt, added in oqu.1) bypasses the template.

FUNCTIONAL PROOF (real GPU, qwen3-0.6b):
- templated: 36 tokens prefilled (full Qwen3 ChatML system+user+gen wrap)
- --raw:      5 tokens prefilled (raw prompt)
- 0 NaN logits both ways; NVIDIA adapter selected.

Tests: 625 pass, 0 fail. clippy -D warnings clean, fmt clean.

**File**: `src/engine/airframe.rs` (modified, +32/-1)
```diff
@@ -95,7 +95,35 @@ impl LoadedModel for AirframeModel {
                 wrapper
             });
 
-            rt.generate(&prompt, &params, callback, control, modify_logits, trace_cb)
+            // Apply the model's chat template (Jinja-first) so instruct models are
+            // NOT fed a raw prompt (the cert-path fix). The engine's `generate`
+            // receives a bare completion prompt; wrap it with the GGUF template
+            // unless --raw (opts.raw_prompt) or the model has no template (base).
+            let model_name = rt.spec().model_name.clone();
+            let gguf_tpl = rt.chat_template().map(|s| s.to_string());
+            let mut extras = crate::prompt_render::JinjaExtras::for_model(&model_name);
+            // Resolve real bos/eos strings from the tokenizer for template vars.
+            let tok = rt.tokenizer_arc();
+            extras.bos_token = tok.token_to_piece(tok.bos_token()).ok();
+            extras.eos_token = tok.token_to_piece(tok.eos_token()).ok();
+            let fam = crate::prompt_render::family_from_spec(None, &model_name);
+            let rendered = crate::prompt_render::render_completion_prompt_with_extras(
+                &prompt,
+                gguf_tpl.as_deref(),
+                fam,
+                opts.raw_prompt,
+                &extras,
+            );
+            let final_prompt = rendered.text;
+
+            rt.generate(
+                &final_prompt,
+                &params,
+                callback,
+                control,
+                modify_logits,
+                trace_cb,
+            )
         })
         .await
         .map_err(|e| anyhow::anyhow!("Airframe task panicked: {}", e))?
@@ -152,6 +180,7 @@ mod tests {
             math_bypass: false,
             trace_path: String::new(),
             session_id: String::new(),
+            raw_prompt: false,
         };
         let p = AirframeModel::bridge_params(&opts);
         assert_eq!(p.max_tokens, 128);
@@ -171,6 +200,7 @@ mod tests {
             math_bypass: false,
             trace_path: String::new(),
             session_id: String::new(),
+            raw_prompt: false,
             ..GenOptions::default()
         };
         let p = AirframeModel::bridge_params(&opts);
@@ -188,6 +218,7 @@ mod tests {
             math_bypass: false,
             trace_path: String::new(),
             session_id: String::new(),
+            raw_prompt: false,
             ..GenOptions::default()
         };
         let p = AirframeModel::bridge_params(&opts);
```

---

### Incident Patch 4: `dd4308f1` (2026-08-27)
**Commit Message**: fix(release): publish platform binaries + fix Windows download command (#213)

- Grant the Create Release job 'contents: write' (was failing with
  'HTTP 403: Resource not accessible by integration', so no platform
  binaries were ever attached to releases).
- Preserve documented artifact names (shimmy-linux-x86_64,
  shimmy-windows-x86_64.exe, shimmy-macos-arm64) instead of copying by
  basename, which collided linux + mac (both 'shimmy').
- Docs: use curl.exe -L on Windows (PowerShell aliases 'curl' to
  Invoke-WebRequest, which has no -L flag) and note which binaries the
  matrix publishes.

**File**: `.github/workflows/release.yml` (modified, +10/-1)
```diff
@@ -41,6 +41,8 @@ jobs:
     name: Create Release
     needs: [build]
     runs-on: ubuntu-latest
+    permissions:
+      contents: write
     steps:
     - uses: actions/checkout@v5
     - name: Download all artifacts
@@ -52,7 +54,14 @@ jobs:
         GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       run: |
         mkdir -p dist
-        find release-files -type f -exec cp {} dist/ \;
+        # Preserve the documented artifact name (upload-artifact dir name == final name).
+        # Copying by basename alone collides (linux + mac are both "shimmy").
+        for d in release-files/*/; do
+          [ -d "$d" ] || continue
+          for f in "$d"*; do
+            [ -f "$f" ] && cp "$f" "dist/$(basename "$d")"
+          done
+        done
         if gh release view ${{ github.ref_name }} > /dev/null 2>&1; then
           gh release upload ${{ github.ref_name }} dist/* --clobber
         else
```

**File**: `docs/quickstart.md` (modified, +12/-1)
```diff
@@ -10,7 +10,7 @@ Pick your platform — all binaries use automatic WebGPU (wgpu) GPU detection:
 
 ```bash
 # Windows x64
-curl -L https://github.com/Michael-A-Kuykendall/shimmy/releases/latest/download/shimmy-windows-x86_64.exe -o shimmy.exe
+curl.exe -L https://github.com/Michael-A-Kuykendall/shimmy/releases/latest/download/shimmy-windows-x86_64.exe -o shimmy.exe
 
 # Linux x86_64
 curl -L https://github.com/Michael-A-Kuykendall/shimmy/releases/latest/download/shimmy-linux-x86_64 -o shimmy && chmod +x shimmy
@@ -28,6 +28,17 @@ curl -L https://github.com/Michael-A-Kuykendall/shimmy/releases/latest/download/
 GPU detection is automatic — on first launch Airframe selects the best adapter
 (discrete GPU preferred over integrated, integrated over CPU fallback).
 
+> **Windows / PowerShell:** the command above uses `curl.exe` (the real curl that
+> ships with Windows 10+). In PowerShell, bare `curl` is an alias for
+> `Invoke-WebRequest`, which has no `-L` flag and will fail with
+> *"A parameter cannot be found that matches parameter name 'L'."* — always call
+> `curl.exe` explicitly.
+>
+> **Available binaries:** the current release matrix publishes `shimmy-linux-x86_64`,
+> `shimmy-windows-x86_64.exe`, and `shimmy-macos-arm64`. If a listed binary for your
+> platform is not present on the latest release, run `shimmy --version` to confirm,
+> then file an issue.
+
 ### Build from Source / `cargo install`
 
 ```bash
```

---

### Incident Patch 5: `7335ee3b` (2026-08-27)
**Commit Message**: docs: badges, free-forever promise, Support section; fix dead MOE roadmap link

**File**: `README.md` (modified, +31/-2)
```diff
@@ -6,17 +6,23 @@
   ### 🔒 The 5MB alternative to Ollama — 100% Rust, zero dependencies 🚀
 
   [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
+  [![Security](https://img.shields.io/badge/Security-Audited-green)](https://github.com/Michael-A-Kuykendall/shimmy/security)
   [![CI](https://github.com/Michael-A-Kuykendall/shimmy/actions/workflows/ci.yml/badge.svg)](https://github.com/Michael-A-Kuykendall/shimmy/actions/workflows/ci.yml)
   [![Crates.io](https://img.shields.io/crates/v/shimmy.svg)](https://crates.io/crates/shimmy)
   [![Downloads](https://img.shields.io/crates/d/shimmy.svg)](https://crates.io/crates/shimmy)
   [![Rust](https://img.shields.io/badge/rust-stable-brightgreen.svg)](https://rustup.rs/)
   [![GitHub Stars](https://img.shields.io/github/stars/Michael-A-Kuykendall/shimmy?style=social)](https://github.com/Michael-A-Kuykendall/shimmy/stargazers)
+  [![💝 Sponsor this project](https://img.shields.io/badge/💝_Sponsor_this_project-ea4aaa?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/Michael-A-Kuykendall)
+  [![Trans rights](https://pride-badges.pony.workers.dev/static/v1?label=trans%20rights&stripeWidth=6&stripeColors=5BCEFA,F5A9B8,FFFFFF,F5A9B8,5BCEFA)](https://translifeline.org/)
+  [![LGBTQ+ friendly](https://pride-badges.pony.workers.dev/static/v1?label=lgbtq%2B%20friendly&stripeWidth=6&stripeColors=E40303,FF8C00,FFED00,008026,24408E,732982)](https://www.thetrevorproject.org/)
 
   **Languages:** [简体中文](docs/zh-CN/README.md) · [繁體中文](docs/zh-TW/README.md)
 </div>
 
 Shimmy is independently maintained and free forever. [Sponsorship](https://github.com/sponsors/Michael-A-Kuykendall) funds certification, compatibility work, and releases.
 
+**Shimmy will be free forever.** No asterisks. No "free for now." No pivot to paid.
+
 ---
 
 ## What Is Shimmy?
@@ -75,6 +81,7 @@ Shimmy is a **single-binary** OpenAI-compatible inference server for GGUF models
 - **🔧 [Extended Context](docs/EXTENDED_CONTEXT.md)** — YaRN RoPE scaling via `SHIMMY_MAX_CTX`.
 - **📦 [Migrating from v1.x](docs/MIGRATION_v2.md)** — llama.cpp, MLX, HuggingFace, and RustChain backends removed in v2.0+. Shimmy is now a pure Airframe product.
 - **🏆 Certification** — Every model passes a 3-box certification regimen (MATH + INFERENCE + DETERMINISM). See [docs/CERTIFICATION.md](docs/CERTIFICATION.md).
+- **🧠 MOE support** — Mixture-of-Experts CPU offloading is on the Airframe roadmap.
 
 ---
 
@@ -145,9 +152,21 @@ See [docs/ppt-invariant-testing.md](docs/ppt-invariant-testing.md) for technical
 - **💬 Discussions**: [GitHub Discussions](https://github.com/Michael-A-Kuykendall/shimmy/discussions)
 - **📖 Security**: [Security Policy](https://github.com/Michael-A-Kuykendall/shimmy/security)
 
+### Star History
+
+[![Star History Chart](https://api.star-history.com/svg?repos=Michael-A-Kuykendall/shimmy&type=Timeline)](https://www.star-history.com/#Michael-A-Kuykendall/shimmy&Timeline)
+
+### 🚀 Momentum Snapshot
+
+🌟 **![GitHub stars](https://img.shields.io/github/stars/Michael-A-Kuykendall/shimmy?style=flat&color=yellow) stars and climbing fast**
+⏱ **<1s startup**
+🦀 **100% Rust, no Python**
+
 ### 📰 As Featured On
 
-🔥 [**Hacker News**](https://news.ycombinator.com/item?id=45130322) · [**IPE Newsletter**](https://ipenewsletter.substack.com/p/the-strange-new-side-hustles-of-openai)
+🔥 [**Hacker News**](https://news.ycombinator.com/item?id=45130322) · [**Front Page Again**](https://news.ycombinator.com/item?id=45199898) · [**IPE Newsletter**](https://ipenewsletter.substack.com/p/the-strange-new-side-hustles-of-openai)
+
+**Companies**: Need invoicing? Email [michaelallenkuykendall@gmail.com](mailto:michaelallenkuykendall@gmail.com)
 
 ---
 
@@ -181,6 +200,8 @@ Shimmy is independently maintained. Sponsorship funds certification, compatibili
 
 MIT License — see [LICENSE](LICENSE). **Shimmy will be free forever.**
 
+**Promise**: This will never become a 
```

---

### Incident Patch 6: `697111d2` (2026-08-26)
**Commit Message**: fix(Dockerfile): use debian:trixie-slim for glibc 2.39+ compat

Smoke test failed: bookworm's glibc 2.36 too old for the binary
(which needs 2.39). Trixie has glibc 2.39.

**File**: `deploy/Dockerfile` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@ COPY src ./src
 # Build release binary with full GPU support (airframe engine)
 RUN cargo build --release --features airframe
 
-# Runtime image
-FROM debian:bookworm-slim
+# Runtime image — trixie for glibc 2.39+ (matches rust:slim builder)
+FROM debian:trixie-slim
 
 # Install runtime dependencies
 RUN apt-get update && apt-get install -y \
```

---

### Incident Patch 7: `d413b8c5` (2026-08-26)
**Commit Message**: fix(Dockerfile): remove huggingface feature, correct port to 11435

**File**: `deploy/Dockerfile` (modified, +5/-5)
```diff
@@ -21,8 +21,8 @@ COPY templates ./templates
 # Copy source code
 COPY src ./src
 
-# Build release binary with full GPU support (airframe + huggingface)
-RUN cargo build --release --features airframe,huggingface
+# Build release binary with full GPU support (airframe engine)
+RUN cargo build --release --features airframe
 
 # Runtime image
 FROM debian:bookworm-slim
@@ -46,11 +46,11 @@ RUN mkdir -p /app/models && chown shimmy:shimmy /app/models
 USER shimmy
 
 # Expose port
-EXPOSE 11434
+EXPOSE 11435
 
 # Health check
 HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
-    CMD curl -f http://localhost:11434/health || exit 1
+    CMD curl -f http://localhost:11435/health || exit 1
 
 # Default command
-CMD ["shimmy", "serve", "--bind", "0.0.0.0:11434"]
+CMD ["shimmy", "serve", "--bind", "0.0.0.0:11435"]
```

---

### Incident Patch 8: `8ee9b770` (2026-08-26)
**Commit Message**: docs: fix shimmy README — doc index, sponsors, logo

- Doc index: add descriptions to every link, table format inside <details>
- Sponsors: add gqf2008 (3 total, was missing from README)
- Logo: use raw GitHub URL for Cargo rendering

**File**: `README.md` (modified, +9/-7)
```diff
@@ -1,5 +1,5 @@
 <div align="center">
-  <img src="assets/shimmy-logo.png" alt="Shimmy Logo" width="300" height="auto" />
+  <img src="https://raw.githubusercontent.com/Michael-A-Kuykendall/shimmy/main/assets/shimmy-logo.png" alt="Shimmy Logo" width="300" height="auto" />
 
   # Shimmy — Local Inference, OpenAI-Compatible
 
@@ -110,11 +110,13 @@ Full install, model acquisition, GPU, VRAM sizing, platform-specific builds: **[
 <details>
 <summary>Complete documentation index</summary>
 
-**Models & Performance:** [turboshimmy.md](docs/turboshimmy.md) · [EXTENDED_CONTEXT.md](docs/EXTENDED_CONTEXT.md) · [PERFORMANCE.md](docs/PERFORMANCE.md) · [MODEL_EXPANSION.md](docs/MODEL_EXPANSION.md)
-**API & Integration:** [API.md](docs/API.md) · [INTEGRATION.md](docs/INTEGRATION.md) · [EXAMPLES.md](docs/EXAMPLES.md) · [CROSS_COMPILATION.md](docs/CROSS_COMPILATION.md)
-**Engine:** [ARCHITECTURE.md](docs/ARCHITECTURE.md) · [GPU_PIPELINE.md](docs/GPU_PIPELINE.md) · [QUANTIZATION.md](docs/QUANTIZATION.md) · [CHAT_TEMPLATES.md](docs/CHAT_TEMPLATES.md)
-**Certification:** [CERTIFICATION.md](docs/CERTIFICATION.md) · [METHODOLOGY.md](docs/METHODOLOGY.md) · [REGRESSION_TESTING.md](docs/REGRESSION_TESTING.md) · [ppt-invariant-testing.md](docs/ppt-invariant-testing.md) · [METRICS.md](docs/METRICS.md)
-**FAQ:** [FAQ.md](docs/FAQ.md) · [FEATURES.md](docs/FEATURES.md) · [MIGRATION_v2.md](docs/MIGRATION_v2.md) · [WINDOWS_GPU_BUILD_GUIDE.md](docs/WINDOWS_GPU_BUILD_GUIDE.md)
+| Section | Documents |
+|---|---|
+| **Models & Performance** | [TurboShimmy](docs/turboshimmy.md) — INT4 KV cache compression · [Extended Context](docs/EXTENDED_CONTEXT.md) — YaRN RoPE scaling, VRAM math · [Performance](docs/PERFORMANCE.md) — Tuning and token/sec · [Model Expansion](docs/MODEL_EXPANSION.md) — Onboarding protocol |
+| **API & Integration** | [API Reference](docs/API.md) · [Integration Guides](docs/INTEGRATION.md) · [Examples](docs/EXAMPLES.md) · [Cross-Compilation](docs/CROSS_COMPILATION.md) |
+| **Engine** | [Architecture](docs/ARCHITECTURE.md) · [GPU Pipeline](docs/GPU_PIPELINE.md) · [Quantization](docs/QUANTIZATION.md) · [Chat Templates](docs/CHAT_TEMPLATES.md) |
+| **Certification** | [Certification](docs/CERTIFICATION.md) · [Methodology](docs/METHODOLOGY.md) · [Regression Testing](docs/REGRESSION_TESTING.md) · [PPT Testing](docs/ppt-invariant-testing.md) · [Metrics](docs/METRICS.md) |
+| **FAQ** | [FAQ](docs/FAQ.md) · [Features](docs/FEATURES.md) · [Migration](docs/MIGRATION_v2.md) · [Windows GPU](docs/WINDOWS_GPU_BUILD_GUIDE.md) |
 
 </details>
 
@@ -168,7 +170,7 @@ Shimmy is independently maintained. Sponsorship funds certification, compatibili
 - **$100/month**: Corporate backer 🏢 — Logo placement + release recognition
 - **$500/month**: Infrastructure partner 🚀 — Office hours + roadmap consultation
 
-**Current sponsors:** [ZephyrCloudIO](https://github.com/ZephyrCloudIO) · [alistairheath](https://github.com/alistairheath)
+**Current sponsors:** [ZephyrCloudIO](https://github.com/ZephyrCloudIO) · [gqf2008](https://github.com/gqf2008) · [alistairheath](https://github.com/alistairheath)
 
 [**🎯 Become a Sponsor**](https://github.com/sponsors/Michael-A-Kuykendall) · [Invoicing](mailto:michaelallenkuykendall@gmail.com)
 
```

---

### Incident Patch 9: `9498653e` (2026-08-24)
**Commit Message**: docs: enforce --release for all cargo clippy/build to avoid 18GB debug artifacts

**File**: `AGENTS.md` (modified, +4/-0)
```diff
@@ -30,6 +30,10 @@ airframe = { version = "0.2" }  ← PUBLIC crates.io dep — Airframe is Shimmy'
 `cargo test` must finish with 0 failures before any task is considered done.
 There is no such thing as a "pre-existing" failure. Fix it before moving on.
 
+**ALWAYS use `--release` for `cargo clippy` and `cargo build`.** Debug-profile builds
+produce ~18GB of artifacts in `target/debug/` that waste disk space. Never run bare
+`cargo clippy` or `cargo build` without `--release`.
+
 ## Architecture (v2.0)
 
 - **Engine**: wgpu/WebGPU WGSL pipeline via Airframe (crates.io: `airframe = "0.1"`). Replaces llama.cpp entirely.
```

---

### Incident Patch 10: `5420f9a6` (2026-06-07)
**Commit Message**: fix: strip legacy engine code, clean feature flags for v2.2 release

Removed:
- src/engine/huggingface.rs — Python subprocess bridge
- src/engine/universal.rs — llama+HF routing layer
- src/engine/mlx.rs — Apple MLX stub

Cleaned:
- src/engine/mod.rs: stripped to InferenceEngine + LoadedModel + ModelSpec + GenOptions
- src/engine/adapter.rs: airframe primary, safetensors fallback, no HF/MLX routing
- src/server.rs: features JSON now shows airframe only
- Cargo.toml: default = ["airframe"]; removed huggingface/mlx/full/gpu/apple features;
  llama* kept as empty deprecated stubs per AGENTS.md

Added:
- docs/v2-roadmap.md: HF Hub sourcing plan, strip sequence, docs sprint scope
- docs/zh-CN/README.md, docs/zh-TW/README.md: restored Chinese docs centers
- docs/USER_MANUAL.zh-CN.md, docs/USER_MANUAL.zh-TW.md: restored user manuals

cargo check: 0 warnings, 0 errors

(cherry picked from commit 1b661ad4e55a722bebe041f6b223f916f8d82415)

**File**: `Cargo.toml` (modified, +9/-11)
```diff
@@ -21,17 +21,16 @@ include = [
 ]
 
 [features]
-default = ["airframe", "huggingface"]  # Full GPU build; use --no-default-features --features huggingface for CPU-only
-# Engine backends
+default = ["airframe"]  # Airframe WebGPU engine; use --no-default-features for CPU-only
 airframe = ["dep:airframe"]  # Airframe native GPU engine
-huggingface = [] # Python integration, no additional Rust deps
-mlx = [] # Apple MLX integration for Metal GPU acceleration on Apple Silicon
-# Convenience feature sets
-fast = ["huggingface"] # Fast compilation - no path deps (CI-safe)
-full = ["airframe", "huggingface", "mlx"] # Full compilation - includes all backends
-gpu = ["airframe", "huggingface"] # GPU-optimized build via Airframe
-apple = ["airframe", "huggingface"] # Apple Silicon - Airframe via Metal + HuggingFace
-coverage = ["huggingface"] # Coverage testing - no path deps, fast compile
+# CI-safe build — no GPU hardware required
+fast = []
+coverage = []
+# Deprecated stubs — llama.cpp removed in v2.0
+llama = []
+llama-cuda = []
+llama-vulkan = []
+llama-opencl = []
 
 [dependencies]
 anyhow = "1"
@@ -102,4 +101,3 @@ name = "generation_performance"
 harness = false
 
 [workspace]
-
```

**File**: `docs/USER_MANUAL.zh-CN.md` (modified, +11/-30)
```diff
@@ -4,7 +4,7 @@
 
 ### 轻量级本地 AI 推理服务器，兼容 OpenAI API
 
-[📚 中文文档中心](zh-CN/README.md) · **简体中文手册** · [繁體中文](USER_MANUAL.zh-TW.md) · [English](../README.md)
+**简体中文** · [繁體中文](USER_MANUAL.zh-TW.md) · [English](../README.md)
 
 版本：v2.3.0 及以上 · 最后更新：2026 年 7 月
 
@@ -224,24 +224,16 @@ Shimmy 使用 **GGUF 格式**的模型文件，这是目前最通用的量化模
 
 ### 推荐模型
 
-以下模型已通过 GPU 数学验证（`quant_verify`），可与 Shimmy Airframe 引擎配合使用：
+以下模型经过测试，可与 Shimmy 配合使用：
 
-| 模型 | 架构 | 量化 | 大小 | 最小 VRAM | 下载地址 |
-|------|------|------|------|-----------|----------|
-| TinyLlama-1.1B-Chat | Llama | Q4_0 | 638MB | ~800MB | [HuggingFace](https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF) |
-| Llama-3.2-1B-Instruct | Llama | Q4_K_M | ~770MB | ~1GB | [HuggingFace](https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF) |
-| Llama-3.2-3B-Instruct | Llama | Q4_K_M | ~1.9GB | ~2.5GB | [HuggingFace](https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF) |
-| phi-2 | Phi-2 | Q4_K_M | ~1.7GB | ~2.2GB | [HuggingFace](https://huggingface.co/TheBloke/phi-2-GGUF) |
-| gemma-2-2b-it | Gemma-2 | Q4_K_M | ~1.6GB | ~2GB | [HuggingFace](https://huggingface.co/bartowski/gemma-2-2b-it-GGUF) |
-| starcoder2-3b | StarCoder2 | Q4_K_M | ~1.8GB | ~2.3GB | [HuggingFace](https://huggingface.co/second-state/StarCoder2-3B-GGUF) |
-
-**以下模型需要更大显存（≥16GB），将在路线图中支持：**
-
-| 模型 | 量化 | 大小 | 状态 |
-|------|------|------|------|
-| deepseek-coder-6.7b-instruct | Q4_K_M | ~3.9GB | 待远程 GPU 验证 |
-| deepseek-llm-7b-chat | Q4_K_M | ~4.0GB | 待远程 GPU 验证 |
-| qwen2-7b-instruct | Q4_K_M | ~4.5GB | 待远程 GPU 验证 |
+| 模型 | 大小 | VRAM | 下载地址 |
+|------|------|------|---------|
+| Phi-3-mini-4k（4bit 量化） | ~2GB | 3GB | [HuggingFace](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf) |
+| Llama-3.2-1B-Instruct | ~0.8GB | 2GB | [HuggingFace](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct-GGUF) |
+| Llama-3.2-3B-Instruct | ~2GB | 3GB | [HuggingFace](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct-GGUF) |
+| Mistral-7B-Instruct（Q4） | ~4GB | 5GB | [HuggingFace](https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF) |
+| Qwen2.5-7B-Instruct（Q4） | ~4GB | 5GB | [HuggingFace](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF) |
+| DeepSeek-R1-1.5B | ~1GB | 2GB | [HuggingFace](https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF) |
 
 ### 使用 huggingface-cli 下载
 
@@ -291,7 +283,7 @@ GGUF 文件名中的量化后缀含义：
 
 | 变量名 | 默认值 | 说明 |
 |--------|--------|------|
-| `SHIMMY_MAX_CTX` | 模型原生（从 GGUF 自动读取） | 最大上下文 token 数，超过模型原生值时自动启用 YaRN |
+| `SHIMMY_MAX_CTX` | 模型原生（通常 2048） | 最大上下文 token 数，超过 2048 自动启用 YaRN |
 | `SHIMMY_ENGINE_BACKEND` | `airframe` | 推理引擎，设为 `airframe`（默认）或 `safetensors` |
 | `SHIMMY_PORT` | `11435` | 服务监听端口 |
 | `SHIMMY_BIND_ADDRESS` | `127.0.0.1:11435` | 服务监听地址 |
@@ -1212,14 +1204,3 @@ curl -N http://127.0.0.1:11435/v1/chat/completions \
 *本文档与 Shimmy 主仓库同步维护。如发现错误或有改进建议，欢迎提交 [Issue](https://github.com/Michael-A-Kuykendall/shimmy/issues) 或 Pull Request。*
 
 *[English README](../README.md) | [繁體中文手冊](USER_MANUAL.zh-TW.md)*
-
----
-
-> 💝 **如果Shimmy对您有帮助，欢迎[赞助支持](https://github.com/sponsors/Michael-A-Kuykendall)——所有款项 100
----
-
-> 💝 **如果 Shimmy 对您有帮助，欢迎[赞助支持](https://github.com/sponsors/Michael-A-Kuykendall)——所有款项 100% 用于保持项目永久免费。**
-> - **$5/月**：咖啡档 ☕ 赞助者徽章
-> - **$25/月**：Bug 优先处理 🐛 名字收录于 [SPONSORS.md](../SPONSORS.md)
-> - **$100/月**：企业支持 🏢 Logo 展示 + 每月答疑
-> - **$500/月**：基础设施合作 🚀 直接支持 + 路线图参与
```

**File**: `docs/USER_MANUAL.zh-TW.md` (modified, +11/-26)
```diff
@@ -4,7 +4,7 @@
 
 ### 輕量本地 AI 推論伺服器，相容 OpenAI API
 
-[📚 中文文件中心](zh-TW/README.md) · [简体中文](USER_MANUAL.zh-CN.md) · **繁體中文** · [English](../README.md)
+[简体中文](USER_MANUAL.zh-CN.md) · **繁體中文** · [English](../README.md)
 
 版本：v2.3.0 及以上 · 最後更新：2026 年 7 月
 
@@ -224,24 +224,17 @@ Shimmy 使用 **GGUF 格式**的模型檔案，這是目前最通用的量化模
 
 ### 建議模型
 
-以下模型已通過 GPU 數學驗證（`quant_verify`），可與 Shimmy Airframe 引擎搭配使用：
+以下模型經過測試，可與 Shimmy 搭配使用：
 
-| 模型 | 架構 | 量化 | 大小 | 最小 VRAM | 下載位址 |
-|------|------|------|------|-----------|----------|
-| TinyLlama-1.1B-Chat | Llama | Q4_0 | 638MB | ~800MB | [HuggingFace](https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF) |
-| Llama-3.2-1B-Instruct | Llama | Q4_K_M | ~770MB | ~1GB | [HuggingFace](https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF) |
-| Llama-3.2-3B-Instruct | Llama | Q4_K_M | ~1.9GB | ~2.5GB | [HuggingFace](https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF) |
-| phi-2 | Phi-2 | Q4_K_M | ~1.7GB | ~2.2GB | [HuggingFace](https://huggingface.co/TheBloke/phi-2-GGUF) |
-| gemma-2-2b-it | Gemma-2 | Q4_K_M | ~1.6GB | ~2GB | [HuggingFace](https://huggingface.co/bartowski/gemma-2-2b-it-GGUF) |
-| starcoder2-3b | StarCoder2 | Q4_K_M | ~1.8GB | ~2.3GB | [HuggingFace](https://huggingface.co/second-state/StarCoder2-3B-GGUF) |
+| 模型 | 大小 | 顯示記憶體 | 下載位址 |
+|------|------|----------|---------|
+| Phi-3-mini-4k（4bit 量化） | ~2GB | 3GB | [HuggingFace](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf) |
+| Llama-3.2-1B-Instruct | ~0.8GB | 2GB | [HuggingFace](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct-GGUF) |
+| Llama-3.2-3B-Instruct | ~2GB | 3GB | [HuggingFace](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct-GGUF) |
+| Mistral-7B-Instruct（Q4） | ~4GB | 5GB | [HuggingFace](https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF) |
+| Qwen2.5-7B-Instruct（Q4） | ~4GB | 5GB | [HuggingFace](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF) |
+| DeepSeek-R1-1.5B | ~1GB | 2GB | [HuggingFace](https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF) |
 
-**以下模型需要更大顯示記憶體（≥16GB），將在路線圖中支援：**
-
-| 模型 | 量化 | 大小 | 狀態 |
-|------|------|------|------|
-| deepseek-coder-6.7b-instruct | Q4_K_M | ~3.9GB | 待遠端 GPU 驗證 |
-| deepseek-llm-7b-chat | Q4_K_M | ~4.0GB | 待遠端 GPU 驗證 |
-| qwen2-7b-instruct | Q4_K_M | ~4.5GB | 待遠端 GPU 驗證 |
 ### 使用 huggingface-cli 下載
 
 ```bash
@@ -281,7 +274,7 @@ GGUF 檔名中的量化後綴含義：
 
 | 變數名稱 | 預設值 | 說明 |
 |---------|--------|------|
-| `SHIMMY_MAX_CTX` | 模型原生（從 GGUF 自動讀取） | 最大上下文 token 數，超過模型原生值時自動啟用 YaRN |
+| `SHIMMY_MAX_CTX` | 模型原生（通常 2048） | 最大上下文 token 數，超過 2048 自動啟用 YaRN |
 | `SHIMMY_ENGINE_BACKEND` | `airframe` | 推論引擎，設為 `airframe`（預設）或 `safetensors` |
 | `SHIMMY_PORT` | `11435` | 伺服器監聽埠 |
 | `SHIMMY_BIND_ADDRESS` | `127.0.0.1:11435` | 伺服器監聽位址 |
@@ -1202,11 +1195,3 @@ curl -N http://127.0.0.1:11435/v1/chat/completions \
 *本文件與 Shimmy 主儲存庫同步維護。如發現錯誤或有改進建議，歡迎提交 [Issue](https://github.com/Michael-A-Kuykendall/shimmy/issues) 或 Pull Request。*
 
 *[English README](../README.md) | [简体中文手册](USER_MANUAL.zh-CN.md)*
-
----
-
-> 💝 **如果 Shimmy 對您有幫助，歡迎[贊助支持](https://github.com/sponsors/Michael-A-Kuykendall)——所有款項 100% 用於保持專案永久免費。**
-> - **$5/月**：咖啡檔 ☕ 贊助者徽章
-> - **$25/月**：Bug 優先處理 🐛 名字收錄於 [SPONSORS.md](../SPONSORS.md)
-> - **$100/月**：企業支援 🏢 Logo 展示 + 每月答疑
-> - **$500/月**：基礎設施合作 🚀 直接支援 + 路線圖參與
```

**File**: `docs/v2-roadmap.md` (added, +131/-0)
```diff
@@ -0,0 +1,131 @@
+# Shimmy v2.x Roadmap
+
+**Last Updated:** 2026-06-07  
+**Branch:** `feature/local-dev-platform-setup`  
+**Current version:** 1.7.4 (publishing toward 2.0.0)
+
+---
+
+## Philosophy
+
+Shimmy is a **shim** — thin, fast, and in the middle. It presents an OpenAI-compatible
+API surface and routes to the best available inference backend. The product promise:
+users point their AI tools at shimmy and they just work. Locally, privately, free.
+
+The v2 engine is **airframe** (WebGPU, pure Rust). llama.cpp served its purpose and is
+historically parked at `archive/llama-cpp-era-v1.9.0`.
+
+---
+
+## Roadmap Items
+
+### 🔴 P0 — In Progress
+
+**Wire airframe as default inference engine**  
+*Status:* Stub mode (`Backend: Stub mode`) — server starts, models load, no generation  
+*Work:* Connect `InferenceEngineAdapter` → airframe GGUF loading → token generation  
+*Blocks:* Everything else in this roadmap  
+*Points:* 5
+
+---
+
+### 🟠 P1 — Next
+
+**Strip llama.cpp + HuggingFace Python bridge**  
+*Status:* Gated but present, causing compile weight  
+*Work (8 points total):*
+- Remove `shimmy-llama-cpp-2` dep and all `#[cfg(feature="llama")]` blocks (5pt)
+- Remove HuggingFace Python subprocess bridge (3pt)
+- Remove `src/engine/llama.rs`, `universal.rs`, `huggingface.rs`
+- Clean `adapter.rs` down to airframe-only path
+- Clean `main.rs` of MoE config, GPU backend selection, llama diagnostics
+- Update CHANGELOG, README, wiki to reflect v2 engine
+
+*Sequence:*
+1. Cargo.toml — remove deps/features
+2. Delete dead engine files
+3. Clean engine/mod.rs
+4. Thin out adapter.rs
+5. Clean main.rs
+6. cargo check → 0 warnings, 0 errors
+7. Docs update
+
+*Note:* Users who need llama.cpp have `archive/llama-cpp-era-v1.9.0` on origin.
+
+---
+
+### 🟡 P2 — Soon
+
+**HuggingFace Hub model sourcing (pure Rust)**  
+*Status:* Not started  
+*Motivation:* The shim should accept HF model IDs, not just local paths.
+Users think in `microsoft/phi-4` not `/path/to/phi-4.Q4_K_M.gguf`.  
+*Design:*
+```
+shimmy serve --model hf://microsoft/phi-4-gguf
+  → hits HF Hub API (reqwest, no Python)
+  → resolves to GGUF download URL
+  → downloads to ~/.cache/shimmy/
+  → loads into airframe
+  → serves at /v1/chat/completions
+```
+*Features:*
+- `GET /api/models/search?q=phi-4` — search HF Hub
+- Auto-select quantization based on available VRAM
+- Resume interrupted downloads
+- `--hf-token` flag for gated models
+
+*Dependencies:* `reqwest` (already in console crate), no new C++ deps  
+*Points:* 5
+
+---
+
+### 🟡 P2 — Soon
+
+**Console (local AI development platform)**  
+*Status:* Commands wired, tool loop implemented, blocked on P0 (inference)*  
+*Work remaining:*
+- End-to-end test once airframe inference is working
+- Session persistence (shimmy-session-store)
+- Workspace context injection (file tree, git log)
+
+---
+
+### 🟢 P3 — Documentation Sprint
+
+**Full docs update (wiki + READMEs + Chinese translations)**  
+*Scope:*
+- `shimmy-wiki-content/` — all EN pages updated for v2 engine
+- `shimmy-wiki-content/*-zh-CN.md` — Simplified Chinese updated
+- `shimmy-wiki-content/*-zh-TW.md` — Traditional Chinese updated
+- `docs/zh-CN/README.md` + `docs/zh-TW/README.md` — docs center updated
+- `docs/USER_MANUAL.zh-CN.md` + `docs/USER_MANUAL.zh-TW.md` — user manuals updated
+- Remove all llama.cpp installation instructions
+- Update feature flags table
+- Add airframe engine documentation
+- Update Quick Start, Installation, Configuration pages
+
+*Points:* 8 (including Chinese translations)  
+*Note:* This is separate from the code strip work. Total combined = 8+8 = 13.
+
+---
+
+## Archive Reference
+
+| Tag | Commit | Contents |
+|-----|--------|----------|
+| `archive/llama-cpp-era-v1.9.0` | `6fe98ea` | Last shimmy with llama.cpp as default |
+| `archive/pre-v2.0.0-history` | `6fe98ea` | Full pre-v2 histor
```

**File**: `docs/zh-CN/README.md` (modified, +6/-9)
```diff
@@ -21,7 +21,7 @@ Shimmy 是一个用纯 **Rust** 编写的本地 AI 推理服务器，兼容 **Op
 
 ---
 
-## 💝 支持 Shimmy 的发展
+## 💝 支持 Shimmy 的发展
 
 🚀 **如果 Shimmy 对您有帮助，欢迎[赞助支持](https://github.com/sponsors/Michael-A-Kuykendall)——所有赞助款项 100% 用于保持项目永久免费。**
 
@@ -32,8 +32,7 @@ Shimmy 是一个用纯 **Rust** 编写的本地 AI 推理服务器，兼容 **Op
 
 [**🎯 成为赞助者**](https://github.com/sponsors/Michael-A-Kuykendall) | 查看[赞助者名单](../../SPONSORS.md) 🙏
 
----
-
+---
 ## 📚 文档索引
 
 ### 入门指南
@@ -105,7 +104,7 @@ curl http://127.0.0.1:11435/v1/chat/completions \
 
 ---
 
-## ⚡ TurboShimmy INT4 KV
+## ⚡ TurboShimmy INT4 KV
 
 **TurboShimmy** 是 Shimmy 带来的纯 GPU INT4 KV 缓存压缩系统。通过 WGSL 计算着色器，将 KV 缓存从 32 位浮点数压缩为逐头向量 4 位整数，全程在 GPU 上完成。**一行指令，约 7 倍 KV 显存节省，输出品质不变。** 详细文档见 [turboshimmy.md](../turboshimmy.md)。
 
@@ -137,8 +136,7 @@ SHIMMY_KV_QUANT=int4 ./shimmy serve
 
 > **品质验证：** 在 Llama-3.2-3B 上进行的“大海捕针”基准测试表明，ctx≤2048 时 INT4 对比 F32 检索准确率零退化（各测试深度 15%〈50%〈85% 均为 100%）。详细文档：[TurboShimmy Wiki](https://github.com/Michael-A-Kuykendall/shimmy/wiki/TurboShimmy-zh-CN)。
 
----
-
+---
 ## 🖥️ 已验证的 GPU 支持
 
 | 平台 | GPU 类型 | 后端 |
@@ -176,9 +174,8 @@ Shimmy 是纯 Rust 实现，无 Python 运行时，无 C++ 依赖，启动时间
 **如何选择模型量化格式？**
 日常使用首选 `Q4_K_M`——在文件大小和推理质量之间取得了最好的平衡。若追求最高质量且显存充足，选 `Q8_0`。详见[量化格式详解](QUANTIZATION.md)。
 
-**如何在 4 GB 显存的显卡上运行 3B 模型？**
-启用 TurboShimmy：`SHIMMY_KV_QUANT=int4 ./shimmy serve`。这将 KV 显存减少约 7 倍，使 Llama-3.2-3B 能在 2.5 GB 总显存下运行。详见 [turboshimmy.md](../turboshimmy.md)。
-
+**如何在 4 GB 显存的显卡上运行 3B 模型？**
+启用 TurboShimmy：`SHIMMY_KV_QUANT=int4 ./shimmy serve`。这将 KV 显存减少约 7 倍，使 Llama-3.2-3B 能在 2.5 GB 总显存下运行。详见 [turboshimmy.md](../turboshimmy.md)。
 **上下文长度不够怎么办？**
 设置 `SHIMMY_MAX_CTX=8192`（或更高）即可，Airframe 会自动应用 YaRN RoPE 缩放。注意超出模型原生上下文 2 倍以上时质量会有所下降。详见[扩展上下文窗口](EXTENDED_CONTEXT.md)。
 
```

#### Recent Merged Pull Requests:
- **PR #215** (closed): fix: restore broken star history chart in README (@OctoBored)
- **PR #211** (closed): fix: build 2.3.x from source — use airframe::grammar::grammar_hooks (modify_logits_from_grammar does not exist in any published airframe) (@Supersynergy)
- **PR #209** (2026-06-30): chore: consolidate test suite (19 files → 3) + SSE regression test + doc updates (@Michael-A-Kuykendall)
- **PR #198** (closed): feat: read per-model stop tokens from Ollama model card at runtime (@LopezNuance)
- **PR #196** (closed): fix: correct sampler chain order, penalty params, and KV eviction (@LopezNuance)
- **PR #195** (closed): fix: UTF-8 char boundary panic in repetition detector (@LopezNuance)
- **PR #194** (closed): fix: UTF-8 char boundary panic in repetition detector (@LopezNuance)
- **PR #193** (closed): fix: model caching, sliding-window KV eviction, and penalty forwarding (@LopezNuance)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
