# Forensic Learning Record (Deep Inspection): bgreenwell/doxx

> **Canonical Artifact**: `07_PROJECT_LEARNING/bgreenwell-doxx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bgreenwell/doxx](https://github.com/bgreenwell/doxx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:58:09.777Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bgreenwell/doxx`
- **Description**: Expose the contents of .docx files without leaving your terminal. Fast, safe, and smart — no Office required!
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3768 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/state.rs`
```
//! Document state persistence
//!
//! This module handles saving and loading document state (scroll position, search, view mode)
//! across sessions. State is stored in a platform-specific config directory.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

use crate::ui::ViewMode;

/// State for a single document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentState {
    /// Last scroll position (element index)
    pub scroll_offset: usize,
    /// Last search query
    pub last_search: String,
    /// Last view mode (Document, Outline, Search)
    #[serde(skip)]
    pub view_mode: ViewMode,
    /// When this document was last accessed
    #[serde(default = "SystemTime::now")]
    pub last_accessed: SystemTime,
}

impl Default for DocumentState {
    fn default() -> Self {
        Self {
            scroll_offset: 0,
            last_search: String::new(),
            view_mode: ViewMode::Document,
            last_accessed: SystemTime::now(),
        }
    }
}

/// Global state manager for all documents
#[derive(Debug, Serialize, Deserialize)]
pub struct StateManager {
    /// Map of absolute file paths to their state
    documents: HashMap<String, DocumentState>,
}

impl StateManager {
    /// Create a new empty state manager
    pub fn new() -> Self {
        Self {
            documents: HashMap::new(),
        }
    }

    /// Load state from disk, or create new if doesn't exist
    pub fn load() -> Result<Self> {
        let state_path = Self::state_file_path()?;

        if !state_path.exists() {
            return Ok(Self::new());
        }

        let contents = fs::read_to_string(&state_path).context("Failed to read state file")?;

        let mut manager: StateManager =
            serde_json::from_str(&contents).context("Failed to parse state file")?;

        // Clean up old entries (older than 90 days)
        manager.cleanup_old_entries(Duration::from_secs(90 * 24 * 60 * 60));

        Ok(manager)
    }

    /// Save state to disk
    pub fn save(&self) -> Result<()> {
        let state_path = Self::state_file_path()?;

        // Create parent directory if it doesn't exist
        if let Some(parent) = state_path.parent() {
            fs::create_dir_all(parent).context("Failed to create state directory")?;
        }

        let contents = serde_json::to_string_pretty(self).context("Failed to serialize state")?;

        fs::write(&state_path, contents).context("Failed to write state file")?;

        Ok(())
    }

    /// Get state for a document
    pub fn get_state(&self, file_path: &Path) -> Option<DocumentState> {
        let key = file_path.to_string_lossy().to_string();
        self.documents.get(&key).cloned()
    }

    /// Update state for a document
    pub fn set_state(&mut self, file_path: &Path, state: DocumentState) {
        let key = file_path.to_string_lossy().to_string();
        self.documents.insert(key, state);
    }

    /// Remove old entries that haven't been accessed recently
    fn cleanup_old_entries(&mut self, max_age: Duration) {
        let now = SystemTime::now();
        self.documents.retain(|_, state| {
            now.duration_since(state.last_accessed)
                .map(|age| age < max_age)
                .unwrap_or(false)
        });
    }

    /// Get the platform-specific state file path
    ///
    /// Returns:
    /// - macOS: ~/Library/Application Support/doxx/state.json
    /// - Linux: ~/.config/doxx/state.json
    /// - Windows: %APPDATA%\doxx\state.json
    fn state_file_path() -> Result<PathBuf> {
        let config_dir = dirs::config_dir().context("Failed to determine config directory")?;

        Ok(config_dir.join("doxx").join("state.json"))
    }
}

impl Default for StateManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_manager_new() {
        let manager = StateManager::new();
        assert_eq!(manager.documents.len(), 0);
    }

    #[test]
    fn test_set_and_get_state() {
        let mut manager = StateManager::new();
        let path = PathBuf::from("/test/document.docx");

        let state = DocumentState {
            scroll_offset: 42,
            last_search: "test".to_string(),
            view_mode: ViewMode::Search,
            last_accessed: SystemTime::now(),
        };

        manager.set_state(&path, state.clone());

        let retrieved = manager.get_state(&path).unwrap();
        assert_eq!(retrieved.scroll_offset, 42);
        assert_eq!(retrieved.last_search, "test");
    }

    #[test]
    fn test_cleanup_old_entries() {
        let mut manager = StateManager::new();
        let path = PathBuf::from("/test/old.docx");

        // Create a state with an old timestamp
        let old_time = SystemTime::now() - Duration::from_secs(100 * 24 * 60 * 60); // 100 days ago
        let state = DocumentState {
            scroll_offset: 0,
            last_search: String::new(),
            view_mode: ViewMode::Document,
            last_accessed: old_time,
        };

        manager.set_state(&path, state);
        assert_eq!(manager.documents.len(), 1);

        // Clean up entries older than 90 days
        manager.cleanup_old_entries(Duration::from_secs(90 * 24 * 60 * 60));

        // Old entry should be removed
        assert_eq!(manager.documents.len(), 0);
    }

    #[test]
    fn test_state_file_path_returns_path() {
        let path = StateManager::state_file_path();
        assert!(path.is_ok());
        let path = path.unwrap();
        assert!(path.ends_with("doxx/state.json") || path.ends_with("doxx\\state.json"));
    }
}

```

### Core Architecture Module: `src/ansi.rs`
```
use anyhow::Result;
use crossterm::style::{
    Attribute, Color as CrosstermColor, ResetColor, SetAttribute, SetForegroundColor,
};
use std::fmt::Write;
use unicode_segmentation::UnicodeSegmentation;
use unicode_width::UnicodeWidthStr;

use crate::{document::*, ColorDepth};

pub struct AnsiOptions {
    pub terminal_width: usize,
    pub color_depth: ColorDepth,
}

impl Default for AnsiOptions {
    fn default() -> Self {
        Self {
            terminal_width: std::env::var("COLUMNS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(80),
            color_depth: ColorDepth::Auto,
        }
    }
}

pub fn export_to_ansi_with_options(document: &Document, options: &AnsiOptions) -> Result<String> {
    let mut output = String::new();

    // Add document title
    write_ansi_heading(&mut output, &document.title, 1, options)?;
    output.push('\n');

    // Add metadata
    writeln!(
        output,
        "{}Document Information{}",
        format_ansi_text("", true, false, false, false, None, options),
        format_ansi_reset()
    )?;
    let prefix = "- File: ";
    let available = options.terminal_width.saturating_sub(prefix.len());
    let path = &document.metadata.file_path;
    let file_str = if UnicodeWidthStr::width(path.as_str()) <= available {
        path.clone()
    } else {
        let truncated: String = path
            .graphemes(true)
            .rev()
            .scan(0usize, |w, g| {
                *w += UnicodeWidthStr::width(g);
                if *w < available {
                    Some(g)
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();
        format!("…{truncated}")
    };
    writeln!(output, "{prefix}{file_str}")?;
    writeln!(output, "- Pages: {}", document.metadata.page_count)?;
    writeln!(output, "- Words: {}", document.metadata.word_count)?;
    if let Some(author) = &document.metadata.author {
        writeln!(output, "- Author: {author}")?;
    }
    output.push('\n');

    // Separator
    let separator = "=".repeat(std::cmp::min(50, options.terminal_width));
    writeln!(output, "{separator}")?;
    output.push('\n');

    // Convert document content
    for element in &document.elements {
        match element {
            DocumentElement::Heading {
                level,
                text,
                number,
            } => {
                let heading_text = if let Some(number) = number {
                    format!("{number} {text}")
                } else {
                    text.clone()
                };
                write_ansi_heading(&mut output, &heading_text, *level, options)?;
                output.push('\n');
            }
            DocumentElement::Paragraph { runs } => {
                if runs.is_empty() || runs.iter().all(|run| run.text.trim().is_empty()) {
                    continue;
                }
                write_ansi_paragraph(&mut output, runs, options)?;
                output.push('\n');
            }
            DocumentElement::List { items, ordered } => {
                write_ansi_list(&mut output, items, *ordered, options)?;
                output.push('\n');
            }
            DocumentElement::Table { table } => {
                write_ansi_table(&mut output, table, options)?;
                output.push('\n');
            }
            DocumentElement::Image { description, .. } => {
                writeln!(
                    output,
                    "{}🖼️  [Image: {}]{}",
                    format_ansi_color(Some("#FF00FF"), options), // Magenta
                    description,
                    format_ansi_reset()
                )?;
                output.push('\n');
            }
            DocumentElement::Equation { latex, .. } => {
                writeln!(
                    output,
                    "{}📐 {}{}",
                    format_ansi_color(Some("#00AAFF"), options), // Cyan
                    latex,
                    format_ansi_reset()
                )?;
                output.push('\n');
            }
            DocumentElement::CodeBlock { text } => {
                let code_color = format_ansi_color(Some("#AAFFAA"), options);
                let reset = format_ansi_reset();
                for line in text.lines() {
                    writeln!(output, "  {code_color}{line}{reset}")?;
                }
                output.push('\n');
            }
            DocumentElement::TextBox { lines } => {
                let border_color = format_ansi_color(Some("#00FFFF"), options);
                let reset = format_ansi_reset();
                let inner_width = options.terminal_width.saturating_sub(4);
                let bar = "─".repeat(options.terminal_width.saturating_sub(2));
                writeln!(output, "{border_color}┌{bar}┐{reset}")?;
                for line in lines {
                    let truncated: String = line.chars().take(inner_width).collect();
                    writeln!(
                        output,
                        "{border_color}│{reset} {truncated:<inner_width$} {border_color}│{reset}",
                        inner_width = inner_width
                    )?;
                }
                writeln!(output, "{border_color}└{bar}┘{reset}")?;
                output.push('\n');
            }
            DocumentElement::PageBreak => {
                let separator = "─".repeat(std::cmp::min(60, options.terminal_width));
                writeln!(
                    output,
                    "{}{}{}",
                    format_ansi_color(Some("#666666"), options), // Dark gray
                    separator,
                    format_ansi_reset()
                )?;
                output.push('\n');
            }
        }
    }

    Ok(output)
}

fn write_ansi_heading(
    output: &mut String,
    text: &str,
    level: u8,
    options: &AnsiOptions,
) -> Result<()> {
    let color = match level {
        1 => Some("#FFFF00"), // Yellow
        2 => Some("#00FF00"), // Green
        _ => Some("#00FFFF"), // Cyan
    };

    let prefix = match level {
        1 => "■ ",
        2 => "  ▶ ",
        3 => "    ◦ ",
        _ => "      • ",
    };

    let prefix_width = UnicodeWidthStr::width(prefix);
    let available_width = options.terminal_width.saturating_sub(prefix_width);
    let wrapped = wrap_plain_text(text, available_width);
    let indent = " ".repeat(prefix_width);

    for (i, line) in wrapped.iter().enumerate() {
        let display = if i == 0 {
            format!("{prefix}{line}")
        } else {
            format!("{indent}{line}")
        };
        writeln!(
            output,
            "{}",
            format_ansi_text(&display, true, false, false, false, color, options)
        )?;
    }

    Ok(())
}

fn wrap_plain_text(text: &str, max_width: usize) -> Vec<String> {
    if max_width == 0 {
        return vec![text.to_string()];
    }

    let mut lines = Vec::new();
    let mut current_line = String::new();
    let mut current_width = 0;

    for word in text.split_whitespace() {
        let word_width = UnicodeWidthStr::width(word);
        if current_width == 0 {
            current_line.push_str(word);
            current_width = word_width;
        } else if current_width + 1 + word_width > max_width {
            lines.push(current_line.clone());
            current_line = word.to_string();
            current_width = word_width;
        } else {
            current_line.push(' ');
            current_line.push_str(word);
            current_width += 1 + word_width;
        }
    }

    if !current_line.is_empty() {
        lines.push(current_line);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }

    lines
}

fn write_ansi_paragraph(
    output: &mut String,
    runs: &[FormattedRun],
    options: &AnsiOptions,
) -> Result<()> {
    let wrapped_lines = wrap_formatted_runs(runs, options);
    for line in wrapped_lines {
        writeln!(output, "{}{}", line, format_ansi_reset())?;
    }
    Ok(())
}

/// Wrap formatted text runs to terminal width while preserving formatting
fn wrap_formatted_runs(runs: &[FormattedRun], options: &AnsiOptions) -> Vec<String> {
    // Preserve the pre-merge empty-input behavior exactly (returns no lines,
    // rather than wrap_formatted_runs_with_width's `vec![String::new()]`) -
    // write_ansi_paragraph relies on this to emit nothing for an empty
    // paragraph. In practice runs is never empty (the parser only creates
    // Paragraph elements with non-empty text), but keep it explicit.
    if runs.is_empty() {
        return vec![];
    }
    wrap_formatted_runs_with_width(runs, options.terminal_width, options)
}

/// Get ANSI formatting codes for start of formatted text
fn get_ansi_format_start(
    bold: bool,
    italic: bool,
    underline: bool,
    strikethrough: bool,
    color: Option<&str>,
    options: &AnsiOptions,
) -> String {
    let mut result = String::new();

    if bold {
        result.push_str(&format!("{}", SetAttribute(Attribute::Bold)));
    }
    if italic {
        result.push_str(&format!("{}", SetAttribute(Attribute::Italic)));
    }
    if underline {
        result.push_str(&format!("{}", SetAttribute(Attribute::Underlined)));
    }
    if strikethrough {
        result.push_str(&format!("{}", SetAttribute(Attribute::CrossedOut)));
    }
    if let Some(color_hex) = color {
        result.push_str(&format_ansi_color(Some(color_hex), options));
    }

    result
}

fn write_ansi_list(
    output: &mut String,
    items: &[ListItem],
    ordered: bool,
    options: &AnsiOptions,
) -> Result<()> {
    for (i, item) in items.iter().enumerate() {
        let bullet = if ordered {
            format!("{}. ", i + 1)
        } else {
            "• ".to_string()
        };

        let indent = "  ".repeat(item.level as usi
```

### Core Architecture Module: `src/color.rs`
```
//! Shared color-parsing helpers.
//!
//! `parse_hex_rgb` was previously duplicated between `widgets::document`
//! (ratatui `Color::Rgb`) and `ansi` (crossterm `Color`, depth-aware) - both
//! need the same "#RRGGBB" -> (u8, u8, u8) parsing, they just build different
//! output types from the result.

/// Parse a "#RRGGBB" or "RRGGBB" hex color string into (r, g, b) bytes.
/// Returns `None` for anything that isn't exactly 6 hex digits.
pub(crate) fn parse_hex_rgb(hex: &str) -> Option<(u8, u8, u8)> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }

    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;

    Some((r, g, b))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_with_and_without_hash_prefix() {
        assert_eq!(parse_hex_rgb("#FF0000"), Some((255, 0, 0)));
        assert_eq!(parse_hex_rgb("FF0000"), Some((255, 0, 0)));
    }

    #[test]
    fn parses_mixed_case() {
        assert_eq!(parse_hex_rgb("#00ff80"), Some((0, 255, 128)));
    }

    #[test]
    fn rejects_wrong_length() {
        assert_eq!(parse_hex_rgb("#FFF"), None);
        assert_eq!(parse_hex_rgb("#FF00000"), None);
        assert_eq!(parse_hex_rgb(""), None);
    }

    #[test]
    fn rejects_non_hex_characters() {
        assert_eq!(parse_hex_rgb("#GGGGGG"), None);
    }
}

```

### Core Architecture Module: `src/config.rs`
```
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::keymap::{Action, KeyBinding, Keymap, KeymapPreset};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub keymap: KeymapConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeymapConfig {
    /// Preset name: "default", "vim", "less"
    #[serde(default = "default_preset")]
    pub preset: String,

    /// Custom key overrides: key string -> action string
    #[serde(default)]
    pub custom: HashMap<String, String>,
}

fn default_preset() -> String {
    "default".to_string()
}

impl Default for KeymapConfig {
    fn default() -> Self {
        Self {
            preset: default_preset(),
            custom: HashMap::new(),
        }
    }
}

impl Config {
    pub fn load() -> Result<Self> {
        let path = Self::config_file_path()?;
        if !path.exists() {
            return Ok(Self::default());
        }
        let contents = std::fs::read_to_string(&path)
            .with_context(|| format!("Failed to read config file: {}", path.display()))?;
        toml::from_str(&contents)
            .with_context(|| format!("Failed to parse config file: {}", path.display()))
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::config_file_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let contents = toml::to_string_pretty(self)?;
        std::fs::write(&path, contents)?;
        Ok(())
    }

    pub fn config_file_path() -> Result<PathBuf> {
        let dir = dirs::config_dir().context("Failed to determine config directory")?;
        Ok(dir.join("doxx").join("config.toml"))
    }

    /// Build a Keymap from this config (preset + custom overrides).
    pub fn build_keymap(&self) -> Keymap {
        let preset = match self.keymap.preset.as_str() {
            "vim" => KeymapPreset::Vim,
            "less" => KeymapPreset::Less,
            _ => KeymapPreset::Default,
        };

        let mut km = Keymap::from_preset(preset);

        for (key_str, action_str) in &self.keymap.custom {
            match (KeyBinding::parse_key(key_str), action_str.parse::<Action>()) {
                (Ok(key), Ok(action)) => km.bind(key, action),
                (Err(e), _) => eprintln!("doxx config: invalid key {:?}: {e}", key_str),
                (_, Err(e)) => eprintln!("doxx config: invalid action {:?}: {e}", action_str),
            }
        }

        km
    }

    /// Get a dot-path config value as a string (e.g. "keymap.preset").
    pub fn get_value(&self, key: &str) -> Option<String> {
        match key {
            "keymap.preset" => Some(self.keymap.preset.clone()),
            _ => None,
        }
    }

    /// Set a dot-path config value (e.g. "keymap.preset" = "vim").
    pub fn set_value(&mut self, key: &str, value: &str) -> Result<()> {
        match key {
            "keymap.preset" => {
                match value {
                    "default" | "vim" | "less" => self.keymap.preset = value.to_string(),
                    other => {
                        anyhow::bail!("Unknown keymap preset: {other}. Valid: default, vim, less")
                    }
                }
                Ok(())
            }
            other => anyhow::bail!("Unknown config key: {other}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keymap::KeyBinding;

    // Reproduces github.com/bgreenwell/doxx/issues/78: a vim-preset user remapped
    // scroll to Colemak-DH-friendly keys via [keymap.custom] and reported the
    // overrides had no effect.
    #[test]
    fn custom_overrides_from_issue_78_apply_on_top_of_preset() {
        let toml_str = r#"
            [keymap]
            preset = "vim"

            [keymap.custom]
            n = "scroll_up"
            m = "scroll_down"
        "#;

        let cfg: Config = toml::from_str(toml_str).expect("valid config.toml");
        let km = cfg.build_keymap();

        assert_eq!(
            km.get_action(&KeyBinding::char('n')),
            Some(Action::ScrollUp),
            "custom binding for 'n' should override the vim preset's default (search_next)"
        );
        assert_eq!(
            km.get_action(&KeyBinding::char('m')),
            Some(Action::ScrollDown),
            "custom binding for 'm' should apply (unbound in the vim preset)"
        );
    }
}

```

### Core Architecture Module: `src/document/cleanup.rs`
```
//! Post-processing and cleanup utilities
//!
//! This module provides helper functions for cleaning and processing
//! document elements after initial parsing.

use super::models::*;

pub(crate) fn is_likely_sentence(text: &str) -> bool {
    let text = text.trim();

    // If it contains multiple sentences, it's probably not a heading
    if text.matches(". ").count() > 1 {
        return true;
    }

    // If it ends with common sentence endings and is long, it's probably a sentence
    if text.len() > 80 && (text.ends_with('.') || text.ends_with('!') || text.ends_with('?')) {
        return true;
    }

    // If it contains common sentence connectors, it's likely a sentence
    if text.contains(" and ")
        || text.contains(" but ")
        || text.contains(" however ")
        || text.contains(" therefore ")
    {
        return true;
    }

    false
}

pub(crate) fn estimate_page_count(word_count: usize) -> usize {
    // Rough estimate: 250 words per page
    (word_count as f32 / 250.0).ceil() as usize
}

pub(crate) fn clean_word_list_markers(elements: Vec<DocumentElement>) -> Vec<DocumentElement> {
    elements
        .into_iter()
        .map(|element| match element {
            DocumentElement::Paragraph { runs } => {
                let cleaned_runs = runs
                    .into_iter()
                    .map(|mut run| {
                        if run.text.starts_with("__WORD_LIST__") {
                            run.text = run
                                .text
                                .strip_prefix("__WORD_LIST__")
                                .unwrap_or(&run.text)
                                .to_string();
                        }
                        run
                    })
                    .collect();
                DocumentElement::Paragraph { runs: cleaned_runs }
            }
            DocumentElement::List { items, ordered } => {
                let cleaned_items = items
                    .into_iter()
                    .map(|item| {
                        let combined_text: String =
                            item.runs.iter().map(|run| run.text.as_str()).collect();
                        let cleaned_runs = if combined_text.starts_with("__WORD_LIST__") {
                            // Remove the __WORD_LIST__ prefix from the first run
                            let mut new_runs = item.runs.clone();
                            if let Some(first_run) = new_runs.first_mut() {
                                first_run.text = first_run
                                    .text
                                    .strip_prefix("__WORD_LIST__")
                                    .unwrap_or(&first_run.text)
                                    .to_string();
                            }
                            new_runs
                        } else {
                            item.runs.clone()
                        };
                        ListItem {
                            runs: cleaned_runs,
                            level: item.level,
                        }
                    })
                    .collect();
                DocumentElement::List {
                    items: cleaned_items,
                    ordered,
                }
            }
            other => other,
        })
        .collect()
}

```

### Core Architecture Module: `src/document/io.rs`
```
//! File I/O operations and validation
//!
//! This module handles file validation and document merge operations.

use anyhow::{bail, Result};
use std::fs::File;
use std::path::Path;
use zip::ZipArchive;

use super::models::DocumentElement;

/// Validates that the file is a legitimate .docx file
pub(crate) fn validate_docx_file(file_path: &Path) -> Result<()> {
    // Check file extension
    let extension = file_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");

    if extension != "docx" {
        bail!(
            "Invalid file format. Expected .docx file, got .{}\n\
            Note: doxx only supports Word .docx files (not .doc, .xlsx, .zip, etc.)",
            extension
        );
    }

    // Check ZIP structure contains word/document.xml
    let file = File::open(file_path)?;
    let mut archive = ZipArchive::new(file)?;

    if archive.by_name("word/document.xml").is_err() {
        // Check if it might be an Excel file
        if archive.by_name("xl/workbook.xml").is_ok() {
            bail!(
                "This appears to be an Excel file (.xlsx).\n\
                doxx only supports Word documents (.docx)."
            );
        }

        bail!(
            "Invalid .docx file: missing word/document.xml\n\
            This file may be corrupted or is not a valid Word document."
        );
    }

    Ok(())
}

/// Merge display equations into the element list at their correct paragraph positions
///
/// This function handles the fact that docx-rs doesn't parse paragraphs containing only equations.
/// We need to track paragraph indices from the XML and insert equations at the right positions.
pub(crate) fn merge_display_equations(
    elements: Vec<DocumentElement>,
    display_equations_by_para: std::collections::HashMap<usize, Vec<DocumentElement>>,
) -> Vec<DocumentElement> {
    if display_equations_by_para.is_empty() {
        return elements;
    }

    // Get all paragraph indices with equations, sorted
    let mut eq_para_indices: Vec<usize> = display_equations_by_para.keys().copied().collect();
    eq_para_indices.sort_unstable();

    // Build a new element list with equations inserted at correct positions
    let mut result = Vec::new();
    let mut element_para_index = 0;

    for element in elements {
        // Increment paragraph counter for elements that correspond to paragraphs
        match &element {
            DocumentElement::Paragraph { .. }
            | DocumentElement::Heading { .. }
            | DocumentElement::List { .. } => {
                element_para_index += 1;

                // Insert any display equations that come before this element
                while let Some(&eq_idx) = eq_para_indices.first() {
                    if eq_idx < element_para_index {
                        if let Some(eqs) = display_equations_by_para.get(&eq_idx) {
                            result.extend(eqs.clone());
                        }
                        eq_para_indices.remove(0);
                    } else {
                        break;
                    }
                }
            }
            _ => {}
        }

        result.push(element);
    }

    // Add any remaining equations at the end
    for eq_idx in eq_para_indices {
        if let Some(eqs) = display_equations_by_para.get(&eq_idx) {
            result.extend(eqs.clone());
        }
    }

    result
}

```

### Core Architecture Module: `src/document/loader.rs`
```
//! Document loading and orchestration
//!
//! This module contains the main `load_document()` function that orchestrates
//! the entire document parsing process, coordinating all the specialized parsing
//! modules to transform a DOCX file into our internal Document representation.

use anyhow::Result;
use std::collections::HashMap;
use std::path::Path;

// Import types from the models module
use super::models::*;
// Import I/O functions
use super::io::{merge_display_equations, validate_docx_file};
// Import cleanup functions
use super::cleanup::{clean_word_list_markers, estimate_page_count};
// Import numbering management
use super::parsing::numbering::{
    analyze_heading_structure, HeadingInfo, HeadingNumberTracker, NumberingResolver,
};
// Import list processing
use super::parsing::list::group_list_items;
// Import formatting and text extraction
use super::parsing::formatting::{extract_paragraph_text, extract_run_formatting};
// Import heading detection
use super::parsing::heading::{detect_heading_from_text, detect_heading_with_numbering};
// Import table extraction
use super::parsing::table::extract_table_data;
// Import equation processing
use super::parsing::equation::{
    extract_equations_from_docx, extract_inline_equation_positions, ParagraphContent,
};
use crate::image_extractor::ImageExtractor;

/// Mutable state threaded through the document-tree walk in `load_document`.
struct ParsingState {
    elements: Vec<DocumentElement>,
    word_count: usize,
    numbering_resolver: NumberingResolver,
    heading_tracker: HeadingNumberTracker,
    image_extractor: Option<ImageExtractor>,
}

/// Main document loading function that orchestrates the entire parsing process
///
/// This function:
/// 1. Validates the DOCX file
/// 2. Extracts metadata (title, file size, etc.)
/// 3. Optionally extracts images
/// 4. Processes document structure (paragraphs, tables, headings, lists)
/// 5. Integrates equations (both inline and display)
/// 6. Post-processes elements (grouping lists, cleaning markers)
/// 7. Returns a fully parsed Document
pub fn load_document(file_path: &Path, image_options: ImageOptions) -> Result<Document> {
    // Validate file type before attempting to parse
    validate_docx_file(file_path)?;

    let file_size = std::fs::metadata(file_path)?.len();

    // For now, create a simple implementation that reads the docx file
    // This is a simplified version to get the project compiling
    let file_data = std::fs::read(file_path)?;
    let docx = docx_rs::read_docx(&file_data)?;

    let title = extract_title(file_path);

    let mut state = ParsingState {
        elements: Vec::new(),
        word_count: 0,
        numbering_resolver: NumberingResolver::build_from_docx(&docx.numberings),
        heading_tracker: build_heading_tracker(&docx.document),
        image_extractor: build_image_extractor(&image_options, file_path)?,
    };

    // Enhanced content extraction with style information
    for child in &docx.document.children {
        match child {
            docx_rs::DocumentChild::Paragraph(para) => process_paragraph(para, &mut state),
            docx_rs::DocumentChild::Table(table) => {
                // Extract table data
                if let Some(table_element) = extract_table_data(table) {
                    state.elements.push(table_element);
                }
            }
            _ => {
                // Handle other document elements (images, etc.) in future
            }
        }
    }

    let (elements, display_equations_by_para) = integrate_equations(state.elements, file_path);

    // Post-process to group consecutive list items (only for text-based lists)
    // Word numbering-based lists are already properly formatted
    let elements = group_list_items(elements);

    // Clean up Word list markers
    let elements = clean_word_list_markers(elements);

    // Merge display equations into the final element list at correct positions
    let elements = merge_display_equations(elements, display_equations_by_para);

    let metadata = build_metadata(file_path, file_size, state.word_count);

    Ok(Document {
        title,
        metadata,
        elements,
        image_options,
    })
}

/// Derive the document title from the file's stem (filename without extension).
fn extract_title(file_path: &Path) -> String {
    file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled Document")
        .to_string()
}

/// Build a heading number tracker, enabling auto-numbering if the document's
/// heading structure suggests it wasn't explicitly numbered by the author.
fn build_heading_tracker(document: &docx_rs::Document) -> HeadingNumberTracker {
    let mut tracker = HeadingNumberTracker::new();
    if analyze_heading_structure(document) {
        tracker.enable_auto_numbering();
    }
    tracker
}

/// Extract images up front (if enabled) so they're available for lookup
/// while walking the document tree.
fn build_image_extractor(
    image_options: &ImageOptions,
    file_path: &Path,
) -> Result<Option<ImageExtractor>> {
    if !image_options.enabled {
        return Ok(None);
    }
    let mut extractor = ImageExtractor::new()?;
    extractor.extract_images_from_docx(file_path)?;
    Ok(Some(extractor))
}

fn build_metadata(file_path: &Path, file_size: u64, word_count: usize) -> DocumentMetadata {
    DocumentMetadata {
        file_path: file_path.to_string_lossy().to_string(),
        file_size,
        word_count,
        page_count: estimate_page_count(word_count),
        created: None, // Simplified for now
        modified: None,
        author: None,
    }
}

/// Process a single top-level paragraph, pushing zero or more elements
/// (paragraph/heading/list-item/code-block, any inline images encountered,
/// and any text-box shapes) onto `state.elements`.
fn process_paragraph(para: &docx_rs::Paragraph, state: &mut ParsingState) {
    // Check for heading with potential numbering first
    let heading_info = detect_heading_with_numbering(para);

    // Check for list numbering properties (Word's automatic lists)
    let list_info = detect_list_from_paragraph_numbering(para);

    // Check for images in this paragraph first
    extract_inline_images(para, &state.image_extractor, &mut state.elements);

    // Detect paragraph style (used for code blocks, block quotes, etc.)
    let para_style = para
        .property
        .style
        .as_ref()
        .map(|s| s.val.as_str())
        .unwrap_or("");
    let is_code_block = para_style == "SourceCode" || para_style == "VerbatimChar";

    // Extract runs with individual formatting, preserving line breaks.
    // Text box shapes (DrawingData::TextBox) are collected separately so they
    // are always emitted as plain paragraphs regardless of the parent style.
    let (formatted_runs, textbox_groups) = extract_formatted_runs(para);

    // Calculate total text for word count and processing
    let total_text: String = formatted_runs.iter().map(|run| run.text.as_str()).collect();

    if !total_text.trim().is_empty() {
        state.word_count += total_text.split_whitespace().count();

        // Priority: code block > list numbering > heading style > text heuristics
        push_paragraph_element(
            &total_text,
            formatted_runs,
            is_code_block,
            list_info,
            heading_info,
            &mut state.numbering_resolver,
            &mut state.heading_tracker,
            &mut state.elements,
        );
    }

    // Emit each text box as a distinct TextBox element (one per shape)
    for group in textbox_groups {
        state.word_count += group
            .iter()
            .map(|s| s.split_whitespace().count())
            .sum::<usize>();
        state
            .elements
            .push(DocumentElement::TextBox { lines: group });
    }
}

/// Detect Drawing runs in a paragraph and, if an extracted image is available
/// for this position, push an Image element (maintaining document order).
fn extract_inline_images(
    para: &docx_rs::Paragraph,
    image_extractor: &Option<ImageExtractor>,
    elements: &mut Vec<DocumentElement>,
) {
    for child in &para.children {
        if let docx_rs::ParagraphChild::Run(run) = child {
            for run_child in &run.children {
                if let docx_rs::RunChild::Drawing(_drawing) = run_child {
                    // Create an Image element with consistent ordering
                    if let Some(extractor) = image_extractor {
                        let images = extractor.get_extracted_images_sorted();
                        if !images.is_empty() {
                            // Count images processed so far to maintain document order
                            let image_count = elements
                                .iter()
                                .filter(|e| matches!(e, DocumentElement::Image { .. }))
                                .count();

                            // Only create Image element if we have an actual image file available
                            if image_count < images.len() {
                                let (_, image_path) = &images[image_count];

                                elements.push(DocumentElement::Image {
                                    description: format!("Image {}", image_count + 1),
                                    width: None,
                                    height: None,
                                    relationship_id: None,
                                    image_path: Some(image_path.clone()),
                                });
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Walk a paragraph's runs, extracting formatted text runs and any text-box
/// shape content (which is collected separately from the run stream).
fn extract_formatted_runs(para: &docx_rs::Paragraph) -> (Vec<FormattedRun>, Vec<
```

### Core Architecture Module: `src/document/mod.rs`
```
//! Document parsing and data structures module
//!
//! This module provides functionality for parsing Microsoft Word (.docx) documents
//! and converting them into a structured representation.
//!
//! During refactoring: Incrementally extracting modules

pub(crate) mod cleanup;
pub(crate) mod io;
pub(crate) mod loader;
pub mod models;
pub(crate) mod parsing;
pub mod query;

// Re-export all models and query functions
pub use models::*;
pub use query::*;

// Re-export main document loading function
pub use loader::load_document;

```

### Core Architecture Module: `src/document/models.rs`
```
//! Core data structures for document representation
//!
//! This module defines all the public types used to represent a parsed document,
//! including elements, formatting, tables, and metadata.

use serde::{Deserialize, Serialize};

// Type aliases for convenience
pub type TableRows = Vec<Vec<TableCell>>;
pub type NumberingInfo = (i32, u8);

/// Image rendering options
#[derive(Debug, Clone, Default)]
pub struct ImageOptions {
    pub enabled: bool,
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
    pub scale: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub title: String,
    pub metadata: DocumentMetadata,
    pub elements: Vec<DocumentElement>,
    #[serde(skip)]
    pub image_options: ImageOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub file_path: String,
    pub file_size: u64,
    pub word_count: usize,
    pub page_count: usize,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub author: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DocumentElement {
    Heading {
        level: u8,
        text: String,
        number: Option<String>,
    },
    Paragraph {
        runs: Vec<FormattedRun>,
    },
    List {
        items: Vec<ListItem>,
        ordered: bool,
    },
    Table {
        table: TableData,
    },
    Image {
        description: String,
        width: Option<u32>,
        height: Option<u32>,
        relationship_id: Option<String>, // Link to DOCX relationship for image extraction
        image_path: Option<std::path::PathBuf>, // Path to extracted image file
    },
    Equation {
        latex: String,
        fallback: String,
    },
    CodeBlock {
        text: String,
    },
    TextBox {
        lines: Vec<String>,
    },
    PageBreak,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct TextFormatting {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strikethrough: bool,
    pub font_size: Option<f32>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormattedRun {
    pub text: String,
    pub formatting: TextFormatting,
}

impl FormattedRun {
    /// Consolidate adjacent runs with identical formatting into single runs
    pub fn consolidate_runs(runs: Vec<FormattedRun>) -> Vec<FormattedRun> {
        if runs.is_empty() {
            return runs;
        }

        let mut consolidated = Vec::new();
        let mut current_run = runs[0].clone();

        for run in runs.into_iter().skip(1) {
            if current_run.formatting == run.formatting {
                // Same formatting - merge the text
                current_run.text.push_str(&run.text);
            } else {
                // Different formatting - push current and start new
                consolidated.push(current_run);
                current_run = run;
            }
        }

        // last run
        consolidated.push(current_run);
        consolidated
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListItem {
    pub runs: Vec<FormattedRun>,
    pub level: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableData {
    pub headers: Vec<TableCell>,
    pub rows: Vec<Vec<TableCell>>,
    pub metadata: TableMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableCell {
    pub content: String,
    pub alignment: TextAlignment,
    pub formatting: TextFormatting,
    pub data_type: CellDataType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableMetadata {
    pub column_count: usize,
    pub row_count: usize,
    pub has_headers: bool,
    pub column_widths: Vec<usize>,
    pub column_alignments: Vec<TextAlignment>,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
pub enum TextAlignment {
    #[default]
    Left,
    Center,
    Right,
    Justify,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
pub enum CellDataType {
    #[default]
    Text,
    Number,
    Currency,
    Percentage,
    Date,
    Boolean,
    Empty,
}

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub element_index: usize,
    pub text: String,
    #[allow(dead_code)]
    pub start_pos: usize,
    #[allow(dead_code)]
    pub end_pos: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlineItem {
    pub title: String,
    pub level: u8,
    pub element_index: usize,
}

```

### Core Architecture Module: `src/document/parsing/equation.rs`
```
//! Equation extraction and OMML to LaTeX conversion
//!
//! This module handles extraction of mathematical equations from Word documents
//! and conversion from OMML (Office Math Markup Language) to LaTeX format.

use anyhow::Result;
use std::path::Path;

/// Equation type and context information
#[derive(Debug, Clone)]
pub(crate) struct EquationInfo {
    pub(crate) latex: String,
    pub(crate) fallback: String,
    pub(crate) is_inline: bool,
    pub(crate) paragraph_index: usize,
}

/// Represents content within a paragraph (text or inline equation)
#[derive(Debug, Clone)]
pub(crate) enum ParagraphContent {
    Text(String),
    #[allow(dead_code)] // fallback may be used for UI display in future
    InlineEquation {
        latex: String,
        fallback: String,
    },
}

/// Parse paragraphs with inline equations directly from XML
/// Returns a map of paragraph index to ordered content (text and inline equations)
pub(crate) fn extract_inline_equation_positions(
    file_path: &Path,
) -> Result<std::collections::HashMap<usize, Vec<ParagraphContent>>> {
    use quick_xml::events::Event;
    use quick_xml::Reader;
    use std::fs::File;
    use std::io::Read;
    use zip::ZipArchive;

    let file = File::open(file_path)?;
    let mut archive = ZipArchive::new(file)?;

    // Read word/document.xml
    let mut document_xml = String::new();
    let mut xml_file = archive.by_name("word/document.xml")?;
    xml_file.read_to_string(&mut document_xml)?;

    let mut paragraphs: std::collections::HashMap<usize, Vec<ParagraphContent>> =
        std::collections::HashMap::new();
    let mut reader = Reader::from_str(&document_xml);
    reader.config_mut().trim_text(false); // Don't trim to preserve spacing

    let mut buf = Vec::new();
    let mut in_paragraph = false;
    let mut in_math = false;
    let mut in_math_para = false; // Track if we're in a display equation
    let mut in_text_run = false;
    let mut current_paragraph_index = 0;
    let mut current_paragraph_content: Vec<ParagraphContent> = Vec::new();
    let mut current_text = String::new();
    let mut current_omml = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"w:p" => {
                in_paragraph = true;
                current_paragraph_index += 1;
                current_paragraph_content.clear();
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"w:p" => {
                in_paragraph = false;
                if !current_paragraph_content.is_empty() {
                    paragraphs.insert(current_paragraph_index, current_paragraph_content.clone());
                }
            }
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"m:oMathPara" => {
                in_math_para = true;
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"m:oMathPara" => {
                in_math_para = false;
            }
            Ok(Event::Start(ref e))
                if e.name().as_ref() == b"m:oMath" && in_paragraph && !in_math_para =>
            {
                // Inline equation (not wrapped in oMathPara)
                in_math = true;
                current_omml.clear();
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"m:oMath" && in_math => {
                in_math = false;
                let (latex, fallback) = parse_simple_omml(&current_omml);
                current_paragraph_content
                    .push(ParagraphContent::InlineEquation { latex, fallback });
                current_omml.clear();
            }
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"w:t" && in_paragraph && !in_math => {
                in_text_run = true;
                current_text.clear();
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"w:t" && in_text_run => {
                in_text_run = false;
                if !current_text.is_empty() {
                    current_paragraph_content.push(ParagraphContent::Text(current_text.clone()));
                }
            }
            Ok(Event::Text(ref e)) if in_text_run => {
                current_text.push_str(&e.unescape().unwrap_or_default());
            }
            // Capture OMML content for inline equations
            Ok(Event::Start(ref e)) if in_math => {
                let name_ref = e.name();
                let tag_name = std::str::from_utf8(name_ref.as_ref()).unwrap_or("");
                current_omml.push('<');
                current_omml.push_str(tag_name);
                for a in e.attributes().flatten() {
                    let key = std::str::from_utf8(a.key.as_ref()).unwrap_or("");
                    let value = String::from_utf8_lossy(&a.value);
                    current_omml.push(' ');
                    current_omml.push_str(key);
                    current_omml.push_str("=\"");
                    current_omml.push_str(&value);
                    current_omml.push('"');
                }
                current_omml.push('>');
            }
            Ok(Event::End(ref e)) if in_math => {
                let name_ref = e.name();
                let tag_name = std::str::from_utf8(name_ref.as_ref()).unwrap_or("");
                current_omml.push_str("</");
                current_omml.push_str(tag_name);
                current_omml.push('>');
            }
            Ok(Event::Empty(ref e)) if in_math => {
                let name_ref = e.name();
                let tag_name = std::str::from_utf8(name_ref.as_ref()).unwrap_or("");
                current_omml.push('<');
                current_omml.push_str(tag_name);
                for a in e.attributes().flatten() {
                    let key = std::str::from_utf8(a.key.as_ref()).unwrap_or("");
                    let value = String::from_utf8_lossy(&a.value);
                    current_omml.push(' ');
                    current_omml.push_str(key);
                    current_omml.push_str("=\"");
                    current_omml.push_str(&value);
                    current_omml.push('"');
                }
                current_omml.push_str("/>");
            }
            Ok(Event::Text(ref e)) if in_math => {
                current_omml.push_str(&e.unescape().unwrap_or_default());
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                eprintln!("Error reading XML for inline equations: {e}");
                break;
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(paragraphs)
}

/// Extract equations from .docx file by reading raw XML
/// Since docx-rs doesn't expose OMML (Office Math Markup Language), we parse the ZIP directly
pub(crate) fn extract_equations_from_docx(file_path: &Path) -> Result<Vec<EquationInfo>> {
    use quick_xml::events::Event;
    use quick_xml::Reader;
    use std::fs::File;
    use std::io::Read;
    use zip::ZipArchive;

    let file = File::open(file_path)?;
    let mut archive = ZipArchive::new(file)?;

    // Read word/document.xml
    let mut document_xml = String::new();
    let mut xml_file = archive.by_name("word/document.xml")?;
    xml_file.read_to_string(&mut document_xml)?;

    let mut equations = Vec::new();
    let mut reader = Reader::from_str(&document_xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut in_math = false;
    let mut in_math_para = false;
    let mut current_omml = String::new();
    let mut current_paragraph_index = 0;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"w:p" => {
                current_paragraph_index += 1;
            }
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"m:oMathPara" => {
                in_math_para = true;
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"m:oMathPara" => {
                in_math_para = false;
            }
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"m:oMath" => {
                in_math = true;
                current_omml.clear();
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"m:oMath" => {
                in_math = false;

                // Parse the collected OMML to LaTeX
                let (latex, fallback) = parse_simple_omml(&current_omml);

                // Inline equations are NOT wrapped in <m:oMathPara>
                let is_inline = !in_math_para;

                equations.push(EquationInfo {
                    latex,
                    fallback,
                    is_inline,
                    paragraph_index: current_paragraph_index,
                });
                current_omml.clear();
            }
            Ok(Event::Start(ref e)) if in_math => {
                let name_ref = e.name();
                let tag_name = std::str::from_utf8(name_ref.as_ref()).unwrap_or("");
                current_omml.push('<');
                current_omml.push_str(tag_name);

                // Capture attributes (e.g., m:chr m:val="∑")
                for a in e.attributes().flatten() {
                    let key = std::str::from_utf8(a.key.as_ref()).unwrap_or("");
                    let value = String::from_utf8_lossy(&a.value);
                    current_omml.push(' ');
                    current_omml.push_str(key);
                    current_omml.push_str("=\"");
                    current_omml.push_str(&value);
                    current_omml.push('"');
                }
                current_omml.push('>');
            }
            Ok(Event::End(ref e)) if in_math => {
                let name_ref = e.name();
                let tag_name = std::str::from_utf8(name_ref.as_ref()).unwrap_or("");
                current_omml.push_str("</");
                current_omml.push_str(tag_name);
                current_omml.push('>');
            }
            Ok(Event::Empty(ref e)) if in_math => {
            
```

### Core Architecture Module: `src/document/parsing/formatting.rs`
```
//! Text extraction and formatting utilities
//!
//! This module handles extraction of text and formatting information
//! from docx-rs paragraph and run elements.

use super::super::models::*;

/// Extract plain text from a paragraph, handling various child elements
pub(crate) fn extract_paragraph_text(para: &docx_rs::Paragraph) -> String {
    let mut text = String::new();

    for child in &para.children {
        match child {
            docx_rs::ParagraphChild::Run(run) => {
                text.push_str(&extract_run_text(run));
            }
            docx_rs::ParagraphChild::Insert(insert) => {
                // Handle insertions (track changes) - simplified approach
                // Since InsertChild might be different from Run, we'll extract text differently
                // This is a placeholder - in practice we'd need to handle the specific types
                for child in &insert.children {
                    if let docx_rs::InsertChild::Run(run) = child {
                        text.push_str(&extract_run_text(run));
                    }
                }
            }
            docx_rs::ParagraphChild::Delete(_) => {
                // Skip deletions (track changes)
            }
            _ => {
                // Handle other paragraph children if needed
            }
        }
    }

    text.trim().to_string()
}

/// Extract text from a run using docx-rs features
pub(crate) fn extract_run_text(run: &docx_rs::Run) -> String {
    let mut text = String::new();

    for child in &run.children {
        match child {
            docx_rs::RunChild::Text(text_elem) => {
                text.push_str(&text_elem.text);
            }
            docx_rs::RunChild::Tab(_) => {
                text.push('\t');
            }
            docx_rs::RunChild::Break(_) => {
                // Break types are private, so we'll just add a line break
                text.push('\n');
            }
            docx_rs::RunChild::Drawing(_) => {
                text.push_str("[Image]");
            }
            _ => {
                // Handle other run children
            }
        }
    }

    text
}

/// Extract formatting information from a run
pub(crate) fn extract_run_formatting(run: &docx_rs::Run) -> TextFormatting {
    let mut formatting = TextFormatting::default();

    // Access run properties directly (they're not optional in current API)
    let props = &run.run_property;
    formatting.bold = props.bold.is_some();
    formatting.italic = props.italic.is_some();
    formatting.underline = props.underline.is_some();

    formatting.strikethrough = props.strike.is_some() || props.dstrike.is_some();

    // Extract color information
    if let Some(color) = &props.color {
        // Extract color value through debug formatting as a workaround for private field access
        let color_debug = format!("{color:?}");
        if let Some(start) = color_debug.find("val: \"") {
            // Safe: searching for ASCII strings in debug output
            let search_from = start + 6; // length of "val: \""
            if let Some(end) = color_debug[search_from..].find("\"") {
                let color_val = &color_debug[search_from..search_from + end];
                formatting.color = Some(color_val.to_string());
            }
        }
    }

    // For now, skip font size extraction due to API complexity
    // TODO: Add font size extraction when we understand the API better

    formatting
}

/// Extract numbering information from docx-rs numbering properties
pub(crate) fn extract_numbering_info(num_pr: &docx_rs::NumberingProperty) -> Option<NumberingInfo> {
    let num_id = num_pr.id.as_ref()?.id as i32;
    let level = num_pr.level.as_ref().map(|l| l.val as u8).unwrap_or(0);
    Some((num_id, level))
}

/// Reconstruct heading number from Word's numbering system
pub(crate) fn reconstruct_heading_number(num_id: i32, level: u8, heading_level: u8) -> String {
    // This is a simplified reconstruction
    // In a full implementation, we'd need to access the numbering definitions
    // and track the current state across the document
    match (num_id, level, heading_level) {
        // Standard heading numbering schemes
        (_, 0, 1) => "1".to_string(),
        (_, 1, 2) => "1.1".to_string(),
        (_, 2, 3) => "1.1.1".to_string(),
        (_, 3, 4) => "1.1.1.1".to_string(),
        _ => {
            // Fallback based on heading level
            match heading_level {
                1 => "1".to_string(),
                2 => "1.1".to_string(),
                3 => "1.1.1".to_string(),
                _ => "1.1.1.1".to_string(),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use docx_rs::{BreakType, IndentLevel, NumberingId, NumberingProperty, Paragraph, Run};

    #[test]
    fn extract_run_text_handles_text_tab_and_break() {
        let run = Run::new()
            .add_text("hello")
            .add_tab()
            .add_text("world")
            .add_break(BreakType::TextWrapping);
        assert_eq!(extract_run_text(&run), "hello\tworld\n");
    }

    #[test]
    fn extract_paragraph_text_concatenates_runs_and_trims() {
        let para = Paragraph::new()
            .add_run(Run::new().add_text("  Hello, "))
            .add_run(Run::new().add_text("world!  "));
        assert_eq!(extract_paragraph_text(&para), "Hello, world!");
    }

    #[test]
    fn extract_paragraph_text_empty_paragraph_is_empty_string() {
        let para = Paragraph::new();
        assert_eq!(extract_paragraph_text(&para), "");
    }

    #[test]
    fn extract_run_formatting_detects_bold_italic_underline_strike() {
        let run = Run::new()
            .add_text("styled")
            .bold()
            .italic()
            .underline("single")
            .strike();
        let fmt = extract_run_formatting(&run);
        assert!(fmt.bold);
        assert!(fmt.italic);
        assert!(fmt.underline);
        assert!(fmt.strikethrough);
    }

    #[test]
    fn extract_run_formatting_dstrike_also_sets_strikethrough() {
        let run = Run::new().add_text("x").dstrike();
        assert!(extract_run_formatting(&run).strikethrough);
    }

    #[test]
    fn extract_run_formatting_plain_run_has_no_formatting() {
        let run = Run::new().add_text("plain");
        let fmt = extract_run_formatting(&run);
        assert!(!fmt.bold);
        assert!(!fmt.italic);
        assert!(!fmt.underline);
        assert!(!fmt.strikethrough);
        assert!(fmt.color.is_none());
    }

    #[test]
    fn extract_run_formatting_extracts_color_hex() {
        // Regression test for the Debug-string-scraping workaround in
        // extract_run_formatting - docx-rs doesn't expose the color field
        // publicly, so this parses `format!("{color:?}")` output. If that
        // Debug format ever changes, this test should catch it.
        let run = Run::new().add_text("red").color("FF0000");
        let fmt = extract_run_formatting(&run);
        assert_eq!(fmt.color.as_deref(), Some("FF0000"));
    }

    #[test]
    fn extract_numbering_info_returns_id_and_level() {
        let num_pr = NumberingProperty::new().add_num(NumberingId::new(3), IndentLevel::new(1));
        assert_eq!(extract_numbering_info(&num_pr), Some((3, 1)));
    }

    #[test]
    fn extract_numbering_info_defaults_level_to_zero_when_absent() {
        let num_pr = NumberingProperty::new().id(NumberingId::new(5));
        assert_eq!(extract_numbering_info(&num_pr), Some((5, 0)));
    }

    #[test]
    fn extract_numbering_info_none_without_an_id() {
        let num_pr = NumberingProperty::new();
        assert_eq!(extract_numbering_info(&num_pr), None);
    }

    #[test]
    fn reconstruct_heading_number_maps_level_to_dotted_number() {
        assert_eq!(reconstruct_heading_number(1, 0, 1), "1");
        assert_eq!(reconstruct_heading_number(1, 1, 2), "1.1");
        assert_eq!(reconstruct_heading_number(1, 2, 3), "1.1.1");
        assert_eq!(reconstruct_heading_number(1, 3, 4), "1.1.1.1");
    }

    #[test]
    fn reconstruct_heading_number_falls_back_on_heading_level_alone() {
        // (num_id, level) combination doesn't match a known pattern - falls
        // back to heading_level-only logic.
        assert_eq!(reconstruct_heading_number(1, 9, 2), "1.1");
        assert_eq!(reconstruct_heading_number(1, 9, 5), "1.1.1.1");
    }
}

```

### Core Architecture Module: `src/document/parsing/heading.rs`
```
//! Heading detection and classification
//!
//! This module handles detection of headings from Word paragraphs,
//! including style-based detection, text-based heuristics, and
//! numbering extraction.

use super::super::cleanup::is_likely_sentence;
use super::super::models::*;
use super::formatting::{
    extract_numbering_info, extract_paragraph_text, reconstruct_heading_number,
};
use super::list::is_likely_list_item;
use super::numbering::{extract_heading_number_from_text, HeadingInfo};

/// Detect heading level from Word paragraph style
pub(crate) fn detect_heading_from_paragraph_style(para: &docx_rs::Paragraph) -> Option<u8> {
    // Try to access paragraph properties and style
    if let Some(style) = &para.property.style {
        // Check for heading styles (Heading1, Heading2, etc.)
        if style.val.starts_with("Heading") || style.val.starts_with("heading") {
            if let Some(level_char) = style.val.chars().last() {
                if let Some(level) = level_char.to_digit(10) {
                    return Some(level.min(6) as u8);
                }
            }
            // Default to level 1 for unspecified heading styles
            return Some(1);
        }
    }

    None
}

/// Detect heading with automatic or manual numbering
pub(crate) fn detect_heading_with_numbering(para: &docx_rs::Paragraph) -> Option<HeadingInfo> {
    // First check if this is a heading style
    let heading_level = detect_heading_from_paragraph_style(para)?;

    // Extract text using docx-rs proper text extraction
    let text = extract_paragraph_text(para);

    // Priority order for numbering detection:
    // 1. Manual numbering in text content (highest priority - user explicitly typed)
    // 2. Word's automatic numbering (w:numPr) - explicit numbering properties
    // 3. Style-based automatic generation (lowest priority - our inference)

    // First, check for manual numbering in text content
    if let Some((number, remaining_text)) = extract_heading_number_from_text(&text) {
        return Some(HeadingInfo {
            level: heading_level,
            number: Some(number),
            clean_text: Some(remaining_text),
        });
    }

    // Second, check for Word's automatic numbering
    if let Some(num_pr) = &para.property.numbering_property {
        // This is automatic Word numbering - try to reconstruct
        if let Some((num_id, level)) = extract_numbering_info(num_pr) {
            let number = reconstruct_heading_number(num_id, level, heading_level);
            return Some(HeadingInfo {
                level: heading_level,
                number: Some(number),
                clean_text: Some(text), // Keep original text since number is automatic
            });
        }
    }

    // If no numbering found, return heading info without number
    Some(HeadingInfo {
        level: heading_level,
        number: None,
        clean_text: None,
    })
}

/// Detect headings based on text content and formatting heuristics
pub(crate) fn detect_heading_from_text(text: &str, formatting: &TextFormatting) -> Option<u8> {
    let text = text.trim();

    // Be much more conservative and selective
    if text.len() < 100 && !text.contains('\n') {
        // Exclude common non-heading patterns first
        if is_likely_list_item(text) || is_likely_sentence(text) {
            return None;
        }

        // Exclude if it contains typical sentence patterns
        if text.contains(" the ")
            || text.contains(" and ")
            || text.contains(" with ")
            || text.contains(" for ")
        {
            return None;
        }

        // Strong indicators of headings
        if formatting.bold && text.len() < 60 && text.len() > 5 {
            // Bold text that's reasonably short is likely a heading
            if !text.ends_with('.')
                && !text.ends_with(',')
                && !text.ends_with(';')
                && !text.ends_with(':')
            {
                return Some(determine_heading_level_from_text(text));
            }
        }

        // Check if it's all caps (but not just a short word)
        if text.len() > 15
            && text.len() < 50
            && text.chars().all(|c| {
                c.is_uppercase() || c.is_whitespace() || c.is_numeric() || c.is_ascii_punctuation()
            })
        {
            return Some(1);
        }

        // Very specific patterns that indicate headings
        if text.starts_with("Chapter ") || text.starts_with("Section ") || text.starts_with("Part ")
        {
            return Some(determine_heading_level_from_text(text));
        }

        // Look for standalone phrases that could be headings (very conservative)
        if text.len() < 40
            && text.len() > 10
            && !text.ends_with('.')
            && !text.contains(',')
            && !text.contains('(')
            && !text.contains(':')
        {
            // Check if it has heading-like characteristics
            let words = text.split_whitespace().count();
            if (2..=5).contains(&words) {
                // Must contain at least one meaningful word (longer than 3 chars)
                let has_meaningful_word = text
                    .split_whitespace()
                    .any(|word| word.len() > 3 && word.chars().all(|c| c.is_alphabetic()));

                if has_meaningful_word && text.chars().next().is_some_and(|c| c.is_uppercase()) {
                    return Some(determine_heading_level_from_text(text));
                }
            }
        }
    }

    None
}

/// Determine heading level from text length heuristic
pub(crate) fn determine_heading_level_from_text(text: &str) -> u8 {
    // Simple heuristic: shorter text = higher level (lower number)
    if text.len() < 20 {
        1
    } else if text.len() < 40 {
        2
    } else {
        3
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_heading_number_extraction() {
        // Test most common formats (decimal hierarchical)
        assert_eq!(
            extract_heading_number_from_text("1. Introduction"),
            Some(("1".to_string(), "Introduction".to_string()))
        );

        assert_eq!(
            extract_heading_number_from_text("1.1 Project Overview"),
            Some(("1.1".to_string(), "Project Overview".to_string()))
        );

        assert_eq!(
            extract_heading_number_from_text("2.1.1 Something Important"),
            Some(("2.1.1".to_string(), "Something Important".to_string()))
        );

        // Test alternative numbering schemes
        assert_eq!(
            extract_heading_number_from_text("A. First Section"),
            Some(("A".to_string(), "First Section".to_string()))
        );

        assert_eq!(
            extract_heading_number_from_text("I. Roman Numeral"),
            Some(("I".to_string(), "Roman Numeral".to_string()))
        );

        // Test section numbering
        assert_eq!(
            extract_heading_number_from_text("Section 1.2 Overview"),
            Some(("Section 1.2".to_string(), "Overview".to_string()))
        );

        // Test no numbering (should fall back to automatic generation)
        assert_eq!(extract_heading_number_from_text("Introduction"), None);

        // Test titles with numbers that should NOT be treated as numbered headings
        assert_eq!(extract_heading_number_from_text("Heading 1"), None);
        // Note: "Chapter 5 Summary" will match the section pattern, which is intentional
        // The section pattern is designed to match "Chapter 5 Something" formats
        assert_eq!(
            extract_heading_number_from_text("Chapter 5 Summary"),
            Some(("Chapter 5".to_string(), "Summary".to_string()))
        );
        assert_eq!(extract_heading_number_from_text("Version 2"), None);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #83** (2026-07-15): **TUI text wrapping splits words mid-character (unlike ANSI export)**
  *Symptoms*: ## Description  The TUI's text wrapper (`wrap_formatted_runs` in `src/widgets/document.rs:86`) wraps at the grapheme level with no word-boundary awareness, so a word that doesn't fit at the end of a line gets split mid-word instead of moving to the next line.  This is inconsistent with the ANSI export path (`wrap_formatted_runs_with_width` in `src/ansi.rs:438`), which already does proper word-boundary wrapping (builds up a word, only flushes it to the current line if it fits, otherwise starts a new line).  ## Current behavior  In the interactive TUI, narrow terminal widths (or long words near the wrap column) can produce lines like:  ``` This paragraph has some very long wo rds that get split awkwardly. ```  ## Expected behavior  Matching the ANSI export path:  ``` This paragraph has some very long words that get split awkwardly. ```  ## Why this wasn't just fixed alongside the ANSI dedup  While deduplicating the (near-identical) word-wrap logic between `wrap_formatted_runs` and `wrap_formatted_runs_with_width` in `ansi.rs`, I confirmed the TUI wrapper is a genuinely different implementation, not just a copy-pasted duplicate:  - It outputs `ratatui::text::Line`/`Span` with `Style` objects, not raw ANSI-escaped strings. - It has search-match highlighting baked in per-character (`search_matches` parameter, background color per grapheme), which the ANSI path doesn't need at all. - It's called through `LayoutCache` (`src/widgets/mod.rs`), which caches wrapped lines by `(element_i

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

### Incident Patch 1: `062819a1` (2026-08-09)
**Commit Message**: docs: add Built With Ratatui badge

**File**: `README.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 [![CI](https://img.shields.io/github/actions/workflow/status/bgreenwell/doxx/ci.yml?style=for-the-badge)](https://github.com/bgreenwell/doxx/actions/workflows/ci.yml)
 [![Crates.io](https://img.shields.io/crates/v/doxx.svg?style=for-the-badge&color=%232B579A)](https://crates.io/crates/doxx)
 [![Downloads](https://img.shields.io/crates/d/doxx?style=for-the-badge&color=%232B579A)](https://crates.io/crates/doxx)
+[![Built With Ratatui](https://img.shields.io/badge/Built_With_Ratatui-000?logo=ratatui&logoColor=fff)](https://ratatui.rs/)
 
 [![License: MIT](https://img.shields.io/badge/License-MIT-%232196F3.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
 [![Rust](https://img.shields.io/badge/rust-1.88%2B-%23D34516.svg?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
```

---

### Incident Patch 2: `9128f0fb` (2026-07-15)
**Commit Message**: Merge pull request #96 from bgreenwell/fix/tui-word-wrap

fix(tui): wrap text at word boundaries instead of mid-character

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 - Custom key bindings for the spacebar were silently dropped due to whitespace trimming during config parsing
+- TUI text wrapping now breaks at word boundaries instead of splitting words mid-character, matching the ANSI export ([#83](https://github.com/bgreenwell/doxx/issues/83))
 
 ## [0.1.4] - 2026-05-26
 
```

**File**: `src/widgets/document.rs` (modified, +111/-9)
```diff
@@ -99,6 +99,13 @@ impl<'a> DocumentWidget<'a> {
         let mut current_width = 0;
         let mut char_position = 0; // Track absolute character position across all runs
 
+        // Graphemes are buffered into `word` until a space/newline boundary, so a word
+        // that doesn't fit at the end of a line moves to the next line as a whole
+        // instead of being split mid-word. Mirrors the word/word_width accumulator in
+        // ansi.rs's wrap_formatted_runs_with_width.
+        let mut word: Vec<Span> = Vec::new();
+        let mut word_width = 0;
+
         for run in runs {
             let mut base_style = Style::default();
 
@@ -145,23 +152,43 @@ impl<'a> DocumentWidget<'a> {
                     }
                 }
 
-                // Check if adding this grapheme would exceed max width
-                if current_width + g_width > max_width && current_width > 0 {
-                    // Finish current line and start a new one
-                    if !current_line.is_empty() {
-                        lines.push(Line::from(current_line.clone()));
-                        current_line.clear();
+                if grapheme == " " || grapheme == "\n" {
+                    // End of word - flush it onto the current line, wrapping first if needed
+                    if !word.is_empty() {
+                        if current_width + word_width > max_width && current_width > 0 {
+                            lines.push(Line::from(std::mem::take(&mut current_line)));
+                            current_width = 0;
+                        }
+                        current_line.append(&mut word);
+                        current_width += word_width;
+                        word_width = 0;
+                    }
+
+                    if grapheme == "\n" {
+                        lines.push(Line::from(std::mem::take(&mut current_line)));
                         current_width = 0;
+                    } else if current_width < max_width {
+                        current_line.push(Span::styled(" ", style));
+                        current_width += 1;
                     }
+                } else {
+                    // Still building a word
+                    word.push(Span::styled(grapheme.to_string(), style));
+                    word_width += g_width;
                 }
 
-                // Add grapheme to current line
-                current_line.push(Span::styled(grapheme.to_string(), style));
-                current_width += g_width;
                 char_position += grapheme.chars().count(); // Advance character position
             }
         }
 
+        // Flush any word left over at the end of the last run
+        if !word.is_empty() {
+            if current_width + word_width > max_width && current_width > 0 {
+                lines.push(Line::from(std::mem::take(&mut current_line)));
+            }
+            current_line.append(&mut word);
+        }
+
         // Add remaining content
         if !current_line.is_empty() {
             lines.push(Line::from(current_line));
@@ -834,3 +861,78 @@ fn hex_to_color(hex: &str) -> Option<Color> {
     let (r, g, b) = crate::color::parse_hex_rgb(hex)?;
     Some(Color::Rgb(r, g, b))
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    fn plain_run(text: &str) -> FormattedRun {
+        FormattedRun {
+            text: text.to_string(),
+            formatting: TextFormatting::default(),
+        }
+    }
+
+    fn line_text(line: &Line) -> String {
+        line.spans
+            .iter()
+            .map(|span| span.content.as_ref())
+            .collect()
+    }
+
+    #[test]
+    fn word_wrap_moves_whole_word_to_next_line() {
+        let runs = vec![plain_run("aaaa bbbb cccc")];
+        let lines = DocumentWidget::wrap_formatted_runs(&runs, 6, false, &[], false);
+        let texts: Vec<String> = lines.iter().map(line_text).collect();
+
+        // None of the wrapped lines should end with a fragment of a word that
+        // continues on the next line - each word stays intact.
+        assert_eq!(texts, vec!["aaaa ", "bbbb ", "cccc"]);
+    }
+
+    #[test]
+    fn word_wrap_does_not_split_word_mid_character() {
+        // Regression test for #83: a word that doesn't fit at the end of a
+        // line must move to the next line, not get split mid-word.
+        let runs = vec![plain_run(
+            "This paragraph has some very long words that get split awkwardly.",
+        )];
+        let lines = DocumentWidget::wrap_formatted_runs(&runs, 37, false, &[], false);
+        let texts: Vec<String> = lines.iter().map(line_text).collect();
+
+        for text in &texts {
+            let trimmed = text.trim_end();
+            if let Some(last_word) = trimmed.split(' ').next_back() {
+                assert!(
+                    !last_word.is_empty() || trimmed.is_empty(),
+                    "line ended with an empty trailing word: {text:?}"
+                );
+            }
+        }
+
+        
```

---

### Incident Patch 3: `0a8856c3` (2026-07-15)
**Commit Message**: fix(tui): wrap text at word boundaries instead of mid-character

wrap_formatted_runs in src/widgets/document.rs wrapped at the
grapheme level with no word-boundary awareness, so a word that
didn't fit at the end of a line got split mid-word. Buffers
graphemes into a word/word_width accumulator and only flushes it to
the current line if it fits, otherwise starts a new line - the same
pattern already used by the ANSI export's
wrap_formatted_runs_with_width in src/ansi.rs.

Search-match highlighting and the LayoutCache interaction are
unaffected: styles are still computed per grapheme, and the
function's signature and caching contract are unchanged.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 - Custom key bindings for the spacebar were silently dropped due to whitespace trimming during config parsing
+- TUI text wrapping now breaks at word boundaries instead of splitting words mid-character, matching the ANSI export ([#83](https://github.com/bgreenwell/doxx/issues/83))
 
 ## [0.1.4] - 2026-05-26
 
```

**File**: `src/widgets/document.rs` (modified, +111/-9)
```diff
@@ -99,6 +99,13 @@ impl<'a> DocumentWidget<'a> {
         let mut current_width = 0;
         let mut char_position = 0; // Track absolute character position across all runs
 
+        // Graphemes are buffered into `word` until a space/newline boundary, so a word
+        // that doesn't fit at the end of a line moves to the next line as a whole
+        // instead of being split mid-word. Mirrors the word/word_width accumulator in
+        // ansi.rs's wrap_formatted_runs_with_width.
+        let mut word: Vec<Span> = Vec::new();
+        let mut word_width = 0;
+
         for run in runs {
             let mut base_style = Style::default();
 
@@ -145,23 +152,43 @@ impl<'a> DocumentWidget<'a> {
                     }
                 }
 
-                // Check if adding this grapheme would exceed max width
-                if current_width + g_width > max_width && current_width > 0 {
-                    // Finish current line and start a new one
-                    if !current_line.is_empty() {
-                        lines.push(Line::from(current_line.clone()));
-                        current_line.clear();
+                if grapheme == " " || grapheme == "\n" {
+                    // End of word - flush it onto the current line, wrapping first if needed
+                    if !word.is_empty() {
+                        if current_width + word_width > max_width && current_width > 0 {
+                            lines.push(Line::from(std::mem::take(&mut current_line)));
+                            current_width = 0;
+                        }
+                        current_line.append(&mut word);
+                        current_width += word_width;
+                        word_width = 0;
+                    }
+
+                    if grapheme == "\n" {
+                        lines.push(Line::from(std::mem::take(&mut current_line)));
                         current_width = 0;
+                    } else if current_width < max_width {
+                        current_line.push(Span::styled(" ", style));
+                        current_width += 1;
                     }
+                } else {
+                    // Still building a word
+                    word.push(Span::styled(grapheme.to_string(), style));
+                    word_width += g_width;
                 }
 
-                // Add grapheme to current line
-                current_line.push(Span::styled(grapheme.to_string(), style));
-                current_width += g_width;
                 char_position += grapheme.chars().count(); // Advance character position
             }
         }
 
+        // Flush any word left over at the end of the last run
+        if !word.is_empty() {
+            if current_width + word_width > max_width && current_width > 0 {
+                lines.push(Line::from(std::mem::take(&mut current_line)));
+            }
+            current_line.append(&mut word);
+        }
+
         // Add remaining content
         if !current_line.is_empty() {
             lines.push(Line::from(current_line));
@@ -834,3 +861,78 @@ fn hex_to_color(hex: &str) -> Option<Color> {
     let (r, g, b) = crate::color::parse_hex_rgb(hex)?;
     Some(Color::Rgb(r, g, b))
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    fn plain_run(text: &str) -> FormattedRun {
+        FormattedRun {
+            text: text.to_string(),
+            formatting: TextFormatting::default(),
+        }
+    }
+
+    fn line_text(line: &Line) -> String {
+        line.spans
+            .iter()
+            .map(|span| span.content.as_ref())
+            .collect()
+    }
+
+    #[test]
+    fn word_wrap_moves_whole_word_to_next_line() {
+        let runs = vec![plain_run("aaaa bbbb cccc")];
+        let lines = DocumentWidget::wrap_formatted_runs(&runs, 6, false, &[], false);
+        let texts: Vec<String> = lines.iter().map(line_text).collect();
+
+        // None of the wrapped lines should end with a fragment of a word that
+        // continues on the next line - each word stays intact.
+        assert_eq!(texts, vec!["aaaa ", "bbbb ", "cccc"]);
+    }
+
+    #[test]
+    fn word_wrap_does_not_split_word_mid_character() {
+        // Regression test for #83: a word that doesn't fit at the end of a
+        // line must move to the next line, not get split mid-word.
+        let runs = vec![plain_run(
+            "This paragraph has some very long words that get split awkwardly.",
+        )];
+        let lines = DocumentWidget::wrap_formatted_runs(&runs, 37, false, &[], false);
+        let texts: Vec<String> = lines.iter().map(line_text).collect();
+
+        for text in &texts {
+            let trimmed = text.trim_end();
+            if let Some(last_word) = trimmed.split(' ').next_back() {
+                assert!(
+                    !last_word.is_empty() || trimmed.is_empty(),
+                    "line ended with an empty trailing word: {text:?}"
+                );
+            }
+        }
+
+        
```

---

### Incident Patch 4: `8884c0fb` (2026-07-15)
**Commit Message**: Merge pull request #94 from bgreenwell/fix/ratatui-image-9-no-chafa

fix(deps): bump ratatui-image to 9.0 without the chafa system dependency

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1748,9 +1748,9 @@ dependencies = [
 
 [[package]]
 name = "ratatui-image"
-version = "8.0.2"
+version = "9.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4d2d8ad028fcbb171d83cfdeaf44df17bf0eae3585bdd7f89bc87af98fc71b0e"
+checksum = "5dbebe428e366c230b2251c7091f2a56ec2bf818d96cdc807f6474428ee09040"
 dependencies = [
  "base64-simd",
  "icy_sixel",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ arboard = "3.3"
 viuer = "0.7"
 image = "0.25"
 zip = "2.0"
-ratatui-image = "8.0"
+ratatui-image = { version = "9.0", default-features = false, features = ["image-defaults", "crossterm"] }
 
 tokio = { version = "1.0", features = ["rt-multi-thread", "macros", "fs"] }
 
```

**File**: `src/ui.rs` (modified, +3/-3)
```diff
@@ -142,12 +142,12 @@ impl App {
         let picker = if let Ok(p) = Picker::from_query_stdio() {
             p
         } else {
-            // Fallback to manual font size
-            Picker::from_fontsize((8, 16))
+            // Fallback when the terminal doesn't answer the stdio query
+            Picker::halfblocks()
         };
 
         #[cfg(not(unix))]
-        let picker = Picker::from_fontsize((8, 16));
+        let picker = Picker::halfblocks();
 
         // Process all images in the document
         for element in &self.document.elements {
```

---

### Incident Patch 5: `fb603ccd` (2026-07-15)
**Commit Message**: docs: declare MSRV and fix the Rust version badge (#87)

The dependency tree's floor is 1.88, but Cargo.toml had no
rust-version field and the README badge claimed 1.70+. Verified
with cargo +1.88.0 check --all-targets.

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -10,6 +10,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Added
 - README now documents the config file, `doxx config` subcommand, keymap presets, and custom key bindings ([#78](https://github.com/bgreenwell/doxx/issues/78))
 - The spacebar can now be bound in `config.toml` via a literal `" "` key or the `"space"` alias
+- Declared minimum supported Rust version (MSRV) of 1.88 in `Cargo.toml` ([#87](https://github.com/bgreenwell/doxx/issues/87))
+
+### Changed
+- README Rust version badge now reflects the actual 1.88+ MSRV instead of a stale 1.70+ ([#87](https://github.com/bgreenwell/doxx/issues/87))
 
 ### Fixed
 - Custom key bindings for the spacebar were silently dropped due to whitespace trimming during config parsing
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 name = "doxx"
 version = "0.1.4"
 edition = "2021"
+rust-version = "1.88"
 description = "Terminal document viewer for .docx files"
 license = "MIT"
 repository = "https://github.com/bgreenwell/doxx"
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 [![Downloads](https://img.shields.io/crates/d/doxx?style=for-the-badge&color=%232B579A)](https://crates.io/crates/doxx)
 
 [![License: MIT](https://img.shields.io/badge/License-MIT-%232196F3.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
-[![Rust](https://img.shields.io/badge/rust-1.70%2B-%23D34516.svg?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
+[![Rust](https://img.shields.io/badge/rust-1.88%2B-%23D34516.svg?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
 [![Easy Install](https://img.shields.io/badge/Easy%20Install-Homebrew%20%7C%20Scoop%20%7C%20WinGet-%23FBB040?style=for-the-badge)](#installation)
 [![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-blue?style=for-the-badge)](https://github.com/bgreenwell/doxx/releases/latest)
 
```

---

### Incident Patch 6: `cb6eac2f` (2026-07-15)
**Commit Message**: fix(deps): bump ratatui-image to 9.0 without the chafa system dependency

9.0.0 made chafa-dyn a default feature, which requires libchafa and
pkg-config at build time and broke CI on all platforms. doxx doesn't
use chafa, so default-features is disabled and only image-defaults
and crossterm are re-enabled.

Also replaces the now-deprecated Picker::from_fontsize fallback with
Picker::halfblocks, per upstream's migration note.

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1748,9 +1748,9 @@ dependencies = [
 
 [[package]]
 name = "ratatui-image"
-version = "8.0.2"
+version = "9.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4d2d8ad028fcbb171d83cfdeaf44df17bf0eae3585bdd7f89bc87af98fc71b0e"
+checksum = "5dbebe428e366c230b2251c7091f2a56ec2bf818d96cdc807f6474428ee09040"
 dependencies = [
  "base64-simd",
  "icy_sixel",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ arboard = "3.3"
 viuer = "0.7"
 image = "0.25"
 zip = "2.0"
-ratatui-image = "8.0"
+ratatui-image = { version = "9.0", default-features = false, features = ["image-defaults", "crossterm"] }
 
 tokio = { version = "1.0", features = ["rt-multi-thread", "macros", "fs"] }
 
```

**File**: `src/ui.rs` (modified, +3/-3)
```diff
@@ -142,12 +142,12 @@ impl App {
         let picker = if let Ok(p) = Picker::from_query_stdio() {
             p
         } else {
-            // Fallback to manual font size
-            Picker::from_fontsize((8, 16))
+            // Fallback when the terminal doesn't answer the stdio query
+            Picker::halfblocks()
         };
 
         #[cfg(not(unix))]
-        let picker = Picker::from_fontsize((8, 16));
+        let picker = Picker::halfblocks();
 
         // Process all images in the document
         for element in &self.document.elements {
```

---

### Incident Patch 7: `33d6d495` (2026-07-15)
**Commit Message**: Merge pull request #79 from hiro-nikaitou/fix/readme-download-command

[Docs] Fix pre-built binaries download command in README

**File**: `README.md` (modified, +10/-2)
```diff
@@ -134,8 +134,16 @@ scoop install doxx
 Download from [GitHub releases](https://github.com/bgreenwell/doxx/releases):
 
 ```bash
-# macOS/Linux - automatic platform detection
-curl -L https://github.com/bgreenwell/doxx/releases/latest/download/doxx-$(uname -s)-$(uname -m).tar.gz | tar xz
+# Linux (x86_64, statically linked)
+curl -L https://github.com/bgreenwell/doxx/releases/latest/download/doxx-x86_64-unknown-linux-musl.tar.xz | tar xJ
+sudo mv doxx /usr/local/bin/
+
+# macOS (Intel)
+curl -L https://github.com/bgreenwell/doxx/releases/latest/download/doxx-x86_64-apple-darwin.tar.xz | tar xJ
+sudo mv doxx /usr/local/bin/
+
+# macOS (Apple Silicon)
+curl -L https://github.com/bgreenwell/doxx/releases/latest/download/doxx-aarch64-apple-darwin.tar.xz | tar xJ
 sudo mv doxx /usr/local/bin/
 
 # Verify installation
```

---

### Incident Patch 8: `54010069` (2026-07-12)
**Commit Message**: Merge pull request #85 from bgreenwell/fix/publish-race

Wait for release assets in publish workflows

**File**: `.github/workflows/publish-aur.yml` (modified, +18/-0)
```diff
@@ -31,6 +31,24 @@ jobs:
           echo "version=$VERSION" >> "$GITHUB_OUTPUT"
           echo "tag=$TAG" >> "$GITHUB_OUTPUT"
 
+      # The Release workflow triggered by the same tag builds the assets;
+      # wait for the one we need instead of racing it (fails after ~30 min).
+      - name: Wait for release assets
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: |
+          TAG="${{ steps.get-version.outputs.tag }}"
+          echo "Waiting for doxx-x86_64-unknown-linux-gnu.tar.xz on release $TAG..."
+          for i in $(seq 1 40); do
+            if gh release view "$TAG" --repo ${{ github.repository }} --json assets \
+                 --jq '.assets[].name' 2>/dev/null | grep -qx "doxx-x86_64-unknown-linux-gnu.tar.xz"; then
+              echo "Release asset found."
+              exit 0
+            fi
+            sleep 45
+          done
+          echo "Timed out waiting for release asset doxx-x86_64-unknown-linux-gnu.tar.xz" >&2
+          exit 1
       - name: Checkout doxx repository
         uses: actions/checkout@v4
         with:
```

**File**: `.github/workflows/publish-scoop.yml` (modified, +18/-0)
```diff
@@ -32,6 +32,24 @@ jobs:
             echo "tag=${{ github.ref_name }}" >> "$GITHUB_OUTPUT"
           fi
 
+      # The Release workflow triggered by the same tag builds the assets;
+      # wait for the one we need instead of racing it (fails after ~30 min).
+      - name: Wait for release assets
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: |
+          TAG="${{ steps.get-tag.outputs.tag }}"
+          echo "Waiting for doxx-x86_64-pc-windows-msvc.zip on release $TAG..."
+          for i in $(seq 1 40); do
+            if gh release view "$TAG" --repo ${{ github.repository }} --json assets \
+                 --jq '.assets[].name' 2>/dev/null | grep -qx "doxx-x86_64-pc-windows-msvc.zip"; then
+              echo "Release asset found."
+              exit 0
+            fi
+            sleep 45
+          done
+          echo "Timed out waiting for release asset doxx-x86_64-pc-windows-msvc.zip" >&2
+          exit 1
       - name: Checkout Scoop bucket
         uses: actions/checkout@v4
         with:
```

**File**: `.github/workflows/publish-winget.yml` (modified, +18/-0)
```diff
@@ -31,6 +31,24 @@ jobs:
           echo "version=$VERSION" >> "$GITHUB_OUTPUT"
           echo "tag=$TAG" >> "$GITHUB_OUTPUT"
 
+      # The Release workflow triggered by the same tag builds the assets;
+      # wait for the one we need instead of racing it (fails after ~30 min).
+      - name: Wait for release assets
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: |
+          TAG="${{ steps.get-version.outputs.tag }}"
+          echo "Waiting for doxx-x86_64-pc-windows-msvc.msi on release $TAG..."
+          for i in $(seq 1 40); do
+            if gh release view "$TAG" --repo ${{ github.repository }} --json assets \
+                 --jq '.assets[].name' 2>/dev/null | grep -qx "doxx-x86_64-pc-windows-msvc.msi"; then
+              echo "Release asset found."
+              exit 0
+            fi
+            sleep 45
+          done
+          echo "Timed out waiting for release asset doxx-x86_64-pc-windows-msvc.msi" >&2
+          exit 1
       - name: Install Komac
         uses: cargo-bins/cargo-binstall@v1.20.1
 
```

---

### Incident Patch 9: `13e0a27d` (2026-07-08)
**Commit Message**: docs: add CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, and PR template

None of these existed - .github/ had issue templates but nothing
telling contributors how to set up the dev environment, what commit
style to use, or where to report a security vulnerability.

CONTRIBUTING.md is grounded in this repo's actual conventions
(scripts/quick-check.sh, conventional commits, CHANGELOG format) per
AGENTS.md rather than generic boilerplate. SECURITY.md points at
GitHub's private vulnerability reporting and scopes what's relevant
for a tool that parses untrusted .docx files. CODE_OF_CONDUCT.md is
the standard Contributor Covenant v2.1.

**File**: `.github/PULL_REQUEST_TEMPLATE.md` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+## Description
+
+<!-- What does this change do, and why? -->
+
+## Related issue
+
+<!-- Closes #XX, or "N/A" -->
+
+## Type of change
+
+- [ ] Bug fix
+- [ ] New feature
+- [ ] Refactor (no behavior change)
+- [ ] Documentation
+- [ ] CI/tooling
+
+## Checklist
+
+- [ ] `./scripts/quick-check.sh` passes (fmt, clippy, tests)
+- [ ] Tests added/updated for the change, where practical
+- [ ] `CHANGELOG.md` updated under `[Unreleased]` (skip for internal-only refactors)
+- [ ] Manually verified against a real `.docx` file, for changes touching parsing or rendering
+
+## Additional context
+
+<!-- Screenshots, sample documents, anything that helps review -->
```

**File**: `CODE_OF_CONDUCT.md` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+# Contributor Covenant Code of Conduct
+
+## Our Pledge
+
+We as members, contributors, and leaders pledge to make participation in our
+community a harassment-free experience for everyone, regardless of age, body
+size, visible or invisible disability, ethnicity, sex characteristics, gender
+identity and expression, level of experience, education, socio-economic status,
+nationality, personal appearance, race, caste, color, religion, or sexual
+identity and orientation.
+
+We pledge to act and interact in ways that contribute to an open, welcoming,
+diverse, inclusive, and healthy community.
+
+## Our Standards
+
+Examples of behavior that contributes to a positive environment for our
+community include:
+
+* Demonstrating empathy and kindness toward other people
+* Being respectful of differing opinions, viewpoints, and experiences
+* Giving and gracefully accepting constructive feedback
+* Accepting responsibility and apologizing to those affected by our mistakes,
+  and learning from the experience
+* Focusing on what is best not just for us as individuals, but for the
+  overall community
+
+Examples of unacceptable behavior include:
+
+* The use of sexualized language or imagery, and sexual attention or advances
+  of any kind
+* Trolling, insulting or derogatory comments, and personal or political attacks
+* Public or private harassment
+* Publishing others' private information, such as a physical or email address,
+  without their explicit permission
+* Other conduct which could reasonably be considered inappropriate in a
+  professional setting
+
+## Enforcement Responsibilities
+
+The maintainer is responsible for clarifying and enforcing our standards of
+acceptable behavior and will take appropriate and fair corrective action in
+response to any behavior that they deem inappropriate, threatening, offensive,
+or harmful.
+
+## Scope
+
+This Code of Conduct applies within all community spaces (issues, pull
+requests, discussions), and also applies when an individual is officially
+representing the project in public spaces.
+
+## Enforcement
+
+Instances of abusive, harassing, or otherwise unacceptable behavior may be
+reported via [GitHub's private vulnerability/abuse reporting channel](https://github.com/bgreenwell/doxx/security)
+or by contacting the maintainer directly through their GitHub profile. All
+complaints will be reviewed and investigated promptly and fairly.
+
+All maintainers are obligated to respect the privacy and security of the
+reporter of any incident.
+
+## Enforcement Guidelines
+
+The maintainer will follow these Community Impact Guidelines in determining
+the consequences for any action they deem in violation of this Code of
+Conduct:
+
+### 1. Correction
+
+**Community Impact**: Use of inappropriate language or other behavior deemed
+unprofessional or unwelcome.
+
+**Consequence**: A private, written warning, providing clarity around the
+nature of the violation and an explanation of why the behavior was
+inappropriate.
+
+### 2. Warning
+
+**Community Impact**: A violation through a single incident or series of
+actions.
+
+**Consequence**: A warning with consequences for continued behavior. No
+interaction with the people involved for a specified period of time.
+Violating these terms may lead to a temporary or permanent ban.
+
+### 3. Temporary Ban
+
+**Community Impact**: A serious violation of community standards, including
+sustained inappropriate behavior.
+
+**Consequence**: A temporary ban from any sort of interaction or public
+communication with the community for a specified period of time.
+
+### 4. Permanent Ban
+
+**Community Impact**: Demonstrating a pattern of violation of community
+standards, including sustained inappropriate behavior, harassment of an
+individual, or aggression toward or disparagement of classes of individuals.
+
+**Consequence**: A permanent ban from any sort of public interaction within
+the community.
+
+## Attribution
+
+This Code of Conduct is adapted from the [Contributor Covenant][homepage],
+version 2.1, available at
+[https://www.contributor-covenant.org/version/2/1/code_of_conduct.html][v2.1].
+
+Community Impact Guidelines were inspired by
+[Mozilla's code of conduct enforcement ladder][Mozilla CoC].
+
+[homepage]: https://www.contributor-covenant.org
+[v2.1]: https://www.contributor-covenant.org/version/2/1/code_of_conduct.html
+[Mozilla CoC]: https://github.com/mozilla/diversity
```

**File**: `CONTRIBUTING.md` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+# Contributing to doxx
+
+Thanks for your interest in improving doxx! This document covers the practical steps for submitting a change. For deeper technical context (project structure, key dependencies, known issues), see [AGENTS.md](AGENTS.md) — it's written for AI coding agents but is equally useful for human contributors.
+
+## Getting started
+
+```bash
+git clone https://github.com/bgreenwell/doxx.git
+cd doxx
+cargo build --release
+cargo test
+cargo run -- tests/fixtures/minimal.docx
+```
+
+**Requirements:** Rust 1.70+, and `libxcb` on Linux.
+
+## Before you open a PR
+
+1. **Check for an existing issue.** If you're fixing a bug or adding a feature, search [open issues](https://github.com/bgreenwell/doxx/issues) first — either to link your PR to it, or to confirm the change is wanted before you invest time.
+2. **Keep changes focused.** One logical change per PR. Unrelated formatting/cleanup changes make review harder — split them out.
+3. **Add tests.** New parsing logic, especially in `src/document/parsing/`, should have unit tests. Bug fixes should include a regression test where practical.
+4. **Update `CHANGELOG.md`** for any user-facing change, under `## [Unreleased]`. Follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format — one line per entry, no sub-bullets, standard sections only (Added/Changed/Deprecated/Removed/Fixed/Security). Internal refactors with no user-visible effect don't need an entry; the commit message covers those.
+
+## Before every commit
+
+```bash
+./scripts/quick-check.sh   # fmt, clippy, tests - fast, run this often
+```
+
+## Before pushing / opening a PR
+
+```bash
+./scripts/check.sh   # fmt --check, clippy -D warnings, tests, release build
+```
+
+CI runs the same checks (`cargo fmt --all -- --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --all-features`, `cargo build --release`, plus `nix build` on Unix) across Linux, macOS, and Windows. Clippy warnings fail CI — there's no "just a warning" here.
+
+## Commit messages
+
+Conventional commit format: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, etc. No signature blocks.
+
+## Code style
+
+- `rustfmt` and `clippy` are the source of truth — if they're happy, formatting/style is fine.
+- Errors: `anyhow::Result<T>` with `.context()`/`.with_context()` at the app layer, consistent with the rest of the codebase.
+- Prefer extending an existing parsing module (`src/document/parsing/*.rs`) over adding new top-level modules for document-format logic.
+
+## Testing
+
+```bash
+cargo test --all-features
+cargo test --test integration_test
+cargo test test_name -- --nocapture
+```
+
+Fixtures live in `tests/fixtures/`; see `tests/fixtures/README.md` for what each one covers. Run `./scripts/regenerate-fixtures.sh` if you need to rebuild the generated ones.
+
+## Reporting bugs / requesting features
+
+Use the [issue templates](https://github.com/bgreenwell/doxx/issues/new/choose) — they ask for the details (doxx version, OS, sample document if applicable) that make bugs actually reproducible. For security vulnerabilities, see [SECURITY.md](SECURITY.md) instead of filing a public issue.
+
+## License
+
+By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
```

**File**: `SECURITY.md` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# Security Policy
+
+## Reporting a Vulnerability
+
+Please **do not** open a public GitHub issue for security vulnerabilities.
+
+Instead, use GitHub's private vulnerability reporting:
+
+1. Go to the [Security tab](https://github.com/bgreenwell/doxx/security) of this repository.
+2. Click **"Report a vulnerability"**.
+3. Describe the issue, including steps to reproduce and, if applicable, a sample `.docx` file that triggers the problem.
+
+This opens a private conversation with the maintainer, so the issue can be assessed and fixed before it's public.
+
+## What's in scope
+
+doxx parses untrusted `.docx` files (which are ZIP archives of XML), so the areas of most interest are:
+
+- Crashes or panics when parsing a malformed/malicious `.docx` file (denial of service)
+- Path traversal or arbitrary file write during image extraction (`--extract-images`, `ImageExtractor`)
+- Memory-safety issues (should be prevented by Rust, but `unsafe` misuse or dependency vulnerabilities are still possible)
+- Vulnerabilities in direct dependencies that are actually reachable through doxx's usage
+
+## What's likely out of scope
+
+- Issues requiring an already-compromised machine or local file access beyond what doxx itself would need
+- Rendering/display bugs with no security impact (those belong in a regular issue)
+
+## Response
+
+This is a small, actively-maintained open source project without a dedicated security team or SLA. Reports will be acknowledged and triaged as soon as reasonably possible. Fixes for confirmed vulnerabilities will be released promptly and noted in `CHANGELOG.md` under a `### Security` entry.
```

---

### Incident Patch 10: `a2edbaaf` (2026-07-08)
**Commit Message**: docs: fix pre-built binaries download command



---

### Incident Patch 11: `c5b0a641` (2026-07-08)
**Commit Message**: docs: fix pre-built binaries download command

Fix the curl download command in README to match actual release
asset naming format. Artifacts use {arch}-{vendor}-{os}.tar.xz
instead of uname-s-uname-m.tar.gz.

Closes #77

**File**: `README.md` (modified, +10/-2)
```diff
@@ -133,8 +133,16 @@ scoop install doxx
 Download from [GitHub releases](https://github.com/bgreenwell/doxx/releases):
 
 ```bash
-# macOS/Linux - automatic platform detection
-curl -L https://github.com/bgreenwell/doxx/releases/latest/download/doxx-$(uname -s)-$(uname -m).tar.gz | tar xz
+# Linux (x86_64, statically linked)
+curl -L https://github.com/bgreenwell/doxx/releases/latest/download/doxx-x86_64-unknown-linux-musl.tar.xz | tar xJ
+sudo mv doxx /usr/local/bin/
+
+# macOS (Intel)
+curl -L https://github.com/bgreenwell/doxx/releases/latest/download/doxx-x86_64-apple-darwin.tar.xz | tar xJ
+sudo mv doxx /usr/local/bin/
+
+# macOS (Apple Silicon)
+curl -L https://github.com/bgreenwell/doxx/releases/latest/download/doxx-aarch64-apple-darwin.tar.xz | tar xJ
 sudo mv doxx /usr/local/bin/
 
 # Verify installation
```

---

### Incident Patch 12: `3a816e9a` (2026-07-08)
**Commit Message**: fix(keymap): allow binding the spacebar via config.toml

KeyBinding::parse_key() trimmed its input before matching, which
silently reduced a literal " " key string to an empty, unparseable
one - so the spacebar (used by the less preset for page-down) could
never be rebound through [keymap.custom]. Special-case a literal
space before trimming, and add a "space" named alias for readability
in config files. Also fixes the help screen rendering a blank cell
for space-bound actions.

Found while verifying the docs for #78.

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -7,6 +7,13 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Added
+- README now documents the config file, `doxx config` subcommand, keymap presets, and custom key bindings ([#78](https://github.com/bgreenwell/doxx/issues/78))
+- The spacebar can now be bound in `config.toml` via a literal `" "` key or the `"space"` alias
+
+### Fixed
+- Custom key bindings for the spacebar were silently dropped due to whitespace trimming during config parsing
+
 ## [0.1.4] - 2026-05-26
 
 ### Added
```

**File**: `src/keymap/bindings.rs` (modified, +27/-1)
```diff
@@ -20,8 +20,14 @@ impl KeyBinding {
         Self::new(KeyCode::Char(c), KeyModifiers::CONTROL)
     }
 
-    /// Parse a key binding from a string like "ctrl-d", "shift-h", "/", "enter", "esc".
+    /// Parse a key binding from a string like "ctrl-d", "shift-h", "/", "enter", "esc", "space".
     pub fn parse_key(s: &str) -> Result<Self> {
+        // A literal " " is meaningful (the spacebar), so check for it before
+        // trimming would otherwise reduce it to an empty, unparseable string.
+        if s == " " {
+            return Ok(Self::char(' '));
+        }
+
         let s = s.trim().to_lowercase();
         let parts: Vec<&str> = s.splitn(2, '-').collect();
 
@@ -40,6 +46,7 @@ impl KeyBinding {
             [single] => {
                 // Special key names
                 match *single {
+                    "space" => Ok(Self::char(' ')),
                     "enter" => Ok(Self::new(KeyCode::Enter, KeyModifiers::NONE)),
                     "esc" | "escape" => Ok(Self::new(KeyCode::Esc, KeyModifiers::NONE)),
                     "backspace" => Ok(Self::new(KeyCode::Backspace, KeyModifiers::NONE)),
@@ -71,6 +78,7 @@ impl KeyBinding {
 impl KeyBinding {
     pub fn display(&self) -> String {
         let key = match &self.code {
+            KeyCode::Char(' ') => "Space".to_string(),
             KeyCode::Char(c) => c.to_string(),
             KeyCode::Up => "↑".to_string(),
             KeyCode::Down => "↓".to_string(),
@@ -139,6 +147,24 @@ mod tests {
         assert_eq!(b.modifiers, KeyModifiers::NONE);
     }
 
+    #[test]
+    fn test_parse_space() {
+        // Literal " " must survive parse_key's trim(), since trimming it
+        // naively reduces the spacebar to an empty, unparseable string.
+        let b = KeyBinding::parse_key(" ").unwrap();
+        assert_eq!(b.code, KeyCode::Char(' '));
+        assert_eq!(b.modifiers, KeyModifiers::NONE);
+
+        // "space" is also accepted as a named alias, for readability in config.toml.
+        let b = KeyBinding::parse_key("space").unwrap();
+        assert_eq!(b.code, KeyCode::Char(' '));
+    }
+
+    #[test]
+    fn test_display_space() {
+        assert_eq!(KeyBinding::char(' ').display(), "Space");
+    }
+
     #[test]
     fn test_parse_special_keys() {
         assert_eq!(KeyBinding::parse_key("enter").unwrap().code, KeyCode::Enter);
```

---

### Incident Patch 13: `74dab872` (2026-02-10)
**Commit Message**: fix: handle zero-sized terminal in CI environments

In CI environments without a proper TTY, crossterm::terminal::size()
returns Ok((0, 0)) instead of an error. This caused test_renderer_creation
to fail with "assertion failed: renderer.max_width > 0".

Now validates that dimensions are > 0 before using them, falling back
to reasonable defaults (80x24) when invalid.

Fixes #65

**File**: `src/terminal_image.rs` (modified, +6/-4)
```diff
@@ -224,11 +224,13 @@ impl TerminalImageRenderer {
     fn get_terminal_size() -> (u32, u32) {
         // Try to get terminal size from crossterm
         if let Ok((width, height)) = crossterm::terminal::size() {
-            (width as u32, height as u32)
-        } else {
-            // Fallback to reasonable defaults
-            (80, 24)
+            // Ensure we got valid dimensions (CI environments may return 0,0)
+            if width > 0 && height > 0 {
+                return (width as u32, height as u32);
+            }
         }
+        // Fallback to reasonable defaults
+        (80, 24)
     }
 
     /// Print capabilities information for debugging
```

---

### Incident Patch 14: `d6b39f35` (2026-05-26)
**Commit Message**: fix(ci): trigger publish workflows on tag push, fix cd xleak typo in AUR workflow

**File**: `.github/workflows/publish-aur.yml` (modified, +5/-5)
```diff
@@ -1,8 +1,8 @@
 name: Publish to AUR
 
 on:
-  release:
-    types: [published]
+  push:
+    tags: ['v*']
   workflow_dispatch:
     inputs:
       tag:
@@ -16,7 +16,7 @@ permissions:
 jobs:
   publish-aur:
     runs-on: ubuntu-22.04
-    if: ${{ !github.event.release.prerelease }}
+    if: ${{ !contains(github.ref_name, '-') || github.event_name == 'workflow_dispatch' }}
 
     steps:
       - name: Determine release version
@@ -25,7 +25,7 @@ jobs:
           if [ "${{ github.event_name }}" == "workflow_dispatch" ]; then
             TAG="${{ inputs.tag }}"
           else
-            TAG="${{ github.event.release.tag_name }}"
+            TAG="${{ github.ref_name }}"
           fi
           VERSION="${TAG#v}"
           echo "version=$VERSION" >> "$GITHUB_OUTPUT"
@@ -42,7 +42,7 @@ jobs:
           TARBALL="doxx-x86_64-unknown-linux-gnu.tar.xz"
           SHA_FILE="${TARBALL}.sha256"
 
-          cd xleak
+          cd doxx
           gh release download "v${VERSION}" \
             --pattern "$SHA_FILE"
 
```

**File**: `.github/workflows/publish-scoop.yml` (modified, +4/-4)
```diff
@@ -1,8 +1,8 @@
 name: Publish Scoop Manifest
 
 on:
-  release:
-    types: [published]
+  push:
+    tags: ['v*']
   workflow_dispatch:
     inputs:
       tag:
@@ -16,7 +16,7 @@ permissions:
 jobs:
   publish-scoop:
     runs-on: ubuntu-22.04
-    if: ${{ !github.event.release.prerelease || github.event.repository.allow_prerelease }}
+    if: ${{ !contains(github.ref_name, '-') || github.event_name == 'workflow_dispatch' }}
     env:
       GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       GITHUB_USER: "axo bot"
@@ -29,7 +29,7 @@ jobs:
           if [ "${{ github.event_name }}" == "workflow_dispatch" ]; then
             echo "tag=${{ inputs.tag }}" >> "$GITHUB_OUTPUT"
           else
-            echo "tag=${{ github.event.release.tag_name }}" >> "$GITHUB_OUTPUT"
+            echo "tag=${{ github.ref_name }}" >> "$GITHUB_OUTPUT"
           fi
 
       - name: Checkout Scoop bucket
```

**File**: `.github/workflows/publish-winget.yml` (modified, +4/-4)
```diff
@@ -1,8 +1,8 @@
 name: Publish to WinGet
 
 on:
-  release:
-    types: [published]
+  push:
+    tags: ['v*']
   workflow_dispatch:
     inputs:
       tag:
@@ -16,7 +16,7 @@ permissions:
 jobs:
   publish-winget:
     runs-on: ubuntu-latest
-    if: ${{ !github.event.release.prerelease }}
+    if: ${{ !contains(github.ref_name, '-') || github.event_name == 'workflow_dispatch' }}
 
     steps:
       - name: Determine release version
@@ -25,7 +25,7 @@ jobs:
           if [ "${{ github.event_name }}" == "workflow_dispatch" ]; then
             TAG="${{ inputs.tag }}"
           else
-            TAG="${{ github.event.release.tag_name }}"
+            TAG="${{ github.ref_name }}"
           fi
           VERSION="${TAG#v}"
           echo "version=$VERSION" >> "$GITHUB_OUTPUT"
```

---

### Incident Patch 15: `0572571e` (2026-05-25)
**Commit Message**: feat: source code blocks, text box extraction, and numbering fixes (#76)

**File**: `src/ansi.rs` (modified, +25/-0)
```diff
@@ -126,6 +126,31 @@ pub fn export_to_ansi_with_options(document: &Document, options: &AnsiOptions) -
                 )?;
                 output.push('\n');
             }
+            DocumentElement::CodeBlock { text } => {
+                let code_color = format_ansi_color(Some("#AAFFAA"), options);
+                let reset = format_ansi_reset();
+                for line in text.lines() {
+                    writeln!(output, "  {code_color}{line}{reset}")?;
+                }
+                output.push('\n');
+            }
+            DocumentElement::TextBox { lines } => {
+                let border_color = format_ansi_color(Some("#00FFFF"), options);
+                let reset = format_ansi_reset();
+                let inner_width = options.terminal_width.saturating_sub(4);
+                let bar = "─".repeat(options.terminal_width.saturating_sub(2));
+                writeln!(output, "{border_color}┌{bar}┐{reset}")?;
+                for line in lines {
+                    let truncated: String = line.chars().take(inner_width).collect();
+                    writeln!(
+                        output,
+                        "{border_color}│{reset} {truncated:<inner_width$} {border_color}│{reset}",
+                        inner_width = inner_width
+                    )?;
+                }
+                writeln!(output, "{border_color}└{bar}┘{reset}")?;
+                output.push('\n');
+            }
             DocumentElement::PageBreak => {
                 let separator = "─".repeat(std::cmp::min(60, options.terminal_width));
                 writeln!(
```

**File**: `src/document/loader.rs` (modified, +65/-76)
```diff
@@ -15,12 +15,12 @@ use super::io::{merge_display_equations, validate_docx_file};
 use super::cleanup::{clean_word_list_markers, estimate_page_count};
 // Import numbering management
 use super::parsing::numbering::{
-    analyze_heading_structure, DocumentNumberingManager, HeadingNumberTracker, NumberingFormat,
+    analyze_heading_structure, HeadingNumberTracker, NumberingResolver,
 };
 // Import list processing
 use super::parsing::list::group_list_items;
 // Import formatting and text extraction
-use super::parsing::formatting::extract_run_formatting;
+use super::parsing::formatting::{extract_paragraph_text, extract_run_formatting};
 // Import heading detection
 use super::parsing::heading::{detect_heading_from_text, detect_heading_with_numbering};
 // Import table extraction
@@ -59,7 +59,7 @@ pub fn load_document(file_path: &Path, image_options: ImageOptions) -> Result<Do
 
     let mut elements = Vec::new();
     let mut word_count = 0;
-    let mut numbering_manager = DocumentNumberingManager::new();
+    let mut numbering_resolver = NumberingResolver::build_from_docx(&docx.numberings);
     let mut heading_tracker = HeadingNumberTracker::new();
 
     // Analyze document structure to determine if auto-numbering should be enabled
@@ -121,17 +121,55 @@ pub fn load_document(file_path: &Path, image_options: ImageOptions) -> Result<Do
                     }
                 }
 
-                // Extract runs with individual formatting
+                // Detect paragraph style (used for code blocks, block quotes, etc.)
+                let para_style = para
+                    .property
+                    .style
+                    .as_ref()
+                    .map(|s| s.val.as_str())
+                    .unwrap_or("");
+                let is_code_block = para_style == "SourceCode" || para_style == "VerbatimChar";
+
+                // Extract runs with individual formatting, preserving line breaks.
+                // Text box shapes (DrawingData::TextBox) are collected separately so they
+                // are always emitted as plain paragraphs regardless of the parent style.
                 let mut formatted_runs = Vec::new();
+                let mut textbox_groups: Vec<Vec<String>> = Vec::new();
 
                 for child in &para.children {
                     if let docx_rs::ParagraphChild::Run(run) = child {
                         let run_formatting = extract_run_formatting(run);
                         let mut run_text = String::new();
 
                         for child in &run.children {
-                            if let docx_rs::RunChild::Text(text_elem) = child {
-                                run_text.push_str(&text_elem.text);
+                            match child {
+                                docx_rs::RunChild::Text(text_elem) => {
+                                    run_text.push_str(&text_elem.text);
+                                }
+                                docx_rs::RunChild::Break(_) => {
+                                    run_text.push('\n');
+                                }
+                                docx_rs::RunChild::Drawing(drawing) => {
+                                    if let Some(docx_rs::DrawingData::TextBox(text_box)) =
+                                        &drawing.data
+                                    {
+                                        let mut group = Vec::new();
+                                        for tb_child in &text_box.children {
+                                            if let docx_rs::TextBoxContentChild::Paragraph(para) =
+                                                tb_child
+                                            {
+                                                let text = extract_paragraph_text(para);
+                                                if !text.is_empty() {
+                                                    group.push(text);
+                                                }
+                                            }
+                                        }
+                                        if !group.is_empty() {
+                                            textbox_groups.push(group);
+                                        }
+                                    }
+                                }
+                                _ => {}
                             }
                         }
 
@@ -151,21 +189,22 @@ pub fn load_document(file_path: &Path, image_options: ImageOptions) -> Result<Do
                 if !total_text.trim().is_empty() {
                     word_count += total_text.split_whitespace().count();
 
-                    // Priority: list numbering > heading style > text heuristics
-                    if let Some(list_info) = list_info {
+                    // Priority: code block > list numbering > heading style > text heuristics
+                    if is_code_block {
+                        let code_text: String =
+   
```

**File**: `src/document/models.rs` (modified, +6/-0)
```diff
@@ -66,6 +66,12 @@ pub enum DocumentElement {
         latex: String,
         fallback: String,
     },
+    CodeBlock {
+        text: String,
+    },
+    TextBox {
+        lines: Vec<String>,
+    },
     PageBreak,
 }
 
```

**File**: `src/document/parsing/numbering.rs` (modified, +160/-123)
```diff
@@ -5,154 +5,191 @@
 
 use once_cell::sync::Lazy;
 use regex::Regex;
-
-/// Type alias for numbering counters to simplify complex HashMap type
-pub(crate) type NumberingCounters = std::collections::HashMap<(i32, u8), u32>;
-
-/// Type alias for heading number and cleaned text
-pub(crate) type HeadingNumberInfo = (String, String);
-
-/// Manages document-wide numbering state for proper sequential numbering
-#[derive(Debug)]
-pub(crate) struct DocumentNumberingManager {
-    /// Counters for each (numId, level) combination
-    /// Key: (numId, level), Value: current counter
-    counters: NumberingCounters,
+use std::collections::{HashMap, HashSet};
+
+/// Parse a Word numFmt string into a `NumberingFormat` variant.
+pub(crate) fn parse_numbering_format(fmt_str: &str) -> NumberingFormat {
+    match fmt_str {
+        "decimal" | "decimalZero" => NumberingFormat::Decimal,
+        "lowerLetter" => NumberingFormat::LowerLetter,
+        "upperLetter" => NumberingFormat::UpperLetter,
+        "lowerRoman" => NumberingFormat::LowerRoman,
+        "upperRoman" => NumberingFormat::UpperRoman,
+        "parenLowerLetter" => NumberingFormat::ParenLowerLetter,
+        "parenLowerRoman" => NumberingFormat::ParenLowerRoman,
+        _ => NumberingFormat::Decimal,
+    }
 }
 
-impl DocumentNumberingManager {
-    pub(crate) fn new() -> Self {
-        Self {
-            counters: NumberingCounters::new(),
+/// Format a counter value using the given numbering format.
+pub(crate) fn format_number_static(counter: u32, format: NumberingFormat) -> String {
+    match format {
+        NumberingFormat::Decimal => format!("{counter}. "),
+        NumberingFormat::LowerLetter => {
+            if counter <= 26 {
+                format!("{}. ", (b'a' + (counter - 1) as u8) as char)
+            } else {
+                format!("{counter}. ")
+            }
+        }
+        NumberingFormat::UpperLetter => {
+            if counter <= 26 {
+                format!("{}. ", (b'A' + (counter - 1) as u8) as char)
+            } else {
+                format!("{counter}. ")
+            }
+        }
+        NumberingFormat::LowerRoman => {
+            format!("{}. ", roman_numeral(counter).to_lowercase())
+        }
+        NumberingFormat::UpperRoman => format!("{}. ", roman_numeral(counter)),
+        NumberingFormat::ParenLowerLetter => {
+            if counter <= 26 {
+                format!("({}) ", (b'a' + (counter - 1) as u8) as char)
+            } else {
+                format!("({counter}) ")
+            }
         }
+        NumberingFormat::ParenLowerRoman => {
+            format!("({}) ", roman_numeral(counter).to_lowercase())
+        }
+        NumberingFormat::Bullet => "* ".to_string(),
     }
+}
 
-    /// Generate the next number for a given numId and level
-    pub(crate) fn generate_number(
-        &mut self,
-        num_id: i32,
-        level: u8,
-        format: NumberingFormat,
-    ) -> String {
-        // Get current counter for this (numId, level) combination
-        let key = (num_id, level);
-        let counter_value = {
-            let counter = self.counters.entry(key).or_insert(0);
-            *counter += 1;
-            *counter
-        };
-
-        // Reset deeper levels when we increment a higher level
-        // This handles hierarchical numbering like 1. -> 1.1 -> 2. (reset 1.1 back to 2.1)
-        self.reset_deeper_levels(num_id, level);
-
-        // For hierarchical numbering, we need to build the full number string
-        self.format_hierarchical_number(num_id, level, counter_value, format)
+fn roman_numeral(num: u32) -> String {
+    const VALUES: &[u32] = &[1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
+    const SYMBOLS: &[&str] = &[
+        "M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I",
+    ];
+    let mut result = String::new();
+    let mut n = num;
+    for (i, &value) in VALUES.iter().enumerate() {
+        while n >= value {
+            result.push_str(SYMBOLS[i]);
+            n -= value;
+        }
     }
+    result
+}
 
-    fn reset_deeper_levels(&mut self, num_id: i32, current_level: u8) {
-        // Reset all levels deeper than current_level for this numId
-        let keys_to_reset: Vec<_> = self
-            .counters
-            .keys()
-            .filter(|(id, level)| *id == num_id && *level > current_level)
-            .cloned()
-            .collect();
+/// Resolves DOCX numbering definitions to determine list ordering and formatting.
+///
+/// Tracks counters per `(abstractNumId, level)` so that different `numId` values
+/// that share the same abstract numbering definition continue counting sequentially.
+/// Start overrides in a `numId`'s level overrides are applied once on first use.
+pub(crate) struct NumberingResolver {
+    /// (abstractNumId, level) → (numFmt string, default start value)
+    abstract_levels: HashMap<(usize, usize), (String, usize)>,
+    /// numId → (abstractNumId, level → sta
```

**File**: `src/document/query.rs` (modified, +14/-0)
```diff
@@ -66,6 +66,20 @@ pub fn search_document(document: &Document, query: &str) -> Vec<SearchResult> {
             }
             DocumentElement::Image { description, .. } => description,
             DocumentElement::Equation { latex, .. } => latex,
+            DocumentElement::CodeBlock { text } => text,
+            DocumentElement::TextBox { lines } => {
+                let combined = lines.join(" ");
+                let text_lower = combined.to_lowercase();
+                if let Some(start_pos) = text_lower.find(&query_lower) {
+                    results.push(SearchResult {
+                        element_index,
+                        text: combined,
+                        start_pos,
+                        end_pos: start_pos + query.len(),
+                    });
+                }
+                continue;
+            }
             DocumentElement::PageBreak => continue,
         };
 
```

**File**: `src/export.rs` (modified, +46/-0)
```diff
@@ -151,6 +151,20 @@ pub fn format_as_markdown(document: &Document) -> String {
             DocumentElement::Equation { latex, .. } => {
                 markdown.push_str(&format!("$${latex}$$\n\n"));
             }
+            DocumentElement::CodeBlock { text } => {
+                markdown.push_str("```\n");
+                markdown.push_str(text);
+                if !text.ends_with('\n') {
+                    markdown.push('\n');
+                }
+                markdown.push_str("```\n\n");
+            }
+            DocumentElement::TextBox { lines } => {
+                for line in lines {
+                    markdown.push_str(&format!("> {line}\n"));
+                }
+                markdown.push('\n');
+            }
             DocumentElement::PageBreak => {
                 markdown.push_str("\n---\n\n");
             }
@@ -276,6 +290,22 @@ pub fn format_as_text(document: &Document) -> String {
             DocumentElement::Equation { latex, .. } => {
                 text.push_str(&format!("Equation: {latex}\n\n"));
             }
+            DocumentElement::CodeBlock { text: code } => {
+                text.push_str(code);
+                if !code.ends_with('\n') {
+                    text.push('\n');
+                }
+                text.push('\n');
+            }
+            DocumentElement::TextBox { lines } => {
+                let width = lines.iter().map(|s| s.len()).max().unwrap_or(0) + 2;
+                let bar = "-".repeat(width);
+                text.push_str(&format!("+{bar}+\n"));
+                for line in lines {
+                    text.push_str(&format!("| {line:<width$} |\n", width = width - 2));
+                }
+                text.push_str(&format!("+{bar}+\n\n"));
+            }
         }
     }
 
@@ -387,6 +417,22 @@ fn export_to_text_with_images(document: &Document) {
             DocumentElement::Equation { latex, .. } => {
                 println!("Equation: {latex}\n");
             }
+            DocumentElement::CodeBlock { text } => {
+                print!("{text}");
+                if !text.ends_with('\n') {
+                    println!();
+                }
+                println!();
+            }
+            DocumentElement::TextBox { lines } => {
+                let width = lines.iter().map(|s| s.len()).max().unwrap_or(0) + 2;
+                let bar = "-".repeat(width);
+                println!("+{bar}+");
+                for line in lines {
+                    println!("| {line:<width$} |", width = width - 2);
+                }
+                println!("+{bar}+\n");
+            }
             DocumentElement::PageBreak => {
                 println!("{}\n", "-".repeat(50));
             }
```

**File**: `src/ui.rs` (modified, +10/-0)
```diff
@@ -388,6 +388,16 @@ async fn run_non_interactive(document: Document, cli: &Cli) -> Result<()> {
                         println!("📐 Equation: {latex}");
                         println!();
                     }
+                    DocumentElement::CodeBlock { text } => {
+                        println!("{text}");
+                        println!();
+                    }
+                    DocumentElement::TextBox { lines } => {
+                        for line in lines {
+                            println!("│ {line}");
+                        }
+                        println!();
+                    }
                     DocumentElement::PageBreak => {
                         println!("---");
                         println!();
```

**File**: `src/widgets/document.rs` (modified, +67/-0)
```diff
@@ -564,6 +564,51 @@ impl<'a> DocumentWidget<'a> {
         }
     }
 
+    /// Render a text box element with Unicode box-drawing borders
+    fn render_text_box(
+        lines: &[String],
+        area: Rect,
+        buf: &mut Buffer,
+        current_y: &mut u16,
+        color_enabled: bool,
+    ) {
+        if *current_y >= area.y + area.height {
+            return;
+        }
+
+        let border_style = if color_enabled {
+            Style::default().fg(Color::Cyan)
+        } else {
+            Style::default()
+        };
+
+        let inner_width = (area.width as usize).saturating_sub(4); // "│ " + " │"
+        let bar = "─".repeat(area.width.saturating_sub(2) as usize);
+
+        // Top border: ┌───┐
+        buf.set_string(area.x, *current_y, format!("┌{bar}┐"), border_style);
+        *current_y += 1;
+
+        // Content lines
+        for line in lines {
+            if *current_y >= area.y + area.height {
+                return;
+            }
+            let truncated: String = line.chars().take(inner_width).collect();
+            let padded = format!("│ {truncated:<inner_width$} │", inner_width = inner_width);
+            buf.set_string(area.x, *current_y, padded, border_style);
+            *current_y += 1;
+        }
+
+        // Bottom border: └───┘
+        if *current_y < area.y + area.height {
+            buf.set_string(area.x, *current_y, format!("└{bar}┘"), border_style);
+            *current_y += 1;
+        }
+
+        *current_y += 1; // blank line after box
+    }
+
     /// Render a page break element
     fn render_page_break(area: Rect, buf: &mut Buffer, current_y: &mut u16, color_enabled: bool) {
         if *current_y >= area.y + area.height {
@@ -736,6 +781,28 @@ impl<'a> DocumentWidget<'a> {
                     current_y += 2; // Equation + blank line
                 }
 
+                DocumentElement::CodeBlock { text } => {
+                    if current_y < area.y + area.height {
+                        let code_style = if self.color_enabled {
+                            Style::default().fg(Color::Green)
+                        } else {
+                            Style::default()
+                        };
+                        for line in text.lines() {
+                            if current_y >= area.y + area.height {
+                                break;
+                            }
+                            buf.set_string(area.x, current_y, line, code_style);
+                            current_y += 1;
+                        }
+                        current_y += 1; // blank line after block
+                    }
+                }
+
+                DocumentElement::TextBox { lines } => {
+                    Self::render_text_box(lines, area, buf, &mut current_y, self.color_enabled);
+                }
+
                 DocumentElement::PageBreak => {
                     Self::render_page_break(area, buf, &mut current_y, self.color_enabled);
                 }
```

#### Recent Merged Pull Requests:
- **PR #96** (2026-07-15): fix(tui): wrap text at word boundaries instead of mid-character (@bgreenwell)
- **PR #95** (2026-07-15): docs: declare MSRV and fix the Rust version badge (@bgreenwell)
- **PR #94** (2026-07-15): fix(deps): bump ratatui-image to 9.0 without the chafa system dependency (@bgreenwell)
- **PR #93** (2026-07-15): ci: bump actions/checkout to v7 and cargo-dist to 0.32.0 (@bgreenwell)
- **PR #92** (closed): deps(deps): bump ratatui-image from 8.0.2 to 9.0.0 (@dependabot[bot])
- **PR #91** (2026-07-15): deps(deps): bump crossterm from 0.27.0 to 0.28.1 (@dependabot[bot])
- **PR #90** (2026-07-15): deps(deps): bump the rust-dependencies group with 2 updates (@dependabot[bot])
- **PR #89** (closed): ci(deps): bump actions/checkout from 4 to 7 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
