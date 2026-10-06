# Forensic Learning Record (Deep Inspection): limecloud/lime

> **Canonical Artifact**: `07_PROJECT_LEARNING/limecloud-lime-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/limecloud/lime](https://github.com/limecloud/lime))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:48:43.563Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `limecloud/lime`
- **Description**: Full-stack AI agent for coding, files, terminals, tools, research, content, multimodal work, and multi-agent workflows.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1484 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `electron/systemUtilityHost.ts`
```
import path from "node:path";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { app, shell } from "./electronRuntime";
import { MacOSNativeHostClient, NativeHostError } from "./macosNativeHost";
import {
  WindowsNativeHostClient,
  NativeHostError as WindowsNativeHostError,
} from "./windowsNativeHost";
import { readDesktopCapabilities } from "./platformCapabilities";

type HostArgs = Record<string, unknown> | null | undefined;
type ConfigReader = () => Promise<Record<string, unknown>>;
type HostEventEmitter = (event: string, payload?: unknown) => void;

type SystemUtilityHostOptions = {
  appDataRoot: string;
  readConfig: ConfigReader;
  emit?: HostEventEmitter;
};

export class SystemUtilityHost {
  readonly #appDataRoot: string;
  readonly #readConfig: ConfigReader;
  readonly #macOSNativeHost = new MacOSNativeHostClient();
  readonly #windowsNativeHost = new WindowsNativeHostClient();
  readonly #activeBookmarkTokens = new Map<string, string>();
  readonly #unsubscribeNativeEvents: () => void;

  constructor(options: SystemUtilityHostOptions) {
    this.#appDataRoot = options.appDataRoot;
    this.#readConfig = options.readConfig;
    const unsubscribeMac = options.emit
      ? this.#macOSNativeHost.onEvent((event) =>
          options.emit?.(event.event, event.payload),
        )
      : () => undefined;
    const unsubscribeWindows = options.emit
      ? this.#windowsNativeHost.onEvent((event) =>
          options.emit?.(event.event, event.payload),
        )
      : () => undefined;
    this.#unsubscribeNativeEvents = () => {
      unsubscribeMac();
      unsubscribeWindows();
    };
  }

  async openExternalUrl(args: HostArgs): Promise<Record<string, never>> {
    const request = readRequest(args);
    const url = readRequiredString(request, "url");
    await shell.openExternal(normalizeExternalUrl(url));
    return {};
  }

  async openSystemSettingsUrl(args: HostArgs): Promise<Record<string, never>> {
    const request = readRequest(args);
    const url = readRequiredString(request, "url");
    await shell.openExternal(normalizeSystemSettingsUrl(url));
    return {};
  }

  async invokeMacOSNativeHost(args: HostArgs): Promise<unknown> {
    if (process.platform !== "darwin") {
      throw new NativeHostError(
        "unsupported",
        "macOS native host is only available on macOS.",
      );
    }
    const request = readRequest(args);
    const method = readRequiredString(request, "method");
    const rawParams =
      request.params &&
      typeof request.params === "object" &&
      !Array.isArray(request.params)
        ? (request.params as Record<string, unknown>)
        : {};
    if (method === "bookmark.revoke") {
      const bookmarkId = readBookmarkId(rawParams.bookmarkId);
      const token = this.#activeBookmarkTokens.get(bookmarkId);
      if (token) {
        await this.#macOSNativeHost.invoke({
          method: "bookmark.stop",
          params: { token },
        });
        this.#activeBookmarkTokens.delete(bookmarkId);
      }
      await this.#revokeBookmark(bookmarkId);
      return { bookmarkId, revoked: true };
    }

    const bookmarkId =
      method === "bookmark.start" || method === "bookmark.stop"
        ? optionalBookmarkId(rawParams.bookmarkId)
        : undefined;
    const persistId =
      method === "bookmark.create"
        ? optionalBookmarkId(rawParams.persistId)
        : undefined;
    const params = { ...rawParams };
    delete params.persistId;
    if (
      (method === "bookmark.resolve" || method === "bookmark.start") &&
      !readString(params, "bookmark")
    ) {
      const persistedId = readBookmarkId(params.bookmarkId);
      const persisted = await this.#readBookmark(persistedId);
      params.bookmark = persisted.bookmark;
    }
    if (method === "bookmark.stop" && !readString(params, "token")) {
      if (!bookmarkId) {
        throw new NativeHostError(
          "invalid_argument",
          "bookmark.stop requires a token or bookmarkId.",
        );
      }
      const token = this.#activeBookmarkTokens.get(bookmarkId);
      if (!token) {
        throw new NativeHostError(
          "bookmark_unavailable",
          `No active security-scoped bookmark token exists: ${bookmarkId}`,
        );
      }
      params.token = token;
    }
    delete params.bookmarkId;

    const result = await this.#macOSNativeHost.invoke({ method, params });
    if (method === "bookmark.create" && persistId) {
      const bookmark = toRecord(result);
      const encoded = readRequiredString(bookmark, "bookmark");
      await this.#writeBookmark(persistId, {
        bookmark: encoded,
        path: readString(bookmark, "path") ?? null,
      });
      return { ...bookmark, bookmarkId: persistId, persisted: true };
    }
    if (method === "bookmark.start" && bookmarkId) {
      const token = readString(result, "token");
      if (token) {
        this.#activeBookmarkTokens.set(bookmarkId, token);
        return { ...toRecord(result), bookmarkId };
      }
    }
    if (method === "bookmark.stop") {
      if (bookmarkId) {
        this.#activeBookmarkTokens.delete(bookmarkId);
      } else {
        for (const [activeBookmarkId, activeToken] of this
          .#activeBookmarkTokens) {
          if (activeToken === readString(result, "token")) {
            this.#activeBookmarkTokens.delete(activeBookmarkId);
            break;
          }
        }
      }
    }
    return result;
  }

  async invokeWindowsNativeHost(args: HostArgs): Promise<unknown> {
    if (process.platform !== "win32") {
      throw new WindowsNativeHostError(
        "unsupported",
        "Windows native host is only available on Windows.",
      );
    }
    const request = readRequest(args);
    const method = readRequiredString(request, "method");
    const rawParams =
      request.params &&
      typeof request.params === "object" &&
      !Array.isArray(request.params)
        ? (request.params as Record<string, unknown>)
        : {};
    return await this.#windowsNativeHost.invoke({ method, params: rawParams });
  }

  dispose(): void {
    this.#activeBookmarkTokens.clear();
    this.#unsubscribeNativeEvents();
    this.#macOSNativeHost.dispose();
    this.#windowsNativeHost.dispose();
  }

  async getEnvironmentPreview(): Promise<Record<string, unknown>> {
    const config = await this.#readConfig();
    const serverConfig = toRecord(config.server);
    const apiKey = readString(serverConfig, "api_key") ?? "";
    const apiBase =
      `http://${readString(serverConfig, "host") ?? "127.0.0.1"}:` +
      `${readNumber(serverConfig, "port") ?? 8787}`;
    const entries = [
      {
        key: "LIME_API_BASE",
        value: apiBase,
        maskedValue: apiBase,
        source: "config",
        sourceLabel: "Electron Desktop Host",
        sensitive: false,
        overriddenSources: [],
      },
      {
        key: "LIME_API_KEY",
        value: apiKey,
        maskedValue: apiKey ? "********" : "",
        source: "config",
        sourceLabel: "Electron Desktop Host",
        sensitive: true,
        overriddenSources: [],
      },
    ];
    return {
      desktopCapabilities: readDesktopCapabilities(),
      shellImport: {
        enabled: false,
        status: "disabled",
        message: "Electron current 暂未接入 shell 环境导入预览。",
        importedCount: 0,
        durationMs: null,
      },
      entries,
    };
  }

  getBrowserConnectorSettings(): Record<string, unknown> {
    const installRoot = path.join(this.#appDataRoot, "connectors", "browser");
    return {
      enabled: true,
      install_root_dir: installRoot,
      install_dir: path.join(installRoot, "Lime Browser Connector"),
      browser_action_capabilities: [
        { key: "read_page", label: "读取页面", enabled: true },
        { key: "click", label: "点击", enabled: true },
        { key: "type", label: "输入", enabled: true },
        { key: "scroll_page", label: "滚动页面", enabled: true },
      ],
      system_connectors: [],
      diagnostic: diagnosticMeta("get_browser_connector_settings_cmd"),
    };
  }

  getBrowserConnectorInstallStatus(): Record<string, unknown> {
    const installRoot = path.join(this.#appDataRoot, "connectors", "browser");
    return {
      status: "not_installed",
      install_root_dir: installRoot,
      install_dir: path.join(installRoot, "Lime Browser Connector"),
      bundled_name: "Lime Browser Connector",
      bundled_version: app.getVersion(),
      installed_name: null,
      installed_version: null,
      message: "尚未导出浏览器连接器",
      diagnostic: diagnosticMeta("get_browser_connector_install_status_cmd"),
    };
  }

  getChromeProfileSessions(): Array<Record<string, unknown>> {
    return emptyDiagnosticList("get_chrome_profile_sessions");
  }

  getChromeBridgeEndpointInfo(): Record<string, unknown> {
    return {
      server_running: false,
      host: "127.0.0.1",
      port: 8999,
      observer_ws_url: "ws://127.0.0.1:8999/lime-chrome-observer",
      control_ws_url: "ws://127.0.0.1:8999/lime-chrome-control",
      bridge_key: "proxy_cast",
      diagnostic: diagnosticMeta("get_chrome_bridge_endpoint_info"),
    };
  }

  getChromeBridgeStatus(): Record<string, unknown> {
    return {
      observer_count: 0,
      control_count: 0,
      pending_command_count: 0,
      observers: [],
      controls: [],
      pending_commands: [],
      diagnostic: diagnosticMeta("get_chrome_bridge_status"),
    };
  }

  getBrowserBackendPolicy(): Record<string, unknown> {
    return {
      priority: ["lime_extension_bridge", "cdp_direct"],
      auto_fallback: false,
      diagnostic: diagnosticMeta("get_browser_backend_policy"),
    };
  }

  async #writeBookmark(
    bookmarkId: string,
    bookmark: { bookmark: string; path: string | null },
  ): Promise<void> {
    try {
      const directory = this.#bookmarkDirectory();
      const target = this.#bookmarkPath(bookmarkId);
      await mkdir(directory, { recursive: true });
      await chmo
```

### Core Architecture Module: `extensions/lime-chrome/lib/cdp/commands/utils.js`
```
/**
 * Shared CDP dispatch utilities and constants.
 */

export const RUNTIME_ENABLE_DELAY = 10
export const TARGET_CREATE_DELAY = 100
export const CDP_COMMAND_TIMEOUT = 30000
export const DEFAULT_MAX_RETAINED_TABS = 10

export function withTimeout(promise, ms, label) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`CDP command timed out after ${ms}ms: ${label}`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

```

### Core Architecture Module: `extensions/lime-chrome/lib/cdp/events/page-lifecycle.js`
```
/**
 * Page lifecycle event handlers.
 *
 * Observes page load, navigation, frame management, download, file chooser,
 * and interstitial events.
 *
 * Requires: `Page.enable` (called in debugger-attach.js on attach).
 *
 * Active handling:
 *   - Page.fileChooserOpened: logged + forwarded to relay for agent to handle
 *     (requires prior Page.setInterceptFileChooserDialog({ enabled: true }))
 *
 * All other events are passive (log + forward to relay).
 */

import { createLogger } from '../../logger.js'

const log = createLogger('evt:page')

/**
 * @param {string} method
 * @param {number} tabId
 * @param {object} params
 * @param {import('./index.js').EventContext} _ctx
 * @returns {{ suppress?: boolean } | void}
 */
export function handlePageLifecycleEvent(method, tabId, params, _ctx) {
  switch (method) {
    // ── Load events ──

    case 'Page.loadEventFired':
      log.debug('page loaded:', tabId, 'ts:', params?.timestamp)
      break

    case 'Page.domContentEventFired':
      log.debug('DOM content loaded:', tabId, 'ts:', params?.timestamp)
      break

    case 'Page.lifecycleEvent':
      log.debug(
        'lifecycle:', tabId,
        params?.name,
        'frameId:', params?.frameId,
        'loaderId:', params?.loaderId,
      )
      break

    // ── Frame events ──

    case 'Page.frameNavigated':
      log.debug(
        'frame navigated:', tabId,
        'url:', truncate(params?.frame?.url || '', 100),
        'id:', params?.frame?.id,
        'type:', params?.type,
      )
      break

    case 'Page.frameAttached':
      log.debug(
        'frame attached:', tabId,
        'frameId:', params?.frameId,
        'parentFrameId:', params?.parentFrameId,
      )
      break

    case 'Page.frameDetached':
      log.debug(
        'frame detached:', tabId,
        'frameId:', params?.frameId,
        'reason:', params?.reason,
      )
      break

    case 'Page.frameStartedLoading':
      log.debug('frame loading started:', tabId, 'frameId:', params?.frameId)
      break

    case 'Page.frameStoppedLoading':
      log.debug('frame loading stopped:', tabId, 'frameId:', params?.frameId)
      break

    case 'Page.frameStartedNavigating':
      log.debug(
        'frame navigating:', tabId,
        'frameId:', params?.frameId,
        'url:', truncate(params?.url || '', 100),
        'type:', params?.navigationType,
      )
      break

    case 'Page.navigatedWithinDocument':
      log.debug(
        'SPA navigation:', tabId,
        'frameId:', params?.frameId,
        'url:', truncate(params?.url || '', 100),
        'type:', params?.navigationType,
      )
      break

    // ── Window / popup events ──

    case 'Page.windowOpen':
      log.info(
        'window.open:', tabId,
        'url:', truncate(params?.url || '', 100),
        'name:', params?.windowName || '(none)',
        'features:', params?.windowFeatures?.join(',') || '(none)',
        'userGesture:', params?.userGesture,
      )
      break

    // ── Download events ──

    case 'Page.downloadWillBegin':
      log.info(
        'download starting:', tabId,
        'url:', truncate(params?.url || '', 100),
        'filename:', params?.suggestedFilename,
        'guid:', params?.guid,
      )
      break

    case 'Page.downloadProgress':
      if (params?.state === 'completed') {
        log.info('download completed:', tabId, 'guid:', params?.guid, 'bytes:', params?.totalBytes)
      } else if (params?.state === 'canceled') {
        log.info('download canceled:', tabId, 'guid:', params?.guid)
      }
      break

    // ── File chooser (requires Page.setInterceptFileChooserDialog) ──

    case 'Page.fileChooserOpened':
      log.info(
        'file chooser opened:', tabId,
        'mode:', params?.mode,
        'frameId:', params?.frameId,
        'backendNodeId:', params?.backendNodeId,
      )
      break

    // ── Interstitial (SSL/security pages) ──

    case 'Page.interstitialShown':
      log.warn('interstitial shown (security/SSL page):', tabId)
      break

    case 'Page.interstitialHidden':
      log.info('interstitial hidden:', tabId)
      break
  }
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str
}

```

### Core Architecture Module: `lime-rs/crates/agent-protocol/src/hook.rs`
```
// Adapted from Codex hook protocol contracts
// (c4f42d161ae44a8d696ee9fb595709661979d187), Apache-2.0.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HookEventName {
    PreToolUse,
    PermissionRequest,
    PostToolUse,
    PreCompact,
    PostCompact,
    SessionStart,
    SessionEnd,
    UserPromptSubmit,
    SubagentStart,
    SubagentStop,
    Stop,
}

impl HookEventName {
    pub fn key_label(self) -> &'static str {
        match self {
            Self::PreToolUse => "pre_tool_use",
            Self::PermissionRequest => "permission_request",
            Self::PostToolUse => "post_tool_use",
            Self::PreCompact => "pre_compact",
            Self::PostCompact => "post_compact",
            Self::SessionStart => "session_start",
            Self::SessionEnd => "session_end",
            Self::UserPromptSubmit => "user_prompt_submit",
            Self::SubagentStart => "subagent_start",
            Self::SubagentStop => "subagent_stop",
            Self::Stop => "stop",
        }
    }

    pub fn scope(self) -> HookScope {
        match self {
            Self::SessionStart | Self::SessionEnd | Self::SubagentStart => HookScope::Thread,
            Self::PreToolUse
            | Self::PermissionRequest
            | Self::PostToolUse
            | Self::PreCompact
            | Self::PostCompact
            | Self::UserPromptSubmit
            | Self::SubagentStop
            | Self::Stop => HookScope::Turn,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HookHandlerType {
    Command,
    Prompt,
    Agent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HookExecutionMode {
    Sync,
    Async,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HookScope {
    Thread,
    Turn,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HookSource {
    System,
    User,
    Project,
    Mdm,
    SessionFlags,
    Plugin,
    CloudRequirements,
    CloudManagedConfig,
    LegacyManagedConfigFile,
    LegacyManagedConfigMdm,
    #[default]
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HookTrustStatus {
    Managed,
    Untrusted,
    Trusted,
    Modified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HookRunStatus {
    Running,
    Completed,
    Failed,
    Blocked,
    Stopped,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HookOutputEntryKind {
    Warning,
    Stop,
    Feedback,
    Context,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct HookOutputEntry {
    pub kind: HookOutputEntryKind,
    pub text: String,
}

/// Immutable definition captured for one provider sampling step.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct HookSnapshot {
    pub key: String,
    pub event_name: HookEventName,
    pub handler_type: HookHandlerType,
    pub execution_mode: HookExecutionMode,
    pub matcher: Option<String>,
    pub command: Option<String>,
    pub timeout_sec: u64,
    pub status_message: Option<String>,
    pub additional_context_limit: Option<usize>,
    pub source_path: PathBuf,
    pub source: HookSource,
    pub plugin_id: Option<String>,
    pub display_order: i64,
    pub enabled: bool,
    pub is_managed: bool,
    pub current_hash: String,
    pub trust_status: HookTrustStatus,
}

impl HookSnapshot {
    pub fn scope(&self) -> HookScope {
        self.event_name.scope()
    }

    pub fn run_id(&self) -> String {
        format!(
            "{}:{}:{}",
            self.event_name.key_label().replace('_', "-"),
            self.display_order,
            self.source_path.display()
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct HookRunSummary {
    pub id: String,
    pub event_name: HookEventName,
    pub handler_type: HookHandlerType,
    pub execution_mode: HookExecutionMode,
    pub scope: HookScope,
    pub source_path: PathBuf,
    #[serde(default)]
    pub source: HookSource,
    pub display_order: i64,
    pub status: HookRunStatus,
    pub status_message: Option<String>,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub duration_ms: Option<i64>,
    pub entries: Vec<HookOutputEntry>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn canonical_hook_wire_matches_codex_core_contract() {
        assert_eq!(
            serde_json::to_value(HookEventName::PreToolUse).expect("event wire"),
            json!("pre_tool_use")
        );
        assert_eq!(HookEventName::SessionEnd.scope(), HookScope::Thread);
        assert_eq!(HookEventName::PostToolUse.scope(), HookScope::Turn);
    }
}

```

### Core Architecture Module: `lime-rs/crates/agent-protocol/src/world_state.rs`
```
use crate::MultiAgentMode;
use serde::{Deserialize, Serialize};
use std::path::Path;

pub const WORLD_STATE_TURN_METADATA_KEY: &str = "world_state";
pub const WORLD_STATE_SOURCE: &str = "app_server_world_state";

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWorldState {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<RuntimeWorldEnvironment>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub environments: Vec<RuntimeWorldEnvironmentSelection>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<RuntimeWorldPermissions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collaboration: Option<RuntimeWorldMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub multi_agent: Option<MultiAgentMode>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub instruction_sections: Vec<RuntimeWorldInstructionSection>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWorldEnvironment {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_root: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_effort: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWorldEnvironmentSelection {
    pub environment_id: String,
    pub cwd: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub runtime_workspace_roots: Vec<String>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub primary: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<RuntimeWorldEnvironmentStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shell: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeWorldEnvironmentStatus {
    Pending,
    Ready,
    Disconnected,
    Unknown,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWorldPermissions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_policy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sandbox_policy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_search: Option<bool>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWorldMode {
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWorldInstructionSection {
    pub id: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

impl RuntimeWorldState {
    pub fn from_cwd(cwd: &Path) -> Self {
        Self {
            environment: Some(RuntimeWorldEnvironment {
                cwd: Some(cwd.to_string_lossy().into_owned()),
                ..RuntimeWorldEnvironment::default()
            }),
            ..RuntimeWorldState::default()
        }
    }

    pub fn is_empty(&self) -> bool {
        self.environment.is_none()
            && self.environments.is_empty()
            && self.permissions.is_none()
            && self.collaboration.is_none()
            && self.multi_agent.is_none()
            && self.instruction_sections.is_empty()
    }

    pub fn render_environment_context(&self) -> Option<String> {
        if self.is_empty() {
            return None;
        }

        let mut rendered = String::from("<environment_context>");
        if let Some(environment) = &self.environment {
            render_environment(&mut rendered, environment, self.environments.is_empty());
        }
        render_environments(&mut rendered, &self.environments);
        if let Some(permissions) = &self.permissions {
            render_permissions(&mut rendered, permissions);
        }
        if let Some(collaboration) = &self.collaboration {
            render_mode(&mut rendered, "collaboration", collaboration);
        }
        if let Some(multi_agent) = &self.multi_agent {
            render_multi_agent_mode(&mut rendered, multi_agent);
        }
        for section in &self.instruction_sections {
            render_instruction_section(&mut rendered, section);
        }
        rendered.push_str("\n</environment_context>");
        Some(rendered)
    }
}

fn render_environment(
    rendered: &mut String,
    environment: &RuntimeWorldEnvironment,
    include_cwd: bool,
) {
    if include_cwd {
        push_text_node(rendered, "cwd", environment.cwd.as_deref());
    }
    push_text_node(
        rendered,
        "project_root",
        environment.project_root.as_deref(),
    );
    push_text_node(
        rendered,
        "workspace_id",
        environment.workspace_id.as_deref(),
    );
    push_text_node(rendered, "thread_id", environment.thread_id.as_deref());
    push_text_node(rendered, "turn_id", environment.turn_id.as_deref());
    if environment.provider.is_some()
        || environment.model.is_some()
        || environment.reasoning_effort.is_some()
    {
        rendered.push_str("\n  <model");
        push_attr(rendered, "provider", environment.provider.as_deref());
        push_attr(rendered, "name", environment.model.as_deref());
        push_attr(
            rendered,
            "reasoning_effort",
            environment.reasoning_effort.as_deref(),
        );
        rendered.push_str(" />");
    }
}

fn render_environments(rendered: &mut String, environments: &[RuntimeWorldEnvironmentSelection]) {
    if environments.len() == 1 {
        render_environment_selection_values(rendered, &environments[0], "  ");
        return;
    }
    if environments.is_empty() {
        return;
    }
    rendered.push_str("\n  <environments>");
    for environment in environments {
        rendered.push_str("\n    <environment id=\"");
        push_xml_escaped_text(rendered, &environment.environment_id);
        rendered.push_str(if environment.primary {
            "\" primary=\"true\">"
        } else {
            "\" primary=\"false\">"
        });
        render_environment_selection_values(rendered, environment, "      ");
        rendered.push_str("\n    </environment>");
    }
    rendered.push_str("\n  </environments>");
}

fn render_environment_selection_values(
    rendered: &mut String,
    environment: &RuntimeWorldEnvironmentSelection,
    indent: &str,
) {
    rendered.push('\n');
    rendered.push_str(indent);
    rendered.push_str("<cwd>");
    push_xml_escaped_text(rendered, &environment.cwd);
    rendered.push_str("</cwd>");
    let status = match environment.status {
        Some(RuntimeWorldEnvironmentStatus::Pending) => Some("starting"),
        Some(
            RuntimeWorldEnvironmentStatus::Disconnected | RuntimeWorldEnvironmentStatus::Unknown,
        ) => Some("unavailable"),
        Some(RuntimeWorldEnvironmentStatus::Ready) | None => None,
    };
    if let Some(status) = status {
        rendered.push('\n');
        rendered.push_str(indent);
        rendered.push_str("<status>");
        rendered.push_str(status);
        rendered.push_str("</status>");
    }
    if let Some(shell) = environment
        .shell
        .as_deref()
        .map(str::trim)
        .filter(|shell| !shell.is_empty())
    {
        rendered.push('\n');
        rendered.push_str(indent);
        rendered.push_str("<shell>");
        push_xml_escaped_text(rendered, shell);
        rendered.push_str("</shell>");
    }
}

fn render_permissions(rendered: &mut String, permissions: &RuntimeWorldPermissions) {
    if permissions.approval_policy.is_none()
        && permissions.sandbox_policy.is_none()
        && permissions.web_search.is_none()
    {
        return;
    }
    rendered.push_str("\n  <permissions");
    push_attr(
        rendered,
        "approval_policy",
        permissions.approval_policy.as_deref(),
    );
    push_attr(
        rendered,
        "sandbox_policy",
        permissions.sandbox_policy.as_deref(),
    );
    if let Some(web_search) = permissions.web_search {
        push_attr(
            rendered,
            "web_search",
            Some(if web_search { "enabled" } else { "disabled" }),
        );
    }
    rendered.push_str(" />");
}

fn render_mode(rendered: &mut String, tag: &str, mode: &RuntimeWorldMode) {
    if mode.mode.trim().is_empty() {
        return;
    }
    rendered.push_str("\n  <");
    rendered.push_str(tag);
    push_attr(rendered, "mode", Some(mode.mode.as_str()));
    push_attr(rendered, "source", mode.source.as_deref());
    rendered.push_str(" />");
}

fn render_multi_agent_mode(rendered: &mut String, mode: &MultiAgentMode) {
    const EXPLICIT_REQUEST_ONLY: &str = "Any earlier instruction enabling proactive multi-agent delegation no longer applies. Do not spawn sub-agents unless the user or applicable AGENTS.md/skill instructions explicitly ask for sub-agents, delegation, or parallel agent work.";
    const PROACTIVE: &str = "Proactive multi-agent delegation is
```

### Core Architecture Module: `lime-rs/crates/agent-runtime/src/provider_turn/output_lifecycle.rs`
```
use super::CurrentProviderTurnEvent;
use crate::reply_execution::RuntimeReplyAttemptError;

#[derive(Clone, Copy)]
pub(super) enum ProviderOutputFamily {
    Text,
    Reasoning,
}

impl ProviderOutputFamily {
    fn label(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Reasoning => "reasoning",
        }
    }

    fn started_event(self, item_id: String) -> CurrentProviderTurnEvent {
        match self {
            Self::Text => CurrentProviderTurnEvent::TextStart { item_id },
            Self::Reasoning => CurrentProviderTurnEvent::ReasoningStart { item_id },
        }
    }
}

pub(super) fn provider_output_item_id(
    turn_id: &str,
    attempt: u32,
    family: ProviderOutputFamily,
    source_item_id: &str,
) -> String {
    format!(
        "provider:{turn_id}:{attempt}:{}:{source_item_id}",
        family.label()
    )
}

pub(super) fn start_output_item<F>(
    active_item_id: &mut Option<String>,
    item_id: String,
    family: ProviderOutputFamily,
    on_event: &mut F,
    emitted_any: bool,
) -> Result<(), RuntimeReplyAttemptError>
where
    F: FnMut(CurrentProviderTurnEvent),
{
    match active_item_id.as_deref() {
        Some(active) if active == item_id => Ok(()),
        Some(active) => Err(RuntimeReplyAttemptError::new(
            format!(
                "Provider {} Item {} started while {} is still active",
                family.label(),
                item_id,
                active
            ),
            emitted_any,
        )),
        None => {
            *active_item_id = Some(item_id.clone());
            on_event(family.started_event(item_id));
            Ok(())
        }
    }
}

pub(super) fn end_reasoning_output_item<F>(
    active_item_id: &mut Option<String>,
    item_id: String,
    on_event: &mut F,
    emitted_any: bool,
) -> Result<(), RuntimeReplyAttemptError>
where
    F: FnMut(CurrentProviderTurnEvent),
{
    if active_item_id.is_none() {
        start_output_item(
            active_item_id,
            item_id.clone(),
            ProviderOutputFamily::Reasoning,
            on_event,
            emitted_any,
        )?;
    }
    match active_item_id.as_deref() {
        Some(active) if active == item_id => {
            active_item_id.take();
            on_event(CurrentProviderTurnEvent::ReasoningEnd { item_id });
            Ok(())
        }
        Some(active) => Err(RuntimeReplyAttemptError::new(
            format!(
                "Provider {} Item {} ended while {} is still active",
                ProviderOutputFamily::Reasoning.label(),
                item_id,
                active
            ),
            emitted_any,
        )),
        None => unreachable!("output item was started above"),
    }
}

pub(super) fn defer_text_output_item_end<F>(
    active_item_id: &mut Option<String>,
    pending_item_ids: &mut Vec<String>,
    item_id: String,
    on_event: &mut F,
    emitted_any: bool,
) -> Result<(), RuntimeReplyAttemptError>
where
    F: FnMut(CurrentProviderTurnEvent),
{
    if active_item_id.is_none() {
        start_output_item(
            active_item_id,
            item_id.clone(),
            ProviderOutputFamily::Text,
            on_event,
            emitted_any,
        )?;
    }
    match active_item_id.as_deref() {
        Some(active) if active == item_id => {
            active_item_id.take();
            pending_item_ids.push(item_id);
            Ok(())
        }
        Some(active) => Err(RuntimeReplyAttemptError::new(
            format!(
                "Provider text Item {} ended while {} is still active",
                item_id, active
            ),
            emitted_any,
        )),
        None => unreachable!("output item was started above"),
    }
}

pub(super) fn finish_active_output_items<F>(
    active_reasoning_item_id: &mut Option<String>,
    active_text_item_id: &mut Option<String>,
    pending_text_item_ids: &mut Vec<String>,
    on_event: &mut F,
) where
    F: FnMut(CurrentProviderTurnEvent),
{
    if let Some(item_id) = active_reasoning_item_id.take() {
        on_event(CurrentProviderTurnEvent::ReasoningEnd { item_id });
    }
    if let Some(item_id) = active_text_item_id.take() {
        pending_text_item_ids.push(item_id);
    }
}

```

### Core Architecture Module: `lime-rs/crates/agent-runtime/src/reply_loop.rs`
```
//! Reply loop 的 current Turn 规则骨架。
//!
//! 这里只保存 provider/reply loop 的纯状态和退出文案，不引入具体
//! provider、tool、session store 或 Agent 事件类型。

pub const DEFAULT_MAX_REPLY_TURNS: u32 = 1000;
pub const DEFAULT_MAX_EMPTY_RESPONSE_RETRIES: u32 = 2;
pub const MAX_REPLY_TURNS_REACHED_MESSAGE: &str =
    "I've reached the maximum number of actions I can do without user input. Would you like me to continue?";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RuntimeReplyLoop {
    attempts_taken: u32,
    reply_turns_taken: u32,
    empty_response_retries: u32,
    max_turns: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeReplyLoopStep {
    Continue { attempt: u32 },
    MaxTurnsReached { attempt: u32, max_turns: u32 },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeEmptyResponseStep {
    Retry { retry: u32, max_retries: u32 },
    Exhausted { retries: u32, max_retries: u32 },
}

impl RuntimeReplyLoop {
    pub fn new(max_turns: Option<u32>) -> Self {
        Self {
            attempts_taken: 0,
            reply_turns_taken: 0,
            empty_response_retries: 0,
            max_turns: max_turns.unwrap_or(DEFAULT_MAX_REPLY_TURNS),
        }
    }

    pub fn max_turns(&self) -> u32 {
        self.max_turns
    }

    pub fn attempts_taken(&self) -> u32 {
        self.attempts_taken
    }

    pub fn next_attempt(&mut self) -> RuntimeReplyLoopStep {
        self.empty_response_retries = 0;
        self.attempts_taken = self.attempts_taken.saturating_add(1);
        self.reply_turns_taken = self.reply_turns_taken.saturating_add(1);
        if self.reply_turns_taken > self.max_turns {
            return RuntimeReplyLoopStep::MaxTurnsReached {
                attempt: self.attempts_taken,
                max_turns: self.max_turns,
            };
        }

        RuntimeReplyLoopStep::Continue {
            attempt: self.attempts_taken,
        }
    }

    pub fn next_retry_attempt(&mut self) -> u32 {
        self.attempts_taken = self.attempts_taken.saturating_add(1);
        self.attempts_taken
    }

    pub fn request_empty_response_retry(&mut self) -> RuntimeEmptyResponseStep {
        if self.empty_response_retries >= DEFAULT_MAX_EMPTY_RESPONSE_RETRIES {
            return RuntimeEmptyResponseStep::Exhausted {
                retries: self.empty_response_retries,
                max_retries: DEFAULT_MAX_EMPTY_RESPONSE_RETRIES,
            };
        }
        self.empty_response_retries = self.empty_response_retries.saturating_add(1);
        RuntimeEmptyResponseStep::Retry {
            retry: self.empty_response_retries,
            max_retries: DEFAULT_MAX_EMPTY_RESPONSE_RETRIES,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uses_default_max_turns() {
        let loop_state = RuntimeReplyLoop::new(None);

        assert_eq!(loop_state.max_turns(), DEFAULT_MAX_REPLY_TURNS);
        assert_eq!(loop_state.attempts_taken(), 0);
    }

    #[test]
    fn yields_attempt_until_max_is_reached() {
        let mut loop_state = RuntimeReplyLoop::new(Some(2));

        assert_eq!(
            loop_state.next_attempt(),
            RuntimeReplyLoopStep::Continue { attempt: 1 }
        );
        assert_eq!(
            loop_state.next_attempt(),
            RuntimeReplyLoopStep::Continue { attempt: 2 }
        );
        assert_eq!(
            loop_state.next_attempt(),
            RuntimeReplyLoopStep::MaxTurnsReached {
                attempt: 3,
                max_turns: 2
            }
        );
    }

    #[test]
    fn empty_response_retries_are_bounded_without_spending_reply_turns() {
        let mut loop_state = RuntimeReplyLoop::new(Some(1));

        assert_eq!(
            loop_state.next_attempt(),
            RuntimeReplyLoopStep::Continue { attempt: 1 }
        );
        assert_eq!(
            loop_state.request_empty_response_retry(),
            RuntimeEmptyResponseStep::Retry {
                retry: 1,
                max_retries: 2
            }
        );
        assert_eq!(loop_state.next_retry_attempt(), 2);
        assert_eq!(
            loop_state.request_empty_response_retry(),
            RuntimeEmptyResponseStep::Retry {
                retry: 2,
                max_retries: 2
            }
        );
        assert_eq!(loop_state.next_retry_attempt(), 3);
        assert_eq!(
            loop_state.request_empty_response_retry(),
            RuntimeEmptyResponseStep::Exhausted {
                retries: 2,
                max_retries: 2
            }
        );
        assert_eq!(loop_state.attempts_taken(), 3);
        assert_eq!(
            loop_state.next_attempt(),
            RuntimeReplyLoopStep::MaxTurnsReached {
                attempt: 4,
                max_turns: 1
            }
        );
    }
}

```

### Core Architecture Module: `lime-rs/crates/agent-runtime/src/session_loop.rs`
```
//! Session submission loop。
//!
//! Session 是串行调度边界：同一个 session 同时只运行一个 task，新的提交要么
//! 进入 FIFO 队列，要么显式返回 busy。steer 与 inter-agent mailbox 保持两条
//! 输入队列，task 可以在 sampling step 之间主动 drain pending input。

use futures::future::BoxFuture;
use serde_json::Value;
use std::fmt;
use std::sync::Arc;
use tokio::sync::oneshot;
use uuid::Uuid;

mod actor;
mod handle;
mod input_queue;
mod inter_agent;
mod registry;
mod resources;
mod step;

pub use handle::RuntimeSessionHandle;
pub use input_queue::{
    RuntimeSessionClosureTask, RuntimeSessionInput, RuntimeSessionInputActivity,
    RuntimeSessionInputHandle, RuntimeSessionMailboxDeliveryPhase, RuntimeSessionMailboxLoader,
    RuntimeSessionPendingResponse, RuntimeSessionResponseKind, RuntimeSessionTask,
    RuntimeSessionTaskContext, RuntimeSessionTaskKind, RuntimeSessionTaskOutcome,
};
pub use inter_agent::{
    RuntimeSessionInterAgentDeliveryMode, RuntimeSessionInterAgentInput,
    RuntimeSessionInterAgentMessageKind, RuntimeSessionInterAgentResultStatus,
};
pub use registry::RuntimeSessionRegistry;
pub use step::{RuntimeSessionStepContext, RuntimeSessionTokenUsage};

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RuntimeSessionTaskFailure {
    pub message: String,
    pub reason_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuntimeSessionSubmitResult {
    Started,
    Queued { position: usize },
    Busy,
}

pub struct RuntimeSessionSubmission {
    pub id: String,
    pub client_user_message_id: Option<String>,
    pub trace: Option<RuntimeSessionTraceContext>,
    pub result: RuntimeSessionSubmitResult,
    pub completion: oneshot::Receiver<Result<RuntimeSessionTaskOutcome, RuntimeSessionTaskFailure>>,
}

pub enum RuntimeSessionUserInputResult {
    Submitted(RuntimeSessionSubmission),
    Steered { id: String, turn_id: String },
}

/// W3C trace carrier propagated with a session operation.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RuntimeSessionTraceContext {
    pub traceparent: Option<String>,
    pub tracestate: Option<String>,
}

/// Actor-ordered state used by App Server read/resume projections.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RuntimeSessionSnapshot {
    pub active_turn_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RuntimeSessionOperationContext {
    pub session_id: String,
    pub thread_id: String,
    pub submission_id: String,
    pub active_turn_id: Option<String>,
    pub client_user_message_id: Option<String>,
    pub trace: Option<RuntimeSessionTraceContext>,
}

#[derive(Clone)]
pub struct RuntimeSessionHandler {
    run: Arc<
        dyn Fn(
                RuntimeSessionOperationContext,
                tokio_util::sync::CancellationToken,
            ) -> BoxFuture<'static, Result<(), String>>
            + Send
            + Sync,
    >,
}

impl RuntimeSessionHandler {
    pub fn new(
        run: impl Fn(RuntimeSessionOperationContext) -> BoxFuture<'static, Result<(), String>>
            + Send
            + Sync
            + 'static,
    ) -> Self {
        Self::new_with_cancellation(move |context, _cancellation_token| run(context))
    }

    pub fn new_with_cancellation(
        run: impl Fn(
                RuntimeSessionOperationContext,
                tokio_util::sync::CancellationToken,
            ) -> BoxFuture<'static, Result<(), String>>
            + Send
            + Sync
            + 'static,
    ) -> Self {
        Self { run: Arc::new(run) }
    }

    async fn execute(&self, context: RuntimeSessionOperationContext) -> Result<(), String> {
        self.execute_with_cancellation(context, tokio_util::sync::CancellationToken::new())
            .await
    }

    async fn execute_with_cancellation(
        &self,
        context: RuntimeSessionOperationContext,
        cancellation_token: tokio_util::sync::CancellationToken,
    ) -> Result<(), String> {
        (self.run)(context, cancellation_token).await
    }
}

/// Operations accepted by the session dispatcher.
///
/// Existing handle methods lower into this operation type. Callers that need
/// operation identity can submit the envelope directly and receive a stable
/// operation receipt.
#[derive(Clone)]
pub enum RuntimeSessionOperation {
    StartTask {
        task: Arc<dyn RuntimeSessionTask>,
        queue_if_busy: bool,
        replace_active: bool,
    },
    UserInput {
        expected_turn_id: Option<String>,
        input: Vec<RuntimeSessionInput>,
        task: Option<Arc<dyn RuntimeSessionTask>>,
        queue_if_busy: bool,
    },
    Review {
        task: Arc<dyn RuntimeSessionTask>,
    },
    Compact {
        task: Arc<dyn RuntimeSessionTask>,
    },
    ThreadSettings {
        handler: RuntimeSessionHandler,
    },
    SetMemoryMode {
        handler: RuntimeSessionHandler,
    },
    RefreshMcp {
        handler: RuntimeSessionHandler,
    },
    ReloadConfig {
        handler: RuntimeSessionHandler,
    },
    RunShell {
        auxiliary: RuntimeSessionHandler,
        task: Arc<dyn RuntimeSessionTask>,
    },
    InterAgentCommunication {
        input: RuntimeSessionInterAgentInput,
    },
    ApprovalResponse {
        expected_turn_id: Option<String>,
        request_id: String,
        response: Value,
    },
    UserInputResponse {
        expected_turn_id: Option<String>,
        request_id: String,
        response: Value,
    },
    PermissionResponse {
        expected_turn_id: Option<String>,
        request_id: String,
        response: Value,
    },
    DynamicToolResponse {
        expected_turn_id: Option<String>,
        request_id: String,
        response: Value,
    },
    McpElicitationResponse {
        expected_turn_id: Option<String>,
        request_id: String,
        response: Value,
    },
    Interrupt {
        expected_turn_id: Option<String>,
    },
    Shutdown,
}

impl fmt::Debug for RuntimeSessionOperation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::StartTask {
                task,
                queue_if_busy,
                replace_active,
            } => f
                .debug_struct("StartTask")
                .field("turn_id", &task.turn_id())
                .field("kind", &task.kind())
                .field("queue_if_busy", queue_if_busy)
                .field("replace_active", replace_active)
                .finish(),
            Self::UserInput {
                expected_turn_id,
                input,
                task,
                queue_if_busy,
            } => f
                .debug_struct("UserInput")
                .field("expected_turn_id", expected_turn_id)
                .field("input_count", &input.len())
                .field(
                    "candidate_turn_id",
                    &task.as_ref().map(|task| task.turn_id()),
                )
                .field("queue_if_busy", queue_if_busy)
                .finish(),
            Self::Review { task } | Self::Compact { task } => f
                .debug_struct("ReplacingSessionTaskOperation")
                .field("turn_id", &task.turn_id())
                .field("kind", &task.kind())
                .finish(),
            Self::ThreadSettings { .. } => f.write_str("ThreadSettings"),
            Self::SetMemoryMode { .. } => f.write_str("SetMemoryMode"),
            Self::RefreshMcp { .. } => f.write_str("RefreshMcp"),
            Self::ReloadConfig { .. } => f.write_str("ReloadConfig"),
            Self::RunShell { task, .. } => f
                .debug_struct("RunShell")
                .field("turn_id", &task.turn_id())
                .field("kind", &task.kind())
                .finish(),
            Self::InterAgentCommunication { input } => f
                .debug_struct("InterAgentCommunication")
                .field("message_id", &input.message_id)
                .field("sender_thread_id", &input.sender_thread_id)
                .field("recipient_thread_id", &input.recipient_thread_id)
                .field("delivery_mode", &input.delivery_mode)
                .finish(),
            Self::ApprovalResponse {
                expected_turn_id,
                request_id,
                ..
            } => f
                .debug_struct("ApprovalResponse")
                .field("expected_turn_id", expected_turn_id)
                .field("request_id", request_id)
                .finish(),
            Self::UserInputResponse {
                expected_turn_id,
                request_id,
                ..
            } => f
                .debug_struct("UserInputResponse")
                .field("expected_turn_id", expected_turn_id)
                .field("request_id", request_id)
                .finish(),
            Self::PermissionResponse {
                expected_turn_id,
                request_id,
                ..
            } => f
                .debug_struct("PermissionResponse")
                .field("expected_turn_id", expected_turn_id)
                .field("request_id", request_id)
                .finish(),
            Self::DynamicToolResponse {
                expected_turn_id,
                request_id,
                ..
            } => f
                .debug_struct("DynamicToolResponse")
                .field("expected_turn_id", expected_turn_id)
                .field("request_id", request_id)
                .finish(),
            Self::McpElicitationResponse {
                expected_turn_id,
                request_id,
                ..
            } => f
                .debug_struct("McpElicitationResponse")
                .field("expected_turn_id", expected_turn_id)
                .field("request_id", request_id)
                .finish(),
            Self::Interrupt { expected_turn_id } => f
                .debug_struct("Interrupt")
                .field("expected_turn_id", expected_turn_id)
                .finish(),
            Self::Shutdown => f.write_str("Shutdown"),
       
```

### Core Architecture Module: `lime-rs/crates/agent-runtime/src/session_loop/actor.rs`
```
use super::input_queue::{
    PendingInputQueue, QueuedTask, RuntimeSessionTask, RuntimeSessionTaskContext,
    RuntimeSessionTaskMetadata, RuntimeSessionTaskOutcome, RuntimeSessionTaskState,
};
use super::resources::RuntimeSessionResources;
use super::{
    RuntimeSessionHandle, RuntimeSessionLoopError, RuntimeSessionOperation,
    RuntimeSessionOperationContext, RuntimeSessionOperationResult,
    RuntimeSessionOperationSubmission, RuntimeSessionResponseKind, RuntimeSessionSnapshot,
    RuntimeSessionSubmitResult, RuntimeSessionTaskFailure,
};
use crate::code_mode::RuntimeCodeModeServiceFactory;
use crate::session_loop::handle::runtime_session_submission;
use futures::FutureExt;
use serde_json::Value;
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot, watch};
use tokio::task::JoinHandle;
use tokio::time::{timeout_at, Duration, Instant};
use tokio_util::sync::CancellationToken;

const SESSION_COMMAND_BUFFER: usize = 512;
const TASK_ABORT_GRACE: Duration = Duration::from_millis(100);

struct ActiveTask {
    key: u64,
    task: Arc<dyn RuntimeSessionTask>,
    context: RuntimeSessionTaskContext,
    cancellation_token: CancellationToken,
    completion: oneshot::Sender<Result<RuntimeSessionTaskOutcome, RuntimeSessionTaskFailure>>,
    join: JoinHandle<()>,
}

pub(super) enum RuntimeSessionCommand {
    Operation {
        submission: RuntimeSessionOperationSubmission,
        reply: oneshot::Sender<Result<RuntimeSessionOperationResult, RuntimeSessionLoopError>>,
    },
    SubscribeInputActivity {
        reply: oneshot::Sender<(
            watch::Receiver<super::RuntimeSessionInputActivity>,
            Option<super::RuntimeSessionInputActivity>,
        )>,
    },
    Snapshot {
        reply: oneshot::Sender<RuntimeSessionSnapshot>,
    },
    TaskFinished {
        task_key: u64,
        result: Result<(), RuntimeSessionTaskFailure>,
    },
}

struct TaskFinishedMessage {
    task_key: u64,
    result: Result<(), RuntimeSessionTaskFailure>,
}

pub(super) struct RuntimeSessionActor;

impl RuntimeSessionActor {
    pub(super) fn spawn(
        session_id: String,
        thread_id: String,
        code_mode_factory: Option<&RuntimeCodeModeServiceFactory>,
    ) -> RuntimeSessionHandle {
        let (tx, rx) = mpsc::channel(SESSION_COMMAND_BUFFER);
        let (finished_tx, finished_rx) = mpsc::unbounded_channel();
        let (termination_tx, termination) = watch::channel(false);
        let resources = Arc::new(RuntimeSessionResources::new(thread_id, code_mode_factory));
        tokio::spawn(run_session_loop(
            session_id,
            Arc::clone(&resources),
            rx,
            finished_rx,
            finished_tx,
            termination_tx,
        ));
        RuntimeSessionHandle {
            tx,
            termination,
            resources,
        }
    }
}

async fn run_session_loop(
    session_id: String,
    resources: Arc<RuntimeSessionResources>,
    mut rx: mpsc::Receiver<RuntimeSessionCommand>,
    mut finished_rx: mpsc::UnboundedReceiver<TaskFinishedMessage>,
    finished_tx: mpsc::UnboundedSender<TaskFinishedMessage>,
    termination_tx: watch::Sender<bool>,
) {
    let session_id: Arc<str> = Arc::from(session_id);
    let pending_input = Arc::new(PendingInputQueue::default());
    let mut active: Option<ActiveTask> = None;
    let mut queued = VecDeque::new();
    let mut next_task_key = 1_u64;

    loop {
        let command = tokio::select! {
            biased;
            finished = finished_rx.recv() => finished.map(|finished| RuntimeSessionCommand::TaskFinished {
                task_key: finished.task_key,
                result: finished.result,
            }),
            command = rx.recv() => command,
        };
        let Some(command) = command else {
            break;
        };
        match command {
            RuntimeSessionCommand::Snapshot { reply } => {
                let _ = reply.send(RuntimeSessionSnapshot {
                    active_turn_id: active
                        .as_ref()
                        .map(|active_task| active_task.task.turn_id().to_string()),
                });
            }
            RuntimeSessionCommand::SubscribeInputActivity { reply } => {
                let (activity, mut pending_activity) = match active.as_ref() {
                    Some(active_task) => active_task.context.subscribe_activity().await,
                    None => pending_input.subscribe_activity_snapshot().await,
                };
                if pending_activity.is_none() && !queued.is_empty() {
                    pending_activity = Some(super::RuntimeSessionInputActivity::Steer);
                }
                let _ = reply.send((activity, pending_activity));
            }
            RuntimeSessionCommand::Operation { submission, reply } => {
                let RuntimeSessionOperationSubmission {
                    id,
                    operation,
                    client_user_message_id,
                    trace,
                } = submission;
                match operation {
                    RuntimeSessionOperation::StartTask {
                        task,
                        queue_if_busy,
                        replace_active,
                    } => {
                        let input = task.initial_input();
                        let submission = submit_task(
                            &id,
                            &client_user_message_id,
                            &trace,
                            task,
                            input,
                            queue_if_busy,
                            replace_active,
                            &mut active,
                            &mut queued,
                            Arc::clone(&session_id),
                            Arc::clone(&resources),
                            Arc::clone(&pending_input),
                            finished_tx.clone(),
                            &mut next_task_key,
                        )
                        .await;
                        if matches!(submission.result, RuntimeSessionSubmitResult::Queued { .. }) {
                            pending_input.publish_steer_activity();
                        }
                        let _ =
                            reply.send(Ok(RuntimeSessionOperationResult::Submission(submission)));
                    }
                    RuntimeSessionOperation::UserInput {
                        expected_turn_id,
                        input,
                        task,
                        queue_if_busy,
                    } => {
                        if let Some(active_task) = active.as_ref() {
                            if active_task.task.kind().accepts_steer() {
                                let active_turn_id = active_task.task.turn_id().to_string();
                                if expected_turn_id
                                    .as_deref()
                                    .is_some_and(|expected| expected != active_turn_id)
                                {
                                    let _ = reply.send(Err(RuntimeSessionLoopError::InvalidTask(
                                        "runtime session user input target is no longer active"
                                            .to_string(),
                                    )));
                                    continue;
                                }
                                if !active_task.context.input_handle().push_steer(input).await {
                                    let _ = reply.send(Err(RuntimeSessionLoopError::InvalidTask(
                                        "runtime session turn is already finishing".to_string(),
                                    )));
                                    continue;
                                }
                                let _ = reply.send(Ok(RuntimeSessionOperationResult::Accepted {
                                    id,
                                    turn_id: Some(active_turn_id),
                                }));
                                continue;
                            }
                        }
                        if expected_turn_id.is_some() {
                            let _ = reply.send(Err(RuntimeSessionLoopError::InvalidTask(
                                "runtime session has no matching active turn for user input"
                                    .to_string(),
                            )));
                            continue;
                        }
                        let Some(task) = task else {
                            let message = if active.is_some() {
                                "runtime session task does not accept user input"
                            } else {
                                "runtime session has no active turn for user input"
                            };
                            let _ = reply.send(Err(RuntimeSessionLoopError::InvalidTask(
                                message.to_string(),
                            )));
                            continue;
                        };
                        let submission = submit_task(
                            &id,
                            &client_user_message_id,
                            &trace,
                            task,
                            input,
                            queue_if_busy,
                            false,
                            &mut active,
                            &mut queued,
                            Arc::clone(&session_id),
                            Arc::clone(&resources),
                            Arc::clone(&pending_input),
                            finished_tx.clone(),
                            &mut next_task_key,
                        )
                        .await;
                        let _ =
                            reply.send(Ok(Runti
```

### Core Architecture Module: `lime-rs/crates/agent-runtime/src/session_loop/handle.rs`
```
use super::actor::RuntimeSessionCommand;
use super::resources::RuntimeSessionResources;
use super::{
    RuntimeSessionInput, RuntimeSessionInterAgentInput, RuntimeSessionLoopError,
    RuntimeSessionOperation, RuntimeSessionOperationResult, RuntimeSessionOperationSubmission,
    RuntimeSessionSnapshot, RuntimeSessionSubmission, RuntimeSessionSubmitResult,
    RuntimeSessionTask, RuntimeSessionTaskFailure, RuntimeSessionTaskOutcome,
    RuntimeSessionTraceContext, RuntimeSessionUserInputResult,
};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot, watch};

#[derive(Clone)]
pub struct RuntimeSessionHandle {
    pub(super) tx: mpsc::Sender<RuntimeSessionCommand>,
    pub(super) termination: watch::Receiver<bool>,
    pub(super) resources: Arc<RuntimeSessionResources>,
}

impl RuntimeSessionHandle {
    pub fn thread_id(&self) -> &str {
        self.resources.thread_id()
    }

    pub async fn snapshot(&self) -> Result<RuntimeSessionSnapshot, RuntimeSessionLoopError> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(RuntimeSessionCommand::Snapshot { reply: reply_tx })
            .await
            .map_err(|_| RuntimeSessionLoopError::Closed)?;
        reply_rx.await.map_err(|_| RuntimeSessionLoopError::Closed)
    }

    pub async fn submit(
        &self,
        task: Arc<dyn RuntimeSessionTask>,
        queue_if_busy: bool,
    ) -> Result<RuntimeSessionSubmission, RuntimeSessionLoopError> {
        self.submit_with_policy(task, queue_if_busy, false).await
    }

    pub async fn submit_replacing(
        &self,
        task: Arc<dyn RuntimeSessionTask>,
    ) -> Result<RuntimeSessionSubmission, RuntimeSessionLoopError> {
        self.submit_with_policy(task, false, true).await
    }

    async fn submit_with_policy(
        &self,
        task: Arc<dyn RuntimeSessionTask>,
        queue_if_busy: bool,
        replace_active: bool,
    ) -> Result<RuntimeSessionSubmission, RuntimeSessionLoopError> {
        if task.turn_id().trim().is_empty() {
            return Err(RuntimeSessionLoopError::InvalidTask(
                "runtime session task requires a canonical turn_id".to_string(),
            ));
        }
        match self
            .dispatch(RuntimeSessionOperationSubmission::new(
                RuntimeSessionOperation::StartTask {
                    task,
                    queue_if_busy,
                    replace_active,
                },
            ))
            .await?
        {
            RuntimeSessionOperationResult::Submission(submission) => Ok(submission),
            RuntimeSessionOperationResult::Accepted { .. }
            | RuntimeSessionOperationResult::Interrupted { .. } => {
                Err(RuntimeSessionLoopError::InvalidTask(
                    "runtime session submit returned an invalid operation result".to_string(),
                ))
            }
        }
    }

    pub async fn submit_user_input_with_metadata(
        &self,
        task: Arc<dyn RuntimeSessionTask>,
        input: Vec<RuntimeSessionInput>,
        queue_if_busy: bool,
        client_user_message_id: Option<String>,
        trace: Option<RuntimeSessionTraceContext>,
    ) -> Result<RuntimeSessionUserInputResult, RuntimeSessionLoopError> {
        match self
            .dispatch(RuntimeSessionOperationSubmission::with_metadata(
                RuntimeSessionOperation::UserInput {
                    expected_turn_id: None,
                    input,
                    task: Some(task),
                    queue_if_busy,
                },
                client_user_message_id,
                trace,
            ))
            .await?
        {
            RuntimeSessionOperationResult::Submission(submission) => {
                Ok(RuntimeSessionUserInputResult::Submitted(submission))
            }
            RuntimeSessionOperationResult::Accepted {
                id,
                turn_id: Some(turn_id),
            } => Ok(RuntimeSessionUserInputResult::Steered { id, turn_id }),
            RuntimeSessionOperationResult::Accepted { turn_id: None, .. }
            | RuntimeSessionOperationResult::Interrupted { .. } => {
                Err(RuntimeSessionLoopError::InvalidTask(
                    "runtime session user input returned an invalid operation result".to_string(),
                ))
            }
        }
    }

    /// Dispatch a typed operation through the session's single command queue.
    pub async fn dispatch(
        &self,
        submission: RuntimeSessionOperationSubmission,
    ) -> Result<RuntimeSessionOperationResult, RuntimeSessionLoopError> {
        validate_operation_submission(&submission)?;
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(RuntimeSessionCommand::Operation {
                submission,
                reply: reply_tx,
            })
            .await
            .map_err(|_| RuntimeSessionLoopError::Closed)?;
        reply_rx
            .await
            .map_err(|_| RuntimeSessionLoopError::Closed)?
    }

    pub async fn steer(
        &self,
        input: Vec<RuntimeSessionInput>,
    ) -> Result<(), RuntimeSessionLoopError> {
        self.steer_for_turn(None, input).await
    }

    pub async fn steer_for_turn(
        &self,
        expected_turn_id: Option<&str>,
        input: Vec<RuntimeSessionInput>,
    ) -> Result<(), RuntimeSessionLoopError> {
        self.steer_for_turn_id(expected_turn_id, input)
            .await
            .map(|_| ())
    }

    pub async fn steer_for_turn_id(
        &self,
        expected_turn_id: Option<&str>,
        input: Vec<RuntimeSessionInput>,
    ) -> Result<String, RuntimeSessionLoopError> {
        self.steer_for_turn_id_with_metadata(expected_turn_id, input, None, None)
            .await
    }

    pub async fn steer_for_turn_id_with_metadata(
        &self,
        expected_turn_id: Option<&str>,
        input: Vec<RuntimeSessionInput>,
        client_user_message_id: Option<String>,
        trace: Option<RuntimeSessionTraceContext>,
    ) -> Result<String, RuntimeSessionLoopError> {
        if input.is_empty() {
            return Err(RuntimeSessionLoopError::InvalidTask(
                "runtime session steer input must not be empty".to_string(),
            ));
        }
        match self
            .dispatch(RuntimeSessionOperationSubmission::with_metadata(
                RuntimeSessionOperation::UserInput {
                    expected_turn_id: expected_turn_id.map(str::to_string),
                    input,
                    task: None,
                    queue_if_busy: false,
                },
                client_user_message_id,
                trace,
            ))
            .await?
        {
            RuntimeSessionOperationResult::Accepted {
                turn_id: Some(turn_id),
                ..
            } => Ok(turn_id),
            RuntimeSessionOperationResult::Accepted { turn_id: None, .. } => {
                Err(RuntimeSessionLoopError::InvalidTask(
                    "runtime session steer result requires an active turn id".to_string(),
                ))
            }
            RuntimeSessionOperationResult::Submission(_)
            | RuntimeSessionOperationResult::Interrupted { .. } => {
                Err(RuntimeSessionLoopError::InvalidTask(
                    "runtime session steer returned an invalid operation result".to_string(),
                ))
            }
        }
    }

    pub async fn notify_inter_agent_communication(
        &self,
        input: RuntimeSessionInterAgentInput,
    ) -> Result<(), RuntimeSessionLoopError> {
        match self
            .dispatch(RuntimeSessionOperationSubmission::new(
                RuntimeSessionOperation::InterAgentCommunication { input },
            ))
            .await?
        {
            RuntimeSessionOperationResult::Accepted { .. } => Ok(()),
            RuntimeSessionOperationResult::Submission(_)
            | RuntimeSessionOperationResult::Interrupted { .. } => {
                Err(RuntimeSessionLoopError::InvalidTask(
                    "runtime session inter-agent communication returned an invalid operation result"
                        .to_string(),
                ))
            }
        }
    }

    pub async fn subscribe_input_activity(
        &self,
    ) -> Result<
        (
            watch::Receiver<super::RuntimeSessionInputActivity>,
            Option<super::RuntimeSessionInputActivity>,
        ),
        RuntimeSessionLoopError,
    > {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(RuntimeSessionCommand::SubscribeInputActivity { reply: reply_tx })
            .await
            .map_err(|_| RuntimeSessionLoopError::Closed)?;
        reply_rx.await.map_err(|_| RuntimeSessionLoopError::Closed)
    }

    pub async fn approve(
        &self,
        expected_turn_id: Option<&str>,
        request_id: impl Into<String>,
        response: Value,
    ) -> Result<(), RuntimeSessionLoopError> {
        self.dispatch_response(RuntimeSessionOperation::ApprovalResponse {
            expected_turn_id: expected_turn_id.map(str::to_string),
            request_id: request_id.into(),
            response,
        })
        .await
    }

    pub async fn answer_user_input(
        &self,
        expected_turn_id: Option<&str>,
        request_id: impl Into<String>,
        response: Value,
    ) -> Result<(), RuntimeSessionLoopError> {
        self.dispatch_response(RuntimeSessionOperation::UserInputResponse {
            expected_turn_id: expected_turn_id.map(str::to_string),
            request_id: request_id.into(),
            response,
        })
        .await
    }

    pub async fn respond_permission(
        &self,
        expected_turn_id: Option<&str>,
        request_id: impl Into<String>,
        response: Value,
    ) -> Result<(), RuntimeSessionLoopError> {
        self.dispatch_response(RuntimeSessionOp
```

### Core Architecture Module: `lime-rs/crates/agent-runtime/src/session_loop/input_queue.rs`
```
use super::resources::RuntimeSessionResources;
use super::{
    RuntimeSessionInterAgentInput, RuntimeSessionLoopError, RuntimeSessionStepContext,
    RuntimeSessionTaskFailure, RuntimeSessionTokenUsage, RuntimeSessionTraceContext,
};
use crate::reply_input::RuntimeReplyInput;
use futures::future::BoxFuture;
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::{oneshot, watch, Mutex};
use tokio_util::sync::CancellationToken;
#[derive(Clone, Debug)]
pub enum RuntimeSessionInput {
    User(RuntimeReplyInput),
    Developer(String),
    RawResponseItem(Value),
    InterAgent(RuntimeSessionInterAgentInput),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RuntimeSessionInputActivity {
    Mailbox,
    Steer,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RuntimeSessionTaskKind {
    Regular,
    Review,
    Compact,
    RunShell,
}

impl RuntimeSessionTaskKind {
    pub fn accepts_steer(self) -> bool {
        matches!(self, Self::Regular)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RuntimeSessionTaskOutcome {
    Completed,
    Interrupted,
    Replaced,
    Shutdown,
}
/// 控制当前 task 是否还允许把 session mailbox 合并到本回合。
///
/// 可见最终回答已经发出后，迟到的 mailbox 必须留给下一回合；显式 steer
/// 或工具续行会重新打开当前回合。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RuntimeSessionMailboxDeliveryPhase {
    CurrentTurn,
    NextTurn,
}

impl Default for RuntimeSessionMailboxDeliveryPhase {
    fn default() -> Self {
        Self::CurrentTurn
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum RuntimeSessionResponseKind {
    Approval,
    AskUser,
    Permission,
    DynamicTool,
    McpElicitation,
}

pub struct RuntimeSessionPendingResponse {
    receiver: Option<oneshot::Receiver<Value>>,
    state: Arc<RuntimeSessionTaskState>,
    key: (RuntimeSessionResponseKind, String),
}

impl RuntimeSessionPendingResponse {
    pub async fn wait(mut self) -> Result<Value, RuntimeSessionTaskFailure> {
        let result = self
            .receiver
            .as_mut()
            .expect("runtime session response receiver is consumed once")
            .await
            .map_err(|_| RuntimeSessionTaskFailure {
                message: "runtime session response waiter was canceled".to_string(),
                ..Default::default()
            });
        self.receiver.take();
        self.state.responses.lock().await.remove(&self.key);
        result
    }
}

impl Drop for RuntimeSessionPendingResponse {
    fn drop(&mut self) {
        if self.receiver.is_none() {
            return;
        }
        if let Ok(mut responses) = self.state.responses.try_lock() {
            responses.remove(&self.key);
            return;
        }
        let state = Arc::clone(&self.state);
        let key = self.key.clone();
        if let Ok(handle) = tokio::runtime::Handle::try_current() {
            handle.spawn(async move {
                state.responses.lock().await.remove(&key);
            });
        }
    }
}

/// A task executed by the session loop.
pub trait RuntimeSessionTask: Send + Sync + 'static {
    fn turn_id(&self) -> &str;

    fn kind(&self) -> RuntimeSessionTaskKind {
        RuntimeSessionTaskKind::Regular
    }

    fn initial_input(&self) -> Vec<RuntimeSessionInput> {
        Vec::new()
    }

    fn mailbox_loader(&self) -> Option<RuntimeSessionMailboxLoader> {
        None
    }

    fn run(
        self: Arc<Self>,
        context: RuntimeSessionTaskContext,
        input: Vec<RuntimeSessionInput>,
        cancellation_token: CancellationToken,
    ) -> BoxFuture<'static, Result<(), RuntimeSessionTaskFailure>>;

    fn abort(&self, _context: RuntimeSessionTaskContext) -> BoxFuture<'static, ()> {
        Box::pin(async {})
    }
}

#[derive(Clone)]
pub struct RuntimeSessionClosureTask {
    turn_id: String,
    kind: RuntimeSessionTaskKind,
    initial_input: Vec<RuntimeSessionInput>,
    mailbox_loader: Option<RuntimeSessionMailboxLoader>,
    run: Arc<
        dyn Fn(
                RuntimeSessionTaskContext,
                Vec<RuntimeSessionInput>,
                CancellationToken,
            ) -> BoxFuture<'static, Result<(), RuntimeSessionTaskFailure>>
            + Send
            + Sync,
    >,
    abort: Arc<dyn Fn(RuntimeSessionTaskContext) -> BoxFuture<'static, ()> + Send + Sync>,
}

impl RuntimeSessionClosureTask {
    pub fn new(
        turn_id: impl Into<String>,
        initial_input: Vec<RuntimeSessionInput>,
        run: impl Fn(
                RuntimeSessionTaskContext,
                Vec<RuntimeSessionInput>,
                CancellationToken,
            ) -> BoxFuture<'static, Result<(), RuntimeSessionTaskFailure>>
            + Send
            + Sync
            + 'static,
    ) -> Self {
        Self {
            turn_id: turn_id.into(),
            kind: RuntimeSessionTaskKind::Regular,
            initial_input,
            mailbox_loader: None,
            run: Arc::new(run),
            abort: Arc::new(|_context| Box::pin(async {})),
        }
    }

    pub fn with_kind(mut self, kind: RuntimeSessionTaskKind) -> Self {
        self.kind = kind;
        self
    }

    pub fn with_mailbox_loader(
        mut self,
        loader: impl Fn() -> BoxFuture<'static, Result<Vec<RuntimeSessionInput>, String>>
            + Send
            + Sync
            + 'static,
    ) -> Self {
        self.mailbox_loader = Some(Arc::new(loader));
        self
    }

    pub fn with_abort(
        mut self,
        abort: impl Fn(RuntimeSessionTaskContext) -> BoxFuture<'static, ()> + Send + Sync + 'static,
    ) -> Self {
        self.abort = Arc::new(abort);
        self
    }
}

impl RuntimeSessionTask for RuntimeSessionClosureTask {
    fn turn_id(&self) -> &str {
        &self.turn_id
    }

    fn kind(&self) -> RuntimeSessionTaskKind {
        self.kind
    }

    fn initial_input(&self) -> Vec<RuntimeSessionInput> {
        self.initial_input.clone()
    }

    fn mailbox_loader(&self) -> Option<RuntimeSessionMailboxLoader> {
        self.mailbox_loader.clone()
    }

    fn run(
        self: Arc<Self>,
        context: RuntimeSessionTaskContext,
        input: Vec<RuntimeSessionInput>,
        cancellation_token: CancellationToken,
    ) -> BoxFuture<'static, Result<(), RuntimeSessionTaskFailure>> {
        (self.run)(context, input, cancellation_token)
    }

    fn abort(&self, context: RuntimeSessionTaskContext) -> BoxFuture<'static, ()> {
        (self.abort)(context)
    }
}

#[derive(Clone)]
pub struct RuntimeSessionTaskContext {
    session_id: Arc<str>,
    turn_id: Arc<str>,
    kind: RuntimeSessionTaskKind,
    metadata: RuntimeSessionTaskMetadata,
    pending_input: Arc<PendingInputQueue>,
    mailbox_loader: Option<RuntimeSessionMailboxLoader>,
    resources: Arc<RuntimeSessionResources>,
    state: Arc<RuntimeSessionTaskState>,
}

#[derive(Clone)]
pub(super) struct RuntimeSessionTaskMetadata {
    submission_id: Arc<str>,
    client_user_message_id: Option<Arc<str>>,
    trace: Option<RuntimeSessionTraceContext>,
}

impl RuntimeSessionTaskMetadata {
    pub(super) fn new(
        submission_id: String,
        client_user_message_id: Option<String>,
        trace: Option<RuntimeSessionTraceContext>,
    ) -> Self {
        Self {
            submission_id: Arc::from(submission_id),
            client_user_message_id: client_user_message_id.map(Arc::from),
            trace,
        }
    }

    fn submission_id(&self) -> &str {
        &self.submission_id
    }

    fn client_user_message_id(&self) -> Option<&str> {
        self.client_user_message_id.as_deref()
    }

    fn trace(&self) -> Option<&RuntimeSessionTraceContext> {
        self.trace.as_ref()
    }
}

pub type RuntimeSessionMailboxLoader =
    Arc<dyn Fn() -> BoxFuture<'static, Result<Vec<RuntimeSessionInput>, String>> + Send + Sync>;

/// Session task 与 provider step 共享的输入视图。
///
/// 句柄只暴露当前 task 的 pending 输入，不允许调用方绕过 session actor
/// 直接替换活动 task 或清理队列。
#[derive(Clone)]
pub struct RuntimeSessionInputHandle {
    pub(super) session_id: Arc<str>,
    pub(super) pending_input: Arc<PendingInputQueue>,
    pub(super) turn_id: Arc<str>,
    pub(super) kind: RuntimeSessionTaskKind,
    pub(super) mailbox_loader: Option<RuntimeSessionMailboxLoader>,
    pub(super) resources: Arc<RuntimeSessionResources>,
    pub(super) state: Arc<RuntimeSessionTaskState>,
}

#[derive(Default)]
pub(super) struct RuntimeSessionTaskState {
    input: Mutex<RuntimeSessionTurnInputState>,
    step: Mutex<RuntimeSessionStepState>,
    responses: Mutex<HashMap<(RuntimeSessionResponseKind, String), oneshot::Sender<Value>>>,
}

#[derive(Default)]
struct RuntimeSessionTurnInputState {
    steer: VecDeque<RuntimeSessionInput>,
    mailbox_delivery_phase: RuntimeSessionMailboxDeliveryPhase,
    finishing: bool,
}

#[derive(Default)]
struct RuntimeSessionStepState {
    next_step_index: u64,
    context_epoch: u64,
    token_usage: RuntimeSessionTokenUsage,
    rollover_requested: bool,
}

impl RuntimeSessionTaskContext {
    pub(super) fn new(
        session_id: Arc<str>,
        turn_id: Arc<str>,
        kind: RuntimeSessionTaskKind,
        metadata: RuntimeSessionTaskMetadata,
        pending_input: Arc<PendingInputQueue>,
        mailbox_loader: Option<RuntimeSessionMailboxLoader>,
        resources: Arc<RuntimeSessionResources>,
        state: Arc<RuntimeSessionTaskState>,
    ) -> Self {
        Self {
            session_id,
            turn_id,
            kind,
            metadata,
            pending_input,
            mailbox_loader,
            resources,
            state,
        }
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn turn_id(&self) -> &str {
        &self.turn_id
    }

    pub fn thread_id(&self) -> &str {
        self.resources.thread_id()
    }

    pub fn code_mode_session(&self) -> Option<code_mode::RuntimeCodeModeSessionHandle> {
        self.resources.code_mode_session()
    }

    pub f
```

### Core Architecture Module: `lime-rs/crates/agent-runtime/src/session_loop/inter_agent.rs`
```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RuntimeSessionInterAgentDeliveryMode {
    QueueOnly,
    TriggerTurn,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RuntimeSessionInterAgentMessageKind {
    Message,
    Result,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RuntimeSessionInterAgentResultStatus {
    Completed,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RuntimeSessionInterAgentInput {
    pub message_id: String,
    pub root_thread_id: String,
    pub sender_thread_id: String,
    pub recipient_thread_id: String,
    pub content: String,
    pub kind: RuntimeSessionInterAgentMessageKind,
    pub source_turn_id: Option<String>,
    pub result_status: Option<RuntimeSessionInterAgentResultStatus>,
    pub delivery_mode: RuntimeSessionInterAgentDeliveryMode,
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #98** (2026-01-10): **fix: 优化 API 测试页面 URL 选择和状态管理**
  *Symptoms*: ## 问题描述  用户在 API 测试页面遇到以下问题： 1. curl 命令使用错误的 IP 地址（使用配置的局域网 IP 而不是本机地址） 2. 切换监听地址时，curl 命令不会实时更新 3. 切换 Provider 后，旧的测试结果仍然显示  ## 修复内容  ### 1. 智能 URL 选择 根据监听地址自动选择合适的测试 URL： - `127.0.0.1` → 使用 `127.0.0.1`（仅本机） - `0.0.0.0` → 使用 `127.0.0.1`（本机访问所有接口） - 局域网 IP → 使用该 IP（允许局域网测试）  ### 2. 实时更新测试 URL 使用 `editHost` 而不是 `status.host`，确保切换监听地址时 curl 命令立即更新  ### 3. 优化测试状态管理 - 切换 Provider 时保留测试结果（允许用户对比不同 Provider） - 切换功能 Tab 时才重置测试状态（保持界面整洁）  ## 测试结果  ✅ TypeScript 类型检查通过   ✅ ESLint 检查通过   ✅ 前端构建成功   ✅ Prettier 格式化通过   ✅ Rust 编译通过    ## 相关 Issue  修复用户反馈的 API 测试页面 URL 选择问题  ## 修改文件  - `src/components/api-server/ApiServerPage.tsx` 

- **Issue #97** (2026-01-10): **fix: 修复 Flow Monitor 响应内容显示和提供商显示问题 (#75)**
  *Symptoms*: # 修复 Flow Monitor 响应内容显示和提供商显示问题  ## 问题描述  修复 Issue #75：Flow Monitor 界面无法正确显示响应内容和提供商信息  ### 主要问题  1. **响应内容未显示**：在凭证池模式下，非流式响应的 `content` 和 `body` 字段没有被正确保存到 Flow Monitor 2. **提供商显示错误**：Flow Monitor 显示提供商为 "openai" 而不是实际的提供商名称（如 "DeepSeek"）  ## 修复内容  ### 1. 修复响应内容保存问题  **文件**: `src-tauri/src/server/handlers/api.rs`  - 在凭证池模式下正确提取响应体内容（第 1040-1210 行） - 解析 JSON 响应，提取 `content`、`tool_calls` 和 `usage` 信息 - 优先从 `content` 字段提取，如果为空则从 `tool_calls` 提取 - 提取并设置响应头到 `LLMResponse.headers` - 使用实际的 token 使用量而不是默认值  **根本原因**: - `build_llm_response` 被调用时传入空字符串 - `body` 字段被硬编码为 `serde_json::Value::Null` - 当响应包含 `tool_calls` 时，`content` 字段为空，实际内容在 `tool_calls[0].function.arguments` 中  ### 2. 修复提供商显示问题  **文件**:  - `src-tauri/src/flow_monitor/models.rs` - `src-tauri/src/server/handlers/api.rs` - `src/lib/api/flowMonitor.ts` - `src/components/flow-monitor/FlowDetail.tsx`  **修改内容**: - 在 `FlowMetadata` 结构体中添加 `provider_id: Option<String>` 字段 - 修改 `build_flow_metadata` 函数签名，添加 `provider_id` 参数 - 更新所有调用 `build_flow_metadata` 的地方，传入实际的 provider ID - 修改前端显示逻辑，优先显示 `provider_id` - 从凭证的 `name` 字段中提取 Provider 显示名称（去掉 "[降级] " 前缀）  **根本原因**: - `FlowMetadata.provider` 是 `ProviderType` 枚举，不包含具体的提供商 ID - "deepseek" 等提供商被解析为 `ProviderType::OpenAI`  ### 3. UI 优化  **清理完成弹窗** (`src/components/flow-monitor/CleanupDialog.tsx`): - 创建自定义成功提示 Modal 组件 - 添加动画成功图标（带圆环动画效果） - 使用渐变背景和图标卡片展示统计信息 - 区分不同类型信息（蓝色：删除记录，紫色：清理文件，绿色：释放空间） - 支持深色模式  **排序下拉框** (`src/components/flow-monitor/FlowList.tsx`): - 将原生 `<select>` 替换为 Radix 
  **Post-Mortem & Fix Analysis**:
  > ## 可能同时修复了 Issue #34  这个 PR 修复了凭证池模式下响应内容提取的问题，可能同时解决了 #34（88code 无法使用）的问题。  **修复内容**： - ✅ 正确从 JSON 响应中提取 `content` 字段 - ✅ 支持从 `tool_calls` 中提取内容 - ✅ 修复了 `body` 字段为 `null` 的问题 - ✅ 添加了 `provider_id` 字段用于正确识别提供商  如果 88code 服务通过 ProxyCast 代理请求时遇到响应内容丢失或格式问题，这个修复应该能够解决。  建议在合并后测试 88code 是否恢复正常，如果确认修复，可以关闭 #34。
  > 此 PR 同时修复了以下 Issues：  - Closes #75 - Flow Monitor 响应内容显示和提供商显示问题 - Closes #55 - 测试显示一切正常，但系统日志会显示空凭证，客户端返回的是空内容  两个问题的根本原因相同：在凭证池模式下，非流式响应的 `content` 和 `body` 字段没有被正确提取和保存。

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

### Incident Patch 1: `1236c5e9` (2026-10-05)
**Commit Message**: fix(release): open N-1 About page for Windows upgrade gate

**File**: `RELEASE_NOTES.en.md` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ Simplified Chinese release notes are the primary version.
 
 - Expanded TUI ChatWidget, history pagination, picker, queue, input, recovery, PTY, and structure-guard coverage, and refreshed Codex-alignment and structure inventories.
 - Added CLI/TUI Gate B coverage while continuing to reuse the App Server JSON-RPC and canonical Thread/Turn/Item facts.
+- Fixed the Windows N-1 upgrade gate to open the real Settings → About entry when the previous version has not started checking, while retaining download, restart installation, and version checks.
 - Release validation runs `npm run verify:app-version`, `npm run typecheck`, `npm run test:contracts`, focused Rust TUI tests, and `npm run verify:gui-smoke`; any failed gate is recorded in the release plan.
 
 ### Documentation
```

**File**: `RELEASE_NOTES.md` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@
 
 - 扩展 TUI ChatWidget、历史分页、选择器、队列、输入、恢复、PTY 和结构守卫测试，并更新 Codex 对齐与结构 inventory。
 - 补充 CLI/TUI Gate B 场景覆盖，继续复用 App Server JSON-RPC 与 canonical Thread/Turn/Item 事实源。
+- 修复 Windows N-1 升级门禁：在上一版本尚未检查更新时，通过真实“设置 → 关于”入口观察自动检查，保留下载、重启安装和版本匹配验证。
 - 发布验证执行 `npm run verify:app-version`、`npm run typecheck`、`npm run test:contracts`、Rust TUI 定向测试与 `npm run verify:gui-smoke`；未通过的门禁会在发布计划中记录。
 
 ### 文档
```

**File**: `internal/exec-plans/release-v1.150.0-plan.md` (modified, +23/-6)
```diff
@@ -1,7 +1,7 @@
 # Lime v1.150.0 发布执行计划
 
-状态：本地已发布，远端推送阻塞
-日期：2026-10-04
+状态：commit / tag 已推送，Windows Squirrel 安装门禁失败，GitHub Release 尚未公开
+日期：2026-10-05
 基线：`v1.149.0` / `2adeff44f`
 目标：将当前工作树中 v1.149.0 之后的 TUI/CLI ChatWidget、历史、交互、结构守卫、架构和执行计划改动作为 v1.150.0 release candidate，完成版本同步、发布说明、质量门禁和远端发布。
 
@@ -19,7 +19,8 @@
 - [x] `npm run test:contracts` 通过。
 - [x] TUI 全目标测试、strict Clippy、结构守卫、TUI Gate B 与 CLI Gate B 通过；`npm run verify:gui-smoke` 构建通过但 Electron smoke 因缺少结构化 `summary.json` 失败，已记录为 harness-blocked。
 - [x] release candidate staged 摘要复核，取得 git 写操作确认。
-- [x] 已创建 `Release v1.150.0` commit（`b34f89280`）与本地 `v1.150.0` tag；远端 `main` 与 tag 推送因凭据环境阻塞。
+- [x] 已创建并推送 `Release v1.150.0` commit（`b34f89280`）与 `v1.150.0` tag。
+- [ ] Release workflow 全部必要 job 通过，公开 GitHub Release 和安装 / CLI 产物。
 
 ## 架构确认
 
@@ -40,10 +41,26 @@
 
 ## 当前阻塞
 
-本机 Git 用户映射/凭据失败（`No user exists for uid 501`），`git push origin main` 与 `git push origin v1.150.0` 均失败；修复凭据后需继续推送并复核远端 SHA。GUI smoke 的结构化 summary 缺失也需发布流水线或 harness 修复后补证据。
+Git 的 `No user exists for uid 501` 已通过临时 libssh2 transport 恢复推送；本机 GitHub API 凭据仍不可用，公开 API 无法读取 Actions 日志或下载 evidence artifact。
+
+- Release run `37180108159` 和同一 tag / SHA 重触发的 run `37182748588` 均失败于 `Smoke installed Windows Squirrel candidate`；两个 macOS 构建均通过，最终 Electron / R2 / CLI 发布被跳过。
+- Windows smoke 实现与 workflow 相对 v1.149.0 没有变化，目前只有退出码 1，尚无已证实根因；不得跳过门禁或把重试成功当作根因修复。
+- 2026-10-05 创建隔离分支 `release-diagnostics-v1.150.0`，仅新增只读诊断 workflow，run `37253756162` 读取失败 run 的 Squirrel summary artifact，提取 failedStage / error / assertions。此诊断分支不修改 main、版本 tag 或本地工作区。
+- Tag 推送后出现的 TUI/MCP/approval 后续改动不属于已冻结的 release candidate，继续避让；恢复发布仅认领 release workflow / Windows smoke owner 与本计划。
+- 本地 GUI smoke 缺少结构化 summary，Desktop Gate B 仍需发布流水线补证据。
+
+## Windows 发布恢复（2026-10-05）
+
+- 只读诊断 run `37253756162` 成功读取 artifact，确认 `failedStage=n-minus-one-update`、`error=timed out waiting for N-1 automatic update check`。
+- 根因：v1.149.0 的 sidebar 重构移除 `AppUpdateEntry` 挂载，首页不再发起该检查；N-1 smoke 仍假定首页会自动离开 `idle`。当前“设置 → 关于”页面的 `AboutSection` 仍调用 `checkForUpdates({ automatic: true })`，updater owner 与协议未改变。
+- 修复：先观察 N-1 会话；仅在 `idle` 时通过 GUI 打开 settings/about。已经检查或下载时继续观察，不直接补发 native check、不合成完成态、不跳过 feed / 下载 / 安装 / SHELL-01 / 版本匹配门禁。同时把 failedStage / error 输出为 Actions annotation，后续无需下载私有日志即可定位失败。
+- 恢复写集：Windows smoke 主脚本、既有 N-1 helper、回归测试、release/updater 文档、本计划与双语 release notes。15 个后续 TUI/MCP/approval 文件明确排除，保持原始 release candidate 产品代码。
+- 回归：Windows smoke / packaged evidence / workflow guard / docs guard 四个测试文件 `88/88` 通过；`npm run verify:app-version`、`npm run typecheck`、`npm run test:contracts` 均通过。实际 Windows 平台验证由恢复后的 release run 给出，macOS 本地不冒充 Windows evidence。
+- 当前分类：Forge Squirrel、Electron built-in updater 与真实 GUI 升级门禁为 `current`；临时诊断 workflow 为诊断分支上的一次性 evidence，不进入 main 或 release tag；未新增 compat / deprecated 入口，未恢复 dead runtime。
+- 退出条件：将上述窄写集提交并推送 main，保持版本 `1.150.0` 将尚未公开的 release tag 指向修复提交，release workflow 必要平台门禁和 GitHub / CLI 发布成功，删除临时诊断分支并回写证据。
 
 ## 本地发布结果
 
 - commit：`b34f89280`（`Release v1.150.0`）
-- tag：本地 `v1.150.0` 已创建，指向 `b34f89280`
-- 远端：`origin/main` 与 `origin/v1.150.0` 尚未更新，待凭据环境恢复后重试。
+- tag：本地和远端 `v1.150.0` 均指向 `b34f89280`
+- 远端：`origin/main` 指向 `3d3a58b74`；release workflow 尚未通过，GitHub Release 为未公开状态。
```

**File**: `internal/roadmap/appserver/release-updater.md` (modified, +2/-0)
```diff
@@ -155,6 +155,8 @@ Renderer 仍通过既有命令名进入更新体验，但实现 owner 已切到
 
 开发态默认不启用真实 updater。只有显式设置 `LIME_ELECTRON_ENABLE_DEV_UPDATER=1` 时才允许在开发包里调用 Electron 内置 `autoUpdater`，避免开发环境误连生产 feed。
 
+Windows N-1 升级门禁从已安装的上一版本读取 updater 会话；若首页保持 `idle`，通过真实 GUI 打开“设置 → 关于”，观察该页面发起的自动检查。测试不得直接补发第二次 native check，仍须证明隔离候选 feed 的下载、重启安装和候选版本路径。
+
 `open_update_window` 允许 renderer 通过前端 gateway 传入侧边栏更新按钮的锚点矩形；Electron Host 只做参数投影和窗口定位，不承接后端业务事实。更新提醒窗口必须贴近侧栏更新入口上方，并保持透明独立窗口内只有一层实体 toast 表面，避免居中弹出或外层背景露出造成双层弹窗观感。
 
 ## 6. 平稳迁移要求
```

**File**: `scripts/electron/lib/windows-squirrel-n-minus-one.mjs` (modified, +25/-14)
```diff
@@ -195,6 +195,30 @@ export async function findReadyElectronUpdaterPage(pages) {
   return null;
 }
 
+export async function waitForNMinusOneAutomaticUpdate(
+  page,
+  { timeoutMs = 60_000 } = {},
+) {
+  const readSession = () =>
+    page
+      .evaluate(() => window.electronAPI.invoke("get_update_install_session"))
+      .catch(() => null);
+  const session = await waitFor(readSession, {
+    label: "N-1 update session",
+    timeoutMs,
+  });
+  if (session.stage === "idle") {
+    await page.getByTestId("app-sidebar-nav-settings").click();
+    await page.getByTestId("settings-sidebar-tab-about").click();
+  }
+  return await waitFor(readSession, {
+    accept: (value) => Boolean(value && value.stage !== "idle"),
+    label: "N-1 automatic update check",
+    timeoutMs,
+    intervalMs: 250,
+  });
+}
+
 export function buildStopInstalledAppScript() {
   const matchingProcesses =
     "@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and [String]::Equals([System.IO.Path]::GetFullPath($_.ExecutablePath), $target, [StringComparison]::OrdinalIgnoreCase) })";
@@ -510,20 +534,7 @@ export async function exerciseNMinusOneUpdate({
       { label: "N-1 Electron updater bridge", timeoutMs: 60_000 },
     );
 
-    const initialSession = await waitFor(
-      () =>
-        page
-          .evaluate(() =>
-            window.electronAPI.invoke("get_update_install_session"),
-          )
-          .catch(() => null),
-      {
-        accept: (session) => Boolean(session && session.stage !== "idle"),
-        label: "N-1 automatic update check",
-        timeoutMs: 60_000,
-        intervalMs: 250,
-      },
-    );
+    const initialSession = await waitForNMinusOneAutomaticUpdate(page);
     if (
       !["checking", "downloading", "completed", "failed"].includes(
         initialSession.stage,
```

**File**: `scripts/electron/windows-squirrel-rc-smoke.mjs` (modified, +13/-0)
```diff
@@ -31,6 +31,7 @@ import {
   selectNMinusOneVersion,
   stopInstalledApp,
   uninstallInstalledSquirrel,
+  waitForNMinusOneAutomaticUpdate,
   waitForWindowsProcessExit,
 } from "./lib/windows-squirrel-n-minus-one.mjs";
 import {
@@ -52,6 +53,7 @@ export {
   selectNMinusOneVersion,
   stopInstalledApp,
   uninstallInstalledSquirrel,
+  waitForNMinusOneAutomaticUpdate,
   waitForWindowsProcessExit,
 };
 
@@ -261,6 +263,7 @@ export async function cleanupFromSummary(summaryPath) {
     `[windows-squirrel-rc-cleanup] result=${summary.result} stage=${summary.failedStage || "complete"} summary=${absoluteSummaryPath}`,
   );
   if (summary.result !== "pass") {
+    logWindowsRcFailure(summary);
     process.exitCode = 1;
   }
 }
@@ -540,10 +543,20 @@ async function main() {
     `[windows-squirrel-rc] result=${summary.result} stage=${summary.failedStage || "complete"} summary=${summaryPath}`,
   );
   if (summary.result !== "pass") {
+    logWindowsRcFailure(summary);
     process.exitCode = 1;
   }
 }
 
+function logWindowsRcFailure(summary) {
+  const diagnostic =
+    `stage=${summary.failedStage}; ${summary.error || summary.assertions.failed.join(", ")}`
+      .replaceAll("%", "%25")
+      .replaceAll("\r", "%0D")
+      .replaceAll("\n", "%0A");
+  console.error(`::error title=Windows Squirrel RC::${diagnostic}`);
+}
+
 function parseArgs(argv) {
   const args = {};
   for (let index = 0; index < argv.length; index += 1) {
```

**File**: `scripts/electron/windows-squirrel-rc-smoke.test.mjs` (modified, +57/-1)
```diff
@@ -22,6 +22,7 @@ import {
   selectSquirrelInstaller,
   stopInstalledApp,
   uninstallInstalledSquirrel,
+  waitForNMinusOneAutomaticUpdate,
   waitForWindowsProcessExit,
 } from "./windows-squirrel-rc-smoke.mjs";
 
@@ -368,14 +369,69 @@ describe("Windows Squirrel RC smoke", () => {
     ).rejects.toThrow("Squirrel uninstall exited with 1");
   });
 
+  it("N-1 首页尚未检查时，从关于页面启动真实自动更新检查", async () => {
+    const checking = { stage: "checking", currentVersion: "1.149.0" };
+    const settingsClick = vi.fn().mockResolvedValue(undefined);
+    const aboutClick = vi.fn().mockResolvedValue(undefined);
+    const page = {
+      evaluate: vi
+        .fn()
+        .mockResolvedValueOnce({ stage: "idle" })
+        .mockResolvedValue(checking),
+      getByTestId: vi.fn((id) => ({
+        click: id === "app-sidebar-nav-settings" ? settingsClick : aboutClick,
+      })),
+    };
+
+    await expect(waitForNMinusOneAutomaticUpdate(page)).resolves.toEqual(
+      checking,
+    );
+    expect(page.getByTestId.mock.calls).toEqual([
+      ["app-sidebar-nav-settings"],
+      ["settings-sidebar-tab-about"],
+    ]);
+    expect(settingsClick.mock.invocationCallOrder[0]).toBeLessThan(
+      aboutClick.mock.invocationCallOrder[0],
+    );
+  });
+
+  it("N-1 已开始检查时只观察会话，不重复打开入口", async () => {
+    const downloaded = { stage: "completed", latestVersion: "1.150.0" };
+    const page = {
+      evaluate: vi
+        .fn()
+        .mockResolvedValueOnce({ stage: "checking" })
+        .mockResolvedValue(downloaded),
+      getByTestId: vi.fn(),
+    };
+
+    await expect(waitForNMinusOneAutomaticUpdate(page)).resolves.toEqual(
+      downloaded,
+    );
+    expect(page.getByTestId).not.toHaveBeenCalled();
+  });
+
+  it("关于页面未启动检查时仍失败，不伪造非 idle 会话", async () => {
+    const page = {
+      evaluate: vi.fn().mockResolvedValue({ stage: "idle" }),
+      getByTestId: vi.fn(() => ({
+        click: vi.fn().mockResolvedValue(undefined),
+      })),
+    };
+
+    await expect(
+      waitForNMinusOneAutomaticUpdate(page, { timeoutMs: 1 }),
+    ).rejects.toThrow("timed out waiting for N-1 automatic update check");
+  });
+
   it("N-1 更新应观察应用自动检查且不得主动触发第二次 native check", () => {
     const source = fs.readFileSync(
       "scripts/electron/lib/windows-squirrel-n-minus-one.mjs",
       "utf8",
     );
 
     expect(source).toContain('label: "N-1 automatic update check"');
-    expect(source).toContain('session.stage !== "idle"');
+    expect(source).toContain('value.stage !== "idle"');
     expect(source).not.toContain(
       'window.electronAPI.invoke("check_for_updates")',
     );
```

---

### Incident Patch 2: `2adeff44` (2026-10-02)
**Commit Message**: Fix packaged settings smoke navigation

**File**: `internal/exec-plans/release-v1.149.0-plan.md` (modified, +9/-0)
```diff
@@ -24,3 +24,12 @@
 ## 架构确认
 
 主链保持 `Product Surface -> App Server JSON-RPC -> RuntimeCore -> canonical Thread/Turn/Item -> GUI/terminal projection`。本候选的 TUI ChatWidget owner 收敛与 GUI 侧栏拆分未新增平行 runtime、协议后端或兼容层；责任开发者 root，2026-10-02。
+
+## 发布后 CI 修复
+
+首轮 GitHub Actions release run `36951843849` 在 macOS arm64/x64 的 packaged Gate B
+因共享 `openSettings()` 仍等待已移除的 `[data-testid="app-sidebar-account-button"]`
+失败；Windows 构建通过。修复提交 `5e11b1788` 让该入口优先使用当前
+`[data-testid="app-sidebar-nav-settings"]`，并保留旧账号菜单回退，定向 fixture、Electron
+entrypoint 与 release workflow guard 已通过。待修复提交推送后重跑同一版本的 release workflow，
+确认两种 macOS 架构、Electron 资产发布和 GitHub Release 均成功。
```

**File**: `scripts/electron/mcp-config-fixture-smoke.mjs` (modified, +30/-22)
```diff
@@ -289,31 +289,39 @@ export async function openMcpConfigSettings(page, options) {
 }
 
 export async function openSettings(page, options) {
-  await page.locator('[data-testid="app-sidebar-account-button"]').click();
-  await page.locator('[data-testid="app-sidebar-account-menu"]').waitFor({
-    state: "visible",
-    timeout: Math.min(30_000, options.timeoutMs),
-  });
+  const settingsNav = page.locator('[data-testid="app-sidebar-nav-settings"]');
+  if (
+    (await settingsNav.count()) > 0 &&
+    (await settingsNav.first().isVisible())
+  ) {
+    await settingsNav.first().click();
+  } else {
+    await page.locator('[data-testid="app-sidebar-account-button"]').click();
+    await page.locator('[data-testid="app-sidebar-account-menu"]').waitFor({
+      state: "visible",
+      timeout: Math.min(30_000, options.timeoutMs),
+    });
 
-  const clicked = await page.evaluate(() => {
-    const menu = document.querySelector(
-      '[data-testid="app-sidebar-account-menu"]',
-    );
-    const buttons = Array.from(menu?.querySelectorAll("button") ?? []);
-    const target = buttons.find((button) => {
-      const text = button.textContent || "";
-      const aria = button.getAttribute("aria-label") || "";
-      return /模型设置|AI 服务商|AI Providers|Model Settings/.test(
-        `${text}\n${aria}`,
+    const clicked = await page.evaluate(() => {
+      const menu = document.querySelector(
+        '[data-testid="app-sidebar-account-menu"]',
       );
+      const buttons = Array.from(menu?.querySelectorAll("button") ?? []);
+      const target = buttons.find((button) => {
+        const text = button.textContent || "";
+        const aria = button.getAttribute("aria-label") || "";
+        return /模型设置|AI 服务商|AI Providers|Model Settings/.test(
+          `${text}\n${aria}`,
+        );
+      });
+      if (!(target instanceof HTMLButtonElement)) {
+        return false;
+      }
+      target.click();
+      return true;
     });
-    if (!(target instanceof HTMLButtonElement)) {
-      return false;
-    }
-    target.click();
-    return true;
-  });
-  assert(clicked, "未找到账号菜单里的模型设置入口");
+    assert(clicked, "未找到账号菜单里的模型设置入口");
+  }
 
   await page.locator('[data-testid="settings-top-header"]').waitFor({
     state: "visible",
```

**File**: `scripts/electron/mcp-config-fixture-smoke.test.mjs` (modified, +9/-0)
```diff
@@ -68,6 +68,15 @@ describe("MCP config Electron fixture smoke guard", () => {
     expect(content).not.toContain("invokeMockOnly");
   });
 
+  it("opens settings through the current sidebar rail before the legacy account fallback", () => {
+    const content = readSmokeScript();
+
+    expect(content).toContain('[data-testid="app-sidebar-nav-settings"]');
+    expect(content).toContain("settingsNav.first().isVisible()");
+    expect(content).toContain('[data-testid="app-sidebar-account-button"]');
+    expect(content).toContain('[data-testid="app-sidebar-account-menu"]');
+  });
+
   it("writes same-run SETTINGS scenario evidence without relabeling", () => {
     const content = readSmokeScript();
     const evidenceCore = readEvidenceCore();
```

---

### Incident Patch 3: `faa8be40` (2026-09-30)
**Commit Message**: fix(governance): register TUI history test fixture

**File**: `internal/exec-plans/release-v1.147.0-plan.md` (modified, +11/-3)
```diff
@@ -1,6 +1,6 @@
 # Lime v1.147.0 发布执行计划
 
-状态：全部候选已获递交授权，本机门禁通过，执行发布提交与远端流水线
+状态：183 文件发布提交和 main/tag 推送完成；远端打包与分发进行中
 日期：2026-09-30
 目标：将全部当前未提交/未跟踪候选发布为 `v1.147.0`，完成 commit、tag、main/tag 推送与远端 Actions/Release/npm 复核。
 
@@ -39,8 +39,10 @@
 - [x] 最终完整 TUI PTY Gate B：thread `01a0f2df-7413-7be1-9157-fcb9b2aa8e7d`、turn `turn_5f90cbe039074ccc862a38d09dee5f9a`；complete/approval/user-input/interrupt/failure/queue-edit/agents-overview、focus-palette/resize-reflow/reconnect 和 terminal restore 通过。
 - [x] workspace fmt 与 `git diff --check`；新增 PTY suggestions 文件格式已修复。
 - [x] git 写操作和全部候选递交授权。
-- [ ] `Release v1.147.0` commit、`v1.147.0` tag、main/tag 推送及远端引用复核。
-- [ ] GitHub Actions、Release 资产、npm registry 复核。
+- [x] `Release v1.147.0` commit `1cbc94e5f7f00b58f0580fafab1b202fdf4e9d0c`，183 文件；轻量 tag `v1.147.0` 与 main 已分别推送，远端两引用一致；提交 hook `182` 通过、`0` 失败。
+- [x] Release run `36735313925` 已启动，GitHub draft 已创建，三个 Electron 平台构建中；Docs run `36735269856` 成功。
+- [ ] GitHub Release 公开资产、updater 和 npm registry 最终复核。
+- [ ] Quality run `36735269701`：Frontend Full 在批次 `56/119` 因既有 fixture 未登记失败，Rust/GUI/Windows job 尚在运行，不能声明全量 CI 通过。
 
 ## 修复与限制
 
@@ -50,6 +52,12 @@
 
 Rust 构建使用仓库 rusty-v8 artifact resolver 的已校验缓存，未修改系统环境变量或依赖。App Server 保留既有两处 dead-code warning；本轮不宣称全量 lint/Vitest/Cargo/Clippy 矩阵通过。跨平台 Forge、Windows 真机、签名/公证与 npm 分发由 GitHub runner 验证。
 
+## 发布后的定向修复
+
+远端 Frontend Full 的唯一已知失败为 `scripts/app-server/tui-history-pagination-fixture.mjs` 未登记在 ExternalBackend 测试夹具允许清单。该 fixture、测试与 support 在 `v1.146.0..v1.147.0` diff 为空，是既有守卫漏登记。检查确认 fixture 使用隔离临时 app data、受控 backend 和真实 CLI/App Server，不属于生产默认入口。
+
+本轮补 `src/lib/governance/appServerRuntimeBoundary.testSupport.ts` 的精确允许路径，保留全目录扫描与生产 Runtime 默认断言；失败守卫定向 `2/2` 和 `npm run typecheck` 通过。作为 main 的独立测试修复提交，保持发布 tag 原提交，不宣称旧 tag 的 Quality run 已通过。推送后并发会话开始的下一项 request-user-input 改造属于发布后工作，保留其工作树，不覆盖、不并入本次标签。
+
 ## 架构与分类
 
 主链保持 `Desktop Host / CLI-TUI Host -> App Server JSON-RPC -> RuntimeCore -> canonical Thread/Turn/Item -> GUI/terminal projection`。MCP OAuth 扩展仍归既有 protocol/App Server/MCP credential owner；新增 TUI helper 是 presentation 内部分工，没有平行 runtime/history store 或新的 public boundary。本次无重大架构变更。
```

**File**: `src/lib/governance/appServerRuntimeBoundary.testSupport.ts` (modified, +1/-0)
```diff
@@ -197,6 +197,7 @@ export const ALLOWED_EXTERNAL_BACKEND_LAUNCH_FILES = new Set([
   "scripts/agent-runtime/tool-execution-smoke.test.mjs",
   "scripts/app-server/external-backend-smoke.mjs",
   "scripts/app-server/packaged-external-backend-failure-smoke.mjs",
+  "scripts/app-server/tui-history-pagination-fixture.mjs",
   "scripts/check-app-server-client-contract.mjs",
   "scripts/check-command-contracts.mjs",
   "scripts/electron/codex-import-click-through-fixture-smoke.mjs",
```

---

### Incident Patch 4: `a123afaf` (2026-09-26)
**Commit Message**: fix(release): make Windows Squirrel app stop idempotent

**File**: `scripts/electron/lib/windows-squirrel-n-minus-one.mjs` (modified, +33/-8)
```diff
@@ -195,26 +195,51 @@ export async function findReadyElectronUpdaterPage(pages) {
   return null;
 }
 
-export async function stopInstalledApp(executable) {
-  const script = [
+export function buildStopInstalledAppScript() {
+  const matchingProcesses =
+    "@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and [String]::Equals([System.IO.Path]::GetFullPath($_.ExecutablePath), $target, [StringComparison]::OrdinalIgnoreCase) })";
+  return [
+    "$ErrorActionPreference = 'Stop'",
     "$target = [System.IO.Path]::GetFullPath($env:LIME_TARGET_EXECUTABLE)",
-    "$processes = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and [String]::Equals([System.IO.Path]::GetFullPath($_.ExecutablePath), $target, [StringComparison]::OrdinalIgnoreCase) })",
-    "$processes | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop }",
+    `$processes = ${matchingProcesses}`,
+    "$processes | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch { if ($_.FullyQualifiedErrorId -notmatch '^NoProcessFoundForGivenId(?:,|$)') { throw } } }",
     'Write-Output "stopped=$($processes.Count)"',
   ].join("; ");
-  const result = await runProcess(
+}
+
+export async function stopInstalledApp(
+  executable,
+  {
+    runProcessImpl = runProcess,
+    waitForProcessExitImpl = waitForWindowsProcessExit,
+    timeoutMs = 30_000,
+  } = {},
+) {
+  const result = await runProcessImpl(
     "powershell.exe",
-    ["-NoProfile", "-NonInteractive", "-Command", script],
+    [
+      "-NoProfile",
+      "-NonInteractive",
+      "-Command",
+      buildStopInstalledAppScript(),
+    ],
     {
-      env: { ...process.env, LIME_TARGET_EXECUTABLE: executable },
-      timeoutMs: 30_000,
+      env: {
+        ...process.env,
+        LIME_TARGET_EXECUTABLE: executable,
+      },
+      timeoutMs,
     },
   );
   if (result.exitCode !== 0) {
     throw new Error(
       `failed to stop installed app at ${executable}: exit ${result.exitCode}`,
     );
   }
+  await waitForProcessExitImpl(executable, {
+    runProcessImpl,
+    timeoutMs,
+  });
   return { executable, exitCode: result.exitCode };
 }
 
```

**File**: `scripts/electron/windows-squirrel-rc-smoke.mjs` (modified, +3/-0)
```diff
@@ -18,6 +18,7 @@ import process from "node:process";
 import { fileURLToPath } from "node:url";
 import {
   buildNMinusOneLaunchEnv,
+  buildStopInstalledAppScript,
   buildWaitForWindowsProcessExitScript,
   classifySquirrelUninstallResult,
   compareVersions,
@@ -39,6 +40,7 @@ import {
 
 export {
   buildNMinusOneLaunchEnv,
+  buildStopInstalledAppScript,
   buildWaitForWindowsProcessExitScript,
   classifySquirrelUninstallResult,
   compareVersions,
@@ -48,6 +50,7 @@ export {
   resolveInstalledSquirrelPaths,
   resolveSquirrelFeed,
   selectNMinusOneVersion,
+  stopInstalledApp,
   uninstallInstalledSquirrel,
   waitForWindowsProcessExit,
 };
```

**File**: `scripts/electron/windows-squirrel-rc-smoke.test.mjs` (modified, +45/-0)
```diff
@@ -7,6 +7,7 @@ import YAML from "yaml";
 
 import {
   buildNMinusOneLaunchEnv,
+  buildStopInstalledAppScript,
   buildWaitForWindowsProcessExitScript,
   buildWindowsRcSummary,
   cleanupFromSummary,
@@ -19,6 +20,7 @@ import {
   resolveSquirrelFeed,
   selectNMinusOneVersion,
   selectSquirrelInstaller,
+  stopInstalledApp,
   uninstallInstalledSquirrel,
   waitForWindowsProcessExit,
 } from "./windows-squirrel-rc-smoke.mjs";
@@ -160,6 +162,49 @@ describe("Windows Squirrel RC smoke", () => {
     );
   });
 
+  it("停止已退出的应用时忽略 PID 竞态，但保留其他 Stop-Process 错误", async () => {
+    const script = buildStopInstalledAppScript();
+    expect(script).toContain("NoProcessFoundForGivenId");
+    expect(script).toContain("FullyQualifiedErrorId");
+    expect(script).toContain("throw");
+
+    const runProcessImpl = vi.fn().mockResolvedValue({ exitCode: 0 });
+    const waitForProcessExitImpl = vi.fn().mockResolvedValue({
+      executable: "C:\\runner\\Lime.exe",
+      exitCode: 0,
+      timeoutMs: 30_000,
+    });
+
+    await expect(
+      stopInstalledApp("C:\\runner\\Lime.exe", {
+        runProcessImpl,
+        waitForProcessExitImpl,
+      }),
+    ).resolves.toEqual({
+      executable: "C:\\runner\\Lime.exe",
+      exitCode: 0,
+    });
+    expect(runProcessImpl).toHaveBeenCalledWith(
+      "powershell.exe",
+      [
+        "-NoProfile",
+        "-NonInteractive",
+        "-Command",
+        script,
+      ],
+      expect.objectContaining({
+        env: expect.objectContaining({
+          LIME_TARGET_EXECUTABLE: "C:\\runner\\Lime.exe",
+        }),
+        timeoutMs: 30_000,
+      }),
+    );
+    expect(waitForProcessExitImpl).toHaveBeenCalledWith(
+      "C:\\runner\\Lime.exe",
+      { runProcessImpl, timeoutMs: 30_000 },
+    );
+  });
+
   it("卸载只操作候选 Update.exe，并等待安装目录与快捷方式消失", async () => {
     const updateExecutable =
       "C:\\Users\\runner\\AppData\\Local\\lime\\Update.exe";
```

---

### Incident Patch 5: `2a0a30de` (2026-09-14)
**Commit Message**: fix(release): pass npm token to publish job

**File**: `.github/workflows/release.yml` (modified, +2/-0)
```diff
@@ -1022,6 +1022,8 @@ jobs:
     needs: publish_cli_assets
     if: needs.publish_cli_assets.result == 'success'
     runs-on: ubuntu-22.04
+    env:
+      NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
     permissions:
       contents: write
       id-token: write
```

---

### Incident Patch 6: `454da1ac` (2026-09-14)
**Commit Message**: fix(cli): resolve npm platform packages directly

**File**: `packages/cli/scripts/build_npm_package.py` (modified, +4/-4)
```diff
@@ -13,8 +13,8 @@
 CLI_ROOT = SCRIPT_DIR.parent
 NPM_NAME = "@limecloud/lime"
 
-# Alias names are resolved by bin/lime.js. Every platform tarball is published
-# under NPM_NAME with a unique version suffix, matching the Codex npm layout.
+# Platform package names are resolved by bin/lime.js. Every platform tarball is
+# published under its own name with a unique version suffix.
 PLATFORM_PACKAGES: dict[str, dict[str, str]] = {
     "lime-linux-x64": {
         "npm_name": "@limecloud/lime-linux-x64",
@@ -122,8 +122,8 @@ def stage_sources(staging_dir: Path, version: str, package: str) -> None:
         package_json["files"] = ["bin/lime.js"]
         package_json.pop("scripts", None)
         package_json["optionalDependencies"] = {
-            config["npm_name"]: (
-                f"npm:{NPM_NAME}@{compute_platform_package_version(version, config['npm_tag'])}"
+            config["npm_name"]: compute_platform_package_version(
+                version, config["npm_tag"]
             )
             for config in PLATFORM_PACKAGES.values()
         }
```

**File**: `packages/cli/tests/npm-package.test.mjs` (modified, +5/-5)
```diff
@@ -233,7 +233,7 @@ test(
   },
 );
 
-test("staging creates Lime root aliases and a real npm tarball", (t) => {
+test("staging creates Lime root platform dependencies and a real npm tarball", (t) => {
   const root = mkdtempSync(path.join(os.tmpdir(), "lime-npm-stage-test-"));
   t.after(() => rmSync(root, { recursive: true, force: true }));
   const staging = path.join(root, "root-package");
@@ -262,10 +262,10 @@ test("staging creates Lime root aliases and a real npm tarball", (t) => {
   assert.equal(packageJson.packageManager, "pnpm@9.15.9");
   assert.equal(packageJson.scripts, undefined);
   assert.deepEqual(packageJson.optionalDependencies, {
-    "@limecloud/lime-linux-x64": "npm:@limecloud/lime@1.2.3-linux-x64",
-    "@limecloud/lime-darwin-x64": "npm:@limecloud/lime@1.2.3-darwin-x64",
-    "@limecloud/lime-darwin-arm64": "npm:@limecloud/lime@1.2.3-darwin-arm64",
-    "@limecloud/lime-win32-x64": "npm:@limecloud/lime@1.2.3-win32-x64",
+    "@limecloud/lime-linux-x64": "1.2.3-linux-x64",
+    "@limecloud/lime-darwin-x64": "1.2.3-darwin-x64",
+    "@limecloud/lime-darwin-arm64": "1.2.3-darwin-arm64",
+    "@limecloud/lime-win32-x64": "1.2.3-win32-x64",
   });
   assert.ok(existsSync(tarball));
 });
```

**File**: `scripts/governance/cli-boundary.mjs` (modified, +2/-2)
```diff
@@ -119,7 +119,7 @@ export function checkCliBoundary(repoRoot = process.cwd()) {
   }
   if (npmPackage.os || npmPackage.cpu) {
     failures.push(
-      "CLI npm root package must delegate platform filters to aliases",
+      "CLI npm root package must delegate platform filters to optional dependencies",
     );
   }
   if (
@@ -172,7 +172,7 @@ export function checkCliBoundary(repoRoot = process.cwd()) {
     '"lime-darwin-x64"',
     '"lime-darwin-arm64"',
     '"lime-win32-x64"',
-    'f"npm:{NPM_NAME}@{compute_platform_package_version',
+    'config["npm_name"]: compute_platform_package_version',
     'f"app-server{suffix}"',
     'f"code-mode-host{suffix}"',
     '"windows-sandbox-setup.exe"',
```

---

### Incident Patch 7: `0f135a72` (2026-09-14)
**Commit Message**: fix(cli): publish platform packages under distinct names

**File**: `packages/cli/scripts/build_npm_package.py` (modified, +1/-1)
```diff
@@ -130,7 +130,7 @@ def stage_sources(staging_dir: Path, version: str, package: str) -> None:
     else:
         platform = PLATFORM_PACKAGES[package]
         package_json = {
-            "name": NPM_NAME,
+            "name": platform["npm_name"],
             "version": compute_platform_package_version(version, platform["npm_tag"]),
             "description": root_package_json.get("description"),
             "license": root_package_json.get("license", "MIT"),
```

**File**: `packages/cli/tests/npm-package.test.mjs` (modified, +1/-1)
```diff
@@ -309,7 +309,7 @@ test("platform staging requires the complete App Server runtime payload", (t) =>
   const packageJson = JSON.parse(
     readFileSync(path.join(staging, "package.json"), "utf8"),
   );
-  assert.equal(packageJson.name, "@limecloud/lime");
+  assert.equal(packageJson.name, "@limecloud/lime-darwin-arm64");
   assert.equal(packageJson.version, "1.2.3-darwin-arm64");
   assert.deepEqual(packageJson.os, ["darwin"]);
   assert.deepEqual(packageJson.cpu, ["arm64"]);
```

---

### Incident Patch 8: `580022b5` (2026-09-14)
**Commit Message**: fix(release): stabilize CLI V8 and Linux dependencies

**File**: `.github/workflows/release.yml` (modified, +10/-2)
```diff
@@ -866,7 +866,7 @@ jobs:
         shell: bash
         run: |
           sudo apt-get update
-          sudo apt-get install -y pkg-config libasound2-dev
+          sudo apt-get install -y pkg-config libasound2-dev libxdo-dev
 
       - name: Setup Rust
         uses: dtolnay/rust-toolchain@e081816240890017053eacbb1bdf337761dc5582 # 1.95.0
@@ -894,7 +894,15 @@ jobs:
         shell: bash
         run: |
           node scripts/lib/rusty-v8-artifacts.mjs --github-env
-          cargo clean --manifest-path lime-rs/Cargo.toml -p v8
+          # The CLI payload is built with the release profile. Clear the matching
+          # target-specific V8 fingerprint so cached build-script output cannot
+          # reference a missing gn_out static archive.
+          CARGO_TARGET_DIR="${{ github.workspace }}/lime-rs/target" \
+            cargo clean \
+              --manifest-path lime-rs/Cargo.toml \
+              --package v8 \
+              --release \
+              --target "${{ matrix.target }}"
 
       - name: Prepare CLI sherpa-onnx runtime
         if: matrix.target != 'x86_64-unknown-linux-gnu'
```

---

### Incident Patch 9: `933fbfa6` (2026-09-06)
**Commit Message**: fix(ci): allow Rust full matrix to finish

**File**: `.github/workflows/quality.yml` (modified, +1/-1)
```diff
@@ -280,7 +280,7 @@ jobs:
   rust_full:
     name: Rust Full
     runs-on: macos-latest
-    timeout-minutes: 30
+    timeout-minutes: 60
     needs: changed
     if: ${{ (github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.changed.outputs.docs_only != 'true') || github.event_name == 'workflow_dispatch' }}
     steps:
```

**File**: `internal/exec-plans/release-v1.141.0-plan.md` (modified, +15/-0)
```diff
@@ -168,3 +168,18 @@ timeout、目录创建与 Agent Plugin MCP parity；该 run 仍因修复前的 F
 
 现有 `v1.141.0` 本地与远端 tag 均继续指向 `5a7fe5af9`；本轮只追加 main 修复，不删除、覆盖
 或重建既有 tag。退出条件仍为新修复提交推送后 Quality 全绿，并完成远端 main 状态复核。
+
+### 第四轮 Quality 门禁超时修复
+
+修复提交 `9714bb18d` 推送后，延迟触发的 push run `34014522753` 与手动 dispatch run
+`34014175236` 均确认 Frontend Full、GUI Smoke 和 Integrity 通过，手动 run 还确认 Bridge &
+Contracts 通过。两个独立 runner 的 Rust Full 都没有测试失败，而是在 job 启动满 `30m` 时由
+GitHub Actions 取消 `Test Rust workspace`，annotation 明确为
+`The job has exceeded the maximum execution time of 30m0s`。这说明 workspace 全量规模已超过旧
+超时预算，继续重跑同一配置无法得到真实测试终态。
+
+本轮将 Rust Full job 上限从 `30m` 调整为 `60m`，与 Windows Shell Runtime 的完整矩阵预算
+一致；不改变测试命令、测试选择或失败语义。现有 workflow contract 已保护 Rust Full 的 V8
+artifact 准备顺序，本次无需扩展协议或 bridge surface。退出条件仍是新提交触发的 Rust Full
+取得真实成功终态，并与 Frontend Full、GUI Smoke、Integrity、Windows Shell Runtime 汇总为
+Quality 全绿。
```

---

### Incident Patch 10: `9714bb18` (2026-09-06)
**Commit Message**: fix(release): stabilize v1.141.0 quality gates

**File**: `internal/exec-plans/release-v1.141.0-plan.md` (modified, +31/-0)
```diff
@@ -137,3 +137,34 @@ process owner 后才检查同连接重复 `processId`，因此先返回 `RUNTIME
 直接执行 typecheck 只被未跟踪的并行 remote WebSocket 实现缺少 `ws` 类型声明阻断，该文件不
 进入本轮修复提交。退出条件仍为 Quality 跨平台全绿；Windows 平台必须取得 current 八项矩阵
 `8/8`，不能用历史 `7/7` 或本机非 Windows 测试替代。
+
+### 第三轮 Quality 修复
+
+Quality run `34009678395` 已确认 Windows restricted execution `8/8`、GUI Smoke、Integrity、
+Frontend lint/typecheck/test-layer budget 通过；Frontend Full 在批次 57 命中治理测试的过期
+路线图文案，Rust Full 在 `config_jsonrpc` 命中无外部写入的 `configVersionConflict`。修复批次
+57 后继续续跑，又在批次 118 暴露 File Manager watcher 的默认 mock 返回同步 `void`，违反
+`FileSystemWatchStop = () => Promise<void>` 契约并在卸载时触发 `.catch` 读取错误。
+
+本轮修复口径：
+
+- 治理测试改断言当前 README 中仍受保护的 P8 收口与 Windows unelevated runner 事实，不恢复
+  已删除的旧路线图文案。
+- File Manager 测试 fixture 返回真实异步 stop 函数，生产 watcher 契约和清理实现不降级。
+- 配置版本摘要先递归规范化 JSON 对象键顺序再做 SHA-256；数组顺序、配置响应、持久化格式和
+  乐观锁冲突语义保持不变。该修复消除 workspace 中 TUI 启用 `serde_json/preserve_order` 后，
+  `Config` 内 `HashMap` 迭代顺序导致等价配置产生不同摘要的问题。
+
+验证证据：Frontend 批次 57-117 在隔离候选中通过，修复 watcher fixture 后批次 118-119
+`145/145` 通过；两个改动测试文件合并定向验证 `241/241` 通过，隔离候选的
+`npm run typecheck` 通过，相关 ESLint、rustfmt 与 `git diff --check` 通过。Rust 已用同一
+`cargo test --workspace` 场景在未修复隔离候选中精确复现 CI 冲突；修复后新增配置版本单测
+`1/1` 通过，同一 workspace 特性统一场景中的
+`config_control_plane_uses_the_single_desktop_yaml_layer` 通过且命令退出码为 `0`。共享工作树的
+workspace 复验曾被并行 TUI 未完成模块写入阻断，因此不把该结果归因到本轮修复。Quality run
+`34009678395` 的 Windows Shell Runtime 已最终通过，包括 restricted execution `8/8`、command
+timeout、目录创建与 Agent Plugin MCP parity；该 run 仍因修复前的 Frontend Full 与 Rust Full
+失败而保持失败结论。
+
+现有 `v1.141.0` 本地与远端 tag 均继续指向 `5a7fe5af9`；本轮只追加 main 修复，不删除、覆盖
+或重建既有 tag。退出条件仍为新修复提交推送后 Quality 全绿，并完成远端 main 状态复核。
```

**File**: `lime-rs/crates/app-server/src/processor/config.rs` (modified, +46/-2)
```diff
@@ -153,8 +153,7 @@ fn read_snapshot() -> Result<ConfigSnapshot, JsonRpcError> {
 
 fn snapshot_from_config(config: Config) -> Result<ConfigSnapshot, JsonRpcError> {
     let config = serde_json::to_value(config).map_err(config_runtime_error)?;
-    let bytes = serde_json::to_vec(&config).map_err(config_runtime_error)?;
-    let version = hex::encode(Sha256::digest(bytes));
+    let version = config_version(&config)?;
     let file_path = ConfigManager::default_config_path();
     Ok(ConfigSnapshot {
         config,
@@ -163,6 +162,28 @@ fn snapshot_from_config(config: Config) -> Result<ConfigSnapshot, JsonRpcError>
     })
 }
 
+fn config_version(config: &Value) -> Result<String, JsonRpcError> {
+    let canonical = canonicalize_json(config);
+    let bytes = serde_json::to_vec(&canonical).map_err(config_runtime_error)?;
+    Ok(hex::encode(Sha256::digest(bytes)))
+}
+
+fn canonicalize_json(value: &Value) -> Value {
+    match value {
+        Value::Object(object) => {
+            let mut keys = object.keys().collect::<Vec<_>>();
+            keys.sort();
+            let mut sorted = Map::with_capacity(object.len());
+            for key in keys {
+                sorted.insert(key.clone(), canonicalize_json(&object[key]));
+            }
+            Value::Object(sorted)
+        }
+        Value::Array(array) => Value::Array(array.iter().map(canonicalize_json).collect()),
+        other => other.clone(),
+    }
+}
+
 fn write_edits(
     file_path: Option<String>,
     expected_version: Option<String>,
@@ -381,6 +402,29 @@ fn config_write_error(code: ConfigWriteErrorCode, message: impl Into<String>) ->
 mod tests {
     use super::*;
 
+    #[test]
+    fn config_version_is_independent_of_object_insertion_order() {
+        let mut reversed_nested = Map::new();
+        reversed_nested.insert("beta".to_string(), json!(2));
+        reversed_nested.insert("alpha".to_string(), json!(1));
+        let mut reversed = Map::new();
+        reversed.insert("zeta".to_string(), json!(3));
+        reversed.insert("nested".to_string(), Value::Object(reversed_nested));
+
+        let canonical = json!({
+            "nested": {
+                "alpha": 1,
+                "beta": 2
+            },
+            "zeta": 3
+        });
+
+        assert_eq!(
+            config_version(&Value::Object(reversed)).expect("reversed config version"),
+            config_version(&canonical).expect("canonical config version")
+        );
+    }
+
     #[test]
     fn orchestrator_config_is_writable_through_current_control_plane() {
         assert!(CONFIG_ROOT_KEYS.contains(&"orchestrator"));
```

**File**: `src/components/agent/chat/components/FileManager/FileManagerSidebar.test.tsx` (modified, +3/-1)
```diff
@@ -245,7 +245,9 @@ beforeEach(() => {
   );
   vi.mocked(openPathWithDefaultApp).mockResolvedValue(undefined);
   vi.mocked(revealPathInFinder).mockResolvedValue(undefined);
-  vi.mocked(startFileSystemWatch).mockResolvedValue(vi.fn());
+  vi.mocked(startFileSystemWatch).mockResolvedValue(
+    vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
+  );
   window.localStorage.clear();
 });
 
```

**File**: `src/lib/governance/legacySurfaceCatalog.test.ts` (modified, +2/-2)
```diff
@@ -4763,10 +4763,10 @@ describe("legacySurfaceCatalog", () => {
 
     expect(offenders).toEqual([]);
     expect(readmeSource).toContain(
-      "P1/P2/P3/P4/P5/P7/P8 的骨架闭环已经具备 current facts、projection、GUI smoke、evidence export 与生产 mock / legacy command 防回流守卫",
+      "P8 骨架阶段已经收口，不再重复做旧字符串 inventory",
     );
     expect(readmeSource).toContain(
-      "Windows 机器上先在 `tool-runtime` current owner 实现 restricted-token runner",
+      "unelevated current-user restricted-token runner",
     );
     expect(implementationSource).toContain(
       "P8 residual 盘点结论：生产 `src / packages / electron` 主路径未发现 `agent_runtime_*` 直接命令调用",
```

---

### Incident Patch 11: `a89be1a6` (2026-09-06)
**Commit Message**: fix(release): close v1.141.0 quality failures

**File**: `internal/aiprompts/quality-workflow.md` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@ npm run test:rust:integration -- -p <crate> --test <target>
 
 Agent/runtime 核心行为需要跨 owner 时，不把所有 case 堆进实现文件的 inline unit tests；使用专用测试模块或 integration target。`cargo nextest` 只在工具链、archive 和 CI shard 稳定后作为执行加速器，不改变本地 related-first 规则。
 
-Windows restricted execution 改动必须把 `windows-sandbox-runner.exe` 与 `app-server.exe`、`code-mode-host.exe`、`windows-sandbox-setup.exe` 成组构建。Electron Windows resources 和 `app-server.release.json` 必须包含 runner 及其 `windowsSandboxRunnerSha256`，`verify-package-resources` 对缺失或 digest 漂移 fail closed。源码/静态门禁不替代 `windows-restricted-execution-evidence-v3` 七项真实 Windows/MSVC 矩阵；Quality run `32975574520` 已在 SHA `19e08daa2` 取得 `7/7`，后续 Windows sandbox 改动必须保持该矩阵和 packaged resource 守卫全绿，否则 readiness 回退为 fail closed。
+Windows restricted execution 改动必须把 `windows-sandbox-runner.exe` 与 `app-server.exe`、`code-mode-host.exe`、`windows-sandbox-setup.exe` 成组构建。Electron Windows resources 和 `app-server.release.json` 必须包含 runner 及其 `windowsSandboxRunnerSha256`，`verify-package-resources` 对缺失或 digest 漂移 fail closed。源码/静态门禁不替代 `windows-restricted-execution-evidence-v3` 八项真实 Windows/MSVC 矩阵；Quality run `32975574520` 已在 SHA `19e08daa2` 取得当时七项矩阵的 `7/7` 历史基线，当前矩阵另含 unelevated managed-network preflight 拒绝，后续 Windows sandbox 改动必须保持 current matrix 和 packaged resource 守卫全绿，否则 readiness 回退为 fail closed。
 
 ## Gate A 与 Gate B
 
```

**File**: `internal/exec-plans/release-v1.141.0-plan.md` (modified, +26/-0)
```diff
@@ -111,3 +111,29 @@ v1.141.0 首次质量与 Electron 发布 workflow 暴露了三类问题：CLI/TU
 本地修复验证：`cargo check -p code-mode-protocol`、inventory/Windows Squirrel/release
 workflow 共 75 项 Vitest、`npm run test:contracts` 均通过。待提交推送后复跑 Quality 与
 Release workflows，确认跨平台构建及 Windows restricted execution setup 通过。
+
+### 第二轮 Quality 修复
+
+Quality run `33999878194` 在首轮修复后继续暴露三个独立问题：Windows restricted
+execution 已执行 8 个测试，但 evidence collector 的 required matrix 仍只有 7 项；
+Codex method product-scope fixture 引用了只在 Windows job 运行时生成、不会进入前端独立
+checkout 的 `.lime/qc/windows-restricted-execution/summary.json`；App Server 在注册共享
+process owner 后才检查同连接重复 `processId`，因此先返回 `RUNTIME_ERROR`，而不是协议要求的
+`INVALID_REQUEST`。
+
+当前修复口径：
+
+- 将 `unelevated_mode_rejects_managed_network_before_setup` 纳入八项 required matrix，并由脚本
+  单测自动比对 Rust integration target 的全部 `#[test]` / `#[tokio::test]`，防止测试清单再次
+  漂移。
+- 静态 product-scope fixture 只引用仓库内可追踪的 collector 与 Rust integration test；真实
+  `.lime/qc/**` 继续只作为平台运行 artifact，不伪造、不提交。
+- App Server 以 connection-scoped owner id 注册共享进程，在 spawn 前拒绝同连接 active 重复，
+  并允许不同连接或同连接终态后复用公开 `processId`。
+
+本地定向验证已通过：Windows evidence 与 Codex product-scope Vitest `19/19`；App Server
+`command_exec` 相关 Rust 单测 `12/12`；真实工作树 `npm run test:contracts` 通过；只叠加本轮
+候选文件的隔离 `HEAD` 快照中，`npm run typecheck` 与同一组 App Server 单测通过。当前工作树
+直接执行 typecheck 只被未跟踪的并行 remote WebSocket 实现缺少 `ws` 类型声明阻断，该文件不
+进入本轮修复提交。退出条件仍为 Quality 跨平台全绿；Windows 平台必须取得 current 八项矩阵
+`8/8`，不能用历史 `7/7` 或本机非 Windows 测试替代。
```

**File**: `internal/refactor/v1/fixtures/codex-method-product-scope.v0.1.json` (modified, +3/-2)
```diff
@@ -995,7 +995,8 @@
         "lime-rs/crates/app-server/src/processor/windows_sandbox.rs",
         "src/lib/api/windowsSandbox.ts",
         "src/components/settings-v2/system/execution-policy/WindowsSandboxReadinessStatus.tsx",
-        ".lime/qc/windows-restricted-execution/summary.json"
+        "scripts/lib/windows-restricted-execution-evidence.mjs",
+        "lime-rs/crates/tool-runtime/tests/windows_restricted_execution.rs"
       ],
       "methods": ["windowsSandbox/setupStart"]
     },
@@ -1502,7 +1503,7 @@
         "src/lib/api/windowsSandbox.ts",
         "src/components/settings-v2/system/execution-policy/WindowsSandboxReadinessStatus.tsx",
         "scripts/lib/windows-restricted-execution-evidence.mjs",
-        ".lime/qc/windows-restricted-execution/summary.json"
+        "lime-rs/crates/tool-runtime/tests/windows_restricted_execution.rs"
       ],
       "methods": [
         "windows/worldWritableWarning",
```

**File**: `lime-rs/crates/app-server/src/command_exec.rs` (modified, +40/-27)
```diff
@@ -84,6 +84,7 @@ impl CommandExecServer {
             connection_id,
             process_id: process_id.clone(),
         };
+        let owner_base_id = owner_process_id(connection_id, &process_id);
         let cwd = params
             .cwd
             .clone()
@@ -142,9 +143,20 @@ impl CommandExecServer {
         } else {
             parse_timeout(params.timeout_ms)?
         };
+        let mut sessions = self.sessions.lock().await;
+        if sessions.contains_key(&key) {
+            return Err(invalid_request(format!(
+                "duplicate active command/exec process id: {process_id}"
+            )));
+        }
+        let owner_id = if self.process_server.status(&owner_base_id).is_ok() {
+            format!("{owner_base_id}-{}", uuid::Uuid::new_v4())
+        } else {
+            owner_base_id
+        };
         let request = LocalExecutionRequest {
-            process_id: process_id.clone(),
-            tool_id: process_id.clone(),
+            process_id: owner_id.clone(),
+            tool_id: owner_id.clone(),
             tool_name: "command/exec".to_string(),
             command: params.command.clone(),
             cwd: Some(cwd),
@@ -158,34 +170,31 @@ impl CommandExecServer {
         let mut handle = start_local_execution_process(request)
             .map_err(|error| invalid_runtime(format!("failed to spawn command/exec: {error}")))?;
         if let Some(size) = params.size {
-            handle
-                .resize(size.rows, size.cols)
-                .map_err(|error| invalid_runtime(error.to_string()))?;
+            if let Err(error) = handle.resize(size.rows, size.cols) {
+                let _ = handle.terminate();
+                return Err(invalid_runtime(error.to_string()));
+            }
         }
-        self.process_server
+        if let Err(error) = self
+            .process_server
             .register_process_handle(handle.control_handle(), handle.status())
-            .map_err(|error| {
-                invalid_runtime(format!("failed to register command/exec process: {error}"))
-            })?;
         {
-            let mut sessions = self.sessions.lock().await;
-            if sessions.contains_key(&key) {
-                let _ = handle.terminate();
-                return Err(invalid_request(format!(
-                    "duplicate active command/exec process id: {process_id}"
-                )));
-            }
-            sessions.insert(
-                key.clone(),
-                CommandExecSession {
-                    process_id: process_id.clone(),
-                    control: handle.control_handle(),
-                    stream_stdin,
-                    tty: params.tty,
-                    stdin_open: Arc::new(Mutex::new(stream_stdin)),
-                },
-            );
+            let _ = handle.terminate();
+            return Err(invalid_runtime(format!(
+                "failed to register command/exec process: {error}"
+            )));
         }
+        sessions.insert(
+            key.clone(),
+            CommandExecSession {
+                process_id: owner_id.clone(),
+                control: handle.control_handle(),
+                stream_stdin,
+                tty: params.tty,
+                stdin_open: Arc::new(Mutex::new(stream_stdin)),
+            },
+        );
+        drop(sessions);
 
         let mut stdout = Capture::new(output_cap);
         let mut stderr = Capture::new(output_cap);
@@ -239,7 +248,7 @@ impl CommandExecServer {
                 }
                 _ = async { if let Some(sleep) = timeout_sleep.as_mut() { sleep.await } }, if timeout_sleep.is_some() => {
                     timed_out = true;
-                    let _ = self.process_server.terminate(&process_id);
+                    let _ = self.process_server.terminate(&owner_id);
                     timeout_sleep = None;
                 }
             }
@@ -511,6 +520,10 @@ fn key(connection_id: ConnectionId, process_id: &str) -> CommandExecKey {
     }
 }
 
+fn owner_process_id(connection_id: ConnectionId, process_id: &str) -> String {
+    format!("command-exec-{}-{process_id}", connection_id.0)
+}
+
 fn invalid_request(message: impl Into<String>) -> JsonRpcError {
     JsonRpcError::new(error_codes::INVALID_REQUEST, message)
 }
```

**File**: `lime-rs/crates/app-server/src/command_exec/tests.rs` (modified, +67/-0)
```diff
@@ -1,8 +1,12 @@
 use super::*;
 #[cfg(unix)]
+use crate::execution_process::ExecutionProcessServer;
+#[cfg(unix)]
 use app_server_protocol::protocol::v2::CommandExecTerminalSize;
 #[cfg(unix)]
 use tokio::sync::mpsc;
+#[cfg(unix)]
+use tool_runtime::execution_process::live::LiveExecutionOutputQuery;
 
 #[cfg(unix)]
 fn server_with_notifications() -> (
@@ -107,6 +111,69 @@ async fn one_off_command_captures_stdout_stderr_and_exit_code() {
     assert_eq!(response.stderr, "stderr");
 }
 
+#[cfg(unix)]
+#[tokio::test]
+async fn command_exec_registers_output_and_terminal_status_with_shared_owner() {
+    let process_server = ExecutionProcessServer::default();
+    let server = CommandExecServer::default().with_process_server(process_server.clone());
+    let connection_id = ConnectionId(11);
+    let public_process_id = "shared-owner";
+    let response = server
+        .exec(
+            connection_id,
+            exec_params(Some(public_process_id), "printf shared-owner-output"),
+            None,
+        )
+        .await
+        .expect("execute command");
+
+    assert_eq!(response.exit_code, 0);
+    let owner_id = owner_process_id(connection_id, public_process_id);
+    let status = process_server.status(&owner_id).expect("shared status");
+    assert!(status.status.is_terminal());
+    assert_eq!(status.exit_code, Some(0));
+    assert_eq!(status.process_id, owner_id);
+
+    let output = process_server
+        .drain_output(LiveExecutionOutputQuery {
+            process_id: Some(owner_id),
+            ..LiveExecutionOutputQuery::default()
+        })
+        .expect("shared output");
+    assert!(output
+        .deltas
+        .iter()
+        .any(|delta| delta.delta.contains("shared-owner-output")));
+}
+
+#[cfg(unix)]
+#[tokio::test]
+async fn completed_process_id_can_be_reused_after_terminal_cleanup() {
+    let process_server = ExecutionProcessServer::default();
+    let server = CommandExecServer::default().with_process_server(process_server);
+    let connection_id = ConnectionId(12);
+
+    let first = server
+        .exec(
+            connection_id,
+            exec_params(Some("reusable"), "printf first"),
+            None,
+        )
+        .await
+        .expect("first command");
+    assert_eq!(first.stdout, "first");
+
+    let second = server
+        .exec(
+            connection_id,
+            exec_params(Some("reusable"), "printf second"),
+            None,
+        )
+        .await
+        .expect("terminal process id should be reusable");
+    assert_eq!(second.stdout, "second");
+}
+
 #[cfg(unix)]
 #[tokio::test]
 async fn explicit_read_only_policy_fails_closed_for_mutating_command() {
```

**File**: `scripts/README.md` (modified, +1/-1)
```diff
@@ -284,7 +284,7 @@ Electron release / updater 领域新增脚本进入 `scripts/electron/`。当前
 
 Packaged 平台证据必须显式提供完整 Git commit SHA 和有界 `candidateRunId`（CLI 参数 `--candidate-sha` / `--run-id`，或环境变量 `LIME_CANDIDATE_SHA` / `LIME_GATE_RUN_ID`）。Windows 聚合器要求 Squirrel、Code Mode、native host、安装路径、版本与资源 manifest 属于同一 identity。macOS 的 `--release-trust` 只用于 Developer ID release 候选，并额外要求顶层 app、嵌套 helper、Gatekeeper 和 stapling 校验通过；本地 ad-hoc package 不得设置该标记或冒充 release 证据。
 
-`scripts/lib/windows-restricted-execution-evidence.mjs` 是 Windows restricted-token 安全矩阵的唯一证据采集入口。真实 clean Windows runner 必须显式传 `--provision`，由同一入口先在隔离 `LIME_AGENT_RUNTIME_ROOT` 执行 `windows-sandbox-setup`，再执行 `tool-runtime` 的 `windows_restricted_execution` integration test；未显式 provision、setup 失败或矩阵不完整都 fail-closed。schema `windows-restricted-execution-evidence-v3` 分别记录 setup/test 结果与 stdout/stderr artifact；矩阵覆盖 workspace/metadata denial、online/offline account 选择、offline Firewall loopback enforcement、bounded output、allowlisted stdin、ConPTY stdin/resize/combined-output、Everyone-write ACL audit 与 Job Object cleanup。setup 与 Cargo 各有固定超时，Windows ACL audit 对目录/总量/时限上限或 reparse 元数据错误会发出 `failedScan` warning。非 Windows 主机只输出 `evidence-pending` 并以非零退出，不能被当作平台通过。
+`scripts/lib/windows-restricted-execution-evidence.mjs` 是 Windows restricted-token 安全矩阵的唯一证据采集入口。真实 clean Windows runner 必须显式传 `--provision`，由同一入口先在隔离 `LIME_AGENT_RUNTIME_ROOT` 执行 `windows-sandbox-setup`，再执行 `tool-runtime` 的 `windows_restricted_execution` integration test；未显式 provision、setup 失败或矩阵不完整都 fail-closed。schema `windows-restricted-execution-evidence-v3` 分别记录 setup/test 结果与 stdout/stderr artifact；八项矩阵覆盖 unelevated managed-network preflight 拒绝、workspace/metadata denial、online/offline account 选择、offline Firewall loopback enforcement、bounded output、allowlisted stdin、ConPTY stdin/resize/combined-output、Everyone-write ACL audit 与 Job Object cleanup。setup 与 Cargo 各有固定超时，Windows ACL audit 对目录/总量/时限上限或 reparse 元数据错误会发出 `failedScan` warning。非 Windows 主机只输出 `evidence-pending` 并以非零退出，不能被当作平台通过。
 
 对外优先使用 `package.json` 里的 `electron:*` npm scripts。`npm run electron:make:zip-local-feed -- --arch arm64` 只写 `.tmp/electron-forge-local-feed`，不能替代 `electron:dist`、release workflow、DMG、签名、公证或 Windows Squirrel 实机证据。
 
```

**File**: `scripts/lib/windows-restricted-execution-evidence.mjs` (modified, +7/-1)
```diff
@@ -29,6 +29,7 @@ const TEST_COMMAND = [
   "--test-threads=1",
 ];
 export const REQUIRED_TESTS = Object.freeze([
+  "unelevated_mode_rejects_managed_network_before_setup",
   "workspace_write_allows_workspace_and_denies_metadata_and_external_paths",
   "restricted_execution_uses_offline_account_and_blocks_network",
   "restricted_execution_bounds_large_output",
@@ -147,7 +148,12 @@ export function buildEvidenceSummary({
   failedStage = null,
   tests = { passed: null, failed: null, ignored: null },
   matrix = buildMatrixResult([]),
-  setup = { requested: false, result: "not-requested", exitCode: null, error: null },
+  setup = {
+    requested: false,
+    result: "not-requested",
+    exitCode: null,
+    error: null,
+  },
   stdoutPath = null,
   stderrPath = null,
   setupStdoutPath = null,
```

**File**: `scripts/lib/windows-restricted-execution-evidence.test.mjs` (modified, +18/-0)
```diff
@@ -15,6 +15,23 @@ import {
 } from "./windows-restricted-execution-evidence.mjs";
 
 describe("Windows restricted execution evidence runner", () => {
+  it("required matrix 与 Rust Windows 集成测试清单保持一致", () => {
+    const source = fs.readFileSync(
+      path.join(
+        process.cwd(),
+        "lime-rs/crates/tool-runtime/tests/windows_restricted_execution.rs",
+      ),
+      "utf8",
+    );
+    const declaredTests = [
+      ...source.matchAll(
+        /#\[(?:tokio::)?test\]\s*(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/gu,
+      ),
+    ].map((match) => match[1]);
+
+    expect([...REQUIRED_TESTS].sort()).toEqual(declaredTests.sort());
+  });
+
   it("在非 Windows 主机 fail-closed 并写出 evidence-pending", () => {
     const root = fs.mkdtempSync(
       path.join(os.tmpdir(), "lime-windows-evidence-test-"),
@@ -124,6 +141,7 @@ describe("Windows restricted execution evidence runner", () => {
   it("解析每个 case 并拒绝缺失、重复或未知场景", () => {
     const cases = parseTestCases(
       [
+        "test unelevated_mode_rejects_managed_network_before_setup ... ok",
         "test workspace_write_allows_workspace_and_denies_metadata_and_external_paths ... ok",
         "test restricted_execution_uses_offline_account_and_blocks_network ... ok",
         "test restricted_execution_bounds_large_output ... ok",
```

---

### Incident Patch 12: `4969a8cd` (2026-09-05)
**Commit Message**: fix(release): unblock v1.141.0 CI

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -63,6 +63,9 @@ internal/exec-plans/*
 !internal/exec-plans/tui-codex-snapshot-inventory.json
 !internal/exec-plans/tui-codex-snapshot-inventory.md
 !internal/exec-plans/tui-cli-surfaces-plan.md
+!internal/exec-plans/cli-codex-test-inventory.json
+!internal/exec-plans/cli-structure-inventory.json
+!internal/exec-plans/tui-structure-inventory.json
 !internal/exec-plans/documentation-convergence-plan.md
 !internal/exec-plans/scheduled-tasks-implementation.md
 !internal/exec-plans/release-v*-plan.md
```

**File**: `internal/exec-plans/release-v1.141.0-plan.md` (modified, +18/-0)
```diff
@@ -93,3 +93,21 @@ V8 预构建 archive 在本机 Darwin/aarch64 若仍返回 404，改用仓库已
 - `dead / deleted`：旧 Code Mode process/V8 物理实现及已退役 CLI 入口。
 
 当前完成度：验证与候选整理 95%；待用户确认后执行 release commit、tag、推送及远端复核。
+
+## 2026-09-06 发布后 CI 修复
+
+v1.141.0 首次质量与 Electron 发布 workflow 暴露了三类问题：CLI/TUI inventory JSON
+被根 `.gitignore` 忽略而未进入 CI checkout；`code-mode-protocol` 的 `tonic-build`
+依赖系统 `protoc`，导致 Linux/macOS/Windows Rust、GUI 和 Electron 构建均在代码生成阶段
+失败；Windows 构建失败后仍执行 Squirrel cleanup，因 summary 尚未生成而产生二次 `ENOENT`
+失败。修复如下：
+
+- 将三份生成账本加入 `.gitignore` 例外，保留为静态治理事实源。
+- 在 workspace 中加入 `protoc-bin-vendored`，由 `code-mode-protocol/build.rs` 设置
+  `PROTOC`，消除平台工具链前置条件并同步 `Cargo.lock`。
+- 导出并保护 `cleanupFromSummary`：summary 不存在时记录明确 no-op，不覆盖原始构建错误；
+  增加缺失 summary 回归测试。
+
+本地修复验证：`cargo check -p code-mode-protocol`、inventory/Windows Squirrel/release
+workflow 共 75 项 Vitest、`npm run test:contracts` 均通过。待提交推送后复跑 Quality 与
+Release workflows，确认跨平台构建及 Windows restricted execution setup 通过。
```

**File**: `lime-rs/Cargo.lock` (modified, +65/-0)
```diff
@@ -1068,6 +1068,7 @@ name = "code-mode-protocol"
 version = "1.141.0"
 dependencies = [
  "prost",
+ "protoc-bin-vendored",
  "serde",
  "serde_json",
  "tokio",
@@ -5399,6 +5400,70 @@ dependencies = [
  "prost",
 ]
 
+[[package]]
+name = "protoc-bin-vendored"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "d1c381df33c98266b5f08186583660090a4ffa0889e76c7e9a5e175f645a67fa"
+dependencies = [
+ "protoc-bin-vendored-linux-aarch_64",
+ "protoc-bin-vendored-linux-ppcle_64",
+ "protoc-bin-vendored-linux-s390_64",
+ "protoc-bin-vendored-linux-x86_32",
+ "protoc-bin-vendored-linux-x86_64",
+ "protoc-bin-vendored-macos-aarch_64",
+ "protoc-bin-vendored-macos-x86_64",
+ "protoc-bin-vendored-win32",
+]
+
+[[package]]
+name = "protoc-bin-vendored-linux-aarch_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c350df4d49b5b9e3ca79f7e646fde2377b199e13cfa87320308397e1f37e1a4c"
+
+[[package]]
+name = "protoc-bin-vendored-linux-ppcle_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "a55a63e6c7244f19b5c6393f025017eb5d793fd5467823a099740a7a4222440c"
+
+[[package]]
+name = "protoc-bin-vendored-linux-s390_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "1dba5565db4288e935d5330a07c264a4ee8e4a5b4a4e6f4e83fad824cc32f3b0"
+
+[[package]]
+name = "protoc-bin-vendored-linux-x86_32"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8854774b24ee28b7868cd71dccaae8e02a2365e67a4a87a6cd11ee6cdbdf9cf5"
+
+[[package]]
+name = "protoc-bin-vendored-linux-x86_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b38b07546580df720fa464ce124c4b03630a6fb83e05c336fea2a241df7e5d78"
+
+[[package]]
+name = "protoc-bin-vendored-macos-aarch_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "89278a9926ce312e51f1d999fee8825d324d603213344a9a706daa009f1d8092"
+
+[[package]]
+name = "protoc-bin-vendored-macos-x86_64"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "81745feda7ccfb9471d7a4de888f0652e806d5795b61480605d4943176299756"
+
+[[package]]
+name = "protoc-bin-vendored-win32"
+version = "3.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "95067976aca6421a523e491fce939a3e65249bac4b977adee0ee9771568e8aa3"
+
 [[package]]
 name = "pulldown-cmark"
 version = "0.10.3"
```

**File**: `lime-rs/Cargo.toml` (modified, +1/-0)
```diff
@@ -158,6 +158,7 @@ cpal = "0.15"
 prost = "0.13.5"
 tonic = { version = "0.12.3", features = ["transport"] }
 tonic-build = "0.12.3"
+protoc-bin-vendored = "3.2.0"
 
 # TLS
 rustls-pemfile = "2"
```

**File**: `lime-rs/crates/code-mode-protocol/Cargo.toml` (modified, +1/-0)
```diff
@@ -20,3 +20,4 @@ tonic.workspace = true
 
 [build-dependencies]
 tonic-build.workspace = true
+protoc-bin-vendored.workspace = true
```

**File**: `lime-rs/crates/code-mode-protocol/build.rs` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 fn main() -> Result<(), Box<dyn std::error::Error>> {
     println!("cargo:rerun-if-changed=src/grpc");
+    let protoc = protoc_bin_vendored::protoc_bin_path()?;
+    std::env::set_var("PROTOC", protoc);
     tonic_build::configure()
         .build_client(true)
         .build_server(true)
```

**File**: `scripts/electron/windows-squirrel-rc-smoke.mjs` (modified, +7/-1)
```diff
@@ -217,8 +217,14 @@ export function finalizeWindowsRcUninstallSummary({
   });
 }
 
-async function cleanupFromSummary(summaryPath) {
+export async function cleanupFromSummary(summaryPath) {
   const absoluteSummaryPath = path.resolve(summaryPath);
+  if (!existsSync(absoluteSummaryPath)) {
+    console.log(
+      `[windows-squirrel-rc-cleanup] summary missing; skipping cleanup summary=${absoluteSummaryPath}`,
+    );
+    return { skipped: true, summaryPath: absoluteSummaryPath };
+  }
   const initialSummary = JSON.parse(readFileSync(absoluteSummaryPath, "utf8"));
   let uninstallEvidence = null;
   let errorMessage = null;
```

**File**: `scripts/electron/windows-squirrel-rc-smoke.test.mjs` (modified, +14/-0)
```diff
@@ -9,6 +9,7 @@ import {
   buildNMinusOneLaunchEnv,
   buildWaitForWindowsProcessExitScript,
   buildWindowsRcSummary,
+  cleanupFromSummary,
   compareVersions,
   finalizeWindowsRcUninstallSummary,
   findReadyElectronUpdaterPage,
@@ -23,6 +24,19 @@ import {
 } from "./windows-squirrel-rc-smoke.mjs";
 
 describe("Windows Squirrel RC smoke", () => {
+  it("构建未产出 summary 时 cleanup 安全跳过", async () => {
+    const root = fs.mkdtempSync(
+      path.join(os.tmpdir(), "windows-squirrel-rc-cleanup-missing-"),
+    );
+    const summaryPath = path.join(root, "summary.json");
+
+    await expect(cleanupFromSummary(summaryPath)).resolves.toEqual({
+      skipped: true,
+      summaryPath,
+    });
+    expect(fs.existsSync(summaryPath)).toBe(false);
+  });
+
   it("等待最终 renderer，不能把带 preload 的临时启动页当成 updater 页面", () => {
     expect(
       isFinalElectronRendererUrl(
```

---

### Incident Patch 13: `81ba705f` (2026-09-04)
**Commit Message**: fix(release): finish v1.140.0 Windows cleanup

**File**: `internal/exec-plans/release-v1.140.0-plan.md` (modified, +7/-2)
```diff
@@ -46,7 +46,12 @@
 - 失败复盘同时发现生命周期契约矛盾：Squirrel smoke 在 workflow 后续 CodeMode/native-host Gate B 前卸载候选，而 packaged evidence validator 又同时要求卸载成功和已安装 exe 存在。恢复补丁将卸载移动到全部 installed packaged Gate B 与身份校验之后；卸载仅容忍同时包含缺失子键文本、`RegistryKey.DeleteSubKeyTree` 与 `Squirrel.Update.Program.<Uninstall>` 的明确幂等错误，仍要求 Update.exe、候选目录、主程序与快捷方式全部消失，其他错误继续 fail closed。
 - 恢复补丁本地验证：Windows Squirrel/packaged evidence/release workflow guard 定向 Vitest 3 文件 `66/66`；`npm run typecheck`、`npm run test:contracts`、`npm run verify:app-version`、`npm run governance:scripts`、release workflow guard、Prettier check 与 `git diff --check` 全部通过。
 - Windows timeout 恢复补丁将测试负载改为不触发 shell 策略但仍可由 timeout 终止的 `.NET Thread.Sleep`，并给 Unix-only imports/helper 补齐 `cfg(unix)`，消除日志中的 4 个 `app-server` Windows 编译警告。本机 `npm run test:rust:related -- lime-rs/crates/app-server/src/command_exec/tests.rs lime-rs/crates/app-server/src/process/tests.rs` 通过 `1759/1759`，`cargo fmt --check` 通过；Windows 专属分支待恢复后的 Quality run 验证。
-- 待执行：单独确认后提交并推送修复；通过 `workflow_dispatch version=v1.140.0` 从后续 `main` 修复提交重建资产，不移动已推送 tag；监控 GitHub Release 发布、CLI 资产与 R2 updater 完成。
+- 恢复提交 `9341eb297e6baecdf453eccf2aed2465bad99e4f6747091bf` 已推送到 `origin/main`；`v1.140.0` tag 仍固定在原始 release commit `1fe2ad260bb080a94a8dbda9e0d954f6747091bf`，未改写。
+- 第二次 Release run `33826403443`：macOS x64/arm64 构建通过；Windows Electron 构建、Squirrel 安装、N-1 更新、SHELL-01、CodeMode Gate B、native-host Gate B 与 packaged evidence identity 全部通过。最后的卸载步骤失败，artifact `windows-squirrel-rc-evidence-x86_64-pc-windows-msvc` 显示主程序和快捷方式已移除，但 `C:\Users\runneradmin\AppData\Local\lime\Update.exe` 与 `app-1.140.0` 在 60 秒后仍存在，因此 Electron/CLI 资产和 R2 发布被跳过。
+- 第二次失败根因是门禁把 Squirrel.Windows 的有意保留行为误判成卸载失败：其 `FullUninstall` 删除产品文件后会重建带 `.dead` 的安装根，并保留正在参与卸载钩子的 `Update.exe`。本轮修复先 fail-closed 验证候选 `Lime.exe` 与快捷方式已由 Squirrel 移除，再等待同路径 updater 进程退出，最后仅清理经过安装布局校验的候选 app 目录与 `Update.exe`；证据分别记录产品卸载和 runner 残留清理结果，未知卸载错误仍不容忍。路径/顺序/fail-closed 定向 Vitest 与 packaged/release guard 共 `68/68` 通过。
+- 第二次 Windows 日志同时暴露 `tool-runtime` 的 4 条告警：删除从未进入生产调用图的 `should_preserve_windows_job` 及其自证测试；将 Windows SDK 的 `NERR_Success` / `NERR_GroupExists` 仅在模式匹配处导入为 Rust 风格大写别名。使用仓库校验后的 sandboxed rusty_v8 资产后，`npm run test:rust:unit -- -p tool-runtime` 通过 `382/382`，`cargo fmt -p tool-runtime --check` 通过；`cargo clippy -D warnings` 完成依赖构建后被仓库内 23 条既有 Rust 1.95 lint 阻断，不属于本轮 Windows rustc 告警。Windows 无告警编译待下一次 CI 给出平台证据。
+- 第二轮恢复补丁发布门禁：`npm run typecheck`、`npm run test:contracts`、`npm run verify:app-version`、`npm run governance:scripts`、Prettier 与 `git diff --check` 均通过。
+- 待执行：复核发布门禁后单独确认、提交并推送第二轮修复；通过 `workflow_dispatch version=v1.140.0` 从后续 `main` 修复提交重建资产，不移动已推送 tag；监控 Windows/macOS 构建、GitHub Release、CLI 资产与 R2 updater 完成。
 
 ## 收尾分类
 
@@ -55,4 +60,4 @@
 - `deprecated`：无新增。
 - `dead / deleted`：旧 `lime-cli-npm` 包、旧 CLI skill/工具文档与其专用入口。
 
-当前完成度：`85%`；版本 metadata、双语 release notes、原始 release commit/tag/push 已完成，正在修复 Windows 发布门禁并恢复远端资产发布。
+当前完成度：`88%`；版本 metadata、双语 release notes、原始 release commit/tag/push 与第二轮 Windows 根因修复已完成，等待提交推送后重新验证并发布远端资产。
```

**File**: `lime-rs/crates/tool-runtime/src/execution_process.rs` (modified, +0/-5)
```diff
@@ -776,11 +776,6 @@ fn start_local_execution_process_with_inherited_environment(
     })
 }
 
-#[cfg(any(test, target_os = "windows"))]
-fn should_preserve_windows_job(wait_failed: bool, process_status: ExecutionProcessStatus) -> bool {
-    !wait_failed && !process_status.is_terminal()
-}
-
 #[allow(clippy::too_many_arguments)]
 async fn supervise_local_process(
     mut child: Child,
```

**File**: `lime-rs/crates/tool-runtime/src/execution_process/tests.rs` (modified, +0/-20)
```diff
@@ -428,26 +428,6 @@ fn explicit_environment_overrides_can_restore_filtered_values() {
     );
 }
 
-#[test]
-fn windows_job_preserves_only_after_normal_root_exit() {
-    assert!(should_preserve_windows_job(
-        false,
-        ExecutionProcessStatus::Running
-    ));
-    assert!(!should_preserve_windows_job(
-        true,
-        ExecutionProcessStatus::Running
-    ));
-    assert!(!should_preserve_windows_job(
-        false,
-        ExecutionProcessStatus::Interrupted
-    ));
-    assert!(!should_preserve_windows_job(
-        false,
-        ExecutionProcessStatus::Terminated
-    ));
-}
-
 #[cfg(not(target_os = "windows"))]
 #[test]
 fn windows_world_writable_audit_is_clean_without_platform_commands() {
```

**File**: `lime-rs/crates/tool-runtime/src/windows_setup/accounts.rs` (modified, +8/-4)
```diff
@@ -275,7 +275,8 @@ pub(super) fn ensure_local_account(username: &str, password: &str) -> io::Result
 pub(super) fn ensure_local_group(name: &str, comment: &str) -> io::Result<()> {
     use windows_sys::Win32::Foundation::ERROR_ALIAS_EXISTS;
     use windows_sys::Win32::NetworkManagement::NetManagement::{
-        NERR_GroupExists, NERR_Success, NetLocalGroupAdd, LOCALGROUP_INFO_1,
+        NERR_GroupExists as NERR_GROUP_EXISTS, NERR_Success as NERR_SUCCESS, NetLocalGroupAdd,
+        LOCALGROUP_INFO_1,
     };
 
     let mut name_w = to_wide(name);
@@ -293,7 +294,10 @@ pub(super) fn ensure_local_group(name: &str, comment: &str) -> io::Result<()> {
             &mut parameter_error,
         )
     };
-    if matches!(result, NERR_Success | ERROR_ALIAS_EXISTS | NERR_GroupExists) {
+    if matches!(
+        result,
+        NERR_SUCCESS | ERROR_ALIAS_EXISTS | NERR_GROUP_EXISTS
+    ) {
         Ok(())
     } else {
         Err(io::Error::other(format!(
@@ -305,7 +309,7 @@ pub(super) fn ensure_local_group(name: &str, comment: &str) -> io::Result<()> {
 pub(super) fn ensure_local_group_member(group: &str, account: &str) -> io::Result<()> {
     use windows_sys::Win32::Foundation::ERROR_MEMBER_IN_ALIAS;
     use windows_sys::Win32::NetworkManagement::NetManagement::{
-        NERR_Success, NetLocalGroupAddMembers, LOCALGROUP_MEMBERS_INFO_3,
+        NERR_Success as NERR_SUCCESS, NetLocalGroupAddMembers, LOCALGROUP_MEMBERS_INFO_3,
     };
 
     let group_w = to_wide(group);
@@ -322,7 +326,7 @@ pub(super) fn ensure_local_group_member(group: &str, account: &str) -> io::Resul
             1,
         )
     };
-    if matches!(result, NERR_Success | ERROR_MEMBER_IN_ALIAS) {
+    if matches!(result, NERR_SUCCESS | ERROR_MEMBER_IN_ALIAS) {
         Ok(())
     } else {
         Err(io::Error::other(format!(
```

**File**: `scripts/electron/lib/windows-squirrel-n-minus-one.mjs` (modified, +68/-0)
```diff
@@ -4,6 +4,7 @@ import {
   existsSync,
   mkdtempSync,
   readFileSync,
+  rmSync,
   statSync,
 } from "node:fs";
 import { createServer as createHttpServer } from "node:http";
@@ -244,7 +245,9 @@ export async function uninstallInstalledSquirrel({
   timeoutMs = 60_000,
   runProcessImpl = runProcess,
   existsImpl = existsSync,
+  removeResidualPathsImpl = removeSquirrelResidualPaths,
   waitForAbsentImpl = waitForAbsent,
+  waitForProcessExitImpl = waitForWindowsProcessExit,
 } = {}) {
   const requiredPaths = [updateExecutable, appDirectory, executable].filter(
     (value) => typeof value === "string" && value.length > 0,
@@ -254,6 +257,11 @@ export async function uninstallInstalledSquirrel({
       "Squirrel uninstall requires updateExecutable, appDirectory, and executable",
     );
   }
+  assertSquirrelInstallPathLayout({
+    appDirectory,
+    executable,
+    updateExecutable,
+  });
   const result = await runProcessImpl(updateExecutable, ["--uninstall"], {
     captureOutput: true,
     env: process.env,
@@ -265,6 +273,20 @@ export async function uninstallInstalledSquirrel({
       `Squirrel uninstall exited with ${result.exitCode} at ${updateExecutable}`,
     );
   }
+  // Legacy Squirrel retains updater files by design. Prove product removal first,
+  // then clean only the validated candidate paths left on the CI runner.
+  const productPaths = [executable, ...shortcutPaths].filter(
+    (value) => typeof value === "string" && value.length > 0,
+  );
+  await waitForAbsentImpl(productPaths, { existsImpl, timeoutMs });
+  const updaterQuiescence = await waitForProcessExitImpl(updateExecutable, {
+    timeoutMs,
+  });
+  const retainedBeforeCleanup = {
+    appDirectory: existsImpl(appDirectory),
+    updateExecutable: existsImpl(updateExecutable),
+  };
+  await removeResidualPathsImpl({ appDirectory, updateExecutable });
   await waitForAbsentImpl(
     [...requiredPaths, ...shortcutPaths].filter(
       (value) => typeof value === "string" && value.length > 0,
@@ -279,13 +301,59 @@ export async function uninstallInstalledSquirrel({
     commandAccepted: classification.accepted,
     exitCode: result.exitCode,
     warning: classification.warning,
+    productRemoval: {
+      executableAbsent: !existsImpl(executable),
+      shortcutsAbsent: shortcutPaths.every((shortcut) => !existsImpl(shortcut)),
+    },
+    retainedPathCleanup: {
+      retainedBeforeCleanup,
+      updaterQuiescence,
+    },
     updateExecutableAbsent: !existsImpl(updateExecutable),
     appDirectoryAbsent: !existsImpl(appDirectory),
     executableAbsent: !existsImpl(executable),
     shortcutsAbsent: shortcutPaths.every((shortcut) => !existsImpl(shortcut)),
   };
 }
 
+function assertSquirrelInstallPathLayout({
+  appDirectory,
+  executable,
+  updateExecutable,
+}) {
+  const normalizedAppDirectory = path.win32.resolve(appDirectory);
+  const normalizedExecutable = path.win32.resolve(executable);
+  const normalizedUpdateExecutable = path.win32.resolve(updateExecutable);
+  const packageRoot = path.win32.dirname(normalizedUpdateExecutable);
+  const equalsPath = (left, right) =>
+    left.toLowerCase() === right.toLowerCase();
+  const valid =
+    path.win32.basename(normalizedUpdateExecutable).toLowerCase() ===
+      "update.exe" &&
+    /^app-/i.test(path.win32.basename(normalizedAppDirectory)) &&
+    equalsPath(path.win32.dirname(normalizedAppDirectory), packageRoot) &&
+    equalsPath(
+      path.win32.dirname(normalizedExecutable),
+      normalizedAppDirectory,
+    ) &&
+    path.win32.basename(normalizedExecutable).toLowerCase() === "lime.exe";
+  if (!valid) {
+    throw new Error(
+      "Squirrel uninstall paths must identify Lime.exe under one app-* directory beside Update.exe",
+    );
+  }
+}
+
+function removeSquirrelResidualPaths({ appDirectory, updateExecutable }) {
+  rmSync(appDirectory, {
+    force: true,
+    maxRetries: 10,
+    recursive: true,
+    retryDelay: 250,
+  });
+  rmSync(updateExecutable, { force: true });
+}
+
 async function waitForAbsent(
   paths,
   { existsImpl = existsSync, timeoutMs = 60_000, intervalMs = 250 } = {},
```

**File**: `scripts/electron/windows-squirrel-rc-smoke.test.mjs` (modified, +96/-15)
```diff
@@ -147,41 +147,81 @@ describe("Windows Squirrel RC smoke", () => {
   });
 
   it("卸载只操作候选 Update.exe，并等待安装目录与快捷方式消失", async () => {
+    const updateExecutable =
+      "C:\\Users\\runner\\AppData\\Local\\lime\\Update.exe";
+    const appDirectory = "C:\\Users\\runner\\AppData\\Local\\lime\\app-1.2.3";
+    const executable = `${appDirectory}\\Lime.exe`;
+    const shortcut = "C:\\Users\\runner\\Desktop\\Lime.lnk";
     const runProcessImpl = vi.fn().mockResolvedValue({ exitCode: 0 });
-    const exists = vi.fn().mockReturnValue(false);
+    const retainedPaths = new Set([updateExecutable, appDirectory]);
+    const exists = vi.fn((target) => retainedPaths.has(target));
     const waitForAbsentImpl = vi.fn().mockResolvedValue(undefined);
+    const waitForProcessExitImpl = vi.fn().mockResolvedValue({
+      executable: updateExecutable,
+      exitCode: 0,
+      timeoutMs: 60_000,
+    });
+    const removeResidualPathsImpl = vi.fn((paths) => {
+      retainedPaths.delete(paths.appDirectory);
+      retainedPaths.delete(paths.updateExecutable);
+    });
     const result = await uninstallInstalledSquirrel({
-      updateExecutable: "C:\\Users\\runner\\AppData\\Local\\lime\\Update.exe",
-      appDirectory: "C:\\Users\\runner\\AppData\\Local\\lime\\app-1.2.3",
-      executable:
-        "C:\\Users\\runner\\AppData\\Local\\lime\\app-1.2.3\\Lime.exe",
-      shortcutPaths: ["C:\\Users\\runner\\Desktop\\Lime.lnk"],
+      updateExecutable,
+      appDirectory,
+      executable,
+      shortcutPaths: [shortcut],
       runProcessImpl,
       existsImpl: exists,
+      removeResidualPathsImpl,
       waitForAbsentImpl,
+      waitForProcessExitImpl,
     });
 
     expect(runProcessImpl).toHaveBeenCalledWith(
-      "C:\\Users\\runner\\AppData\\Local\\lime\\Update.exe",
+      updateExecutable,
       ["--uninstall"],
       expect.objectContaining({ captureOutput: true, timeoutMs: 30_000 }),
     );
-    expect(waitForAbsentImpl).toHaveBeenCalledWith(
-      [
-        "C:\\Users\\runner\\AppData\\Local\\lime\\Update.exe",
-        "C:\\Users\\runner\\AppData\\Local\\lime\\app-1.2.3",
-        "C:\\Users\\runner\\AppData\\Local\\lime\\app-1.2.3\\Lime.exe",
-        "C:\\Users\\runner\\Desktop\\Lime.lnk",
-      ],
+    expect(waitForAbsentImpl).toHaveBeenNthCalledWith(
+      1,
+      [executable, shortcut],
+      expect.objectContaining({ timeoutMs: 60_000 }),
+    );
+    expect(waitForProcessExitImpl).toHaveBeenCalledWith(updateExecutable, {
+      timeoutMs: 60_000,
+    });
+    expect(removeResidualPathsImpl).toHaveBeenCalledWith({
+      appDirectory,
+      updateExecutable,
+    });
+    expect(waitForAbsentImpl).toHaveBeenNthCalledWith(
+      2,
+      [updateExecutable, appDirectory, executable, shortcut],
       expect.objectContaining({ timeoutMs: 60_000 }),
     );
+    expect(waitForAbsentImpl.mock.invocationCallOrder[0]).toBeLessThan(
+      waitForProcessExitImpl.mock.invocationCallOrder[0],
+    );
+    expect(waitForProcessExitImpl.mock.invocationCallOrder[0]).toBeLessThan(
+      removeResidualPathsImpl.mock.invocationCallOrder[0],
+    );
     expect(result).toMatchObject({
       commandAccepted: true,
       exitCode: 0,
       appDirectoryAbsent: true,
       executableAbsent: true,
       shortcutsAbsent: true,
       warning: null,
+      productRemoval: {
+        executableAbsent: true,
+        shortcutsAbsent: true,
+      },
+      retainedPathCleanup: {
+        retainedBeforeCleanup: {
+          appDirectory: true,
+          updateExecutable: true,
+        },
+      },
     });
   });
 
@@ -203,7 +243,9 @@ describe("Windows Squirrel RC smoke", () => {
           .fn()
           .mockResolvedValue({ exitCode: 1, stderr, stdout: "" }),
         existsImpl: vi.fn().mockReturnValue(false),
+        removeResidualPathsImpl: vi.fn(),
         waitForAbsentImpl,
+        waitForProcessExitImpl: vi.fn().mockResolvedValue({ exitCode: 0 }),
       }),
     ).resolves.toMatchObject({
       commandAccepted: true,
@@ -214,7 +256,46 @@ describe("Windows Squirrel RC smoke", () => {
       shortcutsAbsent: true,
       warning: "missing-registry-subkey",
     });
-    expect(waitForAbsentImpl).toHaveBeenCalledOnce();
+    expect(waitForAbsentImpl).toHaveBeenCalledTimes(2);
+  });
+
+  it("拒绝清理不属于同一 Squirrel 安装布局的路径", async () => {
+    const runProcessImpl = vi.fn();
+
+    await expect(
+      uninstallInstalledSquirrel({
+        updateExecutable: "C:\\runner\\lime\\Update.exe",
+        appDirectory: "C:\\runner\\other\\app-1.2.3",
+        executable: "C:\\runner\\other\\app-1.2.3\\Lime.exe",
+        runProcessImpl,
+      }),
+    ).rejects.toThrow(
+      "Squirrel uninstall paths must identify Lime.exe under one app-* directory beside Update.exe",
+    );
+    expect(runProcessImpl).not.toHaveBeenCalled();
+  });
+
+  it("产品文件未被 Squirrel 移除时不得用 runner 清理掩盖失败", async () => {
+    const removeResidualPathsImpl = vi.fn();
+
+    await expect(
+      uninstallInstalledSquirrel({
```

---

### Incident Patch 14: `9341eb29` (2026-09-04)
**Commit Message**: fix(release): recover v1.140.0 Windows gates

**File**: `.github/workflows/build-windows-test.yml` (modified, +9/-0)
```diff
@@ -282,6 +282,15 @@ jobs:
             --native-host-summary ".lime/qc/gui-evidence/windows-native-host-gate-b/summary.json" \
             --output ".lime/qc/gui-evidence/windows-packaged-evidence/$VERSION/summary.json"
 
+      - name: Uninstall Windows Squirrel candidate
+        if: ${{ always() }}
+        shell: bash
+        run: |
+          set -euo pipefail
+          VERSION="$(node -p "require('./package.json').version")"
+          node scripts/electron/windows-squirrel-rc-smoke.mjs \
+            --cleanup-summary ".lime/qc/windows-squirrel-rc/$VERSION/summary.json"
+
       - name: Upload Windows Squirrel RC evidence
         if: ${{ always() }}
         uses: actions/upload-artifact@v4
```

**File**: `.github/workflows/release.yml` (modified, +9/-0)
```diff
@@ -558,6 +558,15 @@ jobs:
             --native-host-summary ".lime/qc/gui-evidence/windows-native-host-gate-b/summary.json" \
             --output ".lime/qc/gui-evidence/windows-packaged-evidence/$VERSION/summary.json"
 
+      - name: Uninstall Windows Squirrel candidate
+        if: ${{ always() && matrix.host_platform == 'win32' }}
+        shell: bash
+        run: |
+          set -euo pipefail
+          VERSION="$(node -p "require('./package.json').version")"
+          node scripts/electron/windows-squirrel-rc-smoke.mjs \
+            --cleanup-summary ".lime/qc/windows-squirrel-rc/$VERSION/summary.json"
+
       - name: Upload Windows Squirrel RC evidence
         if: ${{ always() && matrix.host_platform == 'win32' }}
         uses: actions/upload-artifact@v4
```

**File**: `internal/exec-plans/release-v1.140.0-plan.md` (modified, +9/-3)
```diff
@@ -1,6 +1,6 @@
 # Lime v1.140.0 发布执行计划
 
-状态：`ready_for_release`
+状态：`release_recovery_in_progress`
 日期：2026-09-04
 目标版本：`1.140.0`
 目标 tag：`v1.140.0`
@@ -40,7 +40,13 @@
 - `npm run i18n:check`：通过；5 locales、34,716/34,716 keys，missing/extra 均为 0。
 - `npm run governance:legacy-report`：通过；零引用候选、分类漂移、边界违规均为 0。
 - `git diff --check`：通过；目标 tag 在本地和远端均不存在。
-- 待执行：重新暂存并复核并发候选差异、release commit/tag、推送 `origin/main` 和 tag，以及远端状态复核。
+- Release commit `1fe2ad260bb080a94a8dbda9e0d954f6747091bf`、本地/远端 `main` 与 `v1.140.0` tag 已完成并复核一致。
+- Quality run `33820999125`：Bridge/Contracts、Frontend Full、GUI Smoke、Rust Full 与 Integrity 全绿；`Windows Shell Runtime` 的 timeout contract 使用 `Start-Sleep -Seconds 10`，在进入 20ms 进程超时路径前被生产长休眠策略正确拒绝，因此测试失败。远端 run 随后被移除，无法继续下载日志。
+- 首次 Release run `33821027658`：macOS x64/arm64 打包、签名、公证、资源校验与 packaged native-host Gate B 通过；Windows 安装、N-1 更新、候选 `1.140.0` App Server 初始化和 SHELL-01 GUI smoke 通过，随后在 `Update.exe --uninstall` 清理已不存在的注册表子键时退出 1，导致 Windows 后续 Gate B 与资产发布跳过。GitHub Release 已创建为 draft，尚无资产。
+- 失败复盘同时发现生命周期契约矛盾：Squirrel smoke 在 workflow 后续 CodeMode/native-host Gate B 前卸载候选，而 packaged evidence validator 又同时要求卸载成功和已安装 exe 存在。恢复补丁将卸载移动到全部 installed packaged Gate B 与身份校验之后；卸载仅容忍同时包含缺失子键文本、`RegistryKey.DeleteSubKeyTree` 与 `Squirrel.Update.Program.<Uninstall>` 的明确幂等错误，仍要求 Update.exe、候选目录、主程序与快捷方式全部消失，其他错误继续 fail closed。
+- 恢复补丁本地验证：Windows Squirrel/packaged evidence/release workflow guard 定向 Vitest 3 文件 `66/66`；`npm run typecheck`、`npm run test:contracts`、`npm run verify:app-version`、`npm run governance:scripts`、release workflow guard、Prettier check 与 `git diff --check` 全部通过。
+- Windows timeout 恢复补丁将测试负载改为不触发 shell 策略但仍可由 timeout 终止的 `.NET Thread.Sleep`，并给 Unix-only imports/helper 补齐 `cfg(unix)`，消除日志中的 4 个 `app-server` Windows 编译警告。本机 `npm run test:rust:related -- lime-rs/crates/app-server/src/command_exec/tests.rs lime-rs/crates/app-server/src/process/tests.rs` 通过 `1759/1759`，`cargo fmt --check` 通过；Windows 专属分支待恢复后的 Quality run 验证。
+- 待执行：单独确认后提交并推送修复；通过 `workflow_dispatch version=v1.140.0` 从后续 `main` 修复提交重建资产，不移动已推送 tag；监控 GitHub Release 发布、CLI 资产与 R2 updater 完成。
 
 ## 收尾分类
 
@@ -49,4 +55,4 @@
 - `deprecated`：无新增。
 - `dead / deleted`：旧 `lime-cli-npm` 包、旧 CLI skill/工具文档与其专用入口。
 
-当前完成度：`80%`；版本 metadata、双语 release notes、质量门禁和候选范围已完成，待执行 git 写操作与远端发布复核。
+当前完成度：`85%`；版本 metadata、双语 release notes、原始 release commit/tag/push 已完成，正在修复 Windows 发布门禁并恢复远端资产发布。
```

**File**: `lime-rs/crates/app-server/src/command_exec/tests.rs` (modified, +4/-1)
```diff
@@ -1,7 +1,10 @@
 use super::*;
+#[cfg(unix)]
 use app_server_protocol::protocol::v2::CommandExecTerminalSize;
+#[cfg(unix)]
 use tokio::sync::mpsc;
 
+#[cfg(unix)]
 fn server_with_notifications() -> (
     CommandExecServer,
     mpsc::UnboundedReceiver<(ConnectionId, JsonRpcNotification)>,
@@ -312,7 +315,7 @@ async fn windows_timeout_returns_canonical_exit_code() {
         std::time::Duration::from_secs(5),
         CommandExecServer::default().exec(
             ConnectionId(9),
-            windows_exec_params("Start-Sleep -Seconds 10"),
+            windows_exec_params("[System.Threading.Thread]::Sleep(10000)"),
         ),
     )
     .await
```

**File**: `lime-rs/crates/app-server/src/process/tests.rs` (modified, +3/-0)
```diff
@@ -1,7 +1,10 @@
 use super::*;
+#[cfg(unix)]
 use app_server_protocol::protocol::v2::ProcessTerminalSize;
+#[cfg(unix)]
 use tokio::sync::mpsc;
 
+#[cfg(unix)]
 fn server_with_notifications() -> (
     ProcessServer,
     mpsc::UnboundedReceiver<(ConnectionId, JsonRpcNotification)>,
```

**File**: `scripts/electron/lib/windows-squirrel-n-minus-one.mjs` (modified, +46/-5)
```diff
@@ -15,6 +15,8 @@ import { chromium } from "playwright";
 
 const PRODUCT_NAME = "Lime";
 const SQUIRREL_PACKAGE_NAME = "lime";
+const MISSING_REGISTRY_SUBKEY_MESSAGE =
+  "Cannot delete a subkey tree because the subkey does not exist.";
 
 export function normalizeVersion(value) {
   const version = String(value || "")
@@ -215,6 +217,25 @@ export async function stopInstalledApp(executable) {
   return { executable, exitCode: result.exitCode };
 }
 
+export function classifySquirrelUninstallResult({
+  exitCode,
+  stderr = "",
+  stdout = "",
+} = {}) {
+  if (exitCode === 0) {
+    return { accepted: true, warning: null };
+  }
+  const output = `${stdout}\n${stderr}`;
+  const missingRegistrySubkey =
+    output.includes(MISSING_REGISTRY_SUBKEY_MESSAGE) &&
+    output.includes("Microsoft.Win32.RegistryKey.DeleteSubKeyTree") &&
+    output.includes("Squirrel.Update.Program.<Uninstall>");
+  return {
+    accepted: missingRegistrySubkey,
+    warning: missingRegistrySubkey ? "missing-registry-subkey" : null,
+  };
+}
+
 export async function uninstallInstalledSquirrel({
   updateExecutable,
   appDirectory,
@@ -234,10 +255,12 @@ export async function uninstallInstalledSquirrel({
     );
   }
   const result = await runProcessImpl(updateExecutable, ["--uninstall"], {
+    captureOutput: true,
     env: process.env,
     timeoutMs: 30_000,
   });
-  if (result.exitCode !== 0) {
+  const classification = classifySquirrelUninstallResult(result);
+  if (!classification.accepted) {
     throw new Error(
       `Squirrel uninstall exited with ${result.exitCode} at ${updateExecutable}`,
     );
@@ -253,7 +276,9 @@ export async function uninstallInstalledSquirrel({
     appDirectory,
     executable,
     shortcutPaths: [...shortcutPaths],
+    commandAccepted: classification.accepted,
     exitCode: result.exitCode,
+    warning: classification.warning,
     updateExecutableAbsent: !existsImpl(updateExecutable),
     appDirectoryAbsent: !existsImpl(appDirectory),
     executableAbsent: !existsImpl(executable),
@@ -597,14 +622,26 @@ async function waitFor(
   throw new Error(`timed out waiting for ${label}`);
 }
 
-function runProcess(command, args, { env, timeoutMs }) {
+function runProcess(command, args, { captureOutput = false, env, timeoutMs }) {
   return new Promise((resolve, reject) => {
     const child = spawn(command, args, {
       env,
       shell: false,
-      stdio: "inherit",
+      stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
       windowsHide: true,
     });
+    let stdout = "";
+    let stderr = "";
+    if (captureOutput) {
+      child.stdout?.on("data", (chunk) => {
+        stdout += chunk.toString();
+        process.stdout.write(chunk);
+      });
+      child.stderr?.on("data", (chunk) => {
+        stderr += chunk.toString();
+        process.stderr.write(chunk);
+      });
+    }
     let timedOut = false;
     const timeout = setTimeout(() => {
       timedOut = true;
@@ -614,15 +651,19 @@ function runProcess(command, args, { env, timeoutMs }) {
       clearTimeout(timeout);
       reject(error);
     });
-    child.once("exit", (code, signal) => {
+    child.once("close", (code, signal) => {
       clearTimeout(timeout);
       if (timedOut) {
         reject(
           new Error(`${path.basename(command)} timed out after ${timeoutMs}ms`),
         );
         return;
       }
-      resolve({ exitCode: code ?? 1, signal });
+      resolve({
+        exitCode: code ?? 1,
+        signal,
+        ...(captureOutput ? { stderr, stdout } : {}),
+      });
     });
   });
 }
```

**File**: `scripts/electron/release-workflow-guard.mjs` (modified, +45/-0)
```diff
@@ -613,6 +613,51 @@ function assertBuildSteps(buildJob) {
     );
   }
 
+  const windowsRcCleanupStep = stepByName(
+    steps,
+    "Uninstall Windows Squirrel candidate",
+  );
+  assertIncludes(
+    windowsRcCleanupStep?.if,
+    "always()",
+    "Windows Squirrel cleanup condition",
+  );
+  assertIncludes(
+    windowsRcCleanupStep?.if,
+    "matrix.host_platform == 'win32'",
+    "Windows Squirrel cleanup condition",
+  );
+  for (const required of [
+    "scripts/electron/windows-squirrel-rc-smoke.mjs",
+    "--cleanup-summary",
+    ".lime/qc/windows-squirrel-rc",
+  ]) {
+    assertIncludes(
+      windowsRcCleanupStep?.run,
+      required,
+      "Windows Squirrel cleanup",
+    );
+  }
+  const smokeIndex = steps.indexOf(windowsRcSmokeStep);
+  const codeModeIndex = steps.indexOf(windowsCodeModeStep);
+  const nativeHostIndex = steps.indexOf(windowsNativeHostStep);
+  const packagedEvidenceIndex = steps.indexOf(windowsPackagedEvidenceStep);
+  const cleanupIndex = steps.indexOf(windowsRcCleanupStep);
+  const evidenceUploadIndex = steps.indexOf(windowsRcEvidenceStep);
+  if (
+    !(
+      smokeIndex < codeModeIndex &&
+      codeModeIndex < nativeHostIndex &&
+      nativeHostIndex < packagedEvidenceIndex &&
+      packagedEvidenceIndex < cleanupIndex &&
+      cleanupIndex < evidenceUploadIndex
+    )
+  ) {
+    throw new Error(
+      "Windows Squirrel cleanup must run after installed packaged Gate B validation and before evidence upload",
+    );
+  }
+
   const windowsPackagedEvidenceUploadStep = stepByName(
     steps,
     "Upload Windows packaged Gate B evidence identity",
```

**File**: `scripts/electron/release-workflow-guard.test.mjs` (modified, +14/-0)
```diff
@@ -118,6 +118,20 @@ describe("Electron release workflow guard", () => {
     );
   });
 
+  it("rejects release workflow that omits deferred Windows Squirrel cleanup", () => {
+    const current = fs.readFileSync(".github/workflows/release.yml", "utf8");
+    const workflowPath = tempWorkflowPath(
+      current.replace(
+        /      - name: Uninstall Windows Squirrel candidate[\s\S]*?            --cleanup-summary .*?\n\n/,
+        "",
+      ),
+    );
+
+    expect(() => validateReleaseWorkflow({ workflowPath })).toThrow(
+      /Windows Squirrel cleanup condition must include always\(\)/,
+    );
+  });
+
   it("rejects release workflow without checkout-bound candidate identity", () => {
     const current = fs.readFileSync(".github/workflows/release.yml", "utf8");
     const workflowPath = tempWorkflowPath(
```

---

### Incident Patch 15: `41f42c80` (2026-09-02)
**Commit Message**: docs: fix feature map ownership table

**File**: `FEATURE-MAP.md` (modified, +23/-23)
```diff
@@ -47,29 +47,29 @@ Desktop GUI 业务能力只通过 App Server JSON-RPC 进入 Rust runtime。Elec
 
 ## 3. Feature Ownership Map
 
-| Feature                        | 用户能力                                                                  | 当前用户入口                                      | Current owner / 稳定边界                                                                                    | 状态与事实源                                                                                                                                                                                                |
-| ------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
-| Agent 任务与对话               | 从目标启动任务，持续执行、取消、恢复和查看 Thread / Turn / Item           | “新建任务”与 Agent Workspace                      | `app-server`、`agent-runtime`、`agent`、`thread-store`；typed Thread/Turn API 与 canonical projection       | `current`；[架构](./internal/aiprompts/architecture.md)、[Query Loop](./internal/aiprompts/query-loop.md)                                                                                                   |
-| 协作模式与 Multi-Agent         | 选择 Default / Plan，并让子 Agent 分工后回到主 Thread                     | Composer 模式选择与 Agent 运行过程                | `collaborationMode/list`、`agent-runtime`、subagent Thread/Turn 与同一 projection                           | `current`；[任务与 Agent taxonomy](./internal/aiprompts/task-agent-taxonomy.md)、[命令边界](./internal/aiprompts/commands.md)                                                                               |
-| Workspace、项目与文件          | 选择项目目录，浏览、读取、写入和预览项目文件                              | Agent Workspace、文件浏览器与 Right Surface       | App Server workspace/repository；`fs/*`；Electron 仅提供系统目录选择与文件壳能力                            | `current`；[Workspace 边界](./internal/aiprompts/workspace.md)、[命令边界](./internal/aiprompts/commands.md)                                                                                                |
-| 终端与后台进程                 | 执行一次性命令、交互终端并管理 Thread-owned 后台进程                      | Workspace 终端与命令 Item                         | `command/exec*`、`process/*`、`thread/backgroundTerminals/*`；`tool-runtime` process supervisor             | `current`；[命令边界](./internal/aiprompts/commands.md)                                                                                                                                                     |
-| 工具、审批与执行策略           | 调用本地工具，在危险操作前审批，并按工作区策略限制执行                    | Agent 工具 Item、审批交互与设置                   | `tool-runtime`；`permissionProfile/list`；App Server server-request；canonical tool Item                    | `current`；[命令边界](./internal/aiprompts/commands.md)、[质量工作流](./internal/aiprompts/quality-workflow.md)                                                                                             |
-| Browser Workspace              | 在同一可见浏览器中由用户或 Agent 浏览、操作、下载和接管                   | Right Surface 的 Electron `WebContentsView`       | `BrowserTabHost`、Renderer browser gateway、App Server dynamic-tool host；同一 tab/view owner               | `current`；[命令边界](./internal/aiprompts/commands.md)                                                                                                                                                     |
-| Provider、模型与凭证           | 配置模型服务，选择模型，并按 capability/readiness 路由请求                | 设置中的模型与服务、Composer Model Selector       | `model-provider`；catalog、route、credential readiness、canonical content、lowering、stream、retry/breaker  | `current`；[Provider 系统](./internal/aiprompts/providers.md)                                                                                                                                               |
-| 多模态与媒体生成               | 在同一任务中理解或生成图片、音频、视频和其他媒体产物                      | Composer、Agent Workspace 与 artifact/workbench   | `model-provider` 负责 sampling/lowering；`media-runtime` 负责媒体任务；Thread/Artifact 持有结果事实         | `current`；[架构](./internal/aiprompts/architecture.md)、[持久化地图](./internal/aiprompts/persistence-map.md)                                                                                              |
-| 官方任务 CLI                   | 以结构化 JSON 运行媒体与内容任务、查看任务状态、发现 Skill 和执行诊断     | `lime task`、`lime skill`、`lime doctor`          | `lime-cli` 与 `media-runtime`；CLI 是独立入口，不定义 Desktop Thread/Turn/Item 协议                         | `current`；[CLI 源码](./lime-rs/crates/lime-cli/)、[架构](./intern
```

#### Recent Merged Pull Requests:
- **PR #142** (2026-04-15): fix: serialize release asset publishing (@wutongci)
- **PR #138** (2026-03-19): feat: add Novita AI provider (OpenAI-compatible) (@Alex-yang00)
- **PR #121** (2026-01-13): fix(ui): 修复自定义模型无法在模型选择器中显示的问题 (@Chiron-Brahm)
- **PR #120** (2026-01-13): fix(server): 修复监听地址配置不生效的问题 (#110) (@Chiron-Brahm)
- **PR #111** (2026-01-12): feat(i18n): add additional disctionary for english language (@tjengbudi)
- **PR #109** (2026-01-12): fix: 修复凭证代理设置无法清空的问题 (@Chiron-Brahm)
- **PR #108** (2026-01-12): feat: 动态检测 IP 地址变化并自动更新 (@Chiron-Brahm)
- **PR #105** (2026-01-11): feat: 添加开发模式 HTTP 桥接，支持浏览器 dev server 与 Tauri 后端通信 (@lwmacct)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
