# Forensic Learning Record (Deep Inspection): sentrux/sentrux

> **Canonical Artifact**: `07_PROJECT_LEARNING/sentrux-sentrux-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sentrux/sentrux](https://github.com/sentrux/sentrux))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:40:35.389Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sentrux/sentrux`
- **Description**: Real-time architectural sensor that helps AI agents close the feedback loop, enabling recursive self-improvement of code quality. Pure Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3301 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `sentrux-bin/src/lib.rs`
```
//! Sentrux binary library — allows sentrux-pro to reuse the entire CLI/GUI.
//!
//! Architecture: sentrux-pro depends on sentrux_bin and calls `sentrux_bin::run()`.
//! The only difference: sentrux-pro calls `license::set_tier(Pro)` before `run()`.

mod main_impl;
pub use main_impl::run;

```

### Core Architecture Module: `sentrux-bin/src/main.rs`
```
fn main() -> eframe::Result<()> {
    sentrux_bin::run()
}

```

### Core Architecture Module: `sentrux-bin/src/main_impl.rs`
```
//! Sentrux binary — GUI, CLI, and MCP entry points.
//!
//! All logic lives in `sentrux-core`. This crate is just the entry point
//! that wires together the three modes:
//! - GUI mode (default): interactive treemap/blueprint visualizer
//! - MCP mode (`sentrux mcp`): Model Context Protocol server for AI agent integration
//! - Check mode (`sentrux check [path]`): CLI architectural rules enforcement
//! - Gate mode (`sentrux gate [--save] [path]`): structural regression testing

use clap::{Parser, Subcommand};
use sentrux_core::analysis;
use sentrux_core::app;
use sentrux_core::core;
use sentrux_core::metrics;

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

fn edition_name() -> &'static str {
    let tier = sentrux_core::license::current_tier();
    if tier >= sentrux_core::license::Tier::Pro {
        "Pro"
    } else {
        ""            // Don't show "Free" or "Community" — just "sentrux"
    }
}

fn version_string() -> &'static str {
    use std::sync::OnceLock;
    static VERSION: OnceLock<String> = OnceLock::new();
    VERSION.get_or_init(|| {
        let edition = edition_name();
        let base = if edition.is_empty() {
            env!("CARGO_PKG_VERSION").to_string()
        } else {
            format!("{} ({})", env!("CARGO_PKG_VERSION"), edition)
        };
        if let Some(latest) = sentrux_core::app::update_check::available_update() {
            format!("{}\n  Update available: v{} → brew upgrade sentrux", base, latest)
        } else {
            base
        }
    })
}

#[derive(Parser)]
#[command(
    name = "sentrux",
    about = "Live codebase visualization and structural quality gate",
    version = version_string(),
    arg_required_else_help = false,
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    /// Directory to open in the GUI
    #[arg(global = false)]
    path: Option<String>,

    /// Start MCP server (hidden alias for `sentrux mcp`)
    #[arg(long = "mcp", hide = true)]
    mcp_flag: bool,
}

#[derive(Subcommand)]
enum Command {
    /// Enforce architectural rules defined in .sentrux/rules.toml
    Check {
        /// Directory to check
        #[arg(default_value = ".")]
        path: String,
    },

    /// Structural regression gate — compare against a saved baseline
    Gate {
        /// Save current metrics as the new baseline
        #[arg(long)]
        save: bool,

        /// Directory to gate
        #[arg(default_value = ".")]
        path: String,
    },

    /// Open the GUI with a pre-loaded directory
    Scan {
        /// Directory to visualize
        path: Option<String>,
    },

    /// Start the MCP (Model Context Protocol) server for AI agent integration
    Mcp,

    /// Manage language plugins
    Plugin {
        #[command(subcommand)]
        action: PluginAction,
    },

    /// Control anonymous aggregate usage analytics
    Analytics {
        #[command(subcommand)]
        action: Option<AnalyticsAction>,
    },

    /// Open browser to purchase / sign in for Sentrux Pro
    Login,

    /// Manage Pro license and plugin
    Pro {
        #[command(subcommand)]
        action: ProAction,
    },
}

#[derive(Subcommand)]
enum ProAction {
    /// Activate Pro with a license key
    Activate {
        /// License key JSON string or path to key file
        key: String,
    },
    /// Show Pro license status
    Status,
    /// Deactivate Pro (remove license + plugin)
    Deactivate,
    /// Update Pro plugin to latest version
    Update,
}

#[derive(Subcommand)]
enum AnalyticsAction {
    /// Turn analytics on
    On,
    /// Turn analytics off
    Off,
}

#[derive(Subcommand)]
enum PluginAction {
    /// List installed plugins
    List,

    /// Install all standard language plugins
    AddStandard,

    /// Install a single language plugin from the plugin registry
    Add {
        /// Plugin name (e.g. "python", "rust")
        name: String,
    },

    /// Remove an installed plugin
    Remove {
        /// Plugin name to remove
        name: String,
    },

    /// Create a new plugin template
    Init {
        /// Language name for the new plugin
        name: String,
    },

    /// Validate a plugin directory
    Validate {
        /// Path to the plugin directory
        dir: String,
    },
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

pub fn run() -> eframe::Result<()> {
    // Initialize license + Pro plugin (reads ~/.sentrux/license.key, loads pro.dylib if valid)
    sentrux_core::license::init();

    // Step 1: Download missing grammar binaries (may overwrite configs with old versions)
    ensure_grammars_installed();

    // Step 2: Sync embedded plugin configs LAST — always wins over downloaded configs.
    // This ensures configs match the binary version even if the grammar tarball
    // included old plugin.toml/tags.scm files.
    sentrux_core::analysis::plugin::sync_embedded_plugins();

    // Non-blocking update check (once per day, background thread)
    app::update_check::check_for_updates_async(env!("CARGO_PKG_VERSION"));

    let cli = Cli::parse();

    // Hidden --mcp flag for backward compat with MCP client configs
    if cli.mcp_flag {
        app::mcp_server::run_mcp_server(None);
        return Ok(());
    }

    match cli.command {
        Some(Command::Check { path }) => {
            std::process::exit(run_check(&path));
        }
        Some(Command::Gate { save, path }) => {
            std::process::exit(run_gate(&path, save));
        }
        Some(Command::Mcp) => {
            app::mcp_server::run_mcp_server(None);
            Ok(())
        }
        Some(Command::Plugin { action }) => {
            run_plugin(action);
            Ok(())
        }
        Some(Command::Analytics { action }) => {
            run_analytics(action);
            Ok(())
        }
        Some(Command::Login) => {
            run_login();
            Ok(())
        }
        Some(Command::Pro { action }) => {
            run_pro(action);
            Ok(())
        }
        Some(Command::Scan { path }) => {
            run_gui(path)
        }
        None => {
            run_gui(cli.path)
        }
    }
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

fn analytics_opt_out_path() -> Option<std::path::PathBuf> {
    sentrux_core::analysis::plugin::plugins_dir()
        .map(|d| d.parent().unwrap().join("telemetry_opt_out"))
}

fn run_login() {
    println!();
    println!("  Sentrux Pro — purchase at https://sentrux.dev/pro");
    println!();
    println!("  After purchase, activate with:");
    println!("    sentrux pro activate <license-key>");
    println!();
    println!("  Or paste your license key file:");
    println!("    sentrux pro activate /path/to/license.key");
    println!();
    // Try to open the browser
    let _ = open_url("https://sentrux.dev/pro");
}

fn open_url(url: &str) {
    #[cfg(target_os = "macos")]
    { let _ = std::process::Command::new("open").arg(url).spawn(); }
    #[cfg(target_os = "linux")]
    { let _ = std::process::Command::new("xdg-open").arg(url).spawn(); }
    #[cfg(target_os = "windows")]
    { let _ = std::process::Command::new("cmd").args(["/c", "start", url]).spawn(); }
}

fn run_pro(action: ProAction) {
    match action {
        ProAction::Activate { key } => pro_activate(&key),
        ProAction::Status => pro_status(),
        ProAction::Deactivate => pro_deactivate(),
        ProAction::Update => pro_update(),
    }
}

fn pro_activate(key_input: 
```

### Core Architecture Module: `sentrux-core/src/analysis/entry_points.rs`
```
//! Entry-point detection and execution depth computation.
//!
//! Detects application entry points (main functions, HTTP handlers, CLI commands)
//! by inspecting file names, function signatures, and language conventions.
//! Computes execution depth via BFS over the import graph from entry points.

use super::lang_registry;
use crate::core::types::{EntryPoint, FileNode, ImportEdge};
use std::collections::{BTreeSet, HashMap, VecDeque};

/// BFS from entry points over the import graph to compute execution depth.
/// Uses BTreeSet for deterministic BFS order.
pub(crate) fn compute_exec_depth(
    import_edges: &[ImportEdge],
    entry_points: &[EntryPoint],
) -> HashMap<String, u32> {
    let mut exec_depth: HashMap<String, u32> = HashMap::new();
    let import_adjacency: HashMap<String, Vec<String>> = {
        let mut adj: HashMap<String, Vec<String>> = HashMap::new();
        for edge in import_edges {
            adj.entry(edge.from_file.clone())
                .or_default()
                .push(edge.to_file.clone());
        }
        adj
    };

    let entry_files: BTreeSet<String> = entry_points.iter().map(|e| e.file.clone()).collect();
    let mut queue: VecDeque<(String, u32)> =
        entry_files.iter().map(|f| (f.clone(), 0)).collect();

    for f in &entry_files {
        exec_depth.insert(f.clone(), 0);
    }

    while let Some((file, depth)) = queue.pop_front() {
        if let Some(deps) = import_adjacency.get(&file) {
            for dep in deps {
                if !exec_depth.contains_key(dep) {
                    exec_depth.insert(dep.clone(), depth + 1);
                    queue.push_back((dep.clone(), depth + 1));
                }
            }
        }
    }

    exec_depth
}

/// Whether a language can contain executable entry points.
/// Reads `is_executable` from the language profile (Layer 2).
/// Non-executable languages (html, css, scss, markdown, etc.) return false.
/// Unknown languages are conservatively allowed (may have entry points).
fn can_have_entry_points(lang: &str) -> bool {
    lang_registry::profile(lang).semantics.is_executable
}

/// Detect if a file is an entry point
pub(crate) fn detect_entry_points(file: &FileNode) -> Vec<EntryPoint> {
    if is_non_production_path(&file.path) {
        return Vec::new();
    }

    // Skip files whose language cannot have entry points (CSS, HTML, etc.)
    if !can_have_entry_points(&file.lang) {
        return Vec::new();
    }

    let mut entries = Vec::new();

    if is_main_entry_by_name(file) {
        entries.push(make_entry(file, "main"));
    }

    collect_sa_entry_points(file, &mut entries);

    entries
}

/// Returns true for test/example/benchmark/fixture/vendor directories.
fn is_non_production_path(path: &str) -> bool {
    let p = path.to_lowercase();
    const PREFIXES: &[&str] = &[
        "test/", "tests/", "test_",
        "example/", "examples/",
        "bench/", "benches/",
        "fixtures/", "vendor/",
    ];
    const INFIXES: &[&str] = &[
        "/test/", "/tests/",
        "/example/", "/examples/",
        "/bench/", "/benches/",
        "/fixtures/", "/vendor/",
    ];
    PREFIXES.iter().any(|pfx| p.starts_with(pfx))
        || INFIXES.iter().any(|inf| p.contains(inf))
}

/// Check if the file name matches a known main/app/server entry point pattern.
/// Uses `lang_registry::detect_lang_from_ext` for `main.*` files so that newly
/// registered languages (e.g., zig, elixir, haskell, scala) are automatically
/// recognized without maintaining a hardcoded extension list here.
fn is_main_entry_by_name(file: &FileNode) -> bool {
    let name_lower = file.name.to_lowercase();
    let path_depth = file.path.matches('/').count();
    // Check if this is a package index file (index.ts, index.js, __init__.py, etc.)
    // near the project root — these are entry points at depth <= 1.
    let profile = lang_registry::profile(&file.lang);
    if profile.is_package_index_file(&file.path) && path_depth <= 1 {
        return true;
    }
    if name_lower.starts_with("main.") {
        // Use lang_registry to check if the extension belongs to a recognized
        // programming language, rather than maintaining a hardcoded list of every
        // `main.*` variant. This automatically supports new languages added to the
        // registry (e.g., main.zig, main.ex, main.hs, main.scala) without needing
        // to update this function.
        if let Some(ext) = name_lower.strip_prefix("main.") {
            let detected = lang_registry::detect_lang_from_ext(ext);
            return detected != "unknown" && can_have_entry_points(&detected);
        }
        return false;
    }
    // Check language profile for main filenames (from plugin.toml)
    let profile = lang_registry::profile(&file.lang);
    if !profile.semantics.main_filenames.is_empty() {
        return path_depth <= 2
            && profile.semantics.main_filenames.iter().any(|mf| name_lower == mf.to_lowercase());
    }
    false
}

/// Check if an entry point with the given func name already exists for this file.
fn has_entry(entries: &[EntryPoint], file_path: &str, func: &str) -> bool {
    entries.iter().any(|e| e.file == file_path && e.func == func)
}

/// Add entry point if not already present.
fn add_entry_if_new(file: &FileNode, func: &str, entries: &mut Vec<EntryPoint>) {
    if !has_entry(entries, &file.path, func) {
        entries.push(make_entry(file, func));
    }
}

/// Collect entry points from structural analysis tags and functions.
fn collect_sa_entry_points(file: &FileNode, entries: &mut Vec<EntryPoint>) {
    let sa = match &file.sa {
        Some(sa) => sa,
        None => return,
    };

    if let Some(sa_tags) = &sa.tags {
        for tag in sa_tags {
            add_entry_if_new(file, tag, entries);
        }
    }

    if let Some(fns) = &sa.functions {
        if fns.iter().any(|f| f.n == "main") {
            add_entry_if_new(file, "main", entries);
        }
    }
}

fn make_entry(file: &FileNode, func: &str) -> EntryPoint {
    EntryPoint {
        file: file.path.clone(),
        func: func.to_string(),
        lang: file.lang.clone(),
        confidence: "high".to_string(),
    }
}

```

### Core Architecture Module: `sentrux-core/src/analysis/git.rs`
```
//! Git status integration — retrieves per-file git status with TTL caching.
//!
//! Uses `git2` (libgit2 bindings) for efficient status queries. Results are
//! cached for 2 seconds to avoid expensive git operations on every frame.
//! Supports both index and workdir status detection.
//!
//! Cache invalidation: TTL-based (2 seconds). This balances freshness against
//! cost — git2 status queries touch every tracked file in the working directory.
//! The cache is cleared entirely on directory switch to prevent cross-project
//! status leakage.

use dashmap::DashMap;
use git2::{Repository, StatusOptions, StatusShow};
use std::collections::HashMap;
use std::path::Path;
use std::sync::LazyLock;
use std::time::Instant;

/// Cached git statuses: root_path -> (timestamp, statuses)
/// TTL-based invalidation: re-fetch if older than 2 seconds
/// Cached git status entry: (timestamp, file_path -> status_string).
type GitStatusEntry = (Instant, HashMap<String, String>);

static STATUS_CACHE: LazyLock<DashMap<String, GitStatusEntry>> =
    LazyLock::new(DashMap::new);

const STATUS_CACHE_TTL_MS: u128 = 2000;

/// Clear all cached git statuses — called on directory switch to prevent
/// stale entries from a previous project persisting. [ref:93cf32d4]
pub fn clear_cache() {
    STATUS_CACHE.clear();
}

/// Get git status for all files in a repo. Returns map of relative_path -> status_string.
/// Results are cached with a 2-second TTL to avoid repeated expensive git operations.
pub fn get_statuses(root: &str) -> HashMap<String, String> {
    // Check cache first
    if let Some(cached) = STATUS_CACHE.get(root) {
        if cached.0.elapsed().as_millis() < STATUS_CACHE_TTL_MS {
            return cached.1.clone();
        }
    }

    let result = fetch_statuses(root);

    // Evict stale entries (older than 60s) to prevent unbounded memory growth
    const MAX_CACHE_AGE_MS: u128 = 60_000;
    STATUS_CACHE.retain(|_, v| v.0.elapsed().as_millis() < MAX_CACHE_AGE_MS);

    // Always cache the result (including empty = clean repo). Previously only
    // non-empty results were cached, causing clean repos to trigger a full
    // `git status` on every call instead of using the 2-second TTL cache.
    // Note: fetch_statuses returns empty HashMap for BOTH clean repos and git
    // failures, but failures already log via eprintln and the 2s TTL limits
    // retry frequency regardless.
    STATUS_CACHE.insert(root.to_string(), (Instant::now(), result.clone()));

    result
}

/// Check if the status represents a new/added file.
fn is_new(status: git2::Status) -> bool {
    status.is_index_new() || status.is_wt_new()
}

/// Check if the status represents a deleted file.
fn is_deleted(status: git2::Status) -> bool {
    status.is_index_deleted() || status.is_wt_deleted()
}

/// Check if the status represents a renamed file.
fn is_renamed(status: git2::Status) -> bool {
    status.is_index_renamed() || status.is_wt_renamed()
}

/// Map a git2 Status bitflags to a short string code.
/// Returns None for ignored entries (caller should skip).
fn status_to_code(status: git2::Status) -> Option<&'static str> {
    if is_new(status) {
        Some("A")
    } else if is_deleted(status) {
        Some("D")
    } else if is_renamed(status) {
        Some("R")
    } else if status.is_index_modified() && status.is_wt_modified() {
        Some("MM")
    } else if status.is_index_modified() || status.is_wt_modified() {
        Some("M")
    } else if status.is_ignored() {
        None
    } else {
        Some("?")
    }
}

fn fetch_statuses(root: &str) -> HashMap<String, String> {
    let mut result = HashMap::new();

    let repo = match Repository::discover(root) {
        Ok(r) => r,
        Err(e) => {
            crate::debug_log!("[sentrux:git] fetch_statuses discover failed: {}", e);
            return result;
        }
    };

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .show(StatusShow::IndexAndWorkdir);

    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(s) => s,
        Err(e) => {
            crate::debug_log!("[sentrux:git] fetch_statuses statuses failed: {}", e);
            return result;
        }
    };

    // Bare repos have no workdir — return empty result immediately
    let workdir = match repo.workdir() {
        Some(w) => w,
        None => return result, // bare repo: no working directory
    };
    let root_path = Path::new(root);

    collect_status_entries(&statuses, workdir, root_path, &mut result);

    result
}

/// Iterate git status entries, map each to a code, and insert scan-root-relative paths.
fn collect_status_entries(
    statuses: &git2::Statuses<'_>,
    workdir: &Path,
    root_path: &Path,
    result: &mut HashMap<String, String>,
) {
    for entry in statuses.iter() {
        if let Some(path) = entry.path() {
            let code = match status_to_code(entry.status()) {
                Some(c) => c,
                None => continue,
            };

            let full = workdir.join(path);
            // Convert to scan-root-relative path. If strip_prefix fails
            // (scan root is outside git workdir), skip this entry rather
            // than inserting a workdir-relative path that won't match
            // any file in the scan. [ref:93cf32d4]
            if let Ok(rel) = full.strip_prefix(root_path) {
                result.insert(rel.to_string_lossy().to_string(), code.to_string());
            }
        }
    }
}


```

### Core Architecture Module: `sentrux-core/src/analysis/graph/mod.rs`
```
//! Cross-file graph construction — import, call, and inheritance edges.
//!
//! Takes a flat list of parsed `FileNode` references and builds three
//! dependency graphs plus entry-point detection and execution depth.
//! Import resolution uses oxc_resolver for JS/TS and suffix-index for others.

use super::entry_points::{compute_exec_depth, detect_entry_points};
use super::resolver::suffix::resolve_path_imports_ref;
use crate::core::types::{CallEdge, EntryPoint, FileNode, ImportEdge, InheritEdge};
use rayon::prelude::*;
use std::collections::{HashMap, HashSet};
use std::path::Path;

/// Interface for building cross-file dependency graphs from parsed file nodes.
/// Enables alternative implementations for testing or incremental graph updates.
pub trait GraphBuilder {
    /// Build all dependency graphs from a set of parsed files.
    fn build(&self, files: &[&FileNode], scan_root: Option<&Path>, max_call_targets: usize) -> GraphResult;
}

/// Result of `build_graphs`: all three dependency graphs plus entry points.
/// Replaces the fragile 5-tuple return type with named fields.
pub struct GraphResult {
    /// File-to-file import edges (resolved from import/require statements)
    pub import_edges: Vec<ImportEdge>,
    /// Function-to-function call edges (restricted to imported files)
    pub call_edges: Vec<CallEdge>,
    /// Class inheritance edges (child extends/implements parent)
    pub inherit_edges: Vec<InheritEdge>,
    /// Detected application entry points (main, handlers, CLI commands)
    pub entry_points: Vec<EntryPoint>,
    /// BFS distance from entry points (0 = entry point, higher = deeper)
    pub exec_depth: HashMap<String, u32>,
}

/// Build cross-file graphs from a flat list of file references with structural analysis.
/// Zero-copy: accepts `&[&FileNode]` from `flatten_files_ref` to avoid cloning the tree.
///
/// Import edges come from two tiers:
///   Tier 1: oxc_resolver for JS/TS (sync, <100ms)
///   Tier 2: suffix-index + file-path join for everything else (sync, <10ms)
///
/// `scan_root` enables path resolution. Without it, no import edges are produced.
pub fn build_graphs(
    files: &[&FileNode],
    scan_root: Option<&Path>,
    max_call_targets: usize,
) -> GraphResult {
    let t0 = std::time::Instant::now();

    let (lang_map, func_map, class_map) = build_lookup_maps(files);
    let t_maps = t0.elapsed();

    let mut import_edges = resolve_path_imports_ref(files, scan_root);
    let t_imports = t0.elapsed();

    // Dedup BEFORE building target index to avoid wasted allocations
    dedup_import_edges(&mut import_edges);

    let import_targets = build_import_target_index(&import_edges);
    let call_edges = compute_call_edges(files, &lang_map, &func_map, &class_map, &import_targets, max_call_targets);
    let inherit_edges = compute_inherit_edges(files, &lang_map, &class_map, &import_targets);
    let entry_points = collect_entry_points(files);
    let exec_depth = compute_exec_depth(&import_edges, &entry_points);

    log_build_graphs_timing(files.len(), &t0, t_maps, t_imports, &import_edges, &call_edges, &inherit_edges);

    GraphResult { import_edges, call_edges, inherit_edges, entry_points, exec_depth }
}

/// Build lookup maps for language, functions, and classes from file nodes.
/// Zero-copy: borrows from the files slice which outlives these maps.
/// Lookup maps: (lang_map, func_map, class_map).
type LookupMaps<'a> = (HashMap<&'a str, &'a str>, HashMap<&'a str, Vec<&'a str>>, HashMap<&'a str, Vec<&'a str>>);

/// Index functions and classes from a file's structural analysis into lookup maps.
fn index_file_symbols<'a>(
    file: &'a FileNode,
    func_map: &mut HashMap<&'a str, Vec<&'a str>>,
    class_map: &mut HashMap<&'a str, Vec<&'a str>>,
) {
    let sa = match &file.sa {
        Some(sa) => sa,
        None => return,
    };
    if let Some(fns) = &sa.functions {
        for f in fns {
            func_map.entry(f.n.as_str()).or_default().push(&file.path);
        }
    }
    if let Some(classes) = &sa.cls {
        for c in classes {
            class_map.entry(c.n.as_str()).or_default().push(&file.path);
        }
    }
}

fn build_lookup_maps<'a>(
    files: &[&'a FileNode],
) -> LookupMaps<'a> {
    let mut lang_map: HashMap<&str, &str> = HashMap::new();
    let mut func_map: HashMap<&str, Vec<&str>> = HashMap::new();
    let mut class_map: HashMap<&str, Vec<&str>> = HashMap::new();

    for file in files {
        if file.is_dir {
            continue;
        }
        lang_map.insert(&file.path, &file.lang);
        index_file_symbols(file, &mut func_map, &mut class_map);
    }
    (lang_map, func_map, class_map)
}

/// Build a from_file → {to_file} index from import edges.
fn build_import_target_index(import_edges: &[ImportEdge]) -> HashMap<&str, HashSet<&str>> {
    let mut m: HashMap<&str, HashSet<&str>> = HashMap::new();
    for edge in import_edges {
        m.entry(edge.from_file.as_str())
            .or_default()
            .insert(edge.to_file.as_str());
    }
    m
}

/// Dedup import edges: two specifiers can resolve to the same target. [ref:daa66d13]
fn dedup_import_edges(import_edges: &mut Vec<ImportEdge>) {
    let mut seen: HashSet<(&str, &str)> = HashSet::with_capacity(import_edges.len());
    // Safety: we borrow from `import_edges` elements which are not moved/dropped by `retain`
    // until after the `seen` set is done being used. We use raw pointers to work around
    // the borrow checker since `retain` takes `&mut self` but we need shared refs to elements.
    // Instead, use a two-pass approach: mark indices to keep, then retain.
    let mut keep = vec![false; import_edges.len()];
    for (i, e) in import_edges.iter().enumerate() {
        if seen.insert((e.from_file.as_str(), e.to_file.as_str())) {
            keep[i] = true;
        }
    }
    let mut idx = 0;
    import_edges.retain(|_| {
        let k = keep[idx];
        idx += 1;
        k
    });
}

/// Detect entry points across all non-directory files.
fn collect_entry_points(files: &[&FileNode]) -> Vec<EntryPoint> {
    let mut entry_points = Vec::new();
    for &file in files {
        if !file.is_dir {
            entry_points.extend(detect_entry_points(file));
        }
    }
    entry_points
}

/// Log timing breakdown for build_graphs.
fn log_build_graphs_timing(
    file_count: usize,
    t0: &std::time::Instant,
    t_maps: std::time::Duration,
    t_imports: std::time::Duration,
    import_edges: &[ImportEdge],
    call_edges: &[CallEdge],
    inherit_edges: &[InheritEdge],
) {
    let t_total = t0.elapsed();
    eprintln!(
        "[build_graphs] {} files | maps {:.1}ms, imports {:.1}ms, calls+inherit {:.1}ms, total {:.1}ms | {} import, {} call, {} inherit edges",
        file_count,
        t_maps.as_secs_f64() * 1000.0,
        (t_imports - t_maps).as_secs_f64() * 1000.0,
        (t_total - t_imports).as_secs_f64() * 1000.0,
        t_total.as_secs_f64() * 1000.0,
        import_edges.len(),
        call_edges.len(),
        inherit_edges.len(),
    );
}

/// Resolve a single call to target files, filtering by language and import relationship.
fn resolve_call_targets<'a>(
    call_name: &str,
    file_path: &str,
    src_lang: &str,
    func_map: &HashMap<&'a str, Vec<&'a str>>,
    lang_map: &HashMap<&'a str, &'a str>,
    imported_files: Option<&HashSet<&'a str>>,
    max_call_targets: usize,
    implicit_module: bool,
) -> Vec<&'a str> {
    let targets = match func_map.get(call_name) {
        Some(t) => t,
        None => return Vec::new(),
    };
    let same_lang: Vec<&str> = targets
        .iter()
        .filter(|t| {
            **t != file_path
                && lang_map.get(*t).copied().unwrap_or("") == src_lang
                && (implicit_module || imported_files.is_some_and(|imp| imp.contains(*t)))
        })
        .copied()
        .collect();
    if same_lang.len() <= max_call_targets { same_lang } else { Vec::new() }
}

/// Compute call edges between files connected by import
```

### Core Architecture Module: `sentrux-core/src/analysis/lang_registry.rs`
```
//! Language registry — maps file extensions to tree-sitter grammars and queries.
//!
//! All languages are loaded as runtime plugins from ~/.sentrux/plugins/.
//! No grammars are compiled into the binary. This keeps the binary small (~5MB)
//! and allows anyone to add language support without recompilation.

use crate::analysis::plugin::profile::{LanguageProfile, DEFAULT_PROFILE};
use std::collections::HashMap;
use tree_sitter::{Language, Query};

/// Configuration for a runtime-loaded language plugin.
pub struct PluginLangConfig {
    /// Language name (owned)
    pub name: String,
    /// Plugin version from plugin.toml
    pub version: String,
    /// Compiled tree-sitter grammar (loaded from .so/.dylib)
    pub grammar: Language,
    /// Compiled tree-sitter query for structural extraction
    pub query: Query,
    /// File extensions (owned)
    pub extensions: Vec<String>,
    /// Layer 2: language profile (semantics + thresholds from plugin.toml)
    pub profile: LanguageProfile,
}

/// Central registry mapping language names and file extensions to loaded plugins.
pub struct LangRegistry {
    by_name: HashMap<String, usize>,
    by_ext: HashMap<String, usize>,
    configs: Vec<PluginLangConfig>,
    /// Plugins that failed to load (logged, not fatal).
    failed: Vec<String>,
    /// Extension → language name for ALL known plugins (including those without grammars).
    /// Used for display-only language detection (file counting, coloring).
    ext_display: HashMap<String, String>,
    /// Filename → language name for extensionless files (Dockerfile, Makefile, etc.).
    /// Populated from plugin.toml `filenames` field.
    filename_map: HashMap<String, String>,
    /// Filename prefixes → language name (e.g., "Dockerfile." → "dockerfile").
    filename_prefix_map: Vec<(String, String)>,
}

/// Parse a TOML inline array from a line like `field = ["a", "b"]`.
fn parse_toml_inline_array(line: &str) -> Vec<&str> {
    let trimmed = line.trim();
    let Some(bracket_start) = trimmed.find('[') else { return vec![] };
    let Some(bracket_end) = trimmed.find(']') else { return vec![] };
    let inner = &trimmed[bracket_start + 1..bracket_end];
    inner.split(',')
        .map(|s| s.trim().trim_matches('"').trim())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Global singleton — loads plugins from ~/.sentrux/plugins/ once at startup.
static REGISTRY: std::sync::LazyLock<LangRegistry> =
    std::sync::LazyLock::new(LangRegistry::init);

impl LangRegistry {
    fn init() -> Self {
        let mut registry = LangRegistry {
            by_name: HashMap::new(),
            by_ext: HashMap::new(),
            configs: Vec::new(),
            failed: Vec::new(),
            ext_display: HashMap::new(),
            filename_map: HashMap::new(),
            filename_prefix_map: Vec::new(),
        };
        registry.load_display_index();
        registry.load_plugins();

        let count = registry.configs.len();
        if count == 0 {
            eprintln!(
                "[lang_registry] No language plugins loaded. \
                 Run `sentrux plugin add-standard` to install standard languages."
            );
        } else {
            crate::debug_log!("[lang_registry] {} language plugins loaded", count);
        }

        registry
    }

    /// Build display-only extension and filename indexes from ALL embedded plugin data.
    /// This covers languages that may not have grammars installed (json, yaml, etc.).
    fn load_display_index(&mut self) {
        for &(name, toml_content, _scm) in crate::analysis::plugin::embedded::EMBEDDED_PLUGINS {
            self.index_extensions(name, toml_content);
            self.index_filenames(name, toml_content);
        }
    }

    /// Index file extensions from a plugin TOML for display language detection.
    fn index_extensions(&mut self, name: &str, toml_content: &str) {
        for line in toml_content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("extensions") {
                for ext in parse_toml_inline_array(trimmed) {
                    self.ext_display.entry(ext.to_string())
                        .or_insert_with(|| name.to_string());
                }
            }
        }
    }

    /// Index filename patterns from a plugin TOML for display language detection.
    fn index_filenames(&mut self, name: &str, toml_content: &str) {
        for line in toml_content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("filenames") {
                for fname in parse_toml_inline_array(trimmed) {
                    if fname.ends_with('*') {
                        let prefix = &fname[..fname.len() - 1];
                        self.filename_prefix_map.push((prefix.to_string(), name.to_string()));
                    } else {
                        self.filename_map.insert(fname.to_string(), name.to_string());
                    }
                }
            }
        }
    }

    /// Load all plugins from ~/.sentrux/plugins/.
    fn load_plugins(&mut self) {
        let (plugins, errors) = crate::analysis::plugin::load_all_plugins();
        for err in &errors {
            crate::debug_log!("[plugin] Error: {}: {}", err.plugin_dir.display(), err.error);
            self.failed.push(format!("{}: {}", err.plugin_dir.display(), err.error));
        }
        for plugin in plugins {
            match Query::new(&plugin.grammar, &plugin.query_src) {
                Ok(query) => {
                    let idx = self.configs.len();
                    let name = plugin.name.clone();
                    let extensions = plugin.extensions.clone();
                    self.configs.push(PluginLangConfig {
                        name: plugin.name,
                        version: plugin.version,
                        grammar: plugin.grammar,
                        query,
                        extensions: plugin.extensions,
                        profile: plugin.profile,
                    });
                    self.by_name.insert(name, idx);
                    for ext in extensions {
                        self.by_ext.insert(ext, idx);
                    }
                }
                Err(e) => {
                    let msg = format!("{}: query failed: {:?}", plugin.name, e);
                    crate::debug_log!("[plugin] {}", msg);
                    self.failed.push(msg);
                }
            }
        }
    }

    /// Look up by language name.
    pub fn get(&self, name: &str) -> Option<&PluginLangConfig> {
        self.by_name.get(name).map(|&idx| &self.configs[idx])
    }

    /// Get the language profile by name. Returns default profile if not found.
    pub fn profile(&self, name: &str) -> &LanguageProfile {
        self.get(name).map(|c| &c.profile).unwrap_or(&DEFAULT_PROFILE)
    }

    /// Look up by file extension (without dot).
    pub fn get_by_ext(&self, ext: &str) -> Option<&PluginLangConfig> {
        self.by_ext.get(ext).map(|&idx| &self.configs[idx])
    }

    /// All registered file extensions.
    pub fn all_extensions(&self) -> Vec<&str> {
        self.by_ext.keys().map(|s| s.as_str()).collect()
    }

    /// Number of loaded languages.
    pub fn count(&self) -> usize {
        self.configs.len()
    }

    /// All manifest files across all loaded plugins (for project boundary detection).
    pub fn all_manifest_files(&self) -> Vec<&str> {
        let mut files: Vec<&str> = self.configs.iter()
            .flat_map(|c| c.profile.semantics.project.manifest_files.iter().map(|s| s.as_str()))
            .collect();
        files.sort_unstable();
        files.dedup();
        files
    }

    /// All ignored directories across all loaded plugins (merged set).
    pub fn all_ignored_dirs(&self) -> std::collections::HashSet<&str> {
        self.configs.iter()
            .flat_map(|c| c.profile.semantics.project.ignored_dirs.iter().map(|s| s.as_str()))
            .co
```

### Core Architecture Module: `sentrux-core/src/analysis/mod.rs`
```
//! Source code analysis — scanning, parsing, and graph extraction.
//!
//! Walks the filesystem, counts lines (via tokei), parses structure with
//! tree-sitter, resolves imports to file paths, and builds the three
//! dependency graphs (import, call, inherit).

#[cfg(test)]
pub(crate) mod test_helpers;

pub mod entry_points;
pub mod git;
pub mod graph;
pub mod lang_registry;
pub mod parser;
pub mod plugin;
pub mod resolver;
pub mod scanner;


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #51** (2026-05-07): **Claude/verify mcp functionality**
  *Symptoms*: 

- **Issue #33** (2026-03-18): **fix: resolve PHP namespace imports via PSR-4 autoload mapping**
  *Symptoms*: Hey! I've been using sentrux with AI agents on our PHP (Symfony) monorepo and noticed that PHP import resolution barely works — we were getting 8 out of ~6800 imports resolved, which meant all the layer and boundary rules in `rules.toml` were essentially dead.  Dug into the resolver and found two issues:  ### 1. Backslash separator not handled  PHP namespaces use backslashes (`App\Entity\User`), but `normalize_module_path()` only converts `::` (Rust) and `.` (Python/Java) to `/`. One-line fix — added `\` → `/` alongside the existing conversions.  ### 2. No PSR-4 namespace prefix stripping  Go resolution works well because `go.mod` gives you a module prefix to strip (`github.com/user/repo` → local path). PHP has the same concept via `composer.json` PSR-4 autoload mappings (`"App\\": "src/"`), but nothing was reading it.  Added `collect_psr4_prefixes()` that reads `composer.json` autoload + autoload-dev sections and feeds the namespace→directory mappings into the same module prefix mechanism Go already uses. Handles both string and array directory values.  ### Results on a real Symfony service (~1600 PHP files)  | Metric | Before | After | |--------|--------|-------| | Resolved imports | 8 (0.1%) | 1,964 (28.6%) | | Import edges | 8 | 1,956 | | Call edges | 0 | 2,537 |  The remaining ~70% unresolved are vendor imports (Symfony, Doctrine, etc.) which live outside the scan boundary — that's expected.  The important part: **boundary rules now actually fire for PHP**. We can enforc
  **Post-Mortem & Fix Analysis**:
  > Thanks for the excellent bug report and fix! Your analysis was spot-on — PHP resolution was basically broken.  We implemented the fix differently to keep the plugin architecture clean. Instead of PHP-specific Rust code, the resolver now supports two generic capabilities driven entirely by plugin.toml:  1. **`namespace_separator = "\\"`** — converts any configurable separator to `/` (your backslash fix) 2. **`module_prefix_format = "json_map"` + `module_prefix_json_paths = ["autoload.psr-4", "autoload-dev.psr-4"]`** — reads prefix maps from JSON manifests (your PSR-4 fix)  PHP's plugin.toml now declares its resolution strategy without any PHP-specific Rust code. The same mechanism works for TypeScript path aliases, C# namespaces, or any future language.  Your test cases and results (8 → 1964 imports) were invaluable for validating the fix. 11 new tests added.  If you get a chance to test on your Symfony monorepo with the latest main, we'd love to hear if the results match.

- **Issue #31** (2026-03-19): **Error while installing in  Macbook Pro M1**
  *Symptoms*: ✘ Formula sentrux (0.5.6) Error: Failed to download resource "sentrux (0.5.6)" Download failed: https://github.com/sentrux/sentrux/releases/download/v0.5.6/sentrux-darwin-arm64
  **Post-Mortem & Fix Analysis**:
  > Same for me
  > Fixed — the release build had an issue that's been resolved. Please try again:  ``` brew update brew install sentrux/tap/sentrux ```

- **Issue #30** (2026-03-19): **安装不了啊**
  *Symptoms*: ✘ Formula sentrux (0.5.6) Error: Failed to download resource "sentrux (0.5.6)" Download failed: https://github.com/sentrux/sentrux/releases/download/v0.5.6/sentrux-darwin-arm64
  **Post-Mortem & Fix Analysis**:
  > 已经修复了，之前发布构建有问题。请重试：  ``` brew update brew install sentrux/tap/sentrux ```

- **Issue #29** (2026-03-18): **Switch font to JetBrains Mono, tune default font_scale and ui_scale**
  *Symptoms*: ## Summary  - Replaces the bundled TerminessNerdFont with **JetBrains Mono** (regular + bold `.ttf`) - Sets default `font_scale` to `0.20` and `ui_scale` to `1.50` for better out-of-the-box readability - JetBrains Mono is widely used in developer tooling, renders cleanly at all sizes, and is available under the SIL Open Font License  ## Test plan  - [ ] Build from source and launch the GUI — verify JetBrains Mono renders in panels and canvas - [ ] Check that UI chrome (toolbar, breadcrumb, panels) scales correctly at default `ui_scale: 1.50` - [ ] Check that canvas node labels render correctly at default `font_scale: 0.20` - [ ] Verify no font fallback glyphs appear for standard ASCII characters  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Thanks for the suggestion! We already addressed the font readability issue in v0.5.6 with TerminessNerdFontMono + a UI Scale setting (0.5x-3.0x). We chose TerminessNerdFont over JetBrains Mono because it includes Nerd Font icons and matches the terminal/pixel aesthetic of the tool.

- **Issue #28** (2026-03-19): **Error while installing on Macbook Pro M1**
  *Symptoms*:  Getting error while installing on Mac `brew install sentrux/tap/sentrux`  Error Logs:  ```Error: sentrux/tap/sentrux: formula requires at least a URL Warning: Removed Sorbet lines from backtrace! Rerun with `--verbose` to see the original backtrace /usr/local/Homebrew/Library/Homebrew/formula.rb:395:in 'Formula#determine_active_spec' /usr/local/Homebrew/Library/Homebrew/formula.rb:285:in 'Formula#initialize' /usr/local/Homebrew/Library/Homebrew/formulary.rb:463:in 'Formulary::FormulaLoader#get_formula' /usr/local/Homebrew/Library/Homebrew/formulary.rb:707:in 'Formulary::FromTapLoader#get_formula' /usr/local/Homebrew/Library/Homebrew/formulary.rb:965:in 'Formulary.factory' /usr/local/Homebrew/Library/Homebrew/cli/named_args.rb:342:in 'block in Homebrew::CLI::NamedArgs#load_formula_or_cask' /usr/local/Homebrew/Library/Homebrew/api.rb:380:in 'Homebrew.with_no_api_env_if_needed' /usr/local/Homebrew/Library/Homebrew/cli/named_args.rb:335:in 'Homebrew::CLI::NamedArgs#load_formula_or_cask' /usr/local/Homebrew/Library/Homebrew/cli/named_args.rb:84:in 'block in Homebrew::CLI::NamedArgs#to_formulae_and_casks' /usr/local/Homebrew/Library/Homebrew/cli/named_args.rb:83:in 'Array#each' /usr/local/Homebrew/Library/Homebrew/cli/named_args.rb:83:in 'Enumerable#flat_map' /usr/local/Homebrew/Library/Homebrew/cli/named_args.rb:83:in 'Homebrew::CLI::NamedArgs#to_formulae_and_casks' /usr/local/Homebrew/Library/Homebrew/cmd/install.rb:210:in 'Homebrew::Cmd::InstallCmd#run' /usr/local/Homebrew/Libr
  **Post-Mortem & Fix Analysis**:
  > This should be fixed now — we had a release build issue that's been resolved. Please try again:  ``` brew update brew install sentrux/tap/sentrux ```  If you're on Intel Mac (not M1/M2), we don't have a macOS x86_64 build yet — only ARM. Let me know if that's the case and we'll add it.

- **Issue #27** (2026-03-18): **fix(release): gate release and formula update on all builds succeeding**
  *Symptoms*: The `release` job used `if: always() && !cancelled()`, causing the GitHub release and Homebrew formula update to proceed even when build matrix jobs failed. This allowed the formula to be bumped to a version with missing binaries (as happened in v0.5.6).  Removing the condition restores the default `needs` behaviour: the release only publishes when all platform builds succeed.
  **Post-Mortem & Fix Analysis**:
  > Fixed — removed the `if: always() && !cancelled()` condition so the release job only publishes when all build matrix jobs succeed. Thanks for catching this!

- **Issue #25** (2026-03-18): **fix: remove sentrux-pro path dependency for open source builds**
  *Symptoms*: The path dependency `../../sentrux-pro` doesn't exist for open source users, causing cargo to fail with cyclic dependency error even though the dependency is optional.  ## Changes - Remove `[dependencies.sentrux-pro]` path dependency   - Remove `dep:sentrux-pro` from pro feature - Guard `sentrux_pro::init()` call (pro crate should call it externally)  This allows open source users to build with: `cargo build --features pro`  The pro crate can still enable pro features by depending on sentrux-bin with `features = ["pro"]`, preserving the optional pro compilation path.  Closes #24
  **Post-Mortem & Fix Analysis**:
  > This is literally duplicate to #24, isn't it? 
  > Fixed in v0.5.6 — same underlying issue as #24. Thanks for the PR!  We removed the `sentrux-pro` path dependency entirely. `cargo build` now works on a clean clone.

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

### Incident Patch 1: `5a9257fe` (2026-03-18)
**Commit Message**: Universal resolver: namespace_separator + json_map prefix format

Implements plugin.toml-driven import resolution for ANY language
that uses non-slash separators or JSON manifest prefix maps.
Zero language-specific Rust code.

New ResolverConfig fields:
- namespace_separator: converts any separator to / (e.g. \\ for PHP)
- module_prefix_format: "line" (Go go.mod) or "json_map" (PHP composer.json)
- module_prefix_json_paths: JSON paths to prefix maps (e.g. autoload.psr-4)

PHP plugin.toml updated:
- namespace_separator = "\\"
- module_prefix_format = "json_map"
- module_prefix_json_paths = ["autoload.psr-4", "autoload-dev.psr-4"]

This fixes PHP import resolution (0.1% → ~29% resolved) without
any PHP-specific Rust code. Same mechanism works for TypeScript
path aliases, C# namespace resolution, or any future language.

11 new tests. 307 total pass. Go resolution unaffected.

**File**: `plugins/php/plugin.toml` (modified, +5/-1)
```diff
@@ -22,7 +22,7 @@ capabilities = ["functions", "classes", "imports"]
 [checksums]
 
 [semantics]
-dot_is_module_separator = true
+dot_is_module_separator = false
 import_extractor = ""
 base_class_extractor = "generic"
 base_class_node_kinds = ["base_clause", "class_interface_clause"]
@@ -35,6 +35,10 @@ main_filenames = ["index.php", "app.php", "server.php"]
 
 
 [semantics.resolver]
+namespace_separator = "\\"
+module_prefix_file = "composer.json"
+module_prefix_format = "json_map"
+module_prefix_json_paths = ["autoload.psr-4", "autoload-dev.psr-4"]
 alias_file = "composer.json"
 alias_field = "name"
 alias_entry_point = "src/index.php"
```

**File**: `sentrux-core/src/analysis/parser/captures.rs` (modified, +11/-8)
```diff
@@ -49,7 +49,8 @@ fn process_scoped_path(
     if let Ok(path_text) = node.utf8_text(content) {
         if let Some(last_sep) = path_text.rfind("::") {
             let module_part = &path_text[..last_sep];
-            let normalized = normalize_module_path(module_part, false);
+            // Scoped paths (Rust ::) always use false for dots, empty namespace_sep
+            let normalized = normalize_module_path(module_part, false, "");
             if !normalized.is_empty() && import_set.insert(normalized.clone()) {
                 imports.push(normalized);
             }
@@ -388,8 +389,8 @@ fn apply_module_transform(module: &str, transform: &str) -> String {
 }
 
 /// Insert a normalized module path into imports if non-empty and not seen.
-fn insert_normalized(raw: &str, dots_are_seps: bool, imports: &mut Vec<String>, import_set: &mut HashSet<String>) {
-    let module = normalize_module_path(raw, dots_are_seps);
+fn insert_normalized(raw: &str, dots_are_seps: bool, namespace_sep: &str, imports: &mut Vec<String>, import_set: &mut HashSet<String>) {
+    let module = normalize_module_path(raw, dots_are_seps, namespace_sep);
     if !module.is_empty() && import_set.insert(module.clone()) {
         imports.push(module);
     }
@@ -411,6 +412,7 @@ fn resolve_import_from_node(
     profile: &crate::analysis::plugin::profile::LanguageProfile,
     transform: &str,
     dots_are_seps: bool,
+    namespace_sep: &str,
     imports: &mut Vec<String>,
     import_set: &mut HashSet<String>,
 ) {
@@ -421,7 +423,7 @@ fn resolve_import_from_node(
             if !expanded.is_empty() {
                 for raw in &expanded {
                     let module = apply_module_transform(raw, transform);
-                    insert_normalized(&module, dots_are_seps, imports, import_set);
+                    insert_normalized(&module, dots_are_seps, namespace_sep, imports, import_set);
                 }
                 return;
             }
@@ -432,7 +434,7 @@ fn resolve_import_from_node(
             node, content, &profile.semantics.import_ast,
         );
         for raw in paths {
-            insert_normalized(&raw, dots_are_seps, imports, import_set);
+            insert_normalized(&raw, dots_are_seps, namespace_sep, imports, import_set);
         }
     }
 }
@@ -446,14 +448,15 @@ pub(super) fn process_import(
 ) {
     let profile = crate::analysis::lang_registry::profile(lang);
     let dots_are_seps = lang_uses_dot_separator(lang);
+    let namespace_sep = profile.semantics.resolver.namespace_separator.as_str();
     let transform = &profile.semantics.import_ast.module_name_transform;
     if let Some(module) = &ictx.import_module_text {
         let module = apply_module_transform(module, transform);
-        insert_normalized(&module, dots_are_seps, imports, import_set);
+        insert_normalized(&module, dots_are_seps, namespace_sep, imports, import_set);
     } else if let Some(module) = &ictx.name_text {
         let module = apply_module_transform(module, transform);
-        insert_normalized(&module, dots_are_seps, imports, import_set);
+        insert_normalized(&module, dots_are_seps, namespace_sep, imports, import_set);
     } else if let Some(node) = ictx.import_node.or(ictx.match_node) {
-        resolve_import_from_node(node, content, profile, transform, dots_are_seps, imports, import_set);
+        resolve_import_from_node(node, content, profile, transform, dots_are_seps, namespace_sep, imports, import_set);
     }
 }
```

**File**: `sentrux-core/src/analysis/parser/imports.rs` (modified, +36/-7)
```diff
@@ -31,9 +31,12 @@ pub(crate) fn lang_uses_dot_separator(lang: &str) -> bool {
 
 /// Normalize a module path to slash-separated form.
 /// `dots_are_separators`: true for languages where '.' means module separator
-/// (Python, Java, C#, Scala, Kotlin, Ruby, PHP). False for file-path languages
+/// (Python, Java, C#, Scala, Kotlin, Ruby). False for file-path languages
 /// (C/C++, Go, HTML, CSS) and Rust (uses :: which is always converted).
-pub(crate) fn normalize_module_path(raw: &str, dots_are_separators: bool) -> String {
+/// `namespace_sep`: configurable namespace separator from plugin.toml (e.g., "\\" for PHP).
+///   Converted to `/` after the built-in `::` and `.` conversions, so it won't
+///   conflict with those. Empty string means no extra conversion.
+pub(crate) fn normalize_module_path(raw: &str, dots_are_separators: bool, namespace_sep: &str) -> String {
     let s = raw.trim();
     if s.is_empty() {
         return String::new();
@@ -57,6 +60,12 @@ pub(crate) fn normalize_module_path(raw: &str, dots_are_separators: bool) -> Str
         normalized = normalized.replace('.', "/");
     }
 
+    // Convert configurable namespace separator (e.g., "\\" for PHP).
+    // Only applied if it's not already handled by the built-in conversions above.
+    if !namespace_sep.is_empty() && namespace_sep != "::" && namespace_sep != "." {
+        normalized = normalized.replace(namespace_sep, "/");
+    }
+
     format!("{}{}", prefix, normalized)
 }
 
@@ -405,19 +414,39 @@ mod tests {
 
     #[test]
     fn normalize_dot_separator() {
-        assert_eq!(normalize_module_path("os.path", true), "os/path");
-        assert_eq!(normalize_module_path("os.path", false), "os.path");
+        assert_eq!(normalize_module_path("os.path", true, ""), "os/path");
+        assert_eq!(normalize_module_path("os.path", false, ""), "os.path");
     }
 
     #[test]
     fn normalize_rust_path() {
-        assert_eq!(normalize_module_path("std::collections::HashMap", false), "std/collections/HashMap");
+        assert_eq!(normalize_module_path("std::collections::HashMap", false, ""), "std/collections/HashMap");
     }
 
     #[test]
     fn normalize_relative() {
-        assert_eq!(normalize_module_path("..utils", true), "..utils");
-        assert_eq!(normalize_module_path("...deep.path", true), "...deep/path");
+        assert_eq!(normalize_module_path("..utils", true, ""), "..utils");
+        assert_eq!(normalize_module_path("...deep.path", true, ""), "...deep/path");
+    }
+
+    #[test]
+    fn normalize_php_backslash() {
+        // PHP uses backslash as namespace separator
+        assert_eq!(normalize_module_path("App\\Entity\\User", false, "\\"), "App/Entity/User");
+        assert_eq!(normalize_module_path("App\\Models\\Order", false, "\\"), "App/Models/Order");
+    }
+
+    #[test]
+    fn normalize_namespace_sep_no_conflict_with_builtins() {
+        // namespace_sep == "::" or "." should be no-ops (already handled by built-in logic)
+        assert_eq!(normalize_module_path("std::collections", false, "::"), "std/collections");
+        assert_eq!(normalize_module_path("os.path", true, "."), "os/path");
+    }
+
+    #[test]
+    fn normalize_empty_namespace_sep() {
+        // Empty namespace_sep means no extra conversion
+        assert_eq!(normalize_module_path("App\\Entity\\User", false, ""), "App\\Entity\\User");
     }
 }
 
```

**File**: `sentrux-core/src/analysis/plugin/profile.rs` (modified, +13/-0)
```diff
@@ -454,6 +454,16 @@ pub struct ResolverConfig {
     /// Empty = source at package root (no subdirectory).
     pub source_root: String,
 
+    /// Namespace separator to convert to `/` (e.g., "\\" for PHP, already handles "::" and ".").
+    pub namespace_separator: String,
+
+    /// Format for reading module prefix file: "line" (default) or "json_map".
+    pub module_prefix_format: String,
+
+    /// JSON paths to prefix maps (used when format = "json_map").
+    /// e.g., ["autoload.psr-4", "autoload-dev.psr-4"]
+    pub module_prefix_json_paths: Vec<String>,
+
     // Workspace resolution is handled by the suffix-index + alias system.
     // No workspace-specific fields needed — the resolver accepts ALL edges
     // within the scan root. Cross-project imports are real dependencies.
@@ -473,6 +483,9 @@ impl Default for ResolverConfig {
             path_alias_base_url: String::new(),
             resolve_extensions: Vec::new(),
             source_root: String::new(),
+            namespace_separator: String::new(),
+            module_prefix_format: String::new(),
+            module_prefix_json_paths: Vec::new(),
         }
     }
 }
```

**File**: `sentrux-core/src/analysis/resolver/suffix.rs` (modified, +210/-14)
```diff
@@ -393,18 +393,102 @@ fn extract_module_name_generic<'a>(content: &'a str, directive: &str) -> Option<
     None
 }
 
+/// Extract prefix->directory mappings from a JSON manifest file.
+/// Navigates to each json_path and reads the object's key-value pairs.
+/// Keys are namespace prefixes (with separator), values are directory paths.
+/// Used for PSR-4 (composer.json), TypeScript paths (tsconfig.json), etc.
+fn extract_json_prefix_map(
+    content: &str,
+    json_paths: &[String],
+    namespace_sep: &str,
+) -> Vec<(String, String)> {
+    let mut prefixes = Vec::new();
+    let parsed: serde_json::Value = match serde_json::from_str(content) {
+        Ok(v) => v,
+        Err(_) => return prefixes,
+    };
+    for json_path in json_paths {
+        // Navigate to the path (e.g., "autoload.psr-4")
+        // Use a custom split that handles hyphenated keys:
+        // "autoload.psr-4" splits on the first '.' -> ["autoload", "psr-4"]
+        let mut current = &parsed;
+        let keys = split_json_path(json_path);
+        for key in &keys {
+            match current.get(key.as_str()) {
+                Some(v) => current = v,
+                None => { current = &serde_json::Value::Null; break; }
+            }
+        }
+        // Read the object as prefix->directory map
+        if let Some(obj) = current.as_object() {
+            for (ns_prefix, dir_value) in obj {
+                // Normalize the namespace prefix: convert separator to /
+                let mut normalized = ns_prefix.clone();
+                if !namespace_sep.is_empty() {
+                    normalized = normalized.replace(namespace_sep, "/");
+                }
+                // Remove trailing slash
+                let normalized = normalized.trim_end_matches('/').to_string();
+
+                // Directory can be a string or array of strings
+                let dirs: Vec<String> = match dir_value {
+                    serde_json::Value::String(s) => vec![s.trim_end_matches('/').to_string()],
+                    serde_json::Value::Array(arr) => arr.iter()
+                        .filter_map(|v| v.as_str())
+                        .map(|s| s.trim_end_matches('/').to_string())
+                        .collect(),
+                    _ => continue,
+                };
+                for dir in dirs {
+                    if !normalized.is_empty() {
+                        prefixes.push((normalized.clone(), dir));
+                    }
+                }
+            }
+        }
+    }
+    prefixes
+}
+
+/// Split a JSON path like "autoload.psr-4" into segments.
+/// Splits on '.' but only at the top level — each segment can contain hyphens.
+fn split_json_path(path: &str) -> Vec<String> {
+    path.split('.').map(|s| s.to_string()).collect()
+}
+
+/// Plugin resolver config snapshot for prefix collection.
+/// Holds references to the fields needed from each plugin's ResolverConfig.
+struct PrefixPluginConfig<'a> {
+    prefix_file: &'a str,
+    directive: &'a str,
+    format: &'a str,
+    json_paths: &'a [String],
+    namespace_sep: &'a str,
+}
+
 /// Scan project roots for module prefix files and build a map of module paths to project dirs.
-/// Reads module_prefix_file and module_prefix_directive from ALL loaded plugin profiles.
+/// Reads module_prefix_file from ALL loaded plugin profiles.
+/// Supports two formats:
+///   - "line" (default): reads `<directive> <path>` from a text file (e.g., Go go.mod).
+///   - "json_map": reads prefix->directory mappings from a JSON file (e.g., PHP composer.json).
 /// Sorted longest-first so more specific module paths match before shorter ones.
 fn collect_module_prefixes(project_map: &HashMap<String, String>, scan_root: &Path) -> Vec<(String, String)> {
-    // Collect all (file, directive) pairs from plugin profiles
-    let prefix_configs: Vec<(&str, &str)> = crate::analysis::lang_registry::all_profiles()
-        .filter(|p| !p.semantics.resolver.module_prefix_file.is_empty()

```

---

### Incident Patch 2: `587e03cc` (2026-03-18)
**Commit Message**: Fix telemetry bugs: dedup, latest-not-max, comment

- Fix files/grade: use latest value not max (was mixing data
  from different projects when user scans A then B)
- Fix dedup: save timestamp BEFORE ping to prevent duplicate
  pings when GUI + MCP start simultaneously
- Fix comment: grade is 0-10000 not 0-100
- Restore logic: keep current activity if it happened during ping

**File**: `sentrux-core/src/app/update_check.rs` (modified, +14/-8)
```diff
@@ -127,13 +127,15 @@ impl TelemetryState {
     /// After this call, both in-memory state and disk file are zeroed.
     fn snapshot_and_reset(&mut self) -> TelemetrySnapshot {
         // Merge disk (previous sessions) + in-memory (current session)
+        // Counters (scans, mcp_calls, gate_runs): sum across sessions
+        // State values (files, grade): use latest (in-memory wins if set, else disk)
         let disk = load_pending_from_disk();
         let snap = TelemetrySnapshot {
             scans: self.scans + disk.scans,
             mcp_calls: self.mcp_calls + disk.mcp_calls,
             gate_runs: self.gate_runs + disk.gate_runs,
-            files: std::cmp::max(self.files, disk.files),
-            grade: std::cmp::max(self.grade, disk.grade),
+            files: if self.files > 0 { self.files } else { disk.files },
+            grade: if self.grade > 0 { self.grade } else { disk.grade },
         };
 
         // Zero everything
@@ -149,8 +151,9 @@ impl TelemetryState {
         self.scans += snap.scans;
         self.mcp_calls += snap.mcp_calls;
         self.gate_runs += snap.gate_runs;
-        self.files = std::cmp::max(self.files, snap.files);
-        self.grade = std::cmp::max(self.grade, snap.grade);
+        // files/grade: keep latest (current activity wins if it happened during ping)
+        if self.files == 0 { self.files = snap.files; }
+        if self.grade == 0 { self.grade = snap.grade; }
         self.persist();
     }
 }
@@ -346,14 +349,17 @@ pub fn check_for_updates_async(current_version: &str) {
 ///   Phase 2 (lock released): send the HTTP ping (slow, ~3s timeout).
 ///   Phase 3 (lock held): on failure, restore the snapshot.
 fn check_and_notify(current_version: &str) {
+    // Save timestamp FIRST — prevents duplicate pings if GUI + MCP start simultaneously.
+    // If the ping fails, counters are restored but timestamp stays (retry after 24h).
+    let new = if is_new_user() { "1" } else { "0" };
+    save_check_timestamp();
+
     // ── Phase 1: Atomic snapshot under lock ──
     let snapshot = match TELEMETRY_LOCK.lock() {
         Ok(mut state) => state.snapshot_and_reset(),
         Err(_) => return, // poisoned mutex, bail
     };
     // Lock released here — record_* calls are unblocked.
-
-    let new = if is_new_user() { "1" } else { "0" };
     let mode = detect_mode();
     let plugins = crate::analysis::lang_registry::plugin_count();
     let tier = crate::license::current_tier();
@@ -371,7 +377,7 @@ fn check_and_notify(current_version: &str) {
         snapshot.mcp_calls,  // MCP calls since last ping
         snapshot.gate_runs,  // gate runs since last ping
         snapshot.files,      // last scanned file count
-        snapshot.grade,      // last quality score (0-100 integer, 0=none)
+        snapshot.grade,      // last quality score (0-10000, 0=no scan)
         dev,                 // 1 = internal/dev traffic
     );
 
@@ -400,7 +406,7 @@ fn check_and_notify(current_version: &str) {
     match latest {
         Some(latest_version) => {
             // ── Phase 3b: Ping succeeded — counters already zeroed in Phase 1 ──
-            save_check_timestamp();
+            // Timestamp already saved before Phase 1 (dedup guard).
             if is_newer(current_version, latest_version) {
                 set_latest_version(latest_version);
             } else {
```

---

### Incident Patch 3: `74f2213e` (2026-03-18)
**Commit Message**: Fix release: don't publish when builds fail (#27)

Remove if: always() so release job only runs when ALL build matrix
jobs succeed. Prevents publishing Homebrew formula with missing binaries.

**File**: `.github/workflows/release.yml` (modified, +0/-1)
```diff
@@ -108,7 +108,6 @@ jobs:
 
   release:
     needs: build
-    if: always() && !cancelled()
     runs-on: ubuntu-latest
     steps:
       - name: Download all artifacts
```

---

### Incident Patch 4: `230bc9df` (2026-03-18)
**Commit Message**: Fix CI grammar race properly: separate workflows for tag vs branch

- Regular pushes: CI uses grammars from previous release (always available)
- Tag pushes: skip CI, run CI-Release AFTER Grammar Build completes
  (workflow_run trigger — grammars guaranteed to exist)
- No retries, no sleep loops, no stale grammars

**File**: `.github/workflows/ci-release.yml` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+name: CI (Release)
+
+# Runs AFTER Grammar Build completes on tag pushes.
+# This avoids the race condition where CI needs grammars
+# that haven't been built yet.
+on:
+  workflow_run:
+    workflows: ["Build Grammars Bundle"]
+    types: [completed]
+
+jobs:
+  test:
+    if: ${{ github.event.workflow_run.conclusion == 'success' }}
+    strategy:
+      fail-fast: false
+      matrix:
+        os: [macos-latest, ubuntu-latest]
+    runs-on: ${{ matrix.os }}
+
+    steps:
+      - uses: actions/checkout@v4
+        with:
+          ref: ${{ github.event.workflow_run.head_branch }}
+          fetch-depth: 0
+
+      - name: Install Rust toolchain
+        uses: dtolnay/rust-toolchain@stable
+
+      - name: Install Linux dependencies
+        if: runner.os == 'Linux'
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y libgtk-3-dev libxcb-render0-dev libxcb-shape0-dev \
+            libxcb-xfixes0-dev libxkbcommon-dev libssl-dev libvulkan-dev
+
+      - name: Cache cargo
+        uses: actions/cache@v4
+        with:
+          path: |
+            ~/.cargo/registry
+            ~/.cargo/git
+            target
+          key: ${{ runner.os }}-cargo-${{ hashFiles('Cargo.lock') }}
+
+      - name: Build
+        run: cargo build
+
+      - name: Install language grammars
+        shell: bash
+        run: |
+          # Grammars are guaranteed to exist — this workflow only runs
+          # after Grammar Build succeeds. Download from the current tag.
+          PLATFORM=$([ "$RUNNER_OS" = "macOS" ] && echo "darwin-arm64" || echo "linux-x86_64")
+          TAG=${{ github.event.workflow_run.head_branch }}
+          URL="https://github.com/sentrux/sentrux/releases/download/${TAG}/grammars-${PLATFORM}.tar.gz"
+          mkdir -p ~/.sentrux/plugins
+          curl -fsSL "$URL" -o /tmp/grammars.tar.gz
+          tar xzf /tmp/grammars.tar.gz -C ~/.sentrux/plugins/
+          echo "Grammar bundle downloaded from ${TAG}"
+          SENTRUX_SKIP_GRAMMAR_DOWNLOAD=1 cargo run -- --version || true
+
+      - name: Test
+        run: cargo test
+
+      - name: Build release
+        run: cargo build --release
```

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -3,6 +3,7 @@ name: CI
 on:
   push:
     branches: [main]
+    tags-ignore: ['v*']  # Don't run on tag pushes — ci-release handles those
   pull_request:
     branches: [main]
 
@@ -62,7 +63,6 @@ jobs:
           if [ "$DOWNLOADED" = false ]; then
             echo "Grammar download failed from all recent tags"
           fi
-          done
           # Sync embedded plugin configs (TOML) without triggering grammar download
           SENTRUX_SKIP_GRAMMAR_DOWNLOAD=1 cargo run -- --version || true
 
```

---

### Incident Patch 5: `5270dc9d` (2026-03-18)
**Commit Message**: Fix CI grammar race: try previous release tags instead of retrying

Instead of retrying the current tag's grammars (which may not exist
yet), iterate through recent tags newest-first. The previous release
always has grammars. No sleep loops, no race condition.

**File**: `.github/workflows/ci.yml` (modified, +12/-8)
```diff
@@ -44,20 +44,24 @@ jobs:
       - name: Install language grammars
         shell: bash
         run: |
-          # Download grammar bundle from LATEST release.
-          # On tag pushes, grammars may still be building (race condition).
-          # Retry up to 5 times with 60s wait to let Build Grammars finish.
+          # Try each recent release tag until we find one with grammars.
+          # On tag pushes, the NEW release won't have grammars yet (still building).
+          # The previous release always has them. No race condition.
           PLATFORM=$([ "$RUNNER_OS" = "macOS" ] && echo "darwin-arm64" || echo "linux-x86_64")
-          URL="https://github.com/sentrux/sentrux/releases/latest/download/grammars-${PLATFORM}.tar.gz"
           mkdir -p ~/.sentrux/plugins
-          for i in 1 2 3 4 5; do
+          DOWNLOADED=false
+          for TAG in $(git tag --sort=-v:refname | head -5); do
+            URL="https://github.com/sentrux/sentrux/releases/download/${TAG}/grammars-${PLATFORM}.tar.gz"
             if curl -fsSL "$URL" -o /tmp/grammars.tar.gz 2>/dev/null; then
-              echo "Grammar bundle downloaded (attempt $i)"
+              echo "Grammar bundle downloaded from ${TAG}"
               tar xzf /tmp/grammars.tar.gz -C ~/.sentrux/plugins/
+              DOWNLOADED=true
               break
             fi
-            echo "Grammar download attempt $i failed — waiting 60s for build to finish..."
-            sleep 60
+          done
+          if [ "$DOWNLOADED" = false ]; then
+            echo "Grammar download failed from all recent tags"
+          fi
           done
           # Sync embedded plugin configs (TOML) without triggering grammar download
           SENTRUX_SKIP_GRAMMAR_DOWNLOAD=1 cargo run -- --version || true
```

---

### Incident Patch 6: `9cc9d52f` (2026-03-18)
**Commit Message**: v0.5.6 — UI scale, TerminessNerdFont, open source build fix

UI improvements:
- Add ui_scale setting (0.5x-3.0x) for panel text scaling
- Switch font to TerminessNerdFontMono (better glyphs at all sizes)
- Bump base text sizes: Body 13px, Small 11px, Heading 15px
- Clamp treemap text to 8-22 screen pixels for readability

README refresh:
- New tagline: sensor + feedback loop + recursive self-improvement
- SVG feedback loop diagram in How it Works section
- Animated quality score GIF replacing static screenshot
- Demo caption: "Not because the agent can't do better —
  but because without a sensor, it doesn't know what to improve"
- Logo size increased to 500px
- All 4 language READMEs fully synced

Build fix:
- Open source users can now `cargo build` without errors
- Removed CI Pro stub workaround (22 lines)
- Fixed CI grammar download race condition (retry with 60s wait)

Closes #23

**File**: `.github/workflows/ci.yml` (modified, +0/-23)
```diff
@@ -38,29 +38,6 @@ jobs:
             target
           key: ${{ runner.os }}-cargo-${{ hashFiles('Cargo.lock') }}
 
-      - name: Create Pro stub (optional dep needs path to exist)
-        run: |
-          # sentrux-bin/Cargo.toml has: path = "../../sentrux-pro"
-          # From sentrux-bin/ that resolves to: <repo-parent>/sentrux-pro/
-          # Which is: ../sentrux-pro/ from repo root
-          mkdir -p ../sentrux-pro/src
-          cat > ../sentrux-pro/Cargo.toml << STUBEOF
-          [package]
-          name = "sentrux-pro"
-          version = "0.0.0"
-          edition = "2021"
-          [lib]
-          path = "src/lib.rs"
-          [dependencies]
-          sentrux-core = { path = "../$(basename $(pwd))/sentrux-core" }
-          serde_json = "1"
-          dirs = "6"
-          STUBEOF
-          echo 'pub mod metrics { pub fn register_all() {} }
-          pub fn init() {}' > ../sentrux-pro/src/lib.rs
-          echo "=== Pro stub at $(realpath ../sentrux-pro/) ==="
-          cat ../sentrux-pro/Cargo.toml
-
       - name: Build
         run: cargo build
 
```

**File**: `.github/workflows/release.yml` (modified, +3/-4)
```diff
@@ -71,10 +71,9 @@ jobs:
       - name: Link Pro crate paths
         shell: bash
         run: |
-          # Move pro checkout to where sentrux-bin expects it (../../sentrux-pro from sentrux-bin/)
           mv sentrux-pro-checkout ../sentrux-pro
-          # Patch sentrux-pro Cargo.toml: replace local dev path with CI path
-          sed -i.bak 's|../sentrux-fresh/sentrux-core|../sentrux/sentrux-core|' ../sentrux-pro/Cargo.toml
+          # Patch paths: sentrux-pro references ../sentrux-fresh, CI uses ../sentrux
+          sed -i.bak 's|../sentrux-fresh|../sentrux|g' ../sentrux-pro/Cargo.toml
 
       - name: Set cross-compilation linker
         if: matrix.target == 'aarch64-unknown-linux-gnu'
@@ -89,7 +88,7 @@ jobs:
           echo "OPENSSL_LIB_DIR=/usr/lib/aarch64-linux-gnu" >> $GITHUB_ENV
 
       - name: Build release binary (with Pro)
-        run: cargo build --release --features pro --target ${{ matrix.target }}
+        run: cargo build --release --manifest-path ../sentrux-pro/Cargo.toml --target-dir target --target ${{ matrix.target }}
 
       - name: Package binary
         shell: bash
```

**File**: `Cargo.lock` (modified, +2/-12)
```diff
@@ -3379,18 +3379,17 @@ checksum = "d767eb0aabc880b29956c35734170f26ed551a859dbd361d140cdbeca61ab1e2"
 
 [[package]]
 name = "sentrux"
-version = "0.5.5"
+version = "0.5.6"
 dependencies = [
  "clap",
  "eframe",
  "egui",
  "sentrux-core",
- "sentrux-pro",
 ]
 
 [[package]]
 name = "sentrux-core"
-version = "0.5.5"
+version = "0.5.6"
 dependencies = [
  "crossbeam-channel",
  "dashmap",
@@ -3414,15 +3413,6 @@ dependencies = [
  "tree-sitter",
 ]
 
-[[package]]
-name = "sentrux-pro"
-version = "0.5.4"
-dependencies = [
- "dirs",
- "sentrux-core",
- "serde_json",
-]
-
 [[package]]
 name = "serde"
 version = "1.0.228"
```

**File**: `sentrux-bin/Cargo.toml` (modified, +2/-6)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "sentrux"
-version = "0.5.5"
+version = "0.5.6"
 edition = "2021"
 description = "Live codebase visualization and structural quality gate for AI-agent-written code"
 license = "MIT"
@@ -23,8 +23,4 @@ egui = { workspace = true }
 
 [features]
 default = []
-pro = ["sentrux-core/pro", "dep:sentrux-pro"]
-
-[dependencies.sentrux-pro]
-path = "../../sentrux-pro"
-optional = true
+pro = ["sentrux-core/pro"]
```

**File**: `sentrux-bin/src/main_impl.rs` (modified, +2/-3)
```diff
@@ -155,9 +155,8 @@ enum PluginAction {
 // ---------------------------------------------------------------------------
 
 pub fn run() -> eframe::Result<()> {
-    // Step 0: Initialize Pro tier if compiled with pro feature
-    #[cfg(feature = "pro")]
-    sentrux_pro::init();
+    // Pro initialization is handled by the sentrux-pro crate externally
+    // before calling run(). See sentrux-pro/src/main.rs.
 
     // Step 1: Download missing grammar binaries (may overwrite configs with old versions)
     ensure_grammars_installed();
```

---

### Incident Patch 7: `96224849` (2026-03-17)
**Commit Message**: Fix CI race condition: retry grammar download up to 5x with 60s wait

On tag pushes, CI and Build Grammars run in parallel. CI finishes
first, tries to download grammars from latest release, gets 404
because grammars aren't uploaded yet. Now retries 5 times with 60s
between attempts — enough for the ~14min grammar build to complete.

**File**: `.github/workflows/ci.yml` (modified, +12/-5)
```diff
@@ -67,15 +67,22 @@ jobs:
       - name: Install language grammars
         shell: bash
         run: |
-          # Download grammar bundle from LATEST release (which has grammars)
-          # NOT from current version (grammars may not be uploaded yet)
+          # Download grammar bundle from LATEST release.
+          # On tag pushes, grammars may still be building (race condition).
+          # Retry up to 5 times with 60s wait to let Build Grammars finish.
           PLATFORM=$([ "$RUNNER_OS" = "macOS" ] && echo "darwin-arm64" || echo "linux-x86_64")
           URL="https://github.com/sentrux/sentrux/releases/latest/download/grammars-${PLATFORM}.tar.gz"
           mkdir -p ~/.sentrux/plugins
-          curl -fsSL "$URL" -o /tmp/grammars.tar.gz && tar xzf /tmp/grammars.tar.gz -C ~/.sentrux/plugins/ || echo "Grammar download failed — tests requiring grammars will skip"
+          for i in 1 2 3 4 5; do
+            if curl -fsSL "$URL" -o /tmp/grammars.tar.gz 2>/dev/null; then
+              echo "Grammar bundle downloaded (attempt $i)"
+              tar xzf /tmp/grammars.tar.gz -C ~/.sentrux/plugins/
+              break
+            fi
+            echo "Grammar download attempt $i failed — waiting 60s for build to finish..."
+            sleep 60
+          done
           # Sync embedded plugin configs (TOML) without triggering grammar download
-          # SENTRUX_SKIP_GRAMMAR_DOWNLOAD prevents the app from overwriting
-          # already-installed grammars with a 404 from the current version tag
           SENTRUX_SKIP_GRAMMAR_DOWNLOAD=1 cargo run -- --version || true
 
       - name: Test
```

---

### Incident Patch 8: `9afa49ab` (2026-03-17)
**Commit Message**: Fix demo GIF: crop black borders, 8fps optimized



---

### Incident Patch 9: `b764a89a` (2026-03-17)
**Commit Message**: Fix hardcoded versions: CI stub + doc comment

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ jobs:
           cat > ../sentrux-pro/Cargo.toml << STUBEOF
           [package]
           name = "sentrux-pro"
-          version = "0.5.3"
+          version = "0.5.4"
           edition = "2021"
           [lib]
           path = "src/lib.rs"
```

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -3416,7 +3416,7 @@ dependencies = [
 
 [[package]]
 name = "sentrux-pro"
-version = "0.4.10"
+version = "0.5.4"
 dependencies = [
  "dirs",
  "sentrux-core",
```

**File**: `sentrux-bin/src/main_impl.rs` (modified, +1/-1)
```diff
@@ -820,7 +820,7 @@ fn cli_scan_limits() -> analysis::scanner::common::ScanLimits {
 /// Downloads ONE tarball with ALL grammars — not 49 individual downloads.
 ///
 /// Architecture:
-///   Binary release v0.3.12 on GitHub includes asset:
+///   Each binary release on GitHub includes asset:
 ///     grammars-darwin-arm64.tar.gz (all grammars in one archive)
 ///   This function downloads that ONE file and extracts all grammars at once.
 ///
```

---

### Incident Patch 10: `150f7519` (2026-03-17)
**Commit Message**: Fix Linux ARM64 cross-compilation: add arm64 apt architecture + openssl env vars

**File**: `.github/workflows/release.yml` (modified, +17/-2)
```diff
@@ -41,9 +41,20 @@ jobs:
         run: |
           sudo apt-get update
           if [ "${{ matrix.target }}" = "aarch64-unknown-linux-gnu" ]; then
+            # Add arm64 architecture for cross-compilation packages
+            sudo dpkg --add-architecture arm64
+            sudo sed -i 's/^deb /deb [arch=amd64] /' /etc/apt/sources.list
+            echo "deb [arch=arm64] http://ports.ubuntu.com/ jammy main restricted universe" | sudo tee /etc/apt/sources.list.d/arm64.list
+            echo "deb [arch=arm64] http://ports.ubuntu.com/ jammy-updates main restricted universe" | sudo tee -a /etc/apt/sources.list.d/arm64.list
+            sudo apt-get update
             sudo apt-get install -y gcc-aarch64-linux-gnu \
-              libgtk-3-dev:arm64 libxcb-render0-dev:arm64 libxcb-shape0-dev:arm64 \
-              libxcb-xfixes0-dev:arm64 libxkbcommon-dev:arm64 libssl-dev:arm64 libvulkan-dev:arm64 || \
+              libssl-dev:arm64 \
+              libglib2.0-dev:arm64 \
+              libgtk-3-dev:arm64 \
+              libxcb-render0-dev:arm64 \
+              libxcb-shape0-dev:arm64 \
+              libxcb-xfixes0-dev:arm64 \
+              libxkbcommon-dev:arm64 || \
             sudo apt-get install -y gcc-aarch64-linux-gnu
           else
             sudo apt-get install -y libgtk-3-dev libxcb-render0-dev libxcb-shape0-dev \
@@ -72,6 +83,10 @@ jobs:
           echo 'linker = "aarch64-linux-gnu-gcc"' >> ~/.cargo/config.toml
           echo "PKG_CONFIG_ALLOW_CROSS=1" >> $GITHUB_ENV
           echo "PKG_CONFIG_PATH=/usr/lib/aarch64-linux-gnu/pkgconfig" >> $GITHUB_ENV
+          echo "PKG_CONFIG_SYSROOT_DIR=/" >> $GITHUB_ENV
+          echo "OPENSSL_DIR=/usr" >> $GITHUB_ENV
+          echo "OPENSSL_INCLUDE_DIR=/usr/include/aarch64-linux-gnu" >> $GITHUB_ENV
+          echo "OPENSSL_LIB_DIR=/usr/lib/aarch64-linux-gnu" >> $GITHUB_ENV
 
       - name: Build release binary (with Pro)
         run: cargo build --release --features pro --target ${{ matrix.target }}
```

#### Recent Merged Pull Requests:
- **PR #51** (closed): Claude/verify mcp functionality (@awheelis)
- **PR #33** (closed): fix: resolve PHP namespace imports via PSR-4 autoload mapping (@l-stekels)
- **PR #29** (closed): Switch font to JetBrains Mono, tune default font_scale and ui_scale (@Shiva108)
- **PR #27** (closed): fix(release): gate release and formula update on all builds succeeding (@Mearman)
- **PR #25** (closed): fix: remove sentrux-pro path dependency for open source builds (@Jah-yee)
- **PR #24** (closed): Fix opensource compilation: remove sentrux-pro path dependency (@v1b3coder)
- **PR #18** (closed): fix: resolve Go single-segment package imports (@kylesnowschwartz)
- **PR #17** (closed): fix: improve accuracy for JS/TS codebases + configurable module depth (@trevorsilence)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
