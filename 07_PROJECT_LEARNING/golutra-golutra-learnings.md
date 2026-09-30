# Forensic Learning Record (Deep Inspection): golutra/golutra

> **Canonical Artifact**: `07_PROJECT_LEARNING/golutra-golutra-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/golutra/golutra](https://github.com/golutra/golutra))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:37:43.452Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `golutra/golutra`
- **Description**: Multi-agent AI orchestration platform for automation, workflows, and developer tools. Golutra transforms Codex, Claude Code, and OpenClaw into a unified agent system with parallel execution, task orchestration, long-running workflows, and AI productivity workspace.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3852 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.js`
```
import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import vueParser from 'vue-eslint-parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules', 'dist', 'coverage']
  },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error'
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parser: tsParser
      },
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'vue/component-name-in-template-casing': ['error', 'PascalCase', { registeredComponentsOnly: false }],
      'vue/multi-word-component-names': ['error', { ignores: ['App', 'Settings'] }],
      'vue/attributes-order': 'off'
    }
  },
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  prettier
];

```

### Core Architecture Module: `src-tauri/src/application/chat.rs`
```
//! 聊天应用层：统一 UI 与 CLI 的业务入口，避免重复规则。

use tauri::{AppHandle, State};

use crate::contracts::chat_dispatch::ChatDispatchPayload;
use crate::message_service::chat_db::{
  self, chat_outbox_enqueue, chat_send_message_for_dispatch, ChatClearResult,
  ChatDeleteMemberConversationsResult, ChatDbManager, ChatHomeFeedDto, ChatRepairResult,
  ConversationSummaryDto, MessageAttachment, MessageContent, MessageDto,
};

pub(crate) fn chat_ulid_new() -> Result<String, String> {
  chat_db::chat_ulid_new()
}

pub(crate) fn chat_repair_messages(
  state: State<'_, ChatDbManager>,
  workspace_id: String,
) -> Result<ChatRepairResult, String> {
  chat_db::chat_repair_messages(state, workspace_id)
}

pub(crate) fn chat_clear_all_messages(
  state: State<'_, ChatDbManager>,
  workspace_id: String,
) -> Result<ChatClearResult, String> {
  chat_db::chat_clear_all_messages(state, workspace_id)
}

pub(crate) fn chat_list_conversations(
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  user_id: String,
  workspace_name: Option<String>,
  member_ids: Vec<String>,
) -> Result<ChatHomeFeedDto, String> {
  chat_db::chat_list_conversations(state, workspace_id, user_id, workspace_name, member_ids)
}

pub(crate) fn chat_get_messages(
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  conversation_id: String,
  limit: Option<u32>,
  before_id: Option<String>,
) -> Result<Vec<MessageDto>, String> {
  chat_db::chat_get_messages(state, workspace_id, conversation_id, limit, before_id)
}

pub(crate) fn chat_mark_conversation_read_latest(
  app: AppHandle,
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  user_id: String,
  conversation_id: String,
) -> Result<(), String> {
  chat_db::chat_mark_conversation_read_latest(app, state, workspace_id, user_id, conversation_id)
}

pub(crate) fn chat_send_message(
  app: AppHandle,
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  conversation_id: String,
  sender_id: Option<String>,
  viewer_id: Option<String>,
  content: MessageContent,
  is_ai: Option<bool>,
  attachment: Option<MessageAttachment>,
) -> Result<MessageDto, String> {
  chat_db::chat_send_message(
    app,
    state,
    workspace_id,
    conversation_id,
    sender_id,
    viewer_id,
    content,
    is_ai,
    attachment,
  )
}

pub(crate) fn chat_send_message_and_enqueue(
  app: AppHandle,
  state: State<'_, ChatDbManager>,
  mut payload: ChatDispatchPayload,
) -> Result<MessageDto, String> {
  let message = chat_send_message_for_dispatch(
    app,
    state.clone(),
    payload.workspace_id.clone(),
    payload.conversation_id.clone(),
    Some(payload.sender_id.clone()),
    Some(payload.sender_id.clone()),
    MessageContent::Text {
      text: payload.text.clone(),
    },
    Some(false),
    None,
  )?;
  let workspace_id = payload.workspace_id.clone();
  payload.message_id = Some(message.id.clone());
  chat_outbox_enqueue(state.inner(), workspace_id.as_str(), &message.id, payload)?;
  Ok(message)
}

pub(crate) fn chat_create_group(
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  user_id: String,
  member_ids: Vec<String>,
  custom_name: Option<String>,
) -> Result<ConversationSummaryDto, String> {
  chat_db::chat_create_group(state, workspace_id, user_id, member_ids, custom_name)
}

pub(crate) fn chat_ensure_direct(
  app: AppHandle,
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  user_id: String,
  target_id: String,
) -> Result<ConversationSummaryDto, String> {
  chat_db::chat_ensure_direct(app, state, workspace_id, user_id, target_id)
}

pub(crate) fn chat_set_conversation_settings(
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  user_id: String,
  conversation_id: String,
  pinned: Option<bool>,
  muted: Option<bool>,
) -> Result<(), String> {
  chat_db::chat_set_conversation_settings(
    state,
    workspace_id,
    user_id,
    conversation_id,
    pinned,
    muted,
  )
}

pub(crate) fn chat_rename_conversation(
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  conversation_id: String,
  custom_name: Option<String>,
) -> Result<(), String> {
  chat_db::chat_rename_conversation(state, workspace_id, conversation_id, custom_name)
}

pub(crate) fn chat_clear_conversation(
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  conversation_id: String,
) -> Result<(), String> {
  chat_db::chat_clear_conversation(state, workspace_id, conversation_id)
}

pub(crate) fn chat_delete_conversation(
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  conversation_id: String,
) -> Result<(), String> {
  chat_db::chat_delete_conversation(state, workspace_id, conversation_id)
}

pub(crate) fn chat_delete_member_conversations(
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  member_ids: Vec<String>,
) -> Result<ChatDeleteMemberConversationsResult, String> {
  chat_db::chat_delete_member_conversations(state, workspace_id, member_ids)
}

pub(crate) fn chat_set_conversation_members(
  app: AppHandle,
  state: State<'_, ChatDbManager>,
  workspace_id: String,
  conversation_id: String,
  member_ids: Vec<String>,
) -> Result<(), String> {
  chat_db::chat_set_conversation_members(app, state, workspace_id, conversation_id, member_ids)
}

```

### Core Architecture Module: `src-tauri/src/application/command.rs`
```
//! 终端命令解析与执行：供外部命令与 UI 复用。

use std::collections::VecDeque;

use serde_json::json;
use tauri::{AppHandle, State};

use crate::application::chat as chat_app;
use crate::message_service::chat_db::{ChatDbManager, MessageContent};
use crate::runtime::command_center::CommandResultPayload;

const WORKSPACE_ENV_KEY: &str = "GOLUTRA_WORKSPACE_ID";

pub(crate) enum TerminalCommand {
  SendMessage {
    workspace_id: String,
    conversation_id: String,
    sender_id: String,
    text: String,
    is_ai: bool,
  },
  SendDirect {
    workspace_id: String,
    sender_id: String,
    target_id: String,
    text: String,
    is_ai: bool,
  },
}

pub(crate) fn parse_terminal_command(args: &[String]) -> Result<TerminalCommand, String> {
  let mut tokens: VecDeque<String> = args.iter().cloned().collect();
  if tokens.is_empty() {
    return Err("command is empty".to_string());
  }
  let mut workspace_id = None;
  let mut is_ai = false;
  let mut stripped = VecDeque::new();
  while let Some(token) = tokens.pop_front() {
    match token.as_str() {
      "--workspace" => {
        let value = tokens
          .pop_front()
          .ok_or_else(|| "missing value for --workspace".to_string())?;
        workspace_id = Some(value);
      }
      "--ai" => {
        is_ai = true;
      }
      _ => stripped.push_back(token),
    }
  }
  let workspace_id = workspace_id
    .or_else(|| std::env::var(WORKSPACE_ENV_KEY).ok())
    .ok_or_else(|| "workspace_id is required".to_string())?;

  if let Some(index) = stripped.iter().position(|token| token == "->") {
    return parse_arrow_command(&workspace_id, is_ai, stripped, index);
  }
  parse_send_command(&workspace_id, is_ai, stripped)
}

pub(crate) fn execute_terminal_command(
  app: AppHandle,
  state: State<'_, ChatDbManager>,
  command: TerminalCommand,
) -> Result<CommandResultPayload, String> {
  match command {
    TerminalCommand::SendMessage {
      workspace_id,
      conversation_id,
      sender_id,
      text,
      is_ai,
    } => {
      let message = chat_app::chat_send_message(
        app,
        state,
        workspace_id.clone(),
        conversation_id.clone(),
        Some(sender_id.clone()),
        None,
        MessageContent::Text { text },
        Some(is_ai),
        None,
      )?;
      Ok(CommandResultPayload {
        status: "ok".to_string(),
        message: Some("message sent".to_string()),
        data: Some(json!({
          "workspaceId": workspace_id,
          "conversationId": conversation_id,
          "messageId": message.id,
          "senderId": sender_id
        })),
      })
    }
    TerminalCommand::SendDirect {
      workspace_id,
      sender_id,
      target_id,
      text,
      is_ai,
    } => {
      let conversation = chat_app::chat_ensure_direct(
        app.clone(),
        state.clone(),
        workspace_id.clone(),
        sender_id.clone(),
        target_id.clone(),
      )?;
      let message = chat_app::chat_send_message(
        app,
        state,
        workspace_id.clone(),
        conversation.id.clone(),
        Some(sender_id.clone()),
        None,
        MessageContent::Text { text },
        Some(is_ai),
        None,
      )?;
      Ok(CommandResultPayload {
        status: "ok".to_string(),
        message: Some("message sent".to_string()),
        data: Some(json!({
          "workspaceId": workspace_id,
          "conversationId": conversation.id,
          "messageId": message.id,
          "senderId": sender_id,
          "targetId": target_id
        })),
      })
    }
  }
}

fn parse_send_command(
  workspace_id: &str,
  is_ai: bool,
  mut tokens: VecDeque<String>,
) -> Result<TerminalCommand, String> {
  if tokens.front().map(|value| value.as_str()) == Some("send") {
    tokens.pop_front();
  }
  let mut conversation_id = None;
  let mut sender_id = None;
  let mut target_id = None;
  let mut text_tokens = Vec::new();
  let mut iter = tokens.into_iter().peekable();
  while let Some(token) = iter.next() {
    match token.as_str() {
      "--conversation" | "--channel" => {
        let value = iter
          .next()
          .ok_or_else(|| "missing value for --conversation".to_string())?;
        conversation_id = Some(value);
      }
      "--sender" | "--from" => {
        let value = iter
          .next()
          .ok_or_else(|| "missing value for --sender".to_string())?;
        sender_id = Some(value);
      }
      "--to" | "--target" => {
        let value = iter
          .next()
          .ok_or_else(|| "missing value for --to".to_string())?;
        target_id = Some(value);
      }
      "--text" => {
        text_tokens.extend(iter.map(|value| value));
        break;
      }
      _ => text_tokens.push(token),
    }
  }
  let text = text_tokens.join(" ").trim().to_string();
  if text.is_empty() {
    return Err("message text is required".to_string());
  }
  let sender_id = sender_id.ok_or_else(|| "sender id is required".to_string())?;
  if let Some(conversation_id) = conversation_id {
    return Ok(TerminalCommand::SendMessage {
      workspace_id: workspace_id.to_string(),
      conversation_id,
      sender_id,
      text,
      is_ai,
    });
  }
  let target_id = target_id.ok_or_else(|| "target id is required".to_string())?;
  Ok(TerminalCommand::SendDirect {
    workspace_id: workspace_id.to_string(),
    sender_id,
    target_id,
    text,
    is_ai,
  })
}

fn parse_arrow_command(
  workspace_id: &str,
  is_ai: bool,
  tokens: VecDeque<String>,
  arrow_index: usize,
) -> Result<TerminalCommand, String> {
  let list: Vec<String> = tokens.into_iter().collect();
  if arrow_index == 0 || arrow_index + 1 >= list.len() {
    return Err("arrow command requires sender and target".to_string());
  }
  let sender_id = list[arrow_index - 1].to_string();
  let target_id = list[arrow_index + 1].to_string();
  let mut channel_index = None;
  for (index, token) in list.iter().enumerate().skip(arrow_index + 2) {
    if token.starts_with('#') {
      channel_index = Some(index);
      break;
    }
  }
  let (conversation_id, message_start) = match channel_index {
    Some(index) => (Some(list[index].trim_start_matches('#').to_string()), index + 1),
    None => (None, arrow_index + 2),
  };
  let text = list
    .iter()
    .skip(message_start)
    .cloned()
    .collect::<Vec<String>>()
    .join(" ")
    .trim()
    .to_string();
  if text.is_empty() {
    return Err("message text is required".to_string());
  }
  if let Some(conversation_id) = conversation_id {
    return Ok(TerminalCommand::SendMessage {
      workspace_id: workspace_id.to_string(),
      conversation_id,
      sender_id,
      text,
      is_ai,
    });
  }
  Ok(TerminalCommand::SendDirect {
    workspace_id: workspace_id.to_string(),
    sender_id,
    target_id,
    text,
    is_ai,
  })
}

```

### Core Architecture Module: `src-tauri/src/application/mod.rs`
```
//! 应用层：承载跨入口复用的业务用例，避免 UI/CLI 分叉。

pub(crate) mod chat;
pub(crate) mod command;
pub(crate) mod project;

```

### Core Architecture Module: `src-tauri/src/application/project.rs`
```
//! 项目成员用例：统一成员创建与命名规则，供 UI/CLI 复用。

use std::{
    collections::HashMap,
    fs,
    path::Path,
    sync::{Arc, Mutex, OnceLock},
};

use fs2::FileExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::message_service::project_members::{ProjectMemberPurgeResult, ProjectMemberStore};
use crate::runtime::{storage, StorageManager};

const WORKSPACE_REGISTRY_FILE: &str = "workspace-registry.json";
const WORKSPACE_REGISTRY_LOCK_FILE: &str = "workspace-registry.lock";
const DEFAULT_WORKSPACE_NAME: &str = "workspace";
const WORKSPACE_CONTEXT_MISSING_MESSAGE: &str = "请先打开工作区";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectInviteMembersRequest {
    pub(crate) role_type: String,
    pub(crate) command: Option<String>,
    pub(crate) terminal_type: Option<String>,
    pub(crate) instance_count: u32,
    pub(crate) unlimited_access: bool,
    pub(crate) sandboxed: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectPurgeTerminalMembersRequest {
    pub(crate) scope: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectInviteMembersResult {
    pub(crate) members: Vec<Value>,
    pub(crate) created_members: Vec<Value>,
    pub(crate) storage: String,
    pub(crate) warning: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectPurgeTerminalMembersResult {
    pub(crate) scope: String,
    pub(crate) total_removed: u32,
    pub(crate) workspace_count: u32,
    pub(crate) warnings: Vec<String>,
}

pub(crate) struct ProjectPurgeTerminalMembersOutcome {
    pub(crate) result: ProjectPurgeTerminalMembersResult,
    pub(crate) removed_workspaces: Vec<ProjectPurgeRemovedWorkspace>,
}

pub(crate) struct ProjectPurgeRemovedWorkspace {
    pub(crate) workspace_id: String,
    pub(crate) removed_member_ids: Vec<String>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorkspaceRegistryEntry {
    #[serde(rename = "lastKnownPath")]
    last_known_path: String,
}

struct WorkspaceContext {
    workspace_path: String,
    workspace_name: String,
}

// 以工作区为粒度串行化成员创建，避免并发重名与写入竞态。
static WORKSPACE_MEMBER_LOCKS: OnceLock<Mutex<HashMap<String, Arc<Mutex<()>>>>> = OnceLock::new();

pub(crate) fn project_invite_members(
    storage: &StorageManager,
    workspace_id: &str,
    request: ProjectInviteMembersRequest,
) -> Result<ProjectInviteMembersResult, String> {
    let workspace_id = workspace_id.trim();
    if workspace_id.is_empty() {
        return Err("workspace id is empty".to_string());
    }
    let context = resolve_workspace_context(storage, workspace_id)?;
    with_workspace_member_lock(workspace_id, || {
        let identity = resolve_terminal_identity(&request)?;
        let store = ProjectMemberStore::new(storage);
        let result = store.invite_members(
            workspace_id,
            &context.workspace_path,
            &context.workspace_name,
            &request.role_type,
            identity.label.as_str(),
            identity.terminal_type.as_deref(),
            identity.command.as_deref(),
            request.instance_count,
            request.unlimited_access,
            request.sandboxed,
        )?;

        Ok(ProjectInviteMembersResult {
            members: result.members,
            created_members: result.created_members,
            storage: result.storage,
            warning: result.warning,
        })
    })
}

pub(crate) fn project_purge_terminal_members(
    storage: &StorageManager,
    workspace_id: &str,
    request: ProjectPurgeTerminalMembersRequest,
) -> Result<ProjectPurgeTerminalMembersOutcome, String> {
    let scope = request.scope.trim().to_lowercase();
    if scope != "current" && scope != "all" {
        return Err("unsupported purge scope".to_string());
    }
    if scope == "current" {
        let context = resolve_workspace_context(storage, workspace_id)?;
        let store = ProjectMemberStore::new(storage);
        let result = with_workspace_member_lock(workspace_id, || {
            store.purge_terminal_members(workspace_id, &context.workspace_path)
        })?;
        let ProjectMemberPurgeResult {
            removed_count,
            removed_member_ids,
            warning,
        } = result;
        let removed_workspaces = if removed_member_ids.is_empty() {
            Vec::new()
        } else {
            vec![ProjectPurgeRemovedWorkspace {
                workspace_id: workspace_id.to_string(),
                removed_member_ids,
            }]
        };
        return Ok(ProjectPurgeTerminalMembersOutcome {
            result: ProjectPurgeTerminalMembersResult {
                scope,
                total_removed: removed_count as u32,
                workspace_count: 1,
                warnings: warning.into_iter().collect(),
            },
            removed_workspaces,
        });
    }

    let registry = read_workspace_registry_locked(storage)?;
    let registry = registry.ok_or_else(|| WORKSPACE_CONTEXT_MISSING_MESSAGE.to_string())?;
    let entries: HashMap<String, WorkspaceRegistryEntry> =
        serde_json::from_value(registry).map_err(|err| format!("workspace registry decode failed: {err}"))?;
    let store = ProjectMemberStore::new(storage);
    let mut total_removed = 0u32;
    let mut workspace_count = 0u32;
    let mut warnings = Vec::new();
    let mut removed_workspaces = Vec::new();
    for (id, entry) in entries {
        let workspace_path = entry.last_known_path.trim();
        if workspace_path.is_empty() {
            warnings.push(format!("workspace {id} path missing"));
            continue;
        }
        workspace_count += 1;
        match with_workspace_member_lock(&id, || store.purge_terminal_members(&id, workspace_path)) {
            Ok(result) => {
                let ProjectMemberPurgeResult {
                    removed_count,
                    removed_member_ids,
                    warning,
                } = result;
                total_removed += removed_count as u32;
                if let Some(warning) = warning {
                    warnings.push(format!("workspace {id}: {warning}"));
                }
                if !removed_member_ids.is_empty() {
                    removed_workspaces.push(ProjectPurgeRemovedWorkspace {
                        workspace_id: id.clone(),
                        removed_member_ids,
                    });
                }
            }
            Err(err) => warnings.push(format!("workspace {id}: {err}")),
        }
    }
    Ok(ProjectPurgeTerminalMembersOutcome {
        result: ProjectPurgeTerminalMembersResult {
            scope,
            total_removed,
            workspace_count,
            warnings,
        },
        removed_workspaces,
    })
}

struct TerminalIdentity {
    terminal_type: Option<String>,
    command: Option<String>,
    label: String,
}

fn resolve_workspace_context(
    storage: &StorageManager,
    workspace_id: &str,
) -> Result<WorkspaceContext, String> {
    let registry = read_workspace_registry_locked(storage)?;
    let registry = registry.ok_or_else(|| WORKSPACE_CONTEXT_MISSING_MESSAGE.to_string())?;
    let entries: HashMap<String, WorkspaceRegistryEntry> =
        serde_json::from_value(registry).map_err(|err| format!("workspace registry decode failed: {err}"))?;
    let entry = entries
        .get(workspace_id)
        .ok_or_else(|| WORKSPACE_CONTEXT_MISSING_MESSAGE.to_string())?;
    let workspace_path = entry.last_known_path.trim();
    if workspace_path.is_empty() {
        return Err(WORKSPACE_CONTEXT_MISSING_MESSAGE.to_string());
    }
    let workspace_name = Path::new(workspace_path)
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_WORKSPACE_NAME)
        .to_string();
    Ok(WorkspaceContext {
        workspace_path: workspace_pat
```

### Core Architecture Module: `src-tauri/src/bin/golutra-cli.rs`
```
use std::env;
use std::io::{BufRead, BufReader, BufWriter, Write};

use interprocess::local_socket::LocalSocketStream;
use serde::{Deserialize, Serialize};

use app_lib::COMMAND_IPC_NAME;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandIpcRequest {
  mode: String,
  request_id: Option<String>,
  args: Vec<String>,
  async_exec: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommandIpcResponse {
  ok: bool,
  request_id: Option<String>,
  result: Option<CommandResultPayload>,
  error: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandResultPayload {
  status: String,
  message: Option<String>,
  data: Option<serde_json::Value>,
}

fn main() {
  let mut args: Vec<String> = env::args().skip(1).collect();
  if args.is_empty() {
    print_help();
    std::process::exit(1);
  }
  let mode = match args.first().map(|value| value.as_str()) {
    Some("wait") => "wait",
    Some("send") => "run",
    Some("help") | Some("--help") | Some("-h") => {
      print_help();
      return;
    }
    _ => "run",
  };
  let request = if mode == "wait" {
    args.remove(0);
    let request_id = args.pop().filter(|value| !value.trim().is_empty());
    if request_id.is_none() {
      eprintln!("request_id is required");
      std::process::exit(1);
    }
    CommandIpcRequest {
      mode: "wait".to_string(),
      request_id,
      args: Vec::new(),
      async_exec: None,
    }
  } else {
    let async_exec = if let Some(index) = args.iter().position(|value| value == "--async") {
      args.remove(index);
      true
    } else {
      false
    };
    CommandIpcRequest {
      mode: "run".to_string(),
      request_id: None,
      args,
      async_exec: Some(async_exec),
    }
  };

  let mut stream = LocalSocketStream::connect(COMMAND_IPC_NAME).unwrap_or_else(|err| {
    eprintln!("failed to connect golutra ipc: {err}");
    std::process::exit(1);
  });
  {
    let mut writer = BufWriter::new(&mut stream);
    let payload = serde_json::to_string(&request).unwrap_or_else(|err| {
      eprintln!("failed to encode request: {err}");
      std::process::exit(1);
    });
    writer
      .write_all(payload.as_bytes())
      .and_then(|_| writer.write_all(b"\n"))
      .and_then(|_| writer.flush())
      .unwrap_or_else(|err| {
        eprintln!("failed to send request: {err}");
        std::process::exit(1);
      });
  }
  let response_line = {
    let mut reader = BufReader::new(&mut stream);
    let mut line = String::new();
    reader.read_line(&mut line).unwrap_or_else(|err| {
      eprintln!("failed to read response: {err}");
      std::process::exit(1);
    });
    line
  };
  let response: CommandIpcResponse = serde_json::from_str(response_line.trim_end()).unwrap_or_else(|err| {
    eprintln!("failed to decode response: {err}");
    std::process::exit(1);
  });
  if !response.ok {
    if let Some(error) = response.error {
      eprintln!("{error}");
    } else {
      eprintln!("command failed");
    }
    std::process::exit(1);
  }
  if mode == "run" && request.async_exec == Some(true) {
    if let Some(request_id) = response.request_id {
      println!("{request_id}");
    }
    return;
  }
  if let Some(result) = response.result {
    let payload = serde_json::to_string_pretty(&result).unwrap_or_else(|_| result.status.clone());
    println!("{payload}");
  } else if let Some(request_id) = response.request_id {
    println!("{request_id}");
  }
}

fn print_help() {
  println!(
    "golutra command usage:\n  golutra send [--async] [--workspace <id>] <command>\n  golutra wait <request_id>\n\nExamples:\n  golutra send --workspace <id> send --sender <id> --conversation <id> --text \"hello\"\n  golutra send --workspace <id> a -> b #conversation-id hello\n  golutra wait <request_id>"
  );
}

```

### Core Architecture Module: `src-tauri/src/bin/shim.rs`
```
//! 终端 shim：为 PTY 启动目标命令，并通过 OSC 信号向上游报告就绪与退出。
//! 边界：只负责转发 IO 与退出状态，不解析命令输出或业务语义。

use std::env;
use std::io::{self, Write};
use std::process::{Command, Stdio};

// 与上游终端层的协议：用于解除输入缓冲并标记命令完成。
const OSC_READY: &str = "\x1b]633;A\x07";
const OSC_EXIT_PREFIX: &str = "\x1b]633;D;";
// 约定前缀，便于上游在未就绪前识别启动失败原因。
const SHIM_LAUNCH_ERROR_MARKER: &str = "SHIM_LAUNCH_ERROR";

#[cfg(windows)]
fn force_utf8_console() {
  use windows_sys::Win32::System::Console::{SetConsoleCP, SetConsoleOutputCP};
  // Windows 默认代码页可能导致 UTF-8 输入输出被破坏，统一切换以避免乱码。
  unsafe {
    SetConsoleCP(65001);
    SetConsoleOutputCP(65001);
  }
}

#[cfg(not(windows))]
fn force_utf8_console() {}

fn main() {
  force_utf8_console();
  let mut args = env::args();
  let _shim = args.next();
  let target = match args.next() {
    Some(value) => value,
    None => {
      // 退出码用于上游区分缺参失败。
      eprintln!("{SHIM_LAUNCH_ERROR_MARKER}: no target command");
      std::process::exit(101);
    }
  };
  let target_args: Vec<String> = args.collect();

  // 先发就绪信号，避免上游等待 shell integration 超时。
  print!("{OSC_READY}");
  let _ = io::stdout().flush();

  let child = Command::new(&target)
    .args(&target_args)
    // 继承 IO 以保持交互式终端语义，避免缓冲导致输入延迟。
    .stdin(Stdio::inherit())
    .stdout(Stdio::inherit())
    .stderr(Stdio::inherit())
    .spawn();

  match child {
    Ok(mut child) => {
      let status = match child.wait() {
        Ok(status) => status,
        Err(err) => {
          // 退出码用于上游识别 wait 失败（与 spawn 失败区分）。
          eprintln!("{SHIM_LAUNCH_ERROR_MARKER}: wait error='{}'", err);
          std::process::exit(103);
        }
      };
      let code = status.code().unwrap_or(0);
      // 通过 OSC 携带退出码，供上游更新状态/完成语义。
      print!("{OSC_EXIT_PREFIX}{code}\x07");
      let _ = io::stdout().flush();
      std::process::exit(code);
    }
    Err(err) => {
      // 退出码用于上游区分 spawn 失败（环境/路径问题）。
      eprintln!(
        "{SHIM_LAUNCH_ERROR_MARKER}: command='{}' error='{}'",
        target, err
      );
      std::process::exit(102);
    }
  }
}

```

### Core Architecture Module: `src-tauri/src/contracts/chat_dispatch.rs`
```
//! 聊天派发契约：跨层共享的派发载荷定义。

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatDispatchMentions {
  pub(crate) mention_ids: Vec<String>,
  pub(crate) mention_all: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatDispatchPayload {
  pub(crate) workspace_id: String,
  pub(crate) workspace_path: String,
  pub(crate) conversation_id: String,
  pub(crate) conversation_type: String,
  pub(crate) text: String,
  pub(crate) sender_id: String,
  pub(crate) sender_name: String,
  pub(crate) mentions: Option<ChatDispatchMentions>,
  pub(crate) message_id: Option<String>,
  pub(crate) client_trace_id: Option<String>,
  pub(crate) timestamp: Option<u64>,
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #184** (2026-08-10): **升级后出了一个严重的 bug，导致我项目进度进不下去**
  *Symptoms*: <img width="939" height="261" alt="Image" src="https://github.com/user-attachments/assets/3abe2fc6-6295-4a74-9c6a-b9b299642df4" />   <img width="958" height="362" alt="Image" src="https://github.com/user-attachments/assets/a84781f4-3b83-431c-b8cf-6293ba4e4927" />  @seekskyworld 任务做到一半直接卡死  下线也下不了 上线也上不了 终端打都打不开，但是我本地电脑的终端 也能打开 codex 就只有聊天室的终端打不开
  **Post-Mortem & Fix Analysis**:
  > 重新覆盖安装好像又可以了。 @seekskyworld 
  > <img width="1164" height="288" alt="Image" src="https://github.com/user-attachments/assets/7f8374ed-f4e0-4176-bd9c-13ea398f5ca2" />  但是这个分发任务会失败哦 @seekskyworld 
  > 0.3.1 有严重bug，完全用不了，回滚到之前版本了。受不了。痛苦 @seekskyworld 

- **Issue #181** (2026-07-21): **没有任何一个Agent能正常使用，不知道是什么情况。**
  *Symptoms*: <img width="1741" height="1086" alt="Image" src="https://github.com/user-attachments/assets/e38ebac7-f8bd-4882-b0a2-0820ea7c9a0b" />只要给他们发送消息，他们就回复这个。他永远不工作，也不知道啥情况，也不知道怎么 debug。
  **Post-Mortem & Fix Analysis**:
  > 你点击头像可以看命令行，等我下一个版本出来，会好很多
  > @Mutx163 这个版本已经解决，  <img width="176" height="282" alt="Image" src="https://github.com/user-attachments/assets/c5b45781-69eb-4610-a580-fde8d512456a" /> 点击进入三个提示词设置  <img width="1093" height="328" alt="Image" src="https://github.com/user-attachments/assets/013683c4-c509-417c-86b2-6d3dbe70ebb0" />  都点击恢复默认规则，保存

- **Issue #178** (2026-06-29): **能否增加多选技能分别给某些用户，现在一个一个用户的配置有点麻烦。**
  *Symptoms*: 能否增加多选技能分别给某些用户，现在一个一个用户的配置有点麻烦。 @seekskyworld 
  **Post-Mortem & Fix Analysis**:
  > @q8625332 意思是集体配置么
  > > [@q8625332](https://github.com/q8625332) 意思是集体配置么  @seekskyworld 是的没错，现在单个配置。用户多了。配置起来就很麻烦。
  > 已解决

- **Issue #176** (2026-06-29): **无法发起聊天，输出一小段后自动中断The filename, directory name, or volume label syntax is incorrect**
  *Symptoms*: <img width="1726" height="445" alt="Image" src="https://github.com/user-attachments/assets/fad913fd-807c-408f-a43f-f4d8828b4268" />  <img width="1771" height="775" alt="Image" src="https://github.com/user-attachments/assets/8ff4913c-3e3c-4fc5-b840-8c1caae6da24" />
  **Post-Mortem & Fix Analysis**:
  > @qq402026752 终端没有正常打开对应TUI
  > 已解决

- **Issue #174** (2026-06-29): **添加角色技能的时候，可以加个全选按钮。**
  *Symptoms*: <img width="886" height="367" alt="Image" src="https://github.com/user-attachments/assets/d152c980-cf4c-44f9-9f32-3f6fec99e3b7" />  一个个选太麻烦了。希望优化一下。
  **Post-Mortem & Fix Analysis**:
  > @q8625332 你要加全部吗
  > > [@q8625332](https://github.com/q8625332) 你要加全部吗  是的  技能多的时候 一个个选太麻烦了 @seekskyworld 
  > 已解决

- **Issue #171** (2026-06-16): **对话框能优化一下吗？**
  *Symptoms*: <img width="1155" height="120" alt="Image" src="https://github.com/user-attachments/assets/059c7039-d45f-42cb-adfa-1ed1662f464a" />  太小个了，能否支持拖拽，还有输入标点符号是卡顿，需要按两次符号才会输入进去。
  **Post-Mortem & Fix Analysis**:
  > 支持拖拽。其他的下个版本修复
  > > 支持拖拽。其他的下个版本修复  我找到了：  <img width="645" height="104" alt="Image" src="https://github.com/user-attachments/assets/a23a5b53-1210-4d2d-918b-5b61a2bae41e" />  原来在这个地方。

- **Issue #169** (2026-05-22): **软件如何给conda 环境配置codex cli**
  *Symptoms*: 如果我的环境是conda的这种，如何配置各种cli
  **Post-Mortem & Fix Analysis**:
  > @Tian0Tian0Tian 兜底环境添加对应启动目录

- **Issue #168** (2026-06-29): **使用claude创建了一个监工和一个成员，都已配置【无限制访问】，但是【成员】还会让我手动授权**
  *Symptoms*: <img width="1036" height="626" alt="Image" src="https://github.com/user-attachments/assets/2ed8450b-2923-434e-924a-346b6644cd26" />  <img width="392" height="199" alt="Image" src="https://github.com/user-attachments/assets/3b6b6572-dcbc-48d6-b267-3432cea0042b" />
  **Post-Mortem & Fix Analysis**:
  > 另外一个小问题，我后来才给监工配置的定时任务，让他每隔5分钟去检查成员是否在进行任务，有没有在偷懒，配置完自动就能生效吗？需要重启之类的操作吗？
  > > 另外一个小问题，我后来才给监工配置的定时任务，让他每隔5分钟去检查成员是否在进行任务，有没有在偷懒，配置完自动就能生效吗？需要重启之类的操作吗？  已经看到效果了
  > @seanwang1998 你需要改一下claude的配置文件，具体看一下官网文档或者问一下ai

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

### Incident Patch 1: `8b68a141` (2026-05-12)
**Commit Message**: docs: add related projects to README

**File**: `README.md` (modified, +28/-4)
```diff
@@ -72,6 +72,20 @@ Click agent avatars to inspect logs, inject prompts directly into terminal strea
 
 golutra is designed for long-running AI collaboration, not just short interactive sessions. You can define custom workflows for very different scenarios, import or export workflow templates in one click, and build automation systems that fit software teams, a one-person AI company, Werewolf templates, automated novel writing, Xiaohongshu publishing, video production, and other cross-industry use cases.
 
+### Related Projects
+
+#### Memory Layer
+
+Golutra can call EverOS as a memory layer for long-running agents, preserving context, project knowledge, and cross-task continuity across sessions.
+
+[EverOS](https://github.com/EverMind-AI/EverOS)
+
+#### MCP Connection
+
+golutra-mcp provides a more stable way to connect external tools and agents through `golutra-cli`, making it easier to integrate Golutra with MCP-based workflows.
+
+[golutra-mcp](https://github.com/golutra/golutra-mcp)
+
 ### Key Highlights
 
 - Unlimited multi-agent parallel execution
@@ -132,8 +146,6 @@ Traditional IDE workflows are usually "single-threaded + manual context switchin
 
 This repository is for source code storage and releases.
 
-Related repository: [`golutra-mcp`](https://github.com/golutra/golutra-mcp) — a more stable way to connect through `golutra-cli`.
-
 Business Email: [golutra&#64;hotmail.com](mailto:golutra%40hotmail.com)  
 Official Website: [https://www.golutra.com/](https://www.golutra.com/)  
 Video: <https://youtu.be/KpAgetjYfoY>  
@@ -196,6 +208,20 @@ golutra 是新一代多智能体工作空间，把你现有的 CLI 工具升级
 
 golutra 不只是用于短时对话，更适合长期运行的 AI 协作系统。你可以自定义工作流，一键导入导出工作流模板，去搭建适用于不同行业场景的 AI 自动化系统，无论是一人公司的 AI 团队、狼人杀模版、自动化写小说、自动化发布小红书，还是自动化制造视频，都可以作为同一套系统里的不同模版来运行。
 
+### 相关项目
+
+#### 记忆层
+
+Golutra 可以调用 EverOS 作为长期运行 Agent 的记忆层，在跨会话、跨任务中保留上下文、项目知识与执行连续性。
+
+[EverOS](https://github.com/EverMind-AI/EverOS)
+
+#### MCP 连接
+
+golutra-mcp 提供通过 `golutra-cli` 更稳定连接外部工具与 Agent 的方式，方便将 Golutra 接入基于 MCP 的工作流。
+
+[golutra-mcp](https://github.com/golutra/golutra-mcp)
+
 ### 核心亮点
 
 - 多智能体并行执行（不限数量）
@@ -256,8 +282,6 @@ golutra 不只是用于短时对话，更适合长期运行的 AI 协作系统
 
 这个仓库用于源代码存放和版本发布。
 
-相关仓库：[`golutra-mcp`](https://github.com/golutra/golutra-mcp) —— 可以通过它，更稳定地连接 `golutra-cli`。
-
 商务邮箱: [golutra&#64;hotmail.com](mailto:golutra%40hotmail.com)  
 官网: [https://www.golutra.com/](https://www.golutra.com/)  
 视频地址: <https://www.bilibili.com/video/BV1qcfhBFEpP/?spm_id_from=333.1387.homepage.video_card.click>  
```

---

### Incident Patch 2: `446f6aef` (2026-03-22)
**Commit Message**: feat: consolidate repository updates

**File**: `.github/pull_request_template.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+## Contribution Capacity
+
+- [ ] This contribution is submitted in my personal capacity.
+- [ ] This contribution is submitted on behalf of an organization that already has a signed CCLA on file.
+
+Organization name: None
+Authorization reference: None
+
+## Required Declarations
+
+- [ ] I have the legal right to submit this contribution.
+- [ ] I understand accepted contributions may be used under the repository's documented BSL, change-license, and commercial licensing model.
+- [ ] I have disclosed below any third-party, copied, or adapted code and the relevant source/license details.
+- [ ] I have reviewed any AI-assisted output included in this PR and confirmed that I have the right to submit it.
+- [ ] I understand that undisclosed or incompatible third-party code may cause this PR to be rejected or later removed.
+
+## Third-Party / Copied / Adapted Code Disclosure
+
+None.
+
+## AI Assistance Disclosure
+
+None.
+
+## Co-author Disclosure
+
+None.
```

**File**: `.github/workflows/cla.yml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+name: CLA
+
+on:
+  issue_comment:
+    types:
+      - created
+  pull_request_target:
+    types:
+      - opened
+      - synchronize
+      - reopened
+      - ready_for_review
+      - closed
+
+permissions:
+  actions: write
+  contents: write
+  pull-requests: write
+  statuses: write
+
+jobs:
+  cla:
+    uses: golutra/platform-workflows/.github/workflows/cla-reusable.yml@0.1.0
+    secrets: inherit
+    with:
+      event-name: ${{ github.event_name }}
+      issue-is-pr: ${{ github.event_name == 'issue_comment' && github.event.issue.pull_request != null }}
+      comment-body: ${{ github.event.comment.body || '' }}
+      default-branch: ${{ github.event.repository.default_branch }}
+      app-id: ${{ vars.CLA_APP_ID }}
+      compliance-profile: bsl-change-license-commercial
```

**File**: `.github/workflows/legal-metadata.yml` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+name: Legal Metadata
+
+on:
+  pull_request:
+    paths:
+      - docs/legal/corporate-authorizations.json
+  push:
+    branches:
+      - master
+    paths:
+      - docs/legal/corporate-authorizations.json
+
+permissions:
+  contents: read
+
+jobs:
+  validate-corporate-authorizations:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v4
+
+      - name: Validate corporate authorization registry schema
+        run: |
+          set -euo pipefail
+          jq -e '.version | type == "number"' docs/legal/corporate-authorizations.json >/dev/null
+          jq -e '.authorizations | type == "array"' docs/legal/corporate-authorizations.json >/dev/null
+          jq -e '
+            .authorizations | all(
+              has("authorizationReference") and
+              has("organization") and
+              has("authorizedGitHubUsernames") and
+              has("authorizedEmails") and
+              has("effectiveDate") and
+              has("expirationDate") and
+              has("status")
+            )
+          ' docs/legal/corporate-authorizations.json >/dev/null
```

**File**: `.github/workflows/pr-compliance.yml` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+name: PR Compliance
+
+on:
+  pull_request_target:
+    types:
+      - opened
+      - edited
+      - synchronize
+      - reopened
+      - ready_for_review
+
+permissions:
+  contents: read
+  pull-requests: write
+
+jobs:
+  validate-pr-metadata:
+    uses: golutra/platform-workflows/.github/workflows/pr-compliance-reusable.yml@0.1.0
+    secrets: inherit
+    with:
+      pr-number: ${{ github.event.pull_request.number }}
+      pr-body: ${{ github.event.pull_request.body }}
+      pr-author-login: ${{ github.event.pull_request.user.login }}
+      default-branch: ${{ github.event.repository.default_branch }}
+      app-id: ${{ vars.CLA_APP_ID }}
+      compliance-profile: bsl-change-license-commercial
```

**File**: `CLA.md` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+# golutra CLA Overview
+
+`golutra` 当前采用 [`Business Source License 1.1`](./LICENSE) 分发，并在 `LICENSE` 中声明未来切换到 `GPL-2.0-or-later`。为了降低外部贡献的授权链风险，本仓库采用分层贡献协议：
+
+1. 个人贡献者通过 [`ICLA`](./docs/legal/ICLA.md) 进行签署。
+2. 代表公司、团队或其他组织提交贡献时，除个人签署 `ICLA` 外，还需要由有权签字人提供 [`CCLA`](./docs/legal/CCLA.md) 或等效书面授权。
+3. 已批准的企业授权会登记在 [`corporate-authorizations.json`](./docs/legal/corporate-authorizations.json) 中，并在 PR 中通过授权编号引用；[`corporate-authorizations.md`](./docs/legal/corporate-authorizations.md) 用于说明维护规则。
+
+## 为什么需要这套流程
+
+- `golutra` 不只是一个普通开源仓库；贡献可能被用于当前 `BSL 1.1` 版本、未来 `GPL-2.0-or-later` 版本，以及项目维护者提供的商业授权。
+- 仅有“提了 PR”不足以说明贡献者拥有完整授权，尤其是雇佣关系、第三方代码拷贝、AI 生成代码来源不清这些场景。
+- 因此，本仓库要求在 PR 阶段明确贡献者身份、授权来源、第三方来源披露和 AI 辅助披露。
+
+## 入站贡献模型
+
+除 `ICLA` / `CCLA` 中约定的额外授权外，提交到本仓库并被接收的代码贡献，还应视为按 [`BSD-3-Clause`](./docs/legal/BSD-3-Clause.txt) 入站提交，不附加额外限制。
+
+这样做的目的不是替代本仓库的项目许可证，而是降低未来在再许可、版本迁移、商业授权和代码捐赠中的权利不确定性。
+
+## 贡献前请阅读
+
+- [`docs/legal/ICLA.md`](./docs/legal/ICLA.md)
+- [`docs/legal/CCLA.md`](./docs/legal/CCLA.md)
+- [`docs/legal/corporate-authorizations.json`](./docs/legal/corporate-authorizations.json)
+- [`docs/legal/corporate-authorizations.md`](./docs/legal/corporate-authorizations.md)
+- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
+
+如果你不能接受贡献可能被用于 `BSL 1.1`、未来 `GPL-2.0-or-later` 或商业授权，请不要向本仓库提交贡献。
```

---

### Incident Patch 3: `3731ebb5` (2026-03-20)
**Commit Message**: docs: refresh README messaging and roadmap

**File**: `README.md` (modified, +20/-10)
```diff
@@ -13,7 +13,7 @@
 
 <p align="center">
   <a href="https://github.com/golutra/golutra/releases"><img src="https://img.shields.io/github/v/release/golutra/golutra?label=release" alt="release"></a>
-  <a href="https://www.golutra.com/"><img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-2f7af8" alt="platform"></a>
+  <a href="https://www.golutra.com/"><img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-2f7af8" alt="platform"></a>
   <a href="https://mariadb.com/bsl11/"><img src="https://img.shields.io/badge/license-BSL%201.1-ff9f1a" alt="license"></a>
 </p>
 
@@ -68,7 +68,7 @@
 
 golutra is a next-generation multi-agent workspace that transforms your existing CLI tools into a unified AI collaboration hub. No project migration. No command relearning. No terminal switching. Just parallel execution, automated orchestration, and real-time result tracking.
 
-Click agent avatars to inspect logs, inject prompts directly into terminal streams, or monitor execution while your AI team runs silently in the background. Built with Vue 3 + Rust as a Tauri desktop app for Windows and macOS, golutra upgrades “one person + one editor” into “one person + an AI squad.” It replaces single-threaded, manual context switching with coordinated, multi-agent automation.
+Click agent avatars to inspect logs, inject prompts directly into terminal streams, or monitor execution while your AI team runs silently in the background. Built with Vue 3 + Rust as a Tauri desktop app for Windows, macOS, and Linux, golutra upgrades “one person + one editor” into “one person + an AI squad.” It replaces single-threaded, manual context switching with coordinated, multi-agent automation.
 
 golutra is designed for long-running AI collaboration, not just short interactive sessions. You can define custom workflows for very different scenarios, import or export workflow templates in one click, and build automation systems that fit software teams, a one-person AI company, Werewolf templates, automated novel writing, Xiaohongshu publishing, video production, and other cross-industry use cases.
 
@@ -132,6 +132,8 @@ Traditional IDE workflows are usually "single-threaded + manual context switchin
 
 This repository is for source code storage and releases.
 
+Related repository: [`golutra-mcp`](https://github.com/golutra/golutra-mcp) — a more stable way to connect through `golutra-cli`.
+
 Business Email: [golutra&#64;hotmail.com](mailto:golutra%40hotmail.com)  
 Official Website: [https://www.golutra.com/](https://www.golutra.com/)  
 Video: <https://youtu.be/KpAgetjYfoY>  
@@ -151,16 +153,19 @@ The source code is now open. This is three months of work, with many late nights
 
 golutra is only at its beginning.
 
-The next evolution is a true CEO Agent layer built on top of the commander system. Instead of manually organizing workflows, golutra will move toward a long-running autonomous coordinator that can precisely assemble sub-agents, manage layered memory, and keep multi-agent systems operating for extended periods with minimal supervision.
+The next evolution is a true CEO Agent layer built on top of the commander system. Instead of manually organizing workflows, golutra will move toward a long-running autonomous coordinator that can operate for up to a month without human supervision, continuously produce value, precisely assemble sub-agents, manage layered memory, and expand into a self-sustaining agent network.
 
 Upcoming capabilities include:
 
-- CEO Agent — a real top-level orchestrator designed to run for up to a month without human supervision, precisely construct sub-agents, and coordinate layered memory across roles and tasks.
+- CEO Agent — a real top-level orchestrator designed to run for up to a month without human supervision, continuously deliver useful output, precisely construct sub-agents, and coordinate layered memory across roles and tasks.
+- Infinite Agent Network — AI automatically creates agents an
```

---

### Incident Patch 4: `70877385` (2026-03-15)
**Commit Message**: feat: Update readme

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ node_modules
 dist
 dist-ssr
 *.local
+.golutra/
 .golutra/local.json
 
 # Rust
```

**File**: `README.md` (modified, +18/-67)
```diff
@@ -34,6 +34,7 @@
     <td align="center"><img src="./assets/readme/icons/opencode.svg" alt="OpenCode" width="36" /></td>
     <td align="center"><img src="./assets/readme/icons/qwen.png" alt="Qwen Code" height="48" /></td>
     <td align="center"><img src="./assets/readme/icons/openclaw.png" alt="OpenClaw" height="48" /></td>
+    <td align="center"><img src="./assets/readme/icons/any-cli.svg" alt="任意 CLI" height="48" /></td>
   </tr>
   <tr>
     <td align="center">Claude Code</td>
@@ -42,6 +43,7 @@
     <td align="center">OpenCode</td>
     <td align="center">Qwen Code</td>
     <td align="center">OpenClaw</td>
+    <td align="center">任意 CLI</td>
   </tr>
 </table>
 
@@ -68,11 +70,14 @@ golutra is a next-generation multi-agent workspace that transforms your existing
 
 Click agent avatars to inspect logs, inject prompts directly into terminal streams, or monitor execution while your AI team runs silently in the background. Built with Vue 3 + Rust as a Tauri desktop app for Windows and macOS, golutra upgrades “one person + one editor” into “one person + an AI squad.” It replaces single-threaded, manual context switching with coordinated, multi-agent automation.
 
+golutra is designed for long-running AI collaboration, not just short interactive sessions. You can define custom workflows for very different scenarios, import or export workflow templates in one click, and build automation systems that fit software teams, a one-person AI company, Werewolf templates, automated novel writing, Xiaohongshu publishing, video production, and other cross-industry use cases.
+
 ### Key Highlights
 
 - Unlimited multi-agent parallel execution
 - Automated orchestration from analysis to deployment
-- CLI compatibility: Claude, Gemini, Codex, OpenCode, Qwen, OpenClaw
+- Custom workflows with one-click template import/export for long-running automation
+- CLI compatibility: Claude, Gemini, Codex, OpenCode, Qwen, OpenClaw, Any CLI
 - Stealth terminal with context-aware intelligence
 - Visual interface combined with command-line power
 
@@ -92,6 +97,7 @@ Supported CLI tools:
 - OpenCode
 - Qwen Code
 - OpenClaw
+- Any CLI
 
 What you keep:
 
@@ -139,21 +145,19 @@ This software is independently developed and maintained by [seekskyworld](https:
 
 ### Open Source Status
 
-The source code is now open. Any parts involving server keys, account configuration, test data, or other sensitive information will be sanitized and refactored before being gradually published to the repository.
-This is two months of work, with many late nights spent on the architecture and details. It’s all to make the experience better; suggestions and bugs can be submitted on GitHub.
+The source code is now open. This is three months of work, with many late nights spent on the architecture and details. It’s all to make the experience better; suggestions and bugs can be submitted on GitHub.
 
 ### What’s Next
 
 golutra is only at its beginning.
 
-The next evolution introduces a refactored OpenClaw as a true commander layer — a central AI coordinator capable of automatically creating agents, assigning roles, and generating structured collaboration channels based on task complexity. Instead of manually organizing workflows, golutra will dynamically assemble self-structured AI teams on demand.
+The next evolution is a true CEO Agent layer built on top of the commander system. Instead of manually organizing workflows, golutra will move toward a long-running autonomous coordinator that can precisely assemble sub-agents, manage layered memory, and keep multi-agent systems operating for extended periods with minimal supervision.
 
 Upcoming capabilities include:
 
+- CEO Agent — a real top-level orchestrator designed to run for up to a month without human supervision, precisely construct sub-agents, and coordinate layered memory across roles and tasks.
 - Mobile Remote Control — monitor agents, review logs, intervene, and redirect tasks directly from your phone.
-- Auto Agent Bu
```

**File**: `assets/readme/icons/any-cli.svg` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+<svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
+  <defs>
+    <linearGradient id="any-cli-bg" x1="18" y1="14" x2="78" y2="82" gradientUnits="userSpaceOnUse">
+      <stop stop-color="#FFE7C2"/>
+      <stop offset="0.48" stop-color="#FF9B54"/>
+      <stop offset="1" stop-color="#FF5E3A"/>
+    </linearGradient>
+    <linearGradient id="any-cli-star" x1="58" y1="18" x2="76" y2="36" gradientUnits="userSpaceOnUse">
+      <stop stop-color="#FFF4BF"/>
+      <stop offset="1" stop-color="#FFD36B"/>
+    </linearGradient>
+  </defs>
+  <rect x="10" y="16" width="76" height="64" rx="18" fill="url(#any-cli-bg)"/>
+  <rect x="14" y="20" width="68" height="56" rx="14" fill="#171A22" fill-opacity="0.82"/>
+  <circle cx="24" cy="28" r="3" fill="#FF8A80"/>
+  <circle cx="34" cy="28" r="3" fill="#FFD180"/>
+  <circle cx="44" cy="28" r="3" fill="#CCFF90"/>
+  <path d="M28 43L41 48L28 53" stroke="#FFF4E6" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
+  <path d="M48 57H63" stroke="#FFF4E6" stroke-width="5.5" stroke-linecap="round"/>
+  <path d="M66 17L69.0908 24.9092L77 28L69.0908 31.0908L66 39L62.9092 31.0908L55 28L62.9092 24.9092L66 17Z" fill="url(#any-cli-star)"/>
+</svg>
```

---

### Incident Patch 5: `dce30e50` (2026-03-02)
**Commit Message**: chore: 更新 OpenClaw 宣传与发布流程文档

- README 增加 OpenClaw 作为第六个 CLI 宣传位
- 新增 OpenClaw 图标资源
- 同步更新发布流程文档

**File**: `README.md` (modified, +9/-2)
```diff
@@ -33,13 +33,15 @@
     <td align="center"><img src="./assets/readme/icons/codex.png" alt="Codex CLI" height="48" /></td>
     <td align="center"><img src="./assets/readme/icons/opencode.svg" alt="OpenCode" width="36" /></td>
     <td align="center"><img src="./assets/readme/icons/qwen.png" alt="Qwen Code" height="48" /></td>
+    <td align="center"><img src="./assets/readme/icons/openclaw.png" alt="OpenClaw" height="48" /></td>
   </tr>
   <tr>
     <td align="center">Claude Code</td>
     <td align="center">Gemini CLI</td>
     <td align="center">Codex CLI</td>
     <td align="center">OpenCode</td>
     <td align="center">Qwen Code</td>
+    <td align="center">OpenClaw</td>
   </tr>
 </table>
 
@@ -70,7 +72,7 @@ Click agent avatars to inspect logs, inject prompts directly into terminal strea
 
 - Unlimited multi-agent parallel execution
 - Automated orchestration from analysis to deployment
-- CLI compatibility: Claude, Gemini, Codex, OpenCode, Qwen
+- CLI compatibility: Claude, Gemini, Codex, OpenCode, Qwen, OpenClaw
 - Stealth terminal with context-aware intelligence
 - Visual interface combined with command-line power
 
@@ -89,6 +91,7 @@ Supported CLI tools:
 - Codex CLI
 - OpenCode
 - Qwen Code
+- OpenClaw
 
 What you keep:
 
@@ -127,6 +130,7 @@ Business Email: [golutra&#64;hotmail.com](mailto:golutra%40hotmail.com)
 Official Website: [https://www.golutra.com/](https://www.golutra.com/)  
 Video: <https://youtu.be/KpAgetjYfoY>  
 Discord: [https://discord.gg/QyNVu56mpY](https://discord.gg/QyNVu56mpY)
+How to effectively report issues with runtime logs: <https://github.com/golutra/golutra/issues/44>  
 Security Policy: See [SECURITY.md](SECURITY.md)
 
 ### Author
@@ -213,7 +217,7 @@ golutra 是新一代多智能体工作空间，把你现有的 CLI 工具升级
 
 - 多智能体并行执行（不限数量）
 - 从分析到部署的自动编排
-- CLI 兼容：Claude、Gemini、Codex、OpenCode、Qwen
+- CLI 兼容：Claude、Gemini、Codex、OpenCode、Qwen、OpenClaw
 - 隐形终端与上下文感知智能
 - 可视化界面结合命令行能力
 
@@ -232,6 +236,7 @@ golutra 是新一代多智能体工作空间，把你现有的 CLI 工具升级
 - Codex CLI
 - OpenCode
 - Qwen Code
+- OpenClaw
 
 你将保留：
 
@@ -269,6 +274,8 @@ golutra 是新一代多智能体工作空间，把你现有的 CLI 工具升级
 商务邮箱: [golutra&#64;hotmail.com](mailto:golutra%40hotmail.com)  
 官网: [https://www.golutra.com/](https://www.golutra.com/)  
 视频地址: <https://www.bilibili.com/video/BV1qcfhBFEpP/?spm_id_from=333.1387.homepage.video_card.click>  
+交流群链接: <https://github.com/golutra/golutra/issues/15>  
+问题如何有效反馈并附带运行日志: <https://github.com/golutra/golutra/issues/44>  
 安全策略: 详见 [SECURITY.md](SECURITY.md)
 
 ### 作者
```

**File**: `startup_processmd.md` (modified, +1/-5)
```diff
@@ -46,8 +46,4 @@ target/  # 默认的 Rust 构建产物目录
 - `src/features`: 功能模块（工作区、聊天、技能商店、插件、终端等）
 - `src/shared`: 复用组件与 composables
 - `src/i18n`: 文案与语言配置
-- `src/styles/global.css`: 全局样式与工具类
-
-See `docs/ENGINEERING_GUIDE.md` for conventions and structure details.
-
-Legacy React code is moved to `C:\project\user\nexus-dashboard-suite-legacy`.
+- `src/styles/global.css`: 全局样式与工具类
\ No newline at end of file
```

---

### Incident Patch 6: `75e68e29` (2026-03-01)
**Commit Message**: feat: 完成终端引擎与消息链路阶段性重构，补齐会话创建与语义派发能力，并修复终端稳定性/输入一致性/UI 状态问题

- 重构终端架构，按 platform/engine/runtime/message_service/ui_gateway/orchestration 分层迁移
- 拆分会话与引擎内部模块（session state、semantic worker、resume poller、timestamps、snapshot）
- 引入 message pipeline 与 semantic stream，补齐平台状态能力
- 补齐会话与扩展能力（skills、create terminal、create user）
- 修复终端关键问题（渲染、attach/resize/webgl 稳定性、屏幕历史、好友删除流程、状态递增与重试、退出覆盖新会话）
- 优化稳定性与性能（队列派发、4 分屏逻辑、低开销模式、语义线程按需创建）
- 修复输入一致性问题（光标不同步、覆盖行）并收敛 UI 状态异常

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # golutra
 
 **使用赛博监工系统，指挥你的 AI 牛马。**  
-**Cyber Overseer System: Command your AI workforce.**
+**Use Cyberpunk Overseer System: Command your AI workforce.**
 
 ---
 
```

**File**: `index.html` (modified, +11/-3)
```diff
@@ -7,16 +7,24 @@
     <title>golutra</title>
     <script>
       (() => {
-        const storageKey = 'nexus-theme';
-        const stored = window.localStorage.getItem(storageKey);
-        const theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';
         const root = document.documentElement;
+        const themeKey = 'golutra-theme';
+        const localeKey = 'golutra-locale';
+        const isValidTheme = (value) => value === 'light' || value === 'dark' || value === 'system';
+        const isValidLocale = (value) => value === 'en-US' || value === 'zh-CN';
+        const storedTheme = window.localStorage.getItem(themeKey);
+        const storedLocale = window.localStorage.getItem(localeKey);
+        const theme = isValidTheme(storedTheme) ? storedTheme : 'dark';
         root.dataset.theme = theme;
         const resolvedTheme = theme === 'system'
           ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
           : theme;
         root.dataset.resolvedTheme = resolvedTheme;
         root.classList.toggle('dark', resolvedTheme === 'dark');
+        const locale = isValidLocale(storedLocale) ? storedLocale : (isValidLocale(root.lang) ? root.lang : 'en-US');
+        root.lang = locale;
+        window.__GOLUTRA_THEME__ = theme;
+        window.__GOLUTRA_LOCALE__ = locale;
       })();
     </script>
     <style>
```

**File**: `package.json` (modified, +8/-2)
```diff
@@ -1,13 +1,15 @@
 {
-  "name": "nexus-dashboard-suite",
+  "name": "golutra",
   "private": true,
   "version": "0.0.0",
   "packageManager": "pnpm@10.28.0",
   "type": "module",
   "scripts": {
     "dev": "vite",
+    "dev:frontend": "vite",
+    "dev:backend": "cargo run --manifest-path src-tauri/Cargo.toml",
     "dev:tauri": "pnpm run shim:build && pnpm run dev",
-    "shim:build": "cargo build --manifest-path src-tauri/Cargo.toml --bin shim",
+    "shim:build": "cargo build --manifest-path src-tauri/Cargo.toml --bin shim --bin golutra-cli",
     "build": "vite build",
     "preview": "vite preview",
     "test": "vitest run",
@@ -18,8 +20,12 @@
   },
   "dependencies": {
     "@tauri-apps/api": "^2.0.0",
+    "@tauri-apps/plugin-clipboard-manager": "^2.0.0",
     "@tauri-apps/plugin-dialog": "^2.6.0",
+    "@tauri-apps/plugin-shell": "^2.0.0",
+    "@xterm/addon-canvas": "^0.7.0",
     "@xterm/addon-fit": "^0.11.0",
+    "@xterm/addon-search": "^0.15.0",
     "@xterm/addon-webgl": "^0.19.0",
     "@xterm/xterm": "^6.0.0",
     "pinia": "^3.0.4",
```

**File**: `pnpm-lock.yaml` (modified, +44/-0)
```diff
@@ -11,12 +11,24 @@ importers:
       '@tauri-apps/api':
         specifier: ^2.0.0
         version: 2.9.1
+      '@tauri-apps/plugin-clipboard-manager':
+        specifier: ^2.0.0
+        version: 2.3.2
       '@tauri-apps/plugin-dialog':
         specifier: ^2.6.0
         version: 2.6.0
+      '@tauri-apps/plugin-shell':
+        specifier: ^2.0.0
+        version: 2.3.4
+      '@xterm/addon-canvas':
+        specifier: ^0.7.0
+        version: 0.7.0(@xterm/xterm@6.0.0)
       '@xterm/addon-fit':
         specifier: ^0.11.0
         version: 0.11.0
+      '@xterm/addon-search':
+        specifier: ^0.15.0
+        version: 0.15.0(@xterm/xterm@6.0.0)
       '@xterm/addon-webgl':
         specifier: ^0.19.0
         version: 0.19.0
@@ -621,9 +633,15 @@ packages:
   '@tauri-apps/api@2.9.1':
     resolution: {integrity: sha512-IGlhP6EivjXHepbBic618GOmiWe4URJiIeZFlB7x3czM0yDHHYviH1Xvoiv4FefdkQtn6v7TuwWCRfOGdnVUGw==}
 
+  '@tauri-apps/plugin-clipboard-manager@2.3.2':
+    resolution: {integrity: sha512-CUlb5Hqi2oZbcZf4VUyUH53XWPPdtpw43EUpCza5HWZJwxEoDowFzNUDt1tRUXA8Uq+XPn17Ysfptip33sG4eQ==}
+
   '@tauri-apps/plugin-dialog@2.6.0':
     resolution: {integrity: sha512-q4Uq3eY87TdcYzXACiYSPhmpBA76shgmQswGkSVio4C82Sz2W4iehe9TnKYwbq7weHiL88Yw19XZm7v28+Micg==}
 
+  '@tauri-apps/plugin-shell@2.3.4':
+    resolution: {integrity: sha512-ktsRWf8wHLD17aZEyqE8c5x98eNAuTizR1FSX475zQ4TxaiJnhwksLygQz+AGwckJL5bfEP13nWrlTNQJUpKpA==}
+
   '@types/estree@1.0.8':
     resolution: {integrity: sha512-dWHzHa2WqEXI/O1E9OjrocMTKJl2mSrEolh1Iomrv6U+JuNwaHXsXx9bLu5gG7BUWFIN0skIQJQ/L1rIex4X6w==}
 
@@ -769,9 +787,19 @@ packages:
   '@vue/shared@3.5.26':
     resolution: {integrity: sha512-7Z6/y3uFI5PRoKeorTOSXKcDj0MSasfNNltcslbFrPpcw6aXRUALq4IfJlaTRspiWIUOEZbrpM+iQGmCOiWe4A==}
 
+  '@xterm/addon-canvas@0.7.0':
+    resolution: {integrity: sha512-LF5LYcfvefJuJ7QotNRdRSPc9YASAVDeoT5uyXS/nZshZXjYplGXRECBGiznwvhNL2I8bq1Lf5MzRwstsYQ2Iw==}
+    peerDependencies:
+      '@xterm/xterm': ^5.0.0
+
   '@xterm/addon-fit@0.11.0':
     resolution: {integrity: sha512-jYcgT6xtVYhnhgxh3QgYDnnNMYTcf8ElbxxFzX0IZo+vabQqSPAjC3c1wJrKB5E19VwQei89QCiZZP86DCPF7g==}
 
+  '@xterm/addon-search@0.15.0':
+    resolution: {integrity: sha512-ZBZKLQ+EuKE83CqCmSSz5y1tx+aNOCUaA7dm6emgOX+8J9H1FWXZyrKfzjwzV+V14TV3xToz1goIeRhXBS5qjg==}
+    peerDependencies:
+      '@xterm/xterm': ^5.0.0
+
   '@xterm/addon-webgl@0.19.0':
     resolution: {integrity: sha512-b3fMOsyLVuCeNJWxolACEUED0vm7qC0cy4wRvf3oURSzDTYVQiGPhTnhWZwIHdvC48Y+oLhvYXnY4XDXPoJo6A==}
 
@@ -2094,10 +2122,18 @@ snapshots:
 
   '@tauri-apps/api@2.9.1': {}
 
+  '@tauri-apps/plugin-clipboard-manager@2.3.2':
+    dependencies:
+      '@tauri-apps/api': 2.9.1
+
   '@tauri-apps/plugin-dialog@2.6.0':
     dependencies:
       '@tauri-apps/api': 2.9.1
 
+  '@tauri-apps/plugin-shell@2.3.4':
+    dependencies:
+      '@tauri-apps/api': 2.9.1
+
   '@types/estree@1.0.8': {}
 
   '@types/json-schema@7.0.15': {}
@@ -2316,8 +2352,16 @@ snapshots:
 
   '@vue/shared@3.5.26': {}
 
+  '@xterm/addon-canvas@0.7.0(@xterm/xterm@6.0.0)':
+    dependencies:
+      '@xterm/xterm': 6.0.0
+
   '@xterm/addon-fit@0.11.0': {}
 
+  '@xterm/addon-search@0.15.0(@xterm/xterm@6.0.0)':
+    dependencies:
+      '@xterm/xterm': 6.0.0
+
   '@xterm/addon-webgl@0.19.0': {}
 
   '@xterm/xterm@6.0.0': {}
```

**File**: `scripts/golutra-cli.cmd` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+@echo off
+"%~dp0..\src-tauri\target\debug\golutra-cli.exe" %*
```

#### Recent Merged Pull Requests:
- **PR #117** (closed): fix: improve onboarding prompt to prevent Claude Code rejection (#114) (@ekkoitac)
- **PR #105** (closed): test: trigger GitHub App compliance smoke check (@seekskyworld)
- **PR #104** (2026-03-22): chore: pass GitHub App settings to compliance workflows (@seekskyworld)
- **PR #101** (closed): docs: harden repository compliance setup (@seekskyworld)
- **PR #80** (closed): docs: adjust security policy wording (@young8i)
- **PR #21** (closed): fix(terminal): resolve Claude Code stuck in 'connecting' state (@ghost)
- **PR #1** (2026-02-16): docs: update README media and contact sections (@seekskyworld)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
