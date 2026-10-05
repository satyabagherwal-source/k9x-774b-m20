# Forensic Learning Record (Deep Inspection): bgreenwell/doxx

> **Canonical Artifact**: `07_PROJECT_LEARNING/bgreenwell-doxx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bgreenwell/doxx](https://github.com/bgreenwell/doxx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:24:49.170Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bgreenwell/doxx`
- **Description**: Expose the contents of .docx files without leaving your terminal. Fast, safe, and smart — no Office required!
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3761 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
) -> Res
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
/// for this position, push a
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

### Incident Patch 1: `9128f0fb` (2026-07-15)
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
+        
```

---

### Incident Patch 2: `0a8856c3` (2026-07-15)
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
+        
```

---

### Incident Patch 3: `8884c0fb` (2026-07-15)
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

### Incident Patch 4: `fb603ccd` (2026-07-15)
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

### Incident Patch 5: `cb6eac2f` (2026-07-15)
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

### Incident Patch 6: `33d6d495` (2026-07-15)
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

### Incident Patch 7: `54010069` (2026-07-12)
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

### Incident Patch 8: `13e0a27d` (2026-07-08)
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
+This Code of 
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

### Incident Patch 9: `a2edbaaf` (2026-07-08)
**Commit Message**: docs: fix pre-built binaries download command



---

### Incident Patch 10: `c5b0a641` (2026-07-08)
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
