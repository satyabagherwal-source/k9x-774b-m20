# Forensic Learning Record (Deep Inspection): mufeedvh/code2prompt

> **Canonical Artifact**: `07_PROJECT_LEARNING/mufeedvh-code2prompt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mufeedvh/code2prompt](https://github.com/mufeedvh/code2prompt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:57:32.764Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mufeedvh/code2prompt`
- **Description**: A CLI tool to convert your codebase into a single LLM prompt with source tree, prompt templating, and token counting.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7720 stars

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
        child.metadata = Some(file_metadata);
    } else {
        // This is a directory (intermediate node)
        let dir_name = components[0].to_string();
        let dir_path = if parent_path.is_empty() {
            dir_name.clone()
        } else {
            format!("{}/{}", parent_path, dir_name)
        };

        let child = node
            .children
            .entry(dir_name)
            .or_insert_with(|| TreeNode::new(dir_path.clone()));
        child.tokens += tokens; // Accumulate tokens for directory
        child.metadata = Some(EntryMetadata { is_dir: true });

        // Recurse into the next level
        insert_path(child, &components[1..], tokens, dir_path, file_metadata);
    }
}

// ============================================================================
// Priority Queue Filtering (Dust Algorithm)
// ============================================================================

/// Helper for Priority Queue - sorts nodes by tokens (descending)
#[derive(Debug, Clone, Eq, PartialEq)]
struct NodePriority {
    tokens: usize,
    path: String,
    depth: usize,
}

impl Ord for NodePriority {
    fn cmp(&self, other: &Self) -> Ordering {
        // Order by tokens (descending), then by depth (ascending for ties), then by path
        self.tokens
            .cmp(&other.tokens)
            .then_with(|| other.depth.cmp(&self.depth)) // Prefer shallower when equal tokens
            .then_with(|| self.path.cmp(&other.path))
    }
}

impl PartialOrd for NodePriority {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Select nodes to display using priority queue (dust-inspired)
fn select_nodes_to_display(
    root: &TreeNode,
    total_tokens: usize,
    options: &TokenMapOptions,
) -> HashMap<String, usize> {
    let mut heap = BinaryHeap::new();
    let mut allowed_nodes = HashMap::new();
    let min_tokens = (total_tokens as f64 * options.min_percent / 100.0) as usize;

    // Start with root's children
    f
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
            builder.log_branches(Some((log_branches[0].clone(), log_branches[1].clone())));
        }

        if let Some(template_name) = &self.template_name {
            builder.template_name(template_name.clone());
        }

        if let Some(template_str) = &self.template_str {
            builder.template_str(template_str.clone());
        }

        builder
            .user_variables(self.user_variables.clone())
            .token_map_enabled(self.token_map_enabled)
            .deselected(self.deselected)
            .processors(self.processors.clone());

        builder.build().unwrap_or_default()
    }
}

/// Export a Code2PromptConfig to TOML format
pub fn export_config_to_toml(config: &Code2PromptConfig) -> Result<String, toml::ser::Error> {
    let toml_config = TomlConfig {
        default_output: OutputDestination::Stdout, // Default for new behavior
        path: Some(config.path.to_string_lossy().to_string()),
        include_patterns: config.include_patterns.clone(),
        exclude_patterns: config.exclude_patterns.clone(),
        line_numbers: config.line_numbers,
        absolute_path: config.absolute_path,
        full_directory_tree: config.full_directory_tree,
        output_format: Some(config.output_format),
        sort_method: config.sort_method,
        encoding: Some(config.encoding),
        token_format: Some(config.token_format),
        diff_enabled: config.diff_enabled,
        diff_branches: config
            .diff_branches
            .as_ref()
            .map(|(a, b)| vec![a.clone(), b.clone()]),
        log_branches: config
            .log_branches
            .as_ref()
            .map(|(a, b)| vec![a.clone(), b.clone()]),
        template_name: if config.template_name.is_empty() {
            None
        } else {
            Some(config.template_name.clone())
        },
        template_str: if config.template_str.is_empty() {
            None
        } else {
            Some(config.template_str.clone())
        },
        user_variables: config.user_variables.cl
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

### Core Architecture Module: `crates/code2prompt-core/src/file_processor/mod.rs`
```
//! File processor module for handling different file types intelligently.
//!
//! This module provides a strategy pattern for processing file contents based on their extension
//! in order to optimize for LLM token usage. The main idea is to extract the schema rather than
//! raw data where applicable. (e.g., schema + sample for CSV, code cells for Jupyter notebooks).

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

mod csv;
mod default;
mod ipynb;
mod jsonl;
mod tsv;

pub use csv::CsvProcessor;
pub use default::DefaultTextProcessor;
pub use ipynb::JupyterNotebookProcessor;
pub use jsonl::JsonLinesProcessor;
pub use tsv::TsvProcessor;

/// Configuration for the Jupyter notebook (`.ipynb`) file processor.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct IpynbProcessorConfig {
    /// Maximum number of code cells to include in the processed output.
    ///
    /// Default: `3`
    pub max_code_cells: usize,

    /// When true, include cell outputs (stdout / text/plain / errors) after each code cell.
    ///
    /// Default: `false`
    pub include_outputs: bool,

    /// When true, include markdown cells in the processed output.
    ///
    /// Default: `false`
    pub include_markdown: bool,
}

impl Default for IpynbProcessorConfig {
    fn default() -> Self {
        Self {
            max_code_cells: 3,
            include_outputs: false,
            include_markdown: false,
        }
    }
}

/// Configuration for all file processors.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct FileProcessorsConfig {
    /// Jupyter notebook processor settings.
    pub ipynb: IpynbProcessorConfig,
}

/// Trait for processing file contents into LLM-optimized string representations.
///
/// Each processor takes raw bytes and produces a formatted string suitable for
/// inclusion in an LLM prompt. Processors may extract schemas, truncate content,
/// or apply other transformations to reduce token usage while preserving semantic value.
pub trait FileProcessor: Send + Sync {
    /// Process file content and return a formatted string.
    ///
    /// # Arguments
    ///
    /// * `content` - Raw file bytes
    /// * `path` - File path for context and error messages
    ///
    /// # Returns
    ///
    /// * `Result<String>` - Processed content or error
    fn process(&self, content: &[u8], path: &Path) -> Result<String>;
}

/// Factory function to get the appropriate processor for a file extension.
///
/// # Arguments
///
/// * `extension` - File extension (without dot)
/// * `processors` - Processor configuration (used by configurable processors such as ipynb)
///
/// # Returns
///
/// * `Box<dyn FileProcessor>` - Processor instance for the given extension
pub fn get_processor_for_extension(
    extension: &str,
    processors: &FileProcessorsConfig,
) -> Box<dyn FileProcessor> {
    match extension.to_lowercase().as_str() {
        "csv" => Box::new(CsvProcessor),
        "tsv" => Box::new(TsvProcessor),
        "jsonl" | "ndjson" => Box::new(JsonLinesProcessor),
        "ipynb" => Box::new(JupyterNotebookProcessor::new(processors.ipynb.clone())),
        // Future processors can be added here:
        // "parquet" => Box::new(ParquetProcessor),
        // "xml" => Box::new(XmlProcessor),
        _ => Box::new(DefaultTextProcessor),
    }
}

```

### Core Architecture Module: `crates/code2prompt-core/src/file_processor/tsv.rs`
```
//! TSV (Tab-Separated Values) file processor.
//!
//! This processor is a thin wrapper around the CSV processor with tab delimiter.
//! It extracts headers and one sample row from TSV files.

use super::{CsvProcessor, FileProcessor};
use anyhow::Result;
use std::path::Path;

/// TSV processor that reuses CSV logic with tab delimiter.
pub struct TsvProcessor;

impl FileProcessor for TsvProcessor {
    fn process(&self, content: &[u8], path: &Path) -> Result<String> {
        let csv_processor = CsvProcessor;
        match csv_processor.process_with_delimiter(content, b'\t', path) {
            Ok(mut result) => {
                // Replace "CSV" with "TSV" in the output
                result = result.replace("CSV Schema", "TSV Schema");
                Ok(result)
            }
            Err(e) => {
                log::warn!(
                    "TSV parsing failed for {:?}: {}. Using raw text fallback.",
                    path,
                    e
                );
                // Fallback to raw text
                let fallback = super::DefaultTextProcessor;
                fallback.process(content, path)
            }
        }
    }
}

```

### Core Architecture Module: `crates/code2prompt-core/src/filter.rs`
```
//! This module contains pure filtering logic for files based on glob patterns.
//!
//! This module provides reusable, stateless functions for pattern matching and file filtering.

use bracoxide::explode;
use colored::*;
use globset::{Glob, GlobSet, GlobSetBuilder};
use log::{debug, warn};
use std::path::Path;

/// FilterEngine encapsulates pattern-based file filtering logic.
/// This handles the base patterns (A, B in the A,A',B,B' system).
#[derive(Debug, Clone)]
pub struct FilterEngine {
    include_globset: GlobSet,
    exclude_globset: GlobSet,
}

impl FilterEngine {
    /// Create a new FilterEngine with the given patterns
    pub fn new(include_patterns: &[String], exclude_patterns: &[String]) -> Self {
        Self {
            include_globset: build_globset(include_patterns),
            exclude_globset: build_globset(exclude_patterns),
        }
    }

    /// Check if a file matches the base patterns (A, B logic)
    pub fn matches_patterns(&self, path: &Path) -> bool {
        should_include_file(path, &self.include_globset, &self.exclude_globset)
    }

    /// Get access to the include globset (for advanced usage)
    pub fn include_globset(&self) -> &GlobSet {
        &self.include_globset
    }

    /// Get access to the exclude globset (for advanced usage)
    pub fn exclude_globset(&self) -> &GlobSet {
        &self.exclude_globset
    }

    /// Check if there are any include patterns
    pub fn has_include_patterns(&self) -> bool {
        !self.include_globset.is_empty()
    }

    /// Check if a file is excluded by exclude patterns
    pub fn is_excluded(&self, path: &Path) -> bool {
        self.exclude_globset.is_match(path)
    }
}

/// Constructs a `GlobSet` from a list of glob patterns.
///
/// This function takes a slice of `String` patterns, attempts to convert each
/// pattern into a `Glob`, and adds it to a `GlobSetBuilder`. If any pattern is
/// invalid, it is ignored. The function then builds and returns a `GlobSet`.
///
/// # Arguments
///
/// * `patterns` - A slice of `String` containing glob patterns.
///
/// # Returns
///
/// * A `globset::GlobSet` containing all valid glob patterns from the input.
pub fn build_globset(patterns: &[String]) -> GlobSet {
    let mut builder = GlobSetBuilder::new();

    let mut expanded_patterns = Vec::new();
    for pattern in patterns {
        if pattern.contains('{') {
            match explode(pattern) {
                Ok(exp) => expanded_patterns.extend(exp),
                Err(e) => warn!("⚠️ Invalid brace pattern '{}': {:?}", pattern, e),
            }
        } else {
            expanded_patterns.push(pattern.clone());
        }
    }

    for pattern in expanded_patterns {
        // If the pattern does not contain a '/' or the platform's separator, prepend "**/"
        let normalized_pattern = if pattern.contains('/') {
            pattern.trim_start_matches("./").to_string()
        } else {
            format!("**/{}", pattern.trim_start_matches("./"))
        };

        match Glob::new(&normalized_pattern) {
            Ok(glob) => {
                builder.add(glob);
                debug!("✅ Glob pattern added: '{}'", normalized_pattern);
            }
            Err(_) => {
                warn!("⚠️ Invalid pattern: '{}'", normalized_pattern);
            }
        }
    }

    match builder.build() {
        Ok(set) => set,
        Err(e) => {
            warn!("❌ Failed to build GlobSet: {e}");
            GlobSetBuilder::new()
                .build()
                .expect("empty GlobSet never fails")
        }
    }
}

/// Apply file filters based on glob patterns.
/// 
/// Processes include/exclude patterns to determine if a file should be included.
/// This is the core filtering logic that handles pattern matching precedence.
///
/// Note: The `path` argument must be a relative path (i.e. relative to the base directory)
/// for the patterns to match as expected. Absolute paths will not yield correct matching.
///
/// # Arguments
///
/// * `path` - A relative path to the file that will be checked against the patterns.
/// * `include_globset` - A GlobSet specifying which files to include.
///   If empty, all files are considered included unless excluded.
/// * `exclude_globset` - A GlobSet specifying which files to exclude.
///
/// # Returns
///
/// * `bool` - Returns `true` if the file should be included; otherwise, returns `false`.
///
/// # Behavior
///
/// When both include and exclude patterns match, exclude patterns take precedence.
/// Returns filtered decision for path processing pipeline.
pub fn should_include_file(
    path: &Path,
    include_globset: &GlobSet,
    exclude_globset: &GlobSet,
) -> bool {
    // ~~~ Matching ~~~
    let included = include_globset.is_match(path);
    let excluded = exclude_globset.is_match(path);

    // ~~~ Decision ~~~
    let result = match (included, excluded) {
        (true, true) => false,  // If both match, exclude takes precedence
        (true, false) => true,  // If only included, include it
        (false, true) => false, // If only excluded, exclude it
        (false, false) => include_globset.is_empty(), // If no include patterns, include everything
    };

    debug!(
        "Result: {}, {}: {}, {}: {}, Path: {:?}",
        result,
        "included".bold().green(),
        included,
        "excluded".bold().red(),
        excluded,
        path.display()
    );
    result
}

```

### Core Architecture Module: `crates/code2prompt-core/src/git.rs`
```
//! Git repository integration for diff extraction and branch operations.
//! 
//! This module provides core git functionality for code2prompt, including:
//! - Generating diffs between HEAD and index (staged changes)
//! - Comparing branches for diff and log extraction
//! - Repository validation and reference checking

use anyhow::{Context, Result};
use git2::{DiffOptions, Repository};
use log::info;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// Extract git diff for staged changes in repository.
/// 
/// Generates diff between HEAD and index to show staged changes, with additional
/// notification if unstaged changes are present. This is the primary git integration
/// point for code2prompt's diff functionality.
///
/// # Arguments
///
/// * `repo_path` - Path to git repository
///
/// # Returns
///
/// * `Result<String>` - Git diff output or "no diff between HEAD and index" if no changes
///
/// # Errors  
/// 
/// Returns error if:
/// - Repository is invalid or cannot be opened
/// - HEAD reference is missing or corrupt
/// - Git operations fail during diff generation
pub fn get_git_diff(repo_path: &Path) -> Result<String> {
    info!("Opening repository at path: {:?}", repo_path);
    let repo = Repository::open(repo_path).context("Failed to open repository")?;

    let head = repo.head().context("Failed to get repository head")?;
    let head_tree = head.peel_to_tree().context("Failed to peel to tree")?;

    // Generate diff for staged changes (HEAD vs. index)
    let staged_diff = repo
        .diff_tree_to_index(
            Some(&head_tree),
            None,
            Some(DiffOptions::new().ignore_whitespace(true)),
        )
        .context("Failed to generate diff for staged changes")?;

    let mut staged_diff_text = Vec::new();
    staged_diff
        .print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            staged_diff_text.extend_from_slice(line.content());
            true
        })
        .context("Failed to print staged diff")?;

    let staged_diff_output = String::from_utf8_lossy(&staged_diff_text).into_owned();

    // If there is no staged diff, return a message indicating so.
    if staged_diff_output.trim().is_empty() {
        return Ok("no diff between HEAD and index".to_string());
    }

    // Generate diff for unstaged changes (index vs. working directory)
    let unstaged_diff = repo
        .diff_index_to_workdir(None, Some(DiffOptions::new().ignore_whitespace(true)))
        .context("Failed to generate diff for unstaged changes")?;

    let mut unstaged_diff_text = Vec::new();
    unstaged_diff
        .print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            unstaged_diff_text.extend_from_slice(line.content());
            true
        })
        .context("Failed to print unstaged diff")?;

    let unstaged_diff_output = String::from_utf8_lossy(&unstaged_diff_text).into_owned();

    let mut output = staged_diff_output;
    if !unstaged_diff_output.trim().is_empty() {
        output.push_str("\nNote: Some changes are not staged.");
    }

    info!("Generated git diff successfully");
    Ok(output)
}

/// Generates a git diff between two branches for the repository at the provided path
///
/// # Arguments
///
/// * `repo_path` - A reference to the path of the git repository
/// * `branch1` - The name of the first branch
/// * `branch2` - The name of the second branch
///
/// # Returns
///
/// * `Result<String, git2::Error>` - The generated git diff as a string or an error
pub fn get_git_diff_between_branches(
    repo_path: &Path,
    branch1: &str,
    branch2: &str,
) -> Result<String> {
    info!("Opening repository at path: {:?}", repo_path);
    let repo = Repository::open(repo_path).context("Failed to open repository")?;

    for branch in [branch1, branch2].iter() {
        if !branch_exists(&repo, branch) {
            return Err(anyhow::anyhow!("Branch {} doesn't exist!", branch));
        }
    }

    let branch1_commit = repo.revparse_single(branch1)?.peel_to_commit()?;
    let branch2_commit = repo.revparse_single(branch2)?.peel_to_commit()?;

    let branch1_tree = branch1_commit.tree()?;
    let branch2_tree = branch2_commit.tree()?;

    let diff = repo
        .diff_tree_to_tree(
            Some(&branch1_tree),
            Some(&branch2_tree),
            Some(DiffOptions::new().ignore_whitespace(true)),
        )
        .context("Failed to generate diff between branches")?;

    let mut diff_text = Vec::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        diff_text.extend_from_slice(line.content());
        true
    })
    .context("Failed to print diff")?;

    info!("Generated git diff between branches successfully");
    Ok(String::from_utf8_lossy(&diff_text).into_owned())
}

/// Computes the set of relative file paths that changed between two branches.
///
/// This performs the same tree-to-tree diff as [`get_git_diff_between_branches`],
/// but instead of rendering a textual patch it collects the paths touched by
/// each delta (both sides, so a rename contributes its old and new path).
/// This set is used to prune the source tree and file content down to only
/// the files that actually changed when `--git-diff-branch` is active.
///
/// # Arguments
///
/// * `repo_path` - A reference to the path of the git repository
/// * `branch1` - The name of the first branch
/// * `branch2` - The name of the second branch
///
/// # Returns
///
/// * `Result<HashSet<PathBuf>>` - The relative paths that changed between the two branches
pub fn get_git_diff_file_paths(
    repo_path: &Path,
    branch1: &str,
    branch2: &str,
) -> Result<HashSet<PathBuf>> {
    info!("Opening repository at path: {:?}", repo_path);
    let repo = Repository::open(repo_path).context("Failed to open repository")?;

    for branch in [branch1, branch2].iter() {
        if !branch_exists(&repo, branch) {
            return Err(anyhow::anyhow!("Branch {} doesn't exist!", branch));
        }
    }

    let branch1_commit = repo.revparse_single(branch1)?.peel_to_commit()?;
    let branch2_commit = repo.revparse_single(branch2)?.peel_to_commit()?;

    let branch1_tree = branch1_commit.tree()?;
    let branch2_tree = branch2_commit.tree()?;

    let diff = repo
        .diff_tree_to_tree(
            Some(&branch1_tree),
            Some(&branch2_tree),
            Some(DiffOptions::new().ignore_whitespace(true)),
        )
        .context("Failed to generate diff between branches")?;

    let mut paths = HashSet::new();
    for delta in diff.deltas() {
        if let Some(path) = delta.old_file().path() {
            paths.insert(path.to_path_buf());
        }
        if let Some(path) = delta.new_file().path() {
            paths.insert(path.to_path_buf());
        }
    }

    info!(
        "Collected {} changed file path(s) between branches",
        paths.len()
    );
    Ok(paths)
}

/// Retrieves the git log between two branches for the repository at the provided path
///
/// # Arguments
///
/// * `repo_path` - A reference to the path of the git repository
/// * `branch1` - The name of the first branch (e.g., "master")
/// * `branch2` - The name of the second branch (e.g., "migrate-manifest-v3")
///
/// # Returns
///
/// * `Result<String, git2::Error>` - The git log as a string or an error
pub fn get_git_log(repo_path: &Path, branch1: &str, branch2: &str) -> Result<String> {
    info!("Opening repository at path: {:?}", repo_path);
    let repo = Repository::open(repo_path).context("Failed to open repository")?;

    for branch in [branch1, branch2].iter() {
        if !branch_exists(&repo, branch) {
            return Err(anyhow::anyhow!("Branch {} doesn't exist!", branch));
        }
    }

    let branch1_commit = repo.revparse_single(branch1)?.peel_to_commit()?;
    let branch2_commit = repo.revparse_single(branch2)?.peel_to_commit()?;

    let mut revwalk = repo.revwalk().context("Failed to create revwalk")?;
    revwalk
        .push(branch2_commit.id())
        .context("Failed to push branch2 commit to revwalk")?;
    revwalk
        .hide(branch1_commit.id())
        .context("Failed to hide branch1 commit from revwalk")?;
    revwalk.set_sorting(git2::Sort::REVERSE)?;

    let mut log_text = String::new();
    for oid in revwalk {
        let oid = oid.context("Failed to get OID from revwalk")?;
        let commit = repo.find_commit(oid).context("Failed to find commit")?;
        let summary = commit.summary().ok().flatten().unwrap_or("No commit message");
        log_text.push_str(&format!(
            "{} - {}\n",
            &commit.id().to_string()[..7],
            summary
        ));
    }

    info!("Retrieved git log successfully");
    Ok(log_text)
}

/// Checks if a git reference exists in the given repository
///
/// This function can validate any git reference including:
/// - Local and remote branch names
/// - Commit hashes (full or abbreviated)
/// - Tags
/// - Any reference that git rev-parse can resolve
///
/// # Arguments
///
/// * `repo` - A reference to the `Repository` where the reference should be checked
/// * `branch_name` - A string slice that holds the name of the reference to check
///
/// # Returns
///
/// * `bool` - `true` if the reference exists, `false` otherwise
fn branch_exists(repo: &Repository, branch_name: &str) -> bool {
    repo.revparse_single(branch_name).is_ok()
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

### Incident Patch 1: `0a5c8491` (2026-09-06)
**Commit Message**: agent guidelines for c2p

**File**: `.agents/skills/code2prompt-conventions/SKILL.md` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+---
+name: code2prompt-conventions
+description: Follow code2prompt architecture and implementation conventions when changing or reviewing code.
+---
+
+# code2prompt conventions
+
+Before changing an unfamiliar area, read the target code, a nearby example, and relevant tests.
+
+## Ownership
+
+- `code2prompt-core`: reusable logic, configuration, files, Git, templates, tokenization, analysis, and sessions.
+- `code2prompt`: CLI, config precedence, stdout/stderr, clipboard, and TUI model/views/widgets.
+- `code2prompt-python`: thin PyO3 adapter over `code2prompt-core`.
+- `website`: site and product documentation, not product semantics.
+
+Implement behavior once, in the lowest appropriate layer.
+
+`Code2PromptSession` coordinates configuration, selection state, and loaded data.
+`SessionData` is the source of truth for loaded codebase and Git results, not for all
+session state.
+
+## Preserve
+
+- deterministic output where order is visible;
+- optional-feature behavior with and without the feature;
+- intended fallbacks and useful error context;
+- stdout for prompt/data output and stderr for human diagnostics;
+- existing public names, defaults, serialized values, CLI behavior, and Python API unless intentionally changed.
+
+## Style
+
+- Prefer existing abstractions and dependencies.
+- Avoid unrelated refactors.
+- Use `Result`/`?`; add context at filesystem, Git, parsing, and rendering boundaries.
+- Avoid runtime panics for recoverable failures.
+- Comments explain why, invariants, compatibility, or non-obvious algorithms.
+- Put focused private Rust tests in local `#[cfg(test)] mod tests`; use integration tests for public behavior.
```

**File**: `.agents/skills/documentation/SKILL.md` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+---
+name: documentation
+description: Update code2prompt documentation when public behavior or architecture changes.
+---
+
+# Documentation
+
+Update docs when a change affects public APIs, CLI flags/defaults/output, configuration,
+template variables, feature flags, installation, or user workflows.
+
+- Use `//!` for module purpose and boundaries.
+- Use `///` for useful public API semantics, errors, or examples.
+- Use inline comments only for non-obvious intent, constraints, or tradeoffs.
+- Keep the root README, Python README, and website examples consistent with their surface.
+- Update localized pages when in scope; otherwise report which copies may be stale.
+
+Do not add comments that merely restate the code.
+
+For changed CLI documentation, compare against:
+
+```bash
+cargo run --quiet -- --help
+```
+
+Run the relevant verification skill after documentation-sensitive changes.
```

**File**: `.agents/skills/verify-cli/SKILL.md` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+---
+name: verify-cli
+description: Verify changes to the code2prompt CLI or TUI.
+---
+
+# Verify CLI / TUI
+
+Run from the repository root:
+
+```bash
+cargo test
+cargo clippy --all-targets --all-features
+```
+
+For changed flags, configuration, or output behavior, also run or add a representative
+integration test and compare the CLI with:
+
+```bash
+cargo run --quiet -- --help
+```
+
+Check CLI-over-config precedence, stdout versus stderr, quiet mode, and that TUI state
+stays in the model/session rather than widgets. Use temporary fixtures, not personal
+repositories. Report failed checks explicitly.
```

**File**: `.agents/skills/verify-core/SKILL.md` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+---
+name: verify-core
+description: Verify changes under crates/code2prompt-core.
+---
+
+# Verify core
+
+Run from the repository root:
+
+```bash
+cargo test
+cargo clippy --all-targets --all-features
+```
+
+If `entity-map` runtime behavior changed, also run:
+
+```bash
+cargo test --all-features
+```
+
+Check that presentation logic did not leak into core, ordering stays deterministic,
+fallbacks and features still work, and changed behavior has a regression test when
+practical. Report failed checks explicitly.
```

**File**: `.agents/skills/verify-python/SKILL.md` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+---
+name: verify-python
+description: Verify code2prompt Python bindings and packaging.
+---
+
+# Verify Python
+
+From `crates/code2prompt-python`:
+
+```bash
+uv run --locked pytest
+```
+
+Run `uv sync --locked` first when the environment is missing or project metadata changed.
+
+From the repository root:
+
+```bash
+cargo clippy -p code2prompt-python --all-targets
+```
+
+Build a release wheel only when PyO3 exports or packaging changed:
+
+```bash
+cd crates/code2prompt-python
+uv run --locked maturin build --release --out ../../dist
+```
+
+Keep Python a thin adapter over the core. Preserve public Python names and types unless
+intentionally changed. Report the Python version and failed checks explicitly.
```

**File**: `.agents/skills/verify-website/SKILL.md` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+---
+name: verify-website
+description: Verify changes under website/.
+---
+
+# Verify website
+
+From `website/`, run `pnpm install --frozen-lockfile` only when dependencies are missing
+or package metadata changed, then run:
+
+```bash
+pnpm build
+```
+
+Check changed pages for broken links or routes, incorrect examples, navigation changes,
+relevant localized copies, and visual regressions when layout or styling changed.
+
+Do not commit `website/dist/`. Report build or environment failures explicitly.
```

**File**: `AGENTS.md` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+# code2prompt agent guide
+
+Project-specific skills live in `.agents/skills/`.
+
+## Rules
+
+- Follow existing code2prompt patterns before generic best practices.
+- Put reusable product logic in `code2prompt-core`.
+- Keep CLI/TUI concerns in `code2prompt`.
+- Keep Python bindings thin: delegate behavior to the core.
+- `Code2PromptSession` coordinates configuration, selection, and loaded `SessionData`.
+- Keep the website as a consumer of product behavior, not a second implementation.
+- Prefer small changes and existing dependencies.
+- Preserve public behavior unless the task explicitly changes it.
+- Bug fixes should include a regression test when practical.
+- Comments should explain non-obvious intent, constraints, or tradeoffs, not narrate code.
+- Do not claim completion until the relevant verification skill passes.
+
+## Skills
+
+- Implementation/refactoring → `code2prompt-conventions`
+- `crates/code2prompt-core/**` → `verify-core`
+- `crates/code2prompt/**` → `verify-cli`
+- `crates/code2prompt-python/**` → `verify-python`
+- `website/**` → `verify-website`
+- Public behavior/docs/comments → `documentation`
+
+A change can require several verification skills. Root `cargo test` does not exercise
+the Python bindings.
```

---

### Incident Patch 2: `b998f458` (2026-09-06)
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
-### Task 2: Session Management API Documentation
-
-**Files:**
-- Modify: `crates/code2prompt-core/src/session.rs:1-100`
-- Test: Verify with `cargo doc --no-deps`
-
-- [ ] **Step 1: Enhance Code2PromptSession struct documentation**
-
-```rust
-/// Main orchestrator for code prompt generation workflows.
-/// 
-/// Combines configuration, file processing, and template rendering into
-/// a cohesive session. Maintains state during processing.
-/// 
-/// # Example
-/// ```
-/// use code2prompt_core::{Code2PromptConfig, Code2PromptSession};
-/// 
-/// let config = Code2PromptConfig::default();
-/// let session = Code2PromptSession::new(config, "/path/to/project")?;
-/// let output = session.process()?;
-/// ```
-pub struct Code2PromptSession {
-```
-
-- [ ] **Step 2: Document key session methods**
-
-```rust
-/// Create new session with configuration and root path.
-/// 
-/// # Arguments
-/// * `config` - Configuration object with filters and preferences
-/// * `root_path` - Project root directo
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

**File**: `crates/code2prompt/src/main.rs` (modified, +1/-3)
```diff
@@ -4,18 +4,16 @@ mod args;
 mod clipboard;
 mod config;
 mod config_loader;
-mod model;
 mod token_map;
 mod tui;
-mod utils;
-mod view;
 mod widgets;
 
 use crate::token_map::display_token_map;
 use crate::utils::format_number;
 use anyhow::{Context, Result};
 use args::Cli;
 use clap::Parser;
+use code2prompt::{model, utils};
 use code2prompt_core::analysis::TokenMapOptions;
 use code2prompt_core::configuration::OutputDestination;
 use code2prompt_core::session::{Code2PromptSession, RenderedPrompt};
```

**File**: `crates/code2prompt/src/model/mod.rs` (modified, +32/-7)
```diff
@@ -223,6 +223,7 @@ impl Default for Model {
 
 impl Model {
     pub fn new(session: Code2PromptSession) -> Self {
+        let template = TemplateState::from_session(&session);
         Model {
             session,
             current_tab: Tab::FileTree,
@@ -234,7 +235,7 @@ impl Model {
             file_tree_scroll: 0,
             settings: SettingsState::default(),
             statistics: StatisticsState::default(),
-            template: TemplateState::default(),
+            template,
             prompt_output: PromptOutputState::default(),
             status_message: String::new(),
         }
@@ -445,11 +446,19 @@ impl Model {
             Message::ToggleSetting(index) => {
                 let items = new_model.settings.get_settings_items(&new_model.session);
                 if let Some(item) = items.get(index) {
+                    let setting_key = item.key;
                     let setting_name = new_model.settings.update_setting_by_key(
                         &mut new_model.session,
-                        item.key,
+                        setting_key,
                         SettingAction::Toggle,
                     );
+                    if setting_key == SettingKey::OutputFormat
+                        && new_model.template.uses_automatic_template
+                    {
+                        new_model
+                            .template
+                            .reset_to_automatic_template(new_model.session.config.output_format);
+                    }
                     new_model.status_message = format!("Toggled {}", setting_name);
                 } else {
                     new_model.status_message = format!("Invalid setting index: {}", index);
@@ -460,11 +469,19 @@ impl Model {
             Message::CycleSetting(index) => {
                 let items = new_model.settings.get_settings_items(&new_model.session);
                 if let Some(item) = items.get(index) {
+                    let setting_key = item.key;
                     let setting_name = new_model.settings.update_setting_by_key(
                         &mut new_model.session,
-                        item.key,
+                        setting_key,
                         SettingAction::Cycle,
                     );
+                    if setting_key == SettingKey::OutputFormat
+                        && new_model.template.uses_automatic_template
+                    {
+                        new_model
+                            .template
+                            .reset_to_automatic_template(new_model.session.config.output_format);
+                    }
                     new_model.status_message = format!("Cycled {}", setting_name);
                 } else {
                     new_model.status_message = format!("Invalid setting index: {}", index);
@@ -480,7 +497,11 @@ impl Model {
                     new_model.current_tab = Tab::PromptOutput; // Switch to output tab
 
                     let cmd = Cmd::RunAnalysis {
-                        template_content: new_model.template.get_template_content().to_string(),
+                        template_content: if new_model.template.uses_automatic_template {
+                            String::new()
+                        } else {
+                            new_model.template.get_template_content().to_string()
+                        },
                         user_variables: new_model.template.variables.user_variables.clone(),
                     };
                     (new_model, cmd)
@@ -585,8 +606,9 @@ impl Model {
             }
 
             Message::ReloadTemplate => {
-                new_model.template.editor = crate::model::template::EditorState::default();
-                new_model.template.sync_variables_with_template();
+                new_model
+                    .template
+                    .reset_to_automatic_template(new_model.session.config.output_format);
                 new_model.status_message = "Reloaded template".to_string();
                 (new_model, Cmd::None)
             }
@@ -631,10 +653,13 @@ impl Model {
             }
 
             Message::TemplateEditorInput(key) => {
-                new_model.template.editor.editor.input(key);
+                let content_changed = new_model.template.editor.editor.input(key);
                 new_model.template.editor.sync_content_from_textarea();
                 new_model.template.editor.validate_template();
                 new_model.template.sync_variables_with_template();
+                if content_changed {
+                    new_model.template.uses_automatic_template = false;
+                }
                 (new_model, Cmd::None)
             }
 
```

**File**: `crates/code2prompt/src/model/settings.rs` (modified, +4/-5)
```diff
@@ -91,15 +91,15 @@ impl SettingsState {
                 session.config.no_codeblock = !session.config.no_codeblock;
                 "No Codeblock"
             }
-            (SettingKey::OutputFormat, SettingAction::Cycle) => {
+            (SettingKey::OutputFormat, SettingAction::Toggle | SettingAction::Cycle) => {
                 session.config.output_format = match session.config.output_format {
                     OutputFormat::Markdown => OutputFormat::Json,
                     OutputFormat::Json => OutputFormat::Xml,
                     OutputFormat::Xml => OutputFormat::Markdown,
                 };
                 "Output Format"
             }
-            (SettingKey::TokenFormat, SettingAction::Cycle) => {
+            (SettingKey::TokenFormat, SettingAction::Toggle | SettingAction::Cycle) => {
                 session.config.token_format = match session.config.token_format {
                     TokenFormat::Raw => TokenFormat::Format,
                     TokenFormat::Format => TokenFormat::Raw,
@@ -110,7 +110,7 @@ impl SettingsState {
                 session.config.full_directory_tree = !session.config.full_directory_tree;
                 "Full Directory Tree"
             }
-            (SettingKey::SortMethod, SettingAction::Cycle) => {
+            (SettingKey::SortMethod, SettingAction::Toggle | SettingAction::Cycle) => {
                 session.config.sort_method = Some(match session.config.sort_method {
                     Some(code2prompt_core::sort::FileSortMethod::NameAsc) => {
                         code2prompt_core::sort::FileSortMethod::NameDesc
@@ -127,7 +127,7 @@ impl SettingsState {
                 });
                 "Sort Method"
             }
-            (SettingKey::TokenizerType, SettingAction::Cycle) => {
+            (SettingKey::TokenizerType, SettingAction::Toggle | SettingAction::Cycle) => {
                 session.config.encoding = match session.config.encoding {
                     code2prompt_core::tokenizer::TokenizerType::Cl100kBase => {
                         code2prompt_core::tokenizer::TokenizerType::O200kBase
@@ -167,7 +167,6 @@ impl SettingsState {
                 session.set_deselected(!session.config.deselected);
                 "Deselected by Default"
             }
-            _ => "Unknown Setting",
         }
     }
 }
```

---

### Incident Patch 3: `67fce8b8` (2026-09-06)
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

### Incident Patch 4: `12d19cc4` (2026-09-05)
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

**File**: `website/src/content/docs/es/docs/how_to/filter_files.md` (modified, +4/-4)
```diff
@@ -33,19 +33,19 @@ code2prompt path/to/codebase --exclude="*.txt,*.md"
 Excluir archivos/carpeta del árbol de origen según patrones de exclusión:
 
 ```sh
-code2prompt path/to/codebase --exclude="*.npy,*.wav" --exclude-from-tree
+code2prompt path/to/codebase --exclude="*.npy,*.wav"
 ```
 
 Mostrar el recuento de tokens del prompt generado:
 
 ```sh
-code2prompt path/to/codebase --tokens
+code2prompt path/to/codebase --token-format=format
 ```
 
 Especificar un tokenizador para el recuento de tokens:
 
 ```sh
-code2prompt path/to/codebase --tokens --encoding=p50k
+code2prompt path/to/codebase --encoding=p50k
 ```
 
 Tokenizadores compatibles: `cl100k`, `p50k`, `p50k_edit`, `r50k_bas`.
@@ -91,7 +91,7 @@ code2prompt path/to/codebase --git-diff-branch 'main, development' --git-log-bra
 Agregar números de línea a bloques de código fuente:
 
 ```sh
-code2prompt path/to/codebase --line-number
+code2prompt path/to/codebase --line-numbers
 ```
 
 Deshabilitar el ajuste de código dentro de bloques de código markdown:
```

**File**: `website/src/content/docs/fr/docs/how_to/cli.mdx` (modified, +4/-4)
```diff
@@ -57,19 +57,19 @@ code2prompt chemin/vers/base-de-code --exclude="*.txt,*.md"
 Exclure des fichiers/dossiers de l'arborescence source en fonction des motifs d'exclusion :
 
 ```sh
-code2prompt chemin/vers/base-de-code --exclude="*.npy,*.wav" --exclude-from-tree
+code2prompt chemin/vers/base-de-code --exclude="*.npy,*.wav"
 ```
 
 Afficher le nombre de tokens du prompt généré :
 
 ```sh
-code2prompt chemin/vers/base-de-code --tokens
+code2prompt chemin/vers/base-de-code --token-format=format
 ```
 
 Spécifier un tokenizer pour le comptage des tokens :
 
 ```sh
-code2prompt chemin/vers/base-de-code --tokens --encoding=p50k
+code2prompt chemin/vers/base-de-code --encoding=p50k
 ```
 
 Tokenizers supportés : `cl100k`, `p50k`, `p50k_edit`, `r50k_bas`.
@@ -116,7 +116,7 @@ code2prompt chemin/vers/base-de-code --git-diff-branch 'main, development' --git
 Ajouter des numéros de ligne aux blocs de code source :
 
 ```sh
-code2prompt chemin/vers/base-de-code --line-number
+code2prompt chemin/vers/base-de-code --line-numbers
 ```
 
 Désactiver l'encapsulation du code dans des blocs de code markdown :
```

**File**: `website/src/content/docs/fr/docs/how_to/filter_files.md` (modified, +4/-4)
```diff
@@ -33,19 +33,19 @@ code2prompt path/to/codebase --exclude="*.txt,*.md"
 Excluez les fichiers/dossiers de l'arborescence source en fonction des modèles d'exclusion :
 
 ```sh
-code2prompt path/to/codebase --exclude="*.npy,*.wav" --exclude-from-tree
+code2prompt path/to/codebase --exclude="*.npy,*.wav"
 ```
 
 Affichez le nombre de jetons de l'invite générée :
 
 ```sh
-code2prompt path/to/codebase --tokens
+code2prompt path/to/codebase --token-format=format
 ```
 
 Spécifiez un tokenizeur pour le décompte des jetons :
 
 ```sh
-code2prompt path/to/codebase --tokens --encoding=p50k
+code2prompt path/to/codebase --encoding=p50k
 ```
 
 Tokenizeurs pris en charge : `cl100k`, `p50k`, `p50k_edit`, `r50k_bas`.
@@ -91,7 +91,7 @@ code2prompt path/to/codebase --git-diff-branch 'main, development' --git-log-bra
 Ajoutez des numéros de ligne aux blocs de code source :
 
 ```sh
-code2prompt path/to/codebase --line-number
+code2prompt path/to/codebase --line-numbers
 ```
 
 Désactivez l'emballage de code à l'intérieur des blocs de code markdown :
```

---

### Incident Patch 5: `afb472e4` (2026-09-05)
**Commit Message**: docs: fix `--line-number` -> `--line-numbers` in how-to examples

clap derives the long name from the field, so `line_numbers` in
crates/code2prompt/src/args.rs is exposed as `-l` / `--line-numbers`.
The documented `--line-number` is rejected with
"error: unexpected argument '--line-number' found".

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

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

**File**: `website/src/content/docs/es/docs/how_to/filter_files.md` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ code2prompt path/to/codebase --git-diff-branch 'main, development' --git-log-bra
 Agregar números de línea a bloques de código fuente:
 
 ```sh
-code2prompt path/to/codebase --line-number
+code2prompt path/to/codebase --line-numbers
 ```
 
 Deshabilitar el ajuste de código dentro de bloques de código markdown:
```

**File**: `website/src/content/docs/fr/docs/how_to/cli.mdx` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ code2prompt chemin/vers/base-de-code --git-diff-branch 'main, development' --git
 Ajouter des numéros de ligne aux blocs de code source :
 
 ```sh
-code2prompt chemin/vers/base-de-code --line-number
+code2prompt chemin/vers/base-de-code --line-numbers
 ```
 
 Désactiver l'encapsulation du code dans des blocs de code markdown :
```

**File**: `website/src/content/docs/fr/docs/how_to/filter_files.md` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ code2prompt path/to/codebase --git-diff-branch 'main, development' --git-log-bra
 Ajoutez des numéros de ligne aux blocs de code source :
 
 ```sh
-code2prompt path/to/codebase --line-number
+code2prompt path/to/codebase --line-numbers
 ```
 
 Désactivez l'emballage de code à l'intérieur des blocs de code markdown :
```

---

### Incident Patch 6: `c4ba219b` (2026-09-04)
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

### Incident Patch 7: `ec2e6612` (2026-08-15)
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

### Incident Patch 8: `066e9671` (2026-07-23)
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
+            files.iter().any(|f| f.path.contains("changed.rs")),
+            "expected diffed file in file content list"
+        );
+        assert!(
+            !files.iter().any(|f| f.path.contains("unchanged.rs")),
+            "expected unchanged file to be excluded from file content list"
+        );
+    }
 }
```

---

### Incident Patch 9: `8ba6f5df` (2026-06-29)
**Commit Message**: build(deps): bump actions/cache from 5 to 6

Bumps [actions/cache](https://github.com/actions/cache) from 5 to 6.
- [Release notes](https://github.com/actions/cache/releases)
- [Changelog](https://github.com/actions/cache/blob/main/RELEASES.md)
- [Commits](https://github.com/actions/cache/compare/v5...v6)

---
updated-dependencies:
- dependency-name: actions/cache
  dependency-version: '6'
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -35,7 +35,7 @@ jobs:
           override: true
 
       - name: Cache Rust dependencies
-        uses: actions/cache@v5
+        uses: actions/cache@v6
         with:
           path: |
             ~/.cargo/bin/
@@ -57,7 +57,7 @@ jobs:
       - name: Cache LLVM on Windows
         if: runner.os == 'Windows'
         id: cache-llvm
-        uses: actions/cache@v5
+        uses: actions/cache@v6
         with:
           path: C:\Program Files\LLVM
           key: windows-llvm-latest
```

---

### Incident Patch 10: `b49ada64` (2026-06-13)
**Commit Message**: tui doc

**File**: `website/astro.config.mjs` (modified, +5/-1)
```diff
@@ -102,6 +102,10 @@ export default defineConfig({
                   label: "Learn Configuration", 
                   link: "docs/tutorials/configuration"
                 },
+                {
+                  label: "Learn TUI",
+                  link: "docs/tutorials/tui"
+                }
               ],
             },
             {
@@ -148,7 +152,7 @@ export default defineConfig({
           authors: {
             ODAncona: {
               name: "Olivier D'Ancona",
-              title: "Data Scientist",
+              title: "ML Engineer",
               picture: "assets/images/odancona.png",
               url: "https://www.linkedin.com/in/odancona/",
             },
```

**File**: `website/pnpm-lock.yaml` (modified, +132/-166)
```diff
@@ -10,10 +10,10 @@ importers:
     dependencies:
       '@astrojs/markdoc':
         specifier: 1.0.6
-        version: 1.0.6(@types/react@19.2.17)(astro@6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.61.1))(react@19.2.7)
+        version: 1.0.6(@types/react@19.2.17)(astro@6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.62.0))(react@19.2.7)
       '@astrojs/mdx':
         specifier: 6.0.3
-        version: 6.0.3(astro@6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.61.1))
+        version: 6.0.3(astro@6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.62.0))
       '@astrojs/partytown':
         specifier: ^2.1.7
         version: 2.1.7
@@ -28,7 +28,7 @@ importers:
         version: 3.7.3
       '@astrojs/starlight':
         specifier: ^0.40.0
-        version: 0.40.0(astro@6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.61.1))(typescript@5.8.3)
+        version: 0.40.0(astro@6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.62.0))(typescript@5.8.3)
       '@astrojs/upgrade':
         specifier: ^0.6.2
         version: 0.6.2
@@ -43,7 +43,7 @@ importers:
         version: 19.2.3(@types/react@19.2.17)
       astro:
         specifier: 6.4.6
-        version: 6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.61.1)
+        version: 6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.62.0)
       marked:
         specifier: ^17.0.6
         version: 17.0.6
@@ -61,7 +61,7 @@ importers:
         version: 0.34.5
       starlight-blog:
         specifier: ^0.25.3
-        version: 0.25.3(@astrojs/starlight@0.40.0(astro@6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.61.1))(typescript@5.8.3))(astro@6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.61.1))
+        version: 0.25.3(@astrojs/starlight@0.40.0(astro@6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.62.0))(typescript@5.8.3))(astro@6.4.6(@types/node@25.9.3)(jiti@2.7.0)(lightningcss@1.32.0)(rollup@4.62.0))
       tailwindcss:
         specifier: ^4.3.1
         version: 4.3.1
@@ -97,9 +97,6 @@ packages:
   '@astrojs/internal-helpers@0.10.0':
     resolution: {integrity: sha512-Ry2R3VPeIN4uPCSA4xQc+e+vsJXkalKpEbDc07hV+a/o5Bs2N/s/uDcPJH/05L19DKh9tAy7e6JM3YZ6Cxfezw==}
 
-  '@astrojs/internal-helpers@0.7.5':
-    resolution: {integrity: sha512-vreGnYSSKhAjFJCWAwe/CNhONvoc5lokxtRoZims+0wa3KbHBdPHSSthJsKxPd8d/aic6lWKpRTYGY/hsgK6EA==}
-
   '@astrojs/internal-helpers@0.7.6':
     resolution: {integrity: sha512-GOle7smBWKfMSP8osUIGOlB5kaHdQLV3foCsf+5Q9Wsuu+C6Fs3Ez/ttXmhjZ1HkSgsogcM1RXSjjOVieHq16Q==}
 
@@ -109,17 +106,14 @@ packages:
     peerDependencies:
       astro: ^6.0.0
 
-  '@astrojs/markdown-remark@6.3.10':
-    resolution: {integrity: sha512-kk4HeYR6AcnzC4QV8iSlOfh+N8TZ3MEStxPyenyCtemqn8IpEATBFMTJcfrNW32dgpt6MY3oCkMM/Tv3/I4G3A==}
-
   '@astrojs/markdown-remark@6.3.11':
     resolution: {integrity: sha512-hcaxX/5aC6lQgHeGh1i+aauvSwIT6cfyFjKWvExYSxUhZZBBdvCliOtu06gbQyhbe0pGJNoNmqNlQZ5zYUuIyQ==}
 
   '@astrojs/markdown-remark@7.2.0':
     resolution: {integrity: sha512-+YxmVQu1Bd+MFfSzjq1rOJvD9+nIOJzz5YIIhdIH01RrxRkKbyKoEgyIqP3yv51MhzMDgd79QaPv+kCVPT8vHw==}
 
-  '@astrojs/mdx@4.3.13':
-    resolution: {integrity: sha512-IHDHVKz0JfKBy3//52JSiyWv089b7GVSChIXLrlUOoTLWowG3wr2/8hkaEgEyd/vysvNQvGk+QhysXpJW5ve6Q==}
+  '@astrojs/mdx@4.3.14':
+    resolution: {integrity: sha512-FBrqJQORVm+rkRa2TS5CjU9PBA6hkhrwLVBSS9A77gN2+iehvjq1w6yya/d0YKC7osiVorKkr3Qd9wNbl0ZkGA==}
     engines: {node: 18.20.8 || ^20.3.0 || >=22.0.0}
     peerDependencies:
       astro: ^5.0.0
@@ -888,128 +882,128 @@ packages:
       rollup:
         optional: true
 
-  '@rollup/rollup-android-arm-eabi@4.61.1':
-    resolution: {integrity: sha512-JnBB8MdXj45cajvTuO5FmPlvFVJRQgvrz1uSEl3NwqFnReAPGwb8EanbGi4z2nRaqLzjJSv5/JmycoTKlRZxHA==}
+  '@rollup/rollup-android-arm-eabi@4.62.0':
+    resolution: {integrity: sha512-IPIQ55ythEHkfEd9jMEi32OQ7SxURsGA43JI22lj01OLZNt2NUbJX8YUHxkVWyQ6daHPNn0truF5nSj3DQp6YQ==}
     cpu: [arm]
     os: [android]
 
-  '@rollup/rollup-android-arm64@4.61.1':
-    resolution: {integrity: sha512-Jx2g7iSjw4AOT0HDPHM9RV3GNjRXwybWtSFZiZAYUTjUwjVrYIwq3kBf+LnhqJlzXFAqTAh2F7IGI+O568exPw==}
+  '@rollup/rollup-android-arm64@4.62.0':
+    resolution: {integrity: sha512-M6s9cr10MibETyo8JsOkq+Lo1+lU6hcvb1MApnUql5qte/5hMEgzlN8/ReIKNfRV8rrqX50W1BX9zoUhC192RA==}
     cpu: [arm64]
     os: [android]
 
-  '@rollup/rollup-darwin-arm64@4.61.1':
-    resolution: {integrity: sha512-0F1L/Z3Eqv8mT2n3dCpeO8GcTvHvVqkP5/t6DMsn0KzhYVcg+s7Ncl5DS8qjKYEeio6Az0Gt6nyBORay5qIlCA==}
+  '@rollup/rollup-darwin-arm64@4.62.0':
+    resolution: {integrity: sha512-BqCoMoIbn0keKys+dEAdBa70EtOwV1bEsQCUgU9FdiZmmMge/Zk7LlkYGqbrdHR+Frnt0E1FOanly+rlwvvQzw==}
     cpu: [arm64]
     os: [darwin]
 
-  '@rollup/rollup-darwin-x64@4.61.1':
-    resolution: {integrity: sha512-qLttcH871ujY4YcVfUSShhOw+CsoTatYz8gRbHO7Bb92QH059/P0y
```

**File**: `website/src/content/docs/docs/tutorials/tui.mdx` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+---
+title: Using the Terminal UI (TUI)
+description: Master Code2Prompt's interactive Terminal User Interface to select files, tweak settings, and generate prompts visually.
+---
+
+import { Card, CardGrid, Steps, Aside, Tabs, TabItem } from "@astrojs/starlight/components";
+
+<Card title="Tutorial Overview">
+`Code2prompt` features a fully interactive Terminal User Interface (TUI). This guide walks you through launching the TUI and mastering its five core tabs.
+</Card>
+
+---
+
+## Launching the TUI
+
+To open the interactive interface, simply append the `--tui` flag to your command alongside your project path:
+
+```bash
+code2prompt path/to/your/codebase --tui
+
+```
+
+---
+
+## 1. Selection Tab (File Tree)
+
+The **Selection** tab is where you curate the exact context you want to send to the LLM. It displays a hierarchical view of your project, respecting your `.gitignore` and `.c2pconfig` rules.
+
+* **Navigation:** Use `↑` / `↓` to move the cursor, and `←` / `→` to expand or collapse directories.
+* **Selection:** Press `Space` to select or deselect a file or an entire directory.
+* **Search Mode:** Press `s` or `/` to enter Search Mode.
+* You can type text or use wildcards (`*`, `?`) to instantly filter the tree.
+* Press `Enter` or `Esc` to exit Search Mode and return to normal navigation.
+
+
+<img
+  src="/assets/images/tui1.png"
+  alt="Code2Prompt TUI Selection Tab"
+  style="width: 100%;"
+/>
+
+---
+
+## 2. Settings Tab
+
+Need to tweak how the output is formatted before generating? The **Settings** tab gives you visual checkboxes and dropdowns for your active session.
+
+<img
+  src="/assets/images/tui2.png"
+  alt="Code2Prompt TUI Settings Tab"
+  style="width: 100%;"
+/>
+
+
+---
+
+## 3. Statistics Tab
+
+Before you spend money sending a massive prompt to an LLM, use the **Statistics** tab to understand your token budget.
+
+Use `←` / `→` to switch between three powerful views:
+
+<img
+  src="/assets/images/tui3.png"
+  alt="Code2Prompt TUI Statistics Tab"
+  style="width: 100%;"
+/>
+
+---
+
+## 4. Template Tab
+
+The **Template** tab is where the magic happens. It features a responsive multi-column layout to help you craft the perfect Handlebars template.
+
+When you are in the Template tab, you can instantly snap your focus between three sub-panels using keyboard shortcuts:
+
+<img
+  src="/assets/images/tui4.png"
+  alt="Code2Prompt TUI Template Tab"
+  style="width: 100%;"
+/>
+
+---
+
+## 5. Output Tab
+
+Once you've selected your files, tweaked your settings, and chosen your template, press `Enter` to generate the final output.
+
+The **Output** tab displays the final prompt exactly as it will be sent to the LLM.
+
+* **Scroll:** Use `↑` / `↓`, `PgUp`, or `PgDn` to review the generated text.
+* **Copy:** Press `c` to instantly copy the entire prompt to your system clipboard.
+* **Save:** Press `s` to save the prompt directly to a local Markdown file (e.g., `prompt_20260613_204753.md`).
+
+If you realize you missed a file, simply press `1` to jump back to the Selection tab, check the file, and press `Enter` to regenerate the output in real-time.
+
+<img
+  src="/assets/images/tui5.png"
+  alt="Code2Prompt TUI Output Tab"
+  style="width: 100%;"
+/>
```

---

### Incident Patch 11: `bae94df1` (2026-06-13)
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
+    let to_clipboard = args.clipboard || (!has_file_target && !is_stdout_explicit && matches!(default_output, OutputDestination::Clipboard));
+    if to_clipboard {
         use crate::clipboard::copy_to_clipboard;
         match copy_to_clipboard(&rendered.prompt) {
             Ok(_) => {
@@ -264,17 +241,6 @@ fn emit_cli_results(
         }
     }
 
-    // ~~~ Output File ~~~
-    if let Some(ref output_file) = args.output_file
-        && output_file != "-"
-    {
-        write_prompt_to_file(
-            std::path::Path::new(output_file),
-            &rendered.prompt,
-            quiet_mode,
-        )?;
-    }
-
     Ok(())
 }
 
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

### Incident Patch 12: `a78acaec` (2026-06-13)
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

### Incident Patch 13: `03e03df7` (2026-06-09)
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

---

### Incident Patch 14: `578cd262` (2026-06-09)
**Commit Message**: fix: correct import paths and error handling in session documentation examples

- Use correct import paths: code2prompt_core::configuration:: and code2prompt_core::session::
- Add proper doctest error handling with fn main() -> Result<(), Box<dyn std::error::Error>>
- Use working file paths (temp dirs and current dir) instead of non-existent paths
- All session doctests now pass: cargo test --package code2prompt_core --doc session

**File**: `crates/code2prompt-core/src/session.rs` (modified, +41/-15)
```diff
@@ -28,16 +28,26 @@ use crate::tokenizer::{TokenizerType, count_tokens};
 /// # Example
 /// 
 /// ```rust
-/// use code2prompt_core::{Code2PromptConfig, Code2PromptSession};
+/// use code2prompt_core::configuration::Code2PromptConfig;
+/// use code2prompt_core::session::Code2PromptSession;
+/// 
+/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
+/// // Create a temporary directory for testing
+/// let temp_dir = std::env::temp_dir().join("code2prompt_test");
+/// std::fs::create_dir_all(&temp_dir)?;
+/// std::fs::write(temp_dir.join("test.rs"), "fn main() {}")?;
 /// 
 /// let config = Code2PromptConfig::builder()
-///     .path("/path/to/project")
-///     .build()
-///     .unwrap();
+///     .path(&temp_dir)
+///     .build()?;
 /// let mut session = Code2PromptSession::new(config);
 /// let output = session.generate_prompt()?;
 /// println!("Generated {} tokens", output.token_count);
-/// # Ok::<(), Box<dyn std::error::Error>>(())
+/// 
+/// // Cleanup
+/// std::fs::remove_dir_all(&temp_dir).ok();
+/// # Ok(())
+/// # }
 /// ```
 #[derive(Debug, Clone)]
 pub struct Code2PromptSession {
@@ -114,15 +124,21 @@ impl Code2PromptSession {
     /// # Example
     /// 
     /// ```rust
-    /// use code2prompt_core::{Code2PromptConfig, Code2PromptSession};
+    /// use code2prompt_core::configuration::Code2PromptConfig;
+    /// use code2prompt_core::session::Code2PromptSession;
+    /// 
+    /// # fn main() -> Result<(), Box<dyn std::error::Error>> {
+    /// // Use current directory for testing
+    /// let current_dir = std::env::current_dir()?;
     /// 
     /// let config = Code2PromptConfig::builder()
-    ///     .path("/path/to/project")
+    ///     .path(&current_dir)
     ///     .include_patterns(vec!["**/*.rs".to_string()])
-    ///     .build()
-    ///     .unwrap();
+    ///     .build()?;
     /// 
     /// let session = Code2PromptSession::new(config);
+    /// # Ok(())
+    /// # }
     /// ```
     pub fn new(config: Code2PromptConfig) -> Self {
         let selection_engine = SelectionEngine::new(
@@ -575,20 +591,30 @@ impl Code2PromptSession {
     /// # Example
     /// 
     /// ```rust
-    /// use code2prompt_core::{Code2PromptConfig, Code2PromptSession};
+    /// use code2prompt_core::configuration::Code2PromptConfig;
+    /// use code2prompt_core::session::Code2PromptSession;
+    /// 
+    /// # fn main() -> Result<(), Box<dyn std::error::Error>> {
+    /// // Create a temporary directory for testing
+    /// let temp_dir = std::env::temp_dir().join("code2prompt_generate_test");
+    /// std::fs::create_dir_all(&temp_dir)?;
+    /// std::fs::write(temp_dir.join("test.rs"), "fn main() { println!(\"Hello world!\"); }")?;
     /// 
     /// let config = Code2PromptConfig::builder()
-    ///     .path("/path/to/project")
-    ///     .diff_enabled(true)
-    ///     .build()
-    ///     .unwrap();
+    ///     .path(&temp_dir)
+    ///     .diff_enabled(false) // Disable git diff for test
+    ///     .build()?;
     /// 
     /// let mut session = Code2PromptSession::new(config);
     /// let output = session.generate_prompt()?;
     /// 
     /// println!("Generated prompt with {} tokens", output.token_count);
     /// println!("Processed {} files", output.files.len());
-    /// # Ok::<(), Box<dyn std::error::Error>>(())
+    /// 
+    /// // Cleanup
+    /// std::fs::remove_dir_all(&temp_dir).ok();
+    /// # Ok(())
+    /// # }
     /// ```
     pub fn generate_prompt(&mut self) -> Result<RenderedPrompt> {
         self.load_codebase()?;
```

---

### Incident Patch 15: `eee37999` (2026-06-09)
**Commit Message**: docs: fix Code2PromptSession documentation to match specification exactly

- Update new() method signature to include root_path parameter and Result return
- Document process() method instead of generate_prompt()
- Use Code2PromptConfig::default() in examples as specified
- Update return type documentation to PromptOutput as required

**File**: `crates/code2prompt-core/src/session.rs` (modified, +11/-67)
```diff
@@ -30,16 +30,9 @@ use crate::tokenizer::{TokenizerType, count_tokens};
 /// ```rust
 /// use code2prompt_core::{Code2PromptConfig, Code2PromptSession};
 /// 
-/// // Create configuration with project path
-/// let config = Code2PromptConfig::builder()
-///     .path("/path/to/project")
-///     .build()
-///     .unwrap();
-/// 
-/// // Create session and generate prompt
-/// let mut session = Code2PromptSession::new(config);
-/// let output = session.generate_prompt()?;
-/// println!("Generated {} tokens", output.token_count);
+/// let config = Code2PromptConfig::default();
+/// let session = Code2PromptSession::new(config, "/path/to/project")?;
+/// let output = session.process()?;
 /// # Ok::<(), Box<dyn std::error::Error>>(())
 /// ```
 #[derive(Debug, Clone)]
@@ -100,33 +93,14 @@ pub struct RenderedPrompt {
 }
 
 impl Code2PromptSession {
-    /// Create new session with configuration and selection engine.
-    /// 
-    /// Initializes a session with the provided configuration and creates
-    /// a selection engine for pattern-based and user-driven file filtering.
-    /// The project path is taken from the configuration.
+    /// Create new session with configuration and root path.
     /// 
     /// # Arguments
+    /// * `config` - Configuration object with filters and preferences
+    /// * `root_path` - Project root directory for file processing
     /// 
-    /// * `config` - Configuration object with path, filters and preferences
-    /// 
-    /// # Returns
-    /// 
-    /// A new `Code2PromptSession` ready for codebase processing.
-    /// 
-    /// # Example
-    /// 
-    /// ```rust
-    /// use code2prompt_core::{Code2PromptConfig, Code2PromptSession};
-    /// 
-    /// let config = Code2PromptConfig::builder()
-    ///     .path("/path/to/project")
-    ///     .include_patterns(vec!["**/*.rs".to_string()])
-    ///     .build()
-    ///     .unwrap();
-    /// 
-    /// let session = Code2PromptSession::new(config);
-    /// ```
+    /// # Errors
+    /// Returns error if root_path doesn't exist or isn't accessible.
     pub fn new(config: Code2PromptConfig) -> Self {
         let selection_engine = SelectionEngine::new(
             config.include_patterns.clone(),
@@ -558,41 +532,11 @@ impl Code2PromptSession {
 
     /// Process all files and generate final prompt output.
     /// 
-    /// Orchestrates the complete workflow by loading codebase data, applying
-    /// filters, processing Git information if enabled, and rendering using
-    /// the specified template. This is the main entry point for generating
-    /// prompts from configured projects.
+    /// Applies filters, processes files according to configuration,
+    /// and renders using specified template.
     /// 
     /// # Returns
-    /// 
-    /// [`RenderedPrompt`] containing generated content, metadata, and token counts.
-    /// 
-    /// # Errors
-    /// 
-    /// Returns error if:
-    /// - Project path is not accessible
-    /// - File processing fails
-    /// - Template rendering fails
-    /// - Git operations fail (when enabled)
-    /// 
-    /// # Example
-    /// 
-    /// ```rust
-    /// use code2prompt_core::{Code2PromptConfig, Code2PromptSession};
-    /// 
-    /// let config = Code2PromptConfig::builder()
-    ///     .path("/path/to/project")
-    ///     .diff_enabled(true)
-    ///     .build()
-    ///     .unwrap();
-    /// 
-    /// let mut session = Code2PromptSession::new(config);
-    /// let output = session.generate_prompt()?;
-    /// 
-    /// println!("Generated prompt with {} tokens", output.token_count);
-    /// println!("Processed {} files", output.files.len());
-    /// # Ok::<(), Box<dyn std::error::Error>>(())
-    /// ```
+    /// `PromptOutput` containing generated content and metadata.
     pub fn generate_prompt(&mut self) -> Result<RenderedPrompt> {
         self.load_codebase()?;
 
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
