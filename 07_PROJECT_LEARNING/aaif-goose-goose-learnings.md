# Forensic Learning Record (Deep Inspection): aaif-goose/goose

> **Canonical Artifact**: `07_PROJECT_LEARNING/aaif-goose-goose-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aaif-goose/goose](https://github.com/aaif-goose/goose))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:05:40.907Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aaif-goose/goose`
- **Description**: an open source, extensible AI agent that goes beyond code suggestions - install, execute, edit, and test with any LLM
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 54815 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `buzz/github_manager.mjs`
```
import { readFileSync } from "node:fs";

export function getProjectIssues(
  runJson,
  { command, projectNumber, projectOwner, projectLimit, repository },
) {
  const normalizedRepository = repository.toLowerCase();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const project = runJson(command, [
      "project",
      "item-list",
      String(projectNumber),
      "--owner",
      projectOwner,
      "--limit",
      String(projectLimit),
      "--format",
      "json",
    ]);
    if (!Number.isSafeInteger(project.totalCount) || !Array.isArray(project.items)) {
      throw new Error("GitHub returned an invalid project item list.");
    }
    if (project.totalCount > projectLimit) {
      throw new Error(
        `GitHub reports ${project.totalCount} project items. Raise --project-limit.`,
      );
    }
    if (project.items.length === project.totalCount) {
      return {
        project,
        byNumber: new Map(
          project.items
            .filter(
              (item) =>
                item.content?.type === "Issue" &&
                item.content.repository?.toLowerCase() === normalizedRepository,
            )
            .map((item) => [item.content.number, item]),
        ),
      };
    }
    if (attempt === 1) {
      throw new Error(
        `Expected ${project.totalCount} project items but received ${project.items.length}.`,
      );
    }
  }
}

export function getOpenIssues(runJson, { command, repository }) {
  const pages = runJson(command, [
    "api",
    "--paginate",
    "--slurp",
    `repos/${repository}/issues?state=open&per_page=100`,
  ]);
  if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page))) {
    throw new Error("GitHub returned an invalid paginated issue response.");
  }
  return pages
    .flat()
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      repository,
      assignees: (issue.assignees || []).map((assignee) => ({
        login: assignee.login,
      })),
    }));
}

export function selectRecentQueueEntries(messages, count, linksFromMessage) {
  const ignored = messages
    .filter((message) => !Number.isSafeInteger(message.created_at))
    .map((message) => ({
      message_id: message.id || null,
      reason: "invalid-created-at",
    }));
  const allEntries = messages
    .filter((message) => Number.isSafeInteger(message.created_at))
    .sort(
      (left, right) =>
        left.created_at - right.created_at ||
        String(left.id || "").localeCompare(String(right.id || "")),
    )
    .flatMap((message) =>
      linksFromMessage(message).map((link) => ({ message, link })),
    );
  const deferredCount = Math.max(0, allEntries.length - count);
  ignored.push(
    ...allEntries.slice(0, deferredCount).map(({ message, link }) => ({
      message_id: message.id,
      link,
      reason: "outside-recent-window",
    })),
  );
  return {
    entries: allEntries.slice(deferredCount),
    ignored,
  };
}

export function readCoreTeam(path) {
  let document;
  try {
    document = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read core team file ${path}: ${error.message}`);
  }

  if (!Array.isArray(document.owners) || !Array.isArray(document.members)) {
    throw new Error(`${path} must contain owners and members arrays.`);
  }

  const parsedPeople = [
    ...document.owners.map((entry) => person(entry, "owner", path)),
    ...document.members.map((entry) => person(entry, "member", path)),
  ];
  const people = parsedPeople.map(({ bots, ...entry }) => entry);
  if (people.length === 0) {
    throw new Error(`${path} has no people.`);
  }

  const byGithub = new Map();
  const byPubkey = new Map();
  for (const entry of people) {
    const github = entry.github.toLowerCase();
    if (byGithub.has(github)) {
      throw new Error(`More than one core team entry uses ${entry.github}.`);
    }
    if (byPubkey.has(entry.pubkey)) {
      throw new Error(`More than one core team entry uses ${entry.pubkey}.`);
    }
    byGithub.set(github, entry);
    byPubkey.set(entry.pubkey, entry);
  }

  return {
    people,
    owners: people.filter((entry) => entry.role === "owner"),
    members: people.filter((entry) => entry.role === "member"),
    byGithub,
    byPubkey,
    botsByPerson: new Map(
      parsedPeople.map((entry) => [entry.pubkey, entry.bots]),
    ),
  };
}

function person(entry, role, path) {
  if (
    !entry ||
    typeof entry.name !== "string" ||
    !entry.name.trim() ||
    typeof entry.github !== "string" ||
    !entry.github.trim() ||
    typeof entry.pubkey !== "string" ||
    !/^[0-9a-f]{64}$/i.test(entry.pubkey) ||
    typeof entry.capacity !== "number" ||
    !Number.isFinite(entry.capacity) ||
    entry.capacity <= 0 ||
    !Array.isArray(entry.interest) ||
    entry.interest.length === 0 ||
    entry.interest.some(
      (interest) => typeof interest !== "string" || !interest.trim(),
    )
  ) {
    throw new Error(
      `Every person in ${path} must have a name, GitHub handle, hexadecimal ` +
        "pubkey, positive capacity, and non-empty interest list.",
    );
  }

  const bots = entry.bots || {};
  if (
    typeof bots !== "object" ||
    Array.isArray(bots) ||
    Object.entries(bots).some(
      ([name, pubkey]) =>
        !name.trim() ||
        typeof pubkey !== "string" ||
        !/^[0-9a-f]{64}$/i.test(pubkey),
    )
  ) {
    throw new Error(
      `Bots for ${JSON.stringify(entry.name)} in ${path} must map names to hexadecimal pubkeys.`,
    );
  }

  return {
    name: entry.name.trim(),
    github: entry.github.trim(),
    pubkey: entry.pubkey.toLowerCase(),
    role,
    capacity: entry.capacity,
    interest: entry.interest.map((interest) => interest.trim()),
    bots: Object.entries(bots).map(([name, pubkey]) => ({
      name: name.trim(),
      pubkey: pubkey.toLowerCase(),
      role: "bot",
    })),
  };
}

export function issueReferenceFromChannel(channel) {
  const description = [channel.about, channel.description]
    .filter((value) => typeof value === "string" && value)
    .join("\n");
  const url = description.match(
    /https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/(issues|pull)\/([1-9]\d*)/i,
  );
  if (url) {
    return {
      repository: `${url[1]}/${url[2]}`,
      number: Number.parseInt(url[4], 10),
      kind: url[3].toLowerCase() === "issues" ? "issue" : "pull-request",
      source: "description",
    };
  }

  const name = channel.name || "";
  const legacy = name.match(/^([^\s]+\/[^\s]+)\s+#([1-9]\d*)(?:\s|$)/);
  if (legacy) {
    return {
      repository: legacy[1],
      number: Number.parseInt(legacy[2], 10),
      kind: null,
      source: "legacy-name",
    };
  }

  const canonical = name.match(/^#?([1-9]\d*)(?:\s|$)/);
  return canonical
    ? {
        repository: null,
        number: Number.parseInt(canonical[1], 10),
        kind: null,
        source: "name",
      }
    : null;
}

export function channelMatchesIssue(channel, issue) {
  const reference = issueReferenceFromChannel(channel);
  if (
    !reference ||
    reference.kind === "pull-request" ||
    reference.number !== issue.number
  ) {
    return false;
  }
  return (
    !reference.repository ||
    reference.repository.toLowerCase() === issue.repository.toLowerCase()
  );
}

export function bestMatchingIssueChannels(channels, issue) {
  const matches = channels
    .filter((channel) => channelMatchesIssue(channel, issue))
    .map((channel) => ({
      channel,
      rank: issueReferenceRank(issueReferenceFromChannel(channel)),
    }));
  const bestRank = Math.max(0, ...matches.map((match) => match.rank));
  return matches
    .filter((match) => match.rank === bestRank)
    .map((match) => match.channel);
}

export function issueReferenceRank(reference) {
  if (reference?.source === "description") {
    return 3;
  }
  if (reference?.source === "legacy-name") {
    return 2;
  }
  retu
```

### Core Architecture Module: `crates/goose-acp-macros/src/lib.rs`
```
use proc_macro::TokenStream;
use quote::quote;
use syn::{
    parse_macro_input, FnArg, GenericArgument, ImplItem, ItemImpl, Pat, PathArguments, ReturnType,
    Type,
};

/// Marks an impl block as containing `#[custom_method(RequestType)]`-annotated handlers.
///
/// The request type must derive `agent_client_protocol::JsonRpcRequest` with a `#[request(method = "...")]`
/// attribute — the method name is extracted from that type at compile time, eliminating
/// duplication between the request struct and the handler.
///
/// Generates two methods on the impl:
///
/// 1. `handle_custom_request` — a dispatcher that:
///    - Uses `<RequestType as agent_client_protocol::JsonRpcMessage>::matches_method` to match incoming methods
///    - Parses JSON params into the handler's typed parameter (if any)
///    - Serializes the handler's return value to JSON
///
/// 2. `custom_method_schemas` — returns a `Vec<CustomMethodSchema>` with
///    JSON Schema for each method's params and response types. Types that
///    implement `schemars::JsonSchema` get a full schema; `serde_json::Value`
///    params/responses produce `None`.
///
/// # Handler signatures
///
/// Handlers may take zero or one request parameter (beyond `&self`). A handler
/// that needs the active ACP connection may take it before the request:
///
/// ```ignore
/// // No params — called for requests with no/empty params
/// #[custom_method(GetExtensionsRequest)]
/// async fn on_get_extensions(&self) -> Result<GetExtensionsResponse, agent_client_protocol::Error> { .. }
///
/// // Typed params — JSON params auto-deserialized
/// #[custom_method(GetSessionRequest)]
/// async fn on_get_session(&self, req: GetSessionRequest) -> Result<GetSessionResponse, agent_client_protocol::Error> { .. }
///
/// // Connection and typed request
/// #[custom_method(StartCallRequest)]
/// async fn on_start_call(
///     &self,
///     cx: &agent_client_protocol::ConnectionTo<agent_client_protocol::Client>,
///     req: StartCallRequest,
/// ) -> Result<StartCallResponse, agent_client_protocol::Error> { .. }
/// ```
///
/// The return type must be `Result<T, agent_client_protocol::Error>` where `T: Serialize`.
#[proc_macro_attribute]
pub fn custom_methods(_attr: TokenStream, item: TokenStream) -> TokenStream {
    let mut impl_block = parse_macro_input!(item as ItemImpl);

    let mut routes: Vec<Route> = Vec::new();

    // Collect all #[custom_method(RequestType)] annotations and strip them.
    for item in &mut impl_block.items {
        if let ImplItem::Fn(method) = item {
            let mut request_type = None;
            method.attrs.retain(|attr| {
                if attr.path().is_ident("custom_method") {
                    if let Ok(meta_list) = attr.meta.require_list() {
                        if let Ok(ty) = meta_list.parse_args::<Type>() {
                            request_type = Some(ty);
                        }
                    }
                    false // strip the attribute
                } else {
                    true // keep other attributes
                }
            });

            if let Some(req_type) = request_type {
                let fn_ident = method.sig.ident.clone();

                let parameter_types = extract_parameter_types(&method.sig);
                let (uses_connection, param_type) = match parameter_types.as_slice() {
                    [] => (false, None),
                    [request] => (false, Some(request.clone())),
                    [_connection, request] => (true, Some(request.clone())),
                    _ => panic!("custom method handlers accept at most a connection and request"),
                };
                let return_type = extract_return_type(&method.sig);
                let ok_type = extract_result_ok_type(&method.sig);

                routes.push(Route {
                    request_type: req_type,
                    fn_ident,
                    param_type,
                    uses_connection,
                    return_type,
                    ok_type,
                });
            }
        }
    }

    // Generate the dispatch arms using matches_method for routing.
    let arms: Vec<_> = routes
        .iter()
        .map(|route| {
            let req_type = &route.request_type;
            let fn_ident = &route.fn_ident;
            let call = if route.uses_connection {
                quote! { self.#fn_ident(cx, req).await? }
            } else {
                quote! { self.#fn_ident(req).await? }
            };

            match &route.param_type {
                Some(_) => {
                    quote! {
                        if <#req_type as agent_client_protocol::JsonRpcMessage>::matches_method(method) {
                            let req = serde_json::from_value(params)
                                .map_err(|e| agent_client_protocol::Error::invalid_params().data(e.to_string()))?;
                            let result = #call;
                            return serde_json::to_value(&result)
                                .map_err(|e| agent_client_protocol::Error::internal_error().data(e.to_string()));
                        }
                    }
                }
                None => {
                    quote! {
                        if <#req_type as agent_client_protocol::JsonRpcMessage>::matches_method(method) {
                            let result = self.#fn_ident().await?;
                            return serde_json::to_value(&result)
                                .map_err(|e| agent_client_protocol::Error::internal_error().data(e.to_string()));
                        }
                    }
                }
            }
        })
        .collect();

    // Generate schema entries for each route using SchemaGenerator for $ref dedup.
    let schema_entries: Vec<_> = routes
        .iter()
        .map(|route| {
            let req_type = &route.request_type;

            let params_expr = if let Some(pt) = &route.param_type {
                if is_json_value(pt) {
                    quote! { None }
                } else {
                    quote! { Some(generator.subschema_for::<#pt>()) }
                }
            } else {
                // Even with no handler param, generate schema from the request type
                if is_json_value(req_type) {
                    quote! { None }
                } else {
                    quote! { Some(generator.subschema_for::<#req_type>()) }
                }
            };

            let response_expr = if let Some(ok_ty) = &route.ok_type {
                if is_json_value(ok_ty) {
                    quote! { None }
                } else {
                    quote! { Some(generator.subschema_for::<#ok_ty>()) }
                }
            } else {
                quote! { None }
            };

            let params_name_expr = if let Some(pt) = &route.param_type {
                if is_json_value(pt) {
                    quote! { None }
                } else {
                    let name = type_name(pt);
                    quote! { Some(#name.to_string()) }
                }
            } else {
                let name = type_name(req_type);
                quote! { Some(#name.to_string()) }
            };

            let response_name_expr = if let Some(ok_ty) = &route.ok_type {
                if is_json_value(ok_ty) {
                    quote! { None }
                } else {
                    let name = type_name(ok_ty);
                    quote! { Some(#name.to_string()) }
                }
            } else {
                quote! { None }
            };

            quote! {
                {
                    let dummy = <#req_type as Default>::default();
                    crate::custom_requests::CustomMethodSchema {
                        method: agent_client_protocol::JsonRpcMessage::method(&dummy).to_string(),
                        params_schema: #params_expr,
                        params_t
```

### Core Architecture Module: `crates/goose-agent/src/events.rs`
```
use goose_provider_types::conversation::{
    message::{Message, MessageUsage},
    token_usage::ProviderUsage,
    Conversation,
};
use rmcp::model::ServerNotification;

#[derive(Clone, Debug)]
pub enum AgentEvent {
    Message(Message),
    Usage(ProviderUsage),
    MessageUsage {
        message_id: Option<String>,
        usage: MessageUsage,
    },
    McpNotification((String, ServerNotification)),
    HistoryReplaced(Conversation),
}

```

### Core Architecture Module: `crates/goose-agent/src/inference.rs`
```
//! Provider inference operation for the unrolled agent loop.

use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use futures::StreamExt;
use goose_provider_types::base::Provider;
use goose_provider_types::conversation::message::{InferenceMetadata, Message, MessageContent};
use goose_provider_types::conversation::token_usage::ProviderUsage;
use goose_provider_types::conversation::{
    effective_role, fix_conversation, merge_consecutive_messages_for_request, Conversation,
    EffectiveRole,
};
use goose_provider_types::errors::ProviderError;
use goose_provider_types::model::ModelConfig;
use tracing_futures::Instrument;

use crate::operation::{
    applied, messages_since_kickoff, not_applicable, trailing_error, yielded_with, Emitter,
    Inference, InferenceInput, Operation, OperationResult,
};
use goose_provider_types::maybe_send::{MaybeSend, MaybeSync};

pub struct PreparedInferenceRequest {
    pub system_prompt: String,
    pub tools: Vec<rmcp::model::Tool>,
    pub additional_messages: Vec<Message>,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]
pub trait InferenceRequestPreparer<S>: MaybeSend + MaybeSync {
    async fn prepare(
        &self,
        session: &S,
        conversation: &Conversation,
        input: InferenceInput,
    ) -> Result<PreparedInferenceRequest>;
}

pub struct IdentityInferenceRequestPreparer;

#[cfg_attr(not(target_arch = "wasm32"), async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]
impl<S: MaybeSync> InferenceRequestPreparer<S> for IdentityInferenceRequestPreparer {
    async fn prepare(
        &self,
        _session: &S,
        _conversation: &Conversation,
        input: InferenceInput,
    ) -> Result<PreparedInferenceRequest> {
        Ok(PreparedInferenceRequest {
            system_prompt: input
                .prompt_parts
                .into_iter()
                .map(|(_, part)| part)
                .collect::<Vec<_>>()
                .join("\n\n"),
            tools: input.tools,
            additional_messages: Vec::new(),
        })
    }
}

pub trait InferenceEffect: From<Message> + MaybeSend + 'static {
    fn record_usage(usage: ProviderUsage) -> Self;
}

const EMPTY_RESPONSE_MESSAGE: &str =
    "The model returned an empty response. Please resend your message to continue.";
const CANCELLED_TOOL_RESPONSE: &str = "Tool call was cancelled before execution";

fn is_thinking(content: &MessageContent) -> bool {
    matches!(
        content,
        MessageContent::Thinking(_) | MessageContent::RedactedThinking(_)
    )
}

fn drop_repeated_tool_call_thinking(accumulator: &Conversation, chunk: &mut Message) {
    if !chunk
        .content
        .iter()
        .any(|content| matches!(content, MessageContent::ToolRequest(_)))
    {
        return;
    }
    let prior: Vec<&MessageContent> = accumulator
        .iter()
        .filter(|message| message.role == chunk.role)
        .flat_map(|message| message.content.iter())
        .filter(|content| is_thinking(content))
        .collect();
    chunk
        .content
        .retain(|content| !(is_thinking(content) && prior.contains(&content)));
}

pub fn chat_span(
    provider: &dyn Provider,
    model_config: &ModelConfig,
    session_id: &str,
    purpose: &'static str,
) -> tracing::Span {
    let span = tracing::info_span!(
        target: "goose::state_machine",
        "chat",
        "gen_ai.operation.name" = "chat",
        "gen_ai.provider.name" = %provider.get_name(),
        "gen_ai.request.model" = %model_config.model_name,
        "gen_ai.request.temperature" = tracing::field::Empty,
        "gen_ai.request.max_tokens" = tracing::field::Empty,
        "gen_ai.response.model" = tracing::field::Empty,
        "gen_ai.response.finish_reasons" = tracing::field::Empty,
        "gen_ai.response.id" = tracing::field::Empty,
        "gen_ai.usage.input_tokens" = tracing::field::Empty,
        "gen_ai.usage.output_tokens" = tracing::field::Empty,
        "goose.chat.purpose" = purpose,
        "error.type" = tracing::field::Empty,
        session.id = %session_id,
    );
    record_request_params(&span, model_config);
    span
}

fn is_empty_response(message: &Message) -> bool {
    message.content.iter().all(|content| match content {
        MessageContent::Text(text) => text.text.trim().is_empty(),
        MessageContent::Thinking(thinking) => {
            thinking.thinking.trim().is_empty() && thinking.signature.is_empty()
        }
        _ => false,
    })
}

pub fn ends_with_successful_tool_response(messages: &[Message]) -> bool {
    let Some(message) = messages.last() else {
        return false;
    };
    let mut responses = message
        .content
        .iter()
        .filter_map(MessageContent::as_tool_response)
        .peekable();
    responses.peek().is_some()
        && responses.all(|response| {
            response
                .tool_result
                .as_ref()
                .is_ok_and(|result| !result.is_error.unwrap_or(false))
        })
}

fn record_request_params(span: &tracing::Span, model_config: &ModelConfig) {
    if let Some(temperature) = model_config.temperature {
        span.record("gen_ai.request.temperature", temperature as f64);
    }
    if let Some(max_tokens) = model_config.max_tokens {
        span.record("gen_ai.request.max_tokens", max_tokens as i64);
    }
}

pub fn record_chat_usage(span: &tracing::Span, usage: &ProviderUsage) {
    span.record("gen_ai.response.model", usage.model.as_str());
    if let Some(tokens) = usage.usage.input_tokens {
        span.record("gen_ai.usage.input_tokens", tokens);
    }
    if let Some(tokens) = usage.usage.output_tokens {
        span.record("gen_ai.usage.output_tokens", tokens);
    }
    if let Some(tokens) = usage.usage.cache_read_input_tokens {
        span.record("gen_ai.usage.cache_read.input_tokens", tokens);
    }
    if let Some(tokens) = usage.usage.cache_write_input_tokens {
        span.record("gen_ai.usage.cache_creation.input_tokens", tokens);
    }
    if let Some(reasons) = &usage.finish_reasons {
        let reasons_json = serde_json::to_string(reasons).unwrap_or_default();
        span.record("gen_ai.response.finish_reasons", reasons_json.as_str());
    }
    if let Some(id) = &usage.response_id {
        span.record("gen_ai.response.id", id.as_str());
    }
}

pub struct InferenceRunner<'a, S, E> {
    provider: Arc<dyn Provider>,
    model_config: ModelConfig,
    request_preparer: Arc<dyn InferenceRequestPreparer<S> + 'a>,
    effect: std::marker::PhantomData<fn() -> E>,
}

/// The agent-visible conversation as the provider sees it: tool requests left
/// unanswered by an earlier turn are dropped, since nothing will answer them now.
fn messages_for_provider(
    conversation: &Conversation,
    turn: &[Message],
    keep_empty_messages: bool,
) -> Vec<Message> {
    let answered: std::collections::HashSet<&str> = conversation
        .messages()
        .iter()
        .flat_map(|message| message.get_tool_response_ids())
        .collect();
    let start = conversation.len() - turn.len();
    conversation
        .messages()
        .iter()
        .enumerate()
        .filter(|(_, message)| message.is_agent_visible())
        .map(|(index, message)| {
            let mut message = message.agent_visible_content();
            if index < start {
                message.content.retain(|content| match content {
                    MessageContent::ToolRequest(request) => answered.contains(request.id.as_str()),
                    _ => true,
                });
            }
            message
        })
        .filter(|message| keep_empty_messages || !message.content.is_empty())
        .collect()
}

fn latest_provider_session_id<'a>(
    conversation: &'a Conversation,
    provider: &str,
) -> Option<&'a str> {
    conversation
        .messages()
        .iter()
        .rev()
        .find_map(|message| message.metadata.in
```

### Core Architecture Module: `crates/goose-agent/src/lib.rs`
```
pub mod events;
pub mod inference;
pub mod machine;
pub mod operation;
pub mod tool;

```

### Core Architecture Module: `crates/goose-agent/src/machine.rs`
```
use std::{collections::HashSet, sync::Arc};

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use tokio_util::sync::CancellationToken;

use crate::operation::{
    ConversationEffect, Emitter, Inference, InferenceInput, MachineEffect, Operation,
    OperationFuture, OperationResult, StepResult,
};
use goose_provider_types::conversation::Conversation;
use goose_provider_types::maybe_send::{MaybeSend, MaybeSync};

pub trait MachineSession: MaybeSend + MaybeSync {
    fn id(&self) -> &str;
    fn conversation(&self) -> Option<&Conversation>;
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]
pub trait SessionLoader<S>: MaybeSend + MaybeSync {
    async fn load(&self, session_id: &str) -> Result<S>;
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]
pub trait EffectHandler<S, E>: MaybeSend + MaybeSync {
    async fn apply_effects(&self, session: &S, effects: &mut [E], emit: &Emitter) -> Result<()>;
}

pub trait EffectUsage<E>: MaybeSend + MaybeSync {
    fn usage(&self, _effect: &E) -> Option<goose_provider_types::conversation::token_usage::Usage> {
        None
    }
}

pub enum Step<'a, S, E = ConversationEffect> {
    Operation(Arc<dyn Operation<S, E> + 'a>),
    Inference(Arc<dyn Inference<S, E> + 'a>),
}

impl<S, E: MaybeSend> Step<'_, S, E> {
    fn operation(&self) -> &dyn Operation<S, E> {
        match self {
            Step::Operation(operation) => operation.as_ref(),
            Step::Inference(inference) => inference.as_ref(),
        }
    }
}

pub struct StateMachine<'a, S, E = ConversationEffect> {
    steps: Vec<Step<'a, S, E>>,
    cancel: CancellationToken,
}

fn add_tools_to_inference_input(
    input: &mut InferenceInput,
    tool_names: &mut HashSet<String>,
    tools: Vec<rmcp::model::Tool>,
) -> Result<()> {
    for tool in tools {
        if !tool_names.insert(tool.name.to_string()) {
            anyhow::bail!("multiple operations registered tool '{}'", tool.name);
        }
        input.tools.push(tool);
    }
    Ok(())
}

impl<'a, S, E> StateMachine<'a, S, E>
where
    S: MachineSession,
    E: MachineEffect + MaybeSend + 'static,
{
    pub fn new(steps: Vec<Step<'a, S, E>>, cancel: CancellationToken) -> Self {
        Self { steps, cancel }
    }

    pub async fn step(&self, session: &S, emit: &Emitter) -> Result<Option<StepResult<E>>> {
        let conversation = session
            .conversation()
            .ok_or_else(|| anyhow!("state-machine session loaded without conversation"))?;

        for step in &self.steps {
            let name = step.operation().name();
            let result = if self.cancel.is_cancelled() {
                OperationResult::NotApplicable
            } else {
                let step_fut: OperationFuture<'_, Result<OperationResult<E>>> = match step {
                    Step::Operation(operation) => operation.run(session, conversation, emit),
                    Step::Inference(inference) => {
                        if !inference.applies(conversation) {
                            continue;
                        }
                        let mut input = InferenceInput::default();
                        let mut tool_names = HashSet::new();
                        for operation in self.steps.iter().map(|step| step.operation()) {
                            let tools = tokio::select! {
                                biased;
                                _ = self.cancel.cancelled() => return Ok(None),
                                tools = operation.inference_tools(session) => tools?,
                            };
                            add_tools_to_inference_input(&mut input, &mut tool_names, tools)?;
                            input
                                .prompt_parts
                                .extend(operation.prompt_parts(session, conversation).await?);
                            input
                                .moim_parts
                                .extend(operation.moim_parts(session, conversation).await?);
                        }
                        inference.infer(session, conversation, input, emit)
                    }
                };
                step_fut.await?
            };
            let cancelled = self.cancel.is_cancelled();
            let result = if cancelled {
                step.operation()
                    .cancel(session, conversation, result, emit)
                    .await?
            } else {
                result
            };

            match result {
                OperationResult::NotApplicable => {}
                OperationResult::Applied(mut result) => {
                    result.applied_step = Some(name);
                    for effect in &mut result.effects {
                        effect.ensure_message_ids();
                    }
                    if cancelled {
                        result.yield_to_client = true;
                    }
                    return Ok(Some(result));
                }
            }
        }

        Ok(None)
    }

    pub async fn apply<R>(
        &self,
        runtime: &R,
        session: &S,
        result: &mut StepResult<E>,
        emit: &Emitter,
    ) -> Result<()>
    where
        R: EffectHandler<S, E>,
    {
        for effect in &mut result.effects {
            effect.ensure_message_ids();
        }
        runtime
            .apply_effects(session, &mut result.effects, emit)
            .await
    }

    pub async fn run<R>(&self, runtime: &R, session_id: &str, emit: &Emitter) -> Result<S>
    where
        R: SessionLoader<S> + EffectHandler<S, E>,
    {
        loop {
            let session = runtime.load(session_id).await?;
            let Some(mut result) = self.step(&session, emit).await? else {
                break;
            };
            self.apply(runtime, &session, &mut result, emit).await?;
            if result.yield_to_client {
                break;
            }
        }
        runtime.load(session_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_duplicate_tools_across_operations() {
        let schema = Arc::new(serde_json::Map::new());
        let mut input = InferenceInput::default();
        let mut names = HashSet::new();

        add_tools_to_inference_input(
            &mut input,
            &mut names,
            vec![rmcp::model::Tool::new("duplicate", "first", schema.clone())],
        )
        .unwrap();
        let error = add_tools_to_inference_input(
            &mut input,
            &mut names,
            vec![rmcp::model::Tool::new("duplicate", "second", schema)],
        )
        .unwrap_err();

        assert_eq!(
            error.to_string(),
            "multiple operations registered tool 'duplicate'"
        );
    }
}

```

### Core Architecture Module: `crates/goose-agent/src/operation.rs`
```
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::future::Future;
use std::pin::Pin;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::events::AgentEvent;
use goose_provider_types::conversation::message::{Message, MessageContent, MessageErrorKind};
use goose_provider_types::conversation::{effective_role, Conversation, EffectiveRole};
use goose_provider_types::maybe_send::{MaybeSend, MaybeSync};
use rmcp::model::Tool;

#[cfg(not(target_arch = "wasm32"))]
pub type OperationFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

#[cfg(target_arch = "wasm32")]
pub type OperationFuture<'a, T> = Pin<Box<dyn Future<Output = T> + 'a>>;

pub struct SlashCommand<'a> {
    pub command: &'a str,
    pub params_str: &'a str,
}

pub fn messages_since_kickoff(conversation: &Conversation) -> Result<&[Message]> {
    let messages = conversation.messages();
    let start = messages
        .iter()
        .rposition(|message| {
            message.role == rmcp::model::Role::User
                && message.is_user_visible()
                && !message.is_tool_response()
        })
        .ok_or_else(|| anyhow!("state machine conversation has no kickoff message"))?;
    Ok(&messages[start..])
}

pub fn trailing_error(conversation: &Conversation) -> Option<MessageErrorKind> {
    conversation.last().and_then(Message::error_kind)
}

pub fn last_effective_role(messages: &[Message]) -> Result<EffectiveRole> {
    messages
        .last()
        .map(effective_role)
        .ok_or_else(|| anyhow!("cannot determine the role of an empty conversation"))
}

pub fn assistant_turn_count(messages: &[Message]) -> u32 {
    let mut turns = 0;
    let mut in_assistant_block = false;
    for message in messages.iter().rev() {
        if message.role == rmcp::model::Role::Assistant {
            if !in_assistant_block {
                turns += 1;
                in_assistant_block = true;
            }
        } else {
            in_assistant_block = false;
        }
    }
    turns
}

pub fn ends_turn(messages: &[Message]) -> bool {
    messages.last().is_some_and(|last| {
        last.role == rmcp::model::Role::Assistant
            && last.error_kind().is_none()
            && !last.content.iter().any(|content| {
                matches!(
                    content,
                    MessageContent::ToolRequest(_) | MessageContent::ActionRequired(_)
                )
            })
    })
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]
pub trait Operation<S, E: MaybeSend + 'static = ConversationEffect>: MaybeSend + MaybeSync {
    fn name(&self) -> &'static str;

    /// Note on a message something this operation did, so that a pipeline rebuilt
    /// from the persisted conversation reaches the same conclusion. Notes record
    /// past actions only — anything an operation would have to compute again does
    /// not belong here.
    fn set_message_meta(&self, message: &mut Message, key: &str, value: serde_json::Value) {
        message.metadata.set_operation_note(self.name(), key, value);
    }

    fn message_meta<'a>(&self, message: &'a Message, key: &str) -> Option<&'a serde_json::Value> {
        message.metadata.operation_note(self.name(), key)
    }

    async fn cancel(
        &self,
        _session: &S,
        _conversation: &Conversation,
        result: OperationResult<E>,
        _emit: &Emitter,
    ) -> Result<OperationResult<E>> {
        Ok(result)
    }

    async fn run_command(
        &self,
        _command: &SlashCommand<'_>,
        _session: &S,
        _conversation: &Conversation,
        _emit: &Emitter,
    ) -> Result<OperationResult<E>> {
        not_applicable()
    }

    async fn inference_tools(&self, _session: &S) -> Result<Vec<Tool>> {
        Ok(Vec::new())
    }

    async fn prompt_parts(
        &self,
        _session: &S,
        _conversation: &Conversation,
    ) -> Result<Vec<(String, String)>> {
        Ok(Vec::new())
    }

    async fn moim_parts(&self, _session: &S, _conversation: &Conversation) -> Result<Vec<String>> {
        Ok(Vec::new())
    }

    async fn run(
        &self,
        _session: &S,
        _conversation: &Conversation,
        _emit: &Emitter,
    ) -> Result<OperationResult<E>> {
        not_applicable()
    }
}

#[derive(Default)]
pub struct InferenceInput {
    pub tools: Vec<Tool>,
    pub prompt_parts: Vec<(String, String)>,
    pub moim_parts: Vec<String>,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]
pub trait Inference<S, E: MaybeSend + 'static = ConversationEffect>: Operation<S, E> {
    /// Whether the next step would reach the provider. The machine asks before
    /// firing the hooks that mark the start of a turn.
    fn applies(&self, conversation: &Conversation) -> bool;

    async fn infer(
        &self,
        session: &S,
        conversation: &Conversation,
        input: InferenceInput,
        emit: &Emitter,
    ) -> Result<OperationResult<E>>;
}

pub struct StepResult<E = ConversationEffect> {
    pub effects: Vec<E>,
    pub applied_step: Option<&'static str>,
    pub yield_to_client: bool,
}

pub enum OperationResult<E = ConversationEffect> {
    NotApplicable,
    Applied(StepResult<E>),
}

pub fn not_applicable<E>() -> Result<OperationResult<E>> {
    Ok(OperationResult::NotApplicable)
}

pub fn applied<E>(effects: impl IntoIterator<Item = E>) -> Result<OperationResult<E>> {
    Ok(OperationResult::Applied(StepResult {
        effects: effects.into_iter().collect(),
        applied_step: None,
        yield_to_client: false,
    }))
}

pub fn yielded<E>() -> Result<OperationResult<E>> {
    Ok(OperationResult::Applied(StepResult {
        effects: Vec::new(),
        applied_step: None,
        yield_to_client: true,
    }))
}

pub fn yielded_with<E>(effects: impl IntoIterator<Item = E>) -> Result<OperationResult<E>> {
    Ok(OperationResult::Applied(StepResult {
        effects: effects.into_iter().collect(),
        applied_step: None,
        yield_to_client: true,
    }))
}

pub trait MachineEffect {
    fn ensure_message_ids(&mut self);
}

pub enum ConversationEffect {
    AppendMessage(Message),
    ReplaceConversation(Conversation),
    PatchToolRequestMeta {
        tool_call_id: String,
        patch: serde_json::Value,
    },
    SetMessageVisibility {
        message_id: String,
        user_visible: bool,
        agent_visible: bool,
    },
}

impl MachineEffect for ConversationEffect {
    fn ensure_message_ids(&mut self) {
        let messages = match self {
            ConversationEffect::AppendMessage(message) => std::slice::from_mut(message),
            ConversationEffect::ReplaceConversation(conversation) => {
                conversation.messages_mut().as_mut_slice()
            }
            _ => return,
        };
        for message in messages {
            if message.id.is_none() {
                message.id = Some(format!("msg_{}", uuid::Uuid::new_v4()));
            }
        }
    }
}

impl From<Message> for ConversationEffect {
    fn from(message: Message) -> Self {
        ConversationEffect::AppendMessage(message)
    }
}

impl From<Conversation> for ConversationEffect {
    fn from(conversation: Conversation) -> Self {
        ConversationEffect::ReplaceConversation(conversation)
    }
}

pub struct Emitter {
    tx: mpsc::Sender<AgentEvent>,
    cancel: CancellationToken,
}

impl Emitter {
    pub fn new(tx: mpsc::Sender<AgentEvent>, cancel: CancellationToken) -> Self {
        Self { tx, cancel }
    }

    pub async fn emit(&self, event: AgentEvent) {
        let _ = self.tx.send(event).await;
    }

    pub async fn message(&self, message: Message) -> Message {
        let message = message.with_generated_id_if_missing();
        self.emit(AgentEvent::Message(message.clone())).await;
        message
    }

    pub fn cancel_token(&self) -> &CancellationToke
```

### Core Architecture Module: `crates/goose-agent/src/tool.rs`
```
use std::{collections::HashSet, sync::Arc};

use anyhow::Result;
use async_trait::async_trait;
use goose_provider_types::conversation::{
    message::{Message, MessageContent, ToolRequest},
    Conversation,
};
use rmcp::{
    handler::server::router::tool::{AsyncTool, SyncTool, ToolBase},
    model::{CallToolRequestParams, CallToolResult, ErrorData, JsonObject, Tool},
};
use serde_json::{json, Value};

use crate::operation::{
    applied, messages_since_kickoff, not_applicable, Emitter, Operation, OperationFuture,
    OperationResult,
};
use goose_provider_types::maybe_send::{MaybeSend, MaybeSync};

fn empty_input_schema() -> Arc<JsonObject> {
    Arc::new(
        serde_json::from_value(json!({
            "type": "object",
            "properties": {},
            "additionalProperties": false
        }))
        .expect("empty tool input schema is an object"),
    )
}

fn definition<T: ToolBase>() -> Tool {
    let mut tool = Tool::new_with_raw(
        T::name(),
        T::description(),
        T::input_schema().unwrap_or_else(empty_input_schema),
    );
    if let Some(title) = T::title() {
        tool = tool.with_title(title);
    }
    if let Some(output_schema) = T::output_schema() {
        tool = tool.with_raw_output_schema(output_schema);
    }
    if let Some(annotations) = T::annotations() {
        tool = tool.with_annotations(annotations);
    }
    if let Some(icons) = T::icons() {
        tool = tool.with_icons(icons);
    }
    if let Some(meta) = T::meta() {
        tool = tool.with_meta(meta);
    }
    tool
}

fn pending_requests(requests: Vec<ToolRequest>, tool_names: &HashSet<&str>) -> Vec<ToolRequest> {
    requests
        .into_iter()
        .filter(|request| {
            request
                .tool_call
                .as_ref()
                .map_or(true, |call| tool_names.contains(call.name.as_ref()))
        })
        .collect()
}

fn interrupted_result() -> Result<CallToolResult, ErrorData> {
    Ok(CallToolResult::error(vec![
        rmcp::model::ContentBlock::text("Tool call was interrupted before completing"),
    ]))
}

fn parameters<T: ToolBase>(arguments: Option<JsonObject>) -> Result<T::Parameter, ErrorData> {
    if T::input_schema().is_none() {
        return Ok(T::Parameter::default());
    }

    serde_json::from_value(Value::Object(arguments.unwrap_or_default())).map_err(|error| {
        ErrorData::invalid_params(format!("failed to deserialize parameters: {error}"), None)
    })
}

fn result<T: ToolBase>(output: Result<T::Output, T::Error>) -> Result<CallToolResult, ErrorData> {
    let output = output.map_err(Into::into)?;
    let value = serde_json::to_value(output).map_err(|error| {
        ErrorData::internal_error(format!("failed to serialize tool output: {error}"), None)
    })?;
    Ok(CallToolResult::structured(value))
}

#[cfg(not(target_arch = "wasm32"))]
async fn invoke_sync<S, T>(
    session: S,
    parameters: T::Parameter,
) -> Result<CallToolResult, ErrorData>
where
    S: Send + Sync + 'static,
    T: SyncTool<S> + 'static,
{
    tokio::task::spawn_blocking(move || result::<T>(T::invoke(&session, parameters)))
        .await
        .map_err(|error| {
            ErrorData::internal_error(format!("synchronous tool task failed: {error}"), None)
        })?
}

// wasm32 has no threads to move blocking work onto, so the tool runs inline
// and cancellation cannot interrupt it.
#[cfg(target_arch = "wasm32")]
async fn invoke_sync<S, T>(
    session: S,
    parameters: T::Parameter,
) -> Result<CallToolResult, ErrorData>
where
    S: MaybeSend + MaybeSync + 'static,
    T: SyncTool<S>,
{
    result::<T>(T::invoke(&session, parameters))
}

/// Supplies tools whose definitions and implementations may vary by session.
///
/// A provider's tool names and their handlers must remain stable from an inference
/// advertisement until every tool call produced by that inference has been handled.
#[cfg_attr(not(target_arch = "wasm32"), async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]
pub trait ToolProvider<S>: MaybeSend + MaybeSync {
    async fn tools(&self, session: &S) -> Result<Vec<Tool>>;

    async fn call(
        &self,
        session: &S,
        request_id: &str,
        call: CallToolRequestParams,
        emit: &Emitter,
    ) -> Result<CallToolResult, ErrorData>;
}

#[cfg(not(target_arch = "wasm32"))]
type ToolHandler<S> = dyn for<'a> Fn(&'a S, Option<JsonObject>) -> OperationFuture<'a, Result<CallToolResult, ErrorData>>
    + Send
    + Sync;

#[cfg(target_arch = "wasm32")]
type ToolHandler<S> = dyn for<'a> Fn(
    &'a S,
    Option<JsonObject>,
) -> OperationFuture<'a, Result<CallToolResult, ErrorData>>;

struct RegisteredTool<S> {
    definition: Tool,
    handler: Arc<ToolHandler<S>>,
}

struct RegisteredToolProvider<S> {
    tools: Vec<RegisteredTool<S>>,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]
impl<S> ToolProvider<S> for RegisteredToolProvider<S>
where
    S: MaybeSend + MaybeSync + 'static,
{
    async fn tools(&self, _session: &S) -> Result<Vec<Tool>> {
        Ok(self
            .tools
            .iter()
            .map(|tool| tool.definition.clone())
            .collect())
    }

    async fn call(
        &self,
        session: &S,
        _request_id: &str,
        call: CallToolRequestParams,
        _emit: &Emitter,
    ) -> Result<CallToolResult, ErrorData> {
        let tool = self
            .tools
            .iter()
            .find(|tool| tool.definition.name == call.name)
            .ok_or_else(|| {
                ErrorData::invalid_params(format!("unknown tool {}", call.name), None)
            })?;
        (tool.handler)(session, call.arguments).await
    }
}

/// An agent operation that advertises and dispatches tools.
///
/// Tools can be registered from rmcp's typed tool traits, or supplied at runtime
/// by a [`ToolProvider`] whose definitions may vary by session.
pub struct ToolOperation<S> {
    registered: RegisteredToolProvider<S>,
    providers: Vec<Arc<dyn ToolProvider<S>>>,
}

impl<S> ToolOperation<S>
where
    S: MaybeSend + MaybeSync + 'static,
{
    pub fn new() -> Self {
        Self {
            registered: RegisteredToolProvider { tools: Vec::new() },
            providers: Vec::new(),
        }
    }

    fn register(&mut self, tool: RegisteredTool<S>) {
        if let Some(existing) = self
            .registered
            .tools
            .iter_mut()
            .find(|existing| existing.definition.name == tool.definition.name)
        {
            *existing = tool;
        } else {
            self.registered.tools.push(tool);
        }
    }

    pub fn with_provider(mut self, provider: Arc<dyn ToolProvider<S>>) -> Self {
        self.providers.push(provider);
        self
    }

    pub fn with_sync_tool<T>(mut self) -> Self
    where
        S: Clone,
        T: SyncTool<S> + MaybeSend + MaybeSync + 'static,
    {
        self.register(RegisteredTool {
            definition: definition::<T>(),
            handler: Arc::new(|session, arguments| {
                let session = session.clone();
                Box::pin(async move {
                    let parameters = parameters::<T>(arguments)?;
                    invoke_sync::<S, T>(session, parameters).await
                })
            }),
        });
        self
    }

    pub fn with_async_tool<T>(mut self) -> Self
    where
        T: AsyncTool<S> + MaybeSend + MaybeSync + 'static,
    {
        self.register(RegisteredTool {
            definition: definition::<T>(),
            handler: Arc::new(|session, arguments| {
                Box::pin(async move {
                    let parameters = parameters::<T>(arguments)?;
                    result::<T>(T::invoke(session, parameters).await)
                })
            }),
        });
        self
    }

    async fn available_tools(&self, session: &S) -> Result<Vec<(Tool, &dyn ToolProvider<S>)>> {
        let mut ava
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12607** (2026-09-30): **fix: show current session ID in /status**
  *Symptoms*: Fixes #12214  ## Summary  I added the full goose session ID to `/status`, so I can copy it from the current conversation and resume that session in another ACP client or in the CLI. The issue was **Ready** on the Goose Issues board before I started.  Both the legacy loop and the state-machine loop now display the ID. I also updated the command descriptions, CLI help, CLI guide, and self-test recipe.  ### Implementation  The legacy handler already receives `session_id`, and the state-machine handler already holds `Session.id`. I use those existing values directly—no new lookup, configuration, or model call. The response stays user-visible and agent-invisible, and all existing status fields remain unchanged.  ```mermaid flowchart LR     A["CLI / ACP client: /status"] --> B["Legacy handler: session_id"]     A --> C["State-machine handler: Session.id"]     B --> D["Session status with full ID"]     C --> D     D --> E["User can copy ID and resume"] ```  This is the goose session ID, not a provider's internal session identifier. I kept model self-awareness (#12213) out of this change; the existing model/provider information is still shown to the user.  ### Testing  - `cargo fmt --all -- --check` - `cargo test -p goose --features rustls-tls --test status_command --locked` — both loop variants pass. - `cargo clippy -p goose --features rustls-tls --test status_command --locked -- -D warnings` - `cargo build -p goose-cli --no-default-features --features rustls-tls --bin goose --locked
  **Post-Mortem & Fix Analysis**:
  > I'm withdrawing this PR for now. The focused regression tests, formatting, Clippy, and minimal CLI build passed locally, but I haven't completed the model-backed self-test or an end-to-end check in a real client. I should finish that validation before asking for review. Sorry for the premature submission.

- **Issue #12605** (2026-09-30): **fix: session naming/"none" reasoning effort fails for gpt-6.1-sol**
  *Symptoms*: Discovered during release testing: gpt-6.1-sol fails session naming because it rejects "none" for thinking.  This fix is obsoleted by #12568, but we should patch this for the 1.53 release.
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-30T17:42:10.333601Z">2026-09-30T17:42:10.333601Z</relative-time> | `67075ef` | New commits |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #12603** (2026-09-30): **fix: reflect loading state of chats**
  *Symptoms*: Fixes https://github.com/aaif-goose/goose/issues/12553  ## Summary * Adds a loading state so it's distinguishable from `No Chats`  ### Testing Manual local usage of Desktop  ### Related Issues https://github.com/aaif-goose/goose/issues/12553  ### Screenshots/Demos (for UX changes) Before (left) and after (right) when the chats are loading  <img width="442" height="489" alt="Screenshot 2026-09-30 at 11 18 36 AM" src="https://github.com/user-attachments/assets/587e1294-d62b-4c5d-8fd2-f8fc090dc4b5" />  

- **Issue #12601** (2026-09-30): **Extensions directory: add Salt (ask a human in chat, invoices)**
  *Symptoms*: **What problem would this solve?** The extensions directory has no entry that lets a goose agent reach a human in a chat: ask a question with tappable answers, get the answer back, send an invoice. Today that means wiring a messaging API by hand.  **What would a good outcome look like?** Salt listed in the extensions directory as a remote extension that installs in one step, with users signing in to their own Salt account and choosing what the connection may do (chat only, or chat and money) at the consent screen.  **Possible approaches** Add one entry to `documentation/static/servers.json` (and optionally a `documentation/docs/mcp/` page). Proposed entry:  ```json {   "id": "salt",   "name": "Salt",   "description": "End-to-end encrypted chat where humans and AI agents are equal contacts: message, ask a human with tappable buttons, invoice and get paid",   "type": "streamable-http",   "url": "https://mcp.saltapp.ai/mcp",   "link": "https://github.com/0000F8/salt-mcp",   "installation_notes": "No local setup required. Connects to Salt's hosted server; sign in with your Salt account when prompted (OAuth 2.1, PKCE, dynamic client registration).",   "is_builtin": false,   "endorsed": false,   "environmentVariables": [] } ```  Verification plan: add the extension from the directory in goose Desktop, complete the browser sign-in, confirm `tools/list` returns Salt's tools and one read-only call (`list_salt_agents`) succeeds.  An implementation was opened before I saw the issue-firs
  **Post-Mortem & Fix Analysis**:
  > Thanks, but we aren't accepting extensions for the directory any longer. See https://github.com/aaif-goose/goose/discussions/10830

- **Issue #12594** (2026-09-30): **detect vision support**
  *Symptoms*: ## Summary Fixes #12535  ### Changes Ollama now reads the model’s `vision` capability from the existing `/api/show` lookup and sets `supports_vision` before formatting the request.   ### Verification: - Manually checked with `qwen3-vl:4b`
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-30T03:59:05.196878Z">2026-09-30T03:59:05.196878Z</relative-time> | `917c5cc` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #12592** (2026-09-30): **Extensions directory: add Kamai (construction blueprint takeoff)**
  *Symptoms*: **What problem would this solve?** The extensions directory has no entry for construction drawings. Estimators and contractors using goose can't pull takeoff data (rooms, walls, doors, windows, measured areas, lengths and counts) from PDF blueprints without setting up a server by hand.  **What would a good outcome look like?** Kamai listed in the extensions directory as a remote extension that installs in one step, with users signing in to their own Kamai account.  **Possible approaches** Add one entry to `documentation/static/servers.json`. Proposed entry:  ```json {   "id": "kamai",   "name": "Kamai",   "description": "Construction blueprint takeoff: turn PDF plans into rooms, walls, doors, windows, areas and counts.",   "type": "streamable-http",   "url": "https://mcp.kamai.io/mcp",   "link": "https://github.com/KamaiEnterprises/kamai-mcp",   "installation_notes": "No local setup required. Connects to Kamai's hosted server; sign in with your Kamai account when prompted.",   "is_builtin": false,   "endorsed": false,   "environmentVariables": [] } ```  Happy to open the PR once this reaches Ready.  **Additional context** - Official remote server: `https://mcp.kamai.io/mcp` (Streamable HTTP, OAuth 2.1, no API key) - Source: https://github.com/KamaiEnterprises/kamai-mcp (Apache-2.0) - Official MCP Registry: `io.kamai/mcp` - Docs: https://kamai.io/developers/mcp  - [x] I have verified this does not duplicate an existing feature request  Do not begin implementation until the iss
  **Post-Mortem & Fix Analysis**:
  > Thanks, but we aren't accepting extensions for the directory any longer. See https://github.com/aaif-goose/goose/discussions/10830

- **Issue #12591** (2026-09-30): **husd**
  *Symptoms*: **Describe the bug**  💡 Before filing, please check common issues:   https://goose-docs.ai/docs/troubleshooting    📦 To help us debug faster, attach your **diagnostics JSON report** if possible.   👉 How to capture it: https://goose-docs.ai/docs/troubleshooting/diagnostics-and-reporting/  A clear and concise description of what the bug is.  ---  **To Reproduce** Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  ---  **Expected behavior** A clear and concise description of what you expected to happen.  ---  **Screenshots** If applicable, add screenshots to help explain your problem.  ---  **Please provide the following information** - **OS & Arch:** windows 6.2.9200 x86_64 - **Interface:** UI - **Version:** 1.52.0 - **Extensions enabled:** developer, apps, summon, analyze, skills, Extension Manager, scheduler, tom - **Provider & Model:** custom_husd - gpt-5.5  ---  **Additional context** Add any other context about the problem here. 

- **Issue #12585** (2026-09-29): **fix(state-machine): preserve a final answer at the max-turns boundary**
  *Symptoms*: Fixes: #12582  ## Summary  The state machine now preserves a normal assistant response when it arrives on the last permitted turn. `MAX_TURNS_MESSAGE` is emitted only when the conversation still needs another autonomous action after the turn budget is exhausted.  ## Root cause  `MaxTurnsOperation` runs after the provider response has been added to the conversation. Its previous guard checked only whether `assistant_turn_count(messages)` had reached `max_turns`. A plain-text response on that exact turn therefore passed the guard, and the operation appended the budget warning over the completed result.  The state-machine module already exposes `ends_turn(messages)`, which distinguishes a completed assistant response from a conversation that still requires another operation. The missing check was at the operation boundary, rather than in turn counting itself.  This matters to callers that read the conversation's last assistant message. In particular, the sub-agent path can extract only the final response text; before this change that text was the budget notice, even though the model had already produced the requested answer.  ## Changes  - Import and check `ends_turn(messages)` before the existing max-turn count check. - Leave the current warning behavior unchanged for conversations that have reached the limit and still require another action. - Add `final_answer_on_last_allowed_turn_is_preserved`, a focused regression test using `max_turns: 1`. It verifies one inference call, t

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

### Incident Patch 1: `bab8ff64` (2026-09-30)
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

### Incident Patch 2: `5850d4a1` (2026-09-30)
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

---

### Incident Patch 3: `ff24a5e5` (2026-09-30)
**Commit Message**: fix(providers): read cache write tokens from Responses API usage (#12509)

Signed-off-by: Simon Ho <simon@holabs.dev>

**File**: `crates/goose-provider-types/src/formats/openai_responses.rs` (modified, +7/-6)
```diff
@@ -150,21 +150,22 @@ pub struct ResponseUsage {
 pub struct InputTokensDetails {
     #[serde(default)]
     pub cached_tokens: Option<i32>,
+    #[serde(default)]
+    pub cache_write_tokens: Option<i32>,
 }
 
 impl ResponseUsage {
     fn to_usage(&self) -> Usage {
-        // input_tokens already includes cached tokens
-        let cached_tokens = self
-            .input_tokens_details
-            .as_ref()
-            .and_then(|d| d.cached_tokens);
+        // input_tokens already includes both cache reads and cache writes
+        let details = self.input_tokens_details.as_ref();
+        let cached_tokens = details.and_then(|d| d.cached_tokens);
+        let cache_write_tokens = details.and_then(|d| d.cache_write_tokens);
         Usage::new(
             Some(self.input_tokens),
             Some(self.output_tokens),
             Some(self.total_tokens),
         )
-        .with_cache_tokens(cached_tokens, None)
+        .with_cache_tokens(cached_tokens, cache_write_tokens)
     }
 }
 
```

**File**: `crates/goose-provider-types/tests/openai_responses_cache_usage.rs` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+use futures::StreamExt;
+use goose_provider_types::conversation::token_usage::Usage;
+use goose_provider_types::formats::openai_responses::{
+    get_responses_usage, responses_api_to_streaming_message, ResponsesApiResponse,
+};
+use serde_json::json;
+
+async fn final_stream_usage(lines: Vec<String>) -> Usage {
+    let messages =
+        responses_api_to_streaming_message(tokio_stream::iter(lines.into_iter().map(Ok)));
+    futures::pin_mut!(messages);
+
+    let mut usage = None;
+    while let Some(item) = messages.next().await {
+        let (_, maybe_usage) = item.expect("stream item should parse");
+        if maybe_usage.is_some() {
+            usage = maybe_usage;
+        }
+    }
+    usage.expect("stream should report usage").usage
+}
+
+#[tokio::test]
+async fn stream_completed_reports_cache_write_tokens() {
+    let usage = final_stream_usage(vec![
+        r#"data: {"type":"response.created","sequence_number":1,"response":{"id":"resp_1","object":"response","created_at":1737368310,"status":"in_progress","model":"gpt-6-luna","output":[]}}"#.to_string(),
+        r#"data: {"type":"response.completed","sequence_number":2,"response":{"id":"resp_1","object":"response","created_at":1737368310,"status":"completed","model":"gpt-6-luna","output":[],"usage":{"input_tokens":5457,"input_tokens_details":{"cache_write_tokens":5454,"cached_tokens":0},"output_tokens":5,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":5462}}}"#.to_string(),
+        "data: [DONE]".to_string(),
+    ])
+    .await;
+
+    assert_eq!(usage.input_tokens, Some(5457));
+    assert_eq!(usage.total_tokens, Some(5462));
+    assert_eq!(usage.cache_read_input_tokens, Some(0));
+    assert_eq!(usage.cache_write_input_tokens, Some(5454));
+}
+
+#[tokio::test]
+async fn stream_incomplete_reports_cache_write_tokens() {
+    let usage = final_stream_usage(vec![
+        r#"data: {"type":"response.created","sequence_number":1,"response":{"id":"resp_1","object":"response","created_at":1737368310,"status":"in_progress","model":"gpt-6-luna","output":[]}}"#.to_string(),
+        r#"data: {"type":"response.incomplete","sequence_number":2,"response":{"id":"resp_1","object":"response","created_at":1737368310,"status":"incomplete","model":"gpt-6-luna","output":[],"incomplete_details":{"reason":"max_output_tokens"},"usage":{"input_tokens":10,"input_tokens_details":{"cache_write_tokens":6,"cached_tokens":3},"output_tokens":5,"total_tokens":15}}}"#.to_string(),
+        "data: [DONE]".to_string(),
+    ])
+    .await;
+
+    assert_eq!(usage.input_tokens, Some(10));
+    assert_eq!(usage.cache_read_input_tokens, Some(3));
+    assert_eq!(usage.cache_write_input_tokens, Some(6));
+}
+
+#[test]
+fn non_streaming_usage_reports_cache_read_and_write_tokens() {
+    let response: ResponsesApiResponse = serde_json::from_value(json!({
+        "id": "resp_1",
+        "object": "response",
+        "created_at": 1737368310,
+        "status": "completed",
+        "model": "gpt-6-luna",
+        "output": [],
+        "usage": {
+            "input_tokens": 2176,
+            "input_tokens_details": { "cache_write_tokens": 9, "cached_tokens": 2164 },
+            "output_tokens": 7,
+            "output_tokens_details": { "reasoning_tokens": 0 },
+            "total_tokens": 2183
+        }
+    }))
+    .unwrap();
+
+    let usage = get_responses_usage(&response);
+
+    assert_eq!(usage.input_tokens, Some(2176));
+    assert_eq!(usage.cache_read_input_tokens, Some(2164));
+    assert_eq!(usage.cache_write_input_tokens, Some(9));
+}
```

---

### Incident Patch 4: `861c9f35` (2026-09-29)
**Commit Message**: fix(recipe): strip inert parameters from session snapshots (#11988)

**File**: `crates/goose/src/recipe/validate_recipe.rs` (modified, +162/-0)
```diff
@@ -452,6 +452,34 @@ fn validate_recipe_parameters(recipe: &Recipe, template_variables: &HashSet<Stri
     validate_parameters_in_template(&recipe.parameters, template_variables)
 }
 
+/// Drop parameter keys that no longer appear as `{{ }}` (session snapshots).
+pub fn strip_unreferenced_parameters(mut recipe: Recipe) -> Recipe {
+    if recipe
+        .parameters
+        .as_ref()
+        .is_none_or(|parameters| parameters.is_empty())
+    {
+        recipe.parameters = None;
+        return recipe;
+    }
+
+    let Ok(yaml) = recipe.to_yaml() else {
+        return recipe;
+    };
+    let Ok((_, mut template_variables)) = parse_recipe_content(&yaml, None) else {
+        return recipe;
+    };
+    template_variables.remove(BUILT_IN_RECIPE_DIR_PARAM);
+
+    if let Some(parameters) = recipe.parameters.as_mut() {
+        parameters.retain(|parameter| template_variables.contains(&parameter.key));
+        if parameters.is_empty() {
+            recipe.parameters = None;
+        }
+    }
+    recipe
+}
+
 fn validate_json_schema(schema: &serde_json::Value) -> Result<()> {
     let schema_object = schema
         .as_object()
@@ -1177,4 +1205,138 @@ response:
 
         assert!(error.to_string().contains("JSON schema validation failed"));
     }
+
+    fn string_param(key: &str) -> RecipeParameter {
+        RecipeParameter {
+            key: key.to_string(),
+            input_type: RecipeParameterInputType::String,
+            requirement: RecipeParameterRequirement::Required,
+            description: format!("{key} parameter"),
+            default: None,
+            options: None,
+        }
+    }
+
+    #[test]
+    fn rendered_snapshot_with_leftover_parameters_fails_template_validation() {
+        let recipe = Recipe::builder()
+            .title("snapshot")
+            .description("rendered")
+            .prompt("hello")
+            .parameters(vec![string_param("message")])
+            .build()
+            .unwrap();
+
+        let error =
+            validate_recipe_template_from_content(&recipe.to_yaml().unwrap(), None).unwrap_err();
+        assert!(error
+            .to_string()
+            .contains("Unnecessary parameter definitions: message"));
+    }
+
+    #[test]
+    fn strip_unreferenced_parameters_lets_rendered_snapshot_validate() {
+        let recipe = Recipe::builder()
+            .title("snapshot")
+            .description("rendered")
+            .prompt("hello")
+            .parameters(vec![string_param("message")])
+            .build()
+            .unwrap();
+
+        let stripped = strip_unreferenced_parameters(recipe);
+        assert!(stripped.parameters.is_none());
+        validate_recipe_template_from_content(&stripped.to_yaml().unwrap(), None).unwrap();
+    }
+
+    fn render_with_message(message_value: &str) -> Recipe {
+        let recipe_content = r#"
+version: 1.0.0
+title: Snapshot
+description: Rendered snapshot
+prompt: "write a template like {{ message }}"
+parameters:
+  - key: message
+    input_type: string
+    requirement: required
+    description: message parameter
+"#;
+        let params = HashMap::from([("message".to_string(), message_value.to_string())]);
+        validate_recipe_template(recipe_content, None)
+            .unwrap()
+            .render(&params)
+            .unwrap()
+    }
+
+    #[test]
+    fn strip_unreferenced_parameters_when_a_rendered_value_looks_like_a_reference() {
+        let ordinary = render_with_message("hello");
+        assert_eq!(
+            ordinary.prompt.as_deref(),
+            Some("write a template like hello")
+        );
+        assert!(strip_unreferenced_parameters(ordinary).parameters.is_none());
+
+        // The value the user supplied is itself the text "{{ message }}", so rendering
+        // leaves it in the snapshot as data. Re-parsing the snapshot reports `message` as
+        // a template variable again, so the key survives where `hello` lost it.
+        let rendered = render_with_messa
```

**File**: `crates/goose/src/session/session_manager.rs` (modified, +60/-2)
```diff
@@ -4,6 +4,7 @@ use crate::conversation::message::{Message, MessageMetadata, MessageUsage, Token
 use crate::conversation::Conversation;
 use crate::providers::base::CostSource;
 use crate::providers::base::Provider;
+use crate::recipe::validate_recipe::strip_unreferenced_parameters;
 use crate::recipe::Recipe;
 use crate::session::export_markdown::export_session_to_markdown;
 use crate::session::extension_data::ExtensionData;
@@ -265,7 +266,7 @@ impl<'a> SessionUpdateBuilder<'a> {
     }
 
     pub fn recipe(mut self, recipe: Option<Recipe>) -> Self {
-        self.recipe = Some(recipe);
+        self.recipe = Some(recipe.map(strip_unreferenced_parameters));
         self
     }
 
@@ -1190,7 +1191,9 @@ impl SessionStorage {
         let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
 
         let recipe_json = match &session.recipe {
-            Some(recipe) => Some(serde_json::to_string(recipe)?),
+            Some(recipe) => Some(serde_json::to_string(&strip_unreferenced_parameters(
+                recipe.clone(),
+            ))?),
             None => None,
         };
 
@@ -3593,6 +3596,61 @@ mod tests {
         assert!(update.is_none());
     }
 
+    #[tokio::test]
+    async fn storing_a_rendered_recipe_strips_inert_parameters() {
+        use crate::recipe::{
+            RecipeParameter, RecipeParameterInputType, RecipeParameterRequirement,
+        };
+
+        let temp_dir = TempDir::new().unwrap();
+        let sm = SessionManager::new(temp_dir.path().to_path_buf());
+        let session = sm
+            .create_session(
+                temp_dir.path().to_path_buf(),
+                "Recipe snapshot".to_string(),
+                SessionType::User,
+                GooseMode::default(),
+            )
+            .await
+            .unwrap();
+
+        let rendered = Recipe::builder()
+            .title("snapshot")
+            .description("rendered")
+            .prompt("hello")
+            .parameters(vec![RecipeParameter {
+                key: "message".to_string(),
+                input_type: RecipeParameterInputType::String,
+                requirement: RecipeParameterRequirement::Required,
+                description: "message parameter".to_string(),
+                default: None,
+                options: None,
+            }])
+            .build()
+            .unwrap();
+
+        crate::recipe::validate_recipe::validate_recipe_template_from_content(
+            &rendered.to_yaml().unwrap(),
+            None,
+        )
+        .unwrap_err();
+
+        sm.update(&session.id)
+            .recipe(Some(rendered))
+            .apply()
+            .await
+            .unwrap();
+
+        let stored = sm.get_session(&session.id, false).await.unwrap();
+        let stored_recipe = stored.recipe.expect("recipe should be stored");
+        assert!(stored_recipe.parameters.is_none());
+        crate::recipe::validate_recipe::validate_recipe_template_from_content(
+            &stored_recipe.to_yaml().unwrap(),
+            None,
+        )
+        .unwrap();
+    }
+
     #[tokio::test]
     async fn test_maybe_update_name_preserves_scheduled_session() {
         let temp_dir = TempDir::new().unwrap();
```

---

### Incident Patch 5: `add40e76` (2026-09-29)
**Commit Message**: fix(agents): preserve session context across reply lifecycle (#12516)

Co-authored-by: Rohan Patnaik <rohan-patnaik@users.noreply.github.com>

**File**: `crates/goose/src/agents/agent.rs` (modified, +225/-7)
```diff
@@ -1773,6 +1773,24 @@ impl Agent {
         user_message: Message,
         session_config: SessionConfig,
         cancel_token: Option<CancellationToken>,
+    ) -> Result<BoxStream<'_, Result<AgentEvent>>> {
+        let session_id = session_config.id.clone();
+        let events = crate::session_context::with_session_id(
+            Some(session_id.clone()),
+            self.reply_with_state_machine_inner(user_message, session_config, cancel_token),
+        )
+        .await?;
+        Ok(crate::session_context::with_session_id_stream(
+            Some(session_id),
+            events,
+        ))
+    }
+
+    async fn reply_with_state_machine_inner(
+        &self,
+        user_message: Message,
+        session_config: SessionConfig,
+        cancel_token: Option<CancellationToken>,
     ) -> Result<BoxStream<'_, Result<AgentEvent>>> {
         let session_manager = self.config.session_manager.clone();
         let session_id = session_config.id.clone();
@@ -1836,6 +1854,21 @@ impl Agent {
         self: &Arc<Self>,
         session_config: SessionConfig,
         cancel: CancellationToken,
+    ) -> Result<Option<BoxStream<'static, Result<AgentEvent>>>> {
+        let session_id = session_config.id.clone();
+        let stream = crate::session_context::with_session_id(
+            Some(session_id.clone()),
+            self.resume_state_machine_turn_inner(session_config, cancel),
+        )
+        .await?;
+        Ok(stream
+            .map(|stream| crate::session_context::with_session_id_stream(Some(session_id), stream)))
+    }
+
+    async fn resume_state_machine_turn_inner(
+        self: &Arc<Self>,
+        session_config: SessionConfig,
+        cancel: CancellationToken,
     ) -> Result<Option<BoxStream<'static, Result<AgentEvent>>>> {
         if !super::state_machine::enabled() {
             return Ok(None);
@@ -1866,7 +1899,7 @@ impl Agent {
         }
 
         let agent = Arc::clone(self);
-        Ok(Some(Box::pin(async_stream::try_stream! {
+        let stream = Box::pin(async_stream::try_stream! {
             let initial_stream = if resume_from_persisted_response {
                 Some(
                     agent
@@ -1888,7 +1921,8 @@ impl Agent {
             while let Some(event) = stream.next().await {
                 yield event?;
             }
-        })))
+        });
+        Ok(Some(stream))
     }
 
     fn tool_confirmation_request_ids(event: &AgentEvent) -> Vec<String> {
@@ -2050,14 +2084,18 @@ impl Agent {
         cancel_token: Option<CancellationToken>,
     ) -> Result<BoxStream<'_, Result<AgentEvent>>> {
         let reply_span = tracing::Span::current();
-        let events = self
-            .reply_impl(
+        let session_id = session_config.id.clone();
+        let events = crate::session_context::with_session_id(
+            Some(session_id.clone()),
+            self.reply_impl(
                 user_message,
                 session_config,
                 use_state_machine,
                 cancel_token,
-            )
-            .await?;
+            ),
+        )
+        .await?;
+        let events = crate::session_context::with_session_id_stream(Some(session_id), events);
 
         // This is the single live-event identity boundary. Callers that intentionally stream
         // multiple events for one logical message must assign their shared ID before this point.
@@ -3930,7 +3968,9 @@ mod tests {
     use super::*;
     use crate::agents::gen_ai_telemetry::{self, test_support::SpanFieldCapture};
     use crate::plugins::discovery::{DiscoveredPlugin, PluginScope};
-    use crate::providers::base::{stream_from_single_message, MessageStream, PermissionRouting};
+    use crate::providers::base::{
+        stream_from_single_message, MessageStream, ModelInfo, PermissionRouting,
+    };
     use crate::recipe::Response;
     use crate::session::session_manager::SessionType;
     use goose_providers::conversation::token_usage::{ProviderUsage, Usage};
@@ -
```

**File**: `crates/goose/src/agents/state_machine/tests/agent_reply.rs` (modified, +8/-1)
```diff
@@ -33,7 +33,8 @@ async fn agent_with_dummy_api() -> Result<(Agent, Arc<DummyApi>, String, tempfil
         api.uri(),
         goose_providers::api_client::AuthMethod::NoAuth,
         None,
-    )?;
+    )?
+    .with_request_builder(crate::session_context::session_id_request_builder());
     let provider: Arc<dyn Provider> = Arc::new(
         goose_providers::openai::OpenAiProviderBuilder::new(api_client)
             .name("openai")
@@ -229,6 +230,12 @@ async fn state_machine_confirmation_through_agent_resumes_tool_call() -> Result<
         .contains(&confirmation_id.as_str())));
     assert_eq!(calculator.total(), 1);
     assert_eq!(api.call_count(), 2);
+    assert!(
+        api.calls()
+            .iter()
+            .all(|call| call.session_id() == Some(session_config.id.as_str())),
+        "initial and resumed provider requests must retain the session context"
+    );
 
     assert!(agent
         .submit_tool_confirmation(&session_config.id, &confirmation_id, Permission::AllowOnce)
```

**File**: `crates/goose/src/agents/state_machine/tests/dummy_api.rs` (modified, +14/-4)
```diff
@@ -135,13 +135,18 @@ impl ResponseGate {
 #[derive(Clone)]
 pub(super) struct ApiCall {
     body: Value,
+    session_id: Option<String>,
 }
 
 impl ApiCall {
     pub(super) fn input_tokens(&self) -> i32 {
         serialized_chars(&self.body)
     }
 
+    pub(super) fn session_id(&self) -> Option<&str> {
+        self.session_id.as_deref()
+    }
+
     pub(super) fn input_contains(&self, needle: &str) -> bool {
         request_input(&self.body).contains(needle)
     }
@@ -427,10 +432,15 @@ impl<'a> ConfiguredResponse<'a> {
 impl DummyApiState {
     fn respond(&self, request: &Request) -> ResponseTemplate {
         let body: Value = request.body_json().expect("OpenAI request body");
-        self.calls
-            .lock()
-            .unwrap()
-            .push(ApiCall { body: body.clone() });
+        let session_id = request
+            .headers
+            .get(crate::session_context::SESSION_ID_HEADER)
+            .and_then(|value| value.to_str().ok())
+            .map(str::to_string);
+        self.calls.lock().unwrap().push(ApiCall {
+            body: body.clone(),
+            session_id,
+        });
 
         let input_tokens = serialized_chars(&body);
         let model = body["model"].as_str().expect("OpenAI request model");
```

**File**: `crates/goose/src/session_context.rs` (modified, +34/-0)
```diff
@@ -1,3 +1,5 @@
+use futures::stream::BoxStream;
+use futures::StreamExt;
 use reqwest::header::{HeaderName, HeaderValue};
 
 pub const SESSION_ID_HEADER: &str = "agent-session-id";
@@ -16,6 +18,20 @@ where
     SESSION_ID.scope(session_id, f).await
 }
 
+pub fn with_session_id_stream<'a, T: Send + 'a>(
+    session_id: Option<String>,
+    stream: BoxStream<'a, T>,
+) -> BoxStream<'a, T> {
+    Box::pin(futures::stream::unfold(
+        (stream, session_id),
+        |(mut stream, session_id)| async move {
+            with_session_id(session_id.clone(), stream.next())
+                .await
+                .map(|item| (item, (stream, session_id)))
+        },
+    ))
+}
+
 pub fn current_session_id() -> Option<String> {
     SESSION_ID.try_with(|id| id.clone()).ok().flatten()
 }
@@ -140,6 +156,24 @@ mod tests {
         .await;
     }
 
+    #[tokio::test]
+    async fn test_session_id_scopes_each_stream_poll() {
+        let stream = futures::stream::iter([(), ()]).then(|()| async { current_session_id() });
+        let mut stream =
+            with_session_id_stream(Some("stream-session".to_string()), Box::pin(stream));
+
+        assert_eq!(
+            stream.next().await,
+            Some(Some("stream-session".to_string()))
+        );
+        assert_eq!(
+            stream.next().await,
+            Some(Some("stream-session".to_string()))
+        );
+        assert_eq!(stream.next().await, None);
+        assert_eq!(current_session_id(), None);
+    }
+
     #[tokio::test]
     async fn test_session_id_request_builder_uses_custom_header() {
         with_session_id(Some("test-session-123".to_string()), async {
```

---

### Incident Patch 6: `9d57bad4` (2026-09-29)
**Commit Message**: fix(bedrock): report max_tokens truncation and flush tool calls (#11872)

Signed-off-by: Abdellatif Anaflous <62770500+hktitof@users.noreply.github.com>

**File**: `crates/goose/src/providers/bedrock.rs` (modified, +239/-4)
```diff
@@ -706,6 +706,8 @@ struct StreamBlockState {
     reasoning_blocks: HashMap<i32, (String, String)>,
     /// content_block_index -> accumulated redacted (encrypted) reasoning bytes
     redacted_blocks: HashMap<i32, Vec<u8>>,
+    /// StopReason carried by the stream's MessageStop event, if seen
+    stop_reason: Option<bedrock::StopReason>,
 }
 
 /// Convert a single `ConverseStream` event into zero or more [`Message`]s
@@ -814,7 +816,10 @@ fn process_stream_event(
                             }),
                         Err(_) => Err(ErrorData::new(
                             ErrorCode::INVALID_PARAMS,
-                            format!("Could not parse tool arguments: {}", input_json),
+                            goose_providers::json::truncation_error_message(&input_json)
+                                .unwrap_or_else(|| {
+                                    format!("Could not parse tool arguments: {}", input_json)
+                                }),
                             None,
                         )),
                     }
@@ -826,19 +831,81 @@ fn process_stream_event(
                 );
             }
         }
+        bedrock::ConverseStreamOutput::MessageStop(ev) => {
+            state.stop_reason = Some(ev.stop_reason);
+        }
         bedrock::ConverseStreamOutput::Metadata(ev) => {
             if let Some(u) = ev.usage {
                 usage = Some(from_bedrock_usage(&u));
             }
         }
-        // MessageStart / MessageStop / unknown variants carry no content
-        // that needs forwarding.
+        // MessageStart / unknown variants carry no content that needs
+        // forwarding.
         _ => {}
     }
 
     (messages, usage)
 }
 
+/// Flush tool blocks left open when the stream ended without their
+/// ContentBlockStop. Their arguments are incomplete, so each becomes a failed
+/// tool request carrying guidance for the model, matching how the Anthropic
+/// provider reports truncated tool calls.
+fn flush_incomplete_tool_blocks(
+    state: &mut StreamBlockState,
+    truncated_by_limit: bool,
+    message_id: &str,
+) -> Vec<Message> {
+    let mut messages = Vec::new();
+    let mut indices: Vec<i32> = state.tool_blocks.keys().copied().collect();
+    indices.sort_unstable();
+    for index in indices {
+        if let Some((id, _name, input_json)) = state.tool_blocks.remove(&index) {
+            let guidance = if truncated_by_limit {
+                "The model's response was truncated because it reached the output token limit while generating this tool call. \
+                 Try increasing max_tokens for this provider or breaking the task into smaller steps."
+            } else {
+                "A tool call was not completed before the stream ended. \
+                 Try resending your message or breaking the task into smaller steps."
+            };
+            let snippet_len = input_json.chars().count();
+            let tail: String = input_json
+                .chars()
+                .rev()
+                .take(80)
+                .collect::<Vec<_>>()
+                .into_iter()
+                .rev()
+                .collect();
+            let message_text = format!(
+                "{guidance}\nReceived {snippet_len} characters of arguments; cut off at: …{tail}"
+            );
+            let error = ErrorData::new(ErrorCode::INVALID_PARAMS, message_text, None);
+            messages.push(
+                Message::assistant()
+                    .with_tool_request(id, Err(error))
+                    .with_id(message_id),
+            );
+        }
+    }
+    messages
+}
+
+/// Flag a turn the model cut off at the output token limit so consumers can
+/// warn and compact, matching formats::anthropic::response_to_streaming_message.
+fn output_token_limit_marker(
+    stop_reason: Option<&bedrock::StopReason>,
+    message_id: &str,
+) -> Option<Message> {
+    if stop_reason == Some(&bedrock::StopReason::MaxTokens) {
+    
```

---

### Incident Patch 7: `a1097dc6` (2026-09-29)
**Commit Message**: fix(cli): require a terminal for elicitation input (#12542)

**File**: `crates/goose-cli/src/session/elicitation.rs` (modified, +9/-0)
```diff
@@ -35,6 +35,15 @@ pub fn collect_elicitation_input(
     if cancel_token.is_cancelled() {
         return Ok(cancelled_input());
     }
+    // Piped stdin may already contain the next --text conversation turn.
+    // CLI elicitation has no separate answer channel for extension forms,
+    // so leave queued input to the session and require a terminal here.
+    if !io::stdin().is_terminal() {
+        return Err(io::Error::new(
+            io::ErrorKind::NotConnected,
+            "elicitation requires an interactive terminal",
+        ));
+    }
     let input = collect_elicitation_input_inner(message, schema, cancel_token)?;
     if cancel_token.is_cancelled() {
         return Ok(cancelled_input());
```

**File**: `crates/goose-cli/tests/support/elicitation_signals.rs` (modified, +72/-71)
```diff
@@ -64,18 +64,11 @@ fn own_descriptor(fd: libc::c_int) -> File {
     file
 }
 
-#[test_case(false, false, Some(false); "pipe sigint")]
-#[test_case(true, false, Some(false); "pty sigint")]
-#[test_case(false, true, Some(false); "pipe partial and earlier field")]
-#[test_case(true, true, Some(false); "pty partial and earlier field")]
-#[test_case(true, true, Some(true); "pty keyboard ctrl c")]
-#[test_case(false, false, None; "pipe completed lines")]
-#[test_case(true, false, None; "pty completed lines")]
-fn freeform_input_preserves_cancellation_and_ownership(
-    terminal: bool,
-    partial: bool,
-    keyboard: Option<bool>,
-) {
+#[test_case(false, Some(false); "pty sigint")]
+#[test_case(true, Some(false); "pty partial and earlier field")]
+#[test_case(true, Some(true); "pty keyboard ctrl c")]
+#[test_case(false, None; "pty completed lines")]
+fn freeform_input_preserves_cancellation_and_ownership(partial: bool, keyboard: Option<bool>) {
     let mut command = Command::new(std::env::current_exe().unwrap());
     command
         .args([
@@ -96,48 +89,34 @@ fn freeform_input_preserves_cancellation_and_ownership(
         .stdout(Stdio::piped())
         .stderr(Stdio::null());
 
-    let mut pipe_input = None;
-    let input = if terminal {
-        let mut master = -1;
-        let mut slave = -1;
-        // openpty initializes both descriptors; File takes ownership after success.
-        assert_eq!(
-            unsafe {
-                libc::openpty(
-                    &mut master,
-                    &mut slave,
-                    std::ptr::null_mut(),
-                    std::ptr::null_mut(),
-                    std::ptr::null_mut(),
-                )
-            },
-            0
-        );
-        let master = own_descriptor(master);
-        let slave = own_descriptor(slave);
-        command.stdin(Stdio::from(slave));
-        // Only async-signal-safe syscalls run between fork and exec.
+    let mut master = -1;
+    let mut slave = -1;
+    // openpty initializes both descriptors; File takes ownership after success.
+    assert_eq!(
         unsafe {
-            command.pre_exec(|| {
-                if libc::setsid() < 0 || libc::ioctl(0, libc::TIOCSCTTY as _, 0) < 0 {
-                    return Err(io::Error::last_os_error());
-                }
-                // Closing the test's PTY master must not kill the child during shutdown.
-                libc::signal(libc::SIGHUP, libc::SIG_IGN);
-                Ok(())
-            });
-        }
-        master
-    } else {
-        let mut descriptors = [-1; 2];
-        // Keep a read descriptor to observe when the child consumed the partial line.
-        assert_eq!(unsafe { libc::pipe(descriptors.as_mut_ptr()) }, 0);
-        let reader = own_descriptor(descriptors[0]);
-        let writer = own_descriptor(descriptors[1]);
-        command.stdin(Stdio::from(reader.try_clone().unwrap()));
-        pipe_input = Some(reader);
-        writer
-    };
+            libc::openpty(
+                &mut master,
+                &mut slave,
+                std::ptr::null_mut(),
+                std::ptr::null_mut(),
+                std::ptr::null_mut(),
+            )
+        },
+        0
+    );
+    let input = own_descriptor(master);
+    command.stdin(Stdio::from(own_descriptor(slave)));
+    // Only async-signal-safe syscalls run between fork and exec.
+    unsafe {
+        command.pre_exec(|| {
+            if libc::setsid() < 0 || libc::ioctl(0, libc::TIOCSCTTY as _, 0) < 0 {
+                return Err(io::Error::last_os_error());
+            }
+            // Closing the test's PTY master must not kill the child during shutdown.
+            libc::signal(libc::SIGHUP, libc::SIG_IGN);
+            Ok(())
+        });
+    }
 
     let mut child = ChildGuard(command.spawn().unwrap());
     // Close the PTY master before waiting for the child, including on assertion failure.
@@ -155,24 +134,6 @@ fn freeform_input_preserves_cancellation
```

---

### Incident Patch 8: `6d5eba9b` (2026-09-29)
**Commit Message**: fix: keep tool results consecutive when OpenAI-compatible tool images are emitted (#12233)

**File**: `crates/goose-provider-types/src/formats/openai.rs` (modified, +100/-5)
```diff
@@ -253,6 +253,10 @@ pub fn format_messages_with_options(
         });
 
         let mut output = Vec::new();
+        // Deferred to the end of the message so every tool result in a batch stays
+        // consecutive; a strict OpenAI-compatible API rejects a request where a
+        // synthetic user image message splits one assistant tool_calls batch.
+        let mut pending_image_messages = Vec::new();
         let mut content_array = Vec::new();
         let mut has_non_text_content = false;
         let mut reasoning_text = String::new();
@@ -355,7 +359,6 @@ pub fn format_messages_with_options(
                         Ok(result) => {
                             // Process all content, replacing images with placeholder text
                             let mut tool_content = Vec::new();
-                            let mut image_messages = Vec::new();
 
                             for content in result.content.iter() {
                                 match content {
@@ -365,7 +368,7 @@ pub fn format_messages_with_options(
                                             tool_content.push(ContentBlock::text("This tool result included an image that is uploaded in the next message."));
 
                                             // Create a separate image message
-                                            image_messages.push(json!({
+                                            pending_image_messages.push(json!({
                                                 "role": "user",
                                                 "content": [convert_image(&image.clone(), image_format)]
                                             }));
@@ -392,14 +395,11 @@ pub fn format_messages_with_options(
                                 .collect::<Vec<String>>()
                                 .join(" "));
 
-                            // First add the tool response with all content
                             output.push(json!({
                                 "role": "tool",
                                 "content": tool_response_content,
                                 "tool_call_id": response.id
                             }));
-                            // Then add any image messages that need to follow
-                            output.extend(image_messages);
                         }
                         Err(e) => {
                             // A tool result error is shown as output so the model can interpret the error message
@@ -450,6 +450,8 @@ pub fn format_messages_with_options(
             }
         }
 
+        output.append(&mut pending_image_messages);
+
         if !content_array.is_empty() {
             if has_non_text_content {
                 converted["content"] = json!(content_array);
@@ -2655,6 +2657,99 @@ mod tests {
         Ok(())
     }
 
+    #[test]
+    fn test_parallel_tool_responses_with_images_are_consecutive() {
+        // #11893: a synthetic user image message between the tool results of one
+        // tool_calls batch makes strict OpenAI-compatible APIs reject the request.
+        let messages = vec![
+            Message::assistant()
+                .with_tool_request("call_a", Ok(CallToolRequestParams::new("read_image")))
+                .with_tool_request("call_b", Ok(CallToolRequestParams::new("read_image"))),
+            Message::user()
+                .with_tool_response(
+                    "call_a",
+                    Ok(CallToolResult::success(vec![ContentBlock::image(
+                        "aW1hZ2VkYXRhYQ==",
+                        "image/png",
+                    )])),
+                )
+                .with_tool_response(
+                    "call_b",
+                    Ok(CallToolResult::success(vec![ContentBlock::image(
+                        "aW1hZ2VkYXRhYg==",
+                        "image/png",
+                    )])),
+                ),
+        ];
+
+        let spec = format_messages_with_options(
+            &messages,
+        
```

---

### Incident Patch 9: `0193ffc4` (2026-09-28)
**Commit Message**: fix: GDK tools with no args still advertise empty params input schema (#12527)

**File**: `crates/goose-provider-types/src/formats/databricks.rs` (modified, +30/-17)
```diff
@@ -349,27 +349,17 @@ pub fn format_tools(tools: &[Tool], _model_name: &str) -> anyhow::Result<Vec<Val
             return Err(anyhow!("Duplicate tool name: {}", tool.name));
         }
 
-        let has_properties = tool
-            .input_schema
-            .get("properties")
-            .and_then(|v| v.as_object())
-            .is_some_and(|p| !p.is_empty());
-
         // Databricks serving endpoints (including Gemini-backed ones) use the
         // OpenAI-compatible chat format, so tools always use "parameters" — not
-        // the Google-native "parametersJsonSchema" field.
-        let mut def = json!({
-            "name": tool.name,
-            "description": tool.description,
-        });
-        if has_properties {
-            def["parameters"] = json!(tool.input_schema);
-        }
-        let function_def = def;
-
+        // the Google-native "parametersJsonSchema" field. "parameters" is
+        // required even when a tool takes no arguments, so it is always sent.
         result.push(json!({
             "type": "function",
-            "function": function_def,
+            "function": {
+                "name": tool.name,
+                "description": tool.description,
+                "parameters": tool.input_schema,
+            },
         }));
     }
 
@@ -983,6 +973,29 @@ mod tests {
         Ok(())
     }
 
+    #[test]
+    fn test_format_tools_zero_arg_still_sends_parameters() -> anyhow::Result<()> {
+        let tool = Tool::new(
+            "list_sessions",
+            "A tool that takes no arguments",
+            object!({
+                "type": "object",
+                "properties": {}
+            }),
+        );
+
+        let spec = format_tools(std::slice::from_ref(&tool), "glm-5-3")?;
+
+        let function = &spec[0]["function"];
+        assert!(
+            function.get("parameters").is_some(),
+            "Databricks rejects a function object without `parameters`"
+        );
+        assert_eq!(function["parameters"]["type"], "object");
+
+        Ok(())
+    }
+
     #[test]
     fn test_format_tools_duplicate() -> anyhow::Result<()> {
         let tool1 = Tool::new(
```

---

### Incident Patch 10: `07396897` (2026-09-28)
**Commit Message**: fix(provider): passing thinking effort to ollama models (#12555)

**File**: `crates/goose-providers/src/ollama.rs` (modified, +181/-11)
```diff
@@ -11,13 +11,16 @@ use crate::formats::ollama::{create_request, response_to_streaming_message_ollam
 use crate::images::ImageFormat;
 use crate::model::ModelConfig;
 use crate::request_log::{start_log, LoggerHandleExt, RequestLogHandle};
+use crate::thinking::ThinkingEffort;
 use anyhow::{Error, Result};
 use async_stream::try_stream;
 use async_trait::async_trait;
 use futures::TryStreamExt;
 use reqwest::{Response, StatusCode};
 use rmcp::model::Tool;
 use serde_json::{json, Value};
+use std::collections::HashMap;
+use std::sync::Mutex;
 use std::time::Duration;
 use tokio::pin;
 use tokio_stream::StreamExt;
@@ -45,6 +48,7 @@ const OLLAMA_MAX_RETRIES: usize = 10;
 const OLLAMA_INITIAL_RETRY_INTERVAL_MS: u64 = 2000;
 const OLLAMA_BACKOFF_MULTIPLIER: f64 = 1.5;
 const OLLAMA_MAX_RETRY_INTERVAL_MS: u64 = 15_000;
+const SHOW_INFO_TIMEOUT: Duration = Duration::from_secs(5);
 
 /// Provider settings resolved from `config::Config` at construction time.
 ///
@@ -86,6 +90,8 @@ pub struct OllamaProvider {
     dynamic_models: Option<bool>,
     skip_canonical_filtering: bool,
     options: OllamaOptions,
+    #[serde(skip)]
+    thinking_support: Mutex<HashMap<String, bool>>,
 }
 
 pub struct OllamaProviderBuilder {
@@ -160,6 +166,7 @@ impl OllamaProviderBuilder {
             dynamic_models: self.dynamic_models,
             skip_canonical_filtering: self.skip_canonical_filtering,
             options: self.options,
+            thinking_support: Mutex::new(HashMap::new()),
         }
     }
 }
@@ -188,6 +195,61 @@ impl OllamaProvider {
             .await?
             .ok_or_else(|| ProviderError::RequestFailed("No models array in response".to_string()))
     }
+
+    async fn reasoning_effort(&self, model_config: &ModelConfig) -> Option<&'static str> {
+        let level = match model_config.thinking_effort()? {
+            ThinkingEffort::Off => return Some("none"),
+            ThinkingEffort::Low => "low",
+            ThinkingEffort::Medium => "medium",
+            ThinkingEffort::High | ThinkingEffort::Max => "high",
+        };
+        let supports_thinking = match self.supports_thinking(&model_config.model_name).await {
+            Some(supports_thinking) => supports_thinking,
+            None => model_config.is_reasoning_model(),
+        };
+        supports_thinking.then_some(level)
+    }
+
+    async fn supports_thinking(&self, model: &str) -> Option<bool> {
+        if let Some(cached) = self
+            .thinking_support
+            .lock()
+            .ok()
+            .and_then(|cache| cache.get(model).copied())
+        {
+            return Some(cached);
+        }
+
+        let supports_thinking =
+            tokio::time::timeout(SHOW_INFO_TIMEOUT, self.fetch_thinking_capability(model))
+                .await
+                .ok()
+                .flatten()?;
+        if let Ok(mut cache) = self.thinking_support.lock() {
+            cache.insert(model.to_string(), supports_thinking);
+        }
+        Some(supports_thinking)
+    }
+
+    async fn fetch_thinking_capability(&self, model: &str) -> Option<bool> {
+        let response = self
+            .api_client
+            .request("api/show")
+            .response_post(&json!({ "model": model }))
+            .await
+            .ok()?;
+        if !response.status().is_success() {
+            return None;
+        }
+
+        let json: Value = response.json().await.ok()?;
+        let capabilities = json.get("capabilities")?.as_array()?;
+        Some(
+            capabilities
+                .iter()
+                .any(|capability| capability.as_str() == Some("thinking")),
+        )
+    }
 }
 
 pub async fn fetch_ollama_model_names(
@@ -234,8 +296,17 @@ fn resolve_ollama_num_ctx(options: &OllamaOptions) -> Option<usize> {
     options.input_limit
 }
 
-fn apply_ollama_options(payload: &mut Value, options: &OllamaOptions, _model_config: &ModelConfig) {
+fn apply_ollama_options(
+    payload: &mut Value,
+    options: &OllamaOption
```

#### Recent Merged Pull Requests:
- **PR #12607** (closed): fix: show current session ID in /status (@Placidoe)
- **PR #12605** (2026-09-30): fix: session naming/"none" reasoning effort fails for gpt-6.1-sol (@jamadeo)
- **PR #12603** (2026-09-30): fix: reflect loading state of chats (@alexhancock)
- **PR #12594** (2026-09-30): detect vision support (@lifeizhou-ap)
- **PR #12585** (closed): fix(state-machine): preserve a final answer at the max-turns boundary (@dakjdakd)
- **PR #12584** (closed): fix(desktop): keep active chats mounted while opening Settings (@dakjdakd)
- **PR #12569** (2026-09-29): Run the GDK agent loop on wasm32 (@benthecarman)
- **PR #12565** (2026-09-30): chore(release): bump version to 1.53.0 (minor) (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
