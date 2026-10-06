# Forensic Learning Record (Deep Inspection): aaif-goose/goose

> **Canonical Artifact**: `07_PROJECT_LEARNING/aaif-goose-goose-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aaif-goose/goose](https://github.com/aaif-goose/goose))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:52:57.986Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aaif-goose/goose`
- **Description**: an open source, extensible AI agent that goes beyond code suggestions - install, execute, edit, and test with any LLM
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 54977 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/goose-local-inference/src/llamacpp/inference_engine.rs`
```
use crate::backend::LocalInferenceBackend;
use crate::model::ModelSettings;
use crate::multimodal::ExtractedImage;
use goose_provider_types::errors::ProviderError;
use goose_provider_types::request_log::{LoggerHandleExt, RequestLogHandle};
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::{AddBos, ChatTemplateResult, LlamaChatTemplate, LlamaModel};
use llama_cpp_2::mtmd::{MtmdBitmap, MtmdContext, MtmdInputText};
use llama_cpp_2::openai::OpenAIChatTemplateParams;
use llama_cpp_2::sampling::LlamaSampler;
use std::num::NonZeroU32;

use super::super::StreamSender;
use super::LlamaCppBackend;

pub(super) struct GenerationContext<'a> {
    pub loaded: &'a LoadedModel,
    pub backend: &'a LlamaCppBackend,
    pub template: &'a LlamaChatTemplate,
    pub settings: &'a ModelSettings,
    pub context_limit: usize,
    pub model_name: String,
    pub message_id: &'a str,
    pub tx: &'a StreamSender,
    pub log: &'a mut Option<Box<dyn RequestLogHandle>>,
    pub images: &'a [ExtractedImage],
}

pub(super) struct LoadedModel {
    pub model: LlamaModel,
    pub templates: LoadedChatTemplates,
    /// Multimodal context for vision models. None for text-only models.
    pub mtmd_ctx: Option<MtmdContext>,
}

pub(super) struct LoadedChatTemplates {
    pub default: Option<LlamaChatTemplate>,
    pub tool_use: Option<LlamaChatTemplate>,
    pub force_default: bool,
}

pub(super) struct PreparedGeneration<'model> {
    pub template_result: ChatTemplateResult,
    pub llama_ctx: llama_cpp_2::context::LlamaContext<'model>,
    pub prompt_token_count: usize,
    pub effective_ctx: usize,
}

pub(super) struct StopSuffixTrimmer {
    pending: String,
    stops: Vec<String>,
}

impl StopSuffixTrimmer {
    pub(super) fn new(stops: &[String]) -> Self {
        Self {
            pending: String::new(),
            stops: stops
                .iter()
                .filter(|stop| !stop.is_empty())
                .cloned()
                .collect(),
        }
    }

    pub(super) fn push(&mut self, chunk: &str) -> (String, bool) {
        if self.stops.is_empty() {
            return (chunk.to_string(), false);
        }

        self.pending.push_str(chunk);

        if let Some(stop) = self
            .stops
            .iter()
            .filter(|stop| self.pending.ends_with(stop.as_str()))
            .max_by_key(|stop| stop.len())
        {
            let emit_len = self.pending.len() - stop.len();
            let _stop = self.pending.split_off(emit_len);
            let emit = std::mem::take(&mut self.pending);
            return (emit, true);
        }

        let hold_len = self
            .pending
            .char_indices()
            .map(|(idx, _)| idx)
            .chain(std::iter::once(self.pending.len()))
            .filter(|idx| {
                self.pending
                    .get(*idx..)
                    .is_some_and(|suffix| self.stops.iter().any(|stop| stop.starts_with(suffix)))
            })
            .map(|idx| self.pending.len() - idx)
            .max()
            .unwrap_or(0);

        let emit_len = self.pending.len() - hold_len;
        let keep = self.pending.split_off(emit_len);
        let emit = std::mem::replace(&mut self.pending, keep);
        (emit, false)
    }

    pub(super) fn finish(&mut self) -> String {
        std::mem::take(&mut self.pending)
    }
}

/// Estimate the maximum context length that can fit in available accelerator/CPU
/// memory based on the model's KV cache requirements.
///
/// Returns `None` if the model architecture values are unavailable.
pub(super) fn estimate_max_context_for_memory(
    model: &LlamaModel,
    backend: &LlamaCppBackend,
    mmproj_overhead_bytes: u64,
) -> Option<usize> {
    let raw_available = backend.available_memory_bytes();
    if raw_available == 0 {
        return None;
    }
    let available = raw_available.saturating_sub(mmproj_overhead_bytes);

    // Reserve memory for computation scratch buffers (attention, etc.) and other overhead.
    // The compute buffer can be 40-50% of the KV cache size for large models, so we
    // conservatively use only half the available memory for the KV cache.
    let usable = (available as f64 * 0.5) as u64;

    let n_layer = model.n_layer() as u64;
    let n_head_kv = model.n_head_kv() as u64;
    let n_head = model.n_head() as u64;
    let n_embd = model.n_embd() as u64;

    if n_head == 0 || n_layer == 0 || n_head_kv == 0 || n_embd == 0 {
        return None;
    }

    // For MLA (Multi-head Latent Attention) models like DeepSeek/GLM, the actual KV cache
    // dimensions differ from n_head_kv * head_dim. Read the true dimensions from GGUF metadata.
    let arch = model
        .meta_val_str("general.architecture")
        .unwrap_or_default();
    let head_dim = n_embd / n_head;
    let k_per_head = model
        .meta_val_str(&format!("{arch}.attention.key_length"))
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(head_dim);
    let v_per_head = model
        .meta_val_str(&format!("{arch}.attention.value_length"))
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(head_dim);

    // Total KV dimensions across all KV heads, times n_layer, times 2 bytes (f16) per element
    let bytes_per_token = (k_per_head + v_per_head) * n_head_kv * n_layer * 2;

    if bytes_per_token == 0 {
        return None;
    }

    Some((usable / bytes_per_token) as usize)
}

pub(super) fn context_cap(
    settings: &crate::model::ModelSettings,
    context_limit: usize,
    n_ctx_train: usize,
    memory_max_ctx: Option<usize>,
) -> usize {
    if let Some(ctx_size) = settings.context_size {
        return ctx_size as usize;
    }

    let limit = if context_limit > 0 {
        context_limit
    } else {
        n_ctx_train
    };

    match memory_max_ctx {
        Some(mem_max) if mem_max < limit => {
            tracing::info!(
                "Capping context from {} to {} based on available memory",
                limit,
                mem_max,
            );
            mem_max
        }
        _ => limit,
    }
}

pub(super) fn effective_context_size(
    prompt_token_count: usize,
    settings: &crate::model::ModelSettings,
    context_limit: usize,
    n_ctx_train: usize,
    memory_max_ctx: Option<usize>,
) -> usize {
    let limit = context_cap(settings, context_limit, n_ctx_train, memory_max_ctx);
    let min_generation_headroom = 512;
    if prompt_token_count + min_generation_headroom > limit {
        tracing::warn!(
            "Prompt ({} tokens) + minimum headroom ({}) exceeds context limit ({})",
            prompt_token_count,
            min_generation_headroom,
            limit,
        );
    }
    limit
}

pub(super) fn build_context_params(
    ctx_size: u32,
    settings: &crate::model::ModelSettings,
) -> LlamaContextParams {
    let mut params = LlamaContextParams::default().with_n_ctx(NonZeroU32::new(ctx_size));

    if let Some(n_batch) = settings.n_batch {
        params = params.with_n_batch(n_batch);
    }
    if let Some(n_threads) = settings.n_threads {
        params = params.with_n_threads(n_threads);
        params = params.with_n_threads_batch(n_threads);
    }
    if let Some(flash_attn) = settings.flash_attention {
        let policy = if flash_attn { 1 } else { 0 };
        params = params.with_flash_attention_policy(policy);
    }

    params
}

pub(super) fn build_sampler(settings: &crate::model::ModelSettings) -> LlamaSampler {
    use crate::model::SamplingConfig;

    let has_penalties = settings.repeat_penalty != 1.0
        || settings.frequency_penalty != 0.0
        || settings.presence_penalty != 0.0;

    let mut samplers: Vec<LlamaSampler> = Vec::new();

    if has_penalties {
        samplers.push(LlamaSampler::penalties(
            settings.repeat_last_n,
            settings.repeat_penalty,
            settings.frequency_penalty,
            settings.presence_penalty,
        ));
    }

    match &settings.sampling {
        SamplingConfig::Greedy => {
            samplers.push(LlamaSampler::greedy());
        }
        SamplingConfig::Temperature {
            temperature,
            top_k,
            top_p,
            min_p,
            seed,
        } => {
            samplers.push(LlamaSampler::top_k(*top_k));
            samplers.push(LlamaSampler::top_p(*top_p, 1));
            samplers.push(LlamaSampler::min_p(*min_p, 1));
            samplers.push(LlamaSampler::temp(*temperature));
            samplers.push(LlamaSampler::dist(seed.unwrap_or(0)));
        }
        SamplingConfig::MirostatV2 { tau, eta, seed } => {
            samplers.push(LlamaSampler::mirostat_v2(seed.unwrap_or(0), *tau, *eta));
        }
    }

    if samplers.len() == 1 {
        samplers.pop().unwrap()
    } else {
        LlamaSampler::chain_simple(samplers)
    }
}

/// Validate prompt tokens against memory limits and compute the effective
/// context size. Returns `(prompt_token_count, effective_ctx)`.
pub(super) fn validate_and_compute_context(
    loaded: &LoadedModel,
    backend: &LlamaCppBackend,
    prompt_token_count: usize,
    context_limit: usize,
    settings: &crate::model::ModelSettings,
) -> Result<(usize, usize), ProviderError> {
    let n_ctx_train = loaded.model.n_ctx_train() as usize;
    let mmproj_overhead = if loaded.mtmd_ctx.is_some() {
        settings.mmproj_size_bytes
    } else {
        0
    };
    let memory_max_ctx = estimate_max_context_for_memory(&loaded.model, backend, mmproj_overhead);
    let effective_ctx = effective_context_size(
        prompt_token_count,
        settings,
        context_limit,
        n_ctx_train,
        memory_max_ctx,
    );
    if let Some(mem_max) = memory_max_ctx {
        if prompt_token_count > mem_max {
            return Err(ProviderError::ContextLengthExceeded(format!(
                "Prompt ({} tokens) exceeds estimated memory capacity ({} tokens). \
            
```

### Core Architecture Module: `crates/goose-local-inference/src/provider_utils.rs`
```
pub fn filter_extensions_from_system_prompt(system: &str) -> String {
    let Some(extensions_start) = system.find("# Extensions") else {
        return system.to_string();
    };

    let Some(after_extensions) = system.get(extensions_start + 1..) else {
        return system.to_string();
    };

    if let Some(next_section_pos) = after_extensions.find("\n# ") {
        let Some(before) = system.get(..extensions_start) else {
            return system.to_string();
        };
        let Some(after) = system.get(extensions_start + next_section_pos + 1..) else {
            return system.to_string();
        };
        format!("{}{}", before.trim_end(), after)
    } else {
        system
            .get(..extensions_start)
            .map(|s| s.trim_end().to_string())
            .unwrap_or_else(|| system.to_string())
    }
}

```

### Core Architecture Module: `crates/goose-provider-types/src/mcp_utils.rs`
```
use crate::utils::sanitize_unicode_tags;
use base64::Engine;
use rmcp::model::ResourceContents;

pub fn extract_text_from_resource(resource: &ResourceContents) -> String {
    match resource {
        ResourceContents::TextResourceContents { text, .. } => sanitize_unicode_tags(text),
        ResourceContents::BlobResourceContents {
            blob, mime_type, ..
        } => match base64::engine::general_purpose::STANDARD.decode(blob) {
            Ok(bytes) => {
                let byte_len = bytes.len();
                match String::from_utf8(bytes) {
                    Ok(text) => sanitize_unicode_tags(&text),
                    Err(_) => {
                        let mime = mime_type
                            .as_ref()
                            .map(|m| m.as_str())
                            .unwrap_or("application/octet-stream");
                        format!("[Binary content ({}) - {} bytes]", mime, byte_len)
                    }
                }
            }
            Err(_) => sanitize_unicode_tags(blob),
        },
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case("Hello, World!", "Hello, World!" ; "simple text")]
    #[test_case("Hello from GitHub!", "Hello from GitHub!" ; "github content")]
    #[test_case("visible\u{E0041}\u{E0042}text", "visibletext" ; "unicode tags")]
    #[test_case("", "" ; "empty text")]
    fn test_extract_text_from_text_resource(input: &str, expected: &str) {
        let resource = ResourceContents::TextResourceContents {
            uri: "file:///test.txt".to_string(),
            mime_type: Some("text/plain".to_string()),
            text: input.to_string(),
            meta: None,
        };
        assert_eq!(extract_text_from_resource(&resource), expected);
    }

    #[test_case("Hello from GitHub!", "Hello from GitHub!" ; "utf8 markdown")]
    #[test_case("Simple text", "Simple text" ; "utf8 plain")]
    #[test_case("visible\u{E0041}\u{E0042}text", "visibletext" ; "unicode tags")]
    fn test_extract_text_from_blob_utf8(input: &str, expected: &str) {
        let blob = base64::engine::general_purpose::STANDARD.encode(input.as_bytes());
        let resource = ResourceContents::BlobResourceContents {
            uri: "github://repo/file.md".to_string(),
            mime_type: Some("text/markdown".to_string()),
            blob,
            meta: None,
        };
        assert_eq!(extract_text_from_resource(&resource), expected);
    }

    #[test]
    fn test_extract_text_from_blob_binary() {
        let binary_data: Vec<u8> = vec![0xFF, 0xFE, 0x00, 0x01, 0x89, 0x50, 0x4E, 0x47];
        let blob = base64::engine::general_purpose::STANDARD.encode(&binary_data);

        let resource = ResourceContents::BlobResourceContents {
            uri: "file:///image.png".to_string(),
            mime_type: Some("image/png".to_string()),
            blob,
            meta: None,
        };

        assert_eq!(
            extract_text_from_resource(&resource),
            "[Binary content (image/png) - 8 bytes]"
        );
    }

    #[test]
    fn test_extract_text_from_blob_binary_no_mime_type() {
        let binary_data: Vec<u8> = vec![0xFF, 0xFE];
        let blob = base64::engine::general_purpose::STANDARD.encode(&binary_data);

        let resource = ResourceContents::BlobResourceContents {
            uri: "file:///unknown".to_string(),
            mime_type: None,
            blob,
            meta: None,
        };

        assert_eq!(
            extract_text_from_resource(&resource),
            "[Binary content (application/octet-stream) - 2 bytes]"
        );
    }

    #[test]
    fn test_extract_text_from_blob_invalid_base64() {
        let resource = ResourceContents::BlobResourceContents {
            uri: "file:///test.txt".to_string(),
            mime_type: Some("text/plain".to_string()),
            blob: "not\u{E0041} valid base64!!!".to_string(),
            meta: None,
        };
        assert_eq!(extract_text_from_resource(&resource), "not valid base64!!!");
    }
}

```

### Core Architecture Module: `crates/goose-provider-types/src/utils.rs`
```
use unicode_normalization::UnicodeNormalization;

fn is_in_unicode_tag_range(c: char) -> bool {
    matches!(c, '\u{E0000}'..='\u{E007F}')
}

pub fn sanitize_unicode_tags(text: &str) -> String {
    let normalized: String = text.nfc().collect();
    strip_unicode_tags(&normalized)
}

pub fn strip_unicode_tags(text: &str) -> String {
    text.chars()
        .filter(|&c| !is_in_unicode_tag_range(c))
        .collect()
}

/// Extract the model name from a JSON object. Common with most providers to have this top level attribute.
pub fn get_model(data: &serde_json::Value) -> String {
    if let Some(model) = data.get("model") {
        if let Some(model_str) = model.as_str() {
            model_str.to_string()
        } else {
            "Unknown".to_string()
        }
    } else {
        "Unknown".to_string()
    }
}

```

### Core Architecture Module: `crates/goose/src/agents/state_machine/effects.rs`
```
use crate::conversation::message::Message;
use crate::conversation::Conversation;
use crate::providers::base::ProviderUsage;
use crate::recipe::Recipe;
use goose_agent::operation::{ConversationEffect, MachineEffect};

pub enum GooseEffect {
    Conversation(ConversationEffect),
    CompactConversation {
        conversation: Conversation,
        usage: Option<ProviderUsage>,
    },
    SetRecipe(Box<Option<Recipe>>),
    RecordUsage(ProviderUsage),
}

impl MachineEffect for GooseEffect {
    fn ensure_message_ids(&mut self) {
        match self {
            GooseEffect::Conversation(effect) => effect.ensure_message_ids(),
            GooseEffect::CompactConversation { conversation, .. } => {
                for message in conversation.messages_mut() {
                    if message.id.is_none() {
                        message.id = Some(format!("msg_{}", uuid::Uuid::new_v4()));
                    }
                }
            }
            _ => {}
        }
    }
}

impl From<ConversationEffect> for GooseEffect {
    fn from(effect: ConversationEffect) -> Self {
        GooseEffect::Conversation(effect)
    }
}

impl From<Message> for GooseEffect {
    fn from(message: Message) -> Self {
        ConversationEffect::from(message).into()
    }
}

impl From<Conversation> for GooseEffect {
    fn from(conversation: Conversation) -> Self {
        ConversationEffect::from(conversation).into()
    }
}

```

### Core Architecture Module: `crates/goose/src/agents/state_machine/inference_preparation.rs`
```
//! Goose-specific inference request preparation.

use crate::agents::extension_manager::{ExtensionLease, ExtensionManager};
use crate::agents::PromptManager;
use crate::config::GooseMode;
use crate::session::Session;
use crate::tool_inspection::ToolInspectionManager;
use anyhow::Result;
use async_trait::async_trait;
use goose_agent::inference::{InferenceRequestPreparer, PreparedInferenceRequest};
use goose_agent::operation::{messages_since_kickoff, InferenceInput};
use goose_providers::conversation::message::Message;
use goose_providers::conversation::Conversation;
use std::sync::{Arc, Mutex as StdMutex};
use tokio::sync::Mutex;

pub struct GooseInferenceRequestPreparer<'a> {
    pub(crate) extension_manager: Arc<ExtensionManager>,
    pub(crate) extension_lease: Arc<StdMutex<Option<Arc<ExtensionLease>>>>,
    pub(crate) goose_mode: &'a Mutex<GooseMode>,
    pub(crate) prompt_manager: &'a Mutex<PromptManager>,
    pub(crate) tool_inspection_manager: &'a ToolInspectionManager,
    pub(crate) context_limit: usize,
}

#[async_trait]
impl InferenceRequestPreparer<Session> for GooseInferenceRequestPreparer<'_> {
    async fn prepare_session(&self, session: &Session) -> Result<Option<Session>> {
        let (session, lease) = self
            .extension_manager
            .current_session_snapshot(session)
            .await;
        *self
            .extension_lease
            .lock()
            .expect("extension lease unavailable") = Some(Arc::new(lease));
        Ok(Some(session))
    }

    async fn prepare(
        &self,
        session: &Session,
        conversation: &Conversation,
        input: InferenceInput,
    ) -> Result<PreparedInferenceRequest> {
        #[cfg(feature = "code-mode")]
        let code_execution_mode = self
            .extension_lease
            .lock()
            .expect("extension lease unavailable")
            .as_ref()
            .is_some_and(|lease| {
                lease.is_enabled(crate::agents::platform_extensions::code_execution::EXTENSION_NAME)
            });
        #[cfg(not(feature = "code-mode"))]
        let code_execution_mode = false;

        let goose_mode = *self.goose_mode.lock().await;
        if goose_mode == GooseMode::SmartApprove {
            self.tool_inspection_manager
                .apply_tool_annotations(&input.tools);
        }
        let tools =
            crate::agents::reply_parts::prepare_inference_tools(input.tools, code_execution_mode);
        let system_prompt = self.prompt_manager.lock().await.build_system_prompt(
            &session.working_dir,
            input.prompt_parts,
            goose_mode,
        );
        let turn = messages_since_kickoff(conversation)?;
        let turn_start = turn
            .first()
            .and_then(|message| chrono::DateTime::from_timestamp(message.created, 0))
            .map(|timestamp| timestamp.with_timezone(&chrono::Local))
            .unwrap_or_else(chrono::Local::now);
        let last = turn
            .iter()
            .rev()
            .find(|message| message.is_turn_context())
            .map(Message::as_concat_text);
        let context_limit = Some(self.context_limit);
        let additional_messages = crate::agents::moim::turn_context_event(
            &session.working_dir,
            context_limit,
            input.moim_parts,
            turn_start,
        )
        .filter(|event| Some(event.as_concat_text()) != last)
        .into_iter()
        .collect();
        Ok(PreparedInferenceRequest {
            system_prompt,
            tools,
            additional_messages,
        })
    }
}

```

### Core Architecture Module: `crates/goose/src/agents/state_machine/mod.rs`
```
//! Runs an ordered, re-entrant pipeline over persisted conversation state.
//!
//! Callers persist incoming messages, construct `Step`s from their own operations,
//! and choose whether to call `StateMachine::step`, `StateMachine::apply`, or
//! `StateMachine::run`. Goose's concrete operations remain internal because their
//! configuration is part of `Agent::reply`, not the state-machine protocol.

mod effects;
mod inference_preparation;
mod ops_bang_shell;
mod ops_compaction;
mod ops_doctor;
mod ops_entry_hook;
mod ops_exit_on_error;
mod ops_foreground_subagent;
mod ops_llm;
mod ops_maxturns;
mod ops_project;
mod ops_recipe;
mod ops_retry;
mod ops_skills;
mod ops_slash_command;
mod ops_status;
mod ops_steer;
mod ops_stop_hook;
mod ops_tool_approval;
mod ops_tool_pair_compaction;
mod ops_toolcalling;
mod ops_unknown_tool;
mod session;
pub(crate) use session::run as run_goose;
mod tool_confirmation;
mod usage;

use std::collections::HashSet;

use crate::conversation::message::{Message, MessageContent};

/// Several operations answer parts of one tool batch in separate messages, so a
/// tool tail alone does not mean the batch is complete.
pub(super) fn awaits_tool_responses(messages: &[Message]) -> bool {
    let answered: HashSet<&str> = messages
        .iter()
        .flat_map(Message::get_tool_response_ids)
        .collect();
    messages
        .iter()
        .flat_map(|message| &message.content)
        .filter_map(MessageContent::as_tool_request)
        .any(|request| {
            !request.was_executed_externally() && !answered.contains(request.id.as_str())
        })
}

#[cfg(test)]
mod tests;

pub use effects::GooseEffect;
pub use goose_agent::machine::{
    EffectHandler, EffectUsage, MachineSession, SessionLoader, StateMachine, Step,
};
pub use goose_agent::operation::{
    applied, assistant_turn_count, ends_turn, last_effective_role, messages_since_kickoff,
    not_applicable, trailing_error, yielded, yielded_with, ConversationEffect, Emitter, Inference,
    InferenceInput, MachineEffect, Operation, OperationResult, SlashCommand, StepResult,
};
pub(crate) use tool_confirmation::{
    has_unapplied_tool_confirmation_response, pending_tool_confirmations,
    persist_tool_confirmation_decision,
};

pub(super) use inference_preparation::GooseInferenceRequestPreparer;
pub(super) use ops_bang_shell::BangShellOperation;
pub(super) use ops_compaction::CompactionOperation;
pub(super) use ops_doctor::DoctorOperation;
pub(super) use ops_entry_hook::EntryHookOperation;
pub(super) use ops_exit_on_error::ExitOnErrorOperation;
pub(super) use ops_foreground_subagent::{subagent_cancelled_message, ForegroundSubagentOperation};
pub(super) use ops_llm::{GooseInferenceProvider, InferenceRunner};
pub(super) use ops_maxturns::{MaxTurnsOperation, MAX_TURNS_MESSAGE};
pub(super) use ops_project::ProjectOperation;
pub(super) use ops_recipe::RecipeOperation;
pub(super) use ops_retry::RetryOperation;
pub(super) use ops_skills::SkillOperation;
pub(super) use ops_slash_command::SlashCommandOperation;
pub(super) use ops_status::StatusOperation;
pub(super) use ops_steer::{SteerOperation, SteerQueue};
pub(super) use ops_stop_hook::StopHookOperation;
pub(super) use ops_tool_approval::ToolApprovalOperation;
pub(super) use ops_tool_pair_compaction::ToolPairCompactionOperation;
pub(super) use ops_toolcalling::ToolExecutionOperation;
pub(super) use ops_unknown_tool::UnknownToolOperation;

pub fn enabled() -> bool {
    std::env::var("GOOSE_STATE_MACHINE")
        .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE" | "yes"))
        .unwrap_or(false)
}

```

### Core Architecture Module: `crates/goose/src/agents/state_machine/ops_bang_shell.rs`
```
//! Runs a kickoff message beginning with `!` as a direct shell tool call.

use anyhow::Result;
use async_trait::async_trait;
use rmcp::model::CallToolRequestParams;

use crate::agents::state_machine::effects::GooseEffect;
use crate::agents::state_machine::{
    applied, last_effective_role, messages_since_kickoff, not_applicable, yielded, Emitter,
    Operation, OperationResult,
};
use crate::conversation::message::Message;
use crate::conversation::{Conversation, EffectiveRole};
use crate::session::Session;

const SHELL_TOOL_NAME: &str = "shell";

pub(crate) fn bang_shell_command(message: &str) -> Option<&str> {
    message
        .trim_start()
        .strip_prefix('!')
        .map(str::trim_start)
        .filter(|command| !command.is_empty())
}

pub struct BangShellOperation;

impl BangShellOperation {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Operation<Session, GooseEffect> for BangShellOperation {
    fn name(&self) -> &'static str {
        "bang_shell"
    }

    async fn run(
        &self,
        _session: &Session,
        conversation: &Conversation,
        emit: &Emitter,
    ) -> Result<OperationResult<GooseEffect>> {
        let messages = messages_since_kickoff(conversation)?;
        let Some(kickoff) = messages.first() else {
            return not_applicable();
        };
        let kickoff_text = kickoff.user_visible_content().as_concat_text();
        let Some(command) = bang_shell_command(&kickoff_text) else {
            return not_applicable();
        };

        if messages.len() > 1 {
            return if last_effective_role(messages)? == EffectiveRole::Tool {
                yielded()
            } else {
                not_applicable()
            };
        }

        let call = CallToolRequestParams::new(SHELL_TOOL_NAME.to_string()).with_arguments(
            serde_json::Map::from_iter([(
                "command".to_string(),
                serde_json::Value::String(command.to_string()),
            )]),
        );
        let request = Message::assistant()
            .with_tool_request(format!("bang_shell_{}", uuid::Uuid::now_v7()), Ok(call));
        let request = emit.message(request).await;

        applied([request.into()])
    }
}

```

### Core Architecture Module: `crates/goose/src/agents/state_machine/ops_compaction.rs`
```
//! Compacts conversation history when it is too large for the configured context window.

use std::sync::Arc;

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use tracing_futures::Instrument;

use crate::agents::final_output_tool::FinalOutputTool;
use crate::agents::state_machine::ops_llm::{chat_span, record_chat_usage};
use crate::agents::state_machine::{
    applied, awaits_tool_responses, last_effective_role, messages_since_kickoff, not_applicable,
    trailing_error, yielded, yielded_with, ConversationEffect, Emitter, GooseEffect, Operation,
    OperationResult, SlashCommand,
};
use crate::context_mgmt::{compact_messages, count_context_tokens};
use crate::conversation::message::{Message, MessageErrorKind, SystemNotificationType};
use crate::conversation::{Conversation, EffectiveRole};
use crate::providers::base::Provider;
use crate::session::Session;
use goose_providers::model::ModelConfig;

const COMPACTION_THINKING_TEXT: &str = "goose is compacting the conversation...";

pub(super) const MAX_CONTEXT_ERROR_COMPACTIONS: usize = 2;

fn compaction_part(
    total_tokens: Option<i32>,
    context_limit: usize,
    threshold: f64,
) -> Option<String> {
    let total_tokens = total_tokens?;
    if total_tokens <= 0 || context_limit == 0 || threshold <= 0.0 || threshold >= 1.0 {
        return None;
    }

    let compaction_at = (context_limit as f64 * threshold) as i32;
    if compaction_at <= 0 || (total_tokens as f64 / compaction_at as f64) < 0.5 {
        return None;
    }

    Some(format!(
        "<compaction>~{}k tokens remaining</compaction>",
        compaction_at.saturating_sub(total_tokens) / 1000
    ))
}

/// Reported usage stops at the inference that requested the tools, so the
/// results that answered it are not counted until the next request.
async fn unreported_tool_tokens(conversation: &Conversation) -> Result<i32> {
    let messages = conversation.messages();
    if last_effective_role(messages)? != EffectiveRole::Tool {
        return Ok(0);
    }
    let after_request = messages
        .iter()
        .rposition(Message::is_tool_call)
        .map_or(0, |index| index + 1);
    count_context_tokens(&messages[after_request..]).await
}

pub struct CompactionOperation {
    provider: Arc<dyn Provider>,
    model_config: ModelConfig,
    context_limit: usize,
    threshold: f64,
    manages_own_context: bool,
}

impl CompactionOperation {
    pub fn new(
        provider: Arc<dyn Provider>,
        model_config: ModelConfig,
        context_limit: usize,
        threshold: f64,
    ) -> Self {
        let manages_own_context = provider.manages_own_context();
        Self {
            provider,
            model_config,
            context_limit,
            threshold,
            manages_own_context,
        }
    }

    fn over_threshold(&self, tokens: usize) -> bool {
        if self.threshold <= 0.0 || self.threshold >= 1.0 {
            return false;
        }
        (tokens as f64 / self.context_limit as f64) > self.threshold
    }

    async fn context_tokens(&self, session: &Session, conversation: &Conversation) -> Result<i32> {
        match session.usage.total_tokens {
            Some(tokens) => Ok(tokens + unreported_tool_tokens(conversation).await?),
            None => count_context_tokens(conversation.messages()).await,
        }
    }

    async fn command_error(
        conversation: &Conversation,
        message: String,
        emit: &Emitter,
    ) -> Result<OperationResult<GooseEffect>> {
        let command = messages_since_kickoff(conversation)?
            .first()
            .cloned()
            .ok_or_else(|| anyhow!("compact command conversation has no kickoff message"))?;
        let message_id = command
            .id
            .clone()
            .ok_or_else(|| anyhow!("Persisted slash command message has no id"))?;
        let command = command.with_visibility(true, false);
        let response = Message::assistant()
            .with_text(message)
            .with_visibility(true, false);
        emit.message(command).await;
        let response = emit.message(response).await;
        yielded_with([
            ConversationEffect::SetMessageVisibility {
                message_id,
                user_visible: true,
                agent_visible: false,
            }
            .into(),
            response.into(),
        ])
    }

    async fn clear(
        conversation: &Conversation,
        emit: &Emitter,
    ) -> Result<OperationResult<GooseEffect>> {
        let command = messages_since_kickoff(conversation)?
            .first()
            .cloned()
            .ok_or_else(|| anyhow!("clear command conversation has no kickoff message"))?
            .with_visibility(true, false);
        let response = Message::assistant()
            .with_text("Conversation cleared")
            .with_visibility(true, false);
        let command = emit.message(command).await;
        let response = emit.message(response).await;
        yielded_with([
            Conversation::default().into(),
            command.into(),
            response.into(),
        ])
    }
}

#[async_trait]
impl Operation<Session, GooseEffect> for CompactionOperation {
    fn name(&self) -> &'static str {
        "compaction"
    }

    async fn run_command(
        &self,
        command: &SlashCommand<'_>,
        session: &Session,
        conversation: &Conversation,
        emit: &Emitter,
    ) -> Result<OperationResult<GooseEffect>> {
        match command.command {
            "clear" => return Self::clear(conversation, emit).await,
            "compact" => {}
            _ => return not_applicable(),
        }

        let span = chat_span(
            self.provider.as_ref(),
            &self.model_config,
            &session.id,
            "compaction",
        );
        let result = match compact_messages(
            self.provider.as_ref(),
            &self.model_config,
            &session.id,
            conversation,
            true,
        )
        .instrument(span.clone())
        .await
        {
            Ok(result) => result,
            Err(error) => {
                span.record("error.type", "compaction_error");
                return Self::command_error(conversation, error.to_string(), emit).await;
            }
        };
        let compacted = result.conversation;
        let usage = result.usage;
        record_chat_usage(&span, &usage);

        let command = messages_since_kickoff(conversation)?
            .first()
            .cloned()
            .ok_or_else(|| anyhow!("compact command conversation has no kickoff message"))?
            .with_visibility(true, false);
        let response = Message::assistant()
            .with_text("Compaction complete")
            .with_visibility(true, false);
        emit.message(command).await;
        let response = emit.message(response).await;
        yielded_with([
            GooseEffect::CompactConversation {
                conversation: compacted,
                usage: Some(usage),
            },
            response.into(),
        ])
    }

    async fn moim_parts(
        &self,
        session: &Session,
        conversation: &Conversation,
    ) -> Result<Vec<String>> {
        if self.manages_own_context {
            return Ok(Vec::new());
        }
        Ok(compaction_part(
            Some(self.context_tokens(session, conversation).await?),
            self.context_limit,
            self.threshold,
        )
        .into_iter()
        .collect())
    }

    async fn run(
        &self,
        session: &Session,
        conversation: &Conversation,
        emit: &Emitter,
    ) -> Result<OperationResult<GooseEffect>> {
        if self.manages_own_context {
            return not_applicable();
        }

        let messages = messages_since_kickoff(conversation)?;
        let reactive_context_error = matches!(
            trailing_error(conversation),
            Some(MessageErrorKind::ContextLengthExceeded)
        );

        if reactive_context_error {
            let context_errors = messages
                .iter()
                .filter(|message| {
                    message.error_kind() == Some(MessageErrorKind::ContextLengthExceeded)
                        && !message.is_agent_visible()
                })
                .count();
            if context_errors > MAX_CONTEXT_ERROR_COMPACTIONS {
                return not_applicable();
            }
        } else {
            // Compact only ahead of an inference. An assistant tail ends the turn or
            // awaits tool responses, hiding an unanswered request orphans its result,
            // and RecipeOperation delivers a successful final output from a tool tail.
            let tail = last_effective_role(messages)?;
            if tail == EffectiveRole::Assistant
                || awaits_tool_responses(messages)
                || (tail == EffectiveRole::Tool
                    && FinalOutputTool::successful_output(messages).is_some())
            {
                return not_applicable();
            }
            let tokens = self.context_tokens(session, conversation).await?;
            if tokens <= 0 || !self.over_threshold(tokens as usize) {
                return not_applicable();
            }
        }

        let conversation_with_hidden_error;
        let conversation = if reactive_context_error {
            let mut messages = conversation.messages().to_vec();
            let Some(last) = messages.last_mut() else {
                return not_applicable();
            };
            last.metadata.agent_visible = false;
            conversation_with_hidden_error = Conversation::new_unvalidated(messages);
            &conversation_with_hidden_error
        } else {
            conversation
        };

        let threshold_percentage = (self.threshold * 100.0) as u32;
        emit.message(Message::assistant().with_system_notification(
            SystemNotificationType::InlineMes
```

### Core Architecture Module: `crates/goose/src/agents/state_machine/ops_doctor.rs`
```
//! Runs session diagnostics and feeds repair context back into the turn.

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use rmcp::model::Role;

use crate::agents::state_machine::{
    applied, messages_since_kickoff, not_applicable, yielded_with, ConversationEffect, Emitter,
    GooseEffect, Operation, OperationResult, SlashCommand,
};
use crate::conversation::message::Message;
use crate::conversation::Conversation;
use crate::session::Session;

pub struct DoctorOperation;

#[async_trait]
impl Operation<Session, GooseEffect> for DoctorOperation {
    fn name(&self) -> &'static str {
        "doctor"
    }

    async fn run_command(
        &self,
        command: &SlashCommand<'_>,
        session: &Session,
        conversation: &Conversation,
        emit: &Emitter,
    ) -> Result<OperationResult<GooseEffect>> {
        if command.command != "doctor" {
            return not_applicable();
        }

        let command_message = messages_since_kickoff(conversation)?
            .first()
            .cloned()
            .ok_or_else(|| anyhow!("doctor command conversation has no kickoff message"))?;
        let message_id = command_message
            .id
            .clone()
            .ok_or_else(|| anyhow!("Persisted slash command message has no id"))?;
        // Doctor still needs the legacy Agent, so keep that lookup contained at this boundary.
        let agent = crate::execution::manager::AgentManager::instance()
            .await?
            .get_or_create_agent(session.id.clone())
            .await?;
        let result = match crate::doctor::run(&agent, &session.id).await {
            Ok(message) => message,
            Err(error) => Message::assistant().with_text(error.to_string()),
        };

        if result.role == Role::Assistant {
            let command_message = command_message.with_visibility(true, false);
            let result = result.with_visibility(true, false);
            emit.message(command_message).await;
            let result = emit.message(result).await;
            return yielded_with([
                ConversationEffect::SetMessageVisibility {
                    message_id,
                    user_visible: true,
                    agent_visible: false,
                }
                .into(),
                result.into(),
            ]);
        }

        applied([
            ConversationEffect::SetMessageVisibility {
                message_id,
                user_visible: true,
                agent_visible: false,
            }
            .into(),
            result.with_visibility(false, true).into(),
        ])
    }
}

```

### Core Architecture Module: `crates/goose/src/agents/state_machine/ops_entry_hook.rs`
```
use anyhow::Result;
use async_trait::async_trait;

use crate::agents::state_machine::effects::GooseEffect;
use crate::agents::state_machine::{
    messages_since_kickoff, not_applicable, Emitter, Operation, OperationResult,
};
use crate::conversation::message::Message;
use crate::conversation::Conversation;
use crate::hooks::{HookContext, HookEvent, HookManager};
use crate::session::Session;

pub struct EntryHookOperation {
    hook_manager: HookManager,
}

impl EntryHookOperation {
    pub fn new(hook_manager: HookManager) -> Self {
        Self { hook_manager }
    }
}

#[async_trait]
impl Operation<Session, GooseEffect> for EntryHookOperation {
    fn name(&self) -> &'static str {
        "entry_hook"
    }

    async fn run(
        &self,
        session: &Session,
        conversation: &Conversation,
        _emit: &Emitter,
    ) -> Result<OperationResult<GooseEffect>> {
        let messages = messages_since_kickoff(conversation)?;
        if messages.iter().any(|message| {
            message.role == rmcp::model::Role::Assistant
                && ((message.is_user_visible() && message.is_agent_visible())
                    || message.error_kind().is_some())
        }) {
            return not_applicable();
        }

        let messages_before_kickoff =
            &conversation.messages()[..conversation.len() - messages.len()];
        if !messages_before_kickoff.iter().any(|message| {
            message.role == rmcp::model::Role::User
                && message.is_user_visible()
                && !message.is_tool_response()
        }) {
            self.hook_manager
                .emit(
                    HookEvent::SessionStart,
                    HookContext::new(HookEvent::SessionStart, &session.id)
                        .with_working_dir(session.working_dir.to_string_lossy().to_string()),
                )
                .await;
        }

        let prompt = messages
            .first()
            .map(Message::as_concat_text)
            .unwrap_or_default();
        if !prompt.is_empty() {
            self.hook_manager
                .emit(
                    HookEvent::UserPromptSubmit,
                    HookContext::new(HookEvent::UserPromptSubmit, &session.id)
                        .with_message(prompt)
                        .with_working_dir(session.working_dir.to_string_lossy().to_string()),
                )
                .await;
        }

        not_applicable()
    }
}

```

### Core Architecture Module: `crates/goose/src/agents/state_machine/ops_exit_on_error.rs`
```
//! Ends the turn when an error remains at the end of the conversation.

use anyhow::Result;
use async_trait::async_trait;

use crate::agents::state_machine::effects::GooseEffect;
use crate::agents::state_machine::{
    not_applicable, trailing_error, yielded, Emitter, Operation, OperationResult,
};
use crate::conversation::Conversation;
use crate::session::Session;

pub struct ExitOnErrorOperation;

#[async_trait]
impl Operation<Session, GooseEffect> for ExitOnErrorOperation {
    fn name(&self) -> &'static str {
        "exit_on_error"
    }

    async fn run(
        &self,
        _session: &Session,
        conversation: &Conversation,
        _emit: &Emitter,
    ) -> Result<OperationResult<GooseEffect>> {
        if trailing_error(conversation).is_none() {
            return not_applicable();
        }

        yielded()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12698** (2026-10-06): **fix: preserve compatible provider request prefixes during compaction**
  *Symptoms*: ## Summary  Compaction currently replaces the normal provider request with a separate system prompt and serialized history. That changes the request prefix and prevents reuse of an otherwise compatible prompt cache.  Append the existing structured summary instruction to native history while keeping the original system prompt, client tool schemas, and effective thinking settings. Enable this path conservatively for built-in Anthropic, OpenAI Chat Completions, and Databricks v2 Anthropic Messages/OpenAI Responses. Keep the existing serialized fallback for unsupported routes, toolshim, disabled caching, forced tool choice, and context overflow.  The summary schema and retained conversation rules stay the same. Summary tool calls are never dispatched. Empty, incomplete, tool-bearing, cancelled, or failed summaries leave history unchanged. Provider-side tools are removed for the safe fallback or rejected before sending when the provider declares them.  ### Testing  Synthetic HTTP/SSE tests cover request-prefix equality, signed thinking, client tools, usage parsing, current-user retention, overflow fallback, cancellation, truncation, transport errors, and provider-side tool guards. Agent tests cover both the legacy and state-machine loops, proactive/manual compaction, effective thinking effort, and session isolation.  Fresh-head checks: 8 HTTP/SSE tests passed (1 live smoke ignored), 12 lifecycle tests, 2 native Agent tests, 1 toolshim regression, and 15 summary tests passed. Rust 

- **Issue #12689** (2026-10-05): **fix: support hyphenated GPT 6.1 Sol effort aliases**
  *Symptoms*: ## Why  Goose disables thinking for one-shot tasks such as compaction and session naming. GPT 6.1 Sol rejects `none`, but its hyphenated gateway aliases still produce that value. The fix in #12605 covers only the dotted spelling.  Closes #12687.  ## What  Recognize both `gpt-6.1-sol` and `gpt-6-1-sol`, including hosted aliases, so Off maps to `low`.  ## How  Extend the existing boundary-aware matcher. Keep the original model identifier on the wire, preserve Medium, and leave other model families unchanged.  ## Risk  This affects the shared OpenAI request formatter. Coverage checks both spellings, alias boundaries, and older models that still support `none`.  ## Testing  No live API testing. Temporarily restored the original matcher and ran `cargo test --locked -p goose-provider-types --lib test_responses_request_always_on_gpt6_off_uses_low_not_none`. It failed with `none` instead of `low`; the same regression passes with the fix.  Generated with Codex 

- **Issue #12687** (2026-10-05): **Bug: GPT 6.1 Sol gateway aliases fail compaction with none effort**
  *Symptoms*: 🤖 Filed by Atish's AI agent.  **Describe the bug**  GPT 6.1 Sol rejects `reasoning.effort: "none"`. Goose's one-shot tasks, including compaction and session naming, disable thinking. The formatter maps that to `none` for the hyphenated gateway alias `goose-gpt-6-1-sol`, causing HTTP 400 even when the chat uses Medium reasoning.  > reasoning.effort supports low, medium (default), high, xhigh, and max. The none and minimal reasoning efforts are not supported. https://developers.openai.com/api/docs/models/gpt-6.1-sol  **To Reproduce**  1. Select a gateway alias containing `gpt-6-1-sol`. 2. Run compaction, or serialize a Responses request with `ModelConfig::new("goose-gpt-6-1-sol").with_thinking_effort(ThinkingEffort::Off)`. 3. Observe `reasoning.effort: "none"` and the model's unsupported-value error.  **Expected behavior**  Both `gpt-6.1-sol` and `gpt-6-1-sol` should map Off to `low`, the lowest supported effort. The request must retain the original gateway model identifier.  **Screenshots**  Not applicable. This is a request-formatting failure.  **Please provide the following information**  - **OS & Arch:** macOS, arm64 - **Interface:** ACP desktop client - **Version:** observed with backend `4dea9b483efbd2541d43500b8ed3c044c65e6d2f`; the alias remains unhandled on `d7ce0cdf8c4e1fb55aabed5b6717f141c4c8220f` - **Extensions enabled:** Not relevant to the formatter - **Provider & Model:** Databricks gateway, GPT 6.1 Sol through a hyphenated alias  **Additional context**  Follow-
  **Post-Mortem & Fix Analysis**:
  > ugh. thanks!

- **Issue #12679** (2026-10-05): **fix: fixed unstable tests**
  *Symptoms*: ## Summary Fix 2 unstable tests that failed ci   
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-05T10:46:20.440674Z">2026-10-05T10:46:20.440674Z</relative-time> | `aa740f6` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #12678** (2026-10-05): **Add Darkmoon MCP server to the directory**
  *Symptoms*: ### Proposal: add Darkmoon to the MCP server/extension directory  I help maintain **Darkmoon** (GPL-3.0 autonomous AI penetration-testing platform). We publish a standalone MCP server, `@darkmoon_ai/mcp-server` (npm, runnable via `npx -y @darkmoon_ai/mcp-server`), exposing read-only tools (`list_campaigns`, `get_findings`, `get_run_status`) plus `run_pentest`, over stdio. It connects to a self-hosted Darkmoon instance.  I've opened PR #12663 adding the directory entry. Filing this issue first per the contributing flow — happy to adjust the entry to your conventions. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for submitting, but we aren't taking new entries for the extension directory. We plan to do an integration with the MCP server registry instead. https://github.com/aaif-goose/goose/discussions/10830

- **Issue #12673** (2026-10-05): **fix(cost): price Databricks GLM aliases from the zhipuai catalog**
  *Symptoms*: Fixes [#12652](https://github.com/aaif-goose/goose/issues/12652) from berd  GLM model names on Databricks (e.g. `databricks-glm-5-3-flash`) had no cost estimate. They now map to the `zhipuai` catalog prices. 

- **Issue #12672** (2026-10-05): **Document and validate scoped permissions end to end**
  *Symptoms*: **What problem would this solve?**  Scoped permissions cross runtime policy, storage, ACP, CLI, and Desktop. Without end-to-end documentation, users can mistake a convenience rule for a sandbox or misunderstand which sessions a change affects.  **What would a good outcome look like?**  Document every scope, lifetime, storage location, trust requirement, precedence conflict, inheritance rule, migration path, orphan behavior, and the distinction between permissions and sandboxing. Produce a traceability matrix from acceptance criteria to tests and UX evidence.  **Verification plan**  Run formatting, build/check, targeted/regression tests, clippy, both agent loops where applicable, Desktop typecheck/tests, migration rollback rehearsal, security review, and final scored GO/NO-GO.  - [x] I searched for an existing end-to-end scoped-permission validation issue and found none.  **Contribution gate**  Do not begin implementation until this issue reaches Ready on the Goose Issues board: https://github.com/orgs/aaif-goose/projects/1.  Parent proposal: #12665.  ## Personal implementation reference (not an upstream PR)  A personal proof-of-concept exists for design review only:  - **Branch:** [bioinfornatics/goose:feat/permissions-scoped-integration](https://github.com/bioinfornatics/goose/tree/feat/permissions-scoped-integration) - **Proposed future PR base:** feat/permissions-scoped-desktop, merging feat/permissions-scoped-cli - **Implemented scope:** Integrated scoped permissions, doc
  **Post-Mortem & Fix Analysis**:
  > Dependencies: final validation follows #12667, #12668, #12669, #12670, and #12671.
  > 🤖 We should first discuss the path forward in the root issue, #12665. If that proposal moves forward through Accepted / design and then Ready, this issue can be reopened or reformulated as needed.

- **Issue #12671** (2026-10-05): **Add scope-aware permission management to Goose CLI**
  *Symptoms*: **What problem would this solve?**  The CLI needs the same scoped semantics as Desktop without requiring internal identifiers and without sending /permissions to the model.  **What would a good outcome look like?**  Provide interactive and scriptable list/set/reset operations. Browse by extension and human-readable function. Show current session filter separately from persistence destination. Reject ambiguous names. Avoid blocking prompts in non-interactive mode. Preserve technical IDs as optional diagnostics.  Potential syntax, subject to design: /permissions list; /permissions set TOOL allow|ask|deny --scope SCOPE; /permissions reset TOOL --scope SCOPE.  **Verification plan**  Parser/completion, interactive cancellation and ambiguity, unavailable scopes, non-interactive behavior, no provider request, and parity with Desktop mutations.  - [x] I searched for an existing scope-aware CLI permission issue and found none.  **Contribution gate**  Do not begin implementation until this issue reaches Ready on the Goose Issues board: https://github.com/orgs/aaif-goose/projects/1.  Parent proposal: #12665.  ## Personal implementation reference (not an upstream PR)  A personal proof-of-concept exists for design review only:  - **Branch:** [bioinfornatics/goose:feat/permissions-scoped-cli](https://github.com/bioinfornatics/goose/tree/feat/permissions-scoped-cli) - **Proposed future PR base:** feat/permissions-scoped-acp - **Implemented scope:** Host-side interactive picker and scriptabl
  **Post-Mortem & Fix Analysis**:
  > Dependency: implement after the scoped ACP contract in #12669. It may proceed in parallel with the Desktop issue #12670.
  > 🤖 We should first discuss the path forward in the root issue, #12665. If that proposal moves forward through Accepted / design and then Ready, this issue can be reopened or reformulated as needed.

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

### Incident Patch 1: `540df77c` (2026-10-06)
**Commit Message**: fix(acp): treat a client extension selection as the exact session set (#12548)

Signed-off-by: Seydi Charyyev <[REDACTED_EMAIL]>

**File**: `crates/goose/src/acp/server.rs` (modified, +128/-4)
```diff
@@ -581,16 +581,22 @@ fn initial_session_extensions(
     goose_extensions: Option<Vec<GooseExtension>>,
     recipe_extensions: Option<&[ExtensionConfig]>,
 ) -> Result<Vec<ExtensionConfig>, agent_client_protocol::Error> {
+    // A selection the client sends is the whole session: an empty list starts no
+    // extensions, and `[memory]` starts Memory without the default built-ins.
+    if let (None, Some(goose_extensions)) = (recipe_extensions, goose_extensions) {
+        let mut selected = Vec::new();
+        for extension in extensions::goose_extensions_to_configs(goose_extensions)? {
+            push_or_replace_extension(&mut selected, extension);
+        }
+        return Ok(selected);
+    }
+
     let mut extensions = selected_builtin_extensions(config, builtin_selection);
 
     if let Some(recipe_extensions) = recipe_extensions {
         for extension in recipe_extensions {
             push_or_replace_extension(&mut extensions, extension.clone());
         }
-    } else if let Some(goose_extensions) = goose_extensions {
-        for extension in extensions::goose_extensions_to_configs(goose_extensions)? {
-            push_or_replace_extension(&mut extensions, extension);
-        }
     } else {
         for extension in get_enabled_extensions_with_config(config) {
             push_or_replace_extension(&mut extensions, extension);
@@ -2962,6 +2968,124 @@ extensions:
             .any(|extension| extension.name() == "zed-mcp"));
     }
 
+    fn requested_builtin(name: &str) -> GooseExtension {
+        GooseExtension::Builtin {
+            name: name.to_string(),
+            description: None,
+            display_name: None,
+            timeout: None,
+            bundled: None,
+            available_tools: None,
+        }
+    }
+
+    fn developer_enabled_config() -> (Config, NamedTempFile, NamedTempFile) {
+        config_with_yaml(
+            r#"
+extensions:
+  developer:
+    enabled: true
+    type: builtin
+    name: developer
+"#,
+        )
+    }
+
+    #[test]
+    fn client_selection_replaces_the_builtins() {
+        let (config, _c, _s) = developer_enabled_config();
+        let project_root = tempfile::tempdir().unwrap();
+
+        for selection in [default_builtin("developer"), explicit_builtin("developer")] {
+            let extensions = initial_session_extensions(
+                &config,
+                &selection,
+                project_root.path(),
+                vec![],
+                Some(vec![requested_builtin("memory")]),
+                None,
+            )
+            .unwrap();
+
+            let names: Vec<String> = extensions.iter().map(ExtensionConfig::name).collect();
+            assert_eq!(names, vec!["memory".to_string()]);
+        }
+    }
+
+    #[test]
+    fn empty_client_selection_starts_no_extensions() {
+        let (config, _c, _s) = developer_enabled_config();
+        let project_root = tempfile::tempdir().unwrap();
+
+        let extensions = initial_session_extensions(
+            &config,
+            &default_builtin("developer"),
+            project_root.path(),
+            vec![],
+            Some(vec![]),
+            None,
+        )
+        .unwrap();
+
+        assert!(extensions.is_empty());
+    }
+
+    #[test]
+    fn client_selection_ignores_configured_extensions_and_request_mcp_servers() {
+        let (config, _c, _s) = config_with_yaml(
+            r#"
+extensions:
+  developer:
+    enabled: true
+    type: builtin
+    name: developer
+  computercontroller:
+    enabled: true
+    type: builtin
+    name: computercontroller
+"#,
+        );
+        let project_root = tempfile::tempdir().unwrap();
+
+        let extensions = initial_session_extensions(
+            &config,
+            &default_builtin("developer"),
+            project_root.path(),
+            vec![McpServer::Http(McpServerHttp::new(
+                "zed-mcp",
+                "http://localhost/mcp",
+            ))],
+            Some(vec![requested_builtin("memory")]),
+            None,
+        )
+        .unwrap();
+
+        let names: Vec<String> = extensions.iter().map(ExtensionConfig::name).collect();
+        assert_eq!(names, vec!["memory".to_string()]);
+    }
+
+    #[test]
+    fn recipe_extensions_still_load_with_the_builtins() {
+        let (config, _c, _s) = developer_enabled_config();
+        let project_root = tempfile::tempdir().unwrap();
+        let recipe_extensions = vec![builtin_to_extension_config("memory")];
+
+        let extensions = initial_session_extensions(
+            &config,
+            &default_builtin("developer"),
+            project_root.path(),
+            vec![],
+            Some(vec![]),
+            Some(&recipe_extensions),
+        )
+        .unwrap();
+
+        assert!(has_developer(&extensions));
+        assert!(extensions
+            .iter()
+            .any(|extension| extension.name() == "memory"));
+    }
+
     #[test]
     fn acp_mcp_is_additive_to_stored_extens
```

---

### Incident Patch 2: `104ddde5` (2026-10-05)
**Commit Message**: Foreground subagents in the state machine loop (#12632)

**File**: `crates/goose-cli/src/session/mod.rs` (modified, +8/-0)
```diff
@@ -1343,6 +1343,7 @@ impl CliSession {
         let mut first_token_at: Option<Instant> = None;
         let mut last_usage: Option<ProviderUsage> = None;
         let mut stream_error = None;
+        let mut failed_before_stop = false;
 
         use futures::StreamExt;
         loop {
@@ -1508,6 +1509,7 @@ impl CliSession {
                             if interactive || !is_stream_json_mode {
                                 handle_agent_error(&e, is_stream_json_mode);
                             }
+                            failed_before_stop = !cancel_token_clone.is_cancelled();
                             cancel_token_clone.cancel();
                             drop(stream);
                             if let Err(e) = self.handle_interrupted_messages(false).await {
@@ -1536,6 +1538,12 @@ impl CliSession {
             }
         }
 
+        if cancel_token_clone.is_cancelled() && !failed_before_stop {
+            self.agent
+                .cancel_foreground_subagents(&self.session_id)
+                .await;
+        }
+
         let terminal_error = headless_run_error(
             interactive,
             cancel_token_clone.is_cancelled(),
```

**File**: `crates/goose/src/acp/server.rs` (modified, +2/-0)
```diff
@@ -2241,6 +2241,8 @@ impl GooseAcpAgent {
 
         if cancel_token.is_cancelled() {
             was_cancelled = true;
+            drop(stream);
+            agent.cancel_foreground_subagents(session_id).await;
         }
 
         if !was_cancelled {
```

**File**: `crates/goose/src/acp/server/live_voice.rs` (modified, +5/-3)
```diff
@@ -284,9 +284,7 @@ impl GooseAcpAgent {
         };
         while let Some(event) = stream.next().await {
             if cancel_token.is_cancelled() {
-                self.clear_active_run(&session_id, &run_id).await;
-                let _ = Self::send_active_run_update(&cx, &acp_session_id, None);
-                return "The task was cancelled.".into();
+                break;
             }
             match event {
                 Ok(crate::agents::AgentEvent::Message(message)) => {
@@ -362,6 +360,10 @@ impl GooseAcpAgent {
             }
         }
 
+        if cancel_token.is_cancelled() {
+            drop(stream);
+            agent.cancel_foreground_subagents(&session_id).await;
+        }
         self.clear_active_run(&session_id, &run_id).await;
         let _ = Self::send_active_run_update(&cx, &acp_session_id, None);
         if cancel_token.is_cancelled() {
```

**File**: `crates/goose/src/agents/agent.rs` (modified, +43/-9)
```diff
@@ -34,14 +34,15 @@ use crate::agents::prompt_manager::PromptManager;
 use crate::agents::retry::{RetryManager, RetryResult};
 use crate::agents::state_machine::{
     has_unapplied_tool_confirmation_response, pending_tool_confirmations,
-    persist_tool_confirmation_decision, run_goose, BangShellOperation, CompactionOperation,
-    DoctorOperation, Emitter, EntryHookOperation, ExitOnErrorOperation, GooseEffect,
-    GooseInferenceProvider, GooseInferenceRequestPreparer, InferenceRunner, MaxTurnsOperation,
-    Operation, ProjectOperation, RecipeOperation, RetryOperation, SkillOperation,
-    SlashCommandOperation, StateMachine, StatusOperation, SteerOperation, SteerQueue, Step,
-    StopHookOperation, ToolApprovalOperation, ToolExecutionOperation, ToolPairCompactionOperation,
-    UnknownToolOperation, MAX_TURNS_MESSAGE,
+    persist_tool_confirmation_decision, run_goose, subagent_cancelled_message, BangShellOperation,
+    CompactionOperation, DoctorOperation, Emitter, EntryHookOperation, ExitOnErrorOperation,
+    ForegroundSubagentOperation, GooseEffect, GooseInferenceProvider,
+    GooseInferenceRequestPreparer, InferenceRunner, MaxTurnsOperation, Operation, ProjectOperation,
+    RecipeOperation, RetryOperation, SkillOperation, SlashCommandOperation, StateMachine,
+    StatusOperation, SteerOperation, SteerQueue, Step, StopHookOperation, ToolApprovalOperation,
+    ToolExecutionOperation, ToolPairCompactionOperation, UnknownToolOperation, MAX_TURNS_MESSAGE,
 };
+use crate::agents::subagent_handler::ForegroundSubagentRunner;
 use crate::agents::types::{
     SessionConfig, SharedProvider, DEFAULT_ON_FAILURE_TIMEOUT_SECONDS,
     DEFAULT_RETRY_TIMEOUT_SECONDS,
@@ -1454,7 +1455,7 @@ impl Agent {
         Ok(results)
     }
 
-    async fn add_extension_inner(
+    pub(super) async fn add_extension_inner(
         &self,
         extension: ExtensionConfig,
         session_id: &str,
@@ -1767,6 +1768,16 @@ impl Agent {
                 self.hook_manager.clone(),
                 Arc::clone(&extension_lease),
             )),
+            // Before RecipeOperation: a `delegate` response only means the subagent
+            // started, so a final output from the same batch must not be shown until
+            // the subagents have run.
+            Arc::new(ForegroundSubagentOperation::new(
+                ForegroundSubagentRunner::new(
+                    self.config.session_manager.clone(),
+                    self.config.resolve_use_login_shell_path(),
+                ),
+                cancel.clone(),
+            )),
             Arc::new(RecipeOperation::new(
                 provider.clone(),
                 self.hook_manager.clone(),
@@ -1925,6 +1936,29 @@ impl Agent {
             .map(|stream| crate::session_context::with_session_id_stream(Some(session_id), stream)))
     }
 
+    pub async fn cancel_foreground_subagents(&self, session_id: &str) {
+        if let Err(error) = self.record_cancelled_subagents(session_id).await {
+            error!(
+                session_id,
+                ?error,
+                "Failed to record cancelled foreground subagents"
+            );
+        }
+    }
+
+    async fn record_cancelled_subagents(&self, session_id: &str) -> Result<()> {
+        let session_manager = &self.config.session_manager;
+        let session = session_manager.get_session(session_id, true).await?;
+        let Some(message) = session
+            .conversation
+            .as_ref()
+            .and_then(|conversation| subagent_cancelled_message(conversation.messages()))
+        else {
+            return Ok(());
+        };
+        session_manager.add_message(session_id, &message).await
+    }
+
     async fn resume_state_machine_turn_inner(
         self: &Arc<Self>,
         session_config: SessionConfig,
@@ -2051,7 +2085,7 @@ impl Agent {
         })
     }
 
-    async fn stream_state_machine_session(
+    pub(super) async fn stream_state_machine_session(
         &self,
         session_config: SessionConfig,
         cancel: CancellationToken,
```

**File**: `crates/goose/src/agents/extension_manager/lease.rs` (modified, +10/-2)
```diff
@@ -561,6 +561,7 @@ impl ExtensionLease {
             tool_call_id,
             notification_emitter,
             container,
+            from_state_machine,
         } = request;
         let client = resolved.extension.client.clone();
         let action_required_stream = self.action_required_stream(tool_call_id.as_deref()).await;
@@ -576,6 +577,7 @@ impl ExtensionLease {
         )
         .with_container(container)
         .with_extension_lease(Arc::new(self.clone()));
+        call_context.from_state_machine = from_state_machine;
         if let Some(emitter) = emitter {
             call_context = call_context.with_notification_emitter(emitter);
         }
@@ -667,21 +669,26 @@ pub struct CallRequest {
     pub(crate) tool_call_id: Option<String>,
     pub(crate) notification_emitter: Option<ToolCallNotificationEmitter>,
     pub(crate) container: Option<Container>,
+    pub(crate) from_state_machine: bool,
 }
 
 impl CallRequest {
     pub fn new(tool_call_id: impl Into<String>) -> Self {
         Self {
             tool_call_id: Some(tool_call_id.into()),
-            notification_emitter: None,
-            container: None,
+            ..Default::default()
         }
     }
 
     pub(crate) fn with_container(mut self, container: Option<Container>) -> Self {
         self.container = container;
         self
     }
+
+    pub(crate) fn with_state_machine(mut self) -> Self {
+        self.from_state_machine = true;
+        self
+    }
 }
 
 impl From<&ToolCallContext> for CallRequest {
@@ -690,6 +697,7 @@ impl From<&ToolCallContext> for CallRequest {
             tool_call_id: ctx.tool_call_request_id.clone(),
             notification_emitter: ctx.notification_emitter().cloned(),
             container: ctx.container().cloned(),
+            from_state_machine: ctx.from_state_machine,
         }
     }
 }
```

**File**: `crates/goose/src/agents/final_output_tool.rs` (modified, +123/-0)
```diff
@@ -1,11 +1,13 @@
 use crate::agents::tool_execution::ToolCallResult;
+use crate::conversation::message::{Message, MessageContent};
 use crate::recipe::Response;
 use indoc::formatdoc;
 use rmcp::model::{
     CallToolRequestParams, ContentBlock, ErrorCode, ErrorData, Tool, ToolAnnotations,
 };
 use serde_json::Value;
 use std::borrow::Cow;
+use std::collections::HashSet;
 
 pub const FINAL_OUTPUT_TOOL_NAME: &str = "recipe__final_output";
 pub const FINAL_OUTPUT_SUCCESS_MESSAGE: &str = "Final output successfully collected.";
@@ -47,6 +49,127 @@ impl FinalOutputTool {
         })
     }
 
+    fn assistant_block_bounds(messages: &[Message], message_index: usize) -> (usize, usize) {
+        let start = (0..message_index)
+            .rev()
+            .take_while(|index| messages[*index].role == rmcp::model::Role::Assistant)
+            .last()
+            .unwrap_or(message_index);
+        let end = (message_index + 1..messages.len())
+            .take_while(|index| messages[*index].role == rmcp::model::Role::Assistant)
+            .last()
+            .map_or(message_index + 1, |index| index + 1);
+        (start, end)
+    }
+
+    pub(crate) fn has_unanswered_siblings(messages: &[Message], request_id: &str) -> bool {
+        let answered: HashSet<&str> = messages
+            .iter()
+            .flat_map(|message| &message.content)
+            .filter_map(|content| match content {
+                MessageContent::ToolResponse(response) => Some(response.id.as_str()),
+                _ => None,
+            })
+            .collect();
+        let Some(message_index) = messages.iter().position(|message| {
+            message.content.iter().any(|content| {
+                matches!(
+                    content,
+                    MessageContent::ToolRequest(request) if request.id == request_id
+                )
+            })
+        }) else {
+            return false;
+        };
+        let (start, end) = Self::assistant_block_bounds(messages, message_index);
+        messages[start..end]
+            .iter()
+            .flat_map(|message| &message.content)
+            .any(|content| match content {
+                // Another unanswered final-output call is not a reason to wait.
+                // This operation drains them one per pass, so treating a sibling
+                // final-output call as unfinished work would deadlock the pair:
+                // each would wait for the other and neither would be answered.
+                // Ordinary tool calls still have to finish first.
+                MessageContent::ToolRequest(request) => {
+                    request.id != request_id
+                        && !answered.contains(request.id.as_str())
+                        && !request
+                            .tool_call
+                            .as_ref()
+                            .is_ok_and(|tool_call| tool_call.name == FINAL_OUTPUT_TOOL_NAME)
+                }
+                _ => false,
+            })
+    }
+
+    pub(crate) fn successful_output(messages: &[Message]) -> Option<String> {
+        let answered_responses: HashSet<&str> = messages
+            .iter()
+            .flat_map(|message| &message.content)
+            .filter_map(|content| match content {
+                MessageContent::ToolResponse(response) => Some(response.id.as_str()),
+                _ => None,
+            })
+            .collect();
+        let successful_responses: HashSet<&str> = messages
+            .iter()
+            .flat_map(|message| &message.content)
+            .filter_map(|content| match content {
+                MessageContent::ToolResponse(response)
+                    if response.tool_result.as_ref().is_ok_and(|result| {
+                        result.is_error != Some(true)
+                            && result.content.iter().any(|content| {
+                                content
+                                    .as_text()
+                                    .is_some_and(|text| text.text == FINAL_OUTPUT_SUCCESS_MESSAGE)
+                            })
+                    }) =>
+                {
+                    Some(response.id.as_str())
+                }
+                _ => None,
+            })
+            .collect();
+
+        for (message_index, message) in messages.iter().enumerate().rev() {
+            let output = message
+                .content
+                .iter()
+                .rev()
+                .find_map(|content| match content {
+                    MessageContent::ToolRequest(request)
+                        if successful_responses.contains(request.id.as_str()) =>
+                    {
+                        request.tool_call.as_ref().ok().and_then(|tool_call| {
+                            (tool_call.name == FINAL_OUTPUT_TOOL_NAME).then(|| {
+                                serde_json::Value::Object(
+                                    tool_call.arguments.clone().unwrap_or_default(),
+              
```

**File**: `crates/goose/src/agents/platform_extensions/orchestrator.rs` (modified, +3/-0)
```diff
@@ -590,6 +590,9 @@ impl OrchestratorClient {
         }
 
         drop(stream);
+        if cancel_token.is_cancelled() {
+            agent.cancel_foreground_subagents(&session_id).await;
+        }
         guard.disarm();
         manager.unregister_cancel_token(&session_id).await;
 
```

**File**: `crates/goose/src/agents/platform_extensions/summon.rs` (modified, +232/-4)
```diff
@@ -1,17 +1,19 @@
 use crate::agents::extension::PlatformExtensionContext;
+use crate::agents::final_output_tool::FinalOutputTool;
 use crate::agents::mcp_client::{Error, McpClientTrait};
 use crate::agents::subagent_handler::{run_subagent_task, OnMessageCallback, SubagentRunParams};
 use crate::agents::subagent_task_config::{TaskConfig, DEFAULT_SUBAGENT_MAX_TURNS};
 use crate::agents::tool_execution::{ToolCallContext, ToolCallNotificationEmitter};
 use crate::agents::AgentConfig;
 use crate::config::paths::Paths;
 use crate::config::{Config, GooseMode};
+use crate::conversation::message::Message;
 use crate::providers;
 use crate::recipe::build_recipe::build_recipe_from_template;
 use crate::recipe::local_recipes::load_local_recipe_file;
-use crate::recipe::{Recipe, RecipeParameter, Settings, RECIPE_FILE_EXTENSIONS};
-use crate::session::extension_data::EnabledExtensionsState;
-use crate::session::SessionType;
+use crate::recipe::{Recipe, RecipeParameter, Response, Settings, RECIPE_FILE_EXTENSIONS};
+use crate::session::extension_data::{EnabledExtensionsState, ExtensionData, ExtensionState};
+use crate::session::{Session, SessionType};
 use crate::sources::parse_frontmatter;
 use crate::utils::safe_truncate;
 use anyhow::Result;
@@ -1373,6 +1375,7 @@ impl SummonClient {
         arguments: Option<JsonObject>,
         cancellation_token: CancellationToken,
         notification_emitter: Option<ToolCallNotificationEmitter>,
+        from_state_machine: bool,
     ) -> Result<CallToolResult, String> {
         self.cleanup_completed_tasks().await;
 
@@ -1404,6 +1407,10 @@ impl SummonClient {
             return Err("Delegated tasks cannot spawn further delegations".to_string());
         }
 
+        if from_state_machine {
+            return self.handle_foreground_delegate(params, &session).await;
+        }
+
         if params.r#async {
             let (content, task_id) = self
                 .handle_async_delegate(session_id, params, session)
@@ -1483,6 +1490,104 @@ impl SummonClient {
         }
     }
 
+    async fn handle_foreground_delegate(
+        &self,
+        params: DelegateParams,
+        parent: &Session,
+    ) -> Result<CallToolResult, String> {
+        let mut recipe = self
+            .build_delegate_recipe(&params, &parent.id, &parent.working_dir)
+            .await?;
+        let task_config = self
+            .build_task_config(&params, &recipe, parent)
+            .await
+            .map_err(|e| format!("Failed to build task config: {e}"))?;
+        crate::providers::get_from_registry(task_config.provider.get_name())
+            .await
+            .map_err(|_| {
+                format!(
+                    "Provider '{}' cannot be reconstructed for a foreground subagent",
+                    task_config.provider.get_name()
+                )
+            })?;
+
+        let max_turns = task_config
+            .max_turns
+            .expect("TaskConfig always sets max_turns");
+        recipe
+            .settings
+            .get_or_insert(Settings {
+                goose_provider: None,
+                goose_model: None,
+                temperature: None,
+                max_turns: None,
+            })
+            .max_turns = Some(max_turns);
+        if recipe
+            .response
+            .as_ref()
+            .and_then(|response| response.json_schema.as_ref())
+            .is_none()
+        {
+            recipe.response = Some(Response {
+                json_schema: Some(serde_json::json!({
+                    "type": "object",
+                    "properties": {"summary": {"type": "string"}},
+                    "required": ["summary"]
+                })),
+            });
+        }
+        FinalOutputTool::try_new(recipe.response.as_ref().unwrap().clone())
+            .map_err(|e| format!("Invalid delegate response schema: {e}"))?;
+
+        let mut extension_data = ExtensionData::default();
+        EnabledExtensionsState::new(task_config.extensions.clone())
+            .to_extension_data(&mut extension_data)
+            .map_err(|e| format!("Failed to save delegate extensions: {e}"))?;
+
+        let child = self
+            .create_subagent_session(&task_config, "Delegated task".to_string())
+            .await?;
+        let task = recipe
+            .prompt
+            .clone()
+            .unwrap_or_else(|| "Begin.".to_string());
+        self.context
+            .session_manager
+            .update(&child.id)
+            .recipe(Some(recipe))
+            .provider_name(task_config.provider.get_name())
+            .model_config(task_config.model_config)
+            .extension_data(extension_data)
+            .apply()
+            .await
+            .map_err(|e| format!("Failed to save delegate configuration: {e}"))?;
+
+        self.context
+            .session_manager
+            .add_message(
+                &child.id,
+                &Message::user().with_text(format!("Subagent ID: {}\n\n{task}", child.
```

---

### Incident Patch 3: `7debb275` (2026-10-05)
**Commit Message**: fix: support hyphenated GPT 6.1 Sol effort aliases (#12689)

**File**: `crates/goose-provider-types/src/formats/openai.rs` (modified, +30/-4)
```diff
@@ -1929,14 +1929,14 @@ pub(crate) fn openai_reasoning_efforts_for_model(model_name: &str) -> &'static [
             &["high"]
         } else if normalized.contains("gpt-6") {
             // GPT-6 Astra and GPT-6.1 Sol require reasoning; GPT-6 Sol and Luna may disable it.
-            let is_gpt_6_1_sol = normalized
-                .match_indices("gpt-6.1-sol")
-                .any(|(index, name)| {
+            let is_gpt_6_1_sol = ["gpt-6.1-sol", "gpt-6-1-sol"].iter().any(|needle| {
+                normalized.match_indices(needle).any(|(index, name)| {
                     let (prefix, rest) = normalized.split_at(index);
                     let (_, suffix) = rest.split_at(name.len());
                     (prefix.is_empty() || prefix.ends_with(['/', '.', '-']))
                         && (suffix.is_empty() || suffix.starts_with(['-', '@']))
-                });
+                })
+            });
             if normalized.contains("astra") || is_gpt_6_1_sol {
                 &["low", "medium", "high", "xhigh", "max"]
             } else {
@@ -3446,6 +3446,14 @@ mod tests {
             "gpt-6.1-sol@eu",
             "openai/gpt-6.1-sol-fast",
             "openai/gpt-6.1-sol-fast-high",
+            "gpt-6-1-sol",
+            "gpt-6-1-sol-high",
+            "goose-gpt-6-1-sol",
+            "catalog.schema.goose-gpt-6-1-sol",
+            "openrouter/openai/gpt-6-1-sol",
+            "gpt-6-1-sol@eu",
+            "openai/gpt-6-1-sol-fast-high",
+            "GOOSE-GPT-6-1-SOL",
         ] {
             assert_eq!(
                 openai_reasoning_effort_for_thinking(model, ThinkingEffort::Off),
@@ -3477,6 +3485,24 @@ mod tests {
         );
     }
 
+    #[test]
+    fn test_gpt6_1_sol_effort_matching_respects_model_boundaries() {
+        for model in [
+            "gpt-6.1-solstice",
+            "gpt-6-1-solstice",
+            "gpt-6.10-sol",
+            "gpt-6-10-sol",
+            "notgpt-6-1-sol",
+            "catalog.schema.notgpt-6-1-sol",
+        ] {
+            assert_eq!(
+                openai_reasoning_effort_for_thinking(model, ThinkingEffort::Off),
+                Some("none".to_string()),
+                "{model} must not match GPT 6.1 Sol"
+            );
+        }
+    }
+
     #[test]
     fn test_create_request_gpt5_pro_max_effort_uses_supported_level() -> anyhow::Result<()> {
         let model_config = test_model_config("gpt-5.2-pro-2025-12-11")
```

**File**: `crates/goose-provider-types/src/formats/openai_responses.rs` (modified, +10/-2)
```diff
@@ -2043,8 +2043,16 @@ mod tests {
     }
 
     #[test]
-    fn test_responses_request_gpt6_astra_off_uses_low_not_none() {
-        for model_name in ["gpt-6-astra", "data_workflow_tools.goose.goose-gpt-6-astra"] {
+    fn test_responses_request_always_on_gpt6_off_uses_low_not_none() {
+        for model_name in [
+            "gpt-6-astra",
+            "data_workflow_tools.goose.goose-gpt-6-astra",
+            "gpt-6.1-sol",
+            "gpt-6-1-sol",
+            "goose-gpt-6-1-sol",
+            "catalog.schema.goose-gpt-6-1-sol",
+            "openrouter/openai/gpt-6-1-sol",
+        ] {
             let model_config = ModelConfig::new(model_name)
                 .with_thinking_effort(crate::thinking::ThinkingEffort::Off);
 
```

---

### Incident Patch 4: `d7ce0cdf` (2026-10-05)
**Commit Message**: fix: fixed unstable tests (#12679)

**File**: `crates/goose/src/scheduler/full.rs` (modified, +23/-6)
```diff
@@ -1382,16 +1382,33 @@ mod tests {
         };
 
         scheduler.add_scheduled_job(job, true).await.unwrap();
-        sleep(Duration::from_millis(1500)).await;
+        let (jobs, sessions) = tokio::time::timeout(Duration::from_secs(3), async {
+            let mut poll = tokio::time::interval(Duration::from_secs(1));
+            loop {
+                poll.tick().await;
+                let jobs = scheduler.list_scheduled_jobs().await;
+                let sessions = session_manager
+                    .list_sessions_by_types(&[SessionType::Scheduled])
+                    .await
+                    .unwrap();
+                if jobs[0].last_run.is_some() && !sessions.is_empty() {
+                    break (jobs, sessions);
+                }
+            }
+        })
+        .await
+        .expect("Scheduled job should run and create a session within 3 seconds");
 
-        let jobs = scheduler.list_scheduled_jobs().await;
         assert!(jobs[0].last_run.is_some(), "Job should have run");
-        let sessions = session_manager
-            .list_sessions_by_types(&[SessionType::Scheduled])
+        assert!(
+            !sessions.is_empty(),
+            "Scheduled job should create a session"
+        );
+        assert_eq!(sessions[0].goose_mode, GooseMode::Auto);
+        scheduler
+            .remove_scheduled_job("scheduled_job", false)
             .await
             .unwrap();
-        assert_eq!(sessions.len(), 1);
-        assert_eq!(sessions[0].goose_mode, GooseMode::Auto);
     }
 
     #[tokio::test]
```

**File**: `crates/goose/tests/subprocess_cleanup.rs` (modified, +6/-6)
```diff
@@ -175,13 +175,13 @@ fn long_lived_child_process_survives_spawning_thread_exit() {
     );
 
     let deadline = Instant::now() + Duration::from_secs(5);
-    while process_is_running(child_pid) && Instant::now() < deadline {
+    while process_is_running(child_pid) {
+        assert!(
+            Instant::now() < deadline,
+            "child process {child_pid} survived parent process death"
+        );
         std::thread::sleep(Duration::from_millis(100));
     }
-    assert!(
-        !process_is_running(child_pid),
-        "child process {child_pid} survived parent process death"
-    );
 }
 
 fn process_exists(pid: u32) -> bool {
@@ -190,7 +190,7 @@ fn process_exists(pid: u32) -> bool {
 
 fn process_is_running(pid: u32) -> bool {
     match process_state(pid) {
-        Some('Z') | None => false,
+        Some('Z' | 'X') | None => false,
         Some(_) => true,
     }
 }
```

---

### Incident Patch 5: `d9dda309` (2026-10-05)
**Commit Message**: fix(desktop): use a system Node.js in the Windows npx wrapper (#12176)

Signed-off-by: Seydi Charyyev <[REDACTED_EMAIL]>

**File**: `ui/desktop/src/platform/windows/bin/README.md` (modified, +5/-1)
```diff
@@ -6,7 +6,11 @@ This directory contains Windows-specific scripts that are only included during W
 
 ### Node.js Installation
 
-- `npx.cmd` downloads portable Node.js to `%LOCALAPPDATA%\Goose\node` when needed.
+`npx.cmd` uses the first Node.js that fits, in this order:
+
+1. Portable Node.js that Goose already downloaded to `%LOCALAPPDATA%\Goose\node`.
+2. The first `node.exe` on `PATH` that is version 22 or newer and has a working `npx.cmd` next to it (`npx.cmd --version` must succeed).
+3. Otherwise, it downloads portable Node.js to `%LOCALAPPDATA%\Goose\node`.
 
 ### Windows Binaries
 
```

**File**: `ui/desktop/src/platform/windows/bin/npx.cmd` (modified, +18/-0)
```diff
@@ -5,6 +5,7 @@ if not defined GOOSE_NODE_DIR (
     SET "GOOSE_NODE_DIR=%LOCALAPPDATA%\Goose\node"
 )
 SET "NODE_VERSION=22.14.0"
+SET "MIN_SYSTEM_NODE_MAJOR=22"
 
 REM === Check for previously downloaded portable Node.js (matching version) ===
 if exist "%GOOSE_NODE_DIR%\node-v%NODE_VERSION%.installed" (
@@ -13,6 +14,23 @@ if exist "%GOOSE_NODE_DIR%\node-v%NODE_VERSION%.installed" (
     exit /b !errorlevel!
 )
 
+REM === Use a system Node.js from PATH ===
+REM Look for node.exe, not npx.cmd: a bare npx.cmd lookup can find this wrapper.
+REM A broken npm install fails "npx --version", so the next candidate or the download is used.
+for /f "delims=" %%N in ('where $PATH:node.exe 2^>nul') do (
+    if exist "%%~dpNnpx.cmd" (
+        "%%N" -e "process.exit(parseInt(process.versions.node) >= %MIN_SYSTEM_NODE_MAJOR% ? 0 : 1)" <nul >nul 2>&1
+        if "!errorlevel!"=="0" (
+            call "%%~dpNnpx.cmd" --version <nul >nul 2>&1
+            if "!errorlevel!"=="0" (
+                SET "PATH=%%~dpN;!PATH!"
+                "%%~dpNnpx.cmd" %*
+                exit /b !errorlevel!
+            )
+        )
+    )
+)
+
 REM === Download portable Node.js ===
 echo [Goose] Node.js not found. Downloading portable Node.js v%NODE_VERSION%... 1>&2
 
```

**File**: `ui/desktop/src/platform/windows/npx.test.ts` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+import fs from 'node:fs';
+import os from 'node:os';
+import path from 'node:path';
+import { spawnSync } from 'node:child_process';
+import { fileURLToPath } from 'node:url';
+import { afterAll, beforeAll, describe, expect, it } from 'vitest';
+
+const wrapperPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bin', 'npx.cmd');
+const system32 = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
+
+// Stands in for npm's npx.cmd: runs the node.exe next to it, like the real one does.
+const fakeNpx =
+  '@ECHO OFF\r\nif "%~1"=="--version" exit /b 0\r\n"%~dp0node.exe" "%FAKE_NPX_REPORT%" %*\r\n';
+
+// The last line of npm's real npx.cmd. Without node_modules next to it, npm is incomplete.
+const brokenNpx = '@ECHO OFF\r\n"%~dp0node.exe" "%~dp0node_modules\\npm\\bin\\npx-cli.js" %*\r\n';
+
+const reportSource = `
+const chunks = [];
+process.stdin.on('data', (chunk) => chunks.push(chunk));
+process.stdin.on('end', () => {
+  console.log(JSON.stringify({
+    nodeDir: require('path').dirname(process.execPath),
+    firstPathEntry: process.env.PATH.split(';')[0],
+    args: process.argv.slice(2),
+    stdin: Buffer.concat(chunks).toString(),
+  }));
+  process.exit(Number(process.env.FAKE_NPX_EXIT));
+});
+`;
+
+type ChildReport = {
+  nodeDir: string;
+  firstPathEntry: string;
+  args: string[];
+  stdin: string;
+};
+
+describe.skipIf(process.platform !== 'win32')('Windows npx wrapper', () => {
+  let rootDir: string;
+  let systemNodeDir: string;
+  let nodeWithoutNpxDir: string;
+  let failingNodeDir: string;
+  let brokenNpmDir: string;
+  let portableNodeDir: string;
+  let emptyNodeDir: string;
+
+  function makeDir(name: string) {
+    const dir = path.join(rootDir, name);
+    fs.mkdirSync(dir);
+    return dir;
+  }
+
+  function runWrapper(options: {
+    pathDirs: string[];
+    args: string[];
+    goosePortableDir?: string;
+    exitCode?: number;
+  }) {
+    const args = options.args.map((arg) => (/[\s^&|<>]/.test(arg) ? `"${arg}"` : arg));
+    // Same shape Rust's std::process::Command uses to start a .cmd file.
+    const result = spawnSync(
+      'cmd.exe',
+      [`/e:ON /v:OFF /d /c ""${wrapperPath}" ${args.join(' ')}"`],
+      {
+        windowsVerbatimArguments: true,
+        encoding: 'utf8',
+        input: 'first line\nsecond line\n',
+        env: {
+          SystemRoot: process.env.SystemRoot,
+          ComSpec: process.env.ComSpec,
+          PATHEXT: process.env.PATHEXT,
+          TEMP: rootDir,
+          TMP: rootDir,
+          GOOSE_NODE_DIR: options.goosePortableDir ?? emptyNodeDir,
+          FAKE_NPX_REPORT: path.join(rootDir, 'report.js'),
+          FAKE_NPX_EXIT: String(options.exitCode ?? 0),
+          // PowerShell is not on PATH, so the download step fails at once instead of using the network.
+          PATH: [...options.pathDirs, system32].join(';'),
+        },
+      }
+    );
+
+    expect(result.error).toBeUndefined();
+    return result;
+  }
+
+  beforeAll(() => {
+    rootDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'goose npx wrapper ')));
+    fs.writeFileSync(path.join(rootDir, 'report.js'), reportSource);
+
+    systemNodeDir = makeDir('system node');
+    fs.copyFileSync(process.execPath, path.join(systemNodeDir, 'node.exe'));
+    fs.writeFileSync(path.join(systemNodeDir, 'npx.cmd'), fakeNpx);
+
+    nodeWithoutNpxDir = makeDir('node without npx');
+    fs.linkSync(path.join(systemNodeDir, 'node.exe'), path.join(nodeWithoutNpxDir, 'node.exe'));
+
+    // A real executable that is not Node, so the version check fails.
+    failingNodeDir = makeDir('failing node');
+    fs.copyFileSync(path.join(system32, 'where.exe'), path.join(failingNodeDir, 'node.exe'));
+    fs.writeFileSync(path.join(failingNodeDir, 'npx.cmd'), fakeNpx);
+
+    brokenNpmDir = makeDir('broken npm');
+    fs.linkSync(path.join(systemNodeDir, 'node.exe'), path.join(brokenNpmDir, 'node.exe'));
+    fs.writeFileSync(path.join(brokenNpmDir, 'npx.cmd'), brokenNpx);
+
+    portableNodeDir = makeDir('portable node');
+    fs.linkSync(path.join(systemNodeDir, 'node.exe'), path.join(portableNodeDir, 'node.exe'));
+    fs.writeFileSync(path.join(portableNodeDir, 'npx.cmd'), fakeNpx);
+    const portableVersion = /SET "NODE_VERSION=([\d.]+)"/.exec(
+      fs.readFileSync(wrapperPath, 'utf8')
+    );
+    fs.writeFileSync(path.join(portableNodeDir, `node-v${portableVersion?.[1]}.installed`), '');
+
+    emptyNodeDir = makeDir('empty node');
+  }, 60_000);
+
+  afterAll(() => {
+    if (rootDir) {
+      fs.rmSync(rootDir, { recursive: true, force: true });
+    }
+  });
+
+  it('uses the first usable Node.js on PATH without downloading', () => {
+    const args = ['-y', '@scope/pkg@^1.2.0', 'arg with spaces'];
+    const result = runWrapper({
+      pathDirs: [nodeWithoutNpxDir, failingNodeDir, systemNodeDir],
+      args,
+    });
+
+    expect(result.stderr).not.toContain('Downloading');
+    expect(result.status).toBe(0
```

---

### Incident Patch 6: `fb7d185b` (2026-10-05)
**Commit Message**: fix(cli): show thinking when GOOSE_CLI_SHOW_THINKING is set to any value (#12454)

Signed-off-by: Seydi Charyyev <[REDACTED_EMAIL]>

**File**: `crates/goose-cli/src/session/output.rs` (modified, +57/-4)
```diff
@@ -555,11 +555,17 @@ pub fn goose_mode_message(text: &str) {
     println!("\n{} {}", accent("mode:"), text);
 }
 
+/// Any value of the environment variable turns thinking output on, which is what the
+/// documentation promises; the configured boolean is read only when it is not set.
+fn thinking_enabled(config: &Config) -> bool {
+    std::env::var_os("GOOSE_CLI_SHOW_THINKING").is_some()
+        || config
+            .get_param::<bool>("GOOSE_CLI_SHOW_THINKING")
+            .unwrap_or(false)
+}
+
 fn should_show_thinking() -> bool {
-    Config::global()
-        .get_param::<bool>("GOOSE_CLI_SHOW_THINKING")
-        .unwrap_or(false)
-        && std::io::stdout().is_terminal()
+    thinking_enabled(Config::global()) && std::io::stdout().is_terminal()
 }
 
 fn render_thinking(text: &str, theme: Theme) {
@@ -1737,6 +1743,7 @@ mod tests {
     use super::*;
     use serde_json::json;
     use std::env;
+    use tempfile::NamedTempFile;
 
     #[test]
     fn recent_lines_accumulate_across_updates() {
@@ -2047,4 +2054,50 @@ mod tests {
         );
         assert_eq!(get_credits_top_up_url(&message), None);
     }
+
+    fn config_with(contents: &str) -> (Config, NamedTempFile, NamedTempFile) {
+        let config_file = NamedTempFile::new().unwrap();
+        let secrets_file = NamedTempFile::new().unwrap();
+        std::fs::write(config_file.path(), contents).unwrap();
+        let config =
+            Config::new_with_file_secrets(config_file.path(), secrets_file.path()).unwrap();
+        (config, config_file, secrets_file)
+    }
+
+    #[test]
+    fn any_environment_value_shows_thinking() {
+        let _guard = env_lock::lock_env([("GOOSE_CLI_SHOW_THINKING", Some("1"))]);
+        let (config, _config_file, _secrets_file) = config_with("");
+
+        assert!(thinking_enabled(&config));
+    }
+
+    #[test]
+    fn empty_environment_value_shows_thinking() {
+        let _guard = env_lock::lock_env([("GOOSE_CLI_SHOW_THINKING", Some(""))]);
+        let (config, _config_file, _secrets_file) = config_with("");
+
+        assert!(thinking_enabled(&config));
+    }
+
+    #[test]
+    fn configured_value_is_used_when_the_variable_is_unset() {
+        let _guard = env_lock::lock_env([("GOOSE_CLI_SHOW_THINKING", None::<&str>)]);
+
+        let (enabled, _c1, _s1) = config_with("GOOSE_CLI_SHOW_THINKING: true\n");
+        assert!(thinking_enabled(&enabled));
+
+        let (disabled, _c2, _s2) = config_with("GOOSE_CLI_SHOW_THINKING: false\n");
+        assert!(!thinking_enabled(&disabled));
+
+        let (unset, _c3, _s3) = config_with("");
+        assert!(!thinking_enabled(&unset));
+    }
+
+    #[test]
+    fn thinking_output_needs_a_terminal() {
+        let _guard = env_lock::lock_env([("GOOSE_CLI_SHOW_THINKING", Some("1"))]);
+
+        assert_eq!(should_show_thinking(), std::io::stdout().is_terminal());
+    }
 }
```

---

### Incident Patch 7: `afde0f67` (2026-10-05)
**Commit Message**: fix(cost): price Databricks GLM aliases from the zhipuai catalog (#12673)

**File**: `crates/goose-provider-types/src/canonical/name_builder.rs` (modified, +5/-0)
```diff
@@ -226,6 +226,10 @@ fn infer_provider_from_model(model: &str) -> Option<&'static str> {
         return Some("cohere");
     }
 
+    if model_lower.starts_with("glm-") {
+        return Some("zhipuai");
+    }
+
     None
 }
 
@@ -255,6 +259,7 @@ fn strip_common_prefixes(model: &str) -> String {
         "ministral-",
         "pixtral-",
         "devstral-",
+        "glm-",
     ];
 
     let mut earliest_pos = None;
```

---

### Incident Patch 8: `591edd47` (2026-10-02)
**Commit Message**: fix(tom): read messages from config (#12634)

**File**: `crates/goose/src/agents/platform_extensions/tom.rs` (modified, +3/-2)
```diff
@@ -1,6 +1,7 @@
 use crate::agents::extension::PlatformExtensionContext;
 use crate::agents::mcp_client::{Error, McpClientTrait};
 use crate::agents::tool_execution::ToolCallContext;
+use crate::config::Config;
 use anyhow::Result;
 use async_trait::async_trait;
 use rmcp::model::{
@@ -64,13 +65,13 @@ impl McpClientTrait for TomClient {
     async fn get_moim(&self, _session_id: &str) -> Option<String> {
         let mut parts = Vec::new();
 
-        if let Ok(text) = std::env::var("GOOSE_MOIM_MESSAGE_TEXT") {
+        if let Ok(text) = Config::global().get_param::<String>("GOOSE_MOIM_MESSAGE_TEXT") {
             if !text.trim().is_empty() {
                 parts.push(truncate_utf8(text));
             }
         }
 
-        if let Ok(path) = std::env::var("GOOSE_MOIM_MESSAGE_FILE") {
+        if let Ok(path) = Config::global().get_param::<String>("GOOSE_MOIM_MESSAGE_FILE") {
             let expanded = shellexpand::tilde(&path);
             if let Some(content) = read_bounded(&expanded).await {
                 if !content.trim().is_empty() {
```

---

### Incident Patch 9: `aa294302` (2026-10-02)
**Commit Message**: fix(bedrock): preserve the service total when folding cache input tokens (#12586)

Co-authored-by: Douwe Osinga <[REDACTED_EMAIL]>

**File**: `.github/workflows/mcp-conformance.yml` (modified, +0/-1)
```diff
@@ -45,7 +45,6 @@ jobs:
           path: |
             target/debug/goose
             target/debug/mcp_conformance_driver
-          retention-days: 1
           if-no-files-found: error
 
   conformance:
```

**File**: `Justfile` (modified, +2/-1)
```diff
@@ -489,7 +489,8 @@ mcp-conformance version="2025-11-25" suite="all" conformance_version="0.2.0-alph
   if [ -n "{{baseline}}" ]; then
     baseline_args=(--expected-failures "{{baseline}}")
   fi
-  GOOSE_DISABLE_KEYRING=1 npx -y @modelcontextprotocol/conformance@{{conformance_version}} client --command "target/debug/mcp_conformance_driver" --spec-version "{{version}}" --suite "{{suite}}" ${baseline_args[@]+"${baseline_args[@]}"}
+  export GOOSE_BIN="$PWD/target/debug/goose"
+  GOOSE_DISABLE_KEYRING=1 npx -y @modelcontextprotocol/conformance@{{conformance_version}} client --command "$PWD/target/debug/mcp_conformance_driver" --spec-version "{{version}}" --suite "{{suite}}" ${baseline_args[@]+"${baseline_args[@]}"}
 
 build-test-tools:
   cargo build -p goose-test
```

**File**: `crates/goose-provider-types/src/conversation/token_usage.rs` (modified, +1/-1)
```diff
@@ -174,7 +174,7 @@ impl Usage {
     }
 
     /// For providers whose reported `input_tokens`/`total_tokens` exclude
-    /// cache tokens (e.g. Anthropic, Bedrock): folds the cache breakdown in.
+    /// cache tokens (e.g. Anthropic): folds the cache breakdown in.
     pub fn from_cache_exclusive_input(
         input_tokens: Option<i32>,
         output_tokens: Option<i32>,
```

**File**: `crates/goose/src/providers/formats/bedrock.rs` (modified, +11/-6)
```diff
@@ -612,13 +612,18 @@ pub fn from_bedrock_role(role: &bedrock::ConversationRole) -> Result<Role> {
 }
 
 pub fn from_bedrock_usage(usage: &bedrock::TokenUsage) -> Usage {
-    Usage::from_cache_exclusive_input(
-        Some(usage.input_tokens),
+    let cache_read = usage.cache_read_input_tokens;
+    let cache_write = usage.cache_write_input_tokens;
+    let input_tokens = usage
+        .input_tokens
+        .saturating_add(cache_read.unwrap_or(0))
+        .saturating_add(cache_write.unwrap_or(0));
+    Usage::new(
+        Some(input_tokens),
         Some(usage.output_tokens),
         Some(usage.total_tokens),
-        usage.cache_read_input_tokens,
-        usage.cache_write_input_tokens,
     )
+    .with_cache_tokens(cache_read, cache_write)
 }
 
 pub fn from_bedrock_json(document: &Document) -> Result<Value> {
@@ -1106,11 +1111,11 @@ mod tests {
     }
 
     #[test]
-    fn test_from_bedrock_usage_folds_cache_tokens_into_input() {
+    fn test_from_bedrock_usage_includes_cache_in_input_and_preserves_total() {
         let usage = bedrock::TokenUsage::builder()
             .input_tokens(7)
             .output_tokens(50)
-            .total_tokens(57)
+            .total_tokens(6057)
             .cache_read_input_tokens(5000)
             .cache_write_input_tokens(1000)
             .build()
```

---

### Incident Patch 10: `b9db895a` (2026-10-02)
**Commit Message**: fix(provider): refresh revoked Copilot tokens when listing models (#12627)

**File**: `crates/goose/src/providers/githubcopilot.rs` (modified, +135/-25)
```diff
@@ -17,6 +17,7 @@ use serde::{Deserialize, Serialize};
 use serde_json::Value;
 use std::cell::RefCell;
 use std::collections::HashMap;
+use std::future::Future;
 use std::path::PathBuf;
 use std::time::Duration;
 use url::{Host, Url};
@@ -310,26 +311,42 @@ impl GithubCopilotProvider {
         model_config: &ModelConfig,
         path: &str,
         is_user_initiated: bool,
-        payload: &mut Value,
+        payload: &Value,
         has_images: bool,
         streaming: bool,
     ) -> Result<Response, ProviderError> {
-        for attempt in 0..2 {
-            let (endpoint, token) = self.get_api_info().await?;
-            let mut headers = self.get_github_headers();
-            if has_images {
-                headers.insert("Copilot-Vision-Request", "true".parse().unwrap());
-            }
-            let initiator = if is_user_initiated { "user" } else { "agent" };
-            headers.insert("X-Initiator", initiator.parse().unwrap());
-            let api_client = self.authenticated_api_client(endpoint, token.clone(), headers)?;
+        let mut headers = self.get_github_headers();
+        if has_images {
+            headers.insert("Copilot-Vision-Request", "true".parse().unwrap());
+        }
+        let initiator = if is_user_initiated { "user" } else { "agent" };
+        headers.insert("X-Initiator", initiator.parse().unwrap());
 
-            let response = api_client
+        self.request_with_token_retry(headers, |api_client| async move {
+            Ok(api_client
                 .request(path)
                 .model_headers(model_config)?
                 .streaming(streaming)
                 .response_post(payload)
-                .await?;
+                .await?)
+        })
+        .await
+    }
+
+    async fn request_with_token_retry<F, Fut>(
+        &self,
+        headers: http::HeaderMap,
+        request: F,
+    ) -> Result<Response, ProviderError>
+    where
+        F: Fn(ApiClient) -> Fut + Send,
+        Fut: Future<Output = Result<Response, ProviderError>> + Send,
+    {
+        for attempt in 0..2 {
+            let (endpoint, token) = self.get_api_info().await?;
+            let api_client =
+                self.authenticated_api_client(endpoint, token.clone(), headers.clone())?;
+            let response = request(api_client).await?;
             if matches!(
                 response.status(),
                 reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN
@@ -492,13 +509,12 @@ impl GithubCopilotProvider {
 
         let response = self
             .with_retry(|| async {
-                let mut payload_clone = payload.clone();
                 let resp = self
                     .post(
                         model_config,
                         "responses",
                         is_user_initiated,
-                        &mut payload_clone,
+                        &payload,
                         has_images,
                         true,
                     )
@@ -540,13 +556,12 @@ impl GithubCopilotProvider {
 
             let response = self
                 .with_retry(|| async {
-                    let mut payload_clone = payload.clone();
                     let resp = self
                         .post(
                             model_config,
                             "chat/completions",
                             is_user_initiated,
-                            &mut payload_clone,
+                            &payload,
                             has_images,
                             true,
                         )
@@ -572,12 +587,11 @@ impl GithubCopilotProvider {
 
             let response = self
                 .with_retry(|| async {
-                    let mut payload_clone = payload.clone();
                     self.post(
                         model_config,
                         "chat/completions",
                         is_user_initiated,
-                        &mut payload_clone,
+                        &payload,
                         has_images,
                         false,
                     )
@@ -703,18 +717,19 @@ impl Provider for GithubCopilotProvider {
     }
 
     async fn fetch_supported_models(&self) -> Result<Vec<String>, ProviderError> {
-        let (endpoint, token) = self.get_api_info().await?;
-
         let mut headers = http::HeaderMap::new();
         headers.insert(http::header::ACCEPT, "application/json".parse().unwrap());
         headers.insert(
             http::header::CONTENT_TYPE,
             "application/json".parse().unwrap(),
         );
         headers.insert("Copilot-Integration-Id", "vscode-chat".parse().unwrap());
-        let api_client = self.authenticated_api_client(endpoint, token, headers)?;
-        let response = api_client.response_get("models").await?;
-
+        let response = self
+            .request_with_token_retry(headers, |api_client| async move {
+                Ok(api_client.response_get("models").await?)
+    
```

---

### Incident Patch 11: `8f4cab5f` (2026-10-02)
**Commit Message**: fix: refresh revoked GitHub Copilot API token once (#12616)

**File**: `crates/goose/src/providers/githubcopilot.rs` (modified, +199/-17)
```diff
@@ -314,22 +314,54 @@ impl GithubCopilotProvider {
         has_images: bool,
         streaming: bool,
     ) -> Result<Response, ProviderError> {
-        let (endpoint, token) = self.get_api_info().await?;
-        let mut headers = self.get_github_headers();
-        if has_images {
-            headers.insert("Copilot-Vision-Request", "true".parse().unwrap());
+        for attempt in 0..2 {
+            let (endpoint, token) = self.get_api_info().await?;
+            let mut headers = self.get_github_headers();
+            if has_images {
+                headers.insert("Copilot-Vision-Request", "true".parse().unwrap());
+            }
+            let initiator = if is_user_initiated { "user" } else { "agent" };
+            headers.insert("X-Initiator", initiator.parse().unwrap());
+            let api_client = self.authenticated_api_client(endpoint, token.clone(), headers)?;
+
+            let response = api_client
+                .request(path)
+                .model_headers(model_config)?
+                .streaming(streaming)
+                .response_post(payload)
+                .await?;
+            if matches!(
+                response.status(),
+                reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN
+            ) {
+                self.invalidate_token(&token).await?;
+                if attempt == 0 {
+                    continue;
+                }
+            }
+            return Ok(response);
         }
-        let initiator = if is_user_initiated { "user" } else { "agent" };
-        headers.insert("X-Initiator", initiator.parse().unwrap());
-        let api_client = self.authenticated_api_client(endpoint, token, headers)?;
+        unreachable!()
+    }
 
-        api_client
-            .request(path)
-            .model_headers(model_config)?
-            .streaming(streaming)
-            .response_post(payload)
-            .await
-            .map_err(|e| e.into())
+    async fn invalidate_token(&self, rejected_token: &str) -> Result<(), ProviderError> {
+        let guard = self.mu.lock().await;
+        if guard
+            .borrow()
+            .as_ref()
+            .is_some_and(|state| state.info.token != rejected_token)
+        {
+            return Ok(());
+        }
+        if let Some(state) = self.cache.load().await {
+            if state.info.token != rejected_token && state.expires_at > Utc::now() {
+                guard.replace(Some(state));
+                return Ok(());
+            }
+        }
+        self.cache.clear().await.map_err(ProviderError::from)?;
+        guard.replace(None);
+        Ok(())
     }
 
     async fn get_api_info(&self) -> Result<(String, String), ProviderError> {
@@ -345,9 +377,7 @@ impl GithubCopilotProvider {
         if let Some(state) = self.cache.load().await {
             if state.expires_at > Utc::now() {
                 validate_copilot_api_endpoint(&state.info.endpoints.api)?;
-                if guard.borrow().is_none() {
-                    guard.replace(Some(state.clone()));
-                }
+                guard.replace(Some(state.clone()));
                 return Ok((state.info.endpoints.api, state.info.token));
             }
         }
@@ -365,6 +395,7 @@ impl GithubCopilotProvider {
             tracing::trace!("attempt {} to refresh api info", attempt + 1);
             let info = match self.refresh_api_info(&github_token).await {
                 Ok(data) => data,
+                Err(err @ ProviderError::Authentication(_)) => return Err(err),
                 Err(err) => {
                     tracing::warn!("failed to refresh api info: {}", err);
                     last_error = Some(err);
@@ -952,6 +983,157 @@ mod tests {
         );
     }
 
+    #[tokio::test]
+    #[serial_test::serial]
+    async fn revoked_token_is_replaced_and_request_retried_once() {
+        use wiremock::matchers::header;
+
+        let server = MockServer::start().await;
+        Mock::given(method("POST"))
+            .and(path("/chat/completions"))
+            .and(header("authorization", "Bearer revoked"))
+            .respond_with(ResponseTemplate::new(403))
+            .expect(1)
+            .mount(&server)
+            .await;
+        Mock::given(method("POST"))
+            .and(path("/chat/completions"))
+            .and(header("authorization", "Bearer replacement"))
+            .respond_with(ResponseTemplate::new(200))
+            .expect(1)
+            .mount(&server)
+            .await;
+        Mock::given(method("GET"))
+            .and(path("/copilot-token"))
+            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
+                "token": "replacement",
+                "expires_at": 0,
+                "refresh_in": 600,
+                "endpoints": { "api": server.uri() }
+            })))
+            .expect(1)
+            .mount(&server)
+            .await;
+
+        let directory = tempfile::tempdir().unwrap();
+        let cache 
```

---

### Incident Patch 12: `75188ac9` (2026-10-02)
**Commit Message**: fix(desktop): recognize ASAR when validating update target (#12599)

**File**: `ui/desktop/src/utils/githubUpdater.ts` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ const SHARED_DIRECTORY_NAMES = new Set([
 
 async function pathExists(target: string): Promise<boolean> {
   try {
-    await fs.access(target);
+    await fs.stat(target);
     return true;
   } catch {
     return false;
```

---

### Incident Patch 13: `920313e4` (2026-10-01)
**Commit Message**: fix(acp): stamp the implemented protocol version in initialize (#12580)

**File**: `crates/goose/src/acp/server.rs` (modified, +51/-1)
```diff
@@ -59,6 +59,7 @@ use agent_client_protocol::schema::v1::{
     SetSessionModeResponse, StopReason, TextContent, ToolCallId, ToolCallUpdate, Usage,
     UsageUpdate,
 };
+use agent_client_protocol::schema::ProtocolVersion;
 use agent_client_protocol::util::MatchDispatchFrom;
 use agent_client_protocol::{
     Agent as SacpAgent, ByteStreams, Client, ConnectionTo, Dispatch, HandleDispatchFrom, Handled,
@@ -1837,7 +1838,7 @@ impl GooseAcpAgent {
             )
             .mcp_capabilities(McpCapabilities::new().http(true))
             .meta(agent_capabilities_meta());
-        Ok(InitializeResponse::new(args.protocol_version)
+        Ok(InitializeResponse::new(ProtocolVersion::LATEST)
             .agent_info(Implementation::new("goose", env!("CARGO_PKG_VERSION")))
             .agent_capabilities(capabilities)
             .auth_methods(vec![AuthMethod::Agent(
@@ -3526,6 +3527,55 @@ print(\"hello, world\")
         );
     }
 
+    #[tokio::test]
+    async fn initialize_stamps_the_protocol_version_goose_implements() {
+        let root = tempfile::tempdir().unwrap();
+        let active_runs = Arc::new(ActiveRunRegistry::default());
+        let live_voice = Arc::new(LiveVoiceService::from_config(active_runs.clone()));
+        let provider_factory: AcpProviderFactory = Arc::new(
+            |_provider_name, _extensions, _working_dir, _use_default_model| {
+                Box::pin(async { Err(anyhow::anyhow!("unused provider factory")) })
+            },
+        );
+        let agent = GooseAcpAgent::new(GooseAcpAgentOptions {
+            provider_factory,
+            builtin_selection: AcpBuiltinSelection::default(),
+            data_dir: root.path().to_path_buf(),
+            config_dir: root.path().to_path_buf(),
+            disable_session_naming: true,
+            goose_platform: GoosePlatform::GooseCli,
+            additional_source_roots: Vec::new(),
+            scheduler: None,
+            session_cwd: None,
+            active_runs,
+            live_voice,
+        })
+        .await
+        .unwrap();
+
+        let offered_v2 = agent_client_protocol::schema::ProtocolVersion::from(2u16);
+        let response = agent
+            .on_initialize(InitializeRequest::new(offered_v2))
+            .await
+            .unwrap();
+        assert_eq!(
+            response.protocol_version,
+            agent_client_protocol::schema::ProtocolVersion::V1,
+            "goose implements ACP v1 and must stamp v1 even when the client offers v2"
+        );
+
+        let response = agent
+            .on_initialize(InitializeRequest::new(
+                agent_client_protocol::schema::ProtocolVersion::V1,
+            ))
+            .await
+            .unwrap();
+        assert_eq!(
+            response.protocol_version,
+            agent_client_protocol::schema::ProtocolVersion::V1
+        );
+    }
+
     #[test]
     fn test_goose_custom_notifications_capability_reads_client_meta() {
         let mut goose_meta = serde_json::Map::new();
```

---

### Incident Patch 14: `bab8ff64` (2026-09-30)
**Commit Message**: fix: session naming/"none" reasoning effort fails for gpt-6.1-sol (#12605)

**File**: `crates/goose-provider-types/src/canonical/data/provider_metadata.json` (modified, +16/-16)
```diff
@@ -283,7 +283,7 @@
     "env": [
       "BASETEN_API_KEY"
     ],
-    "model_count": 23
+    "model_count": 24
   },
   {
     "id": "bee",
@@ -416,7 +416,7 @@
     "env": [
       "CORTECS_API_KEY"
     ],
-    "model_count": 109
+    "model_count": 110
   },
   {
     "id": "crof",
@@ -438,7 +438,7 @@
     "env": [
       "CROSSMODEL_API_KEY"
     ],
-    "model_count": 66
+    "model_count": 67
   },
   {
     "id": "crusoe",
@@ -549,7 +549,7 @@
     "env": [
       "EDENAI_API_KEY"
     ],
-    "model_count": 283
+    "model_count": 286
   },
   {
     "id": "empiriolabs",
@@ -637,7 +637,7 @@
     "env": [
       "GITHUB_TOKEN"
     ],
-    "model_count": 32
+    "model_count": 34
   },
   {
     "id": "gmicloud",
@@ -880,7 +880,7 @@
     "env": [
       "KILO_API_KEY"
     ],
-    "model_count": 392
+    "model_count": 394
   },
   {
     "id": "kimi-code-plan-cn",
@@ -957,7 +957,7 @@
     "env": [
       "LLMGATEWAY_API_KEY"
     ],
-    "model_count": 213
+    "model_count": 214
   },
   {
     "id": "llmgateway-providers",
@@ -968,7 +968,7 @@
     "env": [
       "LLMGATEWAY_API_KEY"
     ],
-    "model_count": 441
+    "model_count": 432
   },
   {
     "id": "llmtech",
@@ -1243,7 +1243,7 @@
     "env": [
       "NANO_GPT_API_KEY"
     ],
-    "model_count": 602
+    "model_count": 600
   },
   {
     "id": "nearai",
@@ -1354,7 +1354,7 @@
     "env": [
       "OFOX_API_KEY"
     ],
-    "model_count": 149
+    "model_count": 150
   },
   {
     "id": "ollama-cloud",
@@ -1376,7 +1376,7 @@
     "env": [
       "OPENCODE_API_KEY"
     ],
-    "model_count": 113
+    "model_count": 114
   },
   {
     "id": "opencode-go",
@@ -1475,7 +1475,7 @@
     "env": [
       "PIONEER_API_KEY"
     ],
-    "model_count": 114
+    "model_count": 116
   },
   {
     "id": "poe",
@@ -1553,7 +1553,7 @@
     "env": [
       "REQUESTY_API_KEY"
     ],
-    "model_count": 161
+    "model_count": 165
   },
   {
     "id": "routing-run",
@@ -1608,7 +1608,7 @@
     "env": [
       "SCALEWAY_API_KEY"
     ],
-    "model_count": 15
+    "model_count": 16
   },
   {
     "id": "scnet-token-plan",
@@ -1767,14 +1767,14 @@
   },
   {
     "id": "tempr",
-    "display_name": "Tempr",
+    "display_name": "Tempr Gateway",
     "npm": "@ai-sdk/openai-compatible",
     "api": "https://api.temprhq.io/v1",
     "doc": "https://temprhq.io/docs/gateway-reference.html",
     "env": [
       "TEMPR_API_KEY"
     ],
-    "model_count": 57
+    "model_count": 82
   },
   {
     "id": "tencent-coding-plan",
```

**File**: `crates/goose-provider-types/src/formats/openai.rs` (modified, +17/-2)
```diff
@@ -1928,8 +1928,16 @@ pub(crate) fn openai_reasoning_efforts_for_model(model_name: &str) -> &'static [
         if normalized.contains("-pro") || normalized.contains("/pro") {
             &["high"]
         } else if normalized.contains("gpt-6") {
-            // GPT-6 Astra does not accept `none`; Sol and Luna do.
-            if normalized.contains("astra") {
+            // GPT-6 Astra and GPT-6.1 Sol require reasoning; GPT-6 Sol and Luna may disable it.
+            let is_gpt_6_1_sol = normalized
+                .match_indices("gpt-6.1-sol")
+                .any(|(index, name)| {
+                    let (prefix, rest) = normalized.split_at(index);
+                    let (_, suffix) = rest.split_at(name.len());
+                    (prefix.is_empty() || prefix.ends_with(['/', '.', '-']))
+                        && (suffix.is_empty() || suffix.starts_with(['-', '@']))
+                });
+            if normalized.contains("astra") || is_gpt_6_1_sol {
                 &["low", "medium", "high", "xhigh", "max"]
             } else {
                 &["none", "low", "medium", "high", "xhigh", "max"]
@@ -3431,6 +3439,13 @@ mod tests {
             "gpt-6-astra",
             "data_workflow_tools.goose.goose-gpt-6-astra",
             "openrouter/openai/gpt-6-astra",
+            "gpt-6.1-sol",
+            "gpt-6.1-sol-high",
+            "data_workflow_tools.goose.goose-gpt-6.1-sol",
+            "openrouter/openai/gpt-6.1-sol",
+            "gpt-6.1-sol@eu",
+            "openai/gpt-6.1-sol-fast",
+            "openai/gpt-6.1-sol-fast-high",
         ] {
             assert_eq!(
                 openai_reasoning_effort_for_thinking(model, ThinkingEffort::Off),
```

---

### Incident Patch 15: `5850d4a1` (2026-09-30)
**Commit Message**: fix: reflect loading state of chats (#12603)

**File**: `ui/desktop/src/components/Layout/NavigationPanel.tsx` (modified, +6/-1)
```diff
@@ -37,6 +37,10 @@ const i18n = defineMessages({
     id: 'navigationPanel.noChats',
     defaultMessage: 'No recent chats',
   },
+  loadingChats: {
+    id: 'navigationPanel.loadingChats',
+    defaultMessage: 'Loading chats…',
+  },
   untitledSession: {
     id: 'navigationPanel.untitledSession',
     defaultMessage: 'Untitled session',
@@ -260,6 +264,7 @@ export const Navigation: React.FC<{
   const {
     recentSessions,
     recentSessionsByProject,
+    isLoadingSessions,
     activeSessionId,
     fetchSessions,
     handleNavClick,
@@ -364,7 +369,7 @@ export const Navigation: React.FC<{
           <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 mt-1">
             {recentSessions.length === 0 ? (
               <div className="px-3 py-2 text-xs text-text-secondary">
-                {intl.formatMessage(i18n.noChats)}
+                {intl.formatMessage(isLoadingSessions ? i18n.loadingChats : i18n.noChats)}
               </div>
             ) : recentSessionsByProject.length > 1 ? (
               recentSessionsByProject.map((group: ProjectGroup) => {
```

**File**: `ui/desktop/src/hooks/useNavigationSessions.ts` (modified, +12/-1)
```diff
@@ -61,6 +61,8 @@ export function useNavigationSessions() {
   const chatContext = useChatContext();
 
   const [recentSessions, setRecentSessions] = useState<SessionListItem[]>([]);
+  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
+  const latestFetchIdRef = useRef(0);
   const recentSessionsByProject = useMemo(
     () => groupSessionsByProject(recentSessions),
     [recentSessions]
@@ -78,11 +80,19 @@ export function useNavigationSessions() {
   }, [currentSessionId]);
 
   const fetchSessions = useCallback(async () => {
+    const fetchId = ++latestFetchIdRef.current;
+    setIsLoadingSessions(true);
     try {
       const sessions = await acpListRecentSessions(MAX_RECENT_SESSIONS);
-      setRecentSessions(sessions);
+      if (fetchId === latestFetchIdRef.current) {
+        setRecentSessions(sessions);
+      }
     } catch (error) {
       console.error('Failed to fetch sessions:', error);
+    } finally {
+      if (fetchId === latestFetchIdRef.current) {
+        setIsLoadingSessions(false);
+      }
     }
   }, []);
 
@@ -214,6 +224,7 @@ export function useNavigationSessions() {
   return {
     recentSessions,
     recentSessionsByProject,
+    isLoadingSessions,
     activeSessionId,
     fetchSessions,
     handleNavClick,
```

**File**: `ui/desktop/src/i18n/messages/de.json` (modified, +3/-0)
```diff
@@ -2384,6 +2384,9 @@
   "navigationPanel.chats": {
     "defaultMessage": "Chats"
   },
+  "navigationPanel.loadingChats": {
+    "defaultMessage": "Chats werden geladen…"
+  },
   "navigationPanel.metaCreated": {
     "defaultMessage": "Erstellt"
   },
```

**File**: `ui/desktop/src/i18n/messages/en.json` (modified, +3/-0)
```diff
@@ -2408,6 +2408,9 @@
   "navigationPanel.chats": {
     "defaultMessage": "Chats"
   },
+  "navigationPanel.loadingChats": {
+    "defaultMessage": "Loading chats…"
+  },
   "navigationPanel.metaCreated": {
     "defaultMessage": "Created"
   },
```

**File**: `ui/desktop/src/i18n/messages/es.json` (modified, +3/-0)
```diff
@@ -2384,6 +2384,9 @@
   "navigationPanel.chats": {
     "defaultMessage": "Chats"
   },
+  "navigationPanel.loadingChats": {
+    "defaultMessage": "Cargando chats…"
+  },
   "navigationPanel.metaCreated": {
     "defaultMessage": "Creado"
   },
```

**File**: `ui/desktop/src/i18n/messages/fr.json` (modified, +3/-0)
```diff
@@ -2384,6 +2384,9 @@
   "navigationPanel.chats": {
     "defaultMessage": "Discussions"
   },
+  "navigationPanel.loadingChats": {
+    "defaultMessage": "Chargement des discussions…"
+  },
   "navigationPanel.metaCreated": {
     "defaultMessage": "Créé"
   },
```

**File**: `ui/desktop/src/i18n/messages/hi.json` (modified, +3/-0)
```diff
@@ -2384,6 +2384,9 @@
   "navigationPanel.chats": {
     "defaultMessage": "चैट"
   },
+  "navigationPanel.loadingChats": {
+    "defaultMessage": "चैट लोड हो रही हैं…"
+  },
   "navigationPanel.metaCreated": {
     "defaultMessage": "बनाया गया"
   },
```

**File**: `ui/desktop/src/i18n/messages/id.json` (modified, +3/-0)
```diff
@@ -2384,6 +2384,9 @@
   "navigationPanel.chats": {
     "defaultMessage": "Obrolan"
   },
+  "navigationPanel.loadingChats": {
+    "defaultMessage": "Memuat obrolan…"
+  },
   "navigationPanel.metaCreated": {
     "defaultMessage": "Dibuat"
   },
```

#### Recent Merged Pull Requests:
- **PR #12698** (closed): fix: preserve compatible provider request prefixes during compaction (@tmellor-block)
- **PR #12689** (2026-10-05): fix: support hyphenated GPT 6.1 Sol effort aliases (@atishpatel)
- **PR #12679** (2026-10-05): fix: fixed unstable tests (@lifeizhou-ap)
- **PR #12673** (2026-10-05): fix(cost): price Databricks GLM aliases from the zhipuai catalog (@filipkujawa)
- **PR #12663** (closed): Add Darkmoon to extension directory (@MBK-fr)
- **PR #12656** (closed): docs: add Magnemo to the extensions directory (@SVTechnologiesInc)
- **PR #12651** (closed): docs: add Weio Site Check remote extension (@pmh-weio-test)
- **PR #12645** (closed): chore(deps): bump the cargo-minor-and-patch group across 1 directory with 16 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
