# Forensic Learning Record (Deep Inspection): modelcontextprotocol/rust-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-rust-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/rust-sdk](https://github.com/modelcontextprotocol/rust-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:31:06.728Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/rust-sdk`
- **Description**: The official Rust SDK for the Model Context Protocol
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3964 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
            .is_some_and(|caps| c
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
        .unwrap_or_else(|err| err.to_compile_error()
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
            #[doc = include_str!("some/tes
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
            x.map(|x| quote! {So
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #1242** (2026-09-24): **Empty cacheScope on tools/list drops every tool**
  *Symptoms*: **Describe the bug**  Some hosted MCP servers send `cacheScope: ""` on `tools/list` and `resources/read` results. SEP-2549 only allows `"public"`, `"private"`, or omitting the field, so serde rejects the empty string. Because `ServerResult` is an untagged enum, that failure does not stay on `ListToolsResult`. The payload falls through to `CustomResult`, and the client ends up with no tools.  Negative `ttlMs` is already normalized. Empty `cacheScope` is not.  **To Reproduce**  Deserialize a valid `tools/list` result that includes an empty cache scope:  ```json {   "tools": [{ "name": "search", "inputSchema": { "type": "object" } }],   "ttlMs": 0,   "cacheScope": "" } ```  On current `main` this does not parse as `ListToolsResult`.  **Expected behavior**  Treat an exact empty `cacheScope` the same as an omitted field (`None`). Unknown values such as `"shared"` or `" "` should still fail.  **Additional context**  I hit this against a hosted server that emits `cacheScope: ""` on an otherwise valid `tools/list` body. The tools were present on the wire and disappeared after decode.

- **Issue #1209** (2026-08-31): **Calling Intialize with Procol version 2026-07-28 returns success**
  *Symptoms*: **Describe the bug** When calling MCP Initialize with protocol version "2026-07-28",  the MCP SDK  returns a successful response, but no MCP-Session-id.   **To Reproduce** Send following Initialize with curl or other tool:  ```json {"method":"initialize","params":{"protocolVersion":"2026-07-28","capabilities":{},"clientInfo":{"name":"inspector-client","version":"0.21.1"}},"jsonrpc":"2.0","id":0} ```  ```curl  curl -H "Content-type:application/json" -H "Accept: application/json,text/event-stream" -d '{"method":"initialize","params":{"protocolVersion":"2026-07-28","capabilities":{},"clientInfo":{"name":"inspector-client","version":"0.21.1"}},"jsonrpc":"2.0","id":0}' 127.0.0.1:6666/mcp ```   **Expected behavior** Initialize is not supported in the latest version of the protocol, so an error 404 should is expected.  **Additional context** Running against main and the counter example. 

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

### Incident Patch 1: `e02efbfc` (2026-09-27)
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
+
```

---

### Incident Patch 2: `22ef52a2` (2026-09-25)
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
+
```

---

### Incident Patch 3: `26f3b2ed` (2026-09-25)
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
+            ) => a_scheme == o_scheme && a_host
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

### Incident Patch 4: `6677eeed` (2026-09-24)
**Commit Message**: style: cargo fmt fixes on validate_standard_headers changes (#1275)

Signed-off-by: SIDDARTHA REDDY <75976672+SIDDARTHAREDDY8@users.noreply.github.com>

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
+        hea
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

### Incident Patch 5: `fbed4476` (2026-09-24)
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

### Incident Patch 6: `90516bf4` (2026-09-24)
**Commit Message**: fix(model): preserve explicit null structuredContent in CallToolResult (#1295)

The MCP 2026-07-28 spec allows `structuredContent` to be any JSON value,
including `null`. Deserializing `CallToolResult` collapsed a present
`"structuredContent": null` into `None`, the same as an absent field, and
rejected `{"resultType":"complete","structuredContent":null}` because no
known non-null field was left.

Decode a present `structuredContent` as `Some(value)`, so an explicit
`null` becomes `Some(Value::Null)` and counts as a known field. An absent
field still decodes as `None`, and serialization still omits only `None`.

Signed-off-by: Jean-Marc Le Roux <jeanmarc@lx.industries>

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

### Incident Patch 7: `71e30818` (2026-09-22)
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
+        methods.lock().await.as_
```

---

### Incident Patch 8: `16d2186b` (2026-09-22)
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

### Incident Patch 9: `0550e13c` (2026-09-15)
**Commit Message**: fix(rmcp): use ServerConfig in cancellation test (#1273)

**File**: `crates/rmcp/tests/test_cancelled_response.rs` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@ async fn reverse_cancellation(startup: &str, equal_ids: bool) -> anyhow::Result<
         return_error: false,
     };
     let mut server = IntoTransport::<RoleServer, _, _>::into_transport(server_transport);
-    let mut info = InitializeResult::default();
+    let mut info = ServerConfig::default();
     info.protocol_version = ProtocolVersion::V_2025_11_25;
     let client = if startup == "initialize" {
         let (client, handshake) = tokio::join!(handler.serve(client_transport), async {
```

---

### Incident Patch 10: `b037c0fa` (2026-09-14)
**Commit Message**: fix(rmcp): route peer cancellation by lifecycle (#1262)

* fix(rmcp): route peer cancellation by lifecycle

Cancel inbound legacy requests by their exact request ID. Preserve modern
subscription waiter cleanup using the peer lifecycle and outbound request kind.

Suppress cancelled handler results and errors during EOF draining without
dropping uncancelled responses during graceful shutdown.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

* test(rmcp): parameterize reverse cancellation cases

Use rstest to report each startup and request ID combination independently.
Keep the existing per-case timeout and cancellation assertions.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

* fix(rmcp): use canonical initialize result in cancellation test

Replace the stale ServerInfo reference after merging the upstream alias migration.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

---------

Co-authored-by: Hunter Sadler <aurokin@github.com>
Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `crates/rmcp/src/service.rs` (modified, +53/-20)
```diff
@@ -136,6 +136,14 @@ pub trait ServiceRole: std::fmt::Debug + Send + Sync + 'static + Copy + Clone {
     fn peer_cancelled_params(_notification: &Self::PeerNot) -> Option<&CancelledNotificationParam> {
         None
     }
+    #[doc(hidden)]
+    fn peer_cancels_subscriptions(_peer: &Peer<Self>) -> bool {
+        false
+    }
+    #[doc(hidden)]
+    fn is_subscription_request(_request: &Self::Req) -> bool {
+        false
+    }
     /// Invalidate any response cache affected by an inbound peer notification.
     ///
     /// The serve loop calls this for every notification *before* subscription
@@ -522,6 +530,10 @@ impl ProgressNotificationToken for ServerNotification {
 }
 
 type Responder<T> = tokio::sync::oneshot::Sender<T>;
+struct PendingResponse<T> {
+    responder: Responder<T>,
+    is_subscription: bool,
+}
 type ProgressTimeoutWatchers = Arc<tokio::sync::RwLock<HashMap<ProgressToken, mpsc::Sender<()>>>>;
 type SubscriptionChannel<N> = (mpsc::Sender<N>, usize);
 type SubscriptionChannelMap<N> = HashMap<RequestId, SubscriptionChannel<N>>;
@@ -1362,7 +1374,7 @@ where
     }
 
     let mut local_responder_pool =
-        HashMap::<RequestId, Responder<Result<R::PeerResp, ServiceError>>>::new();
+        HashMap::<RequestId, PendingResponse<Result<R::PeerResp, ServiceError>>>::new();
     let mut local_ct_pool = HashMap::<RequestId, CancellationToken>::new();
     let shared_service = Arc::new(service);
     // for return
@@ -1459,7 +1471,7 @@ where
                 Event::SendTaskResult(SendTaskResult::Request { id, result }) => {
                     if let Err(e) = result
                         && let Some(responder) = local_responder_pool.remove(&id) {
-                            let _ = responder.send(Err(ServiceError::TransportSend(e)));
+                            let _ = responder.responder.send(Err(ServiceError::TransportSend(e)));
                         }
                 }
                 Event::SendTaskResult(SendTaskResult::Notification {
@@ -1477,7 +1489,7 @@ where
                         && let Some(request_id) = &param.request_id
                             && let Some(responder) = local_responder_pool.remove(request_id) {
                                 tracing::info!(id = %request_id, reason = param.reason, "cancelled");
-                                let _response_result = responder.send(Err(ServiceError::Cancelled {
+                                let _response_result = responder.responder.send(Err(ServiceError::Cancelled {
                                     reason: param.reason.clone(),
                                 }));
                             }
@@ -1514,7 +1526,10 @@ where
                     id,
                     responder,
                 }) => {
-                    local_responder_pool.insert(id.clone(), responder);
+                    local_responder_pool.insert(id.clone(), PendingResponse {
+                        responder,
+                        is_subscription: R::is_subscription_request(&request),
+                    });
                     let send = transport.send(JsonRpcMessage::request(request, id.clone()));
                     {
                         let id = id.clone();
@@ -1615,31 +1630,38 @@ where
                 })) => {
                     tracing::info!(?notification, "received notification");
                     R::invalidate_response_cache(&peer, &notification).await;
-                    let cancellation_request_id =
+                    let subscription_id =
                         if let Some(cancelled) = R::peer_cancelled_params(&notification) {
                             let request_id = cancelled.request_id.clone();
-                            if let Some(request_id) = request_id.as_ref() {
-                                if R::IS_CLIENT {
-                                    if let Some(responder) =
-                                        local_responder_pool.remove(request_id)
+                            // Modern se
```

**File**: `crates/rmcp/src/service/client.rs` (modified, +240/-0)
```diff
@@ -292,6 +292,20 @@ impl ServiceRole for RoleClient {
         }
     }
 
+    fn peer_cancels_subscriptions(peer: &Peer<Self>) -> bool {
+        // Discovery keeps modern lifecycle semantics even with an older application version.
+        !super::uses_legacy_lifecycle(
+            peer.peer_info()
+                .as_deref()
+                .map(|info| &info.protocol_version),
+            peer.client_request_metadata.get().is_some(),
+        )
+    }
+
+    fn is_subscription_request(request: &Self::Req) -> bool {
+        matches!(request, ClientRequest::SubscriptionsListenRequest(_))
+    }
+
     // SEP-2260: reject restricted server requests that arrived unassociated
     // with any in-flight outbound request. Without stream separation
     // (`Unknown`) the coarse in-flight check under-approximates the SHOULD.
@@ -2200,6 +2214,232 @@ where
 mod tests {
     use super::*;
 
+    #[tokio::test]
+    async fn server_cancellation_retires_subscription_responder() {
+        tokio::task::LocalSet::new()
+            .run_until(async {
+                for (discover, version) in [
+                    (false, ProtocolVersion::V_2026_07_28),
+                    (true, ProtocolVersion::V_2026_07_28),
+                    (true, ProtocolVersion::V_2025_11_25),
+                ] {
+                    tokio::time::timeout(
+                        Duration::from_secs(5),
+                        check_subscription_cancellation(discover, version),
+                    )
+                    .await
+                    .expect("subscription cancellation timed out");
+                }
+            })
+            .await;
+    }
+
+    async fn check_subscription_cancellation(discover: bool, version: ProtocolVersion) {
+        use crate::model::{
+            GetMeta, PingRequest, ServerInfo, SubscriptionsAcknowledgedNotification,
+            SubscriptionsAcknowledgedNotificationParams,
+        };
+
+        let (server_transport, client_transport) = tokio::io::duplex(4096);
+        let mut server =
+            crate::transport::IntoTransport::<RoleServer, _, _>::into_transport(server_transport);
+        let info = ServerInfo {
+            protocol_version: version.clone(),
+            ..Default::default()
+        };
+        let client = if discover {
+            let (client, ()) = tokio::join!(
+                serve_client_with_lifecycle(
+                    (),
+                    client_transport,
+                    ClientLifecycleMode::Discover {
+                        preferred_versions: vec![version.clone()]
+                    }
+                ),
+                async {
+                    let Some(ClientJsonRpcMessage::Request(request)) = server.receive().await
+                    else {
+                        panic!("expected discover request");
+                    };
+                    assert!(matches!(request.request, ClientRequest::DiscoverRequest(_)));
+                    server
+                        .send(ServerJsonRpcMessage::response(
+                            ServerResult::DiscoverResult(DiscoverResult::new(
+                                vec![version],
+                                info.capabilities,
+                            )),
+                            request.id,
+                        ))
+                        .await
+                        .unwrap();
+                }
+            );
+            client.unwrap()
+        } else {
+            super::super::serve_directly::<RoleClient, _, _, _, _>(
+                (),
+                client_transport,
+                Some(info.into()),
+            )
+        };
+        let filter = SubscriptionFilter::default();
+        let (subscription, ()) = tokio::join!(client.listen(filter.clone()), async {
+            let Some(ClientJsonRpcMessage::Request(request)) = server.receive().await else {
+                panic!("expected listen request");
+            };
+            assert!(matches!(
+      
```

**File**: `crates/rmcp/tests/test_cancelled_response.rs` (modified, +433/-12)
```diff
@@ -3,8 +3,22 @@
 //! until the request is cancelled, so its result is only produced *after* the
 //! cancellation — the service loop must drop it rather than write it to the wire.
 
+#[cfg(all(feature = "client", not(feature = "local")))]
+use std::sync::Arc;
 use std::{collections::BTreeSet, process::Stdio, time::Duration};
 
+#[cfg(all(feature = "client", not(feature = "local")))]
+use rmcp::{
+    ClientHandler, RoleClient,
+    model::{
+        CancelledNotification, CancelledNotificationParam, ClientJsonRpcMessage, ClientRequest,
+        ClientResult, ElicitRequest, ElicitRequestParams, ElicitResult, ElicitationAction,
+        ElicitationSchema, PingRequest, RequestId, ServerJsonRpcMessage, ServerNotification,
+        ServerRequest, ServerResult,
+    },
+    service::{PeerRequestOptions, QuitReason, serve_directly},
+    transport::{IntoTransport, Transport},
+};
 use rmcp::{
     ErrorData as McpError, RoleServer, ServerHandler, ServiceExt,
     model::{
@@ -21,6 +35,7 @@ use tokio::{
 
 const HELPER_ENV: &str = "RMCP_CANCELLED_RESPONSE_HELPER";
 const READ_TIMEOUT: Duration = Duration::from_secs(10);
+const STRING_REQUEST_ID: &str = "tool-request-2";
 
 #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
 async fn cancelled_request_receives_no_response() -> anyhow::Result<()> {
@@ -43,7 +58,7 @@ async fn cancelled_request_receives_no_response() -> anyhow::Result<()> {
         }),
     )
     .await?;
-    collect_ids_until(&mut reader, 1, READ_TIMEOUT).await?;
+    collect_ids_until(&mut reader, "1", READ_TIMEOUT).await?;
     send_json(
         &mut writer,
         &json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
@@ -56,7 +71,7 @@ async fn cancelled_request_receives_no_response() -> anyhow::Result<()> {
         &mut writer,
         &json!({
             "jsonrpc": "2.0",
-            "id": 2,
+            "id": STRING_REQUEST_ID,
             "method": "tools/call",
             "params": { "name": "wait-for-cancel", "arguments": {} }
         }),
@@ -67,21 +82,59 @@ async fn cancelled_request_receives_no_response() -> anyhow::Result<()> {
         &json!({
             "jsonrpc": "2.0",
             "method": "notifications/cancelled",
-            "params": { "requestId": 2 }
+            "params": { "requestId": "unrelated-request" }
+        }),
+    )
+    .await?;
+    send_json(
+        &mut writer,
+        &json!({
+            "jsonrpc": "2.0",
+            "method": "notifications/cancelled",
+            "params": { "requestId": STRING_REQUEST_ID }
         }),
     )
     .await?;
     // A ping proves the server is alive past the cancellation, so the absence of
-    // an id=2 response is genuine suppression rather than a dead connection.
+    // a cancelled response is genuine suppression rather than a dead connection.
     send_json(
         &mut writer,
         &json!({ "jsonrpc": "2.0", "id": 3, "method": "ping" }),
     )
     .await?;
 
-    let seen = collect_ids_until(&mut reader, 3, READ_TIMEOUT).await?;
-    assert!(seen.contains(&3));
-    assert!(!seen.contains(&2));
+    let seen = collect_ids_until(&mut reader, "3", READ_TIMEOUT).await?;
+    assert!(seen.contains("3"));
+    assert!(!seen.contains(STRING_REQUEST_ID));
+
+    send_json(
+        &mut writer,
+        &json!({
+            "jsonrpc": "2.0",
+            "id": 4,
+            "method": "tools/call",
+            "params": { "name": "complete-unless-cancelled", "arguments": {} }
+        }),
+    )
+    .await?;
+    send_json(
+        &mut writer,
+        &json!({
+            "jsonrpc": "2.0",
+            "method": "notifications/cancelled",
+            "params": { "requestId": "4" }
+        }),
+    )
+    .await?;
+    send_json(
+        &mut writer,
+        &json!({ "jsonrpc": "2.0", "id": 5, "method": "ping" }),
+    )
+    .await?;
+
+    let seen = collect_ids_until(&mut reader, "5", READ_TIMEOUT).await?;
+    assert!(seen.contains("4"), "string and numeric IDs must not a
```

#### Recent Merged Pull Requests:
- **PR #1311** (closed): fix(transport): bound non-streaming HTTP response bodies (@soba334)
- **PR #1306** (2026-09-28): ci: reject multi-line Codex auth secret (@DaleSeo)
- **PR #1300** (2026-09-27): fix(model): decode float fields through serde_json::Number (@jmrplens)
- **PR #1297** (2026-09-25): chore(deps): bump the github-actions group with 2 updates (@dependabot[bot])
- **PR #1296** (2026-09-28): chore: release v3.5.0 (@github-actions[bot])
- **PR #1295** (2026-09-24): fix(model): preserve explicit null structuredContent in CallToolResult (@JMLX42)
- **PR #1294** (2026-09-23): chore: release v3.4.1 (@github-actions[bot])
- **PR #1293** (2026-09-25): chore: reduce dependency update noise with monthly grouping (@DaleSeo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
