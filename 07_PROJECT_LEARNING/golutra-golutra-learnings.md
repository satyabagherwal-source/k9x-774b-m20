# Forensic Learning Record (Deep Inspection): golutra/golutra

> **Canonical Artifact**: `07_PROJECT_LEARNING/golutra-golutra-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/golutra/golutra](https://github.com/golutra/golutra))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:09:31.440Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `golutra/golutra`
- **Description**: Multi-agent AI orchestration platform for automation, workflows, and developer tools. Golutra transforms Codex, Claude Code, and OpenClaw into a unified agent system with parallel execution, task orchestration, long-running workflows, and AI productivity workspace.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3849 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src-tauri/src/runtime/state.rs`
```
use std::collections::HashMap;
use std::sync::Mutex;

/// 运行时全局状态：集中管理跨层共享实例。
pub(crate) struct AppState {
  pub(crate) workspace_registry_lock: Mutex<()>,
  pub(crate) workspace_windows: Mutex<HashMap<String, String>>,
  pub(crate) active_main_window: Mutex<Option<String>>,
}

impl Default for AppState {
  fn default() -> Self {
    Self {
      workspace_registry_lock: Mutex::new(()),
      workspace_windows: Mutex::new(HashMap::new()),
      active_main_window: Mutex::new(None),
    }
  }
}

```

### Core Architecture Module: `src-tauri/src/terminal_engine/default_members/ai_shared.rs`
```
//! AI 成员共享配置。

use super::onboarding::PROMPT_TYPE_ONBOARDING;
use super::registry::TerminalPostReadyStep;

pub(crate) const AI_ONBOARDING_STEP: TerminalPostReadyStep = TerminalPostReadyStep::Introduction {
    prompt_type: PROMPT_TYPE_ONBOARDING,
    require_stable: true,
};

pub(crate) const ENTER_STEP: TerminalPostReadyStep = TerminalPostReadyStep::Input {
    input: "\r",
    require_stable: true,
};

```

### Core Architecture Module: `src-tauri/src/terminal_engine/default_members/claude.rs`
```
//! Claude 默认成员配置。

use super::registry::{TerminalDefaultMemberConfig, TerminalPostReadyPlan};

pub(crate) const CLAUDE_DEFAULT_MEMBER: TerminalDefaultMemberConfig = TerminalDefaultMemberConfig {
    id: "claude-code",
    terminal_type: "claude",
    default_command: "claude",
    unlimited_access_flag: Some("--dangerously-skip-permissions"),
    resume_command_template: None,
    post_ready_plan: TerminalPostReadyPlan {
        post_ready_steps: &[
            super::ai_shared::AI_ONBOARDING_STEP,
        ],
    },
};

```

### Core Architecture Module: `src-tauri/src/terminal_engine/default_members/codex.rs`
```
//! Codex 默认成员配置。

use super::registry::{TerminalDefaultMemberConfig, TerminalPostReadyPlan, TerminalPostReadyStep};

pub(crate) const CODEX_DEFAULT_MEMBER: TerminalDefaultMemberConfig = TerminalDefaultMemberConfig {
    id: "codex",
    terminal_type: "codex",
    default_command: "codex",
    unlimited_access_flag: Some("--dangerously-bypass-approvals-and-sandbox"),
    resume_command_template: Some("resume {session_id}"),
    post_ready_plan: TerminalPostReadyPlan {
        post_ready_steps: &[
            TerminalPostReadyStep::Input {
                input: "/status",
                require_stable: true,
            },
            super::ai_shared::ENTER_STEP,
            // 检测 "model" 特征判断 Codex 已完全加载
            TerminalPostReadyStep::WaitForPattern {
                pattern: "model",
                require_stable: false,
            },
            TerminalPostReadyStep::ExtractSessionId {
                keyword: "session:",
                require_stable: true,
            },
            super::ai_shared::AI_ONBOARDING_STEP,
            super::ai_shared::ENTER_STEP,
        ],
    },
};

```

### Core Architecture Module: `src-tauri/src/terminal_engine/default_members/gemini.rs`
```
//! Gemini 默认成员配置。

use super::registry::{TerminalDefaultMemberConfig, TerminalPostReadyPlan};

pub(crate) const GEMINI_DEFAULT_MEMBER: TerminalDefaultMemberConfig = TerminalDefaultMemberConfig {
    id: "gemini-cli",
    terminal_type: "gemini",
    default_command: "gemini",
    unlimited_access_flag: Some("--yolo"),
    resume_command_template: None,
    post_ready_plan: TerminalPostReadyPlan {
        post_ready_steps: &[
            super::ai_shared::AI_ONBOARDING_STEP,
        ],
    },
};

```

### Core Architecture Module: `src-tauri/src/terminal_engine/default_members/mod.rs`
```
//! 终端默认成员配置与能力注册入口。

pub(crate) mod ai_shared;
pub(crate) mod claude;
pub(crate) mod codex;
pub(crate) mod gemini;
pub(crate) mod onboarding;
pub(crate) mod opencode;
pub(crate) mod qwen;
pub(crate) mod registry;
pub(crate) mod shell;

pub(crate) use registry::{
    apply_resume_command, apply_unlimited_access_command, resolve_default_command_for_invite,
    resolve_default_member,
};

```

### Core Architecture Module: `src-tauri/src/terminal_engine/default_members/onboarding.rs`
```
//! 终端引导逻辑：生成基于语言与场景的初始提示词。

pub(crate) const PROMPT_TYPE_ONBOARDING: &str = "onboarding";

#[derive(Clone, Copy, Debug)]
pub(crate) enum PromptType {
    Onboarding,
}

pub(crate) fn generate_prompt(
    prompt_type: PromptType,
    terminal_id: &str,
    language: Option<&str>,
) -> String {
    let language = language.unwrap_or("zh");
    let is_english = language.to_lowercase().starts_with("en");

    match prompt_type {
        PromptType::Onboarding => {
            if is_english {
                format!(
                    "{}, this is your name. You are working with the team to solve problems.",
                    terminal_id
                )
            } else {
                format!("{}，这是你的名字，现在正在和团队解决问题", terminal_id)
            }
        }
    }
}

```

### Core Architecture Module: `src-tauri/src/terminal_engine/default_members/opencode.rs`
```
//! OpenCode 默认成员配置。

use super::registry::{TerminalDefaultMemberConfig, TerminalPostReadyPlan};

pub(crate) const OPENCODE_DEFAULT_MEMBER: TerminalDefaultMemberConfig =
    TerminalDefaultMemberConfig {
        id: "opencode",
        terminal_type: "opencode",
        default_command: "opencode",
        unlimited_access_flag: None,
        resume_command_template: None,
        post_ready_plan: TerminalPostReadyPlan {
            post_ready_steps: &[
                super::ai_shared::AI_ONBOARDING_STEP,
            ],
        },
    };

```

### Core Architecture Module: `src-tauri/src/terminal_engine/default_members/qwen.rs`
```
//! Qwen Code 默认成员配置。

use super::registry::{TerminalDefaultMemberConfig, TerminalPostReadyPlan};

pub(crate) const QWEN_DEFAULT_MEMBER: TerminalDefaultMemberConfig = TerminalDefaultMemberConfig {
    id: "qwen-code",
    terminal_type: "qwen",
    default_command: "qwen",
    unlimited_access_flag: Some("--yolo"),
    resume_command_template: None,
    post_ready_plan: TerminalPostReadyPlan {
        post_ready_steps: &[
            super::ai_shared::AI_ONBOARDING_STEP,
        ],
    },
};

```

### Core Architecture Module: `src-tauri/src/terminal_engine/default_members/registry.rs`
```
//! 终端默认成员注册与命令处理。

#[derive(Clone, Copy, Debug)]
pub(crate) enum TerminalPostReadyStep {
    Input {
        input: &'static str,
        require_stable: bool,
    },
    ExtractSessionId {
        keyword: &'static str,
        require_stable: bool,
    },
    /// 等待快照中出现指定特征字符串。
    WaitForPattern {
        pattern: &'static str,
        require_stable: bool,
    },
    /// 插入基于场景的动态引导提示词。
    Introduction {
        prompt_type: &'static str,
        require_stable: bool,
    },
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct TerminalPostReadyPlan {
    pub(crate) post_ready_steps: &'static [TerminalPostReadyStep],
}

impl TerminalPostReadyPlan {
    pub(crate) const EMPTY: TerminalPostReadyPlan = TerminalPostReadyPlan {
        post_ready_steps: &[],
    };
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct TerminalDefaultMemberConfig {
    pub(crate) id: &'static str,
    pub(crate) terminal_type: &'static str,
    pub(crate) default_command: &'static str,
    pub(crate) unlimited_access_flag: Option<&'static str>,
    /// 会话恢复命令模板，{session_id} 将被替换为实际 ID。
    pub(crate) resume_command_template: Option<&'static str>,
    pub(crate) post_ready_plan: TerminalPostReadyPlan,
}

use super::{
    claude::CLAUDE_DEFAULT_MEMBER, codex::CODEX_DEFAULT_MEMBER, gemini::GEMINI_DEFAULT_MEMBER,
    opencode::OPENCODE_DEFAULT_MEMBER, qwen::QWEN_DEFAULT_MEMBER, shell::SHELL_DEFAULT_MEMBER,
};

pub(crate) const DEFAULT_TERMINAL_MEMBERS: [TerminalDefaultMemberConfig; 6] = [
    GEMINI_DEFAULT_MEMBER,
    CODEX_DEFAULT_MEMBER,
    CLAUDE_DEFAULT_MEMBER,
    OPENCODE_DEFAULT_MEMBER,
    QWEN_DEFAULT_MEMBER,
    SHELL_DEFAULT_MEMBER,
];

pub(crate) fn resolve_default_member(
    terminal_type: &str,
) -> Option<&'static TerminalDefaultMemberConfig> {
    let normalized = terminal_type.trim().to_lowercase();
    DEFAULT_TERMINAL_MEMBERS
        .iter()
        .find(|member| member.terminal_type == normalized)
}

fn command_contains_flag(command: &str, flag: &str) -> bool {
    command.split_whitespace().any(|part| part == flag)
}

fn normalize_command(value: Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
}

fn should_apply_unlimited_flag(command: Option<&str>, default_command: &str) -> bool {
    if default_command.trim().is_empty() {
        return false;
    }
    match command {
        None => true,
        Some(value) => value.trim() == default_command,
    }
}

pub(crate) fn apply_unlimited_access_command(
    terminal_type: &str,
    command: Option<String>,
    unlimited_access: bool,
) -> Option<String> {
    let command = normalize_command(command);
    if !unlimited_access {
        return command;
    }
    let member = match resolve_default_member(terminal_type) {
        Some(member) => member,
        None => return command,
    };
    let flag = match member.unlimited_access_flag {
        Some(flag) => flag,
        None => return command,
    };
    if !should_apply_unlimited_flag(command.as_deref(), member.default_command) {
        return command;
    }
    let base = command.unwrap_or_else(|| member.default_command.to_string());
    if command_contains_flag(&base, flag) {
        return Some(base);
    }
    let mut next = base;
    if !next.is_empty() {
        next.push(' ');
    }
    next.push_str(flag);
    Some(next)
}

pub(crate) fn resolve_default_command_for_invite(
    terminal_type: &str,
    default_command: Option<String>,
    unlimited_access: bool,
) -> Option<String> {
    let base = normalize_command(default_command)
        .or_else(|| {
            resolve_default_member(terminal_type).map(|member| member.default_command.to_string())
        })
        .filter(|value| !value.trim().is_empty());
    apply_unlimited_access_command(terminal_type, base, unlimited_access)
}

/// 根据 session_id 构建恢复命令。
/// 如果 session_id 存在且配置了 resume_command_template，则返回组装后的命令；
/// 格式：{default_command} {resume_template} {unlimited_access_flag}
/// 否则返回原始命令。
pub(crate) fn apply_resume_command(
    terminal_type: &str,
    command: Option<String>,
    session_id: Option<&str>,
) -> Option<String> {
    let session_id = match session_id {
        Some(id) if !id.trim().is_empty() => id.trim(),
        _ => return command,
    };
    let member = match resolve_default_member(terminal_type) {
        Some(member) => member,
        None => return command,
    };
    let template = match member.resume_command_template {
        Some(template) => template,
        None => return command,
    };
    // 替换 {session_id} 占位符
    let resume_args = template.replace("{session_id}", session_id);
    let mut base = command
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
        .unwrap_or_else(|| member.default_command.to_string());
    if base
        .split_whitespace()
        .any(|part| part.eq_ignore_ascii_case("resume"))
        || base.contains(session_id)
    {
        return Some(base);
    }
    if !base.ends_with(' ') {
        base.push(' ');
    }
    base.push_str(resume_args.as_str());
    Some(base)
}

```

### Core Architecture Module: `src-tauri/src/terminal_engine/default_members/shell.rs`
```
//! Shell 默认成员配置。

use super::registry::{TerminalDefaultMemberConfig, TerminalPostReadyPlan};

pub(crate) const SHELL_DEFAULT_MEMBER: TerminalDefaultMemberConfig = TerminalDefaultMemberConfig {
    id: "terminal",
    terminal_type: "shell",
    default_command: "",
    unlimited_access_flag: None,
    resume_command_template: None,
    post_ready_plan: TerminalPostReadyPlan::EMPTY,
};

```

### Core Architecture Module: `src-tauri/src/terminal_engine/emulator.rs`
```
//! 终端仿真与快照序列化：基于 wezterm_term 生成可回放的 ANSI 视图。
//! 边界：只负责渲染语义与快照，不触碰 PTY 读写与会话状态。

use std::io;
use std::sync::Arc;

use wezterm_term::color::{ColorAttribute, ColorPalette};
use wezterm_term::{
  Blink, CellAttributes, Intensity, Terminal, TerminalConfiguration, TerminalSize, Underline,
};

#[derive(Clone, Copy, Debug)]
/// 终端仿真配置。
/// 约束：`scrollback_limit` 直接影响内存占用与快照大小。
pub(crate) struct EmulatorConfig {
  pub(crate) rows: u16,
  pub(crate) cols: u16,
  pub(crate) scrollback_limit: usize,
}

#[derive(Clone, Debug)]
pub(crate) struct SnapshotSegments {
  pub(crate) history: Option<Vec<u8>>,
  pub(crate) data: Vec<u8>,
  pub(crate) metrics: SnapshotMetrics,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct SnapshotMetrics {
  pub(crate) scrollback_rows: usize,
  pub(crate) visible_rows: usize,
  pub(crate) history_rows: usize,
  pub(crate) data_last_content_row: Option<usize>,
}

impl SnapshotMetrics {
  pub(crate) fn empty() -> Self {
    Self {
      scrollback_rows: 0,
      visible_rows: 0,
      history_rows: 0,
      data_last_content_row: None,
    }
  }
}

/// 终端仿真接口，供会话与语义分析共享。
/// 约束：`cursor_position` 为 0 基坐标；`snapshot_ansi` 返回可直接回放的 ANSI。
pub(crate) trait TerminalEmulator: Send {
  fn apply_output(&mut self, bytes: &[u8]);
  fn set_size(&mut self, rows: u16, cols: u16);
  fn cursor_position(&self) -> (u16, u16);
  fn snapshot_lines(&self) -> Vec<String>;
  fn snapshot_ansi(&self) -> Vec<u8>;
  fn snapshot_ansi_segments(&self) -> SnapshotSegments {
    SnapshotSegments {
      history: None,
      data: self.snapshot_ansi(),
      metrics: SnapshotMetrics::empty(),
    }
  }
}

#[derive(Debug)]
struct WeztermConfig {
  scrollback_limit: usize,
}

impl TerminalConfiguration for WeztermConfig {
  fn scrollback_size(&self) -> usize {
    self.scrollback_limit
  }

  fn color_palette(&self) -> ColorPalette {
    ColorPalette::default()
  }
}

/// WezTerm 终端仿真器封装：负责驱动屏幕缓冲与快照生成。
pub(crate) struct WeztermEmulator {
  terminal: Terminal,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
// 用于最小化 SGR 变更的状态缓存，避免重复输出导致快照膨胀。
struct AttrState {
  intensity: Intensity,
  underline: Underline,
  blink: Blink,
  italic: bool,
  reverse: bool,
  strikethrough: bool,
  invisible: bool,
  overline: bool,
  fg: ColorAttribute,
  bg: ColorAttribute,
}

impl Default for AttrState {
  fn default() -> Self {
    Self {
      intensity: Intensity::Normal,
      underline: Underline::None,
      blink: Blink::None,
      italic: false,
      reverse: false,
      strikethrough: false,
      invisible: false,
      overline: false,
      fg: ColorAttribute::Default,
      bg: ColorAttribute::Default,
    }
  }
}

impl AttrState {
  fn from_attrs(attrs: &CellAttributes) -> Self {
    Self {
      intensity: attrs.intensity(),
      underline: attrs.underline(),
      blink: attrs.blink(),
      italic: attrs.italic(),
      reverse: attrs.reverse(),
      strikethrough: attrs.strikethrough(),
      invisible: attrs.invisible(),
      overline: attrs.overline(),
      fg: attrs.foreground(),
      bg: attrs.background(),
    }
  }
}

/// 创建默认模拟器实例。
/// 返回：实现 `TerminalEmulator` 的对象。
pub(crate) fn create_emulator(config: EmulatorConfig) -> Box<dyn TerminalEmulator> {
  create_emulator_with_writer(config, None)
}

/// 创建可选带响应写入器的模拟器。
/// 用途：在需要捕获终端查询响应时接收回写字节。
pub(crate) fn create_emulator_with_writer(
  config: EmulatorConfig,
  writer: Option<Box<dyn io::Write + Send>>,
) -> Box<dyn TerminalEmulator> {
  Box::new(WeztermEmulator::new(config, writer))
}

impl WeztermEmulator {
  /// 构建基于 wezterm_term 的模拟器。
  /// 约束：writer 为空时使用 sink，避免无谓的 IO 开销。
  pub(crate) fn new(config: EmulatorConfig, writer: Option<Box<dyn io::Write + Send>>) -> Self {
    let size = TerminalSize {
      rows: config.rows as usize,
      cols: config.cols as usize,
      pixel_width: 0,
      pixel_height: 0,
      dpi: 0,
    };
    let config = Arc::new(WeztermConfig {
      scrollback_limit: config.scrollback_limit,
    });
    let writer = writer.unwrap_or_else(|| Box::new(io::sink()));
    // 终端标识仅用于内部仿真，不依赖外部 TERM 环境。
    let terminal = Terminal::new(size, config, "golutra", "1.0", writer);
    Self { terminal }
  }
}

impl TerminalEmulator for WeztermEmulator {
  fn apply_output(&mut self, bytes: &[u8]) {
    self.terminal.advance_bytes(bytes);
  }

  fn set_size(&mut self, rows: u16, cols: u16) {
    let size = TerminalSize {
      rows: rows as usize,
      cols: cols as usize,
      pixel_width: 0,
      pixel_height: 0,
      dpi: 0,
    };
    self.terminal.resize(size);
  }

  fn cursor_position(&self) -> (u16, u16) {
    let pos = self.terminal.cursor_pos();
    let row = if pos.y <= 0 {
      0
    } else {
      (pos.y as u64).min(u16::MAX as u64) as u16
    };
    let col = (pos.x).min(u16::MAX as usize) as u16;
    (row, col)
  }

  fn snapshot_lines(&self) -> Vec<String> {
    let screen = self.terminal.screen();
    let visible_rows = screen.physical_rows.max(1);
    let start = screen.phys_row(0);
    let end = start.saturating_add(visible_rows);
    let mut lines: Vec<String> = screen
      .lines_in_phys_range(start..end)
      .into_iter()
      .map(|line| line.as_str().trim_end().to_string())
      .collect();
    while lines.len() < visible_rows {
      lines.push(String::new());
    }
    lines
  }

  fn snapshot_ansi(&self) -> Vec<u8> {
    let pos = self.terminal.cursor_pos();
    let cursor_row = if pos.y <= 0 {
      0
    } else {
      (pos.y as u64).min(u16::MAX as u64) as u16
    };
    let cursor_col = (pos.x as u64).min(u16::MAX as u64) as u16;
    serialize_screen_to_ansi(self.terminal.screen(), cursor_row, cursor_col)
  }

  fn snapshot_ansi_segments(&self) -> SnapshotSegments {
    let pos = self.terminal.cursor_pos();
    let cursor_row = if pos.y <= 0 {
      0
    } else {
      (pos.y as u64).min(u16::MAX as u64) as u16
    };
    let cursor_col = (pos.x as u64).min(u16::MAX as u64) as u16;
    serialize_screen_to_ansi_segments(self.terminal.screen(), cursor_row, cursor_col)
  }
}

fn emit_sgr(output: &mut String, params: &[String]) {
  if params.is_empty() {
    return;
  }
  output.push_str("\x1b[");
  output.push_str(&params.join(";"));
  output.push('m');
}

fn push_color_params(params: &mut Vec<String>, color: ColorAttribute, is_fg: bool) {
  match color {
    ColorAttribute::Default => {
      params.push((if is_fg { 39 } else { 49 }).to_string());
    }
    ColorAttribute::PaletteIndex(idx) => {
      let idx = idx as u16;
      if idx < 8 {
        let base = if is_fg { 30 } else { 40 };
        params.push((base + idx).to_string());
      } else if idx < 16 {
        let base = if is_fg { 90 } else { 100 };
        params.push((base + (idx - 8)).to_string());
      } else {
        let base = if is_fg { 38 } else { 48 };
        params.push(format!("{base};5;{idx}"));
      }
    }
    ColorAttribute::TrueColorWithPaletteFallback(color, _)
    | ColorAttribute::TrueColorWithDefaultFallback(color) => {
      let (r, g, b, _) = color.as_rgba_u8();
      let base = if is_fg { 38 } else { 48 };
      params.push(format!("{base};2;{r};{g};{b}"));
    }
  }
}

fn emit_attr_delta(output: &mut String, current: &mut AttrState, next: AttrState) {
  if *current == next {
    return;
  }
  // 只输出差异属性，降低 ANSI 体积并减少前端重放成本。
  let mut params = Vec::new();
  if current.intensity != next.intensity {
    let code = match next.intensity {
      Intensity::Normal => 22,
      Intensity::Bold => 1,
      Intensity::Half => 2,
    };
    params.push(code.to_string());
  }
  if current.italic != next.italic {
    params.push(if next.italic { "3" } else { "23" }.to_string());
  }
  if current.underline != next.underline {
    let code = match next.underline {
      Underline::None => "24".to_string(),
      Underline::Single => "4".to_string(),
      Underline::Double => "4:2".to_string(),
      Underline::Curly => "4:3".to_string(),
      Underline::Dotted => "4:4".to_string(),
      Underline::Dashed => "4:5".to_string(),
    };
    params.push(code);
  }
  if current.blink != next.blink {
    let code = match next.blink {
      Blink::None => 25,
      Blink::Slow => 5,
      Blink::Rapid => 6,
    };
    params.push(code.to_string());
  }
  if current.reverse != next.reverse {
    params.push(if next.reverse { "7" } else { "27" }.to_string());
  }
  if current.strikethrough != next.strikethrough {
    params.push(if next.strikethrough { "9" } else { "29" }.to_string());
  }
  if current.invisible != next.invisible {
    params.push(if next.invisible { "8" } else { "28" }.to_string());
  }
  if current.overline != next.overline {
    params.push(if next.overline { "53" } else { "55" }.to_string());
  }
  if current.fg != next.fg {
    push_color_params(&mut params, next.fg, true);
  }
  if current.bg != next.bg {
    push_color_params(&mut params, next.bg, false);
  }
  emit_sgr(output, &params);
  *current = next;
}

fn serialize_line_to_ansi(
  line: &wezterm_term::Line,
  output: &mut String,
  state: &mut AttrState,
  blank_attrs: &CellAttributes,
) {
  let cells: Vec<_> = line.visible_cells().collect();
  // 去掉行尾空白，避免快照在大空行上膨胀。
  let mut last_col = 0usize;
  for cell in &cells {
    let is_blank = cell.str() == " " && cell.attrs() == blank_attrs;
    if !is_blank {
      last_col = cell.cell_index() + cell.width();
    }
  }
  let mut col = 0usize;
  for cell in cells {
    if cell.cell_index() >= last_col {
      break;
    }
    let target = cell.cell_index();
    if target > col {
      let gap_state = AttrState::from_attrs(blank_attrs);
      emit_attr_delta(output, state, gap_state);
      let gap = target.saturating_sub(col);
      for _ in 0..gap {
        output.push(' ');
      }
    }
    let next_state = AttrState::from_attrs(cell.attrs());
    emit_attr_delta(output, state, next_state);
    output.push_str(cell.str());
    col = target.saturating_add(cell.width());
  }
  if *state != AttrState::default() {
    output.push_str("\x1b[0m");
    *state = AttrState::default();
  }
}

fn serialize_lines_to_ansi(
  li
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

### Incident Patch 1: `75e68e29` (2026-03-01)
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

**File**: `src-tauri/Cargo.toml` (modified, +9/-5)
```diff
@@ -1,13 +1,13 @@
 [package]
-name = "app"
+name = "golutra"
 version = "0.1.0"
 description = "A Tauri App"
 authors = ["you"]
 license = ""
 repository = ""
 edition = "2021"
 rust-version = "1.77.2"
-default-run = "app"
+default-run = "golutra"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
@@ -25,14 +25,18 @@ log = "0.4"
 sha2 = "0.10"
 fs2 = "0.4"
 portable-pty = "0.9.0"
-tauri = { version = "2.9.5", features = [] }
+tauri = { version = "2.9.5", features = ["tray-icon", "image-png"] }
+tokio = { version = "1", features = ["time"] }
 tauri-plugin-log = "2"
 tauri-plugin-dialog = "2.6.0"
-strip-ansi-escapes = "0.2"
+tauri-plugin-clipboard-manager = "2"
+tauri-plugin-single-instance = "2"
+tauri-plugin-shell = "2"
 redb = "2"
 bincode = "1.3"
 ulid = "1"
 wezterm-term = { package = "tattoy-wezterm-term", version = "0.1.0-fork.5" }
+interprocess = "1.2"
 
 [target.'cfg(windows)'.dependencies]
-windows-sys = { version = "0.52", features = ["Win32_Foundation", "Win32_Storage_FileSystem", "Win32_System_Console"] }
+windows-sys = { version = "0.52", features = ["Win32_Foundation", "Win32_Graphics_Gdi", "Win32_Storage_FileSystem", "Win32_System_Console"] }
```

**File**: `src-tauri/build.rs` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+//! 构建脚本：触发 Tauri 生成绑定与资源清单，避免运行时缺失。
+//! 边界：不做自定义编译流程，保持构建可缓存且可复现。
+
 fn main() {
+  // 依赖 tauri-build 的约定入口，让配置变更参与编译期生成。
   tauri_build::build()
 }
```

**File**: `src-tauri/capabilities/default.json` (modified, +12/-2)
```diff
@@ -4,17 +4,27 @@
   "description": "enables the default permissions",
   "windows": [
     "main",
+    "main*",
     "terminal*",
-    "workspace-selection*"
+    "workspace-selection*",
+    "notification-preview"
   ],
   "permissions": [
     "core:default",
     "dialog:default",
+    "clipboard-manager:allow-read-text",
+    "clipboard-manager:allow-write-text",
+    "shell:allow-open",
     "core:window:allow-minimize",
     "core:window:allow-maximize",
     "core:window:allow-toggle-maximize",
     "core:window:allow-close",
+    "core:window:allow-destroy",
     "core:window:allow-start-dragging",
-    "core:window:allow-is-maximized"
+    "core:window:allow-start-resize-dragging",
+    "core:window:allow-is-maximized",
+    "core:window:allow-show",
+    "core:window:allow-unminimize",
+    "core:window:allow-set-focus"
   ]
 }
```

---

### Incident Patch 2: `8fe4a9b5` (2026-02-26)
**Commit Message**: feat(terminal,chat,ui): 重构终端内核并同步会话状态，修复聊天历史与界面显示

- 终端层：
  将终端渲染/解析能力由 vt100 重构为 wezterm_term，优化终端交互稳定性与显示效果（含圆角与基础体验优化）。

- 会话状态链路：
  引入 Shell prompt hook（PowerShell/Bash）并打通前后端 active 状态同步；
  新增 terminal_set_active 能力与前端桥接调用，支持前台活跃态上报、卸载态回传与流控策略联动。

- 聊天能力：
  修复聊天历史相关问题，改善聊天与终端之间的联通行为；
  补充并推进 claude code 相关问题排查，减少异常场景下的不一致状态。

- UI 与状态：
  更新状态管理与 UI 显示逻辑，提升页面状态反馈一致性与可读性。

- 工程治理：
  补充 .gitignore 规则，忽略 cargo vendor 与构建产物，减少无关文件进入版本控制。

**File**: `index.html` (modified, +4/-2)
```diff
@@ -56,15 +56,17 @@
       }
 
       .bg-glass-sidebar {
-        background: rgb(var(--color-panel) / 0.7);
+        background: transparent;
+        border-color: transparent;
+        border-right-color: rgb(var(--color-border) / 0.12);
       }
 
       .text-shadow {
         text-shadow: 0 1px 2px rgba(0,0,0,0.5);
       }
     </style>
 </head>
-  <body class="bg-background text-white h-screen overflow-hidden selection:bg-primary/30 selection:text-white">
+  <body class="text-white h-screen overflow-hidden selection:bg-primary/30 selection:text-white">
     <div id="app"></div>
   <script type="module" src="/src/main.ts"></script>
 </body>
```

**File**: `metadata.json` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 {
-  "name": "Nexus Dashboard Suite",
+  "name": "golutra",
   "description": "A high-fidelity suite of dashboard screens featuring a Skill Store, Plugin Marketplace, Settings, Workspace Selection, and advanced Chat Modals with glassmorphism aesthetics.",
   "requestFramePermissions": []
-}
\ No newline at end of file
+}
```

**File**: `package.json` (modified, +2/-0)
```diff
@@ -6,6 +6,8 @@
   "type": "module",
   "scripts": {
     "dev": "vite",
+    "dev:tauri": "pnpm run shim:build && pnpm run dev",
+    "shim:build": "cargo build --manifest-path src-tauri/Cargo.toml --bin shim",
     "build": "vite build",
     "preview": "vite preview",
     "test": "vitest run",
```

**File**: `pnpm-workspace.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+packages:
+  - .
+
+onlyBuiltDependencies:
+  - esbuild
+  - node-pty
```

**File**: `postcss.config.cjs` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+module.exports = {
+  plugins: {
+    tailwindcss: {},
+    autoprefixer: {}
+  }
+};
```

**File**: `src-tauri/Cargo.toml` (modified, +9/-0)
```diff
@@ -7,6 +7,7 @@ license = ""
 repository = ""
 edition = "2021"
 rust-version = "1.77.2"
+default-run = "app"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
@@ -27,3 +28,11 @@ portable-pty = "0.9.0"
 tauri = { version = "2.9.5", features = [] }
 tauri-plugin-log = "2"
 tauri-plugin-dialog = "2.6.0"
+strip-ansi-escapes = "0.2"
+redb = "2"
+bincode = "1.3"
+ulid = "1"
+wezterm-term = { package = "tattoy-wezterm-term", version = "0.1.0-fork.5" }
+
+[target.'cfg(windows)'.dependencies]
+windows-sys = { version = "0.52", features = ["Win32_Foundation", "Win32_Storage_FileSystem", "Win32_System_Console"] }
```

**File**: `src-tauri/capabilities/default.json` (modified, +11/-2)
```diff
@@ -3,9 +3,18 @@
   "identifier": "default",
   "description": "enables the default permissions",
   "windows": [
-    "main"
+    "main",
+    "terminal*",
+    "workspace-selection*"
   ],
   "permissions": [
-    "core:default"
+    "core:default",
+    "dialog:default",
+    "core:window:allow-minimize",
+    "core:window:allow-maximize",
+    "core:window:allow-toggle-maximize",
+    "core:window:allow-close",
+    "core:window:allow-start-dragging",
+    "core:window:allow-is-maximized"
   ]
 }
```

**File**: `src-tauri/src/bin/shim.rs` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+use std::env;
+use std::io::{self, Write};
+use std::process::{Command, Stdio};
+
+const OSC_READY: &str = "\x1b]633;A\x07";
+const OSC_EXIT_PREFIX: &str = "\x1b]633;D;";
+const SHIM_LAUNCH_ERROR_MARKER: &str = "SHIM_LAUNCH_ERROR";
+
+#[cfg(windows)]
+fn force_utf8_console() {
+  use windows_sys::Win32::System::Console::{SetConsoleCP, SetConsoleOutputCP};
+  unsafe {
+    SetConsoleCP(65001);
+    SetConsoleOutputCP(65001);
+  }
+}
+
+#[cfg(not(windows))]
+fn force_utf8_console() {}
+
+fn main() {
+  force_utf8_console();
+  let mut args = env::args();
+  let _shim = args.next();
+  let target = match args.next() {
+    Some(value) => value,
+    None => {
+      eprintln!("{SHIM_LAUNCH_ERROR_MARKER}: no target command");
+      std::process::exit(101);
+    }
+  };
+  let target_args: Vec<String> = args.collect();
+
+  print!("{OSC_READY}");
+  let _ = io::stdout().flush();
+
+  let child = Command::new(&target)
+    .args(&target_args)
+    .stdin(Stdio::inherit())
+    .stdout(Stdio::inherit())
+    .stderr(Stdio::inherit())
+    .spawn();
+
+  match child {
+    Ok(mut child) => {
+      let status = match child.wait() {
+        Ok(status) => status,
+        Err(err) => {
+          eprintln!("{SHIM_LAUNCH_ERROR_MARKER}: wait error='{}'", err);
+          std::process::exit(103);
+        }
+      };
+      let code = status.code().unwrap_or(0);
+      print!("{OSC_EXIT_PREFIX}{code}\x07");
+      let _ = io::stdout().flush();
+      std::process::exit(code);
+    }
+    Err(err) => {
+      eprintln!(
+        "{SHIM_LAUNCH_ERROR_MARKER}: command='{}' error='{}'",
+        target, err
+      );
+      std::process::exit(102);
+    }
+  }
+}
```

---

### Incident Patch 3: `fe289af4` (2026-02-26)
**Commit Message**: feat: i18n/主题、多窗口、Tauri 后端接入与终端联通、UI 重构

- 引入国际化与中英文本体系，统一多语言文案。

- 增加主题系统（dark/light/system）与全局样式能力。

- 大幅升级 Dashboard、聊天区和整体响应式布局，修复多处 UI 显示问题。

- 接入 Tauri Rust 后端基础结构（src-tauri、Cargo 配置、能力声明）。

- 打通终端桥接与用户终端联通链路，完善终端相关前后端交互。

- 增加多窗口能力与窗口管理支持。

**File**: `index.html` (modified, +1/-39)
```diff
@@ -4,7 +4,7 @@
     <meta charset="UTF-8" />
     <link rel="icon" type="image/svg+xml" href="/vite.svg" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
-    <title>Nexus Dashboard</title>
+    <title>golutra</title>
     <script>
       (() => {
         const storageKey = 'nexus-theme';
@@ -19,44 +19,6 @@
         root.classList.toggle('dark', resolvedTheme === 'dark');
       })();
     </script>
-    <!-- Tailwind CSS -->
-    <script src="https://cdn.tailwindcss.com"></script>
-    <!-- Google Fonts -->
-    <link rel="preconnect" href="https://fonts.googleapis.com">
-    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
-    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
-    <!-- Material Symbols -->
-    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
-    
-    <script>
-      tailwind.config = {
-        darkMode: 'class',
-        theme: {
-          extend: {
-            fontFamily: {
-              sans: ['"Be Vietnam Pro"', 'sans-serif'],
-            },
-            colors: {
-              background: 'rgb(var(--color-background) / <alpha-value>)',
-              surface: 'rgb(var(--color-surface) / <alpha-value>)',
-              panel: 'rgb(var(--color-panel) / <alpha-value>)',
-              'panel-strong': 'rgb(var(--color-panel-strong) / <alpha-value>)',
-              'panel-soft': 'rgb(var(--color-panel-soft) / <alpha-value>)',
-              primary: 'rgb(var(--color-primary) / <alpha-value>)',
-              'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
-              secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
-              text: 'rgb(var(--color-text) / <alpha-value>)',
-              muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
-              border: 'rgb(var(--color-border) / <alpha-value>)',
-            },
-            boxShadow: {
-              'glow': '0 0 20px -5px rgb(var(--color-primary) / 0.45)',
-              'glass': '0 8px 32px 0 rgb(0 0 0 / 0.32)',
-            }
-          }
-        }
-      }
-    </script>
     <style>
       /* Custom Scrollbar */
       ::-webkit-scrollbar {
```

**File**: `package.json` (modified, +14/-5)
```diff
@@ -15,23 +15,32 @@
     "format:check": "prettier --check ."
   },
   "dependencies": {
+    "@tauri-apps/api": "^2.0.0",
+    "@tauri-apps/plugin-dialog": "^2.6.0",
+    "@xterm/addon-fit": "^0.11.0",
+    "@xterm/addon-webgl": "^0.19.0",
+    "@xterm/xterm": "^6.0.0",
+    "pinia": "^3.0.4",
     "vue": "^3.5.12",
     "vue-i18n": "^11.2.8"
   },
   "devDependencies": {
-    "@typescript-eslint/eslint-plugin": "^8.53.0",
-    "@typescript-eslint/parser": "^8.53.0",
     "@eslint/js": "^9.39.2",
     "@types/node": "^22.14.0",
+    "@typescript-eslint/eslint-plugin": "^8.53.0",
+    "@typescript-eslint/parser": "^8.53.0",
+    "@vitejs/plugin-vue": "^5.2.4",
+    "autoprefixer": "^10.4.23",
     "eslint": "^9.39.2",
     "eslint-config-prettier": "^10.1.8",
     "eslint-plugin-vue": "^10.7.0",
     "globals": "^17.0.0",
+    "postcss": "^8.5.6",
     "prettier": "^3.3.3",
-    "vue-eslint-parser": "^10.2.0",
-    "@vitejs/plugin-vue": "^5.2.4",
+    "tailwindcss": "^3.4.17",
     "typescript": "~5.8.2",
     "vite": "^6.2.0",
-    "vitest": "^2.1.9"
+    "vitest": "^2.1.9",
+    "vue-eslint-parser": "^10.2.0"
   }
 }
```

**File**: `pnpm-lock.yaml` (modified, +885/-60)
```diff
@@ -8,6 +8,24 @@ importers:
 
   .:
     dependencies:
+      '@tauri-apps/api':
+        specifier: ^2.0.0
+        version: 2.9.1
+      '@tauri-apps/plugin-dialog':
+        specifier: ^2.6.0
+        version: 2.6.0
+      '@xterm/addon-fit':
+        specifier: ^0.11.0
+        version: 0.11.0
+      '@xterm/addon-webgl':
+        specifier: ^0.19.0
+        version: 0.19.0
+      '@xterm/xterm':
+        specifier: ^6.0.0
+        version: 6.0.0
+      pinia:
+        specifier: ^3.0.4
+        version: 3.0.4(typescript@5.8.3)(vue@3.5.26(typescript@5.8.3))
       vue:
         specifier: ^3.5.12
         version: 3.5.26(typescript@5.8.3)
@@ -23,43 +41,56 @@ importers:
         version: 22.19.7
       '@typescript-eslint/eslint-plugin':
         specifier: ^8.53.0
-        version: 8.53.0(@typescript-eslint/parser@8.53.0(eslint@9.39.2)(typescript@5.8.3))(eslint@9.39.2)(typescript@5.8.3)
+        version: 8.53.0(@typescript-eslint/parser@8.53.0(eslint@9.39.2(jiti@2.6.1))(typescript@5.8.3))(eslint@9.39.2(jiti@2.6.1))(typescript@5.8.3)
       '@typescript-eslint/parser':
         specifier: ^8.53.0
-        version: 8.53.0(eslint@9.39.2)(typescript@5.8.3)
+        version: 8.53.0(eslint@9.39.2(jiti@2.6.1))(typescript@5.8.3)
       '@vitejs/plugin-vue':
         specifier: ^5.2.4
-        version: 5.2.4(vite@6.4.1(@types/node@22.19.7))(vue@3.5.26(typescript@5.8.3))
+        version: 5.2.4(vite@6.4.1(@types/node@22.19.7)(jiti@2.6.1)(lightningcss@1.30.2)(yaml@2.8.2))(vue@3.5.26(typescript@5.8.3))
+      autoprefixer:
+        specifier: ^10.4.23
+        version: 10.4.23(postcss@8.5.6)
       eslint:
         specifier: ^9.39.2
-        version: 9.39.2
+        version: 9.39.2(jiti@2.6.1)
       eslint-config-prettier:
         specifier: ^10.1.8
-        version: 10.1.8(eslint@9.39.2)
+        version: 10.1.8(eslint@9.39.2(jiti@2.6.1))
       eslint-plugin-vue:
         specifier: ^10.7.0
-        version: 10.7.0(@typescript-eslint/parser@8.53.0(eslint@9.39.2)(typescript@5.8.3))(eslint@9.39.2)(vue-eslint-parser@10.2.0(eslint@9.39.2))
+        version: 10.7.0(@typescript-eslint/parser@8.53.0(eslint@9.39.2(jiti@2.6.1))(typescript@5.8.3))(eslint@9.39.2(jiti@2.6.1))(vue-eslint-parser@10.2.0(eslint@9.39.2(jiti@2.6.1)))
       globals:
         specifier: ^17.0.0
         version: 17.0.0
+      postcss:
+        specifier: ^8.5.6
+        version: 8.5.6
       prettier:
         specifier: ^3.3.3
         version: 3.8.0
+      tailwindcss:
+        specifier: ^3.4.17
+        version: 3.4.17
       typescript:
         specifier: ~5.8.2
         version: 5.8.3
       vite:
         specifier: ^6.2.0
-        version: 6.4.1(@types/node@22.19.7)
+        version: 6.4.1(@types/node@22.19.7)(jiti@2.6.1)(lightningcss@1.30.2)(yaml@2.8.2)
       vitest:
         specifier: ^2.1.9
-        version: 2.1.9(@types/node@22.19.7)
+        version: 2.1.9(@types/node@22.19.7)(lightningcss@1.30.2)
       vue-eslint-parser:
         specifier: ^10.2.0
-        version: 10.2.0(eslint@9.39.2)
+        version: 10.2.0(eslint@9.39.2(jiti@2.6.1))
 
 packages:
 
+  '@alloc/quick-lru@5.2.0':
+    resolution: {integrity: sha512-UrcABB+4bUrFABwbluTIBErXwvbsU/V7TZWfmbgJfbkwiBuziS9gxdODUyuiecfdGQ85jglMW6juS3+z5TsKLw==}
+    engines: {node: '>=10'}
+
   '@babel/helper-string-parser@7.27.1':
     resolution: {integrity: sha512-qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA==}
     engines: {node: '>=6.9.0'}
@@ -437,9 +468,31 @@ packages:
     resolution: {integrity: sha512-l6e4NZyUgv8VyXXH4DbuucFOBmxLF56C/mqh2tvApbzl2Hrhi1aTDcuv5TKdxzfHYmpO3UB0Cz04fgDT9vszfw==}
     engines: {node: '>= 16'}
 
+  '@jridgewell/gen-mapping@0.3.13':
+    resolution: {integrity: sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==}
+
+  '@jridgewell/resolve-uri@3.1.2':
+    resolution: {integrity: sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==}
+    engines: {node: '>=6.0.0'}
+
   '@jridgewell/sourcemap-codec@1.5.5':
     resolution: {integrity: sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==}
 
+  '@jridgewell/trace-mapping@0.3.31':
+    resolution: {integrity: sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==}
+
+  '@nodelib/fs.scandir@2.1.5':
+    resolution: {integrity: sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==}
+    engines: {node: '>= 8'}
+
+  '@nodelib/fs.stat@2.0.5':
+    resolution: {integrity: sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==}
+    engines: {node: '>= 8'}
+
+  '@nodelib/fs.walk@1.2.8':
+    resolution: {integrity: sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==}
+    engines: {node: '>= 8'}
+
   '@rollup/rollup-android-arm-eabi@4.55.1':
     resolution: {integrity: sha512
```

**File**: `src-tauri/Cargo.toml` (modified, +4/-0)
```diff
@@ -21,5 +21,9 @@ tauri-build = { version = "2.5.3", features = [] }
 serde_json = "1.0"
 serde = { version = "1.0", features = ["derive"] }
 log = "0.4"
+sha2 = "0.10"
+fs2 = "0.4"
+portable-pty = "0.9.0"
 tauri = { version = "2.9.5", features = [] }
 tauri-plugin-log = "2"
+tauri-plugin-dialog = "2.6.0"
```

**File**: `src-tauri/src/lib.rs` (modified, +1703/-0)
```diff
@@ -1,6 +1,1665 @@
+use std::{
+  collections::{HashMap, VecDeque},
+  env,
+  fs,
+  io::{Read, Write},
+  path::{Component, Path, PathBuf},
+  sync::{
+    atomic::{AtomicBool, AtomicUsize, Ordering},
+    Arc, Mutex,
+  },
+  thread,
+  time::{Duration, SystemTime, UNIX_EPOCH},
+};
+
+use fs2::FileExt;
+use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySize};
+use serde::{Deserialize, Serialize};
+use serde_json::json;
+use sha2::{Digest, Sha256};
+use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent};
+
+static SESSION_COUNTER: AtomicUsize = AtomicUsize::new(1);
+static WINDOW_COUNTER: AtomicUsize = AtomicUsize::new(1);
+static WORKSPACE_WINDOW_COUNTER: AtomicUsize = AtomicUsize::new(1);
+static PROJECT_ID_COUNTER: AtomicUsize = AtomicUsize::new(1);
+const TERMINAL_WINDOW_LABEL: &str = "terminal-main";
+const SESSION_BUFFER_LIMIT_BYTES: usize = 1 * 1024 * 1024;
+const TOTAL_BUFFER_LIMIT_BYTES: usize = 500 * 1024 * 1024;
+const WORKING_SILENCE_TIMEOUT_MS: u64 = 2000;
+const STATUS_POLL_INTERVAL_MS: u64 = 500;
+const RECENT_WORKSPACES_FILE: &str = "recent-workspaces.json";
+const WORKSPACE_REGISTRY_FILE: &str = "workspace-registry.json";
+const WORKSPACE_REGISTRY_LOCK_FILE: &str = "workspace-registry.lock";
+const AVATAR_LIBRARY_FILE: &str = "avatar-library.json";
+const AVATAR_DIR: &str = "avatars";
+const MAX_AVATAR_BYTES: usize = 2 * 1024 * 1024;
+const WORKSPACE_REGISTRY_MISMATCH_PREFIX: &str = "workspace_registry_mismatch:";
+const WORKSPACE_REGISTRY_GC_MIN_AGE_MS: u64 = 1000 * 60 * 60 * 24 * 30;
+const WORKSPACE_REGISTRY_GC_MAX_CHECKS: usize = 12;
+
+struct TerminalHandle {
+  master: Box<dyn MasterPty + Send>,
+  writer: Arc<Mutex<Box<dyn Write + Send>>>,
+  killer: Box<dyn ChildKiller + Send + Sync>,
+}
+
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+enum TerminalSessionStatus {
+  Online,
+  Working,
+  Offline,
+}
+
+impl TerminalSessionStatus {
+  fn as_str(&self) -> &'static str {
+    match self {
+      TerminalSessionStatus::Online => "online",
+      TerminalSessionStatus::Working => "working",
+      TerminalSessionStatus::Offline => "offline",
+    }
+  }
+}
+
+struct TerminalSession {
+  id: String,
+  status: TerminalSessionStatus,
+  buffer: VecDeque<u8>,
+  member_id: Option<String>,
+  workspace_id: Option<String>,
+  active: bool,
+  last_activity_at: Option<u64>,
+  handle: Option<TerminalHandle>,
+  keep_alive: bool,
+  owner_window_label: Option<String>,
+}
+
+struct SessionRegistry {
+  sessions: HashMap<String, TerminalSession>,
+  total_bytes: usize,
+}
+
+struct InitialWriteState {
+  session_id: String,
+  payload: String,
+  writer: Arc<Mutex<Box<dyn Write + Send>>>,
+  sessions: Arc<Mutex<SessionRegistry>>,
+  app: AppHandle,
+  sent: AtomicBool,
+}
+
+struct TerminalManager {
+  sessions: Arc<Mutex<SessionRegistry>>,
+}
+
+struct WorkspaceRegistryLock {
+  lock: Mutex<()>,
+}
+
+struct WorkspaceWindowRegistry {
+  workspaces: Mutex<HashMap<String, String>>,
+}
+
+impl Default for TerminalManager {
+  fn default() -> Self {
+    Self {
+      sessions: Arc::new(Mutex::new(SessionRegistry {
+        sessions: HashMap::new(),
+        total_bytes: 0,
+      })),
+    }
+  }
+}
+
+impl Default for WorkspaceRegistryLock {
+  fn default() -> Self {
+    Self { lock: Mutex::new(()) }
+  }
+}
+
+impl Default for WorkspaceWindowRegistry {
+  fn default() -> Self {
+    Self {
+      workspaces: Mutex::new(HashMap::new()),
+    }
+  }
+}
+
+#[derive(Serialize, Clone)]
+struct TerminalOutputPayload {
+  #[serde(rename = "sessionId")]
+  session_id: String,
+  data: String,
+}
+
+#[derive(Serialize, Clone)]
+struct TerminalExitPayload {
+  #[serde(rename = "sessionId")]
+  session_id: String,
+  code: Option<i32>,
+  signal: Option<String>,
+}
+
+#[derive(Serialize, Clone)]
+struct TerminalStatusPayload {
+  #[serde(rename = "sessionId")]
+  session_id: String,
+  status: String,
+  #[serde(rename = "memberId")]
+  member_id: Option<String>,
+  #[serde(rename = "workspaceId")]
+  workspace_id: Option<String>,
+}
+
+#[derive(Serialize, Deserialize, Clone)]
+struct WorkspaceEntry {
+  id: String,
+  name: String,
+  path: String,
+  #[serde(rename = "lastOpenedAt")]
+  last_opened_at: u64,
+}
+
+#[derive(Serialize, Deserialize, Clone)]
+struct WorkspaceOpenResult {
+  entry: WorkspaceEntry,
+  #[serde(rename = "readOnly")]
+  read_only: bool,
+  warning: Option<String>,
+}
+
+#[derive(Serialize, Deserialize, Clone)]
+struct WorkspaceRegistryEntry {
+  #[serde(rename = "lastKnownPath")]
+  last_known_path: String,
+  #[serde(rename = "lastAccessed")]
+  last_accessed: u64,
+}
+
+#[derive(Serialize, Deserialize, Clone)]
+struct LocalWorkspaceState {
+  #[serde(rename = "localMachineId")]
+  local_machine_id: String,
+  #[serde(rename = "lastOpenedAt")]
+  last_opened_at: u64,
+}
+
+#[derive(Deserialize, Copy, Clone)]
+#[serde(rename_all = "snake_case")]
+enum WorkspaceRegistryResolution {
+  Move,
+ 
```

**File**: `src/app/App.vue` (modified, +213/-15)
```diff
@@ -1,31 +1,229 @@
 <template>
-  <div v-if="activeTab === 'workspaces'" class="flex h-screen w-full bg-background app-shell relative overflow-hidden">
-    <WorkspaceSelection @select-workspace="activeTab = 'chat'" />
-  </div>
   <div
-    v-else
-    class="flex h-screen w-full bg-background app-shell font-sans relative overflow-hidden"
+    class="window-frame"
+    :class="{ 'window-frame--max': isMaximized, 'window-frame--inactive': !isFocused }"
   >
-    <SidebarNav :active-tab="activeTab" @change="activeTab = $event" />
-    <main class="flex-1 h-full overflow-hidden relative flex flex-col pb-16 md:pb-0">
-      <SkillStore v-if="activeTab === 'store'" />
-      <PluginMarketplace v-else-if="activeTab === 'plugins'" />
-      <Settings v-else-if="activeTab === 'settings'" @logout="activeTab = 'workspaces'" />
-      <ChatInterface v-else />
-    </main>
+    <header
+      class="titlebar"
+      :class="{ 'titlebar--mac': isMacOS }"
+      data-tauri-drag-region
+      @dblclick="handleToggleMaximize"
+    >
+      <div class="titlebar__left" data-tauri-drag-region>
+        <span class="titlebar__title">{{ windowTitle }}</span>
+      </div>
+      <div v-if="showWindowControls" class="titlebar__controls" data-tauri-drag-region="false" @dblclick.stop>
+        <button
+          type="button"
+          class="titlebar__btn"
+          :aria-label="t('app.windowControls.minimize')"
+          :title="t('app.windowControls.minimize')"
+          data-tauri-drag-region="false"
+          @click="handleMinimize"
+        >
+          <svg viewBox="0 0 10 10" aria-hidden="true">
+            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
+          </svg>
+        </button>
+        <button
+          type="button"
+          class="titlebar__btn"
+          :aria-label="t('app.windowControls.maximize')"
+          :title="t('app.windowControls.maximize')"
+          data-tauri-drag-region="false"
+          @click="handleToggleMaximize"
+        >
+          <svg viewBox="0 0 10 10" aria-hidden="true">
+            <rect x="2" y="2" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.2" rx="0.6" />
+          </svg>
+        </button>
+        <button
+          type="button"
+          class="titlebar__btn titlebar__btn--close"
+          :aria-label="t('app.windowControls.close')"
+          :title="t('app.windowControls.close')"
+          data-tauri-drag-region="false"
+          @click="handleClose"
+        >
+          <svg viewBox="0 0 10 10" aria-hidden="true">
+            <line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
+            <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
+          </svg>
+        </button>
+      </div>
+    </header>
+
+    <div class="window-body">
+      <div v-if="isTerminalView" class="flex h-full w-full bg-background app-shell relative overflow-hidden">
+        <TerminalWorkspace />
+      </div>
+      <div
+        v-else-if="showWorkspaceSelection"
+        class="flex h-full w-full bg-background app-shell relative overflow-y-auto overflow-x-hidden"
+      >
+        <WorkspaceSelection />
+      </div>
+      <div
+        v-else-if="!appReady"
+        class="flex h-full w-full bg-background app-shell relative overflow-hidden items-center justify-center"
+      >
+        <div class="flex flex-col items-center gap-3 text-white/70 text-sm">
+          <div class="h-10 w-10 rounded-full border border-white/20 border-t-transparent animate-spin"></div>
+          <span>Loading workspace...</span>
+        </div>
+      </div>
+      <div
+        v-else
+        class="flex h-full w-full bg-background app-shell font-sans relative overflow-hidden"
+      >
+        <SidebarNav :active-tab="activeTab" @change="setActiveTab($event)" />
+        <main class="flex-1 h-full overflow-hidden relative flex flex-col pb-16 md:pb-0">
+          <SkillStore v-if="activeTab === 'store'" />
+          <PluginMarketplace v-else-if="activeTab === 'plugins'" />
+          <Settings
+            v-else-if="activeTab === 'settings'"
+            @logout="setActiveTab('workspaces')"
+          />
+          <ChatInterface v-else />
+        </main>
+      </div>
+    </div>
+    <ToastStack />
   </div>
 </template>
 
 <script setup lang="ts">
-import { ref } from 'vue';
+import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
+import { useI18n } from 'vue-i18n';
+import { storeToRefs } from 'pinia';
 import SidebarNav from '@/shared/components/SidebarNav.vue';
+import ToastStack from '@/shared/components/ToastStack.vue';
 import SkillStore from '@/features/SkillStore.vue';
 import PluginMarketplace from '@/features/PluginMarketplace.vue';
+import TerminalWorkspace from '@/features/terminal/TerminalWorkspace.vue';
 import Settings from '@/features/Settings.vue';
 import WorkspaceSelec
```

**File**: `src/features/terminal/TerminalPane.vue` (added, +273/-0)
```diff
@@ -0,0 +1,273 @@
+<template>
+  <div ref="rootRef" class="h-full w-full bg-[#0b0f14]">
+    <div ref="terminalRef" class="h-full w-full"></div>
+  </div>
+</template>
+
+<script setup lang="ts">
+import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
+import { Terminal } from '@xterm/xterm';
+import { FitAddon } from '@xterm/addon-fit';
+import { WebglAddon } from '@xterm/addon-webgl';
+import '@xterm/xterm/css/xterm.css';
+import { getSessionHistory, resizeSession, subscribeExit, subscribeOutput, writeSession } from './terminalBridge';
+
+const props = defineProps<{ sessionId: string; active: boolean }>();
+const sessionId = props.sessionId;
+
+const terminalRef = ref<HTMLDivElement | null>(null);
+const rootRef = ref<HTMLDivElement | null>(null);
+
+const fitAddon = new FitAddon();
+let webglAddon: WebglAddon | null = null;
+let terminal: Terminal | null = null;
+let resizeObserver: ResizeObserver | null = null;
+let unsubscribeOutput: (() => void) | null = null;
+let unsubscribeExit: (() => void) | null = null;
+let mouseUpHandler: ((event: MouseEvent) => void) | null = null;
+let refreshRaf: number | null = null;
+let refreshRafTail: number | null = null;
+let historyReady = false;
+
+const isMac = navigator.platform.toLowerCase().includes('mac');
+let lastCopiedSelection = '';
+
+const copySelection = (options?: { force?: boolean; clear?: boolean }) => {
+  if (!terminal || !terminal.hasSelection()) {
+    return;
+  }
+  const selection = terminal.getSelection();
+  if (!selection || selection === lastCopiedSelection) {
+    if (options?.force && selection) {
+      void navigator.clipboard.writeText(selection).catch(() => {});
+      if (options?.clear) {
+        terminal.clearSelection();
+        terminal.focus();
+        lastCopiedSelection = '';
+      }
+    }
+    return;
+  }
+  lastCopiedSelection = selection;
+  void navigator.clipboard.writeText(selection).catch(() => {});
+  if (options?.clear) {
+    terminal.clearSelection();
+    terminal.focus();
+    lastCopiedSelection = '';
+  }
+};
+
+const attachClipboardHandlers = (root: HTMLElement) => {
+  if (!terminal) {
+    return;
+  }
+  terminal.attachCustomKeyEventHandler((event) => {
+    const ctrlKey = isMac ? event.metaKey : event.ctrlKey;
+    const key = event.key.toLowerCase();
+
+    if (ctrlKey && key === 'c') {
+      if (terminal.hasSelection()) {
+        copySelection({ force: true, clear: true });
+        return false;
+      }
+      return true;
+    }
+    return true;
+  });
+
+  mouseUpHandler = (event) => {
+    if (event.button === 0) {
+      copySelection();
+    }
+  };
+  root.addEventListener('mouseup', mouseUpHandler);
+};
+
+const fitTerminal = () => {
+  if (!terminal) {
+    return;
+  }
+  fitAddon.fit();
+  if (terminal.cols > 0 && terminal.rows > 0) {
+    void resizeSession(sessionId, terminal.cols, terminal.rows).catch(() => {});
+  }
+};
+
+const scheduleWebglRefresh = () => {
+  if (!terminal || !webglAddon) {
+    return;
+  }
+  if (refreshRaf !== null || refreshRafTail !== null) {
+    return;
+  }
+  refreshRaf = window.requestAnimationFrame(() => {
+    refreshRaf = null;
+    refreshRafTail = window.requestAnimationFrame(() => {
+      refreshRafTail = null;
+      if (!terminal || !webglAddon) {
+        return;
+      }
+      if (terminal.rows <= 0 || terminal.cols <= 0) {
+        return;
+      }
+      try {
+        terminal.clearTextureAtlas();
+      } catch {}
+      terminal.refresh(0, terminal.rows - 1);
+    });
+  });
+};
+
+const attachOutput = () => {
+  if (!terminal || unsubscribeOutput) {
+    return;
+  }
+  unsubscribeOutput = subscribeOutput(sessionId, (data) => {
+    terminal?.write(data);
+  });
+  unsubscribeExit = subscribeExit(sessionId, (payload) => {
+    const reason = payload.signal ? `signal ${payload.signal}` : `code ${payload.code ?? 'unknown'}`;
+    terminal?.writeln(`\r\n[process exited: ${reason}]`);
+  });
+};
+
+const detachOutput = () => {
+  unsubscribeOutput?.();
+  unsubscribeOutput = null;
+  unsubscribeExit?.();
+  unsubscribeExit = null;
+};
+
+const applyActiveState = (isActive: boolean) => {
+  if (!terminal) {
+    return;
+  }
+  terminal.options.disableStdin = !isActive;
+  if (!historyReady) {
+    if (!isActive) {
+      detachOutput();
+      resizeObserver?.disconnect();
+      terminal.blur();
+    }
+    return;
+  }
+  if (isActive) {
+    attachOutput();
+    if (rootRef.value && resizeObserver) {
+      resizeObserver.observe(rootRef.value);
+    }
+    void nextTick(() => {
+      fitTerminal();
+      scheduleWebglRefresh();
+      terminal?.focus();
+    });
+  } else {
+    detachOutput();
+    resizeObserver?.disconnect();
+    terminal.blur();
+  }
+};
+
+onMounted(async () => {
+  if (!terminalRef.value || !rootRef.value) {
+    return;
+  }
+  terminal = new Terminal({
+    cursorBlink: true,
+    fontFamily:
+      "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation
```

**File**: `src/features/terminal/TerminalWorkspace.vue` (added, +265/-0)
```diff
@@ -0,0 +1,265 @@
+<template>
+  <section class="flex h-full w-full flex-col overflow-hidden">
+    <header class="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-panel/60 backdrop-blur">
+      <div>
+        <h1 class="text-xl font-semibold text-white">{{ t('terminal.title') }}</h1>
+        <p class="text-xs text-white/40">{{ t('terminal.subtitle') }}</p>
+      </div>
+      <div class="flex items-center gap-3">
+        <button
+          type="button"
+          class="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide text-white/80 border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition"
+          @click="handleNewTab"
+        >
+          <span class="material-symbols-outlined text-[18px]">add</span>
+          {{ t('terminal.newTab') }}
+        </button>
+      </div>
+    </header>
+
+    <div class="flex items-center gap-2 px-6 py-3 border-b border-white/5 bg-surface/30 overflow-x-auto">
+      <button
+        v-for="tab in tabs"
+        :key="tab.id"
+        type="button"
+        draggable="true"
+        @dragstart="onDragStart(tab.id, $event)"
+        @dragover="onDragOver(tab.id, $event)"
+        @drop="onDrop(tab.id)"
+        @dragend="onDragEnd"
+        @click="setActive(tab.id)"
+        :class="[
+          'group flex items-center gap-2 px-3 py-1.5 rounded-lg border transition whitespace-nowrap',
+          tab.id === activeId
+            ? 'bg-white/10 border-white/30 text-white'
+            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20',
+          dragOverId === tab.id && dragId !== tab.id ? 'ring-1 ring-primary/60' : ''
+        ]"
+      >
+        <span class="material-symbols-outlined text-[16px]">terminal</span>
+        <span class="text-xs font-semibold">{{ tab.title }}</span>
+        <span v-if="tab.hasActivity" class="ml-1 w-2 h-2 rounded-full bg-primary shadow-glow"></span>
+        <span
+          class="material-symbols-outlined text-[14px] text-white/40 hover:text-white"
+          @click.stop="closeTab(tab.id)"
+        >
+          close
+        </span>
+      </button>
+      <span v-if="tabs.length === 0" class="text-xs text-white/40">
+        {{ t('terminal.emptyTabs') }}
+      </span>
+    </div>
+
+    <div class="flex-1 min-h-0 relative">
+      <div v-if="tabs.length === 0" class="h-full flex flex-col items-center justify-center text-center text-white/50">
+        <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
+          <span class="material-symbols-outlined text-[28px]">terminal</span>
+        </div>
+        <p class="text-sm font-semibold text-white/70">{{ t('terminal.emptyTitle') }}</p>
+        <p class="text-xs text-white/40 mt-1">{{ t('terminal.emptySubtitle') }}</p>
+        <button
+          type="button"
+          class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide text-white bg-primary hover:bg-primary-hover shadow-glow transition"
+          @click="handleNewTab"
+        >
+          <span class="material-symbols-outlined text-[18px]">add</span>
+          {{ t('terminal.newTab') }}
+        </button>
+      </div>
+      <div v-else class="h-full w-full">
+        <TerminalPane
+          v-for="tab in tabs"
+          :key="tab.id"
+          :session-id="tab.id"
+          :active="tab.id === activeId"
+          v-show="tab.id === activeId"
+        />
+      </div>
+    </div>
+  </section>
+</template>
+
+<script setup lang="ts">
+import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
+import { emit, listen } from '@tauri-apps/api/event';
+import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
+import { useI18n } from 'vue-i18n';
+import { storeToRefs } from 'pinia';
+import TerminalPane from './TerminalPane.vue';
+import { onActivity } from './terminalBridge';
+import { useTerminalStore } from './terminalStore';
+import {
+  TERMINAL_OPEN_TAB_EVENT,
+  TERMINAL_WINDOW_READY_EVENT,
+  TERMINAL_WINDOW_READY_REQUEST_EVENT,
+  type TerminalOpenTabPayload
+} from './terminalEvents';
+import { useToastStore } from '@/stores/toastStore';
+import { useProjectStore } from '@/features/workspace/projectStore';
+
+const { t } = useI18n();
+const toastStore = useToastStore();
+const { pushToast } = toastStore;
+const terminalStore = useTerminalStore();
+const { tabs, activeId } = storeToRefs(terminalStore);
+const { createTab, setActive, closeTab, moveTab, markActivity, clearActivity, openTab } = terminalStore;
+const projectStore = useProjectStore();
+const { members } = storeToRefs(projectStore);
+
+const dragId = ref<string | null>(null);
+const dragOverId = ref<string | null>(null);
+const isCreating = ref(false);
+
+const resolveTabTitle = (memberId: string | undefined, payloadTitle: string) => {
+  if (memberId) {
+    const memberName = members.value.find((
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
