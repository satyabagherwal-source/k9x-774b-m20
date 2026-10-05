# Forensic Learning Record (Deep Inspection): unhappychoice/gitlogue

> **Canonical Artifact**: `07_PROJECT_LEARNING/unhappychoice-gitlogue-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/unhappychoice/gitlogue](https://github.com/unhappychoice/gitlogue))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:01:18.377Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `unhappychoice/gitlogue`
- **Description**: A cinematic Git commit replay tool for the terminal, turning your Git history into a living, animated story.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 5056 stars

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
            active
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
            .join("themes"
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
            let par
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
mod widgets;

use animation::SpeedRule;
use anyhow::{Context, Result};
use clap::{Parser, Subcommand, ValueEnum};
use config::Config;
use git::{DiffMode, GitRepository};
use std::path::{Path, PathBuf};
use theme::Theme;
use ui::UI;

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
                .filter(|line
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
            path: path.to_s
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

### Incident Patch 1: `8975613a` (2026-09-07)
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

### Incident Patch 2: `9a27f93c` (2026-09-07)
**Commit Message**: fix(ci): fail Homebrew SHA step on HTTP errors

curl -sL exits 0 on a 404, so sha256sum digested the error body and the
formula was updated with a bogus SHA while the job stayed green. Use
curl -f with set -o pipefail so a missing asset aborts the step.

Closes #236

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

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

### Incident Patch 3: `e20bba92` (2026-08-30)
**Commit Message**: chore(nix): update nixpkgs to fix crate downloads (#234)

crates.io now returns 403 for the /api/v1/crates/<name>/<version>/download
endpoint, which is the URL the pinned nixpkgs (2025-11-22) uses to fetch
crates in cargoLock.lockFile builds. Every `nix build .#unstable` run
fails as soon as a crate is missing from the binary cache.

Newer nixpkgs fetches crates from static.crates.io instead
(rust-lang/crates.io#13482), so bump the pin to pick that up.

Verified locally with `nix build .#unstable`.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

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

### Incident Patch 4: `73629484` (2026-08-17)
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

### Incident Patch 5: `6be3db58` (2026-05-31)
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

### Incident Patch 6: `f9c046f4` (2026-05-31)
**Commit Message**: fix(ci): bump cachix/install-nix-action to v31 in release.yml

Keep the Nix installer version consistent with ci.yml so release
builds don't hit the same crates.io fetch failures.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

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

### Incident Patch 7: `d52afc84` (2026-05-31)
**Commit Message**: fix(ci): bump cachix/install-nix-action from v27 to v31

The Nix Build job was failing when fetching crates from crates.io
(e.g. ctrlc-3.5.2) with SSL/403 errors. The old Nix 2.26.3 bundled
in v27 did not handle the static.crates.io redirect correctly.
v31 ships Nix 2.34.7 which resolves the fetch behavior.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

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

### Incident Patch 8: `e2e1fbf5` (2026-05-14)
**Commit Message**: fix(ci): bump rust-cache prefix-key to invalidate stale cache

The cached ~/.cargo/bin/cargo was restored as rustup-init, causing
`cargo build` to fail with "unexpected argument 'build'" on macOS.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

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

---

### Incident Patch 9: `2f504045` (2026-04-30)
**Commit Message**: fix: address CodeRabbit review findings on rename detection and ignore handling

- Propagate errors from `Diff::find_similar` instead of dropping them with
  `let _`. Without this, rename detection could silently fail and downstream
  animation logic would emit add/delete instead of `mv` because `old_path`
  never gets populated.
- Make `collect_ignore_patterns` return `Result` so a missing or unreadable
  `--ignore-file` surfaces as an error rather than being silently downgraded
  to "no extra patterns" — users explicitly opted into that filtering.
- Initialize ignore patterns before computing the working-tree diff inside
  `prepare_diff_playback` so `should_exclude_file` filters out user-ignored
  paths during the first metadata extraction, not just on subsequent loop
  iterations.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

**File**: `src/git.rs` (modified, +6/-5)
```diff
@@ -173,13 +173,14 @@ fn matches_date_filter(
     Ok(true)
 }
 
-fn detect_file_moves(diff: &mut git2::Diff, for_untracked: bool) {
+fn detect_file_moves(diff: &mut git2::Diff, for_untracked: bool) -> Result<()> {
     let mut options = DiffFindOptions::new();
     options.renames(true);
     if for_untracked {
         options.for_untracked(true);
     }
-    let _ = diff.find_similar(Some(&mut options));
+    diff.find_similar(Some(&mut options))
+        .context("Failed to detect file renames in diff")
 }
 
 pub struct GitRepository {
@@ -620,7 +621,7 @@ impl GitRepository {
             Ok(d) => d,
             Err(_) => return Ok(Vec::new()), // Skip if diff fails
         };
-        detect_file_moves(&mut diff, false);
+        detect_file_moves(&mut diff, false)?;
 
         let mut changes = Vec::new();
 
@@ -830,7 +831,7 @@ impl GitRepository {
             .repo
             .diff_tree_to_index(head_tree.as_ref(), Some(&index), Some(&mut diff_opts))
             .context("Failed to diff tree to index")?;
-        detect_file_moves(&mut diff, false);
+        detect_file_moves(&mut diff, false)?;
 
         self.extract_changes_from_diff(&diff, head_tree.as_ref(), None)
     }
@@ -850,7 +851,7 @@ impl GitRepository {
             .repo
             .diff_index_to_workdir(Some(&index), Some(&mut diff_opts))
             .context("Failed to diff index to workdir")?;
-        detect_file_moves(&mut diff, true);
+        detect_file_moves(&mut diff, true)?;
 
         // For unstaged, "old" content comes from index, "new" from workdir
         self.extract_changes_from_diff_workdir(&diff, &index)
```

**File**: `src/main.rs` (modified, +10/-7)
```diff
@@ -269,10 +269,12 @@ fn collect_ignore_patterns(
     config_patterns: &[String],
     ignore_file: Option<&Path>,
     cli_patterns: &[String],
-) -> Vec<String> {
+) -> Result<Vec<String>> {
     let mut patterns = config_patterns.to_vec();
 
-    if let Some(content) = ignore_file.and_then(|path| std::fs::read_to_string(path).ok()) {
+    if let Some(path) = ignore_file {
+        let content = std::fs::read_to_string(path)
+            .with_context(|| format!("Failed to read ignore file: {}", path.display()))?;
         patterns.extend(
             content
                 .lines()
@@ -282,7 +284,7 @@ fn collect_ignore_patterns(
     }
 
     patterns.extend(cli_patterns.iter().cloned());
-    patterns
+    Ok(patterns)
 }
 
 fn parse_speed_rules(cli_rules: &[String], config_rules: &[String]) -> Vec<SpeedRule> {
@@ -424,7 +426,7 @@ fn prepare_commit_playback(
         &config.ignore_patterns,
         args.ignore_file.as_deref(),
         &args.ignore,
-    );
+    )?;
     git::init_ignore_patterns(&patterns).ok();
     let order = resolve_order(args.order, &config.order, is_range_mode, is_filtered);
     let runtime = resolve_runtime_options(
@@ -463,12 +465,12 @@ fn prepare_diff_playback(
     } else {
         DiffMode::Staged
     };
+    let patterns = collect_ignore_patterns(&config.ignore_patterns, None, options.ignore)?;
+    git::init_ignore_patterns(&patterns).ok();
     let metadata = repo.get_working_tree_diff(mode)?;
     if metadata.changes.is_empty() {
         return Ok(None);
     }
-    let patterns = collect_ignore_patterns(&config.ignore_patterns, None, options.ignore);
-    git::init_ignore_patterns(&patterns).ok();
     let runtime = resolve_runtime_options(
         options.speed,
         options.theme,
@@ -877,7 +879,8 @@ mod tests {
             &["dist/**".to_string()],
             Some(ignore_file.as_path()),
             &["*.png".to_string()],
-        );
+        )
+        .unwrap();
 
         assert_eq!(
             patterns,
```

---

### Incident Patch 10: `63bc1d95` (2026-04-30)
**Commit Message**: refactor(ui): extract external signal handling into testable helpers and add regression tests

**File**: `src/ui.rs` (modified, +67/-8)
```diff
@@ -160,13 +160,34 @@ impl<'a> UI<'a> {
     }
 
     fn setup_signal_handler(should_exit: Arc<AtomicBool>) {
-        ctrlc::set_handler(move || {
-            let mut stdout = io::stdout();
-            Self::handle_external_signal(should_exit.as_ref(), &mut stdout, std::process::exit);
-        })
+        ctrlc::set_handler(Self::build_signal_handler(
+            should_exit,
+            io::stdout,
+            std::process::exit,
+        ))
         .expect("Error setting Ctrl-C handler");
     }
 
+    fn build_signal_handler<W, MakeWriter, Exit, ExitResult>(
+        should_exit: Arc<AtomicBool>,
+        make_writer: MakeWriter,
+        exit: Exit,
+    ) -> impl FnMut() + Send + 'static
+    where
+        W: io::Write,
+        MakeWriter: Fn() -> W + Send + Sync + 'static,
+        Exit: Fn(i32) -> ExitResult + Send + Sync + 'static,
+    {
+        let make_writer = Arc::new(make_writer);
+        let exit = Arc::new(exit);
+        move || {
+            let mut writer = make_writer.as_ref()();
+            Self::handle_external_signal(should_exit.as_ref(), &mut writer, |code| {
+                exit.as_ref()(code)
+            });
+        }
+    }
+
     fn handle_external_signal<W: io::Write, F, T>(
         should_exit: &AtomicBool,
         writer: &mut W,
@@ -284,10 +305,8 @@ impl<'a> UI<'a> {
     fn handle_next(&mut self) {
         if let Some(index) = self.history_index {
             if index + 1 < self.history.len() {
-                let target = index + 1;
-                if self.play_history_commit(target) {
-                    return;
-                }
+                let _ = self.play_history_commit(index + 1);
+                return;
             }
         }
 
@@ -803,6 +822,7 @@ mod tests {
     use std::fs;
     use std::path::{Path, PathBuf};
     use std::sync::atomic::{AtomicU64, Ordering, Ordering as CounterOrdering};
+    use std::sync::Mutex;
     use std::time::{SystemTime, UNIX_EPOCH};
 
     struct TestRepo {
@@ -948,6 +968,20 @@ mod tests {
         event::KeyEvent::new(code, KeyModifiers::NONE)
     }
 
+    #[derive(Clone)]
+    struct SharedWriter(Arc<Mutex<Vec<u8>>>);
+
+    impl io::Write for SharedWriter {
+        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
+            self.0.lock().unwrap().extend_from_slice(buf);
+            Ok(buf.len())
+        }
+
+        fn flush(&mut self) -> io::Result<()> {
+            Ok(())
+        }
+    }
+
     fn apply_until_metadata_is_visible(ui: &mut UI<'_>) {
         while ui.engine.current_metadata().is_none() {
             assert!(ui.engine.manual_step(StepMode::Change));
@@ -1000,6 +1034,31 @@ mod tests {
         assert!(!output.is_empty());
     }
 
+    #[test]
+    fn build_signal_handler_invokes_external_signal_cleanup() {
+        let should_exit = Arc::new(AtomicBool::new(false));
+        let exit_code = Arc::new(Mutex::new(None));
+        let output = Arc::new(Mutex::new(Vec::new()));
+
+        let mut handler = UI::build_signal_handler(
+            should_exit.clone(),
+            {
+                let output = output.clone();
+                move || SharedWriter(output.clone())
+            },
+            {
+                let exit_code = exit_code.clone();
+                move |code| *exit_code.lock().unwrap() = Some(code)
+            },
+        );
+
+        handler();
+
+        assert!(should_exit.load(Ordering::SeqCst));
+        assert_eq!(*exit_code.lock().unwrap(), Some(0));
+        assert!(!output.lock().unwrap().is_empty());
+    }
+
     #[test]
     fn load_commit_tracks_history_navigation_and_truncates_future_entries() {
         let mut ui = test_ui();
```

#### Recent Merged Pull Requests:
- **PR #243** (2026-09-25): chore(deps): bump rand from 0.10.2 to 0.10.3 (@dependabot[bot])
- **PR #242** (2026-09-14): chore(deps): bump toml_edit from 0.25.13+spec-1.1.0 to 0.25.15+spec-1.1.0 (@dependabot[bot])
- **PR #241** (2026-09-14): chore(deps): bump toml from 1.1.5+spec-1.1.0 to 1.1.6+spec-1.1.0 (@dependabot[bot])
- **PR #239** (2026-09-09): chore(deps): bump dirs from 6.0.0 to 7.0.0 (@dependabot[bot])
- **PR #238** (2026-09-07): fix(ci): fail Homebrew SHA step on HTTP errors (@unhappychoice)
- **PR #237** (2026-09-07): chore(deps): bump toml from 1.1.4+spec-1.1.0 to 1.1.5+spec-1.1.0 (@dependabot[bot])
- **PR #235** (2026-09-02): chore(deps): bump chrono-english from 0.2.0 to 0.2.1 (@dependabot[bot])
- **PR #234** (2026-08-30): chore(nix): update nixpkgs to fix crate downloads (@unhappychoice)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
