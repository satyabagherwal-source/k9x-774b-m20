# Forensic Learning Record (Deep Inspection): unhappychoice/gitlogue

> **Canonical Artifact**: `07_PROJECT_LEARNING/unhappychoice-gitlogue-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/unhappychoice/gitlogue](https://github.com/unhappychoice/gitlogue))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:49:35.031Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `unhappychoice/gitlogue`
- **Description**: A cinematic Git commit replay tool for the terminal, turning your Git history into a living, animated story.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 5079 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/ogp/generate.js`
```
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchFontFromGoogleFonts(fontFamily) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@700&display=swap`;
  const cssResponse = await fetch(cssUrl);
  const cssText = await cssResponse.text();

  const match = cssText.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
  if (!match) {
    throw new Error(`Could not find font URL for ${fontFamily}`);
  }

  const fontUrl = match[1];
  const fontResponse = await fetch(fontUrl);
  const arrayBuffer = await fontResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateOGP() {
  const width = 1200;
  const height = 630;

  // Download fonts from Google Fonts
  console.log('Downloading Crimson Text...');
  const crimsonTextData = await fetchFontFromGoogleFonts('Crimson Text');
  console.log('Downloading Lora...');
  const loraData = await fetchFontFromGoogleFonts('Lora');

  // Code snippet with syntax highlighting
  const codeLines = [
    { num: '174', code: '    ', color: '#E5E5E5' },
    { num: '175', code: '    pub fn new(config: Config) -> Self {', color: '#E5E5E5' },
    { num: '176', code: '        Self { engine: Engine::new(config) }', color: '#E5E5E5' },
    { num: '177', code: '    }', color: '#E5E5E5' },
    { num: '178', code: '    ', color: '#E5E5E5' },
    { num: '179', code: '-   pub fn load(&mut self, meta: Metadata) {', color: '#E06C75', bg: '#3F1F1F' },
    { num: '180', code: '+   pub fn load(&mut self, meta: Metadata) -> Result<()> {', color: '#89E051', bg: '#1F3F1F' },
    { num: '181', code: '        self.metadata = Some(meta.clone());', color: '#E5E5E5' },
    { num: '182', code: '        self.engine.load(meta)?;', color: '#E5E5E5' },
    { num: '183', code: '+       self.validate_state()?;', color: '#89E051', bg: '#1F3F1F' },
    { num: '184', code: '        Ok(())', color: '#E5E5E5' },
    { num: '185', code: '    }', color: '#E5E5E5' },
    { num: '186', code: '    ', color: '#E5E5E5' },
    { num: '187', code: '    pub fn render(&mut self) -> Result<()> {', color: '#E5E5E5' },
    { num: '188', code: '        self.engine.render()', color: '#E5E5E5' },
  ];

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#0C0C0F',
        },
        children: [
          // Left side: Title and info (40%)
          {
            type: 'div',
            props: {
              style: {
                width: '40%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                padding: '60px',
                gap: 30,
              },
              children: [
                // Title
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 76,
                      fontWeight: 700,
                      fontFamily: 'Crimson Text',
                      color: '#E5E5E5',
                      letterSpacing: '-0.02em',
                    },
                    children: 'gitlogue',
                  },
                },
                // Tagline
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 24,
                      fontFamily: 'Lora',
                      color: '#A0A0A0',
                      lineHeight: 1.5,
                    },
                    children: 'Cinematic Git commit replay for your terminal',
                  },
                },
                // Subcopy
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 18,
                      fontFamily: 'Lora',
                      color: '#61AFEF',
                      fontStyle: 'italic',
                    },
                    children: 'Watch your code history come alive.',
                  },
                },
                // Use cases
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      marginTop: 30,
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 16,
                            fontFamily: 'Lora',
                            display: 'flex',
                            gap: 6,
                          },
                          children: [
                            { type: 'div', props: { style: { color: '#7AA2F7' }, children: '▸ Screensaver' } },
                            { type: 'div', props: { style: { color: '#565F89' }, children: '— Ambient coding display' } },
                          ],
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 16,
                            fontFamily: 'Lora',
                            display: 'flex',
                            gap: 6,
                          },
                          children: [
                            { type: 'div', props: { style: { color: '#9ECE6A' }, children: '▸ Education' } },
                            { type: 'div', props: { style: { color: '#565F89' }, children: '— Visualize code evolution' } },
                          ],
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 16,
                            fontFamily: 'Lora',
                            display: 'flex',
                            gap: 6,
                          },
                          children: [
                            { type: 'div', props: { style: { color: '#E0AF68' }, children: '▸ Presentations' } },
                            { type: 'div', props: { style: { color: '#565F89' }, children: '— Replay commit histories' } },
                          ],
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 16,
                            fontFamily: 'Lora',
                            display: 'flex',
                            gap: 6,
                          },
                          children: [
                            { type: 'div', props: { style: { color: '#BB9AF7' }, children: '▸ Content Creation' } },
                            { type: 'div', props: { style: { color: '#565F89' }, children: '— Record with VHS/asciinema' } },
                          ],
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 16,
                            fontFamily: 'Lora',
                            display: 'flex',
                            gap: 6,
                          },
                          children: [
                            { type: 'div', props: { style: { color: '#7DCFFF' }, children: '▸ Desktop Ricing' } },
                            { type: 'div', props: { style: { color: '#565F89' }, children: '— Living terminal decoration' } },
                          ],
                        },
                      },
                    ],
                  },
                },
                // GitHub URL
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 16,
                      fontFamily: 'Lora',
                      color: '#4B5263',
                      marginTop: 'auto',
                    },
                    children: 'github.com/unhappychoice/gitlogue',
                  },
                },
              ],
            },
          },
          // Right side: Terminal box with TUI layout (60%)
          {
            type: 'div',
            props: {
              style: {
                width: '60%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '50px',
                backgroundColor: '#0C0C0F',
              },
              children: [
                // Terminal box wrapper
                {
                  type: 'div',
                  props: {
                    style: {
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#1A1B26',
                      borderRadius: 8,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    },
                    children: [
                      // Top row: FileTree | Editor
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            height: '75%',
                          },
                          children: [
                    
```

### Core Architecture Module: `src/animation.rs`
```
use std::cell::RefCell;
use std::time::{Duration, Instant};

use globset::{Glob, GlobMatcher};
use rand::RngExt;
use std::collections::VecDeque;
use unicode_width::UnicodeWidthStr;

use crate::git::{CommitMetadata, DiffHunk, FileChange, FileStatus, LineChangeType};
use crate::syntax::Highlighter;

/// A rule that specifies typing speed for files matching a glob pattern
#[derive(Debug, Clone)]
pub struct SpeedRule {
    pub matcher: GlobMatcher,
    pub speed_ms: u64,
}

impl SpeedRule {
    /// Parse a speed rule from string format "PATTERN:SPEED_MS"
    /// Example: "*.java:50" or "src/**/*.rs:30"
    pub fn parse(s: &str) -> Option<Self> {
        let parts: Vec<&str> = s.rsplitn(2, ':').collect();
        if parts.len() != 2 {
            return None;
        }
        let speed_ms = parts[0].parse::<u64>().ok()?;
        let pattern_str = parts[1];
        let glob = Glob::new(pattern_str).ok()?;
        let matcher = glob.compile_matcher();
        Some(Self { matcher, speed_ms })
    }

    /// Check if a file path matches this rule
    pub fn matches(&self, path: &str) -> bool {
        self.matcher.is_match(path)
    }
}

// Duration multipliers relative to typing speed
const CURSOR_MOVE_PAUSE: f64 = 0.5; // Cursor movement between lines (base speed)
const CURSOR_MOVE_SHORT_MULTIPLIER: f64 = 1.0; // Speed for short distances (1-50 lines)
const CURSOR_MOVE_MEDIUM_MULTIPLIER: f64 = 0.3; // Speed for medium distances (51-200 lines)
const CURSOR_MOVE_LONG_MULTIPLIER: f64 = 0.05; // Speed for long distances (201+ lines)
const MAX_SCROLL_STEPS: usize = 60; // Maximum animation steps for any scroll distance
const MIN_LOG_STEPS: usize = 50; // Minimum steps for logarithmic scaling (aligned with SHORT threshold)
const LOG_SCALE_FACTOR: f64 = 8.0; // Scaling factor for logarithmic step calculation
const DELETE_LINE_PAUSE: f64 = 10.0; // After deleting a line
const INSERT_LINE_PAUSE: f64 = 6.7; // After inserting a line
const HUNK_PAUSE: f64 = 50.0; // Between hunks
const CHECKOUT_PAUSE: f64 = 16.7; // After git checkout command
const CHECKOUT_OUTPUT_PAUSE: f64 = 33.3; // After git checkout output
const OPEN_FILE_FIRST_PAUSE: f64 = 33.3; // Before opening first file
const OPEN_FILE_PAUSE: f64 = 50.0; // Before opening subsequent files
const OPEN_CMD_PAUSE: f64 = 16.7; // After open command
const FILE_SWITCH_PAUSE: f64 = 26.7; // After switching file
const GIT_ADD_PAUSE: f64 = 33.3; // Before git add
const GIT_ADD_CMD_PAUSE: f64 = 16.7; // After git add command
const GIT_COMMIT_PAUSE: f64 = 26.7; // After git commit command
const COMMIT_OUTPUT_PAUSE: f64 = 33.3; // After commit output
const GIT_PUSH_PAUSE: f64 = 16.7; // After git push command
const PUSH_OUTPUT_PAUSE: f64 = 10.0; // Between push output lines
const PUSH_FINAL_PAUSE: f64 = 66.7; // After final push output

const MAX_LINE_CHECKPOINTS: usize = 200;
const MAX_CHANGE_CHECKPOINTS: usize = 64;

/// Represents the current state of the editor buffer
#[derive(Debug, Clone)]
pub struct EditorBuffer {
    pub lines: Vec<String>,
    pub cursor_line: usize,
    pub cursor_col: usize,
    pub scroll_offset: usize,
    pub cached_highlights: Vec<crate::syntax::HighlightSpan>,
    /// Pre-calculated highlights for old and new content
    pub old_highlights: Vec<crate::syntax::HighlightSpan>,
    pub new_highlights: Vec<crate::syntax::HighlightSpan>,
    /// Store old and new content for byte offset calculation
    pub old_content_lines: Vec<String>,
    pub new_content_lines: Vec<String>,
    /// Pre-calculated byte offsets for each line (handles CRLF correctly)
    pub old_content_line_offsets: Vec<usize>,
    pub new_content_line_offsets: Vec<usize>,
}

impl EditorBuffer {
    /// Creates a new empty editor buffer with default values.
    pub fn new() -> Self {
        Self {
            lines: vec![String::new()],
            cursor_line: 0,
            cursor_col: 0,
            scroll_offset: 0,
            cached_highlights: Vec::new(),
            old_highlights: Vec::new(),
            new_highlights: Vec::new(),
            old_content_lines: Vec::new(),
            new_content_lines: Vec::new(),
            old_content_line_offsets: Vec::new(),
            new_content_line_offsets: Vec::new(),
        }
    }

    /// Creates an editor buffer initialized with the given content.
    pub fn from_content(content: &str) -> Self {
        let lines: Vec<String> = if content.is_empty() {
            vec![String::new()]
        } else {
            content.lines().map(|s| s.to_string()).collect()
        };

        Self {
            lines,
            cursor_line: 0,
            cursor_col: 0,
            scroll_offset: 0,
            cached_highlights: Vec::new(),
            old_highlights: Vec::new(),
            new_highlights: Vec::new(),
            old_content_lines: Vec::new(),
            new_content_lines: Vec::new(),
            old_content_line_offsets: Vec::new(),
            new_content_line_offsets: Vec::new(),
        }
    }

    /// Inserts a character at the specified line and column position.
    pub fn insert_char(&mut self, line: usize, col: usize, ch: char) {
        if line >= self.lines.len() {
            self.lines.resize(line + 1, String::new());
        }
        let line_str = &mut self.lines[line];

        // Convert char index to byte index
        let byte_idx = line_str
            .char_indices()
            .nth(col)
            .map(|(idx, _)| idx)
            .unwrap_or_else(|| line_str.len());

        line_str.insert(byte_idx, ch);
    }

    /// Inserts a new line with the given content at the specified position.
    pub fn insert_line(&mut self, line: usize, content: String) {
        if line > self.lines.len() {
            self.lines.resize(line, String::new());
        }
        self.lines.insert(line, content);
    }

    /// Deletes the line at the specified position.
    pub fn delete_line(&mut self, line: usize) {
        if line < self.lines.len() {
            self.lines.remove(line);
        }
        if self.lines.is_empty() {
            self.lines.push(String::new());
        }
    }
}

/// Individual animation step
#[derive(Debug, Clone)]
pub enum AnimationStep {
    InsertChar {
        line: usize,
        col: usize,
        ch: char,
    },
    InsertLine {
        line: usize,
        content: String,
    },
    DeleteLine {
        line: usize,
    },
    MoveCursor {
        line: usize,
        col: usize,
    },
    Pause {
        multiplier: f64,
    },
    SwitchFile {
        file_index: usize,
        old_content: String,
        new_content: String,
        path: String,
    },
    OpenFileDialogStart,
    DialogTypeChar {
        ch: char,
    },
    TerminalPrompt,
    TerminalTypeChar {
        ch: char,
    },
    TerminalOutput {
        text: String,
    },
    ResetState,
}

/// Animation state machine
#[derive(Debug, Clone, PartialEq)]
pub enum AnimationState {
    Idle,
    Playing,
    Finished,
}

/// Which pane is currently active
#[derive(Debug, Clone, PartialEq)]
pub enum ActivePane {
    Editor,
    Terminal,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StepMode {
    Line,
    Change,
}

#[derive(Clone)]
struct ManualCheckpoint {
    step_index: usize,
    buffer: EditorBuffer,
    current_file_index: usize,
    current_file_path: Option<String>,
    terminal_lines: Vec<String>,
    active_pane: ActivePane,
    line_offset: isize,
    dialog_title: Option<String>,
    dialog_typing_text: String,
    speed_ms: u64,
}

impl ManualCheckpoint {
    fn new(engine: &AnimationEngine) -> Self {
        let resume_step = engine
            .current_step
            .saturating_add(1)
            .min(engine.steps.len());
        Self {
            step_index: resume_step,
            buffer: engine.buffer.clone(),
            current_file_index: engine.current_file_index,
            current_file_path: engine.current_file_path.clone(),
            terminal_lines: engine.terminal_lines.clone(),
            active_pane: engine.active_pane.clone(),
            line_offset: engine.line_offset,
            dialog_title: engine.dialog_title.clone(),
            dialog_typing_text: engine.dialog_typing_text.clone(),
            speed_ms: engine.speed_ms,
        }
    }
}

#[derive(Clone, Copy, PartialEq)]
enum CheckpointKind {
    Line,
    Change,
}

/// Main animation engine
pub struct AnimationEngine {
    pub buffer: EditorBuffer,
    pub state: AnimationState,
    steps: Vec<AnimationStep>,
    current_step: usize,
    last_update: Instant,
    speed_ms: u64,
    base_speed_ms: u64,
    next_step_delay: u64,
    pause_until: Option<Instant>,
    pub cursor_visible: bool,
    cursor_blink_timer: Instant,
    viewport_height: usize,
    content_width: usize,
    pub current_file_index: usize,
    pub current_file_path: Option<String>,
    pub terminal_lines: Vec<String>,
    pub active_pane: ActivePane,
    pub highlighter: RefCell<Highlighter>,
    /// Track cumulative line offset from old_content (insertions - deletions)
    pub line_offset: isize,
    /// Target frames per second for rendering
    #[allow(dead_code)]
    target_fps: u64,
    /// Frame interval in milliseconds (calculated from target_fps)
    frame_interval_ms: u64,
    /// Last frame render time
    last_frame: Instant,
    /// Dialog title (e.g., "Open File...")
    pub dialog_title: Option<String>,
    /// Text being typed in the dialog
    pub dialog_typing_text: String,
    /// Current metadata being displayed
    current_metadata: Option<CommitMetadata>,
    /// Pending metadata to be applied on ResetState
    pending_metadata: Option<CommitMetadata>,
    /// Speed rules for different file patterns
    speed_rules: Vec<SpeedRule>,
    speed_multiplier: f64,
    paused: bool,
    line_checkpoints: VecDeque<ManualCheckpoint>,
    change_checkpoints: VecDeque<ManualCheckpoint>,
}

impl AnimationEngine {
    /// Creates a new animation engine with the specified typing speed.
    pub fn new(speed_ms: u64) 
```

### Core Architecture Module: `src/config.rs`
```
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_speed")]
    pub speed: u64,
    #[serde(default = "default_background")]
    pub background: bool,
    #[serde(default = "default_order")]
    pub order: String,
    #[serde(default = "default_loop", rename = "loop", alias = "loop_playback")]
    pub loop_playback: bool,
    #[serde(default = "default_ignore_patterns")]
    pub ignore_patterns: Vec<String>,
    #[serde(default)]
    pub speed_rules: Vec<String>,
}

fn default_theme() -> String {
    "tokyo-night".to_string()
}

fn default_speed() -> u64 {
    30
}

fn default_background() -> bool {
    true
}

fn default_order() -> String {
    "random".to_string()
}

fn default_loop() -> bool {
    false
}

fn default_ignore_patterns() -> Vec<String> {
    Vec::new()
}

fn home_dir() -> Option<PathBuf> {
    #[cfg(test)]
    if let Some(path) = test_home::current() {
        return Some(path);
    }
    dirs::home_dir()
}

#[cfg(test)]
pub(crate) mod test_home {
    use std::path::{Path, PathBuf};
    use std::sync::{Mutex, MutexGuard, OnceLock, RwLock};

    fn serializer() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn override_state() -> &'static RwLock<Option<PathBuf>> {
        static STATE: OnceLock<RwLock<Option<PathBuf>>> = OnceLock::new();
        STATE.get_or_init(|| RwLock::new(None))
    }

    pub(crate) fn current() -> Option<PathBuf> {
        override_state().read().ok().and_then(|g| g.clone())
    }

    pub(crate) struct Guard {
        _lock: MutexGuard<'static, ()>,
    }

    impl Guard {
        pub(crate) fn new(path: &Path) -> Self {
            Self::with_override(Some(path.to_path_buf()))
        }

        #[cfg(test)]
        pub(crate) fn no_override() -> Self {
            Self::with_override(None)
        }

        fn with_override(path: Option<PathBuf>) -> Self {
            let lock = serializer().lock().expect("serializer poisoned");
            *override_state().write().expect("override poisoned") = path;
            Self { _lock: lock }
        }
    }

    impl Drop for Guard {
        fn drop(&mut self) {
            *override_state().write().expect("override poisoned") = None;
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            speed: default_speed(),
            background: default_background(),
            order: default_order(),
            loop_playback: default_loop(),
            ignore_patterns: default_ignore_patterns(),
            speed_rules: Vec::new(),
        }
    }
}

impl Config {
    pub fn load() -> Result<Self> {
        let config_path = Self::config_path()?;

        if !config_path.exists() {
            return Ok(Self::default());
        }

        let contents = fs::read_to_string(&config_path)
            .with_context(|| format!("Failed to read config file: {}", config_path.display()))?;

        toml::from_str(&contents)
            .with_context(|| format!("Failed to parse config file: {}", config_path.display()))
    }

    pub fn save(&self) -> Result<()> {
        let config_path = Self::config_path()?;

        let contents = if config_path.exists() {
            // Load existing config and update values to preserve comments
            let existing = fs::read_to_string(&config_path).with_context(|| {
                format!("Failed to read config file: {}", config_path.display())
            })?;

            let mut doc = existing
                .parse::<toml_edit::DocumentMut>()
                .with_context(|| {
                    format!("Failed to parse config file: {}", config_path.display())
                })?;

            // Update values while preserving comments
            doc["theme"] = toml_edit::value(self.theme.as_str());
            doc["speed"] = toml_edit::value(self.speed as i64);
            doc["background"] = toml_edit::value(self.background);
            doc["order"] = toml_edit::value(self.order.as_str());
            doc["loop"] = toml_edit::value(self.loop_playback);
            // Update ignore_patterns as array
            let mut array = toml_edit::Array::new();
            for pattern in &self.ignore_patterns {
                array.push(pattern.as_str());
            }
            doc["ignore_patterns"] = toml_edit::value(array);

            // Update speed_rules as array
            let mut speed_array = toml_edit::Array::new();
            for rule in &self.speed_rules {
                speed_array.push(rule.as_str());
            }
            doc["speed_rules"] = toml_edit::value(speed_array);

            doc.to_string()
        } else {
            // Create new config with comments
            let patterns_str = if self.ignore_patterns.is_empty() {
                "[]".to_string()
            } else {
                let patterns: Vec<String> = self
                    .ignore_patterns
                    .iter()
                    .map(|p| format!("\"{}\"", p))
                    .collect();
                format!("[{}]", patterns.join(", "))
            };

            let speed_rules_str = if self.speed_rules.is_empty() {
                "[]".to_string()
            } else {
                let rules: Vec<String> = self
                    .speed_rules
                    .iter()
                    .map(|r| format!("\"{}\"", r))
                    .collect();
                format!("[{}]", rules.join(", "))
            };

            format!(
                "# gitlogue configuration file\n\
                 # All settings are optional and will use defaults if not specified\n\
                 \n\
                 # Theme to use for syntax highlighting\n\
                 theme = \"{}\"\n\
                 \n\
                 # Typing speed in milliseconds per character\n\
                 speed = {}\n\
                 \n\
                 # Show background colors (set to false for transparent background)\n\
                 background = {}\n\
                 \n\
                 # Commit playback order: random, asc, or desc\n\
                 order = \"{}\"\n\
                 \n\
                 # Loop the animation continuously\n\
                 loop = {}\n\
                 \n\
                 # Ignore patterns (gitignore syntax)\n\
                 # Examples: [\"*.png\", \"*.ipynb\", \"dist/**\"]\n\
                 ignore_patterns = {}\n\
                 \n\
                 # Speed rules for different file types (pattern:milliseconds)\n\
                 # Examples: [\"*.java:50\", \"*.xml:5\", \"*.rs:30\"]\n\
                 speed_rules = {}\n",
                self.theme,
                self.speed,
                self.background,
                self.order,
                self.loop_playback,
                patterns_str,
                speed_rules_str
            )
        };

        fs::write(&config_path, contents)
            .with_context(|| format!("Failed to write config file: {}", config_path.display()))
    }

    pub fn config_path() -> Result<PathBuf> {
        let config_dir = home_dir()
            .context("Failed to determine home directory")?
            .join(".config")
            .join("gitlogue");

        fs::create_dir_all(&config_dir).with_context(|| {
            format!(
                "Failed to create config directory: {}",
                config_dir.display()
            )
        })?;

        Ok(config_dir.join("config.toml"))
    }

    #[allow(dead_code)]
    pub fn themes_dir() -> Result<PathBuf> {
        let config_dir = home_dir()
            .context("Failed to determine home directory")?
            .join(".config")
            .join("gitlogue")
            .join("themes");

        fs::create_dir_all(&config_dir).with_context(|| {
            format!(
                "Failed to create themes directory: {}",
                config_dir.display()
            )
        })?;

        Ok(config_dir)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempHome {
        _override: super::test_home::Guard,
        path: PathBuf,
    }

    impl TempHome {
        fn new() -> Result<Self> {
            let path = env::temp_dir().join(format!(
                "gitlogue-config-tests-{}-{}",
                std::process::id(),
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
            ));

            fs::create_dir_all(&path)?;

            let _override = super::test_home::Guard::new(&path);
            Ok(Self { _override, path })
        }
    }

    impl Drop for TempHome {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn home_dir_falls_back_to_dirs_home_dir_when_override_is_unset() {
        let _guard = super::test_home::Guard::no_override();
        assert_eq!(super::home_dir(), dirs::home_dir());
    }

    fn sample_config() -> Config {
        Config {
            theme: "nord".to_string(),
            speed: 12,
            background: false,
            order: "desc".to_string(),
            loop_playback: true,
            ignore_patterns: vec!["dist/**".to_string(), "*.png".to_string()],
            speed_rules: vec!["*.rs:10".to_string(), "*.md:40".to_string()],
        }
    }

    fn assert_config_eq(actual: &Config, expected: &Config) {
        assert_eq!(actual.theme, expected.theme);
        assert_eq!(actual.speed, expected.speed);
        assert_eq!(actual.background, expected.background);
        assert_eq!(actual.order, expected.order);
        assert_eq!(actual.loop_playback, expected.loop_playback);
        assert_eq!(actual.ignore_patterns, expected.
```

### Core Architecture Module: `src/git.rs`
```
use anyhow::{Context, Result};
use chrono::{DateTime, Local, Utc};
use chrono_english::{parse_date_string, Dialect};
use git2::{Commit as Git2Commit, Delta, DiffFindOptions, DiffOptions, Oid, Repository};
use globset::{Glob, GlobSet, GlobSetBuilder};
use rand::RngExt;
use std::cell::RefCell;
use std::path::Path;
use std::sync::OnceLock;

// Thread-safe global pattern matcher for user-defined ignore patterns
static USER_PATTERNS: OnceLock<GlobSet> = OnceLock::new();

// Maximum blob size to read (500KB)
const MAX_BLOB_SIZE: usize = 500 * 1024;

// Maximum number of changed lines per file to animate
// Files with more changes will be skipped to prevent performance issues
const MAX_CHANGE_LINES: usize = 2000;

/// Specifies which working tree changes to show in diff mode
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub enum DiffMode {
    #[default]
    Staged, // Only staged changes (index vs HEAD)
    Unstaged, // Only unstaged changes (workdir vs index)
}

// Files to exclude from diff animation (lock files and generated files)
const EXCLUDED_FILES: &[&str] = &[
    // JavaScript/Node.js
    "yarn.lock",
    "package-lock.json",
    "pnpm-lock.yaml",
    "bun.lock",
    "bun.lockb",
    // Rust
    "Cargo.lock",
    // Ruby
    "Gemfile.lock",
    // Python
    "poetry.lock",
    "Pipfile.lock",
    "uv.lock",
    // PHP
    "composer.lock",
    // Go
    "go.sum",
    // Swift
    "Package.resolved",
    // Dart/Flutter
    "pubspec.lock",
    // .NET/C#
    "packages.lock.json",
    "project.assets.json",
    // Elixir
    "mix.lock",
    // Java/Gradle
    "gradle.lockfile",
    "buildscript-gradle.lockfile",
    // Scala
    "build.sbt.lock",
    // Bazel
    "MODULE.bazel.lock",
];

// File patterns to exclude from diff animation
const EXCLUDED_PATTERNS: &[&str] = &[
    // Minified files
    ".min.js",
    ".min.css",
    // Bundled files
    ".bundle.js",
    ".bundle.css",
    // Source maps
    ".js.map",
    ".css.map",
    ".d.ts.map",
    // Test snapshots
    ".snap",
    "__snapshots__",
];

/// Initialize user-defined ignore patterns (call once at startup)
pub fn init_ignore_patterns(patterns: &[String]) -> Result<()> {
    if patterns.is_empty() {
        return Ok(());
    }

    let mut builder = GlobSetBuilder::new();

    for pattern in patterns {
        let glob =
            Glob::new(pattern).with_context(|| format!("Invalid glob pattern: {}", pattern))?;
        builder.add(glob);
    }

    let globset = builder.build().context("Failed to build glob set")?;

    USER_PATTERNS
        .set(globset)
        .map_err(|_| anyhow::anyhow!("User patterns already initialized"))?;

    Ok(())
}

/// Check if a file should be excluded from diff animation
pub fn should_exclude_file(path: &str) -> bool {
    // Check user-defined patterns first
    if let Some(patterns) = USER_PATTERNS.get() {
        if patterns.is_match(path) {
            return true;
        }
    }

    let filename = path.rsplit('/').next().unwrap_or(path);

    // Check if it's a lock file
    if EXCLUDED_FILES.contains(&filename) {
        return true;
    }

    // Check if it matches excluded patterns
    for pattern in EXCLUDED_PATTERNS {
        if filename.ends_with(pattern) || path.contains(pattern) {
            return true;
        }
    }

    false
}

// Check if a commit matches the author filter pattern (case-insensitive partial match)
fn matches_author(commit: &Git2Commit, pattern: &str) -> bool {
    let author = commit.author();
    let name = author.name().unwrap_or("");
    let email = author.email().unwrap_or("");
    let pattern_lower = pattern.to_lowercase();

    name.to_lowercase().contains(&pattern_lower) || email.to_lowercase().contains(&pattern_lower)
}

// Parse a date string using chrono-english (supports Git-like formats)
pub fn parse_date(input: &str) -> Result<DateTime<Utc>> {
    let now = Local::now();

    parse_date_string(input, now, Dialect::Us)
        .map(|dt| dt.with_timezone(&Utc))
        .with_context(|| format!("Invalid date format: '{}'. Use formats like '2024-01-01', '1 week ago', 'yesterday'", input))
}

// Check if a commit date is within the specified date range
fn matches_date_filter(
    commit: &Git2Commit,
    before: Option<&DateTime<Utc>>,
    after: Option<&DateTime<Utc>>,
) -> Result<bool> {
    let timestamp = commit.author().when().seconds();
    let commit_date = DateTime::from_timestamp(timestamp, 0).context("Invalid commit timestamp")?;

    if let Some(before_date) = before {
        if commit_date > *before_date {
            return Ok(false);
        }
    }

    if let Some(after_date) = after {
        if commit_date < *after_date {
            return Ok(false);
        }
    }

    Ok(true)
}

fn detect_file_moves(diff: &mut git2::Diff, for_untracked: bool) -> Result<()> {
    let mut options = DiffFindOptions::new();
    options.renames(true);
    if for_untracked {
        options.for_untracked(true);
    }
    diff.find_similar(Some(&mut options))
        .context("Failed to detect file renames in diff")
}

pub struct GitRepository {
    repo: Repository,
    commit_cache: RefCell<Option<Vec<Oid>>>,
    // Shared index for both cache-based playback (asc/desc) and range playback.
    // These modes are mutually exclusive based on CLI arguments.
    commit_index: RefCell<usize>,
    commit_range: RefCell<Option<Vec<Oid>>>,
    author_filter: Option<String>,
    before_filter: Option<DateTime<Utc>>,
    after_filter: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum FileStatus {
    Added,
    Deleted,
    Modified,
    Renamed,
    Copied,
    Unmodified,
}

impl FileStatus {
    pub fn as_str(&self) -> &str {
        match self {
            FileStatus::Added => "A",
            FileStatus::Deleted => "D",
            FileStatus::Modified => "M",
            FileStatus::Renamed => "R",
            FileStatus::Copied => "C",
            FileStatus::Unmodified => "U",
        }
    }
}

impl From<Delta> for FileStatus {
    fn from(delta: Delta) -> Self {
        match delta {
            Delta::Added => FileStatus::Added,
            Delta::Deleted => FileStatus::Deleted,
            Delta::Modified => FileStatus::Modified,
            Delta::Renamed => FileStatus::Renamed,
            Delta::Copied => FileStatus::Copied,
            Delta::Unmodified => FileStatus::Unmodified,
            _ => FileStatus::Modified,
        }
    }
}

#[derive(Debug, Clone)]
pub enum LineChangeType {
    Addition,
    Deletion,
    Context,
}

#[derive(Debug, Clone)]
pub struct LineChange {
    pub change_type: LineChangeType,
    pub content: String,
    #[allow(dead_code)]
    pub old_line_no: Option<usize>,
    #[allow(dead_code)]
    pub new_line_no: Option<usize>,
}

#[derive(Debug, Clone)]
pub struct DiffHunk {
    pub old_start: usize,
    #[allow(dead_code)]
    pub old_lines: usize,
    #[allow(dead_code)]
    pub new_start: usize,
    #[allow(dead_code)]
    pub new_lines: usize,
    pub lines: Vec<LineChange>,
}

#[derive(Debug, Clone)]
pub struct FileChange {
    pub path: String,
    #[allow(dead_code)]
    pub old_path: Option<String>,
    pub status: FileStatus,
    #[allow(dead_code)]
    pub is_binary: bool,
    pub is_excluded: bool,
    pub exclusion_reason: Option<String>,
    pub old_content: Option<String>,
    #[allow(dead_code)]
    pub new_content: Option<String>,
    pub hunks: Vec<DiffHunk>,
    #[allow(dead_code)]
    pub diff: String,
}

#[derive(Debug, Clone)]
pub struct CommitMetadata {
    pub hash: String,
    pub author: String,
    pub date: DateTime<Utc>,
    pub message: String,
    pub changes: Vec<FileChange>,
}

impl CommitMetadata {
    /// Returns indices sorted in FileTree display order (directory -> filename)
    pub fn sorted_file_indices(&self) -> Vec<usize> {
        let mut indices: Vec<usize> = (0..self.changes.len()).collect();
        indices.sort_by_key(|&index| {
            let path = &self.changes[index].path;
            let parts: Vec<&str> = path.split('/').collect();

            if parts.len() == 1 {
                // Root level file: ("", filename)
                (String::new(), path.clone())
            } else {
                // File in directory: (directory, filename)
                let dir = parts[..parts.len() - 1].join("/");
                let filename = parts[parts.len() - 1].to_string();
                (dir, filename)
            }
        });
        indices
    }
}

impl GitRepository {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let repo = Repository::open(path).context("Failed to open Git repository")?;
        Ok(Self {
            repo,
            commit_cache: RefCell::new(None),
            commit_index: RefCell::new(0),
            commit_range: RefCell::new(None),
            author_filter: None,
            before_filter: None,
            after_filter: None,
        })
    }

    pub fn get_commit(&self, hash: &str) -> Result<CommitMetadata> {
        let obj = self
            .repo
            .revparse_single(hash)
            .context("Invalid commit hash or commit not found")?;

        let commit = obj.peel_to_commit().context("Object is not a commit")?;

        Self::extract_metadata_with_changes(&self.repo, &commit)
    }

    pub fn random_commit(&self) -> Result<CommitMetadata> {
        self.populate_cache()?;

        let cache = self.commit_cache.borrow();
        let candidates = cache.as_ref().unwrap();

        let selected_oid = candidates
            .get(rand::rng().random_range(0..candidates.len()))
            .context("Failed to select random commit")?;

        let commit = self.repo.find_commit(*selected_oid)?;
        Self::extract_metadata_with_changes(&self.repo, &commit)
    }

    pub fn next_asc_commit(&self) -> Result<CommitMetadata> {
        self.populate_cache()?;

        let cache = self.commit_cache.borrow();
        let candidates = cache.as_ref().unwrap();
        let mut index = self.commit_inde
```

### Core Architecture Module: `src/lib.rs`
```
pub mod git;
pub mod syntax;
pub mod theme;

```

### Core Architecture Module: `src/main.rs`
```
mod animation;
mod config;
mod git;
mod panes;
mod syntax;
mod theme;
mod ui;
mod watch;
mod widgets;

use animation::SpeedRule;
use anyhow::{Context, Result};
use clap::{Parser, Subcommand, ValueEnum};
use config::Config;
use git::{DiffMode, GitRepository};
use std::path::{Path, PathBuf};
use theme::Theme;
use ui::UI;
use watch::CommitWatcher;

/// Defines the order in which commits are played back during animation.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, ValueEnum)]
pub enum PlaybackOrder {
    #[default]
    Random,
    Asc,
    Desc,
}

#[derive(Parser, Debug)]
#[command(
    name = "gitlogue",
    version,
    about = "A Git history screensaver - watch your code rewrite itself",
    long_about = "gitlogue is a terminal-based screensaver that replays Git commits as if a ghost developer were typing each change by hand. Characters appear, vanish, and transform with natural pacing and syntax highlighting."
)]
pub struct Args {
    #[arg(
        short,
        long,
        value_name = "PATH",
        help = "Path to Git repository (defaults to current directory)"
    )]
    pub path: Option<PathBuf>,

    #[arg(
        short,
        long,
        value_name = "HASH_OR_RANGE",
        help = "Replay a specific commit or commit range (e.g., HEAD~5..HEAD or abc123..)"
    )]
    pub commit: Option<String>,

    #[arg(
        short,
        long,
        value_name = "MS",
        help = "Typing speed in milliseconds per character (overrides config file)"
    )]
    pub speed: Option<u64>,

    #[arg(
        short,
        long,
        value_name = "NAME",
        help = "Theme to use (overrides config file)"
    )]
    pub theme: Option<String>,

    #[arg(
        long,
        num_args = 0..=1,
        default_missing_value = "true",
        value_name = "BOOL",
        help = "Show background colors (use --background=false for transparent background, overrides config file)"
    )]
    pub background: Option<bool>,

    #[arg(
        long,
        value_enum,
        value_name = "ORDER",
        help = "Commit playback order (overrides config file)"
    )]
    pub order: Option<PlaybackOrder>,

    #[arg(
        long = "loop",
        num_args = 0..=1,
        default_missing_value = "true",
        value_name = "BOOL",
        help = "Loop the animation continuously (useful with --commit for commit ranges)"
    )]
    pub loop_playback: Option<bool>,

    #[arg(
        short = 'w',
        long,
        conflicts_with_all = ["commit", "order", "loop_playback", "author", "before", "after"],
        help = "Watch the repository and replay new commits as they are made"
    )]
    pub watch: bool,

    #[arg(long, help = "Display third-party license information")]
    pub license: bool,

    #[arg(
        short = 'a',
        long,
        value_name = "PATTERN",
        value_parser = |s: &str| if s.trim().is_empty() {
            Err("Author pattern cannot be empty".to_string())
        } else {
            Ok(s.to_string())
        },
        help = "Filter commits by author name or email (partial match, case-insensitive)"
    )]
    pub author: Option<String>,

    #[arg(
        long,
        value_name = "DATE",
        help = "Show commits before this date (e.g., '2024-01-01', '1 week ago', 'yesterday')"
    )]
    pub before: Option<String>,

    #[arg(
        long,
        value_name = "DATE",
        help = "Show commits after this date (e.g., '2024-01-01', '1 week ago', 'yesterday')"
    )]
    pub after: Option<String>,

    #[arg(
        short = 'i',
        long = "ignore",
        value_name = "PATTERN",
        action = clap::ArgAction::Append,
        help = "Ignore files matching pattern (gitignore syntax, can be specified multiple times)"
    )]
    pub ignore: Vec<String>,

    #[arg(
        long = "ignore-file",
        value_name = "PATH",
        help = "Path to file containing ignore patterns (one per line, like .gitignore)"
    )]
    pub ignore_file: Option<PathBuf>,

    #[arg(
        long = "speed-rule",
        value_name = "PATTERN:MS",
        action = clap::ArgAction::Append,
        help = "Set typing speed for files matching pattern (e.g., '*.java:50', '*.xml:5'). Can be specified multiple times."
    )]
    pub speed_rule: Vec<String>,

    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Theme management commands
    Theme {
        #[command(subcommand)]
        command: ThemeCommands,
    },
    /// Show staged working tree changes (use --unstaged for unstaged changes)
    Diff {
        #[arg(long, help = "Show unstaged changes instead of staged")]
        unstaged: bool,

        #[arg(
            short,
            long,
            value_name = "MS",
            help = "Typing speed in milliseconds per character"
        )]
        speed: Option<u64>,

        #[arg(short, long, value_name = "NAME", help = "Theme to use")]
        theme: Option<String>,

        #[arg(long, num_args = 0..=1, default_missing_value = "true", value_name = "BOOL",
              help = "Show background colors (use --background=false for transparent)")]
        background: Option<bool>,

        #[arg(long = "loop", num_args = 0..=1, default_missing_value = "true", value_name = "BOOL",
              help = "Loop the animation continuously")]
        loop_playback: Option<bool>,

        #[arg(short = 'i', long = "ignore", value_name = "PATTERN", action = clap::ArgAction::Append,
              help = "Ignore files matching pattern (gitignore syntax)")]
        ignore: Vec<String>,

        #[arg(long = "speed-rule", value_name = "PATTERN:MS", action = clap::ArgAction::Append,
              help = "Set typing speed for files matching pattern (e.g., '*.java:50')")]
        speed_rule: Vec<String>,
    },
}

#[derive(Subcommand, Debug)]
pub enum ThemeCommands {
    /// List all available themes
    List,
    /// Set default theme in config file
    Set {
        #[arg(value_name = "NAME", help = "Theme name to set as default")]
        name: String,
    },
}

impl Args {
    /// Validates the command-line arguments and returns the Git repository path.
    pub fn validate(&self) -> Result<PathBuf> {
        let start_path = self.path.clone().unwrap_or_else(|| PathBuf::from("."));

        if !start_path.exists() {
            anyhow::bail!("Path does not exist: {}", start_path.display());
        }

        let canonical_path = start_path
            .canonicalize()
            .context("Failed to resolve path")?;

        let repo_path = Self::find_git_root(&canonical_path).ok_or_else(|| {
            anyhow::anyhow!(
                "Not a Git repository: {} (or any parent directories)",
                start_path.display()
            )
        })?;

        Ok(repo_path)
    }

    fn find_git_root(start_path: &Path) -> Option<PathBuf> {
        let mut current = if start_path.is_file() {
            start_path.parent()?.to_path_buf()
        } else {
            start_path.to_path_buf()
        };

        loop {
            if current.join(".git").exists() {
                return Some(current);
            }
            if !current.pop() {
                return None;
            }
        }
    }
}

fn is_range_mode(commit: Option<&str>) -> bool {
    commit.is_some_and(|spec| spec.contains(".."))
}

fn resolve_order(
    cli_order: Option<PlaybackOrder>,
    config_order: &str,
    is_range_mode: bool,
    is_filtered: bool,
) -> PlaybackOrder {
    let order = cli_order.unwrap_or(match config_order {
        "asc" => PlaybackOrder::Asc,
        "desc" => PlaybackOrder::Desc,
        _ => PlaybackOrder::Random,
    });

    if (is_range_mode || is_filtered) && cli_order.is_none() {
        PlaybackOrder::Asc
    } else {
        order
    }
}

fn collect_ignore_patterns(
    config_patterns: &[String],
    ignore_file: Option<&Path>,
    cli_patterns: &[String],
) -> Result<Vec<String>> {
    let mut patterns = config_patterns.to_vec();

    if let Some(path) = ignore_file {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read ignore file: {}", path.display()))?;
        patterns.extend(
            content
                .lines()
                .filter(|line| !line.trim().is_empty() && !line.starts_with('#'))
                .map(String::from),
        );
    }

    patterns.extend(cli_patterns.iter().cloned());
    Ok(patterns)
}

fn parse_speed_rules(cli_rules: &[String], config_rules: &[String]) -> Vec<SpeedRule> {
    cli_rules
        .iter()
        .chain(config_rules.iter())
        .filter_map(|rule| {
            SpeedRule::parse(rule).or_else(|| {
                eprintln!("Warning: Invalid speed rule '{}', skipping", rule);
                None
            })
        })
        .collect()
}

fn load_initial_commit(
    repo: &GitRepository,
    commit: Option<&str>,
    order: PlaybackOrder,
) -> Result<git::CommitMetadata> {
    if is_range_mode(commit) {
        repo.set_commit_range(commit.expect("range mode requires a commit spec"))?;
        return match order {
            PlaybackOrder::Random => repo.random_range_commit(),
            PlaybackOrder::Asc => repo.next_range_commit_asc(),
            PlaybackOrder::Desc => repo.next_range_commit_desc(),
        };
    }

    if let Some(commit_hash) = commit {
        return repo.get_commit(commit_hash);
    }

    match order {
        PlaybackOrder::Random => repo.random_commit(),
        PlaybackOrder::Asc => repo.next_asc_commit(),
        PlaybackOrder::Desc => repo.next_desc_commit(),
    }
}

fn should_keep_repo_ref(
    is_range_mode: bool,
    is_filtered: bool,
    is_commit_specified: bool,
    loop_playback: bool,
) -> bool {
    is_range_mode || is_filtered || !is_commit_specified || loop_playback
}

struct RuntimeOptions {
    speed: u64,
    theme: Theme,
    loop_playback: bool,
    speed_rules: Vec<SpeedRule>,
}

struct DiffCommandOptions<'a> {
    unstag
```

### Core Architecture Module: `src/panes/editor.rs`
```
use ratatui::{
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Padding},
    Frame,
};

use crate::animation::{ActivePane, AnimationEngine};
use crate::theme::Theme;
use crate::widgets::SelectableParagraph;

pub struct EditorPane;

struct HighlightContext<'a> {
    line_content: &'a str,
    line_num: usize,
    show_cursor: bool,
    cursor_col: usize,
    cursor_line: usize,
    old_highlights: &'a [crate::syntax::HighlightSpan],
    new_highlights: &'a [crate::syntax::HighlightSpan],
    old_line_offsets: &'a [usize],
    new_line_offsets: &'a [usize],
    line_offset: isize,
    theme: &'a Theme,
}

impl EditorPane {
    pub fn render(&self, f: &mut Frame, area: Rect, engine: &AnimationEngine, theme: &Theme) {
        let block = Block::default()
            .style(Style::default().bg(theme.background_right))
            .padding(Padding::vertical(1));

        let content_height = area.height.saturating_sub(2) as usize; // Subtract top and bottom padding
        let scroll_offset = engine.buffer.scroll_offset;
        let buffer_lines = &engine.buffer.lines;
        let line_num_width = format!("{}", buffer_lines.len()).len().max(3);

        let visible_lines: Vec<Line> = buffer_lines
            .iter()
            .skip(scroll_offset)
            .take(content_height)
            .enumerate()
            .map(|(idx, line_content)| {
                let line_num = scroll_offset + idx;
                self.build_line(line_content, line_num, line_num_width, engine, theme)
            })
            .collect();

        // Calculate selected line index in visible_lines
        let selected_line_index = if engine.buffer.cursor_line >= scroll_offset {
            let idx = engine.buffer.cursor_line - scroll_offset;
            if idx < visible_lines.len() {
                Some(idx)
            } else {
                None
            }
        } else {
            None
        };

        let content = SelectableParagraph::new(visible_lines)
            .block(block)
            .selected_line(selected_line_index)
            .selected_style(Style::default().bg(theme.editor_cursor_line_bg))
            .background_style(Style::default().bg(theme.background_right))
            .padding(Padding::horizontal(2))
            .dim(20, 0.6);
        f.render_widget(content, area);
    }

    fn build_line(
        &self,
        line_content: &str,
        line_num: usize,
        line_num_width: usize,
        engine: &AnimationEngine,
        theme: &Theme,
    ) -> Line<'_> {
        let cursor_line = engine.buffer.cursor_line;
        let is_cursor_line = line_num == cursor_line;

        let mut spans = Vec::new();

        spans.push(self.render_line_number(line_num, is_cursor_line, line_num_width, theme));

        spans.push(Span::styled(
            "  ",
            Style::default().fg(theme.editor_separator),
        ));

        let show_cursor =
            is_cursor_line && engine.cursor_visible && engine.active_pane == ActivePane::Editor;

        let line_spans = self.highlight_line(HighlightContext {
            line_content,
            line_num,
            show_cursor,
            cursor_col: engine.buffer.cursor_col,
            cursor_line: engine.buffer.cursor_line,
            old_highlights: &engine.buffer.old_highlights,
            new_highlights: &engine.buffer.new_highlights,
            old_line_offsets: &engine.buffer.old_content_line_offsets,
            new_line_offsets: &engine.buffer.new_content_line_offsets,
            line_offset: engine.line_offset,
            theme,
        });

        spans.extend(line_spans);

        Line::from(spans)
    }

    fn render_line_number(
        &self,
        line_num: usize,
        is_cursor_line: bool,
        width: usize,
        theme: &Theme,
    ) -> Span<'_> {
        let line_num_str = format!("{:>width$} ", line_num + 1, width = width);

        if is_cursor_line {
            Span::styled(
                line_num_str,
                Style::default()
                    .fg(theme.editor_line_number_cursor)
                    .add_modifier(Modifier::BOLD),
            )
        } else {
            Span::styled(line_num_str, Style::default().fg(theme.editor_line_number))
        }
    }

    fn highlight_line(&self, ctx: HighlightContext<'_>) -> Vec<Span<'_>> {
        let (highlights, line_offsets) = self.select_highlights_and_offsets(
            ctx.line_num,
            ctx.cursor_line,
            ctx.old_highlights,
            ctx.new_highlights,
            ctx.old_line_offsets,
            ctx.new_line_offsets,
        );

        let byte_offset = self.calculate_byte_offset(
            ctx.line_num,
            ctx.cursor_line,
            ctx.line_offset,
            line_offsets,
        );

        let line_highlights =
            self.filter_line_highlights(highlights, byte_offset, ctx.line_content.len());

        self.apply_highlights(&line_highlights, byte_offset, &ctx)
    }

    fn select_highlights_and_offsets<'a>(
        &self,
        line_num: usize,
        cursor_line: usize,
        old_highlights: &'a [crate::syntax::HighlightSpan],
        new_highlights: &'a [crate::syntax::HighlightSpan],
        old_line_offsets: &'a [usize],
        new_line_offsets: &'a [usize],
    ) -> (&'a [crate::syntax::HighlightSpan], &'a [usize]) {
        if line_num <= cursor_line {
            (new_highlights, new_line_offsets)
        } else {
            (old_highlights, old_line_offsets)
        }
    }

    fn calculate_byte_offset(
        &self,
        line_num: usize,
        cursor_line: usize,
        line_offset: isize,
        line_offsets: &[usize],
    ) -> usize {
        let target_line = if line_num > cursor_line {
            ((line_num as isize) - line_offset).max(0) as usize
        } else {
            line_num
        };

        line_offsets
            .get(target_line)
            .copied()
            .unwrap_or_else(|| *line_offsets.last().unwrap_or(&0))
    }

    fn filter_line_highlights(
        &self,
        highlights: &[crate::syntax::HighlightSpan],
        byte_offset: usize,
        line_len: usize,
    ) -> Vec<(usize, usize, crate::syntax::TokenType)> {
        let line_end = byte_offset + line_len;
        highlights
            .iter()
            .filter_map(|h| {
                if h.start < line_end && h.end > byte_offset {
                    Some((h.start, h.end, h.token_type))
                } else {
                    None
                }
            })
            .collect()
    }

    fn apply_highlights(
        &self,
        line_highlights: &[(usize, usize, crate::syntax::TokenType)],
        byte_offset: usize,
        ctx: &HighlightContext,
    ) -> Vec<Span<'_>> {
        let chars: Vec<char> = ctx.line_content.chars().collect();
        let mut spans = Vec::new();

        let mut relative_byte = 0;
        for (char_idx, ch) in chars.iter().enumerate() {
            let char_byte_start = byte_offset + relative_byte;
            let char_byte_end = char_byte_start + ch.len_utf8();
            relative_byte += ch.len_utf8();

            let color =
                self.get_char_color(char_byte_start, char_byte_end, line_highlights, ctx.theme);

            if ctx.show_cursor && char_idx == ctx.cursor_col {
                // Cursor character - bright highlight
                spans.push(Span::styled(
                    ch.to_string(),
                    Style::default()
                        .bg(ctx.theme.editor_cursor_char_bg)
                        .fg(ctx.theme.editor_cursor_char_fg)
                        .add_modifier(Modifier::BOLD),
                ));
            } else {
                // Normal character
                spans.push(Span::styled(ch.to_string(), Style::default().fg(color)));
            }
        }

        if ctx.show_cursor && ctx.cursor_col >= chars.len() {
            spans.push(Span::styled(
                " ",
                Style::default()
                    .bg(ctx.theme.editor_cursor_char_bg)
                    .fg(ctx.theme.editor_cursor_char_fg)
                    .add_modifier(Modifier::BOLD),
            ));
        }

        spans
    }

    fn get_char_color(
        &self,
        char_byte_start: usize,
        char_byte_end: usize,
        line_highlights: &[(usize, usize, crate::syntax::TokenType)],
        theme: &Theme,
    ) -> Color {
        line_highlights
            .iter()
            .find(|h| char_byte_start >= h.0 && char_byte_end <= h.1)
            .map(|h| h.2.color(theme))
            .unwrap_or(theme.syntax_variable) // Use theme color instead of Color::White
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::syntax::{HighlightSpan, TokenType};
    use ratatui::{backend::TestBackend, buffer::Buffer, style::Modifier, Terminal};

    fn highlight(start: usize, end: usize, token_type: TokenType) -> HighlightSpan {
        HighlightSpan {
            start,
            end,
            token_type,
        }
    }

    fn render_buffer(engine: &AnimationEngine, theme: &Theme, width: u16, height: u16) -> Buffer {
        let backend = TestBackend::new(width, height);
        let mut terminal = Terminal::new(backend).unwrap();
        terminal
            .draw(|f| EditorPane.render(f, Rect::new(0, 0, width, height), engine, theme))
            .unwrap();
        terminal.backend().buffer().clone()
    }

    fn row_symbols(buffer: &Buffer, y: u16) -> String {
        (0..buffer.area.width)
            .map(|x| buffer[(x, y)].symbol())
            .collect::<Vec<_>>()
            .join("")
    }

    fn has_selected_row_background(buffer: &Buffer, selected_bg: Color) -> bool {
        (0..buffer.area.height)
            .flat_map(|y| (0..buffer.area.width).map(move |x| buffer[(x, y)].bg))
            .any(|bg| bg == selected_bg)
    }

    #[test]
    fn render_shows_scrolled_highlighted_lines_and_selected_row_backgr
```

### Core Architecture Module: `src/panes/file_tree.rs`
```
use std::collections::BTreeMap;

use ratatui::{
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Padding},
    Frame,
};

use crate::git::{CommitMetadata, LineChangeType};
use crate::theme::Theme;
use crate::widgets::SelectableParagraph;

type FileEntry = (usize, String, String, Color, usize, usize);
type FileTree = BTreeMap<String, Vec<FileEntry>>;

pub struct FileTreePane {
    cached_lines: Vec<Line<'static>>,
    cached_current_line_index: Option<usize>,
    cached_metadata_id: Option<String>,
    cached_current_file_index: Option<usize>,
}

impl FileTreePane {
    pub fn new() -> Self {
        Self {
            cached_lines: vec![Line::from("No commit loaded")],
            cached_current_line_index: None,
            cached_metadata_id: None,
            cached_current_file_index: None,
        }
    }

    pub fn set_commit_metadata(
        &mut self,
        metadata: &CommitMetadata,
        current_file_index: usize,
        theme: &Theme,
    ) {
        let metadata_id = metadata.hash.clone();

        // Only recalculate if metadata or current file changed
        if self.cached_metadata_id.as_ref() == Some(&metadata_id)
            && self.cached_current_file_index == Some(current_file_index)
        {
            return;
        }

        let (lines, current_line_index) =
            Self::build_tree_lines(metadata, current_file_index, theme);

        self.cached_lines = lines;
        self.cached_current_line_index = current_line_index;
        self.cached_metadata_id = Some(metadata_id);
        self.cached_current_file_index = Some(current_file_index);
    }

    pub fn render(&self, f: &mut Frame, area: Rect, theme: &Theme) {
        let block = Block::default()
            .style(Style::default().bg(theme.background_left))
            .padding(Padding {
                left: 0,
                right: 0,
                top: 1,
                bottom: 1,
            });

        let content = SelectableParagraph::new(self.cached_lines.clone())
            .block(block)
            .selected_line(self.cached_current_line_index)
            .selected_style(Style::default().bg(theme.file_tree_current_file_bg))
            .background_style(Style::default().bg(theme.background_left))
            .padding(Padding::horizontal(2))
            .dim(20, 0.6);
        f.render_widget(content, area);
    }

    fn build_tree_lines(
        metadata: &CommitMetadata,
        current_file_index: usize,
        theme: &Theme,
    ) -> (Vec<Line<'static>>, Option<usize>) {
        // Build directory tree
        let mut tree: FileTree = BTreeMap::new();

        for (index, change) in metadata.changes.iter().enumerate() {
            let (status_char, color) = match change.status.as_str() {
                "A" => ("+", theme.file_tree_added),
                "D" => ("-", theme.file_tree_deleted),
                "M" => ("~", theme.file_tree_modified),
                "R" => (">", theme.file_tree_renamed),
                _ => (" ", theme.file_tree_default),
            };

            // Count additions and deletions
            let mut additions = 0;
            let mut deletions = 0;
            for hunk in &change.hunks {
                for line in &hunk.lines {
                    match line.change_type {
                        LineChangeType::Addition => additions += 1,
                        LineChangeType::Deletion => deletions += 1,
                        _ => {}
                    }
                }
            }

            let parts: Vec<&str> = change.path.split('/').collect();
            if parts.len() == 1 {
                // Root level file
                tree.entry("".to_string()).or_default().push((
                    index,
                    change.path.clone(),
                    status_char.to_string(),
                    color,
                    additions,
                    deletions,
                ));
            } else {
                // File in directory
                let dir = parts[..parts.len() - 1].join("/");
                let filename = parts[parts.len() - 1].to_string();
                tree.entry(dir).or_default().push((
                    index,
                    filename,
                    status_char.to_string(),
                    color,
                    additions,
                    deletions,
                ));
            }
        }

        let mut lines = Vec::new();
        let mut current_line_index = None;
        let sorted_dirs: Vec<_> = tree.keys().cloned().collect();

        for dir in sorted_dirs {
            let mut files = tree.get(&dir).unwrap().clone();
            // Sort files by filename within each directory
            files.sort_by(|a, b| a.1.cmp(&b.1));

            // Add directory header if not root
            if !dir.is_empty() {
                let dir_text = format!("{}/", dir);
                let dir_spans = vec![Span::styled(
                    dir_text,
                    Style::default()
                        .fg(theme.file_tree_directory)
                        .add_modifier(Modifier::BOLD),
                )];
                lines.push(Line::from(dir_spans));
            }

            // Add files
            for (index, filename, status_char, color, additions, deletions) in &files {
                let is_current = *index == current_file_index;

                // Track the line index of the current file (before adding the line)
                if is_current {
                    current_line_index = Some(lines.len());
                }

                let indent = if dir.is_empty() { "" } else { "  " }.to_string();
                let status_str = format!("{} ", status_char);
                let additions_str = format!(" +{}", additions);
                let deletions_str = format!(" -{}", deletions);

                let fg_color = if is_current {
                    theme.file_tree_current_file_fg
                } else {
                    theme.file_tree_default
                };

                let modifier = if is_current {
                    Modifier::BOLD
                } else {
                    Modifier::empty()
                };

                let spans = vec![
                    Span::raw(indent),
                    Span::styled(
                        status_str,
                        Style::default().fg(*color).add_modifier(Modifier::BOLD),
                    ),
                    Span::styled(
                        filename.to_string(),
                        Style::default().fg(fg_color).add_modifier(modifier),
                    ),
                    Span::styled(
                        additions_str,
                        Style::default().fg(theme.file_tree_stats_added),
                    ),
                    Span::styled(
                        deletions_str,
                        Style::default().fg(theme.file_tree_stats_deleted),
                    ),
                ];

                lines.push(Line::from(spans));
            }
        }

        (lines, current_line_index)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{DateTime, Utc};
    use ratatui::{backend::TestBackend, buffer::Buffer, Terminal};

    use crate::git::{DiffHunk, FileChange, FileStatus, LineChange, LineChangeType};

    fn change(change_type: LineChangeType) -> LineChange {
        LineChange {
            change_type,
            content: String::new(),
            old_line_no: None,
            new_line_no: None,
        }
    }

    fn hunk(lines: &[LineChangeType]) -> DiffHunk {
        DiffHunk {
            old_start: 1,
            old_lines: 0,
            new_start: 1,
            new_lines: 0,
            lines: lines.iter().cloned().map(change).collect(),
        }
    }

    fn file_change(path: &str, status: FileStatus, lines: &[LineChangeType]) -> FileChange {
        FileChange {
            path: path.to_string(),
            old_path: None,
            status,
            is_binary: false,
            is_excluded: false,
            exclusion_reason: None,
            old_content: None,
            new_content: None,
            hunks: vec![hunk(lines)],
            diff: String::new(),
        }
    }

    fn metadata(changes: Vec<FileChange>) -> CommitMetadata {
        CommitMetadata {
            hash: "deadbeef".to_string(),
            author: "Author".to_string(),
            date: DateTime::from_timestamp(0, 0).unwrap().with_timezone(&Utc),
            message: "message".to_string(),
            changes,
        }
    }

    fn render_buffer(pane: &FileTreePane, theme: &Theme, width: u16, height: u16) -> Buffer {
        let backend = TestBackend::new(width, height);
        let mut terminal = Terminal::new(backend).unwrap();
        terminal
            .draw(|f| pane.render(f, Rect::new(0, 0, width, height), theme))
            .unwrap();
        terminal.backend().buffer().clone()
    }

    fn row_symbols(buffer: &Buffer, y: u16) -> String {
        (0..buffer.area.width)
            .map(|x| buffer[(x, y)].symbol())
            .collect::<Vec<_>>()
            .join("")
    }

    #[test]
    fn build_tree_lines_groups_and_sorts_files_with_stats() {
        let theme = Theme::default();
        let metadata = metadata(vec![
            file_change(
                "src/zeta.rs",
                FileStatus::Modified,
                &[
                    LineChangeType::Addition,
                    LineChangeType::Context,
                    LineChangeType::Deletion,
                    LineChangeType::Addition,
                ],
            ),
            file_change("README.md", FileStatus::Added, &[LineChangeType::Addition]),
            file_change(
                "src/alpha.rs",
                FileStatus::Deleted,
                &[LineChangeType::Deletion, LineChangeType::Deletion],
            ),
        ]);

        let (lines, current_line
```

### Core Architecture Module: `src/panes/mod.rs`
```
mod editor;
mod file_tree;
mod status_bar;
mod terminal;

pub use editor::EditorPane;
pub use file_tree::FileTreePane;
pub use status_bar::StatusBarPane;
pub use terminal::TerminalPane;

```

### Core Architecture Module: `src/panes/status_bar.rs`
```
use ratatui::{
    layout::Rect,
    style::Style,
    text::{Line, Span},
    widgets::{Block, Padding},
    Frame,
};

use crate::git::CommitMetadata;
use crate::theme::Theme;
use crate::widgets::SelectableParagraph;

pub struct StatusBarPane;

impl StatusBarPane {
    pub fn render(
        &self,
        f: &mut Frame,
        area: Rect,
        metadata: Option<&CommitMetadata>,
        theme: &Theme,
    ) {
        let block = Block::default()
            .style(Style::default().bg(theme.background_left))
            .padding(Padding::vertical(1));

        let status_lines = if let Some(meta) = metadata {
            let is_working_tree = meta.hash == "working-tree";
            let hash_display = if is_working_tree {
                "working"
            } else {
                &meta.hash[..7.min(meta.hash.len())]
            };

            let mut lines = vec![
                Line::from(vec![
                    Span::raw("hash: "),
                    Span::styled(hash_display, Style::default().fg(theme.status_hash)),
                ]),
                Line::from(vec![
                    Span::raw("author: "),
                    Span::styled(&meta.author, Style::default().fg(theme.status_author)),
                ]),
            ];

            // Only show date for actual commits (not working tree)
            if !is_working_tree {
                let date_str = meta.date.format("%Y-%m-%d %H:%M:%S").to_string();
                lines.push(Line::from(vec![
                    Span::raw("date: "),
                    Span::styled(date_str, Style::default().fg(theme.status_date)),
                ]));
            }

            // Add commit message lines (skip empty lines)
            for msg_line in meta.message.lines() {
                if !msg_line.trim().is_empty() {
                    lines.push(Line::from(vec![Span::styled(
                        msg_line,
                        Style::default().fg(theme.status_message),
                    )]));
                }
            }

            lines
        } else {
            vec![Line::from(vec![Span::styled(
                "No commit loaded",
                Style::default().fg(theme.status_no_commit),
            )])]
        };

        let content = SelectableParagraph::new(status_lines)
            .block(block)
            .background_style(Style::default().bg(theme.background_left))
            .padding(Padding::horizontal(2));

        f.render_widget(content, area);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{DateTime, Utc};
    use ratatui::{backend::TestBackend, buffer::Buffer, Terminal};

    fn metadata(hash: &str, message: &str) -> CommitMetadata {
        CommitMetadata {
            hash: hash.to_string(),
            author: "Author".to_string(),
            date: DateTime::from_timestamp(1_704_067_200, 0)
                .unwrap()
                .with_timezone(&Utc),
            message: message.to_string(),
            changes: vec![],
        }
    }

    fn render_buffer(
        metadata: Option<&CommitMetadata>,
        theme: &Theme,
        width: u16,
        height: u16,
    ) -> Buffer {
        let backend = TestBackend::new(width, height);
        let mut terminal = Terminal::new(backend).unwrap();
        terminal
            .draw(|f| StatusBarPane.render(f, Rect::new(0, 0, width, height), metadata, theme))
            .unwrap();
        terminal.backend().buffer().clone()
    }

    fn row_symbols(buffer: &Buffer, y: u16) -> String {
        (0..buffer.area.width)
            .map(|x| buffer[(x, y)].symbol())
            .collect::<Vec<_>>()
            .join("")
    }

    #[test]
    fn render_shows_placeholder_when_no_commit_is_loaded() {
        let theme = Theme::default();
        let buffer = render_buffer(None, &theme, 24, 4);

        assert!(row_symbols(&buffer, 1).contains("No commit loaded"));
        assert_eq!(buffer[(2, 1)].fg, theme.status_no_commit);
        assert_eq!(buffer[(0, 1)].bg, theme.background_left);
    }

    #[test]
    fn render_formats_regular_commit_with_short_hash_and_date() {
        let theme = Theme::default();
        let metadata = metadata("1234567890abcdef", "subject line");
        let buffer = render_buffer(Some(&metadata), &theme, 32, 6);

        assert!(row_symbols(&buffer, 1).contains("hash: 1234567"));
        assert!(row_symbols(&buffer, 2).contains("author: Author"));
        assert!(row_symbols(&buffer, 3).contains("date: 2024-01-01 00:00:00"));
        assert!(row_symbols(&buffer, 4).contains("subject line"));
        assert_eq!(buffer[(8, 1)].fg, theme.status_hash);
        assert_eq!(buffer[(10, 2)].fg, theme.status_author);
        assert_eq!(buffer[(8, 3)].fg, theme.status_date);
        assert_eq!(buffer[(2, 4)].fg, theme.status_message);
    }

    #[test]
    fn render_working_tree_omits_date_and_skips_blank_message_lines() {
        let theme = Theme::default();
        let metadata = metadata("working-tree", "subject line\n\nbody line");
        let buffer = render_buffer(Some(&metadata), &theme, 32, 6);

        assert!(row_symbols(&buffer, 1).contains("hash: working"));
        assert!(row_symbols(&buffer, 2).contains("author: Author"));
        assert!(row_symbols(&buffer, 3).contains("subject line"));
        assert!(row_symbols(&buffer, 4).contains("body line"));
        assert!(!row_symbols(&buffer, 3).contains("date:"));
        assert_eq!(buffer[(8, 1)].fg, theme.status_hash);
        assert_eq!(buffer[(2, 3)].fg, theme.status_message);
        assert_eq!(buffer[(2, 4)].fg, theme.status_message);
    }
}

```

### Core Architecture Module: `src/panes/terminal.rs`
```
use ratatui::{
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Padding},
    Frame,
};

use crate::animation::{ActivePane, AnimationEngine};
use crate::theme::Theme;
use crate::widgets::SelectableParagraph;

pub struct TerminalPane;

impl TerminalPane {
    pub fn render(&self, f: &mut Frame, area: Rect, engine: &AnimationEngine, theme: &Theme) {
        let block = Block::default()
            .style(Style::default().bg(theme.background_right))
            .padding(Padding::vertical(1));

        // Get visible lines based on area height (subtract padding)
        let content_height = area.height.saturating_sub(2) as usize; // Subtract top and bottom padding
        let total_lines = engine.terminal_lines.len();

        let lines: Vec<Line> = if total_lines > 0 {
            let start_idx = total_lines.saturating_sub(content_height);
            engine.terminal_lines[start_idx..]
                .iter()
                .enumerate()
                .map(|(idx, line)| {
                    let is_last_line = start_idx + idx == total_lines - 1;
                    let show_cursor = is_last_line
                        && engine.cursor_visible
                        && engine.active_pane == ActivePane::Terminal;

                    if line.starts_with("~ ") {
                        // Command line
                        if show_cursor {
                            // Add cursor at the end of the line
                            let mut spans = vec![Span::styled(
                                line.clone(),
                                Style::default().fg(theme.terminal_command),
                            )];
                            spans.push(Span::styled(
                                " ",
                                Style::default()
                                    .bg(theme.terminal_cursor_bg)
                                    .fg(theme.terminal_cursor_fg)
                                    .add_modifier(Modifier::BOLD),
                            ));
                            Line::from(spans)
                        } else {
                            Line::from(vec![Span::styled(
                                line.clone(),
                                Style::default().fg(theme.terminal_command),
                            )])
                        }
                    } else {
                        // Output line - normal style
                        Line::from(vec![Span::styled(
                            line.clone(),
                            Style::default().fg(theme.terminal_output),
                        )])
                    }
                })
                .collect()
        } else {
            vec![Line::from("")]
        };

        let content = SelectableParagraph::new(lines)
            .block(block)
            .background_style(Style::default().bg(theme.background_right))
            .padding(Padding::horizontal(2));
        f.render_widget(content, area);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::{backend::TestBackend, buffer::Buffer, Terminal};

    fn render_buffer(engine: &AnimationEngine, theme: &Theme, width: u16, height: u16) -> Buffer {
        let backend = TestBackend::new(width, height);
        let mut terminal = Terminal::new(backend).unwrap();
        terminal
            .draw(|f| TerminalPane.render(f, Rect::new(0, 0, width, height), engine, theme))
            .unwrap();
        terminal.backend().buffer().clone()
    }

    fn row_symbols(buffer: &Buffer, y: u16) -> String {
        (0..buffer.area.width)
            .map(|x| buffer[(x, y)].symbol())
            .collect::<Vec<_>>()
            .join("")
    }

    #[test]
    fn render_keeps_last_visible_lines_and_draws_cursor_on_active_command() {
        let theme = Theme::default();
        let mut engine = AnimationEngine::new(16);
        engine.terminal_lines = vec![
            "old output".to_string(),
            "~ git status".to_string(),
            " M src/main.rs".to_string(),
            "~ cargo test".to_string(),
        ];
        engine.cursor_visible = true;
        engine.active_pane = ActivePane::Terminal;

        let buffer = render_buffer(&engine, &theme, 24, 5);

        assert!(!row_symbols(&buffer, 1).contains("old output"));
        assert!(row_symbols(&buffer, 1).contains("~ git status"));
        assert!(row_symbols(&buffer, 2).contains(" M src/main.rs"));
        assert!(row_symbols(&buffer, 3).contains("~ cargo test"));
        assert_eq!(buffer[(2, 1)].fg, theme.terminal_command);
        assert_eq!(buffer[(2, 2)].fg, theme.terminal_output);

        let cursor_x = 2 + "~ cargo test".len() as u16;
        assert_eq!(buffer[(cursor_x, 3)].symbol(), " ");
        assert_eq!(buffer[(cursor_x, 3)].bg, theme.terminal_cursor_bg);
        assert_eq!(buffer[(cursor_x, 3)].fg, theme.terminal_cursor_fg);
    }

    #[test]
    fn render_shows_empty_terminal_placeholder_line() {
        let theme = Theme::default();
        let engine = AnimationEngine::new(16);
        let buffer = render_buffer(&engine, &theme, 16, 4);

        assert_eq!(row_symbols(&buffer, 1), "                ");
        assert_eq!(buffer[(0, 1)].bg, theme.background_right);
        assert_eq!(buffer[(15, 1)].bg, theme.background_right);
    }
}

```

### Core Architecture Module: `src/syntax/languages/astro.rs`
```
pub fn language() -> tree_sitter::Language {
    tree_sitter_astro_next::LANGUAGE.into()
}

pub const HIGHLIGHT_QUERY: &str = tree_sitter_astro_next::HIGHLIGHTS_QUERY;

pub const INJECTION_QUERY: &str = tree_sitter_astro_next::INJECTIONS_QUERY;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #86** (2025-11-26): **bug: Wrong words in field displaying git actions / commits**
  *Symptoms*: Initial message:   <img width="251" height="20" alt="Image" src="https://github.com/user-attachments/assets/8b36e876-2dcb-48b4-9120-a31a99ba19ff" />  Then, once done with the commit, it proceeds to show the n+1 commit, but the "arrived at" message looks like this:   <img width="267" height="20" alt="Image" src="https://github.com/user-attachments/assets/076d68fc-6fbc-4e14-a2a6-1e56f796679a" />  Other variants I have encountered had a "t" instead of i.  Is this intentional? The gif does not show this issue.  Also noticed that the "via satellite" is shown like this:   <img width="132" height="24" alt="Image" src="https://github.com/user-attachments/assets/2178e63b-fcad-4921-8247-f2c41b7d13dd" />  This was run on Windows 11, using the 0.3 release 
  **Post-Mortem & Fix Analysis**:
  > <p><a href="https://linear.app/unhappychoice/issue/E-688/wrong-words-in-field-displaying-git-actions-commits">E-688</a></p>
  > Thanks for reporting this issue! I've investigated the character rendering problem you're experiencing.  ## Investigation Summary  I analyzed the codebase and verified that: - ✅ All text processing uses **character-based** (not byte-based) calculations - ✅ The `unicode-width` crate correctly calculates `🕰️` as width 2 - ✅ The `unicode-segmentation` crate correctly treats `🕰️` (emoji + variation selector) as a single grapheme - ✅ `ratatui` properly allocates 2 cells for wide characters  The character corruption you're seeing is likely **not a bug in gitlogue's code**, but rather an incompatibility between the terminal environment and emoji rendering.  ## To Help Debug This Issue  Could you please provide the following information:  1. **Which terminal are you using?**    - Windows Terminal (recommended)    - cmd.exe    - PowerShell    - Other (please specify)  2. **Terminal version:**    - If using Windows Terminal, run: `wt --version`  3. **Font settings:**    - What font is configur
  > Hi,   thanks for the reply. I'll get back to you with the requested data tomorrow, as I only use windows at work

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

### Incident Patch 1: `3b7f3721` (2026-10-01)
**Commit Message**: fix: respect pause and detached checkouts in watch mode

- Do not advance to the next queued commit while playback is paused,
  and keep the paused state from falling through to the non-watch
  waiting branch
- Do not replay commits when HEAD returns to an unchanged branch tip
  after a detached checkout, while still replaying commits rebased
  while detached

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/ui.rs` (modified, +81/-1)
```diff
@@ -514,7 +514,9 @@ impl<'a> UI<'a> {
 
         match self.state {
             UIState::Playing if self.engine.is_finished() && self.watcher.is_some() => {
-                self.advance_to_next_commit();
+                if self.playback_state != PlaybackState::Paused {
+                    self.advance_to_next_commit();
+                }
             }
             UIState::Watching if self.playback_state != PlaybackState::Paused => {
                 self.play_next_watched_commit();
@@ -1839,6 +1841,84 @@ mod tests {
         assert_eq!(ui.history.last().unwrap().hash, next);
     }
 
+    #[test]
+    fn watch_mode_ignores_return_from_detached_checkout() {
+        let test_repo = TestRepo::new();
+        let ancestor =
+            test_repo.commit_file("src/lib.rs", "fn old() {}\n", "ancestor", 1_700_000_000);
+        test_repo.commit_file("src/lib.rs", "fn tip() {}\n", "tip", 1_700_000_060);
+        let branch = test_repo.repo.head().unwrap().name().unwrap().to_string();
+        let repo = GitRepository::open(&test_repo.path).unwrap();
+        let now = Instant::now();
+        let mut ui = watch_ui(&repo, now);
+
+        test_repo
+            .repo
+            .set_head_detached(git2::Oid::from_str(&ancestor).unwrap())
+            .unwrap();
+        ui.advance_state_after_tick(now + Duration::from_secs(2));
+        test_repo.repo.set_head(&branch).unwrap();
+        ui.advance_state_after_tick(now + Duration::from_secs(4));
+
+        assert_eq!(ui.state, UIState::Watching);
+        assert!(ui.history.is_empty());
+    }
+
+    #[test]
+    fn watch_mode_replays_commits_rebased_while_detached() {
+        let test_repo = TestRepo::new();
+        let tip = test_repo.commit_file("src/lib.rs", "fn old() {}\n", "tip", 1_700_000_000);
+        let branch = test_repo.repo.head().unwrap().name().unwrap().to_string();
+        let repo = GitRepository::open(&test_repo.path).unwrap();
+        let now = Instant::now();
+        let mut ui = watch_ui(&repo, now);
+
+        test_repo
+            .repo
+            .set_head_detached(git2::Oid::from_str(&tip).unwrap())
+            .unwrap();
+        ui.advance_state_after_tick(now + Duration::from_secs(2));
+        let rebased =
+            test_repo.commit_file("src/lib.rs", "fn rebased() {}\n", "rebased", 1_700_000_060);
+        test_repo
+            .repo
+            .reference(
+                &branch,
+                git2::Oid::from_str(&rebased).unwrap(),
+                true,
+                "rebase",
+            )
+            .unwrap();
+        test_repo.repo.set_head(&branch).unwrap();
+        ui.advance_state_after_tick(now + Duration::from_secs(4));
+
+        assert_eq!(ui.state, UIState::Playing);
+        assert_eq!(ui.history.last().unwrap().hash, rebased);
+    }
+
+    #[test]
+    fn watch_mode_does_not_advance_to_queued_commit_while_paused() {
+        let test_repo = TestRepo::new();
+        test_repo.commit_file("src/lib.rs", "fn old() {}\n", "existing", 1_700_000_000);
+        let repo = GitRepository::open(&test_repo.path).unwrap();
+        let now = Instant::now();
+        let mut ui = watch_ui(&repo, now);
+        test_repo.commit_file("src/lib.rs", "fn first() {}\n", "first", 1_700_000_060);
+        let second =
+            test_repo.commit_file("src/lib.rs", "fn second() {}\n", "second", 1_700_000_120);
+        ui.advance_state_after_tick(now + Duration::from_secs(2));
+
+        ui.toggle_pause();
+        finish_playback(&mut ui);
+        ui.advance_state_after_tick(now + Duration::from_secs(2));
+        assert_eq!(ui.state, UIState::Playing);
+        assert_eq!(ui.history.len(), 1);
+
+        ui.toggle_pause();
+        ui.advance_state_after_tick(now + Duration::from_secs(2));
+        assert_eq!(ui.history.last().unwrap().hash, second);
+    }
+
     #[test]
     fn watch_mode_does_not_start_new_commit_while_paused() {
         let test_repo = TestRepo::new();
```

**File**: `src/watch.rs` (modified, +51/-9)
```diff
@@ -13,6 +13,8 @@ const MAX_SPEED_MULTIPLIER: f64 = 10.0;
 pub struct CommitWatcher {
     last_head: Option<String>,
     last_branch: Option<String>,
+    /// Branch and its tip recorded when HEAD became detached.
+    detached_from: Option<(String, Option<String>)>,
     pending: VecDeque<String>,
     next_poll: Instant,
 }
@@ -22,6 +24,7 @@ impl CommitWatcher {
         Self {
             last_head: repo.head_commit_id(),
             last_branch: repo.head_branch_name(),
+            detached_from: None,
             pending: VecDeque::new(),
             next_poll: now + POLL_INTERVAL,
         }
@@ -46,10 +49,10 @@ impl CommitWatcher {
     }
 
     fn check_head(&mut self, repo: &GitRepository) {
-        let branch_switched = self.update_branch(repo.head_branch_name());
         let Some(head) = repo.head_commit_id() else {
             return;
         };
+        let branch_switched = self.update_branch(repo.head_branch_name(), &head);
         if branch_switched || self.last_head.as_deref() == Some(head.as_str()) {
             self.last_head = Some(head);
             return;
@@ -61,18 +64,33 @@ impl CommitWatcher {
         self.last_head = Some(head);
     }
 
-    /// Records the checked-out branch and reports whether it changed.
-    /// Detached HEAD (e.g. mid-rebase) is ignored so rebased commits are still replayed.
-    fn update_branch(&mut self, branch: Option<String>) -> bool {
+    /// Records the checked-out branch and reports whether HEAD moved without new commits:
+    /// a switch to another branch, or a return to an unchanged branch after a detached checkout.
+    /// Detached HEAD itself (e.g. mid-rebase) is ignored so rebased commits are still replayed.
+    fn update_branch(&mut self, branch: Option<String>, head: &str) -> bool {
         let Some(branch) = branch else {
+            self.remember_detached_tip();
             return false;
         };
+        let returned_unchanged = self
+            .detached_from
+            .take()
+            .is_some_and(|(detached, tip)| detached == branch && tip.as_deref() == Some(head));
         let switched = self
             .last_branch
             .as_ref()
             .is_some_and(|last| *last != branch);
         self.last_branch = Some(branch);
-        switched
+        switched || returned_unchanged
+    }
+
+    fn remember_detached_tip(&mut self) {
+        if self.detached_from.is_none() {
+            self.detached_from = self
+                .last_branch
+                .clone()
+                .map(|branch| (branch, self.last_head.clone()));
+        }
     }
 
     fn enqueue(&mut self, commits: Vec<String>) {
@@ -96,6 +114,7 @@ mod tests {
         CommitWatcher {
             last_head: None,
             last_branch: None,
+            detached_from: None,
             pending: pending.iter().map(|hash| hash.to_string()).collect(),
             next_poll: Instant::now(),
         }
@@ -129,10 +148,33 @@ mod tests {
     fn update_branch_reports_switch_only_between_named_branches() {
         let mut watcher = watcher_with_pending(&[]);
 
-        assert!(!watcher.update_branch(Some("main".to_string())));
-        assert!(!watcher.update_branch(None));
-        assert!(!watcher.update_branch(Some("main".to_string())));
-        assert!(watcher.update_branch(Some("feature".to_string())));
+        assert!(!watcher.update_branch(Some("main".to_string()), "a"));
+        assert!(!watcher.update_branch(None, "b"));
+        assert!(!watcher.update_branch(Some("main".to_string()), "c"));
+        assert!(watcher.update_branch(Some("feature".to_string()), "c"));
+    }
+
+    #[test]
+    fn update_branch_reports_return_to_unchanged_tip_after_detaching() {
+        let mut watcher = watcher_with_pending(&[]);
+        watcher.last_branch = Some("main".to_string());
+        watcher.last_head = Some("tip".to_string());
+
+        assert!(!watcher.update_branch(None, "ancestor"));
+        watcher.last_head = Some("ancestor".to_string());
+
+        assert!(watcher.update_branch(Some("main".to_string()), "tip"));
+    }
+
+    #[test]
+    fn update_branch_keeps_replaying_when_branch_tip_changed_while_detached() {
+        let mut watcher = watcher_with_pending(&[]);
+        watcher.last_branch = Some("main".to_string());
+        watcher.last_head = Some("tip".to_string());
+
+        assert!(!watcher.update_branch(None, "onto"));
+
+        assert!(!watcher.update_branch(Some("main".to_string()), "rebased"));
     }
 
     #[test]
```

---

### Incident Patch 2: `8a7158b4` (2026-10-01)
**Commit Message**: fix: redraw when UI state changes without animation progress

The run loop only redrew when the animation engine advanced, so the
initial watch screen and the startup HEAD display could stay blank.
Force a redraw on the first frame, after showing the startup HEAD, and
after any terminal event.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/ui.rs` (modified, +18/-1)
```diff
@@ -66,6 +66,7 @@ pub struct UI<'a> {
     menu_index: usize,
     prev_state: Option<Box<UIState>>,
     watcher: Option<CommitWatcher>,
+    force_redraw: bool,
 }
 
 impl<'a> UI<'a> {
@@ -133,6 +134,7 @@ impl<'a> UI<'a> {
             menu_index: 0,
             prev_state: None,
             watcher: None,
+            force_redraw: true,
         }
     }
 
@@ -410,6 +412,7 @@ impl<'a> UI<'a> {
         };
         self.engine.load_commit(&metadata);
         while self.engine.manual_step(StepMode::Change) {}
+        self.force_redraw = true;
     }
 
     fn poll_watcher(&mut self, now: Instant) {
@@ -569,6 +572,7 @@ impl<'a> UI<'a> {
     }
 
     fn handle_event(&mut self, event: Event) {
+        self.force_redraw = true;
         if let Event::Key(key) = event {
             self.handle_key_event(key);
         }
@@ -633,7 +637,7 @@ impl<'a> UI<'a> {
             self.sync_exit_state();
 
             self.update_viewport(terminal.size()?.into());
-            let needs_redraw = self.engine.tick();
+            let needs_redraw = self.engine.tick() | std::mem::take(&mut self.force_redraw);
             self.draw_if_needed(terminal, needs_redraw)?;
             self.handle_pending_event(&mut poll, &mut read)?;
 
@@ -1760,6 +1764,18 @@ mod tests {
         while ui.engine.manual_step(StepMode::Change) {}
     }
 
+    #[test]
+    fn run_loop_draws_first_frame_even_without_animation_progress() {
+        let mut ui = test_ui();
+        ui.state = UIState::Watching;
+        let mut terminal = Terminal::new(TestBackend::new(100, 30)).unwrap();
+
+        ui.run_loop_with(&mut terminal, |_| Ok(true), quit_event, Instant::now)
+            .unwrap();
+
+        assert!(buffer_text(terminal.backend().buffer()).contains("Watching for new commits..."));
+    }
+
     #[test]
     fn watch_mode_shows_head_in_final_state_without_playing_it() {
         let test_repo = TestRepo::new();
@@ -1774,6 +1790,7 @@ mod tests {
         assert!(ui.history.is_empty());
         assert!(ui.engine.is_finished());
         assert_eq!(ui.engine.current_metadata().unwrap().hash, head);
+        assert!(ui.force_redraw);
     }
 
     #[test]
```

---

### Incident Patch 3: `8975613a` (2026-09-07)
**Commit Message**: Merge pull request #238 from unhappychoice/fix/release-curl-http-status

fix(ci): fail Homebrew SHA step on HTTP errors

**File**: `.github/workflows/release.yml` (modified, +10/-4)
```diff
@@ -255,19 +255,25 @@ jobs:
 
       - name: Update Homebrew formula
         run: |
+          set -euo pipefail
+
+          fetch_sha() {
+            curl -fsSL --retry 3 --retry-delay 5 "$1" | sha256sum | cut -d' ' -f1
+          }
+
           VERSION=${{ needs.release.outputs.new_version }}
 
           MACOS_INTEL_URL="https://github.com/unhappychoice/gitlogue/releases/download/$VERSION/gitlogue-$VERSION-x86_64-apple-darwin.tar.gz"
-          MACOS_INTEL_SHA=$(curl -sL "$MACOS_INTEL_URL" | sha256sum | cut -d' ' -f1)
+          MACOS_INTEL_SHA=$(fetch_sha "$MACOS_INTEL_URL")
 
           MACOS_ARM_URL="https://github.com/unhappychoice/gitlogue/releases/download/$VERSION/gitlogue-$VERSION-aarch64-apple-darwin.tar.gz"
-          MACOS_ARM_SHA=$(curl -sL "$MACOS_ARM_URL" | sha256sum | cut -d' ' -f1)
+          MACOS_ARM_SHA=$(fetch_sha "$MACOS_ARM_URL")
 
           LINUX_INTEL_URL="https://github.com/unhappychoice/gitlogue/releases/download/$VERSION/gitlogue-$VERSION-x86_64-unknown-linux-gnu.tar.gz"
-          LINUX_INTEL_SHA=$(curl -sL "$LINUX_INTEL_URL" | sha256sum | cut -d' ' -f1)
+          LINUX_INTEL_SHA=$(fetch_sha "$LINUX_INTEL_URL")
 
           LINUX_ARM_URL="https://github.com/unhappychoice/gitlogue/releases/download/$VERSION/gitlogue-$VERSION-aarch64-unknown-linux-gnu.tar.gz"
-          LINUX_ARM_SHA=$(curl -sL "$LINUX_ARM_URL" | sha256sum | cut -d' ' -f1)
+          LINUX_ARM_SHA=$(fetch_sha "$LINUX_ARM_URL")
 
           echo "Calculated SHAs:"
           echo "macOS Intel: $MACOS_INTEL_SHA"
```

---

### Incident Patch 4: `9a27f93c` (2026-09-07)
**Commit Message**: fix(ci): fail Homebrew SHA step on HTTP errors

curl -sL exits 0 on a 404, so sha256sum digested the error body and the
formula was updated with a bogus SHA while the job stayed green. Use
curl -f with set -o pipefail so a missing asset aborts the step.

Closes #236

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +10/-4)
```diff
@@ -255,19 +255,25 @@ jobs:
 
       - name: Update Homebrew formula
         run: |
+          set -euo pipefail
+
+          fetch_sha() {
+            curl -fsSL --retry 3 --retry-delay 5 "$1" | sha256sum | cut -d' ' -f1
+          }
+
           VERSION=${{ needs.release.outputs.new_version }}
 
           MACOS_INTEL_URL="https://github.com/unhappychoice/gitlogue/releases/download/$VERSION/gitlogue-$VERSION-x86_64-apple-darwin.tar.gz"
-          MACOS_INTEL_SHA=$(curl -sL "$MACOS_INTEL_URL" | sha256sum | cut -d' ' -f1)
+          MACOS_INTEL_SHA=$(fetch_sha "$MACOS_INTEL_URL")
 
           MACOS_ARM_URL="https://github.com/unhappychoice/gitlogue/releases/download/$VERSION/gitlogue-$VERSION-aarch64-apple-darwin.tar.gz"
-          MACOS_ARM_SHA=$(curl -sL "$MACOS_ARM_URL" | sha256sum | cut -d' ' -f1)
+          MACOS_ARM_SHA=$(fetch_sha "$MACOS_ARM_URL")
 
           LINUX_INTEL_URL="https://github.com/unhappychoice/gitlogue/releases/download/$VERSION/gitlogue-$VERSION-x86_64-unknown-linux-gnu.tar.gz"
-          LINUX_INTEL_SHA=$(curl -sL "$LINUX_INTEL_URL" | sha256sum | cut -d' ' -f1)
+          LINUX_INTEL_SHA=$(fetch_sha "$LINUX_INTEL_URL")
 
           LINUX_ARM_URL="https://github.com/unhappychoice/gitlogue/releases/download/$VERSION/gitlogue-$VERSION-aarch64-unknown-linux-gnu.tar.gz"
-          LINUX_ARM_SHA=$(curl -sL "$LINUX_ARM_URL" | sha256sum | cut -d' ' -f1)
+          LINUX_ARM_SHA=$(fetch_sha "$LINUX_ARM_URL")
 
           echo "Calculated SHAs:"
           echo "macOS Intel: $MACOS_INTEL_SHA"
```

---

### Incident Patch 5: `e20bba92` (2026-08-30)
**Commit Message**: chore(nix): update nixpkgs to fix crate downloads (#234)

crates.io now returns 403 for the /api/v1/crates/<name>/<version>/download
endpoint, which is the URL the pinned nixpkgs (2025-11-22) uses to fetch
crates in cargoLock.lockFile builds. Every `nix build .#unstable` run
fails as soon as a crate is missing from the binary cache.

Newer nixpkgs fetches crates from static.crates.io instead
(rust-lang/crates.io#13482), so bump the pin to pick that up.

Verified locally with `nix build .#unstable`.

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `flake.lock` (modified, +3/-3)
```diff
@@ -2,11 +2,11 @@
   "nodes": {
     "nixpkgs": {
       "locked": {
-        "lastModified": 1763835633,
-        "narHash": "sha256-HzxeGVID5MChuCPESuC0dlQL1/scDKu+MmzoVBJxulM=",
+        "lastModified": 1787900134,
+        "narHash": "sha256-VYXO0XZlgj06dxJZRhrD3WoSsvq/c7+/Akyoa22pefw=",
         "owner": "NixOS",
         "repo": "nixpkgs",
-        "rev": "050e09e091117c3d7328c7b2b7b577492c43c134",
+        "rev": "83199d0d373dd3ac2b9a1996b1d0263f76ab7a4c",
         "type": "github"
       },
       "original": {
```

---

### Incident Patch 6: `73629484` (2026-08-17)
**Commit Message**: fix(syntax): narrow GDScript parameter highlights

Capture parameter identifiers instead of whole parameter lists, and make highlight assertions safe for non-ASCII source ranges.

**File**: `src/syntax/languages/queries/gdscript_highlights.scm` (modified, +12/-3)
```diff
@@ -24,11 +24,20 @@
 
 ; Functions, methods, and members
 (function_definition
-  name: (name) @function
-  parameters: (parameters) @parameter)
+  name: (name) @function)
 (constructor_definition "_init" @function)
 (lambda (name) @function)
-(lambda (parameters) @parameter)
+(parameters
+  [
+    (identifier) @parameter
+    (typed_parameter (identifier) @parameter)
+    (default_parameter (identifier) @parameter)
+    (typed_default_parameter (identifier) @parameter)
+    (variadic_parameter (identifier) @parameter)
+    (variadic_parameter (typed_parameter (identifier) @parameter))
+    (variadic_parameter (default_parameter (identifier) @parameter))
+    (variadic_parameter (typed_default_parameter (identifier) @parameter))
+  ])
 (call (identifier) @function)
 (attribute_call (identifier) @function)
 (base_call (identifier) @function)
```

**File**: `src/syntax/mod.rs` (modified, +7/-4)
```diff
@@ -507,7 +507,8 @@ mod tests {
             expected.iter().for_each(|(needle, token_type)| {
                 assert!(
                     spans.iter().any(|span| {
-                        span.token_type == *token_type && &source[span.start..span.end] == *needle
+                        span.token_type == *token_type
+                            && source.get(span.start..span.end) == Some(*needle)
                     }),
                     "{path}: expected {needle:?} to be {token_type:?}"
                 );
@@ -516,12 +517,14 @@ mod tests {
 
         assert_highlights(
             "player.gd",
-            "extends Node3D\nfunc _ready() -> void:\n    var score: int = 42\n",
+            "extends Node3D\nfunc greet(name: String, count = 1) -> void:\n    var greeting = \"你好\"\n",
             &[
                 ("func", TokenType::Keyword),
-                ("_ready", TokenType::Function),
+                ("greet", TokenType::Function),
+                ("name", TokenType::Parameter),
+                ("count", TokenType::Parameter),
                 ("Node3D", TokenType::Type),
-                ("42", TokenType::Number),
+                ("\"你好\"", TokenType::String),
             ],
         );
         assert_highlights(
```

---

### Incident Patch 7: `d8db042e` (2026-06-23)
**Commit Message**: Merge pull request #216 from unhappychoice/dependabot/cargo/ratatui-0.30.2

chore(deps): bump ratatui from 0.30.1 to 0.30.2

**File**: `Cargo.lock` (modified, +37/-13)
```diff
@@ -1448,30 +1448,30 @@ checksum = "0c8d0fd677905edcbeedbf2edb6494d676f0e98d54d5cf9bda0b061cb8fb8aba"
 
 [[package]]
 name = "ratatui"
-version = "0.30.1"
+version = "0.30.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1695748e3a735b34968c887ceea5a380b43545903868ae8f5b666593100f6b68"
+checksum = "3274ba0a2c5e1bcad2a2005d20f4dc59dad26b2eb0940fb094500dba4099d57d"
 dependencies = [
  "instability",
  "ratatui-core",
  "ratatui-crossterm",
  "ratatui-macros",
+ "ratatui-termina",
  "ratatui-termwiz",
  "ratatui-widgets",
  "serde",
 ]
 
 [[package]]
 name = "ratatui-core"
-version = "0.1.1"
+version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "42d3603f354bba8c595fa47860e60142d7372b7210c27044c6a7d0e1a4336b44"
+checksum = "cbb175c433c8e28a809d1f5773a2ae96e68c0ce40db865cbab1020bf33ae479c"
 dependencies = [
  "bitflags 2.13.0",
  "compact_str",
  "critical-section",
  "hashbrown 0.17.1",
- "indoc",
  "itertools 0.14.0",
  "kasuari",
  "lru",
@@ -1486,9 +1486,9 @@ dependencies = [
 
 [[package]]
 name = "ratatui-crossterm"
-version = "0.1.1"
+version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2b2867bedcbd6a690ca4f8672a687b730ec07660c79844517b084311b529980c"
+checksum = "567584a3b0e6a8203c23de40b4861497266725eb5363dbfd18a1edd603cca9f0"
 dependencies = [
  "cfg-if",
  "crossterm",
@@ -1498,29 +1498,40 @@ dependencies = [
 
 [[package]]
 name = "ratatui-macros"
-version = "0.7.1"
+version = "0.7.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "80fac59720679490d89d200df411faa249be728681adcabed3d047ae72c48f1d"
+checksum = "ed7dc68daa7498a43e4d68e0eb078427e10c38fbcfbb1e42d955f1fa2140d814"
 dependencies = [
  "ratatui-core",
  "ratatui-widgets",
 ]
 
+[[package]]
+name = "ratatui-termina"
+version = "0.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c0bf912d9e66f057a759d92e386a280ea886b352ab757d6ac4d653c7ed2c43c2"
+dependencies = [
+ "instability",
+ "ratatui-core",
+ "termina",
+]
+
 [[package]]
 name = "ratatui-termwiz"
-version = "0.1.1"
+version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "386b8ff8f74ed749509391c56d549761a2fcdb408e1f42e467286bcb7dac8967"
+checksum = "faf03e0380b7744054d6cb74224fe3adf062a029754933f575ca1e3b4c2ce977"
 dependencies = [
  "ratatui-core",
  "termwiz",
 ]
 
 [[package]]
 name = "ratatui-widgets"
-version = "0.3.1"
+version = "0.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7ef4f17dd7ac3abf5adc2b920a03c61eee4bfe6a88fa5191936895525371d79c"
+checksum = "66e3d19bcc9130ca376277d93b60767ff121ace3be06f5f95f81dd68956407d1"
 dependencies = [
  "bitflags 2.13.0",
  "hashbrown 0.17.1",
@@ -1801,6 +1812,19 @@ dependencies = [
  "unicode-ident",
 ]
 
+[[package]]
+name = "termina"
+version = "0.3.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9048a889effe34a5cddee0af7f53285198b16dca3be510858d38dfdb3e62a04e"
+dependencies = [
+ "bitflags 2.13.0",
+ "parking_lot",
+ "rustix",
+ "signal-hook",
+ "windows-sys 0.61.2",
+]
+
 [[package]]
 name = "terminfo"
 version = "0.9.0"
```

---

### Incident Patch 8: `127f59a1` (2026-06-22)
**Commit Message**: chore(deps): bump ratatui from 0.30.1 to 0.30.2

Bumps [ratatui](https://github.com/ratatui/ratatui) from 0.30.1 to 0.30.2.
- [Release notes](https://github.com/ratatui/ratatui/releases)
- [Changelog](https://github.com/ratatui/ratatui/blob/main/CHANGELOG.md)
- [Commits](https://github.com/ratatui/ratatui/compare/ratatui-v0.30.1...ratatui-v0.30.2)

---
updated-dependencies:
- dependency-name: ratatui
  dependency-version: 0.30.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +37/-13)
```diff
@@ -1448,30 +1448,30 @@ checksum = "0c8d0fd677905edcbeedbf2edb6494d676f0e98d54d5cf9bda0b061cb8fb8aba"
 
 [[package]]
 name = "ratatui"
-version = "0.30.1"
+version = "0.30.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1695748e3a735b34968c887ceea5a380b43545903868ae8f5b666593100f6b68"
+checksum = "3274ba0a2c5e1bcad2a2005d20f4dc59dad26b2eb0940fb094500dba4099d57d"
 dependencies = [
  "instability",
  "ratatui-core",
  "ratatui-crossterm",
  "ratatui-macros",
+ "ratatui-termina",
  "ratatui-termwiz",
  "ratatui-widgets",
  "serde",
 ]
 
 [[package]]
 name = "ratatui-core"
-version = "0.1.1"
+version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "42d3603f354bba8c595fa47860e60142d7372b7210c27044c6a7d0e1a4336b44"
+checksum = "cbb175c433c8e28a809d1f5773a2ae96e68c0ce40db865cbab1020bf33ae479c"
 dependencies = [
  "bitflags 2.13.0",
  "compact_str",
  "critical-section",
  "hashbrown 0.17.1",
- "indoc",
  "itertools 0.14.0",
  "kasuari",
  "lru",
@@ -1486,9 +1486,9 @@ dependencies = [
 
 [[package]]
 name = "ratatui-crossterm"
-version = "0.1.1"
+version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2b2867bedcbd6a690ca4f8672a687b730ec07660c79844517b084311b529980c"
+checksum = "567584a3b0e6a8203c23de40b4861497266725eb5363dbfd18a1edd603cca9f0"
 dependencies = [
  "cfg-if",
  "crossterm",
@@ -1498,29 +1498,40 @@ dependencies = [
 
 [[package]]
 name = "ratatui-macros"
-version = "0.7.1"
+version = "0.7.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "80fac59720679490d89d200df411faa249be728681adcabed3d047ae72c48f1d"
+checksum = "ed7dc68daa7498a43e4d68e0eb078427e10c38fbcfbb1e42d955f1fa2140d814"
 dependencies = [
  "ratatui-core",
  "ratatui-widgets",
 ]
 
+[[package]]
+name = "ratatui-termina"
+version = "0.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c0bf912d9e66f057a759d92e386a280ea886b352ab757d6ac4d653c7ed2c43c2"
+dependencies = [
+ "instability",
+ "ratatui-core",
+ "termina",
+]
+
 [[package]]
 name = "ratatui-termwiz"
-version = "0.1.1"
+version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "386b8ff8f74ed749509391c56d549761a2fcdb408e1f42e467286bcb7dac8967"
+checksum = "faf03e0380b7744054d6cb74224fe3adf062a029754933f575ca1e3b4c2ce977"
 dependencies = [
  "ratatui-core",
  "termwiz",
 ]
 
 [[package]]
 name = "ratatui-widgets"
-version = "0.3.1"
+version = "0.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7ef4f17dd7ac3abf5adc2b920a03c61eee4bfe6a88fa5191936895525371d79c"
+checksum = "66e3d19bcc9130ca376277d93b60767ff121ace3be06f5f95f81dd68956407d1"
 dependencies = [
  "bitflags 2.13.0",
  "hashbrown 0.17.1",
@@ -1801,6 +1812,19 @@ dependencies = [
  "unicode-ident",
 ]
 
+[[package]]
+name = "termina"
+version = "0.3.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9048a889effe34a5cddee0af7f53285198b16dca3be510858d38dfdb3e62a04e"
+dependencies = [
+ "bitflags 2.13.0",
+ "parking_lot",
+ "rustix",
+ "signal-hook",
+ "windows-sys 0.61.2",
+]
+
 [[package]]
 name = "terminfo"
 version = "0.9.0"
```

---

### Incident Patch 9: `ee763eca` (2026-06-08)
**Commit Message**: Merge pull request #214 from unhappychoice/dependabot/cargo/ratatui-0.30.1

chore(deps): bump ratatui from 0.30.0 to 0.30.1

**File**: `Cargo.lock` (modified, +117/-44)
```diff
@@ -82,6 +82,15 @@ version = "1.0.102"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
 
+[[package]]
+name = "approx"
+version = "0.5.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cab112f0a86d568ea0e627cc1d6be74a1e9cd55214684db5561995f6dad897c6"
+dependencies = [
+ "num-traits",
+]
+
 [[package]]
 name = "atomic"
 version = "0.6.1"
@@ -126,9 +135,9 @@ checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
 
 [[package]]
 name = "bitflags"
-version = "2.10.0"
+version = "2.13.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "812e12b5285cc515a9c72a5c1d3b6d46a19dac5acfef5265968c166106e31dd3"
+checksum = "b4388bee8683e3d04af747c73422af53102d2bd24d9eadb6cbc100baef4b43f8"
 
 [[package]]
 name = "block-buffer"
@@ -164,6 +173,12 @@ version = "3.19.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "46c5e41b57b8bba42a04676d81cb89e9ee8e859a1a66f80a5a72e1cb76b34d43"
 
+[[package]]
+name = "by_address"
+version = "1.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "64fa3c856b712db6612c019f14756e64e4bcea13337a6b33b696333a9eaa2d06"
+
 [[package]]
 name = "bytemuck"
 version = "1.24.0"
@@ -330,13 +345,19 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "critical-section"
+version = "1.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "790eea4361631c5e7d22598ecd5723ff611904e3344ce8720784c93e3d83d40b"
+
 [[package]]
 name = "crossterm"
 version = "0.29.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d8b9f2e4c67f833b660cdb0a3523065869fb35570177239812ed4c905aeff87b"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "crossterm_winapi",
  "derive_more",
  "document-features",
@@ -496,7 +517,7 @@ version = "0.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "89a09f22a6c6069a18470eb92d2298acf25463f14256d24778e1230d789a2aec"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "block2",
  "libc",
  "objc2",
@@ -552,6 +573,12 @@ dependencies = [
  "regex",
 ]
 
+[[package]]
+name = "fast-srgb8"
+version = "1.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "dd2e7510819d6fbf51a5545c8f922716ecfb14df168a3242f7d33e0239efe6a1"
+
 [[package]]
 name = "filedescriptor"
 version = "0.8.3"
@@ -652,7 +679,7 @@ version = "0.21.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ddddbf932745a6be37109b6112d3ee09696106f848449069d3a57bba937ab82e"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "libc",
  "libgit2-sys",
  "log",
@@ -746,6 +773,17 @@ dependencies = [
  "foldhash 0.2.0",
 ]
 
+[[package]]
+name = "hashbrown"
+version = "0.17.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ed5909b6e89a2db4456e54cd5f673791d7eca6732202bbf2a9cc504fe2f9b84a"
+dependencies = [
+ "allocator-api2",
+ "equivalent",
+ "foldhash 0.2.0",
+]
+
 [[package]]
 name = "heck"
 version = "0.5.0"
@@ -926,13 +964,19 @@ dependencies = [
  "pkg-config",
 ]
 
+[[package]]
+name = "libm"
+version = "0.2.16"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b6d2cec3eae94f9f509c767b45932f1ada8350c4bdb85af2fcab4a3c14807981"
+
 [[package]]
 name = "libredox"
 version = "0.1.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "416f7e718bdb06000964960ffa43b4335ad4012ae8b99060261aa4a8088d5ccb"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "libc",
 ]
 
@@ -954,7 +998,7 @@ version = "0.3.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5f4de44e98ddbf09375cbf4d17714d18f39195f4f4894e8524501726fd9a8a4a"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
 ]
 
 [[package]]
@@ -986,11 +1030,11 @@ checksum = "34080505efa8e45a4b816c349525ebe327ceaa8559756f0356cba97ef3bf7432"
 
 [[package]]
 name = "lru"
-version = "0.16.2"
+version = "0.18.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "96051b46fc183dc9cd4a223960ef37b9af631b55191852a8274bfef064cda20f"
+checksum = "8a860605968fce16869fd239cf4237a82f3ac470723415db603b0e8b6c8d4fb9"
 dependencies = [
- "hashbrown 0.16.1",
+ "hashbrown 0.17.1",
 ]
 
 [[package]]
@@ -1048,7 +1092,7 @@ version = "0.29.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "71e2746dc3a24dd78b3cfcb7be93368c6de9963d30f43a6a73998a9cf4b17b46"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "cfg-if",
  "cfg_aliases",
  "libc",
@@ -1061,7 +1105,7 @@ version = "0.31.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "225e7cfe711e0ba79a68baeddb2982723e4235247aefce1482f2f16c27865b66"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "cfg-if",
  "cfg_aliases",
  "
```

---

### Incident Patch 10: `450f68d4` (2026-06-08)
**Commit Message**: chore(deps): bump ratatui from 0.30.0 to 0.30.1

Bumps [ratatui](https://github.com/ratatui/ratatui) from 0.30.0 to 0.30.1.
- [Release notes](https://github.com/ratatui/ratatui/releases)
- [Changelog](https://github.com/ratatui/ratatui/blob/main/CHANGELOG.md)
- [Commits](https://github.com/ratatui/ratatui/compare/ratatui-v0.30.0...ratatui-v0.30.1)

---
updated-dependencies:
- dependency-name: ratatui
  dependency-version: 0.30.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +117/-44)
```diff
@@ -82,6 +82,15 @@ version = "1.0.102"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
 
+[[package]]
+name = "approx"
+version = "0.5.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cab112f0a86d568ea0e627cc1d6be74a1e9cd55214684db5561995f6dad897c6"
+dependencies = [
+ "num-traits",
+]
+
 [[package]]
 name = "atomic"
 version = "0.6.1"
@@ -126,9 +135,9 @@ checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
 
 [[package]]
 name = "bitflags"
-version = "2.10.0"
+version = "2.13.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "812e12b5285cc515a9c72a5c1d3b6d46a19dac5acfef5265968c166106e31dd3"
+checksum = "b4388bee8683e3d04af747c73422af53102d2bd24d9eadb6cbc100baef4b43f8"
 
 [[package]]
 name = "block-buffer"
@@ -164,6 +173,12 @@ version = "3.19.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "46c5e41b57b8bba42a04676d81cb89e9ee8e859a1a66f80a5a72e1cb76b34d43"
 
+[[package]]
+name = "by_address"
+version = "1.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "64fa3c856b712db6612c019f14756e64e4bcea13337a6b33b696333a9eaa2d06"
+
 [[package]]
 name = "bytemuck"
 version = "1.24.0"
@@ -330,13 +345,19 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "critical-section"
+version = "1.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "790eea4361631c5e7d22598ecd5723ff611904e3344ce8720784c93e3d83d40b"
+
 [[package]]
 name = "crossterm"
 version = "0.29.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d8b9f2e4c67f833b660cdb0a3523065869fb35570177239812ed4c905aeff87b"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "crossterm_winapi",
  "derive_more",
  "document-features",
@@ -496,7 +517,7 @@ version = "0.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "89a09f22a6c6069a18470eb92d2298acf25463f14256d24778e1230d789a2aec"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "block2",
  "libc",
  "objc2",
@@ -552,6 +573,12 @@ dependencies = [
  "regex",
 ]
 
+[[package]]
+name = "fast-srgb8"
+version = "1.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "dd2e7510819d6fbf51a5545c8f922716ecfb14df168a3242f7d33e0239efe6a1"
+
 [[package]]
 name = "filedescriptor"
 version = "0.8.3"
@@ -652,7 +679,7 @@ version = "0.21.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ddddbf932745a6be37109b6112d3ee09696106f848449069d3a57bba937ab82e"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "libc",
  "libgit2-sys",
  "log",
@@ -746,6 +773,17 @@ dependencies = [
  "foldhash 0.2.0",
 ]
 
+[[package]]
+name = "hashbrown"
+version = "0.17.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ed5909b6e89a2db4456e54cd5f673791d7eca6732202bbf2a9cc504fe2f9b84a"
+dependencies = [
+ "allocator-api2",
+ "equivalent",
+ "foldhash 0.2.0",
+]
+
 [[package]]
 name = "heck"
 version = "0.5.0"
@@ -926,13 +964,19 @@ dependencies = [
  "pkg-config",
 ]
 
+[[package]]
+name = "libm"
+version = "0.2.16"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b6d2cec3eae94f9f509c767b45932f1ada8350c4bdb85af2fcab4a3c14807981"
+
 [[package]]
 name = "libredox"
 version = "0.1.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "416f7e718bdb06000964960ffa43b4335ad4012ae8b99060261aa4a8088d5ccb"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "libc",
 ]
 
@@ -954,7 +998,7 @@ version = "0.3.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5f4de44e98ddbf09375cbf4d17714d18f39195f4f4894e8524501726fd9a8a4a"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
 ]
 
 [[package]]
@@ -986,11 +1030,11 @@ checksum = "34080505efa8e45a4b816c349525ebe327ceaa8559756f0356cba97ef3bf7432"
 
 [[package]]
 name = "lru"
-version = "0.16.2"
+version = "0.18.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "96051b46fc183dc9cd4a223960ef37b9af631b55191852a8274bfef064cda20f"
+checksum = "8a860605968fce16869fd239cf4237a82f3ac470723415db603b0e8b6c8d4fb9"
 dependencies = [
- "hashbrown 0.16.1",
+ "hashbrown 0.17.1",
 ]
 
 [[package]]
@@ -1048,7 +1092,7 @@ version = "0.29.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "71e2746dc3a24dd78b3cfcb7be93368c6de9963d30f43a6a73998a9cf4b17b46"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "cfg-if",
  "cfg_aliases",
  "libc",
@@ -1061,7 +1105,7 @@ version = "0.31.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "225e7cfe711e0ba79a68baeddb2982723e4235247aefce1482f2f16c27865b66"
 dependencies = [
- "bitflags 2.10.0",
+ "bitflags 2.13.0",
  "cfg-if",
  "cfg_aliases",
  "
```

---

### Incident Patch 11: `6be3db58` (2026-05-31)
**Commit Message**: Merge pull request #210 from unhappychoice/fix/ci-nix-build-update-action

fix(ci): bump cachix/install-nix-action from v27 to v31

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -79,6 +79,6 @@ jobs:
     runs-on: ubuntu-22.04
     steps:
       - uses: actions/checkout@v4
-      - uses: cachix/install-nix-action@v27
+      - uses: cachix/install-nix-action@v31
       - name: Build unstable package
         run: nix build .#unstable
```

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ jobs:
         run: cargo test
 
       - name: Install Nix
-        uses: cachix/install-nix-action@v27
+        uses: cachix/install-nix-action@v31
 
       - name: Update flake.nix
         run: |
@@ -202,7 +202,7 @@ jobs:
           token: ${{ secrets.GITHUB_TOKEN }}
           fetch-depth: 0
 
-      - uses: cachix/install-nix-action@v27
+      - uses: cachix/install-nix-action@v31
 
       - name: Calculate and update hashes
         run: |
```

---

### Incident Patch 12: `f9c046f4` (2026-05-31)
**Commit Message**: fix(ci): bump cachix/install-nix-action to v31 in release.yml

Keep the Nix installer version consistent with ci.yml so release
builds don't hit the same crates.io fetch failures.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ jobs:
         run: cargo test
 
       - name: Install Nix
-        uses: cachix/install-nix-action@v27
+        uses: cachix/install-nix-action@v31
 
       - name: Update flake.nix
         run: |
@@ -202,7 +202,7 @@ jobs:
           token: ${{ secrets.GITHUB_TOKEN }}
           fetch-depth: 0
 
-      - uses: cachix/install-nix-action@v27
+      - uses: cachix/install-nix-action@v31
 
       - name: Calculate and update hashes
         run: |
```

---

### Incident Patch 13: `d52afc84` (2026-05-31)
**Commit Message**: fix(ci): bump cachix/install-nix-action from v27 to v31

The Nix Build job was failing when fetching crates from crates.io
(e.g. ctrlc-3.5.2) with SSL/403 errors. The old Nix 2.26.3 bundled
in v27 did not handle the static.crates.io redirect correctly.
v31 ships Nix 2.34.7 which resolves the fetch behavior.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -79,6 +79,6 @@ jobs:
     runs-on: ubuntu-22.04
     steps:
       - uses: actions/checkout@v4
-      - uses: cachix/install-nix-action@v27
+      - uses: cachix/install-nix-action@v31
       - name: Build unstable package
         run: nix build .#unstable
```

---

### Incident Patch 14: `e2e1fbf5` (2026-05-14)
**Commit Message**: fix(ci): bump rust-cache prefix-key to invalidate stale cache

The cached ~/.cargo/bin/cargo was restored as rustup-init, causing
`cargo build` to fail with "unexpected argument 'build'" on macOS.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +4/-4)
```diff
@@ -22,7 +22,7 @@ jobs:
           components: rustfmt
       - uses: Swatinem/rust-cache@v2
         with:
-          prefix-key: v1-rust
+          prefix-key: v2-rust
       - run: cargo fmt --all -- --check
 
   clippy:
@@ -35,7 +35,7 @@ jobs:
           components: clippy
       - uses: Swatinem/rust-cache@v2
         with:
-          prefix-key: v1-rust
+          prefix-key: v2-rust
       - run: cargo clippy --all-targets --all-features -- -D warnings
 
   test:
@@ -48,7 +48,7 @@ jobs:
           components: llvm-tools-preview
       - uses: Swatinem/rust-cache@v2
         with:
-          prefix-key: v1-rust
+          prefix-key: v2-rust
       - name: Install cargo-llvm-cov
         uses: taiki-e/install-action@cargo-llvm-cov
       - name: Generate coverage report
@@ -71,7 +71,7 @@ jobs:
       - uses: dtolnay/rust-toolchain@stable
       - uses: Swatinem/rust-cache@v2
         with:
-          prefix-key: v1-rust
+          prefix-key: v2-rust
       - run: cargo build --release
 
   nix-build:
```

#### Recent Merged Pull Requests:
- **PR #245** (2026-10-05): chore(deps): bump tree-sitter-haskell from 0.23.1 to 0.24.1 (@dependabot[bot])
- **PR #244** (2026-10-01): feat: add watch mode to replay new commits as they are made (@unhappychoice)
- **PR #243** (2026-09-25): chore(deps): bump rand from 0.10.2 to 0.10.3 (@dependabot[bot])
- **PR #242** (2026-09-14): chore(deps): bump toml_edit from 0.25.13+spec-1.1.0 to 0.25.15+spec-1.1.0 (@dependabot[bot])
- **PR #241** (2026-09-14): chore(deps): bump toml from 1.1.5+spec-1.1.0 to 1.1.6+spec-1.1.0 (@dependabot[bot])
- **PR #239** (2026-09-09): chore(deps): bump dirs from 6.0.0 to 7.0.0 (@dependabot[bot])
- **PR #238** (2026-09-07): fix(ci): fail Homebrew SHA step on HTTP errors (@unhappychoice)
- **PR #237** (2026-09-07): chore(deps): bump toml from 1.1.4+spec-1.1.0 to 1.1.5+spec-1.1.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
