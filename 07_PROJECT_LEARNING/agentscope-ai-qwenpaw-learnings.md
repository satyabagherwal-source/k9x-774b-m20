# Forensic Learning Record (Deep Inspection): agentscope-ai/QwenPaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentscope-ai-qwenpaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agentscope-ai/QwenPaw](https://github.com/agentscope-ai/QwenPaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:06:03.286Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agentscope-ai/QwenPaw`
- **Description**: Your Personal AI Assistant; easy to install, deploy on your own machine or on the cloud; supports multiple chat apps with easily extensible capabilities.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 35452 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `console/src-tauri/src/computer_use_server/state.rs`
```
//! What the platform leaves share: the shape of a window, an observation, and
//! the per-connection store that ties an action back to what was observed.
//!
//! Every `use super::super::` in a platform leaf resolves here, which is the
//! boundary this module is drawn along: nothing in it touches an OS API, and
//! everything in it has to mean the same thing on both platforms. The limits
//! that shape an observation live here for the same reason -- a screenshot
//! delivered at different sizes per platform, or document text truncated at
//! different lengths, would make the observation contract platform-dependent.

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

#[cfg(target_os = "macos")]
use super::platform_macos::HostFocusLease;

/// Platform resources retained while one agent turn interacts with the desktop.
///
/// The lifecycle is shared even though the native resource is not: macOS keeps
/// the desktop host from reclaiming focus, while Windows already targets and
/// verifies the foreground window for each action.
struct InteractionSession {
    #[cfg(target_os = "macos")]
    _host_focus: HostFocusLease,
}

impl InteractionSession {
    fn begin() -> Result<Self, (&'static str, String)> {
        #[cfg(target_os = "macos")]
        {
            return Ok(Self {
                _host_focus: HostFocusLease::begin()?,
            });
        }
        #[cfg(windows)]
        {
            Ok(Self {})
        }
    }
}

/// Native accessibility element handle stored with an observation.
/// Windows uses a UI Automation element; macOS uses an AXUIElement wrapper.
#[cfg(windows)]
pub(super) type NativeElement = windows::Win32::UI::Accessibility::IUIAutomationElement;
#[cfg(target_os = "macos")]
pub(super) type NativeElement = super::platform_macos::AxElement;

// Raw window captures are 32bpp bitmaps; re-encode them as JPEG so a
// single screenshot costs hundreds of kilobytes instead of tens of
// megabytes once it is base64-encoded into the response payload.
pub(super) const SCREENSHOT_JPEG_QUALITY: f32 = 0.8;

// Cap the longest edge of a delivered screenshot. High-resolution
// displays (for example 4K) would otherwise produce multi-megabyte
// base64 payloads that inflate the response and the model's image cost.
// Downscaling to a bounded edge keeps the payload small while leaving
// enough detail for reading on-screen text and controls.
pub(super) const SCREENSHOT_MAX_EDGE: u32 = 1600;

// Only the Windows capture path decodes raw bitmaps.
#[cfg(windows)]
pub(super) const BMP_HEADER_BYTES: usize = 54;

/// Upper bound on the document text handed back with an observation. A large
/// document would otherwise dominate the model's context, and the leading
/// portion is what identifies the current state.
pub(super) const DOC_TEXT_MAX: usize = 4000;

/// Upper bound on actionable elements delivered with one observation.
pub(super) const ACCESSIBILITY_MAX_ELEMENTS: usize = 300;

/// Minimum idle time after our own input before another action may run.
///
/// The input guard uses the same boundary. Keeping one value prevents a normal
/// observe-after-action cycle from mistaking the helper's synthetic event for
/// fresh user input.
pub(super) const INPUT_GUARD_GRACE_MS: u32 = 750;
// A macOS application can paint a changed view before its accessibility
// children are ready. Keep observations behind that short lag; Windows UIA
// settles inside the existing input-grace window and should not pay it.
#[cfg(target_os = "macos")]
const ACTION_SETTLE_DELAY: Duration = Duration::from_millis(1_500);
#[cfg(windows)]
const ACTION_SETTLE_DELAY: Duration = Duration::from_millis(INPUT_GUARD_GRACE_MS as u64);

static NEXT_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
pub(super) struct WindowInfo {
    pub(super) hwnd: isize,
    #[cfg(target_os = "macos")]
    pub(super) owner_pid: i32,
    pub(super) app_id: String,
    pub(super) display_name: String,
    pub(super) title: String,
    // Windows matches this against its credential-dialog guard. macOS has no
    // equivalent notion of a window class and recognises those dialogs by
    // title and owner instead.
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    pub(super) class_name: String,
}

impl WindowInfo {
    pub(super) fn matches_app(&self, value: &str) -> bool {
        self.app_id == value || self.display_name.eq_ignore_ascii_case(value)
    }

    pub(super) fn to_json(&self) -> Value {
        json!({
            "app_id": self.app_id,
            "id": self.hwnd.to_string(),
            "title": self.title,
        })
    }
}

/// Native geometry for one screenshot delivered with an observation.
#[derive(Debug)]
pub(super) struct ScreenshotTarget {
    pub(super) hwnd: isize,
    pub(super) bounds: [i32; 4],
    pub(super) display_width: u32,
    pub(super) display_height: u32,
}

/// Everything an action needs from one observed window.
///
/// Observation and screenshot IDs are the only native context exposed to the
/// model. Window and accessibility handles remain local, while screenshot IDs
/// are opaque keys into this observation.
pub(super) struct Observation {
    pub(super) window: WindowInfo,
    /// Stable target geometry, retained even for accessibility-only reads.
    pub(super) window_bounds: [i32; 4],
    pub(super) screenshots: HashMap<String, ScreenshotTarget>,
    #[cfg(windows)]
    pub(super) input_hwnd: isize,
    /// Digest of the normalized accessibility surface the model observed.
    /// Kept native-side so callers cannot copy or forge a revision token.
    pub(super) accessibility_revision: Option<[u8; 32]>,
    /// Whether this exact macOS surface can accept one text action through an
    /// application-owned editor that is absent from its accessibility tree.
    #[cfg(target_os = "macos")]
    pub(super) transient_text_ready: bool,
    pub(super) elements: HashMap<String, NativeElement>,
}

/// Create a stable revision for an available accessibility surface.
pub(super) fn accessibility_revision(accessibility: &Value) -> Option<[u8; 32]> {
    if accessibility.get("available").and_then(Value::as_bool) != Some(true) {
        return None;
    }
    let encoded = serde_json::to_vec(accessibility).ok()?;
    Some(Sha256::digest(encoded).into())
}

/// A native edit that changed a control's buffer but still needs the control's
/// semantic completion action before the surrounding application owns it.
///
/// The shared runtime only knows that `invoke_element` must finish the action.
/// Element identity and the completion mechanism remain native concerns, so
/// this applies to any application exposing the same accessibility semantics
/// without naming an application or control type here.
pub(super) struct PendingAction {
    pub(super) hwnd: isize,
    pub(super) element: NativeElement,
    pub(super) expected_value: String,
}

impl PendingAction {
    pub(super) fn to_json(&self) -> Value {
        json!({
            "status": "requires_completion",
            "required_action": "invoke",
            "expected_value": self.expected_value,
        })
    }
}

#[derive(Default)]
pub(super) struct ServerState {
    pub(super) observations: HashMap<String, Observation>,
    pending_action: Option<PendingAction>,
    last_action_at: HashMap<isize, Instant>,
    global_action_at: Option<Instant>,
    interaction_session: Option<InteractionSession>,
}

impl ServerState {
    /// A desktop mutation makes every snapshot of that application stale.
    pub(super) fn note_action(&mut self, window: &WindowInfo) {
        self.observations
            .retain(|_, observation| observation.window.app_id != window.app_id);
        self.last_action_at.insert(window.hwnd, Instant::now());
    }

    pub(super) fn note_global_action(&mut self) {
        self.observations.clear();
        self.global_action_at = Some(Instant::now());
    }

    pub(super) fn pending_action(&self) -> Option<&PendingAction> {
        self.pending_action.as_ref()
    }

    pub(super) fn set_pending_action(&mut self, action: PendingAction) {
        self.pending_action = Some(action);
    }

    pub(super) fn clear_pending_action(&mut self) {
        self.pending_action = None;
    }

    /// Wait out only the remainder of the short post-action settling window.
    pub(super) fn settle_before_observe(&mut self, hwnd: isize) {
        let started = self
            .last_action_at
            .remove(&hwnd)
            .or_else(|| self.global_action_at.take());
        let Some(started) = started else { return };
        if let Some(remaining) = ACTION_SETTLE_DELAY.checked_sub(started.elapsed()) {
            std::thread::sleep(remaining);
        }
    }

    pub(super) fn clear_turn(&mut self) {
        self.observations.clear();
        self.pending_action = None;
        self.last_action_at.clear();
        self.global_action_at = None;
        self.interaction_session = None;
    }

    pub(super) fn ensure_interaction_session(&mut self) -> Result<(), (&'static str, String)> {
        if self.interaction_session.is_none() {
            self.interaction_session = Some(InteractionSession::begin()?);
        }
        Ok(())
    }

    /// Discard point-in-time state after input outside the current action.
    ///
    /// This is deliberately not a sticky turn stop. The refused action may
    /// have had no effect or may have raced with the user, so callers must
    /// observe again before deciding what to do next.
    pub(super) fn invalidate_observations(&mut self) {
        self.observations.clear();
        self.pending_action = None;
        self.interaction_session = None;
    }
}

/// Bound document text by character count, flagging that more remains.
///
/// Counting characters rather than bytes keeps multi-byte text intact.
pub(super) fn truncate_document_text(text: String) -> String {
    if text.chars().coun
```

### Core Architecture Module: `console/src/components/Chat/MediaDownload/utils.ts`
```
function decodeFilename(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function mediaFilenameFromUrl(
  url: string,
  fallbackFilename: string,
): string {
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return fallbackFilename;
  }
  const path = url.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  const filename = path.split("/").pop();
  return filename ? decodeFilename(filename) : fallbackFilename;
}

```

### Core Architecture Module: `console/src/components/Chat/ToolCards/shared/utils.ts`
```
/**
 * Shared utility functions for tool cards.
 * Extracted from ToolCallBlock.tsx for reuse across individual card plugins.
 */

import type { TFunction } from "i18next";
import type { ToolCallContent } from "./types";
import { mediaFilenameFromUrl } from "../../MediaDownload/utils";
import { chatApi } from "@/api/modules/chat";

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/** Convert a backend file/image URL to a displayable URL */
export function toDisplayUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("file://")) url = url.replace("file://", "");
  return chatApi.filePreviewUrl(url.startsWith("/") ? url : `/${url}`);
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/** Extract short file name from a path */
export function shortFileName(filePath: string): string {
  const filename = mediaFilenameFromUrl(filePath, "");
  if (filename) return filename;
  return filePath.startsWith("data:") || filePath.startsWith("blob:")
    ? ""
    : filePath;
}

/** Count lines in a string */
export function countLines(text: unknown): number {
  if (typeof text !== "string" || !text) return 0;
  return text.split("\n").length;
}

/** Get language identifier from file extension for syntax highlighting */
export function getFileLanguage(tc: ToolCallContent): string {
  const params = tc.params || {};
  const filePath = (
    (params.file_path || params.path || "") as string
  ).toLowerCase();
  const ext = filePath.match(/\.([^.]+)$/)?.[1] || "";

  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    cs: "csharp",
    cpp: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    html: "html",
    css: "css",
    less: "less",
    scss: "scss",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    xml: "xml",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    md: "markdown",
    txt: "text",
    conf: "ini",
    ini: "ini",
    dockerfile: "dockerfile",
    makefile: "makefile",
    vue: "vue",
    svelte: "svelte",
    dart: "dart",
    php: "php",
    lua: "lua",
    r: "r",
    scala: "scala",
    ex: "elixir",
    exs: "elixir",
  };

  return langMap[ext] || "";
}

// ---------------------------------------------------------------------------
// Media detection
// ---------------------------------------------------------------------------

const IMG_EXTS = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"];
const VIDEO_EXTS = ["mp4", "avi", "mov", "wmv", "flv", "mkv", "webm"];
const AUDIO_EXTS = ["mp3", "wav", "flac", "ape", "aac", "ogg", "wma"];
const INLINE_BASE64_HEAD_LENGTH = 8192;
const INLINE_BASE64_RESULT_THRESHOLD = 64 * 1024;
const INLINE_BASE64_TEXT_TAIL_LENGTH = 64 * 1024;

export type MediaType = "image" | "video" | "audio" | "file";

export interface MediaInfo {
  url: string;
  name: string;
  type: MediaType;
  size?: number;
}

function hasLargeInlineBase64(result: string): boolean {
  return (
    result.length > INLINE_BASE64_RESULT_THRESHOLD &&
    /["']type["']\s*:\s*["']base64["']/i.test(
      result.slice(0, INLINE_BASE64_HEAD_LENGTH),
    )
  );
}

export function getFileExtFromPath(path: string): string {
  const match = path.match(/\.([^.?#]+)(?:[?#]|$)/);
  return match ? match[1].toLowerCase() : "";
}

function classifyMediaType(ext: string): MediaType {
  if (IMG_EXTS.includes(ext)) return "image";
  if (VIDEO_EXTS.includes(ext)) return "video";
  if (AUDIO_EXTS.includes(ext)) return "audio";
  return "file";
}

/**
 * Display filename carried by a content block. agentscope 2.x `DataBlock`
 * stores it as `name`, MCP-style blocks as `filename` / `file_name`.
 */
function blockFilename(b: Record<string, unknown>): string | undefined {
  for (const value of [b.filename, b.file_name, b.name]) {
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

/**
 * Extract a URL and filename from a result that uses the MCP content-block
 * array format, e.g.:
 * `[{"type":"file","source":{"type":"url","url":"file:///..."},"filename":"a.txt"},
 *   {"type":"text","text":"File sent successfully."}]`
 *
 * Also handles `{"type":"image","source":{...}}` etc.
 */
function extractUrlFromResultBlocks(
  result: unknown,
): { url: string; filename?: string } | null {
  let arr: unknown[] | null = null;

  if (typeof result === "string") {
    if (hasLargeInlineBase64(result)) return null;
    try {
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      return null;
    }
  } else if (Array.isArray(result)) {
    arr = result;
  }

  if (!arr) return null;

  for (const block of arr) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;

    // Content blocks with source.url (file / image / video / audio types)
    if (b.source && typeof b.source === "object") {
      const src = b.source as Record<string, unknown>;
      if (typeof src.url === "string" && src.url) {
        return { url: src.url, filename: blockFilename(b) };
      }
    }

    // Flat blocks: { url: "..." } or { path: "..." }
    if (typeof b.url === "string" && b.url) {
      return { url: b.url, filename: blockFilename(b) };
    }
    if (typeof b.path === "string" && b.path) {
      return { url: b.path, filename: blockFilename(b) };
    }
  }

  return null;
}

/** Read the first usable path from params (multiple key variants). */
export function getFileOperationPath(tc: ToolCallContent): string {
  const params = tc.params || {};
  return (params.file_path ||
    params.image_path ||
    params.video_path ||
    params.audio_path ||
    params.path ||
    "") as string;
}

/**
 * Whether a param path can actually be previewed by the backend.
 * The preview endpoint only resolves absolute paths (plus `~`, drive
 * letters and full URLs) — a bare relative path always 404s, so it
 * must not be used as a preview URL fallback.
 */
function isPreviewablePath(path: string): boolean {
  return (
    path.startsWith("/") ||
    path.startsWith("~") ||
    /^[a-zA-Z]:[\\/]/.test(path) ||
    path.startsWith("file://") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:")
  );
}

/** Extract media info from tool params/result (unified for all tool names) */
export function getMediaInfo(tc: ToolCallContent): MediaInfo | null {
  const paramPath = getFileOperationPath(tc);

  // 1) Try to get a reliable URL from result content blocks
  const fromResult = extractUrlFromResultBlocks(tc.result);

  // 2) Try text-based regex extraction (e.g. "saved to /path/to/file")
  let textUrl = "";
  if (!fromResult && tc.result && typeof tc.result === "string") {
    textUrl = extractUrlFromText(tc.result) || "";
  }

  const previewableParamPath = isPreviewablePath(paramPath) ? paramPath : "";
  const rawUrl = fromResult?.url || previewableParamPath || textUrl || "";
  if (!rawUrl) return null;

  const name =
    fromResult?.filename ||
    shortFileName(rawUrl) ||
    shortFileName(paramPath) ||
    "file";
  const ext = getFileExtFromPath(name);
  const mediaType = classifyMediaType(ext);

  return { url: toDisplayUrl(rawUrl), name, type: mediaType };
}

export function hasMultimediaPreview(tc: ToolCallContent): boolean {
  const media = getMediaInfo(tc);
  return Boolean(media && media.type !== "file");
}

/** Try to extract a file URL from a text result via regex patterns */
export function extractUrlFromText(resultStr: string): string | null {
  const searchableResult = hasLargeInlineBase64(resultStr)
    ? resultStr.slice(-INLINE_BASE64_TEXT_TAIL_LENGTH)
    : resultStr;

  // 1. "Saved to" pattern
  const pathMatch = searchableResult.match(
    /(?:saved to|保存到|输出到)[:\s]+([^"\r\n]*?\.(?:png|jpg|jpeg|gif|bmp|webp|svg|mp4|avi|mov|wmv|flv|mkv|webm|mp3|wav|flac|ape|aac|ogg|wma))/i,
  );
  if (pathMatch) return pathMatch[1].trim().replace(/\\\\/g, "\\");

  // 2. Absolute file path with known media extension
  const filePathMatch = searchableResult.match(
    /\/[\w.\-/]+\.(?:png|jpg|jpeg|gif|bmp|webp|svg|mp4|avi|mov|wmv|flv|mkv|webm|mp3|wav|flac|aac|ogg)/i,
  );
  if (filePathMatch) return filePathMatch[0];

  return null;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

interface MemorySearchResultItem {
  path?: string;
  snippet?: string;
  score?: number;
  start_line?: number;
  end_line?: number;
}

/** Generic JSON parse that returns null on failure instead of throwing */
function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isMemorySearchResultItem(
  item: unknown,
): item is MemorySearchResultItem {
  if (!item || typeof item !== "object") return false;

  const candidate = item as Record<string, unknown>;
  // Require "path" plus at least one data field to avoid false positives
  return (
    "path" in candidate &&
    ("score" in candidate ||
      "snippet" in candidate ||
      "start_line" in candidate)
  );
}

function extractMemorySearchItems(
  value: unknown,
  depth = 0,
): MemorySearchResultItem[] | null {
  if (depth > 5) return null;

  if (Array.isArray(value)) {
    if (value.every(isMemorySearchResultItem)) {
      return value;
    }

    for (const item of value) {
      const extracted = extractMemorySearchItems(item, depth +
```

### Core Architecture Module: `console/src/components/LoopInput/LoopModeSelector.tsx`
```
import {
  Boxes,
  ChevronDown,
  CircleDot,
  LoaderCircle,
  MessageCircleQuestion,
  Rocket,
  Settings2,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Popover, Tooltip } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  DEFAULT_LOOP_MODE,
  fetchAvailableLoopModes,
  type LoopModeInfo,
  useLoopStore,
} from "../../stores/loopStore";
import { useIsMobile } from "../../hooks/useIsMobile";
import { OsDrawer } from "../../os/OsOverlay";
import { InlineMarkdown } from "../Markdown/InlineMarkdown";
import {
  resolveLoopModeDescriptionMarkdown,
  resolveLoopModeName,
} from "../../utils/loopModeDescription";
import styles from "./index.module.less";

function ModeIcon({ mode, size = 14 }: { mode: LoopModeInfo; size?: number }) {
  if (mode.id === "goal") return <Target size={size} />;
  if (mode.id === "mission") return <Rocket size={size} />;
  if (mode.source === "custom") return <Sparkles size={size} />;
  if (mode.source === "plugin") return <Boxes size={size} />;
  return <CircleDot size={size} />;
}

interface LoopModeSelectorProps {
  className?: string;
  compact?: boolean;
}

export function LoopModeSelector({
  className,
  compact = false,
}: LoopModeSelectorProps = {}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const availableModes = useLoopStore((state) => state.availableModes);
  const selectedModeId = useLoopStore((state) => state.selectedModeId);
  const sessionState = useLoopStore((state) => state.sessionState);
  const activeMode = useLoopStore((state) => state.activeMode);
  const catalogLoading = useLoopStore((state) => state.catalogLoading);
  const catalogError = useLoopStore((state) => state.catalogError);
  const setSelectedMode = useLoopStore((state) => state.setSelectedMode);

  const selectedMode =
    availableModes.find((mode) => mode.id === selectedModeId) ??
    DEFAULT_LOOP_MODE;
  const builtInModes = useMemo(
    () => availableModes.filter((mode) => mode.source === "builtin"),
    [availableModes],
  );
  const extendedModes = useMemo(
    () => availableModes.filter((mode) => mode.source !== "builtin"),
    [availableModes],
  );

  if (sessionState !== "idle" && activeMode) {
    const modeName = resolveLoopModeName(activeMode, t, lang);
    const tooltip =
      activeMode.source === "custom"
        ? t("loop.activeCustomDescription")
        : t("loop.activePersistentDescription");
    return (
      <Tooltip title={tooltip}>
        <div
          className={[styles.activeMode, className].filter(Boolean).join(" ")}
          aria-label={`${modeName} ${t(`loop.${sessionState}`)}`}
          aria-live="polite"
          data-state={sessionState}
        >
          {sessionState === "starting" && (
            <LoaderCircle className={styles.spin} size={14} />
          )}
          {sessionState === "running" && <ModeIcon mode={activeMode} />}
          {sessionState === "awaiting_user" && (
            <MessageCircleQuestion size={14} />
          )}
          {!compact && (
            <>
              <span>{modeName}</span>
              <span className={styles.activeState}>
                {t(`loop.${sessionState}`)}
              </span>
            </>
          )}
        </div>
      </Tooltip>
    );
  }

  const renderGroup = (title: string, modes: LoopModeInfo[]) => {
    if (modes.length === 0) return null;
    return (
      <section className={styles.modeGroup}>
        <div className={styles.groupLabel}>{title}</div>
        {modes.map((mode) => {
          const selected = mode.id === selectedMode.id;
          return (
            <button
              aria-selected={selected}
              className={`${styles.modeOption} ${
                selected ? styles.selected : ""
              }`}
              key={mode.id}
              onClick={() => {
                setSelectedMode(mode.id);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              <span className={styles.optionIcon}>
                <ModeIcon mode={mode} size={16} />
              </span>
              <span className={styles.optionCopy}>
                <span className={styles.optionName}>
                  {resolveLoopModeName(mode, t, lang)}
                </span>
                <span className={styles.optionDescription}>
                  <InlineMarkdown
                    markdown={resolveLoopModeDescriptionMarkdown(mode, t, lang)}
                  />
                </span>
              </span>
              {selected ? <CircleDot size={15} /> : null}
            </button>
          );
        })}
      </section>
    );
  };

  const settingsButton = (
    <button
      aria-label={t("loop.gotoSettings")}
      className={styles.settingsButton}
      onClick={() => {
        setOpen(false);
        navigate("/agent-config?tab=agentLoop");
      }}
      type="button"
    >
      <Settings2 size={16} />
    </button>
  );

  const content = (
    <div className={styles.modeMenu}>
      <div className={styles.menuHeader}>
        <div>
          <div className={styles.menuTitle}>{t("loop.selectorTitle")}</div>
          <div className={styles.menuHint}>{t("loop.selectorHint")}</div>
        </div>
        <div className={styles.menuActions}>
          {isMobile ? (
            settingsButton
          ) : (
            <Tooltip title={t("loop.gotoSettings")}>{settingsButton}</Tooltip>
          )}
          {isMobile && (
            <button
              aria-label={t("common.close")}
              className={styles.settingsButton}
              onClick={() => setOpen(false)}
              type="button"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      <div className={styles.modeList} role="listbox">
        {renderGroup(t("loop.builtInModes"), builtInModes)}
        {renderGroup(t("loop.customModes"), extendedModes)}
        {catalogError ? (
          <div className={styles.menuError}>
            <span>{t("loop.loadError")}</span>
            <button
              onClick={() => void fetchAvailableLoopModes()}
              type="button"
            >
              {t("loop.retry")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  const triggerButton = (
    <button
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={t("loop.selectorAria")}
      className={[styles.modeTrigger, className].filter(Boolean).join(" ")}
      disabled={catalogLoading && availableModes.length === 0}
      onClick={isMobile ? () => setOpen((current) => !current) : undefined}
      type="button"
    >
      {catalogLoading ? (
        <LoaderCircle className={styles.spin} size={14} />
      ) : (
        <ModeIcon mode={selectedMode} />
      )}
      {!compact && (
        <>
          <span>{resolveLoopModeName(selectedMode, t, lang)}</span>
          <ChevronDown size={13} />
        </>
      )}
    </button>
  );

  if (isMobile) {
    return (
      <>
        {triggerButton}
        <OsDrawer
          aria-label={t("loop.selectorTitle")}
          open={open}
          placement="bottom"
          height="auto"
          closable={false}
          destroyOnHidden
          rootClassName={styles.modeDrawer}
          onClose={() => setOpen(false)}
          styles={{
            body: { padding: 0, overflow: "hidden" },
            content: {
              borderRadius: "14px 14px 0 0",
              overflow: "hidden",
            },
            wrapper: { maxHeight: "min(48dvh, 400px)" },
          }}
        >
          {content}
        </OsDrawer>
      </>
    );
  }

  return (
    <Popover
      arrow={false}
      content={content}
      onOpenChange={setOpen}
      open={open}
      overlayClassName={styles.modePopover}
      placement="topLeft"
      trigger="click"
    >
      {triggerButton}
    </Popover>
  );
}

```

### Core Architecture Module: `console/src/components/LoopInput/index.ts`
```
export { LoopModeSelector } from "./LoopModeSelector";

```

### Core Architecture Module: `console/src/components/RenderableCodeBlock/RenderableCodeBlock.tsx`
```
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { ComponentProps } from "@ant-design/x-markdown";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Check, Code2, Copy, Download, Eye } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import { MermaidCodeBlock } from "../MermaidCodeBlock";
import styles from "./index.module.less";

type ViewMode = "preview" | "raw";
type RenderableLanguage = "latex" | "mermaid";
type RenderableCodeBlockProps = Partial<ComponentProps> & {
  children?: ReactNode;
};

const LANGUAGE_ALIASES: Record<string, RenderableLanguage> = {
  latex: "latex",
  math: "latex",
  mermaid: "mermaid",
  tex: "latex",
};

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  bash: "sh",
  csharp: "cs",
  javascript: "js",
  kotlin: "kt",
  markdown: "md",
  mermaid: "mmd",
  python: "py",
  ruby: "rb",
  rust: "rs",
  shell: "sh",
  typescript: "ts",
  yaml: "yml",
  zsh: "sh",
};

function extractText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText(
      (children as { props: { children?: ReactNode } }).props.children,
    );
  }
  return "";
}

function resolveLanguage(lang?: string, className?: string): string {
  const explicit = lang?.trim().split(/\s+/, 1)[0];
  const fromClassName = className?.match(/(?:^|\s)language-([^\s]+)/)?.[1];
  return (explicit || fromClassName || "").toLowerCase();
}

function downloadSource(source: string, language: string) {
  const extension =
    language === "latex" ? "tex" : LANGUAGE_EXTENSIONS[language] || language;
  const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `block.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function BlockActions({
  source,
  language,
}: {
  source: string;
  language: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number>();

  const handleCopy = async () => {
    try {
      if (window.isSecureContext && navigator.clipboard) {
        await navigator.clipboard.writeText(source);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = source;
        textarea.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.actions}>
      <button
        aria-label={t("common.download")}
        onClick={() => downloadSource(source, language)}
        title={t("common.download")}
        type="button"
      >
        <Download aria-hidden="true" size={16} />
      </button>
      <button
        aria-label={copied ? t("common.copied") : t("common.copy")}
        onClick={() => void handleCopy()}
        title={copied ? t("common.copied") : t("common.copy")}
        type="button"
      >
        {copied ? (
          <Check aria-hidden="true" size={16} />
        ) : (
          <Copy aria-hidden="true" size={16} />
        )}
      </button>
    </div>
  );
}

function SourceCode({
  source,
  language,
}: {
  source: string;
  language: string;
}) {
  const { isDark } = useTheme();

  return (
    <SyntaxHighlighter
      codeTagProps={{ style: { background: "transparent" } }}
      customStyle={{
        background: "transparent",
        borderRadius: 0,
        fontSize: "13px",
        lineHeight: "1.65",
        margin: 0,
        padding: "18px 20px",
      }}
      language={language === "latex" ? "latex" : language || "text"}
      style={isDark ? oneDark : oneLight}
    >
      {source.replace(/\n$/, "")}
    </SyntaxHighlighter>
  );
}

function SourceOnlyBlock({
  source,
  language,
}: {
  source: string;
  language: string;
}) {
  return (
    <section
      className={`${styles.block} qwenpaw-code-block`}
      data-language={language || "text"}
    >
      <header className={styles.sourceHeader}>
        <span className={styles.language}>{language || "text"}</span>
        <BlockActions language={language || "text"} source={source} />
      </header>
      <div className={styles.panel}>
        <SourceCode language={language} source={source} />
      </div>
    </section>
  );
}

function LatexPreview({ source }: { source: string }) {
  const result = useMemo(() => {
    try {
      return {
        html: katex.renderToString(source.trim(), {
          displayMode: true,
          output: "htmlAndMathml",
          throwOnError: true,
        }),
        error: "",
      };
    } catch (error) {
      return {
        html: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [source]);

  if (result.error) {
    return (
      <div className={styles.error} role="alert">
        <Code2 aria-hidden="true" size={18} />
        <div>
          <strong>Unable to render formula</strong>
          <span>{result.error}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.latexPreview}
      dangerouslySetInnerHTML={{ __html: result.html }}
    />
  );
}

function RenderableBlock({
  source,
  language,
}: {
  source: string;
  language: RenderableLanguage;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewMode>("preview");
  const tabGroupId = useId();
  const tabRefs = useRef<Record<ViewMode, HTMLButtonElement | null>>({
    preview: null,
    raw: null,
  });
  const previewTabId = `${tabGroupId}-preview-tab`;
  const rawTabId = `${tabGroupId}-raw-tab`;
  const panelId = `${tabGroupId}-panel`;

  const selectTab = (nextView: ViewMode) => {
    setView(nextView);
    tabRefs.current[nextView]?.focus();
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentView: ViewMode,
  ) => {
    let nextView: ViewMode | undefined;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      nextView = currentView === "preview" ? "raw" : "preview";
    } else if (event.key === "Home") {
      nextView = "preview";
    } else if (event.key === "End") {
      nextView = "raw";
    }

    if (nextView) {
      event.preventDefault();
      selectTab(nextView);
    }
  };

  return (
    <section
      className={`${styles.block} qwenpaw-code-block`}
      data-language={language}
    >
      <header className={styles.header}>
        <span className={styles.language}>{language}</span>
        <div className={styles.tabs} role="tablist" aria-label="Block view">
          <button
            aria-controls={panelId}
            aria-selected={view === "preview"}
            className={view === "preview" ? styles.activeTab : styles.tab}
            id={previewTabId}
            onKeyDown={(event) => handleTabKeyDown(event, "preview")}
            onClick={() => setView("preview")}
            ref={(node) => {
              tabRefs.current.preview = node;
            }}
            role="tab"
            tabIndex={view === "preview" ? 0 : -1}
            type="button"
          >
            <Eye aria-hidden="true" size={14} />
            {t("common.preview")}
          </button>
          <button
            aria-controls={panelId}
            aria-selected={view === "raw"}
            className={view === "raw" ? styles.activeTab : styles.tab}
            id={rawTabId}
            onKeyDown={(event) => handleTabKeyDown(event, "raw")}
            onClick={() => setView("raw")}
            ref={(node) => {
              tabRefs.current.raw = node;
            }}
            role="tab"
            tabIndex={view === "raw" ? 0 : -1}
            type="button"
          >
            <Code2 aria-hidden="true" size={14} />
            {t("common.raw")}
          </button>
        </div>
        <BlockActions language={language} source={source} />
      </header>
      <div
        aria-labelledby={view === "preview" ? previewTabId : rawTabId}
        className={styles.panel}
        id={panelId}
        role="tabpanel"
      >
        {view === "preview" ? (
          language === "mermaid" ? (
            <MermaidCodeBlock chart={source} />
          ) : (
            <LatexPreview source={source} />
          )
        ) : (
          <SourceCode language={language} source={source} />
        )}
      </div>
    </section>
  );
}

export function RenderableCodeBlock(props: RenderableCodeBlockProps) {
  const {
    children,
    lang,
    block,
    className,
    domNode,
    streamStatus,
    ...htmlProps
  } = props;
  const language = resolveLanguage(lang, className);
  const renderableLanguage = LANGUAGE_ALIASES[language];

  void domNode;
  void streamStatus;

  if (!block && !className?.includes("language-")) {
    return (
      <code {...htmlProps} className={className}>
        {children}
      </code>
    );
  }

  if (!renderableLanguage) {
    return (
      <SourceOnlyBlock language={language} source={extractText(children)} />
    );
  }

  return (
    <RenderableBlock
      language={renderableLanguage}
      source={extractText(children)}
    />
  );
}

```

### Core Architecture Module: `console/src/components/RenderableCodeBlock/index.ts`
```
import type { ComponentProps } from "@ant-design/x-markdown";
import { RenderableCodeBlock } from "./RenderableCodeBlock";

export { RenderableCodeBlock };

export const renderableCodeComponents: Record<
  string,
  React.ComponentType<ComponentProps>
> = {
  code: RenderableCodeBlock,
};

```

### Core Architecture Module: `console/src/features/files-workspace/filesDrawerState.ts`
```
import type { FilesDrawerEvent, FilesDrawerState } from "./types";

export const CLOSED_FILES_DRAWER: FilesDrawerState = { kind: "closed" };

export function filesDrawerReducer(
  state: FilesDrawerState,
  event: FilesDrawerEvent,
): FilesDrawerState {
  switch (event.type) {
    case "OPEN_PREVIEW":
      if (state.kind === "workspace") {
        return {
          kind: "workspace",
          target: event.target,
          trigger: event.trigger,
        };
      }
      return {
        kind: "preview",
        target: event.target,
        trigger: event.trigger,
      };
    case "OPEN_WORKSPACE":
      return {
        kind: "workspace",
        target: event.target,
        trigger: event.trigger,
      };
    case "EXPAND_WORKSPACE":
      return state.kind === "preview"
        ? {
            kind: "workspace",
            target: state.target,
            trigger: state.trigger,
          }
        : state;
    case "COLLAPSE_TO_PREVIEW":
      return state.kind === "workspace" && state.target
        ? {
            kind: "preview",
            target: state.target,
            trigger: state.trigger,
          }
        : state;
    case "CLOSE":
      return CLOSED_FILES_DRAWER;
  }
}

```

### Core Architecture Module: `console/src/hooks/useAgentRunningConfigApprovalLevel.ts`
```
import { useEffect, useState } from "react";
import { agentApi } from "../api/modules/agent";
import { useAgentStore } from "../stores/agentStore";
import { normalizeLevel, type ToolExecutionLevel } from "../utils/approval";

/**
 * Returns the running-config approval level for the currently selected agent.
 * Re-fetches automatically when the selected agent changes, and falls back to
 * "AUTO" on error.
 */
export function useAgentRunningConfigApprovalLevel(): ToolExecutionLevel {
  const { selectedAgent } = useAgentStore();
  const [level, setLevel] = useState<ToolExecutionLevel>("AUTO");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await agentApi.getAgentRunningConfig();
        if (!cancelled) {
          setLevel(normalizeLevel(config.approval_level));
        }
      } catch {
        if (!cancelled) {
          setLevel("AUTO");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAgent]);

  return level;
}

```

### Core Architecture Module: `console/src/hooks/useAgentStatusPolling.ts`
```
import { useEffect } from "react";
import type { AgentSummary } from "@/api/types/agents";

const AGENT_STATUS_POLL_INTERVAL_MS = 1500;

export function useAgentStatusPolling(
  agents: AgentSummary[],
  refresh: () => Promise<void>,
) {
  const hasStartingAgent = agents.some(
    (agent) =>
      agent.startup_status === "pending" || agent.startup_status === "starting",
  );

  useEffect(() => {
    if (!hasStartingAgent) {
      return undefined;
    }

    let cancelled = false;
    let timer: number | undefined;

    const schedule = () => {
      timer = window.setTimeout(async () => {
        try {
          await refresh();
        } catch {
          // Retry transient refresh failures on the next interval.
        } finally {
          if (!cancelled) {
            schedule();
          }
        }
      }, AGENT_STATUS_POLL_INTERVAL_MS);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [hasStartingAgent, refresh]);
}

```

### Core Architecture Module: `console/src/hooks/useAppMessage.ts`
```
import { App } from "antd";

/**
 * Hook to get message instance from Ant Design's App component.
 * Use this instead of the static message import to ensure
 * message notifications work correctly with ConfigProvider's prefixCls.
 *
 * Usage:
 * const { message } = useAppMessage();
 * message.success('Success!');
 */
export function useAppMessage() {
  const { message, modal, notification } = App.useApp();
  return { message, modal, notification };
}

```

### Core Architecture Module: `console/src/hooks/useAutoSave.tsx`
```
import { useAgentStore } from "@/stores/agentStore";
import { useCallback, useEffect, useLayoutEffect, useRef, useId } from "react";
import { useTranslation } from "react-i18next";
import { useAppMessage } from "./useAppMessage";

type Save = () => Promise<void | boolean>;

/** Debounce edits, serialize writes, and flush the latest job on navigation. */
export function useAutoSave(save: Save, delay = 1000) {
  const { message } = useAppMessage();
  const { t } = useTranslation();
  const errorKey = useId();
  const revision = useRef(0);
  const latest = useRef(save);
  const feedback = useRef({ message, t });
  const pending = useRef(false);
  const running = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useLayoutEffect(() => {
    latest.current = save;
    feedback.current = { message, t };
  });
  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    if (running.current) {
      const saved = await running.current;
      if (!pending.current) return saved;
    }
    if (!pending.current) return true;
    pending.current = false;
    const task = latest.current;
    const taskRevision = revision.current;
    const run = async (): Promise<boolean> => {
      try {
        return (await task()) !== false;
      } catch (error) {
        // Keep the failed job in the retry closure, including after unmount.
        const { message, t } = feedback.current;
        if (taskRevision !== revision.current) return false;
        message.error({
          key: errorKey,
          duration: 0,
          content: (
            <span>
              {t("common.autoSaveFailed")}{" "}
              <button
                type="button"
                onClick={() => {
                  message.destroy(errorKey);
                  if (taskRevision === revision.current) {
                    pending.current = true;
                    void flush();
                  }
                }}
              >
                {t("common.retry")}
              </button>
            </span>
          ),
        });
        console.error("Automatic settings save failed", error);
        return false;
      }
    };
    running.current = run();
    const saved = await running.current;
    running.current = null;
    if (!saved && taskRevision === revision.current) pending.current = true;
    return saved;
  }, [errorKey]);
  const schedule = useCallback(() => {
    revision.current += 1;
    feedback.current.message.destroy(errorKey);
    pending.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, delay);
  }, [delay, flush, errorKey]);
  useEffect(
    () =>
      useAgentStore.subscribe((next, previous) => {
        if (next.selectedAgent !== previous.selectedAgent) void flush();
      }),
    [flush],
  );
  useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );
  return { schedule, flush };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8109** (2026-10-05): **[Bug]: 流错误会导致会话完全丢失**
  *Symptoms*: ## QwenPaw Version  v2.2.2b4  ## Description  API流错误后，例如A这个agent调用B这个agent干活。B这个Agent内的会话，在流错误后100%直接丢失全部会话内容  ## Component(s) Affected  - [ ] Core / Backend (app, agents, config, providers, utils, local_models) - [x] Console (frontend web UI) - [ ] Channels (DingTalk, Feishu, QQ, Discord, iMessage, etc.) - [ ] Skills - [ ] CLI - [ ] Documentation (website) - [ ] Tests - [ ] CI/CD - [ ] Scripts / Deploy  ## Environment  - **QwenPaw version:** v2.2.2b4 - **OS:** Ubuntu 26.04 - **Install method:** one-line install  ## Steps to Reproduce  1.使用一个agent调用另外一个agent 2.api发生流错误 3.会话内容完全丢失，聊天记录完全丢失。 4.貌似频道发送消息也存在这个问题。  <img width="361" height="304" alt="Image" src="https://github.com/user-attachments/assets/71e921ee-c433-49f3-ad97-6f7e403d2d9f" />  <img width="3822" height="1778" alt="Image" src="https://github.com/user-attachments/assets/162cd0cc-b7dd-4e2e-9852-8c0289ee74a5" /> 我此刻有三个会话正在进行，流错误后三个会话内容完全丢失，变为空白。这是及其严重的错误。
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## 欢迎来到 QwenPaw! 🐾 Welcome to QwenPaw!  </div>  你好 @MCQSJ，这是你提交的第 30 个 issue。 Hi @MCQSJ, this is your 30th issue.  我们会尽快查看你的 issue。感谢你对 QwenPaw 的支持！ We'll review your issue soon. Thank you for supporting QwenPaw!  ---  > **🌍 关于国际化 / About Internationalization** >  > QwenPaw 是一个国际化的开源社区。我们建议使用英文提交 issue，这样可以让更多的开发者参与讨论和贡献。 >  > QwenPaw is an international open-source community. We recommend using English for issues so that more developers worldwide can participate in discussions and contributions.  
  > 暂时核实为是内存oom导致崩溃

- **Issue #7994** (2026-09-27): **[Bug]: 上下文显示状态信息不及时更新和不压缩**
  *Symptoms*: ## QwenPaw Version win10,desktop，2.2.3b bug1：上下文显示的那个圈，经常不随着对话切换更新，新建对话，还是显示旧对话的数据，必须退出程序，重新进才更新。 bug2：明明「上下文窗口 外圈 · 91.7K / 131.1K」，点击压缩，就只会说少于3个对话了，然后不压缩，我设置了上下文压缩阈值比例调到0.5，这91k明显超过了，也不给我压缩。
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  </div>  Hi @xiaohushi512,  This issue has been **automatically closed** because you currently have more than **10 open issues** in this repository.  > **Why this happened** > Our [contribution policy](https://github.com/agentscope-ai/QwenPaw/issues/4333) asks contributors to maintain a manageable number of active issues to ensure fair use of maintainer resources. A high volume of simultaneous open issues — especially those that are AI-generated and submitted without personal verification — places a significant burden on maintainers.  **What you can do:** 1. Review your open issues and close any that are no longer relevant, duplicated, or have not been personally verified. 2. Once you have fewer than 10 open issues, you are welcome to reopen this issue or file a new one. 3. Please ensure every issue you file has been **personally repr

- **Issue #7947** (2026-09-23): **[Bug]: send_file_to_user never renders its file card in the Console (artifact guard tests a JSON string, not a block array)**
  *Symptoms*: ### QwenPaw Version  v2.2.2-beta.3 (Windows desktop build; Console bundle `index-CZnxaxad.js`, artifact chunk `HostBubbles-BPBPozeU.js`)  ### Description  Files delivered with `send_file_to_user` get **no file card at all** in the Console — there is no visible or clickable entry point for the delivered file (the file name does not appear anywhere in the UI). The artifact-card machinery itself is fine: in the same conversation, `write_file` outputs render cards normally.  Root cause is a contract mismatch on one guard in the artifact collector (`console/src/features/files-workspace/ResponseArtifactList.tsx`): it requires the tool result's `output` to be a block **array**, but what the Console actually receives from `GET /api/chats/<chat_id>` is a **JSON string**. So the branch is never taken, and the entry is silently skipped with `continue` — no warning, nothing rendered.  **Security considerations:** none (read-only rendering path; no auth or config exposure).  ### Component(s) Affected  - [x] Console (frontend web UI) - [ ] Core / Backend (app, agents, config, providers, utils, local_models) - [ ] Channels, Skills, CLI, Documentation, Tests, CI/CD, Scripts / Deploy  ### Environment  - **QwenPaw version:** v2.2.2-beta.3 (Console shows `2.2.2b3`) - **OS:** Windows 10 (AMD64) - **Install method:** desktop app (Windows build) - **Channel:** `console` / agent `default`; backend on `127.0.0.1` only - **Upstream reference:** `agentscope-ai/QwenPaw` @ main — `ResponseArtifactList.t
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## Welcome to QwenPaw! 🐾  </div>  Hi @makeryuan-MK, this is your 3rd issue.  We'll review your issue soon. Thank you for supporting QwenPaw!  
  > I'd like to take this. I'll reproduce the Console artifact behavior with the JSON-serialized `output` shape returned by chat history, then make the focused frontend fix and keep the missing-DataBlock control covered. I'll verify the relevant Console checks and reference the existing artifact behavior from #7750. 
  > **Reporter's correction — the original report overstated one point, and my follow-up hypothesis was wrong.**  Two corrections, since this report is now the reference for a merged fix (#7949):  **1. "no file card ... the delivered file name never appears in the UI" was too strong.**  The `send_file_to_user` tool card *does* render — it is built from the tool call's arguments, not from `output` — but it sits inside the default-collapsed "已完成 N 个步骤 / Completed N steps" group. On the same install I later captured a turn that delivered three documents: three file cards, all inside an expanded "Completed 16 steps" group, with nothing rendered outside it. So the accurate statement of the defect is narrower than what I wrote:  > A delivered file produces **no entry in the response artifact grid**, so its only entry point stays inside the collapsed step group and is invisible unless the user expands it.  Same root cause (`hasDeliveredFile` receiving a JSON string), correct impact description. T

- **Issue #7942** (2026-09-22): **Windows sandbox writes an inheritable ACL on workspace_dir — a drive-root workspace can strip permissions from the whole volume**
  *Symptoms*: ### Summary On Windows the first `execute_shell_command` builds the sandbox and writes ACLs on `config.workspace_dir`. Nothing rejects a drive root, so setting the workspace to `C:\` makes the entire volume the grant root.  ### Code (main @ 79f8e7d3) - `sandbox/windows_appcontainer_sandbox.py` `_apply_all_acls()` calls   `_set_path_ace(config.workspace_dir, psid, _ACL_FULL_ACCESS, _WC.SET_ACCESS)`. - `sandbox/windows_unelevated_sandbox.py` `_set_path_ace()` calls `SetNamedSecurityInfoW`   with `CONTAINER_INHERIT_ACE | OBJECT_INHERIT_ACE`. Windows re-propagates inheritable ACEs   to every existing child: children first drop their INHERITED ACEs, then re-copy from the   current parent. A drive root has no parent, so the subtree copies whatever the root now holds. - The same function never checks `p_dacl == NULL`. With `SetEntriesInAclW(OldAcl=NULL)` the   result is a DACL containing only the sandbox ACE. - `windows_elevated_sandbox.py` cleanup falls back to `icacls <path> /reset`, which is fatal   when the path is a drive root.  ### Observed On an internal fork sharing this code, using a disposable `E:` whose root DACL had been pre-set to NULL, a single sandboxed `cmd /c echo hello` left `E:\` unusable: `icacls E:\` returned access denied even for an elevated Administrator, and Explorer refused to open the drive. The NULL root DACL was seeded on purpose, so this is not a clean-system repro.  ### Why it matters Windows 10 Pro 20H2 has public reports where editing a single ACE on
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## Welcome to QwenPaw! 🐾  </div>  Hi @hxnan, this is your 2nd issue.  ### 📋 About Bug Report Template  We noticed your issue seems to be bug-related, but doesn't use the Bug Report template. To help us reproduce and fix the issue faster, please make sure your bug report includes:  - ✅ **QwenPaw Version** (use `qwenpaw --version`) - ✅ **Operating System** (macOS/Linux/Windows and version) - ✅ **Steps to Reproduce** (detailed steps) - ✅ **Actual vs Expected Behavior** - ✅ **Logs or Screenshots**  You can edit your issue to add this information. Missing information may require us to ask follow-up questions, which can delay the fix.  We'll review your issue soon. Thank you for supporting QwenPaw!  

- **Issue #7908** (2026-09-22): **[Bug] Windows: child Console Ctrl event from execute_shell_command can terminate the QwenPaw host**
  *Symptoms*: ## QwenPaw Version  v2.2.1  ## Description  On Windows, a child process launched through QwenPaw's `execute_shell_command` can emit a Console Ctrl event that propagates to the QwenPaw host process itself.  Instead of only failing the individual shell/tool call, the entire QwenPaw / Uvicorn server receives `KeyboardInterrupt` and shuts down.  In my real-world case, an Agent-generated Python process used:  ```python os.kill(pid, 0) ```  as a PID liveness probe.  This is itself an application-level bug on Windows, because `os.kill()` has special Console Control Event behavior there.  However, the QwenPaw robustness issue is that the resulting child-process Console Ctrl event is able to escape the `execute_shell_command` execution boundary and terminate the entire QwenPaw host.  I did not manually press `Ctrl+C` during any of the reproduced occurrences.  **Related PR(s):** N/A  **Security considerations:** No credential, authentication, or configuration exposure has been observed.  The main concern is availability and execution isolation: a faulty child process launched by `execute_shell_command` can terminate the whole QwenPaw host instead of only failing the current tool call.  ## Component(s) Affected  * [x] Core / Backend (app, agents, config, providers, utils, local_models) * [ ] Console (frontend web UI) * [ ] Channels (DingTalk, Feishu, QQ, Discord, iMessage, etc.) * [ ] Skills * [ ] CLI * [ ] Documentation (website) * [x] Tests * [ ] CI/CD * [ ] Scripts / Deploy  ## Envir
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## 欢迎来到 QwenPaw! 🐾 Welcome to QwenPaw!  </div>  你好 @PanXXHH，感谢你提交的第一个 issue！ Hi @PanXXHH, thank you for your first issue!  ### 📋 关于 Bug Report 模板 / About Bug Report Template  我们注意到你的 issue 似乎与 bug 相关，但没有使用 Bug Report 模板。为了帮助我们更快地定位和修复问题，请确保你的 bug report 包含以下信息： We noticed your issue seems to be bug-related, but doesn't use the Bug Report template. To help us reproduce and fix the issue faster, please make sure your bug report includes:  - ✅ **QwenPaw 版本 / Version** (使用 `qwenpaw --version` 查看) - ✅ **操作系统 / OS** (macOS/Linux/Windows 及版本) - ✅ **复现步骤 / Steps to Reproduce** (详细的步骤) - ✅ **实际结果 vs 预期结果 / Actual vs Expected** - ✅ **日志或截图 / Logs or Screenshots**  你可以编辑 issue 来补充这些信息。如果你的 issue 缺少这些信息，维护者可能需要额外时间来询问细节。 You can edit your issue to add this information. Missing information may require maintainers to ask follow-up questions.  我们

- **Issue #7907** (2026-09-21): **[Bug] Responses API 工具 schema 清洗移除 nullable，叠加隐式 strict 导致 recall_history 可选日期参数无法省略**
  *Symptoms*: ### 环境 QwenPaw `2.2.1`，AgentScope `2.0.7.post1`，OpenAI SDK `2.33.0`，Python `3.11.2`。使用 `OpenAIResponseModel`，经 codex2api 中转。  ### 问题 调用 `recall_history` 时，即使不需要日期筛选，模型仍填入：  ```json {"created_on":"","created_from":"","created_to":""} ```  导致检索前报错：  ```text ValueError: created_on cannot be combined with created_from/created_to ```  ### 源码定位 `openai_response_provider.py` 的 `_format_tools()` 调用通用 `_sanitize_tool_schemas()`，其中 `_sanitize_nullable_schemas()` 将可选字段：  ```json {"anyOf":[{"type":"string"},{"type":"null"}],"default":null} ```  转换为：  ```json {"type":"string","default":null} ```  这移除了合法的 `null` 类型，同时 Responses 工具未显式设置 `strict`。结合 Responses 默认尝试严格规范化的行为，可能造成可选字段被要求提供、却不能填 `null` 的冲突。  已在本地复现 nullable 被移除；严格规范化具体发生在中转还是上游，尚未确认。  ### 修复结果 在 Responses 格式化后的函数工具上默认设置 `strict: false`、保留显式配置后，问题消失。未修改 Chat Completions 链路。
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## 欢迎来到 QwenPaw! 🐾 Welcome to QwenPaw!  </div>  你好 @bertram-wei，感谢你提交的第一个 issue！ Hi @bertram-wei, thank you for your first issue!  ### 📋 关于 Bug Report 模板 / About Bug Report Template  我们注意到你的 issue 似乎与 bug 相关，但没有使用 Bug Report 模板。为了帮助我们更快地定位和修复问题，请确保你的 bug report 包含以下信息： We noticed your issue seems to be bug-related, but doesn't use the Bug Report template. To help us reproduce and fix the issue faster, please make sure your bug report includes:  - ✅ **QwenPaw 版本 / Version** (使用 `qwenpaw --version` 查看) - ✅ **操作系统 / OS** (macOS/Linux/Windows 及版本) - ✅ **复现步骤 / Steps to Reproduce** (详细的步骤) - ✅ **实际结果 vs 预期结果 / Actual vs Expected** - ✅ **日志或截图 / Logs or Screenshots**  你可以编辑 issue 来补充这些信息。如果你的 issue 缺少这些信息，维护者可能需要额外时间来询问细节。 You can edit your issue to add this information. Missing information may require maintainers to ask follow-up questi

- **Issue #7905** (2026-09-21): **[Bug]: DoomLoopGate escalates to TERMINATE on a text-only round without new tool-call evidence**
  *Symptoms*:  ## QwenPaw Version  Reported environment: `2.2.2b1`, commit `1d5021a4`. Source review and isolated reproduction target commit `1d5021a4`. As checked on 2026-09-20, `main`'s `src/qwenpaw/loop/gates/doom_loop.py` was byte-identical to that file at the pinned commit.  ## Description  `DoomLoopGate.check(ctx)` increments `consecutive_hits` whenever its retained history window matches, even if the current check recorded no new tool call. Consequently, after a warning at 3 hits, a text-only response with `has_tool_calls=False` can escalate to `TERMINATE` at 4 hits. This occurs even when the latest context message has also been replaced with the text-only response.  Expected: a previously evaluated window must not count as new repetition evidence. A new text-only round should not cause escalation of a tool-repetition detector.  A related sampling issue is that `_auto_record_from_ctx()` takes only the last tool call from the last context message. Its deduplication key is the iteration number, not the message/call identity. If iteration advances while the same message remains at the tail, the same call is appended again. The isolated reproduction demonstrates this condition, but does not establish that a concurrent tool batch alone causes these iteration/context transitions in the real scheduler.  **Related reports:** #5906 (closed report of false repetition detection); #7420 (open report involving re-dispatch/tool-result behavior). These are related symptoms, not established identic
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## Welcome to QwenPaw! 🐾  </div>  Hi @mikew221, thank you for your first issue!  We'll review your issue soon. Thank you for supporting QwenPaw!  
  > ## Additional production evidence  I obtained the complete production session artifact and its matching log after filing this issue. They confirm that the reported false positive occurred on the real scheduler path, rather than only in the isolated gate-level reproduction.  ### Environment and artifacts  - QwenPaw: `2.2.2b1`, commit `1d5021a4` - Model: `kimi-k3` - Session: `~/.copaw/workspaces/default/sessions/console/<session-id>.json `  ### What the model was doing  The user asked how QwenPaw persists messages in SQLite and assembles messages for LLM calls. In one assistant message, the model issued 11 distinct `execute_shell_command` calls that progressively inspected different files and line ranges:  1. Listed `agents/context/scroll/` and searched for `conversation_history`. 2. Searched for `history.db` references. 3. Read `history.py` lines 1-140. 4. Read `history.py` lines 140-260. 5. Read `history.py` lines 260-470. 6. Read `history.py` lines 470-620. 7. Listed classes and funct
  > Thanks for your feedback, I will fix it.

- **Issue #7856** (2026-09-23): **[Bug]: qwenpaw-pet 0.1.1 breaks QwenPaw 2.2.2b2 tool approvals by dropping the `actor` argument**
  *Symptoms*: # [Bug]: qwenpaw-pet 0.1.1 breaks QwenPaw 2.2.2b2 tool approvals by dropping the `actor` argument  ## QwenPaw Version  - QwenPaw Desktop: `2.2.2-beta.2` - QwenPaw Backend: `QwenPaw, version 2.2.2b2` - Plugin: `qwenpaw-pet 0.1.1`  ## Description  When `qwenpaw-pet 0.1.1` is enabled with QwenPaw Desktop `2.2.2-beta.2`, every Console tool approval fails after the user clicks **Approve**.  The issue is caused by the plugin monkey-patching `ApprovalService.resolve_request`. The plugin wrapper does not accept the keyword-only `actor` argument required by the current QwenPaw approval API and does not forward it to the original method.  As a result, the approval endpoint returns HTTP 500 before the pending tool call can be resolved.  **Related PR(s):** N/A  **Security considerations:** No credential exposure was observed. The bug prevents users from completing protected tool actions and may lead users to disable approval safeguards as a workaround.  ## Component(s) Affected  - [x] Core / Backend (app, agents, config, providers, utils, local_models) - [ ] Console (frontend web UI) - [ ] Channels (DingTalk, Feishu, QQ, Discord, iMessage, etc.) - [x] Plugins - [ ] Skills - [ ] CLI - [ ] Documentation (website) - [ ] Tests - [ ] CI/CD - [ ] Scripts / Deploy  ## Environment  - **QwenPaw version:** Desktop `2.2.2-beta.2`; backend `2.2.2b2` - **Plugin version:** `qwenpaw-pet 0.1.1` - **OS:** Windows 10 AMD64 - **Install method:** QwenPaw Desktop plus installed `qwenpaw-pet` plugin - **Pytho
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## Welcome to QwenPaw! 🐾  </div>  Hi @samluoabc, this is your 5th issue.  We'll review your issue soon. Thank you for supporting QwenPaw!  
  > Thanks for your feedback! We will fix it asap
  > > Qwenpaw-pet 0.1.1 breaking QwenPaw tool approvals by dropping the actor argument opens an authority gap before tool effects. Approvals without actor binding cannot attribute or enforce correctly. Are you restoring the actor field on approval payloads and failing closed when it is missing?  fixed in PR：https://github.com/agentscope-ai/QwenPaw/pull/7933

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

### Incident Patch 1: `80e412da` (2026-09-30)
**Commit Message**: fix(e2e): stop stalled session cleanup (#8041)

**File**: `e2e/pages/chat_page.py` (modified, +41/-25)
```diff
@@ -38,8 +38,14 @@ class ChatPage(BasePage):
     # ========== Selector definitions ==========
     # Page components use the qwenpaw- CSS prefix
 
-    # Navigation and new chat (compatible with both spark-icon and anticon icon sets)
-    NEW_CHAT_BTN = 'button:has(.spark-icon-spark-newChat-fill), button:has(.anticon-plus), button:has([class*="newChat"])'
+    # Sidebar.tsx exposes the current action through its translated accessible
+    # name. ``:visible`` excludes the duplicate compact/expanded surface.
+    NEW_CHAT_BTN = (
+        'button[aria-label="New task"]:visible, '
+        'button[aria-label="新建任务"]:visible, '
+        'button:has-text("New task"):visible, '
+        'button:has-text("新建任务"):visible'
+    )
     # Conversation-history disclosure button in the sidebar.
     #
     # The previous value ended with a very broad ``button:has([class*="history"])``
@@ -125,25 +131,25 @@ class ChatPage(BasePage):
         '[class*="sessionItem-module__name"], '
         '[class*=chatSessionItem] [class*=name]'
     )
-    # SessionItem actions now live behind a "more" button (SparkMoreLine)
-    # that opens an antd Dropdown menu (Pin / Rename / Archive / Delete).
+    # SessionItem actions live behind a "more" button. The current console
+    # renders a custom Popover menu with role-based action buttons.
     SESSION_MORE_BTN = '[class*=moreBtn]'
     # ``:text-is`` is exact so "Pin" does not also match "Unpin".
     SESSION_MENU_PIN = (
-        '.qwenpaw-dropdown-menu-item:has-text("Pin"), '
-        '.qwenpaw-dropdown-menu-item:has-text("置顶")'
+        'div[role="menu"] button[role="menuitem"]:text-is("Pin"), '
+        'div[role="menu"] button[role="menuitem"]:text-is("置顶")'
     )
     SESSION_MENU_UNPIN = (
-        '.qwenpaw-dropdown-menu-item:has-text("Unpin"), '
-        '.qwenpaw-dropdown-menu-item:has-text("取消置顶")'
+        'div[role="menu"] button[role="menuitem"]:text-is("Unpin"), '
+        'div[role="menu"] button[role="menuitem"]:text-is("取消置顶")'
     )
     SESSION_MENU_RENAME = (
-        '.qwenpaw-dropdown-menu-item:has-text("Rename"), '
-        '.qwenpaw-dropdown-menu-item:has-text("重命名")'
+        'div[role="menu"] button[role="menuitem"]:has-text("Rename"), '
+        'div[role="menu"] button[role="menuitem"]:has-text("重命名")'
     )
     SESSION_MENU_DELETE = (
-        '.qwenpaw-dropdown-menu-item:has-text("Delete"), '
-        '.qwenpaw-dropdown-menu-item:has-text("删除")'
+        'div[role="menu"] button[role="menuitem"]:has-text("Delete"), '
+        'div[role="menu"] button[role="menuitem"]:has-text("删除")'
     )
     # Inline rename input rendered when a SessionItem enters edit mode.
     SESSION_RENAME_INPUT = 'input[class*=renameInput]'
@@ -357,12 +363,20 @@ def create_new_chat(self) -> "ChatPage":
             del self._has_sent_message
         self._ai_count_before_send = 0
         
-        new_chat_btn = self.find(self.NEW_CHAT_BTN)
-        if new_chat_btn.count() > 0:
-            new_chat_btn.click()
-            # Wait for page navigation and full load
-            self.page.wait_for_load_state("networkidle")
-            self.page.locator(self.CHAT_INPUT).wait_for(state="visible", timeout=10000)
+        new_chat_btn = self.find(self.NEW_CHAT_BTN).first
+        expect(new_chat_btn).to_be_visible(timeout=self.timeout)
+        new_chat_btn.click()
+        # The chat page keeps an SSE connection open, so ``networkidle`` is
+        # not a useful completion signal. The new-task event is complete once
+        # the previous transcript is gone and the composer is interactive.
+        expect(self.page.locator(self.MESSAGE_CONTAINER)).to_have_count(
+            0,
+            timeout=self.timeout,
+        )
+        self.page.locator(self.CHAT_INPUT).first.wait_for(
+            state="visible",
+            timeout=self.timeout,
+        )
         self.step_shot("create_new_chat_done")
         return self
     
@@ -1074,12 +1088,7 @@ def _open_session_menu(self, index: int) -> bool:
         # nth() right before each interaction attempt instead.
         target = self.page.locator(self.SESSION_ITEM).nth(index)
 
-        # antd keeps closed menus in the DOM with a ``-hidden`` modifier; the
-        # open one is the menu WITHOUT it.
-        open_menu_item = (
-            '.qwenpaw-dropdown:not(.qwenpaw-dropdown-hidden) '
-            '.qwenpaw-dropdown-menu-item'
-        )
+        open_menu_item = 'div[role="menu"] button[role="menuitem"]'
 
         def _menu_visible(timeout: int) -> bool:
             try:
@@ -1667,7 +1676,14 @@ def delete_all_sessions(self, max_attempts: int = 50) -> "ChatPage":
 
             try:
                 self.delete_session(0)
-                deleted_count += 1
+                remaining_count = self.get_session_count()
+                if remaining_count >= session_count:
+                    logger.warning(
+                        "[cleanup] session count did not decrease "
+                        f"({session_coun
```

**File**: `e2e/pages/inbox_page.py` (modified, +9/-38)
```diff
@@ -66,44 +66,15 @@ class InboxPage(BasePage):
     MESSAGE_CARD = '[class*="messageCard"]'
     UNREAD_DOT_IN_CARD = '[class*="unreadDot"]'
 
-    # Sidebar unread dot.
-    #
-    # The value this replaces anchored on an antd Badge:
-    #   li.qwenpaw-menu-item:has(span.qwenpaw-menu-title-content:has-text("Inbox")) .qwenpaw-badge-dot
-    # Upstream #7502 dropped antd's ``Badge`` from the sidebar completely (a
-    # case-sensitive search for ``Badge`` in ``layouts/Sidebar.tsx`` now returns
-    # nothing), and the menu entries are no longer ``li.qwenpaw-menu-item`` —
-    # they are plain ``<button>`` elements. Every part of the old selector is
-    # therefore gone at once.
-    #
-    # In the expanded sidebar the dot is now
-    #   <button class="...inboxItem...">
-    #     <span class="...inboxIcon">
-    #       <span class="...inboxUnreadDot" style="background: ..." />
-    #     </span>
-    #     <span>Inbox</span>
-    #   </button>
-    # Both ``inboxItem`` and ``inboxUnreadDot`` are defined once, in
-    # ``layouts/index.module.less``, so with the build's
-    # ``generateScopedName: "[name]__[local]__[hash:base64:5]"`` they render as
-    # ``index-module__inboxItem__<hash>`` / ``index-module__inboxUnreadDot__<hash>``.
-    # The dot's own scoped class is the anchor. It is deliberately *not* combined
-    # with an ancestor or label variant: ``inboxUnreadDot`` is already the
-    # broadest form, so any narrower alternative in the same comma-separated
-    # union could never add a match — a dead branch, and exactly the rot that
-    # made the old ``chatSessionItem`` fallback useless for years without anyone
-    # noticing. If upstream renames the class the right fix is to update this
-    # line, not to stack unreachable fallbacks.
-    #
-    # ⚠️ Known coverage gap, stated rather than papered over: in the *collapsed*
-    # sidebar the dot is a plain ``<span>`` with only inline styles
-    # (``decorateInboxIcon`` in ``Sidebar.tsx``) and no class name at all, so
-    # there is no stable handle for it. The collapsed form cannot be anchored
-    # without upstream adding a class or data attribute. E2E runs at a 1920-wide
-    # viewport (``config.browser.viewport_width``), which is outside the
-    # ``MOBILE_SIDEBAR_QUERY`` breakpoint, so the sidebar is expanded and the
-    # expanded anchor below is the one that applies here.
-    SIDEBAR_INBOX_BADGE = '[class*="inboxUnreadDot"]'
+    # NotificationBell renders the same badge inside both compact and expanded
+    # Inbox navigation buttons. Scope it to the translated accessible name so
+    # unrelated notification counters cannot satisfy the assertion.
+    SIDEBAR_INBOX_BADGE = (
+        'button[aria-label="Inbox"] '
+        '[class*="NotificationBell-module__badge"], '
+        'button[aria-label="收件箱"] '
+        '[class*="NotificationBell-module__badge"]'
+    )
 
     # Detail modal
     DETAIL_MODAL = '.qwenpaw-modal'
```

**File**: `e2e/pages/memory_page.py` (modified, +74/-31)
```diff
@@ -17,9 +17,10 @@
 from __future__ import annotations
 
 import logging
+import time
 from typing import Optional
 
-from playwright.sync_api import Page, expect, TimeoutError
+from playwright.sync_api import Page, TimeoutError
 
 from pages.base_page import BasePage
 from config.settings import config
@@ -36,45 +37,69 @@ class MemoryPage(BasePage):
 
     # ========== Selectors ==========
 
-    # Long-term Memory tab on /agent-config
+    # Memory group tab rendered by RuntimeWorkbench on /agent-config.
     MEMORY_TAB = (
-        '.qwenpaw-tabs-tab:has-text("Long-term Memory"), '
-        '.qwenpaw-tabs-tab:has-text("长期记忆")'
+        '[role="tab"]:has-text("Memory"), '
+        '[role="tab"]:has-text("记忆与检索")'
+    )
+    MEMORY_CARD_HEADING = (
+        'h3:has-text("Long-term memory hub"), '
+        'h3:has-text("长期记忆中心")'
     )
-    # Switches and inputs use stable form-item names (Form.Item name=[...]).
-    # The dream_cron input is unique to this card and serves as a
-    # reliable "card content rendered" signal.
     DREAM_CRON_INPUT = (
-        'input[id$="reme_light_memory_config_dream_cron"]'
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("Dream Schedule") '
+        'input[aria-label="Cron expression"], '
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("梦境定时") input[aria-label="Cron 表达式"]'
     )
-    # --- Long-term Memory card fields (ReMeLightMemoryCard.tsx) ---
     AUTO_MEMORY_INTERVAL_INPUT = (
-        'input[id$="reme_light_memory_config_auto_memory_interval"]'
+        'section[class*="memoryConfigPanel"]:'
+        'has(h3:has-text("Auto-memory")) input[role="spinbutton"], '
+        'section[class*="memoryConfigPanel"]:'
+        'has(h3:has-text("自动记忆")) input[role="spinbutton"]'
+    )
+    AUTO_MEMORY_ENABLED_SWITCH = (
+        'section[class*="memoryConfigPanel"]:'
+        'has(h3:has-text("Auto-memory")) '
+        'button[role="switch"][aria-label="Enable conversation memory"], '
+        'section[class*="memoryConfigPanel"]:'
+        'has(h3:has-text("自动记忆")) '
+        'button[role="switch"][aria-label="启用对话记忆"]'
     )
     DREAM_CRON_ENABLED_SWITCH = (
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("Dream Schedule") '
         'button[role="switch"]'
-        '[id$="reme_light_memory_config_dream_cron_enabled"]'
+        '[aria-label="Enable scheduled organization"], '
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("梦境定时") '
+        'button[role="switch"][aria-label="启用梦境整理"]'
     )
-    # Auto Memory Search collapse (forceRender: children always in DOM,
-    # visible only once the panel is expanded).
-    AUTO_SEARCH_COLLAPSE_HEADER = (
-        '.qwenpaw-collapse-header:has-text("Auto Memory Search"), '
-        '.qwenpaw-collapse-header:has-text("自动记忆搜索")'
+    DREAM_ADVANCED_OPTION = (
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("Dream Schedule") label:has-text("Advanced"), '
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("梦境定时") label:has-text("高级")'
     )
     AUTO_SEARCH_SWITCH = (
+        'section[class*="memoryRecallPanel"]:'
+        'has(h3:has-text("Memory search")) '
+        'div[class*="memoryToggleRow"]:'
+        'has(strong:has-text("Enable automatic memory search")) '
+        'button[role="switch"], '
+        'section[class*="memoryRecallPanel"]:'
+        'has(h3:has-text("记忆搜索")) '
+        'div[class*="memoryToggleRow"]:'
+        'has(strong:has-text("启用自动记忆搜索")) '
         'button[role="switch"]'
-        '[id$="auto_memory_search_config_enabled"]'
     )
     AUTO_SEARCH_MAX_RESULTS_INPUT = (
-        'input[id$="auto_memory_search_config_max_results"]'
+        'section[class*="memoryRecallPanel"]:'
+        'has(h3:has-text("Memory search")) input[role="spinbutton"], '
+        'section[class*="memoryRecallPanel"]:'
+        'has(h3:has-text("记忆搜索")) input[role="spinbutton"]'
     )
-    # --- Save footer + toast ---
-    SAVE_BTN = (
-        'button.qwenpaw-btn-primary:has-text("Save"), '
-        'button.qwenpaw-btn-primary:has-text("保存"), '
-        'button.qwenpaw-btn-primary:has-text("保 存")'
-    )
-    SUCCESS_TOAST = '.qwenpaw-message-success'
 
     # localStorage agent storage — see CodingPage for the rationale.
     AGENT_ID_DEFAULT = "default"
@@ -141,12 +166,30 @@ def open_workspace(self) -> "MemoryPage":
     def click_memory_tab(self) -> None:
         self.page.locator(self.MEMORY_TAB).first.click(timeout=self.timeout)
 
-    def click_save(self) -> None:
-        """Click the footer Save button and wait for the request."""
-        save_btn = self.page.locator(self.SAVE_BTN).first
-        expect(save_btn).to_be_visible(timeout=self.timeout)
-        save_btn.click()
-        self.page.wait_for_timeout(1500)
+    def wait_for_config_value(
+        self,
+        api_context,
+        path: tuple[str, ...],
+        expected,
+    ) -> None:
+        """Wait until the debounced auto-save persis
```

**File**: `e2e/pages/skill_pool_page.py` (modified, +31/-21)
```diff
@@ -18,7 +18,7 @@
 import logging
 from typing import List, Optional
 
-from playwright.sync_api import Page, Locator
+from playwright.sync_api import Page, Locator, TimeoutError
 
 from pages.base_page import BasePage
 from config.settings import config
@@ -36,39 +36,45 @@ class SkillPoolPage(BasePage):
     # Page + card grid (SkillPool/index.module.less, PoolSkillCard.tsx)
     PAGE_CONTAINER = '[class*="skillsPage"]'
     SKILL_GRID = '[class*="skillsGrid"]'
-    SKILL_CARD = '[class*="skillCard"]'
-    SKILL_TITLE = '[class*="skillTitle"]'
-    # Sync status badge (rendered for every card) + its colored dot.
+    SKILL_CARD = '[class*="PoolSkillCard-module__card"]'
+    SKILL_TITLE = '[class*="PoolSkillCard-module__title"]'
+    SEARCH_INPUT = (
+        'input[aria-label="Filter by name"], '
+        'input[aria-label="按名称筛选"]'
+    )
+    # Sync status badge rendered for every card.
     STATUS_BADGE = '[class*="statusBadge"]'
-    STATUS_DOT = '[class*="statusDot"]'
-    # Automation chip in the title row (Auto Sync, Auto Update, or both).
-    AUTOMATION_TAG = '[class*="automationTag"]'
+    AUTOMATION_TAG = (
+        'button[data-testid^="skill-automation-"][aria-pressed="true"]'
+    )
     BUILTIN_TAG = '[class*="builtinTag"]'
     CUSTOM_TAG = '[class*="customTag"]'
     # Card footer is only mounted on hover / batch / mobile; the single
     # automation quick action (SyncOutlined) lives inside it.
-    CARD_FOOTER = '[class*="cardFooter"]'
-    AUTOMATION_BUTTON = '[class*="automationButton"]'
-
-    # Edit drawer (PoolSkillDrawer.tsx)
-    DRAWER = '.qwenpaw-drawer'
-    DRAWER_TITLE = '.qwenpaw-drawer-title'
-    AUTO_SYNC_SWITCH = '.qwenpaw-drawer [data-testid="auto-sync-switch"]'
+    CARD_FOOTER = '[class*="PoolSkillCard-module__footer"]'
+    AUTOMATION_BUTTON = 'button[data-testid^="skill-automation-"]'
+
+    # PoolSkillDrawer uses SettingsDrawer, which renders a SharedModal on
+    # desktop. Anchor the editor on its edit-only Auto Sync control so other
+    # dialogs cannot satisfy these selectors.
+    DRAWER = '[role="dialog"]:has([data-testid="auto-sync-switch"])'
+    DRAWER_TITLE = f'{DRAWER} .qwenpaw-modal-title'
+    AUTO_SYNC_SWITCH = f'{DRAWER} [data-testid="auto-sync-switch"]'
     # Target-agent multi-select is rendered ONLY after the switch is ON; anchor
     # on its placeholder text (unique) so we don't match other selects.
     TARGET_SELECT_PLACEHOLDER = (
-        '.qwenpaw-drawer [class*="select-selection-placeholder"]'
+        f'{DRAWER} [class*="select-selection-placeholder"]'
         ':has-text("All agents that have this skill"), '
-        '.qwenpaw-drawer [class*="select-selection-placeholder"]'
+        f'{DRAWER} [class*="select-selection-placeholder"]'
         ':has-text("所有已安装该技能的智能体")'
     )
     SAVE_BTN = (
-        '.qwenpaw-drawer button:has-text("Save"), '
-        '.qwenpaw-drawer button:has-text("保存")'
+        f'{DRAWER} .qwenpaw-modal-footer button.qwenpaw-btn-primary'
     )
     CANCEL_BTN = (
-        '.qwenpaw-drawer button:has-text("Cancel"), '
-        '.qwenpaw-drawer button:has-text("取消")'
+        f'{DRAWER} button:has-text("Cancel"), '
+        f'{DRAWER} button:has-text("取消"), '
+        f'{DRAWER} button:has-text("取 消")'
     )
 
     # ========== Initialization ==========
@@ -103,7 +109,11 @@ def find_card_by_name(self, name: str) -> Optional[Locator]:
         card = self.page.locator(
             f'{self.SKILL_CARD}:has-text("{name}")'
         ).first
-        return card if card.count() > 0 else None
+        try:
+            card.wait_for(state="visible", timeout=self.timeout)
+        except TimeoutError:
+            return None
+        return card
 
     def hover_card(self, card: Locator) -> "SkillPoolPage":
         """Hover a card so its footer automation action is mounted."""
```

**File**: `e2e/pages/skills_page.py` (modified, +4/-1)
```diff
@@ -44,7 +44,10 @@ class SkillsPage(BasePage):
     SWITCH_SELECTOR = '.qwenpaw-switch'
 
     # Search input
-    SEARCH_INPUT = 'input[placeholder*="搜索"], input[placeholder*="Search"], .ant-input-search input, .qwenpaw-input-search input'
+    SEARCH_INPUT = (
+        'input[aria-label="Search skills across platforms"], '
+        'input[aria-label="在多平台中搜索技能"]'
+    )
 
     # ========== Navigation methods ==========
 
```

**File**: `e2e/pages/voice_page.py` (modified, +2/-2)
```diff
@@ -27,12 +27,12 @@ class VoicePage(BasePage):
     """
 
     PAGE_TITLE = "QwenPaw Console"
-    PAGE_URL = f"{config.base_url}/settings/voice"
+    PAGE_URL = f"{config.base_url}/voice-transcription"
 
     # ========== Selector definitions ==========
 
     # Page load indicator
-    PAGE_LOAD_INDICATOR = '.qwenpaw-switch, .qwenpaw-switch-input, [class*=voiceToggle]'
+    PAGE_LOAD_INDICATOR = 'div[class*="voiceTranscriptionPage"]'
 
     # Voice service switch
     VOICE_TOGGLE_SELECTOR = '.qwenpaw-switch, .qwenpaw-switch-input, [class*=voiceToggle]'
```

**File**: `e2e/tests/test_channels.py` (modified, +4/-1)
```diff
@@ -561,11 +561,14 @@ def test_message_filter_switches(self, channels_page: ChannelsPage, request: pyt
             if not presentation.is_visible():
                 channels_page.close_drawer()
                 continue
-            presentation.click()
             target_switch = drawer_body.locator(
                 '.qwenpaw-form-item:has-text("Show Tool Call Information") '
                 '[role="switch"]:visible'
             )
+            # Console opens the presentation section by default. Other
+            # channels keep it collapsed, so only expand it when needed.
+            if not target_switch.is_visible():
+                presentation.click()
             expect(target_switch).to_be_visible(timeout=3000)
             initial_state = (
                 target_switch.get_attribute("aria-checked") == "true"
```

**File**: `e2e/tests/test_chat_sidebar.py` (modified, +4/-4)
```diff
@@ -84,11 +84,11 @@ def test_sidebar_date_groups_and_collapse(
 
         log_test_step("1. Mock the sidebar list with 5 crafted-timestamp sessions")
         sidebar_sessions.register(page)
-        # SidebarSessionList only mounts in the sidebar's *simple* mode
-        # (Sidebar.tsx: isSimpleExpanded branch); the default is "full"
-        # nav mode, so pin simple mode before the app boots.
+        # SidebarSessionList defaults to source grouping. Pin date grouping
+        # before the app boots so the date buckets under test are rendered.
         page.add_init_script(
-            "try { localStorage.setItem('qwenpaw_sidebar_mode', 'simple'); }"
+            "try { localStorage.setItem("
+            "'qwenpaw_session_group_mode', 'date'); }"
             " catch (e) {}"
         )
         chat = ChatPage(page)
```

---

### Incident Patch 2: `b944e1d5` (2026-09-30)
**Commit Message**: fix(ci): change permission (#8043)

**File**: `.github/workflows/pr-size.yml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ on:
     types: [opened, synchronize, reopened, edited]
 
 permissions:
-  pull-requests: read
+  pull-requests: write
   issues: write
 
 # Serialize updates for each PR. Each run reads the latest diff statistics.
```

---

### Incident Patch 3: `3ef7d377` (2026-09-30)
**Commit Message**: fix(hub): close database connections after transactions (#8038)

**File**: `src/qwenpaw/hub/database.py` (modified, +32/-6)
```diff
@@ -8,26 +8,52 @@
 import sqlite3
 from datetime import datetime, timezone
 from pathlib import Path
-from typing import Any
+from types import TracebackType
+from typing import Any, Literal
 
 from .config_migration import migrate_hub_settings
 
 _SCHEMA_GENERATION = "hub-v1"
 _JSON_DEFAULT = '{"schema_version":1}'
 
 
+class _HubConnection(sqlite3.Connection):
+    """Close the database handle after committing or rolling back."""
+
+    def __exit__(
+        self,
+        exc_type: type[BaseException] | None,
+        exc_value: BaseException | None,
+        traceback: TracebackType | None,
+    ) -> Literal[False]:
+        try:
+            return super().__exit__(exc_type, exc_value, traceback)
+        finally:
+            self.close()
+
+
 def utc_now() -> str:
     """Return one sortable UTC timestamp."""
     return datetime.now(timezone.utc).isoformat()
 
 
 def connect_hub_database(database_path: Path) -> sqlite3.Connection:
     """Open a consistently configured Hub database connection."""
-    connection = sqlite3.connect(database_path, timeout=5)
-    connection.row_factory = sqlite3.Row
-    connection.execute("PRAGMA foreign_keys = ON")
-    connection.execute("PRAGMA busy_timeout = 5000")
-    return connection
+    connection = sqlite3.connect(
+        database_path,
+        timeout=5,
+        factory=_HubConnection,
+    )
+    configured = False
+    try:
+        connection.row_factory = sqlite3.Row
+        connection.execute("PRAGMA foreign_keys = ON")
+        connection.execute("PRAGMA busy_timeout = 5000")
+        configured = True
+        return connection
+    finally:
+        if not configured:
+            connection.close()
 
 
 def initialize_hub_database(database_path: Path) -> None:
```

**File**: `tests/unit/hub/test_control_app.py` (modified, +19/-15)
```diff
@@ -3,6 +3,7 @@
 
 from collections.abc import AsyncIterator, Iterator, Mapping
 import asyncio
+from contextlib import closing
 from dataclasses import replace
 from datetime import datetime, timedelta, timezone
 import gzip
@@ -1538,11 +1539,12 @@ def test_deleted_runtime_owner_returns_no_username(tmp_path: Path) -> None:
             json={"runtime_id": "orphaned-runtime"},
             headers=_headers(member_token),
         )
-        with sqlite3.connect(auth.database_path) as connection:
-            connection.execute(
-                "UPDATE hub_users SET deleted_at = ? WHERE user_id = ?",
-                ("2026-01-01T00:00:00Z", member.user_id),
-            )
+        with closing(sqlite3.connect(auth.database_path)) as connection:
+            with connection:
+                connection.execute(
+                    "UPDATE hub_users SET deleted_at = ? WHERE user_id = ?",
+                    ("2026-01-01T00:00:00Z", member.user_id),
+                )
         runtimes = client.get(
             "/api/hub/runtimes?q=orphaned-runtime",
             headers=_headers(admin_token),
@@ -1695,11 +1697,12 @@ def test_invitation_failures_map_to_distinct_statuses(
     with _client(tmp_path, hub_config=config) as client:
         admin_token = _register(client, "owner")
         database = tmp_path / "control.db"
-        with sqlite3.connect(database) as connection:
-            connection.execute(
-                "UPDATE hub_settings SET value_json = ? WHERE key = ?",
-                ('"invite"', "registration_mode"),
-            )
+        with closing(sqlite3.connect(database)) as connection:
+            with connection:
+                connection.execute(
+                    "UPDATE hub_settings SET value_json = ? WHERE key = ?",
+                    ('"invite"', "registration_mode"),
+                )
         invitations = InvitationService(
             GovernanceStore(database),
             client.app.state.auth_service,
@@ -1752,11 +1755,12 @@ def attempt(username: str, code: str):
 
         expired_batch = issue()
         past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
-        with sqlite3.connect(database) as connection:
-            connection.execute(
-                "UPDATE hub_invites SET expires_at = ? WHERE id = ?",
-                (past, expired_batch["codes"][0]["id"]),
-            )
+        with closing(sqlite3.connect(database)) as connection:
+            with connection:
+                connection.execute(
+                    "UPDATE hub_invites SET expires_at = ? WHERE id = ?",
+                    (past, expired_batch["codes"][0]["id"]),
+                )
         expired = attempt(
             "u-expired",
             expired_batch["codes"][0]["code"],
```

**File**: `tests/unit/hub/test_database.py` (modified, +58/-0)
```diff
@@ -2,12 +2,16 @@
 """Tests for the stable QwenPaw Hub database shape."""
 
 import sqlite3
+from contextlib import closing
 from pathlib import Path
+from unittest.mock import MagicMock
 
 import pytest
 
+from qwenpaw.hub import database as database_module
 from qwenpaw.hub.database import (
     HubExtensionStore,
+    connect_hub_database,
     initialize_hub_database,
 )
 from qwenpaw.hub.registry import RuntimeRegistry
@@ -20,6 +24,60 @@ def _columns(database: Path, table: str) -> set[str]:
     return {str(row[1]) for row in rows}
 
 
+def _assert_closed(connection: sqlite3.Connection) -> None:
+    with pytest.raises(sqlite3.ProgrammingError, match="closed"):
+        connection.execute("SELECT 1")
+
+
+def test_connection_context_commits_and_closes(tmp_path: Path) -> None:
+    database = tmp_path / "control.db"
+    connection = connect_hub_database(database)
+
+    with connection:
+        connection.execute("CREATE TABLE example(value TEXT)")
+        connection.execute("INSERT INTO example VALUES ('committed')")
+
+    _assert_closed(connection)
+    with closing(sqlite3.connect(database)) as probe:
+        rows = probe.execute("SELECT value FROM example").fetchall()
+    assert rows == [("committed",)]
+
+
+def test_connection_context_rolls_back_and_closes(tmp_path: Path) -> None:
+    database = tmp_path / "control.db"
+    with connect_hub_database(database) as setup:
+        setup.execute("CREATE TABLE example(value TEXT)")
+    connection = connect_hub_database(database)
+
+    with pytest.raises(RuntimeError, match="rollback"):
+        with connection:
+            connection.execute("INSERT INTO example VALUES ('discarded')")
+            raise RuntimeError("rollback")
+
+    _assert_closed(connection)
+    with closing(sqlite3.connect(database)) as probe:
+        rows = probe.execute("SELECT value FROM example").fetchall()
+    assert rows == []
+
+
+def test_connection_closes_when_configuration_fails(
+    tmp_path: Path,
+    monkeypatch,
+) -> None:
+    connection = MagicMock()
+    connection.execute.side_effect = sqlite3.OperationalError("pragma failed")
+    monkeypatch.setattr(
+        database_module.sqlite3,
+        "connect",
+        MagicMock(return_value=connection),
+    )
+
+    with pytest.raises(sqlite3.OperationalError, match="pragma failed"):
+        connect_hub_database(tmp_path / "control.db")
+
+    connection.close.assert_called_once_with()
+
+
 def test_runtime_schema_uses_versioned_documents_for_variable_data(
     tmp_path: Path,
 ) -> None:
```

---

### Incident Patch 4: `99b2711d` (2026-09-30)
**Commit Message**: fix(ci): correct first-time PR detection and add automatic size labels (#8039)

**File**: `.github/workflows/first-time-contributor-welcome.yml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ jobs:
             const body = [
               `## Welcome to QwenPaw! :tada:`,
               ``,
-              `Thank you @${author} for your first contribution! Your PR has been merged. :rocket:`,
+              `Thank you @${author}! Your first pull request has been merged. :rocket:`,
               ``,
               `We'd love to give you a shout-out in our release notes! If you're comfortable sharing, ` +
               `please reply to this comment with your social media handles using the format below:`,
```

**File**: `.github/workflows/pr-size.yml` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+name: PR Size Label
+
+on:
+  pull_request_target:
+    types: [opened, synchronize, reopened, edited]
+
+permissions:
+  pull-requests: read
+  issues: write
+
+# Serialize updates for each PR. Each run reads the latest diff statistics.
+concurrency:
+  group: pr-size-${{ github.event.pull_request.number }}
+  cancel-in-progress: false
+
+jobs:
+  label:
+    # An edited event only changes the diff when the base branch changes.
+    if: >-
+      github.event.action != 'edited' ||
+      github.event.changes.base.ref != null
+    runs-on: ubuntu-latest
+    steps:
+      # This privileged workflow only reads API metadata; never run PR code.
+      - name: Update size label
+        uses: actions/github-script@v7
+        with:
+          script: |
+            const { owner, repo } = context.repo;
+            const issue_number = context.payload.pull_request.number;
+            const { data: pr } = await github.rest.pulls.get({
+              owner,
+              repo,
+              pull_number: issue_number,
+            });
+
+            if (pr.state !== 'open') {
+              core.info(`PR #${issue_number} is no longer open; skipping`);
+              return;
+            }
+
+            // Use the entire diff, including docs, generated files and lockfiles.
+            // A replaced line counts as one deletion plus one addition.
+            // Binary-only changes and pure renames may have zero changed lines.
+            if (!Number.isSafeInteger(pr.additions) || pr.additions < 0 ||
+                !Number.isSafeInteger(pr.deletions) || pr.deletions < 0) {
+              throw new Error('PR diff statistics are unavailable; keeping existing labels');
+            }
+            const changedLines = pr.additions + pr.deletions;
+            const sizes = [
+              { name: 'size/XS', max: 49, color: '3CBF00', range: '0-49' },
+              { name: 'size/S', max: 199, color: '5D9801', range: '50-199' },
+              { name: 'size/M', max: 499, color: '7F7203', range: '200-499' },
+              { name: 'size/L', max: 999, color: 'A14C05', range: '500-999' },
+              { name: 'size/XL', max: 1999, color: 'C32607', range: '1000-1999' },
+              { name: 'size/XXL', max: 3999, color: 'E50009', range: '2000-3999' },
+              { name: 'size/XXXL', max: Infinity, color: 'B60205', range: '4000+' },
+            ];
+            const target = sizes.find(size => changedLines <= size.max);
+
+            // Create each size label on first use. Another PR may create it
+            // concurrently, so verify existence after a creation conflict.
+            try {
+              await github.rest.issues.getLabel({ owner, repo, name: target.name });
+            } catch (error) {
+              if (error.status !== 404) throw error;
+              try {
+                await github.rest.issues.createLabel({
+                  owner,
+                  repo,
+                  name: target.name,
+                  color: target.color,
+                  description: `${target.range} changed lines (additions + deletions)`,
+                });
+              } catch (createError) {
+                if (createError.status !== 422) throw createError;
+                await github.rest.issues.getLabel({ owner, repo, name: target.name });
+              }
+            }
+
+            const labels = await github.paginate(github.rest.issues.listLabelsOnIssue, {
+              owner, repo, issue_number, per_page: 100,
+            });
+            const managedNames = new Set(sizes.map(size => size.name));
+
+            // Add first so an API failure never leaves the PR without a size.
+            // Only mutate our seven size labels, preserving all other labels.
+            if (!labels.some(label => label.name === target.name)) {
+              await github.rest.issues.addLabels({
+                owner, repo, issue_number, labels: [target.name],
+              });
+            }
+            for (const label of labels) {
+              if (managedNames.has(label.name) && label.name !== target.name) {
+                try {
+                  await github.rest.issues.removeLabel({
+                    owner, repo, issue_number, name: label.name,
+                  });
+                } catch (error) {
+                  // A maintainer may have already removed the stale label.
+                  if (error.status !== 404) throw error;
+                }
+              }
+            }
+
+            core.info(`PR #${issue_number}: +${pr.additions}/-${pr.deletions} = ${changedLines} changed lines -> ${target.name}`);
```

**File**: `.github/workflows/pr-welcome.yml` (modified, +29/-29)
```diff
@@ -156,44 +156,44 @@ jobs:
               return 'th';
             }
 
-            // Count user's total PRs in this repo using search API
+            // Count submissions, regardless of open/closed/merged state.
+            // List by creator to avoid Search API indexing delays. Issues are
+            // returned too, so only count entries with a pull_request field.
             let prCount = 0;
             let hasValidPRCount = false;
             try {
-              const { data: searchResult } = await github.rest.search.issuesAndPullRequests({
-                q: `repo:${context.repo.owner}/${context.repo.repo} type:pr author:${author}`,
-              });
-              prCount = searchResult.total_count;
+              const submissions = await github.paginate(
+                github.rest.issues.listForRepo,
+                {
+                  owner: context.repo.owner,
+                  repo: context.repo.repo,
+                  creator: author,
+                  state: 'all',
+                  sort: 'created',
+                  direction: 'asc',
+                  per_page: 100,
+                },
+              );
+              // Add the event PR explicitly, even if it is not listed yet.
+              // Exclude later PRs so delayed runs retain this PR's ordinal.
+              prCount = 1 + submissions.filter(issue =>
+                issue.pull_request && issue.number < prNumber
+              ).length;
               hasValidPRCount = true;
             } catch (err) {
               console.log(`Could not get PR count for ${author}, will skip count display`);
-              hasValidPRCount = false;
             }
 
-            // Check if this is user's first PR (for labeling)
-            let isFirstPR = false;
-            try {
-              const { data: searchResult } = await github.rest.search.issuesAndPullRequests({
-                q: `repo:${context.repo.owner}/${context.repo.repo} type:pr author:${author} is:closed`,
+            // Use the same submission count for both the label and greeting.
+            const isFirstPR = hasValidPRCount && prCount === 1;
+            if (isFirstPR) {
+              await github.rest.issues.addLabels({
+                owner: context.repo.owner,
+                repo: context.repo.repo,
+                issue_number: prNumber,
+                labels: ['first-time-contributor'],
               });
-              isFirstPR = searchResult.total_count === 0;
-
-              // Add first-time-contributor label only for first PR
-              if (isFirstPR) {
-                await github.rest.issues.addLabels({
-                  owner: context.repo.owner,
-                  repo: context.repo.repo,
-                  issue_number: prNumber,
-                  labels: ['first-time-contributor'],
-                });
-                console.log(`Labeled PR #${prNumber} as first-time-contributor`);
-              }
-            } catch (err) {
-              if (err.status === 422 && err.message && err.message.includes('cannot be searched')) {
-                console.log(`Search API cannot look up author ${author}, continuing without label`);
-              } else {
-                throw err;
-              }
+              console.log(`Labeled PR #${prNumber} as first-time-contributor`);
             }
 
             // Check if user has starred the repo by listing user's starred
```

---

### Incident Patch 5: `c17f1b2b` (2026-09-30)
**Commit Message**: fix(memory): restore runtime after backend rollback (#7893)

**File**: `src/qwenpaw/app/routers/workspace.py` (modified, +30/-0)
```diff
@@ -2057,6 +2057,36 @@ def rollback_config(current_config: BaseModel) -> None:
                                 "failed for agent '%s'",
                                 sanitize_log_value(workspace.agent_id),
                             )
+                        else:
+                            # The failed reload may have left a newer candidate
+                            # running with the rejected backend while the
+                            # persisted config is restored. Schedule a fresh
+                            # reload after the rollback so runtime and disk
+                            # converge. This also bumps the config generation,
+                            # invalidating candidates still being built from
+                            # the rejected configuration.
+                            try:
+                                runtime_restore_scheduled = (
+                                    schedule_agent_reload(
+                                        request,
+                                        workspace.agent_id,
+                                    )
+                                )
+                            except Exception:
+                                logger.exception(
+                                    "Backend config rolled back for agent "
+                                    "'%s' but runtime restore scheduling "
+                                    "failed",
+                                    sanitize_log_value(workspace.agent_id),
+                                )
+                            else:
+                                if not runtime_restore_scheduled:
+                                    logger.error(
+                                        "Backend config rolled back for agent "
+                                        "'%s' but runtime restore could not "
+                                        "be scheduled",
+                                        sanitize_log_value(workspace.agent_id),
+                                    )
                 finally:
                     selection_lease.release()
 
```

**File**: `tests/unit/app/routers/test_workspace_router.py` (modified, +13/-2)
```diff
@@ -457,7 +457,9 @@ def schedule_reload(_request, _agent_id, *, on_complete=None):
 
 
 @pytest.mark.asyncio
-async def test_failed_plugin_backend_reload_rolls_back_selection(tmp_path):
+async def test_failed_plugin_backend_reload_rolls_back_and_restores_runtime(
+    tmp_path,
+):
     owner = "selection-rollback-plugin"
     backend_id = "selection-rollback-memory"
     memory_registry.register_backend(
@@ -480,10 +482,17 @@ async def test_failed_plugin_backend_reload_rolls_back_selection(tmp_path):
         workspace_dir=tmp_path,
     )
     completion: Any = None
+    scheduled_backends: list[str] = []
+    scheduled_completions: list[Any] = []
 
     def schedule_reload(_request, _agent_id, *, on_complete=None):
         nonlocal completion
-        completion = on_complete
+        scheduled_backends.append(
+            agent_config.running.memory_manager_backend,
+        )
+        scheduled_completions.append(on_complete)
+        if on_complete is not None:
+            completion = on_complete
         return True
 
     try:
@@ -507,6 +516,8 @@ def schedule_reload(_request, _agent_id, *, on_complete=None):
             await completion(False)  # pylint: disable=not-callable
 
         assert agent_config.running.memory_manager_backend == "none"
+        assert scheduled_backends == [backend_id, "none"]
+        assert scheduled_completions == [completion, None]
         assert memory_registry.begin_owner_unload(owner) == []
     finally:
         memory_registry.cancel_owner_unload(owner)
```

---

### Incident Patch 6: `c3e572c1` (2026-09-30)
**Commit Message**: fix(e2e): align tests with redesigned console (#8037)

**File**: `e2e/pages/acp_page.py` (modified, +6/-3)
```diff
@@ -47,16 +47,19 @@ class ACPPage(BasePage):
     TAB_CUSTOM = '[class*="tab"]:has-text("Custom"), [class*="tab"]:has-text("自定义"), .qwenpaw-segmented-item:has-text("Custom")'
 
     # Create button
-    CREATE_BUTTON = 'button:has-text("Create"), button:has-text("创建"), button:has-text("Add"), button:has-text("添加")'
+    CREATE_BUTTON = (
+        'button:has-text("Add ACP integration"), '
+        'button:has-text("添加 ACP 接入")'
+    )
 
     # ACP card list
-    ACP_CARD = '[class*="acpCard"], [class*="ACPCard"], .qwenpaw-card'
+    ACP_CARD = '[class*="channelsGrid"] [class*="card"]'
     ACP_CARD_TITLE = '[class*="agentKey"], [class*="title"], .qwenpaw-card-meta-title'
     ACP_CARD_TAG = '.qwenpaw-tag'
     ACP_CARD_SWITCH = '.qwenpaw-switch'
 
     # ACP drawer (create/edit)
-    DRAWER = '.qwenpaw-drawer'
+    DRAWER = '[role="dialog"]:visible'
     DRAWER_TITLE = '.qwenpaw-drawer-title'
     DRAWER_CLOSE = '.qwenpaw-drawer-close'
 
```

**File**: `e2e/pages/agents_page.py` (modified, +32/-21)
```diff
@@ -42,28 +42,31 @@ class AgentsPage(BasePage):
     PAGE_HEADER = 'button:has-text("Create Agent"), span[class*="breadcrumbCurrent"]:has-text("智能体")'
     BREADCRUMB = 'span[class*="breadcrumbCurrent"]:has-text("智能体")'
 
-    # Agent list (table structure)
-    AGENT_TABLE = '.qwenpaw-table'
-    AGENT_LIST = '.qwenpaw-table-tbody'
-    AGENT_ITEM = '.qwenpaw-table-tbody tr.qwenpaw-table-row'
+    # Agent gallery. The settings redesign replaced the table with cards.
+    AGENT_TABLE = 'div[class*="grid"]'
+    AGENT_LIST = AGENT_TABLE
+    AGENT_ITEM = 'div[class*="grid"] article[class*="card"]'
     # Column order: drag handle (1) | Name (2) | ID (3) | Backend (4) |
     # Description (5) | Workspace (6) | Model (7) | Actions (8). Upstream
     # #6397 inserted the Backend column after ID, shifting everything to
     # its right. Actions is declared ``fixed: "right"``, so anchor it on
     # the fixed-column class instead of a position that keeps drifting.
-    AGENT_NAME_CELL = 'td.qwenpaw-table-cell:nth-child(2)'
-    AGENT_ID_CELL = 'td.qwenpaw-table-cell:nth-child(3)'
-    AGENT_DESC_CELL = 'td.qwenpaw-table-cell:nth-child(5)'
-    AGENT_WORKSPACE_CELL = 'td.qwenpaw-table-cell:nth-child(6)'
-    AGENT_MODEL_CELL = 'td.qwenpaw-table-cell:nth-child(7)'
-    AGENT_ACTIONS_CELL = 'td.qwenpaw-table-cell-fix-right'
+    AGENT_NAME_CELL = 'button[class*="open"] strong'
+    AGENT_ID_CELL = 'span[class*="identity"] code'
+    AGENT_DESC_CELL = 'div[class*="description"]'
+    AGENT_WORKSPACE_CELL = 'span[class*="identity"]'
+    AGENT_MODEL_CELL = 'button[class*="open"] > span:not([class])'
+    AGENT_ACTIONS_CELL = 'div[class*="quickActions"]'
     # Post-#6198 the name cell shows an AgentStatusIndicator dot exposing a
     # ``data-status`` attribute (disabled/pending/starting/running/failed)
     # instead of a "Disabled" Tag.
     AGENT_STATUS = '[data-status]'
 
     # Action buttons
-    CREATE_AGENT_BTN = 'button:has-text("创建智能体"), button:has-text("Create Agent"), .qwenpaw-btn-primary'
+    CREATE_AGENT_BTN = (
+        'button:has-text("创建智能体"), '
+        'button:has-text("Create Agent")'
+    )
     # Inline action buttons in a table row. Post v2.0.1 (#6262 added a Copy
     # button at position 3) the actions are 5 icon buttons in order:
     # Pin | Edit | Copy | Toggle | Delete. Anchor on icon semantics only —
@@ -73,10 +76,13 @@ class AgentsPage(BasePage):
     #   Copy   = antd CopyOutlined    -> .anticon-copy   (do not match)
     #   Toggle = lucide Eye/EyeOff    -> svg.lucide-eye / svg.lucide-eye-off
     #   Delete = antd DeleteOutlined  -> .anticon-delete (danger button)
-    EDIT_BTN = 'button:has(.anticon-edit)'
-    TOGGLE_BTN = 'button:has(svg.lucide-eye-off), button:has(svg.lucide-eye)'
-    DELETE_BTN = 'button.qwenpaw-btn-dangerous, button:has(.anticon-delete)'
-    ENABLE_TOGGLE = 'button:has(svg.lucide-eye-off), button:has(svg.lucide-eye)'
+    EDIT_BTN = 'button[aria-label="Edit"], button[aria-label="编辑"]'
+    TOGGLE_BTN = (
+        'button[aria-label="Enable"], button[aria-label="Disable"], '
+        'button[aria-label="启用"], button[aria-label="禁用"]'
+    )
+    DELETE_BTN = 'button:has-text("Delete"), button:has-text("删除")'
+    ENABLE_TOGGLE = TOGGLE_BTN
     REFRESH_BTN = 'button:has(.anticon-reload), button:has(.spark-icon-spark-refresh-line)'
 
     # Create/edit form
@@ -150,7 +156,7 @@ def get_agent_list(self) -> List[Dict]:
                 name_text = name_cell.inner_text() if name_cell.is_visible() else ""
                 # Post-#6198 status is an AgentStatusIndicator dot exposing a
                 # ``data-status`` attribute (no visible text) — read the attribute.
-                status_dot = name_cell.locator(self.AGENT_STATUS).first
+                status_dot = row.locator(self.AGENT_STATUS).first
                 status = (
                     (status_dot.get_attribute("data-status") or "").strip()
                     if status_dot.count() > 0 else ""
@@ -161,7 +167,11 @@ def get_agent_list(self) -> List[Dict]:
                 agent_id = id_cell.inner_text().strip() if id_cell.is_visible() else ""
 
                 desc_cell = row.locator(self.AGENT_DESC_CELL).first
-                desc = desc_cell.inner_text().strip() if desc_cell.is_visible() else ""
+                desc = (
+                    desc_cell.inner_text().strip()
+                    if desc_cell.count() > 0 and desc_cell.is_visible()
+                    else ""
+                )
 
                 agents.append({
                     "name": clean_name,
@@ -340,8 +350,10 @@ def click_delete_agent(self, agent_name: str) -> "AgentsPage":
         logger.info(f"Clicking delete for agent: {agent_name}")
         agent_row = self.find_agent_by_name(agent_name)
         if agent_row:
-            actions_cell = agent_row.locator(self.AGENT_ACTIONS_CELL).first
-            delete_btn = actions_cell.locator(self.DELETE_BTN).first
+            agent_row.locator('button[class*="open"]').first.c
```

**File**: `e2e/pages/channels_page.py` (modified, +23/-31)
```diff
@@ -46,7 +46,9 @@ class ChannelsPage(BasePage):
     # `[class*=availableItem]` would match one tile three times. The tile
     # container is a <div>; the name/action are <span>. Anchor on
     # `div[class*=availableItem]` to count each tile exactly once.
-    PAGE_LOAD_INDICATOR = '[class*=channelCard], div[class*=availableItem]'
+    PAGE_LOAD_INDICATOR = (
+        '[class*=channelCard], button[class*=availableItem]'
+    )
 
     # Filter buttons (UI text is Chinese; use button[class*=filterTab] to match the button rather than the parent container)
     FILTER_ALL_BTN = 'button[class*=filterTab]:has-text("全部"), button:has-text("All")'
@@ -60,9 +62,12 @@ class ChannelsPage(BasePage):
     # `find_channel_card` / `get_channel_card_count` operate on the union.
     # `div[class*=availableItem]` (not the bare substring) avoids triple
     # matching on the item's name/action spans.
-    CHANNEL_CARD = '[class*=channelCard], div[class*=availableItem]'
-    CHANNEL_CARD_ENABLED = '[class*=channelCard][class*=enabled]'
-    CHANNEL_CARD_DISABLED = 'div[class*=availableItem]'
+    CHANNEL_CARD = (
+        'div.qwenpaw-card[class*=channelCard], '
+        'button[class*=availableItem]'
+    )
+    CHANNEL_CARD_ENABLED = 'div.qwenpaw-card[class*=channelCard]'
+    CHANNEL_CARD_DISABLED = 'button[class*=availableItem]'
 
     # Channel card content
     CHANNEL_ICON = '[class*=channelCard] [class*=icon]'
@@ -74,9 +79,9 @@ class ChannelsPage(BasePage):
     CHANNEL_BOT_PREFIX = '[class*=channelCard] [class*=botPrefix]'
 
     # Edit drawer (match only the visible drawer to avoid strict mode violations)
-    CHANNEL_DRAWER = '.qwenpaw-drawer:visible, .ant-drawer:visible'
-    DRAWER_TITLE = '.qwenpaw-drawer-title, .ant-drawer-title'
-    DRAWER_CLOSE_BTN = '.qwenpaw-drawer-close, .ant-drawer-close'
+    CHANNEL_DRAWER = '[role="dialog"]:visible'
+    DRAWER_TITLE = '[role="dialog"] .qwenpaw-modal-title'
+    DRAWER_CLOSE_BTN = '[role="dialog"] .qwenpaw-modal-close'
 
     # Form fields
     FORM_ITEM = '.ant-form-item, .qwenpaw-form-item'
@@ -321,7 +326,9 @@ def wait_for_drawer_open(self, timeout: Optional[int] = None) -> bool:
         timeout = timeout or self.timeout
         logger.info("Waiting for drawer to open")
         try:
-            self.page.locator('.qwenpaw-drawer, .ant-drawer').first.wait_for(state="visible", timeout=timeout)
+            self.page.locator(self.CHANNEL_DRAWER).first.wait_for(
+                state="visible", timeout=timeout
+            )
             return True
         except Exception:
             return False
@@ -374,7 +381,7 @@ def toggle_enable(self, enable: bool = True) -> "ChannelsPage":
         """
         logger.info(f"Toggling enable to: {enable}")
         # Locate the switch inside the drawer
-        drawer = self.page.locator('.qwenpaw-drawer, .ant-drawer')
+        drawer = self.page.locator(self.CHANNEL_DRAWER)
         switch = drawer.locator('.qwenpaw-switch, .ant-switch').first
 
         # Read the current state
@@ -407,24 +414,9 @@ def fill_form_field(self, field_name: str, value: str) -> "ChannelsPage":
         return self
 
     def save_channel_config(self) -> "ChannelsPage":
-        """Save the channel configuration (the drawer does not close automatically after saving)."""
-        logger.info("Saving channel configuration")
-        submit_btn = self.page.locator(self.FORM_SUBMIT_BTN).first
-        # Wait for the save API request to complete via expect_response
-        try:
-            with self.page.expect_response(
-                lambda resp: '/api/config/channel' in resp.url and resp.request.method in ('PUT', 'POST', 'PATCH'),
-                timeout=10000
-            ) as response_info:
-                submit_btn.click()
-            response = response_info.value
-            logger.info(f"Save API response: status={response.status}")
-            if not response.ok:
-                logger.warning(f"Save API returned non-OK status: {response.status}")
-        except Exception:
-            # No save API response observed — likely blocked by client-side validation
-            logger.warning("Save API response not captured; possible client-side validation error")
-            self.page.wait_for_timeout(2000)
+        """Wait for the redesigned editor's debounced auto-save."""
+        logger.info("Waiting for channel configuration auto-save")
+        self.page.wait_for_timeout(1500)
         return self
 
     def has_form_validation_errors(self) -> bool:
@@ -439,9 +431,9 @@ def has_form_validation_errors(self) -> bool:
         return count > 0
 
     def cancel_channel_config(self) -> "ChannelsPage":
-        """Cancel the channel configuration."""
-        logger.info("Canceling channel configuration")
-        self.page.locator(self.FORM_CANCEL_BTN).first.click()
+        """Close the auto-saving channel editor."""
+        logger.info("Closing channel configuration")
+        self.close_drawer()
         self.wait_for_drawer
```

**File**: `e2e/pages/cronjobs_page.py` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ class CronJobsPage(BasePage):
     EXECUTE_NOW_BTN = 'button:has-text("Execute Now"), button:has-text("Run"), button:has-text("立即执行"), button:has-text("执行")'
 
     # Drawer / dialog
-    DRAWER = ".ant-drawer, .qwenpaw-drawer, [class*=drawer]"
+    DRAWER = '[role="dialog"]:visible'
     DRAWER_TITLE = ".ant-drawer-title, .qwenpaw-drawer-title"
     DRAWER_SAVE_BTN = '.ant-drawer .ant-btn-primary:has-text("Save"), .ant-drawer button:has-text("OK"), [class*=drawer] button:has-text("Save"), [class*=drawer] button:has-text("OK"), [class*=drawer] button:has-text("保存"), [class*=drawer] button:has-text("保 存"), [class*=drawer] button:has-text("确定"), [class*=drawer] .qwenpaw-btn-primary'
     DRAWER_CANCEL_BTN = '.ant-drawer .ant-btn:has-text("Cancel"), [class*=drawer] button:has-text("取消"), [class*=drawer] button:has-text("取 消")'
```

**File**: `e2e/pages/heartbeat_page.py` (modified, +55/-72)
```diff
@@ -36,24 +36,31 @@ class HeartbeatPage(BasePage):
     
     # ========== Selector definitions ==========
 
-    # Page load indicator (no h1 on the page; use a switch or input instead)
-    PAGE_LOAD_INDICATOR = '.ant-switch, .qwenpaw-switch, input'
+    PAGE_LOAD_INDICATOR = '[role="switch"][aria-label]'
 
     # Configuration card
     CONFIG_CARD = ".ant-card, .qwenpaw-card, [class*=card]"
     CONFIG_FORM = ".ant-form, .qwenpaw-form"
 
-    # Enabled switch (match id="enabled" exactly to avoid the "active hours" switch)
-    ENABLED_SWITCH = '#enabled'
+    ENABLED_SWITCH = (
+        '[role="switch"][aria-label="Enable heartbeat"], '
+        '[role="switch"][aria-label="开启心跳"]'
+    )
     ENABLED_LABEL = '.ant-form-item:has-text("Enable"), .ant-form-item:has-text("启用"), .qwenpaw-form-item:has-text("启用"), .qwenpaw-form-item:has-text("开启")'
 
     # Interval configuration.
     # v2.0.0 (PR #5557) added a sibling `#timeoutSeconds` InputNumber to the
     # same page, so the previous broad selector matched two elements and
     # Playwright strict-mode `.fill()` failed. Anchor on `#everyNumber` —
     # the id emitted by the frontend Form.Item name="everyNumber".
-    INTERVAL_INPUT = 'input#everyNumber'
-    INTERVAL_UNIT_SELECT = '.qwenpaw-select:has(#everyUnit), .ant-select:has(#everyUnit), .ant-select:has-text("seconds"), .ant-select:has-text("minutes"), .ant-select:has-text("hours"), .qwenpaw-select:has-text("秒"), .qwenpaw-select:has-text("分钟"), .qwenpaw-select:has-text("小时")'
+    INTERVAL_INPUT = (
+        '[role="spinbutton"][aria-label="Hours"], '
+        '[role="spinbutton"][aria-label="小时"]'
+    )
+    INTERVAL_UNIT_SELECT = (
+        '[role="spinbutton"][aria-label="Minutes"], '
+        '[role="spinbutton"][aria-label="分钟"]'
+    )
 
     # Scheduled time
     TIME_PICKER = '.ant-picker-input > input, .qwenpaw-picker-input > input'
@@ -62,8 +69,8 @@ class HeartbeatPage(BasePage):
     # Skill configuration
     SKILL_SELECT = '.ant-select[data-placeholder*="Skill" i], .ant-select:has-text("skill"), .qwenpaw-select[data-placeholder*="技能" i], .qwenpaw-select:has-text("技能")'
 
-    # Save button (the actual UI may render "保 存" with a space)
-    SAVE_BTN = 'button:has-text("Save"), button:has-text("保存"), button:has-text("保 存")'
+    # The redesigned form persists changes through useAutoSave.
+    SAVE_BTN = 'form[class*="schedule"]'
 
     # Status indicator
     STATUS_INDICATOR = '.ant-badge-status, .qwenpaw-badge-status, .status-indicator'
@@ -106,28 +113,11 @@ def is_heartbeat_enabled(self) -> bool:
     
     def get_interval(self) -> Dict[str, Any]:
         """Return the heartbeat interval configuration."""
-        interval_input = self.page.locator(self.INTERVAL_INPUT)
-        unit_select = self.page.locator(self.INTERVAL_UNIT_SELECT)
-
-        result = {"value": None, "unit": None}
-
-        if interval_input.count() > 0:
-            result["value"] = interval_input.first.input_value()
-
-        if unit_select.count() > 0:
-            # Prefer the title attribute, falling back to inner_text
-            selection_item = unit_select.first.locator('.qwenpaw-select-selection-item, .ant-select-selection-item')
-            if selection_item.count() > 0:
-                unit_text = selection_item.get_attribute('title') or selection_item.inner_text().strip()
-                result["unit"] = unit_text if unit_text else None
-            else:
-                # Fallback: take the container text and clean it up
-                raw_text = unit_select.first.inner_text().strip()
-                # Strip label text, keep only the selected value
-                if raw_text:
-                    result["unit"] = raw_text.split('\n')[0].strip() if '\n' in raw_text else raw_text
-
-        return result
+        hours = self.page.locator(self.INTERVAL_INPUT).first
+        minutes = self.page.locator(self.INTERVAL_UNIT_SELECT).first
+        hour_value = int(hours.get_attribute("aria-valuenow") or 0)
+        minute_value = int(minutes.get_attribute("aria-valuenow") or 0)
+        return {"value": hour_value * 60 + minute_value, "unit": "minutes"}
 
     def get_scheduled_time(self) -> Optional[str]:
         """Return the scheduled time."""
@@ -164,34 +154,25 @@ def disable_heartbeat(self) -> "HeartbeatPage":
 
     def set_interval(self, value: int, unit: str = "minutes") -> "HeartbeatPage":
         """Set the heartbeat interval (accepts Chinese or English units)."""
-        # Set the numeric value
-        interval_input = self.page.locator(self.INTERVAL_INPUT)
-        if interval_input.count() > 0:
-            interval_input.fill(str(value))
-
-        # Pick the unit
-        if unit:
-            unit_select = self.page.locator(self.INTERVAL_UNIT_SELECT)
-            if unit_select.count() > 0:
-                unit_select.first.click()
-                self.page.wait_for_timeout(300)
-                # Try every Chinese/English alias
-                aliases = self.UNIT_AL
```

**File**: `e2e/pages/runtime_config_page.py` (modified, +24/-21)
```diff
@@ -33,17 +33,17 @@ class RuntimeConfigPage(BasePage):
     # ========== Selector definitions ==========
 
     # Page-loaded indicator
-    PAGE_LOAD_INDICATOR = '.qwenpaw-tabs-tab-btn'
+    PAGE_LOAD_INDICATOR = '[role="tab"]'
 
     # Tabs
-    REACT_TAB = '[data-node-key="reactAgent"] .qwenpaw-tabs-tab-btn'
-    LLM_RETRY_TAB = '[data-node-key="llmRetry"] .qwenpaw-tabs-tab-btn'
-    LLM_RATE_LIMITER_TAB = '[data-node-key="llmRateLimiter"] .qwenpaw-tabs-tab-btn'
-    CONTEXT_COMPACT_TAB = '[data-node-key="lightContext"] .qwenpaw-tabs-tab-btn'
-    TOOL_RESULT_COMPACT_TAB = '[data-node-key="lightContext"] .qwenpaw-tabs-tab-btn'  # Merged into the Context Management tab
-    MEMORY_SUMMARY_TAB = '[data-node-key="remeLightMemory"] .qwenpaw-tabs-tab-btn'
-    EMBEDDING_CONFIG_TAB = '[data-node-key="remeLightMemory"] .qwenpaw-tabs-tab-btn'  # Embedding model config merged into the Long-term Memory tab
-    TOOL_EXECUTION_LEVEL_TAB = '[data-node-key="toolExecutionLevel"] .qwenpaw-tabs-tab-btn'
+    REACT_TAB = '[role="tab"]:has-text("Workspace")'
+    LLM_RETRY_TAB = '[role="tab"]:has-text("Recovery")'
+    LLM_RATE_LIMITER_TAB = LLM_RETRY_TAB
+    CONTEXT_COMPACT_TAB = '[role="tab"]:has-text("Context budget")'
+    TOOL_RESULT_COMPACT_TAB = CONTEXT_COMPACT_TAB
+    MEMORY_SUMMARY_TAB = '[role="tab"]:has-text("Memory")'
+    EMBEDDING_CONFIG_TAB = MEMORY_SUMMARY_TAB
+    TOOL_EXECUTION_LEVEL_TAB = '[role="tab"]:has-text("Execution")'
 
     # Active panel
     ACTIVE_PANEL = '.qwenpaw-tabs-tabpane-active'
@@ -190,9 +190,19 @@ def switch_to_tab(self, tab_key: str) -> "RuntimeConfigPage":
         Generic tab-switch method.
 
         Args:
-            tab_key: the tab's data-node-key value, e.g. "reactAgent", "llmRetry", etc.
+            tab_key: the runtime section key.
         """
-        tab_selector = f'[data-node-key="{tab_key}"] .qwenpaw-tabs-tab-btn'
+        selectors = {
+            "reactAgent": self.REACT_TAB,
+            "agentLoop": self.TOOL_EXECUTION_LEVEL_TAB,
+            "toolExecutionLevel": self.TOOL_EXECUTION_LEVEL_TAB,
+            "llmRetry": self.LLM_RETRY_TAB,
+            "llmRateLimiter": self.LLM_RATE_LIMITER_TAB,
+            "lightContext": self.CONTEXT_COMPACT_TAB,
+            "remeLightMemory": self.MEMORY_SUMMARY_TAB,
+            "embeddingModel": self.EMBEDDING_CONFIG_TAB,
+        }
+        tab_selector = selectors[tab_key]
         tab = self.page.locator(tab_selector).first
         expect(tab).to_be_visible(timeout=self.timeout)
         tab.click()
@@ -350,16 +360,9 @@ def get_save_button(self) -> Locator:
         return self.page.locator(self.SAVE_BTN).first
 
     def click_save(self) -> "RuntimeConfigPage":
-        """Click the save button."""
-        save_btn = self.get_save_button()
-        if not save_btn.is_visible():
-            # Try locating it inside the footer
-            save_btn = self.page.locator('div[class*="footer"] button.qwenpaw-btn-primary').first
-
-        expect(save_btn).to_be_visible(timeout=self.timeout)
-        save_btn.click()
-        self.page.wait_for_timeout(2000)
-        logger.info("Clicked save button")
+        """Wait for the runtime workbench's debounced auto-save."""
+        self.page.wait_for_timeout(1500)
+        logger.info("Runtime configuration auto-save completed")
         return self
 
     # ========== Assertion methods ==========
```

**File**: `e2e/pages/security_page.py` (modified, +6/-13)
```diff
@@ -33,11 +33,11 @@ class SecurityPage(BasePage):
     # ========== Selector definitions ==========
 
     # Page load indicator
-    PAGE_LOAD_INDICATOR = '.qwenpaw-tabs-tab-btn'
+    PAGE_LOAD_INDICATOR = '[role="tab"]'
 
     # Tabs
-    TOOL_GUARD_TAB = '[data-node-key="toolGuard"] .qwenpaw-tabs-tab-btn'
-    FILE_GUARD_TAB = '[data-node-key="fileGuard"] .qwenpaw-tabs-tab-btn'
+    TOOL_GUARD_TAB = '[role="tab"]:has-text("Tool Guard")'
+    FILE_GUARD_TAB = '[role="tab"]:has-text("File Guard")'
 
     # Active panel
     ACTIVE_PANEL = '.qwenpaw-tabs-tabpane-active'
@@ -146,16 +146,9 @@ def disable_guard(self) -> "SecurityPage":
     # ========== Save action ==========
 
     def click_save(self) -> "SecurityPage":
-        """Click the Save button."""
-        save_btn = self.page.locator(self.SAVE_BTN).first
-        if not save_btn.is_visible():
-            # Fall back to the footer
-            save_btn = self.page.locator('div[class*="footer"] button.qwenpaw-btn-primary').first
-
-        expect(save_btn).to_be_visible(timeout=self.timeout)
-        save_btn.click()
-        self.page.wait_for_timeout(2000)
-        logger.info("Save button clicked")
+        """Wait for the security workbench's debounced auto-save."""
+        self.page.wait_for_timeout(1500)
+        logger.info("Security configuration auto-save completed")
         return self
 
     # ========== Misc helpers ==========
```

**File**: `e2e/tests/test_acp.py` (modified, +37/-94)
```diff
@@ -26,42 +26,14 @@
 
 logger = logging.getLogger(__name__)
 
-# The ACP page's own create button.
-#
-# The selector this replaces was
-#   button:has-text("Create"), ... button:has-text("New")
-# plus ``.first``. Upstream #7502 added a "New task" button to the sidebar
-# whose label is real text (``<span>New task</span>`` in ``layouts/Sidebar.tsx``,
-# not merely an aria-label), so ``has-text("New")`` matched it. The sidebar
-# comes before ``main`` in DOM order and ``.first`` picks DOM order, so the case
-# clicked "New task", got navigated to /chat, and then failed asserting that the
-# ACP drawer was visible — the drawer never had a chance to open. The failure
-# surface was misleading twice over: pytest's logging prefix pointed at
-# ``test_acp.py:243`` (a ``logger.error`` call inside the except block) and the
-# traceback line at the drawer assertion, neither of which is where the defect
-# is.
-#
-# Three things pin the new selector to the right button:
-# - ``headerActions`` is the PageHeader action row of this page
-#   (``pages/Agent/ACP/index.tsx`` -> ``stylesACP.headerActions``). No sidebar
-#   component uses that class, so scoping to it excludes the sidebar entirely.
-#   This matters because the ACP page renders no ``<main>`` element, so the
-#   usual "limit to main" scoping is not available here.
-# - ``btn-primary``: the button is ``<Button type="primary">``. Its sibling
-#   "Node Settings" has no type, so this also separates the two.
-# - The label comes from ``acp.create``, which is "Add Custom Agent" in en.json
-#   and "新增 Custom Agent" in zh.json — note it contains neither "Create" nor
-#   "New" in English, which is why the old text anchors could only ever match
-#   the sidebar.
-# ``btn-primary`` is not unique on its own: the account panel in
-# ``layouts/Sidebar.tsx`` also has a primary Save button, and five other pages
-# define their own ``headerActions`` class. The two anchors together are.
+# Match the page action by its localized visible label. Generic Create/New
+# selectors also match the sidebar's New task button.
 ACP_CREATE_BUTTON = (
-    '[class*="headerActions"] button.qwenpaw-btn-primary:has-text("Add Custom Agent"), '
-    '[class*="headerActions"] button.qwenpaw-btn-primary:has-text("新增 Custom Agent"), '
-    '[class*="headerActions"] button.ant-btn-primary:has-text("Add Custom Agent"), '
-    '[class*="headerActions"] button.ant-btn-primary:has-text("新增 Custom Agent")'
+    'button:has-text("Add ACP integration"), '
+    'button:has-text("添加 ACP 接入")'
 )
+ACP_CARD_SELECTOR = '[class*="channelsGrid"] [class*="card"]'
+ACP_DIALOG_SELECTOR = '[role="dialog"]:visible'
 
 
 # ============================================================================
@@ -128,9 +100,7 @@ def test_acp_page_load_and_card_list(self, page: Page, request: pytest.FixtureRe
 
             # 5. Verify ACP card list
             log_test_step("5. Verify ACP card list")
-            cards = page.locator(
-                '[class*="acpCard"], [class*="ACPCard"], .qwenpaw-card'
-            ).all()
+            cards = page.locator(ACP_CARD_SELECTOR).all()
             assert len(cards) > 0, "ACP card list should not be empty (at least builtin ACP expected)"
             logger.info(f"Found {len(cards)} ACP cards")
 
@@ -194,7 +164,7 @@ def test_create_acp_drawer_form(self, page: Page, request: pytest.FixtureRequest
 
             # 3. Verify drawer opens
             log_test_step("3. Verify drawer opens")
-            drawer = page.locator(".qwenpaw-drawer, .qwenpaw-modal").first
+            drawer = page.locator(ACP_DIALOG_SELECTOR)
             expect(drawer).to_be_visible(timeout=5000)
             logger.info("ACP create drawer opened")
 
@@ -306,9 +276,7 @@ def test_acp_toggle_switch(self, page: Page, request: pytest.FixtureRequest):
 
             # 2. Find toggle on ACP card
             log_test_step("2. Find toggle on ACP card")
-            cards = page.locator(
-                '[class*="acpCard"], [class*="ACPCard"], .qwenpaw-card'
-            ).all()
+            cards = page.locator(ACP_CARD_SELECTOR).all()
 
             if len(cards) == 0:
                 logger.info("No ACP cards found, skipping validation")
@@ -334,13 +302,14 @@ def test_acp_toggle_switch(self, page: Page, request: pytest.FixtureRequest):
 
             # 4. Toggle state
             log_test_step("4. Toggle switch state")
-            target_switch.click()
-            page.wait_for_timeout(1000)
-
-            new_checked = target_switch.evaluate(
-                "el => el.classList.contains('qwenpaw-switch-checked') || "
-                "el.getAttribute('aria-checked') === 'true'"
-            )
+            with page.expect_request(
+                lambda request: request.method == "PUT"
+                and "/config/acp/" in request.url
+            ) as request_info:
+                target_switch.click()
+            request = request_info.value
+            payload = request.post_data_json
+    
```

---

### Incident Patch 7: `b6229ec3` (2026-09-30)
**Commit Message**: fix(terminal): support high posix descriptors (#8032)

**File**: `src/qwenpaw/services/terminal_posix.py` (modified, +7/-14)
```diff
@@ -11,7 +11,7 @@
 import threading
 
 
-IO_POLL_INTERVAL = 0.1
+IO_POLL_TIMEOUT_MS = 100
 
 
 class PosixPty:
@@ -25,6 +25,10 @@ def __init__(self, process, master):
         self.decoder = codecs.getincrementaldecoder("utf-8")("replace")
         self.closing = threading.Event()
         os.set_blocking(master, False)
+        self.reader_poll = select.poll()
+        self.reader_poll.register(master, select.POLLIN)
+        self.writer_poll = select.poll()
+        self.writer_poll.register(master, select.POLLOUT)
 
     @classmethod
     def spawn(cls, command, cwd, env, dimensions):
@@ -70,13 +74,7 @@ def spawn(cls, command, cwd, env, dimensions):
     def read(self, size):
         """Decode output incrementally, tolerating arbitrary program bytes."""
         while not self.closing.is_set():
-            readable, _, _ = select.select(
-                [self.fd],
-                [],
-                [],
-                IO_POLL_INTERVAL,
-            )
-            if not readable:
+            if not self.reader_poll.poll(IO_POLL_TIMEOUT_MS):
                 continue
             try:
                 data = os.read(self.fd, size)
@@ -96,12 +94,7 @@ def write(self, text):
             try:
                 count = os.write(self.fd, data)
             except BlockingIOError:
-                select.select(
-                    [],
-                    [self.fd],
-                    [],
-                    IO_POLL_INTERVAL,
-                )
+                self.writer_poll.poll(IO_POLL_TIMEOUT_MS)
                 continue
             data = data[count:]
 
```

---

### Incident Patch 8: `77744172` (2026-09-29)
**Commit Message**: fix(desktop): disable NSIS solid compression (#8025)

**File**: `.github/workflows/fork-verify-desktop.yml` (modified, +1/-0)
```diff
@@ -161,6 +161,7 @@ jobs:
           New-Item -ItemType Directory -Force -Path dist | Out-Null
           Copy-Item -Force $installer.FullName $target
           Write-Host "Staged: $target"
+          Write-Host "Installer size: $($installer.Length) bytes ($([Math]::Round($installer.Length / 1MB, 2)) MiB)"
 
       - name: Verify desktop (Tauri Windows)
         timeout-minutes: 10
```

**File**: `console/src-tauri/nsis/tauri-installer.nsi` (added, +981/-0)
```diff
@@ -0,0 +1,981 @@
+; Vendored from Tauri v2.11.4:
+; crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi
+; Local change: use per-file compression instead of /SOLID to reduce the
+; uncompressed temporary datablock size during packaging.
+Unicode true
+ManifestDPIAware true
+; Add in `dpiAwareness` `PerMonitorV2` to manifest for Windows 10 1607+ (note this should not affect lower versions since they should be able to ignore this and pick up `dpiAware` `true` set by `ManifestDPIAware true`)
+; Currently undocumented on NSIS's website but is in the Docs folder of source tree, see
+; https://github.com/kichik/nsis/blob/5fc0b87b819a9eec006df4967d08e522ddd651c9/Docs/src/attributes.but#L286-L300
+; https://github.com/tauri-apps/tauri/pull/10106
+ManifestDPIAwareness PerMonitorV2
+
+!if "{{compression}}" == "none"
+  SetCompress off
+!else
+  ; Set the compression algorithm. We default to LZMA.
+  SetCompressor "{{compression}}"
+!endif
+
+; Keep above !include to stay ahead of any plugin command
+; see https://github.com/tauri-apps/tauri/pull/15422#discussion_r3289239624
+{{#if signed_plugins_path}}
+!addplugindir "{{signed_plugins_path}}"
+{{/if}}
+
+!include MUI2.nsh
+!include FileFunc.nsh
+!include x64.nsh
+!include WordFunc.nsh
+!include "utils.nsh"
+!include "FileAssociation.nsh"
+!include "Win\COM.nsh"
+!include "Win\Propkey.nsh"
+!include "StrFunc.nsh"
+${StrCase}
+${StrLoc}
+
+{{#if installer_hooks}}
+!include "{{installer_hooks}}"
+{{/if}}
+
+!define WEBVIEW2APPGUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
+
+!define MANUFACTURER "{{manufacturer}}"
+!define PRODUCTNAME "{{product_name}}"
+!define VERSION "{{version}}"
+!define VERSIONWITHBUILD "{{version_with_build}}"
+!define HOMEPAGE "{{homepage}}"
+!define INSTALLMODE "{{install_mode}}"
+!define LICENSE "{{license}}"
+!define INSTALLERICON "{{installer_icon}}"
+!define SIDEBARIMAGE "{{sidebar_image}}"
+!define HEADERIMAGE "{{header_image}}"
+!define UNINSTALLERICON "{{uninstaller_icon}}"
+!define UNINSTALLERHEADERIMAGE "{{uninstaller_header_image}}"
+!define MAINBINARYNAME "{{main_binary_name}}"
+!define MAINBINARYSRCPATH "{{main_binary_path}}"
+!define BUNDLEID "{{bundle_id}}"
+!define COPYRIGHT "{{copyright}}"
+!define OUTFILE "{{out_file}}"
+!define ARCH "{{arch}}"
+!define ADDITIONALPLUGINSPATH "{{additional_plugins_path}}"
+!define ALLOWDOWNGRADES "{{allow_downgrades}}"
+!define DISPLAYLANGUAGESELECTOR "{{display_language_selector}}"
+!define INSTALLWEBVIEW2MODE "{{install_webview2_mode}}"
+!define WEBVIEW2INSTALLERARGS "{{webview2_installer_args}}"
+!define WEBVIEW2BOOTSTRAPPERPATH "{{webview2_bootstrapper_path}}"
+!define WEBVIEW2INSTALLERPATH "{{webview2_installer_path}}"
+!define MINIMUMWEBVIEW2VERSION "{{minimum_webview2_version}}"
+!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
+!define MANUKEY "Software\${MANUFACTURER}"
+!define MANUPRODUCTKEY "${MANUKEY}\${PRODUCTNAME}"
+!define UNINSTALLERSIGNCOMMAND "{{uninstaller_sign_cmd}}"
+!define ESTIMATEDSIZE "{{estimated_size}}"
+!define STARTMENUFOLDER "{{start_menu_folder}}"
+
+Var PassiveMode
+Var UpdateMode
+Var NoShortcutMode
+Var WixMode
+Var OldMainBinaryName
+
+Name "${PRODUCTNAME}"
+BrandingText "${COPYRIGHT}"
+OutFile "${OUTFILE}"
+
+; We don't actually use this value as default install path,
+; it's just for nsis to append the product name folder in the directory selector
+; https://nsis.sourceforge.io/Reference/InstallDir
+!define PLACEHOLDER_INSTALL_DIR "placeholder\${PRODUCTNAME}"
+InstallDir "${PLACEHOLDER_INSTALL_DIR}"
+
+VIProductVersion "${VERSIONWITHBUILD}"
+VIAddVersionKey "ProductName" "${PRODUCTNAME}"
+VIAddVersionKey "FileDescription" "${PRODUCTNAME}"
+VIAddVersionKey "LegalCopyright" "${COPYRIGHT}"
+VIAddVersionKey "FileVersion" "${VERSION}"
+VIAddVersionKey "ProductVersion" "${VERSION}"
+
+# additional plugins
+!addplugindir "${ADDITIONALPLUGINSPATH}"
+
+; Uninstaller signing command
+!if "${UNINSTALLERSIGNCOMMAND}" != ""
+  !uninstfinalize '${UNINSTALLERSIGNCOMMAND}'
+!endif
+
+; Handle install mode, `perUser`, `perMachine` or `both`
+!if "${INSTALLMODE}" == "perMachine"
+  RequestExecutionLevel admin
+!endif
+
+!if "${INSTALLMODE}" == "currentUser"
+  RequestExecutionLevel user
+!endif
+
+!if "${INSTALLMODE}" == "both"
+  !define MULTIUSER_MUI
+  !define MULTIUSER_INSTALLMODE_INSTDIR "${PRODUCTNAME}"
+  !define MULTIUSER_INSTALLMODE_COMMANDLINE
+  !if "${ARCH}" == "x64"
+    !define MULTIUSER_USE_PROGRAMFILES64
+  !else if "${ARCH}" == "arm64"
+    !define MULTIUSER_USE_PROGRAMFILES64
+  !endif
+  !define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_KEY "${UNINSTKEY}"
+  !define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_VALUENAME "CurrentUser"
+  !define MULTIUSER_INSTALLMODEPAGE_SHOWUSERNAME
+  !define MULTIUSER_INSTALLMODE_FUNCTION RestorePreviousInstallLocation
+  !define MULTIUSER_EXECUTIONLEVEL Highest
+  !include MultiUser.nsh
+!endif
+
+; Installer icon
+!if "${INSTALLERICON}" != ""
+  !define MUI_ICON "${INSTALLERICON}"
+!en
```

**File**: `console/src-tauri/tauri.conf.json` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@
         "silent": true
       },
       "nsis": {
+        "template": "nsis/tauri-installer.nsi",
         "installerIcon": "../../scripts/pack/assets/icon.ico",
         "uninstallerIcon": "../../scripts/pack/assets/icon.ico",
         "installerHooks": "nsis-hooks.nsh",
```

**File**: `tests/unit/tauri/test_desktop_workflows.py` (modified, +29/-0)
```diff
@@ -1,6 +1,7 @@
 # -*- coding: utf-8 -*-
 """Regression tests for desktop packaging workflows."""
 
+import json
 from pathlib import Path
 import tomllib
 
@@ -110,3 +111,31 @@ def test_download_helper_resolves_verifier_from_its_own_checkout() -> None:
 
     assert 'script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"' in script
     assert 'python3 "$script_dir/verify_desktop_artifacts.py"' in script
+
+
+def test_nsis_template_avoids_solid_compression() -> None:
+    """Large desktop payloads must not use NSIS solid compression."""
+    config = json.loads(
+        (REPO_ROOT / "console/src-tauri/tauri.conf.json").read_text(
+            encoding="utf-8",
+        ),
+    )
+    package_lock = json.loads(
+        (REPO_ROOT / "console/package-lock.json").read_text(
+            encoding="utf-8",
+        ),
+    )
+    nsis = config["bundle"]["windows"]["nsis"]
+    template = (REPO_ROOT / "console/src-tauri" / nsis["template"]).read_text(
+        encoding="utf-8",
+    )
+    tauri_cli_version = package_lock["packages"][
+        "node_modules/@tauri-apps/cli"
+    ]["version"]
+
+    assert nsis["compression"] == "zlib"
+    # This is a version-sync reminder, not an upstream content check.
+    # When upgrading the CLI, compare the template with that release.
+    assert f"Vendored from Tauri v{tauri_cli_version}" in template
+    assert 'SetCompressor "{{compression}}"' in template
+    assert "SetCompressor /SOLID" not in template
```

---

### Incident Patch 9: `df3055c2` (2026-09-29)
**Commit Message**: fix(ci): address cross-platform paths, sandbox cleanup, and Windows terminal interrupts (#8026)

**File**: `src/qwenpaw/portability/providers/qoder_schedules.py` (modified, +2/-2)
```diff
@@ -708,11 +708,11 @@ def _parse_aware_datetime(value: Any) -> datetime | None:
 
 
 def _load_timezone(value: str) -> ZoneInfo | None:
-    if not value:
+    if not value.strip():
         return None
     try:
         return ZoneInfo(value)
-    except (ValueError, ZoneInfoNotFoundError):
+    except (ValueError, ZoneInfoNotFoundError, OSError):
         return None
 
 
```

**File**: `src/qwenpaw/services/terminal_windows.py` (modified, +11/-15)
```diff
@@ -5,35 +5,30 @@
 import ctypes
 import importlib
 import multiprocessing
+import sys
 import threading
 import time
 
 import psutil
 
 
-def interrupt_console(pid):
-    """Send Ctrl+C only from the isolated worker to its shell's console."""
+def enable_ctrl_c():
+    """Clear inherited Ctrl+C suppression in the isolated PTY worker."""
+    if sys.platform != "win32":
+        return
+    # Console Ctrl+C ignore state is inherited, including by ConPTY children.
+    # Reset it before spawning the shell; writing ETX cannot override it.
     kernel = ctypes.WinDLL("kernel32", use_last_error=True)
-    kernel.FreeConsole()
-    if not kernel.AttachConsole(pid):
+    if not kernel.SetConsoleCtrlHandler(None, False):
         raise ctypes.WinError(ctypes.get_last_error())
-    try:
-        if not kernel.SetConsoleCtrlHandler(None, True):
-            raise ctypes.WinError(ctypes.get_last_error())
-        if not kernel.GenerateConsoleCtrlEvent(0, 0):
-            raise ctypes.WinError(ctypes.get_last_error())
-        # Control handlers run asynchronously; stay attached for delivery.
-        time.sleep(0.1)
-    finally:
-        kernel.FreeConsole()
 
 
 def write_input(process, data):
-    """Preserve text order while translating ETX into a console event."""
+    """Send interrupts through the owned PTY, preserving input order."""
     parts = data.split("\x03")
     for index, part in enumerate(parts):
         if index:
-            interrupt_console(process.pid)
+            process.sendintr()
         if part:
             process.write(part)
 
@@ -64,6 +59,7 @@ def pty_worker(control, output, command, cwd, env, dimensions):
     """Own one native PTY; process exit releases its OS handles as well."""
     try:
         native = importlib.import_module("winpty").PtyProcess
+        enable_ctrl_c()
         process = native.spawn(
             command,
             cwd=cwd,
```

**File**: `tests/unit/portability/test_qoder_schedules_mapping.py` (modified, +16/-0)
```diff
@@ -596,6 +596,22 @@ def test_timezone_loading_accepts_known_zones() -> None:
     assert zone.key == "Asia/Shanghai"
 
 
+def test_timezone_loading_rejects_whitespace_before_lookup(monkeypatch):
+    def unexpected_lookup(_value):
+        pytest.fail("Whitespace must not reach the timezone filesystem lookup")
+
+    monkeypatch.setattr(qoder_schedules, "ZoneInfo", unexpected_lookup)
+    assert qoder_schedules._load_timezone("   ") is None
+
+
+def test_timezone_loading_handles_unreadable_zone(monkeypatch):
+    def unreadable(_value):
+        raise PermissionError("timezone resource is unreadable")
+
+    monkeypatch.setattr(qoder_schedules, "ZoneInfo", unreadable)
+    assert qoder_schedules._load_timezone("Asia/Shanghai") is None
+
+
 @pytest.mark.parametrize(
     ("value", "expected"),
     [
```

**File**: `tests/unit/services/test_terminal_windows.py` (modified, +11/-3)
```diff
@@ -7,7 +7,7 @@
 import subprocess
 import sys
 import threading
-from unittest.mock import MagicMock
+from unittest.mock import MagicMock, call
 
 import psutil
 import pytest
@@ -22,6 +22,9 @@ def test_worker_protocol_and_eof(monkeypatch):
     process.fileobj.recv.return_value = b""
     process.isalive.return_value = False
     process.exitstatus = 7
+    startup = MagicMock()
+    startup.attach_mock(native.PtyProcess.spawn, "spawn")
+    monkeypatch.setattr(windows, "enable_ctrl_c", startup.enable_ctrl_c)
     monkeypatch.setattr(windows.importlib, "import_module", lambda _: native)
     control, child_control = multiprocessing.Pipe()
     output, child_output = multiprocessing.Pipe(duplex=False)
@@ -34,6 +37,10 @@ def test_worker_protocol_and_eof(monkeypatch):
     try:
         assert control.poll(3)
         assert control.recv() == (True, 123)
+        assert startup.mock_calls[:2] == [
+            call.enable_ctrl_c(),
+            call.spawn([], cwd=".", env={}, dimensions=(24, 80)),
+        ]
         for request_id, (operation, args, expected) in enumerate(
             [
                 ("write", ("hello",), None),
@@ -47,8 +54,9 @@ def test_worker_protocol_and_eof(monkeypatch):
             assert control.recv() == (request_id, True, expected)
         process.write.assert_called_once_with("hello")
         process.setwinsize.assert_called_once_with(30, 100)
-        assert output.poll(3)
-        with pytest.raises(EOFError):
+        # Windows may report the closed pipe from poll(), before recv().
+        with pytest.raises((EOFError, BrokenPipeError)):
+            assert output.poll(3)
             output.recv()
     finally:
         control.close()
```

**File**: `tests/unit/services/test_terminal_windows_control.py` (modified, +63/-65)
```diff
@@ -1,20 +1,38 @@
 # -*- coding: utf-8 -*-
-"""Console event routing contracts and a Windows-only native smoke test."""
+"""PTY interrupt contracts and a Windows-only native smoke test."""
 
 import ctypes
 import os
 import sys
 import time
+from types import SimpleNamespace
 from unittest.mock import MagicMock, call
 
 import pytest
 
 from qwenpaw.services import terminal_windows as windows
 
 
+def worker_ignoring_ctrl_c(*args):
+    """Reproduce a launcher that passes Ctrl+C suppression to its children."""
+    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
+    if not kernel.SetConsoleCtrlHandler(None, True):
+        raise ctypes.WinError(ctypes.get_last_error())
+    windows.pty_worker(*args)
+
+
 @pytest.mark.skipif(sys.platform != "win32", reason="Real Windows console")
-def test_native_ping_interrupt_and_host_cleanup(tmp_path):
+@pytest.mark.parametrize("inherited_ignore", [False, True])
+def test_native_ping_interrupt_and_host_cleanup(
+    tmp_path,
+    monkeypatch,
+    inherited_ignore,
+):
     pytest.importorskip("winpty")
+    if inherited_ignore:
+        # multiprocessing spawn imports this module afresh in the worker,
+        # where windows.pty_worker still refers to the production function.
+        monkeypatch.setattr(windows, "pty_worker", worker_ignoring_ctrl_c)
     adapter = windows.WindowsPty.spawn(
         ["powershell.exe", "-NoLogo", "-NoProfile"],
         str(tmp_path),
@@ -31,9 +49,12 @@ def until(marker):
         assert marker in output, output
 
     try:
+        adapter.write("function prompt { 'QWENPAW_' + 'READY>' }; \r")
+        until("QWENPAW_READY>")
         adapter.write("ping -n 30 127.0.0.1\r")
         until("TTL=")
         adapter.write("\x03")
+        until("QWENPAW_READY>")
         adapter.write("echo ('QWENPAW_' + 'INTERRUPT_OK')\r")
         until("QWENPAW_INTERRUPT_OK")
         owned = adapter.owner.children(recursive=True)
@@ -42,45 +63,11 @@ def until(marker):
     assert all(not process.is_running() for process in owned)
 
 
-def test_control_c_uses_console_event_and_preserves_text_order(monkeypatch):
-    process = MagicMock(pid=123)
-    events = MagicMock()
-    process.write = events.write
-    monkeypatch.setattr(windows, "interrupt_console", events.interrupt)
-    windows.write_input(process, "before\x03after\x03")
-    assert events.mock_calls == [
-        call.write("before"),
-        call.interrupt(123),
-        call.write("after"),
-        call.interrupt(123),
-    ]
-
-
-def test_interrupt_attaches_only_to_owned_shell(monkeypatch):
-    kernel = MagicMock()
-    kernel.AttachConsole.return_value = True
-    kernel.SetConsoleCtrlHandler.return_value = True
-    kernel.GenerateConsoleCtrlEvent.return_value = True
-    monkeypatch.setattr(
-        ctypes,
-        "WinDLL",
-        lambda *_a, **_kw: kernel,
-        raising=False,
-    )
-    monkeypatch.setattr(windows.time, "sleep", lambda _: None)
-    windows.interrupt_console(123)
-    assert kernel.mock_calls == [
-        call.FreeConsole(),
-        call.AttachConsole(123),
-        call.SetConsoleCtrlHandler(None, True),
-        call.GenerateConsoleCtrlEvent(0, 0),
-        call.FreeConsole(),
-    ]
-
-
-def test_failed_attach_never_signals_another_console(monkeypatch):
+@pytest.mark.parametrize("success", [True, False])
+def test_enable_ctrl_c_clears_inherited_ignore(monkeypatch, success):
     kernel = MagicMock()
-    kernel.AttachConsole.return_value = False
+    kernel.SetConsoleCtrlHandler.return_value = success
+    monkeypatch.setattr(windows, "sys", SimpleNamespace(platform="win32"))
     monkeypatch.setattr(
         ctypes,
         "WinDLL",
@@ -91,32 +78,43 @@ def test_failed_attach_never_signals_another_console(monkeypatch):
     monkeypatch.setattr(
         ctypes,
         "WinError",
-        lambda _: OSError("attach failed"),
+        lambda _: OSError("reset failed"),
         raising=False,
     )
-    with pytest.raises(OSError, match="attach failed"):
-        windows.interrupt_console(123)
-    kernel.GenerateConsoleCtrlEvent.assert_not_called()
+    if success:
+        windows.enable_ctrl_c()
+    else:
+        with pytest.raises(OSError, match="reset failed"):
+            windows.enable_ctrl_c()
+    assert kernel.mock_calls == [call.SetConsoleCtrlHandler(None, False)]
 
 
-def test_failed_event_detaches_console(monkeypatch):
-    kernel = MagicMock()
-    kernel.AttachConsole.return_value = True
-    kernel.SetConsoleCtrlHandler.return_value = True
-    kernel.GenerateConsoleCtrlEvent.return_value = False
-    monkeypatch.setattr(
-        ctypes,
-        "WinDLL",
-        lambda *_a, **_kw: kernel,
-        raising=False,
-    )
-    monkeypatch.setattr(ctypes, "get_last_error", lambda: 6, raising=False)
-    monkeypatch.setattr(
-        ctypes,
-        "WinError",
-        lambda _: OSError("signal failed"),
-        raising=False,
-    )
-    with pytest.raises(OSError, match="signal failed"):
-        windows.interrupt
```

---

### Incident Patch 10: `e793f6b0` (2026-09-29)
**Commit Message**: fix(chat): restore compact copy action icons (#8021)

**File**: `console/src/pages/Chat/index.module.less` (modified, +4/-10)
```diff
@@ -112,20 +112,14 @@
       font-size: var(--app-icon-default) !important;
     }
 
-    [class$="-bubble-footer-actions-item"]:has(svg) {
-      display: inline-flex;
-      min-width: var(--app-icon-button);
-      min-height: var(--app-icon-button);
-      align-items: center;
-      justify-content: center;
-
+    [class$="-bubble-footer-actions"] button:has(svg) {
       [data-spark-icon] {
-        font-size: var(--app-icon-md) !important;
+        font-size: var(--app-icon-sm) !important;
       }
 
       svg {
-        width: var(--app-icon-md);
-        height: var(--app-icon-md);
+        width: var(--app-icon-sm);
+        height: var(--app-icon-sm);
       }
     }
   }
```

**File**: `console/src/pages/Chat/index.tsx` (modified, +4/-6)
```diff
@@ -35,11 +35,9 @@ import { useAppMessage } from "../../hooks/useAppMessage";
 import { useIsMobile } from "../../hooks/useIsMobile";
 import {
   CircleAlert as ExclamationCircleOutlined,
-  Settings as SettingOutlined,
-} from "lucide-react";
-import {
+  Copy,
   Paperclip as SparkAttachmentLine,
-  Copy as SparkCopyLine,
+  Settings as SettingOutlined,
 } from "lucide-react";
 import { usePlugins } from "../../plugins/PluginContext";
 import { useTranslation } from "react-i18next";
@@ -4438,7 +4436,7 @@ export default function ChatPage() {
           {
             icon: (
               <span title={t("common.copy")}>
-                <SparkCopyLine size="1em" />
+                <Copy />
               </span>
             ),
             onClick: ({ data }: { data: CopyableResponse }) => {
@@ -4477,7 +4475,7 @@ export default function ChatPage() {
             },
           },
           {
-            icon: <SparkCopyLine size="1em" />,
+            icon: <Copy />,
             onClick: ({ data }: { data: { input?: unknown[] } }) => {
               const text = (data?.input || [])
                 .map(extractUserMessageText)
```

**File**: `console/src/styles/uiFontSizeCoverage.test.ts` (modified, +12/-4)
```diff
@@ -37,6 +37,7 @@ const artifactStyles = readSource(
 );
 const layoutStyles = readSource("src/layouts/index.module.less");
 const chatStyles = readSource("src/pages/Chat/index.module.less");
+const chatSource = readSource("src/pages/Chat/index.tsx");
 const filesWorkspaceStyles = readSource(
   "src/features/files-workspace/FilesWorkspace.module.less",
 );
@@ -601,9 +602,16 @@ describe("console font-size coverage", () => {
     expect(workspaceButtonRule).toContain("var(--app-icon-md)");
     expect(workspaceButtonRule).toContain("font-size: var(--app-icon-md)");
 
-    expect(chatStyles).toContain('[class$="-bubble-footer-actions-item"]');
-    expect(chatStyles).toContain("min-width: var(--app-icon-button)");
-    expect(chatStyles).toContain("width: var(--app-icon-md)");
-    expect(chatStyles).toContain("[data-spark-icon]");
+    expect(chatStyles).toContain(
+      '[class$="-bubble-footer-actions"] button:has(svg)',
+    );
+    expect(chatStyles).toMatch(
+      /-bubble-footer-actions[\s\S]*?font-size: var\(--app-icon-sm\) !important;[\s\S]*?width: var\(--app-icon-sm\);[\s\S]*?height: var\(--app-icon-sm\);/,
+    );
+    expect(chatSource).toMatch(
+      /import \{[\s\S]*?Copy,[\s\S]*?\} from "lucide-react"/,
+    );
+    expect(chatSource).toContain("<Copy />");
+    expect(chatSource).not.toContain("SparkCopyLine");
   });
 });
```

---

### Incident Patch 11: `89f6e828` (2026-09-29)
**Commit Message**: fix(ci): resolve cross-platform path handling and test failures (#8003)

**File**: `src/qwenpaw/_compat/message.py` (modified, +3/-3)
```diff
@@ -12,6 +12,7 @@
 Once all on-disk sessions have been re-saved in the 2.0 format this
 whole module can be deleted together with the polyfill.
 """
+
 from __future__ import annotations
 
 import json
@@ -27,6 +28,7 @@
     URLSource,
 )
 
+from ..utils.media_paths import media_basename
 
 _MODALITY_DEFAULT_MIME = {
     "image": "image/*",
@@ -175,9 +177,7 @@ def _coerce_block(block: Any) -> Any:
                 path = ""
         else:
             path = str(source) if source else ""
-        filename = (
-            filename or (path.rsplit("/", 1)[-1] if path else "") or "file"
-        )
+        filename = filename or (media_basename(path) if path else "") or "file"
         text = (
             f"File '{filename}' is available at: {path}"
             if path
```

**File**: `src/qwenpaw/agents/acp/permissions.py` (modified, +4/-0)
```diff
@@ -1,5 +1,6 @@
 # -*- coding: utf-8 -*-
 """ACP permission handling."""
+
 from __future__ import annotations
 
 import json
@@ -395,6 +396,9 @@ def _target(self, tool_call: dict[str, Any]) -> str | None:
         return self._summary(tool_call)
 
     def _display_path(self, value: str) -> str:
+        """Use native separators for valid paths; preserve NUL input."""
+        if "\x00" in value:
+            return value
         try:
             path = Path(value).expanduser()
             cwd_path = Path(self.cwd)
```

**File**: `src/qwenpaw/agents/model_factory.py` (modified, +4/-1)
```diff
@@ -69,6 +69,7 @@
 )
 from ..utils.logging import sanitize_log_value
 from ..utils.media_paths import (
+    media_basename,
     file_url_to_path as _file_url_to_path,
     local_media_path as _local_media_path,
 )
@@ -1434,7 +1435,9 @@ def _fixup_media_list(items: list) -> None:
             )
             filename = (
                 fname_hint
-                or (readable_path.rsplit("/", 1)[-1] if readable_path else "")
+                # Accept both separators, including Windows session paths
+                # processed on a different host platform.
+                or (media_basename(readable_path) if readable_path else "")
                 or "file"
             )
             items[i] = TextBlock(
```

**File**: `src/qwenpaw/sandbox/_cleanup_logging.py` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+# -*- coding: utf-8 -*-
+"""Suppress sandbox exit logs without affecting other execution contexts."""
+
+from contextlib import contextmanager
+from contextvars import ContextVar
+import logging
+
+_QUIET = ContextVar("sandbox_cleanup_quiet", default=False)
+
+
+class _CleanupFilter(logging.Filter):
+    def filter(self, record: logging.LogRecord) -> bool:
+        return not _QUIET.get()
+
+
+@contextmanager
+def cleanup_logging(log_progress: bool):
+    """Silence the loaded sandbox call chain before it reaches any handler."""
+    if log_progress:
+        yield
+        return
+    loggers = [
+        value
+        for name, value in list(logging.Logger.manager.loggerDict.items())
+        if name.startswith("qwenpaw.sandbox.")
+        and isinstance(value, logging.Logger)
+    ]
+    log_filter = _CleanupFilter()
+    token = _QUIET.set(True)
+    try:
+        for logger in loggers:
+            logger.addFilter(log_filter)
+        yield
+    finally:
+        for logger in loggers:
+            logger.removeFilter(log_filter)
+        _QUIET.reset(token)
+
+
+@contextmanager
+def cleanup_errors(logger: logging.Logger, message: str, *args):
+    """Keep cleanup best-effort while reporting failures outside quiet mode."""
+    try:
+        yield
+    except Exception:
+        try:
+            logger.exception(message, *args)
+        except Exception:
+            # A broken logging handler must not prevent subsequent cleanup.
+            pass
```

**File**: `src/qwenpaw/sandbox/windows_appcontainer_sandbox.py` (modified, +44/-21)
```diff
@@ -46,6 +46,8 @@
     _string_to_sid,
 )
 
+from ._cleanup_logging import cleanup_errors, cleanup_logging
+
 logger = logging.getLogger(__name__)
 
 
@@ -1202,7 +1204,19 @@ def _cleanup_single_container(  # pylint: disable=R0912
             pass
 
 
-def shutdown_cleanup() -> None:
+def shutdown_cleanup(*, log_progress: bool = True) -> None:
+    """Clean containers, silencing the entire sandbox call chain at exit."""
+    with (
+        cleanup_logging(log_progress),
+        cleanup_errors(
+            logger,
+            "Unexpected sandbox shutdown failure",
+        ),
+    ):
+        _shutdown_cleanup(log_progress=log_progress)
+
+
+def _shutdown_cleanup(*, log_progress: bool) -> None:
     """Destroys AppContainer sandboxes owned by this process or orphaned.
 
     Iterates metadata files under ``~/.qwenpaw/containers/``, skips
@@ -1216,26 +1230,33 @@ def shutdown_cleanup() -> None:
     my_pid = os.getpid()
 
     for meta_file in containers_dir.glob("*.json"):
-        try:
+        with cleanup_errors(logger, "Failed to clean metadata %s", meta_file):
             meta = json.loads(meta_file.read_text(encoding="utf-8"))
-        except (json.JSONDecodeError, OSError):
-            continue
-
-        owner_pid = meta.get("owner_pid")
-
-        if owner_pid is not None and owner_pid != my_pid:
-            if _is_pid_alive(owner_pid):
-                logger.debug(
-                    "Skipping container %s — owner pid %d still alive",
-                    meta.get("container_name", "?"),
-                    owner_pid,
-                )
-                continue
-
-        container_name = meta.get("container_name", "")
-        if container_name:
-            logger.info("Cleaning AppContainer: %s", container_name)
-            _cleanup_single_container(meta, meta_file)
+            if not isinstance(meta, dict):
+                raise ValueError("Sandbox metadata must be an object")
+            owner_pid = meta.get("owner_pid")
+            if owner_pid is not None and (
+                not isinstance(owner_pid, int)
+                or isinstance(owner_pid, bool)
+                or owner_pid <= 0
+            ):
+                raise ValueError("Invalid sandbox owner PID")
+
+            if owner_pid is not None and owner_pid != my_pid:
+                if _is_pid_alive(owner_pid):
+                    if log_progress:
+                        logger.debug(
+                            "Skipping container %s — owner pid %d still alive",
+                            meta.get("container_name", "?"),
+                            owner_pid,
+                        )
+                    continue
+
+            container_name = meta.get("container_name", "")
+            if container_name:
+                if log_progress:
+                    logger.info("Cleaning AppContainer: %s", container_name)
+                _cleanup_single_container(meta, meta_file)
 
     if containers_dir.exists() and not list(containers_dir.glob("*.json")):
         try:
@@ -1244,4 +1265,6 @@ def shutdown_cleanup() -> None:
             pass
 
 
-atexit.register(shutdown_cleanup)
+# Logging streams (including pytest capture) may already be closed at exit.
+# Keep cleanup active, but omit routine progress messages from this callback.
+atexit.register(shutdown_cleanup, log_progress=False)
```

**File**: `src/qwenpaw/sandbox/windows_elevated_sandbox.py` (modified, +21/-6)
```diff
@@ -64,6 +64,8 @@
     _get_kernel32 as _get_shared_kernel32,
 )
 
+from ._cleanup_logging import cleanup_errors, cleanup_logging
+
 logger = logging.getLogger(__name__)
 
 
@@ -2692,7 +2694,19 @@ def _remove_acl_with_verify_sync_local(  # pylint: disable=unused-argument
     return False
 
 
-def shutdown_cleanup() -> None:
+def shutdown_cleanup(*, log_progress: bool = True) -> None:
+    """Clean sandbox state, optionally silencing the whole cleanup chain."""
+    with (
+        cleanup_logging(log_progress),
+        cleanup_errors(
+            logger,
+            "Unexpected sandbox shutdown failure",
+        ),
+    ):
+        _shutdown_cleanup()
+
+
+def _shutdown_cleanup() -> None:
     """Cleans up elevated sandbox instances owned by this process or orphaned.
 
     Removes ACLs, firewall rules, local user accounts, and profile
@@ -2720,10 +2734,11 @@ def shutdown_cleanup() -> None:
     )
 
     for meta_file, meta in orphaned:
-        username = meta.get("username", "")
-        if username:
-            logger.info("Cleaning sandbox metadata: %s", username)
-            _cleanup_from_metadata(meta, meta_file)
+        with cleanup_errors(logger, "Failed to clean metadata %s", meta_file):
+            username = meta.get("username", "")
+            if username:
+                logger.info("Cleaning sandbox metadata: %s", username)
+                _cleanup_from_metadata(meta, meta_file)
 
     if sb_dir.exists() and not list(sb_dir.glob("*.json")):
         try:
@@ -2925,4 +2940,4 @@ def _cleanup_from_metadata(  # pylint: disable=R0912
     )
 
 
-atexit.register(shutdown_cleanup)
+atexit.register(shutdown_cleanup, log_progress=False)
```

**File**: `src/qwenpaw/sandbox/windows_unelevated_sandbox.py` (modified, +104/-79)
```diff
@@ -33,6 +33,8 @@
 from pathlib import Path
 from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple
 
+from ._cleanup_logging import cleanup_errors, cleanup_logging
+
 if sys.platform == "win32" or TYPE_CHECKING:
     import msvcrt
 
@@ -1776,22 +1778,26 @@ def _iter_orphaned_metadata(
     result: List[Tuple[Path, Dict[str, Any]]] = []
 
     for meta_file in sb_dir.glob("*.json"):
-        try:
+        with cleanup_errors(logger, "Failed to read metadata %s", meta_file):
             meta = json.loads(meta_file.read_text(encoding="utf-8"))
-        except (json.JSONDecodeError, OSError):
-            continue
-
-        owner_pid = meta.get("owner_pid")
-        if owner_pid is not None and owner_pid != my_pid:
-            if _is_pid_alive(owner_pid):
-                logger.debug(
-                    "Skipping sandbox %s — owner pid %d still alive",
-                    meta.get("sandbox_id", "?"),
-                    owner_pid,
-                )
-                continue
-
-        result.append((meta_file, meta))
+            if not isinstance(meta, dict):
+                raise ValueError("Sandbox metadata must be an object")
+            owner_pid = meta.get("owner_pid")
+            if owner_pid is not None and (
+                not isinstance(owner_pid, int)
+                or isinstance(owner_pid, bool)
+                or owner_pid <= 0
+            ):
+                raise ValueError("Invalid sandbox owner PID")
+            if owner_pid is not None and owner_pid != my_pid:
+                if _is_pid_alive(owner_pid):
+                    logger.debug(
+                        "Skipping sandbox %s — owner pid %d still alive",
+                        meta.get("sandbox_id", "?"),
+                        owner_pid,
+                    )
+                    continue
+            result.append((meta_file, meta))
 
     return result
 
@@ -2870,7 +2876,19 @@ def _move_to_failed_cleanup_unelevated(
     logger.info("Cleanup failed, metadata preserved: %s", dest.name)
 
 
-def shutdown_cleanup() -> None:  # pylint: disable=R0912
+def shutdown_cleanup(*, log_progress: bool = True) -> None:
+    """Clean sandbox state, optionally silencing the whole cleanup chain."""
+    with (
+        cleanup_logging(log_progress),
+        cleanup_errors(
+            logger,
+            "Unexpected sandbox shutdown failure",
+        ),
+    ):
+        _shutdown_cleanup()
+
+
+def _shutdown_cleanup() -> None:  # pylint: disable=R0912
     """Best-effort cleanup of unelevated sandbox ACLs on process exit.
 
     Removes ACEs for orphaned sandboxes whose owner process is dead.
@@ -2888,7 +2906,8 @@ def shutdown_cleanup() -> None:  # pylint: disable=R0912
     except Exception as e:
         logger.warning("Failed to clean deny_paths protection on exit: %s", e)
 
-    _migrate_legacy_state_file()
+    with cleanup_errors(logger, "Failed to migrate legacy sandbox state"):
+        _migrate_legacy_state_file()
 
     sb_dir = _unelevated_sandboxes_dir()
     orphaned = _iter_orphaned_metadata(sb_dir)
@@ -2899,67 +2918,9 @@ def shutdown_cleanup() -> None:  # pylint: disable=R0912
     sandboxes_processed = 0
 
     for meta_file, meta in orphaned:
-        cap_sid = meta.get("cap_sid", "")
-        if not cap_sid:
-            continue
-
-        sandbox_id = meta.get("sandbox_id", cap_sid)
-        acl_entries = meta.get("acl_entries", [])
-        deadline = time.monotonic() + 60.0
-        failed_paths: List[str] = []
-
-        t_sandbox = time.monotonic()
-        for entry in acl_entries:
-            entry_path = entry.get("path", "")
-            if entry_path and os.path.exists(entry_path):
-                t_entry = time.monotonic()
-                ok = _remove_acl_with_verify_sync(
-                    entry_path,
-                    cap_sid,
-                    deadline=deadline,
-                )
-                logger.debug(
-                    "  [%s] ACL remove [%s] %s: %.2fs",
-                    sandbox_id,
-                    "OK" if ok else "FAIL",
-                    entry_path,
-                    time.monotonic() - t_entry,
-                )
-                if not ok:
-                    failed_paths.append(entry_path)
-
-        t_acl_done = time.monotonic()
-
-        if failed_paths:
-            logger.warning(
-                "Unelevated sandbox cleanup: failed to remove ACL for "
-                "SID %s from %d path(s): %s",
-                cap_sid,
-                len(failed_paths),
-                failed_paths,
-            )
-
-        logger.info(
-            "[%s] ACL removal: %.2fs (%d entries, %d failed)",
-            sandbox_id,
-            t_acl_done - t_sandbox,
-            len(acl_entries),
-            len(failed_paths),
-        )
-
-        if failed_paths:
-            _move_to_failed_cleanup_unelevated(
-                meta,
-                meta_file,
-                f"ACL removal failed for {len(failed_paths)} path(s)",
-     
```

**File**: `src/qwenpaw/utils/media_paths.py` (modified, +28/-0)
```diff
@@ -3,6 +3,10 @@
 
 from __future__ import annotations
 
+import ntpath
+import os
+import posixpath
+
 from urllib.parse import unquote, urlparse
 
 _REMOTE_MEDIA_SCHEMES = frozenset(
@@ -26,6 +30,8 @@ def file_url_to_path(url: str) -> str:
         value = value[1:]
     elif len(value) >= 2 and value[0].isalpha() and value[1] == ":":
         pass
+    elif value.startswith("\\\\"):
+        pass
     elif not value.startswith("/"):
         value = f"//{value}"
     return unquote(value)
@@ -41,3 +47,25 @@ def local_media_path(url: str) -> str | None:
     if scheme and not is_windows_drive:
         return None
     return path or None
+
+
+def media_basename(path: str) -> str:
+    """Extract a name without treating POSIX backslashes as separators.
+
+    Drive, UNC and explicit backslash-relative paths use Windows rules.
+    Slash-rooted paths use POSIX rules. Ambiguous relative paths follow
+    the host platform; cross-host callers should supply a filename hint.
+    File URLs are decoded only for name extraction.
+    """
+    if path.startswith("file://"):
+        path = file_url_to_path(path)
+    windows_path = (
+        (len(path) >= 2 and path[0].isalpha() and path[1] == ":")
+        or path.startswith(("\\\\", "//", ".\\", "..\\"))
+        or (
+            os.name == "nt"
+            and not path.startswith("/")
+            and not urlparse(path).scheme
+        )
+    )
+    return ntpath.basename(path) if windows_path else posixpath.basename(path)
```

---

### Incident Patch 12: `159f4f2c` (2026-09-29)
**Commit Message**: fix(website): update blog (#7806)

**File**: `website/public/blog/qwenpaw-developer-day-collection.en.md` (modified, +14/-2)
```diff
@@ -1,16 +1,28 @@
 ---
 title: "QwenPaw Developer Day Collection"
-date: 2026-09-03
+date: 2026-09-15
 author: QwenPaw Team
 tags: [DeveloperDay, MeetingNotes, SessionRecordings]
 cover: /blog/qwenpaw-developer-day-collection-cover.png
 excerpt: "Replay archive from QwenPaw developer day sessions — in-depth technical talks and practical insights for every QwenPaw developer and enthusiast."
 ---
 
-Last updated September 3, 2026
+Last updated September 15, 2026
 
 ---
 
+**09-15 QwenPaw Community Meetup: QwenPaw Frontend Optimization Deep Dive**
+
+Meeting link: https://shanji.dingtalk.com/app/transcribes/76327569643434393938383539385f323034353035363233375f30
+
+**09-10 QwenPaw Community Meetup: QwenPaw-Creator Update Deep Dive**
+
+Meeting link: https://shanji.dingtalk.com/app/transcribes/76327569643434333432323139315f323034353035363233375f30
+
+**09-08 QwenPaw Community Meetup: AgentScope Realtime Interaction & SOP Capability Building Deep Dive**
+
+Meeting link: https://shanji.dingtalk.com/app/transcribes/76327569643433393835303931305f323034353035363233375f39
+
 **09-03 QwenPaw Community Meetup: QwenPaw Hub Deep Dive**
 
 Meeting link: https://shanji.dingtalk.com/app/transcribes/76327569643433333230363031335f323034353035363233375f30
```

**File**: `website/public/blog/qwenpaw-developer-day-collection.zh.md` (modified, +14/-2)
```diff
@@ -1,16 +1,28 @@
 ---
 title: "QwenPaw 开发者日会合集"
-date: 2026-09-03
+date: 2026-09-15
 author: QwenPaw Team
 tags: [开发者日会, 会议纪要, 会议录屏]
 cover: /blog/qwenpaw-developer-day-collection-cover.png
 excerpt: "QwenPaw团队召开开发者日会，为每一位 QwenPaw 开发者与爱好者提供一份兼具理论深度与落地价值的完整技术交流档案。"
 ---
 
-最近更新 2026 年 9 月 3 日
+最近更新 2026 年 9 月 15 日
 
 ---
 
+**09-15 QwenPaw 社区交流会：QwenPaw 前端优化详解**
+
+会议链接：https://shanji.dingtalk.com/app/transcribes/76327569643434393938383539385f323034353035363233375f30
+
+**09-10 QwenPaw 社区交流会：QwenPaw-Creator 更新详解**
+
+会议链接：https://shanji.dingtalk.com/app/transcribes/76327569643434333432323139315f323034353035363233375f30
+
+**09-08 QwenPaw 社区交流会：AgentScope Realtime 实时交互 & SOP 能力构建详解**
+
+会议链接：https://shanji.dingtalk.com/app/transcribes/76327569643433393835303931305f323034353035363233375f39
+
 **09-03 QwenPaw 社区交流会：QwenPaw Hub 详解**
 
 会议链接：https://shanji.dingtalk.com/app/transcribes/76327569643433333230363031335f323034353035363233375f30
```

---

### Incident Patch 13: `8d664cee` (2026-09-29)
**Commit Message**: fix(console): restore chat icons and truncate project labels (#8019)

**File**: `console/src/features/project-directory/SessionProjectDirectory.module.less` (modified, +7/-0)
```diff
@@ -1,5 +1,6 @@
 .trigger {
   max-width: 240px;
+  min-width: 0;
   height: auto;
   min-height: max(30px, calc(30px * var(--app-font-scale)));
   padding: 0 9px;
@@ -20,6 +21,8 @@
   }
 
   > span {
+    min-width: 0;
+    flex: 1 1 0;
     overflow: hidden;
     color: var(--app-text);
     font-size: var(--app-font-caption);
@@ -29,9 +32,13 @@
   }
 
   em {
+    min-width: 0;
+    flex: 0 1 auto;
+    overflow: hidden;
     color: var(--app-accent-text);
     font-size: calc(11px * var(--app-font-scale));
     font-style: normal;
+    text-overflow: ellipsis;
     white-space: nowrap;
   }
 
```

**File**: `console/src/pages/Chat/index.module.less` (modified, +3/-3)
```diff
@@ -102,14 +102,14 @@
     [class$="-sender-prefix"] button svg,
     [class$="-sender-actions-list"] button svg,
     [class$="-sender-actions-btn"] svg {
-      width: var(--app-icon-sm);
-      height: var(--app-icon-sm);
+      width: var(--app-icon-default);
+      height: var(--app-icon-default);
     }
 
     [class$="-sender-prefix"] button [data-spark-icon],
     [class$="-sender-actions-list"] button [data-spark-icon],
     [class$="-sender-actions-btn"] [data-spark-icon] {
-      font-size: var(--app-icon-sm) !important;
+      font-size: var(--app-icon-default) !important;
     }
 
     [class$="-bubble-footer-actions-item"]:has(svg) {
```

**File**: `console/src/styles/tokens.css` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@
   --app-icon-sm: calc(14px * var(--app-font-scale));
   --app-icon-md: calc(16px * var(--app-font-scale));
   --app-icon-lg: calc(18px * var(--app-font-scale));
+  --app-icon-default: calc(20px * var(--app-font-scale));
   --app-icon-box: max(34px, calc(34px * var(--app-font-scale)));
   --app-icon-button: max(32px, calc(32px * var(--app-font-scale)));
   /* Surfaces */
```

**File**: `console/src/styles/uiFontSizeCoverage.test.ts` (modified, +22/-0)
```diff
@@ -481,11 +481,15 @@ describe("console font-size coverage", () => {
       "--app-icon-sm",
       "--app-icon-md",
       "--app-icon-lg",
+      "--app-icon-default",
       "--app-icon-box",
       "--app-icon-button",
     ]) {
       expect(tokensSource).toContain(`${token}:`);
     }
+    expect(tokensSource).toMatch(
+      /--app-icon-default:\s*calc\(20px \* var\(--app-font-scale\)\)/,
+    );
     expect(tokensSource).toMatch(
       /--app-icon-lg:\s*calc\(18px \* var\(--app-font-scale\)\)/,
     );
@@ -520,6 +524,13 @@ describe("console font-size coverage", () => {
   });
 
   it("scales sender control icons and their hit areas", () => {
+    expect(chatStyles).toMatch(
+      /\[class\$="-sender-prefix"\] button svg,[\s\S]*?width: var\(--app-icon-default\);[\s\S]*?height: var\(--app-icon-default\);/,
+    );
+    expect(chatStyles).toMatch(
+      /\[class\$="-sender-prefix"\] button \[data-spark-icon\],[\s\S]*?font-size: var\(--app-icon-default\) !important;/,
+    );
+
     const approvalTrigger = readRule(approvalStyles, ".trigger");
     expect(approvalTrigger).toContain("var(--app-icon-button)");
     expect(approvalTrigger).toContain("width: var(--app-icon-xs)");
@@ -542,6 +553,17 @@ describe("console font-size coverage", () => {
     );
   });
 
+  it("keeps the project-directory label shrinkable when text is enlarged", () => {
+    const triggerRule = readRule(projectDirectoryStyles, ".trigger");
+
+    expect(triggerRule).toContain("min-width: 0");
+    expect(triggerRule).toContain("flex: 1 1 0");
+    expect(triggerRule).toContain("text-overflow: ellipsis");
+    expect(triggerRule).toContain("white-space: nowrap");
+    expect(triggerRule).toContain("flex: 0 1 auto");
+    expect(triggerRule).toContain("overflow: hidden");
+  });
+
   it("scales collapsed-step text, status icon, arrow, and header height", () => {
     const rule = readRule(hostBubbleStyles, ".collapsedSteps");
 
```

---

### Incident Patch 14: `1fa88fc2` (2026-09-29)
**Commit Message**: fix(provider): include provider and error details in model discovery warnings (#8014)

**File**: `src/qwenpaw/providers/provider_manager_discovery.py` (modified, +5/-1)
```diff
@@ -391,7 +391,11 @@ async def discover_provider_models(
             error = Provider.sanitize_connection_message(
                 str(exc) or exc.__class__.__name__,
             )
-            logger.warning("Model discovery failed; using static fallback")
+            logger.warning(
+                f"Model discovery failed for "
+                f"{sanitize_log_value(provider_id)}; using static fallback: "
+                f"{sanitize_log_value(error)}",
+            )
             if save:
                 committed = await self._save_discovery_locked(
                     provider_id,
```

**File**: `tests/unit/providers/test_provider_manager.py` (modified, +12/-3)
```diff
@@ -2057,7 +2057,8 @@ async def fetch_models(_self, timeout=5):
     assert {model.id for model in result.models} >= {"cached-remote"}
     assert "user-only" not in {model.id for model in result.models}
     assert caplog.records[-1].getMessage() == (
-        "Model discovery failed; using static fallback"
+        f"Model discovery failed for openai; using static fallback: "
+        f"model discovery timed out"
     )
 
 
@@ -3512,12 +3513,13 @@ async def fetch_models(_self, timeout=5):
 async def test_discovery_error_redacts_credentials_before_persisting(
     isolated_secret_dir,
     monkeypatch,
+    caplog,
 ) -> None:
     manager = ProviderManager()
 
     async def fetch_models(_self, timeout=5):
         _ = timeout
-        raise RuntimeError("api_key=discovery-secret")
+        raise RuntimeError(f"api_key=discovery-secret\nforged log")
 
     monkeypatch.setattr(OpenAIProvider, "fetch_models", fetch_models)
 
@@ -3526,9 +3528,16 @@ async def fetch_models(_self, timeout=5):
 
     assert result.success is False
     assert "discovery-secret" not in result.error
-    assert result.error == "api_key=[redacted]"
+    assert result.error == f"api_key=[redacted]\nforged log"
     assert provider is not None
     assert provider.models_last_sync_error == result.error
+    log_message = caplog.records[-1].getMessage()
+    assert log_message.startswith(
+        f"Model discovery failed for openai; using static fallback: ",
+    )
+    assert f"api_key=" in log_message
+    assert f"discovery-secret" not in log_message
+    assert f"\n" not in log_message
 
 
 def test_connection_message_sanitizer_redacts_credentials() -> None:
```

---

### Incident Patch 15: `a5322bdf` (2026-09-29)
**Commit Message**: fix(console): stabilize modal and tool config transitions (#8016)

**File**: `console/src/components/interaction/SharedModal.test.tsx` (modified, +2/-0)
```diff
@@ -32,10 +32,12 @@ describe("SharedModal", () => {
     // The backdrop fades with the surface, not after its exit completes.
     expect(document.querySelector(".ant-modal-mask")).toHaveStyle({
       opacity: "0",
+      transition: "opacity 120ms ease-out",
     });
     fireEvent.click(trigger);
     expect(document.querySelector(".ant-modal-mask")).toHaveStyle({
       opacity: "1",
+      transition: "none",
     });
     fireEvent.click(screen.getByRole("button", { name: "Close" }));
     await waitFor(() =>
```

**File**: `console/src/components/interaction/SharedModal.tsx` (modified, +3/-3)
```diff
@@ -25,13 +25,13 @@ export function SharedModal({
       className={`${styles.modal} ${className ?? ""}`}
       open={!!open || visible}
       transitionName=""
-      maskTransitionName={open ? undefined : ""}
+      maskTransitionName=""
       styles={{
         ...modalStyles,
         mask: {
           ...modalStyles?.mask,
           opacity: open ? 1 : 0,
-          transition: reduced ? "none" : "opacity 120ms ease-out",
+          transition: reduced || open ? "none" : "opacity 120ms ease-out",
         },
       }}
       modalRender={(node) => (
@@ -44,7 +44,7 @@ export function SharedModal({
             <motion.div
               key="detail"
               layoutId={reduced ? undefined : surfaceId}
-              initial={{ opacity: 0, scale: surfaceId || reduced ? 1 : 0.98 }}
+              initial={false}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0 }}
               transition={{
```

**File**: `console/src/pages/Agent/Tools/WebSearchConfigModal.tsx` (modified, +0/-3)
```diff
@@ -23,10 +23,8 @@ export function WebSearchConfigModal({
   visible,
   onClose,
   onSave,
-  surfaceId,
 }: {
   tool: ToolInfo;
-  surfaceId?: string;
   visible: boolean;
   onClose: () => void;
   onSave: (values: Record<string, unknown>) => Promise<void>;
@@ -106,7 +104,6 @@ export function WebSearchConfigModal({
   return (
     <Modal
       closeIcon={<X size={18} aria-hidden />}
-      surfaceId={surfaceId}
       title={`${t("tools.configure")} · ${t(
         `tools.catalog.${tool.name}.name`,
         tool.name,
```

**File**: `console/src/pages/Agent/Tools/index.module.less` (modified, +1/-1)
```diff
@@ -299,6 +299,6 @@
   background: var(--app-fill-strong);
 }
 
-.rowActions > div > .toggleButton {
+.rowActions > .toggleButton {
   border-radius: 20px;
 }
```

**File**: `console/src/pages/Agent/Tools/index.tsx` (modified, +15/-40)
```diff
@@ -2,7 +2,7 @@ import { useAgentStore } from "@/stores/agentStore";
 import { useAutoSave } from "@/hooks/useAutoSave";
 import { SharedModal as Modal } from "@/components/interaction/SharedModal";
 import { CircleHelp, TriangleAlert, Search, Wrench, X } from "lucide-react";
-import { useEffect, useId, useMemo, useRef, useState } from "react";
+import { useEffect, useMemo, useRef, useState } from "react";
 import { Spin, Popover, Segmented } from "antd";
 import {
   Switch,
@@ -25,7 +25,6 @@ import type { ToolInfo } from "../../../api/modules/tools";
 import { PageHeader } from "@/components/PageHeader";
 import { WebSearchConfigModal } from "./WebSearchConfigModal";
 import styles from "./index.module.less";
-import { motion, useReducedMotion } from "motion/react";
 import { InteractiveCard } from "@/components/interaction/InteractiveCard";
 import { Cascade } from "@/components/interaction/Cascade";
 import { TOOL_GROUPS, TOOL_PRESENTATION, toolGroup } from "./toolPresentation";
@@ -103,10 +102,8 @@ function ToolConfigModal({
   visible,
   onClose,
   onSave,
-  surfaceId,
 }: {
   tool: ToolInfo;
-  surfaceId?: string;
   visible: boolean;
   onClose: () => void;
   onSave: (values: Record<string, unknown>) => Promise<void>;
@@ -152,7 +149,6 @@ function ToolConfigModal({
   return (
     <Modal
       closeIcon={<X size={18} aria-hidden />}
-      surfaceId={surfaceId}
       title={`${t("tools.configure")} · ${
         tool.source_plugin_id
           ? tool.name
@@ -245,9 +241,7 @@ function ToolConfigModal({
 
 export default function ToolsPage() {
   const { t } = useTranslation();
-  const instanceId = useId();
   const { selectedAgent } = useAgentStore();
-  const reducedMotion = useReducedMotion();
   const entered = useRef(false);
   const {
     tools,
@@ -523,39 +517,22 @@ export default function ToolsPage() {
                                   )}
                                 <div className={styles.rowActions}>
                                   {canConfigure && (
-                                    <motion.div
-                                      layoutId={
-                                        reducedMotion
-                                          ? undefined
-                                          : `${instanceId}-${tool.name}-config`
+                                    <Button
+                                      data-press
+                                      className={styles.toggleButton}
+                                      aria-label={`${t(
+                                        "tools.configure",
+                                      )} ${toolLabel(tool)}`}
+                                      onClick={() => handleConfigure(tool)}
+                                      icon={
+                                        <SettingOutlined
+                                          size={16}
+                                          aria-hidden
+                                        />
                                       }
-                                      style={{
-                                        borderRadius: 20,
-                                        background: "var(--app-surface)",
-                                      }}
-                                      transition={{
-                                        type: "spring",
-                                        stiffness: 360,
-                                        damping: 38,
-                                      }}
                                     >
-                                      <Button
-                                        data-press
-                                        className={styles.toggleButton}
-                                        aria-label={`${t(
-                                          "tools.configure",
-                                        )} ${toolLabel(tool)}`}
-                                        onClick={() => handleConfigure(tool)}
-                                        icon={
-                                          <SettingOutlined
-                                            size={16}
-                                            aria-hidden
-                                          />
-                                        }
-                                      >
-                                        {t("tools.configure")}
-                                      </Button>
-                                    </motion.div>
+                                      {t("tools.configure")}
+                                    </Button>
                                   )}
                                 </div>
                               </div>
@@ -608,7 +585,6 @@ export default function ToolsPage() {
       {currentTool && WEBSEARCH_TOOL_NAMES.has(currentTool.name) ? (
         <WebSearchConfigModal
           key={`${configAgentId}:${currentTool.name}`}
-          surfaceId={`${instanceId}-${currentTool.nam
```

#### Recent Merged Pull Requests:
- **PR #8113** (closed): feat(channels): pilot backward-compatible DingTalk plugin (@lalaliat)
- **PR #8110** (closed): fix(console): let the settings mobile navigation dropdown exceed the trigger width (@Tlrenhb)
- **PR #8069** (closed): fix(agents): restrict deepseek formatters to image media (@wxhking)
- **PR #8068** (closed): fix(console): repair CJK emphasis boundaries in chat Markdown (@BeiMu-new)
- **PR #8056** (closed): fix(config): surface config write failures with a clear message (@BeiMu-new)
- **PR #8049** (closed): fix(chats): resolve the process timezone per timestamp so naive Msg timestamps keep their instant across DST (@passionworkeer)
- **PR #8045** (closed): test again (@cuiyuebing)
- **PR #8044** (closed): test (@cuiyuebing)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
