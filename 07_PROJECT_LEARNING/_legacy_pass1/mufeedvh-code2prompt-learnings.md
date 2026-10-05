# Forensic Learning Record (Deep Inspection): mufeedvh/code2prompt

> **Canonical Artifact**: `07_PROJECT_LEARNING/mufeedvh-code2prompt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mufeedvh/code2prompt](https://github.com/mufeedvh/code2prompt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:41:30.035Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mufeedvh/code2prompt`
- **Description**: A CLI tool to convert your codebase into a single LLM prompt with source tree, prompt templating, and token counting.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7717 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/code2prompt-core/src/analysis.rs`
```
//! Analysis Engine for Codebase Statistics
//!
//! This module computes TOPOLOGY and STRUCTURE.
//! It knows nothing about ASCII art, colors, or how to draw a tree.
//!
//! Inspired by dust and JackYoustra's implementation

use crate::path::FileEntry;
use serde::{Deserialize, Serialize};
use std::cmp::{Ordering, Reverse};
use std::collections::{BTreeMap, BinaryHeap, HashMap};
use std::path::Path;

// ============================================================================
// Public Data Models
// ============================================================================

/// Represents a topological entry in the statistics tree.
///
/// CLEAN ARCHITECTURE: This struct contains NO visual artifacts (like "│ │").
/// It only describes the node's properties and its position in the hierarchy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenMapEntry {
    pub path: String,
    pub name: String,
    pub tokens: usize,
    pub percentage: f64,

    // Topological Metadata
    pub depth: usize,
    /// Is this node the last child of its parent? (Crucial for drawing logic)
    pub is_last_child: bool,
    /// Does this node have visible children in the filtered set?
    pub has_children: bool,

    pub metadata: EntryMetadata,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct EntryMetadata {
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionStat {
    pub extension: String,
    pub file_count: usize,
    pub tokens: usize,
    pub percentage: f64,
}

#[derive(Debug, Clone)]
pub struct TokenMapOptions {
    pub max_lines: usize,
    pub min_percent: f64,
}

impl Default for TokenMapOptions {
    fn default() -> Self {
        Self {
            max_lines: 20,
            min_percent: 0.1,
        }
    }
}

// ============================================================================
// CodebaseAnalysis Facade
// ============================================================================

pub struct CodebaseAnalysis<'a> {
    files: &'a [FileEntry],
    total_tokens: usize,
}

impl<'a> CodebaseAnalysis<'a> {
    pub fn new(files: &'a [FileEntry], total_tokens: usize) -> Self {
        Self {
            files,
            total_tokens,
        }
    }

    /// Generates a flat list of entries representing the filtered tree.
    /// Uses the dust-inspired algorithm to show the most significant entries.
    pub fn token_map(&self, options: TokenMapOptions) -> Vec<TokenMapEntry> {
        // 1. Find common path prefix to strip (for absolute paths)
        let common_prefix = find_common_path_prefix(self.files);

        // 2. Build the tree structure
        let mut root = TreeNode::new(String::new());
        root.tokens = self.total_tokens;

        // Insert all files into the tree
        for file in self.files {
            let path = Path::new(&file.path);

            // Strip common prefix if present
            let path_to_use = if let Some(prefix) = &common_prefix {
                path.strip_prefix(prefix).unwrap_or(path)
            } else {
                path
            };

            let components: Vec<&str> = path_to_use
                .components()
                .filter_map(|c| c.as_os_str().to_str())
                .filter(|c| *c != "/" && !c.is_empty()) // Skip root slash and empty components
                .collect();

            if !components.is_empty() {
                insert_path(
                    &mut root,
                    &components,
                    file.token_count,
                    String::new(),
                    EntryMetadata {
                        is_dir: file.metadata.is_dir,
                    },
                );
            }
        }

        // 2. Select nodes to display using priority queue (dust algorithm)
        let allowed_nodes = select_nodes_to_display(&root, self.total_tokens, &options);

        // 3. Flatten the tree to entries, respecting the selection
        let mut entries = Vec::new();
        rebuild_filtered_tree(
            &root,
            String::new(),
            &allowed_nodes,
            &mut entries,
            0,
            self.total_tokens,
            true,
        );

        // 4. Calculate tokens for files actually displayed (avoid double-counting dirs)
        let displayed_file_tokens: usize = entries
            .iter()
            .filter(|e| !e.metadata.is_dir)
            .map(|e| e.tokens)
            .sum();

        // 5. Calculate total file tokens in the tree (not directory sums)
        let total_file_tokens = calculate_file_tokens(&root);

        // 6. Add "Other files" aggregation if we filtered things out
        let hidden_tokens = total_file_tokens.saturating_sub(displayed_file_tokens);
        if hidden_tokens > 0 {
            // Mark the previous last item as not last anymore
            if let Some(last) = entries.last_mut()
                && last.depth == 0
            {
                last.is_last_child = false;
            }

            entries.push(TokenMapEntry {
                path: "(other files)".to_string(),
                name: "(other files)".to_string(),
                tokens: hidden_tokens,
                percentage: (hidden_tokens as f64 / self.total_tokens as f64) * 100.0,
                depth: 0,
                is_last_child: true,
                has_children: false,
                metadata: EntryMetadata { is_dir: false },
            });
        }

        entries
    }

    /// Aggregate tokens by file extension
    pub fn by_extension(&self) -> Vec<ExtensionStat> {
        let mut stats: HashMap<String, (usize, usize)> = HashMap::new();

        for file in self.files {
            if file.metadata.is_dir {
                continue;
            }

            let ext = Path::new(&file.path)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("(no extension)")
                .to_string();

            let entry = stats.entry(ext).or_insert((0, 0));
            entry.0 += 1; // file count
            entry.1 += file.token_count; // tokens
        }

        let mut result: Vec<ExtensionStat> = stats
            .into_iter()
            .map(|(ext, (count, tokens))| ExtensionStat {
                extension: ext,
                file_count: count,
                tokens,
                percentage: (tokens as f64 / self.total_tokens as f64) * 100.0,
            })
            .collect();

        result.sort_by_key(|b| Reverse(b.tokens));
        result
    }

    /// Get raw file entries
    pub fn raw_files(&self) -> &[FileEntry] {
        self.files
    }
}

// ============================================================================
// Internal Tree Structure
// ============================================================================

#[derive(Debug, Clone)]
struct TreeNode {
    tokens: usize,
    children: BTreeMap<String, TreeNode>, // BTreeMap for deterministic ordering!
    path: String,
    metadata: Option<EntryMetadata>,
}

impl TreeNode {
    fn new(path: String) -> Self {
        TreeNode {
            tokens: 0,
            children: BTreeMap::new(),
            path,
            metadata: None,
        }
    }
}

/// Insert a file path into the tree, accumulating tokens up the hierarchy
fn insert_path(
    node: &mut TreeNode,
    components: &[&str],
    tokens: usize,
    parent_path: String,
    file_metadata: EntryMetadata,
) {
    if components.is_empty() {
        return;
    }

    if components.len() == 1 {
        // This is a file (leaf node)
        let file_name = components[0].to_string();
        let file_path = if parent_path.is_empty() {
            file_name.clone()
        } else {
            format!("{}/{}", parent_path, file_name)
        };

        let child = node
            .children
            .entry(file_name)
            .or_insert_with(|| TreeNode::new(file_path));
        child.tokens = tokens;
        child.metadata = S
```

### Core Architecture Module: `crates/code2prompt-core/src/builtin_templates.rs`
```
//! Built-in templates embedded as static resources.
//!
//! This module provides access to all built-in templates that are embedded
//! directly into the binary, making them available even when the crate is
//! installed from crates.io without access to the source file structure.

use std::{collections::HashMap, sync::OnceLock};

/// Information about a built-in template
#[derive(Debug, Clone, Copy)]
pub struct BuiltinTemplate {
    pub name: &'static str,
    pub content: &'static str,
    pub description: &'static str,
}

/// All built-in templates embedded as static strings
pub struct BuiltinTemplates;

static TEMPLATES: OnceLock<HashMap<&'static str, BuiltinTemplate>> = OnceLock::new();

impl BuiltinTemplates {
    /// Get all available built-in templates
    pub fn get_all() -> &'static HashMap<&'static str, BuiltinTemplate> {
        TEMPLATES.get_or_init(|| {
            HashMap::from([
                (
                    "default-markdown",
                    BuiltinTemplate {
                        name: "Default (Markdown)",
                        content: include_str!("default_template_md.hbs"),
                        description: "Default markdown template for code analysis",
                    },
                ),
                (
                    "default-xml",
                    BuiltinTemplate {
                        name: "Default (XML)",
                        content: include_str!("default_template_xml.hbs"),
                        description: "Default XML template for code analysis",
                    },
                ),
                (
                    "binary-exploitation-ctf-solver",
                    BuiltinTemplate {
                        name: "Binary Exploitation CTF Solver",
                        content: include_str!("../templates/binary-exploitation-ctf-solver.hbs"),
                        description: "Template for solving binary exploitation CTF challenges",
                    },
                ),
                (
                    "clean-up-code",
                    BuiltinTemplate {
                        name: "Clean Up Code",
                        content: include_str!("../templates/clean-up-code.hbs"),
                        description: "Template for code cleanup and refactoring",
                    },
                ),
                (
                    "cryptography-ctf-solver",
                    BuiltinTemplate {
                        name: "Cryptography CTF Solver",
                        content: include_str!("../templates/cryptography-ctf-solver.hbs"),
                        description: "Template for solving cryptography CTF challenges",
                    },
                ),
                (
                    "document-the-code",
                    BuiltinTemplate {
                        name: "Document the Code",
                        content: include_str!("../templates/document-the-code.hbs"),
                        description: "Template for generating code documentation",
                    },
                ),
                (
                    "find-security-vulnerabilities",
                    BuiltinTemplate {
                        name: "Find Security Vulnerabilities",
                        content: include_str!("../templates/find-security-vulnerabilities.hbs"),
                        description: "Template for security vulnerability analysis",
                    },
                ),
                (
                    "fix-bugs",
                    BuiltinTemplate {
                        name: "Fix Bugs",
                        content: include_str!("../templates/fix-bugs.hbs"),
                        description: "Template for bug fixing and debugging",
                    },
                ),
                (
                    "improve-performance",
                    BuiltinTemplate {
                        name: "Improve Performance",
                        content: include_str!("../templates/improve-performance.hbs"),
                        description: "Template for performance optimization",
                    },
                ),
                (
                    "refactor",
                    BuiltinTemplate {
                        name: "Refactor",
                        content: include_str!("../templates/refactor.hbs"),
                        description: "Template for code refactoring",
                    },
                ),
                (
                    "reverse-engineering-ctf-solver",
                    BuiltinTemplate {
                        name: "Reverse Engineering CTF Solver",
                        content: include_str!("../templates/reverse-engineering-ctf-solver.hbs"),
                        description: "Template for solving reverse engineering CTF challenges",
                    },
                ),
                (
                    "web-ctf-solver",
                    BuiltinTemplate {
                        name: "Web CTF Solver",
                        content: include_str!("../templates/web-ctf-solver.hbs"),
                        description: "Template for solving web CTF challenges",
                    },
                ),
                (
                    "write-git-commit",
                    BuiltinTemplate {
                        name: "Write Git Commit",
                        content: include_str!("../templates/write-git-commit.hbs"),
                        description: "Template for generating git commit messages",
                    },
                ),
                (
                    "write-github-pull-request",
                    BuiltinTemplate {
                        name: "Write GitHub Pull Request",
                        content: include_str!("../templates/write-github-pull-request.hbs"),
                        description: "Template for generating GitHub pull request descriptions",
                    },
                ),
                (
                    "write-github-readme",
                    BuiltinTemplate {
                        name: "Write GitHub README",
                        content: include_str!("../templates/write-github-readme.hbs"),
                        description: "Template for generating GitHub README files",
                    },
                ),
            ])
        })
    }

    /// Get a specific template by its key
    pub fn get_template(key: &str) -> Option<BuiltinTemplate> {
        Self::get_all().get(key).cloned()
    }

    /// Get all template keys
    pub fn get_template_keys() -> Vec<&'static str> {
        Self::get_all().keys().copied().collect()
    }

    /// Check if a template exists
    pub fn has_template(key: &str) -> bool {
        Self::get_all().contains_key(key)
    }
}

```

### Core Architecture Module: `crates/code2prompt-core/src/configuration.rs`
```
//! This module defines the `Code2PromptConfig` struct and its Builder for configuring the behavior
//! of code2prompt in a stateless manner. It includes all parameters needed for file traversal,
//! code filtering, token counting, and more.

use crate::file_processor::FileProcessorsConfig;
use crate::template::OutputFormat;
use crate::tokenizer::TokenizerType;
use crate::{sort::FileSortMethod, tokenizer::TokenFormat};
use derive_builder::Builder;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

/// Configuration object defining preferences and filters for code prompt generation.
/// 
/// This stateless object can be cloned freely and shared across multiple sessions.
/// Use `Code2PromptConfigBuilder` for construction with validation.
/// 
/// # Example
/// ```
/// use code2prompt_core::configuration::Code2PromptConfig;
/// 
/// let config = Code2PromptConfig::builder()
///     .hidden(true)
///     .build()
///     .unwrap();
/// ```
///
/// 
/// # Errors
/// `build()` returns `ConfigError` if validation fails.
#[derive(Debug, Clone, Default, Builder)]
#[builder(setter(into), default)]
pub struct Code2PromptConfig {
    /// Path to the root directory of the codebase.
    pub path: PathBuf,

    /// List of glob-like patterns to include.
    pub include_patterns: Vec<String>,

    /// List of glob-like patterns to exclude.
    pub exclude_patterns: Vec<String>,

    /// If true, code lines will be numbered in the output.
    pub line_numbers: bool,

    /// If true, paths in the output will be absolute instead of relative.
    pub absolute_path: bool,

    /// If true, code2prompt will generate a full directory tree, ignoring include/exclude rules.
    pub full_directory_tree: bool,

    /// If true, code blocks will not be wrapped in Markdown fences (```).
    pub no_codeblock: bool,

    /// If true, symbolic links will be followed during traversal.
    pub follow_symlinks: bool,

    /// If true, extract an entity-level code map (functions, classes, ...) for
    /// each file via sem-core, exposed to templates as `FileEntry.entities` and a
    /// top-level `code_map`. Requires the `entity-map` build feature; without it
    /// this flag has no effect.
    ///
    /// Default: `false`
    pub entity_map: bool,

    /// Include hidden files and directories in processing.
    /// 
    /// Default: `false`
    pub hidden: bool,

    /// If true, .gitignore rules will be ignored.
    pub no_ignore: bool,

    /// Defines the sorting method for files.
    pub sort_method: Option<FileSortMethod>,

    /// Determines the output format of the final prompt.
    pub output_format: OutputFormat,

    /// Set custom template content for prompt generation.
    /// 
    /// Overrides default template. Template must be valid Handlebars format.
    /// 
    /// # Errors
    /// Returns error during `build()` if template syntax is invalid.
    pub custom_template: Option<String>,

    /// The tokenizer encoding to use for counting tokens.
    pub encoding: TokenizerType,

    /// The counting format to use for token counting.
    pub token_format: TokenFormat,

    /// If true, the git diff between HEAD and index will be included.
    pub diff_enabled: bool,

    /// If set, contains two branch names for which code2prompt will generate a git diff.
    pub diff_branches: Option<(String, String)>,

    /// Populated internally from `diff_branches` before traversal: the set of
    /// relative file paths that changed between the two branches. When
    /// present, `discover_files` prunes both the source tree and the
    /// collected file content down to just these paths, mirroring how
    /// `include_patterns` filters both. Not user-configurable directly.
    pub diff_files: Option<HashSet<PathBuf>>,

    /// If set, contains two branch names for which code2prompt will retrieve the git log.
    pub log_branches: Option<(String, String)>,

    /// The name of the template used.
    pub template_name: String,

    /// The template string itself.
    pub template_str: String,

    /// Extra template data
    pub user_variables: HashMap<String, String>,

    /// If true, detailed token map breakdown will be displayed in output.
    ///
    /// Note: Token counting always happens internally for performance optimization
    /// (parallelized during file I/O). This flag only controls whether the breakdown
    /// is shown to users in the final output.
    pub token_map_enabled: bool,

    /// If true, starts with all files deselected.
    pub deselected: bool,

    /// Settings for file-type processors (e.g. Jupyter notebooks).
    pub processors: FileProcessorsConfig,
}

impl Code2PromptConfig {
    pub fn builder() -> Code2PromptConfigBuilder {
        Code2PromptConfigBuilder::default()
    }
}

/// Output destination for code2prompt
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum OutputDestination {
    #[default]
    Stdout,
    Clipboard,
    File,
}

/// TOML configuration structure that can be serialized/deserialized
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct TomlConfig {
    /// Default output behavior: "stdout", "clipboard", or "file"
    pub default_output: OutputDestination,

    /// Path to the codebase directory
    pub path: Option<String>,

    /// Patterns to include
    pub include_patterns: Vec<String>,

    /// Patterns to exclude
    pub exclude_patterns: Vec<String>,

    /// Display options
    pub line_numbers: bool,
    pub absolute_path: bool,
    pub full_directory_tree: bool,

    /// Output format
    pub output_format: Option<OutputFormat>,

    /// Sort method
    pub sort_method: Option<FileSortMethod>,

    /// Tokenizer settings
    pub encoding: Option<TokenizerType>,
    pub token_format: Option<TokenFormat>,

    /// Git settings
    pub diff_enabled: bool,
    pub diff_branches: Option<Vec<String>>,
    pub log_branches: Option<Vec<String>>,

    /// Template settings
    pub template_name: Option<String>,
    pub template_str: Option<String>,

    /// User variables
    pub user_variables: HashMap<String, String>,

    /// Token map
    pub token_map_enabled: bool,

    /// Initial selection state
    pub deselected: bool,

    /// File processor settings (nested tables such as `[processors.ipynb]`)
    pub processors: FileProcessorsConfig,
}

impl TomlConfig {
    /// Load TOML configuration from a string
    pub fn from_toml_str(content: &str) -> Result<Self, toml::de::Error> {
        toml::from_str(content)
    }

    /// Convert TOML configuration to string
    pub fn to_string(&self) -> Result<String, toml::ser::Error> {
        toml::to_string_pretty(self)
    }

    /// Convert TomlConfig to Code2PromptConfig
    pub fn to_code2prompt_config(&self) -> Code2PromptConfig {
        let mut builder = Code2PromptConfig::builder();

        if let Some(path) = &self.path {
            builder.path(PathBuf::from(path));
        }

        builder
            .include_patterns(self.include_patterns.clone())
            .exclude_patterns(self.exclude_patterns.clone())
            .line_numbers(self.line_numbers)
            .absolute_path(self.absolute_path)
            .full_directory_tree(self.full_directory_tree);

        builder.output_format(self.output_format.unwrap_or_default());

        builder.sort_method(self.sort_method);

        builder.encoding(self.encoding.unwrap_or_default());

        builder.token_format(self.token_format.unwrap_or_default());

        builder.diff_enabled(self.diff_enabled);

        if let Some(diff_branches) = &self.diff_branches
            && diff_branches.len() == 2
        {
            builder.diff_branches(Some((diff_branches[0].clone(), diff_branches[1].clone())));
        }

        if let Some(log_branches) = &self.log_branches
            && log_branches.len() == 2
        {
            builder.log_branches(Some((log_branch
```

### Core Architecture Module: `crates/code2prompt-core/src/entity_map.rs`
```
//! Entity-level code map via [sem-core](https://github.com/Ataraxy-Labs/sem).
//!
//! When the `entity-map` feature is enabled, code2prompt extracts the structural
//! entities (functions, classes, methods, ...) from each source file using
//! sem-core's tree-sitter parsers. The result is exposed to templates both
//! per-file (`FileEntry.entities`) and as a top-level `code_map` aggregate, so a
//! prompt can include a compact outline of the codebase instead of, or alongside,
//! full file contents.
//!
//! sem-core is offline and emits no telemetry, so enabling this does not change
//! code2prompt's privacy posture.

use serde::{Deserialize, Serialize};

/// A single structural entity (function, class, method, ...) within a file.
///
/// This is a deliberately small projection of sem-core's internal entity type:
/// it carries only what a prompt template needs (name, kind, line range,
/// signature, parent), not source bodies or content hashes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EntitySummary {
    /// Entity name, e.g. `process_single_file`.
    pub name: String,
    /// Entity kind as reported by sem-core, e.g. `function`, `class`, `method`.
    pub kind: String,
    /// 1-based first line of the entity.
    pub start_line: usize,
    /// 1-based last line of the entity.
    pub end_line: usize,
    /// First line of the entity's source (its signature/declaration), trimmed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
    /// Name of the enclosing entity (e.g. the class a method belongs to), if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
}

/// A file paired with its entity outline, used for the top-level `code_map`
/// template variable (an aggregate view alongside the per-file `entities`).
#[derive(Debug, Clone, Serialize)]
pub struct FileCodeMap {
    pub path: String,
    pub entities: Vec<EntitySummary>,
}

/// Extract the entity outline for one file's contents.
///
/// `file_path` is used by sem-core to pick the right language parser (by
/// extension). Returns an empty vector for files in languages sem-core does not
/// parse, so it is safe to call on every file.
#[cfg(feature = "entity-map")]
pub fn extract_entities(file_path: &str, content: &str) -> Vec<EntitySummary> {
    use sem_core::parser::plugins::create_default_registry;
    use sem_core::parser::registry::ParserRegistry;
    use std::cell::RefCell;
    use std::collections::HashMap;

    // One registry per worker thread: building it registers every language
    // plugin, so we amortize that across files rather than paying it per file,
    // while staying thread-safe inside code2prompt's rayon file pipeline.
    // NOTE: `ParserRegistry::new()` is empty; `create_default_registry()` is the
    // populated one the sem CLI uses.
    thread_local! {
        static REGISTRY: RefCell<ParserRegistry> = RefCell::new(create_default_registry());
    }

    REGISTRY.with(|cell| {
        let registry = cell.borrow();
        let entities = registry.extract_entities(file_path, content);

        // Resolve parent_id -> parent name so methods can show their class.
        let name_by_id: HashMap<&str, &str> = entities
            .iter()
            .map(|e| (e.id.as_str(), e.name.as_str()))
            .collect();

        entities
            .iter()
            .map(|e| {
                let signature = e
                    .content
                    .lines()
                    .next()
                    .map(|l| l.trim().to_string())
                    .filter(|s| !s.is_empty());
                let parent = e
                    .parent_id
                    .as_deref()
                    .and_then(|pid| name_by_id.get(pid).map(|n| n.to_string()));
                EntitySummary {
                    name: e.name.clone(),
                    kind: e.entity_type.clone(),
                    start_line: e.start_line,
                    end_line: e.end_line,
                    signature,
                    parent,
                }
            })
            .collect()
    })
}

/// No-op when the `entity-map` feature is disabled, so the rest of the codebase
/// compiles and runs identically without the sem-core dependency.
#[cfg(not(feature = "entity-map"))]
pub fn extract_entities(_file_path: &str, _content: &str) -> Vec<EntitySummary> {
    Vec::new()
}

#[cfg(all(test, feature = "entity-map"))]
mod tests {
    use super::*;

    #[test]
    fn extracts_rust_entities() {
        let src = "pub struct Cache { size: usize }\n\nimpl Cache {\n    pub fn new(size: usize) -> Self { Cache { size } }\n}\n\nfn helper(x: i32) -> i32 { x * 2 }\n";
        let got = extract_entities("util.rs", src);
        assert!(!got.is_empty(), "expected entities, got none: {got:?}");
        assert!(got.iter().any(|e| e.name == "helper"));
    }

    #[test]
    fn extracts_python_entities() {
        let src = "class Calculator:\n    def add(self, a, b):\n        return a + b\n\ndef main():\n    pass\n";
        let got = extract_entities("math.py", src);
        assert!(!got.is_empty(), "expected entities, got none: {got:?}");
    }
}

```

### Core Architecture Module: `crates/code2prompt-core/src/file_processor/csv.rs`
```
//! CSV file processor with schema extraction.
//!
//! This processor uses the `csv` crate to robustly parse CSV files and extract:
//! - Column headers
//! - One sample data row
//!
//! This provides sufficient context for LLMs to understand the data structure
//! without wasting tokens on thousands of rows.

use super::{DefaultTextProcessor, FileProcessor};
use anyhow::{Context, Result};
use std::path::Path;

/// CSV processor that extracts headers and one sample row.
///
/// Uses streaming to avoid loading large files into memory.
/// Falls back to raw text if parsing fails.
pub struct CsvProcessor;

impl CsvProcessor {
    /// Internal processing with specific delimiter.
    ///
    /// # Arguments
    ///
    /// * `content` - Raw CSV bytes
    /// * `delimiter` - Field delimiter (b',' for CSV, b'\t' for TSV)
    /// * `path` - File path for error messages
    pub(crate) fn process_with_delimiter(
        &self,
        content: &[u8],
        delimiter: u8,
        _path: &Path,
    ) -> Result<String> {
        let mut reader = csv::ReaderBuilder::new()
            .delimiter(delimiter)
            .flexible(true) // Allow variable number of fields
            .from_reader(content);

        // Extract headers
        let headers = reader
            .headers()
            .context("Failed to read CSV headers")?
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<_>>();

        if headers.is_empty() {
            anyhow::bail!("CSV file has no headers");
        }

        // Read first data row
        let mut records = reader.records();
        let first_row = records
            .next()
            .transpose()
            .context("Failed to read first data row")?;

        let mut output = String::new();
        output.push_str("CSV Schema (1 sample row):\n");
        output.push_str(&format!("Headers: {}\n", headers.join(", ")));

        if let Some(row) = first_row {
            let values: Vec<String> = row.iter().map(|field| format!("\"{}\"", field)).collect();
            output.push_str(&format!("Sample: {}\n", values.join(", ")));

            // Count remaining rows for truncation message
            let remaining_rows = records.count();
            if remaining_rows > 0 {
                output.push_str(&format!("... [{} more rows omitted]\n", remaining_rows));
            }
        } else {
            output.push_str("(No data rows found)\n");
        }

        Ok(output)
    }
}

impl FileProcessor for CsvProcessor {
    fn process(&self, content: &[u8], path: &Path) -> Result<String> {
        match self.process_with_delimiter(content, b',', path) {
            Ok(result) => Ok(result),
            Err(e) => {
                log::warn!(
                    "CSV parsing failed for {:?}: {}. Using raw text fallback.",
                    path,
                    e
                );
                // Fallback to raw text
                let fallback = DefaultTextProcessor;
                fallback.process(content, path)
            }
        }
    }
}

```

### Core Architecture Module: `crates/code2prompt-core/src/file_processor/default.rs`
```
//! Default text processor for standard file types.
//!
//! This processor handles all file types that don't require special processing.
//! It converts raw bytes to UTF-8 strings using lossy conversion to handle
//! invalid UTF-8 sequences gracefully.

use super::FileProcessor;
use anyhow::Result;
use chardetng::{EncodingDetector, Iso2022JpDetection, Utf8Detection};
use std::path::Path;

/// Default processor that converts bytes to UTF-8 string.
///
/// This processor uses the `chardetng` crate to detect the encoding of the input bytes
/// and converts them to a UTF-8 string. If the encoding cannot be determined, it
/// defaults to UTF-8. Invalid sequences are replaced with the Unicode replacement character.
pub struct DefaultTextProcessor;

impl FileProcessor for DefaultTextProcessor {
    fn process(&self, content: &[u8], _path: &Path) -> Result<String> {
        let mut detector = EncodingDetector::new(Iso2022JpDetection::Deny);
        detector.feed(content, true);

        // Guess the encoding; if none is found, default to UTF-8
        let encoding = detector.guess(None, Utf8Detection::Allow);

        let (cow, _encoding_used, _had_errors) = encoding.decode(content);

        match cow {
            std::borrow::Cow::Owned(s) => Ok(s),
            std::borrow::Cow::Borrowed(s) => Ok(s.to_string()),
        }
    }
}

```

### Core Architecture Module: `crates/code2prompt-core/src/file_processor/ipynb.rs`
```
//! Jupyter Notebook (.ipynb) file processor.
//!
//! This processor parses Jupyter notebook JSON and extracts:
//! - Total number of cells and their types
//! - Code cells (and optionally markdown cells)
//! - A configurable number of sample cells
//! - Optional cell outputs
//!
//! This provides LLMs with notebook structure context without overwhelming them with all cells.

use super::{DefaultTextProcessor, FileProcessor, IpynbProcessorConfig};
use anyhow::{Context, Result};
use serde_json::Value;
use std::path::Path;

/// Jupyter Notebook processor that extracts code cells and metadata.
#[derive(Default)]
pub struct JupyterNotebookProcessor {
    config: IpynbProcessorConfig,
}

impl JupyterNotebookProcessor {
    pub fn new(config: IpynbProcessorConfig) -> Self {
        Self { config }
    }

    fn extract_source(source: &Value) -> String {
        match source {
            Value::String(s) => s.clone(),
            Value::Array(arr) => arr
                .iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join(""),
            _ => String::from("(Unable to extract source)"),
        }
    }

    fn append_outputs(output: &mut String, cell: &Value) {
        let Some(outputs) = cell.get("outputs").and_then(|v| v.as_array()) else {
            return;
        };
        if outputs.is_empty() {
            return;
        }

        output.push_str("Output:\n");
        for out in outputs {
            let output_type = out
                .get("output_type")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            match output_type {
                "stream" => {
                    if let Some(text) = out.get("text") {
                        let text = Self::extract_source(text);
                        output.push_str(&text);
                        if !text.ends_with('\n') {
                            output.push('\n');
                        }
                    }
                }
                "execute_result" | "display_data" => {
                    if let Some(data) = out.get("data")
                        && let Some(text) = data.get("text/plain")
                    {
                        let text = Self::extract_source(text);
                        output.push_str(&text);
                        if !text.ends_with('\n') {
                            output.push('\n');
                        }
                    }
                }
                "error" => {
                    let ename = out.get("ename").and_then(|v| v.as_str()).unwrap_or("Error");
                    let evalue = out.get("evalue").and_then(|v| v.as_str()).unwrap_or("");
                    output.push_str(&format!("{}: {}\n", ename, evalue));
                }
                _ => {}
            }
        }
        output.push('\n');
    }
}

impl FileProcessor for JupyterNotebookProcessor {
    fn process(&self, content: &[u8], _path: &Path) -> Result<String> {
        // Parse notebook JSON
        let notebook: Value =
            serde_json::from_slice(content).context("Failed to parse .ipynb file as JSON")?;

        // Extract cells array
        let cells = notebook
            .get("cells")
            .and_then(|v| v.as_array())
            .context("Notebook has no 'cells' array")?;

        // Count cell types and collect code / markdown cells
        let mut code_cells = Vec::new();
        let mut markdown_cells = Vec::new();
        let mut markdown_count = 0;
        let mut raw_count = 0;

        for cell in cells {
            let cell_type = cell
                .get("cell_type")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");

            match cell_type {
                "code" => code_cells.push(cell),
                "markdown" => {
                    markdown_count += 1;
                    markdown_cells.push(cell);
                }
                "raw" => raw_count += 1,
                _ => {}
            }
        }

        let total_cells = cells.len();

        // Format output
        let mut output = String::new();
        output.push_str("Jupyter Notebook Summary:\n");
        output.push_str(&format!(
            "Total cells: {} ({} code, {} markdown, {} raw)\n\n",
            total_cells,
            code_cells.len(),
            markdown_count,
            raw_count
        ));

        if self.config.include_markdown {
            for (idx, cell) in markdown_cells.iter().enumerate() {
                output.push_str(&format!("Markdown Cell #{}:\n", idx + 1));
                if let Some(source) = cell.get("source") {
                    let text = Self::extract_source(source);
                    output.push_str(&text);
                    if !text.ends_with('\n') {
                        output.push('\n');
                    }
                    output.push('\n');
                }
            }
        }

        if code_cells.is_empty() {
            output.push_str("(No code cells found)\n");
            return Ok(output);
        }

        let max_cells_to_show = self.config.max_code_cells.min(code_cells.len());

        for (idx, cell) in code_cells.iter().take(max_cells_to_show).enumerate() {
            output.push_str(&format!("Code Cell #{}:\n", idx + 1));

            // Extract source code
            if let Some(source) = cell.get("source") {
                let code = Self::extract_source(source);

                output.push_str("```python\n");
                output.push_str(&code);
                if !code.ends_with('\n') {
                    output.push('\n');
                }
                output.push_str("```\n\n");
            }

            if self.config.include_outputs {
                Self::append_outputs(&mut output, cell);
            }
        }

        if code_cells.len() > max_cells_to_show {
            output.push_str(&format!(
                "... [{} more code cells omitted]\n",
                code_cells.len() - max_cells_to_show
            ));
        }

        Ok(output)
    }
}

impl JupyterNotebookProcessor {
    /// Process with fallback to raw text on error.
    pub fn process_with_fallback(&self, content: &[u8], path: &Path) -> Result<String> {
        match self.process(content, path) {
            Ok(result) => Ok(result),
            Err(e) => {
                log::warn!(
                    "Jupyter notebook parsing failed for {:?}: {}. Using raw text fallback.",
                    path,
                    e
                );
                let fallback = DefaultTextProcessor;
                fallback.process(content, path)
            }
        }
    }
}

```

### Core Architecture Module: `crates/code2prompt-core/src/file_processor/jsonl.rs`
```
//! JSON Lines (JSONL) file processor with schema extraction.
//!
//! This processor parses JSONL/NDJSON files and extracts:
//! - Field names from the first JSON object
//! - One sample JSON object
//!
//! This provides sufficient context for LLMs without including thousands of lines.

use super::{DefaultTextProcessor, FileProcessor};
use anyhow::{Context, Result};
use serde_json::Value;
use std::path::Path;

/// JSONL processor that extracts schema and one sample line.
pub struct JsonLinesProcessor;

impl FileProcessor for JsonLinesProcessor {
    fn process(&self, content: &[u8], _path: &Path) -> Result<String> {
        let text = String::from_utf8_lossy(content);
        let mut lines = text.lines();

        // Get first line
        let first_line = match lines.next() {
            Some(line) if !line.trim().is_empty() => line,
            _ => {
                anyhow::bail!("JSONL file is empty or has no valid lines");
            }
        };

        // Parse first line as JSON
        let json_obj: Value = serde_json::from_str(first_line)
            .with_context(|| format!("Failed to parse first line as JSON: {}", first_line))?;

        // Extract field names
        let fields = if let Value::Object(map) = &json_obj {
            map.keys().cloned().collect::<Vec<_>>()
        } else {
            anyhow::bail!("First line is not a JSON object");
        };

        if fields.is_empty() {
            anyhow::bail!("JSON object has no fields");
        }

        // Count remaining lines
        let remaining_lines = lines.filter(|line| !line.trim().is_empty()).count();

        // Format output
        let mut output = String::new();
        output.push_str("JSONL Schema (1 sample line):\n");
        output.push_str(&format!("Fields: {}\n", fields.join(", ")));
        output.push_str(&format!("Sample: {}\n", first_line));

        if remaining_lines > 0 {
            output.push_str(&format!("... [{} more lines omitted]\n", remaining_lines));
        }

        Ok(output)
    }
}

impl JsonLinesProcessor {
    /// Process with fallback to raw text on error.
    pub fn process_with_fallback(&self, content: &[u8], path: &Path) -> Result<String> {
        match self.process(content, path) {
            Ok(result) => Ok(result),
            Err(e) => {
                log::warn!(
                    "JSONL parsing failed for {:?}: {}. Using raw text fallback.",
                    path,
                    e
                );
                let fallback = DefaultTextProcessor;
                fallback.process(content, path)
            }
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #217** (2025-12-22): **.gitignore does not work on Windows**
  *Symptoms*: **1. Bug Description**  code2prompt isn't filtering files and directories specified in the `.gitignore` on Windows.  **2. To Reproduce**  ```bash mkdir test_project cd test_project ```  ```bash echo node_modules/> .gitignore ```  ```bash echo console.log('Hello, World!'); > index.js mkdir node_modules echo { "name": "some-package" } > node_modules/package.json ```  ```bash code2prompt . ```  **3. Expected Behavior** It should not contain node_modules/  **4. Actual Behavior** ```` Project Path: test_project  Source Tree:  ```txt test_project ├── index.js └── node_modules     └── package.json  ```  `index.js`:  ```js console.log('Hello, World!');   ```  `node_modules\package.json`:  ```json { "name": "some-package" }   ``` ```` **5. System Information**  * Windows 11 * code2prompt 4.0.2 * downloaded from releases  **6. Additional Context** This issue seems to be specific to Windows. My hypothesis is that it might be related to how file paths and path separators (`\` on Windows vs. `/` in `.gitignore`) are handled.
  **Post-Mortem & Fix Analysis**:
  > Hello @xiortgav, Can you try again with `code2prompt` v4.2.0 ?

- **Issue #165** (2025-09-23): **The output file cannot contain the project path correctly**
  *Symptoms*:      The project path of the output file is only the previous level path of the target and is not complete, and all file paths below the file are also placed based on this path. Can the full path be output. This is helpful for model recognition
  **Post-Mortem & Fix Analysis**:
  > Hi @muyinjiangxue,  We added the flag `--absolute-paths` that handles it.   However, for some reason it doesn't work anymore with current version. I'll inquire.

- **Issue #155** (2025-10-23): **Null pointer when running code2prompt from CLI with LC_ALL unset**
  *Symptoms*: Installed code2prompt 3.0.2 via homebrew on MacOS X Sequoia 15.4.1 on a M1 Macbook Pro.  My output of locale: ``` LANG="en_UK.UTF-8" LC_COLLATE="C" LC_CTYPE="C" LC_MESSAGES="C" LC_MONETARY="C" LC_NUMERIC="C" LC_TIME="C" LC_ALL= ```  Running code2prompt in any folder gives the following error:  ``` ▹▹▹▹▸ Done! thread 'main' panicked at crates/code2prompt/src/main.rs:182:89: called `Result::unwrap()` on an `Err` value: Error { kind: SystemInvalidReturn { function_name: "newlocale", message: "newlocale unexpectedly returned a null pointer." } } stack backtrace:    0:        0x102db5d58 - <std::sys::backtrace::BacktraceLock::print::DisplayBacktrace as core::fmt::Display>::fmt::he95167bc0db69172    1:        0x102c2920c - core::fmt::write::h7a9b1a2c5a4d720d    2:        0x102d9d068 - std::io::Write::write_fmt::h6ba1180d709be9ef    3:        0x102db5c18 - std::sys::backtrace::BacktraceLock::print::he986caf53af0c7c0    4:        0x102dbb17c - std::panicking::default_hook::{{closure}}::h91abe66414d5ff97    5:        0x102dbb08c - std::panicking::default_hook::hd88a7d3ab5420733    6:        0x102dbb700 - std::panicking::rust_panic_with_hook::h0c4570804070c568    7:        0x102db615c - std::panicking::begin_panic_handler::{{closure}}::h137406384c01ca5e    8:        0x102db5fa0 - std::sys::backtrace::__rust_end_short_backtrace::hbbf6c8bb05b960c8    9:        0x102dbb218 - _rust_begin_unwind   10:        0x102e4659c - core::panicking::panic_fmt::h8df0ae8acbd1e44d   11:        0x102e464e
  **Post-Mortem & Fix Analysis**:
  > Hi @superandoni,  Does this issue still arise with the latest version ?  I was unable to reproduce it with my Linux   ```txt olivier@RocketPC:~/projet/code2prompt/crates$ LANG="en_UK.UTF-8" \ LC_COLLATE="C" \ LC_CTYPE="C" \ LC_MESSAGES="C" \ LC_MONETARY="C" \ LC_NUMERIC="C" \ LC_TIME="C" \ LC_ALL= \ code2prompt . ▹▹▹▹▸ Done!                                                                                                                                                                             [i] Token count: 98564, Model info: ChatGPT models, text-embedding-ada-002 [✓] Copied to clipboard successfully. ```
  > Yes, still failing on version 4.0.2, despite my current `locale` command output now being: ``` LANG="en_UK.UTF-8" LC_COLLATE="C" LC_CTYPE="C" LC_MESSAGES="C" LC_MONETARY="C" LC_NUMERIC="C" LC_TIME="C" LC_ALL="C" ```  The workaround of running `LC_ALL="C" code2prompt .` still works fine.  Current error trace:  ``` ❯ RUST_BACKTRACE=full code2prompt . ▹▹▹▹▸ Done! thread 'main' panicked at crates/code2prompt/src/main.rs:162:89: called `Result::unwrap()` on an `Err` value: Error { kind: SystemInvalidReturn { function_name: "newlocale", message: "newlocale unexpectedly returned a null pointer." } } stack backtrace:    0:        0x10309c32c - <std::sys::backtrace::BacktraceLock::print::DisplayBacktrace as core::fmt::Display>::fmt::h9e223a7170c87c9b    1:        0x102ee9ed0 - core::fmt::write::hf208100295273523    2:        0x103071e94 - std::io::Write::write_fmt::h5f2b208c86ba2551    3:        0x10309c1ec - std::sys::backtrace::BacktraceLock::print::h1c8ca659c64c79a6    4:        0x103084e58 
  > Hello @superandoni,  On the code2prompt version `4.1.0` (not yet released) it appears that it works on Mac Darwin 25.0.0  ```txt ➜  code2prompt git:(main) LANG="en_UK.UTF-8" \ LC_COLLATE="C" \ LC_CTYPE="C" \ LC_MESSAGES="C" \ LC_MONETARY="C" \ LC_NUMERIC="C" \ LC_TIME="C" \ LC_ALL= \ code2prompt . [i] Using config from: /Users/olivier.dancona/Projects/code2prompt/.c2pconfig ▸▹▹▹▹ Proceeding…                                                                                     [i] Token count: 67506, Model info: ChatGPT models, text-embedding-ada-002 [✓] Copied to clipboard successfully. ▹▹▹▹▸ Done! ``` Could you tell me if it works for you ?  The command to install the latest version on git is `cargo install --git https://github.com/mufeedvh/code2prompt`  

- **Issue #108** (2025-03-31): **Cannot be compiled on macOS ARM.**
  *Symptoms*: Hello, I like your tool very much and have been using it for a long time.   I have been using the version 2.0.0 in the past. But after seeing the new version, I wanted to update it. As a result, a compilation error occurred on my macOS - arm. I directly use `cargo install code2prompt` and get an error as follows:  <img width="1425" alt="Image" src="https://github.com/user-attachments/assets/90c877f1-c6bc-4b48-916a-290e74c1cbfa" />  I also tried compiling from source code and got the same error as above. However, it can be compiled correctly on my x64 Ubuntu.  I remember that the last compilation error was a clipboard error, but this time the error seems to have not been resolved.  Hope it can be resolved super soon! 😃
  **Post-Mortem & Fix Analysis**:
  > Same issue here
  > Hello @littlepenguin66 @bekirisgor ,  Try `cargo install --git https://github.com/mufeedvh/code2prompt`  Someone was able to install that way.  Can you try and tell me ? I'll release a new version asap.  My bad, I merged a PR the other day without checking cross compatibility, likely an import error for windows compatibility see #105  
  > @bekirisgor @littlepenguin66   The problem is fixed in the main and pushed to crates.io  You can now `cargo install code2prompt` safely ;-)  Thank you for letting me know this fast ! 

- **Issue #102** (2025-03-25): **glob pattern tool curly brackets**
  *Symptoms*: ` code2prompt code2prompt-core -i "src/{lib.rs,configuration.rs,git.rs}"`  First item of { } is not considered

- **Issue #83** (2025-02-24): **Source Tree only outputs the root folder when using  --exclude-from-tree, even though the full tree of files is included as desired**
  *Symptoms*: Beginning of my file is:  Project Path: server  Source Tree:  ``` server  ```  `server/customers/models.py`:  ```py from typing import TYPE_CHECKING, Optional ... ```  This was after building from main branch earlier today 2/23/2025.  When I remove --exclude-from-tree, then the full file tree does show up, but of course it shows up with all of my excluded files as well, which isn't desired.
  **Post-Mortem & Fix Analysis**:
  > Hey @evanheckert ,  Thanks for reporting the bug, I confirm the bug was introduced in #73.   I'll fix it as soon as possible

- **Issue #79** (2025-02-23): **Code2prompt should have automated release for main architecture**
  *Symptoms*: closes #51  This github action will automatically build the binaries for architectures:  - x86_64-unknown-linux-gnu - x86_64-apple-darwin - aarch64-apple-darwin - x86_64-pc-windows-gnu  When a tag is pushed.  Next steps: - Auto changelog - Auto release on cargo crates  

- **Issue #50** (2025-05-20): **Nix Install Instructions Are Broken**
  *Symptoms*: I tried the following on my NixOS machine:  ``` $ nix profile install nixpkgs#code2prompt  error: flake 'flake:nixpkgs' does not provide attribute 'packages.x86_64-linux.code2prompt', 'legacyPackages.x86_64-linux.code2prompt' or 'code2prompt' ```  Attempting on `master` branch, where latest commit is:  https://github.com/mufeedvh/code2prompt/commit/a7d98da72c52b8c4aa4bcae15b1b36e58f1c39c0  ---  Installing from source works just fine :)
  **Post-Mortem & Fix Analysis**:
  > Hello @GregHilston,  I checked the `nixpkgs` repo and it seems that there are [three PRs](https://github.com/NixOS/nixpkgs/pulls?q=is%3Apr+is%3Aopen+code2prompt) that want to update `code2prompt` nevertheless none of them update it to the latest version.  I'm not sure how to update it into `nixpkgs` but it looks that the available version is already 2.0.0.  Can you tell me if it works now for you ?
  > I no longer have access to this system unfortunately. I have also switched to using a few different tools due to this issue, but I appreciate your willingess to help. We can close this ticket, and i can re-open it if I run into it again

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

### Incident Patch 1: `b998f458` (2026-09-06)
**Commit Message**: wrapper bug fixed

**File**: `.opencode/plans/2026-06-09-documentation-enhancement.md` (removed, +0/-986)
```diff
@@ -1,986 +0,0 @@
-# Documentation Enhancement Implementation Plan
-
-> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
-
-**Goal:** Complete Code2Prompt's Diátaxis documentation framework by enhancing public API docstrings and implementing auto-generated Reference section for the website.
-
-**Architecture:** Two-phase hybrid approach: (1) Minimal enhancement of critical public API docstrings following non-bloat principles, (2) Rust-doc-to-MDX pipeline leveraging cargo doc JSON output for automated website reference generation.
-
-**Tech Stack:** Rust docstrings, cargo doc, Node.js/TypeScript MDX transformer, Astro website integration
-
----
-
-## File Structure Overview
-
-**Phase 1 - Docstring Enhancement:**
-- Modify: `crates/code2prompt-core/src/configuration.rs` - Core config APIs
-- Modify: `crates/code2prompt-core/src/session.rs` - Session management 
-- Modify: `crates/code2prompt-core/src/template.rs` - Template system
-- Modify: `crates/code2prompt-core/src/lib.rs` - Crate overview
-- Modify: `crates/code2prompt-core/src/filter.rs` - File filtering
-- Modify: `crates/code2prompt-core/src/git.rs` - Git integration
-- Modify: `crates/code2prompt-core/src/file_processor/mod.rs` - File processing
-
-**Phase 2 - Auto-Generation Pipeline:**
-- Create: `website/tools/doc-to-mdx/package.json` - Tool dependencies
-- Create: `website/tools/doc-to-mdx/src/main.ts` - Core transformer
-- Create: `website/tools/doc-to-mdx/src/parser.ts` - Rustdoc JSON parser
-- Create: `website/tools/doc-to-mdx/src/generator.ts` - MDX generator  
-- Create: `website/tools/doc-to-mdx/src/types.ts` - Type definitions
-- Create: `website/tools/doc-to-mdx/config.json` - Configuration
-- Modify: `website/package.json` - Integration script
-- Create: `website/src/content/docs/docs/references/api/` - Output directory
-
----
-
-### Task 1: Core Configuration API Documentation
-
-**Files:**
-- Modify: `crates/code2prompt-core/src/configuration.rs:1-50`
-- Test: Verify with `cargo doc --no-deps`
-
-- [ ] **Step 1: Enhance Code2PromptConfig struct documentation**
-
-```rust
-/// Configuration object defining preferences and filters for code prompt generation.
-/// 
-/// This stateless object can be cloned freely and shared across multiple sessions.
-/// Use `Code2PromptConfigBuilder` for construction with validation.
-/// 
-/// # Example
-/// ```
-/// use code2prompt_core::configuration::Code2PromptConfig;
-/// 
-/// let config = Code2PromptConfig::builder()
-///     .include_hidden(true)
-///     .build()?;
-/// ```
-#[derive(Debug, Clone, Default, Builder)]
-pub struct Code2PromptConfig {
-```
-
-- [ ] **Step 2: Enhance Code2PromptConfigBuilder documentation**
-
-```rust
-/// Builder for `Code2PromptConfig` with validation and defaults.
-/// 
-/// Provides a fluent interface for configuration construction. All setters
-/// return `Self` for method chaining.
-/// 
-/// # Errors
-/// `build()` returns `ConfigError` if validation fails.
-pub struct Code2PromptConfigBuilder {
-```
-
-- [ ] **Step 3: Document key builder methods**
-
-```rust
-/// Include hidden files and directories in processing.
-/// 
-/// Default: `false`
-pub fn include_hidden(mut self, include: bool) -> Self {
-
-/// Set custom template content for prompt generation.
-/// 
-/// Overrides default template. Template must be valid Handlebars format.
-/// 
-/// # Errors
-/// Returns error during `build()` if template syntax is invalid.
-pub fn template(mut self, template: String) -> Self {
-```
-
-- [ ] **Step 4: Test documentation generation**
-
-Run: `cargo doc --no-deps --open`
-Expected: Clean docs.rs output with proper examples
-
-- [ ] **Step 5: Commit configuration docs**
-
-```bash
-git add crates/code2prompt-core/src/configuration.rs
-git commit -m "docs: enhance Code2PromptConfig API documentation"
-```
-
-### Ta
```

**File**: `crates/code2prompt-core/src/default_template_xml.hbs` (modified, +12/-14)
```diff
@@ -1,23 +1,21 @@
 <directory>{{absolute_code_path}}</directory>
 
 <source-tree>
-  {{source_tree}}
+{{source_tree}}
 </source-tree>
 
 <files>
-  {{#each files}}
-    {{#if code}}
-      <file path="{{path}}">
-        {{#unless ../no_codeblock}}```{{extension}}
-        {{/unless}}{{code}}{{#unless ../no_codeblock}}
-        ```{{/unless}}
-      </file>
-    {{/if}}
-  {{/each}}
+{{#each files}}
+{{#if code}}
+  <file path="{{path}}">
+{{code}}
+  </file>
+{{/if}}
+{{/each}}
 </files>
 
 {{#if git_diff}}
-  <git-diff>
-    {{git_diff}}
-  </git-diff>
-{{/if}}
\ No newline at end of file
+<git-diff>
+{{git_diff}}
+</git-diff>
+{{/if}}
```

**File**: `crates/code2prompt-core/src/file_processor/ipynb.rs` (modified, +6/-14)
```diff
@@ -14,20 +14,12 @@ use serde_json::Value;
 use std::path::Path;
 
 /// Jupyter Notebook processor that extracts code cells and metadata.
+#[derive(Default)]
 pub struct JupyterNotebookProcessor {
     config: IpynbProcessorConfig,
 }
 
-impl Default for JupyterNotebookProcessor {
-    fn default() -> Self {
-        Self {
-            config: IpynbProcessorConfig::default(),
-        }
-    }
-}
-
 impl JupyterNotebookProcessor {
-    /// Create a processor with the given configuration.
     pub fn new(config: IpynbProcessorConfig) -> Self {
         Self { config }
     }
@@ -54,7 +46,10 @@ impl JupyterNotebookProcessor {
 
         output.push_str("Output:\n");
         for out in outputs {
-            let output_type = out.get("output_type").and_then(|v| v.as_str()).unwrap_or("");
+            let output_type = out
+                .get("output_type")
+                .and_then(|v| v.as_str())
+                .unwrap_or("");
             match output_type {
                 "stream" => {
                     if let Some(text) = out.get("text") {
@@ -77,10 +72,7 @@ impl JupyterNotebookProcessor {
                     }
                 }
                 "error" => {
-                    let ename = out
-                        .get("ename")
-                        .and_then(|v| v.as_str())
-                        .unwrap_or("Error");
+                    let ename = out.get("ename").and_then(|v| v.as_str()).unwrap_or("Error");
                     let evalue = out.get("evalue").and_then(|v| v.as_str()).unwrap_or("");
                     output.push_str(&format!("{}: {}\n", ename, evalue));
                 }
```

**File**: `crates/code2prompt-core/tests/template_test.rs` (modified, +36/-11)
```diff
@@ -51,34 +51,59 @@ mod tests {
     }
 
     #[test]
-    fn test_xml_template_contains_backtick_fences() {
+    fn test_xml_template_has_no_markdown_fences_and_preserves_indentation() {
         use code2prompt_core::template::{handlebars_setup, render_template};
         let template_str = include_str!("../src/default_template_xml.hbs");
         let handlebars = handlebars_setup(template_str, "xml").unwrap();
         let data = serde_json::json!({
             "absolute_code_path": "/some/path",
-            "source_tree": "tree",
-            "files": [{"path": "main.rs", "extension": "rs", "code": "fn main() {}"}],
+            "source_tree": "src/\n  main.rs",
+            "files": [{
+                "path": "main.rs",
+                "extension": "rs",
+                "code": "fn main() {\n    println!(\"hello\");\n}"
+            }],
             "no_codeblock": false
         });
         let rendered = render_template(&handlebars, "xml", &data).unwrap();
-        assert!(rendered.contains("```rs"));
-        assert!(rendered.contains("fn main() {}"));
+
+        assert_eq!(
+            rendered,
+            r#"<directory>/some/path</directory>
+
+<source-tree>
+src/
+  main.rs
+</source-tree>
+
+<files>
+  <file path="main.rs">
+fn main() {
+    println!("hello");
+}
+  </file>
+</files>"#
+        );
+        assert!(!rendered.contains("```"));
     }
 
     #[test]
-    fn test_xml_template_no_fences_when_no_codeblock() {
+    fn test_xml_template_ignores_markdown_codeblock_setting() {
         use code2prompt_core::template::{handlebars_setup, render_template};
         let template_str = include_str!("../src/default_template_xml.hbs");
         let handlebars = handlebars_setup(template_str, "xml").unwrap();
-        let data = serde_json::json!({
+        let mut data = serde_json::json!({
             "absolute_code_path": "/some/path",
             "source_tree": "tree",
             "files": [{"path": "main.rs", "extension": "rs", "code": "fn main() {}"}],
-            "no_codeblock": true
+            "no_codeblock": false
         });
-        let rendered = render_template(&handlebars, "xml", &data).unwrap();
-        assert!(!rendered.contains("```"));
-        assert!(rendered.contains("fn main() {}"));
+        let with_codeblocks_enabled = render_template(&handlebars, "xml", &data).unwrap();
+
+        data["no_codeblock"] = serde_json::Value::Bool(true);
+        let with_codeblocks_disabled = render_template(&handlebars, "xml", &data).unwrap();
+
+        assert_eq!(with_codeblocks_enabled, with_codeblocks_disabled);
+        assert!(!with_codeblocks_enabled.contains("```"));
     }
 }
```

**File**: `crates/code2prompt/src/lib.rs` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+//! Reusable application components for the code2prompt CLI and TUI.
+
+pub mod model;
+pub mod utils;
+mod view;
```

---

### Incident Patch 2: `67fce8b8` (2026-09-06)
**Commit Message**: fix(ci): pin setup-uv to an immutable release

The v9 major-version alias is not published, so GitHub Actions cannot resolve it. Pin setup-uv v9.0.0 by its verified commit SHA.

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ jobs:
     steps:
     - uses: actions/checkout@v6
     - name: Install uv and Python
-      uses: astral-sh/setup-uv@v9
+      uses: astral-sh/setup-uv@c771a70e6277c0a99b617c7a806ffedaca235ff9 # v9.0.0
       with:
         version: "0.12.10"
         python-version: ${{ matrix.python-version }}
```

---

### Incident Patch 3: `12d19cc4` (2026-09-05)
**Commit Message**: Merge pull request #335 from cnYui/docs/fix-stale-cli-flags-in-how-to-examples

docs: fix three stale CLI flags in the how-to examples (--line-number, --tokens, --exclude-from-tree)

**File**: `README_ES.md` (modified, +4/-4)
```diff
@@ -116,19 +116,19 @@ code2prompt path/to/codebase --exclude="*.txt,*.md"
 Excluir archivos/carpetas del árbol de origen basándose en patrones de exclusión:
 
 ```sh
-code2prompt path/to/codebase --exclude="*.npy,*.wav" --exclude-from-tree
+code2prompt path/to/codebase --exclude="*.npy,*.wav"
 ```
 
 Mostrar el conteo de tokens del prompt generado:
 
 ```sh
-code2prompt path/to/codebase --tokens
+code2prompt path/to/codebase --token-format=format
 ```
 
 Especificar un tokenizador para el conteo de tokens:
 
 ```sh
-code2prompt path/to/codebase --tokens --encoding=p50k
+code2prompt path/to/codebase --encoding=p50k
 ```
 
 Tokenizadores soportados: `cl100k`, `p50k`, `p50k_edit`, `r50k_bas`.
@@ -174,7 +174,7 @@ code2prompt path/to/codebase --git-diff-branch 'main, development' --git-log-bra
 Añadir números de línea a los bloques de código fuente:
 
 ```sh
-code2prompt path/to/codebase --line-number
+code2prompt path/to/codebase --line-numbers
 ```
 
 Desactivar el envoltorio de código dentro de bloques de código markdown:
```

**File**: `website/src/content/docs/de/docs/how_to/cli.mdx` (modified, +4/-4)
```diff
@@ -56,19 +56,19 @@ code2prompt pfad/zur/codebase --exclude="*.txt,*.md"
 Dateien/Ordner im Quellbaum anhand von Ausschlussmustern entfernen:
 
 ```sh
-code2prompt pfad/zur/codebase --exclude="*.npy,*.wav" --exclude-from-tree
+code2prompt pfad/zur/codebase --exclude="*.npy,*.wav"
 ```
 
 Token‑Anzahl des generierten Prompts anzeigen:
 
 ```sh
-code2prompt pfad/zur/codebase --tokens
+code2prompt pfad/zur/codebase --token-format=format
 ```
 
 Tokenizer für die Token‑Zählung angeben:
 
 ```sh
-code2prompt pfad/zur/codebase --tokens --encoding=p50k
+code2prompt pfad/zur/codebase --encoding=p50k
 ```
 
 Unterstützte Tokenizer: `cl100k`, `p50k`, `p50k_edit`, `r50k_bas`.
@@ -115,7 +115,7 @@ code2prompt pfad/zur/codebase --git-diff-branch 'main, development' --git-log-br
 Zeilennummern zu Quellcode‑Blöcken hinzufügen:
 
 ```sh
-code2prompt pfad/zur/codebase --line-number
+code2prompt pfad/zur/codebase --line-numbers
 ```
 
 Code‑Block‑Umhüllung in Markdown‑Blöcken deaktivieren:
```

**File**: `website/src/content/docs/de/docs/how_to/filter_files.md` (modified, +4/-4)
```diff
@@ -33,19 +33,19 @@ code2prompt path/to/codebase --exclude="*.txt,*.md"
 Schließen Sie Dateien/Ordner aus dem Quellbaum basierend auf Ausschlussmustern aus:
 
 ```sh
-code2prompt path/to/codebase --exclude="*.npy,*.wav" --exclude-from-tree
+code2prompt path/to/codebase --exclude="*.npy,*.wav"
 ```
 
 Zeigen Sie die Tokenanzahl des generierten Prompts an:
 
 ```sh
-code2prompt path/to/codebase --tokens
+code2prompt path/to/codebase --token-format=format
 ```
 
 Geben Sie einen Tokenizer für die Tokenanzahl an:
 
 ```sh
-code2prompt path/to/codebase --tokens --encoding=p50k
+code2prompt path/to/codebase --encoding=p50k
 ```
 
 Unterstützte Tokenizer: `cl100k`, `p50k`, `p50k_edit`, `r50k_bas`.
@@ -91,7 +91,7 @@ code2prompt path/to/codebase --git-diff-branch 'main, development' --git-log-bra
 Fügen Sie Zeilennummern zu Quellcodeblöcken hinzu:
 
 ```sh
-code2prompt path/to/codebase --line-number
+code2prompt path/to/codebase --line-numbers
 ```
 
 Deaktivieren Sie das Umbrechen von Code innerhalb von Markdown-Codeblöcken:
```

**File**: `website/src/content/docs/docs/how_to/cli.mdx` (modified, +6/-4)
```diff
@@ -57,19 +57,21 @@ code2prompt path/to/codebase --exclude="*.txt,*.md"
 Exclude files/folders from the source tree based on exclude patterns:
 
 ```sh
-code2prompt path/to/codebase --exclude="*.npy,*.wav" --exclude-from-tree
+code2prompt path/to/codebase --exclude="*.npy,*.wav"
 ```
 
+Filtered-out paths are pruned from the source tree by default. Use `--full-directory-tree` to print the whole tree regardless of the include/exclude patterns.
+
 Display the token count of the generated prompt:
 
 ```sh
-code2prompt path/to/codebase --tokens
+code2prompt path/to/codebase --token-format=format
 ```
 
 Specify a tokenizer for token count:
 
 ```sh
-code2prompt path/to/codebase --tokens --encoding=p50k
+code2prompt path/to/codebase --encoding=p50k
 ```
 
 Supported tokenizers: `cl100k`, `p50k`, `p50k_edit`, `r50k_bas`.
@@ -116,7 +118,7 @@ code2prompt path/to/codebase --git-diff-branch 'main, development' --git-log-bra
 Add line numbers to source code blocks:
 
 ```sh
-code2prompt path/to/codebase --line-number
+code2prompt path/to/codebase --line-numbers
 ```
 
 Disable wrapping code inside markdown code blocks:
```

**File**: `website/src/content/docs/es/docs/how_to/cli.mdx` (modified, +4/-4)
```diff
@@ -57,19 +57,19 @@ code2prompt ruta/a/código-base --exclude="*.txt,*.md"
 Excluir archivos/carpetas del árbol de origen según patrones de exclusión:
 
 ```sh
-code2prompt ruta/a/código-base --exclude="*.npy,*.wav" --exclude-from-tree
+code2prompt ruta/a/código-base --exclude="*.npy,*.wav"
 ```
 
 Mostrar el recuento de tokens del prompt generado:
 
 ```sh
-code2prompt ruta/a/código-base --tokens
+code2prompt ruta/a/código-base --token-format=format
 ```
 
 Especificar un tokenizador para el recuento de tokens:
 
 ```sh
-code2prompt ruta/a/código-base --tokens --encoding=p50k
+code2prompt ruta/a/código-base --encoding=p50k
 ```
 
 Tokenizadores compatibles: `cl100k`, `p50k`, `p50k_edit`, `r50k_bas`.
@@ -116,7 +116,7 @@ code2prompt ruta/a/código-base --git-diff-branch 'main, development' --git-log-
 Agregar números de línea a los bloques de código fuente:
 
 ```sh
-code2prompt ruta/a/código-base --line-number
+code2prompt ruta/a/código-base --line-numbers
 ```
 
 Desactivar el encapsulado de código dentro de bloques de código markdown:
```

---

### Incident Patch 4: `afb472e4` (2026-09-05)
**Commit Message**: docs: fix `--line-number` -> `--line-numbers` in how-to examples

clap derives the long name from the field, so `line_numbers` in
crates/code2prompt/src/args.rs is exposed as `-l` / `--line-numbers`.
The documented `--line-number` is rejected with
"error: unexpected argument '--line-number' found".

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

**File**: `README_ES.md` (modified, +1/-1)
```diff
@@ -174,7 +174,7 @@ code2prompt path/to/codebase --git-diff-branch 'main, development' --git-log-bra
 Añadir números de línea a los bloques de código fuente:
 
 ```sh
-code2prompt path/to/codebase --line-number
+code2prompt path/to/codebase --line-numbers
 ```
 
 Desactivar el envoltorio de código dentro de bloques de código markdown:
```

**File**: `website/src/content/docs/de/docs/how_to/cli.mdx` (modified, +1/-1)
```diff
@@ -115,7 +115,7 @@ code2prompt pfad/zur/codebase --git-diff-branch 'main, development' --git-log-br
 Zeilennummern zu Quellcode‑Blöcken hinzufügen:
 
 ```sh
-code2prompt pfad/zur/codebase --line-number
+code2prompt pfad/zur/codebase --line-numbers
 ```
 
 Code‑Block‑Umhüllung in Markdown‑Blöcken deaktivieren:
```

**File**: `website/src/content/docs/de/docs/how_to/filter_files.md` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ code2prompt path/to/codebase --git-diff-branch 'main, development' --git-log-bra
 Fügen Sie Zeilennummern zu Quellcodeblöcken hinzu:
 
 ```sh
-code2prompt path/to/codebase --line-number
+code2prompt path/to/codebase --line-numbers
 ```
 
 Deaktivieren Sie das Umbrechen von Code innerhalb von Markdown-Codeblöcken:
```

**File**: `website/src/content/docs/docs/how_to/cli.mdx` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ code2prompt path/to/codebase --git-diff-branch 'main, development' --git-log-bra
 Add line numbers to source code blocks:
 
 ```sh
-code2prompt path/to/codebase --line-number
+code2prompt path/to/codebase --line-numbers
 ```
 
 Disable wrapping code inside markdown code blocks:
```

**File**: `website/src/content/docs/es/docs/how_to/cli.mdx` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ code2prompt ruta/a/código-base --git-diff-branch 'main, development' --git-log-
 Agregar números de línea a los bloques de código fuente:
 
 ```sh
-code2prompt ruta/a/código-base --line-number
+code2prompt ruta/a/código-base --line-numbers
 ```
 
 Desactivar el encapsulado de código dentro de bloques de código markdown:
```

---

### Incident Patch 5: `c4ba219b` (2026-09-04)
**Commit Message**: Merge pull request #333 from OctoBored/fix/star-history-chart

Fix the broken star history chart in the README

**File**: `README.md` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ cargo install --path crates/code2prompt
 
 ## ⭐ Star Gazing
 
-[![Star History Chart](https://api.star-history.com/svg?repos=mufeedvh/code2prompt&type=Date)](https://star-history.com/#mufeedvh/code2prompt&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=mufeedvh/code2prompt&type=Date)](https://star-history.dera.page/#mufeedvh/code2prompt&Date)
 
 ## 📜 License
 
```

---

### Incident Patch 6: `ec2e6612` (2026-08-15)
**Commit Message**: docs: fix broken star history chart

The star history chart in the README is currently broken and no longer renders. Update the chart to use a working data source so the repository's star history is visible again.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ cargo install --path crates/code2prompt
 
 ## ⭐ Star Gazing
 
-[![Star History Chart](https://api.star-history.com/svg?repos=mufeedvh/code2prompt&type=Date)](https://star-history.com/#mufeedvh/code2prompt&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=mufeedvh/code2prompt&type=Date)](https://star-history.dera.page/#mufeedvh/code2prompt&Date)
 
 ## 📜 License
 
```

---

### Incident Patch 7: `066e9671` (2026-07-23)
**Commit Message**: fix(core): prune source_tree to changed files under --git-diff-branch

When --git-diff-branch is set, the rendered source_tree still showed the
entire repository, wasting tokens on files that weren't part of the diff.
This mirrors how --include already prunes both the tree and file content,
but the branch-diff path had no equivalent filtering for either.

Add get_git_diff_file_paths() to compute the set of paths touched by the
tree-to-tree diff between the two branches, and thread it through
Code2PromptConfig.diff_files so discover_files() can intersect it with the
existing include/exclude match, pruning both source_tree and file content
down to just the changed files. Unaffected when --git-diff-branch is absent.

Fixes #176

**File**: `crates/code2prompt-core/src/configuration.rs` (modified, +8/-1)
```diff
@@ -7,7 +7,7 @@ use crate::tokenizer::TokenizerType;
 use crate::{sort::FileSortMethod, tokenizer::TokenFormat};
 use derive_builder::Builder;
 use serde::{Deserialize, Serialize};
-use std::collections::HashMap;
+use std::collections::{HashMap, HashSet};
 use std::path::PathBuf;
 
 /// Configuration object defining preferences and filters for code prompt generation.
@@ -97,6 +97,13 @@ pub struct Code2PromptConfig {
     /// If set, contains two branch names for which code2prompt will generate a git diff.
     pub diff_branches: Option<(String, String)>,
 
+    /// Populated internally from `diff_branches` before traversal: the set of
+    /// relative file paths that changed between the two branches. When
+    /// present, `discover_files` prunes both the source tree and the
+    /// collected file content down to just these paths, mirroring how
+    /// `include_patterns` filters both. Not user-configurable directly.
+    pub diff_files: Option<HashSet<PathBuf>>,
+
     /// If set, contains two branch names for which code2prompt will retrieve the git log.
     pub log_branches: Option<(String, String)>,
 
```

**File**: `crates/code2prompt-core/src/git.rs` (modified, +64/-1)
```diff
@@ -8,7 +8,8 @@
 use anyhow::{Context, Result};
 use git2::{DiffOptions, Repository};
 use log::info;
-use std::path::Path;
+use std::collections::HashSet;
+use std::path::{Path, PathBuf};
 
 /// Extract git diff for staged changes in repository.
 /// 
@@ -135,6 +136,68 @@ pub fn get_git_diff_between_branches(
     Ok(String::from_utf8_lossy(&diff_text).into_owned())
 }
 
+/// Computes the set of relative file paths that changed between two branches.
+///
+/// This performs the same tree-to-tree diff as [`get_git_diff_between_branches`],
+/// but instead of rendering a textual patch it collects the paths touched by
+/// each delta (both sides, so a rename contributes its old and new path).
+/// This set is used to prune the source tree and file content down to only
+/// the files that actually changed when `--git-diff-branch` is active.
+///
+/// # Arguments
+///
+/// * `repo_path` - A reference to the path of the git repository
+/// * `branch1` - The name of the first branch
+/// * `branch2` - The name of the second branch
+///
+/// # Returns
+///
+/// * `Result<HashSet<PathBuf>>` - The relative paths that changed between the two branches
+pub fn get_git_diff_file_paths(
+    repo_path: &Path,
+    branch1: &str,
+    branch2: &str,
+) -> Result<HashSet<PathBuf>> {
+    info!("Opening repository at path: {:?}", repo_path);
+    let repo = Repository::open(repo_path).context("Failed to open repository")?;
+
+    for branch in [branch1, branch2].iter() {
+        if !branch_exists(&repo, branch) {
+            return Err(anyhow::anyhow!("Branch {} doesn't exist!", branch));
+        }
+    }
+
+    let branch1_commit = repo.revparse_single(branch1)?.peel_to_commit()?;
+    let branch2_commit = repo.revparse_single(branch2)?.peel_to_commit()?;
+
+    let branch1_tree = branch1_commit.tree()?;
+    let branch2_tree = branch2_commit.tree()?;
+
+    let diff = repo
+        .diff_tree_to_tree(
+            Some(&branch1_tree),
+            Some(&branch2_tree),
+            Some(DiffOptions::new().ignore_whitespace(true)),
+        )
+        .context("Failed to generate diff between branches")?;
+
+    let mut paths = HashSet::new();
+    for delta in diff.deltas() {
+        if let Some(path) = delta.old_file().path() {
+            paths.insert(path.to_path_buf());
+        }
+        if let Some(path) = delta.new_file().path() {
+            paths.insert(path.to_path_buf());
+        }
+    }
+
+    info!(
+        "Collected {} changed file path(s) between branches",
+        paths.len()
+    );
+    Ok(paths)
+}
+
 /// Retrieves the git log between two branches for the repository at the provided path
 ///
 /// # Arguments
```

**File**: `crates/code2prompt-core/src/path.rs` (modified, +9/-1)
```diff
@@ -120,12 +120,20 @@ fn discover_files(
         let path = entry.path();
         if let Ok(relative_path) = path.strip_prefix(&canonical_root_path) {
             // Use SelectionEngine if available, otherwise fall back to pattern matching
-            let entry_match = if let Some(engine) = selection_engine.as_mut() {
+            let mut entry_match = if let Some(engine) = selection_engine.as_mut() {
                 engine.is_selected(relative_path)
             } else {
                 should_include_file(relative_path, &include_globset, &exclude_globset)
             };
 
+            // When `--git-diff-branch` is active, further restrict matches to
+            // only the files that changed between the two branches. This
+            // mirrors how include/exclude patterns prune both the tree and
+            // the file content list.
+            if let Some(diff_files) = &config.diff_files {
+                entry_match = entry_match && diff_files.contains(relative_path);
+            }
+
             // Directory Tree
             let include_in_tree = config.full_directory_tree || entry_match;
 
```

**File**: `crates/code2prompt-core/src/session.rs` (modified, +19/-1)
```diff
@@ -10,7 +10,9 @@ use std::sync::Arc;
 use crate::analysis::CodebaseAnalysis;
 use crate::configuration::Code2PromptConfig;
 use crate::entity_map::FileCodeMap;
-use crate::git::{get_git_diff, get_git_diff_between_branches, get_git_log};
+use crate::git::{
+    get_git_diff, get_git_diff_between_branches, get_git_diff_file_paths, get_git_log,
+};
 use crate::path::{FileEntry, display_name, traverse_directory, wrap_code_block};
 use crate::selection::SelectionEngine;
 use crate::template::{OutputFormat, handlebars_setup, render_template};
@@ -257,6 +259,22 @@ impl Code2PromptSession {
 
     /// Loads the codebase data (source tree and file list) into the session.
     pub fn load_codebase(&mut self) -> Result<()> {
+        // When comparing two branches, restrict both the source tree and the
+        // file content to only the files that actually changed, mirroring
+        // how `--include` filters both the tree and content. If the diff
+        // can't be computed (e.g. a branch doesn't exist), fall back to the
+        // unfiltered codebase; `load_git_diff_between_branches` will surface
+        // the underlying error to the user.
+        if let Some((branch1, branch2)) = self.config.diff_branches.clone() {
+            match get_git_diff_file_paths(&self.config.path, &branch1, &branch2) {
+                Ok(diff_files) => self.config.diff_files = Some(diff_files),
+                Err(e) => log::warn!(
+                    "Could not compute changed files between '{branch1}' and '{branch2}', \
+                     showing unfiltered codebase: {e}"
+                ),
+            }
+        }
+
         let (tree, files) = traverse_directory(&self.config, Some(&mut self.selection_engine))
             .with_context(|| "Failed to traverse directory")?;
 
```

**File**: `crates/code2prompt-core/tests/session_integration_test.rs` (modified, +99/-0)
```diff
@@ -3,6 +3,7 @@
 use code2prompt_core::configuration::Code2PromptConfig;
 use code2prompt_core::session::Code2PromptSession;
 use std::fs;
+use std::path::Path;
 use tempfile::TempDir;
 
 #[cfg(test)]
@@ -178,4 +179,102 @@ mod tests {
         assert_eq!(selected_files.len(), 1);
         assert_eq!(selected_files[0], main_rs_relative);
     }
+
+    /// Regression test for https://github.com/mufeedvh/code2prompt/issues/176
+    ///
+    /// With `--git-diff-branch`, the source tree (and file content) must be
+    /// pruned down to only the files that actually changed between the two
+    /// branches, the same way `--include` filters both the tree and content.
+    #[test]
+    fn test_git_diff_branch_prunes_source_tree_to_changed_files() {
+        use git2::{Repository, RepositoryInitOptions, Signature};
+
+        let temp_dir = TempDir::new().unwrap();
+        let repo_path = temp_dir.path();
+
+        let mut binding = RepositoryInitOptions::new();
+        let init_options = binding.initial_head("master");
+        let repo = Repository::init_opts(repo_path, init_options)
+            .expect("Failed to initialize repository");
+
+        fs::create_dir_all(repo_path.join("src")).unwrap();
+        fs::write(repo_path.join("src/changed.rs"), "fn changed() {}").unwrap();
+        fs::write(repo_path.join("src/unchanged.rs"), "fn unchanged() {}").unwrap();
+
+        let signature = Signature::now("Test", "test@example.com").unwrap();
+
+        // Commit both files on master
+        let mut index = repo.index().unwrap();
+        index.add_path(Path::new("src/changed.rs")).unwrap();
+        index.add_path(Path::new("src/unchanged.rs")).unwrap();
+        index.write().unwrap();
+        let tree_id = index.write_tree().unwrap();
+        let tree = repo.find_tree(tree_id).unwrap();
+        let master_commit = repo
+            .commit(
+                Some("HEAD"),
+                &signature,
+                &signature,
+                "Initial commit",
+                &tree,
+                &[],
+            )
+            .expect("Failed to commit");
+
+        // Create a feature branch and only modify one of the two files there
+        repo.branch("feature", &repo.find_commit(master_commit).unwrap(), false)
+            .expect("Failed to create new branch");
+        repo.set_head("refs/heads/feature").unwrap();
+        repo.checkout_head(None).unwrap();
+
+        fs::write(
+            repo_path.join("src/changed.rs"),
+            "fn changed() { /* updated */ }",
+        )
+        .unwrap();
+
+        let mut index = repo.index().unwrap();
+        index.add_path(Path::new("src/changed.rs")).unwrap();
+        index.write().unwrap();
+        let tree_id = index.write_tree().unwrap();
+        let tree = repo.find_tree(tree_id).unwrap();
+        repo.commit(
+            Some("HEAD"),
+            &signature,
+            &signature,
+            "Update changed.rs",
+            &tree,
+            &[&repo.find_commit(master_commit).unwrap()],
+        )
+        .expect("Failed to commit on feature branch");
+
+        let config = Code2PromptConfig::builder()
+            .path(repo_path.to_path_buf())
+            .diff_branches(Some(("master".to_string(), "feature".to_string())))
+            .build()
+            .unwrap();
+
+        let mut session = Code2PromptSession::new(config);
+        session.load_codebase().expect("Failed to load codebase");
+
+        let source_tree = session.data.source_tree.clone().unwrap_or_default();
+        assert!(
+            source_tree.contains("changed.rs"),
+            "expected diffed file in source tree, got:\n{source_tree}"
+        );
+        assert!(
+            !source_tree.contains("unchanged.rs"),
+            "expected unchanged file to be pruned from source tree, got:\n{source_tree}"
+        );
+
+        let files = session.data.files.clone().unwrap_or_default();
+        assert!(
+            files.iter().any(|f| f.path.contains("
```

---

### Incident Patch 8: `bae94df1` (2026-06-13)
**Commit Message**: Arc fix + anyhow error improvement

**File**: `crates/code2prompt-core/src/session.rs` (modified, +4/-3)
```diff
@@ -5,6 +5,7 @@ use anyhow::{Context, Result};
 use serde::Serialize;
 use std::collections::HashMap;
 use std::path::PathBuf;
+use std::sync::Arc;
 
 use crate::analysis::CodebaseAnalysis;
 use crate::configuration::Code2PromptConfig;
@@ -62,7 +63,7 @@ pub struct Code2PromptSession {
 pub struct SessionData {
     pub absolute_code_path: Option<String>,
     pub source_tree: Option<String>,
-    pub files: Option<Vec<FileEntry>>,
+    pub files: Option<Arc<Vec<FileEntry>>>,
     pub stats: Option<serde_json::Value>,
     pub git_diff: Option<String>,
     pub git_diff_branch: Option<String>,
@@ -255,7 +256,7 @@ impl Code2PromptSession {
         // Store absolute_code_path as Single Source of Truth
         self.data.absolute_code_path = Some(display_name(&self.config.path));
         self.data.source_tree = Some(tree);
-        self.data.files = Some(files);
+        self.data.files = Some(Arc::new(files));
 
         Ok(())
     }
@@ -290,7 +291,7 @@ impl Code2PromptSession {
         TemplateContext {
             absolute_code_path: self.data.absolute_code_path.as_deref().unwrap_or("unknown"),
             source_tree: &self.data.source_tree,
-            files: self.data.files.as_deref(),
+            files: self.data.files.as_deref().map(|v| v.as_slice()),
             git_diff: &self.data.git_diff,
             git_diff_branch: &self.data.git_diff_branch,
             git_log_branch: &self.data.git_log_branch,
```

**File**: `crates/code2prompt/src/main.rs` (modified, +23/-57)
```diff
@@ -67,10 +67,7 @@ fn run_cli(args: Cli) -> Result<()> {
     // ~~~ Load Configuration ~~~
     let config_source = load_config(quiet_mode)?;
     let mut session = config::build_session(Some(&config_source), &args, false)?;
-
-    // ~~~ Determine Output Behavior ~~~
     let default_output = get_default_output_destination(&config_source);
-    let (output_to_clipboard, output_to_stdout) = determine_output_targets(&args, &default_output);
 
     // ~~~ Gather Repository Data ~~~
     gather_session_data(&mut session, quiet_mode)?;
@@ -79,46 +76,11 @@ fn run_cli(args: Cli) -> Result<()> {
     let rendered = render_session_template(&mut session)?;
 
     // ~~~ Emit Results ~~~
-    emit_cli_results(
-        rendered,
-        &session,
-        &args,
-        output_to_stdout,
-        output_to_clipboard,
-    )?;
+    emit_cli_results(rendered, &session, &args, &default_output)?;
 
     Ok(())
 }
 
-// ============================================================================
-// Pipeline Helper Functions
-// ============================================================================
-
-/// Determines whether to output to clipboard, stdout, or both based on args and config.
-fn determine_output_targets(args: &Cli, default_output: &OutputDestination) -> (bool, bool) {
-    let output_to_clipboard = if args.clipboard {
-        true
-    } else if args.output_file.is_some() {
-        false
-    } else {
-        matches!(default_output, OutputDestination::Clipboard)
-    };
-
-    let output_to_stdout = if args.clipboard {
-        false
-    } else if let Some(ref output_file) = args.output_file {
-        output_file == "-"
-    } else {
-        match default_output {
-            OutputDestination::Stdout => true,
-            OutputDestination::Clipboard => false,
-            OutputDestination::File => false,
-        }
-    };
-
-    (output_to_clipboard, output_to_stdout)
-}
-
 /// Loads codebase and git data into the session, driving the loading spinner.
 fn gather_session_data(session: &mut Code2PromptSession, quiet: bool) -> Result<()> {
     let spinner = (!quiet).then(|| setup_spinner("Traversing directory and building tree..."));
@@ -177,17 +139,17 @@ fn render_session_template(session: &mut Code2PromptSession) -> Result<RenderedP
 
     Ok(rendered)
 }
+
 /// Dispatches the final rendered output to stdout, file, clipboard, and prints UI stats.
 fn emit_cli_results(
     rendered: RenderedPrompt,
     session: &Code2PromptSession,
     args: &Cli,
-    output_to_stdout: bool,
-    output_to_clipboard: bool,
+    default_output: &OutputDestination,
 ) -> Result<()> {
     let quiet_mode = args.quiet;
 
-    // ~~~ Token Count ~~~
+    // ~~~ Token Count & Map Display ~~~ 
     let token_count = rendered.token_count;
     let formatted_token_count = format_number(token_count, &session.config.token_format);
     let model_info = rendered.model_info;
@@ -227,16 +189,31 @@ fn emit_cli_results(
         display_token_map(&token_map_entries, rendered.token_count);
     }
 
-    // ~~~ Output to Stdout ~~~
-    if output_to_stdout {
+    // ~~~ Output Routing ~~~
+    let is_stdout_explicit = args.output_file.as_deref() == Some("-");
+    let has_file_target = args.output_file.is_some() && !is_stdout_explicit;
+
+    // ~~~ File Output ~~~
+    if has_file_target {
+        write_prompt_to_file(
+            std::path::Path::new(args.output_file.as_ref().unwrap()),
+            &rendered.prompt,
+            quiet_mode,
+        )?;
+    }
+
+    // ~~~ Stdout Output ~~~
+    let to_stdout = is_stdout_explicit || (!args.clipboard && !has_file_target && matches!(default_output, OutputDestination::Stdout));
+    if to_stdout {
         print!("{}", &rendered.prompt);
         std::io::stdout()
             .flush()
             .context("Failed to flush stdout")?;
     }
 
-    // ~~~ Copy to Clipboard ~~~
-    if output_to_clipboard {
+    // ~~~ Clipboard Output ~~~
+    let to_clipboard = args.clipboard || (!has
```

**File**: `crates/code2prompt/src/model/template/editor.rs` (modified, +7/-8)
```diff
@@ -6,6 +6,7 @@
 use regex::Regex;
 use std::collections::HashSet;
 use ratatui_textarea::{TextArea, CursorMove};
+use anyhow::{Result, anyhow};
 
 /// State for the template editor component
 #[derive(Debug)]
@@ -120,16 +121,14 @@ impl EditorState {
     }
 
     /// Attempt to compile the template to check for syntax errors
-    fn compile_template(&self) -> Result<(), String> {
+    fn compile_template(&self) -> Result<()> {
         let mut handlebars = handlebars::Handlebars::new();
+        handlebars.set_strict_mode(false); 
 
-        // Set strict mode to catch undefined variables
-        handlebars.set_strict_mode(false); // Allow undefined variables for now
-
-        match handlebars.register_template_string("test", &self.content) {
-            Ok(_) => Ok(()),
-            Err(e) => Err(format!("{}", e)),
-        }
+        handlebars.register_template_string("test", &self.content)
+            .map_err(|e| anyhow!("Failed to compile template: {}", e))?;
+            
+        Ok(())
     }
 
     /// Get current template content
```

**File**: `crates/code2prompt/src/model/template/mod.rs` (modified, +7/-6)
```diff
@@ -9,6 +9,7 @@ pub mod editor;
 pub mod picker;
 pub mod variable;
 
+use anyhow::{Context, Result, anyhow, bail};
 pub use editor::EditorState;
 pub use picker::{ActiveList, PickerState};
 pub use variable::{VariableCategory, VariableInfo, VariableState};
@@ -115,7 +116,7 @@ impl TemplateState {
     }
 
     /// Load the currently selected template from the picker
-    pub fn load_selected_template(&mut self) -> Result<String, String> {
+    pub fn load_selected_template(&mut self) -> Result<String> {
         let selected_template = self.get_selected_template()?;
 
         // Load template content based on type
@@ -136,12 +137,12 @@ impl TemplateState {
                     builtin_template.name.to_string(),
                 )
             } else {
-                return Err(format!("Built-in template '{}' not found", template_key));
+                bail!("Built-in template '{}' not found", template_key);
             }
         } else {
             // Load template from file
             let content = std::fs::read_to_string(&selected_template.path)
-                .map_err(|e| format!("Failed to read template file: {}", e))?;
+                .context("Failed to read template file")?;
             (content, selected_template.name.clone())
         };
 
@@ -160,18 +161,18 @@ impl TemplateState {
     }
 
     /// Get the currently selected template from the picker
-    fn get_selected_template(&self) -> Result<&picker::TemplateFile, String> {
+    fn get_selected_template(&self) -> Result<&picker::TemplateFile> {
         match self.picker.active_list {
             ActiveList::Default => self
                 .picker
                 .default_templates
                 .get(self.picker.default_cursor)
-                .ok_or_else(|| "No default template selected".to_string()),
+                .ok_or_else(|| anyhow!("No default template selected")),
             ActiveList::Custom => self
                 .picker
                 .custom_templates
                 .get(self.picker.custom_cursor)
-                .ok_or_else(|| "No custom template selected".to_string()),
+                .ok_or_else(|| anyhow!("No custom template selected")),
         }
     }
 }
```

**File**: `crates/code2prompt/tests/config_test.rs` (modified, +3/-2)
```diff
@@ -160,7 +160,8 @@ fn test_clipboard_flag() {
     let test_env = StdoutTestEnv::new();
 
     let mut cmd = assert_cmd::cargo::cargo_bin_cmd!("code2prompt");
-    cmd.arg(test_env.path())
+    cmd.current_dir(test_env.path())
+        .arg(".")
         .arg("-c") // New clipboard flag
         .assert()
         .success()
@@ -242,7 +243,7 @@ fn test_cli_args_message() {
 
     let mut cmd = assert_cmd::cargo::cargo_bin_cmd!("code2prompt");
     cmd.current_dir(test_env.path())
-    .arg(test_env.path())
+        .arg(".")
         .arg("-i")
         .arg("*.py")
         .assert()
```

---

### Incident Patch 9: `a78acaec` (2026-06-13)
**Commit Message**: fix test and testdoc

**File**: `crates/code2prompt-core/src/configuration.rs` (modified, +2/-1)
```diff
@@ -21,7 +21,8 @@ use std::path::PathBuf;
 /// 
 /// let config = Code2PromptConfig::builder()
 ///     .hidden(true)
-///     .build()?;
+///     .build()
+///     .unwrap();
 /// ```
 ///
 /// 
```

**File**: `crates/code2prompt/tests/config_test.rs` (modified, +2/-1)
```diff
@@ -241,7 +241,8 @@ fn test_cli_args_message() {
     let test_env = StdoutTestEnv::new();
 
     let mut cmd = assert_cmd::cargo::cargo_bin_cmd!("code2prompt");
-    cmd.arg(test_env.path())
+    cmd.current_dir(test_env.path())
+    .arg(test_env.path())
         .arg("-i")
         .arg("*.py")
         .assert()
```

---

### Incident Patch 10: `03e03df7` (2026-06-09)
**Commit Message**: fix: add critical runtime safety checks to rustdoc parser

- Add initialization validation to extractPublicItems() and groupByModule()
- Add null safety for span property with fallback defaults
- Prevent runtime crashes from undefined spans and unloaded data

**File**: `website/tools/doc-to-mdx/src/parser.ts` (modified, +12/-1)
```diff
@@ -16,6 +16,10 @@ export class RustDocParser {
   }
 
   extractPublicItems(): RustDocItem[] {
+    if (!this.docData) {
+      throw new Error('Parser not loaded. Call load() first.');
+    }
+    
     const items: RustDocItem[] = [];
     
     // ~~~ Process crate items ~~~
@@ -33,14 +37,18 @@ export class RustDocParser {
         docs: typedItem.docs,
         attrs: typedItem.attrs || [],
         visibility: typedItem.visibility,
-        span: typedItem.span
+        span: typedItem.span || { filename: 'unknown', begin: [0, 0], end: [0, 0] }
       });
     }
     
     return items;
   }
 
   groupByModule(items: RustDocItem[]): Map<string, RustDocItem[]> {
+    if (!this.docData) {
+      throw new Error('Parser not loaded. Call load() first.');
+    }
+    
     const modules = new Map<string, RustDocItem[]>();
     
     for (const item of items) {
@@ -57,6 +65,9 @@ export class RustDocParser {
   }
 
   private extractModuleName(item: RustDocItem): string {
+    if (!item.span?.filename) {
+      return 'unknown';
+    }
     // Extract module name from span filename
     const filename = path.basename(item.span.filename, '.rs');
     return filename === 'lib' ? 'core' : filename;
```

#### Recent Merged Pull Requests:
- **PR #341** (closed): build(deps): bump astral-sh/setup-uv from 9.0.0 to 10.1.0 (@dependabot[bot])
- **PR #338** (closed): build(deps): bump pyo3 from 0.28.3 to 0.29.2 (@dependabot[bot])
- **PR #337** (closed): build(deps): bump astral-sh/setup-uv from 9.0.0 to 10.0.1 (@dependabot[bot])
- **PR #336** (2026-09-06): Pyo3 latest api (@ODAncona)
- **PR #335** (2026-09-05): docs: fix three stale CLI flags in the how-to examples (--line-number, --tokens, --exclude-from-tree) (@cnYui)
- **PR #333** (2026-09-04): Fix the broken star history chart in the README (@OctoBored)
- **PR #331** (2026-09-04): fix(core): prune source_tree to changed files under --git-diff-branch (@arimu1)
- **PR #330** (2026-09-04): feat(core): make ipynb file processor configurable (@arimu1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
